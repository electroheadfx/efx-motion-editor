import { describe, expect, it } from 'vitest';
import {
  DH1_CAPTURE_LCG_SEED,
  DH1_CAPTURE_ZOOM,
  DH1_DEFECT_METRIC_KEYS,
  DH1_HARD_JUMP,
  DH1_INK_FLOOR,
  DH1_MANIFEST_KEYS,
  DH1_MANIFEST_ROW_KEYS,
  DH1_SEAM_KEYS,
  DH1_SEAM_ORDER,
  DH1_TIER_PARITY_KEYS,
  DH1_TIER_PARITY_METRIC_KEYS,
  TIER_PARITY_GAP_TOLERANCE_PX,
  TIER_PARITY_SILHOUETTE_TOLERANCE_PX,
  TIER_PARITY_CENTROID_TOLERANCE_PX,
  alphaFromRgba,
  buildDh1Manifest,
  computeDefectMetrics,
  computeRegionAlphaMass,
  computeSpeckleMetrics,
  computeTierParityMetrics,
  cropAlphaPlane,
  tierParityPasses,
  wetAlphaToPlane,
  type Dh1ManifestRow,
  type Dh1SeamDump,
  type Dh1TierParityDump,
  type Dh1TierParityMetrics,
} from './depositSpeckleCapture';

function plane(width: number, height: number, fill: (x: number, y: number) => number): Uint8Array {
  const alpha = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) alpha[y * width + x] = fill(x, y);
  }
  return alpha;
}

function stubMetrics() {
  return {
    tornEdge: 0,
    bodyHardJumps: 0,
    bodyHfEnergy: 0,
    isolatedPx: 3,
    edgeCliffs: 5,
    alphaMass: 1000,
  };
}

function stubRow(name: string): Dh1ManifestRow {
  return {
    name,
    isolatedPx: 3,
    edgeCliffs: 5,
    alphaMass: 1000,
    tornEdge: 0,
    bodyHardJumps: 0,
    bodyHfEnergy: 0,
    lanes: { lightSlow: 100, heavySlow: 800, heavyFast: 700 },
    pngPath: '/tmp/efx-dh1/red/x.png',
  };
}

