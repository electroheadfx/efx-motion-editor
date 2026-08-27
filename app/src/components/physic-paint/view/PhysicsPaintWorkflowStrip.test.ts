import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  derivePhysicPaintRotoLoopRanges,
  resolvePhysicPaintRotoLoopFrame,
} from '../roto/physicsPaintRotoPhysicalResolver';
import { resolveRotoVisibleFrameResolutions } from '../roto/rotoTimelineSelectors';
import {
  projectPhysicsPaintGroupProductReason,
  projectPhysicsPaintLoopClipGeometry,
  projectPhysicsPaintLoopClipPresentation,
} from './physicsPaintLoopClipPresentation';
import { buildRotoDeleteScopeLabel, type RotoDeleteTarget } from '../hooks/useRotoTimelineActions';

const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintWorkflowStrip.tsx');
const legacyLanePath = resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintLoopClipLane.tsx');
const source = () => readFileSync(sourcePath, 'utf8');
const cssPath = resolve(dirname(fileURLToPath(import.meta.url)), '../physicsPaintStudio.css');
const css = () => readFileSync(cssPath, 'utf8');
const timelineActionsPath = resolve(dirname(fileURLToPath(import.meta.url)), '../hooks/useRotoTimelineActions.ts');
const timelineActionsSource = () => readFileSync(timelineActionsPath, 'utf8');
const armedToolPath = resolve(dirname(fileURLToPath(import.meta.url)), './physicsPaintPushArmedTool.ts');
const armedToolSource = () => readFileSync(armedToolPath, 'utf8');
const studioSourcePath = resolve(dirname(fileURLToPath(import.meta.url)), '../PhysicsPaintStudio.tsx');
const studioSource = () => readFileSync(studioSourcePath, 'utf8');

function getRotoMapBlock(code: string): string {
  const mapStart = code.indexOf('{frameCells.map(frame =>');
  return code.slice(mapStart, code.indexOf('physics-paint-roto-key-utilities', mapStart));
}
function getWorkflowStripPropsInterface(code: string): string {
  return code.slice(code.indexOf('export interface PhysicsPaintWorkflowStripProps'), code.indexOf('const RULER_STEP'));
}
function getStaticChromePropsInterface(code: string): string {
  return code.slice(code.indexOf('interface PhysicsPaintWorkflowStaticChromeProps'), code.indexOf('function PhysicsPaintWorkflowStaticChromeImpl'));
}
function getActionRowBlock(code: string): string {
  // Anchored at the action-row band (not the tools group) so the block spans
  // all three Gap F groups: identity → tools → key spacing (36.15-10).
  const rowStart = code.indexOf('class="physics-paint-roto-action-row"');
  const rowEnd = code.indexOf('physics-paint-timeline-scrollbar', rowStart);
  return code.slice(rowStart, rowEnd === -1 ? code.length : rowEnd);
}
function getActionAriaLabelToken(ariaLabel: string): string {
  if (ariaLabel === 'Insert key before') return 'aria-label={insertRotoKeyDescription}';
  if (ariaLabel === 'Delete Frame') return 'aria-label={deleteRotoScopeLabel}';
  return `aria-label="${ariaLabel}"`;
}
function getButtonBlock(code: string, ariaLabel: string): string {
  const labelIndex = code.indexOf(getActionAriaLabelToken(ariaLabel));
  if (labelIndex === -1) return '';
  const start = code.lastIndexOf('<button', labelIndex);
  const end = code.indexOf('</button>', labelIndex) + '</button>'.length;
  return code.slice(start, end);
}
function getMatchingDivEnd(code: string, start: number): number {
  const tag = /<div\b|<\/div>/g;
  tag.lastIndex = start;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(code)) !== null) {
    depth += match[0] === '</div>' ? -1 : 1;
    if (depth === 0) return tag.lastIndex;
  }
  return -1;
}
function countOccurrences(code: string, literal: string): number {
  return code.split(literal).length - 1;
}

describe('Delete scope copy', () => {
  const groupTarget = (
    mode: 'progressive' | 'static',
  ): Extract<RotoDeleteTarget, { kind: 'group' }> => ({
    kind: 'group',
    groupId: `${mode}-rail`,
    appFrame: 10,
    mode,
    phaseOrigin: 10,
    onlyOccurrence: false,
  });

  it('maps physical, Motion Rail, and Static Rail selection to one exact live scope', () => {
    expect(buildRotoDeleteScopeLabel({ kind: 'ordinary-key', keyId: 'frame-key' })).toBe('Delete Frame');
    expect(buildRotoDeleteScopeLabel(groupTarget('progressive'), 'Walk Cycle')).toBe(
      'Delete Motion Rail — Walk Cycle',
    );
    expect(buildRotoDeleteScopeLabel(groupTarget('static'), 'Held Pose')).toBe(
      'Delete Static Rail — Held Pose',
    );
  });

  it('maps multiple-key and single-key Key Rails with bounded frame/count copy', () => {
    expect(buildRotoDeleteScopeLabel({
      kind: 'key-rail',
      firstKeyId: 'rail-a',
      keyIds: ['rail-a', 'rail-b', 'rail-c'],
      firstKeyFrame: 2,
      lastKeyFrame: 8,
    })).toBe('Delete Key Rail — frames 2–8, 3 keys.');
    expect(buildRotoDeleteScopeLabel({
      kind: 'key-rail',
      firstKeyId: 'only-rail',
      keyIds: ['only-rail'],
      firstKeyFrame: 4,
      lastKeyFrame: 4,
    })).toBe('Delete Key Rail — frame 4, 1 key.');
  });
});

const ROW_ICON_ACTIONS: ReadonlyArray<{ label: string; guard: string; handler: string }> = [
  { label: 'Add key', guard: 'canAddRotoKey', handler: 'props.onAddRotoKey?.()' },
  { label: 'Insert key before', guard: 'canInsertRotoKey', handler: 'props.onInsertRotoFrame?.()' },
  { label: 'Duplicate key', guard: 'canDuplicateRotoKey', handler: 'props.onDuplicateRotoKey?.()' },
  { label: 'Copy key', guard: 'canCopyRotoKey', handler: 'props.onCopyRotoFrame?.()' },
  { label: 'Cut key', guard: 'canCutRotoKey', handler: 'props.onCutRotoFrame?.()' },
  { label: 'Split Key Rail', guard: 'canScissorRotoKey', handler: 'props.onScissorKeyRail?.()' },
  { label: 'Paste key', guard: 'canPasteRotoKey', handler: 'props.onPasteRotoFrame?.()' },
  { label: 'Delete Frame', guard: 'canDeleteRotoKey', handler: 'props.onDeleteRotoFrame?.()' },
];

