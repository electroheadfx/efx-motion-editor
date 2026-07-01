import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultTransform, type Layer } from '../types/layer';
import { layerStore } from '../stores/layerStore';
import { physicPaintStore } from '../stores/physicPaintStore';
import { projectStore } from '../stores/projectStore';
import { sequenceStore } from '../stores/sequenceStore';
import { timelineStore } from '../stores/timelineStore';
import type { PhysicPaintApplyPayload } from '../types/physicPaint';
import {
  applyPhysicPaintPayload,
  createPhysicPaintLaunchContext,
  handlePhysicPaintFrameSyncMessage,
  installPhysicPaintApplyListener,
  installPhysicPaintFrameSyncListener,
  openPhysicPaintCanvas,
  PHYSIC_PAINT_APPLY_EVENT,
  PHYSIC_PAINT_APPLY_RESULT_EVENT,
  PHYSIC_PAINT_LAUNCH_EVENT,
} from './physicPaintBridge';

const originalWindow = globalThis.window;

const editableState = {
  version: 2 as const,
  width: 1000,
  height: 650,
  strokes: [{
    tool: 'paint',
    pts: [[1, 2, 0.5, 0, 0, 0, 0] as [number, number, number, number, number, number, number]],
    color: '#103c65',
    params: { size: 6, opacity: 100, pressure: 70, waterAmount: 50, dryAmount: 30, edgeDetail: 4, pickup: 0, eraseStrength: 50, antiAlias: 0 },
    time: 123,
    diffusionFrames: 0,
  }],
  settings: { bgMode: 'canvas1', paperGrain: 'canvas1', embossStrength: 0.45, wetPaper: true },
};

const makeFrame = (frameIndex: number, appFrame: number) => ({
  frameIndex,
  appFrame,
  dataUrl: `data:image/png;base64,${btoa(`frame-${frameIndex}`)}`,
  width: 1000,
  height: 650,
});

const renderOptions = {
  tool: 'normal-paint' as const,
  color: '#103c65',
  opacity: 100,
  brushSize: 6,
  background: 'canvas1' as const,
  paperGrain: 'canvas1',
  grainStrength: 0.45,
  motion: { strokeDeformation: 10, strokePosition: 20 },
};

function applyCanvasPayload(overrides: Partial<PhysicPaintApplyPayload> = {}): PhysicPaintApplyPayload {
  return {
    kind: 'apply-canvas',
    operationId: 'apply-still-1',
    layerId: 'phys-layer-1',
    startFrame: 8,
    renderedFrame: makeFrame(0, 8),
    editableState,
    ...overrides,
  } as PhysicPaintApplyPayload;
}

function applySequencePayload(overrides: Partial<PhysicPaintApplyPayload> = {}): PhysicPaintApplyPayload {
  return {
    kind: 'apply-play-canvas',
    operationId: 'apply-seq-1',
    layerId: 'phys-layer-1',
    startFrame: 10,
    frameCount: 3,
    frames: [makeFrame(0, 10), makeFrame(1, 11), makeFrame(2, 12)],
    editableState,
    ...overrides,
  } as PhysicPaintApplyPayload;
}

function mockLayers(layers: Layer[]): void {
  vi.spyOn(layerStore.layers, 'peek').mockReturnValue(layers);
  vi.spyOn(layerStore.overlayLayers, 'peek').mockReturnValue([]);
}

function physicLayer(overrides: Partial<Layer> = {}): Layer {
  return {
    id: 'phys-layer-1',
    name: 'Physic Paint',
    type: 'physic-paint',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: defaultTransform(),
    source: { type: 'physic-paint', layerId: 'phys-layer-1' },
    ...overrides,
  };
}

