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

  it('keeps distinct Copy Script and Apply Script controls immediately after Delete', () => {
    const code = source();
    const deleteIndex = code.indexOf('>Delete</button>');
    const copyScriptIndex = code.indexOf('>Copy Script</button>');
    const applyScriptIndex = code.indexOf('>Apply Script</button>');
    expect(copyScriptIndex).toBeGreaterThan(deleteIndex);
    expect(applyScriptIndex).toBeGreaterThan(copyScriptIndex);
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
