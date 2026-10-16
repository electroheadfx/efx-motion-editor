// ============================================================
//  aquarelleLiveSurface — Water color live input on the Studio
//  canvas (56-11 gap-closure).
//
//  One stepping law, live == bake: pointer samples resample onto
//  the host tick grid (HOST_TICK_HZ, pts[].tick = sample index),
//  each tick stamps the FluidSheet and runs step(sheet, 1), and
//  stroke end records a full AquarelleStroke (points + params).
//  Preview may decimate sim resolution; the RECORDED ticks/params
//  stay complete and exact.
//
//  PHYSIC PAINT STUDIO modal only. Never the inline EFX Paint
//  editor, never p5.brush.
// ============================================================

import {
  createSheet,
  forceDrySheet,
  isDrySheet,
  step,
  stampTool,
  drawSheetToCanvas,
  createDryEvent,
  findTip,
  type AquarelleDryEvent,
  type AquarellePoint,
  type AquarelleStroke,
  type AquarelleTool,
  type AquarelleToolOverrides,
  type DepositCanvas,
  type FluidSheet,
} from '@efxlab/efx-watercolor'
import { HOST_TICK_HZ, seededRng } from '@efxlab/efx-paint-host'

export interface AquarelleLiveSample {
  x: number
  y: number
  /** Pressure 0..1 (clamped on entry). */
  p: number
  tx: number
  ty: number
  tw: number
  /** Milliseconds on the caller's clock (performance.now / Date.now). */
  t: number
}

export interface AquarelleLiveSnapshot {
  params: Record<string, number>
  toolOverrides: AquarelleToolOverrides
  brushId: string
  tool: AquarelleTool
}

