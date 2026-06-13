import { signal } from '@preact/signals';
import type { PhysicPaintApplyPayload, PhysicPaintApplyResult, PhysicPaintPlayScriptSegment, PhysicPaintRenderedFrame, PhysicPaintSerializedPlayScriptSegment, PhysicPaintWorkflowMetadata } from '../types/physicPaint';
import { isPhysicPaintApplyPayload, isPhysicPaintSerializedPlayScriptSegment } from '../types/physicPaint';

let _markProjectDirty: (() => void) | null = null;
export function _setPhysicPaintMarkDirtyCallback(cb: () => void) { _markProjectDirty = cb; }

export const physicPaintVersion = signal(0);

type PhysicPaintMceOutput = {
  layer_id: string;
  frames: PhysicPaintRenderedFrame[];
  editable_state?: PhysicPaintApplyPayload['editableState'];
  play_script_segments?: PhysicPaintSerializedPlayScriptSegment[];
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
const _playScriptSegments = new Map<string, Map<string, PhysicPaintPlayScriptSegment>>();
const _workflowMetadata = new Map<string, PhysicPaintWorkflowMetadata>();
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

function _metadataToMce(metadata: PhysicPaintWorkflowMetadata | undefined): Omit<PhysicPaintMceOutput, 'layer_id' | 'frames' | 'editable_state'> {
  if (!metadata) return {};
  return {
    workflow_mode: metadata.workflowMode,
    ...(metadata.playStartFrame !== undefined ? { play_start_frame: metadata.playStartFrame } : {}),
    ...(metadata.playFrameCount !== undefined ? { play_frame_count: metadata.playFrameCount } : {}),
    ...(metadata.editableSource ? { editable_source: metadata.editableSource } : {}),
  };
}

function _getOrCreatePlayScriptLayer(layerId: string): Map<string, PhysicPaintPlayScriptSegment> {
  let segments = _playScriptSegments.get(layerId);
  if (!segments) {
    segments = new Map();
    _playScriptSegments.set(layerId, segments);
  }
  return segments;
}

function _makePlayScriptSegmentId(layerId: string, startFrame: number, frameCount: number): string {
  return `${layerId}:${startFrame}:${frameCount}`;
}

function _clonePlayScriptSegment(segment: PhysicPaintPlayScriptSegment): PhysicPaintPlayScriptSegment {
  return { ...segment, editableState: structuredClone(segment.editableState) };
}

function _upsertPlayScriptSegment(layerId: string, startFrame: number, frameCount: number, editableState: PhysicPaintApplyPayload['editableState']): void {
  const segment: PhysicPaintPlayScriptSegment = {
    id: _makePlayScriptSegmentId(layerId, startFrame, frameCount),
    startFrame,
    endFrame: startFrame + frameCount - 1,
    frameCount,
    editableSource: 'play',
    editableState: structuredClone(editableState),
  };
  _getOrCreatePlayScriptLayer(layerId).set(segment.id, segment);
}

function _playScriptSegmentToMce(segment: PhysicPaintPlayScriptSegment): PhysicPaintSerializedPlayScriptSegment {
  return {
    id: segment.id,
    start_frame: segment.startFrame,
    end_frame: segment.endFrame,
    frame_count: segment.frameCount,
    editable_source: 'play',
    editable_state: structuredClone(segment.editableState),
  };
}

function _playScriptSegmentFromMce(segment: unknown): PhysicPaintPlayScriptSegment | null {
  if (!isPhysicPaintSerializedPlayScriptSegment(segment)) return null;
  return {
    id: segment.id,
    startFrame: segment.start_frame,
    endFrame: segment.end_frame,
    frameCount: segment.frame_count,
    editableSource: 'play',
    editableState: structuredClone(segment.editable_state),
  };
}

function _getSortedPlayScriptSegments(layerId: string): PhysicPaintPlayScriptSegment[] {
  return Array.from(_playScriptSegments.get(layerId)?.values() ?? [])
    .sort((a, b) => a.startFrame - b.startFrame || a.endFrame - b.endFrame || a.id.localeCompare(b.id));
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

  getPlayScriptSegments(layerId: string): PhysicPaintPlayScriptSegment[] {
    return _getSortedPlayScriptSegments(layerId).map(_clonePlayScriptSegment);
  },

  getPlayScriptSegmentAtFrame(layerId: string, frame: number): PhysicPaintPlayScriptSegment | null {
    if (!Number.isInteger(frame) || frame < 0) return null;
    const segment = _getSortedPlayScriptSegments(layerId)
      .filter(item => item.startFrame <= frame && frame <= item.endFrame)
      .sort((a, b) => b.startFrame - a.startFrame || b.endFrame - a.endFrame || a.id.localeCompare(b.id))[0];
    return segment ? _clonePlayScriptSegment(segment) : null;
  },

  getFrames(layerId: string): Map<number, PhysicPaintRenderedFrame> {
    return new Map(_frames.get(layerId) ?? []);
  },

  toMceOutputs(): PhysicPaintMceOutput[] {
    if (_cachedSerializationRevision === _serializationRevision) {
      return _cachedMceOutputs;
    }

    const layerIds = new Set([..._frames.keys(), ..._editableStates.keys(), ..._playScriptSegments.keys(), ..._workflowMetadata.keys()]);
    const outputs = Array.from(layerIds)
      .map((layerId) => {
        const frames = _frames.get(layerId) ?? new Map<number, PhysicPaintRenderedFrame>();
        return {
          layer_id: layerId,
          frames: Array.from(frames.entries())
            .sort(([a], [b]) => a - b)
            .map(([frame, renderedFrame]) => ({ ...renderedFrame, appFrame: frame })),
          ...(_editableStates.has(layerId) ? { editable_state: structuredClone(_editableStates.get(layerId)!) } : {}),
          ...(_playScriptSegments.has(layerId) ? { play_script_segments: _getSortedPlayScriptSegments(layerId).map(_playScriptSegmentToMce) } : {}),
          ..._metadataToMce(_workflowMetadata.get(layerId)),
        };
      })
      .filter(output => output.frames.length > 0 || output.editable_state || (output.play_script_segments?.length ?? 0) > 0 || output.workflow_mode);

    _cachedMceOutputs = outputs;
    _cachedSerializationRevision = _serializationRevision;
    return _cachedMceOutputs;
  },

  loadFromMceOutputs(outputs: PhysicPaintMceOutputInput[] | null | undefined): void {
    _frames.clear();
    _editableStates.clear();
    _playScriptSegments.clear();
    _workflowMetadata.clear();
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
      for (const rawSegment of output.play_script_segments ?? []) {
        const segment = _playScriptSegmentFromMce(rawSegment);
        if (segment) _getOrCreatePlayScriptLayer(output.layer_id).set(segment.id, segment);
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

    const layerFrames = _getOrCreateLayer(payload.layerId);
    payload.frames.forEach((renderedFrame, index) => {
      const appFrame = payload.startFrame + index;
      layerFrames.set(appFrame, { ...renderedFrame, appFrame });
    });
    _editableStates.set(payload.layerId, structuredClone(payload.editableState));
    _upsertPlayScriptSegment(payload.layerId, payload.startFrame, payload.frameCount, payload.editableState);
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
    _upsertPlayScriptSegment(payload.layerId, payload.startFrame, payload.frameCount, payload.editableState);
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
    if (!_frames.has(layerId) && !_editableStates.has(layerId) && !_playScriptSegments.has(layerId) && !_workflowMetadata.has(layerId)) return;
    _frames.delete(layerId);
    _editableStates.delete(layerId);
    _playScriptSegments.delete(layerId);
    _workflowMetadata.delete(layerId);
    _notifyVisualChange();
  },

  reset(): void {
    if (_frames.size === 0 && _editableStates.size === 0 && _playScriptSegments.size === 0 && _workflowMetadata.size === 0) return;
    _frames.clear();
    _editableStates.clear();
    _playScriptSegments.clear();
    _workflowMetadata.clear();
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
