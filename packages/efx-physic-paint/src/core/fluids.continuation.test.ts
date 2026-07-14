import { describe, expect, it } from 'vitest'
import { createLocalFluidPhysicsContinuation, localFluidPhysicsStep } from './fluids'
import type { FluidConfig, WetBuffers } from '../types'

function createWet(width: number, height: number): WetBuffers {
  const size = width * height
  const wet: WetBuffers = {
    r: new Float32Array(size), g: new Float32Array(size), b: new Float32Array(size),
    alpha: new Float32Array(size), wetness: new Float32Array(size), strokeOpacity: new Float32Array(size),
  }
  for (let y = 2; y < height - 2; y++) for (let x = 2; x < width - 2; x++) {
    const i = y * width + x
    wet.r[i] = x * 7; wet.g[i] = y * 9; wet.b[i] = 80
    wet.alpha[i] = (x + y) * 10; wet.wetness[i] = 100; wet.strokeOpacity[i] = 0.75
  }
  return wet
}

function digest(wet: WetBuffers) {
  return [wet.r, wet.g, wet.b, wet.alpha, wet.wetness, wet.strokeOpacity].map(buffer => Array.from(buffer))
}

describe('local fluid continuation parity', () => {
  it('matches the synchronous wrapper after each ordered tick sequence', () => {
    const width = 12, height = 10
    const config: FluidConfig = { viscosity: 0.0001, omega_h: 0.06, darkening: 0.1 }
    const sync = createWet(width, height)
    const resumed = createWet(width, height)
    const bounds = { x0: 1, y0: 1, x1: 10, y1: 8 }

    localFluidPhysicsStep(sync, config, width, height, bounds, 3)
    const continuation = createLocalFluidPhysicsContinuation(resumed, config, width, height, bounds, 3)
    let turns = 0
    while (!continuation.step()) turns++

    expect(turns).toBe(3)
    expect(digest(resumed)).toEqual(digest(sync))
  })
})
