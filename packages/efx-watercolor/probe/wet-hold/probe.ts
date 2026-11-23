// ============================================================
//  wet-hold/probe.ts — MEASUREMENT ONLY (quick 261123-pee).
//
//  THE HOLD LAW: the live Studio sheet never auto-dries. This page runs the
//  artist's two-stage surface through the REAL vendored engine — a watercolor
//  underpaint, then an acrylic stroke — and then either
//
//    --scene hold        arms `setHoldWet(true)` the way the live layer does
//                        (on the captured engine, re-asserted after every
//                        tick walk while `!engine.isFixing`), idles on the
//                        live tick law until the sim SLEEPS, and proves the
//                        sheet is still wet: `hasStandingWater` true, the
//                        settled export is a capture (pixels move, the sheet
//                        does not, no undo step), and a second acrylic stroke
//                        still picks up the paint (the carried-hue drag).
//    --scene hold --dry  the control: the engine's explicit `fix()` before the
//                        second stroke. The gate closes, `wetPeak` zeroes, the
//                        hold lifts, and the undo depth is ONE greater than the
//                        held run's (the positive control proving the depth read
//                        detects a real step).
//
//                        MEASURED, and NOT what the plan assumed: the Dry does
//                        NOT kill the second stroke's pickup. The carrier's wet
//                        gate is the last-touch field, and the stroke's OWN
//                        touch pass re-stamps every covered texel it crosses
//                        with `uNow` (`bristleTouchFS`: `mix(times, uNow,
//                        cover)`), so from the second dab on the carrier always
//                        reads a fresh stamp — the artist's 2026-11-20 ruling,
//                        "lift is decided by COLOUR, never by AGE". The dry arm
//                        therefore asserts the carrier still carries the canvas
//                        colour (22.7 deg off its own hue, the same as held);
//                        the hold changes the wet FIELD and the gate, never the
//                        carrier's colour lift.
//
//    --scene hold --holdoff
//                        the CONTROL: the same live session with the hold OFF
//                        (`setHoldWet(false)` before the walk, never re-armed).
//                        261123-vkb MEASURED: the hold bypasses decay at the
//                        reader (`wetDecay`), so an UNHELD sim keeps decaying
//                        the wet FIELD and its trim/sleep path fires well
//                        before the natural `wetUntil` bound — 211 ticks vs
//                        the held 237-tick window (the plan's 237 was the
//                        HELD pre-change baseline, a different physical
//                        setup). The unheld sleep then zeroes `wetPeak` and
//                        closes the gate (sleep()'s unheld guard).
//
//    --scene bake        the bake A/B: ONE recorded list (two watercolor
//                        strokes, one acrylic, one recorded Dry) baked twice
//                        through the real `createAquarelleBake` with
//                        `frameCount: 1` — `settle: 'wet'` on a hold-adapter
//                        (the recorded Dry filtered out, exactly the
//                        controller's wet law) vs `settle: 'dry'` on a default
//                        adapter. The commit read is each bake's own
//                        `captureSheet()`: the wet sheet keeps its peak, the dry
//                        sheet force-dried to zero, and the ink layers differ.
//                        A third arm (`wetSession`) bakes the SAME two strokes
//                        the held scene applied (same seeds/params) with
//                        `settle: 'wet'`; its live-versus-bake paint-layer
//                        digests and begin ticks are REPORTED, never gated (the
//                        adapter's per-sample tick law and the timeline's
//                        `previousEnd` clamp make exact equality unprovable).
//
//  261123-vkb THE FREEZE LAW: while held, the awake window after the LAST wet
//  input is bounded at the visible settle cap (`aquarelleVisibleSettleTicks`,
//  the bake's own cap), then the sim sleeps through the existing sleep paths —
//  no fix, no decay, no mobile-to-fixed. The held walk therefore reports its
//  `windowTicks` (ticks from `lastWet` to the LAST AWAKE observation — the
//  engine sleeps INSIDE the crossing stepTick, so the loop-exit clock is one
//  tick too late), records the sheet (`frozen`), advances the clock 1800 ticks
//  (+30 s) and re-reads it (`frozenAfter`): the raw canvas digest and the seven
//  paint-layer digests must be IDENTICAL. `lastTouch` is EXCLUDED: the capture
//  stores it as AGES from the capture clock, so every age rises with the
//  advance by construction and equality there would prove nothing.
//
//  Everything is deterministic: no wall clock enters a readout, the engine
//  runs on the adapter's virtual clock, and every stroke is fed through
//  `adapter.applyStroke` exactly as the re-bake feeds it. The analog is
//  probe/pickup-collapse, file for file. Scratch harness; nothing here is
//  imported by the package.
//
//  WHY THIS SCENE HAS ITS OWN PAINT PARAMS: the carrier's wet gate is
//  `exp(-age / wetSeconds) * clamp(cover / 0.5)`. The hold keeps the wet FIELD
//  and `wetPeak` alive, but the gate's age term is the last-touch memory — so
//  the probe must (a) hold a long `wetSeconds` for the stamp age to survive the
//  idle at a readable level, and (b) drive `dry` to 100 so the dry tau is its
//  2 s floor and the idle (bounded by `wetUntil`) stays small. These are lens
//  settings, not medium claims: the app's records are untouched.
// ============================================================

import { WatercolorEngine, type LayerId, type WholeDoc } from '../../src/playground/Engine'
import { createAquarelleEngineAdapter } from '../../src/adapter/engineAdapter'
import { createAquarelleBake, type AquarelleBakeDiagnostics } from '../../src/bake/aquarelleBake'
import { aquarelleVisibleSettleTicks } from '../../src/playground/settleCap'
import { PAPERS, type PaperPreset } from '../../src/playground/papers'
import {
  toStudioStroke,
  type AquarellePoint,
  type AquarelleStrokePayload,
} from '../../src/payload/toStudioStroke'
import {
  createDryEvent,
  isAquarelleDryEvent,
  type AquarellePayloadEvent,
} from '../../src/payload/dryEvent'
import type { StudioStroke } from '@efxlab/efx-paint-host/animation'
import { f16ToF32 } from '../../src/playground/half'
import { coeffsToLinear, pigmentFromHex } from '../../src/playground/spectral'
import { WET_THRESHOLD } from '../../src/playground/wetState'

