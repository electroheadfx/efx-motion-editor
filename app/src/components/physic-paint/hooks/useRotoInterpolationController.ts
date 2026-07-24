import type { ReadonlySignal } from '@preact/signals';
import { useCallback } from 'preact/hooks';
import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import type {
  PhysicPaintRotoInterpolationState,
  PhysicPaintRotoRealKeyRecord,
} from '../roto/physicsPaintRotoPhysicalModel';
import type {
  RotoInterpolationEnabledExecuteInput,
  RotoPhysicalEditCoordinatorHandle,
} from './useRotoPhysicalEditCoordinator';

/**
 * Intent-only physical interpolation controller (D-02/D-04/D-09).
 *
 * The accepted physical document remains unchanged until the sole coordinator
 * receives the exact parent acknowledgement. This controller never mutates the
 * store, mirrors state, or sends the historical interpolation-settings command.
 * Script Motion remains a separate D-04 contract.
 */
export function useRotoInterpolationController(input: {
  launchContext: PhysicPaintLaunchContext | null;
  interpolation: PhysicPaintRotoInterpolationState;
  records: readonly PhysicPaintRotoRealKeyRecord[];
  selectedKeyId: string | null;
  selectedAppFrame: number | null;
  pendingOperationId: ReadonlySignal<string | null>;
  executePhysicalEdit: RotoPhysicalEditCoordinatorHandle['executePhysicalEdit'];
  isMutationLocked?: () => boolean;
}) {
  const updateRotoInterpolationSettings = useCallback(async (patch: { enabled?: boolean }) => {
    if (input.isMutationLocked?.() || input.pendingOperationId.peek() !== null) return false;
    const launchContext = input.launchContext;
    if (!launchContext) return false;

    const enabled = patch.enabled ?? !input.interpolation.enabled;
    if (enabled === input.interpolation.enabled) return false;

    const executeInput: RotoInterpolationEnabledExecuteInput = {
      operationKind: 'set-interpolation-enabled',
      expectedLaunch: {
        operationId: launchContext.operationId,
        layerId: launchContext.layerId,
      },
      records: input.records,
      targetInterpolation: { enabled },
      selectedKeyId: input.selectedKeyId,
      selectedAppFrame: input.selectedKeyId === null ? null : input.selectedAppFrame,
    };
    return input.executePhysicalEdit(executeInput);
  }, [input]);

  return { updateRotoInterpolationSettings };
}
