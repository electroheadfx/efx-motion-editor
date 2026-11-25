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
//  64-17, pigment — the compositor view) and echoes the 64-04
//  `--light <0..4>` intensity it was shaded with.
//
//  The shipped alpha law (2026-11-21, restated by 64-31), in one voice:
//    - committed and exported storage alpha is OPAQUE — every export carries
//      coverage-free straight alpha, and no alpha is derived from coverage;
//    - coverage lives ONLY in the coverage raster, a probe-only instrument
//      that is never an export channel;
//    - the display alpha is the DARKNESS of the visible pigment (mode 4:
//      alpha = 1 − min(rgb) of the compositor view) — it never composes with
//      a coverage term.
//  Every capture proves both halves, over EVERY texel: the opaque-export check
//  scans the paper, white and transparent surfaces, and the visible-alpha
//  check compares the pigment export's alpha with the transparent export's
//  darkness on the same painted pixels. Both live in `alphaLaw.ts` so the pure
//  functions also run in vitest.
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
//  64-17 adds the pigment sheet to the gate: `engine.exportCanvas('pigment')`
//  is the mode-4 COMPOSITOR view. Under the shipped alpha law its alpha is
//  the darkness of the visible pigment alone — coverage is NOT part of it,
//  and coverage claims read the coverage raster — so every report digests it
//  as `digestPigment` beside the three backgrounds and run.mjs refuses a
//  capture without it. Adding the export leaves the other three
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
//  (default 100) crossing it. Since the 2026-11-21 law the pigment export's
//  alpha is the pigment's darkness ALONE — it carries no coverage term — so
//  64-31 measures the coverage claim on the COVERAGE raster, the only channel
//  that carries coverage. `crossDarkAlpha` stays measured on the TRANSPARENT
//  export on purpose: it is the darkness the pre-coverage commit derived from
//  the sheet, so `crossCoverage − crossDarkAlpha` is the coverage that exists
//  beyond that darkness.
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
//  crossing box's mean and peak COVERAGE on the COVERAGE raster before and
//  after eight extra wet ticks, plus the covered-paper-white scan after them
//  (64-31: the raster is the instrument; no export's alpha is re-derived into
//  a coverage claim).
//
//  64-14 also adds `cover-lift`: the cover geometry fully fixed, then a LIFT
//  stroke (the same tool through the same applyStroke seam at pressure 0.8)
//  across the covering diagonal. The report carries the crossing COVERAGE on
//  the coverage raster before and after the lift stroke, plus the paper-white
//  scan after it — the bounded limitation "Lift does not reduce coverage"
//  becomes a measured assertion.
//
//  64-16 adds the brush operand and the textured-tip scenario: `--brush <id>`
//  selects the covering stroke's brush (resolved against BRUSH_PRESETS, an
//  unknown id throws with the known list), and `cover-textured` paints the
//  `cover` geometry with that brush on the light diagonal (default `chalk`)
//  so a chalk stroke's coverage can be measured as a SPREAD rather than a
//  solid disc. The report adds the COVERAGE distribution over TEXTURED_BOX —
//  mean, P10, P90, covered fraction — read on the coverage raster, plus the
//  crossing's blue excess and the whole-sheet paper-white scan on the
//  transparent export. The coverage raster is the instrument; no export's
//  alpha is re-derived into a coverage claim (the shipped alpha law above).
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

import {
  BRISTLE_VISIBLE_ALPHA_SKIP,
  opaqueExportCheck,
  visibleAlphaCheck,
  visibleAlphaSkipped,
} from './alphaLaw'
import { WatercolorEngine, clampDocSize } from '../../src/playground/Engine'
import { BRUSH_PRESETS } from '../../src/playground/brushes'
import { PAPERS, type PaperPreset } from '../../src/playground/papers'
import { MEDIUMS } from '../../src/playground/mediums'
import { fromHalf } from '../../src/playground/half'
import { createAquarelleEngineAdapter } from '../../src/adapter/engineAdapter'
// 64-29: the texture-tip A/B registers its own deterministic mask through the
// SHIPPED registry (never a probe-private path), so the length contract the
// engine trusts is the one the gate exercises.
import { registerMask } from '../../src/brushes/maskRegistry'
import { TIP_MASK_BYTES, TIP_MASK_EDGE } from '../../src/brushes/deriveMask'
// 64-29: the echo reads the tip resolution through the SAME projection the
// adapter hands the engine (buildBrushForStroke), not a re-derived guess.
import { buildBrushForStroke } from '../../src/playground/brushBridge'
// bristle-end (2026-11-23): the live drive configures the engine exactly like
// the adapter's own `configure()` — the same param mapping, colour resolution
// and per-stroke seed derivation, so a live end and its re-bake are the same
// stroke in every input the engine sees.
import { engineScaleToSize, sizeToEngineScale, toEngineParams } from '../../src/playground/params'
// quick 261125-rtc: the report names the effective sampling factor the dab
// chain ran at, through the engine's OWN size round trip.
import { bristleSampleScale } from '../../src/playground/bristles'
import { pigmentFromHex } from '../../src/playground/spectral'
// Spec 10: the CPU band mirror (`displayBasisGLSL`'s own tables and epsilon)
// — the probe decodes the committed sheet through the display's exact law.
import {
  BASIS,
  DISPLAY_BANDS,
  DISPLAY_RGB_WEIGHTS,
} from '../../src/playground/spectralData'
import { SCATTER_EPSILON } from '../../src/playground/scattering'
import { hashMutationId } from '@efxlab/efx-paint-host'
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
  /** 64-31: the exported pixels, kept beside the digest so the capture-level
   *  alpha-law checks read the SAME already-read buffers — no extra export,
   *  no extra readback. */
  readonly pixels: Uint8ClampedArray
}

function digestCanvas(canvas: HTMLCanvasElement): Digest {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('digest: exported canvas has no 2D context')
  const buffer = new Uint8ClampedArray(ctx.getImageData(0, 0, canvas.width, canvas.height).data)
  return { digest: hashPixels(buffer), byteLength: buffer.length, pixels: buffer }
}

// --- the shipped alpha law, checked on every capture (64-31) -----------------
//
// The law and its two checks live in `alphaLaw.ts`, so the pure functions run
// in vitest over synthetic buffers as well as in the capture path below. Both
// checks scan every texel: a fixed prime stride walks a right-edge lattice on
// every power-of-two sheet and can miss the paint entirely.

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

/**
 * Mean alpha byte, 0..1, over a box — channel-agnostic arithmetic. Given the
 * coverage raster it reads coverage (`exportCoverageCanvas` writes the value
 * to rgb AND alpha); given a premultiplied export it reads a genuine alpha.
 * 64-31: the two meanings never merge again — coverage claims call the
 * coverage-named wrappers below, and nothing calls this with a pigment export
 * to infer coverage.
 */
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

/**
 * Mean and peak alpha byte, 0..1, over a box — channel-agnostic arithmetic
 * (64-14), shared by the coverage wrapper and any genuine alpha reading.
 */
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

/** 64-31: mean COVERAGE, 0..1, over a box on the coverage raster. The only
 *  accessor a coverage claim may use; the value lives in every exported
 *  channel, so the generic alpha arithmetic reads it unchanged. The committed
 *  cover baselines predate this vocabulary and are stale by design — 64-36
 *  re-captures them; this plan edits no baseline. */
function coverageMean(canvas: HTMLCanvasElement, box: BandBox): number {
  return alphaMean(canvas, box)
}

/** 64-31: mean and peak COVERAGE, 0..1, over a box on the coverage raster —
 *  the lifecycle gates' accessor (see `coverageMean` for the stale-baseline
 *  note). */
function coverageStats(canvas: HTMLCanvasElement, box: BandBox): { mean: number; peak: number } {
  return alphaStats(canvas, box)
}

/** Mean of 1 − min(r, g, b)/255 over a box on the transparent export — the
 *  darkness the display derives its alpha from. This stays the DARKNESS claim:
 *  after the 2026-11-21 law it carries no coverage term, and no coverage claim
 *  may read it as one. */
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
  /** Texels the coverage raster claims to cover (coverage ≥ threshold). */
  readonly covered: number
  /** Of those, texels whose transparent sheet still reads as bare paper. */
  readonly count: number
  /** Union bbox of the offending texels, doc uv, y up (like `darkAlphaMean`). */
  readonly box: BandBox
}

/**
 * The offender census behind `coveredPaperWhitePct` — one texel loop serves
 * both readings, so the percentage can never disagree with the census it
 * reports. Counts the texels the CLEARED pigment raster claims visible film on
 * (alpha ≥ threshold) and, among them, the texels that still read as bare
 * paper (≥ 250 luma) on the transparent export; returns the offending texels'
 * union bbox in document uv (y up), or `null` when no texel offends.
 *
 * The covered set is the PIGMENT export's alpha, not the raw coverage raster:
 * the engine closes this census at the capture boundary (`coverClearFS` zeroes
 * the claim where the finished film reads paper-white, pigment mode only), so
 * the raw coverage raster still carries claims the clear retires. Reading it
 * here counted those retired claims as offenders and made a correct
 * `white-over-blue` capture fail its own zero bar (review CR-02, 2026-11-22).
 * Coverage quantities proper (`crossCoverage`, the lifecycle means) still read
 * the coverage raster — this census is a paper-white claim, not a coverage one.
 *
 * 64-20 exists so a failing scan NAMES its texels: the percentage alone said
 * "0.88" while the four exported digests said nothing about where. The
 * committed cover baselines predate this vocabulary and are stale by design —
 * 64-36 re-captures them; this plan edits no baseline.
 */
function coveredPaperWhiteBox(
  transparent: HTMLCanvasElement,
  cleared: HTMLCanvasElement,
  threshold = 0.5,
): CoveredPaperWhiteCensus | null {
  const ctxT = transparent.getContext('2d')
  const ctxC = cleared.getContext('2d')
  if (!ctxT || !ctxC) throw new Error('covered paper white: canvas has no 2D context')
  const w = transparent.width
  const h = transparent.height
  const t = ctxT.getImageData(0, 0, w, h).data
  const a = ctxC.getImageData(0, 0, cleared.width, cleared.height).data
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
 * Percentage of texels the CLEARED pigment raster claims visible film on
 * (alpha ≥ threshold) that still read as bare paper (≥ 250 luma) on the
 * transparent export — Spike 001's criterion-1 failure scan. 0 is the bar.
 * Measured on the engine-cleared pigment alpha; see `coveredPaperWhiteBox`
 * for why the raw coverage raster is the wrong channel for this claim.
 */
function coveredPaperWhitePct(
  transparent: HTMLCanvasElement,
  cleared: HTMLCanvasElement,
  threshold = 0.5,
): number {
  const census = coveredPaperWhiteBox(transparent, cleared, threshold)
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
  /** 261119-pod (D-E): the entry's Dry knob (0..100). The `bristle-edge`
   *  census was calibrated on the old, unfaithful 0.25/min depletion; under
   *  the reference-faithful rate (b8f6dfc0e) its light-wash load falls below
   *  the §4.4 paper threshold and the Feather-0 stroke deposits nothing.
   *  Pinning Dry 0 isolates the census's own variable — the Feather edge —
   *  without touching the engine. Omitted adds no key, so every identity
   *  gate's bag stays byte-identical. */
  readonly dry?: number
  /** bristle-line (2026-11-22): a FULL params bag that REPLACES the
   *  plan-01 STROKE_PARAMS base. The pale-line defect reproduces at the
   *  artist's medium record, not the neutral bag, so the scenario carries
   *  the acrylic record's own numbers (plus the canonical size/lift the
   *  record does not hold). The entry knobs still fold in on top, and the
   *  full bag is echoed in the report. Omitted keeps STROKE_PARAMS, so
   *  every pre-existing script is byte-identical. */
  readonly params?: Readonly<Record<string, number>>
  /** bristle-line (2026-11-22): capture the across-stroke profile set at
   *  this entry's three drive moments — after `applyStroke` (the bake
   *  surface), after the settle ticks, and after `fix()`. The defect must
   *  be named per surface; omitted entries capture nothing. */
  readonly captureLine?: boolean
  /** 64-29 (texture-tip A/B): the mask id this entry's tip is stamped
   *  through, projected through the existing toStudioStroke `textureId` slot.
   *  The engine resolves it against the mask registry and falls back to the
   *  response's own tip when unknown. Omitted adds no key, so every
   *  pre-existing script records byte-identically. */
  readonly textureId?: string
  /** 64-29: the per-stroke Pickup global (0..100), folded into the entry's
   *  params bag like every other entry knob. Omitted adds no key. */
  readonly pickup?: number
  /** quick 261123-hr5: the signed-emboss readings. 'before' records the band
   *  after this entry's own fix (the impasto); 'after' records it again after
   *  the smoothing entry's fix. Undefined entries capture nothing. */
  readonly captureRelief?: 'before' | 'after'
  /** Spec 10 (261125-kvl): read the OPEN stroke's layer + untouched sheet at
   *  3/4 of the stroke, before the stroke-end merge clears the layer. 'a' is
   *  the horizontal stroke (profiled on the paper side), 'b' the vertical one
   *  (profiled on the crossing side). Omitted entries capture nothing. */
  readonly captureEdge?: 'a' | 'b'
}

/** The canonical bag as the app records it (0..100). A knob adds its key;
 *  absent knobs add nothing — the neutral gate must send the plan-01 bag. */
function paramsBag(entry: ScriptEntry): Record<string, number> {
  // bristle-line: the entry's full bag replaces the neutral base; every
  // pre-existing entry carries no `params` and keeps STROKE_PARAMS verbatim.
  const bag: Record<string, number> = entry.params ? { ...entry.params } : { ...STROKE_PARAMS }
  if (entry.emboss !== undefined) bag['emboss'] = entry.emboss
  if (entry.body !== undefined) bag['body'] = entry.body
  if (entry.feather !== undefined) bag['feather'] = entry.feather
  if (entry.dry !== undefined) bag['dry'] = entry.dry
  // 64-29: the per-stroke Pickup global rides the SAME bag the engine reads;
  // an entry that does not set it adds nothing, exactly like the knobs above.
  if (entry.pickup !== undefined) bag['pickup'] = entry.pickup
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
    // 64-29: the existing toStudioStroke texture slot — no new payload shape.
    // Written only when the entry carries one, so every pre-existing stroke
    // keeps its exact key set (and a lift still drops it, per that projection).
    ...(entry.textureId !== undefined ? { textureId: entry.textureId } : {}),
  })
}

/** The plan-01 single stroke — byte-for-byte the pre-64 script with no knob. */
function neutralScript(emboss?: number, body?: number): readonly ScriptEntry[] {
  return [{ color: STROKE_COLOR, points: STROKE_POINTS, mutationId: MUTATION_ID, emboss, body }]
}

// quick 261123-hr5 (signed Emboss): the smoothing relation's band. Entry 1
// lays a +15 impasto over the plan-01 stroke geometry; entry 2 paints the SAME
// path at the signed value, so the only difference between the two readings is
// the erode pass. The box encloses the whole band with bare paper around it,
// so its mean is a band statistic, never a single-pixel probe.
const EMBOSS_SMOOTH_BOX: BandBox = { x0: 0.24, y0: 0.24, x1: 0.76, y1: 0.68 }

/** quick 261123-hr5: the signed-emboss scenario — a +15 impasto, then the same
 *  band at `smoothEmboss` (the `--emboss` operand, default -15). Each entry
 *  carries the resolved brush when one was requested, so `--brush bristle-flat`
 *  drives the bristle gather mask instead of the reliefFS footprint. */
