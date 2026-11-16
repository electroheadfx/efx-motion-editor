// ============================================================
//  apply probe (scratch, quick 261116-rp follow-up) — does the REAL
//  bake of a raw-tick script reproduce the live key, or does it
//  double / overshoot each stroke?
//
//  Runs the real createAquarelleBake over the saved Roto script
//  (new raw `pts[].tick`) and emits every output frame as PNG so
//  the applied pixels can be compared with the live key.
// ============================================================

import { createAquarelleEngineAdapter } from '../../src/adapter/engineAdapter'
import { createAquarelleBake } from '../../src/bake/aquarelleBake'
import { registerMask } from '../../src/brushes/maskRegistry'
import { WatercolorEngine } from '../../src/playground/Engine'
import { toEngineParams } from '../../src/playground/params'
import { buildBrushForStroke } from '../../src/playground/brushBridge'
import { pigmentFromHex } from '../../src/playground/spectral'
import { PAPERS } from '../../src/playground/papers'

const W = 1080
const H = 1080

type AnyEvent = Record<string, any>

function fetchSync(url: string): Uint8Array {
  const request = new XMLHttpRequest()
  request.open('GET', url, false)
  request.overrideMimeType('text/plain; charset=x-user-defined')
  request.send(null)
  if (request.status !== 0 && request.status !== 200) throw new Error(`fetch failed: ${url}`)
  const text = request.responseText
  const bytes = new Uint8Array(text.length)
  for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index) & 0xff
  return bytes
}

function toEvents(strokes: AnyEvent[]): AnyEvent[] {
  return strokes.map((stroke) => {
    if (stroke['engine']?.['kind'] === 'dry') {
      return {
        kind: 'dry',
        tick: stroke['engine']['tick'],
        recordedOrder: stroke['engine']['recordedOrder'],
      }
    }
    return stroke
  })
}

async function webpToPng(bytes: Uint8Array): Promise<{ png: string; ink: number; coverage: number; cx: number; cy: number; minX: number; maxX: number; minY: number; maxY: number }> {
  const blob = new Blob([bytes], { type: 'image/webp' })
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)
  ctx.drawImage(bitmap, 0, 0, W, H)
  const data = ctx.getImageData(0, 0, W, H).data
  let ink = 0
  let coverage = 0
  let sumX = 0
  let sumY = 0
  let minX = W
  let maxX = -1
  let minY = H
  let maxY = -1
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const at = (y * W + x) * 4
      const lum = 0.2126 * data[at]! + 0.7152 * data[at + 1]! + 0.0722 * data[at + 2]!
      const v = 255 - lum
      ink += v
      if (lum < 220) {
        coverage += 1
        sumX += x * v
        sumY += y * v
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  return {
    png: canvas.toDataURL('image/png'),
    ink: Math.round(ink),
    coverage,
    cx: coverage > 0 ? Math.round((sumX / coverage) / 2) : 0,
    cy: coverage > 0 ? Math.round((sumY / coverage) / 2) : 0,
    minX, maxX, minY, maxY,
  }
}

async function runBake(
  events: AnyEvent[],
  options: { frameCount: number; variation?: 'progressive' | 'static' | null },
): Promise<{ frames: Array<{ png: string; ink: number; coverage: number; cx: number; cy: number; minX: number; maxX: number; minY: number; maxY: number }>; diagnostics: any }> {
  const adapter = createAquarelleEngineAdapter({
    width: W,
    height: H,
    paperStrength: 0.6,
  }) as ReturnType<typeof createAquarelleEngineAdapter> & { setPaper?: (p: unknown) => void }
  adapter.setPaper?.({ paperId: 'paper/cold-press', grainStrength: 0.6, grainScale: 1 })
  const committed: Uint8Array[] = []
  let diagnostics: any = null
  const bake = createAquarelleBake(adapter as never, {
    width: W,
    height: H,
    frameCount: options.frameCount,
    ...(options.variation ? { paintSeedVariation: options.variation } : {}),
    encodeWebp: async (frame, width, height) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(frame, 0, 0, width, height)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.95))
      if (!blob) throw new Error('webp encode failed')
      return new Uint8Array(await blob.arrayBuffer())
    },
    onCommit: (frame) => committed.push(frame.bytes),
    onDiagnostics: (d) => { diagnostics = d },
  } as never)
  const result = await bake.bake(events as never)
  bake.dispose()
  adapter.dispose()
  if (!result.ok) throw new Error(`bake failed: ${result.reason}`)
  const frames = []
  for (const bytes of committed) frames.push(await webpToPng(bytes))
  return { frames, diagnostics }
}

