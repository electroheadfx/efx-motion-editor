// ============================================================
//  port-comparison/probe.ts — the Studio half of the 261119-pod
//  reference-port acceptance harness.
//
//  SCRATCH HARNESS ONLY. One page load renders ONE scene of the
//  nine-scene table on the REAL vendored WebGL2 engine through the
//  Studio adapter, exports both the `paper` sheet (hue, fades,
//  strands) and the mode-4 `pigment` sheet (the coverage alpha the
//  body separation reads), reduces them with the shared metric
//  library (metrics.ts) IN PAGE — the rasters never cross the CDP
//  wire — and writes one JSON record into <pre id="result">.
//
//  Why: the medium-engine gate can only compare the engine against
//  itself; its committed body0/body100 records are byte-identical
//  and Body is invisible to that CLI (D-C). This harness measures
//  ABSOLUTE numbers on a rendered sheet so BEFORE (corrected gate,
//  pre-port) and AFTER (final engine) can be compared apples to
//  apples, and so the reference lab's panels can be measured with
//  the same arithmetic.
//
//  Scene table (the plan's nine scenes, verbatim — every stroke bag
//  is FULL and EXPLICIT so the engine's changing default can never
//  leak into the comparison):
//    blank      none
//    band       yellow #e8c21a band, MOBILE, settle 8, pickup 0
//    band-p0    band + cornflower #5994e4, pickup 0
//    band-p100  band + cornflower, pickup 100
//    blank-p0   cornflower, pickup 0
//    blank-f0   cornflower, pickup 100, feather 0
//    blank-f100 cornflower, pickup 100, feather 100
//    body0      cornflower, pickup 100, body 0
//    body100    cornflower, pickup 100, body 100
//  All strokes refill 0, brush bristle-flat, Feather 0 except
//  blank-f100. Every acceptance scene is Body 0; `body100` exists
//  only for the D-C separation. Both strokes run the same horizontal
//  path (0.12, 0.50) -> (0.88, 0.50); the band is never fixed, so its
//  wetness is high when the blue crosses it — the state the §3.3
//  smear law is written for.
//
//  Size calibration: RULING 2026-11-19 re-captured the reference at the
//  width that matches Studio's Feather-0 mark. The first reference capture
//  ran its cycle entry at 0.085 (25.5 px nominal) and measured blank-f0
//  6.0 px; Studio measured 10 px there, so the widening bar was comparing
//  different brush widths. `reference.mjs --width 0.131` (39.3 px nominal)
//  measures blank-f0 10 px — identical to Studio's size-4 mark — and
//  blank-f100 22 px. That capture is `captures/reference/metrics.json`.
//  The band's canonical size is the blue's times the reference's width
//  ratio 0.12 / 0.131. The chosen values and the measured half-width are
//  echoed in every record's params, and run.mjs aggregates them into the
//  capture's `calibration` block.
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
import { LAST_TOUCH_DRY_SECONDS } from '../../src/playground/bristles'
import { measureScene, type Rgba } from './metrics'

const SHEET_W = 800
const SHEET_H = 600
/** The constructor draw's pin — the same seed the gate harness uses. */
const PAPER_SEED = 0xc0ffee
const PAPER_STRENGTH = 1
/** Settle ticks after each stroke: the reference's eight 1/60 s frames. */
const SETTLE_TICKS = 8
const BAND_COLOR = '#e8c21a'
const BLUE_COLOR = '#5994e4'
const RED_COLOR = '#c8412f'
const CYAN_COLOR = '#2f9bb5'
const BRUSH_ID = 'bristle-flat'
/** The reference's cycle-entry widths (app.js palette, §6 defaults). */
// The Studio BAND's size ratio (0.12 / 0.085) comes from the reference's two
// ORIGINAL cycle entries and is a Studio calibration of its own; the blue's
// capture width was re-fitted to 0.131 by RULING 2026-11-19 (reference.mjs),
// which does not move the Studio band size.
const BAND_FRACTION = 0.12
const BLUE_FRACTION = 0.085
/**
 * Canonical blue size. RULING 2026-11-19: the comparison is made at the
 * reference width that matches this size's Feather-0 mark (0.131 → blank-f0
 * 10 px, Studio 10 px), so the shape bar compares like with like. Size 4 is
 * unchanged by the re-capture: it was fitted to the reference's measured
 * mean before the ruling and still measures 10 px on the clean blank scene.
 */
const DEFAULT_BLUE_SIZE = 4

const COLD: PaperPreset | undefined = PAPERS.find((preset) => preset.id === 'cold')
const HOT: PaperPreset | undefined = PAPERS.find((preset) => preset.id === 'hot')

// Probe-only yellow fond (2026-11-20): the artist's final bristle check on a
// warm ground. Same height field as Cold Press so the paint behaviour is
// unchanged — only the sheet colour moves.
const YELLOW: PaperPreset = {
  id: 'probe-yellow',
  name: 'Yellow',
  hint: 'Probe-only warm yellow fond',
  kind: 0,
  tint: '#e6cf72',
  fleck: '#857646',
  bump: 1,
  mottle: 0.05,
}

// --- scene table ------------------------------------------------------------

interface SceneSpec {
  readonly name: string
  readonly band: boolean
  readonly stroke: boolean
  readonly pickup: number | null
  readonly feather: number | null
  readonly body: number | null
  /** Paint Dry (0..100). Absent → the D-E census pin 0. */
  readonly dry?: number
  /** Paint Load (0..100). Absent → the shipped default 50. */
  readonly load?: number
  /** Paint Refill (0..100). Absent → the probe bag's 0. */
  readonly refill?: number
  /** Stroke colour. Absent → BLUE_COLOR. */
  readonly color?: string
  /** MEASUREMENT-ONLY: paint this many offset passes (the artist's "several strokes"). */
  readonly passes?: number
  /** MEASUREMENT-ONLY: extra bag keys (the Studio medium's values the sliders don't name). */
  readonly bagOverride?: Record<string, number>
  /** Paint Water (0..100). Absent → the probe bag's 50. */
  readonly water?: number
  /** MEASUREMENT-ONLY: the artist's two-stroke Feather study at this Feather. */
  readonly edgePair?: number
  /** MEASUREMENT-ONLY: the edge-pair scenes' pickup (default 100). */
  readonly pairPickup?: number
  /** Sheet override. Absent → Cold Press. */
  readonly paper?: PaperPreset
  /**
   * MEASUREMENT-ONLY wet-on-wet composition: a painted yellow ground, then
   * blue and red bristle strokes crossing it while it is still wet. Every
   * colour is pigment deposited by the engine — no post-composite — so the
   * mixing, if any, is the Studio paint physics.
   * `thick` is the artist's Dry 0 / Feather 75 test: a 3–4× thicker brush
   * whose strokes overlap each other as well as the wet ground. `drag` is
   * the same composition with Refill 10 — the original's "greedy brush that
   * drags colour far" lab preset — so the picked-up colour survives the
   * trip instead of being overwritten by the reservoir.
   */
  readonly mix?: 'wet' | 'thick' | 'drag' | 'thick-dry' | 'thick-dry-norefill'
  /**
   * MEASUREMENT-ONLY: the thick composition's crossing-stroke settings.
   * Absent → the rejected Dry 0 / Feather 75 / Load 90 / Refill 60 bag.
   */
  readonly mixTuning?: {
    readonly dry?: number
    readonly feather?: number
    readonly load?: number
    readonly refill?: number
  }
  /**
   * MEASUREMENT-ONLY: replay the original app's intro autopainter sequence
   * through the real engine. `m` is the nine diagonal palette strokes the
   * artist's target screenshot is built from; the paths, colours, widths and
   * speeds are copied from `app.js` (craft-brushes) rather than invented.
   */
  readonly intro?: 'm' | 'g' | 'cross' | 'pastel'
  /**
   * MEASUREMENT-ONLY: overrides the intro stroke's Load/Refill. The base
   * replay is the original's (Load 90, Refill 60). A LOWER load empties the
   * tank during the stroke (the per-bristle dry dashes switch on), and a
   * LOWER refill stops the reservoir overwriting what the bristles picked up
   * (the drag survives).
   */
  readonly introTuning?: { readonly load: number; readonly refill: number }
  /**
   * MEASUREMENT-ONLY: dabs per stroke. The original autopainter walks the
   * Catmull path in `v = 48` substeps; the coarse 10-dab replay undersamples
   * the 18 px per-bristle dash wavelength, so the dry dashes blur into a
   * static grain. 48 restores the original cadence.
   */
  readonly introSegments?: number
  /** Document size override. Absent → the 800 × 600 acceptance sheet. */
  readonly sheet?: readonly [number, number]
}

