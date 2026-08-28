/**
 * EFX Paint pixel acceptance matrix — recording-context contract suite (48-06).
 *
 * CMP-06 unit half. vitest runs in a node environment with no real Canvas 2D,
 * so the spec's pixel acceptance matrix (SPECS/milestone-v1.0.0-plan.md:469-490)
 * is asserted as the DRAWING CONTRACT over the shared compositor
 * (`compositeFrame`) through the 48-01 recording-context fixture — op order,
 * globalAlpha values, globalCompositeOperation, and per-row participation
 * stand in for pixel truth (Open Question 4 resolution: recording-context unit
 * gates + native UAT pixel truth; no canvas test dependency added). The native
 * UAT (48-06 Task 2) asserts the pixels on all three surfaces (Studio, main
 * preview, export).
 *
 * Spec row → test mapping (SPECS:469-490, every row covered):
 *   1.  Two opaque normal Paint tracks            → "matrix row 1 …"
 *   2.  Semi-transparent upper Paint track        → "matrix row 2 …"
 *   3.  Multiply                                  → "matrix row 3 …"
 *   4.  Screen                                    → "matrix row 4 …"
 *   5.  Overlay                                   → "matrix row 5 …"
 *   6.  Add/lighter                               → "matrix row 6 …"
 *   7.  Hidden upper track                        → "matrix row 7 …"
 *   8.  One soloed track                          → "matrix row 8 …"
 *   9.  Multiple soloed tracks if allowed         → "matrix row 9 …"
 *  10.  Hidden-and-soloed precedence              → "matrix row 10 …"
 *  11.  Empty upper frame over lower content      → "matrix row 11 …"
 *  12.  Basic, FX, and Physics/Roto content where supported
 *         → covered through the D-10 content seam (`resolveTrackContent`):
 *           rows 1/11 assert content and content-miss behavior through that
 *           port; Basic/FX are main-editor paint layers, not internal Paint
 *           tracks, so they are out of scope for the internal compositor
 *  13.  One-image Background loop                 → "matrix row 12 …"
 *       Multi-image Background loop               → "matrix row 13 …"
 *       Finite / infinite repeats                 → "matrix rows 14/15 …"
 *  14.  Background gap over solid fallback / transparency
 *                                                 → "matrix rows 16/17 …"
 *  15.  Next clip interrupting a full or partial cycle without overlap
 *                                                 → "matrix rows 18/19 …"
 *  16.  Parent Paint opacity/blend over other outer main-editor layers
 *                                                 → "matrix row 20 …" (previewRenderer seam)
 *  —    Studio / main / export pixel parity       → native UAT (row 20 asserts
 *           the seam contract; the shared-path construction — one compositeFrame
 *           consumed by all three surfaces — is the parity proof, Pitfall 8)
 *  —    Straight-alpha boundary (D-02, Pitfall 7) → "matrix row 21 …"
 *           (structural half; the 50%-white pixel check is native UAT)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { compositeFrame } from './efxPaintCompositor';
import type {
  EfxPaintCompositeSize,
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

// ---------------------------------------------------------------------------
// Recording fixture (48-01/48-04 idiom). The superset ops (scale/createPattern)
// are only exercised by the previewRenderer parent-row harness (row 20); the
// compositor rows record save/drawImage/fillRect/clearRect/restore only.
// ---------------------------------------------------------------------------

type RecordedCanvasOp =
  | { type: 'fillRect'; x: number; y: number; w: number; h: number; fillStyle: string; globalAlpha: number; globalCompositeOperation: GlobalCompositeOperation }
  | { type: 'drawImage'; source: string; args: number[]; globalAlpha: number; globalCompositeOperation: GlobalCompositeOperation }
  | { type: 'createPattern'; source: string; repetition: string | null }
  | { type: 'clearRect'; w: number; h: number }
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

  drawImage(source?: CanvasImageSource, ...args: number[]): void {
    this.operations.push({
      type: 'drawImage',
      source:
        source instanceof TestRaster ? source.id
        : source instanceof TestImage ? source.src
        : source instanceof TestCanvas ? 'canvas'
        : 'unknown',
      args,
      globalAlpha: this.globalAlpha,
      globalCompositeOperation: this.globalCompositeOperation,
    });
  }

  createPattern(source: CanvasImageSource, repetition: string | null): CanvasPattern {
    this.operations.push({ type: 'createPattern', source: source instanceof TestRaster ? source.id : 'unknown', repetition });
    return `pattern:${source instanceof TestRaster ? source.id : 'unknown'}` as unknown as CanvasPattern;
  }
}

class TestRaster {
  constructor(public readonly id: string) {}
}

/** A TestRaster widened to the CanvasImageSource port type (cast is test-only). */
function raster(id: string): CanvasImageSource {
  return new TestRaster(id) as unknown as CanvasImageSource;
}

