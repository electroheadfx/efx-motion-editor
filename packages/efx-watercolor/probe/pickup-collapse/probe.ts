// ============================================================
//  pickup-collapse/probe.ts — MEASUREMENT ONLY (spike 003 + 004).
//
//  Question A (spike 003): between 5b0cad17f (drag pair crossing hue 211 -> 78) and
//  c0ab29b2c (213 -> 205) the only engine change is the first-dab travel
//  anchor in `bristleTravel`. Which term of the pickup chain collapsed?
//
//  Question B (spike 004): the reference's whole-stroke drag is POROSITY — its
//  core paints only 0.60 (Feather 0) / 0.91 (Feather 100) of its texels, so its
//  taps keep sampling the band. Ours paints 0.98 / 1.00: solid, so the core
//  samples only itself. This probe adds a BLANK scene (`scene=blank`, no band)
//  and reports, at mid-stroke over the central 50 % of the painted span:
//    - per-bristle load mean/p10/p50/p90 (readBristles)
//    - the gather's body / local / wide/5 / presence over the core texels
//    - coverage = body * (0.3 + 0.7 * pressure) * dryEdge, at the scene
//      pressure AND at 1.0 (the reference's mouse), never changing the scene
//    - the §4.4 paper threshold distribution at the same texels
//    - the predicted painted fraction (twin) and the measured one (cover)
//  The gather twin below is a line-by-line transcription of BRISTLE_GATHER;
//  it exists only so the readout can name ONE divergent quantity with
//  numbers. Nothing here is imported by the package.
//
//  This page runs the port-comparison `band-p100-dry50` scene — the yellow
//  band, settle 8, then the blue 0.12 -> 0.88 at y = 0.50 — through the REAL
//  vendored engine via `createAquarelleEngineAdapter`, and reads, after dab
//  counts 1 / 5 / 20 / 50 / 100 / 300 (+ the final dab):
//    - `WatercolorEngine.readBristles()` for a centre and a rim bristle:
//      load, across, carried absorbance 0..6 (converted to hue), carried alpha
//    - the per-dab pickup chain: travelPx, travel in brush widths, the wetAt
//      gate (cover/0.5 and last-touch age), thirst, touch and
//      pickup = clamp(rate * thirst * travel * wet * touch, 0, 0.75)
//    - the gather's deposit over the band: stored coverage a + smear weight
//  All terms are evaluated at the dab's carrier moment, from the engine's own
//  fields, with the exact GLSL arithmetic (the `noise1`/`hash21` family is
//  transcribed below because it exists only in shaders.ts).
//
//  Private members are reached through the runtime internals — `private` is
//  erased. Scratch harness; nothing here is imported by the package.
// ============================================================

import { WatercolorEngine } from '../../src/playground/Engine'
import { createAquarelleEngineAdapter } from '../../src/adapter/engineAdapter'
import { PAPERS, type PaperPreset } from '../../src/playground/papers'
import {
  toStudioStroke,
  type AquarellePoint,
  type AquarelleStrokePayload,
} from '../../src/payload/toStudioStroke'
import type { StudioStroke } from '@efxlab/efx-paint-host/animation'
import { f16ToF32 } from '../../src/playground/half'
import { coeffsToLinear } from '../../src/playground/spectral'

const SHEET_W = 800
const SHEET_H = 600
const PAPER_SEED = 0xc0ffee
const PAPER_STRENGTH = 1
const SETTLE_TICKS = 8
const BAND_COLOR = '#e8c21a'
const BLUE_COLOR = '#5994e4'
const BRUSH_ID = 'bristle-flat'
const BAND_FRACTION = 0.12
const BLUE_FRACTION = 0.085
/** BRISTLE_BODY_ALPHA_FLOOR (Engine.ts, module-private). */
const BODY_FLOOR = 0.5
/** §6 constants the carrier/gather read (bristles.ts). */
const STREAK_LEN = 18
const STREAK = 0.9
const RIM_CONTACT = 0.45
const SMEAR_PERIOD_PX = 6
const SMEAR_CAP = 0.8
const WET_SECONDS_DEFAULT = 7
/** §4.4/§5.5/§6 — the gather's paper-tooth and body constants. */
const BRISTLE_GRAIN = 1.2
const BRISTLE_STREAK_SHARE = 0.15
const BRISTLE_HAIRS = 0.45
const BRISTLE_DRY_EDGE = 0.35
const BRISTLE_LANDING = 1.6
const SOFTNESS_F0 = 0.09
const SOFTNESS_GAIN = 0.25
/** The stroke's authored x span on the 800 px sheet. */
const PATH_X0 = 0.12
const PATH_X1 = 0.88
/** Mid-stroke capture: the first blue dab at or past this x. */
const MID_X = 0.5
const DAB_TARGETS = [1, 5, 20, 50, 100, 300]
const GATHER_X = [0.16, 0.28, 0.4, 0.5, 0.6, 0.72, 0.84]

const COLD: PaperPreset | undefined = PAPERS.find((preset) => preset.id === 'cold')

// --- GLSL twins (BRISTLE_NOISE: pcg / hash11 / hash21 / noise1) -------------

