import { describe, expect, it } from 'vitest';
import {
  PHYSIC_PAINT_ROTO_RAIL_MOTION_CHANNEL_ORDER,
  PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY,
  RAIL_MOTION_FRAME_LIMIT,
  RAIL_MOTION_POSITION_LIMIT_PX,
  RAIL_MOTION_WIGGLE_LIMIT,
  applyRailMotionEditToCollection,
  canonicalizeRailMotionChannels,
  createPhysicPaintRotoRailId,
  parsePhysicPaintRotoRailMotions,
  railMotionValueFromUi,
  railMotionValueIsValid,
  railMotionValueToUi,
  type PhysicPaintRotoRailMotionChannel,
  type PhysicPaintRotoRailMotionChannelId,
  type PhysicPaintRotoRailMotionEasing,
  type PhysicPaintRotoRailMotionEdit,
  type PhysicPaintRotoRailMotionKey,
  type PhysicPaintRotoRailMotionRecord,
} from './railMotionModel';
import { evaluateRailMotionChannel } from './railMotionEvaluator';

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
        { ...channel('position-x', [key(0, 0)]), enabled: true } as unknown as PhysicPaintRotoRailMotionChannel,
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
        channel('scale', [{ ...key(0, 1), curve: 'bezier' } as unknown as PhysicPaintRotoRailMotionKey]),
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

function deepFreezeRecords(
  records: readonly PhysicPaintRotoRailMotionRecord[],
): readonly PhysicPaintRotoRailMotionRecord[] {
  for (const entry of records) {
    for (const entryChannel of entry.channels) {
      for (const entryKey of entryChannel.keys) Object.freeze(entryKey);
      Object.freeze(entryChannel.keys);
      Object.freeze(entryChannel);
    }
    Object.freeze(entry.channels);
    Object.freeze(entry);
  }
  return Object.freeze(records);
}

function animatedAt(frame: number, railId = 'rail-a'): PhysicPaintRotoRailMotionRecord {
  return record(railId, positionChannels(frame, 0, 0));
}

