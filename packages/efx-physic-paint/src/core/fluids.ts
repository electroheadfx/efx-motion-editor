// ============================================================
//  Stam Stable Fluids Solver for Watercolor Physics
//  Based on Stam 2003 "Real-Time Fluid Dynamics for Games"
//  With Van Laerhoven water-height equalization and Curtis edge darkening.
//  No module-level mutable state. No DOM access.
// ============================================================

import type { WetBuffers, FluidBuffers, FluidConfig } from '../types'

// === Core solver functions (Stam 2003) ===

/** Grid indexing for (W+2)*(H+2) grids. Interior cells: [1..W] x [1..H] */
export function IX(W: number, i: number, j: number): number {
  return i + (W + 2) * j
}

/**
 * Boundary conditions.
 * b=1: negate X velocity at left/right walls
 * b=2: negate Y velocity at top/bottom walls
 * b=0: copy neighbor values (scalar fields)
 */
export function setBnd(W: number, H: number, b: number, x: Float32Array): void {
  for (let i = 1; i <= W; i++) {
    x[IX(W, i, 0)] = b === 2 ? -x[IX(W, i, 1)] : x[IX(W, i, 1)]
    x[IX(W, i, H + 1)] = b === 2 ? -x[IX(W, i, H)] : x[IX(W, i, H)]
  }
  for (let j = 1; j <= H; j++) {
    x[IX(W, 0, j)] = b === 1 ? -x[IX(W, 1, j)] : x[IX(W, 1, j)]
    x[IX(W, W + 1, j)] = b === 1 ? -x[IX(W, W, j)] : x[IX(W, W, j)]
  }
  // Corners: average of two adjacent cells
  x[IX(W, 0, 0)] = 0.5 * (x[IX(W, 1, 0)] + x[IX(W, 0, 1)])
  x[IX(W, 0, H + 1)] = 0.5 * (x[IX(W, 1, H + 1)] + x[IX(W, 0, H)])
  x[IX(W, W + 1, 0)] = 0.5 * (x[IX(W, W, 0)] + x[IX(W, W + 1, 1)])
  x[IX(W, W + 1, H + 1)] = 0.5 * (x[IX(W, W, H + 1)] + x[IX(W, W + 1, H)])
}

/**
 * Gauss-Seidel relaxation (implicit linear solver).
 * Iterations parameter allows caller to tune: 4 for performance, up to 20 for quality.
 */
export function linSolve(
  W: number, H: number, b: number,
  x: Float32Array, x0: Float32Array,
  a: number, c: number, iterations: number,
): void {
  const invC = 1.0 / c
  for (let k = 0; k < iterations; k++) {
    for (let j = 1; j <= H; j++) {
      for (let i = 1; i <= W; i++) {
        const idx = IX(W, i, j)
        x[idx] = (x0[idx] + a * (
          x[IX(W, i - 1, j)] + x[IX(W, i + 1, j)] +
          x[IX(W, i, j - 1)] + x[IX(W, i, j + 1)]
        )) * invC
      }
    }
    setBnd(W, H, b, x)
  }
}

/**
 * Implicit diffusion. Unconditionally stable for any diff and dt.
 * Uses W*H (non-square) for the diffusion coefficient.
 */
export function diffuse(
  W: number, H: number, b: number,
  x: Float32Array, x0: Float32Array,
  diff: number, dt: number, iterations: number,
): void {
  const a = dt * diff * W * H
  linSolve(W, H, b, x, x0, a, 1 + 4 * a, iterations)
}

/**
 * Semi-Lagrangian advection with bilinear interpolation.
 * Separate dt0x/dt0y scaling for non-square grids.
 */
export function advect(
  W: number, H: number, b: number,
  d: Float32Array, d0: Float32Array,
  u: Float32Array, v: Float32Array,
  dt: number,
): void {
  const dt0x = dt * W
  const dt0y = dt * H
  for (let j = 1; j <= H; j++) {
    for (let i = 1; i <= W; i++) {
      const idx = IX(W, i, j)
      // Backtrace position
      let x = i - dt0x * u[idx]
      let y = j - dt0y * v[idx]
      // Clamp to interior
      if (x < 0.5) x = 0.5
      if (x > W + 0.5) x = W + 0.5
      if (y < 0.5) y = 0.5
      if (y > H + 0.5) y = H + 0.5
      // Bilinear interpolation
      const i0 = x | 0
      const i1 = i0 + 1
      const j0 = y | 0
      const j1 = j0 + 1
      const s1 = x - i0
      const s0 = 1 - s1
      const t1 = y - j0
      const t0 = 1 - t1
      d[idx] = s0 * (t0 * d0[IX(W, i0, j0)] + t1 * d0[IX(W, i0, j1)]) +
               s1 * (t0 * d0[IX(W, i1, j0)] + t1 * d0[IX(W, i1, j1)])
    }
  }
  setBnd(W, H, b, d)
}

