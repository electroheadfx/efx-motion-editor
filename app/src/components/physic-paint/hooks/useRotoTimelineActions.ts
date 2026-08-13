import { useCallback, useMemo } from 'preact/hooks';
import { computed, signal, type ReadonlySignal } from '@preact/signals';
import type { PhysicPaintLaunchContext, PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings } from '../../../types/physicPaint';
import { getSourceRotoFrameForDisplayFrame } from '../roto/physicsPaintRotoWorkflow';
import {
  updateRotoInterpolationSettingsTransaction,
  type RotoSourceDisplayModel,
} from '../roto/physicsPaintRotoKeyController';
import type {
  PhysicPaintRotoInterpolationState,
  PhysicPaintRotoLoopClip,
  PhysicPaintRotoRealKeyPayload,
  PhysicPaintRotoRealKeyRecord,
} from '../roto/physicsPaintRotoPhysicalModel';
import {
  PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
  PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO,
  buildPhysicPaintRotoPhysicalRevision,
  createPhysicPaintRotoKeyId,
} from '../roto/physicsPaintRotoPhysicalModel';
import type { RotoPhysicalTimelineCell } from '../roto/rotoPhysicalTimelinePorts';
import {
  createPhysicPaintRotoDuplicateKeyIntent,
  createPhysicPaintRotoPasteKeyGroupIntent,
  createPhysicPaintRotoPasteKeyIntent,
  derivePhysicPaintRotoLoopRanges,
  resolvePhysicPaintRotoLoopFrame,
  resolvePhysicPaintRotoPhysicalEdit,
  type PhysicPaintRotoFrameResolution,
  type PhysicPaintRotoLinkedSourceSpacingScope,
  type PhysicPaintRotoPhysicalEditFailure,
  type PhysicPaintRotoPhysicalEditIntent,
  type PhysicPaintRotoPhysicalEditProposal,
  type PhysicPaintRotoPhysicalEditResolution,
  type PhysicPaintRotoPhysicalEditTarget,
} from '../roto/physicsPaintRotoPhysicalResolver';
import type { RotoSessionCopiedGroupEntry } from '../roto/physicsPaintRotoSession';
import { classifyPhysicPaintRotoGroupFrameTarget } from '../roto/physicsPaintRotoGroupLifecycle';
import { toEmptyKeyPayload } from './useRotoKeyUtilities';
import {
  getPhysicsPaintRotoSourceCycleId,
  type PhysicsPaintRotoSpacingSelection,
} from '../roto/physicsPaintRotoSpacingSelection';
import type {
  RotoPhysicalEditExecuteInput,
  RotoPhysicalKeyUtilityPort,
} from '../roto/rotoCoordinatorPorts';

/**
 * Stable physical timeline action bundle exposed by {@link useRotoTimelineActions}.
 *
 * Per D-01/D-05/D-06/D-09: one Preact-native bundle owns the semantic Insert
 * action (Delete follows in Task 2), direct pending/availability/status outputs,
 * and extension points for Plans 07-08 (Drag, Force Spacing). The resolver,
 * coordinator, and history remain private to this hook; Studio composes the
 * bundle once and passes it through to the workflow strip and keyboard
 * dispatcher.
 *
 * Availability is derived directly from current selected stable identity/
 * real-key status, launch readiness, and the coordinator's one pending
 * Signal/computed output — no copied hook state, no second busy mirror, no
 * effect-driven action synchronization.
 */
/**
 * Identity-based drag target for the single-key ripple Drag (D-07).
 *
 * Per D-23: empty and generated physical cells emit only `physical-cell`
 * whole-cell intents. Per D-07/D-21: occupied real-key cells emit only
 * `before-key` or `after-key` identity boundary intents. No view-side
 * destination frame calculation, no occupied-key overwrite.
 */
export type RotoDragTarget = PhysicPaintRotoPhysicalEditTarget;

export type RotoInsertTarget =
  | { readonly kind: 'occupied-real'; readonly keyId: string }
  | { readonly kind: 'genuinely-empty'; readonly appFrame: number }
  | { readonly kind: 'generated'; readonly appFrame: number }
  | { readonly kind: 'resolved-linked'; readonly appFrame: number }
  | { readonly kind: 'unresolved-linked'; readonly appFrame: number }
  | { readonly kind: 'occupied-empty-intent'; readonly appFrame: number }
  | { readonly kind: 'invalid-destination' }
  | { readonly kind: 'out-of-capacity'; readonly appFrame: number }
  | { readonly kind: 'edit-in-flight' };

export interface RotoInsertTargetClassificationInput {
  readonly launchReady: boolean;
  readonly pendingOperationId: string | null;
  readonly selectedKeyId: string | null;
  readonly currentAppFrame: number | null;
  readonly capacity: number | null;
  readonly records: readonly PhysicPaintRotoRealKeyRecord[];
  readonly physicalCells: readonly RotoPhysicalTimelineCell[];
  readonly frameResolution: PhysicPaintRotoFrameResolution | null;
}

export function classifyRotoInsertTarget(
  input: RotoInsertTargetClassificationInput,
): RotoInsertTarget {
  if (input.pendingOperationId !== null) return { kind: 'edit-in-flight' };
  if (!input.launchReady || input.currentAppFrame === null || !Number.isInteger(input.currentAppFrame) || input.currentAppFrame < 0) {
    return { kind: 'invalid-destination' };
  }
  if (input.capacity === null || !Number.isInteger(input.capacity) || input.currentAppFrame >= input.capacity) {
    return { kind: 'out-of-capacity', appFrame: input.currentAppFrame };
  }
  if (isBoundedKeyId(input.selectedKeyId)) {
    const selectedMatches = input.records.filter((record) => record.keyId === input.selectedKeyId);
    if (selectedMatches.length === 1) return { kind: 'occupied-real', keyId: input.selectedKeyId };
  }
  if (input.records.some((record) => record.appFrame === input.currentAppFrame)) {
    return { kind: 'occupied-empty-intent', appFrame: input.currentAppFrame };
  }
  if (input.frameResolution?.kind === 'linked-unresolved') {
    return { kind: 'unresolved-linked', appFrame: input.currentAppFrame };
  }
  if (input.frameResolution !== null && (
    input.frameResolution.kind === 'linked'
    || input.frameResolution.kind === 'linked-generated'
    || input.frameResolution.kind === 'linked-gap'
  )) {
    return { kind: 'resolved-linked', appFrame: input.currentAppFrame };
  }
  if (input.physicalCells[input.currentAppFrame]?.kind === 'generated') {
    return { kind: 'generated', appFrame: input.currentAppFrame };
  }
  return { kind: 'genuinely-empty', appFrame: input.currentAppFrame };
}

export function mapRotoInsertProductReason(target: RotoInsertTarget): string | null {
  switch (target.kind) {
    case 'occupied-real':
    case 'genuinely-empty':
      return null;
    case 'generated':
      return 'Insert is unavailable on a generated render-only frame.';
    case 'resolved-linked':
      return 'Insert is unavailable on a resolved linked frame.';
    case 'unresolved-linked':
      return 'Insert is unavailable on an unresolved linked frame.';
    case 'occupied-empty-intent':
      return 'This frame already contains a real key.';
    case 'invalid-destination':
      return 'Choose a valid timeline frame before inserting.';
    case 'out-of-capacity':
      return 'This frame is outside the physical timeline capacity.';
    case 'edit-in-flight':
      return 'A Roto physical edit is already in flight.';
  }
}

export interface RotoGroupLifecycleDeleteTarget {
  readonly groupId: string;
  readonly appFrame: number;
  readonly mode: PhysicPaintRotoLoopClip['mode'];
  readonly phaseOrigin: number;
  readonly onlyOccurrence: boolean;
}

export type RotoDeleteTarget =
  | Readonly<{ kind: 'ordinary-key'; keyId: string }>
  | Readonly<{ kind: 'ordinary-key-group'; keyIds: readonly string[] }>
  | Readonly<RotoGroupLifecycleDeleteTarget & { kind: 'group-frame' }>
  | Readonly<RotoGroupLifecycleDeleteTarget & { kind: 'group' }>
  | Readonly<{ kind: 'group-gap'; groupId: string; appFrame: number }>
  | Readonly<{ kind: 'unresolved-group'; groupId: string; appFrame: number }>
  | Readonly<{ kind: 'ambiguous-group'; appFrame: number }>
  | Readonly<{ kind: 'generated'; appFrame: number }>
  | Readonly<{ kind: 'no-target' }>
  | Readonly<{ kind: 'edit-in-flight' }>
  | Readonly<{ kind: 'unavailable' }>;

export interface RotoDeleteTargetClassificationInput {
  readonly launchReady: boolean;
  readonly pendingOperationId: string | null;
  readonly selectedKeyId: string | null;
  readonly selectedKeyIds: readonly string[];
  readonly selectedLoopClipIds: readonly string[];
  readonly currentAppFrame: number | null;
  readonly capacity: number | null;
  readonly records: readonly PhysicPaintRotoRealKeyRecord[];
  readonly loopClips: readonly PhysicPaintRotoLoopClip[];
  readonly interpolation: PhysicPaintRotoInterpolationState;
  readonly physicalCells: readonly RotoPhysicalTimelineCell[];
}

/**
 * One activation-time Delete authority shared by keyboard and visible actions.
 * Group ownership is classified from the complete accepted records/Group facts;
 * components only render the resulting choice and never infer ownership.
 */
