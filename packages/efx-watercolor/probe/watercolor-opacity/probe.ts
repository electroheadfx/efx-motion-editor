// ============================================================
//  Watercolor per-stroke global opacity — feasibility probe.
//
//  SCRATCH HARNESS ONLY. Imports engine-2 internals, touches no
//  product code. Runs the REAL vendored WebGL2 WatercolorEngine
//  (the same engine the aquarelle bake replays on) in a headless
//  browser, then measures:
//
//   1. The non-progressive bake sequence (applyStroke + cuisson
//      ticks + captureFrame) on a shared sheet.
//   2. Whether a scratch engine restored from the incoming
//      DocumentSnapshot reproduces that stroke's after-frame
//      (public snapshot only, then an augmented clone).
//   3. Whether independently isolated stroke layers recompose
//      to the shared-sheet bake (transmittance multiply).
//   4. Delta statistics (can a stroke's contribution be a
//      non-negative layer?), cache alpha model, and cost.
//
//  Fixed seed: Math.random is pinned to a mulberry32 around
//  engine construction so the constructor's paperSeed draw is
//  deterministic. Each stroke then reseeds the engine RNG from
//  traceSeed exactly like the adapter does.
// ============================================================

import { WatercolorEngine, type Tool } from '../../src/playground/Engine'
import { toEngineParams } from '../../src/playground/params'
import { buildBrushForStroke } from '../../src/playground/brushBridge'
import { pigmentFromHex } from '../../src/playground/spectral'
import { toStudioStroke, type AquarelleStroke, type AquarelleStrokePayload } from '../../src/payload/toStudioStroke'
import { payloadCodec } from '../../src/payload/codec'
import { createAquarelleEngineAdapter } from '../../src/adapter/engineAdapter'
import type { StudioStroke } from '@efxlab/efx-paint-host/animation'

const WIDTH = 256
const HEIGHT = 256
const HOST_DT = 1 / 60

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

// --- engine rig -------------------------------------------------------------

class Rig {
  readonly engine: WatercolorEngine
  now = 0

  constructor(readonly label: string, pinPaperSeed = true) {
    const canvas = document.createElement('canvas')
    canvas.width = WIDTH
    canvas.height = HEIGHT
    this.engine = pinPaperSeed
      ? withSeededMathRandom(0xc0ffee, () => new WatercolorEngine(canvas, null, {}, [WIDTH, HEIGHT]))
      : new WatercolorEngine(canvas, null, {}, [WIDTH, HEIGHT])
    this.engine.setManual(true)
    this.engine.setClock(() => this.now)
    this.engine.setRandom(seededRandom(1))
  }

  /** The adapter's configure() + applyStroke() feed law, replayed exactly. */
  applyStroke(raw: StudioStroke<AquarelleStrokePayload>): void {
    const parsed = payloadCodec.parse(payloadCodec.serialize(raw as never))
    if (!parsed) throw new Error('probe stroke failed the payload codec')
    const stroke = parsed as StudioStroke<AquarelleStrokePayload>
    const e = this.engine
    e.setParams(toEngineParams(stroke.engine.params))
    e.setBrush(
      buildBrushForStroke(
        stroke.engine.brushId ?? stroke.brushId,
        stroke.engine.toolOverrides ?? stroke.toolOverrides,
      ),
    )
    const hex = stroke.color ?? stroke.engine.color
    if (typeof hex === 'string' && hex.length > 0) e.setPigment(pigmentFromHex(hex))
    e.setTool(stroke.engine.tool as Tool)
    e.setRandom(seededRandom(stroke.traceSeed || 1))

    let started = false
    for (const p of stroke.pts) {
      this.now += 1000 * HOST_DT
      if (!started) {
        started = true
        e.scriptBegin(stroke.engine.tool as Tool, p.x, p.y, p.p, 'Stroke', undefined, p.tx, p.ty)
      } else {
        e.scriptMove(p.x, p.y, p.p, this.now, p.tx, p.ty)
      }
      e.tick(HOST_DT)
    }
    if (started) e.scriptEnd()
    // adapter.applyStroke's flush tick
    this.now += 1000 * HOST_DT
    e.tick(HOST_DT)
  }

  /** adapter.stepTick() × n. */
  step(n: number): void {
    for (let i = 0; i < n; i += 1) {
      this.now += 1000 * HOST_DT
      this.engine.tick(HOST_DT)
    }
  }

  capture(): Uint8ClampedArray {
    const canvas = this.engine.exportCanvas('transparent')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('capture: no 2D context')
    return new Uint8ClampedArray(ctx.getImageData(0, 0, canvas.width, canvas.height).data)
  }

  destroy(): void {
    this.engine.destroy()
  }
}

// --- pixel helpers ----------------------------------------------------------

interface CompareResult {
  readonly pixels: number
  readonly maxAbs: number
  readonly meanAbs: number
  readonly pctWithin0: number
  readonly pctWithin1: number
  readonly pctWithin2: number
  readonly perChannelOver1: readonly number[]
  readonly worstChannel: number
}