function pcg(v: number): number {
  const s = (Math.imul(v >>> 0, 747796405) + 2891336453) >>> 0
  const shift = ((s >>> 28) + 4) >>> 0
  const w = Math.imul(((s >>> shift) ^ s) >>> 0, 277803737) >>> 0
  return ((w >>> 22) ^ w) >>> 0
}
function hash11(c: number): number {
  return pcg(((Math.trunc(c) >>> 0) + 1013904223) >>> 0) / 4294967295
}
function hash21(x: number, y: number): number {
  const xi = Math.trunc(x) >>> 0
  const yi = Math.trunc(y) >>> 0
  return pcg(((xi + pcg(yi)) >>> 0)) / 4294967295
}
function noise1(v: number): number {
  const cell = Math.floor(v)
  const f = v - cell
  const blend = f * f * (3 - 2 * f)
  return hash11(cell) + (hash11(cell + 1) - hash11(cell)) * blend
}
const mix = (a: number, b: number, t: number): number => a + (b - a) * t
const fract = (v: number): number => v - Math.floor(v)
/** GLSL `valueNoise` — BRISTLE_NOISE's 2D member (§4.4's paper tooth). */
function valueNoise(x: number, y: number): number {
  const cx = Math.floor(x)
  const cy = Math.floor(y)
  const fx = x - cx
  const fy = y - cy
  const bx = fx * fx * (3 - 2 * fx)
  const by = fy * fy * (3 - 2 * fy)
  const bottom = mix(hash21(cx, cy), hash21(cx + 1, cy), bx)
  const top = mix(hash21(cx, cy + 1), hash21(cx + 1, cy + 1), bx)
  return mix(bottom, top, by)
}
/** GLSL `grainHeight(css, normal)` — streaks + tooth + cloud, weights summing to 1. */
function grainHeight(
  cssX: number,
  cssY: number,
  tangentX: number,
  tangentY: number,
  normalX: number,
  normalY: number,
): number {
  const localX = cssX * tangentX + cssY * tangentY
  const localY = cssX * normalX + cssY * normalY
  const streaks =
    valueNoise(localX / 11, localY * 0.75) * 0.65 + valueNoise(localX / 3, localY * 1.9) * 0.35
  const tooth = valueNoise(cssX * 1.3, cssY * 1.3) * 0.55 + valueNoise(cssX * 0.45 + 17, cssY * 0.45 + 17) * 0.45
  const cloud =
    valueNoise(cssX * 0.12 + 41, cssY * 0.12 + 41) * 0.45 +
    valueNoise(cssX * 0.05 + 83, cssY * 0.05 + 83) * 0.33 +
    valueNoise(cssX * 0.02 + 7, cssY * 0.02 + 7) * 0.22
  return streaks * BRISTLE_STREAK_SHARE + tooth * 0.35 + cloud * (0.65 - BRISTLE_STREAK_SHARE)
}
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)
function smoothstep(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
function bristleContact(alongPx: number, seed: number, streakLen: number): number {
  return noise1(alongPx / Math.max(streakLen * 0.7, 1) + seed * 2048 + 0.5) - 0.5
}
function rimShare(across: number): number {
  return 0.25 + 0.75 * smoothstep(0.45, 1, Math.abs(across))
}
function touchOf(reach: number, pressure: number): number {
  return smoothstep(reach, reach + 0.08, pressure)
}

// --- colour: carried absorbance -> display hue -------------------------------

const compand = (x: number): number =>
  x < 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055

function hueOf(r: number, g: number, b: number): { hue: number | null; chroma: number } {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const chroma = max - min
  if (chroma < 1e-4) return { hue: null, chroma }
  let hue: number
  if (max === r) hue = ((g - b) / chroma) % 6
  else if (max === g) hue = (b - r) / chroma + 2
  else hue = (r - g) / chroma + 4
  hue *= 60
  return { hue: hue < 0 ? hue + 360 : hue, chroma }
}

function coeffsHue(coeffs: ArrayLike<number>): {
  hueDeg: number | null
  chroma: number
  srgb: [number, number, number]
} {
  const lin = coeffsToLinear(coeffs)
  const srgb: [number, number, number] = [
    compand(clamp01(lin[0])),
    compand(clamp01(lin[1])),
    compand(clamp01(lin[2])),
  ]
  const { hue, chroma } = hueOf(srgb[0], srgb[1], srgb[2])
  return { hueDeg: hue, chroma, srgb }
}

// --- engine internals --------------------------------------------------------

interface Internals {
  dw: number
  dh: number
  bristleCount: number
  params: { wetSeconds: number; pickup: number; dry: number; feather: number }
  clock: () => number
  g: {
    readFloat(fb: WebGLFramebuffer, w: number, h: number): Float32Array
    readHalf(
      fb: WebGLFramebuffer,
      w: number,
      h: number,
      channels: 1 | 4,
      rect?: { x0: number; y0: number; x1: number; y1: number },
    ): Uint16Array
  }
  lastTouch: { read: { views: WebGLFramebuffer[] } }
  cover: { read: { views: WebGLFramebuffer[] } }
  ink: { read: { views: WebGLFramebuffer[] } }
  fixed: { views: WebGLFramebuffer[] }
  bristleShape: { views: WebGLFramebuffer[] }
}

interface Fields {
  dw: number
  dh: number
  cover: Float32Array
  stamps: Float32Array
}

function readFields(engine: WatercolorEngine): Fields {
  const e = engine as unknown as Internals
  const half = e.g.readHalf(e.cover.read.views[0]!, e.dw, e.dh, 1)
  const cover = new Float32Array(half.length)
  f16ToF32(half, cover)
  const stamps = e.g.readFloat(e.lastTouch.read.views[0]!, e.dw, e.dh)
  return { dw: e.dw, dh: e.dh, cover, stamps }
}

/** `texture(uCover, uv)` — GL_LINEAR, CLAMP_TO_EDGE. uv in texel coords. */
function coverAt(f: Fields, u: number, v: number): number {
  const x = u - 0.5
  const y = v - 0.5
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const cx = (v2: number): number => Math.min(f.dw - 1, Math.max(0, v2))
  const cy = (v2: number): number => Math.min(f.dh - 1, Math.max(0, v2))
  const p00 = f.cover[cy(y0) * f.dw + cx(x0)]!
  const p10 = f.cover[cy(y0) * f.dw + cx(x0 + 1)]!
  const p01 = f.cover[cy(y0 + 1) * f.dw + cx(x0)]!
  const p11 = f.cover[cy(y0 + 1) * f.dw + cx(x0 + 1)]!
  return (p00 + (p10 - p00) * fx) + ((p01 + (p11 - p01) * fx) - (p00 + (p10 - p00) * fx)) * fy
}

/** `texture(uTimes, uv)` — GL_NEAREST, CLAMP_TO_EDGE. uv in texel coords. */
function stampAt(f: Fields, u: number, v: number): number {
  const x = Math.min(f.dw - 1, Math.max(0, Math.round(u - 0.5)))
  const y = Math.min(f.dh - 1, Math.max(0, Math.round(v - 0.5)))
  return f.stamps[y * f.dw + x]!
}

/** The carrier/gather `wetAt` at one UV texel: exp(-age/T) * clamp(cover/floor). */
function wetAtUV(
  f: Fields,
  uvX: number,
  uvY: number,
  uNow: number,
  wetSeconds: number,
): { wet: number; coverRaw: number; coverNorm: number; age: number } {
  const u = uvX * f.dw
  const v = uvY * f.dh
  const coverRaw = coverAt(f, u, v)
  const age = Math.max(uNow - stampAt(f, u, v), 0)
  const decay = Math.exp(-age / Math.max(wetSeconds, 1))
  return {
    wet: decay * clamp01(coverRaw / BODY_FLOOR),
    coverRaw,
    coverNorm: coverRaw / BODY_FLOOR,
    age,
  }
}

// --- the per-dab measurement hooks ------------------------------------------

interface DabTerms {
  n: number
  x: number
  y: number
  r: number
  angle: number
  travel: number
  travelPx: number
  alongPx: number
  pr: number
  uNow: number
  bristles: BristleTerms[]
}

interface BristleTerms {
  index: number
  across: number
  touchReach: number
  seed: number
  coverRaw: number
  coverNorm: number
  age: number
  wet: number
  thirst: number
  touch: number
  pickupRaw: number
  pickup: number
}

let capturedEngine: WatercolorEngine | null = null
let strokeSeq = 0
let dabCount = 0
let targetBristles: { centre: number; rim: number; count: number } | null = null
let pendingTerms: DabTerms | null = null
const targetSet = new Set(DAB_TARGETS)
/** Blue stroke = the second bristle stroke of a band page, the first of a blank one. */
let blueStrokeSeq = 2

function decodeBristles(engine: WatercolorEngine): Float32Array {
  const halfs = engine.readBristles()
  const out = new Float32Array(halfs.length)
  f16ToF32(halfs, out)
  return out
}

function readShape(engine: WatercolorEngine): Float32Array {
  const e = engine as unknown as Internals
  const halfs = e.g.readHalf(e.bristleShape.views[0]!, 1, 256, 4)
  const out = new Float32Array(halfs.length)
  f16ToF32(halfs, out)
  return out
}

/**
 * The two reported bristles, fixed at the blue stroke's first dab: the RIM is
 * the outermost across; the CENTRE is the bristle nearest the stroke's heart
 * whose three taps sit on the BAND's own paint. The nominal min-|across|
 * bristle is reported too: at this geometry it lands on a one-texel seam in
 * the band's deposit (cover 0, dry sentinel), which is a sampling curiosity,
 * not the brush's core.
 */
function pickBristles(
  engine: WatercolorEngine,
  fields: Fields,
  dab: { x: number; y: number; r: number; angle: number },
): { centre: number; rim: number; centreNominal: number; count: number } {
  const e = engine as unknown as Internals
  const decoded = decodeBristles(engine)
  let centre = 0
  let rim = 0
  let centreNominal = 0
  let rimAbs = -1
  let nominalAbs = Infinity
  let coreCover = -1
  const axisX = -Math.sin(dab.angle)
  const axisY = Math.cos(dab.angle)
  for (let i = 0; i < e.bristleCount; i += 1) {
    const across = decoded[2048 + i * 4 + 1]!
    const a = Math.abs(across)
    if (a > rimAbs) {
      rimAbs = a
      rim = i
    }
    if (a < nominalAbs) {
      nominalAbs = a
      centreNominal = i
    }
    if (a > 0.2) continue
    const posX = dab.x + axisX * (across * dab.r)
    const posY = dab.y + axisY * (across * dab.r)
    const cover = wetAtUV(fields, posX, posY, 0, 7).coverRaw
    if (cover > coreCover) {
      coreCover = cover
      centre = i
    }
  }
  return { centre, rim, centreNominal, count: e.bristleCount }
}

/** The carrier's own gate at one bristle, at the dab's carrier moment. */
function bristleTermsAt(
  fields: Fields,
  engine: WatercolorEngine,
  shape: Float32Array,
  decoded: Float32Array,
  index: number,
  dab: {
    x: number
    y: number
    r: number
    angle: number
    travel: number
    alongPx: number
    pr: number
    uNow: number
  },
): BristleTerms {
  const e = engine as unknown as Internals
  const across = decoded[2048 + index * 4 + 1]!
  const seed = decoded[2048 + index * 4 + 2]!
  const touchReach = shape[index * 4 + 1]!
  const axisX = -Math.sin(dab.angle)
  const axisY = Math.cos(dab.angle)
  const dirX = -axisY
  const dirY = axisX
  const posX = dab.x + axisX * (across * dab.r)
  const posY = dab.y + axisY * (across * dab.r)
  const tapX = dirX * (1.5 / e.dw)
  const tapY = dirY * (1.5 / e.dh)
  const taps = [
    wetAtUV(fields, posX - tapX, posY - tapY, dab.uNow, e.params.wetSeconds),
    wetAtUV(fields, posX, posY, dab.uNow, e.params.wetSeconds),
    wetAtUV(fields, posX + tapX, posY + tapY, dab.uNow, e.params.wetSeconds),
  ]
  const wet = (taps[0]!.wet + taps[1]!.wet + taps[2]!.wet) / 3
  const coverRaw = (taps[0]!.coverRaw + taps[1]!.coverRaw + taps[2]!.coverRaw) / 3
  const coverNorm = (taps[0]!.coverNorm + taps[1]!.coverNorm + taps[2]!.coverNorm) / 3
  const age = (taps[0]!.age + taps[1]!.age + taps[2]!.age) / 3
  const thirst = 0.15 + 2.4 * smoothstep(0.35, 0.9, seed * 7.31 - Math.floor(seed * 7.31))
  const touch = touchOf(
    touchReach + bristleContact(dab.alongPx, seed, STREAK_LEN) * rimShare(across) * RIM_CONTACT,
    dab.pr,
  )
  const pickupRaw = 1.0 * thirst * dab.travel * wet * touch
  return {
    index,
    across,
    touchReach,
    seed,
    coverRaw,
    coverNorm,
    age,
    wet,
    thirst,
    touch,
    pickupRaw,
    pickup: Math.min(0.75, Math.max(0, pickupRaw)),
  }
}

/** The gather's deposit over the band: stored coverage a + smear weight. */
function gatherSample(
  engine: WatercolorEngine,
  fields: Fields,
  dab: { x: number; y: number; r: number; angle: number; alongPx: number; uNow: number },
): {
  samples: { x: number; cover: number; smear: number; nearest: number | null }[]
  coverMean: number
  coverMax: number
  smearMean: number
  smearP90: number
  smearMax: number
} {
  const e = engine as unknown as Internals
  const count = e.bristleCount
  const spacing = 2 / count
  const halfWidthPx = dab.r * e.dh
  const axisX = -Math.sin(dab.angle)
  const axisY = Math.cos(dab.angle)
  const dirX = -axisY
  const dirY = axisX
  const samples = GATHER_X.map((x) => {
    const uvX = x
    const uvY = 0.5
    const px = (uvX - dab.x) * (e.dw / e.dh)
    const py = uvY - dab.y
    const qx = (px * axisX + py * axisY) / dab.r
    const qy = (px * dirX + py * dirY) / dab.r
    const cover = coverAt(fields, uvX * e.dw, uvY * e.dh)
    let nearest: number | null = null
    let smear = 0
    if (Math.abs(qx) <= 1.15) {
      const idx = Math.floor((qx + 1) / spacing)
      if (idx >= 0 && idx < count) {
        nearest = idx
        const alongTexel = dab.alongPx + qy * halfWidthPx
        const wet = wetAtUV(fields, uvX, uvY, dab.uNow, e.params.wetSeconds).wet
        const hash = hash21(idx, Math.floor(alongTexel / SMEAR_PERIOD_PX))
        smear = Math.min(SMEAR_CAP, Math.max(0, 1.0 * wet * hash))
      }
    }
    return { x, cover, smear, nearest }
  })
  const covers = samples.map((s) => s.cover)
  const smears = samples.map((s) => s.smear).sort((a, b) => a - b)
  const mean = (a: number[]): number => a.reduce((s, v) => s + v, 0) / a.length
  return {
    samples,
    coverMean: mean(covers),
    coverMax: Math.max(...covers),
    smearMean: mean(samples.map((s) => s.smear)),
    smearP90: smears[Math.min(smears.length - 1, Math.floor(smears.length * 0.9))]!,
    smearMax: Math.max(...smears),
  }
}

// --- the gather twin (BRISTLE_GATHER, transcribed for one texel) -------------

interface TwinStats {
  mean: number
  p10: number
  p50: number
  p90: number
}

function stats(values: number[]): TwinStats {
  const sorted = [...values].sort((a, b) => a - b)
  const at = (q: number): number =>
    sorted.length === 0 ? NaN : sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * q)))]!
  return {
    mean: values.reduce((s, v) => s + v, 0) / Math.max(values.length, 1),
    p10: at(0.1),
    p50: at(0.5),
    p90: at(0.9),
  }
}

