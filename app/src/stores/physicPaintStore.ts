import { signal } from '@preact/signals';
import type { SerializedProject } from '@efxlab/efx-physic-paint';
import type { PhysicPaintApplyPayload, PhysicPaintApplyResult, PhysicPaintPlayMotionSettings, PhysicPaintPlayRenderOptionsSnapshot, PhysicPaintPlayScriptRange, PhysicPaintRenderedFrame, PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings, PhysicPaintWorkflowMetadata } from '../types/physicPaint';
import { PHYSIC_PAINT_MAX_APPLY_FRAMES, isPhysicPaintApplyPayload, isPhysicPaintRotoCacheFrame, isPhysicPaintRotoInterpolationSettings, normalizePhysicPaintPlayScriptRanges } from '../types/physicPaint';

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
};

type PhysicPaintMceOutputInput = PhysicPaintMceOutput & {
  workflowMode?: PhysicPaintWorkflowMetadata['workflowMode'];
  playStartFrame?: number;
  playFrameCount?: number;
  editableSource?: PhysicPaintWorkflowMetadata['editableSource'];
  playMotion?: PhysicPaintPlayMotionSettings;
};

const _frames = new Map<string, Map<number, PhysicPaintRenderedFrame>>();
const _editableStates = new Map<string, SerializedProject>();
const _workflowMetadata = new Map<string, PhysicPaintWorkflowMetadata>();
const _playScriptRanges = new Map<string, PhysicPaintPlayScriptRange[]>();
const _rotoCacheMetadata = new Map<string, Map<number, PhysicPaintRotoCacheFrame>>();
const _rotoInterpolationSettings = new Map<string, PhysicPaintRotoInterpolationSettings>();
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

function _cloneRotoInterpolationSettings(settings: PhysicPaintRotoInterpolationSettings): PhysicPaintRotoInterpolationSettings {
  return { ...settings };
}

function _makeRotoCacheFrame(renderedFrame: PhysicPaintRenderedFrame, appFrame: number, source: PhysicPaintRotoCacheFrame['source'], nearestRealKeyFrame?: number, backgroundOnly?: boolean): PhysicPaintRotoCacheFrame {
  return {
    ...renderedFrame,
    appFrame,
    source,
    ...(nearestRealKeyFrame !== undefined ? { nearestRealKeyFrame } : {}),
    ...(backgroundOnly !== undefined ? { backgroundOnly } : {}),
  };
}

function _notifyVisualChange(): void {
  _invalidateSerializationCache();
  physicPaintVersion.value++;
  _markProjectDirty?.();
}