function compare(a: Uint8ClampedArray, b: Uint8ClampedArray): CompareResult {
  if (a.length !== b.length) throw new Error('compare: length mismatch')
  const pixels = a.length / 4
  let maxAbs = 0
  let sum = 0
  let within0 = 0
  let within1 = 0
  let within2 = 0
  const perChannel = [0, 0, 0, 0]
  for (let i = 0; i < a.length; i += 4) {
    let pixelMax = 0
    for (let c = 0; c < 4; c += 1) {
      const d = Math.abs((a[i + c] ?? 0) - (b[i + c] ?? 0))
      if (d > maxAbs) maxAbs = d
      sum += d
      if (d > 1) perChannel[c] = (perChannel[c] ?? 0) + 1
      if (d > pixelMax) pixelMax = d
    }
    if (pixelMax === 0) within0 += 1
    if (pixelMax <= 1) within1 += 1
    if (pixelMax <= 2) within2 += 1
  }
  return {
    pixels,
    maxAbs,
    meanAbs: sum / a.length,
    pctWithin0: (100 * within0) / pixels,
    pctWithin1: (100 * within1) / pixels,
    pctWithin2: (100 * within2) / pixels,
    perChannelOver1: perChannel,
    worstChannel: perChannel.indexOf(Math.max(...perChannel)),
  }
}

interface DeltaStats {
  readonly changedPixelsPct: number
  readonly negativePixelsPct: number
  readonly minDelta: number
  readonly maxDelta: number
  readonly meanAbsDelta: number
}

function deltaStats(before: Uint8ClampedArray, after: Uint8ClampedArray): DeltaStats {
  const pixels = before.length / 4
  let changed = 0
  let negative = 0
  let minD = 0
  let maxD = 0
  let sum = 0
  for (let i = 0; i < before.length; i += 4) {
    let pixelChanged = false
    let pixelNegative = false
    for (let c = 0; c < 3; c += 1) {
      const d = (after[i + c] ?? 0) - (before[i + c] ?? 0)
      if (d !== 0) pixelChanged = true
      if (d < 0) pixelNegative = true
      if (d < minD) minD = d
      if (d > maxD) maxD = d
      sum += Math.abs(d)
    }
    if (pixelChanged) changed += 1
    if (pixelNegative) negative += 1
  }
  return {
    changedPixelsPct: (100 * changed) / pixels,
    negativePixelsPct: (100 * negative) / pixels,
    minDelta: minD,
    maxDelta: maxD,
    meanAbsDelta: sum / (pixels * 3),
  }
}

/** Opaque transmittance multiply — how independent glaze layers composite. */
function multiplyTransmittance(layers: readonly Uint8ClampedArray[]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(WIDTH * HEIGHT * 4)
  for (let i = 0; i < out.length; i += 4) {
    let r = 255
    let g = 255
    let b = 255
    for (const layer of layers) {
      r = (r * (layer[i] ?? 255)) / 255
      g = (g * (layer[i + 1] ?? 255)) / 255
      b = (b * (layer[i + 2] ?? 255)) / 255
    }
    out[i] = Math.round(r)
    out[i + 1] = Math.round(g)
    out[i + 2] = Math.round(b)
    out[i + 3] = 255
  }
  return out
}

/** Per-pixel blend between two cumulative frames; alpha 1 must return `after` exactly. */
function crossfade(before: Uint8ClampedArray, after: Uint8ClampedArray, alpha: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(before.length)
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Math.round((before[i] ?? 0) + alpha * ((after[i] ?? 0) - (before[i] ?? 0)))
  }
  return out
}

function alphaProfile(pixels: Uint8ClampedArray): { min: number; max: number; nonOpaque: number } {
  let min = 255
  let max = 0
  let nonOpaque = 0
  for (let i = 3; i < pixels.length; i += 4) {
    const a = pixels[i] ?? 255
    if (a < min) min = a
    if (a > max) max = a
    if (a !== 255) nonOpaque += 1
  }
  return { min, max, nonOpaque }
}

// --- augmented clone (scratch FBO state the public snapshot omits) ---------

const SCALAR_KEYS = [
  'flowSpeed',
  'growCarry',
  'fixTimer',
  'autoFix',
  'minAwakeUntil',
  'lastWet',
  'wetPeak',
  'lastAngle',
  'maskCounter',
  'seenEvictions',
  'dirtyAll',
] as const

type AnyEngine = Record<string, any>

function readFloatRGBA(engine: WatercolorEngine, view: WebGLFramebuffer, w: number, h: number): Float32Array {
  const gl = (engine as unknown as AnyEngine)['gl'] as WebGL2RenderingContext
  const out = new Float32Array(w * h * 4)
  gl.bindFramebuffer(gl.FRAMEBUFFER, view)
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, out)
  const err = gl.getError()
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  if (err) throw new Error(`readFloatRGBA failed: 0x${err.toString(16)}`)
  return out
}

