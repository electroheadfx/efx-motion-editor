// ============================================================
//  Paint Brush Rendering
//  Extracted from efx-paint-physic-v3.html lines 586-1051
//  No module-level mutable state. genTexture creates
//  offscreen canvases for rendering (acceptable for render-path functions).
// ============================================================

import type { PenPoint, BrushOpts, WetBuffers, SavedWetBuffers, PaintPrimitiveTimingObserver } from '../types'
import { hexRgb, rgbHex, mixSubtractive } from '../util/color'
import { lerp, clamp, curveBounds } from '../util/math'
import { hashMutationId, seededDraw, traceShapeNoise } from '../util/traceSeed'
import { transferToWetLayerClipped } from '../core/wet-layer'
import { smooth, resample, ribbonWithScales, avgPenData } from './stroke'
import {
  buildBristleLanes,
  STREAK_ALPHA,
  WIDTH_FLOOR,
  CORE_MAX_TRACE_WIDTH,
  THIN_HALF_W,
  BODY_WIDTH_MIN,
  BODY_WIDTH_MAX,
  NW_AMPLITUDE,
  NW_ARC_SCALE,
} from './footprintLanes'

function measurePrimitive<T>(observer: PaintPrimitiveTimingObserver | undefined, stage: string, run: () => T): T {
  if (!observer) return run()
  const startedAt = performance.now()
  try {
    return run()
  } finally {
    observer(stage, performance.now() - startedAt)
  }
}

export interface PaintStrokeRasterContinuation {
  step(): boolean
  runToCompletion(): void
}

function createIteratorContinuation(iterator: Generator<void, void, void>): PaintStrokeRasterContinuation {
  let complete = false
  return {
    step() {
      if (complete) return true
      complete = iterator.next().done === true
      return complete
    },
    runToCompletion() {
      while (!complete) complete = iterator.next().done === true
    },
  }
}

/**
 * Flat polygon fill with no grain modulation.
 * From v3.html fillFlat() line 646
 */