function embossSmoothScript(smoothEmboss: number, brushId?: string): readonly ScriptEntry[] {
  const brush = brushId === undefined ? {} : { brushId }
  return [
    { color: STROKE_COLOR, points: STROKE_POINTS, mutationId: MUTATION_ID, emboss: 15, captureRelief: 'before', ...brush },
    { color: STROKE_COLOR, points: STROKE_POINTS, mutationId: MUTATION_ID + 1, emboss: smoothEmboss, captureRelief: 'after', ...brush },
  ]
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
 * darkness); `crossCoverage` reads the coverage raster captured in the same
 * run (64-31: the only channel that carries coverage since the 2026-11-21
 * law made the pigment export's alpha darkness-only). Their difference keeps
 * its meaning: coverage that exists beyond the pigment's own darkness.
 * 64-20 adds `coveredPaperWhiteBox` beside the percentage: the census names
 * the offending texels (count, covered, union bbox) or is `null` when the
 * scan is clean. The committed cover baselines predate this vocabulary and
 * are stale by design — 64-36 re-captures them; this plan edits no baseline.
 */
function whiteOverBlueMetrics(
  transparent: HTMLCanvasElement,
  coverage: HTMLCanvasElement,
  pigment: HTMLCanvasElement,
): Record<string, number | CoveredPaperWhiteCensus | null> {
  const cross = WHITE_OVER_BLUE_BOXES.crossing
  const stats = bandStats(transparent, cross)
  return {
    crossR: round2(stats.mean[0]),
    crossG: round2(stats.mean[1]),
    crossB: round2(stats.mean[2]),
    crossBlueExcess: round2(stats.blueExcess),
    crossCoverage: round2(coverageMean(coverage, cross)),
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
// covering stroke's tip alone. The spread is read from the COVERAGE raster
// (`engine.exportCanvas('coverage')`), the only channel that carries coverage:
// 64-31 removed the old derivation through the pigment export, whose alpha is
// darkness alone since the 2026-11-21 law.

/**
 * 64-16: the covering diagonal's MID-SHEET segment, where the light stroke's
 * own body sits clear of the fixed dark band. Deliberately separate from
 * `COVER_BOXES.crossing`, which stays the crossing measurement: this box asks
 * what the TIP lays down, not what the covering stroke did to the underlayer.
 */
const TEXTURED_BOX: BandBox = { x0: 0.44, y0: 0.41, x1: 0.58, y1: 0.55 }

/**
 * 64-16: the alpha-byte distribution over a box — a 256-bin histogram, so
 * P10/P90 need no sort. Channel-agnostic arithmetic (64-31): given the
 * coverage raster it measures coverage, whose export writes the value to
 * every channel; no coverage claim calls it with a pigment export any more.
 * `coveredFraction` is the share of sampled pixels at or above the 0.5
 * coverage threshold (bin 128), the same threshold the paper-white scan uses.
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

/** 64-31: the COVERAGE distribution over a box on the coverage raster — the
 *  spread the textured-tip gate bars. Named for the quantity it measures, so
 *  a coverage claim can never again be written as an alpha claim. */
function coverageSpread(
  canvas: HTMLCanvasElement,
  box: BandBox,
): { p10: number; p90: number; coveredFraction: number } {
  return alphaSpread(canvas, box)
}

/**
 * 64-16: the textured-tip scene — the `cover` geometry with the covering
 * stroke stamped by `brushId`. Only the light diagonal carries the brush and
 * the Body knob; the dark underlayer is `round` at Body 0 so the spread is
 * the tip's, never the band's.
 */
function coverTexturedScript(emboss?: number, body?: number, brushId?: string): readonly ScriptEntry[] {
  // 261119-pod (D-F): under the reference-faithful depletion (b8f6dfc0e) a
  // Dry-50 bristle brush starves before the recorded light diagonal is laid —
  // the four cover-textured records rendered blank (covered 0/0 at 1080, 0.05
  // at 2048) and no relation could be enforced. The SCENE pins Dry 0; the
  // engine's Dry semantics and depletion curve are untouched. Only the two
  // bristle brushes get the pin — the `--brush chalk` identity bag never gains
  // the key, so the eight identity gates stay byte-identical. The dark
  // underlayer is a non-bristle `round` stroke and never reads `dry`.
  const pinDry = brushId === 'bristle-flat' || brushId === 'bristle-round'
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
      ...(pinDry ? { dry: 0 } : {}),
    },
  ]
}

/**
 * 64-16: the textured-tip readings. The coverage mean/spread, the
 * blue-excess reader and the paper-white scan are 64-17's helpers — consumed,
 * never forked; 64-31 moves the coverage reads onto the coverage raster and
 * keeps the pigment export only for its own RGB. The committed cover
 * baselines predate this vocabulary and are stale by design — 64-36
 * re-captures them; this plan edits no baseline.
 */
function coverTexturedMetrics(
  transparent: HTMLCanvasElement,
  pigment: HTMLCanvasElement,
  coverage: HTMLCanvasElement,
): Record<string, number> {
  const spread = coverageSpread(coverage, TEXTURED_BOX)
  const cover = coverageMean(coverage, TEXTURED_BOX)
  // Post-UAT descriptor (the bristle deposit must CARRY the paint): the
  // pigment export's own RGB beside the film's darkness and the layer
  // coverage. A washed deposit solves to near-white RGB while the film stays
  // pale; a real deposit reads its pigment colour, and coverage never runs
  // further ahead of the film than the carried opacity allows.
  const coreMean = bandStats(pigment, TEXTURED_BOX).mean
  const filmDarkness = darkAlphaMean(transparent, TEXTURED_BOX)
  return {
    coverCoverageMean: round2(cover),
    coverCoverageP10: round2(spread.p10),
    coverCoverageP90: round2(spread.p90),
    coverCoverageCoveredFraction: round2(spread.coveredFraction),
    coverCorePigmentMean: round2((coreMean[0] + coreMean[1] + coreMean[2]) / 3),
    coverCoreFilmDarkness: round2(filmDarkness),
    coverCoreCoverageMinusFilm: round2(cover - filmDarkness),
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
 * reused) whose covered set is the COVERAGE raster (64-31). `lumaRatio` is
 * finalLuma / referenceLuma; `deltaHue` is signed degrees, wrapped to
 * (−180, 180].
 */
function redOverBlueMetrics(
  transparent: HTMLCanvasElement,
  pigment: HTMLCanvasElement,
  coverage: HTMLCanvasElement,
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
/** 64-29: the fraction of the plateau a row must still carry to count as
 *  fringe SUPPORT beyond the 50 % crossing. A pressure-ring bine keeps a
 *  visible skirt below the crossing; a binary cross-fade drops to 0 within a
 *  texel and has none. 2 % sits under the halo walk's own 2 %-of-plateau
 *  clamp, so the two readings describe the same visible fringe. */
const EDGE_SUPPORT_FRACTION = 0.02
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
      dry: 0,
      brushId: 'bristle-flat',
    },
    {
      color: EDGE_COLOR,
      points: horizontalLine(EDGE_FEATHER_100_Y),
      mutationId: 0x7ee201,
      feather: 100,
      dry: 0,
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

/** 64-29: the four shape scalars of one measured edge, derived in one pass
 *  over the measured stations. Except the density they are in document
 *  pixels.
 *
 *  - irregularity — median |Δ| of the 50 % crossing position between adjacent
 *    stations: how far the edge meanders along the stroke.
 *  - roughness — median |Δ²| of the same positions: how much the meander
 *    itself changes. A staircase (flat run, jump, flat run) is rough; a slow
 *    wave is irregular but smooth. Deliberately has NO ceiling here: the
 *    engine's acceptable roughness is 64-34's finding, not this gate's.
 *  - support — median distance from the 50 % crossing to the outermost row
 *    still above `EDGE_SUPPORT_FRACTION` of the plateau: the fringe that
 *    survives BEYOND the crossing. A binary cross-fade has none.
 *  - fringe density — the share of measured stations whose support clears one
 *    device pixel, in percent. Aliasing (crossing position quantised to whole
 *    rows) and a fully supported fringe can share an irregularity reading and
 *    differ here. */
interface EdgeProfileStats {
  readonly irregularityPx: number
  readonly roughnessPx: number
  readonly supportPx: number
  readonly fringeDensityPct: number
}

/**
 * 64-29: derive the four scalars in ONE pass over the measured stations, so
 * both Feather levels are read by the same arithmetic (the 64-23 census's
 * core principle). Two stations are the minimum for an irregularity and three
 * for a roughness; a shorter list reads 0 — the comparator's "> 0" bars then
 * name the degenerate capture instead of the derivation pretending.
 */
function edgeProfileStats(
  crossings: readonly number[],
  supports: readonly number[],
): EdgeProfileStats {
  const firstDiffs: number[] = []
  for (let i = 1; i < crossings.length; i += 1) {
    firstDiffs.push(Math.abs(crossings[i]! - crossings[i - 1]!))
  }
  const secondDiffs: number[] = []
  for (let i = 1; i < crossings.length - 1; i += 1) {
    secondDiffs.push(Math.abs(crossings[i + 1]! - 2 * crossings[i]! + crossings[i - 1]!))
  }
  const supported = supports.filter((support) => support > 1).length
  return {
    irregularityPx: median(firstDiffs),
    roughnessPx: median(secondDiffs),
    supportPx: median(supports),
    fringeDensityPct: supports.length === 0 ? 0 : (supported / supports.length) * 100,
  }
}

/** One stroke's census: the median 90 %−10 % width, the P90−P10 spread of the
 *  50 % crossing, the median crossing distance (the measured half-width), the
 *  plateau the halves were normalised by, and the 64-29 shape scalars. */
interface EdgeCensus extends EdgeProfileStats {
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
  const supports: number[] = []
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
    // The outermost row still carrying `EDGE_SUPPORT_FRACTION` of the plateau
    // — the fringe's far edge. The walk runs to `limit` regardless of the
    // crossings, so this lands on the furthest row above the fraction.
    let supportOuter: number | null = null
    for (let row = startRow - 1; row >= limit; row -= 1) {
      const norm = valueAt(row, x) / plateauAlpha
      if (norm >= EDGE_SUPPORT_FRACTION) supportOuter = centreRow - row
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
    // Support is measured BEYOND the crossing; a full column (no row below the
    // fraction inside the scan band) clamps to 0, never a negative distance.
    supports.push(supportOuter === null ? 0 : Math.max(0, supportOuter - found.p50))
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
    ...edgeProfileStats(crossings, supports),
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
 *
 * 64-29 adds the four shape scalars per stroke (see `edgeProfileStats`) and
 * the per-stroke half-widths beside the compatibility mean. Recorded readings
 * from `node run.mjs --gate bristle-edge-1080 --scenario bristle-edge --size
 * 1080` on this tree (two runs, 0 differing fields — the derivation is
 * deterministic; the ABSOLUTE values move with the engine and are evidence,
 * not contract):
 *
 *   Feather 0:   softness 20.27  variation 0.08  irregularity 0.04
 *                roughness 0.08  support 0.31  density 0 %   half-width 28.09
 *                plateau 0.10   (6 of 24 stations skipped as dash gaps)
 *   Feather 100: softness  1.87  variation 4.38  irregularity 1.82
 *                roughness 2.26  support 0.29  density 35 %  half-width 19.57
 *                plateau 0.09   (4 of 24 stations skipped as dash gaps)
 *
 * What the numbers say about the profiles: Feather 0 is nearly a ruler
 * (0.04 px station-to-station) with a sub-pixel support skirt (0.31 px, no
 * station clearing one device pixel); Feather 100 meanders (1.82 px) with a
 * rougher second difference (2.26 px) and a fringe that clears a texel on
 * 35 % of the stations. The softness direction (Feather 0 wider than Feather
 * 100) is inverted from the fixture-era capture because the current engine
 * plateaus differ — the census gate records it and the committed
 * `bristle-edge-1080` baseline predates that engine state (see the SUMMARY's
 * deferred item); 64-29 changes the probe only, never the engine.
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
  const zero: EdgeCensus = {
    softnessPx: 0,
    variationPx: 0,
    halfWidthPx: 0,
    plateauAlpha: 0,
    irregularityPx: 0,
    roughnessPx: 0,
    supportPx: 0,
    fringeDensityPct: 0,
  }
  const feather0 =
    strokeEdgeCensus(data, w, h, EDGE_FEATHER_0_Y, 'feather-0', failures, skips) ?? zero
  const feather100 =
    strokeEdgeCensus(data, w, h, EDGE_FEATHER_100_Y, 'feather-100', failures, skips) ?? zero
  return {
    edgeSoftnessPxFeather0: round2(feather0.softnessPx),
    edgeSoftnessPxFeather100: round2(feather100.softnessPx),
    edgeVariationPxFeather0: round2(feather0.variationPx),
    edgeVariationPxFeather100: round2(feather100.variationPx),
    edgeIrregularityPxFeather0: round2(feather0.irregularityPx),
    edgeIrregularityPxFeather100: round2(feather100.irregularityPx),
    edgeRoughnessPxFeather0: round2(feather0.roughnessPx),
    edgeRoughnessPxFeather100: round2(feather100.roughnessPx),
    edgeSupportPxFeather0: round2(feather0.supportPx),
    edgeSupportPxFeather100: round2(feather100.supportPx),
    edgeFringeDensityPctFeather0: round2(feather0.fringeDensityPct),
    edgeFringeDensityPctFeather100: round2(feather100.fringeDensityPct),
    edgeHalfWidthPx: round2((feather0.halfWidthPx + feather100.halfWidthPx) / 2),
    edgeHalfWidthPxFeather0: round2(feather0.halfWidthPx),
    edgeHalfWidthPxFeather100: round2(feather100.halfWidthPx),
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

// --- bristle-line (2026-11-22, the acrylic pale-line defect) ----------------
//
// The defect: every Acrylic bristle stroke drags a thin (1-3 px) PALER film of
// its own pigment along its length — on bare paper and over earlier paint.
// This scenario reproduces it through the real engine at the ARTIST'S
// parameters and measures the three fields the defect could live in:
//
//   cover  the coverage channel (the gather's per-texel coverage weighted by
//          Body's film opacity — `bristleCoverFS`'s ONE write)
//   dark   the displayed film, 1 - min(rgb) on the `transparent` export
//          (the engine's own `darkAlpha` — the visible paint)
//   ink    the delivered ink absorbance: the mean of the seven absorbance
//          coefficients, read from the engine's OWN half-float pigment
//          targets (ink + fixed), never a re-derivation from the export
//
// The profile is a mean along the stroke's central half (x 0.25..0.75), one
// row per document pixel across the stroke's ±48 px band, plus three
// single-column station profiles (±16 px) so a lane's CONTINUITY can be
// checked. The same set is captured at three surfaces: after `applyStroke`
// (the bake drive), after the settle ticks and after `fix()`.
//
// PARAMETERS: the acrylic medium record's own numbers, with Body overridden
// to the artist's value. The artist reports Body 0 while
// `MEDIUMS.acrylic.params.body` is 100 — the mismatch is recorded in the
// report (`paramsEcho`), and the record is NOT changed here. `size` (12) and
// `lift` (22) are the canonical members the record does not carry.
const LINE_COLOR = '#2b6fd0'
const LINE_Y = 0.5
const LINE_X0 = 0.15
const LINE_X1 = 0.85
const LINE_MUTATION_ID = 0x7ee400
/** The across band the profile covers, in document pixels either side.
 *  2026-11-22: `--band` widens it — a stroke at a large `size` is wider than
 *  the original ±48 band, and a lane must be judged against the stroke's
 *  TRUE support, not a clipped window. The 2026-11-22 UAT-row-3 failure
 *  proved the point twice over: the artist-visible writer sat at ±62 px,
 *  OUTSIDE the ±48 default, and every earlier bisection was blind to it. The
 *  default is now the full brush (±140) and the TILING/enclosed metrics read
 *  fixed fringe rows out to ±96 px. */
let LINE_BAND_PX = 140
/** Single-column stations inside the stroke's central half. */
const LINE_STATIONS: readonly number[] = [0.35, 0.5, 0.65]
const LINE_STATION_HALF = 16
/** The along-stroke span the across profile averages, as doc uv x. */
const LINE_PROFILE_X0 = 0.25
const LINE_PROFILE_X1 = 0.75
/** 2026-11-22 (bristle-line gate): the halo's "pale ring" fraction — the run
 *  counts consecutive fringe rows whose darkness exceeds this fraction of the
 *  interior plateau (5 %, HALO_RUN_FRACTION in compare.mjs). */
const LINE_HALO_RUN_FRACTION = 0.05
/** 2026-11-22 (bristle-line-over): the understory is a WETTING pass, never a
 *  mark. Four measured facts shape it:
 *  (1) the engine's load floor (deposit.ts: `(0.35 + load01 * 1.3) *
 *      capacity`) means a load-0 pass still deposits 0.35× the base load —
 *      lowering Load alone left a 6–15 % film at load 5 (measured);
 *  (2) the halo walk's 2 %-of-plateau clamp ends only when the composite
 *      falls below 0.02 × 0.62 ≈ 0.012 darkness, so any understory pigment
 *      that surfaces beside the line is read as the line's own halo;
 *  (3) the per-stamp strength is the pressure multiplier
 *      (`strength = clamp(p, 0.15, 1)`), and wetness scales with the same
 *      coverage — the lightest touch (0.15) is the weakest wetting pass the
 *      engine can stamp; and
 *  (4) every recorded point is one host tick, so a two-point sweep carries
 *      one spread tick over the profile window while the artist's three-point
 *      drag carries three.
 *  Size 400 (measured: 800 puts the understory's own bristle structure back
 *  into the band — halo run 10, enclosure max-run 83 px — and 200 leaves a
 *  6–15 % film) plus the lightest touch and the single spread tick keep the
 *  understory's own visible film at or below 0.011 darkness = 1.8 % of the
 *  0.622 line plateau. That is INSIDE the halo walk's outward 2 %-of-plateau
 *  clamp, so the walk ends inside the LINE's own fringe exactly as it does on
 *  bare paper, and the understory cannot masquerade as a halo. The lateral
 *  offset (0.52 in doc uv y ≈ 22 px above the line at 1080) keeps the film
 *  off the line's plateau sample. `fixAfter: false` keeps the pass mobile:
 *  the judged line lands on wet paint, which is the variant's whole point. */
const LINE_OVER_Y = 0.52
const LINE_OVER_SIZE = 400
const LINE_OVER_X0 = 0.02
const LINE_OVER_X1 = 0.98
const LINE_OVER_LOAD = 0
const LINE_OVER_PRESSURE = 0.15
const LINE_OVER_MUTATION_ID = 0x7ee4ff

/** The artist's straight drag: constant y, constant pressure, no tilt. */
function straightLine(y: number): readonly AquarellePoint[] {
  return [
    { x: LINE_X0, y, p: 0.75, tx: 0, ty: 0, tw: 0 },
    { x: (LINE_X0 + LINE_X1) / 2, y, p: 0.75, tx: 0, ty: 0, tw: 0 },
    { x: LINE_X1, y, p: 0.75, tx: 0, ty: 0, tw: 0 },
  ]
}

/** The understory's ONE sweep: two points (one spread tick over the profile
 *  window), both endpoints outside the 0.25..0.75 profile window, stamped at
 *  the lightest touch so the mobile film stays faint. */
function understoryLine(y: number): readonly AquarellePoint[] {
  return [
    { x: LINE_OVER_X0, y, p: LINE_OVER_PRESSURE, tx: 0, ty: 0, tw: 0 },
    { x: LINE_OVER_X1, y, p: LINE_OVER_PRESSURE, tx: 0, ty: 0, tw: 0 },
  ]
}

/**
 * The FULL artist bag: the acrylic record verbatim, Body overridden, plus the
 * canonical members the record does not hold. The spread order is the point —
 * a record key wins, then `size`/`lift` are added, then the quick-261125-rtc
 * Dry/Feather overrides, then Body is pinned. The overrides MUST follow the
 * record's spread: the acrylic record states Feather 85 and the artist's bag
 * is Feather 100, so the operand is the only way to reach it.
 */
function bristleLineParams(
  body: number,
  strokeSize: number,
  overrides?: { dry: number | null; feather: number | null },
): Record<string, number> {
  const acrylic = MEDIUMS.find((medium) => medium.id === 'acrylic')
  if (!acrylic) throw new Error('bristle-line: the acrylic medium record is missing')
  return {
    size: strokeSize,
    lift: STROKE_PARAMS['lift']!,
    ...acrylic.params,
    ...(overrides?.dry != null ? { dry: overrides.dry } : {}),
    ...(overrides?.feather != null ? { feather: overrides.feather } : {}),
    body,
  }
}

/** 2026-11-22: the stroke's own mutation id — the per-stroke seed. Two runs
 *  with different ids move any bristle-set structure and leave any
 *  law/screen-locked structure in place (the lane's discriminating test). */
function readMut(): number {
  const raw = new URLSearchParams(location.search).get('mut')
  if (raw === null || raw === '') return LINE_MUTATION_ID
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`invalid mut "${raw}" (expected a non-negative integer)`)
  }
  return Math.floor(value)
}

/** The `--over` understory: ONE wide, low-load, light-touch pass of the same
 *  brush, left MOBILE (`fixAfter: false`) so the judged line lands on wet
 *  paint. Its geometry and strength are chosen from the film measurements
 *  recorded above LINE_OVER_Y: the understory's own visible film stays under
 *  the halo walk's outward 2 %-of-plateau clamp, so the walk ends inside the
 *  line's own fringe and the metric reads the line, not the understory. */
function bristleLineOverEntry(): ScriptEntry {
  return {
    color: LINE_COLOR,
    points: understoryLine(LINE_OVER_Y),
    mutationId: LINE_OVER_MUTATION_ID,
    params: { ...bristleLineParams(0, LINE_OVER_SIZE), load: LINE_OVER_LOAD, feather: 100 },
    // quick 261125-rtc: `bristle-flat` was retired by 261124-iq9 and silently
    // resolves to the watercolor `round`, so every pale-line capture ran the
    // classic path. The artist's brush is bristle-round (Gouache): the gate
    // must exercise the gather to be a no-lane gate at all.
    brushId: 'bristle-round',
    fixAfter: false,
  }
}

/** ONE straight bristle-round stroke at the artist's parameters. `--over`
 *  prepends the understory; the judged entry is always last and alone carries
 *  `captureLine`, so the profile captures never include the bare understory. */
function bristleLineScript(
  body: number,
  strokeSize: number,
  mut: number = LINE_MUTATION_ID,
  over: boolean = false,
): readonly ScriptEntry[] {
  const judged: ScriptEntry = {
    color: LINE_COLOR,
    points: straightLine(LINE_Y),
    mutationId: mut,
    params: bristleLineParams(body, strokeSize),
    brushId: 'bristle-round',
    captureLine: true,
  }
  return over ? [bristleLineOverEntry(), judged] : [judged]
}

/** 2026-11-22: the across band the line profile samples, in document pixels
 *  either side of the centreline — absent keeps 140 (the full brush; the
 *  artist-visible lane at ±62 px was outside the old ±48 default). */
function readBand(): number {
  const raw = new URLSearchParams(location.search).get('band')
  if (raw === null || raw === '') return 140
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 16 || value > 400) {
    throw new Error(`invalid band "${raw}" (expected 16..400)`)
  }
  return Math.round(value)
}

/** 2026-11-22: the `--over` understory flag. Absent keeps the bare-paper
 *  capture; `1` prepends the wide low-load mobile pass. run.mjs refuses the
 *  flag on every other scenario, so this check is the second line of defence. */
function readOver(): boolean {
  const raw = new URLSearchParams(location.search).get('over')
  if (raw === null || raw === '') return false
  if (raw !== '1') {
    throw new Error(`invalid over "${raw}" (expected 1)`)
  }
  return true
}

/** 2026-11-22: the bristle-line stroke's own `size` key — absent keeps
 *  STROKE_PARAMS' 12 so the first captures stay reproducible.
 *  quick 261125-rtc: the ceiling widens 200 -> 400 for the artist's five-size
 *  sweep (50/100/150/200/300); 300 is the 16x sampling cell. */
function readStrokeSize(): number {
  const raw = new URLSearchParams(location.search).get('strokeSize')
  if (raw === null || raw === '') return STROKE_PARAMS['size']!
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 1 || value > 400) {
    throw new Error(`invalid strokeSize "${raw}" (expected 1..400)`)
  }
  return value
}

// --- Spec 10: the per-stroke translucent stroke layer (spike 006) -----------
//
// Edge transparency is a LATERAL alpha that lets the underlayer through in
// proportion. It cannot be expressed as a per-dab deposit into the same sheet:
// after N dabs the one lerp's fixed point is always the pigment target,
// independent of the underlayer. So the stroke is composited ONCE, as a layer,
// over the sheet at stroke end (DESIGN 3.1-3.4):
//
//   u     = clamp(MIN over covering dabs of |across| / uFeatherEdge, 0, 1)
//   t     = clamp((u - 0.30) / 0.70, 0, 1)
//   e     = 2^(2b - 1)                                  b = edgeFalloff 0..1
//   A     = 1 - amount * t^e                            amount = edgeFade 0..1
//   A_eff = A * cover_L
//   band_out,i = A_eff * band_L,i + (1 - A_eff) * band_S,i      (S_out likewise)
//
// `band_*` is the DISPLAY band value — Kubelka-Munk reflectance over white when
// S > SCATTER_EPSILON, the legacy exp(-k) otherwise. Never a transmittance: the
// exp/ln round trip fails the design's own 50 %-over-white test on Gouache by
// 28.95/255 (spike 006, Q1).
//
// The commit encodes (band_out, S_out) back into the sheet's seven
// coefficients with the frozen encoder: 8 compiled bands [1,3,5,7,9,10,11,13],
// a rank-one Jacobian, 4 LM iterations, a seed mix(base, layer, aEff), the
// residual judged through all 16 bands, and the in-place write-back
// `ink = fit/k - fixed` (k is the display's own granulation step — the storage
// domain form of the frozen `fit - fixed`).
//
// Amount 0 is a BRANCH, not a value: no layer target is allocated, no merge
// draw is submitted, the shipped deposit path renders byte-identically
// (measured 203/255 divergence if the layer path ran at amount 0).
//
// This capture is the layer's instrument. It drives spike 006's two straight
// strokes (`probe/q4.ts`: A horizontal, then B vertical over A) and reports,
// per side — A's band over bare paper, B's band over the same-visit stroke —
// the lateral profile and the layer-domain bars. The layer exists only while
// its stroke is open, so each stroke is driven through the adapter's
// PROGRESSIVE seam (`renderPartialStrokes` with a partial count leaves the
// stroke open), the layer targets and the untouched sheet are read at 3/4 of
// the stroke, and the stroke then completes and merges. On a pre-change engine
// every layer member is missing: the capture reports those readings ABSENT
// (never a fabricated zero) and the comparator fails by name — the documented
// RED the tracer closes.
const EDGE_LAYER_DEFAULT_AMOUNT = 0
const EDGE_LAYER_DEFAULT_FALLOFF = 50
/** The knobs, read once by `main()` before any stroke — module state like
 *  `LINE_BAND_PX`, so a refused operand can never leave a painted sheet. */
let EDGE_LAYER_AMOUNT = EDGE_LAYER_DEFAULT_AMOUNT
let EDGE_LAYER_FALLOFF = EDGE_LAYER_DEFAULT_FALLOFF
/** Mirrors BRISTLE_EDGE_START (DESIGN 3.3 pins 0.30) and the comparator's
 *  EDGE_START: where the lateral band begins, in silhouette units. */
const EDGE_LAYER_START = 0.3
/** The band's midpoint in silhouette units: (START + 1) / 2. */
const EDGE_LAYER_MID_U = (EDGE_LAYER_START + 1) / 2
/** Spike 006's two strokes: A horizontal (`#1d3f7a`), B vertical (`#c2402a`),
 *  so they cross and B's outboard band sits over A's paint. */
const EDGE_LAYER_A_COLOR = '#1d3f7a'
const EDGE_LAYER_B_COLOR = '#c2402a'
const EDGE_LAYER_A_MUTATION = 0x5a0001
const EDGE_LAYER_B_MUTATION = 0x5b0001
/** The along-stroke window each side's profile averages, as doc uv. A is read
 *  away from the crossing (over bare paper); B is read ON the crossing, so its
 *  outboard band lies over A's paint. */
const EDGE_LAYER_PAPER_X0 = 0.2
const EDGE_LAYER_PAPER_X1 = 0.36
const EDGE_LAYER_UNDER_Y0 = 0.47
const EDGE_LAYER_UNDER_Y1 = 0.53
/** The fraction of the stroke's recorded samples fed before the layer is read.
 *  ALL of them: the engine's dwell keeps the STAMPED position behind the fed
 *  samples (measured: 2 of 3 points fed, the stroke at y 0.37 while B's under
 *  window starts at y 0.47), so a 3/4 feed leaves stroke B short of the
 *  crossing the capture profiles. The sample count is not the reading: the
 *  stroke's ending is still pending at the capture (manual mode — `scriptEnd`
 *  only flags it), so the end-cap dab and the merge have not run, and both
 *  windows (A's near its start, B's at the crossing) are stamped. */
const EDGE_LAYER_PARTIAL = 1
/** The encoder's exact-endpoint set: a texel whose FROZEN band alpha `aEff`
 *  reaches this is an identity (the merge writes the layer's raw storage),
 *  not a fit — so `coreExact` may require 0/255 there. cover_L alone is NOT
 *  the endpoint set: `aEff = (1 − amount·t^e)·cover_L` falls below 1 wherever
 *  the lateral fade is active even at a full cover. */
const EDGE_LAYER_CORE_AEFF = 1 - 1e-4
/** The merge's two exact endpoints (`aEff >= 1 − 1e-4` / `<= 1e-4`): they
 *  write the layer's raw storage / copy the sheet through, so the expected
 *  bands at those texels are the UNPOLISHED states — the only place the film
 *  polish does not enter (the endpoint is a storage-domain identity). */
const EDGE_LAYER_ENDPOINT = 1e-4
const EDGE_LAYER_SILHOUETTE_MIN_PX = 8
/** The encoder bar, in 1/255 units (spike 006 Q4: max 2, p95 1, zero over). */
const EDGE_LAYER_FIT_MAX = 2
const EDGE_LAYER_FIT_P95 = 1
const EDGE_LAYER_FIT_OVER = 0
/** Mirrors BRISTLE_FILM_BLUR (bristles.ts:244): the display's 5-tap paint-film
 *  polish, on for every bristle sheet (`bristleContent`). The merge builds its
 *  target T from the SAME polished states — T is a display-domain value
 *  (`band(mix(blur(S), blur(L), aEff))`, DESIGN 3.3) — so the probe must
 *  polish the read-back states before comparing, or it measures the polish
 *  instead of the encoder. The display polishes the COMMITTED storage again;
 *  that second pass is a spatial pre-filter that cannot be inverted pointwise
 *  and is reported separately (edgePolishDelta, Task 4), never hidden here. */
const EDGE_LAYER_FILM_BLUR = 0.35
/** The display's SECOND film-blur reading (`edgePolishDelta`, Task 4): the
 *  live frame shows the polished states mixed; after the merge the same
 *  display polishes the STORED field once more, so the committed sheet's
 *  on-screen band moves by a pointwise-uninvertible 5-tap. Reported as
 *  max / p95 / count over this 2/255 line, in the display's own RGB8 space. */
const EDGE_POLISH_MAX = 2

/** Spec 10 Task 5: the live-pointer row's stroke — a vertical drag at x = 0.5
 *  from y 0.14 to 0.30, clear of stroke A's band (y 0.43..0.57), on paper the
 *  row just reset. Same 60 Hz cadence as `driveBristleEnd` (one sample per
 *  host tick), so the live seam and the scripted seam are the same stroke in
 *  every input the engine reads. */
const EDGE_POINTER_X = 0.5
const EDGE_POINTER_Y0 = 0.14
const EDGE_POINTER_Y1 = 0.3
const EDGE_POINTER_STEPS = 12
const EDGE_POINTER_PRESS = 0.7

/** The Studio's own 4K request, clamped by the engine's law: the ONE sheet
 *  size a "4K" capture can actually reach on this GPU budget. */
const EDGE_4K_REQUEST = 4096

/** Spec 10: the two edge operands. Valid ONLY on `edge-layer` — a value on any
 *  other scenario is refused, never silently ignored. Absent keeps the
 *  canonical defaults 0 / 50. */
function readEdgeKnob(name: 'edge' | 'falloff', scenario: string, fallback: number): number {
  const raw = new URLSearchParams(location.search).get(name)
  if (raw === null || raw === '') return fallback
  if (scenario !== 'edge-layer') {
    throw new Error(`--${name} is only valid with --scenario edge-layer`)
  }
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new Error(`invalid ${name} "${raw}" (expected an integer 0..100)`)
  }
  return value
}

/** Spec 10: spike 006's stroke A — a horizontal drag across the sheet. */
function edgeLayerPointsA(): readonly AquarellePoint[] {
  return [
    { x: 0.1, y: 0.5, p: 0.85, tx: 0, ty: 0, tw: 0 },
    { x: 0.5, y: 0.501, p: 0.85, tx: 0, ty: 0, tw: 0 },
    { x: 0.9, y: 0.5, p: 0.85, tx: 0, ty: 0, tw: 0 },
  ]
}

/** Spec 10: spike 006's stroke B — a vertical drag over A, crossing at the
 *  centre. Its own lateral direction is x, so its fade band lies over A. */
function edgeLayerPointsB(): readonly AquarellePoint[] {
  return [
    { x: 0.5, y: 0.12, p: 0.85, tx: 0, ty: 0, tw: 0 },
    { x: 0.501, y: 0.5, p: 0.85, tx: 0, ty: 0, tw: 0 },
    { x: 0.5, y: 0.88, p: 0.85, tx: 0, ty: 0, tw: 0 },
  ]
}

/** Spec 10: the two-stroke layer scene at the acrylic record's bag, Body 100
 *  (so the scattering S term is exercised), with the two canonical edge keys
 *  folded into the entry's params bag. The entries MUST stamp
 *  `brushId: 'bristle-round'` literally — `toStudioStroke` defaults to
 *  `round`, a non-bristle preset whose path never runs `gatherBristle`. */
function edgeLayerScript(): readonly ScriptEntry[] {
  const params = bristleLineParams(100, STROKE_PARAMS['size']!)
  params['edgeFade'] = EDGE_LAYER_AMOUNT
  params['edgeFalloff'] = EDGE_LAYER_FALLOFF
  return [
    {
      color: EDGE_LAYER_A_COLOR,
      points: edgeLayerPointsA(),
      mutationId: EDGE_LAYER_A_MUTATION,
      brushId: 'bristle-round',
      params,
      captureEdge: 'a',
    },
    {
      color: EDGE_LAYER_B_COLOR,
      points: edgeLayerPointsB(),
      mutationId: EDGE_LAYER_B_MUTATION,
      brushId: 'bristle-round',
      params,
      captureEdge: 'b',
    },
  ]
}

/** A document-pixel rect, y-up (the engine's readback convention). */
interface EdgeRect {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** The private engine seams the layer capture taps. Every layer member is
 *  OPTIONAL: a pre-change engine exposes none of them, and every layer-domain
 *  reading is then reported absent rather than fabricated. Read-only. */
interface EdgeLayerInternals {
  g: LineEngineInternals['g']
  /** The engine's LIVE `Params` — the display's own granulation feed
   *  (`uGranulation = params.granulation * 0.55`), never a probe re-derivation
   *  of the record's 0..100 value. */
  readonly params: { readonly granulation: number }
  ink: { read: { views: WebGLFramebuffer[] } }
  fixed: { views: WebGLFramebuffer[] }
  cover: { read: { views: WebGLFramebuffer[] } }
  relief: { views: WebGLFramebuffer[] }
  /** WR-01: the last-touch R32F lane (SECONDS on the virtual clock). Optional
   *  so a pre-change engine reports the merge-stamp readings as absent rather
   *  than crashing the visit. */
  lastTouch?: { read: { views: WebGLFramebuffer[] } }
  paper: { views: WebGLFramebuffer[] }
  gl: WebGL2RenderingContext
  /** The document size — the Studio rows read it after a resize/create. */
  dw: number
  dh: number
  /** The lazy targets' full shape, so the memory row can measure the REAL
   *  allocation (size, texture count and internal format) instead of assuming
   *  the format constants we passed in. */
  layerInk?: {
    readonly read: { w: number; h: number; views: WebGLFramebuffer[]; tex: WebGLTexture[] }
    readonly write: { w: number; h: number; views: WebGLFramebuffer[]; tex: WebGLTexture[] }
  }
  layerFilm?: { w: number; h: number; views: WebGLFramebuffer[]; tex: WebGLTexture[] }
  layerRelief?: { w: number; h: number; views: WebGLFramebuffer[]; tex: WebGLTexture[] }
  mergeRelief?: { w: number; h: number; views: WebGLFramebuffer[]; tex: WebGLTexture[] }
  layerAllocated?: boolean
  layerOpen?: boolean
  mergeDraws?: number
  /** Pre-existing engine fact (reuse rule, NOT fixed here): the first dab's
   *  direction is inherited from the previous stroke, and `resetSheet()` does
   *  not clear it. The probe pins it so the visit and its replay are the SAME
   *  scene — the plan's `lastDir [1,0]` / `lastAngle 0` definition. */
  lastDir: [number, number]
  lastAngle: number
  /** Debug: the open stroke's last stamped doc position. */
  stroke?: { readonly x: number; readonly y: number } | null
}

/** Pin the stroke-start direction the amount-0 digest is defined on. Probe
 *  scene setup only: the inheritance itself is a documented pre-existing
 *  engine fact and stays exactly as shipped. */
function pinStrokeStart(engine: WatercolorEngine): void {
  const internals = engine as unknown as EdgeLayerInternals
  internals.lastDir = [1, 0]
  internals.lastAngle = 0
}

/** The sheet's display-domain state over one rect: the two pools summed, the
 *  cover channel and the relief — exactly what `displayFS` reads. */
interface EdgeDocFields {
  readonly rect: EdgeRect
  readonly width: number
  readonly height: number
  /** ink.read + fixed, A: four absorbance coefficients. */
  readonly a: Float32Array
  /** ink.read + fixed, B: three coefficients + the scatter S in .w. */
  readonly b: Float32Array
  readonly cover: Float32Array
  readonly relief: Float32Array
}

/** The open stroke's own layer over one rect. */
interface EdgeLayerFields {
  /** layerFilm attachment 0 — cover_L (the alpha gate). */
  readonly cover: Float32Array
  /** layerFilm attachment 1 — the MIN-blended |across| / uFeatherEdge field. */
  readonly lateral: Float32Array
  readonly a: Float32Array
  readonly b: Float32Array
  readonly relief: Float32Array
}

/** Spec 10: the two rects the scenario profiles. The paper side reads A's
 *  band away from the crossing; the under side reads B's band ON it. */
function edgeLayerRect(sheet: number, side: 'paper' | 'under'): EdgeRect {
  const centre = Math.round(0.5 * sheet)
  if (side === 'paper') {
    return {
      x0: Math.round(EDGE_LAYER_PAPER_X0 * sheet),
      x1: Math.round(EDGE_LAYER_PAPER_X1 * sheet),
      y0: Math.max(0, centre - LINE_BAND_PX),
      y1: Math.min(sheet, centre + LINE_BAND_PX + 1),
    }
  }
  return {
    x0: Math.max(0, centre - LINE_BAND_PX),
    x1: Math.min(sheet, centre + LINE_BAND_PX + 1),
    y0: Math.round(EDGE_LAYER_UNDER_Y0 * sheet),
    y1: Math.round(EDGE_LAYER_UNDER_Y1 * sheet),
  }
}

/** Decode one half-float readback into floats. */
function edgeDecodeHalf(raw: Uint16Array): Float32Array {
  const out = new Float32Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = fromHalf(raw[i]!)
  return out
}

/** Spec 10: the sheet's live state over `rect` — the two pools summed exactly
 *  as the display sums them (G5: the merge's base is `ink.read + fixed`, never
 *  the mobile pool alone). */
function readEdgeDocFields(engine: WatercolorEngine, sheet: number, rect: EdgeRect): EdgeDocFields {
  const it = engine as unknown as EdgeLayerInternals
  const read = (fb: WebGLFramebuffer, channels: 1 | 4) =>
    edgeDecodeHalf(it.g.readHalf(fb, sheet, sheet, channels, rect))
  const inkA = read(it.ink.read.views[0]!, 4)
  const inkB = read(it.ink.read.views[1]!, 4)
  const fixA = read(it.fixed.views[0]!, 4)
  const fixB = read(it.fixed.views[1]!, 4)
  const a = new Float32Array(inkA.length)
  const b = new Float32Array(inkB.length)
  for (let i = 0; i < a.length; i += 1) {
    a[i] = inkA[i]! + fixA[i]!
    b[i] = inkB[i]! + fixB[i]!
  }
  return {
    rect,
    width: rect.x1 - rect.x0,
    height: rect.y1 - rect.y0,
    a,
    b,
    cover: read(it.cover.read.views[0]!, 1),
    relief: read(it.relief.views[0]!, 1),
  }
}

/**
 * WR-01 (261125-kvl): the MAX last-touch over `rect`, in seconds on the
 * engine's virtual clock, read exactly (R32F; the cleared sentinel is one
 * week old, −604800 s, which a half-float readback cannot represent). The
 * fresh-sheet pre-merge value is the sentinel; after the merge's touch stamp
 * it must move forward to the stroke-end `nowSec()`. `null` when the engine
 * exposes no last-touch lane (a pre-change tree) — the comparator fails the
 * reading by name instead of fabricating one.
 */
function edgeTouchMax(engine: WatercolorEngine, rect: EdgeRect): number | null {
  const it = engine as unknown as EdgeLayerInternals
  if (!it.lastTouch) return null
  const values = it.g.readFloat(it.lastTouch.read.views[0]!, it.dw, it.dh, rect)
  if (values.length === 0) return null
  let max = Number.NEGATIVE_INFINITY
  for (let i = 0; i < values.length; i += 1) max = Math.max(max, values[i]!)
  return round4(max)
}

/** Spec 10: the OPEN stroke's layer over `rect`, or null when the engine has
 *  no layer yet (the pre-change tree — every reading is then absent). */
function readEdgeLayerFields(
  engine: WatercolorEngine,
  sheet: number,
  rect: EdgeRect,
): EdgeLayerFields | null {
  const it = engine as unknown as EdgeLayerInternals
  const film = it.layerFilm
  const ink = it.layerInk
  const relief = it.layerRelief
  if (!film || !ink || !relief) return null
  const read = (fb: WebGLFramebuffer, channels: 1 | 4) =>
    edgeDecodeHalf(it.g.readHalf(fb, sheet, sheet, channels, rect))
  return {
    cover: read(film.views[0]!, 1),
    lateral: read(film.views[1]!, 1),
    a: read(ink.read.views[0]!, 4),
    b: read(ink.read.views[1]!, 4),
    relief: read(relief.views[0]!, 1),
  }
}

/** Spec 10: the raw paper texel's `g` channel over `rect` (0..1) — the display
 *  feed of the granulation step `k`, which the merge's write-back divides out.
 *  Read straight from the engine's RGBA8 paper target: the display's
 *  `texture(uPaper, uv).g` is this byte over 255. */
function readEdgePaperG(engine: WatercolorEngine, fields: EdgeDocFields): Float32Array {
  const it = engine as unknown as EdgeLayerInternals
  const { rect, width, height } = fields
  const bytes = new Uint8Array(width * height * 4)
  it.gl.bindFramebuffer(it.gl.FRAMEBUFFER, it.paper.views[0]!)
  it.gl.readPixels(rect.x0, rect.y0, width, height, it.gl.RGBA, it.gl.UNSIGNED_BYTE, bytes)
  it.gl.bindFramebuffer(it.gl.FRAMEBUFFER, null)
  const out = new Float32Array(width * height)
  for (let i = 0; i < out.length; i += 1) out[i] = bytes[i * 4 + 1]! / 255
  return out
}

/**
 * Spec 10: the display's granulation step `k` (`shaders.ts:1932`:
 * `gran = 1 + uGranulation * (0.5 - paper.g) * 2.2`) at the LIVE compositor
 * (`uFlat = 0`) with `uEdgeDarken = 0` (the stroke's first dab set
 * `bristleContent`, so the density edge term is inert). `uGranulation` is
 * `params.granulation * 0.55` (`Engine.drawDisplay`). The merge writes
 * `ink = fit / k - fixed`, so `k * (ink + fixed) = fit` — the frozen
 * display-band identity — and the probe decodes the committed sheet through
 * this same scalar.
 */
function edgeGranulationK(paperG: number, granulation: number): number {
  return Math.max(1e-3, 1 + granulation * 0.55 * (0.5 - paperG) * 2.2)
}

/**
 * Spec 10: the frozen lateral law's band alpha `aEff` at one texel, from the
 * layer's OWN lateral field and the scenario's two knobs —
 * `A = 1 − amount·t^e`, `aEff = clamp(A·cover_L, 0, 1)` with
 * `t = clamp((u − START)/(1 − START), 0, 1)` and `e = 2^(2·bias − 1)`.
 * This is the weight the MERGE applied; the committed sheet's own recovery is
 * a separate measurement (`midAlpha`), never this law re-read.
 */
function edgeLayerAEff(lateral: number, coverL: number): number {
  const u = Math.min(1, Math.max(0, lateral))
  const amount = EDGE_LAYER_AMOUNT / 100
  const bias = EDGE_LAYER_FALLOFF / 100
  const t = Math.min(1, Math.max(0, (u - EDGE_LAYER_START) / Math.max(1 - EDGE_LAYER_START, 1e-4)))
  const e = Math.pow(2, 2 * bias - 1)
  return Math.min(1, Math.max(0, (1 - amount * Math.pow(t, e)) * coverL))
}

/** One display band's value from a coefficient getter and a scatter term —
 *  the CPU mirror of `displayBasisGLSL` (KM over white above the epsilon, the
 *  legacy `exp(-k)` otherwise; `k = 0` returns 1, the continuous limit). */
function edgeBandValue(
  coeff: (index: number) => number,
  scatter: number,
  band: number,
): number {
  let absorbance = 0
  for (let k = 0; k < 7; k += 1) absorbance += coeff(k) * BASIS[k]![band]!
  if (!(scatter > SCATTER_EPSILON)) return Math.exp(-Math.max(absorbance, 0))
  const kk = 0.5 * Math.max(absorbance, 0)
  if (!(kk > 0)) return 1
  const arg = Math.sqrt(kk * (2 * scatter + kk))
  const e = Math.exp(-2 * arg)
  const sh = 0.5 * (1 - e)
  const ch = 0.5 * (1 + e)
  const den = (kk + scatter) * sh + arg * ch
  const r = (scatter * sh) / den
  const t = (arg * Math.sqrt(e)) / den
  const om = (kk * sh + arg * ch) / den
  return r + (t * t) / om
}

/** The 16 display bands' values for texel `i` of `a`/`b`, under the display's
 *  own `k` multiplier (pass `k = 1` for a storage-domain read). */
function edgeTexelBands(
  a: Float32Array,
  b: Float32Array,
  i: number,
  k: number,
): Float64Array {
  const o = i * 4
  const coeff = (index: number) =>
    index < 4 ? a[o + index]! * k : b[o + index - 4]! * k
  const scatter = b[o + 3]! * k
  const out = new Float64Array(DISPLAY_BANDS.length)
  for (let bi = 0; bi < DISPLAY_BANDS.length; bi += 1) {
    out[bi] = edgeBandValue(coeff, scatter, DISPLAY_BANDS[bi]!)
  }
  return out
}

/** The linear sRGB of a band array — the display's own weight sum. */
function edgeBandsLinear(bands: Float64Array): [number, number, number] {
  const out: [number, number, number] = [0, 0, 0]
  for (let i = 0; i < bands.length; i += 1) {
    const w = DISPLAY_RGB_WEIGHTS[i]!
    out[0] += bands[i]! * w[0]!
    out[1] += bands[i]! * w[1]!
    out[2] += bands[i]! * w[2]!
  }
  return out
}

/** sRGB companding — the display's byte space (spectral.ts's `compand`). */
function edgeCompand(x: number): number {
  return x < 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055
}

/**
 * The 16 bands' DISPLAY BYTES — the spike's `bandRgb8`: the weight sum, the
 * compand, rounded to the 8-bit channel the compositor writes. The encoder
 * bar (max 2 / p95 1 / over 0) lives in THESE units, never in band
 * coefficients: the fit has 8 unknowns for 3 displayed channels, so a band
 * residual is not a display residual (spike 006 Q4 judged the bar here).
 */
function edgeBandsRgb8(bands: Float64Array): [number, number, number] {
  const lin = edgeBandsLinear(bands)
  return lin.map((c) =>
    Math.round(Math.min(1, Math.max(0, edgeCompand(Math.min(1, Math.max(0, c))))) * 255),
  ) as [number, number, number]
}

/**
 * displayFS's 5-tap film soften over a rect plane, the merge's own
 * `uFilmBlur` step: `v' = mix(v, (v + N + S + E + W) / 5, w)` per channel.
 * The merge reads the real doc plane; here the neighbour outside the rect is
 * the clamped edge texel — the profile windows sit inside the rect, and both
 * fields are smooth there (bare paper, empty layer), so the clamp never
 * enters a reading.
 */
function edgeBlurFilm(
  a: Float32Array,
  b: Float32Array,
  width: number,
  height: number,
  weight: number,
): { a: Float32Array; b: Float32Array } {
  if (!(weight > 0)) return { a, b }
  const outA = new Float32Array(a.length)
  const outB = new Float32Array(b.length)
  const n = width * height
  for (let i = 0; i < n; i += 1) {
    const x = i % width
    const y = (i - x) / width
    const l = y * width + Math.max(0, x - 1)
    const r = y * width + Math.min(width - 1, x + 1)
    const up = Math.max(0, y - 1) * width + x
    const dn = Math.min(height - 1, y + 1) * width + x
    for (let c = 0; c < 4; c += 1) {
      const o = i * 4 + c
      const sumA = a[o]! + a[l * 4 + c]! + a[r * 4 + c]! + a[up * 4 + c]! + a[dn * 4 + c]!
      outA[o] = a[o]! * (1 - weight) + (sumA * 0.2) * weight
      const sumB = b[o]! + b[l * 4 + c]! + b[r * 4 + c]! + b[up * 4 + c]! + b[dn * 4 + c]!
      outB[o] = b[o]! * (1 - weight) + (sumB * 0.2) * weight
    }
  }
  return { a: outA, b: outB }
}

/** One lateral profile: `offsets` are document-pixel distances from the
 *  profiled stroke's centreline (GL axis), and `cover`/`print` are the LAYER's
 *  own readings — null when the engine has no layer yet. */
interface EdgeProfile {
  readonly offsets: number[]
  readonly cover: number[] | null
  readonly dark: number[]
  readonly ink: number[]
  readonly print: number[] | null
}

/**
 * Spec 10: one side's lateral profile. `axis === 'y'` profiles stroke A (a
 * horizontal drag: lateral is y, averaged over the paper window); `axis ===
 * 'x'` profiles stroke B (vertical: lateral is x, averaged over the crossing
 * window). `dark`/`ink` are the shipped display channels (the artist-facing
 * darkness and the delivered absorbance); `cover`/`print` are the layer's own
 * cover_L rows and sparse print share — absent without a layer.
 */
function edgeLayerProfile(
  fields: EdgeDocFields,
  layer: EdgeLayerFields | null,
  transparent: HTMLCanvasElement,
  sheet: number,
  axis: 'x' | 'y',
): EdgeProfile {
  const dw = transparent.width
  const dh = transparent.height
  const tData = transparent.getContext('2d')!.getImageData(0, 0, dw, dh).data
  const centre = Math.round(0.5 * sheet)
  const { rect, width, height } = fields
  const offsets: number[] = []
  const dark: number[] = []
  const ink: number[] = []
  const cover: number[] = []
  const print: number[] = []
  // The print share: each row's fraction of texels at or above half the
  // profile's peak, read from the SHEET's coverage raster — the merge writes
  // `cover = 1 - (1-cover_S)(1 - A·cover_L)`, so this raster is where the
  // dissolve is visible (the layer's own cover_L is the deposit and does not
  // read the falloff).
  let peak = 0
  for (let i = 0; i < fields.cover.length; i += 1) peak = Math.max(peak, fields.cover[i]!)
  const printFloor = peak > 0 ? peak * 0.5 : Number.POSITIVE_INFINITY
  for (let o = -LINE_BAND_PX; o <= LINE_BAND_PX; o += 1) {
    // The station's row/column inside the rect, or skip when the rect clips it.
    let index = -1
    let count = 0
    if (axis === 'y') {
      const y = centre + o
      if (y < 0 || y >= sheet) continue
      const local = y - rect.y0
      if (local < 0 || local >= height) continue
      index = local
      count = width
    } else {
      const x = centre + o
      if (x < 0 || x >= sheet) continue
      const local = x - rect.x0
      if (local < 0 || local >= width) continue
      index = local
      count = height
    }
    let cSum = 0
    let dSum = 0
    let iSum = 0
    let printed = 0
    for (let j = 0; j < count; j += 1) {
      const fi = axis === 'y' ? index * width + j : j * width + index
      const x = axis === 'y' ? rect.x0 + j : rect.x0 + index
      const y = axis === 'y' ? rect.y0 + index : rect.y0 + j
      const cr = dh - 1 - y
      const i4 = (cr * dw + x) * 4
      dSum += 1 - Math.min(tData[i4]!, tData[i4 + 1]!, tData[i4 + 2]!) / 255
      iSum +=
        (fields.a[fi * 4]! +
          fields.a[fi * 4 + 1]! +
          fields.a[fi * 4 + 2]! +
          fields.a[fi * 4 + 3]! +
          fields.b[fi * 4]! +
          fields.b[fi * 4 + 1]! +
          fields.b[fi * 4 + 2]!) /
        7
      if (layer !== null) {
        cSum += layer.cover[fi]!
        if (fields.cover[fi]! >= printFloor) printed += 1
      }
    }
    offsets.push(o)
    dark.push(round4(dSum / count))
    ink.push(round4(iSum / count))
    if (layer !== null) {
      cover.push(round4(cSum / count))
      print.push(round4(printed / count))
    }
  }
  return {
    offsets,
    cover: layer === null ? null : cover,
    dark,
    ink,
    print: layer === null ? null : print,
  }
}

/**
 * Spec 10: the ONE merge's own instrument — the sheet and the layer read
 * immediately BEFORE and immediately AFTER `mergeStrokeLayer`, i.e. the exact
 * pair the encoder gate must compare:
 *  - `postSheet` decodes to the encoder's output `fit` (the write-back is
 *    `fit/k − fixed`, so `k·(ink+fixed) = fit`);
 *  - `preSheet` / `preLayer` are the merge's own inputs (`aEff·band_L +
 *    (1−aEff)·band_S`).
 *
 * Reading the mid-stroke capture instead would carry two known stalenesses the
 * gate must not measure: the end-cap catch-up dab lands between the capture
 * and the merge, and the settle ticks AFTER the merge advect the merged sheet
 * (measured at 512²: 63 continuity stations and 10.3/255 max residual before
 * this instrument existed). The instrument is a probe-only instance shadow on
 * a private method — the same seam `driveBristleEnd` uses on `stampScripted`.
 */
interface EdgeMergeSide {
  readonly preSheet: EdgeDocFields
  readonly preLayer: EdgeLayerFields | null
  readonly postSheet: EdgeDocFields
  /** WR-01: max last-touch over the merge's OWN rect immediately before the
   *  merge, and immediately after it. The merge must stamp the region — an
   *  unstamped merge leaves the pair EQUAL (the pre value is the cleared
   *  one-week sentinel on a fresh sheet). */
  readonly preTouch: number | null
  readonly postTouch: number | null
}

/** Spec 10: one stroke's mid-stroke capture — the layer, the untouched sheet
 *  and the engine's structural counters. */
interface EdgeStrokeCapture {
  readonly layer: EdgeLayerFields | null
  readonly sheet: EdgeDocFields
  readonly layerAllocated: boolean | null
  readonly layerOpen: boolean | null
  /** Debug: full-doc max of the layer film's cover attachment at capture. */
  readonly layerCoverMax: number | null
  /** Debug: the open stroke's last stamped doc position at capture. */
  readonly strokePos: { x: number; y: number } | null
  /** Debug: max aEff over the capture rect (the endpoint set's reachability). */
  readonly maxAeff: number | null
  readonly mergeDraws: number | null
  /** The merge's own pre/post pair, attached once the stroke completes. */
  readonly merge: EdgeMergeSide | null
}

/** Spec 10: read one side's capture at the partial point of its stroke. */
function captureEdgeStroke(
  engine: WatercolorEngine,
  sheet: number,
  side: 'a' | 'b',
): EdgeStrokeCapture {
  const rect = edgeLayerRect(sheet, side === 'a' ? 'paper' : 'under')
  const it = engine as unknown as EdgeLayerInternals
  let layerCoverMax: number | null = null
  if (it.layerFilm) {
    const cover = edgeDecodeHalf(it.g.readHalf(it.layerFilm.views[0]!, sheet, sheet, 1))
    layerCoverMax = 0
    for (let i = 0; i < cover.length; i += 1) layerCoverMax = Math.max(layerCoverMax, cover[i]!)
  }
  return {
    layer: readEdgeLayerFields(engine, sheet, rect),
    sheet: readEdgeDocFields(engine, sheet, rect),
    layerAllocated: typeof it.layerAllocated === 'boolean' ? it.layerAllocated : null,
    layerOpen: typeof it.layerOpen === 'boolean' ? it.layerOpen : null,
    layerCoverMax,
    strokePos: it.stroke ? { x: round2(it.stroke.x), y: round2(it.stroke.y) } : null,
    mergeDraws: typeof it.mergeDraws === 'number' ? it.mergeDraws : null,
    merge: null,
  }
}

/** A stable digest of a sheet snapshot — the capture round trip's witness. */
function digestSheetSnapshot(snapshot: unknown): string {
  const text = JSON.stringify(snapshot, (_key, value) => {
    if (ArrayBuffer.isView(value)) {
      const view = value as unknown as { length: number; [index: number]: number }
      const parts: number[] = []
      for (let i = 0; i < view.length; i += 1) parts.push(view[i]!)
      return parts
    }
    return value
  })
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16)
}

/** The layer-side scalar readings, per side. `null` means ABSENT (the engine
 *  has no layer yet) — never a fabricated zero. */
interface EdgeSideReadings {
  readonly midAlpha: number | null
  readonly midCover: number | null
  readonly coreExact: number | null
  readonly continuity: number | null
  readonly printRetention: number | null
  /** Debug: the largest aEff the merge could have applied in this side's rect
   *  (the endpoint set's actual reach — a scene where the deposit never
   *  saturates has no endpoint texel and `coreExact` is legitimately absent). */
  readonly maxAeff: number | null
  /** Debug: where that texel is and why (doc x/y, lateral, cover_L, u). */
  readonly maxAeffAt: Record<string, number> | null
}

const EDGE_SIDE_ABSENT: EdgeSideReadings = {
  midAlpha: null,
  midCover: null,
  coreExact: null,
  continuity: null,
  printRetention: null,
  maxAeff: null,
  maxAeffAt: null,
}

/**
 * Spec 10: one side's layer-domain bars, over the profile's stations.
 *
 * At the band's midpoint station (`u = (START + 1) / 2 = 0.65`) it recovers
 * the band alpha `aEff` the merge actually applied — `band_out` decoded from
 * the COMMITTED sheet (through the display's own `k`), `band_S` from the
 * untouched pre-merge sheet and `band_L` from the layer — as the per-band
 * least-squares `(band_out - band_S) / (band_L - band_S)`, averaged over the
 * bands whose denominator is resolvable. That is a measurement of the
 * composite, not a re-evaluation of the law.
 *
 * `coreExact` is the encoder's identity at its exact-endpoint set: over the
 * stations whose layer cover_L reaches `EDGE_LAYER_CORE_COVER`, the largest
 * per-band deviation (1/255) between the committed sheet's decoded band and
 * the layer's own band. `continuity` counts in-band stations whose committed
 * band leaves the closed envelope `[min(band_S, band_L), max(...)]` by more
 * than 1/255 — a pale fringe or a washed-out mark. `printRetention` is the
 * layer's print share at the silhouette station (the design's 95-96 %).
 */
function edgeSideReadings(
  engine: WatercolorEngine,
  capture: EdgeStrokeCapture,
  merged: EdgeDocFields,
  granulation: number,
  profile: EdgeProfile,
  axis: 'x' | 'y',
): EdgeSideReadings {
  // The merge's own inputs when the instrument ran (Task 3+): the mid-stroke
  // capture is the fallback for the pre-change tree only.
  const layer = capture.merge ? capture.merge.preLayer : capture.layer
  if (layer === null || profile.cover === null || profile.print === null) return EDGE_SIDE_ABSENT
  const sheetFields = capture.merge ? capture.merge.preSheet : capture.sheet
  const { width, height } = sheetFields
  const paperG = readEdgePaperG(engine, sheetFields)
  // The layer's geometric silhouette: its outermost station within 1 % of the
  // cover_L peak. Guarded — a degenerate profile has no station to judge.
  let peak = 0
  for (const value of profile.cover) peak = Math.max(peak, value)
  if (!(peak > 0)) return EDGE_SIDE_ABSENT
  const flat = peak * 0.99
  let silhouette = 0
  for (let i = profile.cover.length - 1; i >= 0; i -= 1) {
    if (profile.cover[i]! >= flat) {
      silhouette = Math.abs(profile.offsets[i]!)
      break
    }
  }
  if (silhouette < EDGE_LAYER_SILHOUETTE_MIN_PX) return EDGE_SIDE_ABSENT
  // The rects are built symmetric about the profiled stroke's centreline, so
  // the centre row/column is the rect's middle.
  const sheetRect = sheetFields.rect
  const docCentre = Math.round((sheetRect.y0 + sheetRect.y1 - 1) / 2)
  const docCentreX = Math.round((sheetRect.x0 + sheetRect.x1 - 1) / 2)
  const k = new Float32Array(width * height)
  for (let i = 0; i < k.length; i += 1) k[i] = edgeGranulationK(paperG[i]!, granulation)
  // The envelope and the recovered alpha are judged in the MERGE's domain —
  // the polished states (`uFilmBlur`). The core identity is the one storage-
  // domain reading and stays on the RAW states.
  const sheetBlur = edgeBlurFilm(sheetFields.a, sheetFields.b, width, height, EDGE_LAYER_FILM_BLUR)
  const layerBlur = edgeBlurFilm(layer.a, layer.b, width, height, EDGE_LAYER_FILM_BLUR)
  const layerCover = layer.cover
  // Per-station aggregation, over the same rows the profile averages.
  let alphaSum = 0
  let alphaCount = 0
  let coreMax = 0
  let coreSeen = false
  let outside = 0
  let maxAeff = 0
  let maxAeffAt: Record<string, number> | null = null
  for (let oi = 0; oi < profile.offsets.length; oi += 1) {
    const o = profile.offsets[oi]!
    let rowIndex = -1
    let rowCount = 0
    if (axis === 'y') {
      const local = docCentre + o - sheetRect.y0
      if (local < 0 || local >= height) continue
      rowIndex = local
      rowCount = width
    } else {
      const local = docCentreX + o - sheetRect.x0
      if (local < 0 || local >= width) continue
      rowIndex = local
      rowCount = height
    }
    const isMid = Math.abs(o - Math.round(EDGE_LAYER_MID_U * silhouette)) <= 1
    let rowAlpha = 0
    let rowAlphaCount = 0
    let rowCore = 0
    let rowOutside = 0
    for (let j = 0; j < rowCount; j += 1) {
      const fi = axis === 'y' ? rowIndex * width + j : j * width + rowIndex
      const bands_s = edgeTexelBands(sheetBlur.a, sheetBlur.b, fi, k[fi]!)
      // The merge multiplies the LAYER's state by the same display step `k`
      // before its band reconstruction (`la *= k`), so the layer's display
      // band is `band(layer · k)` — a k = 1 read would measure the scaling.
      const bands_l = edgeTexelBands(layerBlur.a, layerBlur.b, fi, k[fi]!)
      const bands_o = edgeTexelBands(merged.a, merged.b, fi, k[fi]!)
      const c = layerCover[fi]!
      const aEff = edgeLayerAEff(layer.lateral[fi]!, c)
      // The envelope follows the SAME piecewise domain as the merge: the exact
      // endpoints are storage identities on the RAW states (the polish cannot
      // enter), the interior is judged on the polished states.
      const atCore = aEff >= EDGE_LAYER_CORE_AEFF
      const atPass = aEff <= EDGE_LAYER_ENDPOINT
      let envS = bands_s
      let envL = bands_l
      if (atCore || atPass) {
        envS = edgeTexelBands(sheetFields.a, sheetFields.b, fi, k[fi]!)
        envL = atCore ? edgeTexelBands(layer.a, layer.b, fi, k[fi]!) : envS
      }
      if (aEff > maxAeff) {
        maxAeff = aEff
        maxAeffAt = {
          x: sheetRect.x0 + (axis === 'y' ? j : rowIndex),
          y: sheetRect.y0 + (axis === 'y' ? rowIndex : j),
          lateral: round4(layer.lateral[fi]!),
          cover: round4(c),
        }
      }
      let inside = true
      for (let bi = 0; bi < bands_o.length; bi += 1) {
        const lo = Math.min(envS[bi]!, envL[bi]!) - 1 / 255
        const hi = Math.max(envS[bi]!, envL[bi]!) + 1 / 255
        if (bands_o[bi]! < lo || bands_o[bi]! > hi) {
          inside = false
          break
        }
      }
      if (!inside) rowOutside += 1
      if (atCore) {
        // Seen even when the deviation is exactly 0 — the endpoint is an
        // IDENTITY, so a perfect read is the expected result, never absence.
        // The endpoint writes the layer's RAW storage (never the polished
        // film), so the reference is the unblurred layer band.
        coreSeen = true
        for (let bi = 0; bi < bands_o.length; bi += 1) {
          rowCore = Math.max(rowCore, Math.abs(bands_o[bi]! - envL[bi]!) * 255)
        }
      }
      if (isMid) {
        for (let bi = 0; bi < bands_o.length; bi += 1) {
          const den = bands_l[bi]! - bands_s[bi]!
          if (Math.abs(den) < 1e-4) continue
          const alpha = (bands_o[bi]! - bands_s[bi]!) / den
          rowAlpha += Math.min(1, Math.max(0, alpha))
          rowAlphaCount += 1
        }
      }
    }
    if (rowOutside > 0) outside += 1
    coreMax = Math.max(coreMax, rowCore)
    if (isMid && rowAlphaCount > 0) {
      alphaSum += rowAlpha / rowAlphaCount
      alphaCount += 1
    }
  }
  const midIndex = profile.offsets.findIndex(
    (o) => Math.abs(o - Math.round(EDGE_LAYER_MID_U * silhouette)) <= 1,
  )
  const rimIndex = profile.offsets.findIndex((o) => Math.abs(o) === silhouette)
  return {
    midAlpha: alphaCount > 0 ? round4(alphaSum / alphaCount) : null,
    midCover: midIndex >= 0 ? round4(profile.cover[midIndex]!) : null,
    coreExact: coreSeen ? round4(coreMax) : null,
    continuity: outside,
    printRetention: rimIndex >= 0 ? round4(profile.print[rimIndex]!) : null,
    maxAeff: round4(maxAeff),
    maxAeffAt,
  }
}

/**
 * Spec 10: the encoder-residual readings — the committed sheet's decoded band
 * values against the LIVE band mix computed from the read-back layer + sheet,
 * in 1/255. Reported per side's rect (the paper side is the bare-paper scene,
 * the under side the same-visit one) and pooled for the report's
 * `edgeEncodeMax` / `edgeEncodeP95` / `edgeEncodeOver`. Also the
 * 50 %-over-white reading (DESIGN 6.5): over bare paper, at the station whose
 * recovered aEff is nearest 0.5, the max per-channel |displayed linear RGB −
 * (0.5 · layerLinear + 0.5)| in 1/255, in LINEAR light.
 */
function edgeEncodeResidual(
  engine: WatercolorEngine,
  capture: EdgeStrokeCapture,
  merged: EdgeDocFields,
  granulation: number,
  profile: EdgeProfile,
  axis: 'x' | 'y',
): {
  residual: number[]
  halfOnWhite: number | null
  polish: number[]
  kMin: number | null
  kMax: number | null
  debug: Record<string, number>
} {
  const layer = capture.merge ? capture.merge.preLayer : capture.layer
  if (layer === null || profile.cover === null) {
    return { residual: [], halfOnWhite: null, polish: [], kMin: null, kMax: null, debug: {} }
  }
  const sheetFields = capture.merge ? capture.merge.preSheet : capture.sheet
  const { width, height, rect } = sheetFields
  const paperG = readEdgePaperG(engine, sheetFields)
  const k = new Float32Array(width * height)
  for (let i = 0; i < k.length; i += 1) k[i] = edgeGranulationK(paperG[i]!, granulation)
  let kMin = Number.POSITIVE_INFINITY
  let kMax = Number.NEGATIVE_INFINITY
  for (let i = 0; i < k.length; i += 1) {
    if (k[i]! < kMin) kMin = k[i]!
    if (k[i]! > kMax) kMax = k[i]!
  }
  // The merge builds its target on the POLISHED states (displayFS's 5-tap
  // soften, `uFilmBlur` = BRISTLE_FILM_BLUR on a bristle sheet), so the
  // expected mix must be computed on the same states — otherwise the
  // comparison measures the polish instead of the encoder.
  const sheetBlur = edgeBlurFilm(sheetFields.a, sheetFields.b, width, height, EDGE_LAYER_FILM_BLUR)
  const layerBlur = edgeBlurFilm(layer.a, layer.b, width, height, EDGE_LAYER_FILM_BLUR)
  const residual: number[] = []
  const decodeDebug: Record<string, number> = {}
  // The half-on-white scan needs the station whose aEff is nearest 0.5; the
  // value is recovered per texel and averaged over the station row.
  let bestDistance = Number.POSITIVE_INFINITY
  let bestHalf: number | null = null
  const docCentre = Math.round((rect.y0 + rect.y1 - 1) / 2)
  const docCentreX = Math.round((rect.x0 + rect.x1 - 1) / 2)
  for (let oi = 0; oi < profile.offsets.length; oi += 1) {
    const o = profile.offsets[oi]!
    let rowIndex = -1
    let rowCount = 0
    if (axis === 'y') {
      const local = docCentre + o - rect.y0
      if (local < 0 || local >= height) continue
      rowIndex = local
      rowCount = width
    } else {
      const local = docCentreX + o - rect.x0
      if (local < 0 || local >= width) continue
      rowIndex = local
      rowCount = height
    }
    let rowHalf = 0
    let rowHalfCount = 0
    for (let j = 0; j < rowCount; j += 1) {
      const fi = axis === 'y' ? rowIndex * width + j : j * width + rowIndex
      const bandsO = edgeTexelBands(merged.a, merged.b, fi, k[fi]!)
      // The merge multiplies the layer's state by k before encoding (the
      // storage write-back divides it out), so the layer's bands decode at
      // the SAME k the sheet's do.
      const bandsS = edgeTexelBands(sheetBlur.a, sheetBlur.b, fi, k[fi]!)
      const bandsL = edgeTexelBands(layerBlur.a, layerBlur.b, fi, k[fi]!)
      // The composite weight is the FROZEN aEff = A·cover_L, never cover_L
      // alone: the lateral fade inside the footprint lowers the weight and the
      // expected mix must follow it, not the cover.
      const mixWeight = edgeLayerAEff(layer.lateral[fi]!, layer.cover[fi]!)
      // The expected band is PIECEWISE, exactly as the merge's own source is:
      // the two exact endpoints are STORAGE identities (aEff >= 1 − 1e-4
      // writes the RAW layer, aEff <= 1e-4 copies the RAW sheet through — the
      // only texels the film polish cannot enter), and the interior is the
      // display-domain polish of both states. Judging a passthrough texel
      // against the polished sheet would measure the polish.
      const wantBands = new Float64Array(bandsO.length)
      if (mixWeight >= EDGE_LAYER_CORE_AEFF) {
        const rawL = edgeTexelBands(layer.a, layer.b, fi, k[fi]!)
        wantBands.set(rawL)
      } else if (mixWeight <= EDGE_LAYER_ENDPOINT) {
        const rawS = edgeTexelBands(sheetFields.a, sheetFields.b, fi, k[fi]!)
        wantBands.set(rawS)
      } else {
        for (let bi = 0; bi < bandsO.length; bi += 1) {
          wantBands[bi] = mixWeight * bandsL[bi]! + (1 - mixWeight) * bandsS[bi]!
        }
      }
      const gotRgb = edgeBandsRgb8(bandsO)
      const wantRgb = edgeBandsRgb8(wantBands)
      const texelWorst = Math.max(
        Math.abs(gotRgb[0] - wantRgb[0]),
        Math.abs(gotRgb[1] - wantRgb[1]),
        Math.abs(gotRgb[2] - wantRgb[2]),
      )
      residual.push(texelWorst)
      // Debug: where the tail lives — an endpoint identity, a passthrough, or
      // the fitted interior (the only place the encoder can miss).
      const bucket =
        mixWeight >= EDGE_LAYER_CORE_AEFF
          ? 'Core'
          : mixWeight <= EDGE_LAYER_ENDPOINT
            ? 'Pass'
            : mixWeight > 0.1
              ? 'Mid'
              : 'Low'
      decodeDebug[`max${bucket}`] = Math.max(decodeDebug[`max${bucket}`] ?? 0, texelWorst)
      decodeDebug[`n${bucket}`] = (decodeDebug[`n${bucket}`] ?? 0) + 1
      if (texelWorst > EDGE_LAYER_FIT_MAX) decodeDebug[`over${bucket}`] = (decodeDebug[`over${bucket}`] ?? 0) + 1
      // The recovered aEff at this texel (band-averaged, guarded).
      let alpha = 0
      let alphaCount = 0
      for (let bi = 0; bi < bandsO.length; bi += 1) {
        const den = bandsL[bi]! - bandsS[bi]!
        if (Math.abs(den) < 1e-4) continue
        alpha += Math.min(1, Math.max(0, (bandsO[bi]! - bandsS[bi]!) / den))
        alphaCount += 1
      }
      if (alphaCount === 0) continue
      const aEff = alpha / alphaCount
      const distance = Math.abs(aEff - 0.5)
      if (distance >= bestDistance) continue
      // The expected 50 % mix of the layer and bare white, in linear light.
      const layerLinear = edgeBandsLinear(bandsL)
      const displayed = edgeBandsLinear(bandsO)
      let worst = 0
      for (let ch = 0; ch < 3; ch += 1) {
        const expected = 0.5 * layerLinear[ch]! + 0.5
        worst = Math.max(worst, Math.abs(displayed[ch]! - expected) * 255)
      }
      bestDistance = distance
      rowHalf = worst
      rowHalfCount = 1
    }
    if (rowHalfCount > 0) bestHalf = rowHalf
  }
  // The display's SECOND film-blur on the stored field (edgePolishDelta): the
  // live frame mixes the polished PRE-merge states; after the merge the same
  // display polishes the STORED field once more, and that 5-tap is a spatial
  // pre-filter that cannot be inverted pointwise. Measured here on the merged
  // storage itself, in the display's own order (blur the storage, then k,
  // then bands) and its own RGB8 bytes — the settle's magnitude, never hidden.
  const mergedBlur = edgeBlurFilm(merged.a, merged.b, width, height, EDGE_LAYER_FILM_BLUR)
  const polish: number[] = []
  for (let i = 0; i < width * height; i += 1) {
    const rawRgb = edgeBandsRgb8(edgeTexelBands(merged.a, merged.b, i, k[i]!))
    const softRgb = edgeBandsRgb8(edgeTexelBands(mergedBlur.a, mergedBlur.b, i, k[i]!))
    polish.push(
      Math.max(
        Math.abs(rawRgb[0] - softRgb[0]),
        Math.abs(rawRgb[1] - softRgb[1]),
        Math.abs(rawRgb[2] - softRgb[2]),
      ),
    )
  }
  return {
    residual,
    halfOnWhite: bestHalf === null ? null : round4(bestHalf),
    polish,
    kMin: k.length > 0 ? round4(kMin) : null,
    kMax: k.length > 0 ? round4(kMax) : null,
    debug: decodeDebug,
  }
}

/** The layer report — every field the comparator names, present or ABSENT. */
function edgeLayerReport(
  engine: WatercolorEngine,
  sheet: number,
  script: readonly ScriptEntry[],
  captures: { a: EdgeStrokeCapture | null; b: EdgeStrokeCapture | null },
  mergeDeltas: readonly number[],
  mergeTimes: readonly number[],
  transparent: HTMLCanvasElement,
  roundTrip: boolean | null,
  granulation: number,
): Record<string, unknown> {
  const paperRect = edgeLayerRect(sheet, 'paper')
  const underRect = edgeLayerRect(sheet, 'under')
  // The merge's own post-state is the artist-visible committed sheet; the
  // report-time read is the fallback (no merge ran, e.g. amount 0).
  const mergedPaper = captures.a?.merge?.postSheet ?? readEdgeDocFields(engine, sheet, paperRect)
  const mergedUnder = captures.b?.merge?.postSheet ?? readEdgeDocFields(engine, sheet, underRect)
  const paperProfile = edgeLayerProfile(
    mergedPaper,
    captures.a?.merge ? captures.a.merge.preLayer : (captures.a?.layer ?? null),
    transparent,
    sheet,
    'y',
  )
  const underProfile = edgeLayerProfile(
    mergedUnder,
    captures.b?.merge ? captures.b.merge.preLayer : (captures.b?.layer ?? null),
    transparent,
    sheet,
    'x',
  )
  const paperReadings =
    captures.a === null
      ? EDGE_SIDE_ABSENT
      : edgeSideReadings(engine, captures.a, mergedPaper, granulation, paperProfile, 'y')
  const underReadings =
    captures.b === null
      ? EDGE_SIDE_ABSENT
      : edgeSideReadings(engine, captures.b, mergedUnder, granulation, underProfile, 'x')
  const paperResidual =
    captures.a === null
      ? { residual: [], halfOnWhite: null, polish: [], kMin: null, kMax: null, debug: {} }
      : edgeEncodeResidual(engine, captures.a, mergedPaper, granulation, paperProfile, 'y')
  const underResidual =
    captures.b === null
      ? { residual: [], halfOnWhite: null, polish: [], kMin: null, kMax: null, debug: {} }
      : edgeEncodeResidual(engine, captures.b, mergedUnder, granulation, underProfile, 'x')
  const residual = [...paperResidual.residual, ...underResidual.residual].sort((a, b) => a - b)
  const encodeMax = residual.length > 0 ? round4(residual[residual.length - 1]!) : null
  const encodeP95 =
    residual.length > 0
      ? round4(residual[Math.min(residual.length - 1, Math.floor(residual.length * 0.95))]!)
      : null
  const encodeOver = residual.length > 0 ? residual.filter((v) => v > EDGE_LAYER_FIT_MAX).length : null
  // Task 4's edgePolishDelta, pooled over both sides' rects: the display's
  // second film-blur on the merged storage. REPORTED, never barred — the
  // count over 2/255 is reported beside the p95, and UAT row 6 judges the
  // settle (the raw-state merge fallback was measured and did not shrink it).
  const polish = [...paperResidual.polish, ...underResidual.polish].sort((a, b) => a - b)
  const polishMax = polish.length > 0 ? round4(polish[polish.length - 1]!) : null
  const polishP95 =
    polish.length > 0
      ? round4(polish[Math.min(polish.length - 1, Math.floor(polish.length * 0.95))]!)
      : null
  const polishOver = polish.length > 0 ? polish.filter((v) => v > EDGE_POLISH_MAX).length : null
  // The merge's `k` range over the visited rects: the display's granulation
  // step the write-back divides out (`fit / k - fixed`), measured on the live
  // paper bytes — never a re-derived constant.
  const kMins = [paperResidual.kMin, underResidual.kMin].filter((v): v is number => v !== null)
  const kMaxes = [paperResidual.kMax, underResidual.kMax].filter((v): v is number => v !== null)
  const counters = captures.b ?? captures.a
  // WR-01: the FIRST merge's last-touch pair over its own rect (stroke A,
  // whose pre-merge region is still the cleared sentinel). An unstamped merge
  // leaves the pair equal; the stamp moves `after` to the stroke-end clock.
  // Null at amount 0 — no merge, no stamp.
  const firstMerge = captures.a?.merge ?? captures.b?.merge ?? null
  return {
    strokeBrush: script[0]?.brushId ?? null,
    edgeAmount: EDGE_LAYER_AMOUNT,
    edgeFalloff: EDGE_LAYER_FALLOFF,
    edgeCaptureRoundTrip: roundTrip,
    edgeAcross: {
      offsets: underProfile.offsets,
      cover: underProfile.cover,
      dark: underProfile.dark,
      ink: underProfile.ink,
      print: underProfile.print,
    },
    edgeAcrossPaper: {
      offsets: paperProfile.offsets,
      cover: paperProfile.cover,
      dark: paperProfile.dark,
      ink: paperProfile.ink,
      print: paperProfile.print,
    },
    edgeMidAlphaPaper: paperReadings.midAlpha,
    edgeMidAlphaUnder: underReadings.midAlpha,
    edgeMidCoverPaper: paperReadings.midCover,
    edgeMidCoverUnder: underReadings.midCover,
    edgeCoreExactPaper: paperReadings.coreExact,
    edgeCoreExactUnder: underReadings.coreExact,
    edgeContinuityPaper: paperReadings.continuity,
    edgeContinuityUnder: underReadings.continuity,
    edgePrintRetentionPaper: paperReadings.printRetention,
    edgePrintRetentionUnder: underReadings.printRetention,
    edgeEncodeMax: encodeMax,
    edgeEncodeP95: encodeP95,
    edgeEncodeOver: encodeOver,
    edgePolishMax: polishMax,
    edgePolishP95: polishP95,
    edgePolishOver: polishOver,
    linearHalfOnWhite: paperResidual.halfOnWhite,
    edgeKMin: kMins.length > 0 ? Math.min(...kMins) : null,
    edgeKMax: kMaxes.length > 0 ? Math.max(...kMaxes) : null,
    debugEncodePaper: paperResidual.debug,
    debugEncodeUnder: underResidual.debug,
    layerAllocated: counters === null ? null : counters.layerAllocated,
    debugLayerOpenA: captures.a === null ? null : captures.a.layerOpen,
    debugLayerOpenB: captures.b === null ? null : captures.b.layerOpen,
    debugLayerCoverMaxA: captures.a === null ? null : round4(captures.a.layerCoverMax ?? Number.NaN),
    debugLayerCoverMaxB: captures.b === null ? null : round4(captures.b.layerCoverMax ?? Number.NaN),
    debugMaxAeffPaper: paperReadings.maxAeff,
    debugMaxAeffUnder: underReadings.maxAeff,
    debugMaxAeffAtPaper: paperReadings.maxAeffAt,
    debugMaxAeffAtUnder: underReadings.maxAeffAt,
    debugStrokeA: captures.a === null ? null : captures.a.strokePos,
    debugStrokeB: captures.b === null ? null : captures.b.strokePos,
    // Per-stroke deltas of the cumulative counter: the LAST stroke's merge and
    // the FIRST stroke's, so a visit that merges once for both (or merges
    // mid-stroke) cannot pass.
    mergeDraws: mergeDeltas.length > 0 ? mergeDeltas[mergeDeltas.length - 1]! : null,
    mergeDrawsFirst: mergeDeltas.length > 0 ? mergeDeltas[0]! : null,
    edgeMergedTouchBefore: firstMerge === null ? null : firstMerge.preTouch,
    edgeMergedTouchAfter: firstMerge === null ? null : firstMerge.postTouch,
    // Task 5: the merge's own wall clock (the instrument times only
    // `baseMerge`). The visit's two strokes merge first, so entries 0 and 1
    // are stroke A's and B's — measured BEFORE the replay and the Studio rows
    // merge again. Compared against spike 006's frozen ~21 ms at 2K.
    edgeMergeMsFirst: mergeTimes.length > 0 ? round2(mergeTimes[0]!) : null,
    edgeMergeMsSecond: mergeTimes.length > 1 ? round2(mergeTimes[1]!) : null,
    edgeMergeMsMax:
      mergeTimes.length > 0 ? round2(Math.max(...mergeTimes.slice(0, Math.min(2, mergeTimes.length)))) : null,
  }
}

/**
 * Spec 10: the edge-layer visit's report — `edgeLayerReport` plus the two
 * after-the-fact determinism witnesses. Both run AFTER every export digest, so
 * neither can perturb the visit's own capture:
 *
 *  - the capture round trip (`captureSheet` → `restoreSheet` → `captureSheet`).
 *    The `whole` document — every painted byte — is digested on both sides; the
 *    wet AGES are deliberately excluded because `restoreSheet` re-stamps them
 *    on the engine's clock (the documented AGES law), so a byte-equal round
 *    trip still moves them.
 *  - the replay: the same two entries replayed one-shot through `applyStroke`
 *    on a reset sheet must export byte-identically to the split drive. A
 *    difference means the split drive is not the bake drive, and the whole
 *    mid-stroke read would be measuring a scene the Studio never paints.
 *  - the fresh-visit vs reset replay: `resetSheet()` does not clear the
 *    stroke-start direction (the documented pre-existing inheritance fact, not
 *    fixed here), so the first replayed dab would inherit the VISIT's final
 *    direction — measured 187/255 over 3759 texels at 512² with no layer in
 *    the picture. `pinStrokeStart` pins `lastDir [1,0]` / `lastAngle 0` on
 *    both sides (the plan's scene definition), after which the two must agree
 *    byte for byte; the residual is still reported as
 *    `edgeReplayMaxDelta` / `edgeReplayDiffTexels`, never assumed.
 */
function edgeLayerVisitReport(
  adapter: ReturnType<typeof createAquarelleEngineAdapter>,
  engine: WatercolorEngine,
  sheet: number,
  script: readonly ScriptEntry[],
  captures: { a: EdgeStrokeCapture | null; b: EdgeStrokeCapture | null },
  mergeDeltas: readonly number[],
  mergeTimes: readonly number[],
  transparent: HTMLCanvasElement,
  visitDigest: string,
  visitPixels: Uint8ClampedArray,
): Record<string, unknown> {
  // The display's own granulation feed, read from the live engine params —
  // never re-derived from the record's 0..100 value (the mapping is the
  // engine's, and `toEngineParams` returns a Partial).
  const granulation = (engine as unknown as EdgeLayerInternals).params.granulation
  // The capture round trip FIRST: it restores the visit's sheet byte for byte
  // (digest-equal, pinned below), so the report reads the VISIT's own state —
  // never a state a replay left behind.
  const snapshot = engine.captureSheet()
  const before = digestSheetSnapshot(snapshot.whole)
  const restored = engine.restoreSheet(snapshot)
  const after = restored ? digestSheetSnapshot(engine.captureSheet().whole) : null
  // The visit's readings, taken BEFORE any replay or Studio row moves state —
  // `mergeTimes` still holds only the visit's own merges here.
  const report = edgeLayerReport(
    engine,
    sheet,
    script,
    captures,
    mergeDeltas,
    mergeTimes,
    transparent,
    restored ? before === after : false,
    granulation,
  )
  const replay = (split: boolean): Digest => {
    adapter.resetSheet()
    // `resetSheet()` keeps `lastDir`/`lastAngle` (pre-existing fact), so the
    // first dab would inherit the VISIT's final direction. Pin it to the
    // scene definition instead: same scene, real determinism check.
    pinStrokeStart(engine)
    for (const entry of script) {
      const stroke = makeStroke(entry)
      if (split) {
        const partial = Math.max(2, Math.floor(stroke.pts.length * EDGE_LAYER_PARTIAL))
        adapter.renderPartialStrokes([{ stroke, pointCount: partial }])
        adapter.renderPartialStrokes([{ stroke, pointCount: Number.MAX_SAFE_INTEGER }])
        adapter.stepTick(0)
      } else {
        adapter.applyStroke(stroke)
      }
      const settle = entry.settle ?? SETTLE_TICKS
      for (let tick = 0; tick <= settle; tick += 1) adapter.stepTick(tick)
      adapter.fix()
    }
    return digestCanvas(engine.exportCanvas('transparent'))
  }
  const oneShot = replay(false)
  const split = replay(true)
  const delta = edgePixelDelta(visitPixels, oneShot.pixels)
  // The Studio-facing rows LAST: they reset the sheet, undo/redo committed
  // strokes, abort open ones and finish by resizing/creating the document —
  // nothing after them may read at the visit's `sheet`.
  const studio = edgeStudioRows(adapter, engine, sheet, script)
  return {
    ...report,
    ...studio,
    // The same-script-twice comparison: the two replay flavours must agree
    // with each other (that is the split-drive-equals-bake-drive question).
    edgeReplaySelfIdentical: oneShot.digest === split.digest,
    edgeReplayDigest: oneShot.digest,
    edgeReplaySplitDigest: split.digest,
    // Fresh visit vs reset replay — a measurement, deliberately not a gate.
    edgeReplayVisitDigest: visitDigest,
    edgeReplayIdentical: oneShot.digest === visitDigest,
    edgeReplayMaxDelta: delta.max,
    edgeReplayDiffTexels: delta.texels,
  }
}

/** The largest per-channel difference and the number of differing texels
 *  between two exports of the same sheet size. */
function edgePixelDelta(a: Uint8ClampedArray, b: Uint8ClampedArray): { max: number; texels: number } {
  const n = Math.min(a.length, b.length)
  let max = 0
  let texels = 0
  for (let i = 0; i + 3 < n; i += 4) {
    let differing = false
    for (let c = 0; c < 4; c += 1) {
      const d = Math.abs((a[i + c] ?? 0) - (b[i + c] ?? 0))
      if (d > max) max = d
      if (d !== 0) differing = true
    }
    if (differing) texels += 1
  }
  return { max, texels: texels + Math.abs(a.length - b.length) / 4 }
}

// ---------------------------------------------------------------------------
// Spec 10 Task 5: the Studio-facing lifecycle rows
// ---------------------------------------------------------------------------

/** The layer set's declared formats (Engine.ensureLayer — the five allocations
 *  are pinned against the source by coverageLifecycle.test.ts): RGBA16F is
 *  8 B/texel, R16F is 2. WebGL2 exposes no per-level format query
 *  (`getTexLevelParameter` is not in the API — `lib.dom.d.ts` is right to omit
 *  it), so the texture COUNT and dimensions are read from the live targets and
 *  the stride comes from the engine's own declaration. */
const EDGE_LAYER_INK_STRIDE = 8
const EDGE_LAYER_FILM_STRIDE = 2
const EDGE_LAYER_RELIEF_STRIDE = 2

/** The exact bytes one target's textures hold, from its LIVE shape. */
function edgeTargetBytes(
  target: { readonly w: number; readonly h: number; readonly tex: WebGLTexture[] },
  stride: number,
): number {
  return target.tex.length * target.w * target.h * stride
}

/** The largest per-channel difference and the differing texel count between
 *  two sheet read-backs of the same rect: both pools' four absorbance lanes
 *  plus the cover and relief channels — the exact bytes the merge writes and
 *  the undo tiles save. */
function edgeFieldDelta(a: EdgeDocFields, b: EdgeDocFields): { max: number; texels: number } {
  const texels = Math.min(a.a.length, b.a.length) / 4
  let max = 0
  let differing = 0
  for (let i = 0; i < texels; i += 1) {
    let d = 0
    for (let c = 0; c < 4; c += 1) {
      d = Math.max(d, Math.abs(a.a[i * 4 + c]! - b.a[i * 4 + c]!))
      d = Math.max(d, Math.abs(a.b[i * 4 + c]! - b.b[i * 4 + c]!))
    }
    d = Math.max(d, Math.abs(a.cover[i]! - b.cover[i]!))
    d = Math.max(d, Math.abs(a.relief[i]! - b.relief[i]!))
    if (d > max) max = d
    if (d !== 0) differing += 1
  }
  return { max: round4(max), texels: differing }
}

/** The largest cover value over a rect — the "the stroke reached the sheet"
 *  witness the merge rows read after their own commit. */
function edgeCoverPeak(fields: EdgeDocFields): number {
  let peak = 0
  for (let i = 0; i < fields.cover.length; i += 1) peak = Math.max(peak, fields.cover[i]!)
  return round4(peak)
}

/** The live-pointer row's samples (doc uv, one per host tick). */
function edgePointerSamples(): readonly { x: number; y: number; p: number }[] {
  const out: { x: number; y: number; p: number }[] = []
  for (let i = 0; i < EDGE_POINTER_STEPS; i += 1) {
    out.push({
      x: EDGE_POINTER_X,
      y: EDGE_POINTER_Y0 + ((EDGE_POINTER_Y1 - EDGE_POINTER_Y0) * i) / (EDGE_POINTER_STEPS - 1),
      p: EDGE_POINTER_PRESS,
    })
  }
  return out
}

/** The window the live row reads: the pointer stroke's band with paper either
 *  side. Disjoint from stroke A's band on the fresh sheet the row resets to. */
function edgePointerRect(sheet: number): EdgeRect {
  const centre = Math.round(0.5 * sheet)
  const margin = Math.round(0.03 * sheet)
  return {
    x0: Math.max(0, centre - LINE_BAND_PX),
    x1: Math.min(sheet, centre + LINE_BAND_PX + 1),
    y0: Math.max(0, Math.round(EDGE_POINTER_Y0 * sheet) - margin),
    y1: Math.min(sheet, Math.round(EDGE_POINTER_Y1 * sheet) + margin),
  }
}

/** The Studio rows' engine seams beyond `EdgeLayerInternals`: the private
 *  lifecycle methods and the callback bag. */
interface EdgeStudioInternals {
  callbacks: { onStrokeEnd?: (tool: string) => void }
  createDocument(size: [number, number]): void
  discardLayer(): void
}

/**
 * Spec 10 Task 5: the Studio-facing lifecycle rows. Runs AFTER
 * `edgeLayerReport` has read the visit (see `edgeLayerVisitReport`), so every
 * state move below is invisible to the visit's readings. Order is law:
 *
 *  1. the memory row FIRST — it measures the visit's own layer set before
 *     anything resizes;
 *  2. G1 (live pointer), G2 (the adapter's applyStroke), the undo/redo round
 *     trip of a committed stroke;
 *  3. the abandon paths — abort, undo-with-a-layer-open, restore;
 *  4. resize and createDocument LAST: both change the document size, so
 *     nothing after them may read at the visit's `sheet`.
 *
 * Every row drives the REAL path: the live pointer stroke goes through
 * scriptBegin + the queue + tick, exactly like `driveBristleEnd`; the scripted
 * rows go through the adapter's applyStroke (the Studio's apply seam); the
 * abandonment rows call the same engine methods a key leave, a tool switch, an
 * undo and a project open call. Nothing here merges a stroke by hand.
 */
function edgeStudioRows(
  adapter: ReturnType<typeof createAquarelleEngineAdapter>,
  engine: WatercolorEngine,
  sheet: number,
  script: readonly ScriptEntry[],
): Record<string, unknown> {
  const it = engine as unknown as EdgeLayerInternals
  const host = engine as unknown as EdgeStudioInternals
  const live = engine as unknown as EndLiveEngine
  const draws = (): number | null => (typeof it.mergeDraws === 'number' ? it.mergeDraws : null)
  const stepDelta = (before: number | null, after: number | null): number | null =>
    before === null || after === null ? null : after - before
  const closed = (): boolean | null => (typeof it.layerOpen === 'boolean' ? !it.layerOpen : null)
  const fieldsNull = (): boolean =>
    it.layerInk == null && it.layerFilm == null && it.layerRelief == null && it.mergeRelief == null
  const allocated = (): boolean | null => (typeof it.layerAllocated === 'boolean' ? it.layerAllocated : null)
  const out: Record<string, unknown> = {}
  const entryA = script[0]!
  const entryB = script[script.length - 1]!
  const edgeBag: Record<string, number> = { ...(entryA.params ?? {}) }
  const paperRect = edgeLayerRect(sheet, 'paper')
  const underRect = edgeLayerRect(sheet, 'under')

  // --- 1. The layer set's measured size (the visit's own sheet) ------------
  const layerInk = it.layerInk ?? null
  const inkReadBytes = layerInk ? edgeTargetBytes(layerInk.read, EDGE_LAYER_INK_STRIDE) : 0
  const inkWriteBytes = layerInk ? edgeTargetBytes(layerInk.write, EDGE_LAYER_INK_STRIDE) : 0
  const filmBytes = it.layerFilm ? edgeTargetBytes(it.layerFilm, EDGE_LAYER_FILM_STRIDE) : 0
  const reliefBytes = it.layerRelief ? edgeTargetBytes(it.layerRelief, EDGE_LAYER_RELIEF_STRIDE) : 0
  const mergeReliefBytes = it.mergeRelief ? edgeTargetBytes(it.mergeRelief, EDGE_LAYER_RELIEF_STRIDE) : 0
  const layerBytes = inkReadBytes + inkWriteBytes + filmBytes + reliefBytes + mergeReliefBytes
  const docTexels = it.dw * it.dh
  const perTexel = docTexels > 0 ? layerBytes / docTexels : 0
  // The Studio's "4K" request through the engine's own clamp — never a guess:
  // a 4096² sheet is not reachable on this budget, so both numbers are shown.
  const clamp4k = clampDocSize(EDGE_4K_REQUEST, EDGE_4K_REQUEST)
  out['edgeMemoryDim'] = [it.dw, it.dh]
  out['edgeMemoryLayerAllocated'] = allocated()
  out['edgeMemoryTargets'] = {
    layerInkRead: inkReadBytes,
    layerInkWrite: inkWriteBytes,
    layerFilm: filmBytes,
    layerRelief: reliefBytes,
    mergeRelief: mergeReliefBytes,
  }
  out['edgeMemoryLayerBytes'] = layerBytes
  out['edgeMemoryPerTexel'] = round4(perTexel)
  out['edgeMemoryMiB'] = round2(layerBytes / (1024 * 1024))
  out['edgeMemoryClampDim'] = clamp4k
  out['edgeMemoryClampedMiB'] = round2((perTexel * clamp4k[0] * clamp4k[1]) / (1024 * 1024))
  out['edgeMemory4KRawMiB'] = round2((perTexel * EDGE_4K_REQUEST * EDGE_4K_REQUEST) / (1024 * 1024))

  // --- 2. G1: a LIVE pointer stroke (the driveBristleEnd seam) -------------
  adapter.resetSheet()
  pinStrokeStart(engine)
  configureLiveEnd(engine, edgeBag, entryA.mutationId, 'bristle-round', entryA.color)
  const samples = edgePointerSamples()
  const first = samples[0]!
  const g1Rect = edgePointerRect(sheet)
  const g1Before = draws()
  if (!engine.scriptBegin('brush', first.x, first.y, first.p)) {
    throw new Error('edge-layer G1: the engine refused the live stroke')
  }
  const g1Stroke = live.stroke
  if (g1Stroke === null) throw new Error('edge-layer G1: scriptBegin left no stroke')
  // Re-label the scripted stroke as a live pointer: the processing branch is
  // `pointerId !== SCRIPT_POINTER`, exactly as `driveBristleEnd` does it.
  g1Stroke.pointerId = END_LIVE_POINTER
  g1Stroke.pointerType = 'pen'
  const baseEnd = host.callbacks.onStrokeEnd
  let g1Callbacks = 0
  let g1AtCallback: number | null = null
  let g1OpenAtCallback: boolean | null = null
  let g1PeakAtCallback: number | null = null
  host.callbacks.onStrokeEnd = (tool: string) => {
    g1Callbacks += 1
    // The callback is the earliest "next read": the commit must already be
    // behind it — the counter moved, the layer is closed, the bytes are down.
    g1AtCallback = draws()
    g1OpenAtCallback = typeof it.layerOpen === 'boolean' ? it.layerOpen : null
    g1PeakAtCallback = edgeCoverPeak(readEdgeDocFields(engine, sheet, g1Rect))
    baseEnd?.(tool)
  }
  try {
    // The first sample is already queued by scriptBegin; one tick deposits it.
    adapter.stepTick(0)
    for (let i = 1; i < samples.length; i += 1) {
      adapter.advanceClock(END_TICK_MS)
      const sample = samples[i]!
      live.queue.push({ x: sample.x, y: sample.y, p: sample.p, t: live.clock(), tx: 0, ty: 0, w: 1 })
      engine.tick(END_DT)
    }
    // The release: pointerup arrives with no new sample, and the ending tick
    // is where the catch-up dab and the stroke's ONE commit run.
    g1Stroke.ending = true
    engine.tick(END_DT)
  } finally {
    host.callbacks.onStrokeEnd = baseEnd
  }
  // The plan's 1x1 readPixels fence on this engine's legal read path: the GPU
  // must have finished the ending tick before the sheet is read back.
  it.g.readHalf(it.fixed.views[0]!, sheet, sheet, 4, { x0: 0, y0: 0, x1: 1, y1: 1 })
  const g1After = draws()
  out['edgeG1DrawsBefore'] = g1Before
  out['edgeG1DrawsAtCallback'] = g1AtCallback
  out['edgeG1MergeDraws'] = stepDelta(g1Before, g1After)
  out['edgeG1CallbackCount'] = g1Callbacks
  out['edgeG1LayerOpenAtCallback'] = g1OpenAtCallback
  out['edgeG1SheetPeakAtCallback'] = g1PeakAtCallback
  out['edgeG1SheetPeak'] = edgeCoverPeak(readEdgeDocFields(engine, sheet, g1Rect))
  out['edgeG1LayerClosed'] = closed()

  // --- 3. G2: the adapter's applyStroke (the Studio's apply seam) ---------
  adapter.resetSheet()
  pinStrokeStart(engine)
  const g2Before = draws()
  adapter.applyStroke(makeStroke(entryA))
  out['edgeG2MergeDraws'] = stepDelta(g2Before, draws())
  out['edgeG2LayerClosed'] = closed()
  out['edgeG2SheetPeak'] = edgeCoverPeak(readEdgeDocFields(engine, sheet, paperRect))

  // --- 4. Undo / redo of a committed stroke --------------------------------
  // Stroke A's band (the paper rect) is disjoint from stroke B's merge rect at
  // every Studio size, so it is the "outside the merge" witness: the merge and
  // its undo must never move it.
  adapter.resetSheet()
  pinStrokeStart(engine)
  adapter.applyStroke(makeStroke(entryA))
  const preA = {
    paper: readEdgeDocFields(engine, sheet, paperRect),
    under: readEdgeDocFields(engine, sheet, underRect),
  }
  adapter.applyStroke(makeStroke(entryB))
  const postB = {
    paper: readEdgeDocFields(engine, sheet, paperRect),
    under: readEdgeDocFields(engine, sheet, underRect),
  }
  engine.undo()
  const undoB = {
    paper: readEdgeDocFields(engine, sheet, paperRect),
    under: readEdgeDocFields(engine, sheet, underRect),
  }
  const undoClosed = closed()
  engine.redo()
  const redoB = {
    paper: readEdgeDocFields(engine, sheet, paperRect),
    under: readEdgeDocFields(engine, sheet, underRect),
  }
  const redoClosed = closed()
  const undoRestore = edgeFieldDelta(undoB.under, preA.under)
  const redoRestore = edgeFieldDelta(redoB.under, postB.under)
  const mergeOutside = edgeFieldDelta(preA.paper, postB.paper)
  const undoOutside = edgeFieldDelta(undoB.paper, postB.paper)
  const redoOutside = edgeFieldDelta(redoB.paper, postB.paper)
  out['edgeUndoRestoreMax'] = undoRestore.max
  out['edgeUndoRestoreTexels'] = undoRestore.texels
  out['edgeRedoRestoreMax'] = redoRestore.max
  out['edgeRedoRestoreTexels'] = redoRestore.texels
  out['edgeMergeOutsideMax'] = mergeOutside.max
  out['edgeMergeOutsideTexels'] = mergeOutside.texels
  out['edgeUndoOutsideMax'] = undoOutside.max
  out['edgeUndoOutsideTexels'] = undoOutside.texels
  out['edgeRedoOutsideMax'] = redoOutside.max
  out['edgeRedoOutsideTexels'] = redoOutside.texels
  out['edgeUndoLayerClosed'] = undoClosed === true && redoClosed === true

  // --- 5. The abandon paths ------------------------------------------------
  const strokeFirst = entryB.points[0]!
  // I1 — abortStroke (a key leave / a tool switch). The aborted stroke's own
  // step is taken back, so the sheet must be byte-identical to before it.
  adapter.resetSheet()
  pinStrokeStart(engine)
  adapter.applyStroke(makeStroke(entryA))
  const abortPre = {
    paper: readEdgeDocFields(engine, sheet, paperRect),
    under: readEdgeDocFields(engine, sheet, underRect),
  }
  if (!engine.scriptBegin('brush', strokeFirst.x, strokeFirst.y, strokeFirst.p)) {
    throw new Error('edge-layer I1: the engine refused the stroke')
  }
  adapter.stepTick(0)
  out['edgeAbortWasOpen'] = typeof it.layerOpen === 'boolean' ? it.layerOpen : null
  engine.abortStroke()
  out['edgeAbortClosed'] = closed()
  const abortPaper = edgeFieldDelta(readEdgeDocFields(engine, sheet, paperRect), abortPre.paper)
  const abortUnder = edgeFieldDelta(readEdgeDocFields(engine, sheet, underRect), abortPre.under)
  out['edgeAbortSheetMax'] = Math.max(abortPaper.max, abortUnder.max)
  out['edgeAbortSheetTexels'] = abortPaper.texels + abortUnder.texels
  const abortNext = draws()
  adapter.applyStroke(makeStroke(entryA))
  out['edgeAbortNextMerge'] = stepDelta(abortNext, draws())

  // I2 — undo with a layer open (travel discards it before the swap).
  adapter.resetSheet()
  pinStrokeStart(engine)
  adapter.applyStroke(makeStroke(entryA))
  if (!engine.scriptBegin('brush', strokeFirst.x, strokeFirst.y, strokeFirst.p)) {
    throw new Error('edge-layer I2: the engine refused the stroke')
  }
  adapter.stepTick(0)
  out['edgeUndoOpenWasOpen'] = typeof it.layerOpen === 'boolean' ? it.layerOpen : null
  engine.undo()
  out['edgeUndoOpenClosed'] = closed()
  const undoOpenNext = draws()
  adapter.applyStroke(makeStroke(entryA))
  out['edgeUndoOpenNextMerge'] = stepDelta(undoOpenNext, draws())

  // I3 — restore (a project open) with a layer open: no layer field may
  // survive, and the next Edge stroke re-allocates and merges once.
  adapter.resetSheet()
  pinStrokeStart(engine)
  adapter.applyStroke(makeStroke(entryA))
  if (!engine.scriptBegin('brush', strokeFirst.x, strokeFirst.y, strokeFirst.p)) {
    throw new Error('edge-layer I3: the engine refused the stroke')
  }
  adapter.stepTick(0)
  out['edgeRestoreWasOpen'] = typeof it.layerOpen === 'boolean' ? it.layerOpen : null
  engine.restore(engine.snapshot())
  out['edgeRestoreLayerAllocated'] = allocated()
  out['edgeRestoreLayerFieldsNull'] = fieldsNull()
  const restoreNext = draws()
  adapter.applyStroke(makeStroke(entryA))
  out['edgeRestoreNextMerge'] = stepDelta(restoreNext, draws())
  out['edgeRestoreReallocated'] = allocated()

  // I4 — resizeDocument with a layer open: the old target set (layer included)
  // is disposed and the fields are nulled; the next stroke re-allocates at the
  // NEW size. This is the last row that may read at the visit's `sheet`.
  adapter.resetSheet()
  pinStrokeStart(engine)
  if (!engine.scriptBegin('brush', strokeFirst.x, strokeFirst.y, strokeFirst.p)) {
    throw new Error('edge-layer I4: the engine refused the stroke')
  }
  adapter.stepTick(0)
  out['edgeResizeWasOpen'] = typeof it.layerOpen === 'boolean' ? it.layerOpen : null
  const resized = Math.round(sheet * 0.75)
  engine.resizeDocument(resized, resized)
  out['edgeResizeDim'] = it.dw
  out['edgeResizeLayerAllocated'] = allocated()
  out['edgeResizeLayerFieldsNull'] = fieldsNull()
  const resizeNext = draws()
  adapter.applyStroke(makeStroke(entryA))
  out['edgeResizeNextMerge'] = stepDelta(resizeNext, draws())
  out['edgeResizeReallocated'] = allocated()

  // I5 — createDocument (a new sheet) with a layer open. createDocument nulls
  // neither `stroke` nor `queue`, so the Studio's new-document path abandons
  // the stale stroke first; the discard is idempotent by contract.
  const currentSheet = it.dw
  adapter.resetSheet()
  if (!engine.scriptBegin('brush', strokeFirst.x, strokeFirst.y, strokeFirst.p)) {
    throw new Error('edge-layer I5: the engine refused the stroke')
  }
  adapter.stepTick(0)
  out['edgeCreateWasOpen'] = typeof it.layerOpen === 'boolean' ? it.layerOpen : null
  host.createDocument([currentSheet, currentSheet])
  out['edgeCreateLayerFieldsNull'] = fieldsNull()
  out['edgeCreateLayerAllocated'] = allocated()
  engine.abortStroke()
  let discardIdempotent = true
  try {
    host.discardLayer()
    host.discardLayer()
  } catch {
    discardIdempotent = false
  }
  out['edgeCreateDiscardIdempotent'] = discardIdempotent
  const createNext = draws()
  adapter.applyStroke(makeStroke(entryA))
  out['edgeCreateNextMerge'] = stepDelta(createNext, draws())
  out['edgeCreateReallocated'] = allocated()

  return out
}

/** The private engine seams the absorbance profile reads. Read-only. */
interface LineEngineInternals {
  g: {
    readHalf: (
      fb: WebGLFramebuffer,
      w: number,
      h: number,
      channels: 1 | 4,
      rect?: { x0: number; y0: number; x1: number; y1: number },
    ) => Uint16Array
    /** Exact float readback — the last-touch lane is R32F and its cleared
     *  sentinel (−604800 s) is outside half-float's range. */
    readFloat: (
      fb: WebGLFramebuffer,
      w: number,
      h: number,
      rect?: { x0: number; y0: number; x1: number; y1: number },
    ) => Float32Array
  }
  ink: { read: { views: WebGLFramebuffer[] } }
  fixed: { views: WebGLFramebuffer[] }
  bristles: { read: { views: WebGLFramebuffer[] } }
  bristleShape: { views: WebGLFramebuffer[] }
  bristleCount: number
}

/**
 * 2026-11-22 (residual bisect): the stroke's ACTUAL reservoirs — the 1×256
 * rows the gather reads. `paintA`/`paintB` are the carried absorbance after
 * the last carrier pass; `state` is (load, across, seed, valueJitter) as the
 * carrier wrote it back. Read-only evidence: this is what the gather averages,
 * so a lane's carried value can be traced to the bristle run that owns it.
 */
function bristleReservoir(engine: WatercolorEngine): Record<string, unknown> {
  const it = engine as unknown as LineEngineInternals
  const n = Math.min(256, Math.max(1, it.bristleCount))
  const read = (fb: WebGLFramebuffer) => {
    const rows = it.g.readHalf(fb, 1, 256, 4, { x0: 0, y0: 0, x1: 1, y1: 256 })
    const out: number[][] = []
    for (let i = 0; i < n; i += 1) {
      const o = i * 4
      out.push([fromHalf(rows[o]!), fromHalf(rows[o + 1]!), fromHalf(rows[o + 2]!), fromHalf(rows[o + 3]!)])
    }
    return out
  }
  const shapeRows = it.g.readHalf(it.bristleShape.views[0]!, 1, 256, 4, { x0: 0, y0: 0, x1: 1, y1: 256 })
  const shape: number[][] = []
  for (let i = 0; i < n; i += 1) {
    const o = i * 4
    shape.push([fromHalf(shapeRows[o]!), fromHalf(shapeRows[o + 1]!), fromHalf(shapeRows[o + 2]!), fromHalf(shapeRows[o + 3]!)])
  }
  return {
    count: it.bristleCount,
    paintA: read(it.bristles.read.views[0]!),
    paintB: read(it.bristles.read.views[1]!),
    state: read(it.bristles.read.views[2]!),
    shape,
  }
}

/**
 * Mean of the seven absorbance coefficients (ink + fixed) per texel over a
 * band, from the engine's half-float targets. Row 0 is the band's GL row y0
 * (bottom-up), exactly as `readHalf` returns it.
 */
function absorbBand(
  engine: WatercolorEngine,
  w: number,
  h: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): { data: Float32Array; width: number } {
  const internals = engine as unknown as LineEngineInternals
  const rect = { x0, y0, x1: x1, y1: y1 }
  const inkA = internals.g.readHalf(internals.ink.read.views[0]!, w, h, 4, rect)
  const inkB = internals.g.readHalf(internals.ink.read.views[1]!, w, h, 4, rect)
  const fixA = internals.g.readHalf(internals.fixed.views[0]!, w, h, 4, rect)
  const fixB = internals.g.readHalf(internals.fixed.views[1]!, w, h, 4, rect)
  const width = x1 - x0
  const data = new Float32Array(width * (y1 - y0))
  for (let i = 0; i < data.length; i += 1) {
    const o = i * 4
    const sum =
      fromHalf(inkA[o]!) + fromHalf(inkA[o + 1]!) + fromHalf(inkA[o + 2]!) + fromHalf(inkA[o + 3]!) +
      fromHalf(inkB[o]!) + fromHalf(inkB[o + 1]!) + fromHalf(inkB[o + 2]!) +
      fromHalf(fixA[o]!) + fromHalf(fixA[o + 1]!) + fromHalf(fixA[o + 2]!) + fromHalf(fixA[o + 3]!) +
      fromHalf(fixB[o]!) + fromHalf(fixB[o + 1]!) + fromHalf(fixB[o + 2]!)
    data[i] = sum / 7
  }
  return { data, width }
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

/** quick 261123-hr5: the private relief target the signed-emboss readback
 *  taps. Read-only, probe-only — the relief layer has no export channel. */
interface ReliefEngineInternals {
  g: LineEngineInternals['g']
  relief: { views: WebGLFramebuffer[] }
}

/**
 * quick 261123-hr5: mean and peak paint thickness over a doc-uv box, read
 * straight from the engine's HALF_FLOAT_R relief target. The rect is in
 * DOCUMENT pixels and both axes are y-up, so the uv box maps directly.
 */
function reliefBandStats(
  engine: WatercolorEngine,
  sheet: number,
  box: BandBox,
): { mean: number; peak: number } {
  const internals = engine as unknown as ReliefEngineInternals
  const x0 = Math.max(0, Math.min(sheet - 1, Math.floor(box.x0 * sheet)))
  const x1 = Math.max(x0 + 1, Math.min(sheet, Math.ceil(box.x1 * sheet)))
  const y0 = Math.max(0, Math.min(sheet - 1, Math.floor(box.y0 * sheet)))
  const y1 = Math.max(y0 + 1, Math.min(sheet, Math.ceil(box.y1 * sheet)))
  const rows = internals.g.readHalf(internals.relief.views[0]!, sheet, sheet, 1, { x0, y0, x1, y1 })
  let sum = 0
  let peak = 0
  for (let i = 0; i < rows.length; i += 1) {
    const value = fromHalf(rows[i]!)
    sum += value
    if (value > peak) peak = value
  }
  return { mean: rows.length > 0 ? sum / rows.length : 0, peak }
}

// --- 2026-11-22 (UAT row 3, the tiled motif) --------------------------------
//
// The enclosed-line statistic answers "is a pale row bounded by darker paint
// on both sides?" — and a law that trades the continuous line for a PERIODIC
// band motif PASSES it (the along-only feather law measured 0.60 % enclosed
// and the artist rejected the look as "a motif (tiled)"). The gate needs the
// missing half: periodicity ALONG the stroke. For every sampled row the along
// profile is high-passed (boxcar, LINE_TILING_WINDOW doc px — longer than any
// visible band, shorter than the mark) and periodogrammed; a tiled motif is a
// dominant period in 12..180 px with an amplitude above the fibre floor, and
// it pulses the WHOLE fringe IN PHASE, so the cross-row coherence of the
// high-passed profiles separates a motif from per-row fibre noise.
const LINE_TILING_ROWS: readonly number[] = [0, 44, -44, 52, -52, 60, -60, 68, -68, 76, -76]
const LINE_TILING_WINDOW = 200
const LINE_TILING_MIN_PERIOD = 12
const LINE_TILING_MAX_PERIOD = 180
/** A high-passed pair above this correlation is the same band, not two fibres. */
const LINE_TILING_COHERENT = 0.5

function boxcarHighpass(values: readonly number[], window: number): number[] {
  const n = values.length
  const half = Math.floor(window / 2)
  const prefix = new Float64Array(n + 1)
  for (let i = 0; i < n; i += 1) prefix[i + 1] = prefix[i]! + values[i]!
  const out: number[] = []
  for (let i = 0; i < n; i += 1) {
    const a = Math.max(0, i - half)
    const b = Math.min(n, i + half + 1)
    out.push(values[i]! - (prefix[b]! - prefix[a]!) / (b - a))
  }
  return out
}

function seriesStats(values: readonly number[]): { mean: number; rms: number } {
  const n = values.length
  if (n === 0) return { mean: 0, rms: 0 }
  let sum = 0
  for (const v of values) sum += v
  const mean = sum / n
  let ss = 0
  for (const v of values) ss += (v - mean) * (v - mean)
  return { mean, rms: Math.sqrt(ss / n) }
}

function seriesCorr(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length)
  if (n === 0) return 0
  let ma = 0
  let mb = 0
  for (let i = 0; i < n; i += 1) { ma += a[i]!; mb += b[i]! }
  ma /= n
  mb /= n
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < n; i += 1) {
    const x = a[i]! - ma
    const y = b[i]! - mb
    num += x * y
    da += x * x
    db += y * y
  }
  return da === 0 || db === 0 ? 0 : num / Math.sqrt(da * db)
}

