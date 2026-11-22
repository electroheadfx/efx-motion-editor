import type { PaintDocumentLight } from '../../../efx-paint/document/efxPaintDocument';
import { lightSignature } from './physicsPaintStudioSettings';

/**
 * 64-19 (CR-01 / MED-17): one bounded re-bake per light change, through the
 * shipped Apply seam. A light change now misses the committed-frame cache
 * (the coordinator keys every real-frame revision on the light), but the
 * VISIBLE settled frame must also be re-baked — deterministically, once —
 * or the sheet holds the previous shading until an unrelated render.
 *
 * The controller is a UI nicety, never a failure source: a rejected run is
 * swallowed, and the scheduler owns the bounds (one in flight, at most one
 * queued follow-up, one automatic follow-up for a busy `false`).
 */
export interface SingleFlightRelight {
  /** Ask for a re-bake against the CURRENT document state (coalesced). */
  request: () => void;
  /** Resolves once the in-flight run, any queued follow-up and any parked request completed. */
  settle: () => Promise<void>;
  /**
   * 64-27 (WR-04): tell the scheduler the caller cannot bake right now
   * (playing, Draft, wireframe). A request during the block is PARKED instead
   * of being discovered as a busy `false`: nothing starts, and the
   * blocked-to-idle edge drains the parked request exactly once.
   */
  setBlocked: (blocked: boolean) => void;
}

/**
 * True when the light the visible committed frame would be re-baked under
 * differs from the last signature a sync recorded. Both sides go through the
 * canonical `lightSignature` — an absent light and an explicit DEFAULT_LIGHT
 * are ONE picture, so neither requests a bake.
 */
export function lightChangeNeedsRelight(
  previousSignature: string,
  nextLight: PaintDocumentLight | undefined,
): boolean {
  return previousSignature !== lightSignature(nextLight);
}

/**
 * The bounded scheduler. One run in flight; any number of requests during it
 * collapse into ONE queued follow-up (queued-latest — `run` reads the live
 * document at call time, so the scheduler carries no state of its own); a
 * rejected run is swallowed and never auto-retried; a run that resolves
 * `false` (the Apply lane is busy) grants exactly ONE automatic follow-up,
 * then stops. No timers, no unbounded retries.
 *
 * 64-27 (WR-04): an EXTERNAL refusal is the caller's knowledge, not a busy
 * result. While `setBlocked(true)` holds, nothing starts and any number of
 * requests collapse into ONE parked request; the blocked-to-idle edge drains
 * it through the same single-run-in-flight path a request takes — never
 * beside a run. A refusal therefore no longer spends the follow-up budget
 * and is never silently dropped.
 */
export function createSingleFlightRelight(run: () => Promise<boolean>): SingleFlightRelight {
  let inFlight = false;
  let queued = false;
  // True once this burst has spent its automatic follow-up — a busy `false`
  // grants exactly one, a rejection none.
  let followUpUsed = false;
  // 64-27 (WR-04): the external refusal and the ONE request parked under it.
  // While `blocked` holds nothing starts; the idle edge drains `pending` once.
  let blocked = false;
  let pending = false;
  let waiters: Array<() => void> = [];

  const resolveIdleWaiters = (): void => {
    if (inFlight || queued || pending) return;
    const waiting = waiters;
    waiters = [];
    for (const resolve of waiting) resolve();
  };

  const start = (): void => {
    // 64-27 (WR-04): a run asked for while the caller cannot bake parks
    // instead of spending itself against a state that would refuse.
    if (blocked) {
      pending = true;
      return;
    }
    inFlight = true;
    void (async () => {
      let applied = false;
      try {
        applied = await run();
      } catch {
        // Swallowed: the controller is a UI nicety, never a failure source —
        // and a rejection earns no automatic retry.
        followUpUsed = true;
      }
      inFlight = false;
      if (queued) {
        queued = false;
        followUpUsed = true;
        start();
        return;
      }
      if (!applied && !followUpUsed) {
        followUpUsed = true;
        start();
        return;
      }
      followUpUsed = false;
      resolveIdleWaiters();
    })();
  };

  return {
    request: () => {
      // 64-27 (WR-04): a parked request collapses — one flag, no timer.
      if (blocked) {
        pending = true;
        return;
      }
      if (inFlight) {
        queued = true;
        return;
      }
      followUpUsed = false;
      start();
    },
    settle: () => {
      if (!inFlight && !queued && !pending) return Promise.resolve();
      return new Promise<void>((resolve) => {
        waiters.push(resolve);
      });
    },
    setBlocked: (next: boolean) => {
      if (next === blocked) return;
      blocked = next;
      if (blocked || !pending) return;
      // The idle edge: drain the parked request through the shipped
      // single-run-in-flight path — queued behind a live run, started when
      // the scheduler is idle. A fresh burst, like a fresh request.
      pending = false;
      followUpUsed = false;
      if (inFlight) {
        queued = true;
        return;
      }
      start();
    },
  };
}
