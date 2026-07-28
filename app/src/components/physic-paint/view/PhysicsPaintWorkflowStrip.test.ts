import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintWorkflowStrip.tsx');
const source = () => readFileSync(sourcePath, 'utf8');
const cssPath = resolve(dirname(fileURLToPath(import.meta.url)), '../physicsPaintStudio.css');
const css = () => readFileSync(cssPath, 'utf8');

function getRotoMapBlock(code: string): string {
  const mapStart = code.indexOf('{frameCells.map(frame =>');
  return code.slice(mapStart, code.indexOf('physics-paint-roto-key-utilities', mapStart));
}
function getWorkflowStripPropsInterface(code: string): string {
  return code.slice(code.indexOf('export interface PhysicsPaintWorkflowStripProps'), code.indexOf('const VIRTUAL_TIMELINE_FRAME_COUNT'));
}
function getActionRowBlock(code: string): string {
  // Anchored at the action-row band (not the tools group) so the block spans
  // all three Gap F groups: identity → tools → key spacing (36.15-10).
  const rowStart = code.indexOf('class="physics-paint-roto-action-row"');
  const rowEnd = code.indexOf('physics-paint-timeline-scrollbar', rowStart);
  return code.slice(rowStart, rowEnd === -1 ? code.length : rowEnd);
}
function getButtonBlock(code: string, ariaLabel: string): string {
  const labelIndex = code.indexOf(`aria-label="${ariaLabel}"`);
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

const ROW_ICON_ACTIONS: ReadonlyArray<{ label: string; guard: string; handler: string }> = [
  { label: 'Add key', guard: 'canAddRotoKey', handler: 'props.onAddRotoKey?.()' },
  { label: 'Duplicate key', guard: 'canDuplicateRotoKey', handler: 'props.onDuplicateRotoKey?.()' },
  { label: 'Insert key before', guard: 'canInsertRotoKey', handler: 'props.onInsertRotoFrame?.()' },
  { label: 'Copy key', guard: 'canCopyRotoKey', handler: 'props.onCopyRotoFrame?.()' },
  { label: 'Paste key', guard: 'canPasteRotoKey', handler: 'props.onPasteRotoFrame?.()' },
  { label: 'Delete key', guard: 'canDeleteRotoKey', handler: 'props.onDeleteRotoFrame?.()' },
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
    expect(code).toContain('disabled={interpolationControlsDisabled}');
    expect(code.match(/if \(props\.mutationLocked \|\| props\.rotoInterpolationPending\) return;/g)).toHaveLength(1);
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

  it('renders the six guarded icon actions in locked order (D-10)', () => {
    const row = getActionRowBlock(source());
    const indices = ROW_ICON_ACTIONS.map(({ label }) => row.indexOf(`aria-label="${label}"`));
    indices.forEach((index) => expect(index).toBeGreaterThanOrEqual(0));
    for (let i = 1; i < indices.length; i += 1) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]);
    }
    expect(source()).toContain('Plus');
    expect(source()).toContain('CopyPlus');
    expect(source()).toContain('BetweenVerticalStart');
    expect(source()).toContain('ClipboardCopy');
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
    // Six guarded icon actions plus the Set Key Space form.
    expect(builderCalls).toBeGreaterThanOrEqual(7);
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
      { action: 'Paste key', icon: 'ClipboardPaste', label: 'Paste' },
      { action: 'Delete key', icon: 'Trash2', label: 'Delete' },
    ];
    for (const { action, icon, label } of labeledActions) {
      const block = getButtonBlock(row, action);
      const iconIndex = block.indexOf(`<${icon} size={18}`);
      expect(iconIndex).toBeGreaterThanOrEqual(0);
      const labelIndex = block.indexOf(`<span class="physics-paint-roto-key-icon-label">${label}</span>`);
      expect(labelIndex).toBeGreaterThan(iconIndex);
    }
    expect(row).not.toContain('size={16}');
    // The Set Key Space form carries its own short label after the icon
    // (renamed 'Space' → 'Key spacing' in 36.15-09, UAT Gap E-2).
    const spacingIndex = row.indexOf('physics-paint-pill--apply-spacing');
    const form = row.slice(spacingIndex, row.indexOf('</form>', spacingIndex));
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
    expect(map).toContain('const dragEligible = isPhysicalRealKey && !rotoDragLocked;');
  });
});

