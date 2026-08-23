import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  physicPaintStore,
  _setPhysicPaintMarkDirtyCallback,
} from '../stores/physicPaintStore';
import { registerDocument, reset as resetEfxPaintStore } from '../stores/efxPaintStore';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { exportStore } from '../stores/exportStore';
import type {
  PhysicPaintRotoLoopClip,
  PhysicPaintRotoPhysicalRenderSource,
  PhysicPaintRotoRealKeyPayload,
  PhysicPaintRotoRealKeyRecord,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import { defaultTransform, type Layer } from '../types/layer';
import type { Sequence } from '../types/sequence';
import type { FrameEntry } from '../types/timeline';

// Phase 43 Plan 09 Task 1: D-28 export preflight (failure path) + D-27
// preview/export parity for valid loops (success path). Node env, vitest run
// only; no jsdom, no config changes. The physic-paint store is real; Tauri
// IPC, the frameMap signal, and the surrounding stores are mocked. The
// exportRenderer module is mocked for the failure path (zero renderer
// invocations on block) and imported for-real via importActual for the parity
// path (the export render loop must exercise the real per-frame seam).

const hoisted = vi.hoisted(() => ({
  fm: [] as FrameEntry[],
  sequences: [] as Sequence[],
  activeSequenceId: 'seq-1',
}));

vi.mock('./ipc', () => ({
  exportCreateDir: vi.fn(async () => ({ ok: true as const, data: '/tmp/efx-export-loops-test' })),
  exportWritePng: vi.fn(async () => ({ ok: true as const })),
  exportCheckFfmpeg: vi.fn(async () => ({ ok: true as const, data: true })),
  exportDownloadFfmpeg: vi.fn(async () => ({ ok: true as const })),
  exportEncodeVideo: vi.fn(async () => ({ ok: true as const })),
  exportCleanupPngs: vi.fn(async () => ({ ok: true as const })),
  exportCleanupFile: vi.fn(async () => ({ ok: true as const })),
  assetUrl: (path: string) => path,
}));

vi.mock('./frameMap', () => ({
  frameMap: { peek: () => hoisted.fm },
  crossDissolveOverlaps: { peek: () => [] },
  getTimelineOverlaySequenceOutFrame: (seq: { outFrame?: number }, fallback: number) => seq.outFrame ?? fallback,
}));

vi.mock('../stores/sequenceStore', () => ({
  sequenceStore: {
    sequences: { peek: () => hoisted.sequences },
    activeSequenceId: { peek: () => hoisted.activeSequenceId },
  },
}));

vi.mock('../stores/projectStore', () => ({
  projectStore: {
    name: { peek: () => 'Loop Export Project' },
    width: { peek: () => 4, value: 4 },
    height: { peek: () => 3, value: 3 },
    fps: { peek: () => 24 },
  },
}));

vi.mock('../stores/audioStore', () => ({ audioStore: { tracks: { peek: () => [] } } }));
vi.mock('../stores/soloStore', () => ({ soloStore: { soloEnabled: { peek: () => false } } }));
vi.mock('./audioEngine', () => ({ audioEngine: { getBuffer: () => null } }));
vi.mock('./exportSidecar', () => ({ generateJsonSidecar: () => '{}', generateFcpxml: () => '' }));
vi.mock('./audioExportMixer', () => ({ renderMixedAudio: vi.fn(async () => new Uint8Array()) }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ label: 'main' }) }));
vi.mock('../stores/paintStore', () => ({ paintStore: { getFrame: vi.fn(() => null) } }));

vi.mock('./exportRenderer', () => ({
  renderGlobalFrame: vi.fn(),
  renderFrameWithMotionBlur: vi.fn(),
  preloadExportImages: vi.fn(async () => {}),
}));

import { startExport, resumeExport } from './exportEngine';
import {
  renderGlobalFrame as renderGlobalFrameMock,
  renderFrameWithMotionBlur as renderFrameWithMotionBlurMock,
  preloadExportImages as preloadExportImagesMock,
} from './exportRenderer';
import { exportCreateDir as exportCreateDirMock } from './ipc';
import { PreviewRenderer } from './previewRenderer';
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

