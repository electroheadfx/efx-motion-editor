import { describe, expect, it } from 'vitest';
import {
  PHYSIC_PAINT_ROTO_RAIL_MOTION_CHANNEL_ORDER,
  PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY,
  RAIL_MOTION_FRAME_LIMIT,
  RAIL_MOTION_POSITION_LIMIT_PX,
  RAIL_MOTION_WIGGLE_LIMIT,
  canonicalizeRailMotionChannels,
  railMotionValueFromUi,
  railMotionValueIsValid,
  railMotionValueToUi,
  type PhysicPaintRotoRailMotionChannel,
  type PhysicPaintRotoRailMotionChannelId,
  type PhysicPaintRotoRailMotionKey,
} from './railMotionModel';

function key(
  frame: number,
  value: number,
  easing: 'hold' | 'ease' = 'ease',
  wiggle = 0,
): PhysicPaintRotoRailMotionKey {
  return { frame, value, easing, wiggle };
}

function channel(
  id: PhysicPaintRotoRailMotionChannelId,
  keys: readonly PhysicPaintRotoRailMotionKey[],
): PhysicPaintRotoRailMotionChannel {
  return { id, keys };
}

const POSITION_IDS = ['position-x', 'position-y'] as const;

describe('rail motion channel union', () => {
  it('accepts exactly the five model channel ids and rejects the lane id', () => {
    expect(PHYSIC_PAINT_ROTO_RAIL_MOTION_CHANNEL_ORDER).toEqual([
      'position-x',
      'position-y',
      'scale',
      'rotation',
      'opacity',
    ]);
    for (const id of PHYSIC_PAINT_ROTO_RAIL_MOTION_CHANNEL_ORDER) {
      expect(railMotionValueIsValid(id, 1)).toBe(true);
    }
    expect(railMotionValueIsValid('position' as PhysicPaintRotoRailMotionChannelId, 0)).toBe(false);
    expect(railMotionValueIsValid('bogus' as PhysicPaintRotoRailMotionChannelId, 0)).toBe(false);
  });

  it('freezes the channel order and the empty collection', () => {
    expect(Object.isFrozen(PHYSIC_PAINT_ROTO_RAIL_MOTION_CHANNEL_ORDER)).toBe(true);
    expect(Object.isFrozen(PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY)).toBe(true);
    expect(PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY).toEqual([]);
  });
});

