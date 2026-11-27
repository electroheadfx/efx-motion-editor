// ============================================================
//  Brush groups (Phase 64, MED-26 / MED-27 / MED-29).
//
//  Every restated literal here is deliberate: the classification
//  table, the eleven legacy ids in their current order, the two
//  appended ids, the acrylic presets' overridden fields against
//  the recorded spec table, and each response's landing bag
//  (quick 261124-tje). A drifted number fails the pin.
//
//  The group helpers are read through a namespace import and a
//  local cast, so a missing export fails as an assertion in each
//  test instead of an ESM "does not provide an export named"
//  load error (which would make the TDD RED evidence invalid).
// ============================================================

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as brushesModule from './brushes'
import { BRUSH_PRESETS, CUSTOM_BASE, TIP_SIZE, buildBrush, isBristleResponse } from './brushes'
import type { BrushPreset } from './brushes'

type MediumIdLike = 'watercolor' | 'acrylic'

interface BrushSection {
  group: MediumIdLike
  presets: BrushPreset[]
}

interface GroupHelpers {
  brushGroupOrder?: readonly MediumIdLike[]
  brushGroupLabels?: Readonly<Record<MediumIdLike, string>>
  brushGroupOf?: (preset: BrushPreset) => MediumIdLike
  brushSections?: (presets: BrushPreset[]) => BrushSection[]
}

const helpers = brushesModule as unknown as GroupHelpers

/** Fail as an assertion (never a TypeError) when a helper is absent. */
function groupOrder(): readonly MediumIdLike[] {
  expect(typeof helpers.brushGroupOrder, 'brushGroupOrder must be exported').toBe('object')
  expect(Object.isFrozen(helpers.brushGroupOrder), 'brushGroupOrder must be frozen').toBe(true)
  return helpers.brushGroupOrder!
}

function groupLabels(): Readonly<Record<MediumIdLike, string>> {
  expect(typeof helpers.brushGroupLabels, 'brushGroupLabels must be exported').toBe('object')
  expect(Object.isFrozen(helpers.brushGroupLabels), 'brushGroupLabels must be frozen').toBe(true)
  return helpers.brushGroupLabels!
}

function groupOf(preset: BrushPreset): MediumIdLike {
  expect(typeof helpers.brushGroupOf, 'brushGroupOf must be exported').toBe('function')
  return helpers.brushGroupOf!(preset)
}

function sectionsOf(presets: BrushPreset[]): BrushSection[] {
  expect(typeof helpers.brushSections, 'brushSections must be exported').toBe('function')
  return helpers.brushSections!(presets)
}

function presetById(id: string): BrushPreset {
  const preset = BRUSH_PRESETS.find((candidate) => candidate.id === id)
  expect(preset, `preset '${id}' must exist`).toBeDefined()
  return preset!
}

const GROUPS: MediumIdLike[] = ['watercolor', 'acrylic']

// The two-group classification, restated verbatim.
const CLASSIFICATION: Record<string, MediumIdLike> = {
  round: 'watercolor',
  detail: 'watercolor',
  rigger: 'watercolor',
  flat: 'watercolor',
  hake: 'watercolor',
  filbert: 'watercolor',
  mop: 'watercolor',
  sponge: 'watercolor',
  spatter: 'watercolor',
  sumi: 'watercolor',
  dagger: 'watercolor',
  'bristle-round': 'acrylic',
  pen: 'acrylic',
}

// The eleven surviving watercolor ids in their current table order — the
// identity backstop for every recorded stroke.
const LEGACY_IDS = [
  'round',
  'detail',
  'rigger',
  'flat',
  'hake',
  'filbert',
  'mop',
  'sponge',
  'spatter',
  'sumi',
  'dagger',
]

// The two appended ids, in the recorded order.
const NEW_IDS = ['bristle-round', 'pen']

