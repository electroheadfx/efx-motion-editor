/**
 * Generic accepted-only physical-edit history hook (Plan 36.14-05 Task 1).
 *
 * Per D-01/D-03/D-09: one Preact-native command ledger that records every
 * matching accepted ordinary physical edit as one immutable complete
 * command, preserves the existing interleaved paint barriers, and routes
 * Undo/Redo through the same acknowledged coordinator execute seam that
 * owns ordinary edits. The hook never appends replay acceptance as a new
 * command, never mutates either stack optimistically, and never clears
 * redo on a failed/no-change/stale/duplicate/cancelled/disposed outcome.
 *
 * Command shape (D-09):
 * - `operationId`: the coordinator's accepted operation ID (dedupe key);
 * - `operationKind`: the original ordinary kind (`insert-slot`,
 *   `delete-key`, `move-key`, `force-spacing`); replay kinds (`undo`,
 *   `redo`) are never recorded as new commands;
 * - `before`/`after`: immutable complete `RotoPhysicalEditSnapshot`
 *   captured by the coordinator at acceptance, including records,
 *   interpolation, capacity, revisions, selection, buffers, reference,
 *   engine state, and launch identity;
 * - `acceptedRevision`: the parent-confirmed revision of the accepted
 *   `after` state;
 * - `selectedKeyId`/`selectedAppFrame`: post-edit selection metadata.
 *
 * Undo (D-09): peek the top of `applied` without mutating either stack,
 * require no coordinator operation pending, validate the current launch/
 * layer plus the current accepted physical state matches the command's
 * `after` side, construct a replay proposal from the command's `before`
 * records, and call `coordinator.executePhysicalEdit` with `operationKind:
 * 'undo'` and the `before` records/interpolation as the replay target.
 * Only matching acceptance moves the command from `applied` to `redo`;
 * every other result leaves both stacks untouched.
 *
 * Redo (D-09): symmetric — peek the top of `redo`, require no pending
 * coordinator operation, validate current state matches the command's
 * `before` side, replay to `after`, and move the command back to `applied`
 * only on matching acceptance.
 *
 * Paint barriers (D-09): a paint top entry continues to call the engine's
 * synchronous `undoPaint`/`redoPaint`; if the engine reports no change,
 * restore the barrier to its original stack and publish unchanged
 * availability. Ten-level per-brush reconciliation and duplicate-mutation
 * suppression remain intact.
 *
 * Preact-native ownership:
 * - availability is event-published directly to the existing Signal;
 * - pending is read from the coordinator's `pendingOperationId` Signal;
 * - explicit async `undo`/`redo` actions drive replay;
 * - one Signal effect inside a useEffect subscribes to the coordinator's
 *   `acceptedOutput` and tears down on disposal (subscription cleanup).
 *
 * Plan 36.14-05 Task 2 will add replay provenance validation in the
 * closed physical request/result branch and in the parent authority so
 * identity-set Undo/Redo can be authorized against the original accepted
 * command. Task 1 supports identity-preserving replay plus identity-set
 * staging through `replayRecords`; parent-side provenance is added in
 * Task 2.
 */

import { useCallback, useEffect, useRef } from 'preact/hooks';
import { effect, type ReadonlySignal, type Signal } from '@preact/signals';
import type { CompletedPaintMutation, PaintHistoryAvailability } from '@efxlab/efx-physic-paint';
import type { PhysicPaintRotoPhysicalEditOperationKind } from '../../../types/physicPaint';
import { buildPhysicPaintRotoPhysicalRevision } from '../roto/physicsPaintRotoPhysicalModel';
import type { PhysicPaintRotoPhysicalEditProposal } from '../roto/physicsPaintRotoPhysicalResolver';
import type {
  RotoPhysicalEditAcceptedOutput,
  RotoPhysicalEditCoordinatorPorts,
  RotoPhysicalEditExecuteInput,
  RotoPhysicalEditSnapshot,
} from '../roto/rotoCoordinatorPorts';

export interface RotoPhysicalEditHistoryIdentity {
  launchOperationId: string;
  layerId: string;
}

interface RotoPhysicalEditCommand<EngineState> {
  readonly kind: 'physical';
  readonly operationId: string;
  readonly operationKind: PhysicPaintRotoPhysicalEditOperationKind;
  readonly before: RotoPhysicalEditSnapshot<EngineState>;
  readonly after: RotoPhysicalEditSnapshot<EngineState>;
  readonly acceptedRevision: string;
  readonly selectedKeyId: string | null;
  readonly selectedAppFrame: number | null;
}

interface PaintBarrier {
  readonly kind: 'paint';
  readonly mutationId: number;
}

type RotoPhysicalEditHistoryEntry<EngineState> =
  | RotoPhysicalEditCommand<EngineState>
  | PaintBarrier;