function alongPeriodogram(values: readonly number[], from: number, to: number): { periodPx: number; amp: number } {
  const n = values.length
  let best = { periodPx: 0, amp: 0 }
  for (let p = from; p <= to; p += 1) {
    let re = 0
    let im = 0
    for (let i = 0; i < n; i += 1) {
      const a = (2 * Math.PI * i) / p
      re += values[i]! * Math.cos(a)
      im += values[i]! * Math.sin(a)
    }
    const amp = Math.sqrt(re * re + im * im) / n
    if (amp > best.amp) best = { periodPx: p, amp }
  }
  return best
}

function runLengths(flags: readonly boolean[]): number[] {
  const lengths: number[] = []
  let cur = 0
  for (const f of flags) {
    if (f) cur += 1
    else { if (cur > 0) lengths.push(cur); cur = 0 }
  }
  if (cur > 0) lengths.push(cur)
  return lengths
}

/** One side's outward walk over the darkness profile, shared by the rim and
 *  halo measures so the two cannot disagree about which side is outward.
 *  `plateau` is the median darkness of the interior rows on that side (the
 *  cover-defined interior span bounds the sample, so the plateau cannot drift
 *  from the tiling measure); `cross90/50/10` are the interpolated offsets where
 *  the walk first falls through that fraction of the plateau, scanning from
 *  the centre outward. The rim band is |cross10 − cross90| and `step` is the
 *  worst adjacent-row change inside the OUTER THIRD of that band. The halo
 *  reads only rows beyond `cross50`, clamped to the stroke's own outward
 *  2 %-of-plateau extent: beyond that row the film is paper, and on the
 *  `--over` variant the understory's own core continues there — without the
 *  clamp a wet underlayer would masquerade as the line's pale halo. */
