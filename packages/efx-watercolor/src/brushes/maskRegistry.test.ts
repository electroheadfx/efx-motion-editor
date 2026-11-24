// ============================================================
//  maskRegistry — lifecycle law: reject, replace, reset, no ghost (63-01 / D-20).
//
//  Laws pinned here:
//    T-63-02  a mask whose length is not exactly TIP_MASK_BYTES can
//             never enter the registry
//    T-63-09  replace drops every prior id; reset leaves no stale
//             mask for buildBrushForStroke to resolve
//    identity resolveMask returns the EXACT registered array so the
//             live path and the bake path share one allocation
//    generation only a mutation bumps it — reads and rejected
//             writes never do
//    empty    there are no compile-time built-ins (quick 261116-inu):
//             a fresh registry is empty and resetMaskRegistry leaves
//             it empty
//
//  The registry is module-scoped, so every test starts from a reset.
//  Assertion style: scalar predicates (boolean/primitive toBe) so TAP
//  diagnostics stay one-line and the RED evidence classifier parses.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import {
  listRegisteredMaskIds,
  maskGeneration,
  registerMask,
  replaceMaskRegistry,
  resetMaskRegistry,
  resolveMask,
} from './maskRegistry'
import { TIP_MASK_BYTES } from './deriveMask'
import { buildBrushForStroke } from '../playground/brushBridge'
import { buildBrush, BRUSH_PRESETS } from '../playground/brushes'

function solidMask(value: number): Uint8Array {
  return new Uint8Array(TIP_MASK_BYTES).fill(value)
}

beforeEach(() => {
  resetMaskRegistry()
})

describe('registerMask — exact-length admission (T-63-02)', () => {
  it('accepts a mask of exactly TIP_MASK_BYTES', () => {
    expect(registerMask('wc/custom-ok', solidMask(128))).toBe(true)
  })

  it('rejects a mask one byte short and leaves the registry unchanged', () => {
    registerMask('wc/custom-keep', solidMask(90))
    const before = listRegisteredMaskIds().join(',')
    expect(registerMask('wc/custom-short', new Uint8Array(TIP_MASK_BYTES - 1))).toBe(false)
    expect(listRegisteredMaskIds().join(',')).toBe(before)
    expect(resolveMask('wc/custom-short') === null).toBe(true)
  })

  it('rejects a mask one byte long and leaves the registry unchanged', () => {
    expect(registerMask('wc/custom-long', new Uint8Array(TIP_MASK_BYTES + 1))).toBe(false)
    expect(resolveMask('wc/custom-long') === null).toBe(true)
  })

  it('a rejected overwrite never replaces the previously registered array', () => {
    const original = solidMask(200)
    expect(registerMask('wc/custom-keep', original)).toBe(true)
    expect(registerMask('wc/custom-keep', new Uint8Array(TIP_MASK_BYTES - 1))).toBe(false)
    expect(resolveMask('wc/custom-keep') === original).toBe(true)
  })

  it('rejects an empty id and a fresh registry lists nothing', () => {
    expect(listRegisteredMaskIds().length).toBe(0)
    expect(registerMask('', solidMask(10))).toBe(false)
    expect(listRegisteredMaskIds().length).toBe(0)
    expect(listRegisteredMaskIds().includes('')).toBe(false)
  })
})

describe('resolveMask — identity contract', () => {
  it('returns the exact registered array (one allocation shared by live and bake)', () => {
    const mask = solidMask(77)
    registerMask('wc/custom-identity', mask)
    expect(resolveMask('wc/custom-identity') === mask).toBe(true)
  })

  it('returns null for an unknown id', () => {
    expect(resolveMask('wc/custom-unknown') === null).toBe(true)
  })
})

describe('replaceMaskRegistry — replaces, never appends', () => {
  it('drops every prior entry, including ids absent from the new set', () => {
    registerMask('wc/custom-a', solidMask(10))
    registerMask('wc/custom-b', solidMask(20))
    const next = solidMask(30)
    replaceMaskRegistry([{ id: 'wc/custom-c', mask: next }])
    expect(resolveMask('wc/custom-a') === null).toBe(true)
    expect(resolveMask('wc/custom-b') === null).toBe(true)
    expect(resolveMask('wc/custom-c') === next).toBe(true)
    expect(listRegisteredMaskIds().join(',')).toBe('wc/custom-c')
  })

  it('refuses wrong-length entries individually and installs valid siblings (D-18)', () => {
    replaceMaskRegistry([
      { id: 'wc/custom-valid', mask: solidMask(120) },
      { id: 'wc/custom-invalid', mask: new Uint8Array(TIP_MASK_BYTES + 1) },
    ])
    expect(resolveMask('wc/custom-valid') === null).toBe(false)
    expect(resolveMask('wc/custom-invalid') === null).toBe(true)
    expect(listRegisteredMaskIds().join(',')).toBe('wc/custom-valid')
  })

  it('replaces with an empty set as a clean wipe', () => {
    registerMask('wc/custom-a', solidMask(10))
    replaceMaskRegistry([])
    expect(listRegisteredMaskIds().length).toBe(0)
    expect(resolveMask('wc/custom-a') === null).toBe(true)
  })
})

