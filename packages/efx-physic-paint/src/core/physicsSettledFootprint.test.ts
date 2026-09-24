// ============================================================
//  260924-m7w — Physics settled footprint measurement harness
//
//  Diagnosis-first quick: measure the stroke cross-section width at
//  three pipeline stages (deposit → fluid settle → display visibility)
//  and attribute the inflation of the settled mark vs the drawn
//  preview ribbon (2 * brushRenderRadius) to one seam:
//    (a) deposit radius/falloff  → W_deposit - 2r
//    (b) fluid spread            → W_settle  - W_deposit
//    (c) display composite       → W_visible - W_settle
//
//  Test-only. Drives the real settle (localFluidPhysicsStep — the path
//  EfxPaintEngine runs at finalize in the default 'local' physics mode,
//  K = max(1, ceil(spreadCurve*10)) = 3 ticks at localSpreadStrength 50)
//  and the real visibility function (wetDisplayAlpha, pure).
//
//  TWO deposit paths are measured because they are materially different:
//    - depositToWetLayer (plan-prescribed; radial stamps, alpha ≤ ~240/stamp)
//    - transferToWetLayerClipped (PRODUCTION path — paint.ts raster →
//      transfer; deposit = (rasterAlpha/255)*3000 gated at rasterAlpha >= 20)
//  The synthetic raster models the production ribbon fill: solid rows
//  29..34 (polygon [29,35) at r=3, y=32) plus a 1px AA fringe (alpha 80)
//  at rows 28/35 — deterministic, no RNG (bristles/deform are random in
//  production and are excluded for pin-3 determinism).
// ============================================================

import { describe, expect, it } from 'vitest'
import { createWetBuffers, depositToWetLayer, transferToWetLayerClipped } from './wet-layer'
import { localFluidPhysicsStep } from './fluids'
import { wetDisplayAlpha } from '../render/compositor'
import { sampleH } from './paper'
import type { FluidConfig, PenPoint, WetBuffers } from '../types'

// === Engine-mirrored defaults (EfxPaintEngine) ===
const CANVAS_W = 128
const CANVAS_H = 64
const MID_X = 64
const MID_Y = 32
/** brushRenderRadius(default size 6) = max(0.5, 6/2) = 3 */
const BRUSH_RADIUS = 3
/** Preview ribbon contract: width = 2 * radius at uniform pressure */
const RIBBON_W = 2 * BRUSH_RADIUS
/** localSpreadStrength 50 → spreadCurve 0.25 → ticks = max(1, ceil(2.5)) = 3 */
const SPREAD_STRENGTH = 50
const K_TICKS = Math.max(1, Math.ceil((SPREAD_STRENGTH / 100) ** 2 * 10))
/** Engine fluidConfig defaults (D-13 / D-02 / D-03) */
const FLUID_CONFIG: FluidConfig = { viscosity: 0.0001, omega_h: 0.06, darkening: 0.1 }
/** Brush defaults: opacity 100 → 1.0, waterAmount 50 → 0.5 (engine passes /100) */
const DEFAULT_OPACITY = 1.0
const DEFAULT_WATER = 0.5

// === Measurement thresholds (calibrated) ===
/** Visible threshold: ~5% of 255 */
const VISIBLE_THRESH = 13
/**
 * Raw-density floor equivalent to VISIBLE_THRESH through wetDisplayAlpha's
 * pixelOpacity >= 0.90 branch: round(alpha / 3000 * 300) >= 13 ⇔ alpha >= 125.
 * Used for W_deposit / W_settle so seam (c) isolates the display curve only.
 */
const ALPHA_FLOOR = 125

// === Sweep cells ===
const WATERS = [10, 50, 90] as const
/** dense ≈ engine resample spacing (max(3, radius*0.25) = 3); sparse = fast stroke */
const SPACINGS = [{ label: 'dense', px: 3 }, { label: 'sparse', px: 12 }] as const
const PAPERS = ['null', 'synthetic'] as const
const DEPOSITS = ['transfer(prod)', 'stamp(plan)'] as const

interface CellResult {
  deposit: string
  water: number
  spacing: string
  paper: string
  W_deposit: number
  W_settle: number
  W_visible: number
}

function makeCurve(spacing: number): PenPoint[] {
  const pts: PenPoint[] = []
  // x range 16..112 step spacing: both 3 and 12 land exactly on MID_X=64
  for (let x = 16; x <= 112; x += spacing) {
    pts.push({ x, y: MID_Y, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 })
  }
  return pts
}

