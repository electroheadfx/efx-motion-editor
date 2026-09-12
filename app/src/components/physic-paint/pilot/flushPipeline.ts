/**
 * D-16 pilot (52.2-15, sensitivity-map rows 2 and 4): the Studio-side flush as
 * ONE serialized drain, built on plan 14's declared lifecycle and bounded queue.
 *
 * RED stub (TDD): the exported surface and its types are final; the body is the
 * naive inline runner the pilot replaces — no join, no gesture wait, no
 * interruption, no never-reject settlement.
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

export function createFlushPipeline(options: FlushPipelineOptions = {}): FlushPipeline {
  const lifecycle = options.lifecycle ?? finalizationLifecycle;
  void lifecycle;
  void options.queue;

  return {
    async flush(request) {
      let completedSteps = 0;
      for (const step of request.steps) {
        await step();
        completedSteps += 1;
      }
      return { status: 'flushed', completedSteps };
    },
    interrupt() {},
    get inFlight() {
      return false;
    },
  };
}
