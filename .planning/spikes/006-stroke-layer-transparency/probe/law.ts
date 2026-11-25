// ============================================================
//  SPIKE 006 — the stroke-layer composite LAW, and the encoders that
//  must land it back into a 7-coefficient sheet.
//
//  SCRATCH HARNESS ONLY. Nothing here is imported by the package.
//
//  WHAT IS PROVEN WHERE
//  --------------------
//  `bandsOf` is a line-by-line mirror of `displayBasisGLSL()`
//  (packages/efx-watercolor/src/playground/spectral.ts) over the SAME
//  exported constants (BASIS, DISPLAY_BANDS, DISPLAY_RGB_WEIGHTS). It is
//  NOT taken on trust: probe.ts uploads a grid of random states into the
//  real engine, exports them through the real `displayFS`, and requires
//  the mirror to reproduce the export within 1/255. That gate is the
//  evidence; the mirror is only a fast way to evaluate the same law
//  exhaustively afterwards.
//
//  THE TWO COMPOSITE LAWS
//  ----------------------
//  L-band  (the law this spike recommends)
//      band_out,i = A·band_L,i + (1 - A)·band_S,i
//      `band_*` is the DISPLAY band value (reflectance over white), so
//      this is the area mix of a partially-covered texel: a fraction A of
//      the area carries the stroke, the rest the base. Over white
//      (band_S = 1) it gives darkness_out = A·darkness_L — exactly
//      "a 50 % layer over white reads 50 % darkness". It is a convex
//      combination, so every band lies strictly BETWEEN the two inputs by
//      construction: it can never be paler than both (the pale-band
//      failure of the six rejected laws) at any A.
//
//  L-exp   (DESIGN-stroke-layer-transparency.md §3.3, literal)
//      t_i   = exp(-k_i) for the legacy branch (the KM branch has no
//              exp(-k); design §3.3 does not address it)
//      t_out = A·t_L + (1 - A)·t_S ;  k_out = -ln(t_out)
//      Identical to L-band when the medium scatters nothing. It diverges
//      on Gouache (Body > 0), which is the branch the artist actually
//      paints with — measured here as the design's own risk.
//
//  THE ALPHA GATE
//  --------------
//  `A` alone erases the base wherever the layer holds no paint (a bristle
//  gap reads t_L = 1, so t_out = A + (1-A)·t_S != t_S when A > 0). The
//  design names this gate only for the cover channel (`cover_out` uses
//  `A · cover_L`) and omits it from the transmittance mix, which at
//  amount 0 would erase the base under every bristle gap. Both forms are
//  measured:
//    gated   A_eff = A · cover_L      (recommended)
//    literal A_eff = A                (design §3.3 as written)
// ============================================================

import { BASIS, DISPLAY_BANDS, DISPLAY_RGB_WEIGHTS } from '../../../../packages/efx-watercolor/src/playground/spectralData'
import { SCATTER_EPSILON } from '../../../../packages/efx-watercolor/src/playground/scattering'

export const BANDS = DISPLAY_BANDS.length

/** One texel's absorbance state: 4 + 3 coefficients and the scattering S. */
export interface State {
  a: Float64Array // coefficients 0..3
  b: Float64Array // coefficients 4..6
  s: number       // scattering S
}

export function makeState(a: ArrayLike<number>, b: ArrayLike<number>, s: number): State {
  return { a: Float64Array.from(a), b: Float64Array.from(b), s }
}

export function zeroState(): State {
  return { a: new Float64Array(4), b: new Float64Array(3), s: 0 }
}

/** `dot(a, basisBand) + dot(b, basisBand)` — the shader's per-band absorbance. */
export function bandAbsorbance(state: State, i: number): number {
  const band = DISPLAY_BANDS[i]!
  let v = 0
  for (let k = 0; k < 4; k++) v += state.a[k]! * BASIS[k]![band]!
  for (let k = 4; k < 7; k++) v += state.b[k - 4]! * BASIS[k]![band]!
  return v
}

