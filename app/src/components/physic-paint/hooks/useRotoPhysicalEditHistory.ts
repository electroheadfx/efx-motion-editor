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
 *   `force-spacing`, `duplicate-key`, `paste-key`, `paste-key-group`,
 *   `insert-empty-segment`, `play-script`, or one of the six Group lifecycle
 *   operations); replay kinds (`undo`, `redo`) are never recorded as new commands;
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
import type {
  PhysicPaintActionHistoryReleaseReason,
  PhysicPaintActionRetainedArtifactReference,
  PhysicPaintActionTransactionMode,
  PhysicPaintRotoPhysicalEditOperationKind,
} from '../../../types/physicPaint';
import {
  buildPhysicPaintRotoPhysicalRevision,
  type PhysicPaintRotoPhysicalDocument,
} from '../roto/physicsPaintRotoPhysicalModel';
import type { PhysicPaintRotoPhysicalEditProposal } from '../roto/physicsPaintRotoPhysicalResolver';
import type {
  RotoPhysicalEditAcceptedOutput,
  RotoPhysicalEditExecuteInput,
  RotoPhysicalEditRecordsPort,
  RotoPhysicalEditSnapshot,
} from '../roto/rotoCoordinatorPorts';
import { getActiveTrackId, setActiveTrackId } from '../../../stores/efxPaintStore';

// 46 UAT debug hook: capture why a Paste/Duplicate command is (or is not)
// recorded and why an Undo replay is rejected. Gated off by default; enable
// from the console via window.__setDebugRotoUndo(true).
let debugRotoUndo = false;
export function setDebugRotoUndo(enabled: boolean): void {
  debugRotoUndo = enabled;
}
function debugUndoLog(message: string): void {
  if (debugRotoUndo) console.warn(`[roto-undo] ${message}`);
}

export interface RotoPhysicalEditHistoryIdentity {
  launchOperationId: string;
  layerId: string;
  projectContextId: string | null;
  capacity: number;
  /** 46-03 (TRK-01): the v1.0 document track the launch operates on (stable id, never index). */
  trackId: string;
}

export type RotoPhysicalEditReplaySourceSnapshot = Pick<
  RotoPhysicalEditSnapshot<unknown>,
  | 'launchOperationId'
  | 'layerId'
  | 'projectContextId'
  | 'records'
  | 'groupOverrideRecords'
  | 'interpolation'
  | 'loopClips'
  | 'incomingInterpolationBreakKeyIds'
  | 'capacity'
  | 'selectedKeyId'
  | 'selectedAppFrame'
  | 'currentAppFrame'
>;

type RotoPhysicalEditOrdinaryOperationKind = Exclude<
  PhysicPaintRotoPhysicalEditOperationKind,
  'undo' | 'redo'
>;

interface RotoPhysicalEditCommand<EngineState> {
  readonly kind: 'physical';
  readonly operationId: string;
  readonly operationKind: RotoPhysicalEditOrdinaryOperationKind;
  /** 46-03 (D-01..D-04): the document track the accepted edit targeted (undo/redo auto-activates it). */
  readonly trackId: string;
  readonly before: RotoPhysicalEditSnapshot<EngineState>;
  readonly after: RotoPhysicalEditSnapshot<EngineState>;
  readonly acceptedRevision: string;
  readonly selectedKeyId: string | null;
  readonly selectedAppFrame: number | null;
}

export interface ReferencedActionHistoryCommand {
  readonly kind: 'referenced-action';
  readonly commandId: string;
  readonly generation: number;
  readonly mode: PhysicPaintActionTransactionMode;
  readonly retainedArtifact: PhysicPaintActionRetainedArtifactReference;
  readonly authority: Readonly<{
    projectContextId: string;
    layerId: string;
    launchOperationId: string;
    scriptLibraryAuthority: string;
    actionId: string;
    actionRevision: string;
  }>;
  readonly before: Readonly<{
    physicalRevision: string;
    physicalHash: string;
    document: PhysicPaintRotoPhysicalDocument;
    selectedGroupId: string | null;
    cursorAppFrame: number;
  }>;
  readonly after: Readonly<{
    physicalRevision: string;
    physicalHash: string;
    document: PhysicPaintRotoPhysicalDocument;
    selectedGroupId: string | null;
    cursorAppFrame: number;
  }>;
}

