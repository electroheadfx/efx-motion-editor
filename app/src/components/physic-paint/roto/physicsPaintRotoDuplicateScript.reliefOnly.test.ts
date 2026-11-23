// @vitest-environment node
// ============================================================
//  Quick 261123-jak — the copy seam must carry `reliefOnly`.
//
//  Duplicate and +Key re-record a source key's aquarelle timeline on a
//  destination frame through `aquarelleStrokeFromScriptEvent` (61-24,
//  shared by `copyAquarelleScriptToFrame` and the rail-key script copy).
//  The relief-only latch is part of the timeline, not of the pixels: a
//  copy must stay a relief smoother (and keep AQTL flag bit 5 on
//  persist), while an absent marker stays absent so a hand-painted
//  event keeps its exact key set.
// ============================================================

import { describe, expect, it } from 'vitest';
import { toStudioStroke, type AquarellePoint } from '@efxlab/efx-watercolor/payload';
import { aquarelleStrokeFromScriptEvent } from './physicsPaintRotoDuplicateScript';

/** Codec-exact sample fields (same fixture shape as the 61-24 suites). */
function point(x: number, y: number, p: number): AquarellePoint {
  return { x, y, p, tx: 10, ty: -10, tw: 5 };
}

function sourceEvent(reliefOnly: boolean) {
  return toStudioStroke({
    tool: 'brush',
    color: '#103c65',
    params: { size: 12, water: 30, emboss: 15 },
    brushId: 'round',
    points: [point(0, 0, -1), point(1, 1, 1)],
    mutationId: 41,
    timestamp: 41,
    playFrame: 601,
    ...(reliefOnly ? { reliefOnly: true as const } : {}),
  });
}

describe('quick 261123-jak — a copied relief-only stroke stays relief-only', () => {
  it('carries reliefOnly onto the re-recorded stroke', () => {
    const projected = aquarelleStrokeFromScriptEvent(sourceEvent(true), 9);

    expect(projected.reliefOnly).toBe(true);
  });

  it('keeps an absent marker absent for an ordinary stroke', () => {
    const projected = aquarelleStrokeFromScriptEvent(sourceEvent(false), 9);

    expect('reliefOnly' in projected).toBe(false);
  });
});
