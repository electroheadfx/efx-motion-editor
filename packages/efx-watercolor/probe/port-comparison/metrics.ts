// ============================================================
//  port-comparison/metrics.ts — the ONE metric library behind the
//  261119-pod acceptance numbers.
//
//  SCRATCH HARNESS ONLY. Pure functions over RGBA rasters: every
//  measure the drag / feather / strand / body blocks report is
//  computed here, unit-tested against synthetic fixtures, and
//  shared verbatim by the Studio driver (probe.ts, bundled into the
//  page), the reference driver (reference.mjs, bundled for node)
//  and the acceptance printer (run.mjs --acceptance).
//
//  Why a second harness: the medium-engine gate can only compare the
//  engine against itself (digests of fixed scripts), and 64-24's
//  committed body0/body100 records are byte-identical — Body is
//  invisible to that CLI. The acceptance needs ABSOLUTE numbers
//  measured on a rendered sheet: hue inside a stroke's eroded core,
//  the four side fade widths, along/across strand structure, and the
//  mode-4 coverage spread. One library produces them for both sides.
//
//  Colour space honesty: the hue measures work on the composited
//  sRGB sheet (the reference's own export and Studio's `paper` mode
//  are both "paint over paper"), while the body separation reads the
//  mode-4 PIGMENT export's alpha exactly as 64-17 defined it
//  (alpha = max(1 − min(rgb), cover)).
// ============================================================

export interface Rgba {
  readonly width: number
  readonly height: number
  readonly data: Uint8ClampedArray | Uint8Array
}

/** One byte per pixel; 255 = selected. */
export interface Mask {
  readonly width: number
  readonly height: number
  readonly data: Uint8Array
}

/** A scene record is a plain JSON object: numbers, strings and digests. */
export interface SceneRecord {
  readonly [key: string]: unknown
}

export interface RunCapture {
  readonly label?: string
  readonly scenes: Record<string, SceneRecord>
}

/* --------------------------------------------------------- constants */

/** Declared acceptance thresholds — echoed by the report, never tuned. */
export const HUE_MIN_SHIFT_DEG = 10
export const HUE_MIN_ANGLE_FRACTION = 0.2
export const HUE_P0_CONTROL_MAX_DEG = 3
export const FADE_MIN_GAIN_PX = 1
export const STRAND_MIN_RATIO = 1.15
export const CORE_DARKNESS_MAX_DELTA_PCT = 10

/** A pixel participates in a hue aggregate only above this saturation. */
export const HUE_CHROMA_FLOOR = 0.05

/** A pixel "changed" when any RGB channel moved more than this (0..255). */
export const MASK_THRESHOLD = 6

/** Erosion radius (px) that defines a stroke's near-opaque interior. */
export const INTERIOR_ERODE_PX = 2

/** Mode-4 alpha at or above this counts a texel as covered (D-C). */
export const COVERED_ALPHA = 0.5

/* ------------------------------------------------------------ colour */

export function hueOf(r: number, g: number, b: number): number | null {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const chroma = max - min
  if (chroma < HUE_CHROMA_FLOOR) return null
  let hue: number
  if (max === rn) hue = ((gn - bn) / chroma) % 6
  else if (max === gn) hue = (bn - rn) / chroma + 2
  else hue = (rn - gn) / chroma + 4
  hue *= 60
  return hue < 0 ? hue + 360 : hue
}

export function chromaOf(r: number, g: number, b: number): number {
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255
}

