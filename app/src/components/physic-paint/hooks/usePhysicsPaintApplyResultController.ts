import { useCallback, useEffect, useRef, type MutableRef } from 'preact/hooks';
import type { PhysicPaintApplyPayload, PhysicPaintApplyResult } from '../../../types/physicPaint';
import type { PhysicsPaintBridgeMode } from '../bridge/usePhysicsPaintParentBridge';
import { usePhysicsPaintApplyResultBridge } from '../bridge/usePhysicsPaintParentBridge';

type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';

/**
 * Minimal pending apply record for the non-physical apply kinds
 * (`apply-canvas`, `delete-roto-frame`, `replace-roto-key-frames`,
 * `update-roto-interpolation-settings`). The acknowledged physical-edit
 * transaction owns its own pending tuple via `useRotoPhysicalEditCoordinator`.
 *
 * Plan 36.14-05 Task 3: this type and its transition helpers moved here from
 * the deleted `rotoApplyTransactions.ts` so the result controller owns the
 * one external bridge subscription and the exact active-tuple matching in
 * one module. The coordinator route handles `replace-roto-physical-map`
 * results separately.
 */
export type PendingPhysicPaintApply = Pick<PhysicPaintApplyPayload, 'operationId' | 'kind' | 'startFrame'>;

/**
 * Bridge-result transition for non-physical apply kinds. The controller
 * classifies each result against the active tuple (operation ID + kind +
 * startFrame) and forwards only matching terminal results to the
 * success/failure dispatch. Stale, duplicate, unknown-kind, old-launch, or
 * mismatched results are inert or surface a one-shot diagnostic.
 */
export type RotoApplyResultTransition =
  | { type: 'ignore' }
  | { type: 'mismatch'; message: string }
  | {
    type: 'accepted';
    ok: boolean;
    message: string | null;
    detail: PhysicPaintApplyResult;
  };

const MISMATCHED_RESULT_MESSAGE = 'Ignored mismatched physics paint apply result. Try the action again.';
const GENERIC_APPLY_FAILURE_MESSAGE = 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame.';
const APPLY_TIMEOUT_MS = 5000;

function createPendingPhysicPaintApply(payload: PhysicPaintApplyPayload): PendingPhysicPaintApply {
  return {
    operationId: payload.operationId,
    kind: payload.kind,
    startFrame: payload.startFrame,
  };
}

function transitionRotoApplyResult(
  activeOperationId: string | null,
  pendingApply: PendingPhysicPaintApply | null,
  detail: PhysicPaintApplyResult | null | undefined,
): RotoApplyResultTransition {
  if (!detail || detail.operationId !== activeOperationId) return { type: 'ignore' };
  if (!pendingApply || detail.kind !== pendingApply.kind || detail.startFrame !== pendingApply.startFrame) {
    return { type: 'mismatch', message: MISMATCHED_RESULT_MESSAGE };
  }
  return {
    type: 'accepted',
    ok: detail.ok,
    message: detail.ok ? null : GENERIC_APPLY_FAILURE_MESSAGE,
    detail,
  };
}

/**
 * Coordinator handle subset used by the apply result controller to route
 * `replace-roto-physical-map` results to the generic acknowledged
 * physical-edit coordinator (Plan 36.14-04 Task 3 / Plan 36.14-05 Task 3).
 */
interface PhysicalEditCoordinatorRoute {
  consumeBridgeApplyResult: (detail: PhysicPaintApplyResult | null | undefined) => 'ignore' | 'mismatch' | 'accepted';
}

interface PlaybackSettingsRoute {
  consumeBridgeApplyResult: (detail: PhysicPaintApplyResult | null | undefined) => boolean;
}

interface GeneralResultPorts {
  pendingKeyActionMessageRef: MutableRef<string | null>;
  setApplyStatus: (status: ApplyStatus) => void;
  setApplyMessage: (message: string | null | ((current: string | null) => string | null)) => void;
  setLastError: (message: string | null) => void;
}

interface TimeoutPorts {
  onTimeout: (message: string) => void;
}

export interface UsePhysicsPaintApplyResultControllerInput {
  bridgeMode: PhysicsPaintBridgeMode;
  general: GeneralResultPorts;
  physicalEditCoordinator: PhysicalEditCoordinatorRoute;
  playbackSettings: PlaybackSettingsRoute;
  timeout: TimeoutPorts;
}

/**
 * Plan 36.14-05 Task 3: the apply result controller owns the one external
 * bridge-result subscription, the non-physical pending apply lifecycle
 * (active operation ID, pending tuple, timeout), and the exact active-tuple
 * matching for non-physical apply kinds. `replace-roto-physical-map`
 * results route to the physical-edit coordinator; every other kind is
 * matched here against the active pending apply.
 *
 * The controller returns the lifecycle refs and registers so the Studio
 * composition can wire `registerPendingApply`/`startApplyTimeout` into the
 * non-physical apply callers and `activeOperationIdRef`/`pendingApplyRef`
 * into the launch integration.
 */