interface LineSideWalk {
  plateau: number
  bandPx: number | null
  step: number | null
  stepAt: number | null
  haloPeakRel: number | null
  haloMean: number | null
  haloRun: number
  haloPeakAt: number | null
}

function lineSideWalk(
  offsets: readonly number[],
  dark: readonly number[],
  interiorSpan: readonly [number, number],
  side: -1 | 1,
): LineSideWalk {
  const plateauLo = side < 0 ? interiorSpan[0] : 0
  const plateauHi = side < 0 ? 0 : interiorSpan[1]
  const plateauValues: number[] = []
  for (let i = 0; i < offsets.length; i += 1) {
    const o = offsets[i]!
    if (o >= plateauLo && o <= plateauHi) plateauValues.push(dark[i]!)
  }
  const plateau = median(plateauValues)
  const centreIndex = offsets.indexOf(0)
  const points: { o: number; d: number }[] = []
  if (centreIndex >= 0) {
    for (let i = centreIndex; i >= 0 && i < offsets.length; i += side < 0 ? -1 : 1) {
      points.push({ o: offsets[i]!, d: dark[i]! })
    }
  }
  const crossing = (fraction: number): number | null => {
    if (!(plateau > 0)) return null
    const threshold = plateau * fraction
    for (let j = 1; j < points.length; j += 1) {
      const a = points[j - 1]!
      const b = points[j]!
      if (a.d >= threshold && b.d < threshold) {
        const t = (a.d - threshold) / (a.d - b.d)
        return a.o + t * (b.o - a.o)
      }
    }
    return null
  }
  const cross90 = crossing(0.9)
  const cross50 = crossing(0.5)
  const cross10 = crossing(0.1)
  const bandPx = cross90 !== null && cross10 !== null ? Math.abs(cross10 - cross90) : null
  let step: number | null = null
  let stepAt: number | null = null
  if (cross90 !== null && cross10 !== null) {
    const outerFrom = cross90 + (2 / 3) * (cross10 - cross90)
    const outerLo = Math.min(outerFrom, cross10)
    const outerHi = Math.max(outerFrom, cross10)
    for (let j = 1; j < points.length; j += 1) {
      const point = points[j]!
      if (point.o < outerLo || point.o > outerHi) continue
      const delta = Math.abs(point.d - points[j - 1]!.d)
      if (step === null || delta > step) {
        step = delta
        stepAt = point.o
      }
    }
  }
  let haloPeakRel: number | null = null
  let haloPeakAt: number | null = null
  let haloMean: number | null = null
  let haloRun = 0
  if (cross50 !== null && plateau > 0) {
    let peak = -Infinity
    let sum = 0
    let count = 0
    let run = 0
    for (const point of points) {
      if ((point.o - cross50) * side <= 0) continue
      if (!(point.d > plateau * 0.02)) break
      if (point.d > peak) {
        peak = point.d
        haloPeakAt = point.o
      }
      sum += point.d
      count += 1
      if (point.d > plateau * LINE_HALO_RUN_FRACTION) {
        run += 1
        if (run > haloRun) haloRun = run
      } else {
        run = 0
      }
    }
    if (count > 0) {
      haloPeakRel = round4(peak / plateau)
      haloMean = round4(sum / count)
    }
  }
  return {
    plateau: round4(plateau),
    bandPx: bandPx === null ? null : round2(bandPx),
    step: step === null ? null : round4(step),
    stepAt,
    haloPeakRel,
    haloMean,
    haloRun,
    haloPeakAt,
  }
}

