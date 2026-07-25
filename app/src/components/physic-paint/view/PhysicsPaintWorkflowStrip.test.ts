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
function getKeyUtilitiesRowBlock(code: string): string {
  const rowStart = code.indexOf('physics-paint-roto-key-utilities');
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

const LOCKED_ICON_ACTIONS: ReadonlyArray<{ label: string; guard: string; handler: string }> = [
  { label: 'Insert key before', guard: 'canInsertRotoKey', handler: 'props.onInsertRotoFrame?.()' },
  { label: 'Duplicate key', guard: 'canDuplicateRotoKey', handler: 'props.onDuplicateRotoKey?.()' },
  { label: 'Copy key', guard: 'canCopyRotoKey', handler: 'props.onCopyRotoFrame?.()' },
  { label: 'Paste key', guard: 'canPasteRotoKey', handler: 'props.onPasteRotoFrame?.()' },
  { label: 'Delete key', guard: 'canDeleteRotoKey', handler: 'props.onDeleteRotoFrame?.()' },
  { label: 'Copy Script', guard: 'canCopyRotoScript', handler: 'props.onCopyRotoScript?.()' },
  { label: 'Apply Script', guard: 'canApplyRotoScript', handler: 'props.onApplyRotoScript?.()' },
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

  it('explains automatic real-key caching and generated render-only frames', () => {
    const code = source();
    expect(code).toContain('Completed real-key paint is cached automatically.');
    expect(code).toContain('Generated frame {frame} is render-only.');
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
    expect(code).toContain('Paste key — unavailable: ');
  });

  it('renders the Key {n} chip before any action button in the row (D-13)', () => {
    const row = getKeyUtilitiesRowBlock(source());
    const chipIndex = row.indexOf('physics-paint-roto-key-context');
    const firstButtonIndex = row.indexOf('<button');
    expect(chipIndex).toBeGreaterThanOrEqual(0);
    expect(firstButtonIndex).toBeGreaterThan(chipIndex);
  });

  it('renders the seven guarded icon actions in locked order (D-10)', () => {
    const row = getKeyUtilitiesRowBlock(source());
    const indices = LOCKED_ICON_ACTIONS.map(({ label }) => row.indexOf(`aria-label="${label}"`));
    indices.forEach((index) => expect(index).toBeGreaterThanOrEqual(0));
    for (let i = 1; i < indices.length; i += 1) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]);
    }
    expect(source()).toContain('BetweenVerticalStart');
    expect(source()).toContain('CopyPlus');
    expect(source()).toContain('ClipboardCopy');
    expect(source()).toContain('ClipboardPaste');
    expect(source()).toContain('Trash2');
    expect(source()).toMatch(/[^a-zA-Z]Clipboard[^a-zA-Z]/);
    expect(source()).toContain('ClipboardPen');
  });

  it('removes the seven text buttons and the Discard Script button from the row (D-11)', () => {
    const code = source();
    const row = getKeyUtilitiesRowBlock(code);
    for (const obsolete of ['>Insert</button>', '>Dup</button>', '>Copy</button>', '>Paste</button>', '>Delete</button>', '>Copy Script</button>', '>Apply Script</button>', '>Discard Script</button>']) {
      expect(row).not.toContain(obsolete);
    }
    expect(row).not.toContain('Discard Script');
    expect(row).not.toContain('physics-paint-roto-key-button"');
    expect(getWorkflowStripPropsInterface(code)).not.toContain('onDiscardRotoScript');
  });

  it('keeps every guarded action focusable without native disabled and guarded on click and keydown (D-12)', () => {
    const row = getKeyUtilitiesRowBlock(source());
    expect(row.replace(/aria-disabled/g, '')).not.toContain('disabled=');
    expect(row).not.toContain('title=');
    for (const { label, guard, handler } of LOCKED_ICON_ACTIONS) {
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

  it('carries the exact UI-SPEC tooltip copy with the two-part unavailable grammar on every action', () => {
    const code = source();
    const row = getKeyUtilitiesRowBlock(code);
    for (const { label } of LOCKED_ICON_ACTIONS) {
      expect(row).toContain(`${label} — unavailable: `);
    }
    expect(code).toContain('copyDisabledReason');
    expect(code).toContain('applyDisabledReason');
    expect(code).toContain('onCopyRotoScript');
    expect(code).toContain('onApplyRotoScript');
  });

  it('keeps generated frames non-editable and real cached frames selectable', () => {
    const code = source(); const map = getRotoMapBlock(code);
    expect(code).toContain("marker.source !== 'generated-interpolation'");
    expect(map).toContain("const isGenerated = semanticCell?.kind === 'generated'");
    expect(map).toContain("const isPhysicalRealKey = semanticCell?.kind === 'real'");
    expect(map).toContain('const dragEligible = isPhysicalRealKey && !rotoDragLocked;');
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
  it('declares the four header pill islands in D-01 order and keeps the mode label pill-free', () => {
    const header = getHeaderBlock(source());
    const navigationIndex = header.indexOf('physics-paint-pill--navigation');
    const interpolationIndex = header.indexOf('physics-paint-pill--interpolation');
    const playbackIndex = header.indexOf('physics-paint-pill--playback');
    const applySpacingIndex = header.indexOf('physics-paint-pill--apply-spacing');
    for (const index of [navigationIndex, interpolationIndex, playbackIndex, applySpacingIndex]) {
      expect(index).toBeGreaterThanOrEqual(0);
    }
    expect(interpolationIndex).toBeGreaterThan(navigationIndex);
    expect(playbackIndex).toBeGreaterThan(interpolationIndex);
    expect(applySpacingIndex).toBeGreaterThan(playbackIndex);
    const modeLabelBlock = header.slice(header.indexOf('physics-paint-mode-label'), header.lastIndexOf('<div', navigationIndex));
    expect(modeLabelBlock).not.toContain('physics-paint-pill');
  });

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
