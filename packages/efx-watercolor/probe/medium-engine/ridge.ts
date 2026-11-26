// The centre-ridge detector (quick 261126-n20), pure functions over across
// profiles so the harness can execute them on synthetic data in vitest (the
// alphaLaw.ts / endGap.ts precedent): probe.ts imports the helper for the
// capture readout on the three line surfaces and on the end lanes, and
// compare.mjs holds the frozen absolute bar.
//
// A centre RIDGE is a dark line running down a stroke's axis: the two rows
// nearest the centreline read darker than the body-level shoulders on both
// sides, station after station along the travel. The helper keeps the centre
// band at exactly RIDGE_CENTRE_WIDTH stations so a 2 px spike reads its full
// excess, measures the shoulders as the pooled median of the symmetric bands
// outside it (the body level), and reports the four fields the bars use:
// peakExcess, ridgeWidthPx, asymmetry, share.

/** The centre band's width, stations (the rows nearest the centreline). */
export const RIDGE_CENTRE_WIDTH = 2
/** Shoulder stations sit at least this far from the centre band... */
export const RIDGE_SHOULDER_INNER = 4
/** ...and at most this far (inside the stroke body at every probed size). */
export const RIDGE_SHOULDER_OUTER = 20
/** The centre-band excess that counts as a ridge, image units (one luma
 *  step of 255 — the smallest excess the eye reads as a line). */
export const RIDGE_MARGIN = 1 / 255

export interface CentreRidgeOptions {
  /** Index of the first of the centre band's `centreWidth` stations. */
  readonly centreIndex: number
  /** How many stations form the centre band (default RIDGE_CENTRE_WIDTH). */
  readonly centreWidth?: number
  /** Shoulder band distances from the centre band, in stations. */
  readonly shoulderInner?: number
  readonly shoulderOuter?: number
  /** The excess that counts as a ridge on one station. */
  readonly margin?: number
}

export interface CentreRidge {
  /** The strongest centre-band mean minus the pooled shoulder median. */
  peakExcess: number
  /** The across width (stations = document px) of the contiguous run around
   *  the centre band whose station-mean excess clears the margin. */
  ridgeWidthPx: number
  /** |left shoulder median - right shoulder median|, median over stations. */
  asymmetry: number
  /** The fraction of along stations whose centre excess clears the margin. */
  share: number
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

/** Lower median, the probe's own `median` semantics. */
function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor((sorted.length - 1) / 2)]!
}

/**
 * Scan along stations of across profiles for a centre-line dark ridge.
 * `acrossDark[s]` is station `s`'s darkness across the stroke (1 px per
 * station index, one entry per pixel row). Stations whose centre or shoulder
 * ranges fall outside the row are skipped, so a clipped band never invents
 * a ridge from missing data.
 */
export function centreRidge(
  acrossDark: readonly (readonly number[])[],
  opts: CentreRidgeOptions,
): CentreRidge {
  const centreIndex = opts.centreIndex
  const centreWidth = opts.centreWidth ?? RIDGE_CENTRE_WIDTH
  const shoulderInner = opts.shoulderInner ?? RIDGE_SHOULDER_INNER
  const shoulderOuter = opts.shoulderOuter ?? RIDGE_SHOULDER_OUTER
  const margin = opts.margin ?? RIDGE_MARGIN

  const centreLo = centreIndex
  const centreHi = centreIndex + centreWidth - 1
  const leftLo = centreLo - shoulderOuter
  const leftHi = centreLo - shoulderInner
  const rightLo = centreHi + shoulderInner
  const rightHi = centreHi + shoulderOuter

  const columns = acrossDark.reduce((m, row) => Math.max(m, row.length), 0)
  const inRange = (row: readonly number[], lo: number, hi: number): number[] => {
    const out: number[] = []
    for (let i = Math.max(0, lo); i <= Math.min(row.length - 1, hi); i += 1) out.push(row[i]!)
    return out
  }

  let peakExcess = 0
  let clearing = 0
  let used = 0
  const asymmetries: number[] = []
  for (const row of acrossDark) {
    const centre = inRange(row, centreLo, centreHi)
    const left = inRange(row, leftLo, leftHi)
    const right = inRange(row, rightLo, rightHi)
    if (centre.length !== centreWidth || left.length === 0 || right.length === 0) continue
    used += 1
    const centreMean = centre.reduce((s, v) => s + v, 0) / centre.length
    const shoulder = median([...left, ...right])
    const excess = centreMean - shoulder
    if (excess > peakExcess) peakExcess = excess
    if (excess >= margin) clearing += 1
    asymmetries.push(Math.abs(median(left) - median(right)))
  }

  // The ridge's across width: the contiguous run of stations around the
  // centre band whose along-mean excess clears the margin.
  let ridgeWidthPx = 0
  if (used > 0 && columns > 0) {
    const mean = new Array<number>(columns).fill(0)
    let contributors = 0
    for (const row of acrossDark) {
      if (row.length < columns) continue
      contributors += 1
      for (let i = 0; i < columns; i += 1) mean[i] = mean[i]! + row[i]!
    }
    if (contributors > 0) {
      for (let i = 0; i < columns; i += 1) mean[i] = mean[i]! / contributors
      const shoulderLevel = median(inRange(mean, leftLo, leftHi).concat(inRange(mean, rightLo, rightHi)))
      const clears = (i: number): boolean =>
        i >= 0 && i < columns && mean[i]! - shoulderLevel >= margin
      if (clears(centreLo) || clears(centreHi)) {
        let lo = centreLo
        let hi = centreHi
        while (clears(lo - 1)) lo -= 1
        while (clears(hi + 1)) hi += 1
        ridgeWidthPx = hi - lo + 1
      }
    }
  }

  return {
    peakExcess: round4(peakExcess),
    ridgeWidthPx,
    asymmetry: round4(median(asymmetries)),
    share: round4(used > 0 ? clearing / used : 0),
  }
}
