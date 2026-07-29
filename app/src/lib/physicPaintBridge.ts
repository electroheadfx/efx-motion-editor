import type { Result } from './ipc';
import type { Layer } from '../types/layer';
import type { PhysicPaintApplyPayload, PhysicPaintApplyResult, PhysicPaintLaunchContext, PhysicPaintRotoAuthorityRequest, PhysicPaintRotoAuthorityResult, PhysicPaintRotoInterpolationSettings, PhysicPaintRotoPhysicalEditApplyResult, PhysicPaintRotoPhysicalEditRecord, PhysicPaintScriptLibraryResult, PhysicPaintStateSaveRequest, PhysicPaintStateSaveResult, PhysicPaintThumbnailEncodeResult } from '../types/physicPaint';
import { PHYSIC_PAINT_MAX_APPLY_FRAMES, isPhysicPaintApplyPayload, isPhysicPaintFrameSyncMessage, isPhysicPaintRotoAuthorityRequest, isPhysicPaintRotoPhysicalEditApplyPayload, isPhysicPaintScriptLibraryRequest, isPhysicPaintThumbnailEncodeRequest, isPhysicPaintThumbnailEncodeResult } from '../types/physicPaint';
import { GENERATED_ROTO_RENDER_ONLY_STATUS_TEMPLATE } from '../components/physic-paint/roto/physicsPaintRotoKeyController';
import { validatePhysicPaintRotoPhysicalEditSemanticDelta } from '../components/physic-paint/roto/physicsPaintRotoPhysicalResolver';
import { isRotoPngDataUrl, prepareRotoPhysicalRealKeyPngs } from '../components/physic-paint/roto/rotoCanvasFrames';
import {
  PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED,
  PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO,
  buildPhysicPaintRotoPhysicalRevision,
  encodePhysicPaintRotoPhysicalContent,
  parsePhysicPaintRotoPhysicalDocument,
  parsePhysicPaintRotoRealKeyRecordCollection,
  type PhysicPaintRotoInterpolationState,
  type PhysicPaintRotoRealKeyRecord,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import { parseCanonicalPhysicsPaintLaunchValue } from '../components/physic-paint/bridge/physicsPaintLaunchContext';
import { layerStore } from '../stores/layerStore';
import { physicPaintStore } from '../stores/physicPaintStore';
import { sequenceStore } from '../stores/sequenceStore';
import { timelineStore } from '../stores/timelineStore';
import { projectStore } from '../stores/projectStore';
import { scriptLibraryDelete, scriptLibraryEncodeThumbnailWebp, scriptLibraryLoad, scriptLibraryRename, scriptLibrarySave, scriptLibraryScan } from './ipc';

export const PHYSIC_PAINT_LAUNCH_EVENT = 'physic-paint:launch';
export const PHYSIC_PAINT_PROJECT_CONTEXT_EVENT = 'physic-paint:project-context';
/**
 * Standalone sends rendered-output-only PhysicPaintApplyPayload here; the app
 * validates/applies it and returns PhysicPaintApplyResult on
 * PHYSIC_PAINT_APPLY_RESULT_EVENT with the same operationId.
 */
export const PHYSIC_PAINT_APPLY_EVENT = 'physic-paint:apply';
export const PHYSIC_PAINT_APPLY_RESULT_EVENT = 'physic-paint:apply-result';
export const PHYSIC_PAINT_SCRIPT_LIBRARY_REQUEST_EVENT = 'physic-paint:script-library-request';
export const PHYSIC_PAINT_SCRIPT_LIBRARY_RESULT_EVENT = 'physic-paint:script-library-result';
export const PHYSIC_PAINT_ROTO_AUTHORITY_REQUEST_EVENT = 'physic-paint:roto-authority-request';
export const PHYSIC_PAINT_ROTO_AUTHORITY_RESULT_EVENT = 'physic-paint:roto-authority-result';
export const PHYSIC_PAINT_STATE_SAVE_REQUEST_EVENT = 'physic-paint:state-save-request';
export const PHYSIC_PAINT_STATE_SAVE_RESULT_EVENT = 'physic-paint:state-save-result';
export const PHYSIC_PAINT_THUMBNAIL_ENCODE_REQUEST_EVENT = 'physic-paint:thumbnail-encode-request';
export const PHYSIC_PAINT_THUMBNAIL_ENCODE_RESULT_EVENT = 'physic-paint:thumbnail-encode-result';

const PHYSIC_PAINT_WINDOW_LABEL = 'efx-physic-paint';
const PHYSIC_PAINT_FALLBACK_PATH = '/physics-paint';

export interface PhysicPaintCanvasSize {
  width?: number;
  height?: number;
}

export interface PhysicPaintOpenRequest {
  layer: Layer | null | undefined;
  frame: number | null | undefined;
  canvas?: PhysicPaintCanvasSize | null;
  fps?: number | null;
  workflowLabel?: string;
}

interface TauriEventApi {
  emitTo?: (target: string, event: string, payload?: unknown) => Promise<void>;
  emit?: (event: string, payload?: unknown) => Promise<void>;
  listen?: (event: string, handler: (event: { payload: unknown }) => void) => Promise<() => void>;
}

interface TauriWindowApi {
  Window?: {
    getByLabel?: (label: string) => Promise<{ close?: () => Promise<void>; destroy?: () => Promise<void> } | null>;
  };
}

interface TauriCoreApi {
  isTauri?: () => boolean;
  invoke?: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
}

interface TauriPhysicsPaintLaunchResult {
  label: string;
  visibleBefore: boolean;
  minimizedBefore: boolean;
  visible: boolean;
  minimized: boolean;
}

function shouldCloseNativeWindowAfterApply(payload: PhysicPaintApplyPayload): boolean {
  return payload.kind === 'apply-canvas' && payload.closeWindowAfterApply === true;
}

const APPLY_ERROR = 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame.';
const deliveredOperations = new Map<string, { fingerprint: string; result: PhysicPaintApplyResult }>();
const activeLaunchOperationByLayer = new Map<string, string>();

/**
 * Parent-authoritative accepted-operation ledger for the generic physical-edit
 * transaction (Plan 36.14-05 Task 2). Records one immutable canonical entry per
 * accepted history-bearing physical command, keyed by the original operationId.
 * Interpolation-only operations are acknowledged but intentionally not recorded.
 * Undo and Redo replays look up `historyCommandId` here and validate both the
 * current store state plus the submitted target state against the stored
 * `before`/`after` revisions before any mutation. Replay acceptances are NOT
 * recorded as new commands — they only consume the existing entry.
 */
interface AcceptedPhysicalCommandEntry {
  readonly operationId: string;
  readonly beforeRecords: readonly PhysicPaintRotoRealKeyRecord[];
  readonly beforeInterpolation: PhysicPaintRotoInterpolationState;
  readonly afterRecords: readonly PhysicPaintRotoRealKeyRecord[];
  readonly afterInterpolation: PhysicPaintRotoInterpolationState;
  readonly acceptedRevision: string;
}
const acceptedPhysicalCommands = new Map<string, AcceptedPhysicalCommandEntry>();

export function applyPhysicPaintPayload(payload: unknown): PhysicPaintApplyResult {
  const base = resultBase(payload);
  if (!isStructuredClonePlainData(payload) || !isPhysicPaintApplyPayload(payload)) {
    return failureResult(base, 'Invalid physics paint apply payload');
  }
  if (payload.kind === 'replace-roto-physical-map' && !isPhysicPaintRotoPhysicalEditApplyPayload(payload)) {
    return failureResult(base, 'Invalid closed physical Roto apply payload');
  }

  let fingerprint: string;
  try {
    fingerprint = fingerprintApplyPayload(payload);
  } catch (error) {
    return failureResult(base, `Invalid canonical physics paint payload: ${String(error)}`);
  }
  const prior = deliveredOperations.get(payload.operationId);
  if (prior) {
    return prior.fingerprint === fingerprint
      ? prior.result
      : applyFailureResult(payload, 'Operation ID was already used for a different payload.');
  }

  const targetLayer = [...layerStore.layers.peek(), ...layerStore.overlayLayers.peek()].find(layer => {
    if (layer.type !== 'physic-paint' || layer.source.type !== 'physic-paint') return false;
    const sourceLayerId = typeof layer.source.layerId === 'string' && layer.source.layerId.length > 0
      ? layer.source.layerId
      : layer.id;
    return sourceLayerId === payload.layerId || layer.id === payload.layerId;
  });
  if (!targetLayer) {
    return applyFailureResult(payload, `Unknown physics paint layer: ${payload.layerId}`);
  }
  if (!Number.isInteger(payload.startFrame) || payload.startFrame < 0) {
    return applyFailureResult(payload, 'Invalid physics paint start frame');
  }
  const mutationDisplayFrame = payload.kind === 'apply-canvas'
    ? payload.displayFrame ?? payload.startFrame
    : payload.startFrame;
  const generatedGuard = payload.kind === 'update-roto-interpolation-settings'
    || payload.kind === 'update-roto-playback-settings'
    || payload.kind === 'replace-roto-key-frames'
    || payload.kind === 'replace-roto-physical-map'
    ? null
    : getGeneratedRotoDisplayMutationGuard(payload.layerId, mutationDisplayFrame);
  if (generatedGuard) {
    return applyFailureResult(payload, generatedGuard);
  }

  try {
    let result: PhysicPaintApplyResult;
    if (payload.kind === 'apply-canvas') {
      result = physicPaintStore.applyCanvas(payload);
    } else if (payload.kind === 'update-roto-interpolation-settings') {
      const generatedFrames = physicPaintStore.setRotoInterpolationSettings(payload.layerId, payload.settings);
      result = successResult(payload, generatedFrames.length);
    } else if (payload.kind === 'update-roto-playback-settings') {
      const changed = physicPaintStore.setRotoPlaybackSettings(payload.layerId, payload.settings);
      result = successResult(payload, changed ? 1 : 0);
    } else if (payload.kind === 'delete-roto-frame') {
      result = physicPaintStore.deleteRotoFrame(payload);
    } else if (payload.kind === 'replace-roto-key-frames') {
      if (payload.projectContextId && payload.frameCount !== undefined && payload.expectedLayerEndExclusive !== undefined && payload.expectedRotoRevision) {
        const authority = getPhysicPaintRotoAuthority({
          operationId: payload.operationId,
          projectContextId: payload.projectContextId,
          layerId: payload.layerId,
          canonicalStart: payload.startFrame,
        });
        if (!authority.ok) return applyFailureResult(payload, authority.error ?? 'Roto authority rejected the batch.');
        if (authority.layerEndExclusive !== payload.expectedLayerEndExclusive || authority.rotoRevision !== payload.expectedRotoRevision) return applyFailureResult(payload, 'Roto authority became stale before commit.');
        if (payload.frameCount <= 0 || payload.frameCount > authority.capacity) return applyFailureResult(payload, 'Play Script exceeds the current layer capacity.');
        const incomingSources = payload.frames.map((frame) => frame.sourceFrame ?? frame.appFrame);
        if (new Set(incomingSources).size !== incomingSources.length) return applyFailureResult(payload, 'Play Script batch contains duplicate real keys.');
        const affectedSources = new Set(Array.from({ length: payload.frameCount }, (_, index) => payload.startFrame + index));
        const incomingBySource = new Map(payload.frames.map((frame) => [frame.sourceFrame ?? frame.appFrame, frame]));
        for (const source of affectedSources) {
          if (!incomingBySource.has(source)) return applyFailureResult(payload, 'Play Script batch is incomplete.');
        }
        for (const existing of authority.frames) {
          const source = existing.sourceFrame ?? existing.appFrame;
          if (affectedSources.has(source)) continue;
          const candidate = incomingBySource.get(source);
          if (!candidate || !sameDurableRealKey(candidate, existing)) return applyFailureResult(payload, 'Play Script batch changed or omitted an unrelated real key.');
        }
        const existingSources = new Set(authority.frames.map((frame) => frame.sourceFrame ?? frame.appFrame));
        for (const source of incomingSources) {
          if (!affectedSources.has(source) && !existingSources.has(source)) return applyFailureResult(payload, 'Play Script batch contains an unexpected out-of-range real key.');
        }
      }
      result = physicPaintStore.replaceRotoKeyFrames(payload);
    } else if (payload.kind === 'replace-roto-physical-map') {
      result = applyPhysicPaintRotoPhysicalMap(payload);
    } else {
      result = applyFailureResult(payload, 'Unsupported physics paint payload');
    }
    if (result.ok) deliveredOperations.set(payload.operationId, { fingerprint, result });
    return result.ok ? result : { ...result, error: `${APPLY_ERROR} ${result.error ?? ''}`.trim() };
  } catch (error) {
    return applyFailureResult(payload, `${APPLY_ERROR} ${String(error)}`);
  }
}

async function applyPreparedPhysicPaintPayload(payload: unknown): Promise<PhysicPaintApplyResult> {
  if (!isPhysicPaintRotoPhysicalEditApplyPayload(payload)) return applyPhysicPaintPayload(payload);
  const preparedDataUrls = new Set(payload.records.map((record) => record.payload.dataUrl));
  try {
    await prepareRotoPhysicalRealKeyPngs(payload.records);
  } catch (error) {
    physicPaintStore.pruneUnreferencedRotoAlphaCanvases(preparedDataUrls);
    return applyFailureResult(
      payload,
      error instanceof Error ? error.message : 'Canonical Roto PNG preparation failed.',
    );
  }
  const result = applyPhysicPaintPayload(payload);
  if (!result.ok) physicPaintStore.pruneUnreferencedRotoAlphaCanvases(preparedDataUrls);
  return result;
}

export function getPhysicPaintRotoAuthority(request: PhysicPaintRotoAuthorityRequest): PhysicPaintRotoAuthorityResult {
  const failure = (error: string): PhysicPaintRotoAuthorityResult => ({
    operationId: request.operationId,
    ok: false,
    projectContextId: request.projectContextId,
    layerId: request.layerId,
    canonicalStart: request.canonicalStart,
    layerEndExclusive: request.canonicalStart,
    capacity: 0,
    physicalCapacity: 0,
    rotoRevision: '',
    physicalRevision: '',
    physicalRecords: [],
    interpolationEnabled: false,
    interpolationMode: 'duplicate',
    frames: [],
    interpolationSettings: physicPaintStore.getRotoInterpolationSettings(request.layerId),
    error,
  });
  if (request.projectContextId !== projectStore.projectContextId.peek()) return failure('Project context changed.');
  const layer = [...layerStore.layers.peek(), ...layerStore.overlayLayers.peek()].find((candidate) => candidate.id === request.layerId || (candidate.type === 'physic-paint' && candidate.source.type === 'physic-paint' && candidate.source.layerId === request.layerId));
  if (!layer || layer.type !== 'physic-paint') return failure('Physics Paint layer is unavailable.');
  if (!Number.isInteger(request.canonicalStart) || request.canonicalStart < 0) return failure('Canonical Roto start is invalid.');
  const physicalCapacity = physicPaintStore.getRotoPhysicalCapacity(request.layerId);
  const remainingCapacity = getTimelineRangeFrameCount(layer, request.canonicalStart);
  const physicalRemaining = physicalCapacity - request.canonicalStart;
  if (remainingCapacity === null || physicalRemaining <= 0) return failure('No remaining Physics Paint sequence capacity is available.');
  const capacity = Math.min(remainingCapacity, physicalRemaining, PHYSIC_PAINT_MAX_APPLY_FRAMES);
  const records = physicPaintStore.getRotoRealKeyRecords(request.layerId);
  const interpolation = physicPaintStore.getRotoPhysicalInterpolationState(request.layerId);
  const physicalRevision = buildPhysicPaintRotoPhysicalRevision(records, interpolation);
  const physicalRecords = records.map((record) => ({
    keyId: record.keyId,
    appFrame: record.appFrame,
    payload: record.payload,
  }));
  const frames = records.map((record) => ({ ...record.payload, source: 'real-key' as const }));
  return {
    operationId: request.operationId,
    ok: true,
    projectContextId: request.projectContextId,
    layerId: request.layerId,
    canonicalStart: request.canonicalStart,
    layerEndExclusive: request.canonicalStart + capacity,
    capacity,
    physicalCapacity,
    rotoRevision: physicalRevision,
    physicalRevision,
    physicalRecords,
    interpolationEnabled: interpolation.enabled,
    interpolationMode: interpolation.mode,
    frames,
    interpolationSettings: physicPaintStore.getRotoInterpolationSettings(request.layerId),
  };
}

/**
 * Default interpolation settings echoed on malformed-authority failures. Never
 * derived from store state: invalid requests must not query store state with
 * an unvalidated layer ID.
 */
const INVALID_AUTHORITY_INTERPOLATION_SETTINGS: PhysicPaintRotoInterpolationSettings = {
  enabled: false,
  inBetweenCount: 1,
  mode: 'duplicate',
  position: 0,
  deform: 0,
};

function extractAuthorityEnvelopeFields(payload: unknown): PhysicPaintRotoAuthorityRequest {
  if (typeof payload !== 'object' || payload === null) {
    return { operationId: '', projectContextId: '', layerId: '', canonicalStart: 0 };
  }
  const record = payload as Record<string, unknown>;
  return {
    operationId: typeof record.operationId === 'string' ? record.operationId : '',
    projectContextId: typeof record.projectContextId === 'string' ? record.projectContextId : '',
    layerId: typeof record.layerId === 'string' ? record.layerId : '',
    canonicalStart: typeof record.canonicalStart === 'number' && Number.isInteger(record.canonicalStart) && record.canonicalStart >= 0 ? record.canonicalStart : 0,
  };
}

/**
 * Validating entry point for untrusted authority-request payloads (CR-01).
 * Tauri and postMessage listeners receive `unknown` payloads; only requests
 * that pass the strict runtime validator reach
 * {@link getPhysicPaintRotoAuthority}. Malformed payloads get a failure result
 * built from best-effort envelope fields and never touch store state.
 */
export function getPhysicPaintRotoAuthorityFromUnknown(payload: unknown): PhysicPaintRotoAuthorityResult {
  if (isPhysicPaintRotoAuthorityRequest(payload)) return getPhysicPaintRotoAuthority(payload);
  const fields = extractAuthorityEnvelopeFields(payload);
  return {
    operationId: fields.operationId,
    ok: false,
    projectContextId: fields.projectContextId,
    layerId: fields.layerId,
    canonicalStart: fields.canonicalStart,
    layerEndExclusive: fields.canonicalStart,
    capacity: 0,
    physicalCapacity: 0,
    rotoRevision: '',
    physicalRevision: '',
    physicalRecords: [],
    interpolationEnabled: false,
    interpolationMode: 'duplicate',
    frames: [],
    interpolationSettings: { ...INVALID_AUTHORITY_INTERPOLATION_SETTINGS },
    error: 'Malformed Roto authority request.',
  };
}

function fingerprintApplyPayload(payload: PhysicPaintApplyPayload): string {
  if (payload.kind === 'replace-roto-physical-map') {
    const canonicalRecords = payload.records.map((record) => ({
      kind: 'real-key' as const,
      keyId: record.keyId,
      appFrame: record.appFrame,
      payload: record.payload,
    }));
    const content = encodePhysicPaintRotoPhysicalContent(canonicalRecords, {
      enabled: payload.interpolationEnabled,
      mode: payload.interpolationMode,
    });
    const provenance = payload.historyProvenance
      ? `${payload.historyProvenance.historyCommandId}:${payload.historyProvenance.historyDirection}:${payload.historyProvenance.sourceRevision}:${payload.historyProvenance.targetRevision}`
      : 'ordinary';
    return [
      payload.kind,
      payload.operationId,
      payload.operationKind,
      payload.layerId,
      String(payload.startFrame),
      payload.launchOperationId,
      payload.projectContextId ?? '',
      payload.expectedRevision,
      content,
      payload.selectedKeyId ?? '',
      payload.selectedAppFrame === null ? 'null' : String(payload.selectedAppFrame),
      payload.semanticDelta ? stableSerialize(payload.semanticDelta, new WeakSet<object>()) : 'mapping-only',
      provenance,
    ].map((segment) => `${segment.length}:${segment}`).join('|');
  }
  return stableSerialize(payload, new WeakSet<object>());
}

function isStructuredClonePlainData(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.every((entry) => isStructuredClonePlainData(entry, seen));
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    return Object.values(value as Record<string, unknown>).every((entry) => isStructuredClonePlainData(entry, seen));
  } finally {
    seen.delete(value);
  }
}

