// ============================================================
//  aquarelleRecordState.anchor.test.ts — 261027 UAT round 7.
//
//  On-disk evidence from the user's project: one snapshot carried 83
//  watercolor strokes and only 2 key anchors. The restore law seeds a
//  stroke only when its anchor equals the live key at its frame, so
//  every unanchored stroke was permanently unseedable. Strokes painted
//  on a fresh frame BEFORE its key existed (auto-promotion) are the
//  cause: the anchor lookup found no key at stroke end.
//
//  The promotion now binds every UNANCHORED stroke of its frame to the
//  key it just created; anchored strokes are never retargeted.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest';
import type { AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import {
  anchorUnownedAquarelleStrokesForFrame,
  aquarelleStrokesRevision,
  getAquarelleStrokeKeyAnchors,
  recordAquarelleStroke,
  resetAquarelleRecordState,
} from './aquarelleRecordState';

function recordableStroke(mutationId: number, playFrame: number): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#000000',
    params: { size: 10 },
    brushId: 'round',
    points: [{ x: 0.1, y: 0.2, p: 0.5, tx: 0, ty: 0, tw: 0 }],
    mutationId,
    timestamp: 1,
    playFrame,
  };
}

beforeEach(() => {
  resetAquarelleRecordState();
});

describe('anchorUnownedAquarelleStrokesForFrame (UAT round 7)', () => {
  it('binds every unanchored stroke of the promoted frame to the new key', () => {
    recordAquarelleStroke(1, recordableStroke(1, 5));
    recordAquarelleStroke(2, recordableStroke(2, 5));
    recordAquarelleStroke(3, recordableStroke(3, 6));

    expect(anchorUnownedAquarelleStrokesForFrame(5, 'key-5')).toBe(2);
    const anchors = getAquarelleStrokeKeyAnchors();
    expect(anchors.get(1)).toBe('key-5');
    expect(anchors.get(2)).toBe('key-5');
    // Another frame is never touched.
    expect(anchors.has(3)).toBe(false);
  });

  it('never retargets a stroke that already has an anchor', () => {
    recordAquarelleStroke(1, recordableStroke(1, 5), 'original-key');
    recordAquarelleStroke(2, recordableStroke(2, 5));

    expect(anchorUnownedAquarelleStrokesForFrame(5, 'new-key')).toBe(1);
    const anchors = getAquarelleStrokeKeyAnchors();
    expect(anchors.get(1)).toBe('original-key');
    expect(anchors.get(2)).toBe('new-key');
  });

  it('is a no-op for an empty key and bumps the revision only on a change', () => {
    recordAquarelleStroke(1, recordableStroke(1, 5));
    const before = aquarelleStrokesRevision.value;
    expect(anchorUnownedAquarelleStrokesForFrame(5, '')).toBe(0);
    expect(aquarelleStrokesRevision.value).toBe(before);

    expect(anchorUnownedAquarelleStrokesForFrame(5, 'key-5')).toBe(1);
    expect(aquarelleStrokesRevision.value).toBe(before + 1);
    // Second pass adds nothing and must not bump again (no save churn).
    expect(anchorUnownedAquarelleStrokesForFrame(5, 'key-5')).toBe(0);
    expect(aquarelleStrokesRevision.value).toBe(before + 1);
  });
});