const SCENES: readonly SceneSpec[] = [
  { name: 'blank', band: false, stroke: false, pickup: null, feather: null, body: null },
  { name: 'band', band: true, stroke: false, pickup: 0, feather: 0, body: 0 },
  { name: 'band-p0', band: true, stroke: true, pickup: 0, feather: 0, body: 0 },
  { name: 'band-p100', band: true, stroke: true, pickup: 100, feather: 0, body: 0 },
  // RULING 2026-11-19 (the drag): the reference runs its DEFAULT depletion
  // (its blue cycle entry depletes as it travels). A Dry-0 Studio stroke
  // never dries, so it lays a solid bar where the reference breaks and lets
  // the wet yellow read. These three scenes repeat the drag pair and the
  // no-drag control at the shipped Dry default (50) — a like-for-like
  // depletion test that leaves every other scene (strands included) on its
  // D-E census pin.
  { name: 'band-p0-dry50', band: true, stroke: true, pickup: 0, feather: 0, body: 0, dry: 50 },
  { name: 'band-p100-dry50', band: true, stroke: true, pickup: 100, feather: 0, body: 0, dry: 50 },
  { name: 'blank-p0-dry50', band: false, stroke: true, pickup: 0, feather: 0, body: 0, dry: 50 },
  { name: 'blank-p0', band: false, stroke: true, pickup: 0, feather: 0, body: 0 },
  { name: 'blank-f0', band: false, stroke: true, pickup: 100, feather: 0, body: 0 },
  { name: 'blank-f100', band: false, stroke: true, pickup: 100, feather: 100, body: 0 },
  // MEASUREMENT-ONLY (2026-11-20): the artist's value-coherence sweep —
  // Feather 0/30/60/100 on the same blank-sheet stroke.
  { name: 'blank-f30', band: false, stroke: true, pickup: 100, feather: 30, body: 0 },
  { name: 'blank-f60', band: false, stroke: true, pickup: 100, feather: 60, body: 0 },
  // MEASUREMENT-ONLY (2026-11-20): the Dry sweep at a fixed Feather 75 —
  // the brush-emptying transition the artist wants to judge.
  { name: 'dry0-f75', band: false, stroke: true, pickup: 100, feather: 75, body: 0, dry: 0 },
  { name: 'dry33-f75', band: false, stroke: true, pickup: 100, feather: 75, body: 0, dry: 33 },
  { name: 'dry66-f75', band: false, stroke: true, pickup: 100, feather: 75, body: 0, dry: 66 },
  { name: 'dry100-f75', band: false, stroke: true, pickup: 100, feather: 75, body: 0, dry: 100 },
  // MEASUREMENT-ONLY (2026-11-20): the Load sweep at Feather 75 / Dry 33 —
  // how long the brush's paint tank lasts.
  { name: 'load0-f75d33', band: false, stroke: true, pickup: 100, feather: 75, body: 0, dry: 33, load: 0 },
  { name: 'load33-f75d33', band: false, stroke: true, pickup: 100, feather: 75, body: 0, dry: 33, load: 33 },
  { name: 'load66-f75d33', band: false, stroke: true, pickup: 100, feather: 75, body: 0, dry: 33, load: 66 },
  { name: 'load100-f75d33', band: false, stroke: true, pickup: 100, feather: 75, body: 0, dry: 33, load: 100 },
  // MEASUREMENT-ONLY (2026-11-20): the "100 % matter, no transition" goal —
  // Dry 0 + Feather 0 + Load 100 must lay a uniformly loaded stroke.
  { name: 'full-f0d0l100', band: false, stroke: true, pickup: 100, feather: 0, body: 0, dry: 0, load: 100 },
  // MEASUREMENT-ONLY (2026-11-20): the artist's final bristle check — a blue
  // stroke with the classic settings on a warm yellow sheet.
  { name: 'yellow-blank', band: false, stroke: false, pickup: null, feather: null, body: null, paper: YELLOW },
  { name: 'yellow-f75d40l70', band: false, stroke: true, pickup: 100, feather: 75, body: 0, dry: 40, load: 70, paper: YELLOW },
  // Same stroke with acrylic BODY: the layer turns opaque, covers the sheet
  // and no longer reads as a multiply over the ground.
  { name: 'yellow-f75d40l70-b85', band: false, stroke: true, pickup: 100, feather: 75, body: 85, dry: 40, load: 70, paper: YELLOW },
  { name: 'yellow-f75d40l70-b100', band: false, stroke: true, pickup: 100, feather: 75, body: 100, dry: 40, load: 70, paper: YELLOW },
  // MEASUREMENT-ONLY (2026-11-20, the artist's yellow-on-white report): one
  // yellow stroke on the DEFAULT white sheet, the live bag around it. Bisect
  // Pickup (carrier + smear dilution) and Body (scatter/KM) at F100.
  { name: 'yw-p100r0b100f100', band: false, stroke: true, pickup: 100, feather: 100, body: 100, dry: 50, load: 50, refill: 0, color: '#f2d23c' },
  { name: 'yw-p0r0b100f100', band: false, stroke: true, pickup: 0, feather: 100, body: 100, dry: 50, load: 50, refill: 0, color: '#f2d23c' },
  { name: 'yw-p100r0b0f100', band: false, stroke: true, pickup: 100, feather: 100, body: 0, dry: 50, load: 50, refill: 0, color: '#f2d23c' },
  { name: 'yw-p0r0b0f100', band: false, stroke: true, pickup: 0, feather: 100, body: 0, dry: 50, load: 50, refill: 0, color: '#f2d23c' },
  { name: 'yw-p100r60b100f100', band: false, stroke: true, pickup: 100, feather: 100, body: 100, dry: 50, load: 50, refill: 60, color: '#f2d23c' },
  { name: 'yw-p100r100b100f100', band: false, stroke: true, pickup: 100, feather: 100, body: 100, dry: 50, load: 50, refill: 100, color: '#f2d23c' },
  { name: 'yw-p50r0b100f100', band: false, stroke: true, pickup: 50, feather: 100, body: 100, dry: 50, load: 50, refill: 0, color: '#f2d23c' },
  { name: 'yw-multi-p0b100', band: false, stroke: true, pickup: 0, feather: 100, body: 100, dry: 50, load: 50, refill: 0, color: '#f2d23c', passes: 3 },
  { name: 'yw-multi-p100b100', band: false, stroke: true, pickup: 100, feather: 100, body: 100, dry: 50, load: 50, refill: 0, color: '#f2d23c', passes: 3 },
  { name: 'yw-multi-p100b0', band: false, stroke: true, pickup: 100, feather: 100, body: 0, dry: 50, load: 50, refill: 0, color: '#f2d23c', passes: 3 },
  // The artist's LIVE Studio bag: the Acrylic medium's own values for the
  // sliders they did not name (Water 26, Pigment 100, Dry 70, Viscosity 90,
  // Grain 25, Edges 65, Flow 60, Bleed 22, wetSeconds 12) plus their overrides
  // (Body 100, Feather 100, Refill 0, Emboss 0), Pickup 0 vs 100.
  { name: 'yw-studio-p0', band: false, stroke: true, pickup: 0, feather: 100, body: 100, dry: 70, load: 100, refill: 0, color: '#f2d23c', bagOverride: { water: 26, flow: 60, bleed: 22, edge: 65, granulation: 25, viscosity: 90, wetSeconds: 12 } },
  { name: 'yw-studio-p100', band: false, stroke: true, pickup: 100, feather: 100, body: 100, dry: 70, load: 100, refill: 0, color: '#f2d23c', bagOverride: { water: 26, flow: 60, bleed: 22, edge: 65, granulation: 25, viscosity: 90, wetSeconds: 12 } },
  { name: 'yw-p100r0b100f0', band: false, stroke: true, pickup: 100, feather: 0, body: 100, dry: 50, load: 50, refill: 0, color: '#f2d23c' },
  { name: 'yw-p0r0b100f0', band: false, stroke: true, pickup: 0, feather: 0, body: 100, dry: 50, load: 50, refill: 0, color: '#f2d23c' },
  // MEASUREMENT-ONLY (2026-11-20): the artist's wet-on-wet composition. A
  // yellow PIGMENT ground (four bristle strokes, Body 100, full tank), then
  // blue and red strokes crossing it while it is still wet. Nothing is
  // composited afterwards: the paper and pigment panels are the engine's own
  // exports, so every trace of mixing is the Studio paint physics.
  { name: 'mix-wet', band: false, stroke: false, pickup: null, feather: null, body: null, mix: 'wet' },
  // MEASUREMENT-ONLY (2026-11-20): the artist's thick-brush mixing test —
  // Dry 0 / Feather 75, a 3-4x brush, four crossing strokes over the wet
  // yellow ground, and same-colour passes overlapping each other.
  { name: 'mix-thick', band: false, stroke: false, pickup: null, feather: null, body: null, mix: 'thick' },
  // MEASUREMENT-ONLY (2026-11-20): the exact same composition at Refill 10,
  // so the carrier keeps what it picked up and drags it past the wet band.
  { name: 'mix-thick-drag', band: false, stroke: false, pickup: null, feather: null, body: null, mix: 'drag' },
  // MEASUREMENT-ONLY (2026-11-20): the thick composition with the DEPLETION
  // that makes the texture move (Dry 55 / Load 45) and the target's hard
  // edge (Feather 0). The pair differs ONLY in Refill: 60 vs 0.
  { name: 'mix-thick-dry', band: false, stroke: false, pickup: null, feather: null, body: null, mix: 'thick-dry', mixTuning: { dry: 55, feather: 0, load: 45, refill: 60 } },
  { name: 'mix-thick-dry-norefill', band: false, stroke: false, pickup: null, feather: null, body: null, mix: 'thick-dry-norefill', mixTuning: { dry: 55, feather: 0, load: 45, refill: 0 } },
  // The artist's Feather 75 kept, with the depletion + low refill that make
  // the texture move and the pickup survive.
  { name: 'mix-thick-dry-f75', band: false, stroke: false, pickup: null, feather: null, body: null, mix: 'thick-dry', mixTuning: { dry: 55, feather: 75, load: 45, refill: 10 } },
  // MEASUREMENT-ONLY (2026-11-20): the original app's intro `m()` sequence —
  // nine wide diagonal palette strokes on a portrait hot-press sheet. This is
  // the composition of the artist's target screenshot, replayed through the
  // real engine with the original's settings (Body 100, Dry from each
  // palette entry's depletion, Pickup 100, Refill 60, Feather 0).
  { name: 'intro-m', band: false, stroke: false, pickup: null, feather: null, body: null, intro: 'm', sheet: [480, 600], paper: HOT },
  // MEASUREMENT-ONLY (2026-11-20): the same composition with the tank
  // emptying during the stroke (Load 55) and the reservoir no longer
  // overwriting the pickup (Refill 10).
  { name: 'intro-m-drag', band: false, stroke: false, pickup: null, feather: null, body: null, intro: 'm', introTuning: { load: 55, refill: 10 }, sheet: [480, 600], paper: HOT },
  // The hard version: Load 45 / Refill 0 — the brush empties sooner and
  // keeps everything it picks up.
  { name: 'intro-m-drag-hard', band: false, stroke: false, pickup: null, feather: null, body: null, intro: 'm', introTuning: { load: 45, refill: 0 }, sheet: [480, 600], paper: HOT },
  // MEASUREMENT-ONLY (2026-11-20): the original autopainter's own 48-substep
  // cadence — the coarse 10-dab replay blurred the per-bristle dashes.
  { name: 'intro-m-fine', band: false, stroke: false, pickup: null, feather: null, body: null, intro: 'm', introSegments: 48, sheet: [480, 600], paper: HOT },
  { name: 'intro-m-fine-drag', band: false, stroke: false, pickup: null, feather: null, body: null, intro: 'm', introTuning: { load: 55, refill: 10 }, introSegments: 48, sheet: [480, 600], paper: HOT },
  { name: 'intro-m-fine-hard', band: false, stroke: false, pickup: null, feather: null, body: null, intro: 'm', introTuning: { load: 45, refill: 0 }, introSegments: 48, sheet: [480, 600], paper: HOT },
  // MEASUREMENT-ONLY (2026-11-20): the ORIGINAL `g()` — five dense vertical
  // strokes (green/teal/tan/cornflower/crimson), the composition of the
  // artist's target screenshot. Base = the app defaults; drag/hard lower the
  // tank and the refill.
  { name: 'intro-g', band: false, stroke: false, pickup: null, feather: null, body: null, intro: 'g', sheet: [480, 600], paper: HOT },
  { name: 'intro-g-drag', band: false, stroke: false, pickup: null, feather: null, body: null, intro: 'g', introTuning: { load: 55, refill: 10 }, sheet: [480, 600], paper: HOT },
  { name: 'intro-g-hard', band: false, stroke: false, pickup: null, feather: null, body: null, intro: 'g', introTuning: { load: 45, refill: 0 }, sheet: [480, 600], paper: HOT },
  { name: 'intro-g-fine', band: false, stroke: false, pickup: null, feather: null, body: null, intro: 'g', introSegments: 48, sheet: [480, 600], paper: HOT },
  // MEASUREMENT-ONLY (2026-11-20): the target-style CROSSING composition —
  // seven near-vertical palette strokes leaning into each other, 20 dabs
  // each. Drag = Load 55 / Refill 10; hard = Load 45 / Refill 0.
  { name: 'intro-cross', band: false, stroke: false, pickup: null, feather: null, body: null, intro: 'cross', introTuning: { load: 55, refill: 10 }, introSegments: 20, sheet: [480, 600], paper: HOT },
  { name: 'intro-cross-hard', band: false, stroke: false, pickup: null, feather: null, body: null, intro: 'cross', introTuning: { load: 45, refill: 0 }, introSegments: 20, sheet: [480, 600], paper: HOT },
  // MEASUREMENT-ONLY (2026-11-20): the pastel layering study on the
  // Feather-0 ragged-rim law — yellow over cyan, cream over blue, plus red,
  // orange and green.
  { name: 'intro-pastel', band: false, stroke: false, pickup: null, feather: null, body: null, intro: 'pastel', introTuning: { load: 65, refill: 10 }, introSegments: 20, sheet: [480, 600], paper: HOT },
  { name: 'intro-pastel-soft', band: false, stroke: false, pickup: null, feather: null, body: null, intro: 'pastel', introTuning: { load: 75, refill: 30 }, introSegments: 20, sheet: [480, 600], paper: HOT },
  // MEASUREMENT-ONLY (2026-11-19): the reference dries by default — its
  // brush.depletion 1.6 x the cornflower cycle entry 0.75 is 0.002 px^-1,
  // which is Studio's Dry ~= 55. The acceptance scenes pin Dry 0, so they
  // are not like-for-like on depletion; this pair repeats the Feather pair
  // at Dry 55 and joins NO acceptance table (run.mjs keeps it opt-in via
  // --scene, so `--acceptance` still reads the twelve-scene AFTER capture).
  { name: 'blank-f0-dry55', band: false, stroke: true, pickup: 100, feather: 0, body: 0, dry: 55 },
  { name: 'blank-f100-dry55', band: false, stroke: true, pickup: 100, feather: 100, body: 0, dry: 55 },
  { name: 'body0', band: false, stroke: true, pickup: 100, feather: 0, body: 0 },
  { name: 'body100', band: false, stroke: true, pickup: 100, feather: 0, body: 100 },
  // MEASUREMENT-ONLY (2026-11-20): the artist's live Feather study — Water 25,
  // Dry 70, Body 100, Pickup 100, Refill 0, Emboss 0, at Feather 0 vs 100, on
  // a thick stroke (run with --blue-size 16). Diagnoses the white rim.
  { name: 'edge-f0', band: false, stroke: true, pickup: 100, feather: 0, body: 100, dry: 70, load: 50, water: 25 },
  { name: 'edge-f100', band: false, stroke: true, pickup: 100, feather: 100, body: 100, dry: 70, load: 50, water: 25 },
  // The artist's two-stroke arrangement: a yellow-green stroke, then blue
  // partly over it — the state where the white rim was reported.
  { name: 'edge-pair-f0', band: false, stroke: false, pickup: null, feather: null, body: null, edgePair: 0 },
  { name: 'edge-pair-f100', band: false, stroke: false, pickup: null, feather: null, body: null, edgePair: 100 },
  // MEASUREMENT-ONLY (2026-11-20): the cross-colour drag vanished when the
  // stroke-age gate was added (the touch stamp makes it live-impossible). This
  // twin is edge-pair-f100 with Pickup 0, so the drag's fingerprint is a
  // measured delta between the two, never an eyeballed one.
  { name: 'edge-pair-p0-f100', band: false, stroke: false, pickup: null, feather: null, body: null, edgePair: 100, pairPickup: 0 },
]

