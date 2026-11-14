// @vitest-environment node
// ============================================================
//  62 code review CR-01 — the copy seam must carry `vectorDrawn`.
//
//  Duplicate and +Key re-record a source key's aquarelle timeline on a
//  destination frame through `aquarelleStrokeFromScriptEvent` (61-24,
//  shared by `copyAquarelleScriptToFrame` and the rail-key script copy).
//  62-UAT added the drawn-by-the-vector-pen provenance; this projection
//  was not taught to carry it, so a duplicated drawn path reclassified
//  as "<Tool>-Vector" and lost codec flag bit 4 on persist. Same defect
//  class the curveMode pin (physicsPaintRotoDuplicateScript.curveMode)
//  already covers.
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

function sourceEvent(drawn: boolean) {
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
    ...(drawn ? { vectorDrawn: true as const } : {}),
  });
}

describe('62 CR-01 — a copied drawn path keeps its vector provenance', () => {
  it('carries vectorDrawn onto the re-recorded stroke', () => {
    const projected = aquarelleStrokeFromScriptEvent(sourceEvent(true), 9);

    expect(projected.vectorDrawn).toBe(true);
    expect(projected.anchors).toEqual(ANCHORS);
  });

  it('keeps an absent marker absent for a converted painted path', () => {
    const projected = aquarelleStrokeFromScriptEvent(sourceEvent(false), 9);

    expect('vectorDrawn' in projected).toBe(false);
  });
});
