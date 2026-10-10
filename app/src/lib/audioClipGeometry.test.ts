import {describe, expect, it} from 'vitest';
import {
  audioSourceSpaceGeometry,
  computeAudioFitToView,
  selectAudioPeakTier,
} from './audioClipGeometry';
import type {WaveformPeaks} from '../types/audio';

function makePeaks(tier1Count: number, tier2Count: number, tier3Count: number): WaveformPeaks {
  return {
    tier1: new Float32Array(tier1Count * 2),
    tier2: new Float32Array(tier2Count * 2),
    tier3: new Float32Array(tier3Count * 2),
  };
}

describe('audioSourceSpaceGeometry (261010-g2n W1)', () => {
  it('maps the full source under the clip bar at a trim-relative scale', () => {
    const g = audioSourceSpaceGeometry({
      barX: 100,
      barW: 200,
      inFrame: 10,
      outFrame: 30,
      slipOffset: 0,
      totalAudioFrames: 100,
    });
    // trimFrames = 20 -> sourceScale = 200/20 = 10
    expect(g.sourceScale).toBe(10);
    // sourceX = 100 - (10+0)*10 = 0
    expect(g.sourceX).toBe(0);
    // sourceW = 100 * 10 = 1000
    expect(g.sourceW).toBe(1000);
  });

  it('increasing inFrame moves sourceX left (trim reveals later source at the bar left)', () => {
    const base = audioSourceSpaceGeometry({
      barX: 100,
      barW: 200,
      inFrame: 10,
      outFrame: 30,
      slipOffset: 0,
      totalAudioFrames: 100,
    });
    const later = audioSourceSpaceGeometry({
      barX: 100,
      barW: 200,
      inFrame: 15,
      outFrame: 35,
      slipOffset: 0,
      totalAudioFrames: 100,
    });
    // Same trim length -> same scale; +5 inFrame shifts sourceX left by 5 * sourceScale.
    expect(later.sourceScale).toBe(base.sourceScale);
    expect(later.sourceX).toBe(base.sourceX - 5 * base.sourceScale);
    expect(later.sourceX).toBeLessThan(base.sourceX);
  });

  it('increasing slipOffset slides sourceX left by slipOffset * sourceScale (bar stays fixed)', () => {
    const base = audioSourceSpaceGeometry({
      barX: 100,
      barW: 200,
      inFrame: 10,
      outFrame: 30,
      slipOffset: 0,
      totalAudioFrames: 100,
    });
    const slipped = audioSourceSpaceGeometry({
      barX: 100,
      barW: 200,
      inFrame: 10,
      outFrame: 30,
      slipOffset: 4,
      totalAudioFrames: 100,
    });
    expect(slipped.sourceX).toBe(base.sourceX - 4 * base.sourceScale);
    // Source footprint is unchanged — content slides under a fixed bar.
    expect(slipped.sourceW).toBe(base.sourceW);
  });

  it('shortening the trim raises sourceScale so the source does not rescale to fill the bar', () => {
    const wide = audioSourceSpaceGeometry({
      barX: 100,
      barW: 200,
      inFrame: 0,
      outFrame: 40,
      slipOffset: 0,
      totalAudioFrames: 100,
    });
    const narrow = audioSourceSpaceGeometry({
      barX: 100,
      barW: 200,
      inFrame: 0,
      outFrame: 10,
      slipOffset: 0,
      totalAudioFrames: 100,
    });
    // Same barW, shorter trim -> larger scale and a wider source footprint.
    expect(narrow.sourceScale).toBeGreaterThan(wide.sourceScale);
    expect(narrow.sourceW).toBeGreaterThan(wide.sourceW);
    // Source density (px per source frame) is the scale itself — not barW / totalAudioFrames.
    expect(narrow.sourceScale).toBe(200 / 10);
    expect(wide.sourceScale).toBe(200 / 40);
  });

  it('guards zero-length trim and zero-length source (T-g2n-02)', () => {
    const g = audioSourceSpaceGeometry({
      barX: 0,
      barW: 100,
      inFrame: 5,
      outFrame: 5,
      slipOffset: 0,
      totalAudioFrames: 0,
    });
    expect(Number.isFinite(g.sourceScale)).toBe(true);
    expect(Number.isFinite(g.sourceX)).toBe(true);
    expect(Number.isFinite(g.sourceW)).toBe(true);
    expect(g.sourceScale).toBe(100); // barW / max(1, 0)
    expect(g.sourceW).toBe(100); // max(1, 0) * sourceScale
  });
});

describe('selectAudioPeakTier (261010-g2n W1)', () => {
  // tier2 density reference: 100 peak pairs.
  const peaks = makePeaks(10, 100, 400);

  it('falls back to tier1 when tier2 is empty', () => {
    const sparse = makePeaks(10, 0, 400);
    expect(selectAudioPeakTier(sparse, 50, 10_000)).toBe(sparse.tier1);
  });

  it('returns tier1 when source pixels per tier2 peak are below 1', () => {
    // sourceScale * (total / 100) = 0.01 * (100 / 100) = 0.01 < 1
    expect(selectAudioPeakTier(peaks, 0.01, 100)).toBe(peaks.tier1);
  });

  it('returns tier2 in the 1..4 px band', () => {
    // 2 * (100 / 100) = 2
    expect(selectAudioPeakTier(peaks, 2, 100)).toBe(peaks.tier2);
  });

  it('returns tier3 above 4 source px per tier2 peak', () => {
    // 5 * (100 / 100) = 5 > 4
    expect(selectAudioPeakTier(peaks, 5, 100)).toBe(peaks.tier3);
  });

  it('a short zoomed window on a long file selects tier3, not tier1', () => {
    // 81s at 24fps ≈ 1944 frames; 1.5s trim at barW=600 -> sourceScale = 400.
    // pixelsPerSourcePeak = 400 * (1944 / 4000) >> 4 -> tier3.
    const longFile = makePeaks(500, 4000, 16000);
    const sourceScale = 600 / (1.5 * 24);
    expect(sourceScale * (1944 / 4000)).toBeGreaterThan(4);
    expect(selectAudioPeakTier(longFile, sourceScale, 1944)).toBe(longFile.tier3);
  });
});