/**
 * The display band value for band `i`, mirroring `displayBasisGLSL()`:
 * `exp(-max(A,0))` below the scatter epsilon, the Kubelka-Munk reflectance
 * over white above it. Both blocks are transcribed from the shipped source.
 */
export function bandValue(state: State, i: number): number {
  const A = bandAbsorbance(state, i)
  const k = 0.5 * Math.max(A, 0)
  if (state.s > SCATTER_EPSILON) {
    if (k <= 0) return 1
    const arg = Math.sqrt(k * (2 * state.s + k))
    const e = Math.exp(-2 * arg)
    const sh = 0.5 * (1 - e)
    const ch = 0.5 * (1 + e)
    const den = (k + state.s) * sh + arg * ch
    const R = (state.s * sh) / den
    const T = (arg * Math.sqrt(e)) / den
    const om = (k * sh + arg * ch) / den
    return R + (T * T) / om
  }
  return Math.exp(-Math.max(A, 0))
}

/** The KM branch's own layer transmittance `kmT` (the legacy branch's `exp(-k)`). */
export function bandTransmittance(state: State, i: number): number {
  const A = bandAbsorbance(state, i)
  const k = 0.5 * Math.max(A, 0)
  if (state.s > SCATTER_EPSILON) {
    if (k <= 0) return 1
    const arg = Math.sqrt(k * (2 * state.s + k))
    const e = Math.exp(-2 * arg)
    const sh = 0.5 * (1 - e)
    const ch = 0.5 * (1 + e)
    const den = (k + state.s) * sh + arg * ch
    return (arg * Math.sqrt(e)) / den
  }
  return Math.exp(-Math.max(A, 0))
}

export function bandsOf(state: State): Float64Array {
  const out = new Float64Array(BANDS)
  for (let i = 0; i < BANDS; i++) out[i] = bandValue(state, i)
  return out
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const compand = (x: number) => (x < 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055)

/**
 * `Σ band_i · w_i` in LINEAR sRGB — the shader's `rgb` before `toSRGB`.
 * Alpha compositing lives here: because the weights are linear, a mix of two
 * layers in band space is exactly a mix of their `bandRgbLinear` values.
 * The sRGB "darkness" metric (1 - min) is companded and does NOT halve under
 * a 50 % linear mix; any 50 % check must be made in this space.
 */
export function bandRgbLinear(bands: ArrayLike<number>): [number, number, number] {
  const lin = [0, 0, 0]
  for (let i = 0; i < BANDS; i++) {
    const w = DISPLAY_RGB_WEIGHTS[i]!
    const v = bands[i]!
    lin[0]! += v * w[0]!
    lin[1]! += v * w[1]!
    lin[2]! += v * w[2]!
  }
  return lin as [number, number, number]
}

/** The same, through the shader's `toSRGB`, then 8-bit. */
export function bandRgb8(bands: ArrayLike<number>): [number, number, number] {
  return bandRgbLinear(bands).map((c) => Math.round(clamp01(compand(clamp01(c))) * 255)) as [number, number, number]
}

export function stateRgb8(state: State): [number, number, number] {
  return bandRgb8(bandsOf(state))
}

// --- the composite laws -----------------------------------------------------

export interface Target {
  bands: Float64Array
  rgb8: [number, number, number]
}

/** L-band: the area mix of the two display bands. */
export function targetBand(layer: State, base: State, alpha: number): Target {
  const bands = new Float64Array(BANDS)
  for (let i = 0; i < BANDS; i++) bands[i] = alpha * bandValue(layer, i) + (1 - alpha) * bandValue(base, i)
  return { bands, rgb8: bandRgb8(bands) }
}

/**
 * L-exp: DESIGN §3.3 literal — mix the transmittances, `k_out = -ln(t_out)`.
 * The band value the merged sheet will display is `exp(-max(k_out, 0))`, i.e.
 * the clamped mix itself (both inputs are <= 1, so the clamp is inert).
 */
export function targetExp(layer: State, base: State, alpha: number): Target {
  const bands = new Float64Array(BANDS)
  for (let i = 0; i < BANDS; i++) {
    const t = alpha * bandTransmittance(layer, i) + (1 - alpha) * bandTransmittance(base, i)
    bands[i] = Math.min(Math.max(t, 0), 1)
  }
  return { bands, rgb8: bandRgb8(bands) }
}

/** The scatter the merged sheet carries (DESIGN §3.3's `S_out`). */
export function mixScatter(layer: State, base: State, alpha: number): number {
  return alpha * layer.s + (1 - alpha) * base.s
}

// --- the 7×16 pseudo-inverse ------------------------------------------------

let pinvCache: number[][] | null = null

/** `(B·Bᵀ)⁻¹·B` for `B[k][i] = BASIS[k][DISPLAY_BANDS[i]]`. */
export function pinv(): number[][] {
  if (pinvCache) return pinvCache
  const B: number[][] = Array.from({ length: 7 }, (_, k) => DISPLAY_BANDS.map((band) => BASIS[k]![band]!))
  // G = B·Bᵀ (7×7)
  const G: number[][] = Array.from({ length: 7 }, () => new Array(7).fill(0))
  for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
    let s = 0
    for (let t = 0; t < BANDS; t++) s += B[i]![t]! * B[j]![t]!
    G[i]![j] = s
  }
  const inv = invert(G)
  const P: number[][] = Array.from({ length: 7 }, () => new Array(BANDS).fill(0))
  for (let k = 0; k < 7; k++) for (let t = 0; t < BANDS; t++) {
    let s = 0
    for (let j = 0; j < 7; j++) s += inv[k]![j]! * B[j]![t]!
    P[k]![t] = s
  }
  pinvCache = P
  return P
}

