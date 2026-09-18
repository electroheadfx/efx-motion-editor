/**
 * D-16 pilot (52.2-14, sensitivity-map row 3): the capture produce/commit
 * scheduler as a bounded, interruptible Effect v4 queue.
 *
 * Why a queue: the promise-per-key map this replaces had no bound, no
 * backpressure and no cancellation — every capture ran the moment its key was
 * touched, so a stroke train accumulated ~9 s median waits (the committed
 * 2026-09-11 telemetry), and a navigation that ended the flow could still see
 * a superseded encode commit its pixels. The queue gives that work the three
 * properties the map could not express:
 *
 *   - BOUNDED TURNS: at most `concurrency` turns produce/commit at once; the
 *     turns wait on a bounded `Queue` of slots, so the bound is the queue's
 *     own capacity, not a counter the caller maintains.
 *   - BACKPRESSURE: a submit past the bound suspends on the slot queue and
 *     settles only once a slot frees — the queue cannot grow past its bound.
 *   - INTERRUPTION: `interrupt()` cancels the live turns. A cancelled turn's
 *     `commit` is unreachable: its fiber is interrupted (the continuation past
 *     the produce never runs) and its generation is stale, so the commit stage
 *     is skipped even if the produce settles later.
 *
 * The gate is the declared lifecycle, not a caller flag: a turn waits for the
 * machine's drainable transition (`draining`/`flushing`) and for the turn's own
 * quiescence window, and a forced flush (`beginFlush`) opens both immediately —
 * which is what navigation/close/save/export need. Every xstate/effect import
 * in the app lives under `physic-paint/pilot/` (D-17); this module is reachable
 * only through the Studio lazy boundary (D-19).
 */
import { Effect, Fiber, Queue } from 'effect';
import { readLastInteractionAt } from '../bridge/gestureIdleScheduler';
import { finalizationLifecycle, isFinalizationDrainable, type FinalizationLifecycle } from './finalizationMachine';

/** Turns allowed to produce/commit at once. Exported so callers and tests never re-declare it. */
export const FINALIZATION_TURN_CONCURRENCY = 2;

/** The point in a turn's life the still-wanted guard is asked about. */
export type FinalizationTurnStage = 'before-produce' | 'before-commit';

export type FinalizationTurnOutcome = 'committed' | 'rejected' | 'stale' | 'cancelled' | 'failed';

export interface FinalizationTurn<T> {
  /** Stage 1 — never entered for a cancelled or no-longer-wanted turn. */
  produce: () => T | Promise<T>;
  /** Stage 2 — never entered for a cancelled, failed or no-longer-wanted turn. */
  commit?: (value: T) => void | boolean | Promise<void | boolean>;
  /** Re-checked before producing and again before committing; false skips the turn. */
  isStillWanted?: (stage: FinalizationTurnStage) => boolean;
  /** Silence required since the last interaction before this turn may produce. */
  quiescenceMs?: number;
}

export interface FinalizationQueueOptions {
  concurrency?: number;
  /** The lifecycle gate; defaults to the app-wide machine. Injectable for tests (§3.8). */
  lifecycle?: FinalizationLifecycle;
}

export interface FinalizationQueue {
  submit<T>(turn: FinalizationTurn<T>): Promise<FinalizationTurnOutcome>;
  /** Resolves once every accepted turn has settled — cancelled, stale, failed or committed. */
  drain(): Promise<void>;
  /** Opens the gate and bypasses the quiescence windows until the flush settles. */
  beginFlush(): () => void;
  /** `beginFlush()` + drain + release, for the callers that flush everything. */
  flush(): Promise<void>;
  /** Cancels the live turns: a cancelled turn never commits. */
  interrupt(): void;
  stop(): void;
  readonly inFlight: number;
}

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

type Produced<T> = { readonly ok: true; readonly value: T } | { readonly ok: false };

interface LiveTurn {
  cancel(): void;
}

