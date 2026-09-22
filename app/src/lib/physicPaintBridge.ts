import type { Result } from './ipc';
import { effect, signal } from '@preact/signals';
import type { Layer } from '../types/layer';
import type { EfxPaintAudioPreviewContext, PhysicPaintActionRetainedArtifactReference, PhysicPaintActionTransactionRecord, PhysicPaintApplyPayload, PhysicPaintApplyResult, PhysicPaintImageImportResult, PhysicPaintImageLibraryRequest, PhysicPaintImageLibraryResult, PhysicPaintLaunchContext, PhysicPaintProjectContextRequest, PhysicPaintRotoAuthorityRequest, PhysicPaintRotoAuthorityResult, PhysicPaintRotoInterpolationSettings, PhysicPaintRotoPhysicalEditApplyResult, PhysicPaintRotoPhysicalEditIntent, PhysicPaintRotoPhysicalEditRecord, PhysicPaintRotoPhysicalEditSemanticDelta, PhysicPaintRotoPhysicalEditOperationKind, PhysicPaintScriptLibraryResult, PhysicPaintStateSaveRequest, PhysicPaintStateSaveResult } from '../types/physicPaint';
import { PHYSIC_PAINT_MAX_APPLY_FRAMES, PHYSIC_PAINT_PROJECT_CONTEXT_MAX_LAYER_NAME_LENGTH, buildFrameBytesToken, isPhysicPaintApplyPayload, isPhysicPaintFrameSyncMessage, isPhysicPaintImageImportRequest, isPhysicPaintImageImportResult, isPhysicPaintImageLibraryRequest, isPhysicPaintImageLibraryResult, isPhysicPaintProjectContextRequest, isPhysicPaintRotoAuthorityRequest, isPhysicPaintRotoPhysicalEditApplyPayload, isPhysicPaintRotoPhysicalEditRecordRef, isPhysicPaintScriptLibraryRequest, isWebpBytes, serializePhysicPaintRotoPhysicalEditIntent } from '../types/physicPaint';
import { base64ToWebpBytes, fromTransportPayload, sha256HexBytes, toTransportPayload } from './webpBytes';
import { buildBytesPayload } from './efxPaintMediaMaterialize';
import { recordPhysicsPaintPerformance } from '../components/physic-paint/performance/physicsPaintPerformanceTrace';
import type { MceImageRef } from '../types/project';
import { GENERATED_ROTO_RENDER_ONLY_STATUS_TEMPLATE } from '../components/physic-paint/roto/physicsPaintRotoKeyController';
import {
  buildCanonicalMoveGroupOverrideRecords,
  resolvePhysicPaintRotoPhysicalEdit,
  validatePhysicPaintRotoPhysicalEditSemanticDelta,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalResolver';
import { prepareRotoPhysicalRealKeyFrames } from '../components/physic-paint/roto/rotoCanvasFrames';
import {
  PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED,
  PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO,
  buildPhysicPaintRotoPhysicalRevision,
  buildPhysicPaintRotoPayloadContentToken,
  buildPhysicPaintRotoProjectEquality,
  canonicalizePhysicPaintRotoLoopClips,
  encodePhysicPaintRotoPhysicalContent,
  parsePhysicPaintRotoIncomingInterpolationBreakKeyIds,
  parsePhysicPaintRotoLoopClips,
  parsePhysicPaintRotoPhysicalDocument,
  parsePhysicPaintRotoRealKeyRecordCollection,
  type PhysicPaintRotoInterpolationState,
  type PhysicPaintRotoLoopClip,
  type PhysicPaintRotoPhysicalDocument,
  requirePhysicPaintRotoInlineBytes,
  type PhysicPaintRotoRealKeyPayload,
  type PhysicPaintRotoRealKeyRecord,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import {
  classifyPhysicPaintRotoGroupFrameTarget,
  proposePhysicPaintRotoActionGroupLifecycle,
  proposePhysicPaintRotoDeleteGroup,
  proposePhysicPaintRotoDeleteGroupFrame,
  proposePhysicPaintRotoDeleteRails,
  proposePhysicPaintRotoGroupFramePaint,
  proposePhysicPaintRotoRegenerateGroup,
  type PhysicPaintRotoActionGroupLifecycleImpact,
  type PhysicPaintRotoGroupFramePaintImpact,
} from '../components/physic-paint/roto/physicsPaintRotoGroupLifecycle';
import { proposeRails } from '../components/physic-paint/roto/physicsPaintRotoRailSetCopy';
import { parseCanonicalPhysicsPaintLaunchValue } from '../components/physic-paint/bridge/physicsPaintLaunchContext';
import { parseEfxPaintDocument } from '../efx-paint/document/efxPaintDocumentParsers';
import { getCarriedRotoPhysical } from '../components/physic-paint/roto/rotoLaunchHydration';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import {
  buildEfxPaintDocumentRevision,
  buildEfxPaintDocumentSyncFingerprint,
  buildEfxPaintTrackRevision,
} from '../efx-paint/document/efxPaintDocumentRevision';
import { getDocument as getEfxPaintDocument, registerDocument as registerEfxPaintDocument } from '../stores/efxPaintStore';
import { layerStore } from '../stores/layerStore';
import { audioStore } from '../stores/audioStore';
import {
  physicPaintStore,
  hasFrameMediaBytes,
  installFrameMediaBytes,
  registerBackgroundSourceImage,
  type PhysicPaintRotoPhysicalOperationLeaseToken,
} from '../stores/physicPaintStore';
import { encodeCanvasAsWebp } from './webpFrameCodec';
import { sequenceStore } from '../stores/sequenceStore';
import { timelineStore } from '../stores/timelineStore';
import { projectStore } from '../stores/projectStore';
import { imageStore } from '../stores/imageStore';
import { tempProjectDir } from './projectDir';
import { resolveSequenceTimelineRange, trackLayouts } from './frameMap';
import { assetUrl, scriptLibraryDelete, scriptLibraryLoad, scriptLibraryRename, scriptLibrarySave, scriptLibraryScan } from './ipc';

export const PHYSIC_PAINT_LAUNCH_EVENT = 'physic-paint:launch';
export const PHYSIC_PAINT_PROJECT_CONTEXT_EVENT = 'physic-paint:project-context';
/**
 * quick-260922-al1: the child→main project-context request. The mounted Studio
 * webview is a FRESH realm on every launch (the reused window is navigated,
 * lib.rs:186), and the publisher above only fires at project bind/clear
 * (`projectStore.ts:106-121`) — i.e. BEFORE the Studio window exists. So a
 * Studio opened later PULLS: `{ operationId, scriptScope? }` out, the validated
 * payload back on PHYSIC_PAINT_PROJECT_CONTEXT_EVENT. An absent `scriptScope`
 * is a read-only republish (the mount pull never writes the main realm's scope).
 */
export const PHYSIC_PAINT_PROJECT_CONTEXT_REQUEST_EVENT = 'physic-paint:project-context-request';
/** Bounded wait for the republished context; a missing receiver never hangs the caller. */
const PHYSIC_PAINT_PROJECT_CONTEXT_REQUEST_TIMEOUT_MS = 5_000;
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
/**
 * 47-01: child→main EFX Paint document sync. The Studio window owns its own
 * efxPaintStore; track CRUD happens there. The child pushes its current
 * document on every document mutation so the main window's efxPaintStore (the
 * save path's serialization authority) never lags the child's track list.
 */
export const PHYSIC_PAINT_EFX_PAINT_DOCUMENT_EVENT = 'physic-paint:efx-paint-document';
export const PHYSIC_PAINT_SCRIPT_LIBRARY_REQUEST_EVENT = 'physic-paint:script-library-request';
export const PHYSIC_PAINT_SCRIPT_LIBRARY_RESULT_EVENT = 'physic-paint:script-library-result';
export const PHYSIC_PAINT_ROTO_AUTHORITY_REQUEST_EVENT = 'physic-paint:roto-authority-request';
export const PHYSIC_PAINT_ROTO_AUTHORITY_RESULT_EVENT = 'physic-paint:roto-authority-result';
export const PHYSIC_PAINT_STATE_SAVE_REQUEST_EVENT = 'physic-paint:state-save-request';
export const PHYSIC_PAINT_STATE_SAVE_RESULT_EVENT = 'physic-paint:state-save-result';
/**
 * 49-04 (Task 1): the image-library request/result pair that fills the Studio
 * realm's empty imageStore (Pitfall 2). The Studio webview requests
 * `{ images: MceImageRef[], projectDir: string }` from the main webview — the
 * authoritative imageStore realm — so the scoped asset picker can render the
 * project library and legally import new images inside it (Pitfall 3).
 */
export const PHYSIC_PAINT_IMAGE_LIBRARY_REQUEST_EVENT = 'physic-paint:image-library-request';
export const PHYSIC_PAINT_IMAGE_LIBRARY_RESULT_EVENT = 'physic-paint:image-library-result';
/**
 * quick-260921-bjm: the image-import request/result pair. The picker's Import
 * used to run in the Studio realm, writing THAT realm's imageStore module
 * instance — never the main webview's, the only one `projectStore.buildMceProject`
 * reads for the persisted manifest `images` array. The child names the
 * dialog-selected PATHS only, the main realm resolves its OWN destination
 * directory and performs the import, and answers with the post-import library.
 * Existing save/open/hydration then carries the record (no format change).
 */
export const PHYSIC_PAINT_IMAGE_IMPORT_REQUEST_EVENT = 'physic-paint:image-import-request';
export const PHYSIC_PAINT_IMAGE_IMPORT_RESULT_EVENT = 'physic-paint:image-import-result';
/**
 * 52.2-10 (D-12): main→Studio frame-media request. With the document crossing
 * reference-shaped, the main window is the receiving side of the digest-keyed
 * byte channel; when it lacks content (a reloaded window, a fresh install) it
 * names the digests it needs on this event rather than forcing a full re-ship
 * (T-52.2-35 — the request is per digest, never the whole document).
 */
export const PHYSIC_PAINT_FRAME_MEDIA_REQUEST_EVENT = 'physic-paint:frame-media-request';

/**
 * Structural twin of usePhysicsPaintParentBridge's PhysicsPaintBridgeMode —
 * declared here (not imported) so physicPaintBridge never imports from the
 * component layer, which would create a circular import.
 */
export type PhysicsPaintBridgeMode = 'Tauri' | 'Browser fallback' | 'Unavailable';

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
  /** Native display-sleep assertion held for the paint window's lifetime. */
  displaySleepAsserted: boolean;
}

function shouldCloseNativeWindowAfterApply(payload: PhysicPaintApplyPayload): boolean {
  return payload.kind === 'apply-canvas' && payload.closeWindowAfterApply === true;
}

const APPLY_ERROR = 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame.';
const deliveredOperations = new Map<string, { fingerprint: string; result: PhysicPaintApplyResult }>();
const activeLaunchOperationByLayer = new Map<string, string>();

/**
 * True while a Standalone paint child session is open. The main app's Preview
 * gates its full-canvas recomposite on this: while the child owns the paint
 * surface the main canvas holds its last frame instead of re-flattening +
 * decoding + uploading 8.3MB per child push — the fresh-key GPU-process
 * saturation that froze the child's 2nd stroke (52.1). Cleared when the child
 * window closes (apply-with-close or window close).
 */
export const physicPaintLaunchActive = signal(false);

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
  const capacity = getCarriedRotoPhysical(context)?.capacity
    ?? physicPaintStore.getRotoPhysicalCapacity(context.layerId, context.document?.activeTrackId ?? '');
  for (const [operationId, entry] of acceptedPhysicalCommands) {
    if (entry.projectContextId !== projectContextId
      || (entry.layerId === context.layerId
        && (entry.launchOperationId !== context.operationId || entry.capacity !== capacity))) {
      acceptedPhysicalCommands.delete(operationId);
    }
  }
  activeLaunchOperationByLayer.set(context.layerId, context.operationId);
  physicPaintLaunchActive.value = true;
}

