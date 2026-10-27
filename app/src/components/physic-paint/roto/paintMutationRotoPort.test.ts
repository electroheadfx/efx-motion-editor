// ============================================================
//  quick 261027-klx — the ONE memoized Roto script port.
//
//  The clipboard's WeakMaps key on the port OBJECT, so identity is a
//  contract: the same ledger must return the same port, and a fresh
//  port must be a different key. Completion comes from the ledger,
//  never from a raster finalization.
// ============================================================

import { describe, expect, it } from 'vitest';
import { createPaintMutationLedger } from '../engine/paintMutationLedger';
import type { CompletedPaintMutation, PaintStroke } from '../types/paintCore';
import { getRotoPort } from './paintMutationRotoPort';

function stroke(x: number): PaintStroke {
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
  };
}

describe('quick 261027-klx paint mutation Roto port', () => {
  it('getRotoPort returns a STABLE identity for one ledger', () => {
    const ledger = createPaintMutationLedger();
    const first = getRotoPort(ledger);
    const second = getRotoPort(ledger);
    expect(second).toBe(first);
    // Seams may be refreshed without changing the identity.
    const third = getRotoPort(ledger, { flushPendingStrokeFinalizations: () => {} });
    expect(third).toBe(first);
  });

  it('a fresh ledger gets a fresh port (a different WeakMap key)', () => {
    const firstLedger = createPaintMutationLedger();
    const secondLedger = createPaintMutationLedger();
    const first = getRotoPort(firstLedger);
    const second = getRotoPort(secondLedger);
    expect(second).not.toBe(first);

    const keyed = new WeakMap<object, string>();
    keyed.set(first, 'first');
    keyed.set(second, 'second');
    expect(keyed.get(first)).toBe('first');
    expect(keyed.get(second)).toBe('second');
  });

  it('getStrokes / getStrokeCount reflect acceptance order', () => {
    const ledger = createPaintMutationLedger();
    const port = getRotoPort(ledger);
    expect(port.getStrokes()).toEqual([]);
    expect(port.getStrokeCount?.()).toBe(0);

    port.enqueueRecordedStroke({ primary: stroke(5) });
    port.enqueueRecordedStroke({ primary: stroke(9) });

    expect(port.getStrokes().map((entry) => entry.timestamp)).toEqual([5, 9]);
    expect(port.getStrokeCount?.()).toBe(2);
  });

  it('enqueueRecordedStroke returns the ledger id and the ledger emits completion', () => {
    const ledger = createPaintMutationLedger();
    const port = getRotoPort(ledger);
    const observed: CompletedPaintMutation[] = [];
    ledger.subscribe((mutation) => observed.push(mutation));

    const id = port.enqueueRecordedStroke({ primary: stroke(3) });
    expect(id).toBe(1);
    // WR-02: the first acceptance of a session reports the pre-add count.
    expect(observed).toEqual([{ kind: 'paint', isEmpty: true, mutationId: 1 }]);
  });

  // CR-01: the clipboard registers the expected id through this seam, so it
  // must reach the ledger and run BEFORE the synchronous completion listener.
  it('forwards the onAccepted seam ahead of the completion listener', () => {
    const ledger = createPaintMutationLedger();
    const port = getRotoPort(ledger);
    const order: string[] = [];
    ledger.subscribe((mutation) => order.push(`completion:${mutation.mutationId}`));

    const id = port.enqueueRecordedStroke({ primary: stroke(4) }, (mutationId) => {
      order.push(`accepted:${mutationId}`);
    });

    expect(order).toEqual([`accepted:${id}`, `completion:${id}`]);
  });

  it('passes a null copyLiveAlphaCanvas result through instead of a blank canvas', () => {
    const ledger = createPaintMutationLedger();
    const port = getRotoPort(ledger, { copyLiveAlphaCanvas: () => null });
    expect(port.copyLiveAlphaCanvas?.()).toBeNull();

    // The seam can be replaced without changing the port identity.
    const fakeCanvas = { width: 4, height: 4 } as unknown as HTMLCanvasElement;
    const samePort = getRotoPort(ledger, { copyLiveAlphaCanvas: () => fakeCanvas });
    expect(samePort).toBe(port);
    expect(samePort.copyLiveAlphaCanvas?.()).toBe(fakeCanvas);
  });

  // WR-06: a later call that supplies one seam used to REPLACE the whole seam
  // record, blanking every seam registered by an earlier call.
  it('WR-06: re-registering seams merges them instead of replacing them', () => {
    const ledger = createPaintMutationLedger();
    const fakeCanvas = { width: 4, height: 4 } as unknown as HTMLCanvasElement;
    let flushes = 0;
    const port = getRotoPort(ledger, {
      copyLiveAlphaCanvas: () => fakeCanvas,
      flushPendingStrokeFinalizations: () => { flushes += 1; },
    });

    const samePort = getRotoPort(ledger, { flushPendingStrokeFinalizations: () => { flushes += 10; } });
    expect(samePort).toBe(port);
    // The capture seam registered earlier survives the later flush-only call...
    expect(samePort.copyLiveAlphaCanvas?.()).toBe(fakeCanvas);
    // ...and the newest seam wins for the key it actually provides.
    samePort.flushPendingStrokeFinalizations?.();
    expect(flushes).toBe(10);
  });

  it('routes setInputLocked and flush seams to their owners', () => {
    const ledger = createPaintMutationLedger();
    let flushes = 0;
    const port = getRotoPort(ledger, { flushPendingStrokeFinalizations: () => { flushes += 1; } });

    port.setInputLocked(true);
    expect(ledger.isInputLocked()).toBe(true);
    port.setInputLocked(false);
    expect(ledger.isInputLocked()).toBe(false);

    port.flushPendingStrokeFinalizations?.();
    expect(flushes).toBe(1);
  });
});
