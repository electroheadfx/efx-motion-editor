// ============================================================
//  aquarelleBaseRecovery — the pigment-alpha inversion law
//  (261028-k03c D4), node-pure with an injected codec.
//
//  The forward model the recovery inverts, per pixel:
//    S = a·C + (1 − a)·255   (the script bake over paper)
//    P = a·C + (1 − a)·B     (the displayed composite)
//  with min(C) = 0 so a·C = S − min(S) and a = 1 − min(S)/255.
//  The fixtures below are built by running that model FORWARD
//  from a known base so a passing round trip pins the inverse.
// ============================================================

import { describe, expect, it } from 'vitest';
import {
  AQUARELLE_BASE_RECOVERY_MAX_CLAMP_RATIO,
  AQUARELLE_BASE_RECOVERY_MAX_MEAN_ERROR,
  AQUARELLE_BASE_RECOVERY_MAX_SATURATED_COLOR_ERROR,
  inversionConsistencyStats,
  invertAquarellePigmentCoverage,
  meanAbsoluteChannelError,
  recoveredBaseInk,
  recoverAquarelleDurableBase,
  type AquarelleBasePixels,
  type AquarelleBaseRecoveryCodec,
} from './aquarelleBaseRecovery';

type Triple = [number, number, number];

function rgba(triples: Triple[]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(triples.length * 4);
  triples.forEach(([r, g, b], index) => {
    out[index * 4] = r;
    out[index * 4 + 1] = g;
    out[index * 4 + 2] = b;
    out[index * 4 + 3] = 255;
  });
  return out;
}

function filled(value: number, pixels = 4): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels * 4);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = value;
    out[i + 1] = value;
    out[i + 2] = value;
    out[i + 3] = 255;
  }
  return out;
}

function pixelsOf(data: Uint8ClampedArray): AquarelleBasePixels {
  return { data, width: 2, height: 2 };
}

function channel(out: Uint8ClampedArray, index: number): Triple {
  return [out[index * 4] ?? -1, out[index * 4 + 1] ?? -1, out[index * 4 + 2] ?? -1];
}

/** Forward model: the script bake S and the composite P for one base pixel. */
function forward(pigment: Triple, coverage: number, base: Triple): { script: Triple; display: Triple } {
  const script = pigment.map((c) => Math.round(coverage * c + (1 - coverage) * 255)) as Triple;
  const display = pigment.map((c, i) =>
    Math.round(coverage * c + (1 - coverage) * base[i]!),
  ) as Triple;
  return { script, display };
}

