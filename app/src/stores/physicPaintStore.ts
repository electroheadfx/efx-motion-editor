import { signal } from '@preact/signals';
import type { PhysicPaintApplyPayload, PhysicPaintApplyResult, PhysicPaintRenderedFrame, PhysicPaintRotoBackgroundMetadata, PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings, PhysicPaintRotoPlaybackSettings } from '../types/physicPaint';
import type { RuntimePhysicPaintOutput } from '../types/project';
import { PHYSIC_PAINT_MAX_APPLY_FRAMES, isPhysicPaintApplyPayload, isPhysicPaintRenderedFrame, isPhysicPaintRotoBackgroundMetadata, isPhysicPaintRotoCacheFrame, isPhysicPaintRotoInterpolationSettings, isPhysicPaintRotoPlaybackSettings, type PhysicPaintRotoSegmentSpacingOverride } from '../types/physicPaint';
import { getExpandedRotoRealKeyFrames } from '../components/physic-paint/roto/physicsPaintRotoWorkflow';
import { resolveMissingRotoFrameDraw } from '../lib/rotoFrameDraw';
import type { PhysicsPaintPerformanceSample } from '../components/physic-paint/performance/physicsPaintPerformanceTrace';
import {
  PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED,
  PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
  PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO,
  buildPhysicPaintRotoPhysicalRevision,
  isPhysicPaintRotoInterpolationState,
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

let _markProjectDirty: (() => void) | null = null;
export function _setPhysicPaintMarkDirtyCallback(cb: () => void) { _markProjectDirty = cb; }

export const physicPaintVersion = signal(0);

type PhysicPaintMceOutput = RuntimePhysicPaintOutput;
type PhysicPaintMceOutputInput = RuntimePhysicPaintOutput;

export type PhysicPaintLayerSnapshot = {
  layerId: string;
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
};

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

const _frames = new Map<string, Map<number, PhysicPaintRenderedFrame>>();
const _rotoBackgroundMetadata = new Map<string, PhysicPaintRotoBackgroundMetadata>();
const _rotoCacheMetadata = new Map<string, Map<number, PhysicPaintRotoCacheFrame>>();
const _rotoGeneratedCacheMetadata = new Map<string, Map<number, PhysicPaintRotoCacheFrame>>();
const _rotoInterpolationSettings = new Map<string, PhysicPaintRotoInterpolationSettings>();
const _rotoInterpolationFailureStatus = new Map<string, string>();
const ROTO_INTERPOLATION_FAILURE_STATUS = 'Generated in-betweens could not regenerate. Real keys were kept.';

// --- Physical record ownership (D-01/D-02/D-03) ---
// Stable keyId -> direct appFrame real-key records plus canonical
// interpolation state. These maps are the sole durable Roto timing/identity
// authority; generated cells are runtime-derived via the shared projection seam
// and never stored as durable records.
const _rotoRealKeyRecords = new Map<string, Map<string, PhysicPaintRotoRealKeyRecord>>();
const _rotoPhysicalInterpolationState = new Map<string, PhysicPaintRotoInterpolationState>();
const _rotoPhysicalScriptMotion = new Map<string, PhysicPaintRotoScriptMotionSettings>();
const _rotoPhysicalSelectedKeyId = new Map<string, string | null>();
const _rotoPhysicalCursorAppFrame = new Map<string, number>();
const _rotoPhysicalCapacity = new Map<string, number>();
// Durable linked Loop Clip collections (Phase 43, D-29). Values are always
// frozen parser output; mutation sites REPLACE the array, never edit in place.
const _rotoPhysicalLoopClips = new Map<string, readonly PhysicPaintRotoLoopClip[]>();
const _rotoPlaybackSettings = new Map<string, PhysicPaintRotoPlaybackSettings>();
export const rotoPhysicalRevision = signal(0);

// --- Physical structural read memo (38.1-07) ---
// Per-layer memo for the physical projection + content revision. Validity is
// keyed on the identity quadruple (recordMap, frozen interpolation object,
// capacity, frozen loopClips array): every mutation site REPLACES those values
// (the add/delete/move/undo/redo publish path at replaceRotoPhysicalRecords,
// loop replacement at replaceRotoPhysicalLoopClips, payload writes at
// updateRotoPhysicalRealKeyPayload, interpolation publishes at
// setRotoPhysicalInterpolationState, document replacement, and hydration), so
// the memo needs no explicit invalidation hooks and can never serve stale
// data. Selection/cursor writes touch none of the four identities and never
// invalidate. Any future post-install in-place write to an installed inner
// record map or loop array would silently break this contract and is grep-gated.
type RotoPhysicalStructuralCacheEntry = {
  recordMap: Map<string, PhysicPaintRotoRealKeyRecord>;
  interpolation: PhysicPaintRotoInterpolationState;
  capacity: number;
  loopClips: readonly PhysicPaintRotoLoopClip[];
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

function _resolveRotoPhysicalStructural(layerId: string): RotoPhysicalStructuralCacheEntry | null {
  const recordMap = _rotoRealKeyRecords.get(layerId);
  if (!recordMap) {
    _rotoPhysicalStructuralCache.delete(layerId);
    return null;
  }
  const interpolation = _rotoPhysicalInterpolationState.get(layerId) ?? PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED;
  const capacity = _rotoPhysicalCapacity.get(layerId) ?? PHYSIC_PAINT_MAX_APPLY_FRAMES;
  const loopClips = _rotoPhysicalLoopClips.get(layerId) ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY;
  const cached = _rotoPhysicalStructuralCache.get(layerId);
  if (cached
    && cached.recordMap === recordMap
    && cached.interpolation === interpolation
    && cached.capacity === capacity
    && cached.loopClips === loopClips) return cached;
  const records = Array.from(recordMap.values()).sort((a, b) => a.appFrame - b.appFrame);
  const identities = records.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame }));
  const result = projectPhysicPaintRotoPhysicalTimeline({
    identities,
    capacity,
    interpolationEnabled: interpolation.enabled,
  });
  const entry: RotoPhysicalStructuralCacheEntry = {
    recordMap,
    interpolation,
    capacity,
    loopClips,
    projection: result.ok ? result.projection : null,
    contentRevision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips),
    loopResolution: derivePhysicPaintRotoLoopRanges({
      identities,
      loopClips,
      parentEndExclusive: capacity,
      capacity,
    }),
  };
  _rotoPhysicalStructuralCache.set(layerId, entry);
  return entry;
}
let _serializationRevision = 0;
let _cachedSerializationRevision = -1;
let _cachedMceOutputs: PhysicPaintMceOutput[] = [];

function _collectFrameDataUrls(frames: Iterable<PhysicPaintRenderedFrame>, target: Set<string>): void {
  for (const frame of frames) {
    target.add(frame.dataUrl);
    const onionDataUrl = (frame as { onionDataUrl?: unknown }).onionDataUrl;
    if (typeof onionDataUrl === 'string') target.add(onionDataUrl);
  }
}

function _getLayerDataUrls(layerId: string): Set<string> {
  const dataUrls = new Set<string>();
  _collectFrameDataUrls(_frames.get(layerId)?.values() ?? [], dataUrls);
  _collectFrameDataUrls(_rotoCacheMetadata.get(layerId)?.values() ?? [], dataUrls);
  _collectFrameDataUrls(_rotoGeneratedCacheMetadata.get(layerId)?.values() ?? [], dataUrls);
  for (const record of _rotoRealKeyRecords.get(layerId)?.values() ?? []) dataUrls.add(record.payload.dataUrl);
  return dataUrls;
}

function _isDataUrlReferenced(dataUrl: string): boolean {
  const referencesDataUrl = (frames: Iterable<PhysicPaintRenderedFrame>): boolean => {
    for (const frame of frames) {
      if (frame.dataUrl === dataUrl || (frame as { onionDataUrl?: unknown }).onionDataUrl === dataUrl) return true;
    }
    return false;
  };
  for (const layerFrames of _frames.values()) if (referencesDataUrl(layerFrames.values())) return true;
  for (const metadata of _rotoCacheMetadata.values()) if (referencesDataUrl(metadata.values())) return true;
  for (const metadata of _rotoGeneratedCacheMetadata.values()) if (referencesDataUrl(metadata.values())) return true;
  for (const records of _rotoRealKeyRecords.values()) {
    for (const record of records.values()) if (record.payload.dataUrl === dataUrl) return true;
  }
  return false;
}

function _pruneUnreferencedRotoAlphaCanvases(dataUrls: Iterable<string>): void {
  for (const dataUrl of dataUrls) {
    if (!_isDataUrlReferenced(dataUrl)) _rotoAlphaCanvasRegistry.delete(dataUrl);
  }
}