const SHEET_W = 800
const SHEET_H = 600
const PAPER_SEED = 0xc0ffee
const PAPER_STRENGTH = 1
/** The 64-21 band law's settle (probe/pickup-collapse SETTLE_TICKS). */
const SETTLE_TICKS = 8
/** The engine's FIX_DURATION, seconds — the layer's tick-walk bound. */
const FIX_DURATION_S = 1.2
/** `Math.ceil(1.2 * 60) + 1` — the plan's tick-walk bound (the layer's law). */
const MAX_FIX_TICKS = Math.ceil(FIX_DURATION_S * 60) + 1
/** The live host tick (HOST_TICK_HZ = 60), seconds. */
const HOST_TICK_S = 1 / 60
/** The host tick in ms — the bake's own `HOST_TICK_MS` (aquarelleBake.ts:293). */
const HOST_TICK_MS = 1000 / 60
/** Bound on the idle walk: two minutes of engine time dwarfs the window. */
const MAX_IDLE_TICKS = 60 * 120
/** The freeze proof's clock advance: 1800 host ticks = +30 s of engine time. */
const FREEZE_ADVANCE_TICKS = 1800
// Probe scene lens (see the header): a slow tack time keeps the stamp age
// readable across the idle; dry 100 pins the dry tau to its 2 s floor so the
// idle (wetUntil = lastWet + tau * ln(wetPeak / WET_THRESHOLD)) stays small.
const WET_SECONDS = 60
const DRY_PARAM = 100
const PRESSURE = 0.75
const BLUE_SIZE = 17
/**
 * The stroke's horizontal extent (document fractions). Kept narrow on purpose:
 * the history's pool 0 holds TWO documents of tile slots, and every step saves
 * its own footprint. Three full-width strokes exhausted the pool and evicted
 * the oldest step (measured: depth 3 -> 2, `history.evictions` 1), which makes
 * every depth read ambiguous — a step count capped by memory, not by law.
 */
const STROKE_X0 = 0.35
const STROKE_X1 = 0.65
/** The underpaint band is this much larger than the acrylic stroke. */
const BAND_SIZE_RATIO = 0.12 / 0.085
/** The watercolor underpaint (the 64-21 band colour). */
const BAND_COLOR = '#e8c21a'
/** The acrylic stroke's colour (the pickup-collapse tested stroke). */
const BLUE_COLOR = '#5994e4'
const BRUSH_ID = 'bristle-flat'
/**
 * The held scene's two stroke seeds — shared with the `wetSession` bake arm so
 * the live and baked sessions cannot drift apart.
 */
const HOLD_BAND_SEED = 0x7ec000
const HOLD_ACRYLIC_SEED = 0x7ec001
/**
 * The `wetSession` arm's recorded-order anchors — a plain nonzero ORDERING
 * device for `buildRecordedTimeline`'s timed path, never a tick-alignment
 * claim (its `previousEnd` clamp plus the adapter's per-sample tick law make
 * exact live/bake begin equality unprovable).
 */
const HOLD_BAND_ORDER = 1000
const HOLD_ACRYLIC_ORDER = 1200
/**
 * The freeze proof's digest set — the seven PAINT layers. `lastTouch` is
 * excluded: the capture stores it as AGES from the capture clock
 * (`captureWhole` -> `stampsToAges(..., nowSec())`), so a clock advance raises
 * every age by construction and its digest cannot be stable.
 */
const PAINT_LAYER_IDS: readonly LayerId[] = ['inkA', 'inkB', 'fixedA', 'fixedB', 'wet', 'relief', 'cover']
// --- the bake scene's lens (--scene bake) -----------------------------------
/** The recorded session's end-ms stamps — the bake's own replay clock. */
const BAKE_BAND_MS = 1000
const BAKE_ACRYLIC_MS = 1200
const BAKE_DRY_ORDER = 1300
const BAKE_DRY_TICK = 3
const BAKE_SECOND_MS = 1400
/** The bake's forced-fix settle window — `Math.round(1.2 * 60)` (FIX_SETTLE_TICKS). */
const BAKE_SETTLE_TICKS = Math.round(FIX_DURATION_S * 60)

const COLD: PaperPreset | undefined = PAPERS.find((preset) => preset.id === 'cold')

// --- colour: absorbance coefficients -> display hue -------------------------

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

/** The carried-absorbance hue of an sRGB triple (0..1). */
function srgbHue(r: number, g: number, b: number): number | null {
  return hueOf(r, g, b).hue
}

/** One pigment's own display hue — the drag reference for its stroke. */
function pigmentHue(hex: string): number | null {
  const lin = coeffsToLinear(pigmentFromHex(hex).coeffs)
  const c = (v: number): number => compand(v < 0 ? 0 : v > 1 ? 1 : v)
  return srgbHue(c(lin[0]!), c(lin[1]!), c(lin[2]!))
}

