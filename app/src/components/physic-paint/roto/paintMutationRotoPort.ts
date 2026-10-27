// ============================================================
//  quick 261027-klx — THE ONE memoized Roto script port.
//
//  `RotoScriptEnginePort` was implemented by engine-1. It is now a
//  thin adapter over the app-owned ledger. Load-bearing identity:
//  the clipboard's `acceptedTargets` / completion waiters are
//  WeakMaps keyed by THIS object (`physicsPaintRotoScriptClipboard.ts`,
//  `acceptedTargets`), so callers MUST receive the same instance for
//  a given ledger — `getRotoPort(ledger)` memoizes per ledger and
//  returns a stable identity.
//
//  `copyLiveAlphaCanvas` is an injected seam that may return null
//  (the watercolor sheet may have no pixels yet); the port passes a
//  null straight through and never substitutes a blank canvas.
// ============================================================

import type { PaintMutationLedger } from '../engine/paintMutationLedger';
import type { RecordedStrokeGroup } from '../view/recordedStrokeGroups';
import type { RotoScriptEnginePort } from './physicsPaintRotoScriptClipboard';

export interface PaintMutationRotoPortSeams {
  /** Watercolor/engine flush seam; the ledger itself is already synchronous. */
  flushPendingStrokeFinalizations?: () => void;
  /** Live alpha-canvas capture seam; null means "nothing to capture yet". */
  copyLiveAlphaCanvas?: () => HTMLCanvasElement | null;
}

interface MemoizedRotoPort {
  seams: PaintMutationRotoPortSeams;
  port: RotoScriptEnginePort;
}

const memoizedPorts = new WeakMap<PaintMutationLedger, MemoizedRotoPort>();

export function getRotoPort(
  ledger: PaintMutationLedger,
  seams: PaintMutationRotoPortSeams = {},
): RotoScriptEnginePort {
  const existing = memoizedPorts.get(ledger);
  if (existing) {
    // Same identity, latest seams: a capture seam read must never be stale.
    // WR-06: MERGE, never replace — a later call that supplies only one seam
    // (e.g. the flush seam) must not blank the ones registered earlier.
    existing.seams = { ...existing.seams, ...seams };
    return existing.port;
  }

  let entry: MemoizedRotoPort;
  const port: RotoScriptEnginePort = {
    getStrokes: () => ledger.getAcceptedStrokes(),
    getStrokeCount: () => ledger.getAcceptedStrokeCount(),
    copyLiveAlphaCanvas: () => entry.seams.copyLiveAlphaCanvas?.() ?? null,
    enqueueRecordedStroke: (
      group: Readonly<RecordedStrokeGroup>,
      onAccepted?: (mutationId: number) => void,
    ) => ledger.allocateStrokeMutation(group, onAccepted),
    flushPendingStrokeFinalizations: () => {
      entry.seams.flushPendingStrokeFinalizations?.();
    },
    setInputLocked: (locked: boolean) => {
      ledger.setInputLocked(locked);
    },
  };
  entry = { seams, port };
  memoizedPorts.set(ledger, entry);
  return port;
}