// --- the fixed path ---------------------------------------------------------

/**
 * The reference's horizontal path at its own cadence: the press plus twelve
 * moves, one captured frame each (reference.mjs dispatchStroke). The engine's
 * speed — and therefore the bristle CONTACT pressure — is derived from the
 * sample spacing per tick, so a four-knot path fed one tick apart paints at a
 * different speed than the reference's twelve-frame drag. Thirteen evenly
 * spaced samples reproduce its timing; p stays at the authored 0.75.
 */
function horizontalPoints(): readonly AquarellePoint[] {
  const points: AquarellePoint[] = []
  for (let i = 0; i <= 12; i += 1) {
    // The reference capture is driven by mouse events, and its penPressure()
    // returns 1.0 for a mouse (app.js penPressure). The authored 0.75 was a
    // stylus value the comparison never used: with the contact-pressure law it
    // scales the touch gate BELOW the bristles' reach, so almost no bristle
    // printed. Feed what the reference actually fed.
    points.push({ x: 0.12 + (0.76 * i) / 12, y: 0.5, p: 1, tx: 0, ty: 0, tw: 0 })
  }
  return points
}

/**
 * The canonical bag exactly as the app records it (0..100) with every
 * scene-relevant key EXPLICIT: the reference-port acceptance must never
 * inherit a default that the port itself moves (Pickup 60 -> 100).
 * wetSeconds is written too — the brush's wetness lifetime must be the
 * same number on both sides (§6 default 7 s).
 *
 * `dry` is pinned to 0 in EVERY scene bag (261119-pod D-E): the faithful
 * per-stroke depletion starves a light wash long before the stroke ends, so
 * an unpinned Dry would confound the hue-shift and edge measures with a
 * drying brush. The acceptance measures the smear and Feather, nothing else.
 */
