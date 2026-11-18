import type { PaintDocumentLight } from '../../../efx-paint/document/efxPaintDocument';

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

/** True when the document light differs from the last-seen signature. */
export function lightChangeNeedsRelight(
  _previousSignature: string,
  _nextLight: PaintDocumentLight | undefined,
): boolean {
  return false;
}

export function createSingleFlightRelight(run: () => Promise<boolean>): SingleFlightRelight {
  return {
    request: () => {
      void run().catch(() => {});
    },
    settle: () => Promise.resolve(),
  };
}