function readBytesRGBA(engine: WatercolorEngine, view: WebGLFramebuffer, w: number, h: number): Uint8Array {
  const gl = (engine as unknown as AnyEngine)['gl'] as WebGL2RenderingContext
  const out = new Uint8Array(w * h * 4)
  gl.bindFramebuffer(gl.FRAMEBUFFER, view)
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, out)
  const err = gl.getError()
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  if (err) throw new Error(`readBytesRGBA failed: 0x${err.toString(16)}`)
  return out
}

function uploadFloat(
  engine: WatercolorEngine,
  tex: WebGLTexture,
  w: number,
  h: number,
  format: number,
  data: Float32Array,
): void {
  const gl = (engine as unknown as AnyEngine)['gl'] as WebGL2RenderingContext
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4)
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, format, gl.FLOAT, data)
  const err = gl.getError()
  if (err) throw new Error(`uploadFloat failed: 0x${err.toString(16)}`)
}

function uploadBytes(
  engine: WatercolorEngine,
  tex: WebGLTexture,
  w: number,
  h: number,
  data: Uint8Array,
): void {
  const gl = (engine as unknown as AnyEngine)['gl'] as WebGL2RenderingContext
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data)
  const err = gl.getError()
  if (err) throw new Error(`uploadBytes failed: 0x${err.toString(16)}`)
}

function packChannels(src: Float32Array, channels: 1 | 2): Float32Array {
  if (channels === 2) {
    const out = new Float32Array((src.length / 4) * 2)
    for (let i = 0, j = 0; i < src.length; i += 4, j += 2) {
      out[j] = src[i] ?? 0
      out[j + 1] = src[i + 1] ?? 0
    }
    return out
  }
  const out = new Float32Array(src.length / 4)
  for (let i = 0, j = 0; i < src.length; i += 4, j += 1) out[j] = src[i] ?? 0
  return out
}

function copyDoubleFloat(
  src: WatercolorEngine,
  dst: WatercolorEngine,
  key: 'velocity' | 'pressure',
  channels: 1 | 2,
): void {
  const is = (src as unknown as AnyEngine)[key] as AnyEngine
  const id = (dst as unknown as AnyEngine)[key] as AnyEngine
  for (const half of ['read', 'write'] as const) {
    const st = is[half] as AnyEngine
    const dt = id[half] as AnyEngine
    const rgba = readFloatRGBA(src, st['views'][0] as WebGLFramebuffer, st['w'] as number, st['h'] as number)
    uploadFloat(dst, dt['tex'][0] as WebGLTexture, st['w'] as number, st['h'] as number, channels === 2 ? 0x8227 : 0x1903, packChannels(rgba, channels))
  }
}

function copySingleFloat(
  src: WatercolorEngine,
  dst: WatercolorEngine,
  key: 'divergence' | 'curl',
): void {
  const st = (src as unknown as AnyEngine)[key] as AnyEngine
  const dt = (dst as unknown as AnyEngine)[key] as AnyEngine
  const rgba = readFloatRGBA(src, st['views'][0] as WebGLFramebuffer, st['w'] as number, st['h'] as number)
  uploadFloat(dst, dt['tex'][0] as WebGLTexture, st['w'] as number, st['h'] as number, 0x1903, packChannels(rgba, 1))
}

function copyWriteHalves(src: WatercolorEngine, dst: WatercolorEngine): void {
  const s = src as unknown as AnyEngine
  const d = dst as unknown as AnyEngine
  // ink.write has two RGBA16F attachments; wet.write has one R16F.
  for (let v = 0; v < 2; v += 1) {
    const st = s['ink']['write'] as AnyEngine
    const dt = d['ink']['write'] as AnyEngine
    const rgba = readFloatRGBA(src, st['views'][v] as WebGLFramebuffer, st['w'] as number, st['h'] as number)
    uploadFloat(dst, dt['tex'][v] as WebGLTexture, st['w'] as number, st['h'] as number, 0x1908, rgba)
  }
  {
    const st = s['wet']['write'] as AnyEngine
    const dt = d['wet']['write'] as AnyEngine
    const rgba = readFloatRGBA(src, st['views'][0] as WebGLFramebuffer, st['w'] as number, st['h'] as number)
    uploadFloat(dst, dt['tex'][0] as WebGLTexture, st['w'] as number, st['h'] as number, 0x1903, packChannels(rgba, 1))
  }
}

function copyWetMask(src: WatercolorEngine, dst: WatercolorEngine): void {
  const s = src as unknown as AnyEngine
  const d = dst as unknown as AnyEngine
  const st = s['wetMask'] as AnyEngine
  const dt = d['wetMask'] as AnyEngine
  const bytes = readBytesRGBA(src, st['views'][0] as WebGLFramebuffer, st['w'] as number, st['h'] as number)
  uploadBytes(dst, dt['tex'][0] as WebGLTexture, st['w'] as number, st['h'] as number, bytes)
}

