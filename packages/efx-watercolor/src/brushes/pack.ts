// ============================================================
//  Brush-pack snapshot (56-04 / AQUA-03 / D-23 → 63-04 / D-10).
//
//  The snapshot travels in TWO carriers with one entry shape each
//  (63-04):
//    · package — the `.mce` root `brushPack`: entries carry a
//                package-relative `asset` ref (exactly
//                `brushes/<64 lower-case hex>.webp`); inline
//                `mask` / `maskDataUrl` are REFUSED (D-10/D-11).
//    · script  — a Roto script's `brushPack`: entries carry the
//                inline `maskDataUrl`; an `asset` ref is REFUSED
//                (a script must not point into a package).
//  A member literally named `mask` is refused in BOTH modes — the
//  retired D-23 inline carrier, rewritten by 63-04 (T-63-06).
//
//  Entries are opaque to the host (HOST-02:
//  BrushPackSnapshot.entries: readonly unknown[]). This module is
//  the pack-side producer/validator: it is the one place that
//  knows entry shape, and it is total + fail-closed (T-56-12) —
//  null on any malformed shape or duplicate ids, never a throw,
//  never a silent overwrite. The app-side path contract
//  (`efxPaintPackage.ts#parseBrushAssetRelativePath`) and the Rust
//  bound guard independently re-validate an asset ref (T-63-15).
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

/**
 * Which carrier an entry travels in (63-04). `package` is the `.mce` root
 * `brushPack` (asset refs); `script` is a Roto script's `brushPack` (inline
 * `maskDataUrl`). The two entry shapes are mutually exclusive.
 */
export type TipCarrierMode = 'package' | 'script'

/** The ONE asset-ref shape a package entry may carry (T-63-15). */
const BRUSH_ASSET_REF = /^brushes\/[0-9a-f]{64}\.webp$/

/**
 * Fail-closed asset-ref predicate, the pack-side mirror of the app's
 * `parseBrushAssetRelativePath`: exactly `brushes/<64 lower-case hex>.webp`,
 * so no external path, no nested segment and no foreign extension can ride
 * an entry. The Rust bound guard re-validates the same shape on disk.
 */
function isBrushAssetRef(value: unknown): value is string {
  return typeof value === 'string' && BRUSH_ASSET_REF.test(value)
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function hasMember(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

function isTipRecord(v: unknown, mode: TipCarrierMode): v is AquarelleTip {
  if (typeof v !== 'object' || v === null) return false
  const rec = v as Record<string, unknown>
  if (typeof rec.id !== 'string' || rec.id.length === 0) return false
  if (typeof rec.name !== 'string' || rec.name.length === 0) return false
  if (typeof rec.category !== 'string' || !CATEGORIES.has(rec.category)) return false
  for (const field of TOOL_OVERRIDE_FIELDS) {
    if (!isFiniteNumber(rec[field])) return false
  }
  // The retired D-23 inline field is refused in BOTH carriers: a package
  // stores an asset ref and a script stores a maskDataUrl (T-63-06).
  if (hasMember(rec, 'mask')) return false
  if (mode === 'package') {
    if (hasMember(rec, 'maskDataUrl')) return false
    if (hasMember(rec, 'asset') && !isBrushAssetRef(rec.asset)) return false
  } else {
    if (hasMember(rec, 'asset')) return false
    if (hasMember(rec, 'maskDataUrl') && typeof rec.maskDataUrl !== 'string') return false
  }
  return true
}

/**
 * Build the serializable brush-pack snapshot from a tip list.
 * Fail-closed on duplicate ids — never a silent overwrite. Entries
 * are plain records (deep-equal to the input tips) so the snapshot
 * is JSON-safe for its carrier. Defaults to the package carrier:
 * every `asset` ref is validated, inline carriers are refused.
 */
export function buildBrushPackSnapshot(
  tips: readonly AquarelleTip[],
  mode: TipCarrierMode = 'package',
): BrushPackSnapshot | null {
  const seen = new Set<string>()
  const entries: AquarelleTip[] = []
  for (const tip of tips) {
    if (!isTipRecord(tip, mode)) return null
    if (seen.has(tip.id)) return null
    seen.add(tip.id)
    entries.push({ ...tip })
  }
  return { kind: BRUSH_PACK_KIND, entries }
}

/**
 * Parse a brush-pack snapshot. Total and fail-closed — null on any
 * malformed shape, wrong kind, or duplicate entry ids, never a throw.
 * An empty entries array is a valid snapshot (parse total). `mode`
 * selects the carrier law the entries must satisfy.
 */
export function parseBrushPackSnapshot(
  raw: unknown,
  mode: TipCarrierMode = 'package',
): BrushPackSnapshot | null {
  if (typeof raw !== 'object' || raw === null) return null
  const rec = raw as Record<string, unknown>
  if (rec.kind !== BRUSH_PACK_KIND) return null
  if (!Array.isArray(rec.entries)) return null

  const seen = new Set<string>()
  const entries: AquarelleTip[] = []
  for (const entry of rec.entries) {
    if (!isTipRecord(entry, mode)) return null
    if (seen.has(entry.id)) return null
    seen.add(entry.id)
    entries.push({ ...entry })
  }
  return { kind: BRUSH_PACK_KIND, entries }
}

/** Narrow an opaque snapshot entry back to a tip record (total). */
export function asTipRecord(
  entry: unknown,
  mode: TipCarrierMode = 'package',
): AquarelleTip | null {
  return isTipRecord(entry, mode) ? { ...entry } : null
}

/** Re-export the overrides projection type for pack consumers. */
export type { AquarelleToolOverrides }
