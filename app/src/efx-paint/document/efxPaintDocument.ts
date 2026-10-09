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

/**
 * Paper grain SCALE bounds (260923-bcm, T-260923-01): the pattern-transform
 * multiplier accepted on the paper fallback / background metadata. Pure
 * helpers — this module's only physical-model import is type-only, so the
 * physical model can reuse these without a runtime cycle.
 */
export const GRAIN_SCALE_MIN = 0.1;
export const GRAIN_SCALE_MAX = 10;

/** Finite, in [GRAIN_SCALE_MIN, GRAIN_SCALE_MAX] — the fail-closed acceptance. */
export function isGrainScaleValue(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= GRAIN_SCALE_MIN
    && value <= GRAIN_SCALE_MAX;
}

/** Normalize a raw grain scale: in-range keeps its value, anything else → 1. */
export function normalizeGrainScale(value: unknown): number {
  return isGrainScaleValue(value) ? value : 1;
}

/** Document fallback revealed in Background gaps (D-08: transparent at creation). */
export type BackgroundFallback =
  | { readonly mode: 'transparent' }
  | { readonly mode: 'solid'; readonly color: string }
  | {
      readonly mode: 'paper';
      readonly texture: PaperTexture;
      readonly grainStrength: number;
      /**
       * 260923-bcm: paper pattern scale (1 = natural tile). OPTIONAL member —
       * the parser always normalizes it (absent/invalid → 1); consumers fall
       * back with `?? 1` (optional-member idiom, not legacy migration).
       */
      readonly grainScale?: number;
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
  /**
   * Background display transform (260922-rd4): REUSES the photo-reference
   * transform type — one transform type, no fork. Display preference: never a
   * document mutation, never a `buildEfxPaintDocumentRevision` term.
   */
  readonly transform: PhotoReferenceTransform;
  /** Display preference: whether the Studio transform handles are locked (default true). */
  readonly transformLocked: boolean;
}

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
 * document-mutation fields (`id`, `sourceFrameRefs`, `revision`) and
 * display-preference fields (`visibleInStudio`, `opacity`, `transform`,
 * `transformLocked`). The source identity is an ordered `readonly string[]` of
 * library asset IDs in natural-filename-sort order (D-02), mirroring
 * `FrameLoopClip.sourceFrameRefs`. The Phase 50 `mode` field is REMOVED
 * entirely (52-02, D-15 clean break) — the reveal rail bakes the reference as
 * placed regardless of any mode; the real guard is RVL-05.
 */
export interface PhotoReferenceTrack {
  readonly id: string;
  readonly sourceFrameRefs: readonly string[];
  readonly revision: number;
  readonly visibleInStudio: boolean;
  readonly opacity: number;
  readonly transform: PhotoReferenceTransform;
  readonly transformLocked: boolean;
}

/**
 * One placed sound clip (261008-ig1 / 52.5 MULTI-AUDIO-CONCEPT, D-01): several
 * clips per document, each owned by the document as a media reference (52.2
 * references-only — `relativePath` is package-relative under `audio/`, never
 * inlined bytes; path safety is enforced at every join by the persistence
 * layer). Two identities, never overloaded:
 * - `id` = the PLACED clip (list key, timeline selection, transport key,
 *   buffer key) — unique per clip.
 * - `sourceId` = the IMPORTED FILE (peaks cache key, gallery dedupe key) —
 *   NOT unique: an alt+drag duplicate shares its sourceId.
 */
export interface DocumentSoundClip {
  /** Placed-clip identity — unique per clip (alt+drag mints a fresh one). */
  readonly id: string;
  /** The imported file's gallery asset id — SHARED across duplicates. */
  readonly sourceId: string;
  /** Package-relative media path under `audio/` (52.2 reference). */
  readonly relativePath: string;
  /** Source asset revision (re-import bumps it). */
  readonly sourceRevision: number;
  /** Timeline placement of the clip start, in frames. */
  readonly startFrame: number;
  /** Source trim start, in frames. */
  readonly inFrame: number;
  /** Source trim end, in frames. */
  readonly outFrame: number;
  /**
   * Clip gain, signed integer -100..+100 (UAT round 4). 0 is unity and sits at
   * the CENTER of the waveform, +100 doubles the level (line at the top of the
   * stain extent), -100 is silent (line at the bottom). Never a plain volume.
   */
  readonly gain: number;
  /** Fade-in length in frames (integer >= 0). */
  readonly fadeInFrames: number;
  /** Fade-out length in frames (integer >= 0). */
  readonly fadeOutFrames: number;
  readonly fadeInCurve: SoundFadeCurve;
  readonly fadeOutCurve: SoundFadeCurve;
  /**
   * The studio-layer sound switch (52.5 UAT round 2): ON = the clip is audible
   * in Studio preview, in main-editor playback, and in export; OFF = the clip
   * is silent everywhere. Never touches the main app's audio tracks — those
   * stay on the session monitoring toggle.
   */
  readonly enabled: boolean;
}

/** Fade curve shapes shared by fade-in and fade-out (Phase 15 D-10 carry-over). */
export type SoundFadeCurve = 'linear' | 'exponential' | 'logarithmic';

/** The v1.0 EFX Physic Paint document owned by one parent layer. */
export interface EfxPaintDocument {
  readonly version: number;
  readonly parentLayerId: string;
  readonly documentRevision: number;
  readonly activeTrackId: string;
  readonly tracks: readonly InternalPaintTrack[];
  readonly background: BackgroundTrack;
  readonly photoReference: PhotoReferenceTrack | null;
  /** The document's placed sound clips (261008-ig1, D-01); empty when none. */
  readonly audios: readonly DocumentSoundClip[];
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
      // 260922-rd4: identity transform, handles locked at creation (mirrors
      // the photo/reference track defaults).
      transform: Object.freeze({ x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }),
      transformLocked: true,
    }),
    photoReference: null,
    // 261008-ig1 (D-01): the placed-clip list — optional member (A2), empty by
    // default; the parser normalizes a missing member to [] as well.
    audios: Object.freeze([]),
    compositeRevision: 0,
  });
}
