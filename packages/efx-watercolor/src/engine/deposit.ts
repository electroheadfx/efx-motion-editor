// ============================================================
//  deposit — engine-2 pigment deposit along a stroke path.
//
//  Two surfaces:
//    1. depositStroke (56-01 tracer): stamps pigment along
//       `stroke.pts` onto a 2d canvas using mixSpectral for
//       colour (subtractive, R1.2) and seededRng(traceSeed,
//       'deposit') for any scatter — ZERO unseeded RNG in this
//       path (D-20). Unpainted pixels stay untouched (alpha 0).
//    2. sheet deposit (56-03): stampTool / depositStrokeOnSheet
//       drive the FluidSheet via the four tools
//       (brush | water | pen | lift) — the fluid-core path the
//       look laws pin. All randomness from seededRng(traceSeed,
//       streamKey) with distinct stream keys per role
//       ('water' | 'pigment' | 'granulation', D-20).
//
//  Fluid physics lives in fluid.ts / transport.ts / drying.ts;
//  this module only deposits. Engine-side paper influence is the
//  DEPOSIT role (D-21 / P6) — never the display fond.
// ============================================================

import { mixSpectral } from '@efxlab/efx-spectral'
import type { Rgb } from '@efxlab/efx-spectral'
import { seededRng } from '@efxlab/efx-paint-host'
import type { StudioStroke } from '@efxlab/efx-paint-host/animation'
import {
  AQUARELLE_TOOLS,
  type AquarelleStrokePayload,
  type AquarelleTool,
} from '../payload/toStudioStroke'
import type { AquarelleTip } from '../brushes/tips'
import { toolOverridesFromTip } from '../brushes/tips'
import { WET_EPS, MAX_DENSITY, type FluidSheet } from './fluid'
import { splatVelocity } from './transport'

// Re-exported so callers can name the closed tool union from the
// engine surface (the test contract imports it from './deposit').
export type { AquarelleTool } from '../payload/toStudioStroke'
export { AQUARELLE_TOOLS } from '../payload/toStudioStroke'

const TOOL_SET: ReadonlySet<string> = new Set<string>(AQUARELLE_TOOLS)

/** Fail-closed tool guard — throws on any kind outside the closed union. */
export function assertAquarelleTool(tool: string): asserts tool is AquarelleTool {
  if (!TOOL_SET.has(tool)) {
    throw new RangeError(`Unknown aquarelle tool: ${tool} (expected brush | water | pen | lift)`)
  }
}

// ---------------------------------------------------------------------------
// Shared colour + geometry helpers
// ---------------------------------------------------------------------------

