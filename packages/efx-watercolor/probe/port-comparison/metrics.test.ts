// Unit fixtures for the ONE metric library behind the 261119-pod
// acceptance numbers. Every measure is exercised on synthetic rasters
// whose expected values are known by construction, so the three
// acceptance blocks rest on arithmetic that was tested before any
// browser ran.
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  CORE_DARKNESS_MAX_DELTA_PCT,
  FADE_MIN_GAIN_PX,
  HUE_MIN_ANGLE_FRACTION,
  HUE_MIN_SHIFT_DEG,
  HUE_P0_CONTROL_MAX_DEG,
  STRAND_MIN_RATIO,
  acceptance,
  acrossGradientEnergy,
  alongVariance,
  bodyCoverage,
  buildMask,
  chromaOf,
  darknessOf,
  edgeHueStd,
  erodeMask,
  hueOf,
  hueStats,
  intersectMasks,
  lumaOf,
  maskArea,
  maskBounds,
  meanDarkness,
  measureScene,
  sha256Hex,
  sideFades,
  sideFadesAlpha,
  signedAngle,
  strokeHalfWidthPx,
  type Mask,
  type Rgba,
  type RunCapture,
  type SceneRecord,
} from './metrics'

/* -------------------------------------------------------- fixtures */

function rgba(w: number, h: number, fn: (x: number, y: number) => [number, number, number, number]): Rgba {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4
      const [r, g, b, a] = fn(x, y)
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = a
    }
  }
  return { width: w, height: h, data }
}

function solid(w: number, h: number, r: number, g: number, b: number, a = 255): Rgba {
  return rgba(w, h, () => [r, g, b, a])
}

function fullMask(w: number, h: number): Mask {
  return { width: w, height: h, data: new Uint8Array(w * h).fill(255) }
}

const PAPER: [number, number, number, number] = [246, 243, 236, 255]
const YELLOW: [number, number, number, number] = [232, 194, 26, 255]
const CORNFLOWER: [number, number, number, number] = [89, 148, 228, 255]

/* ---------------------------------------------------------- colour */

describe('colour primitives', () => {
  it('computes the six-segment hue and its nulls', () => {
    expect(hueOf(255, 0, 0)).toBe(0)
    expect(hueOf(255, 255, 0)).toBeCloseTo(60, 6)
    expect(hueOf(0, 255, 0)).toBeCloseTo(120, 6)
    expect(hueOf(0, 0, 255)).toBeCloseTo(240, 6)
    // Near-grey pixels fall below the chroma floor.
    expect(hueOf(128, 128, 128)).toBeNull()
    expect(hueOf(128, 128, 140)).toBeNull()
  })

  it('measures chroma, Rec.709 luma and film darkness', () => {
    expect(chromaOf(255, 0, 128)).toBeCloseTo(1, 6)
    expect(chromaOf(10, 20, 30)).toBeCloseTo(20 / 255, 6)
    expect(lumaOf(255, 255, 255)).toBeCloseTo(255, 4)
    expect(lumaOf(0, 0, 0)).toBe(0)
    expect(darknessOf(0, 0, 0)).toBeCloseTo(255, 6)
    expect(darknessOf(255, 255, 255)).toBeCloseTo(0, 6)
  })

  it('takes the shortest signed arc', () => {
    expect(signedAngle(350, 10)).toBeCloseTo(20, 6)
    expect(signedAngle(10, 350)).toBeCloseTo(-20, 6)
    expect(signedAngle(214, 49)).toBeCloseTo(-165, 6)
    expect(signedAngle(0, 180)).toBeCloseTo(180, 6)
    expect(signedAngle(90, 90)).toBe(0)
  })
})

