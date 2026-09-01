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
import type {
  BackgroundTrack,
  BlendMode,
  EfxPaintDocument,
  FrameLoopClip,
  InternalPaintTrack,
} from '../document/efxPaintDocument';
import {
  deriveEfxPaintBackgroundResolution,
  resolveEfxPaintBackgroundFrame,
} from './efxPaintBackgroundResolution';
import type { EfxPaintBackgroundFrameResolution } from './efxPaintBackgroundResolution';
import { createKeyedMemo } from './efxPaintCompositeCache';
import { compositeFrame, EFX_PAINT_BACKGROUND_MISSING_FILL } from './efxPaintCompositor';
import type {
  EfxPaintCompositorPorts,
  EfxPaintCompositeResult,
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
  backgroundResolutions?: ReadonlyMap<number, EfxPaintBackgroundFrameResolution>;
  backgroundSourceImages?: Record<string, CanvasImageSource>;
} = {}): { ops: RecordedCanvasOp[]; ports: EfxPaintCompositorPorts } {
  const ops: RecordedCanvasOp[] = [];
  const content = options.content ?? {};
  const backgroundMode = options.background ?? 'gap';
  const ports = {
    createCanvas: (_width: number, _height: number) => {
      const canvas = raster('canvas');
      const ctx = new RecordingCanvasContext(ops) as unknown as CanvasRenderingContext2D;
      return { canvas, ctx };
    },
    resolveTrackContent: (trackId: string) => content[trackId] ?? { kind: 'content', raster: raster(trackId) },
    // D-03 seam: the port consumes the 48-02 resolution union — content names
    // the clip's source ref, decoded through resolveBackgroundSourceImage.
    resolveBackgroundFrame: (frame: number): EfxPaintBackgroundFrameResolution => {
      if (options.backgroundResolutions) {
        return options.backgroundResolutions.get(frame) ?? Object.freeze({ kind: 'gap' });
      }
      if (backgroundMode === 'content') return { kind: 'content', clipId: 'bg-clip', sourceRef: 'bg-ref' };
      if (backgroundMode === 'missing') return { kind: 'missing', clipId: 'bg-clip', missingRefs: Object.freeze(['bg-ref']) };
      return { kind: 'gap' };
    },
    resolveBackgroundSourceImage: (sourceRef: string) => options.backgroundSourceImages?.[sourceRef] ?? raster(sourceRef),
    compositeOp: (mode: BlendMode) => BLEND_OPS[mode] ?? 'source-over',
  };
  // Cast through unknown: the RED-phase harness already speaks the 48-04 port
  // shape (source-ref union + decode port) while the source interface still
  // declares the 48-01 raster union — the GREEN implementation closes the gap.
  return { ops, ports: ports as unknown as EfxPaintCompositorPorts };
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
    activeTrackId: tracks[0]?.id ?? base.activeTrackId,
    tracks,
    background: { ...base.background, ...backgroundOverrides },
  };
}

function makeClip(overrides: Partial<FrameLoopClip> = {}): FrameLoopClip {
  return {
    id: 'clip-1',
    startFrame: 0,
    sourceFrameRefs: Object.freeze(['ref-1']),
    repeat: { mode: 'finite', count: 1 },
    sourceKind: 'imported-background',
    revision: 0,
    ...overrides,
  };
}

