// ============================================================
//  ink-parity probe (scratch) — why does a script bake reproduce
//  the geometry but lose the ink?
//
//  Runs the REAL WebGL2 engine through the real adapter, replays
//  the recorded script with the recorded Dry ticks versus today's
//  "Dry rides the next stroke" law, and compares the ink of both
//  against the live-sheet key and the app's baked key.
// ============================================================

import { createAquarelleEngineAdapter } from '../../src/adapter/engineAdapter'
import { registerMask } from '../../src/brushes/maskRegistry'
import { WatercolorEngine } from '../../src/playground/Engine'
import { toEngineParams } from '../../src/playground/params'
import { buildBrushForStroke } from '../../src/playground/brushBridge'
import { pigmentFromHex } from '../../src/playground/spectral'
import { PAPERS } from '../../src/playground/papers'

const TICK = 1000 / 60
const W = 1080
const H = 1080
const FIX_SETTLE_TICKS = 72
const SETTLE_CAP = 165

type AnyEvent = Record<string, any>

function isDry(event: AnyEvent): boolean {
  return event['kind'] === 'dry'
}

function canvasOf(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  return { canvas, ctx }
}

function inkOfPixels(data: Uint8ClampedArray): { ink: number; coverage: number; dark: number } {
  let ink = 0
  let coverage = 0
  let dark = 0
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!
    const v = 255 - lum
    ink += v
    if (lum < 220) coverage += 1
    if (lum < 120) dark += 1
  }
  return { ink: Math.round(ink), coverage, dark }
}

function fetchSync(url: string): Uint8Array {
  const request = new XMLHttpRequest()
  request.open('GET', url, false)
  // Synchronous XHR cannot use responseType in a document; a binary string is
  // the only sync path under file://.
  request.overrideMimeType('text/plain; charset=x-user-defined')
  request.send(null)
  if (request.status !== 0 && request.status !== 200) throw new Error(`fetch failed: ${url}`)
  const text = request.responseText
  const bytes = new Uint8Array(text.length)
  for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index) & 0xff
  return bytes
}

/** Measured offline from the same key pixels (255 − luminance sum, 1080²). */
const REFERENCE_INK = {
  source: 13_431_184,
  applied: 6_730_578,
}

function captureInk(adapter: ReturnType<typeof createAquarelleEngineAdapter>): {
  ink: number
  coverage: number
  dark: number
  png: string
} {
  const frame = adapter.captureFrame() as CanvasImageSource
  const { canvas, ctx } = canvasOf(W, H)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)
  ctx.drawImage(frame, 0, 0, W, H)
  const data = ctx.getImageData(0, 0, W, H).data
  const measured = inkOfPixels(data)
  // The app's own 256-sample average-luminance metric (alpha proofs).
  let lumSum = 0
  let samples = 0
  for (let y = 0; y < H; y += 4) {
    for (let x = 0; x < W; x += 4) {
      const at = (y * W + x) * 4
      lumSum += 0.2126 * data[at]! + 0.7152 * data[at + 1]! + 0.0722 * data[at + 2]!
      samples += 1
    }
  }
  return { ...measured, sampleLum: +(lumSum / samples).toFixed(1), png: canvas.toDataURL('image/png') }
}

interface Scheduled {
  kind: 'stroke' | 'dry'
  event: AnyEvent
  order: number
  begin: number
  tick: number
}

