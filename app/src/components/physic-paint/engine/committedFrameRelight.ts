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
  /** Resolves once the in-flight run and any queued follow-up completed. */
  settle: () => Promise<void>;
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
 */
export function createSingleFlightRelight(run: () => Promise<boolean>): SingleFlightRelight {
  let inFlight = false;
  let queued = false;
  // True once this burst has spent its automatic follow-up — a busy `false`
  // grants exactly one, a rejection none.
  let followUpUsed = false;
  let waiters: Array<() => void> = [];

  const resolveIdleWaiters = (): void => {
    if (inFlight || queued) return;
    const pending = waiters;
    waiters = [];
    for (const resolve of pending) resolve();
  };

  const start = (): void => {
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
      if (inFlight) {
        queued = true;
        return;
      }
      followUpUsed = false;
      start();
    },
    settle: () => {
      if (!inFlight && !queued) return Promise.resolve();
      return new Promise<void>((resolve) => {
        waiters.push(resolve);
      });
    },
  };
}