/** Shortest circular distance between two hue angles, degrees. */
function hueDistance(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

const round = (v: number, digits = 6): number => Number(v.toFixed(digits))
const roundOrNull = (v: number | null, digits = 2): number | null =>
  v === null ? null : Number(v.toFixed(digits))

// --- engine internals (the capture hook + the raw reads) --------------------

interface EngineInternals {
  history: { entries(): { index: number }; evictions: number }
  active: unknown
  stroke: unknown
  bristleCount: number
  stepRecording: boolean
  /** 261123-vkb: the live clock reads behind the window measure (diagnostics only). */
  clock: () => number
  lastWet: number
  wetUntil: () => number
}

function internals(engine: WatercolorEngine): EngineInternals {
  return engine as unknown as EngineInternals
}

/** The engine's undo depth — `history.entries().index`, the captured engine's own. */
function depthOf(engine: WatercolorEngine): number {
  return internals(engine).history.entries().index
}

let capturedEngine: WatercolorEngine | null = null

interface Proto {
  setManual: (manual: boolean) => void
}

const enginePrototype = WatercolorEngine.prototype as unknown as Proto
const originalSetManual = enginePrototype.setManual
enginePrototype.setManual = function patchedSetManual(this: WatercolorEngine, manual: boolean) {
  if (capturedEngine === null) capturedEngine = this
  return originalSetManual.call(this, manual)
}

// --- the carried state (the pickup lens) ------------------------------------

interface CarriedRead {
  bristleCount: number
  /** The PICKUP lens: the most-loaded bristle carries the canvas colour. */
  loadedIndex: number
  loadedHueDeg: number | null
  loadedLoad: number
  /** Detail beside it: the widest-across (rim) and the centre-most bristle. */
  rimIndex: number
  centreIndex: number
  rimHueDeg: number | null
  centreHueDeg: number | null
  rimLoad: number
  centreLoad: number
}

/**
 * The bristle reservoirs after a stroke — the carrier's own output. Layout is
 * `readBristles()`'s documented one: carried 0..3 at i*4, 4..6 + alpha at
 * 1024 + i*4, load/across/seed/jitter at 2048 + i*4.
 *
 * The PICKUP lens is the most-LOADED bristle: a bristle is the carrier's
 * colour only in proportion to the pigment it carries, and the widest-across
 * "rim" bristles measured load 0 (no colour to drag at all — the first build
 * asserted on them and read a phantom 0.01 deg). The rim and centre-most
 * bristles stay in the readout as detail.
 */
function readCarried(engine: WatercolorEngine): CarriedRead {
  const halfs = engine.readBristles()
  const decoded = new Float32Array(halfs.length)
  f16ToF32(halfs, decoded)
  const count = internals(engine).bristleCount
  let rim = 0
  let centre = 0
  let loaded = 0
  let rimAbs = -1
  let centreAbs = Infinity
  let loadedLoad = -Infinity
  for (let i = 0; i < count; i += 1) {
    const across = Math.abs(decoded[2048 + i * 4 + 1]!)
    const load = decoded[2048 + i * 4]!
    if (across > rimAbs) {
      rimAbs = across
      rim = i
    }
    if (across < centreAbs) {
      centreAbs = across
      centre = i
    }
    if (load > loadedLoad) {
      loadedLoad = load
      loaded = i
    }
  }
  const hueAt = (index: number): number | null => {
    const lin = coeffsToLinear([
      decoded[index * 4]!,
      decoded[index * 4 + 1]!,
      decoded[index * 4 + 2]!,
      decoded[index * 4 + 3]!,
      decoded[1024 + index * 4]!,
      decoded[1024 + index * 4 + 1]!,
      decoded[1024 + index * 4 + 2]!,
    ])
    const c = (v: number): number => compand(v < 0 ? 0 : v > 1 ? 1 : v)
    return srgbHue(c(lin[0]!), c(lin[1]!), c(lin[2]!))
  }
  return {
    bristleCount: count,
    loadedIndex: loaded,
    loadedHueDeg: hueAt(loaded),
    loadedLoad: round(loadedLoad, 4),
    rimIndex: rim,
    centreIndex: centre,
    rimHueDeg: hueAt(rim),
    centreHueDeg: hueAt(centre),
    rimLoad: round(decoded[2048 + rim * 4]!, 4),
    centreLoad: round(decoded[2048 + centre * 4]!, 4),
  }
}

// --- the surface (pixels) ---------------------------------------------------

/** FNV-1a over the exported sheet's RGB bytes — the deterministic digest. */
function digestCanvas(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx || typeof ctx.getImageData !== 'function') throw new Error('digestCanvas: no readback')
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  let h = 0x811c9dc5
  for (let i = 0; i < data.length; i += 4) {
    for (let k = 0; k < 3; k += 1) {
      h ^= data[i + k]!
      h = Math.imul(h, 0x01000193) >>> 0
    }
  }
  return h.toString(16).padStart(8, '0')
}

interface FilmStats {
  texels: number
  meanSrgb: [number, number, number]
  hueDeg: number | null
}

/**
 * The rendered film's colour over the stroke's own painted texels (cover > 0.5
 * from `exportCoverageCanvas`, inside the stroke's lateral extent) — the
 * pixel-level consequence of the carrier's drag.
 */
function filmStats(sheet: HTMLCanvasElement, cover: HTMLCanvasElement): FilmStats {
  const sctx = sheet.getContext('2d', { willReadFrequently: true })
  const cctx = cover.getContext('2d', { willReadFrequently: true })
  if (!sctx || !cctx || typeof sctx.getImageData !== 'function' || typeof cctx.getImageData !== 'function') {
    throw new Error('filmStats: no readback')
  }
  const { width: w, height: h } = sheet
  const s = sctx.getImageData(0, 0, w, h).data
  const c = cctx.getImageData(0, 0, w, h).data
  const y0 = Math.max(0, Math.floor((0.5 - 0.06) * h))
  const y1 = Math.min(h, Math.ceil((0.5 + 0.06) * h))
  const x0 = Math.floor((STROKE_X0 - 0.02) * w)
  const x1 = Math.ceil((STROKE_X1 + 0.02) * w)
  let n = 0
  let r = 0
  let g = 0
  let b = 0
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * w + x) * 4
      if (c[i]! < 128) continue
      n += 1
      r += s[i]!
      g += s[i + 1]!
      b += s[i + 2]!
    }
  }
  if (n === 0) return { texels: 0, meanSrgb: [0, 0, 0], hueDeg: null }
  const mean: [number, number, number] = [r / n, g / n, b / n]
  return {
    texels: n,
    meanSrgb: mean.map((v) => Number(v.toFixed(1))) as [number, number, number],
    hueDeg: srgbHue(mean[0] / 255, mean[1] / 255, mean[2] / 255),
  }
}

// --- strokes (the bake's own feed path) -------------------------------------

function horizontalPoints(pressure: number): readonly AquarellePoint[] {
  const span = STROKE_X1 - STROKE_X0
  return [0, 1, 2, 3].map((i) => ({
    x: STROKE_X0 + (span * i) / 3,
    y: 0.5,
    p: pressure,
    tx: 0,
    ty: 0,
    tw: 0,
  }))
}

/**
 * Probe paint params (see the header): the pickup-collapse bag with the two
 * lens settings this scene needs — `wetSeconds` 60 and `dry` 100. `body` 0 is
 * the watercolor underpaint (the bristle path's cover floor keeps the
 * carrier's gate live; the non-bristle Body-0 path writes no cover), `body`
 * 100 the acrylic.
 */
function paramsBag(sizePx: number, pickup: number, body: number): Record<string, number> {
  return {
    size: sizePx,
    water: 50,
    load: 50,
    flow: 50,
    bleed: 50,
    dry: DRY_PARAM,
    edge: 50,
    granulation: 50,
    lift: 22,
    pickup,
    feather: 0,
    body,
    refill: 0,
    wetSeconds: WET_SECONDS,
  }
}

function makeStroke(
  color: string,
  bag: Record<string, number>,
  mutationId: number,
  timestamp = 0,
): StudioStroke<AquarelleStrokePayload> {
  return toStudioStroke({
    tool: 'brush',
    color,
    params: bag,
    brushId: BRUSH_ID,
    points: horizontalPoints(PRESSURE).map((point) => ({ ...point })),
    mutationId,
    timestamp,
  })
}

// --- the scene config -------------------------------------------------------

interface SceneConfig {
  scene: 'hold' | 'bake'
  dry: boolean
  /** 261123-vkb: the hold-off control — `setHoldWet(false)` before the walk. */
  holdoff: boolean
  blueSize: number
  pressure: number
}