const TICK = 1000 / 60

/**
 * The LIVE pointer path: the queue is drained once per 60 Hz tick, so every
 * sample recorded on the SAME tick is processed inside one engine tick — the
 * stamp cadence the artist actually saw. Samples are pushed with their real
 * recorded-order timestamps.
 */
async function renderLive(events: AnyEvent[]): Promise<{ png: string; ink: number; coverage: number }> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const engine = new WatercolorEngine(canvas, null, {}, [W, H])
  engine.setManual(true)
  engine.setPaper(PAPERS[0]!)
  engine.paperTexture = 0.6
  let clock = 0
  engine.setClock(() => clock)
  const privateEngine = engine as unknown as { stroke: AnyEvent | null; queue: AnyEvent[] }
  const strokes = events.filter((event) => event['kind'] !== 'dry')
  let previousEnd = 0
  for (const event of strokes) {
    const enginePart = event['engine'] as AnyEvent
    const duration = Math.max(1, Math.trunc(event['ticks']))
    const begin = Math.max(previousEnd, 0)
    previousEnd = begin + duration
    // Idle gap on the live clock.
    while (clock < begin * TICK) { clock += TICK; engine.tick(1 / 60) }
    engine.setParams(toEngineParams(enginePart['params']))
    engine.setBrush(buildBrushForStroke(enginePart['brushId'] ?? 'round', {
      textureId: enginePart['textureId'] ?? null,
      textureRotation: enginePart['textureRotation'] ?? null,
      overrides: event['toolOverrides'] ?? null,
    }))
    engine.setTool((enginePart['tool'] ?? 'brush') as never)
    engine.setPigment(pigmentFromHex(event['color'] ?? '#103c65'))
    privateEngine.stroke = {
      pointerId: 1, pointerType: 'pen', tool: enginePart['tool'] ?? 'brush', started: false, ending: false,
      x: 0, y: 0, cx: 0, cy: 0, pr: 0, t: clock, speed: 0, simPressure: 0.45, carry: 0,
      travelled: 0, moved: false, dx: 0, dy: 0, angle: 0, azimuth: null,
      widthFrom: 1, widthTo: 1, pigFrom: null, pigTo: null,
    }
    const pts = event['pts'] as AnyEvent[]
    let index = 0
    for (let tick = 0; tick <= duration && index < pts.length; tick += 1) {
      // Push every sample recorded on this tick, then drain the queue once.
      while (index < pts.length && (pts[index]!['tick'] ?? index) <= tick) {
        const point = pts[index]!
        privateEngine.queue.push({ x: point['x'], y: point['y'], p: point['p'], t: begin * TICK + tick * TICK, tx: point['tx'], ty: point['ty'], w: 1 })
        index += 1
      }
      clock = (begin + tick + 1) * TICK
      engine.tick(1 / 60)
    }
    privateEngine.stroke.ending = true
    clock += TICK
    engine.tick(1 / 60)
  }
  // Same visible settle law as the bake: fix + the fix window.
  for (let tick = 0; tick < 72; tick += 1) { engine.fix(); engine.tick(1 / 60) }
  const frame = engine.exportCanvas('transparent') as CanvasImageSource
  const out = document.createElement('canvas')
  out.width = W
  out.height = H
  const ctx = out.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)
  ctx.drawImage(frame, 0, 0, W, H)
  engine.destroy()
  const data = ctx.getImageData(0, 0, W, H).data
  let ink = 0
  let coverage = 0
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!
    ink += 255 - lum
    if (lum < 220) coverage += 1
  }
  return { png: out.toDataURL('image/png'), ink: Math.round(ink), coverage }
}

interface StampCall { x: number; y: number; moving: number; dt: number; pr: number; speed: number; r: number; angle: number }