function invert(m: number[][]): number[][] {
  const n = m.length
  const A = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r]![col]!) > Math.abs(A[pivot]![col]!)) pivot = r
    ;[A[col], A[pivot]] = [A[pivot]!, A[col]!]
    const p = A[col]![col]!
    for (let c = 0; c < 2 * n; c++) A[col]![c] = A[col]![c]! / p
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = A[r]![col]!
      if (f === 0) continue
      for (let c = 0; c < 2 * n; c++) A[r]![c] = A[r]![c]! - f * A[col]![c]!
    }
  }
  return A.map((row) => row.slice(n))
}

/** Project 16 band absorbance values onto the 7 coefficients. */
export function project(bandAbsorbances: ArrayLike<number>): number[] {
  const P = pinv()
  const out = new Array(7).fill(0)
  for (let k = 0; k < 7; k++) {
    let s = 0
    for (let t = 0; t < BANDS; t++) s += P[k]![t]! * bandAbsorbances[t]!
    out[k] = s
  }
  return out
}

/** The naive encoder: `k_i = -ln(target_i)` then the 7×16 pseudo-inverse. */
export function encodePinv(target: Target, scatter: number): State {
  const k = new Float64Array(BANDS)
  for (let i = 0; i < BANDS; i++) k[i] = -Math.log(Math.max(target.bands[i]!, 1e-6))
  const c = project(k)
  return makeState(c.slice(0, 4), c.slice(4, 7), scatter)
}

// --- the bounded KM fit -----------------------------------------------------

export interface FitResult {
  state: State
  iterations: number
  /** max per-band residual after the fit, in 8-bit channel steps of the RGB sum. */
  residual8: number
}

/**
 * Levenberg–Marquardt on the 8 parameters (7 coefficients + S), fitting the
 * DISPLAY band values (so the forward model is the same `displayBasisGLSL`
 * the sheet will be read through). Numerical Jacobian; S held at >= 0.
 *
 * Bounds are deliberately loose on the coefficients — a real pigment's
 * coefficients are not sign-limited by the basis — and a runaway is caught by
 * the damping, not by a clamp.
 */
