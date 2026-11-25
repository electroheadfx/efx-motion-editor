// ============================================================
//  Medium records (Phase 64, MED-07 / MED-08 / MED-09).
//
//  The two built-ins are plain frozen data over exactly the fourteen
//  medium keys. Everything here is restated as literals — the
//  amendment table, the key list, the display names — so a dropped
//  key or a drifted number fails the pin instead of moving it.
// ============================================================

import { describe, expect, it } from 'vitest'
import { DEFAULT_CANONICAL_PARAMS } from './params'
import { DEFAULT_MEDIUM_ID, MEDIUM_IDS, MEDIUMS, mediumById } from './mediums'
import { bodyCurve } from './scattering'

// The fourteen medium keys: the amendment table's column order, then
// 64-22's four (D-22 / §3.1 / §6).
const MEDIUM_KEYS = [
  'water',
  'load',
  'flow',
  'bleed',
  'dry',
  'edge',
  'granulation',
  'viscosity',
  'body',
  'emboss',
  'feather',
  'pickup',
  'refill',
  'wetSeconds',
] as const

/** Resolve a record and fail as an assertion (never a load error) when absent. */
function recordOf(id: string) {
  const record = mediumById(id)
  expect(record, `mediumById('${id}') must return a record`).not.toBeNull()
  return record!
}