function paramsBag(
  sizePx: number,
  pickup: number,
  feather: number,
  body: number,
  dry = 0,
  load = 50,
  emboss = 0,
  refill = 0,
): Record<string, number> {
  return {
    size: sizePx,
    water: 50,
    load,
    flow: 50,
    bleed: 50,
    dry,
    edge: 50,
    granulation: 50,
    lift: 22,
    pickup,
    feather,
    body,
    refill,
    wetSeconds: 7,
    emboss,
  }
}

/** Thirteen evenly spaced samples from (x0, y0) to (x1, y1), mouse pressure. */
function linePoints(x0: number, y0: number, x1: number, y1: number): readonly AquarellePoint[] {
  const points: AquarellePoint[] = []
  for (let i = 0; i <= 12; i += 1) {
    points.push({
      x: x0 + ((x1 - x0) * i) / 12,
      y: y0 + ((y1 - y0) * i) / 12,
      p: 1,
      tx: 0,
      ty: 0,
      tw: 0,
    })
  }
  return points
}

// --- the original app's intro autopainter (measurement-only) ----------------
// app.js `m()` — nine wide diagonal palette strokes. The paths are authored in
// the original's 1280 × 1600 canvas; `introM()` reproduces its seeded draw
// exactly, and `introPoints()` applies the app's Catmull-Rom sampler and
// pressure fade (intro.fade = .45). Nothing here is a composite: the strokes
// go through the real engine's adapter like any other scene.
const INTRO_PALETTE = {
  teal: { color: '#1b5b74', depletion: 0.6, width: 0.09 },
  cornflower: { color: '#5994e4', depletion: 0.75, width: 0.085 },
  tan: { color: '#c7a08a', depletion: 0.7, width: 0.1 },
  green: { color: '#0b4628', depletion: 0.9, width: 0.08 },
  orange: { color: '#f08208', depletion: 1.1, width: 0.05 },
  crimson: { color: '#c0102f', depletion: 1.0, width: 0.055 },
  // Pastel set (2026-11-20): the artist's layering study — yellow over cyan,
  // cream over blue, plus red, orange and green.
  pcyan: { color: '#8fd0d4', depletion: 0.6, width: 0.1 },
  pyellow: { color: '#f2e29a', depletion: 0.55, width: 0.095 },
  pcream: { color: '#f2e6cf', depletion: 0.5, width: 0.095 },
  pblue: { color: '#8fb6e6', depletion: 0.6, width: 0.1 },
  pred: { color: '#e08a8a', depletion: 0.7, width: 0.09 },
  porange: { color: '#efb07a', depletion: 0.65, width: 0.085 },
  pgreen: { color: '#a6cfa0', depletion: 0.65, width: 0.09 },
} as const

