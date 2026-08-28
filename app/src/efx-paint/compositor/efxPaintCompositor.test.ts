/**
 * Composite pipeline contract tests (Phase 48-01 Task 1 — RED).
 *
 * CMP-01/CMP-03/CMP-05 unit gates: the recording-context fixture mirrors
 * `previewRenderer.test.ts` — vitest runs in a node environment with no real
 * Canvas 2D, so the pipeline is verified by recording the exact op sequence
 * with the alpha/composite-op values in effect at draw time. Pixel truth (the
 * 48-06 pixel acceptance matrix) is native UAT.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createEfxPaintDocument } from '../document/efxPaintDocument';
import type { EfxPaintDocument, InternalPaintTrack } from '../document/efxPaintDocument';
import { compositeFrame } from './efxPaintCompositor';
import type {
  EfxPaintCompositorPorts,
  EfxPaintTrackContentResolution,
} from './efxPaintCompositor';

const root = resolve(__dirname, '../../..'); // app/
const readSource = (path: string) => readFileSync(resolve(root, path), 'utf8');

const BLEND_OPS: Record<string, GlobalCompositeOperation> = {
  normal: 'source-over',
  screen: 'screen',
  multiply: 'multiply',
  overlay: 'overlay',
  add: 'lighter',
};

type RecordedCanvasOp =
  | { type: 'fillRect'; x: number; y: number; w: number; h: number; fillStyle: string; globalAlpha: number; globalCompositeOperation: GlobalCompositeOperation }
  | { type: 'drawImage'; source: string; args: number[]; globalAlpha: number; globalCompositeOperation: GlobalCompositeOperation }
  | { type: 'clearRect'; w: number; h: number }
  | { type: 'save' }
  | { type: 'restore' };

class RecordingCanvasContext {
  operations: RecordedCanvasOp[];
  fillStyle: string | CanvasGradient | CanvasPattern = '#000000';
  globalAlpha = 1;
  globalCompositeOperation: GlobalCompositeOperation = 'source-over';
  private stateStack: Array<Pick<RecordingCanvasContext, 'fillStyle' | 'globalAlpha' | 'globalCompositeOperation'>> = [];

  constructor(operations: RecordedCanvasOp[]) {
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

  clearRect(_x: number, _y: number, w: number, h: number): void {
    this.operations.push({ type: 'clearRect', w, h });
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

  drawImage(source: CanvasImageSource, ...args: number[]): void {
    this.operations.push({
      type: 'drawImage',
      source: source instanceof TestRaster ? source.id : 'unknown',
      args,
      globalAlpha: this.globalAlpha,
      globalCompositeOperation: this.globalCompositeOperation,
    });
  }
}

class TestRaster {
  constructor(public readonly id: string) {}
}

/** A TestRaster widened to the CanvasImageSource port type (cast is test-only). */
function raster(id: string): CanvasImageSource {
  return new TestRaster(id) as unknown as CanvasImageSource;
}

function makeHarness(options: {
  content?: Record<string, EfxPaintTrackContentResolution>;
  background?: 'content' | 'gap' | 'missing';
} = {}): { ops: RecordedCanvasOp[]; ports: EfxPaintCompositorPorts } {
  const ops: RecordedCanvasOp[] = [];
  const content = options.content ?? {};
  const backgroundMode = options.background ?? 'gap';
  const ports: EfxPaintCompositorPorts = {
    createCanvas: (_width, _height) => {
      const canvas = raster('canvas');
      const ctx = new RecordingCanvasContext(ops) as unknown as CanvasRenderingContext2D;
      return { canvas, ctx };
    },
    resolveTrackContent: (trackId) => content[trackId] ?? { kind: 'content', raster: raster(trackId) },
    resolveBackgroundFrame: () => {
      if (backgroundMode === 'content') return { kind: 'content', raster: raster('background') };
      if (backgroundMode === 'missing') return { kind: 'missing', missingRefs: ['bg-ref'] };
      return { kind: 'gap' };
    },
    compositeOp: (mode) => BLEND_OPS[mode] ?? 'source-over',
  };
  return { ops, ports };
}

function makeTrack(id: string, overrides: Partial<InternalPaintTrack> = {}): InternalPaintTrack {
  return {
    id,
    name: `Track ${id}`,
    order: 0,
    visible: true,
    solo: false,
    opacity: 1,
    blendMode: 'normal',
    revision: 0,
    frames: Object.freeze({}),
    rotoPhysical: null,
    loopClips: Object.freeze([]),
    ...overrides,
  };
}

