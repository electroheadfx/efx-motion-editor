/**
 * Generic acknowledged physical-edit coordinator (Plan 36.14-04 Task 2,
 * completed by Plan 36.14-21 exact snapshot replay).
 *
 * This is the sole active physical-edit transaction authority for Insert,
 * Delete, Move, Force Spacing, Duplicate, Paste, canonical interpolation,
 * Undo, and Redo.
 *
 * Per D-09/D-10: the coordinator owns one serialized acknowledged
 * physical-edit lifecycle:
 * - serialize to one pending edit (a second execute rejects before any
 *   barrier or mutation);
 * - pre-stage barriers: flush pending strokes, flush live pixels, then
 *   revalidate launch, layer, expected revision, selected identity, and
 *   capacity;
 * - capture one deeply immutable complete snapshot of every affected
 *   store, cache, edit-buffer, engine, reference, selection, cursor, and
 *   context category;
 * - identity-keyed complete rebuild: stage ordinary/replay proposals locally;
 *   interpolation operations defer their unchanged-record targets until exact
 *   parent acceptance so accepted UI state never changes early;
 * - register one generic settlement and send one parent payload;
 * - start one timeout;
 * - on matching result: revalidate current launch and staged revision, then
 *   expose immutable before/after accepted output (no history advancement);
 * - on rejection, timeout, transport failure, exception, settlement
 *   mismatch, launch replacement, or disposal: restore every captured
 *   category once, clear resources once, and publish a fresh monotonic
 *   invalidation rather than restoring an old numeric visual version.
 *
 * Preact-native implementation:
 * - observable pending/presentation state uses `signal`/`computed` from
 *   `@preact/signals`;
 * - stable refs own the timer, settlement record, and external lifecycle
 *   callbacks;
 * - no `useState` mirrors of coordinator state; no synchronization effects.
 *
 * Script Motion is outside the transaction per D-04.
 */

import { useCallback, useEffect, useRef } from 'preact/hooks';
import { computed, useSignal, type ReadonlySignal } from '@preact/signals';
import type { SerializedProject } from '@efxlab/efx-physic-paint';
import {
  isPhysicPaintRotoBackgroundMetadata,
  isPhysicPaintRotoPhysicalEditApplyResult,
  isPhysicPaintRotoPhysicalEditIntent,
} from '../../../types/physicPaint';
import type {
  PhysicPaintApplyResult,
  PhysicPaintRotoBackgroundMetadata,
  PhysicPaintRotoPhysicalEditApplyPayload,
  PhysicPaintRotoPhysicalEditApplyResult,
  PhysicPaintRotoPhysicalEditIntent,
  PhysicPaintRotoPhysicalEditOperationKind,
  PhysicPaintRotoPhysicalEditSemanticDelta,
} from '../../../types/physicPaint';
import type {
  PhysicPaintRotoInterpolationState,
  PhysicPaintRotoLoopClip,
  PhysicPaintRotoPhysicalDocument,
  PhysicPaintRotoRealKeyPayload,
  PhysicPaintRotoRealKeyRecord,
} from '../roto/physicsPaintRotoPhysicalModel';
import {
  buildPhysicPaintRotoPhysicalRevision,
  buildPhysicPaintRotoProjectEquality,
  isPhysicPaintRotoInterpolationState,
  parsePhysicPaintRotoLoopClips,
  parsePhysicPaintRotoRealKeyRecordCollection,
} from '../roto/physicsPaintRotoPhysicalModel';
import {
  proposePhysicPaintRotoDeleteGroup,
  proposePhysicPaintRotoDeleteGroupFrame,
  proposePhysicPaintRotoGroupFramePaint,
  type PhysicPaintRotoGroupFramePaintImpact,
} from '../roto/physicsPaintRotoGroupLifecycle';
import type { PhysicPaintRotoPhysicalOperationLeaseToken } from '../../../stores/physicPaintStore';
import type { PhysicPaintRotoPhysicalEditProposal } from '../roto/physicsPaintRotoPhysicalResolver';
import { validatePhysicPaintRotoPhysicalEditSemanticDelta } from '../roto/physicsPaintRotoPhysicalResolver';
import { isRotoPngDataUrl } from '../roto/rotoCanvasFrames';
import type {
  PendingPhysicPaintRotoPhysicalEdit,
  RotoPhysicalEditAcceptedOutput,
  RotoPhysicalEditCoordinatorPorts,
  RotoPhysicalEditExecuteInput,
  RotoPhysicalEditFailureOutput,
  RotoPhysicalEditPresentation,
  RotoPhysicalEditSnapshot,
} from '../roto/rotoCoordinatorPorts';

const PHYSICAL_EDIT_TIMEOUT_MS = 5000;
const PHYSICAL_EDIT_PENDING_MESSAGE = 'Applying Roto physical edit...';
const PHYSICAL_EDIT_ACCEPTED_MESSAGE = 'Roto physical edit applied.';
const PHYSICAL_EDIT_FAILED_MESSAGE = 'Apply failed — see LOG';
const PHYSICAL_EDIT_TRANSPORT_MESSAGE = 'Could not send the Roto physical edit. The previous state was restored.';
const PHYSICAL_EDIT_TIMEOUT_MESSAGE = 'Roto physical edit timed out. The previous state was restored.';
const PHYSICAL_EDIT_MISMATCH_MESSAGE = 'Roto physical edit settlement mismatch. The previous state was restored.';
const PHYSICAL_EDIT_BARRIER_MESSAGE = 'Roto physical edit barriers failed. No state was changed.';
const PHYSICAL_EDIT_SERIALIZE_MESSAGE = 'A Roto physical edit is already in flight.';
const PHYSICAL_EDIT_RESULT_MISMATCH_MESSAGE = 'Ignored mismatched physics paint physical edit result. Try the action again.';

export type PhysicPaintRotoGroupFramePaintPublicationFailureReason =
  | 'lease-unavailable'
  | 'stale'
  | 'malformed'
  | 'changed-payload'
  | 'missing-token'
  | 'mismatched-token'
  | 'replayed-token'
  | 'unresolved-precedence'
  | 'cleanup-reference-mismatch';

export interface PhysicPaintRotoGroupFramePaintTransactionInput {
  readonly projectContextId: string;
  readonly layerId: string;
  readonly launchOperationId: string;
  readonly groupId: string;
  readonly appFrame: number;
  readonly overrideKeyId: string;
  readonly renderedPayload: PhysicPaintRotoRealKeyPayload;
  readonly unresolvedPrecedence?: boolean;
  readonly claimedCleanupKeyIds?: readonly string[];
}

export interface PhysicPaintRotoGroupFramePaintPublicationRequest
  extends PhysicPaintRotoGroupFramePaintTransactionInput {
  readonly operationId: string;
  readonly expectedRevision: string;
  readonly expectedProjectEquality: string;
  readonly proposal: PhysicPaintRotoPhysicalDocument;
  readonly impact: PhysicPaintRotoGroupFramePaintImpact;
  readonly leaseToken: PhysicPaintRotoPhysicalOperationLeaseToken;
}

export type PhysicPaintRotoGroupFramePaintPublicationResult =
  | Readonly<{
      ok: true;
      acceptedDocument: PhysicPaintRotoPhysicalDocument;
      historyCommandId: string;
    }>
  | Readonly<{
      ok: false;
      reason: PhysicPaintRotoGroupFramePaintPublicationFailureReason;
    }>;

export interface PhysicPaintRotoGroupFramePaintHistoryCommand {
  readonly commandId: string;
  readonly before: PhysicPaintRotoPhysicalDocument;
  readonly after: PhysicPaintRotoPhysicalDocument;
  readonly impact: PhysicPaintRotoGroupFramePaintImpact;
}

export interface PhysicPaintRotoGroupFramePaintTransactionPorts {
  readonly acquireLease: (
    projectContextId: string,
    layerId: string,
  ) => PhysicPaintRotoPhysicalOperationLeaseToken | null;
  readonly getAcceptedDocument: (layerId: string) => PhysicPaintRotoPhysicalDocument | null;
  readonly publish: (
    request: PhysicPaintRotoGroupFramePaintPublicationRequest,
  ) => Promise<PhysicPaintRotoGroupFramePaintPublicationResult>;
  readonly recordHistory: (command: PhysicPaintRotoGroupFramePaintHistoryCommand) => void;
  readonly releaseLease: (token: PhysicPaintRotoPhysicalOperationLeaseToken) => boolean;
  readonly createOperationId: () => string;
}

/**
 * Execute the first exact-occurrence Group Paint authority transaction.
 * Acquisition precedes the final snapshot; history is inserted only after an
 * accepted parent settlement; release is terminal and unconditional.
 */
export async function executePhysicPaintRotoGroupFramePaintTransaction(
  input: PhysicPaintRotoGroupFramePaintTransactionInput,
  ports: PhysicPaintRotoGroupFramePaintTransactionPorts,
): Promise<PhysicPaintRotoGroupFramePaintPublicationResult> {
  const leaseToken = ports.acquireLease(input.projectContextId, input.layerId);
  if (!leaseToken) return Object.freeze({ ok: false, reason: 'lease-unavailable' });
  try {
    const before = ports.getAcceptedDocument(input.layerId);
    if (!before) return Object.freeze({ ok: false, reason: 'stale' });
    const proposed = proposePhysicPaintRotoGroupFramePaint({
      document: before,
      groupId: input.groupId,
      appFrame: input.appFrame,
      overrideKeyId: input.overrideKeyId,
      renderedPayload: input.renderedPayload,
      unresolvedPrecedence: input.unresolvedPrecedence,
      claimedCleanupKeyIds: input.claimedCleanupKeyIds,
    });
    if (!proposed.ok) {
      const reason = proposed.reason === 'unresolved-precedence'
        ? 'unresolved-precedence'
        : proposed.reason === 'cleanup-reference-mismatch'
          ? 'cleanup-reference-mismatch'
          : 'malformed';
      return Object.freeze({ ok: false, reason });
    }
    const operationId = ports.createOperationId();
    const settlement = await ports.publish(Object.freeze({
      ...input,
      operationId,
      expectedRevision: before.revision,
      expectedProjectEquality: buildPhysicPaintRotoProjectEquality(before),
      proposal: proposed.proposal,
      impact: proposed.impact,
      leaseToken,
    }));
    if (!settlement.ok) return settlement;
    ports.recordHistory(Object.freeze({
      commandId: settlement.historyCommandId,
      before,
      after: settlement.acceptedDocument,
      impact: proposed.impact,
    }));
    return settlement;
  } finally {
    ports.releaseLease(leaseToken);
  }
}

/**
 * Inline result transition (Plan 36.14-05 Task 3 moved from the deleted
 * `rotoApplyTransactions.ts`). The coordinator classifies a closed
 * physical apply result against its pending tuple without clearing pending
 * ownership — only a matching terminal result settles.
 */
type PhysicalEditResultTransition =
  | { readonly type: 'ignore' }
  | { readonly type: 'mismatch'; readonly message: string }
  | { readonly type: 'accepted'; readonly ok: boolean; readonly detail: PhysicPaintRotoPhysicalEditApplyResult };