interface GatherTwin {
  empty: boolean
  inkSum: number
  profileSum: number
  local: number
  wide: number
  presence: number
  body: number
  height: number
  threshold: number
  dryEdge: number
  coverageScene: number
  coverageP100: number
  depositF0: number
  depositF100: number
}

/**
 * Line-by-line twin of `gatherBristle(uv)` for one texel. `pressure` is the
 * SCENE's pressure; coverage is also evaluated at 1.0 (the reference's mouse)
 * without ever changing the scene. The deposit bands are the reference's own
 * softness pair (0.09 / 0.34).
 */
function gatherTwinAt(
  uvX: number,
  uvY: number,
  dab: { x: number; y: number; r: number; angle: number; alongPx: number; pressure: number },
  decoded: Float32Array,
  shape: Float32Array,
  count: number,
  dw: number,
  dh: number,
): GatherTwin {
  const axisX = -Math.sin(dab.angle)
  const axisY = Math.cos(dab.angle)
  const pX = (uvX - dab.x) * (dw / dh)
  const pY = uvY - dab.y
  const across = (pX * axisX + pY * axisY) / dab.r
  const halfWidthPx = dab.r * dh
  const spacing = 2 / count
  const nearest = Math.floor((across + 1) / spacing)
  const out: GatherTwin = {
    empty: false,
    inkSum: 0,
    profileSum: 0,
    local: 0,
    wide: 0,
    presence: 0,
    body: 0,
    height: 0,
    threshold: 0,
    dryEdge: 0,
    coverageScene: 0,
    coverageP100: 0,
    depositF0: 0,
    depositF100: 0,
  }
  if (nearest < 0 || nearest >= count) {
    out.empty = true
    return out
  }
  let inkSum = 0
  let profileSum = 0
  for (let o = -2; o <= 2; o += 1) {
    const idx = nearest + o
    if (idx < 0 || idx >= count) continue
    const load = decoded[2048 + idx * 4]!
    const acrossB = decoded[2048 + idx * 4 + 1]!
    const seed = decoded[2048 + idx * 4 + 2]!
    const radiusScale = shape[idx * 4]!
    const touchReach = shape[idx * 4 + 1]!
    const spacingPx = spacing * dab.r * dh
    const radius = Math.max(radiusScale * spacingPx, 0.8)
    const offset = ((across - acrossB) * dab.r * dh) / radius
    if (Math.abs(offset) >= 1) continue
    const profile = (1 - offset * offset) ** 2
    const contact = bristleContact(dab.alongPx, seed, STREAK_LEN)
    const touch = touchOf(touchReach + contact * rimShare(acrossB) * RIM_CONTACT, dab.pressure)
    const dryness = clamp01((1 - load) * STREAK * 1.6)
    const streak = noise1(dab.alongPx / Math.max(STREAK_LEN, 1) + seed * 4096)
    const broken = mix(1, smoothstep(0.3, 0.7, streak), dryness * BRISTLE_HAIRS)
    const landing = (0.04 + 0.7 * fract(seed * 13.7) ** 2) * BRISTLE_LANDING
    const landed = smoothstep(landing, landing + 0.12, dab.alongPx / Math.max(halfWidthPx, 1))
    inkSum += profile * Math.min(load * 1.5, 1) * touch * broken * landed
    profileSum += profile
  }
  let wide = 0
  for (let o = -2; o <= 2; o += 1) {
    const idx = Math.min(count - 1, Math.max(0, nearest + o * 7))
    const load = decoded[2048 + idx * 4]!
    const touchReach = shape[idx * 4 + 1]!
    wide += Math.min(load * 1.25, 1) * touchOf(touchReach, dab.pressure)
  }
  const presence = Math.min(profileSum / 0.5, 1)
  const local = inkSum / Math.max(profileSum, 0.5)
  const body = mix((wide / 5) * presence, local, BRISTLE_HAIRS)
  const cssX = uvX * dw
  const cssY = uvY * dh
  const height = grainHeight(cssX, cssY, -axisY, axisX, axisX, axisY)
  const threshold = BRISTLE_GRAIN * (1 - height) - 0.25
  const dryEdge = mix(1, BRISTLE_DRY_EDGE, smoothstep(0.3, 1.05, Math.abs(across)))
  const coverageScene = body * (0.3 + 0.7 * dab.pressure) * dryEdge
  const coverageP100 = body * 1.0 * dryEdge
  return {
    empty: false,
    inkSum,
    profileSum,
    local,
    wide: wide / 5,
    presence,
    body,
    height,
    threshold,
    dryEdge,
    coverageScene,
    coverageP100,
    depositF0: smoothstep(threshold - SOFTNESS_F0, threshold + SOFTNESS_F0, coverageScene),
    depositF100: smoothstep(
      threshold - (SOFTNESS_F0 + SOFTNESS_GAIN),
      threshold + (SOFTNESS_F0 + SOFTNESS_GAIN),
      coverageScene,
    ),
  }
}

