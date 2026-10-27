// ============================================================
//  quick 261027-klx — the APP-OWNED mutation ledger.
//
//  Engine-1 owns stroke identity today: it allocates mutation ids,
//  keeps the accepted-stroke list that Roto script save/copy/apply
//  reads, and is the only emitter of the mutation-completion event.
//  This module takes those three jobs with no paint engine, no
//  rasterization, no finalization and no hidden rendering.
//
//  PARITY CONTRACT (what this ledger reproduces exactly):
//    - post-increment allocation from a clock seeded at 1;
//    - `reserveNextMutationId` is a MAX-RAISE that ignores
//      non-integers and values <= 0 (engine-1 `reserveMutationClock`);
//    - acceptance (and its order) is synchronous, before the call
//      returns — the completion event fires from the ledger itself,
//      so a copy/apply drain can never deadlock on a raster;
//    - accepted strokes are cloned and frozen like
//      `EfxPaintEngine.acceptStroke` (primary keeps the id, the
//      continuations are zero-point records).
//
//  WAIVED (documented in the Wave 0 summary): byte-identical numeric
//  ids across a whole session. Engine-1 draws ids from three sources
//  that disappear with it — interactive strokes
//  (`EfxPaintEngine.ts:4687`), the implicit `++` for clear/physics
//  (`:3690`), and fresh ids on every load (`:5100`). The achievable
//  contract pinned by tests is: monotonic, never reused, seeded from
//  restored max + 1, acceptance order == stroke-end order.
// ============================================================

import type { CompletedPaintMutation, PaintStroke, PenPoint } from '../types/paintCore';
import type { RecordedStrokeGroup } from '../view/recordedStrokeGroups';

export interface AcceptedPaintMutation {
  readonly mutationId: number;
  readonly kind: CompletedPaintMutation['kind'];
  readonly accepted: readonly PaintStroke[];
  readonly acceptedAt: number;
}

export type PaintMutationCompletionListener = (mutation: CompletedPaintMutation) => void;

export interface PaintMutationLedger {
  /** Post-increment from the mutation clock (seeded at 1). */
  allocateMutationId(): number;
  /**
   * Accept one immutable recorded logical brush: validate, allocate,
   * append the accepted record, then emit completion synchronously.
   * Allocation + acceptance are complete before the call returns.
   */
  allocateStrokeMutation(group: Readonly<RecordedStrokeGroup>): number;
  /** Max-raise; non-integers and values <= 0 are ignored (idempotent/order-free). */
  reserveNextMutationId(minNextMutationId: number): void;
  /** Seed from a restored timeline: equivalent to reserveNextMutationId(max + 1). */
  seedFromRestoredMax(maxRestoredMutationId: number): void;
  /** Fresh clones in acceptance order — callers may freeze/mutate their copies. */
  getAcceptedStrokes(): PaintStroke[];
  /** All accepted ledger entries (primaries + zero-point continuations). */
  getAcceptedStrokeCount(): number;
  /** READ-ONLY lookup: the record is never consumed here (the clipboard owns consumption). */
  lookupAcceptedTarget(mutationId: number): AcceptedPaintMutation | null;
  subscribe(listener: PaintMutationCompletionListener): () => void;
  setInputLocked(locked: boolean): void;
  setActive(active: boolean): void;
  isInputLocked(): boolean;
  isActive(): boolean;
}

function cloneStroke(stroke: Readonly<PaintStroke>): PaintStroke {
  return {
    ...stroke,
    points: stroke.points.map((point) => ({ ...point })),
    params: { ...stroke.params },
  };
}

export function createPaintMutationLedger(): PaintMutationLedger {
  let nextMutationId = 1;
  let acceptedStrokeCount = 0;
  let inputLocked = false;
  let active = false;
  const accepted: AcceptedPaintMutation[] = [];
  const listeners = new Set<PaintMutationCompletionListener>();

  function reserveNextMutationId(minNextMutationId: number): void {
    if (!Number.isInteger(minNextMutationId) || minNextMutationId <= 0) return;
    nextMutationId = Math.max(nextMutationId, minNextMutationId);
  }

  function allocateMutationId(): number {
    return nextMutationId++;
  }

  function seedFromRestoredMax(maxRestoredMutationId: number): void {
    reserveNextMutationId(maxRestoredMutationId + 1);
  }

  function allocateStrokeMutation(group: Readonly<RecordedStrokeGroup>): number {
    // Fail closed BEFORE the clock moves (same guards as
    // EfxPaintEngine.enqueueRecordedStroke). The clipboard's apply burst
    // relies on a throw to stop at the first malformed brush.
    const primary = cloneStroke(group.primary);
    if (primary.points.length === 0 || primary.diffusionFrames !== undefined) {
      throw new TypeError('Recorded stroke primary must contain points and cannot be a continuation');
    }
    const continuationInputs = group.continuations ?? [];
    if (continuationInputs.length > 0 && primary.tool !== 'paint') {
      throw new TypeError('Recorded diffusion continuations require a paint primary');
    }
    const continuations = continuationInputs.map((continuationInput) => {
      const continuation = cloneStroke(continuationInput);
      if (
        continuation.points.length !== 0
        || !Number.isFinite(continuation.diffusionFrames)
        || Math.trunc(continuation.diffusionFrames ?? 0) <= 0
      ) {
        throw new TypeError('Recorded stroke continuations must be zero-point diffusion records');
      }
      delete continuation.mutationId;
      continuation.points = [];
      return continuation;
    });

    const mutationId = allocateMutationId();
    delete primary.mutationId;
    primary.mutationId = mutationId;
    // Same immutability as acceptStroke: the ledger's points are frozen.
    primary.points = Object.freeze(
      primary.points.map((point) => Object.freeze({ ...point })),
    ) as unknown as PenPoint[];
    const actions: PaintStroke[] = [primary, ...continuations];

    accepted.push(Object.freeze({
      mutationId,
      kind: primary.tool,
      accepted: Object.freeze(actions),
      acceptedAt: Date.now(),
    }));
    acceptedStrokeCount += actions.length;

    // Completion is emitted by the ledger, synchronously, AFTER acceptance.
    const completion: CompletedPaintMutation = {
      kind: primary.tool,
      isEmpty: acceptedStrokeCount === 0,
      mutationId,
    };
    for (const listener of Array.from(listeners)) listener(completion);
    return mutationId;
  }

  function getAcceptedStrokes(): PaintStroke[] {
    const strokes: PaintStroke[] = [];
    for (const entry of accepted) {
      for (const stroke of entry.accepted) strokes.push(cloneStroke(stroke));
    }
    return strokes;
  }

  function lookupAcceptedTarget(mutationId: number): AcceptedPaintMutation | null {
    for (const entry of accepted) {
      if (entry.mutationId === mutationId) return entry;
    }
    return null;
  }

  function subscribe(listener: PaintMutationCompletionListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return {
    allocateMutationId,
    allocateStrokeMutation,
    reserveNextMutationId,
    seedFromRestoredMax,
    getAcceptedStrokes,
    getAcceptedStrokeCount: () => acceptedStrokeCount,
    lookupAcceptedTarget,
    subscribe,
    setInputLocked: (locked: boolean) => {
      inputLocked = locked;
    },
    setActive: (nextActive: boolean) => {
      active = nextActive;
    },
    isInputLocked: () => inputLocked,
    isActive: () => active,
  };
}
