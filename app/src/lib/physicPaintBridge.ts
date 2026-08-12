import type { Result } from './ipc';
import { effect, signal } from '@preact/signals';
import type { Layer } from '../types/layer';
import type { EfxPaintAudioPreviewContext, PhysicPaintActionRetainedArtifactReference, PhysicPaintActionTransactionRecord, PhysicPaintApplyPayload, PhysicPaintApplyResult, PhysicPaintLaunchContext, PhysicPaintRotoAuthorityRequest, PhysicPaintRotoAuthorityResult, PhysicPaintRotoInterpolationSettings, PhysicPaintRotoPhysicalEditApplyResult, PhysicPaintRotoPhysicalEditIntent, PhysicPaintRotoPhysicalEditRecord, PhysicPaintRotoPhysicalEditSemanticDelta, PhysicPaintRotoPhysicalEditOperationKind, PhysicPaintScriptLibraryResult, PhysicPaintStateSaveRequest, PhysicPaintStateSaveResult, PhysicPaintThumbnailEncodeResult } from '../types/physicPaint';
import { PHYSIC_PAINT_MAX_APPLY_FRAMES, isPhysicPaintApplyPayload, isPhysicPaintFrameSyncMessage, isPhysicPaintRotoAuthorityRequest, isPhysicPaintRotoPhysicalEditApplyPayload, isPhysicPaintScriptLibraryRequest, isPhysicPaintThumbnailEncodeRequest, isPhysicPaintThumbnailEncodeResult, serializePhysicPaintRotoPhysicalEditIntent } from '../types/physicPaint';
import { GENERATED_ROTO_RENDER_ONLY_STATUS_TEMPLATE } from '../components/physic-paint/roto/physicsPaintRotoKeyController';
import { resolvePhysicPaintRotoPhysicalEdit, validatePhysicPaintRotoPhysicalEditSemanticDelta } from '../components/physic-paint/roto/physicsPaintRotoPhysicalResolver';
import { isRotoPngDataUrl, prepareRotoPhysicalRealKeyPngs } from '../components/physic-paint/roto/rotoCanvasFrames';
import {
  PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED,
  PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO,
  buildPhysicPaintRotoPhysicalRevision,
  buildPhysicPaintRotoProjectEquality,
  encodePhysicPaintRotoPhysicalContent,
  parsePhysicPaintRotoIncomingInterpolationBreakKeyIds,
  parsePhysicPaintRotoLoopClips,
  parsePhysicPaintRotoPhysicalDocument,
  parsePhysicPaintRotoRealKeyRecordCollection,
  type PhysicPaintRotoInterpolationState,
  type PhysicPaintRotoLoopClip,
  type PhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoRealKeyPayload,
  type PhysicPaintRotoRealKeyRecord,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import {
  classifyPhysicPaintRotoGroupFrameTarget,
  proposePhysicPaintRotoActionGroupLifecycle,
  proposePhysicPaintRotoDeleteGroup,
  proposePhysicPaintRotoDeleteGroupFrame,
  proposePhysicPaintRotoGroupFramePaint,
  proposePhysicPaintRotoRegenerateGroup,
  type PhysicPaintRotoActionGroupLifecycleImpact,
  type PhysicPaintRotoGroupFramePaintImpact,
} from '../components/physic-paint/roto/physicsPaintRotoGroupLifecycle';
import { parseCanonicalPhysicsPaintLaunchValue } from '../components/physic-paint/bridge/physicsPaintLaunchContext';
import { layerStore } from '../stores/layerStore';
import { audioStore } from '../stores/audioStore';
import {
  physicPaintStore,
  type PhysicPaintRotoPhysicalOperationLeaseToken,
} from '../stores/physicPaintStore';
import { sequenceStore } from '../stores/sequenceStore';
import { timelineStore } from '../stores/timelineStore';
import { projectStore } from '../stores/projectStore';
import { assetUrl, scriptLibraryDelete, scriptLibraryEncodeThumbnailWebp, scriptLibraryLoad, scriptLibraryRename, scriptLibrarySave, scriptLibraryScan } from './ipc';

export const PHYSIC_PAINT_LAUNCH_EVENT = 'physic-paint:launch';
export const PHYSIC_PAINT_PROJECT_CONTEXT_EVENT = 'physic-paint:project-context';
export const PHYSIC_PAINT_AUDIO_CONTEXT_EVENT = 'physic-paint:audio-context';
/**
 * 41-04 (D-05..D-07): main→child playback-state broadcast ({playing}) and
 * child→main ownership claim/release ({claim}). Transient session state on
 * lightweight events — never forced through the revision counter (locked A5).
 */
export const PHYSIC_PAINT_AUDIO_PLAYBACK_STATE_EVENT = 'physic-paint:audio-playback-state';
export const PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT = 'physic-paint:audio-ownership';
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

export const PHYSIC_PAINT_WINDOW_LABEL = 'efx-physic-paint';
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
    getByLabel?: (label: string) => Promise<{
      close?: () => Promise<void>;
      destroy?: () => Promise<void>;
      isMinimized?: () => Promise<boolean>;
      unminimize?: () => Promise<void>;
      show?: () => Promise<void>;
      setFocus?: () => Promise<void>;
    } | null>;
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
interface AcceptedPhysicalCommandSnapshot {
  readonly records: readonly PhysicPaintRotoRealKeyRecord[];
  readonly groupOverrideRecords: readonly PhysicPaintRotoRealKeyRecord[];
  readonly interpolation: PhysicPaintRotoInterpolationState;
  readonly loopClips: readonly PhysicPaintRotoLoopClip[];
  readonly incomingInterpolationBreakKeyIds: readonly string[];
  readonly selectedKeyId: string | null;
  readonly selectedAppFrame: number | null;
  readonly cursorAppFrame: number;
  readonly capacity: number;
  readonly revision: string;
}

interface AcceptedPhysicalCommandEntry {
  readonly operationId: string;
  readonly projectContextId: string;
  readonly layerId: string;
  readonly launchOperationId: string;
  readonly capacity: number;
  readonly before: AcceptedPhysicalCommandSnapshot;
  readonly after: AcceptedPhysicalCommandSnapshot;
}
const acceptedPhysicalCommands = new Map<string, AcceptedPhysicalCommandEntry>();

export type PhysicPaintRotoGroupFramePaintApplyFailureReason =
  | 'stale'
  | 'malformed'
  | 'changed-payload'
  | 'missing-token'
  | 'mismatched-token'
  | 'replayed-token'
  | 'unresolved-precedence'
  | 'cleanup-reference-mismatch';

export interface PhysicPaintRotoGroupFramePaintApplyRequest {
  readonly operationId: string;
  readonly projectContextId: string;
  readonly layerId: string;
  readonly launchOperationId: string;
  readonly expectedRevision: string;
  readonly expectedProjectEquality: string;
  readonly groupId: string;
  readonly appFrame: number;
  readonly overrideKeyId: string;
  readonly renderedPayload: PhysicPaintRotoRealKeyPayload;
  readonly unresolvedPrecedence?: boolean;
  readonly claimedCleanupKeyIds?: readonly string[];
  readonly proposal: PhysicPaintRotoPhysicalDocument;
  readonly impact: PhysicPaintRotoGroupFramePaintImpact;
  readonly leaseToken?: PhysicPaintRotoPhysicalOperationLeaseToken;
}

export type PhysicPaintRotoGroupFramePaintApplyResult =
  | Readonly<{
      ok: true;
      acceptedDocument: PhysicPaintRotoPhysicalDocument;
      historyCommandId: string;
    }>
  | Readonly<{
      ok: false;
      reason: PhysicPaintRotoGroupFramePaintApplyFailureReason;
    }>;

const deliveredGroupFramePaintOperations = new Map<string, Readonly<{
  fingerprint: string;
  result: Extract<PhysicPaintRotoGroupFramePaintApplyResult, { ok: true }>;
}>>();

function activatePhysicalLaunchAuthority(context: PhysicPaintLaunchContext): void {
  const projectContextId = context.project?.contextId ?? projectStore.projectContextId.peek();
  const capacity = context.rotoPhysical?.capacity
    ?? physicPaintStore.getRotoPhysicalCapacity(context.layerId);
  for (const [operationId, entry] of acceptedPhysicalCommands) {
    if (entry.projectContextId !== projectContextId
      || (entry.layerId === context.layerId
        && (entry.launchOperationId !== context.operationId || entry.capacity !== capacity))) {
      acceptedPhysicalCommands.delete(operationId);
    }
  }
  activeLaunchOperationByLayer.set(context.layerId, context.operationId);
}

function cloneAndDeepFreezePlainData<T>(value: T): T {
  const clone = structuredClone(value);
  const freeze = (candidate: unknown): void => {
    if (candidate === null || typeof candidate !== 'object' || Object.isFrozen(candidate)) return;
    for (const nested of Object.values(candidate as Record<string, unknown>)) freeze(nested);
    Object.freeze(candidate);
  };
  freeze(clone);
  return clone;
}

function createAcceptedPhysicalCommandSnapshot(input: {
  readonly records: readonly PhysicPaintRotoRealKeyRecord[];
  readonly groupOverrideRecords: readonly PhysicPaintRotoRealKeyRecord[];
  readonly interpolation: PhysicPaintRotoInterpolationState;
  readonly loopClips: readonly PhysicPaintRotoLoopClip[];
  readonly incomingInterpolationBreakKeyIds: readonly string[];
  readonly selectedKeyId: string | null;
  readonly cursorAppFrame: number;
  readonly capacity: number;
  readonly revision: string;
}): AcceptedPhysicalCommandSnapshot {
  const selectedRecord = input.selectedKeyId === null
    ? null
    : input.records.find((record) => record.keyId === input.selectedKeyId) ?? null;
  return cloneAndDeepFreezePlainData({
    records: input.records,
    groupOverrideRecords: input.groupOverrideRecords,
    interpolation: input.interpolation,
    loopClips: input.loopClips,
    incomingInterpolationBreakKeyIds: input.incomingInterpolationBreakKeyIds,
    selectedKeyId: selectedRecord?.keyId ?? null,
    selectedAppFrame: selectedRecord?.appFrame ?? null,
    cursorAppFrame: input.cursorAppFrame,
    capacity: input.capacity,
    revision: input.revision,
  });
}

function sameAcceptedPhysicalCommandSnapshot(
  left: AcceptedPhysicalCommandSnapshot,
  right: AcceptedPhysicalCommandSnapshot,
): boolean {
  return stableSerialize(left, new WeakSet<object>()) === stableSerialize(right, new WeakSet<object>());
}

export function applyPhysicPaintPayload(payload: unknown): PhysicPaintApplyResult {
  return applyPhysicPaintPayloadWithPublicationLease(payload);
}

function applyPhysicPaintPayloadWithPublicationLease(
  payload: unknown,
  publicationLeaseToken?: PhysicPaintRotoPhysicalOperationLeaseToken,
): PhysicPaintApplyResult {
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
      result = applyPhysicPaintRotoPhysicalMap(payload, publicationLeaseToken);
    } else {
      result = applyFailureResult(payload, 'Unsupported physics paint payload');
    }
    if (result.ok) deliveredOperations.set(payload.operationId, { fingerprint, result });
    return result.ok ? result : { ...result, error: `${APPLY_ERROR} ${result.error ?? ''}`.trim() };
  } catch (error) {
    return applyFailureResult(payload, `${APPLY_ERROR} ${String(error)}`);
  }
}

