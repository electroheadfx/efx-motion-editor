/**
 * 38.1 D-04: scheduled-flag rAF UI flush scheduler.
 *
 * At most one flush is ever posted per animation frame: schedule() returns
 * immediately when a flush is already pending (the guard check runs before
 * any rAF post). Each flush therefore reads the latest state at fire time,
 * so fast clicking never queues more than one UI render behind the canvas.
 */

export interface RotoUiFlushScheduler {
  schedule(flush: () => void): void;
  dispose(): void;
  isPending(): boolean;
}

export function createRotoUiFlushScheduler(): RotoUiFlushScheduler {
  let pendingId: number | null = null;

  function schedule(flush: () => void): void {
    if (pendingId !== null) return;
    pendingId = requestAnimationFrame(() => {
      pendingId = null;
      flush();
    });
  }

  function dispose(): void {
    if (pendingId === null) return;
    cancelAnimationFrame(pendingId);
    pendingId = null;
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
