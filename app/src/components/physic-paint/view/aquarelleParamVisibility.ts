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
//  the Acrylic medium (its record fixes 0) AND for the Watercolor
//  medium — the engine binds `uRefillRate` only into the bristle
//  carrier (`bristleCarrierFS`), so the fluid row is dead. The row
//  STAYS visible for gouache / chalk / graphite: that exposure is
//  the artist's DEFERRED decision, and their records keep 60.
//
//  quick 261121-mtu (rev 3): PICKUP follows the same audit — the
//  engine binds it only as the bristle carrier rate (`uPickupRate`)
//  and the gather's smear (`uSmear`), so the watercolor context
//  hides it too. Gouache / chalk / graphite keep it as the same
//  DEFERRED class.
//
//  `body` has no row anywhere (bag-only, Reset-only) and
//  `wetSeconds` has no row (it is seconds, not a 0..100 global) —
//  neither appears in `AQUARELLE_PARAM_ROWS` by design.
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
 *  panel only forwards `row.max`). */
const EMBOSS_MAX = 15;

const WATERCOLOR_ONLY: readonly MediumId[] = Object.freeze(['watercolor']);
/** Every bristle medium — Feather is the bristle band's width (spec §3). */
const BRISTLE_MEDIA: readonly MediumId[] = Object.freeze([
  'gouache',
  'pastel',
  'graphite',
  'acrylic',
]);
/** Decision B: Acrylic fixes Refill at 0; the fluid path never reads it. */
const REFILL_HIDDEN: readonly MediumId[] = Object.freeze(['acrylic', 'watercolor']);
/**
 * quick 261121-mtu (rev 3): Pickup is the bristle carrier's reservoir rate
 * (`uPickupRate`) and the gather's deposit smear (`uSmear`) — the ONLY two
 * bindings. The fluid path reads neither, so the row is dead for the fluid
 * watercolor context and hidden there. Gouache / chalk / graphite are also
 * non-bristle but keep the row: that exposure is the artist's DEFERRED
 * decision, same class as Refill.
 */
const PICKUP_HIDDEN: readonly MediumId[] = Object.freeze(['watercolor']);

/**
 * The thirteen rows in Matrix 2's order (twelve canvas rows + the
 * Eraser-context Lift row). The 13-key count is what makes the Reset
 * key set (`rows - lift` + `body`) reproduce the shipped patch.
 */
export const AQUARELLE_PARAM_ROWS: readonly AquarelleParamRow[] = Object.freeze([
  Object.freeze({ key: 'viscosity', label: 'Viscosity', group: 'medium', paint: 'all', water: true }),
  Object.freeze({ key: 'emboss', label: 'Emboss', group: 'medium', max: EMBOSS_MAX, paint: 'all' }),
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
  Object.freeze({ key: 'water', label: 'Water', group: 'drying', paint: 'all' }),
  Object.freeze({ key: 'dry', label: 'Dry speed', group: 'drying', paint: 'all', water: true }),
  Object.freeze({ key: 'feather', label: 'Feather', group: 'edge', paint: BRISTLE_MEDIA }),
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
    if (row.paint !== 'all' && !row.paint.includes(medium)) return false;
    if (row.hiddenForMedia?.includes(medium)) return false;
    return true;
  });
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
