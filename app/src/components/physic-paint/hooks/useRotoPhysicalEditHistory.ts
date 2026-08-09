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
 *   `delete-key`, `delete-key-group`, `move-key`, `move-key-group`,
 *   `force-spacing`, `duplicate-key`, `paste-key`, `paste-key-group`, or
 *   `play-script`); replay kinds (`undo`, `redo`) are never recorded as new
 *   commands;
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
 * 'undo'` and the complete immutable `before` snapshot as the replay target.
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
 * Replay provenance is validated in the closed physical request/result
 * branch, the parent authority, and again before the history cursor moves.
 * Replay stages the complete target snapshot locally while the parent
 * continues to authorize only canonical records/interpolation.
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

type RotoPhysicalEditOrdinaryOperationKind = Exclude<
  PhysicPaintRotoPhysicalEditOperationKind,
  'undo' | 'redo'
>;

interface RotoPhysicalEditCommand<EngineState> {
  readonly kind: 'physical';
  readonly operationId: string;
  readonly operationKind: RotoPhysicalEditOrdinaryOperationKind;
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
    input: RotoPhysicalEditExecuteInput<PhysicPaintRotoPhysicalEditProposal, EngineState>,
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

function isOrdinaryOperationKind(
  kind: PhysicPaintRotoPhysicalEditOperationKind,
): kind is RotoPhysicalEditOrdinaryOperationKind {
  // Phase 43 (D-06/D-10): content-producing commits — including Play Script
  // batch generation and group paste — are ordinary history-bearing commands
  // so a generation plus its derived loop shrink stays one undoable outcome.
  return kind === 'insert-slot'
    || kind === 'delete-key'
    || kind === 'delete-key-group'
    || kind === 'move-key'
    || kind === 'move-key-group'
    || kind === 'force-spacing'
    || kind === 'duplicate-key'
    || kind === 'paste-key'
    || kind === 'paste-key-group'
    || kind === 'play-script';
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
  if (before.interpolation.mode !== after.interpolation.mode) return false;
  // Loop Clips are durable canonical state (Phase 43, Q1): a loop-only
  // difference must register as a change; derived loop state never enters
  // the snapshot, so it can never register as one.
  if (before.loopClips.length !== after.loopClips.length) return false;
  for (let index = 0; index < before.loopClips.length; index += 1) {
    const left = before.loopClips[index];
    const right = after.loopClips[index];
    if (left.loopId !== right.loopId) return false;
    if (left.placementStart !== right.placementStart) return false;
    if (left.repeat !== right.repeat) return false;
    if (left.mode !== right.mode) return false;
    if (left.sourceKeyIds.length !== right.sourceKeyIds.length) return false;
    for (let keyIndex = 0; keyIndex < left.sourceKeyIds.length; keyIndex += 1) {
      if (left.sourceKeyIds[keyIndex] !== right.sourceKeyIds[keyIndex]) return false;
    }
    // 43-06 provenance is durable canonical state too.
    if (left.scriptId !== right.scriptId) return false;
    if ((left.motion === undefined) !== (right.motion === undefined)) return false;
    if (left.motion && right.motion
      && (left.motion.deformation !== right.motion.deformation || left.motion.position !== right.motion.position)) return false;
    if ((left.overrideColor ?? null) !== (right.overrideColor ?? null)) return false;
  }
  if (before.selectedKeyId !== after.selectedKeyId) return false;
  if (before.selectedAppFrame !== after.selectedAppFrame) return false;
  return true;
}

function snapshotRevision(snapshot: RotoPhysicalEditSnapshot<unknown>): string {
  return buildPhysicPaintRotoPhysicalRevision(snapshot.records, snapshot.interpolation, snapshot.loopClips);
}

function snapshotReplayAuthorityEqual(
  actual: RotoPhysicalEditSnapshot<unknown>,
  expected: RotoPhysicalEditSnapshot<unknown>,
): boolean {
  return actual.launchOperationId === expected.launchOperationId
    && actual.layerId === expected.layerId
    && actual.projectContextId === expected.projectContextId
    && actual.capacity === expected.capacity
    && actual.currentAppFrame === expected.currentAppFrame
    && snapshotRecordsEqual(actual, expected);
}

function replayAcceptanceMatchesPending<EngineState>(
  accepted: RotoPhysicalEditAcceptedOutput<EngineState>,
  pending: PendingReplay<EngineState>,
): boolean {
  const beforeRevision = snapshotRevision(pending.command.before);
  const source = pending.direction === 'undo' ? pending.command.after : pending.command.before;
  const target = pending.direction === 'undo' ? pending.command.before : pending.command.after;
  const sourceRevision = pending.direction === 'undo'
    ? pending.command.acceptedRevision
    : beforeRevision;
  const targetRevision = pending.direction === 'undo'
    ? beforeRevision
    : pending.command.acceptedRevision;
  const provenance = accepted.historyProvenance;

  return accepted.operationKind === pending.direction
    && provenance?.historyCommandId === pending.command.operationId
    && provenance.historyDirection === pending.direction
    && provenance.sourceRevision === sourceRevision
    && provenance.targetRevision === targetRevision
    && snapshotRevision(accepted.before) === sourceRevision
    && snapshotRevision(accepted.after) === targetRevision
    && accepted.acceptedRevision === targetRevision
    && snapshotReplayAuthorityEqual(accepted.before, source)
    && snapshotReplayAuthorityEqual(accepted.after, target);
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
    removedKeyIds: Object.freeze([]) as readonly string[],
    drag: null,
    nextRecords: null,
    nextLoopClips: null,
    nextIncomingInterpolationBreakKeyIds: null,
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
      // instead of appending a new command. The complete accepted source and
      // target authority plus command ID, direction, and both revisions must
      // match the pending immutable command before either stack can move.
      const pending = pendingReplayRef.current;
      if (!pending) return;
      pendingReplayRef.current = null;
      if (!replayAcceptanceMatchesPending(accepted, pending)) return;
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
    const currentRevision = buildPhysicPaintRotoPhysicalRevision(currentRecords, currentInterpolation, recordsPort.getLoopClips(identity.layerId));
    // Undo replays from `after` back to `before`: current state must equal
    // the command's accepted `after` revision.
    if (currentRevision !== entry.acceptedRevision) {
      return false;
    }
    pendingReplayRef.current = { direction: 'undo', command: entry };
    const proposal = buildReplayProposal(entry.before);
    const beforeTargetRevision = buildPhysicPaintRotoPhysicalRevision(entry.before.records, entry.before.interpolation, entry.before.loopClips);
    const accepted = await coordinator.executePhysicalEdit({
      proposal,
      expectedLaunch: { operationId: identity.launchOperationId, layerId: identity.layerId },
      operationKind: 'undo',
      selectedKeyId: entry.before.selectedKeyId,
      selectedAppFrame: entry.before.selectedAppFrame,
      replayTargetSnapshot: entry.before,
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
    const currentRevision = buildPhysicPaintRotoPhysicalRevision(currentRecords, currentInterpolation, recordsPort.getLoopClips(identity.layerId));
    // Redo replays from `before` forward to `after`: current state must
    // equal the command's `before` revision (recomputed from the stored
    // immutable `before` records/interpolation/loopClips).
    const beforeRevision = buildPhysicPaintRotoPhysicalRevision(entry.before.records, entry.before.interpolation, entry.before.loopClips);
    if (currentRevision !== beforeRevision) {
      return false;
    }
    pendingReplayRef.current = { direction: 'redo', command: entry };
    const proposal = buildReplayProposal(entry.after);
    const afterTargetRevision = buildPhysicPaintRotoPhysicalRevision(entry.after.records, entry.after.interpolation, entry.after.loopClips);
    const accepted = await coordinator.executePhysicalEdit({
      proposal,
      expectedLaunch: { operationId: identity.launchOperationId, layerId: identity.layerId },
      operationKind: 'redo',
      selectedKeyId: entry.after.selectedKeyId,
      selectedAppFrame: entry.after.selectedAppFrame,
      replayTargetSnapshot: entry.after,
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