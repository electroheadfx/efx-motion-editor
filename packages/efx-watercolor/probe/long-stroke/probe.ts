// ============================================================
//  long-stroke/probe.ts — why a bristle stroke empties.
//
//  The artist (2026-11-21): Dry speed 0 and Pigment 100, yet an
//  acrylic stroke loses paint and breaks into specks within one
//  letter; the breakup tracks PRESSURE, not speed.
//
//  This probe paints ONE serpentine stroke (three sheet rows of
//  travel) at constant pressure and constant sample spacing, with
//  the acrylic medium's bag at Dry 0 / Pigment 100, and reports:
//    - the mean pigment alpha in small boxes along the path
//      (a solid stroke reads a flat profile; a drying one falls)
//    - the per-bristle load LEFT after the stroke (readBristles)
//  Cases sweep pressure and, as a control, Dry 70 at full pressure.
//
//  Scratch harness; nothing here is imported by the package.
// ============================================================

import { WatercolorEngine } from '../../src/playground/Engine'
import { MEDIUMS } from '../../src/playground/mediums'
import { PAPERS, type PaperPreset } from '../../src/playground/papers'
import { createAquarelleEngineAdapter } from '../../src/adapter/engineAdapter'
import {
  toStudioStroke,
  type AquarellePoint,
  type AquarelleStrokePayload,
} from '../../src/payload/toStudioStroke'
import { f16ToF32 } from '../../src/playground/half'

const SHEET_W = 800
const SHEET_H = 600
const PAPER_SEED = 0xc0ffee
const PAPER_STRENGTH = 1
const MUTATION_ID = 0x6d65d1
const STROKE_COLOR = '#2244aa'
const SETTLE_TICKS = 8
const SIZE = 40
const BRUSH = 'bristle-round'
const COLD: PaperPreset | undefined = PAPERS.find((preset) => preset.id === 'cold')

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

let capturedEngine: WatercolorEngine | null = null
const enginePrototype = WatercolorEngine.prototype as unknown as {
  setManual: (manual: boolean) => void
}
const originalSetManual = enginePrototype.setManual
enginePrototype.setManual = function patchedSetManual(this: WatercolorEngine, manual: boolean) {
  if (capturedEngine === null) capturedEngine = this
  return originalSetManual.call(this, manual)
}

function acrylicParams(dry: number): Record<string, number> {
  const medium = MEDIUMS.find((candidate) => candidate.id === 'acrylic')
  if (!medium) throw new Error('acrylic medium missing')
  return {
    size: SIZE,
    ...medium.params,
    dry,
    load: 100,
    water: 5,
  }
}

/** Three rows of serpentine travel, evenly spaced so the speed is constant. */
function serpentine(pressure: number): AquarellePoint[] {
  const points: AquarellePoint[] = []
  const rows = [0.25, 0.5, 0.75]
  const perRow = 20
  let flip = false
  for (const y of rows) {
    for (let i = 0; i < perRow; i += 1) {
      const t = i / (perRow - 1)
      const x = flip ? 0.85 - 0.7 * t : 0.15 + 0.7 * t
      points.push({ x, y, p: pressure, tx: 0, ty: 0, tw: 0 })
    }
    flip = !flip
  }
  return points
}

interface Report {
  pressure: number
  dry: number
  segments: number[]
  covered: number
  loadMin: number
  loadMean: number
  loadMax: number
  bristles: number
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

function runCase(pressure: number, dry: number): Report {
  if (!COLD) throw new Error("paper preset 'cold' is not in PAPERS")
  capturedEngine = null
  const adapter = withSeededMathRandom(PAPER_SEED, () =>
    createAquarelleEngineAdapter({
      width: SHEET_W,
      height: SHEET_H,
      paperPreset: COLD,
      paperStrength: PAPER_STRENGTH,
    }),
  )
  try {
    const engine = capturedEngine
    if (engine === null) throw new Error('probe never captured the adapter engine')
    const points = serpentine(pressure)
    const payload: AquarelleStrokePayload = {
      tool: 'brush',
      color: STROKE_COLOR,
      params: acrylicParams(dry),
      brushId: BRUSH,
      points,
      mutationId: MUTATION_ID,
      timestamp: 0,
    }
    adapter.applyStroke(toStudioStroke(payload))
    for (let tick = 0; tick <= SETTLE_TICKS; tick += 1) adapter.stepTick(tick)
    adapter.fix()

    const canvas = engine.exportCanvas('pigment')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('exported canvas has no 2D context')
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    const at = (x: number, y: number): number => data[(y * canvas.width + x) * 4 + 3]!
    // The pigment export's alpha is darkness: 0 = bare paper.
    const segments: number[] = []
    let covered = 0
    let total = 0
    for (let i = 0; i < data.length; i += 4) {
      total += 1
      if (data[i + 3]! >= 8) covered += 1
    }
    // Sample the middle 12 path points (skip the row turns) — a box around each.
    const samples: AquarellePoint[] = []
    for (let i = 2; i < points.length - 2; i += 5) samples.push(points[i]!)
    for (const point of samples) {
      const cx = Math.round(point.x * (canvas.width - 1))
      const cy = Math.round((1 - point.y) * (canvas.height - 1))
      let sum = 0
      let count = 0
      for (let dy = -10; dy <= 10; dy += 2) {
        for (let dx = -10; dx <= 10; dx += 2) {
          const x = cx + dx
          const y = cy + dy
          if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue
          sum += at(x, y)
          count += 1
        }
      }
      segments.push(round2(sum / Math.max(1, count)))
    }

    // readBristles concatenates the three attachments: carried 0..3,
    // carried 4..6 + alpha, then state (load, across, seed, jitter).
    const raw = engine.readBristles()
    const cap = raw.length / 12
    const stateBlock = raw.slice(8 * cap)
    const decoded = new Float32Array(stateBlock.length)
    f16ToF32(stateBlock, decoded)
    const loads: number[] = []
    for (let i = 0; i < cap; i += 1) loads.push(decoded[i * 4]!)
    const finite = loads.filter((v) => Number.isFinite(v))
    return {
      pressure,
      dry,
      segments,
      covered: round2((100 * covered) / total),
      loadMin: round2(Math.min(...finite)),
      loadMean: round2(finite.reduce((a, b) => a + b, 0) / Math.max(1, finite.length)),
      loadMax: round2(Math.max(...finite)),
      bristles: cap,
    }
  } finally {
    adapter.dispose()
  }
}

function run(): void {
  const cases = [
    runCase(0.15, 0),
    runCase(0.4, 0),
    runCase(0.7, 0),
    runCase(1.0, 0),
    runCase(1.0, 70),
  ]
  const report = {
    sheet: [SHEET_W, SHEET_H],
    brush: BRUSH,
    size: SIZE,
    params: 'acrylic record + dry/load overrides',
    cases,
  }
  const pre = document.getElementById('result')
  if (!pre) throw new Error('probe page is missing pre#result')
  pre.textContent = JSON.stringify(report, null, 2)
  const status = document.getElementById('status')
  if (status) status.textContent = 'DONE'
  console.log('PROBE_RESULT ' + JSON.stringify(report))
}

run()
