// ============================================================
//  Medium engine — neutral-identity pixel gate (Phase 64 Wave 1).
//
//  SCRATCH HARNESS ONLY. Imports engine internals, touches no product
//  code. Runs the REAL vendored WebGL2 WatercolorEngine in headless
//  Chrome and digests the exported raster of ONE fixed stroke on the
//  `cold` sheet at paperTexture 1.
//
//  Why: every term this phase adds to the medium (viscosity first) must
//  be neutral at its default. A committed pre-milestone baseline is the
//  only way to prove "a project painted before this milestone renders
//  bit-identically after it" instead of assuming it. The baseline is
//  captured BEFORE any source edit (64-01 task 1) and is never
//  regenerated after the change lands.
//
//  The scenario is fixed on purpose: sheet size, paper preset, paper
//  strength, stroke script, mutationId, tick count and the seeded
//  constructor draw are all constants. Only the exported bytes vary.
//
//  Output: one JSON report in <pre id="result">; run.mjs writes it to
//  /tmp/medium-engine/<gate>.json and compare.mjs diffs it against
//  probe/medium-engine/baselines/<gate>.json (or a sibling capture).
//  The report digests all four exports (paper, transparent, white and, since
//  64-17, pigment — the coverage-aware compositor sheet) and echoes the 64-04
//  `--light <0..4>` intensity it was shaded with.
//
//  64-06 adds the Body matrix: `--body <0..100>` folds the canonical key into
//  EVERY stroke's params bag, and `--scenario cover` swaps the fixed
//  single-stroke script for a two-stroke script (dark across, fix, light
//  crossing at an angle, fix) so Body 0 and Body 100 can be compared on the
//  same scene. The neutral scenario is byte-for-byte the plan-01 script, so
//  the no-body neutral gate still reproduces the committed baseline. Every
//  run also reports `bakeMs` (the script + settle, exports excluded) so the
//  cover pass's cost can be measured as the cover-on / cover-off median
//  delta.
//
//  64-10 adds the size and duration operands: `--size <32..4096>` renders the
//  same scenario on a square sheet of that side (absent keeps the 256 default),
//  so the scattering composite can be measured at high definition, and every
//  report carries `renderMs` beside `bakeMs` — the wall clock of the render
//  phase proper, the three exports and their readbacks. All three exported
//  backgrounds (paper, transparent, white) have been digested since 64-01;
//  this plan exercises them on the scattered render rather than adding a
//  digest.
//
//  quick-261117-tq7 adds `--scenario cover-over-wet`: the SAME dark-across /
//  light-crossing geometry as `cover`, but the dark entry skips its fix
//  (`fixAfter: false`), so the underlayer is still MOBILE in `ink` when the
//  covering stroke runs. One mechanism reaches both underlayers (64-17
//  re-specification of the 64-13 coverage model): each covering dab's own
//  coverage term attenuates the still-mobile ink
//  (`ink <- ink·(1−a) + C·a`, the same `a` that carries the coverage), and the
//  same dab's coverPass erodes the settled `fixed` pigment first — no
//  stroke-start snapshot is involved. Two historical captures stay committed
//  as digest-differs anchors only: cover-over-wet-prefix (the engine before
//  the cover feature) and cover-over-wet-subtract (the pre-CR-01 clamped
//  subtract).
//
//  WR-01 (same quick): a digest-differs check cannot tell "underlayer covered,
//  covering pigment intact" from "covering stroke erased" or "colors
//  inverted", so the cover-over-wet report also carries four bounded region
//  means (doc uv boxes, full-resolution samples, mean pigment 255 − luma on
//  the TRANSPARENT export: 0 is bare paper):
//    coverCrossPigment  the intersection neighbourhood. Under the coverage
//                       model the covering stroke deposits its own near-opaque
//                       body here (measured 49.66 on the 256 sheet, with
//                       own-pigment 14.54 against the erase era's 3.47), so
//                       the gate asserts the self-contained outcome — at least
//                       the covering stroke alone, below the untouched dark
//                       band — never a direction against an erase-era capture.
//    coverOwnPigment    the covering diagonal clear of the dark band: proof
//                       the covering stroke deposited pigment at all.
//    underBandPigment   the dark band clear of the diagonal: control the
//                       crossing must read below.
//    paperBandPigment   bare paper: the zero control.
//  compare.mjs asserts these for every cover-over-wet capture. Only that
//  scenario emits them, so every other scenario's report shape is unchanged.
//
//  64-17 adds the coverage sheet to the gate: `engine.exportCanvas('pigment')`
//  is the mode-4 COMPOSITOR view, whose alpha is max(1 − min(rgb), cover) —
//  the exact alpha 64-15 carries into the app commit — so every report
//  digests it as `digestPigment` beside the three backgrounds and run.mjs
//  refuses a capture without it. Adding the export leaves the other three
//  byte-identical, which the neutral identity gate proves on every run.
//
//  64-17 also adds the drive cadence the 1080² 50-stroke passage needs: a
//  ScriptEntry carries an optional `settle` (ticks 0..settle, default
//  SETTLE_TICKS), and a rapid entry (`fixAfter: false`) is fixed every tenth
//  stroke and once after the loop — the spike harness's exact cadence
//  (.planning/spikes/001-coverage-composite/probe/probe.ts:603-618). No
//  pre-existing script carries a rapid entry, so `neutral`, `cover` and
//  `cover-over-wet`'s fixed entries keep their old drive byte-for-byte. The
//  trailing fix is a no-op for cover-over-wet — its covering stroke already
//  fixes after itself, so removing the trailing fix leaves that export
//  byte-identical. The cover-over-wet digest moved when 64-13 landed the
//  coverage composite, not from this drive; task 3 re-captures it.
//
//  Scenario list (64-17): `watercolor-50` is the spike's identity passage —
//  50 rapid #cc2222 strokes on blank paper at Body 0, settle 1 — captured at
//  `--size 1080` and committed as the second half of the Body-0 identity law
//  (neutral-identity is the 256² half). The script is the spike's verbatim
//  (.planning/spikes/001-coverage-composite/probe/probe.ts:459-473).
//
//  64-17 also adds `white-over-blue` (Spike 001 criterion 1): a saturated
//  #0044dd band at Body 0, fixed, then a #f0f0f0 diagonal at the Body knob
//  (default 100) crossing it. The pigment export's alpha IS the compositor
//  alpha (mode 4: alpha = max(1 − min(rgb), cover)), so a coverage claim can
//  be measured from an export at all; `crossDarkAlpha` is measured on the
//  TRANSPARENT export on purpose — it is the exact alpha the pre-coverage
//  commit derived from the sheet, so `crossCoverAlpha − crossDarkAlpha` is the
//  change the model makes to the committed payload.
//
//  64-20 adds the offender census beside the criterion-1 percentage:
//  `coveredPaperWhiteBox` reports the covered count, the offending count and
//  the offending texels' union bbox in doc uv (null when none offend), so a
//  failing scan names its texels instead of only its percentage. It shares
//  `coveredPaperWhitePct`'s single texel loop and threshold — the percentage
//  can never disagree with the census it reports.
//
//  64-14 adds `cover-advect`: the cover geometry with the covering stroke left
//  WET (`fixAfter: false`), so the gate can watch the coverage channel travel
//  with its pigment through the wet simulation. The report carries the
//  crossing box's mean and peak alpha on the PIGMENT export before and after
//  eight extra wet ticks, plus the covered-paper-white scan after them; the
//  mode-4 alpha is max(darkness, cover), and at Body 100 the white pigment's
//  own darkness alpha is a few percent, so the crossing alpha is ~cover.
//
//  64-14 also adds `cover-lift`: the cover geometry fully fixed, then a LIFT
//  stroke (the same tool through the same applyStroke seam at pressure 0.8)
//  across the covering diagonal. The report carries the crossing alpha on the
//  PIGMENT export before and after the lift stroke, plus the paper-white scan
//  after it — the bounded limitation "Lift does not reduce coverage" becomes
//  a measured assertion.
//
//  64-16 adds the brush operand and the textured-tip scenario: `--brush <id>`
//  selects the covering stroke's brush (resolved against BRUSH_PRESETS, an
//  unknown id throws with the known list), and `cover-textured` paints the
//  `cover` geometry with that brush on the light diagonal (default `chalk`)
//  so a chalk stroke's coverage can be measured as a SPREAD rather than a
//  solid disc. The report adds the alpha distribution over TEXTURED_BOX —
//  mean, P10, P90, covered fraction — plus the crossing's blue excess and the
//  whole-sheet paper-white scan, all on the pigment export. The pigment alpha
//  IS the coverage alpha by construction (mode 4: alpha = max(1 − min(rgb),
//  cover)), which is why a coverage claim can be measured from an export.
//
//  64-16 also adds `red-over-blue-50` — Spike 001 criterion 2: a dry blue field
//  at Body 0, 50 rapid red strokes at the Body knob with settle 1 and no
//  per-entry fix, then ONE red reference stroke on clean paper on the same
//  sheet. The report carries the field's and the reference's mean luma and hue
//  (the spike's own rgbToHsv formula, measured on the PIGMENT export's rgb) as
//  `finalLuma`, `referenceLuma`, `lumaRatio` and `deltaHue` in signed degrees,
//  plus the whole-sheet paper-white scan; compare.mjs gates the criterion's
//  stated tolerance (ratio ≥ 0.95, |Δhue| ≤ 3°, no paper-white) in every mode.
//
//  64-23 adds `bristle-edge` — the directional-edge census: two horizontal
//  `bristle-flat` strokes of the same length and speed on blank paper, the
//  first at Feather 0 and the second at Feather 100. The report carries each
//  stroke's edge softness (the median 90 %-10 % width) and edge variation
//  (the P90−P10 of the 50 % crossing) in document pixels, plus the measured
//  edge half-width and each stroke's interior plateau, read on the
//  TRANSPARENT export's deposited darkness (`1 − min(rgb)` = the engine's
//  `darkAlpha`), not the mode-4 pigment alpha: the coverage channel is a
//  saturated union on a bristle stroke (see the census section's field note),
//  so the film's transmittance is where D-22's feather band is visible.
//  compare.mjs gates the cardinal relation — both softnesses finite and > 0,
//  the Feather-100 softness strictly wider than the Feather-0 one, both
//  variations > 0, and the wide softness narrower than the measured edge
//  half-width — so a non-directional (perfectly smooth) edge and a
//  feather-blind edge both fail.
//
//  64-24 adds `bristle-wet` — the wetness acceptance on ONE sheet and ONE
//  brush: two identical light bands, the LEFT one aged thirty virtual seconds
//  and re-wetted by a `water` swash (which touches neither the coverage
//  channel nor the last-touch field), the RIGHT one painted fresh after that
//  advance, then one dark crossing stroke over both. Two readings, as mean
//  film darkness on the TRANSPARENT export (255 − mean RGB luma — the field
//  64-23's census measured on): `pickupFreshMean` over the right band's
//  crossing region and `pickupAgedWetMean` over the left. A fresh crossing
//  picks the underlayer's pigment into its carrier and lays that instead of
//  its own palette; a thirty-second-old one has nothing to give. compare.mjs
//  gates only the RELATION facts (both finite and positive, both in range,
//  |fresh − aged| >= 1 luma); the direction is recorded evidence. The
//  `wetMode` operand selects the A/B: 1 is the shipped timestamp law, 0 is
//  64-21's `wet × coverage` proxy, the control.
//
//  Scenarios: neutral | cover | cover-over-wet | watercolor-50 | white-over-blue
//           | cover-advect | cover-lift | cover-textured | red-over-blue-50
//           | bristle-edge | bristle-wet.
// ============================================================

