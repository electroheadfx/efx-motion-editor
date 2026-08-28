import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Layer } from '../types/layer';
import { defaultTransform } from '../types/layer';
import type { Sequence } from '../types/sequence';
import { paintStore } from '../stores/paintStore';
import { physicPaintStore, _setPhysicPaintMarkDirtyCallback } from '../stores/physicPaintStore';
import { getDocument, registerDocument, reset as resetEfxPaintStore } from '../stores/efxPaintStore';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { EfxPaintDocument, InternalPaintTrack } from '../efx-paint/document/efxPaintDocument';
import { buildPhysicPaintRotoPhysicalRevision } from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';

vi.mock('../stores/paintStore', () => ({
  paintStore: { getFrame: vi.fn(() => null) },
}));

vi.mock('../stores/projectStore', () => ({
  projectStore: {
    width: { peek: () => 4, value: 4 },
    height: { peek: () => 3, value: 3 },
  },
}));

import { PreviewRenderer, blendModeToCompositeOp, resolvePhysicPaintTrackVisibility } from './previewRenderer';
import { renderGlobalFrame } from './exportRenderer';
import { clearProjectPaperRasterCache } from './projectPaperRaster';
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

const root = resolve(__dirname, '../..');
const readSource = (path: string) => readFileSync(resolve(root, path), 'utf8');
let offscreenOperations: RecordedCanvasOp[] = [];

type RecordedCanvasOp =
  | { type: 'fillRect'; x: number; y: number; w: number; h: number; fillStyle: string; globalAlpha: number; globalCompositeOperation: GlobalCompositeOperation }
  | { type: 'drawImage'; source: string; args: number[]; globalAlpha: number; globalCompositeOperation: GlobalCompositeOperation }
  | { type: 'createPattern'; source: string; repetition: string | null }
  | { type: 'clearRect' }
  | { type: 'save' }
  | { type: 'restore' }
  | { type: 'scale' };

class RecordingCanvasContext {
  operations: RecordedCanvasOp[];
  fillStyle: string | CanvasGradient | CanvasPattern = '#000000';
  globalAlpha = 1;
  globalCompositeOperation: GlobalCompositeOperation = 'source-over';
  private stateStack: Array<Pick<RecordingCanvasContext, 'fillStyle' | 'globalAlpha' | 'globalCompositeOperation'>> = [];

  constructor(operations: RecordedCanvasOp[] = []) {
    this.operations = operations;
  }

  save(): void {
    this.operations.push({ type: 'save' });
    this.stateStack.push({
      fillStyle: this.fillStyle,
      globalAlpha: this.globalAlpha,
      globalCompositeOperation: this.globalCompositeOperation,
    });
  }

  restore(): void {
    this.operations.push({ type: 'restore' });
    const state = this.stateStack.pop();
    if (!state) return;
    this.fillStyle = state.fillStyle;
    this.globalAlpha = state.globalAlpha;
    this.globalCompositeOperation = state.globalCompositeOperation;
  }

  scale(): void {
    this.operations.push({ type: 'scale' });
  }

  clearRect(): void {
    this.operations.push({ type: 'clearRect' });
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.operations.push({
      type: 'fillRect',
      x,
      y,
      w,
      h,
      fillStyle: String(this.fillStyle),
      globalAlpha: this.globalAlpha,
      globalCompositeOperation: this.globalCompositeOperation,
    });
  }

  drawImage(source?: CanvasImageSource, ...args: number[]): void {
    this.operations.push({
      type: 'drawImage',
      source: source instanceof TestImage ? source.src : source instanceof TestCanvas ? 'canvas' : 'unknown',
      args,
      globalAlpha: this.globalAlpha,
      globalCompositeOperation: this.globalCompositeOperation,
    });
  }

  createPattern(source: CanvasImageSource, repetition: string | null): CanvasPattern {
    this.operations.push({ type: 'createPattern', source: source instanceof TestImage ? source.src : 'unknown', repetition });
    return `pattern:${source instanceof TestImage ? source.src : 'unknown'}` as unknown as CanvasPattern;
  }
}

class TestCanvas {
  width = 0;
  height = 0;
  clientWidth = 0;
  clientHeight = 0;
  offsetWidth = 0;
  offsetHeight = 0;

