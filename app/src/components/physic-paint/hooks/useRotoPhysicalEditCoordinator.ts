/**
 * Generic acknowledged physical-edit coordinator (Plan 36.14-04 Task 2,
 * completed by Plan 36.14-21 exact snapshot replay).
 *
 * This is the sole active physical-edit transaction authority for Insert,
 * Delete, Move, Force Spacing, Duplicate, Paste, enabled-only interpolation,
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
 *   the enabled-only interpolation operation defers its unchanged-record target
 *   until exact parent acceptance so accepted UI state never changes early;
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
import { isPhysicPaintRotoPhysicalEditApplyResult } from '../../../types/physicPaint';
import type {
  PhysicPaintApplyResult,
  PhysicPaintRotoPhysicalEditApplyPayload,
  PhysicPaintRotoPhysicalEditApplyResult,
  PhysicPaintRotoPhysicalEditSemanticDelta,
} from '../../../types/physicPaint';
import type {
  PhysicPaintRotoInterpolationState,
  PhysicPaintRotoRealKeyRecord,
} from '../roto/physicsPaintRotoPhysicalModel';
import { buildPhysicPaintRotoPhysicalRevision } from '../roto/physicsPaintRotoPhysicalModel';
import type { PhysicPaintRotoPhysicalEditProposal } from '../roto/physicsPaintRotoPhysicalResolver';
import { validatePhysicPaintRotoPhysicalEditSemanticDelta } from '../roto/physicsPaintRotoPhysicalResolver';
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
  readonly deferredRecords: readonly PhysicPaintRotoRealKeyRecord[] | null;
  readonly deferredInterpolation: PhysicPaintRotoInterpolationState | null;
}

export interface RotoInterpolationEnabledExecuteInput {
  readonly operationKind: 'set-interpolation-enabled';
  readonly expectedLaunch: { readonly operationId: string; readonly layerId: string };
  readonly records: readonly PhysicPaintRotoRealKeyRecord[];
  readonly targetInterpolation: PhysicPaintRotoInterpolationState;
  readonly selectedKeyId: string | null;
  readonly selectedAppFrame: number | null;
}

export type RotoPhysicalEditCoordinatorExecuteInput<EngineState = unknown> =
  | RotoPhysicalEditExecuteInput<PhysicPaintRotoPhysicalEditProposal, EngineState>
  | RotoInterpolationEnabledExecuteInput;

function semanticDeltaEquals(
  left: PhysicPaintRotoPhysicalEditSemanticDelta | null | undefined,
  right: PhysicPaintRotoPhysicalEditSemanticDelta | null | undefined,
): boolean {
  if (!left || !right) return !left && !right;
  if (left.kind !== right.kind) return false;
  if (left.kind === 'duplicate-key' && right.kind === 'duplicate-key') {
    return left.sourceKeyId === right.sourceKeyId && left.newKeyId === right.newKeyId;
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
    || detail.selectedKeyId !== pending.selectedKeyId
    || detail.selectedAppFrame !== pending.selectedAppFrame
    || detail.appliedFrameCount !== (detail.ok ? pending.appliedFrameCount : 0)
    || !semanticDeltaEquals(detail.semanticDelta, pending.semanticDelta)
    || !replayProvenanceEquals(detail.historyProvenance, pending.historyProvenance)
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
    selectedKeyId: payload.selectedKeyId,
    selectedAppFrame: payload.selectedAppFrame,
    appliedFrameCount: payload.records.length,
    semanticDelta: payload.semanticDelta ?? null,
    historyProvenance: payload.historyProvenance ?? null,
    deferredRecords: deferredTarget ? cloneRecords(deferredTarget.records) : null,
    deferredInterpolation: deferredTarget ? { enabled: deferredTarget.interpolation.enabled } : null,
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
  const inFlightRef = useRef<boolean>(false);
  const cancelledRef = useRef<boolean>(false);

  const presentationSignal = useSignal<RotoPhysicalEditPresentation>({ status: 'idle', conciseMessage: null });
  const acceptedSignal = useSignal<RotoPhysicalEditAcceptedOutput<EngineState> | null>(null);
  const failureSignal = useSignal<RotoPhysicalEditFailureOutput<EngineState> | null>(null);
  const pendingOperationIdSignal = useSignal<string | null>(null);
  const pendingOperationKindSignal = useSignal<PhysicPaintRotoPhysicalEditApplyPayload['operationKind'] | null>(null);

  const portsRef = useRef(ports);
  portsRef.current = ports;

  const clearTimeoutOnce = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const clearPendingOnce = useCallback(() => {
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
      const buffer = portsRef.current.buffer;
      const reference = portsRef.current.reference.getCachedReference();
      return {
        launchOperationId: launch.operationId,
        layerId: launch.layerId,
        projectContextId: launch.project?.contextId ?? null,
        records: cloneRecords(records),
        interpolation: { enabled: interpolation.enabled },
        capacity,
        expectedRevision,
        stagedRevision,
        selectedKeyId: portsRef.current.selection.getSelectedKeyId(),
        selectedAppFrame: portsRef.current.selection.getCurrentAppFrame(),
        currentAppFrame: portsRef.current.selection.getCurrentAppFrame(),
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

  const restoreSnapshot = useCallback(
    (snapshot: RotoPhysicalEditSnapshot<EngineState>, restoreCanvas: boolean): boolean => {
      const launch = portsRef.current.launch.getLaunchContext();
      if (!launch || launch.layerId !== snapshot.layerId || launch.operationId !== snapshot.launchOperationId) return false;
      const replaceResult = portsRef.current.records.replaceRecords(snapshot.layerId, snapshot.records, snapshot.interpolation);
      if (!replaceResult.ok) return false;
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
      portsRef.current.launch.setLaunchContextCachedFrames(snapshot.records);
      if (restoreCanvas && snapshot.engineState !== null && portsRef.current.engine) {
        portsRef.current.engineState.loadEngineState(snapshot.engineState);
      }
      return true;
    },
    [],
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
      clearPendingOnce();
    },
    [captureSnapshot, clearPendingOnce],
  );

  const finalizeFailed = useCallback(
    (
      _pending: PendingPhysicPaintRotoPhysicalEdit,
      before: RotoPhysicalEditSnapshot<EngineState>,
      reason: RotoPhysicalEditFailureOutput<EngineState>['reason'],
      error: unknown,
    ) => {
      const restored = restoreSnapshot(before, true);
      if (!restored) {
        portsRef.current.status.logDiagnostic('Roto physical edit rollback failed: launch context changed before restore.');
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
      );
      if (pending.operationKind === 'set-interpolation-enabled') {
        if (currentStaged !== pending.expectedRevision
          || !pending.deferredRecords
          || !pending.deferredInterpolation) {
          finalizeFailed(pending, before, 'settlement-mismatch', 'Accepted interpolation state no longer matches the deferred child snapshot.');
          return 'accepted';
        }
        const replaceResult = portsRef.current.records.replaceRecords(
          pending.layerId,
          pending.deferredRecords,
          pending.deferredInterpolation,
        );
        if (!replaceResult.ok) {
          finalizeFailed(pending, before, 'exception', replaceResult.error);
          return 'accepted';
        }
        portsRef.current.selection.setSelectedKeyId(pending.selectedKeyId);
        if (pending.selectedAppFrame !== null) {
          portsRef.current.selection.setCurrentAppFrame(pending.selectedAppFrame);
        }
        portsRef.current.launch.setLaunchContextCachedFrames(pending.deferredRecords);
        currentStaged = buildPhysicPaintRotoPhysicalRevision(
          portsRef.current.records.getRecords(pending.layerId),
          portsRef.current.records.getInterpolation(pending.layerId),
        );
      }
      if (currentStaged !== pending.stagedRevision) {
        finalizeFailed(pending, before, 'settlement-mismatch', 'Staged revision drifted before settlement.');
        return 'accepted';
      }
      finalizeAccepted(pending, transition.detail, before);
      return 'accepted';
    },
    [finalizeAccepted, finalizeFailed],
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

  const executePhysicalEdit = useCallback(
    async (input: RotoPhysicalEditCoordinatorExecuteInput<EngineState>): Promise<boolean> => {
      if (inFlightRef.current || pendingRef.current) {
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
      const isInterpolationToggle = input.operationKind === 'set-interpolation-enabled';
      const interpolationToggleInput = 'targetInterpolation' in input ? input : null;
      const proposal = 'proposal' in input ? input.proposal : null;
      const historyProvenance = 'historyProvenance' in input ? input.historyProvenance : undefined;
      const replayTarget = 'replayTargetSnapshot' in input ? input.replayTargetSnapshot : undefined;
      const isReplay = input.operationKind === 'undo' || input.operationKind === 'redo';
      const isSemanticOrdinary = input.operationKind === 'duplicate-key' || input.operationKind === 'paste-key';
      if (isInterpolationToggle) {
        if (!interpolationToggleInput
          || 'proposal' in input
          || 'historyProvenance' in input
          || 'replayTargetSnapshot' in input
          || typeof interpolationToggleInput.targetInterpolation.enabled !== 'boolean') {
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
      if (!isReplay && !isInterpolationToggle && proposal?.status.operationKind !== input.operationKind) {
        portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
        return false;
      }
      if (!isInterpolationToggle
        && (proposal?.selectedKeyId !== input.selectedKeyId || proposal.selectedAppFrame !== input.selectedAppFrame)) {
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
        const revalidatedLaunch = portsRef.current.launch.getLaunchContext();
        if (!revalidatedLaunch
          || revalidatedLaunch.layerId !== input.expectedLaunch.layerId
          || revalidatedLaunch.operationId !== input.expectedLaunch.operationId) {
          portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
          clearPendingOnce();
          return false;
        }
        const currentRecords = portsRef.current.records.getRecords(revalidatedLaunch.layerId);
        const currentInterpolation = portsRef.current.records.getInterpolation(revalidatedLaunch.layerId);
        const capacity = portsRef.current.records.getCapacity(revalidatedLaunch.layerId);
        const expectedRevision = buildPhysicPaintRotoPhysicalRevision(currentRecords, currentInterpolation);
        if (isReplay && (
          !replayTarget
          || replayTarget.launchOperationId !== revalidatedLaunch.operationId
          || replayTarget.layerId !== revalidatedLaunch.layerId
          || replayTarget.projectContextId !== (revalidatedLaunch.project?.contextId ?? null)
          || replayTarget.capacity !== capacity
          || replayTarget.selectedKeyId !== input.selectedKeyId
          || replayTarget.selectedAppFrame !== input.selectedAppFrame
          || !Number.isInteger(replayTarget.currentAppFrame)
          || replayTarget.currentAppFrame < 0
          || replayTarget.currentAppFrame >= capacity
        )) {
          portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
          clearPendingOnce();
          return false;
        }
        if (isInterpolationToggle) {
          const currentSelectedKeyId = portsRef.current.selection.getSelectedKeyId();
          const currentSelectedAppFrame = currentSelectedKeyId === null
            ? null
            : portsRef.current.selection.getCurrentAppFrame();
          if (!interpolationToggleInput
            || !recordsEqual(interpolationToggleInput.records, currentRecords)
            || interpolationToggleInput.targetInterpolation.enabled === currentInterpolation.enabled
            || input.selectedKeyId !== currentSelectedKeyId
            || input.selectedAppFrame !== currentSelectedAppFrame) {
            portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
            clearPendingOnce();
            return false;
          }
        }
        const stagedRecords = isInterpolationToggle
          ? cloneRecords(currentRecords)
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
            selectedKeyId: input.selectedKeyId,
            selectedAppFrame: input.selectedAppFrame,
          });
          if (!semanticValidation.ok) {
            portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
            portsRef.current.status.logDiagnostic(`Roto physical edit semantic validation failed: ${semanticValidation.error}`);
            clearPendingOnce();
            return false;
          }
        }
        const stagedInterpolation = isInterpolationToggle
          ? { enabled: interpolationToggleInput?.targetInterpolation.enabled ?? currentInterpolation.enabled }
          : isReplay && replayTarget
            ? { enabled: replayTarget.interpolation.enabled }
            : { enabled: currentInterpolation.enabled };
        const stagedRevision = buildPhysicPaintRotoPhysicalRevision(stagedRecords, stagedInterpolation);
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
        const payload: PhysicPaintRotoPhysicalEditApplyPayload = {
          kind: 'replace-roto-physical-map',
          operationId,
          operationKind: input.operationKind,
          layerId: revalidatedLaunch.layerId,
          startFrame: input.selectedAppFrame ?? before.currentAppFrame,
          launchOperationId: revalidatedLaunch.operationId,
          ...(revalidatedLaunch.project ? { projectContextId: revalidatedLaunch.project.contextId } : {}),
          expectedRevision,
          records: recordsToApplyPayloadRecords(stagedRecords),
          interpolationEnabled: stagedInterpolation.enabled,
          selectedKeyId: input.selectedKeyId,
          selectedAppFrame: input.selectedAppFrame,
          ...(proposal?.semanticDelta ? { semanticDelta: proposal.semanticDelta } : {}),
          ...(historyProvenance ? { historyProvenance } : {}),
        };
        const pending = createPendingPhysicalEdit(
          payload,
          stagedRevision,
          isInterpolationToggle ? { records: stagedRecords, interpolation: stagedInterpolation } : undefined,
        );
        beforeRef.current = before;
        pendingRef.current = pending;
        pendingOperationIdSignal.value = operationId;
        pendingOperationKindSignal.value = input.operationKind;
        portsRef.current.settlement.registerPendingSettlement(pending);

        if (isInterpolationToggle) {
          // The parent is authoritative for interpolation. Keep the accepted
          // child document visible until the exact matching acknowledgement,
          // then apply the deferred canonical target in consumePhysicalEditResult.
        } else if (isReplay && replayTarget) {
          if (!restoreSnapshot(replayTarget, true)) {
            finalizeFailed(pending, before, 'exception', 'Could not stage the immutable replay target snapshot.');
            return false;
          }
        } else {
          const replaceResult = portsRef.current.records.replaceRecords(revalidatedLaunch.layerId, stagedRecords, stagedInterpolation);
          if (!replaceResult.ok) {
            finalizeFailed(pending, before, 'exception', replaceResult.error);
            return false;
          }
          portsRef.current.selection.setSelectedKeyId(input.selectedKeyId);
          if (input.selectedAppFrame !== null) portsRef.current.selection.setCurrentAppFrame(input.selectedAppFrame);
          portsRef.current.launch.setLaunchContextStartFrame(input.selectedAppFrame ?? before.currentAppFrame);
          portsRef.current.launch.setLaunchContextCachedFrames(stagedRecords);
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
    [captureSnapshot, clearTimeoutOnce, finalizeFailed, clearPendingOnce, restoreSnapshot],
  );

  useEffect(() => () => {
    if (pendingRef.current && beforeRef.current && !cancelledRef.current) {
      cancelledRef.current = true;
      restoreSnapshot(beforeRef.current, true);
    }
    clearPendingOnce();
  }, [clearPendingOnce, restoreSnapshot]);

  const pendingOperationId = computed(() => pendingOperationIdSignal.value);
  const pendingOperationKind = computed(() => pendingOperationKindSignal.value);
  const presentation = computed(() => presentationSignal.value);
  const acceptedOutput = computed(() => acceptedSignal.value);
  const failureOutput = computed(() => failureSignal.value);

  return {
    executePhysicalEdit,
    consumePhysicalEditResult,
    consumeBridgeApplyResult,
    cancelPhysicalEdit,
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
    const sourcePayload = semanticDelta?.kind === 'paste-key' && keyId === pasteDestinationKeyId
      ? semanticDelta.clipboardPayload
      : duplicateSource?.payload ?? existing?.payload;
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