describe('invertAquarellePigmentCoverage (261028-k03c D4)', () => {
  // min(C) === 0 is what makes S − min(S) equal a·C exactly.
  const PIGMENT: Triple = [200, 40, 0];
  const COVERAGE = 0.5;
  const BASES: Triple[] = [
    [120, 200, 60],
    [10, 90, 250],
    [0, 0, 0],
    [255, 255, 255],
  ];

  it('round-trips a synthetic P/S pair to the known base within ±1/255', () => {
    const forwards = BASES.map((base) => forward(PIGMENT, COVERAGE, base));
    const display = rgba(forwards.map((entry) => entry.display));
    const script = rgba(forwards.map((entry) => entry.script));

    const base = invertAquarellePigmentCoverage(display, script);

    BASES.forEach((expected, index) => {
      const actual = channel(base, index);
      expected.forEach((value, c) => {
        expect(Math.abs(actual[c]! - value), `pixel ${index} channel ${c}`).toBeLessThanOrEqual(1);
      });
      expect(base[index * 4 + 3]).toBe(255);
    });
  });

  it('returns B = P exactly on a white script sheet (no pigment)', () => {
    const display = rgba([
      [10, 20, 30],
      [200, 100, 50],
      [0, 0, 0],
      [255, 255, 255],
    ]);
    const script = new Uint8ClampedArray(display.length).fill(255);

    const base = invertAquarellePigmentCoverage(display, script);

    expect(Array.from(base)).toEqual(Array.from(display));
  });

  it('writes white where the pigment is saturated (a >= 0.97)', () => {
    // min(S) = 5 → a = 250/255 ≈ 0.98; the base is fully hidden.
    const script = rgba([
      [5, 5, 5],
      [5, 5, 5],
      [5, 5, 5],
      [5, 5, 5],
    ]);
    const display = rgba([
      [10, 20, 30],
      [40, 50, 60],
      [70, 80, 90],
      [100, 110, 120],
    ]);

    const base = invertAquarellePigmentCoverage(display, script);

    for (let i = 0; i < base.length; i += 4) {
      expect(channel(base, i / 4)).toEqual([255, 255, 255]);
      expect(base[i + 3]).toBe(255);
    }
    // A slightly less covered pixel takes the real inversion instead.
    const belowThreshold = invertAquarellePigmentCoverage(
      rgba([[0, 0, 0]]),
      rgba([[8, 8, 8]]), // a ≈ 0.9686 < 0.97
    );
    expect(channel(belowThreshold, 0)).toEqual([0, 0, 0]);
  });

  it('passes B = P through at a ≈ 0 instead of dividing by (1 − a)', () => {
    // min(S) = 255 → a = 0; 1 − a = 1 would be safe, but the guard keeps
    // compression noise out of the division.
    const display = rgba([[13, 200, 77]]);
    const script = rgba([[255, 255, 255]]);

    expect(channel(invertAquarellePigmentCoverage(display, script), 0)).toEqual([13, 200, 77]);
  });

  it('clamps out-of-range inversions to 0..255', () => {
    // S = (255, 255, 200): min = 200 → a ≈ 0.2157, a·C = (55, 55, 0).
    // P = (0, 0, 255) pushes the red channel below 0 and the blue above 255.
    const script = rgba([[255, 255, 200]]);
    const display = rgba([[0, 0, 255]]);

    expect(channel(invertAquarellePigmentCoverage(display, script), 0)).toEqual([0, 0, 255]);
  });
});

describe('inversionConsistencyStats (CR-02 provenance signals)', () => {
  const PIGMENT: Triple = [200, 40, 0];

  it('reports no clamp violations and no colour error for a pair baked together', () => {
    const forwards = forward(PIGMENT, 0.5, [120, 200, 60]);
    const stats = inversionConsistencyStats(
      rgba([forwards.display]),
      rgba([forwards.script]),
    );
    expect(stats.clampRatio).toBe(0);
    expect(stats.saturatedColorError).toBe(0);
  });

  it('flags the impossible base implied by a mismatched pair', () => {
    // Black pigment at a ≈ 0.902 with a display four units lighter than the
    // bake implies B ≈ 285 — outside the gamut. The recombination still lands
    // within 3/255 of P, so ONLY this signal can reject the pair.
    const stats = inversionConsistencyStats(rgba([[28, 28, 28]]), rgba([[25, 25, 25]]));
    expect(stats.clampRatio).toBeGreaterThan(AQUARELLE_BASE_RECOVERY_MAX_CLAMP_RATIO);
  });

  it('flags a saturated script whose composite is not the pigment colour', () => {
    // a = 250/255 ≈ 0.98, C = (0, 0, 0); the composite must read ≈ black.
    const stats = inversionConsistencyStats(
      rgba([[200, 180, 160]]),
      rgba([[5, 5, 5]]),
    );
    expect(stats.saturatedColorError).toBeGreaterThan(
      AQUARELLE_BASE_RECOVERY_MAX_SATURATED_COLOR_ERROR,
    );
  });
});

describe('meanAbsoluteChannelError', () => {
  it('is 0 for identical buffers', () => {
    const buffer = rgba([
      [10, 20, 30],
      [40, 50, 60],
      [70, 80, 90],
      [100, 110, 120],
    ]);
    expect(meanAbsoluteChannelError(buffer, new Uint8ClampedArray(buffer))).toBe(0);
  });

  it('is 3 for a uniform +3 RGB shift (alpha excluded)', () => {
    const a = filled(100);
    const b = filled(103);
    // The alpha channel differs by 255 and must not count.
    b[3] = 0;
    expect(meanAbsoluteChannelError(a, b)).toBe(3);
  });

  it('is Infinity for empty or unequal buffers (never passes vacuously)', () => {
    expect(meanAbsoluteChannelError(new Uint8ClampedArray(0), new Uint8ClampedArray(0)))
      .toBe(Infinity);
    expect(meanAbsoluteChannelError(filled(100), filled(100, 1))).toBe(Infinity);
  });
});