function stubSeam(tag: string, seam: Dh1SeamDump['seam']): Dh1SeamDump {
  return {
    tag,
    seam,
    x: 0,
    y: 0,
    width: 8,
    height: 8,
    metrics: stubMetrics(),
    pngPath: '/tmp/efx-dh1/red/seam-x.png',
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

describe('dh1 defect metrics (acceptance — isolatedPx is cross-check only)', () => {
  it('a smooth filled rectangle scores tornEdge = 0 and body defects = 0', () => {
    const width = 20;
    const height = 10;
    const alpha = plane(width, height, () => 200);
    const m = computeDefectMetrics(alpha, width, height);
    expect(m.tornEdge).toBe(0);
    expect(m.bodyHardJumps).toBe(0);
    expect(m.bodyHfEnergy).toBe(0);
    expect(m.isolatedPx).toBe(0);
  });

  it('THE METRIC GAP: a torn contour with a clean body scores isolatedPx = 0 but tornEdge > 0', () => {
    // Solid body whose top edge is chewed into 1-2px crumbs (the diagnosis's
    // AFTER keep-field row). Every fringe pixel has the 245 body as a peer,
    // so isolatedPx reads 0 — exactly the false-negative the gap describes.
    const width = 30;
    const height = 10;
    const chew = new Set([2, 4, 5, 8, 11, 14, 15, 18, 21, 24, 27]);
    const alpha = plane(width, height, (x, y) => {
      if (y === 0 && chew.has(x)) return 0;
      return 245;
    });
    const m = computeDefectMetrics(alpha, width, height);
    expect(m.isolatedPx).toBe(0);
    expect(m.tornEdge).toBeGreaterThan(0);
    expect(m.bodyHardJumps).toBe(0);
  });

  it('body salt-and-pepper lights up bodyHardJumps + bodyHfEnergy', () => {
    const width = 15;
    const height = 15;
    const alpha = plane(width, height, (x, y) => {
      if (x === 7 && y === 7) return 20;
      return 245;
    });
    const m = computeDefectMetrics(alpha, width, height);
    expect(m.bodyHardJumps).toBeGreaterThan(0);
    expect(m.bodyHfEnergy).toBeGreaterThan(0);
    expect(m.tornEdge).toBe(0);
  });

  it('an enclosed body hole is counted as a body defect', () => {
    const width = 15;
    const height = 15;
    const alpha = plane(width, height, (x, y) => (x === 7 && y === 7 ? 0 : 245));
    const m = computeDefectMetrics(alpha, width, height);
    expect(m.bodyHardJumps).toBeGreaterThan(0);
  });

  it('a smooth ramp still scores tornEdge = 0 (no false tear on falloff)', () => {
    const width = 40;
    const height = 8;
    const alpha = plane(width, height, (x) => x * 5);
    const m = computeDefectMetrics(alpha, width, height);
    expect(m.tornEdge).toBe(0);
  });
});

describe('dh1 field helpers', () => {
  it('wetAlphaToPlane is shape-preserving and non-saturating at one layer', () => {
    const planeOut = wetAlphaToPlane([0, 3000, 2450, 200000]);
    expect(Array.from(planeOut)).toEqual([0, 255, 208, 255]);
  });

  it('cropAlphaPlane extracts the requested window and clamps at the origin', () => {
    const src = plane(4, 4, (x, y) => y * 4 + x + 1);
    const cropped = cropAlphaPlane(src, 4, 4, 1, 1, { x: 0, y: 0, width: 2, height: 2 });
    expect(cropped.width).toBe(2);
    expect(cropped.height).toBe(2);
    expect(Array.from(cropped.alpha)).toEqual([6, 7, 10, 11]);
  });
});

describe('dh1 manifest shape', () => {
  it('carries every required key (top level, per row, per seam)', () => {
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
      seams: [stubSeam('heavy-slow', 'post-raster'), stubSeam('heavy-slow', 'post-display')],
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
    for (const key of DH1_SEAM_KEYS) {
      expect(manifest.seams[0], `missing seam key ${key}`).toHaveProperty(key);
    }
    for (const key of DH1_DEFECT_METRIC_KEYS) {
      expect(manifest.seams[0].metrics, `missing defect metric ${key}`).toHaveProperty(key);
    }
    expect(DH1_SEAM_ORDER).toEqual(['post-raster', 'post-gate', 'post-dry', 'post-display']);
    expect(DH1_CAPTURE_LCG_SEED).toBe(123456789);
    expect(DH1_CAPTURE_ZOOM).toBe(4);
  });
});

describe('dh1 tier-parity capture pin (D-08)', () => {
  const TP_W = 52;
  const TP_H = 14;

  /** Horizontal band fixture with an optional full-band interior gap and an
   *  optional single-pixel enclosed hole. Ink = 200 (>= DH1_INK_FLOOR). */
  function tpBand(
    y0: number,
    y1: number,
    x0: number,
    x1: number,
    gapCols?: readonly [number, number],
    hole?: readonly [number, number],
  ): Uint8Array {
    return plane(TP_W, TP_H, (x, y) => {
      if (y < y0 || y > y1 || x < x0 || x > x1) return 0;
      if (gapCols && x >= gapCols[0] && x <= gapCols[1]) return 0;
      if (hole && x === hole[0] && y === hole[1]) return 0;
      return 200;
    });
  }

  it('Test 1 (identical): shared-gap planes score all zeros and pass', () => {
    const live = tpBand(3, 8, 0, 39, [18, 21]);
    const finalPlane = tpBand(3, 8, 0, 39, [18, 21]);
    const m = computeTierParityMetrics(live, finalPlane, TP_W, TP_H);
    expect(m.gapMismatch).toBe(0);
    expect(m.silhouetteDriftPx).toBe(0);
    expect(m.newHoleCount).toBe(0);
    expect(m.centroidDriftPx).toBe(0);
    expect(tierParityPasses(m)).toBe(true);
  });

  it('Test 2 (fewer-but-thicker): passes under the 4.1 tolerance while strict containment is FALSE', () => {
    // live = rows 3..8 x 0..39 (thicker), final = rows 4..7 x 0..38, same
    // gap columns where both tiers ink — the D-08 capture-pin form.
    const live = tpBand(3, 8, 0, 39, [18, 21]);
    const finalPlane = tpBand(4, 7, 0, 38, [18, 21]);
    const m = computeTierParityMetrics(live, finalPlane, TP_W, TP_H);
    expect(tierParityPasses(m)).toBe(true);
    // Strict "final covers live" would false-fail here — prove it evaluates
    // false right next to the passing parity (never strict containment).
    let covered = true;
    for (let i = 0; i < live.length; i++) {
      if (live[i] >= DH1_INK_FLOOR && finalPlane[i] < DH1_INK_FLOOR) {
        covered = false;
        break;
      }
    }
    expect(covered).toBe(false);
  });

  it('Test 3 (new hole at settle): a final-only enclosed 8/8 hole fails the pin', () => {
    const live = tpBand(3, 8, 0, 39, [18, 21]);
    const finalPlane = tpBand(3, 8, 0, 39, [18, 21], [30, 5]);
    const m = computeTierParityMetrics(live, finalPlane, TP_W, TP_H);
    expect(m.newHoleCount).toBeGreaterThanOrEqual(1);
    expect(tierParityPasses(m)).toBe(false);
  });

  it('Test 4 (tier-local gap / moved skip): a gap shifted beyond tolerance fails the pin', () => {
    const live = tpBand(3, 8, 0, 39, [18, 21]);
    // Gap shifted +5 px — strictly greater than TIER_PARITY_GAP_TOLERANCE_PX.
    const finalPlane = tpBand(3, 8, 0, 39, [23, 26]);
    expect(24.5 - 19.5).toBeGreaterThan(TIER_PARITY_GAP_TOLERANCE_PX);
    const m = computeTierParityMetrics(live, finalPlane, TP_W, TP_H);
    expect(m.gapMismatch).toBeGreaterThanOrEqual(1);
    expect(tierParityPasses(m)).toBe(false);
  });

  it('Test 5 (shift): a 6 px-translated final plane fails silhouette + centroid', () => {
    const live = tpBand(3, 8, 0, 39);
    const finalPlane = tpBand(3, 8, 6, 45);
    const m = computeTierParityMetrics(live, finalPlane, TP_W, TP_H);
    expect(m.silhouetteDriftPx).toBeGreaterThanOrEqual(6);
    expect(m.silhouetteDriftPx).toBeGreaterThan(TIER_PARITY_SILHOUETTE_TOLERANCE_PX);
    expect(m.centroidDriftPx).toBeGreaterThanOrEqual(6);
    expect(m.centroidDriftPx).toBeGreaterThan(TIER_PARITY_CENTROID_TOLERANCE_PX);
    expect(tierParityPasses(m)).toBe(false);
  });

  it('Test 6 (manifest shape): tierParity key set, stub coverage, default null, isolation violations', () => {
    // DH1_MANIFEST_KEYS carries tierParity (the existing shape test iterates it).
    expect(DH1_MANIFEST_KEYS).toContain('tierParity');
    // Every pinned metric key exists on a stub metrics object.
    const stubMetrics: Dh1TierParityMetrics = {
      gapMismatch: 0,
      silhouetteDriftPx: 0,
      newHoleCount: 0,
      centroidDriftPx: 0,
      liveMass: 1000,
      finalMass: 900,
    };
    for (const key of DH1_TIER_PARITY_METRIC_KEYS) {
      expect(stubMetrics, `missing tier-parity metric ${key}`).toHaveProperty(key);
    }
    const stubDump: Dh1TierParityDump = {
      livePngPath: '/tmp/efx-dh1/tier-parity/tier-parity-live.png',
      finalPngPath: '/tmp/efx-dh1/tier-parity/tier-parity-final.png',
      metrics: stubMetrics,
      pass: true,
    };
    for (const key of DH1_TIER_PARITY_KEYS) {
      expect(stubDump, `missing tier-parity dump key ${key}`).toHaveProperty(key);
    }
    // buildDh1Manifest without tierParity returns an explicit null.
    const manifest = buildDh1Manifest({
      runLabel: 'red',
      capturedAt: '2026-09-29T00:00:00.000Z',
      lcgSeed: DH1_CAPTURE_LCG_SEED,
      zoom: DH1_CAPTURE_ZOOM,
      canvas: { width: 100, height: 80 },
      clearedAtStart: true,
      brushSpec: { size: 16, opacity: 100 },
      paper: { offKey: '', onKey: null, paperHeightActive: false },
      contentSpec: {
        basePolyline: [[0.08, 0.5]],
        sampleStepPx: 12,
        laneY: [0.18, 0.5, 0.82],
        ySpread: 0.24,
        variants: [],
      },
      rows: [],
      seams: [],
    });
    expect(manifest.tierParity).toBeNull();
    expect(manifest).toHaveProperty('tierParity');
    // Each invariant violated in isolation trips the pass helper.
    expect(tierParityPasses({ ...stubMetrics, gapMismatch: 1 })).toBe(false);
    expect(tierParityPasses({ ...stubMetrics, newHoleCount: 1 })).toBe(false);
    expect(tierParityPasses({ ...stubMetrics, silhouetteDriftPx: TIER_PARITY_SILHOUETTE_TOLERANCE_PX + 1 })).toBe(false);
    expect(tierParityPasses({ ...stubMetrics, centroidDriftPx: TIER_PARITY_CENTROID_TOLERANCE_PX + 1 })).toBe(false);
    expect(tierParityPasses(stubMetrics)).toBe(true);
  });

  it('Test 6b (metric-driven violation): computeTierParityMetrics over a shifted pair makes tierParityPasses false', () => {
    const live = tpBand(3, 8, 0, 39);
    const finalPlane = tpBand(3, 8, 6, 45);
    const m = computeTierParityMetrics(live, finalPlane, TP_W, TP_H);
    expect(m.silhouetteDriftPx).toBeGreaterThan(TIER_PARITY_SILHOUETTE_TOLERANCE_PX);
    expect(tierParityPasses(m)).toBe(false);
  });
});

// ---------------------------------------------------------------
// dh1 row i — the headless form of the "thick renders as clean as
// thin" acceptance (260928-dh1 rows table: hairline CLEAN / thick
// FILTHY was the failure shape). Thin and thick bands share one
// construction, so the ONLY difference under test is thickness —
// same DH1 constants both ways, no width-dependent threshold to
// hide behind. Capture rows a-i themselves run at user-side UAT.
// ---------------------------------------------------------------

describe('dh1 row i — thick renders as clean as thin (headless discriminator)', () => {
  const RI_W = 44;
  const RI_H = 22;
  const RI_X0 = 6;
  const RI_X1 = 37;
  /** Body alpha shared by every band (matches the rectangle pins above). */
  const RI_BODY = 200;
  /** Near-zero salt cell — crosses DH1_HARD_JUMP against RI_BODY. */
  const RI_SALT = 5;
  /** 1px AA falloff ring, BELOW DH1_INK_FLOOR so it never enters an ink
   *  run or interiority — the identical edge profile for both widths. */
  const RI_FALLOFF = 3;

  /** Thin = rows 4..6, thick = rows 4..16; both share the same falloff ring. */
  function rowIBand(y0: number, y1: number, salt = false): Uint8Array {
    return plane(RI_W, RI_H, (x, y) => {
      const inBody = y >= y0 && y <= y1 && x >= RI_X0 && x <= RI_X1;
      if (inBody) return salt && (x + y) % 2 === 1 ? RI_SALT : RI_BODY;
      const inRing = y >= y0 - 1 && y <= y1 + 1 && x >= RI_X0 - 1 && x <= RI_X1 + 1;
      return inRing ? RI_FALLOFF : 0;
    });
  }

  it('(a) thin and thick smooth bands both score zero defects under the SAME constants', () => {
    expect(RI_FALLOFF).toBeLessThan(DH1_INK_FLOOR);
    const thin = computeDefectMetrics(rowIBand(4, 6), RI_W, RI_H);
    const thick = computeDefectMetrics(rowIBand(4, 16), RI_W, RI_H);
    for (const m of [thin, thick]) {
      expect(m.tornEdge).toBe(0);
      expect(m.bodyHardJumps).toBe(0);
      expect(m.bodyHfEnergy).toBe(0);
      expect(m.isolatedPx).toBe(0);
    }
  });

  it('(b) salt-and-pepper injected into the THICK band trips bodyHardJumps and bodyHfEnergy with the same DH1 constants', () => {
    // The salt crosses the exact jump threshold the thin case measured against.
    expect(RI_BODY - RI_SALT).toBeGreaterThanOrEqual(DH1_HARD_JUMP);
    const salted = computeDefectMetrics(rowIBand(4, 16, true), RI_W, RI_H);
    expect(salted.bodyHardJumps).toBeGreaterThan(0);
    expect(salted.bodyHfEnergy).toBeGreaterThan(0);
  });
});