function parseHexColor(hex: string | null): Rgb {
  if (!hex) return [32, 32, 32]
  let s = hex.trim()
  if (s.startsWith('#')) s = s.slice(1)
  if (s.length === 3) s = s[0]! + s[0]! + s[1]! + s[1]! + s[2]! + s[2]!
  if (s.length !== 6) return [32, 32, 32]
  const n = Number.parseInt(s, 16)
  if (!Number.isFinite(n)) return [32, 32, 32]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function smoothstep(t: number): number {
  const x = t <= 0 ? 0 : t >= 1 ? 1 : t
  return x * x * (3 - 2 * x)
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/**
 * Deterministic spatial hash in 0..1. Same (x, y) always yields
 * the same value (D-20: no unseeded RNG).
 */
function hash2(x: number, y: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * Smooth value noise in 0..1 — bilinear interpolation of the hash
 * grid so neighbouring pixels share a value. This is the paper-grain
 * / wash-mottle texture: blotchy and organic, never white noise.
 */
function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash2(xi, yi)
  const b = hash2(xi + 1, yi)
  const c = hash2(xi, yi + 1)
  const d = hash2(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

// ---------------------------------------------------------------------------
// Sheet deposit (56-03) — the fluid-core path the look laws pin.
// ---------------------------------------------------------------------------

export interface ToolStampOptions {
  /** Stamp radius in pixels (the shared Size parameter's half-extent). */
  radius: number
  /** Pigment strength / pressure multiplier (0..1 typical). */
  strength?: number
  /** Wetness added by the stamp (0..1 typical). */
  water?: number
  /** Pigment colour (hex string). Absent = default dark. */
  color?: string | null
  /** Pigment concentration on the brush (load × capacity, 0..1 typical). */
  load?: number
  /** Paper-grain mottle amount (grain multiplier, 1 = neutral). */
  grain?: number
  /** Stroke direction (unit-ish) for the water-flow push. */
  vx?: number
  vy?: number
  /** Flow-push strength (0..1 typical). */
  flow?: number
  /** Brush reservoir 0..1 — 1 = loaded, 0 = running dry. */
  reservoir?: number
}

/** Pen marks are thinner and harder than brush at equal size (AQUA-02). */
const PEN_RADIUS_SCALE = 0.42
/** Pen lays a denser, drier mark. */
const PEN_STRENGTH_SCALE = 1.35
const PEN_WATER_SCALE = 0.35
/** Flat-top body of the brush stamp (fraction of radius at full coverage). */
const BRUSH_BODY = 0.0
/** Flat-top body of the pen stamp — still a soft core so consecutive stamps merge. */
const PEN_BODY = 0.3
/**
 * Per-stamp pigment load at full coverage. Brush is a translucent
 * wash so overlapping stamps build a glaze instead of a plastic
 * tube; pen is denser (AQUA-02). These are per-TICK deposits (the
 * live surface stamps once per host tick).
 */
const BRUSH_LOAD = 0.2
const PEN_LOAD = 0.34
/** Hard ceiling on the resolved load multiplier (load × capacity). */
const MAX_LOAD_SCALE = 1.6
/** Water reactivation: fraction of fixed pigment a water stamp lifts back into suspension. */
const WATER_REACTIVATE = 0.28

function addPigmentAt(
  sheet: FluidSheet,
  i: number,
  coverage: number,
  color: Rgb,
): void {
  const existing = sheet.mobile[i] ?? 0
  const total = existing + (sheet.fixed[i] ?? 0)
  // Asymptotic approach to MAX_DENSITY — further deposit still
  // darkens a little but never turns a wash into opaque paint.
  const room = Math.max(0, 1 - total / MAX_DENSITY)
  const add = coverage * room
  if (add <= 0) return
  const r = (sheet.mobileR[i] ?? 0) + color[0] * add
  const g = (sheet.mobileG[i] ?? 0) + color[1] * add
  const b = (sheet.mobileB[i] ?? 0) + color[2] * add
  sheet.mobile[i] = existing + add
  sheet.mobileR[i] = r
  sheet.mobileG[i] = g
  sheet.mobileB[i] = b
}

function addWetAt(sheet: FluidSheet, i: number, amount: number): void {
  const next = (sheet.wet[i] ?? 0) + amount
  sheet.wet[i] = next > 1 ? 1 : next
}

/**
 * Lift a fraction of fixed pigment back into suspension so water
 * can move it (soften edges / push paint). Total pigment is
 * conserved — this only changes which buffer holds it.
 */
function reactivateAt(sheet: FluidSheet, i: number, fraction: number): void {
  const f = sheet.fixed[i] ?? 0
  if (f <= 0 || fraction <= 0) return
  const moved = f * Math.min(1, fraction)
  const share = moved / f
  const r = (sheet.fixedR[i] ?? 0) * share
  const g = (sheet.fixedG[i] ?? 0) * share
  const b = (sheet.fixedB[i] ?? 0) * share
  sheet.fixed[i] = f - moved
  sheet.fixedR[i] = (sheet.fixedR[i] ?? 0) - r
  sheet.fixedG[i] = (sheet.fixedG[i] ?? 0) - g
  sheet.fixedB[i] = (sheet.fixedB[i] ?? 0) - b
  sheet.mobile[i] = (sheet.mobile[i] ?? 0) + moved
  sheet.mobileR[i] = (sheet.mobileR[i] ?? 0) + r
  sheet.mobileG[i] = (sheet.mobileG[i] ?? 0) + g
  sheet.mobileB[i] = (sheet.mobileB[i] ?? 0) + b
}

function liftAt(sheet: FluidSheet, i: number, coverage: number): void {
  const m = sheet.mobile[i] ?? 0
  if (m <= 0 || coverage <= 0) return
  const removed = Math.min(m, m * clamp01(coverage))
  const share = removed / m
  sheet.mobile[i] = m - removed
  sheet.mobileR[i] = (sheet.mobileR[i] ?? 0) * (1 - share)
  sheet.mobileG[i] = (sheet.mobileG[i] ?? 0) * (1 - share)
  sheet.mobileB[i] = (sheet.mobileB[i] ?? 0) * (1 - share)
}

/** Wet-only stamp (tool 'water') — raises wetness, never pigment. */
function stampWet(
  sheet: FluidSheet,
  cx: number,
  cy: number,
  radius: number,
  water: number,
  rng: () => number,
  reactivate: number = WATER_REACTIVATE,
): void {
  if (!(water > 0) || radius <= 0) return
  const w = sheet.width
  const h = sheet.height
  const r = radius
  const x0 = Math.max(0, Math.floor(cx - r - 1))
  const x1 = Math.min(w - 1, Math.ceil(cx + r + 1))
  const y0 = Math.max(0, Math.floor(cy - r - 1))
  const y1 = Math.min(h - 1, Math.ceil(cy + r + 1))
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > r) continue
      // Soft wash profile — no flat-top disc.
      const t = clamp01((r - dist) / r)
      const coverage = smoothstep(t) * water
      if (coverage <= 0) continue
      // Subtle seeded mottle so the wet field is not a perfect disc.
      const mottle = 0.88 + rng() * 0.24
      const i = y * w + x
      addWetAt(sheet, i, coverage * mottle)
      // Water lifts settled pigment back into suspension so it can
      // bloom / be pushed — the 'soften edges or move wet paint' law.
      if (reactivate > 0) reactivateAt(sheet, i, coverage * reactivate)
    }
  }
}

/** Lift stamp (tool 'lift') — subtracts wet pigment, deposits nothing. */
function stampLift(
  sheet: FluidSheet,
  cx: number,
  cy: number,
  radius: number,
  strength: number,
  rng: () => number,
): void {
  if (!(strength > 0) || radius <= 0) return
  const w = sheet.width
  const h = sheet.height
  const r = radius
  const x0 = Math.max(0, Math.floor(cx - r - 1))
  const x1 = Math.min(w - 1, Math.ceil(cx + r + 1))
  const y0 = Math.max(0, Math.floor(cy - r - 1))
  const y1 = Math.min(h - 1, Math.ceil(cy + r + 1))
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > r) continue
      const t = clamp01((r - dist) / (r * 0.45))
      const coverage = smoothstep(t) * strength * (0.85 + rng() * 0.3)
      liftAt(sheet, y * w + x, coverage)
    }
  }
}