function _clearLayerState(layerId: string): boolean {
  const dataUrls = _getLayerDataUrls(layerId);
  let changed = false;
  // Derived 38.1-07 structural memo entry — pruned with the layer's source
  // state so a torn-down layer never leaves its cached projection resident.
  _rotoPhysicalStructuralCache.delete(layerId);
  changed = _frames.delete(layerId) || changed;
  changed = _rotoBackgroundMetadata.delete(layerId) || changed;
  changed = _rotoCacheMetadata.delete(layerId) || changed;
  changed = _rotoGeneratedCacheMetadata.delete(layerId) || changed;
  changed = _rotoInterpolationSettings.delete(layerId) || changed;
  changed = _rotoInterpolationFailureStatus.delete(layerId) || changed;
  changed = _rotoRealKeyRecords.delete(layerId) || changed;
  changed = _rotoPhysicalInterpolationState.delete(layerId) || changed;
  changed = _rotoPhysicalScriptMotion.delete(layerId) || changed;
  changed = _rotoPhysicalLoopClips.delete(layerId) || changed;
  changed = _rotoPhysicalSelectedKeyId.delete(layerId) || changed;
  changed = _rotoPhysicalCursorAppFrame.delete(layerId) || changed;
  changed = _rotoPhysicalCapacity.delete(layerId) || changed;
  changed = _rotoPlaybackSettings.delete(layerId) || changed;
  for (const dataUrl of dataUrls) {
    if (!_isDataUrlReferenced(dataUrl)) changed = _rotoAlphaCanvasRegistry.delete(dataUrl) || changed;
  }
  return changed;
}

function _invalidateSerializationCache(): void {
  _serializationRevision++;
}

function _getOrCreateLayer(layerId: string): Map<number, PhysicPaintRenderedFrame> {
  let layerFrames = _frames.get(layerId);
  if (!layerFrames) {
    layerFrames = new Map();
    _frames.set(layerId, layerFrames);
  }
  return layerFrames;
}

function _getOrCreateRotoMetadata(layerId: string): Map<number, PhysicPaintRotoCacheFrame> {
  let metadata = _rotoCacheMetadata.get(layerId);
  if (!metadata) {
    metadata = new Map();
    _rotoCacheMetadata.set(layerId, metadata);
  }
  return metadata;
}

function _getOrCreateGeneratedRotoMetadata(layerId: string): Map<number, PhysicPaintRotoCacheFrame> {
  let metadata = _rotoGeneratedCacheMetadata.get(layerId);
  if (!metadata) {
    metadata = new Map();
    _rotoGeneratedCacheMetadata.set(layerId, metadata);
  }
  return metadata;
}

