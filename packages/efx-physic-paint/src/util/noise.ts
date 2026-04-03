// ============================================================
//  Noise — Deterministic hash-based value noise + FBM
//  Extracted from efx-paint-physic-v3.html lines 365-394
//  Required for deterministic replay: no Math.random() in noise path
// ============================================================

/** Dot product of two 2D vectors */
function _dot(x1: number, y1: number, x2: number, y2: number): number {
  return x1 * x2 + y1 * y2
}

/** Fractional part of a number */
function _fract(x: number): number {
  return x - Math.floor(x)
}

/** Deterministic pseudo-random value from 2D coordinates */
function _rand(x: number, y: number): number {
  return _fract(Math.sin(_dot(x, y, 12.9898, 4.1414)) * 43758.5453)
}

/**
 * Value noise with hermite interpolation.
 * Returns squared value in [0,1] range.
 * From v3.html noise(px, py) — lines 370-378
 */
export function noise(px: number, py: number): number {
  const ix = Math.floor(px)
  const iy = Math.floor(py)
  let ux = px - ix
  let uy = py - iy

  // Hermite smoothstep
  ux = ux * ux * (3.0 - 2.0 * ux)
  uy = uy * uy * (3.0 - 2.0 * uy)

  const a = _rand(ix, iy)
  const b = _rand(ix + 1, iy)
  const c = _rand(ix, iy + 1)
  const d = _rand(ix + 1, iy + 1)

  const res = a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
  return res * res
}

/**
 * Fractional Brownian Motion — layered noise with rotation between octaves.
 * Returns value in [0,1] range.
 * From v3.html fbm(x, y, octaves) — lines 380-394
 *
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param octaves - Number of noise layers (default 3)
 */
export function fbm(x: number, y: number, octaves: number = 3): number {
  let v = 0.0
  let a = 0.5
  const shiftX = 100
  const shiftY = 100
  const cosR = Math.cos(0.5)
  const sinR = Math.sin(0.5)

  for (let i = 0; i < octaves; i++) {
    v += a * noise(x, y)
    const nx = cosR * x + sinR * y
    const ny = -sinR * x + cosR * y
    x = nx * 2.0 + shiftX
    y = ny * 2.0 + shiftY
    a *= 0.5
  }

  return v
}