// --- Minimal canvas/image harness (same discipline as previewRenderer.test.ts) ---

type RecordedCanvasOp =
  | { type: 'fillRect'; fillStyle: string; args: number[] }
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
  setTransform(): void { /* recorded paths never assert transforms */ }
  fillRect(...args: number[]): void {
    this.operations.push({ type: 'fillRect', fillStyle: String(this.fillStyle), args });
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
  width = 4;
  height = 3;
  clientWidth = 0;
  clientHeight = 0;
  offsetWidth = 0;
  offsetHeight = 0;
  readonly ctx = new RecordingCanvasContext();

  getContext(contextId: string): RecordingCanvasContext | null {
    return contextId === '2d' ? this.ctx : null;
  }

  toBlob(callback: (blob: Blob | null) => void): void {
    callback(new Blob(['png-bytes'], { type: 'image/png' }));
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

// --- Store fixtures (same discipline as physicPaintStore.rotoLoopClips.test.ts) ---

const LAYER = 'roto-loop-export-layer';
const CAPACITY = 30;
const INTERPOLATION = { enabled: false, mode: 'duplicate' } as const;

function payload(appFrame: number, tag = 'base'): PhysicPaintRotoRealKeyPayload {
  return {
    frameIndex: 0,
    appFrame,
    dataUrl: `data:image/png;base64,${btoa(`loop-export:${appFrame}:${tag}`)}`,
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
  mode: 'progressive' | 'static' = 'progressive',
): PhysicPaintRotoLoopClip {
  return { loopId, placementStart, sourceKeyIds, repeat, mode };
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
    provenanceState: 'detached',
    phaseOrigin: 0,
    originalEndExclusive: 6,
    visibleRanges: [
      { start: 0, endExclusive: 2 },
      { start: 3, endExclusive: 6 },
    ],
    frameOverrides: [{ appFrame: 3, keyId: 'override-3' }],
    ...overrides,
  };
}

function install(records: readonly PhysicPaintRotoRealKeyRecord[], loops: readonly PhysicPaintRotoLoopClip[], capacity = CAPACITY): void {
  const recordsResult = physicPaintStore.replaceRotoPhysicalRecords(LAYER, TEST_TRACK_ID, records, INTERPOLATION, capacity);
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

function makeSequence(layers: Layer[]): Sequence {
  return {
    id: 'seq-1',
    kind: 'content',
    name: 'Seq',
    fps: 24,
    width: 4,
    height: 3,
    keyPhotos: [],
    layers,
  };
}

function makeFm(count: number): FrameEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    globalFrame: index,
    sequenceId: 'seq-1',
    keyPhotoId: 'kp',
    imageId: '',
    localFrame: index,
  }));
}

function cycleRecords(keyIds: readonly string[]): PhysicPaintRotoRealKeyRecord[] {
  return keyIds.map((keyId, index) => record(keyId, index));
}

