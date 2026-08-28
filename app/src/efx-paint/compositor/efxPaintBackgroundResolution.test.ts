/**
 * Background-resolution adapter contract tests (Phase 48-02, D-03).
 *
 * CMP-06 unit gates: the document `FrameLoopClip` records map into the
 * existing Loop Clip resolver's derivation input through the pure adapter
 * (`deriveEfxPaintBackgroundResolution`), and per-frame queries return
 * content / gap / missing exactly per the spec's loop rules. The modulo /
 * repeat / interruption math is NEVER re-implemented here — the resolver
 * (`physicsPaintRotoPhysicalResolver.ts`) is the single effective-duration
 * authority (Pitfall 10); these tests observe its derivation + per-frame
 * resolution through the adapter's mapped input.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createEfxPaintDocument } from '../document/efxPaintDocument';
import type { BackgroundTrack, FrameLoopClip } from '../document/efxPaintDocument';
import { deriveEfxPaintBackgroundResolution, resolveEfxPaintBackgroundFrame } from './efxPaintBackgroundResolution';

const root = resolve(__dirname, '../../..'); // app/
const readSource = (path: string) => readFileSync(resolve(root, path), 'utf8');

function makeClip(overrides: Partial<FrameLoopClip> = {}): FrameLoopClip {
  return {
    id: 'c1',
    startFrame: 0,
    sourceFrameRefs: Object.freeze(['s1']),
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

describe('deriveEfxPaintBackgroundResolution — FrameLoopClip → resolver input (D-03, CMP-06)', () => {
  it('maps a finite document FrameLoopClip to a resolver clip verbatim (loopId/placementStart/sourceKeyIds/repeat/mode)', () => {
    const clip = makeClip({
      id: 'c1',
      startFrame: 15,
      sourceFrameRefs: Object.freeze(['s1', 's2', 's3']),
      repeat: { mode: 'finite', count: 2 },
      sourceKind: 'imported-background',
      revision: 7,
    });
    const context = deriveEfxPaintBackgroundResolution(makeBackground([clip]), 40);
    expect(context.ranges).toHaveLength(1);
    expect(context.ranges[0]).toMatchObject({
      loopId: 'c1',
      placementStart: 15,
      sourceKeyIds: ['s1', 's2', 's3'],
      repeat: 2,
    });
    // mode ← 'progressive' (the resolver's static/progressive distinction is
    // a Hold/PlayScript concern, not a Background one).
    const source = readSource('src/efx-paint/compositor/efxPaintBackgroundResolution.ts');
    expect(source).toContain("mode: 'progressive'");
  });

  it('maps an infinite document FrameLoopClip to repeat "infinity"', () => {
    const clip = makeClip({
      id: 'c1',
      startFrame: 0,
      sourceFrameRefs: Object.freeze(['s1', 's2']),
      repeat: { mode: 'infinite' },
    });
    const context = deriveEfxPaintBackgroundResolution(makeBackground([clip]), 40);
    expect(context.ranges[0].repeat).toBe('infinity');
  });

  it('yields one synthetic identity per sourceFrameRef at { keyId: ref, appFrame: startFrame + index }', () => {
    const clip = makeClip({
      id: 'c1',
      startFrame: 15,
      sourceFrameRefs: Object.freeze(['s1', 's2', 's3']),
      repeat: { mode: 'finite', count: 2 },
    });
    const context = deriveEfxPaintBackgroundResolution(makeBackground([clip]), 40);
    // keyIdByAppFrame is the resolver's real-key lookup index — it exposes
    // exactly the synthetic identity placement the adapter built.
    expect(context.keyIdByAppFrame.get(15)).toBe('s1');
    expect(context.keyIdByAppFrame.get(16)).toBe('s2');
    expect(context.keyIdByAppFrame.get(17)).toBe('s3');
    expect(context.keyIdByAppFrame.size).toBe(3);
  });

  it('is identity-memoized: same background record → same context; a changed clip revision re-derives', () => {
    const background = makeBackground([
      makeClip({
        id: 'c1',
        sourceFrameRefs: Object.freeze(['s1', 's2']),
        repeat: { mode: 'finite', count: 2 },
        revision: 7,
      }),
    ]);
    const first = deriveEfxPaintBackgroundResolution(background, 40);
    const second = deriveEfxPaintBackgroundResolution(background, 40);
    expect(second).toBe(first);

    const changed = makeBackground([
      makeClip({
        id: 'c1',
        sourceFrameRefs: Object.freeze(['s1', 's2']),
        repeat: { mode: 'finite', count: 2 },
        revision: 8,
      }),
    ]);
    const rederived = deriveEfxPaintBackgroundResolution(changed, 40);
    expect(rederived).not.toBe(first);
  });

  it('fails closed on malformed clips at derivation time — never silently clamped (Pitfall P-48-2)', () => {
    const emptyRefs = makeBackground([makeClip({ sourceFrameRefs: Object.freeze([]) })]);
    expect(() => deriveEfxPaintBackgroundResolution(emptyRefs, 40)).toThrow(
      /loopClips must be valid Loop Clip records/,
    );

    const negativeStart = makeBackground([
      makeClip({ startFrame: -5, sourceFrameRefs: Object.freeze(['s1']) }),
    ]);
    expect(() => deriveEfxPaintBackgroundResolution(negativeStart, 40)).toThrow();

    const zeroRepeat = makeBackground([
      makeClip({ sourceFrameRefs: Object.freeze(['s1']), repeat: { mode: 'finite', count: 0 } }),
    ]);
    expect(() => deriveEfxPaintBackgroundResolution(zeroRepeat, 40)).toThrow();
  });
});

describe('resolveEfxPaintBackgroundFrame — content / gap / missing per the spec loop rules (CMP-06)', () => {
  it('spec Required example part 1: 5-image cycle × 3 from frame 0 resolves [0,15), gap at 15', () => {
    const c1 = makeClip({
      id: 'c1',
      startFrame: 0,
      sourceFrameRefs: Object.freeze(['s0', 's1', 's2', 's3', 's4']),
      repeat: { mode: 'finite', count: 3 },
    });
    const context = deriveEfxPaintBackgroundResolution(makeBackground([c1]), 60);
    const known = new Set(['s0', 's1', 's2', 's3', 's4']);
    for (let frame = 0; frame < 15; frame += 1) {
      const res = resolveEfxPaintBackgroundFrame(context, frame, known);
      expect(res.kind).toBe('content');
      if (res.kind === 'content') {
        expect(res.clipId).toBe('c1');
        expect(res.sourceRef).toBe(`s${frame % 5}`);
      }
    }
    expect(resolveEfxPaintBackgroundFrame(context, 15, known)).toEqual({ kind: 'gap' });
  });

  it('spec Required example part 2: 10-image cycle × 2 from frame 15 resolves [15,35), gap at 35 (fallback shows)', () => {
    const c1 = makeClip({
      id: 'c1',
      startFrame: 0,
      sourceFrameRefs: Object.freeze(['s0', 's1', 's2', 's3', 's4']),
      repeat: { mode: 'finite', count: 3 },
    });
    const c2 = makeClip({
      id: 'c2',
      startFrame: 15,
      sourceFrameRefs: Object.freeze(['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9']),
      repeat: { mode: 'finite', count: 2 },
    });
    const context = deriveEfxPaintBackgroundResolution(makeBackground([c1, c2]), 60);
    const known = new Set([
      's0', 's1', 's2', 's3', 's4',
      't0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9',
    ]);
    for (let frame = 15; frame < 35; frame += 1) {
      const res = resolveEfxPaintBackgroundFrame(context, frame, known);
      expect(res.kind).toBe('content');
      if (res.kind === 'content') {
        expect(res.clipId).toBe('c2');
        expect(res.sourceRef).toBe(`t${(frame - 15) % 10}`);
      }
    }
    expect(resolveEfxPaintBackgroundFrame(context, 35, known)).toEqual({ kind: 'gap' });
  });

  it('interruption without overlap: c1 ∞ 4 refs interrupted at 6 → [0,6) is c1 partial cycle by modulo, 6+ is c2; no frame resolves both (half-open ranges)', () => {
    const c1 = makeClip({
      id: 'c1',
      startFrame: 0,
      sourceFrameRefs: Object.freeze(['s0', 's1', 's2', 's3']),
      repeat: { mode: 'infinite' },
    });
    const c2 = makeClip({
      id: 'c2',
      startFrame: 6,
      sourceFrameRefs: Object.freeze(['t0', 't1', 't2', 't3']),
      repeat: { mode: 'infinite' },
    });
    const context = deriveEfxPaintBackgroundResolution(makeBackground([c1, c2]), 40);
    const known = new Set(['s0', 's1', 's2', 's3', 't0', 't1', 't2', 't3']);
    for (let frame = 0; frame < 6; frame += 1) {
      const res = resolveEfxPaintBackgroundFrame(context, frame, known);
      expect(res.kind).toBe('content');
      if (res.kind === 'content') {
        expect(res.clipId).toBe('c1');
        // 6 frames = 1.5 cycles of 4 — source mapping by modulo (edge CMP-01
        // adjacency: c1 owns [0,6), c2 owns [6, ...)).
        expect(res.sourceRef).toBe(`s${frame % 4}`);
      }
    }
    for (let frame = 6; frame < 40; frame += 1) {
      const res = resolveEfxPaintBackgroundFrame(context, frame, known);
      expect(res.kind).toBe('content');
      if (res.kind === 'content') expect(res.clipId).toBe('c2');
    }
  });

  it('finite gap: c1 2 refs finite 1, c2 start 10 → frames 2-9 resolve gap with no clipId', () => {
    const c1 = makeClip({
      id: 'c1',
      startFrame: 0,
      sourceFrameRefs: Object.freeze(['s0', 's1']),
      repeat: { mode: 'finite', count: 1 },
    });
    const c2 = makeClip({
      id: 'c2',
      startFrame: 10,
      sourceFrameRefs: Object.freeze(['t0']),
      repeat: { mode: 'finite', count: 1 },
    });
    const context = deriveEfxPaintBackgroundResolution(makeBackground([c1, c2]), 40);
    const known = new Set(['s0', 's1', 't0']);
    for (let frame = 2; frame < 10; frame += 1) {
      expect(resolveEfxPaintBackgroundFrame(context, frame, known)).toEqual({ kind: 'gap' });
    }
    expect(resolveEfxPaintBackgroundFrame(context, 0, known)).toEqual({ kind: 'content', clipId: 'c1', sourceRef: 's0' });
    expect(resolveEfxPaintBackgroundFrame(context, 10, known)).toEqual({ kind: 'content', clipId: 'c2', sourceRef: 't0' });
  });

  it('requested repeat preserved while shortened: c1 4 refs finite 5 interrupted at 6 keeps repeat 5; range truncated/partialCycle', () => {
    const c1 = makeClip({
      id: 'c1',
      startFrame: 0,
      sourceFrameRefs: Object.freeze(['s0', 's1', 's2', 's3']),
      repeat: { mode: 'finite', count: 5 },
    });
    const c2 = makeClip({
      id: 'c2',
      startFrame: 6,
      sourceFrameRefs: Object.freeze(['t0']),
      repeat: { mode: 'finite', count: 1 },
    });
    const background = makeBackground([c1, c2]);
    const context = deriveEfxPaintBackgroundResolution(background, 40);
    const c1Range = context.ranges.find((range) => range.loopId === 'c1');
    expect(c1Range).toBeDefined();
    expect(c1Range!.repeat).toBe(5); // requested repeat survives the interruption
    expect(c1Range!.effectiveEnd).toBe(6);
    expect(c1Range!.truncated).toBe(true); // effective end < requested natural end (20)
    expect(c1Range!.partialCycle).toBe(true); // 6 frames is not a whole 4-frame cycle
    // The adapter never rewrites the document clip — the stored repeat stays.
    expect(c1.repeat).toEqual({ mode: 'finite', count: 5 });
  });

  it('missing refs: a clip whose sourceFrameRefs are absent from knownSources resolves { kind: missing, missingRefs } — never throws (D-31 → D-09)', () => {
    const c1 = makeClip({
      id: 'c1',
      startFrame: 0,
      sourceFrameRefs: Object.freeze(['s0', 's1']),
      repeat: { mode: 'finite', count: 1 },
    });
    const context = deriveEfxPaintBackgroundResolution(makeBackground([c1]), 40);
    // knownSources omits the clip refs entirely — the fail-closed oracle.
    const emptyKnown = new Set<string>();
    const res = resolveEfxPaintBackgroundFrame(context, 1, emptyKnown);
    expect(res).toEqual({ kind: 'missing', clipId: 'c1', missingRefs: ['s1'] });
    // A known ref still resolves content for comparison.
    expect(resolveEfxPaintBackgroundFrame(context, 0, new Set(['s0']))).toEqual({
      kind: 'content',
      clipId: 'c1',
      sourceRef: 's0',
    });
  });

  it('is visibility-agnostic — resolveEfxPaintBackgroundFrame never reads the Background visible flag (48-04 concern)', () => {
    const clip = makeClip({
      id: 'c1',
      startFrame: 0,
      sourceFrameRefs: Object.freeze(['s0']),
      repeat: { mode: 'infinite' },
    });
    const hidden = makeBackground([clip], { visible: false });
    const context = deriveEfxPaintBackgroundResolution(hidden, 20);
    // The query path resolves content even for a hidden background — whether
    // the Background participates is decided by the compositor (48-04).
    expect(resolveEfxPaintBackgroundFrame(context, 3, new Set(['s0']))).toEqual({
      kind: 'content',
      clipId: 'c1',
      sourceRef: 's0',
    });
  });

  it('capacity bound: an infinite clip with capacity 20 resolves content on [0,20), gap from 20 (parent end)', () => {
    const c1 = makeClip({
      id: 'c1',
      startFrame: 0,
      sourceFrameRefs: Object.freeze(['s0', 's1', 's2', 's3']),
      repeat: { mode: 'infinite' },
    });
    const context = deriveEfxPaintBackgroundResolution(makeBackground([c1]), 20);
    const known = new Set(['s0', 's1', 's2', 's3']);
    for (let frame = 0; frame < 20; frame += 1) {
      expect(resolveEfxPaintBackgroundFrame(context, frame, known).kind).toBe('content');
    }
    expect(resolveEfxPaintBackgroundFrame(context, 20, known)).toEqual({ kind: 'gap' });
    expect(resolveEfxPaintBackgroundFrame(context, 35, known)).toEqual({ kind: 'gap' });
  });
});
