// ============================================================
//  quick 261027-klx — the Roto frame-persistence truth table.
//
//  Pins the law BEFORE Wave 3 re-points `shouldPersistRotoFrame`
//  away from the engine-1 document mirror. The regression row:
//  "engine-1 mirror empty, watercolor recorded strokes present ->
//  persist" — without it a painted watercolor frame classifies as
//  empty and Roto persistence silently drops real paint.
// ============================================================

import { describe, expect, it } from 'vitest';
import { shouldPersistRotoFrameFromTruth, type RotoFramePersistTruthInput } from './rotoFramePersistTruth';

function truth(overrides: Partial<RotoFramePersistTruthInput> = {}): RotoFramePersistTruthInput {
  return {
    recordedStrokeCount: 0,
    payloadEventCount: 0,
    bgMode: 'transparent',
    ...overrides,
  };
}

describe('quick 261027-klx Roto frame-persist truth table', () => {
  it('no strokes + transparent background -> empty frame', () => {
    expect(shouldPersistRotoFrameFromTruth(truth())).toBe(false);
  });

  it('no strokes + a non-transparent background -> persist', () => {
    for (const bgMode of ['white', 'canvas1', 'canvas2', 'canvas3', 'photo']) {
      expect(shouldPersistRotoFrameFromTruth(truth({ bgMode })), bgMode).toBe(true);
    }
  });

  it('one recorded stroke + transparent background -> persist', () => {
    expect(shouldPersistRotoFrameFromTruth(truth({ recordedStrokeCount: 1 }))).toBe(true);
  });

  it('payload events with zero live strokes (all deleted) -> empty frame', () => {
    expect(shouldPersistRotoFrameFromTruth(truth({ payloadEventCount: 12 }))).toBe(false);
  });

  it('REGRESSION: engine-1 mirror empty but watercolor recorded strokes present -> persist', () => {
    // This is the exact shape after stroke acceptance moves to the ledger:
    // the legacy mirror is empty, the watercolor timeline is not.
    expect(shouldPersistRotoFrameFromTruth(truth({
      recordedStrokeCount: 3,
      payloadEventCount: 3,
      bgMode: 'transparent',
    }))).toBe(true);
  });

  it('negative and non-finite counts are treated as zero', () => {
    for (const recordedStrokeCount of [-1, -99, Number.NaN, Number.NEGATIVE_INFINITY]) {
      expect(shouldPersistRotoFrameFromTruth(truth({ recordedStrokeCount })), String(recordedStrokeCount)).toBe(false);
    }
    expect(shouldPersistRotoFrameFromTruth(truth({
      recordedStrokeCount: -1,
      bgMode: 'white',
    }))).toBe(true);
  });

  it('fractional counts truncate toward zero', () => {
    expect(shouldPersistRotoFrameFromTruth(truth({ recordedStrokeCount: 0.9 }))).toBe(false);
    expect(shouldPersistRotoFrameFromTruth(truth({ recordedStrokeCount: 1.9 }))).toBe(true);
  });
});
