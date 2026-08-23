/**
 * Clean-break rejection gate predicate (Phase 45-03).
 *
 * v1.0.0 intentionally does not open, migrate, or render pre-v1.0 EFX Physic
 * Paint data (D-04/D-05). This module is the single parse-time gate: a pure,
 * contract-testable scan over the raw parsed `.mce` JSON, run before any UI
 * or store hydration (D-06, Pitfall F2).
 *
 * The predicate is deliberately structure-discriminated so the app's own new
 * v1.0 projects (which also contain `'physic-paint'` layers) are never
 * rejected: a `'physic-paint'` layer is only a trigger when the top-level
 * `efx_paint_documents` map has no entry for its layer id.
 *
 * Contract (D-05/D-06/D-07):
 * - Pure: never mutates the parsed project, never reads sidecar files, never
 *   touches the filesystem, never performs IPC.
 * - Fail-closed scan: non-record input returns null — the gate scans, it does
 *   not throw; true parse corruption remains the existing open/serde concern.
 * - Fixed precedence: outputs → cache-reference → documentless-layer; the
 *   FIRST matching reason is returned.
 * - Reasons are terminal: no auto-fix, migration hint, converter branch, or
 *   stripped-copy suggestion (D-07).
 */

/** Typed reason a pre-v1.0 project is rejected, consumed by the 45-05 dialog. */
export type LegacyPhysicPaintRejection =
  | { readonly kind: 'legacy-physic-paint-outputs' }
  | { readonly kind: 'legacy-physic-paint-cache-reference'; readonly path: string }
  | { readonly kind: 'physic-paint-layer-without-document'; readonly layerId: string };

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Return the first legacy Physic Paint rejection reason for a raw parsed
 * `.mce` project, or null when the project passes the gate.
 *
 * Fixed precedence: non-empty `physic_paint_outputs` → legacy cache reference
 * → `'physic-paint'` layer without a v1.0 document entry. Triggers 2-3 land
 * in Task 2 of plan 45-03.
 */
export function findLegacyPhysicPaintRejection(
  project: unknown,
): LegacyPhysicPaintRejection | null {
  if (!isPlainRecord(project)) return null;

  // Trigger 1: non-empty physic_paint_outputs array at top level (D-06).
  if (Array.isArray(project.physic_paint_outputs) && project.physic_paint_outputs.length > 0) {
    return { kind: 'legacy-physic-paint-outputs' };
  }

  return null;
}