export function classifyRotoDeleteTarget(
  input: RotoDeleteTargetClassificationInput,
): RotoDeleteTarget {
  if (input.pendingOperationId !== null) return Object.freeze({ kind: 'edit-in-flight' });
  if (!input.launchReady
    || input.currentAppFrame === null
    || !Number.isSafeInteger(input.currentAppFrame)
    || input.currentAppFrame < 0
    || input.capacity === null
    || !Number.isSafeInteger(input.capacity)
    || input.currentAppFrame >= input.capacity) {
    return Object.freeze({ kind: 'unavailable' });
  }

  if (input.selectedLoopClipIds.length > 0) {
    if (input.selectedLoopClipIds.length !== 1 || !isBoundedKeyId(input.selectedLoopClipIds[0])) {
      return Object.freeze({ kind: 'no-target' });
    }
    const groupId = input.selectedLoopClipIds[0];
    const group = input.loopClips.find((candidate) => candidate.loopId === groupId);
    if (group?.phaseOrigin === undefined || group.visibleRanges === undefined) {
      return Object.freeze({ kind: 'no-target' });
    }
    const visibleCount = group.visibleRanges.reduce(
      (count, range) => count + range.endExclusive - range.start,
      0,
    );
    return Object.freeze({
      kind: 'group',
      groupId,
      appFrame: group.phaseOrigin,
      mode: group.mode,
      phaseOrigin: group.phaseOrigin,
      onlyOccurrence: visibleCount === 1,
    });
  }

  if (input.selectedKeyIds.length >= 2) {
    const uniqueIds = new Set(input.selectedKeyIds);
    const recordsById = new Map(input.records.map((record) => [record.keyId, record]));
    if (uniqueIds.size === input.selectedKeyIds.length
      && input.selectedKeyIds.every((keyId) => isBoundedKeyId(keyId) && recordsById.has(keyId))) {
      return Object.freeze({
        kind: 'ordinary-key-group',
        keyIds: Object.freeze([...input.selectedKeyIds]),
      });
    }
    return Object.freeze({ kind: 'no-target' });
  }

  const frameTarget = classifyPhysicPaintRotoGroupFrameTarget({
    appFrame: input.currentAppFrame,
    document: {
      realKeyRecords: input.records,
      interpolation: input.interpolation,
      scriptMotion: PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO,
      capacity: input.capacity,
      background: null,
      selectedKeyId: input.selectedKeyId,
      cursorAppFrame: input.currentAppFrame,
      revision: '',
      loopClips: input.loopClips,
      incomingInterpolationBreakKeyIds: [],
    },
  });
  switch (frameTarget.kind) {
    case 'source-occurrence':
    case 'generated-occurrence':
    case 'override': {
      const group = input.loopClips.find((candidate) => candidate.loopId === frameTarget.groupId);
      if (group?.phaseOrigin === undefined || group.visibleRanges === undefined) {
        return Object.freeze({ kind: 'unresolved-group', groupId: frameTarget.groupId, appFrame: input.currentAppFrame });
      }
      const visibleCount = group.visibleRanges.reduce(
        (count, range) => count + range.endExclusive - range.start,
        0,
      );
      return Object.freeze({
        kind: 'group-frame',
        groupId: frameTarget.groupId,
        appFrame: input.currentAppFrame,
        mode: group.mode,
        phaseOrigin: group.phaseOrigin,
        onlyOccurrence: visibleCount === 1,
      });
    }
    case 'group-gap':
      return Object.freeze({ kind: 'group-gap', groupId: frameTarget.groupId, appFrame: input.currentAppFrame });
    case 'unresolved-group':
      return Object.freeze({ kind: 'unresolved-group', groupId: frameTarget.groupId, appFrame: input.currentAppFrame });
    case 'ambiguous-group':
      return Object.freeze({ kind: 'ambiguous-group', appFrame: input.currentAppFrame });
    case 'ordinary-key':
    case 'empty':
      break;
  }

  if (isBoundedKeyId(input.selectedKeyId)
    && input.records.filter((record) => record.keyId === input.selectedKeyId).length === 1) {
    return Object.freeze({ kind: 'ordinary-key', keyId: input.selectedKeyId });
  }
  if (input.physicalCells[input.currentAppFrame]?.kind === 'generated') {
    return Object.freeze({ kind: 'generated', appFrame: input.currentAppFrame });
  }
  return Object.freeze({ kind: 'no-target' });
}

export function mapRotoDeleteProductReason(target: RotoDeleteTarget): string | null {
  switch (target.kind) {
    case 'ordinary-key':
    case 'ordinary-key-group':
    case 'group-frame':
    case 'group':
      return null;
    case 'group-gap':
      return 'Delete is unavailable on an intentional Group gap.';
    case 'unresolved-group':
      return 'Delete is unavailable because this Group frame cannot be resolved.';
    case 'ambiguous-group':
      return 'Delete is unavailable because more than one Group owns this frame.';
    case 'generated':
      return 'Delete is unavailable on a generated render-only frame.';
    case 'no-target':
      return 'Select a real Roto key or Group frame to delete.';
    case 'edit-in-flight':
      return 'A Roto physical edit is already in flight.';
    case 'unavailable':
      return 'Select a Physics Paint Roto timeline before deleting.';
  }
}

/**
 * Deterministic signature of a Drag target, captured at preparation time and
 * re-checked at pointer-up so a different release target cannot commit an
 * unseen proposal (D-09).
 */
export interface RotoDragTargetSignature {
  readonly kind: 'physical-cell' | 'before-key' | 'after-key';
  readonly appFrame: number | null;
  readonly targetKeyId: string | null;
}

/**
 * Immutable versioned Drag publication (D-09/D-22). Carries the exact resolver
 * proposal, the authoritative proposalVersion derived from the physical
 * content revision plus launch/layer context at preparation time, the expected
 * launch tuple, the moved identity, and the deterministic target signature.
 *
 * The view retains this opaquely and submits it unchanged to
 * {@link RotoPhysicalTimelineActionBundle.commitRotoKeyDrag}. No cloning,
 * normalization, or recomputation is permitted.
 */
export interface RotoDragPublication {
  readonly proposal: PhysicPaintRotoPhysicalEditProposal;
  readonly intent: Extract<PhysicPaintRotoPhysicalEditIntent, { readonly kind: 'move-key' | 'move-key-group' }>;
  readonly proposalVersion: string;
  readonly expectedLaunch: { readonly operationId: string; readonly layerId: string };
  readonly movedKeyId: string;
  /**
   * Complete moved identity set (D-06/D-09). Present and frozen on group
   * publications; absent on single-key publications so existing consumers are
   * untouched.
   */
  readonly movedKeyIds?: readonly string[];
  readonly targetSignature: RotoDragTargetSignature;
}

/**
 * Preparation result. The failure branch carries no proposal; the success
 * branch carries one immutable publication. Group preparation failures also
 * carry the structured conflict frames (37-04 blocked-target preview) and the
 * full resolver failure text for release-time diagnostic routing (D-26).
 */
export type RotoDragPreparationResult =
  | { readonly ok: true; readonly publication: RotoDragPublication }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly conflictingAppFrames?: readonly number[];
      readonly detail?: string;
    };

/**
 * Immutable versioned Group-drag publication (GDRAG-07). Carries the exact
 * resolver proposal, the break-aware proposalVersion derived from the physical
 * content revision plus the incoming interpolation break collection and
 * launch/layer context at preparation time, the expected launch tuple, and the
 * moved Group identity.
 *
 * The view retains this opaquely and submits it unchanged to
 * {@link RotoPhysicalTimelineActionBundle.commitRotoGroupDrag}. No cloning,
 * normalization, or recomputation is permitted.
 */
export interface RotoGroupDragPublication {
  readonly proposal: PhysicPaintRotoPhysicalEditProposal;
  readonly intent: Extract<PhysicPaintRotoPhysicalEditIntent, { readonly kind: 'move-group' }>;
  readonly proposalVersion: string;
  readonly expectedLaunch: { readonly operationId: string; readonly layerId: string };
  readonly loopId: string;
}

/**
 * Group-drag preparation result. The failure branch carries no proposal; the
 * success branch carries one immutable publication.
 */
export type RotoGroupDragPreparationResult =
  | { readonly ok: true; readonly publication: RotoGroupDragPublication }
  | { readonly ok: false; readonly reason: string; readonly detail?: string };

