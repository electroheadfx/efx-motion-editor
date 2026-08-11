import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Layer } from '../types/layer';
import { defaultTransform } from '../types/layer';
import {
  physicPaintStore,
  _setPhysicPaintMarkDirtyCallback,
} from '../stores/physicPaintStore';
import type {
  PhysicPaintRotoLoopClip,
  PhysicPaintRotoRealKeyPayload,
  PhysicPaintRotoRealKeyRecord,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';

vi.mock('../stores/paintStore', () => ({
  paintStore: { getFrame: vi.fn(() => null) },
}));

vi.mock('../stores/projectStore', () => ({
  projectStore: {
    width: { peek: () => 4, value: 4 },
    height: { peek: () => 3, value: 3 },
  },
}));

import { PreviewRenderer, getPreviewPhysicPaintFrameCacheKey } from './previewRenderer';
import { clearProjectPaperRasterCache } from './projectPaperRaster';
import { getPhysicsPaintRotoSourceCycleId } from '../components/physic-paint/roto/physicsPaintRotoSpacingSelection';

// Phase 43 Plan 09 Task 2: D-28 preview/playback placeholder surface. A frame
// inside an unresolvable Loop Clip range renders as a MARKED, VISIBLE
// placeholder (the TimelineRenderer placeholder fill discipline: alternating
// #1A1A2A/#1A2A1A plus a marker) — never a blank frame, never a crash, never
// blocking; unrelated frames beside the loop render normally. Node env,
// vitest run only; no jsdom, no config changes.

type RecordedCanvasOp =
  | { type: 'fillRect'; fillStyle: string; globalAlpha: number; args: number[] }
  | { type: 'drawImage'; source: string; args: number[] }
  | { type: 'fillText'; text: string; args: number[] }
  | { type: 'clearRect' }
  | { type: 'save' }
  | { type: 'restore' }
  | { type: 'scale' };

class RecordingCanvasContext {
  operations: RecordedCanvasOp[] = [];
  fillStyle: string | CanvasGradient | CanvasPattern = '#000000';
  globalAlpha = 1;
  globalCompositeOperation: GlobalCompositeOperation = 'source-over';
  font = '';
  textAlign = 'left';
  textBaseline = 'alphabetic';

  save(): void { this.operations.push({ type: 'save' }); }
  restore(): void { this.operations.push({ type: 'restore' }); }
  scale(): void { this.operations.push({ type: 'scale' }); }
  clearRect(): void { this.operations.push({ type: 'clearRect' }); }
  fillRect(...args: number[]): void {
    this.operations.push({ type: 'fillRect', fillStyle: String(this.fillStyle), globalAlpha: this.globalAlpha, args });
  }
  drawImage(source?: CanvasImageSource, ...args: number[]): void {
    this.operations.push({
      type: 'drawImage',
      source: source instanceof TestImage ? source.src : source instanceof TestCanvas ? 'canvas' : 'unknown',
      args,
    });
  }
  fillText(text: string, ...args: number[]): void {
    this.operations.push({ type: 'fillText', text, args });
  }
}

class TestCanvas {
  width = 0;
  height = 0;
  clientWidth = 0;
  clientHeight = 0;
  offsetWidth = 0;
  offsetHeight = 0;

  getContext(contextId: string): RecordingCanvasContext | null {
    return contextId === '2d' ? new RecordingCanvasContext() : null;
  }
}

class TestImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin = '';
  private currentSrc = '';

  set src(value: string) {
    this.currentSrc = value;
    this.onload?.();
  }

  get src(): string {
    return this.currentSrc;
  }
}

function makeCanvas(ctx: RecordingCanvasContext): HTMLCanvasElement {
  return {
    width: 4,
    height: 3,
    clientWidth: 4,
    clientHeight: 3,
    offsetWidth: 4,
    offsetHeight: 3,
    getContext: (contextId: string) => contextId === '2d' ? ctx : null,
  } as unknown as HTMLCanvasElement;
}

const LAYER = 'roto-loop-preview-layer';
const CAPACITY = 30;
const INTERPOLATION = { enabled: false, mode: 'duplicate' } as const;

function payload(appFrame: number, tag = 'base'): PhysicPaintRotoRealKeyPayload {
  return {
    frameIndex: 0,
    appFrame,
    dataUrl: `data:image/png;base64,${btoa(`loop-preview:${appFrame}:${tag}`)}`,
    width: 4,
    height: 3,
  };
}

function record(keyId: string, appFrame: number, tag = 'base'): PhysicPaintRotoRealKeyRecord {
  return { kind: 'real-key', keyId, appFrame, payload: payload(appFrame, tag) };
}

function loopClip(
  loopId: string,
  placementStart: number,
  sourceKeyIds: readonly string[],
  repeat: number | 'infinity',
  cycleLength = sourceKeyIds.length,
): PhysicPaintRotoLoopClip {
  const base = { loopId, placementStart, sourceKeyIds, repeat, mode: 'progressive' as const };
  if (repeat === 'infinity') return base;
  const originalEndExclusive = placementStart + cycleLength * repeat;
  return {
    ...base,
    syncState: 'synchronized',
    provenanceState: 'attached',
    phaseOrigin: placementStart,
    originalEndExclusive,
    visibleRanges: [{ start: placementStart, endExclusive: originalEndExclusive }],
    frameOverrides: [],
  };
}

