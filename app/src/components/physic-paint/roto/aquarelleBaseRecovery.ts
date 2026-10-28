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
//  The recovered base is VALIDATED, not proven: recombine S over B
//  with the production `pigment-alpha` law and require the mean
//  absolute RGB error against P to stay ≤ 3/255. A base that fails
//  is never adopted (D4 / truth table row 4).
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

export type AquarelleBaseRecoveryResult =
  | { ok: true; bytes: Uint8Array; meanError: number; baseInk: number }
  | { ok: false; reason: 'decode' | 'recombine' | 'validation' | 'encode'; meanError?: number };

/** The acceptance gate: mean absolute RGB error of the recomposition. */
export const AQUARELLE_BASE_RECOVERY_MAX_MEAN_ERROR = 3;

/** Pigment coverage above this is saturated — the base is fully hidden. */
const SATURATED_COVERAGE = 0.97;
/** Below this the script sheet carries no pigment — B = P exactly. */
const NO_PIGMENT_COVERAGE = 1e-3;

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

/** Mean |Δ| over the RGB channels only (alpha excluded), 0..255 units. */
export function meanAbsoluteChannelError(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
): number {
  const length = Math.min(a.length, b.length);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < length; i += 4) {
    sum += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
    sum += Math.abs((a[i + 1] ?? 0) - (b[i + 1] ?? 0));
    sum += Math.abs((a[i + 2] ?? 0) - (b[i + 2] ?? 0));
    count += 3;
  }
  return count === 0 ? 0 : sum / count;
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
 * the recombination against the display, and encode. Never throws: every
 * failure maps to a `reason`.
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
  try {
    const display = await decode(new Uint8Array(input.displayBytes), input.size);
    if (!display) return { ok: false, reason: 'decode' };
    const script = await decode(new Uint8Array(input.scriptBytes), input.size);
    if (!script) return { ok: false, reason: 'decode' };

    const base: AquarelleBasePixels = {
      data: invertAquarellePigmentCoverage(display.data, script.data),
      width: display.width,
      height: display.height,
    };
    const recombined = await recombine(script, base, input.size);
    if (!recombined) return { ok: false, reason: 'recombine' };
    const meanError = meanAbsoluteChannelError(recombined.data, display.data);
    if (!(meanError <= AQUARELLE_BASE_RECOVERY_MAX_MEAN_ERROR)) {
      return { ok: false, reason: 'validation', meanError };
    }
    const bytes = await encodePixels(base, input.size, input.appFrame);
    if (!bytes || bytes.length === 0) return { ok: false, reason: 'encode' };
    return { ok: true, bytes, meanError, baseInk: recoveredBaseInk(base) };
  } catch {
    return { ok: false, reason: 'decode' };
  }
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