/** Rec. 709 luma, 0..255. */
export function lumaOf(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Film darkness, 0..255 — the 64-23 census field (255 − luma). */
export function darknessOf(r: number, g: number, b: number): number {
  return 255 - lumaOf(r, g, b)
}

/** Signed shortest arc from `from` to `to`, in degrees (−180..180]. */
export function signedAngle(from: number, to: number): number {
  const d = ((to - from + 540) % 360) - 180
  return d <= -180 ? d + 360 : d
}

export interface HueStats {
  readonly meanDeg: number
  readonly stdDeg: number
  readonly chroma: number
  readonly count: number
}

/**
 * Circular hue mean and standard deviation. Pixels below the chroma floor
 * (bare paper, near-grey films) are excluded so the aggregate measures
 * paint, not background.
 */
export function hueStats(img: Rgba, mask?: Mask | null): HueStats {
  const { data } = img
  let sx = 0
  let sy = 0
  let n = 0
  let chromaSum = 0
  for (let p = 0; p < img.width * img.height; p += 1) {
    if (mask && !mask.data[p]) continue
    const i = p * 4
    const r = data[i]!
    const g = data[i + 1]!
    const b = data[i + 2]!
    const hue = hueOf(r, g, b)
    if (hue === null) continue
    const rad = (hue * Math.PI) / 180
    sx += Math.cos(rad)
    sy += Math.sin(rad)
    chromaSum += chromaOf(r, g, b)
    n += 1
  }
  if (n === 0) return { meanDeg: NaN, stdDeg: NaN, chroma: 0, count: 0 }
  let mean = (Math.atan2(sy, sx) * 180) / Math.PI
  if (mean < 0) mean += 360
  const resultant = Math.min(1, Math.hypot(sx, sy) / n)
  const stdRad = resultant >= 1 ? 0 : Math.sqrt(-2 * Math.log(Math.max(resultant, 1e-12)))
  return { meanDeg: mean, stdDeg: (stdRad * 180) / Math.PI, chroma: chromaSum / n, count: n }
}

/* ------------------------------------------------------------- masks */

/** Pixels whose RGB moved more than `threshold` between the two rasters. */
export function buildMask(after: Rgba, before: Rgba, threshold = MASK_THRESHOLD): Mask {
  if (after.width !== before.width || after.height !== before.height) {
    throw new Error('buildMask: raster dimensions differ')
  }
  const n = after.width * after.height
  const out = new Uint8Array(n)
  for (let p = 0; p < n; p += 1) {
    const i = p * 4
    const dr = Math.abs(after.data[i]! - before.data[i]!)
    const dg = Math.abs(after.data[i + 1]! - before.data[i + 1]!)
    const db = Math.abs(after.data[i + 2]! - before.data[i + 2]!)
    if (dr > threshold || dg > threshold || db > threshold) out[p] = 255
  }
  return { width: after.width, height: after.height, data: out }
}

/** Chebyshev erosion: a pixel survives only if its full square survives. */
export function erodeMask(mask: Mask, px: number): Mask {
  if (px <= 0) return mask
  const { width: w, height: h } = mask
  // The mask embeds in a padded grid (255 outside) so the border erodes too.
  const pad = px
  const pw = w + pad * 2
  const ph = h + pad * 2
  const padded = new Uint8Array(pw * ph) // 0 outside = eroded away
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      padded[(y + pad) * pw + (x + pad)] = mask.data[y * w + x]! > 0 ? 1 : 0
    }
  }
  const horizontal = new Uint8Array(pw * ph)
  for (let y = 0; y < ph; y += 1) {
    let run = 0
    for (let x = 0; x < pw; x += 1) {
      if (padded[y * pw + x]) run += 1
      else run = 0
      if (run >= pad * 2 + 1) horizontal[y * pw + x - pad] = 1
    }
  }
  const out = new Uint8Array(w * h)
  for (let x = 0; x < w; x += 1) {
    let run = 0
    for (let y = 0; y < ph; y += 1) {
      if (horizontal[y * pw + (x + pad)]) run += 1
      else run = 0
      // The run's centre sits `pad` rows below the padded coordinate where
      // the full window was reached — same centring as the horizontal pass.
      if (run >= pad * 2 + 1) out[(y - pad * 2) * w + x] = 255
    }
  }
  return { width: w, height: h, data: out }
}

export function intersectMasks(a: Mask, b: Mask): Mask {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error('intersectMasks: mask dimensions differ')
  }
  const out = new Uint8Array(a.width * a.height)
  for (let p = 0; p < out.length; p += 1) out[p] = a.data[p] && b.data[p] ? 255 : 0
  return { width: a.width, height: a.height, data: out }
}

export interface Bounds {
  readonly x0: number
  readonly y0: number
  readonly x1: number // exclusive
  readonly y1: number // exclusive
}

export function maskBounds(mask: Mask): Bounds | null {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (!mask.data[y * mask.width + x]) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 }
}

export function maskArea(mask: Mask): number {
  let n = 0
  for (let p = 0; p < mask.data.length; p += 1) if (mask.data[p]) n += 1
  return n
}

/* ------------------------------------------------------- darkness ops */

export function meanDarkness(img: Rgba, mask: Mask): number {
  let sum = 0
  let n = 0
  for (let p = 0; p < img.width * img.height; p += 1) {
    if (!mask.data[p]) continue
    const i = p * 4
    sum += darknessOf(img.data[i]!, img.data[i + 1]!, img.data[i + 2]!)
    n += 1
  }
  return n === 0 ? NaN : sum / n
}

/* ---------------------------------------------------------- profiles */

interface Profiles {
  readonly b: Bounds
  readonly rowMeans: Float64Array
  readonly colMeans: Float64Array
  readonly coreRow: number
  readonly coreCol: number
  readonly coreDarkness: number
}