/** Minimal canvas stub used by the previewRenderer parent-row harness (row 20). */
class TestCanvas {
  width = 4;
  height = 3;
  clientWidth = 4;
  clientHeight = 3;
  offsetWidth = 4;
  offsetHeight = 3;

  constructor(private operations: RecordedCanvasOp[]) {}

  getContext(contextId: string): RecordingCanvasContext | null {
    return contextId === '2d' ? new RecordingCanvasContext(this.operations) : null;
  }

  toDataURL(): string {
    return `data:image/png;base64,${Buffer.from(JSON.stringify(this.operations)).toString('base64')}`;
  }
}

/** Image stub whose src setter fires onload synchronously (renderer decode idiom). */
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

const SIZE: EfxPaintCompositeSize = { width: 4, height: 3 };

/**
 * Composite `frames` in sequence and return, per frame, the source id of the
 * FIRST drawImage op recorded during that composite (background or track raster)
 * or null when the frame drew no raster (pure fallback/gap frame). Because each
 * matrix composite runs in one pass, a frame resolving two clips would surface
 * as TWO drawImage ops in its slice — the row-18/19 no-overlap proof.
 */
function collectDrawSources(
  ops: RecordedCanvasOp[],
  doc: EfxPaintDocument,
  frames: readonly number[],
  ports: EfxPaintCompositorPorts,
  size: EfxPaintCompositeSize,
): Array<string | null> {
  const runs: Array<string | null> = [];
  let before = ops.length;
  for (const frame of frames) {
    compositeFrame(doc, frame, size, ports);
    const draw = ops.slice(before).find(
      (op): op is RecordedCanvasOp & { type: 'drawImage' } => op.type === 'drawImage',
    );
    runs.push(draw ? draw.source : null);
    before = ops.length;
  }
  return runs;
}

// ---------------------------------------------------------------------------
// SPECS rows 1-11: participating Paint tracks (opacity, blend, hide/solo, empty)
// ---------------------------------------------------------------------------

