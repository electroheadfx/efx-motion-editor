/**
 * D-16 pilot (52.2-15, sensitivity-map rows 2 and 4): the Studio-side flush as
 * ONE serialized drain, built on plan 14's declared lifecycle and bounded queue.
 *
 * Why one drain: the two flush callers (the main-window request listener and the
 * Studio's close path) each ran their own inline settle → capture-flush →
 * documentSync-push sequence, so two overlapping requests ran two pushes
 * (T-52.2-54) and a request issued mid-gesture started its steps before the
 * gesture's queued capture had settled — the push could ship a document the
 * capture was about to change. The pipeline makes the round-trip one owned
 * operation:
 *
 *   - JOIN: while a drain is in flight, every further request resolves with the
 *     SAME outcome — one drain, one push, however many callers ask.
 *   - GESTURE WAIT: the drain first forces the queue's gate and waits out the
 *     gesture's queued captures, so the steps run against settled pixels.
 *   - ORDER: the caller's steps run in the order given, between the two drains.
 *   - SETTLEMENT: a throwing step resolves `failed` with the error attached and
 *     an interrupted drain resolves `interrupted` — the promise never rejects,
 *     so the caller (the fail-closed facade catch) owns the only throw.
 *
 * Interruption races the forced drain itself: a port whose work never settles
 * must not wedge the pipeline (T-52.2-48) — the interrupt wake settles the
 * flush and the generation guard keeps the caller's steps from starting after.
 *
 * Boundary (D-17/D-19): this module imports pilot primitives only (no lib, no
 * stores, not the facade) and is reachable only through the Studio lazy
 * boundary.
 */
import { finalizationLifecycle, type FinalizationLifecycle } from './finalizationMachine';

export type FlushStatus = 'flushed' | 'interrupted' | 'failed';

export interface FlushOutcome {
  readonly status: FlushStatus;
  readonly completedSteps: number;
  readonly error?: unknown;
}

export type FlushStep = () => void | Promise<void>;

export interface FlushRequest {
  readonly steps: ReadonlyArray<FlushStep>;
}

/** The queue port the drain drives (plan 14's bounded queue, forced-drain shape). */
export interface FlushQueuePort {
  /** A forced drain of the queued captures: opens their gate and settles them. */
  drain(): Promise<void>;
  interrupt?(): void;
}

export interface FlushPipeline {
  flush(request: FlushRequest): Promise<FlushOutcome>;
  interrupt(): void;
  readonly inFlight: boolean;
}

export interface FlushPipelineOptions {
  lifecycle?: FinalizationLifecycle;
  queue?: FlushQueuePort;
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

type PortDrain = { readonly ok: true } | { readonly ok: false; readonly error: unknown };

export function createFlushPipeline(options: FlushPipelineOptions = {}): FlushPipeline {
  const lifecycle = options.lifecycle ?? finalizationLifecycle;
  const port = options.queue;

  // The interruption ledger: `interrupt()` bumps the generation (so a drain's
  // steps stop at the next boundary) and wakes any drain parked on the port.
  let drainGeneration = 0;
  let interruptWake = deferred<void>();
  let active: Promise<FlushOutcome> | null = null;

  /** A port drain that reports instead of throwing: its failure is the flush's failure. */
  const drainPort = (): Promise<PortDrain> => port
    ? port.drain().then(
      () => ({ ok: true } as const),
      (error: unknown) => ({ ok: false, error } as const),
    )
    : Promise.resolve({ ok: true } as const);

  /**
   * The forced drain, raced against the interrupt wake. `null` means the drain
   * settled cleanly and the caller may proceed; an outcome means the flush is
   * already decided (interrupted or failed) and no step may run.
   */
  const awaitPortDrain = async (
    generation: number,
    completedSteps: number,
  ): Promise<FlushOutcome | null> => {
    const settled = await Promise.race([
      drainPort(),
      interruptWake.promise.then(() => 'wake' as const),
    ]);
    if (settled === 'wake') return { status: 'interrupted', completedSteps };
    if (!settled.ok) return { status: 'failed', completedSteps, error: settled.error };
    if (drainGeneration !== generation) return { status: 'interrupted', completedSteps };
    return null;
  };

  const runDrain = async (request: FlushRequest, generation: number): Promise<FlushOutcome> => {
    let completedSteps = 0;
    // One forced flush owns the lifecycle for the whole round-trip: it opens the
    // capture gate (and bypasses the quiet window in the queue port), which is
    // what lets a capture submitted mid-gesture settle rather than park.
    lifecycle.beginFlushing();
    try {
      const before = await awaitPortDrain(generation, completedSteps);
      if (before) return before;
      for (const step of request.steps) {
        if (drainGeneration !== generation) return { status: 'interrupted', completedSteps };
        await step();
        completedSteps += 1;
      }
      // The steps may have submitted captures of their own (the documentSync
      // push reads live pixels): the second drain settles them before the
      // round-trip reports `flushed`.
      const after = await awaitPortDrain(generation, completedSteps);
      if (after) return after;
      return { status: 'flushed', completedSteps };
    } catch (error) {
      return { status: 'failed', completedSteps, error };
    } finally {
      lifecycle.settleFlushing();
    }
  };

  return {
    flush(request) {
      // Join: the in-flight drain IS the answer — two overlapping callers share
      // one drain, one push and one outcome object.
      if (active) return active;
      const generation = drainGeneration;
      const promise = runDrain(request, generation);
      active = promise;
      const clear = (): void => {
        if (active === promise) active = null;
      };
      void promise.then(clear, clear);
      return promise;
    },
    interrupt() {
      drainGeneration += 1;
      port?.interrupt?.();
      const wake = interruptWake;
      interruptWake = deferred<void>();
      wake.resolve();
    },
    get inFlight() {
      return active !== null;
    },
  };
}
