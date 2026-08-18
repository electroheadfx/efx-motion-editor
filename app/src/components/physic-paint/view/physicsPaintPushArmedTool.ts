import { signal } from '@preact/signals';

/**
 * Session-only armed Push tool state (D-19, 43.4-02 precedent). The armed flag
 * lives in a focused sibling module so armed state never enters
 * PhysicsPaintStudio.tsx logic and is NEVER persisted, serialized, or part of
 * any document/history snapshot — save/reopen always starts disarmed. The
 * strip consumes the signal for paint only (armed tint, cursor).
 *
 * 43.5-05 design revision: ONE Push tool, selection-first, direction from the
 * drag. The armed state is a plain boolean — no direction is chosen at arm
 * time. The selected Rail is the explicit anchor; the drag direction (right or
 * left) chooses the moved set on drag start.
 */
const armed = signal(false);

/**
 * Commit-in-flight guard (43.5-05 smoke 3): a successful push must NOT disarm
 * the tool — the user chains consecutive pushes. While a push commit is in
 * flight the mutation-lock disarm path (PhysicsPaintStudio) and the strip's
 * disarm-on-selection-change effect skip, so the armed state survives the
 * commit and the anchor re-binds to the rail's new position.
 */
const commitInFlight = signal(false);

/** Subscribing read (D-19): components that render armed state re-render on
 *  arm/disarm changes — used by the strip tint, aria-pressed, and cursor. */
export function isPushToolArmed(): boolean {
  return armed.value;
}

/** One-shot read of the commit-in-flight guard (peek: no subscription — the
 *  Studio effect consumes it synchronously, never re-renders from it). */
export function isPushCommitInFlight(): boolean {
  return commitInFlight.peek();
}

/** Set/reset the commit-in-flight guard around a push commit. */
export function setPushCommitInFlight(value: boolean): void {
  commitInFlight.value = value;
}

/**
 * Arm/disarm toggle (D-06): click arms; re-click disarms. Returns true whenever
 * the armed state changed.
 */
export function togglePushTool(): boolean {
  armed.value = !armed.peek();
  return true;
}

/**
 * Disarm an armed tool. Returns true ONLY when a tool was actually armed —
 * the keyboard Escape layer and lock transitions consume the boolean so one
 * Escape/transition handles at most one layer (Pitfall 2, D-18).
 */
export function disarmPushTool(): boolean {
  if (!armed.peek()) return false;
  armed.value = false;
  return true;
}
