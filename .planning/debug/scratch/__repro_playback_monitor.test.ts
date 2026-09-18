/**
 * Scratch repro (debug session playback-shows-only-last-layer):
 * the user's exact sequence at the program-monitor level —
 * play (frame 5) -> advance (frame 6) -> hide/show a track mid-playback ->
 * scrub back to frame 5. Every playback tick must draw the FULL composite of
 * both participating tracks; the hide step must drop to one track and the
 * show step must restore both.
 *
 * Harness copied from physicsPaintProgramMonitor.test.ts (same doubles).
 */
const decodeFlatLog = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);
const frameSeed = (bytes: Uint8Array): string => new TextDecoder().decode(bytes.slice(32));
const blobContentByBlob = new WeakMap<Blob, Uint8Array>();
const OriginalBlob = globalThis.Blob;
import { testWebpBytes } from '../../../testUtils/testWebpBytes';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';
import { PreactHookRuntime } from '../../../test/preactHookRuntime';
import { PhysicsPaintProgramMonitor, type PhysicsPaintProgramMonitorProps } from './PhysicsPaintProgramMonitor';
import {
  physicPaintStore,
  _setPhysicPaintCompositorSizeProvider,
  type EfxPaintFlattenedFrameRecord,
} from '../../../stores/physicPaintStore';
import { registerDocument, reset as resetEfxPaintStore, setTrackVisible } from '../../../stores/efxPaintStore';
import { createEfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import type { EfxPaintDocument, InternalPaintTrack } from '../../../efx-paint/document/efxPaintDocument';
import type { PhysicPaintRotoLoopClip } from '../roto/physicsPaintRotoPhysicalModel';
import { buildPhysicPaintRotoPhysicalRevision } from '../roto/physicsPaintRotoPhysicalModel';
import { clearProjectPaperRasterCache } from '../../../lib/projectPaperRaster';
import type { RotoCachedPlaybackTick } from '../hooks/useRotoCachedPlayback';
import type { RenderedFramePayload } from '../roto/rotoCanvasFrames';

const { decodeWebpFrameMock } = vi.hoisted(() => ({ decodeWebpFrameMock: vi.fn() }));
vi.mock('../../../lib/webpFrameCodec', () => ({
  decodeWebpFrame: decodeWebpFrameMock,
  encodeCanvasAsWebp: vi.fn(async (canvas: { log?: () => string; toDataURL?: () => string }) => {
    let seed = '';
    if (typeof canvas.log === 'function') {
      seed = canvas.log();
    } else if (typeof canvas.toDataURL === 'function') {
      const dataUrl = canvas.toDataURL();
      const comma = dataUrl.indexOf(',');
      if (comma >= 0) seed = atob(dataUrl.slice(comma + 1));
    }
    const bytes = new Uint8Array(32 + seed.length);
    bytes.set([0x52, 0x49, 0x46, 0x46], 0);
    bytes.set([0x57, 0x45, 0x42, 0x50], 8);
    bytes.set([0x56, 0x50, 0x38, 0x4c], 12);
    for (let index = 0; index < seed.length; index += 1) bytes[32 + index] = seed.charCodeAt(index) & 0xff;
    return bytes;
  }),
}));

const flushDecode = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

let runtime = new PreactHookRuntime();
vi.mock('preact/hooks', () => ({
  useState: <T,>(initial: T | (() => T)) => runtime.useState(initial),
  useRef: <T,>(initial: T) => runtime.useRef(initial),
  useMemo: <T,>(factory: () => T, deps: unknown[]) => runtime.useMemo(factory, deps),
  useCallback: <T,>(callback: T, deps: unknown[]) => runtime.useCallback(callback, deps),
  useEffect: (effect: () => void | (() => void), deps?: unknown[]) => runtime.useEffect(effect, deps),
}));

const FLAT_LAYER = 'flat-layer';

const makeFrame = (frameIndex: number, appFrame: number) => ({
  frameIndex,
  appFrame,
  bytes: testWebpBytes(btoa(`frame-${frameIndex}`)),
  width: 1000,
  height: 650,
});

class FlatRecordingContext {
  readonly ops: Array<{ type: string; source?: string }>;
  constructor(ops: Array<{ type: string; source?: string }> = []) { this.ops = ops; }
  fillStyle: string | CanvasGradient | CanvasPattern = '#000000';
  globalAlpha = 1;
  globalCompositeOperation: GlobalCompositeOperation = 'source-over';
  save(): void { this.ops.push({ type: 'save' }); }
  restore(): void { this.ops.push({ type: 'restore' }); }
  clearRect(): void { this.ops.push({ type: 'clearRect' }); }
  fillRect(): void { this.ops.push({ type: 'fillRect' }); }
  drawImage(source?: unknown): void {
    const sourceLabel = source !== null && typeof source === 'object' && 'src' in source
      ? String((source as { src: unknown }).src)
      : 'canvas';
    this.ops.push({ type: 'drawImage', source: sourceLabel });
  }
  createPattern(): CanvasPattern { return 'pattern' as unknown as CanvasPattern; }
}

class FlatTestCanvas {
  width = 0;
  height = 0;
  constructor(readonly ops: Array<{ type: string; source?: string }>) {}
  getContext(kind: string): FlatRecordingContext | null { return kind === '2d' ? new FlatRecordingContext(this.ops) : null; }
  toDataURL(): string {
    const log = this.ops.map((op) => op.type === 'drawImage' ? `draw(${op.source},1,source-over)` : op.type === 'clearRect' ? 'clear' : op.type).join('|');
    return `data:image/png;base64,${btoa(log)}`;
  }
}

class FlatTestImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin = '';
  width = 4;
  height = 3;
  private currentSrc = '';
  set src(value: string) { this.currentSrc = value; this.onload?.(); }
  get src(): string { return this.currentSrc; }
}