/**
 * Row/column mean darkness over the mask's central half-band: rows average
 * columns in the middle 50 % (clear of the stroke's rounded ends) and
 * columns average rows in the middle 50 % (clear of the side fringes), so
 * each profile measures the axis it is named for.
 */
function profiles(img: Rgba, mask: Mask): Profiles | null {
  const b = maskBounds(mask)
  if (!b) return null
  const w = b.x1 - b.x0
  const h = b.y1 - b.y0
  if (w < 8 || h < 8) return null
  const cx0 = b.x0 + Math.floor(w * 0.25)
  const cx1 = b.x0 + Math.ceil(w * 0.75)
  const cy0 = b.y0 + Math.floor(h * 0.25)
  const cy1 = b.y0 + Math.ceil(h * 0.75)
  const rowMeans = new Float64Array(img.height).fill(NaN)
  const colMeans = new Float64Array(img.width).fill(NaN)
  for (let y = b.y0; y < b.y1; y += 1) {
    let sum = 0
    let n = 0
    for (let x = cx0; x < cx1; x += 1) {
      const p = y * img.width + x
      if (!mask.data[p]) continue
      const i = p * 4
      sum += darknessOf(img.data[i]!, img.data[i + 1]!, img.data[i + 2]!)
      n += 1
    }
    if (n >= 4) rowMeans[y] = sum / n
  }
  for (let x = b.x0; x < b.x1; x += 1) {
    let sum = 0
    let n = 0
    for (let y = cy0; y < cy1; y += 1) {
      const p = y * img.width + x
      if (!mask.data[p]) continue
      const i = p * 4
      sum += darknessOf(img.data[i]!, img.data[i + 1]!, img.data[i + 2]!)
      n += 1
    }
    if (n >= 4) colMeans[x] = sum / n
  }
  let coreRow = -1
  let coreDarkness = -Infinity
  for (let y = b.y0; y < b.y1; y += 1) {
    const v = rowMeans[y]!
    if (Number.isFinite(v) && v > coreDarkness) {
      coreDarkness = v
      coreRow = y
    }
  }
  let coreCol = -1
  let colPeak = -Infinity
  for (let x = b.x0; x < b.x1; x += 1) {
    const v = colMeans[x]!
    if (Number.isFinite(v) && v > colPeak) {
      colPeak = v
      coreCol = x
    }
  }
  if (coreRow < 0 || coreCol < 0 || !(coreDarkness > 0)) return null
  return { b, rowMeans, colMeans, coreRow, coreCol, coreDarkness }
}

export interface SideFades {
  readonly top: number
  readonly bottom: number
  readonly left: number
  readonly right: number
}

function crossRow(means: Float64Array, from: number, to: number, step: number, level: number): number {
  let last = from
  for (let y = from; step > 0 ? y <= to : y >= to; y += step) {
    const v = means[y]!
    if (!Number.isFinite(v)) continue
    if (v >= level) last = y
    else break
  }
  return last
}

function crossCol(means: Float64Array, from: number, to: number, step: number, level: number): number {
  let last = from
  for (let x = from; step > 0 ? x <= to : x >= to; x += step) {
    const v = means[x]!
    if (!Number.isFinite(v)) continue
    if (v >= level) last = x
    else break
  }
  return last
}

/**
 * The distance in px over which darkness falls from 50 % to 10 % of the
 * stroke's core, measured per side. This is the reference's own edge
 * reading (64-23 used the same 50→10 band on the gate's census) applied
 * to the composited sheet instead of the transmittance export.
 */
export function sideFades(img: Rgba, mask: Mask): SideFades | null {
  const pr = profiles(img, mask)
  if (!pr) return null
  const { b, rowMeans, colMeans, coreRow, coreCol, coreDarkness } = pr
  const l50 = 0.5 * coreDarkness
  const l10 = 0.1 * coreDarkness
  const top50 = crossRow(rowMeans, coreRow, b.y0, -1, l50)
  const top10 = crossRow(rowMeans, top50, b.y0, -1, l10)
  const bot50 = crossRow(rowMeans, coreRow, b.y1 - 1, 1, l50)
  const bot10 = crossRow(rowMeans, bot50, b.y1 - 1, 1, l10)
  const left50 = crossCol(colMeans, coreCol, b.x0, -1, l50)
  const left10 = crossCol(colMeans, left50, b.x0, -1, l10)
  const right50 = crossCol(colMeans, coreCol, b.x1 - 1, 1, l50)
  const right10 = crossCol(colMeans, right50, b.x1 - 1, 1, l10)
  return {
    top: top50 - top10,
    bottom: bot10 - bot50,
    left: left50 - left10,
    right: right10 - right50,
  }
}