describe('circular hue statistics', () => {
  it('averages hues across the wrap point and excludes grey', () => {
    const img = rgba(4, 1, (x) => {
      if (x === 0) return [255, 0, 42, 255] // hue ~350
      if (x === 1) return [255, 42, 0, 255] // hue ~10
      if (x === 2) return [255, 0, 42, 255]
      return [128, 128, 128, 255] // grey: below the chroma floor
    })
    const stats = hueStats(img)
    expect(stats.count).toBe(3)
    // Two units at ~350 deg and one at ~10 deg: the circular mean lands just
    // short of the wrap point, where a naive linear mean would read ~237 deg.
    const wrapped = Math.min(stats.meanDeg, 360 - stats.meanDeg)
    expect(wrapped).toBeLessThan(5)
    expect(stats.stdDeg).toBeGreaterThan(0)
  })

  it('reports NaN when no pixel clears the chroma floor', () => {
    const stats = hueStats(solid(4, 4, 128, 128, 128))
    expect(stats.count).toBe(0)
    expect(Number.isNaN(stats.meanDeg)).toBe(true)
  })

  it('restricts the aggregate to the mask', () => {
    const img = rgba(4, 1, (x) => (x < 2 ? [0, 0, 255, 255] : [255, 255, 0, 255]))
    const mask: Mask = { width: 4, height: 1, data: new Uint8Array([255, 255, 0, 0]) }
    const stats = hueStats(img, mask)
    expect(stats.count).toBe(2)
    expect(stats.meanDeg).toBeCloseTo(240, 6)
    expect(stats.stdDeg).toBeCloseTo(0, 6)
  })
})

/* ----------------------------------------------------------- masks */

describe('masks', () => {
  it('marks pixels whose RGB moved past the threshold', () => {
    const before = solid(3, 3, 100, 100, 100)
    const after = solid(3, 3, 100, 100, 100)
    after.data[(1 * 3 + 1) * 4] = 110 // +10 red on the centre pixel
    after.data[(2 * 3 + 2) * 4] = 104 // +4 on a corner: below threshold
    const mask = buildMask(after, before)
    expect(maskArea(mask)).toBe(1)
    expect(mask.data[4]).toBe(255)
    expect(mask.data[8]).toBe(0)
  })

  it('rejects mismatched dimensions', () => {
    expect(() => buildMask(solid(2, 2, 0, 0, 0), solid(3, 2, 0, 0, 0))).toThrow()
  })

  it('erodes a 7x7 block to its 3x3 core and empties a lone pixel', () => {
    const mask = fullMask(7, 7)
    const core = erodeMask(mask, 2)
    expect(maskArea(core)).toBe(9)
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        const expected = x >= 2 && x <= 4 && y >= 2 && y <= 4 ? 255 : 0
        expect(core.data[y * 7 + x]).toBe(expected)
      }
    }
    const lone: Mask = { width: 7, height: 7, data: new Uint8Array(49) }
    lone.data[24] = 255
    expect(maskArea(erodeMask(lone, 2))).toBe(0)
    expect(erodeMask(mask, 0)).toBe(mask)
  })

  it('intersects, bounds and counts', () => {
    const a: Mask = { width: 6, height: 6, data: new Uint8Array(36) }
    const b: Mask = { width: 6, height: 6, data: new Uint8Array(36) }
    for (const p of [1 * 6 + 2, 4 * 6 + 5]) {
      a.data[p] = 255
      b.data[p] = 255
    }
    b.data[2 * 6 + 3] = 255
    expect(maskBounds(a)).toEqual({ x0: 2, y0: 1, x1: 6, y1: 5 })
    expect(maskBounds(b)).toEqual({ x0: 2, y0: 1, x1: 6, y1: 5 })
    expect(maskArea(intersectMasks(a, b))).toBe(2)
    expect(maskBounds(fullMask(4, 4))).toEqual({ x0: 0, y0: 0, x1: 4, y1: 4 })
    expect(maskBounds({ width: 4, height: 4, data: new Uint8Array(16) })).toBeNull()
  })
})