export function fillFlat(
  ctx: CanvasRenderingContext2D,
  pts: Array<[number, number]>,
  color: string,
  alpha: number,
): void {
  if (pts.length < 3) return
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/**
 * Deposit tier: which variant of the seeded footprint the current call draws.
 * - 'live'  — display-only preview while the stroke is in flight: fewer,
 *   wider lanes (never writes the wet layer, D-07).
 * - 'final' — the single full deposit that feeds wet/physics on finalize.
 * The seeded layout (lane field + thin family) is tier-INDEPENDENT;
 * only count x thickness differs between tiers (D-05).
 */
export type FootprintTier = 'live' | 'final'

export interface FootprintParams {
  ctx: CanvasRenderingContext2D
  radius: number
  color: string
  opac: number
  hasPenInput: boolean
  mutationId?: number
}

const LIVE_TIER_DIVISOR = 4
// DiVerdi 4.1 thickness-up-as-count-down (D-05): live draws 1/4 of the
// lanes from the shared layout, thickened by this factor so lateral ink
// (sum of mid-stroke widths) stays within 15% of the final tier.
const LIVE_WIDTH_MUL = 4

/**
 * Seeded deposit-time bristle footprint — the ONE routine behind both
 * the live preview and the final deposit (52.4-01 D-05, R7 fibre
 * coverage contract 260929-m2z).
 *
 * - R7 coverage: ONE transparent closed FILLED outline per fibre —
 *   beginPath, left boundary forward, end-cap arc (lineTo only),
 *   right boundary backward, start-cap arc, closePath, fill. The soft
 *   edge is the fill anti-aliasing of that SINGLE fibre boundary
 *   (R7c); there is no stroked path, no wide low-alpha under-pass and
 *   no skip/run-flush dashing anywhere (R7b — gaps come only from the
 *   charge/deposit model). Composite body opacity comes from overlap
 *   (PIN 0: k_body >= 4 fills, 1-prod(1-ga) >= 0.99), never from a
 *   single near-opaque fill.
 * - R7 thin regime keys on the LOCAL ribbon half-width
 *   halfW = radius * scales[ci] against THIN_HALF_W (never brush
 *   radius alone): contiguous locally-thin spans draw the seeded 1-3
 *   thin-family outlines, contiguous locally-thick spans draw the
 *   lane field — a fat brush at light pressure or on a taper takes the
 *   thin path wherever it is locally thin.
 * - Lane layout (buildBristleLanes) and per-sample gauge noise are
 *   keyed by (hashMutationId seed, arc-length) — deterministic
 *   replay, stable across resample/chunking, identical for a given
 *   mutationId.
 * - ribbonWithScales is THE scale expression: every boundary vertex
 *   is clamped so the outline stays inside the local half-width
 *   (geometry clamp only, never alpha).
 * - Per-sample outline width = lane base x pMod (the pressure SIZE
 *   lever) x channel-0 arc-keyed gauge, single-clamped to
 *   [WIDTH_FLOOR, CORE_MAX_TRACE_WIDTH] (D-12), then x LIVE_WIDTH_MUL
 *   at tier=live (D-05). One constant fill alpha
 *   (STREAK_ALPHA x opac) per outline — no pressure/velocity/arc/noise
 *   alpha term (D-10/D-11).
 * - Geometry only: no height sampler, no threshold cut, no per-pixel
 *   reads, no non-seeded RNG (D-14).
 */
export function drawBristleFootprint(
  curve: PenPoint[],
  params: FootprintParams,
  tier: FootprintTier,
): void {
  const { ctx, radius, color, opac, hasPenInput, mutationId } = params
  if (curve.length < 2) return
  const strokeSeed = hashMutationId(mutationId)

  // Containment + taper: the SAME ribbon scale the ribbon polygon uses
  // (ribbonWithScales / stroke.ts endTaper) — first curve.length entries
  // map to curve points in order. No second inline scale math.
  const { scales } = ribbonWithScales(curve, radius, 0.8, hasPenInput)

  // Arc-length table (px) — gauge noise is keyed on arc, never sample
  // index (resample/chunking stability).
  const arc: number[] = [0]
  for (let i = 1; i < curve.length; i++) {
    arc[i] = arc[i - 1] + Math.hypot(curve[i].x - curve[i - 1].x, curve[i].y - curve[i - 1].y)
  }

  // Per-sample R7 regime from the LOCAL half-width (never radius).
  const thin = (ci: number): boolean => radius * scales[ci] < THIN_HALF_W

  // Contiguous regime spans with a +-1 sample overlap at internal
  // transitions, so a regime boundary never leaves an undrawn seam.
  interface RegimeSpan { start: number; end: number; isThin: boolean }
  const runs: RegimeSpan[] = []
  for (let i = 0; i < curve.length; ) {
    const t = thin(i)
    let j = i + 1
    while (j < curve.length && thin(j) === t) j++
    runs.push({ start: i, end: j - 1, isThin: t })
    i = j
  }
  const spans: RegimeSpan[] = runs.map((run, r) => ({
    start: r > 0 ? run.start - 1 : run.start,
    end: r < runs.length - 1 ? run.end + 1 : run.end,
    isThin: run.isThin,
  }))

  // ONE closed filled outline per fibre over one regime span
  // (save .. restore). The path: left boundary forward (one lineWidth
  // observability write per sample, ascending), end-cap polyline
  // (lineTo only), right boundary backward, start-cap polyline,
  // closePath, fill. Vertex pairs at equal x bracket the fibre
  // centreline; cap x's sit off the sample lattice so they never
  // pair. Pressure never touches alpha (D-10/D-11).
  const drawOutline = (
    lane: { offset: number; width: number },
    bi: number,
    span: RegimeSpan,
  ): void => {
    interface SampleGeom {
      cx: number; cy: number
      nx: number; ny: number
      tx: number; ty: number
      halfW: number; w: number
    }
    const samples: SampleGeom[] = []
    ctx.save()
    ctx.fillStyle = color
    ctx.globalAlpha = STREAK_ALPHA * opac
    ctx.beginPath()

    // Left boundary forward (ascending samples) + per-sample geometry
    // for the backward right pass.
    for (let si = span.start; si <= span.end; si++) {
      const p = curve[si]
      let tx2: number, ty2: number
      if (si === 0) { tx2 = curve[1].x - curve[0].x; ty2 = curve[1].y - curve[0].y }
      else if (si === curve.length - 1) { tx2 = p.x - curve[si - 1].x; ty2 = p.y - curve[si - 1].y }
      else { tx2 = curve[si + 1].x - curve[si - 1].x; ty2 = curve[si + 1].y - curve[si - 1].y }
      const l = Math.hypot(tx2, ty2) || 1
      const nx = -ty2 / l, ny = tx2 / l

      const tiltAngle = (p.tx || 0) * 0.015
      const cosT = Math.cos(tiltAngle), sinT = Math.sin(tiltAngle)
      const rnx = nx * cosT - ny * sinT, rny = nx * sinT + ny * cosT
      const rtx = tx2 / l * cosT - ty2 / l * sinT, rty = tx2 / l * sinT + ty2 / l * cosT

      // Local ribbon half-width — the outline centreline offset is
      // clamped so the full outline width stays inside it (traces can
      // never escape the footprint).
      const halfW = radius * scales[si]
      const pMod = hasPenInput ? 0.5 + p.p * 1.0 : 1
      const gauge = 1 + (traceShapeNoise(strokeSeed, arc[si] * NW_ARC_SCALE, bi, 0) - 0.5) * NW_AMPLITUDE
      const raw = lane.width * pMod * gauge
      const wFinal = clamp(raw, WIDTH_FLOOR, CORE_MAX_TRACE_WIDTH)
      const w = tier === 'live' ? wFinal * LIVE_WIDTH_MUL : wFinal
      const lim = Math.max(0, halfW - w / 2 - 1e-3)
      const c = clamp(lane.offset * halfW, -lim, lim)

      // One width write per sample (ascending, left pass) — the
      // observability seam the look-geometry pins read; the outline
      // itself is deposited by the single fill below.
      ctx.lineWidth = w
      const vx = p.x + rnx * c - rnx * (w / 2)
      const vy = p.y + rny * c - rny * (w / 2)
      if (si === span.start) ctx.moveTo(vx, vy)
      else ctx.lineTo(vx, vy)
      samples.push({ cx: p.x + rnx * c, cy: p.y + rny * c, nx: rnx, ny: rny, tx: rtx, ty: rty, halfW, w })
    }

    // End-cap polyline (lineTo only): quarter-circle approximation
    // around the last sample from the left boundary to the right —
    // the fill AA of this one fibre boundary is the soft edge (R7c).
    const capRad = Math.SQRT1_2
    const end = samples[samples.length - 1]
    ctx.lineTo(end.cx - end.nx * (end.w / 2) * capRad + end.tx * (end.w / 2) * capRad,
      end.cy - end.ny * (end.w / 2) * capRad + end.ty * (end.w / 2) * capRad)
    ctx.lineTo(end.cx + end.tx * (end.w / 2), end.cy + end.ty * (end.w / 2))
    ctx.lineTo(end.cx + end.nx * (end.w / 2) * capRad + end.tx * (end.w / 2) * capRad,
      end.cy + end.ny * (end.w / 2) * capRad + end.ty * (end.w / 2) * capRad)

    // Right boundary backward (descending samples) — same geometry,
    // no second width write.
    for (let si = samples.length - 1; si >= 0; si--) {
      const g = samples[si]
      ctx.lineTo(g.cx + g.nx * (g.w / 2), g.cy + g.ny * (g.w / 2))
    }

    // Start-cap polyline back to the first left-boundary vertex.
    const start = samples[0]
    ctx.lineTo(start.cx + start.nx * (start.w / 2) * capRad - start.tx * (start.w / 2) * capRad,
      start.cy + start.ny * (start.w / 2) * capRad - start.ty * (start.w / 2) * capRad)
    ctx.lineTo(start.cx - start.tx * (start.w / 2), start.cy - start.ty * (start.w / 2))
    ctx.lineTo(start.cx - start.nx * (start.w / 2) * capRad - start.tx * (start.w / 2) * capRad,
      start.cy - start.ny * (start.w / 2) * capRad - start.ty * (start.w / 2) * capRad)

    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  // Tier-independent seeded lane layout (D-05/D-13/D-02): one shared
  // overlap-packed body + Poisson-gap rim pass at full count; the live
  // tier merely SELECTS a subset (lowest liveRank) and thickens it
  // (DiVerdi 4.1). Spec R6: full N ~ radius, as the saturation pin
  // requires.
  const count = Math.max(4, Math.floor(radius))
  const lanes = buildBristleLanes(strokeSeed, count)
  const selected = tier === 'final'
    ? lanes.map((lane, bi) => ({ lane, bi }))
    : lanes
      .map((lane, bi) => ({ lane, bi, liveRank: seededDraw(strokeSeed, `b${bi}`, 'liveRank') }))
      .sort((x, y) => x.liveRank - y.liveRank)
      .slice(0, Math.ceil(lanes.length / LIVE_TIER_DIVISOR))
      .map(({ lane, bi }) => ({ lane, bi }))

  // Thin family (1-3 seeded outlines), drawn over every locally-thin
  // span; the lane field over every locally-thick span (R7 regime
  // follows the local half-width down tapers and light pressure).
  const thinCount = 1 + Math.floor(seededDraw(strokeSeed, 'hairline', 'count') * 3)
  const thinLanes = Array.from({ length: thinCount }, (_, j) => ({
    lane: {
      offset: seededDraw(strokeSeed, `hs${j}`, 'lane') * 2 - 1,
      width: BODY_WIDTH_MIN + seededDraw(strokeSeed, `hw${j}`, 'lane') * (BODY_WIDTH_MAX - BODY_WIDTH_MIN),
    },
    bi: j,
  }))

  for (const span of spans) {
    if (span.isThin) {
      for (const { lane, bi } of thinLanes) drawOutline(lane, bi, span)
    } else {
      for (const { lane, bi } of selected) drawOutline(lane, bi, span)
    }
  }
}

/**
 * Sample average color from canvas area.
 * From v3.html sampleAreaColor() line 707
 */
export function sampleAreaColor(
  imgData: ImageData,
  cx: number,
  cy: number,
  radius: number,
): [number, number, number] | null {
  const d = imgData.data, w = imgData.width, h = imgData.height
  const ri = Math.ceil(radius * 0.5), r2 = ri * ri
  let sr = 0, sg = 0, sb = 0, cnt = 0
  for (let dy = -ri; dy <= ri; dy += 2) {
    for (let dx = -ri; dx <= ri; dx += 2) {
      if (dx * dx + dy * dy > r2) continue
      const px = clamp(Math.round(cx + dx), 0, w - 1), py = clamp(Math.round(cy + dy), 0, h - 1)
      const i = (py * w + px) * 4
      if (d[i + 3] < 20) continue
      sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; cnt++
    }
  }
  if (cnt < 1) return null
  return [sr / cnt, sg / cnt, sb / cnt]
}

/**
 * Build per-segment color from surface sampling + subtractive mixing.
 * From v3.html buildCarriedColors() line 724
 */
export function buildCarriedColors(
  curve: PenPoint[],
  pickerColor: string,
  pickup: number,
  canvasSnap: ImageData,
  radius: number,
): Array<[number, number, number]> {
  const [pr, pg, pb] = hexRgb(pickerColor)
  let carried: [number, number, number] = [pr, pg, pb]
  const colors: Array<[number, number, number]> = []
  const pickupRate = pickup * 0.12

  for (let i = 0; i < curve.length; i++) {
    const p = curve[i]
    const surface = sampleAreaColor(canvasSnap, p.x, p.y, radius)

    if (surface && pickup > 0) {
      const blended = mixSubtractive(carried, surface, pickupRate)
      carried = [blended[0], blended[1], blended[2]]
    }

    const depositR = lerp(pr, carried[0], pickup)
    const depositG = lerp(pg, carried[1], pickup)
    const depositB = lerp(pb, carried[2], pickup)
    colors.push([Math.round(depositR), Math.round(depositG), Math.round(depositB)])
  }
  return colors
}

/**
 * Wet composite: mix source onto main canvas with watercolor blending.
 * From v3.html applyWetComposite() line 1056
 */
export function applyWetComposite(
  mc: CanvasRenderingContext2D,
  sc: HTMLCanvasElement,
  wet: number,
  width: number,
  height: number,
): void {
  const md = mc.getImageData(0, 0, width, height)
  const sd = sc.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, width, height)
  const m = md.data, s = sd.data
  for (let i = 0; i < m.length; i += 4) {
    const sa = s[i + 3] / 255; if (sa < 0.003) continue
    const ma = m[i + 3] / 255
    if (ma < 0.01) { m[i] = s[i]; m[i + 1] = s[i + 1]; m[i + 2] = s[i + 2]; m[i + 3] = s[i + 3]; continue }
    const mixT = clamp(wet * sa * ma * 0.4, 0, 0.35), dk = 1 - mixT * 0.12
    const nr = lerp(s[i], (s[i] * 0.55 + m[i] * 0.45), mixT) * dk
    const ng = lerp(s[i + 1], (s[i + 1] * 0.55 + m[i + 1] * 0.45), mixT) * dk
    const nb = lerp(s[i + 2], (s[i + 2] * 0.55 + m[i + 2] * 0.45), mixT) * dk
    const oa = ma + sa * (1 - ma), bt = sa / oa
    m[i] = Math.round(clamp(lerp(m[i], nr, bt), 0, 255))
    m[i + 1] = Math.round(clamp(lerp(m[i + 1], ng, bt), 0, 255))
    m[i + 2] = Math.round(clamp(lerp(m[i + 2], nb, bt), 0, 255))
    m[i + 3] = Math.round(clamp(oa * 255, 0, 255))
  }
  mc.putImageData(md, 0, 0)
}

/**
 * Clipped wet composite using bounds rect.
 * From v3.html applyWetCompositeClipped() line 1076
 */
export function applyWetCompositeClipped(
  mc: CanvasRenderingContext2D,
  sc: HTMLCanvasElement,
  wet: number,
  bounds: { x: number; y: number; w: number; h: number },
): void {
  const md = mc.getImageData(bounds.x, bounds.y, bounds.w, bounds.h)
  const sd = sc.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, bounds.w, bounds.h)
  const m = md.data, s = sd.data
  for (let i = 0; i < m.length; i += 4) {
    const sa = s[i + 3] / 255; if (sa < 0.003) continue
    const ma = m[i + 3] / 255
    if (ma < 0.01) { m[i] = s[i]; m[i + 1] = s[i + 1]; m[i + 2] = s[i + 2]; m[i + 3] = s[i + 3]; continue }
    const mixT = clamp(wet * sa * ma * 0.4, 0, 0.35), dk = 1 - mixT * 0.12
    const nr = lerp(s[i], (s[i] * 0.55 + m[i] * 0.45), mixT) * dk
    const ng = lerp(s[i + 1], (s[i + 1] * 0.55 + m[i + 1] * 0.45), mixT) * dk
    const nb = lerp(s[i + 2], (s[i + 2] * 0.55 + m[i + 2] * 0.45), mixT) * dk
    const oa = Math.min(1, ma + sa * (1 - ma))
    m[i] = clamp(nr, 0, 255); m[i + 1] = clamp(ng, 0, 255); m[i + 2] = clamp(nb, 0, 255)
    m[i + 3] = Math.round(oa * 255)
  }
  mc.putImageData(md, bounds.x, bounds.y)
}

