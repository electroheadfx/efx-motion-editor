/**
 * Tyler Hobbs watercolor polygon deformation (simplified).
 *
 * Implements midpoint displacement to produce organic, bleed-like edges on
 * stroke outlines.  Each stroke is rendered as 5-10 semi-transparent
 * overlapping polygon layers (per D-11) with deterministic seeded RNG
 * for export parity (per D-12).
 *
 * The pipeline:
 *  1. Convert perfect-freehand outline to Point[] polygon
 *  2. Apply 7 base deformation passes with decreasing variance
 *  3. Generate N layer variations with 4 additional deformation passes each
 *  4. Fan-triangulate each layer for GL_TRIANGLES rendering
 */

// ---------------------------------------------------------------------------
// Point type
// ---------------------------------------------------------------------------

interface Point {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32)
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Gaussian random generators
// ---------------------------------------------------------------------------

/**
 * Non-seeded Gaussian random (Box-Muller transform).
 * Returns a value with mean 0, standard deviation 1.
 */
export function gaussianRandom(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Seeded Gaussian random generator for deterministic output (D-12: export parity).
 * Uses mulberry32 PRNG internally.
 */
export function seedableGaussian(seed: number): () => number {
  const rng = mulberry32(seed);
  return () => {
    const u1 = rng() || 0.0001;
    const u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
}

// ---------------------------------------------------------------------------
// Polygon deformation
// ---------------------------------------------------------------------------

/**
 * Midpoint displacement deformation.
 * For each edge A->B, inserts a displaced midpoint between them:
 *   midX = (A.x + B.x)/2 + rng() * variance
 *   midY = (A.y + B.y)/2 + rng() * variance
 *
 * This doubles the vertex count per pass, producing increasingly organic edges.
 */
export function deformPolygon(
  vertices: Point[],
  variance: number,
  rng: () => number,
): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    result.push(a);
    const mx = (a.x + b.x) / 2 + rng() * variance;
    const my = (a.y + b.y) / 2 + rng() * variance;
    result.push({x: mx, y: my});
  }
  return result;
}

// ---------------------------------------------------------------------------
// Outline conversion
// ---------------------------------------------------------------------------

/**
 * Convert perfect-freehand outline (closed polygon of [x,y] pairs) to Point[].
 */
function outlineToPolygon(outline: [number, number][]): Point[] {
  return outline.map(([x, y]) => ({x, y}));
}

// ---------------------------------------------------------------------------
// Watercolor layer generation
// ---------------------------------------------------------------------------

/**
 * Generate deformed polygon layers for watercolor rendering.
 *
 * 1. Converts outline to polygon
 * 2. Creates a seeded RNG from the seed
 * 3. Applies 7 base deformation passes with decreasing variance: 2.0/(i+1)
 * 4. Generates layerCount independent layer variations (4 additional passes each)
 * 5. Returns array of deformed polygons, one per layer
 *
 * @param outline - Perfect-freehand outline points (closed polygon)
 * @param seed - Deterministic seed for reproducible output
 * @param layerCount - Number of layers (default 7, range 5-10 per D-11)
 * @returns Array of deformed polygons, one per layer
 */
export function renderWatercolorLayers(
  outline: [number, number][],
  seed: number,
  layerCount: number = 7,
): Point[][] {
  const rng = seedableGaussian(seed);
  let base = outlineToPolygon(outline);

  // 7 base deformation passes with decreasing variance
  for (let i = 0; i < 7; i++) {
    base = deformPolygon(base, 2.0 / (i + 1), rng);
  }

  // Generate layers with additional deformation
  const layers: Point[][] = [];
  for (let l = 0; l < layerCount; l++) {
    let layer = [...base.map((p) => ({...p}))];
    for (let i = 0; i < 4; i++) {
      layer = deformPolygon(layer, 1.0 / (i + 1), rng);
    }
    layers.push(layer);
  }
  return layers;
}

// ---------------------------------------------------------------------------
// Triangulation for GL rendering
// ---------------------------------------------------------------------------

/**
 * Fan triangulation of a polygon around a center point.
 * Produces a flat Float32Array of (x,y) pairs suitable for GL_TRIANGLES.
 */
export function polygonToTriangles(polygon: Point[], center: Point): Float32Array {
  const tris: number[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    tris.push(center.x, center.y, a.x, a.y, b.x, b.y);
  }
  return new Float32Array(tris);
}

/**
 * Compute the centroid (average) of a polygon.
 */
export function polygonCenter(polygon: Point[]): Point {
  let sx = 0;
  let sy = 0;
  for (const p of polygon) {
    sx += p.x;
    sy += p.y;
  }
  return {x: sx / polygon.length, y: sy / polygon.length};
}
