import { useCallback, useEffect, useRef } from 'preact/hooks';
import type { PhysicsPaintWorkflowStripFrameMarker } from '../view/PhysicsPaintWorkflowStrip';
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
  const onKeyDown = useCallback((event: KeyboardEvent) => {
    dispatchPhysicsPaintStudioKeyDown(event, state, actions, savedRotoFrames);
  }, [actions, savedRotoFrames, state]);
  // The primary dispatcher rides the Studio shell's `onKeyDown`, so a key only
  // reaches it while focus sits INSIDE the shell. Two ordinary gestures leave
  // nothing focused: a canvas press suppresses focus transfer, and a focused
  // control that unmounts drops focus to <body>. In that orphaned state the
  // shell handler never fires and every bare Studio shortcut — Delete
  // included, which is the reported symptom — goes dead while every
  // pointer-driven path (Alt+click, the sheet's trash) keeps working.
  //
  // This second route owns exactly that state: it stands down the moment
  // anything is focused, so the shell stays the one owner for every target
  // inside it and no key is ever dispatched twice.
  const handlerRef = useRef(onKeyDown);
  handlerRef.current = onKeyDown;
  useEffect(() => {
    const onWindowKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement;
      if (active !== null && active !== document.body && active !== document.documentElement) return;
      handlerRef.current(event);
    };
    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, []);
  return onKeyDown;
}