/** Deterministic pseudo-noise height map in [0, 1] (no RNG — pin 3 needs it) */
function makeSyntheticPaper(): Float32Array {
  const h = new Float32Array(CANVAS_W * CANVAS_H)
  for (let y = 0; y < CANVAS_H; y++) {
    for (let x = 0; x < CANVAS_W; x++) {
      const v = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1
      h[y * CANVAS_W + x] = v
    }
  }
  return h
}

/** Stroke bounds for transfer bounds + engine local bbox (x 16..112, y 32) */
const STROKE = { x0: 16, x1: 112, y: MID_Y }

/**
 * Production ribbon raster model (paint.ts renderPaintStroke):
 * ribbon polygon at r=3 around y=32 covers rows 29..34 solidly; canvas-fill
 * AA leaves a ~1px fringe (alpha 80) at rows 28 and 35. transfer's a >= 20
 * gate keeps the fringe. Deterministic, no bristles/deform randomness.
 */
function makeRasterBounds() {
  return { x: STROKE.x0, y: MID_Y - 6, w: STROKE.x1 - STROKE.x0 + 1, h: 13 }
}

function makeRasterImageData(bounds: { x: number; y: number; w: number; h: number }): { data: Uint8ClampedArray; width: number; height: number } {
  const data = new Uint8ClampedArray(bounds.w * bounds.h * 4)
  for (let ly = 0; ly < bounds.h; ly++) {
    const gy = bounds.y + ly
    let a = 0
    if (gy >= 29 && gy <= 34) a = 255       // solid ribbon interior (polygon [29,35))
    else if (gy === 28 || gy === 35) a = 80 // 1px canvas AA fringe
    for (let lx = 0; lx < bounds.w; lx++) {
      const i = (ly * bounds.w + lx) * 4
      data[i] = 255; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = a
    }
  }
  return { data, width: bounds.w, height: bounds.h }
}

/**
 * Engine local-mode bbox (applyStrokeToEngine / stepInteractivePaintFinalization):
 *   margin = ceil(2 + waterCurve * brushR * 0.6 + spreadCurve * brushR * 0.4)
 *   bbox   = stroke bounds ± (brushR + margin), clamped to canvas
 */
function engineLocalBbox(curve: PenPoint[], water01: number) {
  let sx0 = Infinity, sy0 = Infinity, sx1 = -Infinity, sy1 = -Infinity
  for (const p of curve) {
    sx0 = Math.min(sx0, p.x); sy0 = Math.min(sy0, p.y)
    sx1 = Math.max(sx1, p.x); sy1 = Math.max(sy1, p.y)
  }
  const waterCurve = water01 * water01
  const spreadCurve = (SPREAD_STRENGTH / 100) ** 2
  const margin = Math.ceil(2 + waterCurve * BRUSH_RADIUS * 0.6 + spreadCurve * BRUSH_RADIUS * 0.4)
  return {
    x0: Math.max(0, Math.floor(sx0 - BRUSH_RADIUS - margin)),
    y0: Math.max(0, Math.floor(sy0 - BRUSH_RADIUS - margin)),
    x1: Math.min(CANVAS_W - 1, Math.ceil(sx1 + BRUSH_RADIUS + margin)),
    y1: Math.min(CANVAS_H - 1, Math.ceil(sy1 + BRUSH_RADIUS + margin)),
  }
}

/** Column cross-section width: pixels with raw alpha at/above ALPHA_FLOOR */
function widthFromAlpha(wet: WetBuffers, col: number): number {
  let count = 0
  for (let y = 0; y < CANVAS_H; y++) {
    if (wet.alpha[y * CANVAS_W + col] >= ALPHA_FLOOR) count++
  }
  return count
}

/**
 * Column cross-section width at display visibility — mirrors
 * compositeWetLayer's per-pixel gates (alpha >= 1, strokeOpacity >= 0.001,
 * wetDisplayAlpha >= VISIBLE_THRESH).
 */
function widthVisible(wet: WetBuffers, col: number, paper: Float32Array | null): number {
  let count = 0
  for (let y = 0; y < CANVAS_H; y++) {
    const i = y * CANVAS_W + col
    if (wet.alpha[i] < 1) continue
    const so = wet.strokeOpacity[i] || 0
    if (so < 0.001) continue
    const h = sampleH(paper, col, y, CANVAS_W, CANVAS_H)
    if (wetDisplayAlpha(wet.alpha[i], so, h) >= VISIBLE_THRESH) count++
  }
  return count
}