type IntroPaint = keyof typeof INTRO_PALETTE

interface IntroStroke {
  readonly paint: IntroPaint
  readonly control: readonly (readonly [number, number])[]
  readonly speed: number
  readonly width: number
}

function introRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 1831565813) >>> 0
    let e = state
    e = Math.imul(e ^ (e >>> 15), e | 1)
    e ^= e + Math.imul(e ^ (e >>> 7), e | 61)
    return ((e ^ (e >>> 14)) >>> 0) / 4294967296
  }
}

function introCurve(
  start: readonly [number, number],
  end: readonly [number, number],
  amplitude: number,
): readonly (readonly [number, number])[] {
  const [x0, y0] = start
  const [x1, y1] = end
  const across = -(y1 - y0)
  const along = x1 - x0
  const points: (readonly [number, number])[] = []
  for (let i = 0; i < 4; i += 1) {
    const t = i / 3
    const bow = Math.sin(t * Math.PI) * amplitude
    points.push([x0 + (x1 - x0) * t + across * bow, y0 + (y1 - y0) * t + along * bow])
  }
  return points
}

function introM(): readonly IntroStroke[] {
  const random = introRandom(11)
  const paints: readonly IntroPaint[] = [
    'teal', 'cornflower', 'tan', 'green', 'cornflower', 'teal', 'orange', 'tan', 'crimson',
  ]
  return paints.map((paint, index) => {
    const x = 140 + index * 95 + (random() - 0.5) * 60
    const y = 120 + index * 70 + (random() - 0.5) * 60
    const length = 760 + random() * 320
    const width = 0.95 + random() * 0.45
    const speed = 0.85 + random() * 0.3
    return {
      paint,
      width,
      speed,
      control: introCurve([x, y], [x + length * 0.52, y + length], 0.08),
    }
  })
}

/**
 * app.js `g()` — five vertical strokes (green, teal, tan, cornflower,
 * crimson), centred on the 1280-wide design space at 95 px spacing. This is
 * the dense vertical cluster of the artist's target, not `m()`'s diagonal
 * fan. Same seeded draw order as the app: x, start y, end y, width.
 */
function introG(): readonly IntroStroke[] {
  const random = introRandom(71)
  const paints: readonly IntroPaint[] = ['green', 'teal', 'tan', 'cornflower', 'crimson']
  return paints.map((paint, index) => {
    const x = 1280 / 2 + (index - (paints.length - 1) / 2) * 95 + (random() - 0.5) * 30
    const y0 = 220 + random() * 180
    const y1 = 1180 + random() * 220
    const width = 1.05 + random() * 0.35
    return {
      paint,
      width,
      speed: 0.9,
      control: [
        [x, y0],
        [x, (y0 + y1) / 2],
        [x, y1],
      ],
    }
  })
}

/**
 * MEASUREMENT-ONLY (2026-11-20): a dense composition in the style of the
 * artist's target — seven near-vertical palette strokes whose paths lean
 * into each other and cross near the centre. The original sequences (m, g,
 * h) are all parallel; the target's colour interpenetration happens at
 * crossings, so this composition gives the real carrier pickup somewhere to
 * act. Paths and palette are authored here, the physics is the engine's.
 */
function introCross(): readonly IntroStroke[] {
  const random = introRandom(97)
  // Nine strokes on a 70 px top spacing with alternating leans: they cross
  // in a dense central band while the brush still carries paint, so each
  // bristle samples a different wet neighbour.
  const specs: readonly { paint: IntroPaint; x0: number; x1: number; y0: number; y1: number }[] = [
    { paint: 'orange', x0: 340, x1: 420, y0: 260, y1: 640 },
    { paint: 'green', x0: 420, x1: 560, y0: 150, y1: 1250 },
    { paint: 'teal', x0: 500, x1: 380, y0: 100, y1: 1330 },
    { paint: 'tan', x0: 660, x1: 540, y0: 240, y1: 1310 },
    { paint: 'tan', x0: 820, x1: 700, y0: 140, y1: 1290 },
    { paint: 'teal', x0: 900, x1: 780, y0: 180, y1: 1350 },
    { paint: 'cornflower', x0: 580, x1: 700, y0: 120, y1: 1280 },
    { paint: 'cornflower', x0: 740, x1: 860, y0: 90, y1: 1260 },
    { paint: 'crimson', x0: 980, x1: 860, y0: 300, y1: 1450 },
  ]
  return specs.map((spec) => {
    const bow = (random() - 0.5) * 0.12
    return {
      paint: spec.paint,
      width: 1.05 + random() * 0.35,
      speed: 0.85 + random() * 0.25,
      control: introCurve([spec.x0, spec.y0], [spec.x1, spec.y1], bow),
    }
  })
}

/**
 * MEASUREMENT-ONLY (2026-11-20): the artist's pastel layering study —
 * cyan grounds with yellow over them, blue grounds with cream over them,
 * plus red, orange and green crossing the cluster. Paint order is
 * background → top, so the pale overlays genuinely pick up and drag the
 * colour beneath (the carrier law, no composite).
 */
function introPastel(): readonly IntroStroke[] {
  const random = introRandom(131)
  const specs: readonly { paint: IntroPaint; x0: number; x1: number; y0: number; y1: number }[] = [
    { paint: 'pcyan', x0: 420, x1: 500, y0: 120, y1: 1300 },
    { paint: 'pcyan', x0: 530, x1: 450, y0: 150, y1: 1350 },
    { paint: 'pblue', x0: 780, x1: 860, y0: 110, y1: 1280 },
    { paint: 'pblue', x0: 900, x1: 810, y0: 140, y1: 1320 },
    { paint: 'pgreen', x0: 610, x1: 690, y0: 180, y1: 1240 },
    { paint: 'porange', x0: 690, x1: 620, y0: 200, y1: 1200 },
    { paint: 'pred', x0: 950, x1: 880, y0: 260, y1: 1400 },
    { paint: 'pyellow', x0: 480, x1: 540, y0: 220, y1: 1180 },
    { paint: 'pcream', x0: 830, x1: 780, y0: 200, y1: 1220 },
  ]
  return specs.map((spec) => {
    const bow = (random() - 0.5) * 0.08
    return {
      paint: spec.paint,
      width: 1.05 + random() * 0.3,
      speed: 0.85 + random() * 0.25,
      control: introCurve([spec.x0, spec.y0], [spec.x1, spec.y1], bow),
    }
  })
}