// The shared base every preset inherits (restated as literals).
const BASE_FIELDS: Record<string, unknown> = {
  aspect: 1,
  rotation: 'fixed',
  angle: 0,
  angleJitter: 0,
  size: [0.011, 0.05],
  pressureSize: 1,
  speedThin: 0,
  spacing: 0.3,
  scatter: 0,
  dabs: 1,
  sizeJitter: 0,
  water: 1,
  load: 1,
  flow: 1,
  capacity: 1,
  grain: 0,
  wetRound: 0.6,
  roughness: 0,
  stampJitter: 0,
}

interface NewPresetSpec {
  name: string
  group: MediumIdLike
  overrides: Record<string, unknown>
}

// The two acrylic responses, restated verbatim (quick 261124-iq9: the display
// name becomes Gouache Round, its id and every parameter stay shipped; quick
// 261124-tje appends the Pen).
const NEW_PRESETS: Record<string, NewPresetSpec> = {
  'bristle-round': {
    name: 'Gouache Round',
    group: 'acrylic',
    overrides: {
      aspect: 0.7,
      rotation: 'follow',
      water: 0.06,
      load: 1.4,
      capacity: 1.6,
      grain: 0.15,
      roughness: 0.4,
      spacing: 0.14,
    },
  },
  pen: {
    name: 'Pen 1B',
    group: 'acrylic',
    // 2026-11-27: Pen 1B derives from Gouache Round — the whole physics
    // record is shared; only the landing bag differs.
    overrides: {
      aspect: 0.7,
      rotation: 'follow',
      water: 0.06,
      load: 1.4,
      capacity: 1.6,
      grain: 0.15,
      roughness: 0.4,
      spacing: 0.14,
    },
  },
}

/** A synthetic preset derived from an existing one, with a chosen group. */
function synthetic(id: string, group: MediumIdLike | null): BrushPreset {
  const { group: _group, ...rest } = presetById('round')
  return group === null ? { ...rest, id } : { ...rest, id, group }
}

function identicalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

describe('brush group order and labels', () => {
  it('fixes the two groups in the recorded order', () => {
    expect([...groupOrder()]).toEqual(GROUPS)
  })

  it('maps each group to the D-18 short header name', () => {
    expect({ ...groupLabels() }).toEqual({
      watercolor: 'Watercolor',
      acrylic: 'Medium',
    })
  })

  it('reads an absent group tag as watercolor', () => {
    expect(groupOf(synthetic('synthetic-legacy', null))).toBe('watercolor')
    expect(groupOf(synthetic('synthetic-acrylic', 'acrylic'))).toBe('acrylic')
  })
})

describe('brush preset classification', () => {
  it('classifies every preset exactly as the spec table records', () => {
    expect(BRUSH_PRESETS).toHaveLength(Object.keys(CLASSIFICATION).length)
    for (const preset of BRUSH_PRESETS) {
      const expected = CLASSIFICATION[preset.id]
      expect(expected, `unclassified preset '${preset.id}'`).toBeDefined()
      expect(groupOf(preset), `group of '${preset.id}'`).toBe(expected)
    }
  })

  it('resolves every preset to exactly one group', () => {
    const seen = new Set<string>()
    for (const preset of BRUSH_PRESETS) {
      expect(seen.has(preset.id), `duplicate id '${preset.id}'`).toBe(false)
      seen.add(preset.id)
      expect(GROUPS).toContain(groupOf(preset))
    }
    expect(seen.size).toBe(13)
  })
})

describe('brush preset table identity', () => {
  it('keeps the eleven legacy ids in their current order', () => {
    expect(BRUSH_PRESETS.slice(0, LEGACY_IDS.length).map((p) => p.id)).toEqual(LEGACY_IDS)
  })

  it('appends the two new ids after the legacy table, each unique', () => {
    expect(BRUSH_PRESETS.slice(LEGACY_IDS.length).map((p) => p.id)).toEqual(NEW_IDS)
    expect(new Set(BRUSH_PRESETS.map((p) => p.id)).size).toBe(BRUSH_PRESETS.length)
  })
})

