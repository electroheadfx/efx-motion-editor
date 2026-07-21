import { useCallback, useMemo } from 'preact/hooks';
import { computed, signal, type ReadonlySignal } from '@preact/signals';
import type { PhysicPaintLaunchContext, PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings } from '../../../types/physicPaint';
import { getSourceRotoFrameForDisplayFrame } from '../roto/physicsPaintRotoWorkflow';
import {
  saveRotoRealKeyTransaction,
  updateRotoInterpolationSettingsTransaction,
  type RotoSourceDisplayModel,
} from '../roto/physicsPaintRotoKeyController';
import type { PhysicPaintRotoRealKeyRecord, PhysicPaintRotoInterpolationState } from '../roto/physicsPaintRotoPhysicalModel';
import { buildPhysicPaintRotoPhysicalRevision } from '../roto/physicsPaintRotoPhysicalModel';
import type { RotoPhysicalTimelineCell } from '../roto/rotoPhysicalTimelinePorts';
import {
  resolvePhysicPaintRotoPhysicalEdit,
  type PhysicPaintRotoPhysicalEditIntent,
  type PhysicPaintRotoPhysicalEditProposal,
  type PhysicPaintRotoPhysicalEditResolution,
  type PhysicPaintRotoPhysicalEditTarget,
} from '../roto/physicsPaintRotoPhysicalResolver';
import type { RotoPhysicalEditExecuteInput } from '../roto/rotoCoordinatorPorts';

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
  readonly proposalVersion: string;
  readonly expectedLaunch: { readonly operationId: string; readonly layerId: string };
  readonly movedKeyId: string;
  readonly targetSignature: RotoDragTargetSignature;
}

/**
 * Preparation result. The failure branch carries no proposal; the success
 * branch carries one immutable publication.
 */
export type RotoDragPreparationResult =
  | { readonly ok: true; readonly publication: RotoDragPublication }
  | { readonly ok: false; readonly reason: string };

export interface RotoPhysicalTimelineActionBundle {
  /** Insert one empty physical slot before the selected real key (D-05). */
  readonly insertRotoFrame: () => Promise<boolean>;
  /** Reactive Insert availability derived from selection + pending authority. */
  readonly canInsertFrame: ReadonlySignal<boolean>;
  /** Reactive Insert disabled reason, or null when eligible. */
  readonly insertDisabledReason: ReadonlySignal<string | null>;
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
  /** Reactive Drag availability derived from selection + pending authority. */
  readonly canDragKey: ReadonlySignal<boolean>;
  /** Reactive Drag disabled reason, or null when eligible. */
  readonly dragDisabledReason: ReadonlySignal<string | null>;
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
  /** Enabled-only interpolation state from the store (D-02). */
  getRotoInterpolationState?: () => PhysicPaintRotoInterpolationState;
  /** Current physical projection cells (D-10). */
  getPhysicalCells?: () => readonly RotoPhysicalTimelineCell[];
  /** Selected stable keyId (D-01). */
  getSelectedKeyId?: () => string | null;
  /** Current direct physical navigation frame. */
  getCurrentAppFrame?: () => number;
  /** Launch context identity at action time (D-09). */
  getLaunchContext?: () => PhysicPaintLaunchContext | null;
  /** Bounded physical frame capacity (D-01/D-02). */
  getCapacity?: () => number;
  /** Generic acknowledged coordinator execute seam (Plan 36.14-04). */
  executePhysicalEdit?: (input: RotoPhysicalEditExecuteInput<PhysicPaintRotoPhysicalEditProposal>) => Promise<boolean>;
  /** Coordinator pending operation id Signal (Plan 36.14-04). */
  pendingOperationId?: ReadonlySignal<string | null>;
  /** Concise status/LOG publisher for resolver failures. */
  publishStatus?: (message: string | null) => void;
}

interface PhysicalActionRunnerInput {
  readonly intent: PhysicPaintRotoPhysicalEditIntent;
  readonly operationKind: 'insert-slot' | 'delete-key';
  readonly successMessage: string;
}

const INSERT_SUCCESS_MESSAGE = 'Inserted an empty Roto frame before the selected key.';
const DELETE_SUCCESS_MESSAGE = 'Deleted the selected Roto key.';