describe('applyRailMotionEditToCollection', () => {
  it('animate creates the identity Position pair at the edit frame', () => {
    const records = applyRailMotionEditToCollection(PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY, {
      kind: 'animate',
      railId: 'rail-a',
      anchorKeyId: 'key-1',
      frame: 6,
    });

    expect(records).toHaveLength(1);
    expect(records[0].railId).toBe('rail-a');
    expect(records[0].anchorKeyId).toBe('key-1');
    expect(records[0].channels.map((entry) => entry.id)).toEqual(['position-x', 'position-y']);
    expect(records[0].channels.map((entry) => entry.keys)).toEqual([
      [key(6, 0, 'ease', 0)],
      [key(6, 0, 'ease', 0)],
    ]);
    expect(Object.isFrozen(records)).toBe(true);
    expect(Object.isFrozen(records[0].channels[0].keys[0])).toBe(true);
  });

  it('animate is idempotent and returns the same reference', () => {
    const existing = [record('rail-a', [channel('scale', [key(0, 1)])])];

    const next = applyRailMotionEditToCollection(existing, {
      kind: 'animate',
      railId: 'rail-a',
      anchorKeyId: 'key-1',
      frame: 6,
    });

    expect(next).toBe(existing);
  });

  it('animate never mutates a frozen input and keeps railIds sorted', () => {
    const existing = deepFreezeRecords([record('rail-b', [channel('scale', [key(0, 1)])])]);

    const next = applyRailMotionEditToCollection(existing, {
      kind: 'animate',
      railId: 'rail-a',
      anchorKeyId: 'key-1',
      frame: 2,
    });

    expect(next.map((entry) => entry.railId)).toEqual(['rail-a', 'rail-b']);
    expect(existing).toEqual([record('rail-b', [channel('scale', [key(0, 1)])])]);
  });

  it('set-key inserts a key and writes both Position axes from one edit', () => {
    const records = [animatedAt(0)];

    const next = applyRailMotionEditToCollection(records, {
      kind: 'set-key',
      railId: 'rail-a',
      channel: 'position-x',
      frame: 4,
      value: 10,
      pairedValue: 20,
    });

    expect(next).not.toBe(records);
    expect(next[0].channels[0].keys).toEqual([key(0, 0), key(4, 10)]);
    expect(next[0].channels[1].keys).toEqual([key(0, 0), key(4, 20)]);
  });

  it('set-key holds the sibling value when no paired value is supplied', () => {
    const records = [record('rail-a', [
      channel('position-x', [key(0, 5), key(8, 15)]),
      channel('position-y', [key(0, 7), key(8, 9)]),
    ])];

    const next = applyRailMotionEditToCollection(records, {
      kind: 'set-key',
      railId: 'rail-a',
      channel: 'position-x',
      frame: 4,
      value: 12,
    });

    expect(next[0].channels[1].keys.map((entry) => entry.frame)).toEqual([0, 4, 8]);
    expect(next[0].channels[1].keys[1].value).toBe(7);
  });

  it('set-key replaces an existing key in place without duplicating the frame', () => {
    const records = [record('rail-a', [channel('scale', [key(0, 1), key(3, 2)])])];

    const next = applyRailMotionEditToCollection(records, {
      kind: 'set-key',
      railId: 'rail-a',
      channel: 'scale',
      frame: 3,
      value: 4,
    });

    expect(next[0].channels[0].keys).toEqual([key(0, 1), key(3, 4)]);
  });

  it('set-key defaults a new key to ease/0 and preserves an existing key fields', () => {
    const records = [record('rail-a', [channel('scale', [key(0, 1, 'hold', 5), key(3, 2, 'hold', 5)])])];

    const replaced = applyRailMotionEditToCollection(records, {
      kind: 'set-key',
      railId: 'rail-a',
      channel: 'scale',
      frame: 3,
      value: 4,
    });
    expect(replaced[0].channels[0].keys[1]).toEqual(key(3, 4, 'hold', 5));

    const inserted = applyRailMotionEditToCollection(records, {
      kind: 'set-key',
      railId: 'rail-a',
      channel: 'scale',
      frame: 9,
      value: 4,
    });
    expect(inserted[0].channels[0].keys[2]).toEqual(key(9, 4, 'ease', 0));
  });

  it('set-key accepts an explicit easing and wiggle on insert', () => {
    const records = [record('rail-a', [channel('scale', [key(0, 1)])])];

    const next = applyRailMotionEditToCollection(records, {
      kind: 'set-key',
      railId: 'rail-a',
      channel: 'scale',
      frame: 2,
      value: 3,
      easing: 'hold',
      wiggle: 12,
    });

    expect(next[0].channels[0].keys[1]).toEqual(key(2, 3, 'hold', 12));
  });

  it('set-key on an unknown rail creates no record (D-08)', () => {
    const records = [animatedAt(0)];

    expect(applyRailMotionEditToCollection(records, {
      kind: 'set-key',
      railId: 'rail-missing',
      channel: 'scale',
      frame: 1,
      value: 2,
    })).toBe(records);
  });

  it('set-key on a channel with no motion is a no-op (D-08)', () => {
    const records = [record('rail-a', [channel('rotation', [key(0, 0)])])];

    expect(applyRailMotionEditToCollection(records, {
      kind: 'set-key',
      railId: 'rail-a',
      channel: 'scale',
      frame: 1,
      value: 2,
    })).toBe(records);
  });

  it('set-key preserves the sibling value when replacing a Position key', () => {
    const records = [record('rail-a', [
      channel('position-x', [key(0, 1), key(4, 2)]),
      channel('position-y', [key(0, 3), key(4, 4)]),
    ])];

    const next = applyRailMotionEditToCollection(records, {
      kind: 'set-key',
      railId: 'rail-a',
      channel: 'position-x',
      frame: 4,
      value: 9,
    });

    expect(next[0].channels[0].keys[1].value).toBe(9);
    expect(next[0].channels[1].keys[1].value).toBe(4);
  });

  it('set-key throws on an out-of-domain value, an unknown channel and an invalid frame', () => {
    const records = [record('rail-a', [channel('scale', [key(0, 1)])])];

    expect(() => applyRailMotionEditToCollection(records, {
      kind: 'set-key', railId: 'rail-a', channel: 'scale', frame: 1, value: 0,
    })).toThrow(/outside the channel domain/);
    expect(() => applyRailMotionEditToCollection(records, {
      kind: 'set-key', railId: 'rail-a', channel: 'opacity', frame: 1, value: 1.5,
    })).toThrow(/outside the channel domain/);
    expect(() => applyRailMotionEditToCollection(records, {
      kind: 'set-key',
      railId: 'rail-a',
      channel: 'bogus' as PhysicPaintRotoRailMotionChannelId,
      frame: 1,
      value: 1,
    })).toThrow(/unknown channel id/);
    expect(() => applyRailMotionEditToCollection(records, {
      kind: 'set-key', railId: 'rail-a', channel: 'scale', frame: -1, value: 1,
    })).toThrow(/invalid frame/);
  });

  it('remove-key removes only the addressed key', () => {
    const records = [record('rail-a', [channel('scale', [key(0, 1), key(2, 2), key(5, 3)])])];

    const next = applyRailMotionEditToCollection(records, {
      kind: 'remove-key',
      railId: 'rail-a',
      channel: 'scale',
      frame: 2,
    });

    expect(next[0].channels[0].keys.map((entry) => entry.frame)).toEqual([0, 5]);
  });

  it('grouped Position remove-key removes the frame from both axes', () => {
    const records = [record('rail-a', [
      channel('position-x', [key(0, 0), key(4, 1)]),
      channel('position-y', [key(0, 0), key(4, 2)]),
    ])];

    const next = applyRailMotionEditToCollection(records, {
      kind: 'remove-key',
      railId: 'rail-a',
      channel: 'position-y',
      frame: 4,
    });

    expect(next[0].channels.map((entry) => entry.keys.map((entryKey) => entryKey.frame))).toEqual([[0], [0]]);
  });

  it('remove-key cascades channel removal, then record removal (D-15)', () => {
    const singleKey = [record('rail-a', [channel('scale', [key(0, 1)])])];

    const channelGone = applyRailMotionEditToCollection(singleKey, {
      kind: 'remove-key',
      railId: 'rail-a',
      channel: 'scale',
      frame: 0,
    });
    expect(channelGone).toBe(PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY);

    const withNeighbour = [record('rail-a', [
      channel('scale', [key(0, 1)]),
      channel('rotation', [key(0, 0)]),
    ])];
    const recordKept = applyRailMotionEditToCollection(withNeighbour, {
      kind: 'remove-key',
      railId: 'rail-a',
      channel: 'scale',
      frame: 0,
    });
    expect(recordKept).toHaveLength(1);
    expect(recordKept[0].channels.map((entry) => entry.id)).toEqual(['rotation']);
  });

  it('remove-key on a missing rail, channel or frame is a no-op', () => {
    const records = [record('rail-a', [channel('scale', [key(0, 1)])])];

    expect(applyRailMotionEditToCollection(records, {
      kind: 'remove-key', railId: 'rail-missing', channel: 'scale', frame: 0,
    })).toBe(records);
    expect(applyRailMotionEditToCollection(records, {
      kind: 'remove-key', railId: 'rail-a', channel: 'opacity', frame: 0,
    })).toBe(records);
    expect(applyRailMotionEditToCollection(records, {
      kind: 'remove-key', railId: 'rail-a', channel: 'scale', frame: 9,
    })).toBe(records);
  });

  it('add-channel seeds identity keys at frame 0 with ease', () => {
    const records = [record('rail-a', [channel('rotation', [key(2, 45)])])];

    const next = applyRailMotionEditToCollection(records, {
      kind: 'add-channel',
      railId: 'rail-a',
      channel: 'scale',
    });

    expect(next[0].channels.map((entry) => entry.id)).toEqual(['scale', 'rotation']);
    expect(next[0].channels[0].keys).toEqual([key(0, 1, 'ease', 0)]);

    const opacity = applyRailMotionEditToCollection(next, {
      kind: 'add-channel',
      railId: 'rail-a',
      channel: 'opacity',
    });
    expect(opacity[0].channels[2].keys).toEqual([key(0, 1, 'ease', 0)]);

    const rotation = applyRailMotionEditToCollection(records, {
      kind: 'add-channel',
      railId: 'rail-a',
      channel: 'rotation',
    });
    expect(rotation).toBe(records);
  });

  it('add-channel seeds both Position axes with zero', () => {
    const records = [record('rail-a', [channel('scale', [key(0, 1)])])];

    const next = applyRailMotionEditToCollection(records, {
      kind: 'add-channel',
      railId: 'rail-a',
      channel: 'position-y',
    });

    expect(next[0].channels.map((entry) => entry.id)).toEqual(['position-x', 'position-y', 'scale']);
    expect(next[0].channels[0].keys).toEqual([key(0, 0, 'ease', 0)]);
    expect(next[0].channels[1].keys).toEqual([key(0, 0, 'ease', 0)]);
  });

  it('a newly added channel eases its FIRST span toward the next written key (261107-ux2)', () => {
    const seeded = applyRailMotionEditToCollection(
      [record('rail-a', [channel('rotation', [key(2, 45)])])],
      { kind: 'add-channel', railId: 'rail-a', channel: 'scale' },
    );
    const withFour = applyRailMotionEditToCollection(seeded, {
      kind: 'set-key',
      railId: 'rail-a',
      channel: 'scale',
      frame: 4,
      value: 3,
    });
    const records = applyRailMotionEditToCollection(withFour, {
      kind: 'set-key',
      railId: 'rail-a',
      channel: 'scale',
      frame: 9,
      value: 5,
    });
    const evaluated = records[0];

    expect(evaluateRailMotionChannel(evaluated, 'scale', 0)).toBe(1);
    expect(evaluateRailMotionChannel(evaluated, 'scale', 4)).toBe(3);
    expect(evaluateRailMotionChannel(evaluated, 'scale', 9)).toBe(5);
    // Frame 2 is the exact midpoint of the 1..3 opening span:
    // 1 + (3 - 1) * smoothstep(0.5) = 2.
    expect(evaluateRailMotionChannel(evaluated, 'scale', 2)).toBe(2);
    // Frame 6 sits on the SECOND span (3..5) and must also interpolate.
    const laterSpan = evaluateRailMotionChannel(evaluated, 'scale', 6);
    expect(laterSpan).toBeGreaterThan(3);
    expect(laterSpan).toBeLessThan(5);
  });

  it('a grouped Position pair eases BOTH axes on the first span from the seeded identity', () => {
    const seeded = applyRailMotionEditToCollection(
      [record('rail-a', [channel('scale', [key(0, 1)])])],
      { kind: 'add-channel', railId: 'rail-a', channel: 'position-x' },
    );
    const records = applyRailMotionEditToCollection(seeded, {
      kind: 'set-key',
      railId: 'rail-a',
      channel: 'position-x',
      frame: 4,
      value: 100,
      pairedValue: 40,
    });
    const evaluated = records[0];

    expect(evaluateRailMotionChannel(evaluated, 'position-x', 0)).toBe(0);
    expect(evaluateRailMotionChannel(evaluated, 'position-y', 0)).toBe(0);
    expect(evaluateRailMotionChannel(evaluated, 'position-x', 4)).toBe(100);
    expect(evaluateRailMotionChannel(evaluated, 'position-y', 4)).toBe(40);
    // Frame 2 is the exact midpoint of the 0..100 / 0..40 opening spans.
    expect(evaluateRailMotionChannel(evaluated, 'position-x', 2)).toBe(50);
    expect(evaluateRailMotionChannel(evaluated, 'position-y', 2)).toBe(20);
  });

  it('a channel carrying ONLY the seeded opening key still evaluates to its identity everywhere', () => {
    const records = applyRailMotionEditToCollection(
      [record('rail-a', [channel('rotation', [key(2, 45)])])],
      { kind: 'add-channel', railId: 'rail-a', channel: 'scale' },
    );

    expect(evaluateRailMotionChannel(records[0], 'scale', 0)).toBe(1);
    expect(evaluateRailMotionChannel(records[0], 'scale', 5)).toBe(1);
  });

  it('an explicit per-key Hold still steps the outgoing span', () => {
    const records = [record('rail-a', [
      channel('position-x', [key(0, 0, 'hold'), key(10, 100)]),
    ])];

    expect(evaluateRailMotionChannel(records[0], 'position-x', 5)).toBe(0);
    expect(evaluateRailMotionChannel(records[0], 'position-x', 10)).toBe(100);
  });

  it('add-channel on an existing channel or an unknown rail is a no-op', () => {
    const records = [record('rail-a', [channel('scale', [key(0, 1)])])];

    expect(applyRailMotionEditToCollection(records, {
      kind: 'add-channel', railId: 'rail-a', channel: 'scale',
    })).toBe(records);
    expect(applyRailMotionEditToCollection(records, {
      kind: 'add-channel', railId: 'rail-missing', channel: 'opacity',
    })).toBe(records);
  });

  it('remove-channel removes a channel and the record when it was the last one', () => {
    const records = [record('rail-a', [
      channel('scale', [key(0, 1)]),
      channel('rotation', [key(0, 0)]),
    ])];

    const scaleGone = applyRailMotionEditToCollection(records, {
      kind: 'remove-channel',
      railId: 'rail-a',
      channel: 'scale',
    });
    expect(scaleGone[0].channels.map((entry) => entry.id)).toEqual(['rotation']);

    expect(applyRailMotionEditToCollection(scaleGone, {
      kind: 'remove-channel',
      railId: 'rail-a',
      channel: 'rotation',
    })).toBe(PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY);
  });

  it('remove-channel removing either Position axis removes both axes', () => {
    const records = [record('rail-a', [
      channel('position-x', [key(0, 0)]),
      channel('position-y', [key(0, 0)]),
      channel('scale', [key(0, 1)]),
    ])];

    const next = applyRailMotionEditToCollection(records, {
      kind: 'remove-channel',
      railId: 'rail-a',
      channel: 'position-y',
    });

    expect(next[0].channels.map((entry) => entry.id)).toEqual(['scale']);
  });

  it('remove-channel on a missing channel or an unknown rail is a no-op', () => {
    const records = [record('rail-a', [channel('scale', [key(0, 1)])])];

    expect(applyRailMotionEditToCollection(records, {
      kind: 'remove-channel', railId: 'rail-a', channel: 'opacity',
    })).toBe(records);
    expect(applyRailMotionEditToCollection(records, {
      kind: 'remove-channel', railId: 'rail-missing', channel: 'scale',
    })).toBe(records);
  });

  it('move-key moves the addressed key in place and keeps its value, easing and wiggle', () => {
    const records = [record('rail-a', [channel('scale', [key(0, 1), key(3, 2, 'hold', 4)])])];

    const next = applyRailMotionEditToCollection(records, {
      kind: 'move-key',
      railId: 'rail-a',
      channel: 'scale',
      fromFrame: 3,
      toFrame: 5,
    });

    expect(next[0].channels[0].keys).toEqual([key(0, 1), key(5, 2, 'hold', 4)]);
  });

  it('move-key moves both grouped Position axes and keeps each axis value', () => {
    const records = [record('rail-a', [
      channel('position-x', [key(0, 0), key(4, 8)]),
      channel('position-y', [key(0, 0), key(4, 9)]),
    ])];

    const next = applyRailMotionEditToCollection(records, {
      kind: 'move-key',
      railId: 'rail-a',
      channel: 'position-y',
      fromFrame: 4,
      toFrame: 7,
    });

    expect(next[0].channels[0].keys).toEqual([key(0, 0), key(7, 8)]);
    expect(next[0].channels[1].keys).toEqual([key(0, 0), key(7, 9)]);
  });

  it('move-key keeps the record when the channel carried only that key (no D-15 cascade)', () => {
    const records = [record('rail-a', [channel('scale', [key(3, 2)])])];

    const next = applyRailMotionEditToCollection(records, {
      kind: 'move-key',
      railId: 'rail-a',
      channel: 'scale',
      fromFrame: 3,
      toFrame: 6,
    });

    expect(next).toHaveLength(1);
    expect(next[0].channels.map((entry) => entry.id)).toEqual(['scale']);
    expect(next[0].channels[0].keys).toEqual([key(6, 2)]);
  });

  it('move-key throws on an occupied destination instead of duplicating a frame', () => {
    const records = [record('rail-a', [channel('scale', [key(0, 1), key(3, 2)])])];

    expect(() => applyRailMotionEditToCollection(records, {
      kind: 'move-key', railId: 'rail-a', channel: 'scale', fromFrame: 3, toFrame: 0,
    })).toThrow(/already carries a key/);
  });

  it('move-key on a no-op frame or an unknown rail returns the same reference', () => {
    const records = [record('rail-a', [channel('scale', [key(0, 1)])])];

    expect(applyRailMotionEditToCollection(records, {
      kind: 'move-key', railId: 'rail-a', channel: 'scale', fromFrame: 0, toFrame: 0,
    })).toBe(records);
    expect(applyRailMotionEditToCollection(records, {
      kind: 'move-key', railId: 'rail-missing', channel: 'scale', fromFrame: 0, toFrame: 2,
    })).toBe(records);
    expect(applyRailMotionEditToCollection(records, {
      kind: 'move-key', railId: 'rail-a', channel: 'scale', fromFrame: 9, toFrame: 2,
    })).toBe(records);
  });

  it('move-key throws when a grouped Position sibling no longer carries the source frame', () => {
    // A record the canonical parser would refuse, built by hand to prove the
    // move never silently desynchronizes the pair.
    const records = [record('rail-a', [
      channel('position-x', [key(0, 0), key(4, 8)]),
      channel('position-y', [key(0, 0), key(5, 9)]),
    ])];

    expect(() => applyRailMotionEditToCollection(records, {
      kind: 'move-key', railId: 'rail-a', channel: 'position-x', fromFrame: 4, toFrame: 6,
    })).toThrow(/grouped key/);
  });

  it('never mutates a deeply frozen input across every edit kind', () => {
    const original = [record('rail-a', [
      channel('position-x', [key(0, 0), key(4, 8)]),
      channel('position-y', [key(0, 0), key(4, 9)]),
      channel('scale', [key(0, 1), key(4, 2)]),
    ])];
    const frozen = deepFreezeRecords(original);
    const snapshot = JSON.parse(JSON.stringify(frozen));
    const edits: readonly PhysicPaintRotoRailMotionEdit[] = [
      { kind: 'animate', railId: 'rail-b', anchorKeyId: 'key-1', frame: 1 },
      { kind: 'set-key', railId: 'rail-a', channel: 'scale', frame: 2, value: 3 },
      { kind: 'remove-key', railId: 'rail-a', channel: 'scale', frame: 4 },
      { kind: 'add-channel', railId: 'rail-a', channel: 'opacity' },
      { kind: 'remove-channel', railId: 'rail-a', channel: 'position-x' },
      { kind: 'move-key', railId: 'rail-a', channel: 'scale', fromFrame: 4, toFrame: 6 },
    ];

    for (const edit of edits) {
      expect(() => applyRailMotionEditToCollection(frozen, edit)).not.toThrow();
    }
    expect(JSON.parse(JSON.stringify(frozen))).toEqual(snapshot);
  });

  it('keeps the collection canonical after edits', () => {
    const records = [
      record('rail-b', [channel('rotation', [key(0, 0)])]),
      record('rail-a', [channel('scale', [key(0, 1)])]),
    ];

    const next = applyRailMotionEditToCollection(records, {
      kind: 'add-channel',
      railId: 'rail-b',
      channel: 'opacity',
    });

    expect(next.map((entry) => entry.railId)).toEqual(['rail-a', 'rail-b']);
    expect(next[1].channels.map((entry) => entry.id)).toEqual(['rotation', 'opacity']);
    expect(Object.isFrozen(next)).toBe(true);
    expect(Object.isFrozen(next[1].channels)).toBe(true);
  });
});
