import { signal } from '@preact/signals';

/**
 * 261105-cgl / 261107-sg3: session-only PRESS-AND-HOLD Hand canvas tool.
 *
 * The Hand is a HOST tool — deliberately outside the `AquarelleTool` union,
 * exactly like the latched color picker (`aquarelleColorPicker.ts`). It never
 * writes `aquarelleActiveTool`, Select mode, or the picker state, so arming it
 * changes no paint surface: the previous paint tool stays installed,
 * untouched.
 *
 * 261107-sg3 UAT: it is a MOMENTARY press. The ONLY control is the Hand button
 * in the floating canvas zoom pill — pressing it captures the pointer and arms
 * pan mode, moving the pointer (mouse or pen) pans through the EXISTING
 * zoom-store pan path (the same one middle-drag uses) for as long as the press
 * lasts, and RELEASING stops the pan and disarms. Nothing is latched. There is
 * no keyboard binding, no Escape handling, and no coupling to the paint tool,
 * Select, the picker or motion mode.
 *
 * The armed flag lives in this focused sibling module so it never enters
 * PhysicsPaintStudio.tsx logic and is NEVER persisted, serialized, or part of
 * any document/history snapshot — a fresh Studio open always starts disarmed.
 */
const armed = signal(false);

/** Subscribing read: the pill button re-renders on press/release changes. */
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

/** Disarm. Idempotent — an already-disarmed tool never notifies subscribers. */
export function disarmHandTool(): boolean {
  return setHandToolArmed(false);
}
