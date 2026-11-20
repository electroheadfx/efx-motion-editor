// ============================================================
//  mediums.ts — the five built-in paint mediums, as plain data.
//
//  A medium is `{ id, name, params }`: a frozen, serializable
//  record over exactly the fourteen medium keys (the canonical bag
//  minus `size` and `lift`, which the medium never writes). No
//  function, no class, no hidden behaviour — a record is a
//  parameter set, nothing more.
//
//  The numbers are the spec 04 amendment table, in its column
//  order: Water, Pigment, Flow, Bleed, Dry, Edges, Grain,
//  Viscosity, Body, Emboss — then 64-22's four (§3.1/§3.4/§6
//  defaults: Feather, Pickup, Refill, WetSeconds).
// ============================================================

import { DEFAULT_CANONICAL_PARAMS } from './params'

/** The five built-in medium ids, in display order. */
export type MediumId = 'watercolor' | 'gouache' | 'pastel' | 'graphite' | 'acrylic'

/**
 * The fourteen keys a medium may set. `size` (a shared pixel footprint) and
 * `lift` (the eraser popover's strength) are deliberately absent: a
 * medium switch must never resize the brush or change the eraser.
 *
 * 64-22 added the reference's user-facing controls: `feather` (the gather's
 * coverage band), `pickup` and `refill` (§3.1 carrier rates) and
 * `wetSeconds` (the §3.4 last-touch lifetime, in seconds).
 */
export type MediumParamKey =
  | 'water'
  | 'load'
  | 'flow'
  | 'bleed'
  | 'dry'
  | 'edge'
  | 'granulation'
  | 'viscosity'
  | 'body'
  | 'emboss'
  | 'feather'
  | 'pickup'
  | 'refill'
  | 'wetSeconds'

/** One built-in medium: plain serializable data, frozen. */
export interface MediumRecord {
  readonly id: MediumId
  /** Display name — matches the brush-library section header (D-18). */
  readonly name: string
  readonly params: Readonly<Record<MediumParamKey, number>>
}

export const MEDIUM_IDS = Object.freeze([
  'watercolor',
  'gouache',
  'pastel',
  'graphite',
  'acrylic',
] as const) satisfies ReadonlyArray<MediumId>

export const DEFAULT_MEDIUM_ID: MediumId = 'watercolor'

/**
 * The neutral medium IS the canonical defaults — derived here, never
 * retyped, so a fresh session's first stroke and a pre-milestone replay
 * paint exactly the same paint.
 */
const WATERCOLOR_PARAMS: Readonly<Record<MediumParamKey, number>> = Object.freeze({
  water: DEFAULT_CANONICAL_PARAMS.water,
  load: DEFAULT_CANONICAL_PARAMS.load,
  flow: DEFAULT_CANONICAL_PARAMS.flow,
  bleed: DEFAULT_CANONICAL_PARAMS.bleed,
  dry: DEFAULT_CANONICAL_PARAMS.dry,
  edge: DEFAULT_CANONICAL_PARAMS.edge,
  granulation: DEFAULT_CANONICAL_PARAMS.granulation,
  viscosity: DEFAULT_CANONICAL_PARAMS.viscosity,
  body: DEFAULT_CANONICAL_PARAMS.body,
  emboss: DEFAULT_CANONICAL_PARAMS.emboss,
  feather: DEFAULT_CANONICAL_PARAMS.feather,
  pickup: DEFAULT_CANONICAL_PARAMS.pickup,
  refill: DEFAULT_CANONICAL_PARAMS.refill,
  wetSeconds: DEFAULT_CANONICAL_PARAMS.wetSeconds,
})