import { WatercolorEngine } from '../../src/playground/Engine'
import { BRUSH_PRESETS } from '../../src/playground/brushes'
import { PAPERS, type PaperPreset } from '../../src/playground/papers'
import { createAquarelleEngineAdapter } from '../../src/adapter/engineAdapter'
import {
  toStudioStroke,
  type AquarellePoint,
  type AquarelleStrokePayload,
} from '../../src/payload/toStudioStroke'
import type { StudioStroke } from '@efxlab/efx-paint-host/animation'

// The sheet the gate renders unless `--size` says otherwise. Small enough
// for a fast headless run, large enough that one stroke of the fixed script
// is well above the paper-grain noise floor.
const DEFAULT_SHEET = 256
// 64-10: the square-sheet knob's band. The cost matrix's high-definition
// sheet is 1024 (16x the default's pixels) — no HD constant exists in the
// phase docs, so the probe fixes one here and later plans reuse it rather
// than retype it.
const MIN_SHEET = 32
const MAX_SHEET = 4096
// Pinned constructor draw: the engine's `paperSeed` comes from
// Math.random before the adapter installs its own RNG, so an unpinned
// constructor makes every digest meaningless.
const PAPER_SEED = 0xc0ffee
const PAPER_STRENGTH = 1
const MUTATION_ID = 0x6d65d1
const STROKE_COLOR = '#2244aa'
const BRUSH_ID = 'round'
const SETTLE_TICKS = 8
// 64-14: the advect gate's wet window — steps taken between the two cover
// captures of the `cover-advect` scenario.
const ADVECT_TICKS = 8

// The canonical bag exactly as the app records it (0..100), one key per
// global. No `viscosity` / `emboss` key: this gate proves the ABSENT key
// keeps the pre-milestone render — that is the neutral-default contract.
// 64-03: `--emboss <0..100>` folds the value into this bag; the scenario is
// otherwise identical, so any digest change would be a deposit leak.
const STROKE_PARAMS: Readonly<Record<string, number>> = {
  size: 12,
  water: 50,
  load: 50,
  flow: 50,
  bleed: 50,
  dry: 50,
  edge: 50,
  granulation: 50,
  lift: 22,
}

// Four pressure samples along a shallow diagonal (doc uv, y up).
const STROKE_POINTS: readonly AquarellePoint[] = [
  { x: 0.3, y: 0.3, p: 0.55, tx: 0, ty: 0, tw: 0 },
  { x: 0.42, y: 0.4, p: 0.7, tx: 0, ty: 0, tw: 0 },
  { x: 0.56, y: 0.52, p: 0.62, tx: 0, ty: 0, tw: 0 },
  { x: 0.7, y: 0.62, p: 0.45, tx: 0, ty: 0, tw: 0 },
]

// --- 64-06 cover scenario -------------------------------------------------
// Two strokes with identical params, so the ONLY difference between the
// cover-off (body 0) and cover-on (body 100) gates is the Body value.
// Stroke A lays a dark band across the sheet and is fixed dry; stroke B
// crosses it at an angle in a light pigment, so Body 0 reads dark-through
// and Body 100 replaces the settled dark under B's own tip.
const COVER_DARK = '#111111'
const COVER_LIGHT = '#dddddd'
const COVER_DARK_POINTS: readonly AquarellePoint[] = [
  { x: 0.16, y: 0.36, p: 0.7, tx: 0, ty: 0, tw: 0 },
  { x: 0.38, y: 0.34, p: 0.7, tx: 0, ty: 0, tw: 0 },
  { x: 0.6, y: 0.37, p: 0.7, tx: 0, ty: 0, tw: 0 },
  { x: 0.84, y: 0.35, p: 0.7, tx: 0, ty: 0, tw: 0 },
]
const COVER_LIGHT_POINTS: readonly AquarellePoint[] = [
  { x: 0.22, y: 0.74, p: 0.7, tx: 0, ty: 0, tw: 0 },
  { x: 0.42, y: 0.57, p: 0.7, tx: 0, ty: 0, tw: 0 },
  { x: 0.62, y: 0.4, p: 0.7, tx: 0, ty: 0, tw: 0 },
  { x: 0.82, y: 0.2, p: 0.7, tx: 0, ty: 0, tw: 0 },
]

const COLD: PaperPreset | undefined = PAPERS.find((preset) => preset.id === 'cold')

// --- deterministic RNG (same mulberry32 as the adapter) --------------------

function seededRandom(seed: number): () => number {
  let state = (seed | 0) || 1
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function withSeededMathRandom<T>(seed: number, fn: () => T): T {
  const original = Math.random
  const rng = seededRandom(seed)
  Math.random = () => rng()
  try {
    return fn()
  } finally {
    Math.random = original
  }
}

// --- engine capture ---------------------------------------------------------

// The adapter owns its engine and does not expose it, but the gate needs
// the same instance to export `paper` and `white` backgrounds (the
// adapter's captureFrame only exposes `transparent`). `setManual` is the
// first call the adapter makes on the engine it just constructed, so a
// prototype tap on it records the exact instance the adapter drives —
// the same scratch-harness idiom vector-spine uses for `stamp`.
let capturedEngine: WatercolorEngine | null = null
const enginePrototype = WatercolorEngine.prototype as unknown as {
  setManual: (manual: boolean) => void
}
const originalSetManual = enginePrototype.setManual
enginePrototype.setManual = function patchedSetManual(this: WatercolorEngine, manual: boolean) {
  if (capturedEngine === null) capturedEngine = this
  return originalSetManual.call(this, manual)
}

// --- digests ----------------------------------------------------------------

/** FNV-1a over the capture bytes — unsigned 32-bit hex. */
function hashPixels(buffer: Uint8ClampedArray): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < buffer.length; i += 1) {
    hash ^= buffer[i]!
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

interface Digest {
  readonly digest: string
  readonly byteLength: number
}

function digestCanvas(canvas: HTMLCanvasElement): Digest {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('digest: exported canvas has no 2D context')
  const buffer = new Uint8ClampedArray(ctx.getImageData(0, 0, canvas.width, canvas.height).data)
  return { digest: hashPixels(buffer), byteLength: buffer.length }
}

// --- WR-01 region statistics -------------------------------------------------

/** One axis-aligned sample box in doc uv (y up, like the stroke scripts). */
interface BandBox {
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
}

/**
 * The four boxes the cover-over-wet gate asserts on. The script is fixed: a
 * dark band across y≈0.35 and a light diagonal from (0.22, 0.74) to
 * (0.82, 0.20), crossing at ≈(0.66, 0.36). Every box is clear of the other
 * stroke except `crossing`; the measured region means are documented in
 * compare.mjs beside the invariants.
 */
const COVER_BOXES: Readonly<Record<'crossing' | 'own' | 'under' | 'paper', BandBox>> = {
  // The intersection neighbourhood: the cover's erasure happens inside it.
  crossing: { x0: 0.62, y0: 0.3, x1: 0.72, y1: 0.4 },
  // The covering diagonal between its first two knots, clear of the band.
  own: { x0: 0.26, y0: 0.6, x1: 0.36, y1: 0.7 },
  // The dark band between its first two knots, clear of the diagonal.
  under: { x0: 0.24, y0: 0.32, x1: 0.34, y1: 0.4 },
  // Bare paper above the whole script: the zero control.
  paper: { x0: 0.45, y0: 0.82, x1: 0.55, y1: 0.92 },
}

/**
 * 64-14: the lifecycle scenarios' alpha box. `COVER_BOXES.crossing` is a
 * REGION box for mean pigment — at 0.1 × 0.1 doc it averages the two strokes
 * with the bare paper around them, which dilutes an alpha mean to ~0.5. The
 * alpha gates ask "is the covering stroke still covering", so they read a
 * five-pixel window (the same framing Spike 001's criterion-1 box uses) on
 * the covering stroke's alpha plateau inside the crossing neighbourhood.
 *
 * The window is where the plateau is measured, not the geometric intersection
 * itself: the covering diagonal is `y = 0.4 - (x - 0.62)` and the dark band is
 * `y = 0.37 - (x - 0.6) * 0.02 / 0.24`, crossing at (0.6545, 0.3655), but the
 * film's grain-scale union reads 0.89 mean there. Scanning the 24 px
 * neighbourhood for the maximum 5 × 5 mean finds 0.90 at (0.6465, 0.3652) —
 * the plateau this box pins. Both moving readings (eight advect ticks, the
 * lift scrub) act through the same footprint, so neither is diluted by an
 * off-centre box.
 */
const COVER_LIFECYCLE_BOXES: Readonly<Record<'crossing', BandBox>> = {
  crossing: { x0: 0.6367, y0: 0.3555, x1: 0.6563, y1: 0.3750 },
}

/**
 * Mean pigment (255 − mean RGB luma) over a box, 0..255, measured on an
 * opaque-transmittance export: 0 is bare paper and larger is denser medium.
 * Export rows are top-first while doc uv is y-up, so the row span flips.
 */
function bandPigment(canvas: HTMLCanvasElement, box: BandBox): number {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('band pigment: exported canvas has no 2D context')
  const w = canvas.width
  const h = canvas.height
  const x0 = Math.max(0, Math.min(w - 1, Math.round(box.x0 * w)))
  const x1 = Math.max(x0 + 1, Math.min(w, Math.round(box.x1 * w)))
  const y0 = Math.max(0, Math.min(h - 1, Math.round((1 - box.y1) * h)))
  const y1 = Math.max(y0 + 1, Math.min(h, Math.round((1 - box.y0) * h)))
  const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data
  let sum = 0
  let n = 0
  for (let i = 0; i < data.length; i += 4) {
    sum += 255 - (data[i]! + data[i + 1]! + data[i + 2]!) / 3
    n += 1
  }
  return n > 0 ? sum / n : 0
}

/** Fixed two decimals: stable JSON, and printing stays readable. */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** Mean RGB channels and mean(B) − mean(R) over a box on the transparent export. */
function bandStats(
  canvas: HTMLCanvasElement,
  box: BandBox,
): { mean: readonly [number, number, number]; blueExcess: number } {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('band stats: exported canvas has no 2D context')
  const w = canvas.width
  const h = canvas.height
  const x0 = Math.max(0, Math.min(w - 1, Math.round(box.x0 * w)))
  const x1 = Math.max(x0 + 1, Math.min(w, Math.round(box.x1 * w)))
  const y0 = Math.max(0, Math.min(h - 1, Math.round((1 - box.y1) * h)))
  const y1 = Math.max(y0 + 1, Math.min(h, Math.round((1 - box.y0) * h)))
  const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]!
    g += data[i + 1]!
    b += data[i + 2]!
    n += 1
  }
  const mean: [number, number, number] = [r / n, g / n, b / n]
  return { mean, blueExcess: mean[2] - mean[0] }
}