function runCell(
  depositKind: 'transfer' | 'stamp',
  water01: number,
  spacing: number,
  paper: Float32Array | null,
): { deposit: WetBuffers; settled: WetBuffers; widths: { W_deposit: number; W_settle: number; W_visible: number } } {
  const curve = makeCurve(spacing)
  const wet = createWetBuffers(CANVAS_W * CANVAS_H)

  if (depositKind === 'transfer') {
    // Production path: paint.ts raster → transferToWetLayerClipped
    const bounds = makeRasterBounds()
    const imageData = makeRasterImageData(bounds)
    const fakeOffCtx = { getImageData: () => imageData }
    transferToWetLayerClipped(
      fakeOffCtx as never, wet, water01, bounds, CANVAS_W, CANVAS_H, paper,
    )
  } else {
    // Plan-prescribed reference path
    depositToWetLayer(
      curve, '#ff0000', BRUSH_RADIUS, DEFAULT_OPACITY, water01,
      wet, /* hasPenInput */ false, CANVAS_W, CANVAS_H,
      paper,
    )
  }
  const W_deposit = widthFromAlpha(wet, MID_X)

  // Settled copy — settle must not mutate the deposit-stage measurement
  const settled = createWetBuffers(CANVAS_W * CANVAS_H)
  settled.r.set(wet.r); settled.g.set(wet.g); settled.b.set(wet.b)
  settled.alpha.set(wet.alpha); settled.wetness.set(wet.wetness)
  settled.strokeOpacity.set(wet.strokeOpacity)

  localFluidPhysicsStep(
    settled, FLUID_CONFIG, CANVAS_W, CANVAS_H,
    engineLocalBbox(curve, water01), K_TICKS,
  )
  const W_settle = widthFromAlpha(settled, MID_X)
  const W_visible = widthVisible(settled, MID_X, paper)

  return { deposit: wet, settled, widths: { W_deposit, W_settle, W_visible } }
}

function digestAlpha(wet: WetBuffers): number[] {
  return Array.from(wet.alpha)
}

// === Contract pins (Task 2 RED) ===
/**
 * Pin-1 tolerance calibrated from Task 1 measurements: plan example
 * "<= 2px + antialiasing margin". Base W_visible = 9 at default water →
 * 9 > 6 + 2 = 8 fails RED with the inflation visible in the message.
 * Post-fix bound: RIBBON_W + PIN1_TOL = 8.
 */
const PIN1_TOL = 2
const PIN1_BOUND = RIBBON_W + PIN1_TOL

/** Production-path visible width at a given water level (dense, paper null) */
function visibleWidthAtWater(water01: number): number {
  return runCell('transfer', water01, SPACINGS[0].px, null).widths.W_visible
}

describe('physics settled footprint — stage-wise seam diagnosis', () => {
  it('measurement sweep: stage widths for every deposit × water × spacing × paper cell', () => {
    const results: CellResult[] = []
    const header = [
      'deposit', 'water', 'spacing', 'paper',
      'W_deposit', 'W_settle', 'W_visible',
      'd(a)=Wd-2r', 'd(b)=Ws-Wd', 'd(c)=Wv-Ws', 'total=Wv-2r',
    ].join('\t')
    const rows: string[] = [header]

    for (const dep of DEPOSITS) {
      const kind = dep.startsWith('transfer') ? 'transfer' : 'stamp'
      for (const water of WATERS) {
        for (const sp of SPACINGS) {
          for (const paperKind of PAPERS) {
            const paper = paperKind === 'synthetic' ? makeSyntheticPaper() : null
            const { widths } = runCell(kind, water / 100, sp.px, paper)
            results.push({ deposit: dep, water, spacing: sp.label, paper: paperKind, ...widths })
            const da = widths.W_deposit - RIBBON_W
            const db = widths.W_settle - widths.W_deposit
            const dc = widths.W_visible - widths.W_settle
            rows.push([
              dep, String(water), sp.label, paperKind,
              String(widths.W_deposit), String(widths.W_settle), String(widths.W_visible),
              String(da), String(db), String(dc), String(widths.W_visible - RIBBON_W),
            ].join('\t'))
          }
        }
      }
    }
    console.log(`\n[260924-m7w] stage-wise widths (r=${BRUSH_RADIUS}, 2r=${RIBBON_W}, K=${K_TICKS} local ticks, visible>=${VISIBLE_THRESH}, alphaFloor=${ALPHA_FLOOR})`)
    console.log(rows.join('\n'))

    // Verdict: at default water (50), the seam whose delta accounts for the
    // majority of (W_visible - 2r) is GUILTY. Evaluated per deposit path and
    // paper variant at dense spacing (engine-like sample rate).
    for (const dep of DEPOSITS) {
      for (const paperKind of PAPERS) {
        const cell = results.find(r => r.deposit === dep && r.water === 50 && r.spacing === 'dense' && r.paper === paperKind)!
        const total = cell.W_visible - RIBBON_W
        const deltas: Array<[string, number]> = [
          ['(a) deposit', cell.W_deposit - RIBBON_W],
          ['(b) fluid spread', cell.W_settle - cell.W_deposit],
          ['(c) display', cell.W_visible - cell.W_settle],
        ]
        const positive = deltas.filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1])
        const verdict = positive.length > 0 ? positive[0][0] : 'none (no inflation)'
        console.log(
          `[260924-m7w] VERDICT @ ${dep} water=50 dense paper=${paperKind}: total=${total}px ` +
          `d(a)=${deltas[0][1]} d(b)=${deltas[1][1]} d(c)=${deltas[2][1]} → GUILTY seam ${verdict}`,
        )
      }
    }

    // Harness sanity: every cell produced measurable ink at all three stages
    expect(results).toHaveLength(DEPOSITS.length * WATERS.length * SPACINGS.length * PAPERS.length)
    for (const r of results) {
      expect(r.W_deposit).toBeGreaterThan(0)
      expect(r.W_settle).toBeGreaterThan(0)
      expect(r.W_visible).toBeGreaterThan(0)
      expect(r.W_visible).toBeLessThanOrEqual(CANVAS_H)
    }
  })
})

