import { signal } from '@preact/signals';
import { finalizationLifecycle, isFinalizationSettledState } from '../pilot/finalizationMachine';

/**
 * 52.1 (gesture-idle scheduler): a single source of truth for "is the user
 * currently interacting with the Studio (stroke, rail drag, move/deform)?".
 *
 * The post-gesture burst (physics settle + encode + apply + documentSync +
 * save) was scheduled by four independent timers, none of which knew the next
 * gesture had started — the 2s documentSync/auto-save debounces fired on a
 * fixed timer regardless of a new stroke, so the serialize (~191ms) + base64 +
 * emitTo ran mid-stroke. This module gates all of that heavy work on ONE idle
 * transition.
 *
 * 52.2-14 (D-16 pilot): the lifecycle itself now lives in the declared machine
 * (`physic-paint/pilot/finalizationMachine.ts`) so the capture queue and the
 * flush path read the same states this signal projects. This module keeps what
 * it always owned — the pointer set, the wall-clock arming and the re-arm rule
 * — and every public export is unchanged:
 *
 *   - `activePointers` tracks every pointer that has gone down but not yet
 *     up/cancelled (engine pointerdown/up/cancel + each drag hook's down/up);
 *     the machine receives the resulting count, never the raw set.
 *   - `interactionIdle` flips true ONLY when the lifecycle is settled (zero
 *     active pointers AND GESTURE_IDLE_WINDOW_MS of silence since the last
 *     down/move/up/cancel) — the machine's idle/draining/flushing states. A 2s
 *     drag re-arms the timer on throttled pointermove and is additionally
 *     blocked by the non-empty pointer set, so it can never flip idle
 *     mid-drag. The write is a projection of the machine snapshot: one write
 *     per transition, never a per-consumer derivation.
 *
 * FLUSH TRIGGERS (every path that must drain queued captures + documentSync):
 *   1. Idle        — this scheduler flips `interactionIdle` (normal path).
 *   2. Navigation  — `navigateToSyncedFrame` forces a flush (existing).
 *   3. Close       — `usePhysicsPaintCloseFlush` forces a flush (existing).
 *   4. Save (.mce) — main-window flush round-trip (commit 2).
 *   5. Export      — main-window flush round-trip (commit 2).
 *
 * CONSCIOUS UX DELTA: during continuous painting the parent mirror (main-window
 * preview) is stale by up to GESTURE_IDLE_WINDOW_MS + the flush burst. That is
 * the intended trade — the Studio canvas stays live, the parent catches up at
 * idle.
 *
 * CRASH-RECOVERY DELTA: the sessionStorage checkpoint is written inside the
 * documentSync push, so it moves with the idle-gated push. This is strictly
 * fresher than the prior 2s debounce (which kept resetting during continuous
 * painting and could be stale by the whole session); the checkpoint now lands
 * GESTURE_IDLE_WINDOW_MS after the last pointer interaction.
 */
export const GESTURE_IDLE_WINDOW_MS = 400;
export const GESTURE_MOVE_REARM_THROTTLE_MS = 150;

const activePointers = new Set<number>();
/** Subscribing signal read for the idle-gated documentSync effect. */
export const interactionIdle = signal(true);
const idleListeners = new Set<() => void>();
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let lastMoveRearm = 0;
/** Wall-clock of the last pointer down/move/up/cancel — the capture producer's quiet-window clock (52.1 Part 3). -Infinity = no interaction yet (always quiet). */
let lastInteractionAt = Number.NEGATIVE_INFINITY;

/**
 * The projection: the idle boolean IS the machine's settled set, so every
 * consumer reads one signal that the lifecycle wrote, not a rule it re-derived.
 * `peek()` keeps this effect from subscribing to the signal it writes.
 */
finalizationLifecycle.state.subscribe((state) => {
  const settled = isFinalizationSettledState(state);
  if (interactionIdle.peek() === settled) return;
  interactionIdle.value = settled;
  if (!settled) return;
  for (const listener of idleListeners) listener();
});

function armIdleTimer(): void {
  if (idleTimer !== null) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (activePointers.size === 0) finalizationLifecycle.idleWindowElapsed();
  }, GESTURE_IDLE_WINDOW_MS);
}

/** pointerdown — a new pointer is active; the gate closes. */
export function beginInteraction(pointerId: number): void {
  activePointers.add(pointerId);
  finalizationLifecycle.pointerDown(activePointers.size);
  lastInteractionAt = performance.now();
  armIdleTimer();
}

/** pointermove (throttled) — re-arms the silence timer during a long drag. */
export function markInteractionActive(): void {
  const now = performance.now();
  lastInteractionAt = now;
  if (now - lastMoveRearm < GESTURE_MOVE_REARM_THROTTLE_MS) return;
  lastMoveRearm = now;
  armIdleTimer();
}

/** pointerup / pointercancel — a pointer is no longer active. */
export function endInteraction(pointerId: number): void {
  activePointers.delete(pointerId);
  finalizationLifecycle.pointerUp(activePointers.size);
  lastInteractionAt = performance.now();
  armIdleTimer();
}

/** Non-subscribing read of the last interaction wall-clock (non-throttled — includes moves between throttle windows). */
export function readLastInteractionAt(): number {
  return lastInteractionAt;
}

/** Non-subscribing read for the push/capture paths (must not create subscriptions). */
export function readInteractionIdle(): boolean {
  return interactionIdle.peek();
}

/** Subscribe to the idle transition. Returns an unsubscribe function. */
export function onInteractionIdle(listener: () => void): () => void {
  idleListeners.add(listener);
  return () => {
    idleListeners.delete(listener);
  };
}