describe('pixel acceptance matrix — Paint track rows (SPECS rows 1-11)', () => {
  it('matrix row 1 — two opaque normal Paint tracks: two drawImage ops, both globalAlpha 1 source-over, lower track first', () => {
    const { ops, ports } = makeHarness({
      content: {
        'track-a': { kind: 'content', raster: raster('track-a') },
        'track-b': { kind: 'content', raster: raster('track-b') },
      },
    });
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1 }),
    ]);

    const result = compositeFrame(doc, 0, SIZE, ports);

    expect(result.missing).toEqual([]);
    const draws = ops.filter((op) => op.type === 'drawImage');
    expect(draws).toEqual([
      { type: 'drawImage', source: 'track-a', args: [0, 0], globalAlpha: 1, globalCompositeOperation: 'source-over' },
      { type: 'drawImage', source: 'track-b', args: [0, 0], globalAlpha: 1, globalCompositeOperation: 'source-over' },
    ]);
  });

  it('matrix row 2 — semi-transparent upper Paint track: upper drawn with globalAlpha 0.5 (opacity BEFORE blend, D-01)', () => {
    const { ops, ports } = makeHarness({
      content: {
        'track-a': { kind: 'content', raster: raster('track-a') },
        'track-b': { kind: 'content', raster: raster('track-b') },
      },
    });
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1, opacity: 0.5 }),
    ]);

    compositeFrame(doc, 0, SIZE, ports);

    const draws = ops.filter((op) => op.type === 'drawImage');
    expect(draws).toEqual([
      { type: 'drawImage', source: 'track-a', args: [0, 0], globalAlpha: 1, globalCompositeOperation: 'source-over' },
      { type: 'drawImage', source: 'track-b', args: [0, 0], globalAlpha: 0.5, globalCompositeOperation: 'source-over' },
    ]);
  });

  it('matrix row 3 — multiply: upper track drawn with globalCompositeOperation multiply', () => {
    const { ops, ports } = makeHarness({
      content: {
        'track-a': { kind: 'content', raster: raster('track-a') },
        'track-b': { kind: 'content', raster: raster('track-b') },
      },
    });
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1, blendMode: 'multiply' }),
    ]);

    compositeFrame(doc, 0, SIZE, ports);

    const upper = ops.find((op): op is RecordedCanvasOp & { type: 'drawImage' } => op.type === 'drawImage' && op.source === 'track-b');
    expect(upper).toEqual({ type: 'drawImage', source: 'track-b', args: [0, 0], globalAlpha: 1, globalCompositeOperation: 'multiply' });
  });

  it('matrix row 4 — screen: upper track drawn with globalCompositeOperation screen', () => {
    const { ops, ports } = makeHarness({
      content: {
        'track-a': { kind: 'content', raster: raster('track-a') },
        'track-b': { kind: 'content', raster: raster('track-b') },
      },
    });
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1, blendMode: 'screen' }),
    ]);

    compositeFrame(doc, 0, SIZE, ports);

    const upper = ops.find((op): op is RecordedCanvasOp & { type: 'drawImage' } => op.type === 'drawImage' && op.source === 'track-b');
    expect(upper).toEqual({ type: 'drawImage', source: 'track-b', args: [0, 0], globalAlpha: 1, globalCompositeOperation: 'screen' });
  });

  it('matrix row 5 — overlay: upper track drawn with globalCompositeOperation overlay', () => {
    const { ops, ports } = makeHarness({
      content: {
        'track-a': { kind: 'content', raster: raster('track-a') },
        'track-b': { kind: 'content', raster: raster('track-b') },
      },
    });
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1, blendMode: 'overlay' }),
    ]);

    compositeFrame(doc, 0, SIZE, ports);

    const upper = ops.find((op): op is RecordedCanvasOp & { type: 'drawImage' } => op.type === 'drawImage' && op.source === 'track-b');
    expect(upper).toEqual({ type: 'drawImage', source: 'track-b', args: [0, 0], globalAlpha: 1, globalCompositeOperation: 'overlay' });
  });

  it('matrix row 6 — add/lighter: upper track drawn with globalCompositeOperation lighter', () => {
    const { ops, ports } = makeHarness({
      content: {
        'track-a': { kind: 'content', raster: raster('track-a') },
        'track-b': { kind: 'content', raster: raster('track-b') },
      },
    });
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1, blendMode: 'add' }),
    ]);

    compositeFrame(doc, 0, SIZE, ports);

    const upper = ops.find((op): op is RecordedCanvasOp & { type: 'drawImage' } => op.type === 'drawImage' && op.source === 'track-b');
    expect(upper).toEqual({ type: 'drawImage', source: 'track-b', args: [0, 0], globalAlpha: 1, globalCompositeOperation: 'lighter' });
  });

  it('matrix row 7 — hidden upper track: no draw op for the upper track', () => {
    const { ops, ports } = makeHarness({
      content: {
        'track-a': { kind: 'content', raster: raster('track-a') },
        'track-b': { kind: 'content', raster: raster('track-b') },
      },
    });
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1, visible: false }),
    ]);

    const result = compositeFrame(doc, 0, SIZE, ports);

    const draws = ops.filter((op) => op.type === 'drawImage');
    expect(draws.map((draw) => draw.source)).toEqual(['track-a']);
    expect(result.participates.trackIds).toEqual(['track-a']);
  });

  it('matrix row 8 — one soloed track: only the soloed visible track draws', () => {
    const { ops, ports } = makeHarness({
      content: {
        'track-a': { kind: 'content', raster: raster('track-a') },
        'track-b': { kind: 'content', raster: raster('track-b') },
        'track-c': { kind: 'content', raster: raster('track-c') },
      },
    });
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1, solo: true }),
      makeTrack('track-c', { order: 2 }),
    ]);

    const result = compositeFrame(doc, 0, SIZE, ports);

    const draws = ops.filter((op) => op.type === 'drawImage');
    expect(draws.map((draw) => draw.source)).toEqual(['track-b']);
    expect(result.participates.trackIds).toEqual(['track-b']);
  });

  it('matrix row 9 — multiple soloed tracks: all soloed AND visible tracks draw in stable order', () => {
    const { ops, ports } = makeHarness({
      content: {
        'track-a': { kind: 'content', raster: raster('track-a') },
        'track-b': { kind: 'content', raster: raster('track-b') },
        'track-c': { kind: 'content', raster: raster('track-c') },
      },
    });
    const doc = makeDocument([
      makeTrack('track-a', { order: 0, solo: true }),
      makeTrack('track-b', { order: 1 }),
      makeTrack('track-c', { order: 2, solo: true }),
    ]);

    const result = compositeFrame(doc, 0, SIZE, ports);

    const draws = ops.filter((op) => op.type === 'drawImage');
    expect(draws.map((draw) => draw.source)).toEqual(['track-a', 'track-c']);
    expect(result.participates.trackIds).toEqual(['track-a', 'track-c']);
  });

  it('matrix row 10 — hidden-and-soloed precedence: hide wins (no draw) AND the hidden solo never arms solo mode', () => {
    const { ops, ports } = makeHarness({
      content: {
        'track-a': { kind: 'content', raster: raster('track-a') },
        'track-b': { kind: 'content', raster: raster('track-b') },
      },
    });
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1, visible: false, solo: true }),
    ]);

    const result = compositeFrame(doc, 0, SIZE, ports);

    // track-b hidden → never draws (hide wins over solo); its solo flag does not
    // arm solo mode (edge CMP-02 adjacency), so track-a stays visible.
    const draws = ops.filter((op) => op.type === 'drawImage');
    expect(draws.map((draw) => draw.source)).toEqual(['track-a']);
    expect(result.participates.trackIds).toEqual(['track-a']);
  });

  it('matrix row 11 — empty upper frame over lower content: upper contributes zero draw ops (transparent content miss), lower still draws', () => {
    const { ops, ports } = makeHarness({
      content: {
        'track-a': { kind: 'content', raster: raster('track-a') },
        // Empty frame = content miss → transparent (D-10: no real/generated/
        // Hold/cached content at this frame resolves 'missing'); the lower
        // track is NOT removed.
        'track-b': { kind: 'missing', missingRefs: Object.freeze([]) },
      },
    });
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1 }),
    ]);

    const result = compositeFrame(doc, 0, SIZE, ports);

    const draws = ops.filter((op) => op.type === 'drawImage');
    expect(draws.map((draw) => draw.source)).toEqual(['track-a']);
    expect(result.missing).toEqual([{ trackId: 'track-b', frame: 0, missingRefs: [] }]);
  });
});