/** Mean alpha, 0..1, over a box on the mode-4 pigment export. */
function alphaMean(canvas: HTMLCanvasElement, box: BandBox): number {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('alpha mean: exported canvas has no 2D context')
  const w = canvas.width
  const h = canvas.height
  const x0 = Math.max(0, Math.min(w - 1, Math.round(box.x0 * w)))
  const x1 = Math.max(x0 + 1, Math.min(w, Math.round(box.x1 * w)))
  const y0 = Math.max(0, Math.min(h - 1, Math.round((1 - box.y1) * h)))
  const y1 = Math.max(y0 + 1, Math.min(h, Math.round((1 - box.y0) * h)))
  const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data
  let sum = 0
  let n = 0
  for (let i = 3; i < data.length; i += 4) {
    sum += data[i]!
    n += 1
  }
  return n > 0 ? sum / n / 255 : 0
}

/** Mean and peak alpha, 0..1, over a box on the mode-4 pigment export (64-14). */
function alphaStats(canvas: HTMLCanvasElement, box: BandBox): { mean: number; peak: number } {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('alpha stats: exported canvas has no 2D context')
  const w = canvas.width
  const h = canvas.height
  const x0 = Math.max(0, Math.min(w - 1, Math.round(box.x0 * w)))
  const x1 = Math.max(x0 + 1, Math.min(w, Math.round(box.x1 * w)))
  const y0 = Math.max(0, Math.min(h - 1, Math.round((1 - box.y1) * h)))
  const y1 = Math.max(y0 + 1, Math.min(h, Math.round((1 - box.y0) * h)))
  const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data
  let sum = 0
  let peak = 0
  let n = 0
  for (let i = 3; i < data.length; i += 4) {
    sum += data[i]!
    peak = Math.max(peak, data[i]!)
    n += 1
  }
  return { mean: n > 0 ? sum / n / 255 : 0, peak: peak / 255 }
}

/** Mean of 1 − min(r, g, b)/255 over a box on the transparent export — the
 *  alpha the pre-coverage commit derived from the sheet. */
function darkAlphaMean(canvas: HTMLCanvasElement, box: BandBox): number {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('dark alpha mean: exported canvas has no 2D context')
  const w = canvas.width
  const h = canvas.height
  const x0 = Math.max(0, Math.min(w - 1, Math.round(box.x0 * w)))
  const x1 = Math.max(x0 + 1, Math.min(w, Math.round(box.x1 * w)))
  const y0 = Math.max(0, Math.min(h - 1, Math.round((1 - box.y1) * h)))
  const y1 = Math.max(y0 + 1, Math.min(h, Math.round((1 - box.y0) * h)))
  const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data
  let sum = 0
  let n = 0
  for (let i = 0; i < data.length; i += 4) {
    sum += 1 - Math.min(data[i]!, data[i + 1]!, data[i + 2]!) / 255
    n += 1
  }
  return n > 0 ? sum / n : 0
}

/** The covered-paper-white census: which texels a failing scan counts. */
interface CoveredPaperWhiteCensus {
  /** Texels the pigment layer claims to cover (mode-4 alpha ≥ threshold). */
  readonly covered: number
  /** Of those, texels whose transparent sheet still reads as bare paper. */
  readonly count: number
  /** Union bbox of the offending texels, doc uv, y up (like `darkAlphaMean`). */
  readonly box: BandBox
}

/**
 * The offender census behind `coveredPaperWhitePct` — one texel loop serves
 * both readings, so the percentage can never disagree with the census it
 * reports. Counts the texels the pigment layer claims to COVER (mode-4 alpha
 * ≥ threshold) and, among them, the texels that still read as bare paper
 * (≥ 250 luma) on the transparent export; returns the offending texels' union
 * bbox in document uv (y up), or `null` when no texel offends.
 *
 * 64-20 exists so a failing scan NAMES its texels: the percentage alone said
 * "0.88" while the four exported digests said nothing about where.
 */