// 64-22: every non-watercolor record states the §6 defaults for the four new
// keys literally (feather 0, pickup 60, refill 60, wetSeconds 7). A
// medium-specific value needs its own measured decision — acrylic's
// water/bleed/flow retune is D-25's, in 64-24. The committed ten numbers of
// every record are unchanged by 64-22.
// 261119-pod (D-A): the watercolor record DERIVES its pickup from the
// canonical default, so it opens at 100; the four explicit records keep
// their recorded 60 (the new default is the neutral medium's, not a
// blanket rewrite).
export const MEDIUMS: ReadonlyArray<MediumRecord> = Object.freeze([
  Object.freeze({ id: 'watercolor', name: 'Watercolor', params: WATERCOLOR_PARAMS }),
  Object.freeze({
    id: 'gouache',
    name: 'Gouache',
    params: Object.freeze({
      water: 35,
      load: 70,
      flow: 55,
      bleed: 25,
      dry: 60,
      edge: 60,
      granulation: 40,
      viscosity: 55,
      body: 55,
      // Post-UAT (2026-11-21): the Emboss row is capped at 15, so the record
      // states the cap's ceiling instead of the unreachable 20.
      emboss: 15,
      feather: 0,
      pickup: 60,
      refill: 60,
      wetSeconds: 7,
    }),
  }),
  Object.freeze({
    id: 'pastel',
    // Displays as "Chalk" so the dropdown name and the brush-library section
    // header (D-18) are the same word over the pastel group.
    name: 'Chalk',
    params: Object.freeze({
      water: 0,
      load: 65,
      flow: 30,
      bleed: 0,
      dry: 80,
      edge: 70,
      granulation: 60,
      viscosity: 85,
      body: 25,
      emboss: 0,
      feather: 0,
      pickup: 60,
      refill: 60,
      wetSeconds: 7,
    }),
  }),
  Object.freeze({
    id: 'graphite',
    name: 'Graphite',
    params: Object.freeze({
      water: 0,
      load: 45,
      flow: 25,
      bleed: 0,
      dry: 85,
      edge: 75,
      granulation: 100,
      viscosity: 90,
      body: 0,
      emboss: 0,
      feather: 0,
      pickup: 60,
      refill: 60,
      wetSeconds: 7,
    }),
  }),
  // 64-24 (D-25 — the acrylic retune, numbers in one record, no new term):
  // more Water widens the fluid transport so the acrylic edge flows and turns
  // slightly irregular instead of closing on a hard contour; Bleed and Flow
  // carry that transport through the same three knobs they always did. Every
  // other number is the shipped one, and every other medium is untouched.
  //
  // `wetSeconds` is the paint's tack time (D-24): the last-touch gate reads
  // `exp(-age / wetSeconds) * coverage`, so 12 s is how long acrylic keeps
  // GIVING UP its paint — the fluid's own drying (`dryTau()`) is a separate
  // quantity and is not routed through this number.
  //
  // D-22's Feather half is discharged here by COMPOSITION, not by new code:
  // the acrylic water edge is this retune's fluid transport passing through
  // 64-22/64-23's Feather-widened softness band (`uSoftness =
  // gatherSoftness(P.feather)`, bound in `bristleInk` / `coverBristlePass`),
  // so this plan adds no `feather` expression and none should appear.
  Object.freeze({
    id: 'acrylic',
    name: 'Acrylic',
    params: Object.freeze({
      water: 26,
      load: 100,
      flow: 60,
      bleed: 22,
      dry: 70,
      edge: 65,
      granulation: 25,
      viscosity: 90,
      // 2026-11-20 (artist's acrylic brush default): a bristle acrylic pick
      // must start from the mixing bag the artist paints with — full Body,
      // full Pickup, no Refill, full Feather and no Emboss. The rest of the
      // D-25 retune is untouched.
      body: 100,
      emboss: 0,
      feather: 100,
      pickup: 100,
      refill: 0,
      wetSeconds: 12,
    }),
  }),
])

/** Resolve a medium by id; null for anything unknown. Never throws. */
export function mediumById(id: string): MediumRecord | null {
  return MEDIUMS.find((medium) => medium.id === id) ?? null
}