/**
 * MAIN paint stroke entry point.
 * Orchestrates smooth -> resample -> ribbonWithScales -> deformNScaled
 * -> flat layer fill -> transferToWetLayerClipped pipeline.
 * From v3.html renderPaintStroke() line 921
 */
export function renderPaintStroke(
  rawPts: PenPoint[],
  color: string,
  opts: BrushOpts,
  ctx: CanvasRenderingContext2D,
  wetBuffers: WetBuffers,
  savedWet: SavedWetBuffers,
  dryPos: Float32Array,
  lastStrokeMask: Uint8Array,
  paperHeight: Float32Array | null,
  width: number,
  height: number,
  hasPenInput: boolean,
  wetPaper: boolean,
  waterAmount: number,
  tier: FootprintTier,
  observePrimitive?: PaintPrimitiveTimingObserver,
  mutationId?: number,
): void {
  const radius = opts.size || 24
  const wet = waterAmount
  const { opacity, pickup } = opts
  const pickupAmt = (pickup || 0) / 100
  const curve = measurePrimitive(observePrimitive, 'paint-raster-geometry', () => {
    const sm = smooth(rawPts, 3)
    return resample(sm, Math.max(3, radius * 0.25))
  })
  if (curve.length < 3) return

  const pen = avgPenData(curve)
  // Pen pressure affects brush SIZE only, not opacity (user preference)
  const opac = opacity / 100
  const speedDeplete = hasPenInput ? clamp(1 + pen.spd * 0.003, 1, 1.5) : 1

  createPaintStrokeRasterContinuationFromCurve(
    curve, color, opts, ctx, wetBuffers, paperHeight, width, height,
    hasPenInput, waterAmount,
    tier, observePrimitive, radius, opac, wet, speedDeplete, pickupAmt,
    mutationId,
  ).runToCompletion()
}

