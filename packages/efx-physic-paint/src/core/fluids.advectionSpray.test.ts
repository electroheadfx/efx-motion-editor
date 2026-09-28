// ============================================================
//  260928-dh1 — advection spray pin (MEASURE FIRST, NO fix)
//
//  Elimination is complete. Image evidence settles the site:
//    post-raster   clean solid ribbon, crisp edges — DEPOSIT is clean
//    post-display  same ribbon wrapped in a DUST HALO of isolated
//                  pixels hugging the whole contour
//  Standing after the refutations: extraction CLEAN (move 2), display
//  map CLEAN (P3/P6b), keep-gate CLEAN, premul round-trip = real bug
//  not the cause (lever 1), 37 x fillFlat REFUTED, paperHeight
//  REFUTED (paper-off 12 282 ~ paper-on 12 285).
//
//  ONE suspect left: fluid advection spraying the low-density fringe
//  into dust. Visual signature is outward push along the velocity
//  field (not paper grain, not layering AA stair-steps). Explains the
//  1/2/3-click degradation (1 564 -> 83 535): each session re-advects.
//
//  This pin is the first suspect vitest can actually see: advect is
//  pure Float32Array math, no Canvas2D dependency (unlike the layering
//  pin, which the analytic substrate could not judge at 114 vs live
//  654).
//
//  ENTRY: feed a CLEAN synthetic ribbon's wet buffers (smooth alpha
//  ramp, controlled low-density fringe) through one production
//  fluidPhysicsStep with the production velocity field (built in-step
//  from height equalization + edge darkening + velStep — no injected
//  velocity). Read the post-step alpha: isolated low-density pixels
//  and tornEdge against the input. A 3-tick cell models the 1/2/3
//  click accumulation.
//
//    SPRAY CONFIRMED -> mechanism named. Fix is confined to fringe
//        handling in the advection/copy-back path. Continuous only
//        (260928-dh1: no hard cutoff). velStep / project / diffuse /
//        the solver's physics quality stay LOCKED.
//    NO SPRAY        -> STOP and report. The only remaining candidate
//        is how the wet fringe is seeded at transfer/dry; re-open the
//        seam with a post-fluid dump instead of guessing.
//
//  Do NOT touch paint.ts in this pass. 260927-ton stays KEEP UNCHANGED.
//  ============================================================

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fluidPhysicsStep } from './fluids'
import { createWetBuffers } from './wet-layer'
import { wetDisplayAlpha } from '../render/compositor'
import type { FluidBuffers, FluidConfig, WetBuffers } from '../types'
import { computeDefectMetrics } from '../../../../app/src/components/physic-paint/performance/depositSpeckleCapture'

const W = 96
const H = 48
const GRID = W * H
const FLUID_GRID = (W + 2) * (H + 2)

/** Engine defaults (EfxPaintEngine.ts:580-584). */
const FLUID_CONFIG: FluidConfig = { viscosity: 0.0001, omega_h: 0.06, darkening: 0.1 }

/** One 245-layer body plateau (same units as fluids.premulRoundTrip). */
const BODY_A = 2882
const BODY_R = 40, BODY_G = 30, BODY_B = 20

/** Body rect + a 4-ring monotonic low-density skirt. */
const BX0 = 24, BX1 = 71, BY0 = 16, BY1 = 31
/** Fringe densities, outermost last — the "controlled low-density fringe". */
const FRINGE = [400, 200, 100, 50]

function makeFluid(): FluidBuffers {
  return {
    u: new Float32Array(FLUID_GRID),
    v: new Float32Array(FLUID_GRID),
    u0: new Float32Array(FLUID_GRID),
    v0: new Float32Array(FLUID_GRID),
    p: new Float32Array(FLUID_GRID),
    div: new Float32Array(FLUID_GRID),
    wetMask: new Float32Array(FLUID_GRID),
    blurMask: new Float32Array(FLUID_GRID),
  }
}

/**
 * CLEAN synthetic ribbon wet field: solid body + smooth monotonic skirt.
 * Zero scattered pixels. Input scores tornEdge = 0 / isolatedPx = 0.
 */
function buildCleanRibbon(): WetBuffers {
  const wet = createWetBuffers(GRID)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      const dx = x < BX0 ? BX0 - x : x > BX1 ? x - BX1 : 0
      const dy = y < BY0 ? BY0 - y : y > BY1 ? y - BY1 : 0
      const d = Math.max(dx, dy)
      let a = 0
      if (d === 0) a = BODY_A
      else if (d <= FRINGE.length) a = FRINGE[d - 1]
      if (a <= 0) continue
      wet.alpha[i] = a
      wet.r[i] = BODY_R
      wet.g[i] = BODY_G
      wet.b[i] = BODY_B
      wet.wetness[i] = 100
      wet.strokeOpacity[i] = 1
    }
  }
  return wet
}

