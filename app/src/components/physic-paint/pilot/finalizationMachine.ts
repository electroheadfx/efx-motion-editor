/**
 * D-16 pilot (52.2-14, sensitivity-map row 1): the stroke-finalization
 * lifecycle as ONE declared machine, plus the signals bridge that projects its
 * snapshot onto a single Preact signal.
 *
 * Why a machine: four surfaces used to re-derive "is the Studio busy?" from a
 * promise-per-key map, a boolean `forceFlush`, an idle flag and a pointer set —
 * each with its own copy of the rules. The lifecycle is now declared once:
 *
 *   idle ──pointerdown──▶ active ──last pointer up──▶ queued
 *    ▲                                                 │ window elapsed
 *    │                                                 ▼
 *    └──────────── last work settled ──────────── draining
 *   idle/draining ──forced flush──▶ flushing ──settle──▶ (re-derived)
 *
 * Rules the table encodes (each one was previously implicit in a caller):
 *   - a new gesture always wins: pointerdown from queued OR draining enters
 *     active, so a running drain never swallows the next stroke;
 *   - `queued` is the silence window: `idleWindowElapsed` (the scheduler's
 *     timer, with zero pointers) is the only way out of it, and it lands in
 *     `draining` instead of `idle` while work is pending;
 *   - `markInteractionActive` (a throttled move) keeps its separate meaning —
 *     the producer's quiet-window clock — and does NOT move the machine;
 *   - `flushing` is only enterable with zero pointers and an elapsed window, so
 *     the projection below stays a pure function of the state name.
 *
 * Ownership split (52.2-14 Task 1): this module owns the lifecycle, the bridge
 * and the drain gate; the scheduler owns the wall-clock arming; the queue (Task
 * 2) owns the bounded turns. Every xstate import in the app lives here (D-17).
 */
import { signal, type Signal } from '@preact/signals';
import { createActor, setup, types, type Actor, type StateValue } from 'xstate';

export const FINALIZATION_STATES = ['idle', 'active', 'queued', 'draining', 'flushing'] as const;

export type FinalizationState = typeof FINALIZATION_STATES[number];

/** The states in which deferred finalization work may run. */
const DRAINABLE_STATES: ReadonlySet<FinalizationState> = new Set(['draining', 'flushing']);

/**
 * The states in which the interaction gate is open: zero pointers AND the
 * silence window elapsed. `interactionIdle` and the capture gate are this set.
 */
const SETTLED_STATES: ReadonlySet<FinalizationState> = new Set(['idle', 'draining', 'flushing']);

export function isFinalizationDrainable(state: FinalizationState): boolean {
  return DRAINABLE_STATES.has(state);
}

export function isFinalizationSettledState(state: FinalizationState): boolean {
  return SETTLED_STATES.has(state);
}

interface FinalizationContext {
  pointerCount: number;
  /** True while the interaction window is closed (a gesture is recent or in progress). */
  windowClosed: boolean;
  /** Captures submitted and not yet settled — keeps `idle` off the table. */
  pendingWork: number;
}

const initialContext: FinalizationContext = { pointerCount: 0, windowClosed: false, pendingWork: 0 };

const machineSetup = setup({
  schemas: {
    context: types<FinalizationContext>(),
    events: {
      POINTER_DOWN: types<{ pointerCount: number }>(),
      POINTER_UP: types<{ pointerCount: number }>(),
      IDLE_WINDOW_ELAPSED: types<void>(),
      WORK_QUEUED: types<void>(),
      WORK_SETTLED: types<void>(),
      FLUSH_BEGIN: types<void>(),
      FLUSH_SETTLED: types<void>(),
    },
  },
});

/**
 * The declared lifecycle. Exported so a later plan can read the transition table
 * without re-deriving it; consumers read `finalizationLifecycle.state` instead.
 */