export function createPaintStrokeRasterContinuation(
  rawPts: PenPoint[],
  color: string,
  opts: BrushOpts,
  ctx: CanvasRenderingContext2D,
  wetBuffers: WetBuffers,
  paperHeight: Float32Array | null,
  width: number,
  height: number,
  hasPenInput: boolean,
  waterAmount: number,
  tier: FootprintTier,
  observePrimitive?: PaintPrimitiveTimingObserver,
  mutationId?: number,
): PaintStrokeRasterContinuation {
  const radius = opts.size || 24
  const wet = waterAmount
  const { opacity, pickup } = opts
  const pickupAmt = (pickup || 0) / 100
  const curve = measurePrimitive(observePrimitive, 'paint-raster-geometry', () => {
    const sm = smooth(rawPts, 3)
    return resample(sm, Math.max(3, radius * 0.25))
  })
  if (curve.length < 3) return createIteratorContinuation((function* () {})())
  const pen = avgPenData(curve)
  const opac = opacity / 100
  const speedDeplete = hasPenInput ? clamp(1 + pen.spd * 0.003, 1, 1.5) : 1
  return createPaintStrokeRasterContinuationFromCurve(
    curve, color, opts, ctx, wetBuffers, paperHeight, width, height,
    hasPenInput, waterAmount,
    tier, observePrimitive, radius, opac, wet, speedDeplete, pickupAmt,
    mutationId,
  )
}