function instrumentStamps(): { stop: () => StampCall[] } {
  const proto = WatercolorEngine.prototype as unknown as Record<string, any>
  const original = proto['stamp']
  const calls: StampCall[] = []
  proto['stamp'] = function (
    this: any, s: any, x: number, y: number, pr: number,
    _vx: number, _vy: number, moving: number, dt: number, _wf: number,
  ) {
    const speed = typeof s?.speed === 'number' ? s.speed : Number.NaN
    const r = this.radius(s.tool, pr, speed, _wf)
    calls.push({ x, y, moving, dt, pr, speed, r, angle: s?.angle ?? 0 })
    return original.call(this, s, x, y, pr, _vx, _vy, moving, dt, _wf)
  }
  return { stop: () => { proto['stamp'] = original; return calls } }
}

function summarizeStamps(calls: StampCall[]) {
  const moving = calls.filter((call) => call.moving === 1)
  const dwell = calls.filter((call) => call.moving === 0)
  const r = calls.map((call) => call.r)
  const speed = calls.map((call) => call.speed)
  return {
    total: calls.length,
    moving: moving.length,
    dwell: dwell.length,
    r: [Math.min(...r), Math.max(...r)].map((value) => +value.toFixed(4)),
    speed: [Math.min(...speed), Math.max(...speed)].map((value) => +value.toFixed(3)),
    points: calls.slice(0, 12).map((call) => [+call.x.toFixed(4), +call.y.toFixed(4), +call.r.toFixed(4), +call.speed.toFixed(2), call.moving, +call.dt.toFixed(4)]),
  }
}

/**
 * The real LIVE input path: DOM PointerEvents on a laid-out canvas, drained by
 * the engine's own rAF tick body. Samples are dispatched per recorded tick, in
 * recorded order — what the artist's pointer did.
 */
async function renderPointerLive(event: AnyEvent): Promise<{ png: string; ink: number; coverage: number }> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  canvas.style.width = `${W}px`
  canvas.style.height = `${H}px`
  canvas.style.display = 'block'
  document.body.appendChild(canvas)
  const engine = new WatercolorEngine(canvas, null, {}, [W, H])
  engine.setManual(true)
  engine.setPaper(PAPERS[0]!)
  engine.paperTexture = 0.6
  let clock = 0
  engine.setClock(() => clock)
  const enginePart = event['engine'] as AnyEvent
  engine.setParams(toEngineParams(enginePart['params']))
  engine.setBrush(buildBrushForStroke(enginePart['brushId'] ?? 'round', {
    textureId: enginePart['textureId'] ?? null,
    textureRotation: enginePart['textureRotation'] ?? null,
    overrides: event['toolOverrides'] ?? null,
  }))
  engine.setTool((enginePart['tool'] ?? 'brush') as never)
  engine.setPigment(pigmentFromHex(event['color'] ?? '#103c65'))
  const rect = canvas.getBoundingClientRect()
  const pts = event['pts'] as AnyEvent[]
  const duration = Math.max(1, Math.trunc(event['ticks']))
  const send = (type: string, point: AnyEvent, buttons: number): void => {
    const pressure = point['p'] >= 0 ? Math.pow(point['p'], 1 / 0.8) : 0.5
    canvas.dispatchEvent(new PointerEvent(type, {
      pointerId: 7,
      pointerType: 'pen',
      isPrimary: true,
      buttons,
      pressure,
      tiltX: point['tx'] ?? 0,
      tiltY: point['ty'] ?? 0,
      clientX: rect.left + point['x'] * W,
      clientY: rect.top + (1 - point['y']) * H,
      bubbles: true,
      cancelable: true,
    }))
  }
  let index = 0
  for (let tick = 0; tick <= duration && index < pts.length; tick += 1) {
    while (index < pts.length && (pts[index]!['tick'] ?? index) <= tick) {
      send(index === 0 ? 'pointerdown' : 'pointermove', pts[index]!, 1)
      index += 1
    }
    clock += TICK
    engine.tick(1 / 60)
  }
  send('pointerup', pts[pts.length - 1]!, 0)
  clock += TICK
  engine.tick(1 / 60)
  for (let tick = 0; tick < 72; tick += 1) { engine.fix(); clock += TICK; engine.tick(1 / 60) }
  const frame = engine.exportCanvas('transparent') as CanvasImageSource
  const out = document.createElement('canvas')
  out.width = W
  out.height = H
  const ctx = out.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)
  ctx.drawImage(frame, 0, 0, W, H)
  engine.destroy()
  canvas.remove()
  const data = ctx.getImageData(0, 0, W, H).data
  let ink = 0
  let coverage = 0
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!
    ink += 255 - lum
    if (lum < 220) coverage += 1
  }
  return { png: out.toDataURL('image/png'), ink: Math.round(ink), coverage }
}