/**
 * Pressure projection for incompressibility (divergence-free velocity).
 * Uses hx=1/W, hy=1/H for non-square grid scaling.
 */
export function project(
  W: number, H: number,
  u: Float32Array, v: Float32Array,
  p: Float32Array, div: Float32Array,
  iterations: number,
): void {
  const hx = 1.0 / W
  const hy = 1.0 / H
  for (let j = 1; j <= H; j++) {
    for (let i = 1; i <= W; i++) {
      const idx = IX(W, i, j)
      div[idx] = -0.5 * (
        hx * (u[IX(W, i + 1, j)] - u[IX(W, i - 1, j)]) +
        hy * (v[IX(W, i, j + 1)] - v[IX(W, i, j - 1)])
      )
      p[idx] = 0
    }
  }
  setBnd(W, H, 0, div)
  setBnd(W, H, 0, p)
  linSolve(W, H, 0, p, div, 1, 4, iterations)
  for (let j = 1; j <= H; j++) {
    for (let i = 1; i <= W; i++) {
      const idx = IX(W, i, j)
      u[idx] -= 0.5 * W * (p[IX(W, i + 1, j)] - p[IX(W, i - 1, j)])
      v[idx] -= 0.5 * H * (p[IX(W, i, j + 1)] - p[IX(W, i, j - 1)])
    }
  }
  setBnd(W, H, 1, u)
  setBnd(W, H, 2, v)
}

/** Add source field to target: x[i] += dt * s[i] */
export function addSource(W: number, H: number, x: Float32Array, s: Float32Array, dt: number): void {
  const size = (W + 2) * (H + 2)
  for (let i = 0; i < size; i++) {
    x[i] += dt * s[i]
  }
}

// === High-level pipeline functions (Stam 2003) ===

/**
 * Velocity step: addSource -> diffuse -> project -> advect -> project.
 * Swap is done via array .set() (copy contents, not pointer swap).
 */
export function velStep(
  W: number, H: number,
  u: Float32Array, v: Float32Array,
  u0: Float32Array, v0: Float32Array,
  visc: number, dt: number, iterations: number,
): void {
  addSource(W, H, u, u0, dt)
  addSource(W, H, v, v0, dt)
  // Swap u <-> u0, v <-> v0 (copy u into u0, then diffuse back into u0 from u)
  u0.set(u)
  v0.set(v)
  diffuse(W, H, 1, u, u0, visc, dt, iterations)
  diffuse(W, H, 2, v, v0, visc, dt, iterations)
  project(W, H, u, v, u0, v0, iterations)
  // After project, u0/v0 now contain pressure/div scratch.
  // Need to save current u/v for advection source
  u0.set(u)
  v0.set(v)
  advect(W, H, 1, u, u0, u0, v0, dt)
  advect(W, H, 2, v, v0, u0, v0, dt)
  project(W, H, u, v, u0, v0, iterations)
}

/**
 * Density step: addSource -> diffuse -> advect.
 * Used for scalar field transport (e.g. pigment channels).
 */
export function densStep(
  W: number, H: number,
  x: Float32Array, x0: Float32Array,
  u: Float32Array, v: Float32Array,
  diff: number, dt: number, iterations: number,
): void {
  addSource(W, H, x, x0, dt)
  x0.set(x)
  diffuse(W, H, 0, x, x0, diff, dt, iterations)
  x0.set(x)
  advect(W, H, 0, x, x0, u, v, dt)
}

// === Watercolor-specific functions ===

/**
 * Van Laerhoven water-height equalization (D-02).
 * Adds velocity from height differences between neighboring cells.
 * Water flows from high to low, producing organic spreading.
 */
export function addHeightEqualization(
  W: number, H: number,
  u0: Float32Array, v0: Float32Array,
  waterHeight: Float32Array,
  omega_h: number,
): void {
  for (let j = 1; j <= H; j++) {
    for (let i = 1; i <= W; i++) {
      const idx = IX(W, i, j)
      if (waterHeight[idx] < 1) continue
      // Height gradient drives flow: water moves from high to low
      u0[idx] += omega_h * (waterHeight[IX(W, i - 1, j)] - waterHeight[IX(W, i + 1, j)])
      v0[idx] += omega_h * (waterHeight[IX(W, i, j - 1)] - waterHeight[IX(W, i, j + 1)])
    }
  }
}