export interface RotoPhysicalTimelineActionBundle {
  /** Insert one empty physical slot before the selected real key (D-05). */
  readonly insertRotoFrame: () => Promise<boolean>;
  /** Reactive Insert availability derived from selection + pending authority. */
  readonly canInsertFrame: ReadonlySignal<boolean>;
  /** Reactive Insert disabled reason, or null when eligible. */
  readonly insertDisabledReason: ReadonlySignal<string | null>;
  /** Contextual enabled Insert description; occupied behavior remains unchanged. */
  readonly insertTooltipDescription: ReadonlySignal<string>;
  /** Delete exactly the selected stable key and its slot (D-06). */
  readonly deleteRotoFrame: () => Promise<boolean>;
  /** Reactive Delete availability derived from selection + pending authority. */
  readonly canDeleteFrame: ReadonlySignal<boolean>;
  /** Reactive Delete disabled reason, or null when eligible. */
  readonly deleteDisabledReason: ReadonlySignal<string | null>;
  /** Reactive pending physical operation id, or null when idle. */
  readonly pendingOperationId: ReadonlySignal<string | null>;
  /**
   * Prepare one versioned Drag publication for the single-key ripple Drag
   * (D-07/D-09/D-22). Reads one coherent current physical snapshot, invokes
   * the pure resolver with a `move-key` intent plus the supplied target,
   * rejects failure/self-target/no-change/stale/malformed results, and
   * returns one immutable publication carrying the exact proposal plus
   * authoritative proposalVersion/expected launch tuple. The view retains
   * the publication opaquely and submits it unchanged to
   * {@link commitRotoKeyDrag}.
   */
  readonly prepareRotoKeyDrag: (movedKeyId: string, target: RotoDragTarget) => RotoDragPreparationResult;
  /**
   * Submit the exact retained Drag publication to the acknowledged physical
   * coordinator (D-09). Verifies wrapper coherence and passes the same
   * proposal object plus captured expected launch tuple to
   * `executePhysicalEdit` without resolver or mapping recomputation. The
   * coordinator performs the authoritative post-barrier revalidation.
   */
  readonly commitRotoKeyDrag: (publication: RotoDragPublication) => Promise<boolean>;
  /**
   * Prepare one versioned Drag publication for the group Drag (D-06..D-09).
   * Mirrors the single-key preparation guard order exactly, reads the
   * controller-supplied selection set through the `getSelectedKeyIds` input
   * port (fail-closed: at least two bounded unique members containing the
   * grabbed key), invokes the pure resolver with a `move-key-group` intent,
   * and returns one immutable publication carrying the exact proposal, the
   * frozen moved set, and the authoritative proposalVersion/expected launch
   * tuple. Failure results carry the concise UI-SPEC copy, the structured
   * `conflictingAppFrames`, and the full resolver failure text as `detail`;
   * prepare never publishes to the capsule during the gesture (release-time
   * publication is 37-04's gesture-timing responsibility). The view retains
   * the publication opaquely and submits it unchanged to
   * {@link commitRotoKeyGroupDrag}.
   */
  readonly prepareRotoKeyGroupDrag: (grabbedKeyId: string, target: RotoDragTarget) => RotoDragPreparationResult;
  /**
   * Submit the exact retained group Drag publication to the acknowledged
   * physical coordinator (D-09). Verifies wrapper coherence (operation kind,
   * grabbed-key match, moved-set shallow equality, non-empty launch tuple)
   * and passes the same proposal object plus captured expected launch tuple
   * to `executePhysicalEdit` without resolver or mapping recomputation. The
   * coordinator performs the authoritative post-barrier revalidation.
   */
  readonly commitRotoKeyGroupDrag: (publication: RotoDragPublication) => Promise<boolean>;
  /**
   * Prepare one versioned Group-drag publication for the rail drag (GDRAG-07).
   * Mirrors the single-key/group guard order exactly, reads one coherent
   * current physical snapshot, builds the 'move-group' intent, invokes the
   * pure resolver with the incoming interpolation break collection threaded
   * into BOTH the resolver input and a break-aware revision fingerprint
   * (Pitfall 1), rejects no-change results, and returns one immutable
   * publication carrying the exact proposal plus authoritative
   * proposalVersion/expected launch tuple. The view retains the publication
   * opaquely and submits it unchanged to {@link commitRotoGroupDrag}.
   */
  readonly prepareRotoGroupDrag: (loopId: string, destinationPlacementStart: number) => RotoGroupDragPreparationResult;
  /**
   * Submit the exact retained Group-drag publication to the acknowledged
   * physical coordinator (GDRAG-07). Verifies wrapper coherence (operation
   * kind, intent kind, loopId match, non-empty launch tuple) and passes the
   * same proposal object plus captured expected launch tuple to
   * `executePhysicalEdit` without resolver or mapping recomputation. The
   * coordinator performs the authoritative post-barrier revalidation.
   */
  readonly commitRotoGroupDrag: (publication: RotoGroupDragPublication) => Promise<boolean>;
  /** Reactive Drag availability derived from selection + pending authority. */
  readonly canDragKey: ReadonlySignal<boolean>;
  /** Reactive Drag disabled reason, or null when eligible. */
  readonly dragDisabledReason: ReadonlySignal<string | null>;
  /** Session-local raw Force Spacing input, initialized to `1`. */
  readonly forceSpacingInput: ReadonlySignal<string>;
  /** Store the exact raw Force Spacing input text without coercion. */
  readonly setForceSpacingInput: (value: string) => void;
  /** Apply canonical Force Spacing through the shared resolver/coordinator path. */
  readonly applyForceSpacing: () => Promise<boolean>;
  /** Reactive Force Spacing availability from launch/readiness/pending authority. */
  readonly canApplyForceSpacing: ReadonlySignal<boolean>;
  /** Reactive Force Spacing disabled reason, or null when eligible. */
  readonly forceSpacingDisabledReason: ReadonlySignal<string | null>;
  /** Reactive + Key availability: launch ready, idle, and the current frame unoccupied. */
  readonly canAddEmptyKey: ReadonlySignal<boolean>;
  /** Reactive + Key disabled reason, or null when eligible. */
  readonly addEmptyKeyDisabledReason: ReadonlySignal<string | null>;
  /** Reactive Select All availability derived from launch presence, idle pending state, and at least one real key record (D-03). */
  readonly canSelectAllKeys: ReadonlySignal<boolean>;
  /** Reactive Select All disabled reason (verbatim controller reason for the 37-04 guarded icon), or null when eligible. */
  readonly selectAllKeysDisabledReason: ReadonlySignal<string | null>;
}

export interface RotoTimelineActionsInput {
  getModel: () => RotoSourceDisplayModel;
  getStoreRealKeyFrames?: () => number[];
  getCurrentSettings?: () => PhysicPaintRotoInterpolationSettings;
  getStoreRotoFrames?: () => PhysicPaintRotoCacheFrame[];
  getFailureStatus?: () => string | null;
  setInterpolationSettings?: (settings: PhysicPaintRotoInterpolationSettings) => PhysicPaintRotoInterpolationSettings;
  /** Physical real-key records from the store (D-01/D-10). */
  getRotoKeyRecords?: () => readonly PhysicPaintRotoRealKeyRecord[];
  /** Canonical interpolation state from the store (D-02). */
  getRotoInterpolationState?: () => PhysicPaintRotoInterpolationState;
  /** Durable Loop Clip collection from the store (Phase 43, Q1). */
  getRotoLoopClips?: () => readonly PhysicPaintRotoLoopClip[];
  /** Current physical projection cells (D-10). */
  getPhysicalCells?: () => readonly RotoPhysicalTimelineCell[];
  /** Current canonical linked-frame resolution, when Loop Clips are present. */
  getFrameResolution?: (appFrame: number) => PhysicPaintRotoFrameResolution;
  /** Selected stable keyId (D-01). */
  getSelectedKeyId?: () => string | null;
  /**
   * Controller-owned session selection set (37-02; D-05). Read-only here:
   * the hook never derives selection from frames, never mutates the set, and
   * never persists it or sends it across the bridge.
   */
  getSelectedKeyIds?: () => readonly string[];
  /** Selected Loop Rail identities in canonical placement order. */
  getSelectedLoopClipIds?: () => readonly string[];
  /** Reconciled session-only exact Loop Clip source-position selection. */
  getRotoSpacingSelection?: () => PhysicsPaintRotoSpacingSelection | null;
  /** Current direct physical navigation frame. */
  getCurrentAppFrame?: () => number;
  /** Launch context identity at action time (D-09). */
  getLaunchContext?: () => PhysicPaintLaunchContext | null;
  /** Bounded physical frame capacity (D-01/D-02). */
  getCapacity?: () => number;
  /** Complete stable-key-owned incoming interpolation break collection. */
  getIncomingInterpolationBreakKeyIds?: () => readonly string[];
  /** Existing transparent blank-frame builder shared with + Key. */
  buildBlankRotoFrame?: (appFrame: number) => PhysicPaintRotoCacheFrame;
  /** Generic acknowledged coordinator execute seam (Plan 36.14-04). */
  executePhysicalEdit?: (input: RotoPhysicalEditExecuteInput<PhysicPaintRotoPhysicalEditProposal>) => Promise<boolean>;
  /** Coordinator pending operation id Signal (Plan 36.14-04). */
  pendingOperationId?: ReadonlySignal<string | null>;
  /** Direct acknowledged Group lifecycle Delete seam. */
  executeGroupLifecycleDelete?: (target: Readonly<Omit<RotoGroupLifecycleDeleteTarget, 'mode'> & {
    operationKind: 'delete-group-frame' | 'delete-group';
  }>) => Promise<boolean>;
  /** Focused warning request for deleting a Group's sole visible occurrence. */
  requestSoleOccurrenceDeleteWarning?: (target: Readonly<Omit<RotoGroupLifecycleDeleteTarget, 'mode'> & {
    operationKind: 'delete-group-frame';
  }>) => void;
  /** Concise status/LOG publisher for resolver failures. */
  publishStatus?: (message: string | null) => void;
  /**
   * D-26 detail leg: full resolver failure detail (code + text) routed to the
   * surviving diagnostic channel. The Studio wires this to the same console
   * diagnostic style as the coordinator's logDiagnostic.
   */
  publishDiagnostic?: (message: string) => void;
}

type PhysicalActionRunnerKind = Extract<
  PhysicPaintRotoPhysicalEditIntent['kind'],
  'insert-slot' | 'insert-empty-segment' | 'delete-key' | 'delete-key-group' | 'duplicate-key' | 'paste-key' | 'paste-key-group'
>;

type PhysicalActionRunnerInput = {
  [Kind in PhysicalActionRunnerKind]: {
    readonly intent: Extract<PhysicPaintRotoPhysicalEditIntent, { readonly kind: Kind }>;
    readonly operationKind: Kind;
    readonly requiredKeyId: string | null;
    readonly successMessage: string;
    /**
     * Optional failure-code → concise capsule copy mapping (UI-SPEC locked
     * lines). Absent: the resolver failure text publishes unchanged, preserving
     * byte-identical behavior for existing routes.
     */
    readonly rejectedCopy?: (failure: PhysicPaintRotoPhysicalEditFailure) => string;
  };
}[PhysicalActionRunnerKind];

function physicalActionAuthorization(input: PhysicalActionRunnerInput) {
  switch (input.operationKind) {
    case 'insert-slot':
      return { operationKind: input.operationKind, intent: input.intent };
    case 'insert-empty-segment':
      return { operationKind: input.operationKind, intent: input.intent };
    case 'delete-key':
      return { operationKind: input.operationKind, intent: input.intent };
    case 'delete-key-group':
      return { operationKind: input.operationKind, intent: input.intent };
    case 'duplicate-key':
      return { operationKind: input.operationKind, intent: input.intent };
    case 'paste-key':
      return { operationKind: input.operationKind, intent: input.intent };
    case 'paste-key-group':
      return { operationKind: input.operationKind, intent: input.intent };
  }
}

const INSERT_SUCCESS_MESSAGE = 'Inserted an empty Roto frame before the selected key.';
const DELETE_SUCCESS_MESSAGE = 'Deleted the selected Roto key.';
const GROUP_DELETE_SUCCESS_MESSAGE = 'Keys deleted';
const DUPLICATE_SUCCESS_MESSAGE = 'Duplicated the selected Roto key.';
const PASTE_SUCCESS_MESSAGE = 'Pasted the copied paint into the Roto timeline.';
const ADD_KEY_SUCCESS_MESSAGE = 'Added an empty Roto key.';
const INVALID_FORCE_SPACING_MESSAGE = 'Enter a whole number of empty frames (0 or more).';

