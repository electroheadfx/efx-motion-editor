// ============================================================
//  aquarelleBaseRecovery — recover the PRE-SCRIPT durable base of
//  a legacy scripted key (261028-k03c D4).
//
//  A key baked before durable bases were recorded has no map
//  entry, yet the displayed frame P already holds BOTH the script
//  pigment and the pre-script base. The pre-script base B can be
//  INVERTED out of the displayed composite P and the raw script
//  bake S when the pigment-alpha law is known:
//
//    S = a·C + (1 − a)·white       (the script bake over paper)
//    P = a·C + (1 − a)·B           (the displayed composite)
//    ⇒ B = (P − (S − min(S))) / (1 − a),   a = 1 − min(S)/255
//
//  with min() over the RGB channels and C the pigment colour made
//  coverage-free (min(C) = 0, so a·C = S − min(S)).
//
//  The recovered base is VALIDATED, not proven. The recombination
//  alone is NOT a provenance gate: because B is inverted from
//  (P, S), recombining S over B returns P for ANY S — the mean
//  error only trips on clamping. Provenance therefore needs two
//  consistency signals computed from the raw inversion itself:
//
//    (a) clamp-violation ratio — a consistent pair implies a B
//        inside [0, 255]; a pair baked from different paper or a
//        different event set usually implies an impossible B.
//    (b) saturated-region colour — where script coverage a ≥ 0.97
//        the composite must read the pigment colour C; a
//        different bake does not.
//
//  A base that fails any gate is never adopted (D4 / row 4).
//
//  Pure math first (node-testable, injected codec); the default
//  codec is the only DOM-touching part and returns null when a
//  canvas capability is missing.
// ============================================================

import { mergeRotoAlphaCanvases } from './physicsPaintRotoAlphaMerge';
import { encodeRotoFrameFromCanvas } from './rotoCanvasFrames';

export interface AquarelleBaseRecoverySize {
  width: number;
  height: number;
}

/** Structurally ImageData-compatible so node tests need no DOM. */
export interface AquarelleBasePixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface AquarelleBaseRecoveryCodec {
  decode(bytes: Uint8Array, size: AquarelleBaseRecoverySize): Promise<AquarelleBasePixels | null>;
  encodePixels(
    pixels: AquarelleBasePixels,
    size: AquarelleBaseRecoverySize,
    appFrame: number,
  ): Promise<Uint8Array | null>;
  recombine(
    script: AquarelleBasePixels,
    base: AquarelleBasePixels,
    size: AquarelleBaseRecoverySize,
  ): Promise<AquarelleBasePixels | null>;
}

/** Non-tautological consistency signals of the (P, S) pair. */
export interface AquarelleBaseRecoveryStats {
  /** Fraction of RGB channels whose raw inverted B lies outside [0, 255]. */
  clampRatio: number;
  /** Mean |P − C| over saturated script pixels (a ≥ 0.97), 0..255 units. */
  saturatedColorError: number;
}

export type AquarelleBaseRecoveryResult =
  | {
    ok: true;
    kind: 'base';
    bytes: Uint8Array;
    meanError: number;
    baseInk: number;
    clampRatio: number;
    saturatedColorError: number;
    /** Pigment-structure correlation of the pair (see k03g note). */
    correlation: number;
    emptyProof: AquarelleEmptyBaseProof;
  }
  | {
    ok: true;
    kind: 'empty';
    /** Mean |P − S| — how far the display drifted from the raw bake. */
    meanError: number;
    clampRatio: number;
    saturatedColorError: number;
    correlation: number;
    emptyProof: AquarelleEmptyBaseProof;
  }
  | {
    ok: false;
    /**
     * `structure`: the display and the bake do not show the same paint (a
     * stale/foreign display). Distinct from `validation`, the numeric bounds.
     */
    reason: 'decode' | 'recombine' | 'validation' | 'structure' | 'encode';
    meanError?: number;
    clampRatio?: number;
    saturatedColorError?: number;
    correlation?: number;
    emptyProof?: AquarelleEmptyBaseProof;
  };