function _getCombinedRotoMetadata(layerId: string): PhysicPaintRotoCacheFrame[] {
  return [
    ...Array.from(_rotoCacheMetadata.get(layerId)?.values() ?? []),
    ...Array.from(_rotoGeneratedCacheMetadata.get(layerId)?.values() ?? []),
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

function _serializeRotoInterpolationSettings(settings: PhysicPaintRotoInterpolationSettings): PhysicPaintRotoInterpolationSettings {
  return {
    ..._cloneRotoInterpolationSettings(settings),
    segmentSpacingOverrides: settings.segmentSpacingOverrides?.map(override => ({ ...override })) ?? [],
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
  _invalidateSerializationCache();
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

function _getRealRotoKeyFrames(layerId: string): number[] {
  const metadata = _rotoCacheMetadata.get(layerId);
  if (!metadata) return [];
  return Array.from(metadata.values())
    .filter((frame) => frame.source === 'real-key')
    .map((frame) => frame.sourceFrame ?? frame.appFrame)
    .sort((a, b) => a - b);
}

function _getRotoDisplayFrame(layerId: string, frame: number): PhysicPaintRotoCacheFrame | null {
  return _getCombinedRotoMetadata(layerId).find((candidate) => (candidate.displayFrame ?? candidate.appFrame) === frame) ?? null;
}

function _normalizeRealRotoCacheFrame(frame: PhysicPaintRenderedFrame, sourceFrame: number, backgroundOnly?: boolean): PhysicPaintRotoCacheFrame {
  const next = _makeRotoCacheFrame({ ...frame, appFrame: sourceFrame, frameIndex: 0, source: 'real-key' }, sourceFrame, 'real-key', undefined, backgroundOnly, {
    sourceFrame,
    displayFrame: sourceFrame,
  });
  delete next.nearestRealKeyFrame;
  return next;
}

function _resetRealRotoDisplayFrames(layerId: string): boolean {
  const metadata = _rotoCacheMetadata.get(layerId);
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

function _removeGeneratedRotoCache(layerId: string): boolean {
  const layerFrames = _frames.get(layerId);
  const generatedMetadata = _rotoGeneratedCacheMetadata.get(layerId);
  let changed = false;
  if (layerFrames) {
    for (const [frame, renderedFrame] of Array.from(layerFrames.entries())) {
      if (renderedFrame.source === 'generated-interpolation') {
        layerFrames.delete(frame);
        changed = true;
      }
    }
    if (layerFrames.size === 0) _frames.delete(layerId);
  }
  if (generatedMetadata) {
    changed = generatedMetadata.size > 0 || changed;
    generatedMetadata.clear();
    _rotoGeneratedCacheMetadata.delete(layerId);
  }
  return changed;
}

function _removeBackgroundOnlyRotoSupport(layerId: string, frames?: Iterable<number>): boolean {
  const layerFrames = _frames.get(layerId);
  const metadata = _rotoCacheMetadata.get(layerId);
  let changed = false;
  const candidateFrames = frames ? Array.from(frames) : Array.from(metadata?.keys() ?? []);
  for (const frame of candidateFrames) {
    if (metadata?.get(frame)?.source !== 'background-only-support') continue;
    metadata.delete(frame);
    if (layerFrames?.get(frame)?.source === 'background-only-support') layerFrames.delete(frame);
    changed = true;
  }
  if (layerFrames?.size === 0) _frames.delete(layerId);
  if (metadata?.size === 0) _rotoCacheMetadata.delete(layerId);
  return changed;
}

function _makeBackgroundOnlySupportFrame(layerId: string, appFrame: number, nearestRealKeyFrame: number): PhysicPaintRotoCacheFrame | null {
  const background = _rotoBackgroundMetadata.get(layerId);
  if (!background) return null;
  const instruction = resolveMissingRotoFrameDraw(layerId, appFrame, { backgroundState: { mode: 'paper', metadata: background }, realKeyFrames: _getRealRotoKeyFrames(layerId) });
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

function _pruneFramesOutsideRotoCacheMetadata(layerId: string): boolean {
  const layerFrames = _frames.get(layerId);
  const metadata = _rotoCacheMetadata.get(layerId);
  if (!layerFrames || !metadata || metadata.size === 0) return false;
  let changed = false;
  for (const frame of Array.from(layerFrames.keys())) {
    if (metadata.has(frame)) continue;
    layerFrames.delete(frame);
    changed = true;
  }
  if (layerFrames.size === 0) _frames.delete(layerId);
  return changed;
}

function _recomputeBackgroundOnlyRotoSupport(layerId: string, requestedFrames: readonly number[] = []): { changed: boolean; supportFrames: PhysicPaintRotoCacheFrame[] } {
  const realKeys = _getRealRotoKeyFrames(layerId);
  const requested = Array.from(new Set(requestedFrames.filter((frame) => Number.isInteger(frame) && frame >= 0))).sort((a, b) => a - b);
  const removed = _removeBackgroundOnlyRotoSupport(layerId, requested.length > 0 ? requested : undefined);
  if (realKeys.length < 2 || requested.length === 0) return { changed: removed, supportFrames: [] };

  const layerFrames = _getOrCreateLayer(layerId);
  const metadata = _getOrCreateRotoMetadata(layerId);
  const supportFrames: PhysicPaintRotoCacheFrame[] = [];
  let added = false;
  for (const appFrame of requested) {
    if (metadata.get(appFrame)?.source === 'real-key') continue;
    const priorRealKeys = realKeys.filter((key) => key < appFrame);
    const previousRealKeyFrame = priorRealKeys[priorRealKeys.length - 1];
    const nextRealKeyFrame = realKeys.find((key) => key > appFrame);
    if (previousRealKeyFrame === undefined || nextRealKeyFrame === undefined) continue;
    const supportFrame = _makeBackgroundOnlySupportFrame(layerId, appFrame, previousRealKeyFrame);
    if (!supportFrame) continue;
    layerFrames.set(appFrame, supportFrame);
    metadata.set(appFrame, supportFrame);
    supportFrames.push({ ...supportFrame });
    added = true;
  }
  if (layerFrames.size === 0) _frames.delete(layerId);
  if (metadata.size === 0) _rotoCacheMetadata.delete(layerId);
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

function _tryRegenerateGeneratedRotoCache(layerId: string, settings: PhysicPaintRotoInterpolationSettings): { changed: boolean; generatedFrames: PhysicPaintRenderedFrame[]; failed: boolean } {
  try {
    const result = _regenerateGeneratedRotoCache(layerId, settings);
    if (!result.failed) _rotoInterpolationFailureStatus.delete(layerId);
    return result;
  } catch {
    const removed = _removeGeneratedRotoCache(layerId);
    const reset = _resetRealRotoDisplayFrames(layerId);
    _rotoInterpolationFailureStatus.set(layerId, ROTO_INTERPOLATION_FAILURE_STATUS);
    return { changed: removed || reset, generatedFrames: [], failed: true };
  }
}

function _regenerateGeneratedRotoCache(layerId: string, settings: PhysicPaintRotoInterpolationSettings): { changed: boolean; generatedFrames: PhysicPaintRenderedFrame[]; failed: boolean } {
  const removed = _removeGeneratedRotoCache(layerId);
  const realKeys = _getRealRotoKeyFrames(layerId);
  const layerFrames = _getOrCreateLayer(layerId);
  if (!settings.enabled || realKeys.length < 2) {
    const reset = _resetRealRotoDisplayFrames(layerId);
    return { changed: removed || reset, generatedFrames: [], failed: false };
  }

  const metadata = _getOrCreateRotoMetadata(layerId);
  const generatedMetadata = _getOrCreateGeneratedRotoMetadata(layerId);
  const displayEntries = getExpandedRotoRealKeyFrames(realKeys, settings);
  const generatedFrames: PhysicPaintRenderedFrame[] = [];
  for (const displayEntry of displayEntries) {
    if (displayEntry.kind !== 'real-key') continue;
    const sourceFrame = layerFrames.get(displayEntry.sourceFrame);
    if (!sourceFrame) continue;
    metadata.set(displayEntry.sourceFrame, _makeRotoCacheFrame(sourceFrame, displayEntry.sourceFrame, 'real-key', undefined, undefined, {
      sourceFrame: displayEntry.sourceFrame,
      displayFrame: displayEntry.displayFrame,
    }));
  }

  for (const displayEntry of displayEntries) {
    if (displayEntry.kind === 'real-key') continue;
    const from = layerFrames.get(displayEntry.fromSourceFrame);
    const to = displayEntry.toSourceFrame === undefined ? from : layerFrames.get(displayEntry.toSourceFrame);
    if (!from || !to) continue;
    const targetFrame = Math.round(displayEntry.generatedFrame);
    const targetDisplayOccupiedByRealKey = Array.from(metadata.values()).some((frame) => frame.source === 'real-key' && (frame.displayFrame ?? frame.appFrame) === targetFrame);
    if (targetDisplayOccupiedByRealKey) continue;
    _removeBackgroundOnlyRotoSupport(layerId, [targetFrame]);
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

export const physicPaintStore = {
  getFrame(layerId: string, frame: number): PhysicPaintRenderedFrame | null {
    return _frames.get(layerId)?.get(frame) ?? null;
  },

  getRotoFrame(layerId: string, frame: number): PhysicPaintRotoCacheFrame | null {
    const displayFrame = _getRotoDisplayFrame(layerId, frame);
    if (!displayFrame) return null;
    if (displayFrame.source === 'real-key') {
      const sourceFrame = displayFrame.sourceFrame ?? displayFrame.appFrame;
      const rendered = _frames.get(layerId)?.get(sourceFrame);
      return rendered ? { ...rendered, appFrame: frame, source: 'real-key', sourceFrame, displayFrame: frame } : null;
    }
    return { ...displayFrame, appFrame: frame };
  },

  getRotoBackgroundMetadata(layerId: string): PhysicPaintRotoBackgroundMetadata | null {
    const metadata = _rotoBackgroundMetadata.get(layerId);
    return metadata ? { ...metadata } : null;
  },

  setRotoBackgroundMetadata(layerId: string, metadata: PhysicPaintRotoBackgroundMetadata): void {
    _rotoBackgroundMetadata.set(layerId, { ...metadata });
    _notifyVisualChange();
  },

  getRotoPlaybackSettings(layerId: string): PhysicPaintRotoPlaybackSettings | null {
    const settings = _rotoPlaybackSettings.get(layerId);
    return settings ? { ...settings } : null;
  },

  setRotoPlaybackSettings(layerId: string, settings: PhysicPaintRotoPlaybackSettings): boolean {
    if (!isPhysicPaintRotoPlaybackSettings(settings)) return false;
    const current = _rotoPlaybackSettings.get(layerId);
    if (current?.loop === settings.loop && current.fps === settings.fps) return false;
    _rotoPlaybackSettings.set(layerId, { ...settings });
    _invalidateSerializationCache();
    _markProjectDirty?.();
    return true;
  },

  getFrames(layerId: string): Map<number, PhysicPaintRenderedFrame> {
    return new Map(_frames.get(layerId) ?? []);
  },

  getRotoCacheFrames(layerId: string): PhysicPaintRotoCacheFrame[] {
    const frames = _getCombinedRotoMetadata(layerId);
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

  upsertRealRotoKeyFrame(layerId: string, frame: number, renderedFrame: PhysicPaintRenderedFrame, backgroundOnly = false, diagnostics?: { mutationId?: number; record: (sample: PhysicsPaintPerformanceSample) => void }): void {
    if (!Number.isInteger(frame) || frame < 0) return;
    const insertionStartedAt = diagnostics ? performance.now() : 0;
    _removeBackgroundOnlyRotoSupport(layerId, [frame]);
    const settings = this.getRotoInterpolationSettings(layerId);
    const normalizedFrame = { ...renderedFrame, appFrame: frame, frameIndex: 0, source: 'real-key' as const };
    _getOrCreateLayer(layerId).set(frame, normalizedFrame);
    _getOrCreateRotoMetadata(layerId).set(frame, _normalizeRealRotoCacheFrame(normalizedFrame, frame, backgroundOnly || undefined));
    _pruneFramesOutsideRotoCacheMetadata(layerId);
    if (diagnostics) diagnostics.record({ stage: 'store-real-key-insert', category: 'sync-cpu', durationMs: performance.now() - insertionStartedAt, timestamp: performance.now(), mutationId: diagnostics.mutationId, sourceFrame: frame });
    if (settings.enabled) {
      const interpolationStartedAt = diagnostics ? performance.now() : 0;
      _tryRegenerateGeneratedRotoCache(layerId, settings);
      if (diagnostics) diagnostics.record({ stage: 'store-interpolation-regeneration', category: 'sync-cpu', durationMs: performance.now() - interpolationStartedAt, timestamp: performance.now(), mutationId: diagnostics.mutationId, sourceFrame: frame, branch: settings.mode });
    }
    _notifyVisualChange(diagnostics);
  },

  removeRealRotoKeyFrame(layerId: string, frame: number): boolean {
    if (!Number.isInteger(frame) || frame < 0) return false;
    const metadata = _rotoCacheMetadata.get(layerId);
    if (metadata?.get(frame)?.source !== 'real-key') return false;
    const previousSupportFrames = Array.from(metadata.values())
      .filter((candidate) => candidate.source === 'background-only-support')
      .map((candidate) => candidate.appFrame);
    const layerFrames = _frames.get(layerId);
    layerFrames?.delete(frame);
    if (layerFrames?.size === 0) _frames.delete(layerId);
    metadata.delete(frame);
    _removeBackgroundOnlyRotoSupport(layerId);
    _recomputeBackgroundOnlyRotoSupport(layerId, previousSupportFrames);
    if (metadata.size === 0) _rotoCacheMetadata.delete(layerId);
    const settings = this.getRotoInterpolationSettings(layerId);
    if (settings.enabled) {
      _tryRegenerateGeneratedRotoCache(layerId, settings);
    }
    _notifyVisualChange();
    return true;
  },

  toMceOutputs(): PhysicPaintMceOutput[] {
    if (_cachedSerializationRevision === _serializationRevision) return structuredClone(_cachedMceOutputs);
    const layerIds = new Set([..._frames.keys(), ..._rotoCacheMetadata.keys(), ..._rotoInterpolationSettings.keys(), ..._rotoBackgroundMetadata.keys(), ..._rotoRealKeyRecords.keys(), ..._rotoPlaybackSettings.keys()]);
    const outputs = Array.from(layerIds).map((layerId): PhysicPaintMceOutput => {
      if (_rotoRealKeyRecords.has(layerId)) {
        const realKeyRecords = this.getRotoRealKeyRecords(layerId);
        const interpolation = this.getRotoPhysicalInterpolationState(layerId);
        const capacity = this.getRotoPhysicalCapacity(layerId);
        const selectedCandidate = _rotoPhysicalSelectedKeyId.get(layerId) ?? null;
        const selectedRecord = selectedCandidate === null ? null : realKeyRecords.find((record) => record.keyId === selectedCandidate) ?? null;
        const selectedKeyId = selectedRecord?.keyId ?? null;
        const cursorCandidate = selectedRecord?.appFrame ?? _rotoPhysicalCursorAppFrame.get(layerId) ?? 0;
        const cursorAppFrame = Math.max(0, Math.min(capacity - 1, cursorCandidate));
        const rotoPhysical = parsePhysicPaintRotoPhysicalDocument({
          capacity,
          realKeyRecords,
          interpolation,
          scriptMotion: _rotoPhysicalScriptMotion.get(layerId) ?? PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO,
          background: _rotoBackgroundMetadata.get(layerId) ?? null,
          selectedKeyId,
          cursorAppFrame,
          revision: buildPhysicPaintRotoPhysicalRevision(realKeyRecords, interpolation, this.getRotoPhysicalLoopClips(layerId)),
          loopClips: this.getRotoPhysicalLoopClips(layerId),
        });
        return {
          layer_id: layerId,
          frames: [],
          roto_physical: rotoPhysical,
          ...(_rotoPlaybackSettings.has(layerId) ? { roto_playback: { ..._rotoPlaybackSettings.get(layerId)! } } : {}),
        };
      }
      return {
        layer_id: layerId,
        frames: Array.from(_frames.get(layerId)?.values() ?? []).sort((a, b) => a.appFrame - b.appFrame),
        ...(_rotoCacheMetadata.has(layerId) ? { roto_cache_metadata: Array.from(_rotoCacheMetadata.get(layerId)!.values()).sort((a, b) => a.appFrame - b.appFrame) } : {}),
        ...(_rotoInterpolationSettings.has(layerId) ? { roto_interpolation_settings: _serializeRotoInterpolationSettings(_rotoInterpolationSettings.get(layerId)!) } : {}),
        ...(_rotoBackgroundMetadata.has(layerId) ? { roto_background: { ..._rotoBackgroundMetadata.get(layerId)! } } : {}),
        ...(_rotoPlaybackSettings.has(layerId) ? { roto_playback: { ..._rotoPlaybackSettings.get(layerId)! } } : {}),
      };
    }).filter((output) => output.frames.length > 0 || output.roto_physical || output.roto_playback || output.roto_cache_metadata || output.roto_interpolation_settings || output.roto_background);
    _cachedMceOutputs = structuredClone(outputs);
    _cachedSerializationRevision = _serializationRevision;
    return outputs;
  },

  loadFromMceOutputs(outputs: PhysicPaintMceOutputInput[] | null | undefined): void {
    const previousDataUrls = new Set(_rotoAlphaCanvasRegistry.keys());
    const nextFrames = new Map<string, Map<number, PhysicPaintRenderedFrame>>();
    const nextBackground = new Map<string, PhysicPaintRotoBackgroundMetadata>();
    const nextCache = new Map<string, Map<number, PhysicPaintRotoCacheFrame>>();
    const nextInterpolationSettings = new Map<string, PhysicPaintRotoInterpolationSettings>();
    const nextPhysicalRecords = new Map<string, Map<string, PhysicPaintRotoRealKeyRecord>>();
    const nextPhysicalInterpolation = new Map<string, PhysicPaintRotoInterpolationState>();
    const nextPhysicalScriptMotion = new Map<string, PhysicPaintRotoScriptMotionSettings>();
    const nextPhysicalLoopClips = new Map<string, readonly PhysicPaintRotoLoopClip[]>();
    const nextPhysicalSelection = new Map<string, string | null>();
    const nextPhysicalCursor = new Map<string, number>();
    const nextPhysicalCapacity = new Map<string, number>();
    const nextPlaybackSettings = new Map<string, PhysicPaintRotoPlaybackSettings>();
    const seenLayerIds = new Set<string>();

    for (const output of outputs ?? []) {
      if (!output || typeof output.layer_id !== 'string' || output.layer_id.trim().length === 0 || seenLayerIds.has(output.layer_id)) {
        throw new Error('Physics Paint store installation requires unique non-empty layer IDs.');
      }
      seenLayerIds.add(output.layer_id);
      if (output.roto_playback !== undefined) {
        if (!isPhysicPaintRotoPlaybackSettings(output.roto_playback)) throw new Error(`Invalid Roto playback settings for layer "${output.layer_id}".`);
        nextPlaybackSettings.set(output.layer_id, { ...output.roto_playback });
      }
      if (output.roto_physical) {
        const physical = parsePhysicPaintRotoPhysicalDocument(output.roto_physical);
        const projection = projectPhysicPaintRotoPhysicalTimeline({
          identities: physical.realKeyRecords.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame })),
          capacity: physical.capacity,
          interpolationEnabled: physical.interpolation.enabled,
        });
        if (!projection.ok) throw new Error(projection.failure.text);
        nextPhysicalRecords.set(output.layer_id, new Map(physical.realKeyRecords.map((record) => [record.keyId, record])));
        nextPhysicalInterpolation.set(output.layer_id, physical.interpolation);
        nextPhysicalScriptMotion.set(output.layer_id, physical.scriptMotion);
        nextPhysicalLoopClips.set(output.layer_id, physical.loopClips);
        nextPhysicalSelection.set(output.layer_id, physical.selectedKeyId);
        nextPhysicalCursor.set(output.layer_id, physical.cursorAppFrame);
        nextPhysicalCapacity.set(output.layer_id, physical.capacity);
        if (physical.background) nextBackground.set(output.layer_id, { ...physical.background });
        continue;
      }

      const layerFrames = new Map<number, PhysicPaintRenderedFrame>();
      for (const frame of output.frames ?? []) {
        if (!isPhysicPaintRenderedFrame(frame) || layerFrames.has(frame.appFrame)) throw new Error(`Invalid Physics Paint frame for layer "${output.layer_id}".`);
        layerFrames.set(frame.appFrame, { ...frame });
      }
      if (layerFrames.size > 0) nextFrames.set(output.layer_id, layerFrames);
      const real = new Map<number, PhysicPaintRotoCacheFrame>();
      for (const frame of output.roto_cache_metadata ?? []) {
        if (!isPhysicPaintRotoCacheFrame(frame) || frame.source === 'generated-interpolation' || real.has(frame.appFrame)) {
          throw new Error(`Invalid durable Roto cache metadata for layer "${output.layer_id}".`);
        }
        real.set(frame.appFrame, { ...frame });
      }
      if (real.size > 0) nextCache.set(output.layer_id, real);
      if (isPhysicPaintRotoInterpolationSettings(output.roto_interpolation_settings)) nextInterpolationSettings.set(output.layer_id, _normalizeRotoInterpolationSettings(output.roto_interpolation_settings));
      if (isPhysicPaintRotoBackgroundMetadata(output.roto_background)) nextBackground.set(output.layer_id, { ...output.roto_background });
    }

    _frames.clear();
    _rotoBackgroundMetadata.clear();
    _rotoCacheMetadata.clear();
    _rotoGeneratedCacheMetadata.clear();
    _rotoInterpolationSettings.clear();
    _rotoInterpolationFailureStatus.clear();
    _rotoRealKeyRecords.clear();
    _rotoPhysicalInterpolationState.clear();
    _rotoPhysicalScriptMotion.clear();
    _rotoPhysicalLoopClips.clear();
    _rotoPhysicalSelectedKeyId.clear();
    _rotoPhysicalCursorAppFrame.clear();
    _rotoPhysicalCapacity.clear();
    _rotoPlaybackSettings.clear();
    _rotoPhysicalStructuralCache.clear();
    for (const [layerId, value] of nextFrames) _frames.set(layerId, value);
    for (const [layerId, value] of nextBackground) _rotoBackgroundMetadata.set(layerId, value);
    for (const [layerId, value] of nextCache) _rotoCacheMetadata.set(layerId, value);
    for (const [layerId, value] of nextInterpolationSettings) _rotoInterpolationSettings.set(layerId, value);
    for (const [layerId, value] of nextPhysicalRecords) _rotoRealKeyRecords.set(layerId, value);
    for (const [layerId, value] of nextPhysicalInterpolation) _rotoPhysicalInterpolationState.set(layerId, value);
    for (const [layerId, value] of nextPhysicalScriptMotion) _rotoPhysicalScriptMotion.set(layerId, value);
    for (const [layerId, value] of nextPhysicalLoopClips) _rotoPhysicalLoopClips.set(layerId, value);
    for (const [layerId, value] of nextPhysicalSelection) _rotoPhysicalSelectedKeyId.set(layerId, value);
    for (const [layerId, value] of nextPhysicalCursor) _rotoPhysicalCursorAppFrame.set(layerId, value);
    for (const [layerId, value] of nextPhysicalCapacity) _rotoPhysicalCapacity.set(layerId, value);
    for (const [layerId, value] of nextPlaybackSettings) _rotoPlaybackSettings.set(layerId, value);
    _pruneUnreferencedRotoAlphaCanvases(previousDataUrls);
    _invalidateSerializationCache();
    rotoPhysicalRevision.value = rotoPhysicalRevision.value + 1;
    physicPaintVersion.value++;
  },

  setFrame(layerId: string, frame: number, renderedFrame: PhysicPaintRenderedFrame): void {
    if (!Number.isInteger(frame) || frame < 0) return;
    _getOrCreateLayer(layerId).set(frame, { ...renderedFrame, appFrame: frame });
    _notifyVisualChange();
  },

  getRotoInterpolationSettings(layerId: string): PhysicPaintRotoInterpolationSettings {
    return _cloneRotoInterpolationSettings({ ...DEFAULT_ROTO_INTERPOLATION_SETTINGS, ...(_rotoInterpolationSettings.get(layerId) ?? {}) });
  },

  getRotoInterpolationFailureStatus(layerId: string): string | null {
    return _rotoInterpolationFailureStatus.get(layerId) ?? null;
  },

  setRotoInterpolationSettings(layerId: string, settings: Partial<PhysicPaintRotoInterpolationSettings>): PhysicPaintRenderedFrame[] {
    const realKeys = _getRealRotoKeyFrames(layerId);
    const current = _rotoInterpolationSettings.get(layerId);
    const source = {
      ...(current ?? {}),
      ...settings,
      segmentSpacingOverrides: settings.segmentSpacingOverrides ?? current?.segmentSpacingOverrides,
    };
    const normalized = _normalizeRotoInterpolationSettings(source, realKeys);
    _rotoInterpolationSettings.set(layerId, normalized);
    const { changed, generatedFrames } = _tryRegenerateGeneratedRotoCache(layerId, normalized);
    if (changed || _rotoInterpolationSettings.has(layerId)) _notifyVisualChange();
    return generatedFrames.map(frame => ({ ...frame }));
  },

  replaceGeneratedRotoCache(layerId: string, generatedFrames: PhysicPaintRenderedFrame[], settings?: PhysicPaintRotoInterpolationSettings): boolean {
    if (settings !== undefined && !isPhysicPaintRotoInterpolationSettings(settings)) return false;
    const removed = _removeGeneratedRotoCache(layerId);
    const layerFrames = _getOrCreateLayer(layerId);
    const generatedMetadata = _getOrCreateGeneratedRotoMetadata(layerId);
    let added = false;
    for (const frame of generatedFrames) {
      if (!Number.isInteger(frame.appFrame) || frame.appFrame < 0) continue;
      const normalizedFrame = { ...frame, appFrame: frame.appFrame, source: 'generated-interpolation' as const };
      generatedMetadata.set(frame.appFrame, _makeRotoCacheFrame(normalizedFrame, frame.appFrame, 'generated-interpolation', 'nearestRealKeyFrame' in frame ? frame.nearestRealKeyFrame : undefined));
      added = true;
    }
    if (layerFrames.size === 0) _frames.delete(layerId);
    if (generatedMetadata.size === 0) _rotoGeneratedCacheMetadata.delete(layerId);
    if (settings) _rotoInterpolationSettings.set(layerId, _normalizeRotoInterpolationSettings(settings, _getRealRotoKeyFrames(layerId)));
    if (removed || added || settings) _notifyVisualChange();
    return true;
  },

  regenerateRotoInterpolationCache(layerId: string): PhysicPaintRenderedFrame[] {
    const settings = this.getRotoInterpolationSettings(layerId);
    const { changed, generatedFrames } = _tryRegenerateGeneratedRotoCache(layerId, settings);
    if (changed) _notifyVisualChange();
    return generatedFrames.map(frame => ({ ...frame }));
  },

  getRealRotoKeyFrames(layerId: string): number[] {
    return _getRealRotoKeyFrames(layerId);
  },

  getBackgroundOnlyRotoSupportFrames(layerId: string): number[] {
    return this.getRotoCacheFrames(layerId)
      .filter((frame) => frame.source === 'background-only-support')
      .map((frame) => frame.appFrame);
  },

  recomputeBackgroundOnlyRotoSupport(layerId: string, requestedFrames: readonly number[]): PhysicPaintRotoCacheFrame[] {
    const { changed, supportFrames } = _recomputeBackgroundOnlyRotoSupport(layerId, requestedFrames);
    if (changed) _notifyVisualChange();
    return supportFrames;
  },

  removeBackgroundOnlyRotoSupport(layerId: string, frames?: Iterable<number>): boolean {
    const changed = _removeBackgroundOnlyRotoSupport(layerId, frames);
    if (changed) _notifyVisualChange();
    return changed;
  },


  removeFrameRange(layerId: string, startFrame: number, frameCount: number): void {
    if (!Number.isInteger(startFrame) || startFrame < 0 || !Number.isInteger(frameCount) || frameCount < 1) return;
    const layerFrames = _frames.get(layerId);
    const generatedMetadata = _rotoGeneratedCacheMetadata.get(layerId);
    if (!layerFrames && !generatedMetadata) return;
    let changed = false;
    for (let offset = 0; offset < frameCount; offset++) {
      const frame = startFrame + offset;
      changed = (layerFrames?.delete(frame) ?? false) || changed;
      changed = (generatedMetadata?.delete(frame) ?? false) || changed;
    }
    if (layerFrames?.size === 0) _frames.delete(layerId);
    if (generatedMetadata?.size === 0) _rotoGeneratedCacheMetadata.delete(layerId);
    if (changed) _notifyVisualChange();
  },

  applyCanvas(payload: PhysicPaintApplyPayload): PhysicPaintApplyResult {
    if (!isPhysicPaintApplyPayload(payload)) {
      return _errorResult(payload, 'Invalid physics paint apply payload');
    }
    if (payload.kind !== 'apply-canvas') {
      return _errorResult(payload, 'Expected apply-canvas payload');
    }

    const physicalRecord = this.getRotoRealKeyRecordByAppFrame(payload.layerId, payload.startFrame);
    if (physicalRecord) {
      const currentRevision = this.getRotoPhysicalContentRevision(payload.layerId);
      if (!currentRevision) return _errorResult(payload, 'Physical Roto content revision is unavailable');
      const previousBackground = _rotoBackgroundMetadata.get(payload.layerId) ?? null;
      const nextBackground = payload.rotoBackground ?? previousBackground;
      if (nextBackground) _rotoBackgroundMetadata.set(payload.layerId, { ...nextBackground });
      else _rotoBackgroundMetadata.delete(payload.layerId);
      const update = this.updateRotoPhysicalRealKeyPayload(payload.layerId, physicalRecord.keyId, currentRevision, {
        frameIndex: payload.renderedFrame.frameIndex,
        appFrame: physicalRecord.appFrame,
        dataUrl: payload.renderedFrame.dataUrl,
        ...(payload.renderedFrame.width !== undefined ? { width: payload.renderedFrame.width } : {}),
        ...(payload.renderedFrame.height !== undefined ? { height: payload.renderedFrame.height } : {}),
      });
      if (!update.ok) {
        if (previousBackground) _rotoBackgroundMetadata.set(payload.layerId, previousBackground);
        else _rotoBackgroundMetadata.delete(payload.layerId);
        return _errorResult(payload, update.error);
      }
      if (!update.changed && JSON.stringify(previousBackground) !== JSON.stringify(nextBackground)) _notifyVisualChange();
    } else {
      const rotoBackground = payload.rotoBackground ?? null;
      if (rotoBackground) _rotoBackgroundMetadata.set(payload.layerId, { ...rotoBackground });
      this.upsertRealRotoKeyFrame(payload.layerId, payload.sourceFrame ?? payload.startFrame, { ...payload.renderedFrame, ...(payload.onionDataUrl ? { onionDataUrl: payload.onionDataUrl } : {}) }, payload.backgroundOnly === true);
      if (payload.rotoInterpolationSettings) this.setRotoInterpolationSettings(payload.layerId, payload.rotoInterpolationSettings);
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

    this.removeRealRotoKeyFrame(payload.layerId, payload.sourceFrame ?? payload.startFrame);
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

    const previousGenerated = _removeGeneratedRotoCache(payload.layerId);
    if (payload.rotoBackground) {
      _rotoBackgroundMetadata.set(payload.layerId, { ...payload.rotoBackground });
    }
    if (payload.rotoInterpolationSettings) {
      _rotoInterpolationSettings.set(payload.layerId, _normalizeRotoInterpolationSettings(payload.rotoInterpolationSettings));
    }
    const previousSupportFrames = this.getBackgroundOnlyRotoSupportFrames(payload.layerId);
    const previousSupport = _removeBackgroundOnlyRotoSupport(payload.layerId);
    const previousRealKeys = _getRealRotoKeyFrames(payload.layerId);
    const layerFrames = _getOrCreateLayer(payload.layerId);
    const metadata = _getOrCreateRotoMetadata(payload.layerId);
    for (const frame of previousRealKeys) {
      layerFrames.delete(frame);
      metadata.delete(frame);
    }
    for (const frame of payload.frames) {
      const sourceFrame = frame.sourceFrame ?? frame.appFrame;
      const normalizedFrame = { ...frame, appFrame: sourceFrame, frameIndex: 0, source: 'real-key' as const };
      layerFrames.set(sourceFrame, normalizedFrame);
      metadata.set(sourceFrame, _normalizeRealRotoCacheFrame(normalizedFrame, sourceFrame, frame.backgroundOnly || undefined));
    }
    if (layerFrames.size === 0) _frames.delete(payload.layerId);
    if (metadata.size === 0) _rotoCacheMetadata.delete(payload.layerId);
    const supportRecompute = _recomputeBackgroundOnlyRotoSupport(payload.layerId, previousSupportFrames);
    const { changed, generatedFrames } = _tryRegenerateGeneratedRotoCache(payload.layerId, this.getRotoInterpolationSettings(payload.layerId));
    if (previousGenerated || previousSupport || supportRecompute.changed || previousRealKeys.length > 0 || payload.frames.length > 0 || changed || generatedFrames.length > 0) _notifyVisualChange();
    return {
      operationId: payload.operationId,
      kind: payload.kind,
      layerId: payload.layerId,
      startFrame: payload.startFrame,
      appliedFrameCount: payload.frames.length,
      ok: true,
    };
  },

  snapshotLayer(layerId: string): PhysicPaintLayerSnapshot | null {
    const frames = _frames.get(layerId);
    const rotoBackground = _rotoBackgroundMetadata.get(layerId);
    const rotoCacheMetadata = _rotoCacheMetadata.get(layerId);
    const rotoGeneratedCacheMetadata = _rotoGeneratedCacheMetadata.get(layerId);
    const rotoInterpolationSettings = _rotoInterpolationSettings.get(layerId);
    const rotoInterpolationFailureStatus = _rotoInterpolationFailureStatus.get(layerId);
    const rotoPlaybackSettings = _rotoPlaybackSettings.get(layerId);
    const alphaCanvases: Array<[string, HTMLCanvasElement]> = [];
    for (const dataUrl of _getLayerDataUrls(layerId)) {
      const canvas = _rotoAlphaCanvasRegistry.get(dataUrl);
      if (canvas) alphaCanvases.push([dataUrl, canvas]);
    }
    if (!frames && !rotoBackground && !rotoCacheMetadata && !rotoGeneratedCacheMetadata && !rotoInterpolationSettings && !rotoInterpolationFailureStatus && !rotoPlaybackSettings && alphaCanvases.length === 0) return null;
    return {
      layerId,
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
    const { layerId } = snapshot;
    _clearLayerState(layerId);
    if (snapshot.frames) _frames.set(layerId, new Map(snapshot.frames.map(([frame, value]) => [frame, { ...value }])));
    if (snapshot.rotoBackground) _rotoBackgroundMetadata.set(layerId, { ...snapshot.rotoBackground });
    if (snapshot.rotoCacheMetadata) _rotoCacheMetadata.set(layerId, new Map(snapshot.rotoCacheMetadata.map(([frame, value]) => [frame, { ...value }])));
    if (snapshot.rotoGeneratedCacheMetadata) _rotoGeneratedCacheMetadata.set(layerId, new Map(snapshot.rotoGeneratedCacheMetadata.map(([frame, value]) => [frame, { ...value }])));
    if (snapshot.rotoInterpolationSettings) _rotoInterpolationSettings.set(layerId, _cloneRotoInterpolationSettings(snapshot.rotoInterpolationSettings));
    if (snapshot.rotoInterpolationFailureStatus) _rotoInterpolationFailureStatus.set(layerId, snapshot.rotoInterpolationFailureStatus);
    if (snapshot.rotoPlaybackSettings) _rotoPlaybackSettings.set(layerId, { ...snapshot.rotoPlaybackSettings });
    for (const [dataUrl, canvas] of snapshot.alphaCanvases) {
      if (!_rotoAlphaCanvasRegistry.has(dataUrl)) _rotoAlphaCanvasRegistry.set(dataUrl, canvas);
    }
    _notifyVisualChange();
  },

  hasOutput(layerId: string): boolean {
    return (_frames.get(layerId)?.size ?? 0) > 0;
  },

  clearLayer(layerId: string): void {
    if (_clearLayerState(layerId)) _notifyVisualChange();
  },

  reset(options?: { preserveRotoAlphaCanvases?: boolean }): void {
    const resetAlphaCanvases = options?.preserveRotoAlphaCanvases !== true;
    if (_frames.size === 0 && _rotoBackgroundMetadata.size === 0 && _rotoCacheMetadata.size === 0 && _rotoGeneratedCacheMetadata.size === 0 && _rotoInterpolationSettings.size === 0 && _rotoInterpolationFailureStatus.size === 0 && (!resetAlphaCanvases || _rotoAlphaCanvasRegistry.size === 0) && _rotoRealKeyRecords.size === 0 && _rotoPhysicalInterpolationState.size === 0 && _rotoPhysicalScriptMotion.size === 0 && _rotoPhysicalLoopClips.size === 0 && _rotoPhysicalSelectedKeyId.size === 0 && _rotoPhysicalCursorAppFrame.size === 0 && _rotoPhysicalCapacity.size === 0 && _rotoPlaybackSettings.size === 0) return;
    _frames.clear();
    _rotoBackgroundMetadata.clear();
    _rotoCacheMetadata.clear();
    _rotoGeneratedCacheMetadata.clear();
    _rotoInterpolationSettings.clear();
    _rotoInterpolationFailureStatus.clear();
    if (resetAlphaCanvases) _rotoAlphaCanvasRegistry.clear();
    _rotoRealKeyRecords.clear();
    _rotoPhysicalInterpolationState.clear();
    _rotoPhysicalScriptMotion.clear();
    _rotoPhysicalLoopClips.clear();
    _rotoPhysicalSelectedKeyId.clear();
    _rotoPhysicalCursorAppFrame.clear();
    _rotoPhysicalCapacity.clear();
    _rotoPlaybackSettings.clear();
    _rotoPhysicalStructuralCache.clear();
    _notifyVisualChange();
  },

  pruneUnreferencedRotoAlphaCanvases(dataUrls: Iterable<string>): void {
    _pruneUnreferencedRotoAlphaCanvases(dataUrls);
  },

  _debugSerializationRevision(): number {
    return _serializationRevision;
  },

  _debugCachedSerializationRevision(): number {
    return _cachedSerializationRevision;
  },

  _debugInvalidateSerializationCache(): void {
    _invalidateSerializationCache();
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
   * Validate and replace the complete per-layer physical real-key record
   * collection and canonical interpolation state atomically. Returns a
   * closed success/failure result; failure changes nothing.
   */
  replaceRotoPhysicalRecords(
    layerId: string,
    records: unknown,
    interpolation: unknown,
    capacity: number,
  ): { ok: true } | { ok: false; error: string } {
    if (!layerId || typeof layerId !== 'string') {
      return { ok: false, error: 'Layer ID must be a non-empty string.' };
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
    const projectionResult = projectPhysicPaintRotoPhysicalTimeline({
      identities,
      capacity,
      interpolationEnabled: interpolation.enabled,
    });
    if (!projectionResult.ok) {
      return { ok: false, error: projectionResult.failure.text };
    }

    const previousRecords = this.getRotoRealKeyRecords(layerId);
    const previousPayloadDataUrls = new Set(previousRecords.map((record) => record.payload.dataUrl));
    const previousInterpolation = this.getRotoPhysicalInterpolationState(layerId);
    const previousCapacity = this.getRotoPhysicalCapacity(layerId);
    // Records-only replacement: the Loop Clip collection is untouched, so both
    // sides of the revision comparison carry the current collection.
    const currentLoopClips = this.getRotoPhysicalLoopClips(layerId);
    const previousRevision = buildPhysicPaintRotoPhysicalRevision(previousRecords, previousInterpolation, currentLoopClips);
    const nextRevision = buildPhysicPaintRotoPhysicalRevision(validatedRecords, interpolation, currentLoopClips);
    if (_rotoRealKeyRecords.has(layerId) && previousRevision === nextRevision && previousCapacity === capacity) return { ok: true };

    // Atomically replace the complete record set and indexes.
    const recordMap = new Map<string, PhysicPaintRotoRealKeyRecord>();
    for (const record of validatedRecords) recordMap.set(record.keyId, record);
    _rotoRealKeyRecords.set(layerId, recordMap);
    _rotoPhysicalInterpolationState.set(layerId, Object.freeze({
      enabled: interpolation.enabled,
      mode: interpolation.mode,
    }) as PhysicPaintRotoInterpolationState);
    if (!_rotoPhysicalScriptMotion.has(layerId)) _rotoPhysicalScriptMotion.set(layerId, PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO);
    const previousSelectedKeyId = _rotoPhysicalSelectedKeyId.get(layerId) ?? null;
    const selectedRecord = previousSelectedKeyId === null ? null : recordMap.get(previousSelectedKeyId) ?? null;
    _rotoPhysicalSelectedKeyId.set(layerId, selectedRecord?.keyId ?? null);
    _rotoPhysicalCursorAppFrame.set(layerId, selectedRecord?.appFrame ?? Math.min(_rotoPhysicalCursorAppFrame.get(layerId) ?? 0, capacity - 1));
    _rotoPhysicalCapacity.set(layerId, capacity);
    _pruneUnreferencedRotoAlphaCanvases(previousPayloadDataUrls);
    rotoPhysicalRevision.value = rotoPhysicalRevision.value + 1;
    _notifyVisualChange();
    return { ok: true };
  },

  /** Install one complete validated physical document atomically. */
  replaceRotoPhysicalDocument(
    layerId: string,
    value: unknown,
  ): { ok: true; document: PhysicPaintRotoPhysicalDocument } | { ok: false; error: string } {
    if (!layerId || typeof layerId !== 'string') return { ok: false, error: 'Layer ID must be a non-empty string.' };
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
    });
    if (!projection.ok) return { ok: false, error: projection.failure.text };

    const previousPayloadDataUrls = new Set(this.getRotoRealKeyRecords(layerId).map((record) => record.payload.dataUrl));
    _rotoRealKeyRecords.set(layerId, new Map(document.realKeyRecords.map((record) => [record.keyId, record])));
    _rotoPhysicalInterpolationState.set(layerId, document.interpolation);
    _rotoPhysicalScriptMotion.set(layerId, document.scriptMotion);
    _rotoPhysicalLoopClips.set(layerId, document.loopClips);
    _rotoPhysicalSelectedKeyId.set(layerId, document.selectedKeyId);
    _rotoPhysicalCursorAppFrame.set(layerId, document.cursorAppFrame);
    _rotoPhysicalCapacity.set(layerId, document.capacity);
    if (document.background) _rotoBackgroundMetadata.set(layerId, { ...document.background });
    else _rotoBackgroundMetadata.delete(layerId);
    _pruneUnreferencedRotoAlphaCanvases(previousPayloadDataUrls);
    rotoPhysicalRevision.value = rotoPhysicalRevision.value + 1;
    _notifyVisualChange();
    return { ok: true, document };
  },

  /** Return the complete canonical physical document for persistence/launch. */
  getRotoPhysicalDocument(layerId: string): PhysicPaintRotoPhysicalDocument | null {
    if (!_rotoRealKeyRecords.has(layerId)) return null;
    const realKeyRecords = this.getRotoRealKeyRecords(layerId);
    const interpolation = this.getRotoPhysicalInterpolationState(layerId);
    const capacity = this.getRotoPhysicalCapacity(layerId);
    const selectedCandidate = _rotoPhysicalSelectedKeyId.get(layerId) ?? null;
    const selectedRecord = selectedCandidate === null ? null : realKeyRecords.find((record) => record.keyId === selectedCandidate) ?? null;
    const cursorCandidate = selectedRecord?.appFrame ?? _rotoPhysicalCursorAppFrame.get(layerId) ?? 0;
    return parsePhysicPaintRotoPhysicalDocument({
      capacity,
      realKeyRecords,
      interpolation,
      scriptMotion: _rotoPhysicalScriptMotion.get(layerId) ?? PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO,
      background: _rotoBackgroundMetadata.get(layerId) ?? null,
      selectedKeyId: selectedRecord?.keyId ?? null,
      cursorAppFrame: Math.max(0, Math.min(capacity - 1, cursorCandidate)),
      // 38.1-07: memoized structural read — identical revision string without
      // the per-read dataUrl-inclusive rehash.
      revision: this.getRotoPhysicalContentRevision(layerId)!,
      loopClips: this.getRotoPhysicalLoopClips(layerId),
    });
  },

  setRotoPhysicalSelection(layerId: string, selectedKeyId: string | null, cursorAppFrame: number): { ok: true } | { ok: false; error: string } {
    const capacity = this.getRotoPhysicalCapacity(layerId);
    if (!Number.isInteger(cursorAppFrame) || cursorAppFrame < 0 || cursorAppFrame >= capacity) return { ok: false, error: 'Physical cursor is outside capacity.' };
    if (selectedKeyId !== null) {
      const record = this.getRotoRealKeyRecord(layerId, selectedKeyId);
      if (!record || record.appFrame !== cursorAppFrame) return { ok: false, error: 'Physical selection does not match the cursor.' };
    }
    _rotoPhysicalSelectedKeyId.set(layerId, selectedKeyId);
    _rotoPhysicalCursorAppFrame.set(layerId, cursorAppFrame);
    _invalidateSerializationCache();
    return { ok: true };
  },

  setRotoPhysicalScriptMotion(layerId: string, value: unknown): { ok: true } | { ok: false; error: string } {
    try {
      const current = this.getRotoPhysicalDocument(layerId);
      if (!current) return { ok: false, error: 'Physical Roto layer does not exist.' };
      const next = parsePhysicPaintRotoPhysicalDocument({ ...current, scriptMotion: value });
      _rotoPhysicalScriptMotion.set(layerId, next.scriptMotion);
      _invalidateSerializationCache();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Invalid Script Motion settings.' };
    }
  },

  /**
   * Read all ordered real-key records for a layer. Returns a fresh array sorted
   * by ascending physical `appFrame`.
   */
  getRotoRealKeyRecords(layerId: string): PhysicPaintRotoRealKeyRecord[] {
    const recordMap = _rotoRealKeyRecords.get(layerId);
    if (!recordMap) return [];
    return Array.from(recordMap.values()).sort((a, b) => a.appFrame - b.appFrame);
  },

  /**
   * Read a single real-key record by stable `keyId`. Returns null when absent.
   */
  getRotoRealKeyRecord(layerId: string, keyId: string): PhysicPaintRotoRealKeyRecord | null {
    const record = _rotoRealKeyRecords.get(layerId)?.get(keyId);
    return record ?? null;
  },

  /**
   * Read a single real-key record by direct `appFrame`. Returns null when no
   * real key occupies that frame.
   */
  getRotoRealKeyRecordByAppFrame(layerId: string, appFrame: number): PhysicPaintRotoRealKeyRecord | null {
    const recordMap = _rotoRealKeyRecords.get(layerId);
    if (!recordMap) return null;
    for (const record of recordMap.values()) {
      if (record.appFrame === appFrame) return record;
    }
    return null;
  },

  /**
   * Read the durable linked Loop Clip collection for a layer (Phase 43,
   * D-29). Returns the shared frozen empty collection when no physical state
   * has been published.
   */
  getRotoPhysicalLoopClips(layerId: string): readonly PhysicPaintRotoLoopClip[] {
    return _rotoPhysicalLoopClips.get(layerId) ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY;
  },

  /**
   * Validate and atomically replace the complete per-layer Loop Clip
   * collection (Phase 43, D-29). Records and interpolation are untouched.
   * Failure changes nothing; an accepted change publishes one visible change
   * and moves the canonical content revision (loops join the fingerprint, Q1).
   */
  replaceRotoPhysicalLoopClips(
    layerId: string,
    value: unknown,
  ): { ok: true } | { ok: false; error: string } {
    if (!layerId || typeof layerId !== 'string') {
      return { ok: false, error: 'Layer ID must be a non-empty string.' };
    }
    if (!_rotoRealKeyRecords.has(layerId)) {
      return { ok: false, error: 'Physical Roto layer does not exist.' };
    }
    let validated: readonly PhysicPaintRotoLoopClip[];
    try {
      validated = parsePhysicPaintRotoLoopClips(value);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Invalid Loop Clip collection.' };
    }
    const current = this.getRotoPhysicalLoopClips(layerId);
    if (current.length === validated.length && current.every((clip, index) => {
      const next = validated[index];
      return next !== undefined
        && clip.loopId === next.loopId
        && clip.placementStart === next.placementStart
        && clip.repeat === next.repeat
        && clip.mode === next.mode
        && clip.sourceKeyIds.length === next.sourceKeyIds.length
        && clip.sourceKeyIds.every((keyId, keyIndex) => keyId === next.sourceKeyIds[keyIndex]);
    })) {
      return { ok: true };
    }
    _rotoPhysicalLoopClips.set(layerId, validated);
    rotoPhysicalRevision.value = rotoPhysicalRevision.value + 1;
    _notifyVisualChange();
    return { ok: true };
  },

  /**
   * Read the canonical interpolation state for a layer. Returns the
   * immutable disabled default when no physical state has been published.
   */
  getRotoPhysicalInterpolationState(layerId: string): PhysicPaintRotoInterpolationState {
    const state = _rotoPhysicalInterpolationState.get(layerId);
    return state ?? PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED;
  },

  /**
   * Set the canonical interpolation state for a layer. Validates the state
   * and publishes one visible change. Per D-02, this cannot move real keys or
   * touch Script Motion.
   */
  setRotoPhysicalInterpolationState(layerId: string, state: unknown): { ok: true } | { ok: false; error: string } {
    if (!isPhysicPaintRotoInterpolationState(state)) {
      return { ok: false, error: 'Interpolation state must include canonical enabled and mode fields.' };
    }
    const current = this.getRotoPhysicalInterpolationState(layerId);
    if (current.enabled === state.enabled && current.mode === state.mode) return { ok: true };
    _rotoPhysicalInterpolationState.set(layerId, Object.freeze({
      enabled: state.enabled,
      mode: state.mode,
    }) as PhysicPaintRotoInterpolationState);
    rotoPhysicalRevision.value = rotoPhysicalRevision.value + 1;
    _notifyVisualChange();
    return { ok: true };
  },

  /**
   * Read the bounded physical frame capacity for a layer.
   */
  getRotoPhysicalCapacity(layerId: string): number {
    return _rotoPhysicalCapacity.get(layerId) ?? PHYSIC_PAINT_MAX_APPLY_FRAMES;
  },

  /**
   * Read the current physical timeline projection for a layer. Derives ordered
   * assignments, exact runtime generated interiors, and bounded
   * real/generated/empty physical cells from the validated record set and
   * canonical interpolation state using the shared projection seam.
   */
  getRotoPhysicalProjection(layerId: string): PhysicPaintRotoPhysicalTimelineProjection | null {
    const structural = _resolveRotoPhysicalStructural(layerId);
    if (!structural) return null;
    return structural.projection;
  },

  getRotoPhysicalContentRevision(layerId: string): string | null {
    const structural = _resolveRotoPhysicalStructural(layerId);
    if (!structural) return null;
    return structural.contentRevision;
  },

  /**
   * Loop-aware physical end frame (Phase 43, Pitfall 3): max of last real
   * key + 1 and every loop's effective end, read from the memoized interval
   * derivation — never by iterating virtual frames (D-32). Loop effective
   * ends are already bounded by the parent end and the capacity inside the
   * derivation (D-25/Q4). No loops and no keys still returns null.
   */
  getRotoPhysicalEndFrame(layerId: string): number | null {
    const records = this.getRotoRealKeyRecords(layerId);
    const lastRealEnd = records.length === 0 ? null : records[records.length - 1].appFrame + 1;
    let loopEnd: number | null = null;
    const structural = _resolveRotoPhysicalStructural(layerId);
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
   * this to block; the block itself lands in 43-09.
   */
  getRotoPhysicalUnresolvedLoops(
    layerId: string,
    fromFrame: number,
    toFrame: number,
  ): readonly PhysicPaintRotoPhysicalUnresolvedLoop[] {
    if (!Number.isInteger(fromFrame) || !Number.isInteger(toFrame) || fromFrame < 0 || toFrame <= fromFrame) return [];
    const structural = _resolveRotoPhysicalStructural(layerId);
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
  getRotoPhysicalRenderSource(layerId: string, appFrame: number): PhysicPaintRotoPhysicalRenderSource | null {
    if (!Number.isInteger(appFrame) || appFrame < 0) return null;
    const structural = _resolveRotoPhysicalStructural(layerId);
    if (!structural || !structural.projection) return null;
    const projection = structural.projection;
    const contentRevision = structural.contentRevision;
    const cell = projection.cells[appFrame];
    if (cell && cell.appFrame === appFrame && cell.kind === 'real') {
      const record = this.getRotoRealKeyRecord(layerId, cell.keyId);
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
      const left = this.getRotoRealKeyRecord(layerId, cell.leftKeyId);
      const right = this.getRotoRealKeyRecord(layerId, cell.rightKeyId);
      if (!left || !right || !(left.appFrame < appFrame && appFrame < right.appFrame)) return null;
      const interpolation = this.getRotoPhysicalInterpolationState(layerId);
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
        const record = this.getRotoRealKeyRecord(layerId, resolution.keyId);
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
        const record = this.getRotoRealKeyRecord(layerId, resolution.sourceKeyId);
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

  /** Publish live pixels only when the stable key and source content revision still match. */
  updateRotoPhysicalRealKeyPayload(
    layerId: string,
    keyId: string,
    expectedContentRevision: string,
    payload: PhysicPaintRotoRealKeyPayload,
    diagnostics?: { mutationId?: number; record: (sample: PhysicsPaintPerformanceSample) => void },
  ): { ok: true; changed: boolean; contentRevision: string } | { ok: false; error: string } {
    const currentRevision = this.getRotoPhysicalContentRevision(layerId);
    const current = this.getRotoRealKeyRecord(layerId, keyId);
    const reject = (error: string): { ok: false; error: string } => {
      _pruneUnreferencedRotoAlphaCanvases([payload.dataUrl]);
      return { ok: false, error };
    };
    if (!currentRevision || currentRevision !== expectedContentRevision || !current) return reject('Physical identity or content revision changed.');
    if (payload.appFrame !== current.appFrame) return reject('Rendered payload does not match the current physical placement.');
    const records = this.getRotoRealKeyRecords(layerId);
    let validated: readonly PhysicPaintRotoRealKeyRecord[];
    try {
      validated = parsePhysicPaintRotoRealKeyRecordCollection(records.map((record) => record.keyId === keyId ? { ...record, payload } : record), this.getRotoPhysicalCapacity(layerId));
    } catch (error) {
      return reject(error instanceof Error ? error.message : 'Invalid physical render payload.');
    }
    const nextRevision = buildPhysicPaintRotoPhysicalRevision(validated, this.getRotoPhysicalInterpolationState(layerId), this.getRotoPhysicalLoopClips(layerId));
    if (nextRevision === currentRevision) return { ok: true, changed: false, contentRevision: currentRevision };
    _rotoRealKeyRecords.set(layerId, new Map(validated.map((record) => [record.keyId, record])));
    _pruneUnreferencedRotoAlphaCanvases([current.payload.dataUrl]);
    rotoPhysicalRevision.value = rotoPhysicalRevision.value + 1;
    _notifyVisualChange(diagnostics);
    return { ok: true, changed: true, contentRevision: nextRevision };
  },

  /**
   * Clear the physical record ownership for a layer. Used during layer
   * replacement/disposal.
   */
  clearRotoPhysicalRecords(layerId: string): void {
    const previousPayloadDataUrls = new Set(this.getRotoRealKeyRecords(layerId).map((record) => record.payload.dataUrl));
    _rotoRealKeyRecords.delete(layerId);
    _rotoPhysicalInterpolationState.delete(layerId);
    _rotoPhysicalScriptMotion.delete(layerId);
    _rotoPhysicalLoopClips.delete(layerId);
    _rotoPhysicalSelectedKeyId.delete(layerId);
    _rotoPhysicalCursorAppFrame.delete(layerId);
    _rotoPhysicalCapacity.delete(layerId);
    _rotoPhysicalStructuralCache.delete(layerId);
    _pruneUnreferencedRotoAlphaCanvases(previousPayloadDataUrls);
    _invalidateSerializationCache();
  },
};
