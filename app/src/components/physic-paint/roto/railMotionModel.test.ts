import { describe, expect, it } from 'vitest';
import {
  PHYSIC_PAINT_ROTO_RAIL_MOTION_CHANNEL_ORDER,
  PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY,
  RAIL_MOTION_FRAME_LIMIT,
  RAIL_MOTION_POSITION_LIMIT_PX,
  RAIL_MOTION_WIGGLE_LIMIT,
  canonicalizeRailMotionChannels,
  createPhysicPaintRotoRailId,
  parsePhysicPaintRotoRailMotions,
  railMotionValueFromUi,
  railMotionValueIsValid,
  railMotionValueToUi,
  type PhysicPaintRotoRailMotionChannel,
  type PhysicPaintRotoRailMotionChannelId,
  type PhysicPaintRotoRailMotionEasing,
  type PhysicPaintRotoRailMotionKey,
  type PhysicPaintRotoRailMotionRecord,
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

function record(
  railId: string,
  channels: readonly PhysicPaintRotoRailMotionChannel[],
  anchorKeyId = `anchor-${railId}`,
): PhysicPaintRotoRailMotionRecord {
  return { railId, anchorKeyId, channels };
}

function positionChannels(
  frame: number,
  x: number,
  y: number,
): PhysicPaintRotoRailMotionChannel[] {
  return [channel('position-x', [key(frame, x)]), channel('position-y', [key(frame, y)])];
}

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

describe('parsePhysicPaintRotoRailMotions', () => {
  it('accepts a canonical record and freezes every level', () => {
    const parsed = parsePhysicPaintRotoRailMotions([
      record('rail-a', positionChannels(0, 10, -10)),
    ]);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].railId).toBe('rail-a');
    expect(parsed[0].anchorKeyId).toBe('anchor-rail-a');
    expect(parsed[0].channels.map((entry) => entry.id)).toEqual(['position-x', 'position-y']);
    expect(parsed[0].channels[0].keys).toEqual([key(0, 10)]);

    expect(Object.isFrozen(parsed)).toBe(true);
    for (const entry of parsed) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.channels)).toBe(true);
      for (const entryChannel of entry.channels) {
        expect(Object.isFrozen(entryChannel)).toBe(true);
        expect(Object.isFrozen(entryChannel.keys)).toBe(true);
        for (const entryKey of entryChannel.keys) expect(Object.isFrozen(entryKey)).toBe(true);
      }
    }
  });

  it('returns the shared frozen empty constant for an empty array', () => {
    expect(parsePhysicPaintRotoRailMotions([])).toBe(PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY);
    expect(parsePhysicPaintRotoRailMotions(PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY)).toBe(
      PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY,
    );
  });

  it('sorts records by railId and channels into the fixed order from shuffled input', () => {
    const parsed = parsePhysicPaintRotoRailMotions([
      record('rail-b', [
        channel('opacity', [key(0, 1)]),
        channel('position-y', [key(0, 0)]),
        channel('scale', [key(0, 1)]),
        channel('position-x', [key(0, 0)]),
      ]),
      record('rail-a', [
        channel('rotation', [key(0, 0)]),
      ]),
    ]);

    expect(parsed.map((entry) => entry.railId)).toEqual(['rail-a', 'rail-b']);
    expect(parsed[1].channels.map((entry) => entry.id)).toEqual([
      'position-x',
      'position-y',
      'scale',
      'opacity',
    ]);
  });

  it('sorts each channel by frame ascending from reversed input', () => {
    const parsed = parsePhysicPaintRotoRailMotions([
      record('rail-a', [
        channel('position-x', [key(4, 10), key(0, 0)]),
        channel('position-y', [key(4, 20), key(0, 0)]),
        channel('scale', [key(9, 2), key(1, 1)]),
      ]),
    ]);

    expect(parsed[0].channels.map((entry) => entry.keys.map((entryKey) => entryKey.frame))).toEqual([
      [0, 4],
      [0, 4],
      [1, 9],
    ]);
  });

  it('produces deeply equal frozen output for two parses of the same input', () => {
    const input = [
      record('rail-a', [
        channel('opacity', [key(0, 1), key(2, 0.5)]),
        channel('position-x', [key(0, 0)]),
        channel('position-y', [key(0, 0)]),
      ]),
    ];

    const first = parsePhysicPaintRotoRailMotions(input);
    const second = parsePhysicPaintRotoRailMotions(input);

    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(second)).toBe(true);
  });

  it('rejects a non-array collection', () => {
    for (const value of [null, undefined, {}, 'records', 42, true]) {
      expect(() => parsePhysicPaintRotoRailMotions(value)).toThrow(/PhysicPaintRotoRailMotions: expected an array/);
    }
  });

  it('rejects more than 512 records before validating any record', () => {
    const input = Array.from({ length: 513 }, (_, index) =>
      record(`rail-${String(index).padStart(4, '0')}`, positionChannels(0, 0, 0)),
    );

    expect(() => parsePhysicPaintRotoRailMotions(input)).toThrow(/too many records/);
  });

  it('rejects a duplicate railId', () => {
    expect(() => parsePhysicPaintRotoRailMotions([
      record('rail-a', positionChannels(0, 0, 0)),
      record('rail-a', positionChannels(1, 0, 0)),
    ])).toThrow(/duplicate railId/);
  });

  it('rejects unknown record members', () => {
    expect(() => parsePhysicPaintRotoRailMotions([
      { ...record('rail-a', positionChannels(0, 0, 0)), cycle: 'loop' },
    ])).toThrow(/unknown members.*railId, anchorKeyId, channels/);
  });

  it('rejects an invalid railId or anchorKeyId', () => {
    const validChannels = positionChannels(0, 0, 0);
    expect(() => parsePhysicPaintRotoRailMotions([
      { railId: '', anchorKeyId: 'anchor', channels: validChannels },
    ])).toThrow(/invalid railId/);
    expect(() => parsePhysicPaintRotoRailMotions([
      { railId: 'rail-a', anchorKeyId: '', channels: validChannels },
    ])).toThrow(/invalid anchorKeyId/);

    const overlong = 'x'.repeat(129);
    expect(() => parsePhysicPaintRotoRailMotions([
      { railId: overlong, anchorKeyId: 'anchor', channels: validChannels },
    ])).toThrow(/invalid railId/);
    expect(() => parsePhysicPaintRotoRailMotions([
      { railId: 'rail-a', anchorKeyId: overlong, channels: validChannels },
    ])).toThrow(/invalid anchorKeyId/);
  });

  it('rejects a record with no channels', () => {
    expect(() => parsePhysicPaintRotoRailMotions([
      record('rail-a', []),
    ])).toThrow(/must carry at least one channel/);
  });

  it('rejects more than five channels in one record', () => {
    expect(() => parsePhysicPaintRotoRailMotions([
      record('rail-a', [
        ...positionChannels(0, 0, 0),
        channel('scale', [key(0, 1)]),
        channel('rotation', [key(0, 0)]),
        channel('opacity', [key(0, 1)]),
        channel('opacity', [key(1, 1)]),
      ]),
    ])).toThrow(/at most 5 channels/);
  });

  it('rejects unknown channel members', () => {
    expect(() => parsePhysicPaintRotoRailMotions([
      record('rail-a', [
        { ...channel('position-x', [key(0, 0)]), enabled: true },
        channel('position-y', [key(0, 0)]),
      ]),
    ])).toThrow(/unknown members.*id, keys/);
  });

  it('rejects an unknown channel id, including the lane id', () => {
    expect(() => parsePhysicPaintRotoRailMotions([
      record('rail-a', [channel('position' as PhysicPaintRotoRailMotionChannelId, [key(0, 0)])]),
    ])).toThrow(/unknown channel id/);
  });

  it('rejects a duplicate channel id inside one record', () => {
    expect(() => parsePhysicPaintRotoRailMotions([
      record('rail-a', [
        channel('scale', [key(0, 1)]),
        channel('scale', [key(1, 2)]),
      ]),
    ])).toThrow(/duplicate channel id/);
  });

  it('rejects an empty or oversized key list', () => {
    expect(() => parsePhysicPaintRotoRailMotions([
      record('rail-a', [channel('scale', [])]),
    ])).toThrow(/must carry at least one key/);

    const keys = Array.from({ length: 4097 }, (_, index) => key(index, 1));
    expect(() => parsePhysicPaintRotoRailMotions([
      record('rail-a', [channel('scale', keys)]),
    ])).toThrow(/at most 4096 keys/);
  });

  it('rejects unknown key members', () => {
    expect(() => parsePhysicPaintRotoRailMotions([
      record('rail-a', [
        channel('scale', [{ ...key(0, 1), curve: 'bezier' }]),
      ]),
    ])).toThrow(/unknown members.*frame, value, easing, wiggle/);
  });

  it('rejects an invalid frame', () => {
    for (const frame of [-1, 1.5, RAIL_MOTION_FRAME_LIMIT + 1, Number.NaN, '0']) {
      expect(() => parsePhysicPaintRotoRailMotions([
        record('rail-a', [channel('scale', [{ ...key(0, 1), frame: frame as number }])]),
      ])).toThrow(/invalid frame/);
    }
  });

  it('rejects a duplicate frame inside one channel', () => {
    expect(() => parsePhysicPaintRotoRailMotions([
      record('rail-a', [channel('scale', [key(2, 1), key(2, 2)])]),
    ])).toThrow(/duplicate frame/);
  });

  it('rejects out-of-domain values', () => {
    const rows: readonly [PhysicPaintRotoRailMotionChannelId, number][] = [
      ['scale', 0],
      ['opacity', 1.1],
      ['position-x', Number.NaN],
    ];
    for (const [id, value] of rows) {
      const channels = id.startsWith('position')
        ? [channel('position-x', [key(0, id === 'position-x' ? value : 0)]), channel('position-y', [key(0, 0)])]
        : [channel(id, [key(0, value)])];
      expect(() => parsePhysicPaintRotoRailMotions([
        record('rail-a', channels),
      ])).toThrow(/outside the channel domain/);
    }
  });

  it('rejects an invalid easing', () => {
    expect(() => parsePhysicPaintRotoRailMotions([
      record('rail-a', [
        channel('scale', [{ ...key(0, 1), easing: 'linear' as PhysicPaintRotoRailMotionEasing }]),
      ]),
    ])).toThrow(/invalid easing/);
  });

  it('rejects an invalid wiggle', () => {
    for (const wiggle of [-1, Number.NaN, RAIL_MOTION_WIGGLE_LIMIT + 1]) {
      expect(() => parsePhysicPaintRotoRailMotions([
        record('rail-a', [channel('scale', [key(0, 1, 'ease', wiggle)])]),
      ])).toThrow(/invalid wiggle/);
    }
  });

  it('rejects a lone Position axis (D-12)', () => {
    expect(() => parsePhysicPaintRotoRailMotions([
      record('rail-a', [channel('position-x', [key(0, 0)])]),
    ])).toThrow(/position-x and position-y must both be present/);
    expect(() => parsePhysicPaintRotoRailMotions([
      record('rail-a', [channel('position-y', [key(0, 0)])]),
    ])).toThrow(/position-x and position-y must both be present/);
  });

  it('rejects Position axes with different frame sets (D-12)', () => {
    expect(() => parsePhysicPaintRotoRailMotions([
      record('rail-a', [
        channel('position-x', [key(0, 0), key(4, 10)]),
        channel('position-y', [key(0, 0), key(5, 10)]),
      ]),
    ])).toThrow(/identical frame set/);
  });
});

describe('createPhysicPaintRotoRailId', () => {
  it('mints a fresh v4 UUID per call', () => {
    const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const first = createPhysicPaintRotoRailId();
    const second = createPhysicPaintRotoRailId();

    expect(first).toMatch(pattern);
    expect(second).toMatch(pattern);
    expect(second).not.toBe(first);
  });
});