interface PaintBarrier {
  readonly kind: 'paint';
  readonly mutationId: number;
}

type RotoPhysicalEditHistoryEntry<EngineState> =
  | RotoPhysicalEditCommand<EngineState>
  | ReferencedActionHistoryCommand
  | PaintBarrier;

interface RotoPhysicalEditCoordinatorRoute<EngineState> {
  executePhysicalEdit: (
    input: RotoPhysicalEditExecuteInput<PhysicPaintRotoPhysicalEditProposal, EngineState>,
  ) => Promise<boolean>;
  pendingOperationId: ReadonlySignal<string | null>;
  acceptedOutput: ReadonlySignal<RotoPhysicalEditAcceptedOutput<EngineState> | null>;
}

export interface ReferencedActionHistoryRoute {
  readonly accepted: ReadonlySignal<ReferencedActionHistoryCommand | null>;
  replay: (
    command: ReferencedActionHistoryCommand,
    direction: 'undo' | 'redo',
  ) => Promise<boolean>;
  release?: (
    command: ReferencedActionHistoryCommand,
    reason: PhysicPaintActionHistoryReleaseReason,
  ) => Promise<boolean>;
}

export interface UseRotoPhysicalEditHistoryInput<EngineState> {
  identity: RotoPhysicalEditHistoryIdentity | null;
  availability: Signal<PaintHistoryAvailability>;
  coordinator: RotoPhysicalEditCoordinatorRoute<EngineState>;
  recordsPort: RotoPhysicalEditRecordsPort;
  getLiveSourceSnapshot: () => RotoPhysicalEditReplaySourceSnapshot;
  referencedActionHistory?: ReferencedActionHistoryRoute;
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
    || kind === 'move-group'
    || kind === 'force-spacing'
    || kind === 'duplicate-key'
    || kind === 'paste-key'
    || kind === 'paste-key-group'
    || kind === 'insert-empty-segment'
    || kind === 'delete-key-rail'
    || kind === 'scissor-key-rail'
    || kind === 'move-key-rail'
    || kind === 'push-rails'
    || kind === 'move-rails'
    || kind === 'spacing-on-set'
    || kind === 'delete-rails'
    || kind === 'paste'
    || kind === 'play-script'
    || kind === 'paint-group-frame'
    || kind === 'delete-group-frame'
    || kind === 'delete-group'
    || kind === 'regenerate-group'
    || kind === 'detach-action-groups'
    || kind === 'delete-action-groups';
}

function physicalRecordsEqual(
  leftRecords: RotoPhysicalEditReplaySourceSnapshot['records'],
  rightRecords: RotoPhysicalEditReplaySourceSnapshot['records'],
): boolean {
  if (leftRecords.length !== rightRecords.length) return false;
  for (let index = 0; index < leftRecords.length; index += 1) {
    const left = leftRecords[index];
    const right = rightRecords[index];
    if (left.keyId !== right.keyId) return false;
    if (left.appFrame !== right.appFrame) return false;
    if (left.payload.dataUrl !== right.payload.dataUrl) return false;
    if (left.payload.frameIndex !== right.payload.frameIndex) return false;
    if (left.payload.appFrame !== right.payload.appFrame) return false;
    if (left.payload.width !== right.payload.width) return false;
    if (left.payload.height !== right.payload.height) return false;
  }
  return true;
}