export function encodeFit(target: Target, scatter: number, seed?: State): FitResult {
  const x = new Float64Array(8)
  x[0] = seed?.a[0] ?? 0
  x[1] = seed?.a[1] ?? 0
  x[2] = seed?.a[2] ?? 0
  x[3] = seed?.a[3] ?? 0
  x[4] = seed?.b[0] ?? 0
  x[5] = seed?.b[1] ?? 0
  x[6] = seed?.b[2] ?? 0
  x[7] = seed?.s ?? scatter

  const n = 8
  const residual = (v: Float64Array, r: Float64Array) => {
    const st: State = { a: v.subarray(0, 4), b: v.subarray(4, 7), s: v[7]! }
    for (let i = 0; i < BANDS; i++) r[i] = bandValue(st, i) - target.bands[i]!
    return st
  }
  const r = new Float64Array(BANDS)
  residual(x, r)
  let cost = dot(r, r)

  const J = Array.from({ length: BANDS }, () => new Float64Array(n))
  const xp = new Float64Array(n)
  const rp = new Float64Array(BANDS)
  let lambda = 1e-3
  let iter = 0
  const maxIter = 40

  for (; iter < maxIter; iter++) {
    if (maxAbs(r) < 1e-5) break
    // numerical Jacobian (forward difference; the forward model is piecewise smooth)
    for (let p = 0; p < n; p++) {
      xp.set(x)
      const h = Math.max(1e-5, Math.abs(x[p]!) * 1e-4)
      xp[p] = x[p]! + h
      if (p === 7 && xp[7]! < 0) xp[7] = 0
      residual(xp, rp)
      const denom = xp[p]! - x[p]! || 1
      for (let i = 0; i < BANDS; i++) J[i]![p] = (rp[i]! - r[i]!) / denom
    }
    // normal equations (JᵀJ + λ·diag) δ = -Jᵀr
    const H = Array.from({ length: n }, () => new Float64Array(n))
    const g = new Float64Array(n)
    for (let i = 0; i < BANDS; i++) {
      const Ji = J[i]!
      for (let p = 0; p < n; p++) {
        g[p]! += Ji[p]! * r[i]!
        for (let q = 0; q < n; q++) H[p]![q]! += Ji[p]! * Ji[q]!
      }
    }
    let accepted = false
    for (let attempt = 0; attempt < 8 && !accepted; attempt++) {
      const M = H.map((row, i) => {
        const copy = Float64Array.from(row)
        copy[i] += lambda * (1 + Math.abs(copy[i]))
        return copy
      })
      const delta = solve(M, g.map((v) => -v))
      if (!delta) { lambda *= 10; continue }
      const xn = Float64Array.from(x)
      for (let p = 0; p < n; p++) xn[p]! += delta[p]!
      if (xn[7]! < 0) xn[7] = 0
      residual(xn, rp)
      const c2 = dot(rp, rp)
      if (c2 < cost) {
        x.set(xn)
        r.set(rp)
        cost = c2
        lambda = Math.max(lambda / 3, 1e-7)
        accepted = true
      } else {
        lambda *= 6
      }
    }
    if (!accepted) break
  }
  return {
    state: makeState(x.subarray(0, 4), x.subarray(4, 7), x[7]!),
    iterations: iter,
    residual8: maxAbs(r) * 255,
  }
}

function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!
  return s
}
function maxAbs(a: ArrayLike<number>): number {
  let m = 0
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]!))
  return m
}
function solve(M: Float64Array[], b: ArrayLike<number>): Float64Array | null {
  const n = M.length
  const A = M.map((row, i) => [...Array.from(row), b[i]!])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r]![col]!) > Math.abs(A[pivot]![col]!)) pivot = r
    if (Math.abs(A[pivot]![col]!) < 1e-12) return null
    ;[A[col], A[pivot]] = [A[pivot]!, A[col]!]
    const p = A[col]![col]!
    for (let c = col; c <= n; c++) A[col]![c] = A[col]![c]! / p
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const fac = A[r]![col]!
      if (fac === 0) continue
      for (let c = col; c <= n; c++) A[r]![c] = A[r]![c]! - fac * A[col]![c]!
    }
  }
  return Float64Array.from(A.map((row) => row[n]!))
}

