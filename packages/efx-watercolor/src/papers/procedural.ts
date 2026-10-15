// ============================================================
//  Procedural papers — clean-room height / mottle / fleck fields
//  (56-05 / PAPER-01 / R2.4 / D-17 / T-56-13).
//
//  Published procedural method only: seeded tileable value-noise
//  fBm + mottle + fleck composition. No code copied or transliterated
//  from the oracle watercolor-playground / inkwash shaders (P1).
//
//  Determinism law: every draw keys off seededRng(strokeSeed, streamKey)
//  from @efxlab/efx-paint-host (D-20 / 55 D-25). Same (paperId, seed,
//  width, height) ⇒ same Float32Array bytes. No Math.random().
//
//  Height samples are in [0, 1], one per pixel, width*height length —
//  the exact input contract of encodePassTiles / PaperPassTile.
// ============================================================

import { seededRng } from '@efxlab/efx-paint-host'

export const PROCEDURAL_PAPER_IDS = [
  'paper/cold-press',
  'paper/hot-press',
  'paper/rough',
  'paper/khadi',
  'paper/washi',
  'paper/laid',
  'paper/canvas',
  'paper/toned-sand',
  'paper/kraft',
  'paper/student',
] as const

export type ProceduralPaperId = (typeof PROCEDURAL_PAPER_IDS)[number]

/** Natural tile resolution of a generated height map. */
export const PROCEDURAL_TILE_SIZE = 256

/**
 * Per-paper field recipe. The knobs shape one clean-room process
 * (tileable fBm tooth + low-frequency mottle + sparse flecks) — the
 * slider-bottom law's cousin: finer papers take a higher frequency and
 * a shallower amplitude on the SAME process, never a different look.
 */
interface PaperFieldRecipe {
  /** Tooth fBm base frequency (cycles across the tile). */
  readonly toothFrequency: number
  /** Tooth fBm octaves. */
  readonly toothOctaves: number
  /** Tooth amplitude around the 0.5 midline. */
  readonly toothAmplitude: number
  /** Low-frequency mottle amplitude. */
  readonly mottleAmplitude: number
  /** Mottle frequency. */
  readonly mottleFrequency: number
  /** Sparse fleck amplitude (signed). */
  readonly fleckAmplitude: number
  /** Fleck density in [0, 1] — fraction of pixels that carry a fleck. */
  readonly fleckDensity: number
  /** Optional directional streak weight (washi / laid fiber). */
  readonly streakAmplitude: number
  /** Streak frequency along the laid axis. */
  readonly streakFrequency: number
}

const FIELD_RECIPES: Record<ProceduralPaperId, PaperFieldRecipe> = {
  'paper/cold-press': {
    toothFrequency: 14, toothOctaves: 4, toothAmplitude: 0.22,
    mottleAmplitude: 0.08, mottleFrequency: 3,
    fleckAmplitude: 0.10, fleckDensity: 0.02,
    streakAmplitude: 0, streakFrequency: 1,
  },
  'paper/hot-press': {
    toothFrequency: 28, toothOctaves: 3, toothAmplitude: 0.10,
    mottleAmplitude: 0.03, mottleFrequency: 2,
    fleckAmplitude: 0.04, fleckDensity: 0.008,
    streakAmplitude: 0, streakFrequency: 1,
  },
  'paper/rough': {
    toothFrequency: 9, toothOctaves: 5, toothAmplitude: 0.32,
    mottleAmplitude: 0.12, mottleFrequency: 2.5,
    fleckAmplitude: 0.16, fleckDensity: 0.045,
    streakAmplitude: 0, streakFrequency: 1,
  },
  'paper/khadi': {
    toothFrequency: 11, toothOctaves: 4, toothAmplitude: 0.26,
    mottleAmplitude: 0.14, mottleFrequency: 1.8,
    fleckAmplitude: 0.12, fleckDensity: 0.03,
    streakAmplitude: 0.06, streakFrequency: 6,
  },
  'paper/washi': {
    toothFrequency: 16, toothOctaves: 3, toothAmplitude: 0.14,
    mottleAmplitude: 0.07, mottleFrequency: 2,
    fleckAmplitude: 0.05, fleckDensity: 0.012,
    streakAmplitude: 0.12, streakFrequency: 18,
  },
  'paper/laid': {
    toothFrequency: 22, toothOctaves: 3, toothAmplitude: 0.12,
    mottleAmplitude: 0.05, mottleFrequency: 2,
    fleckAmplitude: 0.04, fleckDensity: 0.01,
    streakAmplitude: 0.16, streakFrequency: 32,
  },
  'paper/canvas': {
    toothFrequency: 12, toothOctaves: 3, toothAmplitude: 0.20,
    mottleAmplitude: 0.05, mottleFrequency: 2,
    fleckAmplitude: 0.06, fleckDensity: 0.015,
    streakAmplitude: 0.10, streakFrequency: 12,
  },
  'paper/toned-sand': {
    toothFrequency: 20, toothOctaves: 4, toothAmplitude: 0.16,
    mottleAmplitude: 0.10, mottleFrequency: 2.2,
    fleckAmplitude: 0.09, fleckDensity: 0.025,
    streakAmplitude: 0, streakFrequency: 1,
  },
  'paper/kraft': {
    toothFrequency: 13, toothOctaves: 4, toothAmplitude: 0.24,
    mottleAmplitude: 0.11, mottleFrequency: 2,
    fleckAmplitude: 0.14, fleckDensity: 0.04,
    streakAmplitude: 0.05, streakFrequency: 8,
  },
  'paper/student': {
    toothFrequency: 18, toothOctaves: 3, toothAmplitude: 0.18,
    mottleAmplitude: 0.06, mottleFrequency: 2.5,
    fleckAmplitude: 0.05, fleckDensity: 0.012,
    streakAmplitude: 0, streakFrequency: 1,
  },
}

