/**
 * D-16 pilot (52.2-14, sensitivity-map row 3): the capture produce/commit
 * scheduler as a bounded, interruptible Effect v4 queue.
 *
 * RED stub (52.2-14 Task 2): the declared API surface with none of the
 * behavior, so `finalizationQueue.test.ts` fails on its assertions. The
 * implementation lands in the GREEN step.
 */
import type { FinalizationLifecycle } from './finalizationMachine';

/** Turns allowed to run at once. Exported so callers and tests never re-declare it. */
export const FINALIZATION_TURN_CONCURRENCY = 2;

/** The point in a turn's life the still-wanted guard is asked about. */
export type FinalizationTurnStage = 'before-produce' | 'before-commit';

export type FinalizationTurnOutcome = 'committed' | 'rejected' | 'stale' | 'cancelled' | 'failed';

export interface FinalizationTurn<T> {
  produce: () => T | Promise<T>;
  commit?: (value: T) => void | boolean | Promise<void | boolean>;
  isStillWanted?: (stage: FinalizationTurnStage) => boolean;
  quiescenceMs?: number;
}

export interface FinalizationQueueOptions {
  concurrency?: number;
  lifecycle?: FinalizationLifecycle;
}

export interface FinalizationQueue {
  submit<T>(turn: FinalizationTurn<T>): Promise<FinalizationTurnOutcome>;
  drain(): Promise<void>;
  flush(): Promise<void>;
  interrupt(): void;
  stop(): void;
  readonly inFlight: number;
}

export function createFinalizationQueue(options: FinalizationQueueOptions = {}): FinalizationQueue {
  void options;
  return {
    submit: () => Promise.resolve<FinalizationTurnOutcome>('cancelled'),
    drain: () => Promise.resolve(),
    flush: () => Promise.resolve(),
    interrupt: () => {},
    stop: () => {},
    inFlight: 0,
  };
}