function buildSchedule(events: AnyEvent[]): {
  strokes: Scheduled[]
  drys: Scheduled[]
  lastEnd: number
} {
  const firstStroke = events.find((event) => !isDry(event))!
  const originMs = firstStroke['recordedOrder'] - Math.max(1, Math.trunc(firstStroke['ticks'])) * TICK
  let previousEnd = 0
  let lastEnd = 0
  const strokes: Scheduled[] = []
  const drys: Scheduled[] = []
  events.forEach((event, order) => {
    if (isDry(event)) {
      drys.push({
        kind: 'dry',
        event,
        order,
        begin: 0,
        tick: Math.max(0, Math.round((event['recordedOrder'] - originMs) / TICK)),
      })
      return
    }
    const duration = Math.max(1, Math.trunc(event['ticks']))
    const rawBegin = Math.round((event['recordedOrder'] - duration * TICK - originMs) / TICK)
    const begin = Math.max(previousEnd, Math.max(0, rawBegin))
    const end = begin + duration
    previousEnd = end
    lastEnd = end
    strokes.push({ kind: 'stroke', event, order, begin, tick: end })
  })
  return { strokes, drys, lastEnd }
}

type DryLaw = 'recorded' | 'next-stroke'
type Variant = 'base' | 'dwell1' | 'dwell3' | 'load2' | 'pressure1' | 'twice' | 'lettersOnly' | 'washOnly' | 'lettersDwell1' | 'lettersDwell3'

/** Clone a stroke with each point duplicated `extra` times (dwell emulation). */
function withDwell(stroke: AnyEvent, extra: number): AnyEvent {
  const points = stroke['pts'] as AnyEvent[]
  const pts: AnyEvent[] = []
  for (const point of points) {
    pts.push({ ...point, tick: pts.length })
    for (let i = 0; i < extra; i += 1) pts.push({ ...point, tick: pts.length })
  }
  return { ...stroke, pts, ticks: Math.max(1, pts.length - 1) }
}

function withLoad(stroke: AnyEvent, load: number): AnyEvent {
  const engine = stroke['engine'] as AnyEvent
  return { ...stroke, engine: { ...engine, params: { ...engine['params'], load } } }
}

function withPressure(stroke: AnyEvent, pressure: number): AnyEvent {
  const points = stroke['pts'] as AnyEvent[]
  return { ...stroke, pts: points.map((point) => ({ ...point, p: pressure })) }
}

function applyVariant(events: AnyEvent[], variant: Variant): AnyEvent[] {
  const mapped = events.map((event) => {
    if (event['kind'] === 'dry') return event
    if (variant === 'dwell1') return withDwell(event, 1)
    if (variant === 'dwell3') return withDwell(event, 3)
    if (variant === 'load2') return withLoad(event, 74.76)
    if (variant === 'pressure1') return withPressure(event, 1)
    return event
  })
  if (variant === 'lettersOnly' || variant === 'washOnly' || variant === 'lettersDwell1' || variant === 'lettersDwell3') {
    const strokeIndexes = mapped
      .map((event, index) => (event['kind'] === 'dry' ? -1 : index))
      .filter((index) => index >= 0)
    const lastStroke = strokeIndexes[strokeIndexes.length - 1]!
    return mapped.filter((event, index) => {
      if (event['kind'] === 'dry') return true
      if (variant === 'washOnly') return index >= lastStroke - 1
      return index !== lastStroke
    }).map((event) => {
      if (event['kind'] === 'dry') return event
      if (variant === 'lettersDwell1') return withDwell(event, 1)
      if (variant === 'lettersDwell3') return withDwell(event, 3)
      return event
    })
  }
  if (variant !== 'twice') return mapped
  // A second full pass over the same sheet: the shape of a capture that merged
  // the live sheet over a base already carrying the same strokes.
  return mapped.concat(
    mapped.map((event) => ({ ...event, recordedOrder: (event['recordedOrder'] ?? 0) + 1 })),
  )
}