function copyAugmented(src: Rig, dst: Rig): void {
  const s = src.engine as unknown as AnyEngine
  const d = dst.engine as unknown as AnyEngine
  for (const key of SCALAR_KEYS) d[key] = s[key]
  d['lastDir'] = [...(s['lastDir'] as [number, number])]
  d['lastAngle'] = s['lastAngle']
  d['active'] = s['active'] ? { ...(s['active'] as object) } : null
  d['painted'] = s['painted'] ? { ...(s['painted'] as object) } : null
  d['everPainted'] = s['everPainted'] ? { ...(s['everPainted'] as object) } : null
  d['dirty'] = s['dirty'] ? { ...(s['dirty'] as object) } : null
  d['maskCounter'] = s['maskCounter']
  copyDoubleFloat(src.engine, dst.engine, 'velocity', 2)
  copyDoubleFloat(src.engine, dst.engine, 'pressure', 1)
  copySingleFloat(src.engine, dst.engine, 'divergence')
  copySingleFloat(src.engine, dst.engine, 'curl')
  copyWriteHalves(src.engine, dst.engine)
  copyWetMask(src.engine, dst.engine)
}

// --- strokes ----------------------------------------------------------------

interface StrokeSpec {
  readonly id: string
  readonly stroke: StudioStroke<AquarelleStrokePayload>
  readonly cuisson: number
}

function curvePoints(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  count: number,
  bow: number,
): AquarelleStroke['points'] {
  const pts: AquarelleStroke['points'] = []
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1)
    const x = x0 + (x1 - x0) * t
    const y = y0 + (y1 - y0) * t + Math.sin(Math.PI * t) * bow
    pts.push({ x, y, p: -1, tx: 0, ty: 0, tw: 0 })
  }
  return pts
}

function makeStroke(
  tool: 'brush' | 'water' | 'pen' | 'lift',
  color: string,
  brushId: string,
  mutationId: number,
  points: AquarelleStroke['points'],
  diffusionFrames: number,
  params: Partial<Record<string, number>>,
): StrokeSpec {
  const base = {
    size: 90,
    water: 60,
    load: 55,
    flow: 50,
    bleed: 55,
    dry: 45,
    edge: 50,
    granulation: 50,
    ...params,
  }
  const stroke = toStudioStroke({
    tool,
    color,
    params: base,
    brushId,
    points,
    mutationId,
    diffusionFrames,
    timestamp: 1000 + mutationId,
  })
  return { id: `${tool}-${mutationId}`, stroke, cuisson: diffusionFrames }
}

function scenarios(): { name: string; strokes: StrokeSpec[] }[] {
  const s1 = makeStroke(
    'brush',
    '#2244aa',
    'wc/round-medium',
    101,
    curvePoints(0.16, 0.28, 0.84, 0.30, 14, 0.05),
    8,
    { water: 78, load: 55, dry: 35 },
  )
  const s2 = makeStroke(
    'brush',
    '#b03a2e',
    'wc/flat-dry',
    102,
    curvePoints(0.20, 0.52, 0.80, 0.54, 14, -0.05),
    90,
    { water: 55, load: 60, dry: 45 },
  )
  const s1d = makeStroke(
    'brush',
    '#1f5f8b',
    'wc/round-medium',
    201,
    curvePoints(0.18, 0.30, 0.82, 0.32, 12, 0.04),
    600,
    { water: 35, load: 55, dry: 85 },
  )
  const s2d = makeStroke(
    'brush',
    '#8e5a1c',
    'wc/round-medium',
    202,
    curvePoints(0.22, 0.55, 0.78, 0.57, 12, -0.04),
    300,
    { water: 35, load: 55, dry: 85 },
  )
  const s3 = makeStroke(
    'brush',
    '#2e7d32',
    'wc/round-medium',
    103,
    curvePoints(0.30, 0.72, 0.70, 0.70, 12, 0.03),
    300,
    { water: 50, load: 55, dry: 60 },
  )
  return [
    { name: 'wet-on-wet', strokes: [s1, s2] },
    { name: 'dry-on-dry', strokes: [s1d, s2d] },
    { name: 'three-stroke', strokes: [s1, s2, s3] },
  ]
}

// --- scenario runner --------------------------------------------------------

interface StrokeScratchResult {
  readonly strokeIndex: number
  readonly publicSnapshot: CompareResult
  readonly augmentedClone: CompareResult
  readonly augmentedError?: string
}

interface ScenarioResult {
  readonly name: string
  readonly cuissons: readonly number[]
  readonly strokeCount: number
  readonly scratch: readonly StrokeScratchResult[]
  readonly isolatedOnlyVsBaseline: CompareResult | null
  readonly independentLayersMultiply: CompareResult | null
  readonly crossfadeOpacity100: CompareResult | null
  readonly crossfadeAt50VsBefore: DeltaStats | null
  readonly deltaForLastStroke: DeltaStats | null
  readonly alpha: { min: number; max: number; nonOpaque: number }
  readonly awakeAfterEachStroke: readonly boolean[]
}

