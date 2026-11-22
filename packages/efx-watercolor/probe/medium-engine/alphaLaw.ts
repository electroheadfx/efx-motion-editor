// The shipped alpha law, checked on capture buffers (64-31).
//
// committed and exported storage alpha is OPAQUE: the paper, white and
// transparent exports' alpha must read 255 on every texel.
//
// the display alpha is the DARKNESS of the visible pigment: the pigment
// export's alpha must equal `255 − min(rgb)` of the transparent export on the
// same texel, within one 8-bit step. Coverage lives only in the coverage
// raster, an instrument, never an export channel.
//
// Both checks scan EVERY texel. A fixed prime stride is not an option: 4093 is
// `2^n·w − 3` for every power-of-two sheet width, so consecutive samples walk
// a right-edge lattice and miss the paint entirely on a 256² neutral capture.
// A full scan of the three 1080² surfaces measured ~7 ms against a 34–134 ms
// render phase, so exactness is the cheaper answer.
//
// Pure functions over already-read pixel buffers: the probe passes the buffers
// `digestCanvas` read (no extra export, no DOM), and the harness executes them
// on synthetic buffers in vitest.

/** One exported surface the opaque-export check reads. */
export interface AlphaLawSurface {
  readonly surface: string
  readonly pixels: Uint8ClampedArray
}

export interface OpaqueExportCheck {
  /** The smallest alpha byte found (255 = opaque). */
  readonly minAlpha: number
  /** The surface that carried the minimum (the first surface when all are
   *  opaque — every export must read 255, so any 255 is truthful). */
  readonly surface: string
}

/**
 * The opaque half of the law: every storage/export alpha is OPAQUE. Scans the
 * full buffer of each surface and reports the minimum alpha and its surface.
 * Any value below 255 is a storage alpha that picked up a coverage or
 * lightness term; the comparator fails it by name.
 */
export function opaqueExportCheck(surfaces: readonly AlphaLawSurface[]): OpaqueExportCheck {
  let minAlpha = 255
  let surface = surfaces[0]?.surface ?? 'none'
  for (const entry of surfaces) {
    const pixels = Math.floor(entry.pixels.length / 4)
    for (let p = 0; p < pixels; p += 1) {
      const alpha = entry.pixels[p * 4 + 3]!
      if (alpha < minAlpha) {
        minAlpha = alpha
        surface = entry.surface
      }
    }
  }
  return { minAlpha, surface }
}

export interface VisibleAlphaCheck {
  /** The worst |darkness − display alpha| found, in 8-bit steps. */
  readonly visibleAlphaMaxDelta: number | null
  /** The number of painted texels the comparison used. */
  readonly visibleAlphaSamples: number
  /** The worst texel's exported-pixel coordinates, or null when no texel
   *  carried visible pigment. */
  readonly visibleAlphaWorstAt: string | null
  /** Present only on the bristle captures: why the check was skipped. */
  readonly visibleAlphaSkip?: string
}

/**
 * The display half of the law: the pigment export's alpha must equal the
 * darkness the transparent export's RGB records (`255 − min(rgb)`), within one
 * 8-bit step of rounding.
 *
 * The comparison counts PAINTED texels only (pigment alpha non-zero) because a
 * blank texel carries no visible film — its transparent RGB is the lit paper,
 * not a darkness reading — so including it would pad the sample count with
 * evidence-free texels. It is a sample filter, not a correctness exemption:
 * a painted texel that disagrees fails the capture.
 */
export function visibleAlphaCheck(
  pigment: Uint8ClampedArray,
  transparent: Uint8ClampedArray,
  width: number,
): VisibleAlphaCheck {
  const pixels = Math.floor(Math.min(pigment.length, transparent.length) / 4)
  let visibleAlphaMaxDelta = 0
  let visibleAlphaSamples = 0
  let worstPixel = -1
  for (let p = 0; p < pixels; p += 1) {
    const i = p * 4
    const alpha = pigment[i + 3]!
    if (alpha === 0) continue
    const darkness = 255 - Math.min(transparent[i]!, transparent[i + 1]!, transparent[i + 2]!)
    if (visibleAlphaSamples === 0) worstPixel = p
    visibleAlphaSamples += 1
    const delta = Math.abs(darkness - alpha)
    if (delta > visibleAlphaMaxDelta) {
      visibleAlphaMaxDelta = delta
      worstPixel = p
    }
  }
  const x = worstPixel < 0 ? 0 : worstPixel % width
  const y = worstPixel < 0 ? 0 : Math.floor(worstPixel / width)
  return {
    visibleAlphaMaxDelta: visibleAlphaSamples === 0 ? null : visibleAlphaMaxDelta,
    visibleAlphaSamples,
    visibleAlphaWorstAt: worstPixel < 0 ? null : `x=${x},y=${y}`,
  }
}

/**
 * The bristle captures' visible-alpha exclusion. The display film blur is
 * applied to the exported RGB while the pigment alpha is derived from the
 * UNSHADED reconstruction, so on a bristle fringe the two disagree BY DESIGN;
 * the check reports this reason instead of a delta (compare.mjs requires the
 * skip on a bristle capture and refuses it on any other).
 */
export const BRISTLE_VISIBLE_ALPHA_SKIP =
  'bristle film blur: the display film blur makes the exported RGB and alpha intentionally disagree at the fringe'

/** The bristle captures' skip record: the same block shape, reported as
 *  skipped with its reason instead of a delta. */
export function visibleAlphaSkipped(reason: string): VisibleAlphaCheck {
  return {
    visibleAlphaMaxDelta: null,
    visibleAlphaSamples: 0,
    visibleAlphaWorstAt: null,
    visibleAlphaSkip: reason,
  }
}