function makeDocument(
  tracks: readonly InternalPaintTrack[],
  backgroundOverrides: Partial<EfxPaintDocument['background']> = {},
): EfxPaintDocument {
  const base = createEfxPaintDocument('layer-1');
  return {
    ...base,
    tracks,
    background: { ...base.background, ...backgroundOverrides },
  };
}

describe('compositeFrame — pipeline contract (CMP-01/CMP-03/CMP-05)', () => {
  it('applies opacity before blend per track: save → alpha → compositeOp → drawImage → restore, lower track first (D-01)', () => {
    const { ops, ports } = makeHarness({
      content: {
        'track-a': { kind: 'content', raster: raster('track-a') },
        'track-b': { kind: 'content', raster: raster('track-b') },
      },
    });
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1, opacity: 0.5, blendMode: 'multiply' }),
    ]);

    const result = compositeFrame(doc, 0, { width: 4, height: 3 }, ports);

    expect(result.missing).toEqual([]);
    // Transparent fallback → cleared canvas first; then each track's
    // save → drawImage(with alpha + compositeOp in effect) → restore.
    expect(ops[0]).toEqual({ type: 'clearRect', w: 4, h: 3 });
    expect(ops.slice(1)).toEqual([
      { type: 'save' },
      { type: 'drawImage', source: 'track-a', args: [0, 0], globalAlpha: 1, globalCompositeOperation: 'source-over' },
      { type: 'restore' },
      { type: 'save' },
      { type: 'drawImage', source: 'track-b', args: [0, 0], globalAlpha: 0.5, globalCompositeOperation: 'multiply' },
      { type: 'restore' },
    ]);
  });

  it('a missing source contributes transparent pixels AND a missing[] entry — zero draw ops, never a placeholder fill (D-09)', () => {
    const { ops, ports } = makeHarness({
      content: {
        'track-a': { kind: 'content', raster: raster('track-a') },
        'track-b': { kind: 'missing', missingRefs: ['ref-1'] },
      },
    });
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1 }),
    ]);

    const result = compositeFrame(doc, 5, { width: 4, height: 3 }, ports);

    expect(result.missing).toEqual([{ trackId: 'track-b', frame: 5, missingRefs: ['ref-1'] }]);
    const draws = ops.filter((op) => op.type === 'drawImage');
    expect(draws).toEqual([
      { type: 'drawImage', source: 'track-a', args: [0, 0], globalAlpha: 1, globalCompositeOperation: 'source-over' },
    ]);
  });

  it('empty composite returns a non-null fully-transparent raster at the injected size (edge CMP-01 empty)', () => {
    const { ops, ports } = makeHarness();
    const doc = makeDocument([
      makeTrack('track-a', { visible: false }),
      makeTrack('track-b', { visible: false }),
    ]);

    const result = compositeFrame(doc, 0, { width: 4, height: 3 }, ports);

    expect(result).not.toBeNull();
    expect(result.raster).toBeTruthy();
    expect(result.participates.trackIds).toEqual([]);
    expect(result.participates.background).toBe(true);
    expect(ops).toEqual([{ type: 'clearRect', w: 4, h: 3 }]);
  });

  it('solid fallback fills the canvas before any track draw (spec step 1)', () => {
    const { ops, ports } = makeHarness({
      content: { 'track-a': { kind: 'content', raster: raster('track-a') } },
    });
    const doc = makeDocument(
      [makeTrack('track-a', { order: 0 })],
      { fallback: { mode: 'solid', color: '#112233' } },
    );

    const result = compositeFrame(doc, 0, { width: 4, height: 3 }, ports);

    expect(result.missing).toEqual([]);
    // The first recorded op is the solid fallback fill (no clips → background
    // resolves 'gap' → fallback already painted), before any track draw.
    expect(ops[0]).toEqual({
      type: 'fillRect',
      x: 0,
      y: 0,
      w: 4,
      h: 3,
      fillStyle: '#112233',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
    });
    const fillIndex = ops.findIndex((op) => op.type === 'fillRect');
    const drawIndex = ops.findIndex((op) => op.type === 'drawImage');
    expect(fillIndex).toBeLessThan(drawIndex);
  });

  it('documents the straight-alpha boundary and never manually premultiplies (D-02)', () => {
    const source = readSource('src/efx-paint/compositor/efxPaintCompositor.ts');
    expect(source).toContain('straight');
    expect(source).not.toContain('premultiply');
    expect(source).not.toContain('putImageData');
    expect(source).not.toContain('getImageData');
  });
});