export function usePhysicsPaintApplyResultController(input: UsePhysicsPaintApplyResultControllerInput) {
  const activeOperationIdRef = useRef<string | null>(null);
  const pendingApplyRef = useRef<PendingPhysicPaintApply | null>(null);
  const applyTimeoutRef = useRef<number | null>(null);

  const generalRef = useRef(input.general);
  generalRef.current = input.general;
  const timeoutRef = useRef(input.timeout);
  timeoutRef.current = input.timeout;
  const coordinatorRef = useRef(input.physicalEditCoordinator);
  coordinatorRef.current = input.physicalEditCoordinator;
  const playbackSettingsRef = useRef(input.playbackSettings);
  playbackSettingsRef.current = input.playbackSettings;

  const clearApplyTimeout = useCallback(() => {
    if (applyTimeoutRef.current === null) return;
    window.clearTimeout(applyTimeoutRef.current);
    applyTimeoutRef.current = null;
  }, []);

  const clearActiveApply = useCallback(() => {
    clearApplyTimeout();
    activeOperationIdRef.current = null;
    pendingApplyRef.current = null;
  }, [clearApplyTimeout]);

  const registerPendingApply = useCallback((payload: PhysicPaintApplyPayload) => {
    activeOperationIdRef.current = payload.operationId;
    pendingApplyRef.current = createPendingPhysicPaintApply(payload);
  }, []);

  const matchApplyResult = useCallback((detail: PhysicPaintApplyResult | null | undefined): RotoApplyResultTransition => {
    if (detail && detail.kind === 'replace-roto-physical-map') {
      // Physical-edit results are owned by the coordinator. Ignore here so
      // the apply result controller's classification does not advance the
      // non-physical pending state.
      return { type: 'ignore' };
    }
    const transition = transitionRotoApplyResult(activeOperationIdRef.current, pendingApplyRef.current, detail);
    if (transition.type === 'accepted') clearActiveApply();
    return transition;
  }, [clearActiveApply]);

  const startApplyTimeout = useCallback((operationId: string) => {
    clearApplyTimeout();
    applyTimeoutRef.current = window.setTimeout(() => {
      if (activeOperationIdRef.current !== operationId || !pendingApplyRef.current) return;
      clearActiveApply();
      timeoutRef.current.onTimeout(GENERIC_APPLY_FAILURE_MESSAGE);
    }, APPLY_TIMEOUT_MS);
  }, [clearActiveApply, clearApplyTimeout]);

  const handleApplyResult = useCallback((detail: PhysicPaintApplyResult | null | undefined) => {
    if (detail?.kind === 'update-roto-playback-settings') {
      playbackSettingsRef.current.consumeBridgeApplyResult(detail);
      return;
    }
    if (detail && detail.kind === 'replace-roto-physical-map') {
      const routed = coordinatorRef.current.consumeBridgeApplyResult(detail);
      if (routed !== 'ignore') {
        // Coordinator owns the full pending/settle/restore lifecycle and
        // concise-vs-LOG routing for physical edits. Compact status is
        // driven by the coordinator's presentation Signal in Studio; here
        // we only surface mismatched-result diagnostics to LOG.
        if (routed === 'mismatch') {
          generalRef.current.setLastError('Ignored mismatched physics paint physical edit result. Try the action again.');
        }
      }
      return;
    }

    const transition = matchApplyResult(detail);
    if (transition.type === 'ignore') return;
    if (transition.type === 'mismatch') {
      generalRef.current.setApplyStatus('error');
      generalRef.current.setApplyMessage(transition.message);
      generalRef.current.setLastError(transition.message);
      return;
    }

    const acceptedDetail = transition.detail;
    if (!transition.ok) {
      const message = transition.message ?? GENERIC_APPLY_FAILURE_MESSAGE;
      const diagnostic = acceptedDetail.error;
      const fullMessage = diagnostic ? `${message} ${diagnostic}` : message;
      generalRef.current.pendingKeyActionMessageRef.current = null;
      generalRef.current.setApplyStatus('error');
      generalRef.current.setApplyMessage(fullMessage);
      generalRef.current.setLastError(fullMessage);
      return;
    }

    generalRef.current.setApplyStatus('success');
    generalRef.current.setLastError(null);
    if (acceptedDetail.kind === 'replace-roto-key-frames') {
      generalRef.current.setApplyMessage(generalRef.current.pendingKeyActionMessageRef.current ?? 'Roto key changes saved.');
      generalRef.current.pendingKeyActionMessageRef.current = null;
    } else if (acceptedDetail.kind === 'update-roto-interpolation-settings') {
      generalRef.current.setApplyMessage((message) => message || 'Generated in-between settings synced.');
    }
  }, [matchApplyResult]);

  usePhysicsPaintApplyResultBridge(input.bridgeMode, handleApplyResult);

  useEffect(() => () => {
    clearActiveApply();
  }, [clearActiveApply]);

  return {
    handleApplyResult,
    activeOperationIdRef,
    pendingApplyRef,
    registerPendingApply,
    startApplyTimeout,
    matchApplyResult,
  };
}