function stableSerialize(value: unknown, seen: WeakSet<object>): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (seen.has(value)) throw new TypeError('Physics Paint payload contains a cyclic value.');
  seen.add(value);
  try {
    if (Array.isArray(value)) return `[${value.map((entry) => stableSerialize(entry, seen)).join(',')}]`;
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key], seen)}`).join(',')}}`;
  } finally {
    seen.delete(value);
  }
}

function sameDurableRealKey(left: PhysicPaintRotoAuthorityResult['frames'][number], right: PhysicPaintRotoAuthorityResult['frames'][number]): boolean {
  return (left.sourceFrame ?? left.appFrame) === (right.sourceFrame ?? right.appFrame)
    && left.appFrame === right.appFrame
    && left.frameIndex === right.frameIndex
    && left.dataUrl === right.dataUrl
    && left.width === right.width
    && left.height === right.height
    && left.source === right.source
    && left.nearestRealKeyFrame === right.nearestRealKeyFrame
    && left.displayFrame === right.displayFrame
    && left.fromSourceFrame === right.fromSourceFrame
    && left.toSourceFrame === right.toSourceFrame
    && left.interpolationT === right.interpolationT
    && left.backgroundOnly === right.backgroundOnly
    && left.onionDataUrl === right.onionDataUrl;
}