function _metadataToMce(metadata: PhysicPaintWorkflowMetadata | undefined): Omit<PhysicPaintMceOutput, 'layer_id' | 'frames' | 'editable_state' | 'play_script_ranges'> {
  if (!metadata) return {};
  return {
    workflow_mode: metadata.workflowMode,
    ...(metadata.playStartFrame !== undefined ? { play_start_frame: metadata.playStartFrame } : {}),
    ...(metadata.playFrameCount !== undefined ? { play_frame_count: metadata.playFrameCount } : {}),
    ...(metadata.editableSource ? { editable_source: metadata.editableSource } : {}),
    ...(metadata.playMotion ? { play_motion: { ...metadata.playMotion } } : {}),
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

function _metadataFromMce(output: PhysicPaintMceOutputInput): PhysicPaintWorkflowMetadata | null {
  const workflowMode = output.workflow_mode ?? output.workflowMode;
  if (workflowMode !== 'roto' && workflowMode !== 'play') return null;
  const playStartFrame = output.play_start_frame ?? output.playStartFrame;
  const playFrameCount = output.play_frame_count ?? output.playFrameCount;
  const editableSource = output.editable_source ?? output.editableSource;
  const playMotion = output.play_motion ?? output.playMotion;
  if (playStartFrame !== undefined && (!Number.isInteger(playStartFrame) || playStartFrame < 0)) return null;
  if (playFrameCount !== undefined && (!Number.isInteger(playFrameCount) || playFrameCount < 1)) return null;
  if (editableSource !== undefined && editableSource !== 'roto' && editableSource !== 'play') return null;
  if (playMotion !== undefined && !_isValidPlayMotion(playMotion)) return null;
  return {
    workflowMode,
    ...(playStartFrame !== undefined ? { playStartFrame } : {}),
    ...(playFrameCount !== undefined ? { playFrameCount } : {}),
    ...(editableSource ? { editableSource } : {}),
    ...(playMotion ? { playMotion: { ...playMotion } } : {}),
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

  getEditableState(layerId: string): SerializedProject | null {
    const state = _editableStates.get(layerId);
    return state ? structuredClone(state) : null;
  },

  getWorkflowMetadata(layerId: string): PhysicPaintWorkflowMetadata | null {
    const metadata = _workflowMetadata.get(layerId);
    return metadata ? { ...metadata } : null;
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
    const metadata = _rotoCacheMetadata.get(layerId);
    if (!metadata) return [];
    return Array.from(metadata.values()).sort((a, b) => a.appFrame - b.appFrame).map(frame => ({ ...frame }));
  },

  getRealRotoKeyFrames(layerId: string): number[] {
    return this.getRotoCacheFrames(layerId)
      .filter(frame => frame.source === 'real-key')
      .map(frame => frame.appFrame);
  },

  upsertRealRotoKeyFrame(layerId: string, frame: number, renderedFrame: PhysicPaintRenderedFrame): void {
    if (!Number.isInteger(frame) || frame < 0) return;
    const normalizedFrame = { ...renderedFrame, appFrame: frame };
    _getOrCreateLayer(layerId).set(frame, normalizedFrame);
    _getOrCreateRotoMetadata(layerId).set(frame, _makeRotoCacheFrame(normalizedFrame, frame, 'real-key'));
    _workflowMetadata.set(layerId, { workflowMode: 'roto', editableSource: 'roto' });
    _notifyVisualChange();
  },

  removeRealRotoKeyFrame(layerId: string, frame: number): boolean {
    if (!Number.isInteger(frame) || frame < 0) return false;
    const metadata = _rotoCacheMetadata.get(layerId);
    if (metadata?.get(frame)?.source !== 'real-key') return false;
    const layerFrames = _frames.get(layerId);
    layerFrames?.delete(frame);
    if (layerFrames?.size === 0) _frames.delete(layerId);
    metadata.delete(frame);
    if (metadata.size === 0) _rotoCacheMetadata.delete(layerId);
    _notifyVisualChange();
    return true;
  },

  replaceGeneratedRotoCache(layerId: string, frames: PhysicPaintRotoCacheFrame[], settings: PhysicPaintRotoInterpolationSettings): boolean {
    if (!isPhysicPaintRotoInterpolationSettings(settings)) return false;
    if (!frames.every(isPhysicPaintRotoCacheFrame)) return false;
    const layerFrames = _getOrCreateLayer(layerId);
    const metadata = _getOrCreateRotoMetadata(layerId);
    for (const frame of Array.from(metadata.values())) {
      if (frame.source !== 'generated-interpolation') continue;
      layerFrames.delete(frame.appFrame);
      metadata.delete(frame.appFrame);
    }
    for (const frame of frames) {
      const normalizedFrame = { ...frame, appFrame: frame.appFrame };
      layerFrames.set(frame.appFrame, normalizedFrame);
      metadata.set(frame.appFrame, normalizedFrame);
    }
    if (layerFrames.size === 0) _frames.delete(layerId);
    if (metadata.size === 0) _rotoCacheMetadata.delete(layerId);
    _rotoInterpolationSettings.set(layerId, _cloneRotoInterpolationSettings(settings));
    _notifyVisualChange();
    return true;
  },

  getRotoInterpolationSettings(layerId: string): PhysicPaintRotoInterpolationSettings | null {
    const settings = _rotoInterpolationSettings.get(layerId);
    return settings ? _cloneRotoInterpolationSettings(settings) : null;
  },

  setRotoInterpolationSettings(layerId: string, settings: PhysicPaintRotoInterpolationSettings): boolean {
    if (!isPhysicPaintRotoInterpolationSettings(settings)) return false;
    _rotoInterpolationSettings.set(layerId, _cloneRotoInterpolationSettings(settings));
    _notifyVisualChange();
    return true;
  },

  toMceOutputs(): PhysicPaintMceOutput[] {
    if (_cachedSerializationRevision === _serializationRevision) {
      return _cachedMceOutputs;
    }

    const layerIds = new Set([..._frames.keys(), ..._editableStates.keys(), ..._workflowMetadata.keys(), ..._playScriptRanges.keys(), ..._rotoCacheMetadata.keys(), ..._rotoInterpolationSettings.keys()]);
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
          ...(_rotoCacheMetadata.has(layerId) ? { roto_cache_metadata: Array.from(_rotoCacheMetadata.get(layerId)!.values()).sort((a, b) => a.appFrame - b.appFrame).map(frame => ({ ...frame })) } : {}),
          ...(_rotoInterpolationSettings.has(layerId) ? { roto_interpolation_settings: _cloneRotoInterpolationSettings(_rotoInterpolationSettings.get(layerId)!) } : {}),
          ..._metadataToMce(_workflowMetadata.get(layerId)),
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
    _rotoInterpolationSettings.clear();
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
        for (const frame of output.roto_cache_metadata) {
          if (!isPhysicPaintRotoCacheFrame(frame)) continue;
          if (!layerFrames.has(frame.appFrame)) continue;
          metadata.set(frame.appFrame, { ...frame });
        }
        if (metadata.size > 0) _rotoCacheMetadata.set(output.layer_id, metadata);
      }
      if (isPhysicPaintRotoInterpolationSettings(output.roto_interpolation_settings)) {
        _rotoInterpolationSettings.set(output.layer_id, _cloneRotoInterpolationSettings(output.roto_interpolation_settings));
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

  setEditableState(layerId: string, editableState: SerializedProject): void {
    _editableStates.set(layerId, structuredClone(editableState));
    _notifyVisualChange();
  },

  removeFrameRange(layerId: string, startFrame: number, frameCount: number): void {
    if (!Number.isInteger(startFrame) || startFrame < 0 || !Number.isInteger(frameCount) || frameCount < 1) return;
    const layerFrames = _frames.get(layerId);
    if (!layerFrames) return;
    let changed = false;
    for (let offset = 0; offset < frameCount; offset++) {
      changed = layerFrames.delete(startFrame + offset) || changed;
    }
    if (layerFrames.size === 0) _frames.delete(layerId);
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
    this.upsertRealRotoKeyFrame(payload.layerId, payload.startFrame, payload.renderedFrame);
    return {
      operationId: payload.operationId,
      kind: payload.kind,
      layerId: payload.layerId,
      startFrame: payload.startFrame,
      appliedFrameCount: 1,
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
    _workflowMetadata.set(payload.layerId, { workflowMode: 'roto', editableSource: 'roto' });
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
    if (!_frames.has(layerId) && !_editableStates.has(layerId) && !_workflowMetadata.has(layerId) && !_playScriptRanges.has(layerId) && !_rotoCacheMetadata.has(layerId) && !_rotoInterpolationSettings.has(layerId)) return;
    _frames.delete(layerId);
    _editableStates.delete(layerId);
    _workflowMetadata.delete(layerId);
    _playScriptRanges.delete(layerId);
    _rotoCacheMetadata.delete(layerId);
    _rotoInterpolationSettings.delete(layerId);
    _notifyVisualChange();
  },

  reset(): void {
    if (_frames.size === 0 && _editableStates.size === 0 && _workflowMetadata.size === 0 && _playScriptRanges.size === 0 && _rotoCacheMetadata.size === 0 && _rotoInterpolationSettings.size === 0) return;
    _frames.clear();
    _editableStates.clear();
    _workflowMetadata.clear();
    _playScriptRanges.clear();
    _rotoCacheMetadata.clear();
    _rotoInterpolationSettings.clear();
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