interface ForceSpacingScopeSnapshot {
  readonly scopeKeyIds: readonly string[] | null;
  readonly linkedSourceSpacingScopes: readonly PhysicPaintRotoLinkedSourceSpacingScope[] | null;
}

type ForceSpacingScopeResult =
  | { readonly ok: true; readonly value: ForceSpacingScopeSnapshot }
  | { readonly ok: false; readonly message: string };

function sameOrderedIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((keyId, index) => keyId === right[index]);
}

function isBoundedSelectionId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256;
}

function freezeLinkedSpacingScope(
  sourceKeyIds: readonly string[],
  selectedSourceKeyIds: readonly string[],
): PhysicPaintRotoLinkedSourceSpacingScope {
  const frozenSourceKeyIds = Object.freeze([...sourceKeyIds]);
  return Object.freeze({
    sourceCycleId: getPhysicsPaintRotoSourceCycleId(frozenSourceKeyIds),
    sourceKeyIds: frozenSourceKeyIds,
    selectedSourceKeyIds: Object.freeze([...selectedSourceKeyIds]),
  });
}

function deriveForceSpacingScope(input: {
  readonly records: readonly PhysicPaintRotoRealKeyRecord[];
  readonly loopClips: readonly PhysicPaintRotoLoopClip[];
  readonly selectedLoopClipIds: readonly string[];
  readonly selectedKeyIds: readonly string[];
  readonly spacingSelection: PhysicsPaintRotoSpacingSelection | null;
}): ForceSpacingScopeResult {
  const currentKeyIds = new Set(input.records.map((record) => record.keyId));
  const orderedLoopClips = [...input.loopClips]
    .sort((left, right) => left.placementStart - right.placementStart || left.loopId.localeCompare(right.loopId));
  const currentCycle = (sourceKeyIds: readonly string[]) => sourceKeyIds.length >= 2
    && sourceKeyIds.every(isBoundedSelectionId)
    && new Set(sourceKeyIds).size === sourceKeyIds.length
    && sourceKeyIds.every((keyId) => currentKeyIds.has(keyId));

  if (input.selectedLoopClipIds.length > 0) {
    if (input.selectedKeyIds.length > 0 || input.spacingSelection !== null) {
      return { ok: false, message: 'Rail and physical Key Spacing selections conflict. Select the Loop Rails again.' };
    }
    if (!input.selectedLoopClipIds.every(isBoundedSelectionId)
      || new Set(input.selectedLoopClipIds).size !== input.selectedLoopClipIds.length) {
      return { ok: false, message: 'Loop Rail selection is stale. Select the Loop Rails again.' };
    }
    const selectedIdSet = new Set(input.selectedLoopClipIds);
    const selectedClips = orderedLoopClips.filter((loopClip) => selectedIdSet.has(loopClip.loopId));
    if (selectedClips.length !== input.selectedLoopClipIds.length
      || !sameOrderedIds(selectedClips.map((loopClip) => loopClip.loopId), input.selectedLoopClipIds)) {
      return { ok: false, message: 'Loop Rail selection is stale. Select the Loop Rails again.' };
    }
    const seenCycles = new Set<string>();
    const seenSourceKeyIds = new Set<string>();
    const scopes: PhysicPaintRotoLinkedSourceSpacingScope[] = [];
    for (const loopClip of selectedClips) {
      if (!currentCycle(loopClip.sourceKeyIds)) {
        return { ok: false, message: 'Loop Rail source authorization is stale. Select the Loop Rails again.' };
      }
      const sourceCycleId = getPhysicsPaintRotoSourceCycleId(loopClip.sourceKeyIds);
      if (seenCycles.has(sourceCycleId)) continue;
      if (loopClip.sourceKeyIds.some((keyId) => seenSourceKeyIds.has(keyId))) {
        return { ok: false, message: 'Loop Rail source authorization is ambiguous. Select the Loop Rails again.' };
      }
      seenCycles.add(sourceCycleId);
      loopClip.sourceKeyIds.forEach((keyId) => seenSourceKeyIds.add(keyId));
      scopes.push(freezeLinkedSpacingScope(loopClip.sourceKeyIds, loopClip.sourceKeyIds));
    }
    if (scopes.length === 0) {
      return { ok: false, message: 'Loop Rail selection is stale. Select the Loop Rails again.' };
    }
    return {
      ok: true,
      value: Object.freeze({
        scopeKeyIds: Object.freeze(scopes.flatMap((scope) => scope.selectedSourceKeyIds)),
        linkedSourceSpacingScopes: Object.freeze(scopes),
      }),
    };
  }

  if (!input.selectedKeyIds.every(isBoundedSelectionId)
    || new Set(input.selectedKeyIds).size !== input.selectedKeyIds.length
    || input.selectedKeyIds.some((keyId) => !currentKeyIds.has(keyId))) {
    return { ok: false, message: 'Physical Key Spacing selection is stale. Select the keys again.' };
  }

  if (input.spacingSelection !== null) {
    const selection = input.spacingSelection;
    if (selection.selectedSourceKeyIds.length < 2) {
      return { ok: false, message: 'Select at least two Loop Clip source positions to apply Key Spacing.' };
    }
    const selectedSet = new Set(selection.selectedSourceKeyIds);
    const orderedSelected = selection.sourceKeyIds.filter((keyId) => selectedSet.has(keyId));
    const exactCycleExists = orderedLoopClips.some((loopClip) => sameOrderedIds(loopClip.sourceKeyIds, selection.sourceKeyIds));
    if (!currentCycle(selection.sourceKeyIds)
      || selection.sourceCycleId !== getPhysicsPaintRotoSourceCycleId(selection.sourceKeyIds)
      || !exactCycleExists
      || selection.selectedSourceKeyIds.length < 2
      || selectedSet.size !== selection.selectedSourceKeyIds.length
      || !sameOrderedIds(orderedSelected, selection.selectedSourceKeyIds)
      || !sameOrderedIds(input.selectedKeyIds, selection.selectedSourceKeyIds)) {
      return { ok: false, message: 'Physical Key Spacing selection is stale. Select the keys again.' };
    }
    const scope = freezeLinkedSpacingScope(selection.sourceKeyIds, selection.selectedSourceKeyIds);
    return {
      ok: true,
      value: Object.freeze({
        scopeKeyIds: scope.selectedSourceKeyIds,
        linkedSourceSpacingScopes: Object.freeze([scope]),
      }),
    };
  }

  const selectedSet = new Set(input.selectedKeyIds);
  const matchingCycles = new Map<string, readonly string[]>();
  for (const loopClip of orderedLoopClips) {
    if (!currentCycle(loopClip.sourceKeyIds)) continue;
    if (!loopClip.sourceKeyIds.some((keyId) => selectedSet.has(keyId))) continue;
    matchingCycles.set(getPhysicsPaintRotoSourceCycleId(loopClip.sourceKeyIds), loopClip.sourceKeyIds);
  }
  if (matchingCycles.size > 1) {
    return { ok: false, message: 'Select Loop Rails to apply Key Spacing across multiple Loop Clips.' };
  }
  if (matchingCycles.size === 1) {
    if (input.selectedKeyIds.length < 2) {
      return { ok: false, message: 'Select at least two Loop Clip source positions to apply Key Spacing.' };
    }
    const sourceKeyIds = [...matchingCycles.values()][0];
    const orderedSelected = sourceKeyIds.filter((keyId) => selectedSet.has(keyId));
    if (orderedSelected.length !== input.selectedKeyIds.length
      || !sameOrderedIds(orderedSelected, input.selectedKeyIds)) {
      return { ok: false, message: 'Select only source positions from one Loop Clip cycle, or select Loop Rails.' };
    }
    const scope = freezeLinkedSpacingScope(sourceKeyIds, orderedSelected);
    return {
      ok: true,
      value: Object.freeze({
        scopeKeyIds: scope.selectedSourceKeyIds,
        linkedSourceSpacingScopes: Object.freeze([scope]),
      }),
    };
  }

  if (input.selectedKeyIds.length < 2 && orderedLoopClips.length > 0) {
    return { ok: false, message: 'Select at least two physical keys, or select Loop Rails for Loop Clip Key Spacing.' };
  }
  return {
    ok: true,
    value: Object.freeze({
      scopeKeyIds: input.selectedKeyIds.length >= 2 ? Object.freeze([...input.selectedKeyIds]) : null,
      linkedSourceSpacingScopes: null,
    }),
  };
}

