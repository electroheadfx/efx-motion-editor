import type { Keyframe, KeyframeValues, EasingType } from '../types/layer';
import { extractKeyframeValues } from '../types/layer';

// Re-export extractKeyframeValues for convenience
export { extractKeyframeValues };

/**
 * Apply an easing function to a normalized time value (0..1).
 * Uses polynomial cubic curves for predictable animation behavior.
 */
export function applyEasing(t: number, easing: EasingType): number {
  switch (easing) {
    case 'linear':
      return t;
    case 'ease-in':
      // Cubic ease-in: t^3
      return t * t * t;
    case 'ease-out':
      // Cubic ease-out: 1 - (1-t)^3
      const inv = 1 - t;
      return 1 - inv * inv * inv;
    case 'ease-in-out':
      // Piecewise cubic: slow start + slow end, symmetric at 0.5
      if (t < 0.5) {
        return 4 * t * t * t;
      } else {
        const p = -2 * t + 2;
        return 1 - (p * p * p) / 2;
      }
    default:
      return t;
  }
}

/** Linear interpolation between two numbers */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpolate source overrides between two KeyframeValues */
function lerpSourceOverrides(
  a: Record<string, number> | undefined,
  b: Record<string, number> | undefined,
  t: number,
): Record<string, number> | undefined {
  if (!a && !b) return undefined;
  if (a && !b) return { ...a };
  if (!a && b) return { ...b };
  // Both exist: lerp shared keys, copy unique keys from each side
  const result: Record<string, number> = {};
  const allKeys = new Set([...Object.keys(a!), ...Object.keys(b!)]);
  for (const key of allKeys) {
    if (key in a! && key in b!) {
      result[key] = lerp(a![key], b![key], t);
    } else if (key in a!) {
      result[key] = a![key];
    } else {
      result[key] = b![key];
    }
  }
  return result;
}

/** Interpolate all animatable properties between two KeyframeValues */
export function lerpValues(a: KeyframeValues, b: KeyframeValues, t: number): KeyframeValues {
  const result: KeyframeValues = {
    opacity: lerp(a.opacity, b.opacity, t),
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    scaleX: lerp(a.scaleX, b.scaleX, t),
    scaleY: lerp(a.scaleY, b.scaleY, t),
    rotation: lerp(a.rotation, b.rotation, t),
    blur: lerp(a.blur, b.blur, t),
  };
  const so = lerpSourceOverrides(a.sourceOverrides, b.sourceOverrides, t);
  if (so) result.sourceOverrides = so;
  return result;
}

// Reusable result object for the mutable interpolation path (avoids GC during playback)
const _mutableResult: KeyframeValues = {
  opacity: 0, x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, blur: 0,
};
let _mutableSourceOverrides: Record<string, number> = {};

/** Copy sourceOverrides from keyframe values into the mutable result */
function _copySourceOverrides(v: KeyframeValues): void {
  if (v.sourceOverrides) {
    _mutableSourceOverrides = { ...v.sourceOverrides };
    _mutableResult.sourceOverrides = _mutableSourceOverrides;
  } else {
    _mutableResult.sourceOverrides = undefined;
  }
}

/** Internal mutable interpolation (reuses object, NOT safe to store the return value) */
function _interpolateAtMutable(keyframes: Keyframe[], frame: number): KeyframeValues | null {
  const len = keyframes.length;
  if (len === 0) return null;

  // Single keyframe or before first: hold first values
  if (len === 1 || frame <= keyframes[0].frame) {
    const v = keyframes[0].values;
    _mutableResult.opacity = v.opacity;
    _mutableResult.x = v.x;
    _mutableResult.y = v.y;
    _mutableResult.scaleX = v.scaleX;
    _mutableResult.scaleY = v.scaleY;
    _mutableResult.rotation = v.rotation;
    _mutableResult.blur = v.blur;
    _copySourceOverrides(v);
    return _mutableResult;
  }

  // After last: hold last values
  const last = keyframes[len - 1];
  if (frame >= last.frame) {
    const v = last.values;
    _mutableResult.opacity = v.opacity;
    _mutableResult.x = v.x;
    _mutableResult.y = v.y;
    _mutableResult.scaleX = v.scaleX;
    _mutableResult.scaleY = v.scaleY;
    _mutableResult.rotation = v.rotation;
    _mutableResult.blur = v.blur;
    _copySourceOverrides(v);
    return _mutableResult;
  }

  // Between two keyframes: find surrounding pair
  for (let i = 0; i < len - 1; i++) {
    const prev = keyframes[i];
    const next = keyframes[i + 1];
    if (frame >= prev.frame && frame <= next.frame) {
      const span = next.frame - prev.frame;
      const rawT = span === 0 ? 0 : (frame - prev.frame) / span;
      const t = applyEasing(rawT, prev.easing);
      _mutableResult.opacity = lerp(prev.values.opacity, next.values.opacity, t);
      _mutableResult.x = lerp(prev.values.x, next.values.x, t);
      _mutableResult.y = lerp(prev.values.y, next.values.y, t);
      _mutableResult.scaleX = lerp(prev.values.scaleX, next.values.scaleX, t);
      _mutableResult.scaleY = lerp(prev.values.scaleY, next.values.scaleY, t);
      _mutableResult.rotation = lerp(prev.values.rotation, next.values.rotation, t);
      _mutableResult.blur = lerp(prev.values.blur, next.values.blur, t);
      // Lerp source overrides
      const so = lerpSourceOverrides(prev.values.sourceOverrides, next.values.sourceOverrides, t);
      _mutableResult.sourceOverrides = so;
      return _mutableResult;
    }
  }

  return null;
}

/**
 * Interpolate keyframe values at a given sequence-local frame position.
 *
 * - Empty array -> null
 * - Single keyframe -> return its values
 * - Before first -> hold first values
 * - After last -> hold last values
 * - Between two -> find surrounding pair, normalize t, apply easing, lerp values
 *
 * Returns a fresh object (safe to store). For hot paths during playback,
 * use the internal _interpolateAtMutable variant.
 */
export function interpolateAt(keyframes: Keyframe[], frame: number): KeyframeValues | null {
  const result = _interpolateAtMutable(keyframes, frame);
  if (result === null) return null;
  // Return a fresh copy (the mutable result is reused across calls)
  const copy: KeyframeValues = {
    opacity: result.opacity,
    x: result.x,
    y: result.y,
    scaleX: result.scaleX,
    scaleY: result.scaleY,
    rotation: result.rotation,
    blur: result.blur,
  };
  if (result.sourceOverrides) {
    copy.sourceOverrides = { ...result.sourceOverrides };
  }
  return copy;
}