describe('rail motion value domains', () => {
  it('bounds Position to plus or minus 1,000,000 px', () => {
    expect(RAIL_MOTION_POSITION_LIMIT_PX).toBe(1_000_000);
    for (const id of POSITION_IDS) {
      expect(railMotionValueIsValid(id, 0)).toBe(true);
      expect(railMotionValueIsValid(id, RAIL_MOTION_POSITION_LIMIT_PX)).toBe(true);
      expect(railMotionValueIsValid(id, -RAIL_MOTION_POSITION_LIMIT_PX)).toBe(true);
      expect(railMotionValueIsValid(id, RAIL_MOTION_POSITION_LIMIT_PX + 1)).toBe(false);
      expect(railMotionValueIsValid(id, -RAIL_MOTION_POSITION_LIMIT_PX - 1)).toBe(false);
      expect(railMotionValueIsValid(id, Number.NaN)).toBe(false);
      expect(railMotionValueIsValid(id, Number.POSITIVE_INFINITY)).toBe(false);
    }
  });

  it('requires Scale to be finite and strictly positive', () => {
    expect(railMotionValueIsValid('scale', 1)).toBe(true);
    expect(railMotionValueIsValid('scale', 0.25)).toBe(true);
    expect(railMotionValueIsValid('scale', 1_000)).toBe(true);
    expect(railMotionValueIsValid('scale', 0)).toBe(false);
    expect(railMotionValueIsValid('scale', -1)).toBe(false);
    expect(railMotionValueIsValid('scale', Number.NaN)).toBe(false);
    expect(railMotionValueIsValid('scale', Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('accepts any finite Rotation, including negative and beyond 360, with no wrap', () => {
    for (const value of [0, 360, 720, -90, -720.5, 0.001]) {
      expect(railMotionValueIsValid('rotation', value)).toBe(true);
    }
    expect(railMotionValueIsValid('rotation', Number.NaN)).toBe(false);
    expect(railMotionValueIsValid('rotation', Number.NEGATIVE_INFINITY)).toBe(false);
  });

  it('bounds Opacity to the inclusive 0..1 fraction', () => {
    expect(railMotionValueIsValid('opacity', 0)).toBe(true);
    expect(railMotionValueIsValid('opacity', 1)).toBe(true);
    expect(railMotionValueIsValid('opacity', 0.5)).toBe(true);
    expect(railMotionValueIsValid('opacity', -0.001)).toBe(false);
    expect(railMotionValueIsValid('opacity', 1.001)).toBe(false);
    expect(railMotionValueIsValid('opacity', Number.NaN)).toBe(false);
  });

  it('pins the frame and wiggle limits at 1,000,000', () => {
    expect(RAIL_MOTION_FRAME_LIMIT).toBe(1_000_000);
    expect(RAIL_MOTION_WIGGLE_LIMIT).toBe(1_000_000);
  });
});

describe('rail motion UI conversions', () => {
  it('keeps Position in px one to one', () => {
    expect(railMotionValueToUi('position-x', 42.5)).toBe(42.5);
    expect(railMotionValueToUi('position-y', -12)).toBe(-12);
    expect(railMotionValueFromUi('position-x', 42.5)).toBe(42.5);
    expect(railMotionValueFromUi('position-y', -12)).toBe(-12);
  });

  it('converts Scale to percent and back', () => {
    expect(railMotionValueToUi('scale', 1)).toBe(100);
    expect(railMotionValueToUi('scale', 0.33)).toBeCloseTo(33, 10);
    expect(railMotionValueFromUi('scale', 100)).toBe(1);
    expect(railMotionValueFromUi('scale', 33)).toBeCloseTo(0.33, 10);
  });

  it('keeps Rotation in degrees one to one and never wraps', () => {
    expect(railMotionValueToUi('rotation', -90)).toBe(-90);
    expect(railMotionValueToUi('rotation', 360)).toBe(360);
    expect(railMotionValueToUi('rotation', 720)).toBe(720);
    expect(railMotionValueFromUi('rotation', 720)).toBe(720);
    expect(railMotionValueFromUi('rotation', -90)).toBe(-90);
  });

  it('converts Opacity to percent and back', () => {
    expect(railMotionValueToUi('opacity', 1)).toBe(100);
    expect(railMotionValueToUi('opacity', 0.5)).toBe(50);
    expect(railMotionValueFromUi('opacity', 100)).toBe(1);
    expect(railMotionValueFromUi('opacity', 50)).toBe(0.5);
  });
});

describe('canonicalizeRailMotionChannels', () => {
  it('sorts channels into the fixed order and each channel by frame ascending', () => {
    const channels = [
      channel('opacity', [key(0, 1), key(3, 0.5)]),
      channel('rotation', [key(2, 90), key(1, 0)]),
      channel('scale', [key(0, 1)]),
      channel('position-y', [key(5, 10), key(0, 0)]),
      channel('position-x', [key(5, 20), key(0, 0)]),
    ];

    const canonical = canonicalizeRailMotionChannels(channels);

    expect(canonical.map((entry) => entry.id)).toEqual([
      'position-x',
      'position-y',
      'scale',
      'rotation',
      'opacity',
    ]);
    expect(canonical.map((entry) => entry.keys.map((entryKey) => entryKey.frame))).toEqual([
      [0, 5],
      [0, 5],
      [0],
      [1, 2],
      [0, 3],
    ]);
    expect(canonical.map((entry) => entry.keys.map((entryKey) => entryKey.value))).toEqual([
      [0, 20],
      [0, 10],
      [1],
      [0, 90],
      [1, 0.5],
    ]);

    // The input is never mutated and never reused as the output.
    expect(channels[0].keys.map((entryKey) => entryKey.frame)).toEqual([0, 3]);
    expect(channels[1].keys.map((entryKey) => entryKey.frame)).toEqual([2, 1]);
    expect(canonical).not.toBe(channels);
  });

  it('returns a deeply frozen array', () => {
    const canonical = canonicalizeRailMotionChannels([
      channel('position-x', [key(0, 0)]),
      channel('position-y', [key(0, 0)]),
      channel('scale', [key(0, 1)]),
    ]);

    expect(Object.isFrozen(canonical)).toBe(true);
    for (const entry of canonical) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.keys)).toBe(true);
      for (const entryKey of entry.keys) expect(Object.isFrozen(entryKey)).toBe(true);
    }
  });

  it('throws on a duplicate channel id', () => {
    expect(() => canonicalizeRailMotionChannels([
      channel('scale', [key(0, 1)]),
      channel('scale', [key(1, 2)]),
    ])).toThrow(/duplicate channel id/);
  });

  it('throws on a duplicate frame inside one channel', () => {
    expect(() => canonicalizeRailMotionChannels([
      channel('scale', [key(2, 1), key(2, 2)]),
    ])).toThrow(/duplicate frame/);
  });

  it('throws on an unknown channel id', () => {
    expect(() => canonicalizeRailMotionChannels([
      channel('position' as PhysicPaintRotoRailMotionChannelId, [key(0, 0)]),
    ])).toThrow(/unknown channel id/);
  });

  it('throws on a channel with no keys', () => {
    expect(() => canonicalizeRailMotionChannels([
      channel('scale', []),
    ])).toThrow(/at least one key/);
  });

  it('rejects a lone Position axis (D-12)', () => {
    expect(() => canonicalizeRailMotionChannels([
      channel('position-x', [key(0, 0)]),
    ])).toThrow(/position-x and position-y must both be present/);
    expect(() => canonicalizeRailMotionChannels([
      channel('position-y', [key(0, 0)]),
    ])).toThrow(/position-x and position-y must both be present/);
  });

  it('rejects Position axes with different frames (D-12)', () => {
    expect(() => canonicalizeRailMotionChannels([
      channel('position-x', [key(0, 0), key(4, 10)]),
      channel('position-y', [key(0, 0), key(5, 10)]),
    ])).toThrow(/identical frame set/);
  });

  it('rejects an out-of-domain key value', () => {
    expect(() => canonicalizeRailMotionChannels([
      channel('opacity', [key(0, 1.5)]),
    ])).toThrow(/outside the channel domain/);
  });
});