function readSceneConfig(): SceneConfig {
  const params = new URLSearchParams(location.search)
  const sceneRaw = params.get('scene') ?? 'hold'
  if (sceneRaw !== 'hold' && sceneRaw !== 'bake') {
    throw new Error(`invalid scene "${sceneRaw}" (this build implements "hold" and "bake")`)
  }
  const dryRaw = params.get('dry') ?? '0'
  if (dryRaw !== '0' && dryRaw !== '1') throw new Error(`invalid dry "${dryRaw}" (use 0 or 1)`)
  const holdoffRaw = params.get('holdoff') ?? '0'
  if (holdoffRaw !== '0' && holdoffRaw !== '1') throw new Error(`invalid holdoff "${holdoffRaw}" (use 0 or 1)`)
  const sizeRaw = params.get('size')
  const blueSize = sizeRaw === null || sizeRaw === '' ? BLUE_SIZE : Number(sizeRaw)
  if (!Number.isInteger(blueSize) || blueSize < 1 || blueSize > 800) {
    throw new Error(`invalid size "${sizeRaw}"`)
  }
  const pressureRaw = params.get('pressure')
  const pressure = pressureRaw === null || pressureRaw === '' ? PRESSURE : Number(pressureRaw)
  if (!Number.isFinite(pressure) || pressure < 0 || pressure > 1) {
    throw new Error(`invalid pressure "${pressureRaw}"`)
  }
  return { scene: sceneRaw, dry: dryRaw === '1', holdoff: holdoffRaw === '1', blueSize, pressure }
}

// --- the runners ------------------------------------------------------------

interface IdleWalk {
  ticks: number
  engineMs: number
  startedAwake: boolean
  asleep: boolean
  awakeToAsleep: boolean
  /**
   * THE WINDOW MEASURE (261123-vkb): ticks from `lastWet` to the LAST AWAKE
   * OBSERVATION — never the loop-exit clock, which is the sleep-detection tick
   * and reads one too high (the engine sleeps INSIDE the stepTick that crosses
   * the bound). The first top-of-loop read is already one tick past `lastWet`,
   * so this equals the walk count on both the capped and the natural window.
   */
  windowTicks: number
  /** Diagnostics only — never feed the measure. */
  lastWetMs: number
  wetUntilMs: number
}

/**
 * The live layer's idle: one host tick per iteration, the hold re-armed after
 * every tick while the engine is not fixing, until `isAwake` is false (the sim
 * sleeps) or the bound trips. The tick IS the clock advance (adapter.stepTick
 * advances 1000 * HOST_DT), exactly the per-frame law the layer runs.
 *
 * `hold = false` is the 261123-vkb hold-off control: `setHoldWet(false)` BEFORE
 * the loop and never re-armed — the engine's own natural window.
 */
function idleWalk(
  engine: WatercolorEngine,
  adapter: ReturnType<typeof createAquarelleEngineAdapter>,
  hold = true,
): IdleWalk {
  const read = internals(engine)
  const startedAwake = engine.isAwake
  const lastWet = read.lastWet
  // Read BEFORE the walk: after an unheld sleep the peak is zeroed and
  // `wetUntil()` collapses to `lastWet`, which would hide the entry bound.
  const wetUntil = read.wetUntil()
  // The last clock the isAwake loop condition accepted as awake. Initialised to
  // the entry clock so the field is defined even if the engine starts asleep.
  let lastAwakeClock = read.clock()
  if (hold) engine.setHoldWet(true)
  else engine.setHoldWet(false)
  let ticks = 0
  while (engine.isAwake && ticks < MAX_IDLE_TICKS) {
    lastAwakeClock = read.clock()
    adapter.stepTick(ticks)
    ticks += 1
    if (hold && !engine.isFixing) engine.setHoldWet(true)
  }
  return {
    ticks,
    engineMs: round(ticks * HOST_TICK_S * 1000, 3),
    startedAwake,
    asleep: !engine.isAwake,
    awakeToAsleep: startedAwake && !engine.isAwake,
    windowTicks: Number.isFinite(lastWet) ? Math.round((lastAwakeClock - lastWet) / HOST_TICK_MS) : -1,
    lastWetMs: Number.isFinite(lastWet) ? round(lastWet, 3) : -1,
    wetUntilMs: round(wetUntil, 3),
  }
}

/**
 * Engine ticks on the frozen virtual clock (no adapter clock advance — the
 * capture paths' `engine.tick(1/60)` law) until `done`. Returns the tick count.
 */
function engineTickWalk(engine: WatercolorEngine, done: () => boolean, maxTicks: number): number {
  let ticks = 0
  while (done() && ticks < maxTicks) {
    engine.tick(HOST_TICK_S)
    ticks += 1
  }
  return ticks
}

interface SettledProof {
  rawDigest: string
  settledDigest: string
  rawAfterDigest: string
  differ: boolean
  restoredExactly: boolean
  hasStandingWaterBefore: boolean
  hasStandingWaterAfter: boolean
  wetPeakBefore: number
  wetPeakAfter: number
  depthBefore: number
  depthAfter: number
}

/**
 * `exportSettledCanvas()` is a CAPTURE, not a Dry: the settled pixels differ
 * from the raw wet sheet, and the sheet comes back exactly as wet as it was —
 * same gate, same `wetPeak`, same undo depth, raw export byte-identical again.
 */
function settledExportProof(engine: WatercolorEngine): SettledProof {
  const rawDigest = digestCanvas(engine.exportCanvas('transparent'))
  const hasStandingWaterBefore = engine.hasStandingWater
  const wetPeakBefore = round(engine.captureSheet().wetPeak)
  const depthBefore = depthOf(engine)
  const settled = engine.exportSettledCanvas()
  if (settled === null) throw new Error('exportSettledCanvas returned null on a live engine')
  const settledDigest = digestCanvas(settled)
  const rawAfterDigest = digestCanvas(engine.exportCanvas('transparent'))
  return {
    rawDigest,
    settledDigest,
    rawAfterDigest,
    differ: settledDigest !== rawDigest,
    restoredExactly: rawAfterDigest === rawDigest,
    hasStandingWaterBefore,
    hasStandingWaterAfter: engine.hasStandingWater,
    wetPeakBefore,
    wetPeakAfter: round(engine.captureSheet().wetPeak),
    depthBefore,
    depthAfter: depthOf(engine),
  }
}

// --- the freeze proof (261123-vkb) ------------------------------------------