export function useRotoTimelineActions(input: RotoTimelineActionsInput) {
  const forceSpacingInput = useMemo(() => signal('1'), []);

  const updateInterpolationSettings = useCallback((currentFrame: number, patch: Partial<PhysicPaintRotoInterpolationSettings>) => {
    const currentSettings = input.getCurrentSettings?.() ?? toPhysicPaintRotoInterpolationSettings(input.getModel().settings);
    const sourceFrameBeforeUpdate = getSourceRotoFrameForDisplayFrame(
      currentFrame,
      input.getStoreRealKeyFrames?.() ?? input.getModel().realSourceFrames,
      currentSettings,
      'existing-only',
    );
    const nextSettings = updateRotoInterpolationSettingsTransaction({
      currentFrame,
      currentSettings,
      patch,
      sourceFrameBeforeUpdate,
      storeRotoFrames: [],
      refreshedSettings: { ...currentSettings, ...patch, mode: 'duplicate' },
      failureStatus: null,
    }).settings;
    const refreshedSettings = input.setInterpolationSettings?.(nextSettings) ?? nextSettings;
    const storeRotoFrames = input.getStoreRotoFrames?.() ?? [];
    return updateRotoInterpolationSettingsTransaction({
      currentFrame,
      currentSettings,
      patch,
      sourceFrameBeforeUpdate,
      storeRotoFrames,
      refreshedSettings,
      failureStatus: input.getFailureStatus?.() ?? null,
    });
  }, [input]);

  // One computed target authority drives Insert eligibility, product reason,
  // contextual description, and activation reclassification without mirrored state.
  const insertTarget = computed(() => classifyRotoInsertTarget(readRotoInsertTargetInput(input)));
  const canInsertFrame = computed(() => mapRotoInsertProductReason(insertTarget.value) === null);
  const insertDisabledReason = computed(() => mapRotoInsertProductReason(insertTarget.value));
  const insertTooltipDescription = computed(() => insertTarget.value.kind === 'genuinely-empty'
    ? 'Insert an empty key and start a new interpolation segment.'
    : 'Insert key before');
  const deleteTarget = computed(() => classifyRotoDeleteTarget(readRotoDeleteTargetInput(input)));
  const canDeleteFrame = computed(() => mapRotoDeleteProductReason(deleteTarget.value) === null);
  const deleteDisabledReason = computed(() => mapRotoDeleteProductReason(deleteTarget.value));
  const canDragKey = computed(() => computeDragAvailability(input).eligible);
  const dragDisabledReason = computed(() => computeDragAvailability(input).reason);
  const canApplyForceSpacing = computed(() => computeForceSpacingAvailability(input).eligible);
  const forceSpacingDisabledReason = computed(() => computeForceSpacingAvailability(input).reason);
  const canAddEmptyKey = computed(() => computeAddEmptyKeyAvailability(input).eligible);
  const addEmptyKeyDisabledReason = computed(() => computeAddEmptyKeyAvailability(input).reason);
  const canSelectAllKeys = computed(() => computeSelectAllKeysAvailability(input).eligible);
  const selectAllKeysDisabledReason = computed(() => computeSelectAllKeysAvailability(input).reason);
  const pendingOperationIdSignal = input.pendingOperationId ?? signal<string | null>(null);

  const runPhysicalAction = useCallback(async (runnerInput: PhysicalActionRunnerInput): Promise<boolean> => {
    const launch = input.getLaunchContext?.() ?? null;
    if (!launch) {
      input.publishStatus?.('Select a real Roto key before editing the timeline.');
      return false;
    }
    if (!input.executePhysicalEdit || !input.getRotoKeyRecords || !input.getRotoInterpolationState || !input.getCapacity) {
      input.publishStatus?.('Timeline editing is unavailable.');
      return false;
    }
    if (input.pendingOperationId && input.pendingOperationId.value !== null) {
      input.publishStatus?.('A Roto physical edit is already in flight.');
      return false;
    }
    const records = input.getRotoKeyRecords();
    const interpolation = input.getRotoInterpolationState();
    const capacity = input.getCapacity();
    if (
      runnerInput.requiredKeyId !== null
      && records.filter((record) => record.keyId === runnerInput.requiredKeyId).length !== 1
    ) {
      input.publishStatus?.('The selected Roto key is no longer available.');
      return false;
    }
    const identities = records.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame }));
    const resolution: PhysicPaintRotoPhysicalEditResolution = resolvePhysicPaintRotoPhysicalEdit({
      identities,
      records,
      intent: runnerInput.intent,
      capacity,
      interpolationEnabled: interpolation.enabled,
      // Phase 43: loop-aware guards (D-07 source-key deletion) consult the
      // durable Loop Clip collection; absent port = pre-43 empty collection.
      loopClips: input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
      incomingInterpolationBreakKeyIds: input.getIncomingInterpolationBreakKeyIds?.() ?? [],
    });
    if (!resolution.ok) {
      input.publishStatus?.(runnerInput.rejectedCopy?.(resolution.failure) ?? (resolution.failure.text || 'The Roto timeline edit is invalid.'));
      if (
        runnerInput.operationKind === 'delete-key-group'
        || runnerInput.operationKind === 'paste-key-group'
        || runnerInput.operationKind === 'insert-empty-segment'
      ) {
        input.publishDiagnostic?.(runnerInput.operationKind + ' rejected: ' + resolution.failure.code + ' — ' + resolution.failure.text);
      }
      return false;
    }
    const proposal = resolution.proposal;
    const accepted = await input.executePhysicalEdit({
      proposal,
      expectedLaunch: { operationId: launch.operationId, layerId: launch.layerId },
      ...physicalActionAuthorization(runnerInput),
      selectedKeyId: proposal.selectedKeyId,
      selectedAppFrame: proposal.selectedAppFrame,
    });
    if (accepted) {
      input.publishStatus?.(runnerInput.successMessage);
    }
    return accepted;
  }, [input]);

  const insertRotoFrame = useCallback((): Promise<boolean> => {
    const target = classifyRotoInsertTarget(readRotoInsertTargetInput(input));
    const rejection = mapRotoInsertProductReason(target);
    if (rejection !== null) {
      input.publishStatus?.(rejection);
      return Promise.resolve(false);
    }
    if (target.kind === 'occupied-real') {
      return runPhysicalAction({
        intent: { kind: 'insert-slot', selectedKeyId: target.keyId },
        operationKind: 'insert-slot',
        requiredKeyId: target.keyId,
        successMessage: INSERT_SUCCESS_MESSAGE,
      });
    }
    if (target.kind !== 'genuinely-empty' || !input.buildBlankRotoFrame) {
      input.publishStatus?.('Choose a valid timeline frame before inserting.');
      return Promise.resolve(false);
    }
    const insertedKeyId = createPhysicPaintRotoKeyId();
    return runPhysicalAction({
      intent: {
        kind: 'insert-empty-segment',
        destinationAppFrame: target.appFrame,
        insertedKeyId,
        blankPayload: toEmptyKeyPayload(input.buildBlankRotoFrame(target.appFrame), target.appFrame),
      },
      operationKind: 'insert-empty-segment',
      requiredKeyId: null,
      successMessage: `Inserted empty key at frame ${target.appFrame}. New interpolation segment started.`,
      rejectedCopy: (failure) => mapRotoInsertProductReason(mapRotoInsertFailureTarget(failure, input))
        ?? 'Choose a valid timeline frame before inserting.',
    });
  }, [runPhysicalAction, input]);

  const deleteRotoFrame = useCallback((): Promise<boolean> => {
    // Keyboard Delete/Backspace and the visible Delete icon converge here. Read
    // and classify one current accepted snapshot per activation; never trust a
    // previously rendered availability result for ownership.
    const target = classifyRotoDeleteTarget(readRotoDeleteTargetInput(input));
    const rejection = mapRotoDeleteProductReason(target);
    if (rejection !== null) {
      input.publishStatus?.(rejection);
      return Promise.resolve(false);
    }
    if (target.kind === 'group-frame' || target.kind === 'group') {
      if (target.kind === 'group-frame' && target.onlyOccurrence) {
        if (!input.requestSoleOccurrenceDeleteWarning) {
          input.publishStatus?.('Delete Frame confirmation is unavailable.');
          return Promise.resolve(false);
        }
        input.requestSoleOccurrenceDeleteWarning(Object.freeze({
          operationKind: 'delete-group-frame',
          groupId: target.groupId,
          appFrame: target.appFrame,
          phaseOrigin: target.phaseOrigin,
          onlyOccurrence: true,
        }));
        return Promise.resolve(false);
      }
      if (!input.executeGroupLifecycleDelete) {
        input.publishStatus?.('Group deletion is unavailable.');
        return Promise.resolve(false);
      }
      return input.executeGroupLifecycleDelete(Object.freeze({
        operationKind: target.kind === 'group' ? 'delete-group' : 'delete-group-frame',
        groupId: target.groupId,
        appFrame: target.appFrame,
        phaseOrigin: target.phaseOrigin,
        onlyOccurrence: target.onlyOccurrence,
      }));
    }
    if (target.kind === 'ordinary-key-group') {
      return runPhysicalAction({
        intent: { kind: 'delete-key-group', keyIds: target.keyIds },
        operationKind: 'delete-key-group',
        requiredKeyId: null,
        successMessage: GROUP_DELETE_SUCCESS_MESSAGE,
      });
    }
    if (target.kind === 'ordinary-key') {
      return runPhysicalAction({
        intent: { kind: 'delete-key', selectedKeyId: target.keyId },
        operationKind: 'delete-key',
        requiredKeyId: target.keyId,
        successMessage: DELETE_SUCCESS_MESSAGE,
      });
    }
    return Promise.resolve(false);
  }, [runPhysicalAction, input]);

  const duplicateKey = useCallback((sourceKeyId: string): Promise<boolean> => {
    if (!isBoundedKeyId(sourceKeyId)) {
      input.publishStatus?.('The selected Roto key identity is malformed.');
      return Promise.resolve(false);
    }
    return runPhysicalAction({
      intent: createPhysicPaintRotoDuplicateKeyIntent(sourceKeyId),
      operationKind: 'duplicate-key',
      requiredKeyId: sourceKeyId,
      successMessage: DUPLICATE_SUCCESS_MESSAGE,
    });
  }, [input, runPhysicalAction]);

  const pasteKey = useCallback((
    destinationAppFrame: number,
    clipboardPayload: PhysicPaintRotoRealKeyPayload,
    destinationKeyId: string | null,
  ): Promise<boolean> => {
    if (!Number.isInteger(destinationAppFrame) || destinationAppFrame < 0) {
      input.publishStatus?.('Select a valid Roto frame before pasting.');
      return Promise.resolve(false);
    }
    if (destinationKeyId !== null && !isBoundedKeyId(destinationKeyId)) {
      input.publishStatus?.('The destination Roto key identity is malformed.');
      return Promise.resolve(false);
    }
    try {
      return runPhysicalAction({
        intent: createPhysicPaintRotoPasteKeyIntent(
          destinationAppFrame,
          clipboardPayload,
          destinationKeyId,
        ),
        operationKind: 'paste-key',
        requiredKeyId: destinationKeyId,
        successMessage: PASTE_SUCCESS_MESSAGE,
      });
    } catch {
      input.publishStatus?.('The copied Roto paint is unavailable.');
      return Promise.resolve(false);
    }
  }, [input, runPhysicalAction]);

  const pasteKeyGroup = useCallback((
    destinationAppFrame: number,
    entries: readonly RotoSessionCopiedGroupEntry[],
  ): Promise<boolean> => {
    if (!Number.isInteger(destinationAppFrame) || destinationAppFrame < 0) {
      input.publishStatus?.('Select a valid Roto frame before pasting.');
      return Promise.resolve(false);
    }
    let intent: Extract<PhysicPaintRotoPhysicalEditIntent, { kind: 'paste-key-group' }>;
    try {
      // The factory is the fail-closed gate: it throws on fewer than two
      // entries or malformed entry fields (T-38-01).
      intent = createPhysicPaintRotoPasteKeyGroupIntent(destinationAppFrame, entries);
    } catch {
      input.publishStatus?.('The copied Roto key group is unavailable.');
      return Promise.resolve(false);
    }
    // Busy line shows only while the acknowledged transaction is pending; the
    // success or reject line always overwrites it (UI-SPEC locked).
    input.publishStatus?.('Pasting keys…');
    return runPhysicalAction({
      intent,
      operationKind: 'paste-key-group',
      // requiredKeyId is null per the delete-key-group precedent: the resolver
      // is the destination-occupancy authority — every computed destination
      // must be empty, so no existing keyId is required.
      requiredKeyId: null,
      successMessage: `Pasted ${entries.length} keys`,
      rejectedCopy: (failure) => failure.code === 'duplicate-destination-frame'
        ? 'Paste rejected — key in the way'
        : failure.code === 'over-capacity' || failure.code === 'out-of-range-frame'
          ? 'Paste rejected — not enough room'
          : failure.text || 'The Roto key group paste is invalid.',
    });
  }, [input, runPhysicalAction]);

  const addEmptyKey = useCallback((
    destinationAppFrame: number,
    emptyPayload: PhysicPaintRotoRealKeyPayload,
  ): Promise<boolean> => {
    if (!Number.isInteger(destinationAppFrame) || destinationAppFrame < 0) {
      input.publishStatus?.('Select a valid Roto frame before adding a key.');
      return Promise.resolve(false);
    }
    try {
      // + Key promotion reuses the paste-to-empty physical edit machinery with
      // an empty payload — the same path the script-target promotion uses — so
      // the resolver, coordinator, settlement, and history stay unchanged.
      return runPhysicalAction({
        intent: createPhysicPaintRotoPasteKeyIntent(destinationAppFrame, emptyPayload, null),
        operationKind: 'paste-key',
        requiredKeyId: null,
        successMessage: ADD_KEY_SUCCESS_MESSAGE,
      });
    } catch {
      input.publishStatus?.('The empty Roto key payload is unavailable.');
      return Promise.resolve(false);
    }
  }, [input, runPhysicalAction]);

  const prepareRotoKeyDrag = useCallback((movedKeyId: string, target: RotoDragTarget): RotoDragPreparationResult => {    const launch = input.getLaunchContext?.() ?? null;
    if (!launch) {
      return { ok: false, reason: 'Select a real Roto key before editing the timeline.' };
    }
    if (!input.executePhysicalEdit || !input.getRotoKeyRecords || !input.getRotoInterpolationState || !input.getCapacity) {
      return { ok: false, reason: 'Timeline editing is unavailable.' };
    }
    if (input.pendingOperationId && input.pendingOperationId.value !== null) {
      return { ok: false, reason: 'A Roto physical edit is already in flight.' };
    }
    if (!isBoundedKeyId(movedKeyId)) {
      return { ok: false, reason: 'The dragged Roto key identity is malformed.' };
    }
    const records = input.getRotoKeyRecords();
    const interpolation = input.getRotoInterpolationState();
    const capacity = input.getCapacity();
    const movedMatches = records.filter((record) => record.keyId === movedKeyId);
    if (movedMatches.length === 0) {
      return { ok: false, reason: 'The dragged Roto key is no longer available.' };
    }
    if (movedMatches.length > 1) {
      return { ok: false, reason: 'The dragged Roto key identity is ambiguous.' };
    }
    const identities = records.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame }));
    const intent = Object.freeze({ kind: 'move-key', movedKeyId, target }) as Extract<PhysicPaintRotoPhysicalEditIntent, { kind: 'move-key' }>;
    const resolution: PhysicPaintRotoPhysicalEditResolution = resolvePhysicPaintRotoPhysicalEdit({
      identities,
      intent,
      capacity,
      interpolationEnabled: interpolation.enabled,
      // Phase 43: D-11 rejects single-key ripple drags on linked source keys.
      loopClips: input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
    });
    if (!resolution.ok) {
      return { ok: false, reason: resolution.failure.text || 'The Roto key move is invalid.' };
    }
    const proposal = resolution.proposal;
    if (!proposal.status.changed) {
      // Valid no-change: never publish as a Drag preview or commit (D-09).
      return { ok: false, reason: 'This move would not change the timeline.' };
    }
    const targetSignature = targetSignatureOf(target);
    const proposalVersion = buildProposalVersion(records, interpolation, input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY, launch);
    return {
      ok: true,
      publication: Object.freeze({
        proposal,
        intent,
        proposalVersion,
        expectedLaunch: { operationId: launch.operationId, layerId: launch.layerId },
        movedKeyId,
        targetSignature,
      }) as RotoDragPublication,
    };
  }, [input]);

  const commitRotoKeyDrag = useCallback(async (publication: RotoDragPublication): Promise<boolean> => {
    if (!input.executePhysicalEdit) return false;
    // Wrapper coherence: the proposal must be a move-key whose drag movedKeyId
    // matches the publication's movedKeyId. No resolver or mapping recomputation.
    if (publication.proposal.status.operationKind !== 'move-key' || publication.intent.kind !== 'move-key') return false;
    const drag = publication.proposal.drag;
    if (!drag || drag.movedKeyId !== publication.movedKeyId || publication.intent.movedKeyId !== publication.movedKeyId) return false;
    if (publication.expectedLaunch.operationId.length === 0 || publication.expectedLaunch.layerId.length === 0) return false;
    return input.executePhysicalEdit({
      proposal: publication.proposal,
      expectedLaunch: publication.expectedLaunch,
      operationKind: 'move-key',
      intent: publication.intent,
      selectedKeyId: publication.proposal.selectedKeyId,
      selectedAppFrame: publication.proposal.selectedAppFrame,
    });
  }, [input]);

  const prepareRotoKeyGroupDrag = useCallback((grabbedKeyId: string, target: RotoDragTarget): RotoDragPreparationResult => {
    const launch = input.getLaunchContext?.() ?? null;
    if (!launch) {
      return { ok: false, reason: 'Select a real Roto key before editing the timeline.' };
    }
    if (!input.executePhysicalEdit || !input.getRotoKeyRecords || !input.getRotoInterpolationState || !input.getCapacity) {
      return { ok: false, reason: 'Timeline editing is unavailable.' };
    }
    if (input.pendingOperationId && input.pendingOperationId.value !== null) {
      return { ok: false, reason: 'A Roto physical edit is already in flight.' };
    }
    if (!isBoundedKeyId(grabbedKeyId)) {
      return { ok: false, reason: 'The dragged Roto key identity is malformed.' };
    }
    // Fail-closed selection-set validation (T-37-03-01): the controller port
    // is the only selection source; the strip routes single-key grabs to
    // prepareRotoKeyDrag, so this guard is defense-in-depth — the resolver
    // remains the membership authority.
    const selectedKeyIds = input.getSelectedKeyIds?.() ?? [];
    const seenKeyIds = new Set<string>();
    let selectionSetValid = selectedKeyIds.length >= 2 && selectedKeyIds.includes(grabbedKeyId);
    if (selectionSetValid) {
      for (const keyId of selectedKeyIds) {
        if (!isBoundedKeyId(keyId) || seenKeyIds.has(keyId)) {
          selectionSetValid = false;
          break;
        }
        seenKeyIds.add(keyId);
      }
    }
    if (!selectionSetValid) {
      return { ok: false, reason: 'Select at least two real Roto keys to move as a group.' };
    }
    const records = input.getRotoKeyRecords();
    const interpolation = input.getRotoInterpolationState();
    const capacity = input.getCapacity();
    const movedMatches = records.filter((record) => record.keyId === grabbedKeyId);
    if (movedMatches.length === 0) {
      return { ok: false, reason: 'The dragged Roto key is no longer available.' };
    }
    if (movedMatches.length > 1) {
      return { ok: false, reason: 'The dragged Roto key identity is ambiguous.' };
    }
    const movedKeyIds = Object.freeze([...selectedKeyIds]) as readonly string[];
    const identities = records.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame }));
    const intent = Object.freeze({
      kind: 'move-key-group',
      movedKeyIds,
      grabbedKeyId,
      target,
    }) as Extract<PhysicPaintRotoPhysicalEditIntent, { kind: 'move-key-group' }>;
    const resolution: PhysicPaintRotoPhysicalEditResolution = resolvePhysicPaintRotoPhysicalEdit({
      identities,
      intent,
      capacity,
      interpolationEnabled: interpolation.enabled,
      // Phase 43: rigid whole-cycle drags carry the original-loop
      // placementStart follow on the proposal (D-04).
      loopClips: input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
    });
    if (!resolution.ok) {
      // Concise UI-SPEC copy plus structured conflicts and full detail; the
      // capsule is NOT published here — during-gesture hovers re-run prepare,
      // and release-reject publication is 37-04's gesture-timing contract.
      const failureCode = resolution.failure.code;
      const reason = failureCode === 'duplicate-destination-frame'
        ? 'Move rejected — key in the way'
        : failureCode === 'over-capacity' || failureCode === 'out-of-range-frame'
          ? 'Move rejected — not enough room'
          : resolution.failure.text || 'The Roto key group move is invalid.';
      return {
        ok: false,
        reason,
        conflictingAppFrames: resolution.failure.conflictingAppFrames,
        detail: resolution.failure.text,
      };
    }
    const proposal = resolution.proposal;
    if (!proposal.status.changed) {
      // Valid no-change: never publish as a Drag preview or commit (D-09).
      return { ok: false, reason: 'This move would not change the timeline.' };
    }
    const targetSignature = targetSignatureOf(target);
    const proposalVersion = buildProposalVersion(records, interpolation, input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY, launch);
    return {
      ok: true,
      publication: Object.freeze({
        proposal,
        intent,
        proposalVersion,
        expectedLaunch: { operationId: launch.operationId, layerId: launch.layerId },
        movedKeyId: grabbedKeyId,
        movedKeyIds,
        targetSignature,
      }) as RotoDragPublication,
    };
  }, [input]);

  const commitRotoKeyGroupDrag = useCallback(async (publication: RotoDragPublication): Promise<boolean> => {
    if (!input.executePhysicalEdit) return false;
    // Wrapper coherence (T-37-03-02): operation kind, grabbed-key match,
    // moved-set shallow equality (length plus index-wise identity), and a
    // non-empty launch tuple. No resolver or mapping recomputation — the
    // exact retained objects pass through (D-09).
    const intent = publication.intent;
    if (publication.proposal.status.operationKind !== 'move-key-group' || intent.kind !== 'move-key-group') return false;
    const drag = publication.proposal.drag;
    if (!drag || drag.movedKeyId !== publication.movedKeyId) return false;
    const movedKeyIds = publication.movedKeyIds;
    if (
      !movedKeyIds
      || movedKeyIds.length !== drag.movedKeyIds.length
      || movedKeyIds.length !== intent.movedKeyIds.length
      || movedKeyIds.some((keyId, index) => keyId !== drag.movedKeyIds[index])
      || movedKeyIds.some((keyId, index) => keyId !== intent.movedKeyIds[index])
      || intent.grabbedKeyId !== publication.movedKeyId
    ) return false;
    if (publication.expectedLaunch.operationId.length === 0 || publication.expectedLaunch.layerId.length === 0) return false;
    return input.executePhysicalEdit({
      proposal: publication.proposal,
      expectedLaunch: publication.expectedLaunch,
      operationKind: 'move-key-group',
      intent,
      selectedKeyId: publication.proposal.selectedKeyId,
      selectedAppFrame: publication.proposal.selectedAppFrame,
    });
  }, [input]);

  const prepareRotoGroupDrag = useCallback((loopId: string, destinationPlacementStart: number): RotoGroupDragPreparationResult => {
    const launch = input.getLaunchContext?.() ?? null;
    if (!launch) {
      return { ok: false, reason: 'Select a real Roto key before editing the timeline.' };
    }
    if (!input.executePhysicalEdit || !input.getRotoKeyRecords || !input.getRotoInterpolationState || !input.getCapacity) {
      return { ok: false, reason: 'Timeline editing is unavailable.' };
    }
    if (input.pendingOperationId && input.pendingOperationId.value !== null) {
      return { ok: false, reason: 'A Roto physical edit is already in flight.' };
    }
    if (!isBoundedKeyId(loopId)) {
      return { ok: false, reason: 'The dragged Group identity is malformed.' };
    }
    const records = input.getRotoKeyRecords();
    const interpolation = input.getRotoInterpolationState();
    const capacity = input.getCapacity();
    const loopClips = input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY;
    const incomingInterpolationBreakKeyIds = input.getIncomingInterpolationBreakKeyIds?.() ?? [];
    const identities = records.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame }));
    const intent = Object.freeze({
      kind: 'move-group',
      loopId,
      destinationPlacementStart,
    }) as Extract<PhysicPaintRotoPhysicalEditIntent, { kind: 'move-group' }>;
    const resolution: PhysicPaintRotoPhysicalEditResolution = resolvePhysicPaintRotoPhysicalEdit({
      identities,
      intent,
      capacity,
      interpolationEnabled: interpolation.enabled,
      loopClips,
      // GDRAG-07 / Pitfall 1: the incoming break collection reaches BOTH the
      // resolver input and the break-aware revision fingerprint below.
      incomingInterpolationBreakKeyIds,
    });
    if (!resolution.ok) {
      return { ok: false, reason: resolution.failure.text || 'The Group move is invalid.', detail: resolution.failure.text };
    }
    const proposal = resolution.proposal;
    if (!proposal.status.changed) {
      // Valid no-change: never publish as a Drag preview or commit (D-09).
      return { ok: false, reason: 'This move would not change the timeline.' };
    }
    const proposalVersion = buildGroupDragProposalVersion(records, interpolation, loopClips, incomingInterpolationBreakKeyIds, launch);
    return {
      ok: true,
      publication: Object.freeze({
        proposal,
        intent,
        proposalVersion,
        expectedLaunch: { operationId: launch.operationId, layerId: launch.layerId },
        loopId,
      }) as RotoGroupDragPublication,
    };
  }, [input]);

  const commitRotoGroupDrag = useCallback(async (publication: RotoGroupDragPublication): Promise<boolean> => {
    if (!input.executePhysicalEdit) return false;
    // Wrapper coherence (GDRAG-07): operation kind, intent kind, loopId match,
    // and a non-empty launch tuple. No resolver or mapping recomputation — the
    // exact retained objects pass through (D-09).
    const intent = publication.intent;
    if (publication.proposal.status.operationKind !== 'move-group' || intent.kind !== 'move-group') return false;
    if (intent.loopId !== publication.loopId) return false;
    if (publication.expectedLaunch.operationId.length === 0 || publication.expectedLaunch.layerId.length === 0) return false;
    return input.executePhysicalEdit({
      proposal: publication.proposal,
      expectedLaunch: publication.expectedLaunch,
      operationKind: 'move-group',
      intent,
      selectedKeyId: publication.proposal.selectedKeyId,
      selectedAppFrame: publication.proposal.selectedAppFrame,
    });
  }, [input]);

  const setForceSpacingInput = useCallback((value: string) => {
    forceSpacingInput.value = value;
  }, [forceSpacingInput]);

  const applyForceSpacing = useCallback(async (): Promise<boolean> => {
    const emptyFrames = parseCanonicalForceSpacing(forceSpacingInput.value);
    if (emptyFrames === null) {
      input.publishStatus?.(INVALID_FORCE_SPACING_MESSAGE);
      return false;
    }
    const launch = input.getLaunchContext?.() ?? null;
    if (!launch) {
      input.publishStatus?.('Select a Physics Paint Roto timeline before applying Force Spacing.');
      return false;
    }
    if (!input.executePhysicalEdit || !input.getRotoKeyRecords || !input.getRotoInterpolationState || !input.getCapacity) {
      input.publishStatus?.('Timeline editing is unavailable.');
      return false;
    }
    if (input.pendingOperationId && input.pendingOperationId.value !== null) {
      input.publishStatus?.('A Roto physical edit is already in flight.');
      return false;
    }

    // Capture one action-time snapshot. The resolver alone validates identity
    // completeness/uniqueness, orders stable keys, anchors the first frame,
    // derives exact interiors, and rejects an over-capacity complete map.
    const records = input.getRotoKeyRecords();
    const loopClips = input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY;
    const selectedKeyId = input.getSelectedKeyId?.() ?? null;
    const scopeResult = deriveForceSpacingScope({
      records,
      loopClips,
      selectedLoopClipIds: input.getSelectedLoopClipIds?.() ?? [],
      selectedKeyIds: input.getSelectedKeyIds?.() ?? [],
      spacingSelection: input.getRotoSpacingSelection?.() ?? null,
    });
    if (!scopeResult.ok) {
      input.publishStatus?.(scopeResult.message);
      return false;
    }
    const { scopeKeyIds, linkedSourceSpacingScopes } = scopeResult.value;
    const interpolation = input.getRotoInterpolationState();
    const capacity = input.getCapacity();
    const expectedLaunch = {
      operationId: launch.operationId,
      layerId: launch.layerId,
    } as const;
    const identities = records.map((record) => ({
      keyId: record.keyId,
      appFrame: record.appFrame,
    }));
    const intent = Object.freeze({
      kind: 'force-spacing',
      emptyFrames,
      selectedKeyId,
      scopeKeyIds,
      linkedSourceSpacingScopes,
    }) as Extract<PhysicPaintRotoPhysicalEditIntent, { kind: 'force-spacing' }>;
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities,
      intent,
      capacity,
      interpolationEnabled: interpolation.enabled,
      loopClips,
    });
    if (!resolution.ok) {
      if (scopeKeyIds !== null) {
        const failureCode = resolution.failure.code;
        input.publishStatus?.(
          failureCode === 'duplicate-destination-frame' || failureCode === 'over-capacity'
            ? 'Spacing rejected — not enough room'
            : resolution.failure.text || 'Force Spacing is invalid.',
        );
        input.publishDiagnostic?.('force-spacing rejected: ' + failureCode + ' — ' + resolution.failure.text);
      } else {
        input.publishStatus?.(resolution.failure.text || 'Force Spacing is invalid.');
      }
      return false;
    }
    const proposal = resolution.proposal;
    if (!proposal.status.changed) {
      // Zero-key failures are handled above; one key and already-exact spacing
      // end here without coordinator execution or accepted-history output.
      input.publishStatus?.(proposal.status.text);
      return false;
    }

    // Submit the exact resolver-owned proposal. The generic coordinator owns
    // post-barrier revision validation, staging, settlement, rollback, and the
    // accepted-only history handoff; this action does not recompute the map.
    const accepted = await input.executePhysicalEdit({
      proposal,
      expectedLaunch,
      operationKind: 'force-spacing',
      intent,
      selectedKeyId: proposal.selectedKeyId,
      selectedAppFrame: proposal.selectedAppFrame,
    });
    if (accepted) input.publishStatus?.(proposal.status.text);
    return accepted;
  }, [forceSpacingInput, input]);

  const physicalActions: RotoPhysicalTimelineActionBundle = useMemo(() => ({
    insertRotoFrame,
    canInsertFrame,
    insertDisabledReason,
    insertTooltipDescription,
    deleteRotoFrame,
    canDeleteFrame,
    deleteDisabledReason,
    pendingOperationId: pendingOperationIdSignal,
    prepareRotoKeyDrag,
    commitRotoKeyDrag,
    prepareRotoKeyGroupDrag,
    commitRotoKeyGroupDrag,
    prepareRotoGroupDrag,
    commitRotoGroupDrag,
    canDragKey,
    dragDisabledReason,
    forceSpacingInput,
    setForceSpacingInput,
    applyForceSpacing,
    canApplyForceSpacing,
    forceSpacingDisabledReason,
    canAddEmptyKey,
    addEmptyKeyDisabledReason,
    canSelectAllKeys,
    selectAllKeysDisabledReason,
  }), [insertRotoFrame, canInsertFrame, insertDisabledReason, insertTooltipDescription, deleteRotoFrame, canDeleteFrame, deleteDisabledReason, pendingOperationIdSignal, prepareRotoKeyDrag, commitRotoKeyDrag, prepareRotoKeyGroupDrag, commitRotoKeyGroupDrag, prepareRotoGroupDrag, commitRotoGroupDrag, canDragKey, dragDisabledReason, forceSpacingInput, setForceSpacingInput, applyForceSpacing, canApplyForceSpacing, forceSpacingDisabledReason, canAddEmptyKey, addEmptyKeyDisabledReason, canSelectAllKeys, selectAllKeysDisabledReason]);

  const physicalKeyUtilities: RotoPhysicalKeyUtilityPort = useMemo(() => ({
    duplicateKey,
    pasteKey,
    pasteKeyGroup,
    addEmptyKey,
  }), [duplicateKey, pasteKey, pasteKeyGroup, addEmptyKey]);

  return {
    updateInterpolationSettings,
    physicalActions,
    physicalKeyUtilities,
  };
}

