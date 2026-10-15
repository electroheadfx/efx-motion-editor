// ============================================================
//  Brush-pack snapshot (56-04 / AQUA-03 / D-23 / T-56-12).
//
//  The snapshot travels in .mce as the deliberate exception to
//  the 52.2 refs-only law (D-23) — entries are opaque to the
//  host (HOST-02: BrushPackSnapshot.entries: readonly unknown[]).
//  This module is the pack-side producer/validator: it is the one
//  place that knows entry shape, and it is total + fail-closed
//  (T-56-12) — null on any malformed shape or duplicate ids,
//  never a throw, never a silent overwrite.
//
//  Ordering law (flagged assumption): entries round-trip in
//  insertion order; category grouping is derived from each tip's
//  category field, never from array position.
// ============================================================

import type { BrushPackSnapshot } from '@efxlab/efx-paint-host'
import type { AquarelleTip, AquarelleTipCategory, AquarelleToolOverrides } from './tips'
import { TOOL_OVERRIDE_FIELDS } from './tips'

/** Snapshot namespace for the aquarelle pack. */
export const BRUSH_PACK_KIND = 'efx-watercolor'

const CATEGORIES: ReadonlySet<string> = new Set<AquarelleTipCategory>([
  'round',
  'flat',
  'texture',
  'experimental',
  'custom',
])

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isTipRecord(v: unknown): v is AquarelleTip {
  if (typeof v !== 'object' || v === null) return false
  const rec = v as Record<string, unknown>
  if (typeof rec.id !== 'string' || rec.id.length === 0) return false
  if (typeof rec.name !== 'string' || rec.name.length === 0) return false
  if (typeof rec.category !== 'string' || !CATEGORIES.has(rec.category)) return false
  for (const field of TOOL_OVERRIDE_FIELDS) {
    if (!isFiniteNumber(rec[field])) return false
  }
  return true
}

/**
 * Build the serializable brush-pack snapshot from a tip list.
 * Fail-closed on duplicate ids — never a silent overwrite.
 * Entries are plain records (deep-equal to the input tips) so the
 * snapshot is JSON-safe for the .mce carrier.
 */
export function buildBrushPackSnapshot(
  tips: readonly AquarelleTip[],
): BrushPackSnapshot | null {
  const seen = new Set<string>()
  const entries: AquarelleTip[] = []
  for (const tip of tips) {
    if (!isTipRecord(tip)) return null
    if (seen.has(tip.id)) return null
    seen.add(tip.id)
    entries.push({ ...tip })
  }
  return { kind: BRUSH_PACK_KIND, entries }
}

/**
 * Parse a brush-pack snapshot. Total and fail-closed — null on any
 * malformed shape, wrong kind, or duplicate entry ids, never a throw.
 * An empty entries array is a valid snapshot (parse total).
 */
export function parseBrushPackSnapshot(raw: unknown): BrushPackSnapshot | null {
  if (typeof raw !== 'object' || raw === null) return null
  const rec = raw as Record<string, unknown>
  if (rec.kind !== BRUSH_PACK_KIND) return null
  if (!Array.isArray(rec.entries)) return null

  const seen = new Set<string>()
  const entries: AquarelleTip[] = []
  for (const entry of rec.entries) {
    if (!isTipRecord(entry)) return null
    if (seen.has(entry.id)) return null
    seen.add(entry.id)
    entries.push({ ...entry })
  }
  return { kind: BRUSH_PACK_KIND, entries }
}

/** Narrow an opaque snapshot entry back to a tip record (total). */
export function asTipRecord(entry: unknown): AquarelleTip | null {
  return isTipRecord(entry) ? { ...entry } : null
}

/** Re-export the overrides projection type for pack consumers. */
export type { AquarelleToolOverrides }
