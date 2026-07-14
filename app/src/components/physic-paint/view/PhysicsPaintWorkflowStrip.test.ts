import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintWorkflowStrip.tsx');
const workflowStateSourcePath = resolve(dirname(fileURLToPath(import.meta.url)), 'physicsPaintWorkflowPresentation.ts');
const source = () => readFileSync(sourcePath, 'utf8');
const workflowStateSource = () => readFileSync(workflowStateSourcePath, 'utf8');

function getRotoMapBlock(code: string): string {
  const mapStart = code.indexOf('{frameCells.map(frame =>');
  return code.slice(mapStart, code.indexOf('interpolationConnectors.map', mapStart));
}

function getWorkflowStripPropsInterface(code: string): string {
  return code.slice(code.indexOf('export interface PhysicsPaintWorkflowStripProps'), code.indexOf('const VIRTUAL_TIMELINE_FRAME_COUNT'));
}

describe('PhysicsPaintWorkflowStrip source contract', () => {
  it('renders the locked source label and preserves Play save controls', () => {
    const code = source();
    const state = workflowStateSource();
    expect(code).toContain('{getPhysicsPaintSourceLabel(props.mode)}');
    expect(state).toContain('Roto #1');
    expect(state).toContain('Play #2');
    expect(code).toContain('Render play');
    expect(code).toContain('onSavePlay');
  });

  it('removes manual Roto save, pending, saving, and retry UI', () => {
    const code = source();
    const props = getWorkflowStripPropsInterface(code);
    for (const obsolete of [
      'Save current',
      'Save pending',
      'onSaveRotoFrame',
      'onSavePendingRotoFrames',
      'pendingRotoFrames',
      'rotoSavingFrame',
      'rotoSaveInFlight',
      'Unsaved',
      'Saving frame',
    ]) expect(code).not.toContain(obsolete);
    expect(props).toContain('onSavePlay: () => void');
  });

  it('explains automatic real-key caching and generated render-only frames', () => {
    const code = source();
    expect(code).toContain('Completed real-key paint is cached automatically.');
    expect(code).toContain('Generated frame {frame} is render-only.');
    expect(workflowStateSource()).toContain("return mode === 'play' ? 'Save play' : 'Automatic cache'");
  });

  it('keeps real-key timeline, interpolation, onion, and key utility controls', () => {
    const code = source();
    expect(code).toContain('physics-paint-roto-cell');
    expect(code).toContain('physics-paint-roto-interpolation-connector');
    expect(code).toContain('onOnionChange');
    expect(code).toContain('onInsertRotoFrame');
    expect(code).toContain('onDeleteRotoFrame');
    expect(code).toContain('onCopyRotoFrame');
    expect(code).toContain('onPasteRotoFrame');
  });

  it('keeps generated frames non-editable and real cached frames selectable', () => {
    const code = source();
    const map = getRotoMapBlock(code);
    expect(code).toContain("marker.source !== 'generated-interpolation'");
    expect(map).toContain('const isDisplayRealKey = realCachedRotoFrameNumbers.includes(frame)');
    expect(map).toContain('isDisplayRealKey || isOccupiedFrame(displayOccupiedRotoFrames, frame)');
  });
});