function makeBackground(
  clips: readonly FrameLoopClip[] = [],
  overrides: Partial<BackgroundTrack> = {},
): BackgroundTrack {
  const base = createEfxPaintDocument('layer-1').background;
  return {
    ...base,
    clips: Object.freeze([...clips]),
    ...overrides,
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
      { type: 'drawImage', source: 'track-a', args: [0, 0, 4, 3], globalAlpha: 1, globalCompositeOperation: 'source-over' },
      { type: 'restore' },
      { type: 'save' },
      { type: 'drawImage', source: 'track-b', args: [0, 0, 4, 3], globalAlpha: 0.5, globalCompositeOperation: 'multiply' },
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
      { type: 'drawImage', source: 'track-a', args: [0, 0, 4, 3], globalAlpha: 1, globalCompositeOperation: 'source-over' },
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

  it('48-06 UAT-C: the solid fallback composites BENEATH the tracks via destination-over — the track never blends against it', () => {
    const { ops, ports } = makeHarness({
      content: { 'track-a': { kind: 'content', raster: raster('track-a') } },
    });
    const doc = makeDocument(
      [makeTrack('track-a', { order: 0 })],
      { fallback: { mode: 'solid', color: '#112233' } },
    );

    const result = compositeFrame(doc, 0, { width: 4, height: 3 }, ports);

    expect(result.missing).toEqual([]);
    // The working canvas clears first; the track draws ON the stage (blend
    // modes apply between tracks only); the solid fallback then fills BENEATH
    // via destination-over — it is never a blend backdrop for the tracks.
    expect(ops[0]).toEqual({ type: 'clearRect', w: 4, h: 3 });
    const drawIndex = ops.findIndex((op) => op.type === 'drawImage');
    const fillIndex = ops.findIndex((op) => op.type === 'fillRect');
    expect(drawIndex).toBeGreaterThanOrEqual(0);
    expect(fillIndex).toBeGreaterThan(drawIndex);
    expect(ops[fillIndex]).toEqual({
      type: 'fillRect',
      x: 0,
      y: 0,
      w: 4,
      h: 3,
      fillStyle: '#112233',
      globalAlpha: 1,
      globalCompositeOperation: 'destination-over',
    });
  });

  it('48-06 UAT-C: track blend modes apply BETWEEN tracks only — the lowest track establishes the stage with source-over', () => {
    const { ops, ports } = makeHarness({
      content: {
        'track-a': { kind: 'content', raster: raster('track-a') },
        'track-b': { kind: 'content', raster: raster('track-b') },
      },
    });
    const doc = makeDocument([
      // Bottom track with a NON-normal blend: over an empty backdrop it would
      // erase itself (multiply over transparent = transparent), so the stage
      // law promotes it to the source-over base…
      makeTrack('track-a', { order: 0, blendMode: 'multiply' }),
      // …and every track above blends onto the accumulated stage with its own
      // declared mode (opacity applied first, D-01).
      makeTrack('track-b', { order: 1, opacity: 0.5, blendMode: 'screen' }),
    ]);
    const result = compositeFrame(doc, 0, { width: 4, height: 3 }, ports);

    expect(result.missing).toEqual([]);
    const drawA = ops.find((op) => op.type === 'drawImage' && op.source === 'track-a');
    const drawB = ops.find((op) => op.type === 'drawImage' && op.source === 'track-b');
    expect(drawA).toMatchObject({ globalCompositeOperation: 'source-over', globalAlpha: 1 });
    expect(drawB).toMatchObject({ globalCompositeOperation: 'screen', globalAlpha: 0.5 });
  });

  it('documents the straight-alpha boundary and never manually premultiplies (D-02)', () => {
    const source = readSource('src/efx-paint/compositor/efxPaintCompositor.ts');
    expect(source).toContain('straight');
    expect(source).not.toContain('premultiply');
    expect(source).not.toContain('putImageData');
    expect(source).not.toContain('getImageData');
  });
});

// --- Phase 48-01 Task 3: per-frame flattened memo integration (D-08, P-48-6) ---

/**
 * Harness that wires the caller-supplied flattened memo + track raster memo +
 * key terms into the ports, and counts `resolveTrackContent` consultations so
 * tests can prove the second identical call performs zero content-port queries.
 */
function makeCachedHarness(options: {
  content?: Record<string, EfxPaintTrackContentResolution>;
  background?: 'content' | 'gap' | 'missing';
  backgroundResolutions?: ReadonlyMap<number, EfxPaintBackgroundFrameResolution>;
  backgroundSourceImages?: Record<string, CanvasImageSource>;
  trackContentRevisions?: ReadonlyMap<string, string>;
  backgroundClipRevisions?: readonly string[];
} = {}): {
  ops: RecordedCanvasOp[];
  ports: EfxPaintCompositorPorts;
  calls: Map<string, number>;
  revisions: Map<string, string>;
} {
  const base = makeHarness({
    content: options.content,
    background: options.background,
    backgroundResolutions: options.backgroundResolutions,
    backgroundSourceImages: options.backgroundSourceImages,
  });
  const calls = new Map<string, number>();
  const revisions = new Map(options.trackContentRevisions ?? []);
  const resolveTrackContent = (trackId: string, frame: number): EfxPaintTrackContentResolution => {
    calls.set(trackId, (calls.get(trackId) ?? 0) + 1);
    return base.ports.resolveTrackContent(trackId, frame);
  };
  const ports: EfxPaintCompositorPorts = {
    ...base.ports,
    resolveTrackContent,
    memo: createKeyedMemo<string, EfxPaintCompositeResult>(),
    trackRasterMemo: createKeyedMemo<string, EfxPaintTrackContentResolution>(),
    trackContentRevisions: revisions,
    backgroundClipRevisions: options.backgroundClipRevisions ?? [],
  };
  return { ops: base.ops, ports, calls, revisions };
}