function samePhysicalRecord(
  left: import('../components/physic-paint/roto/physicsPaintRotoPhysicalModel').PhysicPaintRotoRealKeyRecord,
  right: import('../components/physic-paint/roto/physicsPaintRotoPhysicalModel').PhysicPaintRotoRealKeyRecord,
): boolean {
  return left.keyId === right.keyId
    && left.appFrame === right.appFrame
    && left.payload.frameIndex === right.payload.frameIndex
    && left.payload.appFrame === right.payload.appFrame
    && left.payload.dataUrl === right.payload.dataUrl
    && left.payload.width === right.payload.width
    && left.payload.height === right.payload.height;
}

function sameCompletePhysicalRecords(
  left: readonly import('../components/physic-paint/roto/physicsPaintRotoPhysicalModel').PhysicPaintRotoRealKeyRecord[],
  right: readonly import('../components/physic-paint/roto/physicsPaintRotoPhysicalModel').PhysicPaintRotoRealKeyRecord[],
): boolean {
  return left.length === right.length
    && left.every((record, index) => samePhysicalRecord(record, right[index]));
}

function sameApplyPayloadRecords(
  left: readonly PhysicPaintRotoPhysicalEditRecord[],
  right: readonly PhysicPaintRotoPhysicalEditRecord[],
): boolean {
  return left.length === right.length && left.every((record, index) => {
    const candidate = right[index];
    return candidate !== undefined
      && record.keyId === candidate.keyId
      && record.appFrame === candidate.appFrame
      && record.payload.frameIndex === candidate.payload.frameIndex
      && record.payload.appFrame === candidate.payload.appFrame
      && record.payload.dataUrl === candidate.payload.dataUrl
      && record.payload.width === candidate.payload.width
      && record.payload.height === candidate.payload.height;
  });
}