interface MidReport {
  afterDab: number
  headX: number
  alongPx: number
  travelPx: number
  pressure: number
  radiusPx: number
  bristles: number
  dabs: number
  regionX: [number, number]
  coreAcross: number
  texels: number
  load: TwinStats
  body: TwinStats
  local: TwinStats
  wideOver5: TwinStats
  presence: TwinStats
  dryEdge: TwinStats
  height: TwinStats
  threshold: TwinStats
  coverageScene: TwinStats
  coverageP100: TwinStats
  predicted: { f0: number; f100: number; atSceneSoftness: number }
  predictedVisible: { f0: number; f100: number }
  /** Painted fraction if the SAME measured load ran at each pressure (F0/F100). */
  pressureSweep: { p: number; f0: number; f100: number; coverage: number }[]
  measured: { cover001: number; cover005: number; ink001: number }
  coverMean: number
  coverP90: number
}

/** Film read once, so the measured painted fraction is the real deposited alpha. */
interface FilmFields {
  inkA: Float32Array
  inkB: Float32Array
  fixA: Float32Array
  fixB: Float32Array
  dw: number
  dh: number
}

function readFilmFields(engine: WatercolorEngine): FilmFields {
  const e = engine as unknown as Internals
  const grab = (fb: WebGLFramebuffer): Float32Array => {
    const half = e.g.readHalf(fb, e.dw, e.dh, 4)
    const out = new Float32Array(half.length)
    f16ToF32(half, out)
    return out
  }
  return {
    inkA: grab(e.ink.read.views[0]!),
    inkB: grab(e.ink.read.views[1]!),
    fixA: grab(e.fixed.views[0]!),
    fixB: grab(e.fixed.views[1]!),
    dw: e.dw,
    dh: e.dh,
  }
}