/** Circular hue std inside each side's 50→10 fade band (central band only). */
export function edgeHueStd(img: Rgba, mask: Mask): {
  top: number
  bottom: number
  left: number
  right: number
} | null {
  const pr = profiles(img, mask)
  if (!pr) return null
  const { b, rowMeans, colMeans, coreRow, coreCol, coreDarkness } = pr
  const l50 = 0.5 * coreDarkness
  const l10 = 0.1 * coreDarkness
  const top50 = crossRow(rowMeans, coreRow, b.y0, -1, l50)
  const top10 = crossRow(rowMeans, top50, b.y0, -1, l10)
  const bot50 = crossRow(rowMeans, coreRow, b.y1 - 1, 1, l50)
  const bot10 = crossRow(rowMeans, bot50, b.y1 - 1, 1, l10)
  const left50 = crossCol(colMeans, coreCol, b.x0, -1, l50)
  const left10 = crossCol(colMeans, left50, b.x0, -1, l10)
  const right50 = crossCol(colMeans, coreCol, b.x1 - 1, 1, l50)
  const right10 = crossCol(colMeans, right50, b.x1 - 1, 1, l10)
  const strip = (x0: number, x1: number, y0: number, y1: number): { width: number; height: number; data: Uint8Array } => {
    const w = img.width
    const out = new Uint8Array(w * img.height)
    const cx0 = Math.max(0, Math.min(w - 1, x0))
    const cx1 = Math.max(cx0 + 1, Math.min(w, x1))
    const cy0 = Math.max(0, Math.min(img.height - 1, y0))
    const cy1 = Math.max(cy0 + 1, Math.min(img.height, y1))
    for (let y = cy0; y < cy1; y += 1) for (let x = cx0; x < cx1; x += 1) out[y * w + x] = mask.data[y * w + x]!
    return { width: w, height: img.height, data: out }
  }
  const cx0 = b.x0 + Math.floor((b.x1 - b.x0) * 0.25)
  const cx1 = b.x0 + Math.ceil((b.x1 - b.x0) * 0.75)
  const cy0 = b.y0 + Math.floor((b.y1 - b.y0) * 0.25)
  const cy1 = b.y0 + Math.ceil((b.y1 - b.y0) * 0.75)
  const top = hueStats(img, strip(cx0, cx1, Math.min(top10, top50), Math.max(top10, top50) + 1)).stdDeg
  const bottom = hueStats(img, strip(cx0, cx1, Math.min(bot50, bot10), Math.max(bot50, bot10) + 1)).stdDeg
  const left = hueStats(img, strip(Math.min(left10, left50), Math.max(left10, left50) + 1, cy0, cy1)).stdDeg
  const right = hueStats(img, strip(Math.min(right50, right10), Math.max(right50, right10) + 1, cy0, cy1)).stdDeg
  return { top, bottom, left, right }
}

/**
 * Variance of the per-column mean darkness — structure ALONG the stroke
 * (streaks and dashes). Columns with < 4 mask pixels are skipped.
 */
export function alongVariance(img: Rgba, mask: Mask): number {
  const pr = profiles(img, mask)
  if (!pr) return NaN
  const values: number[] = []
  for (let x = pr.b.x0; x < pr.b.x1; x += 1) {
    const v = pr.colMeans[x]!
    if (Number.isFinite(v)) values.push(v)
  }
  if (values.length < 2) return NaN
  const mean = values.reduce((a, v) => a + v, 0) / values.length
  let sum = 0
  for (const v of values) sum += (v - mean) * (v - mean)
  return sum / (values.length - 1)
}

/**
 * Mean |Δ darkness| between vertically adjacent mask pixels — structure
 * ACROSS the stroke (hair bands, edge mottling).
 */
export function acrossGradientEnergy(img: Rgba, mask: Mask): number {
  let sum = 0
  let n = 0
  for (let y = 0; y + 1 < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      const p = y * img.width + x
      const q = p + img.width
      if (!mask.data[p] || !mask.data[q]) continue
      const i = p * 4
      const j = q * 4
      const d0 = darknessOf(img.data[i]!, img.data[i + 1]!, img.data[i + 2]!)
      const d1 = darknessOf(img.data[j]!, img.data[j + 1]!, img.data[j + 2]!)
      sum += Math.abs(d1 - d0)
      n += 1
    }
  }
  return n === 0 ? NaN : sum / n
}