describe('mean darkness', () => {
  it('reads only masked pixels', () => {
    const img = rgba(2, 1, (x) => (x === 0 ? [0, 0, 0, 255] : [255, 255, 255, 255]))
    const mask: Mask = { width: 2, height: 1, data: new Uint8Array([255, 0]) }
    expect(meanDarkness(img, mask)).toBeCloseTo(255, 6)
    expect(Number.isNaN(meanDarkness(img, { width: 2, height: 1, data: new Uint8Array([0, 0]) }))).toBe(true)
  })
})

/* -------------------------------------------------- side fades/edges */

// A trapezoid whose ramps are known by construction. Columns 6..18 and
// rows 10..30 sit in the saturated core, so the row profile reads the
// vertical ramps and the column profile the horizontal ones.
const TRAP_D = 210
function trapDarkness(x: number, y: number): number {
  const fy = y <= 6 ? (TRAP_D * y) / 7 : y >= 35 ? (TRAP_D * (40 - y)) / 5 : TRAP_D // prettier-ignore
  const fx = x <= 2 ? (TRAP_D * x) / 3 : x >= 20 ? (TRAP_D * (24 - x)) / 5 : TRAP_D // prettier-ignore
  return Math.min(fy, fx)
}

describe('side fades', () => {
  it('measures four different 50%->10% widths on one fixture', () => {
    const img = rgba(25, 41, (x, y) => {
      const v = Math.round(255 - trapDarkness(x, y))
      return [v, v, v, 255]
    })
    const fades = sideFades(img, fullMask(25, 41))
    expect(fades).not.toBeNull()
    expect(fades!.top).toBe(3)
    expect(fades!.bottom).toBe(2)
    expect(fades!.left).toBe(1)
    expect(fades!.right).toBe(2)
  })

  it('reports null when the mask is too small to profile', () => {
    expect(sideFades(solid(4, 4, 0, 0, 0), fullMask(4, 4))).toBeNull()
  })

  // RULING 2026-11-19 — the fade instrument is the ALPHA profile as a
  // fraction of the PAPER→CORE range. The darkness gauge is broken on a
  // saturated paint (10 % of the core sits below the mask's outer row), so
  // this fixture carries the same trapezoid on the alpha channel: RGB can be
  // anything, only alpha is read.
  it('measures the four widths on ALPHA and reports the crossing positions', () => {
    const img = rgba(25, 41, (x, y) => [0, 0, 0, Math.round(trapDarkness(x, y))])
    const fades = sideFadesAlpha(img, fullMask(25, 41))
    expect(fades).not.toBeNull()
    expect(fades!.top).toBe(3)
    expect(fades!.bottom).toBe(2)
    expect(fades!.left).toBe(1)
    expect(fades!.right).toBe(2)
    // WHERE the profile crosses: top 50 % at row 4, 10 % at row 1.
    expect(fades!.top50).toBe(4)
    expect(fades!.top10).toBe(1)
    expect(fades!.bottom50).toBe(37)
    expect(fades!.bottom10).toBe(39)
  })

  it('anchors the alpha levels on the PAPER alpha outside the mask', () => {
    // Paper alpha 40, stroke core 200: the 10 % level is 40 + 16 = 56, not
    // 10 % of the core alone. A single ramp row at 50 is BELOW that level;
    // with the paper offset it must not be counted as paint.
    const img = rgba(25, 41, (x, y) => {
      const inside = y >= 10 && y <= 30
      const alpha = inside ? (y === 10 ? 50 : 200) : 40
      return [0, 0, 0, alpha]
    })
    const mask: Mask = { width: 25, height: 41, data: new Uint8Array(25 * 41) }
    for (let y = 10; y <= 30; y += 1) for (let x = 0; x < 25; x += 1) mask.data[y * 25 + x] = 255
    const fades = sideFadesAlpha(img, mask)
    expect(fades).not.toBeNull()
    expect(fades!.top10).toBe(11)
  })
})