async function applyPreparedPhysicPaintPayload(
  payload: unknown,
  publicationLeaseToken?: PhysicPaintRotoPhysicalOperationLeaseToken,
): Promise<PhysicPaintApplyResult> {
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
  const result = applyPhysicPaintPayloadWithPublicationLease(
    payload,
    publicationLeaseToken,
  );
  if (!result.ok) physicPaintStore.pruneUnreferencedRotoAlphaCanvases(preparedDataUrls);
  return result;
}

async function applyTransportedPhysicPaintPayload(
  payload: unknown,
): Promise<PhysicPaintApplyResult> {
  if (!isPhysicPaintRotoPhysicalEditApplyPayload(payload)) {
    return applyPreparedPhysicPaintPayload(payload);
  }

  const submittedLeaseToken = payload.leaseToken!;
  if (
    payload.projectContextId !== projectStore.projectContextId.peek()
    || submittedLeaseToken.projectContextId !== payload.projectContextId
    || submittedLeaseToken.layerId !== payload.layerId
  ) {
    return applyPreparedPhysicPaintPayload(payload);
  }

  const publicationLeaseToken =
    physicPaintStore.acquireRotoPhysicalOperationLease(
      payload.projectContextId,
      payload.layerId,
    )
    ?? submittedLeaseToken;

  try {
    return await applyPreparedPhysicPaintPayload(
      payload,
      publicationLeaseToken,
    );
  } finally {
    physicPaintStore.releaseRotoPhysicalOperationLease(
      publicationLeaseToken,
    );
  }
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
  const groupOverrideRecords = physicPaintStore.getRotoGroupOverrideRecords(request.layerId);
  const interpolation = physicPaintStore.getRotoPhysicalInterpolationState(request.layerId);
  const physicalRevision = buildPhysicPaintRotoPhysicalRevision(
    records,
    interpolation,
    physicPaintStore.getRotoPhysicalLoopClips(request.layerId),
    physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(request.layerId),
    groupOverrideRecords,
  );
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
    const canonicalGroupOverrideRecords = (payload.groupOverrideRecords ?? []).map((record) => ({
      kind: 'real-key' as const,
      keyId: record.keyId,
      appFrame: record.appFrame,
      payload: record.payload,
    }));
    const content = encodePhysicPaintRotoPhysicalContent(canonicalRecords, {
      enabled: payload.interpolationEnabled,
      mode: payload.interpolationMode,
    }, payload.loopClips ?? [], payload.incomingInterpolationBreakKeyIds ?? [], canonicalGroupOverrideRecords);
    const groupOverridesPresence = payload.groupOverrideRecords === undefined ? 'omitted' : 'present';
    const incomingBreaksPresence = payload.incomingInterpolationBreakKeyIds === undefined ? 'omitted' : 'present';
    const provenance = payload.historyProvenance
      ? `${payload.historyProvenance.historyCommandId}:${payload.historyProvenance.historyDirection}:${payload.historyProvenance.sourceRevision}:${payload.historyProvenance.targetRevision}`
      : 'ordinary';
    const intent = 'intent' in payload && payload.intent !== undefined
      ? serializePhysicPaintRotoPhysicalEditIntent(payload.intent)
      : 'specialized';
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
      groupOverridesPresence,
      incomingBreaksPresence,
      payload.selectedKeyId ?? '',
      payload.selectedAppFrame === null ? 'null' : String(payload.selectedAppFrame),
      String(payload.cursorAppFrame),
      payload.semanticDelta ? stableSerialize(payload.semanticDelta, new WeakSet<object>()) : 'mapping-only',
      intent,
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

function buildCanonicalMappedRecords(
  currentRecords: readonly PhysicPaintRotoRealKeyRecord[],
  mapping: ReadonlyMap<string, number>,
  orderedKeyIds: readonly string[],
): readonly PhysicPaintRotoRealKeyRecord[] | null {
  const currentByKeyId = new Map(currentRecords.map((record) => [record.keyId, record]));
  const records: PhysicPaintRotoRealKeyRecord[] = [];
  for (const keyId of orderedKeyIds) {
    const current = currentByKeyId.get(keyId);
    const appFrame = mapping.get(keyId);
    if (!current || appFrame === undefined) return null;
    records.push({
      ...current,
      appFrame,
      payload: { ...current.payload, appFrame },
    });
  }
  return records;
}

function validateCanonicalOrdinaryPhysicalEdit(input: {
  readonly intent: PhysicPaintRotoPhysicalEditIntent;
  readonly currentRecords: readonly PhysicPaintRotoRealKeyRecord[];
  readonly proposedRecords: readonly PhysicPaintRotoRealKeyRecord[];
  readonly currentGroupOverrideRecords: readonly PhysicPaintRotoRealKeyRecord[];
  readonly proposedGroupOverrideRecords: readonly PhysicPaintRotoRealKeyRecord[];
  readonly currentInterpolation: PhysicPaintRotoInterpolationState;
  readonly proposedInterpolation: PhysicPaintRotoInterpolationState;
  readonly currentLoopClips: readonly PhysicPaintRotoLoopClip[];
  readonly proposedLoopClips: readonly PhysicPaintRotoLoopClip[];
  readonly currentIncomingInterpolationBreakKeyIds: readonly string[];
  readonly proposedIncomingInterpolationBreakKeyIds: readonly string[];
  readonly selectedKeyId: string | null;
  readonly selectedAppFrame: number | null;
  readonly capacity: number;
  readonly stagedRevision: string;
}): string | null {
  const canonicalResolution = resolvePhysicPaintRotoPhysicalEdit({
    identities: input.currentRecords.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
    records: input.currentRecords,
    intent: input.intent,
    capacity: input.capacity,
    interpolationEnabled: input.currentInterpolation.enabled,
    loopClips: input.currentLoopClips,
    incomingInterpolationBreakKeyIds: input.currentIncomingInterpolationBreakKeyIds,
  });
  if (!canonicalResolution.ok) {
    return `Canonical physical edit rejected the submitted intent: ${canonicalResolution.failure.text}`;
  }

  const proposal = canonicalResolution.proposal;
  const canonicalRecords = proposal.nextRecords
    ?? buildCanonicalMappedRecords(input.currentRecords, proposal.mapping, proposal.orderedKeyIds);
  if (canonicalRecords === null) {
    return 'Submitted physical document does not match the canonical parent-resolved edit.';
  }
  const canonicalLoopClips = proposal.nextLoopClips ?? input.currentLoopClips;
  const canonicalIncomingInterpolationBreakKeyIds = proposal.nextIncomingInterpolationBreakKeyIds
    ?? input.currentIncomingInterpolationBreakKeyIds;
  const canonicalRevision = buildPhysicPaintRotoPhysicalRevision(
    canonicalRecords,
    input.currentInterpolation,
    canonicalLoopClips,
    canonicalIncomingInterpolationBreakKeyIds,
    input.currentGroupOverrideRecords,
  );
  if (!sameCompletePhysicalRecords(canonicalRecords, input.proposedRecords)
    || !sameCompletePhysicalRecords(input.currentGroupOverrideRecords, input.proposedGroupOverrideRecords)
    || stableSerialize(canonicalLoopClips, new WeakSet<object>()) !== stableSerialize(input.proposedLoopClips, new WeakSet<object>())
    || canonicalIncomingInterpolationBreakKeyIds.length !== input.proposedIncomingInterpolationBreakKeyIds.length
    || canonicalIncomingInterpolationBreakKeyIds.some((keyId, index) => keyId !== input.proposedIncomingInterpolationBreakKeyIds[index])
    || proposal.selectedKeyId !== input.selectedKeyId
    || proposal.selectedAppFrame !== input.selectedAppFrame
    || input.currentInterpolation.enabled !== input.proposedInterpolation.enabled
    || input.currentInterpolation.mode !== input.proposedInterpolation.mode
    || canonicalRevision !== input.stagedRevision) {
    return 'Submitted physical document does not match the canonical parent-resolved edit.';
  }
  return null;
}

function isCanonicalBlankRotoPayload(
  payload: import('../components/physic-paint/roto/physicsPaintRotoPhysicalModel').PhysicPaintRotoRealKeyPayload,
  destinationAppFrame: number,
): boolean {
  if (payload.frameIndex !== 0
    || payload.appFrame !== destinationAppFrame
    || !Number.isInteger(payload.width)
    || !Number.isInteger(payload.height)
    || (payload.width ?? 0) <= 0
    || (payload.height ?? 0) <= 0
    || typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = payload.width as number;
    canvas.height = payload.height as number;
    return payload.dataUrl === canvas.toDataURL('image/png');
  } catch {
    return false;
  }
}

function validateInsertEmptySegmentPhysicalDelta(input: {
  readonly payload: Extract<PhysicPaintApplyPayload, { kind: 'replace-roto-physical-map' }>;
  readonly currentRecords: readonly import('../components/physic-paint/roto/physicsPaintRotoPhysicalModel').PhysicPaintRotoRealKeyRecord[];
  readonly proposedRecords: readonly import('../components/physic-paint/roto/physicsPaintRotoPhysicalModel').PhysicPaintRotoRealKeyRecord[];
  readonly currentLoopClips: readonly PhysicPaintRotoLoopClip[];
  readonly proposedLoopClips: readonly PhysicPaintRotoLoopClip[];
  readonly currentIncomingInterpolationBreakKeyIds: readonly string[];
  readonly proposedIncomingInterpolationBreakKeyIds: readonly string[];
  readonly capacity: number;
}): string | null {
  const {
    payload,
    currentRecords,
    proposedRecords,
    currentLoopClips,
    proposedLoopClips,
    currentIncomingInterpolationBreakKeyIds,
    proposedIncomingInterpolationBreakKeyIds,
    capacity,
  } = input;
  const semanticValidation = validatePhysicPaintRotoPhysicalEditSemanticDelta({
    operationKind: 'insert-empty-segment',
    currentRecords,
    nextRecords: proposedRecords,
    semanticDelta: payload.semanticDelta,
    capacity,
    selectedKeyId: payload.selectedKeyId,
    selectedAppFrame: payload.selectedAppFrame,
  });
  if (!semanticValidation.ok) return semanticValidation.error;
  const delta = payload.semanticDelta as Extract<NonNullable<typeof payload.semanticDelta>, { kind: 'insert-empty-segment' }>;
  const inserted = proposedRecords.find((record) => record.keyId === delta.insertedKeyId);
  if (!inserted || !isCanonicalBlankRotoPayload(inserted.payload, delta.destinationAppFrame)) {
    return 'Empty-segment insert must carry the canonical blank Paint payload.';
  }
  if (stableSerialize(proposedLoopClips, new WeakSet<object>())
    !== stableSerialize(currentLoopClips, new WeakSet<object>())) {
    return 'Empty-segment insert must preserve Loop Clips exactly.';
  }
  const expectedBreaks = [...currentIncomingInterpolationBreakKeyIds, delta.insertedKeyId];
  if (proposedIncomingInterpolationBreakKeyIds.length !== expectedBreaks.length
    || proposedIncomingInterpolationBreakKeyIds.some((keyId, index) => keyId !== expectedBreaks[index])) {
    return 'Empty-segment insert must add exactly its fresh identity to incoming interpolation breaks.';
  }
  const projectedTarget = physicPaintStore.getRotoCacheFrames(payload.layerId)
    .find((frame) => frame.appFrame === delta.destinationAppFrame);
  if (projectedTarget && projectedTarget.source !== 'real-key') {
    return 'Empty-segment destination became generated or linked before commit.';
  }
  return null;
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
  // 43-06: a loop-only declaration (empty affected range, loopClips required)
  // changes loop state only; a preserveSelection declaration keeps the current
  // selection (source-edit/repair open from a Loop Clip, not a selection).
  const loopOnly = delta.loopOnly === true;
  const preserveSelection = loopOnly || delta.preserveSelection === true;
  const remainingCapacity = getTimelineRangeFrameCount(layer, delta.affectedStartAppFrame);
  const expectedLayerEndExclusive = remainingCapacity === null
    ? null
    : delta.affectedStartAppFrame + Math.min(remainingCapacity, capacity - delta.affectedStartAppFrame, PHYSIC_PAINT_MAX_APPLY_FRAMES);
  if (payload.historyProvenance !== undefined
    || payload.interpolationEnabled !== currentInterpolation.enabled
    || payload.interpolationMode !== currentInterpolation.mode
    || (!preserveSelection && payload.startFrame !== delta.affectedStartAppFrame)
    || delta.expectedLayerCapacity !== capacity
    || expectedLayerEndExclusive === null
    || delta.expectedLayerEndExclusive !== expectedLayerEndExclusive
    || (!loopOnly && delta.affectedEndAppFrame < delta.affectedStartAppFrame)
    || (loopOnly && delta.affectedEndAppFrame !== delta.affectedStartAppFrame - 1)
    || (!loopOnly && delta.affectedEndAppFrame >= delta.expectedLayerEndExclusive)) return 'Play Script range, capacity, interpolation, or history metadata is invalid.';
  if (loopOnly && payload.loopClips === undefined) return 'Loop-only Play Script edit must carry the staged Loop Clip collection.';

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
  if (!preserveSelection) {
    const selected = proposedByFrame.get(delta.affectedStartAppFrame);
    if (!selected
      || payload.selectedKeyId !== selected.keyId
      || payload.selectedAppFrame !== delta.affectedStartAppFrame) return 'Play Script selection does not match the accepted start destination.';
  }
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
    readonly cursorAppFrame?: number;
    readonly error?: string;
  },
): PhysicPaintRotoPhysicalEditApplyResult {
  let stagedRevision = options.stagedRevision;
  if (!stagedRevision) {
    try {
      const records = payload.records.map((record) => ({ kind: 'real-key' as const, ...record }));
      const groupOverrideRecords = payload.groupOverrideRecords === undefined
        ? physicPaintStore.getRotoGroupOverrideRecords(payload.layerId)
        : payload.groupOverrideRecords.map((record) => ({ kind: 'real-key' as const, ...record }));
      stagedRevision = buildPhysicPaintRotoPhysicalRevision(records, {
        enabled: payload.interpolationEnabled,
        mode: payload.interpolationMode,
      }, payload.loopClips ?? physicPaintStore.getRotoPhysicalLoopClips(payload.layerId),
      payload.incomingInterpolationBreakKeyIds
        ?? physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(payload.layerId),
      groupOverrideRecords);
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
    cursorAppFrame: options.cursorAppFrame ?? payload.cursorAppFrame,
    appliedFrameCount: options.ok ? payload.records.length : 0,
    ok: options.ok,
    ...(options.error !== undefined ? { error: options.error } : {}),
    ...(payload.semanticDelta ? { semanticDelta: payload.semanticDelta } : {}),
    ...(payload.historyProvenance ? { historyProvenance: payload.historyProvenance } : {}),
    ...(payload.loopClips !== undefined ? { loopClips: payload.loopClips } : {}),
    ...(payload.incomingInterpolationBreakKeyIds !== undefined
      ? { incomingInterpolationBreakKeyIds: payload.incomingInterpolationBreakKeyIds }
      : {}),
  };
}

function applyFailureResult(payload: PhysicPaintApplyPayload, error: string): PhysicPaintApplyResult {
  return payload.kind === 'replace-roto-physical-map'
    ? physicalEditResult(payload, { ok: false, error })
    : failureResult(payload, error);
}

const GROUP_LIFECYCLE_OPERATION_KINDS = new Set<PhysicPaintRotoPhysicalEditOperationKind>([
  'paint-group-frame',
  'delete-group-frame',
  'delete-group',
  'regenerate-group',
  'detach-action-groups',
  'delete-action-groups',
]);

function sameOrderedKeyIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((keyId, index) => keyId === right[index]);
}

