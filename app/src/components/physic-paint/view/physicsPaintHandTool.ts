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
 * 261107-sg3 UAT: it is a MOMENTARY press. The ONLY pointer control is the Hand
 * button in the floating canvas zoom pill: pressing it captures the pointer and
 * arms pan mode, moving the pointer (mouse or pen) pans through the
 * EXISTING zoom-store pan path (the same one middle-drag uses) for as long as
 * the press lasts, and RELEASING stops the pan and disarms. Nothing is latched.
 *
 * 261113-o26 follow-up: Shift+Space arms the same canvas pan from the keyboard.
 * It carries its OWN flag so a pill press released early can never leave the
 * keyboard arming half-applied (or vice versa). Both flags are session-only:
 * never persisted, never serialized, never part of any document/history
 * snapshot — a fresh Studio open always starts disarmed.
 */
const armed = signal(false);
const spacePanArmed = signal(false);

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

/** One-shot read for the canvas pointer gate (Shift+Space). */
export function isSpacePanArmedPeek(): boolean {
  return spacePanArmed.peek();
}

/** Compare-then-write setter (reactivity rule 3). Returns true on a change. */
export function setSpacePanArmed(next: boolean): boolean {
  if (spacePanArmed.peek() === next) return false;
  spacePanArmed.value = next;
  return true;
}

/** Disarm the keyboard pan. Idempotent. */
export function disarmSpacePan(): boolean {
  return setSpacePanArmed(false);
}
