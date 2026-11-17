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
// global. No `viscosity` key: this gate proves the ABSENT key keeps the
// pre-milestone render — that is the neutral-default contract.
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

// --- the fixed scenario -----------------------------------------------------

function makeStroke(): StudioStroke<AquarelleStrokePayload> {
  return toStudioStroke({
    tool: 'brush',
    color: STROKE_COLOR,
    params: { ...STROKE_PARAMS },
    brushId: BRUSH_ID,
    points: STROKE_POINTS.map((point) => ({ ...point })),
    mutationId: MUTATION_ID,
    timestamp: 0,
  })
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

function run(gate: string, renderer: string): void {
  if (!COLD) throw new Error("paper preset 'cold' is not in PAPERS")

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
    adapter.applyStroke(makeStroke())
    // Plan 64-01: stepTick for ticks 0 through 8, then fix().
    for (let tick = 0; tick <= SETTLE_TICKS; tick += 1) adapter.stepTick(tick)
    adapter.fix()

    const engine = capturedEngine
    if (engine === null) throw new Error('probe never captured the adapter engine (setManual tap missed)')

    const paper = digestCanvas(engine.exportCanvas('paper'))
    const transparent = digestCanvas(engine.exportCanvas('transparent'))
    const white = digestCanvas(engine.exportCanvas('white'))

    writeResult({
      gate,
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

function main(): void {
  const gate = new URLSearchParams(location.search).get('gate') ?? 'neutral-identity'
  let renderer = '(unknown)'
  try {
    renderer = probeRenderer()
    run(gate, renderer)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    writeResult({
      gate,
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
