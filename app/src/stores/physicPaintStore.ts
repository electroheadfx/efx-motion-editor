import { signal } from '@preact/signals';
import type { PhysicPaintApplyPayload, PhysicPaintApplyResult, PhysicPaintRenderedFrame } from '../types/physicPaint';
import { isPhysicPaintApplyPayload } from '../types/physicPaint';

let _markProjectDirty: (() => void) | null = null;
export function _setPhysicPaintMarkDirtyCallback(cb: () => void) { _markProjectDirty = cb; }

export const physicPaintVersion = signal(0);

type PhysicPaintMceOutput = {
  layer_id: string;
  frames: PhysicPaintRenderedFrame[];
  editable_state?: PhysicPaintApplyPayload['editableState'];
};

const _frames = new Map<string, Map<number, PhysicPaintRenderedFrame>>();
const _editableStates = new Map<string, PhysicPaintApplyPayload['editableState']>();
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

  getFrames(layerId: string): Map<number, PhysicPaintRenderedFrame> {
    return new Map(_frames.get(layerId) ?? []);
  },

  toMceOutputs(): PhysicPaintMceOutput[] {
    if (_cachedSerializationRevision === _serializationRevision) {
      return _cachedMceOutputs;
    }

    const layerIds = new Set([..._frames.keys(), ..._editableStates.keys()]);
    const outputs = Array.from(layerIds)
      .map((layerId) => {
        const frames = _frames.get(layerId) ?? new Map<number, PhysicPaintRenderedFrame>();
        return {
          layer_id: layerId,
          frames: Array.from(frames.entries())
            .sort(([a], [b]) => a - b)
            .map(([frame, renderedFrame]) => ({ ...renderedFrame, appFrame: frame })),
          ...(_editableStates.has(layerId) ? { editable_state: structuredClone(_editableStates.get(layerId)!) } : {}),
        };
      })
      .filter(output => output.frames.length > 0 || output.editable_state);

    _cachedMceOutputs = outputs;
    _cachedSerializationRevision = _serializationRevision;
    return _cachedMceOutputs;
  },

  loadFromMceOutputs(outputs: Array<{ layer_id: string; frames: PhysicPaintRenderedFrame[]; editable_state?: PhysicPaintApplyPayload['editableState'] }> | null | undefined): void {
    _frames.clear();
    _editableStates.clear();
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
    if (!_frames.has(layerId) && !_editableStates.has(layerId)) return;
    _frames.delete(layerId);
    _editableStates.delete(layerId);
    _notifyVisualChange();
  },

  reset(): void {
    if (_frames.size === 0 && _editableStates.size === 0) return;
    _frames.clear();
    _editableStates.clear();
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
