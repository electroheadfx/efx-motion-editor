import { signal, type ReadonlySignal, type Signal } from '@preact/signals';
import type { PhysicPaintApplyPayload, PhysicPaintApplyResult, PhysicPaintRenderedFrame, PhysicPaintRotoBackgroundMetadata, PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings, PhysicPaintRotoPlaybackSettings } from '../types/physicPaint';
import { PHYSIC_PAINT_MAX_APPLY_FRAMES, isPhysicPaintApplyPayload, isPhysicPaintRotoInterpolationSettings, isPhysicPaintRotoPlaybackSettings, type PhysicPaintRotoSegmentSpacingOverride } from '../types/physicPaint';
import { getExpandedRotoRealKeyFrames } from '../components/physic-paint/roto/physicsPaintRotoWorkflow';
import { resolveMissingRotoFrameDraw } from '../lib/rotoFrameDraw';
import type { PhysicsPaintPerformanceSample } from '../components/physic-paint/performance/physicsPaintPerformanceTrace';
import {
  PHYSIC_PAINT_ROTO_INCOMING_INTERPOLATION_BREAK_KEY_IDS_EMPTY,
  PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED,
  PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
  PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO,
  buildPhysicPaintRotoPhysicalRevision,
  isPhysicPaintRotoInterpolationState,
  parsePhysicPaintRotoIncomingInterpolationBreakKeyIds,
  parsePhysicPaintRotoLoopClips,
  parsePhysicPaintRotoPhysicalDocument,
  parsePhysicPaintRotoRealKeyRecordCollection,
  type PhysicPaintRotoInterpolationState,
  type PhysicPaintRotoLoopClip,
  type PhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoPhysicalRenderSource,
  type PhysicPaintRotoRealKeyPayload,
  type PhysicPaintRotoRealKeyRecord,
  type PhysicPaintRotoScriptMotionSettings,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import {
  derivePhysicPaintRotoLoopRanges,
  projectPhysicPaintRotoPhysicalTimeline,
  resolvePhysicPaintRotoLoopFrame,
  type PhysicPaintRotoLoopResolutionContext,
  type PhysicPaintRotoPhysicalTimelineProjection,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalResolver';
import { classifyPhysicPaintRotoGroupFrameTarget } from '../components/physic-paint/roto/physicsPaintRotoGroupLifecycle';
import { getPhysicsPaintRotoSourceCycleId } from '../components/physic-paint/roto/physicsPaintRotoSpacingSelection';

let _markProjectDirty: (() => void) | null = null;
export function _setPhysicPaintMarkDirtyCallback(cb: () => void) { _markProjectDirty = cb; }

export const physicPaintVersion = signal(0);

/**
 * 46-01 TRK-03: per-track revision signals, keyed by trackId (the stable
 * UUID identity from the document — never an array index). Baseline 0 is the
 * clean state; every track mutation bumps the track's paint+roto signals
 * together with the global physicPaintVersion clock, so per-track
 * subscribers react without global re-renders while existing global
 * subscribers keep compiling. Entries are created lazily on first read or
 * bump, deleted by removeTrackRuntime, and wiped by reset().
 */
const trackRevisions = new Map<string, { paint: Signal<number>; roto: Signal<number> }>();

function _getOrCreateTrackRevisions(trackId: string): { paint: Signal<number>; roto: Signal<number> } {
  let entry = trackRevisions.get(trackId);
  if (!entry) {
    entry = { paint: signal(0), roto: signal(0) };
    trackRevisions.set(trackId, entry);
  }
  return entry;
}

/** Per-track paint revision signal (46-01 TRK-03). */
export function getTrackPaintVersion(_layerId: string, trackId: string): ReadonlySignal<number> {
  return _getOrCreateTrackRevisions(trackId).paint;
}

/** Per-track physical Roto revision signal (46-01 TRK-03). */
export function getTrackRotorRevision(_layerId: string, trackId: string): ReadonlySignal<number> {
  return _getOrCreateTrackRevisions(trackId).roto;
}

/**
 * Single per-track invalidation point (46-01 TRK-03): bumps the track's
 * paint+roto revision signals, always bumps the global physicPaintVersion
 * clock, deletes the track's structural memo entry (composite layer+track
 * key), and fires the injected project-dirty callback. Optional diagnostics
 * mirror _notifyVisualChange so existing perf traces keep their stages.
 * markDirty=false is reserved for install paths whose caller owns project
 * dirty signaling.
 */
export function bumpTrackRevision(
  layerId: string,
  trackId: string,
  diagnostics?: { mutationId?: number; record: (sample: PhysicsPaintPerformanceSample) => void },
  markDirty = true,
): void {
  const entry = _getOrCreateTrackRevisions(trackId);
  entry.paint.value++;
  entry.roto.value++;
  physicPaintVersion.value++;
  _rotoPhysicalStructuralCache.delete(_rotoPhysicalStructuralCacheKey(layerId, trackId));
  if (markDirty) _markProjectDirty?.();
  if (diagnostics) {
    const completedAt = performance.now();
    diagnostics.record({ stage: 'store-project-dirty', category: 'sync-cpu', durationMs: 0, timestamp: completedAt, mutationId: diagnostics.mutationId });
    diagnostics.record({ stage: 'store-visual-notification', category: 'sync-cpu', durationMs: 0, timestamp: completedAt, mutationId: diagnostics.mutationId });
  }
}

/** Ensure the per-track revision entry exists for a mounted track (46-01 TRK-03). */
export function mountTrackRuntime(_layerId: string, trackId: string): void {
  _getOrCreateTrackRevisions(trackId);
}

export type PhysicPaintRotoPhysicalOperationLeaseOwner = 'exclusive' | 'recovery';

export interface PhysicPaintRotoPhysicalOperationLeaseToken {
  readonly projectContextId: string;
  readonly layerId: string;
  readonly generation: number;
  readonly owner: PhysicPaintRotoPhysicalOperationLeaseOwner;
}

export interface PhysicPaintRotoPhysicalRecoveryLeaseDescriptor {
  readonly projectContextId: string;
  readonly layerId: string;
  readonly generation: number;
}

export type PhysicPaintRotoPhysicalOperationLeaseFailureReason =
  | 'missing-token'
  | 'mismatched-token'
  | 'replayed-token';

export type PhysicPaintLayerSnapshot = {
  layerId: string;
  /** v1.0 stable track UUID the snapshot belongs to (46-01 TRK-01). */
  trackId: string;
  frames?: Array<[number, PhysicPaintRenderedFrame]>;
  rotoBackground?: PhysicPaintRotoBackgroundMetadata;
  rotoCacheMetadata?: Array<[number, PhysicPaintRotoCacheFrame]>;
  rotoGeneratedCacheMetadata?: Array<[number, PhysicPaintRotoCacheFrame]>;
  rotoInterpolationSettings?: PhysicPaintRotoInterpolationSettings;
  rotoInterpolationFailureStatus?: string;
  rotoPlaybackSettings?: PhysicPaintRotoPlaybackSettings;
  alphaCanvases: Array<[string, HTMLCanvasElement]>;
};

const DEFAULT_ROTO_INTERPOLATION_SETTINGS: PhysicPaintRotoInterpolationSettings = {
  enabled: false,
  inBetweenCount: 1,
  mode: 'duplicate',
  position: 0,
  deform: 0,
};

/**
 * One unresolvable Loop Clip intersecting a queried frame window (Phase 43,
 * D-28). Carries the verbatim missing source keyIds (D-31) and the loop's
 * effective end so the export preflight can name the blocked range without
 * materializing frames.
 */
export type PhysicPaintRotoPhysicalUnresolvedLoop = {
  readonly loopId: string;
  readonly placementStart: number;
  readonly effectiveEnd: number;
  readonly missingSourceKeyIds: readonly string[];
  readonly invalidSourceTiming?: true;
};

/**
 * One layer's runtime state projected into the v1.0 document shape (Phase
 * 45-04 Task 2). `rotoPhysical` is null when the layer has no physical Roto
 * state; frames are the runtime rendered frames keyed by application frame.
 */
export interface EfxPaintRuntimeProjection {
  readonly frames: ReadonlyMap<number, PhysicPaintRenderedFrame>;
  readonly rotoPhysical: PhysicPaintRotoPhysicalDocument | null;
}

const _rotoAlphaCanvasRegistry = new Map<string, HTMLCanvasElement>();

export function registerRotoAlphaCanvasFrame(dataUrl: string, canvas: HTMLCanvasElement): void {
  if (!dataUrl.startsWith('data:image/png') || canvas.width <= 0 || canvas.height <= 0) return;
  _rotoAlphaCanvasRegistry.set(dataUrl, canvas);
}

export function hasRotoAlphaCanvasFrame(
  dataUrl: string,
  expectedSize?: { width: number; height: number },
): boolean {
  const canvas = _rotoAlphaCanvasRegistry.get(dataUrl);
  if (!canvas) return false;
  return !expectedSize
    || (canvas.width === expectedSize.width && canvas.height === expectedSize.height);
}

// 46-01 TRK-01 base law: every runtime map is addressed layerId -> trackId ->
// value. trackId is the stable UUID identity from the v1.0 document
// (InternalPaintTrack.id) — never an array index (Pitfall 1). Two internal
// tracks may hold real keys at the SAME appFrame; the per-track containers
// stay separate. Track entries persist once created (empty-but-present,
// TRK-01 empty resolved) until removeTrackRuntime / clearLayer / reset.
const _frames = new Map<string, Map<string, Map<number, PhysicPaintRenderedFrame>>>();
const _rotoBackgroundMetadata = new Map<string, Map<string, PhysicPaintRotoBackgroundMetadata>>();
const _rotoCacheMetadata = new Map<string, Map<string, Map<number, PhysicPaintRotoCacheFrame>>>();
const _rotoGeneratedCacheMetadata = new Map<string, Map<string, Map<number, PhysicPaintRotoCacheFrame>>>();
const _rotoInterpolationSettings = new Map<string, Map<string, PhysicPaintRotoInterpolationSettings>>();
const _rotoInterpolationFailureStatus = new Map<string, Map<string, string>>();
const ROTO_INTERPOLATION_FAILURE_STATUS = 'Generated in-betweens could not regenerate. Real keys were kept.';

// --- Physical persistence state (D-01/D-02/D-03) ---
// Stable keyId -> direct appFrame real-key frames plus canonical
// interpolation state. These maps are the sole durable Roto timing/identity
// authority; generated cells are runtime-derived via the shared projection seam
// and never stored as durable records.
const _rotoRealKeyRecords = new Map<string, Map<string, Map<string, PhysicPaintRotoRealKeyRecord>>>();
const _rotoGroupOverrideRecords = new Map<string, Map<string, Map<string, PhysicPaintRotoRealKeyRecord>>>();
const EMPTY_ROTO_GROUP_OVERRIDE_RECORDS = new Map<string, PhysicPaintRotoRealKeyRecord>();
const _rotoPhysicalInterpolationState = new Map<string, Map<string, PhysicPaintRotoInterpolationState>>();
const _rotoPhysicalScriptMotion = new Map<string, Map<string, PhysicPaintRotoScriptMotionSettings>>();
const _rotoPhysicalSelectedKeyId = new Map<string, Map<string, string | null>>();
const _rotoPhysicalCursorAppFrame = new Map<string, Map<string, number>>();
const _rotoPhysicalCapacity = new Map<string, Map<string, number>>();
// Durable Loop Clip collections (Phase 43, D-29). Values are always
// frozen parser output; mutation sites REPLACE the array, never edit in place.
const _rotoPhysicalLoopClips = new Map<string, Map<string, readonly PhysicPaintRotoLoopClip[]>>();
const _rotoPhysicalIncomingInterpolationBreakKeyIds = new Map<string, Map<string, readonly string[]>>();
const _rotoPlaybackSettings = new Map<string, Map<string, PhysicPaintRotoPlaybackSettings>>();
const _rotoPhysicalOperationLeases = new Map<string, PhysicPaintRotoPhysicalOperationLeaseToken>();
const _settledRotoPhysicalOperationLeases = new Set<string>();
let _rotoPhysicalOperationLeaseGeneration = 0;
export const physicPaintRotoPhysicalOperationLeaseVersion = signal(0);
export const rotoPhysicalRevision = signal(0);

// regression-refresh-multi-paint Layer 2: CONTENT-REVISION ordering. The preview
// base apply seam must order paints by CONTENT newness, not request/session
// order (a render computed from content revision N must never overwrite a paint
// of content revision N+1). Every distinct physical content revision is assigned
// a monotonically increasing content token the first time it is resolved; the
// engine's preview-base seam drops any settle whose token is below the applied
// one. The registry is session-global and monotonic, so canvas clears never
// reset the ordering.
const _rotoPhysicalContentTokens = new Map<string, number>();
let _rotoPhysicalContentTokenCounter = 0;

export function resolveContentToken(contentRevision: string | null | undefined): number {
  if (!contentRevision) return 0;
  let token = _rotoPhysicalContentTokens.get(contentRevision);
  if (token === undefined) {
    _rotoPhysicalContentTokenCounter += 1;
    token = _rotoPhysicalContentTokenCounter;
    _rotoPhysicalContentTokens.set(contentRevision, token);
  }
  return token;
}

function _notifyRotoPhysicalOperationLeaseChange(): void {
  physicPaintRotoPhysicalOperationLeaseVersion.value += 1;
}

function _rotoPhysicalOperationLeaseScope(projectContextId: string, layerId: string): string {
  return `${projectContextId.length}:${projectContextId}${layerId.length}:${layerId}`;
}

function _rotoPhysicalOperationLeaseIdentity(token: PhysicPaintRotoPhysicalOperationLeaseToken): string {
  return `${_rotoPhysicalOperationLeaseScope(token.projectContextId, token.layerId)}:${token.generation}`;
}

function _sameRotoPhysicalOperationLease(
  left: PhysicPaintRotoPhysicalOperationLeaseToken,
  right: PhysicPaintRotoPhysicalOperationLeaseToken,
): boolean {
  return left.projectContextId === right.projectContextId
    && left.layerId === right.layerId
    && left.generation === right.generation
    && left.owner === right.owner;
}

function _validateRotoPhysicalLayerPublication(
  layerId: string,
  token: PhysicPaintRotoPhysicalOperationLeaseToken | null | undefined,
): { ok: true } | { ok: false; reason: PhysicPaintRotoPhysicalOperationLeaseFailureReason } {
  const activeForLayer = [..._rotoPhysicalOperationLeases.values()].filter((lease) => lease.layerId === layerId);
  if (activeForLayer.length === 0) {
    return token
      ? { ok: false, reason: _settledRotoPhysicalOperationLeases.has(_rotoPhysicalOperationLeaseIdentity(token))
        ? 'replayed-token'
        : 'mismatched-token' }
      : { ok: true };
  }
  if (!token) return { ok: false, reason: 'missing-token' };
  if (activeForLayer.length !== 1) return { ok: false, reason: 'mismatched-token' };
  const active = activeForLayer[0];
  if (_settledRotoPhysicalOperationLeases.has(_rotoPhysicalOperationLeaseIdentity(token))) {
    return { ok: false, reason: 'replayed-token' };
  }
  return _sameRotoPhysicalOperationLease(active, token)
    ? { ok: true }
    : { ok: false, reason: 'mismatched-token' };
}

// --- Physical structural read memo (46-01 track-keyed, 46-07) ---
// Per-TRACK memo for the physical projection + content revision, keyed by the
// composite `${layerId}\0${trackId}` so track A edits never serve stale
// projections for track B (TRK-03 ordering, resolved explicit). Validity is
// keyed on the structural identities (recordMap, interpolation object,
// capacity, frozen loopClips array, frozen incoming-break array): every
// mutation site REPLACES those values (the add/delete/move/undo/redo publish
// path at replaceRotoPhysicalRecords, loop replacement at
// replaceRotoPhysicalLoopClips, payload writes at
// updateRotoPhysicalRealKeyPayload, interpolation publishes at
// setRotoPhysicalInterpolationState, document replacement, and hydration), so
// the memo needs no explicit invalidation hooks and can never serve stale
// data. Selection/cursor writes touch none of those identities and never
// invalidate. Any future post-install in-place write to an installed inner
// record map or loop array would silently leak this contract and is grep-gated.
type RotoPhysicalStructuralCacheEntry = {
  recordMap: Map<string, PhysicPaintRotoRealKeyRecord>;
  groupOverrideMap: Map<string, PhysicPaintRotoRealKeyRecord>;
  interpolation: PhysicPaintRotoInterpolationState;
  capacity: number;
  loopClips: readonly PhysicPaintRotoLoopClip[];
  incomingInterpolationBreakKeyIds: readonly string[];
  projection: PhysicPaintRotoPhysicalTimelineProjection | null;
  contentRevision: string;
  // Phase 43: ONE compact interval derivation per structural revision (D-32).
  // Memoized on the same identity quadruple; queried lazily per requested
  // frame by getRotoPhysicalRenderSource / getRotoPhysicalUnresolvedLoops.
  // The store's parent-end bound is the physical capacity (D-25/Q4 fold the
  // 600-frame clamp into the 'parent-end' boundary kind for infinity loops).
  loopResolution: PhysicPaintRotoLoopResolutionContext;
};
const _rotoPhysicalStructuralCache = new Map<string, RotoPhysicalStructuralCacheEntry>();

/** Composite structural memo key: `${layerId}\0${trackId}` (46-01 TRK-03). */
function _rotoPhysicalStructuralCacheKey(layerId: string, trackId: string): string {
  return `${layerId}\0${trackId}`;
}

/** Delete every structural memo entry owned by one layer. */
function _deleteLayerRotoPhysicalStructuralCache(layerId: string): void {
  for (const key of _rotoPhysicalStructuralCache.keys()) {
    if (key.startsWith(`${layerId}\0`)) _rotoPhysicalStructuralCache.delete(key);
  }
}

function _resolveRotoPhysicalStructural(layerId: string, trackId: string): RotoPhysicalStructuralCacheEntry | null {
  const recordMap = _rotoRealKeyRecords.get(layerId)?.get(trackId);
  if (!recordMap) {
    _rotoPhysicalStructuralCache.delete(_rotoPhysicalStructuralCacheKey(layerId, trackId));
    return null;
  }
  const groupOverrideMap = _rotoGroupOverrideRecords.get(layerId)?.get(trackId) ?? EMPTY_ROTO_GROUP_OVERRIDE_RECORDS;
  const interpolation = _rotoPhysicalInterpolationState.get(layerId)?.get(trackId) ?? PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED;
  const capacity = _rotoPhysicalCapacity.get(layerId)?.get(trackId) ?? PHYSIC_PAINT_MAX_APPLY_FRAMES;
  const loopClips = _rotoPhysicalLoopClips.get(layerId)?.get(trackId) ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY;
  const incomingInterpolationBreakKeyIds = _rotoPhysicalIncomingInterpolationBreakKeyIds.get(layerId)?.get(trackId)
    ?? PHYSIC_PAINT_ROTO_INCOMING_INTERPOLATION_BREAK_KEY_IDS_EMPTY;
  const cacheKey = _rotoPhysicalStructuralCacheKey(layerId, trackId);
  const cached = _rotoPhysicalStructuralCache.get(cacheKey);
  if (cached
    && cached.recordMap === recordMap
    && cached.groupOverrideMap === groupOverrideMap
    && cached.interpolation === interpolation
    && cached.capacity === capacity
    && cached.loopClips === loopClips
    && cached.incomingInterpolationBreakKeyIds === incomingInterpolationBreakKeyIds) return cached;
  const records = Array.from(recordMap.values()).sort((a, b) => a.appFrame - b.appFrame);
  const identities = records.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame }));
  const result = projectPhysicPaintRotoPhysicalTimeline({
    identities,
    capacity,
    interpolationEnabled: interpolation.enabled,
    incomingInterpolationBreakKeyIds,
  });
  const entry: RotoPhysicalStructuralCacheEntry = {
    recordMap,
    groupOverrideMap,
    interpolation,
    capacity,
    loopClips,
    incomingInterpolationBreakKeyIds,
    projection: result.ok ? result.projection : null,
    contentRevision: buildPhysicPaintRotoPhysicalRevision(
      records,
      interpolation,
      loopClips,
      incomingInterpolationBreakKeyIds,
      Array.from(groupOverrideMap.values()),
    ),
    loopResolution: derivePhysicPaintRotoLoopRanges({
      identities,
      loopClips,
      capacity,
      interpolationEnabled: interpolation.enabled,
    }),
  };
  _rotoPhysicalStructuralCache.set(cacheKey, entry);
  return entry;
}
function _collectFrameDataUrls(frames: Iterable<PhysicPaintRenderedFrame>, target: Set<string>): void {
  for (const frame of frames) {
    target.add(frame.dataUrl);
    const onionDataUrl = (frame as { onionDataUrl?: unknown }).onionDataUrl;
    if (typeof onionDataUrl === 'string') target.add(onionDataUrl);
  }
}

