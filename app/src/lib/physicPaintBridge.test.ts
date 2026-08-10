import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultTransform, type Layer } from '../types/layer';
import type { AudioTrack } from '../types/audio';
import { audioStore } from '../stores/audioStore';
import { layerStore } from '../stores/layerStore';
import { physicPaintStore, registerRotoAlphaCanvasFrame, rotoPhysicalRevision } from '../stores/physicPaintStore';
import { projectStore } from '../stores/projectStore';
import { sequenceStore } from '../stores/sequenceStore';
import { timelineStore } from '../stores/timelineStore';
import type { PhysicPaintApplyPayload, PhysicPaintRotoPhysicalEditIntent } from '../types/physicPaint';
import {
  PHYSIC_PAINT_ROTO_INCOMING_INTERPOLATION_BREAK_KEY_IDS_EMPTY,
  buildPhysicPaintRotoPhysicalRevision,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import { resolvePhysicPaintRotoPhysicalEdit } from '../components/physic-paint/roto/physicsPaintRotoPhysicalResolver';
import { hydrateRotoPhysicalLaunchContext } from '../components/physic-paint/roto/rotoLaunchHydration';
import {
  applyPhysicPaintPayload,
  createPhysicPaintLaunchContext,
  handlePhysicPaintFrameSyncMessage,
  installPhysicPaintApplyListener,
  installPhysicPaintAudioContextPublisher,
  installPhysicPaintAudioOwnershipListener,
  installPhysicPaintFrameSyncListener,
  isPhysicPaintChildAudioClaimed,
  openPhysicPaintCanvas,
  PHYSIC_PAINT_APPLY_EVENT,
  PHYSIC_PAINT_APPLY_RESULT_EVENT,
  PHYSIC_PAINT_AUDIO_CONTEXT_EVENT,
  PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT,
  PHYSIC_PAINT_AUDIO_PLAYBACK_STATE_EVENT,
  PHYSIC_PAINT_LAUNCH_EVENT,
  publishPhysicPaintAudioPlaybackState,
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

const makePhysicalRecord = (keyId: string, appFrame: number) => ({
  keyId,
  appFrame,
  kind: 'real-key' as const,
  payload: {
    frameIndex: 0,
    appFrame,
    dataUrl: `data:image/png;base64,${btoa(`frame-${appFrame}`)}`,
    width: 1000,
    height: 650,
  },
});

const movePhysicalRecord = (
  record: ReturnType<typeof makePhysicalRecord>,
  appFrame: number,
) => ({
  ...record,
  appFrame,
  payload: { ...record.payload, appFrame },
});

const TRANSPARENT_ONE_PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XfM0WQAAAABJRU5ErkJggg==';
const OPAQUE_ONE_PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nH0AAAAASUVORK5CYII=';

function makeEmptySegmentRecord(
  keyId: string,
  appFrame: number,
  dataUrl = TRANSPARENT_ONE_PIXEL_PNG,
) {
  return {
    keyId,
    appFrame,
    payload: {
      frameIndex: 0,
      appFrame,
      dataUrl,
      width: 1,
      height: 1,
    },
  };
}

function seedPhysicalDocument(
  layerId: string,
  records: ReturnType<typeof makePhysicalRecord>[],
  interpolation: { enabled: boolean; mode: 'duplicate' | 'blend' } = { enabled: false, mode: 'duplicate' },
  incomingInterpolationBreakKeyIds: readonly string[] = PHYSIC_PAINT_ROTO_INCOMING_INTERPOLATION_BREAK_KEY_IDS_EMPTY,
): void {
  const result = physicPaintStore.replaceRotoPhysicalDocument(layerId, {
    capacity: 600,
    realKeyRecords: records,
    interpolation,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: records[0]?.appFrame ?? 0,
    revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, [], incomingInterpolationBreakKeyIds),
    incomingInterpolationBreakKeyIds,
  });
  if (!result.ok) throw new Error(result.error);
}

function installCanonicalBlankCanvas(): void {
  vi.stubGlobal('document', {
    createElement: (tagName: string) => {
      if (tagName.toLowerCase() !== 'canvas') throw new Error(`Unexpected element request: ${tagName}`);
      return {
        width: 0,
        height: 0,
        toDataURL: () => TRANSPARENT_ONE_PIXEL_PNG,
      } as unknown as HTMLCanvasElement;
    },
  });
}



function applyCanvasPayload(overrides: Partial<PhysicPaintApplyPayload> = {}): PhysicPaintApplyPayload {
  return {
    kind: 'apply-canvas',
    operationId: `apply-still-${crypto.randomUUID()}`,
    layerId: 'phys-layer-1',
    startFrame: 8,
    renderedFrame: makeFrame(0, 8),
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

function makeAudioTrack(overrides: Partial<AudioTrack> = {}): AudioTrack {
  return {
    id: 'audio-1',
    audioAssetId: 'asset-1',
    name: 'Kick',
    filePath: '/Volumes/media/audio/kick.wav',
    relativePath: 'audio/kick.wav',
    originalFilename: 'kick.wav',
    offsetFrame: 48,
    inFrame: 0,
    outFrame: 240,
    volume: 0.8,
    muted: false,
    fadeInFrames: 0,
    fadeOutFrames: 0,
    fadeInCurve: 'exponential',
    fadeOutCurve: 'exponential',
    sampleRate: 48000,
    duration: 10,
    channelCount: 2,
    order: 0,
    trackHeight: 44,
    slipOffset: 0,
    totalFramesInFile: 240,
    bpm: null,
    beatOffsetFrames: 0,
    beatMarkers: [],
    showBeatMarkers: false,
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

  it('propagates the presentation workflow label without replacing the persisted layer name', () => {
    const context = createPhysicPaintLaunchContext(
      physicLayer({ name: 'Water smoke' }),
      12,
      null,
      null,
      'PPaint #2',
    );

    expect(context.workflowLabel).toBe('PPaint #2');
    expect(context.layerName).toBe('Water smoke');
  });

  it('hydrates every cached Roto frame summary into launch context', () => {
    seedPhysicalDocument('phys-layer-1', [makePhysicalRecord('key-8', 8), makePhysicalRecord('key-10', 10)], { enabled: true, mode: 'duplicate' });

    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 8, null, null);

    expect(context).toMatchObject({ startFrame: 8 });
    expect(context.rotoPhysical).toEqual(expect.objectContaining({
      cursorAppFrame: 8,
      selectedKeyId: 'key-8',
      interpolationEnabled: true,
      interpolationMode: 'duplicate',
    }));
    expect(context.rotoPhysical?.records).toEqual([
      expect.objectContaining({ keyId: 'key-8', appFrame: 8 }),
      expect.objectContaining({ keyId: 'key-10', appFrame: 10 }),
    ]);
    expect(context.editableState).toBeUndefined();
  });

  it('retains the complete physical document through close sync and child reopen hydration', async () => {
    mockLayers([physicLayer()]);
    const records = [
      makeEmptySegmentRecord('key-0', 0, OPAQUE_ONE_PIXEL_PNG),
      makeEmptySegmentRecord('key-16', 16, OPAQUE_ONE_PIXEL_PNG),
      makeEmptySegmentRecord('key-32', 32),
    ].map((record) => ({ ...record, kind: 'real-key' as const }));
    const interpolation = { enabled: true, mode: 'duplicate' as const };
    const loopClips = [{
      loopId: 'loop-1',
      placementStart: 40,
      sourceKeyIds: ['key-0', 'key-16'],
      repeat: 2,
      mode: 'progressive' as const,
    }];
    const incomingInterpolationBreakKeyIds = ['key-32'];
    const seeded = physicPaintStore.replaceRotoPhysicalDocument('phys-layer-1', {
      capacity: 64,
      realKeyRecords: records,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: 'key-32',
      cursorAppFrame: 32,
      revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips, incomingInterpolationBreakKeyIds),
      loopClips,
      incomingInterpolationBreakKeyIds,
    });
    expect(seeded.ok).toBe(true);

    const closeSync = applyPhysicPaintPayload(applyCanvasPayload({
      operationId: 'close-sync-key-32',
      startFrame: 32,
      renderedFrame: { frameIndex: 0, appFrame: 32, dataUrl: TRANSPARENT_ONE_PIXEL_PNG, width: 1, height: 1 },
      closeWindowAfterApply: true,
    }));
    expect(closeSync.ok).toBe(true);
    expect(physicPaintStore.getRotoPhysicalRenderSource('phys-layer-1', 31)).toBeNull();
    expect(physicPaintStore.getRotoPhysicalRenderSource('phys-layer-1', 1)).toEqual(expect.objectContaining({ kind: 'generated' }));
    const parentRasterBeforeReopen = physicPaintStore.getRotoPhysicalRenderSource('phys-layer-1', 1);
    expect(parentRasterBeforeReopen).toEqual(expect.objectContaining({ kind: 'generated', appFrame: 1 }));

    const launch = createPhysicPaintLaunchContext(physicLayer(), 32);
    for (const record of records) {
      registerRotoAlphaCanvasFrame(record.payload.dataUrl, { width: 1, height: 1 } as HTMLCanvasElement);
    }
    const reopened = await hydrateRotoPhysicalLaunchContext(launch, physicPaintStore);

    if (!reopened.ok) throw new Error(reopened.error);
    expect(reopened.ok).toBe(true);
    expect(reopened.document).toMatchObject({
      realKeyRecords: records,
      interpolation,
      selectedKeyId: 'key-32',
      cursorAppFrame: 32,
      loopClips,
      incomingInterpolationBreakKeyIds,
    });
    expect(physicPaintStore.getRotoPhysicalRenderSource('phys-layer-1', 1)).toEqual(parentRasterBeforeReopen);
    expect(physicPaintStore.getRotoPhysicalRenderSource('phys-layer-1', 31)).toBeNull();
  });

  it('includes a defensive copy of persisted Roto paper metadata for standalone reopen', () => {
    const metadata = { background: 'canvas2' as const, paperGrain: 'canvas3', grainStrength: 0.65 };
    physicPaintStore.setRotoBackgroundMetadata('phys-layer-1', metadata);

    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 8, null, null);

    expect(context.rotoPhysical?.background).toEqual(metadata);
    expect(context.rotoPhysical?.background).not.toBe(metadata);
  });

  it('does not attach stale layer-level editable state when reopening cached-only Roto frames', () => {
    physicPaintStore.applyCanvas(applyCanvasPayload({ startFrame: 1, renderedFrame: makeFrame(0, 1) }));
    physicPaintStore.applyCanvas(applyCanvasPayload({ operationId: 'apply-still-2', startFrame: 4, renderedFrame: makeFrame(0, 4) }));

    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 1, null, null);

    expect(context).toMatchObject({ startFrame: 1 });
    expect(context.rotoPhysical?.records).toEqual([]);
    expect(context.editableState).toBeUndefined();
  });

  it('36.12 D-16 rejects generated-only Roto launch targets as render-only instead of redirecting to editable state', () => {
    seedPhysicalDocument('phys-layer-1', [makePhysicalRecord('key-12', 12), makePhysicalRecord('key-14', 14)], { enabled: true, mode: 'duplicate' });

    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 13, null, null);

    expect(context).toMatchObject({ startFrame: 13 });
    expect(context.editableState).toBeUndefined();
    expect(context.rotoPhysical).toEqual(expect.objectContaining({
      cursorAppFrame: 13,
      selectedKeyId: null,
      interpolationEnabled: true,
    }));
    expect(context.rotoPhysical?.records.map((record) => record.appFrame)).toEqual([12, 14]);
  });












  it('rejects non physics paint layers before opening a window', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const result = await openPhysicPaintCanvas({ layer: physicLayer({ type: 'paint', source: { type: 'paint', layerId: 'paint-1' } }), frame: 0 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('physic-paint');
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });


  it('uses browser fallback with encoded launch context when Tauri APIs are unavailable', async () => {
    const focus = vi.fn();
    const open = vi.spyOn(window, 'open').mockReturnValue({ focus } as unknown as Window);

    const result = await openPhysicPaintCanvas({
      layer: physicLayer({ name: 'Water smoke' }),
      frame: 4,
      canvas: { width: 1280, height: 720 },
      workflowLabel: ' PPaint #3 ',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.layerId).toBe('phys-layer-1');
      expect(result.data.layerName).toBe('Water smoke');
      expect(result.data.workflowLabel).toBe('PPaint #3');
      expect(result.data.startFrame).toBe(4);
    }
    expect(open).toHaveBeenCalledTimes(1);
    const url = String(open.mock.calls[0][0]);
    expect(url).toContain('/physics-paint');
    expect(url).toContain('context=');
    const parsed = new URL(url, 'http://localhost:1420');
    const context = JSON.parse(decodeURIComponent(parsed.searchParams.get('context') ?? ''));
    expect(context).toMatchObject({ layerName: 'Water smoke', workflowLabel: 'PPaint #3' });
    expect(focus).toHaveBeenCalled();
    open.mockRestore();
  });



  it('rejects invalid launch contexts before opening a window', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);

    const result = await openPhysicPaintCanvas({
      layer: physicLayer({ source: { type: 'physic-paint', layerId: '' } }),
      frame: 4,
    });

    expect(result).toEqual({ ok: false, error: 'Could not open physics paint canvas: Error: Could not construct a canonical physical launch context.' });
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('exports the launch event name for the Tauri path', () => {
    expect(PHYSIC_PAINT_LAUNCH_EVENT).toBe('physic-paint:launch');
  });

  it('exports the audio context event name for the push channel (D-01/D-02)', () => {
    expect(PHYSIC_PAINT_AUDIO_CONTEXT_EVENT).toBe('physic-paint:audio-context');
  });

  it('exports the audio playback-state and ownership event names (41-04, D-05)', () => {
    expect(PHYSIC_PAINT_AUDIO_PLAYBACK_STATE_EVENT).toBe('physic-paint:audio-playback-state');
    expect(PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT).toBe('physic-paint:audio-ownership');
  });

  it('publishes the main playback state with the project-context publish shape (D-05)', async () => {
    await publishPhysicPaintAudioPlaybackState(true);
    const dispatch = window.dispatchEvent as ReturnType<typeof vi.fn>;
    const events = dispatch.mock.calls
      .map(([event]) => event)
      .filter((event): event is CustomEvent => event instanceof CustomEvent && event.type === PHYSIC_PAINT_AUDIO_PLAYBACK_STATE_EVENT);
    expect(events.length).toBe(1);
    expect(events[0].detail).toEqual({ playing: true });
  });

  it('records child ownership claim/release in the main-side gate signal (D-05 symmetric guard)', async () => {
    const unlisten = await installPhysicPaintAudioOwnershipListener();
    try {
      const addListener = window.addEventListener as ReturnType<typeof vi.fn>;
      const custom = addListener.mock.calls.find(([name]) => name === PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT)?.[1] as (event: Event) => void;
      const message = addListener.mock.calls.find(([name]) => name === 'message')?.[1] as (event: MessageEvent) => void;
      expect(typeof custom).toBe('function');
      expect(typeof message).toBe('function');
      expect(isPhysicPaintChildAudioClaimed()).toBe(false);
      custom(new CustomEvent(PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT, { detail: { claim: true } }));
      expect(isPhysicPaintChildAudioClaimed()).toBe(true);
      // Origin-checked postMessage path: a foreign origin is ignored.
      message({ origin: 'https://foreign.example', data: { type: PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT, payload: { claim: false } } } as MessageEvent);
      expect(isPhysicPaintChildAudioClaimed()).toBe(true);
      message({ origin: 'http://localhost:1420', data: { type: PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT, payload: { claim: false } } } as MessageEvent);
      expect(isPhysicPaintChildAudioClaimed()).toBe(false);
      // Invalid payloads are ignored (state unchanged).
      custom(new CustomEvent(PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT, { detail: { claim: 'yes' } }));
      expect(isPhysicPaintChildAudioClaimed()).toBe(false);
    } finally {
      unlisten();
    }
  });

  it('a fresh child launch clears any stale audio claim left by a previous window (D-05 lifecycle)', async () => {
    const unlisten = await installPhysicPaintAudioOwnershipListener();
    try {
      const addListener = window.addEventListener as ReturnType<typeof vi.fn>;
      const custom = addListener.mock.calls.find(([name]) => name === PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT)?.[1] as (event: Event) => void;
      custom(new CustomEvent(PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT, { detail: { claim: true } }));
      expect(isPhysicPaintChildAudioClaimed()).toBe(true);
      const open = vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
      const result = await openPhysicPaintCanvas({ layer: physicLayer(), frame: 4 });
      expect(result.ok).toBe(true);
      expect(isPhysicPaintChildAudioClaimed()).toBe(false);
      open.mockRestore();
    } finally {
      unlisten();
    }
  });

  it('(1) publishes a revisioned audio context push on every tracks change with strictly increasing revisions (D-02)', () => {
    const dispose = installPhysicPaintAudioContextPublisher();
    try {
      const dispatch = window.dispatchEvent as ReturnType<typeof vi.fn>;
      const audioPublishes = () => dispatch.mock.calls
        .map(([event]) => event)
        .filter((event): event is CustomEvent => event instanceof CustomEvent && event.type === PHYSIC_PAINT_AUDIO_CONTEXT_EVENT);
      // The effect publishes once on install with the current (empty) state —
      // the revision counter absorbs frequency; no debounce may skip state.
      expect(audioPublishes().length).toBe(1);
      audioStore.tracks.value = [makeAudioTrack()];
      audioStore.tracks.value = [makeAudioTrack(), makeAudioTrack({ id: 'audio-2', order: 1 })];
      const publishes = audioPublishes();
      expect(publishes.length).toBe(3);
      const revisions = publishes.map((event) => (event.detail as { revision: number }).revision);
      expect(revisions[1]).toBeGreaterThan(revisions[0]);
      expect(revisions[2]).toBeGreaterThan(revisions[1]);
      // The latest publish carries the full rebuilt section (D-02).
      expect((publishes[2].detail as { tracks: unknown[] }).tracks.length).toBe(2);
    } finally {
      dispose();
      audioStore.tracks.value = [];
    }
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

  it('rejects an unrelated valid Insert Slot document before parent mutation', async () => {
    const layer = physicLayer();
    mockLayers([layer]);
    const currentRecords = [
      makePhysicalRecord('A', 1),
      makePhysicalRecord('B', 3),
      makePhysicalRecord('C', 5),
      makePhysicalRecord('D', 10),
    ];
    seedPhysicalDocument(layer.id, currentRecords, { enabled: true, mode: 'duplicate' }, ['C']);
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const launch = await openPhysicPaintCanvas({ layer, frame: 3 });

    expect(launch.ok).toBe(true);
    if (!launch.ok || !launch.data.rotoPhysical) return;
    const beforeDocument = physicPaintStore.getRotoPhysicalDocument(layer.id);
    const beforeRevisionSignal = rotoPhysicalRevision.peek();
    const replace = vi.spyOn(physicPaintStore, 'replaceRotoPhysicalDocument');
    const canonicalRecords = [
      movePhysicalRecord(currentRecords[0], 1),
      movePhysicalRecord(currentRecords[1], 4),
      movePhysicalRecord(currentRecords[2], 6),
      movePhysicalRecord(currentRecords[3], 11),
    ].map(({ kind: _kind, ...record }) => record);

    const result = applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      operationId: 'reject-unrelated-insert-slot-document',
      operationKind: 'insert-slot',
      intent: { kind: 'insert-slot', selectedKeyId: 'B' },
      layerId: layer.id,
      startFrame: 3,
      launchOperationId: launch.data.operationId,
      expectedRevision: launch.data.rotoPhysical.revision,
      records: canonicalRecords,
      interpolationEnabled: true,
      interpolationMode: 'duplicate',
      loopClips: [],
      incomingInterpolationBreakKeyIds: ['C'],
      selectedKeyId: 'A',
      selectedAppFrame: 1,
    });

    expect(result.ok).toBe(false);
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id)).toEqual(beforeDocument);
    expect(rotoPhysicalRevision.peek()).toBe(beforeRevisionSignal);
    expect(replace).not.toHaveBeenCalled();
  });

  it('rejects changed ordinary intent before cached success lookup', async () => {
    const layer = physicLayer();
    mockLayers([layer]);
    const currentRecords = [
      makePhysicalRecord('A', 1),
      makePhysicalRecord('B', 3),
      makePhysicalRecord('C', 5),
      makePhysicalRecord('D', 10),
    ];
    seedPhysicalDocument(layer.id, currentRecords);
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const launch = await openPhysicPaintCanvas({ layer, frame: 3 });

    expect(launch.ok).toBe(true);
    if (!launch.ok || !launch.data.rotoPhysical) return;
    const records = [
      movePhysicalRecord(currentRecords[0], 1),
      movePhysicalRecord(currentRecords[1], 4),
      movePhysicalRecord(currentRecords[2], 6),
      movePhysicalRecord(currentRecords[3], 11),
    ].map(({ kind: _kind, ...record }) => record);
    const payload = {
      kind: 'replace-roto-physical-map' as const,
      operationId: 'intent-aware-insert-slot-dedupe',
      operationKind: 'insert-slot' as const,
      intent: { kind: 'insert-slot' as const, selectedKeyId: 'B' },
      layerId: layer.id,
      startFrame: 3,
      launchOperationId: launch.data.operationId,
      expectedRevision: launch.data.rotoPhysical.revision,
      records,
      interpolationEnabled: false,
      interpolationMode: 'duplicate' as const,
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
      selectedKeyId: 'B',
      selectedAppFrame: 4,
    };
    const first = applyPhysicPaintPayload(payload);
    expect(first.ok).toBe(true);
    const acceptedDocument = physicPaintStore.getRotoPhysicalDocument(layer.id);
    const acceptedRevisionSignal = rotoPhysicalRevision.peek();
    const replace = vi.spyOn(physicPaintStore, 'replaceRotoPhysicalDocument');

    const changedIntent = applyPhysicPaintPayload({
      ...payload,
      intent: { kind: 'insert-slot', selectedKeyId: 'A' },
    });

    expect(changedIntent).toMatchObject({
      ok: false,
      operationId: payload.operationId,
      error: 'Operation ID was already used for a different payload.',
    });
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id)).toEqual(acceptedDocument);
    expect(rotoPhysicalRevision.peek()).toBe(acceptedRevisionSignal);
    expect(replace).not.toHaveBeenCalled();
  });

  it('parent-recomputes every ordinary physical mapping before publication', async () => {
    installCanonicalBlankCanvas();
    const layer = physicLayer();
    mockLayers([layer]);
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    type PhysicalMapPayload = Extract<PhysicPaintApplyPayload, { kind: 'replace-roto-physical-map' }>;
    const baseline = [
      makePhysicalRecord('A', 1),
      makePhysicalRecord('B', 3),
      makePhysicalRecord('C', 5),
      makePhysicalRecord('D', 10),
    ];
    const blank = makeEmptySegmentRecord('blank-7', 7).payload;
    const pasteGroupEntries = [
      { payload: baseline[0].payload, sourceAppFrame: 1, sourceKeyId: 'A', newKeyId: 'paste-A' },
      { payload: baseline[2].payload, sourceAppFrame: 5, sourceKeyId: 'C', newKeyId: 'paste-C' },
    ] as const;
    const cases: readonly {
      readonly intent: PhysicPaintRotoPhysicalEditIntent;
      readonly diverge: (payload: PhysicalMapPayload) => PhysicalMapPayload;
    }[] = [
      {
        intent: { kind: 'insert-empty-segment', destinationAppFrame: 7, insertedKeyId: 'blank-7', blankPayload: blank },
        diverge: (payload) => ({ ...payload, selectedKeyId: 'A', selectedAppFrame: 1 }),
      },
      {
        intent: { kind: 'delete-key', selectedKeyId: 'B' },
        diverge: (payload) => ({
          ...payload,
          loopClips: [{ loopId: 'unrelated-delete-loop', placementStart: 20, sourceKeyIds: ['A', 'C'], repeat: 2, mode: 'static' }],
        }),
      },
      {
        intent: { kind: 'delete-key-group', keyIds: ['B', 'C'] },
        diverge: (payload) => ({ ...payload, incomingInterpolationBreakKeyIds: [] }),
      },
      {
        intent: { kind: 'move-key', movedKeyId: 'B', target: { kind: 'after-key', targetKeyId: 'C' } },
        diverge: (payload) => ({ ...payload, selectedKeyId: 'A', selectedAppFrame: 1 }),
      },
      {
        intent: { kind: 'move-key-group', movedKeyIds: ['B', 'C'], grabbedKeyId: 'B', target: { kind: 'physical-cell', appFrame: 7 } },
        diverge: (payload) => ({
          ...payload,
          records: payload.records.map((record) => record.keyId === 'A'
            ? { ...record, appFrame: 0, payload: { ...record.payload, appFrame: 0 } }
            : record),
        }),
      },
      {
        intent: { kind: 'force-spacing', emptyFrames: 2, selectedKeyId: null },
        diverge: (payload) => ({ ...payload, selectedKeyId: 'A', selectedAppFrame: 1 }),
      },
      {
        intent: { kind: 'duplicate-key', sourceKeyId: 'A', newKeyId: 'duplicate-A' },
        diverge: (payload) => ({
          ...payload,
          loopClips: [{ loopId: 'unrelated-duplicate-loop', placementStart: 20, sourceKeyIds: ['A', 'duplicate-A'], repeat: 2, mode: 'static' }],
        }),
      },
      {
        intent: { kind: 'paste-key', destinationAppFrame: 3, destinationKeyId: 'B', newKeyId: null, clipboardPayload: baseline[0].payload },
        diverge: (payload) => ({ ...payload, incomingInterpolationBreakKeyIds: [] }),
      },
      {
        intent: { kind: 'paste-key-group', destinationAppFrame: 12, entries: pasteGroupEntries },
        diverge: (payload) => ({
          ...payload,
          loopClips: [{ loopId: 'unrelated-group-paste-loop', placementStart: 20, sourceKeyIds: ['paste-A', 'paste-C'], repeat: 2, mode: 'static' }],
        }),
      },
    ];

    for (const { intent, diverge } of cases) {
      physicPaintStore.reset();
      seedPhysicalDocument(layer.id, baseline, { enabled: false, mode: 'duplicate' }, ['D']);
      const launch = await openPhysicPaintCanvas({ layer, frame: 3 });
      expect(launch.ok, intent.kind).toBe(true);
      if (!launch.ok || !launch.data.rotoPhysical) throw new Error(`${intent.kind} launch must resolve`);
      const resolution = resolvePhysicPaintRotoPhysicalEdit({
        identities: baseline.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
        records: baseline,
        intent,
        capacity: launch.data.rotoPhysical.capacity,
        interpolationEnabled: false,
        loopClips: [],
        incomingInterpolationBreakKeyIds: ['D'],
      });
      expect(resolution.ok, intent.kind).toBe(true);
      if (!resolution.ok) throw new Error(`${intent.kind} must resolve canonically`);
      const proposal = resolution.proposal;
      const canonicalRecords = (proposal.nextRecords ?? proposal.orderedKeyIds.map((keyId) => {
        const current = baseline.find((record) => record.keyId === keyId);
        const appFrame = proposal.mapping.get(keyId);
        if (!current || appFrame === undefined) throw new Error(`Missing canonical ${intent.kind} record`);
        return movePhysicalRecord(current, appFrame);
      })).map(({ kind: _kind, ...record }) => record);
      const canonicalLoopClips = proposal.nextLoopClips ?? [];
      const canonicalBreaks = proposal.nextIncomingInterpolationBreakKeyIds ?? ['D'];
      const payload = {
        kind: 'replace-roto-physical-map',
        operationId: `ordinary-parent-gate-${intent.kind}`,
        operationKind: intent.kind,
        intent,
        layerId: layer.id,
        startFrame: proposal.selectedAppFrame ?? 0,
        launchOperationId: launch.data.operationId,
        expectedRevision: launch.data.rotoPhysical.revision,
        records: canonicalRecords,
        interpolationEnabled: false,
        interpolationMode: 'duplicate',
        loopClips: canonicalLoopClips,
        incomingInterpolationBreakKeyIds: canonicalBreaks,
        selectedKeyId: proposal.selectedKeyId,
        selectedAppFrame: proposal.selectedAppFrame,
        ...(proposal.semanticDelta ? { semanticDelta: proposal.semanticDelta } : {}),
      } as PhysicalMapPayload;
      const beforeDocument = physicPaintStore.getRotoPhysicalDocument(layer.id);
      const beforeRevisionSignal = rotoPhysicalRevision.peek();
      const replace = vi.spyOn(physicPaintStore, 'replaceRotoPhysicalDocument');

      const rejected = applyPhysicPaintPayload(diverge(payload));

      expect(rejected.ok, `${intent.kind} divergent proposal`).toBe(false);
      expect(physicPaintStore.getRotoPhysicalDocument(layer.id), intent.kind).toEqual(beforeDocument);
      expect(rotoPhysicalRevision.peek(), intent.kind).toBe(beforeRevisionSignal);
      expect(replace, intent.kind).not.toHaveBeenCalled();

      const accepted = applyPhysicPaintPayload(payload);
      const duplicateDelivery = applyPhysicPaintPayload(payload);

      expect(accepted.ok, `${intent.kind} canonical proposal`).toBe(true);
      expect(duplicateDelivery, intent.kind).toEqual(accepted);
      expect(replace, intent.kind).toHaveBeenCalledTimes(1);
      expect(physicPaintStore.getRotoPhysicalDocument(layer.id)).toMatchObject({
        realKeyRecords: canonicalRecords.map((record) => ({ kind: 'real-key', ...record })),
        loopClips: canonicalLoopClips,
        incomingInterpolationBreakKeyIds: canonicalBreaks,
        selectedKeyId: proposal.selectedKeyId,
        interpolation: { enabled: false, mode: 'duplicate' },
      });
      replace.mockRestore();
    }
  });

  it('rejects replay of an equal-revision command from another project context without mutation or publication', async () => {
    const layer = physicLayer();
    mockLayers([layer]);
    const records = [
      makePhysicalRecord('A', 0),
      makePhysicalRecord('B', 10),
    ];
    seedPhysicalDocument(layer.id, records);
    projectStore.projectContextId.value = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const launchA = await openPhysicPaintCanvas({ layer, frame: 10 });

    expect(launchA.ok).toBe(true);
    if (!launchA.ok || !launchA.data.rotoPhysical) return;
    const accepted = applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      operationId: 'project-A-command',
      operationKind: 'move-key',
      intent: {
        kind: 'move-key',
        movedKeyId: 'B',
        target: { kind: 'physical-cell', appFrame: 10 },
      },
      layerId: layer.id,
      startFrame: 10,
      launchOperationId: launchA.data.operationId,
      projectContextId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      expectedRevision: launchA.data.rotoPhysical.revision,
      records: launchA.data.rotoPhysical.records,
      interpolationEnabled: false,
      interpolationMode: 'duplicate',
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
      selectedKeyId: 'B',
      selectedAppFrame: 10,
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok || !('acceptedRevision' in accepted)) return;

    projectStore.projectContextId.value = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const launchB = await openPhysicPaintCanvas({ layer, frame: 10 });
    expect(launchB.ok).toBe(true);
    if (!launchB.ok || !launchB.data.rotoPhysical) return;
    const beforeReplay = physicPaintStore.getRotoPhysicalDocument(layer.id);
    const beforeRevisionSignal = rotoPhysicalRevision.peek();
    const replace = vi.spyOn(physicPaintStore, 'replaceRotoPhysicalDocument');
    const dispatch = window.dispatchEvent as ReturnType<typeof vi.fn>;
    dispatch.mockClear();

    const replay = applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      operationId: 'project-B-replay-project-A-command',
      operationKind: 'undo',
      layerId: layer.id,
      startFrame: 0,
      launchOperationId: launchB.data.operationId,
      projectContextId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      expectedRevision: accepted.acceptedRevision,
      records: records.map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: false,
      interpolationMode: 'duplicate',
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
      selectedKeyId: null,
      selectedAppFrame: null,
      historyProvenance: {
        historyCommandId: 'project-A-command',
        historyDirection: 'undo',
        sourceRevision: accepted.acceptedRevision,
        targetRevision: launchA.data.rotoPhysical.revision,
      },
    });

    expect(replay.ok).toBe(false);
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id)).toEqual(beforeReplay);
    expect(rotoPhysicalRevision.peek()).toBe(beforeRevisionSignal);
    expect(replace).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('rejects null-selection replay when only the start-frame-derived cursor differs', async () => {
    const layer = physicLayer();
    mockLayers([layer]);
    const records = [
      makePhysicalRecord('A', 0),
      makePhysicalRecord('B', 10),
    ];
    seedPhysicalDocument(layer.id, records);
    projectStore.projectContextId.value = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const launch = await openPhysicPaintCanvas({ layer, frame: 0 });

    expect(launch.ok).toBe(true);
    if (!launch.ok || !launch.data.rotoPhysical) return;
    expect(physicPaintStore.setRotoPhysicalSelection(layer.id, null, 0)).toEqual({ ok: true });
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records,
      intent: { kind: 'force-spacing', emptyFrames: 1, selectedKeyId: null },
      capacity: launch.data.rotoPhysical.capacity,
      interpolationEnabled: false,
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
    });
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;
    const spacedRecords = resolution.proposal.orderedKeyIds.map((keyId) => {
      const record = records.find((candidate) => candidate.keyId === keyId);
      const appFrame = resolution.proposal.mapping.get(keyId);
      if (!record || appFrame === undefined) throw new Error(`Missing spaced record ${keyId}`);
      const { kind: _kind, ...moved } = movePhysicalRecord(record, appFrame);
      return moved;
    });
    const accepted = applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      operationId: 'null-selection-command',
      operationKind: 'force-spacing',
      intent: { kind: 'force-spacing', emptyFrames: 1, selectedKeyId: null },
      layerId: layer.id,
      startFrame: 4,
      launchOperationId: launch.data.operationId,
      projectContextId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      expectedRevision: launch.data.rotoPhysical.revision,
      records: spacedRecords,
      interpolationEnabled: false,
      interpolationMode: 'duplicate',
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
      selectedKeyId: null,
      selectedAppFrame: null,
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok || !('acceptedRevision' in accepted)) return;
    const beforeReplay = physicPaintStore.getRotoPhysicalDocument(layer.id);
    const beforeRevisionSignal = rotoPhysicalRevision.peek();
    const replace = vi.spyOn(physicPaintStore, 'replaceRotoPhysicalDocument');
    const dispatch = window.dispatchEvent as ReturnType<typeof vi.fn>;
    dispatch.mockClear();

    const replay = applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      operationId: 'null-selection-wrong-cursor-undo',
      operationKind: 'undo',
      layerId: layer.id,
      startFrame: 1,
      launchOperationId: launch.data.operationId,
      projectContextId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      expectedRevision: accepted.acceptedRevision,
      records: records.map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: false,
      interpolationMode: 'duplicate',
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
      selectedKeyId: null,
      selectedAppFrame: null,
      historyProvenance: {
        historyCommandId: 'null-selection-command',
        historyDirection: 'undo',
        sourceRevision: accepted.acceptedRevision,
        targetRevision: launch.data.rotoPhysical.revision,
      },
    });

    expect(replay.ok).toBe(false);
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id)).toEqual(beforeReplay);
    expect(rotoPhysicalRevision.peek()).toBe(beforeRevisionSignal);
    expect(replace).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('removes accepted command authorization when the layer launch authority is replaced', async () => {
    const layer = physicLayer();
    mockLayers([layer]);
    const records = [
      makePhysicalRecord('A', 0),
      makePhysicalRecord('B', 10),
    ];
    seedPhysicalDocument(layer.id, records);
    projectStore.projectContextId.value = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const firstLaunch = await openPhysicPaintCanvas({ layer, frame: 10 });
    expect(firstLaunch.ok).toBe(true);
    if (!firstLaunch.ok || !firstLaunch.data.rotoPhysical) return;

    const command = applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      operationId: 'replaced-launch-command',
      operationKind: 'move-key',
      intent: {
        kind: 'move-key',
        movedKeyId: 'B',
        target: { kind: 'physical-cell', appFrame: 10 },
      },
      layerId: layer.id,
      startFrame: 10,
      launchOperationId: firstLaunch.data.operationId,
      projectContextId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      expectedRevision: firstLaunch.data.rotoPhysical.revision,
      records: firstLaunch.data.rotoPhysical.records,
      interpolationEnabled: false,
      interpolationMode: 'duplicate',
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
      selectedKeyId: 'B',
      selectedAppFrame: 10,
    });
    expect(command.ok).toBe(true);
    if (!command.ok || !('acceptedRevision' in command)) return;

    const replacementLaunch = await openPhysicPaintCanvas({ layer, frame: 10 });
    expect(replacementLaunch.ok).toBe(true);
    if (!replacementLaunch.ok || !replacementLaunch.data.rotoPhysical) return;
    const beforeReplay = physicPaintStore.getRotoPhysicalDocument(layer.id);
    const beforeRevisionSignal = rotoPhysicalRevision.peek();
    const replace = vi.spyOn(physicPaintStore, 'replaceRotoPhysicalDocument');

    const replay = applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      operationId: 'replaced-launch-replay',
      operationKind: 'undo',
      layerId: layer.id,
      startFrame: 0,
      launchOperationId: replacementLaunch.data.operationId,
      projectContextId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      expectedRevision: command.acceptedRevision,
      records: records.map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: false,
      interpolationMode: 'duplicate',
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
      selectedKeyId: null,
      selectedAppFrame: null,
      historyProvenance: {
        historyCommandId: 'replaced-launch-command',
        historyDirection: 'undo',
        sourceRevision: command.acceptedRevision,
        targetRevision: firstLaunch.data.rotoPhysical.revision,
      },
    });

    expect(replay).toMatchObject({
      ok: false,
      error: expect.stringContaining('unknown accepted command'),
    });
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id)).toEqual(beforeReplay);
    expect(rotoPhysicalRevision.peek()).toBe(beforeRevisionSignal);
    expect(replace).not.toHaveBeenCalled();
  });

  it('preserves one stable-key-owned incoming interpolation break across canonical ordinary edits', async () => {
    const layer = physicLayer();
    mockLayers([layer]);
    seedPhysicalDocument(layer.id, [
      makePhysicalRecord('key-0', 0),
      makePhysicalRecord('key-10', 10),
    ], { enabled: true, mode: 'duplicate' }, ['key-10']);
    const open = vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const launch = await openPhysicPaintCanvas({ layer, frame: 10 });

    expect(launch.ok).toBe(true);
    if (!launch.ok || !launch.data.rotoPhysical) return;
    const records = launch.data.rotoPhysical.records;
    const result = applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      operationId: 'accept-incoming-break',
      operationKind: 'move-key',
      intent: {
        kind: 'move-key',
        movedKeyId: 'key-10',
        target: { kind: 'physical-cell', appFrame: 10 },
      },
      layerId: layer.id,
      startFrame: 10,
      launchOperationId: launch.data.operationId,
      expectedRevision: launch.data.rotoPhysical.revision,
      records,
      interpolationEnabled: true,
      interpolationMode: 'duplicate',
      incomingInterpolationBreakKeyIds: ['key-10'],
      selectedKeyId: 'key-10',
      selectedAppFrame: 10,
    });

    expect(result).toMatchObject({
      ok: true,
      operationId: 'accept-incoming-break',
      incomingInterpolationBreakKeyIds: ['key-10'],
    });
    const document = physicPaintStore.getRotoPhysicalDocument(layer.id);
    expect(document?.incomingInterpolationBreakKeyIds).toEqual(['key-10']);
    expect(Object.isFrozen(document?.incomingInterpolationBreakKeyIds)).toBe(true);

    const omitted = applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      operationId: 'retain-omitted-incoming-break',
      operationKind: 'move-key',
      intent: {
        kind: 'move-key',
        movedKeyId: 'key-10',
        target: { kind: 'physical-cell', appFrame: 10 },
      },
      layerId: layer.id,
      startFrame: 10,
      launchOperationId: launch.data.operationId,
      expectedRevision: document!.revision,
      records,
      interpolationEnabled: true,
      interpolationMode: 'duplicate',
      selectedKeyId: 'key-10',
      selectedAppFrame: 10,
    });
    expect(omitted.ok).toBe(true);
    expect(physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(layer.id)).toEqual(['key-10']);

    const retainedDocument = physicPaintStore.getRotoPhysicalDocument(layer.id)!;
    const cleared = applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      operationId: 'clear-explicit-incoming-break',
      operationKind: 'move-key',
      intent: {
        kind: 'move-key',
        movedKeyId: 'key-10',
        target: { kind: 'physical-cell', appFrame: 10 },
      },
      layerId: layer.id,
      startFrame: 10,
      launchOperationId: launch.data.operationId,
      expectedRevision: retainedDocument.revision,
      records,
      interpolationEnabled: true,
      interpolationMode: 'duplicate',
      incomingInterpolationBreakKeyIds: [],
      selectedKeyId: 'key-10',
      selectedAppFrame: 10,
    });
    expect(cleared.ok).toBe(false);
    expect(physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(layer.id)).toEqual(['key-10']);
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id)?.revision).toBe(retainedDocument.revision);

    expect(physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds('missing-layer')).toBe(
      PHYSIC_PAINT_ROTO_INCOMING_INTERPOLATION_BREAK_KEY_IDS_EMPTY,
    );
    const fresh = createPhysicPaintLaunchContext(physicLayer({
      id: 'fresh-layer',
      source: { type: 'physic-paint', layerId: 'fresh-layer' },
    }), 0);
    expect(fresh.rotoPhysical?.incomingInterpolationBreakKeyIds).toEqual([]);
    expect(Object.isFrozen(fresh.rotoPhysical?.incomingInterpolationBreakKeyIds)).toBe(true);
    open.mockRestore();
  });

  it('rejects malformed duplicate orphan or stale incoming interpolation breaks without mutation', async () => {
    const layer = physicLayer();
    mockLayers([layer]);
    seedPhysicalDocument(layer.id, [
      makePhysicalRecord('key-0', 0),
      makePhysicalRecord('key-10', 10),
    ], { enabled: true, mode: 'duplicate' }, ['key-10']);
    const open = vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const launch = await openPhysicPaintCanvas({ layer, frame: 10 });

    expect(launch.ok).toBe(true);
    if (!launch.ok || !launch.data.rotoPhysical) return;
    const beforeDocument = physicPaintStore.getRotoPhysicalDocument(layer.id);
    const beforeRevisionSignal = rotoPhysicalRevision.peek();
    const basePayload = {
      kind: 'replace-roto-physical-map' as const,
      operationKind: 'move-key' as const,
      intent: {
        kind: 'move-key' as const,
        movedKeyId: 'key-10',
        target: { kind: 'physical-cell' as const, appFrame: 10 },
      },
      layerId: layer.id,
      startFrame: 10,
      launchOperationId: launch.data.operationId,
      expectedRevision: launch.data.rotoPhysical.revision,
      records: launch.data.rotoPhysical.records,
      interpolationEnabled: true,
      interpolationMode: 'duplicate' as const,
      selectedKeyId: 'key-10',
      selectedAppFrame: 10,
    };
    const proposals: readonly { operationId: string; expectedRevision?: string; incomingInterpolationBreakKeyIds: unknown }[] = [
      { operationId: 'reject-malformed-incoming-break', incomingInterpolationBreakKeyIds: 'key-10' },
      { operationId: 'reject-duplicate-incoming-break', incomingInterpolationBreakKeyIds: ['key-10', 'key-10'] },
      { operationId: 'reject-orphan-incoming-break', incomingInterpolationBreakKeyIds: ['missing-key'] },
      { operationId: 'reject-stale-incoming-break', expectedRevision: 'physical-stale', incomingInterpolationBreakKeyIds: ['key-10'] },
    ];

    for (const proposal of proposals) {
      const result = applyPhysicPaintPayload({
        ...basePayload,
        ...proposal,
      });
      expect(result.ok).toBe(false);
      expect(physicPaintStore.getRotoPhysicalDocument(layer.id)).toEqual(beforeDocument);
      expect(rotoPhysicalRevision.peek()).toBe(beforeRevisionSignal);
    }
    open.mockRestore();
  });

  it('validates insert-empty-segment semantics independently', async () => {
    installCanonicalBlankCanvas();
    const layer = physicLayer();
    mockLayers([layer]);
    seedPhysicalDocument(layer.id, [
      makePhysicalRecord('key-0', 0),
      makePhysicalRecord('key-10', 10),
    ], { enabled: false, mode: 'duplicate' }, ['key-10']);
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const launch = await openPhysicPaintCanvas({ layer, frame: 5 });

    expect(launch.ok).toBe(true);
    if (!launch.ok || !launch.data.rotoPhysical) return;
    const inserted = makeEmptySegmentRecord('key-5', 5);
    const records = [...launch.data.rotoPhysical.records, inserted]
      .sort((left, right) => left.appFrame - right.appFrame);
    const result = applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      operationId: 'insert-empty-segment-valid',
      operationKind: 'insert-empty-segment',
      intent: {
        kind: 'insert-empty-segment',
        destinationAppFrame: 5,
        insertedKeyId: 'key-5',
        blankPayload: inserted.payload,
      },
      layerId: layer.id,
      startFrame: 5,
      launchOperationId: launch.data.operationId,
      expectedRevision: launch.data.rotoPhysical.revision,
      records,
      interpolationEnabled: false,
      interpolationMode: 'duplicate',
      incomingInterpolationBreakKeyIds: ['key-10', 'key-5'],
      selectedKeyId: 'key-5',
      selectedAppFrame: 5,
      semanticDelta: {
        kind: 'insert-empty-segment',
        insertedKeyId: 'key-5',
        destinationAppFrame: 5,
      },
    });

    expect(result).toMatchObject({
      ok: true,
      operationId: 'insert-empty-segment-valid',
      incomingInterpolationBreakKeyIds: ['key-10', 'key-5'],
    });
    const accepted = physicPaintStore.getRotoPhysicalDocument(layer.id);
    expect(accepted).toMatchObject({
      selectedKeyId: 'key-5',
      cursorAppFrame: 5,
      interpolation: { enabled: false, mode: 'duplicate' },
      loopClips: [],
      incomingInterpolationBreakKeyIds: ['key-10', 'key-5'],
    });
    expect(result.ok && 'acceptedRevision' in result ? result.acceptedRevision : null).toBe(accepted?.revision);
  });

  it('rejects stale false or unrelated empty-segment deltas without mutation', async () => {
    installCanonicalBlankCanvas();
    const layer = physicLayer();
    mockLayers([layer]);
    seedPhysicalDocument(layer.id, [
      makePhysicalRecord('key-0', 0),
      makePhysicalRecord('key-10', 10),
    ], { enabled: true, mode: 'duplicate' }, ['key-10']);
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const launch = await openPhysicPaintCanvas({ layer, frame: 12 });

    expect(launch.ok).toBe(true);
    if (!launch.ok || !launch.data.rotoPhysical) return;
    const inserted = makeEmptySegmentRecord('key-12', 12);
    const records = [...launch.data.rotoPhysical.records, inserted]
      .sort((left, right) => left.appFrame - right.appFrame);
    const basePayload = {
      kind: 'replace-roto-physical-map' as const,
      operationKind: 'insert-empty-segment' as const,
      intent: {
        kind: 'insert-empty-segment' as const,
        destinationAppFrame: 12,
        insertedKeyId: 'key-12',
        blankPayload: inserted.payload,
      },
      layerId: layer.id,
      startFrame: 12,
      launchOperationId: launch.data.operationId,
      expectedRevision: launch.data.rotoPhysical.revision,
      records,
      interpolationEnabled: true,
      interpolationMode: 'duplicate' as const,
      incomingInterpolationBreakKeyIds: ['key-10', 'key-12'],
      selectedKeyId: 'key-12',
      selectedAppFrame: 12,
      semanticDelta: {
        kind: 'insert-empty-segment' as const,
        insertedKeyId: 'key-12',
        destinationAppFrame: 12,
      },
    };
    const proposals: readonly PhysicPaintApplyPayload[] = [
      {
        ...basePayload,
        operationId: 'reject-empty-segment-false-id',
        semanticDelta: { ...basePayload.semanticDelta, insertedKeyId: 'false-id' },
      },
      {
        ...basePayload,
        operationId: 'reject-empty-segment-false-destination',
        semanticDelta: { ...basePayload.semanticDelta, destinationAppFrame: 13 },
      },
      {
        ...basePayload,
        operationId: 'reject-empty-segment-non-blank',
        records: records.map((record) => record.keyId === 'key-12'
          ? makeEmptySegmentRecord('key-12', 12, OPAQUE_ONE_PIXEL_PNG)
          : record),
      },
      {
        ...basePayload,
        operationId: 'reject-empty-segment-unrelated-record',
        records: records.map((record) => record.keyId === 'key-0'
          ? { ...record, payload: { ...record.payload, dataUrl: OPAQUE_ONE_PIXEL_PNG } }
          : record),
      },
      {
        ...basePayload,
        operationId: 'reject-empty-segment-extra-break',
        incomingInterpolationBreakKeyIds: ['key-0', 'key-10', 'key-12'],
      },
      {
        ...basePayload,
        operationId: 'reject-empty-segment-removed-break',
        incomingInterpolationBreakKeyIds: ['key-12'],
      },
      {
        ...basePayload,
        operationId: 'reject-empty-segment-loop-change',
        loopClips: [{
          loopId: 'unrelated-loop',
          placementStart: 0,
          sourceKeyIds: ['key-0'],
          repeat: 2,
          mode: 'static',
        }],
      },
      {
        ...basePayload,
        operationId: 'reject-empty-segment-interpolation-change',
        interpolationEnabled: false,
      },
      {
        ...basePayload,
        operationId: 'reject-empty-segment-capacity-race',
        records: [
          ...launch.data.rotoPhysical.records,
          makeEmptySegmentRecord('key-600', 600),
        ],
        incomingInterpolationBreakKeyIds: ['key-10', 'key-600'],
        selectedKeyId: 'key-600',
        selectedAppFrame: 600,
        intent: {
          kind: 'insert-empty-segment',
          destinationAppFrame: 600,
          insertedKeyId: 'key-600',
          blankPayload: makeEmptySegmentRecord('key-600', 600).payload,
        },
        semanticDelta: {
          kind: 'insert-empty-segment',
          insertedKeyId: 'key-600',
          destinationAppFrame: 600,
        },
      },
      {
        ...basePayload,
        operationId: 'reject-empty-segment-stale',
        expectedRevision: 'physical-stale',
      },
    ];

    const beforeDocument = physicPaintStore.getRotoPhysicalDocument(layer.id);
    const beforeRevisionSignal = rotoPhysicalRevision.peek();
    for (const proposal of proposals) {
      const result = applyPhysicPaintPayload(proposal);
      expect(result.ok, proposal.operationId).toBe(false);
      expect(physicPaintStore.getRotoPhysicalDocument(layer.id), proposal.operationId).toEqual(beforeDocument);
      expect(rotoPhysicalRevision.peek(), proposal.operationId).toBe(beforeRevisionSignal);
    }
  });

  it('accepts the first Progressive Play Script and Loop Clip on a fresh layer', async () => {
    const layer = physicLayer();
    mockLayers([layer]);
    sequenceStore.add({
      id: 'seq-fresh-play-script',
      kind: 'fx',
      name: 'Fresh Play Script',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [layer],
      inFrame: 0,
      outFrame: 50,
    });
    projectStore.filePath.value = '/tmp/fresh-play-script.mce';
    projectStore.scriptLibraryAuthority.value = '/tmp/fresh-play-script/Scripts';
    const open = vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const launch = await openPhysicPaintCanvas({ layer, frame: 0 });

    expect(launch.ok).toBe(true);
    if (!launch.ok || !launch.data.rotoPhysical || !launch.data.project) return;
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id)).toBeNull();

    const records = Array.from({ length: 5 }, (_, appFrame) => {
      const record = makePhysicalRecord(`generated-${appFrame}`, appFrame);
      return {
        keyId: record.keyId,
        appFrame: record.appFrame,
        payload: {
          ...record.payload,
          dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
        },
      };
    });
    const rotoBackground = { background: 'canvas1', paperGrain: 'canvas2', grainStrength: 0.45 } as const;
    const result = applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      operationId: 'fresh-progressive-play-script',
      operationKind: 'play-script',
      layerId: layer.id,
      startFrame: 0,
      launchOperationId: launch.data.operationId,
      projectContextId: launch.data.project.contextId,
      expectedRevision: launch.data.rotoPhysical.revision,
      records,
      interpolationEnabled: launch.data.rotoPhysical.interpolationEnabled,
      interpolationMode: launch.data.rotoPhysical.interpolationMode,
      rotoBackground,
      loopClips: [{
        loopId: 'fresh-progressive-loop',
        placementStart: 0,
        sourceKeyIds: records.map((record) => record.keyId),
        repeat: 2,
        mode: 'progressive',
      }],
      selectedKeyId: records[0].keyId,
      selectedAppFrame: 0,
      semanticDelta: {
        kind: 'play-script',
        affectedStartAppFrame: 0,
        affectedEndAppFrame: 4,
        expectedLayerCapacity: launch.data.rotoPhysical.capacity,
        expectedLayerEndExclusive: 50,
        proposedRecords: records,
        freshKeyIds: records.map((record) => record.keyId),
      },
    });

    expect(result.ok ? null : result.error).toBeNull();
    expect(result).toMatchObject({
      ok: true,
      operationId: 'fresh-progressive-play-script',
      operationKind: 'play-script',
      appliedFrameCount: 5,
    });
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id)).toMatchObject({
      selectedKeyId: records[0].keyId,
      cursorAppFrame: 0,
      background: rotoBackground,
      loopClips: [expect.objectContaining({
        placementStart: 0,
        sourceKeyIds: records.map((record) => record.keyId),
        repeat: 2,
        mode: 'progressive',
      })],
    });
    open.mockRestore();
  });

  it('applies a still payload at the start frame and returns operation-matched success', () => {
    mockLayers([physicLayer()]);

    const result = applyPhysicPaintPayload(applyCanvasPayload({ operationId: 'apply-still-1' }));

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
    physicPaintStore.setRotoInterpolationSettings('phys-layer-1', { enabled: true, inBetweenCount: 2, mode: 'duplicate', deform: 0, position: 0 });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(physicPaintStore.getRotoFrame('phys-layer-1', 2)).toEqual(expect.objectContaining({ appFrame: 2, source: 'generated-interpolation' }));
    expect(physicPaintStore.getRotoFrame('phys-layer-1', 3)).toEqual(expect.objectContaining({ appFrame: 3, source: 'generated-interpolation' }));
    expect(physicPaintStore.toMceOutputs()[0]).toEqual(expect.objectContaining({
      roto_interpolation_settings: { enabled: true, inBetweenCount: 2, mode: 'duplicate', deform: 0, position: 0, segmentSpacingOverrides: [] },
      roto_cache_metadata: [
        expect.objectContaining({ appFrame: 1, source: 'real-key', sourceFrame: 1 }),
        expect.objectContaining({ appFrame: 4, source: 'real-key', sourceFrame: 4 }),
      ],
    }));
  });

  it('syncs metadata-only Roto interpolation settings from standalone into parent preview/export state', () => {
    mockLayers([physicLayer()]);
    applyPhysicPaintPayload(applyCanvasPayload({
      operationId: 'apply-roto-real-0',
      startFrame: 0,
      renderedFrame: makeFrame(0, 0),
    }));
    applyPhysicPaintPayload(applyCanvasPayload({
      operationId: 'apply-roto-real-1',
      startFrame: 1,
      renderedFrame: makeFrame(0, 1),
    }));
    applyPhysicPaintPayload(applyCanvasPayload({
      operationId: 'apply-roto-real-2',
      startFrame: 2,
      renderedFrame: makeFrame(0, 2),
    }));

    const result = applyPhysicPaintPayload({
      kind: 'update-roto-interpolation-settings',
      operationId: 'sync-roto-interpolation-1',
      layerId: 'phys-layer-1',
      startFrame: 1,
      settings: { enabled: true, inBetweenCount: 3, mode: 'duplicate', deform: 0, position: 0 },
    });

    expect(result).toMatchObject({ ok: true, kind: 'update-roto-interpolation-settings', appliedFrameCount: 6 });
    expect(physicPaintStore.getRotoInterpolationSettings('phys-layer-1')).toEqual({ enabled: true, inBetweenCount: 3, mode: 'duplicate', deform: 0, position: 0 });
    expect(physicPaintStore.getRotoFrame('phys-layer-1', 8)).toEqual(expect.objectContaining({
      appFrame: 8,
      source: 'real-key',
      sourceFrame: 2,
      dataUrl: makeFrame(0, 2).dataUrl,
    }));
    expect(physicPaintStore.getRotoFrame('phys-layer-1', 9)).toBeNull();
    expect(physicPaintStore.toMceOutputs()[0]).toEqual(expect.objectContaining({
      roto_interpolation_settings: { enabled: true, inBetweenCount: 3, mode: 'duplicate', deform: 0, position: 0, segmentSpacingOverrides: [] },
      roto_cache_metadata: [
        expect.objectContaining({ appFrame: 0, source: 'real-key', sourceFrame: 0 }),
        expect.objectContaining({ appFrame: 1, source: 'real-key', sourceFrame: 1 }),
        expect.objectContaining({ appFrame: 2, source: 'real-key', sourceFrame: 2 }),
      ],
    }));
  });

  it('updates an existing projected real key by durable source identity when its source number is a generated display', () => {
    mockLayers([physicLayer()]);
    physicPaintStore.upsertRealRotoKeyFrame('phys-layer-1', 0, makeFrame(0, 0));
    physicPaintStore.upsertRealRotoKeyFrame('phys-layer-1', 1, makeFrame(0, 1));
    physicPaintStore.setRotoInterpolationSettings('phys-layer-1', {
      enabled: true,
      inBetweenCount: 2,
      mode: 'duplicate',
      deform: 0,
      position: 0,
    });
    const updatedPaint = `data:image/png;base64,${btoa('projected-source-update')}`;

    expect(physicPaintStore.getRotoFrame('phys-layer-1', 1)).toEqual(expect.objectContaining({
      appFrame: 1,
      source: 'generated-interpolation',
    }));
    expect(physicPaintStore.getRotoFrame('phys-layer-1', 3)).toEqual(expect.objectContaining({
      appFrame: 3,
      source: 'real-key',
      sourceFrame: 1,
    }));

    const result = applyPhysicPaintPayload(applyCanvasPayload({
      operationId: 'update-projected-real-source',
      startFrame: 1,
      sourceFrame: 1,
      displayFrame: 3,
      renderedFrame: {
        ...makeFrame(0, 1),
        dataUrl: updatedPaint,
        source: 'real-key',
      },
      rotoInterpolationSettings: physicPaintStore.getRotoInterpolationSettings('phys-layer-1'),
    }));

    expect(result).toMatchObject({
      ok: true,
      operationId: 'update-projected-real-source',
      startFrame: 1,
      appliedFrameCount: 1,
    });
    expect(physicPaintStore.getRotoFrame('phys-layer-1', 3)).toEqual(expect.objectContaining({
      source: 'real-key',
      sourceFrame: 1,
      dataUrl: updatedPaint,
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
          }),
    ]);

    projectStore.closeProject();
    projectStore.hydrateFromMce(serialized, '/tmp/efx-physic-paint-test');
    const hydratedLayer = sequenceStore.sequences.peek()[0]?.layers[0];
    expect(hydratedLayer?.source).toEqual({ type: 'physic-paint', layerId: 'hydrated-phys-layer' });
    expect(physicPaintStore.getFrame('hydrated-phys-layer', 12)?.dataUrl).toContain('data:image/png');

    mockLayers([hydratedLayer as Layer]);
    const result = applyPhysicPaintPayload(applyCanvasPayload({ operationId: 'apply-still-hydrated', layerId: 'hydrated-phys-layer' }));

    expect(result.ok).toBe(true);
    expect(result).toMatchObject({
      operationId: 'apply-still-hydrated',
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

  it.skip('closes the native physics paint window from the main apply listener after close-save payload succeeds', async () => {
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
    // The fallback listener applies through the asynchronous prepared-payload seam.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

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
    // The fallback listener applies through the asynchronous prepared-payload seam.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(child.postMessage).toHaveBeenCalledWith({
      type: PHYSIC_PAINT_APPLY_RESULT_EVENT,
      payload: expect.objectContaining({ ok: true, operationId: 'message-op', appliedFrameCount: 1 }),
    }, 'http://localhost:1420');
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

  it('installs a browser message listener for D-26 frame sync and removes it on cleanup', async () => {
    let listener: ((event: MessageEvent) => void) | undefined;
    vi.spyOn(window, 'addEventListener').mockImplementation((event, cb) => {
      if (event === 'message') listener = cb as (event: MessageEvent) => void;
    });
    const remove = vi.spyOn(window, 'removeEventListener');
    const seek = vi.spyOn(timelineStore, 'seek');
    const ensureFrameVisible = vi.spyOn(timelineStore, 'ensureFrameVisible');

    const cleanup = await installPhysicPaintFrameSyncListener(window);
    listener?.(new MessageEvent('message', { data: { type: 'physic-paint:seek-frame', frame: 7 } }));

    expect(seek).toHaveBeenCalledWith(7);
    expect(ensureFrameVisible).toHaveBeenCalledWith(7);

    cleanup();
    expect(remove).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('installs a Tauri listen branch for D-26 frame sync in native runtime', async () => {
    let handler: ((event: { payload: unknown }) => unknown) | undefined;
    const unlisten = vi.fn();
    vi.doMock('@tauri-apps/api/event', () => ({
      listen: vi.fn(async (eventName: string, cb: (event: { payload: unknown }) => unknown) => {
        if (eventName === 'physic-paint:seek-frame') handler = cb;
        return unlisten;
      }),
    }));
    Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true });
    try {
      const add = vi.spyOn(window, 'addEventListener');
      const seek = vi.spyOn(timelineStore, 'seek');
      const ensureFrameVisible = vi.spyOn(timelineStore, 'ensureFrameVisible');

      const cleanup = await installPhysicPaintFrameSyncListener(window);
      handler?.({ payload: { type: 'physic-paint:seek-frame', frame: 9 } });

      expect(seek).toHaveBeenCalledWith(9);
      expect(ensureFrameVisible).toHaveBeenCalledWith(9);
      expect(add).not.toHaveBeenCalledWith('message', expect.any(Function));

      cleanup();
      expect(unlisten).toHaveBeenCalledTimes(1);
    } finally {
      delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
      vi.doUnmock('@tauri-apps/api/event');
    }
  });
});

describe('public Physics Paint transport cleanup', () => {
  it('exposes only generic Physics Paint transport after the local Loop Clip cutover', async () => {
    const bridge = await import('./physicPaintBridge') as Record<string, unknown>;
    const transport = await import('../components/physic-paint/bridge/physicsPaintBridgeTransport') as Record<string, unknown>;
    const parentBridge = await import('../components/physic-paint/bridge/usePhysicsPaintParentBridge') as Record<string, unknown>;
    const types = await import('../types/physicPaint') as Record<string, unknown>;

    expect(bridge.openPhysicPaintCanvas).toBeTypeOf('function');
    expect(transport.sendPhysicPaintApplyPayload).toBeTypeOf('function');

    for (const name of [
      'PHYSIC_PAINT_OPEN_LOOP_EDIT_EVENT',
      'PHYSIC_PAINT_LOOP_OPERATION_REQUEST_EVENT',
      'PHYSIC_PAINT_LOOP_OPERATION_RESULT_EVENT',
      'openPhysicPaintLoopEdit',
      'requestPhysicPaintLoopOperation',
    ]) expect(name in bridge).toBe(false);

    for (const name of [
      'sendPhysicPaintOpenLoopEdit',
      'sendPhysicPaintLoopOperationRequest',
      'sendPhysicPaintLoopOperationResult',
    ]) expect(name in transport).toBe(false);

    for (const name of [
      'usePhysicsPaintOpenLoopEditBridge',
      'usePhysicsPaintLoopOperationBridge',
      'createPhysicsPaintLoopOperationRequestHandler',
    ]) expect(name in parentBridge).toBe(false);

    for (const name of [
      'isPhysicPaintOpenLoopEditRequest',
      'isPhysicPaintLoopOperationRequest',
      'isPhysicPaintLoopOperationResult',
    ]) expect(name in types).toBe(false);
  });
});