describe('physicPaintBridge', () => {
  beforeEach(() => {
    physicPaintStore.reset();
    Object.defineProperty(globalThis, 'window', {
      value: {
        open: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        location: { origin: 'http://localhost:1420' },
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.doUnmock('@tauri-apps/api/core');
    vi.resetModules();
    projectStore.closeProject();
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  it('creates launch context with layer, frame, operation, and canvas dimensions', () => {
    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 12, { width: 1920, height: 1080 });

    expect(context).toMatchObject({
      layerId: 'phys-layer-1',
      layerName: 'Water smoke',
      startFrame: 12,
      width: 1920,
      height: 1080,
    });
    expect(context.operationId).toMatch(/^physic-paint-/);
  });

  it('creates launch context at engine-native dimensions when no canvas is provided', () => {
    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 12);

    expect(context).toMatchObject({
      layerId: 'phys-layer-1',
      layerName: 'Water smoke',
      startFrame: 12,
    });
    expect(context.width).toBeUndefined();
    expect(context.height).toBeUndefined();
    expect(context.operationId).toMatch(/^physic-paint-/);
  });

  it('hydrates every cached Roto frame summary into launch context', () => {
    physicPaintStore.upsertRealRotoKeyFrame('phys-layer-1', 8, makeFrame(0, 8));
    physicPaintStore.replaceGeneratedRotoCache('phys-layer-1', [{
      ...makeFrame(1, 9),
      source: 'generated-interpolation',
      nearestRealKeyFrame: 8,
    }], {
      enabled: true,
      inBetweenCount: 1,
      mode: 'duplicate',
      deform: 0,
      position: 0,
    });

    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 8, null, null, 'roto');

    expect(context).toMatchObject({
      workflowMode: 'roto',
      startFrame: 8,
      editableSource: 'roto',
    });
    expect(context.cachedRotoFrames).toEqual([
      expect.objectContaining({ appFrame: 8, source: 'real-key' }),
      expect.objectContaining({ appFrame: 9, source: 'generated-interpolation', nearestRealKeyFrame: 8 }),
    ]);
    expect(context.editableState).toBeUndefined();
    expect(context.rotoInterpolationSettings).toEqual({
      enabled: true,
      inBetweenCount: 1,
      mode: 'duplicate',
      deform: 0,
      position: 0,
    });
  });

  it('includes a defensive copy of persisted Roto paper metadata for standalone reopen', () => {
    const metadata = { background: 'canvas2' as const, paperGrain: 'canvas3', grainStrength: 0.65 };
    physicPaintStore.setRotoBackgroundMetadata('phys-layer-1', metadata);

    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 8, null, null, 'roto');

    expect(context).toMatchObject({
      workflowMode: 'roto',
      editableSource: 'roto',
      rotoBackground: metadata,
    });
    expect(context.rotoBackground).not.toBe(metadata);
  });

  it('does not attach stale layer-level editable state when reopening cached-only Roto frames', () => {
    physicPaintStore.applyCanvas(applyCanvasPayload({ startFrame: 1, renderedFrame: makeFrame(0, 1) }));
    physicPaintStore.applyCanvas(applyCanvasPayload({ operationId: 'apply-still-2', startFrame: 4, renderedFrame: makeFrame(0, 4) }));

    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 1, null, null, 'roto');

    expect(context.cachedRotoFrames?.map((frame) => frame.appFrame)).toEqual([1, 4]);
    expect(context.editableState).toBeUndefined();
  });

  it('treats hydrated Roto frames without metadata as real-key cached references for relaunch', () => {
    physicPaintStore.loadFromMceOutputs([{
      layer_id: 'phys-layer-1',
      frames: [makeFrame(0, 8)],
      workflow_mode: 'roto',
      editable_source: 'roto',
    }]);

    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 8, null, null, 'roto');

    expect(context.cachedRotoFrames).toEqual([
      expect.objectContaining({ appFrame: 8, source: 'real-key', dataUrl: makeFrame(0, 8).dataUrl }),
    ]);
    expect(context.editableState).toBeUndefined();
  });

  it('36.12 D-16 rejects generated-only Roto launch targets as render-only instead of redirecting to editable state', () => {
    physicPaintStore.upsertRealRotoKeyFrame('phys-layer-1', 12, makeFrame(0, 12));
    physicPaintStore.replaceGeneratedRotoCache('phys-layer-1', [{
      ...makeFrame(1, 13),
      source: 'generated-interpolation',
      nearestRealKeyFrame: 12,
    }], {
      enabled: true,
      inBetweenCount: 1,
      mode: 'blend',
      deform: 20,
      position: 30,
    });

    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 13, null, null, 'roto');

    expect(context).toMatchObject({
      requestedWorkflowMode: 'roto',
      workflowMode: 'roto',
      startFrame: 13,
      editableSource: 'roto',
    });
    expect(context.editableState).toBeUndefined();
    expect(context.maxPlayFrameCountReason).toBe('Generated frame 13 is render-only. Use timeline navigation or playback; edit a real Roto key to paint.');
    expect(context.cachedRotoFrames).toEqual(expect.arrayContaining([
      expect.objectContaining({ appFrame: 13, source: 'generated-interpolation', nearestRealKeyFrame: 12 }),
    ]));
  });

  it('opens the saved Play script containing the scrubber frame with relative preview frame', () => {
    physicPaintStore.upsertPlayScriptRange('phys-layer-1', {
      id: 'play-a',
      startFrame: 0,
      frameCount: 5,
      editableState,
      source: 'play',
      cacheStatus: 'cached',
    });
    physicPaintStore.upsertPlayScriptRange('phys-layer-1', {
      id: 'play-b',
      startFrame: 8,
      frameCount: 4,
      editableState,
      source: 'play',
      cacheStatus: 'cached',
      motion: { strokeDeformation: 12, strokePosition: 34 },
    });
    physicPaintStore.setFrame('phys-layer-1', 8, makeFrame(0, 8));
    physicPaintStore.setFrame('phys-layer-1', 9, makeFrame(1, 9));
    physicPaintStore.setFrame('phys-layer-1', 10, makeFrame(2, 10));
    physicPaintStore.setFrame('phys-layer-1', 11, makeFrame(3, 11));

    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 10);

    expect(context).toMatchObject({
      layerId: 'phys-layer-1',
      workflowMode: 'play',
      startFrame: 8,
      playStartFrame: 8,
      playFrameCount: 4,
      selectedPlayScriptId: 'play-b',
      playCacheStatus: 'cached',
      playMotion: { strokeDeformation: 12, strokePosition: 34 },
      previewFrame: 2,
      editableSource: 'play',
      editableState,
    });
    expect(context.cachedPlayFrames).toEqual([makeFrame(0, 8), makeFrame(1, 9), makeFrame(2, 10), makeFrame(3, 11)]);
    expect(context.maxPlayFrameCount).toBeUndefined();
  });

  it('opens Roto in a gap with a max Play frame count before the next saved script', () => {
    physicPaintStore.upsertPlayScriptRange('phys-layer-1', {
      id: 'play-b',
      startFrame: 8,
      frameCount: 4,
      editableState,
      source: 'play',
      cacheStatus: 'cached',
    });

    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 5, null, null, 'roto');

    expect(context).toMatchObject({
      layerId: 'phys-layer-1',
      requestedWorkflowMode: 'roto',
      workflowMode: 'roto',
      startFrame: 5,
      editableSource: 'roto',
      maxPlayFrameCount: 3,
    });
    expect(context.maxPlayFrameCountReason).toBe('Maximum Play duration from this frame: 3 frame(s), until the next saved script.');
    expect(context.selectedPlayScriptId).toBeUndefined();
    expect(context.playStartFrame).toBeUndefined();
    expect(context.playFrameCount).toBeUndefined();
  });

  it('opens explicit Roto at frame 11 before a saved script without auto-selecting the nearest range', () => {
    physicPaintStore.upsertPlayScriptRange('phys-layer-1', {
      id: 'play-b',
      startFrame: 12,
      frameCount: 4,
      editableState,
      source: 'play',
      cacheStatus: 'cached',
    });

    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 11, null, null, 'roto');

    expect(context).toMatchObject({
      requestedWorkflowMode: 'roto',
      workflowMode: 'roto',
      startFrame: 11,
      editableSource: 'roto',
      maxPlayFrameCount: 1,
      maxPlayFrameCountReason: 'Only frame 11 is available before the next saved script.',
    });
    expect(context.selectedPlayScriptId).toBeUndefined();
    expect(context.playStartFrame).toBeUndefined();
    expect(context.playFrameCount).toBeUndefined();
  });

  it('opens explicit Play creation at frame 11 before a saved script with a one-frame limit', () => {
    physicPaintStore.upsertPlayScriptRange('phys-layer-1', {
      id: 'play-b',
      startFrame: 12,
      frameCount: 4,
      editableState,
      source: 'play',
      cacheStatus: 'cached',
    });

    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 11, null, null, 'play');

    expect(context).toMatchObject({
      requestedWorkflowMode: 'play',
      workflowMode: 'play',
      startFrame: 11,
      playStartFrame: 11,
      playFrameCount: 1,
      editableSource: 'play',
      previewFrame: 0,
      maxPlayFrameCount: 1,
      maxPlayFrameCountReason: 'Only frame 11 is available before the next saved script.',
    });
    expect(context.selectedPlayScriptId).toBeUndefined();
  });

  it('opens explicit Play creation at frame 6 with two available frames between saved ranges', () => {
    physicPaintStore.upsertPlayScriptRange('phys-layer-1', {
      id: 'play-a',
      startFrame: 0,
      frameCount: 5,
      editableState,
      source: 'play',
      cacheStatus: 'cached',
    });
    physicPaintStore.upsertPlayScriptRange('phys-layer-1', {
      id: 'play-b',
      startFrame: 8,
      frameCount: 4,
      editableState,
      source: 'play',
      cacheStatus: 'cached',
    });

    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 6, null, null, 'play');

    expect(context).toMatchObject({
      requestedWorkflowMode: 'play',
      workflowMode: 'play',
      startFrame: 6,
      playStartFrame: 6,
      playFrameCount: 2,
      editableSource: 'play',
      previewFrame: 0,
      maxPlayFrameCount: 2,
      maxPlayFrameCountReason: 'Maximum Play duration from this frame: 2 frame(s), until the next saved script.',
    });
    expect(context.selectedPlayScriptId).toBeUndefined();
  });

  it('opens an empty Roto context outside saved Play ranges without leaking the last editable script', () => {
    physicPaintStore.applySequence(applySequencePayload({
      startFrame: 6,
      frameCount: 4,
      frames: [makeFrame(0, 6), makeFrame(1, 7), makeFrame(2, 8), makeFrame(3, 9)],
    }));

    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 0);

    expect(context).toMatchObject({
      layerId: 'phys-layer-1',
      workflowMode: 'roto',
      startFrame: 0,
      editableSource: 'roto',
      maxPlayFrameCount: 6,
    });
    expect(context.selectedPlayScriptId).toBeUndefined();
    expect(context.editableState).toBeUndefined();
  });

  it('opens explicit Play inside a saved range with the selected script and relative preview frame', () => {
    physicPaintStore.upsertPlayScriptRange('phys-layer-1', {
      id: 'play-b',
      startFrame: 8,
      frameCount: 13,
      editableState,
      source: 'play',
      cacheStatus: 'cached',
    });
    physicPaintStore.setFrame('phys-layer-1', 8, makeFrame(0, 8));
    physicPaintStore.setFrame('phys-layer-1', 11, makeFrame(3, 11));

    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 11, null, null, 'play');

    expect(context).toMatchObject({
      requestedWorkflowMode: 'play',
      workflowMode: 'play',
      startFrame: 8,
      playStartFrame: 8,
      playFrameCount: 13,
      selectedPlayScriptId: 'play-b',
      previewFrame: 3,
      editableSource: 'play',
      editableState,
    });
    expect(context.cachedPlayFrames).toEqual([makeFrame(0, 8), makeFrame(3, 11)]);
    expect(context.maxPlayFrameCount).toBeUndefined();
  });

  it('opens saved Play with a max duration before the next saved script after reopen', () => {
    physicPaintStore.upsertPlayScriptRange('phys-layer-1', {
      id: 'play-a',
      startFrame: 0,
      frameCount: 1,
      editableState,
      source: 'play',
      cacheStatus: 'cached',
    });
    physicPaintStore.upsertPlayScriptRange('phys-layer-1', {
      id: 'play-b',
      startFrame: 1,
      frameCount: 4,
      editableState,
      source: 'play',
      cacheStatus: 'cached',
    });

    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 0, null, null, 'play');

    expect(context).toMatchObject({
      requestedWorkflowMode: 'play',
      workflowMode: 'play',
      startFrame: 0,
      playStartFrame: 0,
      playFrameCount: 1,
      selectedPlayScriptId: 'play-a',
      maxPlayFrameCount: 1,
      maxPlayFrameCountReason: 'Only frame 0 is available before the next saved script.',
    });
  });

  it('opens saved Play with hydrated cached frames even when persisted range status is stale', () => {
    physicPaintStore.loadFromMceOutputs([{
      layer_id: 'phys-layer-1',
      frames: [makeFrame(0, 18), makeFrame(1, 19), makeFrame(2, 20)],
      editable_state: editableState,
      play_script_ranges: [{
        id: 'play-hydrated-stale',
        startFrame: 18,
        frameCount: 3,
        editableState,
        source: 'play',
        cacheStatus: 'stale',
      }],
      workflow_mode: 'play',
      play_start_frame: 18,
      play_frame_count: 3,
      editable_source: 'play',
    }]);

    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 19, null, null, 'play');

    expect(context).toMatchObject({
      requestedWorkflowMode: 'play',
      workflowMode: 'play',
      startFrame: 18,
      playStartFrame: 18,
      playFrameCount: 3,
      selectedPlayScriptId: 'play-hydrated-stale',
      playCacheStatus: 'cached',
      previewFrame: 1,
      editableSource: 'play',
      editableState,
    });
    expect(context.cachedPlayFrames).toEqual([makeFrame(0, 18), makeFrame(1, 19), makeFrame(2, 20)]);
  });

  it('keeps saved Play cache status missing when a hydrated range has incomplete frames', () => {
    physicPaintStore.loadFromMceOutputs([{
      layer_id: 'phys-layer-1',
      frames: [makeFrame(0, 18), makeFrame(2, 20)],
      editable_state: editableState,
      play_script_ranges: [{
        id: 'play-hydrated-incomplete',
        startFrame: 18,
        frameCount: 3,
        editableState,
        source: 'play',
        cacheStatus: 'cached',
      }],
      workflow_mode: 'play',
      play_start_frame: 18,
      play_frame_count: 3,
      editable_source: 'play',
    }]);

    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 19, null, null, 'play');

    expect(context).toMatchObject({
      workflowMode: 'play',
      selectedPlayScriptId: 'play-hydrated-incomplete',
      playCacheStatus: 'missing',
      previewFrame: 1,
    });
    expect(context.cachedPlayFrames).toEqual([makeFrame(0, 18), makeFrame(2, 20)]);
  });

  it('opens explicit Roto inside a saved range without auto-switching to Play', () => {
    physicPaintStore.upsertPlayScriptRange('phys-layer-1', {
      id: 'play-b',
      startFrame: 8,
      frameCount: 13,
      editableState,
      source: 'play',
      cacheStatus: 'cached',
    });

    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 11, null, null, 'roto');

    expect(context).toMatchObject({
      requestedWorkflowMode: 'roto',
      workflowMode: 'roto',
      startFrame: 11,
      editableSource: 'roto',
      maxPlayFrameCount: 0,
    });
    expect(context.selectedPlayScriptId).toBeUndefined();
    expect(context.playStartFrame).toBeUndefined();
    expect(context.playFrameCount).toBeUndefined();
  });

  it('opens Roto after the last saved range instead of choosing the nearest Play script', () => {
    physicPaintStore.upsertPlayScriptRange('phys-layer-1', {
      id: 'play-a',
      startFrame: 0,
      frameCount: 5,
      editableState,
      source: 'play',
      cacheStatus: 'cached',
    });
    physicPaintStore.upsertPlayScriptRange('phys-layer-1', {
      id: 'play-b',
      startFrame: 8,
      frameCount: 4,
      editableState,
      source: 'play',
      cacheStatus: 'cached',
    });

    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 14);

    expect(context).toMatchObject({
      workflowMode: 'roto',
      startFrame: 14,
      editableSource: 'roto',
    });
    expect(context.maxPlayFrameCount).toBeUndefined();
    expect(context.maxPlayFrameCountReason).toBeUndefined();
    expect(context.selectedPlayScriptId).toBeUndefined();
    expect(context.playStartFrame).toBeUndefined();
    expect(context.playFrameCount).toBeUndefined();
  });

  it('rejects non physics paint layers before opening a window', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const result = await openPhysicPaintCanvas({ layer: physicLayer({ type: 'paint', source: { type: 'paint', layerId: 'paint-1' } }), frame: 0 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('physic-paint');
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('PhysicPaintProperties open action passes the current editor frame, project size, and requested mode to the bridge', () => {
    const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../components/sidebar/PhysicPaintProperties.tsx'), 'utf8');
    const openHandlerSource = source.slice(source.indexOf('const handleOpenCanvas'), source.indexOf('};\n\n  return ('));

    expect(openHandlerSource).toContain('const currentFrame = timelineStore.currentFrame.value');
    expect(openHandlerSource).toContain('openPhysicPaintCanvas({');
    expect(openHandlerSource).toContain('frame: currentFrame');
    expect(openHandlerSource).toContain('width: projectStore.width.value');
    expect(openHandlerSource).toContain('height: projectStore.height.value');
    expect(openHandlerSource).toContain('requestedWorkflowMode: mode');
    const bridgeRequestSource = openHandlerSource.slice(openHandlerSource.indexOf('openPhysicPaintCanvas({'), openHandlerSource.indexOf('});', openHandlerSource.indexOf('openPhysicPaintCanvas({')));
    expect(bridgeRequestSource).toContain('canvas: {');
    expect(bridgeRequestSource).not.toContain('playStartFrame');
    expect(bridgeRequestSource).not.toContain('layer.startFrame');
  });

  it('uses browser fallback with encoded launch context when Tauri APIs are unavailable', async () => {
    const focus = vi.fn();
    const open = vi.spyOn(window, 'open').mockReturnValue({ focus } as unknown as Window);

    const result = await openPhysicPaintCanvas({ layer: physicLayer(), frame: 4, canvas: { width: 1280, height: 720 } });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.layerId).toBe('phys-layer-1');
      expect(result.data.startFrame).toBe(4);
    }
    expect(open).toHaveBeenCalledTimes(1);
    const url = String(open.mock.calls[0][0]);
    expect(url).toContain('/physics-paint');
    expect(url).toContain('context=');
    expect(focus).toHaveBeenCalled();
    open.mockRestore();
  });

  it('encodes the selected saved script launch context in the browser fallback URL', async () => {
    const focus = vi.fn();
    const open = vi.spyOn(window, 'open').mockReturnValue({ focus } as unknown as Window);
    physicPaintStore.upsertPlayScriptRange('phys-layer-1', {
      id: 'play-b',
      startFrame: 8,
      frameCount: 4,
      editableState,
      source: 'play',
      cacheStatus: 'cached',
    });
    physicPaintStore.setFrame('phys-layer-1', 8, makeFrame(0, 8));

    const result = await openPhysicPaintCanvas({ layer: physicLayer(), frame: 10, canvas: { width: 1280, height: 720 }, requestedWorkflowMode: 'play' });

    expect(result.ok).toBe(true);
    const url = String(open.mock.calls[0][0]);
    const parsed = new URL(url, 'http://localhost:1420');
    const context = JSON.parse(decodeURIComponent(parsed.searchParams.get('context') ?? ''));
    expect(context).toMatchObject({
      requestedWorkflowMode: 'play',
      workflowMode: 'play',
      startFrame: 8,
      playStartFrame: 8,
      playFrameCount: 4,
      selectedPlayScriptId: 'play-b',
      previewFrame: 2,
      editableSource: 'play',
    });
    expect(context.cachedPlayFrames).toEqual([makeFrame(0, 8)]);
    open.mockRestore();
  });

  it('encodes gap launch constraints in the browser fallback URL', async () => {
    const focus = vi.fn();
    const open = vi.spyOn(window, 'open').mockReturnValue({ focus } as unknown as Window);
    physicPaintStore.upsertPlayScriptRange('phys-layer-1', {
      id: 'play-b',
      startFrame: 8,
      frameCount: 4,
      editableState,
      source: 'play',
      cacheStatus: 'cached',
    });

    const result = await openPhysicPaintCanvas({ layer: physicLayer(), frame: 5, canvas: { width: 1280, height: 720 }, requestedWorkflowMode: 'roto' });

    expect(result.ok).toBe(true);
    const url = String(open.mock.calls[0][0]);
    const parsed = new URL(url, 'http://localhost:1420');
    const context = JSON.parse(decodeURIComponent(parsed.searchParams.get('context') ?? ''));
    expect(context).toMatchObject({
      requestedWorkflowMode: 'roto',
      workflowMode: 'roto',
      startFrame: 5,
      maxPlayFrameCount: 3,
      editableSource: 'roto',
    });
    expect(context.maxPlayFrameCountReason).toContain('next saved script');
    expect(context.selectedPlayScriptId).toBeUndefined();
    open.mockRestore();
  });

  it('rejects invalid launch contexts before opening a window', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);

    const result = await openPhysicPaintCanvas({
      layer: physicLayer({ source: { type: 'physic-paint', layerId: '' } }),
      frame: 4,
    });

    expect(result).toEqual({ ok: false, error: 'Invalid physics paint launch context' });
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('exports the launch event name for the Tauri path', () => {
    expect(PHYSIC_PAINT_LAUNCH_EVENT).toBe('physic-paint:launch');
  });

  it('does not fall back to browser open when native Tauri window command fails', async () => {
    Object.defineProperty(globalThis, 'window', {
      value: {
        ...window,
        open: vi.fn(),
        location: { origin: 'http://localhost:1420' },
      },
      writable: true,
      configurable: true,
    });
    vi.doMock('@tauri-apps/api/core', () => ({
      isTauri: () => true,
      invoke: vi.fn().mockRejectedValue(new Error('permission denied')),
    }));
    const { openPhysicPaintCanvas: openCanvas } = await import('./physicPaintBridge');

    const result = await openCanvas({ layer: physicLayer(), frame: 4 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('permission denied');
    expect(window.open).not.toHaveBeenCalled();
  });

  it('opens Tauri physics paint through the native command', async () => {
    const invoke = vi.fn().mockResolvedValue({
      label: 'efx-physic-paint',
      visibleBefore: false,
      minimizedBefore: false,
      visible: true,
      minimized: false,
    });
    Object.defineProperty(globalThis, 'window', {
      value: {
        ...window,
        open: vi.fn(),
        location: { origin: 'http://localhost:5173' },
      },
      writable: true,
      configurable: true,
    });
    vi.doMock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke }));
    const { openPhysicPaintCanvas: openCanvas } = await import('./physicPaintBridge');

    const result = await openCanvas({ layer: physicLayer(), frame: 4, requestedWorkflowMode: 'roto' });

    expect(result.ok).toBe(true);
    expect(invoke).toHaveBeenCalledWith('open_physics_paint_window', {
      context: expect.objectContaining({ layerId: 'phys-layer-1', startFrame: 4, requestedWorkflowMode: 'roto' }),
    });
    expect(window.open).not.toHaveBeenCalled();
  });

  it('reports native launch failure when the Tauri window remains hidden', async () => {
    const invoke = vi.fn().mockResolvedValue({
      label: 'efx-physic-paint',
      visibleBefore: false,
      minimizedBefore: false,
      visible: false,
      minimized: false,
    });
    Object.defineProperty(globalThis, 'window', {
      value: {
        ...window,
        open: vi.fn(),
        location: { origin: 'http://localhost:5173' },
      },
      writable: true,
      configurable: true,
    });
    vi.doMock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke }));
    const { openPhysicPaintCanvas: openCanvas } = await import('./physicPaintBridge');

    const result = await openCanvas({ layer: physicLayer(), frame: 4 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('did not become visible');
    expect(window.open).not.toHaveBeenCalled();
  });

  it('applies a still payload at the start frame and returns operation-matched success', () => {
    mockLayers([physicLayer()]);

    const result = applyPhysicPaintPayload(applyCanvasPayload());

    expect(result).toMatchObject({
      ok: true,
      operationId: 'apply-still-1',
      kind: 'apply-canvas',
      layerId: 'phys-layer-1',
      startFrame: 8,
      appliedFrameCount: 1,
    });
    expect(physicPaintStore.getFrame('phys-layer-1', 8)?.frameIndex).toBe(0);
    expect(physicPaintStore.getFrame('phys-layer-1', 9)).toBeNull();
    expect(physicPaintStore.getEditableState('phys-layer-1')?.strokes).toHaveLength(1);
  });

  it('applies explicit Roto background metadata from standalone saves into the parent app store', () => {
    mockLayers([physicLayer()]);

    const result = applyPhysicPaintPayload(applyCanvasPayload({
      operationId: 'apply-still-explicit-bg',
      editableState: { ...editableState, settings: { ...editableState.settings, bgMode: 'transparent' } },
      rotoBackground: { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 },
    }));

    expect(result).toMatchObject({ ok: true, operationId: 'apply-still-explicit-bg' });
    expect(physicPaintStore.getRotoBackgroundMetadata('phys-layer-1')).toEqual({ background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });
  });

  it('publishes generated Roto cache and settings through close/apply for parent preview/export', () => {
    mockLayers([physicLayer()]);

    const first = applyPhysicPaintPayload(applyCanvasPayload({
      operationId: 'apply-close-real-1',
      startFrame: 1,
      renderedFrame: makeFrame(0, 1),
    }));
    const second = applyPhysicPaintPayload(applyCanvasPayload({
      operationId: 'apply-close-real-4',
      startFrame: 4,
      renderedFrame: makeFrame(0, 4),
      closeWindowAfterApply: true,
    }));
    physicPaintStore.setRotoInterpolationSettings('phys-layer-1', { enabled: true, inBetweenCount: 2, mode: 'blend', deform: 20, position: 30 });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(physicPaintStore.getFrame('phys-layer-1', 2)).toEqual(expect.objectContaining({ appFrame: 2, source: 'generated-interpolation' }));
    expect(physicPaintStore.getFrame('phys-layer-1', 3)).toEqual(expect.objectContaining({ appFrame: 3, source: 'generated-interpolation' }));
    expect(physicPaintStore.toMceOutputs()[0]).toEqual(expect.objectContaining({
      roto_interpolation_settings: { enabled: true, inBetweenCount: 2, mode: 'blend', deform: 20, position: 30 },
      roto_cache_metadata: expect.arrayContaining([
        expect.objectContaining({ appFrame: 2, source: 'generated-interpolation', fromSourceFrame: 1, toSourceFrame: 4 }),
        expect.objectContaining({ appFrame: 3, source: 'generated-interpolation', fromSourceFrame: 1, toSourceFrame: 4 }),
      ]),
    }));
  });

  it('36.12 D-16 rejects generated interpolation apply-canvas targets before store mutation', () => {
    mockLayers([physicLayer()]);
    physicPaintStore.upsertRealRotoKeyFrame('phys-layer-1', 12, makeFrame(0, 12));
    physicPaintStore.replaceGeneratedRotoCache('phys-layer-1', [{
      ...makeFrame(1, 13),
      source: 'generated-interpolation',
      nearestRealKeyFrame: 12,
    }], {
      enabled: true,
      inBetweenCount: 1,
      mode: 'blend',
      deform: 20,
      position: 30,
    });
    const applyCanvas = vi.spyOn(physicPaintStore, 'applyCanvas');

    const result = applyPhysicPaintPayload(applyCanvasPayload({
      operationId: 'apply-generated-roto-target',
      startFrame: 13,
      renderedFrame: makeFrame(0, 13),
    }));

    expect(result).toMatchObject({
      ok: false,
      operationId: 'apply-generated-roto-target',
      appliedFrameCount: 0,
      error: 'Generated frame 13 is render-only. Use timeline navigation or playback; edit a real Roto key to paint.',
    });
    expect(applyCanvas).not.toHaveBeenCalled();
    expect(physicPaintStore.getRotoCacheFrames('phys-layer-1')).toEqual(expect.arrayContaining([
      expect.objectContaining({ appFrame: 13, source: 'generated-interpolation' }),
    ]));
  });

  it('applies a generated sequence beginning at the captured app start frame', () => {
    mockLayers([physicLayer()]);

    const result = applyPhysicPaintPayload(applySequencePayload());

    expect(result).toMatchObject({
      ok: true,
      operationId: 'apply-seq-1',
      kind: 'apply-play-canvas',
      layerId: 'phys-layer-1',
      startFrame: 10,
      appliedFrameCount: 3,
    });
    expect(physicPaintStore.getFrame('phys-layer-1', 10)?.frameIndex).toBe(0);
    expect(physicPaintStore.getFrame('phys-layer-1', 11)?.frameIndex).toBe(1);
    expect(physicPaintStore.getFrame('phys-layer-1', 12)?.frameIndex).toBe(2);
    expect(physicPaintStore.getFrame('phys-layer-1', 13)).toBeNull();
  });

  it('applies metadata-only Play render option updates without generated frames', () => {
    mockLayers([physicLayer()]);
    physicPaintStore.applySequence(applySequencePayload({ renderOptions, playMotion: renderOptions.motion }));
    const scriptId = physicPaintStore.getPlayScriptRanges('phys-layer-1')[0].id;

    const result = applyPhysicPaintPayload({
      kind: 'update-play-render-options',
      operationId: 'update-render-options-1',
      layerId: 'phys-layer-1',
      startFrame: 10,
      playScriptId: scriptId,
      renderOptions: { ...renderOptions, background: 'canvas2', brushSize: 3 },
    });

    expect(result).toMatchObject({ ok: true, kind: 'update-play-render-options', operationId: 'update-render-options-1' });
    expect(physicPaintStore.getFrame('phys-layer-1', 10)).toBeNull();
    expect(physicPaintStore.getPlayScriptRanges('phys-layer-1')[0]).toEqual(expect.objectContaining({
      cacheStatus: 'stale',
      renderOptions: expect.objectContaining({ background: 'canvas2', brushSize: 3 }),
    }));
  });

  it('routes apply payloads by physic-paint source id when the rendered layer id differs', () => {
    mockLayers([physicLayer({ id: 'render-layer-1', source: { type: 'physic-paint', layerId: 'phys-source-1' } })]);

    const result = applyPhysicPaintPayload(applySequencePayload({ operationId: 'apply-source-id-seq', layerId: 'phys-source-1' }));

    expect(result).toMatchObject({ ok: true, layerId: 'phys-source-1', appliedFrameCount: 3 });
    expect(physicPaintStore.getFrame('phys-source-1', 10)?.frameIndex).toBe(0);
    expect(physicPaintStore.getEditableState('phys-source-1')?.strokes).toHaveLength(1);
  });

  it('fails closed for invalid payloads before mutating the rendered store', () => {
    mockLayers([physicLayer()]);
    const applyCanvas = vi.spyOn(physicPaintStore, 'applyCanvas');
    const applySequence = vi.spyOn(physicPaintStore, 'applySequence');

    const result = applyPhysicPaintPayload({
      kind: 'apply-canvas',
      operationId: 'bad-op',
      layerId: 'phys-layer-1',
      startFrame: 8,
      renderedFrame: { ...makeFrame(0, 99), appFrame: 99 },
    });

    expect(result.ok).toBe(false);
    expect(result.operationId).toBe('bad-op');
    expect(result.appliedFrameCount).toBe(0);
    expect(physicPaintStore.getFrame('phys-layer-1', 8)).toBeNull();
    expect(applyCanvas).not.toHaveBeenCalled();
    expect(applySequence).not.toHaveBeenCalled();
  });

  it('fails closed for unknown and non-physic-paint target layers', () => {
    mockLayers([physicLayer({ id: 'paint-layer', type: 'paint', source: { type: 'paint', layerId: 'paint-layer' } })]);

    const unknown = applyPhysicPaintPayload(applyCanvasPayload({ layerId: 'missing-layer' }));
    const wrongType = applyPhysicPaintPayload(applyCanvasPayload({ layerId: 'paint-layer' }));

    expect(unknown.ok).toBe(false);
    expect(unknown.error).toContain('Unknown');
    expect(wrongType.ok).toBe(false);
    expect(wrongType.error).toContain('Unknown');
    expect(physicPaintStore.hasOutput('missing-layer')).toBe(false);
    expect(physicPaintStore.hasOutput('paint-layer')).toBe(false);
  });

  it('accepts hydrated physic-paint layers whose runtime source id falls back to the layer id', () => {
    const hydratedLayer = physicLayer({
      id: 'hydrated-runtime-layer',
      source: { type: 'physic-paint' } as Layer['source'],
    });
    mockLayers([hydratedLayer]);

    const result = applyPhysicPaintPayload(applyCanvasPayload({
      operationId: 'hydrated-runtime-fallback-op',
      layerId: 'hydrated-runtime-layer',
    }));

    expect(result).toMatchObject({
      ok: true,
      operationId: 'hydrated-runtime-fallback-op',
      layerId: 'hydrated-runtime-layer',
      appliedFrameCount: 1,
    });
    expect(physicPaintStore.getFrame('hydrated-runtime-layer', 8)?.dataUrl).toContain('data:image/png');
  });

  it('reuses serialized physics paint outputs until rendered output changes', () => {
    physicPaintStore.applySequence(applySequencePayload());

    const first = physicPaintStore.toMceOutputs();
    const second = physicPaintStore.toMceOutputs();

    expect(second).toBe(first);
    expect(physicPaintStore._debugCachedSerializationRevision()).toBe(physicPaintStore._debugSerializationRevision());

    physicPaintStore.applyCanvas(applyCanvasPayload({ startFrame: 20, renderedFrame: makeFrame(0, 20) }));
    const third = physicPaintStore.toMceOutputs();

    expect(third).not.toBe(first);
    expect(third[0].frames).toEqual(expect.arrayContaining([expect.objectContaining({ appFrame: 20 })]));
  });

  it('persists and hydrates physic-paint source layer ids for apply validation', () => {
    const layer = physicLayer({ id: 'hydrated-phys-layer', source: { type: 'physic-paint', layerId: 'hydrated-phys-layer' } });
    sequenceStore.add({
      id: 'seq-physic-paint',
      kind: 'fx',
      name: 'Physics paint sequence',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [layer],
      inFrame: 0,
      outFrame: 24,
    });

    physicPaintStore.applyCanvas(applyCanvasPayload({ layerId: 'hydrated-phys-layer', startFrame: 12, renderedFrame: makeFrame(0, 12) }) as Extract<PhysicPaintApplyPayload, { kind: 'apply-canvas' }>);

    const serialized = projectStore.buildMceProject();
    const serializedLayer = serialized.sequences[0].layers?.[0];
    expect(serializedLayer?.source).toMatchObject({
      type: 'physic-paint',
      layer_id: 'hydrated-phys-layer',
    });
    expect(serialized.physic_paint_outputs).toEqual([
      expect.objectContaining({
        layer_id: 'hydrated-phys-layer',
        frames: [expect.objectContaining({ appFrame: 12 })],
        editable_state: expect.objectContaining({ strokes: expect.any(Array) }),
        workflow_mode: 'roto',
        editable_source: 'roto',
      }),
    ]);

    projectStore.closeProject();
    projectStore.hydrateFromMce(serialized, '/tmp/efx-physic-paint-test');
    const hydratedLayer = sequenceStore.sequences.peek()[0]?.layers[0];
    expect(hydratedLayer?.source).toEqual({ type: 'physic-paint', layerId: 'hydrated-phys-layer' });
    expect(physicPaintStore.getFrame('hydrated-phys-layer', 12)?.dataUrl).toContain('data:image/png');
    expect(physicPaintStore.getEditableState('hydrated-phys-layer')?.strokes).toHaveLength(1);

    mockLayers([hydratedLayer as Layer]);
    const result = applyPhysicPaintPayload(applyCanvasPayload({ layerId: 'hydrated-phys-layer' }));

    expect(result.ok).toBe(true);
    expect(result).toMatchObject({
      operationId: 'apply-still-1',
      layerId: 'hydrated-phys-layer',
      appliedFrameCount: 1,
    });
  });

  it('rejects engine internals before store mutation', () => {
    mockLayers([physicLayer()]);
    const applyCanvas = vi.spyOn(physicPaintStore, 'applyCanvas');

    const result = applyPhysicPaintPayload({ ...applyCanvasPayload(), engine: {} });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Invalid');
    expect(applyCanvas).not.toHaveBeenCalled();
  });

  it('deduplicates duplicate successful delivery for the same operation id', () => {
    mockLayers([physicLayer()]);
    const applyCanvas = vi.spyOn(physicPaintStore, 'applyCanvas');
    const payload = applyCanvasPayload({ operationId: 'dedupe-op' });

    const first = applyPhysicPaintPayload(payload);
    const second = applyPhysicPaintPayload(payload);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.appliedFrameCount).toBe(1);
    expect(applyCanvas).toHaveBeenCalledTimes(1);
  });

  it('closes the native physics paint window from the main apply listener after close-save payload succeeds', async () => {
    vi.resetModules();
    let listener: ((event: { payload: unknown }) => Promise<void>) | undefined;
    const emit = vi.fn().mockResolvedValue(undefined);
    const emitTo = vi.fn().mockResolvedValue(undefined);
    const destroy = vi.fn().mockResolvedValue(undefined);
    vi.doMock('@tauri-apps/api/core', () => ({ isTauri: () => true }));
    vi.doMock('@tauri-apps/api/event', () => ({
      listen: vi.fn(async (_event: string, handler: (event: { payload: unknown }) => Promise<void>) => {
        listener = handler;
        return vi.fn();
      }),
      emit,
      emitTo,
    }));
    vi.doMock('@tauri-apps/api/window', () => ({
      Window: { getByLabel: vi.fn(async () => ({ destroy })) },
    }));
    Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true });
    const [{ layerStore: dynamicLayerStore }, { physicPaintStore: dynamicPhysicPaintStore }, { installPhysicPaintApplyListener: installListener }] = await Promise.all([
      import('../stores/layerStore'),
      import('../stores/physicPaintStore'),
      import('./physicPaintBridge'),
    ]);
    dynamicPhysicPaintStore.reset();
    vi.spyOn(dynamicLayerStore.layers, 'peek').mockReturnValue([physicLayer()]);
    vi.spyOn(dynamicLayerStore.overlayLayers, 'peek').mockReturnValue([]);

    await installListener();
    await listener?.({ payload: applyCanvasPayload({ operationId: 'close-save-op', closeWindowAfterApply: true }) });

    expect(emitTo).toHaveBeenCalledWith('efx-physic-paint', PHYSIC_PAINT_APPLY_RESULT_EVENT, expect.objectContaining({ ok: true, operationId: 'close-save-op' }));
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('installs browser fallback listener that dispatches exactly one apply-result event', async () => {
    mockLayers([physicLayer()]);
    let listener: ((event: CustomEvent) => void) | undefined;
    vi.spyOn(window, 'addEventListener').mockImplementation((event, cb) => {
      if (event === PHYSIC_PAINT_APPLY_EVENT) listener = cb as (event: CustomEvent) => void;
    });
    const remove = vi.spyOn(window, 'removeEventListener');
    const dispatch = vi.spyOn(window, 'dispatchEvent').mockReturnValue(true);

    const cleanup = await installPhysicPaintApplyListener();
    listener?.(new CustomEvent(PHYSIC_PAINT_APPLY_EVENT, { detail: applyCanvasPayload({ operationId: 'listener-op' }) }));

    expect(dispatch).toHaveBeenCalledTimes(1);
    const resultEvent = dispatch.mock.calls[0][0] as CustomEvent;
    expect(resultEvent.type).toBe(PHYSIC_PAINT_APPLY_RESULT_EVENT);
    expect(resultEvent.detail).toMatchObject({
      ok: true,
      operationId: 'listener-op',
      kind: 'apply-canvas',
      layerId: 'phys-layer-1',
      startFrame: 8,
      appliedFrameCount: 1,
    });

    cleanup();
    expect(remove).toHaveBeenCalledWith(PHYSIC_PAINT_APPLY_EVENT, expect.any(Function));
    expect(remove).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('replies to browser fallback postMessage apply payloads through the child source', async () => {
    mockLayers([physicLayer()]);
    let listener: ((event: MessageEvent) => void) | undefined;
    const child = { postMessage: vi.fn() };
    vi.spyOn(window, 'addEventListener').mockImplementation((event, cb) => {
      if (event === 'message') listener = cb as (event: MessageEvent) => void;
    });
    const dispatch = vi.spyOn(window, 'dispatchEvent').mockReturnValue(true);

    await installPhysicPaintApplyListener();
    listener?.({
      origin: 'http://localhost:1420',
      data: { type: PHYSIC_PAINT_APPLY_EVENT, payload: applyCanvasPayload({ operationId: 'message-op' }) },
      source: child as unknown as MessageEventSource,
    } as MessageEvent);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(child.postMessage).toHaveBeenCalledWith({
      type: PHYSIC_PAINT_APPLY_RESULT_EVENT,
      payload: expect.objectContaining({ ok: true, operationId: 'message-op', appliedFrameCount: 1 }),
    }, 'http://localhost:1420');
  });

  it('includes persisted Play workflow metadata in the encoded browser launch context', async () => {
    const focus = vi.fn();
    const open = vi.spyOn(window, 'open').mockReturnValue({ focus } as unknown as Window);
    physicPaintStore.applySequence(applySequencePayload({
      startFrame: 18,
      frameCount: 3,
      frames: [makeFrame(0, 18), makeFrame(1, 19), makeFrame(2, 20)],
    }));

    const result = await openPhysicPaintCanvas({ layer: physicLayer(), frame: 19, canvas: { width: 1280, height: 720 }, fps: 30 });

    expect(result.ok).toBe(true);
    const url = String(open.mock.calls[0][0]);
    const parsed = new URL(url, 'http://localhost:1420');
    const context = JSON.parse(decodeURIComponent(parsed.searchParams.get('context') ?? ''));
    expect(context.fps).toBe(30);
    expect(context.workflowMode).toBe('play');
    expect(context.startFrame).toBe(18);
    expect(context.playStartFrame).toBe(18);
    expect(context.playFrameCount).toBe(3);
    expect(context.editableSource).toBe('play');
    open.mockRestore();
  });

  it('omits invalid fps so the standalone route can use its internal fallback', async () => {
    const focus = vi.fn();
    const open = vi.spyOn(window, 'open').mockReturnValue({ focus } as unknown as Window);

    const result = await openPhysicPaintCanvas({ layer: physicLayer(), frame: 4, fps: 0 });

    expect(result.ok).toBe(true);
    const url = String(open.mock.calls[0][0]);
    const parsed = new URL(url, 'http://localhost:1420');
    const context = JSON.parse(decodeURIComponent(parsed.searchParams.get('context') ?? ''));
    expect(context.fps).toBeUndefined();
    open.mockRestore();
  });

  it('handles valid D-26 frame-sync messages by seeking and ensuring visibility', () => {
    const seek = vi.spyOn(timelineStore, 'seek');
    const ensureFrameVisible = vi.spyOn(timelineStore, 'ensureFrameVisible');

    const handled = handlePhysicPaintFrameSyncMessage({ type: 'physic-paint:seek-frame', frame: 12 });

    expect(handled).toBe(true);
    expect(seek).toHaveBeenCalledWith(12);
    expect(ensureFrameVisible).toHaveBeenCalledWith(12);
  });

  it('rejects invalid D-26 frame-sync frames before mutating the timeline', () => {
    const seek = vi.spyOn(timelineStore, 'seek');
    const ensureFrameVisible = vi.spyOn(timelineStore, 'ensureFrameVisible');

    for (const frame of [undefined, -1, 1.5, Infinity, '12']) {
      expect(handlePhysicPaintFrameSyncMessage({ type: 'physic-paint:seek-frame', frame })).toBe(false);
    }
    expect(handlePhysicPaintFrameSyncMessage({ type: 'other', frame: 12 })).toBe(false);

    expect(seek).not.toHaveBeenCalled();
    expect(ensureFrameVisible).not.toHaveBeenCalled();
  });

  it('installs a browser message listener for D-26 frame sync and removes it on cleanup', () => {
    let listener: ((event: MessageEvent) => void) | undefined;
    vi.spyOn(window, 'addEventListener').mockImplementation((event, cb) => {
      if (event === 'message') listener = cb as (event: MessageEvent) => void;
    });
    const remove = vi.spyOn(window, 'removeEventListener');
    const seek = vi.spyOn(timelineStore, 'seek');
    const ensureFrameVisible = vi.spyOn(timelineStore, 'ensureFrameVisible');

    const cleanup = installPhysicPaintFrameSyncListener(window);
    listener?.(new MessageEvent('message', { data: { type: 'physic-paint:seek-frame', frame: 7 } }));

    expect(seek).toHaveBeenCalledWith(7);
    expect(ensureFrameVisible).toHaveBeenCalledWith(7);

    cleanup();
    expect(remove).toHaveBeenCalledWith('message', expect.any(Function));
  });
});
