// ============================================================
//  mediums.ts — the two built-in paint mediums, as plain data.
//
//  A medium is `{ id, name, params }`: a frozen, serializable
//  record over exactly the eighteen medium keys (the canonical bag
//  minus `size` and `lift`, which the medium never writes). No
//  function, no class, no hidden behaviour — a record is a
//  parameter set, nothing more.
//
//  The numbers are the spec 04 amendment table, in its column
//  order: Water, Pigment, Flow, Bleed, Dry, Edges, Grain,
//  Viscosity, Body, Emboss — then 64-22's four (§3.1/§3.4/§6
//  defaults: Feather, Pickup, Refill, WetSeconds), Spec 10's two
//  (Edge transparency, Edge falloff) and Spec 11's two (Feather
//  noise, Feather falloff).
//
//  quick 261124-iq9: the gouache, pastel (Chalk) and graphite
//  media are retired outright. The acrylic record keeps its id
//  and every parameter and takes the display name "Gouache".
// ============================================================

import { DEFAULT_CANONICAL_PARAMS } from './params'

/** The two built-in medium ids, in display order. */
export type MediumId = 'watercolor' | 'acrylic'

/**
 * The eighteen keys a medium may set. `size` (a shared pixel footprint) and
 * `lift` (the eraser popover's strength) are deliberately absent: a
 * medium switch must never resize the brush or change the eraser.
 *
 * 64-22 added the reference's user-facing controls: `feather` (the gather's
 * coverage band), `pickup` and `refill` (§3.1 carrier rates) and
 * `wetSeconds` (the §3.4 last-touch lifetime, in seconds).
 *
 * 2026-11-27: `edgeFade` is ONE GLOBAL transparency for the stroke layer
 * (0 opaque, 100 fully transparent); the lateral fade and its `edgeFalloff`
 * shape bias are retired, the key kept in the record set.
 *
 * Spec 11 adds the break-up pair: `featherNoise` (the re-indexed break-up
 * slider — 0 clean edge, 20 the neutral base look, 100 the full break-up)
 * and `featherFalloff` (the opening's shape bias — 0 / 50 / 100).
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
  | 'edgeFade'
  | 'edgeFalloff'
  | 'featherNoise'
  | 'featherFalloff'

/** One built-in medium: plain serializable data, frozen. */
export interface MediumRecord {
  readonly id: MediumId
  /** Display name — matches the brush-library section header (D-18). */
  readonly name: string
  readonly params: Readonly<Record<MediumParamKey, number>>
}

export const MEDIUM_IDS = Object.freeze(['watercolor', 'acrylic'] as const) satisfies ReadonlyArray<MediumId>

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
  // 2026-11-27: derived, not retyped — the neutral medium paints opaque
  // (global transparency 0); the falloff is a retired, unused key.
  edgeFade: DEFAULT_CANONICAL_PARAMS.edgeFade,
  edgeFalloff: DEFAULT_CANONICAL_PARAMS.edgeFalloff,
  // Spec 11: derived, not retyped — the neutral 20 / the linear shape.
  featherNoise: DEFAULT_CANONICAL_PARAMS.featherNoise,
  featherFalloff: DEFAULT_CANONICAL_PARAMS.featherFalloff,
})

// 64-22: the acrylic record states the §6 defaults for the four new keys
// literally (feather 0, pickup 60, refill 60, wetSeconds 7). A
// medium-specific value needs its own measured decision — acrylic's
// water/bleed/flow retune is D-25's, in 64-24. The committed ten numbers of
// the record are unchanged by 64-22.
// 261119-pod (D-A): the watercolor record DERIVES its pickup from the
// canonical default, so it opens at 100 (the new default is the neutral
// medium's, not a blanket rewrite).
// quick 261124-iq9: the gouache, pastel (Chalk) and graphite records are
// deleted; the acrylic record keeps its id and every parameter and becomes
// the Gouache medium on screen.
export const MEDIUMS: ReadonlyArray<MediumRecord> = Object.freeze([
  Object.freeze({ id: 'watercolor', name: 'Watercolor', params: WATERCOLOR_PARAMS }),
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
    // quick 261124-iq9: displayed as "Gouache" — emboss is not a usable 2.5D
    // relief, so the acrylic/oil story was wrong; the id and every parameter
    // stay byte-identical.
    name: 'Gouache',
    params: Object.freeze({
      water: 26,
      load: 100,
      flow: 60,
      bleed: 22,
      dry: 70,
      edge: 65,
      granulation: 25,
      viscosity: 90,
      // 2026-11-21 (artist's acrylic brush default, quick 261121-mtu): the
      // bristle pick starts from the mixing bag the artist paints with —
      // full Body and Pickup, no Refill. Feather 85 keeps a soft-but-defined
      // acrylic edge (100 smears the mark's silhouette); Emboss 3 adds a
      // light relief pass (the row caps at 15); Refill 0 keeps the acrylic
      // mixing bag from washing out; Pickup 100 keeps it taking the sheet's
      // colour. The rest of the D-25 retune is untouched.
      body: 100,
      emboss: 3,
      feather: 85,
      pickup: 100,
      refill: 0,
      wetSeconds: 12,
      // Spec 10: Edge transparency 0 keeps the shipped acrylic edge — the
      // artist's mixed Gouache stays fully opaque until that row is moved.
      // Edge falloff 50 is the linear shape (the neutral twin's default).
      edgeFade: 0,
      edgeFalloff: 50,
      // Spec 11 re-index (2026-11-27k): the acrylic record starts on the
      // shipped base look — Feather noise 20 is the neutral program; falloff
      // 50 is the linear opening shape (the canonical defaults).
      featherNoise: 20,
      featherFalloff: 50,
    }),
  }),
])

/** Resolve a medium by id; null for anything unknown. Never throws. */
export function mediumById(id: string): MediumRecord | null {
  return MEDIUMS.find((medium) => medium.id === id) ?? null
}