function snapshotRecordsEqual(
  before: RotoPhysicalEditReplaySourceSnapshot,
  after: RotoPhysicalEditReplaySourceSnapshot,
): boolean {
  if (!physicalRecordsEqual(before.records, after.records)
    || !physicalRecordsEqual(before.groupOverrideRecords, after.groupOverrideRecords)) return false;
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
    if (left.syncState !== right.syncState) return false;
    if (left.provenanceState !== right.provenanceState) return false;
    if (left.phaseOrigin !== right.phaseOrigin) return false;
    if (left.originalEndExclusive !== right.originalEndExclusive) return false;
    if ((left.visibleRanges === undefined) !== (right.visibleRanges === undefined)) return false;
    if (left.visibleRanges && right.visibleRanges) {
      if (left.visibleRanges.length !== right.visibleRanges.length) return false;
      for (let rangeIndex = 0; rangeIndex < left.visibleRanges.length; rangeIndex += 1) {
        const leftRange = left.visibleRanges[rangeIndex];
        const rightRange = right.visibleRanges[rangeIndex];
        if (leftRange.start !== rightRange.start
          || leftRange.endExclusive !== rightRange.endExclusive) return false;
      }
    }
    if ((left.frameOverrides === undefined) !== (right.frameOverrides === undefined)) return false;
    if (left.frameOverrides && right.frameOverrides) {
      if (left.frameOverrides.length !== right.frameOverrides.length) return false;
      for (let overrideIndex = 0; overrideIndex < left.frameOverrides.length; overrideIndex += 1) {
        const leftOverride = left.frameOverrides[overrideIndex];
        const rightOverride = right.frameOverrides[overrideIndex];
        if (leftOverride.appFrame !== rightOverride.appFrame
          || leftOverride.keyId !== rightOverride.keyId) return false;
      }
    }
  }
  if (before.incomingInterpolationBreakKeyIds.length !== after.incomingInterpolationBreakKeyIds.length) return false;
  for (let index = 0; index < before.incomingInterpolationBreakKeyIds.length; index += 1) {
    if (before.incomingInterpolationBreakKeyIds[index] !== after.incomingInterpolationBreakKeyIds[index]) return false;
  }
  if (before.selectedKeyId !== after.selectedKeyId) return false;
  if (before.selectedAppFrame !== after.selectedAppFrame) return false;
  return true;
}

function snapshotRevision(snapshot: RotoPhysicalEditReplaySourceSnapshot): string {
  return buildPhysicPaintRotoPhysicalRevision(
    snapshot.records,
    snapshot.interpolation,
    snapshot.loopClips,
    snapshot.incomingInterpolationBreakKeyIds,
    snapshot.groupOverrideRecords,
  );
}

/**
 * 46-03 D-03: stored history commands carry records + refs + the prior
 * deterministic revision hash ONLY — never raster bytes. The coordinator's
 * captured snapshot rides a cached repaint base plus per-frame raster maps
 * (frameStates/previewFrames/capturedFrames/confirmedFrames); the history
 * entry strips them (frames empty, repaint base null) so the undo/redo
 * recompute path stays the single source of raster truth and the 10-entry
 * ledger never multiplies frame-by-frame raster weight. The canonical
 * record dataUrls (references to the cached sidecar) are untouched.
 */
function withoutRasterBytes<EngineState>(
  snapshot: RotoPhysicalEditSnapshot<EngineState>,
): RotoPhysicalEditSnapshot<EngineState> {
  return {
    ...snapshot,
    frameStates: new Map(),
    previewFrames: new Map(),
    capturedFrames: new Map(),
    confirmedFrames: new Map(),
    cachedReference: { url: snapshot.cachedReference.url, cachedRepaintBase: null },
  };
}

/**
 * Canonical-content replay authority: the snapshot's records, interpolation,
 * loop clips and interpolation breaks compared WITHOUT selection or cursor.
 * Selection and cursor are intentionally absent from the canonical revision
 * (43.4 lesson) so an operation's own post-acceptance selection aftermath can
 * never block Undo/Redo: `undo()`'s live-snapshot gate must not fail closed
 * because the pasted/duplicated set was seeded as the live selection after
 * the acceptance recorded its `after` snapshot.
 */