export const strokeFinalizationMachine = machineSetup.createMachine({
  initial: { target: 'idle' },
  context: initialContext,
  states: {
    idle: {
      on: {
        POINTER_DOWN: { target: 'active', context: ({ event }) => ({ pointerCount: event.pointerCount, windowClosed: true }) },
        // A stray pointer-up (the engine reports a cancel for a pointer it never
        // saw go down) re-closes the gate for one window, exactly as the
        // hand-rolled scheduler did — the scheduler re-arms on every command.
        POINTER_UP: { target: 'queued', context: ({ event }) => ({ pointerCount: event.pointerCount, windowClosed: true }) },
        IDLE_WINDOW_ELAPSED: { context: () => ({ windowClosed: false }) },
        // Already settled: work starts right away (the queue still yields a
        // macrotask so a produce never runs ahead of pending input).
        WORK_QUEUED: { target: 'draining', context: ({ context }) => ({ pendingWork: context.pendingWork + 1 }) },
        WORK_SETTLED: { context: ({ context }) => ({ pendingWork: Math.max(0, context.pendingWork - 1) }) },
        FLUSH_BEGIN: { target: 'flushing' },
      },
    },
    active: {
      on: {
        POINTER_DOWN: { context: ({ event }) => ({ pointerCount: event.pointerCount, windowClosed: true }) },
        // The last pointer up closes the gesture; any remaining pointer keeps the
        // lifecycle active.
        POINTER_UP: ({ event }) => (event.pointerCount === 0
          ? { target: 'queued', context: { pointerCount: 0, windowClosed: true } }
          : { context: { pointerCount: event.pointerCount, windowClosed: true } }),
        WORK_QUEUED: { context: ({ context }) => ({ pendingWork: context.pendingWork + 1 }) },
        WORK_SETTLED: { context: ({ context }) => ({ pendingWork: Math.max(0, context.pendingWork - 1) }) },
        // No FLUSH_BEGIN: a forced flush never opens the idle gate mid-gesture.
        // The flush still drains (the caller's force flag bypasses the gate);
        // only the projected signal stays closed, exactly as before the pilot.
      },
    },
    queued: {
      on: {
        POINTER_DOWN: { target: 'active', context: ({ event }) => ({ pointerCount: event.pointerCount, windowClosed: true }) },
        POINTER_UP: { context: ({ event }) => ({ pointerCount: event.pointerCount, windowClosed: true }) },
        // The window elapsed: pending work opens the drain, otherwise the
        // lifecycle is idle.
        IDLE_WINDOW_ELAPSED: ({ context }) => ({
          target: context.pendingWork > 0 ? 'draining' : 'idle',
          context: { windowClosed: false },
        }),
        WORK_QUEUED: { context: ({ context }) => ({ pendingWork: context.pendingWork + 1 }) },
        WORK_SETTLED: { context: ({ context }) => ({ pendingWork: Math.max(0, context.pendingWork - 1) }) },
        // No FLUSH_BEGIN while the window is still closed: the flush drains
        // through the caller's force flag, and the gate opens on the window.
      },
    },
    draining: {
      on: {
        POINTER_DOWN: { target: 'active', context: ({ event }) => ({ pointerCount: event.pointerCount, windowClosed: true }) },
        POINTER_UP: { target: 'queued', context: ({ event }) => ({ pointerCount: event.pointerCount, windowClosed: true }) },
        IDLE_WINDOW_ELAPSED: { context: () => ({ windowClosed: false }) },
        WORK_QUEUED: { context: ({ context }) => ({ pendingWork: context.pendingWork + 1 }) },
        // The last settled turn returns the lifecycle to idle; earlier ones only
        // decrement the count.
        WORK_SETTLED: ({ context }) => (context.pendingWork <= 1
          ? { target: 'idle', context: { pendingWork: 0 } }
          : { context: { pendingWork: context.pendingWork - 1 } }),
        FLUSH_BEGIN: { target: 'flushing' },
      },
    },
    flushing: {
      on: {
        POINTER_DOWN: { target: 'active', context: ({ event }) => ({ pointerCount: event.pointerCount, windowClosed: true }) },
        POINTER_UP: { target: 'queued', context: ({ event }) => ({ pointerCount: event.pointerCount, windowClosed: true }) },
        IDLE_WINDOW_ELAPSED: { context: () => ({ windowClosed: false }) },
        WORK_QUEUED: { context: ({ context }) => ({ pendingWork: context.pendingWork + 1 }) },
        WORK_SETTLED: { context: ({ context }) => ({ pendingWork: Math.max(0, context.pendingWork - 1) }) },
        // Re-derive the settled state: a flush that left work behind re-opens the
        // drain (the gate already elapsed), otherwise the lifecycle is idle.
        FLUSH_SETTLED: ({ context }) => ({
          target: context.pendingWork > 0 ? 'draining' : 'idle',
          context: { windowClosed: false },
        }),
      },
    },
  },
});

