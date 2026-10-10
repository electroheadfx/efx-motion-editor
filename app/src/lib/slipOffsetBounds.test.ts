import { describe, expect, it } from 'vitest';
import {
  clampSlipOffsetFrames,
  slipOffsetBoundsSeconds,
} from './slipOffsetBounds';

const WINDOW = { inFrame: 24, outFrame: 120, totalFramesInFile: 240 };

describe('slipOffsetBoundsSeconds (261010-en9 R5/R6 sign law)', () => {
  it('maps the UI Offset seconds: positive = earlier source, negative = later source', () => {
    // inFrame 24 / outFrame 120 / total 240 @ 24fps → max 1.0, min -5.0.
    const bounds = slipOffsetBoundsSeconds(WINDOW, 24);
    expect(bounds.max).toBeCloseTo(1.0, 6);
    expect(bounds.min).toBeCloseTo(-5.0, 6);
  });

  it('inFrame 0 blocks positive UI Offset (max 0)', () => {
    const bounds = slipOffsetBoundsSeconds({ inFrame: 0, outFrame: 120, totalFramesInFile: 240 }, 24);
    expect(bounds.max).toBe(0);
  });

  it('a long trimmed source yields a wide negative-to-zero window (261010-ht0 F4)', () => {
    // Studio clip: inFrame 0, outFrame 1.6s-equivalent (38 frames at 24 fps),
    // sourceFrames of an 81s file (1944 frames). The trim span never collapses
    // the window — Offset can move near -79.4s.
    const bounds = slipOffsetBoundsSeconds({ inFrame: 0, outFrame: 38, totalFramesInFile: 1944 }, 24);
    expect(bounds.min).toBeCloseTo(-79.4, 1);
    expect(bounds.max).toBe(0);
  });

  it('outFrame == totalFramesInFile blocks negative UI Offset (min 0)', () => {
    const bounds = slipOffsetBoundsSeconds({ inFrame: 24, outFrame: 240, totalFramesInFile: 240 }, 24);
    expect(bounds.min).toBe(0);
  });
});

describe('clampSlipOffsetFrames (261010-en9 engine-sign clamp)', () => {
  it('keeps [inFrame+slip, outFrame+slip] inside [0, totalFramesInFile]', () => {
    // Engine sign is the inverse of UI: slip >= -inFrame, slip <= total - outFrame.
    expect(clampSlipOffsetFrames(0, WINDOW)).toBe(0);
    expect(clampSlipOffsetFrames(-24, WINDOW)).toBe(-24);
    expect(clampSlipOffsetFrames(-999, WINDOW)).toBe(-24);
    expect(clampSlipOffsetFrames(120, WINDOW)).toBe(120);
    expect(clampSlipOffsetFrames(999, WINDOW)).toBe(120);
  });

  it('rejects out-of-range commits at the edges of a zero-in / full-out window', () => {
    const zeroIn = { inFrame: 0, outFrame: 120, totalFramesInFile: 240 };
    expect(clampSlipOffsetFrames(120, zeroIn)).toBe(120);
    expect(clampSlipOffsetFrames(-1, zeroIn)).toBe(0);
    const fullOut = { inFrame: 24, outFrame: 240, totalFramesInFile: 240 };
    expect(clampSlipOffsetFrames(-24, fullOut)).toBe(-24);
    expect(clampSlipOffsetFrames(1, fullOut)).toBe(0);
  });
});