/**
 * The three-field across profile at one surface. The `interior` block finds
 * the palest band INSIDE the stroke's own support (rows whose cover is at
 * least half of the profile's peak), so the rim — which thins by design —
 * can never masquerade as the defect.
 */
function lineProfileSet(engine: WatercolorEngine): Record<string, unknown> {
  const transparent = engine.exportCanvas('transparent')
  const coverage = engine.exportCanvas('coverage')
  const dw = transparent.width
  const dh = transparent.height
  const tData = transparent.getContext('2d')!.getImageData(0, 0, dw, dh).data
  const cData = coverage.getContext('2d')!.getImageData(0, 0, dw, dh).data
  const centre = Math.round(LINE_Y * dh)
  const px0 = Math.round(LINE_PROFILE_X0 * dw)
  const px1 = Math.round(LINE_PROFILE_X1 * dw)
  const bandY0 = Math.max(0, centre - LINE_BAND_PX)
  const bandY1 = Math.min(dh, centre + LINE_BAND_PX + 1)
  const absorb = absorbBand(engine, dw, dh, px0, px1, bandY0, bandY1)

  const offsets: number[] = []
  const cover: number[] = []
  const dark: number[] = []
  const ink: number[] = []
  for (let o = -LINE_BAND_PX; o <= LINE_BAND_PX; o += 1) {
    const gy = centre + o
    if (gy < 0 || gy >= dh) continue
    const cr = dh - 1 - gy
    let cSum = 0
    let dSum = 0
    let iSum = 0
    let n = 0
    for (let x = px0; x < px1; x += 1) {
      const i4 = (cr * dw + x) * 4
      cSum += cData[i4]! / 255
      dSum += 1 - Math.min(tData[i4]!, tData[i4 + 1]!, tData[i4 + 2]!) / 255
      iSum += absorb.data[(gy - bandY0) * absorb.width + (x - px0)]!
      n += 1
    }
    offsets.push(o)
    cover.push(round4(cSum / n))
    dark.push(round4(dSum / n))
    ink.push(round4(iSum / n))
  }

  const peakCover = cover.reduce((m, v) => Math.max(m, v), 0)
  const floorCover = peakCover * 0.5
  const interiorRows = offsets
    .map((o, i) => ({ o, c: cover[i]! }))
    .filter((row) => row.c >= floorCover && row.c > 0)
  const interiorSpan: [number, number] =
    interiorRows.length > 0
      ? [interiorRows[0]!.o, interiorRows[interiorRows.length - 1]!.o]
      : [0, 0]

  const stat = (values: readonly number[], from: number, to: number) => {
    let min = Infinity
    let at = 0
    let max = -Infinity
    for (let i = 0; i < values.length; i += 1) {
      const o = offsets[i]!
      if (o < from || o > to) continue
      const v = values[i]!
      if (v < min) {
        min = v
        at = o
      }
      if (v > max) max = v
    }
    return { min: round4(min), max: round4(max), at, depth: round4(max - min) }
  }

  const stations = LINE_STATIONS.map((x) => {
    const xpx = Math.min(dw - 1, Math.round(x * dw))
    const values: number[] = []
    for (let o = -LINE_STATION_HALF; o <= LINE_STATION_HALF; o += 1) {
      const gy = centre + o
      const cr = dh - 1 - gy
      if (gy < 0 || gy >= dh) {
        values.push(0)
        continue
      }
      const i4 = (cr * dw + xpx) * 4
      values.push(round4(1 - Math.min(tData[i4]!, tData[i4 + 1]!, tData[i4 + 2]!) / 255))
    }
    return { x, values }
  })

  // 2026-11-22 (UAT row 3): the along profiles. `darkAt(o)` is one row's
  // darkness across the stroke's central half, `inkAt(o)` its delivered
  // absorbance; both are cached per across offset because the enclosed-line
  // scan reads the same rows as ±4..8 px neighbours.
  const darkRows = new Map<number, number[]>()
  const inkRows = new Map<number, number[]>()
  const darkAt = (o: number): number[] => {
    const cached = darkRows.get(o)
    if (cached) return cached
    const gy = centre + o
    const cr = dh - 1 - gy
    const values: number[] = []
    if (gy < 0 || gy >= dh) {
      values.push(...new Array<number>(px1 - px0).fill(0))
    } else {
      for (let x = px0; x < px1; x += 1) {
        const i4 = (cr * dw + x) * 4
        values.push(1 - Math.min(tData[i4]!, tData[i4 + 1]!, tData[i4 + 2]!) / 255)
      }
    }
    darkRows.set(o, values)
    return values
  }
  const inkAt = (o: number): number[] => {
    const cached = inkRows.get(o)
    if (cached) return cached
    const gy = centre + o
    const values: number[] = []
    if (gy < bandY0 || gy >= bandY1) {
      values.push(...new Array<number>(px1 - px0).fill(0))
    } else {
      for (let x = px0; x < px1; x += 1) {
        values.push(absorb.data[(gy - bandY0) * absorb.width + (x - px0)]!)
      }
    }
    inkRows.set(o, values)
    return values
  }

  // The TILING gate: high-passed along profiles, their dominant period and
  // amplitude, and the cross-row coherence of the fringe rows (a band motif
  // pulses the whole fringe in phase; fibre noise is row-independent).
  const tilingRows = LINE_TILING_ROWS
    .filter((o) => centre + o >= 0 && centre + o < dh)
    .map((o) => {
      const darkHp = boxcarHighpass(darkAt(o), LINE_TILING_WINDOW)
      const inkHp = boxcarHighpass(inkAt(o), LINE_TILING_WINDOW)
      const darkPeak = alongPeriodogram(darkHp, LINE_TILING_MIN_PERIOD, LINE_TILING_MAX_PERIOD)
      const inkPeak = alongPeriodogram(inkHp, LINE_TILING_MIN_PERIOD, LINE_TILING_MAX_PERIOD)
      return {
        offset: o,
        dark: { hpRms: round4(seriesStats(darkHp).rms), periodPx: darkPeak.periodPx, amp: round4(darkPeak.amp) },
        ink: { hpRms: round4(seriesStats(inkHp).rms), periodPx: inkPeak.periodPx, amp: round4(inkPeak.amp) },
        darkHp,
      }
    })
  const fringeRows = tilingRows.filter((row) => Math.abs(row.offset) >= 52)
  const pairs: number[] = []
  for (let i = 0; i < fringeRows.length; i += 1) {
    for (let j = i + 1; j < fringeRows.length; j += 1) {
      pairs.push(seriesCorr(fringeRows[i]!.darkHp, fringeRows[j]!.darkHp))
    }
  }
  const coherence = {
    mean: round4(pairs.length > 0 ? pairs.reduce((s, v) => s + v, 0) / pairs.length : 0),
    fracHigh: round4(pairs.length > 0 ? pairs.filter((v) => v > LINE_TILING_COHERENT).length / pairs.length : 0),
    pairs: pairs.length,
  }

  // The ENCLOSED-line scan (the artist's definition, self-contained in the
  // probe since 2026-11-22): a row is a line when it is paler than the
  // mean of its ±4..8 px neighbours on BOTH sides — a feather's pale edge is
  // not a line, because beyond it is paper, not paint.
  const scanHi = Math.min(96, LINE_BAND_PX - 8)
  let enclosed: Record<string, unknown> | null = null
  if (scanHi >= 56) {
    let best: { offset: number; meanProm: number; prom: number[] } = { offset: 0, meanProm: -Infinity, prom: [] }
    for (const sgn of [1, -1] as const) {
      for (let o = 56; o <= scanHi; o += 1) {
        const row = darkAt(sgn * o)
        const inward = new Array<number>(row.length).fill(0)
        const outward = new Array<number>(row.length).fill(0)
        for (let d = 4; d <= 8; d += 1) {
          const a = darkAt(sgn * (o - d))
          const b = darkAt(sgn * (o + d))
          for (let x = 0; x < row.length; x += 1) {
            inward[x] = inward[x]! + a[x]! / 5
            outward[x] = outward[x]! + b[x]! / 5
          }
        }
        const prom = inward.map((v, x) => Math.min(v, outward[x]!) - row[x]!)
        let sum = 0
        for (const v of prom) sum += v
        const meanProm = sum / Math.max(prom.length, 1)
        if (meanProm > best.meanProm) best = { offset: sgn * o, meanProm, prom }
      }
    }
    const thr = Math.max(best.meanProm * 0.5, 0.02)
    const flags = best.prom.map((v) => v > thr)
    const runs = runLengths(flags)
    enclosed = {
      offset: best.offset,
      meanPct: round2(100 * best.meanProm),
      fracPct: round2((100 * flags.filter(Boolean).length) / Math.max(flags.length, 1)),
      runs: runs.length,
      maxRunPx: runs.length > 0 ? Math.max(...runs) : 0,
    }
  }

  // 2026-11-22 (bristle-line gate): the rim and halo walks, one per side,
  // computed from the SAME across profile and interior span the tiling block
  // uses. Additive: every pre-existing field keeps its name and shape.
  const sides = {
    down: lineSideWalk(offsets, dark, interiorSpan, -1),
    up: lineSideWalk(offsets, dark, interiorSpan, 1),
  }

  return {
    centreRow: centre,
    peakCover: round4(peakCover),
    interior: {
      span: interiorSpan,
      cover: stat(cover, interiorSpan[0], interiorSpan[1]),
      dark: stat(dark, interiorSpan[0], interiorSpan[1]),
      ink: stat(ink, interiorSpan[0], interiorSpan[1]),
    },
    rim: {
      down: {
        plateau: sides.down.plateau,
        bandPx: sides.down.bandPx,
        step: sides.down.step,
        stepAt: sides.down.stepAt,
      },
      up: {
        plateau: sides.up.plateau,
        bandPx: sides.up.bandPx,
        step: sides.up.step,
        stepAt: sides.up.stepAt,
      },
    },
    halo: {
      down: {
        peakRel: sides.down.haloPeakRel,
        mean: sides.down.haloMean,
        run: sides.down.haloRun,
        peakAt: sides.down.haloPeakAt,
      },
      up: {
        peakRel: sides.up.haloPeakRel,
        mean: sides.up.haloMean,
        run: sides.up.haloRun,
        peakAt: sides.up.haloPeakAt,
      },
    },
    offsets,
    across: { cover, dark, ink },
    stations,
    tiling: {
      rows: tilingRows.map(({ darkHp: _darkHp, ...rest }) => rest),
      coherence,
      enclosed,
    },
  }
}

