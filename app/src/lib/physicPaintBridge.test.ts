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
    });

    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 10);

    expect(context).toMatchObject({
      layerId: 'phys-layer-1',
      workflowMode: 'play',
      startFrame: 8,
      playStartFrame: 8,
      playFrameCount: 4,
      selectedPlayScriptId: 'play-b',
      previewFrame: 2,
      editableSource: 'play',
      editableState,
    });
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

    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 5);

    expect(context).toMatchObject({
      layerId: 'phys-layer-1',
      workflowMode: 'roto',
      startFrame: 5,
      editableSource: 'roto',
      maxPlayFrameCount: 3,
    });
    expect(context.maxPlayFrameCountReason).toContain('before the next saved Play script');
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
      maxPlayFrameCount: 600,
    });
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

  it('PhysicPaintProperties open action passes the current editor scrubber frame to the bridge', () => {
    const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../components/sidebar/PhysicPaintProperties.tsx'), 'utf8');
    const openHandlerSource = source.slice(source.indexOf('const currentFrame = timelineStore.currentFrame.value'), source.indexOf('};\n\n  return ('));

    expect(openHandlerSource).toContain('const currentFrame = timelineStore.currentFrame.value');
    expect(openHandlerSource).toContain('openPhysicPaintCanvas({');
    expect(openHandlerSource).toContain('frame: currentFrame');
    expect(openHandlerSource).not.toContain('playStartFrame');
    expect(openHandlerSource).not.toContain('layer.startFrame');
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

    const result = await openPhysicPaintCanvas({ layer: physicLayer(), frame: 10, canvas: { width: 1280, height: 720 } });

    expect(result.ok).toBe(true);
    const url = String(open.mock.calls[0][0]);
    const parsed = new URL(url, 'http://localhost:1420');
    const context = JSON.parse(decodeURIComponent(parsed.searchParams.get('context') ?? ''));
    expect(context).toMatchObject({
      workflowMode: 'play',
      startFrame: 8,
      playStartFrame: 8,
      playFrameCount: 4,
      selectedPlayScriptId: 'play-b',
      previewFrame: 2,
      editableSource: 'play',
    });
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

    const result = await openPhysicPaintCanvas({ layer: physicLayer(), frame: 5, canvas: { width: 1280, height: 720 } });

    expect(result.ok).toBe(true);
    const url = String(open.mock.calls[0][0]);
    const parsed = new URL(url, 'http://localhost:1420');
    const context = JSON.parse(decodeURIComponent(parsed.searchParams.get('context') ?? ''));
    expect(context).toMatchObject({
      workflowMode: 'roto',
      startFrame: 5,
      maxPlayFrameCount: 3,
      editableSource: 'roto',
    });
    expect(context.maxPlayFrameCountReason).toContain('before the next saved Play script');
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

    const result = await openCanvas({ layer: physicLayer(), frame: 4 });

    expect(result.ok).toBe(true);
    expect(invoke).toHaveBeenCalledWith('open_physics_paint_window', {
      context: expect.objectContaining({ layerId: 'phys-layer-1', startFrame: 4 }),
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