export interface FinalizationLifecycle {
  /** The one lifecycle read: the machine's state, written once per transition. */
  readonly state: Signal<FinalizationState>;
  pointerDown(pointerCount: number): void;
  pointerUp(pointerCount: number): void;
  /** The scheduler's silence timer elapsed with zero pointers. */
  idleWindowElapsed(): void;
  workQueued(): void;
  workSettled(): void;
  beginFlushing(): void;
  settleFlushing(): void;
  /**
   * Resolves once deferred work may run. Already drainable resolves on the next
   * macrotask (never the microtask queue, so a produce cannot run ahead of
   * pending input); otherwise it resolves on the drainable transition.
   */
  waitUntilDrainable(): Promise<void>;
  stop(): void;
}

function isFinalizationState(value: unknown): value is FinalizationState {
  return typeof value === 'string' && (FINALIZATION_STATES as readonly string[]).includes(value);
}

/** The machine is flat (top-level states only), so the snapshot value is always a declared state name. */
function readStateValue(snapshot: { value: StateValue }): FinalizationState {
  const value = snapshot.value;
  return isFinalizationState(value) ? value : 'idle';
}

export function createFinalizationLifecycle(): FinalizationLifecycle {
  const actor: Actor<typeof strokeFinalizationMachine> = createActor(strokeFinalizationMachine);
  actor.start();
  const state = signal<FinalizationState>(readStateValue(actor.getSnapshot()));
  const drainWaiters = new Set<() => void>();

  const releaseDrainWaiters = (): void => {
    if (drainWaiters.size === 0) return;
    const waiters = [...drainWaiters];
    drainWaiters.clear();
    for (const resolve of waiters) resolve();
  };

  actor.select(readStateValue).subscribe((next) => {
    if (state.peek() !== next) state.value = next;
    if (isFinalizationDrainable(next)) releaseDrainWaiters();
  });

  return {
    state,
    pointerDown: (pointerCount) => {
      actor.trigger.POINTER_DOWN({ pointerCount });
    },
    pointerUp: (pointerCount) => {
      actor.trigger.POINTER_UP({ pointerCount });
    },
    idleWindowElapsed: () => {
      actor.trigger.IDLE_WINDOW_ELAPSED();
    },
    workQueued: () => {
      actor.trigger.WORK_QUEUED();
    },
    workSettled: () => {
      actor.trigger.WORK_SETTLED();
    },
    beginFlushing: () => {
      actor.trigger.FLUSH_BEGIN();
      // A forced flush drains regardless of the gate: the waiters are released
      // even when the machine declines the transition (active/queued), because
      // the caller's force flag is what actually bypasses the window.
      releaseDrainWaiters();
    },
    settleFlushing: () => {
      actor.trigger.FLUSH_SETTLED();
    },
    waitUntilDrainable: () => {
      if (isFinalizationDrainable(state.peek())) {
        return new Promise<void>((resolve) => {
          setTimeout(resolve, 0);
        });
      }
      return new Promise<void>((resolve) => {
        drainWaiters.add(resolve);
      });
    },
    stop: () => {
      // Dropped, not resolved: stopped waiters must never proceed to produce.
      drainWaiters.clear();
      actor.stop();
    },
  };
}

/** The app-wide lifecycle. The scheduler drives it; nothing else owns it. */
export const finalizationLifecycle = createFinalizationLifecycle();