class FlatTestBitmap {
  width = 4;
  height = 3;
  close = vi.fn();
  constructor(readonly src: string) {}
}

class MonitorTestContext {
  readonly ops: string[] = [];
  readonly sources: unknown[] = [];
  clearRect(): void { this.ops.push('clear'); }
  drawImage(source?: unknown): void { this.ops.push('draw'); this.sources.push(source); }
}

class MonitorTestCanvas {
  width = 0;
  height = 0;
  constructor(readonly context = new MonitorTestContext()) {}
  getContext(kind: string): MonitorTestContext | null { return kind === '2d' ? this.context : null; }
}

function flatTrack(id: string, overrides: Partial<Omit<InternalPaintTrack, 'id'>> = {}): InternalPaintTrack {
  return {
    id, name: id, order: 0, visible: true, solo: false, opacity: 1, blendMode: 'normal', revision: 0,
    frames: {}, rotoPhysical: null, loopClips: [], ...overrides,
  };
}

function flatDocument(tracks: InternalPaintTrack[], background?: Partial<EfxPaintDocument['background']>): EfxPaintDocument {
  const base = createEfxPaintDocument(FLAT_LAYER);
  const effectiveTracks = tracks.length > 0 ? tracks : [flatTrack('ghost-track', { visible: false })];
  return {
    ...base,
    activeTrackId: effectiveTracks[0]?.id ?? base.activeTrackId,
    tracks: effectiveTracks,
    background: { ...base.background, ...background },
  };
}

function seedRoto(
  trackId: string,
  keys: Array<{ keyId: string; appFrame: number; bytes: Uint8Array }>,
  options: { loopClips?: PhysicPaintRotoLoopClip[] } = {},
): void {
  const records = keys.map((key) => ({
    keyId: key.keyId,
    appFrame: key.appFrame,
    kind: 'real-key' as const,
    payload: { frameIndex: 0, appFrame: key.appFrame, bytes: key.bytes },
  }));
  const loopClips = options.loopClips ?? [];
  const interpolation = { enabled: false, mode: 'duplicate' as const };
  const result = physicPaintStore.replaceRotoPhysicalDocument(FLAT_LAYER, trackId, {
    capacity: 600,
    realKeyRecords: records,
    interpolation,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 0,
    loopClips,
    revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips),
  });
  if (!result.ok) throw new Error(result.error);
}

function renderMonitor(props: PhysicsPaintProgramMonitorProps): MonitorTestCanvas {
  runtime.beginRender();
  const tree = PhysicsPaintProgramMonitor(props) as unknown as { ref: { current: unknown } };
  const canvas = new MonitorTestCanvas();
  canvas.width = props.width;
  canvas.height = props.height;
  (tree.ref as { current: unknown }).current = canvas;
  runtime.flushEffects();
  return canvas;
}

function rerenderMonitor(props: PhysicsPaintProgramMonitorProps): void {
  runtime.beginRender();
  PhysicsPaintProgramMonitor(props);
  runtime.flushEffects();
}

const baseProps = (overrides: Partial<PhysicsPaintProgramMonitorProps> = {}): PhysicsPaintProgramMonitorProps => ({
  layerId: FLAT_LAYER,
  currentFrame: 5,
  isPlaying: false,
  activeTrackId: 'track-a',
  width: 4,
  height: 3,
  ...overrides,
});