describe('edge hue variance', () => {
  it('localises the variance in the side band that carries the mixing', () => {
    // Uniform block of blue whose TOP band alternates blue/green, so only
    // the top 50->10 band holds mixed hues.
    const img = rgba(25, 41, (x, y) => {
      if (y <= 3) return x % 2 === 0 ? CORNFLOWER : ([0, 255, 0, 255] as [number, number, number, number])
      return CORNFLOWER
    })
    const edge = edgeHueStd(img, fullMask(25, 41))
    expect(edge).not.toBeNull()
    expect(edge!.top).toBeGreaterThan(30)
    // Constant hue: the std is float noise only.
    expect(edge!.bottom).toBeLessThan(1e-3)
    expect(edge!.left).toBeLessThan(1e-3)
    expect(edge!.right).toBeLessThan(1e-3)
  })
})

/* ---------------------------------------------------------- strands */

describe('strand measures', () => {
  it('scores a banded fixture strictly higher than a flat one on both axes', () => {
    // 41 rows keeps the central band an odd 21 rows, so the checker's parity
    // cannot average out in the column profile.
    const flat = solid(40, 41, 128, 128, 128)
    const checker = rgba(40, 41, (x, y) => {
      const black = Math.floor(x / 4) % 2 === Math.floor(y / 4) % 2
      const v = black ? 20 : 235
      return [v, v, v, 255]
    })
    const mask = fullMask(40, 41)
    const flatAlong = alongVariance(flat, mask)
    const flatAcross = acrossGradientEnergy(flat, mask)
    const bandAlong = alongVariance(checker, mask)
    const bandAcross = acrossGradientEnergy(checker, mask)
    expect(flatAlong).toBeCloseTo(0, 6)
    expect(flatAcross).toBeCloseTo(0, 6)
    expect(bandAlong).toBeGreaterThan(1)
    expect(bandAcross).toBeGreaterThan(1)
    expect(bandAlong).toBeGreaterThan(flatAlong)
    expect(bandAcross).toBeGreaterThan(flatAcross)
  })
})

describe('stroke half width', () => {
  it('reads half the median column thickness of the central band', () => {
    const mask: Mask = { width: 40, height: 40, data: new Uint8Array(1600) }
    for (let y = 10; y < 30; y += 1) for (let x = 5; x < 35; x += 1) mask.data[y * 40 + x] = 255
    expect(strokeHalfWidthPx(mask)).toBeCloseTo(10, 6)
    expect(Number.isNaN(strokeHalfWidthPx({ width: 4, height: 4, data: new Uint8Array(16) }))).toBe(true)
  })
})

/* ------------------------------------------------------------- body */

describe('body coverage (D-C)', () => {
  it('separates fully covered from half-transparent alpha', () => {
    const mask: Mask = { width: 20, height: 20, data: new Uint8Array(400) }
    for (let y = 5; y < 15; y += 1) for (let x = 5; x < 15; x += 1) mask.data[y * 20 + x] = 255
    const full = rgba(20, 20, (x, y) => [0, 0, 0, mask.data[y * 20 + x] ? 255 : 0])
    const half = rgba(20, 20, (x, y) => [0, 0, 0, mask.data[y * 20 + x] ? 100 : 0])
    const covered = bodyCoverage(full, mask)
    expect(covered.coveredFraction).toBeCloseTo(1, 6)
    expect(covered.interiorAlphaMean).toBeCloseTo(1, 6) // erode 2 of a 10x10 square leaves 6x6
    const thin = bodyCoverage(half, mask)
    expect(thin.coveredFraction).toBeCloseTo(0, 6) // 100/255 = 0.39 < 0.5
    expect(thin.interiorAlphaMean).toBeCloseTo(100 / 255, 4)
  })

  it('reports NaN interior when the mask has no eroded core', () => {
    const mask: Mask = { width: 20, height: 20, data: new Uint8Array(400) }
    for (let y = 8; y < 12; y += 1) for (let x = 8; x < 12; x += 1) mask.data[y * 20 + x] = 255
    const pigment = rgba(20, 20, (x, y) => [0, 0, 0, mask.data[y * 20 + x] ? 255 : 0])
    const body = bodyCoverage(pigment, mask)
    expect(body.coveredFraction).toBeCloseTo(1, 6)
    expect(Number.isNaN(body.interiorAlphaMean)).toBe(true)
  })
})

