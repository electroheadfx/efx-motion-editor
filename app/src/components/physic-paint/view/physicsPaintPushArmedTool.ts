import { signal } from '@preact/signals';

export type PushToolDirection = 'right' | 'left';

/**
 * Session-only armed Push tool state (D-19, 43.4-02 precedent). The armed
 * direction lives in a focused sibling module so armed state never enters
 * PhysicsPaintStudio.tsx logic and is NEVER persisted, serialized, or part of
 * any document/history snapshot — save/reopen always starts disarmed. The
 * strip consumes the signal for paint only (armed tint, directional cursor).
 */
const armedDirection = signal<PushToolDirection | null>(null);

/** Subscribing read (D-19): components that render armed state re-render on
 *  arm/disarm changes — used by the strip tint, aria-pressed, and cursor. */
export function isPushToolArmed(): boolean {
  return armedDirection.value !== null;
}

/** Subscribing read — the directional cursor and armed tint render from this. */
export function getArmedPushToolDirection(): PushToolDirection | null {
  return armedDirection.value;
}

/**
 * Arm/disarm toggle (D-06): click arms; re-click disarms; arming the other
 * Push tool switches direction in one click. Returns true whenever the armed
 * state changed.
 */
export function togglePushTool(direction: PushToolDirection): boolean {
  if (armedDirection.peek() === direction) {
    armedDirection.value = null;
    return true;
  }
  armedDirection.value = direction;
  return true;
}

/**
 * Disarm an armed tool. Returns true ONLY when a tool was actually armed —
 * the keyboard Escape layer and lock transitions consume the boolean so one
 * Escape/transition handles at most one layer (Pitfall 2, D-18).
 */
export function disarmPushTool(): boolean {
  if (armedDirection.peek() === null) return false;
  armedDirection.value = null;
  return true;
}
