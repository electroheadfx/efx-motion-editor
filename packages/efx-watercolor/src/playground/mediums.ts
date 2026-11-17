// ============================================================
//  mediums.ts — the five built-in paint mediums, as plain data.
//
//  A medium is `{ id, name, params }`: a frozen, serializable
//  record over exactly the ten medium keys (the canonical bag
//  minus `size` and `lift`, which the medium never writes). No
//  function, no class, no hidden behaviour — a record is a
//  parameter set, nothing more.
//
//  The numbers are the spec 04 amendment table, in its column
//  order: Water, Pigment, Flow, Bleed, Dry, Edges, Grain,
//  Viscosity, Body, Emboss.
// ============================================================

import { DEFAULT_CANONICAL_PARAMS } from './params'

/** The five built-in medium ids, in display order. */
export type MediumId = 'watercolor' | 'gouache' | 'pastel' | 'graphite' | 'acrylic'

/**
 * The ten keys a medium may set. `size` (a shared pixel footprint) and
 * `lift` (the eraser popover's strength) are deliberately absent: a
 * medium switch must never resize the brush or change the eraser.
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
})

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
      emboss: 20,
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
    }),
  }),
  Object.freeze({
    id: 'acrylic',
    name: 'Acrylic',
    params: Object.freeze({
      water: 8,
      load: 85,
      flow: 50,
      bleed: 10,
      dry: 70,
      edge: 65,
      granulation: 25,
      viscosity: 90,
      body: 90,
      emboss: 75,
    }),
  }),
])

/** Resolve a medium by id; null for anything unknown. Never throws. */
export function mediumById(id: string): MediumRecord | null {
  return MEDIUMS.find((medium) => medium.id === id) ?? null
}