/** Pigment stamp (tools 'brush' / 'pen') — pigment + wetness. */
function stampPigment(
  sheet: FluidSheet,
  cx: number,
  cy: number,
  radius: number,
  strength: number,
  water: number,
  color: Rgb,
  body: number,
  rng: () => number,
  load: number = BRUSH_LOAD,
  grain: number = 1,
): void {
  if (!(strength > 0) || radius <= 0) return
  const w = sheet.width
  const h = sheet.height
  const r = radius
  const x0 = Math.max(0, Math.floor(cx - r - 1))
  const x1 = Math.min(w - 1, Math.ceil(cx + r + 1))
  const y0 = Math.max(0, Math.floor(cy - r - 1))
  const y1 = Math.min(h - 1, Math.ceil(cy + r + 1))
  // Organic edge: a slight radius wobble so the union of stamps
  // reads as a brush mark. Kept small — a big wobble scallops the
  // stroke into visible beads.
  const wobble = 1 + (rng() - 0.5) * 0.06 * Math.max(0, grain)
  const re = r * wobble
  // Grain scales with the mark: a wash carries paper tooth, a thin
  // pen line stays clean (fixed-pixel noise aliases into beads).
  const grainScale = Math.min(1, re / 10)
  const mottleScale = Math.max(1.8, re * 0.45)
  const edgeScale = Math.max(1.5, re * 0.3)
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      // Fine edge noise — a subtle irregularity like a brush on
      // paper, not a ragged cutout.
      const edgeNoise = valueNoise(x / edgeScale, y / edgeScale)
      const rEff = re * (1 + (edgeNoise - 0.5) * 0.05 * Math.max(0, grain) * grainScale)
      if (dist > rEff) continue
      // Soft radial falloff. body=0 is a smooth wash (brush);
      // body>0 keeps a denser core and a harder rim (pen).
      const inner = rEff * body
      const t = dist <= inner ? 1 : clamp01((rEff - dist) / Math.max(1e-6, rEff - inner))
      const coverage = smoothstep(t) * strength
      if (coverage <= 0) continue
      // Fine wash mottle — paper-tooth scale, low contrast, so the
      // wash reads filled with subtle variation (D-20: rng still
      // consumed per stamp).
      const mottle = valueNoise(x / mottleScale + 17.3, y / mottleScale + 9.1)
      const mottleSpan = 0.07 * Math.max(0.15, grain) * grainScale
      const noise = 1 - mottleSpan * 0.5 + mottle * mottleSpan
      const amount = coverage * noise * load
      const i = y * w + x
      addPigmentAt(sheet, i, amount, color)
      if (water > 0) addWetAt(sheet, i, water * coverage)
    }
  }
}