export function createPaintStrokeRasterContinuationFromCurve(
  curve: PenPoint[],
  color: string,
  opts: BrushOpts,
  ctx: CanvasRenderingContext2D,
  wetBuffers: WetBuffers,
  paperHeight: Float32Array | null,
  width: number,
  height: number,
  hasPenInput: boolean,
  waterAmount: number,
  tier: FootprintTier,
  observePrimitive: PaintPrimitiveTimingObserver | undefined,
  radius: number,
  opac: number,
  wet: number,
  speedDeplete: number,
  pickupAmt: number,
  mutationId?: number,
): PaintStrokeRasterContinuation {
  void wet
  void speedDeplete
  function* rasterize(): Generator<void, void, void> {
    if (pickupAmt < 0.01) {
      const edgeMul = (opts.edgeDetail != null ? opts.edgeDetail : 50) / 50
      const variance = (1.5 + Math.sqrt(radius) * 0.9) * edgeMul
      const bounds = curveBounds(curve, radius + variance * 5, width, height)
      const off = document.createElement('canvas')
      off.width = bounds.w; off.height = bounds.h
      const oc = off.getContext('2d', { willReadFrequently: true })!
      oc.translate(-bounds.x0, -bounds.y0)
      measurePrimitive(observePrimitive, 'paint-raster-bristles', () => drawBristleFootprint(curve, { ctx: oc, radius, color, opac: 1, hasPenInput, mutationId }, tier))
      yield
      // D-07: tier=live writes NOTHING to the wet layer — the footprint is
      // blitted straight to the dry canvas for immediate display. Exactly
      // one tier=final transfer feeds wet/physics (engine finalize phase).
      if (tier === 'live') {
        ctx.drawImage(off, bounds.x0, bounds.y0)
      } else {
        measurePrimitive(observePrimitive, 'paint-wet-transfer-composition', () => transferToWetLayerClipped(oc, wetBuffers, waterAmount,
          { x: bounds.x0, y: bounds.y0, w: bounds.w, h: bounds.h }, width, height,
          paperHeight, 0.8, 1.2, opac, observePrimitive))
      }
      return
    }

    const canvasSnap = ctx.getImageData(0, 0, width, height)
    const carriedColors = buildCarriedColors(curve, color, pickupAmt, canvasSnap, radius)
    const segLen = Math.max(8, Math.floor(curve.length / Math.max(1, Math.floor(curve.length / 15))))
    const overlap = Math.floor(segLen * 0.3)

    for (let start = 0; start < curve.length - 2; start += segLen - overlap) {
      const end = Math.min(start + segLen, curve.length)
      const seg = curve.slice(start, end)
      if (seg.length < 3) continue
      const mid = Math.floor((start + end) / 2)
      const segColor = carriedColors[clamp(mid, 0, carriedColors.length - 1)]
      const segHex = rgbHex(segColor[0], segColor[1], segColor[2])
      const edgeMul = (opts.edgeDetail != null ? opts.edgeDetail : 50) / 50
      const variance = (1.5 + Math.sqrt(radius) * 0.9) * edgeMul
      const segBounds = curveBounds(seg, radius + variance * 5, width, height)
      const off2 = document.createElement('canvas')
      off2.width = segBounds.w; off2.height = segBounds.h
      const oc2 = off2.getContext('2d', { willReadFrequently: true })!
      oc2.translate(-segBounds.x0, -segBounds.y0)
      measurePrimitive(observePrimitive, 'paint-raster-bristles', () => drawBristleFootprint(seg, { ctx: oc2, radius, color: segHex, opac, hasPenInput, mutationId }, tier))
      yield
      // D-07 (same law as the fresh branch): live blits for display, exactly
      // one final transfer per segment on the finalize tier.
      if (tier === 'live') {
        ctx.drawImage(off2, segBounds.x0, segBounds.y0)
      } else {
        measurePrimitive(observePrimitive, 'paint-wet-transfer-composition', () => transferToWetLayerClipped(oc2, wetBuffers, waterAmount,
          { x: segBounds.x0, y: segBounds.y0, w: segBounds.w, h: segBounds.h }, width, height,
          paperHeight, 0.8, 1.2, opac, observePrimitive))
      }
      yield
    }
  }
  return createIteratorContinuation(rasterize())
}

