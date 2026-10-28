// ============================================================
//  aquarelleLiftErase — Lift (the eraser) as a TRANSMITTANCE
//  punch for the cached/durable raster (261028-k03 D2).
//
//  The engine erases in ABSORBANCE: `liftFS` multiplies the
//  density targets by (1 - f), f = amount * exp(-(d^2/r^2)^2),
//  and the display transmittance is exp(-a). A lift of factor f
//  therefore maps t' = t^(1-f) per channel in LINEAR light —
//  K = PROD(1 - f_i) over the stroke's dabs, so overlapping dabs
//  accumulate multiplicatively. A linear lighten (t * (1 - f))
//  would break both replay parity and the double-erase algebra.
//
//  Stored sheets are OPAQUE transmittance (white = no pigment),
//  so the punch must NEVER write alpha and never source-over
//  white — that would punch a hole in the sheet.
//
//  Footprint (mirrors the bake's own law, which is what a
//  re-bake replays): radius = (0.012 + 0.03 * pressure) *
//  3^((engineSize - 0.5) * 2) in document heights, dab spacing
//  0.5 * r, moving dab amount = the stroke's recorded Lift strength
//  (canonical `lift` / 100, default 0.22), stationery dwell amount
//  min(0.9, amount * 8 * HOST_DT_SECONDS) — Engine.ts:1526, 1651,
//  1658, 1710.
//
//  261028-k03b: the dab walk carries the unspent spacing across
//  recorded segments (the engine's Stroke.carry). Restarting per
//  segment skipped the first dab of every short segment, so the
//  punch erased less than the live pass.
//
//  Declared approximations (do not "fix" them here):
//   - the dab source is the RECORDED 60 Hz tick grid only (never
//     the live sample stream): that is what a re-bake replays;
//   - the stationery dwell amount assumes a 60 Hz host
//     (HOST_DT_SECONDS) while the engine clamps its dt to
//     1/240..1/30 — on another refresh rate a hold-and-lift erases
//     up to 2x harder than the live pass;
//   - a pressure sentinel (p < 0) is treated as 0.45.
// ============================================================

