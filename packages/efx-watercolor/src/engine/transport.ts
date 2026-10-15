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

import { WET_EPS, transferMobile, type FluidSheet } from './fluid'

/** Diffusion rate (pigment equalization inside the wet region). */
const DIFFUSION = 0.16
/** Capillary strength — velocity toward lower wetness. */
const CAPILLARY = 0.85
/** Velocity damping per tick. */
const VELOCITY_DAMP = 0.82
/** Cap on |velocity| in pixels per tick. */
const MAX_VELOCITY = 1.5
/** Cap on the fraction of mobile pigment one advection edge may move. */
const MAX_ADVECTION_FRACTION = 0.45

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
function applyCapillaryVelocity(sheet: FluidSheet, dt: number): void {
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
      const nx = clamp((u[i] ?? 0) - CAPILLARY * gradX * dt, -MAX_VELOCITY, MAX_VELOCITY)
      const ny = clamp((v[i] ?? 0) - CAPILLARY * gradY * dt, -MAX_VELOCITY, MAX_VELOCITY)
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
function diffuseMobile(sheet: FluidSheet, dt: number): void {
  const { width: w, height: h, mobile } = sheet
  const rate = DIFFUSION * dt
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
 * Advance mobile pigment transport by `dt`.
 * Order: capillary velocity → advection → diffusion → damp.
 */
export function transportStep(sheet: FluidSheet, dt: number): void {
  if (!(dt > 0)) return
  applyCapillaryVelocity(sheet, dt)
  advectMobile(sheet, dt)
  diffuseMobile(sheet, dt)
  dampVelocity(sheet, dt)
}