// ---------------------------------------------------------------------------
// SPECS rows 13-15: Background loops, finite/infinite repeats, gaps, interruption
// ---------------------------------------------------------------------------

describe('pixel acceptance matrix — Background loop/gap rows (SPECS rows 13-15)', () => {
  it('matrix row 12 — one-image Background loop: the SAME source draws on every frame of the cycle', () => {
    const clip = makeClip({
      id: 'bg-1',
      startFrame: 0,
      sourceFrameRefs: Object.freeze(['single']),
      repeat: { mode: 'infinite' },
      sourceKind: 'imported-background',
      revision: 1,
    });
    const background = makeBackground([clip]);
    const context = deriveEfxPaintBackgroundResolution(background, 12);
    const known = new Set(['single']);
    const resolutions = new Map<number, EfxPaintBackgroundFrameResolution>();
    for (let frame = 0; frame < 12; frame += 1) {
      resolutions.set(frame, resolveEfxPaintBackgroundFrame(context, frame, known));
    }
    const { ops, ports } = makeHarness({
      backgroundResolutions: resolutions,
      backgroundSourceImages: { single: raster('bg-single') },
    });
    const doc = makeDocument([], { clips: background.clips });

    for (let frame = 0; frame < 12; frame += 1) compositeFrame(doc, frame, SIZE, ports);

    const bgDraws = ops.filter((op) => op.type === 'drawImage');
    expect(bgDraws).toHaveLength(12);
    for (const draw of bgDraws) expect(draw.source).toBe('bg-single');
  });

  it('matrix row 13 — multi-image Background loop: source refs cycle by modulo', () => {
    const clip = makeClip({
      id: 'bg-1',
      startFrame: 0,
      sourceFrameRefs: Object.freeze(['r0', 'r1', 'r2']),
      repeat: { mode: 'infinite' },
      sourceKind: 'imported-background',
      revision: 1,
    });
    const background = makeBackground([clip]);
    const context = deriveEfxPaintBackgroundResolution(background, 8);
    const known = new Set(['r0', 'r1', 'r2']);
    const resolutions = new Map<number, EfxPaintBackgroundFrameResolution>();
    for (let frame = 0; frame < 8; frame += 1) {
      resolutions.set(frame, resolveEfxPaintBackgroundFrame(context, frame, known));
    }
    const { ops, ports } = makeHarness({
      backgroundResolutions: resolutions,
      backgroundSourceImages: {
        r0: raster('bg-r0'),
        r1: raster('bg-r1'),
        r2: raster('bg-r2'),
      },
    });
    const doc = makeDocument([], { clips: background.clips });

    for (let frame = 0; frame < 8; frame += 1) compositeFrame(doc, frame, SIZE, ports);

    const bgDraws = ops.filter((op) => op.type === 'drawImage');
    expect(bgDraws).toHaveLength(8);
    for (let i = 0; i < 8; i += 1) expect(bgDraws[i].source).toBe(`bg-r${i % 3}`);
  });

  it('matrix row 14 — finite repeat stops at cycleLength × count, gap reveals the fallback after', () => {
    const clip = makeClip({
      id: 'bg-1',
      startFrame: 0,
      sourceFrameRefs: Object.freeze(['a', 'b']),
      repeat: { mode: 'finite', count: 2 }, // cycleLength 2 × count 2 → [0, 4)
      sourceKind: 'imported-background',
      revision: 1,
    });
    const background = makeBackground([clip]);
    const context = deriveEfxPaintBackgroundResolution(background, 10);
    const known = new Set(['a', 'b']);
    const resolutions = new Map<number, EfxPaintBackgroundFrameResolution>();
    for (let frame = 0; frame < 6; frame += 1) {
      resolutions.set(frame, resolveEfxPaintBackgroundFrame(context, frame, known));
    }
    const { ops, ports } = makeHarness({
      backgroundResolutions: resolutions,
      backgroundSourceImages: { a: raster('bg-a'), b: raster('bg-b') },
    });
    const doc = makeDocument([], { clips: background.clips });

    const runs = collectDrawSources(ops, doc, [0, 1, 2, 3, 4, 5], ports, SIZE);

    // [0,4) cycles a,b,a,b; frames 4 and 5 resolve gap → fallback only, no bg draw.
    expect(runs).toEqual(['bg-a', 'bg-b', 'bg-a', 'bg-b', null, null]);
  });

  it('matrix row 15 — infinite repeat bounded by capacity: content inside [0, capacity), gap at the parent end', () => {
    const clip = makeClip({
      id: 'bg-1',
      startFrame: 0,
      sourceFrameRefs: Object.freeze(['s0', 's1', 's2', 's3']),
      repeat: { mode: 'infinite' },
      sourceKind: 'imported-background',
      revision: 1,
    });
    const background = makeBackground([clip]);
    const context = deriveEfxPaintBackgroundResolution(background, 20);
    const known = new Set(['s0', 's1', 's2', 's3']);
    const resolutions = new Map<number, EfxPaintBackgroundFrameResolution>([
      [0, resolveEfxPaintBackgroundFrame(context, 0, known)],
      [19, resolveEfxPaintBackgroundFrame(context, 19, known)],
      [20, resolveEfxPaintBackgroundFrame(context, 20, known)],
    ]);
    expect(resolutions.get(20)).toEqual({ kind: 'gap' });
    const { ops, ports } = makeHarness({
      backgroundResolutions: resolutions,
      backgroundSourceImages: {
        s0: raster('bg-s0'),
        s1: raster('bg-s1'),
        s2: raster('bg-s2'),
        s3: raster('bg-s3'),
      },
    });
    const doc = makeDocument([], { clips: background.clips });

    compositeFrame(doc, 0, SIZE, ports); // 0 % 4 = 0 → s0
    compositeFrame(doc, 19, SIZE, ports); // 19 % 4 = 3 → s3
    compositeFrame(doc, 20, SIZE, ports); // gap → no bg draw

    const bgDraws = ops.filter((op) => op.type === 'drawImage');
    expect(bgDraws).toHaveLength(2);
    expect(bgDraws[0].source).toBe('bg-s0');
    expect(bgDraws[1].source).toBe('bg-s3');
  });

  it('matrix row 16 — Background gap over solid fallback: fallback fill op, no background draw', () => {
    const { ops, ports } = makeHarness({ background: 'gap' });
    const doc = makeDocument([], { fallback: { mode: 'solid', color: '#334455' } });

    compositeFrame(doc, 0, SIZE, ports);

    const fills = ops.filter((op) => op.type === 'fillRect');
    expect(fills).toEqual([{
      type: 'fillRect',
      x: 0,
      y: 0,
      w: 4,
      h: 3,
      fillStyle: '#334455',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
    }]);
    const draws = ops.filter((op) => op.type === 'drawImage');
    expect(draws).toHaveLength(0);
  });

  it('matrix row 17 — Background gap over transparent fallback: clearRect only, no background draw', () => {
    const { ops, ports } = makeHarness({ background: 'gap' });
    const doc = makeDocument([], { fallback: { mode: 'transparent' } });

    compositeFrame(doc, 0, SIZE, ports);

    expect(ops).toEqual([{ type: 'clearRect', w: 4, h: 3 }]);
  });

  it('matrix row 18 — next clip interrupting AFTER a full cycle: half-open no-overlap, no frame draws two clips', () => {
    const c1 = makeClip({
      id: 'c1',
      startFrame: 0,
      sourceFrameRefs: Object.freeze(['a', 'b']),
      repeat: { mode: 'finite', count: 2 }, // full cycles on [0, 4)
      sourceKind: 'imported-background',
      revision: 1,
    });
    const c2 = makeClip({
      id: 'c2',
      startFrame: 4, // begins exactly where c1's full cycles end
      sourceFrameRefs: Object.freeze(['x']),
      repeat: { mode: 'finite', count: 1 },
      sourceKind: 'imported-background',
      revision: 1,
    });
    const background = makeBackground([c1, c2]);
    const context = deriveEfxPaintBackgroundResolution(background, 10);
    const known = new Set(['a', 'b', 'x']);
    const resolutions = new Map<number, EfxPaintBackgroundFrameResolution>();
    for (let frame = 0; frame < 6; frame += 1) {
      resolutions.set(frame, resolveEfxPaintBackgroundFrame(context, frame, known));
    }
    const { ops, ports } = makeHarness({
      backgroundResolutions: resolutions,
      backgroundSourceImages: { a: raster('bg-a'), b: raster('bg-b'), x: raster('bg-x') },
    });
    const doc = makeDocument([], { clips: background.clips });

    const runs = collectDrawSources(ops, doc, [0, 1, 2, 3, 4, 5], ports, SIZE);

    // c1 owns [0,4) (two full 2-frame cycles); frame 4 is c2's first frame;
    // frame 5 is a gap. Each frame drew at most ONE raster → half-open, no overlap.
    expect(runs).toEqual(['bg-a', 'bg-b', 'bg-a', 'bg-b', 'bg-x', null]);
  });

  it('matrix row 19 — next clip interrupting a PARTIAL cycle: half-open no-overlap, no frame draws two clips', () => {
    const c1 = makeClip({
      id: 'c1',
      startFrame: 0,
      sourceFrameRefs: Object.freeze(['s0', 's1', 's2', 's3']),
      repeat: { mode: 'infinite' },
      sourceKind: 'imported-background',
      revision: 1,
    });
    const c2 = makeClip({
      id: 'c2',
      startFrame: 6, // interrupts c1 mid-cycle (6 frames = 1.5 cycles of 4)
      sourceFrameRefs: Object.freeze(['t0', 't1', 't2', 't3']),
      repeat: { mode: 'infinite' },
      sourceKind: 'imported-background',
      revision: 1,
    });
    const background = makeBackground([c1, c2]);
    const context = deriveEfxPaintBackgroundResolution(background, 40);
    const known = new Set(['s0', 's1', 's2', 's3', 't0', 't1', 't2', 't3']);
    const resolutions = new Map<number, EfxPaintBackgroundFrameResolution>();
    for (let frame = 0; frame < 10; frame += 1) {
      resolutions.set(frame, resolveEfxPaintBackgroundFrame(context, frame, known));
    }
    const { ops, ports } = makeHarness({
      backgroundResolutions: resolutions,
      backgroundSourceImages: {
        s0: raster('bg-s0'),
        s1: raster('bg-s1'),
        s2: raster('bg-s2'),
        s3: raster('bg-s3'),
        t0: raster('bg-t0'),
        t1: raster('bg-t1'),
        t2: raster('bg-t2'),
        t3: raster('bg-t3'),
      },
    });
    const doc = makeDocument([], { clips: background.clips });

    const runs = collectDrawSources(ops, doc, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], ports, SIZE);

    // c1 owns [0,6) mapped by modulo (s0,s1,s2,s3,s0,s1) — a partial final cycle;
    // c2 owns [6, ...). Every frame drew at most ONE raster → half-open, no overlap.
    expect(runs).toEqual(['bg-s0', 'bg-s1', 'bg-s2', 'bg-s3', 'bg-s0', 'bg-s1', 'bg-t0', 'bg-t1', 'bg-t2', 'bg-t3']);
  });
});