/** The acceptance gate: mean absolute RGB error of the recomposition. */
export const AQUARELLE_BASE_RECOVERY_MAX_MEAN_ERROR = 3;
/**
 * 261028-k03g: the display can NEVER be reproduced pixel-exactly from the
 * same script. The engine's stroke jitter/phase is drawn from `Math.random`
 * (playground/StrokeWriter.ts), NOT from the bake's seeded RNG, so two bakes
 * of one timeline differ at every wash edge — and the live sheet differs from
 * both. Measured on a real 1080×1920 frame: clampRatio 0.089–0.113 and
 * saturatedColorError 12.8–14.2 on two consecutive attempts of the SAME key.
 * The old 0.002/12 gates therefore refused every legacy key for good
 * (Lift reverted ~1 s later, every Move/Delete blocked). They stay as coarse
 * sanity bounds; the provenance signal that survives jitter is the pigment
 * STRUCTURE correlation below.
 */
export const AQUARELLE_BASE_RECOVERY_MAX_CLAMP_RATIO = 0.3;
/** Raw inverted B may overshoot the gamut by this much before it counts. */
const CLAMP_VIOLATION_TOLERANCE = 8;
/**
 * Where the script is saturated the composite must show the pigment colour:
 * P = C within (1 − 0.97)·255 ≈ 7.65 plus decode slack, plus the edge drift
 * of a non-reproducible replay (see above).
 */
export const AQUARELLE_BASE_RECOVERY_MAX_SATURATED_COLOR_ERROR = 32;
/**
 * The jitter-robust provenance signal: the display and the bake must show the
 * SAME paint. Their darkness maps are compared by Pearson correlation (sampled
 * 1/16 of the pixels); edge drift keeps it high, a different frame or a stale
 * display drops it near zero. When either map has no variance the correlation
 * carries no information and reads 1 — the numeric gates still apply.
 */
export const AQUARELLE_BASE_RECOVERY_MIN_CORRELATION = 0.25;

/** Pigment coverage above this is saturated — the base is fully hidden. */
const SATURATED_COVERAGE = 0.97;
/** Below this the script sheet carries no pigment — B = P exactly. */
const NO_PIGMENT_COVERAGE = 1e-3;

/**
 * 261028-k03e: how much darker than the raw bake a display channel may read
 * before it counts as pigment the script cannot explain (WebP/decode slack).
 */
export const AQUARELLE_EMPTY_BASE_DARKER_TOLERANCE = 3;

export interface AquarelleEmptyBaseProof {
  /** True only when the display carries NO pigment the script cannot explain. */
  proven: boolean;
  /** Pixels where the base is visible at all (script coverage < saturated). */
  informative: number;
  /** Channels where P is darker than S beyond the tolerance. */
  darkerChannels: number;
  /** Largest single-channel darkening, 0 when the display is never darker. */
  maxDarker: number;
}

/**
 * 261028-k03e: prove that the pre-script base holds NO pigment.
 *
 * Merging the script bake S over an empty (white) base returns S exactly, so
 * a display P that is nowhere DARKER than S (outside saturated pixels, where
 * the base is hidden) cannot contain base pigment: any difference is the
 * display being LIGHTER — an erased or stale live-sheet residue that the
 * script-authoritative publish is allowed to replace.
 *
 * The proof is one-sided on purpose. A base pigment can only make P darker,
 * so one dark channel keeps the base UNKNOWN and the caller fails closed. It
 * can adopt ONLY the empty base, never an arbitrary recovered one, so it is
 * not the tautological recombination the provenance gate exists to stop.
 */