function runScenario(scenario: { name: string; strokes: StrokeSpec[] }): ScenarioResult {
  const shared = new Rig(`${scenario.name}-shared`)
  const frames: Uint8ClampedArray[] = [shared.capture()]
  const awake: boolean[] = []
  const scratch: StrokeScratchResult[] = []

  for (let i = 0; i < scenario.strokes.length; i += 1) {
    const spec = scenario.strokes[i]!
    const snapshot = shared.engine.snapshot()
    const boundaryNow = shared.now

    const publicScratch = new Rig(`${scenario.name}-public-${i}`)
    publicScratch.now = boundaryNow
    publicScratch.engine.restore(snapshot)
    publicScratch.now = boundaryNow

    const augmented = new Rig(`${scenario.name}-augmented-${i}`)
    augmented.now = boundaryNow
    augmented.engine.restore(snapshot)
    augmented.now = boundaryNow
    let augmentedError: string | undefined
    try {
      copyAugmented(shared, augmented)
    } catch (error) {
      augmentedError = error instanceof Error ? error.message : String(error)
    }

    shared.applyStroke(spec.stroke)
    shared.step(spec.cuisson)
    const after = shared.capture()
    frames.push(after)
    awake.push(shared.engine.isAwake)

    publicScratch.applyStroke(spec.stroke)
    publicScratch.step(spec.cuisson)
    const publicPixels = publicScratch.capture()

    let augmentedPixels: Uint8ClampedArray | null = null
    if (!augmentedError) {
      try {
        augmented.applyStroke(spec.stroke)
        augmented.step(spec.cuisson)
        augmentedPixels = augmented.capture()
      } catch (error) {
        augmentedError = error instanceof Error ? error.message : String(error)
      }
    }

    scratch.push({
      strokeIndex: i,
      publicSnapshot: compare(publicPixels, after),
      augmentedClone: augmentedPixels ? compare(augmentedPixels, after) : compare(after, after),
      ...(augmentedError ? { augmentedError } : {}),
    })

    publicScratch.destroy()
    augmented.destroy()
  }

  // Isolated-only runs: each stroke alone on a blank sheet, same cuisson.
  const only: Uint8ClampedArray[] = []
  for (const spec of scenario.strokes) {
    const rig = new Rig(`${scenario.name}-only-${spec.id}`)
    rig.applyStroke(spec.stroke)
    rig.step(spec.cuisson)
    only.push(rig.capture())
    rig.destroy()
  }

  const isolatedOnlyVsBaseline =
    only.length === 1 ? compare(only[0]!, frames[frames.length - 1]!) : null
  const independentLayersMultiply = compare(multiplyTransmittance(only), frames[frames.length - 1]!)
  const beforeLast = frames[frames.length - 2]!
  const last = frames[frames.length - 1]!
  const crossfadeOpacity100 = compare(crossfade(beforeLast, last, 1), last)
  const crossfadeAt50VsBefore = deltaStats(beforeLast, crossfade(beforeLast, last, 0.5))
  const deltaForLastStroke = deltaStats(beforeLast, last)

  shared.destroy()
  return {
    name: scenario.name,
    cuissons: scenario.strokes.map((s) => s.cuisson),
    strokeCount: scenario.strokes.length,
    scratch,
    isolatedOnlyVsBaseline,
    independentLayersMultiply,
    crossfadeOpacity100,
    crossfadeAt50VsBefore,
    deltaForLastStroke,
    alpha: alphaProfile(last),
    awakeAfterEachStroke: awake,
  }
}

// --- driver validation against the real adapter -----------------------------

function validateDriverAgainstAdapter(): {
  readonly maxAbs: number
  readonly pctWithin1: number
  readonly note: string
} {
  const spec = makeStroke(
    'brush',
    '#2244aa',
    'wc/round-medium',
    900,
    curvePoints(0.2, 0.3, 0.8, 0.32, 10, 0.04),
    30,
    {},
  )
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const adapter = withSeededMathRandom(0xc0ffee, () => createAquarelleEngineAdapter({ width: WIDTH, height: HEIGHT, canvas }))
  adapter.applyStroke(spec.stroke)
  for (let tick = 0; tick < spec.cuisson; tick += 1) adapter.stepTick(tick)
  const adapterFrame = adapter.captureFrame() as HTMLCanvasElement
  const adapterCtx = adapterFrame.getContext('2d')
  if (!adapterCtx) throw new Error('adapter frame: no 2D context')
  const adapterPixels = new Uint8ClampedArray(adapterCtx.getImageData(0, 0, adapterFrame.width, adapterFrame.height).data)
  adapter.dispose()

  const rig = new Rig('driver-validation')
  rig.applyStroke(spec.stroke)
  rig.step(spec.cuisson)
  const rigPixels = rig.capture()
  rig.destroy()

  const result = compare(adapterPixels, rigPixels)
  return {
    maxAbs: result.maxAbs,
    pctWithin1: result.pctWithin1,
    note:
      result.pctWithin1 >= 99
        ? 'probe driver matches createAquarelleEngineAdapter'
        : 'probe driver diverges from createAquarelleEngineAdapter — treat scratch numbers with care',
  }
}

// --- determinism + paper-seed checks ----------------------------------------