function replay(events: AnyEvent[], dryLaw: DryLaw, variant: Variant = 'base'): {
  ink: number
  coverage: number
  dark: number
  sampleLum: number
  png: string
  fixes: number
  ticks: number
} {
  const adapter = createAquarelleEngineAdapter({ width: W, height: H })
  const seams = adapter as unknown as {
    fix?: () => void
    setPaper?: (paper: unknown) => void
  }
  seams.setPaper?.({ paperId: 'paper/cold-press', grainStrength: 0.6, grainScale: 1 })
  const variantEvents = applyVariant(events, variant)
  const { strokes, drys, lastEnd } = buildSchedule(variantEvents)

  let cursor = 0
  let ticks = 0
  let fixes = 0
  const stepTo = (tick: number): void => {
    while (cursor < tick) {
      adapter.stepTick(cursor)
      cursor += 1
      ticks += 1
    }
  }
  const fireDrys = (list: Scheduled[]): void => {
    for (const dry of list) {
      adapter.applyStroke(dry.event as never)
      fixes += 1
    }
  }

  let dryIndex = 0
  for (const stroke of strokes) {
    if (dryLaw === 'recorded') {
      // Fire every dry whose recorded tick is before this stroke's first sample.
      while (dryIndex < drys.length && drys[dryIndex]!.tick < stroke.begin) {
        const dry = drys[dryIndex]!
        stepTo(dry.tick)
        fireDrys([dry])
        dryIndex += 1
      }
      stepTo(stroke.begin)
    } else {
      // Today's law: a dry rides the next stroke's first sample.
      stepTo(stroke.begin)
      const due: Scheduled[] = []
      while (dryIndex < drys.length && drys[dryIndex]!.order < stroke.order) {
        due.push(drys[dryIndex]!)
        dryIndex += 1
      }
      fireDrys(due)
    }
    for (let pointIndex = 1; pointIndex <= (stroke.event['pts'] as unknown[]).length; pointIndex += 1) {
      adapter.renderPartialStrokes([{ stroke: stroke.event, pointCount: pointIndex }] as never)
    }
  }

  // Trailing drys: recorded law fires them on their own tick; today's law
  // fires them at the end of the span.
  const trailing = drys.slice(dryIndex)
  if (dryLaw === 'recorded') {
    for (const dry of trailing) {
      stepTo(Math.min(lastEnd + SETTLE_CAP, dry.tick))
      fireDrys([dry])
    }
  } else {
    stepTo(lastEnd)
    fireDrys(trailing)
  }

  const lastStroke = strokes[strokes.length - 1]!
  const diffusion = Math.min(600, Math.trunc(lastStroke.event['engine']?.['diffusionFrames'] ?? 0))
  const settle = Math.min(diffusion || SETTLE_CAP, SETTLE_CAP)
  stepTo(Math.max(lastEnd + settle, lastEnd + 1))
  seams.fix?.()
  for (let tick = 0; tick < FIX_SETTLE_TICKS; tick += 1) {
    adapter.stepTick(tick)
    ticks += 1
  }
  const captured = captureInk(adapter)
  adapter.dispose()
  return { ...captured, fixes, ticks }
}

