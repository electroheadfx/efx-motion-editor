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
//  The report digests all three exported backgrounds (paper, transparent,
//  white) and echoes the 64-04 `--light <0..4>` intensity it was shaded with.
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
// ============================================================

import { WatercolorEngine } from '../../src/playground/Engine'
import { PAPERS, type PaperPreset } from '../../src/playground/papers'
import { createAquarelleEngineAdapter } from '../../src/adapter/engineAdapter'
import {
  toStudioStroke,
  type AquarellePoint,
  type AquarelleStrokePayload,
} from '../../src/payload/toStudioStroke'
import type { StudioStroke } from '@efxlab/efx-paint-host/animation'

// The sheet the gate always renders. Small enough for a fast headless
// run, large enough that one stroke of the fixed script is well above
// the paper-grain noise floor.
const SHEET = 256
// Pinned constructor draw: the engine's `paperSeed` comes from
// Math.random before the adapter installs its own RNG, so an unpinned
// constructor makes every digest meaningless.
const PAPER_SEED = 0xc0ffee
const PAPER_STRENGTH = 1
const MUTATION_ID = 0x6d65d1
const STROKE_COLOR = '#2244aa'
const BRUSH_ID = 'round'
const SETTLE_TICKS = 8

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
}

/** The canonical bag as the app records it (0..100). A knob adds its key;
 *  absent knobs add nothing — the neutral gate must send the plan-01 bag. */
function paramsBag(entry: ScriptEntry): Record<string, number> {
  const bag: Record<string, number> = { ...STROKE_PARAMS }
  if (entry.emboss !== undefined) bag['emboss'] = entry.emboss
  if (entry.body !== undefined) bag['body'] = entry.body
  return bag
}

function makeStroke(entry: ScriptEntry): StudioStroke<AquarelleStrokePayload> {
  return toStudioStroke({
    tool: 'brush',
    color: entry.color,
    params: paramsBag(entry),
    brushId: BRUSH_ID,
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
  emboss?: number,
  body?: number,
  light?: number,
): void {
  if (!COLD) throw new Error("paper preset 'cold' is not in PAPERS")
  const script = scenario === 'cover' ? coverScript(emboss, body) : neutralScript(emboss, body)

  // The tap must see the adapter's engine and only the adapter's engine:
  // the canary above already constructed and destroyed its own.
  capturedEngine = null
  const adapter = withSeededMathRandom(PAPER_SEED, () =>
    createAquarelleEngineAdapter({
      width: SHEET,
      height: SHEET,
      paperPreset: COLD,
      paperStrength: PAPER_STRENGTH,
    }),
  )

  try {
    // 64-06: bakeMs covers the script + settle only — the exports below are
    // the capture, not the medium, so they never inflate the cost number.
    const bakeStart = performance.now()
    for (const entry of script) {
      adapter.applyStroke(makeStroke(entry))
      // Plan 64-01: stepTick for ticks 0 through 8, then fix().
      for (let tick = 0; tick <= SETTLE_TICKS; tick += 1) adapter.stepTick(tick)
      adapter.fix()
    }
    const bakeMs = Math.round(performance.now() - bakeStart)

    const engine = capturedEngine
    if (engine === null) throw new Error('probe never captured the adapter engine (setManual tap missed)')

    // 64-04: the light is render state, so it is applied after the script
    // settles and before any export. Intensity 0 is the second identity gate:
    // the lit delta is an intensity multiple, so a lit embossed stroke must
    // reproduce the unlit baseline. Omitted leaves DEFAULT_LIGHT (intensity 1).
    if (light !== undefined) engine.setLight({ intensity: light })

    const paper = digestCanvas(engine.exportCanvas('paper'))
    const transparent = digestCanvas(engine.exportCanvas('transparent'))
    const white = digestCanvas(engine.exportCanvas('white'))

    writeResult({
      gate,
      scenario,
      emboss: emboss ?? null,
      body: body ?? null,
      light: light ?? null,
      bakeMs,
      width: SHEET,
      height: SHEET,
      digestPaper: paper.digest,
      digestTransparent: transparent.digest,
      digestWhite: white.digest,
      byteLength: paper.byteLength,
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

/** 64-06: the scenario selector — absent renders the plan-01 single stroke. */
function readScenario(): string {
  const raw = new URLSearchParams(location.search).get('scenario')
  if (raw === null || raw === '') return 'neutral'
  if (raw !== 'cover') throw new Error(`invalid scenario "${raw}" (expected "cover")`)
  return raw
}

function main(): void {
  const gate = new URLSearchParams(location.search).get('gate') ?? 'neutral-identity'
  let renderer = '(unknown)'
  let scenario = 'neutral'
  let emboss: number | undefined
  let body: number | undefined
  let light: number | undefined
  try {
    scenario = readScenario()
    emboss = readEmboss()
    body = readBody()
    light = readLight()
    renderer = probeRenderer()
    run(gate, renderer, scenario, emboss, body, light)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    writeResult({
      gate,
      scenario,
      emboss: emboss ?? null,
      body: body ?? null,
      light: light ?? null,
      bakeMs: null,
      width: SHEET,
      height: SHEET,
      digestPaper: null,
      digestTransparent: null,
      digestWhite: null,
      byteLength: null,
      renderer,
      verdict: `MEDIUM-ENGINE FAIL ${message}`,
      error: message,
    })
  }
}

main()
