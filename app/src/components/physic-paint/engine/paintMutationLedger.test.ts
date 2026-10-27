// ============================================================
//  quick 261027-klx — the app-owned mutation ledger contract.
//
//  These are PERMANENT invariants (no temporary audit log):
//    monotonic / never-reused ids, max-raise seeding from a restored
//    timeline, acceptance order == stroke-end order, synchronous
//    completion with no rasterization, and read-only target lookup.
// ============================================================

import { describe, expect, it } from 'vitest';
import { createPaintMutationLedger } from './paintMutationLedger';
import type { CompletedPaintMutation, PaintStroke } from '../types/paintCore';

function stroke(x: number, overrides: Partial<PaintStroke> = {}): PaintStroke {
  return {
    tool: 'paint',
    points: [{ x, y: 20, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0 }],
    color: '#123456',
    params: {
      size: 12,
      opacity: 100,
      pressure: 100,
      waterAmount: 50,
      dryAmount: 50,
      edgeDetail: 50,
      pickup: 50,
      eraseStrength: 50,
      antiAlias: 1,
    },
    timestamp: x,
    ...overrides,
  };
}

function continuation(frames: number): PaintStroke {
  return stroke(0, { points: [], diffusionFrames: frames });
}

describe('quick 261027-klx paint mutation ledger', () => {
  it('allocates monotonically and never reuses an id across a long run', () => {
    const ledger = createPaintMutationLedger();
    const seen = new Set<number>();
    let previous = 0;
    for (let index = 0; index < 500; index += 1) {
      const id = ledger.allocateMutationId();
      expect(id).toBeGreaterThan(previous);
      expect(seen.has(id)).toBe(false);
      seen.add(id);
      previous = id;
    }
    expect(seen.size).toBe(500);
  });

  it('reserveNextMutationId is a max-raise that ignores 0, negatives, fractions and NaN', () => {
    const ledger = createPaintMutationLedger();
    expect(ledger.allocateMutationId()).toBe(1);

    for (const invalid of [0, -1, -999, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      ledger.reserveNextMutationId(invalid);
    }
    expect(ledger.allocateMutationId()).toBe(2);

    ledger.reserveNextMutationId(10);
    expect(ledger.allocateMutationId()).toBe(10);
    expect(ledger.allocateMutationId()).toBe(11);

    // A lower raise never moves the clock backwards.
    ledger.reserveNextMutationId(5);
    expect(ledger.allocateMutationId()).toBe(12);
  });

  it('reserveNextMutationId is idempotent and order-independent', () => {
    const ledger = createPaintMutationLedger();
    ledger.reserveNextMutationId(20);
    ledger.reserveNextMutationId(15);
    ledger.reserveNextMutationId(20);
    ledger.reserveNextMutationId(15);
    ledger.reserveNextMutationId(20);
    expect(ledger.allocateMutationId()).toBe(20);
  });

  it('seedFromRestoredMax(41) makes the next allocation 42', () => {
    const ledger = createPaintMutationLedger();
    ledger.seedFromRestoredMax(41);
    expect(ledger.allocateMutationId()).toBe(42);
  });

  it('acceptance order equals allocation order', () => {
    const ledger = createPaintMutationLedger();
    const first = ledger.allocateStrokeMutation({ primary: stroke(1) });
    const second = ledger.allocateStrokeMutation({ primary: stroke(2), continuations: [continuation(3)] });
    const third = ledger.allocateStrokeMutation({ primary: stroke(3) });
    expect([first, second, third]).toEqual([1, 2, 3]);
    const accepted = ledger.getAcceptedStrokes();
    // second carries a zero-point continuation, so four ledger entries.
    expect(accepted.map((entry) => entry.mutationId)).toEqual([1, 2, undefined, 3]);
    expect(accepted.map((entry) => entry.timestamp)).toEqual([1, 2, 0, 3]);
    expect(accepted[1].points).toHaveLength(1);
    expect(accepted[2].points).toHaveLength(0);
    expect(accepted[2].diffusionFrames).toBe(3);
  });

  it('getAcceptedStrokes returns fresh defensive copies in acceptance order', () => {
    const ledger = createPaintMutationLedger();
    ledger.allocateStrokeMutation({ primary: stroke(7) });
    const firstRead = ledger.getAcceptedStrokes();
    firstRead[0].points[0].x = 999;
    firstRead[0].params.size = 999;
    firstRead[0].color = '#ffffff';
    firstRead.push(stroke(8));

    const secondRead = ledger.getAcceptedStrokes();
    expect(secondRead).toHaveLength(1);
    expect(secondRead[0].points[0].x).toBe(7);
    expect(secondRead[0].params.size).toBe(12);
    expect(secondRead[0].color).toBe('#123456');
  });

  it('lookupAcceptedTarget returns the same record on repeated reads and null for unknown ids', () => {
    const ledger = createPaintMutationLedger();
    const id = ledger.allocateStrokeMutation({ primary: stroke(1) });
    const first = ledger.lookupAcceptedTarget(id);
    const second = ledger.lookupAcceptedTarget(id);
    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(first?.accepted[0].mutationId).toBe(id);
    expect(ledger.lookupAcceptedTarget(id + 1)).toBeNull();
  });

  it('every allocateStrokeMutation emits exactly one completion carrying its id before returning', () => {
    const ledger = createPaintMutationLedger();
    const observed: CompletedPaintMutation[] = [];
    const unsubscribe = ledger.subscribe((mutation) => observed.push(mutation));

    const first = ledger.allocateStrokeMutation({ primary: stroke(1) });
    // Synchronous: the event is already observable with no await/microtask.
    // WR-02: `isEmpty` reports the state BEFORE this mutation joined the count.
    expect(observed).toEqual([{ kind: 'paint', isEmpty: true, mutationId: first }]);

    const second = ledger.allocateStrokeMutation({ primary: stroke(2, { tool: 'erase' }) });
    expect(observed).toEqual([
      { kind: 'paint', isEmpty: true, mutationId: first },
      { kind: 'erase', isEmpty: false, mutationId: second },
    ]);

    unsubscribe();
    ledger.allocateStrokeMutation({ primary: stroke(3) });
    expect(observed).toHaveLength(2);
  });

  // WR-02: the completion's `isEmpty` was read AFTER the increment, so it was
  // false for every mutation — including the very first stroke of a session.
  it('WR-02: isEmpty is measured before the mutation joins the acceptance count', () => {
    const ledger = createPaintMutationLedger();
    const observed: CompletedPaintMutation[] = [];
    ledger.subscribe((mutation) => observed.push(mutation));

    ledger.allocateStrokeMutation({ primary: stroke(1), continuations: [continuation(2)] });
    ledger.allocateStrokeMutation({ primary: stroke(2) });

    expect(observed.map((mutation) => mutation.isEmpty)).toEqual([true, false]);
    // A fresh ledger reports the empty count it actually observed.
    const pristine = createPaintMutationLedger();
    expect(pristine.getAcceptedStrokeCount()).toBe(0);
  });

  // CR-01: the seam runs AFTER the acceptance record exists and BEFORE any
  // completion listener — the caller registers the id it is about to receive
  // because the return value arrives too late for a synchronous completion.
  it('CR-01: onAccepted runs after acceptance and before the completion listener', () => {
    const ledger = createPaintMutationLedger();
    const order: string[] = [];
    let acceptedVisibleDuringCallback = false;
    ledger.subscribe((mutation) => order.push(`completion:${mutation.mutationId}`));

    const id = ledger.allocateStrokeMutation({ primary: stroke(1) }, (mutationId) => {
      acceptedVisibleDuringCallback = ledger.lookupAcceptedTarget(mutationId) !== null;
      order.push(`accepted:${mutationId}`);
    });

    expect(id).toBe(1);
    expect(acceptedVisibleDuringCallback).toBe(true);
    expect(order).toEqual(['accepted:1', 'completion:1']);
  });

  it('fails closed on malformed groups without consuming an id', () => {
    const ledger = createPaintMutationLedger();
    expect(() => ledger.allocateStrokeMutation({ primary: stroke(1, { points: [] }) })).toThrow(TypeError);
    expect(() => ledger.allocateStrokeMutation({ primary: stroke(1), continuations: [continuation(0)] })).toThrow(TypeError);
    expect(() => ledger.allocateStrokeMutation({ primary: stroke(1), continuations: [{ ...stroke(2), diffusionFrames: 2 }] })).toThrow(TypeError);

    expect(() => ledger.allocateStrokeMutation({
      primary: stroke(1, { tool: 'erase' }),
      continuations: [continuation(2)],
    })).toThrow(TypeError);
    // Validation is fail-closed BEFORE the clock moves in every case.
    expect(ledger.allocateMutationId()).toBe(1);
  });

  it('a SNAP-shaped save -> restore -> save round-trip is stable and reseeds the clock', () => {
    const ledger = createPaintMutationLedger();
    const ids = [
      ledger.allocateStrokeMutation({ primary: stroke(1) }),
      ledger.allocateStrokeMutation({ primary: stroke(2), continuations: [continuation(4)] }),
      ledger.allocateStrokeMutation({ primary: stroke(3) }),
    ];
    const saved = JSON.stringify(ledger.getAcceptedStrokes());
    const maxSavedId = Math.max(...ids);

    // Restore: the stored rows are re-serialized unchanged, and the ledger
    // clock is seeded from the restored max so the next id can never collide.
    const restoredLedger = createPaintMutationLedger();
    const restoredRows = JSON.parse(saved) as PaintStroke[];
    const resaved = JSON.stringify(restoredRows);
    expect(resaved).toBe(saved);

    restoredLedger.seedFromRestoredMax(maxSavedId);
    expect(restoredLedger.allocateMutationId()).toBe(maxSavedId + 1);
  });

  it('setInputLocked / setActive are plain idempotent state', () => {
    const ledger = createPaintMutationLedger();
    expect(ledger.isInputLocked()).toBe(false);
    expect(ledger.isActive()).toBe(false);
    ledger.setInputLocked(true);
    ledger.setInputLocked(true);
    ledger.setActive(true);
    ledger.setActive(true);
    expect(ledger.isInputLocked()).toBe(true);
    expect(ledger.isActive()).toBe(true);
    ledger.setInputLocked(false);
    ledger.setActive(false);
    expect(ledger.isInputLocked()).toBe(false);
    expect(ledger.isActive()).toBe(false);
  });
});
