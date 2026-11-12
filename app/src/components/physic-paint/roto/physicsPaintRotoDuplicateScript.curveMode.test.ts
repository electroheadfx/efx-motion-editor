// @vitest-environment node
// ============================================================
//  Nyquist audit 2026-11-11 — VEC-06 / VEC-02 (G-20 copy seam)
//
//  Duplicate and +Key re-record a source key's aquarelle timeline on
//  a destination frame through `aquarelleStrokeFromScriptEvent`
//  (61-24, shared by `copyAquarelleScriptToFrame` and the rail-key
//  script copy). 61-24 taught the projection to carry `anchors` and
//  `renderMode`; 61-30 later added the per-stroke `curveMode`
//  discriminator, and this projection was never taught to carry it.
//
//  A spline stroke copied through this seam is re-recorded with no
//  mode, so the copy draws and edits as Bézier — the vector path
//  survives but its evaluation mode does not.
// ============================================================

import { describe, expect, it } from 'vitest';
import {
  toStudioStroke,
  type AquarelleAnchor,
  type AquarellePoint,
} from '@efxlab/efx-watercolor/payload';
import { aquarelleStrokeFromScriptEvent } from './physicsPaintRotoDuplicateScript';

/** Codec-exact sample fields (same fixture shape as the 61-24 suites). */
function point(x: number, y: number, p: number): AquarellePoint {
  return { x, y, p, tx: 10, ty: -10, tw: 5 };
}

const ANCHORS: readonly AquarelleAnchor[] = [
  { x: 0.25, y: 0.5, kind: 'auto' },
  { x: 0.75, y: 0.125, kind: 'bezier', in: { x: 0.5, y: 0.5 }, out: { x: 1, y: 0 } },
];

function sourceEvent(mode?: 'spline') {
  return toStudioStroke({
    tool: 'brush',
    color: '#103c65',
    params: { size: 12, water: 30 },
    brushId: 'round',
    points: [point(0, 0, -1), point(1, 1, 1)],
    mutationId: 41,
    timestamp: 41,
    playFrame: 601,
    anchors: ANCHORS,
    ...(mode === undefined ? {} : { curveMode: mode }),
  });
}

describe('Nyquist 2026-11-11 VEC-06 — a copied spline stroke keeps its mode', () => {
  it('carries a spline mode onto the re-recorded stroke', () => {
    const projected = aquarelleStrokeFromScriptEvent(sourceEvent('spline'), 9);

    expect(projected.curveMode).toBe('spline');
    expect(projected.anchors).toEqual(ANCHORS);
  });

  it('keeps an absent mode absent when the source is Bézier', () => {
    const projected = aquarelleStrokeFromScriptEvent(sourceEvent(), 9);

    expect('curveMode' in projected).toBe(false);
  });
});