/** Collect every payload dataUrl owned by ONE track (46-01 track-scoped). */
function _getTrackDataUrls(layerId: string, trackId: string): Set<string> {
  const dataUrls = new Set<string>();
  _collectFrameDataUrls(_frames.get(layerId)?.get(trackId)?.values() ?? [], dataUrls);
  _collectFrameDataUrls(_rotoCacheMetadata.get(layerId)?.get(trackId)?.values() ?? [], dataUrls);
  _collectFrameDataUrls(_rotoGeneratedCacheMetadata.get(layerId)?.get(trackId)?.values() ?? [], dataUrls);
  for (const record of _rotoRealKeyRecords.get(layerId)?.get(trackId)?.values() ?? []) dataUrls.add(record.payload.dataUrl);
  for (const record of _rotoGroupOverrideRecords.get(layerId)?.get(trackId)?.values() ?? []) dataUrls.add(record.payload.dataUrl);
  return dataUrls;
}

function _isDataUrlReferenced(dataUrl: string): boolean {
  const referencesDataUrl = (frames: Iterable<PhysicPaintRenderedFrame>): boolean => {
    for (const frame of frames) {
      if (frame.dataUrl === dataUrl || (frame as { onionDataUrl?: unknown }).onionDataUrl === dataUrl) return true;
    }
    return false;
  };
  for (const layerTracks of _frames.values()) {
    for (const trackFrames of layerTracks.values()) if (referencesDataUrl(trackFrames.values())) return true;
  }
  for (const layerTracks of _rotoCacheMetadata.values()) {
    for (const trackMetadata of layerTracks.values()) if (referencesDataUrl(trackMetadata.values())) return true;
  }
  for (const layerTracks of _rotoGeneratedCacheMetadata.values()) {
    for (const trackMetadata of layerTracks.values()) if (referencesDataUrl(trackMetadata.values())) return true;
  }
  for (const layerTracks of _rotoRealKeyRecords.values()) {
    for (const trackRecords of layerTracks.values()) {
      for (const record of trackRecords.values()) if (record.payload.dataUrl === dataUrl) return true;
    }
  }
  for (const layerTracks of _rotoGroupOverrideRecords.values()) {
    for (const trackRecords of layerTracks.values()) {
      for (const record of trackRecords.values()) if (record.payload.dataUrl === dataUrl) return true;
    }
  }
  return false;
}

function _pruneUnreferencedRotoAlphaCanvases(dataUrls: Iterable<string>): void {
  for (const dataUrl of dataUrls) {
    if (!_isDataUrlReferenced(dataUrl)) _rotoAlphaCanvasRegistry.delete(dataUrl);
  }
}

function _clearLayerState(layerId: string): boolean {
  const dataUrls = new Set<string>();
  for (const trackId of _frames.get(layerId)?.keys() ?? []) {
    for (const dataUrl of _getTrackDataUrls(layerId, trackId)) dataUrls.add(dataUrl);
  }
  let changed = false;
  // Derived structural memo entries — pruned with the layer's source state
  // so a torn-down layer never leaves its cached projections resident.
  _deleteLayerRotoPhysicalStructuralCache(layerId);
  changed = _frames.delete(layerId) || changed;
  changed = _rotoBackgroundMetadata.delete(layerId) || changed;
  changed = _rotoCacheMetadata.delete(layerId) || changed;
  changed = _rotoGeneratedCacheMetadata.delete(layerId) || changed;
  changed = _rotoInterpolationSettings.delete(layerId) || changed;
  changed = _rotoInterpolationFailureStatus.delete(layerId) || changed;
  changed = _rotoRealKeyRecords.delete(layerId) || changed;
  changed = _rotoGroupOverrideRecords.delete(layerId) || changed;
  changed = _rotoPhysicalInterpolationState.delete(layerId) || changed;
  changed = _rotoPhysicalScriptMotion.delete(layerId) || changed;
  changed = _rotoPhysicalLoopClips.delete(layerId) || changed;
  changed = _rotoPhysicalIncomingInterpolationBreakKeyIds.delete(layerId) || changed;
  changed = _rotoPhysicalSelectedKeyId.delete(layerId) || changed;
  changed = _rotoPhysicalCursorAppFrame.delete(layerId) || changed;
  changed = _rotoPhysicalCapacity.delete(layerId) || changed;
  changed = _rotoPlaybackSettings.delete(layerId) || changed;
  let releasedLease = false;
  for (const [scope, lease] of _rotoPhysicalOperationLeases) {
    if (lease.layerId !== layerId) continue;
    _rotoPhysicalOperationLeases.delete(scope);
    _settledRotoPhysicalOperationLeases.add(_rotoPhysicalOperationLeaseIdentity(lease));
    releasedLease = true;
  }
  if (releasedLease) {
    changed = true;
    _notifyRotoPhysicalOperationLeaseChange();
  }
  for (const dataUrl of dataUrls) {
    if (!_isDataUrlReferenced(dataUrl)) changed = _rotoAlphaCanvasRegistry.delete(dataUrl) || changed;
  }
  return changed;
}

/**
 * 46-01 track-scoped frame map accessor (mirrors the pre-re-key
 * _getOrCreateLayer). Creates the layer and track entries on first write;
 * per-track entries persist once created (empty-but-present, TRK-01 empty
 * resolved explicit) until removeTrackRuntime / clearLayer / reset.
 */
function _getOrCreateTrack(layerId: string, trackId: string): Map<number, PhysicPaintRenderedFrame> {
  let layerFrames = _frames.get(layerId);
  if (!layerFrames) {
    layerFrames = new Map();
    _frames.set(layerId, layerFrames);
  }
  let trackFrames = layerFrames.get(trackId);
  if (!trackFrames) {
    trackFrames = new Map();
    layerFrames.set(trackId, trackFrames);
  }
  return trackFrames;
}

function _getOrCreateTrackRotoMetadata(layerId: string, trackId: string): Map<number, PhysicPaintRotoCacheFrame> {
  let layerMetadata = _rotoCacheMetadata.get(layerId);
  if (!layerMetadata) {
    layerMetadata = new Map();
    _rotoCacheMetadata.set(layerId, layerMetadata);
  }
  let trackMetadata = layerMetadata.get(trackId);
  if (!trackMetadata) {
    trackMetadata = new Map();
    layerMetadata.set(trackId, trackMetadata);
  }
  return trackMetadata;
}

function _getOrCreateTrackGeneratedRotoMetadata(layerId: string, trackId: string): Map<number, PhysicPaintRotoCacheFrame> {
  let layerMetadata = _rotoGeneratedCacheMetadata.get(layerId);
  if (!layerMetadata) {
    layerMetadata = new Map();
    _rotoGeneratedCacheMetadata.set(layerId, layerMetadata);
  }
  let trackMetadata = layerMetadata.get(trackId);
  if (!trackMetadata) {
    trackMetadata = new Map();
    layerMetadata.set(trackId, trackMetadata);
  }
  return trackMetadata;
}

/** Create-or-fetch the per-track real-key record container for one track. */
function _getOrCreateTrackRecords(layerId: string, trackId: string): Map<string, PhysicPaintRotoRealKeyRecord> {
  let layerRecords = _rotoRealKeyRecords.get(layerId);
  if (!layerRecords) {
    layerRecords = new Map();
    _rotoRealKeyRecords.set(layerId, layerRecords);
  }
  let trackRecords = layerRecords.get(trackId);
  if (!trackRecords) {
    trackRecords = new Map();
    layerRecords.set(trackId, trackRecords);
  }
  return trackRecords;
}

/** Create-or-fetch the layer's trackId -> scalar map (2-level maps only). */
function _getOrCreateLayerTrackMap<const T>(outer: Map<string, Map<string, T>>, layerId: string): Map<string, T> {
  let layerTracks = outer.get(layerId);
  if (!layerTracks) {
    layerTracks = new Map();
    outer.set(layerId, layerTracks);
  }
  return layerTracks;
}

function _getCombinedRotoMetadata(layerId: string, trackId: string): PhysicPaintRotoCacheFrame[] {
  return [
    ...Array.from(_rotoCacheMetadata.get(layerId)?.get(trackId)?.values() ?? []),
    ...Array.from(_rotoGeneratedCacheMetadata.get(layerId)?.get(trackId)?.values() ?? []),
  ];
}

function getRotoCacheFrameSourceOrder(source: PhysicPaintRotoCacheFrame['source']): number {
  if (source === 'generated-interpolation') return 0;
  if (source === 'real-key') return 1;
  return 2;
}

function _cloneRotoInterpolationSettings(settings: PhysicPaintRotoInterpolationSettings): PhysicPaintRotoInterpolationSettings {
  return {
    ...settings,
    ...(settings.segmentSpacingOverrides ? { segmentSpacingOverrides: settings.segmentSpacingOverrides.map(override => ({ ...override })) } : {}),
  };
}

function _makeRotoCacheFrame(
  renderedFrame: PhysicPaintRenderedFrame,
  appFrame: number,
  source: PhysicPaintRotoCacheFrame['source'],
  nearestRealKeyFrame?: number,
  backgroundOnly?: boolean,
  provenance?: Pick<PhysicPaintRotoCacheFrame, 'sourceFrame' | 'displayFrame' | 'fromSourceFrame' | 'toSourceFrame' | 'interpolationT'>,
): PhysicPaintRotoCacheFrame {
  const onionDataUrl = (renderedFrame as { onionDataUrl?: unknown }).onionDataUrl;
  return {
    ...renderedFrame,
    appFrame,
    source,
    ...(nearestRealKeyFrame !== undefined ? { nearestRealKeyFrame } : {}),
    ...(provenance?.sourceFrame !== undefined ? { sourceFrame: provenance.sourceFrame } : {}),
    ...(provenance?.displayFrame !== undefined ? { displayFrame: provenance.displayFrame } : {}),
    ...(provenance?.fromSourceFrame !== undefined ? { fromSourceFrame: provenance.fromSourceFrame } : {}),
    ...(provenance?.toSourceFrame !== undefined ? { toSourceFrame: provenance.toSourceFrame } : {}),
    ...(provenance?.interpolationT !== undefined ? { interpolationT: provenance.interpolationT } : {}),
    ...(backgroundOnly !== undefined ? { backgroundOnly } : {}),
    ...(typeof onionDataUrl === 'string' ? { onionDataUrl } : {}),
  };
}

function _notifyVisualChange(diagnostics?: { mutationId?: number; record: (sample: PhysicsPaintPerformanceSample) => void }, markDirty = true): void {
  const notificationStartedAt = diagnostics ? performance.now() : 0;
  physicPaintVersion.value++;
  const dirtyStartedAt = diagnostics ? performance.now() : 0;
  if (markDirty) _markProjectDirty?.();
  if (diagnostics) {
    const completedAt = performance.now();
    diagnostics.record({ stage: 'store-project-dirty', category: 'sync-cpu', durationMs: completedAt - dirtyStartedAt, timestamp: completedAt, mutationId: diagnostics.mutationId });
    diagnostics.record({ stage: 'store-visual-notification', category: 'sync-cpu', durationMs: completedAt - notificationStartedAt, timestamp: completedAt, mutationId: diagnostics.mutationId });
  }
}

