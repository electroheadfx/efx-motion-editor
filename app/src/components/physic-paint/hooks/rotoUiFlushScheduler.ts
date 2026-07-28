/**
 * 38.1 D-04: scheduled-flag rAF UI flush scheduler.
 *
 * At most one flush is ever posted per animation frame: schedule() posts a
 * rAF only when none is pending (the guard check runs before any rAF post).
 * The LATEST scheduled flush wins (38.1 D-05 latest-wins): a schedule() call
 * made while a flush is pending replaces the pending flush, so the flush that
 * runs at fire time is the most recently scheduled one — matching the
 * latest-wins navigation contract — and fast clicking never queues more than
 * one UI render behind the canvas.
 */

export interface RotoUiFlushScheduler {
  schedule(flush: () => void): void;
  dispose(): void;
  isPending(): boolean;
}

export function createRotoUiFlushScheduler(): RotoUiFlushScheduler {
  let pendingId: number | null = null;
  let pendingFlush: (() => void) | null = null;

  function schedule(flush: () => void): void {
    pendingFlush = flush; // latest wins
    if (pendingId !== null) return;
    pendingId = requestAnimationFrame(() => {
      pendingId = null;
      const run = pendingFlush;
      pendingFlush = null;
      run?.();
    });
  }

  function dispose(): void {
    if (pendingId !== null) cancelAnimationFrame(pendingId);
    pendingId = null;
    pendingFlush = null;
  }

  function isPending(): boolean {
    return pendingId !== null;
  }

  return { schedule, dispose, isPending };
}

/**
 * 38.1 D-05: monotonic navigation generation tokens (latest-wins canvas).
 *
 * Discrete-click rule: a generation that is still latest ALWAYS paints; only
 * a generation superseded by a newer navigation skips. Supersession is the
 * only staleness criterion — no time-based or distance-based heuristics.
 */

export interface RotoNavigationGeneration {
  begin(): number;
  isLatest(generation: number): boolean;
}

export function createRotoNavigationGeneration(): RotoNavigationGeneration {
  let current = 0;

  function begin(): number {
    current += 1;
    return current;
  }

  function isLatest(generation: number): boolean {
    return generation === current;
  }

  return { begin, isLatest };
}
