/**
 * Scratch repro (debug session playback-shows-only-last-layer):
 * hide -> show round trip on a 2-track composite during "playback" (repeated
 * flattened-frame queries at successive frames, like the program monitor).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testWebpBytes } from '../testUtils/testWebpBytes';
import { buildPhysicPaintRotoPhysicalRevision } from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import { physicPaintStore, _setPhysicPaintMarkDirtyCallback, _setPhysicPaintCompositorSizeProvider } from './physicPaintStore';
import { registerDocument, reset as resetEfxPaintStore, setTrackVisible } from './efxPaintStore';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { EfxPaintDocument, InternalPaintTrack } from '../efx-paint/document/efxPaintDocument';
import { resetProjectPaperRasterForTests } from '../lib/projectPaperRaster';

const { decodeWebpFrameMock } = vi.hoisted(() => ({ decodeWebpFrameMock: vi.fn() }));
vi.mock('../lib/webpFrameCodec', () => ({
  decodeWebpFrame: decodeWebpFrameMock,
  encodeWebpFrame: vi.fn(),
  encodeCanvasAsWebp: vi.fn(async () => testWebpBytes('flat')),
}));

const flushDecode = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const FLAT_LAYER = 'flat-layer';

type FlatOp =
  | { type: 'clearRect' }
  | { type: 'save' }
  | { type: 'restore' }
  | { type: 'drawImage'; source: string; globalAlpha: number; globalCompositeOperation: GlobalCompositeOperation };

class FlatRecordingContext {
  readonly ops: FlatOp[];
  constructor(ops: FlatOp[] = []) { this.ops = ops; }
  fillStyle: string | CanvasGradient | CanvasPattern = '#000000';
  globalAlpha = 1;
  globalCompositeOperation: GlobalCompositeOperation = 'source-over';
  private stack: Array<{ fillStyle: string | CanvasGradient | CanvasPattern; globalAlpha: number; globalCompositeOperation: GlobalCompositeOperation }> = [];
  save(): void { this.ops.push({ type: 'save' }); this.stack.push({ fillStyle: this.fillStyle, globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation }); }
  restore(): void { this.ops.push({ type: 'restore' }); const top = this.stack.pop(); if (top) { this.fillStyle = top.fillStyle; this.globalAlpha = top.globalAlpha; this.globalCompositeOperation = top.globalCompositeOperation; } }
  clearRect(): void { this.ops.push({ type: 'clearRect' }); }
  fillRect(): void {}
  drawImage(source?: unknown): void {
    const label = source !== null && typeof source === 'object' && 'src' in source ? String((source as { src: unknown }).src) : 'canvas';
    this.ops.push({ type: 'drawImage', source: label, globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation });
  }
  createPattern(): CanvasPattern { return 'pattern' as unknown as CanvasPattern; }
}

class FlatTestCanvas {
  width = 0;
  height = 0;
  constructor(readonly ops: FlatOp[]) {}
  getContext(kind: string): FlatRecordingContext | null { return kind === '2d' ? new FlatRecordingContext(this.ops) : null; }
  log(): string {
    return this.ops.map((op) => {
      switch (op.type) {
        case 'clearRect': return 'clear';
        case 'save': return 'save';
        case 'restore': return 'restore';
        case 'drawImage': return `draw(${op.source},${op.globalAlpha},${op.globalCompositeOperation})`;
      }
    }).join('|');
  }
  toDataURL(): string { return `data:image/webp;base64,${btoa('x')}`; }
}

class FlatTestBitmap {
  width = 4;
  height = 3;
  src = 'bitmap:test-frame';
  close = vi.fn();
}

function flatTrack(id: string, overrides: Partial<Omit<InternalPaintTrack, 'id'>> = {}): InternalPaintTrack {
  return { id, name: id, order: 0, visible: true, solo: false, opacity: 1, blendMode: 'normal', revision: 0, frames: {}, rotoPhysical: null, loopClips: [], ...overrides };
}

function flatDocument(tracks: InternalPaintTrack[], background?: Partial<EfxPaintDocument['background']>): EfxPaintDocument {
  const base = createEfxPaintDocument(FLAT_LAYER);
  const effectiveTracks = tracks.length > 0 ? tracks : [flatTrack('ghost-track', { visible: false })];
  return { ...base, activeTrackId: effectiveTracks[0]?.id ?? base.activeTrackId, tracks: effectiveTracks, background: { ...base.background, ...background } };
}

function seedRoto(trackId: string, keys: Array<{ keyId: string; appFrame: number; bytes: Uint8Array }>): void {
  const records = keys.map((key) => ({ keyId: key.keyId, appFrame: key.appFrame, kind: 'real-key' as const, payload: { frameIndex: 0, appFrame: key.appFrame, bytes: key.bytes } }));
  const interpolation = { enabled: false, mode: 'duplicate' as const };
  const result = physicPaintStore.replaceRotoPhysicalDocument(FLAT_LAYER, trackId, {
    capacity: 600, realKeyRecords: records, interpolation, scriptMotion: { deformation: 0, position: 0 },
    background: null, selectedKeyId: null, cursorAppFrame: 0, loopClips: [],
    revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, []),
  });
  if (!result.ok) throw new Error(result.error);
}

let createdCanvases: FlatTestCanvas[];

beforeEach(() => {
  _setPhysicPaintMarkDirtyCallback(() => {});
  physicPaintStore.reset();
  resetEfxPaintStore();
  resetProjectPaperRasterForTests();
  createdCanvases = [];
  _setPhysicPaintCompositorSizeProvider(() => ({ width: 4, height: 3 }));
  decodeWebpFrameMock.mockReset();
  decodeWebpFrameMock.mockResolvedValue({ width: 4, height: 3, rgba: new Uint8Array(4 * 3 * 4) });
  vi.stubGlobal('document', { createElement: (tag: string) => { if (tag === 'canvas') { const c = new FlatTestCanvas([]); createdCanvases.push(c); return c; } return {}; } });
  vi.stubGlobal('HTMLCanvasElement', FlatTestCanvas);
  vi.stubGlobal('ImageData', class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} });
  vi.stubGlobal('createImageBitmap', async () => new FlatTestBitmap());
});

afterEach(() => {
  _setPhysicPaintCompositorSizeProvider(null);
  vi.unstubAllGlobals();
});

async function flattenAfterDecode(frame: number) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const record = physicPaintStore.getFlattenedFrame(FLAT_LAYER, frame, false);
    if (record !== null) return record;
    await flushDecode();
  }
  return null;
}

function makeFrame(seed: string) {
  return { frameIndex: 0, appFrame: 5, bytes: testWebpBytes(btoa(seed)), width: 4, height: 3 };
}

describe('repro: hide/show round trip keeps both layers in the composite', () => {
  it('two roto tracks, hide B then show B: still 2 draws', async () => {
    registerDocument(flatDocument([
      flatTrack('track-a', { order: 0 }),
      flatTrack('track-b', { order: 1 }),
    ], { visible: false }));
    seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, bytes: makeFrame('frame-a').bytes }]);
    seedRoto('track-b', [{ keyId: 'kb', appFrame: 5, bytes: makeFrame('frame-b').bytes }]);

    const both = (await flattenAfterDecode(5))!;
    const bothLog = both.raster.log();
    console.log('BOTH:', bothLog, 'key:', both.cacheKey);
    expect(bothLog.match(/draw\(/g)?.length).toBe(2);

    const result = setTrackVisible(FLAT_LAYER, 'track-b', false);
    console.log('hide result', result);
    const hidden = (await flattenAfterDecode(5))!;
    console.log('HIDDEN:', hidden.raster.log(), 'key:', hidden.cacheKey);
    expect(hidden.raster.log().match(/draw\(/g)?.length).toBe(1);

    setTrackVisible(FLAT_LAYER, 'track-b', true);
    const shown = (await flattenAfterDecode(5))!;
    console.log('SHOWN AGAIN:', shown.raster.log(), 'key:', shown.cacheKey);
    expect(shown.raster.log().match(/draw\(/g)?.length).toBe(2);
  });
});