/** The LIVE pointer path: queue + processInput, mouse tracing, no script flag. */
function replayLive(events: AnyEvent[]): { ink: number; coverage: number; dark: number; sampleLum: number; png: string } {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const engine = new WatercolorEngine(canvas, null, {}, [W, H])
  engine.setManual(true)
  engine.setPaper(PAPERS[0]!)
  engine.paperTexture = 0.6
  let clock = 0
  engine.setClock(() => clock)
  const privateEngine = engine as unknown as {
    stroke: AnyEvent | null
    queue: AnyEvent[]
  }
  const { strokes, drys, lastEnd } = buildSchedule(events)
  let cursor = 0
  let dryIndex = 0
  const stepTo = (tick: number): void => {
    while (cursor < tick) {
      clock += TICK
      engine.tick(1 / 60)
      cursor += 1
    }
  }
  const fireDrys = (list: Scheduled[]): void => {
    for (const dry of list) {
      engine.fix()
      for (let i = 0; i < 30; i += 1) {
        clock += TICK
        engine.tick(1 / 60)
      }
    }
  }
  for (const stroke of strokes) {
    while (dryIndex < drys.length && drys[dryIndex]!.tick < stroke.begin) {
      const dry = drys[dryIndex]!
      stepTo(dry.tick)
      fireDrys([dry])
      dryIndex += 1
    }
    stepTo(stroke.begin)
    const event = stroke.event
    const enginePart = event['engine'] as AnyEvent
    engine.setParams(toEngineParams(enginePart['params']))
    engine.setBrush(
      buildBrushForStroke(enginePart['brushId'] ?? 'round', {
        textureId: enginePart['textureId'] ?? null,
        textureRotation: enginePart['textureRotation'] ?? null,
        overrides: event['toolOverrides'] ?? null,
      }),
    )
    engine.setTool((enginePart['tool'] ?? 'brush') as never)
    engine.setPigment(pigmentFromHex(event['color'] ?? '#103c65'))
    privateEngine.stroke = {
      pointerId: 1,
      pointerType: 'mouse',
      tool: enginePart['tool'] ?? 'brush',
      started: false,
      ending: false,
      x: 0,
      y: 0,
      cx: 0,
      cy: 0,
      pr: 0,
      t: clock,
      speed: 0,
      simPressure: 0.45,
      carry: 0,
      travelled: 0,
      moved: false,
      dx: 0,
      dy: 0,
      angle: 0,
      azimuth: null,
      widthFrom: 1,
      widthTo: 1,
      pigFrom: null,
      pigTo: null,
    }
    for (const point of event['pts'] as AnyEvent[]) {
      clock += TICK
      privateEngine.queue.push({ x: point['x'], y: point['y'], p: point['p'], t: clock, tx: point['tx'], ty: point['ty'], w: 1 })
      engine.tick(1 / 60)
    }
    privateEngine.stroke.ending = true
    clock += TICK
    engine.tick(1 / 60)
  }
  const lastStroke = strokes[strokes.length - 1]!
  const diffusion = Math.min(600, Math.trunc(lastStroke.event['engine']?.['diffusionFrames'] ?? 0))
  const settle = Math.min(diffusion || SETTLE_CAP, SETTLE_CAP)
  stepTo(Math.max(lastEnd + settle, lastEnd + 1))
  engine.fix()
  for (let tick = 0; tick < FIX_SETTLE_TICKS; tick += 1) {
    clock += TICK
    engine.tick(1 / 60)
  }
  const frame = engine.exportCanvas('transparent') as CanvasImageSource
  const out = document.createElement('canvas')
  out.width = W
  out.height = H
  const outCtx = out.getContext('2d', { willReadFrequently: true })!
  outCtx.fillStyle = '#fff'
  outCtx.fillRect(0, 0, W, H)
  outCtx.drawImage(frame, 0, 0, W, H)
  const data = outCtx.getImageData(0, 0, W, H).data
  const measured = inkOfPixels(data)
  let lumSum = 0
  let samples = 0
  for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) {
    const at = (y * W + x) * 4
    lumSum += 0.2126 * data[at]! + 0.7152 * data[at + 1]! + 0.0722 * data[at + 2]!
    samples += 1
  }
  engine.destroy()
  return { ...measured, sampleLum: +(lumSum / samples).toFixed(1), png: out.toDataURL('image/png') }
}

