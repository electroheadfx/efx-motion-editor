/**
 * Fail-closed parser for the v1.0 EFX Physic Paint document (Phase 45-01).
 *
 * Task 1 scope: happy-path reconstruction of a valid factory-produced
 * document using the copied guard primitives. Task 2 extends every record
 * level to full fail-closed behavior (allowed-key sets, version check,
 * duplicate track IDs, dangling activeTrackId, fallback union).
 *
 * The parser never allocates IDs and never normalizes malformed input.
 * Absent `frames`/`loopClips` members on a track are treated as the empty
 * collection (D-29 idiom, mirroring the roto physical model's loopClips
 * handling) so empty additive collections contribute no revision term.
 */

import { parsePhysicPaintRotoPhysicalDocument } from '../../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import {
  EFX_PAINT_DOCUMENT_VERSION,
  type BackgroundFallback,
  type BackgroundTrack,
  type CachedFrameReference,
  type EfxPaintDocument,
  type FrameLoopClip,
  type InternalPaintTrack,
} from './efxPaintDocument';

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

const DOCUMENT_KEYS = new Set(['version', 'parentLayerId', 'documentRevision', 'activeTrackId', 'tracks', 'background', 'photoReference', 'compositeRevision']);
const TRACK_KEYS = new Set(['id', 'name', 'order', 'visible', 'solo', 'opacity', 'blendMode', 'revision', 'frames', 'rotoPhysical', 'loopClips']);
const BACKGROUND_KEYS = new Set(['id', 'clips', 'fallback', 'visible', 'revision']);
const FALLBACK_TRANSPARENT_KEYS = new Set(['mode']);
const FALLBACK_SOLID_KEYS = new Set(['mode', 'color']);
const LOOP_CLIP_KEYS = new Set(['id', 'startFrame', 'sourceFrameRefs', 'repeat', 'sourceKind', 'revision']);
const REPEAT_FINITE_KEYS = new Set(['mode', 'count']);
const REPEAT_INFINITE_KEYS = new Set(['mode']);
const CACHED_FRAME_REF_KEYS = new Set(['cachePath', 'width', 'height']);

function parseCachedFrameReference(value: unknown): CachedFrameReference {
  if (!isPlainRecord(value)) {
    throw new Error('CachedFrameReference: expected a record.');
  }
  if (!hasOnlyKeys(value, CACHED_FRAME_REF_KEYS)) {
    throw new Error('CachedFrameReference: unknown members; expected exactly cachePath, width, height.');
  }
  if (!isNonEmptyString(value.cachePath)) {
    throw new Error('CachedFrameReference: cachePath must be a non-empty string.');
  }
  if (!isNonNegativeInteger(value.width)) {
    throw new Error('CachedFrameReference: width must be a non-negative integer.');
  }
  if (!isNonNegativeInteger(value.height)) {
    throw new Error('CachedFrameReference: height must be a non-negative integer.');
  }
  return Object.freeze({
    cachePath: value.cachePath,
    width: value.width,
    height: value.height,
  });
}

function parseFrames(value: unknown): Readonly<Record<number, CachedFrameReference>> {
  if (!isPlainRecord(value)) {
    throw new Error('InternalPaintTrack: frames must be a record.');
  }
  const frames: Record<number, CachedFrameReference> = {};
  for (const [key, frameValue] of Object.entries(value)) {
    const frameNumber = Number(key);
    if (!Number.isInteger(frameNumber) || frameNumber < 0) {
      throw new Error(`InternalPaintTrack: invalid frame key "${key}".`);
    }
    frames[frameNumber] = parseCachedFrameReference(frameValue);
  }
  return Object.freeze(frames);
}