/**
 * Stamp one tool application at (cx, cy) onto the sheet.
 * Fail-closed: an unknown tool throws (no silent fifth mode).
 * The four tools are distinct deposit/transport modes, not a
 * parameter tweak (AQUA-02 flagged assumption).
 */
export function stampTool(
  sheet: FluidSheet,
  tool: AquarelleTool,
  cx: number,
  cy: number,
  options: ToolStampOptions,
  rng: () => number = () => 0.5,
): void {
  assertAquarelleTool(tool)
  const radius = Math.max(0.5, options.radius)
  const strength = options.strength ?? 1
  const water = options.water ?? 0
  const color = parseHexColor(options.color ?? null)
  const grain = options.grain ?? 1
  const loadScale = (options.load ?? 1) * (options.reservoir ?? 1)
  const flow = options.flow ?? 0
  const vx = options.vx ?? 0
  const vy = options.vy ?? 0

  switch (tool) {
    case 'water':
      // Water deposits NO pigment. It wets the paper and PUSHES —
      // the flow injection is the liquid physics that drags existing
      // paint around (the playground's brushWet + splatVelocity).
      stampWet(sheet, cx, cy, radius, water > 0 ? water : 1, rng)
      if (flow > 0) {
        const mag = Math.hypot(vx, vy)
        if (mag > 1e-4) splatVelocity(sheet, cx, cy, radius * 1.15, vx / mag, vy / mag, flow * 3.5)
      }
      return
    case 'lift':
      stampLift(sheet, cx, cy, radius, strength, rng)
      return
    case 'brush':
      stampPigment(
        sheet,
        cx,
        cy,
        radius,
        strength,
        water,
        color,
        BRUSH_BODY,
        rng,
        BRUSH_LOAD * loadScale,
        grain,
      )
      if (flow > 0 && (vx !== 0 || vy !== 0)) {
        const mag = Math.hypot(vx, vy) || 1
        splatVelocity(sheet, cx, cy, radius * 1.2, vx / mag, vy / mag, flow * 1.8)
      }
      return
    case 'pen':
      stampPigment(
        sheet,
        cx,
        cy,
        radius * PEN_RADIUS_SCALE,
        strength * PEN_STRENGTH_SCALE,
        water * PEN_WATER_SCALE,
        color,
        PEN_BODY,
        rng,
        PEN_LOAD * loadScale,
        grain,
      )
      return
    default:
      // Unreachable — assertAquarelleTool already threw.
      throw new RangeError(`Unknown aquarelle tool: ${String(tool)}`)
  }
}

