import { describe, expect, it } from 'vitest';
import {
  buildKeyRailBaseCopy,
  buildSelectedKeyRailCopy,
  deriveKeyRailSegments,
  resolvePhysicPaintPushAnchor,
} from './physicsPaintKeyRailPresentation';

describe('deriveKeyRailSegments', () => {
  it('derives ordinary rails from ordered real keys, breaks, and Group ownership', () => {
    const segments = deriveKeyRailSegments({
      orderedRealKeys: [
        { keyId: 'A', appFrame: 1 },
        { keyId: 'B', appFrame: 4 },
        { keyId: 'C', appFrame: 7 },
        { keyId: 'D', appFrame: 9 },
        { keyId: 'E', appFrame: 12 },
        { keyId: 'F', appFrame: 16 },
      ],
      incomingInterpolationBreakKeyIds: new Set(['B', 'F']),
      groupOwnedKeyIds: new Set(['C', 'D']),
    });

    expect(segments).toEqual([
      { firstKeyId: 'A', keyIds: ['A'], firstKeyFrame: 1, lastKeyFrame: 1 },
      { firstKeyId: 'B', keyIds: ['B'], firstKeyFrame: 4, lastKeyFrame: 4 },
      { firstKeyId: 'E', keyIds: ['E'], firstKeyFrame: 12, lastKeyFrame: 12 },
      { firstKeyId: 'F', keyIds: ['F'], firstKeyFrame: 16, lastKeyFrame: 16 },
    ]);
    expect(Object.isFrozen(segments)).toBe(true);
    expect(segments.every((segment) => Object.isFrozen(segment) && Object.isFrozen(segment.keyIds))).toBe(true);
  });

  it('keeps empty physical frames inside one half-open rail when no break exists', () => {
    const segments = deriveKeyRailSegments({
      orderedRealKeys: [
        { keyId: 'left', appFrame: 2 },
        { keyId: 'right', appFrame: 8 },
      ],
      incomingInterpolationBreakKeyIds: new Set(),
      groupOwnedKeyIds: new Set(),
    });

    expect(segments).toEqual([
      { firstKeyId: 'left', keyIds: ['left', 'right'], firstKeyFrame: 2, lastKeyFrame: 8 },
    ]);
    expect(segments[0].lastKeyFrame + 1).toBe(9);
  });
});

describe('resolvePhysicPaintPushAnchor (43.5-05 smoke RED: cell → containing rail)', () => {
  const keyIdByAppFrame = new Map<number, string>([
    [0, 'A'],
    [3, 'B'],
    [5, 'C'],
  ]);
  const loopIdByAppFrame = new Map<number, string>();
  const keyRailSegments = [
    { firstKeyId: 'A', keyIds: ['A', 'B'], firstKeyFrame: 0, lastKeyFrame: 3 },
    { firstKeyId: 'C', keyIds: ['C'], firstKeyFrame: 5, lastKeyFrame: 5 },
  ];

  it('resolves a real key to its own keyId (Key Rail member included)', () => {
    expect(resolvePhysicPaintPushAnchor(0, { keyIdByAppFrame, loopIdByAppFrame, keyRailSegments }))
      .toEqual({ kind: 'key', id: 'A' });
    expect(resolvePhysicPaintPushAnchor(3, { keyIdByAppFrame, loopIdByAppFrame, keyRailSegments }))
      .toEqual({ kind: 'key', id: 'B' });
  });

  it('resolves a generated in-between frame to its containing Key Rail first key', () => {
    expect(resolvePhysicPaintPushAnchor(1, { keyIdByAppFrame, loopIdByAppFrame, keyRailSegments }))
      .toEqual({ kind: 'key', id: 'A' });
    expect(resolvePhysicPaintPushAnchor(2, { keyIdByAppFrame, loopIdByAppFrame, keyRailSegments }))
      .toEqual({ kind: 'key', id: 'A' });
  });

  it('resolves a linked occurrence inside a Group to the Group loopId', () => {
    const withLoop = new Map<number, string>([[1, 'loop-G']]);
    expect(resolvePhysicPaintPushAnchor(1, { keyIdByAppFrame, loopIdByAppFrame: withLoop, keyRailSegments }))
      .toEqual({ kind: 'loop', id: 'loop-G' });
  });

  it('returns null for an empty/gap frame', () => {
    expect(resolvePhysicPaintPushAnchor(4, { keyIdByAppFrame, loopIdByAppFrame, keyRailSegments }))
      .toBeNull();
  });
});

describe('Key Rail copy family', () => {
  const multiple = Object.freeze({
    firstKeyId: 'A',
    keyIds: Object.freeze(['A', 'B', 'C']),
    firstKeyFrame: 2,
    lastKeyFrame: 8,
  });
  const single = Object.freeze({
    firstKeyId: 'A',
    keyIds: Object.freeze(['A']),
    firstKeyFrame: 2,
    lastKeyFrame: 2,
  });

  it('emits the four locked singular and plural forms without advertising Scissor', () => {
    const copies = [
      buildKeyRailBaseCopy(multiple),
      buildKeyRailBaseCopy(single),
      buildSelectedKeyRailCopy(multiple),
      buildSelectedKeyRailCopy(single),
    ];

    expect(copies).toEqual([
      'Key Rail — frames 2–8, 3 keys.',
      'Key Rail — frame 2, 1 key.',
      'Selected Key Rail — frames 2–8, 3 keys. Drag to move. Delete removes all keys in this rail.',
      'Selected Key Rail — frame 2, 1 key. Drag to move. Delete removes this rail.',
    ]);
    expect(copies.every((copy) => !copy.includes('Scissor'))).toBe(true);
  });

  it('substitutes exact guarded reasons for unavailable selected actions', () => {
    expect(buildSelectedKeyRailCopy(multiple, {
      dragUnavailableReason: 'No empty space in that direction.',
      deleteUnavailableReason: 'Delete is unavailable.',
    })).toBe(
      'Selected Key Rail — frames 2–8, 3 keys. No empty space in that direction. Delete is unavailable.',
    );
  });
});
