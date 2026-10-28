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
  AQUARELLE_BASE_RECOVERY_MIN_CORRELATION,
  inversionConsistencyStats,
  invertAquarellePigmentCoverage,
  meanAbsoluteChannelError,
  meanAbsoluteChannelErrorOutsideClampedBases,
  invertAquarelleBaseForRecovery,
  pigmentStructureCorrelation,
  proveEmptyAquarelleBase,
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

  it('writes WHITE for an impossible inversion — never a black ghost', () => {
    // S = (255, 255, 200): min = 200 → a ≈ 0.2157, a·C = (55, 55, 0).
    // P = (0, 0, 255) pushes the red base to ≈ −70: no base pigment can
    // explain the display there. Clamping to 0 used to paint MAXIMUM pigment
    // exactly where none is provable — the k03g speckle ghost.
    const script = rgba([[255, 255, 200]]);
    const display = rgba([[0, 0, 255]]);

    expect(channel(invertAquarellePigmentCoverage(display, script), 0)).toEqual([255, 255, 255]);
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

describe('proveEmptyAquarelleBase (261028-k03e)', () => {
  it('proves the base empty when the display equals the bake', () => {
    const script = rgba([
      [200, 40, 0],
      [255, 255, 255],
      [120, 200, 60],
      [250, 250, 250],
    ]);
    // The [5,5,5] pixel is saturated (a ≈ 0.98) — the base is hidden there.
    expect(proveEmptyAquarelleBase(script, script)).toEqual({
      proven: true,
      informative: 3,
      darkerChannels: 0,
      maxDarker: 0,
    });
  });

  it('proves it when the display is LIGHTER than the bake (erased/stale sheet)', () => {
    const script = rgba([
      [200, 40, 0],
      [120, 200, 60],
      [5, 5, 5],
      [100, 100, 100],
    ]);
    const display = rgba([
      [255, 255, 255],
      [200, 220, 180],
      [255, 255, 255],
      [140, 140, 140],
    ]);
    const proof = proveEmptyAquarelleBase(display, script);
    expect(proof.proven).toBe(true);
    expect(proof.darkerChannels).toBe(0);
  });

  it('does NOT prove it when a visible pixel is darker than the bake', () => {
    const script = rgba([
      [255, 255, 255],
      [200, 200, 200],
      [250, 250, 250],
      [255, 255, 255],
    ]);
    const display = rgba([
      [255, 255, 255],
      [180, 200, 200],
      [250, 250, 250],
      [255, 255, 255],
    ]);
    const proof = proveEmptyAquarelleBase(display, script);
    expect(proof.proven).toBe(false);
    expect(proof.darkerChannels).toBe(1);
    expect(proof.maxDarker).toBe(20);
  });

  it('ignores saturated script pixels, where the base is hidden', () => {
    // a = 1 − 5/255 ≈ 0.98 everywhere: nothing informative, nothing proven.
    expect(proveEmptyAquarelleBase(filled(0), filled(5))).toEqual({
      proven: false,
      informative: 0,
      darkerChannels: 0,
      maxDarker: 0,
    });
  });

  it('tolerates WebP/decode slack up to the tolerance', () => {
    const script = filled(200);
    expect(proveEmptyAquarelleBase(filled(203), script).proven).toBe(true);
    expect(proveEmptyAquarelleBase(filled(196), script).proven).toBe(false);
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
      kind: 'base',
      bytes: ENCODED,
      meanError: AQUARELLE_BASE_RECOVERY_MAX_MEAN_ERROR,
      // The recovered base is the displayed grey, whose pigment coverage is
      // 1 − 100/255 (a white script copies P verbatim).
      baseInk: 1 - 100 / 255,
      clampRatio: 0,
      saturatedColorError: 0,
      // Both maps are constant, so the structure correlation has no variance
      // to read and reports 1 (k03g) — the numeric gates still apply.
      correlation: 1,
      // P (grey) is darker than the white script, so the EMPTY-base proof
      // cannot claim there is no base pigment.
      emptyProof: {
        proven: false,
        informative: 4,
        darkerChannels: 12,
        maxDarker: 155,
      },
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
      correlation: 1,
      emptyProof: {
        proven: false,
        informative: 4,
        darkerChannels: 12,
        maxDarker: 155,
      },
    });
  });

  it('IN-09: rejects a DARKER P/S pair that did not come from the same bake', async () => {
    // A dark display over a mid-tone script implies an impossible negative
    // base (B ≈ −57 on red). The old ≤3/255 recombination gate ACCEPTED this
    // pair (S over the clamped base lands near P) — exactly the tautology
    // CR-02 fixed. The provenance signal must reject it before any recombine.
    // 261028-k03e: the pair is DARKER than the script on every channel; a
    // LIGHTER pair is the erased/stale-sheet state the empty-base proof
    // handles separately (see provesEmptyAquarelleBase).
    let recombined = 0;
    const result = await recoverAquarelleDurableBase({
      displayBytes: new Uint8Array([1]),
      scriptBytes: new Uint8Array([2]),
      size: { width: 2, height: 2 },
      appFrame: 4,
      codec: codec({
        display: pixelsOf(filled(10)),
        script: pixelsOf(rgba([[120, 100, 90], [120, 100, 90], [120, 100, 90], [120, 100, 90]])),
        recombined: pixelsOf(filled(10)),
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
    // 261028-k03e: the pair must NOT prove the empty base (a grey display over
    // a white script is darker), or the proof would short-circuit before the
    // recombine/encode legs.
    const failing = (leg: 'decode' | 'recombine' | 'encode'): Partial<AquarelleBaseRecoveryCodec> => {
      const base = codec({
        display: pixelsOf(filled(100)),
        script: pixelsOf(filled(255)),
        recombined: pixelsOf(filled(100)),
      });
      if (leg === 'decode') {
        return { ...base, decode: async () => { throw new Error('decode exploded'); } };
      }
      if (leg === 'recombine') {
        return { ...base, recombine: async () => { throw new Error('recombine exploded'); } };
      }
      return { ...base, encodePixels: async () => { throw new Error('encode exploded'); } };
    };
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

  it('adopts the EMPTY base (no recombine/encode) when the display is not darker than the bake', async () => {
    let encoded = 0;
    let recombined = 0;
    const result = await recoverAquarelleDurableBase({
      displayBytes: new Uint8Array([1]),
      scriptBytes: new Uint8Array([2]),
      size: { width: 2, height: 2 },
      appFrame: 4,
      codec: {
        decode: (() => {
          let decodes = 0;
          return async () => {
            decodes += 1;
            return pixelsOf(filled(decodes === 1 ? 220 : 200));
          };
        })(),
        recombine: async () => {
          recombined += 1;
          return pixelsOf(filled(220));
        },
        encodePixels: async () => {
          encoded += 1;
          return ENCODED;
        },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe('empty');
    expect(result.meanError).toBe(20);
    expect(result.emptyProof).toMatchObject({ proven: true, darkerChannels: 0 });
    expect(recombined).toBe(0);
    expect(encoded).toBe(0);
  });
});

// ============================================================
//  261028-k03g — the gates must survive a NON-reproducible
//  replay. The engine's stroke jitter/phase comes from
//  Math.random, so a bake of one script never equals the live
//  sheet (measured: clamp 0.089–0.113, satErr 12.8–14.2). The
//  old 0.002/12 gates refused every legacy key for good.
// ============================================================
describe('261028-k03g recovery provable on a real, jittered pair', () => {
  it('correlates the same paint and rejects a foreign display', () => {
    const same = pigmentStructureCorrelation(
      rgba([[10, 10, 10], [200, 200, 200], [120, 120, 120], [40, 40, 40]]),
      rgba([[20, 20, 20], [190, 190, 190], [130, 130, 130], [50, 50, 50]]),
    );
    expect(same.correlation).toBeGreaterThan(0.95);

    const foreign = pigmentStructureCorrelation(
      rgba([[0, 0, 0], [255, 255, 255], [0, 0, 0], [255, 255, 255]]),
      rgba([[255, 255, 255], [0, 0, 0], [255, 255, 255], [0, 0, 0]]),
    );
    expect(foreign.correlation).toBeLessThan(0);
    expect(foreign.correlation).toBeLessThan(AQUARELLE_BASE_RECOVERY_MIN_CORRELATION);
  });

  it('reads 1 when either map has no structure to compare', () => {
    const structure = pigmentStructureCorrelation(filled(10), filled(200));
    expect(structure.correlation).toBe(1);
    expect(structure.samples).toBeGreaterThan(0);
  });

  it('accepts a JITTERED pair whose clamp ratio is far above the old 0.002 gate', async () => {
    // S = (228,148,128): a ≈ 0.498, a·C = (100,20,0).
    // Four display pixels at (90,70,50) imply B_red ≈ −20 (clamped); four at
    // (150,70,50) imply B_red ≈ 100 (in gamut). 4/24 channels clamp = 0.167.
    let encoded = 0;
    const display = rgba([
      [90, 70, 50], [90, 70, 50], [90, 70, 50], [90, 70, 50],
      [150, 70, 50], [150, 70, 50], [150, 70, 50], [150, 70, 50],
    ]);
    const result = await recoverAquarelleDurableBase({
      displayBytes: new Uint8Array([1]),
      scriptBytes: new Uint8Array([2]),
      size: { width: 8, height: 1 },
      appFrame: 4,
      codec: {
        decode: (() => {
          let decodes = 0;
          return async () => {
            decodes += 1;
            return decodes === 1
              ? { data: display, width: 8, height: 1 }
              : { data: rgba(new Array(8).fill([228, 148, 128]) as Triple[]), width: 8, height: 1 };
          };
        })(),
        recombine: async () => ({ data: new Uint8ClampedArray(display), width: 8, height: 1 }),
        encodePixels: async () => {
          encoded += 1;
          return new Uint8Array([1, 2, 3]);
        },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe('base');
    expect(result.clampRatio).toBeGreaterThan(0.002);
    expect(result.clampRatio).toBeLessThanOrEqual(AQUARELLE_BASE_RECOVERY_MAX_CLAMP_RATIO);
    // The clamped red channel is excluded from the fidelity mean.
    expect(result.meanError).toBe(0);
    expect(result.correlation).toBe(1);
    expect(encoded).toBe(1);
  });

  it('refuses a display that shows a different picture, before any recombine', async () => {
    let recombined = 0;
    const result = await recoverAquarelleDurableBase({
      displayBytes: new Uint8Array([1]),
      scriptBytes: new Uint8Array([2]),
      size: { width: 4, height: 1 },
      appFrame: 4,
      codec: {
        decode: (() => {
          let decodes = 0;
          return async () => {
            decodes += 1;
            return decodes === 1
              ? { data: rgba([[0, 0, 0], [255, 255, 255], [0, 0, 0], [255, 255, 255]]), width: 4, height: 1 }
              : { data: rgba([[255, 255, 255], [120, 120, 120], [255, 255, 255], [120, 120, 120]]), width: 4, height: 1 };
          };
        })(),
        recombine: async () => {
          recombined += 1;
          return pixelsOf(filled(0));
        },
        encodePixels: async () => new Uint8Array([1, 2, 3]),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('structure');
    expect(result.correlation).toBeLessThan(AQUARELLE_BASE_RECOVERY_MIN_CORRELATION);
    expect(recombined).toBe(0);
  });
});

describe('261028-k03g meanAbsoluteChannelErrorOutsideClampedBases', () => {
  it('skips a clamped channel and measures the rest', () => {
    // S = (228,148,128) → a ≈ 0.498; P_red = 90 implies a clamped B_red.
    const script = rgba([[228, 148, 128]]);
    const display = rgba([[90, 70, 50]]);
    const recombined = rgba([[100, 70, 50]]);
    expect(meanAbsoluteChannelErrorOutsideClampedBases(display, script, recombined)).toBe(0);
  });

  it('measures a no-pigment pixel like the plain mean', () => {
    expect(
      meanAbsoluteChannelErrorOutsideClampedBases(filled(100), filled(255), filled(104)),
    ).toBe(4);
  });

  it('is Infinity when every script pixel is saturated (nothing measurable)', () => {
    expect(
      meanAbsoluteChannelErrorOutsideClampedBases(filled(10), filled(0), filled(10)),
    ).toBe(Infinity);
  });
});

describe('261028-k03g invertAquarelleBaseForRecovery', () => {
  it('drops base pigment under meaningful script coverage (no bake ghost)', () => {
    // S = (228,148,128) → a ≈ 0.498. The pure inverse would carry the wash's
    // own pigment into the base; the recovery form must not.
    const script = rgba([[228, 148, 128]]);
    const display = rgba([[150, 70, 50]]);
    expect(channel(invertAquarelleBaseForRecovery(display, script), 0)).toEqual([255, 255, 255]);
  });

  it('keeps the base verbatim where the script is transparent', () => {
    const script = rgba([[255, 255, 255]]);
    const display = rgba([[13, 200, 77]]);
    expect(channel(invertAquarelleBaseForRecovery(display, script), 0)).toEqual([13, 200, 77]);
  });
});