describe('brush sections helper', () => {
  it('returns the two groups in fixed order with table-ordered members', () => {
    const sections = sectionsOf(BRUSH_PRESETS)
    expect(sections.map((section) => section.group)).toEqual(GROUPS)
    expect(sections.map((section) => section.presets.map((p) => p.id))).toEqual([
      ['round', 'detail', 'rigger', 'flat', 'hake', 'filbert', 'mop', 'sponge', 'spatter', 'sumi', 'dagger'],
      ['bristle-round', 'pen'],
    ])
  })

  it('omits a group whose member list is empty', () => {
    const onlyWatercolor = [synthetic('synthetic-a', 'watercolor')]
    expect(sectionsOf(onlyWatercolor).map((section) => section.group)).toEqual(['watercolor'])

    // Fixed order survives a sparse synthetic list.
    const sparse = [synthetic('synthetic-b', 'acrylic'), synthetic('synthetic-c', null)]
    const sections = sectionsOf(sparse)
    expect(sections.map((section) => section.group)).toEqual(['watercolor', 'acrylic'])
    expect(sections[0].presets.map((p) => p.id)).toEqual(['synthetic-c'])
    expect(sections[1].presets.map((p) => p.id)).toEqual(['synthetic-b'])
  })

  it('returns an empty array for an empty preset list', () => {
    expect(sectionsOf([])).toEqual([])
  })
})

describe('the acrylic responses', () => {
  it('carries the recorded name and group', () => {
    for (const [id, spec] of Object.entries(NEW_PRESETS)) {
      const preset = presetById(id)
      expect(preset.name, `name of '${id}'`).toBe(spec.name)
      expect(groupOf(preset), `group of '${id}'`).toBe(spec.group)
    }
  })

  it('overrides exactly the recorded fields and inherits the rest from the base', () => {
    for (const [id, spec] of Object.entries(NEW_PRESETS)) {
      const preset = presetById(id) as unknown as Record<string, unknown>
      for (const [field, baseValue] of Object.entries(BASE_FIELDS)) {
        const expected = field in spec.overrides ? spec.overrides[field] : baseValue
        expect(preset[field], `${id}.${field}`).toEqual(expected)
      }
      expect(preset.custom, `${id}.custom`).toBeUndefined()
      expect(typeof preset.tip, `${id}.tip must be procedural`).toBe('function')
      expect(preset.hint, `${id} must carry a hint`).toMatch(/\S/)
    }
  })

  it('builds a byte-identical tip for the bristle-engine presets', () => {
    for (const id of ['bristle-round', 'pen']) {
      const first = buildBrush(presetById(id))
      const second = buildBrush(presetById(id))
      expect(first.tipSize, `${id}.tipSize`).toBe(TIP_SIZE)
      expect(identicalBytes(first.tipData, second.tipData), `${id} tip must be deterministic`).toBe(true)
      // A generated tip must actually carry paint, not be an empty mask.
      expect(first.tipData.some((value) => value > 0), `${id} tip must not be empty`).toBe(true)
    }
  })

  it('writes the shared bristle tip on the hair-segment helper, not the cellular one', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const source = readFileSync(resolve(here, 'brushes.ts'), 'utf8')
    const match = source.match(/function\s+(\w*[Bb]ristle\w*)\s*\(/)
    expect(match, 'a shared bristle tip generator must exist').not.toBeNull()
    const body = source.slice(match!.index!, match!.index! + 800)
    expect(body).toContain('hairs(')
    expect(body).not.toContain('worley(')
  })
})

