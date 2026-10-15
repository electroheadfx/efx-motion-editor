/**
 * Bake host — the ported `finalizationQueue` pattern (D-21 / HOST-04).
 *
 * Effect v4 bounded-turn queue with a slot-pool concurrency bound (shape of
 * `Queue.bounded`), generation-stale commit guard (a cancelled turn never
 * commits), `beginFlush` forced-flush escape, and never-rejecting produce/
 * commit (a bad bake is DATA, not a dead fiber).
 *
 * What is NOT ported (D-17 / PATTERNS): app lifecycle — `finalizationLifecycle`,
 * `isFinalizationDrainable`, `readLastInteractionAt`, the gesture idle
 * scheduler. The host is UI-free and Preact-free; it needs no Studio machine.
 *
 * No Web Worker. No new cancellation model beyond the ported bounded-queue +
 * dispose-abort pattern.
 *
 * The two bake semantics D-21 names are the unit-tested host contract:
 *   - PlayScript bake (`mode: 'abort-on-dispose'`, the default) ABORTS on
 *     `dispose()` — a cancelled turn never commits.
 *   - Long cuisson bakes (`mode: 'flush-survives-navigation'`) SURVIVE
 *     `dispose()`; `beginFlush` / `flush` is the navigation escape that lets
 *     them finish.
 *
 * DEFERRAL (explicit, 55-07): `createBakeHost` is the Phase 56 consumer API.
 * No app/ bake path is rewired to it this phase — PlayScript stays on
 * `finalizationQueue` (its existing dispose-abort / flush-survives-navigation
 * semantics already match D-21). Wiring PlayScript through `createBakeHost` is
 * Phase 56 engine-2 scope.
 */
import { Effect, Fiber, Queue } from 'effect';

/** Turns allowed to produce/commit at once. Exported so callers and tests never re-declare it. */
export const BAKE_TURN_CONCURRENCY = 2;

/** The point in a turn's life the still-wanted guard is asked about. */
export type BakeTurnStage = 'before-produce' | 'before-commit';

export type BakeTurnOutcome = 'committed' | 'rejected' | 'stale' | 'cancelled' | 'failed';

/**
 * D-21 bake semantics.
 *   - `abort-on-dispose` (PlayScript): `dispose()` cancels the turn.
 *   - `flush-survives-navigation` (long cuisson): `dispose()` does not cancel
 *     the turn; `beginFlush`/`flush` lets it finish across a navigation.
 */
export type BakeTurnMode = 'abort-on-dispose' | 'flush-survives-navigation';

export interface BakeHostTurn<T> {
  /** Stage 1 — never entered for a cancelled or no-longer-wanted turn. */
  produce: () => T | Promise<T>;
  /** Stage 2 — never entered for a cancelled, failed or no-longer-wanted turn. */
  commit?: (value: T) => void | boolean | Promise<void | boolean>;
  /** Re-checked before producing and again before committing; false skips the turn. */
  isStillWanted?: (stage: BakeTurnStage) => boolean;
  /** D-21 bake semantics; defaults to PlayScript's `abort-on-dispose`. */
  mode?: BakeTurnMode;
}

export interface BakeHostOptions {
  concurrency?: number;
}

export interface BakeHost {
  submit<T>(turn: BakeHostTurn<T>): Promise<BakeTurnOutcome>;
  /** Resolves once every accepted turn has settled — cancelled, stale, failed or committed. */
  drain(): Promise<void>;
  /** Forced-flush escape: opens the flush window; returns a once-only release. */
  beginFlush(): () => void;
  /** `beginFlush()` + drain + release, for the callers that flush everything. */
  flush(): Promise<void>;
  /** Cancels every live turn (both modes): a cancelled turn never commits. */
  interrupt(): void;
  /**
   * PlayScript dispose: stops accepting work and cancels `abort-on-dispose`
   * turns. `flush-survives-navigation` turns keep running (D-21).
   */
  dispose(): void;
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

type Produced<T> = { readonly ok: true; readonly value: T } | { readonly ok: false };

interface LiveTurn {
  cancel(): void;
  readonly mode: BakeTurnMode;
}

export function createBakeHost(options: BakeHostOptions = {}): BakeHost {
  const concurrency = Math.max(1, Math.floor(options.concurrency ?? BAKE_TURN_CONCURRENCY));

  // The slot pool IS the concurrency bound: a turn holds one token for the
  // whole produce/commit window, and a turn with no token is suspended on the
  // queue — backpressure the caller's promise-per-key map never had (D-21).
  const slots = Effect.runSync(Queue.bounded<number>(concurrency));
  for (let token = 0; token < concurrency; token += 1) Effect.runSync(Queue.offer(slots, token));

  const inFlight = new Set<Promise<BakeTurnOutcome>>();
  const liveTurns = new Set<LiveTurn>();
  let flushDepth = 0;
  let generation = 0;
  let stopped = false;

  const beginFlush = (): (() => void) => {
    flushDepth += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      flushDepth -= 1;
    };
  };

