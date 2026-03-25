/**
 * 2D flow field system for organic stroke distortion.
 *
 * Creates a grid of angles (radians) using 2D hash-based noise,
 * then displaces stroke stamp positions along those angles for
 * natural, non-mechanical brush paths.
 *
 * Used by brushFxRenderer.ts when a stroke's fieldStrength > 0.
 */

// ---------------------------------------------------------------------------
// Flow field data structure
// ---------------------------------------------------------------------------

export interface FlowField {
  grid: Float32Array;  // angles in radians
  cols: number;
  rows: number;
  cellSize: number;
}

// ---------------------------------------------------------------------------
// 2D noise (hash-based, deterministic)
// ---------------------------------------------------------------------------

function hash2D(x: number, y: number): number {
  // Simple integer hash for deterministic noise
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h & 0x7fffffff) / 0x7fffffff; // 0-1
}

function noise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  // Smoothstep interpolation
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  // Four corners
  const a = hash2D(ix, iy);
  const b = hash2D(ix + 1, iy);
  const c = hash2D(ix, iy + 1);
  const d = hash2D(ix + 1, iy + 1);
  // Bilinear interpolation with smoothstep
  return a * (1 - sx) * (1 - sy) + b * sx * (1 - sy) + c * (1 - sx) * sy + d * sx * sy;
}

// ---------------------------------------------------------------------------
// Flow field creation
// ---------------------------------------------------------------------------

/**
 * Create a flow field grid covering the given pixel dimensions.
 * Each cell stores an angle in radians derived from 2D noise.
 *
 * @param width  - Canvas width in pixels
 * @param height - Canvas height in pixels
 * @param cellSize - Grid cell size in pixels (default 20)
 */
export function createFlowField(width: number, height: number, cellSize = 20): FlowField {
  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  const grid = new Float32Array(cols * rows);

  // Scale factor for gentle, large-scale flow patterns
  const noiseScale = 0.08;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      grid[y * cols + x] = noise2D(x * noiseScale, y * noiseScale) * Math.PI * 2;
    }
  }

  return {grid, cols, rows, cellSize};
}

// ---------------------------------------------------------------------------
// Field sampling
// ---------------------------------------------------------------------------

/**
 * Sample the flow field angle at a given pixel position.
 * Returns the angle (radians) of the nearest grid cell.
 */
export function sampleField(field: FlowField, x: number, y: number): number {
  const col = Math.min(Math.floor(x / field.cellSize), field.cols - 1);
  const row = Math.min(Math.floor(y / field.cellSize), field.rows - 1);
  return field.grid[Math.max(0, row) * field.cols + Math.max(0, col)];
}

// ---------------------------------------------------------------------------
// Flow field application
// ---------------------------------------------------------------------------

/**
 * Displace each point along the flow field direction.
 * Displacement magnitude is `strength * cellSize * 0.5` pixels.
 *
 * @param points   - Array of {x, y} positions to displace
 * @param field    - The flow field to sample
 * @param strength - 0-1 influence strength (from BrushFxParams.fieldStrength)
 */
export function applyFlowField(
  points: Array<{x: number; y: number}>,
  field: FlowField,
  strength: number,
): Array<{x: number; y: number}> {
  return points.map((p) => {
    const angle = sampleField(field, p.x, p.y);
    const displacement = strength * field.cellSize * 0.5;
    return {
      x: p.x + Math.cos(angle) * displacement,
      y: p.y + Math.sin(angle) * displacement,
    };
  });
}

// ---------------------------------------------------------------------------
// Cached flow field (module-level singleton)
// ---------------------------------------------------------------------------

let _cachedField: FlowField | null = null;
let _cachedW = 0;
let _cachedH = 0;

/**
 * Get a flow field for the given dimensions, with caching.
 * Regenerates only when dimensions change.
 */
export function getFlowField(w: number, h: number): FlowField {
  if (_cachedField && _cachedW === w && _cachedH === h) return _cachedField;
  _cachedField = createFlowField(w, h);
  _cachedW = w;
  _cachedH = h;
  return _cachedField;
}
