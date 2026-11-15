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
import { BRUSH_PRESETS, TIP_SIZE, brushTipCacheKey, buildBrush, type BrushPreset } from './brushes'
import { deriveMask, TIP_MASK_BYTES } from '../brushes/deriveMask'
import {
  registerMask,
  replaceMaskRegistry,
  resetMaskRegistry,
  resolveMask,
} from '../brushes/maskRegistry'
import { BUILTIN_TIP_MASKS } from '../brushes/builtinTips'

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
// deriveMask — the declared 192×192 contract (branch law in deriveMask.test.ts)
// ---------------------------------------------------------------------------

describe('deriveMask (declared extent)', () => {
  it('yields exactly 36,864 bytes for a 192×192 RGBA image', () => {
    const mask = deriveMask(makeRgba([255, 255, 255, 255]))
    expect(mask === null).toBe(false)
    if (mask === null) return
    expect(mask.length).toBe(TIP_MASK_BYTES)
    expect(TIP_MASK_BYTES).toBe(36_864)
  })

  it('returns null for any buffer whose length is not exactly 192×192×4', () => {
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
  it('LAW 1: chalk keeps the chalk response when a texture is applied', () => {
    const chalk = presetOf('chalk')
    const brush = buildBrushForStroke('chalk', { textureId: 'wc/builtin-chalk' })
    expect(brush.id).toBe('chalk')
    expect(brush.water).toBe(chalk.water)
    expect(brush.load).toBe(chalk.load)
    expect(brush.flow).toBe(chalk.flow)
    expect(brush.roughness).toBe(chalk.roughness)
    expect(brush.spacing).toBe(chalk.spacing)
    expect(brush.scatter).toBe(chalk.scatter)
    expect(brush.rotation).toBe(chalk.rotation)
  })

  it('LAW 2: round with the bristle texture stamps the registered bristle bytes', () => {
    const mask = resolveMask('wc/builtin-bristle')
    expect(mask === null).toBe(false)
    const brush = buildBrushForStroke('round', { textureId: 'wc/builtin-bristle' })
    expect(brush.tipSize).toBe(TIP_SIZE)
    expect(mask !== null && brush.tipData === mask).toBe(true)
  })

  it('LAW 2: the texture changes tipData only — response scalars stay the preset', () => {
    const plain = buildBrushForStroke('chalk')
    const textured = buildBrushForStroke('chalk', { textureId: 'wc/builtin-chalk' })
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
    const plain = buildBrushForStroke('chalk')
    const textured = buildBrushForStroke('chalk', { textureId: 'wc/builtin-chalk' })
    expect(plain.textureId).toBe(null)
    expect(textured.textureId).toBe('wc/builtin-chalk')
    expect(brushTipCacheKey(plain) === brushTipCacheKey(textured)).toBe(false)
    // Two different textures on one response are two different GPU tips.
    const sponge = buildBrushForStroke('chalk', { textureId: 'wc/builtin-sponge' })
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

  it('LAW 3: a built-in texture id absent from the registry falls back the same way', () => {
    // A project open REPLACES the registry; when the open set omits the
    // built-ins, a stroke naming one must still paint the response tip.
    replaceMaskRegistry([{ id: 'wc/custom-other', mask: solidMask(90) }])
    expect(resolveMask('wc/builtin-chalk') === null).toBe(true)
    const fallback = buildBrushForStroke('chalk')
    const missing = buildBrushForStroke('chalk', { textureId: 'wc/builtin-chalk' })
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
    const textures: ReadonlyArray<string | null> = [
      null,
      ...BUILTIN_TIP_MASKS.map((entry) => entry.id),
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
    const brush = buildBrushForStroke('chalk', { textureId: 'wc/custom-chip' })
    const tip = strokeTipData('chalk', 'wc/custom-chip')
    expect(tip === mask).toBe(true)
    expect(brush.tipData === tip).toBe(true)
  })

  it('honours an explicit seed on both paths', () => {
    const built = buildBrushForStroke('sponge', { textureId: 'wc/builtin-sponge', seed: 31 })
    const tip = strokeTipData('sponge', 'wc/builtin-sponge', 31)
    expect(sameBytes(tip, built.tipData)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// D-21 — multipliers stay a response concern, ungated by the texture
// ---------------------------------------------------------------------------

describe('multipliers (D-21 / D-22)', () => {
  it('applies the eight multipliers on the preset base with a texture present', () => {
    const chalk = presetOf('chalk')
    const brush = buildBrushForStroke('chalk', {
      textureId: 'wc/builtin-chalk',
      overrides: { tip: 2, aspect: 3 },
    })
    expect(brush.spacing).toBe(chalk.spacing / 2)
    expect(brush.aspect).toBe(chalk.aspect * 3)
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
    const textured = buildBrushForStroke('round', { textureId: 'wc/builtin-bristle', overrides })
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
    const chalk = presetOf('chalk')
    const brush = buildBrushForStroke('chalk', {
      textureId: 'wc/builtin-chalk',
      overrides: { tip: 0, aspect: Number.NaN, grain: -1 },
    })
    expect(brush.spacing).toBe(chalk.spacing)
    expect(brush.aspect).toBe(chalk.aspect)
    expect(brush.grain).toBe(chalk.grain)
  })
})