export interface AquarelleLiveSurfaceOptions {
  width: number
  height: number
  display: HTMLCanvasElement | DepositCanvas
  /** Reduced sim resolution (preview decimation). Defaults to width/height. */
  simWidth?: number
  simHeight?: number
  getSnapshot: () => AquarelleLiveSnapshot
  getColor: () => string | null
  onStrokeEnd: (stroke: AquarelleStroke) => void
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0.5
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function interpolateAt(
  samples: readonly AquarelleLiveSample[],
  t: number,
): AquarelleLiveSample {
  if (samples.length === 0) return { x: 0, y: 0, p: 0.5, tx: 0, ty: 0, tw: 0, t }
  if (samples.length === 1 || t <= samples[0]!.t) return samples[0]!
  const last = samples[samples.length - 1]!
  if (t >= last.t) return last
  let i = 1
  while (i < samples.length && samples[i]!.t < t) i++
  const b = samples[i]!
  const a = samples[i - 1]!
  const span = b.t - a.t
  const u = span > 0 ? (t - a.t) / span : 0
  return {
    x: lerp(a.x, b.x, u),
    y: lerp(a.y, b.y, u),
    p: lerp(a.p, b.p, u),
    tx: lerp(a.tx, b.tx, u),
    ty: lerp(a.ty, b.ty, u),
    tw: lerp(a.tw, b.tw, u),
    t,
  }
}

/**
 * Resample a pointer path onto the host tick grid.
 * toStudioStroke law: pts[].tick = sample index i (0-based).
 */
export function resampleToTickGrid(
  samples: readonly AquarelleLiveSample[],
  startMs: number,
  hz: number = HOST_TICK_HZ,
): AquarellePoint[] {
  if (samples.length === 0) return []
  const tickMs = 1000 / Math.max(1, hz)
  const lastT = samples[samples.length - 1]!.t
  const totalTicks = Math.max(1, Math.round((lastT - startMs) / tickMs))
  const out: AquarellePoint[] = []
  for (let i = 0; i <= totalTicks; i++) {
    const s = interpolateAt(samples, startMs + i * tickMs)
    out.push({
      x: s.x,
      y: s.y,
      p: clamp01(s.p),
      tx: s.tx,
      ty: s.ty,
      tw: s.tw,
    })
  }
  return out
}

export interface AquarelleLiveSurface {
  pointerDown(sample: AquarelleLiveSample): void
  pointerMove(sample: AquarelleLiveSample): void
  pointerUp(sample: AquarelleLiveSample): void
  emitDry(tick: number): AquarelleDryEvent
  dispose(): void
  /** Test seam — the live FluidSheet. */
  readonly sheet: FluidSheet | null
}

export function createAquarelleLiveSurface(
  options: AquarelleLiveSurfaceOptions,
): AquarelleLiveSurface {
  const width = Math.max(1, Math.trunc(options.width))
  const height = Math.max(1, Math.trunc(options.height))
  const simWidth = Math.max(1, Math.trunc(options.simWidth ?? width))
  const simHeight = Math.max(1, Math.trunc(options.simHeight ?? height))
  const scaleX = simWidth / width
  const scaleY = simHeight / height

  let sheet: FluidSheet | null = createSheet(simWidth, simHeight)
  let disposed = false
  let samples: AquarelleLiveSample[] = []
  let startMs = 0
  let tickIndex = 0
  let strokeSeed = 0
  let dirty = false

  const tickMs = 1000 / HOST_TICK_HZ

  const draw = (): void => {
    if (disposed || !sheet || !dirty) return
    drawSheetToCanvas(sheet, options.display)
    dirty = false
  }

  const stampSample = (s: AquarelleLiveSample): void => {
    if (disposed || !sheet) return
    const snap = options.getSnapshot()
    const tip = findTip(snap.brushId)
    const overrides = snap.toolOverrides
    const sizeParam = Number(snap.params['size'])
    const baseRadius = Math.max(1, (Number.isFinite(sizeParam) ? sizeParam : 12) / 2)
    const radius = Math.max(1, baseRadius * (overrides.tip ?? 1) * scaleX)
    const waterParam = Number(snap.params['water'])
    const water = Number.isFinite(waterParam) ? waterParam / 100 : 0.5
    const rng = seededRng(strokeSeed, 'live')
    stampTool(
      sheet,
      snap.tool,
      s.x * scaleX,
      s.y * scaleY,
      {
        radius,
        strength: clamp01(s.p),
        water,
        color: options.getColor(),
      },
      rng,
    )
    void tip
    dirty = true
  }

  const emitTicksThrough = (t: number): void => {
    if (disposed || !sheet) return
    const target = Math.max(0, Math.round((t - startMs) / tickMs))
    while (tickIndex < target) {
      tickIndex++
      stampSample(interpolateAt(samples, startMs + tickIndex * tickMs))
      step(sheet, 1)
    }
    draw()
  }

  return {
    get sheet() {
      return sheet
    },
    pointerDown(sample: AquarelleLiveSample): void {
      if (disposed) return
      const s = { ...sample, p: clamp01(sample.p) }
      samples = [s]
      startMs = s.t
      tickIndex = 0
      strokeSeed = Math.max(1, Math.trunc(s.t) ^ (Math.trunc(s.x) * 7919))
      stampSample(s)
      if (sheet) step(sheet, 1)
      dirty = true
      draw()
    },
    pointerMove(sample: AquarelleLiveSample): void {
      if (disposed || samples.length === 0) return
      samples.push({ ...sample, p: clamp01(sample.p) })
      emitTicksThrough(sample.t)
    },
    pointerUp(sample: AquarelleLiveSample): void {
      if (disposed || samples.length === 0) return
      samples.push({ ...sample, p: clamp01(sample.p) })
      emitTicksThrough(sample.t)
      draw()

      const snap = options.getSnapshot()
      const points = resampleToTickGrid(samples, startMs)
      const stroke: AquarelleStroke = {
        tool: snap.tool,
        color: options.getColor(),
        params: { ...snap.params },
        brushId: snap.brushId,
        points,
        toolOverrides: { ...snap.toolOverrides },
        timestamp: Math.trunc(startMs),
      }
      options.onStrokeEnd(stroke)
      samples = []
    },
    emitDry(tick: number): AquarelleDryEvent {
      const t = Math.max(0, Math.trunc(tick))
      if (sheet && !isDrySheet(sheet)) forceDrySheet(sheet)
      dirty = true
      draw()
      return createDryEvent(t, Date.now())
    },
    dispose(): void {
      disposed = true
      sheet = null
      samples = []
    },
  }
}