function parseFrameLoopClip(value: unknown): FrameLoopClip {
  if (!isPlainRecord(value)) {
    throw new Error('FrameLoopClip: expected a record.');
  }
  if (!hasOnlyKeys(value, LOOP_CLIP_KEYS)) {
    throw new Error('FrameLoopClip: unknown members; expected exactly id, startFrame, sourceFrameRefs, repeat, sourceKind, revision.');
  }
  if (!isNonEmptyString(value.id)) {
    throw new Error('FrameLoopClip: id must be a non-empty string.');
  }
  if (!isNonNegativeInteger(value.startFrame)) {
    throw new Error('FrameLoopClip: startFrame must be a non-negative integer.');
  }
  if (!Array.isArray(value.sourceFrameRefs) || !value.sourceFrameRefs.every(isNonEmptyString)) {
    throw new Error('FrameLoopClip: sourceFrameRefs must be an array of non-empty strings.');
  }
  if (!isPlainRecord(value.repeat)) {
    throw new Error('FrameLoopClip: repeat must be a record.');
  }
  if (value.repeat.mode === 'finite') {
    if (!hasOnlyKeys(value.repeat, REPEAT_FINITE_KEYS)) {
      throw new Error('FrameLoopClip: finite repeat must contain exactly mode, count.');
    }
    if (!isNonNegativeInteger(value.repeat.count)) {
      throw new Error('FrameLoopClip: finite repeat requires a non-negative integer count.');
    }
  } else if (value.repeat.mode === 'infinite') {
    if (!hasOnlyKeys(value.repeat, REPEAT_INFINITE_KEYS)) {
      throw new Error('FrameLoopClip: infinite repeat must contain exactly mode.');
    }
  } else {
    throw new Error('FrameLoopClip: repeat.mode must be finite or infinite.');
  }
  if (value.sourceKind !== 'playscript-hold' && value.sourceKind !== 'imported-background') {
    throw new Error('FrameLoopClip: sourceKind must be playscript-hold or imported-background.');
  }
  if (!isNonNegativeInteger(value.revision)) {
    throw new Error('FrameLoopClip: revision must be a non-negative integer.');
  }
  return Object.freeze({
    id: value.id,
    startFrame: value.startFrame,
    sourceFrameRefs: Object.freeze([...value.sourceFrameRefs]),
    repeat: Object.freeze({ ...value.repeat }),
    sourceKind: value.sourceKind,
    revision: value.revision,
  });
}

function parseLoopClips(value: unknown): readonly FrameLoopClip[] {
  if (!Array.isArray(value)) {
    throw new Error('InternalPaintTrack: loopClips must be an array.');
  }
  return Object.freeze(value.map(parseFrameLoopClip));
}

export function parseInternalPaintTrack(value: unknown): InternalPaintTrack {
  if (!isPlainRecord(value)) {
    throw new Error('InternalPaintTrack: expected a record.');
  }
  if (!hasOnlyKeys(value, TRACK_KEYS)) {
    throw new Error('InternalPaintTrack: unknown members; expected exactly id, name, order, visible, solo, opacity, blendMode, revision, frames, rotoPhysical, loopClips.');
  }
  if (!isNonEmptyString(value.id)) {
    throw new Error('InternalPaintTrack: id must be a non-empty string.');
  }
  if (!isNonEmptyString(value.name)) {
    throw new Error('InternalPaintTrack: name must be a non-empty string.');
  }
  if (!isNonNegativeInteger(value.order)) {
    throw new Error('InternalPaintTrack: order must be a non-negative integer.');
  }
  if (typeof value.visible !== 'boolean') {
    throw new Error('InternalPaintTrack: visible must be a boolean.');
  }
  if (typeof value.solo !== 'boolean') {
    throw new Error('InternalPaintTrack: solo must be a boolean.');
  }
  if (typeof value.opacity !== 'number' || !Number.isFinite(value.opacity)) {
    throw new Error('InternalPaintTrack: opacity must be a finite number.');
  }
  if (typeof value.blendMode !== 'string' || value.blendMode.length === 0) {
    throw new Error('InternalPaintTrack: blendMode must be a non-empty string.');
  }
  if (!isNonNegativeInteger(value.revision)) {
    throw new Error('InternalPaintTrack: revision must be a non-negative integer.');
  }
  const rotoPhysical = value.rotoPhysical === null
    ? null
    : parsePhysicPaintRotoPhysicalDocument(value.rotoPhysical);
  return Object.freeze({
    id: value.id,
    name: value.name,
    order: value.order,
    visible: value.visible,
    solo: value.solo,
    opacity: value.opacity,
    blendMode: value.blendMode,
    revision: value.revision,
    frames: value.frames === undefined ? Object.freeze({}) : parseFrames(value.frames),
    rotoPhysical,
    loopClips: value.loopClips === undefined ? Object.freeze([]) : parseLoopClips(value.loopClips),
  });
}

