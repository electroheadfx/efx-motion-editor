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
//    WR-05    the three built-in ids are reserved: registerMask can
//             never install one, and a refused registration mutates
//             nothing and bumps nothing; replace admits a built-in id
//             only with the exact compile-time allocation
//
//  The registry is module-scoped, so every test starts from a reset.
//  Assertion style: scalar predicates (boolean/primitive toBe) so TAP
//  diagnostics stay one-line and the RED evidence classifier parses.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  listRegisteredMaskIds,
  maskGeneration,
  registerMask,
  replaceMaskRegistry,
  resetMaskRegistry,
  resolveMask,
} from './maskRegistry'
import { TIP_MASK_BYTES } from './deriveMask'
import { BUILTIN_TIP_MASKS } from './builtinTips'
import { buildBrushForStroke } from '../playground/brushBridge'
import { buildBrush, BRUSH_PRESETS, CUSTOM_BASE } from '../playground/brushes'

function solidMask(value: number): Uint8Array {
  return new Uint8Array(TIP_MASK_BYTES).fill(value)
}

beforeEach(() => {
  resetMaskRegistry()
})

describe('registerMask — exact-length admission (T-63-02)', () => {
  it('accepts a mask of exactly 36,864 bytes', () => {
    expect(registerMask('wc/custom-ok', solidMask(128))).toBe(true)
  })

  it('rejects a mask of 36,863 bytes and leaves the registry unchanged', () => {
    registerMask('wc/custom-keep', solidMask(90))
    const before = listRegisteredMaskIds().join(',')
    expect(registerMask('wc/custom-short', new Uint8Array(TIP_MASK_BYTES - 1))).toBe(false)
    expect(listRegisteredMaskIds().join(',')).toBe(before)
    expect(resolveMask('wc/custom-short') === null).toBe(true)
  })

  it('rejects a mask of 36,865 bytes and leaves the registry unchanged', () => {
    expect(registerMask('wc/custom-long', new Uint8Array(TIP_MASK_BYTES + 1))).toBe(false)
    expect(resolveMask('wc/custom-long') === null).toBe(true)
  })

  it('a rejected overwrite never replaces the previously registered array', () => {
    const original = solidMask(200)
    expect(registerMask('wc/custom-keep', original)).toBe(true)
    expect(registerMask('wc/custom-keep', new Uint8Array(TIP_MASK_BYTES - 1))).toBe(false)
    expect(resolveMask('wc/custom-keep') === original).toBe(true)
  })

  it('rejects an empty id', () => {
    expect(registerMask('', solidMask(10))).toBe(false)
    // The registry always carries the three built-ins (63-03); only the
    // empty id is absent.
    expect(listRegisteredMaskIds().length).toBe(3)
    expect(listRegisteredMaskIds().includes('')).toBe(false)
  })
})

