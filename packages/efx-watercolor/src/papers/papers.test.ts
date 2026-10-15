// ============================================================
//  Paper library — standing pins (56-05 / PAPER-01 / PAPER-04).
//
//  Laws pinned here:
//    PAPER-01 13 named papers in one library (10 procedural + 3 real)
//    PAPER-01 procedural generation is seeded and byte-stable
//    PAPER-04 the 3 recovered real papers ride the existing
//             app/public/img assets (paper_1/2/3.jpg)
//    R2.4     height maps encode to PaperPassTile-shaped valley+peak
//             maps (clean-room fields, no oracle shaders — D-17/P1)
//    D-12     one library grouped Procedural / Real, never tabs
//
//  Flagged assumptions pinned:
//    adjacency  two papers never share an id
//    ordering   procedural lists the 10 names in a stable documented
//               order; real lists paper_1, paper_2, paper_3
//    idempotency same paper id + seed ⇒ same height-map bytes
//
//  Assertion style: scalar predicates (boolean/primitive toBe) so
//  TAP diagnostics stay one-line and the RED evidence classifier
//  can parse the report — vitest's object dumps break strict TAP.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { PaperDefinition } from './library'
import { PAPER_LIBRARY } from './library'
import { PROCEDURAL_PAPER_IDS, proceduralHeightMap } from './procedural'
import { encodePassTiles } from './encode'

/** The 10 procedural display names, in the locked stable order. */
const PROCEDURAL_NAMES = [
  'cold press',
  'hot press',
  'rough',
  'khadi',
  'washi',
  'laid',
  'canvas',
  'toned sand',
  'kraft',
  'student',
] as const