// ---------------------------------------------------------------------------
// SPECS row 16 + D-02: parent boundary (previewRenderer seam) and straight alpha
// ---------------------------------------------------------------------------

vi.mock('../../stores/paintStore', () => ({
  paintStore: { getFrame: vi.fn(() => null) },
}));

vi.mock('../../stores/projectStore', () => ({
  projectStore: {
    width: { peek: () => 4, value: 4 },
    height: { peek: () => 3, value: 3 },
  },
}));

import type { Layer } from '../../types/layer';
import { defaultTransform } from '../../types/layer';
import { physicPaintStore, _setPhysicPaintMarkDirtyCallback } from '../../stores/physicPaintStore';
import { registerDocument, reset as resetEfxPaintStore } from '../../stores/efxPaintStore';
import { clearProjectPaperRasterCache } from '../../lib/projectPaperRaster';
import { buildPhysicPaintRotoPhysicalRevision } from '../../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import { PreviewRenderer, blendModeToCompositeOp } from '../../lib/previewRenderer';

// 46-01: runtime state is per-track; the harness exercises the ACTIVE track.
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

function seedPhysicalRoto(keys: Array<{ keyId: string; appFrame: number; dataUrl: string }>): void {
  const records = keys.map((key) => ({
    keyId: key.keyId,
    appFrame: key.appFrame,
    kind: 'real-key' as const,
    payload: { frameIndex: 0, appFrame: key.appFrame, dataUrl: key.dataUrl },
  }));
  const interpolation = { enabled: false, mode: 'duplicate' as const };
  const result = physicPaintStore.replaceRotoPhysicalDocument('roto-layer', TEST_TRACK_ID, {
    capacity: 600,
    realKeyRecords: records,
    interpolation,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 0,
    revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, []),
  });
  if (!result.ok) throw new Error(result.error);
}

