/**
 * quick-260922-al1: the Scripts panel's layer scope is PROJECT-scoped state —
 * every Action is visible from every physic-paint layer, and the selector
 * narrows ONLY the rendered list. This module is the whole model of that
 * narrowing, deliberately pure (no signals, no DOM, no imports from the
 * clipboard, the bridge or the library controller) so the rules below are
 * unit-provable in isolation from the panel that renders them.
 *
 * Three rules, and each exists to keep a degraded input from reading as DATA
 * LOSS rather than as a filter:
 *  - fail OPEN on an unknown scope id (`filterScriptRows` returns every row):
 *    a scope that matches nothing can only be a stale or dead id, never a
 *    legitimate empty view, so it must never render as an empty library;
 *  - orphans (a row whose origin layer no longer exists) appear ONLY under All —
 *    they can never own a filter entry, because entries come from the LIVE
 *    layer list;
 *  - provenance is resolved HERE and nowhere else: a live layer contributes its
 *    CURRENT name, an orphan keeps the name snapshotted at save time and is
 *    flagged `unavailable` so the row can say so.
 *
 * All of it is signature-stable: nothing here mutates its inputs.
 */
import type { PhysicPaintProjectContextLayer } from '../../../types/physicPaint';

/** The scope value that means "no filter" — always present, always first. */
export const ROTO_SCRIPT_SCOPE_ALL = 'all';

/**
 * The row shape this model reads. Structural on purpose: the real
 * `RotoScriptLibraryRow` satisfies it, and so does a hand-built test row.
 */
export interface RotoScriptScopeRow {
  readonly id: string;
  readonly source: {
    readonly layerId: string;
    readonly layerName: string;
  };
}

export interface RotoScriptScopeEntry {
  readonly id: string;
  readonly label: string;
}

/**
 * The selector's options: All first, then one entry per LIVE layer that owns at
 * least one row, in the live layer list's own order.
 *
 * A layer that owns no row gets NO entry (there would be nothing to see), and an
 * orphan layer id — present in rows, absent from `layers` — gets no entry
 * either, so a dead layer can never be selected. A duplicated live name keeps
 * both entries: ids stay distinct and the label is the artist's own naming,
 * which this model does not second-guess. `currentScope` is read for exactly
 * one purpose — never to invent a phantom entry for a scope the selector cannot
 * render; a scope naming a hidden or unknown layer simply falls back to All in
 * the `<select>`.
 */
export function buildScriptScopeEntries(
  rows: readonly RotoScriptScopeRow[],
  layers: readonly PhysicPaintProjectContextLayer[],
  _currentScope?: string,
): RotoScriptScopeEntry[] {
  const owned = new Set(rows.map((row) => row.source.layerId));
  const entries: RotoScriptScopeEntry[] = [{ id: ROTO_SCRIPT_SCOPE_ALL, label: 'All' }];
  for (const layer of layers) {
    if (!owned.has(layer.id)) continue;
    entries.push({ id: layer.id, label: layer.name });
  }
  return entries;
}

/**
 * The rendered list. `'all'` is the identity projection; a live layer id keeps
 * only that layer's rows; ANY other id — unknown, dead, malformed — returns
 * every row. The order is the controller's own (createdAt-desc), never
 * re-sorted here, and orphans therefore surface under All only.
 */
export function filterScriptRows<T extends RotoScriptScopeRow>(rows: readonly T[], scopeId: string): readonly T[] {
  if (scopeId === ROTO_SCRIPT_SCOPE_ALL) return rows;
  const matching = rows.filter((row) => row.source.layerId === scopeId);
  // Fail open: an id that matches nothing is a stale scope, not an empty view.
  return matching.length ? matching : rows;
}

export interface RotoScriptProvenance {
  readonly layerId: string;
  readonly layerName: string;
  readonly unavailable: boolean;
}

/**
 * The row's provenance line. A layer still in the live list resolves its
 * CURRENT display name, so a rename is reflected everywhere at once; a layer
 * the live list no longer carries — the orphan case — keeps the name
 * snapshotted at save time and is marked `unavailable`, which is the only
 * signal the panel needs to render its subtle marker.
 */
export function resolveScriptProvenance(
  row: RotoScriptScopeRow,
  layers: readonly PhysicPaintProjectContextLayer[],
): RotoScriptProvenance {
  const live = layers.find((layer) => layer.id === row.source.layerId);
  return live
    ? { layerId: row.source.layerId, layerName: live.name, unavailable: false }
    : { layerId: row.source.layerId, layerName: row.source.layerName, unavailable: true };
}