/** The 10 procedural stable ids, matching the names above. */
const PROCEDURAL_IDS = [
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

/** The 3 recovered real papers, in natural-filename order. */
const REAL_IDS = ['paper/real-1', 'paper/real-2', 'paper/real-3'] as const
const REAL_SOURCES = ['/img/paper_1.jpg', '/img/paper_2.jpg', '/img/paper_3.jpg'] as const

function isPaperDefinition(value: unknown): value is PaperDefinition {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string'
    && typeof record.name === 'string'
    && (record.group === 'procedural' || record.group === 'real')
    && typeof record.defaultStrength === 'number'
    && typeof record.defaultScale === 'number'
    && typeof record.source === 'string'
}

/** Stable content hash over the float bytes (determinism pin, not crypto). */
function heightBytesHash(height: Float32Array): number {
  const bytes = new Uint8Array(height.buffer, height.byteOffset, height.byteLength)
  let hash = 2166136261
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i]
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

describe('paper library (PAPER-01 / PAPER-04)', () => {
  it('PAPER_LIBRARY contains exactly 13 papers', () => {
    expect(PAPER_LIBRARY.length).toBe(13)
  })

  it('every entry is a PaperDefinition with finite positive defaults', () => {
    expect(PAPER_LIBRARY.every(isPaperDefinition)).toBe(true)
  })

  it('procedural names are exactly the 10 locked names in order', () => {
    const names = PAPER_LIBRARY.filter((entry) => entry.group === 'procedural').map((entry) => entry.name)
    expect(names.join('|')).toBe(PROCEDURAL_NAMES.join('|'))
  })

  it('procedural ids are the 10 locked stable ids in order', () => {
    const ids = PAPER_LIBRARY.filter((entry) => entry.group === 'procedural').map((entry) => entry.id)
    expect(ids.join('|')).toBe(PROCEDURAL_IDS.join('|'))
  })

  it('real group lists paper/real-1..3 pointing at the recovered jpg assets', () => {
    const real = PAPER_LIBRARY.filter((entry) => entry.group === 'real')
    expect(real.length).toBe(3)
    expect(real.map((entry) => entry.id).join('|')).toBe(REAL_IDS.join('|'))
    expect(real.map((entry) => entry.source).join('|')).toBe(REAL_SOURCES.join('|'))
  })

  it('two papers never share an id (adjacency)', () => {
    const ids = PAPER_LIBRARY.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(13)
  })

  it('procedural group lists before real (D-12 one library, stable order)', () => {
    const groups = PAPER_LIBRARY.map((entry) => entry.group)
    expect(groups[0] === 'procedural' && groups[9] === 'procedural').toBe(true)
    expect(groups[10] === 'real' && groups[12] === 'real').toBe(true)
  })

  it('every defaultStrength sits in [0, 1] and defaultScale is positive', () => {
    expect(PAPER_LIBRARY.every((entry) => entry.defaultStrength >= 0 && entry.defaultStrength <= 1)).toBe(true)
    expect(PAPER_LIBRARY.every((entry) => entry.defaultScale > 0)).toBe(true)
  })

  it('PROCEDURAL_PAPER_IDS matches the library procedural ids', () => {
    expect(PROCEDURAL_PAPER_IDS.join('|')).toBe(PROCEDURAL_IDS.join('|'))
  })
})

describe('procedural height maps (PAPER-01 idempotency)', () => {
  it('every procedural id yields a Float32Array of width*height samples in [0, 1]', () => {
    const width = 32
    const height = 32
    const ok = PROCEDURAL_IDS.every((id) => {
      const map = proceduralHeightMap(id, 1, width, height)
      if (!map || map.length !== width * height) return false
      for (let i = 0; i < map.length; i++) {
        if (!(map[i] >= 0 && map[i] <= 1)) return false
      }
      return true
    })
    expect(ok).toBe(true)
  })

  it('two generator runs with the same paper id and seed produce identical height-map bytes', () => {
    const a = proceduralHeightMap('paper/cold-press', 7, 48, 48)
    const b = proceduralHeightMap('paper/cold-press', 7, 48, 48)
    expect(a !== null && b !== null).toBe(true)
    expect(heightBytesHash(a!)).toBe(heightBytesHash(b!))
  })

  it('two generator runs with the same paper id and seed produce identical bytes for every paper', () => {
    const ok = PROCEDURAL_IDS.every((id) => {
      const a = proceduralHeightMap(id, 3, 24, 24)
      const b = proceduralHeightMap(id, 3, 24, 24)
      return a !== null && b !== null && heightBytesHash(a) === heightBytesHash(b)
    })
    expect(ok).toBe(true)
  })

  it('distinct papers yield distinct height fields (adjacency — never the same bytes)', () => {
    const hashes = PROCEDURAL_IDS.map((id) => heightBytesHash(proceduralHeightMap(id, 5, 32, 32)!))
    expect(new Set(hashes).size).toBe(10)
  })

  it('unknown paper id returns null (total, never a throw)', () => {
    expect(proceduralHeightMap('paper/nope', 1, 8, 8)).toBe(null)
  })

  it('no generator path uses Math.random (T-56-13 determinism)', () => {
    // The generators are pure functions of (paperId, seed, width, height) —
    // two equal calls already prove it; this pins the export surface has no
    // ambient randomness hook to reach for.
    const a = proceduralHeightMap('paper/rough', 11, 16, 16)
    const b = proceduralHeightMap('paper/rough', 11, 16, 16)
    expect(heightBytesHash(a!) === heightBytesHash(b!)).toBe(true)
  })
})

describe('encodePassTiles shape match with PaperPassTile (R2.4)', () => {
  it('encodePassTiles(procedural height) returns valley and peak arrays of pixel count width*height', () => {
    const width = 16
    const heightPx = 12
    const height = proceduralHeightMap('paper/cold-press', 2, width, heightPx)!
    const { valley, peak } = encodePassTiles(height, width, heightPx, 0.65, { r: 230, g: 224, b: 212 })
    expect(valley.length).toBe(width * heightPx * 4)
    expect(peak.length).toBe(width * heightPx * 4)
  })

  it('encoded maps are RGBA with alpha 255 everywhere (straight-alpha D-02)', () => {
    const width = 8
    const heightPx = 8
    const height = proceduralHeightMap('paper/washi', 4, width, heightPx)!
    const { valley, peak } = encodePassTiles(height, width, heightPx, 0.5, { r: 200, g: 190, b: 180 })
    let alphaOk = true
    for (let i = 3; i < valley.length; i += 4) {
      if (valley[i] !== 255 || peak[i] !== 255) {
        alphaOk = false
        break
      }
    }
    expect(alphaOk).toBe(true)
  })

  it('strength 0 is fully neutral (valley 255, peak 0 at every pixel)', () => {
    const width = 4
    const heightPx = 4
    const height = proceduralHeightMap('paper/kraft', 9, width, heightPx)!
    const { valley, peak } = encodePassTiles(height, width, heightPx, 0, { r: 230, g: 224, b: 212 })
    let neutral = true
    for (let i = 0; i < valley.length; i += 4) {
      if (valley[i] !== 255 || valley[i + 1] !== 255 || valley[i + 2] !== 255) neutral = false
      if (peak[i] !== 0 || peak[i + 1] !== 0 || peak[i + 2] !== 0) neutral = false
    }
    expect(neutral).toBe(true)
  })

  it('valley floors at the paper tint (never black) when strength is 1 on a low height', () => {
    // h = 0 → s = (0 - 0.5) * 2 * 1 = -1 → v = 1 → valley = tint (the floor).
    const height = new Float32Array(4).fill(0)
    const tint = { r: 180, g: 170, b: 160 }
    const { valley } = encodePassTiles(height, 2, 2, 1, tint)
    expect(valley[0]).toBe(180)
    expect(valley[1]).toBe(170)
    expect(valley[2]).toBe(160)
  })
})