function parseCanonicalForceSpacing(rawValue: string): number | null {
  if (!/^(?:0|[1-9]\d*)$/.test(rawValue)) return null;
  const value = Number(rawValue);
  return Number.isSafeInteger(value) ? value : null;
}

function targetSignatureOf(target: RotoDragTarget): RotoDragTargetSignature {
  if (target.kind === 'physical-cell') {
    return { kind: 'physical-cell', appFrame: target.appFrame, targetKeyId: null };
  }
  return { kind: target.kind, appFrame: null, targetKeyId: target.targetKeyId };
}

function isBoundedKeyId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256;
}

function buildProposalVersion(
  records: readonly PhysicPaintRotoRealKeyRecord[],
  interpolation: PhysicPaintRotoInterpolationState,
  loopClips: readonly PhysicPaintRotoLoopClip[],
  launch: PhysicPaintLaunchContext,
): string {
  const revision = buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips);
  return `${revision}:${launch.operationId}:${launch.layerId}`;
}

/**
 * Break-aware proposal-version fingerprint for the Group-drag publication
 * (GDRAG-07 / RESEARCH Pitfall 1). Unlike {@link buildProposalVersion}, the
 * incoming interpolation break collection is threaded as the 4th revision
 * parameter so stale break authority produces a different fingerprint and is
 * rejected before mutation. Existing call sites of buildProposalVersion are
 * intentionally untouched (regression boundary).
 */
