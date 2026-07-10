import { describe, expect, it } from 'vitest';
import type { PhysicPaintLaunchContext, PhysicPaintPlayRenderOptionsSnapshot, PhysicPaintRenderedFrame } from '../../types/physicPaint';
import {
  buildRotoToPlayConversionPayload,
  planPlayToRotoConversion,
  transitionPlayToRotoContext,
  transitionRotoToPlayContext,
} from './rotoPlayConversionTransactions';

const state = { version: 1, width: 100, height: 100, strokes: [], settings: {} } as never;
const options: PhysicPaintPlayRenderOptionsSnapshot = {
  tool: 'physics-paint', color: '#103c65', opacity: 100, brushSize: 6,
  background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45,
  motion: { strokeDeformation: 2, strokePosition: 3 },
};
const context = (overrides: Partial<PhysicPaintLaunchContext> = {}): PhysicPaintLaunchContext => ({
  operationId: 'launch-1', layerId: 'layer-1', startFrame: 4, workflowMode: 'roto',
  editableSource: 'roto', selectedPlayScriptId: 'selected-script', maxPlayFrameCount: 5,
  maxPlayFrameCountReason: 'Roto limit', cachedPlayFrames: [{ frameIndex: 0, appFrame: 4, dataUrl: 'old' }],
  previewFrame: 2,
  ...overrides,
});
const frame = (appFrame: number): PhysicPaintRenderedFrame => ({ frameIndex: appFrame - 4, appFrame, dataUrl: `frame-${appFrame}` });

describe('rotoPlayConversionTransactions', () => {
  it('rejects Play-to-Roto conversion until each requested source frame is cached', () => {
    expect(planPlayToRotoConversion({
      launchContext: context(), currentFrame: 4, requestedFrameCount: 2, latestFrames: [frame(4)], editableState: state, now: 42,
    })).toEqual({ type: 'missing-frames', message: 'Save or regenerate Play output before converting it to roto frames.' });
  });

  it('builds the exact Play-to-Roto operation and preserves expected frame ordering', () => {
    expect(planPlayToRotoConversion({
      launchContext: context(), currentFrame: 4, requestedFrameCount: 2, latestFrames: [frame(5), frame(4)], editableState: state, now: 42,
    })).toEqual({
      type: 'convert', expectedFrames: [4, 5], payload: {
        operationId: 'launch-1:convert-play-to-roto:42', kind: 'convert-play-to-roto', layerId: 'layer-1',
        startFrame: 4, frameCount: 2, frames: [frame(4), frame(5)], editableState: state,
      },
    });
  });

  it('builds Roto-to-Play payloads with selected script metadata and render settings', () => {
    expect(buildRotoToPlayConversionPayload({
      launchContext: context(), currentFrame: 6, requestedFrameCount: 3, editableState: state,
      playMotion: options.motion, renderOptions: options, now: 42,
    })).toEqual({
      operationId: 'launch-1:convert-roto-to-play:42', kind: 'convert-roto-to-play', layerId: 'layer-1',
      startFrame: 6, frameCount: 3, editableState: state, playScriptId: 'selected-script',
      playMotion: options.motion, renderOptions: options,
    });
  });

  it('moves conversion contexts without changing source/display cache entries', () => {
    const cachedRotoFrames = [{ ...frame(4), source: 'real-key' as const, sourceFrame: 4, displayFrame: 7 }];
    expect(transitionPlayToRotoContext({ context: context({ workflowMode: 'play', editableSource: 'play' }), cachedRotoFrames }))
      .toMatchObject({ workflowMode: 'play', editableSource: 'play', cachedRotoFrames });
    const next = transitionRotoToPlayContext({
      context: context(), startFrame: 6, frameCount: 3, playMotion: options.motion, renderOptions: options, cachedRotoFrames,
    });
    expect(next).toMatchObject({
      workflowMode: 'play', editableSource: 'play', startFrame: 6, playStartFrame: 6, playFrameCount: 3,
      selectedPlayScriptId: 'selected-script', playCacheStatus: 'stale', cachedPlayFrames: [], cachedRotoFrames,
      playMotion: options.motion, playRenderOptions: options, previewFrame: 0,
    });
    expect(next.maxPlayFrameCount).toBeUndefined();
    expect(next.maxPlayFrameCountReason).toBeUndefined();
  });
});
