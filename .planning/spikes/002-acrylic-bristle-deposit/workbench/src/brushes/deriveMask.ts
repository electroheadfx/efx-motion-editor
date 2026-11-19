// ============================================================
//  deriveMask — decoded image → 512×512 brush-tip mask (TIP-03, amended).
//
//  The IMPORTED mask edge is TIP_MASK_EDGE (512) and is deliberately NOT the
//  procedural tip edge (`TIP_SIZE` = 192 in playground/brushes.ts). Imported
//  masks are content-addressed files in the machine library; procedural tips
//  are built at 192 and never move.
//
//  TWO BRANCHES, ONE LAW. Every path that turns a decoded image
//  into a tip mask calls this function — the import surface and
//  the built-in bake alike (D-09). There is no second conversion.
//
//  ALPHA BRANCH: if ANY pixel has alpha below
//  MASK_ALPHA_THRESHOLD (250), the image carries its own
//  transparency, so the mask IS the alpha channel — verbatim, for
//  every pixel. RGB is never consulted on this branch.
//
//  LUMINANCE BRANCH: otherwise every pixel is opaque (alpha ≥ 250)
//  and the image is a light-on-dark or dark-on-light stamp. Per
//  pixel, with the Rec. 709 coefficients pinned below:
//    lum = round(0.2126·r + 0.7152·g + 0.0722·b)
//  Mean luminance over the opaque pixels (all of them here):
//    mean <  MASK_POLARITY_MEAN_THRESHOLD (128) → mask = lum
//    mean >= MASK_POLARITY_MEAN_THRESHOLD (128) → mask = 255 − lum
//  The inversion keeps a bright stamp on a dark background from
//  painting the whole square: bright ink becomes a high mask
//  value, and dark-on-light art is turned the same way.
//
//  Contrast normalization lives ONLY in the built-in bake
//  (normalizeMaskContrast, D-08). Imported tips are never
//  normalized: a faint user stamp stays faint, and the engine's
//  `tipMean` is the only deposit compensation (spec 01 guardrail).
//
//  Totality: deriveMask never throws — a buffer whose length is
//  not exactly `pixelCount * 4` returns null without allocating.
// ============================================================

/** Alpha at or above this counts as opaque; any lower alpha selects the alpha branch. */
export const MASK_ALPHA_THRESHOLD = 250

/** Mean luminance at or above this inverts the luminance branch (greater-or-equal rule). */
export const MASK_POLARITY_MEAN_THRESHOLD = 128

/**
 * The IMPORTED brush-mask edge. Independent of `TIP_SIZE` (192), which is the
 * PROCEDURAL tip edge — the two are different numbers on purpose and must never
 * be conflated (spec 04 Work 1).
 */
export const TIP_MASK_EDGE = 512

/** The only legal mask byte length: TIP_MASK_EDGE squared (262,144). */
export const TIP_MASK_BYTES = TIP_MASK_EDGE * TIP_MASK_EDGE

/** Rec. 709 luminance coefficients — the single written statement of the weights. */
const LUM_R = 0.2126
const LUM_G = 0.7152
const LUM_B = 0.0722

/**
 * Derive the tip mask from decoded RGBA bytes. Total and fail-closed:
 * null on any length other than exactly `pixelCount * 4`, never a throw.
 */
export function deriveMask(
  rgba: Uint8Array | Uint8ClampedArray,
  pixelCount: number = TIP_MASK_EDGE * TIP_MASK_EDGE,
): Uint8Array | null {
  if (!(rgba instanceof Uint8Array) && !(rgba instanceof Uint8ClampedArray)) return null
  if (!Number.isInteger(pixelCount) || pixelCount <= 0) return null
  if (rgba.length !== pixelCount * 4) return null

  // Alpha branch — decided before any mask allocation beyond its own output.
  for (let i = 0; i < pixelCount; i++) {
    if (rgba[i * 4 + 3] < MASK_ALPHA_THRESHOLD) {
      const mask = new Uint8Array(pixelCount)
      for (let j = 0; j < pixelCount; j++) mask[j] = rgba[j * 4 + 3]
      return mask
    }
  }

  // Luminance branch — every pixel is opaque here.
  const lums = new Uint8Array(pixelCount)
  let sum = 0
  for (let i = 0; i < pixelCount; i++) {
    const base = i * 4
    const lum = Math.round(LUM_R * rgba[base] + LUM_G * rgba[base + 1] + LUM_B * rgba[base + 2])
    lums[i] = lum
    sum += lum
  }
  const mean = sum / pixelCount
  const mask = new Uint8Array(pixelCount)
  if (mean < MASK_POLARITY_MEAN_THRESHOLD) {
    mask.set(lums)
  } else {
    for (let i = 0; i < pixelCount; i++) mask[i] = 255 - lums[i]
  }
  return mask
}

/**
 * Stretch a mask's observed min..max onto 0..255. BAKE ONLY (D-08):
 * imported tips are never normalized. A constant mask (max <= min)
 * is returned as a copy, unchanged — never a divide by zero.
 */
export function normalizeMaskContrast(mask: Uint8Array): Uint8Array {
  let min = 255
  let max = 0
  for (let i = 0; i < mask.length; i++) {
    const v = mask[i]
    if (v < min) min = v
    if (v > max) max = v
  }
  const out = new Uint8Array(mask.length)
  if (max <= min) {
    out.set(mask)
    return out
  }
  const scale = 255 / (max - min)
  for (let i = 0; i < mask.length; i++) out[i] = Math.round((mask[i] - min) * scale)
  return out
}