function lifecycleGroup(
  overrides: Partial<PhysicPaintRotoLoopClip> = {},
): PhysicPaintRotoLoopClip {
  return {
    loopId: 'group-a',
    placementStart: 0,
    sourceKeyIds: ['A0', 'A1'],
    repeat: 3,
    mode: 'progressive',
    syncState: 'modified',
    provenanceState: 'attached',
    phaseOrigin: 0,
    originalEndExclusive: 12,
    visibleRanges: [
      { start: 0, endExclusive: 1 },
      { start: 2, endExclusive: 12 },
    ],
    frameOverrides: [],
    ...overrides,
  };
}

function install(
  records: readonly PhysicPaintRotoRealKeyRecord[],
  loops: readonly PhysicPaintRotoLoopClip[],
  interpolation: { readonly enabled: boolean; readonly mode: 'duplicate' | 'blend' } = INTERPOLATION,
  capacity = CAPACITY,
): void {
  const recordsResult = physicPaintStore.replaceRotoPhysicalRecords(LAYER, records, interpolation, capacity);
  if (!recordsResult.ok) throw new Error(recordsResult.error);
  const loopsResult = physicPaintStore.replaceRotoPhysicalLoopClips(LAYER, loops);
  if (!loopsResult.ok) throw new Error(loopsResult.error);
}

function makeRotoLayer(): Layer {
  return {
    id: LAYER,
    name: 'Roto',
    type: 'physic-paint',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: defaultTransform(),
    source: { type: 'physic-paint', layerId: LAYER },
  };
}

beforeEach(() => {
  _setPhysicPaintMarkDirtyCallback(() => {});
  physicPaintStore.reset();
  clearProjectPaperRasterCache();
  vi.stubGlobal('window', { devicePixelRatio: 1 });
  vi.stubGlobal('document', { createElement: (tag: string) => tag === 'canvas' ? new TestCanvas() : {} });
  vi.stubGlobal('Image', TestImage);
  vi.stubGlobal('HTMLImageElement', TestImage);
  vi.stubGlobal('HTMLCanvasElement', TestCanvas);
  vi.stubGlobal('HTMLVideoElement', class {});
});

afterEach(() => {
  physicPaintStore.reset();
  vi.unstubAllGlobals();
});

/**
 * Unresolved-loop fixture (mirrors the store spec): owned real key A at frame
 * 0, non-owned boundary key C at frame 10, and a loop over [A, missing-1]
 * x 3 repeats. The loop's effective range is [0, 6): frame 0 is real, frames
 * 1-5 resolve 'linked-unresolved', frames 6-9 are empty, frame 10 is real.
 */
function installUnresolvedLoop(): void {
  install(
    [record('A', 0), record('C', 10)],
    [loopClip('loop-x', 0, ['A', 'missing-1'], 3)],
  );
}

describe('preview accepted Group lifecycle parity', () => {
  it('keeps an omitted Group occurrence empty even when the ordinary projection has a generated cell there', () => {
    install(
      [record('A0', 0), record('A1', 3)],
      [lifecycleGroup()],
      { enabled: true, mode: 'duplicate' },
    );
    const source = physicPaintStore.getRotoPhysicalRenderSource(LAYER, 1);
    const ctx = new RecordingCanvasContext();
    const renderer = new PreviewRenderer(makeCanvas(ctx));

    renderer.renderFrame([makeRotoLayer()], 1, [], 24, true, 1, 1);
    renderer.renderFrame([makeRotoLayer()], 1, [], 24, true, 1, 1);

    expect(source).toBeNull();
    expect(ctx.operations.some((operation) => operation.type === 'drawImage')).toBe(false);
    expect(ctx.operations.some((operation) => operation.type === 'fillText')).toBe(false);
  });
});

describe('preview linked-generated cache identity', () => {
  it('shares one key for the same ordered cycle and separates distinct cycles with matching adjacent IDs and cycle offset', () => {
    install(
      [record('A', 0), record('B', 3), record('C', 6), record('D', 9)],
      [
        loopClip('loop-abc', 12, ['A', 'B', 'C'], 2, 7),
        loopClip('loop-abd', 30, ['A', 'B', 'D'], 1, 10),
      ],
      { enabled: true, mode: 'duplicate' },
      50,
    );
    const sources = [13, 20, 31].map((frame) => physicPaintStore.getRotoPhysicalRenderSource(LAYER, frame));
    for (const source of sources) {
      if (!source || source.kind !== 'generated') throw new Error('Expected linked-generated preview source.');
    }
    const [first, repeated, distinct] = sources as Array<Extract<NonNullable<(typeof sources)[number]>, { kind: 'generated' }>>;
    const previewKey = (source: typeof first) => getPreviewPhysicPaintFrameCacheKey({
      layerId: LAYER,
      frame: source.appFrame,
      cacheKey: `physic-paint:${LAYER}:physical:${source.cacheRevision}`,
      renderedFrame: source.renderedFrame,
    });

    expect(first.sourceCycleId).toBe(getPhysicsPaintRotoSourceCycleId(['A', 'B', 'C']));
    expect(repeated.sourceCycleId).toBe(first.sourceCycleId);
    expect(distinct.sourceCycleId).toBe(getPhysicsPaintRotoSourceCycleId(['A', 'B', 'D']));
    expect(previewKey(first)).toBe(previewKey(repeated));
    expect(previewKey(distinct)).not.toBe(previewKey(first));
  });
});

