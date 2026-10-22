import { signal } from '@preact/signals';

/**
 * Session-only global Solo (261022-iff, D-14/D-16/D-20 carry-over). The armed
 * flag lives in a focused sibling module so armed state never enters
 * PhysicsPaintStudio.tsx logic and is NEVER persisted, serialized, or part of
 * any document/history snapshot — save/reopen always starts disarmed. The
 * strip consumes the signal for paint only (armed tint, aria-pressed, capsule
 * line).
 *
 * ONE Solo concept: the playback-pill button solos the SELECTED (active)
 * track — the monitor and the flattened delivery show only that track's
 * content, and the armed state follows the selection live. It is monitor-only:
 * it never mutates the document, never gates edits, and never opens a playback
 * window (the former rail-solo window is gone, 261022-iff Task 3).
 *
 * Solo is an arm, not a transport command: toggling arms the filter; the user
 * presses Play (or playback continues). Arming never starts or stops
 * transport.
 *
 * Persistence (261022-mne): the arm is scoped to the Studio session and
 * survives frame navigation, playback, selection changes of any kind
 * (active-track changes, key/loop rails, rail sets, spacing proxies, Select
 * All), and mutation locks — including the script navigation lock that every
 * frame move flips. Selecting a different track moves the focus instead of
 * ending the arm. Exactly four boundaries end it: a re-click of the pill, the
 * keyboard Escape layer (one Escape, one layer), a launch replacement, and the
 * Studio unmount.
 *
 * Unlike the Push tool there is no commit-in-flight guard: solo is not a
 * mutation tool and never gates mutations (D-14).
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
 * keyboard Escape layer consumes the boolean so one Escape handles at most one
 * layer (D-04: popover dismiss -> push disarm -> solo disarm -> selection
 * collapse). Selection changes never call this (261022-mne).
 */
export function disarmSolo(): boolean {
  if (!armed.peek()) return false;
  armed.value = false;
  return true;
}