export function proveEmptyAquarelleBase(
  display: Uint8ClampedArray,
  script: Uint8ClampedArray,
): AquarelleEmptyBaseProof {
  const length = Math.min(display.length, script.length);
  let informative = 0;
  let darkerChannels = 0;
  let maxDarker = 0;
  for (let i = 0; i + 3 < length; i += 4) {
    const sr = script[i] ?? 255;
    const sg = script[i + 1] ?? 255;
    const sb = script[i + 2] ?? 255;
    const min = sr < sg ? (sr < sb ? sr : sb) : sg < sb ? sg : sb;
    if (1 - min / 255 >= SATURATED_COVERAGE) continue;
    informative += 1;
    const dr = sr - (display[i] ?? 255);
    const dg = sg - (display[i + 1] ?? 255);
    const db = sb - (display[i + 2] ?? 255);
    for (const delta of [dr, dg, db]) {
      if (delta > AQUARELLE_EMPTY_BASE_DARKER_TOLERANCE) {
        darkerChannels += 1;
        if (delta > maxDarker) maxDarker = delta;
      }
    }
  }
  return {
    proven: informative > 0 && darkerChannels === 0,
    informative,
    darkerChannels,
    maxDarker,
  };
}

/**
 * Invert the pigment-alpha law per pixel. `display` is the composite P,
 * `script` the raw bake S (both opaque transmittance, white = no pigment).
 * Saturated script pixels write white (no recoverable information); empty
 * script pixels copy P. Alpha is always 255.
 */
export function invertAquarellePigmentCoverage(
  display: Uint8ClampedArray,
  script: Uint8ClampedArray,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(display.length);
  for (let i = 0; i < display.length; i += 4) {
    const sr = script[i] ?? 255;
    const sg = script[i + 1] ?? 255;
    const sb = script[i + 2] ?? 255;
    const min = sr < sg ? (sr < sb ? sr : sb) : sg < sb ? sg : sb;
    const coverage = 1 - min / 255;
    if (coverage >= SATURATED_COVERAGE) {
      // Saturated pigment: the formula would divide by (1 - a) ≈ 0 and turn
      // compression noise into wild values. Nothing of B survives — write white.
      out[i] = 255;
      out[i + 1] = 255;
      out[i + 2] = 255;
    } else if (coverage < NO_PIGMENT_COVERAGE) {
      out[i] = display[i] ?? 255;
      out[i + 1] = display[i + 1] ?? 255;
      out[i + 2] = display[i + 2] ?? 255;
    } else {
      // a·C = S − min(S); B = (P − a·C) / (1 − a).
      const inv = 1 / (1 - coverage);
      const pr = display[i] ?? 255;
      const pg = display[i + 1] ?? 255;
      const pb = display[i + 2] ?? 255;
      out[i] = clampByte((pr - (sr - min)) * inv);
      out[i + 1] = clampByte((pg - (sg - min)) * inv);
      out[i + 2] = clampByte((pb - (sb - min)) * inv);
    }
    out[i + 3] = 255;
  }
  return out;
}

function clampByte(value: number): number {
  if (!Number.isFinite(value)) return 255;
  const rounded = Math.round(value);
  return rounded < 0 ? 0 : rounded > 255 ? 255 : rounded;
}

/**
 * The non-tautological consistency of a (display P, script S) pair. The
 * inversion is an exact inverse, so the recombination returns P for any S and
 * only these two signals can reveal that P was not baked from this S:
 *
 *  - clampRatio: share of RGB channels whose RAW inverted base lies outside
 *    [0, 255] by more than {@link CLAMP_VIOLATION_TOLERANCE}. A consistent
 *    pair stays in gamut (rounding/decode noise only).
 *  - saturatedColorError: mean |P − C| where the script is saturated
 *    (a ≥ 0.97). There P must read the pigment colour C = (S − min(S)) / a.
 *
 * Buffers are expected equal-length (recoverAquarelleDurableBase enforces it);
 * only the common prefix is measured defensively.
 */