function catmull(a: number, b: number, c: number, d: number, t: number): number {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
}

function introPoints(
  control: readonly (readonly [number, number])[],
  segments = 10,
): readonly AquarellePoint[] {
  const n = control.length - 1
  const points: AquarellePoint[] = []
  for (let i = 0; i <= segments; i += 1) {
    const u = (i / segments) * n
    const k = Math.min(n - 1, Math.floor(u))
    const t = u - k
    const p0 = control[Math.max(0, k - 1)]!
    const p1 = control[k]!
    const p2 = control[Math.min(control.length - 1, k + 1)]!
    const p3 = control[Math.min(control.length - 1, k + 2)]!
    const x = catmull(p0[0], p1[0], p2[0], p3[0], t)
    const y = catmull(p0[1], p1[1], p2[1], p3[1], t)
    // app.js intro.fade = .45, applied on the autopainter's eased progress.
    const progress = i / segments
    const pressure = 1 + (0.45 - 1) * Math.pow(progress, 1.5)
    points.push({
      x: x / 1280,
      // The engine's document y is bottom-up; the original app's autopainter
      // is screen-space (y down). Flip so the replay matches the reference's
      // top-left → bottom-right fan.
      y: 1 - y / 1600,
      p: pressure,
      tx: 0,
      ty: 0,
      tw: 0,
    })
  }
  return points
}

function makeStroke(
  color: string,
  bag: Record<string, number>,
  mutationId: number,
  points: readonly AquarellePoint[] = horizontalPoints(),
): StudioStroke<AquarelleStrokePayload> {
  return toStudioStroke({
    tool: 'brush',
    color,
    params: bag,
    brushId: BRUSH_ID,
    points: points.map((point) => ({ ...point })),
    mutationId,
    timestamp: 0,
  })
}

// --- the adapter's engine ---------------------------------------------------

// The adapter owns its engine and exposes only `transparent`; the scene
// needs `paper` and `pigment` exports from the same instance. `setManual`
// is the first call the adapter makes on the engine it constructs, so a
// prototype tap records the exact instance (the medium-engine harness's
// idiom, copied rather than shared: that harness stays byte-untouched).
let capturedEngine: WatercolorEngine | null = null
const enginePrototype = WatercolorEngine.prototype as unknown as {
  setManual: (manual: boolean) => void
}
const originalSetManual = enginePrototype.setManual
enginePrototype.setManual = function patchedSetManual(this: WatercolorEngine, manual: boolean) {
  if (capturedEngine === null) capturedEngine = this
  return originalSetManual.call(this, manual)
}

// --- raster capture ---------------------------------------------------------

interface Panel {
  readonly rgba: Rgba
  readonly png: string
}

function captureCanvas(canvas: HTMLCanvasElement): Panel {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('port-comparison: exported canvas has no 2D context')
  const data = new Uint8ClampedArray(ctx.getImageData(0, 0, canvas.width, canvas.height).data)
  return {
    rgba: { width: canvas.width, height: canvas.height, data },
    png: canvas.toDataURL('image/png'),
  }
}

// --- D-G touch-stamp proof --------------------------------------------------

/**
 * 261119-pod D-G: the two facts the touch-stamp fix (`c0ec9345a`) has to
 * deliver on the rendered sheet.
 *
 *  (i) a zero-coverage texel keeps the one-week sentinel — its raw stamp is
 *      still `LAST_TOUCH_DRY_SECONDS` (−604800 s) and the §3.4 gate is 0;
 *  (iii) a FRESHLY PAINTED texel (the freshest stamp among texels carrying
 *      coverage) reads `pickupGateWet = exp(−(uNow − stamp)/max(wetSeconds, 1))`
 *      above 0.1 — the carrier's pickup is live at Body 0.
 *
 * The engine keeps `lastTouch` private and EXACT float32: read it through the
 * runtime internals (`private` is erased), the same sanctioned idiom the
 * medium-engine gate uses for its exact-f32 checks. `readFloat` returns rows
 * bottom-up, one lane per texel, index = y * dw + x — the cover read uses the
 * same geometry, so indices line up.
 */
interface EngineInternals {
  dw: number
  dh: number
  g: {
    readFloat(fb: WebGLFramebuffer, w: number, h: number): Float32Array
    readHalf(fb: WebGLFramebuffer, w: number, h: number, channels: 1 | 4): Uint16Array
  }
  lastTouch: { read: { views: WebGLFramebuffer[] } }
  cover: { read: { views: WebGLFramebuffer[] } }
  clock: () => number
  params: { wetSeconds: number }
}

const COVER_PAINTED_MIN = 0.1

function readTouchProof(engine: WatercolorEngine): Record<string, unknown> {
  const e = engine as unknown as EngineInternals
  const dw = e.dw
  const dh = e.dh
  const stamps = e.g.readFloat(e.lastTouch.read.views[0]!, dw, dh)
  const coverHalf = e.g.readHalf(e.cover.read.views[0]!, dw, dh, 1)
  const cover = new Float32Array(coverHalf.length)
  f16ToF32(coverHalf, cover)

  const uNow = e.clock() / 1000
  const wetSeconds = e.params.wetSeconds
  const gateWet = (stamp: number): number =>
    Math.exp(-Math.max(uNow - stamp, 0) / Math.max(wetSeconds, 1))

  // The freshest painted texel: the maximum stamp among texels the stroke
  // actually covered (cover > 0.1, so a bare touch stamp cannot masquerade
  // as paint). Deliberately NOT the max cover: the proof is about the stamp
  // the touch pass wrote where paint landed.
  let paintedIndex = -1
  let paintedStamp = Number.NEGATIVE_INFINITY
  for (let i = 0; i < stamps.length && i < cover.length; i += 1) {
    if (cover[i]! > COVER_PAINTED_MIN && stamps[i]! > paintedStamp) {
      paintedStamp = stamps[i]!
      paintedIndex = i
    }
  }
  if (paintedIndex < 0) {
    throw new Error('D-G proof: no texel carries coverage > 0.1 after the stroke')
  }

  // The zero-coverage control: the sheet's first texel (the stroke is a
  // horizontal band across the middle; the corner is never painted).
  let unpaintedIndex = -1
  for (let i = 0; i < stamps.length && i < cover.length; i += 1) {
    if (cover[i]! === 0) {
      unpaintedIndex = i
      break
    }
  }
  if (unpaintedIndex < 0) {
    throw new Error('D-G proof: every texel carries coverage — no zero-coverage control')
  }
  const unpaintedStamp = stamps[unpaintedIndex]!

  const painted = {
    index: paintedIndex,
    x: paintedIndex % dw,
    y: Math.floor(paintedIndex / dw),
    coverAlpha: cover[paintedIndex]!,
    stampSeconds: paintedStamp,
    ageSeconds: uNow - paintedStamp,
    pickupGateWet: gateWet(paintedStamp),
  }
  const unpainted = {
    index: unpaintedIndex,
    x: unpaintedIndex % dw,
    y: Math.floor(unpaintedIndex / dw),
    coverAlpha: cover[unpaintedIndex]!,
    stampSeconds: unpaintedStamp,
    ageSeconds: uNow - unpaintedStamp,
    pickupGateWet: gateWet(unpaintedStamp),
  }

  // D-G's two MUSTs, asserted in the page so a violated proof fails the
  // scene's verdict instead of hiding in a number nobody re-reads.
  if (!(painted.pickupGateWet > 0.1)) {
    throw new Error(
      `D-G proof: a freshly painted texel reads pickupGateWet ${painted.pickupGateWet} (must be > 0.1; stamp ${paintedStamp}, uNow ${uNow})`,
    )
  }
  if (Math.abs(unpaintedStamp - LAST_TOUCH_DRY_SECONDS) > 1) {
    throw new Error(
      `D-G proof: a zero-coverage texel lost the sentinel (stamp ${unpaintedStamp}, expected ${LAST_TOUCH_DRY_SECONDS})`,
    )
  }
  if (!(unpainted.pickupGateWet < 1e-3)) {
    throw new Error(`D-G proof: a zero-coverage texel reads pickupGateWet ${unpainted.pickupGateWet} (must be ≈ 0)`)
  }

  return {
    uNow,
    wetSeconds,
    sentinelSeconds: LAST_TOUCH_DRY_SECONDS,
    painted,
    unpainted,
    pickupGateWetPainted: painted.pickupGateWet,
    pickupGateWetUnpainted: unpainted.pickupGateWet,
  }
}

