// ============================================================
//  Trace seed — deterministic per-stroke seeded draws for the
//  deposit-time bristle pass (260928-dh1).
//  FNV-1a over the mutation id (recordedStrokeMotion hashStroke
//  precedent: offset 2166136261, prime 16777619).
//  Draws are keyed by (strokeSeed, arcLength, drawKey) — arc-length,
//  NOT sample index, keeps noise stable across resample/chunking
//  (locked determinism decision: replay regenerates identical traces).
//  No non-deterministic source in this module (replay determinism law).
// ============================================================

import { fbm } from './noise'

/** FNV-1a over a string — offset 2166136261, prime 16777619. */
export function fnv1a(source: string): number {
  let hash = 2166136261
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** Avalanche mixer — decorrelates nearby FNV outputs. */
function avalanche(hash: number): number {
  let h = hash >>> 0
  h ^= h >>> 15
  h = Math.imul(h, 2246822519)
  h ^= h >>> 13
  h = Math.imul(h, 3266489917)
  h ^= h >>> 16
  return h >>> 0
}

/**
 * Stroke seed from the mutation id. Falls back to a fixed seed when the
 * stroke carries no mutationId (loaded-from-disk strokes) — same fixed
 * pattern, same as any fixed-seed brush parameter.
 *
 * Accepts a string key so disk serialize can seed per stroke index
 * (`hashMutationId(mutationId ?? String(strokeIndex))`, D-25 / 55-05).
 */
export function hashMutationId(mutationId: number | string | undefined): number {
  return avalanche(fnv1a(`mutation:${mutationId ?? 0}`))
}

/**
 * 261030-v1t: per-output-frame paint salt. The aquarelle engine draws every
 * stochastic paint channel (dab scatter, tip angle/jitter, spatter, granulation)
 * from ONE per-stroke RNG; mixing the stroke seed with the local output frame
 * re-patterns that texture frame to frame while the deposited geometry (points,
 * pressure, timing) stays untouched.
 *
 * Pure and total: a domain-separated FNV-1a over (uint32 base, truncated frame),
 * avalanched. Same script + option + frame always reproduces the pixels — never
 * Math.random, never the clock, never module state, and the salted seed is never
 * persisted (the persisted flag is the plain boolean).
 */
export function mixStrokeSeed(strokeSeed: number, frame: number): number {
  const base = Number.isFinite(strokeSeed) ? strokeSeed >>> 0 : 0
  const local = Number.isFinite(frame) ? Math.trunc(frame) : 0
  return avalanche(fnv1a(`paint-seed:${base}:${local}`))
}

/**
 * Deterministic sequential rng (mulberry32) keyed by (strokeSeed, streamKey).
 * R10 (260930-detail): the deform path's ONLY randomness source — the
 * held-pose determinism law forbids `Math.random` there. The stream key
 * separates roles ('shape-detail' vs 'erase-shape') so erase never lands
 * on the painted mark's pattern (R4).
 */
export function seededRng(strokeSeed: number, streamKey: string): () => number {
  let a = avalanche(fnv1a(`${strokeSeed}|${streamKey}`))
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Arc-length slot format — 4 decimals so identical physical positions
 *  map to identical keys after resample/chunking. */
export function arcSlot(arcLength: number): string {
  return `a${(Number.isFinite(arcLength) ? arcLength : 0).toFixed(4)}`
}

/**
 * Deterministic draw in [0,1) keyed by (strokeSeed, slot, drawKey).
 * slot is a pre-formatted key segment: arcSlot(arcLength) for
 * per-sample draws, `b${bristleIndex}` for per-bristle parameters.
 */
export function seededDraw(strokeSeed: number, slot: string, drawKey: string): number {
  const h = avalanche(fnv1a(`${strokeSeed}|${slot}|${drawKey}`))
  return h / 4294967296
}

/** Deterministic draw in [min, max). */
export function seededRange(
  strokeSeed: number,
  slot: string,
  drawKey: string,
  min: number,
  max: number,
): number {
  return min + seededDraw(strokeSeed, slot, drawKey) * (max - min)
}

/**
 * Deterministic fbm shape noise in [0,1] keyed by (seed, arc-length,
 * bristle, channel). Channel separates width vs alpha modulation so the
 * two shape parameters are independent fields; both vary along the stroke
 * (arc-length x) and per bristle (index y), and both shift with the seed.
 * Source: util/noise.ts fbm (deterministic value-noise FBM).
 */
export function traceShapeNoise(
  strokeSeed: number,
  arcLength: number,
  bristleIndex: number,
  channel: number,
): number {
  const ox = (strokeSeed & 0xffff) * 0.0173
  const oy = ((strokeSeed >>> 16) & 0xffff) * 0.0239
  return fbm(
    arcLength * 0.05 + channel * 17.31 + ox,
    bristleIndex * 7.13 + oy + channel * 31.7,
    3,
  )
}