function coveredPaperWhiteBox(
  transparent: HTMLCanvasElement,
  pigment: HTMLCanvasElement,
  threshold = 0.5,
): CoveredPaperWhiteCensus | null {
  const ctxT = transparent.getContext('2d')
  const ctxP = pigment.getContext('2d')
  if (!ctxT || !ctxP) throw new Error('covered paper white: canvas has no 2D context')
  const w = transparent.width
  const h = transparent.height
  const t = ctxT.getImageData(0, 0, w, h).data
  const a = ctxP.getImageData(0, 0, pigment.width, pigment.height).data
  let covered = 0
  let count = 0
  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  for (let i = 0; i < t.length; i += 4) {
    if (a[i + 3]! < threshold * 255) continue
    covered += 1
    const luma = (t[i]! + t[i + 1]! + t[i + 2]!) / 3
    if (luma < 250) continue
    count += 1
    const texel = i / 4
    const x = texel % w
    const y = (texel - x) / w
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  if (count === 0) return null
  // Six decimals: one texel at 1080² is 0.000926 doc units, so two decimals
  // would collapse a single offending texel to a zero-width box.
  const uv = (value: number): number => Math.round(value * 1e6) / 1e6
  return {
    covered,
    count,
    // Export rows are top-first while doc uv is y-up, so the row span flips.
    box: {
      x0: uv(minX / w),
      y0: uv(1 - (maxY + 1) / h),
      x1: uv((maxX + 1) / w),
      y1: uv(1 - minY / h),
    },
  }
}

/**
 * Percentage of texels the pigment layer claims to COVER (mode-4 alpha ≥
 * threshold) that still read as bare paper (≥ 250 luma) on the transparent
 * export — Spike 001's criterion-1 failure scan. 0 is the bar.
 */
function coveredPaperWhitePct(
  transparent: HTMLCanvasElement,
  pigment: HTMLCanvasElement,
  threshold = 0.5,
): number {
  const census = coveredPaperWhiteBox(transparent, pigment, threshold)
  return census && census.covered > 0 ? (100 * census.count) / census.covered : 0
}

// --- the fixed scenarios ----------------------------------------------------

// One script entry: a color + a point list + a mutationId. The knobs
// (`--emboss`, `--body`) fold into EVERY entry's params bag, so a cover run
// applies the same value to both strokes and the ONLY difference between the
// body-0 and body-100 gates is the Body value.
interface ScriptEntry {
  readonly color: string
  readonly points: readonly AquarellePoint[]
  readonly mutationId: number
  readonly emboss?: number
  readonly body?: number
  /** 64-17: settle ticks after applyStroke (0..settle); omitted keeps the
   *  phase-default SETTLE_TICKS. The 50-stroke passage settles in ONE tick
   *  per stroke, the spike's rapid cadence. */
  readonly settle?: number
  /** quick-261117-tq7: `false` leaves the stroke MOBILE (no fix) so the
   *  next stroke's cover pass meets wet `ink` instead of settled pigment.
   *  Omitted fixes after the settle, exactly as before. */
  readonly fixAfter?: boolean
  /** 64-14: run this entry as a LIFT stroke instead of a brush stroke (the
   *  standard bag already carries the lift strength). Omitted stays 'brush'.
   *  64-24 adds `water`: the wetness acceptance's re-wetting swash, which
   *  writes only the wet channel — never coverage, never the last touch. */
  readonly tool?: 'lift' | 'water'
  /** 64-24: advance the VIRTUAL clock by this many ms BEFORE the entry is
   *  driven — no simulation tick, no render, so the sheet's age moves while
   *  its fluid state does not. The only deterministic way to age one band of
   *  a sheet; omitted entries leave the clock exactly where it was. */
  readonly advanceClockMs?: number
  /** 64-14: a mid-run cover-alpha reading on the crossing box. 'advect'
   *  captures before a run of ADVECT_TICKS extra wet ticks and again after
   *  them (the entry must also carry `fixAfter: false`); 'beforeLift' and
   *  'afterLift' record the lift scenario's two readings after the entry's
   *  own fix. Undefined entries capture nothing — every pre-existing script. */
  readonly captureCover?: 'advect' | 'beforeLift' | 'afterLift'
  /** 64-16: the brush preset that stamps this entry; omitted keeps BRUSH_ID
   *  (`round`). An unknown id never reaches an entry — `readBrush` throws
   *  before the engine is constructed. */
  readonly brushId?: string
  /** 64-23 (D-22): the coverage-band knob (0..100) for the census scenario —
   *  the only entry-level knob that is NOT a CLI operand, because the census
   *  paints the same stroke at two Feather values in one capture. Omitted
   *  adds no key, exactly like `body`/`emboss`. */
  readonly feather?: number
}

/** The canonical bag as the app records it (0..100). A knob adds its key;
 *  absent knobs add nothing — the neutral gate must send the plan-01 bag. */
function paramsBag(entry: ScriptEntry): Record<string, number> {
  const bag: Record<string, number> = { ...STROKE_PARAMS }
  if (entry.emboss !== undefined) bag['emboss'] = entry.emboss
  if (entry.body !== undefined) bag['body'] = entry.body
  if (entry.feather !== undefined) bag['feather'] = entry.feather
  return bag
}

function makeStroke(entry: ScriptEntry): StudioStroke<AquarelleStrokePayload> {
  return toStudioStroke({
    // 64-14: the lift scenario drives the LIFT tool through the same
    // applyStroke seam the brush uses; every other entry stays a brush.
    tool: entry.tool ?? 'brush',
    color: entry.color,
    params: paramsBag(entry),
    // 64-16: the entry's brush wins; the probe default keeps `round`, so
    // every pre-existing script stamps exactly as before.
    brushId: entry.brushId ?? BRUSH_ID,
    points: entry.points.map((point) => ({ ...point })),
    mutationId: entry.mutationId,
    timestamp: 0,
  })
}

/** The plan-01 single stroke — byte-for-byte the pre-64 script with no knob. */
function neutralScript(emboss?: number, body?: number): readonly ScriptEntry[] {
  return [{ color: STROKE_COLOR, points: STROKE_POINTS, mutationId: MUTATION_ID, emboss, body }]
}

/** 64-06: a dark band across the sheet, fixed dry, then a light diagonal
 *  crossing it. Body 0 reads dark-through; Body 100 replaces the settled
 *  dark under B's own tip. */
function coverScript(emboss?: number, body?: number): readonly ScriptEntry[] {
  return [
    { color: COVER_DARK, points: COVER_DARK_POINTS, mutationId: MUTATION_ID, emboss, body },
    { color: COVER_LIGHT, points: COVER_LIGHT_POINTS, mutationId: MUTATION_ID + 1, emboss, body },
  ]
}

/** quick-261117-tq7: the SAME geometry as `cover`, except the dark band is
 *  left MOBILE — no fix after its settle. The light diagonal then crosses
 *  still-wet ink, so each covering dab's coverage term attenuates the mobile
 *  ink in place, and its coverPass erodes the settled pigment — one
 *  mechanism, both underlayers, no stroke-start snapshot. */
function coverOverWetScript(emboss?: number, body?: number): readonly ScriptEntry[] {
  return [
    {
      color: COVER_DARK,
      points: COVER_DARK_POINTS,
      mutationId: MUTATION_ID,
      emboss,
      body,
      fixAfter: false,
    },
    { color: COVER_LIGHT, points: COVER_LIGHT_POINTS, mutationId: MUTATION_ID + 1, emboss, body },
  ]
}

/**
 * 64-14: the coverage-lifecycle geometry — the `cover` scene with the covering
 * stroke left WET, so the advect gate can watch its coverage travel. The dark
 * band is fixed at Body 0 (identical at every Body value); the light diagonal
 * carries the knob and no fix, which is what keeps the medium live.
 */
function coverAdvectScript(body?: number): readonly ScriptEntry[] {
  return [
    { color: COVER_DARK, points: COVER_DARK_POINTS, mutationId: MUTATION_ID, body: 0 },
    {
      color: COVER_LIGHT,
      points: COVER_LIGHT_POINTS,
      mutationId: MUTATION_ID + 1,
      body: body ?? 100,
      fixAfter: false,
      captureCover: 'advect',
    },
  ]
}

/** 64-14: the lift stroke walks the covering diagonal's geometry at pressure
 *  0.8 — one traversal, the plan's "a lift tool stroke across the same
 *  diagonal". Measured on the lifecycle box: 0.90 before, 0.53 after (59 % of
 *  the pre-lift alpha, inside the 60 % bar). The lift tool ignores the colour
 *  (it erases), so the entry reuses the light pigment — only its geometry and
 *  pressure matter, under the standard lift bag (lift 22). */
const LIFT_POINTS: readonly AquarellePoint[] = COVER_LIGHT_POINTS.map((point) => ({
  ...point,
  p: 0.8,
}))

/**
 * 64-14: the lift scenario — the `cover` scene fully fixed (dark band at Body 0,
 * covering diagonal at the Body knob), then a Lift stroke across the crossing
 * it painted, then a fix so the reading is taken on the settled field the
 * display reads. The crossing alpha is captured after each fix.
 */
function coverLiftScript(body?: number): readonly ScriptEntry[] {
  return [
    { color: COVER_DARK, points: COVER_DARK_POINTS, mutationId: MUTATION_ID, body: 0 },
    {
      color: COVER_LIGHT,
      points: COVER_LIGHT_POINTS,
      mutationId: MUTATION_ID + 1,
      body: body ?? 100,
      captureCover: 'beforeLift',
    },
    {
      color: COVER_LIGHT,
      points: LIFT_POINTS,
      mutationId: MUTATION_ID + 2,
      body: body ?? 100,
      tool: 'lift',
      captureCover: 'afterLift',
    },
  ]
}

// --- 64-17 watercolor-50 scenario -------------------------------------------
// The spike's identity passage verbatim: 50 rapid horizontal strokes of
// #cc2222 on blank paper at Body 0, each settling ONE tick and left mobile
// (`fixAfter: false`), with the drive fixing every tenth stroke and once at
// the end. The jitter walks the line ±0.003 doc heights so the strokes overlap
// without coinciding, exactly as the spike scripted it.

/** The spike's three-point horizontal line at pressure 0.75 (spike 415-421). */
function horizontalLine(y: number): readonly AquarellePoint[] {
  return [
    { x: 0.16, y, p: 0.75, tx: 0, ty: 0, tw: 0 },
    { x: 0.5, y: y + 0.002, p: 0.75, tx: 0, ty: 0, tw: 0 },
    { x: 0.84, y, p: 0.75, tx: 0, ty: 0, tw: 0 },
  ]
}

/** 64-17: the 1080² Body-0 identity passage — 50 rapid strokes, settle 1. */
function watercolor50Script(): readonly ScriptEntry[] {
  const script: ScriptEntry[] = []
  for (let i = 0; i < 50; i += 1) {
    const jitter = ((i % 3) - 1) * 0.003
    script.push({
      color: '#cc2222',
      points: horizontalLine(0.5 + jitter),
      mutationId: 0x7ee100 + i,
      body: 0,
      settle: 1,
      fixAfter: false,
    })
  }
  return script
}

// --- 64-17 white-over-blue scenario -----------------------------------------
// Spike 001's criterion-1 geometry verbatim (spike probe.ts:389-435): a
// saturated blue band fixed dry, then a near-white diagonal crossing it. The
// UNDERLAYER is painted at Body 0 — a plain watercolour, identical at every
// Body value — and only the covering stroke carries the knob: the knob is the
// acrylic cover, not the paint.

const BLUE_BAND: readonly AquarellePoint[] = [
  { x: 0.12, y: 0.5, p: 0.8, tx: 0, ty: 0, tw: 0 },
  { x: 0.35, y: 0.5, p: 0.8, tx: 0, ty: 0, tw: 0 },
  { x: 0.6, y: 0.5, p: 0.8, tx: 0, ty: 0, tw: 0 },
  { x: 0.88, y: 0.5, p: 0.8, tx: 0, ty: 0, tw: 0 },
]

const WHITE_DIAGONAL: readonly AquarellePoint[] = [
  { x: 0.18, y: 0.8, p: 0.8, tx: 0, ty: 0, tw: 0 },
  { x: 0.4, y: 0.62, p: 0.8, tx: 0, ty: 0, tw: 0 },
  { x: 0.6, y: 0.4, p: 0.8, tx: 0, ty: 0, tw: 0 },
  { x: 0.82, y: 0.2, p: 0.8, tx: 0, ty: 0, tw: 0 },
]

/**
 * Spike 001's four measurement boxes (spike probe.ts:652-657), doc uv, y up.
 * The crossing box lies exactly on the two strokes' intersection at (0.5, 0.5);
 * the other three are controls inside stroke cores — the strokes' alpha rims
 * are ~0.02 doc heights wide, so a wider box would average paint with paper.
 */
const WHITE_OVER_BLUE_BOXES: Readonly<
  Record<'crossing' | 'coverOwn' | 'underOwn' | 'paper', BandBox>
> = {
  crossing: { x0: 0.49, y0: 0.49, x1: 0.51, y1: 0.51 },
  coverOwn: { x0: 0.276, y0: 0.688, x1: 0.304, y1: 0.712 },
  underOwn: { x0: 0.24, y0: 0.488, x1: 0.3, y1: 0.512 },
  paper: { x0: 0.45, y0: 0.86, x1: 0.55, y1: 0.94 },
}

/** 64-17: the blue band, fixed, then the white diagonal at the body knob. */
function whiteOverBlueScript(body: number): readonly ScriptEntry[] {
  return [
    { color: '#0044dd', points: BLUE_BAND, mutationId: 0x51a7e1, body: 0 },
    { color: '#f0f0f0', points: WHITE_DIAGONAL, mutationId: 0x51a7e2, body },
  ]
}

/**
 * 64-17: Spike 001 criterion 1 on the crossing box — the seven reported
 * metrics. `crossDarkAlpha` reads the transparent export (the pre-coverage
 * alpha); `crossCoverAlpha` reads the pigment export (the compositor alpha).
 * 64-20 adds `coveredPaperWhiteBox` beside the percentage: the census names
 * the offending texels (count, covered, union bbox) or is `null` when the
 * scan is clean.
 */
function whiteOverBlueMetrics(
  transparent: HTMLCanvasElement,
  pigment: HTMLCanvasElement,
): Record<string, number | CoveredPaperWhiteCensus | null> {
  const cross = WHITE_OVER_BLUE_BOXES.crossing
  const stats = bandStats(transparent, cross)
  return {
    crossR: round2(stats.mean[0]),
    crossG: round2(stats.mean[1]),
    crossB: round2(stats.mean[2]),
    crossBlueExcess: round2(stats.blueExcess),
    crossCoverAlpha: round2(alphaMean(pigment, cross)),
    crossDarkAlpha: round2(darkAlphaMean(transparent, cross)),
    coveredPaperWhitePct: round2(coveredPaperWhitePct(transparent, pigment, 0.5)),
    coveredPaperWhiteBox: coveredPaperWhiteBox(transparent, pigment, 0.5),
  }
}

// --- 64-16 textured-tip scenario ---------------------------------------------
// The `cover` geometry with the covering stroke stamped by the requested
// brush: a chalk stroke must cover through its own crumbly tip mask, not as a
// solid disc. The dark band is `round` at Body 0 — a plain watercolour
// underlayer, identical at every knob — so the measured spread belongs to the
// covering stroke's tip alone. The alpha is the coverage alpha BY
// CONSTRUCTION on the pigment export (mode 4: alpha = max(1 − min(rgb),
// cover)), which is why a coverage claim can be measured from an export at
// all.

/**
 * 64-16: the covering diagonal's MID-SHEET segment, where the light stroke's
 * own body sits clear of the fixed dark band. Deliberately separate from
 * `COVER_BOXES.crossing`, which stays the crossing measurement: this box asks
 * what the TIP lays down, not what the covering stroke did to the underlayer.
 */
const TEXTURED_BOX: BandBox = { x0: 0.44, y0: 0.41, x1: 0.58, y1: 0.55 }

/**
 * 64-16: the alpha distribution over a box on the mode-4 pigment export — a
 * 256-bin histogram, so P10/P90 need no sort and a crumbly tip mask's spread
 * is measurable. `coveredFraction` is the share of sampled pixels at or above
 * the 0.5 coverage threshold (bin 128), the same threshold the paper-white
 * scan uses.
 */
function alphaSpread(
  canvas: HTMLCanvasElement,
  box: BandBox,
): { p10: number; p90: number; coveredFraction: number } {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('alpha spread: exported canvas has no 2D context')
  const w = canvas.width
  const h = canvas.height
  const x0 = Math.max(0, Math.min(w - 1, Math.round(box.x0 * w)))
  const x1 = Math.max(x0 + 1, Math.min(w, Math.round(box.x1 * w)))
  const y0 = Math.max(0, Math.min(h - 1, Math.round((1 - box.y1) * h)))
  const y1 = Math.max(y0 + 1, Math.min(h, Math.round((1 - box.y0) * h)))
  const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data
  const bins = new Uint32Array(256)
  let total = 0
  let covered = 0
  for (let i = 3; i < data.length; i += 4) {
    const alpha = data[i]!
    bins[alpha]! += 1
    total += 1
    if (alpha >= 128) covered += 1
  }
  const quantile = (q: number): number => {
    if (total === 0) return 0
    const target = q * total
    let seen = 0
    for (let bin = 0; bin < 256; bin += 1) {
      seen += bins[bin]!
      if (seen >= target) return bin / 255
    }
    return 1
  }
  return {
    p10: quantile(0.1),
    p90: quantile(0.9),
    coveredFraction: total > 0 ? covered / total : 0,
  }
}

/**
 * 64-16: the textured-tip scene — the `cover` geometry with the covering
 * stroke stamped by `brushId`. Only the light diagonal carries the brush and
 * the Body knob; the dark underlayer is `round` at Body 0 so the spread is
 * the tip's, never the band's.
 */
function coverTexturedScript(emboss?: number, body?: number, brushId?: string): readonly ScriptEntry[] {
  return [
    {
      color: COVER_DARK,
      points: COVER_DARK_POINTS,
      mutationId: MUTATION_ID,
      emboss,
      body: 0,
      brushId: 'round',
    },
    {
      color: COVER_LIGHT,
      points: COVER_LIGHT_POINTS,
      mutationId: MUTATION_ID + 1,
      emboss,
      body: body ?? 100,
      brushId,
    },
  ]
}

/**
 * 64-16: the textured-tip readings. The mean, the blue-excess reader and the
 * paper-white scan are 64-17's helpers — consumed, never forked.
 */
function coverTexturedMetrics(
  transparent: HTMLCanvasElement,
  pigment: HTMLCanvasElement,
): Record<string, number> {
  const spread = alphaSpread(pigment, TEXTURED_BOX)
  const alpha = alphaMean(pigment, TEXTURED_BOX)
  // Post-UAT descriptor (the bristle deposit must CARRY the paint): the
  // pigment export's own RGB beside the film's darkness and the layer alpha.
  // A washed deposit solves to near-white RGB while the film stays pale; a
  // real deposit reads its pigment colour, and alpha never runs further ahead
  // of the film than the carried opacity allows.
  const coreMean = bandStats(pigment, TEXTURED_BOX).mean
  const filmDarkness = darkAlphaMean(transparent, TEXTURED_BOX)
  return {
    coverAlphaMean: round2(alpha),
    coverAlphaP10: round2(spread.p10),
    coverAlphaP90: round2(spread.p90),
    coverAlphaCoveredFraction: round2(spread.coveredFraction),
    coverCorePigmentMean: round2((coreMean[0] + coreMean[1] + coreMean[2]) / 3),
    coverCoreFilmDarkness: round2(filmDarkness),
    coverCoreAlphaMinusFilm: round2(alpha - filmDarkness),
    coverCrossBlueExcess: round2(bandStats(pigment, COVER_BOXES.crossing).blueExcess),
    coveredPaperWhitePct: round2(coveredPaperWhitePct(transparent, pigment, 0.5)),
  }
}

// --- 64-16 red-over-blue-50 scenario -----------------------------------------
// Spike 001's criterion-2 script verbatim (spike probe.ts:437-457): a dry blue
// field (three lines at Body 0), then 50 rapid red strokes at the Body knob —
// settle 1, no per-entry fix, the drive fixing every tenth and once after the
// loop — then ONE red reference stroke on clean paper ON THE SAME SHEET, so
// the ratio cancels the engine's paper and light. The mutationId bases are the
// spike's, so the report stays traceable to the spike gate.

const BLUE_FIELD = '#0044dd'
const RED = '#cc2222'
const BLUE_FIELD_LINES: readonly number[] = [0.42, 0.5, 0.58]
const RED_REF_POINTS: readonly AquarellePoint[] = [
  { x: 0.2, y: 0.86, p: 0.75, tx: 0, ty: 0, tw: 0 },
  { x: 0.5, y: 0.86, p: 0.75, tx: 0, ty: 0, tw: 0 },
  { x: 0.8, y: 0.86, p: 0.75, tx: 0, ty: 0, tw: 0 },
]

/**
 * 64-16: the spike's two criterion-2 measurement boxes (spike probe.ts:664-665)
 * — thin bands inside the stroke CORES, because the strokes' alpha rims are
 * ~0.02 doc heights wide and a wider box would average paint with paper.
 */
const RED_FIELD_BOX: BandBox = { x0: 0.42, y0: 0.492, x1: 0.58, y1: 0.508 }
const RED_REFERENCE_BOX: BandBox = { x0: 0.42, y0: 0.848, x1: 0.58, y1: 0.872 }

/** 64-16: the criterion-2 script — three blue field lines at Body 0, then 50
 *  rapid red strokes and one red reference stroke at the Body knob. */
function redOverBlueScript(redBody: number): readonly ScriptEntry[] {
  const script: ScriptEntry[] = []
  for (let i = 0; i < BLUE_FIELD_LINES.length; i += 1) {
    script.push({
      color: BLUE_FIELD,
      points: horizontalLine(BLUE_FIELD_LINES[i]!),
      mutationId: 0x7ed001 + i,
      body: 0,
    })
  }
  for (let i = 0; i < 50; i += 1) {
    const jitter = ((i % 3) - 1) * 0.003
    script.push({
      color: RED,
      points: horizontalLine(0.5 + jitter),
      mutationId: 0x7ed100 + i,
      body: redBody,
      settle: 1,
      fixAfter: false,
    })
  }
  script.push({ color: RED, points: RED_REF_POINTS, mutationId: 0x7ed200, body: redBody })
  return script
}

/** 64-16: the spike's hue formula verbatim (spike probe.ts:230-245) — HSV hue
 *  in degrees from a mean RGB triple. Copied, not reinvented. */
function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const d = max - min
  let h = 0
  if (d > 0) {
    if (max === rr) h = ((gg - bb) / d + 6) % 6
    else if (max === gg) h = (bb - rr) / d + 2
    else h = (rr - gg) / d + 4
    h *= 60
  }
  return { h, s: max > 0 ? d / max : 0, v: max }
}