function isCompleteRegenerateGroup(group: PhysicPaintRotoLoopClip): boolean {
  return group.syncState !== undefined
    && group.provenanceState !== undefined
    && group.phaseOrigin !== undefined
    && group.originalEndExclusive !== undefined
    && group.visibleRanges !== undefined
    && group.frameOverrides !== undefined;
}

function recomputeCanonicalGroupRegenerate(input: {
  readonly currentDocument: PhysicPaintRotoPhysicalDocument;
  readonly targetDocument: PhysicPaintRotoPhysicalDocument;
  readonly proposedRecords: readonly PhysicPaintRotoRealKeyRecord[];
  readonly proposedGroupOverrideRecords: readonly PhysicPaintRotoRealKeyRecord[];
  readonly delta: Extract<PhysicPaintRotoPhysicalEditSemanticDelta, { readonly kind: 'regenerate-group' }>;
}): {
  readonly proposal: PhysicPaintRotoPhysicalDocument;
  readonly impact: Extract<PhysicPaintRotoPhysicalEditSemanticDelta, { readonly kind: 'regenerate-group' }>;
} | string {
  const { currentDocument, targetDocument, proposedRecords, proposedGroupOverrideRecords, delta } = input;
  const initiatingGroup = currentDocument.loopClips.find((group) => group.loopId === delta.groupId);
  if (!initiatingGroup || !isCompleteRegenerateGroup(initiatingGroup)) {
    return 'Group Regenerate initiating Group is unavailable.';
  }
  if (initiatingGroup.provenanceState !== 'attached' || !initiatingGroup.scriptId) {
    return 'Group Regenerate initiating Group is detached from its Action.';
  }
  const sourceKeyIds = initiatingGroup.sourceKeyIds;
  const sourceKeyIdSet = new Set(sourceKeyIds);
  const affectedGroups: PhysicPaintRotoLoopClip[] = [];
  for (const group of currentDocument.loopClips) {
    const overlapsSource = group.sourceKeyIds.some((keyId) => sourceKeyIdSet.has(keyId));
    if (!overlapsSource) continue;
    if (!sameOrderedKeyIds(group.sourceKeyIds, sourceKeyIds)
      || !isCompleteRegenerateGroup(group)
      || group.scriptId !== initiatingGroup.scriptId
      || group.provenanceState !== 'attached') {
      return 'Group Regenerate source sharing is ambiguous.';
    }
    affectedGroups.push(group);
  }
  affectedGroups.sort((left, right) => left.phaseOrigin! - right.phaseOrigin! || left.loopId.localeCompare(right.loopId));
  if (!affectedGroups.some((group) => group.loopId === delta.groupId)) {
    return 'Group Regenerate initiating Group is not in the canonical shared set.';
  }

  const currentByKeyId = new Map(currentDocument.realKeyRecords.map((record) => [record.keyId, record]));
  const proposedByKeyId = new Map(proposedRecords.map((record) => [record.keyId, record]));
  for (const sourceKeyId of sourceKeyIds) {
    const current = currentByKeyId.get(sourceKeyId);
    const proposed = proposedByKeyId.get(sourceKeyId);
    if (!current || !proposed || proposed.appFrame !== current.appFrame || !isRotoPngDataUrl(proposed.payload.dataUrl)) {
      return 'Group Regenerate changed source identity or timing.';
    }
  }

  const affectedGroupIds = new Set(affectedGroups.map((group) => group.loopId));
  const candidateCleanupIds = new Set(affectedGroups.flatMap((group) => group.frameOverrides!.map((override) => override.keyId)));
  const remainingReferences = new Set(currentDocument.loopClips.flatMap((group) => [
    ...group.sourceKeyIds,
    ...(affectedGroupIds.has(group.loopId) ? [] : group.frameOverrides?.map((override) => override.keyId) ?? []),
  ]));
  const expectedCleanupKeyIds = [...candidateCleanupIds]
    .filter((keyId) => !remainingReferences.has(keyId))
    .sort();
  if (!sameOrderedKeyIds(expectedCleanupKeyIds, delta.cleanupKeyIds)) {
    return 'Group Regenerate cleanup declaration does not match the canonical shared Groups.';
  }

  for (const current of currentDocument.realKeyRecords) {
    const proposed = proposedByKeyId.get(current.keyId);
    if (!proposed) return 'Group Regenerate removed an unrelated physical record.';
    if (!sourceKeyIdSet.has(current.keyId) && !samePhysicalRecord(current, proposed)) {
      return 'Group Regenerate changed an unrelated physical record.';
    }
  }
  for (const proposed of proposedRecords) {
    if (!currentByKeyId.has(proposed.keyId)) {
      return 'Group Regenerate introduced a new physical identity.';
    }
  }
  const currentOverridesByKeyId = new Map(
    (currentDocument.groupOverrideRecords ?? []).map((record) => [record.keyId, record]),
  );
  const proposedOverridesByKeyId = new Map(
    proposedGroupOverrideRecords.map((record) => [record.keyId, record]),
  );
  for (const current of currentDocument.groupOverrideRecords ?? []) {
    const proposed = proposedOverridesByKeyId.get(current.keyId);
    if (expectedCleanupKeyIds.includes(current.keyId)) {
      if (proposed) return 'Group Regenerate retained a canonical override cleanup record.';
      continue;
    }
    if (!proposed || !samePhysicalRecord(current, proposed)) {
      return 'Group Regenerate changed an unrelated Group override record.';
    }
  }
  for (const proposed of proposedGroupOverrideRecords) {
    if (!currentOverridesByKeyId.has(proposed.keyId)) {
      return 'Group Regenerate introduced a new Group override identity.';
    }
  }

  const sourceUpdatedRecords = currentDocument.realKeyRecords.map((record) => (
    sourceKeyIdSet.has(record.keyId) ? proposedByKeyId.get(record.keyId)! : record
  ));
  let proposalDocument: PhysicPaintRotoPhysicalDocument;
  try {
    proposalDocument = parsePhysicPaintRotoPhysicalDocument({
      ...targetDocument,
      realKeyRecords: sourceUpdatedRecords,
      groupOverrideRecords: currentDocument.groupOverrideRecords,
      loopClips: currentDocument.loopClips,
      incomingInterpolationBreakKeyIds: currentDocument.incomingInterpolationBreakKeyIds,
      revision: buildPhysicPaintRotoPhysicalRevision(
        sourceUpdatedRecords,
        currentDocument.interpolation,
        currentDocument.loopClips,
        currentDocument.incomingInterpolationBreakKeyIds,
        currentDocument.groupOverrideRecords,
      ),
    });
  } catch {
    return 'Group Regenerate source payload proposal is malformed.';
  }
  for (const group of affectedGroups) {
    const proposed = proposePhysicPaintRotoRegenerateGroup({
      document: proposalDocument,
      groupId: group.loopId,
      expectedActionRevision: delta.expectedActionRevision,
      currentActionRevision: delta.expectedActionRevision,
    });
    if (!proposed.ok) return `Group Regenerate proposal rejected: ${proposed.reason}.`;
    proposalDocument = proposed.proposal;
  }
  return {
    proposal: proposalDocument,
    impact: Object.freeze({
      kind: 'regenerate-group',
      groupId: delta.groupId,
      expectedActionRevision: delta.expectedActionRevision,
      cleanupKeyIds: Object.freeze(expectedCleanupKeyIds),
      previousRevision: currentDocument.revision,
      nextRevision: proposalDocument.revision,
    }),
  };
}