/**
 * Curtis edge darkening (D-03).
 * Pushes pigment outward at wet-area boundaries.
 * Where blur < mask (boundary cells), add outward velocity force.
 */
export function darkenEdges(
  W: number, H: number,
  wetMask: Float32Array, blurMask: Float32Array,
  u0: Float32Array, v0: Float32Array,
  darkening: number,
): void {
  for (let j = 1; j <= H; j++) {
    for (let i = 1; i <= W; i++) {
      const idx = IX(W, i, j)
      if (wetMask[idx] < 0.5) continue
      // Interior cells have blur ~= mask; boundary cells have blur < mask
      const edgeFactor = Math.max(0, wetMask[idx] - blurMask[idx])
      if (edgeFactor < 0.001) continue
      // Create outward velocity at edges using gradient of blurred mask
      const gradX = blurMask[IX(W, i + 1, j)] - blurMask[IX(W, i - 1, j)]
      const gradY = blurMask[IX(W, i, j + 1)] - blurMask[IX(W, i, j - 1)]
      u0[idx] -= darkening * gradX * edgeFactor
      v0[idx] -= darkening * gradY * edgeFactor
    }
  }
}

/**
 * Build wet mask from canvas-sized alpha into Stam-sized grid.
 * Maps canvas coordinates (0-based, canvasW*canvasH) to Stam coordinates
 * (1-based interior, (W+2)*(H+2)).
 */
export function buildWetMaskFromAlpha(
  W: number, H: number,
  wetAlpha: Float32Array,
  canvasW: number, canvasH: number,
  wetMask: Float32Array,
  threshold: number,
): void {
  wetMask.fill(0)
  for (let cy = 0; cy < canvasH; cy++) {
    for (let cx = 0; cx < canvasW; cx++) {
      wetMask[IX(W, cx + 1, cy + 1)] = wetAlpha[cy * canvasW + cx] > threshold ? 1.0 : 0.0
    }
  }
}

/**
 * Simple box blur for edge darkening mask.
 * Each pass averages interior cells with their 8 neighbors.
 * Repeated passes approximate Gaussian blur.
 */
export function boxBlur3x3(
  W: number, H: number,
  src: Float32Array, dst: Float32Array,
  passes: number,
): void {
  const gridW = W + 2
  for (let pass = 0; pass < passes; pass++) {
    const input = pass === 0 ? src : dst
    for (let j = 1; j <= H; j++) {
      for (let i = 1; i <= W; i++) {
        const idx = i + gridW * j
        dst[idx] = (
          input[idx - gridW - 1] + input[idx - gridW] + input[idx - gridW + 1] +
          input[idx - 1] + input[idx] + input[idx + 1] +
          input[idx + gridW - 1] + input[idx + gridW] + input[idx + gridW + 1]
        ) / 9
      }
    }
    // Between passes after the first: dst is already the source for next pass.
    // We need to copy dst boundary for correct values on next pass.
    setBnd(W, H, 0, dst)
  }
}

// === Orchestrator function ===

/**
 * Main fluid physics step -- replaces diffuseStep().
 * Runs Stam stable fluids solver with height equalization and edge darkening,
 * then advects wet layer channels through the velocity field.
 *
 * @param wet - Wet paint buffers (canvas-sized, 0-based)
 * @param fluid - Stam solver buffers ((W+2)*(H+2) sized)
 * @param config - Fluid solver parameters (viscosity, omega_h, darkening)
 * @param canvasW - Canvas width
 * @param canvasH - Canvas height
 * @param blowDX - Per-pixel blow tool force X (canvas-sized)
 * @param blowDY - Per-pixel blow tool force Y (canvas-sized)
 * @param lastStrokeBounds - Bounds for last-stroke mode, or null
 * @param physicsMode - 'last' or 'all' mode
 * @param sampleHFn - Paper height sampling function (unused here but kept for API compat)
 */