describe('the bristle response predicate (64-21, D-27 revised post-UAT)', () => {
  it('accepts exactly the bristle-engine ids, with or without a texture id', () => {
    for (const id of ['bristle-round', 'pen']) {
      expect(isBristleResponse({ id }), `${id} with an absent textureId`).toBe(true)
      expect(isBristleResponse({ id, textureId: null }), `${id} with a null textureId`).toBe(true)
      // Post-UAT 2026-11-19 (GAP-4): a texture pick no longer disables the
      // engine — the tip COMPOSES with the gather (`tipMask`, uTipMix).
      expect(isBristleResponse({ id, textureId: 'mask/acrylic-01' }), `${id} carrying a picked texture`).toBe(true)
    }
  })

  it('refuses every other response, textured or not', () => {
    expect(isBristleResponse({ id: 'round' })).toBe(false)
    expect(isBristleResponse({ id: 'round', textureId: 'mask/acrylic-01' })).toBe(false)
    // Explicit retirement pins: the deleted bristle sibling and the retired
    // chalk response never run the per-bristle engine, and the surviving
    // asymmetric watercolor response (flat) stays non-bristle.
    expect(isBristleResponse({ id: 'bristle-flat' })).toBe(false)
    expect(isBristleResponse({ id: 'chalk' })).toBe(false)
    expect(isBristleResponse({ id: 'chalk', textureId: 'mask/acrylic-01' })).toBe(false)
    expect(isBristleResponse({ id: 'flat' })).toBe(false)
  })
})

// quick 261121-umu: the acrylic family's per-response pressureLink. It is a
// compile-time-only field (the `group` precedent) — no serializer, no `.mce`
// field. An absent field reads as the shipped link 1.
describe('the acrylic pressureLink (quick 261121-umu)', () => {
  const linkOf = (preset: BrushPreset): number | undefined =>
    (preset as unknown as { pressureLink?: number }).pressureLink
  const brushLinkOf = (id: string): number | undefined =>
    (buildBrush(presetById(id)) as unknown as { pressureLink?: number }).pressureLink

  it('only the acrylic responses state a pressureLink', () => {
    const linked = BRUSH_PRESETS.filter((preset) => linkOf(preset) !== undefined)
    expect(linked.map((preset) => preset.id)).toEqual(['bristle-round', 'pen'])
    expect(linkOf(presetById('bristle-round')), 'bristle-round pressureLink').toBe(0)
    expect(linkOf(presetById('pen')), 'pen pressureLink').toBe(0)
  })

  it('buildBrush carries the pressureLink', () => {
    expect(brushLinkOf('bristle-round'), 'a bristle brush carries its link').toBe(0)
    expect(brushLinkOf('pen'), 'the pen carries its link').toBe(0)
    expect('pressureLink' in buildBrush(presetById('round')), 'a non-acrylic brush states no link').toBe(false)
  })

  it('BASE and CUSTOM_BASE do not state a pressureLink', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const source = readFileSync(resolve(here, 'brushes.ts'), 'utf8')
    const baseStart = source.indexOf('const BASE:')
    const baseEnd = source.indexOf('const define =')
    expect(baseStart, 'the BASE table must exist').toBeGreaterThanOrEqual(0)
    expect(baseEnd, 'the define helper must follow BASE').toBeGreaterThan(baseStart)
    expect(source.slice(baseStart, baseEnd), 'BASE never states a pressureLink').not.toContain('pressureLink')
    expect('pressureLink' in presetById('round'), 'a define-built preset inherits no link').toBe(false)
    expect('pressureLink' in CUSTOM_BASE, 'CUSTOM_BASE states no link').toBe(false)
  })
})