function filmPaintedAt(film: FilmFields, uvX: number, uvY: number): boolean {
  const tx = Math.min(film.dw - 1, Math.max(0, Math.floor(uvX * film.dw)))
  const ty = Math.min(film.dh - 1, Math.max(0, Math.floor(uvY * film.dh)))
  const i = ty * film.dw + tx
  for (let c = 0; c < 4; c += 1) {
    if (Math.abs(film.inkA[i * 4 + c]! + film.fixA[i * 4 + c]!) > 1e-3) return true
  }
  for (let c = 0; c < 3; c += 1) {
    if (Math.abs(film.inkB[i * 4 + c]! + film.fixB[i * 4 + c]!) > 1e-3) return true
  }
  return false
}

/**
 * The mid-stroke readout: at the first blue dab at or past x = 0.5, sample the
 * central 50 % of the painted span, |across| <= 0.3 (the stroke's core), and
 * reduce the gather twin + the real fields over those texels.
 */
function midStrokeReport(
  engine: WatercolorEngine,
  fields: Fields,
  film: FilmFields,
  dab: { x: number; y: number; r: number; angle: number; alongPx: number; travelPx: number; pressure: number },
  afterDab: number,
  totalDabs: number,
): MidReport {
  const e = engine as unknown as Internals
  const decoded = decodeBristles(engine)
  const shape = readShape(engine)
  const count = e.bristleCount
  const loads: number[] = []
  for (let i = 0; i < count; i += 1) loads.push(decoded[2048 + i * 4]!)

  const spanStart = PATH_X0
  const spanEnd = Math.max(dab.x, PATH_X0 + 1e-6)
  const xLo = spanStart + 0.25 * (spanEnd - spanStart)
  const xHi = spanStart + 0.75 * (spanEnd - spanStart)

  const body: number[] = []
  const local: number[] = []
  const wide: number[] = []
  const presence: number[] = []
  const dryEdge: number[] = []
  const height: number[] = []
  const threshold: number[] = []
  const coverageScene: number[] = []
  const coverageP100: number[] = []
  const depositsF0: number[] = []
  const depositsF100: number[] = []
  const depositsScene: number[] = []
  const sceneSoftness = SOFTNESS_F0 + SOFTNESS_GAIN * (e.params.feather ?? 0)
  let paintedF0 = 0
  let paintedF100 = 0
  let paintedScene = 0
  let visibleF0 = 0
  let visibleF100 = 0
  let cover001 = 0
  let cover005 = 0
  let ink001 = 0
  let texels = 0
  const covers: number[] = []
  const coreTexels: { uvX: number; uvY: number }[] = []
  const colLo = Math.max(0, Math.ceil(xLo * e.dw - 0.5))
  const colHi = Math.min(e.dw - 1, Math.floor(xHi * e.dw - 0.5))
  for (let col = colLo; col <= colHi; col += 1) {
    const uvX = (col + 0.5) / e.dw
    for (let row = 0; row < e.dh; row += 1) {
      const uvY = (row + 0.5) / e.dh
      const axisX = -Math.sin(dab.angle)
      const axisY = Math.cos(dab.angle)
      const pX = (uvX - dab.x) * (e.dw / e.dh)
      const pY = uvY - dab.y
      const across = (pX * axisX + pY * axisY) / dab.r
      if (Math.abs(across) > 0.3) continue
      const twin = gatherTwinAt(uvX, uvY, dab, decoded, shape, count, e.dw, e.dh)
      if (twin.empty) continue
      texels += 1
      coreTexels.push({ uvX, uvY })
      body.push(twin.body)
      local.push(twin.local)
      wide.push(twin.wide)
      presence.push(twin.presence)
      dryEdge.push(twin.dryEdge)
      height.push(twin.height)
      threshold.push(twin.threshold)
      coverageScene.push(twin.coverageScene)
      coverageP100.push(twin.coverageP100)
      const depScene = smoothstep(twin.threshold - sceneSoftness, twin.threshold + sceneSoftness, twin.coverageScene)
      depositsF0.push(twin.depositF0)
      depositsF100.push(twin.depositF100)
      depositsScene.push(depScene)
      if (twin.depositF0 > 1e-3) paintedF0 += 1
      if (twin.depositF100 > 1e-3) paintedF100 += 1
      if (depScene > 1e-3) paintedScene += 1
      if (twin.depositF0 >= 0.5) visibleF0 += 1
      if (twin.depositF100 >= 0.5) visibleF100 += 1
      const cover = coverAt(fields, uvX * e.dw, uvY * e.dh)
      covers.push(cover)
      if (cover > 1e-3) cover001 += 1
      if (cover > 0.05) cover005 += 1
      if (filmPaintedAt(film, uvX, uvY)) ink001 += 1
    }
  }
  const sweepPressures = [0.35, 0.4, 0.5, 0.6, 0.75, 1.0]
  const pressureSweep = sweepPressures.map((p) => {
    let f0 = 0
    let f100 = 0
    let cov = 0
    for (const texel of coreTexels) {
      const twin = gatherTwinAt(texel.uvX, texel.uvY, { ...dab, pressure: p }, decoded, shape, count, e.dw, e.dh)
      cov += twin.coverageScene
      if (twin.depositF0 > 1e-3) f0 += 1
      if (twin.depositF100 > 1e-3) f100 += 1
    }
    return {
      p,
      f0: f0 / Math.max(coreTexels.length, 1),
      f100: f100 / Math.max(coreTexels.length, 1),
      coverage: cov / Math.max(coreTexels.length, 1),
    }
  })
  return {
    afterDab,
    headX: dab.x,
    alongPx: dab.alongPx,
    travelPx: dab.travelPx,
    pressure: dab.pressure,
    radiusPx: dab.r * e.dh,
    bristles: count,
    dabs: totalDabs,
    regionX: [xLo, xHi],
    coreAcross: 0.3,
    texels,
    load: stats(loads),
    body: stats(body),
    local: stats(local),
    wideOver5: stats(wide),
    presence: stats(presence),
    dryEdge: stats(dryEdge),
    height: stats(height),
    threshold: stats(threshold),
    coverageScene: stats(coverageScene),
    coverageP100: stats(coverageP100),
    predicted: {
      f0: paintedF0 / Math.max(texels, 1),
      f100: paintedF100 / Math.max(texels, 1),
      atSceneSoftness: paintedScene / Math.max(texels, 1),
    },
    predictedVisible: {
      f0: visibleF0 / Math.max(texels, 1),
      f100: visibleF100 / Math.max(texels, 1),
    },
    pressureSweep,
    measured: {
      cover001: cover001 / Math.max(texels, 1),
      cover005: cover005 / Math.max(texels, 1),
      ink001: ink001 / Math.max(texels, 1),
    },
    coverMean: covers.reduce((s, v) => s + v, 0) / Math.max(covers.length, 1),
    coverP90: stats(covers).p90,
  }
}

