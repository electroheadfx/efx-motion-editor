import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Layer } from '../types/layer';
import { defaultTransform } from '../types/layer';
import {
  physicPaintStore,
  _setPhysicPaintMarkDirtyCallback,
} from '../stores/physicPaintStore';
import { registerDocument, reset as resetEfxPaintStore } from '../stores/efxPaintStore';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
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
// 46-01: runtime state is per-track; tests exercise the document's ACTIVE track.
const TEST_TRACK_ID = 'track-1';

function makeTrackDocument(layerId: string): EfxPaintDocument {
  const document = createEfxPaintDocument(layerId);
  const track = document.tracks[0];
  return {
    ...document,
    activeTrackId: TEST_TRACK_ID,
    tracks: [{ ...track, id: TEST_TRACK_ID, frames: {}, rotoPhysical: null, loopClips: [] }],
  };
}

// Phase 48 Plan 03 Task 2 (D-09/CMP-01): preview/playback delivery through the
// flattened seam. A frame inside an unresolvable Loop Clip range renders as a
// TRANSPARENT straight-alpha raster — the store's flattened report (D-09)
// surfaces the missing source; the renderer surface NEVER carries marked
// placeholder pixels (#1A1A2A/#1A2A1A fills or a marker text were excised).
// Unrelated frames beside the loop render normally; nothing blocks or crashes.
// Node env, vitest run only; no jsdom, no config changes.

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
  private context: RecordingCanvasContext | null = null;

  getContext(contextId: string): RecordingCanvasContext | null {
    if (contextId !== '2d') return null;
    if (!this.context) this.context = new RecordingCanvasContext();
    return this.context;
  }

  // 48-03 D-11: the store's getFlattenedFrame serializes the composited raster
  // via toDataURL() — a deterministic op-log digest keeps that digest stable
  // across identical composition calls (same seam discipline as
  // exportEngine.loops.test.ts).
  toDataURL(): string {
    const operations = this.context?.operations ?? [];
    return `data:image/png;base64,${Buffer.from(JSON.stringify(operations)).toString('base64')}`;
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
  const recordsResult = physicPaintStore.replaceRotoPhysicalRecords(LAYER, TEST_TRACK_ID, records, interpolation, capacity);
  if (!recordsResult.ok) throw new Error(recordsResult.error);
  const loopsResult = physicPaintStore.replaceRotoPhysicalLoopClips(LAYER, TEST_TRACK_ID, loops);
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
  resetEfxPaintStore();
  registerDocument(makeTrackDocument(LAYER));
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
    const source = physicPaintStore.getRotoPhysicalRenderSource(LAYER, TEST_TRACK_ID, 1);
    // 48-03 D-09: the omitted occurrence resolves to transparent — the
    // flattened delivery is a straight-alpha raster with an empty missing-set
    // report (no content), and the renderer never emits placeholder marks.
    const flattened = physicPaintStore.getFlattenedFrame(LAYER, 1);
    const ctx = new RecordingCanvasContext();
    const renderer = new PreviewRenderer(makeCanvas(ctx));

    renderer.renderFrame([makeRotoLayer()], 1, [], 24, true, 1, 1);
    renderer.renderFrame([makeRotoLayer()], 1, [], 24, true, 1, 1);

    expect(source).toBeNull();
    expect(flattened).not.toBeNull();
    expect(flattened!.missing.map((entry) => entry.missingRefs)).toEqual([[]]);
    expect(ctx.operations.some((operation) => operation.type === 'fillText')).toBe(false);
    expect(ctx.operations.some((operation) => operation.type === 'fillRect' && (operation.fillStyle === '#1A1A2A' || operation.fillStyle === '#1A2A1A'))).toBe(false);
  });

  it('uses an exact override only at its accepted occurrence', () => {
    install(
      [record('A0', 0), record('A1', 3), record('override-5', 5, 'override')],
      [lifecycleGroup({
        visibleRanges: [{ start: 0, endExclusive: 12 }],
        frameOverrides: [{ appFrame: 5, keyId: 'override-5' }],
      })],
      { enabled: true, mode: 'duplicate' },
    );

    const override = physicPaintStore.getRotoPhysicalRenderSource(LAYER, TEST_TRACK_ID, 5);
    const neighbor = physicPaintStore.getRotoPhysicalRenderSource(LAYER, TEST_TRACK_ID, 6);

    expect(override).toEqual(expect.objectContaining({
      kind: 'real',
      appFrame: 5,
      keyId: 'override-5',
      renderedFrame: expect.objectContaining({ dataUrl: payload(5, 'override').dataUrl }),
    }));
    expect(neighbor).toEqual(expect.objectContaining({
      kind: 'generated',
      appFrame: 6,
      cycleOffset: 2,
    }));
    if (!neighbor || neighbor.kind !== 'generated') throw new Error('Expected generated Group neighbor.');
    expect(neighbor.renderedFrame.dataUrl).not.toBe(payload(5, 'override').dataUrl);
  });

  it('retains immutable phase while detached and reflects accepted regeneration immediately', () => {
    install(
      [record('A0', 0), record('A1', 3)],
      [lifecycleGroup({
        provenanceState: 'detached',
        visibleRanges: [{ start: 5, endExclusive: 12 }],
      })],
      { enabled: true, mode: 'duplicate' },
    );

    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, TEST_TRACK_ID, 5)).toEqual(expect.objectContaining({
      kind: 'generated',
      cycleOffset: 1,
    }));
    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, TEST_TRACK_ID, 7)).toEqual(expect.objectContaining({
      kind: 'real',
      keyId: 'A1',
    }));

    const regenerated = physicPaintStore.replaceRotoPhysicalLoopClips(LAYER, TEST_TRACK_ID, [lifecycleGroup({
      syncState: 'synchronized',
      visibleRanges: [{ start: 0, endExclusive: 12 }],
    })]);
    if (!regenerated.ok) throw new Error(regenerated.error);

    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, TEST_TRACK_ID, 1)).toEqual(expect.objectContaining({
      kind: 'generated',
      cycleOffset: 1,
    }));
  });

  it('keeps lifecycle gaps empty while visible unavailable occurrences remain marked placeholders', () => {
    install(
      [record('A0', 0)],
      [lifecycleGroup({
        sourceKeyIds: ['A0', 'missing-source'],
        visibleRanges: [
          { start: 0, endExclusive: 1 },
          { start: 2, endExclusive: 12 },
        ],
      })],
    );

    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, TEST_TRACK_ID, 1)).toBeNull();
    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, TEST_TRACK_ID, 2)).toEqual(expect.objectContaining({
      kind: 'loop-placeholder',
      loopId: 'group-a',
      missingSourceKeyIds: ['missing-source'],
    }));
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
    const sources = [13, 20, 31].map((frame) => physicPaintStore.getRotoPhysicalRenderSource(LAYER, TEST_TRACK_ID, frame));
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

