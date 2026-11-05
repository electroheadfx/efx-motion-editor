// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  normalizeFrameGotoFrame,
  resolveFrameGotoTarget,
  resolveFrameGotoValue,
} from './physicsPaintFrameGoto';

/**
 * 261105-cgl Task 2: the pure frame/seconds go-to law.
 *
 * ONE conversion path over the shared `audioGain` helpers (the same law the
 * audio surfaces use): frame mode rounds and clamps; seconds mode converts at
 * the PROJECT fps, then normalizes. Every value is finite-checked before it
 * can become a timeline target.
 */

describe('normalizeFrameGotoFrame', () => {
  it('rounds to the nearest frame and clamps into [0, lastFrame]', () => {
    expect(normalizeFrameGotoFrame(5.4, 20)).toBe(5);
    expect(normalizeFrameGotoFrame(5.6, 20)).toBe(6);
    expect(normalizeFrameGotoFrame(-3, 20)).toBe(0);
    expect(normalizeFrameGotoFrame(999, 20)).toBe(20);
  });

  it('returns null for a non-finite frame (no seek at all)', () => {
    expect(normalizeFrameGotoFrame(Number.NaN, 20)).toBeNull();
    expect(normalizeFrameGotoFrame(Number.POSITIVE_INFINITY, 20)).toBeNull();
    expect(normalizeFrameGotoFrame(Number.NEGATIVE_INFINITY, 20)).toBeNull();
  });

  it('never returns a negative frame when the last frame is invalid', () => {
    expect(normalizeFrameGotoFrame(4, Number.NaN)).toBe(0);
    expect(normalizeFrameGotoFrame(4, -5)).toBe(0);
    expect(normalizeFrameGotoFrame(0, 0)).toBe(0);
  });
});

describe('resolveFrameGotoTarget — seconds mode', () => {
  it('converts seconds at the project fps and clamps to the last frame', () => {
    expect(resolveFrameGotoTarget('seconds', 2.5, 12, 100)).toBe(30);
    expect(resolveFrameGotoTarget('seconds', 0.01, 12, 100)).toBe(0);
    expect(resolveFrameGotoTarget('seconds', 100, 12, 100)).toBe(100);
  });

  it('frame mode normalizes the frame directly', () => {
    expect(resolveFrameGotoTarget('frame', 5.4, 12, 100)).toBe(5);
    expect(resolveFrameGotoTarget('frame', -3, 12, 100)).toBe(0);
    expect(resolveFrameGotoTarget('frame', 999, 12, 100)).toBe(100);
  });

  it('returns null for NaN and Infinity in both modes', () => {
    expect(resolveFrameGotoTarget('frame', Number.NaN, 12, 100)).toBeNull();
    expect(resolveFrameGotoTarget('frame', Number.POSITIVE_INFINITY, 12, 100)).toBeNull();
    expect(resolveFrameGotoTarget('seconds', Number.NaN, 12, 100)).toBeNull();
    expect(resolveFrameGotoTarget('seconds', Number.NEGATIVE_INFINITY, 12, 100)).toBeNull();
  });
});

describe('resolveFrameGotoValue — display value', () => {
  it('returns the frame unchanged in frame mode', () => {
    expect(resolveFrameGotoValue('frame', 7, 12)).toBe(7);
    expect(resolveFrameGotoValue('frame', 7, 0)).toBe(7);
  });

  it('expresses the same position in seconds through the project fps', () => {
    expect(resolveFrameGotoValue('seconds', 30, 12)).toBe(2.5);
    expect(resolveFrameGotoValue('seconds', 0, 12)).toBe(0);
  });

  it('roundtrips frame -> seconds -> frame at 12 fps', () => {
    const seconds = resolveFrameGotoValue('seconds', 30, 12);
    expect(seconds).toBe(2.5);
    expect(resolveFrameGotoTarget('seconds', seconds, 12, 100)).toBe(30);
  });
});

describe('fps law — the shared audioGain conversion never divides by zero', () => {
  it('treats 0 and negative fps as 1', () => {
    expect(resolveFrameGotoValue('seconds', 12, 0)).toBe(12);
    expect(resolveFrameGotoValue('seconds', 12, -5)).toBe(12);
    expect(resolveFrameGotoTarget('seconds', 1, 0, 100)).toBe(1);
    expect(resolveFrameGotoTarget('seconds', 1, -5, 100)).toBe(1);
    // A NaN fps propagates through the audioGain law as NaN; the normalizer
    // refuses it, so the caller skips the seek (never a NaN frame).
    expect(resolveFrameGotoTarget('seconds', 1, Number.NaN, 100)).toBeNull();
  });

  it('lastFrame 0 always resolves to frame 0', () => {
    expect(resolveFrameGotoTarget('frame', 30, 12, 0)).toBe(0);
    expect(resolveFrameGotoTarget('seconds', 2.5, 12, 0)).toBe(0);
  });
});
