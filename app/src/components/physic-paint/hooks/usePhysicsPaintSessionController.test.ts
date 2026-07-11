import { describe, expect, it } from 'vitest';
import type { PhysicPaintLaunchContext, PhysicPaintRenderedFrame } from '../../../types/physicPaint';
import { buildPhysicsPaintDebugProof, makeLoadedPlayLaunchContext } from './usePhysicsPaintSessionController';

function makeContext(overrides: Partial<PhysicPaintLaunchContext> = {}): PhysicPaintLaunchContext {
  return {
    operationId: 'operation-1',
    layerId: 'layer-1',
    startFrame: 4,
    width: 1000,
    height: 650,
    workflowMode: 'roto',
    editableSource: 'roto',
    cachedRotoFrames: [],
    maxPlayFrameCount: 12,
    maxPlayFrameCountReason: 'Roto timing limit',
    ...overrides,
  };
}

function makeFrame(): PhysicPaintRenderedFrame {
  return {
    frameIndex: 0,
    appFrame: 9,
    dataUrl: 'data:image/png;base64,AA==',
    width: 800,
    height: 520,
  };
}

describe('usePhysicsPaintSessionController helpers', () => {
  it('turns a loaded editable state into a stale Play context and removes Roto limits', () => {
    const context = makeLoadedPlayLaunchContext(makeContext(), 6, 2);

    expect(context).toMatchObject({
      workflowMode: 'play',
      editableSource: 'play',
      playFrameCount: 6,
      playCacheStatus: 'stale',
      cachedPlayFrames: [],
      previewFrame: 2,
    });
    expect(context.maxPlayFrameCount).toBeUndefined();
    expect(context.maxPlayFrameCountReason).toBeUndefined();
  });

  it('retains captured still and manifest fields in debug proof exports', () => {
    const proof = buildPhysicsPaintDebugProof({
      frame: makeFrame(),
      layerId: 'layer-1',
      operationId: 'operation-1:debug:1',
      fps: 24,
    });

    expect(proof.still).toMatchObject({
      file: 'frame-0000.png',
      appFrame: 9,
      width: 800,
      height: 520,
      dataUrl: 'data:image/png;base64,AA==',
    });
    expect(proof.manifest).toMatchObject({
      file: 'manifest.json',
      layerId: 'layer-1',
      operationId: 'operation-1:debug:1',
      startFrame: 9,
      frameCount: 1,
      fps: 24,
      canvas: { width: 800, height: 520 },
      frames: [{ frameIndex: 0, appFrame: 9, file: 'frame-0000.png', width: 800, height: 520 }],
    });
  });
});
