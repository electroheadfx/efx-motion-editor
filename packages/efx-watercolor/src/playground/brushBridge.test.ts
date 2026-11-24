// ============================================================
//  brushBridge — the ONE live/bake mapping under the texture-axis law
//  (quick-261115-oh9 / supersedes the 63-01 TIP-05 mask-wins law).
//
//  Laws pinned here:
//    LAW 1  the RESPONSE owns the physics: `base = presetFor(brushId)`
//           and every Brush field except the footprint comes from that
//           preset, texture or no texture
//    LAW 2  the TEXTURE only replaces the footprint:
//           `tip = textureId ? resolveMask(textureId) ?? base.tip : base.tip`
//    LAW 3  an unknown or unavailable texture falls back to the
//           response's own procedural tip — never throws, never blanks
//    LAW 4  `strokeTipData` and `buildBrushForStroke` share ONE
//           resolution, so a chip can only ever show what stamps
//    D-21    the eight multipliers remain a response concern: they apply
//            to the preset base identically with or without a texture
//
//  Assertion style: scalar predicates (boolean/primitive toBe) so TAP
//  diagnostics stay one-line and the RED evidence classifier parses.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import { buildBrushForStroke, strokeTipData } from './brushBridge'
import { BRUSH_PRESETS, brushTipCacheKey, buildBrush, type BrushPreset } from './brushes'
import { deriveMask, TIP_MASK_BYTES, TIP_MASK_EDGE } from '../brushes/deriveMask'
import {
  registerMask,
  replaceMaskRegistry,
  resetMaskRegistry,
  resolveMask,
} from '../brushes/maskRegistry'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function solidMask(value: number): Uint8Array {
  return new Uint8Array(TIP_MASK_BYTES).fill(value)
}

