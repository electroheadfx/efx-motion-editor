/**
 * Hide/solo truth table for internal Paint tracks (Phase 48-01 Task 1).
 *
 * Pure — takes the validated document, never the store (CMP-02, D-04). This
 * predicate is the single source of truth for which Paint tracks join the
 * flattened composite; the Phase 47 active-track-only predecessor
 * (`resolvePhysicPaintTrackVisibility` in `app/src/lib/previewRenderer.ts`)
 * stays for its remaining consumers until 48-03.
 *
 * Truth table (locked, Pitfall M8):
 * - no solo armed → every track whose `visible !== false` participates;
 * - any solo armed → only tracks that are `visible !== false` AND soloed;
 * - hide always wins over solo: a hidden track never participates AND its
 *   solo flag never arms solo mode (edge CMP-02 adjacency — a hidden+soloed
 *   track leaves other visible tracks visible);
 * - unknown track or absent document fails closed to not-participating
 *   (an absent track cannot appear in the typed document at all).
 *
 * Ordering: tracks sort by `order` ascending for compositing; equal orders
 * break deterministically by `track.id` localeCompare. Identity is always
 * `track.id`, never an array index or `order` (Pitfall 1).
 */

import type { EfxPaintDocument, InternalPaintTrack } from '../document/efxPaintDocument';

/**
 * The participating Paint tracks for one frame, bottom-to-top in stable
 * compositing order (order ascending, ties broken by track.id).
 */
export function participatingPaintTracks(document: EfxPaintDocument): InternalPaintTrack[] {
  const ordered = [...document.tracks].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.id.localeCompare(b.id);
  });
  // A hidden track's solo never arms solo mode (hide wins over solo), so solo
  // arming considers only visible tracks.
  const soloArmed = ordered.some((track) => track.visible !== false && track.solo === true);
  return ordered.filter((track) => {
    if (track.visible === false) return false;
    if (!soloArmed) return true;
    return track.solo === true;
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