function _normalizeRotoInterpolationSettings(settings: Partial<PhysicPaintRotoInterpolationSettings> | null | undefined, realKeys?: readonly number[]): PhysicPaintRotoInterpolationSettings {
  const source = settings ?? {};
  const mode = (source as { mode?: unknown }).mode;
  const normalized: PhysicPaintRotoInterpolationSettings = {
    enabled: source.enabled === true,
    inBetweenCount: clampRotoInBetweenCount(source.inBetweenCount),
    mode: mode === 'blend' || mode === 'alpha-blend' ? 'blend' : 'duplicate',
    position: clampPercentLikeCount(source.position),
    deform: clampPercentLikeCount(source.deform),
  };
  const overrides = normalizeRotoSegmentSpacingOverrides(source.segmentSpacingOverrides, realKeys);
  if (overrides.length > 0) normalized.segmentSpacingOverrides = overrides;
  return normalized;
}

function normalizeRotoSegmentSpacingOverrides(value: unknown, realKeys?: readonly number[]): PhysicPaintRotoSegmentSpacingOverride[] {
  if (!Array.isArray(value)) return [];
  const adjacentSegments = realKeys ? getAdjacentSourceSegmentKeys(realKeys) : null;
  const seen = new Set<string>();
  const overrides: PhysicPaintRotoSegmentSpacingOverride[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const entry = candidate as Partial<PhysicPaintRotoSegmentSpacingOverride>;
    const fromSourceFrame = entry.fromSourceFrame;
    const toSourceFrame = entry.toSourceFrame;
    if (typeof fromSourceFrame !== 'number' || !Number.isInteger(fromSourceFrame) || fromSourceFrame < 0) continue;
    if (typeof toSourceFrame !== 'number' || !Number.isInteger(toSourceFrame) || toSourceFrame < 0) continue;
    if (toSourceFrame <= fromSourceFrame) continue;
    const key = `${fromSourceFrame}:${toSourceFrame}`;
    if (seen.has(key)) continue;
    if (adjacentSegments && !adjacentSegments.has(key)) continue;
    seen.add(key);
    overrides.push({
      fromSourceFrame,
      toSourceFrame,
      inBetweenCount: clampRotoInBetweenCount(entry.inBetweenCount),
    });
  }
  return overrides.sort((a, b) => a.fromSourceFrame - b.fromSourceFrame || a.toSourceFrame - b.toSourceFrame);
}

function getAdjacentSourceSegmentKeys(realKeys: readonly number[]): Set<string> {
  const sorted = Array.from(new Set(realKeys.filter(frame => Number.isInteger(frame) && frame >= 0))).sort((a, b) => a - b);
  const segments = new Set<string>();
  for (let index = 0; index < sorted.length - 1; index++) segments.add(`${sorted[index]}:${sorted[index + 1]}`);
  return segments;
}

function clampRotoInBetweenCount(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(1, Math.min(PHYSIC_PAINT_MAX_APPLY_FRAMES, Math.trunc(numeric)));
}

function clampPercentLikeCount(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.trunc(numeric)));
}

function _getRealRotoKeyFrames(layerId: string, trackId: string): number[] {
  const metadata = _rotoCacheMetadata.get(layerId)?.get(trackId);
  if (!metadata) return [];
  return Array.from(metadata.values())
    .filter((frame) => frame.source === 'real-key')
    .map((frame) => frame.sourceFrame ?? frame.appFrame)
    .sort((a, b) => a - b);
}

function _getRotoDisplayFrame(layerId: string, trackId: string, frame: number): PhysicPaintRotoCacheFrame | null {
  return _getCombinedRotoMetadata(layerId, trackId).find((candidate) => (candidate.displayFrame ?? candidate.appFrame) === frame) ?? null;
}

function _normalizeRealRotoCacheFrame(frame: PhysicPaintRenderedFrame, sourceFrame: number, backgroundOnly?: boolean): PhysicPaintRotoCacheFrame {
  const next = _makeRotoCacheFrame({ ...frame, appFrame: sourceFrame, frameIndex: 0, source: 'real-key' }, sourceFrame, 'real-key', undefined, backgroundOnly, {
    sourceFrame,
    displayFrame: sourceFrame,
  });
  delete next.nearestRealKeyFrame;
  return next;
}

function _resetRealRotoDisplayFrames(layerId: string, trackId: string): boolean {
  const metadata = _rotoCacheMetadata.get(layerId)?.get(trackId);
  if (!metadata) return false;
  let changed = false;
  for (const [frame, cacheFrame] of metadata) {
    if (cacheFrame.source !== 'real-key') continue;
    const sourceFrame = cacheFrame.sourceFrame ?? cacheFrame.appFrame;
    if (cacheFrame.displayFrame === sourceFrame && cacheFrame.sourceFrame === sourceFrame && cacheFrame.appFrame === sourceFrame) continue;
    metadata.set(frame, { ...cacheFrame, appFrame: sourceFrame, sourceFrame, displayFrame: sourceFrame });
    changed = true;
  }
  return changed;
}

function _removeGeneratedRotoCache(layerId: string, trackId: string): boolean {
  const trackFrames = _frames.get(layerId)?.get(trackId);
  const generatedMetadata = _rotoGeneratedCacheMetadata.get(layerId)?.get(trackId);
  let changed = false;
  if (trackFrames) {
    for (const [frame, renderedFrame] of Array.from(trackFrames.entries())) {
      if (renderedFrame.source === 'generated-interpolation') {
        trackFrames.delete(frame);
        changed = true;
      }
    }
  }
  if (generatedMetadata) {
    changed = generatedMetadata.size > 0 || changed;
    generatedMetadata.clear();
  }
  return changed;
}

function _removeBackgroundOnlyRotoSupport(layerId: string, trackId: string, frames?: Iterable<number>): boolean {
  const trackFrames = _frames.get(layerId)?.get(trackId);
  const metadata = _rotoCacheMetadata.get(layerId)?.get(trackId);
  let changed = false;
  const candidateFrames = frames ? Array.from(frames) : Array.from(metadata?.keys() ?? []);
  for (const frame of candidateFrames) {
    if (metadata?.get(frame)?.source !== 'background-only-support') continue;
    metadata.delete(frame);
    if (trackFrames?.get(frame)?.source === 'background-only-support') trackFrames.delete(frame);
    changed = true;
  }
  return changed;
}

function _makeBackgroundOnlySupportFrame(layerId: string, trackId: string, appFrame: number, nearestRealKeyFrame: number): PhysicPaintRotoCacheFrame | null {
  const background = _rotoBackgroundMetadata.get(layerId)?.get(trackId);
  if (!background) return null;
  const instruction = resolveMissingRotoFrameDraw(layerId, appFrame, { backgroundState: { mode: 'paper', metadata: background }, realKeyFrames: _getRealRotoKeyFrames(layerId, trackId) });
  if (instruction.kind !== 'background-only' || !instruction.materialize || instruction.span.kind !== 'interior') return null;
  return {
    frameIndex: 0,
    appFrame,
    dataUrl: `data:image/png;base64,${btoa(`background-only-support:${layerId}:${appFrame}:${instruction.color}:${instruction.paperGrain ?? ''}:${instruction.grainStrength ?? 0}`)}`,
    source: 'background-only-support',
    nearestRealKeyFrame,
    backgroundOnly: true,
  };
}

function _pruneFramesOutsideRotoCacheMetadata(layerId: string, trackId: string): boolean {
  const trackFrames = _frames.get(layerId)?.get(trackId);
  const metadata = _rotoCacheMetadata.get(layerId)?.get(trackId);
  if (!trackFrames || !metadata || metadata.size === 0) return false;
  let changed = false;
  for (const frame of Array.from(trackFrames.keys())) {
    if (metadata.has(frame)) continue;
    trackFrames.delete(frame);
    changed = true;
  }
  return changed;
}

function _recomputeBackgroundOnlyRotoSupport(layerId: string, trackId: string, requestedFrames: readonly number[] = []): { changed: boolean; supportFrames: PhysicPaintRotoCacheFrame[] } {
  const realKeys = _getRealRotoKeyFrames(layerId, trackId);
  const requested = Array.from(new Set(requestedFrames.filter((frame) => Number.isInteger(frame) && frame >= 0))).sort((a, b) => a - b);
  const removed = _removeBackgroundOnlyRotoSupport(layerId, trackId, requested.length > 0 ? requested : undefined);
  if (realKeys.length < 2 || requested.length === 0) return { changed: removed, supportFrames: [] };

  const trackFrames = _getOrCreateTrack(layerId, trackId);
  const metadata = _getOrCreateTrackRotoMetadata(layerId, trackId);
  const supportFrames: PhysicPaintRotoCacheFrame[] = [];
  let added = false;
  for (const appFrame of requested) {
    if (metadata.get(appFrame)?.source === 'real-key') continue;
    const priorRealKeys = realKeys.filter((key) => key < appFrame);
    const previousRealKeyFrame = priorRealKeys[priorRealKeys.length - 1];
    const nextRealKeyFrame = realKeys.find((key) => key > appFrame);
    if (previousRealKeyFrame === undefined || nextRealKeyFrame === undefined) continue;
    const supportFrame = _makeBackgroundOnlySupportFrame(layerId, trackId, appFrame, previousRealKeyFrame);
    if (!supportFrame) continue;
    trackFrames.set(appFrame, supportFrame);
    metadata.set(appFrame, supportFrame);
    supportFrames.push({ ...supportFrame });
    added = true;
  }
  return { changed: removed || added, supportFrames };
}

function _withGeneratedAppFrame(frame: PhysicPaintRenderedFrame, appFrame: number): PhysicPaintRenderedFrame {
  return { ...frame, appFrame, frameIndex: 0, source: 'generated-interpolation' };
}

function _blendRegisteredAlphaCanvasDataUrl(firstKeyFrame: PhysicPaintRenderedFrame, secondKeyFrame: PhysicPaintRenderedFrame, t: number): string | null {
  if (typeof document === 'undefined') return null;
  const firstCanvas = _rotoAlphaCanvasRegistry.get(firstKeyFrame.dataUrl);
  const secondCanvas = _rotoAlphaCanvasRegistry.get(secondKeyFrame.dataUrl);
  if (!firstCanvas || !secondCanvas) return null;
  const width = Math.max(1, Math.trunc(firstKeyFrame.width ?? firstCanvas.width));
  const height = Math.max(1, Math.trunc(firstKeyFrame.height ?? firstCanvas.height));
  const output = document.createElement('canvas');
  output.width = width;
  output.height = height;
  const outputContext = output.getContext('2d');
  if (!outputContext) return null;
  outputContext.clearRect(0, 0, width, height);
  outputContext.globalAlpha = 1 - t;
  outputContext.drawImage(firstCanvas, 0, 0, width, height);
  outputContext.globalAlpha = t;
  outputContext.drawImage(secondCanvas, 0, 0, width, height);
  outputContext.globalAlpha = 1;
  return output.toDataURL('image/png');
}

function _blendAlphaDataUrl(firstKeyFrame: PhysicPaintRenderedFrame, secondKeyFrame: PhysicPaintRenderedFrame, t: number): string | null {
  return _blendRegisteredAlphaCanvasDataUrl(firstKeyFrame, secondKeyFrame, t);
}

export function renderDuplicateRotoInterpolationFrame(sourceKeyFrame: PhysicPaintRenderedFrame, targetFrame: number, _settings: PhysicPaintRotoInterpolationSettings): PhysicPaintRenderedFrame {
  return _withGeneratedAppFrame({
    frameIndex: 0,
    appFrame: targetFrame,
    dataUrl: sourceKeyFrame.dataUrl,
    width: sourceKeyFrame.width,
    height: sourceKeyFrame.height,
  }, targetFrame);
}

export function renderBlendedRotoInterpolationFrame(firstKeyFrame: PhysicPaintRenderedFrame, secondKeyFrame: PhysicPaintRenderedFrame, targetFrame: number, t: number, _settings: PhysicPaintRotoInterpolationSettings): PhysicPaintRenderedFrame | null {
  const dataUrl = _blendAlphaDataUrl(firstKeyFrame, secondKeyFrame, t);
  if (!dataUrl) return null;
  return _withGeneratedAppFrame({
    frameIndex: 0,
    appFrame: targetFrame,
    dataUrl,
    width: firstKeyFrame.width ?? secondKeyFrame.width,
    height: firstKeyFrame.height ?? secondKeyFrame.height,
  }, targetFrame);
}

function _tryRegenerateGeneratedRotoCache(layerId: string, trackId: string, settings: PhysicPaintRotoInterpolationSettings): { changed: boolean; generatedFrames: PhysicPaintRenderedFrame[]; failed: boolean } {
  try {
    const result = _regenerateGeneratedRotoCache(layerId, trackId, settings);
    if (!result.failed) _rotoInterpolationFailureStatus.get(layerId)?.delete(trackId);
    return result;
  } catch {
    const removed = _removeGeneratedRotoCache(layerId, trackId);
    const reset = _resetRealRotoDisplayFrames(layerId, trackId);
    _getOrCreateLayerTrackMap(_rotoInterpolationFailureStatus, layerId).set(trackId, ROTO_INTERPOLATION_FAILURE_STATUS);
    return { changed: removed || reset, generatedFrames: [], failed: true };
  }
}

function _regenerateGeneratedRotoCache(layerId: string, trackId: string, settings: PhysicPaintRotoInterpolationSettings): { changed: boolean; generatedFrames: PhysicPaintRenderedFrame[]; failed: boolean } {
  const removed = _removeGeneratedRotoCache(layerId, trackId);
  const realKeys = _getRealRotoKeyFrames(layerId, trackId);
  const trackFrames = _getOrCreateTrack(layerId, trackId);
  if (!settings.enabled || realKeys.length < 2) {
    const reset = _resetRealRotoDisplayFrames(layerId, trackId);
    return { changed: removed || reset, generatedFrames: [], failed: false };
  }

  const metadata = _getOrCreateTrackRotoMetadata(layerId, trackId);
  const generatedMetadata = _getOrCreateTrackGeneratedRotoMetadata(layerId, trackId);
  const displayEntries = getExpandedRotoRealKeyFrames(realKeys, settings);
  const generatedFrames: PhysicPaintRenderedFrame[] = [];
  for (const displayEntry of displayEntries) {
    if (displayEntry.kind !== 'real-key') continue;
    const sourceFrame = trackFrames.get(displayEntry.sourceFrame);
    if (!sourceFrame) continue;
    metadata.set(displayEntry.sourceFrame, _makeRotoCacheFrame(sourceFrame, displayEntry.sourceFrame, 'real-key', undefined, undefined, {
      sourceFrame: displayEntry.sourceFrame,
      displayFrame: displayEntry.displayFrame,
    }));
  }

  for (const displayEntry of displayEntries) {
    if (displayEntry.kind === 'real-key') continue;
    const from = trackFrames.get(displayEntry.fromSourceFrame);
    const to = displayEntry.toSourceFrame === undefined ? from : trackFrames.get(displayEntry.toSourceFrame);
    if (!from || !to) continue;
    const targetFrame = Math.round(displayEntry.generatedFrame);
    const targetDisplayOccupiedByRealKey = Array.from(metadata.values()).some((frame) => frame.source === 'real-key' && (frame.displayFrame ?? frame.appFrame) === targetFrame);
    if (targetDisplayOccupiedByRealKey) continue;
    _removeBackgroundOnlyRotoSupport(layerId, trackId, [targetFrame]);
    const rendered = settings.mode === 'duplicate'
      ? renderDuplicateRotoInterpolationFrame(from, targetFrame, settings)
      : renderBlendedRotoInterpolationFrame(from, to, targetFrame, displayEntry.t, settings);
    if (!rendered) throw new Error('Generated Roto alpha sources are unavailable.');
    const generatedFrame = {
      ...rendered,
      nearestRealKeyFrame: displayEntry.fromSourceFrame,
      fromSourceFrame: displayEntry.fromSourceFrame,
      ...(displayEntry.toSourceFrame !== undefined ? { toSourceFrame: displayEntry.toSourceFrame } : {}),
      interpolationT: displayEntry.t,
    };
    generatedMetadata.set(targetFrame, _makeRotoCacheFrame(generatedFrame, targetFrame, 'generated-interpolation', displayEntry.fromSourceFrame, undefined, {
      displayFrame: targetFrame,
      fromSourceFrame: displayEntry.fromSourceFrame,
      ...(displayEntry.toSourceFrame !== undefined ? { toSourceFrame: displayEntry.toSourceFrame } : {}),
      interpolationT: displayEntry.t,
    }));
    generatedFrames.push(generatedFrame);
  }
  return { changed: removed || generatedFrames.length > 0, generatedFrames, failed: false };
}