describe('compositeFrame — per-frame flattened memo (D-08, CMP-04)', () => {
  it('an identical second call returns the cached frozen result — zero content queries, zero draw ops (P-48-6)', () => {
    const { ops, ports, calls } = makeCachedHarness({
      content: {
        'track-a': { kind: 'content', raster: raster('track-a') },
        'track-b': { kind: 'content', raster: raster('track-b') },
      },
      trackContentRevisions: new Map([
        ['track-a', 'rev-a'],
        ['track-b', 'rev-b'],
      ]),
    });
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1 }),
    ]);
    const size = { width: 4, height: 3 };

    const first = compositeFrame(doc, 0, size, ports);
    expect(calls.get('track-a')).toBe(1);
    expect(calls.get('track-b')).toBe(1);
    const opsAfterFirst = ops.length;
    const drawsAfterFirst = ops.filter((op) => op.type === 'drawImage').length;

    const second = compositeFrame(doc, 0, size, ports);
    expect(second.raster).toBe(first.raster); // SAME canvas reference
    expect(calls.get('track-a')).toBe(1); // never re-queried
    expect(calls.get('track-b')).toBe(1);
    expect(ops.length).toBe(opsAfterFirst); // zero new draw ops
    expect(ops.filter((op) => op.type === 'drawImage').length).toBe(drawsAfterFirst);
    expect(Object.isFrozen(second)).toBe(true);
  });

  it('bumping ONE track content revision re-runs the pass; the sibling track is served from the track raster memo (per-track isolation)', () => {
    const { ports, calls, revisions } = makeCachedHarness({
      content: {
        'track-a': { kind: 'content', raster: raster('track-a') },
        'track-b': { kind: 'content', raster: raster('track-b') },
      },
      trackContentRevisions: new Map([
        ['track-a', 'rev-a'],
        ['track-b', 'rev-b'],
      ]),
    });
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1 }),
    ]);
    const size = { width: 4, height: 3 };

    compositeFrame(doc, 0, size, ports);
    expect(calls.get('track-a')).toBe(1);
    expect(calls.get('track-b')).toBe(1);

    // Track B content revision bumps → flattened key changes → the pass runs
    // again, but track A's content key is unchanged → served from the track
    // raster memo (no re-query).
    revisions.set('track-b', 'rev-b2');
    compositeFrame(doc, 0, size, ports);
    expect(calls.get('track-a')).toBe(1);
    expect(calls.get('track-b')).toBe(2);
  });

  it('toggling a track config (solo) flips the flattened key → full re-run with the new participating set', () => {
    const { ops, ports, calls } = makeCachedHarness({
      content: {
        'track-a': { kind: 'content', raster: raster('track-a') },
        'track-b': { kind: 'content', raster: raster('track-b') },
      },
      trackContentRevisions: new Map([
        ['track-a', 'rev-a'],
        ['track-b', 'rev-b'],
      ]),
    });
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1 }),
    ]);
    const size = { width: 4, height: 3 };

    const first = compositeFrame(doc, 0, size, ports);
    expect(first.participates.trackIds).toEqual(['track-a', 'track-b']);

    const soloDoc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1, solo: true }),
    ]);
    const opsBefore = ops.length;
    const second = compositeFrame(soloDoc, 0, size, ports);
    expect(second.participates.trackIds).toEqual(['track-b']);
    // Re-run happened: a new draw pass produced ops.
    expect(ops.length).toBeGreaterThan(opsBefore);
    // Track B content key unchanged → served from the track raster memo; A no
    // longer participates and is never re-queried.
    expect(calls.get('track-b')).toBe(1);
    expect(calls.get('track-a')).toBe(1);
  });

  it('a missing-source frame caches the frozen missing[] report; a cache hit returns the identical frozen report', () => {
    const { ports, calls } = makeCachedHarness({
      content: {
        'track-a': { kind: 'content', raster: raster('track-a') },
        'track-b': { kind: 'missing', missingRefs: ['ref-1'] },
      },
      trackContentRevisions: new Map([
        ['track-a', 'rev-a'],
        ['track-b', 'rev-b'],
      ]),
    });
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1 }),
    ]);
    const size = { width: 4, height: 3 };

    const first = compositeFrame(doc, 0, size, ports);
    expect(first.missing).toEqual([{ trackId: 'track-b', frame: 0, missingRefs: ['ref-1'] }]);
    expect(Object.isFrozen(first.missing)).toBe(true);

    const second = compositeFrame(doc, 0, size, ports);
    expect(second).toBe(first);
    expect(second.missing).toBe(first.missing); // identical frozen report
    expect(calls.get('track-b')).toBe(1); // missing source resolved exactly once
  });
});

