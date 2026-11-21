// ============================================================
//  chalk-deposit/probe.ts — why the Chalk brushes paint nothing.
//
//  Reproduces the artist's report ("all chalk brushes paint
//  nothing visible") through the REAL engine on a headless
//  WebGL2 sheet: one short stroke per brush, on blank cold
//  paper, with the params bag the Studio actually ships for
//  the brush's medium (MEDIUMS records, 0..100 canonical).
//
//  For each case the probe exports the transparent composite
//  and reports the painted share (alpha >= 8), the mean/max
//  alpha and the mean RGB over the painted texels. A case that
//  "paints nothing" reads covered 0 / meanAlpha 0.
//
//  Scratch harness; nothing here is imported by the package.
// ============================================================

import { WatercolorEngine } from '../../src/playground/Engine'
import { BRUSH_PRESETS } from '../../src/playground/brushes'
import { MEDIUMS, type MediumId } from '../../src/playground/mediums'
import { DEFAULT_CANONICAL_PARAMS } from '../../src/playground/params'
import { PAPERS, type PaperPreset } from '../../src/playground/papers'
import { createAquarelleEngineAdapter } from '../../src/adapter/engineAdapter'
import {
  toStudioStroke,
  type AquarellePoint,
  type AquarelleStrokePayload,
} from '../../src/payload/toStudioStroke'

const SHEET = 256
const PAPER_SEED = 0xc0ffee
const PAPER_STRENGTH = 1
const MUTATION_ID = 0x6d65d1
const STROKE_COLOR = '#2244aa'
const SETTLE_TICKS = 8
const SIZE = 40
const COLD: PaperPreset | undefined = PAPERS.find((preset) => preset.id === 'cold')

const STROKE_POINTS: readonly AquarellePoint[] = [
  { x: 0.3, y: 0.3, p: 0.8, tx: 0, ty: 0, tw: 0 },
  { x: 0.42, y: 0.4, p: 0.9, tx: 0, ty: 0, tw: 0 },
  { x: 0.56, y: 0.52, p: 0.85, tx: 0, ty: 0, tw: 0 },
  { x: 0.7, y: 0.62, p: 0.7, tx: 0, ty: 0, tw: 0 },
]

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

function mediumParams(id: MediumId): Record<string, number> {
  const medium = MEDIUMS.find((candidate) => candidate.id === id)
  if (!medium) throw new Error(`unknown medium ${id}`)
  return { size: SIZE, ...medium.params }
}

function makeStroke(brushId: string, params: Record<string, number>): AquarelleStrokePayload {
  return {
    tool: 'brush',
    color: STROKE_COLOR,
    params,
    brushId,
    points: STROKE_POINTS.map((point) => ({ ...point })),
    mutationId: MUTATION_ID,
    timestamp: 0,
  }
}

interface Stats {
  covered: number
  meanAlpha: number
  maxAlpha: number
  meanRgb: [number, number, number]
}

function alphaStats(canvas: HTMLCanvasElement): Stats {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('exported canvas has no 2D context')
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  let covered = 0
  let sumA = 0
  let maxA = 0
  let sumR = 0
  let sumG = 0
  let sumB = 0
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]!
    if (a > maxA) maxA = a
    if (a >= 8) {
      covered += 1
      sumA += a
      sumR += data[i]!
      sumG += data[i + 1]!
      sumB += data[i + 2]!
    }
  }
  return {
    covered,
    meanAlpha: covered > 0 ? round(sumA / covered) : 0,
    maxAlpha: maxA,
    meanRgb: covered > 0
      ? [round(sumR / covered), round(sumG / covered), round(sumB / covered)]
      : [0, 0, 0],
  }
  function round(v: number): number {
    return Math.round(v * 100) / 100
  }
}

/** Paint ONE stroke on a fresh sheet through the bake adapter seam. */
function paintOnce(brushId: string, params: Record<string, number>): Stats {
  if (!COLD) throw new Error("paper preset 'cold' is not in PAPERS")
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
    const engine = capturedEngine
    if (engine === null) throw new Error('probe never captured the adapter engine')
    const stroke = toStudioStroke(makeStroke(brushId, params))
    adapter.applyStroke(stroke)
    for (let tick = 0; tick <= SETTLE_TICKS; tick += 1) adapter.stepTick(tick)
    adapter.fix()
    // MODE 4 `pigment`: alpha is darkness-only (0 = bare paper).
    return alphaStats(engine.exportCanvas('pigment'))
  } finally {
    adapter.dispose()
  }
}

function run(): void {
  const chalkGroup = BRUSH_PRESETS
    .filter((preset) => (preset.group ?? 'watercolor') === 'pastel')
    .map((preset) => preset.id)
  const pastelBody0 = { ...mediumParams('pastel'), body: 0 }
  const groups: MediumId[] = ['watercolor', 'gouache', 'pastel', 'graphite', 'acrylic']
  const cases: Array<{ brushId: string; medium: string }> = [
    // Every response, painted with its own medium's record.
    ...groups.flatMap((group) =>
      BRUSH_PRESETS
        .filter((preset) => (preset.group ?? 'watercolor') === group)
        .map((preset) => ({ brushId: preset.id, medium: group as string })),
    ),
    // Fix candidate: the same dry stick with Body 0 (the additive deposit).
    ...chalkGroup.map((brushId) => ({ brushId, medium: 'pastel body0' })),
  ]
  const paramsFor = (medium: string): Record<string, number> =>
    medium === 'pastel body0' ? pastelBody0 : mediumParams(medium as MediumId)
  const report: Record<string, unknown> = {
    sheet: SHEET,
    size: SIZE,
    defaultsSize: DEFAULT_CANONICAL_PARAMS.size,
    paper: 'cold',
    stroke: STROKE_POINTS,
    cases: cases.map(({ brushId, medium }) => ({
      brushId,
      medium,
      ...paintOnce(brushId, paramsFor(medium)),
    })),
  }
  const pre = document.getElementById('result')
  if (!pre) throw new Error('probe page is missing pre#result')
  pre.textContent = JSON.stringify(report, null, 2)
  const status = document.getElementById('status')
  if (status) status.textContent = 'DONE'
  console.log('PROBE_RESULT ' + JSON.stringify(report))
}

run()
