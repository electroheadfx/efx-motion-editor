import { describe, expect, it } from 'vitest';
import { shouldConvertTransmittanceTracks } from './efxPaintPigmentAlpha';

// 2026-10-26 — round 2: a watercolor track is a STRAIGHT-ALPHA PIGMENT layer
// (alpha = 1 − min(r,g,b)). Storage stays opaque MODE.transparent
// transmittance (option B — no format change, old projects render); the
// compositor converts a track's raster to pigment alpha only when something
// else is actually beneath or above it in the composite:
//
//   - MORE THAN ONE content track → source-over inter-track stacking needs
//     real alpha, or the opaque sheet hard-masks the tracks below;
//   - background CONTENT at the frame → the wash must mask the clip;
//   - NO fond → the raster is delivered over video / transparent (pigment
//     alpha, not a multiply-only opaque sheet).
//
// A single watercolor track over a paper/colour fond keeps the exact opaque
// fast path: the one fond multiply (paper × t) is already exact, and the
// conversion would only add per-track pixel work for no visual change.

const IDLE_BASE = {
  contentTrackCount: 1,
  backgroundContentAtFrame: false,
  hasFond: true,
} as const;

describe('shouldConvertTransmittanceTracks — pigment alpha only where it changes the result', () => {
  it('a single watercolor track over a fond keeps the opaque fast path', () => {
    expect(shouldConvertTransmittanceTracks({ ...IDLE_BASE })).toBe(false);
  });

  it('converts when a second content track must show through (inter-track alpha)', () => {
    expect(shouldConvertTransmittanceTracks({ ...IDLE_BASE, contentTrackCount: 2 })).toBe(true);
  });

  it('converts when background content sits beneath the wash', () => {
    expect(shouldConvertTransmittanceTracks({ ...IDLE_BASE, backgroundContentAtFrame: true })).toBe(true);
  });

  it('converts when there is no fond — the raster is delivered over video/transparent', () => {
    expect(shouldConvertTransmittanceTracks({ ...IDLE_BASE, hasFond: false })).toBe(true);
  });

  it('never converts an empty composite (nothing to stack beneath)', () => {
    expect(shouldConvertTransmittanceTracks({ ...IDLE_BASE, contentTrackCount: 0 })).toBe(false);
    // Defensive: a nonsense negative count is treated as empty, not as many.
    expect(shouldConvertTransmittanceTracks({ ...IDLE_BASE, contentTrackCount: -1 })).toBe(false);
  });

  it('converts the multi-track no-fond composite (all three triggers agree)', () => {
    expect(shouldConvertTransmittanceTracks({
      contentTrackCount: 3,
      backgroundContentAtFrame: true,
      hasFond: false,
    })).toBe(true);
  });
});