// --- Phase 48-04 Task 1: Background step — spec steps 1-3 (D-03/D-04/D-09) ---

describe('compositeFrame — Background contribution beneath all Paint tracks (48-04 Task 1)', () => {
  it('48-06 UAT-C: the Background and the solid fallback composite BENEATH the tracks via destination-over — the tracks blend only among themselves', () => {
    const { ops, ports } = makeHarness({
      content: { 'track-a': { kind: 'content', raster: raster('track-a') } },
      background: 'content',
      backgroundSourceImages: { 'bg-ref': raster('bg-raster') },
    });
    const doc = makeDocument(
      [makeTrack('track-a', { order: 0 })],
      { fallback: { mode: 'solid', color: '#112233' } },
    );

    const result = compositeFrame(doc, 0, { width: 4, height: 3 }, ports);

    expect(result.missing).toEqual([]);
    // Clear → track (source-over stage base) → Background (destination-over,
    // D-04: plain alpha 1, never track-scaled) → solid fallback (destination-
    // over, beneath everything). The track's blend never sees either underlay.
    expect(ops.map((op) => op.type)).toEqual([
      'clearRect', 'save', 'drawImage', 'restore',
      'save', 'drawImage', 'restore',
      'save', 'fillRect', 'restore',
    ]);
    expect(ops[2]).toEqual({
      type: 'drawImage',
      source: 'track-a',
      args: [0, 0, 4, 3],
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
    });
    expect(ops[5]).toEqual({
      type: 'drawImage',
      source: 'bg-raster',
      args: [0, 0, 4, 3],
      globalAlpha: 1,
      globalCompositeOperation: 'destination-over',
    });
    expect(ops[8]).toEqual({
      type: 'fillRect',
      x: 0,
      y: 0,
      w: 4,
      h: 3,
      fillStyle: '#112233',
      globalAlpha: 1,
      globalCompositeOperation: 'destination-over',
    });
  });

  it('a hidden Background is not drawn while the document fallback still paints (D-04 — governed only by background.visible)', () => {
    const { ops, ports } = makeHarness({
      content: { 'track-a': { kind: 'content', raster: raster('track-a') } },
      background: 'content', // would draw if visible
      backgroundSourceImages: { 'bg-ref': raster('bg-raster') },
    });
    const doc = makeDocument(
      [makeTrack('track-a', { order: 0 })],
      { visible: false, fallback: { mode: 'solid', color: '#112233' } },
    );

    const result = compositeFrame(doc, 0, { width: 4, height: 3 }, ports);

    expect(result.participates.background).toBe(false);
    expect(ops[0]).toEqual({ type: 'clearRect', w: 4, h: 3 });
    const draws = ops.filter((op) => op.type === 'drawImage');
    expect(draws).toEqual([
      { type: 'drawImage', source: 'track-a', args: [0, 0, 4, 3], globalAlpha: 1, globalCompositeOperation: 'source-over' },
    ]);
    // The hidden Background is not drawn, but the solid fallback still fills
    // BENEATH the track via destination-over (48-06 UAT-C).
    const filling = ops.find((op) => op.type === 'fillRect');
    expect(filling).toEqual({
      type: 'fillRect',
      x: 0,
      y: 0,
      w: 4,
      h: 3,
      fillStyle: '#112233',
      globalAlpha: 1,
      globalCompositeOperation: 'destination-over',
    });
  });

  it('a Background gap reveals the fallback — no background draw op and no extra fill over the fallback', () => {
    const { ops, ports } = makeHarness({
      content: { 'track-a': { kind: 'content', raster: raster('track-a') } },
      background: 'gap',
    });
    const doc = makeDocument(
      [makeTrack('track-a', { order: 0 })],
      { fallback: { mode: 'solid', color: '#112233' } },
    );

    const result = compositeFrame(doc, 0, { width: 4, height: 3 }, ports);

    expect(result.missing).toEqual([]);
    const fills = ops.filter((op) => op.type === 'fillRect');
    expect(fills).toHaveLength(1); // only the fallback fill — no extra fill
    const draws = ops.filter((op) => op.type === 'drawImage');
    expect(draws).toEqual([
      { type: 'drawImage', source: 'track-a', args: [0, 0, 4, 3], globalAlpha: 1, globalCompositeOperation: 'source-over' },
    ]);
  });

  it('a missing Background source renders the placeholder fill AND a report entry keyed by the background track id (49-06 UAT)', () => {
    const { ops, ports } = makeHarness({
      content: { 'track-a': { kind: 'content', raster: raster('track-a') } },
      background: 'missing',
    });
    const doc = makeDocument([makeTrack('track-a', { order: 0 })]);

    const result = compositeFrame(doc, 5, { width: 4, height: 3 }, ports);

    expect(result.missing).toEqual([{ trackId: doc.background.id, frame: 5, missingRefs: ['bg-ref'] }]);
    const draws = ops.filter((op) => op.type === 'drawImage');
    expect(draws).toEqual([
      { type: 'drawImage', source: 'track-a', args: [0, 0, 4, 3], globalAlpha: 1, globalCompositeOperation: 'source-over' },
    ]);
    // 49-06 UAT: the missing Background fills the WHOLE canvas destination-over
    // (beneath the tracks, in the content-draw position) so the missing clip
    // stays visible for replacement from the right panel — never transparent.
    const fills = ops.filter((op) => op.type === 'fillRect');
    expect(fills).toEqual([
      { type: 'fillRect', x: 0, y: 0, w: 4, h: 3, fillStyle: EFX_PAINT_BACKGROUND_MISSING_FILL, globalAlpha: 1, globalCompositeOperation: 'destination-over' },
    ]);
  });

  it('a soloed Paint track never suppresses the Background — the Background draw stays beneath the soloed track (D-04)', () => {
    const { ops, ports } = makeHarness({
      content: {
        'track-a': { kind: 'content', raster: raster('track-a') },
        'track-b': { kind: 'content', raster: raster('track-b') },
      },
      background: 'content',
      backgroundSourceImages: { 'bg-ref': raster('bg-raster') },
    });
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1, solo: true }),
    ]);

    const result = compositeFrame(doc, 0, { width: 4, height: 3 }, ports);

    expect(result.participates.trackIds).toEqual(['track-b']);
    expect(result.participates.background).toBe(true);
    // 48-06 UAT-C: the soloed track draws first (stage base); the Background
    // then composites BENEATH it via destination-over — it never enters the
    // soloed track's blend mode, but still renders under the lone track.
    const trackDrawIndex = ops.findIndex((op) => op.type === 'drawImage' && op.source === 'track-b');
    const bgDrawIndex = ops.findIndex((op) => op.type === 'drawImage' && op.source === 'bg-raster');
    expect(trackDrawIndex).toBeGreaterThanOrEqual(0);
    expect(bgDrawIndex).toBeGreaterThanOrEqual(0);
    expect(bgDrawIndex).toBeGreaterThan(trackDrawIndex);
  });

  it('an infinite Background loop is capacity-bounded: frames 0 and 19 draw content, frame 20 resolves gap at the parent end (Pitfall 11)', () => {
    const background = makeBackground([makeClip({
      id: 'clip-1',
      startFrame: 0,
      sourceFrameRefs: Object.freeze(['ref-a', 'ref-b', 'ref-c', 'ref-d']),
      repeat: { mode: 'infinite' },
      sourceKind: 'imported-background',
      revision: 1,
    })]);
    // The 48-02 adapter is the derivation authority (Pitfall 10): the
    // compositor consumes its per-frame union — 0 and 19 resolve content
    // inside [0, capacity), 20 resolves gap at the parent end.
    const context = deriveEfxPaintBackgroundResolution(background, 20);
    const knownSources = new Set(['ref-a', 'ref-b', 'ref-c', 'ref-d']);
    const resolutions = new Map<number, EfxPaintBackgroundFrameResolution>([
      [0, resolveEfxPaintBackgroundFrame(context, 0, knownSources)],
      [19, resolveEfxPaintBackgroundFrame(context, 19, knownSources)],
      [20, resolveEfxPaintBackgroundFrame(context, 20, knownSources)],
    ]);
    expect(resolutions.get(20)).toEqual({ kind: 'gap' });

    const { ops, ports } = makeHarness({
      content: { 'track-a': { kind: 'content', raster: raster('track-a') } },
      backgroundResolutions: resolutions,
      backgroundSourceImages: {
        'ref-a': raster('bg-a'),
        'ref-b': raster('bg-b'),
        'ref-c': raster('bg-c'),
        'ref-d': raster('bg-d'),
      },
    });
    const doc = makeDocument([makeTrack('track-a', { order: 0 })], { clips: background.clips });

    compositeFrame(doc, 0, { width: 4, height: 3 }, ports);
    compositeFrame(doc, 19, { width: 4, height: 3 }, ports);
    compositeFrame(doc, 20, { width: 4, height: 3 }, ports);

    const bgDraws = ops.filter(
      (op): op is RecordedCanvasOp & { type: 'drawImage' } =>
        op.type === 'drawImage' && op.source.startsWith('bg-'),
    );
    expect(bgDraws).toHaveLength(2); // 0 and 19 draw; 20 draws nothing (gap)
    expect(bgDraws[0].source).toBe('bg-a'); // frame 0 → ref-a
    expect(bgDraws[1].source).toBe('bg-d'); // frame 19 → 19 % 4 = 3 → ref-d
  });
});

