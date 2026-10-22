/**
 * Hide/solo truth table for internal Paint tracks (Phase 48-01 Task 1;
 * quick 261022-iff replaced the persisted per-track flag with ONE session
 * focus).
 *
 * Pure — takes the validated document, never the store (CMP-02, D-04). This
 * predicate is the single source of truth for which Paint tracks join the
 * flattened composite (the compositor, the flattened cache key and the store
 * all consume it — no view-side filtering, no second truth table).
 *
 * Truth table (locked):
 * - no solo target → every track whose `visible !== false` participates;
 * - a solo target (`soloTrackId`, the session anchor) → only the track whose
 *   id equals the target participates, AND only when it is visible;
 * - hide always wins over solo: a hidden track never participates, so a
 *   hidden solo target leaves NO Paint track in the composite (D-04, IFF-05);
 * - an unknown target fails closed to not-participating.
 *
 * The arm is SESSION-ONLY and selection-followed: the caller supplies the
 * target (the document's active track id) — it is never stored, never written
 * to the document, and never persisted. The persisted `track.solo` field stays
 * in the wire schema (the exact-key parser accepts previously saved documents)
 * but is deliberately never read here — a lingering flag is inert (T-iff-02).
 *
 * Ordering: tracks sort by `order` ascending for compositing; equal orders
 * break deterministically by `track.id` localeCompare. Identity is always
 * `track.id`, never an array index or `order` (Pitfall 1).
 */

import type { EfxPaintDocument, InternalPaintTrack } from '../document/efxPaintDocument';

/**
 * The participating Paint tracks for one frame, bottom-to-top in stable
 * compositing order (order ascending, ties broken by track.id). `soloTrackId`
 * is the optional session focus (the active track); null/omitted = disarmed.
 */
export function participatingPaintTracks(
  document: EfxPaintDocument,
  soloTrackId: string | null = null,
): InternalPaintTrack[] {
  const ordered = [...document.tracks].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.id.localeCompare(b.id);
  });
  return ordered.filter((track) => {
    // Hide wins over solo: a hidden track never participates, and a hidden
    // solo target therefore leaves no Paint track at all (IFF-05).
    if (track.visible === false) return false;
    if (soloTrackId === null) return true;
    return track.id === soloTrackId;
  });
}

/**
 * Whether the fixed Background track participates in the flattened composite.
 * Governed ONLY by `document.background.visible` (D-04): the Background never
 * joins the Paint solo truth table — a Paint solo leaves it visible.
 */
export function backgroundParticipates(document: EfxPaintDocument): boolean {
  return document.background.visible === true;
}