export function useRotoTimelineActions(input: RotoTimelineActionsInput) {
  const saveRealKeyAtDisplayFrame = useCallback((displayFrame: number) => (
    saveRotoRealKeyTransaction({
      model: input.getModel(),
      displayFrame,
      currentSettings: input.getCurrentSettings?.() ?? toPhysicPaintRotoInterpolationSettings(input.getModel().settings),
    })
  ), [input]);

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

  // Reactive availability + disabled reasons for the physical action bundle.
  // Derived directly from current selected identity/real-key status, launch
  // readiness, and the coordinator's one pending Signal/computed output.
  const canInsertFrame = computed(() => computeInsertAvailability(input).eligible);
  const insertDisabledReason = computed(() => computeInsertAvailability(input).reason);
  const canDeleteFrame = computed(() => computeDeleteAvailability(input).eligible);
  const deleteDisabledReason = computed(() => computeDeleteAvailability(input).reason);
  const canDragKey = computed(() => computeDragAvailability(input).eligible);
  const dragDisabledReason = computed(() => computeDragAvailability(input).reason);
  const pendingOperationIdSignal = input.pendingOperationId ?? signal<string | null>(null);

  const runPhysicalAction = useCallback(async (runnerInput: PhysicalActionRunnerInput): Promise<boolean> => {
    const launch = input.getLaunchContext?.() ?? null;
    if (!launch) {
      input.publishStatus?.('Select a real Roto key before editing the timeline.');
      return false;
    }
    if (!input.executePhysicalEdit || !input.getRotoKeyRecords || !input.getRotoInterpolationState || !input.getCapacity || !input.getSelectedKeyId) {
      input.publishStatus?.('Timeline editing is unavailable.');
      return false;
    }
    if (input.pendingOperationId && input.pendingOperationId.value !== null) {
      input.publishStatus?.('A Roto physical edit is already in flight.');
      return false;
    }
    const selectedKeyId = input.getSelectedKeyId();
    if (!selectedKeyId) {
      input.publishStatus?.('Select a real Roto key before editing the timeline.');
      return false;
    }
    const records = input.getRotoKeyRecords();
    const interpolation = input.getRotoInterpolationState();
    const capacity = input.getCapacity();
    const selectedRecord = records.find((record) => record.keyId === selectedKeyId);
    if (!selectedRecord) {
      input.publishStatus?.('The selected Roto key is no longer available.');
      return false;
    }
    const identities = records.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame }));
    const resolution: PhysicPaintRotoPhysicalEditResolution = resolvePhysicPaintRotoPhysicalEdit({
      identities,
      intent: runnerInput.intent,
      capacity,
      interpolationEnabled: interpolation.enabled,
    });
    if (!resolution.ok) {
      input.publishStatus?.(resolution.failure.text || 'The Roto timeline edit is invalid.');
      return false;
    }
    const proposal = resolution.proposal;
    const accepted = await input.executePhysicalEdit({
      proposal,
      expectedLaunch: { operationId: launch.operationId, layerId: launch.layerId },
      operationKind: runnerInput.operationKind,
      selectedKeyId: proposal.selectedKeyId,
      selectedAppFrame: proposal.selectedAppFrame,
    });
    if (accepted) {
      input.publishStatus?.(runnerInput.successMessage);
    }
    return accepted;
  }, [input]);

  const insertRotoFrame = useCallback((): Promise<boolean> => (
    runPhysicalAction({
      intent: { kind: 'insert-slot', selectedKeyId: ensureSelectedKeyId(input) },
      operationKind: 'insert-slot',
      successMessage: INSERT_SUCCESS_MESSAGE,
    })
  ), [runPhysicalAction, input]);

  const deleteRotoFrame = useCallback((): Promise<boolean> => (
    runPhysicalAction({
      intent: { kind: 'delete-key', selectedKeyId: ensureSelectedKeyId(input) },
      operationKind: 'delete-key',
      successMessage: DELETE_SUCCESS_MESSAGE,
    })
  ), [runPhysicalAction, input]);

  const prepareRotoKeyDrag = useCallback((movedKeyId: string, target: RotoDragTarget): RotoDragPreparationResult => {
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
    const resolution: PhysicPaintRotoPhysicalEditResolution = resolvePhysicPaintRotoPhysicalEdit({
      identities,
      intent: { kind: 'move-key', movedKeyId, target },
      capacity,
      interpolationEnabled: interpolation.enabled,
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
    const proposalVersion = buildProposalVersion(records, interpolation, launch);
    return {
      ok: true,
      publication: Object.freeze({
        proposal,
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
    if (publication.proposal.status.operationKind !== 'move-key') return false;
    const drag = publication.proposal.drag;
    if (!drag || drag.movedKeyId !== publication.movedKeyId) return false;
    if (publication.expectedLaunch.operationId.length === 0 || publication.expectedLaunch.layerId.length === 0) return false;
    return input.executePhysicalEdit({
      proposal: publication.proposal,
      expectedLaunch: publication.expectedLaunch,
      operationKind: 'move-key',
      selectedKeyId: publication.proposal.selectedKeyId,
      selectedAppFrame: publication.proposal.selectedAppFrame,
    });
  }, [input]);

  const physicalActions: RotoPhysicalTimelineActionBundle = useMemo(() => ({
    insertRotoFrame,
    canInsertFrame,
    insertDisabledReason,
    deleteRotoFrame,
    canDeleteFrame,
    deleteDisabledReason,
    pendingOperationId: pendingOperationIdSignal,
    prepareRotoKeyDrag,
    commitRotoKeyDrag,
    canDragKey,
    dragDisabledReason,
  }), [insertRotoFrame, canInsertFrame, insertDisabledReason, deleteRotoFrame, canDeleteFrame, deleteDisabledReason, pendingOperationIdSignal, prepareRotoKeyDrag, commitRotoKeyDrag, canDragKey, dragDisabledReason]);

  return { saveRealKeyAtDisplayFrame, updateInterpolationSettings, physicalActions };
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
  launch: PhysicPaintLaunchContext,
): string {
  const revision = buildPhysicPaintRotoPhysicalRevision(records, interpolation);
  return `${revision}:${launch.operationId}:${launch.layerId}`;
}

function ensureSelectedKeyId(input: RotoTimelineActionsInput): string {
  const keyId = input.getSelectedKeyId?.() ?? null;
  if (!keyId) {
    throw new Error('No selected Roto key.');
  }
  return keyId;
}

interface ActionAvailability {
  readonly eligible: boolean;
  readonly reason: string | null;
}

function computeInsertAvailability(input: RotoTimelineActionsInput): ActionAvailability {
  if (!input.getLaunchContext || !input.getLaunchContext()) {
    return { eligible: false, reason: 'Select a real Roto key before editing the timeline.' };
  }
  if (input.pendingOperationId && input.pendingOperationId.value !== null) {
    return { eligible: false, reason: 'A Roto physical edit is already in flight.' };
  }
  const selectedKeyId = input.getSelectedKeyId?.() ?? null;
  if (!selectedKeyId) {
    return { eligible: false, reason: 'Select a real Roto key to insert.' };
  }
  const records = input.getRotoKeyRecords?.() ?? [];
  const selectedRecord = records.find((record) => record.keyId === selectedKeyId);
  if (!selectedRecord) {
    return { eligible: false, reason: 'The selected Roto key is no longer available.' };
  }
  return { eligible: true, reason: null };
}

function computeDeleteAvailability(input: RotoTimelineActionsInput): ActionAvailability {
  if (!input.getLaunchContext || !input.getLaunchContext()) {
    return { eligible: false, reason: 'Select a real Roto key before editing the timeline.' };
  }
  if (input.pendingOperationId && input.pendingOperationId.value !== null) {
    return { eligible: false, reason: 'A Roto physical edit is already in flight.' };
  }
  const selectedKeyId = input.getSelectedKeyId?.() ?? null;
  if (!selectedKeyId) {
    return { eligible: false, reason: 'Select a real Roto key to delete.' };
  }
  const records = input.getRotoKeyRecords?.() ?? [];
  const selectedRecord = records.find((record) => record.keyId === selectedKeyId);
  if (!selectedRecord) {
    return { eligible: false, reason: 'The selected Roto key is no longer available.' };
  }
  return { eligible: true, reason: null };
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