describe('preview loop placeholder (D-28, audit finding 3)', () => {
  it('renders an unresolved loop frame as a marked, visible placeholder — never a blank frame', () => {
    installUnresolvedLoop();
    const ctx = new RecordingCanvasContext();
    const renderer = new PreviewRenderer(makeCanvas(ctx));

    renderer.renderFrame([makeRotoLayer()], 2, [], 24, true, 1, 2);

    const fills = ctx.operations.filter((op): op is Extract<RecordedCanvasOp, { type: 'fillRect' }> => op.type === 'fillRect');
    // The placeholder fill discipline: full-frame PLACEHOLDER_BG_A base...
    expect(fills).toContainEqual(expect.objectContaining({
      fillStyle: '#1A1A2A',
      args: [0, 0, 4, 3],
    }));
    // ...with alternating PLACEHOLDER_BG_B marker stripes...
    expect(fills.some((op) => op.fillStyle === '#1A2A1A')).toBe(true);
    // ...and a visible marker text distinguishing it from an empty frame.
    expect(ctx.operations).toContainEqual(expect.objectContaining({ type: 'fillText' }));
    // A placeholder is never painted from a real Paint raster.
    expect(ctx.operations.some((op) => op.type === 'drawImage')).toBe(false);
  });

  it('an empty frame outside every loop range renders no placeholder marks (placeholder is distinct from empty)', () => {
    installUnresolvedLoop();
    const ctx = new RecordingCanvasContext();
    const renderer = new PreviewRenderer(makeCanvas(ctx));

    renderer.renderFrame([makeRotoLayer()], 7, [], 24, true, 1, 7);

    expect(ctx.operations.filter((op) => op.type === 'fillRect')).toEqual([]);
    expect(ctx.operations.filter((op) => op.type === 'fillText')).toEqual([]);
  });

  it('playback continues past the placeholder without blocking and neighboring real frames render normally on both sides', () => {
    installUnresolvedLoop();
    const ctx = new RecordingCanvasContext();
    const renderer = new PreviewRenderer(makeCanvas(ctx));

    // Scrub order: real key before the loop, two placeholder frames, then the
    // real boundary key after the loop — every call returns synchronously.
    renderer.renderFrame([makeRotoLayer()], 0, [], 24, true, 1, 0);
    renderer.renderFrame([makeRotoLayer()], 0, [], 24, true, 1, 0);
    renderer.renderFrame([makeRotoLayer()], 1, [], 24, true, 1, 1);
    renderer.renderFrame([makeRotoLayer()], 2, [], 24, true, 1, 2);
    renderer.renderFrame([makeRotoLayer()], 10, [], 24, true, 1, 10);
    renderer.renderFrame([makeRotoLayer()], 10, [], 24, true, 1, 10);

    // The real keys on both sides of the unresolved range paint their own
    // rasters (load-then-draw: the second pass paints from the image cache).
    const drawn = ctx.operations.filter((op): op is Extract<RecordedCanvasOp, { type: 'drawImage' }> => op.type === 'drawImage').map((op) => op.source);
    expect(drawn).toContain(payload(0).dataUrl);
    expect(drawn).toContain(payload(10).dataUrl);
    // Placeholder marks appear between the two real frames.
    const firstPlaceholderFill = ctx.operations.findIndex((op) => op.type === 'fillRect' && op.fillStyle === '#1A1A2A');
    expect(firstPlaceholderFill).toBeGreaterThan(-1);
  });

  it('the store never returns null-as-blank inside an unresolved loop range — the typed placeholder variant drives the marked frame', () => {
    installUnresolvedLoop();
    const source = physicPaintStore.getRotoPhysicalRenderSource(LAYER, 3);
    expect(source).not.toBeNull();
    expect(source!.kind).toBe('loop-placeholder');

    const ctx = new RecordingCanvasContext();
    const renderer = new PreviewRenderer(makeCanvas(ctx));
    renderer.renderFrame([makeRotoLayer()], 3, [], 24, true, 1, 3);
    // The placeholder frame produces visible paint calls — never zero ops.
    expect(ctx.operations.length).toBeGreaterThan(0);
    expect(ctx.operations.some((op) => op.type === 'fillRect' && op.fillStyle === '#1A1A2A')).toBe(true);
  });
});