// 2026-11-21 (the artist's fast-hand report): the acrylic family's per-
// response speedLink — 0 removes hand speed from the bristle contact gate so
// Dry alone decides whether the paint runs out. Same compile-time-only field
// contract as pressureLink; an absent field reads as the shipped 1.
describe('the acrylic speedLink (2026-11-21)', () => {
  const linkOf = (preset: BrushPreset): number | undefined =>
    (preset as unknown as { speedLink?: number }).speedLink

  it('only the acrylic responses state a speedLink', () => {
    const linked = BRUSH_PRESETS.filter((preset) => linkOf(preset) !== undefined)
    expect(linked.map((preset) => preset.id)).toEqual(['bristle-round', 'pen'])
    expect(linkOf(presetById('bristle-round')), 'bristle-round speedLink').toBe(0)
    expect(linkOf(presetById('pen')), 'pen speedLink').toBe(0)
  })

  it('buildBrush carries the speedLink', () => {
    expect(
      (buildBrush(presetById('bristle-round')) as unknown as { speedLink?: number }).speedLink,
      'a bristle brush carries its link',
    ).toBe(0)
    expect(
      (buildBrush(presetById('pen')) as unknown as { speedLink?: number }).speedLink,
      'the pen carries its link',
    ).toBe(0)
    expect('speedLink' in buildBrush(presetById('round')), 'a non-acrylic brush states no link').toBe(false)
  })

  it('BASE and CUSTOM_BASE do not state a speedLink', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const source = readFileSync(resolve(here, 'brushes.ts'), 'utf8')
    const baseStart = source.indexOf('const BASE:')
    const baseEnd = source.indexOf('const define =')
    expect(baseStart, 'the BASE table must exist').toBeGreaterThanOrEqual(0)
    expect(baseEnd, 'the define helper must follow BASE').toBeGreaterThan(baseStart)
    expect(source.slice(baseStart, baseEnd), 'BASE never states a speedLink').not.toContain('speedLink')
    expect('speedLink' in presetById('round'), 'a define-built preset inherits no link').toBe(false)
    expect('speedLink' in CUSTOM_BASE, 'CUSTOM_BASE states no link').toBe(false)
  })
})

// quick 261124-tje: the per-brush LANDING BAGS. COMPILE-TIME ONLY (the
// `group` precedent): every pick loads these values into the live paint
// controls; nothing serializes them, there is no `.mce` field and a stroke
// persists the response id.
describe('the per-brush defaults bags (quick 261124-tje)', () => {
  interface DefaultsBag {
    sizePx?: number
    color?: string
    grain?: number
    load?: number
    pickup?: number
    opacity?: number
    dry?: number
    feather?: number
    featherNoise?: number
    featherFalloff?: number
    emboss?: number
  }
  const defaultsOf = (preset: BrushPreset): DefaultsBag | undefined =>
    (preset as unknown as { defaults?: DefaultsBag }).defaults

  it('pins the Gouache bag: size 40 px, no colour', () => {
    const bag = defaultsOf(presetById('bristle-round'))
    expect(bag).toEqual({
      sizePx: 40,
      load: 100,
      pickup: 100,
      dry: 0,
      feather: 100,
    })
    expect(Object.keys(bag!).sort(), 'Gouache names no colour').toEqual([
      'dry',
      'feather',
      'load',
      'pickup',
      'sizePx',
    ])
  })

  it('pins the Pen 1B bag: size 10 px, pigment #333537', () => {
    const bag = defaultsOf(presetById('pen'))
    expect(bag).toEqual({
      sizePx: 10,
      grain: 25,
      load: 100,
      pickup: 0,
      opacity: 100,
      dry: 0,
      feather: 100,
      featherNoise: 60,
      featherFalloff: 0,
      emboss: 0,
      color: '#333537',
    })
    expect(Object.keys(bag!).sort(), 'exactly the eleven landing keys').toEqual([
      'color',
      'dry',
      'emboss',
      'feather',
      'featherFalloff',
      'featherNoise',
      'grain',
      'load',
      'opacity',
      'pickup',
      'sizePx',
    ])
  })

  it('states no bag on any other preset', () => {
    for (const preset of BRUSH_PRESETS) {
      if (preset.id === 'bristle-round' || preset.id === 'pen') continue
      expect(defaultsOf(preset), `${preset.id} carries no bag`).toBeUndefined()
    }
  })

  it('buildBrush carries the same bag reference (compile-time-only, no serializer)', () => {
    for (const id of ['bristle-round', 'pen']) {
      expect(
        (buildBrush(presetById(id)) as unknown as { defaults?: DefaultsBag }).defaults,
        `${id} built brush`,
      ).toBe(defaultsOf(presetById(id)))
    }
  })
})
