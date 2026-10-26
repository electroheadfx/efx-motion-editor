/**
 * 2026-10-26 (round 2, option B) — WHEN a stored aquarelle transmittance sheet
 * must be converted to straight-alpha pigment before compositing.
 *
 * Storage stays opaque (MODE.transparent, white = no pigment): no format
 * change, old projects render, thumbnails/pose margins/render-split
 * diagnostics keep their proven multiply law. But the editor's layer model is
 * PIGMENT alpha (alpha = 1 − min(r,g,b)): under source-over, an opaque sheet
 * hard-masks whatever is beneath it, and a light wash reads as fully opaque —
 * the user-reported lost semi-transparency.
 *
 * The conversion is only needed when something else is actually in the
 * composite. A single watercolor track over a paper/colour fond keeps the
 * exact opaque fast path: the ONE fond multiply (paper × t) already renders
 * the identical result with zero per-track pixel work.
 *
 * Pure predicate so the whole law lives in one testable seam — the store only
 * supplies the three observable facts.
 */
export interface EfxPaintTransmittanceConversionInput {
  /** Tracks that contribute content at this frame (missing/empty tracks excluded). */
  readonly contentTrackCount: number;
  /** A Background clip resolves to real content at this frame. */
  readonly backgroundContentAtFrame: boolean;
  /**
   * The composite carries a fond beneath it: a resolved fond instruction on
   * the including path, or the Studio's separate fond layer beneath the
   * isolated tracks group (includeFond=false). False only when the raster is
   * delivered over video / a transparent background.
   */
  readonly hasFond: boolean;
}

export function shouldConvertTransmittanceTracks(input: EfxPaintTransmittanceConversionInput): boolean {
  if (input.contentTrackCount <= 0) return false;
  // More than one content track: inter-track source-over needs real alpha, or
  // the opaque sheet masks the tracks below.
  if (input.contentTrackCount > 1) return true;
  // A single track: conversion matters only when something else sits beneath
  // it inside the same composite, or when no fond will multiply it downstream.
  return input.backgroundContentAtFrame || !input.hasFond;
}
