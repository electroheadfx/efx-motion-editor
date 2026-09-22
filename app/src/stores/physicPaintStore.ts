import { signal, type ReadonlySignal, type Signal } from '@preact/signals';
import type { PhysicPaintApplyPayload, PhysicPaintApplyResult, PhysicPaintRenderedFrame, PhysicPaintRotoBackgroundMetadata, PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings, PhysicPaintRotoPlaybackSettings } from '../types/physicPaint';
import { PHYSIC_PAINT_MAX_APPLY_FRAMES, buildFrameBytesToken, isPhysicPaintApplyPayload, isPhysicPaintRotoInterpolationSettings, isPhysicPaintRotoPlaybackSettings, type PhysicPaintRotoSegmentSpacingOverride } from '../types/physicPaint';
import { rotoAlphaCanvasRegistry, canvasToPngBytes } from '../lib/rotoAlphaCanvasRegistry';
import { sha256HexBytes } from '../lib/webpBytes';
import { decodeWebpFrame, encodeCanvasAsWebp } from '../lib/webpFrameCodec';
import { frameLru } from '../lib/frameLru';
// 52.2-09 Task 3 (D-13): the READ leg of the package media pair. The resolver
// takes the LRU, the injected decode and the package root as parameters, so the
// store keeps ownership of the LRU budget and the two-format sniff.
import {
  resolveFrameMediaBitmap,
  resolveFrameMediaBytes,
  type FrameMediaRefusalReason,
} from '../lib/efxPaintMediaRead';
// debug studio-reopen-empty-boot: the launch-door materialization shares the
// open leg's payload re-carrier (buildBytesPayload) and its failure shape, so
// one law covers both readers of a persisted reference.
import {
  buildBytesPayload,
  type FrameMediaMaterializeFailure,
} from '../lib/efxPaintMediaMaterialize';
import type { FrameMediaReference } from '../lib/efxPaintPackage';
import { getExpandedRotoRealKeyFrames } from '../components/physic-paint/roto/physicsPaintRotoWorkflow';
import { drawMissingRotoBackground, resolveMissingRotoFrameDraw, type MissingRotoFrameBackgroundState, type MissingRotoFrameDrawInstruction } from '../lib/rotoFrameDraw';
import { getProjectPaperCanvas, isProjectPaperTextureResolved, subscribeProjectPaperTextureResolve } from '../lib/projectPaperRaster';
import { recordPhysicsPaintDecodeSample, recordPhysicsPaintPerformance, recordPhysicsPaintPerformanceCounter, type PhysicsPaintPerformanceSample } from '../components/physic-paint/performance/physicsPaintPerformanceTrace';
// 48-03 (D-11/CMP-01): the flattened compositor delivery. The store imports the
// pure compositor layer (efx-paint/compositor — no Preact/DOM/store) and the
// efxPaintStore document registry. The efxPaintStore ↔ physicPaintStore import
// cycle is safe: efxPaintStore references physicPaintStore ONLY inside function
// bodies (never in its module body), so no TDZ `let` is written mid-evaluation.
import { getDocument as getEfxPaintDocument } from './efxPaintStore';
// 49-02 Task 3 (BKG-09): the reopen-path hydration resolves each background
// clip source ref to its library asset URL (efxasset://) and decodes bytes.
// imageStore imports only ipc + types — no cycle with this store.
import { imageStore } from './imageStore';
import { assetUrl } from '../lib/ipc';
import {
  blendModeToCompositeOp,
  compositeFrame,
  type EfxPaintCompositorPorts,
  type EfxPaintMissingSourceEntry,
  type EfxPaintTrackContentResolution,
} from '../efx-paint/compositor/efxPaintCompositor';
import {
  createKeyedMemo,
  deriveEfxPaintFlattenedCacheKey,
  deriveEfxPaintTrackContentKey,
  type EfxPaintKeyedMemo,
} from '../efx-paint/compositor/efxPaintCompositeCache';
import {
  deriveEfxPaintBackgroundResolution,
  resolveEfxPaintBackgroundFrame,
} from '../efx-paint/compositor/efxPaintBackgroundResolution';
import { backgroundParticipates, participatingPaintTracks } from '../efx-paint/compositor/efxPaintHideSolo';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { MceImageRef } from '../types/project';
import {
  PHYSIC_PAINT_ROTO_INCOMING_INTERPOLATION_BREAK_KEY_IDS_EMPTY,
  PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED,
  PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
  PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO,
  buildPhysicPaintRotoPayloadContentToken,
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
import type { RailSetIdentity } from '../components/physic-paint/roto/physicsPaintRotoRailSetSelection';
import {
  buildRotoRailSetCopyPayload,
  proposeRails,
  type RotoRailSetCopyPayload,
  type RotoRailSetPasteFailureReason,
  type RotoRailSetPasteImpact,
} from '../components/physic-paint/roto/physicsPaintRotoRailSetCopy';
import { deriveKeyRailSegments } from '../components/physic-paint/view/physicsPaintKeyRailPresentation';
import { renderRotoRevealFrames } from '../components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer';
import type { RotoPaintScript } from '../components/physic-paint/roto/physicsPaintRotoScriptClipboard';
import { createPhysicPaintRotoKeyId, requirePhysicPaintRotoInlineBytes } from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
// 52.2-06 (D-06/D-07): the persist seam's media projection. Both roto
// collections are projected through the same pure functions — the store does
// not learn which collection a record came from.
import {
  PhysicPaintRotoMediaProjectionError,
  toPersistedRotoRecords,
  toRuntimeRotoRecords,
  type PhysicPaintRotoMediaReferenceResolver,
} from '../components/physic-paint/roto/physicsPaintRotoMediaProjection';
import { getPhysicsPaintWorkingSize } from '../components/physic-paint/engine/physicsPaintCanvasSizing';

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

/**
 * Mount a track's runtime baseline (46-01 TRK-03 Task 3): seeds every
 * per-track runtime map with the track's empty baseline and ensures the
 * per-track revision entry exists at 0. Deletion and authority plans call
 * this when a track enters the document. It never bumps revisions and never
 * fires the dirty callback. Background metadata, playback settings, and
 * interpolation failure status stay absent (their getters fall back to
 * null / absent semantics).
 */
export function mountTrackRuntime(layerId: string, trackId: string): void {
  if (!layerId || !trackId) return;
  const frames = _getOrCreateLayerTrackMap(_frames, layerId);
  if (!frames.has(trackId)) frames.set(trackId, new Map());
  const cache = _getOrCreateLayerTrackMap(_rotoCacheMetadata, layerId);
  if (!cache.has(trackId)) cache.set(trackId, new Map());
  const generatedCache = _getOrCreateLayerTrackMap(_rotoGeneratedCacheMetadata, layerId);
  if (!generatedCache.has(trackId)) generatedCache.set(trackId, new Map());
  const records = _getOrCreateLayerTrackMap(_rotoRealKeyRecords, layerId);
  if (!records.has(trackId)) records.set(trackId, new Map());
  const groupOverrides = _getOrCreateLayerTrackMap(_rotoGroupOverrideRecords, layerId);
  if (!groupOverrides.has(trackId)) groupOverrides.set(trackId, new Map());
  _getOrCreateLayerTrackMap(_rotoInterpolationSettings, layerId).set(trackId, { ...DEFAULT_ROTO_INTERPOLATION_SETTINGS });
  _getOrCreateLayerTrackMap(_rotoPhysicalInterpolationState, layerId).set(trackId, PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED);
  _getOrCreateLayerTrackMap(_rotoPhysicalScriptMotion, layerId).set(trackId, PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO);
  _getOrCreateLayerTrackMap(_rotoPhysicalSelectedKeyId, layerId).set(trackId, null);
  _getOrCreateLayerTrackMap(_rotoPhysicalCursorAppFrame, layerId).set(trackId, 0);
  _getOrCreateLayerTrackMap(_rotoPhysicalCapacity, layerId).set(trackId, PHYSIC_PAINT_MAX_APPLY_FRAMES);
  _getOrCreateLayerTrackMap(_rotoPhysicalLoopClips, layerId).set(trackId, PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY);
  _getOrCreateLayerTrackMap(_rotoPhysicalIncomingInterpolationBreakKeyIds, layerId).set(trackId, Object.freeze([]));
  _getOrCreateTrackRevisions(trackId);
}

/**
 * Tear down one track's complete runtime state (46-01 TRK-03 Task 3):
 * deletes every per-track map entry (including selection/cursor), prunes
 * alpha canvases no other track still references, deletes the structural
 * memo composite key, deletes the trackRevisions entry, and settles the
 * track's operation leases with the established settle pattern. Returns
 * true only when something changed; a never-mounted track is a no-op.
 */
export function removeTrackRuntime(layerId: string, trackId: string): boolean {
  if (!layerId || !trackId) return false;
  let changed = false;
  const tokens = _getTrackBytesTokens(layerId, trackId);
  for (const map of [
    _frames,
    _rotoBackgroundMetadata,
    _rotoCacheMetadata,
    _rotoGeneratedCacheMetadata,
    _rotoInterpolationSettings,
    _rotoInterpolationFailureStatus,
    _rotoRealKeyRecords,
    _rotoGroupOverrideRecords,
    _rotoPhysicalInterpolationState,
    _rotoPhysicalScriptMotion,
    _rotoPhysicalSelectedKeyId,
    _rotoPhysicalCursorAppFrame,
    _rotoPhysicalCapacity,
    _rotoPhysicalLoopClips,
    _rotoPhysicalIncomingInterpolationBreakKeyIds,
    _rotoPlaybackSettings,
  ]) {
    const layerTracks = map.get(layerId);
    if (!layerTracks) continue;
    if (layerTracks.delete(trackId)) changed = true;
    if (layerTracks.size === 0) map.delete(layerId);
  }
  changed = _rotoPhysicalStructuralCache.delete(_rotoPhysicalStructuralCacheKey(layerId, trackId)) || changed;
  changed = trackRevisions.delete(trackId) || changed;
  let settledTrackLease = false;
  for (const [scope, lease] of _rotoPhysicalOperationLeases) {
    if (lease.layerId !== layerId || lease.trackId !== trackId) continue;
    _rotoPhysicalOperationLeases.delete(scope);
    _settledRotoPhysicalOperationLeases.add(_rotoPhysicalOperationLeaseIdentity(lease));
    settledTrackLease = true;
  }
  if (settledTrackLease) {
    changed = true;
    _notifyRotoPhysicalOperationLeaseChange();
  }
  for (const token of tokens) {
    if (!_isBytesTokenReferenced(token)) changed = rotoAlphaCanvasRegistry.delete(token) || changed;
  }
  return changed;
}

/**
 * Sever every surviving track's Hold Loop Clip that references the deleted
 * track's keyIds (46-05 TRK-07 D-16 / T-46-14). Returns the number of Hold
 * clips severed. The clip records keep their sourceKeyIds verbatim — the
 * canonical clip guard rejects the empty-refs form, and dangling refs are
 * legal and repairable (D-31); the resolver's 'linked-unresolved' path is
 * the only answer the severed cells can produce (D-13 fail-closed). The
 * affected tracks' loop-clip arrays are replaced (identity change) so their
 * structural memo recomputes the loop ranges against the post-delete world.
 * Must run BEFORE the deleted track's records are torn down (it reads the
 * deleted track's keyIds to know what to sever).
 */
export function severTrackHoldReferences(layerId: string, deletedTrackId: string): number {
  const deletedKeyIds = new Set(_rotoRealKeyRecords.get(layerId)?.get(deletedTrackId)?.keys() ?? []);
  if (deletedKeyIds.size === 0) return 0;
  const loopClipTracks = _rotoPhysicalLoopClips.get(layerId);
  if (!loopClipTracks) return 0;
  let severed = 0;
  for (const [trackId, clips] of loopClipTracks) {
    if (trackId === deletedTrackId) continue;
    const affected = clips.some((clip) => clip.sourceKeyIds.some((keyId) => deletedKeyIds.has(keyId)));
    if (!affected) continue;
    severed += 1;
    loopClipTracks.set(trackId, clips.map((clip) => ({ ...clip })));
    _rotoPhysicalStructuralCache.delete(_rotoPhysicalStructuralCacheKey(layerId, trackId));
  }
  return severed;
}

export type PhysicPaintRotoPhysicalOperationLeaseOwner = 'exclusive' | 'recovery';

export interface PhysicPaintRotoPhysicalOperationLeaseToken {
  readonly projectContextId: string;
  readonly layerId: string;
  /** 46-01 TRK-03: stable UUID of the internal track this lease guards (never an array index). */
  readonly trackId: string;
  readonly generation: number;
  readonly owner: PhysicPaintRotoPhysicalOperationLeaseOwner;
}

export interface PhysicPaintRotoPhysicalRecoveryLeaseDescriptor {
  readonly projectContextId: string;
  readonly layerId: string;
  /** 46-01 TRK-03: the guarded track identity, captured with the original lease. */
  readonly trackId: string;
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
 * 260911-s1j follow-up: Frame blending is retired from the product surface
 * until the engine's blended-frame slowdown work lands. Every physical
 * interpolation state entering the store is coerced to Frame duplicate here
 * — the map can never hold blend, so every read (render paths, UI,
 * persistence, revision and memo identity checks) observes one coherent
 * mode. The canonical model and the blended renderer keep the mode type
 * intact for the later re-introduction.
 */
function _retireFrameBlendingMode(state: PhysicPaintRotoInterpolationState): PhysicPaintRotoInterpolationState {
  if (state.mode !== 'blend') return state;
  return Object.freeze({ enabled: state.enabled, mode: 'duplicate' });
}

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
 * One track's runtime state projected into the v1.0 document shape (Phase
 * 45-04 Task 2, 46-02 trackId). `trackId` is the stable document identity the
 * payload belongs to; `rotoPhysical` is null when the track has no physical
 * Roto state; frames are the runtime rendered frames keyed by application
 * frame.
 */
export interface EfxPaintRuntimeProjection {
  readonly trackId: string;
  readonly frames: ReadonlyMap<number, PhysicPaintRenderedFrame>;
  readonly rotoPhysical: PhysicPaintRotoPhysicalDocument | null;
}

// 52.1 (D-06): the Roto alpha-canvas registry lives in a leaf module
// (lib/rotoAlphaCanvasRegistry.ts) so rotoCanvasFrames.ts can register/query
// canvases without importing this store (which imports the reveal renderer,
// which imports rotoCanvasFrames.ts — a module-body cycle).
export { registerRotoAlphaCanvasFrame, hasRotoAlphaCanvasFrame } from '../lib/rotoAlphaCanvasRegistry';

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

// 52.1 lever 1: read-path cache for generated (blend/duplicate) frames, keyed
// by the cacheRevision string (which embeds contentRevision — the freshness
// signal, so a stale entry is never served). Populated on-demand in
// getRotoPhysicalRenderSource; cleared on store reset. Holds raw bytes (never
// canvases/dataURLs); byte-budgeted with FIFO eviction so a long edit session
// cannot grow it unbounded.
const _generatedRenderSourceCache = new Map<string, PhysicPaintRenderedFrame>();
let _generatedRenderSourceCacheBytes = 0;
const GENERATED_RENDER_SOURCE_CACHE_BYTE_CEILING = 64 * 1024 * 1024;
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

// --- 48-03 flattened compositor delivery (D-11 / CMP-01) -------------------
// The store owns the production ports compositeFrame consumes (D-08/CMP-04
// memoization, D-07 per-track raster memos, D-10 content precedence, D-03
// background adapter, 48-04 source-image decode) plus the size authority.
// Open Question 1 resolution: the parent project canvas dims are injected via
// `_setPhysicPaintCompositorSizeProvider` (wired from projectStore) because the
// store cannot import projectStore without an ESM module-body cycle; the
// fallback is the 1920×1080 project default.
const FALLBACK_COMPOSITE_SIZE = Object.freeze({ width: 1920, height: 1080 });
let _compositorSizeProvider: (() => { width: number; height: number }) | null = null;
export function _setPhysicPaintCompositorSizeProvider(cb: (() => { width: number; height: number }) | null): void {
  _compositorSizeProvider = cb;
}

/**
 * 52.2-09 Task 3 (D-13): the package root the media read leg resolves a
 * persisted `frames/<layerId>/<keyId>.webp` reference against. Injected from
 * projectStore (the opened package's own directory) on the
 * `_setPhysicPaintCompositorSizeProvider` pattern, because the store cannot
 * import projectStore without an ESM module-body cycle. Null means "no package
 * root this session" — a media reference then resolves to nothing.
 */
let _packageDirProvider: (() => string | null) | null = null;
export function _setPhysicPaintPackageDirProvider(cb: (() => string | null) | null): void {
  _packageDirProvider = cb;
}

/** Per-layer flattened memo (D-08/CMP-04) + per-track raster memo (D-07). */
const _flattenedMemo = new Map<string, EfxPaintKeyedMemo<string, EfxPaintFlattenedFrameRecord>>();
const _trackRasterMemo = new Map<string, EfxPaintKeyedMemo<string, EfxPaintTrackContentResolution>>();

/** In-flight decode guard (D-12): prevents duplicate decode kicks for the same bytes token. */
const _compositorDecodeLoading = new Set<string>();
/** In-flight decode promises (52.1-05 D-13): lets the export preload await completion. */
const _compositorDecodePromises = new Map<string, Promise<ImageBitmap | null>>();

/**
 * 52.2-09 Task 3 (D-13, T-52.2-29/32): the terminal NON-bitmap outcome recorded
 * for one persisted media digest — a resolved bitmap lives in the frame LRU, so
 * only the failures need a verdict. Recording them keeps a missing or refused
 * read from being re-issued on every compositor tick, and makes a refusal
 * (corrupt file) observable instead of silent. Guarded by digest, so a tampered
 * file can never be served from a previous frame's bitmap.
 */
export type FrameMediaVerdict = 'missing' | FrameMediaRefusalReason;
const _frameMediaVerdicts = new Map<string, FrameMediaVerdict>();
/** In-flight media reads, keyed by digest — the duplicate-kick guard. */
const _frameMediaResolutionPromises = new Map<string, Promise<void>>();
export function getFrameMediaVerdict(digest: string): FrameMediaVerdict | null {
  return _frameMediaVerdicts.get(digest) ?? null;
}

/**
 * 52.2-10 (D-12, T-52.2-33/34): the receiver's bridged-raster store — the
 * landing half of the bridge's digest-keyed byte channel. The 52.2-09 read leg
 * answers the SAME question (`hasFrameMediaBytes`) from the frame LRU; this map
 * is what makes that answer true for a raster that arrived over the bridge
 * instead of from a package file, with no decode and no file read. Bytes are
 * kept UNDECODED here and move into the LRU only when the compositor seam
 * actually needs the frame — a bridged raster never pays a decode it may never
 * display, and one decode serves every key that references the digest.
 */
const _frameMediaBytes = new Map<string, Uint8Array>();

export type FrameMediaInstallResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; reason: FrameMediaRefusalReason }>;