import { buildBrushForStroke, toEngineParams, type Rotation } from '@efxlab/efx-watercolor';
import type { AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import { encodeRotoFrameFromCanvas } from './rotoCanvasFrames';

/** The adapter's host tick grid — engineAdapter.ts:45-47. */
export const HOST_DT_SECONDS = 1 / 60;

/** Vendor lift footprint law — Engine.ts:1526. */
const LIFT_SIZE_BASE = 0.012;
const LIFT_SIZE_PRESSURE = 0.03;
/** Dab spacing as a fraction of the footprint radius — Engine.ts:1651. */
const LIFT_SPACING_FRAC = 0.5;
/** Pre-strength moving dab amount; also the default when a stroke has no
 *  recorded `lift` key (Engine.ts:1658, 1716). */
const LIFT_MOVING_AMOUNT = 0.22;
/** The engine's own ceiling for a lift dab — Engine.ts:1716. */
const LIFT_MAX_AMOUNT = 0.9;
/** Recorded pressure sentinel fallback (declared approximation). */
const LIFT_PRESSURE_SENTINEL = 0.45;
/** Bounds a pathological stroke so the punch stays finite. */
const MAX_LIFT_DABS = 50_000;

/**
 * 261028-k03c: the tip-mask roundness the engine binds for Lift
 * (`Engine.lift` uniforms uRound = 0 — the tip fully shaves the silhouette).
 * Kept as a constant so the punch mirrors the shader.
 */
export const LIFT_TIP_ROUND = 0;

const DEG = Math.PI / 180;

/**
 * The footprint the punch reproduces: the RECORDED brush's tip data, aspect,
 * rotation and preset angle. Anything the engine bound at draw time is derived
 * from the same `buildBrushForStroke` call, so a bake punch and the live erase
 * share one shape (buildBrush seeds from the preset id → deterministic).
 */
export interface LiftFootprintShape {
  tipData: Uint8Array;
  tipSize: number;
  aspect: number;
  angle: number;
  rotation: Rotation;
}

/**
 * Resolve a recorded stroke's `brushId`/`toolOverrides` into the punch shape.
 * `angle` is the preset angle in radians (y up) — the fallback of the
 * fixed-rotation branch, exactly like `Engine.brushAngle`.
 */
export function liftShapeForStroke(
  stroke: Pick<AquarelleStroke, 'brushId' | 'toolOverrides'>,
): LiftFootprintShape {
  const brush = buildBrushForStroke(stroke.brushId || 'filbert', stroke.toolOverrides);
  return {
    tipData: brush.tipData,
    tipSize: brush.tipSize,
    aspect: brush.aspect,
    angle: brush.angle * DEG,
    rotation: brush.rotation,
  };
}

/** One lift dab in document UV (y up); `r` is in document heights. */
export interface LiftDab {
  x: number;
  y: number;
  r: number;
  amount: number;
  /** 261028-k03c: tip angle in radians (y up — the engine's uAxis angle). */
  angle?: number;
}

export interface LiftEraseSize {
  width: number;
  height: number;
}

/** Pixel rect the coverage map covers: origin + extents, top-left origin. */
export interface LiftCoverageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LiftCoverage {
  /** Per-pixel transmittance exponent K = PROD(1 - f_i); 1 = untouched. */
  coverage: Float32Array;
  coverageRect: LiftCoverageRect;
}

export interface PunchedTransmittance {
  bytes: Uint8Array;
  canvas: HTMLCanvasElement;
}

export interface LiftEraseCodec {
  decode(bytes: Uint8Array, size: LiftEraseSize): Promise<HTMLCanvasElement | null>;
  encode(canvas: HTMLCanvasElement, size: LiftEraseSize, appFrame: number): Promise<Uint8Array>;
}

export interface LiftErasePunchOptions {
  appFrame: number;
  /** 261028-k03c: the recorded brush's tip footprint (live/punch parity). */
  shape?: LiftFootprintShape;
  /** Injected legs for tests; production uses DEFAULT_LIFT_ERASE_CODEC. */
  codec?: Partial<LiftEraseCodec>;
}

function normalizePressure(p: number | undefined): number {
  if (typeof p !== 'number' || !Number.isFinite(p) || p < 0) return LIFT_PRESSURE_SENTINEL;
  return p > 1 ? 1 : p;
}

/**
 * The stroke's recorded tick-grid dabs, in UV (y up), radius in document
 * heights. This mirrors the engine's own stamp law for tool 'lift': a dab
 * per 0.5 * r of aspect-corrected arc length with linearly interpolated
 * pressure, plus the first point and one stationery dab per zero-length step.
 */
export function collectLiftDabs(
  stroke: Pick<AquarelleStroke, 'points' | 'params'>,
  size: LiftEraseSize,
  shape?: LiftFootprintShape,
): LiftDab[] {
  const points = stroke.points ?? [];
  if (points.length === 0) return [];

  const engine = toEngineParams(stroke.params);
  const engineSize =
    typeof engine.size === 'number' && Number.isFinite(engine.size) ? engine.size : 0.375;
  const sizeMult = Math.pow(3, (engineSize - 0.5) * 2);
  const aspect = size.width > 0 && size.height > 0 ? size.width / size.height : 1;
  // 261028-k03b: the same strength the engine and the bake use. A stroke
  // recorded before the setting has no key → 0.22, its exact old erase.
  const movingAmount = Math.min(
    LIFT_MAX_AMOUNT,
    typeof engine.lift === 'number' && Number.isFinite(engine.lift) ? engine.lift : LIFT_MOVING_AMOUNT,
  );
  const dwellAmount = Math.min(LIFT_MAX_AMOUNT, movingAmount * 8 * HOST_DT_SECONDS);

  const radiusAt = (pressure: number | undefined): number =>
    (LIFT_SIZE_BASE + LIFT_SIZE_PRESSURE * normalizePressure(pressure)) * sizeMult;

  // 261028-k03c: mirror Engine.brushAngle for every dab. Stroke.azimuth is
  // STICKY in the engine and is scanned in processInput BEFORE the point's
  // stamps, so the tilt of point i also governs the segment ending on it.
  let azimuth: number | null = null;
  const scanTilt = (p: AquarelleStroke['points'][number]): void => {
    if (Math.hypot(p.tx, p.ty) > 12) azimuth = Math.atan2(-p.ty, p.tx);
  };
  // follow reads the engine's smoothed s.dx/s.dy; the punch replays the raw
  // segment direction (declared approximation — the smoothing is not recorded).
  let segmentAngle = 0;
  const dabAngle = (): number => {
    if (!shape) return 0;
    if (shape.rotation === 'follow') return segmentAngle + shape.angle;
    if (shape.rotation === 'random') return shape.angle;
    return azimuth ?? shape.angle;
  };

  const dabs: LiftDab[] = [];

  const first = points[0];
  if (first) {
    scanTilt(first);
    dabs.push({
      x: first.x,
      y: first.y,
      r: radiusAt(first.p),
      amount: movingAmount,
      angle: dabAngle(),
    });
  }

  // 261028-k03b: the engine carries the unspent spacing across every trace
  // segment (Stroke.carry). Restarting at 0 per recorded sample skipped the
  // first dab of every short segment, so the punch erased visibly less than
  // the live pass — the "very soft" lift. Mirror the carry.
  let carry = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    scanTilt(b);
    const dx = (b.x - a.x) * aspect;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length > 1e-9) segmentAngle = Math.atan2(dy, dx);

    // Standing still: the engine stamps one dwell dab per resting tick.
    if (length <= 1e-9) {
      if (dabs.length >= MAX_LIFT_DABS) return dabs;
      dabs.push({
        x: b.x,
        y: b.y,
        r: radiusAt(b.p),
        amount: dwellAmount,
        angle: dabAngle(),
      });
      // A dwell neither spends nor resets the travel carry.
      continue;
    }

    let pos = 0;
    let guard = 0;
    while (guard < MAX_LIFT_DABS) {
      guard += 1;
      const u = Math.min(1, pos / length);
      const spacing = LIFT_SPACING_FRAC * radiusAt(a.p + (b.p - a.p) * u);
      if (!(spacing > 1e-9)) break;
      const advance = spacing - carry;
      if (advance <= 0) {
        carry = 0;
        continue;
      }
      if (pos + advance > length) break;
      pos += advance;
      carry = 0;
      if (dabs.length >= MAX_LIFT_DABS) return dabs;
      const t = pos / length;
      dabs.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        r: radiusAt(a.p + (b.p - a.p) * t),
        amount: movingAmount,
        angle: dabAngle(),
      });
    }
    carry += length - pos;
  }

  return dabs;
}