function main(): void {
  const status = document.getElementById('status')!
  const result = document.getElementById('result')!
  try {
    const document_ = JSON.parse(new TextDecoder().decode(fetchSync('./script.json'))) as {
      strokes: AnyEvent[]
      brushPack: { entries: Array<{ id: string }> }
    }
    const mask = fetchSync('./mask.bin')
    registerMask(document_.brushPack.entries[0]!.id, mask)

    const events: AnyEvent[] = document_.strokes.map((stroke) => {
      if (stroke['engine']?.['kind'] === 'dry') {
        return {
          kind: 'dry',
          tick: stroke['engine']['tick'],
          recordedOrder: stroke['engine']['recordedOrder'],
        }
      }
      return stroke
    })

    const recorded = replay(events, 'recorded')
    const nextStroke = replay(events, 'next-stroke')
    const dwell1 = replay(events, 'recorded', 'dwell1')
    const dwell3 = replay(events, 'recorded', 'dwell3')
    const load2 = replay(events, 'recorded', 'load2')
    const pressure1 = replay(events, 'recorded', 'pressure1')
    const twice = replay(events, 'recorded', 'twice')
    const lettersOnly = replay(events, 'recorded', 'lettersOnly')
    const washOnly = replay(events, 'recorded', 'washOnly')
    const livePath = replayLive(events)
    const lettersDwell1 = replay(events, 'recorded', 'lettersDwell1')
    const lettersDwell3 = replay(events, 'recorded', 'lettersDwell3')

    const out = {
      renderer: (() => {
        const gl = document.createElement('canvas').getContext('webgl2') as WebGL2RenderingContext | null
        if (!gl) return 'none'
        const ext = gl.getExtension('WEBGL_debug_renderer_info')
        return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'webgl2'
      })(),
      source: { ink: REFERENCE_INK.source },
      applied: { ink: REFERENCE_INK.applied },
      recorded: { ink: recorded.ink, coverage: recorded.coverage, dark: recorded.dark, fixes: recorded.fixes, ticks: recorded.ticks },
      nextStroke: { ink: nextStroke.ink, coverage: nextStroke.coverage, dark: nextStroke.dark, fixes: nextStroke.fixes, ticks: nextStroke.ticks },
      dwell1: { ink: dwell1.ink, coverage: dwell1.coverage, dark: dwell1.dark },
      dwell3: { ink: dwell3.ink, coverage: dwell3.coverage, dark: dwell3.dark },
      load2: { ink: load2.ink, coverage: load2.coverage, dark: load2.dark },
      pressure1: { ink: pressure1.ink, coverage: pressure1.coverage, dark: pressure1.dark },
      twice: { ink: twice.ink, coverage: twice.coverage, dark: twice.dark, sampleLum: twice.sampleLum },
      sampleLum: { recorded: recorded.sampleLum, nextStroke: nextStroke.sampleLum, load2: load2.sampleLum, dwell3: dwell3.sampleLum, pressure1: pressure1.sampleLum, lettersOnly: lettersOnly.sampleLum, washOnly: washOnly.sampleLum, twice: twice.sampleLum },
      lettersOnly: { ink: lettersOnly.ink, sampleLum: lettersOnly.sampleLum },
      lettersDwell1: { ink: lettersDwell1.ink, sampleLum: lettersDwell1.sampleLum },
      lettersDwell3: { ink: lettersDwell3.ink, sampleLum: lettersDwell3.sampleLum },
      washOnly: { ink: washOnly.ink, sampleLum: washOnly.sampleLum },
      livePath: { ink: livePath.ink, coverage: livePath.coverage, dark: livePath.dark, sampleLum: livePath.sampleLum },
      ratios: {
        recordedVsSource: +(recorded.ink / REFERENCE_INK.source).toFixed(3),
        nextStrokeVsSource: +(nextStroke.ink / REFERENCE_INK.source).toFixed(3),
        dwell1VsSource: +(dwell1.ink / REFERENCE_INK.source).toFixed(3),
        dwell3VsSource: +(dwell3.ink / REFERENCE_INK.source).toFixed(3),
        load2VsSource: +(load2.ink / REFERENCE_INK.source).toFixed(3),
        pressure1VsSource: +(pressure1.ink / REFERENCE_INK.source).toFixed(3),
        twiceVsSource: +(twice.ink / REFERENCE_INK.source).toFixed(3),
        appliedVsSource: +(REFERENCE_INK.applied / REFERENCE_INK.source).toFixed(3),
      },
      pngs: { recorded: recorded.png, lettersOnly: lettersOnly.png, washOnly: washOnly.png, livePath: livePath.png },
    }
    result.textContent = JSON.stringify(out)
    status.textContent = 'DONE'
  } catch (error) {
    status.textContent = 'FAILED'
    result.textContent = JSON.stringify({ error: String((error as Error)?.stack ?? error) })
  }
}

main()