interface FrozenRead {
  rawDigest: string
  /** The SEVEN paint layers only — `lastTouch` stores ages and cannot be stable. */
  layers: Record<string, LayerDigest>
  isAwake: boolean
  hasStandingWater: boolean
  wetPeak: number
  activeNull: boolean
}

/**
 * The held-asleep sheet, read clock-free: the raw canvas digest and the seven
 * paint-layer digests. `lastTouch` is deliberately absent — `captureWhole` puts
 * it through `stampsToAges(..., nowSec())`, so every entry is stored as AGES
 * before the capture and a clock advance raises every age by construction.
 */
function frozenRead(engine: WatercolorEngine): FrozenRead {
  const rawDigest = digestCanvas(engine.exportCanvas('transparent'))
  const snapshot = engine.captureSheet()
  return {
    rawDigest,
    layers: layerDigests(snapshot.whole, PAINT_LAYER_IDS),
    isAwake: engine.isAwake,
    hasStandingWater: engine.hasStandingWater,
    wetPeak: round(snapshot.wetPeak),
    activeNull: internals(engine).active === null,
  }
}

/** The probe's host-tick position on the adapter's virtual clock (parity read). */
function hostTicksOf(engine: WatercolorEngine): number {
  return Math.round(internals(engine).clock() / HOST_TICK_MS)
}

// --- the bake scene (--scene bake) ------------------------------------------

// ONE recorded session: a watercolor band, an acrylic stroke, a recorded Dry,
// a second watercolor stroke. Built fresh per arm (each bake owns its strokes).
function bakeEvents(blueSize: number): AquarellePayloadEvent[] {
  const bandSize = Math.round(blueSize * BAND_SIZE_RATIO)
  return [
    makeStroke(BAND_COLOR, paramsBag(bandSize, 0, 0), 0x7ec100, BAKE_BAND_MS),
    makeStroke(BLUE_COLOR, paramsBag(blueSize, 100, 100), 0x7ec101, BAKE_ACRYLIC_MS),
    createDryEvent(BAKE_DRY_TICK, BAKE_DRY_ORDER),
    makeStroke(BAND_COLOR, paramsBag(bandSize, 100, 100), 0x7ec102, BAKE_SECOND_MS),
  ]
}

/**
 * The held scene's two strokes as a recorded session for the `wetSession` bake
 * arm — the SAME seeds and params the live applies use (`HOLD_BAND_SEED` /
 * `HOLD_ACRYLIC_SEED`), with plain nonzero `recordedOrder` anchors so
 * `buildRecordedTimeline` takes its timed path. The anchors are an ORDERING
 * device only: the live path ignores `recordedOrder` and keeps its timestamp-0
 * applies byte-identical, and the bake's `previousEnd` clamp plus the
 * adapter's per-sample tick law make exact live/bake begin equality
 * unprovable.
 */
function holdSession(blueSize: number): StudioStroke<AquarelleStrokePayload>[] {
  const bandSize = Math.round(blueSize * BAND_SIZE_RATIO)
  return [
    makeStroke(BAND_COLOR, paramsBag(bandSize, 0, 0), HOLD_BAND_SEED, HOLD_BAND_ORDER),
    makeStroke(BLUE_COLOR, paramsBag(blueSize, 100, 100), HOLD_ACRYLIC_SEED, HOLD_ACRYLIC_ORDER),
  ]
}

/**
 * REPORT-ONLY mirror of `buildRecordedTimeline` (aquarelleBake.ts:426-447) —
 * the same `originMs` / `previousEnd` formula, so the readout can carry both
 * sides' resolved begin ticks beside the parity digests. It is a diagnostic,
 * NEVER a tick-alignment claim or an assertion source.
 */
function mirrorRecordedTimeline(
  strokes: readonly StudioStroke<AquarelleStrokePayload>[],
): { beginTick: number; endTick: number }[] {
  const entries: { beginTick: number; endTick: number }[] = []
  let originMs: number | null = null
  let previousEnd = 0
  for (const stroke of strokes) {
    const endMs = stroke.recordedOrder
    const durationTicks = Math.max(1, Math.trunc(stroke.ticks))
    if (originMs === null) originMs = endMs - durationTicks * HOST_TICK_MS
    const rawBegin = Math.round((endMs - durationTicks * HOST_TICK_MS - originMs) / HOST_TICK_MS)
    const beginTick = Math.max(previousEnd, Math.max(0, rawBegin))
    entries.push({ beginTick, endTick: beginTick + durationTicks })
    previousEnd = beginTick + durationTicks
  }
  return entries
}

interface LayerDigest {
  sum: number
  nonZero: number
}

/**
 * Per-layer numeric digest of a captured sheet — sum and non-zero count over
 * the raw arrays. Deterministic and readback-free: the halves decode through
 * `f16ToF32`, the exact float32 `lastTouch` sums as-is. `ids` filters the read
 * (the freeze proof uses `PAINT_LAYER_IDS`; the bake arms keep all keys).
 */
function layerDigests(whole: WholeDoc, ids?: readonly LayerId[]): Record<string, LayerDigest> {
  const out: Record<string, LayerDigest> = {}
  for (const id of ids ?? (Object.keys(whole.layers) as LayerId[])) {
    const raw = whole.layers[id]
    let values: Float32Array
    if (raw instanceof Float32Array) {
      values = raw
    } else {
      values = new Float32Array(raw.length)
      f16ToF32(raw, values)
    }
    let sum = 0
    let nonZero = 0
    for (let i = 0; i < values.length; i += 1) {
      const value = values[i]!
      if (value !== 0 && Number.isFinite(value)) {
        sum += value
        nonZero += 1
      }
    }
    out[id] = { sum: round(sum, 3), nonZero }
  }
  return out
}

interface BakeArmRead {
  settle: 'dry' | 'wet'
  ok: boolean
  path: string | null
  settleTicks: number | null
  strokeCount: number
  eventCount: number
  frames: number
  wetPeak: number
  /** Seconds since the last wet deposit; null in JSON when the sheet never wet (Infinity). */
  wetAgo: number | null
  bristleContent: boolean
  byteLength: number
  layers: Record<string, LayerDigest> | null
}

/**
 * Bake the recorded session once. `settle: 'wet'` runs on a hold-adapter with
 * the recorded Dry filtered out (the controller's wet law); `settle: 'dry'`
 * runs the untouched session on a default adapter (today's bake byte for byte).
 * The commit read is this bake's own `captureSheet()`.
 */
