// ============================================================
//  SPIKE 006 — the sheet-state helpers shared by the Q1 probe and the Q3 probe.
//
//  ONE decode, ONE encode, ONE render: the two entry points must never drift,
//  or a number from one would not be comparable with a number from the other.
// ============================================================

import { WatercolorEngine } from '../../../../packages/efx-watercolor/src/playground/Engine'
import { fromHalf, toHalf } from '../../../../packages/efx-watercolor/src/playground/half'
import * as law from './law'

// --- deterministic RNG ------------------------------------------------------

export const seededRandom = (seed: number): (() => number) => {
  let state = (seed | 0) || 1
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const withSeededMathRandom = <T,>(seed: number, fn: () => T): T => {
  const original = Math.random
  const rng = seededRandom(seed)
  Math.random = () => rng()
  try { return fn() } finally { Math.random = original }
}

// --- the engine tap ---------------------------------------------------------

let captured: WatercolorEngine | null = null

/** Wrap `setManual` so the adapter's own engine is reachable. */
export function tapEngine(): void {
  const proto = WatercolorEngine.prototype as unknown as { setManual: (v: boolean) => void }
  const original = proto.setManual
  proto.setManual = function patched(this: WatercolorEngine, manual: boolean) {
    if (manual && captured === null) captured = this
    return original.call(this, manual)
  }
}

export const capturedEngine = () => captured

/** A direct construction canary: the adapter fails closed on any engine error. */
export function canary(seed: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const engine = withSeededMathRandom(seed, () => new WatercolorEngine(canvas, null, {}, [64, 64]))
  try {
    const gl = (engine as unknown as { gl: WebGL2RenderingContext }).gl
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    const base = String(gl.getParameter(gl.RENDERER))
    if (!dbg) return base
    return `${base} | ${String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL))} | ${String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))}`
  } finally {
    engine.destroy()
  }
}

// --- the sheet state --------------------------------------------------------

/** A full-sheet absorbance state: the mobile and settled pools summed, as displayFS sums them. */
export interface SheetState {
  w: number
  h: number
  a: Float32Array // 4 coefficients per texel
  b: Float32Array // 3 coefficients per texel
  s: Float32Array // scattering S
  cover: Float32Array
}

export const blankSheet = (w: number, h: number): SheetState => ({
  w, h,
  a: new Float32Array(w * h * 4),
  b: new Float32Array(w * h * 3),
  s: new Float32Array(w * h),
  cover: new Float32Array(w * h),
})

export const copySheet = (src: SheetState): SheetState => ({
  w: src.w, h: src.h,
  a: src.a.slice(), b: src.b.slice(), s: src.s.slice(), cover: src.cover.slice(),
})

/** Decode a captured snapshot into a full-sheet state (unpainted texels stay zero). */
export function decodeSheet(snapshot: unknown): SheetState {
  const snap = snapshot as {
    whole: { w: number; h: number; rect: { x0: number; y0: number; x1: number; y1: number } | null; layers: Record<string, Uint16Array> }
  }
  const { w, h, rect, layers } = snap.whole
  const out = blankSheet(w, h)
  if (!rect) return out
  const rw = rect.x1 - rect.x0
  const rh = rect.y1 - rect.y0
  const inkA = layers.inkA!, inkB = layers.inkB!, fixA = layers.fixedA!, fixB = layers.fixedB!, cover = layers.cover!
  for (let ry = 0; ry < rh; ry++) {
    const y = rect.y0 + ry
    for (let rx = 0; rx < rw; rx++) {
      const o = y * w + (rect.x0 + rx)
      const si = (ry * rw + rx) * 4
      for (let c = 0; c < 4; c++) out.a[o * 4 + c] = fromHalf(inkA[si + c]!) + fromHalf(fixA[si + c]!)
      for (let c = 0; c < 3; c++) out.b[o * 3 + c] = fromHalf(inkB[si + c]!) + fromHalf(fixB[si + c]!)
      out.s[o] = fromHalf(inkB[si + 3]!) + fromHalf(fixB[si + 3]!)
      // the cover layer is ONE channel per texel (readHalf's `channels = 1` path)
      out.cover[o] = fromHalf(cover[ry * rw + rx]!)
    }
  }
  return out
}

/** One reusable state, to keep the per-texel loops allocation-free. */
export const scratch = law.makeState([0, 0, 0, 0], [0, 0, 0], 0)

export function stateInto(out: law.State, sheet: SheetState, x: number, y: number): law.State {
  const o = y * sheet.w + x
  for (let c = 0; c < 4; c++) out.a[c] = sheet.a[o * 4 + c]!
  for (let c = 0; c < 3; c++) out.b[c] = sheet.b[o * 3 + c]!
  out.s = sheet.s[o]!
  return out
}

/** Read a state out of a sheet into a fresh State (a copy). */
export function stateAt(sheet: SheetState, x: number, y: number): law.State {
  const o = y * sheet.w + x
  return law.makeState(
    [0, 1, 2, 3].map((c) => sheet.a[o * 4 + c]!),
    [0, 1, 2].map((c) => sheet.b[o * 3 + c]!),
    sheet.s[o]!,
  )
}

/**
 * Build a restorable snapshot from a full-sheet state. `pool` decides where the
 * paint lands: the mobile pool (the dab's `ink`), the settled pool (`fixed`), or
 * both at half strength. The display sums them, so the band law is identical —
 * the pools only matter to the wet transport and to what a later stroke reads.
 */
export function encodeSnapshot(
  sheet: SheetState,
  pool: 'mobile' | 'settled' | 'both' = 'mobile',
  /** standing water the restored sheet carries — the wet transport needs it. */
  wetFill = 0,
  /**
   * The engine's in-place write-back form: `settled` goes in the settled pool
   * and `sheet − settled` in the mobile pool, so the display's `ink + fixed`
   * sum is `sheet` again (the merge writes `fit − fixed` and leaves `fixed`
   * alone). Overrides `pool` when given.
   */
  settled?: SheetState,
) {
  const { w, h } = sheet
  const n = w * h
  const mobileA = new Uint16Array(n * 4)
  const mobileB = new Uint16Array(n * 4)
  const settledA = new Uint16Array(n * 4)
  const settledB = new Uint16Array(n * 4)
  const cover = new Uint16Array(n * 4)
  // Water follows the paint (a wet stroke leaves water where it painted), so
  // the wet field has a GRADIENT at the mark's edge. A uniform fill has none,
  // and the transport then moves nothing — measured, and a dead experiment.
  const wet = new Uint16Array(n * 4)
  const share = pool === 'both' ? 0.5 : 1
  for (let i = 0; i < n; i++) {
    if (settled) {
      for (let c = 0; c < 4; c++) {
        settledA[i * 4 + c] = toHalf(settled.a[i * 4 + c]!)
        mobileA[i * 4 + c] = toHalf(sheet.a[i * 4 + c]! - settled.a[i * 4 + c]!)
      }
      for (let c = 0; c < 3; c++) {
        settledB[i * 4 + c] = toHalf(settled.b[i * 3 + c]!)
        mobileB[i * 4 + c] = toHalf(sheet.b[i * 3 + c]! - settled.b[i * 3 + c]!)
      }
      settledB[i * 4 + 3] = toHalf(settled.s[i]!)
      mobileB[i * 4 + 3] = toHalf(sheet.s[i]! - settled.s[i]!)
    } else {
      for (let c = 0; c < 4; c++) {
        const v = toHalf(sheet.a[i * 4 + c]! * share)
        if (pool !== 'settled') mobileA[i * 4 + c] = v
        if (pool !== 'mobile') settledA[i * 4 + c] = v
      }
      for (let c = 0; c < 3; c++) {
        const v = toHalf(sheet.b[i * 3 + c]! * share)
        if (pool !== 'settled') mobileB[i * 4 + c] = v
        if (pool !== 'mobile') settledB[i * 4 + c] = v
      }
      const sv = toHalf(sheet.s[i]! * share)
      if (pool !== 'settled') mobileB[i * 4 + 3] = sv
      if (pool !== 'mobile') settledB[i * 4 + 3] = sv
    }
    cover[i * 4] = toHalf(Math.min(Math.max(sheet.cover[i]!, 0), 1))
    const density = Math.min(1, Math.abs(sheet.a[i * 4]!) + Math.abs(sheet.a[i * 4 + 1]!) + Math.abs(sheet.a[i * 4 + 2]!))
    wet[i * 4] = toHalf(wetFill * density)
  }
  return {
    whole: {
      w, h,
      rect: { x0: 0, y0: 0, x1: w, y1: h },
      layers: {
        inkA: mobileA, inkB: mobileB,
        fixedA: settledA, fixedB: settledB,
        wet, relief: new Uint16Array(n * 4), cover,
        lastTouch: new Float32Array(n).fill(1e6),
      },
    },
    bristleContent: false,
    wetPeak: wetFill,
    wetAgo: 0,
  }
}

export type EnginePriv = {
  readback(flat: boolean, mode?: number, texture?: boolean): Uint8Array
  captureSheet(): unknown
  restoreSheet(s: unknown): boolean
  resetSheet(): void
  setParams(p: Record<string, number>): void
}

export function renderState(engine: EnginePriv, sheet: SheetState, pool: 'mobile' | 'settled' | 'both' = 'mobile'): Uint8Array {
  if (!engine.restoreSheet(encodeSnapshot(sheet, pool))) throw new Error('restoreSheet refused the encoded snapshot')
  return engine.readback(true, 2) // flat = true, MODE.transparent
}

export const pixelOf = (buf: Uint8Array, w: number, x: number, y: number): [number, number, number] => {
  const i = (y * w + x) * 4
  return [buf[i]!, buf[i + 1]!, buf[i + 2]!]
}