function snapshotCanonicalContentEqual(
  left: RotoPhysicalEditReplaySourceSnapshot,
  right: RotoPhysicalEditReplaySourceSnapshot,
): boolean {
  if (left.records.length !== right.records.length
    || left.groupOverrideRecords.length !== right.groupOverrideRecords.length
    || left.incomingInterpolationBreakKeyIds.length !== right.incomingInterpolationBreakKeyIds.length) return false;
  if (left.interpolation.enabled !== right.interpolation.enabled
    || left.interpolation.mode !== right.interpolation.mode) return false;
  if (left.loopClips.length !== right.loopClips.length) return false;
  for (let index = 0; index < left.records.length; index += 1) {
    const l = left.records[index];
    const r = right.records[index];
    if (l.keyId !== r.keyId || l.appFrame !== r.appFrame) return false;
    if (l.payload.dataUrl !== r.payload.dataUrl
      || l.payload.frameIndex !== r.payload.frameIndex
      || l.payload.appFrame !== r.payload.appFrame
      || l.payload.width !== r.payload.width
      || l.payload.height !== r.payload.height) return false;
  }
  for (let index = 0; index < left.groupOverrideRecords.length; index += 1) {
    const l = left.groupOverrideRecords[index];
    const r = right.groupOverrideRecords[index];
    if (l.keyId !== r.keyId || l.appFrame !== r.appFrame) return false;
  }
  for (let index = 0; index < left.incomingInterpolationBreakKeyIds.length; index += 1) {
    if (left.incomingInterpolationBreakKeyIds[index] !== right.incomingInterpolationBreakKeyIds[index]) return false;
  }
  for (let index = 0; index < left.loopClips.length; index += 1) {
    const l = left.loopClips[index];
    const r = right.loopClips[index];
    if (l.loopId !== r.loopId) return false;
    if (l.placementStart !== r.placementStart) return false;
    if (l.repeat !== r.repeat) return false;
    if (l.mode !== r.mode) return false;
    if (l.sourceKeyIds.length !== r.sourceKeyIds.length) return false;
    for (let keyIndex = 0; keyIndex < l.sourceKeyIds.length; keyIndex += 1) {
      if (l.sourceKeyIds[keyIndex] !== r.sourceKeyIds[keyIndex]) return false;
    }
    if (l.scriptId !== r.scriptId) return false;
    if ((l.motion === undefined) !== (r.motion === undefined)) return false;
    if (l.motion && r.motion
      && (l.motion.deformation !== r.motion.deformation || l.motion.position !== r.motion.position)) return false;
    if ((l.overrideColor ?? null) !== (r.overrideColor ?? null)) return false;
    if (l.syncState !== r.syncState) return false;
    if (l.provenanceState !== r.provenanceState) return false;
    if (l.phaseOrigin !== r.phaseOrigin) return false;
    if (l.originalEndExclusive !== r.originalEndExclusive) return false;
    if ((l.visibleRanges === undefined) !== (r.visibleRanges === undefined)) return false;
    if (l.visibleRanges && r.visibleRanges) {
      if (l.visibleRanges.length !== r.visibleRanges.length) return false;
      for (let rangeIndex = 0; rangeIndex < l.visibleRanges.length; rangeIndex += 1) {
        const lr = l.visibleRanges[rangeIndex];
        const rr = r.visibleRanges[rangeIndex];
        if (lr.start !== rr.start || lr.endExclusive !== rr.endExclusive) return false;
      }
    }
    if ((l.frameOverrides === undefined) !== (r.frameOverrides === undefined)) return false;
    if (l.frameOverrides && r.frameOverrides) {
      if (l.frameOverrides.length !== r.frameOverrides.length) return false;
      for (let overrideIndex = 0; overrideIndex < l.frameOverrides.length; overrideIndex += 1) {
        const lo = l.frameOverrides[overrideIndex];
        const ro = r.frameOverrides[overrideIndex];
        if (lo.appFrame !== ro.appFrame || lo.keyId !== ro.keyId) return false;
      }
    }
  }
  return true;
}