export function inversionConsistencyStats(
  display: Uint8ClampedArray,
  script: Uint8ClampedArray,
): AquarelleBaseRecoveryStats {
  const length = Math.min(display.length, script.length);
  let channels = 0;
  let clampViolations = 0;
  let saturatedChannels = 0;
  let saturatedError = 0;
  for (let i = 0; i + 3 < length; i += 4) {
    const sr = script[i] ?? 255;
    const sg = script[i + 1] ?? 255;
    const sb = script[i + 2] ?? 255;
    const min = sr < sg ? (sr < sb ? sr : sb) : sg < sb ? sg : sb;
    const coverage = 1 - min / 255;
    channels += 3;
    if (coverage >= SATURATED_COVERAGE) {
      // P must equal the pigment colour C here; C = (S − min(S)) / a.
      const inverseCoverage = 1 / coverage;
      saturatedError += Math.abs((display[i] ?? 255) - (sr - min) * inverseCoverage);
      saturatedError += Math.abs((display[i + 1] ?? 255) - (sg - min) * inverseCoverage);
      saturatedError += Math.abs((display[i + 2] ?? 255) - (sb - min) * inverseCoverage);
      saturatedChannels += 3;
      continue;
    }
    if (coverage < NO_PIGMENT_COVERAGE) continue; // B = P, in gamut by definition
    const inverse = 1 / (1 - coverage);
    const rawR = ((display[i] ?? 255) - (sr - min)) * inverse;
    const rawG = ((display[i + 1] ?? 255) - (sg - min)) * inverse;
    const rawB = ((display[i + 2] ?? 255) - (sb - min)) * inverse;
    if (!inGamut(rawR)) clampViolations += 1;
    if (!inGamut(rawG)) clampViolations += 1;
    if (!inGamut(rawB)) clampViolations += 1;
  }
  return {
    clampRatio: channels === 0 ? 0 : clampViolations / channels,
    saturatedColorError: saturatedChannels === 0 ? 0 : saturatedError / saturatedChannels,
  };
}

function inGamut(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  return value >= -CLAMP_VIOLATION_TOLERANCE && value <= 255 + CLAMP_VIOLATION_TOLERANCE;
}

/**
 * Mean |Δ| over the RGB channels only (alpha excluded), 0..255 units.
 * Unequal or empty buffers are NOT comparable and return Infinity, so a
 * truncated recomposition can never pass the ≤3 gate vacuously.
 */
export function meanAbsoluteChannelError(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
): number {
  if (a.length === 0 || a.length !== b.length) return Infinity;
  let sum = 0;
  let count = 0;
  for (let i = 0; i + 3 < a.length; i += 4) {
    sum += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
    sum += Math.abs((a[i + 1] ?? 0) - (b[i + 1] ?? 0));
    sum += Math.abs((a[i + 2] ?? 0) - (b[i + 2] ?? 0));
    count += 3;
  }
  return count === 0 ? Infinity : sum / count;
}

export interface AquarellePigmentStructure {
  /** Pearson correlation of the darkness maps, 1 when either has no variance. */
  correlation: number;
  /** Sampled pixels the correlation compared. */
  samples: number;
}

/**
 * 261028-k03g: do the display and the bake show the SAME paint?
 *
 * The exact-inverse gates cannot answer that once playback is not
 * reproducible: the engine's stroke jitter comes from `Math.random`, so a
 * re-bake of one script differs at every wash edge. Structure survives that
 * drift — the same blob in the same place correlates near 1 — while a stale
 * display, a different frame, or a raster base the script never painted drops
 * the correlation. Sampled every 4th pixel on each axis: 1/16 of a 2 MP frame
 * is plenty and costs a few milliseconds.
 */
export function pigmentStructureCorrelation(
  display: Uint8ClampedArray,
  script: Uint8ClampedArray,
): AquarellePigmentStructure {
  const length = Math.min(display.length, script.length);
  // Small buffers (tests, tiles) compare every pixel; a full 2 MP frame
  // compares every 4th, which is still 500k samples and a few milliseconds.
  const stride = length > 800_000 ? 16 : 4;
  let samples = 0;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumYY = 0;
  let sumXY = 0;
  for (let i = 0; i + 3 < length; i += stride) {
    const dr = 255 - (display[i] ?? 255);
    const dg = 255 - (display[i + 1] ?? 255);
    const db = 255 - (display[i + 2] ?? 255);
    const sr = 255 - (script[i] ?? 255);
    const sg = 255 - (script[i + 1] ?? 255);
    const sb = 255 - (script[i + 2] ?? 255);
    const x = dr > dg ? (dr > db ? dr : db) : dg > db ? dg : db;
    const y = sr > sg ? (sr > sb ? sr : sb) : sg > sb ? sg : sb;
    samples += 1;
    sumX += x;
    sumY += y;
    sumXX += x * x;
    sumYY += y * y;
    sumXY += x * y;
  }
  if (samples < 4) return { correlation: 1, samples };
  const varianceX = samples * sumXX - sumX * sumX;
  const varianceY = samples * sumYY - sumY * sumY;
  if (!(varianceX > 1e-6) || !(varianceY > 1e-6)) return { correlation: 1, samples };
  const correlation = (samples * sumXY - sumX * sumY) / Math.sqrt(varianceX * varianceY);
  return {
    correlation: Number.isFinite(correlation) ? Math.max(-1, Math.min(1, correlation)) : 1,
    samples,
  };
}