// --- bristle-end (2026-11-23, the acrylic stroke end-cap defect) ------------
//
// The defect (live, artist isolation): every Acrylic bristle stroke ENDS on a
// straight-edged rectangular block of different contrast — a hard wall across
// the mark's width — while its START breaks up with bristle-scale
// irregularity. The artist's isolation:
//   - pen LIFT while still moving            -> correct, ragged cap;
//   - pen STOPS the tip while pressed, then releases -> square block;
//   - mouse / trackpad (the stroke stops dead)       -> always square;
//   - Pigment 0 shows the wanted dry break-up, but at the cost of run length.
//
// WHERE IT CAN LIVE (tree, 2026-11-23): the along cap rides ONLY the catch-up
// impression (`bristleEndCap = true` around the `ending`-tick trace in
// Engine.ts processInput); `trace()` stamps only when residual arc length
// reaches one spacing and then sets `s.x = ex` regardless, so a stop whose
// catch-up consumes the residual stamps nothing left for later ticks. The
// scripted (re-bake) path calls `trace(s, nx, ny, nx, ny)` — no residual, no
// catch-up, no capped dab ever. Separately the cap is a DEPTH fade while the
// film already committed by preceding running dabs survives the deposit lerp
// (~100 px memory), so a depth fade alone cannot remove committed film.
//
// THE DRIVES — one stroke per capture (one sheet, one lane at y = 0.5), the
// SAME geometry (#2b6fd0, x 0.15..0.85, bristle-flat, the acrylic record's
// params) driven through six different end paths:
//
//   stop        live pen, constant pressure 0.75, then a held pointer's
//               deterministic +-1 px jitter moves (a stylus in contact keeps
//               reporting), then pointerup. The artist's square case.
//   lift        live pen, constant pressure, pointerup between moves — the
//               artist's correct case: the catch-up fires while the hand is
//               still travelling.
//   decay       live pen, the last ten samples ramp pressure 0.75 -> 0.10
//               while the hand keeps moving: a physical pen's lift-off.
//   mouse       live mouse (the -1 pressure sentinel: pressureOf derives
//               simPressure from speed), jitter stop, pointerup. The artist's
//               always-square case; the speed-derived pressure saturates as
//               the jitter kills the measured speed.
//   mouse-lift  live mouse, pointerup between moves — a mouse CAN be released
//               while travelling; the control for "mouse can never lift".
//   bake        the recorded `stop` sequence replayed through the adapter's
//               scripted feed (one sample per host tick, SCRIPT_POINTER): the
//               re-bake surface, which never stamps a capped dab.
//
// THE MEASUREMENT — per-row edge geometry read off the `transparent` export
// (the film's visible darkness, 1 - min(rgb), the same field the bristle-line
// gate reads):
//   - the END boundary: for every row across the stroke's own support, the
//     LAST x whose darkness clears the threshold — a straight wall reads as a
//     huge flat share, a short spread and a long unbroken row run;
//   - the START boundary: the SAME statistic from the leading edge, so the
//     wanted break-up is measured by one law on the same stroke;
//   - contrast: mean darkness of the last 30 px before the end boundary vs the
//     body (x 0.40..0.55) — the "block of different contrast" as a number;
//   - thickness over the last 10 / 25 / 50 % of travel vs the first 10 / 25 /
//     50 %, so a terminal width step is a number too.
// The PNG crops (`pngStart`, `pngEnd`) are 2x nearest-neighbour cut-outs on
// white, the visual evidence that pairs with the numbers.
const END_COLOR = LINE_COLOR
const END_LANE_Y = LINE_Y
const END_X0 = LINE_X0
const END_X1 = LINE_X1
/** The end scenario's own per-stroke seed (distinct from the pale-line lane's,
 *  so a capture can never be mistaken for the other scenario's). */
const END_MUTATION_ID = 0x7ee500
/** The live pointer's non-SCRIPT_POINTER id (any positive integer: the engine
 *  only branches on `pointerId === SCRIPT_POINTER`). */
const END_LIVE_POINTER = 91
/** The 60 Hz drive: one sample per host tick, the same cadence the adapter's
 *  scripted feed uses — so a live end and its re-bake are tick-aligned. */
const END_DT = 1 / 60
const END_TICK_MS = 1000 / 60
/** Moving samples from END_X0 to END_X1 at constant pressure. */
const END_STEPS = 24
const END_PRESS = 0.75
/** The held pointer's jitter: +-1 px x, +-0.5 px y, alternating each sample —
 *  deterministic, and small enough that it never advances a full dab spacing
 *  per sample (the speed still reads ~0, which is the point). */
const END_JITTER_UV_X = 1 / 1080
const END_JITTER_UV_Y = 0.5 / 1080
const END_JITTER_TICKS = 15
/** The pressure-decay tail: ten still-moving samples, pressure 0.75 -> 0.10. */
const END_DECAY_SAMPLES = 10
const END_DECAY_FROM = 0.75
const END_DECAY_TO = 0.1
const END_DECAY_STEP_X = 0.004
/** Darkness a pixel must clear to count as film (the pale-line gate's own
 *  visible-darkness field; blank paper reads 0). */
const END_DARK_THRESHOLD = 0.06
/** Rows whose central-half mean darkness clears this carry the mark. */
const END_MARK_FLOOR = 0.1
/** Two boundary positions this close count as the same straight line. */
const END_ROW_TOL_PX = 1.5
/** The contrast zone's length before/after the boundary, in document px. */
const END_BLOCK_PX = 30
/** The crop cut-outs: ~2.4 brush widths of travel, 40 px past the edge. */
const END_CROP_W = 520
const END_CROP_MARGIN = 40

const END_DRIVES = ['stop', 'lift', 'decay', 'mouse', 'mouse-lift', 'bake'] as const
type EndDrive = (typeof END_DRIVES)[number]

/** The `--drive` operand: which end path this capture drives. Absent keeps the
 *  artist's primary case (`stop`); an unknown name throws rather than falling
 *  back to a capture that cannot judge what was asked for. */
function readEndDrive(): EndDrive {
  const raw = new URLSearchParams(location.search).get('drive')
  if (raw === null || raw === '') return 'stop'
  if (
    raw !== 'stop' && raw !== 'lift' && raw !== 'decay' &&
    raw !== 'mouse' && raw !== 'mouse-lift' && raw !== 'bake'
  ) {
    throw new Error(
      `invalid drive "${raw}" (expected "stop", "lift", "decay", "mouse", "mouse-lift" or "bake")`,
    )
  }
  return raw
}

/** The bristle-end stroke's per-stroke seed: `--mut` when given, else the
 *  scenario's own constant. One seed for the live drive and the re-bake, so
 *  the two surfaces differ only in HOW the dabs land. */
function readEndMut(): number {
  const raw = new URLSearchParams(location.search).get('mut')
  if (raw === null || raw === '') return END_MUTATION_ID
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`invalid mut "${raw}" (expected a non-negative integer)`)
  }
  return Math.floor(value)
}

/**
 * quick 261125-rtc: the artist's bag operands for the bristle-end scenario.
 * `dry`/`feather` are integers 0..100 folded into the stroke's params bag
 * (the acrylic record states Dry 70 / Feather 85; the artist's bag is Feather
 * 100); `release` is the pressure of the LAST authored pen sample. The pen
 * lanes whose end is one terminal authored pressure are the only ones a
 * release override may drive: `lift` and `decay` carry their own measured
 * pressure tails (END_LIFT_PRESSURES, the 0.75-to-0.10 decay ramp) and the
 * mouse drives keep the -1 sentinel, so an override there would silently
 * rewrite a tail the capture is supposed to measure.
 */
interface EndSetup {
  readonly dry: number | null
  readonly feather: number | null
  readonly release: number | null
}

const NO_END_SETUP: EndSetup = { dry: null, feather: null, release: null }

/** The `--dry` / `--feather` / `--release` operands, read once beside the
 *  drive. run.mjs is the first line of defence (same bounds, same refusals);
 *  this is the second, so a hand-built page query can never capture a stroke
 *  the flags were supposed to forbid. */
function readEndSetup(drive: EndDrive | undefined): EndSetup {
  const query = new URLSearchParams(location.search)
  const readPercent = (key: 'dry' | 'feather'): number | null => {
    const raw = query.get(key)
    if (raw === null || raw === '') return null
    const value = Number(raw)
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      throw new Error(`invalid ${key} "${raw}" (expected an integer 0..100)`)
    }
    return value
  }
  const dry = readPercent('dry')
  const feather = readPercent('feather')
  const releaseRaw = query.get('release')
  let release: number | null = null
  if (releaseRaw !== null && releaseRaw !== '') {
    const value = Number(releaseRaw)
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`invalid release "${releaseRaw}" (expected 0..1)`)
    }
    if (drive !== 'stop' && drive !== 'bake') {
      throw new Error(`release override refused on the "${drive ?? 'stop'}" drive (stop and bake only)`)
    }
    release = value
  }
  return { dry, feather, release }
}

/** One queued sample of the live drive. `p` keeps the mouse sentinel (-1). */
interface EndSample {
  readonly x: number
  readonly y: number
  readonly p: number
}

/** The moving samples every drive shares, at the drive's own pressure. */
function endMoves(pressure: number): EndSample[] {
  const out: EndSample[] = []
  for (let i = 0; i < END_STEPS; i += 1) {
    out.push({ x: END_X0 + ((END_X1 - END_X0) * i) / (END_STEPS - 1), y: END_LANE_Y, p: pressure })
  }
  return out
}

/** The held pointer's deterministic jitter after the last move. */
function endJitter(pressure: number): EndSample[] {
  const out: EndSample[] = []
  for (let i = 0; i < END_JITTER_TICKS; i += 1) {
    const sign = i % 2 === 0 ? 1 : -1
    out.push({
      x: END_X1 + sign * END_JITTER_UV_X,
      y: END_LANE_Y + sign * END_JITTER_UV_Y,
      p: pressure,
    })
  }
  return out
}

/** A real stylus lift: the nib loses contact progressively, so the pressure
 *  collapses over the last few samples WHILE the hand keeps travelling at its
 *  drawing cadence. This is the artist's correct case. */
const END_LIFT_TAIL = 6
const END_LIFT_PRESSURES: readonly number[] = [0.55, 0.4, 0.25, 0.12, 0.05, 0.02]

/** The samples each live drive feeds: the moves, the drive's own end path.
 *  quick 261125-rtc: `release` replaces the LAST authored pen sample's
 *  pressure (the catch-up dab then derives its own pressure from it through
 *  the engine — the census records the `pr` values rather than assuming
 *  them). Only the stop/bake drives accept it; the others carry their own
 *  measured tails and read none. */
function endDriveSamples(drive: EndDrive, release: number | null = null): EndSample[] {
  const mouse = drive === 'mouse' || drive === 'mouse-lift'
  const pressure = mouse ? -1 : END_PRESS
  const moves = endMoves(pressure)
  let out: EndSample[]
  if (drive === 'mouse-lift') {
    out = moves
  } else if (drive === 'lift') {
    // The artist's lift: the LAST moves already carry the collapsing pressure
    // (the hand is still moving), then pointerup — no rest, no jitter.
    out = moves
    for (let i = 0; i < END_LIFT_TAIL; i += 1) {
      const idx = out.length - END_LIFT_TAIL + i
      const sample = out[idx]!
      out[idx] = { x: sample.x, y: sample.y, p: END_LIFT_PRESSURES[i]! }
    }
  } else if (drive === 'decay') {
    out = moves
    let x = END_X1
    for (let i = 1; i <= END_DECAY_SAMPLES; i += 1) {
      x += END_DECAY_STEP_X
      const t = i / END_DECAY_SAMPLES
      out.push({ x, y: END_LANE_Y, p: END_DECAY_FROM + (END_DECAY_TO - END_DECAY_FROM) * t })
    }
  } else {
    // stop / mouse: the held pointer's jitter, then the release.
    out = [...moves, ...endJitter(pressure)]
  }
  if (release !== null) {
    const last = out[out.length - 1]
    if (last === undefined) throw new Error('bristle-end: the drive has no samples')
    out[out.length - 1] = { x: last.x, y: last.y, p: release }
  }
  return out
}

/** The re-bake surface's recorded points: the `stop` drive's sequence — a
 *  recorded stop-then-release stroke carries the jitter, and the scripted feed
 *  replays it one sample per host tick, exactly like the app's re-bake. The
 *  `--release` override rides the same final sample, so the bake receives the
 *  exact tail the live stop lane measured. */
function endBakePoints(setup: EndSetup): readonly AquarellePoint[] {
  return endDriveSamples('stop', setup.release).map((sample) => ({
    x: sample.x,
    y: sample.y,
    p: sample.p,
    tx: 0,
    ty: 0,
    tw: 0,
  }))
}

/** The adapter's configure(), reproduced against the captured engine for the
 *  LIVE drives (the adapter has no live pointer seam). Same bag, same brush
 *  projection, same colour resolution, same seed derivation — one stroke in
 *  every input the engine reads. */
function configureLiveEnd(
  engine: WatercolorEngine,
  bag: Record<string, number>,
  mut: number,
  // quick 261125-rtc: the artist's brush. `bristle-flat` was retired by
  // 261124-iq9, so the old default silently resolved to the watercolor
  // `round` and every live end capture measured the wrong path.
  brushId = 'bristle-round',
  color = END_COLOR,
): void {
  engine.setParams(toEngineParams(bag))
  engine.setBrush(
    buildBrushForStroke(brushId, {
      textureId: null,
      textureRotation: null,
      overrides: undefined,
    }),
  )
  engine.setPigment(pigmentFromHex(color))
  engine.setTool('brush')
  engine.setRandom(seededRandom(hashMutationId(mut) || 1))
}

/** The adapter seams the live drive needs. Structural, so the real adapter
 *  passes without a cast at the call site. */
interface EndAdapter {
  advanceClock(ms: number): void
  stepTick(tick: number): void
  fix(): void
}

/** The private engine state the live drive dresses as a pointer stroke. The
 *  seam is the same one `scriptBegin` seeds; the drive only re-labels the
 *  pointer and queues samples, exactly like attachInput's own handlers. */
interface EndLiveEngine {
  stroke: { pointerId: number; pointerType: string; ending: boolean } | null
  queue: Array<Record<string, number>>
  clock: () => number
}

/** One recorded impression: where a dab landed, at what pressure, and whether
 *  it carried the catch-up's uEndCap flag. The census proves which dabs (if
 *  any) carry the cap on each end path. */
interface EndTap {
  readonly x: number
  readonly y: number
  readonly pr: number
  readonly endCap: boolean
}

/** quick 261125-rtc: the ONE shared tap + gather census. Installed once on the
 *  captured engine BEFORE the drive branch, so it spans the live drive AND
 *  the re-bake lane's scripted feed (the adapter's applyStroke loop runs on
 *  the same engine). A bake capture's census is therefore a populated object,
 *  never null — the proof that the real gather ran on both lanes. */
interface EndCensusRecorder {
  /** The final 40 taps (the writer set must be measurable at size 300). */
  readonly taps: EndTap[]
  /** Every tap the stroke stamped, the retained window included. */
  tapCount: number
  gatherCalls: number
  endCapCalls: number
}

/** Drive one LIVE end path through the real engine, then settle and fix. The
 *  census recorder is owned by the caller and shared with the bake lane. */