/**
 * 64-16: Spike 001 criterion 2 as reported numbers — the red field's mean luma
 * and hue against the fresh-red reference stroke's, both measured on the
 * PIGMENT export's rgb, plus the whole-sheet paper-white scan (64-17's,
 * reused). `lumaRatio` is finalLuma / referenceLuma; `deltaHue` is signed
 * degrees, wrapped to (−180, 180].
 */
function redOverBlueMetrics(
  transparent: HTMLCanvasElement,
  pigment: HTMLCanvasElement,
): Record<string, number> {
  const field = bandStats(pigment, RED_FIELD_BOX).mean
  const reference = bandStats(pigment, RED_REFERENCE_BOX).mean
  const finalLuma = (field[0] + field[1] + field[2]) / 3
  const referenceLuma = (reference[0] + reference[1] + reference[2]) / 3
  const finalHue = rgbToHsv(field[0], field[1], field[2]).h
  const referenceHue = rgbToHsv(reference[0], reference[1], reference[2]).h
  let deltaHue = finalHue - referenceHue
  if (deltaHue > 180) deltaHue -= 360
  if (deltaHue < -180) deltaHue += 360
  return {
    finalLuma: round2(finalLuma),
    referenceLuma: round2(referenceLuma),
    lumaRatio: round2(finalLuma / referenceLuma),
    deltaHue: round2(deltaHue),
    coveredPaperWhitePct: round2(coveredPaperWhitePct(transparent, pigment, 0.5)),
  }
}

// --- 64-23 the bristle-edge census -------------------------------------------
// Acceptance ask #2 (`better-acrylic.md`): "the edge looks brushed" is not a
// byte gate, so the census measures it. TWO horizontal `bristle-flat` strokes
// of the same length and speed on blank paper, identical but for D-22's
// Feather global — the upper band at Feather 0, the lower at Feather 100,
// each fixed after its settle. The census reports, per stroke, the 10 %→90 %
// transition width of the stroke's UPPER edge (median over 24 stations along
// the central 60 % of the stroke's x-range) and the P90−P10 spread of the
// 50 % crossing position. The absolute numbers are recorded evidence;
// compare.mjs gates only the relation facts (D-22's direction, a non-zero
// variation, a width inside the stroke).
//
// THE FIELD (64-23, measured): the plan named the mode-4 pigment alpha, but on
// a bristle stroke that channel is a saturated MASK, not the film. The
// coverage channel is the union (`ONE, ONE_MINUS_SRC_ALPHA`) of the ~100–230
// overlapping dabs, so a per-dab coverage of even 0.3 composes to 1 and the
// exported alpha is a hard silhouette cut at the gather's geometric support
// boundary (measured: 0.8 px at BOTH Feather 0 and Feather 100, plateau 1.0).
// D-22's feather band, `smoothstep(threshold − uSoftness, threshold + uSoftness,
// coverage)`, is a threshold on the DEPOSIT, so the graded, feather-shaped
// edge lives in the film's transmittance — the transparent export's
// `1 − min(rgb)`, which IS the engine's own `darkAlpha` (the pre-coverage
// alpha `displayFS` derives mode 4 from), and the visible edge of the paint
// on paper. Measured on that field the census shows the D-22 relation
// (Feather 0: 20.25 px; Feather 100: 26.33 px, 1080²). The mode-4 alpha
// saturation is recorded in the SUMMARY as a model finding, not silently
// worked around.