function validateCanonicalGroupLifecycleEdit(input: {
  readonly payload: Extract<PhysicPaintApplyPayload, { kind: 'replace-roto-physical-map' }>;
  readonly currentDocument: PhysicPaintRotoPhysicalDocument | null;
  readonly proposedRecords: readonly PhysicPaintRotoRealKeyRecord[];
  readonly proposedGroupOverrideRecords: readonly PhysicPaintRotoRealKeyRecord[];
  readonly proposedLoopClips: readonly PhysicPaintRotoLoopClip[];
  readonly proposedIncomingInterpolationBreakKeyIds: readonly string[];
  readonly stagedInterpolation: PhysicPaintRotoInterpolationState;
  readonly stagedRevision: string;
  readonly cursorAppFrame: number;
}): string | null {
  const { payload, currentDocument } = input;
  if (!GROUP_LIFECYCLE_OPERATION_KINDS.has(payload.operationKind)) return null;
  if (!currentDocument) return 'Group lifecycle edit requires one current physical document.';
  const delta = payload.semanticDelta;
  if (!delta || delta.kind !== payload.operationKind) {
    return 'Group lifecycle semantic delta does not match the operation kind.';
  }
  if (payload.intent !== undefined || payload.historyProvenance !== undefined) {
    return 'Group lifecycle edits cannot carry ordinary intent or replay provenance.';
  }
  const targetDocument: PhysicPaintRotoPhysicalDocument = Object.freeze({
    ...currentDocument,
    selectedKeyId: payload.selectedKeyId,
    cursorAppFrame: payload.cursorAppFrame,
  });

  let recomputed:
    | ReturnType<typeof proposePhysicPaintRotoGroupFramePaint>
    | ReturnType<typeof proposePhysicPaintRotoDeleteGroupFrame>
    | ReturnType<typeof proposePhysicPaintRotoDeleteGroup>
    | ReturnType<typeof proposePhysicPaintRotoRegenerateGroup>
    | ReturnType<typeof proposePhysicPaintRotoActionGroupLifecycle>;
  if (delta.kind === 'paint-group-frame') {
    const target = classifyPhysicPaintRotoGroupFrameTarget({
      document: targetDocument,
      appFrame: delta.appFrame,
    });
    if (target.kind === 'unresolved-group' || target.kind === 'ambiguous-group') {
      return 'Group Paint target precedence is unresolved.';
    }
    const overrideRecord = input.proposedGroupOverrideRecords.find((record) => record.keyId === delta.overrideKeyId);
    if (!overrideRecord || overrideRecord.appFrame !== delta.appFrame) {
      return 'Group Paint override record does not match the declared exact occurrence.';
    }
    recomputed = proposePhysicPaintRotoGroupFramePaint({
      document: targetDocument,
      groupId: delta.groupId,
      appFrame: delta.appFrame,
      overrideKeyId: delta.overrideKeyId,
      renderedPayload: overrideRecord.payload,
    });
  } else if (delta.kind === 'delete-group-frame') {
    recomputed = proposePhysicPaintRotoDeleteGroupFrame({
      document: targetDocument,
      groupId: delta.groupId,
      appFrame: delta.appFrame,
    });
  } else if (delta.kind === 'delete-group') {
    recomputed = proposePhysicPaintRotoDeleteGroup({
      document: targetDocument,
      groupId: delta.groupId,
    });
  } else if (delta.kind === 'regenerate-group') {
    const aggregate = recomputeCanonicalGroupRegenerate({
      currentDocument,
      targetDocument,
      proposedRecords: input.proposedRecords,
      proposedGroupOverrideRecords: input.proposedGroupOverrideRecords,
      delta,
    });
    if (typeof aggregate === 'string') return aggregate;
    recomputed = Object.freeze({ ok: true as const, ...aggregate });
  } else if (delta.kind === 'detach-action-groups' || delta.kind === 'delete-action-groups') {
    recomputed = proposePhysicPaintRotoActionGroupLifecycle({
      document: targetDocument,
      actionId: delta.actionId,
      expectedActionRevision: delta.expectedActionRevision,
      currentActionRevision: delta.expectedActionRevision,
      mode: delta.kind === 'detach-action-groups' ? 'detach' : 'delete',
    });
  } else {
    return 'Group lifecycle semantic delta is not supported.';
  }
  if (!recomputed.ok) return `Group lifecycle proposal rejected: ${recomputed.reason}.`;
  if (stableSerialize(recomputed.impact, new WeakSet<object>())
      !== stableSerialize(delta as PhysicPaintRotoPhysicalEditSemanticDelta, new WeakSet<object>())) {
    return 'Group lifecycle semantic impact does not match parent recomputation.';
  }
  const proposal = recomputed.proposal;
  if (!sameCompletePhysicalRecords(proposal.realKeyRecords, input.proposedRecords)
    || !sameCompletePhysicalRecords(proposal.groupOverrideRecords ?? [], input.proposedGroupOverrideRecords)
    || stableSerialize(proposal.loopClips, new WeakSet<object>())
      !== stableSerialize(input.proposedLoopClips, new WeakSet<object>())
    || stableSerialize(proposal.incomingInterpolationBreakKeyIds, new WeakSet<object>())
      !== stableSerialize(input.proposedIncomingInterpolationBreakKeyIds, new WeakSet<object>())
    || proposal.interpolation.enabled !== input.stagedInterpolation.enabled
    || proposal.interpolation.mode !== input.stagedInterpolation.mode
    || proposal.selectedKeyId !== payload.selectedKeyId
    || proposal.cursorAppFrame !== input.cursorAppFrame
    || proposal.revision !== input.stagedRevision) {
    return 'Group lifecycle target document does not match parent recomputation.';
  }
  return null;
}

