// ============================================================
//  transport.ts — wet-gated pigment transport (AQUA-01 / R1.3).
//
//  Conservation law: flux exists only between pixels where BOTH
//  sides are wet (closed neighbourhood at the wet/dry boundary).
//  Pigment therefore never seeps onto dry paper.
//
//  Three terms, in order:
//    1. capillary tide-line velocity — pigment migrates toward
//       the receding wet boundary (lower wetness), the dark-rim
//       mechanism
//    2. advection along that velocity (upwind, conserving)
//    3. wet-gated diffusion (equalization inside the wet region)
//
//  All randomness is absent here — the sim is deterministic.
//  Any scatter lives in deposit.ts behind seededRng (D-20).
// ============================================================

import { WET_EPS, transferMobile, type FluidSheet, type SimTuning } from './fluid'

/** Diffusion rate (pigment equalization inside the wet region) at tuning 0.5. */
const DIFFUSION = 0.09
/** Capillary strength — velocity toward lower wetness at tuning 0.5. */
const CAPILLARY = 0.42
/** Velocity damping per tick. */
const VELOCITY_DAMP = 0.82
/** Cap on |velocity| in pixels per tick. */
const MAX_VELOCITY = 5
/** Cap on the fraction of mobile pigment one advection edge may move. */
const MAX_ADVECTION_FRACTION = 0.35

/** Map a 0..1 param onto a multiplier that is 1.0 at 0.5. */
function tuneScale(p: number): number {
  return 0.35 + p * 1.3
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function isWet(sheet: FluidSheet, i: number): boolean {
  return (sheet.wet[i] ?? 0) > WET_EPS
}

/**
 * Capillary tide-line term: add velocity toward lower wetness so
 * pigment migrates to the receding wet boundary. At the wet/dry
 * edge the gradient points inward, so -grad points outward — the
 * coffee-ring direction a drying wash actually takes.
 */
function applyCapillaryVelocity(sheet: FluidSheet, dt: number, capillary: number): void {
  const { width: w, height: h, wet, u, v } = sheet
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!isWet(sheet, i)) continue
      const left = x > 0 ? (wet[i - 1] ?? 0) : 0
      const right = x + 1 < w ? (wet[i + 1] ?? 0) : 0
      const up = y > 0 ? (wet[i - w] ?? 0) : 0
      const down = y + 1 < h ? (wet[i + w] ?? 0) : 0
      const gradX = (right - left) * 0.5
      const gradY = (down - up) * 0.5
      const nx = clamp((u[i] ?? 0) - capillary * gradX * dt, -MAX_VELOCITY, MAX_VELOCITY)
      const ny = clamp((v[i] ?? 0) - capillary * gradY * dt, -MAX_VELOCITY, MAX_VELOCITY)
      u[i] = nx
      v[i] = ny
    }
  }
}

/**
 * Upwind advection of mobile pigment along (u, v). Flux is
 * clamped to a fraction of the source density and applied only
 * to a wet destination — conservation holds (amount never
 * created, never lands on dry paper).
 */
function advectMobile(sheet: FluidSheet, dt: number): void {
  const { width: w, height: h, u, v, mobile } = sheet
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!isWet(sheet, i)) continue
      const density = mobile[i] ?? 0
      if (density <= 0) continue

      const velX = (u[i] ?? 0) * dt
      if (velX > 0 && x + 1 < w && isWet(sheet, i + 1)) {
        const t = Math.min(MAX_ADVECTION_FRACTION, velX)
        transferMobile(sheet, i, i + 1, density * t)
      } else if (velX < 0 && x > 0 && isWet(sheet, i - 1)) {
        const t = Math.min(MAX_ADVECTION_FRACTION, -velX)
        transferMobile(sheet, i, i - 1, density * t)
      }

      const velY = (v[i] ?? 0) * dt
      const densityAfterX = mobile[i] ?? 0
      if (densityAfterX <= 0) continue
      if (velY > 0 && y + 1 < h && isWet(sheet, i + w)) {
        const t = Math.min(MAX_ADVECTION_FRACTION, velY)
        transferMobile(sheet, i, i + w, densityAfterX * t)
      } else if (velY < 0 && y > 0 && isWet(sheet, i - w)) {
        const t = Math.min(MAX_ADVECTION_FRACTION, -velY)
        transferMobile(sheet, i, i - w, densityAfterX * t)
      }
    }
  }
}

/**
 * Wet-gated diffusion — each wet↔wet edge transfers pigment down
 * the density gradient. Each edge is visited once (right/down)
 * so the total is exactly conserved. A dry neighbour receives
 * nothing (closed neighbourhood, R1.3).
 */
function diffuseMobile(sheet: FluidSheet, dt: number, diffusion: number): void {
  const { width: w, height: h, mobile } = sheet
  const rate = diffusion * dt
  if (rate <= 0) return
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!isWet(sheet, i)) continue
      const di = mobile[i] ?? 0

      if (x + 1 < w && isWet(sheet, i + 1)) {
        const amount = rate * (di - (mobile[i + 1] ?? 0))
        if (amount > 0) transferMobile(sheet, i, i + 1, amount)
        else if (amount < 0) transferMobile(sheet, i + 1, i, -amount)
      }
      if (y + 1 < h && isWet(sheet, i + w)) {
        const amount = rate * ((mobile[i] ?? 0) - (mobile[i + w] ?? 0))
        if (amount > 0) transferMobile(sheet, i, i + w, amount)
        else if (amount < 0) transferMobile(sheet, i + w, i, -amount)
      }
    }
  }
}

/** Velocity decays each tick so a capillary gust does not persist. */
function dampVelocity(sheet: FluidSheet, dt: number): void {
  const factor = Math.pow(VELOCITY_DAMP, dt)
  const { u, v } = sheet
  for (let i = 0; i < u.length; i++) {
    u[i] = (u[i] ?? 0) * factor
    v[i] = (v[i] ?? 0) * factor
  }
}

/**
 * Inject water velocity in a disc around (cx, cy) — the brush's
 * flow push. This is the liquid physics: water moving through the
 * stroke direction drags mobile pigment with it (advection). A
 * still brush splashes (random direction) so dwelling still stirs.
 */
export function splatVelocity(
  sheet: FluidSheet,
  cx: number,
  cy: number,
  radius: number,
  vx: number,
  vy: number,
  strength: number,
): void {
  if (!(strength > 0) || radius <= 0) return
  const { width: w, height: h, u, v } = sheet
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
      const fall = 1 - dist / r
      const k = fall * fall * strength
      const i = y * w + x
      u[i] = clamp((u[i] ?? 0) + vx * k, -MAX_VELOCITY, MAX_VELOCITY)
      v[i] = clamp((v[i] ?? 0) + vy * k, -MAX_VELOCITY, MAX_VELOCITY)
    }
  }
}

/**
 * Advance mobile pigment transport by `dt`.
 * Order: capillary velocity → advection → diffusion → damp.
 */
export function transportStep(sheet: FluidSheet, dt: number, tuning: SimTuning): void {
  if (!(dt > 0)) return
  const capillary = CAPILLARY * tuneScale(tuning.flow)
  const diffusion = DIFFUSION * tuneScale(tuning.bleed)
  applyCapillaryVelocity(sheet, dt, capillary)
  advectMobile(sheet, dt)
  diffuseMobile(sheet, dt, diffusion)
  dampVelocity(sheet, dt)
}