function driveBristleEnd(
  adapter: EndAdapter,
  engine: WatercolorEngine,
  drive: EndDrive,
  body: number,
  strokeSize: number,
  setup: EndSetup,
  census: EndCensusRecorder,
): void {
  configureLiveEnd(engine, bristleLineParams(body, strokeSize, setup), readEndMut())
  const samples = endDriveSamples(drive, setup.release)
  const first = samples[0]
  if (first === undefined) throw new Error('bristle-end: the drive has no samples')
  if (!engine.scriptBegin('brush', first.x, first.y, first.p, 'Stroke')) {
    throw new Error('bristle-end: the engine refused the stroke')
  }
  const live = engine as unknown as EndLiveEngine
  const stroke = live.stroke
  if (stroke === null) throw new Error('bristle-end: scriptBegin left no stroke')
  // Re-label the scripted stroke as a live pointer: the processing branch is
  // `pointerId !== SCRIPT_POINTER` (the midpoint trace and the catch-up), and
  // the smoothing weight reads `pointerType`.
  stroke.pointerId = END_LIVE_POINTER
  stroke.pointerType = drive === 'mouse' || drive === 'mouse-lift' ? 'mouse' : 'pen'
  // The first sample is already queued by scriptBegin; one tick deposits it.
  adapter.stepTick(0)
  for (let i = 1; i < samples.length; i += 1) {
    adapter.advanceClock(END_TICK_MS)
    const sample = samples[i]!
    live.queue.push({ x: sample.x, y: sample.y, p: sample.p, t: live.clock(), tx: 0, ty: 0, w: 1 })
    engine.tick(END_DT)
  }
  // The release: pointerup arrives with no new sample, exactly like the live
  // handler's `ending = true`. The ending tick is where the catch-up (and its
  // uEndCap dabs) fires for every path.
  stroke.ending = true
  engine.tick(END_DT)
  for (let tick = 0; tick <= SETTLE_TICKS; tick += 1) adapter.stepTick(tick)
  adapter.fix()
  // The census is the proof the real path ran: a live lane that stamped no
  // dab is a broken capture, never a quiet zero row.
  if (census.tapCount === 0) throw new Error('bristle-end: the live drive stamped no dab')
}

/** The four shape scalars + quantiles of one measured edge. Row order is the
 *  across-stroke order: adjacent entries are neighbouring rows. */
interface EndEdgeStats {
  readonly medianPx: number
  readonly p10Px: number
  readonly p90Px: number
  readonly spreadPx: number
  readonly irregularityPx: number
  readonly flatPct: number
  readonly longestFlatRunPx: number
}

/** Derive one edge's stats in one pass. A wall reads flatPct ~100, spread ~0,
 *  irregularity ~0 and a run as long as the mark is thick; the wanted ragged
 *  edge reads a visible spread and a short run. */
function endEdgeStats(values: readonly number[]): EndEdgeStats {
  if (values.length === 0) {
    return { medianPx: 0, p10Px: 0, p90Px: 0, spreadPx: 0, irregularityPx: 0, flatPct: 0, longestFlatRunPx: 0 }
  }
  const med = median(values)
  const p10 = quantile(values, 0.1)
  const p90 = quantile(values, 0.9)
  const diffs: number[] = []
  for (let i = 1; i < values.length; i += 1) diffs.push(Math.abs(values[i]! - values[i - 1]!))
  const flat = values.filter((value) => Math.abs(value - med) <= END_ROW_TOL_PX).length
  let longest = 1
  let run = 1
  let anchor = values[0]!
  for (let i = 1; i < values.length; i += 1) {
    if (Math.abs(values[i]! - anchor) <= END_ROW_TOL_PX) {
      run += 1
    } else {
      run = 1
      anchor = values[i]!
    }
    if (run > longest) longest = run
  }
  return {
    medianPx: round2(med),
    p10Px: round2(p10),
    p90Px: round2(p90),
    spreadPx: round2(p90 - p10),
    irregularityPx: round2(median(diffs)),
    flatPct: round2((100 * flat) / values.length),
    longestFlatRunPx: longest,
  }
}

/**
 * 2026-11-23: the end-region census on the `transparent` export. Rows carrying
 * the mark are those whose central-half mean darkness clears END_MARK_FLOOR;
 * for each, the START boundary is the first x above threshold and the END
 * boundary the last, inside the scan window. All numbers are document pixels.
 *
 * quick 261125-rtc: the same body/end zones are also read on the PIGMENT,
 * COVERAGE and VISIBLE-COMPOSITE rasters, and every surface's zone reports
 * `inked` — the share of zone cells at or above the surface's own threshold.
 * The 2026-11-23 debug left the transparent and pigment readings disagreeing,
 * so a fix chosen on one surface alone could miss the artist's block; the
 * density block names all four and the effective sampling factor that produced
 * them.
 *
 * TASK 2 (FROZEN 2026-11-25): the END zone is anchored to the CENSUS, not to
 * the measured end median. The first measurement's window started 26.7-48.8
 * document px AHEAD of the last recorded dab in every cell, sampling the
 * leading frontier of the terminal dabs where a trailing-side law is inert.
 * The declared window is `[lastTap - 2.4r, lastTap + 1.05r]` with
 * `lastTap = endCensus.last40.at(-1).x * dw` and `r = strokeSize / 2` document
 * px, clamped to `[0, dw - 1]`; a bristle-end capture with no census tap FAILS
 * rather than silently falling back to the old window. The body zone is
 * unchanged at `[0.40, 0.55] dw`.
 */
function bristleEndMetrics(
  transparent: HTMLCanvasElement,
  pigment: HTMLCanvasElement,
  coverage: HTMLCanvasElement,
  strokeSize: number,
  taps: readonly EndTap[],
): Record<string, unknown> {
  const dw = transparent.width
  const dh = transparent.height
  const data = transparent.getContext('2d')!.getImageData(0, 0, dw, dh).data
  const pigmentData = pigment.getContext('2d')!.getImageData(0, 0, dw, dh).data
  const coverageData = coverage.getContext('2d')!.getImageData(0, 0, dw, dh).data
  const centre = Math.round(END_LANE_Y * dh)
  const scanLo = Math.max(0, Math.round((END_X0 - 0.06) * dw))
  const scanHi = Math.min(dw - 1, Math.round((END_X1 + 0.09) * dw))
  const bodyLo = Math.round(0.4 * dw)
  const bodyHi = Math.round(0.55 * dw)
  const dark = (x: number, cr: number): number => {
    const i4 = (cr * dw + x) * 4
    return 1 - Math.min(data[i4]!, data[i4 + 1]!, data[i4 + 2]!) / 255
  }
  /** The pigment raster's `bandPigment` reader: (255 − mean RGB) / 255. */
  const pigmentDark = (x: number, cr: number): number => {
    const i4 = (cr * dw + x) * 4
    return (255 - (pigmentData[i4]! + pigmentData[i4 + 1]! + pigmentData[i4 + 2]!) / 3) / 255
  }
  /** The coverage raster's own channel: alpha / 255. */
  const coverageInk = (x: number, cr: number): number => coverageData[(cr * dw + x) * 4 + 3]! / 255
  /** The visible composite over white — `endFine.vis` verbatim: the darkness
   *  the eye reads once the film is laid on the paper. */
  const visibleDark = (x: number, cr: number): number => {
    const i4 = (cr * dw + x) * 4
    const r = data[i4]!
    const g = data[i4 + 1]!
    const b = data[i4 + 2]!
    const a = data[i4 + 3]! / 255
    return 1 - Math.min(r * a + 255 * (1 - a), g * a + 255 * (1 - a), b * a + 255 * (1 - a)) / 255
  }

  const starts: number[] = []
  const ends: number[] = []
  const markRows: number[] = []
  let bodySum = 0
  let bodyCount = 0
  for (let o = -LINE_BAND_PX; o <= LINE_BAND_PX; o += 1) {
    const gy = centre + o
    if (gy < 0 || gy >= dh) continue
    const cr = dh - 1 - gy
    let rowSum = 0
    let rowN = 0
    for (let x = bodyLo; x < bodyHi; x += 1) {
      rowSum += dark(x, cr)
      rowN += 1
    }
    const rowMean = rowSum / Math.max(1, rowN)
    if (rowMean < END_MARK_FLOOR) continue
    markRows.push(gy)
    bodySum += rowMean
    bodyCount += 1
    let lead = -1
    for (let x = scanLo; x <= scanHi; x += 1) {
      if (dark(x, cr) >= END_DARK_THRESHOLD) {
        lead = x
        break
      }
    }
    let trail = -1
    for (let x = scanHi; x >= scanLo; x -= 1) {
      if (dark(x, cr) >= END_DARK_THRESHOLD) {
        trail = x
        break
      }
    }
    if (lead >= 0) starts.push(lead)
    if (trail >= 0) ends.push(trail)
  }

  const bodyDark = bodyCount > 0 ? bodySum / bodyCount : 0
  const startMedian = median(starts)
  const endMedian = median(ends)

  /** Mean darkness over an x-window across every mark row. */
  const zoneMean = (x0: number, x1: number): number => {
    const lo = Math.max(scanLo, Math.round(x0))
    const hi = Math.min(scanHi, Math.round(x1))
    if (hi <= lo) return 0
    let sum = 0
    let n = 0
    for (const gy of markRows) {
      const cr = dh - 1 - gy
      for (let x = lo; x <= hi; x += 1) {
        sum += dark(x, cr)
        n += 1
      }
    }
    return n > 0 ? sum / n : 0
  }

  /** One column's across-stroke thickness, in document px. */
  const columnThickness = (x: number): number => {
    let lo = -1
    let hi = -1
    for (const gy of markRows) {
      const cr = dh - 1 - gy
      if (dark(x, cr) >= END_DARK_THRESHOLD) {
        if (lo < 0) lo = gy
        hi = gy
      }
    }
    return lo < 0 ? 0 : hi - lo + 1
  }

  /** Thickness over a travel window: mean plus the p10..p90 spread. */
  const thickness = (from: number, to: number): Record<string, number> => {
    const values: number[] = []
    for (let x = Math.round(from); x <= Math.round(to); x += 1) values.push(columnThickness(x))
    return {
      meanPx: round2(values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0),
      p10Px: round2(quantile(values, 0.1)),
      p90Px: round2(quantile(values, 0.9)),
    }
  }

  const travel = Math.round((END_X1 - END_X0) * dw)
  const window = (fraction: number) => Math.round(travel * fraction)
  const bodyDarkness = zoneMean(bodyLo, bodyHi)
  const startDarkness = zoneMean(startMedian + 2, startMedian + END_BLOCK_PX)
  const endDarkness = zoneMean(endMedian - END_BLOCK_PX, endMedian - 2)

  /** The along-x darkness profile through the end boundary, one value every
   *  4 px over END_X1 +- 160 px: a hard cut reads as a cliff from the body
   *  level to 0 in one step; a fade contour reads as a graded decay. */
  const endAlongDark: number[] = []
  for (let x = Math.round(END_X1 * dw) - 160; x <= Math.round(END_X1 * dw) + 160; x += 4) {
    endAlongDark.push(round4(zoneMean(x, x + 3)))
  }
  const startAlongDark: number[] = []
  for (let x = Math.round(END_X0 * dw) - 160; x <= Math.round(END_X0 * dw) + 160; x += 4) {
    startAlongDark.push(round4(zoneMean(x, x + 3)))
  }

  /** 2026-11-23: the end boundary at 1 px, three ways — the raw pigment
   *  darkness, the film's alpha, and the composite over white the eye reads.
   *  A terminal block whose film OPACITY differs from the body shows as a
   *  vis/alpha step even where the pigment darkness does not. */
  const endFine: Array<{ x: number; dark: number; vis: number; alpha: number }> = []
  for (let x = Math.round(END_X1 * dw) - 200; x <= Math.round(END_X1 * dw) + 160; x += 1) {
    let darkSum = 0
    let visSum = 0
    let alphaSum = 0
    let n = 0
    for (const gy of markRows) {
      const cr = dh - 1 - gy
      const i4 = (cr * dw + x) * 4
      const r = data[i4]!
      const g = data[i4 + 1]!
      const b = data[i4 + 2]!
      const a = data[i4 + 3]! / 255
      darkSum += 1 - Math.min(r, g, b) / 255
      visSum += 1 - Math.min(r * a + 255 * (1 - a), g * a + 255 * (1 - a), b * a + 255 * (1 - a)) / 255
      alphaSum += a
      n += 1
    }
    endFine.push({
      x,
      dark: round4(darkSum / Math.max(1, n)),
      vis: round4(visSum / Math.max(1, n)),
      alpha: round4(alphaSum / Math.max(1, n)),
    })
  }

  /** quick 261125-rtc: the density zones. One surface's body and end zone
   *  reads over every mark row: the mean of the surface's own reader and the
   *  share of cells at or above the surface's threshold (the "inked" share).
   *  The end window scales with the measured body thickness — the block's
   *  area grows with the brush — and stops 2 px before the measured end
   *  median so the boundary's own falloff never dilutes the block. */
  const zoneRead = (
    read: (x: number, cr: number) => number,
    threshold: number,
    x0: number,
    x1: number,
  ): { mean: number; inked: number } => {
    const lo = Math.max(scanLo, Math.round(x0))
    const hi = Math.min(scanHi, Math.round(x1))
    if (hi <= lo) return { mean: 0, inked: 0 }
    let sum = 0
    let above = 0
    let n = 0
    for (const gy of markRows) {
      const cr = dh - 1 - gy
      for (let x = lo; x <= hi; x += 1) {
        const value = read(x, cr)
        sum += value
        if (value >= threshold) above += 1
        n += 1
      }
    }
    return n > 0 ? { mean: round4(sum / n), inked: round4(above / n) } : { mean: 0, inked: 0 }
  }

  /** The same zone read, clamped to the raster instead of the scan band: the
   *  census-anchored window reaches ~1.05r past the last tap and must never be
   *  clipped by `scanHi` (about 0.94 dw on a 1080 sheet). */
  const zoneReadRaster = (
    read: (x: number, cr: number) => number,
    threshold: number,
    x0: number,
    x1: number,
  ): { mean: number; inked: number } => {
    const lo = Math.max(0, Math.round(x0))
    const hi = Math.min(dw - 1, Math.round(x1))
    if (hi <= lo) return { mean: 0, inked: 0 }
    let sum = 0
    let above = 0
    let n = 0
    for (const gy of markRows) {
      const cr = dh - 1 - gy
      for (let x = lo; x <= hi; x += 1) {
        const value = read(x, cr)
        sum += value
        if (value >= threshold) above += 1
        n += 1
      }
    }
    return n > 0 ? { mean: round4(sum / n), inked: round4(above / n) } : { mean: 0, inked: 0 }
  }

  // TASK 2 (FROZEN 2026-11-25): the declared census-anchored window. The
  // anchor is the LAST recorded dab — the catch-up included on the live lanes,
  // the final scripted sample on the bake. `taps` carries fractions of the
  // document width (stampScripted's own x); multiply by dw for raster px.
  const lastTap = taps[taps.length - 1]
  if (lastTap === undefined) {
    throw new Error(
      'bristle-end: no census tap to anchor the density window (the shared census must record every stampScripted dab)',
    )
  }
  const lastTapX = round2(lastTap.x * dw)
  const radiusPx = round2(strokeSize / 2)
  const windowLo = Math.max(0, lastTapX - 2.4 * radiusPx)
  const windowHi = Math.min(dw - 1, lastTapX + 1.05 * radiusPx)
  // The visible-composite, carried-pigment, inked-fraction and raw-transparent
  // readings of the SAME two zones. `COVERAGE_INKED_THRESHOLD` is the coverage
  // raster's own 0.5 inked line; pigment and visible reuse the transparent
  // darkness threshold on their own readers so "inked" means the same thing on
  // every surface.
  const COVERAGE_INKED_THRESHOLD = 0.5
  const densityZones = {
    transparent: {
      body: zoneReadRaster(dark, END_DARK_THRESHOLD, bodyLo, bodyHi),
      end: zoneReadRaster(dark, END_DARK_THRESHOLD, windowLo, windowHi),
    },
    pigment: {
      body: zoneReadRaster(pigmentDark, END_DARK_THRESHOLD, bodyLo, bodyHi),
      end: zoneReadRaster(pigmentDark, END_DARK_THRESHOLD, windowLo, windowHi),
    },
    coverage: {
      body: zoneReadRaster(coverageInk, COVERAGE_INKED_THRESHOLD, bodyLo, bodyHi),
      end: zoneReadRaster(coverageInk, COVERAGE_INKED_THRESHOLD, windowLo, windowHi),
    },
    visible: {
      body: zoneReadRaster(visibleDark, END_DARK_THRESHOLD, bodyLo, bodyHi),
      end: zoneReadRaster(visibleDark, END_DARK_THRESHOLD, windowLo, windowHi),
    },
  }
  // The effective sampling factor the stroke actually ran at — the canonical
  // Size round-trips through the engine-scale law (`toEngineParams`' own
  // projection) so the report names the factor the dab chain used, never a
  // nominal size that would read 1x at 50/70/80 alike.
  const effectiveSampleScale = round4(
    bristleSampleScale(engineScaleToSize(sizeToEngineScale(strokeSize))),
  )

  return {
    bandPx: LINE_BAND_PX,
    markRows: markRows.length,
    threshold: END_DARK_THRESHOLD,
    bodyDark: round4(bodyDarkness),
    start: {
      ...endEdgeStats(starts),
      zoneDark: round4(startDarkness),
      contrastDelta: round4(startDarkness - bodyDarkness),
    },
    end: {
      ...endEdgeStats(ends),
      zoneDark: round4(endDarkness),
      contrastDelta: round4(endDarkness - bodyDarkness),
    },
    thickness: {
      start10: thickness(startMedian, startMedian + window(0.1)),
      start25: thickness(startMedian, startMedian + window(0.25)),
      start50: thickness(startMedian, startMedian + window(0.5)),
      body: thickness(startMedian + window(0.45), startMedian + window(0.55)),
      end50: thickness(endMedian - window(0.5), endMedian),
      end25: thickness(endMedian - window(0.25), endMedian),
      end10: thickness(endMedian - window(0.1), endMedian),
    },
    startProfilePx: starts,
    endProfilePx: ends,
    endAlongDark,
    startAlongDark,
    endFine,
    density: {
      window: {
        lastTapX,
        radiusPx,
        lo: round2(windowLo),
        hi: round2(windowHi),
        widthPx: round2(windowHi - windowLo),
      },
      effectiveSampleScale,
      zones: densityZones,
    },
  }
}

/** A 2x nearest-neighbour crop of the transparent export on white, so the
 *  start/end silhouettes are a viewable artifact beside the numbers. */
function endCrop(transparent: HTMLCanvasElement, xFrom: number, xTo: number): string {
  const dh = transparent.height
  const centre = Math.round(END_LANE_Y * dh)
  const gyCentre = dh - 1 - centre
  const y0 = Math.max(0, gyCentre - LINE_BAND_PX)
  const y1 = Math.min(dh, gyCentre + LINE_BAND_PX + 1)
  const x0 = Math.max(0, Math.round(xFrom))
  const x1 = Math.min(transparent.width, Math.round(xTo))
  const out = document.createElement('canvas')
  out.width = (x1 - x0) * 2
  out.height = (y1 - y0) * 2
  const ctx = out.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(transparent, x0, y0, x1 - x0, y1 - y0, 0, 0, out.width, out.height)
  return out.toDataURL('image/png')
}

/** The crop windows: the last / first ~2.4 brush widths of travel. */
function endCropWindow(dw: number): { start: [number, number]; end: [number, number] } {
  const x0 = Math.round(END_X0 * dw)
  const x1 = Math.round(END_X1 * dw)
  return {
    start: [x0 - END_CROP_MARGIN, x0 - END_CROP_MARGIN + END_CROP_W],
    end: [x1 - END_CROP_W + END_CROP_MARGIN, x1 + END_CROP_MARGIN],
  }
}

/** The re-bake lane's script entry — the `stop` sequence's recorded points,
 *  fed through the adapter's scripted path. Live drives contribute no entry. */
function bristleEndScript(drive: EndDrive, body: number, strokeSize: number, setup: EndSetup): readonly ScriptEntry[] {
  if (drive !== 'bake') return []
  return [
    {
      color: END_COLOR,
      points: endBakePoints(setup),
      mutationId: readEndMut(),
      params: bristleLineParams(body, strokeSize, setup),
      // quick 261125-rtc: the same artist brush the live lane drives.
      brushId: 'bristle-round',
    },
  ]
}

// --- 64-29 the texture-tip A/B ------------------------------------------------
//
// Acceptance ask (better-acrylic.md gap 5): the acrylic bristle tip must be
// FORGEABLE by a registered mask, not only by the procedural tip. The A/B is
// two captures of the SAME artist line (the bristle-line geometry), one plain
// and one stamped through a deterministic mask registered under
// `probe/tip-ab`. The mask is generated by index arithmetic only — a fixed
// stripe pattern of horizontal bands (mask rows) at the exact byte length the
// registry accepts — so it is bit-identical on every run and machine, and its
// bands survive the tip's row flip either way up. The stripes vary along the
// tip's CROSS axis (mask rows → the tip's v), so the INTENT is several dark
// bands across the stroke against the plain dab's one. That difference is
// what `tipBands` measures, and what makes the A/B a test of tip composition
// instead of a digest difference that any engine change could produce.
//
// HEAD STATE (2026-11-22, measured): the mask registers and the masked
// capture differs from the plain one, but the across profile stays a single
// hump — a uniformly attenuated copy of the plain profile (~6 % at the core),
// `tipBands` 1 on both legs. Tried row stripes at periods 64 and 256 and
// column stripes at 64: all resolve to 1 band. Whether the gather averages
// the sample away or the across axis never reaches the stripe axis is 64-35's
// diagnosis; this is its FINDING, recorded here (and in compare.mjs's band
// bar), never fixed by touching engine code from this plan.
//
// The registry call is the shipped `registerMask`, whose length contract
// (`TIP_MASK_BYTES`) is the only guard between this probe CLI and the engine
// tip cache (T-64-100). A refused registration is a loud throw, never a
// silently untextured capture.
const TIP_PROBE_ID = 'probe/tip-ab'
/** Stripe geometry on the 512-px mask: 64-row period, half duty → eight
 *  dark bands across the full tip square. The period is deliberately coarse
 *  (the tip's q spans the whole texture across the dab); see the HEAD STATE
 *  block above: at HEAD no period resolves, and the comparator's band bar
 *  reports that rather than a digest-only difference. */
const TIP_PROBE_PERIOD = 64
const TIP_PROBE_DUTY = 32
/** A run must reach this fraction of the across profile's peak to count as a
 *  dark band. Half the peak is the same edge threshold the census's 50 %
 *  crossing uses, so "a band" means "a stretch the eye would read as paint". */
const TIP_BAND_FRACTION = 0.5
/** The requested texture id, read once from the page query (like LINE_BAND_PX)
 *  and consumed by the single-entry scenario builder. */
let TIP_TEXTURE: string | undefined

/** The deterministic probe mask: horizontal stripes, rows only, no time or
 *  randomness anywhere. Exactly `TIP_MASK_BYTES` (512 × 512). */
function probeTipMask(): Uint8Array {
  const mask = new Uint8Array(TIP_MASK_BYTES)
  for (let row = 0; row < TIP_MASK_EDGE; row += 1) {
    const value = row % TIP_PROBE_PERIOD < TIP_PROBE_DUTY ? 255 : 0
    mask.fill(value, row * TIP_MASK_EDGE, (row + 1) * TIP_MASK_EDGE)
  }
  return mask
}

/** Register the probe mask BEFORE the first stroke. The registry's boolean is
 *  the whole contract: false means the bytes never reached it, and a capture
 *  that cannot be textured must fail here instead of photographing the
 *  fallback and calling it the mask. */
function registerProbeTip(): void {
  if (!registerMask(TIP_PROBE_ID, probeTipMask())) {
    throw new Error(
      `bristle-tip: registerMask refused "${TIP_PROBE_ID}" (expected ${TIP_MASK_BYTES} bytes)`,
    )
  }
}

/** 64-29: the single bristle line the A/B paints, at the artist's acrylic bag
 *  (Body 0, the canonical stroke size). The ONLY variable between captures is
 *  the requested texture id. The Pickup global rides the entry's own field so
 *  the bag echo records it — the acrylic record's value, never a new one. */
function bristleTipScript(): readonly ScriptEntry[] {
  const params = bristleLineParams(0, STROKE_PARAMS['size']!)
  return [
    {
      color: LINE_COLOR,
      points: straightLine(LINE_Y),
      mutationId: LINE_MUTATION_ID,
      brushId: 'bristle-flat',
      params,
      ...(params['pickup'] !== undefined ? { pickup: params['pickup'] } : {}),
      ...(TIP_TEXTURE === undefined ? {} : { textureId: TIP_TEXTURE }),
    },
  ]
}

/** The `--texture` operand; absent means the plain response tip. Any non-empty
 *  id is passed through UNCHANGED — an id the registry does not know must
 *  reach the engine so its fallback is observable, never papered over here. */
function readTipTexture(): string | undefined {
  const raw = new URLSearchParams(location.search).get('texture')
  if (raw === null || raw === '') return undefined
  return raw
}

/**
 * 64-29: the band metric over one across profile — the same stations the line
 * census uses (`lineProfileSet`'s offsets and `across.dark`). Runs of
 * consecutive stations at or above half the profile peak are dark bands; the
 * median light gap between consecutive runs (in document pixels) says whether
 * they are SEPARATED structure or one stippled mass. A plain bristle line
 * reads one band (its core); a stripes-forged mask reads several. Zeros stand
 * for a blank profile, which the comparator refuses.
 */
function acrossBandStats(
  offsets: readonly number[],
  values: readonly number[],
): { bands: number; gapPx: number } {
  let peak = 0
  for (const value of values) peak = Math.max(peak, value)
  if (!(peak > 0)) return { bands: 0, gapPx: 0 }
  const threshold = peak * TIP_BAND_FRACTION
  const runs: Array<{ start: number; end: number }> = []
  let start: number | null = null
  for (let i = 0; i < values.length; i += 1) {
    const above = values[i]! >= threshold
    if (above && start === null) start = offsets[i]!
    if (!above && start !== null) {
      runs.push({ start, end: offsets[i - 1]! })
      start = null
    }
  }
  if (start !== null && offsets.length > 0) {
    runs.push({ start, end: offsets[offsets.length - 1]! })
  }
  const gaps: number[] = []
  for (let i = 1; i < runs.length; i += 1) gaps.push(runs[i]!.start - runs[i - 1]!.end)
  return { bands: runs.length, gapPx: median(gaps) }
}

/**
 * 64-29: the A/B report. Every echo is read off the SAME stroke record the
 * engine received (`makeStroke(script[0])`), and `tipMix` is resolved through
 * the engine's own brush projection (`buildBrushForStroke`), whose law is
 * "the texture id rides the brush ONLY when a mask supplied the bytes". An
 * unknown id therefore reports carried === requested with tipMix 0 plus a
 * named note — the fallback is measured, never trusted as a success.
 */