  const drain = async (): Promise<void> => {
    while (inFlight.size > 0) {
      await Promise.allSettled([...inFlight]);
    }
  };

  const cancelLiveTurns = (predicate: (turn: LiveTurn) => boolean, bumpGeneration: boolean): void => {
    const toCancel = [...liveTurns].filter(predicate);
    if (toCancel.length === 0) return;
    // The generation bump is the structural guarantee: a cancelled turn whose
    // produce is already running can no longer pass the pre-commit guard (D-21).
    // Only bump when turns are actually cancelled — a dispose that leaves
    // flush-survives-navigation turns running must not invalidate THEIR generation.
    if (bumpGeneration) generation += 1;
    for (const turn of toCancel) turn.cancel();
  };

  const interrupt = (): void => {
    cancelLiveTurns(() => true, true);
  };

  const dispose = (): void => {
    stopped = true;
    // PlayScript bake aborts on dispose; long cuisson bakes survive (D-21).
    // Per-turn fiber interrupt is the cancellation — no global generation bump,
    // so a running flush-survives-navigation turn stays generation-valid.
    cancelLiveTurns((turn) => turn.mode === 'abort-on-dispose', false);
  };

  const submit = <T>(turn: BakeHostTurn<T>): Promise<BakeTurnOutcome> => {
    const mode: BakeTurnMode = turn.mode ?? 'abort-on-dispose';
    if (stopped && mode === 'abort-on-dispose') return Promise.resolve<BakeTurnOutcome>('cancelled');
    // A disposed host still accepts flush-survives-navigation work so a
    // navigation flush can finish what it started (D-21).
    if (stopped && mode === 'flush-survives-navigation' && flushDepth === 0) {
      return Promise.resolve<BakeTurnOutcome>('cancelled');
    }

    const turnGeneration = generation;
    const settlement = deferred<BakeTurnOutcome>();
    let outcome: BakeTurnOutcome = 'cancelled';
    let heldSlot: number | null = null;
    let done = false;

    const release = (): void => {
      if (done) return;
      done = true;
      inFlight.delete(settlement.promise);
      liveTurns.delete(record);
      settlement.resolve(outcome);
    };

    const program = Effect.gen(function* () {
      // Host has no Studio lifecycle gate: the wait IS the slot take, and the
      // pre-produce yield is a macrotask so a supersede can still land first
      // (skill §7 — the machine's wait IS the yield; here the slot is the wait).
      yield* Effect.promise(() => Promise.resolve());
      if (turnGeneration !== generation) return;
      if (turn.isStillWanted && !turn.isStillWanted('before-produce')) {
        outcome = 'stale';
        return;
      }
      heldSlot = yield* Queue.take(slots);
      // The thunk never rejects: a produce failure is DATA (`{ ok: false }`),
      // not a typed Effect error — the turn settles `failed` and the queue
      // keeps accepting (skill §5).
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
      // Same never-rejecting shape: a throwing commit reports `rejected`.
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
          // dispose all land here, exactly once per turn.
          yield* Effect.sync(release);
        }),
      ),
    );

    let interruptFiber: (() => void) | null = null;
    const record: LiveTurn = {
      mode,
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
    dispose,
    get inFlight() {
      return inFlight.size;
    },
  };
}