/**
 * Resolved brush response for one stamp / one sim tick.
 * Built from the AQUA-04 param bag + D-08 multipliers so the live
 * surface and the bake path share one law.
 */
export interface AquarelleResponse {
  /** Effective stamp radius (pixels, before any sim-resolution scale). */
  radius: number
  /** Pigment load multiplier (load × capacity, scaled to a sane band). */
  load: number
  /** Wetness added per stamp (water × wetRound, 0..1). */
  water: number
  /** Paper-grain mottle amount (grain, 1 = neutral). */
  grain: number
  /** Positional scatter multiplier (scatter, 1 = neutral). */
  scatter: number
  /** Sim tuning for step() — flow / bleed / dry / edge / granulation. */
  tuning: {
    flow: number
    bleed: number
    dry: number
    edge: number
    granulation: number
  }
}

function param01(params: Record<string, number> | undefined, key: string, fallback: number): number {
  const raw = Number(params?.[key])
  if (!Number.isFinite(raw)) return fallback
  return clamp01(raw / 100)
}

/**
 * Map the AQUA-04 globals (0..100) + D-08 multipliers onto the
 * stamp + sim response. One formula for live and bake.
 */
export function resolveAquarelleResponse(
  params: Record<string, number> | undefined,
  overrides?: { tip?: number; scatter?: number; capacity?: number; grain?: number; wetRound?: number },
): AquarelleResponse {
  const sizeRaw = Number(params?.['size'])
  const baseRadius = Math.max(1, (Number.isFinite(sizeRaw) ? sizeRaw : 12) / 2)
  const tip = overrides?.tip ?? 1
  const capacity = overrides?.capacity ?? 1
  const grain = overrides?.grain ?? 1
  const wetRound = overrides?.wetRound ?? 1
  const scatter = overrides?.scatter ?? 1

  const load01 = param01(params, 'load', 0.5)
  const water01 = param01(params, 'water', 0.5)

  return {
    radius: Math.max(1, baseRadius * tip),
    // load 0.5 → 1.0× base stamp load; capacity scales it. Capped so
    // a maxed-out slider can never saturate a wash to marker opacity.
    load: Math.min(MAX_LOAD_SCALE, (0.35 + load01 * 1.3) * capacity),
    water: clamp01(water01 * wetRound),
    grain,
    scatter,
    tuning: {
      flow: param01(params, 'flow', 0.5),
      bleed: param01(params, 'bleed', 0.5),
      dry: param01(params, 'dry', 0.5),
      edge: param01(params, 'edge', 0.5),
      granulation: param01(params, 'granulation', 0.5),
    },
  }
}

/**
 * Effective on-sheet radius for a tool at the given base radius.
 * Pen is thinner than brush at equal Size (AQUA-02). Gap-bridging
 * MUST use this or a pen stroke beads into separate discs.
 */
export function toolEffectiveRadius(tool: AquarelleTool, baseRadius: number): number {
  return tool === 'pen' ? baseRadius * PEN_RADIUS_SCALE : baseRadius
}

/** Gap-bridge spacing as a fraction of the tool-effective radius. */
export function toolBridgeFraction(tool: AquarelleTool): number {
  return tool === 'pen' ? 0.28 : 0.35
}

