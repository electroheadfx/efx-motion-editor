import { describe, expect, it, vi } from 'vitest';
import type { PhysicPaintLaunchContext, PhysicPaintRenderedFrame } from '../../../types/physicPaint';
import { buildPhysicsPaintDebugProof, createPhysicsPaintSessionController, type PhysicsPaintSessionControllerInput } from './usePhysicsPaintSessionController';

function makeContext(): PhysicPaintLaunchContext {
  return { operationId: 'operation-1', layerId: 'layer-1', startFrame: 4, width: 1000, height: 650, cachedRotoFrames: [] };
}

function makeFrame(): PhysicPaintRenderedFrame {
  return { frameIndex: 0, appFrame: 9, dataUrl: 'data:image/png;base64,AA==', width: 800, height: 520 };
}

function sessionHarness() {
  let locked = true;
  const engine = { save: vi.fn(() => ({ version: 1, strokes: [] })), load: vi.fn() };
  const input = {
    engine, canvasSize: { width: 800, height: 520 }, launchContext: makeContext(), currentFrame: 4,
    setLaunchContext: vi.fn(), setApplyStatus: vi.fn(), setApplyMessage: vi.fn(), setLastError: vi.fn(),
    isMutationLocked: () => locked,
  } as unknown as PhysicsPaintSessionControllerInput;
  const downloadState = vi.fn(async () => ({ status: 'saved' as const, message: 'Saved editable JSON state.' }));
  const reader = { readAsText: vi.fn(), onload: null, onerror: null, result: '' } as unknown as FileReader;
  const controller = createPhysicsPaintSessionController(input, { downloadState, createFileReader: () => reader });
  return { controller, engine, downloadState, reader, unlock: () => { locked = false; } };
}

describe('usePhysicsPaintSessionController helpers', () => {
  it('blocks Save and Load while mutation-locked and resumes immediately', async () => {
    const test = sessionHarness();
    const target = { files: [{ name: 'state.json' }], value: 'state.json' } as unknown as HTMLInputElement;
    await test.controller.saveEditableState();
    test.controller.loadEditableState({ target } as unknown as Event);
    expect(test.engine.save).not.toHaveBeenCalled();
    expect(test.downloadState).not.toHaveBeenCalled();
    expect(test.reader.readAsText).not.toHaveBeenCalled();
    test.unlock();
    await test.controller.saveEditableState();
    expect(test.engine.save).toHaveBeenCalledTimes(1);
    expect(test.downloadState).toHaveBeenCalledTimes(1);
    test.controller.loadEditableState({ target } as unknown as Event);
    expect(test.reader.readAsText).toHaveBeenCalledTimes(1);
  });

  it('retains captured still and manifest fields in debug proof exports', () => {
    const proof = buildPhysicsPaintDebugProof({ frame: makeFrame(), layerId: 'layer-1', operationId: 'operation-1:debug:1', fps: 24 });
    expect(proof.still).toMatchObject({ file: 'frame-0000.png', appFrame: 9, width: 800, height: 520, dataUrl: 'data:image/png;base64,AA==' });
    expect(proof.manifest).toMatchObject({ file: 'manifest.json', layerId: 'layer-1', startFrame: 9, frameCount: 1, fps: 24 });
  });
});