  constructor(private operations: RecordedCanvasOp[]) {}

  getContext(contextId: string): RecordingCanvasContext | null {
    return contextId === '2d' ? new RecordingCanvasContext(this.operations) : null;
  }

  // 48-03: the store's flattened path calls canvas.toDataURL() to produce the
  // raster payload. Serializing the recorded op log makes the flattened
  // dataUrl deterministic per scenario — tests can decode it to assert WHICH
  // content was baked into the raster.
  toDataURL(): string {
    return `data:image/png;base64,${Buffer.from(JSON.stringify(this.operations)).toString('base64')}`;
  }
}

class TestImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin = '';
  width = 4;
  height = 3;
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

function makeRotoLayer(): Layer {
  return {
    id: 'roto-layer',
    name: 'Roto',
    type: 'physic-paint',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: defaultTransform(),
    source: { type: 'physic-paint', layerId: 'roto-layer' },
  };
}

function seedPhysicalRoto(
  keys: Array<{ keyId: string; appFrame: number; dataUrl: string }>,
  options: { interpolationEnabled?: boolean; background?: { background: 'canvas1'; paperGrain: string; grainStrength: number } | null } = {},
): void {
  const records = keys.map((key) => ({
    keyId: key.keyId,
    appFrame: key.appFrame,
    kind: 'real-key' as const,
    payload: { frameIndex: 0, appFrame: key.appFrame, dataUrl: key.dataUrl },
  }));
  const interpolation = { enabled: options.interpolationEnabled ?? false, mode: 'duplicate' as const };
  const result = physicPaintStore.replaceRotoPhysicalDocument('roto-layer', TEST_TRACK_ID, {
    capacity: 600,
    realKeyRecords: records,
    interpolation,
    scriptMotion: { deformation: 0, position: 0 },
    background: options.background ?? null,
    selectedKeyId: null,
    cursorAppFrame: 0,
    revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, []),
  });
  if (!result.ok) throw new Error(result.error);
}

beforeEach(() => {
  _setPhysicPaintMarkDirtyCallback(() => {});
  physicPaintStore.reset();
  resetEfxPaintStore();
  registerDocument(makeTrackDocument('roto-layer'));
  clearProjectPaperRasterCache();
  offscreenOperations = [];
  vi.stubGlobal('window', { devicePixelRatio: 1 });
  vi.stubGlobal('document', { createElement: (tag: string) => tag === 'canvas' ? new TestCanvas(offscreenOperations) : {} });
  vi.stubGlobal('Image', TestImage);
  vi.stubGlobal('HTMLImageElement', TestImage);
  vi.stubGlobal('HTMLCanvasElement', TestCanvas);
});