/** Clear the child-session gate (see physicPaintLaunchActive) — idempotent. */
export function deactivatePhysicPaintLaunch(): void {
  // 52.1 (close-settle): the Studio's frame-sync seeks only currentFrame (the
  // playhead); the main Preview renders displayFrame. Settle displayFrame onto
  // the synced cursor BEFORE clearing the gate — the same law the playback
  // engine applies on stop — so the first ungated re-render draws the frame
  // the playhead shows, not the pre-session frame (the close-stale defect).
  timelineStore.syncDisplayFrame();
  physicPaintLaunchActive.value = false;
}

function cloneAndDeepFreezePlainData<T>(value: T): T {
  const clone = structuredClone(value);
  const freeze = (candidate: unknown): void => {
    if (candidate === null || typeof candidate !== 'object' || Object.isFrozen(candidate)) return;
    // 52.1 (D-05): frame bytes are a Uint8Array — array buffer views with
    // elements cannot be frozen. They are already immutable-by-convention after
    // structuredClone, so skip them rather than throwing.
    if (candidate instanceof Uint8Array || candidate instanceof ArrayBuffer) return;
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
    // 260921-c7x: the ledger stores ONE clip shape. A `before` snapshot reads
    // the store (a lifecycle-less Infinity clip) while the matching `after`
    // snapshot reads the staged document (normalized) — comparing the two raw
    // made a faithful Undo/Redo source reject with 'replay source snapshot does
    // not match the original accepted command'. Both sides resolve through the
    // shared lifecycle authority instead.
    loopClips: canonicalizePhysicPaintRotoLoopClips(input.loopClips),
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

// 46 UAT debug hook: field-level diff of a rejected replay-target snapshot.
// Gated off by default; enable from the MAIN window console via
// window.__setDebugReplayDiff(true).
let debugReplayDiff = false;
export function setDebugReplayDiff(enabled: boolean): void {
  debugReplayDiff = enabled;
}

function debugReplaySnapshotDiff(
  proposed: AcceptedPhysicalCommandSnapshot,
  expected: AcceptedPhysicalCommandSnapshot,
): void {
  if (!debugReplayDiff) return;
  const failures: string[] = [];
  if (proposed.capacity !== expected.capacity) failures.push(`capacity ${proposed.capacity} != ${expected.capacity}`);
  if (proposed.revision !== expected.revision) failures.push(`revision ${proposed.revision} != ${expected.revision}`);
  if (proposed.cursorAppFrame !== expected.cursorAppFrame) failures.push(`cursor ${proposed.cursorAppFrame} != ${expected.cursorAppFrame}`);
  if (proposed.selectedKeyId !== expected.selectedKeyId) failures.push(`selectedKeyId ${proposed.selectedKeyId} != ${expected.selectedKeyId}`);
  if (proposed.selectedAppFrame !== expected.selectedAppFrame) failures.push(`selectedAppFrame ${proposed.selectedAppFrame} != ${expected.selectedAppFrame}`);
  if (proposed.interpolation.enabled !== expected.interpolation.enabled
    || proposed.interpolation.mode !== expected.interpolation.mode) {
    failures.push(`interpolation ${JSON.stringify(proposed.interpolation)} != ${JSON.stringify(expected.interpolation)}`);
  }
  if (proposed.records.length !== expected.records.length) {
    failures.push(`records length ${proposed.records.length} != ${expected.records.length}`);
  } else {
    for (let i = 0; i < proposed.records.length; i += 1) {
      if (stableSerialize(proposed.records[i], new WeakSet<object>()) !== stableSerialize(expected.records[i], new WeakSet<object>())) {
        failures.push(`records[${i}] ${proposed.records[i].keyId}@${proposed.records[i].appFrame} differs`);
        break;
      }
    }
  }
  if (proposed.loopClips.length !== expected.loopClips.length) {
    failures.push(`loopClips length ${proposed.loopClips.length} != ${expected.loopClips.length}`);
  } else {
    for (let i = 0; i < proposed.loopClips.length; i += 1) {
      if (stableSerialize(proposed.loopClips[i], new WeakSet<object>()) !== stableSerialize(expected.loopClips[i], new WeakSet<object>())) {
        failures.push(`loopClips[${i}] ${proposed.loopClips[i]?.loopId} differs`);
        break;
      }
    }
  }
  if (proposed.incomingInterpolationBreakKeyIds.length !== expected.incomingInterpolationBreakKeyIds.length) {
    failures.push(`breaks length ${proposed.incomingInterpolationBreakKeyIds.length} != ${expected.incomingInterpolationBreakKeyIds.length}`);
  } else {
    for (let i = 0; i < proposed.incomingInterpolationBreakKeyIds.length; i += 1) {
      if (proposed.incomingInterpolationBreakKeyIds[i] !== expected.incomingInterpolationBreakKeyIds[i]) {
        failures.push(`breaks[${i}] ${proposed.incomingInterpolationBreakKeyIds[i]} != ${expected.incomingInterpolationBreakKeyIds[i]}`);
        break;
      }
    }
  }
  console.warn(`[replay-diff] replay target mismatch: ${failures.join(' | ') || 'unknown-field'}`);
}

export async function applyPhysicPaintPayload(payload: unknown): Promise<PhysicPaintApplyResult> {
  return applyPhysicPaintPayloadWithPublicationLease(payload);
}

async function applyPhysicPaintPayloadWithPublicationLease(
  payload: unknown,
  publicationLeaseToken?: PhysicPaintRotoPhysicalOperationLeaseToken,
): Promise<PhysicPaintApplyResult> {
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
      result = await physicPaintStore.applyCanvas(payload);
      if (result.ok && payload.renderedFrame.bytes instanceof Uint8Array) {
        // 52.2-10 (D-12): the receiver materialized this raster, so its content
        // digest is now receiver-held — the same claim the Studio's coordinator
        // marks on its side. A later document sync answers "already held"
        // instead of re-shipping the bytes (T-52.2-35).
        const appliedBytes = payload.renderedFrame.bytes;
        trackDocumentSyncFrameInstall(
          sha256HexBytes(appliedBytes).then((digest) =>
            (_documentSyncFramePorts ?? _defaultDocumentSyncFramePorts).install(digest, appliedBytes)),
        );
      }
    } else if (payload.kind === 'update-roto-interpolation-settings') {
      const generatedFrames = await physicPaintStore.setRotoInterpolationSettings(payload.layerId, payload.trackId, payload.settings);
      result = successResult(payload, generatedFrames.length);
    } else if (payload.kind === 'update-roto-playback-settings') {
      const changed = physicPaintStore.setRotoPlaybackSettings(payload.layerId, payload.trackId, payload.settings);
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
          trackId: payload.trackId,
        });
        if (!authority.ok) return applyFailureResult(payload, authority.error ?? 'Roto authority rejected the batch.');
        // 46-04 Task 2: capture-then-revalidate commit gate (T-46-10) — the
        // commit lands on the captured payload.trackId, never the live active
        // track; every captured deterministic term (trackId, trackRevision,
        // documentRevision) must revalidate against the current authority.
        if (
          authority.layerEndExclusive !== payload.expectedLayerEndExclusive ||
          authority.rotoRevision !== payload.expectedRotoRevision ||
          authority.trackId !== payload.trackId ||
          (payload.expectedTrackRevision !== undefined && authority.trackRevision !== payload.expectedTrackRevision) ||
          (payload.expectedDocumentRevision !== undefined && authority.documentRevision !== payload.expectedDocumentRevision)
        ) {
          return applyFailureResult(payload, 'Roto authority became stale before commit.');
        }
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
      result = await physicPaintStore.replaceRotoKeyFrames(payload);
    } else if (payload.kind === 'replace-roto-physical-map') {
      result = await applyPhysicPaintRotoPhysicalMap(payload, publicationLeaseToken);
    } else {
      result = applyFailureResult(payload, 'Unsupported physics paint payload');
    }
    if (result.ok) deliveredOperations.set(payload.operationId, { fingerprint, result });
    return result.ok ? result : { ...result, error: `${APPLY_ERROR} ${result.error ?? ''}`.trim() };
  } catch (error) {
    return applyFailureResult(payload, `${APPLY_ERROR} ${String(error)}`);
  }
}

/**
 * 52.1 (Part 2): unchanged real-key records may cross the bridge as
 * content-token refs ({ keyId, appFrame, refToken }) in place of full byte
 * payloads. Resolve them against the parent store before validation — the
 * payload's expectedRevision gate guarantees the parent holds exactly these
 * bytes. A missing key or token mismatch fails closed (the store and the
 * document are never touched by a half-resolved records list).
 */
export function expandRotoPhysicalEditRecordRefs(payload: unknown): { payload: unknown } | { error: string } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { payload };
  const candidate = payload as Record<string, unknown>;
  if (candidate.kind !== 'replace-roto-physical-map') return { payload };
  if (!Array.isArray(candidate.records) || !candidate.records.some(isPhysicPaintRotoPhysicalEditRecordRef)) return { payload };
  if (typeof candidate.layerId !== 'string' || candidate.layerId.length === 0
    || typeof candidate.trackId !== 'string' || candidate.trackId.length === 0) return { payload };
  const layerId = candidate.layerId;
  const trackId = candidate.trackId;
  const expanded: unknown[] = [];
  for (const entry of candidate.records) {
    if (!isPhysicPaintRotoPhysicalEditRecordRef(entry)) {
      expanded.push(entry);
      continue;
    }
    const current = physicPaintStore.getRotoRealKeyRecord(layerId, trackId, entry.keyId);
    if (!current) return { error: `Roto physical record ref "${entry.keyId}" is unknown to the parent document.` };
    if (buildPhysicPaintRotoPayloadContentToken(current.payload) !== entry.refToken) {
      return { error: `Roto physical record ref "${entry.keyId}" no longer matches the parent document content.` };
    }
    expanded.push({ keyId: entry.keyId, appFrame: entry.appFrame, payload: { ...current.payload, appFrame: entry.appFrame } });
  }
  return { payload: { ...candidate, records: expanded } };
}

async function applyPreparedPhysicPaintPayload(
  payload: unknown,
  publicationLeaseToken?: PhysicPaintRotoPhysicalOperationLeaseToken,
): Promise<PhysicPaintApplyResult> {
  const expanded = expandRotoPhysicalEditRecordRefs(payload);
  if ('error' in expanded) {
    return applyFailureResult(payload as PhysicPaintApplyPayload, expanded.error);
  }
  payload = expanded.payload;
  if (!isPhysicPaintRotoPhysicalEditApplyPayload(payload)) return applyPhysicPaintPayload(payload);
  const preparedTokens = new Set(payload.records.map((record) => buildPhysicPaintRotoPayloadContentToken(record.payload)));
  try {
    await prepareRotoPhysicalRealKeyFrames(payload.records);
  } catch (error) {
    physicPaintStore.pruneUnreferencedRotoAlphaCanvases(preparedTokens);
    return applyFailureResult(
      payload,
      error instanceof Error ? error.message : 'Canonical Roto PNG preparation failed.',
    );
  }
  const result = await applyPhysicPaintPayloadWithPublicationLease(
    payload,
    publicationLeaseToken,
  );
  if (!result.ok) physicPaintStore.pruneUnreferencedRotoAlphaCanvases(preparedTokens);
  return result;
}