// --- WebGL2 canary ----------------------------------------------------------

function probeRenderer(): string {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const engine = new WatercolorEngine(canvas, null, {}, [64, 64])
  try {
    const gl = (engine as unknown as { gl: WebGL2RenderingContext }).gl
    const version = gl.getParameter(gl.VERSION) as string
    if (!version) throw new Error('no WebGL2 version string')
    return gl.getParameter(gl.RENDERER) as string
  } finally {
    engine.destroy()
  }
}

// --- scene driver -----------------------------------------------------------

function runScene(spec: SceneSpec, blueSize: number, renderer: string): Record<string, unknown> {
  if (!COLD) throw new Error("paper preset 'cold' is not in PAPERS")
  const sheetW = spec.sheet?.[0] ?? SHEET_W
  const sheetH = spec.sheet?.[1] ?? SHEET_H
  // The band's canonical size mirrors the reference's width ratio.
  const bandSize = Math.round(blueSize * (BAND_FRACTION / BLUE_FRACTION))

  // The canary above constructed and destroyed its own engine; the tap must
  // see the adapter's engine and only the adapter's engine.
  capturedEngine = null
  const adapter = createAquarelleEngineAdapter({
    width: sheetW,
    height: sheetH,
    paperPreset: spec.paper ?? COLD,
    paperStrength: PAPER_STRENGTH,
    paperSeed: PAPER_SEED,
  })

  try {
    const engine = capturedEngine
    if (engine === null) {
      throw new Error('port-comparison: probe never captured the adapter engine (setManual tap missed)')
    }

    const settle = (): void => {
      for (let tick = 0; tick <= SETTLE_TICKS; tick += 1) adapter.stepTick(tick)
    }

    const pre = captureCanvas(engine.exportCanvas('paper'))
    let substrate: Panel | null = null
    if (spec.band) {
      adapter.applyStroke(
        makeStroke(BAND_COLOR, paramsBag(bandSize, 0, 0, 0), 0x7ec000),
      )
      settle()
      // Mobile on purpose: the band is never fixed, so the §3.4 wetness is
      // high when the blue crosses it.
      substrate = captureCanvas(engine.exportCanvas('paper'))
    }

    let finalPaper = substrate ?? pre
    let finalPigment: Panel | null = null
    let finalCoverage: Panel | null = null
    if (spec.intro) {
      // The original app's intro `m()`: nine wide diagonal palette strokes,
      // same control points and seeded widths/speeds, sampled with its
      // Catmull-Rom law and pressure fade. The Studio has no Body (the
      // original is opaque), so Body 100; Dry comes from each palette entry's
      // own depletion (1.6 × entry / the cornflower baseline); Pickup 100 is
      // the Studio default; Refill 60 the original's; Feather 0 is the
      // original's fixed softness .09. No post-composite.
      const strokes =
        spec.intro === 'g'
          ? introG()
          : spec.intro === 'cross'
            ? introCross()
            : spec.intro === 'pastel'
              ? introPastel()
              : introM()
      let seed = 0x7ec200
      const load = spec.introTuning?.load ?? 90
      const refill = spec.introTuning?.refill ?? 60
      for (const stroke of strokes) {
        const entry = INTRO_PALETTE[stroke.paint]
        const size = Math.max(5, Math.round(24 * (entry.width / 0.085) * (stroke.width / 1.15)))
        const dry = Math.min(100, Math.max(0, 55 * (entry.depletion / 0.75)))
        adapter.applyStroke(
          makeStroke(
            entry.color,
            paramsBag(size, 100, 0, 100, dry, load, 0, refill),
            seed++,
            introPoints(stroke.control, spec.introSegments),
          ),
        )
      }
      settle()
      finalPaper = captureCanvas(engine.exportCanvas('paper'))
      finalPigment = captureCanvas(engine.exportCanvas('pigment'))
      finalCoverage = captureCanvas(engine.exportCoverageCanvas())
    } else if (spec.mix) {
      let seed = spec.mix === 'wet' ? 0x7ec100 : 0x7ec300
      if (
        spec.mix === 'thick' ||
        spec.mix === 'drag' ||
        spec.mix === 'thick-dry' ||
        spec.mix === 'thick-dry-norefill'
      ) {
        // The artist's thick-brush test (2026-11-20): Dry 0 keeps the brush
        // wet end to end, Feather 75 softens the film edges, and a 3-4x
        // brush crosses its own wet strokes. Every colour is engine pigment
        // at Body 100; the only variables are the path overlaps.
        const groundBag = paramsBag(Math.round(blueSize * 4), 0, 0, 100, 0, 100, 0)
        for (const y of [0.4, 0.47, 0.54]) {
          adapter.applyStroke(makeStroke(BAND_COLOR, groundBag, seed++, linePoints(0.08, y, 0.92, y)))
        }
        settle()
        substrate = captureCanvas(engine.exportCanvas('paper'))
        const tuning = spec.mixTuning ?? {}
        const crossingBag = paramsBag(
          Math.round(blueSize * 3),
          100,
          tuning.feather ?? 75,
          100,
          tuning.dry ?? 0,
          tuning.load ?? 90,
          0,
          tuning.refill ?? (spec.mix === 'drag' ? 10 : 60),
        )
        // Blue and red cross each other; a second blue pass overlaps the
        // first; cyan crosses the yellow band and runs out onto bare paper
        // at both ends, so pick-up has to drag colour along the path.
        adapter.applyStroke(makeStroke(BLUE_COLOR, crossingBag, seed++, linePoints(0.16, 0.22, 0.48, 0.82)))
        adapter.applyStroke(makeStroke(RED_COLOR, crossingBag, seed++, linePoints(0.3, 0.85, 0.62, 0.18)))
        adapter.applyStroke(makeStroke(BLUE_COLOR, crossingBag, seed++, linePoints(0.24, 0.2, 0.56, 0.8)))
        adapter.applyStroke(makeStroke(CYAN_COLOR, crossingBag, seed++, linePoints(0.1, 0.62, 0.9, 0.36)))
      } else {
        // Wet-on-wet: the yellow ground is PIGMENT (four broad bristle
        // strokes at Body 100 and a full tank), then blue and red bristle
        // strokes cross it while it is still wet. Pickup 60 is the Studio
        // default the port must not inherit away; the crossing strokes keep
        // the artist's classic Feather 75 · Dry 40 · Load 70. NO
        // post-composite: both panels below are the engine's own exports.
        const groundBag = paramsBag(blueSize, 0, 0, 100, 0, 100, 0)
        for (const y of [0.4, 0.46, 0.52]) {
          adapter.applyStroke(makeStroke(BAND_COLOR, groundBag, seed++, linePoints(0.1, y, 0.9, y)))
        }
        settle()
        substrate = captureCanvas(engine.exportCanvas('paper'))
        const wetBag = paramsBag(blueSize, 100, 30, 100, 80, 90, 0, 10)
        adapter.applyStroke(makeStroke(BLUE_COLOR, wetBag, seed++, linePoints(0.32, 0.28, 0.32, 0.72)))
        adapter.applyStroke(makeStroke(RED_COLOR, wetBag, seed++, linePoints(0.5, 0.28, 0.5, 0.72)))
        adapter.applyStroke(makeStroke(CYAN_COLOR, wetBag, seed++, linePoints(0.68, 0.28, 0.68, 0.72)))
      }
      settle()
      finalPaper = captureCanvas(engine.exportCanvas('paper'))
      finalPigment = captureCanvas(engine.exportCanvas('pigment'))
      finalCoverage = captureCanvas(engine.exportCoverageCanvas())
    } else if (spec.edgePair !== undefined) {
      // Water 25, Dry 70, Body 100, Pickup 100, Refill 0, Emboss 0 — the
      // artist's live bag. Yellow-green first, then blue partly over it.
      const size = Math.max(8, Math.round(blueSize * 3))
      const bag = paramsBag(size, spec.pairPickup ?? 100, spec.edgePair, 100, 70, 50, 0, 0)
      bag.water = 25
      let seed = 0x7ec400
      adapter.applyStroke(makeStroke('#c9d24a', bag, seed++, linePoints(0.3, 0.15, 0.46, 0.85)))
      adapter.applyStroke(makeStroke('#2f6fd0', bag, seed++, linePoints(0.27, 0.15, 0.43, 0.85)))
      settle()
      finalPaper = captureCanvas(engine.exportCanvas('paper'))
      finalPigment = captureCanvas(engine.exportCanvas('pigment'))
      finalCoverage = captureCanvas(engine.exportCoverageCanvas())
    } else if (spec.stroke) {
      const bag = paramsBag(blueSize, spec.pickup ?? 0, spec.feather ?? 0, spec.body ?? 0, spec.dry ?? 0, spec.load ?? 50, 0, spec.refill ?? 0)
      if (spec.water !== undefined) bag.water = spec.water
      if (spec.bagOverride !== undefined) Object.assign(bag, spec.bagOverride)
      const passes = spec.passes ?? 1
      for (let i = 0; i < passes; i += 1) {
        const y = 0.5 + (i - (passes - 1) / 2) * 0.09
        adapter.applyStroke(
          makeStroke(spec.color ?? BLUE_COLOR, bag, 0x7ec001 + i, linePoints(0.22, y, 0.78, y + 0.01)),
        )
      }
      settle()
      finalPaper = captureCanvas(engine.exportCanvas('paper'))
      finalPigment = captureCanvas(engine.exportCanvas('pigment'))
      // RULING 2026-11-19: the raw coverage channel — the fade instrument's
      // input. The pigment alpha is max(darkAlpha, cover); this is cover.
      finalCoverage = captureCanvas(engine.exportCoverageCanvas())
    }

    // D-G: the touch-stamp proof rides the `body0` acceptance scene — Pickup
    // 100 at Body 0 is exactly the case the pre-fix stamp left inert.
    const touchProof = spec.name === 'body0' ? readTouchProof(engine) : null

    // The parameter echo: the main stroke of this scene (the blue where one
    // is painted, else the band, else none), so the calibration is data.
    const echo =
      spec.stroke || spec.band
        ? {
            color: spec.stroke ? BLUE_COLOR : BAND_COLOR,
            brushId: BRUSH_ID,
            sizePx: spec.stroke ? blueSize : bandSize,
            pickup: spec.stroke ? spec.pickup : 0,
            feather: spec.stroke ? spec.feather : 0,
            body: spec.stroke ? spec.body : 0,
            refill: 0,
            dry: spec.stroke ? (spec.dry ?? 0) : 0,
            blueSizePx: blueSize,
            bandSizePx: bandSize,
          }
        : {
            color: null,
            brushId: null,
            sizePx: null,
            pickup: null,
            feather: null,
            body: null,
            refill: null,
            dry: null,
            blueSizePx: blueSize,
            bandSizePx: bandSize,
          }

    const record = measureScene({
      scene: spec.name,
      pre: pre.rgba,
      substrate: substrate ? substrate.rgba : null,
      finalPaper: finalPaper.rgba,
      finalPigment: finalPigment ? finalPigment.rgba : null,
      coverage: finalCoverage ? finalCoverage.rgba : null,
      params: echo,
    })

    return {
      scene: spec.name,
      record,
      touchProof,
      paperPng: finalPaper.png,
      pigmentPng: finalPigment ? finalPigment.png : null,
      renderer,
    }
  } finally {
    adapter.dispose()
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
  console.log('PORT_COMPARISON_RESULT ' + JSON.stringify({ verdict: report['verdict'] }))
}

// --- main -------------------------------------------------------------------

function readScene(): string {
  const raw = new URLSearchParams(location.search).get('scene')
  if (raw === null || raw === '') return 'blank'
  const known = SCENES.map((scene) => scene.name)
  if (!known.includes(raw)) {
    throw new Error(`invalid scene "${raw}" (known: ${known.join(', ')})`)
  }
  return raw
}

/** The calibration knob: an integer blue size, absent keeps the fitted one. */
function readBlueSize(): number {
  const raw = new URLSearchParams(location.search).get('blueSize')
  if (raw === null || raw === '') return DEFAULT_BLUE_SIZE
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1 || value > 800) {
    throw new Error(`invalid blueSize "${raw}" (expected an integer 1..800)`)
  }
  return value
}

function main(): void {
  let scene = 'blank'
  let blueSize = DEFAULT_BLUE_SIZE
  let renderer = '(unknown)'
  try {
    scene = readScene()
    blueSize = readBlueSize()
    renderer = probeRenderer()
    capturedEngine = null
    const spec = SCENES.find((entry) => entry.name === scene)!
    const result = runScene(spec, blueSize, renderer)
    writeResult({ ...result, verdict: 'PORT-COMPARISON CAPTURED' })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    writeResult({ scene, renderer, verdict: `PORT-COMPARISON FAIL ${message}`, error: message })
  }
}

main()