/** The deposited film's hue at the freshest dab centre (ink + fixed). */
function filmAt(
  engine: WatercolorEngine,
  x: number,
  y: number,
): { coeffs: number[]; hueDeg: number | null; chroma: number } {
  const e = engine as unknown as Internals
  const inkA16 = e.g.readHalf(e.ink.read.views[0]!, e.dw, e.dh, 4)
  // ink/fixed: attachment 0's RGBA = absorbance 0..3, attachment 1's RGB = 4..6.
  const inkB16 = e.g.readHalf(e.ink.read.views[1]!, e.dw, e.dh, 4)
  const fixA16 = e.g.readHalf(e.fixed.views[0]!, e.dw, e.dh, 4)
  const fixB16 = e.g.readHalf(e.fixed.views[1]!, e.dw, e.dh, 4)
  const inkA = new Float32Array(inkA16.length)
  const inkB = new Float32Array(inkB16.length)
  const fixA = new Float32Array(fixA16.length)
  const fixB = new Float32Array(fixB16.length)
  f16ToF32(inkA16, inkA)
  f16ToF32(inkB16, inkB)
  f16ToF32(fixA16, fixA)
  f16ToF32(fixB16, fixB)
  const tx = Math.min(e.dw - 1, Math.max(0, Math.round(x * e.dw)))
  const ty = Math.min(e.dh - 1, Math.max(0, Math.round(y * e.dh)))
  const i = ty * e.dw + tx
  const coeffs = [
    inkA[i * 4]! + fixA[i * 4]!,
    inkA[i * 4 + 1]! + fixA[i * 4 + 1]!,
    inkA[i * 4 + 2]! + fixA[i * 4 + 2]!,
    inkA[i * 4 + 3]! + fixA[i * 4 + 3]!,
    inkB[i * 4]! + fixB[i * 4]!,
    inkB[i * 4 + 1]! + fixB[i * 4 + 1]!,
    inkB[i * 4 + 2]! + fixB[i * 4 + 2]!,
  ]
  const c = coeffsHue(coeffs)
  return { coeffs, hueDeg: c.hueDeg, chroma: c.chroma }
}

// --- capture ----------------------------------------------------------------

interface Sample {
  index: number
  across: number
  load: number
  seed: number
  valueJitter: number
  carriedCoeffs: number[]
  carriedAlpha: number
  carriedHueDeg: number | null
  carriedChroma: number
  carriedSrgb: [number, number, number]
  gate: BristleTerms
}

interface Capture {
  afterDab: number
  perDab: {
    n: number
    travelPx: number
    travelWidths: number
    alongPx: number
    uNow: number
  }
  samples: Sample[]
  gather: ReturnType<typeof gatherSample>
  filmHueDeg: number | null
  filmChroma: number
}

function captureState(
  engine: WatercolorEngine,
  fields: Fields,
  afterDab: number,
  terms: DabTerms,
): Capture {
  const decoded = decodeBristles(engine)
  const shape = readShape(engine)
  const picks = targetBristles
  if (picks === null) throw new Error('capture before the bristle picks were fixed')
  const samples: Sample[] = [picks.centre, picks.rim].map((index) => {
    const across = decoded[2048 + index * 4 + 1]!
    const load = decoded[2048 + index * 4]!
    const seed = decoded[2048 + index * 4 + 2]!
    const valueJitter = decoded[2048 + index * 4 + 3]!
    const carriedCoeffs = [
      decoded[index * 4]!,
      decoded[index * 4 + 1]!,
      decoded[index * 4 + 2]!,
      decoded[index * 4 + 3]!,
      decoded[1024 + index * 4]!,
      decoded[1024 + index * 4 + 1]!,
      decoded[1024 + index * 4 + 2]!,
    ]
    const carriedAlpha = decoded[1024 + index * 4 + 3]!
    const c = coeffsHue(carriedCoeffs)
    return {
      index,
      across,
      load,
      seed,
      valueJitter,
      carriedCoeffs,
      carriedAlpha,
      carriedHueDeg: c.hueDeg,
      carriedChroma: c.chroma,
      carriedSrgb: c.srgb,
      gate: terms.bristles.find((b) => b.index === index) ?? terms.bristles[0]!,
    }
  })
  const film = filmAt(engine, terms.x, terms.y)
  return {
    afterDab,
    perDab: {
      n: terms.n,
      r: terms.r,
      travelPx: terms.travelPx,
      travelWidths: terms.travel,
      alongPx: terms.alongPx,
      pressure: terms.pr,
      uNow: terms.uNow,
    },
    samples,
    gather: gatherSample(engine, fields, terms),
    filmHueDeg: film.hueDeg,
    filmChroma: film.chroma,
  }
}

