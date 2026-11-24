// ============================================================
//  quick 261121-mtu — the Paint panel's visibility law.
//
//  Matrix 2 of the plan: the panel's rows are a function of the
//  ACTIVE TOOL and the ACTIVE MEDIUM, never of the tool alone.
//  This module is the ONE source for the rendered rows and the
//  group headings; `AquarelleGlobalsPanel` maps it and owns no
//  row list of its own.
//
//  Pure data + two selectors: no Preact, no DOM, no signals, no
//  writes. Hiding a row never changes a stored value — every key
//  stays in `AQUARELLE_GLOBAL_KEYS`, the medium records, the
//  recorded stroke bag and the Reset write set, so this is an
//  exposure law with NO schema change and NO migration.
//
//  Decision B (artist, 2026-11-21): the Refill row is hidden for
//  the Acrylic (Gouache) medium — its record fixes 0 — AND for the
//  Watercolor medium: the engine binds `uRefillRate` only into the
//  bristle carrier (`bristleCarrierFS`), so the fluid row is dead.
//
//  quick 261121-mtu (rev 3): PICKUP follows the same audit — the
//  engine binds it only as the bristle carrier rate (`uPickupRate`)
//  and the gather's smear (`uSmear`), so the watercolor context
//  hides it too.
//
//  quick 261124-iq9: VISCOSTY and WATER are hidden for the Gouache
//  (acrylic) paint context — the opaque medium reads neither — and
//  stay visible for Watercolor. This is an exposure law, not a
//  watermark: `hiddenForMedia` is consulted only in the paint
//  branch, so the Water tool's fluid set keeps Viscosity under
//  every medium. `isAquarelleParamRowVisible` is the ONE selector
//  the Paint panel and the Studio top bar share.
//
//  `body` has no row anywhere (bag-only, Reset-only) and
//  `wetSeconds` has no row (it is seconds, not a 0..100 global) —
//  neither appears in `AQUARELLE_PARAM_ROWS` by design.
//
//  quick 261123-hr5: Emboss becomes the ONE signed row (-15..15).
//  Negative emboss smooths a dry impasto while keeping the paint;
//  the sign is recorded per stroke, never in a medium record.
// ============================================================

import { DEFAULT_MEDIUM_ID, type MediumId } from '@efxlab/efx-watercolor';
import type { AquarelleTool } from '@efxlab/efx-watercolor/payload';
import type { AquarelleGlobalKey } from './aquarelleRecordState';

export type AquarelleParamGroupId =
  | 'medium'
  | 'paint'
  | 'drying'
  | 'edge'
  | 'watercolor'
  | 'eraser';

export interface AquarelleParamGroup {
  readonly id: AquarelleParamGroupId;
  readonly label: string;
}

/**
 * One slider row. The context flags are the whole visibility law:
 *  - `paint`: this row belongs to the three paint tools (Brush /
 *    Watercolor / Pen). `'all'` = every medium; an array restricts;
 *    absent = not a paint row.
 *  - `hiddenForMedia`: subtracts media INSIDE the paint context only.
 *  - `water` / `lift`: add the row to the Water tool / Eraser context.
 */
export interface AquarelleParamRow {
  readonly key: AquarelleGlobalKey;
  readonly label: string;
  readonly group: AquarelleParamGroupId;
  readonly min?: number;
  readonly max?: number;
  readonly paint?: readonly MediumId[] | 'all';
  readonly hiddenForMedia?: readonly MediumId[];
  /**
   * Hidden in EVERY context, for every medium. Used while a row's feature is
   * gated off: the row stays in the list (and keeps its band) so the medium
   * record, the Reset key set and the persistence keep working, but no panel
   * renders it. See the Emboss row.
   */
  readonly hidden?: boolean;
  readonly water?: boolean;
  readonly lift?: boolean;
}

export interface VisibleAquarelleParamGroup {
  readonly id: AquarelleParamGroupId;
  readonly label: string;
  readonly rows: readonly AquarelleParamRow[];
}