function validatePlayScriptPhysicalDelta(input: {
  readonly payload: Extract<PhysicPaintApplyPayload, { kind: 'replace-roto-physical-map' }>;
  readonly layer: Layer;
  readonly currentRecords: readonly import('../components/physic-paint/roto/physicsPaintRotoPhysicalModel').PhysicPaintRotoRealKeyRecord[];
  readonly proposedRecords: readonly import('../components/physic-paint/roto/physicsPaintRotoPhysicalModel').PhysicPaintRotoRealKeyRecord[];
  readonly capacity: number;
  readonly currentInterpolation: PhysicPaintRotoInterpolationState;
}): string | null {
  const { payload, layer, currentRecords, proposedRecords, capacity, currentInterpolation } = input;
  const delta = payload.semanticDelta;
  if (!delta || delta.kind !== 'play-script') return 'Play Script physical edit is missing its exact semantic declaration.';
  const remainingCapacity = getTimelineRangeFrameCount(layer, delta.affectedStartAppFrame);
  const expectedLayerEndExclusive = remainingCapacity === null
    ? null
    : delta.affectedStartAppFrame + Math.min(remainingCapacity, capacity - delta.affectedStartAppFrame, PHYSIC_PAINT_MAX_APPLY_FRAMES);
  if (payload.historyProvenance !== undefined
    || payload.interpolationEnabled !== currentInterpolation.enabled
    || payload.interpolationMode !== currentInterpolation.mode
    || payload.startFrame !== delta.affectedStartAppFrame
    || delta.expectedLayerCapacity !== capacity
    || expectedLayerEndExclusive === null
    || delta.expectedLayerEndExclusive !== expectedLayerEndExclusive
    || delta.affectedEndAppFrame < delta.affectedStartAppFrame
    || delta.affectedEndAppFrame >= delta.expectedLayerEndExclusive) return 'Play Script range, capacity, interpolation, or history metadata is invalid.';

  const proposedPayloadRecords = proposedRecords.map((record) => ({
    keyId: record.keyId,
    appFrame: record.appFrame,
    payload: record.payload,
  }));
  if (!sameApplyPayloadRecords(proposedPayloadRecords, delta.proposedRecords)) return 'Play Script semantic records do not match the submitted complete physical map.';

  const currentByFrame = new Map(currentRecords.map((record) => [record.appFrame, record]));
  const currentKeyIds = new Set(currentRecords.map((record) => record.keyId));
  const proposedByFrame = new Map<number, (typeof proposedRecords)[number]>();
  const proposedKeyIds = new Set<string>();
  for (const record of proposedRecords) {
    if (proposedByFrame.has(record.appFrame)
      || proposedKeyIds.has(record.keyId)
      || record.payload.appFrame !== record.appFrame) return 'Play Script proposed duplicate or misplaced physical identity.';
    proposedByFrame.set(record.appFrame, record);
    proposedKeyIds.add(record.keyId);
  }

  for (const current of currentRecords) {
    if (current.appFrame >= delta.affectedStartAppFrame && current.appFrame <= delta.affectedEndAppFrame) continue;
    const proposed = proposedByFrame.get(current.appFrame);
    if (!proposed || !samePhysicalRecord(current, proposed)) return 'Play Script changed or omitted an unrelated physical record.';
  }
  for (const proposed of proposedRecords) {
    if (proposed.appFrame < delta.affectedStartAppFrame || proposed.appFrame > delta.affectedEndAppFrame) {
      const current = currentByFrame.get(proposed.appFrame);
      if (!current || !samePhysicalRecord(current, proposed)) return 'Play Script introduced an unexpected out-of-range physical record.';
    }
  }

  const expectedFreshKeyIds: string[] = [];
  for (let appFrame = delta.affectedStartAppFrame; appFrame <= delta.affectedEndAppFrame; appFrame += 1) {
    const proposed = proposedByFrame.get(appFrame);
    if (!proposed || !isRotoPngDataUrl(proposed.payload.dataUrl)) return 'Play Script is missing a valid PNG destination record.';
    const current = currentByFrame.get(appFrame);
    if (current) {
      if (proposed.keyId !== current.keyId) return 'Play Script changed an occupied destination keyId.';
    } else {
      if (currentKeyIds.has(proposed.keyId)) return 'Play Script reused an existing keyId at an empty destination.';
      expectedFreshKeyIds.push(proposed.keyId);
    }
  }
  if (expectedFreshKeyIds.length !== delta.freshKeyIds.length
    || expectedFreshKeyIds.some((keyId, index) => keyId !== delta.freshKeyIds[index])
    || new Set(delta.freshKeyIds).size !== delta.freshKeyIds.length) return 'Play Script fresh key declarations do not match the affected empty destinations.';
  const selected = proposedByFrame.get(delta.affectedStartAppFrame);
  if (!selected
    || payload.selectedKeyId !== selected.keyId
    || payload.selectedAppFrame !== delta.affectedStartAppFrame) return 'Play Script selection does not match the accepted start destination.';
  return null;
}

/**
 * Apply the generic acknowledged physical-edit payload (Plan 36.14-04
 * Task 3). The parent revalidates project/launch/layer identity, expected
 * revision, complete records, capacity, and selected identity before one
 * store replacement; identical replay is idempotent, changed-content ID
 * reuse fails, and rejection mutates no state.
 *
 * Plan 36.14-05 Task 2: for ordinary kinds, on a successful mutation the
 * parent records one immutable canonical entry in the accepted-operation
 * ledger keyed by `operationId`. For Undo/Redo replays, the parent looks
 * up `historyProvenance.historyCommandId` in the ledger, requires the
 * current canonical revision to equal `sourceRevision` and the submitted
 * target revision to equal `targetRevision`, then mutates once. Replay
 * acceptances are NOT recorded as new commands.
 */
function physicalEditResult(
  payload: Extract<PhysicPaintApplyPayload, { kind: 'replace-roto-physical-map' }>,
  options: {
    readonly ok: boolean;
    readonly stagedRevision?: string;
    readonly acceptedRevision?: string | null;
    readonly selectedKeyId?: string | null;
    readonly selectedAppFrame?: number | null;
    readonly error?: string;
  },
): PhysicPaintRotoPhysicalEditApplyResult {
  let stagedRevision = options.stagedRevision;
  if (!stagedRevision) {
    try {
      const records = payload.records.map((record) => ({ kind: 'real-key' as const, ...record }));
      stagedRevision = buildPhysicPaintRotoPhysicalRevision(records, {
        enabled: payload.interpolationEnabled,
        mode: payload.interpolationMode,
      });
    } catch {
      stagedRevision = 'invalid-physical-revision';
    }
  }
  if (options.ok && !options.acceptedRevision) {
    throw new Error('Physical edit success requires the parent accepted revision.');
  }
  return {
    operationId: payload.operationId,
    kind: 'replace-roto-physical-map',
    operationKind: payload.operationKind,
    layerId: payload.layerId,
    startFrame: payload.startFrame,
    launchOperationId: payload.launchOperationId,
    ...(payload.projectContextId !== undefined ? { projectContextId: payload.projectContextId } : {}),
    expectedRevision: payload.expectedRevision,
    stagedRevision,
    acceptedRevision: options.ok ? options.acceptedRevision as string : null,
    interpolationMode: payload.interpolationMode,
    selectedKeyId: options.selectedKeyId === undefined ? payload.selectedKeyId : options.selectedKeyId,
    selectedAppFrame: options.selectedAppFrame === undefined ? payload.selectedAppFrame : options.selectedAppFrame,
    appliedFrameCount: options.ok ? payload.records.length : 0,
    ok: options.ok,
    ...(options.error !== undefined ? { error: options.error } : {}),
    ...(payload.semanticDelta ? { semanticDelta: payload.semanticDelta } : {}),
    ...(payload.historyProvenance ? { historyProvenance: payload.historyProvenance } : {}),
  };
}

function applyFailureResult(payload: PhysicPaintApplyPayload, error: string): PhysicPaintApplyResult {
  return payload.kind === 'replace-roto-physical-map'
    ? physicalEditResult(payload, { ok: false, error })
    : failureResult(payload, error);
}