function applyPhysicPaintRotoPhysicalMap(
  payload: Extract<PhysicPaintApplyPayload, { kind: 'replace-roto-physical-map' }>,
  publicationLeaseToken?: PhysicPaintRotoPhysicalOperationLeaseToken,
): PhysicPaintRotoPhysicalEditApplyResult {
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
  const submittedLeaseToken = payload.leaseToken!;
  if (submittedLeaseToken.projectContextId !== projectStore.projectContextId.peek()) {
    return reject('Project context changed after the physical-operation lease was acquired.');
  }
  if (publicationLeaseToken && submittedLeaseToken.layerId !== payload.layerId) {
    return reject('Roto physical operation lease rejected: mismatched-token.');
  }
  const leaseToken = publicationLeaseToken ?? submittedLeaseToken;
  const leaseValidation = physicPaintStore.validateRotoPhysicalOperationLease(
    leaseToken.projectContextId,
    payload.layerId,
    leaseToken,
  );
  if (!leaseValidation.ok) {
    return reject(`Roto physical operation lease rejected: ${leaseValidation.reason}.`);
  }
  const currentRecords = physicPaintStore.getRotoRealKeyRecords(payload.layerId);
  const currentGroupOverrideRecords = physicPaintStore.getRotoGroupOverrideRecords(payload.layerId);
  const currentInterpolation = physicPaintStore.getRotoPhysicalInterpolationState(payload.layerId);
  const currentLoopClips = physicPaintStore.getRotoPhysicalLoopClips(payload.layerId);
  const currentIncomingInterpolationBreakKeyIds = physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(payload.layerId);
  const currentDocument = physicPaintStore.getRotoPhysicalDocument(payload.layerId);
  const currentRevision = buildPhysicPaintRotoPhysicalRevision(
    currentRecords,
    currentInterpolation,
    currentLoopClips,
    currentIncomingInterpolationBreakKeyIds,
    currentGroupOverrideRecords,
  );
  const capacity = physicPaintStore.getRotoPhysicalCapacity(payload.layerId);
  const isReplay = payload.operationKind === 'undo' || payload.operationKind === 'redo';
  let replayEntry: AcceptedPhysicalCommandEntry | null = null;
  if (isReplay) {
    const provenance = payload.historyProvenance;
    if (!provenance) return reject('Roto physical replay is missing history provenance.');
    if (provenance.historyDirection !== payload.operationKind) return reject('Roto physical replay provenance direction mismatch.');
    replayEntry = acceptedPhysicalCommands.get(provenance.historyCommandId) ?? null;
    if (!replayEntry) return reject('Roto physical replay targets an unknown accepted command.');
    if (replayEntry.projectContextId !== projectStore.projectContextId.peek()
      || replayEntry.layerId !== payload.layerId
      || replayEntry.launchOperationId !== payload.launchOperationId
      || replayEntry.capacity !== capacity) {
      return reject('Roto physical replay authority scope does not match the original accepted command.');
    }
    const liveSourceSnapshot = createAcceptedPhysicalCommandSnapshot({
      records: currentRecords,
      groupOverrideRecords: currentGroupOverrideRecords,
      interpolation: currentInterpolation,
      loopClips: currentLoopClips,
      incomingInterpolationBreakKeyIds: currentIncomingInterpolationBreakKeyIds,
      selectedKeyId: currentDocument?.selectedKeyId ?? null,
      cursorAppFrame: currentDocument?.cursorAppFrame ?? payload.cursorAppFrame,
      capacity,
      revision: currentRevision,
    });
    const expectedSourceSnapshot = provenance.historyDirection === 'undo'
      ? replayEntry.after
      : replayEntry.before;
    if (!sameAcceptedPhysicalCommandSnapshot(liveSourceSnapshot, expectedSourceSnapshot)) {
      return reject('Roto physical replay source snapshot does not match the original accepted command.');
    }
  }
  if (currentRevision !== payload.expectedRevision) {
    return reject('Roto physical revision became stale before commit.');
  }
  if (payload.records.length > capacity) {
    return reject('Roto physical edit exceeds the current layer capacity.');
  }
  if (payload.cursorAppFrame >= capacity) {
    return reject('Roto physical cursor exceeds the current layer capacity.');
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
  let proposedGroupOverrideRecords: readonly PhysicPaintRotoRealKeyRecord[];
  try {
    proposedGroupOverrideRecords = payload.groupOverrideRecords === undefined
      ? currentGroupOverrideRecords
      : parsePhysicPaintRotoRealKeyRecordCollection(
          payload.groupOverrideRecords.map((record) => ({ kind: 'real-key' as const, ...record })),
          capacity,
        );
  } catch (error) {
    return reject(error instanceof Error ? error.message : 'Roto physical Group override records are malformed.');
  }
  // Loop Clip threading (Phase 43, D-29/D-31): a commit carrying loopClips is
  // validated fail-closed and delivered to the store apply path unchanged; a
  // commit without the member preserves the layer's current collection.
  let proposedLoopClips: readonly PhysicPaintRotoLoopClip[];
  try {
    proposedLoopClips = payload.loopClips === undefined
      ? physicPaintStore.getRotoPhysicalLoopClips(payload.layerId)
      : parsePhysicPaintRotoLoopClips(payload.loopClips);
  } catch (error) {
    return reject(error instanceof Error ? error.message : 'Roto physical Loop Clips are malformed.');
  }
  let proposedIncomingInterpolationBreakKeyIds: readonly string[];
  try {
    proposedIncomingInterpolationBreakKeyIds = payload.incomingInterpolationBreakKeyIds === undefined
      ? currentIncomingInterpolationBreakKeyIds
      : parsePhysicPaintRotoIncomingInterpolationBreakKeyIds(
          payload.incomingInterpolationBreakKeyIds,
          proposedRecords,
        );
  } catch (error) {
    return reject(error instanceof Error ? error.message : 'Roto physical incoming interpolation breaks are malformed.');
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
  if (!isInterpolationChange
    && !isPlayScript
    && !isReplay
    && (payload.interpolationEnabled !== currentInterpolation.enabled
      || payload.interpolationMode !== currentInterpolation.mode)) {
    return reject('Ordinary physical edits must preserve the accepted interpolation state.');
  }
  if (isInterpolationChange) {
    if (!sameCompletePhysicalRecords(currentRecords, proposedRecords)
      || !sameCompletePhysicalRecords(currentGroupOverrideRecords, proposedGroupOverrideRecords)) {
      return reject('Interpolation change must preserve every physical record exactly.');
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
  const stagedRevision = buildPhysicPaintRotoPhysicalRevision(
    proposedRecords,
    stagedInterpolation,
    proposedLoopClips,
    proposedIncomingInterpolationBreakKeyIds,
    proposedGroupOverrideRecords,
  );
  if (payload.intent !== undefined) {
    const canonicalValidationError = validateCanonicalOrdinaryPhysicalEdit({
      intent: payload.intent,
      currentRecords,
      proposedRecords,
      currentGroupOverrideRecords,
      proposedGroupOverrideRecords,
      currentInterpolation,
      proposedInterpolation: stagedInterpolation,
      currentLoopClips,
      proposedLoopClips,
      currentIncomingInterpolationBreakKeyIds,
      proposedIncomingInterpolationBreakKeyIds,
      selectedKeyId: payload.selectedKeyId,
      selectedAppFrame: payload.selectedAppFrame,
      capacity,
      stagedRevision,
    });
    if (canonicalValidationError) return reject(canonicalValidationError, stagedRevision);
  }
  if (payload.operationKind === 'insert-empty-segment') {
    const validationError = validateInsertEmptySegmentPhysicalDelta({
      payload,
      currentRecords,
      proposedRecords,
      currentLoopClips,
      proposedLoopClips,
      currentIncomingInterpolationBreakKeyIds,
      proposedIncomingInterpolationBreakKeyIds,
      capacity,
    });
    if (validationError) return reject(validationError, stagedRevision);
  }
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

  const cursorAppFrame = payload.cursorAppFrame;
  const lifecycleValidationError = validateCanonicalGroupLifecycleEdit({
    payload,
    currentDocument,
    proposedRecords,
    proposedGroupOverrideRecords,
    proposedLoopClips,
    proposedIncomingInterpolationBreakKeyIds,
    stagedInterpolation,
    stagedRevision,
    cursorAppFrame,
  });
  if (lifecycleValidationError) return reject(lifecycleValidationError, stagedRevision);
  if (isReplay) {
    const provenance = payload.historyProvenance;
    const original = replayEntry;
    if (!provenance || !original) return reject('Roto physical replay authorization became unavailable.', stagedRevision);
    const expectedTargetSnapshot = provenance.historyDirection === 'undo'
      ? original.before
      : original.after;
    const proposedTargetSnapshot = createAcceptedPhysicalCommandSnapshot({
      records: proposedRecords,
      groupOverrideRecords: proposedGroupOverrideRecords,
      interpolation: stagedInterpolation,
      loopClips: proposedLoopClips,
      incomingInterpolationBreakKeyIds: proposedIncomingInterpolationBreakKeyIds,
      selectedKeyId: payload.selectedKeyId,
      cursorAppFrame,
      capacity,
      revision: stagedRevision,
    });
    if (!sameAcceptedPhysicalCommandSnapshot(proposedTargetSnapshot, expectedTargetSnapshot)) {
      return reject('Roto physical replay target snapshot does not match the original accepted command.', stagedRevision);
    }
    if (currentRevision !== provenance.sourceRevision) return reject('Roto physical replay source revision does not match the current state.', stagedRevision);
    if (stagedRevision !== provenance.targetRevision) return reject('Roto physical replay target revision does not match the original command.', stagedRevision);
  }

  const stagedDocument = parsePhysicPaintRotoPhysicalDocument({
    capacity,
    realKeyRecords: proposedRecords,
    groupOverrideRecords: proposedGroupOverrideRecords,
    interpolation: stagedInterpolation,
    scriptMotion: currentDocument?.scriptMotion ?? PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO,
    background: isPlayScript
      ? payload.rotoBackground!
      : currentDocument?.background ?? physicPaintStore.getRotoBackgroundMetadata(payload.layerId),
    selectedKeyId: payload.selectedKeyId,
    cursorAppFrame,
    revision: stagedRevision,
    loopClips: proposedLoopClips,
    incomingInterpolationBreakKeyIds: proposedIncomingInterpolationBreakKeyIds,
  });
  const replaceResult = physicPaintStore.replaceRotoPhysicalDocument(
    payload.layerId,
    stagedDocument,
    leaseToken,
  );
  if (!replaceResult.ok) return reject(replaceResult.error, stagedRevision);
  const acceptedDocument = replaceResult.document;
  const acceptedSelectedKeyId = acceptedDocument.selectedKeyId;
  const acceptedSelectedAppFrame = acceptedSelectedKeyId === null ? null : acceptedDocument.cursorAppFrame;

  if (!isReplay && !isInterpolationChange) {
    // Phase 43 (D-06/D-10): Play Script generation commits join the ledger so
    // a generation plus its derived loop shrink replays as one Undo/Redo.
    const groupLifecycleAuthority = GROUP_LIFECYCLE_OPERATION_KINDS.has(payload.operationKind);
    const beforeSnapshot = createAcceptedPhysicalCommandSnapshot({
      records: currentRecords,
      groupOverrideRecords: currentGroupOverrideRecords,
      interpolation: currentInterpolation,
      loopClips: currentLoopClips,
      incomingInterpolationBreakKeyIds: currentIncomingInterpolationBreakKeyIds,
      selectedKeyId: groupLifecycleAuthority
        ? payload.selectedKeyId
        : currentDocument?.selectedKeyId ?? null,
      cursorAppFrame: groupLifecycleAuthority
        ? payload.cursorAppFrame
        : currentDocument?.cursorAppFrame ?? payload.cursorAppFrame,
      capacity,
      revision: currentRevision,
    });
    const afterSnapshot = createAcceptedPhysicalCommandSnapshot({
      records: acceptedDocument.realKeyRecords,
      groupOverrideRecords: acceptedDocument.groupOverrideRecords ?? [],
      interpolation: acceptedDocument.interpolation,
      loopClips: acceptedDocument.loopClips,
      incomingInterpolationBreakKeyIds: acceptedDocument.incomingInterpolationBreakKeyIds,
      selectedKeyId: acceptedDocument.selectedKeyId,
      cursorAppFrame: acceptedDocument.cursorAppFrame,
      capacity: acceptedDocument.capacity,
      revision: acceptedDocument.revision,
    });
    acceptedPhysicalCommands.set(payload.operationId, Object.freeze({
      operationId: payload.operationId,
      projectContextId: projectStore.projectContextId.peek(),
      layerId: payload.layerId,
      launchOperationId: payload.launchOperationId,
      capacity,
      before: beforeSnapshot,
      after: afterSnapshot,
    }));
  }

  return physicalEditResult(payload, {
    ok: true,
    stagedRevision,
    acceptedRevision: acceptedDocument.revision,
    selectedKeyId: acceptedSelectedKeyId,
    selectedAppFrame: acceptedSelectedAppFrame,
    cursorAppFrame: acceptedDocument.cursorAppFrame,
  });
}

const PHYSIC_PAINT_ROTO_GROUP_FRAME_PAINT_REQUEST_KEYS = new Set([
  'operationId',
  'projectContextId',
  'layerId',
  'launchOperationId',
  'expectedRevision',
  'expectedProjectEquality',
  'groupId',
  'appFrame',
  'overrideKeyId',
  'renderedPayload',
  'unresolvedPrecedence',
  'claimedCleanupKeyIds',
  'proposal',
  'impact',
  'leaseToken',
]);
const PHYSIC_PAINT_ROTO_OPERATION_LEASE_TOKEN_KEYS = new Set([
  'projectContextId',
  'layerId',
  'generation',
  'owner',
]);

function parsePhysicPaintRotoGroupFramePaintApplyRequest(
  value: unknown,
): PhysicPaintRotoGroupFramePaintApplyRequest | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const request = value as Record<string, unknown>;
  const definedRequest = Object.fromEntries(
    Object.entries(request).filter(([, member]) => member !== undefined),
  );
  if (!isStructuredClonePlainData(definedRequest)
    || Object.keys(definedRequest).some((key) => !PHYSIC_PAINT_ROTO_GROUP_FRAME_PAINT_REQUEST_KEYS.has(key))) return null;
  const leaseToken = request.leaseToken;
  if (leaseToken !== undefined) {
    if (leaseToken === null || typeof leaseToken !== 'object' || Array.isArray(leaseToken)) return null;
    const tokenRecord = leaseToken as Record<string, unknown>;
    if (Object.keys(tokenRecord).some((key) => !PHYSIC_PAINT_ROTO_OPERATION_LEASE_TOKEN_KEYS.has(key))
      || typeof tokenRecord.projectContextId !== 'string'
      || typeof tokenRecord.layerId !== 'string'
      || !Number.isSafeInteger(tokenRecord.generation)
      || (tokenRecord.generation as number) < 1
      || (tokenRecord.owner !== 'exclusive' && tokenRecord.owner !== 'recovery')) return null;
  }
  if (typeof request.operationId !== 'string' || request.operationId.length === 0
    || typeof request.projectContextId !== 'string' || request.projectContextId.length === 0
    || typeof request.layerId !== 'string' || request.layerId.length === 0
    || typeof request.launchOperationId !== 'string' || request.launchOperationId.length === 0
    || typeof request.expectedRevision !== 'string' || request.expectedRevision.length === 0
    || typeof request.expectedProjectEquality !== 'string' || request.expectedProjectEquality.length === 0
    || typeof request.groupId !== 'string' || request.groupId.length === 0
    || !Number.isSafeInteger(request.appFrame)
    || typeof request.overrideKeyId !== 'string' || request.overrideKeyId.length === 0
    || request.renderedPayload === null || typeof request.renderedPayload !== 'object'
    || request.proposal === null || typeof request.proposal !== 'object'
    || request.impact === null || typeof request.impact !== 'object'
    || (request.unresolvedPrecedence !== undefined && typeof request.unresolvedPrecedence !== 'boolean')
    || (request.claimedCleanupKeyIds !== undefined
      && (!Array.isArray(request.claimedCleanupKeyIds)
        || request.claimedCleanupKeyIds.some((keyId) => typeof keyId !== 'string')))
    || (request.leaseToken !== undefined
      && (request.leaseToken === null || typeof request.leaseToken !== 'object'))) return null;
  return request as unknown as PhysicPaintRotoGroupFramePaintApplyRequest;
}

/**
 * Parent-authoritative exact-occurrence Paint commit. The child proposal and
 * impact are untrusted: this path rechecks every authority, independently
 * rebuilds the candidate, and publishes only that recomputed document through
 * the token-checked sole store replacement.
 */
export function applyPhysicPaintRotoGroupFramePaint(
  value: unknown,
): PhysicPaintRotoGroupFramePaintApplyResult {
  const request = parsePhysicPaintRotoGroupFramePaintApplyRequest(value);
  if (!request) return Object.freeze({ ok: false, reason: 'malformed' });

  let fingerprint: string;
  try {
    fingerprint = stableSerialize(request, new WeakSet<object>());
  } catch {
    return Object.freeze({ ok: false, reason: 'malformed' });
  }
  const prior = deliveredGroupFramePaintOperations.get(request.operationId);
  if (prior) {
    return prior.fingerprint === fingerprint
      ? Object.freeze({ ok: false, reason: 'replayed-token' })
      : Object.freeze({ ok: false, reason: 'changed-payload' });
  }

  if (request.projectContextId !== projectStore.projectContextId.peek()) {
    return Object.freeze({ ok: false, reason: 'stale' });
  }
  const layer = [...layerStore.layers.peek(), ...layerStore.overlayLayers.peek()].find((candidate) => (
    candidate.id === request.layerId
      || (candidate.type === 'physic-paint'
        && candidate.source.type === 'physic-paint'
        && candidate.source.layerId === request.layerId)
  ));
  if (!layer || layer.type !== 'physic-paint'
    || activeLaunchOperationByLayer.get(request.layerId) !== request.launchOperationId) {
    return Object.freeze({ ok: false, reason: 'stale' });
  }

  const currentDocument = physicPaintStore.getRotoPhysicalDocument(request.layerId);
  if (!currentDocument
    || currentDocument.revision !== request.expectedRevision
    || buildPhysicPaintRotoProjectEquality(currentDocument) !== request.expectedProjectEquality) {
    return Object.freeze({ ok: false, reason: 'stale' });
  }
  const leaseValidation = physicPaintStore.validateRotoPhysicalOperationLease(
    request.projectContextId,
    request.layerId,
    request.leaseToken,
  );
  if (!leaseValidation.ok) return Object.freeze({ ok: false, reason: leaseValidation.reason });

  const recomputed = proposePhysicPaintRotoGroupFramePaint({
    document: currentDocument,
    groupId: request.groupId,
    appFrame: request.appFrame,
    overrideKeyId: request.overrideKeyId,
    renderedPayload: request.renderedPayload,
    unresolvedPrecedence: request.unresolvedPrecedence,
    claimedCleanupKeyIds: request.claimedCleanupKeyIds,
  });
  if (!recomputed.ok) {
    const reason = recomputed.reason === 'unresolved-precedence'
      ? 'unresolved-precedence'
      : recomputed.reason === 'cleanup-reference-mismatch'
        ? 'cleanup-reference-mismatch'
        : 'malformed';
    return Object.freeze({ ok: false, reason });
  }

  let claimedProposal: PhysicPaintRotoPhysicalDocument;
  try {
    claimedProposal = parsePhysicPaintRotoPhysicalDocument(request.proposal);
  } catch {
    return Object.freeze({ ok: false, reason: 'malformed' });
  }
  if (stableSerialize(claimedProposal, new WeakSet<object>())
      !== stableSerialize(recomputed.proposal, new WeakSet<object>())
    || stableSerialize(request.impact, new WeakSet<object>())
      !== stableSerialize(recomputed.impact, new WeakSet<object>())) {
    return Object.freeze({ ok: false, reason: 'malformed' });
  }

  const replaceResult = physicPaintStore.replaceRotoPhysicalDocument(
    request.layerId,
    recomputed.proposal,
    request.leaseToken,
  );
  if (!replaceResult.ok) {
    const reason = replaceResult.error === 'missing-token'
      || replaceResult.error === 'mismatched-token'
      || replaceResult.error === 'replayed-token'
      ? replaceResult.error
      : 'malformed';
    return Object.freeze({ ok: false, reason });
  }

  acceptedPhysicalCommands.set(request.operationId, Object.freeze({
    operationId: request.operationId,
    projectContextId: request.projectContextId,
    layerId: request.layerId,
    launchOperationId: request.launchOperationId,
    capacity: currentDocument.capacity,
    before: createAcceptedPhysicalCommandSnapshot({
      records: currentDocument.realKeyRecords,
      groupOverrideRecords: currentDocument.groupOverrideRecords ?? [],
      interpolation: currentDocument.interpolation,
      loopClips: currentDocument.loopClips,
      incomingInterpolationBreakKeyIds: currentDocument.incomingInterpolationBreakKeyIds,
      selectedKeyId: currentDocument.selectedKeyId,
      cursorAppFrame: currentDocument.cursorAppFrame,
      capacity: currentDocument.capacity,
      revision: currentDocument.revision,
    }),
    after: createAcceptedPhysicalCommandSnapshot({
      records: replaceResult.document.realKeyRecords,
      groupOverrideRecords: replaceResult.document.groupOverrideRecords ?? [],
      interpolation: replaceResult.document.interpolation,
      loopClips: replaceResult.document.loopClips,
      incomingInterpolationBreakKeyIds: replaceResult.document.incomingInterpolationBreakKeyIds,
      selectedKeyId: replaceResult.document.selectedKeyId,
      cursorAppFrame: replaceResult.document.cursorAppFrame,
      capacity: replaceResult.document.capacity,
      revision: replaceResult.document.revision,
    }),
  }));
  const result = Object.freeze({
    ok: true as const,
    acceptedDocument: replaceResult.document,
    historyCommandId: request.operationId,
  });
  deliveredGroupFramePaintOperations.set(request.operationId, Object.freeze({ fingerprint, result }));
  return result;
}

export interface ReferencedActionDeletionHistoryEntry {
  readonly commandId: string;
  readonly generation: number;
  readonly direction: 'forward' | 'undo' | 'redo';
  readonly mode: 'keep-groups' | 'delete-action-and-groups';
  readonly retainedArtifact: PhysicPaintActionRetainedArtifactReference;
  readonly authority: Readonly<{
    projectContextId: string;
    layerId: string;
    launchOperationId: string;
    actionId: string;
    actionRevision: string;
  }>;
  readonly before: Readonly<{ physicalRevision: string; physicalHash: string; document: PhysicPaintRotoPhysicalDocument }>;
  readonly after: Readonly<{ physicalRevision: string; physicalHash: string; document: PhysicPaintRotoPhysicalDocument }>;
  readonly selection: Readonly<{
    beforeGroupId: string | null;
    afterGroupId: string | null;
    beforeCursorAppFrame: number;
    afterCursorAppFrame: number;
  }>;
}

export type CommittedReferencedActionDeletionResult = Readonly<{
  ok: true;
  settled: boolean;
  acceptedDocument: PhysicPaintRotoPhysicalDocument;
  history: ReferencedActionDeletionHistoryEntry;
}> | Readonly<{
  ok: false;
  reason: 'malformed' | 'stale' | 'mismatched-token' | 'missing-token' | 'replayed-token' | 'changed-payload' | 'unresolved-precedence' | 'cleanup-reference-mismatch';
}>;

export interface CommittedReferencedActionDeletionInput {
  readonly committed: PhysicPaintActionTransactionRecord;
  readonly impact?: PhysicPaintRotoActionGroupLifecycleImpact;
  readonly before?: PhysicPaintRotoPhysicalDocument;
  readonly history?: ReferencedActionDeletionHistoryEntry;
  readonly leaseToken?: PhysicPaintRotoPhysicalOperationLeaseToken;
}

const settledReferencedActionDeletions = new Map<string, Readonly<{
  fingerprint: string;
  result: Extract<CommittedReferencedActionDeletionResult, { ok: true }>;
}>>();

export function applyCommittedReferencedActionDeletion(
  input: CommittedReferencedActionDeletionInput,
): CommittedReferencedActionDeletionResult {
  const { committed } = input;
  if (committed.state !== 'committed') return { ok: false, reason: 'malformed' };
  const expectedActionPresent = committed.direction !== 'undo';
  if (committed.authority.expectedActionPresent !== expectedActionPresent) return { ok: false, reason: 'malformed' };
  const identity = `${committed.commandId}:${committed.generation}:${committed.token}:${committed.direction}`;
  let fingerprint: string;
  try {
    fingerprint = stableSerialize(input, new WeakSet<object>());
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  const delivered = settledReferencedActionDeletions.get(identity);
  if (delivered) return delivered.fingerprint === fingerprint
    ? { ...delivered.result, settled: false }
    : { ok: false, reason: 'changed-payload' };

  const authority = committed.authority;
  if (projectStore.projectContextId.peek() !== authority.projectContextId
    || activeLaunchOperationByLayer.get(authority.layerId) !== authority.launchOperationId) {
    return { ok: false, reason: 'stale' };
  }
  const retained = committed.retainedArtifact;
  if (retained.commandId !== committed.commandId
    || retained.generation !== committed.generation
    || retained.actionId !== authority.actionId
    || retained.originalRevision !== authority.expectedActionRevision) {
    return { ok: false, reason: 'malformed' };
  }
  const lease = physicPaintStore.validateRotoPhysicalOperationLease(
    authority.projectContextId,
    authority.layerId,
    input.leaseToken,
  );
  if (!lease.ok) return { ok: false, reason: lease.reason };

  let history: ReferencedActionDeletionHistoryEntry;
  let semanticImpact: PhysicPaintRotoActionGroupLifecycleImpact;
  if (committed.direction === 'forward') {
    if (!input.before || !input.impact || input.history) return { ok: false, reason: 'malformed' };
    const proposed = proposePhysicPaintRotoActionGroupLifecycle({
      document: input.before,
      actionId: authority.actionId,
      expectedActionRevision: authority.expectedActionRevision,
      currentActionRevision: authority.expectedActionRevision,
      mode: committed.mode === 'keep-groups' ? 'detach' : 'delete',
    });
    if (!proposed.ok) return { ok: false, reason: proposed.reason === 'malformed-proposal' ? 'malformed' : 'stale' };
    if (stableSerialize(proposed.impact, new WeakSet<object>()) !== stableSerialize(input.impact, new WeakSet<object>())) {
      return { ok: false, reason: 'cleanup-reference-mismatch' };
    }
    semanticImpact = proposed.impact;
    history = cloneAndDeepFreezePlainData<ReferencedActionDeletionHistoryEntry>({
      commandId: committed.commandId,
      generation: committed.generation,
      direction: committed.direction,
      mode: committed.mode,
      retainedArtifact: retained,
      authority: {
        projectContextId: authority.projectContextId,
        layerId: authority.layerId,
        launchOperationId: authority.launchOperationId,
        actionId: authority.actionId,
        actionRevision: authority.expectedActionRevision,
      },
      before: {
        physicalRevision: input.before.revision,
        physicalHash: buildPhysicPaintRotoProjectEquality(input.before),
        document: input.before,
      },
      after: {
        physicalRevision: proposed.proposal.revision,
        physicalHash: buildPhysicPaintRotoProjectEquality(proposed.proposal),
        document: proposed.proposal,
      },
      selection: {
        beforeGroupId: null,
        afterGroupId: committed.target.selectedGroupId,
        beforeCursorAppFrame: input.before.cursorAppFrame,
        afterCursorAppFrame: proposed.proposal.cursorAppFrame,
      },
    });
  } else {
    const original = input.history;
    if (!original || input.before || input.impact
      || original.commandId !== committed.commandId
      || original.generation !== committed.generation
      || original.mode !== committed.mode
      || stableSerialize(original.retainedArtifact, new WeakSet<object>()) !== stableSerialize(retained, new WeakSet<object>())
      || original.authority.projectContextId !== authority.projectContextId
      || original.authority.layerId !== authority.layerId
      || original.authority.launchOperationId !== authority.launchOperationId
      || original.authority.actionId !== authority.actionId
      || original.authority.actionRevision !== authority.expectedActionRevision) {
      return { ok: false, reason: 'malformed' };
    }
    const proposed = proposePhysicPaintRotoActionGroupLifecycle({
      document: original.before.document,
      actionId: authority.actionId,
      expectedActionRevision: authority.expectedActionRevision,
      currentActionRevision: authority.expectedActionRevision,
      mode: committed.mode === 'keep-groups' ? 'detach' : 'delete',
    });
    if (!proposed.ok
      || stableSerialize(proposed.proposal, new WeakSet<object>()) !== stableSerialize(original.after.document, new WeakSet<object>())) {
      return { ok: false, reason: 'unresolved-precedence' };
    }
    semanticImpact = proposed.impact;
    history = cloneAndDeepFreezePlainData({ ...original, direction: committed.direction });
  }

  const source = committed.direction === 'undo' ? history.after : history.before;
  const directionTarget = committed.direction === 'undo' ? history.before : history.after;
  const current = physicPaintStore.getRotoPhysicalDocument(authority.layerId);
  if (!current
    || current.revision !== authority.expectedPhysicalRevision
    || buildPhysicPaintRotoProjectEquality(current) !== authority.expectedPhysicalHash
    || current.revision !== source.physicalRevision
    || buildPhysicPaintRotoProjectEquality(current) !== source.physicalHash
    || stableSerialize(current, new WeakSet<object>()) !== stableSerialize(source.document, new WeakSet<object>())) {
    return { ok: false, reason: 'stale' };
  }

  let target: PhysicPaintRotoPhysicalDocument;
  try {
    target = parsePhysicPaintRotoPhysicalDocument(committed.target.physicalDocument);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  const expectedGroupId = committed.direction === 'undo'
    ? history.selection.beforeGroupId
    : history.selection.afterGroupId;
  const expectedCursorAppFrame = committed.direction === 'undo'
    ? history.selection.beforeCursorAppFrame
    : history.selection.afterCursorAppFrame;
  if (target.revision !== committed.target.physicalRevision
    || buildPhysicPaintRotoProjectEquality(target) !== committed.target.physicalHash
    || committed.target.physicalRevision !== directionTarget.physicalRevision
    || committed.target.physicalHash !== directionTarget.physicalHash
    || committed.target.selectedGroupId !== expectedGroupId
    || committed.target.cursorAppFrame !== expectedCursorAppFrame
    || stableSerialize(target, new WeakSet<object>()) !== stableSerialize(directionTarget.document, new WeakSet<object>())) {
    return { ok: false, reason: 'unresolved-precedence' };
  }
  if (committed.direction === 'forward'
    && stableSerialize(semanticImpact, new WeakSet<object>()) !== stableSerialize(input.impact, new WeakSet<object>())) {
    return { ok: false, reason: 'cleanup-reference-mismatch' };
  }

  const replacement = physicPaintStore.replaceRotoPhysicalDocument(authority.layerId, target, input.leaseToken);
  if (!replacement.ok) return { ok: false, reason: replacement.error as 'mismatched-token' | 'missing-token' | 'replayed-token' };
  acceptedPhysicalCommands.set(committed.commandId, Object.freeze({
    operationId: committed.commandId,
    projectContextId: authority.projectContextId,
    layerId: authority.layerId,
    launchOperationId: authority.launchOperationId,
    capacity: current.capacity,
    before: createAcceptedPhysicalCommandSnapshot({
      records: current.realKeyRecords, groupOverrideRecords: current.groupOverrideRecords ?? [], interpolation: current.interpolation, loopClips: current.loopClips,
      incomingInterpolationBreakKeyIds: current.incomingInterpolationBreakKeyIds, selectedKeyId: current.selectedKeyId,
      cursorAppFrame: current.cursorAppFrame, capacity: current.capacity, revision: current.revision,
    }),
    after: createAcceptedPhysicalCommandSnapshot({
      records: replacement.document.realKeyRecords, groupOverrideRecords: replacement.document.groupOverrideRecords ?? [], interpolation: replacement.document.interpolation, loopClips: replacement.document.loopClips,
      incomingInterpolationBreakKeyIds: replacement.document.incomingInterpolationBreakKeyIds, selectedKeyId: replacement.document.selectedKeyId,
      cursorAppFrame: replacement.document.cursorAppFrame, capacity: replacement.document.capacity, revision: replacement.document.revision,
    }),
  }));
  const result = Object.freeze({ ok: true as const, settled: true, acceptedDocument: replacement.document, history });
  settledReferencedActionDeletions.set(identity, Object.freeze({ fingerprint, result }));
  return result;
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
  const project = {
    name: projectStore.name.peek(),
    saved: Boolean(projectStore.filePath.peek() && projectStore.scriptLibraryAuthority.peek()),
    contextId: projectStore.projectContextId.peek(),
    ...(projectStore.scriptLibraryAuthority.peek() ? { scriptLibraryAuthority: projectStore.scriptLibraryAuthority.peek()! } : {}),
  };
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

/**
 * D-02 push-on-change publisher: emits the full rebuilt audioPreview section
 * to the EFX Paint window. The shared builder keeps the rev-counter ordering
 * total across launch embed + push (truth table section 4). emitTo
 * window-label targeting only — never broadcast emit (T-41-08) — plus the
 * CustomEvent / opener.postMessage browser fallbacks, exactly the
 * publishPhysicPaintProjectContext shape. Unlike the launch embed, the push
 * fires even with zero tracks: deleting the last track while EFX Paint is
 * open must reach the child (AUDIO-04).
 */
export async function publishPhysicPaintAudioContext(): Promise<void> {
  const section = buildPhysicPaintAudioPreviewSection();
  if (isTauriRuntime()) {
    const eventApi = await import('@tauri-apps/api/event');
    await eventApi.emitTo?.(PHYSIC_PAINT_WINDOW_LABEL, PHYSIC_PAINT_AUDIO_CONTEXT_EVENT, section);
  }
  if (typeof window !== 'undefined') {
    const message = { type: PHYSIC_PAINT_AUDIO_CONTEXT_EVENT, payload: section };
    window.dispatchEvent(new CustomEvent(PHYSIC_PAINT_AUDIO_CONTEXT_EVENT, { detail: section }));
    window.opener?.postMessage?.(message, window.location.origin);
  }
}

/**
 * Main-window push trigger (D-02): a signal effect over audioStore.tracks —
 * the effect synchronizes with an external system (the child window), the
 * sanctioned effect use per project Preact guidelines. Every effect run
 * publishes; debounce is NOT allowed to skip revisions — the counter absorbs
 * frequency (T-41-09). MAIN WINDOW ONLY: installed from main.tsx. The child
 * bundle imports this module for its event constants and must never register
 * the publisher — its audioStore is an empty independent singleton (AUDIO-01
 * authority boundary).
 */
export function installPhysicPaintAudioContextPublisher(): () => void {
  return effect(() => {
    audioStore.tracks.value;
    void publishPhysicPaintAudioContext();
  });
}

/**
 * 41-04 (D-05): broadcast the main editor's playback state to the EFX Paint
 * window so the child's first-player-wins guard can suppress its audio start
 * (D-06 note) and auto-resume when the main editor stops (D-07). Called from
 * the only two funnel points — playbackEngine.start() (true) and stop()
 * (false). Same publish shape as publishPhysicPaintProjectContext: emitTo
 * window-label targeting (never broadcast emit) plus the CustomEvent /
 * opener.postMessage browser fallbacks.
 */
export async function publishPhysicPaintAudioPlaybackState(playing: boolean): Promise<void> {
  const state = { playing };
  if (isTauriRuntime()) {
    const eventApi = await import('@tauri-apps/api/event');
    await eventApi.emitTo?.(PHYSIC_PAINT_WINDOW_LABEL, PHYSIC_PAINT_AUDIO_PLAYBACK_STATE_EVENT, state);
  }
  if (typeof window !== 'undefined') {
    const message = { type: PHYSIC_PAINT_AUDIO_PLAYBACK_STATE_EVENT, payload: state };
    window.dispatchEvent(new CustomEvent(PHYSIC_PAINT_AUDIO_PLAYBACK_STATE_EVENT, { detail: state }));
    window.opener?.postMessage?.(message, window.location.origin);
  }
}

/**
 * 41-04 (D-05 symmetric guard): main-side record of the child's audio
 * ownership claim. While held, playbackEngine.startAudioPlayback() suppresses
 * itself — visual playback proceeds but doubled audio is impossible.
 * Transient session state (T-41-10: a spoofed event's worst case is a
 * suppressed main start, never main-state mutation).
 */
const physicPaintChildAudioClaimed = signal(false);

export function isPhysicPaintChildAudioClaimed(): boolean {
  return physicPaintChildAudioClaimed.peek();
}

/**
 * Main-side listener for the child's ownership claim/release events
 * (PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT). MAIN WINDOW ONLY: installed from
 * main.tsx. Tauri listen + CustomEvent + origin-checked postMessage, matching
 * the established listener idiom; invalid payloads are ignored silently.
 */
export async function installPhysicPaintAudioOwnershipListener(): Promise<() => void> {
  const accept = (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const claim = (value as { claim?: unknown }).claim;
    if (typeof claim === 'boolean') physicPaintChildAudioClaimed.value = claim;
  };
  let unlistenTauri: (() => void) | undefined;
  if (isTauriRuntime()) {
    try {
      const eventApi = await import('@tauri-apps/api/event');
      unlistenTauri = await eventApi.listen?.(PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT, (event) => accept(event.payload));
    } catch {
      // Tauri event API unavailable — the CustomEvent/postMessage fallbacks
      // below still carry the claim (same resilience idiom as the child-side
      // bridge listeners' .catch(() => undefined)).
    }
  }
  if (typeof window === 'undefined') return () => { unlistenTauri?.(); };
  const custom = (event: Event) => accept((event as CustomEvent).detail);
  const message = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || event.data?.type !== PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT) return;
    accept(event.data.payload);
  };
  window.addEventListener(PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT, custom);
  window.addEventListener('message', message);
  return () => {
    unlistenTauri?.();
    window.removeEventListener(PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT, custom);
    window.removeEventListener('message', message);
  };
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

export async function installPhysicPaintFrameSyncListener(target: Window = window): Promise<() => void> {
  if (isTauriRuntime()) {
    const eventApi = await import('@tauri-apps/api/event');
    const unlisten = await eventApi.listen?.('physic-paint:seek-frame', (event) => handlePhysicPaintFrameSyncMessage(event.payload));
    if (unlisten) return unlisten;
  }
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
    const result = await applyTransportedPhysicPaintPayload(payload);
    onResult?.(result);
    sendBrowserApplyResult(result, source);
    return result;
  };

  if (isTauriRuntime()) {
    try {
      const eventApi = await import('@tauri-apps/api/event') as TauriEventApi;
      const unlisten = await eventApi.listen?.(PHYSIC_PAINT_APPLY_EVENT, async (event) => {
        const payload = event.payload;
        const result = await applyTransportedPhysicPaintPayload(payload);
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

/**
 * D-01/rev-counter: monotonic integer revision owned by this main-side
 * publisher, bumped exactly once per publish. The SAME builder feeds both the
 * launch embed and (plan 41-03) push-on-change events, so revision ordering is
 * total across both channels. D-04: entries carry ONLY an efxasset:// protocol
 * URL — never filePath/relativePath and never raw bytes.
 */
let nextAudioPreviewRevision = 1;

export function buildPhysicPaintAudioPreviewSection(): EfxPaintAudioPreviewContext {
  const revision = nextAudioPreviewRevision++;
  return {
    revision,
    fps: projectStore.fps.peek(),
    tracks: audioStore.tracks.peek().map((track) => ({
      id: track.id,
      assetUrl: assetUrl(track.filePath),
      offsetFrame: track.offsetFrame,
      inFrame: track.inFrame,
      outFrame: track.outFrame,
      slipOffset: track.slipOffset,
      fadeInFrames: track.fadeInFrames,
      fadeOutFrames: track.fadeOutFrames,
      volume: track.volume,
      muted: track.muted,
      fadeInCurve: track.fadeInCurve,
      fadeOutCurve: track.fadeOutCurve,
    })),
  };
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
        revision: buildPhysicPaintRotoPhysicalRevision([], PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED, []),
      });
  if (storedDocument) physicPaintStore.setRotoPhysicalSelection(layerId, document.selectedKeyId, document.cursorAppFrame);
  const playbackSettings = physicPaintStore.getRotoPlaybackSettings(layerId) ?? {
    loop: false,
    fps: Math.max(1, Math.min(60, isFinitePositiveNumber(fps) ? fps : 12)),
  };
  const context: PhysicPaintLaunchContext = {
    operationId: `physic-paint-${Date.now()}-${crypto.randomUUID()}`,
    layerId,
    project: {
      name: projectStore.name.peek(),
      saved: Boolean(projectStore.filePath.peek() && projectStore.scriptLibraryAuthority.peek()),
      contextId: projectStore.projectContextId.peek(),
      ...(projectStore.scriptLibraryAuthority.peek() ? { scriptLibraryAuthority: projectStore.scriptLibraryAuthority.peek()! } : {}),
    },
    layerName: layer.name,
    ...(workflowLabel ? { workflowLabel } : {}),
    startFrame: document.cursorAppFrame,
    ...(isFinitePositiveNumber(canvas?.width) ? { width: canvas.width } : {}),
    ...(isFinitePositiveNumber(canvas?.height) ? { height: canvas.height } : {}),
    ...(isFinitePositiveNumber(fps) ? { fps } : {}),
    rotoPlayback: playbackSettings,
    // Absent section = no audio; keeps existing audio-less launches byte-stable.
    ...(audioStore.tracks.peek().length > 0 ? { audioPreview: buildPhysicPaintAudioPreviewSection() } : {}),
    rotoPhysical: {
      capacity: document.capacity,
      records: document.realKeyRecords.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame, payload: record.payload })),
      groupOverrideRecords: (document.groupOverrideRecords ?? []).map((record) => ({
        keyId: record.keyId,
        appFrame: record.appFrame,
        payload: record.payload,
      })),
      interpolationEnabled: document.interpolation.enabled,
      interpolationMode: document.interpolation.mode,
      scriptMotion: document.scriptMotion,
      background: document.background,
      selectedKeyId: document.selectedKeyId,
      cursorAppFrame: document.cursorAppFrame,
      revision: document.revision,
      loopClips: document.loopClips,
      incomingInterpolationBreakKeyIds: document.incomingInterpolationBreakKeyIds,
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

    // D-05 claim lifecycle: a (re)launched child window starts a fresh bundle
    // and holds no audio claim — clear any stale claim left behind by a
    // previous window that closed without its release event landing.
    physicPaintChildAudioClaimed.value = false;

    const tauriRuntime = await detectTauriRuntime();
    console.info('[physicPaintBridge] launch branch', tauriRuntime ? 'tauri-native-command' : 'browser-fallback', context);
    if (tauriRuntime) {
      const tauriResult = await tryOpenTauriPhysicPaintWindow(context);
      if (!tauriResult.ok) return tauriResult;
      activatePhysicalLaunchAuthority(context);
      console.info('[physicPaintBridge] native launch result', tauriResult.data);
      return { ok: true, data: context };
    }

    const browserResult = openBrowserFallback(context);
    if (!browserResult.ok) return browserResult;
    activatePhysicalLaunchAuthority(context);

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