/** A 192×192 RGBA buffer with one controlled pixel, everything else opaque white. */
function makeRgba(fill: [number, number, number, number]): Uint8Array {
  const rgba = new Uint8Array(TIP_MASK_BYTES * 4)
  for (let i = 0; i < TIP_MASK_BYTES; i++) {
    rgba[i * 4] = fill[0]
    rgba[i * 4 + 1] = fill[1]
    rgba[i * 4 + 2] = fill[2]
    rgba[i * 4 + 3] = fill[3]
  }
  return rgba
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function presetOf(id: string): BrushPreset {
  const preset = BRUSH_PRESETS.find((b) => b.id === id)
  if (!preset) throw new Error(`preset ${id} missing from BRUSH_PRESETS`)
  return preset
}

beforeEach(() => {
  resetMaskRegistry()
})

// ---------------------------------------------------------------------------
// deriveMask — the declared TIP_MASK_EDGE contract (branch law in deriveMask.test.ts)
// ---------------------------------------------------------------------------

describe('deriveMask (declared extent)', () => {
  it('yields exactly TIP_MASK_BYTES for a TIP_MASK_EDGE-square RGBA image', () => {
    const mask = deriveMask(makeRgba([255, 255, 255, 255]))
    expect(mask === null).toBe(false)
    if (mask === null) return
    expect(mask.length).toBe(TIP_MASK_BYTES)
    expect(TIP_MASK_BYTES).toBe(TIP_MASK_EDGE * TIP_MASK_EDGE)
  })

  it('returns null for any buffer whose length is not exactly TIP_MASK_EDGE²×4', () => {
    const short = new Uint8Array(TIP_MASK_BYTES * 4 - 1)
    const long = new Uint8Array(TIP_MASK_BYTES * 4 + 1)
    const empty = new Uint8Array(0)
    expect(deriveMask(short) === null).toBe(true)
    expect(deriveMask(long) === null).toBe(true)
    expect(deriveMask(empty) === null).toBe(true)
  })

  it('alpha branch: any alpha below 250 carries the alpha channel verbatim', () => {
    const rgba = makeRgba([255, 255, 255, 255])
    rgba[17 * 4 + 3] = 100
    const mask = deriveMask(rgba)
    expect(mask === null).toBe(false)
    if (mask === null) return
    expect(mask[17]).toBe(100)
    expect(mask[0]).toBe(255)
  })
})

// ---------------------------------------------------------------------------
// LAW 1 / LAW 2 — the response owns the physics, the texture the footprint
// ---------------------------------------------------------------------------

describe('buildBrushForStroke (texture-axis law)', () => {
  it('LAW 1: a bristle response keeps its physics when a texture is applied', () => {
    const bristle = presetOf('bristle-round')
    const brush = buildBrushForStroke('bristle-round', { textureId: 'wc/custom-chalk' })
    expect(brush.id).toBe('bristle-round')
    expect(brush.water).toBe(bristle.water)
    expect(brush.load).toBe(bristle.load)
    expect(brush.flow).toBe(bristle.flow)
    expect(brush.roughness).toBe(bristle.roughness)
    expect(brush.spacing).toBe(bristle.spacing)
    expect(brush.scatter).toBe(bristle.scatter)
    expect(brush.rotation).toBe(bristle.rotation)
  })

  it('LAW 2: round with a library texture stamps the registered bytes', () => {
    const mask = solidMask(19)
    expect(registerMask('wc/custom-bristle', mask)).toBe(true)
    expect(resolveMask('wc/custom-bristle') === mask).toBe(true)
    const brush = buildBrushForStroke('round', { textureId: 'wc/custom-bristle' })
    // A library mask is TIP_MASK_EDGE-square, so the derived tip edge follows it.
    expect(brush.tipSize).toBe(TIP_MASK_EDGE)
    expect(brush.tipData === mask).toBe(true)
  })

  it('LAW 2: the texture changes tipData only — response scalars stay the preset', () => {
    expect(registerMask('wc/custom-chalk', solidMask(19))).toBe(true)
    const plain = buildBrushForStroke('bristle-round')
    const textured = buildBrushForStroke('bristle-round', { textureId: 'wc/custom-chalk' })
    expect(sameBytes(plain.tipData, textured.tipData)).toBe(false)
    expect(textured.aspect).toBe(plain.aspect)
    expect(textured.size[0]).toBe(plain.size[0])
    expect(textured.size[1]).toBe(plain.size[1])
    expect(textured.pressureSize).toBe(plain.pressureSize)
    expect(textured.dabs).toBe(plain.dabs)
    expect(textured.stampJitter).toBe(plain.stampJitter)
  })

  it('LAW 3: an unknown texture id falls back to the response tip — no throw', () => {
    const fallback = buildBrushForStroke('round')
    const unknown = buildBrushForStroke('round', { textureId: 'wc/custom-missing' })
    expect(unknown.id).toBe('round')
    expect(sameBytes(unknown.tipData, fallback.tipData)).toBe(true)
    expect(unknown.tipMean).toBe(fallback.tipMean)
  })

  it('GPU identity: the texture rides the brush so its tip cache cannot collide', () => {
    // Engine.tipTexture caches the uploaded tip by brushTipCacheKey. If that key
    // were the response id alone, picking a second texture on the same response
    // would reuse the first uploaded tip forever (the live bug: "I can't change
    // the texture, it always the same").
    expect(registerMask('wc/custom-chalk', solidMask(19))).toBe(true)
    expect(registerMask('wc/custom-sponge', solidMask(23))).toBe(true)
    const plain = buildBrushForStroke('bristle-round')
    const textured = buildBrushForStroke('bristle-round', { textureId: 'wc/custom-chalk' })
    expect(plain.textureId).toBe(null)
    expect(textured.textureId).toBe('wc/custom-chalk')
    expect(brushTipCacheKey(plain) === brushTipCacheKey(textured)).toBe(false)
    // Two different textures on one response are two different GPU tips.
    const sponge = buildBrushForStroke('bristle-round', { textureId: 'wc/custom-sponge' })
    expect(brushTipCacheKey(textured) === brushTipCacheKey(sponge)).toBe(false)
  })

  it('GPU identity: an unknown texture keeps the response tip key', () => {
    // An unavailable texture stamps the response's own tip, so it must resolve
    // to the SAME cache entry — no duplicate upload, no phantom texture id.
    const plain = buildBrushForStroke('round')
    const unknown = buildBrushForStroke('round', { textureId: 'wc/custom-missing' })
    expect(unknown.textureId).toBe(null)
    expect(brushTipCacheKey(unknown)).toBe(brushTipCacheKey(plain))
  })

  it('LAW 3: a texture id absent from the replaced registry falls back the same way', () => {
    // A library replacement REPLACES the registry; when the new set omits an
    // id, a stroke naming it must still paint the response tip.
    replaceMaskRegistry([{ id: 'wc/custom-other', mask: solidMask(90) }])
    expect(resolveMask('wc/custom-chalk') === null).toBe(true)
    const fallback = buildBrushForStroke('bristle-round')
    const missing = buildBrushForStroke('bristle-round', { textureId: 'wc/custom-chalk' })
    expect(sameBytes(missing.tipData, fallback.tipData)).toBe(true)
  })

  it('no texture and an explicit null texture are byte-identical to buildBrush(preset)', () => {
    const direct = buildBrush(presetOf('round'))
    const absent = buildBrushForStroke('round')
    const explicitNull = buildBrushForStroke('round', { textureId: null })
    expect(sameBytes(absent.tipData, direct.tipData)).toBe(true)
    expect(absent.tipMean).toBe(direct.tipMean)
    expect(sameBytes(explicitNull.tipData, direct.tipData)).toBe(true)
    expect(explicitNull.tipMean).toBe(direct.tipMean)
  })

  it('an empty options bag keeps the response brush untouched', () => {
    const plain = buildBrushForStroke('flat')
    const empty = buildBrushForStroke('flat', {})
    expect(sameBytes(empty.tipData, plain.tipData)).toBe(true)
    expect(empty.spacing).toBe(plain.spacing)
    expect(empty.aspect).toBe(plain.aspect)
  })
})

// ---------------------------------------------------------------------------
// strokeTipData — the chip and the engine cannot drift
// ---------------------------------------------------------------------------

describe('strokeTipData (one resolution)', () => {
  it('is byte-equal to the builder tip for every preset × texture case', () => {
    // quick 261116-inu: no compile-time textures remain — the registered
    // fixture stands in for a machine-library row.
    registerMask('wc/custom-registered', solidMask(17))
    const textures: ReadonlyArray<string | null> = [
      null,
      'wc/custom-registered',
      'wc/custom-missing',
    ]
    for (const preset of BRUSH_PRESETS) {
      for (const textureId of textures) {
        const built = buildBrushForStroke(preset.id, { textureId })
        const tip = strokeTipData(preset.id, textureId)
        if (!sameBytes(tip, built.tipData)) {
          throw new Error(`strokeTipData drifted for ${preset.id} × ${textureId ?? 'default'}`)
        }
      }
    }
    expect(true).toBe(true)
  })

  it('resolves a registered custom texture through the same law', () => {
    const mask = solidMask(180)
    expect(registerMask('wc/custom-chip', mask)).toBe(true)
    const brush = buildBrushForStroke('bristle-round', { textureId: 'wc/custom-chip' })
    const tip = strokeTipData('bristle-round', 'wc/custom-chip')
    expect(tip === mask).toBe(true)
    expect(brush.tipData === tip).toBe(true)
  })

  it('honours an explicit seed on both paths', () => {
    const built = buildBrushForStroke('sponge', { textureId: 'wc/custom-sponge', seed: 31 })
    const tip = strokeTipData('sponge', 'wc/custom-sponge', 31)
    expect(sameBytes(tip, built.tipData)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// D-21 — multipliers stay a response concern, ungated by the texture
// ---------------------------------------------------------------------------

describe('multipliers (D-21 / D-22)', () => {
  it('applies the eight multipliers on the preset base with a texture present', () => {
    const bristle = presetOf('bristle-round')
    const brush = buildBrushForStroke('bristle-round', {
      textureId: 'wc/custom-chalk',
      overrides: { tip: 2, aspect: 3 },
    })
    expect(brush.spacing).toBe(bristle.spacing / 2)
    expect(brush.aspect).toBe(bristle.aspect * 3)
  })

  it('applies every multiplier to a textured brush exactly as to an untextured one', () => {
    const overrides = {
      tip: 1.5,
      aspect: 0.75,
      rotation: 2,
      sizeCurve: 1.25,
      scatter: 0.5,
      capacity: 1.75,
      grain: 2,
      wetRound: 0.5,
    }
    const plain = buildBrushForStroke('round', { overrides })
    const textured = buildBrushForStroke('round', { textureId: 'wc/custom-bristle', overrides })
    expect(textured.spacing).toBe(plain.spacing)
    expect(textured.aspect).toBe(plain.aspect)
    expect(textured.angle).toBe(plain.angle)
    expect(textured.pressureSize).toBe(plain.pressureSize)
    expect(textured.scatter).toBe(plain.scatter)
    expect(textured.capacity).toBe(plain.capacity)
    expect(textured.grain).toBe(plain.grain)
    expect(textured.wetRound).toBe(plain.wetRound)
  })

  it('a non-positive or non-finite multiplier keeps its base value', () => {
    const bristle = presetOf('bristle-round')
    const brush = buildBrushForStroke('bristle-round', {
      textureId: 'wc/custom-chalk',
      overrides: { tip: 0, aspect: Number.NaN, grain: -1 },
    })
    expect(brush.spacing).toBe(bristle.spacing)
    expect(brush.aspect).toBe(bristle.aspect)
    expect(brush.grain).toBe(bristle.grain)
  })
})

// ---------------------------------------------------------------------------
// quick 261116-inu — textureRotation rides the brush in integer DEGREES
// ---------------------------------------------------------------------------

describe('textureRotation (degrees, texture-gated)', () => {
  it('carries the requested integer degrees when a registered mask resolves', () => {
    expect(registerMask('wc/custom-rotated', solidMask(19))).toBe(true)
    const brush = buildBrushForStroke('bristle-round', {
      textureId: 'wc/custom-rotated',
      textureRotation: 37,
    })
    expect(brush.textureId).toBe('wc/custom-rotated')
    expect(brush.textureRotation).toBe(37)
  })

  it('defaults a textured, rotationless stroke to 0 degrees (absent is not undefined)', () => {
    expect(registerMask('wc/custom-flat', solidMask(19))).toBe(true)
    const brush = buildBrushForStroke('bristle-round', { textureId: 'wc/custom-flat' })
    expect(brush.textureRotation).toBe(0)
  })

  it('keeps textureRotation null whenever no mask supplied the bytes', () => {
    const plain = buildBrushForStroke('round')
    expect(plain.textureRotation).toBe(null)
    const explicitNull = buildBrushForStroke('round', { textureId: null, textureRotation: 37 })
    expect(explicitNull.textureRotation).toBe(null)
    const unknown = buildBrushForStroke('round', {
      textureId: 'wc/custom-missing',
      textureRotation: 37,
    })
    expect(unknown.textureRotation).toBe(null)
  })

  it('does not fork the GPU tip cache: rotation is a uniform, not a second upload', () => {
    expect(registerMask('wc/custom-uniform', solidMask(19))).toBe(true)
    const flat = buildBrushForStroke('bristle-round', { textureId: 'wc/custom-uniform' })
    const rotated = buildBrushForStroke('bristle-round', {
      textureId: 'wc/custom-uniform',
      textureRotation: 90,
    })
    expect(brushTipCacheKey(rotated)).toBe(brushTipCacheKey(flat))
  })

  it('leaves strokeTipData byte-identical for any rotation', () => {
    expect(registerMask('wc/custom-tip-rot', solidMask(19))).toBe(true)
    const upright = buildBrushForStroke('bristle-round', { textureId: 'wc/custom-tip-rot' })
    const turned = buildBrushForStroke('bristle-round', {
      textureId: 'wc/custom-tip-rot',
      textureRotation: 120,
    })
    expect(sameBytes(turned.tipData, upright.tipData)).toBe(true)
    expect(sameBytes(strokeTipData('bristle-round', 'wc/custom-tip-rot'), upright.tipData)).toBe(true)
  })
})
