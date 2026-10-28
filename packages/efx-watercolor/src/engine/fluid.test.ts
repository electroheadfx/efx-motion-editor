// ============================================================
//  fluid look laws (AQUA-01 / AQUA-02) — the product's look is
//  the contract. TDD RED pins for:
//    1. wet-in-wet bloom past the stamp footprint
//    2. hard wet-on-dry edge (no bloom past the stamp)
//    3. tide line (edge darker than interior after drying)
//    4. conservation (pigment never seeps onto dry pixels)
//    5. tool 'water' wets without pigment
//    6. tool 'lift' removes wet AND dried pigment, deposits nothing
//    7. tool 'pen' thinner mark than 'brush' at equal size
//    8. tool union exhaustiveness: brush | water | pen | lift
//    9. determinism (same stroke + traceSeed ⇒ same bytes)
//  plus the flagged idle/no-op assumptions (empty sheet, dt=0).
//
//  Small synthetic sheets (32×32), integer ticks — never wall
//  clock (DATA-03). No unseeded RNG (D-20).
// ============================================================

import { describe, expect, it } from 'vitest'
import { hashMutationId, seededRng } from '@efxlab/efx-paint-host'
import type { StudioStroke } from '@efxlab/efx-paint-host/animation'
import { createSheet, step, sheetToBytes, totalPigment, wetPixelCount } from './fluid'
import type { FluidSheet } from './fluid'
import { AQUARELLE_TOOLS, stampTool, depositStrokeOnSheet } from './deposit'
import { forceDrySheet } from './drying'
import type { AquarelleTool } from './deposit'
import type { AquarelleStrokePayload } from '../payload/toStudioStroke'
import { toStudioStroke } from '../payload/toStudioStroke'

const W = 32
const H = 32

function idx(sheet: FluidSheet, x: number, y: number): number {
  return y * sheet.width + x
}

function mobileAt(sheet: FluidSheet, x: number, y: number): number {
  return sheet.mobile[idx(sheet, x, y)] ?? 0
}

function fixedAt(sheet: FluidSheet, x: number, y: number): number {
  return sheet.fixed[idx(sheet, x, y)] ?? 0
}

function totalAt(sheet: FluidSheet, x: number, y: number): number {
  return mobileAt(sheet, x, y) + fixedAt(sheet, x, y)
}

function wetAt(sheet: FluidSheet, x: number, y: number): number {
  return sheet.wet[idx(sheet, x, y)] ?? 0
}

/** Sum of pigment (mobile+fixed) strictly beyond `radius` from (cx,cy). */
function pigmentBeyond(
  sheet: FluidSheet,
  cx: number,
  cy: number,
  radius: number,
): number {
  let sum = 0
  for (let y = 0; y < sheet.height; y++) {
    for (let x = 0; x < sheet.width; x++) {
      const dx = x - cx
      const dy = y - cy
      if (Math.sqrt(dx * dx + dy * dy) <= radius) continue
      sum += totalAt(sheet, x, y)
    }
  }
  return sum
}

/** Sum of pigment (mobile+fixed) within `radius` of (cx,cy). */
function pigmentWithin(
  sheet: FluidSheet,
  cx: number,
  cy: number,
  radius: number,
): number {
  let sum = 0
  for (let y = 0; y < sheet.height; y++) {
    for (let x = 0; x < sheet.width; x++) {
      const dx = x - cx
      const dy = y - cy
      if (Math.sqrt(dx * dx + dy * dy) > radius) continue
      sum += totalAt(sheet, x, y)
    }
  }
  return sum
}

/** Count of pixels carrying any pigment. */
function countPigmented(sheet: FluidSheet): number {
  let n = 0
  for (let i = 0; i < sheet.mobile.length; i++) {
    if ((sheet.mobile[i] ?? 0) + (sheet.fixed[i] ?? 0) > 1e-6) n++
  }
  return n
}

/** Mean pigment in the annulus innerRadius..outerRadius around (cx,cy). */
function meanRing(
  sheet: FluidSheet,
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
): number {
  let sum = 0
  let n = 0
  for (let y = 0; y < sheet.height; y++) {
    for (let x = 0; x < sheet.width; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      if (d < innerRadius || d > outerRadius) continue
      sum += fixedAt(sheet, x, y) + mobileAt(sheet, x, y)
      n++
    }
  }
  return n === 0 ? 0 : sum / n
}