interface PendingPhysicalEditContext extends PendingPhysicPaintRotoPhysicalEdit {
  readonly selectedKeyId: string | null;
  readonly selectedAppFrame: number | null;
  readonly appliedFrameCount: number;
  readonly semanticDelta: PhysicPaintRotoPhysicalEditSemanticDelta | null;
  readonly historyProvenance: import('../../../types/physicPaint').PhysicPaintRotoPhysicalEditReplayProvenance | null;
  readonly stagedIncomingInterpolationBreakKeyIds: readonly string[];
  readonly deferredRecords: readonly PhysicPaintRotoRealKeyRecord[] | null;
  readonly deferredInterpolation: PhysicPaintRotoInterpolationState | null;
  readonly deferredLoopClips: readonly PhysicPaintRotoLoopClip[] | null;
  readonly stagedLocally: boolean;
}

export interface RotoInterpolationEnabledExecuteInput {
  readonly operationKind: 'set-interpolation-enabled';
  readonly expectedLaunch: { readonly operationId: string; readonly layerId: string };
  readonly records: readonly PhysicPaintRotoRealKeyRecord[];
  readonly targetInterpolation: PhysicPaintRotoInterpolationState;
  readonly selectedKeyId: string | null;
  readonly selectedAppFrame: number | null;
}

export interface RotoInterpolationModeExecuteInput {
  readonly operationKind: 'set-interpolation-mode';
  readonly expectedLaunch: { readonly operationId: string; readonly layerId: string };
  readonly records: readonly PhysicPaintRotoRealKeyRecord[];
  readonly targetInterpolation: PhysicPaintRotoInterpolationState;
  readonly selectedKeyId: string | null;
  readonly selectedAppFrame: number | null;
}

export interface RotoPlayScriptExecuteInput {
  readonly operationKind: 'play-script';
  readonly expectedLaunch: { readonly operationId: string; readonly layerId: string };
  readonly expectedRevision: string;
  readonly records: readonly PhysicPaintRotoRealKeyRecord[];
  readonly interpolationEnabled: boolean;
  readonly interpolationMode: PhysicPaintRotoInterpolationState['mode'];
  readonly rotoBackground: PhysicPaintRotoBackgroundMetadata;
  readonly semanticDelta: Extract<PhysicPaintRotoPhysicalEditSemanticDelta, { readonly kind: 'play-script' }>;
  readonly selectedKeyId: string | null;
  readonly selectedAppFrame: number | null;
  /**
   * Complete staged Loop Clip collection (43-06). Present when the op changes
   * loop state; absent stages the layer's current collection unchanged.
   */
  readonly loopClips?: readonly PhysicPaintRotoLoopClip[];
}

export interface RotoGroupFramePaintExecuteInput {
  readonly operationKind: 'paint-group-frame';
  readonly expectedLaunch: { readonly operationId: string; readonly layerId: string };
  readonly groupId: string;
  readonly appFrame: number;
  readonly overrideKeyId: string;
  readonly renderedPayload: PhysicPaintRotoRealKeyPayload;
}

export interface RotoGroupLifecycleDeleteExecuteInput {
  readonly operationKind: 'delete-group-frame' | 'delete-group';
  readonly expectedLaunch: { readonly operationId: string; readonly layerId: string };
  readonly groupId: string;
  readonly appFrame: number;
}

type RotoGroupLifecycleDeleteImpact = Extract<
  PhysicPaintRotoPhysicalEditSemanticDelta,
  { readonly kind: 'delete-group-frame' | 'delete-group' }
>;

export type RotoPhysicalEditCoordinatorExecuteInput<EngineState = unknown> =
  | RotoPhysicalEditExecuteInput<PhysicPaintRotoPhysicalEditProposal, EngineState>
  | RotoInterpolationEnabledExecuteInput
  | RotoInterpolationModeExecuteInput
  | RotoPlayScriptExecuteInput
  | RotoGroupFramePaintExecuteInput
  | RotoGroupLifecycleDeleteExecuteInput;

type PhysicalEditPayloadBase = Omit<
  PhysicPaintRotoPhysicalEditApplyPayload,
  'operationKind' | 'intent'
>;

/**
 * Close the TypeScript discriminant at the transport boundary. Ordinary kinds
 * are paired with their already runtime-validated exact intent; specialized
 * kinds are emitted only when no ordinary intent is present.
 */
function createAuthorizedPhysicalEditPayload(
  base: PhysicalEditPayloadBase,
  operationKind: PhysicPaintRotoPhysicalEditOperationKind,
  intent: PhysicPaintRotoPhysicalEditIntent | undefined,
): PhysicPaintRotoPhysicalEditApplyPayload | null {
  switch (operationKind) {
    case 'insert-slot':
      return intent?.kind === 'insert-slot' ? { ...base, operationKind, intent } : null;
    case 'insert-empty-segment':
      return intent?.kind === 'insert-empty-segment' ? { ...base, operationKind, intent } : null;
    case 'delete-key':
      return intent?.kind === 'delete-key' ? { ...base, operationKind, intent } : null;
    case 'delete-key-group':
      return intent?.kind === 'delete-key-group' ? { ...base, operationKind, intent } : null;
    case 'move-key':
      return intent?.kind === 'move-key' ? { ...base, operationKind, intent } : null;
    case 'move-key-group':
      return intent?.kind === 'move-key-group' ? { ...base, operationKind, intent } : null;
    case 'force-spacing':
      return intent?.kind === 'force-spacing' ? { ...base, operationKind, intent } : null;
    case 'duplicate-key':
      return intent?.kind === 'duplicate-key' ? { ...base, operationKind, intent } : null;
    case 'paste-key':
      return intent?.kind === 'paste-key' ? { ...base, operationKind, intent } : null;
    case 'paste-key-group':
      return intent?.kind === 'paste-key-group' ? { ...base, operationKind, intent } : null;
    case 'play-script':
    case 'paint-group-frame':
    case 'delete-group-frame':
    case 'delete-group':
    case 'regenerate-group':
    case 'detach-action-groups':
    case 'delete-action-groups':
    case 'set-interpolation-enabled':
    case 'set-interpolation-mode':
    case 'undo':
    case 'redo':
      return intent === undefined ? { ...base, operationKind } : null;
  }
}

function semanticDeltaEquals(
  left: PhysicPaintRotoPhysicalEditSemanticDelta | null | undefined,
  right: PhysicPaintRotoPhysicalEditSemanticDelta | null | undefined,
): boolean {
  if (!left || !right) return !left && !right;
  if (left.kind !== right.kind) return false;
  if (left.kind === 'duplicate-key' && right.kind === 'duplicate-key') {
    return left.sourceKeyId === right.sourceKeyId && left.newKeyId === right.newKeyId;
  }
  if (left.kind === 'insert-empty-segment' && right.kind === 'insert-empty-segment') {
    return left.insertedKeyId === right.insertedKeyId
      && left.destinationAppFrame === right.destinationAppFrame;
  }
  if (left.kind === 'play-script' && right.kind === 'play-script') {
    return left.affectedStartAppFrame === right.affectedStartAppFrame
      && left.affectedEndAppFrame === right.affectedEndAppFrame
      && left.expectedLayerCapacity === right.expectedLayerCapacity
      && left.expectedLayerEndExclusive === right.expectedLayerEndExclusive
      && stringArraysEqual(left.freshKeyIds, right.freshKeyIds)
      && applyPayloadRecordsEqual(left.proposedRecords, right.proposedRecords);
  }
  if (left.kind === 'paint-group-frame' && right.kind === 'paint-group-frame') {
    return left.groupId === right.groupId
      && left.appFrame === right.appFrame
      && left.overrideKeyId === right.overrideKeyId
      && left.createdOverride === right.createdOverride
      && left.filledDeletedOccurrence === right.filledDeletedOccurrence
      && left.previousRevision === right.previousRevision
      && left.nextRevision === right.nextRevision;
  }
  if (left.kind === 'delete-group-frame' && right.kind === 'delete-group-frame') {
    return left.groupId === right.groupId
      && left.appFrame === right.appFrame
      && stringArraysEqual(left.cleanupKeyIds, right.cleanupKeyIds)
      && left.previousRevision === right.previousRevision
      && left.nextRevision === right.nextRevision;
  }
  if (left.kind === 'delete-group' && right.kind === 'delete-group') {
    return left.groupId === right.groupId
      && stringArraysEqual(left.cleanupKeyIds, right.cleanupKeyIds)
      && left.previousRevision === right.previousRevision
      && left.nextRevision === right.nextRevision;
  }
  if (left.kind === 'paste-key-group' && right.kind === 'paste-key-group') {
    if (left.destinationAppFrame !== right.destinationAppFrame) return false;
    if (left.entries.length !== right.entries.length) return false;
    for (let index = 0; index < left.entries.length; index += 1) {
      const leftEntry = left.entries[index];
      const rightEntry = right.entries[index];
      if (!leftEntry || !rightEntry) return false;
      if (leftEntry.sourceAppFrame !== rightEntry.sourceAppFrame
        || leftEntry.sourceKeyId !== rightEntry.sourceKeyId
        || leftEntry.newKeyId !== rightEntry.newKeyId
        || leftEntry.payload.frameIndex !== rightEntry.payload.frameIndex
        || leftEntry.payload.appFrame !== rightEntry.payload.appFrame
        || leftEntry.payload.dataUrl !== rightEntry.payload.dataUrl
        || leftEntry.payload.width !== rightEntry.payload.width
        || leftEntry.payload.height !== rightEntry.payload.height) {
        return false;
      }
    }
    return true;
  }
  if (left.kind !== 'paste-key' || right.kind !== 'paste-key') return false;
  const leftPayload = left.clipboardPayload;
  const rightPayload = right.clipboardPayload;
  return left.destinationAppFrame === right.destinationAppFrame
    && left.destinationKeyId === right.destinationKeyId
    && left.newKeyId === right.newKeyId
    && leftPayload.frameIndex === rightPayload.frameIndex
    && leftPayload.appFrame === rightPayload.appFrame
    && leftPayload.dataUrl === rightPayload.dataUrl
    && leftPayload.width === rightPayload.width
    && leftPayload.height === rightPayload.height;
}

function replayProvenanceEquals(
  left: import('../../../types/physicPaint').PhysicPaintRotoPhysicalEditReplayProvenance | null | undefined,
  right: import('../../../types/physicPaint').PhysicPaintRotoPhysicalEditReplayProvenance | null | undefined,
): boolean {
  if (!left || !right) return !left && !right;
  return left.historyCommandId === right.historyCommandId
    && left.historyDirection === right.historyDirection
    && left.sourceRevision === right.sourceRevision
    && left.targetRevision === right.targetRevision;
}

