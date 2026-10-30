import { describe, expect, it } from 'vitest';
import { toStudioStroke, type AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import { sliceRailKeyScripts, type RailKeyScriptAnchor } from './physicsPaintRotoRailKeyScripts';

/** A runtime stroke with a distinctive payload so projections are checkable. */
function runtimeStroke(label: string, overrides: Partial<AquarelleStroke> = {}): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#103c65',
    params: { size: 12, opacity: 0.8 },
    brushId: `tip-${label}`,
    points: [
      { x: 1, y: 2, p: 0.5, tx: 0, ty: 0, tw: 0 },
      { x: 3, y: 4, p: 0.6, tx: 1, ty: 1, tw: 0.2 },
    ],
    toolOverrides: {
      tip: 1.5,
      aspect: 1,
      rotation: 0,
      sizeCurve: 1,
      scatter: 1,
      capacity: 1,
      grain: 1,
      wetRound: 1,
    },
    mutationId: 900,
    diffusionFrames: 7,
    timestamp: 1234,
    ...overrides,
  };
}

function anchor(label: string, startFrame: number, overrides: Partial<AquarelleStroke> = {}): RailKeyScriptAnchor {
  return { stroke: toStudioStroke(runtimeStroke(label, overrides)), startFrame };
}

describe('sliceRailKeyScripts', () => {
  it('static: every key receives the complete drawing, each stroke projected onto that key frame', () => {
    const anchors = [anchor('a', 0), anchor('b', 0)];
    const slices = sliceRailKeyScripts({ anchors, frames: [4, 5, 6], mode: 'static' });

    expect(slices.map((slice) => slice.slot)).toEqual([0, 1, 2]);
    expect(slices.map((slice) => slice.frame)).toEqual([4, 5, 6]);
    for (const slice of slices) {
      expect(slice.strokes).toHaveLength(2);
      expect(slice.strokes.map((stroke) => stroke.brushId)).toEqual(['tip-a', 'tip-b']);
      expect(slice.strokes.map((stroke) => stroke.playFrame)).toEqual([slice.frame, slice.frame]);
    }
  });

  it('progressive: the 5-stroke / 5-frame law makes each key cumulative — F0 the top line, F4 the whole drawing', () => {
    const anchors = [0, 1, 2, 3, 4].map((slot) => anchor(`s${slot}`, slot));
    const slices = sliceRailKeyScripts({ anchors, frames: [12, 13, 14, 15, 16], mode: 'progressive' });

    expect(slices.map((slice) => slice.frame)).toEqual([12, 13, 14, 15, 16]);
    expect(slices.map((slice) => slice.strokes.map((stroke) => stroke.brushId))).toEqual([
      ['tip-s0'],
      ['tip-s0', 'tip-s1'],
      ['tip-s0', 'tip-s1', 'tip-s2'],
      ['tip-s0', 'tip-s1', 'tip-s2', 'tip-s3'],
      ['tip-s0', 'tip-s1', 'tip-s2', 'tip-s3', 'tip-s4'],
    ]);
    // Every stroke is projected onto ITS key's frame, so a key's script
    // re-bakes to exactly the picture that frame shows.
    for (const slice of slices) {
      expect(slice.strokes.map((stroke) => stroke.playFrame)).toEqual(slice.strokes.map(() => slice.frame));
    }
  });

  it('progressive: two strokes starting on one slot both join every later slot', () => {
    const anchors = [anchor('a', 0), anchor('b', 0), anchor('c', 2)];
    const slices = sliceRailKeyScripts({ anchors, frames: [10, 11, 12], mode: 'progressive' });

    expect(slices[0]!.strokes.map((stroke) => stroke.brushId)).toEqual(['tip-a', 'tip-b']);
    expect(slices[1]!.strokes.map((stroke) => stroke.brushId)).toEqual(['tip-a', 'tip-b']);
    expect(slices[2]!.strokes.map((stroke) => stroke.brushId)).toEqual(['tip-a', 'tip-b', 'tip-c']);
    expect(slices.map((slice) => slice.strokes.map((stroke) => stroke.playFrame))).toEqual([
      [10, 10],
      [11, 11],
      [12, 12, 12],
    ]);
  });

  it('progressive: a leading gap still owns the FIRST stroke so no key is script-less', () => {
    const anchors = [anchor('a', 2), anchor('b', 3)];
    const slices = sliceRailKeyScripts({ anchors, frames: [0, 1, 2, 3], mode: 'progressive' });

    expect(slices.map((slice) => slice.strokes.map((stroke) => stroke.brushId))).toEqual([
      ['tip-a'],
      ['tip-a'],
      ['tip-a'],
      ['tip-a', 'tip-b'],
    ]);
  });

  it('progressive: out-of-range anchor indices clamp to the slot range', () => {
    const anchors = [anchor('a', 9), anchor('b', -3)];
    const slices = sliceRailKeyScripts({ anchors, frames: [0, 1, 2], mode: 'progressive' });

    // -3 clamps to slot 0, 9 clamps to the last slot, so the last key owns both.
    expect(slices[0]!.strokes.map((stroke) => stroke.brushId)).toEqual(['tip-b']);
    expect(slices[1]!.strokes.map((stroke) => stroke.brushId)).toEqual(['tip-b']);
    expect(slices[2]!.strokes.map((stroke) => stroke.brushId)).toEqual(['tip-a', 'tip-b']);
  });

  it('no anchors yields an empty result — never a fabricated script', () => {
    expect(sliceRailKeyScripts({ anchors: [], frames: [0, 1, 2], mode: 'progressive' })).toEqual([]);
    expect(sliceRailKeyScripts({ anchors: [], frames: [0], mode: 'static' })).toEqual([]);
  });

  it('projects every stroke with the engine payload intact and no source mutationId', () => {
    const source = runtimeStroke('a', { diffusionFrames: 9 });
    const slices = sliceRailKeyScripts({
      anchors: [{ stroke: toStudioStroke(source), startFrame: 0 }],
      frames: [7],
      mode: 'progressive',
    });

    const projected = slices[0]!.strokes[0]!;
    expect(projected).toEqual({
      tool: 'brush',
      color: '#103c65',
      params: { size: 12, opacity: 0.8 },
      brushId: 'tip-a',
      points: [
        { x: 1, y: 2, p: 0.5, tx: 0, ty: 0, tw: 0 },
        { x: 3, y: 4, p: 0.6, tx: 1, ty: 1, tw: 0.2 },
      ],
      toolOverrides: {
        tip: 1.5,
        aspect: 1,
        rotation: 0,
        sizeCurve: 1,
        scatter: 1,
        capacity: 1,
        grain: 1,
        wetRound: 1,
      },
      diffusionFrames: 9,
      timestamp: 1234,
      playFrame: 7,
    });
    expect('mutationId' in projected).toBe(false);
  });

  it('emits no Dry events — every entry is a stroke', () => {
    const slices = sliceRailKeyScripts({
      anchors: [anchor('a', 0), anchor('b', 1)],
      frames: [0, 1],
      mode: 'static',
    });
    for (const slice of slices) {
      for (const stroke of slice.strokes) {
        expect((stroke as { kind?: string }).kind).not.toBe('dry');
        expect(Array.isArray(stroke.points)).toBe(true);
      }
    }
  });
});