describe('registerMask — built-in ids are reserved (WR-05)', () => {
  it('refuses all three built-in ids, logs each, and never mutates or bumps', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const before = maskGeneration()
      for (const builtin of BUILTIN_TIP_MASKS) {
        const shipped = resolveMask(builtin.id)
        expect(shipped === builtin.mask).toBe(true)
        expect(registerMask(builtin.id, solidMask(11))).toBe(false)
        expect(resolveMask(builtin.id) === shipped).toBe(true)
      }
      expect(maskGeneration()).toBe(before)
      expect(warn.mock.calls.length).toBe(BUILTIN_TIP_MASKS.length)
      const logged = warn.mock.calls.map((call) => String(call[0])).join('\n')
      for (const builtin of BUILTIN_TIP_MASKS) {
        expect(logged.includes(builtin.id)).toBe(true)
      }
    } finally {
      warn.mockRestore()
    }
  })

  it('a custom id still registers and resolves by identity', () => {
    const mask = solidMask(33)
    expect(registerMask('wc/custom-not-reserved', mask)).toBe(true)
    expect(resolveMask('wc/custom-not-reserved') === mask).toBe(true)
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

describe('replaceMaskRegistry — built-in ids admit only the compile-time allocation (WR-05)', () => {
  it('a built-ins-first list keeps all three built-ins resolvable by identity', () => {
    replaceMaskRegistry([...BUILTIN_TIP_MASKS])
    for (const builtin of BUILTIN_TIP_MASKS) {
      expect(resolveMask(builtin.id) === builtin.mask).toBe(true)
    }
    expect(listRegisteredMaskIds().join(',')).toBe(
      'wc/builtin-bristle,wc/builtin-chalk,wc/builtin-sponge',
    )
  })

  it('refuses a later equal-bytes shadow and still installs a custom sibling', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const chalk = BUILTIN_TIP_MASKS.find((builtin) => builtin.id === 'wc/builtin-chalk')
      expect(chalk === undefined).toBe(false)
      if (chalk === undefined) return
      const copy = new Uint8Array(chalk.mask)
      expect(copy === chalk.mask).toBe(false)
      expect(copy.length).toBe(chalk.mask.length)
      const sibling = solidMask(42)
      replaceMaskRegistry([
        ...BUILTIN_TIP_MASKS,
        { id: 'wc/builtin-chalk', mask: copy },
        { id: 'wc/custom-sibling', mask: sibling },
      ])
      expect(resolveMask('wc/builtin-chalk') === chalk.mask).toBe(true)
      expect(resolveMask('wc/builtin-chalk') === copy).toBe(false)
      expect(resolveMask('wc/custom-sibling') === sibling).toBe(true)
      expect(warn.mock.calls.length).toBe(1)
      expect(String(warn.mock.calls[0]?.[0]).includes('wc/builtin-chalk')).toBe(true)
    } finally {
      warn.mockRestore()
    }
  })

  it('refuses a wrong-length built-in entry and keeps the shipped allocation', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const sponge = BUILTIN_TIP_MASKS.find((builtin) => builtin.id === 'wc/builtin-sponge')
      expect(sponge === undefined).toBe(false)
      if (sponge === undefined) return
      replaceMaskRegistry([
        ...BUILTIN_TIP_MASKS,
        { id: 'wc/builtin-sponge', mask: new Uint8Array(TIP_MASK_BYTES - 1) },
      ])
      expect(resolveMask('wc/builtin-sponge') === sponge.mask).toBe(true)
      expect(warn.mock.calls.length).toBe(1)
      expect(String(warn.mock.calls[0]?.[0]).includes('wc/builtin-sponge')).toBe(true)
    } finally {
      warn.mockRestore()
    }
  })

  it('a foreign-only built-in id never resolves to the foreign array', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const bristle = BUILTIN_TIP_MASKS.find((builtin) => builtin.id === 'wc/builtin-bristle')
      expect(bristle === undefined).toBe(false)
      if (bristle === undefined) return
      const foreign = solidMask(200)
      replaceMaskRegistry([{ id: 'wc/builtin-bristle', mask: foreign }])
      expect(resolveMask('wc/builtin-bristle') === foreign).toBe(false)
      expect(warn.mock.calls.length).toBe(1)
      expect(String(warn.mock.calls[0]?.[0]).includes('wc/builtin-bristle')).toBe(true)
    } finally {
      warn.mockRestore()
    }
  })
})

describe('resetMaskRegistry — no ghost mask', () => {
  it('restores exactly the three built-ins and the previously registered id resolves to null', () => {
    registerMask('wc/custom-ghost', solidMask(64))
    resetMaskRegistry()
    expect(listRegisteredMaskIds().join(',')).toBe(
      'wc/builtin-bristle,wc/builtin-chalk,wc/builtin-sponge',
    )
    expect(resolveMask('wc/builtin-bristle')?.length).toBe(TIP_MASK_BYTES)
    expect(resolveMask('wc/custom-ghost') === null).toBe(true)
  })

  it('after reset buildBrushForStroke returns the preset brush, never the stale mask', () => {
    const mask = solidMask(64)
    registerMask('round', mask)
    const masked = buildBrushForStroke('round')
    expect(masked.tipMean).toBe(64 / 255)
    resetMaskRegistry()
    const afterReset = buildBrushForStroke('round')
    // Preset path: the procedural round tip, not the stale 64/255 stamp.
    expect(afterReset.tipMean === 64 / 255).toBe(false)
    expect(afterReset.tipData.every((v) => v === 64)).toBe(false)
    expect(resolveMask('round') === null).toBe(true)
  })

  it('after a replace without the id, buildBrushForStroke falls back to the preset path', () => {
    registerMask('wc/custom-dropped', solidMask(30))
    replaceMaskRegistry([{ id: 'wc/custom-other', mask: solidMask(90) }])
    const brush = buildBrushForStroke('wc/custom-dropped')
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

describe('registry builds — base and multipliers are not forked by the mask', () => {
  it('a replaced array under the same id is the one buildBrushForStroke stamps', () => {
    registerMask('wc/custom-swap', solidMask(10))
    const first = buildBrushForStroke('wc/custom-swap')
    replaceMaskRegistry([{ id: 'wc/custom-swap', mask: solidMask(200) }])
    const second = buildBrushForStroke('wc/custom-swap')
    expect(first.tipMean).toBe(Math.max(0.01, 10 / 255))
    expect(second.tipMean).toBe(200 / 255)
    expect(second.spacing).toBe(CUSTOM_BASE.spacing)
  })

  it('the CUSTOM_BASE build equals buildBrush over the same assembled preset', () => {
    const mask = solidMask(99)
    registerMask('wc/custom-equal', mask)
    const viaBridge = buildBrushForStroke('wc/custom-equal')
    const direct = buildBrush({ ...CUSTOM_BASE, id: 'wc/custom-equal', name: 'wc/custom-equal', hint: '', tip: mask })
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
