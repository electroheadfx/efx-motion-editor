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
import type { RotoPhysicalTimelineCell } from '../roto/rotoPhysicalTimelinePorts';
import {
  resolvePhysicPaintRotoPhysicalEdit,
  type PhysicPaintRotoPhysicalEditIntent,
  type PhysicPaintRotoPhysicalEditProposal,
  type PhysicPaintRotoPhysicalEditResolution,
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

  const physicalActions: RotoPhysicalTimelineActionBundle = useMemo(() => ({
    insertRotoFrame,
    canInsertFrame,
    insertDisabledReason,
    deleteRotoFrame,
    canDeleteFrame,
    deleteDisabledReason,
    pendingOperationId: pendingOperationIdSignal,
  }), [insertRotoFrame, canInsertFrame, insertDisabledReason, deleteRotoFrame, canDeleteFrame, deleteDisabledReason, pendingOperationIdSignal]);

  return { saveRealKeyAtDisplayFrame, updateInterpolationSettings, physicalActions };
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