beforeEach(() => {
  resetEfxPaintStore();
  clearProjectPaperRasterCache();
  _setPhysicPaintCompositorSizeProvider(() => ({ width: 4, height: 3 }));
  decodeWebpFrameMock.mockReset();
  decodeWebpFrameMock.mockImplementation(({ bytes }: { bytes: Uint8Array }) => ({ width: 4, height: 3, rgba: bytes }));
  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      if (tag === 'canvas') return new FlatTestCanvas([]);
      return {};
    },
  });
  vi.stubGlobal('Image', FlatTestImage);
  vi.stubGlobal('HTMLImageElement', FlatTestImage);
  vi.stubGlobal('HTMLCanvasElement', FlatTestCanvas);
  vi.stubGlobal('ImageData', class {
    constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
  });
  vi.stubGlobal('createImageBitmap', async (imageData: { data: Uint8ClampedArray }, _options: unknown) => {
    const seed = new TextDecoder().decode(imageData.data.slice(32));
    return new FlatTestBitmap(seed);
  });
  vi.stubGlobal('Blob', class extends OriginalBlob {
    constructor(parts: BlobPart[], options?: BlobPropertyBag) {
      super(parts, options);
      const part = parts[0];
      if (part instanceof Uint8Array) blobContentByBlob.set(this, part);
    }
  });
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
    const content = blobContentByBlob.get(blob as Blob);
    return content ? `blob:test:${new TextDecoder().decode(content.slice(32))}` : 'blob:test:empty';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  runtime = new PreactHookRuntime();
});

afterEach(() => {
  runtime.reset();
  physicPaintStore.reset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function drawCount(canvas: MonitorTestCanvas): number {
  return canvas.context.ops.filter((op) => op === 'draw').length;
}

describe('repro: playback after a hide/show round trip', () => {
  it('draws both layers on every playback tick across hide/show and scrub back', async () => {
    const A5 = makeFrame(0, 5).bytes;
    const B5 = makeFrame(1, 5).bytes;
    const A6 = makeFrame(2, 6).bytes;
    const B6 = makeFrame(3, 6).bytes;
    registerDocument(flatDocument([
      flatTrack('track-a', { order: 0 }),
      flatTrack('track-b', { order: 1 }),
    ], { visible: false }));
    seedRoto('track-a', [{ keyId: 'ka5', appFrame: 5, bytes: A5 }, { keyId: 'ka6', appFrame: 6, bytes: A6 }]);
    seedRoto('track-b', [{ keyId: 'kb5', appFrame: 5, bytes: B5 }, { keyId: 'kb6', appFrame: 6, bytes: B6 }]);
    // Prewarm the decode LRU so flattened records resolve synchronously.
    for (const bytes of [A5, B5, A6, B6]) physicPaintStore.getDecodedImage(bytes);
    await flushDecode();
    const getFlattenedFrame = vi.spyOn(physicPaintStore, 'getFlattenedFrame');

    const tick = signal<RotoCachedPlaybackTick<RenderedFramePayload> | null>({ frameIndex: 0, appFrame: 5, frame: null });
    const propsFor = (): PhysicsPaintProgramMonitorProps => baseProps({ isPlaying: true, activeTrackId: 'track-b', playbackTick: tick });

    const canvas = renderMonitor(propsFor());
    const lastRecord = (): EfxPaintFlattenedFrameRecord => getFlattenedFrame.mock.results[getFlattenedFrame.mock.results.length - 1]?.value as EfxPaintFlattenedFrameRecord;

    // Frame 5 (playback): full composite — both tracks.
    const rec5 = lastRecord();
    expect(rec5).not.toBeNull();
    const log5 = decodeFlatLog(await rec5.encodeBytes());
    console.log('F5 PLAY:', log5);
    expect(log5.match(/draw\(/g)?.length).toBe(2);
    expect(drawCount(canvas)).toBe(1);

    // Advance to frame 6 (playback continues): full composite again.
    tick.value = { frameIndex: 1, appFrame: 6, frame: null };
    rerenderMonitor(propsFor());
    const log6 = decodeFlatLog(await lastRecord().encodeBytes());
    console.log('F6 PLAY:', log6);
    expect(log6.match(/draw\(/g)?.length).toBe(2);
    expect(drawCount(canvas)).toBe(2);

    // Mid-playback deactivate: track-b hidden — one track only (truth table).
    const hideResult = setTrackVisible(FLAT_LAYER, 'track-b', false);
    expect(hideResult.ok).toBe(true);
    rerenderMonitor(propsFor());
    const logHidden = decodeFlatLog(await lastRecord().encodeBytes());
    console.log('F6 HIDDEN:', logHidden);
    expect(logHidden.match(/draw\(/g)?.length).toBe(1);
    expect(drawCount(canvas)).toBe(3);

    // Mid-playback activate: track-b visible again — BOTH tracks must redraw.
    const showResult = setTrackVisible(FLAT_LAYER, 'track-b', true);
    expect(showResult.ok).toBe(true);
    rerenderMonitor(propsFor());
    const logShown = decodeFlatLog(await lastRecord().encodeBytes());
    console.log('F6 SHOWN AGAIN:', logShown);
    expect(logShown.match(/draw\(/g)?.length).toBe(2);
    expect(drawCount(canvas)).toBe(4);

    // Scrub back to frame 5 while playing: full composite.
    tick.value = { frameIndex: 0, appFrame: 5, frame: null };
    rerenderMonitor(propsFor());
    const logBack = decodeFlatLog(await lastRecord().encodeBytes());
    console.log('F5 SCRUB BACK:', logBack);
    expect(logBack.match(/draw\(/g)?.length).toBe(2);
    expect(drawCount(canvas)).toBe(5);
  });
});
