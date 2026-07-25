import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintWorkflowStrip.tsx');
const source = () => readFileSync(sourcePath, 'utf8');

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
    expect(getWorkflowStripPropsInterface(code)).toContain('onDiscardRotoScript?: () => void');
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
    const row = getKeyUtilitiesRowBlock(source());
    for (const { label } of LOCKED_ICON_ACTIONS) {
      expect(row).toContain(`${label} — unavailable: `);
    }
    expect(row).toContain('copyDisabledReason');
    expect(row).toContain('applyDisabledReason');
    expect(row).toContain('onCopyRotoScript');
    expect(row).toContain('onApplyRotoScript');
  });

  it('keeps generated frames non-editable and real cached frames selectable', () => {
    const code = source(); const map = getRotoMapBlock(code);
    expect(code).toContain("marker.source !== 'generated-interpolation'");
    expect(map).toContain("const isGenerated = semanticCell?.kind === 'generated'");
    expect(map).toContain("const isPhysicalRealKey = semanticCell?.kind === 'real'");
    expect(map).toContain('const dragEligible = isPhysicalRealKey && !rotoDragLocked;');
  });
});
