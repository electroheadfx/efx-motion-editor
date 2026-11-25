// ============================================================
//  SPIKE 006 / Q3c — which 8 of the 16 display bands to fit.
//
//  The fit has 8 unknowns (7 absorbance coefficients + the scattering S), so
//  fitting 8 bands pins the model exactly (when the system is invertible) and
//  the other 8 are PREDICTED. Which 8 you pin decides where the model error
//  lands, so the choice is made on two properties of the display itself:
//
//    importance  w_i = max_c |DISPLAY_RGB_WEIGHTS[i][c]|
//                the band's largest single-channel contribution to the RGB the
//                residual is finally measured in.
//    direction   b_i = [B4_i, B3_i, 1]
//                how band i moves when the 8 unknowns move. Two bands with
//                nearly parallel b_i carry the same information (they are
//                "correlated"); a set spanning the space pins every parameter.
//
//  `dOptimal(n)` maximises  log det(Σ_{i∈S} w_i·b_i·b_iᵀ)  over every subset of
//  size n — the weighted D-optimal design, i.e. "largest basis weight / least
//  correlated" made concrete. The 1 in b_i carries the S direction; it is not a
//  derivative (that is state-dependent) but it is the same vector for every
//  band, so a set that ignores S loses determinant.
//
//  This selection is STATE-INDEPENDENT on purpose: the choice is a property of
//  the display basis, not of one scene (spike conventions: sweep a law over its
//  own variable, not the scene). The residual that decides whether the choice
//  was good is measured on the real GPU pass afterwards.
// ============================================================

import { BASIS, DISPLAY_BANDS, DISPLAY_RGB_WEIGHTS } from '../../../../packages/efx-watercolor/src/playground/spectralData'

export const N_BANDS = DISPLAY_BANDS.length

/** `max_c |w_ic|` — the band's largest single-channel contribution to RGB. */
export function importance(i: number): number {
  return Math.max(...DISPLAY_RGB_WEIGHTS[i]!.map((v) => Math.abs(v)))
}

/** `b_i = [B4_i, B3_i, 1]` — the 8-parameter sensitivity direction of band i. */
export function direction(i: number): Float64Array {
  const band = DISPLAY_BANDS[i]!
  const v = new Float64Array(8)
  for (let k = 0; k < 7; k++) v[k] = BASIS[k]![band]!
  v[7] = 1
  return v
}

/**
 * log det of the PARAMETER-space design Gram  G = Σ_{i∈S} w_i·b_i·b_iᵀ  (8x8,
 * symmetric by construction — the band-space form W·B·Bᵀ is not, and Cholesky
 * on it returns negative pivots). -Infinity when a subset is rank-deficient.
 */
export function logDet(subset: readonly number[]): number {
  const n = 8
  const G = Array.from({ length: n }, () => new Float64Array(n))
  for (const i of subset) {
    const b = direction(i)
    const w = importance(i)
    for (let p = 0; p < n; p++) for (let q = 0; q < n; q++) G[p]![q]! += w * b[p]! * b[q]!
  }
  const L = Array.from({ length: n }, () => new Float64Array(n))
  let logDetL = 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = G[i]![j]!
      for (let k = 0; k < j; k++) s -= L[i]![k]! * L[j]![k]!
      if (i === j) {
        if (!(s > 0)) return -Infinity
        L[i]![j] = Math.sqrt(s)
        logDetL += Math.log(L[i]![j]!)
      } else {
        L[i]![j] = s / L[j]![j]!
      }
    }
  }
  return 2 * logDetL
}

export interface BandSelection {
  name: string
  indices: number[]
  /** bitmask over the 16 display bands, for the shader's uBandMask. */
  mask: number
  logDet: number
  weights: number[]
}

const sel = (name: string, indices: number[]): BandSelection => ({
  name,
  indices,
  mask: indices.reduce((m, i) => m | (1 << i), 0),
  logDet: Number(logDet(indices).toFixed(3)),
  weights: indices.map((i) => Number(importance(i).toFixed(3))),
})

/** The n bands with the largest display importance. */
export function topWeight(n: number): BandSelection {
  const order = Array.from({ length: N_BANDS }, (_, i) => i).sort((a, b) => importance(b) - importance(a))
  return sel(`topWeight${n}`, order.slice(0, n).sort((a, b) => a - b))
}

/** n bands evenly spaced in wavelength, offset 0 or 1 (every other of the 16). */
export function spread(n: number, offset: number): BandSelection {
  const step = N_BANDS / n
  const indices = Array.from({ length: n }, (_, k) => (offset + Math.round(k * step)) % N_BANDS)
  return sel(`spread${n}.${offset}`, indices.sort((a, b) => a - b))
}

/**
 * Exhaustive weighted D-optimal design: the subset maximising log det of the
 * weighted Gram. C(16,8) = 12,870 subsets — an exhaustive search is affordable.
 */
export function dOptimal(n: number): BandSelection {
  let best: number[] = []
  let bestDet = -Infinity
  const combo: number[] = []
  const walk = (start: number): void => {
    if (combo.length === n) {
      const d = logDet(combo)
      if (d > bestDet) { bestDet = d; best = combo.slice() }
      return
    }
    for (let i = start; i < N_BANDS; i++) { combo.push(i); walk(i + 1); combo.pop() }
  }
  walk(0)
  return sel(`dOptimal${n}`, best)
}

/** The candidate sets, for the report. */
export function candidates(n: number): BandSelection[] {
  return [dOptimal(n), topWeight(n), spread(n, 0), spread(n, 1)]
}