/** Mean pigment inside `radius` of (cx,cy). */
function meanDisc(
  sheet: FluidSheet,
  cx: number,
  cy: number,
  radius: number,
): number {
  let sum = 0
  let n = 0
  for (let y = 0; y < sheet.height; y++) {
    for (let x = 0; x < sheet.width; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      if (d > radius) continue
      sum += fixedAt(sheet, x, y) + mobileAt(sheet, x, y)
      n++
    }
  }
  return n === 0 ? 0 : sum / n
}

function makeStroke(mutationId: number, tool: AquarelleTool = 'brush'): StudioStroke<AquarelleStrokePayload> {
  return toStudioStroke({
    tool,
    color: '#2244aa',
    params: { size: 8, water: 50, load: 50, flow: 50, bleed: 50, dry: 50, edge: 50, granulation: 50 },
    brushId: 'wc/round-medium',
    points: [
      { x: 14, y: 16, p: 0.5, tx: 0, ty: 0, tw: 0 },
      { x: 16, y: 16, p: 0.6, tx: 0, ty: 0, tw: 0 },
      { x: 18, y: 16, p: 0.5, tx: 0, ty: 0, tw: 0 },
    ],
    mutationId,
    timestamp: 1000,
  })
}

function runStrokeOnce(mutationId: number): Uint8Array {
  const sheet = createSheet(W, H)
  depositStrokeOnSheet(sheet, makeStroke(mutationId))
  for (let tick = 0; tick < 10; tick++) step(sheet, 1)
  return sheetToBytes(sheet)
}

// ---------------------------------------------------------------------------
// 1. Wet-in-wet bloom (AQUA-01 / must-have truth 1)
// ---------------------------------------------------------------------------