function parseBackgroundFallback(value: unknown): BackgroundFallback {
  if (!isPlainRecord(value)) {
    throw new Error('BackgroundTrack: fallback must be a record.');
  }
  if (value.mode === 'transparent') {
    if (!hasOnlyKeys(value, FALLBACK_TRANSPARENT_KEYS)) {
      throw new Error('BackgroundTrack: transparent fallback must contain exactly mode.');
    }
    return Object.freeze({ mode: 'transparent' as const });
  }
  if (value.mode === 'solid') {
    if (!hasOnlyKeys(value, FALLBACK_SOLID_KEYS)) {
      throw new Error('BackgroundTrack: solid fallback must contain exactly mode, color.');
    }
    if (!isNonEmptyString(value.color)) {
      throw new Error('BackgroundTrack: solid fallback requires a color string.');
    }
    return Object.freeze({ mode: 'solid' as const, color: value.color });
  }
  throw new Error('BackgroundTrack: fallback.mode must be transparent or solid.');
}

function parseBackgroundTrack(value: unknown): BackgroundTrack {
  if (!isPlainRecord(value)) {
    throw new Error('BackgroundTrack: expected a record.');
  }
  if (!hasOnlyKeys(value, BACKGROUND_KEYS)) {
    throw new Error('BackgroundTrack: unknown members; expected exactly id, clips, fallback, visible, revision.');
  }
  if (!isNonEmptyString(value.id)) {
    throw new Error('BackgroundTrack: id must be a non-empty string.');
  }
  if (!Array.isArray(value.clips)) {
    throw new Error('BackgroundTrack: clips must be an array.');
  }
  if (typeof value.visible !== 'boolean') {
    throw new Error('BackgroundTrack: visible must be a boolean.');
  }
  if (!isNonNegativeInteger(value.revision)) {
    throw new Error('BackgroundTrack: revision must be a non-negative integer.');
  }
  return Object.freeze({
    id: value.id,
    clips: Object.freeze(value.clips.map(parseFrameLoopClip)),
    fallback: parseBackgroundFallback(value.fallback),
    visible: value.visible,
    revision: value.revision,
  });
}

/**
 * Reconstruct a validated {@link EfxPaintDocument} from untrusted input.
 *
 * Throws a closed validation failure on any invalid input; caller-owned
 * data is never mutated; no ID is ever allocated by this parser.
 */
export function parseEfxPaintDocument(value: unknown): EfxPaintDocument {
  if (!isPlainRecord(value)) {
    throw new Error('EfxPaintDocument: expected a record.');
  }
  if (!hasOnlyKeys(value, DOCUMENT_KEYS)) {
    throw new Error('EfxPaintDocument: unknown members; expected exactly version, parentLayerId, documentRevision, activeTrackId, tracks, background, photoReference, compositeRevision.');
  }
  if (value.version !== EFX_PAINT_DOCUMENT_VERSION) {
    throw new Error(`EfxPaintDocument: unsupported version ${String(value.version)}; expected ${EFX_PAINT_DOCUMENT_VERSION}.`);
  }
  if (!isNonEmptyString(value.parentLayerId)) {
    throw new Error('EfxPaintDocument: parentLayerId must be a non-empty string.');
  }
  if (!isNonNegativeInteger(value.documentRevision)) {
    throw new Error('EfxPaintDocument: documentRevision must be a non-negative integer.');
  }
  if (!isNonNegativeInteger(value.compositeRevision)) {
    throw new Error('EfxPaintDocument: compositeRevision must be a non-negative integer.');
  }
  if (value.photoReference !== null) {
    throw new Error('EfxPaintDocument: photoReference must be null.');
  }
  if (!Array.isArray(value.tracks)) {
    throw new Error('EfxPaintDocument: tracks must be an array.');
  }
  if (!isNonEmptyString(value.activeTrackId)) {
    throw new Error('EfxPaintDocument: activeTrackId must be a non-empty string.');
  }
  const tracks = Object.freeze(value.tracks.map(parseInternalPaintTrack));
  const seenTrackIds = new Set<string>();
  for (const track of tracks) {
    if (seenTrackIds.has(track.id)) {
      throw new Error(`EfxPaintDocument: duplicate track id "${track.id}".`);
    }
    seenTrackIds.add(track.id);
  }
  if (!tracks.some((track) => track.id === value.activeTrackId)) {
    throw new Error(`EfxPaintDocument: activeTrackId "${value.activeTrackId}" does not match any track id.`);
  }
  return Object.freeze({
    version: EFX_PAINT_DOCUMENT_VERSION,
    parentLayerId: value.parentLayerId,
    documentRevision: value.documentRevision,
    activeTrackId: value.activeTrackId,
    tracks,
    background: parseBackgroundTrack(value.background),
    photoReference: null,
    compositeRevision: value.compositeRevision,
  });
}