describe('localized render contract', () => {
  it('owns timeline observers for the mount lifetime and refreshes geometry separately', () => {
    const code = source();
    expect(code).toContain('const timelineContentRef = useRef<HTMLDivElement>(null);');
    const observerEnd = code.indexOf('}, [updateScrollbar]);');
    const observerStart = code.lastIndexOf('useEffect(() => {', observerEnd);
    const observerEffect = code.slice(observerStart, observerEnd + '}, [updateScrollbar]);'.length);
    expect(observerStart).toBeGreaterThanOrEqual(0);
    expect(observerEffect).toContain('const content = timelineContentRef.current;');
    expect(observerEffect).toContain('observer.observe(content);');
    expect(observerEffect).not.toContain('frameCells');
    expect(observerEffect).toContain("recordPhysicsPaintPerformanceCounter('observer.timeline.resize.install')");
    expect(observerEffect).toContain("recordPhysicsPaintPerformanceCounter('observer.timeline.resize.cleanup')");
    expect(code).toContain('useLayoutEffect(() => {\n    updateScrollbar();\n  }, [frameCells, updateScrollbar]);');
    expect(code).toContain('ref={timelineContentRef} class="physics-paint-timeline-content"');
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
});

describe('localized render instrumentation', () => {
  it('counts the monolithic strip and its conceptual static chrome at the current strip owner', () => {
    const code = source();
    const stripStart = code.indexOf('export function PhysicsPaintWorkflowStrip');
    const stripBody = code.slice(stripStart, code.indexOf('const [scrollbar', stripStart));

    expect(stripStart).toBeGreaterThanOrEqual(0);
    expect(countOccurrences(code, "recordPhysicsPaintPerformanceCounter('render.workflowStrip')")).toBe(1);
    expect(countOccurrences(code, "recordPhysicsPaintPerformanceCounter('render.workflowStaticChrome')")).toBe(1);
    expect(stripBody).toContain("recordPhysicsPaintPerformanceCounter('render.workflowStrip')");
    expect(stripBody).toContain("recordPhysicsPaintPerformanceCounter('render.workflowStaticChrome')");
  });

  it('counts each private timeline cell body at its current owner', () => {
    const code = source();
    const cellStart = code.indexOf('function RotoTimelineCellButton');
    const cellBody = code.slice(cellStart, code.indexOf('const tooltip', cellStart));

    expect(cellStart).toBeGreaterThanOrEqual(0);
    expect(countOccurrences(code, "recordPhysicsPaintPerformanceCounter('render.rotoTimelineCellButton')")).toBe(1);
    expect(cellBody).toContain("recordPhysicsPaintPerformanceCounter('render.rotoTimelineCellButton')");
  });

  it('counts timeline ResizeObserver install and cleanup without changing its dependencies', () => {
    const code = source();
    const effectEnd = code.indexOf('}, [frameCells, updateScrollbar]);');
    const effectStart = code.lastIndexOf('useEffect(() => {', effectEnd);
    const observerEffect = code.slice(effectStart, effectEnd + '}, [frameCells, updateScrollbar]);'.length);

    expect(effectStart).toBeGreaterThanOrEqual(0);
    expect(countOccurrences(code, "recordPhysicsPaintPerformanceCounter('observer.timeline.resize.install')")).toBe(1);
    expect(countOccurrences(code, "recordPhysicsPaintPerformanceCounter('observer.timeline.resize.cleanup')")).toBe(1);
    expect(observerEffect).toContain("recordPhysicsPaintPerformanceCounter('observer.timeline.resize.install')");
    expect(observerEffect).toContain("recordPhysicsPaintPerformanceCounter('observer.timeline.resize.cleanup')");
    expect(observerEffect).toContain('}, [frameCells, updateScrollbar]);');
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
    const interpolationBlock = getCssRuleBlock(styles, '.physics-paint-pill--interpolation {');
    expect(interpolationBlock).toContain('#323a43');
    expect(interpolationBlock).toContain('#596775');
    const playbackBlock = getCssRuleBlock(styles, '.physics-paint-pill--playback {');
    expect(playbackBlock).toContain('#34383c');
    expect(playbackBlock).toContain('#59616a');
    expect(getCssRuleBlock(styles, '.physics-paint-pill--apply-spacing {')).not.toBe('');
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
    expect(code.match(/if \(props\.mutationLocked \|\| props\.rotoInterpolationPending\) return;/g)).toHaveLength(1);
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
    const capsuleIndex = header.indexOf('class="physics-paint-status-capsule"');
    const interpolationIndex = header.indexOf('physics-paint-pill--interpolation');
    expect(navigationIndex).toBeGreaterThanOrEqual(0);
    expect(capsuleIndex).toBeGreaterThan(navigationIndex);
    expect(interpolationIndex).toBeGreaterThan(capsuleIndex);
    const capsule = header.slice(capsuleIndex, interpolationIndex);
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
    expect(map).not.toContain('title=');
    expect(map).not.toContain('dragTitle');
    // Drag machinery untouched: identity attributes and handlers stay.
    expect(map).toContain('handleRotoCellPointerDown');
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
    expect(pill).toContain('{interpolationStatus}');
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
  it('derives one lane-width constant from the virtual frame count and binds the ruler inline style to it', () => {
    const code = source();
    expect(code).toContain('ROTO_CELL_WIDTH_PX = 18');
    expect(code).toMatch(/ROTO_LANE_WIDTH_PX\s*=\s*VIRTUAL_TIMELINE_FRAME_COUNT\s*\*\s*ROTO_CELL_WIDTH_PX/);
    const rulerIndex = code.indexOf('class="physics-paint-ruler"');
    expect(rulerIndex).toBeGreaterThanOrEqual(0);
    const rulerTagEnd = code.indexOf('aria-hidden="true"', rulerIndex);
    const rulerTag = code.slice(rulerIndex, rulerTagEnd === -1 ? code.length : rulerTagEnd);
    expect(rulerTag).toContain('ROTO_LANE_WIDTH_PX');
    expect(code).not.toContain('1800px');
  });

  it('locks the cells grid to 18px abutting columns with zero gap', () => {
    const styles = css();
    const cells = getCssRuleBlock(styles, '.physics-paint-roto-cells {');
    expect(cells).toContain('grid-template-columns: repeat(120, 18px)');
    expect(cells).toContain('gap: 0');
    expect(styles).not.toContain('repeat(120, 13px)');
  });

  it('aligns ruler and lane to the derived 2160px width with fixed-pitch 54px ticks', () => {
    const styles = css();
    expect(getCssRuleBlock(styles, '.physics-paint-ruler {')).toContain('2160px');
    const lane = getCssRuleBlock(styles, '.physics-paint-lane {');
    expect(lane).toContain('grid-template-columns: 2160px');
    expect(lane).toContain('min-width: 2160px');
    expect(styles).not.toContain('1800px');
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

describe('PhysicsPaintWorkflowStrip fixed band stack contract (36.15-06 task 2)', () => {
  it('locks the strip shell and studio grid third track to 161px with no legacy or override height literals', () => {
    const styles = css();
    // 161px = the Plan 06 155px total with the user-approved Gap H-6 action-row
    // relaxation (28px to 34px); every other band keeps its Plan 06 height.
    expect(getCssRuleBlock(styles, '.physics-paint-workflow-strip {')).toContain('height: 161px');
    expect(getCssRuleBlock(styles, '.physics-paint-studio {')).toContain('grid-template-rows: minmax(58px, auto) minmax(0, 1fr) 161px');
    expect(styles).not.toContain('256px');
    expect(styles).not.toContain('260px');
  });

  it('declares the exact 46/1/28/38/34/14 band geometry with zeroed strip padding and gap', () => {
    const styles = css();
    const strip = getCssRuleBlock(styles, '.physics-paint-workflow-strip {');
    expect(strip).toContain('gap: 0');
    expect(strip).toContain('padding: 0 12px');
    expect(getCssRuleBlock(styles, '.physics-paint-workflow-header {')).toContain('height: 46px');
    const timeline = getCssRuleBlock(styles, '.physics-paint-timeline {');
    expect(timeline).toContain('border-top: 1px');
    expect(timeline).not.toContain('min-height');
    const lane = getCssRuleBlock(styles, '.physics-paint-lane {');
    expect(lane).toContain('height: 38px');
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
    const laneIndex = code.indexOf('class="physics-paint-lane"', scrollIndex);
    const actionRowIndex = code.indexOf('class="physics-paint-roto-action-row"', laneIndex);
    const utilitiesIndex = code.indexOf('physics-paint-roto-key-utilities', actionRowIndex);
    const scrollbarIndex = code.indexOf('class="physics-paint-timeline-scrollbar"', utilitiesIndex);
    for (const index of [scrollIndex, scrollEnd, laneIndex, actionRowIndex, utilitiesIndex, scrollbarIndex]) {
      expect(index).toBeGreaterThanOrEqual(0);
    }
    expect(laneIndex).toBeLessThan(scrollEnd);
    expect(actionRowIndex).toBeGreaterThan(scrollEnd);
    expect(utilitiesIndex).toBeGreaterThan(actionRowIndex);
    expect(scrollbarIndex).toBeGreaterThan(utilitiesIndex);
    expect(code.slice(scrollIndex, scrollEnd)).not.toContain('physics-paint-roto-action-row');
    expect(code.slice(scrollIndex, scrollEnd)).toContain('physics-paint-roto-cells');
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
    const capsuleIndex = header.indexOf('class="physics-paint-status-capsule"');
    const interpolationIndex = header.indexOf('physics-paint-pill--interpolation');
    const closeIndex = header.indexOf('aria-label="Close"');
    for (const index of [navigationIndex, playbackIndex, capsuleIndex, interpolationIndex, closeIndex]) {
      expect(index).toBeGreaterThanOrEqual(0);
    }
    expect(playbackIndex).toBeGreaterThan(navigationIndex);
    expect(capsuleIndex).toBeGreaterThan(playbackIndex);
    expect(interpolationIndex).toBeGreaterThan(capsuleIndex);
    expect(closeIndex).toBeGreaterThan(interpolationIndex);
    for (const removed of ['aria-label="Tools"', 'physics-paint-tools-menu', 'physics-paint-tools-trigger', 'physics-paint-tools-dropdown', 'aria-label="Add key"', 'aria-label="Duplicate key"', 'physics-paint-pill--apply-spacing', 'physics-paint-mode-label']) {
      expect(header).not.toContain(removed);
    }
  });

  it('removes the Tools dropdown machinery and its CSS outright', () => {
    const code = source();
    for (const removed of ['toolsOpen', 'setToolsOpen', 'toolsMenuRef', 'aria-haspopup="menu"', 'physics-paint-tools-menu', 'physics-paint-tools-trigger', 'physics-paint-tools-dropdown']) {
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

  it('orders the bottom action row as layer, Key chip, Add key, Duplicate, Insert, Copy, Paste, Delete, Set Key Space', () => {
    const row = getActionRowBlock(source());
    const layerIndex = row.indexOf('physics-paint-roto-key-layer');
    const chipIndex = row.indexOf('physics-paint-roto-key-context');
    const addIndex = row.indexOf('aria-label="Add key"');
    const duplicateIndex = row.indexOf('aria-label="Duplicate key"');
    const insertIndex = row.indexOf('aria-label="Insert key before"');
    const copyIndex = row.indexOf('aria-label="Copy key"');
    const pasteIndex = row.indexOf('aria-label="Paste key"');
    const deleteIndex = row.indexOf('aria-label="Delete key"');
    const spacingIndex = row.indexOf('physics-paint-pill--apply-spacing');
    for (const index of [layerIndex, chipIndex, addIndex, duplicateIndex, insertIndex, copyIndex, pasteIndex, deleteIndex, spacingIndex]) {
      expect(index).toBeGreaterThanOrEqual(0);
    }
    expect(chipIndex).toBeGreaterThan(layerIndex);
    expect(addIndex).toBeGreaterThan(chipIndex);
    expect(duplicateIndex).toBeGreaterThan(addIndex);
    expect(insertIndex).toBeGreaterThan(duplicateIndex);
    expect(copyIndex).toBeGreaterThan(insertIndex);
    expect(pasteIndex).toBeGreaterThan(copyIndex);
    expect(deleteIndex).toBeGreaterThan(pasteIndex);
    expect(spacingIndex).toBeGreaterThan(deleteIndex);
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
    const row = getActionRowBlock(source());
    const spacingIndex = row.indexOf('physics-paint-pill--apply-spacing');
    expect(spacingIndex).toBeGreaterThanOrEqual(0);
    const formEnd = row.indexOf('</form>', spacingIndex);
    const form = row.slice(spacingIndex, formEnd === -1 ? row.length : formEnd);
    expect(form.replace(/aria-disabled/g, '')).not.toContain('disabled=');
    expect(form).not.toContain('title=');
    expect(form).toContain('aria-disabled={!canApplyForceSpacingAction');
    expect(form).toContain('aria-label="Empty frames between real keys"');
    expect(form).toContain('aria-label="Apply force spacing"');
    expect(form).toContain('>Apply</button>');
    expect(row).toContain("buildGuardedActionTooltipCopy('Set empty physical frames between real Roto keys'");
    expect(row).toContain('PhysicsPaintStyledTooltip');
    // The submit handler keeps its verbatim mutation-lock guard.
    expect(source()).toContain('if (props.ready === false || props.mutationLocked || !forceSpacingAvailable) return;');
  });
});

describe('PhysicsPaintWorkflowStrip clipping guard contract (36.15-08, UAT Gap B)', () => {
  it('places header tooltips below their anchors so no header control is masked by the canvas', () => {
    const header = getHeaderBlock(source());
    const belowCount = (header.match(/placement="below"/g) ?? []).length;
    // Status capsule, interpolation pill, and Close all render their tooltips below.
    expect(belowCount).toBeGreaterThanOrEqual(3);
    const styles = css();
    const below = getCssRuleBlock(styles, '.physics-paint-styled-tooltip--below {');
    expect(below).toContain('top: calc(100% + 6px)');
    expect(below).toContain('bottom: auto');
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
  it('renames the Set Key Space bottom-row label to Key spacing', () => {
    const row = getActionRowBlock(source());
    expect(row).toContain('<span class="physics-paint-roto-key-icon-label">Key spacing</span>');
    expect(row).not.toContain('<span class="physics-paint-roto-key-icon-label">Space</span>');
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

  it('raises the selected key cell above its right neighbor so the full orange selection border renders', () => {
    const styles = css();
    const current = getCssRuleBlock(styles, '.physics-paint-roto-cell.current {');
    expect(current).not.toBe('');
    // Abutting 18px cells paint in DOM order, so the next cell covered the
    // selected cell's right outline edge; a positive z-index on the selected
    // state lifts the full four-side outline above the neighbor without
    // touching the 18px pitch or the band geometry.
    expect(current).toMatch(/z-index:\s*[1-9]\d*;/);
  });
});

describe('PhysicsPaintWorkflowStrip Gap F grouping and casing contract (36.15-10, UAT Gap F)', () => {
  it('renders three visually separated bottom-row groups in order: identity, tools, key spacing', () => {
    const row = getActionRowBlock(source());
    const identityIndex = row.indexOf('physics-paint-roto-key-identity');
    const utilitiesIndex = row.indexOf('physics-paint-roto-key-utilities');
    const spacingIndex = row.indexOf('physics-paint-pill--apply-spacing');
    for (const index of [identityIndex, utilitiesIndex, spacingIndex]) {
      expect(index).toBeGreaterThanOrEqual(0);
    }
    expect(utilitiesIndex).toBeGreaterThan(identityIndex);
    expect(spacingIndex).toBeGreaterThan(utilitiesIndex);
    // The identity group is its OWN group: it closes before the tools group
    // opens, so the layer name + Key chip are not fused with the tool icons.
    const identityCloseIndex = row.indexOf('</div>', identityIndex);
    expect(identityCloseIndex).toBeGreaterThanOrEqual(0);
    expect(identityCloseIndex).toBeLessThan(utilitiesIndex);
    // The Key spacing form is likewise outside the tools group.
    const utilitiesCloseIndex = row.lastIndexOf('</div>', spacingIndex);
    expect(utilitiesCloseIndex).toBeGreaterThan(utilitiesIndex);
    expect(utilitiesCloseIndex).toBeLessThan(spacingIndex);
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
    // The 34px band and 161px strip geometry stay intact (Plan 06 contract
    // with the user-approved Gap H-6 action-row relaxation).
    expect(actionRow).toContain('height: 34px');
    expect(getCssRuleBlock(styles, '.physics-paint-workflow-strip {')).toContain('height: 161px');
  });

  it('renders bottom-row tool labels lowercase by opting the icon buttons out of the global uppercase button rule', () => {
    const styles = css();
    // The global `button { text-transform: uppercase }` rule (studio chrome)
    // rendered the short labels as CAPS; the bottom-row icon buttons opt out.
    const button = getCssRuleBlock(styles, '.physics-paint-roto-key-icon-button {');
    expect(button).toContain('text-transform: none');
    // Source labels stay lowercase single words.
    const row = getActionRowBlock(source());
    for (const label of ['Key', 'Duplicate', 'Insert', 'Copy', 'Paste', 'Delete']) {
      expect(row).toContain(`<span class="physics-paint-roto-key-icon-label">${label}</span>`);
    }
  });

  it("renders the Key spacing submit as 'Apply' (not 'APPLY')", () => {
    const row = getActionRowBlock(source());
    expect(row).toContain('>Apply</button>');
    expect(row).not.toContain('>APPLY</button>');
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
    // The 34px band and 161px strip geometry stay intact (Plan 06 contract
    // with the user-approved Gap H-6 action-row relaxation).
    expect(getCssRuleBlock(styles, '.physics-paint-workflow-strip {')).toContain('height: 161px');
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
    // The lane geometry itself is untouched: derived 2160px width, 18px
    // abutting cells, 54px ticks.
    expect(getCssRuleBlock(styles, '.physics-paint-roto-cells {')).toContain('grid-template-columns: repeat(120, 18px)');
    const lane = getCssRuleBlock(styles, '.physics-paint-lane {');
    expect(lane).toContain('grid-template-columns: 2160px');
    expect(lane).not.toContain('padding-left');
    expect(getCssRuleBlock(styles, '.physics-paint-ruler {')).not.toContain('padding-left');
    expect(getCssRuleBlock(styles, '.physics-paint-ruler-tick {')).toContain('54px');
  });

  it('locks the user-approved 34px action-row band with a 161px band sum and every other Plan 06 band unchanged', () => {
    const styles = css();
    // UAT Gap H-6 (user-approved relaxation of the Plan 06 Fixed Layout
    // Contract): the action row grows 28px to 34px — the smallest height that
    // gives the 26px groups clear 4px top/bottom padding — so the band sum
    // becomes 46 + 1 + 28 + 38 + 34 + 14 = 161.
    expect(getCssRuleBlock(styles, '.physics-paint-workflow-header {')).toContain('height: 46px');
    expect(getCssRuleBlock(styles, '.physics-paint-ruler {')).toContain('height: 28px');
    expect(getCssRuleBlock(styles, '.physics-paint-lane {')).toContain('height: 38px');
    expect(getCssRuleBlock(styles, '.physics-paint-roto-action-row {')).toContain('height: 34px');
    expect(getCssRuleBlock(styles, '.physics-paint-timeline-scrollbar {')).toContain('height: 14px');
    expect(getCssRuleBlock(styles, '.physics-paint-workflow-strip {')).toContain('height: 161px');
    expect(getCssRuleBlock(styles, '.physics-paint-studio {')).toContain('grid-template-rows: minmax(58px, auto) minmax(0, 1fr) 161px');
    // No other height literal may grow: the retired 155px total is gone.
    expect(styles).not.toContain('height: 155px');
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
  it('adds 6px bottom padding to the action row without changing the 34px band or the 161px band sum', () => {
    const styles = css();
    const actionRow = getCssRuleBlock(styles, '.physics-paint-roto-action-row {');
    // UAT Gap I-1 (user's final polish round): padding-bottom: 6px on the
    // action-row div.
    expect(actionRow).toContain('padding-bottom: 6px');
    // The stylesheet sets box-sizing: border-box globally, so the padding
    // shrinks the content box instead of growing the band: the 34px band, the
    // 161px strip shell, and the studio grid third track stay intact.
    expect(actionRow).toContain('height: 34px');
    expect(getCssRuleBlock(styles, '.physics-paint-workflow-strip {')).toContain('height: 161px');
    expect(getCssRuleBlock(styles, '.physics-paint-studio {')).toContain('grid-template-rows: minmax(58px, auto) minmax(0, 1fr) 161px');
    expect(styles).not.toContain('height: 155px');
  });
});