// A LIGHT pigment on purpose: the film's darkness is `1 − min(rgb)` of the
// deposited transmittance, and a dark paint floors it near the paper's black
// limit, hiding the across ramp under a near-saturated plateau. A light-wash
// pigment keeps the ramp in a readable 0.1–0.2 band (measured plateau 0.125 /
// 0.158), so the crossing fractions are resolved with room to spare.
const EDGE_COLOR = '#dddddd'
const EDGE_FEATHER_0_Y = 0.72
const EDGE_FEATHER_100_Y = 0.28
/** The stroke's own x-range (`horizontalLine`) and the census's central 60 %. */
const EDGE_STROKE_X0 = 0.16
const EDGE_STROKE_X1 = 0.84
const EDGE_CENTRAL_LO = 0.2
const EDGE_CENTRAL_HI = 0.8
/** 24 stations spread over the central 60 % of the stroke's x-range. */
const EDGE_STATIONS = 24
/** How far above the stroke centre the column scan runs, in doc heights. */
const EDGE_SCAN_HEIGHTS = 0.08
/** The plateau reference band's half-height, in doc heights. */
const EDGE_PLATEAU_HALF = 0.006
/** The film's darkness a stroke must reach to be measurable at all. The plan's
 *  0.2 was written for the saturated mode-4 alpha (which always reads 1); a
 *  real light-wash film reads ~0.13–0.16 here, a blank render 0. */
const EDGE_MIN_PLATEAU = 0.02

/** 64-23: the two-entry census geometry — same length, same speed, one sheet,
 *  the ONLY difference between the strokes is the Feather global. */
function bristleEdgeScript(): readonly ScriptEntry[] {
  return [
    {
      color: EDGE_COLOR,
      points: horizontalLine(EDGE_FEATHER_0_Y),
      mutationId: 0x7ee200,
      feather: 0,
      brushId: 'bristle-flat',
    },
    {
      color: EDGE_COLOR,
      points: horizontalLine(EDGE_FEATHER_100_Y),
      mutationId: 0x7ee201,
      feather: 100,
      brushId: 'bristle-flat',
    },
  ]
}

/** Median of a non-empty list; 0 for an empty one (never NaN). */
function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor((sorted.length - 1) / 2)]!
}

/** Linear-interpolated quantile over a non-empty list. */
function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const pos = q * (sorted.length - 1)
  const lo = Math.floor(pos)
  const hi = Math.min(sorted.length - 1, lo + 1)
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo)
}

/** One stroke's census: the median 90 %−10 % width, the P90−P10 spread of the
 *  50 % crossing, the median crossing distance (the measured half-width) and
 *  the plateau the halves were normalised by. */
interface EdgeCensus {
  readonly softnessPx: number
  readonly variationPx: number
  readonly halfWidthPx: number
  readonly plateauAlpha: number
}

/**
 * 64-23: one stroke's edge census on the FILM's darkness (see the section
 * header for why not the mode-4 alpha). A stroke is `null` when its plateau
 * never reaches `EDGE_MIN_PLATEAU` — a blank render — with a NAMED failure
 * line, so an empty capture can never pass silently. Per station the column
 * is scanned from the stroke's centre line upward (the higher doc y, which is
 * a SMALLER canvas row); the 90 %, 50 % and 10 % crossings are interpolated
 * between the last row above and the first row below each threshold. A
 * station whose centre texel is not itself at the plateau (a dash gap in the
 * deposit — the §4.3 dryness breakup breaks per bristle) cannot define an
 * edge crossing: it is SKIPPED and recorded in `skips`, never in `failures`
 * (a dash gap is the trace law working, not a degenerate capture). A station
 * that runs out of rows before all three crossings IS a named failure.
 */
function strokeEdgeCensus(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  strokeY: number,
  label: string,
  failures: string[],
  skips: string[],
): EdgeCensus | null {
  const x0 = Math.round((EDGE_STROKE_X0 + (EDGE_STROKE_X1 - EDGE_STROKE_X0) * EDGE_CENTRAL_LO) * w)
  const x1 = Math.round((EDGE_STROKE_X0 + (EDGE_STROKE_X1 - EDGE_STROKE_X0) * EDGE_CENTRAL_HI) * w)
  const centreRow = (1 - strokeY) * h
  const valueAt = (row: number, x: number): number => data[(row * w + x) * 4 + 3]! / 255

  // 1) The plateau: the MEDIAN value in a thin band around the centre line,
  //    over the census's central x-range — the bristle core stipples, so a
  //    single texel would under-read it and a mean would average dashes.
  const plateauValues: number[] = []
  const plateauTop = Math.max(0, Math.round(centreRow - EDGE_PLATEAU_HALF * h))
  const plateauBottom = Math.min(h - 1, Math.round(centreRow + EDGE_PLATEAU_HALF * h))
  for (let row = plateauTop; row <= plateauBottom; row += 1) {
    for (let x = x0; x <= x1; x += 1) plateauValues.push(valueAt(row, x))
  }
  const plateauAlpha = median(plateauValues)
  if (!(plateauAlpha >= EDGE_MIN_PLATEAU)) {
    failures.push(
      `edge census: ${label} stroke not found (plateau ${plateauAlpha.toFixed(3)} below ${EDGE_MIN_PLATEAU})`,
    )
    return null
  }

  // 2) The stations: scan each column up from the centre line, interpolating
  //    the three crossings against the plateau.
  const widths: number[] = []
  const crossings: number[] = []
  const limit = Math.max(0, Math.round(centreRow - EDGE_SCAN_HEIGHTS * h))
  const startRow = Math.max(0, Math.floor(centreRow))
  for (let s = 0; s < EDGE_STATIONS; s += 1) {
    const x = Math.min(w - 1, Math.round(x0 + ((s + 0.5) / EDGE_STATIONS) * (x1 - x0)))
    const startNorm = valueAt(startRow, x) / plateauAlpha
    if (!(startNorm >= 0.9)) {
      skips.push(
        `edge census: ${label} station ${s} (x=${x}) skipped — a dash gap (${startNorm.toFixed(2)} of the plateau at the centre line)`,
      )
      continue
    }
    const found: Record<'p90' | 'p50' | 'p10', number | null> = { p90: null, p50: null, p10: null }
    const thresholds = [
      ['p90', 0.9],
      ['p50', 0.5],
      ['p10', 0.1],
    ] as const
    let previousRow = startRow
    let previousNorm = startNorm
    for (let row = startRow - 1; row >= limit; row -= 1) {
      const norm = valueAt(row, x) / plateauAlpha
      for (const [key, q] of thresholds) {
        if (found[key] === null && norm < q) {
          const span = previousNorm - norm
          const t = span > 0 ? (previousNorm - q) / span : 0
          found[key] = centreRow - (previousRow + (row - previousRow) * t)
        }
      }
      previousRow = row
      previousNorm = norm
    }
    if (found.p90 === null || found.p50 === null || found.p10 === null) {
      failures.push(
        `edge census: ${label} station ${s} (x=${x}) has fewer than three crossings`,
      )
      continue
    }
    widths.push(found.p10 - found.p90)
    crossings.push(found.p50)
  }
  if (widths.length === 0) {
    failures.push(`edge census: ${label} stroke has no measurable station`)
    return null
  }
  return {
    softnessPx: median(widths),
    variationPx: quantile(crossings, 0.9) - quantile(crossings, 0.1),
    halfWidthPx: median(crossings),
    plateauAlpha,
  }
}

/**
 * 64-23: the census report, read on the transparent export (see the section
 * header for the field). Per stroke: the median 10 %→90 % width, the P90−P10
 * spread of the 50 % crossing and the interior plateau — the film's darkness
 * alpha — that normalised them; plus the measured half-width (the two
 * strokes' median crossing distance — the same brush, so one number) and the
 * named degenerate failures, which compare.mjs also refuses. Zeros stand in
 * for a stroke the census could not find, so a blank render reads 0 and fails
 * the invariant; the failure line names WHY.
 */
function bristleEdgeMetrics(sheet: HTMLCanvasElement): Record<string, number | string[]> {
  const ctx = sheet.getContext('2d')
  if (!ctx) throw new Error('bristle edge: exported canvas has no 2D context')
  const w = sheet.width
  const h = sheet.height
  const pixels = ctx.getImageData(0, 0, w, h).data
  // The film's darkness — the engine's own `darkAlpha` (`1 − min(rgb)` of the
  // transparent export's transmittance), written into a scan-only buffer's
  // alpha channel so the census reads one field.
  const data = new Uint8ClampedArray(pixels.length)
  for (let i = 0; i < pixels.length; i += 4) {
    data[i + 3] = 255 - Math.min(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!)
  }
  const failures: string[] = []
  const skips: string[] = []
  const zero: EdgeCensus = { softnessPx: 0, variationPx: 0, halfWidthPx: 0, plateauAlpha: 0 }
  const feather0 =
    strokeEdgeCensus(data, w, h, EDGE_FEATHER_0_Y, 'feather-0', failures, skips) ?? zero
  const feather100 =
    strokeEdgeCensus(data, w, h, EDGE_FEATHER_100_Y, 'feather-100', failures, skips) ?? zero
  return {
    edgeSoftnessPxFeather0: round2(feather0.softnessPx),
    edgeSoftnessPxFeather100: round2(feather100.softnessPx),
    edgeVariationPxFeather0: round2(feather0.variationPx),
    edgeVariationPxFeather100: round2(feather100.variationPx),
    edgeHalfWidthPx: round2((feather0.halfWidthPx + feather100.halfWidthPx) / 2),
    edgePlateauAlphaFeather0: round2(feather0.plateauAlpha),
    edgePlateauAlphaFeather100: round2(feather100.plateauAlpha),
    edgeSkippedStations: skips,
    edgeFailures: failures,
  }
}