async function bakeArm(settle: 'dry' | 'wet', blueSize: number): Promise<BakeArmRead> {
  if (!COLD) throw new Error("paper preset 'cold' is not in PAPERS")
  const adapter = createAquarelleEngineAdapter({
    width: SHEET_W,
    height: SHEET_H,
    paperPreset: COLD,
    paperStrength: PAPER_STRENGTH,
    paperSeed: PAPER_SEED,
    holdWet: settle === 'wet',
  })
  const bakeDiagnostics: { current: AquarelleBakeDiagnostics | null } = { current: null }
  const bake = createAquarelleBake(adapter, {
    width: SHEET_W,
    height: SHEET_H,
    frameCount: 1,
    settle,
    // Stub encoder: the frame's bytes are not this scene's read (the sheet is).
    encodeWebp: () => new Uint8Array([1]),
    onDiagnostics: (record) => {
      bakeDiagnostics.current = record
    },
  })
  try {
    const session = bakeEvents(blueSize)
    // HOLD-WET: the recorded Dry is not applied — its applyDry would flash-dry
    // the very sheet the mode keeps wet (exactly the controller's filter).
    const events = settle === 'wet' ? session.filter((event) => !isAquarelleDryEvent(event)) : session
    const strokeCount = events.filter((event) => !isAquarelleDryEvent(event)).length
    const result = await bake.bake(events)
    if (!result.ok) throw new Error(`bake(${settle}) failed: ${result.reason}`)
    await bake.flush()
    const last = result.frames[result.frames.length - 1]
    const snapshot = adapter.captureSheet()
    const diagnostics = bakeDiagnostics.current
    return {
      settle,
      ok: true,
      path: diagnostics?.path ?? null,
      settleTicks: diagnostics?.settleTicks ?? null,
      strokeCount,
      eventCount: events.length,
      frames: result.frames.length,
      wetPeak: snapshot ? round(snapshot.wetPeak) : -1,
      wetAgo: snapshot && Number.isFinite(snapshot.wetAgo) ? round(snapshot.wetAgo, 4) : null,
      bristleContent: snapshot?.bristleContent ?? false,
      byteLength: last ? last.bytes.byteLength : 0,
      layers: snapshot ? layerDigests(snapshot.whole) : null,
    }
  } finally {
    bake.dispose()
    adapter.dispose()
  }
}

interface WetSessionRead {
  settle: 'wet'
  ok: boolean
  path: string | null
  settleTicks: number | null
  strokeCount: number
  eventCount: number
  frames: number
  wetPeak: number
  bristleContent: boolean
  byteLength: number
  /** The recorded anchors and durations (ordering device only). */
  recordedOrder: number[]
  ticks: number[]
  /** `buildRecordedTimeline` mirror — REPORT ONLY, never a tick-alignment claim. */
  beginTicks: number[]
  endTicks: number[]
  /** The seven PAINT layers — the same `lastTouch`-free read as the freeze proof. */
  layers: Record<string, LayerDigest> | null
}

/**
 * 261123-vkb: bake the SAME two-stroke session the held scene applied, on a
 * hold adapter with `settle: 'wet'` (the controller's live law). The gated read
 * is only the settle law (`settleTicks` 0, peak above threshold); the paint-layer
 * digests and begin ticks ride the readout for run.mjs's non-gating parity line.
 */
async function wetSessionArm(blueSize: number): Promise<WetSessionRead> {
  if (!COLD) throw new Error("paper preset 'cold' is not in PAPERS")
  const adapter = createAquarelleEngineAdapter({
    width: SHEET_W,
    height: SHEET_H,
    paperPreset: COLD,
    paperStrength: PAPER_STRENGTH,
    paperSeed: PAPER_SEED,
    holdWet: true,
  })
  const bakeDiagnostics: { current: AquarelleBakeDiagnostics | null } = { current: null }
  const bake = createAquarelleBake(adapter, {
    width: SHEET_W,
    height: SHEET_H,
    frameCount: 1,
    settle: 'wet',
    // Stub encoder: the frame's bytes are not this arm's read (the sheet is).
    encodeWebp: () => new Uint8Array([1]),
    onDiagnostics: (record) => {
      bakeDiagnostics.current = record
    },
  })
  try {
    const session = holdSession(blueSize)
    const result = await bake.bake(session)
    if (!result.ok) throw new Error(`bake(wetSession) failed: ${result.reason}`)
    await bake.flush()
    const last = result.frames[result.frames.length - 1]
    const snapshot = adapter.captureSheet()
    const diagnostics = bakeDiagnostics.current
    const timeline = mirrorRecordedTimeline(session)
    return {
      settle: 'wet',
      ok: true,
      path: diagnostics?.path ?? null,
      settleTicks: diagnostics?.settleTicks ?? null,
      strokeCount: session.length,
      eventCount: session.length,
      frames: result.frames.length,
      wetPeak: snapshot ? round(snapshot.wetPeak) : -1,
      bristleContent: snapshot?.bristleContent ?? false,
      byteLength: last ? last.bytes.byteLength : 0,
      recordedOrder: session.map((stroke) => stroke.recordedOrder),
      ticks: session.map((stroke) => Math.max(1, Math.trunc(stroke.ticks))),
      beginTicks: timeline.map((entry) => entry.beginTick),
      endTicks: timeline.map((entry) => entry.endTick),
      layers: snapshot ? layerDigests(snapshot.whole, PAINT_LAYER_IDS) : null,
    }
  } finally {
    bake.dispose()
    adapter.dispose()
  }
}

/** The ink layers as one comparable string — the A/B digests joined. */
function inkDigestOf(arm: BakeArmRead): string | null {
  if (!arm.layers) return null
  const inkA = arm.layers.inkA
  const inkB = arm.layers.inkB
  if (!inkA || !inkB) return null
  return `A:${inkA.sum}/${inkA.nonZero}|B:${inkB.sum}/${inkB.nonZero}`
}

