// ============================================================
//  Physics Orchestration Step
//  Delegates to Stam stable fluids solver (fluids.ts) + drying (drying.ts).
//  No module-level mutable state. No DOM access.
// ============================================================

import type { WetBuffers, DryingLUT, FluidBuffers, FluidConfig } from '../types'
import { BLOW_DECAY } from '../types'
import { dryStep } from './drying'
import { fluidPhysicsStep } from './fluids'

/**
 * Combined physics step: flow + dry + blow decay.
 * Orchestrates fluidPhysicsStep (Stam solver) + dryStep + blow decay per tick.
 * Updated from v3.html physicsStep() line 1926 — now uses stable fluids (D-01).
 */
export function physicsStep(
  wet: WetBuffers,
  drying: DryingLUT,
  ctx: CanvasRenderingContext2D,
  fluid: FluidBuffers,
  fluidConfig: FluidConfig,
  blowDX: Float32Array,
  blowDY: Float32Array,
  width: number,
  height: number,
  strength: number,
  drySpeed: number,
  physicsMode: 'local' | 'last' | 'all' | null,
  lastStrokeBounds: { x0: number; y0: number; x1: number; y1: number } | null,
  physicsTickCount: number,
  sampleHFn: (x: number, y: number) => number,
  paperHeight: Float32Array | null,
): void {
  // Stam stable fluids solver (replaces FBM-displaced height-gradient diffusion)
  fluidPhysicsStep(
    wet, fluid, fluidConfig,
    width, height,
    blowDX, blowDY,
    lastStrokeBounds, physicsMode, sampleHFn,
  )

  // Drying
  dryStep(wet, drying, ctx, width, height, drySpeed, paperHeight)

  // Decay blow displacement bias (D-09)
  const size = width * height
  for (let i = 0; i < size; i++) {
    if (blowDX[i] !== 0 || blowDY[i] !== 0) {
      blowDX[i] *= BLOW_DECAY
      blowDY[i] *= BLOW_DECAY
      // Zero out very small values to prevent perpetual computation
      if (Math.abs(blowDX[i]) < 0.01) blowDX[i] = 0
      if (Math.abs(blowDY[i]) < 0.01) blowDY[i] = 0
    }
  }
}