export function fluidPhysicsStep(
  wet: WetBuffers,
  fluid: FluidBuffers,
  config: FluidConfig,
  canvasW: number,
  canvasH: number,
  blowDX: Float32Array,
  blowDY: Float32Array,
  lastStrokeBounds: { x0: number; y0: number; x1: number; y1: number } | null,
  physicsMode: 'local' | 'last' | 'all' | null,
  _sampleHFn: (x: number, y: number) => number,
): void {
  const W = canvasW
  const H = canvasH
  const dt = 0.016   // 16ms tick
  const gridSize = (W + 2) * (H + 2)
  const iterations = 4   // 4 for performance (discretion)

  // --- Clear velocity sources ---
  fluid.u0.fill(0)
  fluid.v0.fill(0)

  // --- Determine processing bounds for 'last' mode optimization ---
  const margin = 50
  const useLastOnly = physicsMode === 'last' && lastStrokeBounds !== null
  const bx0 = useLastOnly ? Math.max(0, lastStrokeBounds!.x0 - margin) : 0
  const by0 = useLastOnly ? Math.max(0, lastStrokeBounds!.y0 - margin) : 0
  const bx1 = useLastOnly ? Math.min(canvasW - 1, lastStrokeBounds!.x1 + margin) : canvasW - 1
  const by1 = useLastOnly ? Math.min(canvasH - 1, lastStrokeBounds!.y1 + margin) : canvasH - 1

  // --- Copy wet.alpha into Stam-sized array for height equalization ---
  // Reuse fluid.p as temporary (will be zeroed by project() later)
  const waterHeight = new Float32Array(gridSize)
  for (let cy = by0; cy <= by1; cy++) {
    for (let cx = bx0; cx <= bx1; cx++) {
      waterHeight[IX(W, cx + 1, cy + 1)] = wet.alpha[cy * canvasW + cx]
    }
  }

  // --- Water-height equalization (D-02, Van Laerhoven) ---
  addHeightEqualization(W, H, fluid.u0, fluid.v0, waterHeight, config.omega_h)

  // --- Edge darkening (D-03, Curtis FlowOutward) ---
  buildWetMaskFromAlpha(W, H, wet.alpha, canvasW, canvasH, fluid.wetMask, 20)
  boxBlur3x3(W, H, fluid.wetMask, fluid.blurMask, 3)
  darkenEdges(W, H, fluid.wetMask, fluid.blurMask, fluid.u0, fluid.v0, config.darkening)

  // --- Add blow tool forces ---
  for (let cy = by0; cy <= by1; cy++) {
    for (let cx = bx0; cx <= bx1; cx++) {
      const canvasIdx = cy * canvasW + cx
      if (blowDX[canvasIdx] !== 0 || blowDY[canvasIdx] !== 0) {
        const stamIdx = IX(W, cx + 1, cy + 1)
        fluid.u0[stamIdx] += blowDX[canvasIdx]
        fluid.v0[stamIdx] += blowDY[canvasIdx]
      }
    }
  }

  // --- Velocity step (Stam solver) ---
  velStep(W, H, fluid.u, fluid.v, fluid.u0, fluid.v0, config.viscosity, dt, iterations)

  // --- Advect wet layer channels using premultiplied alpha (Pitfall 4) ---
  // Allocate temporary Stam-sized arrays for premultiplied color advection
  const stamRA = new Float32Array(gridSize)   // R * A premultiplied
  const stamGA = new Float32Array(gridSize)   // G * A premultiplied
  const stamBA = new Float32Array(gridSize)   // B * A premultiplied
  const stamA = new Float32Array(gridSize)    // A (alpha)
  const stamW = new Float32Array(gridSize)    // wetness
  const stamSO = new Float32Array(gridSize)   // strokeOpacity * A premultiplied
  // Scratch arrays for advection source
  const srcRA = new Float32Array(gridSize)
  const srcGA = new Float32Array(gridSize)
  const srcBA = new Float32Array(gridSize)
  const srcA = new Float32Array(gridSize)
  const srcW = new Float32Array(gridSize)
  const srcSO = new Float32Array(gridSize)

  // Copy wet buffers to Stam grid with premultiplication
  for (let cy = by0; cy <= by1; cy++) {
    for (let cx = bx0; cx <= bx1; cx++) {
      const canvasIdx = cy * canvasW + cx
      const stamIdx = IX(W, cx + 1, cy + 1)
      const a = wet.alpha[canvasIdx]
      stamRA[stamIdx] = wet.r[canvasIdx] * a
      stamGA[stamIdx] = wet.g[canvasIdx] * a
      stamBA[stamIdx] = wet.b[canvasIdx] * a
      stamA[stamIdx] = a
      stamW[stamIdx] = wet.wetness[canvasIdx]
      stamSO[stamIdx] = (wet.strokeOpacity ? wet.strokeOpacity[canvasIdx] : 1.0) * a
    }
  }

  // Advect each premultiplied channel + alpha through the velocity field
  srcRA.set(stamRA)
  srcGA.set(stamGA)
  srcBA.set(stamBA)
  srcA.set(stamA)
  srcW.set(stamW)
  srcSO.set(stamSO)

  advect(W, H, 0, stamRA, srcRA, fluid.u, fluid.v, dt)
  advect(W, H, 0, stamGA, srcGA, fluid.u, fluid.v, dt)
  advect(W, H, 0, stamBA, srcBA, fluid.u, fluid.v, dt)
  advect(W, H, 0, stamA, srcA, fluid.u, fluid.v, dt)
  advect(W, H, 0, stamW, srcW, fluid.u, fluid.v, dt)
  advect(W, H, 0, stamSO, srcSO, fluid.u, fluid.v, dt)

  // Recover R = R_premul / A and copy back to wet buffers
  for (let cy = by0; cy <= by1; cy++) {
    for (let cx = bx0; cx <= bx1; cx++) {
      const canvasIdx = cy * canvasW + cx
      const stamIdx = IX(W, cx + 1, cy + 1)
      const a = stamA[stamIdx]
      if (a > 0.5) {
        const invA = 1.0 / a
        // Clamp RGB to 0-255: prevents cumulative channel erosion
        wet.r[canvasIdx] = Math.min(255, Math.max(0, stamRA[stamIdx] * invA))
        wet.g[canvasIdx] = Math.min(255, Math.max(0, stamGA[stamIdx] * invA))
        wet.b[canvasIdx] = Math.min(255, Math.max(0, stamBA[stamIdx] * invA))
        // Recover strokeOpacity = premul / A, clamp to 0-1
        if (wet.strokeOpacity) {
          wet.strokeOpacity[canvasIdx] = Math.min(1, Math.max(0, stamSO[stamIdx] * invA))
        }
      }
      wet.alpha[canvasIdx] = Math.min(200000, Math.max(0, a))
      wet.wetness[canvasIdx] = Math.max(0, stamW[stamIdx])
    }
  }

  // --- Expand last-stroke bounds as paint spreads ---
  if (useLastOnly && lastStrokeBounds) {
    lastStrokeBounds.x0 = Math.max(0, lastStrokeBounds.x0 - 1)
    lastStrokeBounds.y0 = Math.max(0, lastStrokeBounds.y0 - 1)
    lastStrokeBounds.x1 = Math.min(canvasW - 1, lastStrokeBounds.x1 + 1)
    lastStrokeBounds.y1 = Math.min(canvasH - 1, lastStrokeBounds.y1 + 1)
  }
}

