/**
 * Deterministic document/track/composite revision builders (Phase 45-01
 * Task 3).
 *
 * Mirrors the canonical encoding of `buildPhysicPaintRotoPhysicalRevision`:
 * validate-then-hash; records sorted by stable identity (track id
 * localeCompare); strings length-prefixed to prevent delimiter collisions;
 * empty additive collections (frames, loopClips, background clips)
 * contribute NO term (D-29 idiom). The fingerprint is a non-cryptographic
 * change-detection lease, not a security boundary.
 */

import {
  buildPhysicPaintRotoPhysicalRevision,
} from '../../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import {
  encodeCanonicalNumber,
  encodeCanonicalString,
  hashCanonicalPhysicalValue,
  validatedBoolean,
} from './efxPaintCanonicalEncoder';
import type {
  BackgroundFallback,
  EfxPaintDocument,
  FrameLoopClip,
  InternalPaintTrack,
  PhotoReferenceTrack,
} from './efxPaintDocument';
import { parseEfxPaintDocument, parseInternalPaintTrack } from './efxPaintDocumentParsers';

/**
 * Canonical per-mode fallback term (49-03): the single source of truth for the
 * fallback's content encoding, shared by the document/composite revisions AND
 * the flattened cache key's dedicated `fallback:` term — no second hand-written
 * switch that can drift (T-49-03-02).
 */
export function encodeCanonicalBackgroundFallback(fallback: BackgroundFallback): string {
  if (fallback.mode === 'transparent') return 'transparent;';
  if (fallback.mode === 'solid') return `solid:${encodeCanonicalString(fallback.color)}`;
  return `paper:${encodeCanonicalString(fallback.texture)}:${validatedBoolean(fallback.paperGrain)}:${encodeCanonicalNumber(fallback.grainStrength)}`;
}

function encodeCanonicalLoopClips(clips: readonly FrameLoopClip[]): string {
  const ordered = [...clips].sort((a, b) => a.id.localeCompare(b.id));
  return `${ordered.length}:${ordered.map((clip) => [
    encodeCanonicalString(clip.id),
    encodeCanonicalNumber(clip.startFrame),
    `${clip.sourceFrameRefs.length}:${clip.sourceFrameRefs.map(encodeCanonicalString).join('')}`,
    clip.repeat.mode === 'finite'
      ? `finite:${encodeCanonicalNumber(clip.repeat.count)}`
      : 'infinite;',
    encodeCanonicalString(clip.sourceKind),
    encodeCanonicalNumber(clip.revision),
    // 49-06 (UAT round 9): the scale is part of the clip content — a scale
    // change must rotate the document revision (and thus the flattened cache
    // key) so the composite re-renders with the new draw size.
    `scale:${encodeCanonicalNumber((clip.scale ?? { x: 100, y: 100 }).x)}:${encodeCanonicalNumber((clip.scale ?? { x: 100, y: 100 }).y)}`,
  ].join('')).join('')}`;
}

function encodeValidatedEfxPaintTrackContent(track: InternalPaintTrack): string {
  const frameNumbers = Object.keys(track.frames).map(Number).sort((a, b) => a - b);
  const framesTerm = frameNumbers.length > 0
    ? `frames:${frameNumbers.length}:${frameNumbers.map((frame) => {
        const ref = track.frames[frame];
        return [
          encodeCanonicalNumber(frame),
          encodeCanonicalString(ref.cachePath),
          encodeCanonicalNumber(ref.width),
          encodeCanonicalNumber(ref.height),
        ].join('');
      }).join('')}`
    : '';
  const loopsTerm = track.loopClips.length > 0
    ? `loops:${encodeCanonicalLoopClips(track.loopClips)}`
    : '';
  const rotoTerm = track.rotoPhysical === null
    ? 'roto:null;'
    : `roto:${buildPhysicPaintRotoPhysicalRevision(
        track.rotoPhysical.realKeyRecords,
        track.rotoPhysical.interpolation,
        track.rotoPhysical.loopClips,
        track.rotoPhysical.incomingInterpolationBreakKeyIds,
        track.rotoPhysical.groupOverrideRecords,
      )}`;
  return [
    `id:${encodeCanonicalString(track.id)}`,
    `name:${encodeCanonicalString(track.name)}`,
    `order:${encodeCanonicalNumber(track.order)}`,
    `visible:${validatedBoolean(track.visible)}`,
    `solo:${validatedBoolean(track.solo)}`,
    `opacity:${encodeCanonicalNumber(track.opacity)}`,
    `blend:${encodeCanonicalString(track.blendMode)}`,
    `revision:${encodeCanonicalNumber(track.revision)}`,
    framesTerm,
    loopsTerm,
    rotoTerm,
  ].join('');
}

