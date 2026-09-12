/**
 * RED stub (52.2-14 Task 1) — the declared API surface with none of the
 * behavior. The machine implementation replaces this in the GREEN step, so the
 * new suite must fail against the stub and pass against the real lifecycle.
 */
import { signal, type Signal } from '@preact/signals';

export const FINALIZATION_STATES = ['idle', 'active', 'queued', 'draining', 'flushing'] as const;

export type FinalizationState = typeof FINALIZATION_STATES[number];

export function isFinalizationDrainable(state: FinalizationState): boolean {
  return state !== 'idle' && state !== 'active' && state !== 'queued';
}

export function isFinalizationSettledState(state: FinalizationState): boolean {
  return !isFinalizationDrainable(state);
}

export interface FinalizationLifecycle {
  readonly state: Signal<FinalizationState>;
  pointerDown(pointerCount: number): void;
  pointerUp(pointerCount: number): void;
  idleWindowElapsed(): void;
  workQueued(): void;
  workSettled(): void;
  beginFlushing(): void;
  settleFlushing(): void;
  waitUntilDrainable(): Promise<void>;
  stop(): void;
}

export function createFinalizationLifecycle(): FinalizationLifecycle {
  const state = signal<FinalizationState>('idle');
  return {
    state,
    pointerDown: () => {},
    pointerUp: () => {},
    idleWindowElapsed: () => {},
    workQueued: () => {},
    workSettled: () => {},
    beginFlushing: () => {},
    settleFlushing: () => {},
    waitUntilDrainable: () => Promise.resolve(),
    stop: () => {},
  };
}

export const finalizationLifecycle = createFinalizationLifecycle();
