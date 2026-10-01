// ============================================================
//  Paint Brush Rendering
//  Extracted from efx-paint-physic-v3.html lines 586-1051
//  No module-level mutable state. genTexture creates
//  offscreen canvases for rendering (acceptable for render-path functions).
// ============================================================

import type { PenPoint, BrushOpts, WetBuffers, SavedWetBuffers, PaintPrimitiveTimingObserver } from '../types'
import { hexRgb, rgbHex, mixSubtractive } from '../util/color'
import { lerp, clamp, curveBounds } from '../util/math'
import { hashMutationId, seededDraw, seededRng, traceShapeNoise } from '../util/traceSeed'
import { transferToWetLayerClipped } from '../core/wet-layer'
import { smooth, resample, ribbonWithScales, avgPenData, deformSampleSides } from './stroke'
import {
  buildBristleLanes,
  STREAK_ALPHA,
  WIDTH_FLOOR,
  CORE_MAX_TRACE_WIDTH,
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
 * The seeded layout (one shared continuous lane field) is tier-INDEPENDENT;
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
  /** Global t range [t0, t1] this call's curve covers within the whole
   *  stroke (260929-t2o, R7 amended) — endTaper then dips only at true
   *  stroke ends, never at an internal re-slice boundary. */
  tSpan?: [number, number]
  /** Shape-detail deform variance (R10 260930-detail) — reaches the drawn
   *  outline (it used to be curveBounds padding only). 0 = identity
   *  displacement; the pipeline still runs (look-continuity law). */
  variance?: number
}

const LIVE_TIER_DIVISOR = 4
// DiVerdi 4.1 thickness-up-as-count-down (D-05): live draws 1/4 of the
// lanes from the shared layout, thickened by this factor so lateral ink
// (sum of mid-stroke widths) stays within 15% of the final tier.
const LIVE_WIDTH_MUL = 4

/**
 * Seeded deposit-time bristle footprint — the ONE routine behind both
 * the live preview and the final deposit (52.4-01 D-05, R7 amended
 * 2026-09-29b, 260929-t2o).
 *
 * - R7-amended coverage: ONE transparent round-cap capsule sweep per
 *   fibre (width = W(t) per short step) — one CONVEX capsule subpath
 *   per consecutive sample pair (the convex hull of the two sample
 *   discs: external tangent sides plus lineTo-only inscribed cap
 *   arcs), every capsule wound the same direction, ONE fill per fibre
 *   (nonzero union). A self-intersecting whole-fibre outline is
 *   forbidden — it cancels winding and punches holes. The soft edge is
 *   the fill anti-aliasing of that ONE fibre boundary (R7c); gaps come
 *   only from the charge/deposit model (R7b). Composite body opacity
 *   comes from overlap (PIN 0: k_body >= 4 fills, 1-prod(1-ga) >= 0.99),
 *   never from a single near-opaque fill.
 * - Continuous field (260929-t2o): the separate thin family is
 *   DISSOLVED — every sample draws the same tier-selected lane layout;
 *   lane density and spacing scale with the local ribbon half-width
 *   halfW = radius * scales[ci] through the offset x halfW mapping, so
 *   coverage is continuous by construction at every width (no family
 *   switch).
 * - Lane layout (buildBristleLanes) and per-sample gauge noise are
 *   keyed by (hashMutationId seed, arc-length) — deterministic
 *   replay, stable across resample/chunking, identical for a given
 *   mutationId.
 * - ribbonWithScales is THE scale expression: capsule vertices stay
 *   inside the local half-width (geometry clamp only, never alpha).
 *   params.tSpan keeps endTaper at true stroke ends when this call
 *   draws a re-sliced interior segment of a longer stroke.
 * - Per-sample outline width = lane base x pMod (the pressure SIZE
 *   lever) x channel-0 arc-keyed gauge, single-clamped to
 *   [WIDTH_FLOOR, CORE_MAX_TRACE_WIDTH] (D-12), then x LIVE_WIDTH_MUL
 *   at tier=live (D-05). One constant fill alpha
 *   (STREAK_ALPHA x opac) per fibre — no pressure/velocity/arc/noise
 *   alpha term (D-10/D-11).
 * - Geometry only: no height sampler, no threshold cut, no bitmap
 *   readbacks, no non-seeded RNG (D-14).
 */