function applyPhysicPaintRotoPhysicalMap(payload: Extract<PhysicPaintApplyPayload, { kind: 'replace-roto-physical-map' }>): PhysicPaintRotoPhysicalEditApplyResult {
  const reject = (error: string, stagedRevision?: string) => physicalEditResult(payload, { ok: false, error, stagedRevision });
  const isPlayScript = payload.operationKind === 'play-script';
  if (isPlayScript && (!projectStore.filePath.peek() || !projectStore.scriptLibraryAuthority.peek())) {
    return reject('Save the project first.');
  }
  if (isPlayScript && payload.projectContextId !== projectStore.projectContextId.peek()) {
    return reject('Project context changed before the Play Script could be applied.');
  }
  if (payload.projectContextId && payload.projectContextId !== projectStore.projectContextId.peek()) {
    return reject('Project context changed before the physical edit could be applied.');
  }
  const layer = [...layerStore.layers.peek(), ...layerStore.overlayLayers.peek()].find((candidate) => candidate.id === payload.layerId || (candidate.type === 'physic-paint' && candidate.source.type === 'physic-paint' && candidate.source.layerId === payload.layerId));
  if (!layer || layer.type !== 'physic-paint') {
    return reject('Physics Paint layer is unavailable for the physical edit.');
  }
  if (activeLaunchOperationByLayer.get(payload.layerId) !== payload.launchOperationId) {
    return reject('Physics Paint launch context changed before the physical edit could be applied.');
  }
  const currentRecords = physicPaintStore.getRotoRealKeyRecords(payload.layerId);
  const currentInterpolation = physicPaintStore.getRotoPhysicalInterpolationState(payload.layerId);
  const currentDocument = physicPaintStore.getRotoPhysicalDocument(payload.layerId);
  if (isPlayScript && !currentDocument) {
    return reject('Canonical Roto physical document is unavailable for Play Script.');
  }
  const currentRevision = buildPhysicPaintRotoPhysicalRevision(currentRecords, currentInterpolation);
  if (currentRevision !== payload.expectedRevision) {
    return reject('Roto physical revision became stale before commit.');
  }
  const capacity = physicPaintStore.getRotoPhysicalCapacity(payload.layerId);
  if (payload.records.length > capacity) {
    return reject('Roto physical edit exceeds the current layer capacity.');
  }
  let proposedRecords: readonly import('../components/physic-paint/roto/physicsPaintRotoPhysicalModel').PhysicPaintRotoRealKeyRecord[];
  try {
    proposedRecords = parsePhysicPaintRotoRealKeyRecordCollection(
      payload.records.map((record) => ({ kind: 'real-key' as const, ...record })),
      capacity,
    );
  } catch (error) {
    return reject(error instanceof Error ? error.message : 'Roto physical records are malformed.');
  }
  if ((payload.selectedKeyId === null) !== (payload.selectedAppFrame === null)) {
    return reject('Roto physical selection identity and frame must both be null or both be present.');
  }
  if (payload.selectedKeyId !== null) {
    const selectedRecord = proposedRecords.find((record) => record.keyId === payload.selectedKeyId);
    if (!selectedRecord || selectedRecord.appFrame !== payload.selectedAppFrame) {
      return reject('Roto physical selection does not match the submitted identity set.');
    }
  }

  const isInterpolationEnabledChange = payload.operationKind === 'set-interpolation-enabled';
  const isInterpolationModeChange = payload.operationKind === 'set-interpolation-mode';
  const isInterpolationChange = isInterpolationEnabledChange || isInterpolationModeChange;
  const isReplay = payload.operationKind === 'undo' || payload.operationKind === 'redo';
  if (!isInterpolationChange
    && !isPlayScript
    && !isReplay
    && (payload.interpolationEnabled !== currentInterpolation.enabled
      || payload.interpolationMode !== currentInterpolation.mode)) {
    return reject('Ordinary physical edits must preserve the accepted interpolation state.');
  }
  if (isInterpolationChange) {
    if (!sameCompletePhysicalRecords(currentRecords, proposedRecords)) {
      return reject('Interpolation change must preserve every physical real-key record exactly.');
    }
    if (isInterpolationEnabledChange
      && (payload.interpolationEnabled === currentInterpolation.enabled
        || payload.interpolationMode !== currentInterpolation.mode)) {
      return reject('Interpolation enabled change must alter only the accepted enabled state.');
    }
    if (isInterpolationModeChange
      && (payload.interpolationEnabled !== currentInterpolation.enabled
        || payload.interpolationMode === currentInterpolation.mode)) {
      return reject('Interpolation mode change must alter only the accepted mode.');
    }
    if (payload.semanticDelta !== undefined || payload.historyProvenance !== undefined) {
      return reject('Interpolation change cannot carry semantic or history metadata.');
    }
  }

  if (isPlayScript) {
    const playScriptValidationError = validatePlayScriptPhysicalDelta({
      payload,
      layer,
      currentRecords,
      proposedRecords,
      capacity,
      currentInterpolation,
    });
    if (playScriptValidationError) return reject(playScriptValidationError);
  }

  const stagedInterpolation: PhysicPaintRotoInterpolationState = {
    enabled: payload.interpolationEnabled,
    mode: payload.interpolationMode,
  };
  const stagedRevision = buildPhysicPaintRotoPhysicalRevision(proposedRecords, stagedInterpolation);
  if (payload.operationKind === 'duplicate-key' || payload.operationKind === 'paste-key' || payload.operationKind === 'paste-key-group') {
    const semanticValidation = validatePhysicPaintRotoPhysicalEditSemanticDelta({
      operationKind: payload.operationKind,
      currentRecords,
      nextRecords: proposedRecords,
      semanticDelta: payload.semanticDelta,
      capacity,
      selectedKeyId: payload.selectedKeyId,
      selectedAppFrame: payload.selectedAppFrame,
    });
    if (!semanticValidation.ok) return reject(semanticValidation.error, stagedRevision);
  }

  if (isReplay) {
    const provenance = payload.historyProvenance;
    if (!provenance) return reject('Roto physical replay is missing history provenance.', stagedRevision);
    if (provenance.historyDirection !== payload.operationKind) return reject('Roto physical replay provenance direction mismatch.', stagedRevision);
    const original = acceptedPhysicalCommands.get(provenance.historyCommandId);
    if (!original) return reject('Roto physical replay targets an unknown accepted command.', stagedRevision);
    if (currentRevision !== provenance.sourceRevision) return reject('Roto physical replay source revision does not match the current state.', stagedRevision);
    if (stagedRevision !== provenance.targetRevision) return reject('Roto physical replay target revision does not match the original command.', stagedRevision);
    const originalBeforeRevision = buildPhysicPaintRotoPhysicalRevision(original.beforeRecords, original.beforeInterpolation);
    if (provenance.historyDirection === 'undo') {
      if (provenance.sourceRevision !== original.acceptedRevision) return reject('Roto physical undo source revision does not match the original accepted state.', stagedRevision);
      if (provenance.targetRevision !== originalBeforeRevision) return reject('Roto physical undo target revision does not match the original before state.', stagedRevision);
    } else {
      if (provenance.sourceRevision !== originalBeforeRevision) return reject('Roto physical redo source revision does not match the original before state.', stagedRevision);
      if (provenance.targetRevision !== original.acceptedRevision) return reject('Roto physical redo target revision does not match the original accepted state.', stagedRevision);
    }
  }

  const cursorAppFrame = payload.selectedAppFrame ?? Math.max(0, Math.min(capacity - 1, payload.startFrame));
  const stagedDocument = parsePhysicPaintRotoPhysicalDocument({
    capacity,
    realKeyRecords: proposedRecords,
    interpolation: stagedInterpolation,
    scriptMotion: currentDocument?.scriptMotion ?? PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO,
    background: currentDocument?.background ?? physicPaintStore.getRotoBackgroundMetadata(payload.layerId),
    selectedKeyId: payload.selectedKeyId,
    cursorAppFrame,
    revision: stagedRevision,
  });
  const replaceResult = physicPaintStore.replaceRotoPhysicalDocument(payload.layerId, stagedDocument);
  if (!replaceResult.ok) return reject(replaceResult.error, stagedRevision);
  const acceptedDocument = replaceResult.document;
  const acceptedSelectedKeyId = acceptedDocument.selectedKeyId;
  const acceptedSelectedAppFrame = acceptedSelectedKeyId === null ? null : acceptedDocument.cursorAppFrame;

  if (!isReplay && !isInterpolationChange && !isPlayScript) {
    const afterRecords = acceptedDocument.realKeyRecords.map((record) => ({
      ...record,
      payload: { ...record.payload },
    }));
    acceptedPhysicalCommands.set(payload.operationId, {
      operationId: payload.operationId,
      beforeRecords: currentRecords.map((record) => ({
        ...record,
        payload: { ...record.payload },
      })),
      beforeInterpolation: {
        enabled: currentInterpolation.enabled,
        mode: currentInterpolation.mode,
      },
      afterRecords,
      afterInterpolation: {
        enabled: acceptedDocument.interpolation.enabled,
        mode: acceptedDocument.interpolation.mode,
      },
      acceptedRevision: acceptedDocument.revision,
    });
  }

  return physicalEditResult(payload, {
    ok: true,
    stagedRevision,
    acceptedRevision: acceptedDocument.revision,
    selectedKeyId: acceptedSelectedKeyId,
    selectedAppFrame: acceptedSelectedAppFrame,
  });
}