/** Fixed group order (spec §8). An empty group renders no heading. */
export const AQUARELLE_PARAM_GROUPS: readonly AquarelleParamGroup[] = Object.freeze([
  Object.freeze({ id: 'medium', label: 'Medium' }),
  Object.freeze({ id: 'paint', label: 'Paint & reservoir' }),
  Object.freeze({ id: 'drying', label: 'Drying' }),
  Object.freeze({ id: 'edge', label: 'Edge' }),
  Object.freeze({ id: 'watercolor', label: 'Watercolor only' }),
  Object.freeze({ id: 'eraser', label: 'Eraser' }),
]);

/** Post-UAT (2026-11-21): emboss relief is very hard above 15, so the
 *  row's band is capped here — this is the ONE home of the cap (the
 *  panel only forwards `row.max`).
 *  Quick 261123-hr5: Emboss is SIGNED. The row spans -15..15: negative
 *  emboss SUBTRACTS paint thickness (smooths a dry impasto, keeps the
 *  paint), positive deposits it. The sign rides the per-stroke recorded
 *  bag only — a medium record never carries a negative emboss. This pair
 *  is the ONE home of the band (the panel only forwards `row.min/max`). */
const EMBOSS_MIN = -15;
const EMBOSS_MAX = 15;

const WATERCOLOR_ONLY: readonly MediumId[] = Object.freeze(['watercolor']);
/** The only bristle medium — Feather is the bristle band's width (spec §3). */
const BRISTLE_MEDIA: readonly MediumId[] = Object.freeze(['acrylic']);
/** Decision B: Acrylic fixes Refill at 0; the fluid path never reads it. */
const REFILL_HIDDEN: readonly MediumId[] = Object.freeze(['acrylic', 'watercolor']);
/**
 * quick 261121-mtu (rev 3): Pickup is the bristle carrier's reservoir rate
 * (`uPickupRate`) and the gather's deposit smear (`uSmear`) — the ONLY two
 * bindings. The fluid path reads neither, so the row is dead for the fluid
 * watercolor context and hidden there.
 */
const PICKUP_HIDDEN: readonly MediumId[] = Object.freeze(['watercolor']);
/**
 * quick 261124-iq9: Viscosity and Water are hidden for the Gouache (acrylic)
 * paint context — the opaque medium reads neither — and stay visible for
 * Watercolor. The paint branch is the only consumer, so the Water tool keeps
 * Viscosity via its `water: true` filter.
 */
const ACRYLIC_HIDDEN: readonly MediumId[] = Object.freeze(['acrylic']);

/**
 * The fifteen rows in Matrix 2's order (fourteen canvas rows + the
 * Eraser-context Lift row). The 15-key count is what makes the Reset
 * key set (`rows - lift` + `body`) reproduce the shipped patch.
 */