/* ----------------------------------------------------------- sha256 */

describe('sha256', () => {
  const hex = (s: string): Uint8Array => new TextEncoder().encode(s)

  it('matches the standard vectors', () => {
    expect(sha256Hex(new Uint8Array(0))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256Hex(hex('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('crosses the 55/56/64-byte padding boundaries consistently', () => {
    // Node's crypto is the oracle; the probe's pure version must agree.
    for (const len of [0, 1, 55, 56, 63, 64, 65, 119, 120, 128]) {
      const bytes = new Uint8Array(len)
      for (let i = 0; i < len; i += 1) bytes[i] = (i * 37) % 256
      const expected = createHash('sha256').update(bytes).digest('hex')
      expect(sha256Hex(bytes)).toBe(expected)
    }
  })

  it('changes with the data', () => {
    const a = sha256Hex(new Uint8Array([0, 1, 2, 3]))
    const b = sha256Hex(new Uint8Array([3, 2, 1, 0]))
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(a).not.toBe(b)
  })
})

/* ------------------------------------------------------ measureScene */

function sceneRasters(): { pre: Rgba; substrate: Rgba; finalPaper: Rgba; finalPigment: Rgba } {
  // The stroke bar is 12 px tall: profiles() refuses a bounds height < 8.
  const pre = solid(40, 60, ...PAPER)
  const substrate = rgba(40, 60, (_x, y) => (y >= 20 && y <= 33 ? YELLOW : PAPER))
  const finalPaper = rgba(40, 60, (x, y) => {
    if (y >= 24 && y <= 35 && x >= 6 && x <= 33) return CORNFLOWER
    return y >= 20 && y <= 33 ? YELLOW : PAPER
  })
  const finalPigment = rgba(40, 60, (x, y) => {
    const inStroke = y >= 24 && y <= 35 && x >= 6 && x <= 33
    return [89, 148, 228, inStroke ? 255 : 0]
  })
  return { pre, substrate, finalPaper, finalPigment }
}

describe('measureScene', () => {
  it('turns a band + crossing into the record the acceptance reads', () => {
    const { pre, substrate, finalPaper, finalPigment } = sceneRasters()
    const record = measureScene({
      scene: 'band-p100',
      pre,
      substrate,
      finalPaper,
      finalPigment,
      params: { color: '#5994e4', brushId: 'bristle-flat', sizePx: 22, pickup: 100, feather: 0, body: 0, refill: 0 },
    })
    expect(record['scene']).toBe('band-p100')
    expect(record['color']).toBe('#5994e4')
    expect(record['paperDigest']).toMatch(/^[0-9a-f]{64}$/)
    expect(record['pigmentDigest']).toMatch(/^[0-9a-f]{64}$/)
    expect(record['bandHueDeg'] as number).toBeCloseTo(48.93, 1)
    expect(record['bandChroma'] as number).toBeCloseTo(0.81, 2)
    expect(record['strokeHueDeg'] as number).toBeCloseTo(214.53, 1)
    expect(record['crossingHueDeg'] as number).toBeCloseTo(214.53, 1)
    expect(record['crossingPixels'] as number).toBe(192) // 24 eroded columns x 8 eroded rows
    expect(record['strokeHalfWidthPx']).toBe(6)
    expect(record['coreDarkness'] as number).toBeCloseTo(113.77, 1)
    expect(record['fadeTop']).toBe(0)
    expect(record['fadeBottom']).toBe(0)
    expect(record['fadeLeft']).toBe(0)
    expect(record['fadeRight']).toBe(0)
    expect(record['coveredFraction'] as number).toBeCloseTo(1, 6)
    expect(record['interiorAlphaMean'] as number).toBeCloseTo(1, 6)
  })

  it('leaves the stroke measures off a band-only scene but keeps its digests', () => {
    const pre = solid(40, 40, ...PAPER)
    const substrate = rgba(40, 40, (_x, y) => (y >= 15 && y <= 24 ? YELLOW : PAPER))
    const record = measureScene({ scene: 'band', pre, substrate, finalPaper: substrate, params: {} })
    expect(record['bandHueDeg']).toBeDefined()
    expect(record['strokeHueDeg']).toBeUndefined()
    expect(record['paperDigest']).toMatch(/^[0-9a-f]{64}$/)
    expect(record['pigmentDigest']).toBeNull()
  })

  it('handles a blank scene (no band, no stroke)', () => {
    const pre = solid(40, 40, ...PAPER)
    const record = measureScene({ scene: 'blank', pre, finalPaper: pre, params: {} })
    expect(record['scene']).toBe('blank')
    expect(record['strokePixels']).toBeUndefined()
    expect(record['paperDigest']).toMatch(/^[0-9a-f]{64}$/)
  })
})

/* ------------------------------------------------------- acceptance */

function captures(scenes: Record<string, SceneRecord>): RunCapture {
  return { scenes }
}

const AFTER_SCENES: Record<string, SceneRecord> = {
  band: { bandHueDeg: 49, bandChroma: 0.5 },
  'band-p0': { crossingHueDeg: 214, strokeHalfWidthPx: 10 },
  'band-p100': { crossingHueDeg: 170, alongVariance: 12, acrossGradient: 6, coreDarkness: 105, strokeHalfWidthPx: 10 },
  // RULING 2026-11-19: the drag block reads the shipped-Dry pair.
  'band-p0-dry50': { crossingHueDeg: 214 },
  'band-p100-dry50': { crossingHueDeg: 170 },
  'blank-p0-dry50': { strokeHueDeg: 212 },
  'blank-p0': { strokeHueDeg: 212, strokeHalfWidthPx: 10 },
  // FIX 3: the same mark reads at the reference's width and widens with
  // Feather exactly as the reference does (10 -> 12 both sides).
  'blank-f0': { fadeTop: 2, fadeBottom: 2, fadeLeft: 2, fadeRight: 2, edgeHueStdTop: 5, edgeHueStdBottom: 5, edgeHueStdLeft: 5, edgeHueStdRight: 5, strokeHalfWidthPx: 10 },
  'blank-f100': { fadeTop: 4, fadeBottom: 4, fadeLeft: 4, fadeRight: 4, edgeHueStdTop: 9, edgeHueStdBottom: 9, edgeHueStdLeft: 9, edgeHueStdRight: 9, strokeHalfWidthPx: 12 },
  body0: { coveredFraction: 0.4, interiorAlphaMean: 0.5 },
  body100: { coveredFraction: 0.8, interiorAlphaMean: 1 },
}

const BEFORE_SCENES: Record<string, SceneRecord> = {
  'band-p100': { alongVariance: 10, acrossGradient: 5, coreDarkness: 100 },
}

const REFERENCE_SCENES: Record<string, SceneRecord> = {
  band: { bandHueDeg: 50, bandChroma: 0.6 },
  'band-p0': { crossingHueDeg: 210, strokeHalfWidthPx: 10 },
  'band-p100': { crossingHueDeg: 190, strokeHalfWidthPx: 10 },
  'blank-p0': { strokeHueDeg: 211, strokeHalfWidthPx: 10 },
  'blank-f0': { fadeTop: 3, fadeBottom: 3, fadeLeft: 3, fadeRight: 3, strokeHalfWidthPx: 10 },
  'blank-f100': { fadeTop: 3, fadeBottom: 3, fadeLeft: 3, fadeRight: 3, strokeHalfWidthPx: 12 },
}

function run(): ReturnType<typeof acceptance> {
  return acceptance(captures(BEFORE_SCENES), captures(AFTER_SCENES), captures(REFERENCE_SCENES))
}

describe('acceptance blocks', () => {
  it('passes every block on a hand-computed set', () => {
    const a = run()
    expect(a.thresholds).toMatchObject({
      HUE_MIN_SHIFT_DEG,
      HUE_MIN_ANGLE_FRACTION,
      HUE_P0_CONTROL_MAX_DEG,
      FADE_MIN_GAIN_PX,
      STRAND_MIN_RATIO,
      CORE_DARKNESS_MAX_DELTA_PCT,
    })
    // drag: 214 -> 170 is -44 deg; blue -> band is -165 deg; fraction 0.267.
    expect(a.drag.signedShiftDeg).toBe(-44)
    expect(a.drag.blueToBandDeg).toBe(-165)
    expect(a.drag.fractionOfBlueToBandAngle).toBeCloseTo(0.267, 2)
    expect(a.drag.blankP0DeltaDeg).toBe(2)
    expect(a.drag.pass).toBe(true)
    // feather: every side gains 2 px.
    expect(a.feather.gains).toEqual({ top: 2, bottom: 2, left: 2, right: 2 })
    expect(a.feather.pass).toBe(true)
    // strands: 12/10 and 6/5, darkness +5%.
    expect(a.strands.alongVariance.ratio).toBeCloseTo(1.2, 6)
    expect(a.strands.acrossGradient.ratio).toBeCloseTo(1.2, 6)
    expect(a.strands.coreDarkness.deltaPct).toBeCloseTo(5, 6)
    expect(a.strands.pass).toBe(true)
    // body: 0.8 > 0.4.
    expect(a.body.coveredFraction).toEqual({ b0: 0.4, b100: 0.8 })
    expect(a.body.interiorAlphaMean).toEqual({ b0: 0.5, b100: 1 })
    expect(a.body.pass).toBe(true)
    // reference echo, never a pass operand.
    expect(a.drag.reference.signedShiftDeg).toBe(-20)
    expect(a.drag.reference.blankP0DeltaDeg).toBe(1)
    // geometry (restated): the CLEAN blank pair matches at Feather 0, and the
    // Feather response is 1.2x on both sides.
    expect(a.geometry.widths['blank-f0']).toEqual({ studio: 10, reference: 10, ratio: 1 })
    expect(a.geometry.shape.studioWiden).toBeCloseTo(1.2, 6)
    expect(a.geometry.shape.referenceWiden).toBeCloseTo(1.2, 6)
    expect(a.geometry.shape.parity).toBe(0)
    expect(a.geometry.pass).toBe(true)
  })

  it('fails the geometry when a width deviates more than 15% from the reference', () => {
    const scenes = {
      ...AFTER_SCENES,
      'blank-f0': { ...AFTER_SCENES['blank-f0'], strokeHalfWidthPx: 7.5 },
    }
    const a = acceptance(captures(BEFORE_SCENES), captures(scenes), captures(REFERENCE_SCENES))
    expect(a.geometry.widths['blank-f0']!.ratio).toBe(0.75)
    expect(a.geometry.pass).toBe(false)
  })

  it('fails the geometry when Feather changes the width in the wrong direction', () => {
    const scenes = {
      ...AFTER_SCENES,
      'blank-f100': { ...AFTER_SCENES['blank-f100'], strokeHalfWidthPx: 8 },
    }
    const a = acceptance(captures(BEFORE_SCENES), captures(scenes), captures(REFERENCE_SCENES))
    expect(a.geometry.shape.studioWiden).toBeCloseTo(0.8, 6)
    expect(a.geometry.shape.referenceWiden).toBeCloseTo(1.2, 6)
    expect(a.geometry.shape.parity).toBeCloseTo(1 / 3, 2)
    expect(a.geometry.pass).toBe(false)
  })

  it('fails the drag when the shift is under 20% of the blue->band angle', () => {
    const scenes = {
      ...AFTER_SCENES,
      'band-p100-dry50': { ...AFTER_SCENES['band-p100-dry50'], crossingHueDeg: 200 },
    }
    const a = acceptance(captures(BEFORE_SCENES), captures(scenes), captures(REFERENCE_SCENES))
    expect(a.drag.signedShiftDeg).toBe(-14)
    expect(Math.abs(a.drag.signedShiftDeg)).toBeGreaterThanOrEqual(HUE_MIN_SHIFT_DEG)
    expect(a.drag.fractionOfBlueToBandAngle).toBeCloseTo(0.08, 2)
    expect(a.drag.pass).toBe(false)
  })

  it('fails the drag when the band is not yellow', () => {
    const scenes = { ...AFTER_SCENES, band: { bandHueDeg: 120, bandChroma: 0.5 } }
    const a = acceptance(captures(BEFORE_SCENES), captures(scenes), captures(REFERENCE_SCENES))
    expect(a.drag.pass).toBe(false)
    expect(a.drag.detail).toContain('band hue')
  })

  it('fails the drag when the Pickup-0 control drifted', () => {
    const scenes = { ...AFTER_SCENES, 'blank-p0-dry50': { strokeHueDeg: 220 } }
    const a = acceptance(captures(BEFORE_SCENES), captures(scenes), captures(REFERENCE_SCENES))
    expect(a.drag.blankP0DeltaDeg).toBe(6)
    expect(a.drag.pass).toBe(false)
  })

  it('fails the feather when one side does not gain', () => {
    const scenes = { ...AFTER_SCENES, 'blank-f100': { ...AFTER_SCENES['blank-f100'], fadeLeft: 2 } }
    const a = acceptance(captures(BEFORE_SCENES), captures(scenes), captures(REFERENCE_SCENES))
    expect(a.feather.gains!.left).toBe(0)
    expect(a.feather.pass).toBe(false)
  })

  it('fails the strands when the core darkens too much', () => {
    const scenes = { ...AFTER_SCENES, 'band-p100': { ...AFTER_SCENES['band-p100'], coreDarkness: 120 } }
    const a = acceptance(captures(BEFORE_SCENES), captures(scenes), captures(REFERENCE_SCENES))
    expect(a.strands.coreDarkness.deltaPct).toBeCloseTo(20, 6)
    expect(a.strands.pass).toBe(false)
  })

  it('fails the strands when the structure does not rise', () => {
    const scenes = { ...AFTER_SCENES, 'band-p100': { ...AFTER_SCENES['band-p100'], alongVariance: 10, acrossGradient: 6 } }
    const a = acceptance(captures(BEFORE_SCENES), captures(scenes), captures(REFERENCE_SCENES))
    expect(a.strands.alongVariance.ratio).toBeCloseTo(1, 6)
    expect(a.strands.pass).toBe(false)
  })

  it('fails the body separation when the covered fraction does not strictly rise', () => {
    const scenes = { ...AFTER_SCENES, body100: { coveredFraction: 0.4, interiorAlphaMean: 1 } }
    const a = acceptance(captures(BEFORE_SCENES), captures(scenes), captures(REFERENCE_SCENES))
    expect(a.body.pass).toBe(false)
  })

  it('reports every number as NaN rather than throwing on missing scenes', () => {
    const a = acceptance(captures({}), captures({}), captures({}))
    expect(Number.isNaN(a.drag.hueP0)).toBe(true)
    expect(a.drag.pass).toBe(false)
    expect(a.feather.gains).toBeNull()
    expect(a.feather.pass).toBe(false)
    expect(a.strands.pass).toBe(false)
    expect(a.body.pass).toBe(false)
    expect(a.geometry.pass).toBe(false)
  })
})