describe('wet-in-wet bloom', () => {
  it('brush stamp into a pre-wet region blooms past the stamp footprint', () => {
    const sheet = createSheet(W, H)
    const cx = 16
    const cy = 16
    const stampRadius = 2

    // Pre-wet a wide region around the stamp.
    stampTool(sheet, 'water', cx, cy, { radius: 8, water: 1 })

    // Stamp pigment into the wet region.
    stampTool(sheet, 'brush', cx, cy, {
      radius: stampRadius,
      strength: 1,
      water: 0.5,
      color: '#2244aa',
    })

    // Pigment starts inside the stamp footprint.
    expect(pigmentWithin(sheet, cx, cy, stampRadius)).toBeGreaterThan(0)

    for (let tick = 0; tick < 30; tick++) step(sheet, 1)

    // Bloom: pigment has spread past the stamp footprint.
    const beyond = pigmentBeyond(sheet, cx, cy, stampRadius + 0.5)
    expect(beyond).toBeGreaterThan(0)

    // And it is still inside the pre-wet region (wet-gated, not a free-for-all).
    expect(pigmentBeyond(sheet, cx, cy, 9)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 2. Hard wet-on-dry edge (AQUA-01 / must-have truth 2)
// ---------------------------------------------------------------------------

describe('wet-on-dry hard edge', () => {
  it('brush stamp onto dry paper keeps a hard edge with no bloom past the stamp', () => {
    const sheet = createSheet(W, H)
    const cx = 16
    const cy = 16
    const stampRadius = 2

    // No pre-wetting — dry paper.
    stampTool(sheet, 'brush', cx, cy, {
      radius: stampRadius,
      strength: 1,
      water: 0.5,
      color: '#2244aa',
    })

    for (let tick = 0; tick < 30; tick++) step(sheet, 1)

    // Hard edge: nothing past the stamp footprint ±1px.
    expect(pigmentBeyond(sheet, cx, cy, stampRadius + 1)).toBe(0)
    // The mark itself survives.
    expect(pigmentWithin(sheet, cx, cy, stampRadius)).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// 3. Tide line (AQUA-01 / must-have truth 3)
// ---------------------------------------------------------------------------

describe('tide line', () => {
  it('drying a wet wash concentrates darker pigment along its receding boundary', () => {
    const sheet = createSheet(W, H)
    const cx = 16
    const cy = 16

    // A wet wash: wide wet region + pigment in it.
    stampTool(sheet, 'water', cx, cy, { radius: 8, water: 1 })
    stampTool(sheet, 'brush', cx, cy, {
      radius: 6,
      strength: 1,
      water: 0.2,
      color: '#2244aa',
    })

    // Dry fully on the integer tick grid (never wall clock).
    for (let tick = 0; tick < 240; tick++) step(sheet, 1)
    expect(wetPixelCount(sheet)).toBe(0)

    const edge = meanRing(sheet, cx, cy, 5, 7)
    const interior = meanDisc(sheet, cx, cy, 3)

    expect(interior).toBeGreaterThan(0)
    expect(edge).toBeGreaterThan(0)
    // Dark rim: edge mean at least 1.05× the interior mean.
    expect(edge / Math.max(interior, 1e-6)).toBeGreaterThan(1.05)
  })
})

// ---------------------------------------------------------------------------
// 4. Conservation (AQUA-01 / must-have truth 4)
// ---------------------------------------------------------------------------

describe('conservation — never seeps onto dry paper', () => {
  it('a dry pixel adjacent to wet pigment receives zero pigment after N ticks', () => {
    const sheet = createSheet(W, H)

    // Wet the left half only (x < 16). x = 16 stays dry.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < 16; x++) {
        sheet.wet[idx(sheet, x, y)] = 1
      }
    }

    // Pigment in the wet half, close to the wet/dry boundary.
    stampTool(sheet, 'brush', 12, 16, {
      radius: 3,
      strength: 1,
      water: 0,
      color: '#2244aa',
    })

    for (let tick = 0; tick < 30; tick++) step(sheet, 1)

    // Closed neighbourhood: every dry pixel stays untouched.
    for (let y = 0; y < H; y++) {
      for (let x = 16; x < W; x++) {
        expect(totalAt(sheet, x, y)).toBe(0)
        expect(wetAt(sheet, x, y)).toBe(0)
      }
    }

    // The wet side did receive pigment.
    expect(pigmentWithin(sheet, 12, 16, 3)).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// 5. Tool 'water' (AQUA-02)
// ---------------------------------------------------------------------------

describe("tool 'water'", () => {
  it('wets the sheet without depositing pigment', () => {
    const sheet = createSheet(W, H)
    const pigmentBefore = totalPigment(sheet)
    expect(pigmentBefore).toBe(0)

    stampTool(sheet, 'water', 16, 16, { radius: 4, water: 1 })

    expect(wetAt(sheet, 16, 16)).toBeGreaterThan(0)
    expect(wetPixelCount(sheet)).toBeGreaterThan(0)
    // Pigment unchanged.
    expect(totalPigment(sheet)).toBe(pigmentBefore)
  })
})

// ---------------------------------------------------------------------------
// 6. Tool 'lift' (AQUA-02)
// ---------------------------------------------------------------------------

describe("tool 'lift'", () => {
  it('removes wet pigment in the stamped region and deposits nothing elsewhere', () => {
    const sheet = createSheet(W, H)

    stampTool(sheet, 'brush', 16, 16, {
      radius: 4,
      strength: 1,
      water: 0.5,
      color: '#2244aa',
    })

    const beforeIn = mobileAt(sheet, 16, 16)
    expect(beforeIn).toBeGreaterThan(0)

    stampTool(sheet, 'lift', 16, 16, { radius: 4, strength: 1 })

    expect(mobileAt(sheet, 16, 16)).toBeLessThan(beforeIn)

    // No new pigment anywhere outside the lifted region.
    expect(totalAt(sheet, 2, 2)).toBe(0)
    expect(totalAt(sheet, 28, 28)).toBe(0)
    expect(totalAt(sheet, 28, 4)).toBe(0)
  })

  it('removes fixed pigment after the sheet is dried', () => {
    const sheet = createSheet(W, H)

    stampTool(sheet, 'brush', 16, 16, {
      radius: 4,
      strength: 1,
      water: 0.5,
      color: '#2244aa',
    })
    forceDrySheet(sheet)

    expect(fixedAt(sheet, 16, 16)).toBeGreaterThan(0)
    expect(mobileAt(sheet, 16, 16)).toBe(0)

    const fixedBefore = fixedAt(sheet, 16, 16)
    stampTool(sheet, 'lift', 16, 16, { radius: 4, strength: 1 })

    // 261028-k03 D1: an explicit Dry bakes pigment into `fixed`; Lift is the
    // one tool that reaches it, so the law oracle and the renderer agree.
    expect(fixedAt(sheet, 16, 16)).toBeLessThan(fixedBefore)
    expect(totalAt(sheet, 2, 2)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 7. Tool 'pen' (AQUA-02)
// ---------------------------------------------------------------------------

describe("tool 'pen'", () => {
  it('deposits a thinner mark than brush at equal size parameter', () => {
    const brushSheet = createSheet(W, H)
    const penSheet = createSheet(W, H)
    const size = 10

    stampTool(brushSheet, 'brush', 16, 16, {
      radius: size / 2,
      strength: 1,
      water: 0.5,
      color: '#2244aa',
    })
    stampTool(penSheet, 'pen', 16, 16, {
      radius: size / 2,
      strength: 1,
      water: 0.2,
      color: '#2244aa',
    })

    const brushPixels = countPigmented(brushSheet)
    const penPixels = countPigmented(penSheet)

    expect(brushPixels).toBeGreaterThan(0)
    expect(penPixels).toBeGreaterThan(0)
    // Thinner: fewer pigmented pixels at the same size parameter.
    expect(penPixels).toBeLessThan(brushPixels)
  })
})

// ---------------------------------------------------------------------------
// 8. Tool union exhaustiveness (AQUA-02 / D-18)
// ---------------------------------------------------------------------------

describe('tool union exhaustiveness', () => {
  it("exposes exactly 'brush' | 'water' | 'pen' | 'lift' — no fifth tool kind", () => {
    expect([...AQUARELLE_TOOLS].sort()).toEqual(['brush', 'lift', 'pen', 'water'])
  })

  it('rejects an unknown tool fail-closed (never a silent fifth mode)', () => {
    const sheet = createSheet(8, 8)
    expect(() =>
      stampTool(sheet, 'fill' as AquarelleTool, 4, 4, { radius: 2 }),
    ).toThrow()
  })

  it('every declared tool round-trips through the payload union', () => {
    for (const tool of AQUARELLE_TOOLS) {
      const stroke = makeStroke(7, tool)
      expect(stroke.engine.tool).toBe(tool)
    }
  })
})

// ---------------------------------------------------------------------------
// 9. Determinism (AQUA-01 / D-20)
// ---------------------------------------------------------------------------

describe('determinism', () => {
  it('same stroke + same traceSeed twice yields identical buffer bytes', () => {
    const a = runStrokeOnce(42)
    const b = runStrokeOnce(42)
    expect(a.length).toBe(b.length)
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
  })

  it('different traceSeeds produce different patterns (seed is consumed)', () => {
    const a = runStrokeOnce(7)
    const b = runStrokeOnce(99)
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false)
  })

  it('water and pigment draw from distinct seeded streams (never alias)', () => {
    // Two roles, one stroke seed — the stream keys must separate them.
    const waterRng = seededRng(hashMutationId(42), 'water')
    const pigmentRng = seededRng(hashMutationId(42), 'pigment')
    const w0 = waterRng()
    const p0 = pigmentRng()
    expect(w0).not.toBe(p0)
  })
})

// ---------------------------------------------------------------------------
// Flagged assumptions — idle dry sheet, dt=0 idempotency
// ---------------------------------------------------------------------------

describe('sim no-op laws', () => {
  it('stepping an empty dry sheet is a no-op (R1.6 idle dry sheet)', () => {
    const sheet = createSheet(W, H)
    const before = sheetToBytes(sheet)
    for (let tick = 0; tick < 10; tick++) step(sheet, 1)
    const after = sheetToBytes(sheet)
    expect(Buffer.from(before).equals(Buffer.from(after))).toBe(true)
  })

  it('stepping the same wet state with dt=0 is a no-op', () => {
    const sheet = createSheet(W, H)
    stampTool(sheet, 'brush', 16, 16, {
      radius: 3,
      strength: 1,
      water: 0.5,
      color: '#2244aa',
    })
    const before = sheetToBytes(sheet)
    step(sheet, 0)
    step(sheet, 0)
    const after = sheetToBytes(sheet)
    expect(Buffer.from(before).equals(Buffer.from(after))).toBe(true)
  })
})