describe('computeAudioFitToView (261010-g2n W2 / UAT 2026-10-10 snap-to-view)', () => {
  const track = {
    inFrame: 100,
    outFrame: 300,
    offsetFrame: 50,
    slipOffset: 0,
    totalFramesInFile: 1000,
  };

  it('snaps In/Out to the view span even when the bar is already fully visible', () => {
    // Bar span [50, 250] (200 frames); viewport [0, 400] — zoomed OUT.
    // The audible span becomes the 400-frame view, Position at 0.
    const fit = computeAudioFitToView(track, {visStart: 0, visEnd: 400});
    expect(fit).not.toBeNull();
    // source at t=50 (clip left) = 100; newOut = 100 + 400 = 500.
    expect(fit!.inFrame).toBe(100);
    expect(fit!.outFrame).toBe(500);
    expect(fit!.offsetFrame).toBe(0);
    expect(fit!.slipOffset).toBe(0);
  });

  it('returns null when the result already matches the view', () => {
    const snapped = {inFrame: 100, outFrame: 500, offsetFrame: 0, slipOffset: 0, totalFramesInFile: 1000};
    expect(computeAudioFitToView(snapped, {visStart: 0, visEnd: 400})).toBeNull();
  });

  it('returns null when the view span is empty or non-finite', () => {
    expect(computeAudioFitToView(track, {visStart: 10, visEnd: 10})).toBeNull();
    expect(computeAudioFitToView(track, {visStart: 10, visEnd: 5})).toBeNull();
  });

  it('crops In/Out to the on-screen slice and moves Position to the visible left edge', () => {
    // Bar span [50, 250]; viewport [150, 400] -> L=150, viewSpan=250.
    const fit = computeAudioFitToView(track, {visStart: 150, visEnd: 400});
    expect(fit).not.toBeNull();
    // source at t = 100 + 0 + (t - 50); at L=150 -> 200; span = 250 -> out=450.
    expect(fit!.inFrame).toBe(200);
    expect(fit!.outFrame).toBe(450);
    expect(fit!.offsetFrame).toBe(150);
    expect(fit!.slipOffset).toBe(0);
  });

  it('zoom shows up as the view span: a tighter zoom crops tighter', () => {
    // Same scroll origin, zoomed in: viewport [150, 200] -> span 50.
    const fit = computeAudioFitToView(track, {visStart: 150, visEnd: 200});
    expect(fit).not.toBeNull();
    // source at L=150 -> 200; span 50 -> out=250.
    expect(fit!.inFrame).toBe(200);
    expect(fit!.outFrame).toBe(250);
    expect(fit!.offsetFrame).toBe(150);
  });

  it('keeps on-screen source content when slipOffset is non-zero', () => {
    const slipped = {...track, slipOffset: 20};
    // Bar span [50, 250]; viewport [0, 200] -> keepT=50, viewSpan=200.
    const fit = computeAudioFitToView(slipped, {visStart: 0, visEnd: 200});
    expect(fit).not.toBeNull();
    // source at t = 100 + 20 + (t - 50) = 70 + t; at keepT=50 -> 120; span 200 -> 320.
    expect(fit!.inFrame).toBe(120);
    expect(fit!.outFrame).toBe(320);
    expect(fit!.offsetFrame).toBe(0);
    expect(fit!.slipOffset).toBe(0);
  });

  it('moves an off-screen bar into the view and sizes it to the view', () => {
    // Bar span [50, 250]; viewport [500, 600] — no overlap.
    const fit = computeAudioFitToView(track, {visStart: 500, visEnd: 600});
    expect(fit).not.toBeNull();
    // keepT = barStart = 50 -> source 100; span 100 -> 200; Position = 500.
    expect(fit!.inFrame).toBe(100);
    expect(fit!.outFrame).toBe(200);
    expect(fit!.offsetFrame).toBe(500);
    expect(fit!.slipOffset).toBe(0);
  });

  it('preserves a 1-frame minimum span', () => {
    const fit = computeAudioFitToView(track, {visStart: 249.25, visEnd: 250.1});
    expect(fit).not.toBeNull();
    expect(fit!.outFrame - fit!.inFrame).toBeGreaterThanOrEqual(1);
  });

  it('clamps the crop into the file window (T-g2n-02)', () => {
    const edge = {
      inFrame: 0,
      outFrame: 10,
      offsetFrame: -100,
      slipOffset: 0,
      totalFramesInFile: 20,
    };
    // View [−95, 5] would request a 100-frame span; the file only has 20.
    const fit = computeAudioFitToView(edge, {visStart: -95, visEnd: 5});
    expect(fit).not.toBeNull();
    expect(fit!.inFrame).toBeGreaterThanOrEqual(0);
    expect(fit!.outFrame).toBeGreaterThan(fit!.inFrame);
    expect(fit!.outFrame).toBeLessThanOrEqual(20);
    expect(fit!.slipOffset).toBe(0);
  });
});