export const AQUARELLE_PARAM_ROWS: readonly AquarelleParamRow[] = Object.freeze([
  Object.freeze({
    key: 'viscosity',
    label: 'Viscosity',
    group: 'medium',
    paint: 'all',
    hiddenForMedia: ACRYLIC_HIDDEN,
    water: true,
  }),
  // Gated off 2026-11-23: the display emboss is a first-order heightmap shade
  // (one-texel gradient, black clamp, no specular) that turns to speckle as
  // strokes accumulate. The row stays so the medium record, the Reset key set
  // and the recorded thickness keep their shape; a new renderer re-enables it
  // by dropping `hidden`. See RELIEF_BUMP in the engine.
  Object.freeze({ key: 'emboss', label: 'Emboss', group: 'medium', min: EMBOSS_MIN, max: EMBOSS_MAX, paint: 'all', hidden: true }),
  Object.freeze({ key: 'load', label: 'Pigment', group: 'paint', paint: 'all' }),
  Object.freeze({
    key: 'pickup',
    label: 'Pickup',
    group: 'paint',
    paint: 'all',
    hiddenForMedia: PICKUP_HIDDEN,
  }),
  Object.freeze({
    key: 'refill',
    label: 'Refill',
    group: 'paint',
    paint: 'all',
    hiddenForMedia: REFILL_HIDDEN,
  }),
  Object.freeze({
    key: 'water',
    label: 'Water',
    group: 'drying',
    paint: 'all',
    hiddenForMedia: ACRYLIC_HIDDEN,
  }),
  Object.freeze({ key: 'dry', label: 'Dry speed', group: 'drying', paint: 'all', water: true }),
  Object.freeze({ key: 'feather', label: 'Feather', group: 'edge', paint: BRISTLE_MEDIA }),
  // Spec 10: the bristle lateral film's two knobs. Both render through the
  // existing GlobalSlider — 0 / 50 / 100 ARE the three named shapes.
  Object.freeze({ key: 'edgeFade', label: 'Edge transparency', group: 'edge', paint: BRISTLE_MEDIA }),
  Object.freeze({ key: 'edgeFalloff', label: 'Edge falloff', group: 'edge', paint: BRISTLE_MEDIA }),
  Object.freeze({ key: 'flow', label: 'Flow', group: 'watercolor', paint: WATERCOLOR_ONLY, water: true }),
  Object.freeze({ key: 'bleed', label: 'Bleed', group: 'watercolor', paint: WATERCOLOR_ONLY, water: true }),
  Object.freeze({ key: 'edge', label: 'Edges', group: 'watercolor', paint: WATERCOLOR_ONLY, water: true }),
  Object.freeze({
    key: 'granulation',
    label: 'Grain',
    group: 'watercolor',
    paint: WATERCOLOR_ONLY,
    water: true,
  }),
  Object.freeze({ key: 'lift', label: 'Lift', group: 'eraser', lift: true }),
]);

/**
 * The rows a context renders, in row order. The Eraser renders the Lift
 * row alone; the Water tool renders its own fluid set; every other tool
 * is a paint tool, where the medium (null → the canonical default)
 * decides the harvest.
 */
export function visibleAquarelleParamRows(
  tool: AquarelleTool,
  mediumId: MediumId | null,
): AquarelleParamRow[] {
  if (tool === 'lift') {
    return AQUARELLE_PARAM_ROWS.filter((row) => row.lift === true);
  }
  if (tool === 'water') {
    return AQUARELLE_PARAM_ROWS.filter((row) => row.water === true);
  }
  const medium = mediumId ?? DEFAULT_MEDIUM_ID;
  return AQUARELLE_PARAM_ROWS.filter((row) => {
    if (row.paint === undefined) return false;
    if (row.hidden === true) return false;
    if (row.paint !== 'all' && !row.paint.includes(medium)) return false;
    if (row.hiddenForMedia?.includes(medium)) return false;
    return true;
  });
}

/**
 * quick 261124-iq9: is ONE row visible in this context? A membership test
 * over {@link visibleAquarelleParamRows} — the Paint panel and the Studio top
 * bar read this same selector, so a row the panel hides can never keep a
 * top-bar slider alive (or the reverse).
 */
export function isAquarelleParamRowVisible(
  tool: AquarelleTool,
  mediumId: MediumId | null,
  key: AquarelleGlobalKey,
): boolean {
  return visibleAquarelleParamRows(tool, mediumId).some((row) => row.key === key);
}

/**
 * The same rows grouped for rendering, in the fixed group order, with
 * empty groups dropped (a heading never renders over nothing).
 */
export function visibleAquarelleParamGroups(
  tool: AquarelleTool,
  mediumId: MediumId | null,
): VisibleAquarelleParamGroup[] {
  const visible = visibleAquarelleParamRows(tool, mediumId);
  const groups: VisibleAquarelleParamGroup[] = [];
  for (const group of AQUARELLE_PARAM_GROUPS) {
    const rows = visible.filter((row) => row.group === group.id);
    if (rows.length === 0) continue;
    groups.push({ id: group.id, label: group.label, rows });
  }
  return groups;
}