/**
 * 261028-k03g: the recombination error measured ONLY where the inferred base
 * is representable.
 *
 * The inversion is an exact inverse in gamut, so `meanAbsoluteChannelError` is
 * tautological there; where the raw base clamps, the recombination is EXPECTED
 * to differ and says nothing about the base's quality. Saturated pixels are
 * skipped too — the base is hidden there and the comparison is the
 * saturated-colour signal. `Infinity` when nothing is measurable, so a
 * measurement-free pair can never pass.
 */
export function meanAbsoluteChannelErrorOutsideClampedBases(
  display: Uint8ClampedArray,
  script: Uint8ClampedArray,
  recombined: Uint8ClampedArray,
): number {
  const length = Math.min(display.length, script.length, recombined.length);
  let sum = 0;
  let count = 0;
  for (let i = 0; i + 3 < length; i += 4) {
    const sr = script[i] ?? 255;
    const sg = script[i + 1] ?? 255;
    const sb = script[i + 2] ?? 255;
    const min = sr < sg ? (sr < sb ? sr : sb) : sg < sb ? sg : sb;
    const coverage = 1 - min / 255;
    // Saturated pixels hide the base entirely: their recombination difference
    // is the saturated-colour signal, not a base-quality signal.
    if (coverage >= SATURATED_COVERAGE) continue;
    // No pigment copies the display (B = P and the recombination returns it),
    // so those pixels stay in: they are the cheapest real check of the codec.
    const inverse = 1 / (1 - coverage);
    const rawR = ((display[i] ?? 255) - (sr - min)) * inverse;
    const rawG = ((display[i + 1] ?? 255) - (sg - min)) * inverse;
    const rawB = ((display[i + 2] ?? 255) - (sb - min)) * inverse;
    if (inGamut(rawR)) {
      sum += Math.abs((recombined[i] ?? 0) - (display[i] ?? 0));
      count += 1;
    }
    if (inGamut(rawG)) {
      sum += Math.abs((recombined[i + 1] ?? 0) - (display[i + 1] ?? 0));
      count += 1;
    }
    if (inGamut(rawB)) {
      sum += Math.abs((recombined[i + 2] ?? 0) - (display[i + 2] ?? 0));
      count += 1;
    }
  }
  return count === 0 ? Infinity : sum / count;
}

/** Diagnostic scalar: mean pigment coverage of a pixel buffer (0..1). */
export function recoveredBaseInk(pixels: AquarelleBasePixels): number {
  const data = pixels.data;
  if (data.length === 0) return 0;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 255;
    const g = data[i + 1] ?? 255;
    const b = data[i + 2] ?? 255;
    const min = r < g ? (r < b ? r : b) : g < b ? g : b;
    sum += 1 - min / 255;
    count += 1;
  }
  return count === 0 ? 0 : sum / count;
}

/**
 * Recover B from the displayed composite and the raw script bake, validate
 * provenance and the recombination against the display, then encode. Never
 * throws: every leg maps an exception to its own `reason` (`decode`,
 * `recombine`, `encode`), so a codec fault is never diagnosed as a missing
 * decode capability.
 */