/**
 * One bilinear tap of the tip texture, mirroring GL_LINEAR + CLAMP_TO_EDGE on
 * texel centres `(i + 0.5) / size`. `qx`/`qy` are the shader's tip-space
 * coordinates (-1..1 maps onto the square); the value is normalised to 0..1.
 */
function sampleTipBilinear(
  tipData: Uint8Array,
  tipSize: number,
  qx: number,
  qy: number,
): number {
  const u = Math.min(1, Math.max(0, qx * 0.5 + 0.5));
  const v = Math.min(1, Math.max(0, qy * 0.5 + 0.5));
  const fx = u * tipSize - 0.5;
  const fy = v * tipSize - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const clampIndex = (i: number): number => (i < 0 ? 0 : i >= tipSize ? tipSize - 1 : i);
  const xa = clampIndex(x0);
  const xb = clampIndex(x0 + 1);
  const ya = clampIndex(y0);
  const yb = clampIndex(y0 + 1);
  const p00 = tipData[ya * tipSize + xa] ?? 0;
  const p10 = tipData[ya * tipSize + xb] ?? 0;
  const p01 = tipData[yb * tipSize + xa] ?? 0;
  const p11 = tipData[yb * tipSize + xb] ?? 0;
  const top = p00 + (p10 - p00) * tx;
  const bottom = p01 + (p11 - p01) * tx;
  return (top + (bottom - top) * ty) / 255;
}

/**
 * The per-pixel K map, allocated ONLY over the union bbox of the dabs so the
 * punch leaves every other pixel byte-identical. UV is y-up, the canvas is
 * top-down, and the radius converts as r * height on BOTH axes (the shader
 * divides x by uAspect).
 *
 * 261028-k03c: with a `shape`, the footprint mirrors `liftFS` — the tip square
 * (-1..1) is rotated by the dab angle, squeezed to the brush aspect, and
 * multiplied by the bilinearly sampled tip mask; pixels outside the square are
 * discarded (untouched). Without it, the pre-k03c radial law is byte-identical.
 */
