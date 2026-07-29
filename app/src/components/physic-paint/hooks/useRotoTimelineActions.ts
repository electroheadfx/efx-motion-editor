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
  PhysicPaintRotoRealKeyPayload,
  PhysicPaintRotoRealKeyRecord,
} from '../roto/physicsPaintRotoPhysicalModel';
import { buildPhysicPaintRotoPhysicalRevision } from '../roto/physicsPaintRotoPhysicalModel';
import type { RotoPhysicalTimelineCell } from '../roto/rotoPhysicalTimelinePorts';
import {
  createPhysicPaintRotoDuplicateKeyIntent,
  createPhysicPaintRotoPasteKeyGroupIntent,
  createPhysicPaintRotoPasteKeyIntent,
  resolvePhysicPaintRotoPhysicalEdit,
  type PhysicPaintRotoPhysicalEditFailure,
  type PhysicPaintRotoPhysicalEditIntent,
  type PhysicPaintRotoPhysicalEditProposal,
  type PhysicPaintRotoPhysicalEditResolution,
  type PhysicPaintRotoPhysicalEditTarget,
} from '../roto/physicsPaintRotoPhysicalResolver';
import type { RotoSessionCopiedGroupEntry } from '../roto/physicsPaintRotoSession';
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
  /** Current physical projection cells (D-10). */
  getPhysicalCells?: () => readonly RotoPhysicalTimelineCell[];
  /** Selected stable keyId (D-01). */
  getSelectedKeyId?: () => string | null;
  /**
   * Controller-owned session selection set (37-02; D-05). Read-only here:
   * the hook never derives selection from frames, never mutates the set, and
   * never persists it or sends it across the bridge.
   */
  getSelectedKeyIds?: () => readonly string[];
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
  /**
   * D-26 detail leg: full resolver failure detail (code + text) routed to the
   * surviving diagnostic channel. The Studio wires this to the same console
   * diagnostic style as the coordinator's logDiagnostic.
   */
  publishDiagnostic?: (message: string) => void;
}

interface PhysicalActionRunnerInput {
  readonly intent: PhysicPaintRotoPhysicalEditIntent;
  readonly operationKind: 'insert-slot' | 'delete-key' | 'delete-key-group' | 'duplicate-key' | 'paste-key' | 'paste-key-group';
  readonly requiredKeyId: string | null;
  readonly successMessage: string;
  /**
   * Optional failure-code → concise capsule copy mapping (UI-SPEC locked
   * lines). Absent: the resolver failure text publishes unchanged, preserving
   * byte-identical behavior for existing routes.
   */
  readonly rejectedCopy?: (failure: PhysicPaintRotoPhysicalEditFailure) => string;
}

