import { useCallback } from 'preact/hooks';
import type { PhysicsPaintWorkflowStripFrameMarker } from '../PhysicsPaintWorkflowStrip';
import {
  dispatchPhysicsPaintStudioKeyDown,
  type PhysicsPaintStudioKeyboardActions,
  type PhysicsPaintStudioKeyboardState,
} from '../view/physicsPaintStudioKeyboard';

export interface UsePhysicsPaintStudioKeyboardInput {
  state: PhysicsPaintStudioKeyboardState;
  actions: PhysicsPaintStudioKeyboardActions;
  savedRotoFrames: PhysicsPaintWorkflowStripFrameMarker[];
}

export function usePhysicsPaintStudioKeyboard(input: UsePhysicsPaintStudioKeyboardInput) {
  const { state, actions, savedRotoFrames } = input;
  return useCallback((event: KeyboardEvent) => {
    dispatchPhysicsPaintStudioKeyDown(event, state, actions, savedRotoFrames);
  }, [actions, savedRotoFrames, state]);
}