async function runSceneBake(config: SceneConfig, renderer: string): Promise<Record<string, unknown>> {
  const blueSize = config.blueSize
  const wet = await bakeArm('wet', blueSize)
  const dry = await bakeArm('dry', blueSize)
  const wetSession = await wetSessionArm(blueSize)
  const wetInk = inkDigestOf(wet)
  const dryInk = inkDigestOf(dry)
  const assertions = [
    {
      name: 'bake.wet.wetPeak > WET_THRESHOLD',
      ok: wet.wetPeak > WET_THRESHOLD,
      detail: `${wet.wetPeak} vs ${WET_THRESHOLD}`,
    },
    {
      name: 'bake.wet.settleTicks 0',
      ok: wet.settleTicks === 0,
      detail: String(wet.settleTicks),
    },
    {
      name: 'bake.dry.wetPeak 0',
      ok: dry.wetPeak === 0,
      detail: String(dry.wetPeak),
    },
    {
      name: 'bake.dry.settleTicks 72',
      ok: dry.settleTicks === BAKE_SETTLE_TICKS,
      detail: `${dry.settleTicks} vs ${BAKE_SETTLE_TICKS}`,
    },
    {
      name: 'bake.ink digests differ',
      ok: wetInk !== null && dryInk !== null && wetInk !== dryInk,
      detail: `wet ${wetInk} vs dry ${dryInk}`,
    },
    {
      name: 'wetSession.settleTicks 0 (the held session baked wet)',
      ok: wetSession.settleTicks === 0,
      detail: String(wetSession.settleTicks),
    },
    {
      name: 'wetSession.wetPeak > WET_THRESHOLD',
      ok: wetSession.wetPeak > WET_THRESHOLD,
      detail: `${wetSession.wetPeak} vs ${WET_THRESHOLD}`,
    },
  ]
  const failed = assertions.filter((entry) => !entry.ok)
  if (failed.length > 0) {
    throw new Error(`bake assertions failed: ${failed.map((entry) => `${entry.name} (${entry.detail})`).join('; ')}`)
  }
  return {
    scene: 'bake',
    arm: 'bake',
    config: {
      sheetW: SHEET_W,
      sheetH: SHEET_H,
      paperSeed: PAPER_SEED,
      paperStrength: PAPER_STRENGTH,
      blueSize,
      bandSize: Math.round(blueSize * BAND_SIZE_RATIO),
      wetSeconds: WET_SECONDS,
      dryParam: DRY_PARAM,
      wetThreshold: WET_THRESHOLD,
      settleTicks: BAKE_SETTLE_TICKS,
      recordedOrder: [BAKE_BAND_MS, BAKE_ACRYLIC_MS, BAKE_DRY_ORDER, BAKE_SECOND_MS],
    },
    renderer,
    wet,
    dry,
    wetSession,
    assertions,
    verdict: 'WET-HOLD CAPTURED',
  }
}