export async function applyPhysicPaintScriptLibraryRequest(value: unknown): Promise<PhysicPaintScriptLibraryResult> {
  const request = isPhysicPaintScriptLibraryRequest(value) ? value : null;
  const operationId = request?.operationId ?? 'invalid-operation';
  const kind = request?.kind ?? 'scan';
  const failure = (error: string): PhysicPaintScriptLibraryResult => ({ operationId, kind, ok: false, rows: [], skippedInvalidCount: 0, diagnostics: [], error });
  if (!request) return failure('Invalid script library request');
  const authority = projectStore.scriptLibraryAuthority.peek();
  if (!authority || !projectStore.filePath.peek()) return failure('Save the project first.');
  try {
    const result = request.kind === 'scan'
      ? await scriptLibraryScan(authority)
      : request.kind === 'save'
        ? await scriptLibrarySave(authority, request.script)
        : request.kind === 'load'
          ? await scriptLibraryLoad(authority, request.scriptId)
          : request.kind === 'rename'
            ? await scriptLibraryRename(authority, request.scriptId, request.expectedRevision, request.name)
            : await scriptLibraryDelete(authority, request.scriptId, request.expectedRevision);
    if (!result.ok) return failure(result.error);
    const operation = 'scan' in result.data ? result.data : { scan: result.data };
    return {
      operationId,
      kind,
      ok: true,
      rows: operation.scan.rows,
      skippedInvalidCount: operation.scan.skippedInvalidCount,
      diagnostics: operation.scan.diagnostics,
      ...('script' in operation && operation.script ? { script: operation.script } : {}),
    };
  } catch (error) {
    return failure(String(error));
  }
}

export async function publishPhysicPaintProjectContext(): Promise<void> {
  const project = { name: projectStore.name.peek(), saved: Boolean(projectStore.filePath.peek() && projectStore.scriptLibraryAuthority.peek()), contextId: projectStore.projectContextId.peek() };
  if (isTauriRuntime()) {
    const eventApi = await import('@tauri-apps/api/event');
    await eventApi.emitTo?.(PHYSIC_PAINT_WINDOW_LABEL, PHYSIC_PAINT_PROJECT_CONTEXT_EVENT, project);
  }
  if (typeof window !== 'undefined') {
    const message = { type: PHYSIC_PAINT_PROJECT_CONTEXT_EVENT, payload: project };
    window.dispatchEvent(new CustomEvent(PHYSIC_PAINT_PROJECT_CONTEXT_EVENT, { detail: project }));
    window.opener?.postMessage?.(message, window.location.origin);
  }
}

export async function installPhysicPaintStateSaveListener(): Promise<() => void> {
  const saveRequest = async (value: unknown): Promise<PhysicPaintStateSaveResult> => {
    const request = value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<PhysicPaintStateSaveRequest> : null;
    const operationId = typeof request?.operationId === 'string' ? request.operationId : 'invalid-operation';
    if (!request || typeof request.operationId !== 'string' || typeof request.filename !== 'string' || typeof request.contents !== 'string') {
      return { operationId, status: 'error', error: 'Invalid Physics Paint state save request' };
    }
    if (request.contents.length > 32 * 1024 * 1024) return { operationId, status: 'error', error: 'Physics Paint state exceeds the save limit' };
    try {
      const [{ save }, { writeTextFile }] = await Promise.all([
        import('@tauri-apps/plugin-dialog'),
        import('@tauri-apps/plugin-fs'),
      ]);
      const selectedPath = await save({ defaultPath: request.filename, filters: [{ name: 'Physics paint state', extensions: ['json'] }] });
      if (!selectedPath) return { operationId, status: 'cancelled' };
      await writeTextFile(selectedPath, request.contents);
      return { operationId, status: 'saved' };
    } catch (error) {
      return { operationId, status: 'error', error: String(error) };
    }
  };
  const emitResult = async (result: PhysicPaintStateSaveResult, source?: Pick<Window, 'postMessage'> | null) => {
    if (isTauriRuntime()) {
      const eventApi = await import('@tauri-apps/api/event');
      await eventApi.emitTo?.(PHYSIC_PAINT_WINDOW_LABEL, PHYSIC_PAINT_STATE_SAVE_RESULT_EVENT, result);
    }
    if (typeof window !== 'undefined') source?.postMessage?.({ type: PHYSIC_PAINT_STATE_SAVE_RESULT_EVENT, payload: result }, window.location.origin);
  };
  if (isTauriRuntime()) {
    const eventApi = await import('@tauri-apps/api/event');
    const unlisten = await eventApi.listen?.(PHYSIC_PAINT_STATE_SAVE_REQUEST_EVENT, async (event) => emitResult(await saveRequest(event.payload)));
    if (unlisten) return unlisten;
  }
  if (typeof window === 'undefined') return () => {};
  const message = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || event.data?.type !== PHYSIC_PAINT_STATE_SAVE_REQUEST_EVENT) return;
    const source = event.source && 'postMessage' in event.source ? event.source as Pick<Window, 'postMessage'> : undefined;
    void saveRequest(event.data.payload).then((result) => emitResult(result, source));
  };
  window.addEventListener('message', message);
  return () => window.removeEventListener('message', message);
}

export async function installPhysicPaintThumbnailEncodeListener(): Promise<() => void> {
  if (!isTauriRuntime()) return () => {};
  const eventApi = await import('@tauri-apps/api/event');
  const unlisten = await eventApi.listen?.(PHYSIC_PAINT_THUMBNAIL_ENCODE_REQUEST_EVENT, async (event) => {
    const request = isPhysicPaintThumbnailEncodeRequest(event.payload) ? event.payload : null;
    const operationId = request?.operationId ?? 'invalid-operation';
    let result: PhysicPaintThumbnailEncodeResult;
    if (!request) {
      result = { operationId, ok: false, width: 1, height: 1, mimeType: 'image/webp', error: 'Invalid thumbnail encode request' };
    } else {
      const encoded = await scriptLibraryEncodeThumbnailWebp(request);
      const candidate: PhysicPaintThumbnailEncodeResult = encoded.ok
        ? { operationId, ok: true, ...encoded.data }
        : { operationId, ok: false, width: request.width, height: request.height, mimeType: 'image/webp', error: encoded.error };
      result = isPhysicPaintThumbnailEncodeResult(candidate)
        ? candidate
        : { operationId, ok: false, width: request.width, height: request.height, mimeType: 'image/webp', error: 'Native thumbnail encoder returned an invalid result' };
    }
    await eventApi.emitTo?.(PHYSIC_PAINT_WINDOW_LABEL, PHYSIC_PAINT_THUMBNAIL_ENCODE_RESULT_EVENT, result);
  });
  return unlisten ?? (() => {});
}

export async function installPhysicPaintScriptLibraryListener(): Promise<() => void> {
  const emitResult = async (result: PhysicPaintScriptLibraryResult, source?: Pick<Window, 'postMessage'> | null) => {
    if (isTauriRuntime()) {
      const eventApi = await import('@tauri-apps/api/event');
      await eventApi.emit?.(PHYSIC_PAINT_SCRIPT_LIBRARY_RESULT_EVENT, result);
      await eventApi.emitTo?.(PHYSIC_PAINT_WINDOW_LABEL, PHYSIC_PAINT_SCRIPT_LIBRARY_RESULT_EVENT, result);
    }
    if (typeof window !== 'undefined') {
      const message = { type: PHYSIC_PAINT_SCRIPT_LIBRARY_RESULT_EVENT, payload: result };
      window.dispatchEvent(new CustomEvent(PHYSIC_PAINT_SCRIPT_LIBRARY_RESULT_EVENT, { detail: result }));
      source?.postMessage?.(message, window.location.origin);
      window.opener?.postMessage?.(message, window.location.origin);
    }
  };
  if (isTauriRuntime()) {
    const eventApi = await import('@tauri-apps/api/event');
    const unlisten = await eventApi.listen?.(PHYSIC_PAINT_SCRIPT_LIBRARY_REQUEST_EVENT, async (event) => emitResult(await applyPhysicPaintScriptLibraryRequest(event.payload)));
    if (unlisten) return unlisten;
  }
  if (typeof window === 'undefined') return () => {};
  const custom = (event: Event) => { void applyPhysicPaintScriptLibraryRequest((event as CustomEvent).detail).then((result) => emitResult(result)); };
  const message = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || !event.data || event.data.type !== PHYSIC_PAINT_SCRIPT_LIBRARY_REQUEST_EVENT) return;
    const source = event.source && 'postMessage' in event.source ? event.source as Pick<Window, 'postMessage'> : undefined;
    void applyPhysicPaintScriptLibraryRequest(event.data.payload).then((result) => emitResult(result, source));
  };
  window.addEventListener(PHYSIC_PAINT_SCRIPT_LIBRARY_REQUEST_EVENT, custom);
  window.addEventListener('message', message);
  return () => { window.removeEventListener(PHYSIC_PAINT_SCRIPT_LIBRARY_REQUEST_EVENT, custom); window.removeEventListener('message', message); };
}