// --- 64-24 the bristle-wet acceptance ----------------------------------------
// Acceptance ask #3 (`better-acrylic.md`): "acrylic/water with a Dry that stops
// the mixing", on ONE sheet with ONE brush and two ages.
//
// The geometry: two identical LIGHT bands (#dddddd — the census's proven
// light wash, chosen so the crossing's deposit is legible instead of floored
// near the paper's black limit), one per half of the sheet, and one DARK
// crossing stroke (#111111) over both at y = 0.5. The left band is painted at
// t ≈ 0; a `tool: 'water'` swash then carries `advanceClockMs: 30000`, so the
// clock jumps thirty virtual seconds with NO simulation tick and the swash
// re-wets the band WITHOUT touching its last-touch field (the water case in
// the engine writes only the wet channel). The right band is painted after
// that advance, so it is genuinely fresh when the crossing arrives.
//
// What the crossing reads: each dab's carrier asks `exp(-age / wetSeconds) ×
// coverage` at its tap. Over the fresh right band the age is a fraction of a
// second, so the carrier picks the light band into its reservoirs and lays
// THAT instead of its own dark palette — the crossing's track over the band
// stays pale (mixing). Over the aged left band `exp(-30 / 7)` ≈ 0.014, so the
// carrier keeps its palette and the track reads dark (no mixing). The
// difference is `|pickupFreshMean - pickupAgedWetMean|`; compare.mjs gates
// the relation, the direction is recorded evidence.
//
// The measured field is the TRANSPARENT export's film darkness (`255 − mean
// RGB luma`, bandPigment — the same machinery every region gate uses), not
// the mode-4 pigment alpha: at Body 0 the alpha is the darkness conversion,
// and the film is what the eye sees. The boxes are tight windows on each
// band ∩ crossing core, symmetric between the halves.
const WET_BAND_COLOR = '#dddddd'
const WET_CROSS_COLOR = '#111111'
const WET_LEFT_X = 0.3
const WET_RIGHT_X = 0.7
const WET_CROSS_Y = 0.5
/** The acceptance's declared age: thirty virtual seconds, above every tack
 *  time the phase ships (the §6 default is 7 s, D-25's acrylic is 12 s). */
const WET_AGE_MS = 30000

/** One vertical stroke line at x, the twin of `horizontalLine(y)`. */
function verticalLine(x: number): readonly AquarellePoint[] {
  return [
    { x, y: 0.2, p: 0.75, tx: 0, ty: 0, tw: 0 },
    { x: x + 0.002, y: 0.5, p: 0.75, tx: 0, ty: 0, tw: 0 },
    { x, y: 0.8, p: 0.75, tx: 0, ty: 0, tw: 0 },
  ]
}

/** The two crossing regions: one window per band, centred on the crossing. */
const BRISTLE_WET_BOXES: Readonly<Record<'agedWet' | 'fresh', BandBox>> = {
  agedWet: { x0: 0.29, y0: 0.488, x1: 0.31, y1: 0.512 },
  fresh: { x0: 0.69, y0: 0.488, x1: 0.71, y1: 0.512 },
}

/**
 * 64-24: the four-entry acceptance script — left band, clock advance + water
 * swash, right band, crossing. The order is load-bearing: the clock only ever
 * moves forward, so the right band is still fresh when the crossing paints,
 * and the crossing walks left-to-right, meeting the aged band first.
 */
function bristleWetScript(): readonly ScriptEntry[] {
  return [
    {
      color: WET_BAND_COLOR,
      points: verticalLine(WET_LEFT_X),
      mutationId: 0x7ee300,
      body: 0,
      brushId: 'bristle-flat',
    },
    {
      color: WET_BAND_COLOR,
      points: verticalLine(WET_LEFT_X),
      mutationId: 0x7ee301,
      tool: 'water',
      advanceClockMs: WET_AGE_MS,
    },
    {
      color: WET_BAND_COLOR,
      points: verticalLine(WET_RIGHT_X),
      mutationId: 0x7ee302,
      body: 0,
      brushId: 'bristle-flat',
    },
    {
      color: WET_CROSS_COLOR,
      points: horizontalLine(WET_CROSS_Y),
      mutationId: 0x7ee303,
      body: 0,
      brushId: 'bristle-flat',
    },
  ]
}

/**
 * 64-24: the acceptance's two readings, both on the transparent export's film
 * darkness (0..255; 0 is bare paper). Only the relation between them is
 * gated; both numbers are recorded.
 */
function bristleWetMetrics(transparent: HTMLCanvasElement): Record<string, number> {
  return {
    pickupFreshMean: round2(bandPigment(transparent, BRISTLE_WET_BOXES.fresh)),
    pickupAgedWetMean: round2(bandPigment(transparent, BRISTLE_WET_BOXES.agedWet)),
  }
}

// --- WebGL2 canary ----------------------------------------------------------

/** Throw if the vendored engine cannot get a real WebGL2 surface. */
function probeRenderer(): string {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const engine = withSeededMathRandom(PAPER_SEED, () => new WatercolorEngine(canvas, null, {}, [64, 64]))
  try {
    const gl = (engine as unknown as { gl: WebGL2RenderingContext }).gl
    const version = gl.getParameter(gl.VERSION) as string
    if (!version) throw new Error('no WebGL2 version string')
    return gl.getParameter(gl.RENDERER) as string
  } finally {
    engine.destroy()
  }
}

// --- report -----------------------------------------------------------------

function writeResult(report: Record<string, unknown>): void {
  const pre = document.getElementById('result')
  if (!pre) throw new Error('probe page is missing pre#result')
  pre.textContent = JSON.stringify(report, null, 2)
  if (typeof report['verdict'] === 'string') {
    pre.setAttribute('data-verdict', report['verdict'] as string)
  }
  const status = document.getElementById('status')
  if (status) status.textContent = 'DONE'
  console.log('PROBE_RESULT ' + JSON.stringify(report))
}

// --- main -------------------------------------------------------------------

function run(
  gate: string,
  renderer: string,
  scenario: string,
  sheet: number,
  brush?: string,
  emboss?: number,
  body?: number,
  light?: number,
  wetMode: 0 | 1 = 1,
): void {
  if (!COLD) throw new Error("paper preset 'cold' is not in PAPERS")
  // 64-16: the resolved brush — the operand when given, `chalk` as the
  // textured-tip scenario's documented default, otherwise nothing. The report
  // echoes THIS value, so a run that passed `--brush` can never print null.
  const resolvedBrush = brush ?? (scenario === 'cover-textured' ? 'chalk' : undefined)
  const script =
    scenario === 'cover'
      ? coverScript(emboss, body)
      : scenario === 'cover-over-wet'
        ? coverOverWetScript(emboss, body)
        : scenario === 'cover-advect'
          ? coverAdvectScript(body)
          : scenario === 'cover-lift'
            ? coverLiftScript(body)
            : scenario === 'watercolor-50'
              ? watercolor50Script()
              : scenario === 'white-over-blue'
                ? whiteOverBlueScript(body ?? 100)
                : scenario === 'cover-textured'
                  ? coverTexturedScript(emboss, body, resolvedBrush)
                  : scenario === 'red-over-blue-50'
                    ? redOverBlueScript(body ?? 100)
                    : scenario === 'bristle-edge'
                      ? bristleEdgeScript()
                      : scenario === 'bristle-wet'
                        ? bristleWetScript()
                        : neutralScript(emboss, body)

  // The tap must see the adapter's engine and only the adapter's engine:
  // the canary above already constructed and destroyed its own.
  capturedEngine = null
  const adapter = withSeededMathRandom(PAPER_SEED, () =>
    createAquarelleEngineAdapter({
      width: sheet,
      height: sheet,
      paperPreset: COLD,
      paperStrength: PAPER_STRENGTH,
    }),
  )

  // 64-24: the §3.4 A/B mode is engine state, written BEFORE the first stroke
  // so every carrier pass of the script reads the same law. 1 is the shipped
  // timestamp gate; 0 is 64-21's proxy, the recorded control.
  adapter.setLastTouchMode(wetMode)

  try {
    const engine = capturedEngine
    if (engine === null) throw new Error('probe never captured the adapter engine (setManual tap missed)')

    // 64-06: bakeMs covers the script + settle only — the exports below are
    // the capture, not the medium, so they never inflate the cost number.
    // 64-14: the lifecycle scenarios' mid-run captures run inside the drive;
    // their wall clock is subtracted from bakeMs for the same reason.
    const bakeStart = performance.now()
    let captureMs = 0
    const coverLifecycle: Record<string, number> = {}
    script.forEach((entry, index) => {
      // 64-24: the acceptance's clock-only age — the virtual clock moves, the
      // fluid does not, so "thirty seconds old" and "just re-wetted" are
      // independent facts. Applied BEFORE the entry, so the entry's own dabs
      // read (and stamp) the advanced time.
      if (entry.advanceClockMs !== undefined) adapter.advanceClock(entry.advanceClockMs)
      adapter.applyStroke(makeStroke(entry))
      // 64-17: per-entry settle (ticks 0..settle, default SETTLE_TICKS); the
      // rapid entries of the 50-stroke passage settle in ONE tick each.
      const settle = entry.settle ?? SETTLE_TICKS
      for (let tick = 0; tick <= settle; tick += 1) adapter.stepTick(tick)
      // 64-14: the advect gate reads the cover channel mid-script. The pre-read
      // happens while the covering stroke is still wet (its entry carries
      // `fixAfter: false`); ADVECT_TICKS extra wet ticks then run and the
      // post-read follows — the medium is the only thing that moved.
      if (entry.captureCover === 'advect') {
        const captureStart = performance.now()
        const before = alphaStats(engine.exportCanvas('pigment'), COVER_LIFECYCLE_BOXES.crossing)
        for (let tick = 0; tick < ADVECT_TICKS; tick += 1) adapter.stepTick(tick)
        const advectedTransparent = engine.exportCanvas('transparent')
        const advectedPigment = engine.exportCanvas('pigment')
        const after = alphaStats(advectedPigment, COVER_LIFECYCLE_BOXES.crossing)
        captureMs += performance.now() - captureStart
        coverLifecycle['coverAlphaBeforeAdvect'] = round2(before.mean)
        coverLifecycle['coverAlphaPeakBefore'] = round2(before.peak)
        coverLifecycle['coverAlphaAfterAdvect'] = round2(after.mean)
        coverLifecycle['coverAlphaPeakAfter'] = round2(after.peak)
        coverLifecycle['coveredPaperWhitePct'] = round2(
          coveredPaperWhitePct(advectedTransparent, advectedPigment, 0.5),
        )
      }
      // quick-261117-tq7: `fixAfter: false` skips the settle so the stroke
      // stays mobile `ink`, the cover-over-wet underlayer.
      if (entry.fixAfter !== false) adapter.fix()
      // 64-14: the lift gate reads the crossing after the entry's own fix, so
      // the field it measures is the one the display reads.
      if (entry.captureCover === 'beforeLift' || entry.captureCover === 'afterLift') {
        const captureStart = performance.now()
        const transparent = engine.exportCanvas('transparent')
        const pigment = engine.exportCanvas('pigment')
        const stats = alphaStats(pigment, COVER_LIFECYCLE_BOXES.crossing)
        captureMs += performance.now() - captureStart
        if (entry.captureCover === 'beforeLift') {
          coverLifecycle['coverAlphaBeforeLift'] = round2(stats.mean)
        } else {
          coverLifecycle['coverAlphaAfterLift'] = round2(stats.mean)
          coverLifecycle['coveredPaperWhitePct'] = round2(coveredPaperWhitePct(transparent, pigment, 0.5))
        }
      }
      // 64-17 / spike probe.ts:603-618: fix every tenth rapid stroke, so the
      // 50-stroke session is not one giant wet pool. Unreachable for every
      // pre-existing script — none carries a rapid entry.
      if (entry.fixAfter === false && (index + 1) % 10 === 0) adapter.fix()
    })
    // 64-17: the trailing fix, only when the script carries a rapid entry —
    // the last rapid stroke settles here (the spike's exact cadence). A script
    // of fully-settled strokes already ended on its own fix, so this stays
    // unreachable for `neutral` and `cover`.
    if (script.some((entry) => entry.fixAfter === false)) adapter.fix()
    const bakeMs = Math.round(performance.now() - bakeStart - captureMs)

    // 64-04: the light is render state, so it is applied after the script
    // settles and before any export. Intensity 0 is the second identity gate:
    // the lit delta is an intensity multiple, so a lit embossed stroke must
    // reproduce the unlit baseline. Omitted leaves DEFAULT_LIGHT (intensity 1).
    if (light !== undefined) engine.setLight({ intensity: light })

    // 64-10: renderMs is the render phase proper — the three exports through
    // the display shader plus their readbacks — recorded beside the digests so
    // a body pair reports both halves of the cost (bake + render). Durations
    // are reported, never tuned into the law.
    const renderStart = performance.now()
    const paperCanvas = engine.exportCanvas('paper')
    const transparentCanvas = engine.exportCanvas('transparent')
    const whiteCanvas = engine.exportCanvas('white')
    // 64-17: the mode-4 coverage-aware compositor sheet. Its alpha is
    // max(1 − min(rgb), cover) — the exact alpha 64-15 carries into the app
    // commit — so a covering stroke carries real opacity in this export.
    const pigmentCanvas = engine.exportCanvas('pigment')
    const paper = digestCanvas(paperCanvas)
    const transparent = digestCanvas(transparentCanvas)
    const white = digestCanvas(whiteCanvas)
    const pigment = digestCanvas(pigmentCanvas)
    const renderMs = Math.round(performance.now() - renderStart)

    // WR-01: the four region means that make the cover gate's PASS mean
    // something. Measured after renderMs so the cost number keeps its meaning.
    // Only cover-over-wet reports them, so every other scenario's report shape
    // (and its six compare fields) is unchanged.
    const coverRegions =
      scenario === 'cover-over-wet'
        ? {
            coverCrossPigment: round2(bandPigment(transparentCanvas, COVER_BOXES.crossing)),
            coverOwnPigment: round2(bandPigment(transparentCanvas, COVER_BOXES.own)),
            underBandPigment: round2(bandPigment(transparentCanvas, COVER_BOXES.under)),
            paperBandPigment: round2(bandPigment(transparentCanvas, COVER_BOXES.paper)),
          }
        : {}

    // 64-17: Spike 001 criterion 1, only for its scenario, so every other
    // report shape is unchanged apart from digestPigment.
    const whiteOverBlueReport =
      scenario === 'white-over-blue' ? whiteOverBlueMetrics(transparentCanvas, pigmentCanvas) : {}

    // 64-16: the textured-tip spread, only for its scenario, so every other
    // report shape is unchanged.
    const coverTexturedReport =
      scenario === 'cover-textured' ? coverTexturedMetrics(transparentCanvas, pigmentCanvas) : {}

    // 64-16: Spike 001 criterion 2 — luma, hue and paper-white, only for its
    // scenario, so every other report shape is unchanged.
    const redOverBlueReport =
      scenario === 'red-over-blue-50' ? redOverBlueMetrics(transparentCanvas, pigmentCanvas) : {}

    // 64-23: the bristle-edge census — the two strokes' measured edge
    // softness and variation, only for its scenario, so every other report
    // shape is unchanged.
    const bristleEdgeReport =
      scenario === 'bristle-edge' ? bristleEdgeMetrics(transparentCanvas) : {}

    // 64-24: the wetness acceptance's two readings, only for its scenario, so
    // every other report shape is unchanged.
    const bristleWetReport =
      scenario === 'bristle-wet' ? bristleWetMetrics(transparentCanvas) : {}

    writeResult({
      gate,
      scenario,
      brush: resolvedBrush ?? null,
      emboss: emboss ?? null,
      body: body ?? null,
      light: light ?? null,
      wetMode,
      bakeMs,
      renderMs,
      width: sheet,
      height: sheet,
      digestPaper: paper.digest,
      digestTransparent: transparent.digest,
      digestWhite: white.digest,
      digestPigment: pigment.digest,
      byteLength: paper.byteLength,
      ...coverRegions,
      ...whiteOverBlueReport,
      ...coverTexturedReport,
      ...redOverBlueReport,
      ...bristleEdgeReport,
      ...bristleWetReport,
      ...coverLifecycle,
      renderer,
      verdict: 'MEDIUM-ENGINE CAPTURED',
    })
  } finally {
    adapter.dispose()
  }
}