function cloneWet(src: WetBuffers): WetBuffers {
  const w = createWetBuffers(GRID)
  w.r.set(src.r); w.g.set(src.g); w.b.set(src.b)
  w.alpha.set(src.alpha); w.wetness.set(src.wetness)
  w.strokeOpacity.set(src.strokeOpacity)
  return w
}

/** Display-alpha plane (po = 1 linear branch) — what the user sees. */
function displayPlane(wet: WetBuffers): Uint8Array {
  const out = new Uint8Array(GRID)
  for (let i = 0; i < GRID; i++) {
    const d = wetDisplayAlpha(wet.alpha[i], wet.strokeOpacity[i], 0)
    out[i] = Math.max(0, Math.min(255, Math.round(d)))
  }
  return out
}

/** Binary ink footprint of the INPUT (display alpha >= ink floor 4). */
function inkMask(alpha: Uint8Array): Uint8Array {
  const m = new Uint8Array(GRID)
  for (let i = 0; i < GRID; i++) m[i] = alpha[i] >= 4 ? 1 : 0
  return m
}

interface Snapshot {
  label: string
  tornEdge: number
  bodyHardJumps: number
  bodyHfEnergy: number
  isolatedPx: number
  /** ink pixels outside the INPUT ink footprint — the outward dust halo */
  sprayOutside: number
  /** ink pixels that vanished from the INPUT footprint — inward erosion */
  erodedInside: number
  alphaMass: number
}

function snapshot(label: string, wet: WetBuffers, inputMask: Uint8Array): Snapshot {
  const plane = displayPlane(wet)
  const m = computeDefectMetrics(plane, W, H)
  let sprayOutside = 0
  let erodedInside = 0
  for (let i = 0; i < GRID; i++) {
    const ink = plane[i] >= 4 ? 1 : 0
    if (ink && !inputMask[i]) sprayOutside++
    if (!ink && inputMask[i]) erodedInside++
  }
  return {
    label,
    tornEdge: m.tornEdge,
    bodyHardJumps: m.bodyHardJumps,
    bodyHfEnergy: m.bodyHfEnergy,
    isolatedPx: m.isolatedPx,
    sprayOutside,
    erodedInside,
    alphaMass: m.alphaMass,
  }
}

function runTicks(wet: WetBuffers, ticks: number): void {
  const fluid = makeFluid()
  const blowDX = new Float32Array(GRID)
  const blowDY = new Float32Array(GRID)
  for (let t = 0; t < ticks; t++) {
    fluidPhysicsStep(
      wet, fluid, FLUID_CONFIG, W, H,
      blowDX, blowDY,
      null, 'all',
      () => 0.5,
    )
  }
}

function report(rows: Snapshot[]): string {
  const lines = [
    '260928-dh1 — advection spray pin (clean fringe, production velocity field)',
    `canvas ${W}x${H}, body ${BODY_A}, fringe ${FRINGE.join('/')} (4 rings, monotonic)`,
    `config viscosity=${FLUID_CONFIG.viscosity} omega_h=${FLUID_CONFIG.omega_h} darkening=${FLUID_CONFIG.darkening}`,
    'velocity = height equalization + edge darkening + velStep (blowDX/DY = 0)',
    '',
  ]
  for (const r of rows) {
    lines.push(
      `  ${r.label.padEnd(22)} tornEdge=${String(r.tornEdge).padStart(5)}  bodyHardJumps=${String(r.bodyHardJumps).padStart(5)}  isolatedPx=${String(r.isolatedPx).padStart(4)}  sprayOutside=${String(r.sprayOutside).padStart(5)}  erodedInside=${String(r.erodedInside).padStart(5)}  alphaMass=${r.alphaMass}`,
    )
  }
  return lines.join('\n')
}

// ============================================================