const INSERT_SUCCESS_MESSAGE = 'Inserted an empty Roto frame before the selected key.';
const DELETE_SUCCESS_MESSAGE = 'Deleted the selected Roto key.';
const GROUP_DELETE_SUCCESS_MESSAGE = 'Keys deleted';
const DUPLICATE_SUCCESS_MESSAGE = 'Duplicated the selected Roto key.';
const PASTE_SUCCESS_MESSAGE = 'Pasted the copied paint into the Roto timeline.';
const ADD_KEY_SUCCESS_MESSAGE = 'Added an empty Roto key.';
const INVALID_FORCE_SPACING_MESSAGE = 'Enter a whole number of empty frames (0 or more).';

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

  // Reactive availability + disabled reasons for the physical action bundle.
  // Derived directly from current selected identity/real-key status, launch
  // readiness, and the coordinator's one pending Signal/computed output.
  const canInsertFrame = computed(() => computeInsertAvailability(input).eligible);
  const insertDisabledReason = computed(() => computeInsertAvailability(input).reason);
  const canDeleteFrame = computed(() => computeDeleteAvailability(input).eligible);
  const deleteDisabledReason = computed(() => computeDeleteAvailability(input).reason);
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
    });
    if (!resolution.ok) {
      input.publishStatus?.(runnerInput.rejectedCopy?.(resolution.failure) ?? (resolution.failure.text || 'The Roto timeline edit is invalid.'));
      if (runnerInput.operationKind === 'delete-key-group' || runnerInput.operationKind === 'paste-key-group') {
        input.publishDiagnostic?.(runnerInput.operationKind + ' rejected: ' + resolution.failure.code + ' — ' + resolution.failure.text);
      }
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

  const insertRotoFrame = useCallback((): Promise<boolean> => {
    const selectedKeyId = ensureSelectedKeyId(input);
    return runPhysicalAction({
      intent: { kind: 'insert-slot', selectedKeyId },
      operationKind: 'insert-slot',
      requiredKeyId: selectedKeyId,
      successMessage: INSERT_SUCCESS_MESSAGE,
    });
  }, [runPhysicalAction, input]);

  const deleteRotoFrame = useCallback((): Promise<boolean> => {
    // D-13 shared transaction: the Backspace/Delete keyboard route and the
    // toolbar Delete icon already call this one bundle action, so every
    // delete route shares the group branch with zero routing changes. The
    // resolver is the membership authority ('unknown-operation-identity'
    // rejects absent/unknown members fail-closed), so requiredKeyId is null.
    const selectedKeyIds = input.getSelectedKeyIds?.() ?? [];
    if (selectedKeyIds.length >= 2) {
      return runPhysicalAction({
        intent: { kind: 'delete-key-group', keyIds: Object.freeze([...selectedKeyIds]) },
        operationKind: 'delete-key-group',
        requiredKeyId: null,
        successMessage: GROUP_DELETE_SUCCESS_MESSAGE,
      });
    }
    // Fail closed (CR-02): the keyboard route can reach this action with no
    // valid selection; never throw — publish a status and resolve false.
    const selectedKeyId = input.getSelectedKeyId?.() ?? null;
    if (!isBoundedKeyId(selectedKeyId)) {
      input.publishStatus?.('Select a real Roto key to delete.');
      return Promise.resolve(false);
    }
    return runPhysicalAction({
      intent: { kind: 'delete-key', selectedKeyId },
      operationKind: 'delete-key',
      requiredKeyId: selectedKeyId,
      successMessage: DELETE_SUCCESS_MESSAGE,
    });
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
    const resolution: PhysicPaintRotoPhysicalEditResolution = resolvePhysicPaintRotoPhysicalEdit({
      identities,
      intent: { kind: 'move-key-group', movedKeyIds, grabbedKeyId, target },
      capacity,
      interpolationEnabled: interpolation.enabled,
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
    const proposalVersion = buildProposalVersion(records, interpolation, launch);
    return {
      ok: true,
      publication: Object.freeze({
        proposal,
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
    if (publication.proposal.status.operationKind !== 'move-key-group') return false;
    const drag = publication.proposal.drag;
    if (!drag || drag.movedKeyId !== publication.movedKeyId) return false;
    const movedKeyIds = publication.movedKeyIds;
    if (
      !movedKeyIds
      || movedKeyIds.length !== drag.movedKeyIds.length
      || movedKeyIds.some((keyId, index) => keyId !== drag.movedKeyIds[index])
    ) return false;
    if (publication.expectedLaunch.operationId.length === 0 || publication.expectedLaunch.layerId.length === 0) return false;
    return input.executePhysicalEdit({
      proposal: publication.proposal,
      expectedLaunch: publication.expectedLaunch,
      operationKind: 'move-key-group',
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
    const selectedKeyId = input.getSelectedKeyId?.() ?? null;
    // D-10: exactly one key selected = full timeline; two or more =
    // selected-only scope. Null scope is the byte-identical 36.14 path.
    const selectedKeyIds = input.getSelectedKeyIds?.() ?? [];
    const scopeKeyIds = selectedKeyIds.length >= 2 ? Object.freeze([...selectedKeyIds]) as readonly string[] : null;
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
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities,
      intent: {
        kind: 'force-spacing',
        emptyFrames,
        selectedKeyId,
        scopeKeyIds,
      },
      capacity,
      interpolationEnabled: interpolation.enabled,
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
    deleteRotoFrame,
    canDeleteFrame,
    deleteDisabledReason,
    pendingOperationId: pendingOperationIdSignal,
    prepareRotoKeyDrag,
    commitRotoKeyDrag,
    prepareRotoKeyGroupDrag,
    commitRotoKeyGroupDrag,
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
  }), [insertRotoFrame, canInsertFrame, insertDisabledReason, deleteRotoFrame, canDeleteFrame, deleteDisabledReason, pendingOperationIdSignal, prepareRotoKeyDrag, commitRotoKeyDrag, prepareRotoKeyGroupDrag, commitRotoKeyGroupDrag, canDragKey, dragDisabledReason, forceSpacingInput, setForceSpacingInput, applyForceSpacing, canApplyForceSpacing, forceSpacingDisabledReason, canAddEmptyKey, addEmptyKeyDisabledReason, canSelectAllKeys, selectAllKeysDisabledReason]);

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