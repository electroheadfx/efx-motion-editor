/**
 * Derived flattened cache key + keyed memo (Phase 48-01 Task 2).
 *
 * CMP-04 / D-08: the flattened per-frame composite cache is keyed by a derived
 * revision TUPLE — the compositor-relevant configuration hash PLUS the terms
 * the config hash alone under-covers (Pitfall P-48-3):
 *
 *   config  — `buildEfxPaintCompositeRevision(document)` (per-track order /
 *             visible / solo / opacity / blend, background visibility +
 *             fallback);
 *   content — per-track content revision strings (store-side, 48-03: the roto
 *             physical `contentRevision` or the cached-frame dataUrl-slice
 *             idiom, previewRenderer.ts:175), sorted by track.id, LIMITED to
 *             the currently participating tracks (CMP-04 participating-only
 *             semantics — a hidden/non-soloed track's content term is absent,
 *             so its edits never churn the flattened cache; visibility/solo
 *             are already covered by the config term);
 *   bg      — `document.background.revision`;
 *   clips   — per-clip `${clip.id}:${clip.revision}` revision terms, sorted;
 *   frame   — the requested frame.
 *
 * Key building uses the canonical-encoder helpers ONLY — never ad-hoc
 * delimiter concatenation (efxPaintDocumentRevision.ts:1-11 discipline). The
 * unwired `compositeRevision` counter is deliberately NOT read (48-RESEARCH.md
 * finding c) — the config term comes solely from `buildEfxPaintCompositeRevision`.
 *
 * This module is pure: no Preact, no DOM, no store access (the
 * `efxPaintDocument.ts:1-9` purity contract). The memo is the tiny
 * store-side primitive 48-03 wires per layerId.
 */

import { buildEfxPaintCompositeRevision } from '../document/efxPaintDocumentRevision';
import {
  encodeCanonicalNumber,
  encodeCanonicalString,
  hashCanonicalPhysicalValue,
} from '../document/efxPaintCanonicalEncoder';
import type { EfxPaintDocument } from '../document/efxPaintDocument';
import { participatingPaintTracks } from './efxPaintHideSolo';

/**
 * One track's content-key term. Deterministic per (trackId, contentRevision,
 * frame); mirrors the dataUrl-slice cache-key idiom at previewRenderer.ts:175
 * with canonical length-prefixing so the term can never collide with a
 * sibling track's term.
 */
export function deriveEfxPaintTrackContentKey(
  trackId: string,
  contentRevision: string,
  frame: number,
): string {
  return `track:${encodeCanonicalString(trackId)}:${encodeCanonicalString(contentRevision)}:${encodeCanonicalNumber(frame)}`;
}

/** Inputs to {@link deriveEfxPaintFlattenedCacheKey}. */
export interface EfxPaintFlattenedCacheKeyInput {
  readonly document: EfxPaintDocument;
  /** trackId → content revision string (store-side, 48-03). */
  readonly trackContentRevisions: ReadonlyMap<string, string>;
  /** Per-clip `${clip.id}:${clip.revision}` terms (48-03 derives them). */
  readonly backgroundClipRevisions: readonly string[];
  readonly frame: number;
  /**
   * 48-05: engine-supplied track ids excluded from the participating set (the
   * Studio editing base). Empty/absent = the full participating set. The
   * `excl:` key term is emitted ONLY when non-empty so existing including-path
   * keys stay byte-identical (48-01/48-04 contract). An including call and an
   * excluding call for the same frame MUST NOT share a key even when the
   * excluded track has no content at that frame — the missing reports differ.
   */
  readonly excludeTrackIds?: readonly string[];
}

/**
 * The flattened composite cache key: one deterministic string covering every
 * CMP-04 dependency class. Iteration-order independent (track terms sort by
 * track.id, clip terms sort lexically). Equal inputs → equal key; any
 * config/content/background/clip/frame change → a different key.
 */
