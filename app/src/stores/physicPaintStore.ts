import { signal } from '@preact/signals';
import type { SerializedProject } from '@efxlab/efx-physic-paint';
import type { PhysicPaintApplyPayload, PhysicPaintApplyResult, PhysicPaintPlayMotionSettings, PhysicPaintPlayRenderOptionsSnapshot, PhysicPaintPlayScriptRange, PhysicPaintRenderedFrame, PhysicPaintRotoBackgroundMetadata, PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings, PhysicPaintWorkflowMetadata } from '../types/physicPaint';
import { PHYSIC_PAINT_MAX_APPLY_FRAMES, isPhysicPaintApplyPayload, isPhysicPaintRotoBackgroundMetadata, isPhysicPaintRotoCacheFrame, isPhysicPaintRotoInterpolationSettings, normalizePhysicPaintPlayScriptRanges, type PhysicPaintRotoSegmentSpacingOverride } from '../types/physicPaint';
import { getExpandedRotoRealKeyFrames, inferRotoSegmentSpacingOverrides } from '../components/physic-paint/roto/physicsPaintRotoWorkflow';
import { resolveMissingRotoFrameDraw } from '../lib/rotoFrameDraw';

let _markProjectDirty: (() => void) | null = null;
export function _setPhysicPaintMarkDirtyCallback(cb: () => void) { _markProjectDirty = cb; }

export const physicPaintVersion = signal(0);

type PhysicPaintMceOutput = {
  layer_id: string;
  frames: PhysicPaintRenderedFrame[];
  editable_state?: SerializedProject;
  play_script_ranges?: PhysicPaintPlayScriptRange[];
  workflow_mode?: PhysicPaintWorkflowMetadata['workflowMode'];
  play_start_frame?: number;
  play_frame_count?: number;
  editable_source?: PhysicPaintWorkflowMetadata['editableSource'];
  play_motion?: PhysicPaintPlayMotionSettings;
  roto_cache_metadata?: PhysicPaintRotoCacheFrame[];
  roto_interpolation_settings?: PhysicPaintRotoInterpolationSettings;
  roto_background?: PhysicPaintRotoBackgroundMetadata;
};

