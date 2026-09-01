/**
 * Pure v1.0 EFX Physic Paint document model (Phase 45-01).
 *
 * This module is the identity root of the v1.0 document: the locked
 * field-level schema, the factory, and the single version discriminator.
 * It is deliberately free of Preact imports, signals, and side effects —
 * the pure-model/reactive-store split mirrors `physicsPaintRotoPhysicalModel.ts`
 * (pure) vs `physicPaintStore.ts` (reactive).
 */

import type { PhysicPaintRotoPhysicalDocument } from '../../components/physic-paint/roto/physicsPaintRotoPhysicalModel';

/** Single version discriminator for the v1.0 EFX Physic Paint document. */
export const EFX_PAINT_DOCUMENT_VERSION = 1;

/** Main-editor blend mode union (mirrors `app/src/types/layer.ts`). */
export type BlendMode = 'normal' | 'screen' | 'multiply' | 'overlay' | 'add';

/** Paper texture identifiers carried by the paper fallback arm (D-11). */
export type PaperTexture = 'canvas1' | 'canvas2' | 'canvas3';

/** Document fallback revealed in Background gaps (D-08: transparent at creation). */
export type BackgroundFallback =
  | { readonly mode: 'transparent' }
  | { readonly mode: 'solid'; readonly color: string }
  | {
      readonly mode: 'paper';
      readonly texture: PaperTexture;
      readonly paperGrain: boolean;
      readonly grainStrength: number;
    };

/** Repeat policy of a Background Loop Clip (spec sketch). */
export type FrameLoopClipRepeat =
  | { readonly mode: 'finite'; readonly count: number }
  | { readonly mode: 'infinite' };

/**
 * Background Loop Clip scale — percentages (100 = the contain-fit base: the
 * image scaled to fit the project canvas preserving its aspect ratio). x and y
 * scale independently; the right-panel Global % control sets both to the same
 * value. 49-06 (UAT round 9): the compositor draws the source contain-fit and
 * centered, then applies this scale — never a stretch-to-fill deformation.
 */
export interface FrameLoopClipScale {
  readonly x: number;
  readonly y: number;
}

/** One Background Loop Clip (spec sketch: id, startFrame, sourceFrameRefs, repeat, sourceKind, revision, scale). */
export interface FrameLoopClip {
  readonly id: string;
  readonly startFrame: number;
  readonly sourceFrameRefs: readonly string[];
  readonly repeat: FrameLoopClipRepeat;
  readonly sourceKind: 'playscript-hold' | 'imported-background';
  readonly revision: number;
  /**
   * 49-06 (UAT round 9): the contain-fit + scale draw percentages. OPTIONAL on
   * the raw type — older documents lack it; the parser always normalizes it to
   * 100/100, and consumers fall back to that when absent.
   */
  readonly scale?: FrameLoopClipScale;
}

/** Cached-frame sidecar reference record (sidecar cachePath + width/height). */
export interface CachedFrameReference {
  readonly cachePath: string;
  readonly width: number;
  readonly height: number;
}

/** One internal Paint track inside the document. */
export interface InternalPaintTrack {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly visible: boolean;
  readonly solo: boolean;
  readonly opacity: number;
  readonly blendMode: BlendMode;
  readonly revision: number;
  readonly frames: Readonly<Record<number, CachedFrameReference>>;
  readonly rotoPhysical: PhysicPaintRotoPhysicalDocument | null;
  readonly loopClips: readonly FrameLoopClip[];
}

/** The single fixed Background track beneath all Paint tracks. */
export interface BackgroundTrack {
  readonly id: string;
  readonly clips: readonly FrameLoopClip[];
  readonly fallback: BackgroundFallback;
  readonly visible: boolean;
  readonly revision: number;
}

/**
 * Photo/reference source mode union (D-05): the three locked modes. The
 * reserved `'photo'` fond mode is deliberately absent (D-08) — wiring it would
 * draw reference pixels as the document fallback, which is part of the
 * flattened output and violates the D-06 exclusion lock.
 */
export type PhotoReferenceMode = 'reference-only' | 'reveal-source' | 'masked-transform-source';

/**
 * Photo/reference display transform (D-13): position, scale, and rotation.
 * A display preference — persisted on the track but never a document mutation
 * and never a revision term.
 */
export interface PhotoReferenceTransform {
  readonly x: number;
  readonly y: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly rotation: number;
}

/**
 * The single photo/reference track (Phase 50-01). Carries two field classes:
 * document-mutation fields (`id`, `sourceFrameRefs`, `mode`, `revision`) and
 * display-preference fields (`visibleInStudio`, `opacity`, `transform`,
 * `transformLocked`). The source identity is an ordered `readonly string[]` of
 * library asset IDs in natural-filename-sort order (D-02), mirroring
 * `FrameLoopClip.sourceFrameRefs`.
 */
export interface PhotoReferenceTrack {
  readonly id: string;
  readonly sourceFrameRefs: readonly string[];
  readonly mode: PhotoReferenceMode;
  readonly revision: number;
  readonly visibleInStudio: boolean;
  readonly opacity: number;
  readonly transform: PhotoReferenceTransform;
  readonly transformLocked: boolean;
}

/** The v1.0 EFX Physic Paint document owned by one parent layer. */
export interface EfxPaintDocument {
  readonly version: number;
  readonly parentLayerId: string;
  readonly documentRevision: number;
  readonly activeTrackId: string;
  readonly tracks: readonly InternalPaintTrack[];
  readonly background: BackgroundTrack;
  readonly photoReference: PhotoReferenceTrack | null;
  readonly compositeRevision: number;
}

function createDefaultPaintTrack(id: string): InternalPaintTrack {
  return Object.freeze({
    id,
    name: 'Track 1',
    order: 0,
    visible: true,
    solo: false,
    opacity: 1,
    blendMode: 'normal' as const,
    revision: 0,
    frames: Object.freeze({}),
    rotoPhysical: null,
    loopClips: Object.freeze([]),
  });
}

/**
 * Create a fresh v1.0 document for one parent layer (DOC-01/DOC-02):
 * one default Paint track, one fixed Background track with the transparent
 * fallback (D-08), no photo reference, zero revisions. All output is
 * deep-frozen; IDs are fresh UUIDs per call.
 */
export function createEfxPaintDocument(parentLayerId: string): EfxPaintDocument {
  const defaultTrackId = crypto.randomUUID();
  return Object.freeze({
    version: EFX_PAINT_DOCUMENT_VERSION,
    parentLayerId,
    documentRevision: 0,
    activeTrackId: defaultTrackId,
    tracks: Object.freeze([createDefaultPaintTrack(defaultTrackId)]),
    background: Object.freeze({
      id: crypto.randomUUID(),
      clips: Object.freeze([]),
      fallback: Object.freeze({ mode: 'transparent' as const }),
      visible: true,
      revision: 0,
    }),
    photoReference: null,
    compositeRevision: 0,
  });
}