function buildGroupDragProposalVersion(
  records: readonly PhysicPaintRotoRealKeyRecord[],
  interpolation: PhysicPaintRotoInterpolationState,
  loopClips: readonly PhysicPaintRotoLoopClip[],
  incomingInterpolationBreakKeyIds: readonly string[],
  launch: PhysicPaintLaunchContext,
): string {
  const revision = buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips, incomingInterpolationBreakKeyIds);
  return `${revision}:${launch.operationId}:${launch.layerId}`;
}

interface ActionAvailability {
  readonly eligible: boolean;
  readonly reason: string | null;
}

function readRotoInsertTargetInput(input: RotoTimelineActionsInput): RotoInsertTargetClassificationInput {
  const currentAppFrame = input.getCurrentAppFrame?.() ?? null;
  const capacity = input.getCapacity?.() ?? null;
  const records = input.getRotoKeyRecords?.() ?? [];
  const loopClips = input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY;
  let frameResolution: PhysicPaintRotoFrameResolution | null = null;
  if (currentAppFrame !== null) {
    frameResolution = input.getFrameResolution?.(currentAppFrame) ?? null;
    if (frameResolution === null && capacity !== null && loopClips.length > 0) {
      frameResolution = resolvePhysicPaintRotoLoopFrame(derivePhysicPaintRotoLoopRanges({
        identities: records.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame })),
        loopClips,
        parentEndExclusive: capacity,
        capacity,
        interpolationEnabled: input.getRotoInterpolationState?.().enabled ?? false,
      }), currentAppFrame);
    }
  }
  return {
    launchReady: (input.getLaunchContext?.() ?? null) !== null,
    pendingOperationId: input.pendingOperationId?.value ?? null,
    selectedKeyId: input.getSelectedKeyId?.() ?? null,
    currentAppFrame,
    capacity,
    records,
    physicalCells: input.getPhysicalCells?.() ?? [],
    frameResolution,
  };
}