describe('recoveredBaseInk', () => {
  it('is 0 for white pixels and 1 for black pixels', () => {
    expect(recoveredBaseInk(pixelsOf(filled(255)))).toBeCloseTo(0, 10);
    expect(recoveredBaseInk(pixelsOf(filled(0)))).toBeCloseTo(1, 10);
    expect(recoveredBaseInk(pixelsOf(new Uint8ClampedArray(0)))).toBe(0);
  });
});

describe('recoverAquarelleDurableBase (fail-closed gate)', () => {
  const ENCODED = new Uint8Array([1, 2, 3]);

  function codec(options: {
    display: AquarelleBasePixels | null;
    script: AquarelleBasePixels | null;
    recombined: AquarelleBasePixels | null;
    encoded?: Uint8Array | null;
    onRecombine?: (script: AquarelleBasePixels, base: AquarelleBasePixels) => void;
  }): Partial<AquarelleBaseRecoveryCodec> {
    let decodes = 0;
    return {
      decode: async () => {
        decodes += 1;
        return decodes === 1 ? options.display : options.script;
      },
      recombine: async (script, base) => {
        options.onRecombine?.(script, base);
        return options.recombined;
      },
      encodePixels: async () => (options.encoded === undefined ? ENCODED : options.encoded),
    };
  }

  it('accepts a recomposition whose mean error is exactly 3/255', async () => {
    const display = pixelsOf(filled(100));
    const script = pixelsOf(filled(255));
    const seenBases: AquarelleBasePixels[] = [];
    const result = await recoverAquarelleDurableBase({
      displayBytes: new Uint8Array([1]),
      scriptBytes: new Uint8Array([2]),
      size: { width: 2, height: 2 },
      appFrame: 4,
      codec: codec({
        display,
        script,
        recombined: pixelsOf(filled(103)),
        onRecombine: (_script, base) => {
          seenBases.push(base);
        },
      }),
    });

    expect(result).toEqual({
      ok: true,
      bytes: ENCODED,
      meanError: AQUARELLE_BASE_RECOVERY_MAX_MEAN_ERROR,
      // The recovered base is the displayed grey, whose pigment coverage is
      // 1 − 100/255 (a white script copies P verbatim).
      baseInk: 1 - 100 / 255,
      clampRatio: 0,
      saturatedColorError: 0,
    });
    // The recombined base is the inverted one: a white script copies the display.
    expect(seenBases).toHaveLength(1);
    expect(Array.from(seenBases[0]!.data)).toEqual(Array.from(filled(100)));
  });

  it('rejects with validation when the recomposition differs by 4/255', async () => {
    const result = await recoverAquarelleDurableBase({
      displayBytes: new Uint8Array([1]),
      scriptBytes: new Uint8Array([2]),
      size: { width: 2, height: 2 },
      appFrame: 4,
      codec: codec({
        display: pixelsOf(filled(100)),
        script: pixelsOf(filled(255)),
        recombined: pixelsOf(filled(104)),
      }),
    });

    expect(result).toEqual({
      ok: false,
      reason: 'validation',
      meanError: 4,
      clampRatio: 0,
      saturatedColorError: 0,
    });
  });

  it('IN-09: rejects a P/S pair that did not come from the same bake', async () => {
    // Black pigment at a ≈ 0.902: the inversion implies B ≈ 285 for this
    // display. The old ≤3/255 recombination gate ACCEPTED this pair (S over
    // the clamped base lands within 3 of P) — exactly the tautology CR-02
    // fixed. The provenance signal must reject it before any recombine.
    let recombined = 0;
    const result = await recoverAquarelleDurableBase({
      displayBytes: new Uint8Array([1]),
      scriptBytes: new Uint8Array([2]),
      size: { width: 2, height: 2 },
      appFrame: 4,
      codec: codec({
        display: pixelsOf(filled(28)),
        script: pixelsOf(filled(25)),
        recombined: pixelsOf(filled(25)),
        onRecombine: () => {
          recombined += 1;
        },
      }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('validation');
    expect(result.clampRatio).toBeGreaterThan(AQUARELLE_BASE_RECOVERY_MAX_CLAMP_RATIO);
    // Refused on provenance, before the tautological recombination ran.
    expect(recombined).toBe(0);
  });

  it('IN-09: rejects a saturated script whose display is not the pigment colour', async () => {
    const result = await recoverAquarelleDurableBase({
      displayBytes: new Uint8Array([1]),
      scriptBytes: new Uint8Array([2]),
      size: { width: 2, height: 2 },
      appFrame: 4,
      codec: codec({
        display: pixelsOf(filled(200)),
        script: pixelsOf(filled(5)),
        recombined: pixelsOf(filled(5)),
      }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('validation');
    expect(result.saturatedColorError).toBeGreaterThan(
      AQUARELLE_BASE_RECOVERY_MAX_SATURATED_COLOR_ERROR,
    );
  });

  it('rejects decoded buffers that are empty, truncated or a different size', async () => {
    const truncated = await recoverAquarelleDurableBase({
      displayBytes: new Uint8Array([1]),
      scriptBytes: new Uint8Array([2]),
      size: { width: 2, height: 2 },
      appFrame: 4,
      codec: codec({
        display: pixelsOf(filled(100)),
        script: pixelsOf(filled(255, 1)),
        recombined: pixelsOf(filled(100)),
      }),
    });
    expect(truncated).toEqual({ ok: false, reason: 'decode' });

    const empty = await recoverAquarelleDurableBase({
      displayBytes: new Uint8Array([1]),
      scriptBytes: new Uint8Array([2]),
      size: { width: 2, height: 2 },
      appFrame: 4,
      codec: codec({
        display: pixelsOf(new Uint8ClampedArray(0)),
        script: pixelsOf(new Uint8ClampedArray(0)),
        recombined: pixelsOf(new Uint8ClampedArray(0)),
      }),
    });
    expect(empty).toEqual({ ok: false, reason: 'decode' });
  });

  it('IN-01: maps each leg exception to its own reason', async () => {
    const failing = (leg: 'decode' | 'recombine' | 'encode'): Partial<AquarelleBaseRecoveryCodec> => ({
      decode: async () => {
        if (leg === 'decode') throw new Error('decode exploded');
        return pixelsOf(filled(255));
      },
      recombine: async () => {
        if (leg === 'recombine') throw new Error('recombine exploded');
        // A consistent white-over-white recomposition for the encode leg.
        return pixelsOf(filled(255));
      },
      encodePixels: async () => {
        if (leg === 'encode') throw new Error('encode exploded');
        return ENCODED;
      },
    });
    for (const leg of ['decode', 'recombine', 'encode'] as const) {
      const result = await recoverAquarelleDurableBase({
        displayBytes: new Uint8Array([1]),
        scriptBytes: new Uint8Array([2]),
        size: { width: 2, height: 2 },
        appFrame: 4,
        codec: failing(leg),
      });
      expect(result, leg).toEqual({ ok: false, reason: leg });
    }
  });

  it('rejects a failed decode', async () => {
    const result = await recoverAquarelleDurableBase({
      displayBytes: new Uint8Array([1]),
      scriptBytes: new Uint8Array([2]),
      size: { width: 2, height: 2 },
      appFrame: 4,
      codec: codec({
        display: null,
        script: pixelsOf(filled(255)),
        recombined: pixelsOf(filled(100)),
      }),
    });

    expect(result).toEqual({ ok: false, reason: 'decode' });
  });

  it('rejects a failed recomposition and a failed encode', async () => {
    const display = pixelsOf(filled(100));
    const script = pixelsOf(filled(255));
    const recombineFailed = await recoverAquarelleDurableBase({
      displayBytes: new Uint8Array([1]),
      scriptBytes: new Uint8Array([2]),
      size: { width: 2, height: 2 },
      appFrame: 4,
      codec: codec({ display, script, recombined: null }),
    });
    expect(recombineFailed).toEqual({ ok: false, reason: 'recombine' });

    const encodeFailed = await recoverAquarelleDurableBase({
      displayBytes: new Uint8Array([1]),
      scriptBytes: new Uint8Array([2]),
      size: { width: 2, height: 2 },
      appFrame: 4,
      codec: codec({ display, script, recombined: display, encoded: null }),
    });
    expect(encodeFailed).toEqual({ ok: false, reason: 'encode' });
  });
});