/**
 * Local fluid physics step -- runs Stam solver on a subgrid for local physics mode.
 * Allocates small Stam grids sized to the bounding box, copies wet data in,
 * runs velStep + advect, copies results back.
 * Per D-05: same fluid parameters, scoped to stroke bbox + margin.
 *
 * @param wet - Wet paint buffers (canvas-sized)
 * @param config - Fluid solver parameters (same as global)
 * @param canvasW - Full canvas width
 * @param canvasH - Full canvas height
 * @param bbox - Bounding box { x0, y0, x1, y1 } in canvas coordinates (already includes margin)
 * @param ticks - Number of physics ticks to run
 */
export function localFluidPhysicsStep(
  wet: WetBuffers,
  config: FluidConfig,
  canvasW: number,
  canvasH: number,
  bbox: { x0: number; y0: number; x1: number; y1: number },
  ticks: number,
): void {
  // Clamp bbox to canvas bounds
  const x0 = Math.max(0, bbox.x0)
  const y0 = Math.max(0, bbox.y0)
  const x1 = Math.min(canvasW - 1, bbox.x1)
  const y1 = Math.min(canvasH - 1, bbox.y1)

  const localW = x1 - x0 + 1
  const localH = y1 - y0 + 1
  if (localW < 3 || localH < 3) return  // Too small for solver

  const dt = 0.016
  const iterations = 4
  const gridSize = (localW + 2) * (localH + 2)

  // Allocate local Stam grids
  const u = new Float32Array(gridSize)
  const v = new Float32Array(gridSize)
  const u0 = new Float32Array(gridSize)
  const v0 = new Float32Array(gridSize)
  const p = new Float32Array(gridSize)
  const div = new Float32Array(gridSize)

  // Copy wet.alpha into local waterHeight for height equalization
  const waterHeight = new Float32Array(gridSize)
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const localI = IX(localW, cx - x0 + 1, cy - y0 + 1)
      waterHeight[localI] = wet.alpha[cy * canvasW + cx]
    }
  }

  // Build local wet mask for edge darkening
  const wetMask = new Float32Array(gridSize)
  const blurMask = new Float32Array(gridSize)
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      wetMask[IX(localW, cx - x0 + 1, cy - y0 + 1)] = wet.alpha[cy * canvasW + cx] > 20 ? 1.0 : 0.0
    }
  }
  boxBlur3x3(localW, localH, wetMask, blurMask, 3)

  for (let tick = 0; tick < ticks; tick++) {
    // Clear velocity sources
    u0.fill(0)
    v0.fill(0)

    // Update waterHeight from current wet state (for subsequent ticks)
    if (tick > 0) {
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          waterHeight[IX(localW, cx - x0 + 1, cy - y0 + 1)] = wet.alpha[cy * canvasW + cx]
        }
      }
    }

    // Height equalization on local grid
    addHeightEqualization(localW, localH, u0, v0, waterHeight, config.omega_h)

    // Edge darkening on local grid
    darkenEdges(localW, localH, wetMask, blurMask, u0, v0, config.darkening)

    // Velocity step
    velStep(localW, localH, u, v, u0, v0, config.viscosity, dt, iterations)

    // Advect wet channels (premultiplied alpha approach, same as fluidPhysicsStep)
    const stamRA = new Float32Array(gridSize)
    const stamGA = new Float32Array(gridSize)
    const stamBA = new Float32Array(gridSize)
    const stamA = new Float32Array(gridSize)
    const stamW = new Float32Array(gridSize)
    const stamSO = new Float32Array(gridSize)
    const srcRA = new Float32Array(gridSize)
    const srcGA = new Float32Array(gridSize)
    const srcBA = new Float32Array(gridSize)
    const srcA = new Float32Array(gridSize)
    const srcW = new Float32Array(gridSize)
    const srcSO = new Float32Array(gridSize)

    // Copy canvas wet data to local Stam grids with premultiplication
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const canvasIdx = cy * canvasW + cx
        const stamIdx = IX(localW, cx - x0 + 1, cy - y0 + 1)
        const a = wet.alpha[canvasIdx]
        stamRA[stamIdx] = wet.r[canvasIdx] * a
        stamGA[stamIdx] = wet.g[canvasIdx] * a
        stamBA[stamIdx] = wet.b[canvasIdx] * a
        stamA[stamIdx] = a
        stamW[stamIdx] = wet.wetness[canvasIdx]
        stamSO[stamIdx] = (wet.strokeOpacity ? wet.strokeOpacity[canvasIdx] : 1.0) * a
      }
    }

    srcRA.set(stamRA); srcGA.set(stamGA); srcBA.set(stamBA)
    srcA.set(stamA); srcW.set(stamW); srcSO.set(stamSO)

    advect(localW, localH, 0, stamRA, srcRA, u, v, dt)
    advect(localW, localH, 0, stamGA, srcGA, u, v, dt)
    advect(localW, localH, 0, stamBA, srcBA, u, v, dt)
    advect(localW, localH, 0, stamA, srcA, u, v, dt)
    advect(localW, localH, 0, stamW, srcW, u, v, dt)
    advect(localW, localH, 0, stamSO, srcSO, u, v, dt)

    // Write back to canvas wet buffers (recover R = R_premul / A)
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const canvasIdx = cy * canvasW + cx
        const stamIdx = IX(localW, cx - x0 + 1, cy - y0 + 1)
        const a = stamA[stamIdx]
        if (a > 0.5) {
          const invA = 1.0 / a
          wet.r[canvasIdx] = Math.min(255, Math.max(0, stamRA[stamIdx] * invA))
          wet.g[canvasIdx] = Math.min(255, Math.max(0, stamGA[stamIdx] * invA))
          wet.b[canvasIdx] = Math.min(255, Math.max(0, stamBA[stamIdx] * invA))
          if (wet.strokeOpacity) {
            wet.strokeOpacity[canvasIdx] = Math.min(1, Math.max(0, stamSO[stamIdx] * invA))
          }
        }
        wet.alpha[canvasIdx] = Math.min(200000, Math.max(0, a))
        wet.wetness[canvasIdx] = Math.max(0, stamW[stamIdx])
      }
    }
  }
}