export function createFinalizationQueue(options: FinalizationQueueOptions = {}): FinalizationQueue {
  const concurrency = Math.max(1, Math.floor(options.concurrency ?? FINALIZATION_TURN_CONCURRENCY));
  const lifecycle = options.lifecycle ?? finalizationLifecycle;

  // The slot pool IS the concurrency bound: a turn holds one token for the
  // whole produce/commit window, and a turn with no token is suspended on the
  // queue — the backpressure the caller's promise-per-key map never had.
  const slots = Effect.runSync(Queue.bounded<number>(concurrency));
  for (let token = 0; token < concurrency; token += 1) Effect.runSync(Queue.offer(slots, token));

  const inFlight = new Set<Promise<FinalizationTurnOutcome>>();
  const liveTurns = new Set<LiveTurn>();
  let flushDepth = 0;
  let flushSignal = deferred<void>();
  let generation = 0;
  let stopped = false;

  /** The gate: the machine's drain, the turn's quiescence window, or a forced flush. */
  const waitForGate = async <T>(turn: FinalizationTurn<T>): Promise<'ready' | 'stale'> => {
    for (;;) {
      if (flushDepth > 0) return 'ready';
      // The machine's wait IS the yield: a macrotask when the lifecycle is
      // already drainable — so a turn never starts producing ahead of work
      // submitted in the same task, which must still be able to supersede it —
      // otherwise a park on the drainable transition.
      await lifecycle.waitUntilDrainable();
      if (flushDepth > 0) return 'ready';
      if (!isFinalizationDrainable(lifecycle.state.peek())) continue;
      if (turn.isStillWanted && !turn.isStillWanted('before-produce')) return 'stale';
      const quiescenceMs = turn.quiescenceMs ?? 0;
      if (quiescenceMs > 0) {
        const quietFor = performance.now() - readLastInteractionAt();
        if (quietFor < quiescenceMs) {
          // The wait is flush-interruptible: save/export/navigation must not sit
          // out the remaining quiet window before they can drain.
          await Promise.race([sleep(quiescenceMs - quietFor), flushSignal.promise]);
          continue;
        }
      }
      return 'ready';
    }
  };

  const releaseFlush = (): void => {
    flushDepth -= 1;
    if (flushDepth === 0) lifecycle.settleFlushing();
  };

  const beginFlush = (): (() => void) => {
    flushDepth += 1;
    lifecycle.beginFlushing();
    const signal = flushSignal;
    flushSignal = deferred<void>();
    signal.resolve();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      releaseFlush();
    };
  };

  const drain = async (): Promise<void> => {
    while (inFlight.size > 0) {
      await Promise.allSettled([...inFlight]);
    }
  };

  const interrupt = (): void => {
    // The generation bump is the structural guarantee: a turn whose produce is
    // already running can no longer pass the pre-commit guard.
    generation += 1;
    const turns = [...liveTurns];
    for (const turn of turns) turn.cancel();
    // Waking the quiescence races lets the cancelled turns reach their
    // settlement instead of waiting out a window that no longer matters.
    const signal = flushSignal;
    flushSignal = deferred<void>();
    signal.resolve();
  };

  const submit = <T>(turn: FinalizationTurn<T>): Promise<FinalizationTurnOutcome> => {
    if (stopped) return Promise.resolve<FinalizationTurnOutcome>('cancelled');
    const turnGeneration = generation;
    const settlement = deferred<FinalizationTurnOutcome>();
    let outcome: FinalizationTurnOutcome = 'cancelled';
    let heldSlot: number | null = null;
    let done = false;

    const release = (): void => {
      if (done) return;
      done = true;
      inFlight.delete(settlement.promise);
      liveTurns.delete(record);
      // The pair of the `workQueued` below: the machine's pendingWork returns
      // to zero, so the drain can hand the lifecycle back to `idle`.
      lifecycle.workSettled();
      settlement.resolve(outcome);
    };

    const program = Effect.gen(function* () {
      const gate = yield* Effect.promise(() => waitForGate(turn));
      if (gate === 'stale') {
        outcome = 'stale';
        return;
      }
      if (turnGeneration !== generation) return;
      heldSlot = yield* Queue.take(slots);
      // The thunk never rejects: a produce failure is DATA (`{ ok: false }`),
      // not a typed Effect error — the turn settles `failed` and the queue
      // keeps accepting. (v4's `tryPromise` `catch` maps into the error
      // channel, so the fiber would die instead of reporting the turn.)
      const produced = yield* Effect.promise(async (): Promise<Produced<T>> => {
        try {
          return { ok: true, value: await turn.produce() };
        } catch {
          return { ok: false };
        }
      });
      if (!produced.ok) {
        outcome = 'failed';
        return;
      }
      if (turnGeneration !== generation) return;
      if (turn.isStillWanted && !turn.isStillWanted('before-commit')) {
        outcome = 'stale';
        return;
      }
      if (!turn.commit) {
        outcome = 'committed';
        return;
      }
      // Same never-rejecting shape: a throwing commit reports `rejected`, it
      // does not turn the turn into a failed fiber.
      const accepted = yield* Effect.promise(async () => {
        try {
          return await turn.commit?.(produced.value);
        } catch {
          return false;
        }
      });
      outcome = accepted === false ? 'rejected' : 'committed';
    }).pipe(
      Effect.ensuring(
        Effect.gen(function* () {
          const slot = heldSlot;
          heldSlot = null;
          if (slot !== null) yield* Queue.offer(slots, slot);
          // The single settlement point: success, failure, interruption and
          // stop all land here, exactly once per turn.
          yield* Effect.sync(release);
        }),
      ),
    );

    // The work is registered with the machine and with the drain ledger before
    // the fiber starts: the gate sees pending work even when the turn is
    // submitted mid-gesture, and a settlement can never race an unregistered
    // promise (which would leave `drain()` waiting on a turn it never saw).
    lifecycle.workQueued();
    let interruptFiber: (() => void) | null = null;
    const record: LiveTurn = {
      cancel: () => {
        interruptFiber?.();
      },
    };
    liveTurns.add(record);
    inFlight.add(settlement.promise);
    const fiber = Effect.runFork(program);
    interruptFiber = () => {
      // Fire-and-forget: the turn reports its own settlement through its promise.
      void Effect.runPromise(Fiber.interrupt(fiber)).catch(() => undefined);
    };
    return settlement.promise;
  };

  return {
    submit,
    drain,
    beginFlush,
    async flush() {
      const release = beginFlush();
      try {
        await drain();
      } finally {
        release();
      }
    },
    interrupt,
    stop() {
      stopped = true;
      interrupt();
    },
    get inFlight() {
      return inFlight.size;
    },
  };
}
