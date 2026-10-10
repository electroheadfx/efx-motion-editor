import {describe, expect, it} from 'vitest';
import {audioSourceSpaceGeometry, selectAudioPeakTier} from './audioClipGeometry';
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
