import { signal } from '@preact/signals';
import type { PhysicPaintApplyPayload, PhysicPaintApplyResult, PhysicPaintRenderedFrame, PhysicPaintRotoBackgroundMetadata, PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings } from '../types/physicPaint';
import { PHYSIC_PAINT_MAX_APPLY_FRAMES, isPhysicPaintApplyPayload, isPhysicPaintRotoBackgroundMetadata, isPhysicPaintRotoCacheFrame, isPhysicPaintRotoInterpolationSettings, type PhysicPaintRotoSegmentSpacingOverride } from '../types/physicPaint';
import { getExpandedRotoRealKeyFrames } from '../components/physic-paint/roto/physicsPaintRotoWorkflow';
import { resolveMissingRotoFrameDraw } from '../lib/rotoFrameDraw';
import type { PhysicsPaintPerformanceSample } from '../components/physic-paint/performance/physicsPaintPerformanceTrace';

let _markProjectDirty: (() => void) | null = null;
export function _setPhysicPaintMarkDirtyCallback(cb: () => void) { _markProjectDirty = cb; }

export const physicPaintVersion = signal(0);

type PhysicPaintMceOutput = {
  layer_id: string;
  frames: PhysicPaintRenderedFrame[];
  roto_cache_metadata?: PhysicPaintRotoCacheFrame[];
  roto_interpolation_settings?: PhysicPaintRotoInterpolationSettings;
  roto_background?: PhysicPaintRotoBackgroundMetadata;
};

type PhysicPaintMceOutputInput = PhysicPaintMceOutput;

export type PhysicPaintLayerSnapshot = {
  layerId: string;
  frames?: Array<[number, PhysicPaintRenderedFrame]>;
  rotoBackground?: PhysicPaintRotoBackgroundMetadata;
  rotoCacheMetadata?: Array<[number, PhysicPaintRotoCacheFrame]>;
  rotoGeneratedCacheMetadata?: Array<[number, PhysicPaintRotoCacheFrame]>;
  rotoInterpolationSettings?: PhysicPaintRotoInterpolationSettings;
  rotoInterpolationFailureStatus?: string;
  alphaCanvases: Array<[string, HTMLCanvasElement]>;
};

const DEFAULT_ROTO_INTERPOLATION_SETTINGS: PhysicPaintRotoInterpolationSettings = {
  enabled: false,
  inBetweenCount: 1,
  mode: 'duplicate',
  position: 0,
  deform: 0,
};

const _rotoAlphaCanvasRegistry = new Map<string, HTMLCanvasElement>();

export function registerRotoAlphaCanvasFrame(dataUrl: string, canvas: HTMLCanvasElement): void {
  if (!dataUrl.startsWith('data:image/png') || canvas.width <= 0 || canvas.height <= 0) return;
  _rotoAlphaCanvasRegistry.set(dataUrl, canvas);
}

const _frames = new Map<string, Map<number, PhysicPaintRenderedFrame>>();
const _rotoBackgroundMetadata = new Map<string, PhysicPaintRotoBackgroundMetadata>();
const _rotoCacheMetadata = new Map<string, Map<number, PhysicPaintRotoCacheFrame>>();
const _rotoGeneratedCacheMetadata = new Map<string, Map<number, PhysicPaintRotoCacheFrame>>();
const _rotoInterpolationSettings = new Map<string, PhysicPaintRotoInterpolationSettings>();
const _rotoInterpolationFailureStatus = new Map<string, string>();
const ROTO_INTERPOLATION_FAILURE_STATUS = 'Generated in-betweens could not regenerate. Real keys were kept.';
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
  return false;
}