function transitionPhysicalEditResult(
  pending: PendingPhysicalEditContext | null,
  detail: PhysicPaintRotoPhysicalEditApplyResult | null | undefined,
): PhysicalEditResultTransition {
  if (!detail || !pending) return { type: 'ignore' };
  if (detail.operationId !== pending.operationId) return { type: 'ignore' };
  if (
    detail.kind !== 'replace-roto-physical-map'
    || detail.operationKind !== pending.operationKind
    || detail.layerId !== pending.layerId
    || detail.startFrame !== pending.startFrame
    || detail.launchOperationId !== pending.launchOperationId
    || (pending.projectContextId === null ? detail.projectContextId !== undefined : detail.projectContextId !== pending.projectContextId)
    || detail.expectedRevision !== pending.expectedRevision
    || detail.stagedRevision !== pending.stagedRevision
    || detail.interpolationMode !== pending.interpolationMode
    || detail.selectedKeyId !== pending.selectedKeyId
    || detail.selectedAppFrame !== pending.selectedAppFrame
    || detail.appliedFrameCount !== (detail.ok ? pending.appliedFrameCount : 0)
    || !semanticDeltaEquals(detail.semanticDelta, pending.semanticDelta)
    || !replayProvenanceEquals(detail.historyProvenance, pending.historyProvenance)
    || (detail.ok && !stringArraysEqual(
      detail.incomingInterpolationBreakKeyIds ?? [],
      pending.stagedIncomingInterpolationBreakKeyIds,
    ))
    || (detail.ok ? detail.acceptedRevision !== pending.stagedRevision : detail.acceptedRevision !== null)
  ) {
    return { type: 'mismatch', message: PHYSICAL_EDIT_RESULT_MISMATCH_MESSAGE };
  }
  return { type: 'accepted', ok: detail.ok, detail };
}

function clonePayloadAtFrame(
  payload: PhysicPaintRotoRealKeyRecord['payload'],
  appFrame: number,
): PhysicPaintRotoRealKeyRecord['payload'] {
  return {
    frameIndex: payload.frameIndex,
    appFrame,
    dataUrl: payload.dataUrl,
    ...(payload.width !== undefined ? { width: payload.width } : {}),
    ...(payload.height !== undefined ? { height: payload.height } : {}),
  };
}

function cloneRecords(records: readonly PhysicPaintRotoRealKeyRecord[]): PhysicPaintRotoRealKeyRecord[] {
  return records.map((record) => ({
    kind: 'real-key' as const,
    keyId: record.keyId,
    appFrame: record.appFrame,
    payload: {
      frameIndex: record.payload.frameIndex,
      appFrame: record.payload.appFrame,
      dataUrl: record.payload.dataUrl,
      ...(record.payload.width !== undefined ? { width: record.payload.width } : {}),
      ...(record.payload.height !== undefined ? { height: record.payload.height } : {}),
    },
  }));
}

function cloneIncomingInterpolationBreakKeyIds(keyIds: readonly string[]): string[] {
  return [...keyIds];
}

function cloneLoopClips(loopClips: readonly PhysicPaintRotoLoopClip[]): PhysicPaintRotoLoopClip[] {
  return parsePhysicPaintRotoLoopClips(loopClips).map((clip) => ({
    loopId: clip.loopId,
    placementStart: clip.placementStart,
    sourceKeyIds: [...clip.sourceKeyIds],
    repeat: clip.repeat,
    mode: clip.mode,
    // 43-06 provenance rides every clone.
    ...(clip.scriptId !== undefined
      ? { scriptId: clip.scriptId, motion: { ...clip.motion! }, overrideColor: clip.overrideColor ?? null }
      : {}),
    ...(clip.syncState !== undefined
      ? {
          syncState: clip.syncState,
          provenanceState: clip.provenanceState!,
          phaseOrigin: clip.phaseOrigin!,
          originalEndExclusive: clip.originalEndExclusive!,
          visibleRanges: clip.visibleRanges!.map((range) => ({ ...range })),
          frameOverrides: clip.frameOverrides!.map((override) => ({ ...override })),
        }
      : {}),
  }));
}

function recordsEqual(
  left: readonly PhysicPaintRotoRealKeyRecord[],
  right: readonly PhysicPaintRotoRealKeyRecord[],
): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const leftRecord = left[index];
    const rightRecord = right[index];
    if (leftRecord.keyId !== rightRecord.keyId
      || leftRecord.appFrame !== rightRecord.appFrame
      || leftRecord.payload.frameIndex !== rightRecord.payload.frameIndex
      || leftRecord.payload.appFrame !== rightRecord.payload.appFrame
      || leftRecord.payload.dataUrl !== rightRecord.payload.dataUrl
      || leftRecord.payload.width !== rightRecord.payload.width
      || leftRecord.payload.height !== rightRecord.payload.height) return false;
  }
  return true;
}