export function buildLiftCoverage(
  dabs: readonly LiftDab[],
  width: number,
  height: number,
  shape?: LiftFootprintShape,
): LiftCoverage {
  const empty: LiftCoverage = {
    coverage: new Float32Array(1).fill(1),
    coverageRect: { x: 0, y: 0, width: 0, height: 0 },
  };
  if (dabs.length === 0 || width <= 0 || height <= 0) return empty;

  const placed = dabs.map((one) => ({
    cx: one.x * width,
    cy: (1 - one.y) * height,
    rPx: Math.max(1, one.r * height),
    amount: one.amount,
    angle: one.angle ?? 0,
  }));
  // The discard square's corners sit at r * sqrt(1 + aspect²) from the centre;
  // the old radial law's reach was r (+1 px of anti-alias slack).
  const margin = shape ? Math.sqrt(1 + shape.aspect * shape.aspect) : 1;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const one of placed) {
    const reach = one.rPx * margin + 1;
    const x0 = Math.max(0, Math.floor(one.cx - reach));
    const x1 = Math.min(width - 1, Math.ceil(one.cx + reach));
    const y0 = Math.max(0, Math.floor(one.cy - reach));
    const y1 = Math.min(height - 1, Math.ceil(one.cy + reach));
    if (x1 < x0 || y1 < y0) continue;
    minX = Math.min(minX, x0);
    maxX = Math.max(maxX, x1);
    minY = Math.min(minY, y0);
    maxY = Math.max(maxY, y1);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || maxX < minX || maxY < minY) return empty;

  const coverageRect: LiftCoverageRect = {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
  const coverage = new Float32Array(coverageRect.width * coverageRect.height).fill(1);

  for (const one of placed) {
    const reach = one.rPx * margin + 1;
    const x0 = Math.max(0, Math.floor(one.cx - reach));
    const x1 = Math.min(width - 1, Math.ceil(one.cx + reach));
    const y0 = Math.max(0, Math.floor(one.cy - reach));
    const y1 = Math.min(height - 1, Math.ceil(one.cy + reach));
    const r2 = one.rPx * one.rPx;
    const cos = Math.cos(one.angle);
    const sin = Math.sin(one.angle);
    for (let y = y0; y <= y1; y += 1) {
      // Doc y is up, canvas rows go down: the offset flips sign here.
      const dyUp = one.cy - y;
      for (let x = x0; x <= x1; x += 1) {
        const dx = x - one.cx;
        let f: number;
        if (shape) {
          const along = (dx * cos + dyUp * sin) / one.rPx;
          const across = ((-dx * sin + dyUp * cos) / one.rPx) / shape.aspect;
          // liftFS: outside the tip square the dab is discarded.
          if (Math.abs(along) > 1 || Math.abs(across) > 1) continue;
          const d = along * along + across * across;
          const mask = sampleTipBilinear(shape.tipData, shape.tipSize, along, across);
          f = one.amount * Math.exp(-(d * d)) * (mask * (1 - LIFT_TIP_ROUND) + LIFT_TIP_ROUND);
        } else {
          const q = (dx * dx + dyUp * dyUp) / r2;
          f = one.amount * Math.exp(-(q * q));
        }
        const index = (y - coverageRect.y) * coverageRect.width + (x - coverageRect.x);
        coverage[index] *= 1 - f;
      }
    }
  }

  return { coverage, coverageRect };
}

function srgbToLinear(byte: number): number {
  const c = byte / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgbByte(linear: number): number {
  const c = linear <= 0.0031308 ? linear * 12.92 : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
  const byte = Math.round(c * 255);
  return byte < 0 ? 0 : byte > 255 ? 255 : byte;
}

function punchChannel(byte: number, k: number): number {
  return linearToSrgbByte(Math.pow(srgbToLinear(byte), k));
}

/**
 * Apply t' = t^K per colour channel in LINEAR light over `coverageRect` only.
 * Alpha is never written; a pixel no dab touches stays byte-identical.
 */
export function punchTransmittanceRgba(
  rgba: Uint8ClampedArray,
  coverage: Float32Array,
  width: number,
  height: number,
  coverageRect: LiftCoverageRect,
): void {
  if (coverageRect.width <= 0 || coverageRect.height <= 0) return;
  const x0 = Math.max(0, coverageRect.x);
  const y0 = Math.max(0, coverageRect.y);
  const x1 = Math.min(width, coverageRect.x + coverageRect.width);
  const y1 = Math.min(height, coverageRect.y + coverageRect.height);
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const k = coverage[(y - coverageRect.y) * coverageRect.width + (x - coverageRect.x)];
      // K >= 1 (or an unusable value) leaves the pixel untouched.
      if (!(typeof k === 'number') || !(k < 1) || k < 0) continue;
      const index = (y * width + x) * 4;
      rgba[index] = punchChannel(rgba[index], k);
      rgba[index + 1] = punchChannel(rgba[index + 1], k);
      rgba[index + 2] = punchChannel(rgba[index + 2], k);
    }
  }
}