type PhysicPaintMceOutputInput = PhysicPaintMceOutput & {
  workflowMode?: PhysicPaintWorkflowMetadata['workflowMode'];
  playStartFrame?: number;
  playFrameCount?: number;
  editableSource?: PhysicPaintWorkflowMetadata['editableSource'];
  playMotion?: PhysicPaintPlayMotionSettings;
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
const _editableStates = new Map<string, SerializedProject>();
const _workflowMetadata = new Map<string, PhysicPaintWorkflowMetadata>();
const _playScriptRanges = new Map<string, PhysicPaintPlayScriptRange[]>();
const _rotoCacheMetadata = new Map<string, Map<number, PhysicPaintRotoCacheFrame>>();
const _rotoGeneratedCacheMetadata = new Map<string, Map<number, PhysicPaintRotoCacheFrame>>();
const _rotoInterpolationSettings = new Map<string, PhysicPaintRotoInterpolationSettings>();
const _rotoInterpolationFailureStatus = new Map<string, string>();
const ROTO_INTERPOLATION_FAILURE_STATUS = 'Generated in-betweens could not regenerate. Real keys were kept.';
let _serializationRevision = 0;
let _cachedSerializationRevision = -1;
let _cachedMceOutputs: PhysicPaintMceOutput[] = [];

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

function _notifyVisualChange(): void {
  _invalidateSerializationCache();
  physicPaintVersion.value++;
  _markProjectDirty?.();
}

function _metadataToMce(metadata: PhysicPaintWorkflowMetadata | undefined, editableState?: SerializedProject): Omit<PhysicPaintMceOutput, 'layer_id' | 'frames' | 'editable_state' | 'play_script_ranges'> {
  const editableRotoBackground = editableState ? _rotoBackgroundFromEditableState(editableState) : null;
  const shouldUseRotoBackground = !metadata || metadata.workflowMode === 'roto' || metadata.editableSource === 'roto';
  const rotoBackground = shouldUseRotoBackground ? metadata?.rotoBackground ?? editableRotoBackground : null;
  if (!metadata) {
    return rotoBackground ? { workflow_mode: 'roto', editable_source: 'roto', roto_background: { ...rotoBackground } } : {};
  }
  return {
    workflow_mode: metadata.workflowMode,
    ...(metadata.playStartFrame !== undefined ? { play_start_frame: metadata.playStartFrame } : {}),
    ...(metadata.playFrameCount !== undefined ? { play_frame_count: metadata.playFrameCount } : {}),
    ...(metadata.editableSource ? { editable_source: metadata.editableSource } : {}),
    ...(metadata.playMotion ? { play_motion: { ...metadata.playMotion } } : {}),
    ...(rotoBackground ? { roto_background: { ...rotoBackground } } : {}),
  };
}

function _rangesOverlap(a: Pick<PhysicPaintPlayScriptRange, 'startFrame' | 'frameCount'>, b: Pick<PhysicPaintPlayScriptRange, 'startFrame' | 'frameCount'>): boolean {
  return a.startFrame < b.startFrame + b.frameCount && b.startFrame < a.startFrame + a.frameCount;
}

function _cloneRanges(ranges: PhysicPaintPlayScriptRange[]): PhysicPaintPlayScriptRange[] {
  return structuredClone(ranges);
}

function _getNormalizedRangesForLayer(layerId: string): PhysicPaintPlayScriptRange[] {
  return _cloneRanges(_playScriptRanges.get(layerId) ?? []);
}

function _makePlayScriptId(startFrame: number, frameCount: number): string {
  return `play-${startFrame}-${frameCount}`;
}

function _isValidPlayMotion(value: PhysicPaintPlayMotionSettings | undefined): value is PhysicPaintPlayMotionSettings {
  return Boolean(
    value &&
      Number.isInteger(value.strokeDeformation) &&
      value.strokeDeformation >= 0 &&
      value.strokeDeformation <= 100 &&
      Number.isInteger(value.strokePosition) &&
      value.strokePosition >= 0 &&
      value.strokePosition <= 100,
  );
}

function _playRenderOptionsEqual(a: PhysicPaintPlayRenderOptionsSnapshot | undefined, b: PhysicPaintPlayRenderOptionsSnapshot): boolean {
  if (!a) return false;
  return a.tool === b.tool &&
    a.color === b.color &&
    a.opacity === b.opacity &&
    a.brushSize === b.brushSize &&
    a.background === b.background &&
    a.paperGrain === b.paperGrain &&
    a.grainStrength === b.grainStrength &&
    a.motion.strokeDeformation === b.motion.strokeDeformation &&
    a.motion.strokePosition === b.motion.strokePosition;
}

function _clearCachedFramesForRange(layerId: string, range: Pick<PhysicPaintPlayScriptRange, 'startFrame' | 'frameCount'>): void {
  const layerFrames = _frames.get(layerId);
  if (!layerFrames) return;
  for (let offset = 0; offset < range.frameCount; offset++) {
    layerFrames.delete(range.startFrame + offset);
  }
  if (layerFrames.size === 0) _frames.delete(layerId);
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

function _mergeInferredRotoInterpolationSettings(settings: PhysicPaintRotoInterpolationSettings, realKeys: readonly number[]): PhysicPaintRotoInterpolationSettings {
  if (!settings.enabled) return _cloneRotoInterpolationSettings(settings);
  const explicit = normalizeRotoSegmentSpacingOverrides(settings.segmentSpacingOverrides, realKeys);
  const bySegment = new Map(explicit.map(override => [`${override.fromSourceFrame}:${override.toSourceFrame}`, override]));
  for (const inferred of inferRotoSegmentSpacingOverrides([...realKeys], settings)) {
    if (inferred.toSourceFrame - inferred.fromSourceFrame <= settings.inBetweenCount + 1) continue;
    const key = `${inferred.fromSourceFrame}:${inferred.toSourceFrame}`;
    if (!bySegment.has(key)) bySegment.set(key, inferred);
  }
  const overrides = Array.from(bySegment.values()).sort((a, b) => a.fromSourceFrame - b.fromSourceFrame || a.toSourceFrame - b.toSourceFrame);
  return {
    ...settings,
    ...(overrides.length > 0 ? { segmentSpacingOverrides: overrides } : {}),
  };
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
  const background = _workflowMetadata.get(layerId)?.rotoBackground;
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

function _makePlayScriptRangeFromPayload(
  payload: Extract<PhysicPaintApplyPayload, { kind: 'apply-play-canvas' | 'convert-roto-to-play' }>,
  cacheStatus: PhysicPaintPlayScriptRange['cacheStatus'],
  currentRanges: PhysicPaintPlayScriptRange[],
): { range: PhysicPaintPlayScriptRange; overlap: PhysicPaintPlayScriptRange | undefined } {
  const replacing = currentRanges.find((existing) => (
    (payload.playScriptId !== undefined && existing.id === payload.playScriptId) ||
    (existing.startFrame === payload.startFrame && existing.frameCount === payload.frameCount)
  ));
  const range: PhysicPaintPlayScriptRange = {
    id: replacing?.id ?? payload.playScriptId ?? _makePlayScriptId(payload.startFrame, payload.frameCount),
    startFrame: payload.startFrame,
    frameCount: payload.frameCount,
    editableState: structuredClone(payload.editableState),
    source: 'play',
    cacheStatus,
    ...(payload.playMotion ? { motion: { ...payload.playMotion } } : {}),
    ...(payload.renderOptions ? { renderOptions: structuredClone(payload.renderOptions) } : {}),
  };
  const overlap = currentRanges
    .filter((existing) => existing.id !== replacing?.id)
    .find((existing) => _rangesOverlap(existing, range));
  return { range, overlap };
}

function _tryUpsertPlayScriptRange(layerId: string, range: PhysicPaintPlayScriptRange): PhysicPaintPlayScriptRange[] | null {
  const current = _playScriptRanges.get(layerId) ?? [];
  const next = [...current.filter((existing) => existing.id !== range.id), structuredClone(range)];
  const normalized = normalizePhysicPaintPlayScriptRanges(next);
  if (!normalized) return null;
  _playScriptRanges.set(layerId, normalized);
  return normalized;
}

function _rotoBackgroundFromEditableState(editableState: SerializedProject): PhysicPaintRotoBackgroundMetadata | null {
  const settings = editableState.settings;
  if (!settings) return null;
  const candidate = {
    background: settings.bgMode === 'photo' ? 'transparent' : settings.bgMode,
    paperGrain: settings.paperGrain,
    grainStrength: settings.embossStrength,
    ...(settings.bgMode === 'white' ? { color: '#ffffff' } : {}),
  };
  return isPhysicPaintRotoBackgroundMetadata(candidate) ? candidate : null;
}

function _metadataFromMce(output: PhysicPaintMceOutputInput): PhysicPaintWorkflowMetadata | null {
  const workflowMode = output.workflow_mode ?? output.workflowMode;
  const editableSource = output.editable_source ?? output.editableSource;
  const shouldRecoverEditableRotoBackground = workflowMode === undefined || workflowMode === 'roto' || editableSource === 'roto';
  const editableRotoBackground = shouldRecoverEditableRotoBackground && output.editable_state ? _rotoBackgroundFromEditableState(output.editable_state) : null;
  const rotoBackground = output.roto_background ?? editableRotoBackground;
  if (workflowMode !== 'roto' && workflowMode !== 'play') {
    return rotoBackground ? { workflowMode: 'roto', editableSource: 'roto', rotoBackground: { ...rotoBackground } } : null;
  }
  const playStartFrame = output.play_start_frame ?? output.playStartFrame;
  const playFrameCount = output.play_frame_count ?? output.playFrameCount;
  const playMotion = output.play_motion ?? output.playMotion;
  if (playStartFrame !== undefined && (!Number.isInteger(playStartFrame) || playStartFrame < 0)) return null;
  if (playFrameCount !== undefined && (!Number.isInteger(playFrameCount) || playFrameCount < 1)) return null;
  if (editableSource !== undefined && editableSource !== 'roto' && editableSource !== 'play') return null;
  if (playMotion !== undefined && !_isValidPlayMotion(playMotion)) return null;
  if (rotoBackground !== null && rotoBackground !== undefined && !isPhysicPaintRotoBackgroundMetadata(rotoBackground)) return null;
  return {
    workflowMode,
    ...(playStartFrame !== undefined ? { playStartFrame } : {}),
    ...(playFrameCount !== undefined ? { playFrameCount } : {}),
    ...(editableSource ? { editableSource } : {}),
    ...(playMotion ? { playMotion: { ...playMotion } } : {}),
    ...(rotoBackground ? { rotoBackground: { ...rotoBackground } } : {}),
  };
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

  getEditableState(layerId: string): SerializedProject | null {
    const state = _editableStates.get(layerId);
    return state ? structuredClone(state) : null;
  },

  getWorkflowMetadata(layerId: string): PhysicPaintWorkflowMetadata | null {
    const metadata = _workflowMetadata.get(layerId);
    return metadata ? structuredClone(metadata) : null;
  },

  getRotoBackgroundMetadata(layerId: string): PhysicPaintRotoBackgroundMetadata | null {
    return _workflowMetadata.get(layerId)?.rotoBackground ? { ..._workflowMetadata.get(layerId)!.rotoBackground! } : null;
  },

  setRotoBackgroundMetadata(layerId: string, metadata: PhysicPaintRotoBackgroundMetadata): void {
    if (!isPhysicPaintRotoBackgroundMetadata(metadata)) return;
    const current = _workflowMetadata.get(layerId) ?? { workflowMode: 'roto' as const, editableSource: 'roto' as const };
    if (JSON.stringify(current.rotoBackground ?? null) === JSON.stringify(metadata)) return;
    _workflowMetadata.set(layerId, { ...current, workflowMode: 'roto', editableSource: 'roto', rotoBackground: { ...metadata } });
    _notifyVisualChange();
  },

  getPlayScriptRanges(layerId: string): PhysicPaintPlayScriptRange[] {
    return _getNormalizedRangesForLayer(layerId);
  },

  findPlayScriptRangeAtFrame(layerId: string, frame: number): PhysicPaintPlayScriptRange | null {
    if (!Number.isInteger(frame) || frame < 0) return null;
    return this.getPlayScriptRanges(layerId).find((range) => frame >= range.startFrame && frame < range.startFrame + range.frameCount) ?? null;
  },

  getMaxPlayFrameCountFromGap(layerId: string, frame: number): number {
    if (!Number.isInteger(frame) || frame < 0) return PHYSIC_PAINT_MAX_APPLY_FRAMES;
    const containing = this.findPlayScriptRangeAtFrame(layerId, frame);
    if (containing) return 0;
    const next = this.getPlayScriptRanges(layerId).find((range) => range.startFrame > frame);
    return next ? Math.max(0, next.startFrame - frame) : PHYSIC_PAINT_MAX_APPLY_FRAMES;
  },

  upsertPlayScriptRange(layerId: string, range: PhysicPaintPlayScriptRange): boolean {
    const normalized = _tryUpsertPlayScriptRange(layerId, range);
    if (!normalized) return false;
    const latest = normalized.find((candidate) => candidate.id === range.id);
    if (latest) {
      _workflowMetadata.set(layerId, {
        workflowMode: 'play',
        playStartFrame: latest.startFrame,
        playFrameCount: latest.frameCount,
        editableSource: 'play',
        ...(latest.motion ? { playMotion: { ...latest.motion } } : {}),
      });
    }
    _notifyVisualChange();
    return true;
  },

  updatePlayScriptRenderOptions(layerId: string, scriptId: string, renderOptions: PhysicPaintPlayRenderOptionsSnapshot, operationId = `update-render-options:${scriptId}`): PhysicPaintApplyResult {
    const current = _playScriptRanges.get(layerId) ?? [];
    const range = current.find((candidate) => candidate.id === scriptId);
    if (!range) {
      return {
        operationId,
        kind: 'update-play-render-options',
        layerId,
        startFrame: 0,
        appliedFrameCount: 0,
        ok: false,
        error: `Unknown Play script: ${scriptId}`,
      };
    }
    if (_playRenderOptionsEqual(range.renderOptions, renderOptions)) {
      return {
        operationId,
        kind: 'update-play-render-options',
        layerId,
        startFrame: range.startFrame,
        appliedFrameCount: 0,
        ok: true,
      };
    }
    const next = current.map((candidate) => candidate.id === scriptId
      ? {
          ...candidate,
          cacheStatus: 'stale' as const,
          renderOptions: structuredClone(renderOptions),
          motion: { ...renderOptions.motion },
        }
      : candidate);
    const normalized = normalizePhysicPaintPlayScriptRanges(next);
    if (!normalized) {
      return {
        operationId,
        kind: 'update-play-render-options',
        layerId,
        startFrame: range.startFrame,
        appliedFrameCount: 0,
        ok: false,
        error: 'Invalid Play render options update',
      };
    }
    _clearCachedFramesForRange(layerId, range);
    _playScriptRanges.set(layerId, normalized);
    _workflowMetadata.set(layerId, {
      workflowMode: 'play',
      playStartFrame: range.startFrame,
      playFrameCount: range.frameCount,
      editableSource: 'play',
      playMotion: { ...renderOptions.motion },
    });
    _notifyVisualChange();
    return {
      operationId,
      kind: 'update-play-render-options',
      layerId,
      startFrame: range.startFrame,
      appliedFrameCount: range.frameCount,
      ok: true,
    };
  },

  removePlayScriptRange(layerId: string, scriptId: string): boolean {
    const current = _playScriptRanges.get(layerId) ?? [];
    const next = current.filter((range) => range.id !== scriptId);
    if (next.length === current.length) return false;
    if (next.length > 0) _playScriptRanges.set(layerId, _cloneRanges(next));
    else _playScriptRanges.delete(layerId);
    const metadata = _workflowMetadata.get(layerId);
    if (metadata) _workflowMetadata.set(layerId, { ...metadata, playScriptRanges: _getNormalizedRangesForLayer(layerId) });
    _notifyVisualChange();
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

  upsertRealRotoKeyFrame(layerId: string, frame: number, renderedFrame: PhysicPaintRenderedFrame, backgroundOnly = false): void {
    if (!Number.isInteger(frame) || frame < 0) return;
    _removeBackgroundOnlyRotoSupport(layerId, [frame]);
    const settings = this.getRotoInterpolationSettings(layerId);
    const normalizedFrame = { ...renderedFrame, appFrame: frame, frameIndex: 0, source: 'real-key' as const };
    _getOrCreateLayer(layerId).set(frame, normalizedFrame);
    _getOrCreateRotoMetadata(layerId).set(frame, _normalizeRealRotoCacheFrame(normalizedFrame, frame, backgroundOnly || undefined));
    _workflowMetadata.set(layerId, { ...(_workflowMetadata.get(layerId) ?? {}), workflowMode: 'roto', editableSource: 'roto' });
    _pruneFramesOutsideRotoCacheMetadata(layerId);
    if (settings.enabled) _tryRegenerateGeneratedRotoCache(layerId, settings);
    _notifyVisualChange();
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
    if (_cachedSerializationRevision === _serializationRevision) {
      return _cachedMceOutputs;
    }

    const layerIds = new Set([..._frames.keys(), ..._editableStates.keys(), ..._workflowMetadata.keys(), ..._playScriptRanges.keys(), ..._rotoCacheMetadata.keys(), ..._rotoGeneratedCacheMetadata.keys(), ..._rotoInterpolationSettings.keys()]);
    const outputs = Array.from(layerIds)
      .map((layerId) => {
        const frames = _frames.get(layerId) ?? new Map<number, PhysicPaintRenderedFrame>();
        return {
          layer_id: layerId,
          frames: Array.from(frames.entries())
            .sort(([a], [b]) => a - b)
            .map(([frame, renderedFrame]) => ({ ...renderedFrame, appFrame: frame })),
          ...(_editableStates.has(layerId) ? { editable_state: structuredClone(_editableStates.get(layerId)!) } : {}),
          ...(_playScriptRanges.has(layerId) ? { play_script_ranges: _cloneRanges(_playScriptRanges.get(layerId)!) } : {}),
          ...(_getCombinedRotoMetadata(layerId).length > 0 ? { roto_cache_metadata: _getCombinedRotoMetadata(layerId).sort((a, b) => (a.displayFrame ?? a.appFrame) - (b.displayFrame ?? b.appFrame)).map(frame => ({ ...frame })) } : {}),
          ...(_rotoInterpolationSettings.has(layerId) ? { roto_interpolation_settings: _cloneRotoInterpolationSettings(_rotoInterpolationSettings.get(layerId)!) } : {}),
          ..._metadataToMce(_workflowMetadata.get(layerId), _editableStates.get(layerId)),
        };
      })
      .filter(output => output.frames.length > 0 || output.editable_state || output.workflow_mode || output.play_script_ranges || output.roto_cache_metadata || output.roto_interpolation_settings);

    _cachedMceOutputs = outputs;
    _cachedSerializationRevision = _serializationRevision;
    return _cachedMceOutputs;
  },

  loadFromMceOutputs(outputs: PhysicPaintMceOutputInput[] | null | undefined): void {
    _frames.clear();
    _editableStates.clear();
    _workflowMetadata.clear();
    _playScriptRanges.clear();
    _rotoCacheMetadata.clear();
    _rotoGeneratedCacheMetadata.clear();
    _rotoInterpolationSettings.clear();
    _rotoInterpolationFailureStatus.clear();
    for (const output of outputs ?? []) {
      if (!output || typeof output.layer_id !== 'string' || !Array.isArray(output.frames)) continue;
      const layerFrames = _getOrCreateLayer(output.layer_id);
      for (const renderedFrame of output.frames) {
        if (!renderedFrame || !Number.isInteger(renderedFrame.appFrame) || renderedFrame.appFrame < 0) continue;
        if (typeof renderedFrame.dataUrl !== 'string' || !renderedFrame.dataUrl.startsWith('data:image/png')) continue;
        layerFrames.set(renderedFrame.appFrame, { ...renderedFrame });
      }
      if (layerFrames.size === 0) _frames.delete(output.layer_id);
      if (output.editable_state) _editableStates.set(output.layer_id, structuredClone(output.editable_state));
      const playScriptRanges = normalizePhysicPaintPlayScriptRanges(output.play_script_ranges);
      if (playScriptRanges) _playScriptRanges.set(output.layer_id, playScriptRanges);
      if (Array.isArray(output.roto_cache_metadata)) {
        const metadata = new Map<number, PhysicPaintRotoCacheFrame>();
        const generatedMetadata = new Map<number, PhysicPaintRotoCacheFrame>();
        for (const frame of output.roto_cache_metadata) {
          if (!isPhysicPaintRotoCacheFrame(frame)) continue;
          if (frame.source === 'generated-interpolation') {
            generatedMetadata.set(frame.appFrame, { ...frame });
            continue;
          }
          const sourceFrame = frame.sourceFrame ?? frame.appFrame;
          const renderedFrame = layerFrames.get(sourceFrame) ?? layerFrames.get(frame.appFrame);
          if (!renderedFrame) continue;
          metadata.set(sourceFrame, _normalizeRealRotoCacheFrame({ ...renderedFrame, ...frame, appFrame: sourceFrame }, sourceFrame, frame.backgroundOnly || undefined));
        }
        if (metadata.size > 0) _rotoCacheMetadata.set(output.layer_id, metadata);
        if (generatedMetadata.size > 0) _rotoGeneratedCacheMetadata.set(output.layer_id, generatedMetadata);
      } else if ((output.workflow_mode ?? output.workflowMode) === 'roto' || (output.editable_source ?? output.editableSource) === 'roto') {
        const metadata = new Map<number, PhysicPaintRotoCacheFrame>();
        for (const [frame, renderedFrame] of layerFrames) {
          metadata.set(frame, { ...renderedFrame, source: 'real-key' });
        }
        if (metadata.size > 0) _rotoCacheMetadata.set(output.layer_id, metadata);
      }
      _pruneFramesOutsideRotoCacheMetadata(output.layer_id);
      if (output.roto_interpolation_settings !== undefined) {
        const realKeys = _getRealRotoKeyFrames(output.layer_id);
        const settings = _normalizeRotoInterpolationSettings(output.roto_interpolation_settings, realKeys);
        const hasExplicitOverrides = Array.isArray(output.roto_interpolation_settings.segmentSpacingOverrides) && output.roto_interpolation_settings.segmentSpacingOverrides.length > 0;
        const hasPersistedGeneratedMetadata = Array.isArray(output.roto_cache_metadata) && output.roto_cache_metadata.some(frame => frame?.source === 'generated-interpolation');
        const persistedGeneratedValid = hasPersistedGeneratedMetadata && Array.isArray(output.roto_cache_metadata) && output.roto_cache_metadata
          .filter(frame => frame?.source === 'generated-interpolation')
          .every(frame => frame && isPhysicPaintRotoCacheFrame(frame) && realKeys.includes(frame.fromSourceFrame ?? -1) && (frame.toSourceFrame === undefined || realKeys.includes(frame.toSourceFrame)));
        const nextSettings = hasExplicitOverrides || !persistedGeneratedValid
          ? _mergeInferredRotoInterpolationSettings(settings, realKeys)
          : settings;
        _rotoInterpolationSettings.set(output.layer_id, nextSettings);
        if (!nextSettings.enabled || realKeys.length >= 2) {
          _tryRegenerateGeneratedRotoCache(output.layer_id, nextSettings);
        }
      }
      const metadata = _metadataFromMce(output);
      if (metadata) _workflowMetadata.set(output.layer_id, metadata);
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
    if (settings) _rotoInterpolationSettings.set(layerId, _mergeInferredRotoInterpolationSettings(_normalizeRotoInterpolationSettings(settings, _getRealRotoKeyFrames(layerId)), _getRealRotoKeyFrames(layerId)));
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

  setEditableState(layerId: string, editableState: SerializedProject): void {
    _editableStates.set(layerId, structuredClone(editableState));
    _notifyVisualChange();
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

    _editableStates.set(payload.layerId, structuredClone(payload.editableState));
    const rotoBackground = payload.rotoBackground ?? _rotoBackgroundFromEditableState(payload.editableState);
    if (rotoBackground) {
      _workflowMetadata.set(payload.layerId, { ...(_workflowMetadata.get(payload.layerId) ?? {}), workflowMode: 'roto', editableSource: 'roto', rotoBackground: { ...rotoBackground } });
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
    _workflowMetadata.set(payload.layerId, { ...(_workflowMetadata.get(payload.layerId) ?? {}), workflowMode: 'roto', editableSource: 'roto' });
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

  applySequence(payload: PhysicPaintApplyPayload): PhysicPaintApplyResult {
    if (!isPhysicPaintApplyPayload(payload)) {
      return _errorResult(payload, 'Invalid physics paint apply payload');
    }
    if (payload.kind !== 'apply-play-canvas') {
      return _errorResult(payload, 'Expected apply-play-canvas payload');
    }

    const currentRanges = _playScriptRanges.get(payload.layerId) ?? [];
    const { range, overlap } = _makePlayScriptRangeFromPayload(payload, 'cached', currentRanges);
    if (overlap) {
      return _errorResult(payload, `Play script range overlap with ${overlap.id}`);
    }

    const layerFrames = _getOrCreateLayer(payload.layerId);
    payload.frames.forEach((renderedFrame, index) => {
      const appFrame = payload.startFrame + index;
      layerFrames.set(appFrame, { ...renderedFrame, appFrame });
    });
    _tryUpsertPlayScriptRange(payload.layerId, range);
    _editableStates.set(payload.layerId, structuredClone(payload.editableState));
    _workflowMetadata.set(payload.layerId, {
      workflowMode: 'play',
      playStartFrame: payload.startFrame,
      playFrameCount: payload.frameCount,
      editableSource: 'play',
      ...(payload.playMotion ? { playMotion: { ...payload.playMotion } } : {}),
    });
    _notifyVisualChange();

    return {
      operationId: payload.operationId,
      kind: payload.kind,
      layerId: payload.layerId,
      startFrame: payload.startFrame,
      appliedFrameCount: payload.frames.length,
      ok: true,
    };
  },

  convertPlayToRoto(payload: PhysicPaintApplyPayload): PhysicPaintApplyResult {
    if (!isPhysicPaintApplyPayload(payload)) {
      return _errorResult(payload, 'Invalid physics paint apply payload');
    }
    if (payload.kind !== 'convert-play-to-roto') {
      return _errorResult(payload, 'Expected convert-play-to-roto payload');
    }

    const layerFrames = _getOrCreateLayer(payload.layerId);
    payload.frames.forEach((renderedFrame, index) => {
      const appFrame = payload.startFrame + index;
      layerFrames.set(appFrame, { ...renderedFrame, appFrame });
    });
    _editableStates.set(payload.layerId, structuredClone(payload.editableState));
    _workflowMetadata.set(payload.layerId, { ...(_workflowMetadata.get(payload.layerId) ?? {}), workflowMode: 'roto', editableSource: 'roto' });
    _notifyVisualChange();

    return {
      operationId: payload.operationId,
      kind: payload.kind,
      layerId: payload.layerId,
      startFrame: payload.startFrame,
      appliedFrameCount: payload.frames.length,
      ok: true,
    };
  },

  convertRotoToPlay(payload: PhysicPaintApplyPayload): PhysicPaintApplyResult {
    if (!isPhysicPaintApplyPayload(payload)) {
      return _errorResult(payload, 'Invalid physics paint apply payload');
    }
    if (payload.kind !== 'convert-roto-to-play') {
      return _errorResult(payload, 'Expected convert-roto-to-play payload');
    }

    const currentRanges = _playScriptRanges.get(payload.layerId) ?? [];
    const { range, overlap } = _makePlayScriptRangeFromPayload(payload, 'stale', currentRanges);
    if (overlap) {
      return _errorResult(payload, `Play script range overlap with ${overlap.id}`);
    }

    _clearCachedFramesForRange(payload.layerId, range);
    _tryUpsertPlayScriptRange(payload.layerId, range);
    _editableStates.set(payload.layerId, structuredClone(payload.editableState));
    _workflowMetadata.set(payload.layerId, {
      workflowMode: 'play',
      playStartFrame: payload.startFrame,
      playFrameCount: payload.frameCount,
      editableSource: 'play',
      ...(payload.playMotion ? { playMotion: { ...payload.playMotion } } : {}),
    });
    _notifyVisualChange();

    return {
      operationId: payload.operationId,
      kind: payload.kind,
      layerId: payload.layerId,
      startFrame: payload.startFrame,
      appliedFrameCount: payload.frameCount,
      ok: true,
    };
  },

  hasOutput(layerId: string): boolean {
    return (_frames.get(layerId)?.size ?? 0) > 0;
  },

  clearLayer(layerId: string): void {
    if (!_frames.has(layerId) && !_editableStates.has(layerId) && !_workflowMetadata.has(layerId) && !_playScriptRanges.has(layerId) && !_rotoCacheMetadata.has(layerId) && !_rotoGeneratedCacheMetadata.has(layerId) && !_rotoInterpolationSettings.has(layerId)) return;
    _frames.delete(layerId);
    _editableStates.delete(layerId);
    _workflowMetadata.delete(layerId);
    _playScriptRanges.delete(layerId);
    _rotoCacheMetadata.delete(layerId);
    _rotoGeneratedCacheMetadata.delete(layerId);
    _rotoInterpolationSettings.delete(layerId);
    _notifyVisualChange();
  },

  reset(): void {
    if (_frames.size === 0 && _editableStates.size === 0 && _workflowMetadata.size === 0 && _playScriptRanges.size === 0 && _rotoCacheMetadata.size === 0 && _rotoGeneratedCacheMetadata.size === 0 && _rotoInterpolationSettings.size === 0 && _rotoAlphaCanvasRegistry.size === 0) return;
    _frames.clear();
    _editableStates.clear();
    _workflowMetadata.clear();
    _playScriptRanges.clear();
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
