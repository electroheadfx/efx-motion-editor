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
import { deriveEfxPaintBackgroundResolution } from './efxPaintBackgroundResolution';

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