/** Half the median column thickness of the mask (a horizontal stroke's half-width). */
export function strokeHalfWidthPx(mask: Mask): number {
  const b = maskBounds(mask)
  if (!b) return NaN
  const w = b.x1 - b.x0
  const x0 = b.x0 + Math.floor(w * 0.3)
  const x1 = b.x0 + Math.ceil(w * 0.7)
  const counts: number[] = []
  for (let x = x0; x < x1; x += 1) {
    let n = 0
    for (let y = b.y0; y < b.y1; y += 1) if (mask.data[y * mask.width + x]) n += 1
    if (n > 0) counts.push(n)
  }
  if (counts.length === 0) return NaN
  counts.sort((a, v) => a - v)
  return counts[Math.floor(counts.length / 2)]! / 2
}

export interface BodyCoverage {
  readonly coveredFraction: number
  readonly interiorAlphaMean: number
}

/** D-C: the mode-4 alpha spread over the stroke's footprint. */
export function bodyCoverage(pigment: Rgba, mask: Mask): BodyCoverage {
  let covered = 0
  let total = 0
  for (let p = 0; p < mask.data.length; p += 1) {
    if (!mask.data[p]) continue
    total += 1
    if (pigment.data[p * 4 + 3]! / 255 >= COVERED_ALPHA) covered += 1
  }
  const interior = erodeMask(mask, INTERIOR_ERODE_PX)
  let sum = 0
  let n = 0
  for (let p = 0; p < interior.data.length; p += 1) {
    if (!interior.data[p]) continue
    sum += pigment.data[p * 4 + 3]!
    n += 1
  }
  return {
    coveredFraction: total === 0 ? NaN : covered / total,
    interiorAlphaMean: n === 0 ? NaN : sum / n / 255,
  }
}

/* ------------------------------------------------------------ sha256 */

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

function rotr(v: number, n: number): number {
  return ((v >>> n) | (v << (32 - n))) >>> 0
}

/** Pure SHA-256 over raw bytes — the digest the identity contract reads. */
export function sha256Hex(input: Uint8Array | Uint8ClampedArray): string {
  const length = input.length
  const paddedLength = (((length + 9 + 63) >> 6) << 6) >>> 0
  const bytes = new Uint8Array(paddedLength)
  bytes.set(input)
  bytes[length] = 0x80
  const view = new DataView(bytes.buffer)
  const bitLenHi = Math.floor((length * 8) / 0x100000000)
  const bitLenLo = (length * 8) >>> 0
  view.setUint32(paddedLength - 8, bitLenHi, false)
  view.setUint32(paddedLength - 4, bitLenLo, false)
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ])
  const w = new Uint32Array(64)
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4, false)
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3)
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10)
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0
    }
    let a = h[0]!
    let b = h[1]!
    let c = h[2]!
    let d = h[3]!
    let e = h[4]!
    let f = h[5]!
    let g = h[6]!
    let hh = h[7]!
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (hh + S1 + ch + SHA256_K[i]! + w[i]!) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) >>> 0
      hh = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }
    h[0] = (h[0]! + a) >>> 0
    h[1] = (h[1]! + b) >>> 0
    h[2] = (h[2]! + c) >>> 0
    h[3] = (h[3]! + d) >>> 0
    h[4] = (h[4]! + e) >>> 0
    h[5] = (h[5]! + f) >>> 0
    h[6] = (h[6]! + g) >>> 0
    h[7] = (h[7]! + hh) >>> 0
  }
  let out = ''
  for (let i = 0; i < 8; i += 1) out += h[i]!.toString(16).padStart(8, '0')
  return out
}

/* ------------------------------------------------------ scene record */

export interface SceneInput {
  readonly scene: string
  /** Sheet raster BEFORE the first stroke of this page. */
  readonly pre: Rgba
  /** Sheet raster after the band, when the scene paints one. */
  readonly substrate?: Rgba | null
  readonly finalPaper: Rgba
  readonly finalPigment?: Rgba | null
  /** Parameter echo: colour, brush, size, pickup, feather, body, refill, ref. */
  readonly params: SceneRecord
}

const r2 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 100) / 100 : NaN)

/**
 * Turns a scene's rasters into its record. Masks are SAME-PAGE pairs —
 * the pre-stroke sheet, the band substrate and the final sheet — so no
 * cross-run threshold is ever involved.
 */
