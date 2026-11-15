// ============================================================
//  builtinTips — the invariant law of the three compile-time tips (63-03).
//
//  Laws pinned here:
//    D-07   exactly three ids and labels: wc/builtin-bristle
//           "Bristle fan", wc/builtin-chalk "Chalk grain",
//           wc/builtin-sponge "Sponge"
//    T-63-14 every mask is exactly 36,864 bytes, decoded once at
//           module load, and the registry resolves it with NO
//           reset call first
//    D-20   reset after a custom registration restores exactly
//           the three built-ins, with the same array allocation
//    the built-in set and the project entry set are separate
//           exports: no project entry list ever contains a
//           built-in id
//
//  Assertion style: scalar predicates (boolean/primitive toBe) so
//  TAP diagnostics stay one-line and the RED evidence classifier
//  parses.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BUILTIN_TIP_MASKS,
  BUILTIN_TIPS,
} from './builtinTips'
import { TIP_MASK_BYTES } from './deriveMask'
import {
  listRegisteredMaskIds,
  registerMask,
  resetMaskRegistry,
  resolveMask,
} from './maskRegistry'
import { NEUTRAL_TOOL_OVERRIDES, TIPS, TOOL_OVERRIDE_FIELDS } from './tips'
import { buildBrushPackSnapshot } from './pack'

const BUILTIN_IDS = 'wc/builtin-bristle,wc/builtin-chalk,wc/builtin-sponge'

beforeEach(() => {
  resetMaskRegistry()
})

describe('BUILTIN_TIPS — exactly three frozen texture records (D-07)', () => {
  it('is exactly three records', () => {
    expect(BUILTIN_TIPS.length).toBe(3)
  })

  it('carries the exact ids in the documented order', () => {
    expect(BUILTIN_TIPS.map((tip) => tip.id).join(',')).toBe(BUILTIN_IDS)
  })

  it('carries the exact labels from the D-07 mapping', () => {
    expect(BUILTIN_TIPS.map((tip) => tip.name).join('|')).toBe('Bristle fan|Chalk grain|Sponge')
  })

  it('every record is frozen, and the list itself is frozen', () => {
    expect(Object.isFrozen(BUILTIN_TIPS)).toBe(true)
    expect(BUILTIN_TIPS.every((tip) => Object.isFrozen(tip))).toBe(true)
  })

  it('every built-in is category texture', () => {
    expect(BUILTIN_TIPS.every((tip) => tip.category === 'texture')).toBe(true)
  })

  it('every built-in carries the eight neutral multipliers', () => {
    let allNeutral = true
    for (const tip of BUILTIN_TIPS) {
      for (const field of TOOL_OVERRIDE_FIELDS) {
        if (tip[field] !== NEUTRAL_TOOL_OVERRIDES[field]) allNeutral = false
      }
    }
    expect(allNeutral).toBe(true)
  })
})

describe('BUILTIN_TIP_MASKS — decoded once, exact length (T-63-14)', () => {
  it('has one mask entry per built-in tip, same ids and order', () => {
    expect(BUILTIN_TIP_MASKS.map((entry) => entry.id).join(',')).toBe(
      BUILTIN_TIPS.map((tip) => tip.id).join(','),
    )
  })

  it('every mask is exactly 36,864 bytes and the entries are frozen', () => {
    expect(BUILTIN_TIP_MASKS.every((entry) => entry.mask.length === TIP_MASK_BYTES)).toBe(true)
    expect(Object.isFrozen(BUILTIN_TIP_MASKS)).toBe(true)
    expect(BUILTIN_TIP_MASKS.every((entry) => Object.isFrozen(entry))).toBe(true)
  })
})

describe('registry seeding — built-ins resolve with no reset call', () => {
  it('a module-fresh registry resolves every built-in immediately after import', async () => {
    vi.resetModules()
    const fresh = await import('./maskRegistry')
    // No reset, no register: this is module-init state.
    expect(fresh.listRegisteredMaskIds().join(',')).toBe(BUILTIN_IDS)
    for (const builtin of BUILTIN_TIP_MASKS) {
      const mask = fresh.resolveMask(builtin.id)
      expect(mask === null).toBe(false)
      expect(mask?.length).toBe(TIP_MASK_BYTES)
    }
  })
})

describe('resetMaskRegistry — restores exactly the three built-ins (D-20)', () => {
  it('after a custom registration, reset leaves exactly the built-in ids', () => {
    registerMask('wc/custom-probe', new Uint8Array(TIP_MASK_BYTES).fill(9))
    expect(listRegisteredMaskIds().includes('wc/custom-probe')).toBe(true)
    resetMaskRegistry()
    expect(listRegisteredMaskIds().join(',')).toBe(BUILTIN_IDS)
    expect(resolveMask('wc/custom-probe') === null).toBe(true)
  })

  it('reset installs the same array allocations the module decoded', () => {
    registerMask('wc/custom-probe', new Uint8Array(TIP_MASK_BYTES).fill(9))
    resetMaskRegistry()
    let identity = true
    for (const builtin of BUILTIN_TIP_MASKS) {
      if (resolveMask(builtin.id) !== builtin.mask) identity = false
    }
    expect(identity).toBe(true)
  })
})

describe('built-in set vs project entry set — separate exports', () => {
  it('the shipped project tip list contains no built-in id', () => {
    const projectIds = new Set(TIPS.map((tip) => tip.id))
    expect(BUILTIN_TIPS.every((tip) => projectIds.has(tip.id) === false)).toBe(true)
  })

  it('a brush-pack snapshot built from the project tips contains no built-in id', () => {
    const snapshot = buildBrushPackSnapshot(TIPS)
    expect(snapshot === null).toBe(false)
    const entries = (snapshot?.entries ?? []) as readonly { id: string }[]
    const entryIds = new Set(entries.map((entry) => entry.id))
    expect(BUILTIN_TIPS.every((tip) => entryIds.has(tip.id) === false)).toBe(true)
  })

  it('the tip records carry no mask payload: the sets are distinct exports', () => {
    expect(BUILTIN_TIPS.every((tip) => 'mask' in tip === false)).toBe(true)
    expect(BUILTIN_TIP_MASKS.every((entry) => 'name' in entry === false)).toBe(true)
  })
})
