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
//  2026-11-27 (artist's live ruling): Emboss returns to the UI as a
//  0..5 test band in a trailing Relief section; the display relief is
//  lit again and the Medium record defaults it to 0. The signed band's
//  negative half is retired from the ROW; the engine still honours a
//  negative recorded emboss. The Grain row's control is a fixed Paint-tab
//  top row (after Brush size), so the group row is hidden here (the key
//  keeps its Reset/persistence).
// ============================================================

import { DEFAULT_MEDIUM_ID, type MediumId } from '@efxlab/efx-watercolor';
import type { AquarelleTool } from '@efxlab/efx-watercolor/payload';
import type { AquarelleGlobalKey } from './aquarelleRecordState';

export type AquarelleParamGroupId =
  | 'medium'
  | 'paint'
  | 'drying'
  | 'noise'
  | 'watercolor'
  | 'relief'
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
   * gated off or its control lives elsewhere: the row stays in the list (and
   * keeps its band) so the medium record, the Reset key set and the
   * persistence keep working, but no panel renders it. See the Feather and
   * Grain rows.
   */
  readonly hidden?: boolean;
  /**
   * The row STORES transparency (0 = opaque) but renders and edits OPACITY
   * (max = opaque). The panel inverts for display and maps back on change, so
   * the stored keys, the medium records and the engine keep the shipped
   * transparency semantics. See the Opacity row.
   */
  readonly invert?: boolean;
  readonly water?: boolean;
  readonly lift?: boolean;
}

export interface VisibleAquarelleParamGroup {
  readonly id: AquarelleParamGroupId;
  readonly label: string;
  readonly rows: readonly AquarelleParamRow[];
}

/** Fixed group order (spec §8). An empty group renders no heading.
 *  2026-11-27 (artist's live ruling): the Transparency group is RETIRED — its
 *  lateral fade read as a zebra band where a stroke's edge crossed a
 *  contrasting under. The surviving transparency is ONE global amount
 *  (`edgeFade`, relabelled Transparency) and lives in Paint & reservoir under
 *  Pickup; its falloff row is gone with the lateral law. `noise` keeps the
 *  break-up pair (Feather noise / Feather falloff, Spec 11). `relief` is the
 *  trailing Emboss section (2026-11-27). */
export const AQUARELLE_PARAM_GROUPS: readonly AquarelleParamGroup[] = Object.freeze([
  Object.freeze({ id: 'medium', label: 'Medium' }),
  Object.freeze({ id: 'paint', label: 'Paint & reservoir' }),
  Object.freeze({ id: 'drying', label: 'Drying' }),
  Object.freeze({ id: 'noise', label: 'Noise' }),
  Object.freeze({ id: 'watercolor', label: 'Watercolor only' }),
  // 2026-11-27 (artist's live ruling): Emboss moves to its own trailing
  // section — the Paint tab ends with the relief setup.
  Object.freeze({ id: 'relief', label: 'Relief' }),
  Object.freeze({ id: 'eraser', label: 'Eraser' }),
]);

/** Post-UAT (2026-11-21): emboss relief is very hard above 15, so the
 *  row's band is capped here — this is the ONE home of the cap (the
 *  panel only forwards `row.max`).
 *  2026-11-27 (artist's live ruling): the row is back for a low-value
 *  test — 0..5 — in the trailing Relief section, and the Medium record
 *  defaults it to 0. The engine still honours a negative recorded
 *  emboss (the row no longer offers one). This pair is the ONE home of
 *  the band (the panel only forwards `row.min/max`). */
const EMBOSS_MIN = 0;
const EMBOSS_MAX = 5;

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
 * The sixteen rows in Matrix 2's order (fifteen canvas rows + the
 * Eraser-context Lift row). The 16-key count is what makes the Reset
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
  Object.freeze({ key: 'load', label: 'Pigment', group: 'paint', paint: 'all' }),
  Object.freeze({
    key: 'pickup',
    label: 'Pickup',
    group: 'paint',
    paint: 'all',
    hiddenForMedia: PICKUP_HIDDEN,
  }),
  // 2026-11-27 (artist's live ruling): Edge transparency's lateral fade is
  // retired; the SAME `edgeFade` key is now ONE global transparency, moved
  // into Paint & reservoir under Pickup. The row renders as OPACITY — 100 is
  // opaque (the default), 0 fully transparent (`invert`; the stored key
  // keeps the transparency semantics), and the former Edge falloff row is
  // gone with the lateral law.
  Object.freeze({
    key: 'edgeFade',
    label: 'Opacity',
    group: 'paint',
    paint: BRISTLE_MEDIA,
    invert: true,
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
  // quick 261127-jox: HIDDEN (Emboss precedent). The legacy Feather amplitude
  // row is a duplicate control — quick 261126-v8j re-indexed `featherNoise` to
  // own the same edge raggedness (0 zeroes it, 20 is the shipped base look,
  // above 20 breaks the body up). The key stays in AQUARELLE_GLOBAL_KEYS, both
  // medium records, the per-stroke bag and the Reset write set, and the engine
  // still multiplies by the recorded Feather; only the ROW is hidden.
  Object.freeze({ key: 'feather', label: 'Feather', group: 'noise', paint: BRISTLE_MEDIA, hidden: true }),
  // Spec 11: the break-up pair — the Noise section's pair. Same BRISTLE_MEDIA
  // law and the same GlobalSlider; `featherNoise` 0 is the clean edge, 20 the
  // neutral base look and 100 the full break-up, while `featherFalloff` 50 is
  // the shipped opening.
  Object.freeze({ key: 'featherNoise', label: 'Feather noise', group: 'noise', paint: BRISTLE_MEDIA }),
  Object.freeze({ key: 'featherFalloff', label: 'Feather falloff', group: 'noise', paint: BRISTLE_MEDIA }),
  Object.freeze({ key: 'flow', label: 'Flow', group: 'watercolor', paint: WATERCOLOR_ONLY, water: true }),
  Object.freeze({ key: 'bleed', label: 'Bleed', group: 'watercolor', paint: WATERCOLOR_ONLY, water: true }),
  Object.freeze({ key: 'edge', label: 'Edges', group: 'watercolor', paint: WATERCOLOR_ONLY, water: true }),
  // 2026-11-27 (artist's live ruling): the Grain control is the Paint tab's
  // FIXED top row, rendered right after Brush size under every medium (it is
  // a global knob to the artist, not a Watercolor-only group row). The ROW
  // stays in the table — hidden from the group list — so the medium record,
  // the Reset key set, the per-stroke bag and the persistence keep their
  // shape (the Feather precedent).
  Object.freeze({
    key: 'granulation',
    label: 'Grain',
    group: 'watercolor',
    paint: WATERCOLOR_ONLY,
    water: true,
    hidden: true,
  }),
  // 2026-11-27 (artist's live ruling): the Emboss setup closes the Paint tab —
  // its own trailing Relief section, tested at 0..5. The display relief was
  // gated off on 2026-11-23 (the first-order heightmap shade turns to speckle
  // as strokes accumulate); it is lit again for this test. See RELIEF_BUMP.
  Object.freeze({ key: 'emboss', label: 'Emboss', group: 'relief', min: EMBOSS_MIN, max: EMBOSS_MAX, paint: 'all' }),
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
    return AQUARELLE_PARAM_ROWS.filter((row) => row.lift === true && row.hidden !== true);
  }
  if (tool === 'water') {
    return AQUARELLE_PARAM_ROWS.filter((row) => row.water === true && row.hidden !== true);
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
