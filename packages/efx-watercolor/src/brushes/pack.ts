// ============================================================
//  Brush-pack snapshot (56-04 / AQUA-03 / D-23 / T-56-12).
//
//  The snapshot travels in .mce as the deliberate exception to
//  the 52.2 refs-only law — entries are opaque to the host.
//
//  RED stub — named surface exists so pack.test.ts collects, but
//  both builders return a wrong-kind placeholder. Real builders
//  land in the GREEN step.
// ============================================================

import type { BrushPackSnapshot } from '@efxlab/efx-paint-host'
import type { AquarelleTip } from './tips'

/** Snapshot namespace for the aquarelle pack. */
export const BRUSH_PACK_KIND = 'efx-watercolor'

/**
 * Build the serializable brush-pack snapshot from a tip list.
 *
 * RED stub: returns a wrong-kind placeholder.
 */
export function buildBrushPackSnapshot(
  tips: readonly AquarelleTip[],
): BrushPackSnapshot | null {
  void tips
  return { kind: 'build-stub', entries: [] }
}

/**
 * Parse a brush-pack snapshot. Total and fail-closed — null on any
 * malformed shape or duplicate entry ids, never a throw.
 *
 * RED stub: returns a wrong-kind placeholder.
 */
export function parseBrushPackSnapshot(raw: unknown): BrushPackSnapshot | null {
  void raw
  return { kind: 'parse-stub', entries: [] }
}
