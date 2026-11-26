// The terminal pre-gap detector (quick 261126-n20), pure functions over an
// along-x profile so the harness can execute them on synthetic data in vitest
// (the alphaLaw.ts precedent): probe.ts imports the helper for the capture
// readout, and end-gap.mjs carries its own frozen copy of the same walk as the
// bar's instrument.
//
// A terminal PRE-GAP is an ENCLOSED pale band: the stroke's body density dips
// for a stretch, then returns to body level at the terminal band before the
// stroke ends. The detector keeps only runs BRACKETED on both sides — a
// station within `bracketPx` of each end that is back at the body level
// (within half the margin). A run touching either profile edge, or one whose
// outer side never returns to the body level (the terminal ramp), reads 0: it
// is not an enclosed band, it is the stroke simply ending.

/** The profile's station spacing, document px. */
export const END_PRE_GAP_STATION_PX = 2
/** A run counts as pale when it sits at least this far below the body level. */
export const END_PRE_GAP_MARGIN = 0.03
/** Each pale run must be bracketed by body-level stations within this many
 *  document px on BOTH sides (the inner side is the body, the outer side the
 *  terminal band). */
export const END_PRE_GAP_BRACKET_PX = 48

export interface EnclosedPaleRunOptions {
  /** The body's own density level — the reference the dip is measured from. */
  readonly bodyLevel: number
  /** The dip depth that makes a station pale. */
  readonly margin: number
  /** How far from a pale run's edge a body-level station may sit. */
  readonly bracketPx: number
  /** The profile's station spacing, document px. */
  readonly stationPx: number
  /** Absolute position of the profile's first station, document px. */
  readonly x0Px?: number
}

export interface EnclosedPaleRun {
  /** The longest bracketed pale run, document px (0 when none). */
  largestRunPx: number
  /** `bodyLevel` minus that run's minimum. */
  maxDepth: number
  /** The run's first station, absolute when `x0Px` is given. */
  atPx: number
  /** Whether an enclosed run was found. */
  bracketed: boolean
  /** The body level the walk measured against. */
  bodyLevel: number
  /** The profile's station count. */
  stationCount: number
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

/**
 * Scan an along-x visible-darkness profile for the longest contiguous run of
 * stations sitting at least `margin` below `bodyLevel`, keeping only runs
 * bracketed on both sides. A run touching either profile edge reads 0 (no
 * bracket); a monotone terminal ramp reads 0 (its outer side never returns).
 */
export function enclosedPaleRun(
  profile: readonly number[],
  opts: EnclosedPaleRunOptions,
): EnclosedPaleRun {
  const { bodyLevel, margin, bracketPx, stationPx } = opts
  const x0Px = opts.x0Px ?? 0
  const n = profile.length
  const bracketStations = Math.max(1, Math.round(bracketPx / stationPx))
  const pale = (value: number): boolean => value <= bodyLevel - margin
  const atBody = (value: number): boolean => value >= bodyLevel - margin * 0.5
  let largestRunPx = 0
  let maxDepth = 0
  let atPx = 0
  let i = 0
  while (i < n) {
    if (!pale(profile[i]!)) {
      i += 1
      continue
    }
    let j = i
    while (j + 1 < n && pale(profile[j + 1]!)) j += 1
    let leftBracket = false
    for (let k = i - 1; k >= 0 && k >= i - bracketStations; k -= 1) {
      if (atBody(profile[k]!)) {
        leftBracket = true
        break
      }
    }
    let rightBracket = false
    for (let k = j + 1; k < n && k <= j + bracketStations; k += 1) {
      if (atBody(profile[k]!)) {
        rightBracket = true
        break
      }
    }
    if (leftBracket && rightBracket) {
      const runPx = (j - i + 1) * stationPx
      let minimum = profile[i]!
      for (let k = i + 1; k <= j; k += 1) minimum = Math.min(minimum, profile[k]!)
      if (runPx > largestRunPx) {
        largestRunPx = runPx
        maxDepth = bodyLevel - minimum
        atPx = x0Px + i * stationPx
      }
    }
    i = j + 1
  }
  return {
    largestRunPx,
    maxDepth: round4(maxDepth),
    atPx,
    bracketed: largestRunPx > 0,
    bodyLevel,
    stationCount: n,
  }
}