// --- the fp16 storage round-trip (the sheet is RGBA16F) ---------------------

import { fromHalf, toHalf } from '../../../../packages/efx-watercolor/src/playground/half'

export function roundTripF16(state: State): State {
  const a = Array.from(state.a, (v) => fromHalf(toHalf(v)))
  const b = Array.from(state.b, (v) => fromHalf(toHalf(v)))
  return makeState(a, b, fromHalf(toHalf(state.s)))
}

// --- metrics ----------------------------------------------------------------

export interface Metrics {
  n: number
  maxChannel: number
  meanChannel: number
  p95Channel: number
  maxHueDeg: number
  /**
   * Max hue shift among samples whose TARGET chroma is at least 25/255.
   * Hue is ill-conditioned near grey — a 1/255 channel delta on a pale
   * composite reads as several degrees — so this is the only hue number a
   * bracket may be judged on.
   */
  maxHueDegColoured: number
  colouredN: number
  /** fraction of samples whose RGB matches within 1 channel step. */
  exactFraction: number
}

/** 8-bit channel deltas and the hue shift in the sRGB chroma plane. */
export function metrics(actual: ArrayLike<[number, number, number]>, target: ArrayLike<[number, number, number]>): Metrics {
  let maxC = 0
  let sumC = 0
  let maxHue = 0
  let maxHueColoured = 0
  let colouredN = 0
  let exact = 0
  const all: number[] = []
  for (let i = 0; i < actual.length; i++) {
    const a = actual[i]!
    const t = target[i]!
    let m = 0
    for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(a[c]! - t[c]!))
    maxC = Math.max(maxC, m)
    sumC += m
    all.push(m)
    if (m <= 1) exact++
    maxHue = Math.max(maxHue, hueDelta(a, t))
    if (chroma(t) >= 0.1) {
      colouredN++
      maxHueColoured = Math.max(maxHueColoured, hueDelta(a, t))
    }
  }
  all.sort((x, y) => x - y)
  const p95 = all.length ? all[Math.min(all.length - 1, Math.floor(all.length * 0.95))]! : 0
  return {
    n: actual.length,
    maxChannel: maxC,
    meanChannel: all.length ? sumC / all.length : 0,
    p95Channel: p95,
    maxHueDeg: maxHue,
    maxHueDegColoured: maxHueColoured,
    colouredN,
    exactFraction: actual.length ? exact / actual.length : 1,
  }
}

/** Hue angle between two sRGB colours, in degrees (0 when either is achromatic). */
function hueDelta(a: readonly number[], b: readonly number[]): number {
  const ha = hue(a)
  const hb = hue(b)
  if (ha === null || hb === null) return 0
  let d = Math.abs(ha - hb)
  if (d > 180) d = 360 - d
  return d
}
function chroma(c: readonly number[]): number {
  const r = c[0]! / 255, g = c[1]! / 255, bl = c[2]! / 255
  return Math.max(r, g, bl) - Math.min(r, g, bl)
}
function hue(c: readonly number[]): number | null {
  const r = c[0]! / 255, g = c[1]! / 255, bl = c[2]! / 255
  const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl)
  const chroma = mx - mn
  if (chroma < 0.04) return null // achromatic: hue is undefined, not zero
  let h: number
  if (mx === r) h = ((g - bl) / chroma) % 6
  else if (mx === g) h = (bl - r) / chroma + 2
  else h = (r - g) / chroma + 4
  h *= 60
  return h < 0 ? h + 360 : h
}