function applyPayloadRecordsEqual(
  left: readonly import('../../../types/physicPaint').PhysicPaintRotoPhysicalEditRecord[],
  right: readonly import('../../../types/physicPaint').PhysicPaintRotoPhysicalEditRecord[],
): boolean {
  if (left.length !== right.length) return false;
  return left.every((record, index) => {
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

function stringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function validatePlayScriptInput(
  input: RotoPlayScriptExecuteInput,
  currentRecords: readonly PhysicPaintRotoRealKeyRecord[],
  currentInterpolation: PhysicPaintRotoInterpolationState,
  capacity: number,
): string | null {
  const delta = input.semanticDelta;
  if (!isPhysicPaintRotoBackgroundMetadata(input.rotoBackground)) {
    return 'Play Script background metadata is invalid.';
  }
  // 43-06: a loop-only declaration (empty affected range) changes loop state
  // only; a preserveSelection declaration keeps the current selection instead
  // of selecting the range start (source-edit/repair open from a Loop Clip).
  const loopOnly = delta.loopOnly === true;
  const preserveSelection = loopOnly || delta.preserveSelection === true;
  if (input.expectedRevision.length === 0
    || input.interpolationEnabled !== currentInterpolation.enabled
    || input.interpolationMode !== currentInterpolation.mode
    || delta.expectedLayerCapacity !== capacity
    || (!preserveSelection && delta.affectedStartAppFrame !== input.selectedAppFrame)
    || (!loopOnly && delta.affectedEndAppFrame < delta.affectedStartAppFrame)
    || (loopOnly && delta.affectedEndAppFrame !== delta.affectedStartAppFrame - 1)
    || delta.expectedLayerEndExclusive <= delta.affectedEndAppFrame
    || delta.expectedLayerEndExclusive > capacity) return 'Play Script range, capacity, revision, or interpolation metadata is stale.';

  const proposedPayloadRecords = recordsToApplyPayloadRecords(input.records);
  if (!applyPayloadRecordsEqual(proposedPayloadRecords, delta.proposedRecords)) return 'Play Script semantic records do not match the complete physical proposal.';

  const currentByFrame = new Map(currentRecords.map((record) => [record.appFrame, record]));
  const currentIds = new Set(currentRecords.map((record) => record.keyId));
  const proposedByFrame = new Map<number, PhysicPaintRotoRealKeyRecord>();
  const proposedIds = new Set<string>();
  for (const record of input.records) {
    if (proposedByFrame.has(record.appFrame)
      || proposedIds.has(record.keyId)
      || record.payload.appFrame !== record.appFrame) return 'Play Script proposal contains duplicate or misplaced physical identity.';
    proposedByFrame.set(record.appFrame, record);
    proposedIds.add(record.keyId);
  }

  for (const current of currentRecords) {
    if (current.appFrame >= delta.affectedStartAppFrame && current.appFrame <= delta.affectedEndAppFrame) continue;
    const proposed = proposedByFrame.get(current.appFrame);
    if (!proposed || !recordsEqual([current], [proposed])) return 'Play Script proposal changed or omitted an out-of-range physical record.';
  }
  for (const proposed of input.records) {
    if (proposed.appFrame < delta.affectedStartAppFrame || proposed.appFrame > delta.affectedEndAppFrame) {
      const current = currentByFrame.get(proposed.appFrame);
      if (!current || !recordsEqual([current], [proposed])) return 'Play Script proposal introduced an out-of-range physical record.';
    }
  }

  const expectedFreshIds: string[] = [];
  for (let appFrame = delta.affectedStartAppFrame; appFrame <= delta.affectedEndAppFrame; appFrame += 1) {
    const proposed = proposedByFrame.get(appFrame);
    if (!proposed || !isRotoPngDataUrl(proposed.payload.dataUrl)) return 'Play Script proposal is missing a valid PNG destination record.';
    const current = currentByFrame.get(appFrame);
    if (current) {
      if (proposed.keyId !== current.keyId) return 'Play Script proposal changed an occupied destination identity.';
    } else {
      if (currentIds.has(proposed.keyId)) return 'Play Script proposal reused an existing identity for an empty destination.';
      expectedFreshIds.push(proposed.keyId);
    }
  }
  if (!stringArraysEqual(expectedFreshIds, delta.freshKeyIds)
    || new Set(delta.freshKeyIds).size !== delta.freshKeyIds.length) return 'Play Script fresh identity declaration does not match the affected empty destinations.';
  if (!preserveSelection) {
    if (input.selectedAppFrame === null || input.selectedKeyId === null) return 'Play Script selected identity does not match the accepted start destination.';
    const selected = proposedByFrame.get(input.selectedAppFrame);
    if (!selected || selected.keyId !== input.selectedKeyId) return 'Play Script selected identity does not match the accepted start destination.';
  }
  return null;
}

function cloneFrameMap(map: ReadonlyMap<number, unknown>): Map<number, unknown> {
  const next = new Map<number, unknown>();
  for (const [key, value] of map) next.set(key, value);
  return next;
}

function cloneSet(set: ReadonlySet<number>): Set<number> {
  return new Set(set);
}

function cloneCounts(map: ReadonlyMap<number, number>): Map<number, number> {
  const next = new Map<number, number>();
  for (const [key, value] of map) next.set(key, value);
  return next;
}

function recordsToApplyPayloadRecords(records: readonly PhysicPaintRotoRealKeyRecord[]) {
  return records.map((record) => ({
    keyId: record.keyId,
    appFrame: record.appFrame,
    payload: {
      frameIndex: record.payload.frameIndex,
      appFrame: record.payload.appFrame,
      dataUrl: record.payload.dataUrl,
      ...(record.payload.width !== undefined ? { width: record.payload.width } : {}),
      ...(record.payload.height !== undefined ? { height: record.payload.height } : {}),
    },
  }));
}

function replayProposalMatchesTarget(
  proposal: PhysicPaintRotoPhysicalEditProposal,
  target: RotoPhysicalEditSnapshot<unknown>,
): boolean {
  if (proposal.mapping.size !== target.records.length) return false;
  if (proposal.selectedKeyId !== target.selectedKeyId || proposal.selectedAppFrame !== target.selectedAppFrame) return false;
  for (const record of target.records) {
    if (proposal.mapping.get(record.keyId) !== record.appFrame) return false;
  }
  return true;
}

/**
 * Inline pending-record constructor (Plan 36.14-05 Task 3 moved from the
 * deleted `rotoApplyTransactions.ts`). Captures the complete pending tuple
 * from a validated apply payload and the staged revision computed from the
 * payload's complete records.
 */
function createPendingPhysicalEdit(
  payload: PhysicPaintRotoPhysicalEditApplyPayload,
  stagedRevision: string,
  deferredTarget?: {
    readonly records: readonly PhysicPaintRotoRealKeyRecord[];
    readonly interpolation: PhysicPaintRotoInterpolationState;
    readonly loopClips?: readonly PhysicPaintRotoLoopClip[];
  },
): PendingPhysicalEditContext {
  return {
    operationId: payload.operationId,
    operationKind: payload.operationKind,
    layerId: payload.layerId,
    startFrame: payload.startFrame,
    launchOperationId: payload.launchOperationId,
    projectContextId: payload.projectContextId ?? null,
    expectedRevision: payload.expectedRevision,
    stagedRevision,
    interpolationMode: payload.interpolationMode,
    selectedKeyId: payload.selectedKeyId,
    selectedAppFrame: payload.selectedAppFrame,
    appliedFrameCount: payload.records.length,
    semanticDelta: payload.semanticDelta ?? null,
    historyProvenance: payload.historyProvenance ?? null,
    stagedIncomingInterpolationBreakKeyIds: cloneIncomingInterpolationBreakKeyIds(
      payload.incomingInterpolationBreakKeyIds ?? [],
    ),
    deferredRecords: deferredTarget ? cloneRecords(deferredTarget.records) : null,
    deferredInterpolation: deferredTarget
      ? {
          enabled: deferredTarget.interpolation.enabled,
          mode: deferredTarget.interpolation.mode,
        }
      : null,
    deferredLoopClips: deferredTarget?.loopClips ? cloneLoopClips(deferredTarget.loopClips) : null,
    stagedLocally: deferredTarget === undefined,
  };
}

/**
 * Coordinator external interface. Stable across renders; the same handle
 * is reused for the lifecycle of the owning Studio composition.
 */
export interface RotoPhysicalEditCoordinatorHandle<EngineState = SerializedProject> {
  /** Execute one acknowledged physical edit. Returns false if rejected before staging. */
  executePhysicalEdit: (input: RotoPhysicalEditCoordinatorExecuteInput<EngineState>) => Promise<boolean>;
  /** Consume one raw apply result from the bridge. Returns the transition classification. */
  consumePhysicalEditResult: (
    detail: PhysicPaintRotoPhysicalEditApplyResult | null | undefined,
  ) => 'ignore' | 'mismatch' | 'accepted';
  /** Consume one bridge-broadcast apply result (PhysicPaintApplyResult). */
  consumeBridgeApplyResult: (
    detail: PhysicPaintApplyResult | null | undefined,
  ) => 'ignore' | 'mismatch' | 'accepted';
  /** Cancel the pending edit for launch replacement or disposal. Idempotent. */
  cancelPhysicalEdit: (reason: 'launch-replacement' | 'disposal') => void;
  /** Release or transfer one accepted lease after all child settlement completes. */
  acknowledgePhysicalEditSettlement: (
    operationId: string,
    disposition: 'release' | 'cleanup-pending',
  ) => boolean;
  /** Release recovery ownership after durable cleanup/recovery completes. */
  releasePhysicalEditRecoveryLease: () => boolean;
  /** Recovery ownership retained after cleanup could not finish. */
  readonly recoveryLease: ReadonlySignal<PhysicPaintRotoPhysicalOperationLeaseToken | null>;
  /** Pending presentation state (Signal). */
  readonly presentation: ReadonlySignal<RotoPhysicalEditPresentation>;
  /** Immutable accepted output for Plan 36.14-05 history. Cleared on next execute. */
  readonly acceptedOutput: ReadonlySignal<RotoPhysicalEditAcceptedOutput<EngineState> | null>;
  /** Immutable failure output for diagnostic LOG-only routing. Cleared on next execute. */
  readonly failureOutput: ReadonlySignal<RotoPhysicalEditFailureOutput<EngineState> | null>;
  /** Pending operation ID, or null. Useful for mutation guards. */
  readonly pendingOperationId: ReadonlySignal<string | null>;
  /** Pending operation kind from the same serialized authority, or null. */
  readonly pendingOperationKind: ReadonlySignal<PhysicPaintRotoPhysicalEditApplyPayload['operationKind'] | null>;
}

export function useRotoPhysicalEditCoordinator<EngineState = SerializedProject>(
  ports: RotoPhysicalEditCoordinatorPorts<EngineState>,
): RotoPhysicalEditCoordinatorHandle<EngineState> {
  const pendingRef = useRef<PendingPhysicalEditContext | null>(null);
  const beforeRef = useRef<RotoPhysicalEditSnapshot<EngineState> | null>(null);
  const afterRef = useRef<RotoPhysicalEditSnapshot<EngineState> | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const leaseRef = useRef<PhysicPaintRotoPhysicalOperationLeaseToken | null>(null);
  const settledLeaseRef = useRef<{
    operationId: string;
    token: PhysicPaintRotoPhysicalOperationLeaseToken;
  } | null>(null);
  const inFlightRef = useRef<boolean>(false);
  const cancelledRef = useRef<boolean>(false);

  const presentationSignal = useSignal<RotoPhysicalEditPresentation>({ status: 'idle', conciseMessage: null });
  const acceptedSignal = useSignal<RotoPhysicalEditAcceptedOutput<EngineState> | null>(null);
  const failureSignal = useSignal<RotoPhysicalEditFailureOutput<EngineState> | null>(null);
  const pendingOperationIdSignal = useSignal<string | null>(null);
  const pendingOperationKindSignal = useSignal<PhysicPaintRotoPhysicalEditApplyPayload['operationKind'] | null>(null);
  const recoveryLeaseSignal = useSignal<PhysicPaintRotoPhysicalOperationLeaseToken | null>(null);

  const portsRef = useRef(ports);
  portsRef.current = ports;

  const clearTimeoutOnce = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const clearPendingOnce = useCallback(() => {
    const leaseToken = leaseRef.current;
    leaseRef.current = null;
    if (leaseToken) portsRef.current.lease.release(leaseToken);
    pendingRef.current = null;
    beforeRef.current = null;
    afterRef.current = null;
    inFlightRef.current = false;
    cancelledRef.current = false;
    pendingOperationIdSignal.value = null;
    pendingOperationKindSignal.value = null;
    portsRef.current.settlement.clearPendingSettlement();
    clearTimeoutOnce();
  }, [clearTimeoutOnce]);

  const captureSnapshot = useCallback(
    (expectedRevision: string, stagedRevision: string): RotoPhysicalEditSnapshot<EngineState> | null => {
      const launch = portsRef.current.launch.getLaunchContext();
      if (!launch) return null;
      const records = portsRef.current.records.getRecords(launch.layerId);
      const interpolation = portsRef.current.records.getInterpolation(launch.layerId);
      const capacity = portsRef.current.records.getCapacity(launch.layerId);
      const selectedKeyId = portsRef.current.selection.getSelectedKeyId();
      const currentAppFrame = portsRef.current.selection.getCurrentAppFrame();
      const buffer = portsRef.current.buffer;
      const reference = portsRef.current.reference.getCachedReference();
      return {
        launchOperationId: launch.operationId,
        layerId: launch.layerId,
        projectContextId: launch.project?.contextId ?? null,
        records: cloneRecords(records),
        interpolation: {
          enabled: interpolation.enabled,
          mode: interpolation.mode,
        },
        loopClips: cloneLoopClips(portsRef.current.records.getLoopClips(launch.layerId)),
        incomingInterpolationBreakKeyIds: cloneIncomingInterpolationBreakKeyIds(
          portsRef.current.records.getIncomingInterpolationBreakKeyIds(launch.layerId),
        ),
        capacity,
        expectedRevision,
        stagedRevision,
        selectedKeyId,
        selectedAppFrame: selectedKeyId === null ? null : currentAppFrame,
        currentAppFrame,
        dirtyFrames: cloneSet(buffer.dirtyFrames),
        editableFrames: [...buffer.editableFrames],
        liveOverlayActionCounts: cloneCounts(buffer.liveOverlayActionCounts),
        frameStates: cloneFrameMap(buffer.frameStates),
        previewFrames: cloneFrameMap(buffer.previewFrames),
        capturedFrames: cloneFrameMap(buffer.capturedFrames),
        confirmedFrames: cloneFrameMap(buffer.confirmedFrames),
        cachedReference: { url: reference.url, cachedRepaintBase: reference.cachedRepaintBase },
        engineState: portsRef.current.engineState.saveEngineState(),
      } as RotoPhysicalEditSnapshot<EngineState>;
    },
    [],
  );

  const replaceRecordsAndBreaks = useCallback((
    layerId: string,
    records: readonly PhysicPaintRotoRealKeyRecord[],
    interpolation: PhysicPaintRotoInterpolationState,
    incomingInterpolationBreakKeyIds: readonly string[],
  ): boolean => {
    const currentRecords = portsRef.current.records.getRecords(layerId);
    const currentBreaks = portsRef.current.records.getIncomingInterpolationBreakKeyIds(layerId);
    const currentKeyIds = new Set(currentRecords.map((record) => record.keyId));
    const targetKeyIds = new Set(records.map((record) => record.keyId));
    const targetBreaksCanApplyFirst = incomingInterpolationBreakKeyIds.every((keyId) => currentKeyIds.has(keyId));
    const currentBreaksSurviveRecordReplacement = currentBreaks.every((keyId) => targetKeyIds.has(keyId));

    if (targetBreaksCanApplyFirst) {
      const breakResult = portsRef.current.records.replaceIncomingInterpolationBreakKeyIds(
        layerId,
        incomingInterpolationBreakKeyIds,
      );
      if (!breakResult.ok) return false;
      return portsRef.current.records.replaceRecords(layerId, records, interpolation).ok;
    }
    if (currentBreaksSurviveRecordReplacement) {
      const recordResult = portsRef.current.records.replaceRecords(layerId, records, interpolation);
      if (!recordResult.ok) return false;
      return portsRef.current.records.replaceIncomingInterpolationBreakKeyIds(
        layerId,
        incomingInterpolationBreakKeyIds,
      ).ok;
    }

    const clearResult = portsRef.current.records.replaceIncomingInterpolationBreakKeyIds(layerId, []);
    if (!clearResult.ok) return false;
    const recordResult = portsRef.current.records.replaceRecords(layerId, records, interpolation);
    if (!recordResult.ok) return false;
    return portsRef.current.records.replaceIncomingInterpolationBreakKeyIds(
      layerId,
      incomingInterpolationBreakKeyIds,
    ).ok;
  }, []);

  const restoreSnapshot = useCallback(
    (snapshot: RotoPhysicalEditSnapshot<EngineState>, restoreCanvas: boolean): boolean => {
      const launch = portsRef.current.launch.getLaunchContext();
      if (!launch || launch.layerId !== snapshot.layerId || launch.operationId !== snapshot.launchOperationId) return false;
      if (!replaceRecordsAndBreaks(
        snapshot.layerId,
        snapshot.records,
        snapshot.interpolation,
        snapshot.incomingInterpolationBreakKeyIds,
      )) return false;
      // Loop Clips ride the same snapshot (Q1/D-06): replay and rollback
      // restore keys and loops together.
      const loopResult = portsRef.current.records.replaceLoopClips(snapshot.layerId, snapshot.loopClips);
      if (!loopResult.ok) return false;
      portsRef.current.buffer.replaceFrameStates(snapshot.frameStates);
      portsRef.current.buffer.replacePreviewFrames(snapshot.previewFrames);
      portsRef.current.buffer.replaceCapturedFrames(snapshot.capturedFrames);
      portsRef.current.buffer.replaceConfirmedFrames(snapshot.confirmedFrames);
      portsRef.current.buffer.replaceDirtyFrames(snapshot.dirtyFrames);
      portsRef.current.buffer.replaceLiveOverlayActionCounts(snapshot.liveOverlayActionCounts);
      portsRef.current.buffer.setEditableFrameList([...snapshot.editableFrames]);
      portsRef.current.selection.setSelectedKeyId(snapshot.selectedKeyId);
      portsRef.current.selection.setCurrentAppFrame(snapshot.currentAppFrame);
      portsRef.current.reference.setCachedReference(snapshot.cachedReference);
      portsRef.current.launch.setLaunchContextStartFrame(snapshot.currentAppFrame);
      portsRef.current.launch.setLaunchContextCachedFrames(snapshot.records, { preserveRuntimeCaches: true });
      if (restoreCanvas && snapshot.engineState !== null && portsRef.current.engine) {
        portsRef.current.engineState.loadEngineState(snapshot.engineState);
      }
      return true;
    },
    [replaceRecordsAndBreaks],
  );

  const finalizeAccepted = useCallback(
    (
      pending: PendingPhysicPaintRotoPhysicalEdit,
      detail: PhysicPaintRotoPhysicalEditApplyResult,
      before: RotoPhysicalEditSnapshot<EngineState>,
    ) => {
      const after = captureSnapshot(pending.expectedRevision, pending.stagedRevision);
      if (!after) {
        portsRef.current.status.logDiagnostic('Roto physical edit acceptance failed: launch context changed before after-snapshot capture.');
        clearPendingOnce();
        presentationSignal.value = { status: 'failed', conciseMessage: PHYSICAL_EDIT_FAILED_MESSAGE };
        portsRef.current.status.setApplyStatus('error');
        portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_FAILED_MESSAGE);
        portsRef.current.status.setLastError(null);
        return;
      }
      const acceptedRevision = detail.acceptedRevision;
      if (acceptedRevision === null) {
        portsRef.current.status.logDiagnostic('Roto physical edit acceptance omitted the parent accepted revision.');
        clearPendingOnce();
        presentationSignal.value = { status: 'failed', conciseMessage: PHYSICAL_EDIT_FAILED_MESSAGE };
        portsRef.current.status.setApplyStatus('error');
        portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_FAILED_MESSAGE);
        return;
      }
      if (
        pending.operationKind === 'undo'
        || pending.operationKind === 'redo'
        || pending.operationKind === 'play-script'
        || pending.operationKind === 'insert-empty-segment'
        || pending.operationKind === 'paint-group-frame'
        || pending.operationKind === 'delete-group-frame'
        || pending.operationKind === 'delete-group'
      ) {
        portsRef.current.reference.reconcileCurrentFrame(after.currentAppFrame);
      }
      acceptedSignal.value = {
        before,
        after,
        acceptedRevision,
        operationId: pending.operationId,
        operationKind: pending.operationKind,
        historyProvenance: detail.historyProvenance ?? null,
      };
      failureSignal.value = null;
      presentationSignal.value = { status: 'accepted', conciseMessage: PHYSICAL_EDIT_ACCEPTED_MESSAGE };
      portsRef.current.status.setApplyStatus('success');
      portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_ACCEPTED_MESSAGE);
      portsRef.current.status.setLastError(null);
      const acceptedLease = leaseRef.current;
      if (acceptedLease) {
        settledLeaseRef.current = {
          operationId: pending.operationId,
          token: acceptedLease,
        };
        leaseRef.current = null;
      }
      clearPendingOnce();
    },
    [captureSnapshot, clearPendingOnce],
  );

  const finalizeFailed = useCallback(
    (
      pending: PendingPhysicalEditContext,
      before: RotoPhysicalEditSnapshot<EngineState>,
      reason: RotoPhysicalEditFailureOutput<EngineState>['reason'],
      error: unknown,
      options: {
        readonly restoreDeferred?: boolean;
        readonly transferLeaseToRecovery?: boolean;
      } = {},
    ) => {
      const shouldRestore = pending.stagedLocally || options.restoreDeferred === true;
      const restored = shouldRestore ? restoreSnapshot(before, true) : true;
      if (!restored) {
        portsRef.current.status.logDiagnostic('Roto physical edit rollback failed: launch context changed before restore.');
      } else if (shouldRestore) {
        portsRef.current.reference.reconcileCurrentFrame(before.currentAppFrame);
      }
      if (options.transferLeaseToRecovery) {
        const leaseToken = leaseRef.current;
        const recoveryToken = leaseToken
          ? portsRef.current.lease.transferToRecovery(leaseToken)
          : null;
        if (recoveryToken) {
          leaseRef.current = null;
          recoveryLeaseSignal.value = recoveryToken;
        } else {
          portsRef.current.status.logDiagnostic('Roto physical edit cleanup could not transfer its lease to recovery ownership.');
        }
      }
      failureSignal.value = { restored: before, reason, error };
      acceptedSignal.value = null;
      const message = reason === 'timeout'
        ? PHYSICAL_EDIT_TIMEOUT_MESSAGE
        : reason === 'transport'
          ? PHYSICAL_EDIT_TRANSPORT_MESSAGE
          : reason === 'settlement-mismatch'
            ? PHYSICAL_EDIT_MISMATCH_MESSAGE
            : PHYSICAL_EDIT_FAILED_MESSAGE;
      presentationSignal.value = { status: 'failed', conciseMessage: message };
      portsRef.current.status.setApplyStatus('error');
      portsRef.current.status.setConciseMessage(message);
      portsRef.current.status.setLastError(message);
      if (error !== undefined) {
        const detail = error instanceof Error ? error.message : String(error);
        portsRef.current.status.logDiagnostic(`Roto physical edit failed (${reason}): ${detail}`);
      }
      clearPendingOnce();
    },
    [clearPendingOnce, restoreSnapshot],
  );

  const consumePhysicalEditResult = useCallback(
    (detail: PhysicPaintRotoPhysicalEditApplyResult | null | undefined): 'ignore' | 'mismatch' | 'accepted' => {
      const pending = pendingRef.current;
      const before = beforeRef.current;
      if (!pending || !before || cancelledRef.current) {
        return 'ignore';
      }
      const transition = transitionPhysicalEditResult(pending, detail);
      if (transition.type === 'ignore') return 'ignore';
      if (transition.type === 'mismatch') {
        portsRef.current.status.logDiagnostic(`Roto physical edit result mismatch: ${transition.message}`);
        return 'mismatch';
      }
      if (!transition.ok) {
        finalizeFailed(pending, before, 'parent-rejection', transition.detail?.error);
        return 'accepted';
      }
      const launch = portsRef.current.launch.getLaunchContext();
      if (!launch || launch.layerId !== pending.layerId || launch.operationId !== pending.launchOperationId) {
        finalizeFailed(pending, before, 'settlement-mismatch', 'Launch context changed before settlement.');
        return 'accepted';
      }
      let currentStaged = buildPhysicPaintRotoPhysicalRevision(
        portsRef.current.records.getRecords(pending.layerId),
        portsRef.current.records.getInterpolation(pending.layerId),
        portsRef.current.records.getLoopClips(pending.layerId),
        portsRef.current.records.getIncomingInterpolationBreakKeyIds(pending.layerId),
      );
      if (pending.operationKind === 'set-interpolation-enabled'
        || pending.operationKind === 'set-interpolation-mode'
        || pending.operationKind === 'play-script'
        || pending.operationKind === 'insert-empty-segment'
        || pending.operationKind === 'paint-group-frame'
        || pending.operationKind === 'delete-group-frame'
        || pending.operationKind === 'delete-group') {
        if (currentStaged !== pending.expectedRevision
          || !pending.deferredRecords
          || !pending.deferredInterpolation) {
          finalizeFailed(pending, before, 'settlement-mismatch', 'Accepted deferred physical state no longer matches the child snapshot.');
          return 'accepted';
        }
        const replaced = replaceRecordsAndBreaks(
          pending.layerId,
          pending.deferredRecords,
          pending.deferredInterpolation,
          pending.stagedIncomingInterpolationBreakKeyIds,
        );
        if (!replaced) {
          finalizeFailed(
            pending,
            before,
            'exception',
            'Could not publish deferred records and incoming interpolation breaks together.',
            { restoreDeferred: true, transferLeaseToRecovery: true },
          );
          return 'accepted';
        }
        // 43-06: a play-script commit carrying loopClips settles the staged
        // Loop Clip collection with the deferred records (one atomic accept).
        if (pending.deferredLoopClips) {
          const loopResult = portsRef.current.records.replaceLoopClips(pending.layerId, pending.deferredLoopClips);
          if (!loopResult.ok) {
            finalizeFailed(
              pending,
              before,
              'exception',
              loopResult.error,
              { restoreDeferred: true, transferLeaseToRecovery: true },
            );
            return 'accepted';
          }
        }
        portsRef.current.selection.setSelectedKeyId(pending.selectedKeyId);
        if (pending.selectedAppFrame !== null) {
          portsRef.current.selection.setCurrentAppFrame(pending.selectedAppFrame);
        }
        portsRef.current.launch.setLaunchContextCachedFrames(
          pending.deferredRecords,
          { preserveRuntimeCaches: true },
        );
        currentStaged = buildPhysicPaintRotoPhysicalRevision(
          portsRef.current.records.getRecords(pending.layerId),
          portsRef.current.records.getInterpolation(pending.layerId),
          portsRef.current.records.getLoopClips(pending.layerId),
          portsRef.current.records.getIncomingInterpolationBreakKeyIds(pending.layerId),
        );
      }
      if (currentStaged !== pending.stagedRevision) {
        finalizeFailed(pending, before, 'settlement-mismatch', 'Staged revision drifted before settlement.');
        return 'accepted';
      }
      finalizeAccepted(pending, transition.detail, before);
      return 'accepted';
    },
    [finalizeAccepted, finalizeFailed, replaceRecordsAndBreaks],
  );

  const consumeBridgeApplyResult = useCallback(
    (detail: PhysicPaintApplyResult | null | undefined): 'ignore' | 'mismatch' | 'accepted' => {
      if (!detail || detail.kind !== 'replace-roto-physical-map') return 'ignore';
      if (!isPhysicPaintRotoPhysicalEditApplyResult(detail)) return 'mismatch';
      return consumePhysicalEditResult(detail);
    },
    [consumePhysicalEditResult],
  );

  const cancelPhysicalEdit = useCallback((reason: 'launch-replacement' | 'disposal') => {
    const pending = pendingRef.current;
    const before = beforeRef.current;
    if (!pending || !before) return;
    if (cancelledRef.current) return;
    cancelledRef.current = true;
    finalizeFailed(pending, before, reason === 'launch-replacement' ? 'settlement-mismatch' : 'settlement-mismatch', `Cancelled due to ${reason}.`);
  }, [finalizeFailed]);

  const acknowledgePhysicalEditSettlement = useCallback((
    operationId: string,
    disposition: 'release' | 'cleanup-pending',
  ): boolean => {
    const settled = settledLeaseRef.current;
    if (!settled || settled.operationId !== operationId) return false;
    if (disposition === 'release') {
      if (!portsRef.current.lease.release(settled.token)) return false;
      settledLeaseRef.current = null;
      return true;
    }
    const recoveryToken = portsRef.current.lease.transferToRecovery(settled.token);
    if (!recoveryToken) return false;
    settledLeaseRef.current = null;
    recoveryLeaseSignal.value = recoveryToken;
    return true;
  }, []);

  const releasePhysicalEditRecoveryLease = useCallback((): boolean => {
    const recoveryToken = recoveryLeaseSignal.peek();
    if (!recoveryToken || !portsRef.current.lease.release(recoveryToken)) return false;
    recoveryLeaseSignal.value = null;
    return true;
  }, []);

  const executePhysicalEdit = useCallback(
    async (input: RotoPhysicalEditCoordinatorExecuteInput<EngineState>): Promise<boolean> => {
      if (
        inFlightRef.current
        || pendingRef.current
        || settledLeaseRef.current
        || recoveryLeaseSignal.peek()
      ) {
        portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_SERIALIZE_MESSAGE);
        return false;
      }
      const launch = portsRef.current.launch.getLaunchContext();
      if (!launch || launch.layerId !== input.expectedLaunch.layerId || launch.operationId !== input.expectedLaunch.operationId) {
        return false;
      }
      const bridgeMode = portsRef.current.bridge.getBridgeMode();
      if (bridgeMode === 'Unavailable') {
        portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
        return false;
      }
      const isInterpolationEnabledChange = input.operationKind === 'set-interpolation-enabled';
      const isInterpolationModeChange = input.operationKind === 'set-interpolation-mode';
      const isInterpolationChange = isInterpolationEnabledChange || isInterpolationModeChange;
      const isPlayScript = input.operationKind === 'play-script';
      const isInsertEmptySegment = input.operationKind === 'insert-empty-segment';
      const isGroupFramePaint = input.operationKind === 'paint-group-frame';
      const isGroupLifecycleDelete = input.operationKind === 'delete-group-frame'
        || input.operationKind === 'delete-group';
      const isDeferredPublication = isInterpolationChange
        || isPlayScript
        || isInsertEmptySegment
        || isGroupFramePaint
        || isGroupLifecycleDelete;
      const interpolationInput = isInterpolationChange && 'targetInterpolation' in input
        ? input as RotoInterpolationEnabledExecuteInput | RotoInterpolationModeExecuteInput
        : null;
      const playScriptInput = isPlayScript && 'semanticDelta' in input ? input as RotoPlayScriptExecuteInput : null;
      const groupFramePaintInput = isGroupFramePaint && 'groupId' in input ? input as RotoGroupFramePaintExecuteInput : null;
      const groupLifecycleDeleteInput = isGroupLifecycleDelete && 'groupId' in input
        ? input as RotoGroupLifecycleDeleteExecuteInput
        : null;
      const requestedSelectedKeyId = 'selectedKeyId' in input ? input.selectedKeyId : null;
      const requestedSelectedAppFrame = 'selectedAppFrame' in input ? input.selectedAppFrame : null;
      const proposal = 'proposal' in input ? input.proposal : null;
      const intent = 'intent' in input ? input.intent : undefined;
      const historyProvenance = 'historyProvenance' in input ? input.historyProvenance : undefined;
      const replayTarget = 'replayTargetSnapshot' in input ? input.replayTargetSnapshot : undefined;
      const isReplay = input.operationKind === 'undo' || input.operationKind === 'redo';
      const isSemanticOrdinary = input.operationKind === 'duplicate-key'
        || input.operationKind === 'paste-key'
        || input.operationKind === 'paste-key-group'
        || input.operationKind === 'insert-empty-segment';
      const isOrdinary = !isReplay
        && !isInterpolationChange
        && !isPlayScript
        && !isGroupFramePaint
        && !isGroupLifecycleDelete;
      if (isOrdinary) {
        if (!isPhysicPaintRotoPhysicalEditIntent(intent) || intent.kind !== input.operationKind) {
          portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
          return false;
        }
      } else if (intent !== undefined) {
        portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
        return false;
      }
      if (isInterpolationChange) {

        if (!interpolationInput
          || 'proposal' in input
          || 'historyProvenance' in input
          || 'replayTargetSnapshot' in input
          || !isPhysicPaintRotoInterpolationState(interpolationInput.targetInterpolation)) {
          portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
          return false;
        }
      } else if (isPlayScript) {
        if (!playScriptInput
          || proposal
          || historyProvenance !== undefined
          || replayTarget !== undefined
          || playScriptInput.semanticDelta.kind !== 'play-script') {
          portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
          return false;
        }
      } else if (isGroupFramePaint) {
        if (!groupFramePaintInput
          || proposal
          || intent !== undefined
          || historyProvenance !== undefined
          || replayTarget !== undefined
          || !Number.isSafeInteger(groupFramePaintInput.appFrame)
          || groupFramePaintInput.renderedPayload.appFrame !== groupFramePaintInput.appFrame) {
          portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
          return false;
        }
      } else if (isGroupLifecycleDelete) {
        if (!groupLifecycleDeleteInput
          || proposal
          || intent !== undefined
          || historyProvenance !== undefined
          || replayTarget !== undefined
          || !Number.isSafeInteger(groupLifecycleDeleteInput.appFrame)) {
          portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
          return false;
        }
      } else if (!proposal) {
        portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
        return false;
      }
      if (!isReplay && (historyProvenance !== undefined || replayTarget !== undefined)) {
        portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
        return false;
      }
      if (isReplay && (!historyProvenance || !replayTarget)) {
        portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
        return false;
      }
      if (!isReplay && !isInterpolationChange && !isPlayScript && !isGroupFramePaint && !isGroupLifecycleDelete
        && proposal?.status.operationKind !== input.operationKind) {
        portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
        return false;
      }
      if (!isInterpolationChange && !isPlayScript && !isGroupFramePaint && !isGroupLifecycleDelete
        && (proposal?.selectedKeyId !== requestedSelectedKeyId || proposal?.selectedAppFrame !== requestedSelectedAppFrame)) {
        portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
        return false;
      }
      if (isReplay && (!proposal || !replayTarget || !replayProposalMatchesTarget(proposal, replayTarget))) {
        portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
        return false;
      }
      if (isSemanticOrdinary) {
        if (!proposal?.semanticDelta || !proposal.nextRecords) {
          portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
          return false;
        }
      } else if (proposal && (proposal.nextRecords !== null || proposal.semanticDelta !== null)) {
        portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
        return false;
      }
      const flushAppFrame = portsRef.current.selection.getCurrentAppFrame();

      inFlightRef.current = true;
      pendingOperationIdSignal.value = null;
      cancelledRef.current = false;
      acceptedSignal.value = null;
      failureSignal.value = null;
      try {
        portsRef.current.paint.flushPendingStrokeFinalizations();
        await portsRef.current.paint.flushLivePixels(flushAppFrame);
        if (cancelledRef.current) {
          clearPendingOnce();
          return false;
        }
        const projectContextId = launch.project?.contextId;
        if (!projectContextId) {
          portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
          clearPendingOnce();
          return false;
        }
        const leaseToken = portsRef.current.lease.acquire(projectContextId, launch.layerId);
        if (!leaseToken) {
          portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_SERIALIZE_MESSAGE);
          clearPendingOnce();
          return false;
        }
        leaseRef.current = leaseToken;
        const revalidatedLaunch = portsRef.current.launch.getLaunchContext();
        if (!revalidatedLaunch
          || revalidatedLaunch.layerId !== input.expectedLaunch.layerId
          || revalidatedLaunch.operationId !== input.expectedLaunch.operationId
          || revalidatedLaunch.project?.contextId !== leaseToken.projectContextId
          || revalidatedLaunch.layerId !== leaseToken.layerId) {
          portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
          clearPendingOnce();
          return false;
        }
        const currentRecords = portsRef.current.records.getRecords(revalidatedLaunch.layerId);
        const currentInterpolation = portsRef.current.records.getInterpolation(revalidatedLaunch.layerId);
        const currentLoopClips = portsRef.current.records.getLoopClips(revalidatedLaunch.layerId);
        const currentIncomingInterpolationBreakKeyIds = portsRef.current.records.getIncomingInterpolationBreakKeyIds(
          revalidatedLaunch.layerId,
        );
        const capacity = portsRef.current.records.getCapacity(revalidatedLaunch.layerId);
        const currentSelectedKeyIdForEdit = portsRef.current.selection.getSelectedKeyId();
        const currentAppFrameForEdit = portsRef.current.selection.getCurrentAppFrame();
        let targetSelectedKeyId = isGroupFramePaint || isGroupLifecycleDelete
          ? currentSelectedKeyIdForEdit
          : requestedSelectedKeyId;
        let targetSelectedAppFrame = isGroupFramePaint || isGroupLifecycleDelete
          ? (currentSelectedKeyIdForEdit === null ? null : currentAppFrameForEdit)
          : requestedSelectedAppFrame;
        const expectedRevision = buildPhysicPaintRotoPhysicalRevision(
          currentRecords,
          currentInterpolation,
          currentLoopClips,
          currentIncomingInterpolationBreakKeyIds,
        );
        let groupFramePaintProposal: PhysicPaintRotoPhysicalDocument | null = null;
        let groupFramePaintImpact: PhysicPaintRotoGroupFramePaintImpact | null = null;
        let groupLifecycleDeleteProposal: PhysicPaintRotoPhysicalDocument | null = null;
        let groupLifecycleDeleteImpact: RotoGroupLifecycleDeleteImpact | null = null;
        if (isGroupFramePaint || isGroupLifecycleDelete) {
          const getDocument = portsRef.current.records.getDocument;
          const currentDocument = getDocument?.(revalidatedLaunch.layerId) ?? null;
          const documentRevision = currentDocument
            ? buildPhysicPaintRotoPhysicalRevision(
                currentDocument.realKeyRecords,
                currentDocument.interpolation,
                currentDocument.loopClips,
                currentDocument.incomingInterpolationBreakKeyIds,
              )
            : null;
          if (!currentDocument
            || currentDocument.capacity !== capacity
            || currentDocument.revision !== expectedRevision
            || documentRevision !== expectedRevision
            || !recordsEqual(currentDocument.realKeyRecords, currentRecords)
            || currentDocument.interpolation.enabled !== currentInterpolation.enabled
            || currentDocument.interpolation.mode !== currentInterpolation.mode
            || currentDocument.selectedKeyId !== currentSelectedKeyIdForEdit
            || currentDocument.cursorAppFrame !== currentAppFrameForEdit) {
            portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
            portsRef.current.status.logDiagnostic('Group lifecycle physical document became stale before proposal staging.');
            clearPendingOnce();
            return false;
          }
          if (isGroupFramePaint && groupFramePaintInput) {
            const proposed = proposePhysicPaintRotoGroupFramePaint({
              document: currentDocument,
              groupId: groupFramePaintInput.groupId,
              appFrame: groupFramePaintInput.appFrame,
              overrideKeyId: groupFramePaintInput.overrideKeyId,
              renderedPayload: groupFramePaintInput.renderedPayload,
            });
            if (!proposed.ok) {
              portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
              portsRef.current.status.logDiagnostic(`Group Paint physical proposal rejected: ${proposed.reason}`);
              clearPendingOnce();
              return false;
            }
            groupFramePaintProposal = proposed.proposal;
            groupFramePaintImpact = proposed.impact;
          } else if (groupLifecycleDeleteInput) {
            const proposed = groupLifecycleDeleteInput.operationKind === 'delete-group'
              ? proposePhysicPaintRotoDeleteGroup({
                  document: currentDocument,
                  groupId: groupLifecycleDeleteInput.groupId,
                })
              : proposePhysicPaintRotoDeleteGroupFrame({
                  document: currentDocument,
                  groupId: groupLifecycleDeleteInput.groupId,
                  appFrame: groupLifecycleDeleteInput.appFrame,
                });
            if (!proposed.ok) {
              portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
              portsRef.current.status.logDiagnostic(`Group lifecycle physical proposal rejected: ${proposed.reason}`);
              clearPendingOnce();
              return false;
            }
            groupLifecycleDeleteProposal = proposed.proposal;
            groupLifecycleDeleteImpact = groupLifecycleDeleteInput.operationKind === 'delete-group'
              ? Object.freeze({
                  kind: 'delete-group',
                  groupId: proposed.impact.groupId,
                  cleanupKeyIds: proposed.impact.cleanupKeyIds,
                  previousRevision: proposed.impact.previousRevision,
                  nextRevision: proposed.impact.nextRevision,
                })
              : Object.freeze({
                  kind: 'delete-group-frame',
                  groupId: proposed.impact.groupId,
                  appFrame: groupLifecycleDeleteInput.appFrame,
                  cleanupKeyIds: proposed.impact.cleanupKeyIds,
                  previousRevision: proposed.impact.previousRevision,
                  nextRevision: proposed.impact.nextRevision,
                });
            targetSelectedKeyId = proposed.proposal.selectedKeyId;
            targetSelectedAppFrame = proposed.proposal.selectedKeyId === null
              ? null
              : currentAppFrameForEdit;
          }
        }
        if (isReplay && (
          !replayTarget
          || replayTarget.launchOperationId !== revalidatedLaunch.operationId
          || replayTarget.layerId !== revalidatedLaunch.layerId
          || replayTarget.projectContextId !== (revalidatedLaunch.project?.contextId ?? null)
          || replayTarget.capacity !== capacity
          || replayTarget.selectedKeyId !== targetSelectedKeyId
          || replayTarget.selectedAppFrame !== targetSelectedAppFrame
          || !Number.isInteger(replayTarget.currentAppFrame)
          || replayTarget.currentAppFrame < 0
          || replayTarget.currentAppFrame >= capacity
        )) {
          portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
          clearPendingOnce();
          return false;
        }
        if (isInterpolationChange) {
          const currentSelectedKeyId = portsRef.current.selection.getSelectedKeyId();
          const currentSelectedAppFrame = currentSelectedKeyId === null
            ? null
            : portsRef.current.selection.getCurrentAppFrame();
          const target = interpolationInput?.targetInterpolation;
          const invalidEnabledChange = isInterpolationEnabledChange
            && (target?.enabled === currentInterpolation.enabled || target?.mode !== currentInterpolation.mode);
          const invalidModeChange = isInterpolationModeChange
            && (target?.enabled !== currentInterpolation.enabled || target?.mode === currentInterpolation.mode);
          if (!interpolationInput
            || !target
            || !recordsEqual(interpolationInput.records, currentRecords)
            || invalidEnabledChange
            || invalidModeChange
            || targetSelectedKeyId !== currentSelectedKeyId
            || targetSelectedAppFrame !== currentSelectedAppFrame) {
            portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
            clearPendingOnce();
            return false;
          }
        }
        if (isPlayScript) {
          const playValidationError = !playScriptInput
            || playScriptInput.expectedRevision !== expectedRevision
            ? 'Play Script physical revision became stale before staging.'
            : validatePlayScriptInput(playScriptInput, currentRecords, currentInterpolation, capacity);
          const currentSelectedKeyId = portsRef.current.selection.getSelectedKeyId();
          const currentSelectedRecord = currentRecords.find((record) => record.appFrame === playScriptInput?.selectedAppFrame);
          if (playValidationError
            || (currentSelectedRecord ? currentSelectedKeyId !== currentSelectedRecord.keyId : currentSelectedKeyId !== null)) {
            portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
            if (playValidationError) portsRef.current.status.logDiagnostic(`Play Script physical validation failed: ${playValidationError}`);
            clearPendingOnce();
            return false;
          }
        }
        const stagedRecords = isInterpolationChange
          ? cloneRecords(currentRecords)
          : isPlayScript && playScriptInput
            ? cloneRecords(playScriptInput.records)
            : isGroupFramePaint && groupFramePaintProposal
              ? cloneRecords(groupFramePaintProposal.realKeyRecords)
              : isGroupLifecycleDelete && groupLifecycleDeleteProposal
                ? cloneRecords(groupLifecycleDeleteProposal.realKeyRecords)
              : isReplay && replayTarget
                ? buildReplayRecords(replayTarget.records, capacity)
                : proposal
                  ? buildStagedRecords(currentRecords, proposal, capacity)
                  : null;
        if (stagedRecords === null) {
          portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
          clearPendingOnce();
          return false;
        }
        if (isSemanticOrdinary && proposal?.semanticDelta) {
          const semanticValidation = validatePhysicPaintRotoPhysicalEditSemanticDelta({
            operationKind: input.operationKind,
            currentRecords,
            nextRecords: stagedRecords,
            semanticDelta: proposal.semanticDelta,
            capacity,
            selectedKeyId: targetSelectedKeyId,
            selectedAppFrame: targetSelectedAppFrame,
          });
          if (!semanticValidation.ok) {
            portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
            portsRef.current.status.logDiagnostic(`Roto physical edit semantic validation failed: ${semanticValidation.error}`);
            clearPendingOnce();
            return false;
          }
        }
        const stagedInterpolation: PhysicPaintRotoInterpolationState = isInterpolationChange && interpolationInput
          ? {
              enabled: interpolationInput.targetInterpolation.enabled,
              mode: interpolationInput.targetInterpolation.mode,
            }
          : isPlayScript && playScriptInput
            ? {
                enabled: playScriptInput.interpolationEnabled,
                mode: playScriptInput.interpolationMode,
              }
            : isGroupFramePaint && groupFramePaintProposal
              ? {
                  enabled: groupFramePaintProposal.interpolation.enabled,
                  mode: groupFramePaintProposal.interpolation.mode,
                }
              : isGroupLifecycleDelete && groupLifecycleDeleteProposal
                ? {
                    enabled: groupLifecycleDeleteProposal.interpolation.enabled,
                    mode: groupLifecycleDeleteProposal.interpolation.mode,
                  }
              : isReplay && replayTarget
                ? {
                    enabled: replayTarget.interpolation.enabled,
                    mode: replayTarget.interpolation.mode,
                  }
                : {
                    enabled: currentInterpolation.enabled,
                    mode: currentInterpolation.mode,
                  };
        let validatedStagedRecords: readonly PhysicPaintRotoRealKeyRecord[];
        try {
          validatedStagedRecords = parsePhysicPaintRotoRealKeyRecordCollection(stagedRecords, capacity);
        } catch (error) {
          const detail = error instanceof Error
            ? error.message
            : 'Invalid staged real-key records.';
          portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
          portsRef.current.status.logDiagnostic(`Roto physical record validation failed: ${detail}`);
          clearPendingOnce();
          return false;
        }
        // Staged Loop Clips (Phase 43, Q1): replay stages the immutable
        // replay target's collection so Undo/Redo restores loop state; a
        // 43-06 play-script op carrying loopClips (apply-time loop creation,
        // Update/Unlink/Duplicate/Repair/Relink) stages its collection; a
        // rigid whole-cycle group drag stages the proposal's placementStart
        // follow (D-04); every other ordinary kind stages the current
        // collection unchanged.
        const stagedLoopClips = isReplay && replayTarget
          ? replayTarget.loopClips
          : groupLifecycleDeleteProposal?.loopClips
            ?? groupFramePaintProposal?.loopClips
            ?? playScriptInput?.loopClips
            ?? proposal?.nextLoopClips
            ?? currentLoopClips;
        const stagedIncomingInterpolationBreakKeyIds = isReplay && replayTarget
          ? replayTarget.incomingInterpolationBreakKeyIds
          : groupLifecycleDeleteProposal?.incomingInterpolationBreakKeyIds
            ?? groupFramePaintProposal?.incomingInterpolationBreakKeyIds
            ?? proposal?.nextIncomingInterpolationBreakKeyIds
            ?? currentIncomingInterpolationBreakKeyIds;
        const stagedRevision = buildPhysicPaintRotoPhysicalRevision(
          validatedStagedRecords,
          stagedInterpolation,
          stagedLoopClips,
          stagedIncomingInterpolationBreakKeyIds,
        );
        if (isReplay && (
          !historyProvenance
          || historyProvenance.sourceRevision !== expectedRevision
          || historyProvenance.targetRevision !== stagedRevision
        )) {
          portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
          clearPendingOnce();
          return false;
        }
        const before = captureSnapshot(expectedRevision, stagedRevision);
        if (!before) {
          portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
          clearPendingOnce();
          return false;
        }

        const operationId = `${revalidatedLaunch.operationId}:roto-physical-edit:${crypto.randomUUID()}`;
        const payloadBase: PhysicalEditPayloadBase = {
          kind: 'replace-roto-physical-map',
          operationId,
          layerId: revalidatedLaunch.layerId,
          leaseToken,
          startFrame: groupFramePaintInput?.appFrame
            ?? groupLifecycleDeleteInput?.appFrame
            ?? targetSelectedAppFrame
            ?? before.currentAppFrame,
          launchOperationId: revalidatedLaunch.operationId,
          projectContextId: leaseToken.projectContextId,
          expectedRevision,
          records: recordsToApplyPayloadRecords(validatedStagedRecords),
          interpolationEnabled: stagedInterpolation.enabled,
          interpolationMode: stagedInterpolation.mode,
          ...(playScriptInput ? { rotoBackground: { ...playScriptInput.rotoBackground } } : {}),
          loopClips: cloneLoopClips(stagedLoopClips),
          incomingInterpolationBreakKeyIds: cloneIncomingInterpolationBreakKeyIds(
            stagedIncomingInterpolationBreakKeyIds,
          ),
          selectedKeyId: targetSelectedKeyId,
          selectedAppFrame: targetSelectedAppFrame,
          ...(groupLifecycleDeleteImpact
            ? { semanticDelta: groupLifecycleDeleteImpact }
            : groupFramePaintImpact
              ? { semanticDelta: groupFramePaintImpact }
            : playScriptInput
              ? { semanticDelta: playScriptInput.semanticDelta }
              : proposal?.semanticDelta
                ? { semanticDelta: proposal.semanticDelta }
                : {}),
          ...(historyProvenance ? { historyProvenance } : {}),
        };
        const payload = createAuthorizedPhysicalEditPayload(
          payloadBase,
          input.operationKind,
          intent,
        );
        if (!payload) {
          portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
          clearPendingOnce();
          return false;
        }
        const pending = createPendingPhysicalEdit(
          payload,
          stagedRevision,
          isDeferredPublication
            ? {
                records: validatedStagedRecords,
                interpolation: stagedInterpolation,
                // Loop state settles with deferred Play Script and exact-frame
                // Group Paint targets so range reunion is accepted atomically.
                ...(isPlayScript || isGroupFramePaint || isGroupLifecycleDelete
                  ? { loopClips: stagedLoopClips }
                  : {}),
              }
            : undefined,
        );
        beforeRef.current = before;
        pendingRef.current = pending;
        pendingOperationIdSignal.value = operationId;
        pendingOperationKindSignal.value = input.operationKind;
        portsRef.current.settlement.registerPendingSettlement(pending);

        if (isDeferredPublication) {
          // The parent is authoritative for canonical interpolation, Play, and
          // empty-segment publication. Keep the accepted child document visible
          // until the exact matching acknowledgement, then apply the deferred
          // canonical target in consumePhysicalEditResult.
        } else if (isReplay && replayTarget) {
          if (!restoreSnapshot(replayTarget, true)) {
            finalizeFailed(pending, before, 'exception', 'Could not stage the immutable replay target snapshot.');
            return false;
          }
        } else {
          if (!replaceRecordsAndBreaks(
            revalidatedLaunch.layerId,
            validatedStagedRecords,
            stagedInterpolation,
            stagedIncomingInterpolationBreakKeyIds,
          )) {
            finalizeFailed(pending, before, 'exception', 'Could not stage records and incoming interpolation breaks together.');
            return false;
          }
          if (proposal?.nextLoopClips !== null && proposal?.nextLoopClips !== undefined) {
            const loopResult = portsRef.current.records.replaceLoopClips(revalidatedLaunch.layerId, stagedLoopClips);
            if (!loopResult.ok) {
              finalizeFailed(pending, before, 'exception', loopResult.error);
              return false;
            }
          }
          portsRef.current.selection.setSelectedKeyId(targetSelectedKeyId);
          if (targetSelectedAppFrame !== null) portsRef.current.selection.setCurrentAppFrame(targetSelectedAppFrame);
          portsRef.current.launch.setLaunchContextStartFrame(targetSelectedAppFrame ?? before.currentAppFrame);
          portsRef.current.launch.setLaunchContextCachedFrames(
            validatedStagedRecords,
            { preserveRuntimeCaches: true },
          );
        }

        presentationSignal.value = { status: 'pending', conciseMessage: PHYSICAL_EDIT_PENDING_MESSAGE };
        portsRef.current.status.setApplyStatus('applying');
        portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_PENDING_MESSAGE);
        portsRef.current.status.setLastError(null);

        try {
          await portsRef.current.bridge.sendPhysicalEditPayload(payload);
        } catch (error) {
          finalizeFailed(pending, before, 'transport', error);
          return false;
        }
        if (cancelledRef.current) return false;

        clearTimeoutOnce();
        timeoutRef.current = window.setTimeout(() => {
          const pending = pendingRef.current;
          if (!pending || pending.operationId !== operationId || !beforeRef.current) return;
          finalizeFailed(pending, beforeRef.current, 'timeout', PHYSICAL_EDIT_TIMEOUT_MESSAGE);
          portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_TIMEOUT_MESSAGE);
        }, PHYSICAL_EDIT_TIMEOUT_MS);
        return true;
      } catch (error) {
        if (pendingRef.current && beforeRef.current) {
          finalizeFailed(pendingRef.current, beforeRef.current, 'exception', error);
        } else {
          clearPendingOnce();
        }
        return false;
      }
    },
    [captureSnapshot, clearTimeoutOnce, finalizeFailed, clearPendingOnce, replaceRecordsAndBreaks, restoreSnapshot],
  );

  useEffect(() => () => {
    if (pendingRef.current && beforeRef.current && !cancelledRef.current) {
      cancelledRef.current = true;
      if (pendingRef.current.stagedLocally) {
        restoreSnapshot(beforeRef.current, true);
      }
    }
    clearPendingOnce();
    const settled = settledLeaseRef.current;
    if (settled) {
      portsRef.current.lease.transferToRecovery(settled.token);
      settledLeaseRef.current = null;
    }
  }, [clearPendingOnce, restoreSnapshot]);

  const pendingOperationId = computed(() => pendingOperationIdSignal.value);
  const pendingOperationKind = computed(() => pendingOperationKindSignal.value);
  const presentation = computed(() => presentationSignal.value);
  const acceptedOutput = computed(() => acceptedSignal.value);
  const failureOutput = computed(() => failureSignal.value);
  const recoveryLease = computed(() => recoveryLeaseSignal.value);

  return {
    executePhysicalEdit,
    consumePhysicalEditResult,
    consumeBridgeApplyResult,
    cancelPhysicalEdit,
    acknowledgePhysicalEditSettlement,
    releasePhysicalEditRecoveryLease,
    recoveryLease,
    presentation,
    acceptedOutput,
    failureOutput,
    pendingOperationId,
    pendingOperationKind,
  };
}