// --- scene ------------------------------------------------------------------

function horizontalPoints(pressure: number): readonly AquarellePoint[] {
  return [0.12, 0.3733, 0.6267, 0.88].map((x) => ({ x, y: 0.5, p: pressure, tx: 0, ty: 0, tw: 0 }))
}

interface SceneConfig {
  scene: 'band' | 'blank'
  blueSize: number
  dry: number
  feather: number
  pickup: number
  body: number
  pressure: number
}

let sceneConfig: SceneConfig = {
  scene: 'band',
  blueSize: 17,
  dry: 50,
  feather: 0,
  pickup: 100,
  body: 0,
  pressure: 0.75,
}

let midReport: MidReport | null = null
let midDab = 0

function paramsBag(
  sizePx: number,
  pickup: number,
  feather: number,
  body: number,
  dry = 0,
): Record<string, number> {
  return {
    size: sizePx,
    water: 50,
    load: 50,
    flow: 50,
    bleed: 50,
    dry,
    edge: 50,
    granulation: 50,
    lift: 22,
    pickup,
    feather,
    body,
    refill: 0,
    wetSeconds: WET_SECONDS_DEFAULT,
  }
}

function makeStroke(
  color: string,
  bag: Record<string, number>,
  mutationId: number,
): StudioStroke<AquarelleStrokePayload> {
  return toStudioStroke({
    tool: 'brush',
    color,
    params: bag,
    brushId: BRUSH_ID,
    points: horizontalPoints(sceneConfig.pressure).map((point) => ({ ...point })),
    mutationId,
    timestamp: 0,
  })
}

// --- install the hooks (once) ------------------------------------------------

type Proto = {
  setManual: (manual: boolean) => void
  beginBristles: (radiusValue: number) => void
  carrierPass: (
    x: number,
    y: number,
    r: number,
    angle: number,
    travel: number,
    travelPx: number,
    alongPx: number,
    pr: number,
  ) => void
}

const enginePrototype = WatercolorEngine.prototype as unknown as Proto
const originalSetManual = enginePrototype.setManual
enginePrototype.setManual = function patchedSetManual(this: WatercolorEngine, manual: boolean) {
  if (capturedEngine === null) capturedEngine = this
  return originalSetManual.call(this, manual)
}

const originalBeginBristles = enginePrototype.beginBristles
enginePrototype.beginBristles = function patchedBeginBristles(this: WatercolorEngine, radiusValue: number) {
  strokeSeq += 1
  dabCount = 0
  pendingTerms = null
  targetBristles = null
  return originalBeginBristles.call(this, radiusValue)
}

const originalCarrierPass = enginePrototype.carrierPass
enginePrototype.carrierPass = function patchedCarrierPass(
  this: WatercolorEngine,
  x: number,
  y: number,
  r: number,
  angle: number,
  travel: number,
  travelPx: number,
  alongPx: number,
  pr: number,
) {
  if (strokeSeq === blueStrokeSeq) {
    // The GPU state right now is "after dabCount dabs": the previous dab's
    // carrier, deposit, coverage write and touch stamp have all landed.
    const completed = dabCount
    const justFinished = pendingTerms
    if (completed > 0 && targetSet.has(completed) && justFinished !== null && !captures.has(completed)) {
      const fields = readFields(this)
      captures.set(completed, captureState(this, fields, completed, justFinished))
    }
    // This dab's own terms read the PRE-dab fields — exactly what its carrier
    // will read. Measured only for the target dabs.
    if (targetSet.has(completed + 1)) {
      const fields = readFields(this)
      const decoded = decodeBristles(this)
      const shape = readShape(this)
      if (targetBristles === null) {
        const pinned = readPinnedPair()
        targetBristles =
          pinned === null
            ? pickBristles(this, fields, { x, y, r, angle })
            : {
                centre: pinned.centre,
                rim: pinned.rim,
                centreNominal: pinned.centre,
                count: (this as unknown as Internals).bristleCount,
              }
      }
      const picks = targetBristles
      const uNow = (this as unknown as Internals).clock() / 1000
      const dab = { x, y, r, angle, alongPx, pr, uNow }
      const indices = [picks.centre, picks.rim]
      pendingTerms = {
        n: completed + 1,
        x,
        y,
        r,
        angle,
        travel,
        travelPx,
        alongPx,
        pr,
        uNow,
        bristles: indices.map((index) =>
          bristleTermsAt(fields, this, shape, decoded, index, { ...dab, travel }),
        ),
      }
    }
    // BLANK scenes only: the mid-stroke porosity readout at the first dab at
    // or past x = 0.5. The fields and the film read here hold the state after
    // `completed` dabs — exactly what the next gather will see.
    if (sceneConfig.scene === 'blank' && midReport === null && completed > 0 && x >= MID_X) {
      const fields = readFields(this)
      const film = readFilmFields(this)
      midReport = midStrokeReport(
        this,
        fields,
        film,
        { x, y, r, angle, alongPx, travelPx, pressure: pr },
        completed,
        0,
      )
      midDab = completed
    }
  }
  dabCount += 1
  return originalCarrierPass.call(this, x, y, r, angle, travel, travelPx, alongPx, pr)
}

const captures = new Map<number, Capture>()