export function drawBristleFootprint(
  curve: PenPoint[],
  params: FootprintParams,
  tier: FootprintTier,
): void {
  const { ctx, radius, color, opac, hasPenInput, mutationId, tSpan, variance } = params
  if (curve.length < 2) return
  const strokeSeed = hashMutationId(mutationId)

  // Containment + taper: the SAME ribbon scale the ribbon polygon uses
  // (ribbonWithScales / stroke.ts endTaper) — first curve.length entries
  // map to curve points in order. No second inline scale math. tSpan
  // (260929-t2o) keeps endTaper at true stroke ends for re-sliced runs.
  const { scales } = ribbonWithScales(curve, radius, 0.8, hasPenInput, tSpan)

  // R10 (260930-detail): deformNScaled on the ribbon contour — variance
  // reaches the drawn outline (it used to be curveBounds padding only).
  // Draw source: traceSeed.seededRng (held-pose determinism). Amplitude =
  // variance x local width (260927-ton) x velocity (speedAtT). The deform
  // displaces the per-sample frames ONLY — the capsule-sweep raster stays
  // byte-unchanged (260929-t2o LOCKED). Runs at EVERY variance (0 =
  // identity displacement — the look-continuity law: amplitude, never
  // presence).
  const { leftOff, rightOff } = deformSampleSides(
    curve, radius, 0.8, hasPenInput, tSpan, variance ?? 0, 4,
    seededRng(strokeSeed, 'shape-detail'),
  )
  curve = curve.map((p, si) => {
    let tx: number, ty: number
    if (si === 0) { tx = curve[1].x - curve[0].x; ty = curve[1].y - curve[0].y }
    else if (si === curve.length - 1) { tx = p.x - curve[si - 1].x; ty = p.y - curve[si - 1].y }
    else { tx = curve[si + 1].x - curve[si - 1].x; ty = curve[si + 1].y - curve[si - 1].y }
    const l = Math.hypot(tx, ty) || 1
    const nx = -ty / l, ny = tx / l
    const tiltAngle = (p.tx || 0) * 0.015
    const cosT = Math.cos(tiltAngle), sinT = Math.sin(tiltAngle)
    const rnx = nx * cosT - ny * sinT, rny = nx * sinT + ny * cosT
    const uC = (leftOff[si] - rightOff[si]) / 2
    return { ...p, x: p.x + rnx * uC, y: p.y + rny * uC }
  })

  // Arc-length table (px) — gauge noise is keyed on arc, never sample
  // index (resample/chunking stability).
  const arc: number[] = [0]
  for (let i = 1; i < curve.length; i++) {
    arc[i] = arc[i - 1] + Math.hypot(curve[i].x - curve[i - 1].x, curve[i].y - curve[i - 1].y)
  }

  // Per-sample ribbon half-width — the continuous density field thins
  // through offset x halfW (260929-t2o). The lane centreline offset is
  // clamped per step so the full capsule width stays inside the local
  // ribbon (geometry clamp only, never alpha). R10: the deformed contour
  // widens/narrows each sample by the mean side offset.
  const halfWs: number[] = []
  for (let si = 0; si < curve.length; si++) {
    halfWs[si] = radius * scales[si] + (leftOff[si] + rightOff[si]) / 2
  }

  // ONE round-cap capsule sweep per fibre (R7 amended 2026-09-29b):
  // one CONVEX capsule subpath per short step — the convex hull of the
  // two sample discs (equal radii: external tangent sides at +-/û with
  // û = R(PI/2)d, lineTo-only inscribed cap arcs, 3 interior points per
  // 180deg cap). Every capsule is wound the same direction by
  // construction (rotation-equivariant ordering), so the nonzero union
  // of the ONE fill can never cancel — a self-intersecting whole-fibre
  // outline is exactly what punched the winding holes. On straight
  // equal-width steps the hull vertices coincide with the per-sample
  // normal points. Pressure never touches alpha (D-10/D-11).
  const drawFibre = (
    lane: { offset: number; width: number },
    bi: number,
  ): void => {
    const n = curve.length
    const ws: number[] = new Array(n)
    interface SampleGeom { x: number; y: number; nx: number; ny: number }
    const geom: SampleGeom[] = new Array(n)
    ctx.save()
    ctx.fillStyle = color
    ctx.globalAlpha = STREAK_ALPHA * opac

    // Per-sample geometry + one ascending lineWidth write per sample
    // (the observability seam the look-geometry pins read).
    for (let si = 0; si < n; si++) {
      const p = curve[si]
      let tx2: number, ty2: number
      if (si === 0) { tx2 = curve[1].x - curve[0].x; ty2 = curve[1].y - curve[0].y }
      else if (si === n - 1) { tx2 = p.x - curve[si - 1].x; ty2 = p.y - curve[si - 1].y }
      else { tx2 = curve[si + 1].x - curve[si - 1].x; ty2 = curve[si + 1].y - curve[si - 1].y }
      const l = Math.hypot(tx2, ty2) || 1
      const nx = -ty2 / l, ny = tx2 / l
      const tiltAngle = (p.tx || 0) * 0.015
      const cosT = Math.cos(tiltAngle), sinT = Math.sin(tiltAngle)
      geom[si] = {
        x: p.x,
        y: p.y,
        nx: nx * cosT - ny * sinT,
        ny: nx * sinT + ny * cosT,
      }
      const pMod = hasPenInput ? 0.5 + p.p * 1.0 : 1
      const gauge = 1 + (traceShapeNoise(strokeSeed, arc[si] * NW_ARC_SCALE, bi, 0) - 0.5) * NW_AMPLITUDE
      const raw = lane.width * pMod * gauge
      const wFinal = clamp(raw, WIDTH_FLOOR, CORE_MAX_TRACE_WIDTH)
      const w = tier === 'live' ? wFinal * LIVE_WIDTH_MUL : wFinal
      ctx.lineWidth = w
      ws[si] = w
    }

    ctx.beginPath()
    for (let si = 0; si + 1 < n; si++) {
      // Step-local lateral offset shared by both ends — the capsule
      // stays inside min(halfW) of the step (containment law).
      const halfS = Math.min(halfWs[si], halfWs[si + 1])
      const wS = ws[si]
      const r = wS / 2
      const lim = Math.max(0, halfS - r - 1e-3)
      const c = clamp(lane.offset * halfS, -lim, lim)
      const a = geom[si], b = geom[si + 1]
      const q0x = a.x + a.nx * c, q0y = a.y + a.ny * c
      const q1x = b.x + b.nx * c, q1y = b.y + b.ny * c
      const dx = q1x - q0x, dy = q1y - q0y
      const lS = Math.hypot(dx, dy)
      // Steps shorter than 0.05 px are one disc geometrically (the fibre
      // centre parked on the curvature centre); emitting the hull would
      // leave near-duplicate tangent points whose turn is below the
      // vertex-rounding floor. Disc polygon at the step midpoint, wound
      // like every capsule.
      if (!(lS > 0.05)) {
        const mx = (q0x + q1x) / 2, my = (q0y + q1y) / 2
        ctx.moveTo(mx + r * Math.SQRT1_2, my + r * Math.SQRT1_2)
        for (let k = 1; k < 8; k++) {
          const aa = Math.PI / 4 - (k * Math.PI) / 4
          ctx.lineTo(mx + r * Math.cos(aa), my + r * Math.sin(aa))
        }
        ctx.closePath()
        continue
      }
      // Equal-radius hull: tangent points at q +/- r*û with û = R(PI/2)d,
      // cap interiors at R(PI/4), R(0), R(-PI/4) forward and R(-3PI/4),
      // R(-PI), R(-5PI/4) back. R(A)d = cos A * d + sin A * û.
      const ddx = dx / lS, ddy = dy / lS
      const ux = -ddy, uy = ddx
      const capRot = (aa: number): [number, number] => {
        const ca = Math.cos(aa), sa = Math.sin(aa)
        return [ca * ddx + sa * ux, ca * ddy + sa * uy]
      }
      const f1 = capRot(Math.PI / 4), f2 = capRot(0), f3 = capRot(-Math.PI / 4)
      const b1 = capRot(-3 * Math.PI / 4), b2 = capRot(-Math.PI), b3 = capRot(-5 * Math.PI / 4)
      ctx.moveTo(q0x + r * ux, q0y + r * uy)
      ctx.lineTo(q1x + r * ux, q1y + r * uy)
      ctx.lineTo(q1x + r * f1[0], q1y + r * f1[1])
      ctx.lineTo(q1x + r * f2[0], q1y + r * f2[1])
      ctx.lineTo(q1x + r * f3[0], q1y + r * f3[1])
      ctx.lineTo(q1x - r * ux, q1y - r * uy)
      ctx.lineTo(q0x - r * ux, q0y - r * uy)
      ctx.lineTo(q0x + r * b1[0], q0y + r * b1[1])
      ctx.lineTo(q0x + r * b2[0], q0y + r * b2[1])
      ctx.lineTo(q0x + r * b3[0], q0y + r * b3[1])
      ctx.closePath()
    }
    ctx.fill()
    ctx.restore()
  }

  // Tier-independent seeded lane layout (D-05/D-13/D-02): one shared
  // overlap-packed body + Poisson-gap rim pass at full count; the live
  // tier merely SELECTS a subset (lowest liveRank) and thickens it
  // (DiVerdi 4.1). Spec R6: full N ~ radius, as the saturation pin
  // requires. R7-amended continuous field (260929-t2o): the same
  // layout at EVERY width — density scales with local halfW through
  // the offset x halfW mapping, never a family switch.
  const count = Math.max(4, Math.floor(radius))
  const lanes = buildBristleLanes(strokeSeed, count)
  const selected = tier === 'final'
    ? lanes.map((lane, bi) => ({ lane, bi }))
    : lanes
      .map((lane, bi) => ({ lane, bi, liveRank: seededDraw(strokeSeed, `b${bi}`, 'liveRank') }))
      .sort((x, y) => x.liveRank - y.liveRank)
      .slice(0, Math.ceil(lanes.length / LIVE_TIER_DIVISOR))
      .map(({ lane, bi }) => ({ lane, bi }))

  for (const { lane, bi } of selected) drawFibre(lane, bi)
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
  snapOriginX: number = 0,
  snapOriginY: number = 0,
): Array<[number, number, number]> {
  const [pr, pg, pb] = hexRgb(pickerColor)
  let carried: [number, number, number] = [pr, pg, pb]
  const colors: Array<[number, number, number]> = []
  const pickupRate = pickup * 0.12

  for (let i = 0; i < curve.length; i++) {
    const p = curve[i]
    const surface = sampleAreaColor(canvasSnap, p.x - snapOriginX, p.y - snapOriginY, radius)

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
      measurePrimitive(observePrimitive, 'paint-raster-bristles', () => drawBristleFootprint(curve, { ctx: oc, radius, color, opac: 1, hasPenInput, mutationId, variance }, tier))
      yield
      // 260930-wm6 ONE PIPELINE (user decision 2026-10-01): there is no
      // second render path. The footprint is deposited into the wet layer
      // through transferToWetLayerClipped — the SAME transfer the solver,
      // the screen (wetDisplayAlpha) and the cache all read — so preview
      // == settled == persisted by construction. The old tier=live raw
      // blit straight onto the dry canvas (dense, solid, full-radius) was
      // a third law that only the preview ever produced; it is deleted.
      measurePrimitive(observePrimitive, 'paint-wet-transfer-composition', () => transferToWetLayerClipped(oc, wetBuffers, waterAmount,
        { x: bounds.x0, y: bounds.y0, w: bounds.w, h: bounds.h }, width, height,
        paperHeight, undefined, undefined, opac, observePrimitive))
      return
    }

    // 260930-wm6 R2 — measure-first verdict: this WAS ctx.getImageData(0, 0,
    // width, height) — a whole-source-canvas readback (2,073,600px at 1080p,
    // the ~83ms synchronous main-thread read the 52.1 notes already blame for
    // frame stutter) paid before a single segment rasterizes. Its only consumer
    // is sampleAreaColor's ceil(radius/2) disc around each curve point, so the
    // snapshot is scoped to that footprint plus the disc radius.
    const snapPad = Math.ceil(radius * 0.5) + 1
    let snapMinX = Infinity, snapMinY = Infinity, snapMaxX = -Infinity, snapMaxY = -Infinity
    for (const p of curve) {
      if (p.x < snapMinX) snapMinX = p.x
      if (p.y < snapMinY) snapMinY = p.y
      if (p.x > snapMaxX) snapMaxX = p.x
      if (p.y > snapMaxY) snapMaxY = p.y
    }
    const snapX = Math.max(0, Math.floor(snapMinX - snapPad))
    const snapY = Math.max(0, Math.floor(snapMinY - snapPad))
    const snapW = Math.max(1, Math.min(width, Math.ceil(snapMaxX + snapPad)) - snapX)
    const snapH = Math.max(1, Math.min(height, Math.ceil(snapMaxY + snapPad)) - snapY)
    const canvasSnap = measurePrimitive(observePrimitive, 'paint-pickup-canvas-snap', () => ctx.getImageData(snapX, snapY, snapW, snapH))
    const carriedColors = measurePrimitive(observePrimitive, 'paint-pickup-carried-colors', () => buildCarriedColors(curve, color, pickupAmt, canvasSnap, radius, snapX, snapY))
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
      measurePrimitive(observePrimitive, 'paint-raster-bristles', () => drawBristleFootprint(seg, { ctx: oc2, radius, color: segHex, opac, hasPenInput, mutationId, tSpan: [start / (curve.length - 1), (end - 1) / (curve.length - 1)], variance }, tier))
      yield
      // 260930-wm6 ONE PIPELINE: same single deposit path as the fresh branch.
      measurePrimitive(observePrimitive, 'paint-wet-transfer-composition', () => transferToWetLayerClipped(oc2, wetBuffers, waterAmount,
        { x: segBounds.x0, y: segBounds.y0, w: segBounds.w, h: segBounds.h }, width, height,
        paperHeight, undefined, undefined, opac, observePrimitive))
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

  measurePrimitive(observePrimitive, 'paint-raster-bristles', () => drawBristleFootprint(curve, { ctx: oc, radius, color, opac: 1, hasPenInput, mutationId, variance }, tier))

  // 260930-wm6 ONE PIPELINE: the single wet deposit (D-12), never a dry blit.
  measurePrimitive(observePrimitive, 'paint-wet-transfer-composition', () => transferToWetLayerClipped(oc, wetBuffers, waterAmount,
    { x: bounds.x0, y: bounds.y0, w: bounds.w, h: bounds.h }, width, height,
    paperHeight, undefined, undefined, opac, observePrimitive))
}