export async function installPhysicPaintRotoAuthorityListener(): Promise<() => void> {
  const emitResult = async (result: PhysicPaintRotoAuthorityResult, source?: Pick<Window, 'postMessage'> | null) => {
    if (isTauriRuntime()) {
      const eventApi = await import('@tauri-apps/api/event');
      await eventApi.emitTo?.(PHYSIC_PAINT_WINDOW_LABEL, PHYSIC_PAINT_ROTO_AUTHORITY_RESULT_EVENT, result);
    }
    if (typeof window !== 'undefined') source?.postMessage?.({ type: PHYSIC_PAINT_ROTO_AUTHORITY_RESULT_EVENT, payload: result }, window.location.origin);
  };
  if (isTauriRuntime()) {
    const eventApi = await import('@tauri-apps/api/event');
    const unlisten = await eventApi.listen?.(PHYSIC_PAINT_ROTO_AUTHORITY_REQUEST_EVENT, async (event) => emitResult(getPhysicPaintRotoAuthorityFromUnknown(event.payload)));
    if (unlisten) return unlisten;
  }
  if (typeof window === 'undefined') return () => {};
  const message = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || event.data?.type !== PHYSIC_PAINT_ROTO_AUTHORITY_REQUEST_EVENT) return;
    const source = event.source && 'postMessage' in event.source ? event.source as Pick<Window, 'postMessage'> : undefined;
    void emitResult(getPhysicPaintRotoAuthorityFromUnknown(event.data.payload), source);
  };
  window.addEventListener('message', message);
  return () => window.removeEventListener('message', message);
}

export function handlePhysicPaintFrameSyncMessage(value: unknown): boolean {
  if (!isPhysicPaintFrameSyncMessage(value)) return false;
  timelineStore.seek(value.frame);
  timelineStore.ensureFrameVisible(value.frame);
  return true;
}

export function installPhysicPaintFrameSyncListener(target: Window = window): () => void {
  if (!target || typeof target.addEventListener !== 'function') return () => {};
  const listener = (event: MessageEvent) => {
    handlePhysicPaintFrameSyncMessage(event.data);
  };
  target.addEventListener('message', listener);
  return () => target.removeEventListener('message', listener);
}

async function closeNativePhysicPaintWindow(): Promise<void> {
  try {
    const windowApi = await import('@tauri-apps/api/window') as TauriWindowApi;
    const paintWindow = await windowApi.Window?.getByLabel?.(PHYSIC_PAINT_WINDOW_LABEL);
    if (!paintWindow) return;
    if (typeof paintWindow.destroy === 'function') {
      await paintWindow.destroy();
      return;
    }
    await paintWindow.close?.();
  } catch (error) {
    console.warn('[physicPaintBridge] Could not close physics paint window after apply:', error);
  }
}

export async function installPhysicPaintApplyListener(onResult?: (result: PhysicPaintApplyResult) => void): Promise<() => void> {
  const handlePayload = async (payload: unknown, source?: Pick<Window, 'postMessage'> | null) => {
    const result = await applyPreparedPhysicPaintPayload(payload);
    onResult?.(result);
    sendBrowserApplyResult(result, source);
    return result;
  };

  if (isTauriRuntime()) {
    try {
      const eventApi = await import('@tauri-apps/api/event') as TauriEventApi;
      const unlisten = await eventApi.listen?.(PHYSIC_PAINT_APPLY_EVENT, async (event) => {
        const payload = event.payload;
        const result = await applyPreparedPhysicPaintPayload(payload);
        onResult?.(result);
        await eventApi.emit?.(PHYSIC_PAINT_APPLY_RESULT_EVENT, result);
        await eventApi.emitTo?.(PHYSIC_PAINT_WINDOW_LABEL, PHYSIC_PAINT_APPLY_RESULT_EVENT, result);
        sendBrowserApplyResult(result);
        if (result.ok && isPhysicPaintApplyPayload(payload) && shouldCloseNativeWindowAfterApply(payload)) await closeNativePhysicPaintWindow();
      });
      if (unlisten) return unlisten;
    } catch (error) {
      console.warn('[physicPaintBridge] Falling back to browser apply listener:', error);
    }
  }

  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }

  const customEventListener = (event: Event) => {
    const customEvent = event as CustomEvent;
    void handlePayload(customEvent.detail, undefined);
  };
  const messageListener = (event: MessageEvent) => {
    if (event.origin !== window.location?.origin) return;
    const data = event.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return;
    const message = data as { type?: unknown; payload?: unknown };
    if (message.type !== PHYSIC_PAINT_APPLY_EVENT) return;
    const source = event.source && 'postMessage' in event.source ? event.source as Pick<Window, 'postMessage'> : undefined;
    void handlePayload(message.payload, source);
  };
  window.addEventListener(PHYSIC_PAINT_APPLY_EVENT, customEventListener);
  window.addEventListener('message', messageListener);
  return () => {
    window.removeEventListener(PHYSIC_PAINT_APPLY_EVENT, customEventListener);
    window.removeEventListener('message', messageListener);
  };
}

function sendBrowserApplyResult(result: PhysicPaintApplyResult, source?: Pick<Window, 'postMessage'> | null): void {
  if (typeof window === 'undefined') return;
  const message = { type: PHYSIC_PAINT_APPLY_RESULT_EVENT, payload: result };
  const targetOrigin = window.location?.origin ?? '*';
  window.dispatchEvent?.(new CustomEvent(PHYSIC_PAINT_APPLY_RESULT_EVENT, { detail: result }));
  source?.postMessage?.(message, targetOrigin);
  window.opener?.postMessage?.(message, targetOrigin);
}

function resultBase(payload: unknown): Pick<PhysicPaintApplyResult, 'operationId' | 'kind' | 'layerId' | 'startFrame'> {
  const record = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  return {
    operationId: typeof record.operationId === 'string' ? record.operationId : 'unknown-operation',
    kind: record.kind === 'delete-roto-frame' ? 'delete-roto-frame' : record.kind === 'replace-roto-key-frames' ? 'replace-roto-key-frames' : record.kind === 'replace-roto-physical-map' ? 'replace-roto-physical-map' : record.kind === 'update-roto-interpolation-settings' ? 'update-roto-interpolation-settings' : record.kind === 'update-roto-playback-settings' ? 'update-roto-playback-settings' : 'apply-canvas',
    layerId: typeof record.layerId === 'string' ? record.layerId : 'unknown-layer',
    startFrame: typeof record.startFrame === 'number' && Number.isFinite(record.startFrame) ? Math.max(0, Math.trunc(record.startFrame)) : 0,
  };
}

function failureResult(payload: Pick<PhysicPaintApplyResult, 'operationId' | 'kind' | 'layerId' | 'startFrame'>, error: string): PhysicPaintApplyResult {
  return { ...payload, appliedFrameCount: 0, ok: false, error };
}

function successResult(payload: PhysicPaintApplyPayload, appliedFrameCount: number): PhysicPaintApplyResult {
  return {
    operationId: payload.operationId,
    kind: payload.kind,
    layerId: payload.layerId,
    startFrame: payload.startFrame,
    appliedFrameCount,
    ok: true,
  };
}

function getGeneratedRotoRenderOnlyStatus(frame: number): string {
  return GENERATED_ROTO_RENDER_ONLY_STATUS_TEMPLATE.replace('{frame}', String(frame));
}

function getGeneratedRotoDisplayMutationGuard(layerId: string, displayFrame: number): string | null {
  const target = physicPaintStore.getRotoCacheFrames(layerId).find((candidate) => candidate.appFrame === displayFrame);
  if (target?.source !== 'generated-interpolation') return null;
  return getGeneratedRotoRenderOnlyStatus(displayFrame);
}