/** 64-03: the emboss knob — absent keeps the neutral (pre-milestone) script. */
function readEmboss(): number | undefined {
  const raw = new URLSearchParams(location.search).get('emboss')
  if (raw === null || raw === '') return undefined
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`invalid emboss "${raw}" (expected 0..100)`)
  }
  return value
}

/** 64-04: the light-intensity knob (0..4, the engine's clamp band); absent keeps DEFAULT_LIGHT. */
function readLight(): number | undefined {
  const raw = new URLSearchParams(location.search).get('light')
  if (raw === null || raw === '') return undefined
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0 || value > 4) {
    throw new Error(`invalid light "${raw}" (expected 0..4)`)
  }
  return value
}

/** 64-06: the Body knob — absent keeps the neutral (pre-milestone) bag. */
function readBody(): number | undefined {
  const raw = new URLSearchParams(location.search).get('body')
  if (raw === null || raw === '') return undefined
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`invalid body "${raw}" (expected 0..100)`)
  }
  return value
}

/**
 * 64-16: the brush operand — absent keeps each entry's default; a present id
 * must resolve against BRUSH_PRESETS or the run throws naming the unknown id
 * and the known list. The silent `round` fallback is the whole failure this
 * gate exists to prevent, so there is no defaulting path here.
 */
function readBrush(): string | undefined {
  const raw = new URLSearchParams(location.search).get('brush')
  if (raw === null || raw === '') return undefined
  const known = BRUSH_PRESETS.map((preset) => preset.id)
  if (!known.includes(raw)) {
    throw new Error(`invalid brush "${raw}" (known: ${known.join(', ')})`)
  }
  return raw
}

/** 64-06: the scenario selector — absent renders the plan-01 single stroke.
 *  64-17 adds `watercolor-50` and `white-over-blue`; 64-14 adds
 *  `cover-advect`; 64-16 adds `cover-textured` (task 1) and `red-over-blue-50`
 *  (task 2's scenario, declared now so the two closed lists cannot drift).
 *  64-23 adds `bristle-edge`, the directional-edge census; 64-24 adds
 *  `bristle-wet`, the wetness acceptance.
 *  The closed list here and the one in run.mjs must stay literal-identical:
 *  a name accepted by the parser but unknown to the probe fails at capture,
 *  and a name the probe knows but the parser rejects can never be requested. */
function readScenario(): string {
  const raw = new URLSearchParams(location.search).get('scenario')
  if (raw === null || raw === '') return 'neutral'
  if (raw !== 'cover' && raw !== 'cover-over-wet' && raw !== 'watercolor-50' && raw !== 'white-over-blue' && raw !== 'cover-advect' && raw !== 'cover-lift' && raw !== 'cover-textured' && raw !== 'red-over-blue-50' && raw !== 'bristle-edge' && raw !== 'bristle-wet') {
    throw new Error(
      `invalid scenario "${raw}" (expected "cover", "cover-over-wet", "watercolor-50", "white-over-blue", "cover-advect", "cover-lift", "cover-textured", "red-over-blue-50", "bristle-edge" or "bristle-wet")`,
    )
  }
  return raw
}

/** 64-24: the §3.4 A/B mode — absent keeps 1 (the shipped timestamp law); 0
 *  selects 64-21's `wet × coverage` proxy, the recorded control of a capture
 *  comparison. Anything else throws: an unknown mode must never be mistaken
 *  for the shipped one. */
function readWetMode(): 0 | 1 {
  const raw = new URLSearchParams(location.search).get('wetMode')
  if (raw === null || raw === '') return 1
  if (raw !== '0' && raw !== '1') {
    throw new Error(`invalid wetMode "${raw}" (expected 0 or 1)`)
  }
  return raw === '0' ? 0 : 1
}

/** 64-10: the square-sheet knob — absent keeps the phase-default 256 sheet. */
function readSize(): number {
  const raw = new URLSearchParams(location.search).get('size')
  if (raw === null || raw === '') return DEFAULT_SHEET
  const value = Number(raw)
  if (!Number.isInteger(value) || value < MIN_SHEET || value > MAX_SHEET) {
    throw new Error(`invalid size "${raw}" (expected an integer ${MIN_SHEET}..${MAX_SHEET})`)
  }
  return value
}

function main(): void {
  const gate = new URLSearchParams(location.search).get('gate') ?? 'neutral-identity'
  let renderer = '(unknown)'
  let scenario = 'neutral'
  let sheet = DEFAULT_SHEET
  let brush: string | undefined
  let emboss: number | undefined
  let body: number | undefined
  let light: number | undefined
  let wetMode: 0 | 1 = 1
  try {
    scenario = readScenario()
    sheet = readSize()
    brush = readBrush()
    emboss = readEmboss()
    body = readBody()
    light = readLight()
    wetMode = readWetMode()
    renderer = probeRenderer()
    run(gate, renderer, scenario, sheet, brush, emboss, body, light, wetMode)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    writeResult({
      gate,
      scenario,
      brush: brush ?? null,
      emboss: emboss ?? null,
      body: body ?? null,
      light: light ?? null,
      wetMode,
      bakeMs: null,
      renderMs: null,
      width: sheet,
      height: sheet,
      digestPaper: null,
      digestTransparent: null,
      digestWhite: null,
      digestPigment: null,
      byteLength: null,
      renderer,
      verdict: `MEDIUM-ENGINE FAIL ${message}`,
      error: message,
    })
  }
}

main()