function bristleTipReport(
  engine: WatercolorEngine,
  script: readonly ScriptEntry[],
): Record<string, unknown> {
  const entry = script[0]
  if (!entry) throw new Error('bristle-tip: the scenario has no script entry')
  const stroke = makeStroke(entry)
  const carried = stroke.engine.textureId ?? null
  const requested = TIP_TEXTURE ?? null
  const brush = buildBrushForStroke(
    stroke.engine.brushId,
    carried === null ? null : { textureId: carried },
  )
  const mix = carried !== null && brush.textureId === carried ? 1 : 0
  const profile = lineProfileSet(engine)
  const stats = acrossBandStats(
    profile['offsets'] as readonly number[],
    (profile['across'] as { dark: readonly number[] }).dark,
  )
  const note =
    carried !== null && mix === 0
      ? `unknown texture "${carried}": the engine falls back to the response tip (tipMix 0)`
      : null
  return {
    tipRequestedId: requested,
    tipTextureId: carried,
    tipMix: mix,
    tipBands: stats.bands,
    tipGapPx: round2(stats.gapPx),
    tipNote: note,
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
  strokeSize: number = STROKE_PARAMS['size']!,
): void {
  if (!COLD) throw new Error("paper preset 'cold' is not in PAPERS")
  // 64-16: the resolved brush — the operand when given, `chalk` as the
  // textured-tip scenario's documented default, `bristle-flat` for 64-29's
  // texture-tip A/B, otherwise nothing. The report echoes THIS value, so a
  // run that passed `--brush` can never print null.
  // quick 261125-rtc: `bristle-line` and `bristle-end` resolve to
  // `bristle-round` — the artist's acrylic brush. `bristle-flat` was retired
  // by 261124-iq9 and silently resolved to the watercolor `round`, so those
  // two scenarios were photographing the classic path, never the bristle one.
  const resolvedBrush =
    brush ??
    (scenario === 'cover-textured'
      ? 'chalk'
      : scenario === 'bristle-tip'
        ? 'bristle-flat'
        : scenario === 'bristle-line' || scenario === 'bristle-end'
          ? 'bristle-round'
          : undefined)
  // bristle-end: which end path this capture drives. Read before any stroke
  // runs, so an operand the probe refuses can never leave a half-painted
  // sheet behind.
  const endDrive = scenario === 'bristle-end' ? readEndDrive() : undefined
  // bristle-end: the dry / feather / release operands, validated in one place
  // (dry and feather 0..100, release 0..1 and stop/bake only).
  const endSetup: EndSetup = scenario === 'bristle-end' ? readEndSetup(endDrive) : NO_END_SETUP
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
                        : scenario === 'bristle-line'
                          ? bristleLineScript(body ?? 0, strokeSize, readMut(), readOver())
                          : scenario === 'bristle-tip'
                            ? bristleTipScript()
                            : scenario === 'bristle-end'
                              ? bristleEndScript(endDrive ?? 'stop', body ?? 100, strokeSize, endSetup)
                              : scenario === 'emboss-smooth'
                                ? embossSmoothScript(emboss ?? -15, resolvedBrush)
                                : scenario === 'edge-layer'
                                  ? edgeLayerScript()
                                  : neutralScript(emboss, body)

  // 261119-pod (D-F): the scene-parameter echo — `dry` appears in the report
  // only when a script pins it, so every capture records the calibration and a
  // blank render can never be misread as the engine's look.
  const dryEcho = script.find((entry) => entry.dry !== undefined)?.dry

  // 64-29: the A/B's mask must be in the registry BEFORE the first stroke —
  // the adapter resolves the tip once per stroke, not per frame. A refused
  // registration throws out of run(), so a capture can never photograph the
  // fallback and call it the mask.
  if (scenario === 'bristle-tip') registerProbeTip()

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
    // bristle-line: the same profile set at the three drive surfaces. Each is
    // profiled from the engine's own readbacks, so its wall clock is capture
    // time (subtracted from bakeMs), never medium cost.
    const lineSurfaces: Record<string, unknown> = {}
    const lineCapture = (surface: string) => {
      if (scenario !== 'bristle-line') return
      const start = performance.now()
      lineSurfaces[surface] = lineProfileSet(engine)
      captureMs += performance.now() - start
    }
    // quick 261123-hr5: the signed-emboss readings — the impasto's band and the
    // smoothing pass's band, each taken after its own fix so the relation
    // compares settled surfaces. Probe-only readbacks: capture cost, not medium.
    const reliefSmooth: Record<string, number> = {}
    const reliefCapture = (surface: 'before' | 'after') => {
      if (scenario !== 'emboss-smooth') return
      const start = performance.now()
      const stats = reliefBandStats(engine, sheet, EMBOSS_SMOOTH_BOX)
      const pigmentMean = bandPigment(engine.exportCanvas('transparent'), EMBOSS_SMOOTH_BOX)
      captureMs += performance.now() - start
      const cap = surface === 'before' ? 'Before' : 'After'
      reliefSmooth[`reliefMean${cap}`] = round4(stats.mean)
      reliefSmooth[`reliefPeak${cap}`] = round4(stats.peak)
      reliefSmooth[`pigmentMean${cap}`] = round4(pigmentMean)
    }
    // bristle-end: the LIVE end paths drive the captured engine directly (the
    // adapter has no live pointer seam); the re-bake drive rides the normal
    // script loop below. Written after the bakeStart mark so the drive's wall
    // clock is part of bakeMs, like every other scenario's script.
    //
    // quick 261125-rtc: ONE shared tap + gather census, installed BEFORE the
    // drive branch, so it spans the live drive AND the re-bake lane's scripted
    // feed (the adapter's applyStroke loop runs the same engine). Both lanes
    // emit a populated census — a bake capture can no longer print null and
    // pretend the gather never ran.
    let endCensus: EndCensusRecorder | undefined
    if (scenario === 'bristle-end') {
      const census: EndCensusRecorder = { taps: [], tapCount: 0, gatherCalls: 0, endCapCalls: 0 }
      const censusEngine = engine as unknown as {
        stampScripted: (s: unknown, x: number, y: number, pr: number, ...rest: unknown[]) => unknown
        bristleInk: (...args: unknown[]) => void
      }
      const liveFlags = engine as unknown as { bristleEndCap: boolean }
      const stampOriginal = censusEngine.stampScripted
      censusEngine.stampScripted = function (
        this: unknown,
        s: unknown,
        x: number,
        y: number,
        pr: number,
        ...rest: unknown[]
      ) {
        census.tapCount += 1
        census.taps.push({ x: round4(x), y: round4(y), pr: round4(pr), endCap: liveFlags.bristleEndCap })
        if (census.taps.length > 40) census.taps.shift()
        return stampOriginal.apply(this, [s, x, y, pr, ...rest])
      }
      const inkOriginal = censusEngine.bristleInk
      censusEngine.bristleInk = function (this: unknown, ...args: unknown[]) {
        census.gatherCalls += 1
        if (args[8] === true) census.endCapCalls += 1
        return inkOriginal.apply(this, args)
      }
      endCensus = census
      if (endDrive !== undefined && endDrive !== 'bake') {
        driveBristleEnd(adapter, engine, endDrive, body ?? 100, strokeSize, endSetup, census)
      }
    }
    // Spec 10: the edge-layer visit's own drive. Each stroke is fed to
    // EDGE_LAYER_PARTIAL, read while it is still OPEN (the layer, the sheet it
    // has not touched yet, the structural counters), then completed so its
    // stroke-end merge runs — the engine calls are `applyStroke`'s verbatim
    // (feedDueSample + one trailing clock+tick), only split. The split is the
    // single way to read a layer before the merge clears it; the replay gate
    // below proves the split drive and the one-shot drive agree byte for byte.
    const edgeCaptures: { a: EdgeStrokeCapture | null; b: EdgeStrokeCapture | null } = { a: null, b: null }
    // Spec 10: the engine's `mergeDraws` counter is CUMULATIVE for the engine's
    // life, so the structural gate reads a per-stroke DELTA — measured around
    // each stroke's own completion (with the capture taken mid-stroke, before
    // its merge, inside the same loop iteration).
    const edgeMergeDeltas: number[] = []
    // Task 5: the merge's own wall clock. Every merge is timed (only the
    // `baseMerge` call itself — never the probe's own read-backs); the visit's
    // first two entries are reported as the per-stroke cost.
    const mergeTimes: number[] = []
    if (scenario === 'edge-layer') {
      pinStrokeStart(engine)
      // Spec 10: the merge-time instrument (EdgeMergeSide). Installed before
      // the first stroke; each merge pushes its pre/post pair in stroke order,
      // and the drive loop attaches it to that stroke's capture below.
      const mergePaperRect = edgeLayerRect(sheet, 'paper')
      const mergeUnderRect = edgeLayerRect(sheet, 'under')
      const mergeSnapshots: Array<{
        preSheet: { paper: EdgeDocFields; under: EdgeDocFields }
        preLayer: { paper: EdgeLayerFields | null; under: EdgeLayerFields | null }
        postSheet: { paper: EdgeDocFields; under: EdgeDocFields }
        preTouch: number | null
        postTouch: number | null
      }> = []
      const mergeHost = engine as unknown as {
        mergeStrokeLayer: (rect: EdgeRect) => void
        dw: number
        dh: number
      }
      const baseMerge = mergeHost.mergeStrokeLayer.bind(engine)
      mergeHost.mergeStrokeLayer = (rect: EdgeRect) => {
        // The Studio rows resize/create the document AFTER the visit, and a
        // merge there lands outside the visit's read rects (`gl.readHalf`
        // throws on an out-of-bounds read). Time it, skip the read-backs.
        const inBounds = mergeHost.dw === sheet && mergeHost.dh === sheet
        if (!inBounds) {
          const start = performance.now()
          baseMerge(rect)
          mergeTimes.push(performance.now() - start)
          return
        }
        const preSheet = {
          paper: readEdgeDocFields(engine, sheet, mergePaperRect),
          under: readEdgeDocFields(engine, sheet, mergeUnderRect),
        }
        const preLayer = {
          paper: readEdgeLayerFields(engine, sheet, mergePaperRect),
          under: readEdgeLayerFields(engine, sheet, mergeUnderRect),
        }
        // WR-01: the last-touch lane over the merge's own rect, before and
        // after — the behavioural proof that the stroke-end merge stamps the
        // merged region (an unstamped merge leaves the pair equal).
        const preTouch = edgeTouchMax(engine, rect)
        const start = performance.now()
        baseMerge(rect)
        mergeTimes.push(performance.now() - start)
        const postTouch = edgeTouchMax(engine, rect)
        const postSheet = {
          paper: readEdgeDocFields(engine, sheet, mergePaperRect),
          under: readEdgeDocFields(engine, sheet, mergeUnderRect),
        }
        mergeSnapshots.push({ preSheet, preLayer, postSheet, preTouch, postTouch })
      }
      for (const entry of script) {
        const stroke = makeStroke(entry)
        const partial = Math.max(2, Math.floor(stroke.pts.length * EDGE_LAYER_PARTIAL))
        adapter.renderPartialStrokes([{ stroke, pointCount: partial }])
        const edgeInternals = engine as unknown as EdgeLayerInternals
        const drawsBefore = typeof edgeInternals.mergeDraws === 'number' ? edgeInternals.mergeDraws : null
        const side = entry.captureEdge
        if (side !== undefined) {
          const captureStart = performance.now()
          edgeCaptures[side] = captureEdgeStroke(engine, sheet, side)
          captureMs += performance.now() - captureStart
        }
        adapter.renderPartialStrokes([{ stroke, pointCount: Number.MAX_SAFE_INTEGER }])
        // The `applyStroke` tail: one clock step + one engine tick, exactly.
        // That tick runs the end-cap dab and the stroke's ONE merge.
        adapter.stepTick(0)
        const snap = mergeSnapshots[mergeSnapshots.length - 1]
        if (side !== undefined && edgeCaptures[side] !== null && snap !== undefined) {
          const pick = side === 'a' ? 'paper' : 'under'
          edgeCaptures[side] = {
            ...edgeCaptures[side]!,
            merge: {
              preSheet: snap.preSheet[pick],
              preLayer: snap.preLayer[pick],
              postSheet: snap.postSheet[pick],
              preTouch: snap.preTouch,
              postTouch: snap.postTouch,
            },
          }
        }
        const settle = entry.settle ?? SETTLE_TICKS
        for (let tick = 0; tick <= settle; tick += 1) adapter.stepTick(tick)
        adapter.fix()
        const drawsAfter = typeof edgeInternals.mergeDraws === 'number' ? edgeInternals.mergeDraws : null
        if (drawsBefore !== null && drawsAfter !== null) edgeMergeDeltas.push(drawsAfter - drawsBefore)
      }
    }
    script.forEach((entry, index) => {
      // Spec 10: the edge-layer visit drives its own split strokes above (the
      // only way to read a layer before the stroke-end merge clears it), so
      // the shared loop is a no-op here — never a second drive.
      if (scenario === 'edge-layer') return
      // 64-24: the acceptance's clock-only age — the virtual clock moves, the
      // fluid does not, so "thirty seconds old" and "just re-wetted" are
      // independent facts. Applied BEFORE the entry, so the entry's own dabs
      // read (and stamp) the advanced time.
      if (entry.advanceClockMs !== undefined) adapter.advanceClock(entry.advanceClockMs)
      adapter.applyStroke(makeStroke(entry))
      // bristle-line: the BAKE surface — the whole stroke has landed and its
      // one tick has run; no settle, no fix yet.
      if (entry.captureLine) lineCapture('postApply')
      // 64-17: per-entry settle (ticks 0..settle, default SETTLE_TICKS); the
      // rapid entries of the 50-stroke passage settle in ONE tick each.
      const settle = entry.settle ?? SETTLE_TICKS
      for (let tick = 0; tick <= settle; tick += 1) adapter.stepTick(tick)
      // bristle-line: the SETTLED surface — the fluid has run its wet ticks.
      if (entry.captureLine) lineCapture('postSettle')
      // 64-14: the advect gate reads the cover channel mid-script. The pre-read
      // happens while the covering stroke is still wet (its entry carries
      // `fixAfter: false`); ADVECT_TICKS extra wet ticks then run and the
      // post-read follows — the medium is the only thing that moved.
      if (entry.captureCover === 'advect') {
        const captureStart = performance.now()
        // 64-31: the coverage channel is the coverage raster, read directly —
        // never re-derived from any export's alpha.
        const before = coverageStats(engine.exportCanvas('coverage'), COVER_LIFECYCLE_BOXES.crossing)
        for (let tick = 0; tick < ADVECT_TICKS; tick += 1) adapter.stepTick(tick)
        const advectedTransparent = engine.exportCanvas('transparent')
        const advectedCoverage = engine.exportCanvas('coverage')
        const advectedPigment = engine.exportCanvas('pigment')
        const after = coverageStats(advectedCoverage, COVER_LIFECYCLE_BOXES.crossing)
        captureMs += performance.now() - captureStart
        coverLifecycle['coverCoverageBeforeAdvect'] = round2(before.mean)
        coverLifecycle['coverCoveragePeakBefore'] = round2(before.peak)
        coverLifecycle['coverCoverageAfterAdvect'] = round2(after.mean)
        coverLifecycle['coverCoveragePeakAfter'] = round2(after.peak)
        coverLifecycle['coveredPaperWhitePct'] = round2(
          coveredPaperWhitePct(advectedTransparent, advectedPigment, 0.5),
        )
      }
      // quick-261117-tq7: `fixAfter: false` skips the settle so the stroke
      // stays mobile `ink`, the cover-over-wet underlayer.
      if (entry.fixAfter !== false) adapter.fix()
      // bristle-line: the DRY surface — the display's own settled field.
      if (entry.captureLine) lineCapture('postFix')
      // quick 261123-hr5: read the signed-emboss band after this entry settled
      // and fixed, so the two readings differ by the erode pass alone.
      if (entry.captureRelief !== undefined) reliefCapture(entry.captureRelief)
      // 64-14: the lift gate reads the crossing after the entry's own fix, so
      // the field it measures is the one the display reads.
      if (entry.captureCover === 'beforeLift' || entry.captureCover === 'afterLift') {
        const captureStart = performance.now()
        const transparent = engine.exportCanvas('transparent')
        // 64-31: Lift destroys COVERAGE, so the reading is the coverage
        // raster's, never a pigment export's alpha.
        const coverage = engine.exportCanvas('coverage')
        // The paper-white census rides the engine-cleared pigment alpha (CR-02).
        const pigment = engine.exportCanvas('pigment')
        const stats = coverageStats(coverage, COVER_LIFECYCLE_BOXES.crossing)
        captureMs += performance.now() - captureStart
        if (entry.captureCover === 'beforeLift') {
          coverLifecycle['coverCoverageBeforeLift'] = round2(stats.mean)
        } else {
          coverLifecycle['coverCoverageAfterLift'] = round2(stats.mean)
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

    // 64-10: renderMs is the render phase proper — the four exports through
    // the display shader plus their readbacks — recorded beside the digests so
    // a body pair reports both halves of the cost (bake + render). Durations
    // are reported, never tuned into the law. 64-31 adds the coverage raster
    // export: a probe-only instrument readback (no draw, no pass, no document
    // target), so it is capture cost like the other readbacks.
    const renderStart = performance.now()
    const paperCanvas = engine.exportCanvas('paper')
    const transparentCanvas = engine.exportCanvas('transparent')
    const whiteCanvas = engine.exportCanvas('white')
    // 64-17: the mode-4 display sheet. Since the 2026-11-21 law its alpha is
    // the pigment's darkness alone — it carries NO coverage term. The coverage
    // claims below read `coverageCanvas`, never this export's alpha.
    const pigmentCanvas = engine.exportCanvas('pigment')
    // 64-31: the coverage raster, captured once beside the other surfaces.
    const coverageCanvas = engine.exportCanvas('coverage')
    const paper = digestCanvas(paperCanvas)
    const transparent = digestCanvas(transparentCanvas)
    const white = digestCanvas(whiteCanvas)
    const pigment = digestCanvas(pigmentCanvas)
    const renderMs = Math.round(performance.now() - renderStart)

    // 64-31: the shipped law is checked on the capture, not only narrated.
    // Both halves read the buffers digestCanvas just read — no extra export.
    const opaqueExport = opaqueExportCheck([
      { surface: 'paper', pixels: paper.pixels },
      { surface: 'white', pixels: white.pixels },
      { surface: 'transparent', pixels: transparent.pixels },
    ])
    // Spec 10: `edge-layer` is a bristle scene (bristle-round, Body 100) and
    // carries the same film-blur exclusion. The comparator's alpha-law
    // predicate carries the identical two-clause test; the two must agree.
    const visibleAlpha =
      scenario.startsWith('bristle-') || scenario === 'edge-layer'
        ? visibleAlphaSkipped(BRISTLE_VISIBLE_ALPHA_SKIP)
        : visibleAlphaCheck(pigment.pixels, transparent.pixels, sheet)

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
      scenario === 'white-over-blue'
        ? whiteOverBlueMetrics(transparentCanvas, coverageCanvas, pigmentCanvas)
        : {}

    // 64-16: the textured-tip spread, only for its scenario, so every other
    // report shape is unchanged. 64-31: the spread reads the coverage raster;
    // the pigment export stays the source of its own RGB readings.
    const coverTexturedReport =
      scenario === 'cover-textured'
        ? coverTexturedMetrics(transparentCanvas, pigmentCanvas, coverageCanvas)
        : {}

    // 64-16: Spike 001 criterion 2 — luma, hue and paper-white, only for its
    // scenario, so every other report shape is unchanged. 64-31: the
    // paper-white scan's covered set is the coverage raster.
    const redOverBlueReport =
      scenario === 'red-over-blue-50'
        ? redOverBlueMetrics(transparentCanvas, pigmentCanvas, coverageCanvas)
        : {}

    // 64-23: the bristle-edge census — the two strokes' measured edge
    // softness and variation, only for its scenario, so every other report
    // shape is unchanged.
    const bristleEdgeReport =
      scenario === 'bristle-edge' ? bristleEdgeMetrics(transparentCanvas) : {}

    // 64-24: the wetness acceptance's two readings, only for its scenario, so
    // every other report shape is unchanged.
    const bristleWetReport =
      scenario === 'bristle-wet' ? bristleWetMetrics(transparentCanvas) : {}

    // bristle-line (2026-11-22): the artist's exact bag is echoed so the
    // Body-0-versus-record-100 mismatch is a recorded fact of every capture,
    // and the three surfaces' profiles ride the report beside the PNGs the
    // run script writes to disk. Only this scenario emits them.
    const lineReport =
      scenario === 'bristle-line'
        ? {
            paramsEcho: paramsBag(script.find((entry) => entry.captureLine) ?? script[0]!),
            lineBodyOverride: body ?? 0,
            recordBody: MEDIUMS.find((medium) => medium.id === 'acrylic')?.params.body ?? null,
            lineSurfaces,
            bristleDump: bristleReservoir(engine),
            pngTransparent: transparentCanvas.toDataURL('image/png'),
            pngCoverage: engine.exportCanvas('coverage').toDataURL('image/png'),
            pngPigment: pigmentCanvas.toDataURL('image/png'),
          }
        : {}

    // bristle-end (2026-11-23): the end-region census and its two 2x crops.
    // Only this scenario emits them, so every other report shape is unchanged.
    // quick 261125-rtc: the census is the ONE shared install, so a bake capture
    // prints populated taps and its own drive name exactly like a live one —
    // and the gather block is the proof the real bristle path ran on both.
    const bristleEndReport =
      scenario === 'bristle-end'
        ? {
            endDrive: endDrive ?? 'stop',
            endSetup: {
              dry: endSetup.dry,
              feather: endSetup.feather,
              release: endSetup.release,
              strokeSize,
              brush: resolvedBrush ?? null,
            },
            endCensus: {
              drive: endDrive ?? 'stop',
              taps: endCensus?.tapCount ?? 0,
              endCaps: endCensus?.endCapCalls ?? 0,
              last40: endCensus?.taps ?? [],
            },
            gather: {
              calls: endCensus?.gatherCalls ?? 0,
              endCapCalls: endCensus?.endCapCalls ?? 0,
            },
            endMetrics: bristleEndMetrics(
              transparentCanvas,
              pigmentCanvas,
              coverageCanvas,
              strokeSize,
              endCensus?.taps ?? [],
            ),
            pngTransparent: transparentCanvas.toDataURL('image/png'),
            pngCoverage: coverageCanvas.toDataURL('image/png'),
            pngPigment: pigmentCanvas.toDataURL('image/png'),
            pngStart: endCrop(transparentCanvas, ...endCropWindow(transparentCanvas.width).start),
            pngEnd: endCrop(transparentCanvas, ...endCropWindow(transparentCanvas.width).end),
            // The same end crop in the engine's own channels, so a terminal
            // contrast step can be attributed to coverage, pigment or display.
            pngEndPigment: endCrop(pigmentCanvas, ...endCropWindow(pigmentCanvas.width).end),
            pngEndCoverage: endCrop(coverageCanvas, ...endCropWindow(coverageCanvas.width).end),
          }
        : {}

    // 64-29: the texture-tip A/B echoes, only for its scenario, so every other
    // report shape is unchanged (the bristle-line PNG block above stays inert).
    const tipReport = scenario === 'bristle-tip' ? bristleTipReport(engine, script) : {}

    // quick 261123-hr5: the signed-emboss smoothing relation's six readings
    // plus the smooth value the second entry carried, only for its scenario,
    // so every other report shape is unchanged.
    const embossSmoothReport =
      scenario === 'emboss-smooth'
        ? {
            smoothEmboss: emboss ?? -15,
            ...reliefSmooth,
            pngTransparent: transparentCanvas.toDataURL('image/png'),
          }
        : {}

    // Spec 10: the edge-layer readings, only for this scenario, so every other
    // report shape is unchanged. Last, because its capture round trip and its
    // replay both move engine state — after every export digest above, nothing
    // this capture reports can be perturbed by them.
    const edgeReport =
      scenario === 'edge-layer'
        ? edgeLayerVisitReport(
            adapter,
            engine,
            sheet,
            script,
            edgeCaptures,
            edgeMergeDeltas,
            mergeTimes,
            transparentCanvas,
            transparent.digest,
            transparent.pixels,
          )
        : {}

    writeResult({
      gate,
      scenario,
      brush: resolvedBrush ?? null,
      emboss: emboss ?? null,
      body: body ?? null,
      light: light ?? null,
      wetMode,
      ...(dryEcho !== undefined ? { dry: dryEcho } : {}),
      bakeMs,
      renderMs,
      width: sheet,
      height: sheet,
      digestPaper: paper.digest,
      digestTransparent: transparent.digest,
      digestWhite: white.digest,
      digestPigment: pigment.digest,
      byteLength: paper.byteLength,
      opaqueExportMinAlpha: opaqueExport.minAlpha,
      opaqueExportMinAlphaSurface: opaqueExport.surface,
      ...visibleAlpha,
      ...coverRegions,
      ...whiteOverBlueReport,
      ...coverTexturedReport,
      ...redOverBlueReport,
      ...bristleEdgeReport,
      ...bristleWetReport,
      ...lineReport,
      ...bristleEndReport,
      ...tipReport,
      ...embossSmoothReport,
      ...edgeReport,
      ...coverLifecycle,
      renderer,
      verdict: 'MEDIUM-ENGINE CAPTURED',
    })
  } finally {
    adapter.dispose()
  }
}

/** 64-03: the emboss knob — absent keeps the neutral (pre-milestone) script.
 *  Quick 261123-hr5: the band is SIGNED (-100..100); for `emboss-smooth` this
 *  operand is the SMOOTH value the second entry carries. */
function readEmboss(): number | undefined {
  const raw = new URLSearchParams(location.search).get('emboss')
  if (raw === null || raw === '') return undefined
  const value = Number(raw)
  if (!Number.isFinite(value) || value < -100 || value > 100) {
    throw new Error(`invalid emboss "${raw}" (expected -100..100)`)
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
 *  `bristle-wet`, the wetness acceptance; 2026-11-22 adds `bristle-line`,
 *  the acrylic pale-line defect's three-field across profile; 64-29 adds
 *  `bristle-tip`, the texture-tip A/B; quick 261123-hr5 adds `emboss-smooth`,
 *  the signed-emboss smoothing relation; quick 261125-kvl adds `edge-layer`,
 *  the per-stroke translucent stroke layer's two-stroke scene.
 *  The closed list here and the one in run.mjs must stay literal-identical:
 *  a name accepted by the parser but unknown to the probe fails at capture,
 *  and a name the probe knows but the parser rejects can never be requested. */
function readScenario(): string {
  const raw = new URLSearchParams(location.search).get('scenario')
  if (raw === null || raw === '') return 'neutral'
  if (raw !== 'cover' && raw !== 'cover-over-wet' && raw !== 'watercolor-50' && raw !== 'white-over-blue' && raw !== 'cover-advect' && raw !== 'cover-lift' && raw !== 'cover-textured' && raw !== 'red-over-blue-50' && raw !== 'bristle-edge' && raw !== 'bristle-wet' && raw !== 'bristle-line' && raw !== 'bristle-tip' && raw !== 'bristle-end' && raw !== 'emboss-smooth' && raw !== 'edge-layer') {
    throw new Error(
      `invalid scenario "${raw}" (expected "cover", "cover-over-wet", "watercolor-50", "white-over-blue", "cover-advect", "cover-lift", "cover-textured", "red-over-blue-50", "bristle-edge", "bristle-wet", "bristle-line", "bristle-end", "emboss-smooth", "edge-layer" or "bristle-tip")`,
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
  let strokeSize = STROKE_PARAMS['size']!
  try {
    scenario = readScenario()
    // Spec 10: the two edge knobs are read before any stroke (module state),
    // and refused on any other scenario — never silently ignored.
    EDGE_LAYER_AMOUNT = readEdgeKnob('edge', scenario, EDGE_LAYER_DEFAULT_AMOUNT)
    EDGE_LAYER_FALLOFF = readEdgeKnob('falloff', scenario, EDGE_LAYER_DEFAULT_FALLOFF)
    sheet = readSize()
    brush = readBrush()
    emboss = readEmboss()
    body = readBody()
    light = readLight()
    wetMode = readWetMode()
    strokeSize = readStrokeSize()
    LINE_BAND_PX = readBand()
    TIP_TEXTURE = readTipTexture()
    renderer = probeRenderer()
    run(gate, renderer, scenario, sheet, brush, emboss, body, light, wetMode, strokeSize)
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