beforeEach(() => {
  _setPhysicPaintMarkDirtyCallback(() => {});
  physicPaintStore.reset();
  resetEfxPaintStore();
  registerDocument(makeTrackDocument(LAYER));
  exportStore.resetProgress();
  exportStore.outputFolder.value = '/tmp/efx-export-loops';
  exportStore.includeAudio.value = false;
  exportStore.selectedSequenceOnly.value = false;
  exportStore.motionBlurEnabled.value = false;
  exportStore.format.value = 'png';
  hoisted.fm = [];
  hoisted.sequences = [makeSequence([makeRotoLayer()])];
  hoisted.activeSequenceId = 'seq-1';
  vi.clearAllMocks();
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

describe('export loop preflight (failure path, D-28)', () => {
  it('blocks before the first frame render with the locked error naming placementStart and the first missing source frame', async () => {
    // Loop [10, 19) over cycle [A, missing-1, C]; the first dangling reference
    // sits at source-cycle index 1, so F = placementStart + 1 = 11.
    install(
      [record('A', 0), record('C', 2)],
      [loopClip('loop-1', 10, ['A', 'missing-1', 'C'], 3)],
    );
    hoisted.fm = makeFm(16);

    await startExport();

    expect(exportStore.progress.peek().status).toBe('error');
    expect(exportStore.progress.peek().errorMessage).toBe(
      'Export blocked — Group at frame 10 references a missing source frame (11). Repair or unlink the Group, then export again.',
    );
    // Fail fast: zero renderer invocations and no export directory creation.
    expect(renderGlobalFrameMock).not.toHaveBeenCalled();
    expect(renderFrameWithMotionBlurMock).not.toHaveBeenCalled();
    expect(preloadExportImagesMock).not.toHaveBeenCalled();
    expect(exportCreateDirMock).not.toHaveBeenCalled();
  });

  it('blocks an unavailable lifecycle Group before creating directories, preloading, rendering, or writing', async () => {
    install(
      [record('A0', 0)],
      [lifecycleGroup({
        placementStart: 10,
        phaseOrigin: 10,
        originalEndExclusive: 16,
        sourceKeyIds: ['A0', 'missing-source'],
        visibleRanges: [{ start: 10, endExclusive: 16 }],
        frameOverrides: [],
      })],
    );
    hoisted.fm = makeFm(16);

    await startExport();

    expect(exportStore.progress.peek()).toEqual(expect.objectContaining({
      status: 'error',
      errorMessage: 'Export blocked — Group at frame 10 references a missing source frame (11). Repair or unlink the Group, then export again.',
    }));
    expect(exportCreateDirMock).not.toHaveBeenCalled();
    expect(preloadExportImagesMock).not.toHaveBeenCalled();
    expect(renderGlobalFrameMock).not.toHaveBeenCalled();
    expect(renderFrameWithMotionBlurMock).not.toHaveBeenCalled();
  });

  it('reports invalid source timing truthfully when every referenced source key still exists', async () => {
    install(
      [record('A', 0), record('B', 3), record('C', 6)],
      [loopClip('loop-invalid-order', 10, ['A', 'C', 'B'], 2)],
    );
    hoisted.fm = makeFm(16);

    await startExport();

    expect(exportStore.progress.peek().status).toBe('error');
    expect(exportStore.progress.peek().errorMessage).toBe(
      'Export blocked — Group at frame 10 has invalid source timing. Repair or unlink the Group, then export again.',
    );
    expect(renderGlobalFrameMock).not.toHaveBeenCalled();
    expect(exportCreateDirMock).not.toHaveBeenCalled();
  });

  it('names the earliest placementStart first; repairing it surfaces the next unresolved loop on re-export', async () => {
    install(
      [record('A', 0)],
      [
        loopClip('loop-late', 20, ['A', 'missing-late'], 2),
        loopClip('loop-early', 6, ['A', 'missing-early'], 2),
      ],
    );
    hoisted.fm = makeFm(30);

    await startExport();
    expect(exportStore.progress.peek().status).toBe('error');
    expect(exportStore.progress.peek().errorMessage).toBe(
      'Export blocked — Group at frame 6 references a missing source frame (7). Repair or unlink the Group, then export again.',
    );

    // Repair the earliest loop with a distinct later source key. Repeating the
    // same keyId would remain unresolved because physical source timing must be
    // strictly increasing; the next export surfaces the remaining late loop.
    const repairedRecords = physicPaintStore.replaceRotoPhysicalRecords(
      LAYER, TEST_TRACK_ID,
      [record('A', 0), record('B', 1)],
      INTERPOLATION,
      CAPACITY,
    );
    expect(repairedRecords.ok).toBe(true);
    const repaired = physicPaintStore.replaceRotoPhysicalLoopClips(LAYER, TEST_TRACK_ID, [
      loopClip('loop-late', 20, ['A', 'missing-late'], 2),
      loopClip('loop-early', 6, ['A', 'B'], 2),
    ]);
    expect(repaired.ok).toBe(true);

    await startExport();
    expect(exportStore.progress.peek().status).toBe('error');
    expect(exportStore.progress.peek().errorMessage).toBe(
      'Export blocked — Group at frame 20 references a missing source frame (21). Repair or unlink the Group, then export again.',
    );
    expect(renderGlobalFrameMock).not.toHaveBeenCalled();
  });

  it('does not block when every unresolved loop lies entirely outside the export range', async () => {
    install([record('A', 0)], [loopClip('loop-far', 40, ['A', 'missing-1'], 2)]);
    hoisted.fm = makeFm(8);

    await startExport();

    expect(exportStore.progress.peek().status).toBe('complete');
    expect(renderGlobalFrameMock).toHaveBeenCalledTimes(8);
  });

  it('checks infinity loops over the effective export range bounded by the parent end at export time', async () => {
    // Capacity 6 bounds the infinity loop's effective range to [2, 6) — the
    // preflight must see the unresolved loop through that bound, not the raw
    // 'infinity' requested end.
    install([record('A', 0)], [loopClip('loop-inf', 2, ['A', 'missing-1'], 'infinity')], 6);
    hoisted.fm = makeFm(6);

    await startExport();

    expect(exportStore.progress.peek().status).toBe('error');
    expect(exportStore.progress.peek().errorMessage).toBe(
      'Export blocked — Group at frame 2 references a missing source frame (3). Repair or unlink the Group, then export again.',
    );
    expect(renderGlobalFrameMock).not.toHaveBeenCalled();
  });

  it('does not block a resume window that starts at or beyond the loop effective end', async () => {
    install([record('A', 0)], [loopClip('loop-1', 2, ['A', 'missing-1'], 1)]);
    hoisted.fm = makeFm(6);

    exportStore.updateProgress({ resumeFromFrame: 4 });
    await resumeExport();

    // The unresolved loop covers [2, 4); the resume window is [4, 6).
    expect(exportStore.progress.peek().status).toBe('complete');
    expect(renderGlobalFrameMock).toHaveBeenCalledTimes(2);
  });
});

describe('valid-loop preview/export parity (success path, D-27, audit finding 8)', () => {
  interface ParityResult {
    exportByFrame: Map<number, Extract<PhysicPaintRotoPhysicalRenderSource, { kind: 'real' }>>;
    exportNullFrames: Set<number>;
    previewByFrame: Map<number, { cacheKey: string; dataUrl: string } | null>;
    drawnSources: Set<string>;
  }

  /**
   * Drive BOTH surfaces for the same installed document revision:
   * - export side: the real renderGlobalFrame loop (the exact function
   *   startExport calls per frame), observing its per-frame store resolutions
   *   through a spy and collecting the rasters it actually paints;
   * - preview side: PreviewRenderer.collectPhysicPaintFrameSources — the
   *   preview/playback frame-collection seam — per frame.
   */
  async function resolveBothSurfaces(frameCount: number): Promise<ParityResult> {
    const actual = await vi.importActual<typeof import('./exportRenderer')>('./exportRenderer');
    const ctx = new RecordingCanvasContext();
    const canvas = makeCanvas(ctx);
    const renderer = new PreviewRenderer(canvas);
    const frames = Array.from({ length: frameCount }, (_, index) => index);
    const layers = hoisted.sequences[0].layers;

    const exportByFrame: ParityResult['exportByFrame'] = new Map();
    const exportNullFrames = new Set<number>();
    const spy = vi.spyOn(physicPaintStore, 'getRotoPhysicalRenderSource');
    try {
      for (const frame of frames) {
        // Two passes per frame: the first loads the resolved raster into the
        // image cache, the second paints it — the same load-then-draw
        // discipline the preload + render loop gives the real export.
        actual.renderGlobalFrame(renderer, canvas, frame, hoisted.fm, hoisted.sequences, [], false);
        actual.renderGlobalFrame(renderer, canvas, frame, hoisted.fm, hoisted.sequences, [], false);
      }
    } finally {
      const calls = spy.mock.calls;
      const results = spy.mock.results;
      spy.mockRestore();
      for (let index = 0; index < calls.length; index += 1) {
        const [layerId, , appFrame] = calls[index] as [string, string, number];
        const result = results[index]?.value as PhysicPaintRotoPhysicalRenderSource | null;
        if (layerId !== LAYER) continue;
        if (result === null) {
          exportNullFrames.add(appFrame);
          continue;
        }
        if (result.kind !== 'real') {
          throw new Error(`Parity scenarios resolve every export frame as 'real'; frame ${appFrame} resolved '${result.kind}'.`);
        }
        exportByFrame.set(appFrame, result);
      }
    }

    const previewByFrame: ParityResult['previewByFrame'] = new Map();
    for (const frame of frames) {
      const sources = renderer.collectPhysicPaintFrameSources(layers, frame);
      const source = sources.find((candidate) => candidate.layerId === LAYER) ?? null;
      previewByFrame.set(frame, source ? { cacheKey: source.cacheKey ?? '', dataUrl: source.renderedFrame.dataUrl } : null);
    }

    const drawnSources = new Set(
      ctx.operations.filter((op): op is Extract<RecordedCanvasOp, { type: 'drawImage' }> => op.type === 'drawImage').map((op) => op.source),
    );
    return { exportByFrame, exportNullFrames, previewByFrame, drawnSources };
  }

  function expectParity(
    result: ParityResult,
    frameCount: number,
    expectedKeyId: (frame: number) => string,
  ): void {
    const revision = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID);
    expect(revision).toBeTruthy();
    for (let frame = 0; frame < frameCount; frame += 1) {
      const exportSource = result.exportByFrame.get(frame);
      const previewSource = result.previewByFrame.get(frame);
      expect(exportSource, `export path resolves frame ${frame}`).toBeTruthy();
      expect(previewSource, `preview path resolves frame ${frame}`).toBeTruthy();
      const keyId = expectedKeyId(frame);
      // Same sourceKeyId on both surfaces.
      expect(exportSource!.keyId, `frame ${frame} sourceKeyId`).toBe(keyId);
      // Same provenance: the preview cache key embeds the export-observed
      // source-scoped cache revision.
      expect(exportSource!.cacheRevision, `frame ${frame} provenance`).toBe(`${revision}:real:${keyId}`);
      expect(previewSource!.cacheKey, `frame ${frame} preview provenance`).toBe(
        `physic-paint:${LAYER}:physical:${exportSource!.cacheRevision}`,
      );
      // Deterministic raster equality BETWEEN the two paths (never fixed hashes).
      expect(previewSource!.dataUrl, `frame ${frame} raster parity`).toBe(exportSource!.renderedFrame.dataUrl);
    }
  }

  it('finite repeated Progressive cycle (5-frame cycle x 5 repeats) exports exactly what preview resolves, including the painted rasters', async () => {
    const keys = ['A', 'B', 'C', 'D', 'E'];
    install(cycleRecords(keys), [loopClip('loop-1', 0, keys, 5)]);
    hoisted.fm = makeFm(25);

    const result = await resolveBothSurfaces(25);

    expectParity(result, 25, (frame) => keys[frame % 5]);
    // Pixel-level parity: the export render path painted exactly the raster
    // set the preview path resolved — no other source, no missing frame.
    const previewRasters = new Set(keys.map((_, index) => payload(index).dataUrl));
    expect(result.drawnSources).toEqual(previewRasters);
  });

  it('finite Static/Hold cycle resolves identically on both surfaces', async () => {
    const keys = ['A', 'B', 'C'];
    install(cycleRecords(keys), [loopClip('loop-1', 0, keys, 3, 'static')]);
    hoisted.fm = makeFm(9);

    const result = await resolveBothSurfaces(9);

    expectParity(result, 9, (frame) => keys[frame % 3]);
  });

  it('Infinity loop bounded by the current parent end resolves identically on both surfaces', async () => {
    const keys = ['A', 'B'];
    install(cycleRecords(keys), [loopClip('loop-1', 0, keys, 'infinity')], 8);
    hoisted.fm = makeFm(8);

    const result = await resolveBothSurfaces(8);

    expectParity(result, 8, (frame) => keys[frame % 2]);
  });

  it('loop truncated on a complete-cycle boundary exports the linked cycles and the boundary key identically', async () => {
    const keys = ['A', 'B', 'C', 'D', 'E'];
    install([...cycleRecords(keys), record('Z', 10)], [loopClip('loop-1', 0, keys, 5)]);
    hoisted.fm = makeFm(11);

    const result = await resolveBothSurfaces(11);

    // D-24: the non-owned real key at frame 10 truncates the loop at a
    // complete-cycle boundary (two full cycles); frame 10 resolves real.
    expectParity(result, 11, (frame) => frame < 10 ? keys[frame % 5] : 'Z');
  });

  it('loop truncated mid-cycle (partial cycle) exports the partial occurrence identically', async () => {
    const keys = ['A', 'B', 'C', 'D', 'E'];
    install([...cycleRecords(keys), record('Z', 12)], [loopClip('loop-1', 0, keys, 5)]);
    hoisted.fm = makeFm(13);

    const result = await resolveBothSurfaces(13);

    expectParity(result, 13, (frame) => frame < 12 ? keys[frame % 5] : 'Z');
  });

  it('a materialized local real key inside the linked range resolves real on both surfaces while its left neighbors stay linked', async () => {
    const keys = ['A', 'B', 'C', 'D', 'E'];
    // D-12/D-06: the materialized key at frame 7 is the loop's next-clip
    // boundary — the loop shortens to [0, 7), frame 7 resolves 'real', the
    // linked neighbors to its left (5, 6) stay linked, and frames past the
    // boundary resolve empty on BOTH surfaces.
    install([...cycleRecords(keys), record('M', 7)], [loopClip('loop-1', 0, keys, 3)]);
    hoisted.fm = makeFm(9);

    const result = await resolveBothSurfaces(9);

    expectParity(result, 8, (frame) => frame < 7 ? keys[frame % 5] : 'M');
    expect(result.exportNullFrames.has(8), 'export path resolves frame 8 as empty').toBe(true);
    expect(result.previewByFrame.get(8), 'preview path resolves frame 8 as empty').toBeNull();
  });

  it('exports detached overrides and fragmented gaps exactly like a cache-cold preview, then reflects regeneration', async () => {
    install(
      [record('A0', 0), record('A1', 1), record('override-3', 3, 'override')],
      [lifecycleGroup()],
    );
    hoisted.fm = makeFm(6);

    const detached = await resolveBothSurfaces(6);
    // 43.2 phase-propagation: the override painted at frame 3 (phase 1) shows
    // at every matching phase across the repeats — frames 1, 3, and 5.
    const expectedKeys = new Map([[0, 'A0'], [1, 'override-3'], [3, 'override-3'], [4, 'A0'], [5, 'override-3']]);
    for (const [frame, keyId] of expectedKeys) {
      const exportSource = detached.exportByFrame.get(frame);
      const previewSource = detached.previewByFrame.get(frame);
      expect(exportSource?.keyId, `export frame ${frame}`).toBe(keyId);
      expect(previewSource?.dataUrl, `preview frame ${frame}`).toBe(exportSource?.renderedFrame.dataUrl);
      expect(previewSource?.cacheKey, `cache-cold preview frame ${frame}`).toBe(
        `physic-paint:${LAYER}:physical:${exportSource?.cacheRevision}`,
      );
    }
    expect(detached.exportNullFrames.has(2)).toBe(true);
    expect(detached.previewByFrame.get(2)).toBeNull();

    const regenerated = physicPaintStore.replaceRotoPhysicalLoopClips(LAYER, TEST_TRACK_ID, [lifecycleGroup({
      syncState: 'synchronized',
      provenanceState: 'attached',
      visibleRanges: [{ start: 0, endExclusive: 6 }],
      frameOverrides: [],
    })]);
    if (!regenerated.ok) throw new Error(regenerated.error);

    const synchronized = await resolveBothSurfaces(6);
    expect(synchronized.exportByFrame.get(2)?.keyId).toBe('A0');
    expect(synchronized.previewByFrame.get(2)?.dataUrl).toBe(payload(0).dataUrl);
  });
});
