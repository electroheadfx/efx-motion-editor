// ============================================================
//  keyIdentityFrameMap.test.ts — quick-261024-m20.
//
//  ONE key-identity frame mapping shared by roto physical
//  ownership, the brush script ledger and the watercolor record
//  state. The map answers a single question: where did each
//  physical key's app frame move? A null result means a malformed
//  layout (duplicate keyId or appFrame on either side).
// ============================================================

import { describe, expect, it } from 'vitest';
import { buildKeyIdentityFrameMap } from './keyIdentityFrameMap';

function entries(map: Map<number, number> | null): [number, number][] {
  if (!map) throw new Error('expected a frame map, got null');
  return [...map.entries()].sort((left, right) => left[0] - right[0]);
}

describe('buildKeyIdentityFrameMap', () => {
  it('moves every surviving key frame with its key identity', () => {
    const map = buildKeyIdentityFrameMap(
      [
        { keyId: 'a', appFrame: 0 },
        { keyId: 'b', appFrame: 2 },
        { keyId: 'c', appFrame: 10 },
        { keyId: 'd', appFrame: 14 },
      ],
      [
        { keyId: 'a', appFrame: 0 },
        { keyId: 'b', appFrame: 2 },
        { keyId: 'c', appFrame: 4 },
        { keyId: 'd', appFrame: 6 },
      ],
    );

    expect(entries(map)).toEqual([
      [0, 0],
      [2, 2],
      [10, 4],
      [14, 6],
    ]);
  });

  it('drops a deleted key frame and moves the survivor onto its new frame', () => {
    const map = buildKeyIdentityFrameMap(
      [
        { keyId: 'a', appFrame: 0 },
        { keyId: 'b', appFrame: 5 },
        { keyId: 'c', appFrame: 10 },
      ],
      [
        { keyId: 'a', appFrame: 0 },
        { keyId: 'c', appFrame: 5 },
      ],
    );

    expect(entries(map)).toEqual([
      [0, 0],
      [10, 5],
    ]);
    expect(map?.has(5)).toBe(false);
  });

  it('keeps a frame that just gained a key anchored to itself', () => {
    const map = buildKeyIdentityFrameMap(
      [{ keyId: 'a', appFrame: 0 }],
      [
        { keyId: 'a', appFrame: 0 },
        { keyId: 'b', appFrame: 5 },
      ],
    );

    expect(entries(map)).toEqual([
      [0, 0],
      [5, 5],
    ]);
  });

  it('maps every after frame to itself when no before key existed', () => {
    const map = buildKeyIdentityFrameMap(
      [],
      [
        { keyId: 'a', appFrame: 3 },
        { keyId: 'b', appFrame: 9 },
      ],
    );

    expect(entries(map)).toEqual([
      [3, 3],
      [9, 9],
    ]);
  });

  it('returns an empty map when both sides are empty', () => {
    expect(entries(buildKeyIdentityFrameMap([], []))).toEqual([]);
  });

  it('returns null for a duplicate keyId in the before records', () => {
    expect(buildKeyIdentityFrameMap(
      [
        { keyId: 'a', appFrame: 0 },
        { keyId: 'a', appFrame: 5 },
      ],
      [{ keyId: 'a', appFrame: 0 }],
    )).toBeNull();
  });

  it('returns null for a duplicate appFrame in the before records', () => {
    expect(buildKeyIdentityFrameMap(
      [
        { keyId: 'a', appFrame: 0 },
        { keyId: 'b', appFrame: 0 },
      ],
      [{ keyId: 'a', appFrame: 0 }],
    )).toBeNull();
  });

  it('returns null for a duplicate keyId in the after records', () => {
    expect(buildKeyIdentityFrameMap(
      [{ keyId: 'a', appFrame: 0 }],
      [
        { keyId: 'a', appFrame: 0 },
        { keyId: 'a', appFrame: 5 },
      ],
    )).toBeNull();
  });

  it('returns null for a duplicate appFrame in the after records', () => {
    expect(buildKeyIdentityFrameMap(
      [{ keyId: 'a', appFrame: 0 }],
      [
        { keyId: 'a', appFrame: 0 },
        { keyId: 'b', appFrame: 0 },
      ],
    )).toBeNull();
  });
});