export function measureScene(input: SceneInput): SceneRecord {
  const { pre, finalPaper } = input
  const substrate = input.substrate ?? null
  const bandMask = substrate ? buildMask(substrate, pre) : null
  const strokeBase = substrate ?? pre
  const strokeMask = buildMask(finalPaper, strokeBase)
  const anyStroke = maskArea(strokeMask) > 0
  const interior = anyStroke ? erodeMask(strokeMask, INTERIOR_ERODE_PX) : null
  const crossingMask = bandMask && anyStroke ? intersectMasks(interior!, bandMask) : null

  const record: Record<string, unknown> = {
    scene: input.scene,
    ...input.params,
    paperDigest: sha256Hex(finalPaper.data),
    pigmentDigest: input.finalPigment ? sha256Hex(input.finalPigment.data) : null,
  }

  if (bandMask && maskArea(bandMask) > 0) {
    const erodedBand = erodeMask(bandMask, INTERIOR_ERODE_PX)
    const hue = hueStats(substrate!, erodedBand)
    record['bandHueDeg'] = r2(hue.meanDeg)
    record['bandChroma'] = r2(hue.chroma)
    record['bandPixels'] = hue.count
  }

  if (!anyStroke) return record

  record['strokePixels'] = maskArea(strokeMask)
  record['strokeHalfWidthPx'] = r2(strokeHalfWidthPx(strokeMask))

  if (interior && maskArea(interior) > 0) {
    const hue = hueStats(finalPaper, interior)
    record['strokeHueDeg'] = r2(hue.meanDeg)
    record['strokeChroma'] = r2(hue.chroma)
    record['strokeHuePixels'] = hue.count
    record['coreDarkness'] = r2(meanDarkness(finalPaper, interior))
  }
  if (crossingMask && maskArea(crossingMask) > 0) {
    const hue = hueStats(finalPaper, crossingMask)
    record['crossingHueDeg'] = r2(hue.meanDeg)
    record['crossingChroma'] = r2(hue.chroma)
    record['crossingPixels'] = hue.count
  }

  const fades = sideFades(finalPaper, strokeMask)
  if (fades) {
    record['fadeTop'] = r2(fades.top)
    record['fadeBottom'] = r2(fades.bottom)
    record['fadeLeft'] = r2(fades.left)
    record['fadeRight'] = r2(fades.right)
    const edge = edgeHueStd(finalPaper, strokeMask)
    if (edge) {
      record['edgeHueStdTop'] = r2(edge.top)
      record['edgeHueStdBottom'] = r2(edge.bottom)
      record['edgeHueStdLeft'] = r2(edge.left)
      record['edgeHueStdRight'] = r2(edge.right)
    }
  }

  const strandMask = crossingMask && maskArea(crossingMask) > 0 ? crossingMask : interior
  if (strandMask && maskArea(strandMask) > 0) {
    record['alongVariance'] = r2(alongVariance(finalPaper, strandMask))
    record['acrossGradient'] = r2(acrossGradientEnergy(finalPaper, strandMask))
  }

  if (input.finalPigment) {
    const body = bodyCoverage(input.finalPigment, strokeMask)
    record['coveredFraction'] = r2(body.coveredFraction)
    record['interiorAlphaMean'] = r2(body.interiorAlphaMean)
  }

  return record
}

/* -------------------------------------------------------- acceptance */

export interface DragBlock {
  readonly hueP0: number
  readonly hueBand: number
  readonly hueP100: number
  readonly blueToBandDeg: number
  readonly signedShiftDeg: number
  readonly fractionOfBlueToBandAngle: number
  readonly blankP0DeltaDeg: number
  readonly reference: {
    readonly hueBandDeg: number
    readonly bandChroma: number
    readonly signedShiftDeg: number
    readonly blankP0DeltaDeg: number
  }
  readonly pass: boolean
  readonly detail: string
}

export interface FeatherBlock {
  readonly fadeWidths: {
    readonly f0: SideFades | null
    readonly f100: SideFades | null
  }
  readonly gains: SideFades | null
  readonly hueVarianceDeg: {
    readonly f0: SceneRecord
    readonly f100: SceneRecord
  }
  readonly pass: boolean
  readonly detail: string
}

export interface StrandsBlock {
  readonly alongVariance: { readonly before: number; readonly after: number; readonly ratio: number }
  readonly acrossGradient: { readonly before: number; readonly after: number; readonly ratio: number }
  readonly coreDarkness: { readonly before: number; readonly after: number; readonly deltaPct: number }
  readonly pass: boolean
  readonly detail: string
}

export interface BodyBlock {
  readonly coveredFraction: { readonly b0: number; readonly b100: number }
  readonly interiorAlphaMean: { readonly b0: number; readonly b100: number }
  readonly pass: boolean
  readonly detail: string
}