describe('physics settled footprint — contract pins', () => {
  it('PIN 1: default-water W_visible stays within ribbon envelope + tolerance (2r + 2px)', () => {
    const nullPaper = runCell('transfer', DEFAULT_WATER, SPACINGS[0].px, null)
    const synthPaper = runCell('transfer', DEFAULT_WATER, SPACINGS[0].px, makeSyntheticPaper())
    const wNull = nullPaper.widths.W_visible
    const wSynth = synthPaper.widths.W_visible
    console.log(
      `[260924-m7w] PIN 1 base-state expectation: ribbon 2r=${RIBBON_W}, bound=${PIN1_BOUND} (2r+${PIN1_TOL}px). ` +
      `Measured @ water=50 dense: paper=null W_deposit=${nullPaper.widths.W_deposit} ` +
      `W_settle=${nullPaper.widths.W_settle} W_visible=${wNull}; ` +
      `paper=synthetic W_deposit=${synthPaper.widths.W_deposit} ` +
      `W_settle=${synthPaper.widths.W_settle} W_visible=${wSynth}. ` +
      `RED requires W_visible > bound (settled mark wider than the drawn ribbon).`,
    )
    expect(
      wNull,
      `PIN 1 FAIL base: default-water settled silhouette ${wNull}px exceeds ribbon envelope ` +
      `${RIBBON_W}px + ${PIN1_TOL}px tolerance (bound ${PIN1_BOUND}px) — seam (a) deposit keeps ` +
      `the raster AA fringe above the visibility floor`,
    ).toBeLessThanOrEqual(PIN1_BOUND)
    expect(
      wSynth,
      `PIN 1 FAIL base (synthetic paper): settled silhouette ${wSynth}px exceeds bound ${PIN1_BOUND}px`,
    ).toBeLessThanOrEqual(PIN1_BOUND)
  })

  it('PIN 2: waterAmount is the monotonic spread control — width(90) > width(50) > width(10)', () => {
    const w10 = visibleWidthAtWater(0.1)
    const w50 = visibleWidthAtWater(0.5)
    const w90 = visibleWidthAtWater(0.9)
    console.log(
      `[260924-m7w] PIN 2 base-state widths: water10=${w10} water50=${w50} water90=${w90} ` +
      `(contract: 90 > 50 > 10 strictly)`,
    )
    expect(
      w90,
      `PIN 2: width(90)=${w90} must be > width(50)=${w50}`,
    ).toBeGreaterThan(w50)
    expect(
      w50,
      `PIN 2: width(50)=${w50} must be > width(10)=${w10}`,
    ).toBeGreaterThan(w10)
  })

  it('PIN 3: identical deposit + settle inputs produce a byte-identical footprint (no boil)', () => {
    const runA = runCell('transfer', DEFAULT_WATER, SPACINGS[0].px, null)
    const runB = runCell('transfer', DEFAULT_WATER, SPACINGS[0].px, null)
    expect(digestAlpha(runA.deposit)).toEqual(digestAlpha(runB.deposit))
    expect(digestAlpha(runA.settled)).toEqual(digestAlpha(runB.settled))
  })
})