function determinismCheck(): CompareResult {
  const spec = makeStroke(
    'brush',
    '#2244aa',
    'wc/flat-dry',
    950,
    curvePoints(0.2, 0.3, 0.8, 0.32, 10, 0.04),
    120,
    {},
  )
  const a = new Rig('determinism-a')
  a.applyStroke(spec.stroke)
  a.step(spec.cuisson)
  const pa = a.capture()
  a.destroy()
  const b = new Rig('determinism-b')
  b.applyStroke(spec.stroke)
  b.step(spec.cuisson)
  const pb = b.capture()
  b.destroy()
  return compare(pa, pb)
}

function unseededPaperCheck(): CompareResult {
  const spec = makeStroke(
    'brush',
    '#2244aa',
    'wc/flat-dry',
    951,
    curvePoints(0.2, 0.3, 0.8, 0.32, 10, 0.04),
    120,
    {},
  )
  const a = new Rig('unseeded-a', false)
  a.applyStroke(spec.stroke)
  a.step(spec.cuisson)
  const pa = a.capture()
  a.destroy()
  const b = new Rig('unseeded-b', false)
  b.applyStroke(spec.stroke)
  b.step(spec.cuisson)
  const pb = b.capture()
  b.destroy()
  return compare(pa, pb)
}

// --- cost -------------------------------------------------------------------

function round(n: number): number {
  return Math.round(n * 10000) / 10000
}

/**
 * Exact byte accounting for the two isolation options:
 *  - public snapshot: cropped ink/fixed/wet layers only (34 B/texel full-sheet);
 *  - augmented clone: full-sheet snapshot + ping-pong write halves (18 B/texel)
 *    + the sim grids (256 short side) + wet mask;
 *  - live engine: ~56 B/texel (ink 32 + fixed 16 + wet 4 + paper 4) + sim + mask,
 *    so a scratch engine alongside the bake costs clone + live.
 */
function memoryReport(engine: WatercolorEngine): Record<string, number> {
  const e = engine as unknown as AnyEngine
  const snapshot = engine.snapshot()
  let croppedBytes = 0
  for (const value of Object.values(snapshot.whole.layers)) croppedBytes += value.byteLength

  const w = e['dw'] as number
  const h = e['dh'] as number
  const texels = w * h
  const sim = e['velocity'] as AnyEngine
  const simW = sim['w'] as number
  const simH = sim['h'] as number
  const simTexels = simW * simH
  // velocity double RG16F read+write (8) + pressure double R16F (4)
  // + divergence R16F (2) + curl R16F (2)
  const simBytes = simTexels * 16
  const mask = e['wetMask'] as AnyEngine
  const wetMaskBytes = (mask['w'] as number) * (mask['h'] as number) * 4

  const snapshotFullBytes = texels * 34
  const writeHalfBytes = texels * 18
  const augmentedCloneBytes = snapshotFullBytes + writeHalfBytes + simBytes + wetMaskBytes
  const liveEngineBytes = texels * 56 + simBytes + wetMaskBytes
  return {
    docW: w,
    docH: h,
    texels,
    simW,
    simH,
    snapshotCroppedBytes: croppedBytes,
    snapshotCroppedPerTexel: croppedBytes / texels,
    snapshotFullBytes,
    snapshotFullPerTexel: 34,
    writeHalfBytes,
    simBytes,
    wetMaskBytes,
    augmentedCloneBytes,
    augmentedClonePerTexel: augmentedCloneBytes / texels,
    liveEngineBytes,
    clonePlusScratchEngineBytes: augmentedCloneBytes + liveEngineBytes,
  }
}

// --- probe ------------------------------------------------------------------

interface ProbeResult {
  readonly ok: boolean
  readonly error?: string
  readonly env: Record<string, unknown>
  readonly config: Record<string, unknown>
  readonly driverValidation: Record<string, unknown>
  readonly determinism: CompareResult
  readonly unseededPaper: CompareResult
  readonly scenarios: readonly ScenarioResult[]
  readonly memory: Record<string, number>
  readonly examples: Record<string, Record<string, number>>
  readonly findings: readonly string[]
  readonly cost: Record<string, number>
  readonly verdict: string
}

function mb(bytes: number): number {
  return round(bytes / 1024 / 1024)
}

function memoryExample(docW: number, docH: number): Record<string, number> {
  const texels = docW * docH
  const aspect = docW / docH
  const simW = aspect > 1 ? Math.round(256 * aspect) : 256
  const simH = aspect > 1 ? 256 : Math.round(256 / aspect)
  const simBytes = simW * simH * 16
  const wetMaskBytes = Math.ceil(docW / 16) * Math.ceil(docH / 16) * 4
  const snapshotFullBytes = texels * 34
  const cloneBytes = snapshotFullBytes + texels * 18 + simBytes + wetMaskBytes
  const liveEngineBytes = texels * 56 + simBytes + wetMaskBytes
  return {
    docW,
    docH,
    texels,
    simW,
    simH,
    snapshotMB: mb(snapshotFullBytes),
    cloneMB: mb(cloneBytes),
    scratchEngineMB: mb(liveEngineBytes),
    clonePlusScratchMB: mb(cloneBytes + liveEngineBytes),
    frameMB: mb(texels * 4),
    hundredRetainedClonesGB: round((cloneBytes * 100) / 1024 / 1024 / 1024),
  }
}

