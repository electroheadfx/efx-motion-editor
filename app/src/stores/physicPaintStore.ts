import { signal } from '@preact/signals';
import type { PhysicPaintApplyPayload, PhysicPaintApplyResult, PhysicPaintPlayScriptRange, PhysicPaintRenderedFrame, PhysicPaintWorkflowMetadata } from '../types/physicPaint';
import { PHYSIC_PAINT_MAX_APPLY_FRAMES, isPhysicPaintApplyPayload, normalizePhysicPaintPlayScriptRanges } from '../types/physicPaint';

let _markProjectDirty: (() => void) | null = null;
export function _setPhysicPaintMarkDirtyCallback(cb: () => void) { _markProjectDirty = cb; }

export const physicPaintVersion = signal(0);

type PhysicPaintMceOutput = {
  layer_id: string;
  frames: PhysicPaintRenderedFrame[];
  editable_state?: PhysicPaintApplyPayload['editableState'];
  play_script_ranges?: PhysicPaintPlayScriptRange[];
  workflow_mode?: PhysicPaintWorkflowMetadata['workflowMode'];
  play_start_frame?: number;
  play_frame_count?: number;
  editable_source?: PhysicPaintWorkflowMetadata['editableSource'];
};

type PhysicPaintMceOutputInput = PhysicPaintMceOutput & {
  workflowMode?: PhysicPaintWorkflowMetadata['workflowMode'];
  playStartFrame?: number;
  playFrameCount?: number;
  editableSource?: PhysicPaintWorkflowMetadata['editableSource'];
};

const _frames = new Map<string, Map<number, PhysicPaintRenderedFrame>>();
const _editableStates = new Map<string, PhysicPaintApplyPayload['editableState']>();
const _workflowMetadata = new Map<string, PhysicPaintWorkflowMetadata>();
const _playScriptRanges = new Map<string, PhysicPaintPlayScriptRange[]>();
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
  if (playStartFrame !== undefined && (!Number.isInteger(playStartFrame) || playStartFrame < 0)) return null;
  if (playFrameCount !== undefined && (!Number.isInteger(playFrameCount) || playFrameCount < 1)) return null;
  if (editableSource !== undefined && editableSource !== 'roto' && editableSource !== 'play') return null;
  return {
    workflowMode,
    ...(playStartFrame !== undefined ? { playStartFrame } : {}),
    ...(playFrameCount !== undefined ? { playFrameCount } : {}),
    ...(editableSource ? { editableSource } : {}),
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

  getEditableState(layerId: string): PhysicPaintApplyPayload['editableState'] | null {
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
      });
    }
    _notifyVisualChange();
    return true;
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

  toMceOutputs(): PhysicPaintMceOutput[] {
    if (_cachedSerializationRevision === _serializationRevision) {
      return _cachedMceOutputs;
    }

    const layerIds = new Set([..._frames.keys(), ..._editableStates.keys(), ..._workflowMetadata.keys(), ..._playScriptRanges.keys()]);
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
          ..._metadataToMce(_workflowMetadata.get(layerId)),
        };
      })
      .filter(output => output.frames.length > 0 || output.editable_state || output.workflow_mode || output.play_script_ranges);

    _cachedMceOutputs = outputs;
    _cachedSerializationRevision = _serializationRevision;
    return _cachedMceOutputs;
  },

  loadFromMceOutputs(outputs: PhysicPaintMceOutputInput[] | null | undefined): void {
    _frames.clear();
    _editableStates.clear();
    _workflowMetadata.clear();
    _playScriptRanges.clear();
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

  setEditableState(layerId: string, editableState: PhysicPaintApplyPayload['editableState']): void {
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
    _workflowMetadata.set(payload.layerId, { workflowMode: 'roto', editableSource: 'roto' });
    this.setFrame(payload.layerId, payload.startFrame, payload.renderedFrame);
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

    const range: PhysicPaintPlayScriptRange = {
      id: _makePlayScriptId(payload.startFrame, payload.frameCount),
      startFrame: payload.startFrame,
      frameCount: payload.frameCount,
      editableState: structuredClone(payload.editableState),
      source: 'play',
      cacheStatus: 'cached',
    };
    const currentRanges = _playScriptRanges.get(payload.layerId) ?? [];
    const replacing = currentRanges.find((existing) => existing.startFrame === payload.startFrame && existing.frameCount === payload.frameCount);
    const overlap = currentRanges
      .filter((existing) => existing.id !== replacing?.id)
      .find((existing) => _rangesOverlap(existing, range));
    if (overlap) {
      return _errorResult(payload, `Play script range overlap with ${overlap.id}`);
    }

    const layerFrames = _getOrCreateLayer(payload.layerId);
    payload.frames.forEach((renderedFrame, index) => {
      const appFrame = payload.startFrame + index;
      layerFrames.set(appFrame, { ...renderedFrame, appFrame });
    });
    if (replacing) range.id = replacing.id;
    _tryUpsertPlayScriptRange(payload.layerId, range);
    _editableStates.set(payload.layerId, structuredClone(payload.editableState));
    _workflowMetadata.set(payload.layerId, {
      workflowMode: 'play',
      playStartFrame: payload.startFrame,
      playFrameCount: payload.frameCount,
      editableSource: 'play',
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

    const layerFrames = _frames.get(payload.layerId);
    if (layerFrames) {
      for (let offset = 0; offset < payload.frameCount; offset++) {
        layerFrames.delete(payload.startFrame + offset);
      }
      if (layerFrames.size === 0) _frames.delete(payload.layerId);
    }
    _editableStates.set(payload.layerId, structuredClone(payload.editableState));
    _workflowMetadata.set(payload.layerId, {
      workflowMode: 'play',
      playStartFrame: payload.startFrame,
      playFrameCount: payload.frameCount,
      editableSource: 'play',
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
    if (!_frames.has(layerId) && !_editableStates.has(layerId) && !_workflowMetadata.has(layerId) && !_playScriptRanges.has(layerId)) return;
    _frames.delete(layerId);
    _editableStates.delete(layerId);
    _workflowMetadata.delete(layerId);
    _playScriptRanges.delete(layerId);
    _notifyVisualChange();
  },

  reset(): void {
    if (_frames.size === 0 && _editableStates.size === 0 && _workflowMetadata.size === 0 && _playScriptRanges.size === 0) return;
    _frames.clear();
    _editableStates.clear();
    _workflowMetadata.clear();
    _playScriptRanges.clear();
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