interface RotoPhysicalEditCoordinatorRoute<EngineState> {
  executePhysicalEdit: (
    input: RotoPhysicalEditExecuteInput<PhysicPaintRotoPhysicalEditProposal>,
  ) => Promise<boolean>;
  pendingOperationId: ReadonlySignal<string | null>;
  acceptedOutput: ReadonlySignal<RotoPhysicalEditAcceptedOutput<EngineState> | null>;
}

export interface UseRotoPhysicalEditHistoryInput<EngineState> {
  identity: RotoPhysicalEditHistoryIdentity | null;
  availability: Signal<PaintHistoryAvailability>;
  coordinator: RotoPhysicalEditCoordinatorRoute<EngineState>;
  recordsPort: RotoPhysicalEditCoordinatorPorts<EngineState>['records'];
  undoPaint: () => boolean;
  redoPaint: () => boolean;
}

interface PendingReplay<EngineState> {
  readonly direction: 'undo' | 'redo';
  readonly command: RotoPhysicalEditCommand<EngineState>;
}

function isOrdinaryOperationKind(kind: PhysicPaintRotoPhysicalEditOperationKind): boolean {
  return kind === 'insert-slot'
    || kind === 'delete-key'
    || kind === 'move-key'
    || kind === 'force-spacing'
    || kind === 'duplicate-key'
    || kind === 'paste-key';
}

function snapshotRecordsEqual(
  before: RotoPhysicalEditSnapshot<unknown>,
  after: RotoPhysicalEditSnapshot<unknown>,
): boolean {
  if (before.records.length !== after.records.length) return false;
  for (let index = 0; index < before.records.length; index += 1) {
    const left = before.records[index];
    const right = after.records[index];
    if (left.keyId !== right.keyId) return false;
    if (left.appFrame !== right.appFrame) return false;
    if (left.payload.dataUrl !== right.payload.dataUrl) return false;
    if (left.payload.frameIndex !== right.payload.frameIndex) return false;
    if (left.payload.appFrame !== right.payload.appFrame) return false;
    if (left.payload.width !== right.payload.width) return false;
    if (left.payload.height !== right.payload.height) return false;
  }
  if (before.interpolation.enabled !== after.interpolation.enabled) return false;
  if (before.selectedKeyId !== after.selectedKeyId) return false;
  if (before.selectedAppFrame !== after.selectedAppFrame) return false;
  return true;
}

function buildReplayProposal(target: RotoPhysicalEditSnapshot<unknown>): PhysicPaintRotoPhysicalEditProposal {
  const mapping = new Map<string, number>();
  const orderedKeyIds: string[] = [];
  const assignments: { keyId: string; appFrame: number }[] = [];
  for (const record of target.records) {
    mapping.set(record.keyId, record.appFrame);
    orderedKeyIds.push(record.keyId);
    assignments.push({ keyId: record.keyId, appFrame: record.appFrame });
  }
  return {
    mapping,
    orderedKeyIds,
    assignments,
    cells: [],
    generatedCells: [],
    selectedKeyId: target.selectedKeyId,
    selectedAppFrame: target.selectedAppFrame,
    changes: [],
    removedKeyId: null,
    drag: null,
    nextRecords: null,
    semanticDelta: null,
    status: {
      operationKind: 'move-key',
      changed: true,
      affectedKeyIds: orderedKeyIds,
      affectedCount: orderedKeyIds.length,
      code: 'ok',
      text: '',
    },
  };
}