/**
 * Deposit a full stroke onto the sheet using the payload's tool.
 * Randomness draws from seededRng(stroke.traceSeed, streamKey)
 * with distinct stream keys per role ('water' | 'pigment' |
 * 'granulation', D-20) so their patterns never alias.
 */
export function depositStrokeOnSheet(
  sheet: FluidSheet,
  stroke: StudioStroke<AquarelleStrokePayload>,
  tip?: AquarelleTip,
): void {
  const tool = stroke.engine.tool
  assertAquarelleTool(tool)

  const pts = stroke.pts
  if (pts.length === 0) return

  const overrides = stroke.engine.toolOverrides ?? (tip ? toolOverridesFromTip(tip) : undefined)
  const response = resolveAquarelleResponse(stroke.engine.params, overrides)
  const radius = response.radius
  const scatter = Math.max(0, response.scatter - 1) * radius

  // Distinct streams per role (D-20) — water never lands on pigment's pattern.
  const pigmentRng = seededRng(stroke.traceSeed, 'pigment')
  const waterRng = seededRng(stroke.traceSeed, 'water')

  const stampAt = (x: number, y: number, pressure: number, loadScale: number): void => {
    const jx = scatter > 0 ? (pigmentRng() - 0.5) * 2 * scatter : 0
    const jy = scatter > 0 ? (pigmentRng() - 0.5) * 2 * scatter : 0
    const strength = Math.min(1, Math.max(0.15, pressure))
    // Always-on sub-pixel jitter so the seed is consumed even at neutral scatter.
    const nx = (pigmentRng() - 0.5) * 0.6
    const ny = (pigmentRng() - 0.5) * 0.6
    const rng = tool === 'water' ? waterRng : pigmentRng
    stampTool(
      sheet,
      tool,
      x + jx + nx,
      y + jy + ny,
      {
        radius,
        strength,
        water: tool === 'water' ? 1 : response.water,
        color: stroke.engine.color ?? stroke.color ?? null,
        // One tick's pigment, split across the segment's stamps.
        load: response.load * loadScale,
        grain: response.grain,
      },
      rng,
    )
  }

  // Each recorded point is one host tick. Deposit that tick's
  // pigment along the segment leading to it (gap-bridging splits
  // the load) so density tracks dwell time, never stamp count.
  const bridgeRadius = toolEffectiveRadius(tool, radius)
  const bridgeStep = Math.max(0.25, bridgeRadius * toolBridgeFraction(tool))
  if (pts.length === 1) {
    const pt = pts[0]!
    stampAt(pt.x, pt.y, Math.max(0.15, clamp01(pt.p)), 1)
    return
  }
  for (let i = 0; i < pts.length; i++) {
    const b = pts[i]!
    const a = i > 0 ? pts[i - 1]! : b
    const pressure = Math.max(0.15, clamp01(Number.isFinite(b.p) ? b.p : 0.5))
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const steps = Math.max(1, Math.ceil(dist / bridgeStep))
    for (let s = 1; s <= steps; s++) {
      const t = s / steps
      stampAt(a.x + dx * t, a.y + dy * t, pressure, 1 / steps)
    }
  }
}

// ---------------------------------------------------------------------------
// Canvas tracer (56-01) — kept for EngineAdapter compatibility.
// ---------------------------------------------------------------------------

export interface DepositOptions {
  width: number
  height: number
}

/** Minimal 2d context surface the deposit writes through. */
export interface DepositCanvas {
  getContext(id: '2d'): {
    createImageData(w: number, h: number): {
      width: number
      height: number
      data: Uint8ClampedArray
    }
    getImageData(x: number, y: number, w: number, h: number): {
      width: number
      height: number
      data: Uint8ClampedArray
    }
    putImageData(
      imageData: { width: number; height: number; data: Uint8ClampedArray },
      x: number,
      y: number,
    ): void
  } | null
}