/**
 * Build staged ordinary-edit records from the current authoritative records
 * and the resolver proposal. The proposal carries the complete identity-to-frame
 * mapping; existing identities retain their current payload ownership, Duplicate
 * derives only its fresh identity from the current source payload, and Paste
 * derives only its destination/fresh identity from the immutable clipboard
 * payload. Every payload is retargeted to the proposal frame without mutating
 * caller-owned data.
 *
 * Returns null when the proposal cannot be applied (unknown identity or
 * missing payload); the coordinator treats null as a pre-stage barrier
 * failure with no snapshot publication or parent request.
 */
function buildStagedRecords(
  current: readonly PhysicPaintRotoRealKeyRecord[],
  proposal: PhysicPaintRotoPhysicalEditProposal,
  capacity: number,
): PhysicPaintRotoRealKeyRecord[] | null {
  if (proposal.mapping.size > capacity) return null;
  const currentById = new Map<string, PhysicPaintRotoRealKeyRecord>();
  for (const record of current) currentById.set(record.keyId, record);
  const staged: PhysicPaintRotoRealKeyRecord[] = [];
  for (const [keyId, appFrame] of proposal.mapping) {
    const existing = currentById.get(keyId);
    const semanticDelta = proposal.semanticDelta;
    const duplicateSource = semanticDelta?.kind === 'duplicate-key' && keyId === semanticDelta.newKeyId
      ? currentById.get(semanticDelta.sourceKeyId)
      : null;
    const pasteDestinationKeyId = semanticDelta?.kind === 'paste-key'
      ? semanticDelta.destinationKeyId ?? semanticDelta.newKeyId
      : null;
    const pasteGroupEntry = semanticDelta?.kind === 'paste-key-group'
      ? semanticDelta.entries.find((entry) => entry.newKeyId === keyId) ?? null
      : null;
    const insertedEmptyRecord = semanticDelta?.kind === 'insert-empty-segment'
      && keyId === semanticDelta.insertedKeyId
      ? proposal.nextRecords?.find((record) => record.keyId === keyId) ?? null
      : null;
    const sourcePayload = semanticDelta?.kind === 'paste-key' && keyId === pasteDestinationKeyId
      ? semanticDelta.clipboardPayload
      : insertedEmptyRecord?.payload ?? pasteGroupEntry?.payload ?? duplicateSource?.payload ?? existing?.payload;
    if (!sourcePayload) return null;
    if (!Number.isInteger(appFrame) || appFrame < 0 || appFrame >= capacity) return null;
    staged.push({
      kind: 'real-key',
      keyId,
      appFrame,
      payload: clonePayloadAtFrame(sourcePayload, appFrame),
    });
  }
  staged.sort((a, b) => a.appFrame - b.appFrame);
  const seenFrames = new Set<number>();
  for (const record of staged) {
    if (seenFrames.has(record.appFrame)) return null;
    seenFrames.add(record.appFrame);
  }
  return staged;
}