export interface Acceptance {
  readonly thresholds: SceneRecord
  readonly drag: DragBlock
  readonly feather: FeatherBlock
  readonly strands: StrandsBlock
  readonly body: BodyBlock
}

function n(scenes: Record<string, SceneRecord>, scene: string, key: string): number {
  const value = scenes[scene]?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : NaN
}

function fadeOf(record: SceneRecord | undefined): SideFades | null {
  if (!record) return null
  const top = record['fadeTop']
  const bottom = record['fadeBottom']
  const left = record['fadeLeft']
  const right = record['fadeRight']
  if ([top, bottom, left, right].some((v) => typeof v !== 'number' || !Number.isFinite(v))) return null
  return { top: top as number, bottom: bottom as number, left: left as number, right: right as number }
}

/**
 * The three acceptance blocks plus D-C, computed from the three captured
 * runs. BEFORE supplies the corrected-gate strand baseline; AFTER is the
 * final engine — the ONLY side the pass flags read; REFERENCE supplies the
 * calibration echo and its own measured drag (never a pass operand: the
 * reference has no Feather control and no Body knob).
 */
export function acceptance(before: RunCapture, after: RunCapture, reference: RunCapture): Acceptance {
  const a = after.scenes
  const b = before.scenes
  const ref = reference.scenes

  // --- drag ---------------------------------------------------------
  const hueP0 = n(a, 'band-p0', 'crossingHueDeg')
  const hueP100 = n(a, 'band-p100', 'crossingHueDeg')
  const hueBand = n(a, 'band', 'bandHueDeg')
  const bandChroma = n(a, 'band', 'bandChroma')
  const hueBlankP0 = n(a, 'blank-p0', 'strokeHueDeg')
  const blueToBandDeg = signedAngle(hueP0, hueBand)
  const signedShiftDeg = signedAngle(hueP0, hueP100)
  const fractionOfBlueToBandAngle =
    Number.isFinite(blueToBandDeg) && Math.abs(blueToBandDeg) > 1e-9 ? signedShiftDeg / blueToBandDeg : NaN
  const blankP0DeltaDeg = Math.abs(signedAngle(hueBlankP0, hueP0))
  const refHueP0 = n(ref, 'band-p0', 'crossingHueDeg')
  const refHueP100 = n(ref, 'band-p100', 'crossingHueDeg')
  const refHueBlankP0 = n(ref, 'blank-p0', 'strokeHueDeg')
  const bandYellow = hueBand >= 30 && hueBand <= 75
  const dragPass =
    bandYellow &&
    Math.abs(signedShiftDeg) >= HUE_MIN_SHIFT_DEG &&
    fractionOfBlueToBandAngle >= HUE_MIN_ANGLE_FRACTION &&
    blankP0DeltaDeg <= HUE_P0_CONTROL_MAX_DEG
  const dragDetail = [
    bandYellow ? 'band yellow' : `band hue ${hueBand} outside 30..75`,
    Math.abs(signedShiftDeg) >= HUE_MIN_SHIFT_DEG ? 'shift ok' : 'shift below 10 deg or wrong direction',
    fractionOfBlueToBandAngle >= HUE_MIN_ANGLE_FRACTION ? 'fraction ok' : 'fraction below 0.20',
    blankP0DeltaDeg <= HUE_P0_CONTROL_MAX_DEG ? 'control ok' : 'P0 control above 3 deg',
  ].join('; ')
  const drag: DragBlock = {
    hueP0,
    hueBand,
    hueP100,
    blueToBandDeg: r2(blueToBandDeg),
    signedShiftDeg: r2(signedShiftDeg),
    fractionOfBlueToBandAngle: r2(fractionOfBlueToBandAngle),
    blankP0DeltaDeg: r2(blankP0DeltaDeg),
    reference: {
      hueBandDeg: n(ref, 'band', 'bandHueDeg'),
      bandChroma: n(ref, 'band', 'bandChroma'),
      signedShiftDeg: r2(signedAngle(refHueP0, refHueP100)),
      blankP0DeltaDeg: r2(Math.abs(signedAngle(refHueBlankP0, refHueP0))),
    },
    pass: dragPass,
    detail: dragDetail,
  }

  // --- feather ------------------------------------------------------
  const f0 = fadeOf(a['blank-f0'])
  const f100 = fadeOf(a['blank-f100'])
  const gains =
    f0 && f100
      ? {
          top: r2(f100.top - f0.top),
          bottom: r2(f100.bottom - f0.bottom),
          left: r2(f100.left - f0.left),
          right: r2(f100.right - f0.right),
        }
      : null
  const featherPass =
    gains !== null &&
    gains.top >= FADE_MIN_GAIN_PX &&
    gains.bottom >= FADE_MIN_GAIN_PX &&
    gains.left >= FADE_MIN_GAIN_PX &&
    gains.right >= FADE_MIN_GAIN_PX
  const refF0 = fadeOf(ref['blank-f0'])
  const refF100 = fadeOf(ref['blank-f100'])
  const feather: FeatherBlock = {
    fadeWidths: { f0, f100 },
    gains,
    hueVarianceDeg: {
      f0: {
        top: n(a, 'blank-f0', 'edgeHueStdTop'),
        bottom: n(a, 'blank-f0', 'edgeHueStdBottom'),
        left: n(a, 'blank-f0', 'edgeHueStdLeft'),
        right: n(a, 'blank-f0', 'edgeHueStdRight'),
        reference: refF0,
      },
      f100: {
        top: n(a, 'blank-f100', 'edgeHueStdTop'),
        bottom: n(a, 'blank-f100', 'edgeHueStdBottom'),
        left: n(a, 'blank-f100', 'edgeHueStdLeft'),
        right: n(a, 'blank-f100', 'edgeHueStdRight'),
        reference: refF100,
      },
    },
    pass: featherPass,
    detail: gains
      ? `gains top ${gains.top} bottom ${gains.bottom} left ${gains.left} right ${gains.right} (min ${FADE_MIN_GAIN_PX} px each)`
      : 'fade widths missing',
  }

  // --- strands ------------------------------------------------------
  const alongBefore = n(b, 'band-p100', 'alongVariance')
  const alongAfter = n(a, 'band-p100', 'alongVariance')
  const acrossBefore = n(b, 'band-p100', 'acrossGradient')
  const acrossAfter = n(a, 'band-p100', 'acrossGradient')
  const darkBefore = n(b, 'band-p100', 'coreDarkness')
  const darkAfter = n(a, 'band-p100', 'coreDarkness')
  const alongRatio = alongBefore > 0 ? alongAfter / alongBefore : NaN
  const acrossRatio = acrossBefore > 0 ? acrossAfter / acrossBefore : NaN
  const coreDarknessDeltaPct = darkBefore > 0 ? (Math.abs(darkAfter - darkBefore) / darkBefore) * 100 : NaN
  const strandsPass =
    alongRatio >= STRAND_MIN_RATIO &&
    acrossRatio >= STRAND_MIN_RATIO &&
    coreDarknessDeltaPct <= CORE_DARKNESS_MAX_DELTA_PCT
  const strands: StrandsBlock = {
    alongVariance: { before: r2(alongBefore), after: r2(alongAfter), ratio: r2(alongRatio) },
    acrossGradient: { before: r2(acrossBefore), after: r2(acrossAfter), ratio: r2(acrossRatio) },
    coreDarkness: { before: r2(darkBefore), after: r2(darkAfter), deltaPct: r2(coreDarknessDeltaPct) },
    pass: strandsPass,
    detail: `along ratio ${r2(alongRatio)} and across ratio ${r2(acrossRatio)} vs min ${STRAND_MIN_RATIO}; core darkness delta ${r2(coreDarknessDeltaPct)}% vs max ${CORE_DARKNESS_MAX_DELTA_PCT}%`,
  }

  // --- body (D-C) ---------------------------------------------------
  const cf0 = n(a, 'body0', 'coveredFraction')
  const cf100 = n(a, 'body100', 'coveredFraction')
  const ia0 = n(a, 'body0', 'interiorAlphaMean')
  const ia100 = n(a, 'body100', 'interiorAlphaMean')
  const bodyPass = Number.isFinite(cf0) && Number.isFinite(cf100) && cf100 > cf0
  const body: BodyBlock = {
    coveredFraction: { b0: r2(cf0), b100: r2(cf100) },
    interiorAlphaMean: { b0: r2(ia0), b100: r2(ia100) },
    pass: bodyPass,
    detail: `body100 covered ${r2(cf100)} vs body0 ${r2(cf0)} (strictly greater required)`,
  }

  return {
    thresholds: {
      HUE_MIN_SHIFT_DEG,
      HUE_MIN_ANGLE_FRACTION,
      HUE_P0_CONTROL_MAX_DEG,
      FADE_MIN_GAIN_PX,
      STRAND_MIN_RATIO,
      CORE_DARKNESS_MAX_DELTA_PCT,
      HUE_CHROMA_FLOOR,
      MASK_THRESHOLD,
    },
    drag,
    feather,
    strands,
    body,
  }
}