describe('260928-dh1 advection spray — clean fringe through fluidPhysicsStep', () => {
  it('one production step + 3-tick accumulation (verdict in the log)', () => {
    const input = buildCleanRibbon()
    const inputMask = inkMask(displayPlane(input))

    const rows: Snapshot[] = []
    rows.push(snapshot('INPUT (clean)', input, inputMask))

    const one = cloneWet(input)
    runTicks(one, 1)
    rows.push(snapshot('1 tick', one, inputMask))

    const three = cloneWet(input)
    runTicks(three, 3)
    rows.push(snapshot('3 ticks (= 3 clicks)', three, inputMask))

    const eight = cloneWet(input)
    runTicks(eight, 8)
    rows.push(snapshot('8 ticks (worst case)', eight, inputMask))

    // Verdict + GREEN pins against the recorded RED baseline (pre-fix).
    // RED (2026-09-28, before applyFringeMobility, f(0) = 1):
    //   1 tick   sprayOutside=   0  tornEdge= 0  alphaMass=226986
    //   3 ticks  sprayOutside= 212  tornEdge= 0  alphaMass=302146
    //   8 ticks  sprayOutside=1624  tornEdge=19  alphaMass=672216
    // GREEN at f(0) = 0.5 (the lowest value that keeps d(b) >= 1 green):
    //   1 tick   sprayOutside=   0  tornEdge= 0
    //   3 ticks  sprayOutside= 134  tornEdge= 1
    //   8 ticks  sprayOutside= 887  tornEdge=13
    // Tradeoff measured: f(0) <= 0.4 kills more dust but BREAKS the
    // 260925-b7c Spread law (260924-rm2 / W6 d(b) >= 1). That is a user
    // decision. isolatedPx = 0 in every cell — the spray is connected
    // outward growth, not isolated crumbs.
    const verdict: string[] = []
    verdict.push('  RED baseline (f(0)=1) sprayOutside: 1 tick 0 / 3 ticks 212 / 8 ticks 1624')
    verdict.push(`  GREEN now (f(0)=0.5): 1 tick ${rows[1].sprayOutside} / 3 ticks ${rows[2].sprayOutside} / 8 ticks ${rows[3].sprayOutside}`)
    verdict.push('  -> SPRAY CONFIRMED and REDUCED, not eliminated. Fringe mobility cuts the outward')
    verdict.push('     dust ~35-45% while holding the Spread law (d(b) >= 1) green.')
    verdict.push('     f(0) <= 0.4 would kill more dust but stamps the production raster (KEEP UNCHANGED')
    verdict.push('     violation). Pushing lower is a user decision.')

    console.log(`${report(rows)}\n${verdict.join('\n')}`)

    // Substrate sanity.
    expect(rows[0].isolatedPx, 'input must be clean (isolatedPx = 0)').toBe(0)
    expect(rows[0].tornEdge, 'input must be clean (tornEdge = 0)').toBe(0)
    expect(rows[0].alphaMass).toBeGreaterThan(0)

    // GREEN pins at f(0) = 0.5 — reduction, measured. Do NOT tighten these
    // to 0: that requires f(0) <= 0.25, which BREAKS d(b) >= 1.
    expect(rows[1].isolatedPx, '1 tick isolatedPx').toBe(0)
    expect(rows[1].sprayOutside, '1 tick sprayOutside').toBe(0)
    expect(rows[2].isolatedPx, '3 ticks isolatedPx').toBe(0)
    expect(rows[2].sprayOutside, `3 ticks sprayOutside=${rows[2].sprayOutside}`).toBeLessThanOrEqual(150)
    expect(rows[3].isolatedPx, '8 ticks isolatedPx').toBe(0)
    expect(rows[3].sprayOutside, `8 ticks sprayOutside=${rows[3].sprayOutside}`).toBeLessThanOrEqual(950)
    expect(rows[3].tornEdge, `8 ticks tornEdge=${rows[3].tornEdge}`).toBeLessThanOrEqual(15)
    // No erosion — the fix contains, it does not eat the body.
    expect(rows[1].erodedInside).toBe(0)
    expect(rows[2].erodedInside).toBe(0)
  })

  it('source shape: one fringe-mobility seam serves both twins, solver velocity untouched', () => {
    const src = readFileSync(join(__dirname, 'fluids.ts'), 'utf8')
    expect(src).toContain('export function applyFringeMobility')
    // 1 definition + 2 call sites (the 260925-iy6 one-seam shape).
    const callSites = src.split('applyFringeMobility(').length - 1
    expect(callSites).toBeGreaterThanOrEqual(3)
    // The solver's velocity is read-only in the mobility seam.
    expect(src).toContain('const f = (ak + FRINGE_MOBILITY_A0) / (ak + FRINGE_MOBILITY_A_HALF)')
    // Wet-channel advect uses the scaled velocity (u0/v0), not the solver's u/v.
    expect(src).toMatch(/advect\(W, H, 0, stamA, srcA, fluid\.u0, fluid\.v0, dt\)/)
    expect(src).toMatch(/advect\(localW, localH, 0, stamA, srcA, u0, v0, dt\)/)
  })
})
