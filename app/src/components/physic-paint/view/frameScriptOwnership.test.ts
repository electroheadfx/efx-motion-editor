// ============================================================
//  quick-261025-awl Task 1 (D-01) — frame script ownership.
//
//  A frame is owned by ONE module or none. The resolver reads the REAL
//  aquarelle store (no mocks) and never reads or writes a signal.
//
//  261027-klx: @efxlab/efx-watercolor is the only paint engine, so
//  ownership collapses to Water color or none. Ownership stays
//  KEY-bound: a script only owns a REAL key cell.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest';
import type { AquarellePoint, AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import {
  emitAquarelleDry,
  markAquarelleStrokeDeleted,
  purgeAquarelleFrameScript,
  recordAquarelleStroke,
  resetAquarelleRecordState,
} from './aquarelleRecordState';
import { resolveFrameScriptOwner, type FrameScriptCell } from './frameScriptOwnership';

function cellFor(frame: number, keyId: string | null = `key-${frame}`): FrameScriptCell {
  return { kind: 'real', keyId };
}

function aquarellePoint(x: number, y: number): AquarellePoint {
  return { x, y, p: 1, tx: 0, ty: 0, tw: 0 };
}

function aquarelleStroke(mutationId: number, playFrame: number): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#103c65',
    params: { size: 12 },
    brushId: 'round',
    points: [aquarellePoint(0.1, 0.5), aquarellePoint(0.2, 0.5)],
    mutationId,
    timestamp: mutationId,
    playFrame,
  };
}

beforeEach(() => {
  resetAquarelleRecordState();
});

describe('resolveFrameScriptOwner', () => {
  it('returns null for an empty frame', () => {
    expect(resolveFrameScriptOwner(10, cellFor(10))).toBeNull();
    expect(resolveFrameScriptOwner(10, null)).toBeNull();
  });

  it('returns watercolor for a recorded aquarelle stroke on a real cell', () => {
    recordAquarelleStroke(101, aquarelleStroke(101, 10));
    expect(resolveFrameScriptOwner(10, cellFor(10))).toBe('watercolor');
  });

  it('never counts a Dry event as a script', () => {
    emitAquarelleDry(4242);
    expect(resolveFrameScriptOwner(10, cellFor(10))).toBeNull();
  });

  it('never counts a deleted-stroke tombstone', () => {
    recordAquarelleStroke(103, aquarelleStroke(103, 10));
    markAquarelleStrokeDeleted(103);
    expect(resolveFrameScriptOwner(10, cellFor(10))).toBeNull();
  });

  it('never counts another frame, and keeps ownership frame-bound on any real cell', () => {
    recordAquarelleStroke(104, aquarelleStroke(104, 11));
    expect(resolveFrameScriptOwner(10, cellFor(10))).toBeNull();
    expect(resolveFrameScriptOwner(11, cellFor(11))).toBe('watercolor');
    // 261027-klx collapsed the derivation to `hasWatercolor ? 'watercolor' : null`.
    // The aquarelle ledger is keyed by play frame, so a different real key at an
    // owned frame keeps the owner; a derived/empty cell still does not.
    expect(resolveFrameScriptOwner(11, cellFor(11, 'key-replaced'))).toBe('watercolor');
    expect(resolveFrameScriptOwner(11, { kind: 'generated', keyId: null })).toBeNull();
  });

  it('drops back to null after the aquarelle frame script is purged', () => {
    recordAquarelleStroke(105, aquarelleStroke(105, 10));
    expect(resolveFrameScriptOwner(10, cellFor(10))).toBe('watercolor');
    expect(purgeAquarelleFrameScript(10)).toBe(1);
    expect(resolveFrameScriptOwner(10, cellFor(10))).toBeNull();
  });

  it('never counts a script on a derived or empty cell', () => {
    recordAquarelleStroke(106, aquarelleStroke(106, 10));
    expect(resolveFrameScriptOwner(10, { kind: 'generated', keyId: null })).toBeNull();
    expect(resolveFrameScriptOwner(10, { kind: 'empty', keyId: null })).toBeNull();
    expect(resolveFrameScriptOwner(10, null)).toBeNull();
  });
});