function isProceduralPaperId(paperId: string): paperId is ProceduralPaperId {
  return Object.prototype.hasOwnProperty.call(FIELD_RECIPES, paperId)
}

/** Smoothstep hermite — matches the value-noise interpolation idiom. */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

/**
 * Tileable value-noise lattice. One rng stream per lattice so a paper's
 * tooth, mottle, and fleck never land on each other's pattern (D-20
 * stream-key separation). The lattice wraps modulo `period` so the
 * generated tile is seamless under repeat.
 */
function tileLattice(seed: number, streamKey: string, period: number): Float32Array {
  const rng = seededRng(seed, streamKey)
  const lattice = new Float32Array(period * period)
  for (let i = 0; i < lattice.length; i++) lattice[i] = rng()
  return lattice
}

function sampleLattice(lattice: Float32Array, period: number, x: number, y: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const x0 = ((xi % period) + period) % period
  const y0 = ((yi % period) + period) % period
  const x1 = (x0 + 1) % period
  const y1 = (y0 + 1) % period
  const a = lattice[y0 * period + x0]
  const b = lattice[y0 * period + x1]
  const c = lattice[y1 * period + x0]
  const d = lattice[y1 * period + x1]
  const u = smoothstep(xf)
  const v = smoothstep(yf)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

/** Tileable fBm over the lattice — layered octaves, period doubles each layer. */
function tileFbm(
  lattices: readonly Float32Array[],
  basePeriod: number,
  x: number,
  y: number,
  octaves: number,
): number {
  let value = 0
  let amplitude = 0.5
  let period = basePeriod
  let nx = x
  let ny = y
  for (let octave = 0; octave < octaves; octave++) {
    const lattice = lattices[Math.min(octave, lattices.length - 1)]
    value += amplitude * sampleLattice(lattice, period, nx, ny)
    nx *= 2
    ny *= 2
    period *= 2
    amplitude *= 0.5
  }
  // Normalize the amplitude sum so the result stays in [0, 1].
  const total = 1 - Math.pow(0.5, octaves)
  return total > 0 ? value / total : 0
}

/**
 * Deterministic height map for a procedural paper.
 * Same (paperId, seed, width, height) ⇒ same bytes (T-56-13).
 * Unknown id → null (total, never a throw).
 */
export function proceduralHeightMap(
  paperId: string,
  seed: number,
  width = PROCEDURAL_TILE_SIZE,
  height = PROCEDURAL_TILE_SIZE,
): Float32Array | null {
  if (!isProceduralPaperId(paperId)) return null
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return null
  if (!Number.isFinite(seed)) return null
  const recipe = FIELD_RECIPES[paperId]
  // Integer lattice period keeps the tile seamless: the noise domain repeats
  // every `period` samples, and the map is generated over exactly one period.
  const period = Math.max(4, Math.round(recipe.toothFrequency))
  const mottlePeriod = Math.max(2, Math.round(recipe.mottleFrequency))

  const toothLattices: Float32Array[] = []
  for (let o = 0; o < Math.max(1, recipe.toothOctaves); o++) {
    toothLattices.push(tileLattice(seed, `${paperId}|tooth|${o}`, period << o))
  }
  const mottleLattice = tileLattice(seed, `${paperId}|mottle`, mottlePeriod)
  const streakLattice = tileLattice(seed, `${paperId}|streak`, Math.max(2, Math.round(recipe.streakFrequency)))
  const fleckRng = seededRng(seed, `${paperId}|fleck`)

  const out = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = (x / width) * period
      const v = (y / height) * period
      const tooth = tileFbm(toothLattices, period, u, v, recipe.toothOctaves)
      const mottle = sampleLattice(
        mottleLattice,
        mottlePeriod,
        (x / width) * mottlePeriod,
        (y / height) * mottlePeriod,
      )
      const streak = recipe.streakAmplitude !== 0
        ? sampleLattice(
          streakLattice,
          Math.max(2, Math.round(recipe.streakFrequency)),
          (x / width) * recipe.streakFrequency,
          (y / height) * recipe.streakFrequency * 0.15,
        )
        : 0.5
      // One fleck draw per pixel — deterministic sequence, density-gated.
      const fleck = fleckRng() < recipe.fleckDensity ? (fleckRng() * 2 - 1) * recipe.fleckAmplitude : 0

      const raw = 0.5
        + (tooth - 0.5) * recipe.toothAmplitude * 2
        + (mottle - 0.5) * recipe.mottleAmplitude * 2
        + (streak - 0.5) * recipe.streakAmplitude * 2
        + fleck
      out[y * width + x] = raw < 0 ? 0 : raw > 1 ? 1 : raw
    }
  }
  return out
}