export function createPhysicPaintLaunchContext(
  layer: Layer,
  frame: number,
  canvas?: PhysicPaintCanvasSize | null,
  fps?: number | null,
  workflowLabel?: string,
): PhysicPaintLaunchContext {
  const layerId = layer.source.type === 'physic-paint' ? layer.source.layerId : layer.id;
  const capacity = physicPaintStore.getRotoPhysicalCapacity(layerId);
  const requestedFrame = Math.max(0, Math.min(capacity - 1, Math.trunc(frame)));
  const storedDocument = physicPaintStore.getRotoPhysicalDocument(layerId);
  const selectedRecord = physicPaintStore.getRotoRealKeyRecordByAppFrame(layerId, requestedFrame);
  const document = parsePhysicPaintRotoPhysicalDocument(storedDocument
    ? {
        ...storedDocument,
        selectedKeyId: selectedRecord?.keyId ?? null,
        cursorAppFrame: requestedFrame,
      }
    : {
        capacity,
        realKeyRecords: [],
        interpolation: PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED,
        scriptMotion: PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO,
        background: physicPaintStore.getRotoBackgroundMetadata(layerId),
        selectedKeyId: null,
        cursorAppFrame: requestedFrame,
        revision: buildPhysicPaintRotoPhysicalRevision([], PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED),
      });
  if (storedDocument) physicPaintStore.setRotoPhysicalSelection(layerId, document.selectedKeyId, document.cursorAppFrame);
  const playbackSettings = physicPaintStore.getRotoPlaybackSettings(layerId) ?? {
    loop: false,
    fps: Math.max(1, Math.min(60, isFinitePositiveNumber(fps) ? fps : 12)),
  };
  const context: PhysicPaintLaunchContext = {
    operationId: `physic-paint-${Date.now()}-${crypto.randomUUID()}`,
    layerId,
    project: { name: projectStore.name.peek(), saved: Boolean(projectStore.filePath.peek() && projectStore.scriptLibraryAuthority.peek()), contextId: projectStore.projectContextId.peek() },
    layerName: layer.name,
    ...(workflowLabel ? { workflowLabel } : {}),
    startFrame: document.cursorAppFrame,
    ...(isFinitePositiveNumber(canvas?.width) ? { width: canvas.width } : {}),
    ...(isFinitePositiveNumber(canvas?.height) ? { height: canvas.height } : {}),
    ...(isFinitePositiveNumber(fps) ? { fps } : {}),
    rotoPlayback: playbackSettings,
    rotoPhysical: {
      capacity: document.capacity,
      records: document.realKeyRecords.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame, payload: record.payload })),
      interpolationEnabled: document.interpolation.enabled,
      interpolationMode: document.interpolation.mode,
      scriptMotion: document.scriptMotion,
      background: document.background,
      selectedKeyId: document.selectedKeyId,
      cursorAppFrame: document.cursorAppFrame,
      revision: document.revision,
    },
  };
  const validated = parseCanonicalPhysicsPaintLaunchValue(context);
  if (!validated) throw new Error('Could not construct a canonical physical launch context.');
  return validated;
}

export async function openPhysicPaintCanvas(request: PhysicPaintOpenRequest): Promise<Result<PhysicPaintLaunchContext>> {
  try {
    const validation = validateOpenRequest(request);
    if (!validation.ok) return validation;

    const context = createPhysicPaintLaunchContext(
      validation.data.layer,
      validation.data.frame,
      request.canvas,
      request.fps,
      validation.data.workflowLabel,
    );
    if (!parseCanonicalPhysicsPaintLaunchValue(context)) {
      return { ok: false, error: 'Invalid canonical physical launch context' };
    }

    const tauriRuntime = await detectTauriRuntime();
    console.info('[physicPaintBridge] launch branch', tauriRuntime ? 'tauri-native-command' : 'browser-fallback', context);
    if (tauriRuntime) {
      const tauriResult = await tryOpenTauriPhysicPaintWindow(context);
      if (!tauriResult.ok) return tauriResult;
      activeLaunchOperationByLayer.set(context.layerId, context.operationId);
      console.info('[physicPaintBridge] native launch result', tauriResult.data);
      return { ok: true, data: context };
    }

    const browserResult = openBrowserFallback(context);
    if (!browserResult.ok) return browserResult;
    activeLaunchOperationByLayer.set(context.layerId, context.operationId);

    return { ok: true, data: context };
  } catch (error) {
    return { ok: false, error: `Could not open physics paint canvas: ${String(error)}` };
  }
}

function validateOpenRequest(request: PhysicPaintOpenRequest): Result<{ layer: Layer; frame: number; workflowLabel?: string }> {
  const layer = request.layer;
  if (!layer || layer.type !== 'physic-paint' || layer.source.type !== 'physic-paint') {
    return { ok: false, error: 'Select a physic-paint layer before opening the physics paint canvas' };
  }

  const frame = request.frame;
  if (typeof frame !== 'number' || !Number.isFinite(frame) || frame < 0) {
    return { ok: false, error: 'Select a valid frame before opening the physics paint canvas' };
  }

  const workflowLabel = request.workflowLabel;
  if (workflowLabel !== undefined && (typeof workflowLabel !== 'string' || workflowLabel.trim().length === 0)) {
    return { ok: false, error: 'Physics paint workflow label must be a non-empty string' };
  }

  return {
    ok: true,
    data: {
      layer,
      frame: Math.trunc(frame),
      ...(workflowLabel !== undefined ? { workflowLabel: workflowLabel.trim() } : {}),
    },
  };
}

async function tryOpenTauriPhysicPaintWindow(context: PhysicPaintLaunchContext): Promise<Result<TauriPhysicsPaintLaunchResult>> {
  try {
    const core = await import('@tauri-apps/api/core') as TauriCoreApi;
    if (!core.invoke) return { ok: false, error: 'Tauri invoke API unavailable' };
    const result = await core.invoke<TauriPhysicsPaintLaunchResult>('open_physics_paint_window', { context });
    if (!isTauriPhysicsPaintLaunchResult(result)) {
      return { ok: false, error: `Physics paint native command returned an invalid result: ${JSON.stringify(result)}` };
    }
    if (!result.visible || result.minimized) {
      return { ok: false, error: `Physics paint window did not become visible (visible=${result.visible}, minimized=${result.minimized})` };
    }
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

function isTauriPhysicsPaintLaunchResult(value: unknown): value is TauriPhysicsPaintLaunchResult {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof (value as TauriPhysicsPaintLaunchResult).label === 'string' &&
      typeof (value as TauriPhysicsPaintLaunchResult).visibleBefore === 'boolean' &&
      typeof (value as TauriPhysicsPaintLaunchResult).minimizedBefore === 'boolean' &&
      typeof (value as TauriPhysicsPaintLaunchResult).visible === 'boolean' &&
      typeof (value as TauriPhysicsPaintLaunchResult).minimized === 'boolean',
  );
}

function getTimelineRangeFrameCount(layer: Layer, frame: number): number | null {
  const sequence = sequenceStore.sequences.peek().find((candidate) => candidate.layers.some((candidateLayer) => candidateLayer.id === layer.id));
  if (!sequence) return null;
  const rangeStart = Number.isInteger(sequence.inFrame) && sequence.inFrame !== undefined ? sequence.inFrame : 0;
  const rangeEnd = Number.isInteger(sequence.outFrame) && sequence.outFrame !== undefined
    ? sequence.outFrame
    : sequence.kind === 'content'
      ? sequence.keyPhotos.reduce((total, photo) => total + Math.max(0, photo.holdFrames), 0)
      : null;
  if (rangeEnd === null) return null;
  const remaining = rangeEnd - Math.max(frame, rangeStart);
  return remaining > 0 ? remaining : null;
}

function openBrowserFallback(context: PhysicPaintLaunchContext): Result<null> {
  if (typeof window === 'undefined' || typeof window.open !== 'function') {
    return { ok: false, error: 'No browser window API is available for physics paint canvas' };
  }

  const opened = window.open(buildPhysicsPaintUrl(context), PHYSIC_PAINT_WINDOW_LABEL, 'width=1280,height=900');
  if (!opened) {
    return { ok: false, error: 'Physics paint window was blocked or could not be opened' };
  }

  opened.focus?.();
  return { ok: true, data: null };
}

function buildPhysicsPaintUrl(context: PhysicPaintLaunchContext): string {
  const baseUrl = typeof window !== 'undefined' && window.location?.origin
    ? new URL(PHYSIC_PAINT_FALLBACK_PATH, window.location.origin)
    : new URL(PHYSIC_PAINT_FALLBACK_PATH, 'http://localhost');
  baseUrl.searchParams.set('context', JSON.stringify(context));
  return `${baseUrl.pathname}${baseUrl.search}`;
}

async function detectTauriRuntime(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const core = await import('@tauri-apps/api/core') as TauriCoreApi;
    if (core.isTauri?.()) return true;
  } catch {
    // Fall back to injected globals below.
  }
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window || 'isTauri' in window;
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined'
    && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window || 'isTauri' in window);
}

function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