function canvasDocumentFor(source: HTMLCanvasElement): Document | null {
  const owner = (source as { ownerDocument?: Document | null }).ownerDocument;
  if (owner) return owner;
  return typeof document !== 'undefined' ? document : null;
}

/**
 * The punched copy of `source`. Never mutates the source: the live display may
 * share it. Returns null when a 2D readback or target canvas is unavailable.
 */
export function punchTransmittanceCanvas(
  source: HTMLCanvasElement,
  dabs: readonly LiftDab[],
  shape?: LiftFootprintShape,
): HTMLCanvasElement | null {
  const width = Math.max(0, Math.round(source.width));
  const height = Math.max(0, Math.round(source.height));
  if (width <= 0 || height <= 0) return null;
  const sourceContext = source.getContext('2d', { willReadFrequently: true });
  if (!sourceContext) return null;

  let image: ImageData;
  try {
    image = sourceContext.getImageData(0, 0, width, height);
  } catch {
    return null;
  }

  const documentForTarget = canvasDocumentFor(source);
  if (!documentForTarget) return null;
  const target = documentForTarget.createElement('canvas');
  target.width = width;
  target.height = height;
  const targetContext = target.getContext('2d', { willReadFrequently: true });
  if (!targetContext) return null;

  const { coverage, coverageRect } = buildLiftCoverage(dabs, width, height, shape);
  punchTransmittanceRgba(image.data, coverage, width, height, coverageRect);
  targetContext.putImageData(image, 0, 0);
  return target;
}

async function decodeLiftEraseFrame(
  bytes: Uint8Array,
  size: LiftEraseSize,
): Promise<HTMLCanvasElement | null> {
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return null;
  const bitmap = await createImageBitmap(
    new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/webp' }),
    { premultiplyAlpha: 'premultiply' },
  );
  try {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(size.width));
    canvas.height = Math.max(1, Math.round(size.height));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    bitmap.close?.();
  }
}

async function encodeLiftEraseFrame(
  canvas: HTMLCanvasElement,
  size: LiftEraseSize,
  appFrame: number,
): Promise<Uint8Array> {
  // 261028-k03: encodeRotoFrameFromCanvas returns a PROMISE — reading .bytes
  // off it would yield undefined and silently no-op every production punch.
  const payload = await encodeRotoFrameFromCanvas(canvas, appFrame, size);
  return payload.bytes;
}

/** The production codec (decode WebP → punch → encode WebP). */
export const DEFAULT_LIFT_ERASE_CODEC: LiftEraseCodec = {
  decode: decodeLiftEraseFrame,
  encode: encodeLiftEraseFrame,
};

/**
 * Decode → punch → encode the stored transmittance bytes. Both codec legs are
 * awaited; the caller's bytes are copied and never mutated. Returns null when
 * the punch cannot produce pixels.
 */
export async function punchTransmittanceBytes(
  bytes: Uint8Array,
  size: LiftEraseSize,
  dabs: readonly LiftDab[],
  options: LiftErasePunchOptions,
): Promise<PunchedTransmittance | null> {
  const decode = options.codec?.decode ?? DEFAULT_LIFT_ERASE_CODEC.decode;
  const encode = options.codec?.encode ?? DEFAULT_LIFT_ERASE_CODEC.encode;
  // Copy before a Blob ever sees the caller's buffer.
  const input = new Uint8Array(bytes);
  try {
    const source = await decode(input, size);
    if (!source) return null;
    if (dabs.length === 0) {
      const encoded = await encode(source, size, options.appFrame);
      return encoded && encoded.length > 0 ? { bytes: encoded, canvas: source } : null;
    }
    const punched = punchTransmittanceCanvas(source, dabs, options.shape);
    if (!punched) return null;
    const encoded = await encode(punched, size, options.appFrame);
    if (!encoded || encoded.length === 0) return null;
    return { bytes: encoded, canvas: punched };
  } catch {
    return null;
  }
}