function snapshotReplayAuthorityEqual(
  actual: RotoPhysicalEditReplaySourceSnapshot,
  expected: RotoPhysicalEditReplaySourceSnapshot,
): boolean {
  return actual.launchOperationId === expected.launchOperationId
    && actual.layerId === expected.layerId
    && actual.projectContextId === expected.projectContextId
    && actual.capacity === expected.capacity
    && snapshotCanonicalContentEqual(actual, expected);
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
  const lastAcceptedReferencedActionRef = useRef<string | null>(null);
  const inputRef = useRef(input);
  inputRef.current = input;

  const publishAvailability = useCallback(() => {
    inputRef.current.availability.value = {
      undo: appliedRef.current.length,
      redo: redoRef.current.length,
    };
  }, []);

  const releaseReferencedEntries = useCallback((
    entries: readonly RotoPhysicalEditHistoryEntry<EngineState>[],
    reason: PhysicPaintActionHistoryReleaseReason,
  ) => {
    const release = inputRef.current.referencedActionHistory?.release;
    if (!release) return;
    for (const entry of entries) {
      if (entry.kind === 'referenced-action') void release(entry, reason);
    }
  }, []);

  const trimAppliedHistory = useCallback(() => {
    if (appliedRef.current.length <= 10) return;
    const evicted = appliedRef.current.splice(0, appliedRef.current.length - 10);
    releaseReferencedEntries(evicted, 'eviction');
  }, [releaseReferencedEntries]);

  const discardRedoHistory = useCallback(() => {
    if (redoRef.current.length === 0) return;
    const discarded = redoRef.current;
    redoRef.current = [];
    releaseReferencedEntries(discarded, 'redo-branch-truncation');
  }, [releaseReferencedEntries]);

  const clear = useCallback(() => {
    const owned = [...appliedRef.current, ...redoRef.current];
    appliedRef.current = [];
    redoRef.current = [];
    paintAvailabilityRef.current = { undo: 0, redo: 0 };
    pendingReplayRef.current = null;
    lastAcceptedOperationIdRef.current = null;
    lastAcceptedReferencedActionRef.current = null;
    publishAvailability();
    releaseReferencedEntries(owned, 'session-history-clear');
  }, [publishAvailability, releaseReferencedEntries]);

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
    trimAppliedHistory();
    discardRedoHistory();
    publishAvailability();
  }, [discardRedoHistory, publishAvailability, trimAppliedHistory]);

  const recordAcceptedEdit = useCallback((accepted: RotoPhysicalEditAcceptedOutput<EngineState>) => {
    const identity = inputRef.current.identity;
    if (!identity) return;
    if (accepted.after.launchOperationId !== identity.launchOperationId
      || accepted.after.layerId !== identity.layerId
      || accepted.after.projectContextId !== identity.projectContextId
      || accepted.after.capacity !== identity.capacity) return;
    // 46-03 (D-01): dedupe on operationId + trackId — one cross-track
    // operation emits one acceptance PER track under the same operationId,
    // so the track tag is part of the dedupe identity (never collide).
    const dedupeKey = `${accepted.operationId}:${identity.trackId}`;
    if (lastAcceptedOperationIdRef.current === dedupeKey) return;
    lastAcceptedOperationIdRef.current = dedupeKey;

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
    if (snapshotRecordsEqual(accepted.before, accepted.after)) {
      if (accepted.operationKind === 'paste') {
        debugUndoLog(`paste NOT recorded (before==after): ${accepted.operationId}`);
      }
      return;
    }
    if (accepted.operationKind === 'paste') {
      debugUndoLog(`paste recorded: ${accepted.operationId} kind=${String(accepted.semanticDelta?.kind)}`);
    }
    const command: RotoPhysicalEditCommand<EngineState> = {
      kind: 'physical',
      operationId: accepted.operationId,
      operationKind: accepted.operationKind,
      trackId: identity.trackId,
      before: withoutRasterBytes(accepted.before),
      after: withoutRasterBytes(accepted.after),
      acceptedRevision: accepted.acceptedRevision,
      selectedKeyId: accepted.after.selectedKeyId,
      selectedAppFrame: accepted.after.selectedAppFrame,
    };
    appliedRef.current.push(command);
    trimAppliedHistory();
    discardRedoHistory();
    publishAvailability();
  }, [discardRedoHistory, publishAvailability, trimAppliedHistory]);

  // Signal effects subscribe only to external acceptance streams. Ordinary
  // coordinator acceptance and committed referenced-Action acceptance remain
  // distinct so referenced commands can never fall through snapshot replay.
  useEffect(() => {
    const disposePhysical = effect(() => {
      const accepted = inputRef.current.coordinator.acceptedOutput.value;
      if (!accepted) return;
      recordAcceptedEdit(accepted);
    });
    const disposeReferencedAction = effect(() => {
      const accepted = inputRef.current.referencedActionHistory?.accepted.value ?? null;
      if (!accepted) return;
      const identity = `${accepted.commandId}:${accepted.generation}`;
      if (lastAcceptedReferencedActionRef.current === identity) return;
      const historyIdentity = inputRef.current.identity;
      if (!historyIdentity
        || accepted.authority.projectContextId !== historyIdentity.projectContextId
        || accepted.authority.layerId !== historyIdentity.layerId
        || accepted.authority.launchOperationId !== historyIdentity.launchOperationId
        || accepted.after.document.capacity !== historyIdentity.capacity) return;
      lastAcceptedReferencedActionRef.current = identity;
      appliedRef.current.push(accepted);
      trimAppliedHistory();
      discardRedoHistory();
      publishAvailability();
    });
    return () => {
      disposePhysical();
      disposeReferencedAction();
    };
  }, [discardRedoHistory, publishAvailability, recordAcceptedEdit, trimAppliedHistory]);

  // Launch-identity reset: clear both stacks, the pending replay, the
  // dedupe cache, and publish availability once. Late accepted callbacks
  // for the previous launch are rejected by the identity check in
  // recordAcceptedEdit.
  useEffect(() => {
    clear();
  }, [
    input.identity?.launchOperationId,
    input.identity?.layerId,
    input.identity?.projectContextId,
    input.identity?.capacity,
    clear,
  ]);
  useEffect(() => () => clear(), [clear]);

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
    if (entry.kind === 'referenced-action') {
      const route = inputRef.current.referencedActionHistory;
      if (!route) return false;
      const accepted = await route.replay(entry, 'undo');
      if (!accepted) return false;
      const top = appliedRef.current[appliedRef.current.length - 1];
      if (top !== entry || top.kind !== 'referenced-action') return false;
      appliedRef.current.pop();
      redoRef.current.push(top);
      publishAvailability();
      return true;
    }
    const identity = inputRef.current.identity;
    if (!identity) return false;
    // Selection and cursor are intentionally absent from the canonical
    // revision. Read them only at replay invocation so ordinary movement
    // retains the stack while stale live state fails closed before the
    // coordinator or parent mutation boundary.
    const getLiveSourceSnapshot = inputRef.current.getLiveSourceSnapshot;
    if (typeof getLiveSourceSnapshot !== 'function'
      || !snapshotReplayAuthorityEqual(getLiveSourceSnapshot(), entry.after)) {
      if (entry.kind === 'physical' && entry.operationKind === 'paste') {
        debugUndoLog(`undo rejected at live-authority guard: kind=${entry.operationKind} getLive=${typeof getLiveSourceSnapshot === 'function'}`);
      }
      return false;
    }
    if (entry.kind === 'physical' && entry.operationKind === 'paste') {
      debugUndoLog(`undo live-authority guard passed for ${entry.operationId}; dispatching replay`);
    }
    // 46-03 (D-04): auto-activate the command's track BEFORE the replay seam
    // when another track is active — replay then targets the live document.
    if (getActiveTrackId(identity.layerId) !== entry.trackId) setActiveTrackId(identity.layerId, entry.trackId);
    pendingReplayRef.current = { direction: 'undo', command: entry };
    const proposal = buildReplayProposal(entry.before);
    const beforeTargetRevision = snapshotRevision(entry.before);
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
      if (entry.kind === 'physical' && entry.operationKind === 'paste') {
        debugUndoLog(`undo replay rejected by coordinator for ${entry.operationId}`);
      }
      pendingReplayRef.current = null;
      return false;
    }
    if (entry.kind === 'physical' && entry.operationKind === 'paste') {
      debugUndoLog(`undo replay accepted by coordinator for ${entry.operationId}`);
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
    if (entry.kind === 'referenced-action') {
      const route = inputRef.current.referencedActionHistory;
      if (!route) return false;
      const accepted = await route.replay(entry, 'redo');
      if (!accepted) return false;
      const top = redoRef.current[redoRef.current.length - 1];
      if (top !== entry || top.kind !== 'referenced-action') return false;
      redoRef.current.pop();
      appliedRef.current.push(top);
      publishAvailability();
      return true;
    }
    const identity = inputRef.current.identity;
    if (!identity) return false;
    const beforeRevision = snapshotRevision(entry.before);
    const getLiveSourceSnapshot = inputRef.current.getLiveSourceSnapshot;
    if (typeof getLiveSourceSnapshot !== 'function'
      || !snapshotReplayAuthorityEqual(getLiveSourceSnapshot(), entry.before)) return false;
    // 46-03 (D-04): redo is symmetric — auto-activate the command's track
    // BEFORE the replay seam when another track is active.
    if (getActiveTrackId(identity.layerId) !== entry.trackId) setActiveTrackId(identity.layerId, entry.trackId);
    pendingReplayRef.current = { direction: 'redo', command: entry };
    const proposal = buildReplayProposal(entry.after);
    const afterTargetRevision = snapshotRevision(entry.after);
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
    clear,
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