export function deriveEfxPaintFlattenedCacheKey(input: EfxPaintFlattenedCacheKeyInput): string {
  const { document, trackContentRevisions, backgroundClipRevisions, frame } = input;

  // Config term — necessary but NOT sufficient (Pitfall P-48-3): the content,
  // background-revision, clip, and frame terms follow it.
  const configTerm = encodeCanonicalString(buildEfxPaintCompositeRevision(document));

  // Per-track content terms sorted by track.id (localeCompare) so the key is
  // independent of the caller's Map insertion order — LIMITED to the currently
  // participating tracks (CMP-04 participating-only semantics, pinned by the
  // 48-04 invalidation matrix): a hidden or non-soloed track's content cannot
  // affect the composite, so its term is absent and a content edit to it never
  // churns the flattened cache. The config term already covers visibility/solo,
  // so re-showing a track rotates the key and forces the re-composite.
  const participatingIds = new Set(participatingPaintTracks(document).map((track) => track.id));
  const participatingEntries = [...trackContentRevisions.entries()]
    .filter(([trackId]) => participatingIds.has(trackId))
    .sort(([a], [b]) => a.localeCompare(b));
  const trackTerms = participatingEntries
    .map(([trackId, revision]) => encodeCanonicalString(trackId) + encodeCanonicalString(revision))
    .join('');

  // Background revision + sorted per-clip revision terms.
  const clipTerms = [...backgroundClipRevisions]
    .sort()
    .map((term) => encodeCanonicalString(term))
    .join('');

  // 48-05 exclusion term (sorted, length-prefixed) — emitted ONLY when the
  // caller excludes engine-supplied tracks, so the including path's keys are
  // byte-identical to the 48-01/48-04 derivation.
  const excludedIds = input.excludeTrackIds ? [...input.excludeTrackIds].sort() : [];

  const source = [
    `config:${configTerm}`,
    `tracks:${encodeCanonicalNumber(participatingEntries.length)}:${trackTerms}`,
    `bg:${encodeCanonicalNumber(document.background.revision)}`,
    `clips:${encodeCanonicalNumber(backgroundClipRevisions.length)}:${clipTerms}`,
    ...(excludedIds.length > 0
      ? [`excl:${encodeCanonicalNumber(excludedIds.length)}:${excludedIds.map((id) => encodeCanonicalString(id)).join('')}`]
      : []),
    `frame:${encodeCanonicalNumber(frame)}`,
  ].join('');

  return `flattened-${hashCanonicalPhysicalValue(source)}`;
}

/** Minimal keyed memo surface (mirrors the memo semantics at physicPaintStore.ts). */
export interface EfxPaintKeyedMemo<K, V> {
  get(key: K): V | undefined;
  /** Stores a deep-frozen copy-free value reference: `Object.freeze(value)`. */
  set(key: K, value: V): void;
  has(key: K): boolean;
  delete(key: K): boolean;
  /** Delete every entry whose key starts with `prefix` (string-keyed memos). */
  clearByPrefix(prefix: string): void;
  clear(): void;
  readonly size: number;
}

/**
 * A tiny pure keyed memo. Stored values are frozen on set (equal keys
 * overwrite, Map semantics). `clearByPrefix` mirrors the store's
 * `_deleteLayerRotoPhysicalStructuralCache` idiom (physicPaintStore.ts:460).
 */
export function createKeyedMemo<K, V>(): EfxPaintKeyedMemo<K, V> {
  const store = new Map<K, V>();
  return {
    get: (key) => store.get(key),
    set: (key, value) => {
      store.set(key, Object.freeze(value) as V);
    },
    has: (key) => store.has(key),
    delete: (key) => store.delete(key),
    clearByPrefix: (prefix) => {
      for (const key of store.keys()) {
        if (typeof key === 'string' && key.startsWith(prefix)) store.delete(key);
      }
    },
    clear: () => store.clear(),
    get size() {
      return store.size;
    },
  };
}