function _errorResult(payload: Pick<PhysicPaintApplyPayload, 'kind' | 'operationId' | 'layerId' | 'startFrame'>, error: string): PhysicPaintApplyResult {
  return {
    operationId: payload.operationId,
    kind: payload.kind,
    layerId: payload.layerId,
    startFrame: payload.startFrame,
    appliedFrameCount: 0,
    ok: false,
    error,
  };
}

/**
 * Build the canonical v1.0 rotoPhysical document payload for one layer, or
 * null when the layer has no physical Roto state. Consumed by the v1.0
 * document projection (extractRuntimeStateForDocument) so the serialized
 * payload is always schema-valid. Reads the module maps directly (the
 * `_resolveRotoPhysicalStructural` idiom) and mirrors the getRoto* accessor
 * derivations exactly.
 */
function _buildRotoPhysicalDocumentForLayer(layerId: string, trackId: string): PhysicPaintRotoPhysicalDocument | null {
  const recordMap = _rotoRealKeyRecords.get(layerId)?.get(trackId);
  if (!recordMap) return null;
  const realKeyRecords = Array.from(recordMap.values()).sort((a, b) => a.appFrame - b.appFrame || a.keyId.localeCompare(b.keyId));
  const groupOverrideRecords = Array.from(_rotoGroupOverrideRecords.get(layerId)?.get(trackId)?.values() ?? [])
    .sort((a, b) => a.appFrame - b.appFrame || a.keyId.localeCompare(b.keyId));
  const interpolation = _rotoPhysicalInterpolationState.get(layerId)?.get(trackId) ?? PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED;
  const capacity = _rotoPhysicalCapacity.get(layerId)?.get(trackId) ?? PHYSIC_PAINT_MAX_APPLY_FRAMES;
  const selectedCandidate = _rotoPhysicalSelectedKeyId.get(layerId)?.get(trackId) ?? null;
  const selectedRecord = selectedCandidate === null ? null : realKeyRecords.find((record) => record.keyId === selectedCandidate) ?? null;
  const selectedKeyId = selectedRecord?.keyId ?? null;
  const cursorCandidate = selectedRecord?.appFrame ?? _rotoPhysicalCursorAppFrame.get(layerId)?.get(trackId) ?? 0;
  const cursorAppFrame = Math.max(0, Math.min(capacity - 1, cursorCandidate));
  const loopClips = _rotoPhysicalLoopClips.get(layerId)?.get(trackId) ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY;
  const incomingInterpolationBreakKeyIds = _rotoPhysicalIncomingInterpolationBreakKeyIds.get(layerId)?.get(trackId)
    ?? PHYSIC_PAINT_ROTO_INCOMING_INTERPOLATION_BREAK_KEY_IDS_EMPTY;
  return parsePhysicPaintRotoPhysicalDocument({
    capacity,
    realKeyRecords,
    groupOverrideRecords,
    interpolation,
    scriptMotion: _rotoPhysicalScriptMotion.get(layerId)?.get(trackId) ?? PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO,
    background: _rotoBackgroundMetadata.get(layerId)?.get(trackId) ?? null,
    selectedKeyId,
    cursorAppFrame,
    revision: buildPhysicPaintRotoPhysicalRevision(
      realKeyRecords,
      interpolation,
      loopClips,
      incomingInterpolationBreakKeyIds,
      groupOverrideRecords,
    ),
    loopClips,
    incomingInterpolationBreakKeyIds,
  });
}