describe('replaceMaskRegistry — machine-library replacement', () => {
  it('installs a library list by identity and keeps every id resolvable', () => {
    const first = solidMask(41)
    const second = solidMask(42)
    replaceMaskRegistry([
      { id: 'wc/custom-library-a', mask: first },
      { id: 'wc/custom-library-b', mask: second },
    ])
    expect(resolveMask('wc/custom-library-a') === first).toBe(true)
    expect(resolveMask('wc/custom-library-b') === second).toBe(true)
    expect(listRegisteredMaskIds().join(',')).toBe('wc/custom-library-a,wc/custom-library-b')
  })
})

describe('resetMaskRegistry — no ghost mask', () => {
  it('leaves the registry empty and the previously registered id resolves to null', () => {
    registerMask('wc/custom-ghost', solidMask(64))
    resetMaskRegistry()
    expect(listRegisteredMaskIds().length).toBe(0)
    expect(resolveMask('wc/custom-ghost') === null).toBe(true)
  })

  it('after reset buildBrushForStroke returns the response tip, never the stale mask', () => {
    const mask = solidMask(64)
    registerMask('round', mask)
    const masked = buildBrushForStroke('round', { textureId: 'round' })
    expect(masked.tipMean).toBe(64 / 255)
    resetMaskRegistry()
    const afterReset = buildBrushForStroke('round', { textureId: 'round' })
    // Texture law: the response's procedural tip, not the stale 64/255 stamp.
    expect(afterReset.tipMean === 64 / 255).toBe(false)
    expect(afterReset.tipData.every((v) => v === 64)).toBe(false)
    expect(resolveMask('round') === null).toBe(true)
  })

  it('after a replace without the id, a texture falls back to the response tip', () => {
    registerMask('wc/custom-dropped', solidMask(30))
    replaceMaskRegistry([{ id: 'wc/custom-other', mask: solidMask(90) }])
    const brush = buildBrushForStroke('round', { textureId: 'wc/custom-dropped' })
    expect(brush.id).toBe('round')
    expect(brush.tipMean === 30 / 255).toBe(false)
  })
})

describe('maskGeneration — the one change signal', () => {
  it('advances on a successful register', () => {
    const before = maskGeneration()
    registerMask('wc/custom-gen', solidMask(50))
    expect(maskGeneration()).toBe(before + 1)
  })

  it('does not advance on a rejected register', () => {
    const before = maskGeneration()
    registerMask('wc/custom-bad', new Uint8Array(TIP_MASK_BYTES - 1))
    expect(maskGeneration()).toBe(before)
  })

  it('does not advance on reads', () => {
    registerMask('wc/custom-read', solidMask(50))
    const before = maskGeneration()
    resolveMask('wc/custom-read')
    listRegisteredMaskIds()
    expect(maskGeneration()).toBe(before)
  })

  it('advances on replace', () => {
    const before = maskGeneration()
    replaceMaskRegistry([{ id: 'wc/custom-gen2', mask: solidMask(50) }])
    expect(maskGeneration()).toBe(before + 1)
  })

  it('advances on reset', () => {
    const before = maskGeneration()
    resetMaskRegistry()
    expect(maskGeneration()).toBe(before + 1)
  })

  it('is monotonic across a register → replace → reset sequence', () => {
    const start = maskGeneration()
    registerMask('wc/custom-mon', solidMask(50))
    replaceMaskRegistry([{ id: 'wc/custom-mon', mask: solidMask(60) }])
    resetMaskRegistry()
    expect(maskGeneration()).toBe(start + 3)
  })
})

describe('registry builds — the response base is not forked by the texture', () => {
  it('a replaced array under the same id is the one buildBrushForStroke stamps', () => {
    registerMask('wc/custom-swap', solidMask(10))
    const first = buildBrushForStroke('round', { textureId: 'wc/custom-swap' })
    replaceMaskRegistry([{ id: 'wc/custom-swap', mask: solidMask(200) }])
    const second = buildBrushForStroke('round', { textureId: 'wc/custom-swap' })
    expect(first.tipMean).toBe(Math.max(0.01, 10 / 255))
    expect(second.tipMean).toBe(200 / 255)
    // quick-261115-oh9: the response owns the physics — 'round' stays round.
    const preset = BRUSH_PRESETS.find((b) => b.id === 'round')
    expect(preset === undefined).toBe(false)
    if (preset === undefined) return
    expect(second.spacing).toBe(preset.spacing)
  })

  it('the textured build equals buildBrush over the RESPONSE preset with the mask tip', () => {
    const mask = solidMask(99)
    registerMask('wc/custom-equal', mask)
    const viaBridge = buildBrushForStroke('bristle-round', { textureId: 'wc/custom-equal' })
    const preset = BRUSH_PRESETS.find((b) => b.id === 'bristle-round')
    expect(preset === undefined).toBe(false)
    if (preset === undefined) return
    const direct = buildBrush({ ...preset, tip: mask })
    expect(viaBridge.id).toBe('bristle-round')
    expect(viaBridge.tipMean).toBe(direct.tipMean)
    expect(viaBridge.spacing).toBe(direct.spacing)
    expect(viaBridge.tipSize).toBe(direct.tipSize)
  })

  it('a preset id with no registered mask keeps the exact preset brush shape', () => {
    const preset = BRUSH_PRESETS.find((b) => b.id === 'detail')
    expect(preset === undefined).toBe(false)
    if (preset === undefined) return
    const brush = buildBrushForStroke('wc/round-detail')
    expect(brush.id).toBe('detail')
  })
})