/**
 * Stamp pigment along `stroke.pts` using the given tip.
 * Unpainted pixels stay alpha 0 — only coverage under the stamp
 * is written. The 56-01 tracer surface; the fluid-core path is
 * depositStrokeOnSheet.
 */
export function depositStroke(
  canvas: DepositCanvas,
  stroke: StudioStroke<AquarelleStrokePayload>,
  tip: AquarelleTip,
  options: DepositOptions,
): void {
  const { width, height } = options
  if (width <= 0 || height <= 0) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const pts = stroke.pts
  if (pts.length === 0) return

  const pigment = parseHexColor(stroke.color ?? stroke.engine.color ?? null)
  const overrides = stroke.engine.toolOverrides ?? toolOverridesFromTip(tip)
  const sizeParam = stroke.engine.params['size']
  const baseRadius = Math.max(1, (Number.isFinite(sizeParam) ? Number(sizeParam) : 12) / 2)
  // Pen is thinner than brush at equal size (AQUA-02) — same law as the sheet path.
  const tool = stroke.engine.tool
  const toolScale = tool === 'pen' ? PEN_RADIUS_SCALE : 1
  const radius = Math.max(1, baseRadius * (overrides.tip ?? 1) * toolScale)

  // Deterministic scatter — per-stroke stream, never an unseeded RNG (D-20).
  const rng = seededRng(stroke.traceSeed, 'deposit')
  const scatter = Math.max(0, (overrides.scatter ?? 1) - 1) * radius

  const image = ctx.getImageData(0, 0, width, height)
  const data = image.data

  // Stamp along the polyline, sampling densely enough to close gaps.
  const stampAt = (cx: number, cy: number, strength: number): void => {
    const r = Math.ceil(radius)
    const x0 = Math.max(0, Math.floor(cx - r))
    const x1 = Math.min(width - 1, Math.ceil(cx + r))
    const y0 = Math.max(0, Math.floor(cy - r))
    const y1 = Math.min(height - 1, Math.ceil(cy + r))
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx
        const dy = y - cy
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > radius) continue
        // Soft disc falloff — coverage 0..1.
        const coverage = (1 - dist / radius) * strength
        if (coverage <= 0) continue

        const idx = (y * width + x) * 4
        const existingAlpha = data[idx + 3] ?? 0
        if (existingAlpha <= 0) {
          // First pigment on a transparent pixel — write it directly.
          data[idx] = pigment[0]
          data[idx + 1] = pigment[1]
          data[idx + 2] = pigment[2]
          data[idx + 3] = Math.round(coverage * 255)
        } else {
          // Subtractive mix with the pigment already there (R1.2).
          const existing: Rgb = [data[idx] ?? 0, data[idx + 1] ?? 0, data[idx + 2] ?? 0]
          const mixed = mixSpectral(existing, pigment, coverage)
          data[idx] = mixed[0]
          data[idx + 1] = mixed[1]
          data[idx + 2] = mixed[2]
          data[idx + 3] = Math.min(255, Math.round(existingAlpha + coverage * 255))
        }
      }
    }
  }

  // Always stamp the recorded sample positions.
  for (const pt of pts) {
    const jx = scatter > 0 ? (rng() - 0.5) * 2 * scatter : 0
    const jy = scatter > 0 ? (rng() - 0.5) * 2 * scatter : 0
    const pressure = Number.isFinite(pt.p) ? Math.min(1, Math.max(0.15, pt.p)) : 0.5
    stampAt(pt.x + jx, pt.y + jy, pressure)
  }

  // Bridge gaps between consecutive samples so a fast stroke stays continuous.
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!
    const b = pts[i]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const steps = Math.max(1, Math.ceil(dist / Math.max(1, radius * 0.5)))
    for (let s = 1; s < steps; s++) {
      const t = s / steps
      stampAt(a.x + dx * t, a.y + dy * t, 0.85)
    }
  }

  ctx.putImageData(image, 0, 0)
}