const progress = (stage: string): void => {
  document.getElementById('status')!.textContent = stage
  ;(window as unknown as Record<string, unknown>)['__PROBE_PROGRESS'] = stage
}

async function main(): Promise<void> {
  const result = document.getElementById('result')!
  try {
    progress('loading')
    const document_ = JSON.parse(new TextDecoder().decode(fetchSync('./script.json'))) as {
      strokes: AnyEvent[]
      brushPack: { entries: Array<{ id: string }> }
    }
    registerMask(document_.brushPack.entries[0]!.id, fetchSync('./mask.bin'))
    const events = toEvents(document_.strokes)

    progress('solo')
    const firstStroke = events.find(
      (event) => event['kind'] !== 'dry' && (event['engine'] as AnyEvent)?.['mutationId'] === 168,
    ) ?? events.find((event) => event['kind'] !== 'dry')!
    const indexTicked = {
      ...firstStroke,
      pts: (firstStroke['pts'] as AnyEvent[]).map((point, index) => ({ ...point, tick: index })),
      ticks: Math.max(1, (firstStroke['pts'] as AnyEvent[]).length - 1),
    }
    const rawMeter = instrumentStamps()
    const soloRaw = await runBake([firstStroke], { frameCount: 1 })
    const rawStamps = summarizeStamps(rawMeter.stop())
    const indexMeter = instrumentStamps()
    const soloIndex = await runBake([indexTicked], { frameCount: 1 })
    const indexStamps = summarizeStamps(indexMeter.stop())
    const pointerMeter = instrumentStamps()
    const soloPointer = await renderPointerLive(firstStroke)
    const pointerStamps = summarizeStamps(pointerMeter.stop())

    progress('live')
    const liveSolo = await renderLive([firstStroke])
    const live = await renderLive(events)

    progress('single')
    const single = await runBake(events, { frameCount: 1 })
    progress('progressive')
    const progressive = await runBake(events, { frameCount: 5, variation: 'progressive' })
    progress('plain5')
    const plain5 = await runBake(events, { frameCount: 5 })
    progress('staticOn')
    const staticOn = await runBake(events, { frameCount: 3, variation: 'static' })

    const pngs: Record<string, string> = {
      'solo-raw': soloRaw.frames[0]!.png,
      'solo-index': soloIndex.frames[0]!.png,
      'solo-pointer': soloPointer.png,
      'live-solo': liveSolo.png,
      live: live.png,
      'single-0': single.frames[single.frames.length - 1]!.png,
      'prog-last': progressive.frames[progressive.frames.length - 1]!.png,
      'plain5-last': plain5.frames[plain5.frames.length - 1]!.png,
      'static-last': staticOn.frames[staticOn.frames.length - 1]!.png,
    }

    const brief = (run: { frames: Array<Record<string, unknown>>; diagnostics: any }) => ({
      frames: run.frames.map(({ png, ...rest }) => rest),
      diagnostics: run.diagnostics,
    })
    const out = JSON.stringify({
      strokes: events.filter((event) => event['kind'] !== 'dry').length,
      points: (firstStroke['pts'] as unknown[]).length,
      ticks: firstStroke['ticks'],
      soloRawStamps: rawStamps,
      soloIndexStamps: indexStamps,
      soloPointerStamps: pointerStamps,
      soloPointer: { ink: soloPointer.ink, coverage: soloPointer.coverage },
      live: { ink: live.ink, coverage: live.coverage },
      single: brief(single),
      progressive: brief(progressive),
      plain5: brief(plain5),
      staticOn: brief(staticOn),
      pngs,
    })
    result.textContent = out.slice(0, 2000)
    progress('DONE')
    ;(window as unknown as Record<string, unknown>)['__PROBE_STATE'] = out
  } catch (error) {
    progress('FAILED')
    const out = JSON.stringify({ error: String((error as Error)?.stack ?? error) })
    result.textContent = out
    ;(window as unknown as Record<string, unknown>)['__PROBE_STATE'] = out
  }
}

main()