describe('preview unresolved-loop delivery (D-09 — transparent raster, never placeholder)', () => {
  it('renders an unresolved loop frame through the flattened delivery as a transparent raster — never a marked placeholder', () => {
    installUnresolvedLoop();
    // D-09: the store surfaces the missing source via the flattened report —
    // the renderer surface itself carries NO placeholder pixels.
    const flattened = physicPaintStore.getFlattenedFrame(LAYER, 2);
    expect(flattened).not.toBeNull();
    expect(flattened!.missing).toContainEqual(expect.objectContaining({
      trackId: TEST_TRACK_ID,
      frame: 2,
      missingRefs: ['missing-1'],
    }));

    const ctx = new RecordingCanvasContext();
    const renderer = new PreviewRenderer(makeCanvas(ctx));

    renderer.renderFrame([makeRotoLayer()], 2, [], 24, true, 1, 2);
    renderer.renderFrame([makeRotoLayer()], 2, [], 24, true, 1, 2);

    // The flattened straight-alpha raster IS drawn (transparent pixels, D-02).
    expect(ctx.operations.some((op) => op.type === 'drawImage')).toBe(true);
    // No placeholder fill discipline, no marker text — excised per D-09.
    const fills = ctx.operations.filter((op): op is Extract<RecordedCanvasOp, { type: 'fillRect' }> => op.type === 'fillRect');
    expect(fills.some((op) => op.fillStyle === '#1A1A2A' || op.fillStyle === '#1A2A1A')).toBe(false);
    expect(ctx.operations.some((op) => op.type === 'fillText')).toBe(false);
  });

  it('an empty frame outside every loop range draws nothing marked (unresolved and empty remain distinct)', () => {
    installUnresolvedLoop();
    const ctx = new RecordingCanvasContext();
    const renderer = new PreviewRenderer(makeCanvas(ctx));

    renderer.renderFrame([makeRotoLayer()], 7, [], 24, true, 1, 7);

    expect(ctx.operations.filter((op) => op.type === 'fillRect')).toEqual([]);
    expect(ctx.operations.filter((op) => op.type === 'fillText')).toEqual([]);
  });

  it('playback continues past the unresolved range without blocking and neighboring real frames render normally on both sides', () => {
    installUnresolvedLoop();
    const ctx = new RecordingCanvasContext();
    const renderer = new PreviewRenderer(makeCanvas(ctx));

    // Scrub order: real key before the loop, the unresolved span, then the
    // real boundary key after the loop — every call returns synchronously.
    renderer.renderFrame([makeRotoLayer()], 0, [], 24, true, 1, 0);
    renderer.renderFrame([makeRotoLayer()], 0, [], 24, true, 1, 0);
    renderer.renderFrame([makeRotoLayer()], 1, [], 24, true, 1, 1);
    renderer.renderFrame([makeRotoLayer()], 2, [], 24, true, 1, 2);
    renderer.renderFrame([makeRotoLayer()], 10, [], 24, true, 1, 10);
    renderer.renderFrame([makeRotoLayer()], 10, [], 24, true, 1, 10);

    // Real keys on both sides paint their flattened rasters (load-then-draw:
    // the second pass paints from the image cache).
    const drawn = ctx.operations.filter((op): op is Extract<RecordedCanvasOp, { type: 'drawImage' }> => op.type === 'drawImage').map((op) => op.source);
    expect(drawn.length).toBeGreaterThan(0);
    // No placeholder marks anywhere on the renderer surface (D-09).
    expect(ctx.operations.some((op) => op.type === 'fillRect' && (op.fillStyle === '#1A1A2A' || op.fillStyle === '#1A2A1A'))).toBe(false);
    expect(ctx.operations.some((op) => op.type === 'fillText')).toBe(false);
    // The missing source is surfaced through the flattened report.
    expect(physicPaintStore.getFlattenedFrame(LAYER, 2)?.missing[0].missingRefs).toContain('missing-1');
  });

  it('the store never returns null-as-blank inside an unresolved loop range — the flattened report drives the transparent raster', () => {
    installUnresolvedLoop();
    const source = physicPaintStore.getRotoPhysicalRenderSource(LAYER, TEST_TRACK_ID, 3);
    expect(source).not.toBeNull();
    expect(source!.kind).toBe('loop-placeholder');

    const flattened = physicPaintStore.getFlattenedFrame(LAYER, 3);
    expect(flattened).not.toBeNull();
    expect(flattened!.missing).toContainEqual(expect.objectContaining({
      trackId: TEST_TRACK_ID,
      frame: 3,
      missingRefs: ['missing-1'],
    }));

    const ctx = new RecordingCanvasContext();
    const renderer = new PreviewRenderer(makeCanvas(ctx));
    renderer.renderFrame([makeRotoLayer()], 3, [], 24, true, 1, 3);
    renderer.renderFrame([makeRotoLayer()], 3, [], 24, true, 1, 3);
    // The transparent flattened raster is drawn — never placeholder marks.
    expect(ctx.operations.some((op) => op.type === 'drawImage')).toBe(true);
    expect(ctx.operations.some((op) => op.type === 'fillRect' && op.fillStyle === '#1A1A2A')).toBe(false);
    expect(ctx.operations.some((op) => op.type === 'fillText')).toBe(false);
  });
});
