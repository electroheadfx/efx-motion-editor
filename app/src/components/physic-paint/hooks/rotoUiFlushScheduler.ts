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