afterEach(() => {
  physicPaintStore.reset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('PreviewRenderer flattened physic-paint seam contract (48-03)', () => {
  it('owns the flattened-only content seam, the exported blend map, and no placeholder helpers', () => {
    const source = readSource('src/lib/previewRenderer.ts');

    expect(source).toContain('physicPaintStore.getFlattenedFrame(paintLayerId, physicPaintLookupFrame)');
    expect(source).toContain("export {blendModeToCompositeOp}");
    expect(source).not.toMatch(/resolvePhysicPaintFrameSource/);
    expect(source).not.toMatch(/resolveMissingRotoFrameDraw/);
    expect(source).not.toMatch(/drawRotoFrameComposite/);
    expect(source).not.toMatch(/drawLoopClipPlaceholder/);
  });

  it('the physic-paint branch resolves ONLY through the flattened delivery', () => {
    const source = readSource('src/lib/previewRenderer.ts');
    const branchStart = source.lastIndexOf("layer.type === 'physic-paint'");
    const physicPaintBranch = source.slice(branchStart, source.indexOf("} else if (layer.type === 'paint')", branchStart));

    expect(physicPaintBranch).toContain('resolveFlattened(paintLayerId)');
    expect(physicPaintBranch).not.toContain('resolvePhysicPaintFrameSource(');
    expect(physicPaintBranch).not.toContain('drawLoopClipPlaceholder(');
    expect(physicPaintBranch).not.toContain('drawRotoFrameComposite(');
    expect(physicPaintBranch).not.toContain('setFrame(');
    expect(physicPaintBranch).not.toContain('upsertRealRotoKeyFrame(');
    expect(physicPaintBranch).not.toContain('replaceGeneratedRotoCache(');
  });

  it('an interior missing Roto frame renders as a transparent flattened raster — never renderer-side paper (D-09)', () => {
    seedPhysicalRoto([
      { keyId: 'key-1', appFrame: 1, dataUrl: 'data:image/png;base64,cmVhbC0x' },
      { keyId: 'key-3', appFrame: 3, dataUrl: 'data:image/png;base64,cmVhbC0z' },
    ], { background: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0 } });
    const ctx = new RecordingCanvasContext();
    const renderer = new PreviewRenderer(makeCanvas(ctx));

    renderer.renderFrame([makeRotoLayer()], 2, [], 24, true, 1, 2);
    renderer.renderFrame([makeRotoLayer()], 2, [], 24, true, 1, 2);

    // The store resolves the missing frame to a flattened raster with no track
    // contribution (transparent + missing report): no paper is baked, and the
    // renderer never paints paper itself. The flattened raster IS drawn.
    expect(offscreenOperations).not.toContainEqual(expect.objectContaining({ type: 'fillRect' }));
    expect(offscreenOperations).not.toContainEqual(expect.objectContaining({ type: 'createPattern' }));
    expect(ctx.operations).toContainEqual(expect.objectContaining({ type: 'drawImage' }));
    expect(ctx.operations).not.toContainEqual(expect.objectContaining({ type: 'drawImage', source: 'canvas' }));
    expect(ctx.operations).not.toContainEqual(expect.objectContaining({ type: 'drawImage', source: 'data:image/png;base64,cmVhbC0x' }));
  });

  it('a real Roto frame with paper metadata bakes paper + frame into ONE flattened raster (per-track parity)', () => {
    seedPhysicalRoto([
      { keyId: 'key-1', appFrame: 1, dataUrl: 'data:image/png;base64,cmVhbC0x' },
    ], { background: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0 } });
    const ctx = new RecordingCanvasContext();
    const renderer = new PreviewRenderer(makeCanvas(ctx));

    renderer.renderFrame([makeRotoLayer()], 1, [], 24, true, 1, 1);
    renderer.renderFrame([makeRotoLayer()], 1, [], 24, true, 1, 1);

    // Store-side: the paper color-fill fallback and the frame pixels are both
    // composited into the flattened raster (paperCanvas deliberately null).
    expect(offscreenOperations).toContainEqual(expect.objectContaining({ type: 'fillRect', fillStyle: '#f4efe3' }));
    expect(offscreenOperations).toContainEqual(expect.objectContaining({ type: 'drawImage', source: 'data:image/png;base64,cmVhbC0x' }));
    // Renderer-side: ONE flattened draw — never a separate paper canvas + frame.
    const flattenedDraws = ctx.operations.filter((op): op is Extract<RecordedCanvasOp, { type: 'drawImage' }> => op.type === 'drawImage');
    expect(flattenedDraws.length).toBeGreaterThanOrEqual(1);
    expect(ctx.operations).not.toContainEqual(expect.objectContaining({ type: 'drawImage', source: 'canvas' }));
    expect(ctx.operations).not.toContainEqual(expect.objectContaining({ type: 'drawImage', source: 'data:image/png;base64,cmVhbC0x' }));
  });

  it('an interpolated interior frame bakes paper + generated alpha into ONE flattened raster', () => {
    seedPhysicalRoto([
      { keyId: 'key-1', appFrame: 1, dataUrl: 'data:image/png;base64,cmVhbC0x' },
      { keyId: 'key-3', appFrame: 3, dataUrl: 'data:image/png;base64,cmVhbC0z' },
    ], { interpolationEnabled: true, background: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0 } });
    const ctx = new RecordingCanvasContext();
    const renderer = new PreviewRenderer(makeCanvas(ctx));

    renderer.renderFrame([makeRotoLayer()], 2, [], 24, true, 1, 2);
    renderer.renderFrame([makeRotoLayer()], 2, [], 24, true, 1, 2);

    // Store-side: paper + the duplicate-mode generated alpha (left key) baked.
    expect(offscreenOperations).toContainEqual(expect.objectContaining({ type: 'fillRect', fillStyle: '#f4efe3' }));
    expect(offscreenOperations).toContainEqual(expect.objectContaining({ type: 'drawImage', source: 'data:image/png;base64,cmVhbC0x' }));
    expect(offscreenOperations).not.toContainEqual(expect.objectContaining({ type: 'drawImage', source: 'data:image/png;base64,cmVhbC0z' }));
    expect(physicPaintStore.getRotoBackgroundMetadata('roto-layer', TEST_TRACK_ID)).toEqual({ background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0 });
    // Renderer-side: ONE flattened draw — no separate paper/content draws.
    const flattenedDraws = ctx.operations.filter((op): op is Extract<RecordedCanvasOp, { type: 'drawImage' }> => op.type === 'drawImage');
    expect(flattenedDraws.length).toBeGreaterThanOrEqual(1);
    expect(ctx.operations).not.toContainEqual(expect.objectContaining({ type: 'drawImage', source: 'canvas' }));
    expect(ctx.operations).not.toContainEqual(expect.objectContaining({ type: 'drawImage', source: 'data:image/png;base64,cmVhbC0z' }));
  });

  it('36.12-GENERATED-FRAMES bakes published generated interpolation alpha into the flattened raster after close/reopen load', () => {
    seedPhysicalRoto([
      { keyId: 'key-1', appFrame: 1, dataUrl: 'data:image/png;base64,cmVhbC0x' },
      { keyId: 'key-3', appFrame: 3, dataUrl: 'data:image/png;base64,cmVhbC0z' },
    ], { interpolationEnabled: true, background: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0 } });
    const projection = physicPaintStore.extractRuntimeStateForDocument('roto-layer', TEST_TRACK_ID);
    physicPaintStore.reset();
    physicPaintStore.installRuntimeStateFromDocument('roto-layer', TEST_TRACK_ID, projection);
    const ctx = new RecordingCanvasContext();
    const renderer = new PreviewRenderer(makeCanvas(ctx));

    renderer.renderFrame([makeRotoLayer()], 2, [], 24, true, 1, 2);
    renderer.renderFrame([makeRotoLayer()], 2, [], 24, true, 1, 2);

    // The store's projection still resolves the generated interior, and the
    // per-track paper composite survives the reopen (metadata is projected).
    expect(physicPaintStore.getRotoPhysicalRenderSource('roto-layer', TEST_TRACK_ID, 2)).toMatchObject({
      kind: 'generated',
      appFrame: 2,
      leftKeyId: 'key-1',
      rightKeyId: 'key-3',
    });
    expect(offscreenOperations).toContainEqual(expect.objectContaining({ type: 'fillRect', fillStyle: '#f4efe3' }));
    expect(offscreenOperations).toContainEqual(expect.objectContaining({ type: 'drawImage', source: 'data:image/png;base64,cmVhbC0x' }));
    expect(ctx.operations).toContainEqual(expect.objectContaining({ type: 'drawImage' }));
  });

  it('36.13-PREVIEW-EXPORT-PARITY bakes store-regenerated 2 -> 6 span output at direct physical appFrame positions after save/load', () => {
    seedPhysicalRoto([
      { keyId: 'key-0', appFrame: 0, dataUrl: 'data:image/png;base64,cmVhbC0w' },
      { keyId: 'key-1', appFrame: 1, dataUrl: 'data:image/png;base64,cmVhbC0x' },
      { keyId: 'key-2', appFrame: 2, dataUrl: 'data:image/png;base64,cmVhbC0y' },
      { keyId: 'key-6', appFrame: 6, dataUrl: 'data:image/png;base64,cmVhbC02' },
    ], { interpolationEnabled: true, background: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0 } });
    const projection = physicPaintStore.extractRuntimeStateForDocument('roto-layer', TEST_TRACK_ID);
    physicPaintStore.reset();
    physicPaintStore.installRuntimeStateFromDocument('roto-layer', TEST_TRACK_ID, projection);
    const ctx = new RecordingCanvasContext();
    const renderer = new PreviewRenderer(makeCanvas(ctx));

    // The 2 -> 6 span derives gap interiors at direct physical appFrames 3, 4, 5.
    renderer.renderFrame([makeRotoLayer()], 4, [], 24, true, 1, 4);
    renderer.renderFrame([makeRotoLayer()], 4, [], 24, true, 1, 4);

    expect(physicPaintStore.getRotoPhysicalRenderSource('roto-layer', TEST_TRACK_ID, 4)).toMatchObject({
      kind: 'generated',
      appFrame: 4,
      leftKeyId: 'key-2',
      rightKeyId: 'key-6',
      renderedFrame: { dataUrl: 'data:image/png;base64,cmVhbC0y' },
    });
    expect(offscreenOperations).toContainEqual(expect.objectContaining({ type: 'fillRect', fillStyle: '#f4efe3' }));
    expect(offscreenOperations).toContainEqual(expect.objectContaining({ type: 'drawImage', source: 'data:image/png;base64,cmVhbC0y' }));
    expect(ctx.operations).toContainEqual(expect.objectContaining({ type: 'drawImage' }));
  });

  it('36.11 bakes renderer-owned paper + merged real-key alpha repaint into ONE flattened raster', () => {
    seedPhysicalRoto([
      { keyId: 'key-5', appFrame: 5, dataUrl: 'data:image/png;base64,cmVhbC01' },
    ], { background: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45 } });
    const applied = physicPaintStore.applyCanvas({
      kind: 'apply-canvas',
      trackId: TEST_TRACK_ID,
      operationId: 'op-merged-preview',
      layerId: 'roto-layer',
      startFrame: 5,
      renderedFrame: { frameIndex: 0, appFrame: 5, dataUrl: 'data:image/png;base64,bWVyZ2VkLXJlcGFpbnQtYWxwaGE=' },
      editableState: {
        version: 1,
        parentLayerId: 'roto-layer',
        documentRevision: 0,
        activeTrackId: 'track-1',
        tracks: [{
          id: 'track-1',
          name: 'Paint',
          order: 0,
          visible: true,
          solo: false,
          opacity: 1,
          blendMode: 'normal',
          revision: 0,
          frames: {},
          rotoPhysical: null,
          loopClips: [],
          strokes: [{ tool: 'paint', pts: [[1, 1, 0.5, 0, 0, 0, 0]], color: '#103c65', params: { size: 6, opacity: 100, pressure: 70, waterAmount: 50, dryAmount: 30, edgeDetail: 4, pickup: 0, eraseStrength: 50, antiAlias: 0 }, time: 1, diffusionFrames: 0 }],
          settings: { bgMode: 'transparent', paperGrain: 'canvas1', embossStrength: 0.45, wetPaper: true },
        }],
        background: { id: 'background-1', clips: [], fallback: { mode: 'transparent' }, visible: true, revision: 0 },
        photoReference: null,
        compositeRevision: 0,
      },
      rotoBackground: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45 },
    });
    expect(applied.ok).toBe(true);
    const ctx = new RecordingCanvasContext();
    const renderer = new PreviewRenderer(makeCanvas(ctx));

    renderer.renderFrame([makeRotoLayer()], 5, [], 24, true, 1, 5);
    renderer.renderFrame([makeRotoLayer()], 5, [], 24, true, 1, 5);

    // The flattened raster bakes paper (color-fill fallback) + the merged
    // real-key repaint; the renderer paints the single raster.
    expect(offscreenOperations).toContainEqual(expect.objectContaining({ type: 'fillRect', fillStyle: '#f4efe3' }));
    expect(offscreenOperations).toContainEqual(expect.objectContaining({ type: 'drawImage', source: 'data:image/png;base64,bWVyZ2VkLXJlcGFpbnQtYWxwaGE=' }));
    expect(ctx.operations).toContainEqual(expect.objectContaining({ type: 'drawImage' }));
    expect(ctx.operations).not.toContainEqual(expect.objectContaining({ type: 'drawImage', source: 'canvas' }));
    expect(ctx.operations).not.toContainEqual(expect.objectContaining({ type: 'drawImage', source: 'data:image/png;base64,bWVyZ2VkLXJlcGFpbnQtYWxwaGE=' }));
  });

  it('renders content Physics Paint in layer-local frames while ordinary Paint stays sequence-global', () => {
    seedPhysicalRoto([
      { keyId: 'key-0', appFrame: 0, dataUrl: 'data:image/png;base64,bG9jYWwtMA==' },
    ]);
    const physicalLookup = vi.spyOn(physicPaintStore, 'getRotoPhysicalRenderSource');
    const ordinaryPaintLookup = vi.mocked(paintStore.getFrame);
    ordinaryPaintLookup.mockClear();
    const paintLayer: Layer = {
      id: 'paint-layer',
      name: 'Paint',
      type: 'paint',
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      transform: defaultTransform(),
      source: { type: 'paint', layerId: 'paint-layer' },
    };
    const sequence: Sequence = {
      id: 'content-at-100',
      name: 'Content at F100',
      kind: 'content',
      fps: 24,
      width: 4,
      height: 3,
      keyPhotos: [{ id: 'kp-local-0', imageId: '', holdFrames: 1 }],
      layers: [makeRotoLayer(), paintLayer],
    };
    const frames = Array.from({ length: 101 }, (_, globalFrame) => ({
      globalFrame,
      sequenceId: globalFrame === 100 ? sequence.id : 'earlier-content',
      keyPhotoId: globalFrame === 100 ? 'kp-local-0' : 'kp-earlier',
      imageId: '',
      localFrame: globalFrame === 100 ? 0 : globalFrame,
    }));
    const ctx = new RecordingCanvasContext();
    const renderer = new PreviewRenderer(makeCanvas(ctx));

    renderGlobalFrame(renderer, makeCanvas(ctx), 100, frames, [sequence], []);

    expect(physicalLookup).toHaveBeenCalledWith('roto-layer', TEST_TRACK_ID, 0);
    expect(ordinaryPaintLookup).toHaveBeenCalledWith('paint-layer', 100);
  });
});