// --- Phase 48-04 Task 2: CMP-04 invalidation matrix — composite-level rows ---

describe('CMP-04 invalidation matrix — composite-level recompute isolation (48-04 Task 2)', () => {
  it('row 6 — per-track memo isolation at frame 5: bump only track B content → A raster reused (0 new resolve), B recomputed exactly once (D-07)', () => {
    const { ports, calls, revisions } = makeCachedHarness({
      content: {
        'track-a': { kind: 'content', raster: raster('track-a') },
        'track-b': { kind: 'content', raster: raster('track-b') },
      },
      trackContentRevisions: new Map([
        ['track-a', 'rev-a'],
        ['track-b', 'rev-b'],
      ]),
    });
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1 }),
    ]);
    const size = { width: 4, height: 3 };

    compositeFrame(doc, 5, size, ports);
    expect(calls.get('track-a')).toBe(1);
    expect(calls.get('track-b')).toBe(1);

    revisions.set('track-b', 'rev-b2');
    compositeFrame(doc, 5, size, ports);
    expect(calls.get('track-a')).toBe(1); // A's cached raster reused
    expect(calls.get('track-b')).toBe(2); // B recomputed exactly once
  });

  it('row 7 — a HIDDEN track content edit does not churn the flattened cache: identical frozen result (participating-only content terms)', () => {
    const { ports, calls, revisions } = makeCachedHarness({
      content: {
        'track-a': { kind: 'content', raster: raster('track-a') },
        'track-b': { kind: 'content', raster: raster('track-b') },
      },
      trackContentRevisions: new Map([
        ['track-a', 'rev-a'],
        ['track-b', 'rev-b'],
      ]),
    });
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1, visible: false }),
    ]);
    const size = { width: 4, height: 3 };

    const first = compositeFrame(doc, 5, size, ports);
    expect(first.participates.trackIds).toEqual(['track-a']);
    expect(first.participates.background).toBe(true);

    // Hidden track B's content revision bumps — its term is absent from the
    // participating key, so the flattened cache hits and the SAME frozen
    // result returns (zero recompute, zero draw ops). The config hash already
    // flips on visibility, so re-showing B re-composites (row 2 'visible').
    revisions.set('track-b', 'rev-b2');
    const second = compositeFrame(doc, 5, size, ports);
    expect(second).toBe(first);
    expect(calls.get('track-a')).toBe(1);
    expect(calls.get('track-b') ?? 0).toBe(0); // hidden → never resolved
  });
});
