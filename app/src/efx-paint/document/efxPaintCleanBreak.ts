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

/** Legacy cache directory prefix the gate scans for (physicPaintPersistence.ts:17). */
const PHYSIC_PAINT_CACHE_PREFIX = 'cache/physic-paint';

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
 * Scan every string value in the project JSON (depth-first, insertion order)
 * for the legacy `cache/physic-paint` prefix and report the first offending
 * path, or null when none exists.
 */
function findLegacyCacheReference(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.startsWith(PHYSIC_PAINT_CACHE_PREFIX) ? value : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findLegacyCacheReference(item);
      if (found !== null) return found;
    }
    return null;
  }
  if (isPlainRecord(value)) {
    for (const key of Object.keys(value)) {
      const found = findLegacyCacheReference(value[key]);
      if (found !== null) return found;
    }
    return null;
  }
  return null;
}

/** Resolve the layer id a `'physic-paint'` layer is keyed by (source.layer_id, falling back to layer.id). */
function resolvePhysicPaintLayerId(layer: Record<string, unknown>): string {
  const source = isPlainRecord(layer.source) ? layer.source : null;
  const sourceLayerId =
    source && typeof source.layer_id === 'string' && source.layer_id.length > 0
      ? source.layer_id
      : null;
  if (sourceLayerId !== null) return sourceLayerId;
  return typeof layer.id === 'string' && layer.id.length > 0 ? layer.id : '';
}

/**
 * Collect every `'physic-paint'` layer across all sequences and return the
 * first whose layer id has no top-level `efx_paint_documents` entry, or null
 * when every physic-paint layer is backed by a document (Pitfall F2).
 */
function findDocumentlessPhysicPaintLayer(project: Record<string, unknown>): string | null {
  const documents = isPlainRecord(project.efx_paint_documents) ? project.efx_paint_documents : null;
  const sequences = project.sequences;
  if (!Array.isArray(sequences)) return null;
  for (const sequence of sequences) {
    if (!isPlainRecord(sequence)) continue;
    const layers = sequence.layers;
    if (!Array.isArray(layers)) continue;
    for (const layer of layers) {
      if (!isPlainRecord(layer)) continue;
      if (layer.type !== 'physic-paint') continue;
      const layerId = resolvePhysicPaintLayerId(layer);
      if (documents === null || !Object.prototype.hasOwnProperty.call(documents, layerId)) {
        return layerId;
      }
    }
  }
  return null;
}

/**
 * Return the first legacy Physic Paint rejection reason for a raw parsed
 * `.mce` project, or null when the project passes the gate.
 *
 * Fixed precedence: non-empty `physic_paint_outputs` → legacy cache reference
 * → `'physic-paint'` layer without a v1.0 document entry.
 */
export function findLegacyPhysicPaintRejection(
  project: unknown,
): LegacyPhysicPaintRejection | null {
  if (!isPlainRecord(project)) return null;

  // Trigger 1: non-empty physic_paint_outputs array at top level (D-06).
  if (Array.isArray(project.physic_paint_outputs) && project.physic_paint_outputs.length > 0) {
    return { kind: 'legacy-physic-paint-outputs' };
  }

  // Trigger 2: any legacy cache/physic-paint path reference anywhere in the JSON.
  const cacheReference = findLegacyCacheReference(project);
  if (cacheReference !== null) {
    return { kind: 'legacy-physic-paint-cache-reference', path: cacheReference };
  }

  // Trigger 3: a 'physic-paint' layer with no v1.0 document entry (F2 discrimination).
  const layerId = findDocumentlessPhysicPaintLayer(project);
  if (layerId !== null) {
    return { kind: 'physic-paint-layer-without-document', layerId };
  }

  return null;
}