function runScene(config: SceneConfig, renderer: string): Record<string, unknown> {
  if (config.scene !== 'hold') throw new Error(`runScene: wrong scene "${config.scene}"`)
  if (!COLD) throw new Error("paper preset 'cold' is not in PAPERS")
  const blueSize = config.blueSize
  const bandSize = Math.round(blueSize * BAND_SIZE_RATIO)

  capturedEngine = null
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
    // The live layer's construction arm: the ONE hold authority.
    engine.setHoldWet(true)

    // 261123-vkb parity read: the probe's host-tick position immediately before
    // each live applyStroke (the same seeds/params as `holdSession`). MEASURED
    // for the bake scene's non-gating parity line, never asserted.
    const liveBegins: { band: number; acrylic: number } = { band: 0, acrylic: 0 }

    // 1. The watercolor underpaint (the 64-21 band): Body 0 on the bristle
    //    path keeps the coverage channel at its Body-0 floor, so the carrier's
    //    gate has paint to read (the non-bristle Body-0 path writes no cover).
    liveBegins.band = hostTicksOf(engine)
    adapter.applyStroke(makeStroke(BAND_COLOR, paramsBag(bandSize, 0, 0), HOLD_BAND_SEED))
    settle()
    const depthAfterBand = depthOf(engine)

    // 2. The acrylic stroke — the PICKUP CONTROL. Fresh stamps, so its carried
    //    hue drag is the level the held run's post-idle stroke must retain.
    liveBegins.acrylic = hostTicksOf(engine)
    adapter.applyStroke(makeStroke(BLUE_COLOR, paramsBag(blueSize, 100, 100), HOLD_ACRYLIC_SEED))
    const controlCarried = readCarried(engine)
    const controlFilm = filmStats(engine.exportCanvas('transparent'), engine.exportCoverageCanvas())
    const blueHue = pigmentHue(BLUE_COLOR)
    const control = {
      depth: depthOf(engine),
      depthAfterBand,
      hasStandingWater: engine.hasStandingWater,
      wetPeak: round(engine.captureSheet().wetPeak),
      ownHueDeg: roundOrNull(blueHue),
      carried: controlCarried,
      pickupDragDeg: roundOrNull(hueDistance(controlCarried.loadedHueDeg, blueHue)),
      rimDragDeg: roundOrNull(hueDistance(controlCarried.rimHueDeg, blueHue)),
      centreDragDeg: roundOrNull(hueDistance(controlCarried.centreHueDeg, blueHue)),
      filmHueDeg: roundOrNull(controlFilm.hueDeg),
      filmSrgb: controlFilm.meanSrgb,
      filmTexels: controlFilm.texels,
    }

    const reportConfig = {
      sheetW: SHEET_W,
      sheetH: SHEET_H,
      paperSeed: PAPER_SEED,
      paperStrength: PAPER_STRENGTH,
      blueSize,
      bandSize,
      pressure: PRESSURE,
      wetSeconds: WET_SECONDS,
      dryParam: DRY_PARAM,
      settleTicks: SETTLE_TICKS,
      maxFixTicks: MAX_FIX_TICKS,
      maxIdleTicks: MAX_IDLE_TICKS,
      wetThreshold: WET_THRESHOLD,
      // 261123-vkb: the visible settle cap the held awake window is bounded at.
      capTicks: aquarelleVisibleSettleTicks(DRY_PARAM),
      holdoff: config.holdoff,
    }

    // 3a. The hold-off control (261123-vkb): the SAME session with the hold
    //     lifted before the idle — the engine's own natural window, then its
    //     own unheld sleep (peak zeroed, gate closed). The wet-dependent blocks
    //     below cannot run on a dry sheet, so the report stops after the reads.
    if (config.holdoff) {
      const idle = idleWalk(engine, adapter, false)
      const postSleep = {
        isAwake: engine.isAwake,
        hasStandingWater: engine.hasStandingWater,
        wetPeak: round(engine.captureSheet().wetPeak),
        strokeNull: internals(engine).stroke === null,
        activeNull: internals(engine).active === null,
      }
      return {
        scene: config.scene,
        arm: 'heldoff',
        config: reportConfig,
        renderer,
        evictions: internals(engine).history.evictions,
        stepRecording: internals(engine).stepRecording,
        control,
        liveBegins,
        idle,
        postSleep,
        settledAsleep: null,
        fix: null,
        second: null,
        settledAwake: null,
        captureSettle: null,
        verdict: 'WET-HOLD CAPTURED',
      }
    }

    // 3. Idle (held) or the explicit Dry (the control).
    let idle: IdleWalk | null = null
    let postSleep: Record<string, unknown> | null = null
    let settledAsleep: SettledProof | null = null
    let frozen: FrozenRead | null = null
    let frozenAfter: FrozenRead | null = null
    let fix: Record<string, unknown> | null = null
    if (config.dry) {
      const depthBeforeFix = depthOf(engine)
      engine.fix()
      const fixTicks = engineTickWalk(engine, () => engine.isFixing, MAX_FIX_TICKS)
      fix = {
        applied: true,
        depthBeforeFix,
        fixTicks,
        depthAfterFix: depthOf(engine),
        hasStandingWaterAfterFix: engine.hasStandingWater,
        wetPeakAfterFix: round(engine.captureSheet().wetPeak),
        // The explicit Dry lifts the hold (the one writer outside the setter).
        holdAfterFix: (engine as unknown as { holdWet: boolean }).holdWet,
      }
      // The post-Dry state is the control's whole point; re-arm the hold the
      // way the live layer's next rAF would (it must not restore water — the
      // Dry cleared the last-touch memory, and the hold only stops decay).
      engine.setHoldWet(true)
    } else {
      idle = idleWalk(engine, adapter)
      postSleep = {
        isAwake: engine.isAwake,
        hasStandingWater: engine.hasStandingWater,
        wetPeak: round(engine.captureSheet().wetPeak),
        strokeNull: internals(engine).stroke === null,
        activeNull: internals(engine).active === null,
      }
      settledAsleep = settledExportProof(engine)
      // 3b. THE FREEZE PROOF (261123-vkb): the settled-export capture above
      //     restores the sheet exactly (its own read proves the raw digest
      //     identical), so the two reads below still bracket the cap state.
      //     +30 s of clock (1800 host ticks, argument ignored by stepTick) must
      //     leave the sheet byte-identical — no fix, no decay and no
      //     mobile-to-fixed while held and asleep.
      frozen = frozenRead(engine)
      for (let i = 0; i < FREEZE_ADVANCE_TICKS; i += 1) adapter.stepTick(i)
      frozenAfter = frozenRead(engine)
    }

    // 4. The SECOND acrylic stroke over the same footprint — the artist's
    //    "does the next stroke still blend" surface. Yellow over the acrylic
    //    blue: a different pigment from the canvas, so the same-paint lift
    //    gate stays open and the carrier can actually drag the canvas colour.
    const hasStandingWaterBeforeSecond = engine.hasStandingWater
    const depthBeforeSecond = depthOf(engine)
    adapter.applyStroke(makeStroke(BAND_COLOR, paramsBag(blueSize, 100, 100), 0x7ec002))
    const secondCarried = readCarried(engine)
    const secondFilm = filmStats(engine.exportCanvas('transparent'), engine.exportCoverageCanvas())
    const yellowHue = pigmentHue(BAND_COLOR)
    const second = {
      color: BAND_COLOR,
      depthBefore: depthBeforeSecond,
      depthAfter: depthOf(engine),
      hasStandingWaterBefore: hasStandingWaterBeforeSecond,
      hasStandingWaterAfter: engine.hasStandingWater,
      strokeNull: internals(engine).stroke === null,
      activeNonNull: internals(engine).active !== null,
      isFixing: engine.isFixing,
      ownHueDeg: roundOrNull(yellowHue),
      carried: secondCarried,
      pickupDragDeg: roundOrNull(hueDistance(secondCarried.loadedHueDeg, yellowHue)),
      rimDragDeg: roundOrNull(hueDistance(secondCarried.rimHueDeg, yellowHue)),
      centreDragDeg: roundOrNull(hueDistance(secondCarried.centreHueDeg, yellowHue)),
      filmHueDeg: roundOrNull(secondFilm.hueDeg),
      filmSrgb: secondFilm.meanSrgb,
      filmTexels: secondFilm.texels,
    }

    // 5. The AWAKE-window settled export — the regression for a guard keyed on
    //    `active` (non-null for the whole awake window) instead of the
    //    in-flight stroke. Asserted here: stroke null, active non-null, wet.
    let settledAwake: SettledProof | null = null
    if (!config.dry) settledAwake = settledExportProof(engine)

    // 6. `settleForCapture()` — the capture path's settle: the same tick law
    //    with NO engine history step and NO last-touch clear.
    const captureSettleDepthBefore = depthOf(engine)
    const captureSettleCalled = engine.settleForCapture()
    const captureSettleTicks = engineTickWalk(engine, () => engine.isFixing, MAX_FIX_TICKS)
    const captureSettle = {
      called: captureSettleCalled,
      ticks: captureSettleTicks,
      depthBefore: captureSettleDepthBefore,
      depthAfter: depthOf(engine),
      hasStandingWater: engine.hasStandingWater,
      wetPeak: round(engine.captureSheet().wetPeak),
    }

    return {
      scene: config.scene,
      arm: config.dry ? 'dry' : 'held',
      config: reportConfig,
      renderer,
      // The depth reads are only meaningful while no step was evicted: the
      // history's tile pools drop the oldest step to make room, so an eviction
      // caps `entries().index` below the real step count (measured once: a
      // third full-width stroke took depth 3 -> 2 with evictions 1).
      evictions: internals(engine).history.evictions,
      stepRecording: internals(engine).stepRecording,
      control,
      liveBegins,
      idle,
      postSleep,
      settledAsleep,
      frozen,
      frozenAfter,
      fix,
      second,
      settledAwake,
      captureSettle,
      verdict: 'WET-HOLD CAPTURED',
    }
  } finally {
    adapter.dispose()
  }
}

async function main(): Promise<void> {
  let config: SceneConfig = { scene: 'hold', dry: false, holdoff: false, blueSize: BLUE_SIZE, pressure: PRESSURE }
  let renderer = '(unknown)'
  try {
    config = readSceneConfig()
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
    const result = config.scene === 'bake'
      ? await runSceneBake(config, renderer)
      : runScene(config, renderer)
    const pre = document.getElementById('result')
    if (!pre) throw new Error('probe page is missing pre#result')
    pre.textContent = JSON.stringify(result)
    pre.setAttribute('data-verdict', 'WET-HOLD CAPTURED')
    const status = document.getElementById('status')
    if (status) status.textContent = 'DONE'
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const pre = document.getElementById('result')
    if (pre) {
      pre.textContent = JSON.stringify({ config, renderer, verdict: `WET-HOLD FAIL ${message}`, error: message })
    }
    const status = document.getElementById('status')
    if (status) status.textContent = 'FAILED'
  }
}

void main()
