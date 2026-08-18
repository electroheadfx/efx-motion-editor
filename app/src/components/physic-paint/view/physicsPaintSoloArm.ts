import { signal } from '@preact/signals';

/**
 * Session-only Solo playback arm (D-14, D-16, D-20). The armed flag lives in a
 * focused sibling module so armed state never enters PhysicsPaintStudio.tsx
 * logic and is NEVER persisted, serialized, or part of any document/history
 * snapshot — save/reopen always starts disarmed. The strip consumes the
 * signal for paint only (armed tint, aria-pressed, capsule line).
 *
 * Solo is an arm, not a transport command: toggling arms the playback filter
 * and range; the user presses Play (or playback continues); solo persists
 * across stop/start while the selection is unchanged (D-16). Arming never
 * starts or stops transport.
 *
 * Unlike the Push tool there is no commit-in-flight guard: solo is not a
 * mutation tool and never gates mutations (D-14) — it only filters the
 * cached-playback frame enumeration.
 */
const armed = signal(false);

/** Subscribing read (D-20): components that render armed state re-render on
 *  arm/disarm changes — used by the strip tint, aria-pressed, and capsule. */
export function isSoloArmed(): boolean {
  return armed.value;
}

/**
 * Arm/disarm toggle (D-04): click arms; re-click disarms. Returns true whenever
 * the armed state changed.
 */
export function toggleSolo(): boolean {
  armed.value = !armed.peek();
  return true;
}

/**
 * Disarm an armed solo. Returns true ONLY when solo was actually armed — the
 * keyboard Escape layer and selection-change transitions consume the boolean
 * so one Escape/transition handles at most one layer (D-04: popover dismiss ->
 * push disarm -> solo disarm -> selection collapse).
 */
export function disarmSolo(): boolean {
  if (!armed.peek()) return false;
  armed.value = false;
  return true;
}
