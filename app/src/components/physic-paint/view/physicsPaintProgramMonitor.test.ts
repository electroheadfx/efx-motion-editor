import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreactHookRuntime } from '../../../test/preactHookRuntime';
import { PhysicsPaintProgramMonitor, type PhysicsPaintProgramMonitorProps } from './PhysicsPaintProgramMonitor';
import {
  physicPaintStore,
  physicPaintVersion,
  registerBackgroundSourceImage,
  _setPhysicPaintCompositorSizeProvider,
  type EfxPaintFlattenedFrameRecord,
} from '../../../stores/physicPaintStore';
import { registerDocument, reset as resetEfxPaintStore } from '../../../stores/efxPaintStore';
import { createEfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import type { EfxPaintDocument, InternalPaintTrack } from '../../../efx-paint/document/efxPaintDocument';
import type { PhysicPaintRotoLoopClip } from '../roto/physicsPaintRotoPhysicalModel';
import { buildPhysicPaintRotoPhysicalRevision } from '../roto/physicsPaintRotoPhysicalModel';
import { clearProjectPaperRasterCache } from '../../../lib/projectPaperRaster';

let runtime = new PreactHookRuntime();

// Route preact/hooks into the direct-component runtime so the monitor's
// useRef/useEffect are driven by the test, not a real component tree.
vi.mock('preact/hooks', () => ({
  useState: <T,>(initial: T | (() => T)) => runtime.useState(initial),
  useRef: <T,>(initial: T) => runtime.useRef(initial),
  useMemo: <T,>(factory: () => T, deps: unknown[]) => runtime.useMemo(factory, deps),
  useCallback: <T,>(callback: T, deps: unknown[]) => runtime.useCallback(callback, deps),
  useEffect: (effect: () => void | (() => void), deps?: unknown[]) => runtime.useEffect(effect, deps),
}));

/**
 * Phase 48-05 Task 1: PhysicsPaintProgramMonitor — narrow leaf canvas tests.
 *
 * The node environment has no canvas/Image, so the store's flattened composite
 * path AND the monitor's own raster decode run against recording doubles
 * (mirroring physicPaintStore.test.ts's flattened harness): document.createElement
 * returns a FlatTestCanvas whose toDataURL is a DETERMINISTIC serialization of
 * the recorded draw log, and Image is a synchronous onload stub. The monitor's
 * own <canvas> is stubbed by assigning a MonitorTestCanvas to the returned
 * VNode's ref (the PreactHookRuntime pattern from
 * PhysicsPaintCanvasMount.runtime.test.ts), so each effect run's
 * clearRect/drawImage is observable.
 *
 * Tests (a)-(e) per the plan: (a) playback draws the full flattened frame;
 * (b) editing draws the active-track-excluded composite; (c) same cacheKey
 * twice draws once (compare-then-draw); (d) pending decode (null) keeps the
 * last drawn frame; (e) hidden active track → base excludes it.
 */

const FLAT_LAYER = 'flat-layer';

const makeFrame = (frameIndex: number, appFrame: number) => ({
  frameIndex,
  appFrame,
  dataUrl: `data:image/png;base64,${btoa(`frame-${frameIndex}`)}`,
  width: 1000,
  height: 650,
});

type FlatOp =
  | { type: 'clearRect' }
  | { type: 'save' }
  | { type: 'restore' }
  | { type: 'fillRect'; fillStyle: string; globalAlpha: number; globalCompositeOperation: GlobalCompositeOperation }
  | { type: 'drawImage'; source: string; globalAlpha: number; globalCompositeOperation: GlobalCompositeOperation };

class FlatRecordingContext {
  readonly ops: FlatOp[];
  constructor(ops: FlatOp[] = []) { this.ops = ops; }
  fillStyle: string | CanvasGradient | CanvasPattern = '#000000';
  globalAlpha = 1;
  globalCompositeOperation: GlobalCompositeOperation = 'source-over';
  private stack: Array<Pick<FlatRecordingContext, 'fillStyle' | 'globalAlpha' | 'globalCompositeOperation'>> = [];

  save(): void {
    this.ops.push({ type: 'save' });
    this.stack.push({ fillStyle: this.fillStyle, globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation });
  }
  restore(): void {
    this.ops.push({ type: 'restore' });
    const top = this.stack.pop();
    if (!top) return;
    this.fillStyle = top.fillStyle;
    this.globalAlpha = top.globalAlpha;
    this.globalCompositeOperation = top.globalCompositeOperation;
  }
  clearRect(): void { this.ops.push({ type: 'clearRect' }); }
  fillRect(): void { this.ops.push({ type: 'fillRect', fillStyle: String(this.fillStyle), globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation }); }
  drawImage(source?: unknown): void {
    const sourceLabel = source !== null && typeof source === 'object' && 'src' in source
      ? String((source as { src: unknown }).src)
      : 'canvas';
    this.ops.push({ type: 'drawImage', source: sourceLabel, globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation });
  }
  createPattern(): CanvasPattern { return 'pattern' as unknown as CanvasPattern; }
}

class FlatTestCanvas {
  width = 0;
  height = 0;
  constructor(readonly ops: FlatOp[]) {}
  getContext(kind: string): FlatRecordingContext | null { return kind === '2d' ? new FlatRecordingContext(this.ops) : null; }
  toDataURL(): string {
    const log = this.ops.map((op) => {
      switch (op.type) {
        case 'clearRect': return 'clear';
        case 'save': return 'save';
        case 'restore': return 'restore';
        case 'fillRect': return `fill(${op.fillStyle},${op.globalAlpha},${op.globalCompositeOperation})`;
        case 'drawImage': return `draw(${op.source},${op.globalAlpha},${op.globalCompositeOperation})`;
      }
    }).join('|');
    return `data:image/png;base64,${log}`;
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

class DeferredFlatTestImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin = '';
  width = 4;
  height = 3;
  static instances: DeferredFlatTestImage[] = [];
  private currentSrc = '';
  constructor() { DeferredFlatTestImage.instances.push(this); }
  set src(value: string) { this.currentSrc = value; }
  get src(): string { return this.currentSrc; }
}

/** The monitor's own <canvas>: records clear/draw ops per effect run. */
class MonitorTestContext {
  readonly ops: string[] = [];
  clearRect(): void { this.ops.push('clear'); }
  drawImage(): void { this.ops.push('draw'); }
}

class MonitorTestCanvas {
  width = 0;
  height = 0;
  constructor(readonly context = new MonitorTestContext()) {}
  getContext(kind: string): MonitorTestContext | null { return kind === '2d' ? this.context : null; }
}

function flatTrack(id: string, overrides: Partial<Omit<InternalPaintTrack, 'id'>> = {}): InternalPaintTrack {
  return {
    id,
    name: id,
    order: 0,
    visible: true,
    solo: false,
    opacity: 1,
    blendMode: 'normal',
    revision: 0,
    frames: {},
    rotoPhysical: null,
    loopClips: [],
    ...overrides,
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
  keys: Array<{ keyId: string; appFrame: number; dataUrl: string }>,
  options: { loopClips?: PhysicPaintRotoLoopClip[] } = {},
): void {
  const records = keys.map((key) => ({
    keyId: key.keyId,
    appFrame: key.appFrame,
    kind: 'real-key' as const,
    payload: { frameIndex: 0, appFrame: key.appFrame, dataUrl: key.dataUrl },
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

/** Invoke the component and mount the recording canvas onto its canvas ref. */
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

/** Re-render (same runtime, ref retained) and flush the refresh effect. */
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
  DeferredFlatTestImage.instances = [];
  clearProjectPaperRasterCache();
  _setPhysicPaintCompositorSizeProvider(() => ({ width: 4, height: 3 }));
  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      if (tag === 'canvas') return new FlatTestCanvas([]);
      return {};
    },
  });
  vi.stubGlobal('Image', FlatTestImage);
  vi.stubGlobal('HTMLImageElement', FlatTestImage);
  vi.stubGlobal('HTMLCanvasElement', FlatTestCanvas);
  runtime = new PreactHookRuntime();
});

afterEach(() => {
  runtime.reset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function drawCount(canvas: MonitorTestCanvas): number {
  return canvas.context.ops.filter((op) => op === 'draw').length;
}

describe('PhysicsPaintProgramMonitor', () => {
  it('(a) playback mode draws the full flattened frame for the current frame', () => {
    const frameA = makeFrame(0, 5).dataUrl;
    const frameB = makeFrame(1, 5).dataUrl;
    registerDocument(flatDocument([
      flatTrack('track-a', { order: 0 }),
      flatTrack('track-b', { order: 1 }),
    ], { visible: false }));
    seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, dataUrl: frameA }]);
    seedRoto('track-b', [{ keyId: 'kb', appFrame: 5, dataUrl: frameB }]);
    const getFlattenedFrame = vi.spyOn(physicPaintStore, 'getFlattenedFrame');
    const getFlattenedFrameExcluding = vi.spyOn(physicPaintStore, 'getFlattenedFrameExcluding');

    const canvas = renderMonitor(baseProps({ isPlaying: true }));

    // The full flattened path (INCLUDING the active track) is the only source.
    expect(getFlattenedFrame).toHaveBeenCalledWith(FLAT_LAYER, 5);
    expect(getFlattenedFrameExcluding).not.toHaveBeenCalled();
    const record = getFlattenedFrame.mock.results[0]?.value as EfxPaintFlattenedFrameRecord;
    expect(record).not.toBeNull();
    // Full composite: both tracks draw.
    expect(record.renderedFrame.dataUrl.match(/draw\(/g)?.length).toBe(2);
    // The monitor drew the record's raster into its canvas exactly once.
    expect(drawCount(canvas)).toBe(1);
  });

  it('(b) editing mode draws the active-track-excluded composite', () => {
    const frameA = makeFrame(0, 5).dataUrl;
    const frameB = makeFrame(1, 5).dataUrl;
    registerDocument(flatDocument([
      flatTrack('track-a', { order: 0 }),
      flatTrack('track-b', { order: 1 }),
    ], { visible: false }));
    seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, dataUrl: frameA }]);
    seedRoto('track-b', [{ keyId: 'kb', appFrame: 5, dataUrl: frameB }]);
    const getFlattenedFrame = vi.spyOn(physicPaintStore, 'getFlattenedFrame');
    const getFlattenedFrameExcluding = vi.spyOn(physicPaintStore, 'getFlattenedFrameExcluding');

    const canvas = renderMonitor(baseProps({ isPlaying: false }));

    // The editing base threads the active track through the exclude set.
    expect(getFlattenedFrame).not.toHaveBeenCalled();
    expect(getFlattenedFrameExcluding).toHaveBeenCalledTimes(1);
    const [calledLayerId, calledFrame, calledExclude] = getFlattenedFrameExcluding.mock.calls[0];
    expect(calledLayerId).toBe(FLAT_LAYER);
    expect(calledFrame).toBe(5);
    expect(calledExclude.has('track-a')).toBe(true);
    const record = getFlattenedFrameExcluding.mock.results[0]?.value as EfxPaintFlattenedFrameRecord;
    // The active track's pixels never reach the base (T-48-16).
    expect(record.renderedFrame.dataUrl.match(/draw\(/g)?.length).toBe(1);
    expect(record.renderedFrame.dataUrl).not.toContain(frameA);
    expect(record.renderedFrame.dataUrl).toContain(frameB);
    expect(drawCount(canvas)).toBe(1);
  });

  it('(c) drawing the same flattened cacheKey twice is a no-op', () => {
    registerDocument(flatDocument([flatTrack('track-a')], { visible: false }));
    seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, dataUrl: makeFrame(0, 5).dataUrl }]);

    const canvas = renderMonitor(baseProps());
    expect(drawCount(canvas)).toBe(1);

    // Same store state → same cacheKey. A version-clock bump re-runs the
    // refresh effect, but the compare-then-draw guard skips the second draw.
    physicPaintVersion.value++;
    rerenderMonitor(baseProps());

    expect(drawCount(canvas)).toBe(1);
  });

  it('(d) a pending decode (null) keeps the last drawn frame', () => {
    registerDocument(flatDocument([flatTrack('track-a')], { visible: false }));
    seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, dataUrl: makeFrame(0, 5).dataUrl }]);

    const canvas = renderMonitor(baseProps());
    expect(drawCount(canvas)).toBe(1);

    // Introduce a registered-but-not-yet-decoded background source with a
    // deferred decode: this tick the store returns null.
    vi.stubGlobal('Image', DeferredFlatTestImage);
    vi.stubGlobal('HTMLImageElement', DeferredFlatTestImage);
    registerBackgroundSourceImage('bg-ref-pending', makeFrame(2, 0).dataUrl);
    registerDocument(flatDocument([flatTrack('track-a')], {
      visible: true,
      clips: [{ id: 'clip-1', startFrame: 0, sourceFrameRefs: ['bg-ref-pending'], repeat: { mode: 'finite', count: 1 }, sourceKind: 'imported-background', revision: 1 }],
    }));

    // registerDocument bumps efxPaintVersion → the effect re-runs → null →
    // keep the last drawn frame (no flicker-to-blank).
    rerenderMonitor(baseProps());
    expect(drawCount(canvas)).toBe(1);

    // Completing the pending decode bumps physicPaintVersion → the effect now
    // draws the completed flattened frame.
    const pendingImage = DeferredFlatTestImage.instances[0];
    expect(pendingImage).toBeDefined();
    pendingImage.onload?.();
    rerenderMonitor(baseProps());
    expect(drawCount(canvas)).toBe(2);
  });

  it('(e) a hidden active track is excluded from the editing base', () => {
    const frameA = makeFrame(0, 5).dataUrl;
    const frameB = makeFrame(1, 5).dataUrl;
    registerDocument(flatDocument([
      flatTrack('track-a', { order: 0, visible: false }),
      flatTrack('track-b', { order: 1 }),
    ], { visible: false }));
    seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, dataUrl: frameA }]);
    seedRoto('track-b', [{ keyId: 'kb', appFrame: 5, dataUrl: frameB }]);
    const getFlattenedFrameExcluding = vi.spyOn(physicPaintStore, 'getFlattenedFrameExcluding');

    const canvas = renderMonitor(baseProps({ activeTrackId: 'track-a' }));

    // The monitor still threads the hidden active track through the exclude
    // set — the store's truth table already removed it from participating, so
    // its pixels never appear in the base.
    expect(getFlattenedFrameExcluding).toHaveBeenCalledTimes(1);
    const excludeSet = getFlattenedFrameExcluding.mock.calls[0][2];
    expect(excludeSet.has('track-a')).toBe(true);
    const record = getFlattenedFrameExcluding.mock.results[0]?.value as EfxPaintFlattenedFrameRecord;
    expect(record.renderedFrame.dataUrl.match(/draw\(/g)?.length).toBe(1);
    expect(record.renderedFrame.dataUrl).not.toContain(frameA);
    expect(record.renderedFrame.dataUrl).toContain(frameB);
    expect(drawCount(canvas)).toBe(1);
  });
});