describe('pixel acceptance matrix — parent boundary and straight alpha (SPECS row 16 + D-02)', () => {
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

  it('matrix row 20 — parent 50% × internal 50% = 25% effective exactly once at the previewRenderer seam (CMP-03)', () => {
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
    // Exactly ONE parent draw at the parent alpha — never a second pass at 0.25.
    expect(ctx.operations).not.toContainEqual(expect.objectContaining({ type: 'drawImage', source: FLAT_1, globalAlpha: 0.25 }));
  });

  it('matrix row 21 — straight-alpha contract: no manual premultiply step and the result record documents straight alpha (D-02, structural half)', () => {
    const source = readSource('src/efx-paint/compositor/efxPaintCompositor.ts');
    // D-02: the flattened boundary raster is STRAIGHT (unmultiplied) alpha.
    expect(source).toContain('straight');
    // No manual premultiply and no per-pixel alpha math anywhere in the pipeline
    // (the 50%-white-never-dark-gray pixel check itself is native UAT).
    expect(source).not.toContain('premultiply');
    expect(source).not.toMatch(/getImageData|putImageData/);
    // The alpha boundary is applied through the Canvas 2D draw-state only:
    // save → globalAlpha → compositeOp → drawImage → restore.
    expect(source).toMatch(/ctx\.save\(\)/);
    expect(source).toMatch(/ctx\.drawImage\(/);
    expect(source).toMatch(/ctx\.restore\(\)/);
  });
});

const FLAT_1 = 'data:image/png;base64,ZmxhdC0x';
let offscreenOperations: RecordedCanvasOp[] = [];