/**
 * Does the receiver already hold this digest? Answered from the LRU and the
 * bridged-bytes map only — never a decode, never a file read (T-52.2-35: this
 * answer is what keeps a retry storm from re-pulling the document).
 */
export function hasFrameMediaBytes(digest: string): boolean {
  return frameLru.has(digest) || _frameMediaBytes.has(digest);
}

/**
 * Install bridged raster bytes under their content digest. `expectedDigest`
 * claims the content; the digest is recomputed from the bytes and a mismatch
 * is refused and recorded, never applied (T-52.2-33/34 — the digest is the
 * identity AND the verification, same law as the disk read path). On a match
 * the bytes supersede any earlier verdict for that digest, and the flattened
 * memo is cleared + the version clock bumped so a frame waiting on this
 * reference re-renders (the registerBackgroundSourceImage arrival idiom).
 */
export async function installFrameMediaBytes(
  bytes: Uint8Array,
  expectedDigest?: string,
): Promise<FrameMediaInstallResult> {
  const digest = await sha256HexBytes(bytes);
  if (expectedDigest !== undefined && expectedDigest !== digest) {
    // The claimed digest is what identified this entry; record the refusal
    // against the CLAIM so the seam answers missing for it without a read,
    // and never store the tampered bytes under any key.
    _frameMediaVerdicts.set(expectedDigest, 'digest-mismatch');
    return { ok: false, reason: 'digest-mismatch' };
  }
  _frameMediaVerdicts.delete(digest);
  _frameMediaBytes.set(digest, bytes);
  _flattenedMemo.clear();
  physicPaintVersion.value++;
  return { ok: true };
}

/**
 * Background sourceRef → dataUrl registry (48-04 port wiring; Phase 49's import
 * UI is the production writer). Registering bytes for a previously-missing ref
 * clears the flattened memo (T-48-07) — the flattened key's clip terms don't
 * cover runtime bytes, so a stale record must not survive a bytes arrival.
 */
const _backgroundSourceImages = new Map<string, Uint8Array>();
const _backgroundSourceImageUrls = new Map<string, string>();
export function registerBackgroundSourceImage(sourceRef: string, bytes: Uint8Array): void {
  const existing = _backgroundSourceImages.get(sourceRef);
  if (existing && buildFrameBytesToken(existing) === buildFrameBytesToken(bytes)) return;
  _backgroundSourceImages.set(sourceRef, bytes);
  _flattenedMemo.clear();
  // 49-06 (UAT round 2): the async hydration (import/reopen) registers bytes
  // AFTER the document mutation already bumped efxPaintVersion — without a
  // clock bump here the monitor never re-runs and the freshly registered clip
  // stays invisible (the _compositorDecode onload/onerror bump idiom, MEMORY:
  // always bump AND subscribe). The memo clear alone is not enough — the
  // flattened key's clip terms don't cover runtime bytes, so a stale record
  // would survive without it, but the re-render needs the version clock.
  physicPaintVersion.value++;
}

/**
 * Photo/reference sourceRef → dataUrl registry (50-02 Task 2). A PARALLEL map
 * to `_backgroundSourceImages` — the reference's fail-closed resolution stays
 * independent of the Background clip lifecycle (RESEARCH Open Question 2).
 * Registering bytes bumps the physicPaintVersion clock (so the ghost overlay
 * re-renders when bytes arrive) but does NOT clear the flattened memo: the
 * reference never enters the flattened path (D-06), so a reference bytes
 * arrival must not invalidate the flattened composite.
 */
const _referenceSourceImages = new Map<string, Uint8Array>();
export function registerReferenceSourceImage(sourceRef: string, bytes: Uint8Array): void {
  const existing = _referenceSourceImages.get(sourceRef);
  if (existing && buildFrameBytesToken(existing) === buildFrameBytesToken(bytes)) return;
  _referenceSourceImages.set(sourceRef, bytes);
  physicPaintVersion.value++;
}

/**
 * 49-02 Task 3 (BKG-09, Pitfall 5): the reopen-path source-byte hydration.
 *
 * The hydration step is the SOLE production writer of the runtime source
 * registry on document register/hydrate — without it every reopened clip
 * reports Source missing. It enumerates `document.background.clips[].sourceFrameRefs`,
 * dedupes across clips, resolves each ref to its library asset URL, decodes
 * bytes, and calls `registerBackgroundSourceImage(sourceRef, dataUrl)`.
 *
 * The ports are injectable so the contract tests drive a fake decoder; the
 * production caller (`hydrateBackgroundSourceImagesFromLibrary`) supplies the
 * real imageStore/efxasset/fetch ports. Unknown asset ids resolve to null and
 * are skipped — the knownSources-miss path reports them (D-10 fail-closed).
 * Registration is runtime-only: it never touches documentRevision, the undo
 * ledger, or the dirty callback (SAVE DEDUP). The step is asynchronous
 * byte-warming after registration — document registration stays synchronous;
 * pending decodes resolve conservatively and re-render on decode-complete.
 */
export interface BackgroundSourceHydrationPorts {
  /**
   * Resolve a library asset id to its candidate efxasset:// URLs, in priority
   * order. The hydration tries each until one decodes — a freshly imported
   * image can resolve through the child realm's imageStore (project_path) OR
   * the picker's library list (projectDir/relative_path), and either may be
   * the servable one (49-06 UAT round 9: the Bg-picker import rendered only
   * after the main-Studio import, because the two resolvers produced
   * different URLs and only the fallback decoded). Empty = absent.
   */
  resolveAssetUrls: (sourceRef: string) => readonly string[];
  /** Fetch + decode the asset URL into raw bytes, or null on failure. */
  decodeBytes: (url: string) => Promise<Uint8Array | null>;
  /** Register decoded bytes for a source ref (the existing registerBackgroundSourceImage). */
  register: (sourceRef: string, bytes: Uint8Array) => void;
}

/** Per-ref hydration outcome — the diagnostic the import path surfaces when a
 *  clip's source bytes never reach the runtime registry (49-06 UAT round 4). */
export interface BackgroundSourceHydrationResult {
  readonly registered: readonly string[];
  readonly missing: readonly { readonly ref: string; readonly reason: 'asset-not-found' | 'decode-failed' }[];
}

export async function hydrateBackgroundSourceImages(
  document: EfxPaintDocument,
  ports: BackgroundSourceHydrationPorts,
): Promise<BackgroundSourceHydrationResult> {
  const distinctRefs = new Set<string>();
  for (const clip of document.background.clips) {
    for (const ref of clip.sourceFrameRefs) distinctRefs.add(ref);
  }
  const registered: string[] = [];
  const missing: { ref: string; reason: 'asset-not-found' | 'decode-failed' }[] = [];
  await Promise.all(Array.from(distinctRefs).map(async (ref) => {
    const urls = ports.resolveAssetUrls(ref);
    if (urls.length === 0) {
      missing.push({ ref, reason: 'asset-not-found' });
      return;
    }
    // Try each candidate URL in priority order — the first that decodes wins.
    // A freshly imported image can resolve through the imageStore OR the
    // picker fallback, and only one of the two URLs may be servable.
    for (const url of urls) {
      const bytes = await ports.decodeBytes(url);
      if (bytes !== null) {
        ports.register(ref, bytes);
        registered.push(ref);
        return;
      }
    }
    missing.push({ ref, reason: 'decode-failed' });
  }));
  return { registered, missing };
}

/**
 * Decode efxasset:// bytes to a dataUrl; null on any failure (T-49-02-04).
 *
 * 49-06 (UAT round 2): the `<img>` loader is the PROVEN efxasset:// path in the
 * child webview — the picker grid and the imageStore display both load
 * `assetUrl(...)` through `<img src>`, while `fetch` on a custom scheme is not
 * guaranteed in every WebKit build (the clip stayed invisible: the hydration
 * silently skipped every ref). Load through an Image and rasterize to a dataUrl
 * (PNG) so the compositor's `_compositorDecode` decodes the same way.
 *
 * 49-06 (UAT round 3): the image MUST be fetched with `crossOrigin='anonymous'`
 * — the efxasset:// origin is cross-origin to the page, so without CORS
 * approval the canvas rasterization is tainted and `toDataURL()` throws (the
 * catch resolves null and the hydration skips the ref). The Rust protocol
 * handler answers every request with `Access-Control-Allow-Origin: *`, so the
 * anonymous fetch is approved.
 */
/** Hidden host for the decode <img> — the picker grid's PROVEN efxasset:// path
 *  is a DOM-attached <img>; a detached `new Image()` may not load a custom
 *  scheme in every WKWebView build (49-06 UAT round 4). */
let _decodeHost: HTMLDivElement | null = null;
function _ensureDecodeHost(): HTMLDivElement {
  if (!_decodeHost) {
    _decodeHost = document.createElement('div');
    _decodeHost.style.display = 'none';
    document.body.appendChild(_decodeHost);
  }
  return _decodeHost;
}

function _decodeEfxAssetBytes(url: string): Promise<Uint8Array | null> {
  return new Promise<Uint8Array | null>((resolve) => {
    const image = new Image();
    // 49-06 (UAT round 3): the efxasset:// origin differs from the page origin,
    // so a canvas rasterization of the loaded image is TAINTED unless the image
    // is fetched with CORS approval — without this, canvas.toDataURL() throws a
    // SecurityError that the catch below swallows and the hydration silently
    // skips every ref (the clip stayed invisible: always paper fond). The Rust
    // protocol handler sends Access-Control-Allow-Origin: * on every response,
    // so the anonymous fetch is approved. Display-only <img> (the picker grid)
    // never needs this — which is why the user could select images while the
    // clip never rendered.
    image.crossOrigin = 'anonymous';
    image.onload = async () => {
      try {
        // 49-06 (UAT round 5): cap the rasterization at 2048px on the longest
        // side — a full-res import rasterized at native size produces a
        // multi-MB dataUrl that can stall the compositor's decode (the clip
        // stayed paper fond while the decode never completed). The background
        // is drawn scaled to the composite size anyway, so the cap costs no
        // visible quality.
        const longest = Math.max(image.naturalWidth, image.naturalHeight);
        if (longest === 0) {
          resolve(null);
          return;
        }
        const scale = Math.min(1, 2048 / longest);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(await encodeCanvasAsWebp(canvas));
      } catch {
        resolve(null);
      } finally {
        image.remove();
      }
    };
    image.onerror = () => {
      image.remove();
      resolve(null);
    };
    image.src = url;
    _ensureDecodeHost().appendChild(image);
  });
}

/**
 * Production ports: library asset id → efxasset:// URL → decoded bytes →
 * registry. `fallback` (49-06 UAT round 3) lets the import path resolve refs
 * from the picker's OWN image list when the Studio realm's imageStore misses
 * them — the launch-time library load can fail (main-webview listener not yet
 * ready) while the picker's later request succeeds, and a freshly imported
 * image is only in the picker's merged list until the next launch. The
 * imageStore stays the primary resolver; the picker list is the fallback.
 */
export function hydrateBackgroundSourceImagesFromLibrary(
  document: EfxPaintDocument,
  fallback?: { images: readonly MceImageRef[]; projectDir: string },
): Promise<BackgroundSourceHydrationResult> {
  return hydrateBackgroundSourceImages(document, {
    // 49-06 (UAT round 9): BOTH candidate URLs, in priority order — the child
    // realm's imageStore (project_path) first, then the picker's library list
    // (projectDir/relative_path). A freshly imported image can be in either,
    // and only one of the two URLs may be servable by the efxasset:// protocol
    // (the Bg-picker import rendered only after the main-Studio import, which
    // resolved through the fallback). The hydration tries each until one
    // decodes, so the ref registers regardless of which path is correct.
    resolveAssetUrls: (ref) => {
      const urls: string[] = [];
      const image = imageStore.getById(ref);
      if (image) urls.push(assetUrl(image.project_path));
      if (fallback) {
        const pickerImage = fallback.images.find((candidate) => candidate.id === ref);
        if (pickerImage) urls.push(assetUrl(`${fallback.projectDir}/${pickerImage.relative_path}`));
      }
      return urls;
    },
    decodeBytes: _decodeEfxAssetBytes,
    register: registerBackgroundSourceImage,
  });
}

/**
 * 50-02 Task 3 (REF-05): the reopen-path reference source-byte hydration. The
 * SOLE production writer of the reference source registry on document
 * register/hydrate — without it every reopened reference reports Source
 * missing. It enumerates `document.photoReference.sourceFrameRefs` (NOT the
 * background clips), dedupes, resolves each ref to its library asset URL,
 * decodes bytes, and calls `registerReferenceSourceImage(sourceRef, dataUrl)`.
 * The ports are injectable so the contract tests drive a fake decoder; the
 * production caller (`hydrateReferenceSourceImagesFromLibrary`) supplies the
 * real imageStore/efxasset/fetch ports. Registration is runtime-only: it never
 * touches documentRevision, the undo ledger, or the dirty callback.
 */
export async function hydrateReferenceSourceImages(
  document: EfxPaintDocument,
  ports: BackgroundSourceHydrationPorts,
): Promise<BackgroundSourceHydrationResult> {
  const track = document.photoReference;
  if (track === null) return { registered: [], missing: [] };
  const distinctRefs = new Set(track.sourceFrameRefs);
  const registered: string[] = [];
  const missing: { ref: string; reason: 'asset-not-found' | 'decode-failed' }[] = [];
  await Promise.all(Array.from(distinctRefs).map(async (ref) => {
    const urls = ports.resolveAssetUrls(ref);
    if (urls.length === 0) {
      missing.push({ ref, reason: 'asset-not-found' });
      return;
    }
    for (const url of urls) {
      const bytes = await ports.decodeBytes(url);
      if (bytes !== null) {
        ports.register(ref, bytes);
        registered.push(ref);
        return;
      }
    }
    missing.push({ ref, reason: 'decode-failed' });
  }));
  return { registered, missing };
}

/**
 * Production ports for the reference source hydration: library asset id →
 * efxasset:// URL → decoded bytes → reference registry. Mirrors
 * `hydrateBackgroundSourceImagesFromLibrary` (imageStore primary, picker list
 * fallback) but registers into `_referenceSourceImages`.
 */
export function hydrateReferenceSourceImagesFromLibrary(
  document: EfxPaintDocument,
  fallback?: { images: readonly MceImageRef[]; projectDir: string },
): Promise<BackgroundSourceHydrationResult> {
  return hydrateReferenceSourceImages(document, {
    resolveAssetUrls: (ref) => {
      const urls: string[] = [];
      const image = imageStore.getById(ref);
      if (image) urls.push(assetUrl(image.project_path));
      if (fallback) {
        const pickerImage = fallback.images.find((candidate) => candidate.id === ref);
        if (pickerImage) urls.push(assetUrl(`${fallback.projectDir}/${pickerImage.relative_path}`));
      }
      return urls;
    },
    decodeBytes: _decodeEfxAssetBytes,
    register: registerReferenceSourceImage,
  });
}

/**
 * Background resolution capacity bound. The plan's "parent sequence frame
 * count" is not reachable from this store without an ESM cycle, so the store's
 * own universal parent-end bound (PHYSIC_PAINT_MAX_APPLY_FRAMES, the same
 * D-25/Q4 fold getRotoPhysicalRenderSource uses) is used instead — a larger
 * bound is always safe for per-frame resolution, since the resolver computes
 * ranges once and resolves per queried frame.
 */
const BACKGROUND_RESOLUTION_CAPACITY = PHYSIC_PAINT_MAX_APPLY_FRAMES;

/** 48-03 D-11: the flattened straight-alpha delivery record (PreviewPhysicPaintFrameSource-compatible + missing). */
export interface EfxPaintFlattenedFrameRecord {
  readonly layerId: string;
  readonly frame: number;
  readonly cacheKey: string;
  /**
   * G-52-8: the composite raster itself. Same-window draw surfaces (program
   * monitor, preview renderer) consume it directly — the WebP encode only runs
   * for transport/serialization readers via `encodeBytes()` (async Rust codec,
   * memoized on first call). `renderedFrame.bytes` is a placeholder; readers
   * that need the real bytes must await `encodeBytes()`.
   */
  readonly raster?: HTMLCanvasElement;
  readonly renderedFrame: PhysicPaintRenderedFrame;
  readonly encodeBytes: () => Promise<Uint8Array>;
  readonly missing: readonly EfxPaintMissingSourceEntry[];
}

function _notifyRotoPhysicalOperationLeaseChange(): void {
  physicPaintRotoPhysicalOperationLeaseVersion.value += 1;
}

function _rotoPhysicalOperationLeaseScope(projectContextId: string, layerId: string, trackId: string): string {
  return `${projectContextId.length}:${projectContextId}${layerId.length}:${layerId}${trackId.length}:${trackId}`;
}

function _rotoPhysicalOperationLeaseIdentity(token: PhysicPaintRotoPhysicalOperationLeaseToken): string {
  return `${_rotoPhysicalOperationLeaseScope(token.projectContextId, token.layerId, token.trackId)}:${token.generation}`;
}

function _sameRotoPhysicalOperationLease(
  left: PhysicPaintRotoPhysicalOperationLeaseToken,
  right: PhysicPaintRotoPhysicalOperationLeaseToken,
): boolean {
  return left.projectContextId === right.projectContextId
    && left.layerId === right.layerId
    && left.trackId === right.trackId
    && left.generation === right.generation
    && left.owner === right.owner;
}

function _validateRotoPhysicalLayerPublication(
  layerId: string,
  trackId: string,
  token: PhysicPaintRotoPhysicalOperationLeaseToken | null | undefined,
): { ok: true } | { ok: false; reason: PhysicPaintRotoPhysicalOperationLeaseFailureReason } {
  const activeForTrack = [..._rotoPhysicalOperationLeases.values()]
    .filter((lease) => lease.layerId === layerId && lease.trackId === trackId);
  if (activeForTrack.length === 0) {
    return token
      ? { ok: false, reason: _settledRotoPhysicalOperationLeases.has(_rotoPhysicalOperationLeaseIdentity(token))
        ? 'replayed-token'
        : 'mismatched-token' }
      : { ok: true };
  }
  if (!token) return { ok: false, reason: 'missing-token' };
  if (activeForTrack.length !== 1) return { ok: false, reason: 'mismatched-token' };
  const active = activeForTrack[0];
  if (_settledRotoPhysicalOperationLeases.has(_rotoPhysicalOperationLeaseIdentity(token))) {
    return { ok: false, reason: 'replayed-token' };
  }
  return _sameRotoPhysicalOperationLease(active, token)
    ? { ok: true }
    : { ok: false, reason: 'mismatched-token' };
}

