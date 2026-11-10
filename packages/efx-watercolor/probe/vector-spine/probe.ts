// ============================================================
//  Vector spine — watercolor feasibility probe (Phase 61 Wave 0).
//
//  SCRATCH HARNESS ONLY. Imports engine internals, touches no product
//  code. Runs the REAL vendored WebGL2 WatercolorEngine (the same
//  engine the live sheet and the bake replay on) in headless Chrome
//  and answers the five ROADMAP spike questions before any vector
//  data-model field is written:
//
//   1. Segment-runs vs payload-extension seam quality at segment joins.
//   2. The sampling law at 1x / 4x / 16x tick density.
//   3. The seam step metric across segment joins (8px window scan).
//   4. Dab-count cost vs stroke count at 1920x1080 / 2048x1536 /
//      3072x2304.
//   5. Byte identity of one stroke replayed twice on fresh adapters.
//
//  Plus the C-03 width evidence: the `scriptScale` clamp measured
//  alongside the `sizeMult` channel the phase will build.
//
//  Fixed seed: Math.random is pinned to a mulberry32 around engine /
//  adapter construction so the constructor's paperSeed draw is
//  deterministic. Each stroke then reseeds the engine RNG from
//  traceSeed exactly like the adapter does.
// ============================================================

import { WatercolorEngine, type Tool } from '../../src/playground/Engine'
import { DEFAULT_CANONICAL_PARAMS, toEngineParams } from '../../src/playground/params'
import { buildBrushForStroke } from '../../src/playground/brushBridge'
import { pigmentFromHex } from '../../src/playground/spectral'
import {
  toStudioStroke,
  type AquarellePoint,
  type AquarelleStrokePayload,
} from '../../src/payload/toStudioStroke'
import { createAquarelleEngineAdapter } from '../../src/adapter/engineAdapter'
import type { StudioStroke } from '@efxlab/efx-paint-host/animation'

const HOST_DT = 1 / 60
const PAPER_SEED = 0xc0ffee
const MUTATION_ID = 0x51c0de
const STROKE_COLOR = '#1f3b73'
const BRUSH_ID = 'wc/round-medium'
const PRESSURE = 0.55

// The three-anchor path used by the digest pair and the seam A/B.
// uv is document space: y up, x spans `aspect` heights.
const SHEET_W = 1920
const SHEET_H = 1080
const JOIN_ANCHORS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0.35, y: 0.3 },
  { x: 0.5, y: 0.62 },
  { x: 0.65, y: 0.32 },
]

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

// --- sample path ------------------------------------------------------------

/**
 * Resample a polyline of anchors uniformly by arc length (each anchor
 * segment contributes exactly `density` samples; the first anchor is
 * emitted once). At density 1 this is the recorded anchor list itself.
 */
function resampleAnchors(
  anchors: ReadonlyArray<{ x: number; y: number }>,
  density: number,
): AquarellePoint[] {
  const pts: AquarellePoint[] = []
  for (let s = 0; s < anchors.length - 1; s += 1) {
    const a = anchors[s]!
    const b = anchors[s + 1]!
    const from = s === 0 ? 0 : 1
    for (let k = from; k <= density; k += 1) {
      const t = k / density
      pts.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        p: PRESSURE,
        tx: 0,
        ty: 0,
        tw: 0,
      })
    }
  }
  return pts
}

function makeStroke(points: AquarellePoint[]): StudioStroke<AquarelleStrokePayload> {
  return toStudioStroke({
    tool: 'brush',
    color: STROKE_COLOR,
    params: { ...DEFAULT_CANONICAL_PARAMS },
    brushId: BRUSH_ID,
    points,
    mutationId: MUTATION_ID,
    timestamp: 0,
  })
}

// --- adapter helpers --------------------------------------------------------

type Adapter = ReturnType<typeof createAquarelleEngineAdapter>

/**
 * Construct an adapter with the paper seed pinned. The engine constructor
 * draws `paperSeed` from Math.random before the adapter installs its own
 * RNG, so an unpinned constructor makes every digest meaningless.
 */
function createPinnedAdapter(width: number, height: number): Adapter {
  return withSeededMathRandom(PAPER_SEED, () =>
    createAquarelleEngineAdapter({ width, height }),
  )
}

/**
 * Drive a whole stroke through the adapter with feedDueSample's law:
 * one recorded sample, then one engine.tick per sample — never a single
 * batch call. renderPartialStrokes is the public progressive seam; each
 * call feeds exactly one more sample. The final flush tick matches
 * applyStroke's tail tick.
 */
function runStroke(adapter: Adapter, stroke: StudioStroke<AquarelleStrokePayload>): void {
  for (let i = 1; i <= stroke.pts.length; i += 1) {
    adapter.renderPartialStrokes([{ stroke, pointCount: i }])
  }
  adapter.stepTick(0)
}

function captureAdapter(adapter: Adapter): Uint8ClampedArray {
  const canvas = adapter.captureFrame() as HTMLCanvasElement
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('capture: no 2D context')
  return new Uint8ClampedArray(ctx.getImageData(0, 0, canvas.width, canvas.height).data)
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

interface DigestRun {
  readonly digest: string
  readonly byteLength: number
}

function digestRun(
  width: number,
  height: number,
  anchors: ReadonlyArray<{ x: number; y: number }>,
  density: number,
): DigestRun {
  const adapter = createPinnedAdapter(width, height)
  try {
    const stroke = makeStroke(resampleAnchors(anchors, density))
    runStroke(adapter, stroke)
    const buffer = captureAdapter(adapter)
    return { digest: hashPixels(buffer), byteLength: buffer.length }
  } finally {
    adapter.dispose()
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

function main(): void {
  const renderer = probeRenderer()
  const first = digestRun(SHEET_W, SHEET_H, JOIN_ANCHORS, 1)
  const second = digestRun(SHEET_W, SHEET_H, JOIN_ANCHORS, 1)
  const identical = first.digest === second.digest

  const verdict = `VECTOR-SPINE ${identical ? 'PASS' : 'FAIL'} digest=${first.digest} identical=${identical}`

  writeResult({
    scenario: 'vector-spine',
    kind: 'auto',
    widthFactor: 1,
    density: 1,
    sheet: `${SHEET_W}x${SHEET_H}`,
    samplesPerStroke: resampleAnchors(JOIN_ANCHORS, 1).length,
    digestA: first.digest,
    digestB: second.digest,
    byteLength: first.byteLength,
    byteLengthB: second.byteLength,
    identical,
    env: { renderer: String(renderer), userAgent: navigator.userAgent },
    verdict,
  })
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  writeResult({
    scenario: 'vector-spine',
    density: 1,
    digestA: '',
    digestB: '',
    byteLength: 0,
    verdict: `VECTOR-SPINE FAIL ${message}`,
    error: message,
  })
}