export const physicPaintStore = {
  getFrame(layerId: string, trackId: string, frame: number): PhysicPaintRenderedFrame | null {
    return _frames.get(layerId)?.get(trackId)?.get(frame) ?? null;
  },

  getRotoFrame(layerId: string, trackId: string, frame: number): PhysicPaintRotoCacheFrame | null {
    const displayFrame = _getRotoDisplayFrame(layerId, trackId, frame);
    if (!displayFrame) return null;
    if (displayFrame.source === 'real-key') {
      const sourceFrame = displayFrame.sourceFrame ?? displayFrame.appFrame;
      const rendered = _frames.get(layerId)?.get(trackId)?.get(sourceFrame);
      return rendered ? { ...rendered, appFrame: frame, source: 'real-key', sourceFrame, displayFrame: frame } : null;
    }
    return { ...displayFrame, appFrame: frame };
  },

  getRotoBackgroundMetadata(layerId: string, trackId: string): PhysicPaintRotoBackgroundMetadata | null {
    const metadata = _rotoBackgroundMetadata.get(layerId)?.get(trackId);
    return metadata ? { ...metadata } : null;
  },

  setRotoBackgroundMetadata(layerId: string, trackId: string, metadata: PhysicPaintRotoBackgroundMetadata): void {
    _getOrCreateLayerTrackMap(_rotoBackgroundMetadata, layerId).set(trackId, { ...metadata });
    bumpTrackRevision(layerId, trackId);
  },

  getRotoPlaybackSettings(layerId: string, trackId: string): PhysicPaintRotoPlaybackSettings | null {
    const settings = _rotoPlaybackSettings.get(layerId)?.get(trackId);
    return settings ? { ...settings } : null;
  },

  setRotoPlaybackSettings(layerId: string, trackId: string, settings: PhysicPaintRotoPlaybackSettings): boolean {
    if (!isPhysicPaintRotoPlaybackSettings(settings)) return false;
    const current = _rotoPlaybackSettings.get(layerId)?.get(trackId);
    if (current?.loop === settings.loop && current.fps === settings.fps) return false;
    _getOrCreateLayerTrackMap(_rotoPlaybackSettings, layerId).set(trackId, { ...settings });
      _markProjectDirty?.();
    return true;
  },

  getFrames(layerId: string, trackId: string): Map<number, PhysicPaintRenderedFrame> {
    return new Map(_frames.get(layerId)?.get(trackId) ?? []);
  },

  getRotoCacheFrames(layerId: string, trackId: string): PhysicPaintRotoCacheFrame[] {
    const frames = _getCombinedRotoMetadata(layerId, trackId);
    if (frames.length === 0) return [];
    const displayFrames = frames
      .map(frame => ({
        ...frame,
        appFrame: frame.displayFrame ?? frame.appFrame,
        ...(frame.sourceFrame !== undefined ? { sourceFrame: frame.sourceFrame } : frame.source === 'real-key' ? { sourceFrame: frame.appFrame } : {}),
        ...(frame.displayFrame !== undefined ? { displayFrame: frame.displayFrame } : {}),
      }))
      .sort((a, b) => a.appFrame - b.appFrame || getRotoCacheFrameSourceOrder(a.source) - getRotoCacheFrameSourceOrder(b.source));
    const byDisplayFrame = new Map<number, PhysicPaintRotoCacheFrame>();
    for (const frame of displayFrames) if (!byDisplayFrame.has(frame.appFrame)) byDisplayFrame.set(frame.appFrame, frame);
    return Array.from(byDisplayFrame.values());
  },

  upsertRealRotoKeyFrame(layerId: string, trackId: string, frame: number, renderedFrame: PhysicPaintRenderedFrame, backgroundOnly = false, diagnostics?: { mutationId?: number; record: (sample: PhysicsPaintPerformanceSample) => void }): void {
    if (!Number.isInteger(frame) || frame < 0) return;
    const insertionStartedAt = diagnostics ? performance.now() : 0;
    _removeBackgroundOnlyRotoSupport(layerId, trackId, [frame]);
    const settings = this.getRotoInterpolationSettings(layerId, trackId);
    const normalizedFrame = { ...renderedFrame, appFrame: frame, frameIndex: 0, source: 'real-key' as const };
    _getOrCreateTrack(layerId, trackId).set(frame, normalizedFrame);
    _getOrCreateTrackRotoMetadata(layerId, trackId).set(frame, _normalizeRealRotoCacheFrame(normalizedFrame, frame, backgroundOnly || undefined));
    _pruneFramesOutsideRotoCacheMetadata(layerId, trackId);
    if (diagnostics) diagnostics.record({ stage: 'store-real-key-insert', category: 'sync-cpu', durationMs: performance.now() - insertionStartedAt, timestamp: performance.now(), mutationId: diagnostics.mutationId, sourceFrame: frame });
    if (settings.enabled) {
      const interpolationStartedAt = diagnostics ? performance.now() : 0;
      _tryRegenerateGeneratedRotoCache(layerId, trackId, settings);
      if (diagnostics) diagnostics.record({ stage: 'store-interpolation-regeneration', category: 'sync-cpu', durationMs: performance.now() - interpolationStartedAt, timestamp: performance.now(), mutationId: diagnostics.mutationId, sourceFrame: frame, branch: settings.mode });
    }
    bumpTrackRevision(layerId, trackId, diagnostics);
  },

  removeRealRotoKeyFrame(layerId: string, trackId: string, frame: number): boolean {
    if (!Number.isInteger(frame) || frame < 0) return false;
    const metadata = _rotoCacheMetadata.get(layerId)?.get(trackId);
    if (metadata?.get(frame)?.source !== 'real-key') return false;
    const previousSupportFrames = Array.from(metadata.values())
      .filter((candidate) => candidate.source === 'background-only-support')
      .map((candidate) => candidate.appFrame);
    const trackFrames = _frames.get(layerId)?.get(trackId);
    trackFrames?.delete(frame);
    metadata.delete(frame);
    _removeBackgroundOnlyRotoSupport(layerId, trackId);
    _recomputeBackgroundOnlyRotoSupport(layerId, trackId, previousSupportFrames);
    const settings = this.getRotoInterpolationSettings(layerId, trackId);
    if (settings.enabled) {
      _tryRegenerateGeneratedRotoCache(layerId, trackId, settings);
    }
    bumpTrackRevision(layerId, trackId);
    return true;
  },

  /**
   * Extract one track's runtime state into the v1.0 document projection shape
   * (Phase 45-04 Task 2, 46-01 track-scoped). The rotoPhysical payload is
   * rebuilt through the canonical parser so the document always carries a
   * schema-valid, revision-consistent record.
   */
  extractRuntimeStateForDocument(layerId: string, trackId: string): EfxPaintRuntimeProjection {
    const frames = new Map(_frames.get(layerId)?.get(trackId) ?? []);
    return { frames, rotoPhysical: _buildRotoPhysicalDocumentForLayer(layerId, trackId) };
  },

  /**
   * Install one track's runtime state from a v1.0 document projection payload
   * (Phase 45-04 Task 2, 46-01 track-scoped). Replaces the track's runtime
   * maps wholesale with the same validation (canonical parse + timeline
   * projection) and publication (bump rotoPhysicalRevision +
   * physicPaintVersion, no dirty callback — the caller owns project-dirty
   * signaling). Other tracks of the same layer are untouched.
   */
  installRuntimeStateFromDocument(layerId: string, trackId: string, payload: EfxPaintRuntimeProjection): void {
    const layerFrames = _frames.get(layerId);
    layerFrames?.delete(trackId);
    const backgroundTracks = _rotoBackgroundMetadata.get(layerId);
    backgroundTracks?.delete(trackId);
    const recordTracks = _rotoRealKeyRecords.get(layerId);
    recordTracks?.delete(trackId);
    const groupOverrideTracks = _rotoGroupOverrideRecords.get(layerId);
    groupOverrideTracks?.delete(trackId);
    const interpolationTracks = _rotoPhysicalInterpolationState.get(layerId);
    interpolationTracks?.delete(trackId);
    const scriptMotionTracks = _rotoPhysicalScriptMotion.get(layerId);
    scriptMotionTracks?.delete(trackId);
    const loopClipTracks = _rotoPhysicalLoopClips.get(layerId);
    loopClipTracks?.delete(trackId);
    const incomingBreakTracks = _rotoPhysicalIncomingInterpolationBreakKeyIds.get(layerId);
    incomingBreakTracks?.delete(trackId);
    const selectedKeyTracks = _rotoPhysicalSelectedKeyId.get(layerId);
    selectedKeyTracks?.delete(trackId);
    const cursorTracks = _rotoPhysicalCursorAppFrame.get(layerId);
    cursorTracks?.delete(trackId);
    const capacityTracks = _rotoPhysicalCapacity.get(layerId);
    capacityTracks?.delete(trackId);
    _rotoPhysicalStructuralCache.delete(_rotoPhysicalStructuralCacheKey(layerId, trackId));
    if (payload.frames.size > 0) {
      const trackFrames = _getOrCreateTrack(layerId, trackId);
      trackFrames.clear();
      for (const [frame, value] of payload.frames) trackFrames.set(frame, value);
    }
    if (payload.rotoPhysical) {
      const physical = parsePhysicPaintRotoPhysicalDocument(payload.rotoPhysical);
      // (46-01 TRK-03) per-track revisions bump WITHOUT the dirty callback —
      // the caller owns project-dirty signaling for installs.
      const projection = projectPhysicPaintRotoPhysicalTimeline({
        identities: physical.realKeyRecords.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame })),
        capacity: physical.capacity,
        interpolationEnabled: physical.interpolation.enabled,
        incomingInterpolationBreakKeyIds: physical.incomingInterpolationBreakKeyIds,
      });
      if (!projection.ok) throw new Error(projection.failure.text);
      const recordMap = _getOrCreateTrackRecords(layerId, trackId);
      for (const record of physical.realKeyRecords) recordMap.set(record.keyId, record);
      const groupOverrideMap = new Map<string, PhysicPaintRotoRealKeyRecord>();
      for (const record of physical.groupOverrideRecords ?? []) groupOverrideMap.set(record.keyId, record);
      _getOrCreateLayerTrackMap(_rotoGroupOverrideRecords, layerId).set(trackId, groupOverrideMap);
      _getOrCreateLayerTrackMap(_rotoPhysicalInterpolationState, layerId).set(trackId, physical.interpolation);
      _getOrCreateLayerTrackMap(_rotoPhysicalScriptMotion, layerId).set(trackId, physical.scriptMotion);
      _getOrCreateLayerTrackMap(_rotoPhysicalLoopClips, layerId).set(trackId, physical.loopClips);
      _getOrCreateLayerTrackMap(_rotoPhysicalIncomingInterpolationBreakKeyIds, layerId).set(trackId, physical.incomingInterpolationBreakKeyIds);
      _getOrCreateLayerTrackMap(_rotoPhysicalSelectedKeyId, layerId).set(trackId, physical.selectedKeyId);
      _getOrCreateLayerTrackMap(_rotoPhysicalCursorAppFrame, layerId).set(trackId, physical.cursorAppFrame);
      _getOrCreateLayerTrackMap(_rotoPhysicalCapacity, layerId).set(trackId, physical.capacity);
      if (physical.background) _getOrCreateLayerTrackMap(_rotoBackgroundMetadata, layerId).set(trackId, { ...physical.background });
    }
    rotoPhysicalRevision.value = rotoPhysicalRevision.value + 1;
    bumpTrackRevision(layerId, trackId, undefined, false);
  },

  setFrame(layerId: string, trackId: string, frame: number, renderedFrame: PhysicPaintRenderedFrame): void {
    if (!Number.isInteger(frame) || frame < 0) return;
    _getOrCreateTrack(layerId, trackId).set(frame, { ...renderedFrame, appFrame: frame });
    bumpTrackRevision(layerId, trackId);
  },

  getRotoInterpolationSettings(layerId: string, trackId: string): PhysicPaintRotoInterpolationSettings {
    return _cloneRotoInterpolationSettings({ ...DEFAULT_ROTO_INTERPOLATION_SETTINGS, ...(_rotoInterpolationSettings.get(layerId)?.get(trackId) ?? {}) });
  },

  getRotoInterpolationFailureStatus(layerId: string, trackId: string): string | null {
    return _rotoInterpolationFailureStatus.get(layerId)?.get(trackId) ?? null;
  },

  setRotoInterpolationSettings(layerId: string, trackId: string, settings: Partial<PhysicPaintRotoInterpolationSettings>): PhysicPaintRenderedFrame[] {
    const realKeys = _getRealRotoKeyFrames(layerId, trackId);
    const current = _rotoInterpolationSettings.get(layerId)?.get(trackId);
    const source = {
      ...(current ?? {}),
      ...settings,
      segmentSpacingOverrides: settings.segmentSpacingOverrides ?? current?.segmentSpacingOverrides,
    };
    const normalized = _normalizeRotoInterpolationSettings(source, realKeys);
    _getOrCreateLayerTrackMap(_rotoInterpolationSettings, layerId).set(trackId, normalized);
    const { changed, generatedFrames } = _tryRegenerateGeneratedRotoCache(layerId, trackId, normalized);
    if (changed || _rotoInterpolationSettings.get(layerId)?.has(trackId)) bumpTrackRevision(layerId, trackId);
    return generatedFrames.map(frame => ({ ...frame }));
  },

  replaceGeneratedRotoCache(layerId: string, trackId: string, generatedFrames: PhysicPaintRenderedFrame[], settings?: PhysicPaintRotoInterpolationSettings): boolean {
    if (settings !== undefined && !isPhysicPaintRotoInterpolationSettings(settings)) return false;
    const removed = _removeGeneratedRotoCache(layerId, trackId);
    const generatedMetadata = _getOrCreateTrackGeneratedRotoMetadata(layerId, trackId);
    let added = false;
    for (const frame of generatedFrames) {
      if (!Number.isInteger(frame.appFrame) || frame.appFrame < 0) continue;
      const normalizedFrame = { ...frame, appFrame: frame.appFrame, source: 'generated-interpolation' as const };
      generatedMetadata.set(frame.appFrame, _makeRotoCacheFrame(normalizedFrame, frame.appFrame, 'generated-interpolation', 'nearestRealKeyFrame' in frame ? frame.nearestRealKeyFrame : undefined));
      added = true;
    }
    if (settings) _getOrCreateLayerTrackMap(_rotoInterpolationSettings, layerId).set(trackId, _normalizeRotoInterpolationSettings(settings, _getRealRotoKeyFrames(layerId, trackId)));
    if (removed || added || settings) bumpTrackRevision(layerId, trackId);
    return true;
  },

  regenerateRotoInterpolationCache(layerId: string, trackId: string): PhysicPaintRenderedFrame[] {
    const settings = this.getRotoInterpolationSettings(layerId, trackId);
    const { changed, generatedFrames } = _tryRegenerateGeneratedRotoCache(layerId, trackId, settings);
    if (changed) bumpTrackRevision(layerId, trackId);
    return generatedFrames.map(frame => ({ ...frame }));
  },

  getRealRotoKeyFrames(layerId: string, trackId: string): number[] {
    return _getRealRotoKeyFrames(layerId, trackId);
  },

  getBackgroundOnlyRotoSupportFrames(layerId: string, trackId: string): number[] {
    return this.getRotoCacheFrames(layerId, trackId)
      .filter((frame) => frame.source === 'background-only-support')
      .map((frame) => frame.appFrame);
  },

  recomputeBackgroundOnlyRotoSupport(layerId: string, trackId: string, requestedFrames: readonly number[]): PhysicPaintRotoCacheFrame[] {
    const { changed, supportFrames } = _recomputeBackgroundOnlyRotoSupport(layerId, trackId, requestedFrames);
    if (changed) bumpTrackRevision(layerId, trackId);
    return supportFrames;
  },

  removeBackgroundOnlyRotoSupport(layerId: string, trackId: string, frames?: Iterable<number>): boolean {
    const changed = _removeBackgroundOnlyRotoSupport(layerId, trackId, frames);
    if (changed) bumpTrackRevision(layerId, trackId);
    return changed;
  },


  removeFrameRange(layerId: string, trackId: string, startFrame: number, frameCount: number): void {
    if (!Number.isInteger(startFrame) || startFrame < 0 || !Number.isInteger(frameCount) || frameCount < 1) return;
    const trackFrames = _frames.get(layerId)?.get(trackId);
    const generatedMetadata = _rotoGeneratedCacheMetadata.get(layerId)?.get(trackId);
    if (!trackFrames && !generatedMetadata) return;
    let changed = false;
    for (let offset = 0; offset < frameCount; offset++) {
      const frame = startFrame + offset;
      changed = (trackFrames?.delete(frame) ?? false) || changed;
      changed = (generatedMetadata?.delete(frame) ?? false) || changed;
    }
    if (changed) bumpTrackRevision(layerId, trackId);
  },

  /** 46-01: whether one track has any runtime entry across the map inventory
   * (empty-but-present tracks stay addressable by trackId, TRK-01 empty). */
  hasTrackRuntime(layerId: string, trackId: string): boolean {
    return Boolean(
      _frames.get(layerId)?.has(trackId)
      || _rotoBackgroundMetadata.get(layerId)?.has(trackId)
      || _rotoCacheMetadata.get(layerId)?.has(trackId)
      || _rotoGeneratedCacheMetadata.get(layerId)?.has(trackId)
      || _rotoInterpolationSettings.get(layerId)?.has(trackId)
      || _rotoInterpolationFailureStatus.get(layerId)?.has(trackId)
      || _rotoRealKeyRecords.get(layerId)?.has(trackId)
      || _rotoGroupOverrideRecords.get(layerId)?.has(trackId)
      || _rotoPhysicalInterpolationState.get(layerId)?.has(trackId)
      || _rotoPhysicalScriptMotion.get(layerId)?.has(trackId)
      || _rotoPhysicalSelectedKeyId.get(layerId)?.has(trackId)
      || _rotoPhysicalCursorAppFrame.get(layerId)?.has(trackId)
      || _rotoPhysicalCapacity.get(layerId)?.has(trackId)
      || _rotoPhysicalLoopClips.get(layerId)?.has(trackId)
      || _rotoPhysicalIncomingInterpolationBreakKeyIds.get(layerId)?.has(trackId)
      || _rotoPlaybackSettings.get(layerId)?.has(trackId),
    );
  },


  applyCanvas(payload: PhysicPaintApplyPayload): PhysicPaintApplyResult {
    if (!isPhysicPaintApplyPayload(payload)) {
      return _errorResult(payload, 'Invalid physics paint apply payload');
    }
    if (payload.kind !== 'apply-canvas') {
      return _errorResult(payload, 'Expected apply-canvas payload');
    }

    const physicalRecord = this.getRotoRealKeyRecordByAppFrame(payload.layerId, payload.trackId, payload.startFrame);
    if (physicalRecord) {
      const currentRevision = this.getRotoPhysicalContentRevision(payload.layerId, payload.trackId);
      if (!currentRevision) return _errorResult(payload, 'Physical Roto content revision is unavailable');
      const previousBackground = _rotoBackgroundMetadata.get(payload.layerId)?.get(payload.trackId) ?? null;
      const nextBackground = payload.rotoBackground ?? previousBackground;
      if (nextBackground) _getOrCreateLayerTrackMap(_rotoBackgroundMetadata, payload.layerId).set(payload.trackId, { ...nextBackground });
      else _rotoBackgroundMetadata.get(payload.layerId)?.delete(payload.trackId);
      const update = this.updateRotoPhysicalRealKeyPayload(payload.layerId, payload.trackId, physicalRecord.keyId, currentRevision, {
        frameIndex: payload.renderedFrame.frameIndex,
        appFrame: physicalRecord.appFrame,
        dataUrl: payload.renderedFrame.dataUrl,
        ...(payload.renderedFrame.width !== undefined ? { width: payload.renderedFrame.width } : {}),
        ...(payload.renderedFrame.height !== undefined ? { height: payload.renderedFrame.height } : {}),
      });
      if (!update.ok) {
        if (previousBackground) _getOrCreateLayerTrackMap(_rotoBackgroundMetadata, payload.layerId).set(payload.trackId, previousBackground);
        else _rotoBackgroundMetadata.get(payload.layerId)?.delete(payload.trackId);
        return _errorResult(payload, update.error);
      }
      if (!update.changed && JSON.stringify(previousBackground) !== JSON.stringify(nextBackground)) bumpTrackRevision(payload.layerId, payload.trackId);
    } else {
      const rotoBackground = payload.rotoBackground ?? null;
      if (rotoBackground) _getOrCreateLayerTrackMap(_rotoBackgroundMetadata, payload.layerId).set(payload.trackId, { ...rotoBackground });
      this.upsertRealRotoKeyFrame(payload.layerId, payload.trackId, payload.sourceFrame ?? payload.startFrame, { ...payload.renderedFrame, ...(payload.onionDataUrl ? { onionDataUrl: payload.onionDataUrl } : {}) }, payload.backgroundOnly === true);
      if (payload.rotoInterpolationSettings) this.setRotoInterpolationSettings(payload.layerId, payload.trackId, payload.rotoInterpolationSettings);
    }
    return {
      operationId: payload.operationId,
      kind: payload.kind,
      layerId: payload.layerId,
      startFrame: payload.startFrame,
      appliedFrameCount: 1,
      ok: true,
    };
  },

  deleteRotoFrame(payload: Extract<PhysicPaintApplyPayload, { kind: 'delete-roto-frame' }>): PhysicPaintApplyResult {
    if (!isPhysicPaintApplyPayload(payload)) {
      return _errorResult(payload, 'Invalid physics paint delete payload');
    }
    if (payload.kind !== 'delete-roto-frame') {
      return _errorResult(payload, 'Expected delete-roto-frame payload');
    }

    this.removeRealRotoKeyFrame(payload.layerId, payload.trackId, payload.sourceFrame ?? payload.startFrame);
    return {
      operationId: payload.operationId,
      kind: payload.kind,
      layerId: payload.layerId,
      startFrame: payload.startFrame,
      appliedFrameCount: 0,
      ok: true,
    };
  },

  replaceRotoKeyFrames(payload: Extract<PhysicPaintApplyPayload, { kind: 'replace-roto-key-frames' }>): PhysicPaintApplyResult {
    if (!isPhysicPaintApplyPayload(payload)) {
      return _errorResult(payload, 'Invalid physics paint key frame payload');
    }
    if (payload.kind !== 'replace-roto-key-frames') {
      return _errorResult(payload, 'Expected replace-roto-key-frames payload');
    }

    const trackId = payload.trackId;
    const previousGenerated = _removeGeneratedRotoCache(payload.layerId, trackId);
    if (payload.rotoBackground) {
      _getOrCreateLayerTrackMap(_rotoBackgroundMetadata, payload.layerId).set(trackId, { ...payload.rotoBackground });
    }
    if (payload.rotoInterpolationSettings) {
      _getOrCreateLayerTrackMap(_rotoInterpolationSettings, payload.layerId).set(trackId, _normalizeRotoInterpolationSettings(payload.rotoInterpolationSettings));
    }
    const previousSupportFrames = this.getBackgroundOnlyRotoSupportFrames(payload.layerId, trackId);
    const previousSupport = _removeBackgroundOnlyRotoSupport(payload.layerId, trackId);
    const previousRealKeys = _getRealRotoKeyFrames(payload.layerId, trackId);
    const trackFrames = _getOrCreateTrack(payload.layerId, trackId);
    const metadata = _getOrCreateTrackRotoMetadata(payload.layerId, trackId);
    for (const frame of previousRealKeys) {
      trackFrames.delete(frame);
      metadata.delete(frame);
    }
    for (const frame of payload.frames) {
      const sourceFrame = frame.sourceFrame ?? frame.appFrame;
      const normalizedFrame = { ...frame, appFrame: sourceFrame, frameIndex: 0, source: 'real-key' as const };
      trackFrames.set(sourceFrame, normalizedFrame);
      metadata.set(sourceFrame, _normalizeRealRotoCacheFrame(normalizedFrame, sourceFrame, frame.backgroundOnly || undefined));
    }
    const supportRecompute = _recomputeBackgroundOnlyRotoSupport(payload.layerId, trackId, previousSupportFrames);
    const { changed, generatedFrames } = _tryRegenerateGeneratedRotoCache(payload.layerId, trackId, this.getRotoInterpolationSettings(payload.layerId, trackId));
    if (previousGenerated || previousSupport || supportRecompute.changed || previousRealKeys.length > 0 || payload.frames.length > 0 || changed || generatedFrames.length > 0) bumpTrackRevision(payload.layerId, trackId);
    return {
      operationId: payload.operationId,
      kind: payload.kind,
      layerId: payload.layerId,
      startFrame: payload.startFrame,
      appliedFrameCount: payload.frames.length,
      ok: true,
    };
  },

  snapshotLayer(layerId: string, trackId: string): PhysicPaintLayerSnapshot | null {
    const frames = _frames.get(layerId)?.get(trackId);
    const rotoBackground = _rotoBackgroundMetadata.get(layerId)?.get(trackId);
    const rotoCacheMetadata = _rotoCacheMetadata.get(layerId)?.get(trackId);
    const rotoGeneratedCacheMetadata = _rotoGeneratedCacheMetadata.get(layerId)?.get(trackId);
    const rotoInterpolationSettings = _rotoInterpolationSettings.get(layerId)?.get(trackId);
    const rotoInterpolationFailureStatus = _rotoInterpolationFailureStatus.get(layerId)?.get(trackId);
    const rotoPlaybackSettings = _rotoPlaybackSettings.get(layerId)?.get(trackId);
    const alphaCanvases: Array<[string, HTMLCanvasElement]> = [];
    for (const dataUrl of _getTrackDataUrls(layerId, trackId)) {
      const canvas = _rotoAlphaCanvasRegistry.get(dataUrl);
      if (canvas) alphaCanvases.push([dataUrl, canvas]);
    }
    if (!frames && !rotoBackground && !rotoCacheMetadata && !rotoGeneratedCacheMetadata && !rotoInterpolationSettings && !rotoInterpolationFailureStatus && !rotoPlaybackSettings && alphaCanvases.length === 0) return null;
    return {
      layerId,
      trackId,
      ...(frames ? { frames: Array.from(frames, ([frame, value]) => [frame, { ...value }]) } : {}),
      ...(rotoBackground ? { rotoBackground: { ...rotoBackground } } : {}),
      ...(rotoCacheMetadata ? { rotoCacheMetadata: Array.from(rotoCacheMetadata, ([frame, value]) => [frame, { ...value }]) } : {}),
      ...(rotoGeneratedCacheMetadata ? { rotoGeneratedCacheMetadata: Array.from(rotoGeneratedCacheMetadata, ([frame, value]) => [frame, { ...value }]) } : {}),
      ...(rotoInterpolationSettings ? { rotoInterpolationSettings: _cloneRotoInterpolationSettings(rotoInterpolationSettings) } : {}),
      ...(rotoInterpolationFailureStatus ? { rotoInterpolationFailureStatus } : {}),
      ...(rotoPlaybackSettings ? { rotoPlaybackSettings: { ...rotoPlaybackSettings } } : {}),
      alphaCanvases,
    };
  },

  restoreLayer(snapshot: PhysicPaintLayerSnapshot): void {
    const { layerId, trackId } = snapshot;
    // Only the snapshot's track is replaced; sibling tracks stay untouched
    // (46-01 TRK-01: per-track teardown/restore law).
    for (const dataUrl of _getTrackDataUrls(layerId, trackId)) {
      _rotoAlphaCanvasRegistry.delete(dataUrl);
    }
    _frames.get(layerId)?.delete(trackId);
    _rotoBackgroundMetadata.get(layerId)?.delete(trackId);
    _rotoCacheMetadata.get(layerId)?.delete(trackId);
    _rotoGeneratedCacheMetadata.get(layerId)?.delete(trackId);
    _rotoInterpolationSettings.get(layerId)?.delete(trackId);
    _rotoInterpolationFailureStatus.get(layerId)?.delete(trackId);
    _rotoRealKeyRecords.get(layerId)?.delete(trackId);
    _rotoGroupOverrideRecords.get(layerId)?.delete(trackId);
    _rotoPhysicalInterpolationState.get(layerId)?.delete(trackId);
    _rotoPhysicalScriptMotion.get(layerId)?.delete(trackId);
    _rotoPhysicalLoopClips.get(layerId)?.delete(trackId);
    _rotoPhysicalIncomingInterpolationBreakKeyIds.get(layerId)?.delete(trackId);
    _rotoPhysicalSelectedKeyId.get(layerId)?.delete(trackId);
    _rotoPhysicalCursorAppFrame.get(layerId)?.delete(trackId);
    _rotoPhysicalCapacity.get(layerId)?.delete(trackId);
    _rotoPlaybackSettings.get(layerId)?.delete(trackId);
    _rotoPhysicalStructuralCache.delete(_rotoPhysicalStructuralCacheKey(layerId, trackId));
    if (snapshot.frames) {
      const trackFrames = _getOrCreateTrack(layerId, trackId);
      for (const [frame, value] of snapshot.frames) trackFrames.set(frame, { ...value });
    }
    if (snapshot.rotoBackground) _getOrCreateLayerTrackMap(_rotoBackgroundMetadata, layerId).set(trackId, { ...snapshot.rotoBackground });
    if (snapshot.rotoCacheMetadata) {
      const trackMetadata = _getOrCreateTrackRotoMetadata(layerId, trackId);
      for (const [frame, value] of snapshot.rotoCacheMetadata) trackMetadata.set(frame, { ...value });
    }
    if (snapshot.rotoGeneratedCacheMetadata) {
      const trackGeneratedMetadata = _getOrCreateTrackGeneratedRotoMetadata(layerId, trackId);
      for (const [frame, value] of snapshot.rotoGeneratedCacheMetadata) trackGeneratedMetadata.set(frame, { ...value });
    }
    if (snapshot.rotoInterpolationSettings) _getOrCreateLayerTrackMap(_rotoInterpolationSettings, layerId).set(trackId, _cloneRotoInterpolationSettings(snapshot.rotoInterpolationSettings));
    if (snapshot.rotoInterpolationFailureStatus) _getOrCreateLayerTrackMap(_rotoInterpolationFailureStatus, layerId).set(trackId, snapshot.rotoInterpolationFailureStatus);
    if (snapshot.rotoPlaybackSettings) _getOrCreateLayerTrackMap(_rotoPlaybackSettings, layerId).set(trackId, { ...snapshot.rotoPlaybackSettings });
    for (const [dataUrl, canvas] of snapshot.alphaCanvases) {
      if (!_rotoAlphaCanvasRegistry.has(dataUrl)) _rotoAlphaCanvasRegistry.set(dataUrl, canvas);
    }
    bumpTrackRevision(layerId, trackId);
  },

  hasOutput(layerId: string, trackId: string): boolean {
    return (_frames.get(layerId)?.get(trackId)?.size ?? 0) > 0;
  },

  clearLayer(layerId: string): void {
    if (_clearLayerState(layerId)) _notifyVisualChange();
  },

  reset(options?: { preserveRotoAlphaCanvases?: boolean }): void {
    const resetAlphaCanvases = options?.preserveRotoAlphaCanvases !== true;
    if (_frames.size === 0 && _rotoBackgroundMetadata.size === 0 && _rotoCacheMetadata.size === 0 && _rotoGeneratedCacheMetadata.size === 0 && _rotoInterpolationSettings.size === 0 && _rotoInterpolationFailureStatus.size === 0 && (!resetAlphaCanvases || _rotoAlphaCanvasRegistry.size === 0) && _rotoRealKeyRecords.size === 0 && _rotoGroupOverrideRecords.size === 0 && _rotoPhysicalInterpolationState.size === 0 && _rotoPhysicalScriptMotion.size === 0 && _rotoPhysicalLoopClips.size === 0 && _rotoPhysicalSelectedKeyId.size === 0 && _rotoPhysicalCursorAppFrame.size === 0 && _rotoPhysicalCapacity.size === 0 && _rotoPlaybackSettings.size === 0 && _rotoPhysicalOperationLeases.size === 0 && _settledRotoPhysicalOperationLeases.size === 0 && trackRevisions.size === 0) return;
    _frames.clear();
    _rotoBackgroundMetadata.clear();
    _rotoCacheMetadata.clear();
    _rotoGeneratedCacheMetadata.clear();
    _rotoInterpolationSettings.clear();
    _rotoInterpolationFailureStatus.clear();
    if (resetAlphaCanvases) _rotoAlphaCanvasRegistry.clear();
    _rotoRealKeyRecords.clear();
    _rotoGroupOverrideRecords.clear();
    _rotoPhysicalInterpolationState.clear();
    _rotoPhysicalScriptMotion.clear();
    _rotoPhysicalLoopClips.clear();
    _rotoPhysicalIncomingInterpolationBreakKeyIds.clear();
    _rotoPhysicalSelectedKeyId.clear();
    _rotoPhysicalCursorAppFrame.clear();
    _rotoPhysicalCapacity.clear();
    _rotoPlaybackSettings.clear();
    const hadActivePhysicalOperationLease = _rotoPhysicalOperationLeases.size > 0;
    _rotoPhysicalOperationLeases.clear();
    _settledRotoPhysicalOperationLeases.clear();
    if (hadActivePhysicalOperationLease) _notifyRotoPhysicalOperationLeaseChange();
    _rotoPhysicalStructuralCache.clear();
    _rotoPhysicalContentTokens.clear();
    _rotoPhysicalContentTokenCounter = 0;
    trackRevisions.clear();
    _notifyVisualChange();
  },

  pruneUnreferencedRotoAlphaCanvases(dataUrls: Iterable<string>): void {
    _pruneUnreferencedRotoAlphaCanvases(dataUrls);
  },

  // -------------------------------------------------------------------------
  // Physical record ownership (D-01/D-02/D-03/D-10).
  //
  // These ports own the validated per-layer physical real-key records and
  // canonical interpolation state. Complete replacement validates the whole
  // collection and the derived projection before any mutation; failure leaves
  // records, interpolation, generated render artifacts, project-dirty state,
  // and physicPaintVersion unchanged. An accepted visible change follows the
  // established dirty/version convention exactly once after the complete
  // replacement.
  // -------------------------------------------------------------------------

  /**
   * Validate and replace the complete per-TRACK physical real-key record
   * collection and canonical interpolation state atomically (46-01: trackId
   * is the second addressing dimension; sibling tracks are untouched).
   * Returns a closed success/failure result; failure changes nothing.
   */
  replaceRotoPhysicalRecords(
    layerId: string,
    trackId: string,
    records: unknown,
    interpolation: unknown,
    capacity: number,
  ): { ok: true } | { ok: false; error: string } {
    if (!layerId || typeof layerId !== 'string') {
      return { ok: false, error: 'Layer ID must be a non-empty string.' };
    }
    if (!trackId || typeof trackId !== 'string') {
      return { ok: false, error: 'Track ID must be a non-empty string.' };
    }
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > PHYSIC_PAINT_MAX_APPLY_FRAMES) {
      return { ok: false, error: 'Capacity must be an integer from 1 through PHYSIC_PAINT_MAX_APPLY_FRAMES.' };
    }
    if (!isPhysicPaintRotoInterpolationState(interpolation)) {
      return { ok: false, error: 'Interpolation state must include canonical enabled and mode fields.' };
    }

    let validatedRecords: readonly PhysicPaintRotoRealKeyRecord[];
    try {
      validatedRecords = parsePhysicPaintRotoRealKeyRecordCollection(records, capacity);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Invalid real-key record collection.' };
    }

    // Validate the derived projection before any mutation.
    const identities = validatedRecords.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame }));
    const currentIncomingBreaks = this.getRotoPhysicalIncomingInterpolationBreakKeyIds(layerId, trackId);
    const projectionResult = projectPhysicPaintRotoPhysicalTimeline({
      identities,
      capacity,
      interpolationEnabled: interpolation.enabled,
      incomingInterpolationBreakKeyIds: currentIncomingBreaks,
    });
    if (!projectionResult.ok) {
      return { ok: false, error: projectionResult.failure.text };
    }

    const previousRecords = this.getRotoRealKeyRecords(layerId, trackId);
    const previousPayloadDataUrls = _getTrackDataUrls(layerId, trackId);
    const groupOverrideRecords = this.getRotoGroupOverrideRecords(layerId, trackId);
    const previousInterpolation = this.getRotoPhysicalInterpolationState(layerId, trackId);
    const previousCapacity = this.getRotoPhysicalCapacity(layerId, trackId);
    // Records-only replacement: the Loop Clip collection is untouched, so both
    // sides of the revision comparison carry the current collection.
    const currentLoopClips = this.getRotoPhysicalLoopClips(layerId, trackId);
    const previousRevision = buildPhysicPaintRotoPhysicalRevision(
      previousRecords,
      previousInterpolation,
      currentLoopClips,
      currentIncomingBreaks,
      groupOverrideRecords,
    );
    const nextRevision = buildPhysicPaintRotoPhysicalRevision(
      validatedRecords,
      interpolation,
      currentLoopClips,
      currentIncomingBreaks,
      groupOverrideRecords,
    );
    if (_rotoRealKeyRecords.get(layerId)?.has(trackId) && previousRevision === nextRevision && previousCapacity === capacity) return { ok: true };

    // Atomically replace the complete record set and indexes.
    const recordMap = _getOrCreateTrackRecords(layerId, trackId);
    recordMap.clear();
    for (const record of validatedRecords) recordMap.set(record.keyId, record);
    _getOrCreateLayerTrackMap(_rotoPhysicalInterpolationState, layerId).set(trackId, Object.freeze({
      enabled: interpolation.enabled,
      mode: interpolation.mode,
    }) as PhysicPaintRotoInterpolationState);
    if (!_rotoPhysicalScriptMotion.get(layerId)?.has(trackId)) _getOrCreateLayerTrackMap(_rotoPhysicalScriptMotion, layerId).set(trackId, PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO);
    const previousSelectedKeyId = _rotoPhysicalSelectedKeyId.get(layerId)?.get(trackId) ?? null;
    const selectedRecord = previousSelectedKeyId === null ? null : recordMap.get(previousSelectedKeyId) ?? null;
    _getOrCreateLayerTrackMap(_rotoPhysicalSelectedKeyId, layerId).set(trackId, selectedRecord?.keyId ?? null);
    _getOrCreateLayerTrackMap(_rotoPhysicalCursorAppFrame, layerId).set(trackId, selectedRecord?.appFrame ?? Math.min(_rotoPhysicalCursorAppFrame.get(layerId)?.get(trackId) ?? 0, capacity - 1));
    _getOrCreateLayerTrackMap(_rotoPhysicalCapacity, layerId).set(trackId, capacity);
    _pruneUnreferencedRotoAlphaCanvases(previousPayloadDataUrls);
    rotoPhysicalRevision.value = rotoPhysicalRevision.value + 1;
    bumpTrackRevision(layerId, trackId);
    return { ok: true };
  },

  /** Acquire the sole project/layer authority token for one physical operation. */
  acquireRotoPhysicalOperationLease(
    projectContextId: string,
    layerId: string,
  ): PhysicPaintRotoPhysicalOperationLeaseToken | null {
    if (!projectContextId || !layerId) return null;
    const scope = _rotoPhysicalOperationLeaseScope(projectContextId, layerId);
    if (_rotoPhysicalOperationLeases.has(scope)) return null;
    const token = Object.freeze({
      projectContextId,
      layerId,
      generation: ++_rotoPhysicalOperationLeaseGeneration,
      owner: 'exclusive' as const,
    });
    _rotoPhysicalOperationLeases.set(scope, token);
    _notifyRotoPhysicalOperationLeaseChange();
    return token;
  },

  /** Whether the project/layer scope currently accepts a new physical mutator. */
  isRotoPhysicalOperationAvailable(projectContextId: string, layerId: string): boolean {
    if (!projectContextId || !layerId) return false;
    return !_rotoPhysicalOperationLeases.has(
      _rotoPhysicalOperationLeaseScope(projectContextId, layerId),
    );
  },

  /** Atomically transfer an exact exclusive token to cleanup/recovery ownership. */
  transferRotoPhysicalOperationLeaseToRecovery(
    token: PhysicPaintRotoPhysicalOperationLeaseToken,
  ): PhysicPaintRotoPhysicalOperationLeaseToken | null {
    if (token.owner !== 'exclusive') return null;
    const scope = _rotoPhysicalOperationLeaseScope(token.projectContextId, token.layerId);
    const active = _rotoPhysicalOperationLeases.get(scope);
    if (!active || !_sameRotoPhysicalOperationLease(active, token)) return null;
    const recoveryToken = Object.freeze({ ...token, owner: 'recovery' as const });
    _rotoPhysicalOperationLeases.set(scope, recoveryToken);
    _notifyRotoPhysicalOperationLeaseChange();
    return recoveryToken;
  },

  /** Reconstruct durable recovery ownership before any recovery publication. */
  acquireRotoPhysicalRecoveryLease(
    descriptor: PhysicPaintRotoPhysicalRecoveryLeaseDescriptor,
  ): PhysicPaintRotoPhysicalOperationLeaseToken | null {
    if (!descriptor.projectContextId || !descriptor.layerId
      || !Number.isSafeInteger(descriptor.generation) || descriptor.generation < 1) return null;
    const scope = _rotoPhysicalOperationLeaseScope(descriptor.projectContextId, descriptor.layerId);
    if (_rotoPhysicalOperationLeases.has(scope)) return null;
    const token = Object.freeze({
      ...descriptor,
      owner: 'recovery' as const,
    });
    _rotoPhysicalOperationLeaseGeneration = Math.max(_rotoPhysicalOperationLeaseGeneration, descriptor.generation);
    _rotoPhysicalOperationLeases.set(scope, token);
    _notifyRotoPhysicalOperationLeaseChange();
    return token;
  },

  /** Validate exact active-token identity without mutating lease state. */
  validateRotoPhysicalOperationLease(
    projectContextId: string,
    layerId: string,
    token: PhysicPaintRotoPhysicalOperationLeaseToken | null | undefined,
  ): { ok: true } | { ok: false; reason: PhysicPaintRotoPhysicalOperationLeaseFailureReason } {
    if (!token) return { ok: false, reason: 'missing-token' };
    if (_settledRotoPhysicalOperationLeases.has(_rotoPhysicalOperationLeaseIdentity(token))) {
      return { ok: false, reason: 'replayed-token' };
    }
    const active = _rotoPhysicalOperationLeases.get(_rotoPhysicalOperationLeaseScope(projectContextId, layerId));
    if (!active || !_sameRotoPhysicalOperationLease(active, token)) {
      return { ok: false, reason: 'mismatched-token' };
    }
    return { ok: true };
  },

  /** Release one exact active token after terminal settlement. */
  releaseRotoPhysicalOperationLease(token: PhysicPaintRotoPhysicalOperationLeaseToken): boolean {
    const scope = _rotoPhysicalOperationLeaseScope(token.projectContextId, token.layerId);
    const active = _rotoPhysicalOperationLeases.get(scope);
    if (!active || !_sameRotoPhysicalOperationLease(active, token)) return false;
    _rotoPhysicalOperationLeases.delete(scope);
    _settledRotoPhysicalOperationLeases.add(_rotoPhysicalOperationLeaseIdentity(token));
    _notifyRotoPhysicalOperationLeaseChange();
    return true;
  },

  /** Install one complete validated physical document atomically (46-01 track-scoped). */
  replaceRotoPhysicalDocument(
    layerId: string,
    trackId: string,
    value: unknown,
    leaseToken?: PhysicPaintRotoPhysicalOperationLeaseToken,
  ): { ok: true; document: PhysicPaintRotoPhysicalDocument } | { ok: false; error: string } {
    if (!layerId || typeof layerId !== 'string') return { ok: false, error: 'Layer ID must be a non-empty string.' };
    const leaseValidation = _validateRotoPhysicalLayerPublication(layerId, leaseToken);
    if (!leaseValidation.ok) return { ok: false, error: leaseValidation.reason };
    let document: PhysicPaintRotoPhysicalDocument;
    try {
      document = parsePhysicPaintRotoPhysicalDocument(value);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Invalid physical Roto document.' };
    }
    if (document.capacity > PHYSIC_PAINT_MAX_APPLY_FRAMES) return { ok: false, error: 'Physical Roto document exceeds maximum capacity.' };
    const projection = projectPhysicPaintRotoPhysicalTimeline({
      identities: document.realKeyRecords.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame })),
      capacity: document.capacity,
      interpolationEnabled: document.interpolation.enabled,
      incomingInterpolationBreakKeyIds: document.incomingInterpolationBreakKeyIds,
    });
    if (!projection.ok) return { ok: false, error: projection.failure.text };

    const previousPayloadDataUrls = _getTrackDataUrls(layerId, trackId);
    _getOrCreateLayerTrackMap(_rotoRealKeyRecords, layerId).set(
      trackId,
      new Map(document.realKeyRecords.map((record) => [record.keyId, record])),
    );
    _getOrCreateLayerTrackMap(_rotoGroupOverrideRecords, layerId).set(
      trackId,
      new Map((document.groupOverrideRecords ?? []).map((record) => [record.keyId, record])),
    );
    _getOrCreateLayerTrackMap(_rotoPhysicalInterpolationState, layerId).set(trackId, document.interpolation);
    _getOrCreateLayerTrackMap(_rotoPhysicalScriptMotion, layerId).set(trackId, document.scriptMotion);
    _getOrCreateLayerTrackMap(_rotoPhysicalLoopClips, layerId).set(trackId, document.loopClips);
    _getOrCreateLayerTrackMap(_rotoPhysicalIncomingInterpolationBreakKeyIds, layerId).set(trackId, document.incomingInterpolationBreakKeyIds);
    _getOrCreateLayerTrackMap(_rotoPhysicalSelectedKeyId, layerId).set(trackId, document.selectedKeyId);
    _getOrCreateLayerTrackMap(_rotoPhysicalCursorAppFrame, layerId).set(trackId, document.cursorAppFrame);
    _getOrCreateLayerTrackMap(_rotoPhysicalCapacity, layerId).set(trackId, document.capacity);
    if (document.background) _getOrCreateLayerTrackMap(_rotoBackgroundMetadata, layerId).set(trackId, { ...document.background });
    else _rotoBackgroundMetadata.get(layerId)?.delete(trackId);
    _rotoPhysicalStructuralCache.delete(_rotoPhysicalStructuralCacheKey(layerId, trackId));
    _pruneUnreferencedRotoAlphaCanvases(previousPayloadDataUrls);
    rotoPhysicalRevision.value = rotoPhysicalRevision.value + 1;
    bumpTrackRevision(layerId, trackId);
    return { ok: true, document };
  },

  /** Return the complete canonical physical document for persistence/launch (46-01 track-scoped). */
  getRotoPhysicalDocument(layerId: string, trackId: string): PhysicPaintRotoPhysicalDocument | null {
    if (!_rotoRealKeyRecords.get(layerId)?.has(trackId)) return null;
    const realKeyRecords = this.getRotoRealKeyRecords(layerId, trackId);
    const interpolation = this.getRotoPhysicalInterpolationState(layerId, trackId);
    const capacity = this.getRotoPhysicalCapacity(layerId, trackId);
    const selectedCandidate = _rotoPhysicalSelectedKeyId.get(layerId)?.get(trackId) ?? null;
    const selectedRecord = selectedCandidate === null ? null : realKeyRecords.find((record) => record.keyId === selectedCandidate) ?? null;
    const cursorCandidate = selectedRecord?.appFrame ?? _rotoPhysicalCursorAppFrame.get(layerId)?.get(trackId) ?? 0;
    return parsePhysicPaintRotoPhysicalDocument({
      capacity,
      realKeyRecords,
      groupOverrideRecords: this.getRotoGroupOverrideRecords(layerId, trackId),
      interpolation,
      scriptMotion: _rotoPhysicalScriptMotion.get(layerId)?.get(trackId) ?? PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO,
      background: _rotoBackgroundMetadata.get(layerId)?.get(trackId) ?? null,
      selectedKeyId: selectedRecord?.keyId ?? null,
      cursorAppFrame: Math.max(0, Math.min(capacity - 1, cursorCandidate)),
      // 38.1-07: memoized structural read — identical revision string without
      // the per-read dataUrl-inclusive rehash.
      revision: this.getRotoPhysicalContentRevision(layerId, trackId)!,
      loopClips: this.getRotoPhysicalLoopClips(layerId, trackId),
      incomingInterpolationBreakKeyIds: this.getRotoPhysicalIncomingInterpolationBreakKeyIds(layerId, trackId),
    });
  },

  setRotoPhysicalSelection(layerId: string, trackId: string, selectedKeyId: string | null, cursorAppFrame: number): { ok: true } | { ok: false; error: string } {
    const capacity = this.getRotoPhysicalCapacity(layerId, trackId);
    if (!Number.isInteger(cursorAppFrame) || cursorAppFrame < 0 || cursorAppFrame >= capacity) return { ok: false, error: 'Physical cursor is outside capacity.' };
    if (selectedKeyId !== null) {
      const record = this.getRotoRealKeyRecord(layerId, trackId, selectedKeyId);
      if (!record || record.appFrame !== cursorAppFrame) return { ok: false, error: 'Physical selection does not match the cursor.' };
    }
    _getOrCreateLayerTrackMap(_rotoPhysicalSelectedKeyId, layerId).set(trackId, selectedKeyId);
    _getOrCreateLayerTrackMap(_rotoPhysicalCursorAppFrame, layerId).set(trackId, cursorAppFrame);
    return { ok: true };
  },

  setRotoPhysicalScriptMotion(layerId: string, trackId: string, value: unknown): { ok: true } | { ok: false; error: string } {
    try {
      const current = this.getRotoPhysicalDocument(layerId, trackId);
      if (!current) return { ok: false, error: 'Physical Roto layer does not exist.' };
      const next = parsePhysicPaintRotoPhysicalDocument({ ...current, scriptMotion: value });
      _getOrCreateLayerTrackMap(_rotoPhysicalScriptMotion, layerId).set(trackId, next.scriptMotion);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Invalid Script Motion settings.' };
    }
  },

  /**
   * Read all ordered canonical records for a track (46-01 track-scoped).
   * Returns a fresh array sorted by ascending physical `appFrame`, ties by
   * `keyId` localeCompare (TRK-01 ordering rule preserved per-track).
   */
  getRotoRealKeyRecords(layerId: string, trackId: string): PhysicPaintRotoRealKeyRecord[] {
    const recordMap = _rotoRealKeyRecords.get(layerId)?.get(trackId);
    if (!recordMap) return [];
    return Array.from(recordMap.values()).sort((a, b) => a.appFrame - b.appFrame || a.keyId.localeCompare(b.keyId));
  },

  getRotoGroupOverrideRecords(layerId: string, trackId: string): PhysicPaintRotoRealKeyRecord[] {
    return Array.from(_rotoGroupOverrideRecords.get(layerId)?.get(trackId)?.values() ?? [])
      .sort((a, b) => a.appFrame - b.appFrame || a.keyId.localeCompare(b.keyId));
  },

  /**
   * Read a single real-key record by stable `keyId`. Returns null when absent.
   */
  getRotoRealKeyRecord(layerId: string, trackId: string, keyId: string): PhysicPaintRotoRealKeyRecord | null {
    const record = _rotoRealKeyRecords.get(layerId)?.get(trackId)?.get(keyId)
      ?? _rotoGroupOverrideRecords.get(layerId)?.get(trackId)?.get(keyId);
    return record ?? null;
  },

  /**
   * Read a single real-key record by direct `appFrame`. Returns null when no
   * real key occupies that frame on the target track.
   */
  getRotoRealKeyRecordByAppFrame(layerId: string, trackId: string, appFrame: number): PhysicPaintRotoRealKeyRecord | null {
    const recordMap = _rotoRealKeyRecords.get(layerId)?.get(trackId);
    if (!recordMap) return null;
    for (const record of recordMap.values()) {
      if (record.appFrame === appFrame) return record;
    }
    return null;
  },

  /**
   * Read the durable linked Loop Clip collection for a track (Phase 43,
   * D-29). Returns the shared frozen empty collection when the track has no
   * physical state published.
   */
  getRotoPhysicalLoopClips(layerId: string, trackId: string): readonly PhysicPaintRotoLoopClip[] {
    return _rotoPhysicalLoopClips.get(layerId)?.get(trackId) ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY;
  },

  /** Return the complete immutable allowed-to-own incoming break collection for one track. */
  getRotoPhysicalIncomingInterpolationBreakKeyIds(layerId: string, trackId: string): readonly string[] {
    return _rotoPhysicalIncomingInterpolationBreakKeyIds.get(layerId)?.get(trackId)
      ?? PHYSIC_PAINT_ROTO_INCOMING_INTERPOLATION_BREAK_KEY_IDS_EMPTY;
  },

  /** Validate and replace the complete stable-key-owned incoming break collection for one track. */
  replaceRotoPhysicalIncomingInterpolationBreakKeyIds(
    layerId: string,
    trackId: string,
    value: unknown,
  ): { ok: true } | { ok: false; error: string } {
    if (!layerId || typeof layerId !== 'string') {
      return { ok: false, error: 'Layer ID must be a non-empty string.' };
    }
    if (!trackId || typeof trackId !== 'string') {
      return { ok: false, error: 'Track ID must be a non-empty string.' };
    }
    if (!_rotoRealKeyRecords.get(layerId)?.has(trackId)) {
      return { ok: false, error: 'Physical Roto layer does not exist.' };
    }
    let validated: readonly string[];
    try {
      validated = parsePhysicPaintRotoIncomingInterpolationBreakKeyIds(
        value,
        this.getRotoRealKeyRecords(layerId, trackId),
      );
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Invalid incoming interpolation break collection.' };
    }
    const current = this.getRotoPhysicalIncomingInterpolationBreakKeyIds(layerId, trackId);
    if (current.length === validated.length && current.every((keyId, index) => keyId === validated[index])) {
      return { ok: true };
    }
    _getOrCreateLayerTrackMap(_rotoPhysicalIncomingInterpolationBreakKeyIds, layerId).set(trackId, validated);
    rotoPhysicalRevision.value = rotoPhysicalRevision.value + 1;
    bumpTrackRevision(layerId, trackId);
    return { ok: true };
  },

  /**
   * Validate and atomically replace the complete per-track Loop Clip
   * collection (Phase 43, D-29). Records and interpolation are untouched.
   * Failure changes nothing; an accepted change publishes one visible change
   * and moves the canonical content revision (loops join the fingerprint, Q1).
   */
  replaceRotoPhysicalLoopClips(
    layerId: string,
    trackId: string,
    value: unknown,
  ): { ok: true } | { ok: false; error: string } {
    if (!layerId || typeof layerId !== 'string') {
      return { ok: false, error: 'Layer ID must be a non-empty string.' };
    }
    if (!trackId || typeof trackId !== 'string') {
      return { ok: false, error: 'Track ID must be a non-empty string.' };
    }
    if (!_rotoRealKeyRecords.get(layerId)?.has(trackId)) {
      return { ok: false, error: 'Physical Roto layer does not exist.' };
    }
    let validated: readonly PhysicPaintRotoLoopClip[];
    try {
      validated = parsePhysicPaintRotoLoopClips(value);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Invalid Loop Clip collection.' };
    }
    const nextRevision = buildPhysicPaintRotoPhysicalRevision(
      this.getRotoRealKeyRecords(layerId, trackId),
      this.getRotoPhysicalInterpolationState(layerId, trackId),
      validated,
      this.getRotoPhysicalIncomingInterpolationBreakKeyIds(layerId, trackId),
      this.getRotoGroupOverrideRecords(layerId, trackId),
    );
    if (nextRevision === this.getRotoPhysicalContentRevision(layerId, trackId)) return { ok: true };
    _getOrCreateLayerTrackMap(_rotoPhysicalLoopClips, layerId).set(trackId, validated);
    rotoPhysicalRevision.value = rotoPhysicalRevision.value + 1;
    bumpTrackRevision(layerId, trackId);
    return { ok: true };
  },

  /**
   * Read the canonical interpolation state for a track. Returns the
   * immutable disabled default when no physical state has been published.
   */
  getRotoPhysicalInterpolationState(layerId: string, trackId: string): PhysicPaintRotoInterpolationState {
    const state = _rotoPhysicalInterpolationState.get(layerId)?.get(trackId);
    return state ?? PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED;
  },

  /**
   * Set the canonical interpolation state for a track. Validates the state
   * and publishes one immutable change. Per D-02, this cannot move real keys
   * or touch Script Motion.
   */
  setRotoPhysicalInterpolationState(layerId: string, trackId: string, state: unknown): { ok: true } | { ok: false; error: string } {
    if (!isPhysicPaintRotoInterpolationState(state)) {
      return { ok: false, error: 'Interpolation state must include canonical enabled and mode fields.' };
    }
    const current = this.getRotoPhysicalInterpolationState(layerId, trackId);
    if (current.enabled === state.enabled && current.mode === state.mode) return { ok: true };
    _getOrCreateLayerTrackMap(_rotoPhysicalInterpolationState, layerId).set(trackId, Object.freeze({
      enabled: state.enabled,
      mode: state.mode,
    }) as PhysicPaintRotoInterpolationState);
    rotoPhysicalRevision.value = rotoPhysicalRevision.value + 1;
    bumpTrackRevision(layerId, trackId);
    return { ok: true };
  },

  /**
   * Read the bounded physical capacity for a track.
   */
  getRotoPhysicalCapacity(layerId: string, trackId: string): number {
    return _rotoPhysicalCapacity.get(layerId)?.get(trackId) ?? PHYSIC_PAINT_MAX_APPLY_FRAMES;
  },

  /**
   * Set the bounded physical capacity for a track. Used by the launch
   * path to fold the parent-end bound into the store so the parent authority
   * and the carried document agree on one capacity (D-25/Q4 fold).
   */
  setRotoPhysicalCapacity(layerId: string, trackId: string, capacity: number): void {
    if (!Number.isInteger(capacity) || capacity < 0) return;
    _getOrCreateLayerTrackMap(_rotoPhysicalCapacity, layerId).set(trackId, Math.min(capacity, PHYSIC_PAINT_MAX_APPLY_FRAMES));
    },

  /**
   * Read the current physical timeline projection for a track. Derives
   * ordered assignments, exact runtime generated interiors, and bounded
   * real/generated/empty physical cells from the validated record set and
   * canonical interpolation state using the shared projection seam.
   */
  getRotoPhysicalProjection(layerId: string, trackId: string): PhysicPaintRotoPhysicalTimelineProjection | null {
    const structural = _resolveRotoPhysicalStructural(layerId, trackId);
    if (!structural) return null;
    return structural.projection;
  },

  getRotoPhysicalContentRevision(layerId: string, trackId: string): string | null {
    const structural = _resolveRotoPhysicalStructural(layerId, trackId);
    if (!structural) return null;
    return structural.contentRevision;
  },

  /** regression-refresh-multi-paint Layer 2: the CONTENT token of the current
   * physical document (the accepted completion). A paint carrying an OLDER
   * content token can never overwrite the canvas after this document settles —
   * the engine's preview-base seam drops a settle whose token is below the
   * applied one. Monotonic across the session (never reset by canvas clears). */
  getContentToken(layerId: string, trackId: string): number {
    return resolveContentToken(this.getRotoPhysicalContentRevision(layerId, trackId));
  },

  /**
   * Loop-aware physical end frame (Phase 43, Pitfall 3): max of last real
   * key + 1 and every loop's effective end, read from the memoized interval
   * derivation — never by iterating virtual frames (D-32). Loop effective
   * ends are already bounded by the parent end and the capacity inside the
   * derivation (D-25/Q4 fold). No loops and no keys still returns null.
   */
  getRotoPhysicalEndFrame(layerId: string, trackId: string): number | null {
    const records = this.getRotoRealKeyRecords(layerId, trackId);
    const lastRealEnd = records.length === 0 ? null : records[records.length - 1].appFrame + 1;
    let loopEnd: number | null = null;
    const structural = _resolveRotoPhysicalStructural(layerId, trackId);
    if (structural) {
      for (const range of structural.loopResolution.ranges) {
        loopEnd = loopEnd === null ? range.effectiveEnd : Math.max(loopEnd, range.effectiveEnd);
      }
    }
    if (lastRealEnd === null && loopEnd === null) return null;
    return Math.max(lastRealEnd ?? 0, loopEnd ?? 0);
  },

  /**
   * Unresolvable Loop Clips over a half-open frame window (Phase 43, D-28
   * wiring). One compact entry per intersecting loop whose source references
   * dangle — computed from the memoized interval records' missingSourceKeyIds
   * in O(loops), with no frame materialization. The export preflight consumes
   * this to block; the block itself stays within 43-09.
   */
  getRotoPhysicalUnresolvedLoops(
    layerId: string,
    trackId: string,
    fromFrame: number,
    toFrame: number,
  ): readonly PhysicPaintRotoPhysicalUnresolvedLoop[] {
    if (!Number.isInteger(fromFrame) || !Number.isInteger(toFrame) || fromFrame < 0 || toFrame <= fromFrame) return [];
    const structural = _resolveRotoPhysicalStructural(layerId, trackId);
    if (!structural) return [];
    const unresolved: PhysicPaintRotoPhysicalUnresolvedLoop[] = [];
    for (const range of structural.loopResolution.ranges) {
      if (range.unresolved === null) continue;
      if (range.effectiveEnd <= fromFrame || range.placementStart >= toFrame) continue;
      unresolved.push({
        loopId: range.loopId,
        placementStart: range.placementStart,
        effectiveEnd: range.effectiveEnd,
        missingSourceKeyIds: range.unresolved.missingSourceKeyIds,
        ...(range.unresolved.invalidSourceTiming ? { invalidSourceTiming: true as const } : {}),
      });
    }
    return unresolved;
  },

  /**
   * Resolve one exact runtime paint source. Real and generated projection
   * cells stay the projection's authority; frames the projection reports
   * empty (or does not cover) consult the Phase 43 lazy per-frame loop query
   * (D-26/D-27): 'linked' occurrences return the SOURCE key's payload under
   * the source-scoped cache revision `${contentRevision}:real:${sourceKeyId}`
   * — one source cache entry serves every occurrence — and 'linked-unresolved'
   * surfaces as the 'loop-placeholder' variant (D-28) instead of a blank.
   */
  getRotoPhysicalRenderSource(layerId: string, trackId: string, appFrame: number): PhysicPaintRotoPhysicalRenderSource | null {
    if (!Number.isInteger(appFrame) || appFrame < 0) return null;
    const structural = _resolveRotoPhysicalStructural(layerId, trackId);
    if (!structural || !structural.projection) return null;
    const projection = structural.projection;
    const contentRevision = structural.contentRevision;
    const lifecycleTarget = classifyPhysicPaintRotoGroupFrameTarget({
      document: {
        loopClips: structural.loopClips,
        realKeyRecords: Array.from(structural.recordMap.values()),
      },
      appFrame,
    });
    switch (lifecycleTarget.kind) {
      case 'override': {
        const record = this.getRotoRealKeyRecord(layerId, trackId, lifecycleTarget.keyId);
        if (!record) return null;
        return {
          kind: 'real',
          layerId,
          appFrame,
          keyId: record.keyId,
          contentRevision,
          cacheRevision: `${contentRevision}:group-phase:${lifecycleTarget.groupId}:${record.keyId}:${lifecycleTarget.cycleOffset}`,
          renderedFrame: {
            ...record.payload,
            appFrame,
          },
        };
      }
      case 'generated-occurrence': {
        const left = this.getRotoRealKeyRecord(layerId, trackId, lifecycleTarget.leftSourceKeyId);
        const right = this.getRotoRealKeyRecord(layerId, trackId, lifecycleTarget.rightSourceKeyId);
        const interpolation = this.getRotoPhysicalInterpolationState(layerId, trackId);
        if (!left || !right || !interpolation.enabled) return null;
        const settings = { ...DEFAULT_ROTO_INTERPOLATION_SETTINGS, enabled: true, mode: interpolation.mode };
        const rendered = interpolation.mode === 'duplicate'
          ? renderDuplicateRotoInterpolationFrame(left.payload, appFrame, settings)
          : renderBlendedRotoInterpolationFrame(left.payload, right.payload, appFrame, lifecycleTarget.progress, settings);
        if (!rendered) return null;
        const renderedFrame: PhysicPaintRotoRealKeyPayload = {
          frameIndex: rendered.frameIndex,
          appFrame,
          dataUrl: rendered.dataUrl,
          ...(rendered.width !== undefined ? { width: rendered.width } : {}),
          ...(rendered.height !== undefined ? { height: rendered.height } : {}),
        };
        const group = structural.loopClips.find((candidate) => candidate.loopId === lifecycleTarget.groupId);
        if (!group) return null;
        const sourceCycleId = getPhysicsPaintRotoSourceCycleId(group.sourceKeyIds);
        return {
          kind: 'generated',
          layerId,
          appFrame,
          leftKeyId: left.keyId,
          rightKeyId: right.keyId,
          interpolationMode: interpolation.mode,
          sourceCycleId,
          cycleOffset: lifecycleTarget.cycleOffset,
          contentRevision,
          cacheRevision: `${contentRevision}:linked-generated:${interpolation.mode}:${sourceCycleId}:${left.keyId}:${right.keyId}:${lifecycleTarget.cycleOffset}`,
          renderedFrame,
        };
      }
      case 'group-gap':
      case 'ambiguous-group':
        return null;
      case 'source-occurrence':
      case 'unresolved-group':
      case 'ordinary-key':
      case 'empty':
        // Preserve Phase 43 source-key and unresolved placeholder behavior. The
        // interval resolver below remains authoritative for these cases; the
        // complete lifecycle target only intercepts exact overrides, visible
        // generated occurrences, and accepted Group gaps.
        break;
      default: {
        const exhaustive: never = lifecycleTarget;
        throw new Error(`Unhandled Roto Group frame target: ${JSON.stringify(exhaustive)}`);
      }
    }
    const cell = projection.cells[appFrame];
    if (cell && cell.appFrame === appFrame && cell.kind === 'real') {
      const record = this.getRotoRealKeyRecord(layerId, trackId, cell.keyId);
      if (!record || record.appFrame !== appFrame || record.payload.appFrame !== appFrame) return null;
      return {
        kind: 'real',
        layerId,
        appFrame,
        keyId: record.keyId,
        contentRevision,
        cacheRevision: `${contentRevision}:real:${record.keyId}`,
        renderedFrame: record.payload,
      };
    }
    if (cell && cell.appFrame === appFrame && cell.kind === 'generated') {
      const left = this.getRotoRealKeyRecord(layerId, trackId, cell.leftKeyId);
      const right = this.getRotoRealKeyRecord(layerId, trackId, cell.rightKeyId);
      if (!left || !right || !(left.appFrame < appFrame && appFrame < right.appFrame)) return null;
      const interpolation = this.getRotoPhysicalInterpolationState(layerId, trackId);
      const settings = { ...DEFAULT_ROTO_INTERPOLATION_SETTINGS, enabled: true, mode: interpolation.mode };
      const distance = right.appFrame - left.appFrame;
      const rendered = interpolation.mode === 'duplicate'
        ? renderDuplicateRotoInterpolationFrame(left.payload, appFrame, settings)
        : renderBlendedRotoInterpolationFrame(left.payload, right.payload, appFrame, (appFrame - left.appFrame) / distance, settings);
      if (!rendered) return null;
      const renderedFrame: PhysicPaintRotoRealKeyPayload = {
        frameIndex: rendered.frameIndex,
        appFrame,
        dataUrl: rendered.dataUrl,
        ...(rendered.width !== undefined ? { width: rendered.width } : {}),
        ...(rendered.height !== undefined ? { height: rendered.height } : {}),
      };
      return {
        kind: 'generated',
        layerId,
        appFrame,
        leftKeyId: left.keyId,
        rightKeyId: right.keyId,
        interpolationMode: interpolation.mode,
        contentRevision,
        cacheRevision: `${contentRevision}:generated:${interpolation.mode}:${left.keyId}:${right.keyId}:${appFrame}`,
        renderedFrame,
      };
    }
    // Empty or projection-uncovered frame: consult the lazy loop resolution.
    const resolution = resolvePhysicPaintRotoLoopFrame(structural.loopResolution, appFrame);
    switch (resolution.kind) {
      case 'real': {
        // Defensive coherence: a real key at this frame would normally have a
        // real projection cell; resolve it exactly like the real-cell branch.
        const record = this.getRotoRealKeyRecord(layerId, trackId, resolution.keyId);
        if (!record || record.appFrame !== appFrame || record.payload.appFrame !== appFrame) return null;
        return {
          kind: 'real',
          layerId,
          appFrame,
          keyId: record.keyId,
          contentRevision,
          cacheRevision: `${contentRevision}:real:${record.keyId}`,
          renderedFrame: record.payload,
        };
      }
      case 'linked': {
        const record = this.getRotoRealKeyRecord(layerId, trackId, resolution.sourceKeyId);
        // Derivation proved resolvability; a missing record here would mean
        // the identities and the record map diverged — fail closed to null.
        if (!record) return null;
        return {
          kind: 'real',
          layerId,
          appFrame,
          keyId: record.keyId,
          contentRevision,
          cacheRevision: `${contentRevision}:real:${record.keyId}`,
          renderedFrame: record.payload,
        };
      }
      case 'linked-generated': {
        const left = this.getRotoRealKeyRecord(layerId, trackId, resolution.leftSourceKeyId);
        const right = this.getRotoRealKeyRecord(layerId, trackId, resolution.rightSourceKeyId);
        if (!left || !right) return null;
        const interpolation = this.getRotoPhysicalInterpolationState(layerId, trackId);
        if (!interpolation.enabled) return null;
        const settings = { ...DEFAULT_ROTO_INTERPOLATION_SETTINGS, enabled: true, mode: interpolation.mode };
        const rendered = interpolation.mode === 'duplicate'
          ? renderDuplicateRotoInterpolationFrame(left.payload, appFrame, settings)
          : renderBlendedRotoInterpolationFrame(left.payload, right.payload, appFrame, resolution.progress, settings);
        if (!rendered) return null;
        const renderedFrame: PhysicPaintRotoRealKeyPayload = {
          frameIndex: rendered.frameIndex,
          appFrame,
          dataUrl: rendered.dataUrl,
          ...(rendered.width !== undefined ? { width: rendered.width } : {}),
          ...(rendered.height !== undefined ? { height: rendered.height } : {}),
        };
        return {
          kind: 'generated',
          layerId,
          appFrame,
          leftKeyId: left.keyId,
          rightKeyId: right.keyId,
          interpolationMode: interpolation.mode,
          sourceCycleId: resolution.sourceCycleId,
          cycleOffset: resolution.cycleOffset,
          contentRevision,
          // Cycle-local identity: equivalent source cycles share generated
          // cache entries across repeat destinations and Loop Clip instances,
          // while distinct ordered cycles cannot collide on one adjacent pair.
          cacheRevision: `${contentRevision}:linked-generated:${interpolation.mode}:${resolution.sourceCycleId}:${left.keyId}:${right.keyId}:${resolution.cycleOffset}`,
          renderedFrame,
        };
      }
      case 'linked-gap':
        return null;
      case 'linked-unresolved':
        // D-28 (43-09): the typed unresolved per-frame result surfaces as the
        // 'loop-placeholder' render-source variant — a marked, visible
        // placeholder in preview/playback, a blocked range in export, never a
        // blank and never Paint content.
        return {
          kind: 'loop-placeholder',
          layerId,
          appFrame,
          loopId: resolution.loopId,
          placementStart: resolution.placementStart,
          sourceKeyIds: resolution.sourceKeyIds,
          missingSourceKeyIds: resolution.missingSourceKeyIds,
        };
      case 'empty':
        return null;
      default: {
        const exhaustive: never = resolution;
        throw new Error(`Unhandled Roto frame resolution kind: ${JSON.stringify(exhaustive)}`);
      }
    }
  },

  /** Publish live pixels only when the stable key and source content revision still match (46-01 track-scoped). */
  updateRotoPhysicalRealKeyPayload(
    layerId: string,
    trackId: string,
    keyId: string,
    expectedContentRevision: string,
    payload: PhysicPaintRotoRealKeyPayload,
    diagnostics?: { mutationId?: number; record: (sample: PhysicsPaintPerformanceSample) => void },
    leaseToken?: PhysicPaintRotoPhysicalOperationLeaseToken,
  ): { ok: true; changed: boolean; contentRevision: string } | { ok: false; error: string } {
    const leaseValidation = _validateRotoPhysicalLayerPublication(layerId, leaseToken);
    if (!leaseValidation.ok) return { ok: false, error: leaseValidation.reason };
    const currentRevision = this.getRotoPhysicalContentRevision(layerId, trackId);
    const current = _rotoRealKeyRecords.get(layerId)?.get(trackId)?.get(keyId) ?? null;
    const reject = (error: string): { ok: false; error: string } => {
      _pruneUnreferencedRotoAlphaCanvases([payload.dataUrl]);
      return { ok: false, error };
    };
    if (!currentRevision || currentRevision !== expectedContentRevision || !current) return reject('Physical identity or content revision changed.');
    if (payload.appFrame !== current.appFrame) return reject('Rendered payload does not match the current physical placement.');
    const records = this.getRotoRealKeyRecords(layerId, trackId);
    let validated: readonly PhysicPaintRotoRealKeyRecord[];
    try {
      validated = parsePhysicPaintRotoRealKeyRecordCollection(records.map((record) => record.keyId === keyId ? { ...record, payload } : record), this.getRotoPhysicalCapacity(layerId, trackId));
    } catch (error) {
      return reject(error instanceof Error ? error.message : 'Invalid physical render payload.');
    }
    const nextRevision = buildPhysicPaintRotoPhysicalRevision(
      validated,
      this.getRotoPhysicalInterpolationState(layerId, trackId),
      this.getRotoPhysicalLoopClips(layerId, trackId),
      this.getRotoPhysicalIncomingInterpolationBreakKeyIds(layerId, trackId),
      this.getRotoGroupOverrideRecords(layerId, trackId),
    );
    if (nextRevision === currentRevision) return { ok: true, changed: false, contentRevision: currentRevision };
    _getOrCreateLayerTrackMap(_rotoRealKeyRecords, layerId).set(trackId, new Map(validated.map((record) => [record.keyId, record])));
    _rotoPhysicalStructuralCache.delete(_rotoPhysicalStructuralCacheKey(layerId, trackId));
    _pruneUnreferencedRotoAlphaCanvases([current.payload.dataUrl]);
    rotoPhysicalRevision.value = rotoPhysicalRevision.value + 1;
    bumpTrackRevision(layerId, trackId, diagnostics);
    return { ok: true, changed: true, contentRevision: nextRevision };
  },

  /**
   * Clear the physical record ownership for a track. Used during track
   * replacement/disposal.
   */
  clearRotoPhysicalRecords(layerId: string, trackId: string): void {
    const previousPayloadDataUrls = _getTrackDataUrls(layerId, trackId);
    _rotoRealKeyRecords.get(layerId)?.delete(trackId);
    _rotoGroupOverrideRecords.get(layerId)?.delete(trackId);
    _rotoPhysicalInterpolationState.get(layerId)?.delete(trackId);
    _rotoPhysicalScriptMotion.get(layerId)?.delete(trackId);
    _rotoPhysicalLoopClips.get(layerId)?.delete(trackId);
    _rotoPhysicalIncomingInterpolationBreakKeyIds.get(layerId)?.delete(trackId);
    _rotoPhysicalSelectedKeyId.get(layerId)?.delete(trackId);
    _rotoPhysicalCursorAppFrame.get(layerId)?.delete(trackId);
    _rotoPhysicalCapacity.get(layerId)?.delete(trackId);
    _rotoPhysicalStructuralCache.delete(_rotoPhysicalStructuralCacheKey(layerId, trackId));
    _pruneUnreferencedRotoAlphaCanvases(previousPayloadDataUrls);
  },
};