/**
 * Fail-closed carrier guard for a hydrate-time roto document (52.2-06,
 * T-52.2-19). Every record the store is about to install must carry EXACTLY
 * ONE raster carrier: `media` for a reference-only (on-disk) record, `bytes`
 * for a live runtime projection. The canonical parser refuses a payload with
 * neither, but generically and without naming the record — this guard runs
 * first and names the offending keyId, over BOTH persisted collections, so a
 * malformed document is actionable rather than a bare "malformed record".
 */
function _assertRotoPhysicalDocumentCarriers(physical: unknown): void {
  if (typeof physical !== 'object' || physical === null) return;
  const document = physical as { realKeyRecords?: unknown; groupOverrideRecords?: unknown };
  for (const collection of [document.realKeyRecords, document.groupOverrideRecords]) {
    if (!Array.isArray(collection)) continue;
    for (const entry of collection) {
      if (typeof entry !== 'object' || entry === null) continue;
      const record = entry as { keyId?: unknown; payload?: unknown };
      if (typeof record.payload !== 'object' || record.payload === null) continue;
      const payload = record.payload as { bytes?: unknown; media?: unknown };
      if (payload.bytes === undefined && payload.media === undefined) {
        throw new Error(
          `PhysicPaintRotoPhysicalDocument: roto record "${typeof record.keyId === 'string' ? record.keyId : '?'}" carries neither a media reference nor inline raster bytes.`,
        );
      }
    }
  }
}

/**
 * The publishable runtime frame a duplicated/pasted key owes the runtime, or
 * null when the record cannot supply one (52.2-06, T-52.2-20). A record with a
 * media reference and no inline bytes has no pixels in the runtime yet — plan
 * 09 resolves them from the package — and a missing/zero raster dimension
 * would publish an invisible `width: 0` frame.
 */