/**
 * Simplified single-color paint stroke path (no pickup).
 * From v3.html renderPaintStrokeSingleColor() line 1020
 */
export function renderPaintStrokeSingleColor(
  curve: PenPoint[],
  color: string,
  radius: number,
  opac: number,
  wet: number,
  speedDeplete: number,
  opts: BrushOpts,
  ctx: CanvasRenderingContext2D,
  wetBuffers: WetBuffers,
  dryPos: Float32Array,
  paperHeight: Float32Array | null,
  width: number,
  height: number,
  wetPaper: boolean,
  hasPenInput: boolean,
  waterAmount: number,
  tier: FootprintTier,
  observePrimitive?: PaintPrimitiveTimingObserver,
  mutationId?: number,
): void {
  void speedDeplete
  const edgeMul = (opts.edgeDetail != null ? opts.edgeDetail : 50) / 50
  const variance = (1.5 + Math.sqrt(radius) * 0.9) * edgeMul

  // Clip offscreen canvas to stroke bounds for performance
  const bounds = curveBounds(curve, radius + variance * 5, width, height)
  const off = document.createElement('canvas')
  off.width = bounds.w; off.height = bounds.h
  const oc = off.getContext('2d', { willReadFrequently: true })!
  oc.translate(-bounds.x0, -bounds.y0) // shift so curve coords work directly

  measurePrimitive(observePrimitive, 'paint-raster-bristles', () => drawBristleFootprint(curve, { ctx: oc, radius, color, opac: 1, hasPenInput, mutationId }, tier))

  // D-07: live = dry blit only; final = the single wet deposit (D-12).
  if (tier === 'live') {
    ctx.drawImage(off, bounds.x0, bounds.y0)
  } else {
    measurePrimitive(observePrimitive, 'paint-wet-transfer-composition', () => transferToWetLayerClipped(oc, wetBuffers, waterAmount,
      { x: bounds.x0, y: bounds.y0, w: bounds.w, h: bounds.h }, width, height,
      paperHeight, 0.8, 1.2, opac, observePrimitive))
  }
}