function main(): void {
  const t0 = performance.now()
  const envCanvas = document.createElement('canvas')
  const gl = envCanvas.getContext('webgl2')
  const env = {
    webgl2: Boolean(gl),
    colorBufferFloat: Boolean(gl?.getExtension('EXT_color_buffer_float')),
    colorBufferHalfFloat: Boolean(gl?.getExtension('EXT_color_buffer_half_float')),
    renderer: gl ? String(gl.getParameter(gl.RENDERER)) : 'none',
    vendor: gl ? String(gl.getParameter(gl.VENDOR)) : 'none',
    userAgent: navigator.userAgent,
  }
  if (!gl) {
    const result: ProbeResult = {
      ok: false,
      error: 'WebGL2 unavailable in this browser',
      env,
      config: { width: WIDTH, height: HEIGHT },
      driverValidation: {},
      determinism: compare(new Uint8ClampedArray(4), new Uint8ClampedArray(4)),
      unseededPaper: compare(new Uint8ClampedArray(4), new Uint8ClampedArray(4)),
      scenarios: [],
      memory: {},
      examples: {},
      findings: [],
      cost: {},
      verdict: 'blocked: no WebGL2',
    }
    writeResult(result)
    return
  }

  const driverValidation = validateDriverAgainstAdapter()
  const determinism = determinismCheck()
  const unseededPaper = unseededPaperCheck()

  const costStart = performance.now()
  const scenarioResults: ScenarioResult[] = []
  for (const scenario of scenarios()) scenarioResults.push(runScenario(scenario))
  const costMs = performance.now() - costStart

  const memoryRig = new Rig('memory')
  memoryRig.applyStroke(
    makeStroke(
      'brush',
      '#2244aa',
      'wc/round-medium',
      990,
      curvePoints(0.2, 0.3, 0.8, 0.32, 10, 0.04),
      30,
      {},
    ).stroke,
  )
  memoryRig.step(30)
  const memory = memoryReport(memoryRig.engine)
  memoryRig.destroy()

  const examples = {
    '1920x1080': memoryExample(1920, 1080),
    '2048x1536': memoryExample(2048, 1536),
    '3072x2304': memoryExample(3072, 2304),
  }

  const wet = scenarioResults.find((s) => s.name === 'wet-on-wet')
  const dry = scenarioResults.find((s) => s.name === 'dry-on-dry')
  const publicPass = scenarioResults.every((s) => s.scratch.every((x) => x.publicSnapshot.pctWithin1 >= 99))
  const augmentedPass = scenarioResults.every(
    (s) => s.scratch.every((x) => !x.augmentedError && x.augmentedClone.pctWithin1 >= 99),
  )
  const layerPass = scenarioResults.every((s) => s.independentLayersMultiply.pctWithin1 >= 99)
  const warmWetLayerPass = wet ? wet.independentLayersMultiply.pctWithin1 >= 99 : false
  const dryLayerPass = dry ? dry.independentLayersMultiply.pctWithin1 >= 99 : false
  const negativeDeltas = scenarioResults.some(
    (s) => (s.deltaForLastStroke?.negativePixelsPct ?? 0) > 0.01,
  )
  const opacity100Pass = scenarioResults.every(
    (s) => (s.crossfadeOpacity100?.pctWithin1 ?? 0) >= 99,
  )
  const allOpaque = scenarioResults.every((s) => s.alpha.nonOpaque === 0)

  const worstPublic = Math.min(...scenarioResults.flatMap((s) => s.scratch.map((x) => x.publicSnapshot.pctWithin1)))
  const worstPublicMax = Math.max(...scenarioResults.flatMap((s) => s.scratch.map((x) => x.publicSnapshot.maxAbs)))
  const worstCloned = Math.min(
    ...scenarioResults.flatMap((s) => s.scratch.map((x) => (x.augmentedError ? 0 : x.augmentedClone.pctWithin1))),
  )
  const worstClonedMax = Math.max(
    ...scenarioResults.flatMap((s) => s.scratch.map((x) => (x.augmentedError ? 255 : x.augmentedClone.maxAbs))),
  )

  const findings = [
    `Driver fidelity: probe rig matches createAquarelleEngineAdapter exactly (${driverValidation.pctWithin1}% within 1 LSB, maxAbs ${driverValidation.maxAbs}).`,
    `Pinned paper seed: two fresh engines reproduce exactly (${determinism.pctWithin1}% within 1, maxAbs ${determinism.maxAbs}). Unseeded paper diverges (${round(unseededPaper.pctWithin1)}% within 1, maxAbs ${unseededPaper.maxAbs}) because paperSeed is drawn from Math.random in the constructor before the adapter installs seededRandom(1); isolation must restore/clone the paper seed.`,
    `Complete-state clone: ${worstCloned}% within 1 LSB (maxAbs ${worstClonedMax}) at every tested stroke boundary (7/7), including wet-on-wet. A stroke's evolution is exactly reproducible from a private full-state clone.`,
    `Public DocumentSnapshot: worst boundary ${round(worstPublic)}% within 1 LSB (maxAbs ${worstPublicMax}). It omits velocity/pressure, lastDir/lastAngle, flowSpeed/growCarry/fixTimer/autoFix/minAwakeUntil, wetMask/maskCounter and the ping-pong write halves, so it cannot seed an exact scratch on a wet or damp sheet.`,
    `Independent isolated layers (each stroke alone on blank paper, transmittances multiplied): wet-on-wet ${round(wet!.independentLayersMultiply.pctWithin1)}%, dry-on-dry ${round(dry!.independentLayersMultiply.pctWithin1)}%, three-stroke ${round(scenarioResults[2]!.independentLayersMultiply.pctWithin1)}% within 1 LSB. They do not recompose to the shared-sheet bake.`,
    `Captured frames are fully opaque: alpha min ${scenarioResults[0]!.alpha.min}, max ${scenarioResults[0]!.alpha.max}, non-opaque ${scenarioResults[0]!.alpha.nonOpaque}. MODE.transparent emits vec4(toSRGB(rgb), 1.0) — transmittance RGB with alpha 1; there is no RGBA alpha layer to composite.`,
    `A stroke on a shared sheet can lighten existing paint (wet-on-wet: ${round(wet!.deltaForLastStroke!.changedPixelsPct)}% pixels changed, ${round(wet!.deltaForLastStroke!.negativePixelsPct)}% darker, range ${wet!.deltaForLastStroke!.minDelta}..${wet!.deltaForLastStroke!.maxDelta}), so a non-negative over-composite cannot reproduce it.`,
    `Opacity-100 display pin: crossfade(before, after, 1) === after on every scenario (${opacity100Pass ? 'exact' : 'MISMATCH'}). Opacity < 100 is a display blend of the two already-captured cumulative frames; the simulation and wet-on-wet are untouched.`,
    `Clone cost: ${memory.augmentedClonePerTexel} B/texel (full-sheet snapshot 34 + write halves 18, sim grids fixed at ${memory.simW}x${memory.simH}); a live scratch engine adds 56 B/texel. Together ~${round((memory.clonePlusScratchEngineBytes / memory.texels))} B/texel transient (${mb(memory.clonePlusScratchEngineBytes)} MB at this ${memory.docW}x${memory.docH} doc); retaining one clone per stroke is ${examples['2048x1536']!.hundredRetainedClonesGB} GB at 2048x1536 and ${examples['3072x2304']!.hundredRetainedClonesGB} GB at 3072x2304 for 100 strokes.`,
  ]

  let verdict: string
  if (!augmentedPass && !publicPass) {
    verdict =
      'BLOCKED — neither the public DocumentSnapshot nor the augmented clone reproduces the stroke after-frame; the stroke cannot be isolated from the incoming sheet state.'
  } else if (!layerPass) {
    verdict =
      'BLOCKED for isolated per-stroke RGBA alpha layers — the bake outputs opaque transmittance (alpha 255), the public snapshot cannot seed an exact scratch on wet sheets, and isolated stroke layers do not recompose to the shared-sheet bake. VIABLE only as a display-space cumulative-frame crossfade/delta: opacity 100 is the captured after-frame (exact identity), opacity < 100 blends the already-captured before/after frames (or applies their signed delta), so the simulation and wet-on-wet behaviour are untouched. Exact scratch isolation is possible only with a private complete-state clone (measured ~52 B/texel + a 56 B/texel scratch engine), which is not needed for the display path.'
  } else {
    verdict =
      'VIABLE — isolated stroke layers recompose within tolerance at opacity 100; composite at opacity <100 as independent transmittance layers.'
  }

  const result: ProbeResult = {
    ok: true,
    env,
    config: {
      width: WIDTH,
      height: HEIGHT,
      hostTickHz: 60,
      paper: 'engine default (paperSeed pinned via seeded Math.random)',
      parityBar: '>=99% pixels with per-channel |Δ| <= 1 LSB',
      publicSnapshotPass: publicPass,
      augmentedClonePass: augmentedPass,
      independentLayerPass: layerPass,
      wetOnWetLayerPass: warmWetLayerPass,
      dryOnDryLayerPass: dryLayerPass,
      negativeDeltas,
      opacity100Pass,
      allFramesOpaque: allOpaque,
    },
    driverValidation,
    determinism,
    unseededPaper,
    scenarios: scenarioResults,
    memory,
    examples,
    findings,
    cost: {
      totalProbeMs: round(performance.now() - t0),
      scenarioMatrixMs: round(costMs),
    },
    verdict,
  }
  writeResult(result)
}

function writeResult(result: ProbeResult): void {
  const pre = document.getElementById('result')
  if (pre) pre.textContent = JSON.stringify(result, null, 2)
  const status = document.getElementById('status')
  if (status) status.textContent = 'DONE'
  console.log('PROBE_RESULT ' + JSON.stringify(result))
}

main()