async function applyTransportedPhysicPaintPayload(
  payload: unknown,
): Promise<PhysicPaintApplyResult> {
  // 52.1 (D-05): the child serialized frame bytes as base64 (emitTo JSON turns
  // Uint8Array into index objects). Decode the canonical base64 `bytes` fields
  // back to Uint8Array before validation/handling so the in-memory payload
  // shape matches the direct (non-transported) apply path.
  payload = fromTransportPayload(payload);
  // 52.1 (Part 2): expand wire record refs BEFORE the physical-kind check — a
  // compacted payload must take the same lease-gated branch as a full one (a
  // ref shape is invalid in memory by contract, so it would otherwise detour
  // around lease acquisition and be rejected with mismatched-token). On a ref
  // resolution failure the unexpanded payload falls through to
  // applyPreparedPhysicPaintPayload, which re-attempts and fails closed.
  {
    const expansion = expandRotoPhysicalEditRecordRefs(payload);
    if (!('error' in expansion)) payload = expansion.payload;
  }
  if (!isPhysicPaintRotoPhysicalEditApplyPayload(payload)) {
    return applyPreparedPhysicPaintPayload(payload);
  }

  const submittedLeaseToken = payload.leaseToken!;
  if (
    payload.projectContextId !== projectStore.projectContextId.peek()
    || submittedLeaseToken.projectContextId !== payload.projectContextId
    || submittedLeaseToken.layerId !== payload.layerId
    || submittedLeaseToken.trackId !== payload.trackId
  ) {
    return applyPreparedPhysicPaintPayload(payload);
  }

  const publicationLeaseToken =
    physicPaintStore.acquireRotoPhysicalOperationLease(
      payload.projectContextId,
      payload.layerId,
      payload.trackId,
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
  const failure = (error: string, revisionTerms?: { trackRevision: string; documentRevision: string }): PhysicPaintRotoAuthorityResult => ({
    operationId: request.operationId,
    ok: false,
    projectContextId: request.projectContextId,
    layerId: request.layerId,
    canonicalStart: request.canonicalStart,
    trackId: request.trackId,
    trackRevision: revisionTerms?.trackRevision ?? '',
    documentRevision: revisionTerms?.documentRevision ?? '',
    layerEndExclusive: request.canonicalStart,
    capacity: 0,
    physicalCapacity: 0,
    rotoRevision: '',
    physicalRevision: '',
    physicalRecords: [],
    interpolationEnabled: false,
    interpolationMode: 'duplicate',
    frames: [],
    interpolationSettings: physicPaintStore.getRotoInterpolationSettings(request.layerId, request.trackId),
    error,
  });
  if (request.projectContextId !== projectStore.projectContextId.peek()) return failure('Project context changed.');
  const layer = [...layerStore.layers.peek(), ...layerStore.overlayLayers.peek()].find((candidate) => candidate.id === request.layerId || (candidate.type === 'physic-paint' && candidate.source.type === 'physic-paint' && candidate.source.layerId === request.layerId));
  if (!layer || layer.type !== 'physic-paint') return failure('Physics Paint layer is unavailable.');
  if (!Number.isInteger(request.canonicalStart) || request.canonicalStart < 0) return failure('Canonical Roto start is invalid.');
  // 46-04: the document then track dimensions — the authority revalidates the
  // requested track against the parent document before any per-track read
  // (D-20 fail closed, edge TRK-06 empty). No active-track fallback, no
  // auto-create: a trackId outside document.tracks is a closed failure.
  const document = getEfxPaintDocument(request.layerId);
  if (!document) return failure('Track is unavailable.');
  const track = document.tracks.find((candidate) => candidate.id === request.trackId);
  if (!track) {
    return failure('Track is unavailable.', { trackRevision: '', documentRevision: buildEfxPaintDocumentRevision(document) });
  }
  const trackId = request.trackId;
  const physicalCapacity = physicPaintStore.getRotoPhysicalCapacity(request.layerId, trackId);
  // The child document's single end authority is the physical capacity
  // (43.4 defect 1): the stale main-editor display outFrame never clamps
  // physics-paint content, so the authority remaining is capacity-based.
  const parentTimelineRange = getLayerLocalTimelineRange(layer);
  const physicalRemaining = physicalCapacity - request.canonicalStart;
  if (parentTimelineRange === null || physicalRemaining <= 0) return failure('No remaining Physics Paint sequence capacity is available.');
  const capacity = Math.min(physicalRemaining, PHYSIC_PAINT_MAX_APPLY_FRAMES);
  const records = physicPaintStore.getRotoRealKeyRecords(request.layerId, trackId);
  const groupOverrideRecords = physicPaintStore.getRotoGroupOverrideRecords(request.layerId, trackId);
  const interpolation = physicPaintStore.getRotoPhysicalInterpolationState(request.layerId, trackId);
  const loopClips = physicPaintStore.getRotoPhysicalLoopClips(request.layerId, trackId);
  const incomingInterpolationBreakKeyIds = physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(request.layerId, trackId);
  const physicalRevision = buildPhysicPaintRotoPhysicalRevision(
    records,
    interpolation,
    loopClips,
    incomingInterpolationBreakKeyIds,
    groupOverrideRecords,
  );
  const physicalRecords = records.map((record) => ({
    keyId: record.keyId,
    appFrame: record.appFrame,
    payload: record.payload,
  }));
  // 52.2-02 (D-07): the wire `frames` projection is a runtime shape and needs
  // pixels, so the inline carrier is asserted here. A reference-only record
  // never reaches this path — the packed document is built from runtime records.
  const frames = records.map((record) => ({
    ...record.payload,
    bytes: requirePhysicPaintRotoInlineBytes(record.payload),
    source: 'real-key' as const,
  }));
  return {
    operationId: request.operationId,
    ok: true,
    projectContextId: request.projectContextId,
    layerId: request.layerId,
    canonicalStart: request.canonicalStart,
    trackId,
    trackRevision: buildEfxPaintTrackRevision(track),
    documentRevision: buildEfxPaintDocumentRevision(document),
    layerEndExclusive: request.canonicalStart + capacity,
    capacity,
    physicalCapacity,
    rotoRevision: physicalRevision,
    physicalRevision,
    physicalRecords,
    interpolationEnabled: interpolation.enabled,
    interpolationMode: interpolation.mode,
    frames,
    interpolationSettings: physicPaintStore.getRotoInterpolationSettings(request.layerId, trackId),
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
    return { operationId: '', projectContextId: '', layerId: '', canonicalStart: 0, trackId: '' };
  }
  const record = payload as Record<string, unknown>;
  return {
    operationId: typeof record.operationId === 'string' ? record.operationId : '',
    projectContextId: typeof record.projectContextId === 'string' ? record.projectContextId : '',
    layerId: typeof record.layerId === 'string' ? record.layerId : '',
    canonicalStart: typeof record.canonicalStart === 'number' && Number.isInteger(record.canonicalStart) && record.canonicalStart >= 0 ? record.canonicalStart : 0,
    trackId: typeof record.trackId === 'string' ? record.trackId : '',
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
    trackId: fields.trackId,
    trackRevision: '',
    documentRevision: '',
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
  // 52.1 (D-05): frame bytes are a Uint8Array — structured-cloneable, but not a
  // plain record. Accept it so the bytes-token payload passes the clone guard.
  if (value instanceof Uint8Array) return true;
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
  // 52.1 (D-05): frame bytes are a Uint8Array. Serializing them as a plain
  // object (Object.keys → sort → per-byte JSON.stringify) is O(n log n) and
  // blows past the 5s apply timeout for photo-weight frames. Fingerprint by the
  // O(1) content token instead — same content, same token (G-52-6).
  if (value instanceof Uint8Array) return buildFrameBytesToken(value);
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

/**
 * 260921-c7x: structural Loop Clip comparison across the store/wire boundary.
 *
 * The store may hold a lifecycle-less clip — an Infinity clip, which parse
 * deliberately refuses to hydrate — while every bridge payload ships the same
 * clip normalized to a complete lifecycle. Both describe ONE clip, so any
 * comparison between a store-derived and a wire-derived collection runs through
 * the shared lifecycle authority (`resolvePhysicPaintRotoLoopClipLifecycle`)
 * instead of rejecting a faithful edit on shape alone.
 */
function sameCanonicalLoopClips(
  left: readonly PhysicPaintRotoLoopClip[],
  right: readonly PhysicPaintRotoLoopClip[],
): boolean {
  return stableSerialize(canonicalizePhysicPaintRotoLoopClips(left), new WeakSet<object>())
    === stableSerialize(canonicalizePhysicPaintRotoLoopClips(right), new WeakSet<object>());
}

function sameDurableRealKey(left: PhysicPaintRotoAuthorityResult['frames'][number], right: PhysicPaintRotoAuthorityResult['frames'][number]): boolean {
  return (left.sourceFrame ?? left.appFrame) === (right.sourceFrame ?? right.appFrame)
    && left.appFrame === right.appFrame
    && left.frameIndex === right.frameIndex
    && buildFrameBytesToken(left.bytes) === buildFrameBytesToken(right.bytes)
    && left.width === right.width
    && left.height === right.height
    && left.source === right.source
    && left.nearestRealKeyFrame === right.nearestRealKeyFrame
    && left.displayFrame === right.displayFrame
    && left.fromSourceFrame === right.fromSourceFrame
    && left.toSourceFrame === right.toSourceFrame
    && left.interpolationT === right.interpolationT
    && left.backgroundOnly === right.backgroundOnly
    && ((left as { onionBytes?: Uint8Array }).onionBytes === undefined) === ((right as { onionBytes?: Uint8Array }).onionBytes === undefined);
}

function samePhysicalRecord(
  left: import('../components/physic-paint/roto/physicsPaintRotoPhysicalModel').PhysicPaintRotoRealKeyRecord,
  right: import('../components/physic-paint/roto/physicsPaintRotoPhysicalModel').PhysicPaintRotoRealKeyRecord,
): boolean {
  return left.keyId === right.keyId
    && left.appFrame === right.appFrame
    && left.payload.frameIndex === right.payload.frameIndex
    && left.payload.appFrame === right.payload.appFrame
    && buildPhysicPaintRotoPayloadContentToken(left.payload) === buildPhysicPaintRotoPayloadContentToken(right.payload)
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
      && buildPhysicPaintRotoPayloadContentToken(record.payload) === buildPhysicPaintRotoPayloadContentToken(candidate.payload)
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
  readonly parentEndExclusive: number;
  readonly capacity: number;
  readonly stagedRevision: string;
}): string | null {
  const canonicalResolution = resolvePhysicPaintRotoPhysicalEdit({
    identities: input.currentRecords.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
    records: input.currentRecords,
    intent: input.intent,
    parentEndExclusive: input.parentEndExclusive,
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
  const canonicalGroupOverrideRecords = input.intent.kind === 'move-group'
    ? buildCanonicalMoveGroupOverrideRecords({
        currentLoopClips: input.currentLoopClips,
        stagedLoopClips: canonicalLoopClips,
        currentGroupOverrideRecords: input.currentGroupOverrideRecords,
        movedLoopId: input.intent.loopId,
        capacity: input.capacity,
      })
    : input.currentGroupOverrideRecords;
  if (canonicalGroupOverrideRecords === null) {
    return 'Submitted physical document does not match the canonical parent-resolved edit.';
  }
  const canonicalIncomingInterpolationBreakKeyIds = proposal.nextIncomingInterpolationBreakKeyIds
    ?? input.currentIncomingInterpolationBreakKeyIds;
  const canonicalRevision = buildPhysicPaintRotoPhysicalRevision(
    canonicalRecords,
    input.currentInterpolation,
    canonicalLoopClips,
    canonicalIncomingInterpolationBreakKeyIds,
    canonicalGroupOverrideRecords,
  );
  if (!sameCompletePhysicalRecords(canonicalRecords, input.proposedRecords)
    || !sameCompletePhysicalRecords(canonicalGroupOverrideRecords, input.proposedGroupOverrideRecords)
    || !sameCanonicalLoopClips(canonicalLoopClips, input.proposedLoopClips)
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

async function isCanonicalBlankRotoPayload(
  payload: import('../components/physic-paint/roto/physicsPaintRotoPhysicalModel').PhysicPaintRotoRealKeyPayload,
  destinationAppFrame: number,
): Promise<boolean> {
  // 52.2-02 (D-07): a blank-delta check compares pixels, so a reference-only
  // payload (which carries none) cannot be the canonical blank frame.
  const payloadBytes = payload.bytes;
  if (payloadBytes === undefined
    || payload.frameIndex !== 0
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
    const blankBytes = await encodeCanvasAsWebp(canvas);
    return buildFrameBytesToken(payloadBytes) === buildFrameBytesToken(blankBytes);
  } catch {
    return false;
  }
}

async function validateInsertEmptySegmentPhysicalDelta(input: {
  readonly payload: Extract<PhysicPaintApplyPayload, { kind: 'replace-roto-physical-map' }>;
  readonly currentRecords: readonly import('../components/physic-paint/roto/physicsPaintRotoPhysicalModel').PhysicPaintRotoRealKeyRecord[];
  readonly proposedRecords: readonly import('../components/physic-paint/roto/physicsPaintRotoPhysicalModel').PhysicPaintRotoRealKeyRecord[];
  readonly currentLoopClips: readonly PhysicPaintRotoLoopClip[];
  readonly proposedLoopClips: readonly PhysicPaintRotoLoopClip[];
  readonly currentIncomingInterpolationBreakKeyIds: readonly string[];
  readonly proposedIncomingInterpolationBreakKeyIds: readonly string[];
  readonly capacity: number;
}): Promise<string | null> {
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
  if (!inserted || !(await isCanonicalBlankRotoPayload(inserted.payload, delta.destinationAppFrame))) {
    return 'Empty-segment insert must carry the canonical blank Paint payload.';
  }
  if (!sameCanonicalLoopClips(proposedLoopClips, currentLoopClips)) {
    return 'Empty-segment insert must preserve Loop Clips exactly.';
  }
  // Quick 260816-tv7: Insert connects — the inserted key adds no incoming break
  // and any existing break on the right segment survives, so the collection
  // must be preserved exactly.
  if (proposedIncomingInterpolationBreakKeyIds.length !== currentIncomingInterpolationBreakKeyIds.length
    || proposedIncomingInterpolationBreakKeyIds.some((keyId, index) => keyId !== currentIncomingInterpolationBreakKeyIds[index])) {
    return 'Empty-segment insert must preserve incoming interpolation breaks exactly.';
  }
  const projectedTarget = physicPaintStore.getRotoCacheFrames(payload.layerId, payload.trackId)
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
  // Same capacity authority as getPhysicPaintRotoAuthority (43.4 defect 1):
  // the play-script expected end derives from the child document capacity,
  // never the stale main-editor display outFrame.
  const parentTimelineRange = getLayerLocalTimelineRange(layer);
  const remainingCapacity = parentTimelineRange === null
    ? null
    : capacity - delta.affectedStartAppFrame;
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
    if (!proposed || !isWebpBytes(proposed.payload.bytes)) return 'Play Script is missing a valid WebP destination record.';
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
        ? physicPaintStore.getRotoGroupOverrideRecords(payload.layerId, payload.trackId)
        : payload.groupOverrideRecords.map((record) => ({ kind: 'real-key' as const, ...record }));
      stagedRevision = buildPhysicPaintRotoPhysicalRevision(records, {
        enabled: payload.interpolationEnabled,
        mode: payload.interpolationMode,
      }, payload.loopClips ?? physicPaintStore.getRotoPhysicalLoopClips(payload.layerId, payload.trackId),
      payload.incomingInterpolationBreakKeyIds
        ?? physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(payload.layerId, payload.trackId),
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
  'delete-rails',
  'paste',
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
    if (!current || !proposed || proposed.appFrame !== current.appFrame || !isWebpBytes(proposed.payload.bytes)) {
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
  const isDeleteRails = payload.operationKind === 'delete-rails';
  const isRailSetPaste = payload.operationKind === 'paste';
  const operationLabel = isDeleteRails ? 'Delete Rails'
    : isRailSetPaste ? 'Rail-set paste/duplicate'
    : 'Group lifecycle';
  if (!currentDocument) return `${operationLabel} edit requires one current physical document.`;
  const delta = payload.semanticDelta;
  if (!delta || delta.kind !== payload.operationKind) {
    return `${operationLabel} semantic delta does not match the operation kind.`;
  }
  if (payload.intent !== undefined || payload.historyProvenance !== undefined) {
    return `${operationLabel} edits cannot carry ordinary intent or replay provenance.`;
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
    | ReturnType<typeof proposePhysicPaintRotoDeleteRails>
    | ReturnType<typeof proposeRails>
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
    if (!overrideRecord || overrideRecord.appFrame !== delta.phaseAppFrame) {
      return 'Group Paint override record does not match the declared source phase.';
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
  } else if (delta.kind === 'delete-rails') {
    recomputed = proposePhysicPaintRotoDeleteRails({
      document: targetDocument,
      members: delta.members,
    });
  } else if (delta.kind === 'paste') {
    recomputed = proposeRails({
      document: targetDocument,
      payload: delta.payload,
      placementMode: delta.placementMode,
      ...(delta.destinationAppFrame !== null ? { destinationAppFrame: delta.destinationAppFrame } : {}),
      freshIdentityAllocation: delta.freshIdentityAllocation,
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
    return `${operationLabel} semantic delta is not supported.`;
  }
  if (!recomputed.ok) return `${operationLabel} proposal rejected: ${recomputed.reason}.`;
  if (stableSerialize(recomputed.impact, new WeakSet<object>())
      !== stableSerialize(delta as PhysicPaintRotoPhysicalEditSemanticDelta, new WeakSet<object>())) {
    return `${operationLabel} semantic impact does not match parent recomputation.`;
  }
  const proposal = recomputed.proposal;
  if (!sameCompletePhysicalRecords(proposal.realKeyRecords, input.proposedRecords)
    || !sameCompletePhysicalRecords(proposal.groupOverrideRecords ?? [], input.proposedGroupOverrideRecords)
    || !sameCanonicalLoopClips(proposal.loopClips, input.proposedLoopClips)
    || stableSerialize(proposal.incomingInterpolationBreakKeyIds, new WeakSet<object>())
      !== stableSerialize(input.proposedIncomingInterpolationBreakKeyIds, new WeakSet<object>())
    || proposal.interpolation.enabled !== input.stagedInterpolation.enabled
    || proposal.interpolation.mode !== input.stagedInterpolation.mode
    || proposal.selectedKeyId !== payload.selectedKeyId
    || proposal.cursorAppFrame !== input.cursorAppFrame
    || proposal.revision !== input.stagedRevision) {
    return `${operationLabel} target document does not match parent recomputation.`;
  }
  return null;
}

async function applyPhysicPaintRotoPhysicalMap(
  payload: Extract<PhysicPaintApplyPayload, { kind: 'replace-roto-physical-map' }>,
  publicationLeaseToken?: PhysicPaintRotoPhysicalOperationLeaseToken,
): Promise<PhysicPaintRotoPhysicalEditApplyResult> {
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
  if (publicationLeaseToken && (submittedLeaseToken.layerId !== payload.layerId || submittedLeaseToken.trackId !== payload.trackId)) {
    return reject('Roto physical operation lease rejected: mismatched-token.');
  }
  const leaseToken = publicationLeaseToken ?? submittedLeaseToken;
  const leaseValidation = physicPaintStore.validateRotoPhysicalOperationLease(
    leaseToken.projectContextId,
    payload.layerId,
    leaseToken.trackId,
    leaseToken,
  );
  if (!leaseValidation.ok) {
    return reject(`Roto physical operation lease rejected: ${leaseValidation.reason}.`);
  }
  const currentRecords = physicPaintStore.getRotoRealKeyRecords(payload.layerId, payload.trackId);
  const currentGroupOverrideRecords = physicPaintStore.getRotoGroupOverrideRecords(payload.layerId, payload.trackId);
  const currentInterpolation = physicPaintStore.getRotoPhysicalInterpolationState(payload.layerId, payload.trackId);
  const currentLoopClips = physicPaintStore.getRotoPhysicalLoopClips(payload.layerId, payload.trackId);
  const currentIncomingInterpolationBreakKeyIds = physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(payload.layerId, payload.trackId);
  const currentDocument = physicPaintStore.getRotoPhysicalDocument(payload.layerId, payload.trackId);
  const currentRevision = buildPhysicPaintRotoPhysicalRevision(
    currentRecords,
    currentInterpolation,
    currentLoopClips,
    currentIncomingInterpolationBreakKeyIds,
    currentGroupOverrideRecords,
  );
  const capacity = physicPaintStore.getRotoPhysicalCapacity(payload.layerId, payload.trackId);
  const parentEndExclusive = getTimelineRangeEndExclusive(layer);
  if (payload.intent !== undefined && parentEndExclusive === null) {
    return reject('Physics Paint layer has no authoritative parent timeline range.');
  }
  const canonicalParentEndExclusive = parentEndExclusive === null
    ? null
    : Math.min(parentEndExclusive, capacity);
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
      debugReplaySnapshotDiff(liveSourceSnapshot, expectedSourceSnapshot);
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
      ? physicPaintStore.getRotoPhysicalLoopClips(payload.layerId, payload.trackId)
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
    if (canonicalParentEndExclusive === null) {
      return reject('Physics Paint layer has no authoritative parent timeline range.', stagedRevision);
    }
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
      parentEndExclusive: canonicalParentEndExclusive,
      capacity,
      stagedRevision,
    });
    if (canonicalValidationError) return reject(canonicalValidationError, stagedRevision);
  }
  if (payload.operationKind === 'insert-empty-segment') {
    const validationError = await validateInsertEmptySegmentPhysicalDelta({
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
      debugReplaySnapshotDiff(proposedTargetSnapshot, expectedTargetSnapshot);
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
      : currentDocument?.background ?? physicPaintStore.getRotoBackgroundMetadata(payload.layerId, payload.trackId),
    selectedKeyId: payload.selectedKeyId,
    cursorAppFrame,
    revision: stagedRevision,
    loopClips: proposedLoopClips,
    incomingInterpolationBreakKeyIds: proposedIncomingInterpolationBreakKeyIds,
  });
  const replaceResult = physicPaintStore.replaceRotoPhysicalDocument(
    payload.layerId,
    payload.trackId,
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
    const childBeforeAuthority = payload.operationKind === 'move-group'
      || GROUP_LIFECYCLE_OPERATION_KINDS.has(payload.operationKind);
    // delete-rails must record the TRUE pre-operation selection from the
    // current document, not the POST-delete proposal selection the payload
    // ships — the undo replay submits the pre-delete selection (history
    // entry.before), so a payload-derived before snapshot fails replay-target
    // equality and silently no-ops undo (G-43.6-2 single/multi asymmetry).
    // Group lifecycle deletes keep payload authority because their proposal
    // preserves the pre-op selection in the common case (buildLifecycleProposal).
    const beforeSelectionFromPayload = childBeforeAuthority && payload.operationKind !== 'delete-rails';
    const beforeSnapshot = createAcceptedPhysicalCommandSnapshot({
      records: currentRecords,
      groupOverrideRecords: currentGroupOverrideRecords,
      interpolation: currentInterpolation,
      loopClips: currentLoopClips,
      incomingInterpolationBreakKeyIds: currentIncomingInterpolationBreakKeyIds,
      selectedKeyId: beforeSelectionFromPayload
        ? payload.selectedKeyId
        : currentDocument?.selectedKeyId ?? null,
      cursorAppFrame: beforeSelectionFromPayload
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
  'trackId',
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
      || typeof tokenRecord.trackId !== 'string' || (tokenRecord.trackId as string).length === 0
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
 * Parent-authoritative source-phase Paint commit. The child proposal and
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

  // 46-01: the validation/apply side resolves the document's ACTIVE track (the
  // launch IS the document — D-03); the carried request carries no trackId.
  const requestTrackId = getEfxPaintDocument(request.layerId)?.activeTrackId ?? '';
  const currentDocument = physicPaintStore.getRotoPhysicalDocument(request.layerId, requestTrackId);
  if (!currentDocument
    || currentDocument.revision !== request.expectedRevision
    || buildPhysicPaintRotoProjectEquality(currentDocument) !== request.expectedProjectEquality) {
    return Object.freeze({ ok: false, reason: 'stale' });
  }
  const leaseValidation = physicPaintStore.validateRotoPhysicalOperationLease(
    request.projectContextId,
    request.layerId,
    request.leaseToken?.trackId ?? '',
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
    requestTrackId,
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
    input.leaseToken?.trackId ?? '',
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
  // 46-01: the history authority carries no trackId; resolve the ACTIVE track
  // (the launch IS the document — D-03).
  const authorityTrackId = getEfxPaintDocument(authority.layerId)?.activeTrackId ?? '';
  const current = physicPaintStore.getRotoPhysicalDocument(authority.layerId, authorityTrackId);
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

  const replacement = physicPaintStore.replaceRotoPhysicalDocument(authority.layerId, authorityTrackId, target, input.leaseToken);
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

/**
 * 49-04 (Task 1): pure publisher-side handler for the image-library request.
 * The main webview answers with the authoritative imageStore realm's current
 * `{ images, projectDir }` snapshot. `state` is injected so the handler is
 * unit-testable without a live store; the production wiring passes
 * `{ getImages: () => imageStore.toMceImages(projectDir), getProjectDir: () => projectStore.dirPath.peek() }`.
 */
export interface PhysicPaintImageLibraryStatePorts {
  readonly getImages: () => MceImageRef[];
  readonly getProjectDir: () => string;
}

export function applyPhysicPaintImageLibraryRequest(
  value: unknown,
  state: PhysicPaintImageLibraryStatePorts,
): PhysicPaintImageLibraryResult {
  const request = isPhysicPaintImageLibraryRequest(value) ? value : null;
  const operationId = request?.operationId ?? 'invalid-operation';
  if (!request) return { operationId, ok: false, images: [], projectDir: '', error: 'Invalid image library request' };
  const projectDir = state.getProjectDir();
  if (!projectDir) return { operationId, ok: false, images: [], projectDir: '', error: 'No project directory is open.' };
  return { operationId, ok: true, images: state.getImages(), projectDir };
}

/**
 * quick-260921-bjm: publisher-side handler for the image-import request. It is
 * the ONLY place a picker import is performed, and it runs in the MAIN realm —
 * the realm whose `imageStore` feeds `projectStore.buildMceProject()`'s
 * manifest `images` array and the reopen hydration
 * (`imageStore.loadFromMceImages`). Nothing else writes either.
 *
 * `state` is injected so the handler is unit-testable without a live store;
 * `importImages` resolves the ready-to-ship per-file error list (`null` = the
 * import could not be performed at all).
 */
export interface PhysicPaintImageImportStatePorts {
  readonly getImages: () => MceImageRef[];
  readonly getProjectDir: () => string;
  readonly importImages: (paths: readonly string[], projectDir: string) => Promise<readonly string[] | null>;
}

export async function applyPhysicPaintImageImportRequest(
  value: unknown,
  state: PhysicPaintImageImportStatePorts,
): Promise<PhysicPaintImageImportResult> {
  const request = isPhysicPaintImageImportRequest(value) ? value : null;
  const operationId = request?.operationId ?? 'invalid-operation';
  // Malformed / oversized / directory-carrying payloads are terminal with ZERO
  // import attempts (T-260921-bjm-01/03).
  if (!request) return { operationId, ok: false, images: [], errors: [], error: 'Invalid image import request' };
  const projectDir = state.getProjectDir();
  if (!projectDir) return { operationId, ok: false, images: [], errors: [], error: 'No project directory is open.' };
  let errors: readonly string[] | null;
  try {
    errors = await state.importImages(request.paths, projectDir);
  } catch (error) {
    return { operationId, ok: false, images: [], errors: [], error: `Image import failed: ${String(error)}` };
  }
  // Never a silent no-op dressed as a success: the picker surfaces this error.
  if (errors === null) return { operationId, ok: false, images: [], errors: [], error: 'Image import failed' };
  return { operationId, ok: true, images: state.getImages(), errors: [...errors] };
}

/**
 * The main realm's own image-import binding: its resolved project directory
 * (`dirPath ?? tempProjectDir`, the production fallback), the real
 * `imageStore.importFiles`, and the post-import library read. `importFiles`
 * returns the IPC outcome; the port hands the handler the per-file error
 * strings in the store's existing `${path}: ${error}` shape.
 */
export function createPhysicPaintImageImportStatePorts(): PhysicPaintImageImportStatePorts {
  return {
    getImages: () => imageStore.toMceImages(projectStore.dirPath.value ?? tempProjectDir.value ?? ''),
    getProjectDir: () => projectStore.dirPath.value ?? tempProjectDir.value ?? '',
    importImages: async (paths, projectDir) => {
      const result = await imageStore.importFiles([...paths], projectDir);
      return result ? result.errors.map((error) => `${error.path}: ${error.error}`) : null;
    },
  };
}

function failedImageImportResult(operationId: string, error: string): PhysicPaintImageImportResult {
  return { operationId, ok: false, images: [], errors: [], error };
}

export interface ImageLibraryRequestLifecyclePorts {
  readonly getBridgeMode: () => PhysicsPaintBridgeMode;
  readonly detectBridgeMode?: () => Promise<PhysicsPaintBridgeMode>;
  readonly sendRequest: (request: PhysicPaintImageLibraryRequest, bridgeMode: PhysicsPaintBridgeMode) => Promise<void>;
  readonly setRequestTimeout?: (handler: () => void, timeout: number) => ReturnType<typeof setTimeout>;
  readonly clearRequestTimeout?: (handle: ReturnType<typeof setTimeout>) => void;
}

export interface ImageLibraryRequestLifecycle {
  readonly request: () => Promise<PhysicPaintImageLibraryResult>;
  readonly handleResult: (result: PhysicPaintImageLibraryResult) => void;
  readonly dispose: () => void;
  readonly pendingCount: () => number;
}

function failedImageLibraryResult(operationId: string, error: string): PhysicPaintImageLibraryResult {
  return { operationId, ok: false, images: [], projectDir: '', error };
}

/**
 * 49-04 (Task 1): consumer-side request lifecycle mirroring
 * createRotoScriptLibraryRequestLifecycle — pending Map keyed by operationId,
 * settle() resolves the matching promise, request() enforces a 15s timeout,
 * handleResult() settles by operationId, dispose() settles all pending.
 */
export function createImageLibraryRequestLifecycle(ports: ImageLibraryRequestLifecyclePorts): ImageLibraryRequestLifecycle {
  const pending = new Map<string, { operationId: string; resolve: (result: PhysicPaintImageLibraryResult) => void; timeout: ReturnType<typeof setTimeout> }>();
  const setRequestTimeout = ports.setRequestTimeout ?? setTimeout;
  const clearRequestTimeout = ports.clearRequestTimeout ?? clearTimeout;
  let disposed = false;

  function settle(operationId: string, result: PhysicPaintImageLibraryResult): void {
    const operation = pending.get(operationId);
    if (!operation) return;
    pending.delete(operationId);
    clearRequestTimeout(operation.timeout);
    operation.resolve(result);
  }

  function request(): Promise<PhysicPaintImageLibraryResult> {
    const operationId = `physics-paint-image-library-${Date.now()}-${crypto.randomUUID()}`;
    if (disposed) return Promise.resolve(failedImageLibraryResult(operationId, 'Image library request was disposed.'));
    return new Promise((resolve) => {
      const timeout = setRequestTimeout(() => settle(operationId, failedImageLibraryResult(operationId, 'Image library request timed out.')), 15_000);
      pending.set(operationId, { operationId, resolve, timeout });
      void (async () => {
        const configuredMode = ports.getBridgeMode();
        const currentBridgeMode = configuredMode === 'Unavailable' && ports.detectBridgeMode ? await ports.detectBridgeMode() : configuredMode;
        await ports.sendRequest({ operationId }, currentBridgeMode);
      })().catch((error) => settle(operationId, failedImageLibraryResult(operationId, String(error))));
    });
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    for (const operation of [...pending.values()]) {
      settle(operation.operationId, failedImageLibraryResult(operation.operationId, 'Image library request was disposed.'));
    }
  }

  return {
    request,
    handleResult: (result) => settle(result.operationId, result),
    dispose,
    pendingCount: () => pending.size,
  };
}

/**
 * 49-04 (Task 1): consumer-side convenience entry point used by the Studio
 * realm. Self-contained (mirrors createPhysicPaintThumbnailNativeEncoder) so
 * physicPaintBridge never imports from the component layer — avoiding the
 * circular import with usePhysicsPaintParentBridge.
 */
export async function requestImageLibrary(): Promise<PhysicPaintImageLibraryResult> {
  const eventApi = await import('@tauri-apps/api/event');
  if (typeof eventApi.emitTo !== 'function' || typeof eventApi.listen !== 'function') {
    return failedImageLibraryResult('invalid-operation', 'Image library bridge is unavailable');
  }
  const operationId = `physics-paint-image-library-${Date.now()}-${crypto.randomUUID()}`;
  let timeout = 0;
  let unlisten: (() => void) | undefined;
  try {
    let resolveResult: (result: PhysicPaintImageLibraryResult) => void = () => {};
    const resultPromise = new Promise<PhysicPaintImageLibraryResult>((resolve) => { resolveResult = resolve; });
    unlisten = await eventApi.listen(PHYSIC_PAINT_IMAGE_LIBRARY_RESULT_EVENT, (event) => {
      if (!isPhysicPaintImageLibraryResult(event.payload) || event.payload.operationId !== operationId) return;
      resolveResult(event.payload);
    });
    timeout = window.setTimeout(() => resolveResult(failedImageLibraryResult(operationId, 'Image library request timed out')), 15_000);
    await eventApi.emitTo('main', PHYSIC_PAINT_IMAGE_LIBRARY_REQUEST_EVENT, { operationId });
    return await resultPromise;
  } finally {
    if (timeout) window.clearTimeout(timeout);
    unlisten?.();
  }
}

export async function installPhysicPaintImageLibraryListener(): Promise<() => void> {
  const emitResult = async (result: PhysicPaintImageLibraryResult, source?: Pick<Window, 'postMessage'> | null) => {
    if (isTauriRuntime()) {
      const eventApi = await import('@tauri-apps/api/event');
      await eventApi.emitTo?.(PHYSIC_PAINT_WINDOW_LABEL, PHYSIC_PAINT_IMAGE_LIBRARY_RESULT_EVENT, result);
    }
    if (typeof window !== 'undefined') {
      const message = { type: PHYSIC_PAINT_IMAGE_LIBRARY_RESULT_EVENT, payload: result };
      window.dispatchEvent(new CustomEvent(PHYSIC_PAINT_IMAGE_LIBRARY_RESULT_EVENT, { detail: result }));
      source?.postMessage?.(message, window.location.origin);
      window.opener?.postMessage?.(message, window.location.origin);
    }
  };
  const state: PhysicPaintImageLibraryStatePorts = {
    getImages: () => imageStore.toMceImages(projectStore.dirPath.value ?? tempProjectDir.value ?? ''),
    getProjectDir: () => projectStore.dirPath.value ?? tempProjectDir.value ?? '',
  };
  if (isTauriRuntime()) {
    const eventApi = await import('@tauri-apps/api/event');
    const unlisten = await eventApi.listen?.(PHYSIC_PAINT_IMAGE_LIBRARY_REQUEST_EVENT, async (event) => emitResult(applyPhysicPaintImageLibraryRequest(event.payload, state)));
    if (unlisten) return unlisten;
  }
  if (typeof window === 'undefined') return () => {};
  const custom = (event: Event) => { void emitResult(applyPhysicPaintImageLibraryRequest((event as CustomEvent).detail, state)); };
  const message = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || !event.data || event.data.type !== PHYSIC_PAINT_IMAGE_LIBRARY_REQUEST_EVENT) return;
    const source = event.source && 'postMessage' in event.source ? event.source as Pick<Window, 'postMessage'> : undefined;
    void emitResult(applyPhysicPaintImageLibraryRequest(event.data.payload, state), source);
  };
  window.addEventListener(PHYSIC_PAINT_IMAGE_LIBRARY_REQUEST_EVENT, custom);
  window.addEventListener('message', message);
  return () => { window.removeEventListener(PHYSIC_PAINT_IMAGE_LIBRARY_REQUEST_EVENT, custom); window.removeEventListener('message', message); };
}

/**
 * quick-260921-bjm: consumer-side convenience entry point used by the Studio
 * realm's picker. Self-contained in the requestImageLibrary shape (listen →
 * 15s timeout → emitTo('main')), validating the result with the new guard AND
 * correlating on operationId so a forged/foreign result is dropped
 * (T-260921-bjm-02). The request carries `operationId` + `paths` only — the
 * destination directory is never named by the child.
 */
export async function requestImageImport(paths: readonly string[]): Promise<PhysicPaintImageImportResult> {
  const eventApi = await import('@tauri-apps/api/event');
  if (typeof eventApi.emitTo !== 'function' || typeof eventApi.listen !== 'function') {
    return failedImageImportResult('invalid-operation', 'Image import bridge is unavailable');
  }
  const operationId = `physics-paint-image-import-${Date.now()}-${crypto.randomUUID()}`;
  let timeout = 0;
  let unlisten: (() => void) | undefined;
  try {
    let resolveResult: (result: PhysicPaintImageImportResult) => void = () => {};
    const resultPromise = new Promise<PhysicPaintImageImportResult>((resolve) => { resolveResult = resolve; });
    unlisten = await eventApi.listen(PHYSIC_PAINT_IMAGE_IMPORT_RESULT_EVENT, (event) => {
      if (!isPhysicPaintImageImportResult(event.payload) || event.payload.operationId !== operationId) return;
      resolveResult(event.payload);
    });
    timeout = window.setTimeout(() => resolveResult(failedImageImportResult(operationId, 'Image import request timed out')), 15_000);
    await eventApi.emitTo('main', PHYSIC_PAINT_IMAGE_IMPORT_REQUEST_EVENT, { operationId, paths: [...paths] });
    return await resultPromise;
  } finally {
    if (timeout) window.clearTimeout(timeout);
    unlisten?.();
  }
}

export async function installPhysicPaintImageImportListener(): Promise<() => void> {
  const emitResult = async (result: PhysicPaintImageImportResult, source?: Pick<Window, 'postMessage'> | null) => {
    if (isTauriRuntime()) {
      const eventApi = await import('@tauri-apps/api/event');
      await eventApi.emitTo?.(PHYSIC_PAINT_WINDOW_LABEL, PHYSIC_PAINT_IMAGE_IMPORT_RESULT_EVENT, result);
    }
    if (typeof window !== 'undefined') {
      const message = { type: PHYSIC_PAINT_IMAGE_IMPORT_RESULT_EVENT, payload: result };
      window.dispatchEvent(new CustomEvent(PHYSIC_PAINT_IMAGE_IMPORT_RESULT_EVENT, { detail: result }));
      source?.postMessage?.(message, window.location.origin);
      window.opener?.postMessage?.(message, window.location.origin);
    }
  };
  // The main realm resolves its OWN project directory (dirPath ?? tempProjectDir
  // — the same fallback the production import flow uses) and performs the
  // import against the authoritative imageStore.
  const state = createPhysicPaintImageImportStatePorts();
  if (isTauriRuntime()) {
    const eventApi = await import('@tauri-apps/api/event');
    const unlisten = await eventApi.listen?.(PHYSIC_PAINT_IMAGE_IMPORT_REQUEST_EVENT, async (event) => emitResult(await applyPhysicPaintImageImportRequest(event.payload, state)));
    if (unlisten) return unlisten;
  }
  if (typeof window === 'undefined') return () => {};
  const custom = (event: Event) => { void applyPhysicPaintImageImportRequest((event as CustomEvent).detail, state).then((result) => emitResult(result)); };
  const message = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || !event.data || event.data.type !== PHYSIC_PAINT_IMAGE_IMPORT_REQUEST_EVENT) return;
    const source = event.source && 'postMessage' in event.source ? event.source as Pick<Window, 'postMessage'> : undefined;
    void applyPhysicPaintImageImportRequest(event.data.payload, state).then((result) => emitResult(result, source));
  };
  window.addEventListener(PHYSIC_PAINT_IMAGE_IMPORT_REQUEST_EVENT, custom);
  window.addEventListener('message', message);
  return () => { window.removeEventListener(PHYSIC_PAINT_IMAGE_IMPORT_REQUEST_EVENT, custom); window.removeEventListener('message', message); };
}

export async function publishPhysicPaintProjectContext(): Promise<void> {
  // quick-260922-al1: the child realm has no layer list of its own, so the live
  // physic-paint layers ride this existing channel (bounded: id + truncated
  // live name) together with the stored scope. The scope is re-clamped against
  // the SAME list at publish time — a layer deleted while its scope was stored
  // degrades to All rather than travelling as a dead id.
  const layers = projectStore.getActivePhysicPaintLayers().map((layer) => ({
    id: layer.id,
    name: layer.name.slice(0, PHYSIC_PAINT_PROJECT_CONTEXT_MAX_LAYER_NAME_LENGTH),
  }));
  const storedScope = projectStore.scriptScope.peek();
  const scriptScope = storedScope === 'all' || layers.some((layer) => layer.id === storedScope) ? storedScope : 'all';
  const project = {
    name: projectStore.name.peek(),
    saved: Boolean(projectStore.filePath.peek() && projectStore.scriptLibraryAuthority.peek()),
    contextId: projectStore.projectContextId.peek(),
    ...(projectStore.scriptLibraryAuthority.peek() ? { scriptLibraryAuthority: projectStore.scriptLibraryAuthority.peek()! } : {}),
    layers,
    scriptScope,
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
 * quick-260922-al1: consumer-side convenience entry point used by the Studio
 * realm — the PULL half of the project-context channel. Self-contained in the
 * requestImageLibrary shape (listen → bounded timeout → emitTo('main') → await)
 * because the Studio's layer switch re-boots the child and the publisher only
 * fires at project bind, before the Studio exists.
 *
 * `scriptScope` is optional ON PURPOSE: called with no argument (the mount
 * pull) the request writes NOTHING in the main realm, so reopening the Studio
 * cannot reset the stored scope to the child's default. Never throws; the
 * one-shot listener is always removed.
 */
export async function requestPhysicPaintProjectContext(scriptScope?: string): Promise<void> {
  const eventApi = await import('@tauri-apps/api/event');
  if (typeof eventApi.emitTo !== 'function' || typeof eventApi.listen !== 'function') return;
  const operationId = `physics-paint-project-context-${Date.now()}-${crypto.randomUUID()}`;
  const request: PhysicPaintProjectContextRequest = scriptScope === undefined ? { operationId } : { operationId, scriptScope };
  let timeout = 0;
  let unlisten: (() => void) | undefined;
  try {
    let resolveReceived: () => void = () => {};
    const received = new Promise<void>((resolve) => { resolveReceived = resolve; });
    unlisten = await eventApi.listen(PHYSIC_PAINT_PROJECT_CONTEXT_EVENT, (event) => {
      const payload = event.payload;
      if (payload && typeof payload === 'object' && typeof (payload as { contextId?: unknown }).contextId === 'string') resolveReceived();
    });
    timeout = window.setTimeout(resolveReceived, PHYSIC_PAINT_PROJECT_CONTEXT_REQUEST_TIMEOUT_MS);
    await eventApi.emitTo('main', PHYSIC_PAINT_PROJECT_CONTEXT_REQUEST_EVENT, request);
    await received;
  } catch (error) {
    console.warn('[physicPaintBridge] Project context request failed', error);
  } finally {
    if (timeout) window.clearTimeout(timeout);
    unlisten?.();
  }
}

/**
 * quick-260922-al1: main-window installer for the child's project-context
 * request. Same triple-transport discipline as the sibling installers (Tauri
 * `listen` + CustomEvent + origin-checked `postMessage`), and the same
 * fail-closed contract as the rest of the channel: a malformed request imports
 * nothing and publishes nothing, and a requested scope is validated against the
 * LIVE layer set by `projectStore.setScriptScope`, which clamps to All for an
 * unknown, dead or malformed value (T-260922-al1-01/02). An ABSENT scope is a
 * read-only republish — the main realm's stored scope is untouched.
 */
export async function installPhysicPaintProjectContextRequestListener(): Promise<() => void> {
  const applyRequest = async (value: unknown): Promise<void> => {
    if (!isPhysicPaintProjectContextRequest(value)) return;
    if (value.scriptScope !== undefined) projectStore.setScriptScope(value.scriptScope);
    await publishPhysicPaintProjectContext();
  };
  if (isTauriRuntime()) {
    const eventApi = await import('@tauri-apps/api/event');
    const unlisten = await eventApi.listen?.(PHYSIC_PAINT_PROJECT_CONTEXT_REQUEST_EVENT, (event) => { void applyRequest(event.payload); });
    if (unlisten) return unlisten;
  }
  if (typeof window === 'undefined') return () => {};
  const custom = (event: Event) => { void applyRequest((event as CustomEvent).detail); };
  const message = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || !event.data || event.data.type !== PHYSIC_PAINT_PROJECT_CONTEXT_REQUEST_EVENT) return;
    void applyRequest(event.data.payload);
  };
  window.addEventListener(PHYSIC_PAINT_PROJECT_CONTEXT_REQUEST_EVENT, custom);
  window.addEventListener('message', message);
  return () => { window.removeEventListener(PHYSIC_PAINT_PROJECT_CONTEXT_REQUEST_EVENT, custom); window.removeEventListener('message', message); };
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
      // 52.1 (D-05): physicalRecords carry Uint8Array bytes; emitTo JSON would
      // turn them into index objects. Convert bytes -> base64 on the way out.
      const encoded = toTransportPayload(result);
      await eventApi.emitTo?.(PHYSIC_PAINT_WINDOW_LABEL, PHYSIC_PAINT_ROTO_AUTHORITY_RESULT_EVENT, encoded);
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
    deactivatePhysicPaintLaunch();
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
        // 52.1 (D-05): the result echoes the semanticDelta whose clipboardPayload
        // bytes are a Uint8Array. emitTo serializes as JSON, which would turn the
        // bytes into an index object and make the child's isPhysicPaintApplyResult
        // reject the result (silent timeout). Convert bytes -> base64 on the way
        // out so the child's validator sees the canonical string form.
        // NOTE: the raw `emit` broadcast was removed — it JSON-serialized the
        // Uint8Array into an index object and the child's Tauri listener rejected
        // that duplicate (the "invalid Tauri apply result" warning). The child is
        // the only Tauri listener for this event and already receives the encoded
        // result via emitTo below.
        const encoded = toTransportPayload(result);
        await eventApi.emitTo?.(PHYSIC_PAINT_WINDOW_LABEL, PHYSIC_PAINT_APPLY_RESULT_EVENT, encoded);
        sendBrowserApplyResult(result);
        if (result.ok && isPhysicPaintApplyPayload(payload) && shouldCloseNativeWindowAfterApply(payload)) await closeNativePhysicPaintWindow();
      });
      // 52.1: a manual child close (no Apply, no apply-with-close) must still
      // release the main Preview gate so it re-renders the settled composite.
      const unlistenClosed = await eventApi.listen?.('physic-paint:window-closed', () => {
        deactivatePhysicPaintLaunch();
      });
      if (unlisten || unlistenClosed) {
        return () => {
          unlisten?.();
          unlistenClosed?.();
        };
      }
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

/**
 * 52.2-10 (D-12, T-52.2-33/34/35): the receiver's frame-media port pair. With
 * the document crossing REFERENCE-SHAPED, the receiver owns exactly two jobs:
 * answer "do I already hold this digest?" from its own store (no decode, no
 * file read) and install the rasters it does receive under their digest. The
 * ports are injectable so the contract tests drive the decision without a real
 * store; production binds them to physicPaintStore + the missing-digest
 * request channel.
 */
export interface PhysicPaintDocumentSyncFramePorts {
  has(digest: string): boolean;
  install(digest: string, bytes: Uint8Array): Promise<{ ok: true } | { ok: false; reason: string }>;
  request(digests: readonly string[]): void;
}

let _documentSyncFramePorts: PhysicPaintDocumentSyncFramePorts | null = null;
/** Digests already asked for this window's lifetime — one request per digest. */
const _documentSyncRequestedDigests = new Set<string>();
/** In-flight installs kicked by a sync or by the apply path's digest install. */
const _documentSyncPendingInstalls = new Set<Promise<void>>();

function trackDocumentSyncFrameInstall(install: Promise<unknown>): void {
  const tracked = install.then(() => undefined, () => undefined);
  _documentSyncPendingInstalls.add(tracked);
  void tracked.finally(() => { _documentSyncPendingInstalls.delete(tracked); });
}

function requestDocumentSyncFrameMedia(digests: readonly string[]): void {
  if (digests.length === 0) return;
  // main→Studio: the receiver names exactly the digests it lacks; the Studio's
  // marks (its delivered set) are the other half of the same knowledge. The
  // responder rides the sender's queue (pilot scope, plan 14) — this emit is
  // the protocol signal, delivered on the same Tauri channel as the flush
  // round-trip. A non-Tauri window has no bridge to ask.
  void (async () => {
    if (!isTauriRuntime()) return;
    try {
      const eventApi = await import('@tauri-apps/api/event') as TauriEventApi;
      await eventApi.emitTo?.(PHYSIC_PAINT_WINDOW_LABEL, PHYSIC_PAINT_FRAME_MEDIA_REQUEST_EVENT, { digests });
    } catch {
      // Bridge unavailable — the next Studio push re-evaluates from its marks.
    }
  })();
}

const _defaultDocumentSyncFramePorts: PhysicPaintDocumentSyncFramePorts = {
  has: (digest) => hasFrameMediaBytes(digest),
  install: (digest, bytes) => installFrameMediaBytes(bytes, digest),
  request: (digests) => requestDocumentSyncFrameMedia(digests),
};

/**
 * 52.2-10 (D-12): swap the receiver's digest-store ports. Pass `null` to return
 * to the production defaults (the physicPaintStore-backed pair). Test-only
 * surface, on the `_setPhysicPaintPackageDirProvider` pattern.
 */
export function _setPhysicPaintDocumentSyncFramePorts(ports: PhysicPaintDocumentSyncFramePorts | null): void {
  _documentSyncFramePorts = ports;
}

/**
 * 52.2-10 (D-12): drop the receiver's per-session digest memory — the
 * requested-digest set and any tracked install promises. Transient event
 * state, like the transport's delivered-digest claim.
 */
export function resetPhysicPaintDocumentSyncFrameState(): void {
  _documentSyncRequestedDigests.clear();
  _documentSyncPendingInstalls.clear();
}

/**
 * 52.2-10 (D-12): await the in-flight installs kicked by a document sync (and
 * by the apply path's digest install). Never rejects — an install failure is
 * recorded on the store's verdict map, not thrown at the caller.
 */
export async function awaitPendingPhysicPaintFrameMediaInstalls(): Promise<void> {
  while (_documentSyncPendingInstalls.size > 0) {
    await Promise.allSettled([..._documentSyncPendingInstalls]);
  }
}

/**
 * 52.2-10 (D-12): the digests a reference-shaped document names, from BOTH
 * roto collections — the same two the plan-06 projection writes and the
 * plan-09 resolver reads (a reference names no collection, so neither may be
 * skipped when deciding what the receiver lacks).
 */
function collectDocumentSyncReferencedDigests(document: EfxPaintDocument): string[] {
  const digests = new Set<string>();
  for (const track of document.tracks) {
    const roto = track.rotoPhysical;
    if (!roto) continue;
    for (const collection of [roto.realKeyRecords, roto.groupOverrideRecords ?? []]) {
      for (const record of collection) {
        const digest = record.payload.media?.digest;
        if (typeof digest === 'string' && digest.length > 0) digests.add(digest);
      }
    }
  }
  return [...digests];
}

/**
 * 52.2-10 (D-12, T-52.2-33/34/35): the receiver's decision for one arriving
 * document sync — what it lacks (one request per digest, ever) and what the
 * byte channel actually delivered (verified installs only). Runs BEFORE the
 * document's revision guard: a re-pushed unchanged document may still carry
 * bytes the receiver lost.
 */
function applyDocumentSyncFrameMedia(
  document: EfxPaintDocument,
  changedBytes: unknown,
): void {
  const ports = _documentSyncFramePorts ?? _defaultDocumentSyncFramePorts;
  const missing: string[] = [];
  for (const digest of collectDocumentSyncReferencedDigests(document)) {
    let held = false;
    try {
      held = ports.has(digest);
    } catch {
      held = false;
    }
    if (held || _documentSyncRequestedDigests.has(digest)) continue;
    _documentSyncRequestedDigests.add(digest);
    missing.push(digest);
  }
  if (missing.length > 0) {
    try {
      ports.request(missing);
    } catch {
      // The request channel is best-effort: a failed ask must not break the
      // document apply, and the digest stays marked so it is not re-asked
      // on every tick (the retry law, T-52.2-35).
    }
  }
  if (!changedBytes || typeof changedBytes !== 'object' || Array.isArray(changedBytes)) return;
  for (const [digest, encoded] of Object.entries(changedBytes as Record<string, unknown>)) {
    if (typeof encoded !== 'string' || encoded.length === 0) continue;
    // The transport base64-decodes the WebP payload; the magic-byte guard is
    // the same one every bytes field crosses with (never a JSON index object).
    const bytes = base64ToWebpBytes(encoded);
    if (bytes === null) continue;
    let held = false;
    try {
      held = ports.has(digest);
    } catch {
      held = false;
    }
    // Never re-install what the receiver holds: a re-delivered retry is
    // idempotent because the install is skipped, not because it is repeated.
    if (held) continue;
    trackDocumentSyncFrameInstall(ports.install(digest, bytes));
  }
}

/**
 * One frame digest per distinct raster content, keyed by the O(1) byte token
 * (G-52-6). The preserve below runs on every mirror install of a reference-
 * shaped push; memoizing keeps a re-pushed unchanged frame from paying its
 * SHA-256 twice.
 */
const frameDigestByContentToken = new Map<string, string>();

async function frameDigestForInlineBytes(bytes: Uint8Array): Promise<string> {
  const token = buildFrameBytesToken(bytes);
  const held = frameDigestByContentToken.get(token);
  if (held !== undefined) return held;
  const digest = await sha256HexBytes(bytes);
  frameDigestByContentToken.set(token, digest);
  return digest;
}

/**
 * debug layer-2-ref-mismatch (2026-09-22): the child's docSync projection is
 * reference-shaped by design (52.2-10 D-12), but the RECEIVER's runtime is the
 * byte-shaped authority the physical-edit ref expansion and the apply's
 * revision gate read — the runtime mirror must reconstruct the shape, not
 * adopt the wire projection. A reference whose digest the receiver's own
 * inline bytes already hash to names exactly those pixels, so the bytes are
 * preserved under the pushed identity. An unverifiable digest is left
 * reference-only (the fail-closed direction: the pushed revision keeps naming
 * the references, and a later edit's ref for it is refused rather than
 * resolved against bytes that may not be the child's).
 *
 * The document's revision is recomputed over the preserved collections — the
 * same law every projection seam honors: the fingerprint covers the raster
 * carriers, so a byte-carrying collection can never carry a reference-shaped
 * revision.
 */
export async function preserveMirroredInlineBytes(
  layerId: string,
  trackId: string,
  document: PhysicPaintRotoPhysicalDocument,
): Promise<PhysicPaintRotoPhysicalDocument> {
  const preserveCollection = async (
    records: readonly PhysicPaintRotoRealKeyRecord[],
  ): Promise<{ readonly records: readonly PhysicPaintRotoRealKeyRecord[]; readonly changed: boolean }> => {
    let changed = false;
    const preserved: PhysicPaintRotoRealKeyRecord[] = [];
    for (const record of records) {
      const media = record.payload.media;
      const current = media === undefined
        ? null
        : physicPaintStore.getRotoRealKeyRecord(layerId, trackId, record.keyId);
      const bytes = current?.payload.bytes;
      if (media === undefined || bytes === undefined || await frameDigestForInlineBytes(bytes) !== media.digest) {
        preserved.push(record);
        continue;
      }
      changed = true;
      preserved.push(Object.freeze({
        kind: 'real-key' as const,
        keyId: record.keyId,
        appFrame: record.appFrame,
        payload: Object.freeze(buildBytesPayload(record, bytes)),
      }));
    }
    return { records: preserved, changed };
  };
  const realKeyRecords = await preserveCollection(document.realKeyRecords);
  const groupOverrideRecords = document.groupOverrideRecords === undefined
    ? undefined
    : await preserveCollection(document.groupOverrideRecords);
  if (!realKeyRecords.changed && groupOverrideRecords?.changed !== true) return document;
  const overrides = groupOverrideRecords?.records ?? document.groupOverrideRecords;
  return {
    ...document,
    realKeyRecords: realKeyRecords.records,
    ...(overrides === undefined ? {} : { groupOverrideRecords: overrides }),
    revision: buildPhysicPaintRotoPhysicalRevision(
      realKeyRecords.records,
      document.interpolation,
      document.loopClips,
      document.incomingInterpolationBreakKeyIds,
      overrides ?? [],
    ),
  };
}

/**
 * The mirror install is async (the preserve verifies digests), so two syncs
 * landing back to back would otherwise be able to install out of arrival order
 * and leave the runtime holding the OLDER document. One promise chain keeps
 * every install on the arrival order.
 */
let pendingDocumentMirror: Promise<void> = Promise.resolve();

function scheduleMirrorOfSyncedDocument(document: EfxPaintDocument): void {
  pendingDocumentMirror = pendingDocumentMirror
    .then(() => mirrorSyncedTrackDocuments(document))
    .catch((error) => {
      console.warn(`[physicPaintBridge] EFX Paint runtime mirror failed: ${error instanceof Error ? error.message : String(error)}`);
    });
}

async function mirrorSyncedTrackDocuments(document: EfxPaintDocument): Promise<void> {
  for (const track of document.tracks) {
    if (!track.rotoPhysical) continue;
    if (physicPaintStore.getRotoPhysicalContentRevision(document.parentLayerId, track.id) === track.rotoPhysical.revision) continue;
    const value = await preserveMirroredInlineBytes(document.parentLayerId, track.id, track.rotoPhysical);
    const result = physicPaintStore.mirrorRotoPhysicalDocument(
      document.parentLayerId,
      track.id,
      value,
    );
    if (!result.ok) {
      console.warn(`[physicPaintBridge] EFX Paint runtime mirror skipped for track ${track.id}: ${result.error}`);
    }
  }
}

/**
 * Await the in-flight runtime mirror kicked by a document sync. Never rejects
 * — a failed install is logged and the next sync rebuilds from the pushed
 * document.
 */
export async function awaitPendingPhysicPaintRuntimeMirror(): Promise<void> {
  let pending = pendingDocumentMirror;
  while (true) {
    await pending;
    if (pending === pendingDocumentMirror) return;
    pending = pendingDocumentMirror;
  }
}
/**
 * 47-01: main-window listener for the child's EFX Paint document sync. The
 * incoming payload is validated fail-closed by the canonical parser and
 * re-registered into the main window's efxPaintStore ONLY when the document
 * actually changed (revision-guarded idempotency — the child pushes its
 * document at launch too, where both windows already hold the same document).
 * The save path re-projects frames/rotoPhysical from the main window's own
 * runtime, so the sync only carries the track structure the child owns.
 */
export async function installPhysicPaintEfxPaintDocumentListener(): Promise<() => void> {
  const applyDocument = (payload: unknown) => {
    try {
      // 49-06 (UAT round 11): the child carries its runtime background source
      // bytes with the document sync ({ document, backgroundSources }). Register
      // them BEFORE the revision guard — a re-pushed UNCHANGED document still
      // transfers bytes the parent's project-load hydration missed (a clip added
      // during the child session resolves 'missing' otherwise: the main-app
      // "no Bg render" symptom). registerBackgroundSourceImage is a no-op for an
      // already-identical byte.
      const incoming = payload && typeof payload === 'object' && !Array.isArray(payload)
        ? payload as { document?: unknown; backgroundSources?: unknown; changedBytes?: unknown }
        : {};
      if (incoming.backgroundSources && typeof incoming.backgroundSources === 'object') {
        for (const [ref, encoded] of Object.entries(incoming.backgroundSources)) {
          if (typeof encoded === 'string' && encoded.length > 0) {
            const bytes = decodeSourceBytesForDocumentSync(encoded);
            if (bytes) registerBackgroundSourceImage(ref, bytes);
          }
        }
      }
      // 52.1 (D-05): the child serialized the document's real-key bytes as
      // base64 (emitTo JSON). Decode back to Uint8Array before the canonical
      // parser so the in-memory shape matches the direct path.
      const document = parseEfxPaintDocument(fromTransportPayload(incoming.document ?? payload));
      // 52.2-10 (D-12): the digest decision runs BEFORE the revision guard —
      // a re-pushed UNCHANGED document may still carry (or need) bytes, and
      // the guard below would otherwise return before the byte channel is read.
      applyDocumentSyncFrameMedia(document, incoming.changedBytes);
      const current = getEfxPaintDocument(document.parentLayerId);
      // The sync fingerprint (canonical revision + photo-reference display
      // preferences): a display-only change never bumps the revision but is
      // persisted content, so it must still register here.
      if (current && buildEfxPaintDocumentSyncFingerprint(current) === buildEfxPaintDocumentSyncFingerprint(document)) return;
      registerEfxPaintDocument(document);
      // 47-01 UAT round 8: mirror the child's live runtime into the main
      // window's runtime maps (rotoPhysical only — frame bytes stay owned by
      // the bridge applies) so the apply validation and the save projection
      // always see the child's current records for EVERY track. The mirror is
      // revision-guarded (a no-op when the pushed content matches the parent's
      // current state) and SILENT — it never marks the project dirty and never
      // bumps revisions, so a document sync can never trigger an auto-save
      // (round-7 regression: every sync auto-saved, corrupting saves mid-paint).
      // Best-effort per track: a track under an active operation lease is
      // skipped (fail closed), and tracks without rotoPhysical state are
      // untouched.
      scheduleMirrorOfSyncedDocument(document);
    } catch (error) {
      console.warn('[physicPaintBridge] Rejected EFX Paint document sync:', error instanceof Error ? error.message : String(error));
    }
  };

  if (isTauriRuntime()) {
    try {
      const eventApi = await import('@tauri-apps/api/event') as TauriEventApi;
      const unlisten = await eventApi.listen?.(PHYSIC_PAINT_EFX_PAINT_DOCUMENT_EVENT, (event) => {
        const receiveStartedAtMs = performance.now();
        try {
          applyDocument(event.payload);
        } finally {
          recordPhysicsPaintPerformance({
            stage: 'bridge.docReceive',
            category: 'sync-cpu',
            durationMs: performance.now() - receiveStartedAtMs,
            timestamp: performance.now(),
          });
        }
      });
      if (unlisten) return unlisten;
    } catch (error) {
      console.warn('[physicPaintBridge] Falling back to browser EFX Paint document listener:', error);
    }
  }

  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }

  const customEventListener = (event: Event) => {
    applyDocument((event as CustomEvent).detail);
  };
  const messageListener = (event: MessageEvent) => {
    if (event.origin !== window.location?.origin) return;
    const data = event.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return;
    const message = data as { type?: unknown; payload?: unknown };
    if (message.type !== PHYSIC_PAINT_EFX_PAINT_DOCUMENT_EVENT) return;
    applyDocument(message.payload);
  };
  window.addEventListener(PHYSIC_PAINT_EFX_PAINT_DOCUMENT_EVENT, customEventListener);
  window.addEventListener('message', messageListener);
  return () => {
    window.removeEventListener(PHYSIC_PAINT_EFX_PAINT_DOCUMENT_EVENT, customEventListener);
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
  const target = physicPaintStore.getRotoCacheFrames(layerId, getEfxPaintDocument(layerId)?.activeTrackId ?? '').find((candidate) => candidate.appFrame === displayFrame);
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
  // 46-01: the launch IS the document (D-03) — the launch is created against
  // the document's ACTIVE track, and every runtime read below is track-scoped.
  const trackId = getEfxPaintDocument(layerId)?.activeTrackId ?? '';
  const timelineRange = getLayerLocalTimelineRange(layer);
  if (timelineRange === null) {
    throw new Error('Physics Paint layer has no authoritative parent timeline range.');
  }
  // 260920-ji7 (D-08 CLAMP verdict): the bound is authorized by the LIVE parent
  // end, never by its own previous write-back. min(localEndExclusive, stored)
  // made the first launch freeze the extent (min(80, 40) = 40), so every later
  // sequence extension was refused with 'No remaining Physics Paint sequence
  // capacity is available.' The stored-content floor keeps a parent span that
  // shrinks below stored keys from making those records unparseable — content
  // is never dropped to fit the bound — and PHYSIC_PAINT_MAX_APPLY_FRAMES stays
  // the only ceiling.
  const storedRealKeyRecords = physicPaintStore.getRotoRealKeyRecords(layerId, trackId);
  const storedGroupOverrideRecords = physicPaintStore.getRotoGroupOverrideRecords(layerId, trackId);
  const lastStoredAppFrame = Math.max(
    storedRealKeyRecords[storedRealKeyRecords.length - 1]?.appFrame ?? -1,
    storedGroupOverrideRecords[storedGroupOverrideRecords.length - 1]?.appFrame ?? -1,
  );
  const layerEndExclusive = Math.min(
    PHYSIC_PAINT_MAX_APPLY_FRAMES,
    Math.max(timelineRange.localEndExclusive, lastStoredAppFrame + 1),
  );
  // D-25/Q4 fold: the parent store capacity is the same parent-end bound the
  // carried document carries, so the parent authority and the child document
  // agree on one capacity for semantic-delta validation.
  physicPaintStore.setRotoPhysicalCapacity(layerId, trackId, layerEndExclusive);
  const localFrame = Math.trunc(frame) - timelineRange.globalStart;
  const requestedFrame = Math.max(0, Math.min(layerEndExclusive - 1, localFrame));
  const storedDocument = physicPaintStore.getRotoPhysicalDocument(layerId, trackId);
  const selectedRecord = physicPaintStore.getRotoRealKeyRecordByAppFrame(layerId, trackId, requestedFrame);
  // The carried document's ACTIVE track rotoPhysical is the launch authority:
  // the runtime document (cursor/selection overridden to the requested frame)
  // when one exists, otherwise an injected empty physical document so a fresh
  // AddFxMenu document opens the Studio on the default track. Capacity is
  // overridden to layerEndExclusive so the child's store capacity equals the
  // parent-end bound (D-25/Q4 fold).
  const physical = parsePhysicPaintRotoPhysicalDocument(storedDocument
    ? {
        ...storedDocument,
        capacity: layerEndExclusive,
        selectedKeyId: selectedRecord?.keyId ?? null,
        cursorAppFrame: requestedFrame,
      }
    : {
        capacity: layerEndExclusive,
        realKeyRecords: [],
        interpolation: PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED,
        scriptMotion: PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO,
        background: physicPaintStore.getRotoBackgroundMetadata(layerId, trackId),
        selectedKeyId: null,
        cursorAppFrame: requestedFrame,
        revision: buildPhysicPaintRotoPhysicalRevision([], PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED, []),
      });
  if (storedDocument) physicPaintStore.setRotoPhysicalSelection(layerId, trackId, physical.selectedKeyId, physical.cursorAppFrame);
  const baseDocument = getEfxPaintDocument(layerId);
  if (!baseDocument) {
    throw new Error(`No EFX Paint document for layer "${layerId}".`);
  }
  const carrier: EfxPaintDocument = {
    ...baseDocument,
    tracks: baseDocument.tracks.map((track) => {
      if (track.id === baseDocument.activeTrackId) return { ...track, rotoPhysical: physical };
      // 48-06 (P1): EVERY track rides the parent's LIVE runtime — the apply
      // and save authority — never the persisted document's rotoPhysical. The
      // document can lag the runtime by an entire previous session (an apply
      // that never reached a save), and a child hydrated from the stale
      // document fails every parent revalidation on that track ("Roto
      // physical revision became stale before commit"), freezing it.
      const runtime = physicPaintStore.extractRuntimeStateForDocument(layerId, track.id);
      return { ...track, rotoPhysical: runtime.rotoPhysical ?? track.rotoPhysical };
    }),
  };
  const playbackSettings = physicPaintStore.getRotoPlaybackSettings(layerId, trackId) ?? {
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
    startFrame: physical.cursorAppFrame,
    ...(isFinitePositiveNumber(canvas?.width) ? { width: canvas.width } : {}),
    ...(isFinitePositiveNumber(canvas?.height) ? { height: canvas.height } : {}),
    ...(isFinitePositiveNumber(fps) ? { fps } : {}),
    rotoPlayback: playbackSettings,
    // Absent section = no audio; keeps existing audio-less launches byte-stable.
    ...(audioStore.tracks.peek().length > 0 ? { audioPreview: buildPhysicPaintAudioPreviewSection() } : {}),
    document: carrier,
  };
  const validated = parseCanonicalPhysicsPaintLaunchValue(context);
  if (!validated) throw new Error('Could not construct a canonical physical launch context.');
  return validated;
}

export async function openPhysicPaintCanvas(request: PhysicPaintOpenRequest): Promise<Result<PhysicPaintLaunchContext>> {
  try {
    const validation = validateOpenRequest(request);
    if (!validation.ok) return validation;

    // debug studio-reopen-empty-boot: the launch pack is a declared
    // byte-requiring consumer (efxPaintMediaMaterialize.ts), and the docSync
    // receive mirror can leave this runtime's records reference-only. The
    // door re-materializes before the pack is built — bridged bytes first (no
    // IO), then the digest-verified package read — and a per-key failure is
    // LOUD but never blocks the launch: the child's tolerant launch seed
    // renders the frame as missing content (quick-260913-52r G doctrine).
    const launchLayer = validation.data.layer;
    const launchLayerId = launchLayer.source.type === 'physic-paint' ? launchLayer.source.layerId : launchLayer.id;
    const launchMediaFailures = await physicPaintStore.materializeRuntimeRotoMediaBytes(launchLayerId);
    for (const failure of launchMediaFailures) {
      console.warn(
        `[physicPaintBridge] launch frame media "${failure.relativePath}" (track "${failure.trackId}", key "${failure.keyId}", ${failure.collection}) could not be materialized: ${failure.reason}. The record stays reference-only and the Studio boots it as missing content.`,
      );
    }

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
    // 52.1 (D-05): invoke serializes the context as JSON, which turns the
    // document's real-key `bytes` (Uint8Array) into index objects. Convert
    // bytes -> base64 so the child's launch validator sees the canonical
    // string form instead of a corrupted array.
    const result = await core.invoke<TauriPhysicsPaintLaunchResult>('open_physics_paint_window', { context: toTransportPayload(context) });
    if (!isTauriPhysicsPaintLaunchResult(result)) {
      return { ok: false, error: `Physics paint native command returned an invalid result: ${JSON.stringify(result)}` };
    }
    if (!result.visible || result.minimized) {
      return { ok: false, error: `Physics paint window did not become visible (visible=${result.visible}, minimized=${result.minimized})` };
    }
    // 47-05 crash instrumentation: the black-window class follows display
    // sleep; this line proves whether the native guard was actually held for
    // this session (false => the display could sleep and the window could
    // black out regardless of the engine's GPU-load fixes).
    console.log(`[physics-paint] window open — display-sleep assertion active: ${result.displaySleepAsserted}`);
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
      typeof (value as TauriPhysicsPaintLaunchResult).minimized === 'boolean' &&
      typeof (value as TauriPhysicsPaintLaunchResult).displaySleepAsserted === 'boolean',
  );
}

function getLayerLocalTimelineRange(layer: Layer) {
  const sequence = sequenceStore.sequences.peek().find((candidate) => candidate.layers.some((candidateLayer) => candidateLayer.id === layer.id));
  return sequence ? resolveSequenceTimelineRange(sequence, trackLayouts.peek()) : null;
}

function getTimelineRangeEndExclusive(layer: Layer): number | null {
  return getLayerLocalTimelineRange(layer)?.localEndExclusive ?? null;
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
  baseUrl.searchParams.set('context', JSON.stringify(toTransportPayload(context)));
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

/**
 * 52.1 (D-06): document-sync boundary conversion. The child→main document
 * sync is a JSON event carrying the hydrated Background source images; JSON
 * cannot carry raw bytes compactly, so the sync payload holds base64 at this
 * persistence boundary ONLY. The frame apply path never uses these — it
 * transports raw bytes via invoke (D-07).
 */
export function encodeSourceBytesForDocumentSync(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

export function decodeSourceBytesForDocumentSync(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}