describe('47-01 hide/solo preview filter (TML-04/M8)', () => {
  it('no solo armed: every visible track resolves visible; a hidden track resolves hidden', () => {
    const document = createEfxPaintDocument('roto-layer');
    const track = document.tracks[0];
    registerDocument(document);
    expect(resolvePhysicPaintTrackVisibility('roto-layer', track.id)).toBe(true);
    // Hide wins over solo: hiding the same track flips the answer.
    registerDocument({ ...document, tracks: [{ ...track, visible: false }] });
    expect(resolvePhysicPaintTrackVisibility('roto-layer', track.id)).toBe(false);
  });

  it('solo armed → only visible+soloed tracks show; the active non-soloed track resolves null', () => {
    const document = createEfxPaintDocument('roto-layer');
    const trackA = document.tracks[0];
    const trackB: InternalPaintTrack = { ...trackA, id: 'track-b', name: 'Paint 2', order: 1 };
    registerDocument({ ...document, tracks: [{ ...trackA, solo: true }, trackB] });
    expect(resolvePhysicPaintTrackVisibility('roto-layer', trackA.id)).toBe(true);
    expect(resolvePhysicPaintTrackVisibility('roto-layer', trackB.id)).toBe(false);
  });

  it('soloed-and-hidden track is hidden (hide beats solo)', () => {
    const document = createEfxPaintDocument('roto-layer');
    const track = document.tracks[0];
    registerDocument({ ...document, tracks: [{ ...track, solo: true, visible: false }] });
    expect(resolvePhysicPaintTrackVisibility('roto-layer', track.id)).toBe(false);
  });

  it('an unknown track or absent document resolves hidden (fail closed)', () => {
    const document = createEfxPaintDocument('roto-layer');
    registerDocument(document);
    expect(resolvePhysicPaintTrackVisibility('roto-layer', 'ghost-track')).toBe(false);
    resetEfxPaintStore();
    expect(resolvePhysicPaintTrackVisibility('roto-layer', document.tracks[0].id)).toBe(false);
  });

  it('renders an empty preview frame when the active track is hidden', () => {
    seedPhysicalRoto([
      { keyId: 'key-1', appFrame: 1, dataUrl: 'data:image/png;base64,cmVhbC0x' },
    ], { background: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0 } });
    const current = getDocument('roto-layer');
    expect(current).not.toBeNull();
    const track = current!.tracks[0];
    registerDocument({ ...current!, tracks: [{ ...track, visible: false }] });
    const ctx = new RecordingCanvasContext();
    const renderer = new PreviewRenderer(makeCanvas(ctx));

    renderer.renderFrame([makeRotoLayer()], 1, [], 24, true, 1, 1);
    renderer.renderFrame([makeRotoLayer()], 1, [], 24, true, 1, 1);

    expect(ctx.operations).not.toContainEqual(expect.objectContaining({ type: 'drawImage', source: 'data:image/png;base64,cmVhbC0x' }));
  });

  it('draws the flattened raster when no solo is armed and the active track is visible', () => {
    seedPhysicalRoto([
      { keyId: 'key-1', appFrame: 1, dataUrl: 'data:image/png;base64,cmVhbC0x' },
    ], { background: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0 } });
    const ctx = new RecordingCanvasContext();
    const renderer = new PreviewRenderer(makeCanvas(ctx));

    renderer.renderFrame([makeRotoLayer()], 1, [], 24, true, 1, 1);
    renderer.renderFrame([makeRotoLayer()], 1, [], 24, true, 1, 1);

    // The store bakes the real key into the flattened raster; the renderer
    // paints the single flattened raster (never the raw key dataUrl).
    expect(offscreenOperations).toContainEqual(expect.objectContaining({ type: 'drawImage', source: 'data:image/png;base64,cmVhbC0x' }));
    expect(ctx.operations).toContainEqual(expect.objectContaining({ type: 'drawImage' }));
    expect(ctx.operations).not.toContainEqual(expect.objectContaining({ type: 'drawImage', source: 'data:image/png;base64,cmVhbC0x' }));
  });
});

