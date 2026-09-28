import { describe, expect, it } from 'vitest';
import {
  DH1_CAPTURE_LCG_SEED,
  DH1_CAPTURE_ZOOM,
  DH1_MANIFEST_KEYS,
  DH1_MANIFEST_ROW_KEYS,
  alphaFromRgba,
  buildDh1Manifest,
  computeRegionAlphaMass,
  computeSpeckleMetrics,
  type Dh1ManifestRow,
} from './depositSpeckleCapture';

function plane(width: number, height: number, fill: (x: number, y: number) => number): Uint8Array {
  const alpha = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) alpha[y * width + x] = fill(x, y);
  }
  return alpha;
}

function stubRow(name: string): Dh1ManifestRow {
  return {
    name,
    isolatedPx: 3,
    edgeCliffs: 5,
    alphaMass: 1000,
    lanes: { lightSlow: 100, heavySlow: 800, heavyFast: 700 },
    pngPath: '/tmp/efx-dh1/red/x.png',
  };
}

describe('dh1 speckle metrics', () => {
  it('extracts the alpha plane from RGBA bytes', () => {
    expect(Array.from(alphaFromRgba([1, 2, 3, 4, 5, 6, 7, 8]))).toEqual([4, 8]);
  });

  it('a speckled array yields isolatedPx > 0 (salt-and-pepper detector)', () => {
    // One bright pixel with no peer in its 8-neighborhood.
    const alpha = plane(9, 9, (x, y) => (x === 4 && y === 4 ? 100 : 0));
    const metrics = computeSpeckleMetrics(alpha, 9, 9);
    expect(metrics.isolatedPx).toBeGreaterThan(0);
    expect(metrics.alphaMass).toBe(100);
  });

  it('a smooth ramp yields isolatedPx = 0 and edgeCliffs = 0 (continuous falloff)', () => {
    // 5px steps across, identical rows: every >=4 pixel keeps a peer >= a/2
    // (its row twin), and no adjacent pair jumps from >= 32 straight to <= 4.
    const width = 40;
    const height = 5;
    const alpha = plane(width, height, (x) => x * 5);
    const metrics = computeSpeckleMetrics(alpha, width, height);
    expect(metrics.isolatedPx).toBe(0);
    expect(metrics.edgeCliffs).toBe(0);
  });

  it('a hard step IS detected as an edge cliff', () => {
    // Solid body dropping straight to transparency — the cliff the fix must
    // turn into continuous falloff.
    const width = 10;
    const height = 5;
    const alpha = plane(width, height, (x) => (x < 5 ? 120 : 0));
    const metrics = computeSpeckleMetrics(alpha, width, height);
    expect(metrics.edgeCliffs).toBeGreaterThan(0);
    expect(metrics.isolatedPx).toBe(0);
  });

  it('mass ordering: light body < heavy body', () => {
    const light = plane(10, 10, () => 30);
    const heavy = plane(20, 20, () => 60);
    const lightMass = computeSpeckleMetrics(light, 10, 10).alphaMass;
    const heavyMass = computeSpeckleMetrics(heavy, 20, 20).alphaMass;
    expect(lightMass).toBeLessThan(heavyMass);
  });

  it('lane region mass reads only inside the region', () => {
    const width = 10;
    const height = 10;
    const alpha = plane(width, height, (_x, y) => (y >= 4 && y < 6 ? 10 : 0));
    expect(computeRegionAlphaMass(alpha, width, height, { x0: 0, y0: 0, x1: 10, y1: 4 })).toBe(0);
    expect(computeRegionAlphaMass(alpha, width, height, { x0: 0, y0: 4, x1: 10, y1: 6 })).toBe(200);
  });
});

describe('dh1 manifest shape', () => {
  it('carries every required key (top level and per row)', () => {
    const manifest = buildDh1Manifest({
      runLabel: 'red',
      capturedAt: '2026-09-28T00:00:00.000Z',
      lcgSeed: DH1_CAPTURE_LCG_SEED,
      zoom: DH1_CAPTURE_ZOOM,
      canvas: { width: 100, height: 80 },
      clearedAtStart: true,
      brushSpec: { size: 16, opacity: 100 },
      paper: { offKey: '', onKey: 'canvas1', paperHeightActive: true },
      contentSpec: {
        basePolyline: [
          [0.08, 0.5],
          [0.92, 0.42],
        ],
        sampleStepPx: 12,
        laneY: [0.18, 0.5, 0.82],
        ySpread: 0.24,
        variants: [
          {
            name: 'light-slow',
            pressure: 0.2,
            dtMs: 60,
            lane: 0,
            points: [{ x: 1, y: 2, timeStamp: 1000, pressure: 0.2 }],
          },
        ],
      },
      rows: [stubRow('paper-off-clicks-0')],
    });

    for (const key of DH1_MANIFEST_KEYS) {
      expect(manifest, `missing manifest key ${key}`).toHaveProperty(key);
    }
    for (const key of DH1_MANIFEST_ROW_KEYS) {
      expect(manifest.rows[0], `missing row key ${key}`).toHaveProperty(key);
    }
    expect(manifest.rows[0].lanes).toHaveProperty('lightSlow');
    expect(manifest.rows[0].lanes).toHaveProperty('heavySlow');
    expect(manifest.rows[0].lanes).toHaveProperty('heavyFast');
    expect(DH1_CAPTURE_LCG_SEED).toBe(123456789);
    expect(DH1_CAPTURE_ZOOM).toBe(4);
  });
});