export async function recoverAquarelleDurableBase(input: {
  displayBytes: Uint8Array;
  scriptBytes: Uint8Array;
  size: AquarelleBaseRecoverySize;
  appFrame: number;
  /** Documents that the recovery is brush-agnostic; never set. */
  brushOverrideFree?: never;
  codec?: Partial<AquarelleBaseRecoveryCodec>;
}): Promise<AquarelleBaseRecoveryResult> {
  const decode = input.codec?.decode ?? DEFAULT_AQUARELLE_BASE_RECOVERY_CODEC.decode;
  const encodePixels = input.codec?.encodePixels ?? DEFAULT_AQUARELLE_BASE_RECOVERY_CODEC.encodePixels;
  const recombine = input.codec?.recombine ?? DEFAULT_AQUARELLE_BASE_RECOVERY_CODEC.recombine;

  let display: AquarelleBasePixels | null = null;
  try {
    display = await decode(new Uint8Array(input.displayBytes), input.size);
  } catch {
    return { ok: false, reason: 'decode' };
  }
  if (!display) return { ok: false, reason: 'decode' };

  let script: AquarelleBasePixels | null = null;
  try {
    script = await decode(new Uint8Array(input.scriptBytes), input.size);
  } catch {
    return { ok: false, reason: 'decode' };
  }
  if (!script) return { ok: false, reason: 'decode' };

  // Full-length, same-size buffers: the inversion indexes both in lockstep and
  // a truncated or empty decode must never pass the gates vacuously.
  if (
    display.width <= 0
    || display.height <= 0
    || display.data.length === 0
    || display.data.length !== script.data.length
    || display.width !== script.width
    || display.height !== script.height
  ) {
    return { ok: false, reason: 'decode' };
  }

  // Provenance FIRST: the recombination alone is tautological (it returns P for
  // ANY S — see inversionConsistencyStats), so a pair that was not baked
  // together has to be caught here. The structure correlation is the only one
  // of the three signals that survives a non-reproducible replay (k03g).
  const stats = inversionConsistencyStats(display.data, script.data);
  const emptyProof = proveEmptyAquarelleBase(display.data, script.data);
  const correlation = pigmentStructureCorrelation(display.data, script.data).correlation;
  if (correlation < AQUARELLE_BASE_RECOVERY_MIN_CORRELATION) {
    return { ok: false, reason: 'structure', ...stats, correlation, emptyProof };
  }
  // 261028-k03e: a display that is never darker than the bake carries no base
  // pigment at all. This is the common legacy state: a refused/failed Lift left
  // its engine erase on the live sheet, that sheet became the key payload, and
  // the composite is now LIGHTER than the script everywhere. The clamped base
  // is white and there is nothing to preserve — refusing here blocked every
  // Move/Delete/transform on the frame.
  if (emptyProof.proven) {
    return {
      ok: true,
      kind: 'empty',
      meanError: meanAbsoluteChannelError(script.data, display.data),
      clampRatio: stats.clampRatio,
      saturatedColorError: stats.saturatedColorError,
      correlation,
      emptyProof,
    };
  }
  if (
    stats.clampRatio > AQUARELLE_BASE_RECOVERY_MAX_CLAMP_RATIO
    || stats.saturatedColorError > AQUARELLE_BASE_RECOVERY_MAX_SATURATED_COLOR_ERROR
  ) {
    return { ok: false, reason: 'validation', ...stats, correlation, emptyProof };
  }

  const base: AquarelleBasePixels = {
    data: invertAquarellePigmentCoverage(display.data, script.data),
    width: display.width,
    height: display.height,
  };

  let recombined: AquarelleBasePixels | null = null;
  try {
    recombined = await recombine(script, base, input.size);
  } catch {
    return { ok: false, reason: 'recombine' };
  }
  if (!recombined) return { ok: false, reason: 'recombine' };
  if (
    recombined.data.length === 0
    || recombined.data.length !== display.data.length
    || recombined.width !== display.width
    || recombined.height !== display.height
  ) {
    return { ok: false, reason: 'recombine' };
  }

  // The remaining gate is the clamp sanity check, not the provenance gate.
  // 261028-k03g: measured only where the inversion did NOT clamp — a clamped
  // channel's recombination difference is expected and carries no signal.
  const meanError = meanAbsoluteChannelErrorOutsideClampedBases(
    display.data,
    script.data,
    recombined.data,
  );
  if (!(meanError <= AQUARELLE_BASE_RECOVERY_MAX_MEAN_ERROR)) {
    return { ok: false, reason: 'validation', meanError, ...stats, correlation, emptyProof };
  }

  let bytes: Uint8Array | null = null;
  try {
    bytes = await encodePixels(base, input.size, input.appFrame);
  } catch {
    return { ok: false, reason: 'encode' };
  }
  if (!bytes || bytes.length === 0) return { ok: false, reason: 'encode' };
  return {
    ok: true,
    kind: 'base',
    bytes,
    meanError,
    baseInk: recoveredBaseInk(base),
    ...stats,
    correlation,
    emptyProof,
  };
}

