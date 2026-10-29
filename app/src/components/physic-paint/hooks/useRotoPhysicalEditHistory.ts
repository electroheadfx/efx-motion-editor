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
 *   `play-script`, or one of the six Group lifecycle
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
// TEMP (261029-lsr UAT row 4): decision trace for the auto-key undo path.
import { recordAquarelleRenderSplitEvent } from '../performance/aquarelleRenderSplitCapture';
import type { CompletedPaintMutation, PaintHistoryAvailability } from '../types/paintCore';
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
import {
  getActiveTrackId,
  getDocument,
  registerDocument,
  resyncRuntimeForBackgroundEdit,
  setActiveTrackId,
  type BackgroundEditDescriptor,
} from '../../../stores/efxPaintStore';
import { buildEfxPaintDocumentRevision } from '../../../efx-paint/document/efxPaintDocumentRevision';
import type { EfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';

/**
 * G-52-5: the live-authority check for background (document-level) entries.
 * Identity fast path first, then a CONTENT-REVISION comparison. Reference
 * display-preference writes (opacity/visibility/lock/transform) replace the
 * document object WITHOUT touching the content fingerprint (the D-07 split
 * excludes the display fields and never bumps documentRevision) — a bare
 * identity comparison failed closed forever after any display tweak, killing
 * undo/redo for the whole ledger. Unrecorded CONTENT edits still rotate the
 * fingerprint and fail closed (the CR-01 protection is unchanged). Fail
 * closed on a parse throw.
 */
function liveDocumentMatchesRecorded(live: EfxPaintDocument | null, recorded: EfxPaintDocument): boolean {
  if (live === recorded) return true;
  if (live === null) return false;
  try {
    return buildEfxPaintDocumentRevision(live) === buildEfxPaintDocumentRevision(recorded);
  } catch {
    return false;
  }
}

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

/**
 * Quick 261019-mj2 Task 4 (D-14): one composite ledger entry produced by a
 * no-argument auto-key reservation. The accepted key command (bound by the
 * coordinator-minted `operationId`) and the next completed paint mutation form
 * ONE undo step: undo removes the stroke, then replays the key's `before`;
 * redo replays the key's `after`, then restores the stroke.
 */
interface AutoKeyPaintHistoryEntry<EngineState> {
  readonly kind: 'auto-key-paint';
  readonly command: RotoPhysicalEditCommand<EngineState>;
  readonly mutationId: number;
}

/**
 * The reservation binds the NEXT accepted ordinary command and the NEXT
 * completed paint mutation. Either half may arrive first; the composite entry
 * is pushed as soon as both are present. A command with no following mutation
 * degrades to a plain physical entry (flushed on the next acceptance or on
 * undo). The reservation NEVER carries a pre-minted operation id.
 */
interface AutoKeyPaintGroupReservation<EngineState> {
  command: RotoPhysicalEditCommand<EngineState> | null;
  mutationId: number | null;
}

/** 49-06 UAT: a committed Background document edit (delete) recorded in the
 *  unified ledger — undo restores `before`, redo re-applies `after` (BKG-08,
 *  D-08). The descriptor carries the exact document objects by reference. */
interface BackgroundEditCommand {
  readonly kind: 'background';
  readonly descriptor: BackgroundEditDescriptor;
}

/**
 * 261022-pim: one watercolor stroke delete + its re-bake. The `editId` keys
 * the revision-authoritative script snapshots and the shared Apply replay in
 * the Studio's `aquarelleScriptHistory` port — never a coordinator command.
 */
interface AquarelleScriptEditCommand {
  readonly kind: 'aquarelle-script';
  readonly editId: number;
}

type RotoPhysicalEditHistoryEntry<EngineState> =
  | RotoPhysicalEditCommand<EngineState>
  | AutoKeyPaintHistoryEntry<EngineState>
  | ReferencedActionHistoryCommand
  | PaintBarrier
  | BackgroundEditCommand
  | AquarelleScriptEditCommand;

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

export interface AquarelleScriptHistoryRoute {
  replay: (editId: number, direction: 'undo' | 'redo') => Promise<boolean>;
  /**
   * 261029-lsr: true when this mutation id names a RECORDED script stroke.
   * A tombstoned stroke still answers true, so the REDO of a paint entry that
   * was just undone still routes through the script (R-2) — the tombstone
   * refusal lives inside the edit builder, not in this predicate.
   */
  hasRecordedStroke: (mutationId: number) => boolean;
  /**
   * 261029-lsr: undo/redo ONE recorded stroke as a script edit + re-bake.
   * Resolves false (never throws) when the script swap or the bake refuses;
   * the caller must leave both stacks untouched.
   */
  replayStroke: (mutationId: number, direction: 'undo' | 'redo') => Promise<boolean>;
}

export interface UseRotoPhysicalEditHistoryInput<EngineState> {
  identity: RotoPhysicalEditHistoryIdentity | null;
  availability: Signal<PaintHistoryAvailability>;
  coordinator: RotoPhysicalEditCoordinatorRoute<EngineState>;
  recordsPort: RotoPhysicalEditRecordsPort;
  getLiveSourceSnapshot: () => RotoPhysicalEditReplaySourceSnapshot;
  referencedActionHistory?: ReferencedActionHistoryRoute;
  /** 261022-pim: revision-authoritative watercolor script replay. */
  aquarelleScriptHistory?: AquarelleScriptHistoryRoute;
  /**
   * 261029-lsr UAT row 5: any undoable entry leaves playback first. The old
   * engine undo stopped playback inside the frame-editing controller; the
   * unified ledger owns every entry kind now, so the stop lives here — after
   * the busy/empty-stack refusals (a refused Cmd+Z never kills a session).
   */
  stopPlayback?: () => void;
  undoPaint: () => boolean;
  redoPaint: () => boolean;
}

interface PendingReplay<EngineState> {
  readonly direction: 'undo' | 'redo';
  readonly command: RotoPhysicalEditCommand<EngineState>;
  /**
   * 261029-lsr UAT row 4: the auto-key composite's source side is owned by the
   * live capture pipeline (the first stroke commits painted pixels onto the
   * created key), so its source snapshot legitimately carries different bytes
   * than the recorded `after`. The TARGET side stays strict.
   */
  readonly ignoreSourcePayloadBytes?: boolean;
}

function isOrdinaryOperationKind(
  kind: PhysicPaintRotoPhysicalEditOperationKind,
): kind is RotoPhysicalEditOrdinaryOperationKind {
  // Phase 43 (D-06/D-10): content-producing commits — including Play Script
  // batch generation and group paste — are ordinary history-bearing commands
  // so a generation plus its derived loop shrink stays one undoable outcome.
  return kind === 'insert-slot'
    || kind === 'delete-slot'
    || kind === 'delete-key'
    || kind === 'delete-key-group'
    || kind === 'move-key'
    || kind === 'move-key-group'
    || kind === 'move-group'
    || kind === 'force-spacing'
    || kind === 'duplicate-key'
    || kind === 'paste-key'
    || kind === 'paste-key-group'
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
    if (left.payload.bytes !== right.payload.bytes) return false;
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

export function snapshotRevision(snapshot: RotoPhysicalEditReplaySourceSnapshot): string {
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
  ignorePayloadBytes = false,
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
    if ((!ignorePayloadBytes && l.payload.bytes !== r.payload.bytes)
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
  ignorePayloadBytes = false,
): boolean {
  return actual.launchOperationId === expected.launchOperationId
    && actual.layerId === expected.layerId
    && actual.projectContextId === expected.projectContextId
    && actual.capacity === expected.capacity
    && snapshotCanonicalContentEqual(actual, expected, ignorePayloadBytes);
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
    && snapshotReplayAuthorityEqual(accepted.before, source, pending.ignoreSourcePayloadBytes === true)
    && snapshotReplayAuthorityEqual(accepted.after, target);
}

export function buildReplayProposal(target: RotoPhysicalEditSnapshot<unknown>): PhysicPaintRotoPhysicalEditProposal {
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
    // Quick 261019-mj2: the replay proposal carries the snapshot's cursor
    // authority — replaying `before`/`after` restores the frame it recorded.
    cursorAppFrame: target.currentAppFrame,
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
  const autoKeyPaintGroupRef = useRef<AutoKeyPaintGroupReservation<EngineState> | null>(null);
  const lastAcceptedOperationIdRef = useRef<string | null>(null);
  const lastAcceptedReferencedActionRef = useRef<string | null>(null);
  const inputRef = useRef(input);
  inputRef.current = input;

  const publishAvailability = useCallback(() => {
    // A command held by the auto-key reservation is already one undoable
    // outcome: expose it so the Undo control stays enabled while the first
    // stroke is still in flight (or when the Create key button path produced
    // a key with no stroke at all).
    const heldAutoKeyCommand = autoKeyPaintGroupRef.current?.command ? 1 : 0;
    inputRef.current.availability.value = {
      undo: appliedRef.current.length + heldAutoKeyCommand,
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
    autoKeyPaintGroupRef.current = null;
    lastAcceptedOperationIdRef.current = null;
    lastAcceptedReferencedActionRef.current = null;
    publishAvailability();
    releaseReferencedEntries(owned, 'session-history-clear');
  }, [publishAvailability, releaseReferencedEntries]);

  /** Arm the composite undo reservation. NO argument: the coordinator mints
   *  the operation id at dispatch and `recordAcceptedEdit` binds it when the
   *  acceptance arrives. */
  const beginAutoKeyPaintGroup = useCallback(() => {
    autoKeyPaintGroupRef.current = { command: null, mutationId: null };
    publishAvailability();
  }, [publishAvailability]);

  /** Drop the reservation when the promotion fails or is rejected, so no
   *  held acceptance can survive a discarded key. */
  const cancelAutoKeyPaintGroup = useCallback(() => {
    if (autoKeyPaintGroupRef.current === null) return;
    autoKeyPaintGroupRef.current = null;
    publishAvailability();
  }, [publishAvailability]);

  /** A held acceptance whose paint mutation never arrived degrades to one
   *  plain physical entry (Create key button path). */
  const flushPendingAutoKeyGroup = useCallback(() => {
    const reservation = autoKeyPaintGroupRef.current;
    if (!reservation) return;
    autoKeyPaintGroupRef.current = null;
    if (reservation.command) {
      appliedRef.current.push(reservation.command);
      trimAppliedHistory();
      discardRedoHistory();
    }
    publishAvailability();
  }, [discardRedoHistory, publishAvailability, trimAppliedHistory]);

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
    if (appliedRef.current.some((entry) => (
      (entry.kind === 'paint' || entry.kind === 'auto-key-paint') && entry.mutationId === mutationId
    ))) return;
    const reservation = autoKeyPaintGroupRef.current;
    if (reservation) {
      if (reservation.command) {
        // Both halves are present: one composite undo step.
        autoKeyPaintGroupRef.current = null;
        appliedRef.current.push({ kind: 'auto-key-paint', command: reservation.command, mutationId });
        trimAppliedHistory();
        discardRedoHistory();
        publishAvailability();
        return;
      }
      if (reservation.mutationId === null) {
        // The stroke completed before the key acceptance: hold its id until
        // the coordinator-minted acceptance arrives.
        reservation.mutationId = mutationId;
        publishAvailability();
        return;
      }
      // An earlier mutation is already bound and no key was ever accepted;
      // this is an ordinary paint barrier.
    }
    appliedRef.current.push({ kind: 'paint', mutationId });
    let paintCount = appliedRef.current.filter((entry) => entry.kind === 'paint').length;
    // 261029-lsr UAT row 1: the cap is the hard 10, NOT the engine's live undo
    // count. `paintAvailabilityRef` could only ever be seeded by
    // `reconcilePaintBarriers`, whose single caller was engine-1's
    // `setHistoryAvailabilityListener` — removed with the Brush module
    // (261027-klx). The ref therefore stayed at `{ undo: 0 }`, `maximum` was 0,
    // and the barrier pushed on the line above was trimmed away again in the
    // same call: fresh paint never reached the ledger, so Undo stayed disabled
    // and Cmd+Z was a no-op. Script edits (`aquarelle-script`) never went
    // through this cap, which is why delete/move undo kept working.
    const maximum = 10;
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
      || accepted.after.projectContextId !== identity.projectContextId) return;
    const ordinaryKind = isOrdinaryOperationKind(accepted.operationKind);
    // Capacity is monotonic within a launch (D-16): an ordinary gap insert
    // may RAISE it and stays recordable (a capacity raise never resets the
    // ledger — `capacity` is no longer a launch-reset key). Every other
    // ordinary kind requires the exact capacity. Replay acceptances carry the
    // command's own before/after capacities; their authority is the replay
    // provenance, not the live launch capacity.
    if (ordinaryKind && accepted.operationKind !== 'insert-slot'
      && accepted.after.capacity !== identity.capacity) return;
    if (ordinaryKind && accepted.operationKind === 'insert-slot'
      && accepted.after.capacity < identity.capacity) return;
    // 46-03 (D-01): dedupe on operationId + trackId — one cross-track
    // operation emits one acceptance PER track under the same operationId,
    // so the track tag is part of the dedupe identity (never collide).
    const dedupeKey = `${accepted.operationId}:${identity.trackId}`;
    if (lastAcceptedOperationIdRef.current === dedupeKey) return;
    lastAcceptedOperationIdRef.current = dedupeKey;

    if (!ordinaryKind) {
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
        if (!top) return;
        if (top.kind === 'physical' && top === pending.command) {
          appliedRef.current.pop();
          redoRef.current.push(top);
          publishAvailability();
          return;
        }
        if (top.kind === 'auto-key-paint' && top.command === pending.command) {
          appliedRef.current.pop();
          redoRef.current.push(top);
          publishAvailability();
        }
        return;
      }
      const top = redoRef.current[redoRef.current.length - 1];
      if (!top) return;
      if ((top.kind === 'physical' && top === pending.command)
        || (top.kind === 'auto-key-paint' && top.command === pending.command)) {
        redoRef.current.pop();
        appliedRef.current.push(top);
        publishAvailability();
      }
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
    const reservation = autoKeyPaintGroupRef.current;
    if (reservation) {
      autoKeyPaintGroupRef.current = null;
      // A held acceptance that never received its stroke degrades to one
      // plain physical entry before this acceptance takes the reservation.
      if (reservation.command) appliedRef.current.push(reservation.command);
      if (reservation.mutationId !== null) {
        appliedRef.current.push({ kind: 'auto-key-paint', command, mutationId: reservation.mutationId });
      } else {
        // The acceptance arrived before the first stroke completed: hold it
        // until `observePaintMutation` supplies the mutation id.
        autoKeyPaintGroupRef.current = { command, mutationId: null };
      }
      trimAppliedHistory();
      discardRedoHistory();
      publishAvailability();
      return;
    }
    appliedRef.current.push(command);
    trimAppliedHistory();
    discardRedoHistory();
    publishAvailability();
  }, [discardRedoHistory, publishAvailability, trimAppliedHistory]);

  /** 49-06 UAT: record a committed Background document edit (delete) as one
   *  unified-ledger command. The descriptor's before/after are the exact
   *  document objects by reference — undo restores `before`, redo re-applies
   *  `after` (BKG-08, D-08). Clears redo exactly once, like every ordinary
   *  command. */
  const recordBackgroundEdit = useCallback((descriptor: BackgroundEditDescriptor) => {
    appliedRef.current.push({ kind: 'background', descriptor });
    trimAppliedHistory();
    discardRedoHistory();
    publishAvailability();
  }, [discardRedoHistory, publishAvailability, trimAppliedHistory]);

  /** 261022-pim: record one watercolor delete + re-bake as one command,
   *  mirroring `recordBackgroundEdit` exactly (push, trim, clear redo). */
  const recordAquarelleScriptEdit = useCallback((editId: number) => {
    appliedRef.current.push({ kind: 'aquarelle-script', editId });
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
    // Capacity is intentionally NOT a reset key (D-16): a tail insert raises
    // it monotonically and must never clear the undo/redo ledger on re-render.
    clear,
  ]);
  useEffect(() => () => clear(), [clear]);

  const undo = useCallback(async (): Promise<boolean> => {
    const coordinator = inputRef.current.coordinator;
    if (coordinator.pendingOperationId.value !== null) return false;
    // A Create-key acceptance with no stroke degrades to one plain command so
    // Undo can remove the key the user just created.
    flushPendingAutoKeyGroup();
    const entry = appliedRef.current[appliedRef.current.length - 1];
    if (!entry) return false;
    // UAT row 5: an undoable entry ends playback before any entry branch runs
    // (the script route stops it again inside `runScriptReplay`, harmlessly).
    inputRef.current.stopPlayback?.();
    recordAquarelleRenderSplitEvent('undo-probe', {
      stage: 'entry',
      direction: 'undo',
      kind: entry.kind,
      mutationId: 'mutationId' in entry ? entry.mutationId : null,
      applied: appliedRef.current.length,
      redo: redoRef.current.length,
    });
    if (entry.kind === 'aquarelle-script') {
      // 261022-pim: the replay port swaps the script snapshot, resets the live
      // sheet and awaits the shared Apply. Stacks move ONLY on true — a stale
      // snapshot or a failed re-bake leaves both stacks untouched.
      const route = inputRef.current.aquarelleScriptHistory;
      if (!route) return false;
      const replayed = await route.replay(entry.editId, 'undo');
      if (!replayed) return false;
      const top = appliedRef.current[appliedRef.current.length - 1];
      if (top !== entry) return false;
      appliedRef.current.pop();
      redoRef.current.push(entry);
      publishAvailability();
      return true;
    }
    if (entry.kind === 'paint') {
      // 261029-lsr: a RECORDED stroke's undo is script-authoritative — the
      // script event leaves the timeline and the frame is re-baked through the
      // shared Apply path, so the display can never drift from its bake. An
      // unrecorded stroke (Script switch OFF, a raster Lift that pins nothing)
      // keeps the engine-only tile restore below.
      const route = inputRef.current.aquarelleScriptHistory;
      const strokeRecorded = route !== undefined && route.hasRecordedStroke(entry.mutationId);
      recordAquarelleRenderSplitEvent('undo-probe', {
        stage: 'paint-route',
        mutationId: entry.mutationId,
        recorded: strokeRecorded,
        hasRoute: route !== undefined,
      });
      if (strokeRecorded && route !== undefined) {
        const replayed = await route.replayStroke(entry.mutationId, 'undo');
        // Never fall back to undoPaint() after a reset: engine.clear() is a
        // history step, so an engine undo would resurrect pre-undo pixels.
        recordAquarelleRenderSplitEvent('undo-probe', { stage: 'paint-replay', mutationId: entry.mutationId, replayed });
        if (!replayed) return false;
        const top = appliedRef.current[appliedRef.current.length - 1];
        if (top !== entry) return false;
        appliedRef.current.pop();
        redoRef.current.push(entry);
        publishAvailability();
        return true;
      }
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
    if (entry.kind === 'background') {
      // 49-06 UAT: a Background document edit restores the exact prior
      // document by reference (BKG-08, D-08) — no coordinator replay seam.
      // Live-state authority guard (CR-01, G-52-5): undo only when the live
      // document still matches the recorded `after` by content revision
      // (identity fast path). An unrecorded CONTENT edit since the record
      // (add/move/repeat/scale/fallback/source-set) rotates the fingerprint
      // and fails closed (stack untouched); a display-preference-only write
      // (reference opacity/lock/visibility/transform) does NOT — it replaces
      // the document object without touching the fingerprint, and must not
      // kill the ledger.
      if (!liveDocumentMatchesRecorded(getDocument(entry.descriptor.after.parentLayerId), entry.descriptor.after)) return false;
      // 52 CR-01: the reveal mutations write the runtime as well as the
      // document (baked records + rail clip). Resync the affected track's
      // runtime from the restored `before` document BEFORE publishing either
      // change, so a failed install fails the undo closed (document not yet
      // restored, stacks untouched). Non-reveal background entries no-op.
      if (!resyncRuntimeForBackgroundEdit(entry.descriptor, 'undo')) return false;
      appliedRef.current.pop();
      redoRef.current.push(entry);
      registerDocument(entry.descriptor.before);
      publishAvailability();
      return true;
    }
    const identity = inputRef.current.identity;
    if (!identity) return false;
    if (entry.kind === 'auto-key-paint') {
      // D-14: one undo removes the created key AND the first stroke. The
      // stroke removal runs FIRST; a rejected key replay reverts it and leaves
      // both stacks untouched.
      const command = entry.command;
      // 261029-lsr (D-06): the first stroke painted under an auto-key
      // acceptance is a recorded stroke like any other — its half routes
      // through the script. `route !== undefined` is re-checked at each use
      // site because `recordedStroke` is a plain boolean, not a type guard.
      const route = inputRef.current.aquarelleScriptHistory;
      const recordedStroke = route !== undefined && route.hasRecordedStroke(entry.mutationId);
      const autoKeyLiveSnapshot = inputRef.current.getLiveSourceSnapshot;
      // 261029-lsr UAT row 4: the live-authority gate ignores record PAYLOAD
      // bytes for this composite. The key this command created is owned by the
      // live capture pipeline — the first stroke's settle capture legitimately
      // replaces its payload with the painted pixels before the user can press
      // undo, and the command deletes that whole key anyway. Bytes were
      // compared by reference, so the gate always failed and the Cmd+Z was a
      // silent no-op. Structural identity (record set/order/frames, capacity,
      // launching realm, loops) is still strict, so a real competing edit
      // fails closed.
      const autoKeyLive = typeof autoKeyLiveSnapshot === 'function' ? autoKeyLiveSnapshot() : null;
      const autoKeyGuardOk = autoKeyLive !== null && snapshotReplayAuthorityEqual(autoKeyLive, command.after, true);
      recordAquarelleRenderSplitEvent('undo-probe', {
        stage: 'auto-key-guard',
        mutationId: entry.mutationId,
        recorded: recordedStroke,
        hasRoute: route !== undefined,
        guardOk: autoKeyGuardOk,
        live: autoKeyLive === null ? null : {
          records: autoKeyLive.records.map(({ keyId, appFrame }) => [keyId, appFrame]),
          capacity: autoKeyLive.capacity,
        },
        expected: {
          records: command.after.records.map(({ keyId, appFrame }) => [keyId, appFrame]),
          capacity: command.after.capacity,
        },
      });
      if (!autoKeyGuardOk) return false;
      if (recordedStroke && route !== undefined) {
        const strokeReplayed = await route.replayStroke(entry.mutationId, 'undo');
        recordAquarelleRenderSplitEvent('undo-probe', { stage: 'auto-key-stroke-replay', strokeReplayed });
        if (!strokeReplayed) return false;
      } else {
        const painted = inputRef.current.undoPaint();
        recordAquarelleRenderSplitEvent('undo-probe', { stage: 'auto-key-undo-paint', painted });
        if (!painted) return false;
      }
      if (getActiveTrackId(identity.layerId) !== command.trackId) setActiveTrackId(identity.layerId, command.trackId);
      // The recorded `acceptedRevision` predates every capture that committed
      // the first stroke's pixels onto the created key, so the coordinator's
      // replay provenance (which must equal the CURRENT revision) has to read
      // the live revision — the same one the structural gate just accepted.
      // Re-read AFTER the stroke half: its settle capture may have committed in
      // between, and the provenance must match the revision at dispatch.
      const autoKeyDispatchLive = typeof autoKeyLiveSnapshot === 'function' ? autoKeyLiveSnapshot() : null;
      if (!autoKeyDispatchLive || !snapshotReplayAuthorityEqual(autoKeyDispatchLive, command.after, true)) {
        recordAquarelleRenderSplitEvent('undo-probe', { stage: 'auto-key-dispatch-stale' });
        if (recordedStroke && route !== undefined) await route.replayStroke(entry.mutationId, 'redo');
        else inputRef.current.redoPaint();
        publishAvailability();
        return false;
      }
      pendingReplayRef.current = { direction: 'undo', command, ignoreSourcePayloadBytes: true };
      const autoKeyProposal = buildReplayProposal(command.before);
      const autoKeyBeforeRevision = snapshotRevision(command.before);
      const autoKeyLiveRevision = snapshotRevision(autoKeyDispatchLive);
      const autoKeyAccepted = await coordinator.executePhysicalEdit({
        proposal: autoKeyProposal,
        expectedLaunch: { operationId: identity.launchOperationId, layerId: identity.layerId },
        operationKind: 'undo',
        selectedKeyId: command.before.selectedKeyId,
        selectedAppFrame: command.before.selectedAppFrame,
        replayTargetSnapshot: command.before,
        historyProvenance: {
          historyCommandId: command.operationId,
          historyDirection: 'undo',
          sourceRevision: autoKeyLiveRevision,
          targetRevision: autoKeyBeforeRevision,
        },
      });
      recordAquarelleRenderSplitEvent('undo-probe', { stage: 'auto-key-dispatch', accepted: autoKeyAccepted, sourceRevision: autoKeyLiveRevision });
      if (!autoKeyAccepted) {
        pendingReplayRef.current = null;
        if (recordedStroke && route !== undefined) {
          // The stroke half was a script replay, so only the inverse SCRIPT
          // replay can undo it: after the sheet reset the engine history is a
          // re-bake history and redoPaint() would be wrong (P1). The result is
          // intentionally not gating the return, mirroring the engine call.
          await route.replayStroke(entry.mutationId, 'redo');
        } else {
          inputRef.current.redoPaint();
        }
        publishAvailability();
        return false;
      }
      return true;
    }
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
  }, [flushPendingAutoKeyGroup, publishAvailability]);

  const redo = useCallback(async (): Promise<boolean> => {
    const coordinator = inputRef.current.coordinator;
    if (coordinator.pendingOperationId.value !== null) return false;
    flushPendingAutoKeyGroup();
    const entry = redoRef.current[redoRef.current.length - 1];
    if (!entry) return false;
    inputRef.current.stopPlayback?.();
    if (entry.kind === 'aquarelle-script') {
      // 261022-pim: symmetric with undo — replay 'redo' and move the stacks
      // only when the script swap + re-bake report success.
      const route = inputRef.current.aquarelleScriptHistory;
      if (!route) return false;
      const replayed = await route.replay(entry.editId, 'redo');
      if (!replayed) return false;
      const top = redoRef.current[redoRef.current.length - 1];
      if (top !== entry) return false;
      redoRef.current.pop();
      appliedRef.current.push(entry);
      publishAvailability();
      return true;
    }
    if (entry.kind === 'paint') {
      // 261029-lsr: symmetric with undo — a recorded stroke redoes through the
      // script (inverse snapshot swap + re-bake) and moves the stacks only on
      // true; an unrecorded stroke keeps the engine-only redo.
      const route = inputRef.current.aquarelleScriptHistory;
      if (route !== undefined && route.hasRecordedStroke(entry.mutationId)) {
        const replayed = await route.replayStroke(entry.mutationId, 'redo');
        if (!replayed) return false;
        const top = redoRef.current[redoRef.current.length - 1];
        if (top !== entry) return false;
        redoRef.current.pop();
        appliedRef.current.push(entry);
        publishAvailability();
        return true;
      }
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
    if (entry.kind === 'background') {
      // 49-06 UAT: redo re-applies the post-edit document by reference.
      // Symmetric live-state authority guard (CR-01, G-52-5): redo only when
      // the live document still matches the recorded `before` by content
      // revision (identity fast path) — an unrecorded CONTENT edit since the
      // undo would otherwise be clobbered. Fail closed on divergence.
      if (!liveDocumentMatchesRecorded(getDocument(entry.descriptor.before.parentLayerId), entry.descriptor.before)) return false;
      // 52 CR-01: symmetric runtime resync from the restored `after` document
      // (see the undo branch above).
      if (!resyncRuntimeForBackgroundEdit(entry.descriptor, 'redo')) return false;
      redoRef.current.pop();
      appliedRef.current.push(entry);
      registerDocument(entry.descriptor.after);
      publishAvailability();
      return true;
    }
    const identity = inputRef.current.identity;
    if (!identity) return false;
    if (entry.kind === 'auto-key-paint') {
      // D-14: redo replays the key FIRST, then restores the stroke. A rejected
      // key replay leaves both stacks untouched.
      const command = entry.command;
      // 261029-lsr (D-06): the stroke half resolves its own route — the
      // `aquarelle-script` branch's `const route` is block-scoped above.
      const route = inputRef.current.aquarelleScriptHistory;
      const recordedStroke = route !== undefined && route.hasRecordedStroke(entry.mutationId);
      const autoKeyLiveSnapshot = inputRef.current.getLiveSourceSnapshot;
      // Symmetric with the undo above: payload bytes drift with every live
      // capture, so only the structural identity gates the redo.
      if (typeof autoKeyLiveSnapshot !== 'function'
        || !snapshotReplayAuthorityEqual(autoKeyLiveSnapshot(), command.before, true)) return false;
      if (getActiveTrackId(identity.layerId) !== command.trackId) setActiveTrackId(identity.layerId, command.trackId);
      pendingReplayRef.current = { direction: 'redo', command };
      const autoKeyProposal = buildReplayProposal(command.after);
      const autoKeyAfterRevision = snapshotRevision(command.after);
      const autoKeyAccepted = await coordinator.executePhysicalEdit({
        proposal: autoKeyProposal,
        expectedLaunch: { operationId: identity.launchOperationId, layerId: identity.layerId },
        operationKind: 'redo',
        selectedKeyId: command.after.selectedKeyId,
        selectedAppFrame: command.after.selectedAppFrame,
        replayTargetSnapshot: command.after,
        historyProvenance: {
          historyCommandId: command.operationId,
          historyDirection: 'redo',
          sourceRevision: snapshotRevision(command.before),
          targetRevision: autoKeyAfterRevision,
        },
      });
      if (!autoKeyAccepted) {
        pendingReplayRef.current = null;
        return false;
      }
      if (recordedStroke && route !== undefined) {
        // The key replay succeeded; a refused stroke redo leaves both stacks
        // untouched (the next Cmd+Shift+Z retries the same recorded edit).
        const strokeRedone = await route.replayStroke(entry.mutationId, 'redo');
        if (!strokeRedone) {
          publishAvailability();
          return false;
        }
      } else {
        inputRef.current.redoPaint();
      }
      publishAvailability();
      return true;
    }
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
  }, [flushPendingAutoKeyGroup, publishAvailability]);

  return {
    clear,
    beginAutoKeyPaintGroup,
    cancelAutoKeyPaintGroup,
    observePaintMutation,
    recordAcceptedEdit,
    recordBackgroundEdit,
    recordAquarelleScriptEdit,
    reconcilePaintBarriers,
    undo,
    redo,
  };
}

// Re-export the snapshot type alias so callers can keep importing from
// the history module without learning the coordinator's internal type
// path.
export type { RotoPhysicalEditSnapshot, RotoPhysicalEditAcceptedOutput } from '../roto/rotoCoordinatorPorts';