/**
 * Build the staged real-key records for an Undo/Redo replay from the stored
 * target snapshot's immutable records. The snapshot's records already carry
 * each identity-owned payload; this function revalidates capacity, unique
 * keyIds/appFrames, and in-range placement, then returns a fresh sorted
 * array. Returns null when the stored snapshot cannot be replayed against
 * the current capacity; the coordinator treats null as a pre-stage barrier
 * failure with no snapshot publication or parent request.
 *
 * Plan 36.14-05 Task 2 will add parent-side provenance validation that
 * authorizes this replay against the original accepted command before
 * the parent mutates state.
 */
function buildReplayRecords(
  replayRecords: readonly PhysicPaintRotoRealKeyRecord[],
  capacity: number,
): PhysicPaintRotoRealKeyRecord[] | null {
  if (replayRecords.length > capacity) return null;
  const seenKeyIds = new Set<string>();
  const seenAppFrames = new Set<number>();
  const staged: PhysicPaintRotoRealKeyRecord[] = [];
  for (const record of replayRecords) {
    if (!Number.isInteger(record.appFrame) || record.appFrame < 0 || record.appFrame >= capacity) return null;
    if (seenKeyIds.has(record.keyId)) return null;
    if (seenAppFrames.has(record.appFrame)) return null;
    seenKeyIds.add(record.keyId);
    seenAppFrames.add(record.appFrame);
    staged.push({
      kind: 'real-key',
      keyId: record.keyId,
      appFrame: record.appFrame,
      payload: {
        frameIndex: record.payload.frameIndex,
        appFrame: record.payload.appFrame,
        dataUrl: record.payload.dataUrl,
        ...(record.payload.width !== undefined ? { width: record.payload.width } : {}),
        ...(record.payload.height !== undefined ? { height: record.payload.height } : {}),
      },
    });
  }
  staged.sort((a, b) => a.appFrame - b.appFrame);
  return staged;
}