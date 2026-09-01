import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import type { EfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import {
  physicPaintStore,
  registerReferenceSourceImage,
} from '../../../stores/physicPaintStore';
import {
  _setEfxPaintMarkDirtyCallback,
  getDocument,
  registerDocument,
  reset,
  setPhotoReferenceOpacity,
  setPhotoReferenceSource,
  setPhotoReferenceTransform,
  setPhotoReferenceVisible,
} from '../../../stores/efxPaintStore';
import { drawReferenceGhost, shouldDrawReferenceGhost } from './PhysicsPaintReferenceGhost';

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

describe('shouldDrawReferenceGhost (50-04 S3 decision)', () => {
  beforeEach(() => {
    physicPaintStore.reset();
    reset();
    _setEfxPaintMarkDirtyCallback(() => {});
  });

  it('returns draw:false for a null photo/reference track', () => {
    const layerId = 'layer-photo';
    registerDocument(makeTrackDocument(layerId));
    const document = getDocument(layerId)!;
    expect(document.photoReference).toBeNull();
    expect(shouldDrawReferenceGhost(document, 0, false)).toEqual({ draw: false, verdict: null });
  });

  it('returns draw:false when the overlay is hidden (D-11)', () => {
    const layerId = 'layer-photo';
    registerDocument(makeTrackDocument(layerId));
    setPhotoReferenceSource(layerId, ['f0']);
    registerReferenceSourceImage('f0', 'data:f0');
    setPhotoReferenceVisible(layerId, false);
    const document = getDocument(layerId)!;
    expect(shouldDrawReferenceGhost(document, 0, false)).toEqual({ draw: false, verdict: null });
  });

  it('returns draw:false during playback (D-14)', () => {
    const layerId = 'layer-photo';
    registerDocument(makeTrackDocument(layerId));
    setPhotoReferenceSource(layerId, ['f0']);
    registerReferenceSourceImage('f0', 'data:f0');
    const document = getDocument(layerId)!;
    expect(shouldDrawReferenceGhost(document, 0, true)).toEqual({ draw: false, verdict: null });
  });

  it('returns draw:false for a missing resolved source frame (D-04 fail-closed)', () => {
    const layerId = 'layer-photo';
    registerDocument(makeTrackDocument(layerId));
    setPhotoReferenceSource(layerId, ['present', 'absent']);
    registerReferenceSourceImage('present', 'data:present');
    const document = getDocument(layerId)!;
    // frame 0 resolves; frame 1 is missing → fail-closed null
    expect(shouldDrawReferenceGhost(document, 0, false)).toEqual({
      draw: true,
      verdict: { ref: 'present', dataUrl: 'data:present', clamped: false },
    });
    expect(shouldDrawReferenceGhost(document, 1, false)).toEqual({ draw: false, verdict: null });
  });

  it('returns draw:true with the frame-aligned clamped verdict otherwise (D-15)', () => {
    const layerId = 'layer-photo';
    registerDocument(makeTrackDocument(layerId));
    setPhotoReferenceSource(layerId, ['f0', 'f1', 'f2']);
    registerReferenceSourceImage('f0', 'data:f0');
    registerReferenceSourceImage('f1', 'data:f1');
    registerReferenceSourceImage('f2', 'data:f2');
    const document = getDocument(layerId)!;
    expect(shouldDrawReferenceGhost(document, 0, false)).toEqual({
      draw: true,
      verdict: { ref: 'f0', dataUrl: 'data:f0', clamped: false },
    });
    expect(shouldDrawReferenceGhost(document, 1, false)).toEqual({
      draw: true,
      verdict: { ref: 'f1', dataUrl: 'data:f1', clamped: false },
    });
    // frame 3 clamps to the last source frame (sequence end holds)
    expect(shouldDrawReferenceGhost(document, 3, false)).toEqual({
      draw: true,
      verdict: { ref: 'f2', dataUrl: 'data:f2', clamped: true },
    });
  });
});

describe('drawReferenceGhost (50-04 S3 monitor-paint draw)', () => {
  type GhostOp =
    | { type: 'save' }
    | { type: 'restore' }
    | { type: 'translate'; x: number; y: number }
    | { type: 'rotate'; angle: number }
    | { type: 'scale'; x: number; y: number }
    | { type: 'drawImage'; source: string; globalAlpha: number; globalCompositeOperation: string };

  class FlatRecordingContext {
    readonly ops: GhostOp[];
    canvas: { width: number; height: number };
    fillStyle: string = '#000000';
    globalAlpha = 1;
    globalCompositeOperation = 'source-over';
    private stack: Array<{ fillStyle: string; globalAlpha: number; globalCompositeOperation: string }> = [];
    constructor(ops: GhostOp[], canvas: { width: number; height: number }) {
      this.ops = ops;
      this.canvas = canvas;
    }
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
    translate(x: number, y: number): void { this.ops.push({ type: 'translate', x, y }); }
    rotate(angle: number): void { this.ops.push({ type: 'rotate', angle }); }
    scale(x: number, y: number): void { this.ops.push({ type: 'scale', x, y }); }
    drawImage(source?: unknown, ..._args: number[]): void {
      const sourceLabel = source !== null && typeof source === 'object' && 'src' in source
        ? String((source as { src: unknown }).src)
        : 'canvas';
      this.ops.push({ type: 'drawImage', source: sourceLabel, globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation });
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

  beforeEach(() => {
    physicPaintStore.reset();
    reset();
    _setEfxPaintMarkDirtyCallback(() => {});
    vi.stubGlobal('Image', FlatTestImage);
    vi.stubGlobal('HTMLImageElement', FlatTestImage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function makeContext(ops: GhostOp[]): FlatRecordingContext {
    return new FlatRecordingContext(ops, { width: 100, height: 50 });
  }

  it('draws nothing when the decision is draw:false (no track / hidden / playing / missing)', () => {
    const layerId = 'layer-photo';
    registerDocument(makeTrackDocument(layerId));
    const document = getDocument(layerId)!;
    const ops: GhostOp[] = [];
    const ctx = makeContext(ops);
    // no track
    drawReferenceGhost(ctx as unknown as CanvasRenderingContext2D, document, 0, 0.5, false);
    expect(ops).toEqual([]);
  });

  it('applies the overlay opacity and the display transform with no tint/blend/outline (D-09, D-13)', () => {
    const layerId = 'layer-photo';
    registerDocument(makeTrackDocument(layerId));
    setPhotoReferenceSource(layerId, ['f0']);
    registerReferenceSourceImage('f0', 'data:f0');
    setPhotoReferenceOpacity(layerId, 0.8);
    setPhotoReferenceTransform(layerId, { x: 10, y: 20, scaleX: 1.5, scaleY: 0.5, rotation: 45 });
    const document = getDocument(layerId)!;
    const ops: GhostOp[] = [];
    const ctx = makeContext(ops);
    drawReferenceGhost(ctx as unknown as CanvasRenderingContext2D, document, 0, 0.5, false);

    // save → opacity → translate → rotate → scale → drawImage → restore
    expect(ops[0]).toEqual({ type: 'save' });
    // globalAlpha is set to the track opacity (0.8) before the draw
    const drawOp = ops.find((op) => op.type === 'drawImage') as Extract<GhostOp, { type: 'drawImage' }>;
    expect(drawOp.globalAlpha).toBe(0.8);
    // no tint (fillStyle unchanged), no blend-mode change, no outline
    expect(drawOp.globalCompositeOperation).toBe('source-over');
    expect(ops.some((op) => op.type === 'translate')).toBe(true);
    expect(ops.some((op) => op.type === 'rotate')).toBe(true);
    expect(ops.some((op) => op.type === 'scale')).toBe(true);
    expect(ops[ops.length - 1]).toEqual({ type: 'restore' });
  });

  it('centers the image and scales it by zoom with the transform offset (D-13)', () => {
    const layerId = 'layer-photo';
    registerDocument(makeTrackDocument(layerId));
    setPhotoReferenceSource(layerId, ['f0']);
    registerReferenceSourceImage('f0', 'data:f0');
    setPhotoReferenceTransform(layerId, { x: 10, y: 20, scaleX: 1, scaleY: 1, rotation: 0 });
    const document = getDocument(layerId)!;
    const ops: GhostOp[] = [];
    const ctx = makeContext(ops);
    drawReferenceGhost(ctx as unknown as CanvasRenderingContext2D, document, 0, 0.5, false);

    const translate = ops.find((op) => op.type === 'translate') as Extract<GhostOp, { type: 'translate' }>;
    // canvas 100x50, zoom 0.5, transform x:10 y:20 → center + offset*zoom
    expect(translate.x).toBe(100 / 2 + 10 * 0.5);
    expect(translate.y).toBe(50 / 2 + 20 * 0.5);
    const draw = ops.find((op) => op.type === 'drawImage') as Extract<GhostOp, { type: 'drawImage' }>;
    expect(draw.source).toBe('data:f0');
  });

  it('converts rotation from degrees to radians (D-13)', () => {
    const layerId = 'layer-photo';
    registerDocument(makeTrackDocument(layerId));
    setPhotoReferenceSource(layerId, ['f0']);
    registerReferenceSourceImage('f0', 'data:f0');
    setPhotoReferenceTransform(layerId, { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 90 });
    const document = getDocument(layerId)!;
    const ops: GhostOp[] = [];
    const ctx = makeContext(ops);
    drawReferenceGhost(ctx as unknown as CanvasRenderingContext2D, document, 0, 1, false);

    const rotate = ops.find((op) => op.type === 'rotate') as Extract<GhostOp, { type: 'rotate' }>;
    expect(rotate.angle).toBeCloseTo(Math.PI / 2);
  });
});
