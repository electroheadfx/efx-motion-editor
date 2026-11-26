// The blend share-spectrum detector (quick 261126-n20, issue 3), pure
// functions over an across share profile so the harness can execute them on
// synthetic data in vitest (the ridge.ts / endGap.ts precedent): probe.ts
// imports the helpers for the bristle-blend readout on the three line
// surfaces, and compare.mjs holds the frozen absolute bar.
//
// The shared axis: `share` is one across station's visible colour on white
// projected onto the under-to-stroke axis, 0 = pure stroke, 1 = pure under.
// The worm stripes are AC energy in that profile — variation across the
// stroke in how much of the wet under the pickup drags into the judged film.
// `shareSpectrum` removes the mean and one linear fit (the across taper), then
// reads the residual's RMS and its periodogram: `bandShare` is the fraction of
// AC power inside the declared worm band, `peakPx` the band's dominant
// wavelength. The band is declared BEFORE the RED captures and frozen with the
// bar; a stripe outside it is not this defect.

/** The declared worm band's near edge, document px (one hash cell is 6 px). */
export const BLEND_WORM_BAND_LO_PX = 4
/** The declared worm band's far edge, document px. */
export const BLEND_WORM_BAND_HI_PX = 32
/** Below this many stations the spectrum is noise; read zeros. */
export const BLEND_MIN_STATIONS = 8
/**
 * Absolute AC floor, share units (RMS of the detrended profile). A flat
 * profile carries only float noise, and a share of noise is arbitrary — the
 * band covers most of the coarse bins, so a degenerate residual can read a
 * near-unity band share and fail a perfectly clean film. Real films vary at
 * 1e-3 and above; this floor sits two orders below any film and eleven orders
 * above float noise, and it may only ever silence, never manufacture, a
 * stripe.
 */
export const BLEND_AC_FLOOR = 0.0001

export interface ShareSpectrumOptions {
  /** Station spacing, document px (the across profile is 1 px/station). */
  readonly stationPx?: number
  readonly bandLoPx?: number
  readonly bandHiPx?: number
}

export interface ShareSpectrum {
  /** RMS of the residual after removing the mean and a linear fit. */
  acRms: number
  /** The share of AC power inside the declared worm band (0..1). */
  bandShare: number
  /** The band's dominant wavelength, document px (0 when the band is empty). */
  peakPx: number
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

/**
 * RMS of a series after removing its mean and a least-squares linear fit —
 * the AC energy used for both axes of `blendAnisotropy`.
 */
export function detrendedRms(values: readonly number[]): number {
  const n = values.length
  if (n === 0) return 0
  let sum = 0
  for (let i = 0; i < n; i += 1) sum += Number.isFinite(values[i]!) ? values[i]! : 0
  const mean = sum / n
  const mx = (n - 1) / 2
  let sxx = 0
  let sxy = 0
  for (let i = 0; i < n; i += 1) {
    const dx = i - mx
    const v = Number.isFinite(values[i]!) ? values[i]! : 0
    sxx += dx * dx
    sxy += dx * (v - mean)
  }
  const slope = sxx > 0 ? sxy / sxx : 0
  let energy = 0
  for (let i = 0; i < n; i += 1) {
    const v = Number.isFinite(values[i]!) ? values[i]! : 0
    const residual = v - mean - slope * (i - mx)
    energy += residual * residual
  }
  return Math.sqrt(energy / n)
}

/**
 * Detrend an across share profile and read its periodogram: the AC RMS, the
 * fraction of AC power inside [bandLoPx, bandHiPx], and the band's dominant
 * wavelength. Integer wavelengths only (the station grid); the band's power
 * and the total are both read on the same grid, so `bandShare` is a true
 * fraction. Degenerate inputs (too few stations, a non-positive spacing or a
 * reversed band) read zeros — a missing profile can never manufacture a
 * stripe.
 */
export function shareSpectrum(
  share: readonly number[],
  opts: ShareSpectrumOptions = {},
): ShareSpectrum {
  const stationPx = opts.stationPx ?? 1
  const bandLoPx = opts.bandLoPx ?? BLEND_WORM_BAND_LO_PX
  const bandHiPx = opts.bandHiPx ?? BLEND_WORM_BAND_HI_PX
  const n = share.length
  if (
    n < BLEND_MIN_STATIONS ||
    !Number.isFinite(stationPx) ||
    stationPx <= 0 ||
    !Number.isFinite(bandLoPx) ||
    !Number.isFinite(bandHiPx) ||
    !(bandHiPx > bandLoPx)
  ) {
    return { acRms: 0, bandShare: 0, peakPx: 0 }
  }
  // The residual, exactly the series `detrendedRms` measures.
  let sum = 0
  for (let i = 0; i < n; i += 1) sum += Number.isFinite(share[i]!) ? share[i]! : 0
  const mean = sum / n
  const mx = (n - 1) / 2
  let sxx = 0
  let sxy = 0
  for (let i = 0; i < n; i += 1) {
    const dx = i - mx
    const v = Number.isFinite(share[i]!) ? share[i]! : 0
    sxx += dx * dx
    sxy += dx * (v - mean)
  }
  const slope = sxx > 0 ? sxy / sxx : 0
  const residual = new Array<number>(n)
  let energy = 0
  for (let i = 0; i < n; i += 1) {
    const v = Number.isFinite(share[i]!) ? share[i]! : 0
    residual[i] = v - mean - slope * (i - mx)
    energy += residual[i]! * residual[i]!
  }
  const acRms = Math.sqrt(energy / n)
  // A residual this small is float noise: the ratio of noise to noise is not a
  // stripe (see BLEND_AC_FLOOR).
  if (!(acRms >= BLEND_AC_FLOOR)) {
    return { acRms: round4(acRms), bandShare: 0, peakPx: 0 }
  }

  const maxLambda = Math.floor(n / 2)
  const loLambda = Math.max(2, Math.round(bandLoPx / stationPx))
  const hiLambda = Math.min(maxLambda, Math.round(bandHiPx / stationPx))
  let total = 0
  let band = 0
  let best = 0
  let peakPx = 0
  for (let lambda = 2; lambda <= maxLambda; lambda += 1) {
    const w = (2 * Math.PI) / lambda
    let re = 0
    let im = 0
    for (let i = 0; i < n; i += 1) {
      const phase = w * i
      re += residual[i]! * Math.cos(phase)
      im -= residual[i]! * Math.sin(phase)
    }
    const power = (re * re + im * im) / n
    total += power
    if (lambda >= loLambda && lambda <= hiLambda) {
      band += power
      if (power > best) {
        best = power
        peakPx = lambda * stationPx
      }
    }
  }

  return {
    acRms: round4(acRms),
    bandShare: round4(total > 0 ? band / total : 0),
    peakPx: round4(peakPx),
  }
}