/* ------------------------------------------------------------------ DOM */

function canvasContextFor(
  documentFor: Document,
  size: AquarelleBaseRecoverySize,
): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } | null {
  const canvas = documentFor.createElement('canvas');
  canvas.width = Math.max(1, Math.round(size.width));
  canvas.height = Math.max(1, Math.round(size.height));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  return { canvas, context };
}

async function decodeRecoveryFrame(
  bytes: Uint8Array,
  size: AquarelleBaseRecoverySize,
): Promise<AquarelleBasePixels | null> {
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return null;
  const bitmap = await createImageBitmap(
    new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/webp' }),
    { premultiplyAlpha: 'premultiply' },
  );
  try {
    const target = canvasContextFor(document, size);
    if (!target) return null;
    target.context.drawImage(bitmap, 0, 0, target.canvas.width, target.canvas.height);
    const image = target.context.getImageData(0, 0, target.canvas.width, target.canvas.height);
    return { data: image.data, width: image.width, height: image.height };
  } catch {
    return null;
  } finally {
    bitmap.close?.();
  }
}

async function encodeRecoveryPixels(
  pixels: AquarelleBasePixels,
  size: AquarelleBaseRecoverySize,
  appFrame: number,
): Promise<Uint8Array | null> {
  if (typeof document === 'undefined') return null;
  const target = canvasContextFor(document, size);
  if (!target) return null;
  const image = new ImageData(
    new Uint8ClampedArray(pixels.data),
    Math.max(1, pixels.width),
    Math.max(1, pixels.height),
  );
  target.context.putImageData(image, 0, 0);
  const payload = await encodeRotoFrameFromCanvas(target.canvas, appFrame, size);
  return payload.bytes;
}

async function recombineRecoveryPixels(
  script: AquarelleBasePixels,
  base: AquarelleBasePixels,
  size: AquarelleBaseRecoverySize,
): Promise<AquarelleBasePixels | null> {
  if (typeof document === 'undefined') return null;
  const scriptTarget = canvasContextFor(document, size);
  const baseTarget = canvasContextFor(document, size);
  if (!scriptTarget || !baseTarget) return null;
  scriptTarget.context.putImageData(
    new ImageData(new Uint8ClampedArray(script.data), Math.max(1, script.width), Math.max(1, script.height)),
    0,
    0,
  );
  baseTarget.context.putImageData(
    new ImageData(new Uint8ClampedArray(base.data), Math.max(1, base.width), Math.max(1, base.height)),
    0,
    0,
  );
  const merged = await mergeRotoAlphaCanvases(
    null,
    scriptTarget.canvas,
    { width: scriptTarget.canvas.width, height: scriptTarget.canvas.height },
    baseTarget.canvas,
    'pigment-alpha',
  );
  const context = merged.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  const image = context.getImageData(0, 0, merged.width, merged.height);
  return { data: image.data, width: image.width, height: image.height };
}

/** Production codec: WebP decode, pigment-alpha recombine, WebP encode. */
export const DEFAULT_AQUARELLE_BASE_RECOVERY_CODEC: AquarelleBaseRecoveryCodec = {
  decode: decodeRecoveryFrame,
  encodePixels: encodeRecoveryPixels,
  recombine: recombineRecoveryPixels,
};