function mapRotoInsertFailureTarget(
  failure: PhysicPaintRotoPhysicalEditFailure,
  input: RotoTimelineActionsInput,
): RotoInsertTarget {
  const currentAppFrame = input.getCurrentAppFrame?.() ?? -1;
  if (failure.code === 'duplicate-destination-frame') {
    return { kind: 'occupied-empty-intent', appFrame: currentAppFrame };
  }
  if (failure.code === 'out-of-range-frame' || failure.code === 'over-capacity') {
    return { kind: 'out-of-capacity', appFrame: currentAppFrame };
  }
  return classifyRotoInsertTarget(readRotoInsertTargetInput(input));
}

function readRotoDeleteTargetInput(input: RotoTimelineActionsInput): RotoDeleteTargetClassificationInput {
  return {
    launchReady: (input.getLaunchContext?.() ?? null) !== null,
    pendingOperationId: input.pendingOperationId?.value ?? null,
    selectedKeyId: input.getSelectedKeyId?.() ?? null,
    selectedKeyIds: input.getSelectedKeyIds?.() ?? [],
    selectedLoopClipIds: input.getSelectedLoopClipIds?.() ?? [],
    currentAppFrame: input.getCurrentAppFrame?.() ?? null,
    capacity: input.getCapacity?.() ?? null,
    records: input.getRotoKeyRecords?.() ?? [],
    loopClips: input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
    interpolation: input.getRotoInterpolationState?.() ?? { enabled: false, mode: 'duplicate' },
    physicalCells: input.getPhysicalCells?.() ?? [],
  };
}

function computeDragAvailability(input: RotoTimelineActionsInput): ActionAvailability {
  if (!input.getLaunchContext || !input.getLaunchContext()) {
    return { eligible: false, reason: 'Select a real Roto key before editing the timeline.' };
  }
  if (input.pendingOperationId && input.pendingOperationId.value !== null) {
    return { eligible: false, reason: 'A Roto physical edit is already in flight.' };
  }
  const selectedKeyId = input.getSelectedKeyId?.() ?? null;
  if (!selectedKeyId) {
    return { eligible: false, reason: 'Select a real Roto key to drag.' };
  }
  const records = input.getRotoKeyRecords?.() ?? [];
  const selectedRecord = records.find((record) => record.keyId === selectedKeyId);
  if (!selectedRecord) {
    return { eligible: false, reason: 'The selected Roto key is no longer available.' };
  }
  return { eligible: true, reason: null };
}

function computeAddEmptyKeyAvailability(input: RotoTimelineActionsInput): ActionAvailability {
  if (!input.getLaunchContext || !input.getLaunchContext()) {
    return { eligible: false, reason: 'Select a Physics Paint Roto timeline before adding a key.' };
  }
  if (input.pendingOperationId && input.pendingOperationId.value !== null) {
    return { eligible: false, reason: 'A Roto physical edit is already in flight.' };
  }
  const currentAppFrame = input.getCurrentAppFrame?.() ?? null;
  if (currentAppFrame === null || !Number.isInteger(currentAppFrame) || currentAppFrame < 0) {
    return { eligible: false, reason: 'Select a valid Roto frame before adding a key.' };
  }
  const records = input.getRotoKeyRecords?.() ?? [];
  if (records.some((record) => record.appFrame === currentAppFrame)) {
    return { eligible: false, reason: 'The current frame already has a real Roto key.' };
  }
  return { eligible: true, reason: null };
}

function computeSelectAllKeysAvailability(input: RotoTimelineActionsInput): ActionAvailability {
  if (!input.getLaunchContext || !input.getLaunchContext()) {
    return { eligible: false, reason: 'Select a Physics Paint Roto timeline before selecting keys.' };
  }
  if (input.pendingOperationId && input.pendingOperationId.value !== null) {
    return { eligible: false, reason: 'A Roto physical edit is already in flight.' };
  }
  if ((input.getRotoKeyRecords?.() ?? []).length === 0) {
    return { eligible: false, reason: 'No real Roto keys to select.' };
  }
  // Select All is idempotent: eligible even when every key is already selected.
  return { eligible: true, reason: null };
}

function computeForceSpacingAvailability(input: RotoTimelineActionsInput): ActionAvailability {  if (!input.getLaunchContext || !input.getLaunchContext()) {
    return { eligible: false, reason: 'Select a Physics Paint Roto timeline before applying Force Spacing.' };
  }
  if (!input.executePhysicalEdit || !input.getRotoKeyRecords || !input.getRotoInterpolationState || !input.getCapacity) {
    return { eligible: false, reason: 'Timeline editing is unavailable.' };
  }
  if (input.pendingOperationId && input.pendingOperationId.value !== null) {
    return { eligible: false, reason: 'A Roto physical edit is already in flight.' };
  }
  return { eligible: true, reason: null };
}

function toPhysicPaintRotoInterpolationSettings(settings: RotoSourceDisplayModel['settings']): PhysicPaintRotoInterpolationSettings {
  return {
    enabled: settings.enabled === true,
    inBetweenCount: settings.inBetweenCount ?? 1,
    mode: settings.mode === 'blend' ? 'blend' : 'duplicate',
    deform: settings.deform ?? 0,
    position: settings.position ?? 0,
    ...(settings.segmentSpacingOverrides ? { segmentSpacingOverrides: settings.segmentSpacingOverrides.map((override) => ({ ...override })) } : {}),
  };
}