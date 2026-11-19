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
//  Size calibration: the blue stroke's canonical size is fitted so the
//  measured stroke half-width matches the reference lab's own MEASURED
//  mean half-width within 10%. The reference's cycle entry is
//  0.085 x 600 / 2 = 25.5 px nominal; its seven-scene capture reports a
//  measured mean of 10 px (per-scene spread 6..14.5 px). Size 4 measures
//  10.07 px on the same seven-scene set (+0.7%). The D-E `dry: 0` pin
//  moved the fit: the light wash no longer starves, and the bristle floor
//  (BRISTLE_MIN 40) puts Studio's own minimum at 8 px, so the reference's
//  narrowest blank-p0 (6.0 px) is unreachable at any size. The band's
//  canonical size is the blue's times the reference's width ratio
//  0.12 / 0.085. The chosen values and the measured half-width are echoed
//  in every record's params, and run.mjs aggregates them into the
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
const BRUSH_ID = 'bristle-flat'
/** The reference's cycle-entry widths (app.js palette, §6 defaults). */
const BAND_FRACTION = 0.12
const BLUE_FRACTION = 0.085
/**
 * Canonical blue size, RE-fitted on 2026-11-19 after the D-E `dry: 0` pin
 * (the acceptance pin keeps the light wash alive; the older dry-50 fit no
 * longer applies). Against the reference lab's MEASURED mean half-width
 * (its seven-scene capture reports 10 px; the cycle-entry footprint is
 * 25.5 px nominal) size 4 measures 10.07 px across the seven stroke scenes
 * — +0.7%, inside the 10% band. Per scene the reference's blank-p0 is the
 * narrowest of its set at 6.0 px against Studio's 10 px there: the dry-0
 * wash no longer starves, and the bristle floor (BRISTLE_MIN 40, size 2)
 * puts Studio's own minimum at 8 px, so no size can reach 6.0 px. The
 * mean-to-mean fit is the comparison both captures' `calibration` blocks
 * print; both numbers and the reference's per-scene spread (6..14.5 px)
 * are recorded in the capture, never inferred.
 */
const DEFAULT_BLUE_SIZE = 4

const COLD: PaperPreset | undefined = PAPERS.find((preset) => preset.id === 'cold')

// --- scene table ------------------------------------------------------------

interface SceneSpec {
  readonly name: string
  readonly band: boolean
  readonly stroke: boolean
  readonly pickup: number | null
  readonly feather: number | null
  readonly body: number | null
}

const SCENES: readonly SceneSpec[] = [
  { name: 'blank', band: false, stroke: false, pickup: null, feather: null, body: null },
  { name: 'band', band: true, stroke: false, pickup: 0, feather: 0, body: 0 },
  { name: 'band-p0', band: true, stroke: true, pickup: 0, feather: 0, body: 0 },
  { name: 'band-p100', band: true, stroke: true, pickup: 100, feather: 0, body: 0 },
  { name: 'blank-p0', band: false, stroke: true, pickup: 0, feather: 0, body: 0 },
  { name: 'blank-f0', band: false, stroke: true, pickup: 100, feather: 0, body: 0 },
  { name: 'blank-f100', band: false, stroke: true, pickup: 100, feather: 100, body: 0 },
  { name: 'body0', band: false, stroke: true, pickup: 100, feather: 0, body: 0 },
  { name: 'body100', band: false, stroke: true, pickup: 100, feather: 0, body: 100 },
]

// --- the fixed path ---------------------------------------------------------

/** The reference's horizontal path, four knots at pressure 0.75 (doc uv, y up). */
function horizontalPoints(): readonly AquarellePoint[] {
  return [0.12, 0.3733, 0.6267, 0.88].map((x) => ({ x, y: 0.5, p: 0.75, tx: 0, ty: 0, tw: 0 }))
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
): Record<string, number> {
  return {
    size: sizePx,
    water: 50,
    load: 50,
    flow: 50,
    bleed: 50,
    dry: 0,
    edge: 50,
    granulation: 50,
    lift: 22,
    pickup,
    feather,
    body,
    refill: 0,
    wetSeconds: 7,
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
    points: horizontalPoints().map((point) => ({ ...point })),
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
  // The band's canonical size mirrors the reference's width ratio.
  const bandSize = Math.round(blueSize * (BAND_FRACTION / BLUE_FRACTION))

  // The canary above constructed and destroyed its own engine; the tap must
  // see the adapter's engine and only the adapter's engine.
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
    if (spec.stroke) {
      adapter.applyStroke(
        makeStroke(
          BLUE_COLOR,
          paramsBag(blueSize, spec.pickup ?? 0, spec.feather ?? 0, spec.body ?? 0),
          0x7ec001,
        ),
      )
      settle()
      finalPaper = captureCanvas(engine.exportCanvas('paper'))
      finalPigment = captureCanvas(engine.exportCanvas('pigment'))
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
            blueSizePx: blueSize,
            bandSizePx: bandSize,
          }

    const record = measureScene({
      scene: spec.name,
      pre: pre.rgba,
      substrate: substrate ? substrate.rgba : null,
      finalPaper: finalPaper.rgba,
      finalPigment: finalPigment ? finalPigment.rgba : null,
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