/**
 * Canonical photo/reference term (50-01): covers the document-mutation fields
 * (`id`, ordered `sourceFrameRefs`, `revision`) and EXCLUDES the
 * display-preference fields (`visibleInStudio`, `opacity`, `transform`,
 * `transformLocked`) so a display-preference change never bumps the document
 * revision (D-07 vs D-11/D-12/D-13 split). The Phase 50 `mode` term is REMOVED
 * (52-02, D-15 clean break). A null track contributes an empty term (D-29
 * idiom).
 */
function encodeCanonicalPhotoReference(track: PhotoReferenceTrack | null): string {
  if (track === null) return '';
  return [
    encodeCanonicalString(track.id),
    `${track.sourceFrameRefs.length}:${track.sourceFrameRefs.map(encodeCanonicalString).join('')}`,
    encodeCanonicalNumber(track.revision),
  ].join('');
}

function encodeValidatedEfxPaintDocumentContent(document: EfxPaintDocument): string {
  const orderedTracks = [...document.tracks].sort((a, b) => a.id.localeCompare(b.id));
  const tracksTerm = `tracks:${orderedTracks.length}:${orderedTracks.map(encodeValidatedEfxPaintTrackContent).join('')}`;
  const clipsTerm = document.background.clips.length > 0
    ? `clips:${encodeCanonicalLoopClips(document.background.clips)}`
    : '';
  return [
    `version:${encodeCanonicalNumber(document.version)}`,
    `parent:${encodeCanonicalString(document.parentLayerId)}`,
    `docrev:${encodeCanonicalNumber(document.documentRevision)}`,
    `active:${encodeCanonicalString(document.activeTrackId)}`,
    tracksTerm,
    `bg:${encodeCanonicalString(document.background.id)}`,
    clipsTerm,
    `fallback:${encodeCanonicalBackgroundFallback(document.background.fallback)}`,
    `bgvisible:${validatedBoolean(document.background.visible)}`,
    `bgrevision:${encodeCanonicalNumber(document.background.revision)}`,
    `photo:${encodeCanonicalPhotoReference(document.photoReference)}`,
    `composite:${encodeCanonicalNumber(document.compositeRevision)}`,
  ].join('');
}

/**
 * Compute the deterministic document revision for a validated
 * {@link EfxPaintDocument}. Equal content yields equal revisions regardless
 * of JSON member insertion order; empty additive collections contribute no
 * term. Throws a closed validation failure on any invalid input.
 */
export function buildEfxPaintDocumentRevision(value: unknown): string {
  const document = parseEfxPaintDocument(value);
  const source = encodeValidatedEfxPaintDocumentContent(document);
  return `efxdoc-${hashCanonicalPhysicalValue(source)}`;
}

/**
 * Compute the deterministic revision of one internal Paint track. Equal
 * track content yields equal revisions regardless of member order.
 */
export function buildEfxPaintTrackRevision(value: unknown): string {
  const track = parseInternalPaintTrack(value);
  const source = encodeValidatedEfxPaintTrackContent(track);
  return `track-${hashCanonicalPhysicalValue(source)}`;
}

/**
 * Compute the deterministic composite revision of a document: the
 * compositor-relevant configuration (track order, visibility, solo, opacity,
 * blend mode, background visibility and fallback). Equal configuration
 * yields equal revisions regardless of member order.
 */
export function buildEfxPaintCompositeRevision(value: unknown): string {
  const document = parseEfxPaintDocument(value);
  const orderedTracks = [...document.tracks].sort((a, b) => a.id.localeCompare(b.id));
  const tracksTerm = orderedTracks.map((track) => [
    encodeCanonicalString(track.id),
    encodeCanonicalNumber(track.order),
    validatedBoolean(track.visible),
    validatedBoolean(track.solo),
    encodeCanonicalNumber(track.opacity),
    encodeCanonicalString(track.blendMode),
  ].join('')).join('');
  const backgroundTerm = [
    encodeCanonicalString(document.background.id),
    validatedBoolean(document.background.visible),
    encodeCanonicalBackgroundFallback(document.background.fallback),
  ].join('');
  const source = `tracks:${orderedTracks.length}:${tracksTerm}bg:${backgroundTerm}`;
  return `composite-${hashCanonicalPhysicalValue(source)}`;
}