/** Debug: the raw cover / last-touch columns at a few x positions. */
function dumpFields(engine: WatercolorEngine): Record<string, unknown> {
  const e = engine as unknown as Internals
  const f = readFields(engine)
  const rows = [200, 240, 259, 280, 296, 297, 298, 299, 300, 301, 302, 303, 304, 320, 340, 360, 400]
  const cols = [0.13, 0.5]
  return {
    dw: e.dw,
    dh: e.dh,
    stitches: cols.map((x) => {
      const col = Math.round(x * f.dw)
      return {
        x,
        col,
        rows: rows.map((row) => ({
          row,
          rawCover: Number(f.cover[row * f.dw + col]!.toFixed(4)),
          rawStamp: Number(f.stamps[row * f.dw + col]!.toFixed(3)),
          cover: Number(coverAt(f, x * f.dw, row + 0.5).toFixed(4)),
          stamp: Number(stampAt(f, x * f.dw, row + 0.5).toFixed(3)),
        })),
      }
    }),
  }
}

// --- runner -----------------------------------------------------------------

function readSceneConfig(): SceneConfig {
  const params = new URLSearchParams(location.search)
  const sceneRaw = params.get('scene')
  const scene: 'band' | 'blank' =
    sceneRaw === null || sceneRaw === '' ? 'band' : sceneRaw === 'blank' ? 'blank' : sceneRaw === 'band' ? 'band' : (() => {
      throw new Error(`invalid scene "${sceneRaw}"`)
    })()
  const sizeRaw = params.get('size') ?? params.get('blueSize')
  const blueSize = sizeRaw === null || sizeRaw === '' ? 17 : Number(sizeRaw)
  if (!Number.isInteger(blueSize) || blueSize < 1 || blueSize > 800) {
    throw new Error(`invalid size "${sizeRaw}"`)
  }
  const number = (name: string, fallback: number): number => {
    const raw = params.get(name)
    if (raw === null || raw === '') return fallback
    const value = Number(raw)
    if (!Number.isFinite(value)) throw new Error(`invalid ${name} "${raw}"`)
    return value
  }
  return {
    scene,
    blueSize,
    dry: number('dry', 50),
    feather: number('feather', 0),
    pickup: number('pickup', 100),
    body: number('body', 0),
    pressure: number('pressure', 0.75),
  }
}

/** Optional pinned pair, so a second build reads the SAME bristles. */
function readPinnedPair(): { centre: number; rim: number } | null {
  const params = new URLSearchParams(location.search)
  const centre = params.get('centre')
  const rim = params.get('rim')
  if (centre === null || rim === null) return null
  return { centre: Number(centre), rim: Number(rim) }
}

function runScene(config: SceneConfig, renderer: string): Record<string, unknown> {
  if (!COLD) throw new Error("paper preset 'cold' is not in PAPERS")
  const blueSize = config.blueSize
  const bandSize = Math.round(blueSize * (BAND_FRACTION / BLUE_FRACTION))

  capturedEngine = null
  strokeSeq = 0
  dabCount = 0
  pendingTerms = null
  targetBristles = null
  captures.clear()
  midReport = null
  midDab = 0

  const adapter = createAquarelleEngineAdapter({
    width: SHEET_W,
    height: SHEET_H,
    paperPreset: COLD,
    paperStrength: PAPER_STRENGTH,
    paperSeed: PAPER_SEED,
  })

  try {
    const engine = capturedEngine
    if (engine === null) throw new Error('probe never captured the adapter engine')
    const settle = (): void => {
      for (let tick = 0; tick <= SETTLE_TICKS; tick += 1) adapter.stepTick(tick)
    }
    let fieldDumpBand: Record<string, unknown> | null = null
    if (config.scene === 'band') {
      adapter.applyStroke(makeStroke(BAND_COLOR, paramsBag(bandSize, 0, 0, 0), 0x7ec000))
      settle()
      fieldDumpBand = dumpFields(engine)
    }
    adapter.applyStroke(
      makeStroke(
        BLUE_COLOR,
        paramsBag(blueSize, config.pickup, config.feather, config.body, config.dry),
        0x7ec001,
      ),
    )
    const fieldDumpFinal = dumpFields(engine)
    // The stroke is deposited synchronously; the final state is "after the
    // last dab". Its gate is the last target dab's terms when one was taken.
    const totalDabs = dabCount
    const finalTerms = pendingTerms
    if (finalTerms !== null && !captures.has(totalDabs) && targetSet.has(totalDabs)) {
      const fields = readFields(engine)
      captures.set(totalDabs, captureState(engine, fields, totalDabs, finalTerms))
    }

    const ordered = [...captures.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, capture]) => capture)
    const picks = targetBristles
    const mid = midReport === null ? null : { ...midReport, dabs: totalDabs, captureAtDab: midDab }
    return {
      scene: config.scene,
      config,
      blueSize,
      bandSize,
      totalDabs,
      centreIndex: picks?.centre ?? null,
      rimIndex: picks?.rim ?? null,
      centreNominalIndex: picks?.centreNominal ?? null,
      bristleCount: picks?.count ?? null,
      captures: ordered,
      mid,
      fieldDumpBand,
      fieldDumpFinal,
      renderer,
      verdict: 'PICKUP-COLLAPSE CAPTURED',
    }
  } finally {
    adapter.dispose()
  }
}

function main(): void {
  let config: SceneConfig = { scene: 'band', blueSize: 17, dry: 50, feather: 0, pickup: 100, body: 0, pressure: 0.75 }
  let renderer = '(unknown)'
  try {
    config = readSceneConfig()
    sceneConfig = config
    blueStrokeSeq = config.scene === 'band' ? 2 : 1
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const probe = new WatercolorEngine(canvas, null, {}, [64, 64])
    try {
      const gl = (probe as unknown as { gl: WebGL2RenderingContext }).gl
      renderer = String(gl.getParameter(gl.RENDERER))
    } finally {
      probe.destroy()
    }
    const result = runScene(config, renderer)
    const pre = document.getElementById('result')
    if (!pre) throw new Error('probe page is missing pre#result')
    pre.textContent = JSON.stringify(result)
    pre.setAttribute('data-verdict', 'PICKUP-COLLAPSE CAPTURED')
    const status = document.getElementById('status')
    if (status) status.textContent = 'DONE'
    console.log(
      'PICKUP_COLLAPSE_RESULT ' +
        JSON.stringify({ scene: config.scene, size: config.blueSize, verdict: 'PICKUP-COLLAPSE CAPTURED' }),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const pre = document.getElementById('result')
    if (pre) pre.textContent = JSON.stringify({ config, renderer, verdict: `PICKUP-COLLAPSE FAIL ${message}`, error: message })
    const status = document.getElementById('status')
    if (status) status.textContent = 'FAILED'
  }
}

main()
