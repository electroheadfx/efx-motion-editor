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
import { WET_EPS, type FluidSheet } from './fluid'

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
}

/** Pen marks are thinner and harder than brush at equal size (AQUA-02). */
const PEN_RADIUS_SCALE = 0.42
/** Pen lays a denser, drier mark. */
const PEN_STRENGTH_SCALE = 1.35
const PEN_WATER_SCALE = 0.35
/** Flat-top body of the brush stamp (fraction of radius at full coverage). */
const BRUSH_BODY = 0.55
/** Flat-top body of the pen stamp — harder edge. */
const PEN_BODY = 0.78

function addPigmentAt(
  sheet: FluidSheet,
  i: number,
  coverage: number,
  color: Rgb,
): void {
  const existing = sheet.mobile[i] ?? 0
  const add = coverage
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
      // Flat-top with a soft rim so a wash reads uniform.
      const t = clamp01((r - dist) / (r * 0.4))
      const coverage = smoothstep(t) * water
      if (coverage <= 0) continue
      // Subtle seeded mottle so the wet field is not a perfect disc.
      const mottle = 0.88 + rng() * 0.24
      addWetAt(sheet, y * w + x, coverage * mottle)
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
      // Flat-top body with a soft rim — a wash reads uniform in the
      // middle and falls off at the edge (the hard wet-on-dry case
      // then keeps that rim, and wet-in-wet blooms past it).
      const inner = r * body
      const t = dist <= inner ? 1 : clamp01((r - dist) / Math.max(1e-6, r - inner))
      const coverage = smoothstep(t) * strength
      if (coverage <= 0) continue
      // Always-on seeded density noise — the seed is consumed so two
      // traceSeeds can never alias (D-20 / must-have truth 6).
      const noise = 0.82 + rng() * 0.36
      const amount = coverage * noise
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

  switch (tool) {
    case 'water':
      stampWet(sheet, cx, cy, radius, water > 0 ? water : 1, rng)
      return
    case 'lift':
      stampLift(sheet, cx, cy, radius, strength, rng)
      return
    case 'brush':
      stampPigment(sheet, cx, cy, radius, strength, water, color, BRUSH_BODY, rng)
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
      )
      return
    default:
      // Unreachable — assertAquarelleTool already threw.
      throw new RangeError(`Unknown aquarelle tool: ${String(tool)}`)
  }
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
  const sizeParam = stroke.engine.params['size']
  const baseRadius = Math.max(1, (Number.isFinite(sizeParam) ? Number(sizeParam) : 12) / 2)
  const radius = Math.max(1, baseRadius * (overrides?.tip ?? 1))
  const scatter = Math.max(0, (overrides?.scatter ?? 1) - 1) * radius
  const waterParam = stroke.engine.params['water']
  const waterAmount = Number.isFinite(waterParam)
    ? clamp01(Number(waterParam) / 100)
    : 0.5

  // Distinct streams per role (D-20) — water never lands on pigment's pattern.
  const pigmentRng = seededRng(stroke.traceSeed, 'pigment')
  const waterRng = seededRng(stroke.traceSeed, 'water')

  const stampAt = (x: number, y: number, pressure: number): void => {
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
        water: tool === 'water' ? 1 : waterAmount,
        color: stroke.engine.color ?? stroke.color ?? null,
      },
      rng,
    )
  }

  // Stamp the recorded sample positions.
  for (const pt of pts) {
    const pressure = Number.isFinite(pt.p) ? clamp01(pt.p) : 0.5
    stampAt(pt.x, pt.y, Math.max(0.15, pressure))
  }

  // Bridge gaps so a fast stroke stays continuous.
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