describe('medium records', () => {
  it('ships the two ids in the recorded order', () => {
    expect(MEDIUM_IDS).toHaveLength(2)
    expect([...MEDIUM_IDS]).toEqual(['watercolor', 'acrylic'])
    expect(MEDIUMS.map((medium) => medium.id)).toEqual([...MEDIUM_IDS])
    expect(DEFAULT_MEDIUM_ID).toBe('watercolor')
  })

  it('names each medium with the D-18 short label', () => {
    expect(MEDIUMS.map((medium) => medium.name)).toEqual(['Watercolor', 'Gouache'])
  })

  // quick 261124-iq9: the gouache, pastel (Chalk) and graphite media are
  // retired outright — no record, no id, no lookup.
  it('retires the gouache, pastel and graphite media', () => {
    expect(mediumById('gouache')).toBeNull()
    expect(mediumById('pastel')).toBeNull()
    expect(mediumById('graphite')).toBeNull()
  })

  it('carries exactly the fourteen medium keys and never size or lift', () => {
    expect(MEDIUMS).toHaveLength(2)
    for (const medium of MEDIUMS) {
      expect(Object.keys(medium.params).sort(), `${medium.id} keys`).toEqual(
        [...MEDIUM_KEYS].sort(),
      )
      expect(medium.params, `${medium.id} must not write size`).not.toHaveProperty('size')
      expect(medium.params, `${medium.id} must not write lift`).not.toHaveProperty('lift')
    }
  })

  // 64-22: the four new keys state the §6 defaults on every record.
  // 64-24 (D-25): the acrylic record carries the retune — Water 26, Bleed 22,
  // Flow 60 and its own tack time (wetSeconds 12). The four other literals
  // are the "no committed number moved" companions.
  it('matches the amendment table numbers plus the §6 defaults', () => {
    expect(recordOf('watercolor').params).toEqual({
      water: 50,
      load: 50,
      flow: 50,
      bleed: 50,
      dry: 50,
      edge: 50,
      granulation: 50,
      viscosity: 0,
      body: 0,
      emboss: 0,
      feather: 0,
      // 261119-pod (D-A): the watercolor record derives the canonical
      // default, which now opens Pickup at 100.
      pickup: 100,
      refill: 60,
      wetSeconds: 7,
    })
    expect(recordOf('acrylic').params).toEqual({
      water: 26,
      load: 100,
      flow: 60,
      bleed: 22,
      dry: 70,
      edge: 65,
      granulation: 25,
      viscosity: 90,
      // 2026-11-21 (artist's acrylic brush default, quick 261121-mtu): the
      // mixing bag a bristle acrylic pick must start from — Feather 85 (a
      // soft-but-defined edge; 100 smeared the mark's silhouette) and Emboss
      // 3 (a light relief pass; the row caps at 15).
      body: 100,
      emboss: 3,
      feather: 85,
      pickup: 100,
      refill: 0,
      wetSeconds: 12,
    })
  })

  // 64-24 (D-25): the retune, as arithmetic — the three transport knobs moved
  // UP from the shipped numbers (more Water widens the fluid transport into a
  // flowing, slightly irregular edge), and the tack time sits ABOVE the §6
  // default of 7 s, so the D-24 gate has a medium that keeps giving up paint
  // longer than the neutral default. Every other number is restated above.
  it('carries the D-25 retune arithmetic on the acrylic record', () => {
    const acrylic = recordOf('acrylic').params
    expect(acrylic.water).toBeGreaterThan(8)
    expect(acrylic.bleed).toBeGreaterThan(10)
    expect(acrylic.flow).toBeGreaterThan(50)
    expect(acrylic.wetSeconds).toBeGreaterThan(DEFAULT_CANONICAL_PARAMS.wetSeconds)
    expect(DEFAULT_CANONICAL_PARAMS.wetSeconds).toBe(7)
    // The retune is numbers only: the shipped keys it does NOT touch hold
    // their values, exactly as the companion literals assert.
    expect(acrylic.load).toBe(100)
    expect(acrylic.dry).toBe(70)
    expect(acrylic.edge).toBe(65)
    expect(acrylic.granulation).toBe(25)
    expect(acrylic.viscosity).toBe(90)
    // 2026-11-21 (artist's acrylic brush default, quick 261121-mtu): the five
    // mixing knobs ride the brush pick — full Body, full Pickup, no Refill,
    // Feather 85 (soft-but-defined edge: 100 smeared the silhouette) and
    // Emboss 3 (a light relief pass; the row caps at 15). No new `feather`
    // expression is added: D-22's Feather half is discharged by composition
    // through the existing softness band (D-25).
    expect(acrylic.body).toBe(100)
    expect(acrylic.emboss).toBe(3)
    expect(acrylic.pickup).toBe(100)
    expect(acrylic.refill).toBe(0)
    expect(acrylic.feather).toBe(85)
  })

  // 2026-11-21 (artist UAT, "all chalk brushes paint nothing"): Body is ORDER,
  // and any non-zero Body routes the whole deposit through the coverage
  // composite — the film alpha is `bodyCurve(Body) * COVER_GAIN` on the D-14
  // `body ^ 6` curve, so a LOW Body deposits almost nothing (Body 25 = 0.05 %,
  // measured blank on every dry response). A record is therefore either 0
  // (additive deposit) or high enough to be a visible cover; the neutral
  // medium stays 0.
  it('never ships a Body between the additive path and a visible cover', () => {
    expect(bodyCurve(0.25) * 2, 'Body 25 is a blank film').toBeLessThan(0.001)
    expect(bodyCurve(0.55) * 2, 'Body 55 is visible').toBeGreaterThan(0.05)
    for (const medium of MEDIUMS) {
      const body = medium.params.body
      expect(
        body === 0 || body >= 50,
        `${medium.id} body ${body} sits on the invisible cliff (0 or >= 50)`,
      ).toBe(true)
    }
  })

  it('derives the watercolor record from the canonical defaults', () => {
    // The neutral medium must never drift from the neutral defaults: a fresh
    // session's first stroke and a pre-milestone replay paint the same paint.
    const expected = Object.fromEntries(
      MEDIUM_KEYS.map((key) => [key, DEFAULT_CANONICAL_PARAMS[key]]),
    )
    expect(recordOf('watercolor').params).toEqual(expected)
    expect(recordOf('watercolor').params.viscosity).toBe(0)
    expect(recordOf('watercolor').params.body).toBe(0)
    expect(recordOf('watercolor').params.emboss).toBe(0)
    // 64-22: the four new keys derive from the canonical defaults too.
    expect(recordOf('watercolor').params.feather).toBe(DEFAULT_CANONICAL_PARAMS.feather)
    expect(recordOf('watercolor').params.pickup).toBe(DEFAULT_CANONICAL_PARAMS.pickup)
    expect(recordOf('watercolor').params.refill).toBe(DEFAULT_CANONICAL_PARAMS.refill)
    expect(recordOf('watercolor').params.wetSeconds).toBe(DEFAULT_CANONICAL_PARAMS.wetSeconds)
  })

  // Both surviving records open Pickup at 100: the watercolor record derives
  // it from the canonical default (261119-pod, D-A) and the acrylic record
  // states it literally (2026-11-20, the artist's acrylic brush default).
  it('opens Pickup at 100 on both surviving records (D-A)', () => {
    expect(recordOf('watercolor').params.pickup).toBe(100)
    expect(recordOf('acrylic').params.pickup).toBe(100)
  })

  it('keeps every record frozen plain serializable data', () => {
    expect(MEDIUMS).toHaveLength(2)
    expect(Object.isFrozen(MEDIUMS)).toBe(true)
    expect(Object.isFrozen(MEDIUM_IDS)).toBe(true)
    for (const medium of MEDIUMS) {
      expect(Object.isFrozen(medium), `${medium.id} record must be frozen`).toBe(true)
      expect(Object.isFrozen(medium.params), `${medium.id} params must be frozen`).toBe(true)
      // No function, no class instance, no hidden behaviour: a JSON round trip
      // reproduces the record exactly (MED-07.encoding).
      expect(JSON.parse(JSON.stringify(medium))).toEqual(medium)
      expect(typeof medium.name).toBe('string')
      for (const value of Object.values(medium.params)) {
        expect(Number.isFinite(value), `${medium.id} params must be finite numbers`).toBe(true)
      }
    }
  })

  it('resolves a known id and returns null for anything else', () => {
    expect(MEDIUM_IDS).toHaveLength(2)
    for (const id of MEDIUM_IDS) {
      expect(mediumById(id)?.id, `mediumById('${id}')`).toBe(id)
    }
    expect(mediumById('oil')).toBeNull()
    expect(mediumById('')).toBeNull()
    // The display name is not an id: resolution is exact and lowercase.
    expect(mediumById('Watercolor')).toBeNull()
    expect(mediumById('pastel ')).toBeNull()
  })
})