function _resolveRotoPublishFrameSource(
  payload: PhysicPaintRotoRealKeyPayload,
): { bytes: Uint8Array; width: number; height: number } | null {
  const bytes = payload.bytes;
  const width = payload.width;
  const height = payload.height;
  if (bytes === undefined || width === undefined || width <= 0 || height === undefined || height <= 0) return null;
  return { bytes, width, height };
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
function _collectFrameBytesTokens(frames: Iterable<PhysicPaintRenderedFrame>, target: Set<string>): void {
  for (const frame of frames) {
    target.add(buildFrameBytesToken(frame.bytes));
    const onionBytes = (frame as { onionBytes?: unknown }).onionBytes;
    if (onionBytes instanceof Uint8Array) target.add(buildFrameBytesToken(onionBytes));
  }
}

/** Collect every payload bytes token owned by ONE track (46-01 track-scoped). */
function _getTrackBytesTokens(layerId: string, trackId: string): Set<string> {
  const tokens = new Set<string>();
  _collectFrameBytesTokens(_frames.get(layerId)?.get(trackId)?.values() ?? [], tokens);
  _collectFrameBytesTokens(_rotoCacheMetadata.get(layerId)?.get(trackId)?.values() ?? [], tokens);
  _collectFrameBytesTokens(_rotoGeneratedCacheMetadata.get(layerId)?.get(trackId)?.values() ?? [], tokens);
  for (const record of _rotoRealKeyRecords.get(layerId)?.get(trackId)?.values() ?? []) tokens.add(buildPhysicPaintRotoPayloadContentToken(record.payload));
  for (const record of _rotoGroupOverrideRecords.get(layerId)?.get(trackId)?.values() ?? []) tokens.add(buildPhysicPaintRotoPayloadContentToken(record.payload));
  return tokens;
}

function _isBytesTokenReferenced(token: string): boolean {
  const referencesToken = (frames: Iterable<PhysicPaintRenderedFrame>): boolean => {
    for (const frame of frames) {
      if (buildFrameBytesToken(frame.bytes) === token || ((frame as { onionBytes?: unknown }).onionBytes instanceof Uint8Array && buildFrameBytesToken((frame as { onionBytes?: Uint8Array }).onionBytes!) === token)) return true;
    }
    return false;
  };
  for (const layerTracks of _frames.values()) {
    for (const trackFrames of layerTracks.values()) if (referencesToken(trackFrames.values())) return true;
  }
  for (const layerTracks of _rotoCacheMetadata.values()) {
    for (const trackMetadata of layerTracks.values()) if (referencesToken(trackMetadata.values())) return true;
  }
  for (const layerTracks of _rotoGeneratedCacheMetadata.values()) {
    for (const trackMetadata of layerTracks.values()) if (referencesToken(trackMetadata.values())) return true;
  }
  for (const layerTracks of _rotoRealKeyRecords.values()) {
    for (const trackRecords of layerTracks.values()) {
      for (const record of trackRecords.values()) if (buildPhysicPaintRotoPayloadContentToken(record.payload) === token) return true;
    }
  }
  for (const layerTracks of _rotoGroupOverrideRecords.values()) {
    for (const trackRecords of layerTracks.values()) {
      for (const record of trackRecords.values()) if (buildPhysicPaintRotoPayloadContentToken(record.payload) === token) return true;
    }
  }
  return false;
}

function _pruneUnreferencedRotoAlphaCanvases(tokens: Iterable<string>): void {
  for (const token of tokens) {
    if (!_isBytesTokenReferenced(token)) rotoAlphaCanvasRegistry.delete(token);
  }
}

function _clearLayerState(layerId: string): boolean {
  const tokens = new Set<string>();
  for (const trackId of _frames.get(layerId)?.keys() ?? []) {
    for (const token of _getTrackBytesTokens(layerId, trackId)) tokens.add(token);
  }
  let changed = false;
  // Derived structural memo entries — pruned with the layer's source state
  // so a torn-down layer never leaves its cached projections resident.
  _deleteLayerRotoPhysicalStructuralCache(layerId);
  // 48-03: the flattened compositor memos are layer-scoped — torn down with
  // the layer's source state so a removed layer never leaves cached rasters
  // resident (and a re-registered layer id can never be served stale output).
  _flattenedMemo.delete(layerId);
  _trackRasterMemo.delete(layerId);
  _flattenedFondSignatures.delete(layerId);
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
  for (const token of tokens) {
    if (!_isBytesTokenReferenced(token)) changed = rotoAlphaCanvasRegistry.delete(token) || changed;
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

/** Create-or-fetch a layer's keyed compositor memo (48-03 D-08/D-07). */
function _getOrCreateCompositorMemo<K, V>(outer: Map<string, EfxPaintKeyedMemo<K, V>>, layerId: string): EfxPaintKeyedMemo<K, V> {
  let memo = outer.get(layerId);
  if (!memo) {
    memo = createKeyedMemo<K, V>();
    outer.set(layerId, memo);
  }
  return memo;
}

/**
 * 52.1-04 (D-12/D-13/D-14): the single decoded-frame decode path. Resolves the
 * byte-budgeted LRU handle (keyed by the stable bytes content token) instead of
 * the absorbed decode-once cache. On a miss it kicks off the async Rust decode
 * (`decode_webp_frame` → raw RGBA → transient ImageData → createImageBitmap with
 * premultiplyAlpha:'premultiply' — see _decodeWebpToBitmap for the WKWebView
 * straight-bitmap wash) and returns null this tick; the decode-complete
 * version-clock bump re-fires subscribers (the _compositorDecode idiom, MEMORY:
 * always bump AND subscribe). ImageData exists only as the transient IPC→bitmap
 * bridge, never stored (D-13).
 */

/** True while `prefetchNeighborFrames` runs — attributes decode telemetry. */
let _decodeOriginIsPrefetch = false;

function _compositorDecode(bytes: Uint8Array): ImageBitmap | null {
  const token = buildFrameBytesToken(bytes);
  const cached = frameLru.get(token);
  if (cached) {
    recordPhysicsPaintPerformanceCounter('decode.lruHit');
    return cached;
  }
  if (_compositorDecodeLoading.has(token)) {
    recordPhysicsPaintPerformanceCounter('decode.inflightSkip');
    return null;
  }
  _compositorDecodeLoading.add(token);
  recordPhysicsPaintPerformanceCounter('decode.lruMiss');
  const decodeOrigin: 'draw' | 'prefetch' = _decodeOriginIsPrefetch ? 'prefetch' : 'draw';
  const promise = (async (): Promise<ImageBitmap | null> => {
    try {
      const bitmap = await _decodeFrameBytesByFormat(bytes, decodeOrigin);
      frameLru.put(token, bitmap, bitmap.width, bitmap.height);
      return bitmap;
    } catch {
      // Decode failed — leave the token uncached so a later query retries.
      recordPhysicsPaintPerformanceCounter('decode.fail');
      return null;
    } finally {
      _compositorDecodeLoading.delete(token);
      _compositorDecodePromises.delete(token);
      physicPaintVersion.value++;
    }
  })();
  _compositorDecodePromises.set(token, promise);
  return null;
}

/**
 * Two-format law (52.1): real keys are VP8L (Rust codec); display-only derived
 * frames (interpolation blends) are PNG. Sniff the magic bytes — never feed PNG
 * bytes to the Rust WebP decoder. One implementation, shared by the inline
 * decode path and the media path, so the sniff cannot drift between them.
 */
async function _decodeFrameBytesByFormat(bytes: Uint8Array, origin: 'draw' | 'prefetch'): Promise<ImageBitmap> {
  const isWebp = bytes.length >= 16
    && bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x4c;
  return isWebp
    ? await _decodeWebpToBitmap(bytes, origin)
    : await _decodePngBytesToBitmap(bytes, origin);
}

/**
 * 52.2-09 Task 3 (D-13, T-52.2-29/31/32): resolve one persisted media
 * reference for the compositor seam. The bitmap it yields is cached in the
 * shared 512 MB frame LRU under the reference DIGEST — the resolver's key, so
 * the same raster referenced by several keys decodes once.
 *
 * A terminal non-bitmap outcome (missing file, digest mismatch, refusal) is
 * recorded by digest and reported as the Phase 49 MISSING branch, naming the
 * reference: transparent pixels plus a report entry, never a placeholder
 * bitmap. The first request kicks the async read off and returns null this
 * tick; the version-clock bump in `finally` re-fires subscribers when it
 * lands (the 52.1 decode idiom).
 */
function _resolveMediaRasterResolution(media: FrameMediaReference): EfxPaintTrackContentResolution | null {
  const cached = frameLru.get(media.digest);
  if (cached) return { kind: 'content', raster: cached };
  const verdict = _frameMediaVerdicts.get(media.digest);
  if (verdict !== undefined) return { kind: 'missing', missingRefs: [media.relativePath] };
  // 52.2-10 (D-12): bytes that arrived over the bridge's digest-keyed channel
  // resolve HERE, in memory — the package file is never consulted for a digest
  // the receiver already holds (T-52.2-35). Decoding is still lazy: the frame
  // enters the LRU only when the compositor actually needs it, through the same
  // two-format sniff as every other decode (one implementation).
  const bridgedBytes = _frameMediaBytes.get(media.digest);
  if (bridgedBytes !== undefined) {
    if (!_frameMediaResolutionPromises.has(media.digest)) {
      const promise = (async (): Promise<void> => {
        try {
          const bitmap = await _decodeFrameBytesByFormat(bridgedBytes, 'draw');
          frameLru.put(media.digest, bitmap, bitmap.width, bitmap.height);
          // The LRU now owns the decoded handle — drop the byte copy so a
          // bridged frame is never held twice (eviction then answers false,
          // and a later sync may legitimately re-ship it).
          _frameMediaBytes.delete(media.digest);
        } catch {
          recordPhysicsPaintPerformanceCounter('decode.fail');
          _frameMediaVerdicts.set(media.digest, 'decode-failed');
        } finally {
          _frameMediaResolutionPromises.delete(media.digest);
          physicPaintVersion.value++;
        }
      })();
      _frameMediaResolutionPromises.set(media.digest, promise);
    }
    return null;
  }
  if (!_frameMediaResolutionPromises.has(media.digest)) {
    const packageDir = _packageDirProvider?.() ?? null;
    if (packageDir === null) {
      // No package root this session — there is no file the reference could
      // name, so the frame is honest missing content (never a fabricated one).
      // quick-260913-52r (G): LOUD, once per digest (the verdict short-
      // circuits later ticks) — a reference that can never resolve is the
      // exact failure the package format must surface, not hide.
      console.warn(
        `[physicPaint] frame media "${media.relativePath}" (digest ${media.digest}) is unresolvable: no package root is available in this window. The frame renders as missing content.`,
      );
      _frameMediaVerdicts.set(media.digest, 'missing');
      return { kind: 'missing', missingRefs: [media.relativePath] };
    }
    const promise = resolveFrameMediaBitmap({
      packageDir,
      reference: media,
      // The LRU interface is structural: the frame LRU already owns the byte
      // budget and `bitmap.close()` on eviction, so media frames share the one
      // cache and one eviction policy (T-52.2-31, D-10/D-12).
      lru: frameLru,
      decode: async (bytes) => {
        try {
          return await _decodeFrameBytesByFormat(bytes, 'draw');
        } catch {
          recordPhysicsPaintPerformanceCounter('decode.fail');
          return null;
        }
      },
    }).then((resolution) => {
      // A 'bitmap' outcome is already in the LRU; only the failures need a
      // durable verdict so the next tick does not re-issue the read.
      if (resolution.kind !== 'bitmap') {
        const reason = resolution.kind === 'missing' ? 'missing' : resolution.reason;
        // quick-260913-52r (G): a failed resolution is LOUD — once per digest,
        // because the verdict short-circuits every later tick.
        console.warn(
          `[physicPaint] frame media "${media.relativePath}" (digest ${media.digest}) could not be resolved: ${reason}. The frame renders as missing content.`,
        );
        _frameMediaVerdicts.set(media.digest, reason);
      }
    }).catch((error) => {
      // An unexpected transport failure is an `io` refusal — never a bitmap.
      console.warn(
        `[physicPaint] frame media "${media.relativePath}" (digest ${media.digest}) read failed: ${error instanceof Error ? error.message : String(error)}.`,
      );
      _frameMediaVerdicts.set(media.digest, 'io');
    }).finally(() => {
      _frameMediaResolutionPromises.delete(media.digest);
      physicPaintVersion.value++;
    });
    _frameMediaResolutionPromises.set(media.digest, promise);
  }
  return null;
}

async function _decodeWebpToBitmap(bytes: Uint8Array, origin: 'draw' | 'prefetch'): Promise<ImageBitmap> {
  // Telemetry (stall diagnosis): the JS-observed invoke wall time covers the
  // request-body handoff + codec + Rust base64 encode + response JSON string
  // transfer + JS parse; codecMs isolates the pure codec. The convert step is
  // the base64 decode (rgba arrives as Uint8Array) + the ImageData view; bitmap
  // covers the premultiplied upload.
  const ipcStartedAt = performance.now();
  const { width, height, rgba, codecMs } = await decodeWebpFrame({ bytes });
  const ipcEndedAt = performance.now();
  const rgbaIsJsonArray = Array.isArray(rgba);
  const convertStartedAt = performance.now();
  const imageData = new ImageData(
    rgba instanceof Uint8Array
      ? new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.byteLength)
      : new Uint8ClampedArray(rgba),
    width,
    height,
  );
  const convertEndedAt = performance.now();
  // 52.1 (washed-out regression): premultiply AT bitmap creation. drawImage
  // only ever consumes premultiplied data, and WKWebView draws a
  // straight-alpha-flagged ('none') bitmap AS IF premultiplied — every
  // semi-transparent stroke pixel composites over-bright ("screen-blend" wash).
  // Hydrated keys escaped because they draw from rotoAlphaCanvasRegistry
  // canvases (browser-decoded blob, already premultiplied); a freshly applied
  // key misses the registry and lands here, so only its new strokes washed out.
  const bitmap = await createImageBitmap(imageData, { premultiplyAlpha: 'premultiply' });
  const bitmapEndedAt = performance.now();
  recordPhysicsPaintDecodeSample({
    path: 'webp',
    origin,
    ipcMs: ipcEndedAt - ipcStartedAt,
    codecMs: typeof codecMs === 'number' ? codecMs : -1,
    convertMs: convertEndedAt - convertStartedAt,
    bitmapMs: bitmapEndedAt - convertEndedAt,
    width,
    height,
    inputBytes: bytes.length,
    rgbaIsJsonArray,
  });
  return bitmap;
}

async function _decodePngBytesToBitmap(bytes: Uint8Array, origin: 'draw' | 'prefetch'): Promise<ImageBitmap> {
  const startedAt = performance.now();
  const bitmap = await createImageBitmap(new Blob([bytes.slice()], { type: 'image/png' }));
  recordPhysicsPaintDecodeSample({
    path: 'png',
    origin,
    ipcMs: 0,
    codecMs: -1,
    convertMs: 0,
    bitmapMs: performance.now() - startedAt,
    width: bitmap.width,
    height: bitmap.height,
    inputBytes: bytes.length,
    rgbaIsJsonArray: false,
  });
  return bitmap;
}

/**
 * 52.1-05 (D-13): await every in-flight decode. The export preload calls this
 * after triggering the per-frame decodes so the render loop's getFlattenedFrame
 * returns the baked raster — a cold LRU miss must never render a frame with a
 * silently missing layer.
 *
 * 52.2-09 Task 3: the persisted-media reads are in-flight work of the same
 * kind — an export that awaited only the inline decodes would bake a frame
 * whose reopened real key was still being read from the package.
 */
export function awaitPendingDecodes(): Promise<void> {
  return Promise.all([
    ..._compositorDecodePromises.values(),
    ..._frameMediaResolutionPromises.values(),
  ]).then(() => undefined);
}

/**
 * One track's content term for the flattened key (48-03): the roto track's
 * structural contentRevision, or the cached-frame dataUrl-slice idiom for
 * non-roto tracks (previewRenderer.ts:175). Null when the track has no content
 * at this frame — its term is then absent from the key.
 */
function _trackContentRevision(layerId: string, trackId: string, frame: number): string | null {
  const structural = _resolveRotoPhysicalStructural(layerId, trackId);
  if (structural) return structural.contentRevision;
  const renderedFrame = physicPaintStore.getFrame(layerId, trackId, frame);
  if (!renderedFrame) return null;
  return buildFrameBytesToken(renderedFrame.bytes);
}

/**
 * 260920-k34 (53-CONTEXT D-09): the ONE fond resolution. The ACTIVE TRACK's
 * paper mirror first; the document fallback only when that track has no paper of
 * its own. One resolution, two consumers — the flattened draw
 * ({@link _resolveDocumentFondInstruction}) and the preload gate
 * ({@link physicPaintStore.getFondPaperTexture}, consumed by
 * `previewRenderer.collectRotoPaperTextures`) — so the gate can never await a
 * texture the draw ignores, nor miss the one it draws.
 *
 * Precedence, total and deterministic (T-260920-k34-01):
 *  1. an entry EXISTS for the ACTIVE track in `_rotoBackgroundMetadata` → it is
 *     the track's own paper and governs; `background: 'transparent'` means the
 *     user chose no paper for that track → no fond (null, never a thrown error);
 *  2. no entry → the document fallback exactly as it resolves today:
 *     transparent → none, solid → the color, paper → paper + the
 *     `paperGrain ? texture : ''` mapping.
 *
 * Visibility/solo are deliberately NOT consulted — the fond is composite-level
 * state, never track content, and the two solo systems are untouched.
 */
type FondSource =
  | { readonly kind: 'paper'; readonly metadata: PhysicPaintRotoBackgroundMetadata }
  | { readonly kind: 'color'; readonly color: string };

function _resolveFondSource(layerId: string, efxDocument: EfxPaintDocument): FondSource | null {
  const trackPaper = _rotoBackgroundMetadata.get(layerId)?.get(efxDocument.activeTrackId);
  if (trackPaper) {
    if (trackPaper.background === 'transparent') return null;
    return { kind: 'paper', metadata: trackPaper };
  }
  const fallback = efxDocument.background.fallback;
  if (fallback.mode === 'transparent') return null;
  if (fallback.mode === 'solid') return { kind: 'color', color: fallback.color };
  return {
    kind: 'paper',
    metadata: {
      background: fallback.texture,
      paperGrain: fallback.paperGrain ? fallback.texture : '',
      grainStrength: fallback.grainStrength,
    },
  };
}

/**
 * v1.0 rendering law (locked): the paper fond is NOT track content. Per-track
 * rasters stay transparent where unpainted so upper tracks composite normally
 * (opacity+blend) instead of masking lower ones; the paper is drawn ONCE
 * beneath the flattened composite as the composite-level fond.
 *
 * 49-03 (D-11 consumption half) — SUPERSEDED on its RESOLUTION half by
 * 260920-k34 / 53-CONTEXT D-09: the fond is NOT the document fallback alone.
 * The active track's paper mirror is consulted FIRST (see
 * {@link _resolveFondSource}); the document fallback resolves only when the
 * track has no paper of its own. D-11's STRUCTURAL half STANDS: the paper
 * remains ONE composite-level fond beneath the tracks — never per-track raster
 * content — so the v1.0 rendering law is unchanged. Instruction construction
 * stays in `resolveMissingRotoFrameDraw` (one place, no second switch). The
 * texture-less deterministic draw (color fill + grain) matches the 48-03
 * flattened-path reference (paperCanvas deliberately null).
 */
function _resolveDocumentFondInstruction(
  layerId: string,
  efxDocument: EfxPaintDocument,
): Extract<MissingRotoFrameDrawInstruction, { kind: 'background-only' }> | null {
  const source = _resolveFondSource(layerId, efxDocument);
  if (!source) return null;
  const backgroundState: MissingRotoFrameBackgroundState =
    source.kind === 'color'
      ? { mode: 'color', color: source.color }
      : { mode: 'paper', metadata: source.metadata };
  const instruction = resolveMissingRotoFrameDraw(layerId, 0, { backgroundState });
  return instruction.kind === 'background-only' ? instruction : null;
}

/**
 * 260920-k34: `activeTrackId` is NOT a term of the flattened key — its config
 * term (`buildEfxPaintCompositeRevision`) covers track id/order/visible/solo/
 * opacity/blendMode plus background id/visible/fallback, and the `fb:`/clip/
 * content terms cover the rest. So an active-track SWITCH would otherwise serve
 * a memoized raster carrying the previous track's paper. This guard compares
 * the resolved fond signature BEFORE the memo lookup and clears the layer's
 * memos only when it actually changed: an unchanged resolution never clears, so
 * there is no recomposite churn (T-260920-k34-02) and no cache-key change (the
 * plan's guardrail — a memo CLEAR, never a key term). A paper EDIT is already
 * covered by `setRotoBackgroundMetadata`'s own memo clear.
 */
const _flattenedFondSignatures = new Map<string, string>();

function _fondSourceSignature(source: FondSource | null): string {
  if (!source) return 'none';
  if (source.kind === 'color') return `color:${source.color}`;
  const metadata = source.metadata;
  return `paper:${metadata.background}:${metadata.paperGrain}:${metadata.grainStrength}:${metadata.color ?? ''}`;
}

function _rotateFlattenedMemoOnFondChange(layerId: string, efxDocument: EfxPaintDocument): void {
  const signature = _fondSourceSignature(_resolveFondSource(layerId, efxDocument));
  if (_flattenedFondSignatures.get(layerId) === signature) return;
  _flattenedFondSignatures.set(layerId, signature);
  _flattenedMemo.delete(layerId);
  _trackRasterMemo.delete(layerId);
}

/**
 * Fond paper textures load asynchronously; while loading the fond draws the
 * deterministic color-fill fallback. One module-level resolve subscription per
 * texture watches the arrival: the flattened memos clear (the fond is not a
 * flattened-key term) and the paint clock bumps so narrow leaf subscribers
 * (the program monitor) re-query and every surface recomposites with the real
 * texture. Resolve-only delivery — the query path never pre-warms the cache,
 * so the fallback draw is deterministic while the texture is unresolved.
 */
const _fondTextureSubscriptions = new Set<string>();
function _ensureFondTextureSubscription(paperTexture: string | undefined): void {
  if (!paperTexture || isProjectPaperTextureResolved(paperTexture)) return;
  if (_fondTextureSubscriptions.has(paperTexture)) return;
  _fondTextureSubscriptions.add(paperTexture);
  subscribeProjectPaperTextureResolve(paperTexture, () => {
    _flattenedMemo.clear();
    physicPaintVersion.value++;
  });
}

/**
 * 48-03 D-10 content precedence for ONE track (the D-10 seam the compositor's
 * resolveTrackContent port wires): roto tracks resolve via
 * getRotoPhysicalRenderSource with the loop-placeholder/null → { kind:'missing' }
 * mapping (D-09); non-roto tracks resolve the cached frame via getFrame. The
 * raster is the track's own pixels ONLY — the v1.0 rendering law keeps the
 * paper fond out of the per-track raster (it is drawn once beneath the
 * flattened composite, see {@link _resolveDocumentFondInstruction}). Returns
 * null ONLY when a decode is pending this tick — the whole flattened call must
 * return null (Tests 7/10), never a fabricated raster.
 */
function _preResolveTrackContent(
  layerId: string,
  trackId: string,
  frame: number,
): EfxPaintTrackContentResolution | null {
  const structural = _resolveRotoPhysicalStructural(layerId, trackId);
  if (structural) {
    const source = physicPaintStore.getRotoPhysicalRenderSource(layerId, trackId, frame);
    if (!source) return { kind: 'missing', missingRefs: [] };
    if (source.kind === 'loop-placeholder') {
      return { kind: 'missing', missingRefs: source.missingSourceKeyIds ?? source.sourceKeyIds ?? [] };
    }
    // 52.2-09 Task 3 (D-13): a REOPENED package holds reference-only records —
    // the pixels live in `frames/<layerId>/<keyId>.webp`, never inline — so a
    // media-carrying payload resolves through the media seam instead of the
    // inline-bytes assertion (which stays the runtime-record contract). Both
    // roto collections reach this ONE seam: a reference names no collection.
    const media = source.renderedFrame.media;
    if (source.renderedFrame.bytes === undefined && media !== undefined) {
      return _resolveMediaRasterResolution(media);
    }
    const bytes = requirePhysicPaintRotoInlineBytes(source.renderedFrame);
    // G-52-8 (FIX 3): decode-once across the whole app — launch hydration
    // already decoded this exact payload off the main thread into the alpha
    // canvas registry, so the compositor reuses that canvas instead of paying
    // a second main-thread decode (WebKit decodes lazily at the first
    // drawImage of the _compositorDecode Image). The registry canvas is a
    // read-only drawImage source here, same dimensions as the decoded image.
    const registeredCanvas = rotoAlphaCanvasRegistry.get(buildFrameBytesToken(bytes));
    // G-52-10: fail-soft — a zero-size entry (a registered canvas a caller
    // later released) would throw InvalidStateError at drawImage; fall through
    // to _compositorDecode instead.
    if (registeredCanvas && registeredCanvas.width > 0 && registeredCanvas.height > 0) {
      return { kind: 'content', raster: registeredCanvas };
    }
    const image = _compositorDecode(bytes);
    if (!image) return null;
    return { kind: 'content', raster: image };
  }
  const renderedFrame = physicPaintStore.getFrame(layerId, trackId, frame);
  if (!renderedFrame) return { kind: 'missing', missingRefs: [] };
  const image = _compositorDecode(renderedFrame.bytes);
  if (!image) return null;
  return { kind: 'content', raster: image };
}

/** 48-03 store-side implementation of the 48-04 resolveBackgroundSourceImage port. */
function _resolveBackgroundSourceImage(sourceRef: string): ImageBitmap | null {
  const bytes = _backgroundSourceImages.get(sourceRef);
  if (!bytes) return null;
  return _compositorDecode(bytes);
}

/**
 * 52.1-04 (D-10): neighbor prewarm — decode the adjacent frames (N+1, N+2, and
 * N-1) through the existing decode path (decode_webp_frame → createImageBitmap
 * → frameLru.put) into the SAME 512 MB LRU. One budget, one eviction policy:
 * there is no second prewarm budget. The just-drawn frame is most-recently-used
 * so prewarm only evicts the distant tail behind the playhead. Missing frames
 * (past the sequence end, or a track with no source at that appFrame) resolve
 * to `{ kind: 'missing' }` without a decode, so the helper is safe to call at
 * any playhead position.
 */
export function prefetchNeighborFrames(layerId: string, appFrame: number): void {
  const efxDocument = getEfxPaintDocument(layerId);
  if (!efxDocument) return;
  recordPhysicsPaintPerformanceCounter('prefetch.call');
  const participating = participatingPaintTracks(efxDocument);
  const previousOrigin = _decodeOriginIsPrefetch;
  _decodeOriginIsPrefetch = true;
  try {
    for (const offset of [-1, 1, 2]) {
      const targetFrame = appFrame + offset;
      if (targetFrame < 0) continue;
      for (const track of participating) {
        _preResolveTrackContent(layerId, track.id, targetFrame);
      }
    }
  } finally {
    _decodeOriginIsPrefetch = previousOrigin;
  }
}

/** 50-02 Task 2: the frame-aligned reference source verdict for the ghost draw path. */
export interface ReferenceSourceFrameVerdict {
  readonly ref: string;
  readonly bytes: Uint8Array;
  readonly clamped: boolean;
}

/**
 * 50-02 Task 2: frame-aligned fail-closed reference resolution (D-15, D-04).
 * Application frame N resolves to source frame N, 1:1 from frame 0, clamped at
 * the sequence end (last source frame holds). A missing source ref resolves to
 * null (never a placeholder, never silent transparency). Resolution is per
 * cursor frame, never once at import (Pitfall M5).
 */
function _resolveReferenceSourceImage(document: EfxPaintDocument, frame: number): ReferenceSourceFrameVerdict | null {
  const track = document.photoReference;
  if (track === null || track.sourceFrameRefs.length === 0) return null;
  const index = Math.min(frame, track.sourceFrameRefs.length - 1);
  const ref = track.sourceFrameRefs[index];
  const bytes = _referenceSourceImages.get(ref);
  if (bytes === undefined) return null;
  return { ref, bytes, clamped: index !== frame };
}

// ---------------------------------------------------------------------------
// 52-01 (D-01/D-11/D-12): the reveal bake commit path.
//
// The bake reads the reference via `_resolveReferenceSourceImage` (frame-aligned,
// null-on-missing → fail-closed) plus the reference transform — NEVER the
// composited preview (Pitfall 2, T-52-01). It runs the reveal bake render
// function and commits the resulting `PhysicPaintRotoRealKeyRecord`s through the
// existing acknowledged physical-edit transaction (`replaceRotoPhysicalRecords`,
// which revalidates the canonical revision before any write — T-52-02). The
// span's prior records are replaced (D-05/D-17); records outside the span are
// preserved. An interrupted or aborted bake writes no keys (D-11).
// ---------------------------------------------------------------------------

/** Input to the reveal bake commit path (52-01 Task 1 step 4). */
export interface RevealBakeInput {
  layerId: string;
  trackId: string;
  script: RotoPaintScript;
  frameCount: number;
  canonicalStart: number;
  motion: Readonly<{ deformation: number; position: number }>;
  mode: 'progressive' | 'static';
  signal: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}

/** Closed result of the reveal bake commit path. */
export type RevealBakeResult =
  | { ok: true; records: readonly PhysicPaintRotoRealKeyRecord[] }
  | { ok: false; error: string };

export async function commitRevealBake(input: RevealBakeInput): Promise<RevealBakeResult> {
  const document = getEfxPaintDocument(input.layerId);
  if (!document) return { ok: false, error: 'no efx paint document' };
  const track = document.photoReference;
  if (track === null) return { ok: false, error: 'no photo reference' };

  const capacity = physicPaintStore.getRotoPhysicalCapacity(input.layerId, input.trackId);
  if (input.canonicalStart + input.frameCount > capacity) {
    return { ok: false, error: 'reveal span exceeds capacity' };
  }

  // The bake renders at the WORKING canvas size — the same size authority as
  // the PlayScript path (Studio `getSize` port) — because script strokes live
  // in working coordinates. Rendering at project size squashes coverage into
  // the up-left quadrant and makes the reference mask sample the wrong region
  // (G-52-2a). The project→working zoom rides with the reference so the mask
  // composite reproduces the ghost draw math exactly.
  const projectSize = _compositorSizeProvider?.() ?? FALLBACK_COMPOSITE_SIZE;
  const size = getPhysicsPaintWorkingSize(projectSize.width, projectSize.height);
  const referenceZoom = size.width / projectSize.width;

  // Frame-aligned reference resolution (D-15): the span is walked ONCE and ANY
  // unresolved span frame fails the bake closed BEFORE a pixel is rendered and
  // BEFORE a key is written — never a clamped or substituted image (D-12,
  // T-52-01). `_resolveReferenceSourceImage` is frame-aligned by construction;
  // resolving it once at `canonicalStart` (WR-02) silently baked the span-start
  // image into EVERY frame of a multi-image reference.
  const bytesByAppFrame = new Map<number, Uint8Array>();
  for (let index = 0; index < input.frameCount; index += 1) {
    const appFrame = input.canonicalStart + index;
    const verdict = _resolveReferenceSourceImage(document, appFrame);
    if (verdict === null) return { ok: false, error: 'missing reference source' };
    bytesByAppFrame.set(appFrame, verdict.bytes);
  }

  let staged;
  try {
    staged = await renderRotoRevealFrames({
      script: input.script,
      frameCount: input.frameCount,
      canonicalStart: input.canonicalStart,
      motion: input.motion,
      mode: input.mode,
      size,
      reference: { bytesByAppFrame, transform: track.transform, zoom: referenceZoom },
      signal: input.signal,
      onProgress: input.onProgress,
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'reveal bake failed' };
  }

  const bakedRecords: PhysicPaintRotoRealKeyRecord[] = staged.map((frame) => ({
    kind: 'real-key',
    keyId: createPhysicPaintRotoKeyId(),
    appFrame: frame.appFrame,
    payload: {
      frameIndex: frame.frameIndex,
      appFrame: frame.appFrame,
      bytes: frame.bytes,
      width: frame.width,
      height: frame.height,
    },
  }));

  // D-05/D-17: the bake replaces the span's records (the defining paint strokes
  // are the generation medium); records outside the span are preserved.
  const existingRecords = physicPaintStore.getRotoRealKeyRecords(input.layerId, input.trackId);
  const spanStart = input.canonicalStart;
  const spanEnd = input.canonicalStart + input.frameCount;
  const outsideSpan = existingRecords.filter((record) => record.appFrame < spanStart || record.appFrame >= spanEnd);
  const merged = [...outsideSpan, ...bakedRecords];

  // 52 UAT (AM-4): a new rail never receives incoming interpolation. The baked
  // cycle's FIRST key registers the leading break so a previous rail's last real
  // key cannot interpolate forward across the gap (exactly like the Phase 46
  // paste/duplicate boundary law and the Scissor's next-key break). The
  // acknowledged-transaction shape forces the break writes to SPLIT around the
  // records replacement: the prune must validate against the CURRENT records
  // (parsePhysicPaintRotoIncomingInterpolationBreakKeyIds throws on orphans, and
  // replaced break-owning span keys would make the records port's revision check
  // throw), while the leading break's fresh keyId only exists AFTER the records
  // replacement.
  const currentBreaks = physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(input.layerId, input.trackId);
  const spanRecordKeyIds = new Set(existingRecords
    .filter((record) => record.appFrame >= spanStart && record.appFrame < spanEnd)
    .map((record) => record.keyId));
  const prunedBreaks = currentBreaks.filter((keyId) => !spanRecordKeyIds.has(keyId));
  // The prune port only runs when something is ACTUALLY pruned. A fresh track
  // has no mounted record/break maps (the port would fail closed), and any
  // break left after the prune references an outside-span record that the bake
  // preserves — so when nothing was pruned the records replacement cannot orphan
  // the current collection and the pre-records prune write is unnecessary.
  if (prunedBreaks.length !== currentBreaks.length) {
    const pruneResult = physicPaintStore.replaceRotoPhysicalIncomingInterpolationBreakKeyIds(input.layerId, input.trackId, prunedBreaks);
    if (!pruneResult.ok) return { ok: false, error: pruneResult.error };
  }

  // The acknowledged physical-edit transaction: validates the complete record set
  // and revalidates the canonical revision before any write (T-52-02).
  const interpolation = physicPaintStore.getRotoPhysicalInterpolationState(input.layerId, input.trackId);
  const commitResult = physicPaintStore.replaceRotoPhysicalRecords(input.layerId, input.trackId, merged, interpolation, capacity);
  if (!commitResult.ok) return { ok: false, error: commitResult.error };

  const leadingBakedKeyId = bakedRecords.find((record) => record.appFrame === spanStart)?.keyId ?? null;
  if (leadingBakedKeyId !== null) {
    const leadingBreaks = prunedBreaks.includes(leadingBakedKeyId)
      ? prunedBreaks
      : [...prunedBreaks, leadingBakedKeyId];
    const breaksResult = physicPaintStore.replaceRotoPhysicalIncomingInterpolationBreakKeyIds(input.layerId, input.trackId, leadingBreaks);
    if (!breaksResult.ok) return { ok: false, error: breaksResult.error };
  }

  return { ok: true, records: bakedRecords };
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
  const onionBytes = (renderedFrame as { onionBytes?: Uint8Array }).onionBytes;
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
    ...(typeof onionBytes === 'string' ? { onionBytes } : {}),
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
    bytes: new Uint8Array(0),
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

// Two-format law: blended interpolation bytes are PNG (display-only, never
// persisted/validated); real keys are VP8L-only. The browser's toDataURL cannot
// emit VP8L, and these derived frames never reach validation, so an explicit
// image/png producer is honest here.
function _blendRegisteredAlphaCanvasDataUrl(firstKeyFrame: PhysicPaintRenderedFrame, secondKeyFrame: PhysicPaintRenderedFrame, t: number): Uint8Array | null {
  if (typeof document === 'undefined') return null;
  const firstCanvas = rotoAlphaCanvasRegistry.get(buildFrameBytesToken(firstKeyFrame.bytes));
  const secondCanvas = rotoAlphaCanvasRegistry.get(buildFrameBytesToken(secondKeyFrame.bytes));
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
  const bytes = canvasToPngBytes(output);
  return bytes;
}

function _blendAlphaBytes(firstKeyFrame: PhysicPaintRenderedFrame, secondKeyFrame: PhysicPaintRenderedFrame, t: number): Uint8Array | null {
  return _blendRegisteredAlphaCanvasDataUrl(firstKeyFrame, secondKeyFrame, t);
}

/**
 * 52.2-02 (D-07): project a runtime real-key payload into the rendered-frame
 * shape the interpolation renderers consume. A payload carries exactly one
 * raster carrier, and these renderers read pixels, so the inline carrier is
 * asserted here — a reference-only payload never reaches a generated-cell
 * render, which is a runtime-only derivation.
 */
function _toRenderedPayloadFrame(payload: PhysicPaintRotoRealKeyPayload): PhysicPaintRenderedFrame {
  return {
    frameIndex: payload.frameIndex,
    appFrame: payload.appFrame,
    bytes: requirePhysicPaintRotoInlineBytes(payload),
    ...(payload.width !== undefined ? { width: payload.width } : {}),
    ...(payload.height !== undefined ? { height: payload.height } : {}),
  };
}

export function renderDuplicateRotoInterpolationFrame(sourceKeyFrame: PhysicPaintRenderedFrame, targetFrame: number, _settings: PhysicPaintRotoInterpolationSettings): PhysicPaintRenderedFrame {
  return _withGeneratedAppFrame({
    frameIndex: 0,
    appFrame: targetFrame,
    bytes: sourceKeyFrame.bytes,
    width: sourceKeyFrame.width,
    height: sourceKeyFrame.height,
  }, targetFrame);
}

export function renderBlendedRotoInterpolationFrame(firstKeyFrame: PhysicPaintRenderedFrame, secondKeyFrame: PhysicPaintRenderedFrame, targetFrame: number, t: number, _settings: PhysicPaintRotoInterpolationSettings): PhysicPaintRenderedFrame | null {
  const bytes = _blendAlphaBytes(firstKeyFrame, secondKeyFrame, t);
  if (!bytes) return null;
  return _withGeneratedAppFrame({
    frameIndex: 0,
    appFrame: targetFrame,
    bytes,
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
    const enumerateRenderStartedAtMs = performance.now();
    const rendered = settings.mode === 'duplicate'
      ? renderDuplicateRotoInterpolationFrame(from, targetFrame, settings)
      : renderBlendedRotoInterpolationFrame(from, to, targetFrame, displayEntry.t, settings);
    recordPhysicsPaintPerformance({ stage: 'generated.renderEnumerate', category: 'sync-cpu', durationMs: performance.now() - enumerateRenderStartedAtMs, timestamp: performance.now(), sourceFrame: targetFrame });
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

/**
 * 52.1 lever 1: resolve a generated (blend/duplicate) frame through the
 * read-path cache keyed by cacheRevision. The cacheRevision embeds
 * contentRevision, so a real-key edit (which rotates contentRevision) can
 * never be served a stale blend. On a miss the frame is rendered once and
 * stored; the cache is byte-budgeted (FIFO eviction) and holds raw bytes.
 */
function _getOrRenderGeneratedRotoFrame(
  cacheRevision: string,
  mode: 'duplicate' | 'blend',
  left: PhysicPaintRotoRealKeyRecord,
  right: PhysicPaintRotoRealKeyRecord,
  appFrame: number,
  t: number,
): PhysicPaintRenderedFrame | null {
  const cached = _generatedRenderSourceCache.get(cacheRevision);
  if (cached) {
    recordPhysicsPaintPerformanceCounter('generated.cacheHit');
    return cached;
  }
  // A reference-only record (its frame file could not be read at project open;
  // the launch warned per key and renders it as missing content) carries no
  // pixels to interpolate FROM. `null` is this path's existing "cannot render
  // this cell" signal — the cell then has no generated frame, exactly like the
  // real keys it sits between — instead of refusing the whole strip.
  if (left.payload.bytes === undefined) return null;
  if (mode === 'blend' && right.payload.bytes === undefined) return null;
  recordPhysicsPaintPerformanceCounter('generated.cacheMiss');
  const settings = { ...DEFAULT_ROTO_INTERPOLATION_SETTINGS, enabled: true, mode };
  const renderStartedAtMs = performance.now();
  const rendered = mode === 'duplicate'
    ? renderDuplicateRotoInterpolationFrame(_toRenderedPayloadFrame(left.payload), appFrame, settings)
    : renderBlendedRotoInterpolationFrame(_toRenderedPayloadFrame(left.payload), _toRenderedPayloadFrame(right.payload), appFrame, t, settings);
  recordPhysicsPaintPerformance({
    stage: 'generated.render',
    category: 'sync-cpu',
    durationMs: performance.now() - renderStartedAtMs,
    timestamp: performance.now(),
    sourceFrame: appFrame,
    branch: mode,
  });
  if (!rendered) {
    return null;
  }
  _generatedRenderSourceCache.set(cacheRevision, rendered);
  _generatedRenderSourceCacheBytes += rendered.bytes.length;
  while (_generatedRenderSourceCacheBytes > GENERATED_RENDER_SOURCE_CACHE_BYTE_CEILING) {
    const oldestKey = _generatedRenderSourceCache.keys().next().value;
    if (oldestKey === undefined) break;
    const oldest = _generatedRenderSourceCache.get(oldestKey);
    _generatedRenderSourceCache.delete(oldestKey);
    if (oldest) _generatedRenderSourceCacheBytes -= oldest.bytes.length;
  }
  return rendered;
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
 * Project one runtime record collection into its persisted (media-reference)
 * shape when the caller supplied a resolver (52.2-06, D-06/D-07). No resolver
 * means the live Studio path: records pass through with their bytes, exactly
 * as before this plan. A supplied resolver makes the projection mandatory —
 * an unresolved key throws rather than producing a record without media.
 */
function _projectRotoRecordsForPersistence(
  records: readonly PhysicPaintRotoRealKeyRecord[],
  resolveRef: PhysicPaintRotoMediaReferenceResolver | undefined,
): readonly PhysicPaintRotoRealKeyRecord[] {
  if (resolveRef === undefined) return records;
  const projected = toPersistedRotoRecords(records, resolveRef);
  if (!projected.ok) throw new PhysicPaintRotoMediaProjectionError(projected.failure);
  return projected.records;
}

/**
 * Build the canonical v1.0 rotoPhysical document payload for one layer, or
 * null when the layer has no physical Roto state. Consumed by the v1.0
 * document projection (extractRuntimeStateForDocument) so the serialized
 * payload is always schema-valid. Reads the module maps directly (the
 * `_resolveRotoPhysicalStructural` idiom) and mirrors the getRoto* accessor
 * derivations exactly.
 *
 * 52.2-06 (D-06): when `resolveRef` is supplied, BOTH persisted roto
 * collections are projected to media references BEFORE the revision is
 * computed, so the persisted revision is a function of the references (plan
 * 02's reference-total encoding) and no payload byte is read on this path.
 * Projecting only `realKeyRecords` would leave group overrides carrying an
 * inline raster into the sub-file, and the on-disk parser refuses the whole
 * layer — not one lost key.
 */
function _buildRotoPhysicalDocumentForLayer(
  layerId: string,
  trackId: string,
  resolveRef?: PhysicPaintRotoMediaReferenceResolver,
): PhysicPaintRotoPhysicalDocument | null {
  const recordMap = _rotoRealKeyRecords.get(layerId)?.get(trackId);
  if (!recordMap) return null;
  const realKeyRecords = Array.from(recordMap.values()).sort((a, b) => a.appFrame - b.appFrame || a.keyId.localeCompare(b.keyId));
  const groupOverrideRecords = Array.from(_rotoGroupOverrideRecords.get(layerId)?.get(trackId)?.values() ?? [])
    .sort((a, b) => a.appFrame - b.appFrame || a.keyId.localeCompare(b.keyId));
  const persistedRealKeyRecords = _projectRotoRecordsForPersistence(realKeyRecords, resolveRef);
  const persistedGroupOverrideRecords = _projectRotoRecordsForPersistence(groupOverrideRecords, resolveRef);
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
    realKeyRecords: persistedRealKeyRecords,
    groupOverrideRecords: persistedGroupOverrideRecords,
    interpolation,
    scriptMotion: _rotoPhysicalScriptMotion.get(layerId)?.get(trackId) ?? PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO,
    background: _rotoBackgroundMetadata.get(layerId)?.get(trackId) ?? null,
    selectedKeyId,
    cursorAppFrame,
    revision: buildPhysicPaintRotoPhysicalRevision(
      persistedRealKeyRecords,
      interpolation,
      loopClips,
      incomingInterpolationBreakKeyIds,
      persistedGroupOverrideRecords,
    ),
    loopClips,
    incomingInterpolationBreakKeyIds,
  });
}

// ---------------------------------------------------------------------------
// 46-03 TRK-04: track-scoped copy/cut/paste/duplicate/clear result contracts.
// Every op takes an explicit trackId and routes only through the 46-01
// per-track maps (ROADMAP SC 4). Paste results surface the pure engine's
// closed failures (including the D-06 un-re-pointable Hold rejection).
// ---------------------------------------------------------------------------

export type RotoTrackSelectionFailureReason =
  | 'track-missing'
  | 'missing-key'
  | 'partial-loop-overlap'
  | 'apply-failed'
  // 52.2-06 (T-52.2-20): a pasted/duplicated key whose pixels are not in the
  // runtime (reference-only record) cannot publish a frame — refusal, never an
  // invisible `width: 0` key.
  | 'unresolved-key-pixels'
  | RotoRailSetPasteFailureReason
  | 'empty-set'
  | 'malformed-member'
  | 'stale-member';

export type RotoTrackCopyResult =
  | { ok: true; payload: RotoRailSetCopyPayload }
  | { ok: false; reason: RotoTrackSelectionFailureReason };

export type RotoTrackPasteResult =
  | { ok: true; impact: RotoRailSetPasteImpact }
  | { ok: false; reason: RotoTrackSelectionFailureReason };

export type RotoTrackClearResult =
  | { ok: true }
  | { ok: false; reason: RotoTrackSelectionFailureReason };

/** 48-05: the empty exclusion set — the including path (byte-identical to 48-03). */
const EMPTY_EXCLUDED_TRACKS: ReadonlySet<string> = new Set();

/**
 * 49-06 (UAT round 6): the runtime background source-bytes state for ONE
 * document — `ref:length:prefix` per distinct ref (sorted), `missing` when the
 * ref has no registered bytes. The flattened key's clip terms don't cover
 * runtime bytes, so a source that arrives AFTER the first composite would leave
 * the key stable and the monitor's compare-then-draw guard would skip the
 * redraw (the paper-fond symptom). This term rotates the key exactly when a
 * ref's bytes change. Per-document (only the refs this document's clips use),
 * so registering a source for another layer never churns this layer's cache.
 */
function _backgroundSourceRevision(document: EfxPaintDocument): string {
  const refs = new Set<string>();
  for (const clip of document.background.clips) {
    for (const ref of clip.sourceFrameRefs) refs.add(ref);
  }
  return [...refs].sort().map((ref) => {
    const bytes = _backgroundSourceImages.get(ref);
    return bytes === undefined ? `${ref}:missing` : `${ref}:${buildFrameBytesToken(bytes)}`;
  }).join('|');
}

/**
 * 50-02 Task 2: the runtime reference source-bytes state for ONE document —
 * `ref:length:prefix` per source ref IN ORDER (the order is meaningful: frame N
 * → refs[N], D-15), `missing` when the ref has no registered bytes. A null
 * track contributes an empty term. This term is the deterministic revision the
 * ghost overlay and the band tooltip consume to detect a source/dataUrl change
 * (REF-04). Exported as a test seam (underscore-prefixed, like
 * `_setEfxPaintMarkDirtyCallback`).
 */
export function _referenceSourceRevision(document: EfxPaintDocument): string {
  const track = document.photoReference;
  if (track === null) return '';
  return track.sourceFrameRefs.map((ref) => {
    const bytes = _referenceSourceImages.get(ref);
    return bytes === undefined ? `${ref}:missing` : `${ref}:${buildFrameBytesToken(bytes)}`;
  }).join('|');
}

/**
 * 48-03 D-11/CMP-01 + 48-05 D-05: one flattened straight-alpha raster per
 * (layerId, frame) over the participating set EXCLUDING `excludeTrackIds`
 * (empty set = the full participating set). Guard-first; on success the
 * flattened memo (D-08/CMP-04) is consulted by the derived key (config +
 * participating-only track content + background revision + sorted clip terms +
 * exclusion term + frame); a hit returns the frozen cached record with zero
 * recompute. On miss, every participating track AND the background are
 * pre-resolved BEFORE the flattened canvas is allocated: any pending decode
 * returns null this tick (Tests 7/10). The record carries the missing-source
 * report (D-09) — never placeholder pixels. The exclusion threads through the
 * compositor ports (never by rewriting the document) so the editing base's
 * participating set is filtered identically in the pure pipeline.
 */
function _resolveFlattenedFrame(
  layerId: string,
  frame: number,
  excludeTrackIds: ReadonlySet<string>,
  includeFond = true,
): EfxPaintFlattenedFrameRecord | null {
  if (!Number.isInteger(frame) || frame < 0) return null;
  const efxDocument = getEfxPaintDocument(layerId);
  if (!efxDocument) return null;
  // 260920-k34: the fond resolution is NOT a flattened-key term (activeTrackId
  // is absent from the key) — rotate the layer's memo BEFORE the lookup when
  // the resolved fond changed, so an active-track switch never serves the
  // previous track's paper.
  _rotateFlattenedMemoOnFondChange(layerId, efxDocument);
  const size = _compositorSizeProvider?.() ?? FALLBACK_COMPOSITE_SIZE;

  const participating = participatingPaintTracks(efxDocument)
    .filter((track) => !excludeTrackIds.has(track.id));
  const trackContentRevisions = new Map<string, string>();
  for (const track of participating) {
    const revision = _trackContentRevision(layerId, track.id, frame);
    if (revision !== null) trackContentRevisions.set(track.id, revision);
  }
  // 49-06 (UAT round 9): the clip term MUST cover startFrame + repeat too —
  // `clip.revision` is only bumped by setBackgroundClipSource, so a move or
  // resize left the flattened key stable, the memo served a stale record, and
  // the monitor's compare-then-draw guard skipped the redraw (the "image
  // renders on some frames of the rail but not others" regression).
  const backgroundClipRevisions = efxDocument.background.clips.map((clip) => {
    const repeatTerm = clip.repeat.mode === 'infinite' ? 'inf' : `x${clip.repeat.count}`;
    const scale = clip.scale ?? { x: 100, y: 100 };
    return `${clip.id}:${clip.startFrame}:${repeatTerm}:${scale.x}:${scale.y}:${clip.revision}`;
  });
  const flattenedKey = deriveEfxPaintFlattenedCacheKey({
    document: efxDocument,
    trackContentRevisions,
    backgroundClipRevisions,
    backgroundSourceRevision: _backgroundSourceRevision(efxDocument),
    frame,
    excludeTrackIds: excludeTrackIds.size > 0 ? [...excludeTrackIds].sort() : undefined,
    includeFond,
  });

  const flattenedMemo = _getOrCreateCompositorMemo(_flattenedMemo, layerId);
  const cached = flattenedMemo.get(flattenedKey);
  if (cached) return cached;

  const trackRasterMemo = _getOrCreateCompositorMemo(_trackRasterMemo, layerId);
  const preResolved = new Map<string, EfxPaintTrackContentResolution>();
  for (const track of participating) {
    const resolution = _preResolveTrackContent(layerId, track.id, frame);
    if (resolution === null) return null;
    preResolved.set(track.id, resolution);
    const revision = trackContentRevisions.get(track.id);
    if (revision !== undefined) {
      trackRasterMemo.set(deriveEfxPaintTrackContentKey(track.id, revision, frame), resolution);
    }
  }

  const knownSources = new Set(_backgroundSourceImages.keys());
  let backgroundContext: PhysicPaintRotoLoopResolutionContext | null = null;
  if (backgroundParticipates(efxDocument)) {
    backgroundContext = deriveEfxPaintBackgroundResolution(efxDocument.background, BACKGROUND_RESOLUTION_CAPACITY);
    const backgroundResolution = resolveEfxPaintBackgroundFrame(backgroundContext, frame, knownSources);
    if (backgroundResolution.kind === 'content') {
      if (_resolveBackgroundSourceImage(backgroundResolution.sourceRef) === null) {
        return null;
      }
    }
  }

  const ports: EfxPaintCompositorPorts = {
    createCanvas: (width, height) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('_resolveFlattenedFrame: 2d rendering context unavailable');
      return { canvas, ctx };
    },
    resolveTrackContent: (trackId) => preResolved.get(trackId) ?? { kind: 'missing', missingRefs: [] },
    resolveBackgroundFrame: (targetFrame) => resolveEfxPaintBackgroundFrame(backgroundContext!, targetFrame, knownSources),
    resolveBackgroundSourceImage: (sourceRef) => _resolveBackgroundSourceImage(sourceRef),
    compositeOp: blendModeToCompositeOp,
    trackRasterMemo,
    trackContentRevisions,
    backgroundClipRevisions,
    excludeTrackIds,
  };

  const result = compositeFrame(efxDocument, frame, size, ports);
  // v1.0 rendering law (48-06 N1): the paper fond is the DOCUMENT FALLBACK —
  // like the solid-color fallback (compositeFrame step 1, unconditional), it
  // draws beneath EVERY frame's composite whenever a non-transparent paper
  // metadata exists, including frames no Paint track covers (an empty Bg row
  // still renders the configured background; 'transparent' metadata yields no
  // instruction and stays transparent). The D-09 missing-source report is
  // unaffected: missing track contributions stay transparent ON TOP of the
  // fond and still surface in `result.missing`.
  //
  // 48-06 (UAT-C): `includeFond=false` skips the fond step — the Studio's
  // program monitor reads the fond-less composite because the paper is drawn
  // on a SEPARATE layer beneath an isolated tracks group (the active track's
  // CSS blend must never meet the paper). The `fond:0` key term keeps the two
  // variants in distinct memo entries.
  const fondInstruction = includeFond ? _resolveDocumentFondInstruction(layerId, efxDocument) : null;
  let raster = result.raster as HTMLCanvasElement;
  if (fondInstruction) {
    // The fond pixel-matches the engine's own paper draw (white + tiled
    // texture at 0.18) when the texture is resolved; while the texture loads
    // the deterministic color-fill fallback draws instead, and the texture
    // subscription below rotates the flattened memo + bumps the paint clock
    // so every surface recomposites with the real texture on resolve.
    _ensureFondTextureSubscription(fondInstruction.paperTexture);
    const fondPaperCanvas = getProjectPaperCanvas(fondInstruction.paperTexture, size.width, size.height);
    const fondCanvas = document.createElement('canvas');
    fondCanvas.width = size.width;
    fondCanvas.height = size.height;
    const fondCtx = fondCanvas.getContext('2d');
    if (!fondCtx) throw new Error('_resolveFlattenedFrame: 2d rendering context unavailable');
    drawMissingRotoBackground(fondCtx, fondInstruction, size.width, size.height, null, fondPaperCanvas);
    fondCtx.drawImage(result.raster, 0, 0);
    raster = fondCanvas;
  }
  // G-52-8 (FIX 4): the record carries the raster; draw surfaces consume it
  // directly. The WebP encode is async (Rust codec) and memoized on first call
  // via encodeBytes() — transport/serialization readers (bridge, export, tests)
  // await it. The memoized Promise survives Object.freeze.
  let encodedBytesPromise: Promise<Uint8Array> | null = null;
  const record: EfxPaintFlattenedFrameRecord = Object.freeze({
    layerId,
    frame,
    cacheKey: flattenedKey,
    raster,
    renderedFrame: Object.freeze({
      frameIndex: frame,
      appFrame: frame,
      bytes: new Uint8Array(0),
      width: size.width,
      height: size.height,
    }),
    encodeBytes: () => {
      if (encodedBytesPromise === null) encodedBytesPromise = encodeCanvasAsWebp(raster);
      return encodedBytesPromise;
    },
    missing: result.missing,
  });
  flattenedMemo.set(flattenedKey, record);
  return record;
}

export const physicPaintStore = {
  getFrame(layerId: string, trackId: string, frame: number): PhysicPaintRenderedFrame | null {
    return _frames.get(layerId)?.get(trackId)?.get(frame) ?? null;
  },

  /**
   * 49-06 (UAT round 9): the runtime dataUrl for one Background source ref —
   * the Bg rail's filmstrip cells read it to paint the source image instead of
   * the neutral fill. Null when the ref has no registered bytes (the clip
   * hasn't hydrated yet, or the ref is dangling).
   */
  getBackgroundSourceImageBytes(sourceRef: string): Uint8Array | null {
    return _backgroundSourceImages.get(sourceRef) ?? null;
  },

  /**
   * 52.1 (D-06): memoized Blob URL for one Background source ref — the Bg
   * rail's filmstrip cells paint it via <img src>. The URL is derived from
   * the registered bytes (never a data: URL) and memoized per ref+token;
   * replaced (old URL revoked) when the bytes change. Absorbed by the LRU
   * in Plan 04.
   */
  getBackgroundSourceImageUrl(sourceRef: string): string | null {
    const bytes = _backgroundSourceImages.get(sourceRef);
    if (!bytes) return null;
    const token = buildFrameBytesToken(bytes);
    const key = `${sourceRef}:${token}`;
    const cached = _backgroundSourceImageUrls.get(key);
    if (cached) return cached;
    const url = URL.createObjectURL(new Blob([bytes.slice()], { type: 'image/webp' }));
    _backgroundSourceImageUrls.set(key, url);
    return url;
  },

  /**
   * 48-03 D-11/CMP-01: the full flattened composite (see
   * {@link _resolveFlattenedFrame}). `includeFond` (default true) controls
   * whether the record carries the document paper fond; the Studio monitor
   * passes false (the fond lives on its own layer beneath the isolated tracks
   * group, 48-06 UAT-C).
   */
  getFlattenedFrame(layerId: string, frame: number, includeFond = true): EfxPaintFlattenedFrameRecord | null {
    return _resolveFlattenedFrame(layerId, frame, EMPTY_EXCLUDED_TRACKS, includeFond);
  },

  /**
   * 48-05 D-05: the Studio editing base — the flattened composite over the
   * participating set EXCLUDING the engine-supplied tracks (`excludeTrackIds`,
   * the live engine canvas stacked above supplies their pixels). Same seam as
   * {@link getFlattenedFrame}; the exclude set threads through the compositor
   * ports and the flattened cache key (its own `excl:` term), so an including
   * and an excluding call for the same frame never share a cache entry.
   */
  getFlattenedFrameExcluding(
    layerId: string,
    frame: number,
    excludeTrackIds: ReadonlySet<string>,
    includeFond = true,
  ): EfxPaintFlattenedFrameRecord | null {
    return _resolveFlattenedFrame(layerId, frame, excludeTrackIds, includeFond);
  },

  /**
   * 49-03 (D-11 consumption half), resolution half superseded by 260920-k34
   * (53-CONTEXT D-09): the monitor's fond — the SAME resolved instruction the
   * flattened path uses (one authority, two consumers, Pitfall 1). The Studio
   * monitor fond layer and the flattened parent output can never disagree.
   * Returns null when the resolution yields no fond (the active track's paper is
   * transparent, the document fallback is transparent) or the layer has no
   * document.
   */
  getDocumentFondInstruction(layerId: string): Extract<MissingRotoFrameDrawInstruction, { kind: 'background-only' }> | null {
    const efxDocument = getEfxPaintDocument(layerId);
    if (!efxDocument) return null;
    return _resolveDocumentFondInstruction(layerId, efxDocument);
  },

  /**
   * 260920-k34 (53-CONTEXT D-09): the preload gate's texture. Resolves through
   * the SAME `_resolveFondSource` the flattened draw consumes — no second read,
   * no parallel switch, so the gate and the draw cannot disagree by
   * construction. Returns the paper texture name for a paper source and null
   * otherwise (a solid/absent fond, or the layer has no document). Callers keep
   * the `startsWith('canvas')` filter: `'white'` carries no paper texture.
   */
  getFondPaperTexture(layerId: string): string | null {
    const efxDocument = getEfxPaintDocument(layerId);
    if (!efxDocument) return null;
    const source = _resolveFondSource(layerId, efxDocument);
    return source?.kind === 'paper' ? source.metadata.background : null;
  },

  /**
   * 49-03 (D-12): the background frame verdict for the monitor's checkerboard
   * decision — content / gap / missing for one application frame against the
   * document's background clips. Consumes the SAME already-resolved resolution
   * plumbing the flattened path uses (deriveEfxPaintBackgroundResolution +
   * resolveEfxPaintBackgroundFrame with the runtime known-source set), never a
   * re-resolution. Gap = no clip covers the frame (the fallback shows).
   */
  getBackgroundFrameVerdict(layerId: string, frame: number): 'content' | 'gap' | 'missing' {
    const efxDocument = getEfxPaintDocument(layerId);
    if (!efxDocument) return 'gap';
    const context = deriveEfxPaintBackgroundResolution(efxDocument.background, BACKGROUND_RESOLUTION_CAPACITY);
    return resolveEfxPaintBackgroundFrame(context, frame, new Set(_backgroundSourceImages.keys())).kind;
  },

  /**
   * 50-02 Task 2: the frame-aligned reference source verdict for the ghost draw
   * path (Plan 50-04) and the band tooltip. Returns null when the layer has no
   * document, no photo reference track, or the resolved source ref is missing
   * (D-04 fail-closed).
   */
  getReferenceSourceFrameVerdict(layerId: string, frame: number): ReferenceSourceFrameVerdict | null {
    const efxDocument = getEfxPaintDocument(layerId);
    if (!efxDocument) return null;
    return _resolveReferenceSourceImage(efxDocument, frame);
  },

  /**
   * G-52-5: the shared decode-once image cache for monitor-surface consumers
   * (reference ghost draw, reference transform handles). Keyed by dataUrl, one
   * `new Image()` decode per unique source EVER — a cached redraw is a plain
   * canvas draw, so per-frame scrub redraws cost nothing. Returns null while
   * the decode is pending or failed; the onload/onerror bump of
   * physicPaintVersion re-fires the subscriber effects, which re-invoke and
   * draw (the _compositorDecode idiom — never a per-draw decode, MEMORY: image
   * decode storms cause global slowness).
   */
  getDecodedImage(bytes: Uint8Array): ImageBitmap | null {
    return _compositorDecode(bytes);
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
    // Idempotence guard (47 leak fix): the Studio's settings-sync effect can
    // re-fire on unstable dep identities; a no-op write must not bump the
    // revision — the bump re-renders every version subscriber, which re-fires
    // the effect, which bumps again (a ~65/s render loop that OOM-killed the
    // paint window's WebContent process at 16 GB).
    const current = _rotoBackgroundMetadata.get(layerId)?.get(trackId);
    if (current
      && current.background === metadata.background
      && current.paperGrain === metadata.paperGrain
      && current.grainStrength === metadata.grainStrength
      && current.color === metadata.color) return;
    _getOrCreateLayerTrackMap(_rotoBackgroundMetadata, layerId).set(trackId, { ...metadata });
    // 48-03 T-48-07: paper metadata is NOT part of the flattened key (the key's
    // config/content/clip terms never cover it), so a paper change must rotate
    // the per-track raster AND the flattened memo — a stale paper composite must
    // not survive a settings update.
    _flattenedMemo.delete(layerId);
    _trackRasterMemo.delete(layerId);
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
   *
   * 52.2-06: `resolveRef` is the package-write caller's media authority (plan
   * 07's save funnel). Supplied, both roto collections are projected to media
   * references and an unresolved key throws; omitted, the live runtime records
   * pass through unchanged for the in-memory Studio projection.
   */
  extractRuntimeStateForDocument(
    layerId: string,
    trackId: string,
    resolveRef?: PhysicPaintRotoMediaReferenceResolver,
  ): EfxPaintRuntimeProjection {
    const frames = new Map(_frames.get(layerId)?.get(trackId) ?? []);
    return { trackId, frames, rotoPhysical: _buildRotoPhysicalDocumentForLayer(layerId, trackId, resolveRef) };
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
    if (payload.trackId !== trackId) {
      throw new Error(`EFX Paint runtime projection track "${payload.trackId}" does not match install target "${trackId}".`);
    }
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
      _assertRotoPhysicalDocumentCarriers(payload.rotoPhysical);
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
      // 52.2-06 (D-06): BOTH collections are projected to the runtime shape —
      // a reference-only record is rebuilt as a media-only record (no byte
      // buffer is allocated for pixels the package will supply), and the
      // group-override map is not a secondary concern.
      for (const record of toRuntimeRotoRecords(physical.realKeyRecords)) recordMap.set(record.keyId, record);
      const groupOverrideMap = new Map<string, PhysicPaintRotoRealKeyRecord>();
      for (const record of toRuntimeRotoRecords(physical.groupOverrideRecords ?? [])) groupOverrideMap.set(record.keyId, record);
      _getOrCreateLayerTrackMap(_rotoGroupOverrideRecords, layerId).set(trackId, groupOverrideMap);
      _getOrCreateLayerTrackMap(_rotoPhysicalInterpolationState, layerId).set(trackId, _retireFrameBlendingMode(physical.interpolation));
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
        bytes: payload.renderedFrame.bytes,
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
      this.upsertRealRotoKeyFrame(payload.layerId, payload.trackId, payload.sourceFrame ?? payload.startFrame, { ...payload.renderedFrame, ...(payload.onionBytes ? { onionBytes: payload.onionBytes } : {}) }, payload.backgroundOnly === true);
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
    for (const token of _getTrackBytesTokens(layerId, trackId)) {
      const canvas = rotoAlphaCanvasRegistry.get(token);
      if (canvas) alphaCanvases.push([token, canvas]);
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
    for (const token of _getTrackBytesTokens(layerId, trackId)) {
      rotoAlphaCanvasRegistry.delete(token);
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
    for (const [token, canvas] of snapshot.alphaCanvases) {
      if (!rotoAlphaCanvasRegistry.has(token)) rotoAlphaCanvasRegistry.set(token, canvas);
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
    if (_frames.size === 0 && _rotoBackgroundMetadata.size === 0 && _rotoCacheMetadata.size === 0 && _rotoGeneratedCacheMetadata.size === 0 && _generatedRenderSourceCache.size === 0 && _rotoInterpolationSettings.size === 0 && _rotoInterpolationFailureStatus.size === 0 && (!resetAlphaCanvases || rotoAlphaCanvasRegistry.size === 0) && _rotoRealKeyRecords.size === 0 && _rotoGroupOverrideRecords.size === 0 && _rotoPhysicalInterpolationState.size === 0 && _rotoPhysicalScriptMotion.size === 0 && _rotoPhysicalLoopClips.size === 0 && _rotoPhysicalSelectedKeyId.size === 0 && _rotoPhysicalCursorAppFrame.size === 0 && _rotoPhysicalCapacity.size === 0 && _rotoPlaybackSettings.size === 0 && _rotoPhysicalOperationLeases.size === 0 && _settledRotoPhysicalOperationLeases.size === 0 && _flattenedMemo.size === 0 && _trackRasterMemo.size === 0 && _flattenedFondSignatures.size === 0 && _compositorDecodeLoading.size === 0 && _compositorDecodePromises.size === 0 && _frameMediaVerdicts.size === 0 && _frameMediaResolutionPromises.size === 0 && _frameMediaBytes.size === 0 && frameLru.byteTotal === 0 && _backgroundSourceImages.size === 0 && _referenceSourceImages.size === 0 && trackRevisions.size === 0) return;
    _frames.clear();
    _rotoBackgroundMetadata.clear();
    _rotoCacheMetadata.clear();
    _rotoGeneratedCacheMetadata.clear();
    _generatedRenderSourceCache.clear();
    _generatedRenderSourceCacheBytes = 0;
    _rotoInterpolationSettings.clear();
    _rotoInterpolationFailureStatus.clear();
    if (resetAlphaCanvases) rotoAlphaCanvasRegistry.clear();
    for (const url of _backgroundSourceImageUrls.values()) URL.revokeObjectURL(url);
    _backgroundSourceImageUrls.clear();
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
    // 48-03: the flattened compositor state is session runtime — wiped with the
    // rest of the store (decode caches clear here only, per the plan).
    _flattenedMemo.clear();
    _trackRasterMemo.clear();
    _flattenedFondSignatures.clear();
    _compositorDecodeLoading.clear();
    _compositorDecodePromises.clear();
    // 52.2-09 Task 3: the media verdicts are per-session runtime state too — a
    // verdict recorded for a previous project's digest must not silence a read
    // in the next one.
    _frameMediaVerdicts.clear();
    _frameMediaResolutionPromises.clear();
    // 52.2-10 (D-12): bridged bytes are a claim about THIS session's window
    // pair; a new project must not inherit them.
    _frameMediaBytes.clear();
    frameLru.clear();
    _backgroundSourceImages.clear();
    _referenceSourceImages.clear();
    trackRevisions.clear();
    _notifyVisualChange();
  },

  pruneUnreferencedRotoAlphaCanvases(tokens: Iterable<string>): void {
    _pruneUnreferencedRotoAlphaCanvases(tokens);
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
    const nextInterpolation = _retireFrameBlendingMode(interpolation);

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
      interpolationEnabled: nextInterpolation.enabled,
      incomingInterpolationBreakKeyIds: currentIncomingBreaks,
    });
    if (!projectionResult.ok) {
      return { ok: false, error: projectionResult.failure.text };
    }

    const previousRecords = this.getRotoRealKeyRecords(layerId, trackId);
    const previousPayloadTokens = _getTrackBytesTokens(layerId, trackId);
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
      nextInterpolation,
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
      enabled: nextInterpolation.enabled,
      mode: nextInterpolation.mode,
    }) as PhysicPaintRotoInterpolationState);
    if (!_rotoPhysicalScriptMotion.get(layerId)?.has(trackId)) _getOrCreateLayerTrackMap(_rotoPhysicalScriptMotion, layerId).set(trackId, PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO);
    const previousSelectedKeyId = _rotoPhysicalSelectedKeyId.get(layerId)?.get(trackId) ?? null;
    const selectedRecord = previousSelectedKeyId === null ? null : recordMap.get(previousSelectedKeyId) ?? null;
    _getOrCreateLayerTrackMap(_rotoPhysicalSelectedKeyId, layerId).set(trackId, selectedRecord?.keyId ?? null);
    _getOrCreateLayerTrackMap(_rotoPhysicalCursorAppFrame, layerId).set(trackId, selectedRecord?.appFrame ?? Math.min(_rotoPhysicalCursorAppFrame.get(layerId)?.get(trackId) ?? 0, capacity - 1));
    _getOrCreateLayerTrackMap(_rotoPhysicalCapacity, layerId).set(trackId, capacity);
    _pruneUnreferencedRotoAlphaCanvases(previousPayloadTokens);
    rotoPhysicalRevision.value = rotoPhysicalRevision.value + 1;
    bumpTrackRevision(layerId, trackId);
    return { ok: true };
  },

  /** Acquire the sole project/layer/track authority token for one physical operation. */
  acquireRotoPhysicalOperationLease(
    projectContextId: string,
    layerId: string,
    trackId: string,
  ): PhysicPaintRotoPhysicalOperationLeaseToken | null {
    if (!projectContextId || !layerId || !trackId) return null;
    const scope = _rotoPhysicalOperationLeaseScope(projectContextId, layerId, trackId);
    if (_rotoPhysicalOperationLeases.has(scope)) return null;
    const token = Object.freeze({
      projectContextId,
      layerId,
      trackId,
      generation: ++_rotoPhysicalOperationLeaseGeneration,
      owner: 'exclusive' as const,
    });
    _rotoPhysicalOperationLeases.set(scope, token);
    _notifyRotoPhysicalOperationLeaseChange();
    return token;
  },

  /** Whether the project/layer/track scope currently accepts a new physical mutator. */
  isRotoPhysicalOperationAvailable(projectContextId: string, layerId: string, trackId: string): boolean {
    if (!projectContextId || !layerId || !trackId) return false;
    return !_rotoPhysicalOperationLeases.has(
      _rotoPhysicalOperationLeaseScope(projectContextId, layerId, trackId),
    );
  },

  /** Atomically transfer an exact exclusive to cleanup/recovery ownership. */
  transferRotoPhysicalOperationLeaseToRecovery(
    token: PhysicPaintRotoPhysicalOperationLeaseToken,
  ): PhysicPaintRotoPhysicalOperationLeaseToken | null {
    if (token.owner !== 'exclusive') return null;
    const scope = _rotoPhysicalOperationLeaseScope(token.projectContextId, token.layerId, token.trackId);
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
    if (!descriptor.projectContextId || !descriptor.layerId || !descriptor.trackId
      || !Number.isSafeInteger(descriptor.generation) || descriptor.generation < 1) return null;
    const scope = _rotoPhysicalOperationLeaseScope(descriptor.projectContextId, descriptor.layerId, descriptor.trackId);
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

  /** Validate a exact active-token identity without mutating lease state. */
  validateRotoPhysicalOperationLease(
    projectContextId: string,
    layerId: string,
    trackId: string,
    token: PhysicPaintRotoPhysicalOperationLeaseToken | null | undefined,
  ): { ok: true } | { ok: false; reason: PhysicPaintRotoPhysicalOperationLeaseFailureReason } {
    if (!token) return { ok: false, reason: 'missing-token' };
    if (_settledRotoPhysicalOperationLeases.has(_rotoPhysicalOperationLeaseIdentity(token))) {
      return { ok: false, reason: 'replayed-token' };
    }
    const active = _rotoPhysicalOperationLeases.get(_rotoPhysicalOperationLeaseScope(projectContextId, layerId, trackId));
    if (!active || !_sameRotoPhysicalOperationLease(active, token)) {
      return { ok: false, reason: 'mismatched-token' };
    }
    return { ok: true };
  },

  /** Release one exact active token after terminal settlement. */
  releaseRotoPhysicalOperationLease(token: PhysicPaintRotoPhysicalOperationLeaseToken): boolean {
    const scope = _rotoPhysicalOperationLeaseScope(token.projectContextId, token.layerId, token.trackId);
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
    const leaseValidation = _validateRotoPhysicalLayerPublication(layerId, trackId, leaseToken);
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

    const previousPayloadTokens = _getTrackBytesTokens(layerId, trackId);
    _getOrCreateLayerTrackMap(_rotoRealKeyRecords, layerId).set(
      trackId,
      new Map(document.realKeyRecords.map((record) => [record.keyId, record])),
    );
    _getOrCreateLayerTrackMap(_rotoGroupOverrideRecords, layerId).set(
      trackId,
      new Map((document.groupOverrideRecords ?? []).map((record) => [record.keyId, record])),
    );
    _getOrCreateLayerTrackMap(_rotoPhysicalInterpolationState, layerId).set(trackId, _retireFrameBlendingMode(document.interpolation));
    _getOrCreateLayerTrackMap(_rotoPhysicalScriptMotion, layerId).set(trackId, document.scriptMotion);
    _getOrCreateLayerTrackMap(_rotoPhysicalLoopClips, layerId).set(trackId, document.loopClips);
    _getOrCreateLayerTrackMap(_rotoPhysicalIncomingInterpolationBreakKeyIds, layerId).set(trackId, document.incomingInterpolationBreakKeyIds);
    _getOrCreateLayerTrackMap(_rotoPhysicalSelectedKeyId, layerId).set(trackId, document.selectedKeyId);
    _getOrCreateLayerTrackMap(_rotoPhysicalCursorAppFrame, layerId).set(trackId, document.cursorAppFrame);
    _getOrCreateLayerTrackMap(_rotoPhysicalCapacity, layerId).set(trackId, document.capacity);
    if (document.background) _getOrCreateLayerTrackMap(_rotoBackgroundMetadata, layerId).set(trackId, { ...document.background });
    else _rotoBackgroundMetadata.get(layerId)?.delete(trackId);
    _rotoPhysicalStructuralCache.delete(_rotoPhysicalStructuralCacheKey(layerId, trackId));
    _pruneUnreferencedRotoAlphaCanvases(previousPayloadTokens);
    rotoPhysicalRevision.value = rotoPhysicalRevision.value + 1;
    bumpTrackRevision(layerId, trackId);
    return { ok: true, document };
  },

  /**
   * Mirror one track's physical document from the child window's live state
   * (47-01 UAT round 8). Identical to replaceRotoPhysicalDocument except it
   * never bumps revisions and never fires the project-dirty callback — the
   * parent's runtime is a passive mirror used by the save projection and the
   * apply validation, so a sync must not trigger auto-saves or re-renders
   * (round-7 regression: every document sync marked the project dirty and
   * auto-saved, corrupting saves mid-paint). Frames are preserved; the
   * structural memo is invalidated so the next read rebuilds with the new
   * records.
   */
  mirrorRotoPhysicalDocument(
    layerId: string,
    trackId: string,
    value: unknown,
  ): { ok: true; document: PhysicPaintRotoPhysicalDocument } | { ok: false; error: string } {
    if (!layerId || typeof layerId !== 'string') return { ok: false, error: 'Layer ID must be a non-empty string.' };
    const leaseValidation = _validateRotoPhysicalLayerPublication(layerId, trackId, undefined);
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

    const previousPayloadTokens = _getTrackBytesTokens(layerId, trackId);
    _getOrCreateLayerTrackMap(_rotoRealKeyRecords, layerId).set(
      trackId,
      new Map(document.realKeyRecords.map((record) => [record.keyId, record])),
    );
    _getOrCreateLayerTrackMap(_rotoGroupOverrideRecords, layerId).set(
      trackId,
      new Map((document.groupOverrideRecords ?? []).map((record) => [record.keyId, record])),
    );
    _getOrCreateLayerTrackMap(_rotoPhysicalInterpolationState, layerId).set(trackId, _retireFrameBlendingMode(document.interpolation));
    _getOrCreateLayerTrackMap(_rotoPhysicalScriptMotion, layerId).set(trackId, document.scriptMotion);
    _getOrCreateLayerTrackMap(_rotoPhysicalLoopClips, layerId).set(trackId, document.loopClips);
    _getOrCreateLayerTrackMap(_rotoPhysicalIncomingInterpolationBreakKeyIds, layerId).set(trackId, document.incomingInterpolationBreakKeyIds);
    _getOrCreateLayerTrackMap(_rotoPhysicalSelectedKeyId, layerId).set(trackId, document.selectedKeyId);
    _getOrCreateLayerTrackMap(_rotoPhysicalCursorAppFrame, layerId).set(trackId, document.cursorAppFrame);
    _getOrCreateLayerTrackMap(_rotoPhysicalCapacity, layerId).set(trackId, document.capacity);
    if (document.background) _getOrCreateLayerTrackMap(_rotoBackgroundMetadata, layerId).set(trackId, { ...document.background });
    else _rotoBackgroundMetadata.get(layerId)?.delete(trackId);
    _rotoPhysicalStructuralCache.delete(_rotoPhysicalStructuralCacheKey(layerId, trackId));
    _pruneUnreferencedRotoAlphaCanvases(previousPayloadTokens);
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

  /**
   * debug studio-reopen-empty-boot (2026-09-21): the LAUNCH-DOOR read half of
   * the D-13 read-back pair, the launch-leg sibling of the open leg's
   * `materializePackageRotoMediaBytes`. The docSync receiver mirrors the
   * child's persisted-shape document (media references, no pixels) into THIS
   * runtime on every accepted push (physicPaintBridge mirror loop), so at the
   * next launch the runtime records can be reference-only — while the
   * launch-context pack is a declared byte-requiring consumer
   * (`efxPaintMediaMaterialize.ts`). This method re-attaches the bytes BEFORE
   * any launch projection reads the runtime:
   *
   *   1. bridged bytes already held for the digest (`_frameMediaBytes`) — in
   *      memory, no IO, never destroyed by this read;
   *   2. otherwise the package root (`_packageDirProvider`) + the
   *      digest-verified native read (`resolveFrameMediaBytes`);
   *   3. otherwise a per-key failure, never a throw: the record stays
   *      reference-only for the caller to log loudly, and the child's tolerant
   *      launch seed renders it as missing content instead of refusing the
   *      boot (quick-260913-52r G doctrine).
   *
   * Installs through the mirror door on purpose: no revision bump, no dirty,
   * no auto-save — the parent runtime stays passive. A lease-held track that
   * refuses the install is reported and skipped; every other track still
   * heals.
   */
  async materializeRuntimeRotoMediaBytes(layerId: string): Promise<readonly FrameMediaMaterializeFailure[]> {
    const failures: FrameMediaMaterializeFailure[] = [];
    if (!layerId || typeof layerId !== 'string') return Object.freeze(failures);
    const trackIds = Array.from(_rotoRealKeyRecords.get(layerId)?.keys() ?? []);
    for (const trackId of trackIds) {
      const physical = this.getRotoPhysicalDocument(layerId, trackId);
      if (!physical) continue;
      let changed = false;
      const heal = async (
        records: readonly PhysicPaintRotoRealKeyRecord[],
        collection: 'real-key' | 'group-override',
      ): Promise<PhysicPaintRotoRealKeyRecord[]> => {
        const healed: PhysicPaintRotoRealKeyRecord[] = [];
        for (const record of records) {
          const media = record.payload.media;
          if (media === undefined || record.payload.bytes !== undefined) {
            healed.push(record);
            continue;
          }
          const bridged = _frameMediaBytes.get(media.digest);
          if (bridged !== undefined) {
            changed = true;
            healed.push(Object.freeze({
              kind: 'real-key' as const,
              keyId: record.keyId,
              appFrame: record.appFrame,
              payload: Object.freeze(buildBytesPayload(record, bridged)),
            }));
            continue;
          }
          const packageDir = _packageDirProvider?.() ?? null;
          if (packageDir === null) {
            failures.push(Object.freeze({
              layerId,
              trackId,
              collection,
              keyId: record.keyId,
              relativePath: media.relativePath,
              reason: 'no-package-root',
            }));
            healed.push(record);
            continue;
          }
          let resolved;
          try {
            resolved = await resolveFrameMediaBytes(packageDir, media);
          } catch {
            failures.push(Object.freeze({
              layerId,
              trackId,
              collection,
              keyId: record.keyId,
              relativePath: media.relativePath,
              reason: 'io',
            }));
            healed.push(record);
            continue;
          }
          if (resolved.kind !== 'bytes') {
            failures.push(Object.freeze({
              layerId,
              trackId,
              collection,
              keyId: record.keyId,
              relativePath: media.relativePath,
              reason: resolved.kind === 'missing' ? 'missing' : resolved.reason,
            }));
            healed.push(record);
            continue;
          }
          changed = true;
          healed.push(Object.freeze({
            kind: 'real-key' as const,
            keyId: record.keyId,
            appFrame: record.appFrame,
            payload: Object.freeze(buildBytesPayload(record, resolved.bytes)),
          }));
        }
        return healed;
      };
      const realKeyRecords = await heal(physical.realKeyRecords, 'real-key');
      const groupOverrideRecords = await heal(physical.groupOverrideRecords ?? [], 'group-override');
      if (!changed) continue;
      const healed: PhysicPaintRotoPhysicalDocument = {
        ...physical,
        realKeyRecords,
        groupOverrideRecords,
        // The revision fingerprint covers the raster carriers, so the healed
        // collections need their own revision — the same law the open leg's
        // materialization applies.
        revision: buildPhysicPaintRotoPhysicalRevision(
          realKeyRecords,
          physical.interpolation,
          physical.loopClips,
          physical.incomingInterpolationBreakKeyIds,
          groupOverrideRecords,
        ),
      };
      const installed = this.mirrorRotoPhysicalDocument(layerId, trackId, healed);
      if (!installed.ok) {
        console.warn(
          `[physicPaint] launch media materialization could not install layer "${layerId}" track "${trackId}": ${installed.error}. The launch carrier keeps this track's reference-only records.`,
        );
      }
    }
    return Object.freeze(failures);
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
   * 46-06 Task 3 (TRK-08 / D-13, T-46-16): fail-closed Hold clip refs
   * validation. A Hold clip's source refs are validated against the OWNING
   * track's real-key map only — never a cross-track lookup. An empty ref
   * list closes 'empty-source-refs'; any ref whose keyId is absent from the
   * track's own real-key map closes 'foreign-source-refs'. Callers (the
   * clip-replacement surface, 46-03 re-pointing as its second gate after
   * fresh-identity allocation) gate on this before any persist.
   */
  validateTrackHoldLoopClipRefs(
    layerId: string,
    trackId: string,
    clip: { readonly sourceFrameRefs: readonly string[]; readonly sourceKind: string },
  ): { ok: true } | { ok: false; error: 'empty-source-refs' | 'foreign-source-refs' } {
    if (!Array.isArray(clip.sourceFrameRefs) || clip.sourceFrameRefs.length === 0) {
      return { ok: false, error: 'empty-source-refs' };
    }
    const recordMap = _rotoRealKeyRecords.get(layerId)?.get(trackId);
    for (const keyId of clip.sourceFrameRefs) {
      if (!recordMap?.has(keyId)) return { ok: false, error: 'foreign-source-refs' };
    }
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
    // 46-06 Task 3 (D-13, T-46-16): a Hold (static-mode) clip creation with
    // empty or foreign refs fails closed BEFORE parse-persist with the typed
    // reason — the owning track's own real-key map is the only authority
    // (ASVS V5). Only record-shaped elements are scanned; malformed elements
    // fall through to the parse's own error.
    if (Array.isArray(value)) {
      for (const candidate of value) {
        if (typeof candidate !== 'object' || candidate === null || candidate.mode !== 'static') continue;
        if (Array.isArray(candidate.sourceKeyIds)) {
          const refsCheck = this.validateTrackHoldLoopClipRefs(layerId, trackId, {
            sourceFrameRefs: candidate.sourceKeyIds,
            sourceKind: 'playscript-hold',
          });
          if (!refsCheck.ok) return { ok: false, error: refsCheck.error };
        }
      }
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
    const next = _retireFrameBlendingMode(state);
    const current = this.getRotoPhysicalInterpolationState(layerId, trackId);
    if (current.enabled === next.enabled && current.mode === next.mode) return { ok: true };
    _getOrCreateLayerTrackMap(_rotoPhysicalInterpolationState, layerId).set(trackId, Object.freeze({
      enabled: next.enabled,
      mode: next.mode,
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
   * 48-06 (UAT-D): the composite's content extent — the max end frame across
   * EVERY Paint track. Playback enumerates the flattened composite (CMP-01:
   * all participating tracks), so a single track's end truncates the range
   * whenever a sibling track carries longer content (keys/rails to 17 played
   * only 0-10 when the launch track ended at 10). Null when no track has
   * content (the playback start path treats null like an empty range).
   */
  getRotoPhysicalCompositeEndFrame(layerId: string): number | null {
    const document = getEfxPaintDocument(layerId);
    if (!document) return null;
    let end: number | null = null;
    for (const track of document.tracks) {
      const trackEnd = this.getRotoPhysicalEndFrame(layerId, track.id);
      if (trackEnd !== null) end = end === null ? trackEnd : Math.max(end, trackEnd);
    }
    return end;
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
   * Track-local Hold resolution context (46-06 Task 1 — TRK-02): the
   * provenance pair for one track's Loop Clip resolution — the trackId it was
   * assembled from and the memoized per-track context built exclusively from
   * that track's own maps. Never a context assembled from two tracks: the
   * shared resolver answers with this context alone.
   */
  getTrackRotoResolutionContext(
    layerId: string,
    trackId: string,
  ): { readonly trackId: string; readonly context: PhysicPaintRotoLoopResolutionContext } | null {
    const structural = _resolveRotoPhysicalStructural(layerId, trackId);
    if (!structural) return null;
    return { trackId, context: structural.loopResolution };
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
        const group = structural.loopClips.find((candidate) => candidate.loopId === lifecycleTarget.groupId);
        if (!group) return null;
        const sourceCycleId = getPhysicsPaintRotoSourceCycleId(group.sourceKeyIds);
        const cacheRevision = `${contentRevision}:linked-generated:${interpolation.mode}:${sourceCycleId}:${left.keyId}:${right.keyId}:${lifecycleTarget.cycleOffset}`;
        const rendered = _getOrRenderGeneratedRotoFrame(cacheRevision, interpolation.mode, left, right, appFrame, lifecycleTarget.progress);
        if (!rendered) return null;
        const renderedFrame: PhysicPaintRotoRealKeyPayload = {
          frameIndex: rendered.frameIndex,
          appFrame,
          bytes: rendered.bytes,
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
          sourceCycleId,
          cycleOffset: lifecycleTarget.cycleOffset,
          contentRevision,
          cacheRevision,
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
      const distance = right.appFrame - left.appFrame;
      const cacheRevision = `${contentRevision}:generated:${interpolation.mode}:${left.keyId}:${right.keyId}:${appFrame}`;
      const rendered = _getOrRenderGeneratedRotoFrame(cacheRevision, interpolation.mode, left, right, appFrame, (appFrame - left.appFrame) / distance);
      if (!rendered) return null;
      const renderedFrame: PhysicPaintRotoRealKeyPayload = {
        frameIndex: rendered.frameIndex,
        appFrame,
        bytes: rendered.bytes,
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
        cacheRevision,
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
        // Cycle-local identity: equivalent source cycles share generated
        // cache entries across repeat destinations and Loop Clip instances,
        // while distinct ordered cycles cannot collide on one adjacent pair.
        const cacheRevision = `${contentRevision}:linked-generated:${interpolation.mode}:${resolution.sourceCycleId}:${left.keyId}:${right.keyId}:${resolution.cycleOffset}`;
        const rendered = _getOrRenderGeneratedRotoFrame(cacheRevision, interpolation.mode, left, right, appFrame, resolution.progress);
        if (!rendered) return null;
        const renderedFrame: PhysicPaintRotoRealKeyPayload = {
          frameIndex: rendered.frameIndex,
          appFrame,
          bytes: rendered.bytes,
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
          cacheRevision,
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
    const leaseValidation = _validateRotoPhysicalLayerPublication(layerId, trackId, leaseToken);
    if (!leaseValidation.ok) return { ok: false, error: leaseValidation.reason };
    const currentRevision = this.getRotoPhysicalContentRevision(layerId, trackId);
    const current = _rotoRealKeyRecords.get(layerId)?.get(trackId)?.get(keyId) ?? null;
    const reject = (error: string): { ok: false; error: string } => {
      _pruneUnreferencedRotoAlphaCanvases([buildPhysicPaintRotoPayloadContentToken(payload)]);
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
    _pruneUnreferencedRotoAlphaCanvases([buildPhysicPaintRotoPayloadContentToken(current.payload)]);
    rotoPhysicalRevision.value = rotoPhysicalRevision.value + 1;
    bumpTrackRevision(layerId, trackId, diagnostics);
    return { ok: true, changed: true, contentRevision: nextRevision };
  },

  /**
   * Clear the physical record ownership for a track. Used during track
   * replacement/disposal.
   */
  clearRotoPhysicalRecords(layerId: string, trackId: string): void {
    const previousPayloadTokens = _getTrackBytesTokens(layerId, trackId);
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
    _pruneUnreferencedRotoAlphaCanvases(previousPayloadTokens);
  },

  // -------------------------------------------------------------------------
  // 46-03 TRK-04: track-scoped copy/cut/paste/duplicate/clear. Every op takes
  // an explicit trackId and routes only through the 46-01 per-track maps.
  // Paste reuses the pure rail-set engine (one shared law): fresh identities
  // per D-05, cross-track Hold re-pointing fail-closed per D-06, deep-copied
  // assets per D-07. The clipboard payload freezes at the copy moment and is
  // applied with copy-on-write bytes (RED 2b).
  // -------------------------------------------------------------------------

  /** Freeze a rail-set clipboard payload for the exact track (46-03 D-05/D-06). */
  copyTrackSelection(layerId: string, trackId: string, keyIds: readonly string[]): RotoTrackCopyResult {
    if (!layerId || !trackId) return { ok: false, reason: 'track-missing' };
    const document = this.getRotoPhysicalDocument(layerId, trackId);
    if (!document) return { ok: false, reason: 'track-missing' };
    if (!Array.isArray(keyIds) || keyIds.length === 0) return { ok: false, reason: 'empty-set' };
    const keyIdSet = new Set(keyIds);
    for (const keyId of keyIds) {
      if (!document.realKeyRecords.some((record) => record.keyId === keyId)) {
        return { ok: false, reason: 'missing-key' };
      }
    }
    // Key-rail members: ONE member per Key Rail segment that contains a
    // selected key (the engine addresses rails by their segment firstKeyId and
    // carries the whole segment — dedupe or the same rail would be emitted once
    // per selected key and its entries duplicated). Plus every Loop Clip whose
    // source frames are fully covered by the selection (Loop clips travel with
    // their frames; a copy is non-destructive so partially-covered loops are
    // simply not carried).
    const segments = deriveKeyRailSegments({
      orderedRealKeys: document.realKeyRecords,
      incomingInterpolationBreakKeyIds: new Set(document.incomingInterpolationBreakKeyIds),
      groupOwnedKeyIds: new Set(),
    });
    const members: RailSetIdentity[] = segments
      .filter((segment) => segment.keyIds.some((keyId) => keyIdSet.has(keyId)))
      .map((segment) => ({ kind: 'key-rail' as const, firstKeyId: segment.firstKeyId }));
    for (const clip of document.loopClips) {
      if (clip.sourceKeyIds.length > 0 && clip.sourceKeyIds.every((sourceKeyId) => keyIdSet.has(sourceKeyId))) {
        members.push({ kind: 'loop', loopId: clip.loopId });
      }
    }
    const built = buildRotoRailSetCopyPayload({ document, members, trackId });
    return built.ok ? { ok: true, payload: built.payload } : { ok: false, reason: built.reason };
  },

  /** Copy + remove the selection from the source track (move = cut + paste, D-09). */
  cutTrackSelection(layerId: string, trackId: string, keyIds: readonly string[]): RotoTrackCopyResult {
    if (!layerId || !trackId) return { ok: false, reason: 'track-missing' };
    const document = this.getRotoPhysicalDocument(layerId, trackId);
    if (!document) return { ok: false, reason: 'track-missing' };
    if (!Array.isArray(keyIds) || keyIds.length === 0) return { ok: false, reason: 'empty-set' };
    const keyIdSet = new Set(keyIds);
    for (const keyId of keyIds) {
      if (!document.realKeyRecords.some((record) => record.keyId === keyId)) {
        return { ok: false, reason: 'missing-key' };
      }
    }
    // Never dangle: a Loop Clip touching ANY cut key must be fully inside the
    // cut set (all its source frames cut along), else the cut fails closed —
    // removing keys under a partially-overlapping Hold would leave a dangling
    // reference on the source (D-06).
    for (const clip of document.loopClips) {
      if (clip.sourceKeyIds.some((sourceKeyId) => keyIdSet.has(sourceKeyId))
        && (clip.sourceKeyIds.length === 0 || !clip.sourceKeyIds.every((sourceKeyId) => keyIdSet.has(sourceKeyId)))) {
        return { ok: false, reason: 'partial-loop-overlap' };
      }
    }
    const copied = this.copyTrackSelection(layerId, trackId, keyIds);
    if (!copied.ok) return copied;
    const carriedLoopIds = new Set(
      copied.payload.members.filter((member) => member.kind === 'loop').map((member) => member.loopId),
    );
    const removed = _applyRotoTrackSelectionRemoval(this, layerId, trackId, keyIdSet, carriedLoopIds);
    if (!removed.ok) return { ok: false, reason: 'apply-failed' };
    return { ok: true, payload: copied.payload };
  },

  /**
   * Paste a frozen clipboard payload into the exact target track (fresh
   * identities, D-05). The anchor defaults to the target track's cursor frame
   * (the UI paste rule); the caller can pin a frame explicitly (the move
   * primitive does — D-09 preserves timing). Cross-track payloads re-point
   * Hold sources or fail closed (D-06).
   */
  pasteTrackSelection(
    layerId: string,
    targetTrackId: string,
    payload: RotoRailSetCopyPayload,
    destinationAppFrame?: number,
  ): RotoTrackPasteResult {
    if (!layerId || !targetTrackId) return { ok: false, reason: 'track-missing' };
    const document = this.getRotoPhysicalDocument(layerId, targetTrackId);
    if (!document) return { ok: false, reason: 'track-missing' };
    const anchor = destinationAppFrame ?? document.cursorAppFrame;
    const pasted = proposeRails({
      document,
      payload,
      placementMode: 'paste',
      destinationAppFrame: anchor,
      targetTrackId,
    });
    if (!pasted.ok) return { ok: false, reason: pasted.reason };
    const applied = _applyRotoTrackPaste(this, layerId, targetTrackId, document, pasted.proposal);
    if (!applied.ok) return { ok: false, reason: applied.reason };
    return { ok: true, impact: pasted.impact };
  },

  /** Duplicate the frames at the given appFrames onto the same track (fresh identities). */
  duplicateTrackFrames(layerId: string, trackId: string, frames: readonly number[]): RotoTrackPasteResult {
    if (!layerId || !trackId) return { ok: false, reason: 'track-missing' };
    const document = this.getRotoPhysicalDocument(layerId, trackId);
    if (!document) return { ok: false, reason: 'track-missing' };
    const keyIds: string[] = [];
    for (const frame of frames) {
      const record = this.getRotoRealKeyRecordByAppFrame(layerId, trackId, frame);
      if (!record) return { ok: false, reason: 'missing-key' };
      keyIds.push(record.keyId);
    }
    const copied = this.copyTrackSelection(layerId, trackId, keyIds);
    if (!copied.ok) return copied;
    const duplicated = proposeRails({
      document,
      payload: copied.payload,
      placementMode: 'duplicate',
      targetTrackId: trackId,
    });
    if (!duplicated.ok) return { ok: false, reason: duplicated.reason };
    const applied = _applyRotoTrackPaste(this, layerId, trackId, document, duplicated.proposal);
    if (!applied.ok) return { ok: false, reason: applied.reason };
    return { ok: true, impact: duplicated.impact };
  },

  /** Remove the exact frames (records + runtime frames + cache) from the track. */
  clearTrackFrames(layerId: string, trackId: string, frames: readonly number[]): RotoTrackClearResult {
    if (!layerId || !trackId) return { ok: false, reason: 'track-missing' };
    const document = this.getRotoPhysicalDocument(layerId, trackId);
    if (!document) return { ok: false, reason: 'track-missing' };
    const keyIds: string[] = [];
    for (const frame of frames) {
      const record = this.getRotoRealKeyRecordByAppFrame(layerId, trackId, frame);
      if (!record) return { ok: false, reason: 'missing-key' };
      keyIds.push(record.keyId);
    }
    const keyIdSet = new Set(keyIds);
    for (const clip of document.loopClips) {
      if (clip.sourceKeyIds.some((sourceKeyId) => keyIdSet.has(sourceKeyId))
        && (clip.sourceKeyIds.length === 0 || !clip.sourceKeyIds.every((sourceKeyId) => keyIdSet.has(sourceKeyId)))) {
        return { ok: false, reason: 'partial-loop-overlap' };
      }
    }
  const coveredLoopIds = new Set(
      document.loopClips
        .filter((clip) => clip.sourceKeyIds.length > 0 && clip.sourceKeyIds.every((sourceKeyId) => keyIdSet.has(sourceKeyId)))
        .map((clip) => clip.loopId),
    );
    const removed = _applyRotoTrackSelectionRemoval(this, layerId, trackId, keyIdSet, coveredLoopIds);
    if (!removed.ok) return { ok: false, reason: 'apply-failed' };
    return { ok: true };
  },

  /**
   * Cross-track move (46-03 D-08/D-09) — the data primitive Phase 47's drag
   * gesture calls. D-09 verbatim: build the fresh-identity clipboard payload
   * from the source (cut's COPY half), paste it into the destination with the
   * SAME appFrames (timing preserved — the anchor is the payload's own anchor,
   * so the fresh copies land on the source frames), then delete the source
   * items. The paste half runs FIRST: any failure (destination collision,
   * impossible Hold re-pointing, ...) rejects the whole move closed with the
   * source untouched. Hold Loop Clips re-point under the Task 1 cross-track
   * rules — a covered Hold travels re-pointed onto the destination's fresh
   * frames; a partially-overlapping Hold fails the move before anything is
   * written (the same guard as cut).
   */
  moveTrackItems(layerId: string, fromTrackId: string, toTrackId: string, keys: readonly string[], destinationAppFrame?: number): RotoTrackPasteResult {
    if (!layerId || !fromTrackId || !toTrackId) return { ok: false, reason: 'track-missing' };
    if (fromTrackId === toTrackId) return { ok: false, reason: 'duplicate-destination-frame' };
    const sourceDocument = this.getRotoPhysicalDocument(layerId, fromTrackId);
    if (!sourceDocument) return { ok: false, reason: 'track-missing' };
    if (!Array.isArray(keys) || keys.length === 0) return { ok: false, reason: 'empty-set' };
    const keyIdSet = new Set(keys);
    for (const keyId of keys) {
      if (!sourceDocument.realKeyRecords.some((record) => record.keyId === keyId)) {
        return { ok: false, reason: 'missing-key' };
      }
    }
    // Never dangle on the source: any Hold touching a moved key must be fully
    // inside the moved set, else removing the keys would leave a dangling
    // reference (mirrors cutTrackSelection).
    for (const clip of sourceDocument.loopClips) {
      if (clip.sourceKeyIds.some((sourceKeyId) => keyIdSet.has(sourceKeyId))
        && (clip.sourceKeyIds.length === 0 || !clip.sourceKeyIds.every((sourceKeyId) => keyIdSet.has(sourceKeyId)))) {
        return { ok: false, reason: 'partial-loop-overlap' };
      }
    }
    const copied = this.copyTrackSelection(layerId, fromTrackId, keys);
    if (!copied.ok) return copied;
    const destinationDocument = this.getRotoPhysicalDocument(layerId, toTrackId);
    if (!destinationDocument) return { ok: false, reason: 'track-missing' };
    // Paste half FIRST. Default (paste/cut parity): the payload's own anchor —
    // D-09 preserves timing, the fresh copies land on the exact source
    // appFrames. The cross-track drag passes the PREVIEWED insertion frame
    // (47 close-out UAT round 2): the move lands where the user released, with
    // the payload's anchor exactly at the preview line. Any failure here
    // (occupied destination frame, impossible Hold re-pointing) rejects the
    // whole move with the source untouched.
    const pasted = proposeRails({
      document: destinationDocument,
      payload: copied.payload,
      placementMode: 'paste',
      destinationAppFrame: destinationAppFrame ?? copied.payload.anchorAppFrame,
      targetTrackId: toTrackId,
    });
    if (!pasted.ok) return { ok: false, reason: pasted.reason };
    const applied = _applyRotoTrackPaste(this, layerId, toTrackId, destinationDocument, pasted.proposal);
    if (!applied.ok) return { ok: false, reason: applied.reason };
    // Delete half second: the source loses the moved items exactly like a cut.
    const carriedLoopIds = new Set(
      copied.payload.members.filter((member) => member.kind === 'loop').map((member) => member.loopId),
    );
    const removed = _applyRotoTrackSelectionRemoval(this, layerId, fromTrackId, keyIdSet, carriedLoopIds);
    if (!removed.ok) return { ok: false, reason: 'apply-failed' };
    return { ok: true, impact: pasted.impact };
  },
};

/**
 * 46-03 shared removal transaction for cut/clear/move: deletes the selected
 * key records, their frames + cache, their owned breaks, and the carried loop
 * clips. The replacement order is fixed so every fail-closed port validates:
 * breaks first (validated against the CURRENT records — the survivors all
 * exist), then records (projection validated against the already-reduced break
 * collection), then loops, then the per-frame runtime deletion.
 */
function _applyRotoTrackSelectionRemoval(
  store: typeof physicPaintStore,
  layerId: string,
  trackId: string,
  selectedKeyIds: ReadonlySet<string>,
  carriedLoopIds: ReadonlySet<string>,
): { ok: true } | { ok: false; reason: string } {
  const records = store.getRotoRealKeyRecords(layerId, trackId);
  const remainingRecords = records.filter((record) => !selectedKeyIds.has(record.keyId));
  const currentBreaks = store.getRotoPhysicalIncomingInterpolationBreakKeyIds(layerId, trackId);
  const remainingBreaks = currentBreaks.filter((keyId) => !selectedKeyIds.has(keyId));
  const currentLoops = store.getRotoPhysicalLoopClips(layerId, trackId);
  const remainingLoops = currentLoops.filter((clip) => !carriedLoopIds.has(clip.loopId));
  const removedFrames = records
    .filter((record) => selectedKeyIds.has(record.keyId))
    .map((record) => record.appFrame);
  const breaksResult = store.replaceRotoPhysicalIncomingInterpolationBreakKeyIds(layerId, trackId, remainingBreaks);
  if (!breaksResult.ok) return { ok: false, reason: breaksResult.error };
  const recordsResult = store.replaceRotoPhysicalRecords(
    layerId,
    trackId,
    remainingRecords,
    store.getRotoPhysicalInterpolationState(layerId, trackId),
    store.getRotoPhysicalCapacity(layerId, trackId),
  );
  if (!recordsResult.ok) return { ok: false, reason: recordsResult.error };
  const loopsResult = store.replaceRotoPhysicalLoopClips(layerId, trackId, remainingLoops);
  if (!loopsResult.ok) return { ok: false, reason: loopsResult.error };
  for (const frame of removedFrames) store.removeRealRotoKeyFrame(layerId, trackId, frame);
  return { ok: true };
}

/**
 * 46-03 shared commit helper for paste/duplicate: applies the pure engine's
 * proposal through the three fail-closed record/loop/break ports, then
 * publishes the runtime frame bytes for every FRESH key (the pre-existing
 * target keys keep their own frames). The proposal was already validated by
 * `proposeRails`, so the ports re-validate deterministically.
 */
function _applyRotoTrackPaste(
  store: typeof physicPaintStore,
  layerId: string,
  trackId: string,
  priorDocument: PhysicPaintRotoPhysicalDocument,
  proposal: PhysicPaintRotoPhysicalDocument,
): { ok: true } | { ok: false; reason: RotoTrackSelectionFailureReason } {
  const existingKeyIds = new Set(priorDocument.realKeyRecords.map((record) => record.keyId));
  const freshRecords = proposal.realKeyRecords.filter((record) => !existingKeyIds.has(record.keyId));
  // 52.2-06 (T-52.2-20): every fresh key publishes its own runtime frame. A
  // reference-only record (reopened document) has no pixels in the runtime
  // yet, so publishing would have to write an empty `width: 0` frame — an
  // invisible key. Refuse BEFORE any mutation; plan 09 resolves pixels from
  // the package's media reference and can lift this refusal.
  const frameSources = new Map<string, { bytes: Uint8Array; width: number; height: number }>();
  for (const record of freshRecords) {
    const source = _resolveRotoPublishFrameSource(record.payload);
    if (source === null) return { ok: false, reason: 'unresolved-key-pixels' };
    frameSources.set(record.keyId, source);
  }
  const recordsResult = store.replaceRotoPhysicalRecords(
    layerId,
    trackId,
    proposal.realKeyRecords,
    proposal.interpolation,
    proposal.capacity,
  );
  if (!recordsResult.ok) return { ok: false, reason: 'apply-failed' };
  const loopsResult = store.replaceRotoPhysicalLoopClips(layerId, trackId, proposal.loopClips);
  if (!loopsResult.ok) return { ok: false, reason: 'apply-failed' };
  const breaksResult = store.replaceRotoPhysicalIncomingInterpolationBreakKeyIds(layerId, trackId, proposal.incomingInterpolationBreakKeyIds);
  if (!breaksResult.ok) return { ok: false, reason: 'apply-failed' };
  for (const record of freshRecords) {
    const source = frameSources.get(record.keyId);
    if (source === undefined) continue;
    store.upsertRealRotoKeyFrame(layerId, trackId, record.appFrame, {
      frameIndex: 0,
      appFrame: record.appFrame,
      bytes: source.bytes,
      width: source.width,
      height: source.height,
    });
  }
  return { ok: true };
}