function _clearLayerState(layerId: string): boolean {
  const dataUrls = _getLayerDataUrls(layerId);
  let changed = false;
  changed = _frames.delete(layerId) || changed;
  changed = _rotoBackgroundMetadata.delete(layerId) || changed;
  changed = _rotoCacheMetadata.delete(layerId) || changed;
  changed = _rotoGeneratedCacheMetadata.delete(layerId) || changed;
  changed = _rotoInterpolationSettings.delete(layerId) || changed;
  changed = _rotoInterpolationFailureStatus.delete(layerId) || changed;
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

function _notifyVisualChange(diagnostics?: { mutationId?: number; record: (sample: PhysicsPaintPerformanceSample) => void }): void {
  const notificationStartedAt = diagnostics ? performance.now() : 0;
  _invalidateSerializationCache();
  physicPaintVersion.value++;
  const dirtyStartedAt = diagnostics ? performance.now() : 0;
  _markProjectDirty?.();
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

function _decodeAlphaSource(dataUrl: string): string {
  const payload = dataUrl.split(',')[1] ?? '';
  if (typeof atob === 'function') return atob(payload);
  return payload;
}

function _encodeAlphaSource(source: string): string {
  const encoded = typeof btoa === 'function'
    ? btoa(source)
    : Buffer.from(source, 'utf8').toString('base64');
  return `data:image/png;base64,${encoded}`;
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

function _blendAlphaDataUrl(firstKeyFrame: PhysicPaintRenderedFrame, secondKeyFrame: PhysicPaintRenderedFrame, t: number): string {
  const canvasBlend = _blendRegisteredAlphaCanvasDataUrl(firstKeyFrame, secondKeyFrame, t);
  if (canvasBlend) return canvasBlend;
  const firstAlpha = 1 - t;
  const secondAlpha = t;
  const firstSource = _decodeAlphaSource(firstKeyFrame.dataUrl);
  const secondSource = _decodeAlphaSource(secondKeyFrame.dataUrl);
  const blendedSource = `roto-alpha:${firstAlpha.toFixed(6)}:${firstSource}:${secondAlpha.toFixed(6)}:${secondSource}`;
  return _encodeAlphaSource(blendedSource);
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

export function renderBlendedRotoInterpolationFrame(firstKeyFrame: PhysicPaintRenderedFrame, secondKeyFrame: PhysicPaintRenderedFrame, targetFrame: number, t: number, _settings: PhysicPaintRotoInterpolationSettings): PhysicPaintRenderedFrame {
  return _withGeneratedAppFrame({
    frameIndex: 0,
    appFrame: targetFrame,
    dataUrl: _blendAlphaDataUrl(firstKeyFrame, secondKeyFrame, t),
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
    const layerIds = new Set([..._frames.keys(), ..._rotoCacheMetadata.keys(), ..._rotoInterpolationSettings.keys(), ..._rotoBackgroundMetadata.keys()]);
    const outputs = Array.from(layerIds).map((layerId) => ({
      layer_id: layerId,
      frames: Array.from(_frames.get(layerId)?.values() ?? []).sort((a, b) => a.appFrame - b.appFrame),
      ...(_rotoCacheMetadata.has(layerId) ? { roto_cache_metadata: Array.from(_rotoCacheMetadata.get(layerId)!.values()).sort((a, b) => a.appFrame - b.appFrame) } : {}),
      ...(_rotoInterpolationSettings.has(layerId) ? { roto_interpolation_settings: _serializeRotoInterpolationSettings(_rotoInterpolationSettings.get(layerId)!) } : {}),
      ...(_rotoBackgroundMetadata.has(layerId) ? { roto_background: { ..._rotoBackgroundMetadata.get(layerId)! } } : {}),
    })).filter((output) => output.frames.length > 0 || output.roto_cache_metadata || output.roto_interpolation_settings || output.roto_background);
    _cachedMceOutputs = structuredClone(outputs);
    _cachedSerializationRevision = _serializationRevision;
    return outputs;
  },

  loadFromMceOutputs(outputs: PhysicPaintMceOutputInput[] | null | undefined): void {
    _frames.clear();
    _rotoBackgroundMetadata.clear();
    _rotoCacheMetadata.clear();
    _rotoGeneratedCacheMetadata.clear();
    _rotoInterpolationSettings.clear();
    _rotoInterpolationFailureStatus.clear();
    _rotoBackgroundMetadata.clear();
    for (const output of outputs ?? []) {
      const layerFrames = new Map<number, PhysicPaintRenderedFrame>();
      for (const frame of output.frames ?? []) layerFrames.set(frame.appFrame, { ...frame });
      if (layerFrames.size > 0) _frames.set(output.layer_id, layerFrames);
      const real = new Map<number, PhysicPaintRotoCacheFrame>();
      const generated = new Map<number, PhysicPaintRotoCacheFrame>();
      for (const frame of output.roto_cache_metadata ?? []) {
        if (!isPhysicPaintRotoCacheFrame(frame)) continue;
        (frame.source === 'generated-interpolation' ? generated : real).set(frame.appFrame, { ...frame });
      }
      if (real.size > 0) _rotoCacheMetadata.set(output.layer_id, real);
      if (generated.size > 0) _rotoGeneratedCacheMetadata.set(output.layer_id, generated);
      if (isPhysicPaintRotoInterpolationSettings(output.roto_interpolation_settings)) {
        const realKeys = _getRealRotoKeyFrames(output.layer_id);
        const settings = _normalizeRotoInterpolationSettings(output.roto_interpolation_settings, realKeys);
        _rotoInterpolationSettings.set(output.layer_id, settings);
        if (settings.enabled) _tryRegenerateGeneratedRotoCache(output.layer_id, settings);
      }
      if (isPhysicPaintRotoBackgroundMetadata(output.roto_background)) _rotoBackgroundMetadata.set(output.layer_id, { ...output.roto_background });
      _pruneFramesOutsideRotoCacheMetadata(output.layer_id);
    }
    _invalidateSerializationCache();
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

    const rotoBackground = payload.rotoBackground ?? null;
    if (rotoBackground) {
      _rotoBackgroundMetadata.set(payload.layerId, { ...rotoBackground });
    }
    this.upsertRealRotoKeyFrame(payload.layerId, payload.sourceFrame ?? payload.startFrame, { ...payload.renderedFrame, ...(payload.onionDataUrl ? { onionDataUrl: payload.onionDataUrl } : {}) }, payload.backgroundOnly === true);
    if (payload.rotoInterpolationSettings) this.setRotoInterpolationSettings(payload.layerId, payload.rotoInterpolationSettings);
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
    const alphaCanvases: Array<[string, HTMLCanvasElement]> = [];
    for (const dataUrl of _getLayerDataUrls(layerId)) {
      const canvas = _rotoAlphaCanvasRegistry.get(dataUrl);
      if (canvas) alphaCanvases.push([dataUrl, canvas]);
    }
    if (!frames && !rotoBackground && !rotoCacheMetadata && !rotoGeneratedCacheMetadata && !rotoInterpolationSettings && !rotoInterpolationFailureStatus && alphaCanvases.length === 0) return null;
    return {
      layerId,
      ...(frames ? { frames: Array.from(frames, ([frame, value]) => [frame, { ...value }]) } : {}),
      ...(rotoBackground ? { rotoBackground: { ...rotoBackground } } : {}),
      ...(rotoCacheMetadata ? { rotoCacheMetadata: Array.from(rotoCacheMetadata, ([frame, value]) => [frame, { ...value }]) } : {}),
      ...(rotoGeneratedCacheMetadata ? { rotoGeneratedCacheMetadata: Array.from(rotoGeneratedCacheMetadata, ([frame, value]) => [frame, { ...value }]) } : {}),
      ...(rotoInterpolationSettings ? { rotoInterpolationSettings: _cloneRotoInterpolationSettings(rotoInterpolationSettings) } : {}),
      ...(rotoInterpolationFailureStatus ? { rotoInterpolationFailureStatus } : {}),
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

  reset(): void {
    if (_frames.size === 0 && _rotoBackgroundMetadata.size === 0 && _rotoCacheMetadata.size === 0 && _rotoGeneratedCacheMetadata.size === 0 && _rotoInterpolationSettings.size === 0 && _rotoInterpolationFailureStatus.size === 0 && _rotoAlphaCanvasRegistry.size === 0) return;
    _frames.clear();
    _rotoBackgroundMetadata.clear();
    _rotoCacheMetadata.clear();
    _rotoGeneratedCacheMetadata.clear();
    _rotoInterpolationSettings.clear();
    _rotoInterpolationFailureStatus.clear();
    _rotoAlphaCanvasRegistry.clear();
    _notifyVisualChange();
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
};
