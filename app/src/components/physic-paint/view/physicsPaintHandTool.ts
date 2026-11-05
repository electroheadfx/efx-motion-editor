import { signal } from '@preact/signals';

/**
 * 261105-cgl Task 3: session-only armed Hand host tool.
 *
 * The Hand is a HOST tool — deliberately outside the `AquarelleTool` union,
 * exactly like the latched color picker (`aquarelleColorPicker.ts`). It never
 * writes `aquarelleActiveTool`, Select mode, or the picker state, so arming it
 * changes no paint surface and DISARMING is literally "back to the previous
 * tool": the previous paint tool is still installed, untouched.
 *
 * The armed flag lives in this focused sibling module so it never enters
 * PhysicsPaintStudio.tsx logic and is NEVER persisted, serialized, or part of
 * any document/history snapshot — save/reopen always starts disarmed.
 *
 * The viewport consumes it for one purpose only: while armed, a primary-button
 * drag pans the canvas through the EXISTING zoom-store pan path (the same one
 * middle-drag uses) and the release disarms.
 */
const armed = signal(false);

/** Subscribing read: components that render armed state (rail button, cursor
 *  class) re-render on arm/disarm changes. */
export function isHandToolArmed(): boolean {
  return armed.value;
}

/** One-shot read for dispatch-time consumers (pointer handlers). */
export function isHandToolArmedPeek(): boolean {
  return armed.peek();
}

/** Compare-then-write setter (reactivity rule 3). Returns true on a change. */
export function setHandToolArmed(next: boolean): boolean {
  if (armed.peek() === next) return false;
  armed.value = next;
  return true;
}

/** Arm/disarm toggle (mode toggle: click arms, re-click disarms). */
export function toggleHandTool(): boolean {
  return setHandToolArmed(!armed.peek());
}

/** Disarm. Idempotent — an already-disarmed tool never notifies subscribers. */
export function disarmHandTool(): boolean {
  return setHandToolArmed(false);
}