describe('48-03 flattened physic-paint seam (D-11/CMP-01)', () => {
  const FLAT_1 = 'data:image/png;base64,ZmxhdC0x';
  const FLAT_2 = 'data:image/png;base64,ZmxhdC0y';

  it('seam contract: resolves physic-paint content only through getFlattenedFrame, exactly once per render', () => {
    seedPhysicalRoto([
      { keyId: 'key-1', appFrame: 1, dataUrl: 'data:image/png;base64,cmVhbC0x' },
    ]);
    const flattened = {
      layerId: 'roto-layer',
      frame: 1,
      cacheKey: 'physic-paint:roto-layer:flattened:rev-1',
      renderedFrame: { frameIndex: 0, appFrame: 1, dataUrl: FLAT_1 },
      missing: [],
    };
    const getFlattened = vi.spyOn(physicPaintStore, 'getFlattenedFrame').mockReturnValue(flattened);
    const getRotoPhysical = vi.spyOn(physicPaintStore, 'getRotoPhysicalRenderSource');
    const getFrame = vi.spyOn(physicPaintStore, 'getFrame');
    const ctx = new RecordingCanvasContext();
    const renderer = new PreviewRenderer(makeCanvas(ctx));

    renderer.renderFrame([makeRotoLayer()], 1, [], 24, true, 1, 1);

    expect(getFlattened).toHaveBeenCalledTimes(1);
    expect(getFlattened).toHaveBeenCalledWith('roto-layer', 1);
    expect(getRotoPhysical).not.toHaveBeenCalled();
    expect(getFrame).not.toHaveBeenCalled();
  });

  it('parent application: draws the flattened raster at the parent effectiveOpacity and blend only (CMP-03)', () => {
    seedPhysicalRoto([
      { keyId: 'key-1', appFrame: 1, dataUrl: 'data:image/png;base64,cmVhbC0x' },
    ]);
    // The internal track opacity (0.5) is baked into the flattened raster
    // store-side (straight alpha, D-02); the parent applies only ITS 50%.
    const INTERNAL_OPACITY = 0.5;
    const flattened = {
      layerId: 'roto-layer',
      frame: 1,
      cacheKey: 'physic-paint:roto-layer:flattened:rev-1',
      renderedFrame: { frameIndex: 0, appFrame: 1, dataUrl: FLAT_1 },
      missing: [],
    };
    vi.spyOn(physicPaintStore, 'getFlattenedFrame').mockReturnValue(flattened);
    const layer: Layer = { ...makeRotoLayer(), opacity: 0.5, blendMode: 'multiply' };
    const ctx = new RecordingCanvasContext();
    const renderer = new PreviewRenderer(makeCanvas(ctx));

    // Load-then-draw: the first pass decodes the flattened raster, the second
    // paints it from the image cache.
    renderer.renderFrame([layer], 1, [], 24, true, 1, 1);
    renderer.renderFrame([layer], 1, [], 24, true, 1, 1);

    const parentDraw = ctx.operations.find(
      (op): op is Extract<RecordedCanvasOp, { type: 'drawImage' }> => op.type === 'drawImage' && op.source === FLAT_1,
    );
    expect(parentDraw).toBeDefined();
    // Parent 0.5 × internal 0.5 = 0.25 effective; the renderer never re-applies
    // the internal track property (that would double the product to 0.0625).
    expect(parentDraw!.globalAlpha).toBe(0.5);
    expect(parentDraw!.globalAlpha * INTERNAL_OPACITY).toBe(0.25);
    expect(parentDraw!.globalCompositeOperation).toBe(blendModeToCompositeOp(layer.blendMode));
    expect(ctx.operations).not.toContainEqual(expect.objectContaining({ type: 'drawImage', source: FLAT_1, globalAlpha: 0.25 }));
  });

  it('null flattened delivery draws nothing and contributes false to hasDrawable', () => {
    seedPhysicalRoto([
      { keyId: 'key-1', appFrame: 1, dataUrl: 'data:image/png;base64,cmVhbC0x' },
    ]);
    vi.spyOn(physicPaintStore, 'getFlattenedFrame').mockReturnValue(null);
    const ctx = new RecordingCanvasContext();
    const renderer = new PreviewRenderer(makeCanvas(ctx));

    renderer.renderFrame([makeRotoLayer()], 1, [], 24, true, 1, 1);

    expect(ctx.operations).toEqual([]);
  });

  it('collectPhysicPaintFrameSources returns the flattened record and preload decodes its dataUrl', () => {
    seedPhysicalRoto([
      { keyId: 'key-1', appFrame: 1, dataUrl: 'data:image/png;base64,cmVhbC0x' },
    ]);
    const flattened = {
      layerId: 'roto-layer',
      frame: 1,
      cacheKey: 'physic-paint:roto-layer:flattened:rev-1',
      renderedFrame: { frameIndex: 0, appFrame: 1, dataUrl: FLAT_1 },
      missing: [],
    };
    vi.spyOn(physicPaintStore, 'getFlattenedFrame').mockReturnValue(flattened);
    const renderer = new PreviewRenderer(makeCanvas(new RecordingCanvasContext()));

    const sources = renderer.collectPhysicPaintFrameSources([makeRotoLayer()], 1);
    expect(sources).toEqual([flattened]);

    renderer.preloadPhysicPaintFrames(sources);
    expect(renderer.isPhysicPaintFrameResolved(flattened)).toBe(true);
  });

  it('a missing Hold frame renders transparent through the flattened raster — never the stripe placeholder (D-09)', () => {
    seedPhysicalRoto([
      { keyId: 'key-1', appFrame: 1, dataUrl: 'data:image/png;base64,cmVhbC0x' },
    ]);
    vi.spyOn(physicPaintStore, 'getFlattenedFrame').mockReturnValue({
      layerId: 'roto-layer',
      frame: 2,
      cacheKey: 'physic-paint:roto-layer:flattened:rev-2',
      renderedFrame: { frameIndex: 0, appFrame: 2, dataUrl: FLAT_2 },
      missing: [{ trackId: TEST_TRACK_ID, frame: 2, missingRefs: ['hold-ref'] }],
    });
    const ctx = new RecordingCanvasContext();
    const renderer = new PreviewRenderer(makeCanvas(ctx));

    renderer.renderFrame([makeRotoLayer()], 2, [], 24, true, 1, 2);
    renderer.renderFrame([makeRotoLayer()], 2, [], 24, true, 1, 2);

    expect(ctx.operations).not.toContainEqual(expect.objectContaining({ type: 'fillRect', fillStyle: '#1A1A2A' }));
    expect(ctx.operations).not.toContainEqual(expect.objectContaining({ type: 'fillRect', fillStyle: '#1A2A1A' }));
    expect(ctx.operations).toContainEqual(expect.objectContaining({
      type: 'drawImage',
      source: FLAT_2,
    }));
  });
});
