// @vitest-environment node
// ============================================================
//  Quick 261123-kpy — the copy seam must carry the relief POLARITY.
//
//  Duplicate and +Key re-record a source key's aquarelle timeline on a
//  destination frame through `aquarelleStrokeFromScriptEvent` (61-24,
//  shared by `copyAquarelleScriptToFrame` and the rail-key script copy).
//  The modifier polarity is part of the timeline, not of the pixels: a
//  copy must stay an erode/deposit stroke (and keep its AQTL flag bit on
//  persist), while an absent marker stays absent so a hand-painted event
//  keeps its exact key set.
// ============================================================

import { describe, expect, it } from 'vitest';
import { toStudioStroke, type AquarellePoint } from '@efxlab/efx-watercolor/payload';
import { aquarelleStrokeFromScriptEvent } from './physicsPaintRotoDuplicateScript';

/** Codec-exact sample fields (same fixture shape as the 61-24 suites). */
function point(x: number, y: number, p: number): AquarellePoint {
  return { x, y, p, tx: 10, ty: -10, tw: 5 };
}

function sourceEvent(relief?: 'erode' | 'deposit') {
  return toStudioStroke({
    tool: 'brush',
    color: '#103c65',
    params: { size: 12, water: 30, emboss: 15 },
    brushId: 'round',
    points: [point(0, 0, -1), point(1, 1, 1)],
    mutationId: 41,
    timestamp: 41,
    playFrame: 601,
    ...(relief !== undefined ? { relief } : {}),
  });
}

describe('quick 261123-kpy — a copied modifier stroke keeps its polarity', () => {
  it('carries each polarity onto the re-recorded stroke', () => {
    for (const relief of ['erode', 'deposit'] as const) {
      const projected = aquarelleStrokeFromScriptEvent(sourceEvent(relief), 9);
      expect(projected.relief, `relief ${relief}`).toBe(relief);
    }
  });

  it('keeps an absent marker absent for an ordinary stroke', () => {
    const projected = aquarelleStrokeFromScriptEvent(sourceEvent(), 9);

    expect('relief' in projected).toBe(false);
  });
});