export function useRotoPhysicalEditHistory<EngineState>(input: UseRotoPhysicalEditHistoryInput<EngineState>) {
  const appliedRef = useRef<RotoPhysicalEditHistoryEntry<EngineState>[]>([]);
  const redoRef = useRef<RotoPhysicalEditHistoryEntry<EngineState>[]>([]);
  const paintAvailabilityRef = useRef<PaintHistoryAvailability>({ undo: 0, redo: 0 });
  const pendingReplayRef = useRef<PendingReplay<EngineState> | null>(null);
  const lastAcceptedOperationIdRef = useRef<string | null>(null);
  const inputRef = useRef(input);
  inputRef.current = input;

  const publishAvailability = useCallback(() => {
    inputRef.current.availability.value = {
      undo: appliedRef.current.length,
      redo: redoRef.current.length,
    };
  }, []);

  const reconcilePaintBarriers = useCallback((availability: PaintHistoryAvailability) => {
    paintAvailabilityRef.current = availability;
    const trimOldestPaint = (entries: RotoPhysicalEditHistoryEntry<EngineState>[], maximum: number) => {
      let paintCount = entries.filter((entry) => entry.kind === 'paint').length;
      if (paintCount <= maximum) return entries;
      return entries.filter((entry) => {
        if (entry.kind !== 'paint' || paintCount <= maximum) return true;
        paintCount -= 1;
        return false;
      });
    };
    appliedRef.current = trimOldestPaint(appliedRef.current, Math.min(10, availability.undo));
    redoRef.current = trimOldestPaint(redoRef.current, Math.min(10, availability.redo));
    publishAvailability();
  }, [publishAvailability]);

  const observePaintMutation = useCallback((mutationId: number, kind: CompletedPaintMutation['kind']) => {
    if (!Number.isInteger(mutationId) || mutationId < 0 || kind === 'undo' || kind === 'redo' || kind === 'clear') return;
    if (appliedRef.current.some((entry) => entry.kind === 'paint' && entry.mutationId === mutationId)) return;
    appliedRef.current.push({ kind: 'paint', mutationId });
    let paintCount = appliedRef.current.filter((entry) => entry.kind === 'paint').length;
    const maximum = Math.min(10, paintAvailabilityRef.current.undo);
    if (paintCount > maximum) {
      appliedRef.current = appliedRef.current.filter((entry) => {
        if (entry.kind !== 'paint' || paintCount <= maximum) return true;
        paintCount -= 1;
        return false;
      });
    }
    redoRef.current = [];
    publishAvailability();
  }, [publishAvailability]);

  const recordAcceptedEdit = useCallback((accepted: RotoPhysicalEditAcceptedOutput<EngineState>) => {
    const identity = inputRef.current.identity;
    if (!identity) return;
    if (accepted.after.launchOperationId !== identity.launchOperationId || accepted.after.layerId !== identity.layerId) return;
    if (lastAcceptedOperationIdRef.current === accepted.operationId) return;
    lastAcceptedOperationIdRef.current = accepted.operationId;

    if (!isOrdinaryOperationKind(accepted.operationKind)) {
      // Replay acceptance — move the pending replay command between stacks
      // instead of appending a new command. The coordinator's echoed
      // provenance must match the pending command's operationId and the
      // pending replay direction; otherwise the acceptance is ignored and
      // both stacks stay untouched.
      const pending = pendingReplayRef.current;
      pendingReplayRef.current = null;
      if (!pending) return;
      if (!accepted.historyProvenance) return;
      if (accepted.historyProvenance.historyCommandId !== pending.command.operationId) return;
      if (accepted.historyProvenance.historyDirection !== pending.direction) return;
      if (pending.direction === 'undo') {
        const top = appliedRef.current[appliedRef.current.length - 1];
        if (top !== pending.command || top.kind !== 'physical') return;
        appliedRef.current.pop();
        redoRef.current.push(top);
        publishAvailability();
        return;
      }
      const top = redoRef.current[redoRef.current.length - 1];
      if (top !== pending.command || top.kind !== 'physical') return;
      redoRef.current.pop();
      appliedRef.current.push(top);
      publishAvailability();
      return;
    }

    // Ordinary acceptance — append one immutable complete command and clear
    // redo exactly once. Reject an equal no-change command.
    if (snapshotRecordsEqual(accepted.before, accepted.after)) return;
    const command: RotoPhysicalEditCommand<EngineState> = {
      kind: 'physical',
      operationId: accepted.operationId,
      operationKind: accepted.operationKind,
      before: accepted.before,
      after: accepted.after,
      acceptedRevision: accepted.acceptedRevision,
      selectedKeyId: accepted.after.selectedKeyId,
      selectedAppFrame: accepted.after.selectedAppFrame,
    };
    appliedRef.current.push(command);
    redoRef.current = [];
    publishAvailability();
  }, [publishAvailability]);

  // One Signal effect subscribes to the coordinator's acceptedOutput and
  // dispatches to recordAcceptedEdit. This is subscription setup/teardown
  // only; it does not mirror pending state or coordinate stack transitions
  // through useState.
  useEffect(() => {
    const dispose = effect(() => {
      const accepted = inputRef.current.coordinator.acceptedOutput.value;
      if (!accepted) return;
      recordAcceptedEdit(accepted);
    });
    return () => dispose();
  }, [recordAcceptedEdit]);

  // Launch-identity reset: clear both stacks, the pending replay, the
  // dedupe cache, and publish availability once. Late accepted callbacks
  // for the previous launch are rejected by the identity check in
  // recordAcceptedEdit.
  useEffect(() => {
    appliedRef.current = [];
    redoRef.current = [];
    paintAvailabilityRef.current = { undo: 0, redo: 0 };
    pendingReplayRef.current = null;
    lastAcceptedOperationIdRef.current = null;
    publishAvailability();
  }, [input.identity?.launchOperationId, input.identity?.layerId, publishAvailability]);

  const undo = useCallback(async (): Promise<boolean> => {
    const coordinator = inputRef.current.coordinator;
    if (coordinator.pendingOperationId.value !== null) return false;
    const entry = appliedRef.current[appliedRef.current.length - 1];
    if (!entry) return false;
    if (entry.kind === 'paint') {
      appliedRef.current.pop();
      redoRef.current.push(entry);
      const changed = inputRef.current.undoPaint();
      if (!changed) {
        redoRef.current.pop();
        appliedRef.current.push(entry);
        publishAvailability();
        return false;
      }
      publishAvailability();
      return true;
    }
    const identity = inputRef.current.identity;
    if (!identity) return false;
    const recordsPort = inputRef.current.recordsPort;
    const currentRecords = recordsPort.getRecords(identity.layerId);
    const currentInterpolation = recordsPort.getInterpolation(identity.layerId);
    const currentRevision = buildPhysicPaintRotoPhysicalRevision(currentRecords, currentInterpolation);
    // Undo replays from `after` back to `before`: current state must equal
    // the command's accepted `after` revision.
    if (currentRevision !== entry.acceptedRevision) {
      return false;
    }
    pendingReplayRef.current = { direction: 'undo', command: entry };
    const proposal = buildReplayProposal(entry.before);
    const beforeTargetRevision = buildPhysicPaintRotoPhysicalRevision(entry.before.records, entry.before.interpolation);
    const accepted = await coordinator.executePhysicalEdit({
      proposal,
      expectedLaunch: { operationId: identity.launchOperationId, layerId: identity.layerId },
      operationKind: 'undo',
      selectedKeyId: entry.before.selectedKeyId,
      selectedAppFrame: entry.before.selectedAppFrame,
      replayRecords: entry.before.records,
      replayInterpolation: entry.before.interpolation,
      historyProvenance: {
        historyCommandId: entry.operationId,
        historyDirection: 'undo',
        sourceRevision: entry.acceptedRevision,
        targetRevision: beforeTargetRevision,
      },
    });
    if (!accepted) {
      pendingReplayRef.current = null;
      return false;
    }
    return true;
  }, [publishAvailability]);

  const redo = useCallback(async (): Promise<boolean> => {
    const coordinator = inputRef.current.coordinator;
    if (coordinator.pendingOperationId.value !== null) return false;
    const entry = redoRef.current[redoRef.current.length - 1];
    if (!entry) return false;
    if (entry.kind === 'paint') {
      redoRef.current.pop();
      appliedRef.current.push(entry);
      const changed = inputRef.current.redoPaint();
      if (!changed) {
        appliedRef.current.pop();
        redoRef.current.push(entry);
        publishAvailability();
        return false;
      }
      publishAvailability();
      return true;
    }
    const identity = inputRef.current.identity;
    if (!identity) return false;
    const recordsPort = inputRef.current.recordsPort;
    const currentRecords = recordsPort.getRecords(identity.layerId);
    const currentInterpolation = recordsPort.getInterpolation(identity.layerId);
    const currentRevision = buildPhysicPaintRotoPhysicalRevision(currentRecords, currentInterpolation);
    // Redo replays from `before` forward to `after`: current state must
    // equal the command's `before` revision (recomputed from the stored
    // immutable `before` records/interpolation).
    const beforeRevision = buildPhysicPaintRotoPhysicalRevision(entry.before.records, entry.before.interpolation);
    if (currentRevision !== beforeRevision) {
      return false;
    }
    pendingReplayRef.current = { direction: 'redo', command: entry };
    const proposal = buildReplayProposal(entry.after);
    const afterTargetRevision = buildPhysicPaintRotoPhysicalRevision(entry.after.records, entry.after.interpolation);
    const accepted = await coordinator.executePhysicalEdit({
      proposal,
      expectedLaunch: { operationId: identity.launchOperationId, layerId: identity.layerId },
      operationKind: 'redo',
      selectedKeyId: entry.after.selectedKeyId,
      selectedAppFrame: entry.after.selectedAppFrame,
      replayRecords: entry.after.records,
      replayInterpolation: entry.after.interpolation,
      historyProvenance: {
        historyCommandId: entry.operationId,
        historyDirection: 'redo',
        sourceRevision: beforeRevision,
        targetRevision: afterTargetRevision,
      },
    });
    if (!accepted) {
      pendingReplayRef.current = null;
      return false;
    }
    return true;
  }, [publishAvailability]);

  return {
    observePaintMutation,
    recordAcceptedEdit,
    reconcilePaintBarriers,
    undo,
    redo,
  };
}

// Re-export the snapshot type alias so callers can keep importing from
// the history module without learning the coordinator's internal type
// path.
export type { RotoPhysicalEditSnapshot, RotoPhysicalEditAcceptedOutput } from '../roto/rotoCoordinatorPorts';