describe('PhysicsPaintWorkflowStrip source contract', () => {
  it('renders an optional supplied workflow label with a non-ordinal fallback', () => {
    const code = source();
    expect(getWorkflowStripPropsInterface(code)).toContain('workflowLabel?: string');
    expect(code).toContain("{props.workflowLabel ?? 'PPaint'}");
    expect(code).not.toContain('PPaint #1');
  });

  it('keeps the Roto-only timeline and removes separate Play save controls', () => {
    const code = source();
    expect(code).toContain('physics-paint-roto-cell');
    expect(code).not.toContain('Render play');
    expect(code).not.toContain('onSavePlay');
    expect(code).not.toContain('getPhysicsPaintSourceLabel');
  });

  it('removes manual Roto save, pending, saving, and retry UI', () => {
    const code = source();
    for (const obsolete of ['Save current', 'Save pending', 'onSaveRotoFrame', 'onSavePendingRotoFrames', 'pendingRotoFrames', 'rotoSavingFrame', 'rotoSaveInFlight', 'Unsaved', 'Saving frame']) expect(code).not.toContain(obsolete);
  });

  it('routes visible Delete through the shared activation callback without inferring Group ownership', () => {
    const block = getButtonBlock(getActionRowBlock(source()), 'Delete Frame');
    expect(countOccurrences(block, 'props.onDeleteRotoFrame?.()')).toBe(1);
    for (const forbidden of ['loopId', 'visibleRanges', 'group-choice', 'classifyRotoDeleteTarget']) {
      expect(block).not.toContain(forbidden);
    }
  });

  it('uses the same dynamic Delete scope for the accessible name and guarded tooltip while keeping the button icon-only', () => {
    const code = source();
    const row = getActionRowBlock(code);
    const block = getButtonBlock(row, 'Delete Frame');

    expect(code).toContain("const deleteRotoScopeLabel = physicalActions?.deleteScopeLabel.value ?? 'Delete Frame';");
    expect(block).toContain('aria-label={deleteRotoScopeLabel}');
    expect(code).toContain('buildGuardedActionTooltipCopy(deleteRotoScopeLabel, deleteRotoKeyDisabledReason)');
    // 43.5-05 smoke UX5: the Delete button is icon-only — the dynamic scope
    // copy lives in tooltip/aria/status, never a visible text label.
    expect(block).not.toContain('<span class="physics-paint-roto-key-icon-label">Delete</span>');
    expect(block).not.toContain('Delete key');
  });

  it('keeps interpolation, onion, and key utility controls', () => {
    const code = source();
    expect(code).toContain('physics-paint-roto-interpolation-controls');
    expect(code).toContain('physics-paint-roto-interpolation-toggle');
    expect(code).toContain('aria-label="Interpolation mode"');
    expect(code).toContain('aria-label="Empty frames between real keys"');
    expect(code).toContain('onOnionChange');
    expect(code).toContain('onInsertRotoFrame');
    expect(code).toContain('onDeleteRotoFrame');
    expect(code).toContain('onCopyRotoFrame');
    expect(code).toContain('onPasteRotoFrame');
  });

  it('disables and handler-guards interpolation controls only while the mutation lock is active', () => {
    const code = source();
    expect(getWorkflowStripPropsInterface(code)).toContain('mutationLocked?: boolean');
    expect(code).toContain('const interpolationControlsDisabled = props.ready === false || Boolean(props.mutationLocked) || Boolean(props.rotoInterpolationPending);');
    expect(code).toContain('disabled={props.interpolationControlsDisabled}');
    expect(code.match(/if \(props\.mutationLocked \|\| props\.interpolationPending\) return;/g)).toHaveLength(1);
    expect(code).toContain('if (props.ready === false || props.mutationLocked || !forceSpacingAvailable) return;');
  });

  it('guards the Paste key icon action with aria-disabled and a styled tooltip', () => {
    const code = source();
    expect(code).toContain('aria-label="Paste key"');
    expect(code).toContain('ClipboardPaste');
    const labelIndex = code.indexOf('aria-label="Paste key"');
    const buttonStart = code.lastIndexOf('<button', labelIndex);
    const buttonEnd = code.indexOf('</button>', labelIndex) + '</button>'.length;
    const pasteBlock = code.slice(buttonStart, buttonEnd);
    expect(pasteBlock).toContain('aria-disabled');
    expect(pasteBlock).toContain('aria-describedby');
    expect(pasteBlock.replace(/aria-disabled/g, '')).not.toContain('disabled=');
    expect(pasteBlock).not.toContain('title=');
    const guardIndex = pasteBlock.indexOf('if (!canPasteRotoKey) return;');
    const handlerIndex = pasteBlock.indexOf('props.onPasteRotoFrame?.()');
    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(handlerIndex).toBeGreaterThan(guardIndex);
    expect(code).toContain("buildGuardedActionTooltipCopy('Paste key', pasteRotoKeyDisabledReason)");
  });

  it('renders the Key {n} chip before any action button in the row (D-13)', () => {
    const row = getActionRowBlock(source());
    const chipIndex = row.indexOf('physics-paint-roto-key-context');
    const firstButtonIndex = row.indexOf('<button');
    expect(chipIndex).toBeGreaterThanOrEqual(0);
    expect(firstButtonIndex).toBeGreaterThan(chipIndex);
  });

  it('shows the layer name with the current frame before the first action-row icon', () => {
    const row = getActionRowBlock(source());
    const layerIndex = row.indexOf('physics-paint-roto-key-layer');
    const chipIndex = row.indexOf('physics-paint-roto-key-context');
    const firstButtonIndex = row.indexOf('<button');
    expect(layerIndex).toBeGreaterThanOrEqual(0);
    expect(chipIndex).toBeGreaterThan(layerIndex);
    expect(firstButtonIndex).toBeGreaterThan(chipIndex);
    expect(row).toContain("{props.workflowLabel ?? 'PPaint'}");
    // The layer name no longer occupies the header.
    expect(getHeaderBlock(source())).not.toContain('physics-paint-mode-label');
  });

  it('renders the seven guarded icon actions in locked order (D-10)', () => {
    const row = getActionRowBlock(source());
    const indices = ROW_ICON_ACTIONS.map(({ label }) => row.indexOf(getActionAriaLabelToken(label)));
    indices.forEach((index) => expect(index).toBeGreaterThanOrEqual(0));
    for (let i = 1; i < indices.length; i += 1) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]);
    }
    expect(source()).toContain('Plus');
    expect(source()).toContain('CopyPlus');
    expect(source()).toContain('BetweenVerticalStart');
    expect(source()).toContain('ClipboardCopy');
    expect(source()).toContain('Scissors');
    expect(source()).toContain('ClipboardPaste');
    expect(source()).toContain('Trash2');
    // Copy Script / Apply Script moved to the Scripts sidebar toolbar (Gap C).
    expect(row).not.toContain('aria-label="Copy Script"');
    expect(row).not.toContain('aria-label="Apply Script"');
    expect(source()).not.toMatch(/[^a-zA-Z]Clipboard[^a-zA-Z]/);
    expect(source()).not.toContain('ClipboardPen');
  });

  it('removes the seven text buttons, the Discard Script button, and the script action props from the row (D-11, Gap C)', () => {
    const code = source();
    const row = getActionRowBlock(code);
    for (const obsolete of ['>Insert</button>', '>Dup</button>', '>Copy</button>', '>Paste</button>', '>Delete</button>', '>Copy Script</button>', '>Apply Script</button>', '>Discard Script</button>']) {
      expect(row).not.toContain(obsolete);
    }
    expect(row).not.toContain('Discard Script');
    expect(row).not.toContain('physics-paint-roto-key-button"');
    const propsInterface = getWorkflowStripPropsInterface(code);
    expect(propsInterface).not.toContain('onDiscardRotoScript');
    expect(propsInterface).not.toContain('onCopyRotoScript');
    expect(propsInterface).not.toContain('onApplyRotoScript');
    expect(code).not.toContain('onCopyRotoScript');
    expect(code).not.toContain('onApplyRotoScript');
  });

  it('keeps every guarded action focusable without native disabled and guarded on click and keydown (D-12)', () => {
    const code = source();
    const row = getActionRowBlock(code);
    expect(row.replace(/aria-disabled/g, '')).not.toContain('disabled=');
    expect(row).not.toContain('title=');
    for (const { label, guard, handler } of ROW_ICON_ACTIONS) {
      const block = getButtonBlock(row, label);
      expect(block).toContain('aria-disabled');
      expect(block).toContain('aria-describedby');
      const guardIndex = block.indexOf(`if (!${guard}) return;`);
      const handlerIndex = block.indexOf(handler);
      expect(guardIndex).toBeGreaterThanOrEqual(0);
      expect(handlerIndex).toBeGreaterThan(guardIndex);
      expect(block).toContain(`(event.key === 'Enter' || event.key === ' ') && !${guard}`);
    }
  });

  it('carries de-prefixed tooltip copy via the shared guarded-action copy builder on every action (Gap D)', () => {
    const code = source();
    const row = getActionRowBlock(code);
    // The tool-name prefix is dropped: description or 'unavailable: {reason}'.
    expect(row).not.toContain(' — unavailable: ');
    expect(code).toContain('function buildGuardedActionTooltipCopy(description: string, disabledReason: string | null)');
    expect(code).toContain('return disabledReason ? `unavailable: ${disabledReason}` : description;');
    const builderCalls = (row.match(/buildGuardedActionTooltipCopy\(/g) ?? []).length;
    // Eight guarded icon actions plus the Set Key Space form.
    expect(builderCalls).toBeGreaterThanOrEqual(9);
    // Script copy/apply availability reasons now surface in the Scripts
    // sidebar toolbar, not the strip (Gap C).
    expect(code).not.toContain('copyDisabledReason');
    expect(code).not.toContain('applyDisabledReason');
  });

  it('renders a short visible label after each enlarged bottom-row icon (Gap D)', () => {
    const row = getActionRowBlock(source());
    const labeledActions: ReadonlyArray<{ action: string; icon: string; label: string }> = [
      { action: 'Add key', icon: 'Plus', label: 'Key' },
      { action: 'Duplicate key', icon: 'CopyPlus', label: 'Duplicate' },
      { action: 'Insert key before', icon: 'BetweenVerticalStart', label: 'Insert' },
      { action: 'Copy key', icon: 'ClipboardCopy', label: 'Copy' },
      { action: 'Cut key', icon: 'Scissors', label: 'Cut' },
      { action: 'Split Key Rail', icon: 'SquareSplitHorizontal', label: 'Scissor' },
      { action: 'Paste key', icon: 'ClipboardPaste', label: 'Paste' },
    ];
    for (const { action, icon, label } of labeledActions) {
      const block = getButtonBlock(row, action);
      const iconIndex = block.indexOf(`<${icon} size={18}`);
      expect(iconIndex).toBeGreaterThanOrEqual(0);
      const labelIndex = block.indexOf(`<span class="physics-paint-roto-key-icon-label">${label}</span>`);
      expect(labelIndex).toBeGreaterThan(iconIndex);
    }
    expect(row).not.toContain('size={16}');
    // 43.5-02 Task 2: the Set Key Space form relocated from the bottom row
    // into the toolbox popover (header block), carrying its own short label
    // after the icon (renamed 'Space' → 'Key spacing' in 36.15-09, UAT Gap
    // E-2) with the same 18px icon and label ordering.
    expect(row).not.toContain('physics-paint-pill--apply-spacing');
    const header = getHeaderBlock(source());
    const spacingIndex = header.indexOf('physics-paint-pill--apply-spacing');
    const form = header.slice(spacingIndex, header.indexOf('</form>', spacingIndex));
    const spacingIconIndex = form.indexOf('<AlignHorizontalSpaceAround size={18}');
    expect(spacingIconIndex).toBeGreaterThanOrEqual(0);
    expect(form.indexOf('<span class="physics-paint-roto-key-icon-label">Key spacing</span>')).toBeGreaterThan(spacingIconIndex);
  });

  it('enlarges the bottom-row icon buttons and styles the visible labels within the 34px band', () => {
    const styles = css();
    const button = getCssRuleBlock(styles, '.physics-paint-roto-key-icon-button {');
    expect(button).toContain('height: 26px');
    expect(button).toContain('min-width: 26px');
    expect(button).toContain('gap: 4px');
    const label = getCssRuleBlock(styles, '\n.physics-paint-roto-key-icon-label {');
    expect(label).not.toBe('');
    expect(label).toContain('white-space: nowrap');
    expect(getCssRuleBlock(styles, '.physics-paint-roto-action-row {')).toContain('height: 34px');
  });

  it('keeps generated frames non-editable and real cached frames selectable', () => {
    const code = source(); const map = getRotoMapBlock(code);
    expect(code).toContain("marker.source !== 'generated-interpolation'");
    expect(map).toContain("const isGenerated = semanticCell?.kind === 'generated'");
    expect(map).toContain("const isPhysicalRealKey = semanticCell?.kind === 'real'");
    // 43-02 Pitfall 7: the interaction gate is a no-op for real keys (a
    // physical real key always resolves 'real') and hard-excludes virtual
    // linked occurrences when a loop resolution context is present.
    expect(map).toContain('const dragEligible = isPhysicalRealKey && spacingProxy === null && !rotoDragLocked && frameInteraction?.dragEligible !== false;');
  });

  it('keeps source interpolation blue and restores a lighter mirrored-key rhythm inside dark repeats', () => {
    const map = getRotoMapBlock(source());
    expect(map).toContain("const isLinkedRepeat = frameResolution?.kind === 'linked-unresolved'");
    expect(map).toContain('frameResolution.repeatInstance > 0');
    expect(map).toContain("const isLinkedRepeatSourceKey = frameResolution?.kind === 'linked'");
    expect(map).toContain('&& !isGenerated;');
    expect(map).toContain("isLinkedRepeatSourceKey ? 'roto-linked-repeat roto-linked-repeat-source-key'");
    expect(map).toContain("frameResolution?.kind === 'linked-generated' || (frameResolution?.kind === 'linked' && isGenerated)");
    expect(map).toContain("? 'roto-linked-source-generated'");
    expect(map).toContain("${hasLinkedLoopBadge ? `roto-linked-loop-badge ${linkedLoopClass}` : ''}");
    expect(map).toContain('const lifecycleTarget = lifecycleTargetByAppFrame.get(frame)!;');
    expect(map).toContain('const fillClass = getRotoAcceptedCellFillClass({');
    expect(map).toContain('lifecycleTargetKind: lifecycleTarget.kind');
    expect(map).toContain("resolutionKind: frameResolution?.kind ?? 'empty'");
    expect(map).toContain('const dragEligible = isPhysicalRealKey && spacingProxy === null && !rotoDragLocked && frameInteraction?.dragEligible !== false;');
    expect(map).toContain('getRotoResolutionCellTooltipCopy(frameResolution, existingCellTooltipKind, loopSourceFrameCountById)');
    expect(map).toContain('const cellAriaLabel =');

    const styles = css();
    const sourceGenerated = getCssRuleBlock(styles, '.physics-paint-roto-cell.roto-fill-generated {');
    const sourceGeneratedInterior = getCssRuleBlock(styles, '.physics-paint-roto-cell.roto-fill-generated::before {');
    const repeat = getCssRuleBlock(styles, '.physics-paint-roto-cell.roto-linked-repeat {');
    const repeatSourceKey = getCssRuleBlock(styles, '.physics-paint-roto-cell.roto-linked-repeat.roto-linked-repeat-source-key {');
    const repeatInterior = getCssRuleBlock(styles, '.physics-paint-roto-cell.roto-linked-repeat::before {');
    const repeatDot = getCssRuleBlock(styles, '.physics-paint-roto-cell.roto-linked-repeat::after {');
    expect(sourceGenerated).toContain('background: #365ed6');
    expect(sourceGeneratedInterior).toContain('background: rgba(255, 255, 255, 0.72)');
    expect(styles).not.toContain('.physics-paint-roto-cell.roto-linked-source-generated::after');
    expect(repeat).toContain('background: #34383c');
    expect(repeat).toContain('box-shadow: inset 0 0 0 1px rgba(211, 215, 221, 0.82)');
    expect(repeatSourceKey).toContain('background: #43494f');
    expect(repeatSourceKey).not.toContain('#4b6382');
    expect(repeatInterior).toContain('content: none');
    expect(repeatDot).toContain('background: rgba(221, 224, 229, 0.9)');
    expect(repeatDot).toContain('width: 4px');
    expect(repeatDot).toContain('height: 4px');
    expect(repeatDot).toContain('top: 2px');
    expect(repeatDot).toContain('right: 2px');
    // 47-01 UAT round 5: the cell is 18px wide × 22px tall (17px wide + 1px
    // border, 21px tall + 1px border), centered vertically in the 30px row —
    // the frames must not stretch to fill the row height.
    expect(getCssRuleBlock(styles, '.physics-paint-roto-cell {')).toContain('height: 22px');
    expect(getCssRuleBlock(styles, '.physics-paint-roto-cells {')).not.toContain('repeat(120, 18px)');
  });

  it('renders an accepted predecessor-aware interpolation cut inside the existing cell target', () => {
    const code = source();
    const map = getRotoMapBlock(code);
    const propsInterface = getWorkflowStripPropsInterface(code);
    const buttonStart = code.indexOf('function RotoTimelineCellButtonImpl');
    const buttonEnd = code.indexOf('const RotoTimelineCellButton = memo', buttonStart);
    const button = code.slice(buttonStart, buttonEnd);
    const markerStart = button.indexOf('class="physics-paint-roto-segment-start-cut"');
    const marker = button.slice(button.lastIndexOf('<span', markerStart), button.indexOf('/>', markerStart) + 2);

    expect(propsInterface).toContain('rotoIncomingInterpolationBreakKeyIds?: readonly string[]');
    expect(map).toContain('getRotoCellPresentationViewModel({');
    expect(map).toContain("kind: hasLinkedLoopBadge ? 'linked' : isPhysicalRealKey ? 'real' : isGenerated ? 'generated' : 'empty'");
    expect(map).toContain('incomingInterpolationBreakKeyIds');
    expect(map).toContain("cellPresentation.startsInterpolationSegment ? 'starts-interpolation-segment' : ''");
    expect(map).toContain('startsInterpolationSegment={cellPresentation.startsInterpolationSegment}');
    expect(countOccurrences(button, '<button')).toBe(1);
    expect(marker).toContain('aria-hidden="true"');
    expect(marker).not.toMatch(/on[A-Z]|tabIndex|role=|aria-label/);
  });

  it('styles the segment cut as a non-white 2px accent without changing cell or Loop Rail geometry', () => {
    const styles = css();
    const cut = getCssRuleBlock(styles, '.physics-paint-roto-cell.starts-interpolation-segment .physics-paint-roto-segment-start-cut {');

    expect(cut).toContain('width: 2px');
    expect(cut).toContain('background: #6f90ff');
    expect(cut).toContain('pointer-events: none');
    expect(cut).not.toMatch(/background:\s*(?:white|#fff(?:fff)?|#f8fafc|rgba?\(255)/i);
    expect(cut).not.toMatch(/(?:^|\n)\s*(?:height|padding|margin|min-width|max-width):/);
    // 47-01 UAT round 5: the cell is 18px wide × 22px tall (17px wide + 1px
    // border, 21px tall + 1px border), centered vertically in the 30px row —
    // the frames must not stretch to fill the row height.
    expect(getCssRuleBlock(styles, '.physics-paint-roto-cell {')).toContain('height: 22px');
    expect(getCssRuleBlock(styles, '.physics-paint-roto-cells {')).not.toContain('grid-template-columns');
    expect(getCssRuleBlock(styles, '.physics-paint-roto-cell.roto-loop-boundary-start {')).toContain('border-left-color: #f8fafc');
    expect(getCssRuleBlock(styles, '.physics-paint-roto-cell.roto-loop-boundary-end {')).toContain('border-right-color: #f8fafc');
  });

  it('keeps one visible Insert label with the contextual enabled description and guarded reason path', () => {
    const code = source();
    const row = getActionRowBlock(code);
    const actions = timelineActionsSource();

    expect(countOccurrences(row, '<span class="physics-paint-roto-key-icon-label">Insert</span>')).toBe(1);
    expect(code).toContain("physicalActions?.insertTooltipDescription.value ?? 'Insert key before'");
    expect(code).toContain('buildGuardedActionTooltipCopy(insertRotoKeyDescription, insertRotoKeyDisabledReason)');
    expect(actions).toContain("? 'Insert an empty key connected to the previous segment.'");
    expect(actions).toContain(": 'Insert key before'");
  });
});

describe('PhysicsPaintWorkflowStrip Cut key contract (quick 260731-9l0)', () => {
  it('renders the clipboard row in locked Copy, Cut, Scissor, Paste, Delete order', () => {
    const row = getActionRowBlock(source());
    const copyIndex = row.indexOf('aria-label="Copy key"');
    const cutIndex = row.indexOf('aria-label="Cut key"');
    const scissorIndex = row.indexOf('aria-label="Split Key Rail"');
    const pasteIndex = row.indexOf('aria-label="Paste key"');
    const deleteIndex = row.indexOf(getActionAriaLabelToken('Delete Frame'));
    expect(copyIndex).toBeGreaterThanOrEqual(0);
    expect(cutIndex).toBeGreaterThan(copyIndex);
    expect(scissorIndex).toBeGreaterThan(cutIndex);
    expect(pasteIndex).toBeGreaterThan(scissorIndex);
    expect(deleteIndex).toBeGreaterThan(pasteIndex);
  });

  it('enables Cut only when BOTH copy and delete availability hold, chaining the verbatim controller reasons', () => {
    const code = source();
    expect(code).toContain('const canCutRotoKey = canCopyRotoKey && canDeleteRotoKey;');
    expect(code).toContain('const cutRotoKeyDisabledReason = canCutRotoKey ? null : (copyRotoKeyDisabledReason ?? deleteRotoKeyDisabledReason);');
  });

  it('guards the Cut key icon action with aria-disabled, a verbatim reason span, and the guarded tooltip', () => {
    const code = source();
    const row = getActionRowBlock(code);
    const block = getButtonBlock(row, 'Cut key');
    expect(block).toContain('aria-label="Cut key"');
    expect(block).toContain('aria-disabled={!canCutRotoKey');
    expect(block).toContain("aria-describedby={!canCutRotoKey && cutRotoKeyDisabledReason ? 'roto-key-action-reason-cut' : undefined}");
    expect(block.replace(/aria-disabled/g, '')).not.toContain('disabled=');
    expect(block).not.toContain('title=');
    const guardIndex = block.indexOf('if (!canCutRotoKey) return;');
    const handlerIndex = block.indexOf('props.onCutRotoFrame?.()');
    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(handlerIndex).toBeGreaterThan(guardIndex);
    expect(block).toContain("(event.key === 'Enter' || event.key === ' ') && !canCutRotoKey");
    expect(block).toContain('<Scissors size={18} aria-hidden="true" />');
    expect(block).toContain('<span class="physics-paint-roto-key-icon-label">Cut</span>');
    // Cut sits with the clipboard actions; Delete keeps the trailing destructive position.
    expect(block).not.toContain('destructive');
    expect(code).toContain('id="roto-key-action-reason-cut"');
    expect(code).toContain("buildGuardedActionTooltipCopy('Cut key', cutRotoKeyDisabledReason)");
    expect(getWorkflowStripPropsInterface(code)).toContain('onCutRotoFrame?: () => void;');
  });
});

describe('PhysicsPaintWorkflowStrip Scissor key-rail contract (43.4-01)', () => {
  it('guards activation, exposes the locked reason and tooltip, and keeps the distinct icon', () => {
    const code = source();
    const row = getActionRowBlock(code);
    const block = getButtonBlock(row, 'Split Key Rail');

    expect(block).toContain('aria-label="Split Key Rail"');
    expect(block).toContain('aria-disabled={!canScissorRotoKey');
    expect(block).toContain("aria-describedby={!canScissorRotoKey && scissorRotoKeyDisabledReason ? 'roto-key-action-reason-scissor' : undefined}");
    expect(block.replace(/aria-disabled/g, '')).not.toContain('disabled=');
    expect(block).not.toContain('title=');
    expect(block.indexOf('if (!canScissorRotoKey) return;')).toBeGreaterThanOrEqual(0);
    expect(block.indexOf('props.onScissorKeyRail?.()')).toBeGreaterThan(block.indexOf('if (!canScissorRotoKey) return;'));
    expect(block).toContain("(event.key === 'Enter' || event.key === ' ') && !canScissorRotoKey");
    expect(block).toContain('<SquareSplitHorizontal size={18} aria-hidden="true" />');
    expect(block).not.toContain('<Scissors');
    expect(block).toContain('<span class="physics-paint-roto-key-icon-label">Scissor</span>');
    expect(code).toContain('id="roto-key-action-reason-scissor"');
    expect(code).toContain("buildGuardedActionTooltipCopy(physicalActions?.scissorTooltipDescription.value ?? 'Split the Key Rail before this key.', scissorRotoKeyDisabledReason)");
    expect(getWorkflowStripPropsInterface(code)).toContain('onScissorKeyRail?: () => void;');
  });
});

describe('localized render contract', () => {
  it('owns timeline observers for the mount lifetime and refreshes geometry separately', () => {
    const code = source();
    expect(code).toContain('const timelineContentRef = useRef<HTMLDivElement>(null);');
    const observerEnd = code.indexOf('}, [updateScrollbar, updateVerticalScrollbar]);');
    const observerStart = code.lastIndexOf('useEffect(() => {', observerEnd);
    const observerEffect = code.slice(observerStart, observerEnd + '}, [updateScrollbar, updateVerticalScrollbar]);'.length);
    expect(observerStart).toBeGreaterThanOrEqual(0);
    expect(observerEffect).toContain('const content = timelineContentRef.current;');
    expect(observerEffect).toContain('observer.observe(content);');
    expect(observerEffect).toContain('observer.observe(rows);');
    expect(observerEffect).toContain('updateVerticalScrollbar();');
    expect(observerEffect).not.toContain('frameCells');
    expect(observerEffect).toContain("recordPhysicsPaintPerformanceCounter('observer.timeline.resize.install')");
    expect(observerEffect).toContain("recordPhysicsPaintPerformanceCounter('observer.timeline.resize.cleanup')");
    expect(code).toContain('useLayoutEffect(() => {\n    updateScrollbar();\n    updateVerticalScrollbar();\n  }, [frameCells, currentPhysicalCells, updateScrollbar, updateVerticalScrollbar]);');
    expect(code).toContain('ref={timelineContentRef}');
    expect(code).toContain('class={`physics-paint-lane');
    expect(code).toContain('gridTemplateColumns: `${rotoLaneWidthPx}px`');
  });

  it('preserves the wheel and drag cleanup contracts while observer ownership changes', () => {
    const code = source();
    expect(code).toContain("el.addEventListener('wheel', handleTimelineWheel, { passive: false });");
    expect(code).toContain("return () => el.removeEventListener('wheel', handleTimelineWheel);");
    expect(code).toContain("window.removeEventListener('pointermove', handlePointerMove);");
    expect(code).toContain("window.removeEventListener('keydown', handleEscape, true);");
    expect(code).toContain('if (session.rafId !== null) window.cancelAnimationFrame(session.rafId);');
    expect(code).toContain('sourceElement.setPointerCapture(session.pointerId);');
  });

  it('memoizes private timeline cells behind stable shared frame and key actions', () => {
    const code = source();
    const cellStart = code.indexOf('function RotoTimelineCellButtonImpl(');
    const cellEnd = code.indexOf('const RotoTimelineCellButton = memo(', cellStart);
    const cellBlock = code.slice(cellStart, cellEnd);
    const map = getRotoMapBlock(code);

    expect(cellStart).toBeGreaterThanOrEqual(0);
    expect(cellBlock).toContain("recordPhysicsPaintPerformanceCounter('render.rotoTimelineCellButton')");
    expect(cellBlock).toContain('const tooltip = useStyledTooltip();');
    expect(code).toContain('const RotoTimelineCellButton = memo(RotoTimelineCellButtonImpl);');
    expect(code).toContain('const handleRotoTimelineCellClick = useCallback(');
    expect(code).toContain('const handleRotoTimelineCellPointerDown = useCallback(');
    expect(map).toContain('key={frame}');
    expect(map).toContain('vm={vm}');
    expect(map).toContain('dragEligible={dragEligible}');
    expect(map).toContain('onCellPointerDown={handleRotoTimelineCellPointerDown}');
    expect(map).toContain('onCellClick={handleRotoTimelineCellClick}');
    expect(map).not.toContain('onCellPointerDown={dragEligible && cellKeyId ? (event) =>');
    expect(map).not.toContain('onCellClick={(event) =>');
  });
});

describe('localized static and live Workflow regions', () => {
  it('isolates private static chrome behind compat memo and keeps live status narrow', () => {
    const code = source();
    // 43.5-02: the static chrome now also portals the toolbox popover to
    // document.body, so createPortal shares the compat import line.
    expect(code).toContain("import { createPortal, memo } from 'preact/compat';");
    expect(code).toContain('function PhysicsPaintWorkflowStaticChromeImpl(');
    expect(code).toContain('const PhysicsPaintWorkflowStaticChrome = memo(PhysicsPaintWorkflowStaticChromeImpl);');
    expect(code).toContain('function PhysicsPaintWorkflowLiveStatus(');
    const staticStart = code.indexOf('function PhysicsPaintWorkflowStaticChromeImpl(');
    const staticEnd = code.indexOf('const PhysicsPaintWorkflowStaticChrome = memo(', staticStart);
    const staticBlock = code.slice(staticStart, staticEnd);
    expect(staticBlock).toContain("recordPhysicsPaintPerformanceCounter('render.workflowStaticChrome')");
    expect(staticBlock).toContain('physics-paint-workflow-header');
    expect(staticBlock).toContain('physics-paint-pill--playback');
    expect(staticBlock).toContain('physics-paint-pill--interpolation');
    expect(staticBlock).toContain('aria-label="Close"');
    expect(staticBlock).toContain('<PhysicsPaintWorkflowLiveStatus');
    expect(countOccurrences(code, "recordPhysicsPaintPerformanceCounter('render.workflowStaticChrome')")).toBe(1);
  });

  it('keeps the public strip and StudioView mount compatible', () => {
    const code = source();
    expect(code).toContain('export function PhysicsPaintWorkflowStrip(props: PhysicsPaintWorkflowStripProps)');
    expect(code).toContain('<PhysicsPaintWorkflowStaticChrome');
    expect(code).not.toContain("recordPhysicsPaintPerformanceCounter('render.workflowStaticChrome');\n  const [scrollbar");
  });
});

describe('localized render instrumentation', () => {
  it('counts the live strip and extracted static chrome at their implementation owners', () => {
    const code = source();
    const stripStart = code.indexOf('export function PhysicsPaintWorkflowStrip');
    const stripBody = code.slice(stripStart, code.indexOf('const [scrollbar', stripStart));
    const staticStart = code.indexOf('function PhysicsPaintWorkflowStaticChromeImpl');
    const staticBody = code.slice(staticStart, code.indexOf('const closeTooltip', staticStart));

    expect(stripStart).toBeGreaterThanOrEqual(0);
    expect(staticStart).toBeGreaterThanOrEqual(0);
    expect(countOccurrences(code, "recordPhysicsPaintPerformanceCounter('render.workflowStrip')")).toBe(1);
    expect(countOccurrences(code, "recordPhysicsPaintPerformanceCounter('render.workflowStaticChrome')")).toBe(1);
    expect(stripBody).toContain("recordPhysicsPaintPerformanceCounter('render.workflowStrip')");
    expect(stripBody).not.toContain("recordPhysicsPaintPerformanceCounter('render.workflowStaticChrome')");
    expect(staticBody).toContain("recordPhysicsPaintPerformanceCounter('render.workflowStaticChrome')");
  });

  it('counts each private timeline cell body at its current owner', () => {
    const code = source();
    const cellStart = code.indexOf('function RotoTimelineCellButton');
    const cellBody = code.slice(cellStart, code.indexOf('const tooltip', cellStart));

    expect(cellStart).toBeGreaterThanOrEqual(0);
    expect(countOccurrences(code, "recordPhysicsPaintPerformanceCounter('render.rotoTimelineCellButton')")).toBe(1);
    expect(cellBody).toContain("recordPhysicsPaintPerformanceCounter('render.rotoTimelineCellButton')");
  });

  it('counts timeline ResizeObserver install and cleanup at the mount-stable owner', () => {
    const code = source();
    const effectEnd = code.indexOf('}, [updateScrollbar, updateVerticalScrollbar]);');
    const effectStart = code.lastIndexOf('useEffect(() => {', effectEnd);
    const observerEffect = code.slice(effectStart, effectEnd + '}, [updateScrollbar, updateVerticalScrollbar]);'.length);

    expect(effectStart).toBeGreaterThanOrEqual(0);
    expect(countOccurrences(code, "recordPhysicsPaintPerformanceCounter('observer.timeline.resize.install')")).toBe(1);
    expect(countOccurrences(code, "recordPhysicsPaintPerformanceCounter('observer.timeline.resize.cleanup')")).toBe(1);
    expect(observerEffect).toContain("recordPhysicsPaintPerformanceCounter('observer.timeline.resize.install')");
    expect(observerEffect).toContain("recordPhysicsPaintPerformanceCounter('observer.timeline.resize.cleanup')");
    expect(observerEffect).toContain('}, [updateScrollbar, updateVerticalScrollbar]);');
  });
});

function getHeaderBlock(code: string): string {
  const headerStart = code.indexOf('<div class="physics-paint-workflow-header">');
  if (headerStart === -1) return '';
  const headerEnd = code.indexOf('<div class="physics-paint-timeline"', headerStart);
  return code.slice(headerStart, headerEnd === -1 ? code.length : headerEnd);
}

function getCssRuleBlock(styles: string, selector: string): string {
  const start = styles.indexOf(selector);
  if (start === -1) return '';
  const end = styles.indexOf('}', start);
  return end === -1 ? '' : styles.slice(start, end + 1);
}

describe('PhysicsPaintWorkflowStrip header pill contract (36.15-04)', () => {
  it('renders the interpolation toggle as a borderless Blend icon toggle with no count input or text label', () => {
    const code = source();
    const labelIndex = code.indexOf("'Disable generated in-betweens'");
    const toggleStart = code.lastIndexOf('<button', labelIndex);
    const toggleEnd = code.indexOf('</button>', labelIndex) + '</button>'.length;
    const toggle = code.slice(toggleStart, toggleEnd);
    expect(toggle).toContain('physics-paint-roto-interpolation-toggle');
    expect(toggle).toContain('aria-pressed');
    expect(toggle).toContain('<Blend size={15}');
    expect(toggle).not.toContain('bordered');
    expect(toggle).not.toContain('<span>');
    expect(code).not.toContain('>Interpolation</span>');
    expect(code).not.toContain('Interpolation count');
    expect(code).not.toContain('inBetweenCount');
  });

  it('renders the apply-spacing pill with the icon before the N input and a text Apply submit', () => {
    const code = source();
    const pillIndex = code.indexOf('physics-paint-pill--apply-spacing');
    expect(pillIndex).toBeGreaterThanOrEqual(0);
    const pillEnd = code.indexOf('</form>', pillIndex);
    const pill = code.slice(pillIndex, pillEnd === -1 ? code.length : pillEnd);
    const iconIndex = pill.indexOf('<AlignHorizontalSpaceAround');
    const inputIndex = pill.indexOf('aria-label="Empty frames between real keys"');
    expect(iconIndex).toBeGreaterThanOrEqual(0);
    expect(inputIndex).toBeGreaterThan(iconIndex);
    expect(pill).toContain('>Apply</button>');
    expect(code).not.toContain('<Check');
  });

  it('styles the pill islands with tonal variants, 8px gaps, and no legacy divider or bordered toggle', () => {
    const styles = css();
    const headerBlock = getCssRuleBlock(styles, '.physics-paint-workflow-header {');
    expect(headerBlock).toContain('display: flex');
    expect(headerBlock).toContain('flex-wrap: nowrap');
    expect(headerBlock).toContain('gap: 8px');
    const navigationBlock = getCssRuleBlock(styles, '.physics-paint-pill--navigation {');
    expect(navigationBlock).toContain('#34383c');
    expect(navigationBlock).toContain('#575e66');
    // 43.5-02 final polish: the relocated interpolation and Key Spacing pills
    // live inside the liquid-glass popover, where their tonal backgrounds read
    // as a double surface — the background is removed, the border stays.
    const interpolationBlock = getCssRuleBlock(styles, '.physics-paint-pill--interpolation {');
    expect(interpolationBlock).not.toContain('#323a43');
    expect(interpolationBlock).not.toContain('background:');
    expect(interpolationBlock).toContain('#596775');
    const playbackBlock = getCssRuleBlock(styles, '.physics-paint-pill--playback {');
    expect(playbackBlock).toContain('#34383c');
    expect(playbackBlock).toContain('#59616a');
    const applySpacingBlock = getCssRuleBlock(styles, '.physics-paint-pill--apply-spacing {');
    expect(applySpacingBlock).not.toBe('');
    expect(applySpacingBlock).not.toContain('background:');
    expect(getCssRuleBlock(styles, '.physics-paint-roto-playback-controls {')).not.toContain('border-left');
    const toggleBlock = getCssRuleBlock(styles, '.physics-paint-roto-interpolation-toggle {');
    expect(toggleBlock).not.toMatch(/border(-color|-left|-right|-top|-bottom)?:/);
    expect(toggleBlock).toContain('#b8c7ff');
    expect(styles).not.toContain('#2f7258');
    expect(styles).not.toContain('border-left: 1px solid rgba(145, 165, 189, 0.34)');
  });

  it('keeps the force-spacing and interpolation mutation-lock guards verbatim', () => {
    const code = source();
    expect(code).toContain('if (props.ready === false || props.mutationLocked || !forceSpacingAvailable) return;');
    expect(code.match(/if \(props\.mutationLocked \|\| props\.interpolationPending\) return;/g)).toHaveLength(1);
  });

  it('exposes a header Close affordance through a plain onClose prop with no Tauri import', () => {
    const code = source();
    expect(getWorkflowStripPropsInterface(code)).toContain('onClose?: () => void');
    expect(code).not.toContain('@tauri-apps');
    const stateActionsIndex = code.indexOf('physics-paint-state-actions');
    expect(stateActionsIndex).toBeGreaterThanOrEqual(0);
    const stateActionsStart = code.lastIndexOf('<div', stateActionsIndex);
    const stateActionsEnd = code.indexOf('</div>', stateActionsIndex) + '</div>'.length;
    const stateActions = code.slice(stateActionsStart, stateActionsEnd);
    const openingTag = code.slice(stateActionsStart, code.indexOf('>', stateActionsIndex) + 1);
    expect(openingTag).not.toContain('aria-hidden="true"');
    expect(stateActions).toContain('aria-label="Close"');
  });
});

describe('PhysicsPaintWorkflowStrip status capsule contract (36.15-05)', () => {
  it('renders the elastic status capsule between the navigation and interpolation pills with the Info glyph', () => {
    const code = source();
    const header = getHeaderBlock(code);
    const navigationIndex = header.indexOf('physics-paint-pill--navigation');
    const capsuleIndex = header.indexOf('<PhysicsPaintWorkflowLiveStatus');
    const interpolationIndex = header.indexOf('physics-paint-pill--interpolation');
    expect(navigationIndex).toBeGreaterThanOrEqual(0);
    expect(capsuleIndex).toBeGreaterThan(navigationIndex);
    expect(interpolationIndex).toBeGreaterThan(capsuleIndex);
    const capsule = code.slice(code.indexOf('function PhysicsPaintWorkflowLiveStatus'), code.indexOf('interface PhysicsPaintWorkflowStaticChromeProps'));
    expect(capsule).toContain('role="status"');
    expect(capsule).toContain('aria-live="polite"');
    expect(capsule).toContain('<Info size={16}');
    expect(capsule).toContain('physics-paint-status-capsule-text');
    expect(capsule).toContain('PhysicsPaintStyledTooltip');
    expect(capsule).not.toContain('title=');
    expect(header).not.toContain('physics-paint-header-capsule-slot');
    expect(code).toContain('getRotoStatusCapsuleViewModel');
  });

  it('removes the retired status stack, cell-states legend, and diagnostic lines outright', () => {
    const code = source();
    for (const obsolete of [
      'physics-paint-roto-status-stack',
      'physics-paint-roto-cell-legend',
      'physics-paint-roto-cell-swatch',
      'physics-paint-roto-key-status',
      'physics-paint-roto-interpolation-status',
      'physics-paint-roto-playback-status',
      'ROTO_CELL_LEGEND_ITEMS',
      'Completed real-key paint is cached automatically',
      'Cached reference',
      '{interpolationStatus}</p>',
    ]) {
      expect(code).not.toContain(obsolete);
    }
    // No replacement band: no toast rail, expandable diagnostics, or Log button.
    expect(code).not.toContain('aria-label="Log"');
    expect(code).not.toContain('aria-label="Open Log"');
  });

  it('routes per-cell state copy through the styled tooltip and drops the native cell title', () => {
    const code = source();
    const map = getRotoMapBlock(code);
    expect(map).toContain('getRotoCellStateTooltipCopy(');
    expect(map).toContain('RotoTimelineCellButton');
    // 47-01 UAT round 3: the strip's resize handle legitimately carries a
    // native `title=` (strip-level chrome), so the no-native-title guard is
    // scoped to the cell button usage itself, not the whole map slice.
    const cellButtonStart = map.indexOf('<RotoTimelineCellButton');
    const cellButtonEnd = map.indexOf('/>', cellButtonStart) + 2;
    const cellButton = map.slice(cellButtonStart, cellButtonEnd);
    expect(cellButton).not.toContain('title=');
    expect(map).not.toContain('dragTitle');
    // Drag machinery untouched: identity attributes and handlers stay.
    expect(map).toContain('handleRotoTimelineCellPointerDown');
    // Each cell owns one styled-tooltip controller via the child component.
    const cellComponentIndex = code.indexOf('function RotoTimelineCellButton');
    expect(cellComponentIndex).toBeGreaterThanOrEqual(0);
    const cellComponent = code.slice(cellComponentIndex, code.indexOf('export function PhysicsPaintWorkflowStrip'));
    expect(cellComponent).toContain('useStyledTooltip');
    expect(cellComponent).toContain('PhysicsPaintStyledTooltip');
    expect(cellComponent).not.toContain('title=');
    expect(cellComponent).toContain('data-roto-app-frame');
    expect(cellComponent).toContain('data-roto-kind');
    expect(cellComponent).toContain('data-roto-key-id');
    // The interpolation pill adopts the styled tooltip in place of its native title (Pitfall 4).
    const pillIndex = code.indexOf('physics-paint-pill--interpolation');
    expect(pillIndex).toBeGreaterThanOrEqual(0);
    const pillEnd = code.indexOf('<div class="physics-paint-state-actions"', pillIndex);
    const pill = code.slice(pillIndex, pillEnd === -1 ? code.length : pillEnd);
    expect(pill).not.toContain('title=');
    expect(pill).toContain('PhysicsPaintStyledTooltip');
    expect(pill).toContain('{props.interpolationStatus}');
  });

  it('styles the capsule as the sole flex:1 truncating region and deletes the retired stack/legend CSS', () => {
    const styles = css();
    const capsuleBlock = getCssRuleBlock(styles, '.physics-paint-status-capsule {');
    expect(capsuleBlock).not.toBe('');
    expect(capsuleBlock).toContain('flex: 1');
    expect(capsuleBlock).toContain('min-width: 0');
    expect(capsuleBlock.toLowerCase()).toContain('#2d3741');
    expect(capsuleBlock.toLowerCase()).toContain('#51606d');
    expect(capsuleBlock).toContain('11px');
    expect(capsuleBlock).toContain('700');
    expect(capsuleBlock).toContain('border-radius: 999px');
    const capsuleTextBlock = getCssRuleBlock(styles, '.physics-paint-status-capsule-text {');
    expect(capsuleTextBlock).toContain('text-overflow: ellipsis');
    expect(capsuleTextBlock).toContain('overflow: hidden');
    expect(capsuleTextBlock).toContain('white-space: nowrap');
    expect(capsuleTextBlock.toLowerCase()).toContain('#dde7f0');
    expect(getCssRuleBlock(styles, '.physics-paint-status-capsule .lucide {').toLowerCase()).toContain('#f8c96b');
    expect(getCssRuleBlock(styles, '.physics-paint-status-capsule-error .lucide {').toLowerCase()).toContain('#ff6b6b');
    for (const retired of [
      '.physics-paint-roto-status-stack',
      '.physics-paint-roto-cell-legend',
      '.physics-paint-roto-cell-swatch',
      '.physics-paint-roto-status,',
      '.physics-paint-roto-key-status',
      '.physics-paint-roto-interpolation-status',
      '.physics-paint-roto-playback-status',
      '.physics-paint-header-capsule-slot',
    ]) {
      expect(styles).not.toContain(retired);
    }
  });
});

describe('PhysicsPaintWorkflowStrip strip geometry pitch contract (36.15-06 task 1)', () => {
  it('requires the canonical physical projection and binds all scroll content to its extent', () => {
    const code = source();
    const props = getWorkflowStripPropsInterface(code);
    expect(props).toContain('rotoPhysicalCells: readonly RotoPhysicalTimelineCell[];');
    expect(code).toContain('ROTO_CELL_WIDTH_PX = 18');
    expect(code).toContain('const currentPhysicalCells = props.rotoPhysicalCells;');
    expect(code).toContain('buildRotoTimelineStructuralIndex(currentPhysicalCells, cachedRotoFrames, acceptedGroupDocument)');
    expect(code).toContain('if (!cell || cell.appFrame !== appFrame) {');
    expect(code).toContain('const rotoLaneWidthPx = frameCells.length * ROTO_CELL_WIDTH_PX;');
    expect(code).not.toContain('buildPhysicsPaintRotoFrameCells');
    expect(code).not.toContain('VIRTUAL_TIMELINE_FRAME_COUNT');
    expect(code).not.toContain('fallbackFrameCells');
    const rulerIndex = code.indexOf('class="physics-paint-ruler"');
    expect(rulerIndex).toBeGreaterThanOrEqual(0);
    const rulerTagEnd = code.indexOf('aria-hidden="true"', rulerIndex);
    const rulerTag = code.slice(rulerIndex, rulerTagEnd === -1 ? code.length : rulerTagEnd);
    expect(rulerTag).toContain('rotoLaneWidthPx');
    expect(code).toContain('style={{ gridTemplateColumns: `repeat(${frameCells.length}, ${ROTO_CELL_WIDTH_PX}px)` }}');
  });

  it('locks the dynamically sized cells grid to 18px abutting columns with zero gap', () => {
    const styles = css();
    const cells = getCssRuleBlock(styles, '.physics-paint-roto-cells {');
    expect(cells).not.toContain('grid-template-columns');
    expect(cells).toContain('gap: 0');
    expect(source()).toContain('repeat(${frameCells.length}, ${ROTO_CELL_WIDTH_PX}px)');
  });

  it('keeps extent out of CSS while preserving fixed-pitch 54px ruler ticks', () => {
    const styles = css();
    expect(getCssRuleBlock(styles, '.physics-paint-ruler {')).not.toContain('2160px');
    const lane = getCssRuleBlock(styles, '.physics-paint-lane {');
    expect(lane).not.toContain('grid-template-columns');
    expect(lane).not.toContain('min-width: 2160px');
    const tick = getCssRuleBlock(styles, '.physics-paint-ruler-tick {');
    expect(tick).toContain('54px');
    expect(tick).not.toContain('flex: 1 1 0');
  });

  it('restyles the timeline scrollbar as a 14px band', () => {
    const scrollbar = getCssRuleBlock(css(), '.physics-paint-timeline-scrollbar {');
    expect(scrollbar).toContain('height: 14px');
  });

  it('keeps the drag machinery identifiers intact (guardrail)', () => {
    const code = source();
    for (const identifier of ['data-roto-app-frame', 'data-roto-kind', 'data-roto-key-id', 'classifyRotoDragTarget', 'elementFromPoint', 'setPointerCapture']) {
      expect(code).toContain(identifier);
    }
  });
});

function getMediaQueryBlock(styles: string, query: string): string {
  const start = styles.indexOf(query);
  if (start === -1) return '';
  let depth = 0;
  let end = start;
  for (let i = start; i < styles.length; i += 1) {
    if (styles[i] === '{') depth += 1;
    if (styles[i] === '}') {
      depth -= 1;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  return styles.slice(start, end);
}

describe('PhysicsPaintWorkflowStrip dynamic band stack contract (36.15-06 task 2 / 47-01 UAT round 3)', () => {
  it('makes the strip shell and studio grid third track dynamic (auto) with no legacy fixed-height literals', () => {
    const styles = css();
    // 47-01 UAT round 3: the strip height is DYNAMIC — set inline by the
    // component (default = exactly enough for every track row + the Bg row,
    // capped at 270px; the top-edge drag handle resizes within [1 row, full
    // content height]). The fixed 264px band is gone; the studio grid third
    // track is `auto` so the canvas row absorbs the difference.
    expect(getCssRuleBlock(styles, '.physics-paint-workflow-strip {')).toContain('min-height: 0');
    expect(getCssRuleBlock(styles, '.physics-paint-workflow-strip {')).toContain('position: relative');
    expect(getCssRuleBlock(styles, '.physics-paint-studio {')).toContain('grid-template-rows: minmax(58px, auto) minmax(0, 1fr) auto');
    expect(styles).not.toContain('height: 256px');
    expect(styles).not.toContain('height: 260px');
    expect(styles).not.toContain('height: 264px');
  });

  it('declares the dynamic 46/1/28/flex/34/14 band geometry with zeroed strip padding and gap', () => {
    const styles = css();
    const strip = getCssRuleBlock(styles, '.physics-paint-workflow-strip {');
    expect(strip).toContain('gap: 0');
    expect(strip).toContain('padding: 0 12px');
    expect(getCssRuleBlock(styles, '.physics-paint-workflow-header {')).toContain('height: 46px');
    const timeline = getCssRuleBlock(styles, '.physics-paint-timeline {');
    expect(timeline).toContain('border-top: 1px');
    expect(timeline).toContain('min-height: 0');
    const region = getCssRuleBlock(styles, '.physics-paint-rows-region {');
    expect(region).toContain('flex: 1 1 auto');
    expect(region).toContain('min-height: 0');
    const lane = getCssRuleBlock(styles, '.physics-paint-lane {');
    expect(lane).toContain('height: 30px');
    expect(lane).not.toContain('min-height');
    expect(lane).not.toContain('padding: 8px 0');
    const actionRow = getCssRuleBlock(styles, '.physics-paint-roto-action-row {');
    expect(actionRow).toContain('height: 34px');
    expect(actionRow).toContain('display: flex');
    expect(actionRow).toContain('min-width: 0');
    expect(actionRow).toContain('overflow-x: auto');
    expect(actionRow).not.toContain('min-width: 2160px');
    expect(getCssRuleBlock(styles, '.physics-paint-timeline-scrollbar {')).toContain('height: 14px');
    // Bigger bottom action-row icons (user feedback): 26px-high buttons.
    expect(getCssRuleBlock(styles, '.physics-paint-roto-key-icon-button {')).toContain('height: 26px');
  });

  it('keeps the action row fixed outside the ruler-and-lane scroll container', () => {
    const code = source();
    const scrollIndex = code.indexOf('class="physics-paint-timeline-scroll"');
    const scrollEnd = getMatchingDivEnd(code, code.lastIndexOf('<div', scrollIndex));
    // 47-01 mockup redesign: the active lane source now lives in the reusable
    // `renderActiveLane()` helper, mounted inside the rows-region here — so the
    // mount point, not the lane class string, is the scroll-containment anchor.
    const laneMountIndex = code.indexOf('renderActiveLane()', scrollIndex);
    const actionRowIndex = code.indexOf('class="physics-paint-roto-action-row"', laneMountIndex);
    const utilitiesIndex = code.indexOf('physics-paint-roto-key-utilities', actionRowIndex);
    const scrollbarIndex = code.indexOf('class="physics-paint-timeline-scrollbar"', utilitiesIndex);
    for (const index of [scrollIndex, scrollEnd, laneMountIndex, actionRowIndex, utilitiesIndex, scrollbarIndex]) {
      expect(index).toBeGreaterThanOrEqual(0);
    }
    expect(laneMountIndex).toBeLessThan(scrollEnd);
    expect(actionRowIndex).toBeGreaterThan(scrollEnd);
    expect(utilitiesIndex).toBeGreaterThan(actionRowIndex);
    expect(scrollbarIndex).toBeGreaterThan(utilitiesIndex);
    expect(code.slice(scrollIndex, scrollEnd)).not.toContain('physics-paint-roto-action-row');
    expect(code.slice(scrollIndex, scrollEnd)).toContain('renderActiveLane()');
  });

  it('makes the timeline scroll container focusable so Cmd+Z/Cmd+Shift+Z routing survives rail commits (43.4 defect 7)', () => {
    const code = source();
    const scrollIndex = code.indexOf('class="physics-paint-timeline-scroll"');
    expect(scrollIndex).toBeGreaterThanOrEqual(0);
    const openingTagStart = code.lastIndexOf('<div', scrollIndex);
    const openingTagEnd = code.indexOf('>', openingTagStart);
    const openingTag = code.slice(openingTagStart, openingTagEnd + 1);
    // After Delete Key Rail the focused rail button is removed and focus would
    // fall to body, where keydown never bubbles through the Studio section's
    // undo/redo handler. tabIndex={-1} makes the Defect 6 restoration succeed
    // and keeps focus on a Studio element for one shared routing path.
    expect(openingTag).toContain('tabIndex={-1}');
  });

  it('removes the 860px responsive collapse and declares D-18 horizontal scroll on the strip shell', () => {
    const styles = css();
    const query = getMediaQueryBlock(styles, '@media (max-width: 860px)');
    expect(query).not.toBe('');
    expect(query).not.toContain('.physics-paint-workflow-strip');
    expect(query).not.toContain('.physics-paint-right-panel');
    expect(query).not.toContain('.physics-paint-studio');
    const strip = getCssRuleBlock(styles, '.physics-paint-workflow-strip {');
    expect(strip).toContain('overflow-x: auto');
    expect(strip).toContain('overflow-y: hidden');
  });

  it('keeps the drag machinery identifiers intact after the restructure (guardrail)', () => {
    const code = source();
    for (const identifier of ['data-roto-app-frame', 'data-roto-kind', 'data-roto-key-id', 'classifyRotoDragTarget', 'elementFromPoint', 'setPointerCapture']) {
      expect(code).toContain(identifier);
    }
  });
});

describe('PhysicsPaintWorkflowStrip top bar regrouping contract (36.15-08, UAT Gap A)', () => {
  it('orders the top bar as navigation, playback, capsule, interpolation, Close with no Tools menu or header key actions', () => {
    const header = getHeaderBlock(source());
    const navigationIndex = header.indexOf('physics-paint-pill--navigation');
    const playbackIndex = header.indexOf('physics-paint-pill--playback');
    const capsuleIndex = header.indexOf('<PhysicsPaintWorkflowLiveStatus');
    const interpolationIndex = header.indexOf('physics-paint-pill--interpolation');
    const closeIndex = header.indexOf('aria-label="Close"');
    for (const index of [navigationIndex, playbackIndex, capsuleIndex, interpolationIndex, closeIndex]) {
      expect(index).toBeGreaterThanOrEqual(0);
    }
    expect(playbackIndex).toBeGreaterThan(navigationIndex);
    expect(capsuleIndex).toBeGreaterThan(playbackIndex);
    expect(interpolationIndex).toBeGreaterThan(capsuleIndex);
    expect(closeIndex).toBeGreaterThan(interpolationIndex);
    // 43.5-02: the ToolCase button (dynamic aria-label carrying live
    // interpolation state) and the relocated Key Spacing form now live in the
    // header block inside the toolbox popover, so the apply-spacing pill is
    // expected present there — no legacy Tools dropdown machinery remains.
    expect(header).toContain('physics-paint-pill--apply-spacing');
    expect(header).toContain('physics-paint-toolbox-section-heading');
    for (const removed of ['aria-label="Tools"', 'physics-paint-tools-menu', 'physics-paint-tools-trigger', 'physics-paint-tools-dropdown', 'aria-label="Add key"', 'aria-label="Duplicate key"', 'physics-paint-mode-label']) {
      expect(header).not.toContain(removed);
    }
  });

  it('removes the Tools dropdown machinery and its CSS outright', () => {
    const code = source();
    // The obsolete top-bar Tools dropdown is gone. (The 47-01 track-header
    // more-button state legitimately uses toolsOpen/setToolsOpenTrackId —
    // those words are the NEW track tools, not the removed dropdown.)
    for (const removed of ['toolsMenuRef', 'aria-haspopup="menu"', 'physics-paint-tools-menu', 'physics-paint-tools-trigger', 'physics-paint-tools-dropdown', 'aria-label="Tools"']) {
      expect(code).not.toContain(removed);
    }
    const styles = css();
    for (const removed of ['.physics-paint-tools-menu', '.physics-paint-tools-trigger', '.physics-paint-tools-dropdown']) {
      expect(styles).not.toContain(removed);
    }
  });

  it('renders the interpolation pill as a dropdown offering Frame duplicate and Frame blending', () => {
    const code = source();
    expect(code).toContain('aria-label="Interpolation mode"');
    expect(code).toContain('<option value="duplicate">Frame duplicate</option>');
    // Renamed 'Frame blend' → 'Frame blending' (36.15-09, UAT Gap E-4).
    expect(code).toContain('<option value="blend">Frame blending</option>');
    expect(code).not.toContain('<option value="blend">Frame blend</option>');
    expect(code).not.toContain('<option value="duplicate">Duplicate</option>');
    expect(code).not.toContain('<option value="blend">Blend</option>');
  });

  it('orders the bottom action row as layer, Key chip, Add key, Insert, Duplicate, Copy, Paste, Delete (Key Spacing relocated to the popover)', () => {
    const row = getActionRowBlock(source());
    const layerIndex = row.indexOf('physics-paint-roto-key-layer');
    const chipIndex = row.indexOf('physics-paint-roto-key-context');
    const addIndex = row.indexOf('aria-label="Add key"');
    const insertIndex = row.indexOf(getActionAriaLabelToken('Insert key before'));
    const duplicateIndex = row.indexOf('aria-label="Duplicate key"');
    const copyIndex = row.indexOf('aria-label="Copy key"');
    const pasteIndex = row.indexOf('aria-label="Paste key"');
    const deleteIndex = row.indexOf(getActionAriaLabelToken('Delete Frame'));
    for (const index of [layerIndex, chipIndex, addIndex, insertIndex, duplicateIndex, copyIndex, pasteIndex, deleteIndex]) {
      expect(index).toBeGreaterThanOrEqual(0);
    }
    expect(chipIndex).toBeGreaterThan(layerIndex);
    expect(addIndex).toBeGreaterThan(chipIndex);
    expect(insertIndex).toBeGreaterThan(addIndex);
    expect(duplicateIndex).toBeGreaterThan(insertIndex);
    expect(copyIndex).toBeGreaterThan(duplicateIndex);
    expect(pasteIndex).toBeGreaterThan(copyIndex);
    expect(deleteIndex).toBeGreaterThan(pasteIndex);
    // 43.5-02 Task 2: the Set Key Space form moved into the toolbox popover,
    // so it no longer terminates the bottom action row.
    expect(row).not.toContain('physics-paint-pill--apply-spacing');
    expect(getHeaderBlock(source())).toContain('physics-paint-pill--apply-spacing');
  });

  it('guards the relocated Add key and Duplicate actions with the empty-key/duplicate ports', () => {
    const code = source();
    expect(getWorkflowStripPropsInterface(code)).toContain('onAddRotoKey?: () => void');
    expect(code).toContain('canAddEmptyKey');
    expect(code).toContain('addEmptyKeyDisabledReason');
    expect(code).toContain('roto-key-action-reason-add');
    expect(code).toContain('roto-key-action-reason-duplicate');
  });

  it('converts the relocated Set Key Space form to the guarded pattern with a styled tooltip and no native disabled/title', () => {
    const header = getHeaderBlock(source());
    const spacingIndex = header.indexOf('physics-paint-pill--apply-spacing');
    expect(spacingIndex).toBeGreaterThanOrEqual(0);
    const formEnd = header.indexOf('</form>', spacingIndex);
    const form = header.slice(spacingIndex, formEnd === -1 ? header.length : formEnd);
    expect(form.replace(/aria-disabled/g, '')).not.toContain('disabled=');
    expect(form).not.toContain('title=');
    expect(form).toContain('aria-disabled={!props.canApplyForceSpacing');
    expect(form).toContain('aria-label="Empty frames between real keys"');
    expect(form).toContain('aria-label="Apply force spacing"');
    expect(form).toContain('>Apply</button>');
    expect(header).toContain("buildGuardedActionTooltipCopy('Set empty physical frames between real Roto keys'");
    expect(header).toContain('PhysicsPaintStyledTooltip');
    // The submit handler keeps its verbatim mutation-lock guard.
    expect(source()).toContain('if (props.ready === false || props.mutationLocked || !forceSpacingAvailable) return;');
  });

  it('renders one Key Spacing scope line under the heading only when a rail set is active (43.6-05 M5, D-26)', () => {
    const code = source();
    const header = getHeaderBlock(code);
    const headingIndex = header.indexOf('<div class="physics-paint-toolbox-section-heading">Key Spacing</div>');
    expect(headingIndex).toBeGreaterThanOrEqual(0);
    // The scope line sits directly under the Key Spacing heading and above the
    // relocated controls — one Body-role line, no panel or divider.
    const scopeLineIndex = header.indexOf('physics-paint-toolbox-scope-line', headingIndex);
    expect(scopeLineIndex).toBeGreaterThan(headingIndex);
    const controlsIndex = header.indexOf('physics-paint-pill--apply-spacing', headingIndex);
    expect(controlsIndex).toBeGreaterThan(scopeLineIndex);
    // The line is the D-27 set copy verbatim — the same string the capsule
    // shows, fed through the static-chrome prop (one mapper authority).
    expect(code).toContain('forceSpacingScopeLine={railSetCopy}');
    expect(code).toContain('props.forceSpacingScopeLine ? (');
    // The static chrome declares the nullable scope-line port; with no set the
    // line is absent — no placeholder, no reserved space.
    expect(getStaticChromePropsInterface(code)).toContain('forceSpacingScopeLine: string | null');
    const styles = css();
    const scopeLineRule = getCssRuleBlock(styles, '.physics-paint-toolbox-scope-line {');
    expect(scopeLineRule).toContain('color: #9ca3af');
    expect(scopeLineRule).toContain('font-variant-numeric: tabular-nums');
  });
});

describe('PhysicsPaintWorkflowStrip clipping guard contract (36.15-08, UAT Gap B)', () => {
  it('maps all header tooltips from the top region to viewport-computed below placement', () => {
    const header = getHeaderBlock(source());
    const headerTopRegionCount = (header.match(/region="top"/g) ?? []).length;
    const allTopRegionCount = (source().match(/region="top"/g) ?? []).length;
    // Interpolation and Close declare the header region in this block; the
    // extracted status-capsule child declares the same region at its owner.
    expect(headerTopRegionCount).toBe(2);
    expect(allTopRegionCount).toBe(3);
    const styles = css();
    const surface = getCssRuleBlock(styles, '.physics-paint-styled-tooltip {');
    const belowNotch = getCssRuleBlock(styles, '.physics-paint-styled-tooltip--below .physics-paint-styled-tooltip-notch {');
    expect(surface).toContain('position: fixed');
    expect(belowNotch).toContain('border-bottom: 6px solid var(--color-tooltip-bg)');
  });

  it('keeps the interpolation mode select native so the open dropdown renders above studio chrome', () => {
    const code = source();
    const selectIndex = code.indexOf('aria-label="Interpolation mode"');
    expect(selectIndex).toBeGreaterThanOrEqual(0);
    const selectStart = code.lastIndexOf('<select', selectIndex);
    expect(selectStart).toBeGreaterThanOrEqual(0);
    // No custom listbox/menu replaces the native dropdown.
    expect(code).not.toContain('role="listbox"');
    expect(code).not.toContain('role="menu"');
  });
});

describe('PhysicsPaintWorkflowStrip Gap E cosmetic contract (36.15-09, UAT Gap E)', () => {
  it('renames the Set Key Space label to Key spacing in the relocated popover form', () => {
    const header = getHeaderBlock(source());
    expect(header).toContain('<span class="physics-paint-roto-key-icon-label">Key spacing</span>');
    expect(header).not.toContain('<span class="physics-paint-roto-key-icon-label">Space</span>');
  });

  it('removes the doubled ring artifact from the Apply submit by dropping its 999px pill radius', () => {
    const styles = css();
    const apply = getCssRuleBlock(styles, '.physics-paint-roto-force-spacing-apply {');
    expect(apply).not.toBe('');
    // The 999px pill cap inside the 999px form pill produced a second
    // concentric ring at the button's right edge; the submit is a 4px
    // rounded rect like the adjacent number input.
    expect(apply).not.toContain('border-radius: 999px');
    expect(apply).toContain('border-radius: 4px');
  });

  it('paints the selected key cell as an in-frame orange border with no outline or lift', () => {
    const styles = css();
    const current = getCssRuleBlock(styles, '.physics-paint-roto-cell.current {');
    expect(current).not.toBe('');
    // 47 close-out UAT round 7/9: the selection is the cell's own orange
    // border (green fill stays for keys, blue + '-' dash for interpolated
    // frames) — no outer outline box, and no z-index lift (the lift existed
    // to clear the removed outline's right edge; with a plain border it only
    // doubled the abutting neighbors' borders).
    expect(current).toContain('background: #f5a623');
    expect(current).not.toContain('outline:');
    expect(current).not.toMatch(/z-index:\s*[1-9]\d*;/);
  });
});

describe('PhysicsPaintWorkflowStrip Gap F grouping and casing contract (36.15-10, UAT Gap F)', () => {
  it('renders two visually separated bottom-row groups in order: identity, tools (Key Spacing relocated to the popover)', () => {
    const row = getActionRowBlock(source());
    const identityIndex = row.indexOf('physics-paint-roto-key-identity');
    const utilitiesIndex = row.indexOf('physics-paint-roto-key-utilities');
    for (const index of [identityIndex, utilitiesIndex]) {
      expect(index).toBeGreaterThanOrEqual(0);
    }
    expect(utilitiesIndex).toBeGreaterThan(identityIndex);
    // The identity group is its OWN group: it closes before the tools group
    // opens, so the layer name + Key chip are not fused with the tool icons.
    const identityCloseIndex = row.indexOf('</div>', identityIndex);
    expect(identityCloseIndex).toBeGreaterThanOrEqual(0);
    expect(identityCloseIndex).toBeLessThan(utilitiesIndex);
    // 43.5-02 Task 2: the Key Spacing form moved into the toolbox popover,
    // so the bottom row holds exactly the identity and tools groups; the
    // form lives in the header block behind the ToolCase button.
    expect(row).not.toContain('physics-paint-pill--apply-spacing');
    expect(getHeaderBlock(source())).toContain('physics-paint-pill--apply-spacing');
    // The identity group carries the layer name and the Key chip.
    const identity = row.slice(identityIndex, identityCloseIndex);
    expect(identity).toContain('physics-paint-roto-key-layer');
    expect(identity).toContain('physics-paint-roto-key-context');
  });

  it('separates the three bottom-row groups with top-bar-style spacing and gives the identity group its own pill', () => {
    const styles = css();
    // Same visual language as the top bar pill islands (8px gaps, Plan 04).
    const actionRow = getCssRuleBlock(styles, '.physics-paint-roto-action-row {');
    expect(actionRow).toContain('gap: 8px');
    const identity = getCssRuleBlock(styles, '.physics-paint-roto-key-identity {');
    expect(identity).not.toBe('');
    expect(identity).toContain('border:');
    expect(identity).toContain('background:');
    // The 34px band stays intact; the strip shell is dynamic (47-01 UAT round 3).
    expect(actionRow).toContain('height: 34px');
    expect(getCssRuleBlock(styles, '.physics-paint-workflow-strip {')).toContain('min-height: 0');
  });

  it('renders bottom-row tool labels lowercase by opting the icon buttons out of the global uppercase button rule', () => {
    const styles = css();
    // The global `button { text-transform: uppercase }` rule (studio chrome)
    // rendered the short labels as CAPS; the bottom-row icon buttons opt out.
    const button = getCssRuleBlock(styles, '.physics-paint-roto-key-icon-button {');
    expect(button).toContain('text-transform: none');
    // Source labels stay lowercase single words. Delete is icon-only (43.5-05
    // smoke UX5) so it carries no visible label here.
    const row = getActionRowBlock(source());
    for (const label of ['Key', 'Duplicate', 'Insert', 'Copy', 'Paste']) {
      expect(row).toContain(`<span class="physics-paint-roto-key-icon-label">${label}</span>`);
    }
  });

  it("renders the Key spacing submit as 'Apply' (not 'APPLY')", () => {
    const header = getHeaderBlock(source());
    expect(header).toContain('>Apply</button>');
    expect(header).not.toContain('>APPLY</button>');
    const styles = css();
    const apply = getCssRuleBlock(styles, '.physics-paint-roto-force-spacing-apply {');
    expect(apply).toContain('text-transform: none');
  });
});

describe('PhysicsPaintWorkflowStrip Gap G bottom-row polish contract (36.15-11, UAT Gap G-2/G-3)', () => {
  it('renders the tools group on the bare band with no background block or pill border', () => {
    const styles = css();
    const utilities = getCssRuleBlock(styles, '.physics-paint-roto-key-utilities {');
    expect(utilities).not.toBe('');
    // UAT Gap G-2: the background block/pill behind the tools group is gone.
    expect(utilities).toContain('background: transparent');
    expect(utilities).not.toMatch(/border:\s*1px/);
    expect(utilities).not.toContain('#20262d');
    // The identity group keeps its own pill — only the tools group goes bare.
    const identity = getCssRuleBlock(styles, '.physics-paint-roto-key-identity {');
    expect(identity).toContain('border:');
    expect(identity).toContain('background:');
  });

  it('vertically centers all three bottom-row groups within the 34px band', () => {
    const styles = css();
    const actionRow = getCssRuleBlock(styles, '.physics-paint-roto-action-row {');
    expect(actionRow).toContain('align-items: center');
    expect(actionRow).toContain('height: 34px');
    for (const selector of ['.physics-paint-roto-key-identity {', '.physics-paint-roto-key-utilities {']) {
      const group = getCssRuleBlock(styles, selector);
      expect(group).not.toBe('');
      expect(group).toContain('align-items: center');
    }
    // The bare tools group fits the band exactly: no taller than the 26px
    // icon buttons (the retired pill's padding + border pushed it to 30px,
    // which is what threw the row off-center, UAT Gap G-3).
    expect(getCssRuleBlock(styles, '.physics-paint-roto-key-utilities {')).toContain('height: 26px');
    // The 34px band stays intact; the strip shell is dynamic (47-01 UAT round 3).
    expect(getCssRuleBlock(styles, '.physics-paint-workflow-strip {')).toContain('min-height: 0');
  });
});

describe('PhysicsPaintWorkflowStrip Gap H band and lane contract (36.15-12, UAT Gap H-5/H-6)', () => {
  it('offsets the timeline lane from the left edge so the selected frame-0 cell renders its full orange ring', () => {
    const styles = css();
    // UAT Gap H-5: the .current outline (2px) + offset (1px) + shadow (1px)
    // extends 4px past the cell's left edge and was clipped by the scroll
    // container at frame 0; a 4px left padding on the shared scroll container
    // shifts ruler, lane, and action row together so the 18px pitch and the
    // ruler-to-cell alignment stay consistent.
    const scroll = getCssRuleBlock(styles, '.physics-paint-timeline-scroll {');
    expect(scroll).toContain('padding-left: 4px');
    // The lane geometry itself remains projection-derived with 18px abutting
    // cells and 54px ticks; CSS owns no fixed extent fallback.
    expect(getCssRuleBlock(styles, '.physics-paint-roto-cells {')).not.toContain('grid-template-columns');
    const lane = getCssRuleBlock(styles, '.physics-paint-lane {');
    expect(lane).not.toContain('grid-template-columns');
    expect(lane).not.toContain('padding-left');
    expect(getCssRuleBlock(styles, '.physics-paint-ruler {')).not.toContain('padding-left');
    expect(getCssRuleBlock(styles, '.physics-paint-ruler-tick {')).toContain('54px');
  });

  it('locks the 34px action-row band with the dynamic strip shell and every other band unchanged', () => {
    const styles = css();
    // 47-01 UAT round 3: the fixed 264px band sum is gone — the strip shell
    // height is DYNAMIC (inline, default = exactly enough for every track row
    // + the Bg row, capped at 270px; drag handle resizes within [1 row, full
    // content height]). The ruler, action row and scrollbar keep their Plan 06
    // heights; the rows-region flex-fills the remaining height and scrolls.
    expect(getCssRuleBlock(styles, '.physics-paint-workflow-header {')).toContain('height: 46px');
    expect(getCssRuleBlock(styles, '.physics-paint-ruler {')).toContain('height: 28px');
    expect(getCssRuleBlock(styles, '.physics-paint-rows-region {')).toContain('flex: 1 1 auto');
    expect(getCssRuleBlock(styles, '.physics-paint-rows-region {')).toContain('min-height: 0');
    expect(getCssRuleBlock(styles, '.physics-paint-lane {')).toContain('height: 30px');
    expect(getCssRuleBlock(styles, '.physics-paint-roto-action-row {')).toContain('height: 34px');
    expect(getCssRuleBlock(styles, '.physics-paint-timeline-scrollbar {')).toContain('height: 14px');
    expect(getCssRuleBlock(styles, '.physics-paint-workflow-strip {')).toContain('min-height: 0');
    expect(getCssRuleBlock(styles, '.physics-paint-studio {')).toContain('grid-template-rows: minmax(58px, auto) minmax(0, 1fr) auto');
    // No other historical literal may survive: the retired 155px and 161px totals are gone.
    expect(styles).not.toContain('height: 155px');
    expect(styles).not.toContain('height: 161px');
  });

  it('vertically centers the three 26px groups with visible top and bottom padding in the 34px band', () => {
    const styles = css();
    const actionRow = getCssRuleBlock(styles, '.physics-paint-roto-action-row {');
    expect(actionRow).toContain('display: flex');
    expect(actionRow).toContain('align-items: center');
    // All three groups stay 26px so the 34px band keeps clear padding around
    // each centered group (Gap I-1 then weights that clearance to the bottom
    // via the action row's 6px padding-bottom — see the Gap I contract).
    expect(getCssRuleBlock(styles, '.physics-paint-roto-key-identity {')).toContain('height: 26px');
    expect(getCssRuleBlock(styles, '.physics-paint-roto-key-utilities {')).toContain('height: 26px');
    expect(getCssRuleBlock(styles, '.physics-paint-roto-action-row .physics-paint-pill {')).toContain('height: 26px');
  });
});

describe('PhysicsPaintWorkflowStrip Gap I action-row padding contract (36.15-13, UAT Gap I-1)', () => {
  it('adds 6px bottom padding to the action row without changing the 34px band or the dynamic strip shell', () => {
    const styles = css();
    const actionRow = getCssRuleBlock(styles, '.physics-paint-roto-action-row {');
    // UAT Gap I-1 (user's final polish round): padding-bottom: 6px on the
    // action-row div.
    expect(actionRow).toContain('padding-bottom: 6px');
    // The stylesheet sets box-sizing: border-box globally, so the padding
    // shrinks the content box instead of growing the band: the 34px band stays
    // intact and the strip shell stays dynamic (47-01 UAT round 3).
    expect(actionRow).toContain('height: 34px');
    expect(getCssRuleBlock(styles, '.physics-paint-workflow-strip {')).toContain('min-height: 0');
    expect(getCssRuleBlock(styles, '.physics-paint-studio {')).toContain('grid-template-rows: minmax(58px, auto) minmax(0, 1fr) auto');
    expect(styles).not.toContain('height: 155px');
  });
});

describe('PhysicsPaintWorkflowStrip loop resolution wiring (43-02, Pitfall 7)', () => {
  it('declares the optional loop resolution context prop', () => {
    const code = source();
    expect(getWorkflowStripPropsInterface(code)).toContain('rotoLoopResolutionContext?:');
  });

  it('derives linked repetition cells and exact source-position spacing proxies for the visible frame window only', () => {
    const code = source();
    // Both lazy projections stay keyed to frameCells — never a full-range scan
    // of any loop's effective range.
    expect(code).toContain('resolveRotoVisibleFrameResolutions(');
    expect(code).toContain('resolveRotoVisibleSpacingProxies(');
    expect(code).toContain('buildRotoSpacingProxySourceIndex(loopResolutionContext, frameCells.length)');
    for (const helperName of ['resolveRotoVisibleFrameResolutions(', 'resolveRotoVisibleSpacingProxies(']) {
      const helperCall = code.indexOf(helperName);
      const callBlock = code.slice(helperCall, code.indexOf(')', helperCall) + 200);
      expect(callBlock).toContain('frameCells');
    }
  });

  it('gates drag eligibility and tooltips through the exhaustiveness-checked resolution mappers', () => {
    const code = source();
    const mapBlock = getRotoMapBlock(code);
    // Drag stays real-key-only: virtual occurrences never start a drag even
    // when a loop resolution context is present (D-11/D-23).
    expect(mapBlock).toContain('getRotoFrameKeyInteraction(');
    expect(mapBlock).toContain('dragEligible');
    // Linked cells keep their existing fill while product tooltip/aria copy
    // consumes the typed resolution and compact source-count index.
    expect(mapBlock).toContain('getRotoResolutionCellTooltipKind(');
    expect(mapBlock).toContain('getRotoResolutionCellTooltipCopy(');
    expect(mapBlock).toContain("frameResolution?.kind === 'linked-generated'");
    expect(mapBlock).toContain("frameResolution?.kind === 'linked-gap'");
    expect(mapBlock).toContain('const cellBaseAriaLabel = isSpacingProxySelected');
    expect(mapBlock).toContain('const cellAriaLabel = cellPresentation.ariaLabel');
  });

  it('issues exactly one resolution query per visible frame for a huge-repeat loop (D-32)', () => {
    const context = derivePhysicPaintRotoLoopRanges({
      identities: [
        { keyId: 'A', appFrame: 10 },
        { keyId: 'B', appFrame: 11 },
        { keyId: 'C', appFrame: 12 },
        { keyId: 'D', appFrame: 13 },
        { keyId: 'E', appFrame: 14 },
      ],
      loopClips: [{
        loopId: 'L1',
        placementStart: 10,
        sourceKeyIds: ['A', 'B', 'C', 'D', 'E'],
        repeat: 100000,
        mode: 'static',
      }],
      capacity: 600,
      interpolationEnabled: false,
    });
    // A bounded 120-frame query sample inside the capacity-truncated repeat
    // issues exactly one lazy query per requested physical frame (43.4 defect 1).
    const visibleWindow = Array.from({ length: 120 }, (_, index) => 480 + index);
    const query = vi.fn(resolvePhysicPaintRotoLoopFrame);
    const resolutions = resolveRotoVisibleFrameResolutions(context, visibleWindow, query);

    expect(query).toHaveBeenCalledTimes(visibleWindow.length);
    expect(resolutions.size).toBe(visibleWindow.length);
    expect(resolutions.get(480)).toMatchObject({
      kind: 'linked',
      loopId: 'L1',
      sourceIndex: (480 - 10) % 5,
      repeatInstance: Math.floor((480 - 10) / 5),
    });
  });
});


describe('PhysicsPaintWorkflowStrip corrected Loop Clip ownership (43-11)', () => {
  it('keeps only the integrated rail inside the unchanged physical row', () => {
    const code = source();
    const rulerIndex = code.indexOf('class="physics-paint-ruler"');
    // 47-01 mockup redesign: the lane source lives in the reusable
    // `renderActiveLane()` helper (rendered after the ruler in the DOM), so the
    // rail/cells containment assertions anchor to that helper instead of a
    // global source offset.
    const laneFnIndex = code.indexOf('const renderActiveLane');
    const physicalLaneIndex = code.indexOf('class={`physics-paint-lane', laneFnIndex);
    const loopRailIndex = code.indexOf('<PhysicsPaintLoopClipRail', physicalLaneIndex);
    const cellsIndex = code.indexOf('class="physics-paint-roto-cells"', loopRailIndex);

    expect(getWorkflowStripPropsInterface(code)).toContain('selectedRotoLoopClipIds?: readonly string[];');
    expect(getWorkflowStripPropsInterface(code)).not.toContain('selectedRotoLoopSourceKeyIds');
    expect(getWorkflowStripPropsInterface(code)).toContain('onSelectRotoLoopClip?: (');
    expect(getWorkflowStripPropsInterface(code)).toContain('gesture?: PhysicsPaintRotoSpacingSelectionGesture,');
    expect(getWorkflowStripPropsInterface(code)).toContain('onOpenRotoLoopEdit?: (loopId: string) => Promise<');
    expect(code).toContain('loopResolutionContext.ranges.length > 0');
    expect(code).toContain('ranges={loopResolutionContext.ranges}');
    expect(code).toContain('visibleFrameWindow={{ startFrame: frameCells[0]!, endFrameExclusive: frameCells[frameCells.length - 1]! + 1 }}');
    expect(rulerIndex).toBeGreaterThanOrEqual(0);
    expect(laneFnIndex).toBeGreaterThanOrEqual(0);
    expect(physicalLaneIndex).toBeGreaterThan(laneFnIndex);
    expect(loopRailIndex).toBeGreaterThan(physicalLaneIndex);
    expect(cellsIndex).toBeGreaterThan(loopRailIndex);
    expect(code).not.toContain('PhysicsPaintLoopClipLane');
    expect(existsSync(legacyLanePath)).toBe(false);
  });

  it('derives accessible product copy without exposing the raw loop UUID', () => {
    const clip = {
      loopId: '0f65c808-raw-loop-uuid',
      placementStart: 0,
      sourceKeyIds: Array.from({ length: 5 }, (_, index) => `source-${index}`),
      repeat: 5 as const,
      mode: 'static' as const,
      scriptId: 'script-1',
      motion: { deformation: 0, position: 0 },
      overrideColor: null,
    };
    const context = derivePhysicPaintRotoLoopRanges({
      identities: Array.from({ length: 5 }, (_, index) => ({ keyId: `source-${index}`, appFrame: index })),
      loopClips: [clip],
      capacity: 120,
      interpolationEnabled: false,
    });
    const presentation = projectPhysicsPaintLoopClipPresentation(context.ranges[0], clip, 'Walk');

    expect(presentation.displayName).toBe('Walk Rail');
    expect(presentation.cycleLabel).toBe('Cycle 5f × 5 = 25f');
    expect(presentation.effectiveLabel).toBe('Effective 25f');
    expect(presentation.mode).toBe('static');
    expect(presentation.modeLabel).toBe('Static');
    expect(presentation.groupTypeLabel).toBe('Static Rail');
    expect(presentation.statusLabel).toBe('Synchronized with Action.');
    expect([
      presentation.displayName,
      presentation.sourceLabel,
      presentation.placementLabel,
      presentation.cycleLabel,
      presentation.effectiveLabel,
      presentation.modeLabel,
      presentation.statusLabel,
    ].join(' ')).not.toContain('0f65c808-raw-loop-uuid');
  });

  it('uses physical cycle duration for rail copy while source-frame copy keeps the source count', () => {
    const clip = {
      loopId: 'loop-spaced',
      placementStart: 10,
      sourceKeyIds: ['A', 'B', 'C'],
      repeat: 2 as const,
      mode: 'progressive' as const,
    };
    const context = derivePhysicPaintRotoLoopRanges({
      identities: [
        { keyId: 'A', appFrame: 0 },
        { keyId: 'B', appFrame: 3 },
        { keyId: 'C', appFrame: 6 },
      ],
      loopClips: [clip],
      capacity: 120,
      interpolationEnabled: true,
    });
    const presentation = projectPhysicsPaintLoopClipPresentation(context.ranges[0], clip, 'Walk');

    expect(presentation.cycleLabel).toBe('Cycle 7f × 2 = 14f');
    expect(context.ranges[0].sourceFrameCount).toBe(3);
  });

  it('projects one compact segment without materializing repeated frames', () => {
    const context = derivePhysicPaintRotoLoopRanges({
      identities: Array.from({ length: 5 }, (_, index) => ({ keyId: `source-${index}`, appFrame: index })),
      loopClips: [{
        loopId: 'loop-1',
        placementStart: 10,
        sourceKeyIds: Array.from({ length: 5 }, (_, index) => `source-${index}`),
        repeat: 5,
        mode: 'progressive',
      }],
      capacity: 120,
      interpolationEnabled: false,
    });

    expect(projectPhysicsPaintLoopClipGeometry(
      context.ranges[0],
      { startFrame: 0, endFrameExclusive: 120 },
      18,
    )).toEqual({ left: 180, width: 450 });
    expect(css()).toMatch(/\.physics-paint-loop-clip-rail-segment\s*\{[^}]*height:\s*4px[^}]*background:\s*#8b5cf6/s);
    expect(css()).toMatch(/\.physics-paint-loop-clip-rail-target:hover:not\(\.selected\)[^}]*background:\s*#c4b5fd/s);
    expect(css()).toMatch(/\.physics-paint-loop-clip-rail-target\.selected[^}]*background:\s*#f59e0b/s);
    expect(css()).toMatch(/\.physics-paint-loop-clip-rail-target\s*\{[^}]*height:\s*8px/s);
    expect(css()).not.toContain('.physics-paint-loop-clip-rail-target::after');
  });

  it('routes spacing-proxy gestures before ordinary key selection and keeps proxies non-draggable', () => {
    const code = source();
    const props = getWorkflowStripPropsInterface(code);
    const handlerStart = code.indexOf('const handleRotoTimelineCellClick = useCallback(');
    const handlerEnd = code.indexOf('const handleRotoTimelineCellPointerDown = useCallback(', handlerStart);
    const handler = code.slice(handlerStart, handlerEnd);
    const clearLoopIndex = handler.indexOf('current.onSelectRotoLoopClip?.(null);');
    const proxyIndex = handler.indexOf('current.spacingProxyByAppFrame.get(frame)');
    const toggleProxyIndex = handler.indexOf("current.onSelectRotoSpacingProxy?.(spacingProxy, 'toggle')");
    const rangeProxyIndex = handler.indexOf("current.onSelectRotoSpacingProxy?.(spacingProxy, 'range')");
    const plainProxyIndex = handler.indexOf("current.onSelectRotoSpacingProxy?.(spacingProxy, 'plain')");
    const proxyNavigateIndex = handler.indexOf('current.onNavigateToSyncedFrame(frame);', plainProxyIndex);
    const ordinaryClearIndex = handler.indexOf('current.onClearRotoSpacingSelection?.();');
    const emptyKeyClearIndex = handler.indexOf('current.onClearRotoKeySelection?.();');
    const ordinaryToggleIndex = handler.indexOf('current.onToggleRotoKeySelection?.(cellKeyId);');

    expect(props).toContain('rotoSpacingSelection?: PhysicsPaintRotoSpacingSelection | null;');
    expect(props).toContain('onSelectRotoSpacingProxy?:');
    expect(props).toContain('onClearRotoSpacingSelection?: () => void;');
    expect(props).toContain('onClearRotoKeySelection?: () => void;');
    expect(clearLoopIndex).toBeGreaterThanOrEqual(0);
    expect(clearLoopIndex).toBeLessThan(proxyIndex);
    expect(proxyIndex).toBeGreaterThanOrEqual(0);
    expect(toggleProxyIndex).toBeGreaterThan(proxyIndex);
    expect(rangeProxyIndex).toBeGreaterThan(toggleProxyIndex);
    expect(plainProxyIndex).toBeGreaterThan(rangeProxyIndex);
    expect(proxyNavigateIndex).toBeGreaterThan(plainProxyIndex);
    expect(emptyKeyClearIndex).toBeGreaterThan(proxyNavigateIndex);
    expect(ordinaryClearIndex).toBeGreaterThan(emptyKeyClearIndex);
    expect(ordinaryToggleIndex).toBeGreaterThan(ordinaryClearIndex);
    expect(code).toContain('const dragEligible = isPhysicalRealKey && spacingProxy === null && !rotoDragLocked');
  });

  it('keeps an empty frame current until replacement-style Select All owns the selection', () => {
    const code = source();
    const map = getRotoMapBlock(code);
    const handlerStart = code.indexOf('const handleRotoTimelineCellClick = useCallback(');
    const handlerEnd = code.indexOf('const handleRotoTimelineCellPointerDown = useCallback(', handlerStart);
    const handler = code.slice(handlerStart, handlerEnd);
    const emptyBranchStart = handler.indexOf('if (cellKeyId === null)');
    const emptyBranch = handler.slice(emptyBranchStart, handler.indexOf('return;', emptyBranchStart));

    expect(emptyBranchStart).toBeGreaterThanOrEqual(0);
    expect(emptyBranch).toContain('current.onNavigateToSyncedFrame(frame);');
    expect(map).toContain("const isCurrentFrame = vm.overlays.includes('current');");
    expect(map).toContain('const hasReplacementSelection = props.rotoPrimarySelectedKeyId === null && rotoSelectedKeyIdSet.size >= 2;');
    expect(map).toContain('const hasCurrentTreatment = (isCurrentFrame && !hasReplacementSelection) || isPrimarySelected;');
    expect(map).toContain("${hasCurrentTreatment ? 'current' : ''}");
  });

  it('keeps physical-cell activation scoped to Group selection while rail linkage inputs stay independent', () => {
    const code = source();
    const props = getWorkflowStripPropsInterface(code);
    const handlerStart = code.indexOf('const handleRotoTimelineCellClick = useCallback(');
    const handlerEnd = code.indexOf('const handleRotoTimelineCellPointerDown = useCallback(', handlerStart);
    const handler = code.slice(handlerStart, handlerEnd);
    const railStart = code.indexOf('<PhysicsPaintLoopClipRail');
    const railEnd = code.indexOf('/>', railStart);
    const rail = code.slice(railStart, railEnd);

    expect(props).toContain('selectedRotoLoopClipIds?: readonly string[];');
    expect(props).toContain('linkedRotoLoopClipIds?: readonly string[];');
    expect(rail).toContain('selectedLoopClipIds={props.selectedRotoLoopClipIds ?? []}');
    expect(rail).toContain('linkedLoopClipIds={props.linkedRotoLoopClipIds ?? []}');
    expect(rail).toContain('linkedActionName={props.linkedRotoActionName ?? null}');

    const clearGroupIndex = handler.indexOf('current.onSelectRotoLoopClip?.(null);');
    const spacingProxyIndex = handler.indexOf('current.spacingProxyByAppFrame.get(frame)');
    const navigationIndex = handler.indexOf('current.onNavigateToSyncedFrame(frame);');
    expect(clearGroupIndex).toBeGreaterThanOrEqual(0);
    expect(clearGroupIndex).toBeLessThan(spacingProxyIndex);
    expect(navigationIndex).toBeGreaterThan(clearGroupIndex);
    expect(handler).not.toMatch(/selectedAction|linkedRotoLoopClipIds|linkedRotoActionName/);
  });

  it('rejects target-level linked paint while preserving selected, endpoint, dot, focus, and strip geometry', () => {
    const styles = css();
    expect(styles).not.toMatch(/\.physics-paint-loop-clip-rail-target\.mode-(?:progressive|static)\.action-linked:not\(\.selected\)\s*\{/);
    expect(getCssRuleBlock(styles, '.physics-paint-loop-clip-rail-target.mode-progressive.action-linked:not(.selected) .physics-paint-loop-clip-rail-segment {'))
      .toContain('background: #c4b5fd');
    expect(getCssRuleBlock(styles, '.physics-paint-loop-clip-rail-target.mode-static.action-linked:not(.selected) .physics-paint-loop-clip-rail-segment {'))
      .toContain('background: #67e8f9');
    expect(getCssRuleBlock(styles, '.physics-paint-loop-clip-rail-target.selected .physics-paint-loop-clip-rail-segment {'))
      .toContain('background: #f59e0b');
    expect(getCssRuleBlock(styles, '.physics-paint-rail-target.boundary-start .physics-paint-rail-segment::before,')).toContain('height: 4px');
    expect(getCssRuleBlock(styles, '.physics-paint-rail-target.boundary-cell-start {')).toContain('border-left: 1px solid #f8fafc');
    expect(getCssRuleBlock(styles, '.physics-paint-rail-target.boundary-cell-end {')).toContain('border-right: 1px solid #f8fafc');
    expect(getCssRuleBlock(styles, '.physics-paint-loop-clip-lifecycle-dot {')).toContain('width: 20px');
    expect(styles).not.toContain('.physics-paint-rail-target:focus-visible::after');
    expect(getCssRuleBlock(styles, '.physics-paint-roto-cells {')).not.toContain('repeat(120, 18px)');
    expect(getCssRuleBlock(styles, '.physics-paint-lane {')).toContain('height: 30px');
    expect(getCssRuleBlock(styles, '.physics-paint-workflow-strip {')).toContain('min-height: 0');
  });

  it('keeps rail selection line-only while explicit physical spacing proxies remain visible', () => {
    const code = source();
    const props = getWorkflowStripPropsInterface(code);
    const map = getRotoMapBlock(code);
    expect(props).not.toContain('selectedRotoLoopSourceKeyIds');
    expect(props).toContain('rotoPrimarySelectedKeyId?: string | null;');
    expect(code).toContain('selectedLoopClipIds={props.selectedRotoLoopClipIds ?? []}');
    expect(map).toContain('const spacingProxy = visibleSpacingProxies?.get(frame) ?? null;');
    expect(map).toContain('const isSpacingProxySelected = spacingProxy !== null');
    expect(map).toContain('props.rotoSpacingSelection?.sourceCycleId === spacingProxy.sourceCycleId');
    expect(map).toContain('rotoSpacingSelectedSourceKeyIdSet.has(spacingProxy.sourceKeyId)');
    expect(map).not.toContain('selectedRotoLoopSourceKeyIdSet');
    expect(map).toContain("${isSpacingProxySelected ? 'roto-spacing-proxy-selected' : ''}");
    expect(map).not.toContain("${isSpacingProxySelected ? 'selected roto-spacing-proxy-selected' : ''}");
    expect(projectPhysicsPaintGroupProductReason('spacing-source-selected')).toBe('Group source position selected for Key Spacing.');
    expect(code).toContain("projectPhysicsPaintGroupProductReason('spacing-source-selected')");
    expect(map).not.toContain('Loop Clip source position selected for Key Spacing.');
    expect(map).toContain('ariaSelected={isSpacingProxySelected || isSecondarySelected}');
    expect(map).toContain('const isPrimarySelected = !isSpacingProxySelected');
    expect(map).toContain("&& props.rotoPrimarySelectedKeyId === cellKeyId;");
    expect(map).toContain('const isSecondarySelected = !isSpacingProxySelected');
    expect(map).toContain('&& !isPrimarySelected;');
    expect(map).toContain("const isCurrentFrame = vm.overlays.includes('current');");
    expect(map).toContain('const hasReplacementSelection = props.rotoPrimarySelectedKeyId === null && rotoSelectedKeyIdSet.size >= 2;');
    expect(map).toContain('const hasCurrentTreatment = (isCurrentFrame && !hasReplacementSelection) || isPrimarySelected;');
    expect(map).toContain("${hasCurrentTreatment ? 'current' : ''}");
    expect(map).not.toContain("${vm.overlays.includes('current') ? 'current' : ''}");
    // 47 close-out: the mirror/repeat frames of a SELECTED source key paint a
    // lighter blue-gray (NOT the orange selection — only the selected/current
    // cell is orange). Restored after the round-12 deletion.
    expect(css()).toContain('.physics-paint-roto-cell.roto-spacing-proxy-selected:not(.current)');
    expect(css()).toContain('.physics-paint-roto-cell.roto-linked-repeat.roto-spacing-proxy-selected:not(.current)');
    const ordinarySelection = getCssRuleBlock(css(), '.physics-paint-roto-cell.selected {');
    // 47 close-out UAT rounds 10-11: the selection is an orange background
    // fill only — no border recolor, no box, no hover variant.
    expect(ordinarySelection).toContain('background: #f5a623');
    expect(ordinarySelection).not.toContain('border-color:');
    expect(ordinarySelection).not.toContain('outline:');
    expect(ordinarySelection).not.toContain('box-shadow:');
  });
});

describe('PhysicsPaintWorkflowStrip Group-drag gap preview contract (43.3-03, UI-SPEC G3, D-02/D-05)', () => {
  it('wires the clamp provider, rejection publisher, and preview surface to the rail', () => {
    const code = source();
    expect(code).toContain('getClampInput={getRotoGroupDragClampInput}');
    expect(code).toContain('onRotoGroupDragRejected={(reason, detail) => props.onRotoGroupDragRejected?.(reason, detail ?? \'\')}');
    expect(code).toContain('onPreviewChange={setRotoGroupDragPreview}');
    expect(code).toContain('prepareRotoGroupDrag={physicalActions?.prepareRotoGroupDrag}');
    expect(code).toContain('commitRotoGroupDrag={physicalActions?.commitRotoGroupDrag}');
  });

  it('derives the clamp inputs from canonical document facts only (D-05, Pitfall 4)', () => {
    const code = source();
    expect(code).toContain('const getRotoGroupDragClampInput = useCallback(');
    expect(code).toContain('const clip = props.rotoLoopClips?.find((candidate) => candidate.loopId === loopId);');
    expect(code).toContain('const phaseOrigin = clip.phaseOrigin ?? clip.placementStart;');
    expect(code).toContain('const effectiveEnd = resolvePhysicPaintRotoGroupEffectiveEnd(clip, draggedRanges);');
    expect(code).not.toContain('Math.max(...draggedRanges.map((range) => range.effectiveEnd))');
    expect(code).toContain('identities: rotoKeyRecords.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame }))');
    expect(code).toContain('loopRanges: loopResolutionContext.ranges');
    expect(code).toContain('capacity: currentPhysicalCells.length');
  });

  it('paints gap-preview frames as ordinary roto-fill-empty cells with no new DOM nodes', () => {
    const code = source();
    const map = getRotoMapBlock(code);
    expect(map).toContain('const isRotoGroupDragGapPreview = rotoGroupDragGapPreviewAppFrames.has(frame);');
    expect(map).toContain('const effectiveFillClass = isRotoGroupDragGapPreview || isRotoKeyRailDragGapPreview');
    expect(map).toContain("? 'roto-fill-empty' : fillClass;");
    expect(map).toContain('physics-paint-roto-cell ${effectiveFillClass}');
    // The gap-preview frame set derives from the rail session's retained
    // publication via the pure presentation helper (memo lives above the map).
    expect(code).toContain('collectRotoGroupDragGapPreviewAppFrames(');
    expect(code).toContain('currentPhysicalCells,');
    expect(code).toContain('rotoGroupDragPreview.publication.proposal,');
    expect(code).toContain('if (!rotoGroupDragPreview) return new Set<number>();');
  });
});

describe('PhysicsPaintWorkflowStrip Key Rail integration (43.4-06)', () => {
  it('mounts Key Rails under ordinary segment authority, independently of Group infrastructure', () => {
    const code = source();
    const keyRailStart = code.indexOf('<PhysicsPaintKeyRail');
    const keyRailGate = code.slice(code.lastIndexOf('{', keyRailStart), keyRailStart);
    expect(code).toContain('const keyRailSegments = useMemo(() => deriveKeyRailSegments({');
    expect(keyRailGate).toContain('keyRailSegments.length > 0');
    expect(keyRailGate).not.toContain('props.onSelectRotoKeyRail');
    expect(keyRailGate).not.toContain('loopResolutionContext');
    expect(keyRailGate).not.toContain('onSelectRotoLoopClip');
    expect(keyRailGate).not.toContain('onOpenRotoLoopEdit');
    expect(code.indexOf('<PhysicsPaintKeyRail')).toBeGreaterThan(code.indexOf('class={`physics-paint-lane'));
    expect(code.indexOf('<PhysicsPaintKeyRail')).toBeLessThan(code.indexOf('class="physics-paint-roto-cells"'));
  });

  it('derives ordinary segments by excluding all Motion and Static Group-owned identities', () => {
    const code = source();
    expect(code).toContain('const keyRailGroupOwnedKeyIds = useMemo(() => {');
    expect(code).toContain('clip.sourceKeyIds.forEach((keyId) => owned.add(keyId));');
    expect(code).toContain('(clip.frameOverrides ?? []).forEach((override) => owned.add(override.keyId));');
    expect(code).toContain('incomingInterpolationBreakKeyIds: new Set(props.rotoIncomingInterpolationBreakKeyIds ?? [])');
    expect(code).toContain('groupOwnedKeyIds: keyRailGroupOwnedKeyIds');
  });

  it('wires prepare, commit, clamp, rejection, selection, and preview ports to the Key Rail host', () => {
    const code = source();
    const start = code.indexOf('<PhysicsPaintKeyRail');
    const rail = code.slice(start, code.indexOf('/>', start));
    expect(rail).toContain('selectedKeyRail={props.selectedRotoKeyRail ?? null}');
    expect(rail).toContain('onSelectKeyRail={props.onSelectRotoKeyRail ?? NOOP_KEY_RAIL_SELECTION}');
    expect(rail).toContain('prepareKeyRailDrag={physicalActions?.prepareKeyRailDrag}');
    expect(rail).toContain('commitKeyRailDrag={physicalActions?.commitKeyRailDrag}');
    expect(rail).toContain('getClampInput={getRotoKeyRailDragClampInput}');
    expect(rail).toContain('onKeyRailDragRejected={props.onRotoKeyRailDragRejected}');
    expect(rail).toContain('onPreviewChange={setRotoKeyRailDragPreview}');
  });

  it('paints Key Rail vacated and destination gaps through the existing empty-cell class and clears with null preview', () => {
    const code = source();
    const map = getRotoMapBlock(code);
    expect(code).toContain('const [rotoKeyRailDragPreview, setRotoKeyRailDragPreview]');
    expect(code).toContain('if (!rotoKeyRailDragPreview) return new Set<number>();');
    expect(code).toContain('rotoKeyRailDragPreview.publication.vacatedInterval');
    expect(code).toContain('rotoKeyRailDragPreview.publication.destinationFirstKeyAppFrame');
    expect(map).toContain('const isRotoKeyRailDragGapPreview = rotoKeyRailDragGapPreviewAppFrames.has(frame);');
    expect(map).toContain('isRotoGroupDragGapPreview || isRotoKeyRailDragGapPreview');
    expect(map).toContain("? 'roto-fill-empty' : fillClass");
    expect(code).toContain('onPreviewChange={setRotoKeyRailDragPreview}');
    expect(css()).not.toContain('key-rail-gap-preview');
  });
});

describe('PhysicsPaintWorkflowStrip single-rail drag-routing split (quick 260820-lwd)', () => {
  it('derives drag-routing membership from the explicit movable set, not the set-of-one paint classifier', () => {
    const code = source();
    // The fix lives in the strip: railSetMoveMemberKeyRailIds and
    // railSetMoveMemberLoopIds are derived ONLY from railSetMoveMembers (the
    // explicit, actually-movable set). A plain-selected single rail is a paint
    // member (effectiveRailSetMembers) but NOT a move member, so its drag must
    // fall back to its own 43.3/43.4 path.
    expect(code).toContain('const railSetMoveMemberKeyRailIds = useMemo(');
    expect(code).toContain('.filter((member): member is Extract<PhysicPaintRailSetMoveMember, { kind: \'key-rail\' }> => member.kind === \'key-rail\')');
    expect(code).toContain('.map((member) => member.firstKeyId)');
    expect(code).toContain('const railSetMoveMemberLoopIds = useMemo(');
    expect(code).toContain('.filter((member): member is Extract<PhysicPaintRailSetMoveMember, { kind: \'loop\' }> => member.kind === \'loop\')');
    expect(code).toContain('.map((member) => member.loopId)');
    expect(code).toContain('[railSetMoveMembers],');
  });

  it('passes the movable membership to both rail hosts for batch pointer-down routing', () => {
    const code = source();
    const keyRailStart = code.indexOf('<PhysicsPaintKeyRail');
    const keyRail = code.slice(keyRailStart, code.indexOf('/>', keyRailStart));
    expect(keyRail).toContain('railSetMoveMemberKeyRailIds={railSetMoveMemberKeyRailIds}');

    const loopRailStart = code.indexOf('<PhysicsPaintLoopClipRail');
    const loopRail = code.slice(loopRailStart, code.indexOf('/>', loopRailStart));
    expect(loopRail).toContain('railSetMoveMemberLoopIds={railSetMoveMemberLoopIds}');
  });
});

describe('Directional Push tool source contract (43.5-05: ONE mode-toggle Push tool, anchor resolved per-drag)', () => {
  it('A1: gates the Push tool on busy/lock state ONLY — arming needs no selection (mode toggle)', () => {
    const code = source();
    const gateStart = code.indexOf('const pushToolDisabled =');
    const gate = code.slice(gateStart, code.indexOf(';', gateStart));
    expect(gate).toContain('keyUtilitiesDisabledByBusyState');
    expect(gate).toContain('!physicalActions');
    // No selection requirement: the button arms freely, and the anchor is
    // resolved from the rail under the pointer on drag.
    expect(gate).not.toContain('pushAnchor');
    expect(gate).not.toContain('physicalDragAvailable');
    expect(gate).not.toContain('canDragKey');
  });

  it('A2: pointer-down resolves the anchor from the Rail under the pointer and rejects ruler/empty-lane targets', () => {
    const code = source();
    const handlerStart = code.indexOf('const handleLanePushPointerDownCapture');
    const handler = code.slice(handlerStart, code.indexOf('const handleLanePushClickCapture', handlerStart));
    // The pointer must land INSIDE the lane (never the sibling ruler); the
    // anchor is resolved from the rail under the pointer via its data attribute,
    // and only a rail target starts a push (empty/gap frames are inert).
    expect(handler).toContain('laneElement.contains(event.target)');
    expect(handler).toContain('closest(\'.physics-paint-key-rail-target\')');
    expect(handler).toContain('closest(\'.physics-paint-loop-clip-rail-target\')');
    expect(handler).toContain('data-rail-first-frame');
    expect(handler).toContain('armedAnchorRef.current = anchor');
    expect(handler).toContain('if (anchor === null) return;');
    expect(handler).toContain('pushSessionRef.current = {');
  });

  it('A3: projects pointer travel in FRAMES, not raw pixels (raw signed delta)', () => {
    const code = source();
    const projectStart = code.indexOf('projectDestination:');
    const project = code.slice(projectStart, code.indexOf('clampDestination:', projectStart));
    // The resolver clamp consumes FRAME deltas; raw CSS-pixel travel must be
    // converted by the 18px frame pitch before clamping.
    expect(project).toContain('ROTO_CELL_WIDTH_PX');
    expect(project).toContain('Math.round');
  });

  it('A4: projectDestination returns a raw SIGNED frame delta — the hook derives the direction from the drag sign', () => {
    const code = source();
    const projectStart = code.indexOf('projectDestination:');
    const project = code.slice(projectStart, code.indexOf('clampDestination:', projectStart));
    expect(project).toContain('ROTO_CELL_WIDTH_PX');
    // No directional clamping at projection time — the direction is chosen by
    // the drag and locked in the hook.
    expect(project).not.toContain("direction === 'right'");
    expect(project).not.toContain('Math.min(0,');
  });

  it('A5: while armed, the lane pointer-down capture stops propagation so cell/rail drags and selection never fire', () => {
    const code = source();
    const handlerStart = code.indexOf('const handleLanePushPointerDownCapture');
    const handler = code.slice(handlerStart, code.indexOf('const handleLanePushClickCapture', handlerStart));
    // While armed, ALL other lane interactivity is suspended — the push gesture
    // owns the lane. stopPropagation in the capture phase keeps cell/rail
    // pointer-down handlers (selection, drags, Scissor arming) from firing.
    expect(handler).toContain('event.stopPropagation()');
  });

  it('A5: while armed, a plain click moves the playback cursor only — never selection', () => {
    const code = source();
    const handlerStart = code.indexOf('const handleLanePushClickCapture');
    const handler = code.slice(handlerStart, code.indexOf('// Controller-owned selection set', handlerStart));
    // A sub-threshold plain click while armed navigates the playback cursor and
    // swallows the click so cell/rail click handlers (selection) never fire.
    expect(handler).toContain('isPushToolArmed()');
    expect(handler).toContain('onNavigateToSyncedFrame');
    expect(handler).toContain('event.stopPropagation()');
  });

  it('A6: the anchor is NOT selection-derived — the tool arms freely and resolves the anchor per-drag (mode toggle)', () => {
    const code = source();
    // No selection-derived `pushAnchor` gate/arm-binding remains.
    expect(code).not.toContain('const pushAnchor = useMemo');
    expect(code).not.toContain('armedAnchorRef.current = pushAnchor');
    // The armed capsule still derives from the selected rail for display.
    expect(code).toContain('pushArmedAnchorRail');
    expect(code).toContain('selectedRotoKeyRail');
  });

  it('A7: the single Push button and Delete are icon-only (no visible text label)', () => {
    const code = source();
    expect(code).not.toContain('>Push Left</span>');
    expect(code).not.toContain('>Push Right</span>');
    expect(code).not.toContain('>Delete</span>');
    // ONE Push button, not two.
    expect(code).toContain('aria-label="Push"');
    expect(code).not.toContain('aria-label="Push Left"');
    expect(code).not.toContain('aria-label="Push Right"');
  });

  it('A8: Delete renders AFTER the All button in the action row', () => {
    const code = source();
    const allIndex = code.indexOf('aria-label="Select all keys"');
    const deleteIndex = code.indexOf('aria-label={deleteRotoScopeLabel}');
    expect(allIndex).toBeGreaterThan(-1);
    expect(deleteIndex).toBeGreaterThan(-1);
    expect(deleteIndex).toBeGreaterThan(allIndex);
  });

  it('A9: a blocked drag direction shows not-allowed + guarded tooltip for that direction only — the other direction stays available', () => {
    const code = source();
    // The hook exposes onBlocked; the strip shows the guarded tooltip while the
    // drag is live in a blocked direction (frame-0/capacity flush or straddle).
    expect(code).toContain('onBlocked');
    expect(code).toContain('pushDragBlocked');
    expect(code).toContain('pushHoverInvalid = pushDragBlocked.value !== null');
    // The other direction stays available: a rejected drop keeps the tool armed.
    expect(code).toContain('pushDragBlocked.value = null');
  });

  it('A10: arming is a pure mode toggle — no arm-time anchor binding, no selection-derived disarm', () => {
    const code = source();
    // The button only toggles the mode; the anchor is resolved per-drag.
    expect(code).not.toContain('armedAnchorRef.current = pushAnchor');
    expect(code).not.toContain('const pushAnchor = useMemo');
    // The anchor is resolved in the pointer-down handler.
    expect(code).toContain('armedAnchorRef.current = anchor');
    // The captured anchor is cleared only when the tool is actually disarmed.
    expect(code).toContain('if (!pushArmed) armedAnchorRef.current = null;');
    // Escape / other tool / re-click still disarm via the shared vectors.
    expect(code).toContain('disarmPushTool()');
  });

  it('A11: the blocked-direction tooltip anchors to the pointer position, never an unrelated panel element (43.5-05 Defect 2)', () => {
    const code = source();
    // The hook passes pointer viewport coords to onBlocked; the strip stores
    // them and positions a zero-size anchor span the tooltip reads.
    expect(code).toContain('pushBlockedPointer');
    expect(code).toContain('pointer.clientX');
    expect(code).toContain('pushBlockedAnchorRef');
    expect(code).toContain('position: \'fixed\'');
  });

  it('A12: the ghost paints EVERY moved-set rail (including the anchor) at the clamped destination — painted range == readout range for both directions (smoke 1)', () => {
    const code = source();
    // The anchor is never skipped: the whole moved set ghosts at the destination,
    // so the painted range equals the readout range for Push Right AND Push Left.
    expect(code).not.toContain('isSelectedPushRail');
    // Ghost left is the destination interval (original + the clamped signed
    // delta), never the original position — preview-is-the-commit (D-14).
    expect(code).toContain('rail.intervalStart + pushDragGhost.deltaFrames');
  });

  it('A13: no raw internal reason code surfaces — a zero-delta/no-op drop filters PUSH_DROP_NOOP in onBlocked (smoke 1)', () => {
    const code = source();
    const onBlockedStart = code.indexOf('onBlocked: (reason, detail, pointer)');
    const onBlocked = code.slice(onBlockedStart, code.indexOf('onPreviewChange:', onBlockedStart));
    // A no-op drop must show no tooltip and no status — the internal sentinel
    // clears the blocked state instead of surfacing as copy.
    expect(onBlocked).toContain('reason === PUSH_DROP_NOOP');
    expect(onBlocked).toContain('pushDragBlocked.value = null');
    expect(onBlocked).toContain('pushBlockedPointer.value = null');
  });

  it('A15: a valid preview clears the stale blocked-direction tooltip/cursor (43.5 WR-01)', () => {
    const code = source();
    const previewStart = code.indexOf('onPreviewChange: (');
    const onPreviewChange = code.slice(previewStart, code.indexOf('clearClickSequence:', previewStart));
    // The blocked verdict must clear whenever a valid (non-null) preview is
    // produced, not only on a null preview — otherwise the guarded tooltip and
    // not-allowed cursor linger after a blocked drag becomes valid again.
    expect(onPreviewChange).not.toContain('if (preview === null)');
    expect(onPreviewChange).toContain('pushDragBlocked.value = null');
    expect(onPreviewChange).toContain('pushBlockedPointer.value = null');
    expect(onPreviewChange).toContain('pushPaintTick.value += 1');
  });

  it('A14: the anchor keeps its orange capsule above the hover/ghost layers through armed→drag→commit (smoke 2)', () => {
    const code = source();
    // A dedicated anchor-capsule element renders whenever an anchor rail exists
    // (armed OR dragging) — never gated on drag state, so it persists across
    // armed→drag→commit and the reference is never lost.
    expect(code).toContain('physics-paint-push-anchor-capsule');
    expect(code).toContain('pushArmedAnchorRail !== null ? (');
    // The capsule paints the anchor's ORIGINAL interval as the reference.
    expect(code).toContain('pushArmedAnchorRail.intervalStart');
    // CSS: the capsule layer sits ABOVE the hover (7) and ghost (8).
    expect(css()).toContain('.physics-paint-push-anchor-capsule');
    expect(css()).toContain('z-index: 9');
  });

  it('A15: a successful push commit keeps the tool armed and re-selects the moved anchor rail (smoke 3)', () => {
    const code = source();
    const commitStart = code.indexOf('onDropCommit: (publication) => {');
    const commit = code.slice(commitStart, code.indexOf('onCancel:', commitStart));
    // The commit marks the push in flight (exempting the Studio mutation-lock
    // disarm) and records the anchor for the re-arm watchdog.
    expect(commit).toContain('setPushCommitInFlight(true)');
    expect(commit).toContain('rearmAnchorRef.current = anchor');
    // A re-arm watchdog re-selects the moved anchor rail and re-arms once when
    // the async settlement disarms the tool.
    expect(code).toContain('const pushArmedNow = isPushToolArmed();');
    expect(code).toContain('rearmAnchorRef.current = null');
    expect(code).toContain('props.onSelectRotoKeyRail');
    expect(code).toContain('togglePushTool()');
    // The Studio's disarm-on-mutation effect is guarded by the commit-in-flight
    // flag.
    expect(studioSource()).toContain('isPushCommitInFlight()');
    // The armed-tool module owns the commit-in-flight guard.
    const armedTool = armedToolSource();
    expect(armedTool).toContain('setPushCommitInFlight');
    expect(armedTool).toContain('isPushCommitInFlight');
  });

  it('A16: disarm vectors stay locked (cancel, Escape, toolbar) — a single re-arm watchdog is the only exemption', () => {
    const code = source();
    // A cancel (Escape / pointercancel / lostpointercapture) still disarms.
    const cancelStart = code.indexOf('onCancel: () => {');
    const cancel = code.slice(cancelStart, code.indexOf('onRejected:', cancelStart));
    expect(cancel).toContain('disarmPushTool()');
    // The toolbar onClickCapture still disarms on any non-Push action (D-20).
    expect(code).toContain('disarmPushTool()');
    // The armed anchor is cleared whenever the tool is actually disarmed.
    expect(code).toContain('if (!pushArmed) armedAnchorRef.current = null;');
    // The re-arm lives solely in the watchdog, which clears its pending ref so
    // a LATER Escape/another-tool disarm is not undone.
    expect(code).toContain('rearmAnchorRef.current = null');
  });
});

describe('Solo armed orange tint source contract (43.6-09: base class joins the conditional armed class)', () => {
  it('the Solo button className template carries physics-paint-push-tool-button AND ${soloArmedClass} in the same template literal', () => {
    const code = source();
    // Slice the Solo tool group block (the block containing 'Solo selected Rails').
    const groupStart = code.indexOf('physics-paint-solo-tool-group');
    expect(groupStart).toBeGreaterThan(-1);
    const group = code.slice(groupStart, code.indexOf('Solo selected Rails', groupStart));
    // Root cause RC-C (G-43.6-2 / G-43.6-7): the template reused the
    // .physics-paint-push-tool-armed class NAME but omitted the sibling
    // .physics-paint-push-tool-button base class required by the compound CSS
    // selector .physics-paint-push-tool-button.physics-paint-push-tool-armed
    // (physicsPaintStudio.css) — so the armed class was inert and the orange
    // tint never rendered. The template must carry BOTH the base class and the
    // conditional armed class in the same template literal, mirroring the Push
    // button exactly.
    const classStart = group.indexOf('class={`');
    expect(classStart).toBeGreaterThan(-1);
    const classTemplate = group.slice(classStart, group.indexOf('}`}', classStart) + 3);
    expect(classTemplate).toContain('physics-paint-roto-key-icon-button');
    expect(classTemplate).toContain('physics-paint-push-tool-button');
    expect(classTemplate).toContain('${soloArmedClass}');
    // The armed class stays conditional — soloArmedClass is defined from the
    // soloArmed signal (L1329) and is untouched by this fix.
    expect(code).toContain("const soloArmedClass = soloArmed ? ' physics-paint-push-tool-armed' : '';");
  });
});

describe('PhysicsPaintWorkflowStrip track CRUD wiring (47-02 Task 2)', () => {
  const dialogPath = resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintDeleteTrackDialog.tsx');
  const dialogSource = () => readFileSync(dialogPath, 'utf8');
  const headerColumnPath = resolve(dirname(fileURLToPath(import.meta.url)), 'physicsPaintTrackHeaderColumn.tsx');
  const headerColumnSource = () => readFileSync(headerColumnPath, 'utf8');
  const trackRowPath = resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintTrackRow.tsx');
  const trackRowSource = () => readFileSync(trackRowPath, 'utf8');
  // French-only copy tokens never allowed on the CRUD surfaces (D-14); note
  // 'clips' is intentionally excluded — the English labels 'loop clips' and
  // the 'rotoLoopClips' identifiers contain it legitimately. Word boundaries
  // keep English identifiers like 'copiedAppFrame'/'copiedStrokeCount' (the
  // roto copy/paste surface) from tripping the 'copie' token.
  const frenchCopyPattern = /\b(copie|supprimer|renommer|bloquant|confirmer|annuler)\b/;

  it('commits rename fail-closed in the strip: trim, 64-char cap, control-char rejection, then the intent (T-47-02-01 / ASVS V5)', () => {
    const strip = source();
    expect(strip).toContain('.trim()');
    expect(strip).toContain('MAX_TRACK_NAME_LENGTH');
    expect(strip).toContain('TRACK_NAME_CONTROL_CHAR');
    expect(strip).toContain('props.onRenameTrack?.(');
  });

  it('opens the acknowledge-and-delete dialog only through requestDeleteTrack; the commit lives only in the dialog (D-17)', () => {
    const strip = source();
    expect(strip).toContain('requestDeleteTrack(layerId, trackId)');
    // The strip never commits — the dialog's Confirm is the only delete entry.
    expect(strip).not.toContain('commitDeleteTrack');
    const dialog = dialogSource();
    expect(dialog).toContain('commitDeleteTrack(layerId, trackId, true)');
    expect(dialog).toContain('At least one Paint track is required.');
  });

  it('routes the header-drag reorder through reorderTrack with the stable id and a numeric order only (T-47-02-03 / Pitfall 1)', () => {
    const strip = source();
    expect(strip).toContain('onReorderTrack?.(');
    // The grip lives on the row surface (PhysicsPaintTrackRowHeader renders
    // it and fires onGripPointerDown); the column passes the intent through to
    // the rows, and the strip never renders the grip itself.
    const rowSource = trackRowSource();
    expect(rowSource).toContain('physics-paint-track-row-grip');
    expect(rowSource).toContain('onGripPointerDown');
    expect(headerColumnSource()).toContain('onGripPointerDown');
    const studio = studioSource();
    expect(studio).toContain('reorderTrack(layerId, trackId, newOrder)');
    expect(studio).toContain('setTrackSolo(layerId, trackId, solo)');
  });

  it('keeps every new CRUD surface copy English (D-14)', () => {
    const surfaces = `${source()}\n${dialogSource()}\n${headerColumnSource()}`;
    expect(surfaces).not.toMatch(frenchCopyPattern);
    const dialog = dialogSource();
    expect(dialog).toContain('Delete track');
    expect(dialog).toContain('frames');
    expect(dialog).toContain('Hold reference');
  });
});

describe('PhysicsPaintWorkflowStrip cross-track drag wiring (47-05 Task 1)', () => {
  it('wires the cross-track gesture ONLY through the rows-region capture listener, never through the header reorder grab (D-18)', () => {
    const strip = source();
    // The gesture hook is mounted in the strip.
    expect(strip).toContain('usePhysicsPaintCrossTrackDrag');
    expect(strip).toContain('crossTrackDrag.onPointerDown');
    // The rows-region is the only entry point for the content gesture.
    expect(strip).toContain('physics-paint-rows-region');
    // The reorder grip (47-02) never starts the cross-track session — the
    // grip wires ONLY handleGripPointerDown, which routes through reorderTrack.
    expect(strip).not.toContain('onGripPointerDown={crossTrackDrag');
    expect(strip).not.toContain('onGripPointerDown={(event) => crossTrackDrag');
  });

  it('passes the read-only destination highlight and insertion preview to the rows (D-16)', () => {
    const strip = source();
    expect(strip).toContain('crossDestination={');
    expect(strip).toContain('crossInsertionFrame={');
  });

  it('ships the destination-highlight and insertion-preview CSS classes', () => {
    const stylesheet = css();
    expect(stylesheet).toContain('.physics-paint-track-row-cross-destination');
    expect(stylesheet).toContain('.physics-paint-track-row-insertion-preview');
  });
});

describe('PhysicsPaintWorkflowStrip cross-track commit wiring (47-05 Task 2)', () => {
  it('routes the crossed release through physicPaintStore.moveTrackItems and publishes through the action bundle (D-17)', () => {
    const strip = source();
    expect(strip).toContain('physicPaintStore.moveTrackItems(layerId, fromTrackId, toTrackId, keys, destinationAppFrame)');
    expect(strip).toContain('moveTrackItems: (layerId, fromTrackId, toTrackId, keys, destinationAppFrame) =>');
    expect(strip).toContain('publishStatus: (message) => props.rotoPhysicalActions?.publishStatus?.(message)');
    expect(strip).toContain('setApplyStatus: (status) => props.rotoPhysicalActions?.setApplyStatus?.(status)');
  });

  it('wires one-click cross-track frame/rail selection through the rows (47 close-out UAT round 5)', () => {
    const strip = source();
    expect(strip).toContain('onSelectTrackFrame?: (trackId: string, frame: number) => void');
    expect(strip).toContain('onSelectTrackRail?: (trackId: string, rail: TrackRowRailSelection) => void');
    // Every non-active row receives both intents — a click selects AND
    // activates the track in one gesture.
    expect(strip).toContain('onSelectTrackFrame={props.onSelectTrackFrame}');
    expect(strip).toContain('onSelectTrackRail={props.onSelectTrackRail}');
  });

  it('wires the one-click cross-track selection intents in the Studio bundle (47 close-out UAT rounds 5+7)', () => {
    const studio = studioSource();
    // The Studio owns the intents: the click activates the track and applies
    // the selection SYNCHRONOUSLY in the click handler (the deferred seam
    // effect ran after the paint, so the first click's selection was never
    // visible — the 2-click bug). The ref guard keeps the track-switch reset
    // effect from reseeding over the just-applied selection.
    expect(studio).toContain('onSelectTrackFrame: handleSelectTrackFrame');
    expect(studio).toContain('onSelectTrackRail: handleSelectTrackRail');
    expect(studio).toContain('const handleSelectTrackFrame');
    expect(studio).toContain('const handleSelectTrackRail');
    const frameStart = studio.indexOf('const handleSelectTrackFrame');
    const frameBlock = studio.slice(frameStart, studio.indexOf('const handleSelectTrackRail', frameStart));
    expect(frameBlock).toContain('setActiveTrackId(layerId, trackId)');
    expect(frameBlock).toContain('crossTrackSelectionPendingRef.current = true');
    expect(frameBlock).toContain('handleNavigateToSyncedFrame(frame)');
    expect(frameBlock).toContain('getRotoRealKeyRecordByAppFrame');
    expect(frameBlock).toContain('selectedKeyId.value = key?.keyId ?? null');
    // The rail intent routes through the canonical plain-selection handler.
    const railStart = studio.indexOf('const handleSelectTrackRail');
    const railBlock = studio.slice(railStart, studio.indexOf('const navigateLinkedGroup', railStart));
    expect(railBlock).toContain("handleSelectRotoKeyRail({ firstKeyId: rail.firstKeyId, keyIds: rail.keyIds }, 'plain')");
    expect(railBlock).toContain('selectedLoopClipIds.value = [rail.loopId]');
  });

  it('activates the destination track after a committed move (47 close-out UAT)', () => {
    const strip = source();
    // The commit wrapper activates the destination through the same
    // onSelectTrack route a row click uses — only on success, never on a
    // rejection (the source track stays active on a failed move).
    const portStart = strip.indexOf('moveTrackItems: (layerId, fromTrackId, toTrackId, keys, destinationAppFrame) => {');
    const portEnd = strip.indexOf('publishStatus: (message)', portStart);
    const port = strip.slice(portStart, portEnd);
    expect(port).toContain('physicPaintStore.moveTrackItems(layerId, fromTrackId, toTrackId, keys, destinationAppFrame)');
    expect(port).toContain('if (result.ok) props.onSelectTrack?.(toTrackId)');
  });

  it('keeps the header reorder grab release completely outside the cross-track commit (D-18)', () => {
    const strip = source();
    const gripStart = strip.indexOf('const handleGripPointerDown');
    const gripBlock = strip.slice(gripStart, strip.indexOf('}, [computeReorderInsertionIndex, props.onReorderTrack]);', gripStart));
    // The grip routes through reorderTrack (47-02) — order-only intent.
    expect(gripBlock).toContain('onReorderTrack');
    expect(gripBlock).not.toContain('moveTrackItems');
    expect(gripBlock).not.toContain('crossTrackDrag');
  });
});
