import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as railMotionCommandModule from './railMotionCommands';
import * as railMotionIdentityModule from './railMotionIdentity';
import type { RailMotionRailView } from './railMotionIdentity';
import type {
  PhysicPaintRotoRailMotionChannel,
  PhysicPaintRotoRailMotionEasing,
  PhysicPaintRotoRailMotionRecord,
} from './railMotionModel';
import {
  CONTEXTUAL_COMMANDS_BY_SCOPE,
  RAIL_MOTION_SELECTION_SCOPES,
  addMotionChannel,
  animateRail,
  clampRailMotionKeyDragFrame,
  clearSelectionForScope,
  moveMotionKey,
  railMotionCursorFrame,
  removeMotionKey,
  resolveContextualMotionCommands,
  resolveMotionCommandAvailability,
  resolveMotionKeyAtFrame,
  resolveSelectionScope,
  resolveSelectedRailView,
  setMotionKeyAtCursor,
  setMotionKeyEasing,
  setMotionKeyWiggle,
  stepMotionKey,
  writeRailMotionChannelValueAtCursor,
  type RailMotionCommandAvailabilityInput,
  type RailSelectionScopesState,
} from './railMotionCommands';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function railView(overrides: Partial<RailMotionRailView> = {}): RailMotionRailView {
  return Object.freeze({
    railId: null,
    anchorKeyId: 'key-a',
    startFrame: 10,
    endFrameExclusive: 21,
    keyIds: Object.freeze(['key-a', 'key-b']),
    railType: 'standard',
    loopId: null,
    ...overrides,
  }) as RailMotionRailView;
}

function loopView(overrides: Partial<RailMotionRailView> = {}): RailMotionRailView {
  return railView({
    railId: 'loop-1',
    anchorKeyId: 'key-loop-source',
    startFrame: 4,
    endFrameExclusive: 9,
    keyIds: Object.freeze(['key-loop-source']),
    railType: 'motion',
    loopId: 'loop-1',
    ...overrides,
  });
}

type RailMotionViewFrameCountHelper = (
  view: Pick<RailMotionRailView, 'startFrame' | 'endFrameExclusive'> | null,
) => number;

/**
 * 261107-rrp: reached through the module namespace so the RED run reports a
 * real assertion instead of a module link error while the export is absent.
 */
function viewFrameCount(): RailMotionViewFrameCountHelper {
  const helper = (railMotionIdentityModule as unknown as {
    railMotionViewFrameCount?: RailMotionViewFrameCountHelper;
  }).railMotionViewFrameCount;
  expect(typeof helper).toBe('function');
  if (helper === undefined) {
    throw new Error('railMotionIdentity does not export railMotionViewFrameCount');
  }
  return helper;
}

function animate(
  view: RailMotionRailView,
  cursorFrame: number,
  records: readonly PhysicPaintRotoRailMotionRecord[] = [],
  views: readonly RailMotionRailView[] = [view],
) {
  return animateRail({ views, records, view, cursorFrame });
}

describe('59-12 rail motion commands — animate', () => {
  it('binds a Loop Clip rail by its own loopId and mints nothing', () => {
    const result = animate(loopView(), 4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.records).toHaveLength(1);
    expect(result.records[0]!.railId).toBe('loop-1');
    expect(result.records[0]!.railId).not.toMatch(UUID_PATTERN);
  });

  it('mints exactly one rail id for a bare Key Rail and keeps the first key as the anchor hint', () => {
    const result = animate(railView(), 10);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const record = result.records[0]!;
    expect(record.railId).toMatch(UUID_PATTERN);
    expect(record.anchorKeyId).toBe('key-a');
  });

  it('animates Reveal and Static rails the same way — no conversion and no type gate', () => {
    for (const railType of ['reveal', 'static', 'motion', 'standard'] as const) {
      const result = animate(railView({ railType }), 12);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.records).toHaveLength(1);
      expect(result.records[0]!.railId).toMatch(UUID_PATTERN);
      expect(result.records[0]!.anchorKeyId).toBe('key-a');
    }
  });

  it('seeds exactly the grouped Position pair with one value-0 key at the rail-local playhead', () => {
    const result = animate(railView(), 14);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const record = result.records[0]!;
    expect(record.channels.map((channel) => channel.id)).toEqual(['position-x', 'position-y']);
    for (const channel of record.channels) {
      expect(channel.keys).toHaveLength(1);
      expect(channel.keys[0]).toMatchObject({ frame: 4, value: 0 });
    }
  });

  it('never seeds frame 0 when the cursor is elsewhere in the rail (D-02)', () => {
    const result = animate(railView({ startFrame: 30, endFrameExclusive: 41 }), 37);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const channel of result.records[0]!.channels) {
      expect(channel.keys[0]!.frame).toBe(7);
    }
  });

  it('clamps the seeded frame into the rail keyed span at both ends', () => {
    const view = railView({ startFrame: 10, endFrameExclusive: 21 });
    expect(railMotionCursorFrame(view, 5)).toBe(0);
    expect(railMotionCursorFrame(view, 10)).toBe(0);
    expect(railMotionCursorFrame(view, 14)).toBe(4);
    expect(railMotionCursorFrame(view, 20)).toBe(10);
    expect(railMotionCursorFrame(view, 200)).toBe(10);
  });

  it('is idempotent: a second Animate returns the same collection reference', () => {
    const view = railView();
    const first = animate(view, 12);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = animate(view, 12, first.records);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.records).toBe(first.records);
  });

  it('keeps a re-animate on an already-bound view idempotent even without the anchor lookup', () => {
    const view = railView({ railId: 'rail-bound', anchorKeyId: 'key-a' });
    const first = animate(view, 12);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = animate(view, 15, first.records);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.records).toBe(first.records);
  });

  it('never touches a drawing key, loop clip or break: every input stays deep-equal', () => {
    const records: readonly PhysicPaintRotoRailMotionRecord[] = Object.freeze([]);
    const views = Object.freeze([loopView(), railView()]);
    const drawingKeys = Object.freeze([
      Object.freeze({ keyId: 'key-a', appFrame: 10 }),
      Object.freeze({ keyId: 'key-b', appFrame: 20 }),
    ]);
    const loopClips = Object.freeze([Object.freeze({ loopId: 'loop-1', placementStart: 4 })]);
    const breaks = Object.freeze(['key-a']);

    const result = animate(railView(), 13, records, views);
    expect(result.ok).toBe(true);
    expect(records).toEqual([]);
    expect(views.map((view) => view.anchorKeyId)).toEqual(['key-loop-source', 'key-a']);
    expect(drawingKeys).toEqual([
      { keyId: 'key-a', appFrame: 10 },
      { keyId: 'key-b', appFrame: 20 },
    ]);
    expect(loopClips).toEqual([{ loopId: 'loop-1', placementStart: 4 }]);
    expect(breaks).toEqual(['key-a']);
  });

  it('fails with a plain sentence when the playhead is not a valid frame', () => {
    const result = animate(railView(), Number.NaN);
    expect(result).toEqual({ ok: false, reason: 'The playhead is not on a valid frame.' });
  });
});

describe('59-12 rail motion commands — selected rail view resolution', () => {
  it('resolves a Loop Clip rail through its loopId and a Key Rail through its first key', () => {
    const views = [loopView(), railView({ railId: 'rail-bound', anchorKeyId: 'key-a' })];
    expect(resolveSelectedRailView(views, { kind: 'loop', loopId: 'loop-1' })?.railId).toBe('loop-1');
    expect(resolveSelectedRailView(views, { kind: 'key-rail', firstKeyId: 'key-a' })?.railId).toBe('rail-bound');
    expect(resolveSelectedRailView(views, { kind: 'key-rail', firstKeyId: 'missing' })).toBeNull();
    expect(resolveSelectedRailView(views, null)).toBeNull();
  });
});

function motionKey(
  frame: number,
  value: number,
  easing: PhysicPaintRotoRailMotionEasing = 'ease',
  wiggle = 0,
) {
  return Object.freeze({ frame, value, easing, wiggle });
}

function motionChannel(
  id: PhysicPaintRotoRailMotionChannel['id'],
  keys: ReturnType<typeof motionKey>[],
): PhysicPaintRotoRailMotionChannel {
  return Object.freeze({ id, keys: Object.freeze(keys) });
}

/** Position x 0 -> 100, y 0 -> 50 across rail-local frames 0..10. */
function motionRecord(
  overrides: Partial<PhysicPaintRotoRailMotionRecord> = {},
): PhysicPaintRotoRailMotionRecord {
  return Object.freeze({
    railId: 'rail-1',
    anchorKeyId: 'key-a',
    channels: Object.freeze([
      motionChannel('position-x', [motionKey(0, 0), motionKey(10, 100)]),
      motionChannel('position-y', [motionKey(0, 0), motionKey(10, 50)]),
      motionChannel('scale', [motionKey(0, 1), motionKey(10, 2)]),
      motionChannel('rotation', [motionKey(4, 0)]),
    ]),
    ...overrides,
  }) as PhysicPaintRotoRailMotionRecord;
}

/** A record with one single-key channel, so removing its last key empties the rail. */
function soleChannelRecord(): PhysicPaintRotoRailMotionRecord {
  return Object.freeze({
    railId: 'rail-sole',
    anchorKeyId: 'key-a',
    channels: Object.freeze([motionChannel('scale', [motionKey(3, 1.5)])]),
  }) as PhysicPaintRotoRailMotionRecord;
}

function recordOf(
  records: readonly PhysicPaintRotoRailMotionRecord[],
  railId = 'rail-1',
): PhysicPaintRotoRailMotionRecord {
  const record = records.find((entry) => entry.railId === railId);
  if (record === undefined) throw new Error(`missing record ${railId}`);
  return record;
}

function channelOf(
  record: PhysicPaintRotoRailMotionRecord,
  id: PhysicPaintRotoRailMotionChannel['id'],
): PhysicPaintRotoRailMotionChannel {
  const channel = record.channels.find((entry) => entry.id === id);
  if (channel === undefined) throw new Error(`missing channel ${id}`);
  return channel;
}

describe('59-12 rail motion commands — Motion keys', () => {
  it('adds a key at the rail-local cursor with the channel current evaluated value', () => {
    const records = [motionRecord()];
    const result = setMotionKeyAtCursor({
      records,
      railId: 'rail-1',
      channelId: 'position-x',
      keyFrame: 5,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const x = channelOf(recordOf(result.records), 'position-x');
    expect(x.keys.map((key) => key.frame)).toEqual([0, 5, 10]);
    expect(x.keys.find((key) => key.frame === 5)?.value).toBe(50);
    // The grouped Position sibling is seeded with ITS evaluated value (D-12).
    const y = channelOf(recordOf(result.records), 'position-y');
    expect(y.keys.find((key) => key.frame === 5)?.value).toBe(25);
  });

  it('updates an existing frame in place without duplicating it', () => {
    const result = setMotionKeyAtCursor({
      records: [motionRecord()],
      railId: 'rail-1',
      channelId: 'position-x',
      keyFrame: 10,
      value: 250,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const x = channelOf(recordOf(result.records), 'position-x');
    expect(x.keys.filter((key) => key.frame === 10)).toHaveLength(1);
    expect(x.keys.find((key) => key.frame === 10)?.value).toBe(250);
  });

  it('writes both grouped Position axes atomically in one command call', () => {
    const result = setMotionKeyAtCursor({
      records: [motionRecord()],
      railId: 'rail-1',
      channelId: 'position-y',
      keyFrame: 6,
      value: 70,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const record = recordOf(result.records);
    expect(channelOf(record, 'position-x').keys.map((key) => key.frame)).toContain(6);
    expect(channelOf(record, 'position-y').keys.find((key) => key.frame === 6)?.value).toBe(70);
  });

  it('removes only the addressed key and keeps the rest of the rail', () => {
    const result = removeMotionKey({
      records: [motionRecord()],
      railId: 'rail-1',
      channelId: 'position-x',
      keyFrame: 10,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const record = recordOf(result.records);
    expect(result.recordRemoved).toBe(false);
    expect(channelOf(record, 'position-x').keys.map((key) => key.frame)).toEqual([0]);
    expect(channelOf(record, 'position-y').keys.map((key) => key.frame)).toEqual([0]);
    expect(channelOf(record, 'scale').keys.map((key) => key.frame)).toEqual([0, 10]);
  });

  it('removes a channel when its last key is removed', () => {
    const first = removeMotionKey({
      records: [motionRecord()],
      railId: 'rail-1',
      channelId: 'rotation',
      keyFrame: 4,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.records[0]!.channels.some((channel) => channel.id === 'rotation')).toBe(false);
    expect(first.records[0]!.channels.length).toBe(3);
  });

  it('removes the record and reports recordRemoved when the rail last channel empties', () => {
    const result = removeMotionKey({
      records: [soleChannelRecord()],
      railId: 'rail-sole',
      channelId: 'scale',
      keyFrame: 3,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.records).toEqual([]);
    expect(result.recordRemoved).toBe(true);
  });

  it('removes a Motion key at a frame that carries none with a plain reason', () => {
    const result = removeMotionKey({
      records: [motionRecord()],
      railId: 'rail-1',
      channelId: 'position-x',
      keyFrame: 7,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason.trim().length).toBeGreaterThan(0);
  });

  it('refuses to edit a rail that carries no motion', () => {
    const result = setMotionKeyAtCursor({
      records: [],
      railId: 'rail-missing',
      channelId: 'position-x',
      keyFrame: 2,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason.trim().length).toBeGreaterThan(0);
  });

  it('steps to the adjacent key frame without wrapping', () => {
    const channel = channelOf(motionRecord(), 'scale');
    expect(stepMotionKey({ channel, fromFrame: 5, direction: -1 })).toBe(0);
    expect(stepMotionKey({ channel, fromFrame: 5, direction: 1 })).toBe(10);
    expect(stepMotionKey({ channel, fromFrame: 0, direction: -1 })).toBeNull();
    expect(stepMotionKey({ channel, fromFrame: 10, direction: 1 })).toBeNull();
  });

  it('accepts only hold and ease and preserves the key value', () => {
    const result = setMotionKeyEasing({
      records: [motionRecord()],
      railId: 'rail-1',
      channelId: 'rotation',
      keyFrame: 4,
      easing: 'hold',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const key = channelOf(recordOf(result.records), 'rotation').keys[0]!;
    expect(key).toMatchObject({ frame: 4, value: 0, easing: 'hold' });

    const rejected = setMotionKeyEasing({
      records: [motionRecord()],
      railId: 'rail-1',
      channelId: 'rotation',
      keyFrame: 4,
      easing: 'bounce' as unknown as PhysicPaintRotoRailMotionEasing,
    });
    expect(rejected.ok).toBe(false);
    if (rejected.ok) return;
    expect(rejected.reason.trim().length).toBeGreaterThan(0);
  });

  it('bounds Wiggle to 0..1,000,000 and rejects non-finite or negative values', () => {
    const applied = setMotionKeyWiggle({
      records: [motionRecord()],
      railId: 'rail-1',
      channelId: 'scale',
      keyFrame: 10,
      wiggle: 12,
    });
    expect(applied.ok).toBe(true);
    if (applied.ok) {
      expect(channelOf(recordOf(applied.records), 'scale').keys.find((key) => key.frame === 10)?.wiggle).toBe(12);
    }
    expect(setMotionKeyWiggle({
      records: [motionRecord()],
      railId: 'rail-1',
      channelId: 'scale',
      keyFrame: 10,
      wiggle: 1_000_000,
    }).ok).toBe(true);

    for (const wiggle of [-1, Number.NaN, Number.POSITIVE_INFINITY, 1_000_001]) {
      const result = setMotionKeyWiggle({
        records: [motionRecord()],
        railId: 'rail-1',
        channelId: 'scale',
        keyFrame: 10,
        wiggle,
      });
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.reason.trim().length).toBeGreaterThan(0);
    }
  });

  it('fans grouped Position easing out to BOTH axes, each keeping its own value', () => {
    const result = setMotionKeyEasing({
      records: [motionRecord()],
      railId: 'rail-1',
      channelId: 'position-x',
      keyFrame: 10,
      easing: 'hold',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const record = recordOf(result.records);
    const x = channelOf(record, 'position-x');
    const y = channelOf(record, 'position-y');

    expect(x.keys.map((key) => key.frame).join(',')).toBe('0,10');
    expect(y.keys.map((key) => key.frame).join(',')).toBe('0,10');
    expect(x.keys.map((key) => key.easing).join(',')).toBe('ease,hold');
    expect(y.keys.map((key) => key.easing).join(',')).toBe('ease,hold');
    expect(x.keys[1]?.value).toBe(100);
    expect(y.keys[1]?.value).toBe(50);
  });

  it('produces the same both-axis easing result when the grouped lane addresses position-y', () => {
    const result = setMotionKeyEasing({
      records: [motionRecord()],
      railId: 'rail-1',
      channelId: 'position-y',
      keyFrame: 10,
      easing: 'hold',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const record = recordOf(result.records);

    expect(channelOf(record, 'position-x').keys.map((key) => key.easing).join(',')).toBe('ease,hold');
    expect(channelOf(record, 'position-y').keys.map((key) => key.easing).join(',')).toBe('ease,hold');
    expect(channelOf(record, 'position-x').keys[1]?.value).toBe(100);
    expect(channelOf(record, 'position-y').keys[1]?.value).toBe(50);
  });

  it('fans grouped Position Wiggle out to BOTH axes without moving values or easing', () => {
    const result = setMotionKeyWiggle({
      records: [motionRecord()],
      railId: 'rail-1',
      channelId: 'position-x',
      keyFrame: 10,
      wiggle: 12,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const record = recordOf(result.records);
    const x = channelOf(record, 'position-x');
    const y = channelOf(record, 'position-y');

    expect(x.keys.map((key) => key.wiggle).join(',')).toBe('0,12');
    expect(y.keys.map((key) => key.wiggle).join(',')).toBe('0,12');
    expect(x.keys.map((key) => key.value).join(',')).toBe('0,100');
    expect(y.keys.map((key) => key.value).join(',')).toBe('0,50');
    expect(x.keys.map((key) => key.easing).join(',')).toBe('ease,ease');
    expect(y.keys.map((key) => key.easing).join(',')).toBe('ease,ease');
  });

  it('seeds a keyless paired axis from its OWN stepped value, then applies the property there', () => {
    const keylessPaired: PhysicPaintRotoRailMotionRecord = Object.freeze({
      railId: 'rail-1',
      anchorKeyId: 'key-a',
      channels: Object.freeze([
        motionChannel('position-x', [motionKey(0, 0), motionKey(5, 40), motionKey(10, 100)]),
        motionChannel('position-y', [motionKey(0, 0), motionKey(10, 50)]),
      ]),
    }) as PhysicPaintRotoRailMotionRecord;

    const result = setMotionKeyWiggle({
      records: [keylessPaired],
      railId: 'rail-1',
      channelId: 'position-x',
      keyFrame: 5,
      wiggle: 7,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const record = recordOf(result.records);
    const x = channelOf(record, 'position-x');
    const y = channelOf(record, 'position-y');

    expect(x.keys.map((key) => key.frame).join(',')).toBe('0,5,10');
    expect(y.keys.map((key) => key.frame).join(',')).toBe('0,5,10');
    expect(x.keys[1]?.value).toBe(40);
    expect(x.keys[1]?.wiggle).toBe(7);
    // D-12: the seeded key holds THIS axis's stepped value, never its sibling's 40.
    expect(y.keys[1]?.value).toBe(0);
    expect(y.keys[1]?.wiggle).toBe(7);
    expect(y.keys.map((key) => key.value).join(',')).toBe('0,0,50');
    expect(y.keys.map((key) => key.wiggle).join(',')).toBe('0,7,0');
    // 261108-d5o: the seeded keyless sibling is a CREATION path, so it takes
    // the stop-motion default; the two authored keys keep their own easing.
    expect(y.keys.map((key) => key.easing).join(',')).toBe('ease,stop-motion,ease');
  });

  it('refuses a grouped Position edit when the addressed axis has no key at the frame', () => {
    const result = setMotionKeyEasing({
      records: [motionRecord()],
      railId: 'rail-1',
      channelId: 'position-x',
      keyFrame: 5,
      easing: 'hold',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('There is no Motion key at this frame.');
    expect(result).not.toHaveProperty('records');
  });

  it('keeps a non-Position command on exactly one channel', () => {
    const result = setMotionKeyEasing({
      records: [motionRecord()],
      railId: 'rail-1',
      channelId: 'scale',
      keyFrame: 10,
      easing: 'hold',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const record = recordOf(result.records);

    expect(channelOf(record, 'scale').keys.map((key) => key.easing).join(',')).toBe('ease,hold');
    expect(channelOf(record, 'position-x').keys.map((key) => key.easing).join(',')).toBe('ease,ease');
    expect(channelOf(record, 'position-y').keys.map((key) => key.easing).join(',')).toBe('ease,ease');
  });

  it('finds the addressed key and reports none for an empty frame', () => {
    const record = motionRecord();
    expect(resolveMotionKeyAtFrame(record, 'scale', 10)?.value).toBe(2);
    expect(resolveMotionKeyAtFrame(record, 'scale', 4)).toBeNull();
    expect(resolveMotionKeyAtFrame(null, 'scale', 4)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* 261107-pd8 — move a Motion key through the command layer           */
/* ------------------------------------------------------------------ */

describe('261107-pd8 rail motion commands — move a Motion key', () => {
  it('moves the addressed key to the destination and keeps its value, easing and wiggle', () => {
    const record = Object.freeze({
      railId: 'rail-move',
      anchorKeyId: 'key-a',
      channels: Object.freeze([
        motionChannel('scale', [motionKey(0, 1), motionKey(3, 2, 'hold', 4)]),
      ]),
    }) as PhysicPaintRotoRailMotionRecord;
    const result = moveMotionKey({
      records: [record],
      railId: 'rail-move',
      channelId: 'scale',
      fromFrame: 3,
      toFrame: 5,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recordRemoved).toBe(false);
    expect(channelOf(recordOf(result.records, 'rail-move'), 'scale').keys).toEqual([
      motionKey(0, 1),
      motionKey(5, 2, 'hold', 4),
    ]);
  });

  it('moves both grouped Position axes atomically and keeps each axis value', () => {
    const result = moveMotionKey({
      records: [motionRecord()],
      railId: 'rail-1',
      channelId: 'position-y',
      fromFrame: 10,
      toFrame: 7,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const record = recordOf(result.records);
    const x = channelOf(record, 'position-x');
    const y = channelOf(record, 'position-y');
    expect(x.keys.map((key) => key.frame)).toEqual([0, 7]);
    expect(y.keys.map((key) => key.frame)).toEqual([0, 7]);
    expect(x.keys.find((key) => key.frame === 7)?.value).toBe(100);
    expect(y.keys.find((key) => key.frame === 7)?.value).toBe(50);
    expect(channelOf(record, 'scale').keys.map((key) => key.frame)).toEqual([0, 10]);
  });

  it('keeps the record and the channel when the moved key was their only key (no D-15 cascade)', () => {
    const result = moveMotionKey({
      records: [soleChannelRecord()],
      railId: 'rail-sole',
      channelId: 'scale',
      fromFrame: 3,
      toFrame: 6,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recordRemoved).toBe(false);
    expect(result.records).toHaveLength(1);
    expect(channelOf(recordOf(result.records, 'rail-sole'), 'scale').keys).toEqual([
      motionKey(6, 1.5),
    ]);
  });

  it('refuses an occupied destination on the addressed channel', () => {
    const result = moveMotionKey({
      records: [motionRecord()],
      railId: 'rail-1',
      channelId: 'scale',
      fromFrame: 0,
      toFrame: 10,
    });
    expect(result).toEqual({
      ok: false,
      reason: 'The destination frame already carries a Motion key.',
    });
  });

  it('refuses an occupied destination on the grouped Position sibling', () => {
    const asymmetric = Object.freeze({
      railId: 'rail-pair',
      anchorKeyId: 'key-a',
      channels: Object.freeze([
        motionChannel('position-x', [motionKey(0, 0), motionKey(10, 100)]),
        motionChannel('position-y', [motionKey(0, 0), motionKey(7, 25), motionKey(10, 50)]),
      ]),
    }) as PhysicPaintRotoRailMotionRecord;
    const result = moveMotionKey({
      records: [asymmetric],
      railId: 'rail-pair',
      channelId: 'position-x',
      fromFrame: 10,
      toFrame: 7,
    });
    expect(result).toEqual({
      ok: false,
      reason: 'The destination frame already carries a Motion key.',
    });
  });

  it('refuses a no-op, an unknown rail, a missing channel and a missing source key in that order', () => {
    expect(moveMotionKey({
      records: [motionRecord()],
      railId: 'rail-1',
      channelId: 'scale',
      fromFrame: 10,
      toFrame: 10,
    })).toEqual({ ok: false, reason: 'The Motion key is already at this frame.' });

    expect(moveMotionKey({
      records: [],
      railId: 'rail-missing',
      channelId: 'scale',
      fromFrame: 0,
      toFrame: 2,
    })).toEqual({ ok: false, reason: 'This rail has no Motion to edit yet.' });

    expect(moveMotionKey({
      records: [motionRecord()],
      railId: 'rail-1',
      channelId: 'opacity' as PhysicPaintRotoRailMotionChannel['id'],
      fromFrame: 0,
      toFrame: 2,
    })).toEqual({ ok: false, reason: 'This Motion channel is not present on the rail.' });

    expect(moveMotionKey({
      records: [motionRecord()],
      railId: 'rail-1',
      channelId: 'scale',
      fromFrame: 5,
      toFrame: 6,
    })).toEqual({ ok: false, reason: 'There is no Motion key at this frame.' });
  });

  it('refuses a malformed rail or frame before touching the collection', () => {
    expect(moveMotionKey({
      records: [motionRecord()],
      railId: '',
      channelId: 'scale',
      fromFrame: 0,
      toFrame: 2,
    })).toEqual({ ok: false, reason: 'Select a rail first.' });

    for (const [fromFrame, toFrame] of [[0.5, 2], [0, -1], [0, Number.NaN]] as const) {
      expect(moveMotionKey({
        records: [motionRecord()],
        railId: 'rail-1',
        channelId: 'scale',
        fromFrame,
        toFrame,
      })).toEqual({ ok: false, reason: 'The Motion key frame is not valid.' });
    }
  });

  it('never mutates the input collection', () => {
    const records = [motionRecord()];
    const before = channelOf(recordOf(records), 'scale').keys;
    const result = moveMotionKey({
      records,
      railId: 'rail-1',
      channelId: 'scale',
      fromFrame: 10,
      toFrame: 8,
    });
    expect(result.ok).toBe(true);
    expect(channelOf(recordOf(records), 'scale').keys).toBe(before);
    expect(channelOf(recordOf(records), 'scale').keys.map((key) => key.frame)).toEqual([0, 10]);
  });
});

/* ------------------------------------------------------------------ */
/* 261107-pd8 — the pure drag clamp shared by the lane hook           */
/* ------------------------------------------------------------------ */

describe('261107-pd8 rail motion commands — key drag clamp', () => {
  it('passes a free in-band frame through with no blocked edge', () => {
    expect(clampRailMotionKeyDragFrame({
      keyFrames: [0, 10],
      fromFrame: 0,
      proposedFrame: 5,
      frameCount: 11,
    })).toEqual({ frame: 5, blockedEdge: null });
  });

  it('stops on the nearest free frame before an occupied key when moving right', () => {
    expect(clampRailMotionKeyDragFrame({
      keyFrames: [0, 5, 10],
      fromFrame: 0,
      proposedFrame: 8,
      frameCount: 11,
    })).toEqual({ frame: 4, blockedEdge: 'right' });
    // Landing exactly on the occupied frame is blocked too.
    expect(clampRailMotionKeyDragFrame({
      keyFrames: [0, 5, 10],
      fromFrame: 0,
      proposedFrame: 5,
      frameCount: 11,
    })).toEqual({ frame: 4, blockedEdge: 'right' });
  });

  it('stops on the nearest free frame after an occupied key when moving left', () => {
    expect(clampRailMotionKeyDragFrame({
      keyFrames: [0, 5, 10],
      fromFrame: 10,
      proposedFrame: 2,
      frameCount: 11,
    })).toEqual({ frame: 6, blockedEdge: 'left' });
    expect(clampRailMotionKeyDragFrame({
      keyFrames: [0, 5, 10],
      fromFrame: 10,
      proposedFrame: 5,
      frameCount: 11,
    })).toEqual({ frame: 6, blockedEdge: 'left' });
  });

  it('reports the band edge when the proposal overshoots it', () => {
    expect(clampRailMotionKeyDragFrame({
      keyFrames: [0, 2],
      fromFrame: 2,
      proposedFrame: 99,
      frameCount: 11,
    })).toEqual({ frame: 10, blockedEdge: 'right' });
    expect(clampRailMotionKeyDragFrame({
      keyFrames: [8, 10],
      fromFrame: 8,
      proposedFrame: -4,
      frameCount: 11,
    })).toEqual({ frame: 0, blockedEdge: 'left' });
    // A short band clamps to its own last frame.
    expect(clampRailMotionKeyDragFrame({
      keyFrames: [0],
      fromFrame: 0,
      proposedFrame: 99,
      frameCount: 8,
    })).toEqual({ frame: 7, blockedEdge: 'right' });
  });

  it('ignores the moving key own frame and treats an in-place proposal as unbounded', () => {
    expect(clampRailMotionKeyDragFrame({
      keyFrames: [0, 10],
      fromFrame: 10,
      proposedFrame: 10,
      frameCount: 11,
    })).toEqual({ frame: 10, blockedEdge: null });
    // The moving key vacates its own frame, so a neighbouring free frame is reachable.
    expect(clampRailMotionKeyDragFrame({
      keyFrames: [0, 4],
      fromFrame: 4,
      proposedFrame: 6,
      frameCount: 11,
    })).toEqual({ frame: 6, blockedEdge: null });
  });

  it('rounds the proposal and normalizes a non-finite or empty band', () => {
    expect(clampRailMotionKeyDragFrame({
      keyFrames: [],
      fromFrame: 0,
      proposedFrame: 4.4,
      frameCount: 11,
    })).toEqual({ frame: 4, blockedEdge: null });
    expect(clampRailMotionKeyDragFrame({
      keyFrames: [],
      fromFrame: 0,
      proposedFrame: 4.6,
      frameCount: 11,
    })).toEqual({ frame: 5, blockedEdge: null });
    for (const frameCount of [0, -3, Number.NaN, -Infinity]) {
      expect(clampRailMotionKeyDragFrame({
        keyFrames: [0, 10],
        fromFrame: 10,
        proposedFrame: 20,
        frameCount,
      })).toEqual({ frame: 0, blockedEdge: null });
    }
  });

  it('clamps a from frame outside the band into it', () => {
    expect(clampRailMotionKeyDragFrame({
      keyFrames: [],
      fromFrame: 99,
      proposedFrame: 1,
      frameCount: 5,
    })).toEqual({ frame: 1, blockedEdge: null });
  });
});

/* ------------------------------------------------------------------ */
/* 261107-rrp — the motion span auto-fits the resolved rail extent    */
/* ------------------------------------------------------------------ */

describe('261107-rrp motion span auto-fit policy', () => {
  it('clamps cursor writes into the resolved band at both ends', () => {
    // A resolved 10-frame band: frames 10..19 in app time.
    const view = railView({ startFrame: 10, endFrameExclusive: 20 });

    expect(railMotionCursorFrame(view, 3)).toBe(0);
    expect(railMotionCursorFrame(view, 13)).toBe(3);
    expect(railMotionCursorFrame(view, 50)).toBe(9);
  });

  it('preserves an out-of-band key byte-identically when writing inside the band', () => {
    // Frame 20 is outside the 10-frame band derived for this view. It must
    // survive the write untouched (preserved-but-inactive), never clamped.
    // Rotation is used because Position is paired (D-12) and would need an
    // unrelated position-y frame set just to satisfy the model.
    const outOfBand = motionKey(20, 42);
    const record = Object.freeze({
      railId: 'rail-1',
      anchorKeyId: 'key-a',
      channels: Object.freeze([
        Object.freeze({
          id: 'rotation' as const,
          keys: Object.freeze([motionKey(0, 0), outOfBand]),
        }),
      ]),
    }) as PhysicPaintRotoRailMotionRecord;

    const result = setMotionKeyAtCursor({
      records: [record],
      railId: 'rail-1',
      channelId: 'rotation',
      keyFrame: 4,
      value: 50,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const keys = channelOf(recordOf(result.records), 'rotation').keys;
    expect(keys.map((key) => key.frame)).toEqual([0, 4, 20]);
    expect(keys.find((key) => key.frame === 20)).toEqual(outOfBand);
    expect(keys.find((key) => key.frame === 4)?.value).toBe(50);
  });

  it('clamps a drag whose band comes from the shared helper', () => {
    const view = railView({ startFrame: 10, endFrameExclusive: 20 });
    const frameCount = viewFrameCount()(view);
    expect(frameCount).toBe(10);

    expect(clampRailMotionKeyDragFrame({
      keyFrames: [0],
      fromFrame: 0,
      proposedFrame: 99,
      frameCount,
    })).toEqual({ frame: 9, blockedEdge: 'right' });
  });
});

describe('59-12 rail motion commands — selection scope', () => {
  it('reports one scope, with a key scope winning over the rail it rides on', () => {
    expect(resolveSelectionScope({ hasRail: true, hasDrawingKey: false, hasMotionKey: true })).toBe('motion-key');
    expect(resolveSelectionScope({ hasRail: true, hasDrawingKey: true, hasMotionKey: false })).toBe('drawing-key');
    expect(resolveSelectionScope({ hasRail: true, hasDrawingKey: false, hasMotionKey: false })).toBe('rail');
    expect(resolveSelectionScope({ hasRail: false, hasDrawingKey: false, hasMotionKey: false })).toBeNull();
  });
});

describe('59-12 rail motion commands — honest availability', () => {
  const ready: RailMotionCommandAvailabilityInput = {
    command: 'set-motion-key',
    hasRail: true,
    hasChannel: true,
    cursorInsideRailSpan: true,
    keyAtCursor: false,
  };

  const rows: ReadonlyArray<{
    readonly name: string;
    readonly input: RailMotionCommandAvailabilityInput;
    readonly enabled: boolean;
  }> = [
    { name: 'animate without a rail', input: { command: 'animate', hasRail: false }, enabled: false },
    { name: 'animate with a rail', input: { command: 'animate', hasRail: true }, enabled: true },
    { name: 'add without a rail', input: { ...ready, hasRail: false }, enabled: false },
    { name: 'add without a channel', input: { ...ready, hasChannel: false }, enabled: false },
    { name: 'add outside the rail span', input: { ...ready, cursorInsideRailSpan: false }, enabled: false },
    { name: 'add when a key already sits at the cursor', input: { ...ready, keyAtCursor: true }, enabled: false },
    { name: 'add when ready', input: ready, enabled: true },
    { name: 'remove when no key sits at the cursor', input: { ...ready, command: 'remove-motion-key', keyAtCursor: false }, enabled: false },
    { name: 'remove when a key sits at the cursor', input: { ...ready, command: 'remove-motion-key', keyAtCursor: true }, enabled: true },
    { name: 'previous with no adjacent key', input: { ...ready, command: 'previous-motion-key', hasAdjacentKey: false }, enabled: false },
    { name: 'previous with an adjacent key', input: { ...ready, command: 'previous-motion-key', hasAdjacentKey: true }, enabled: true },
    { name: 'next with no adjacent key', input: { ...ready, command: 'next-motion-key', hasAdjacentKey: false }, enabled: false },
    { name: 'next with an adjacent key', input: { ...ready, command: 'next-motion-key', hasAdjacentKey: true }, enabled: true },
    { name: 'easing without a selected key', input: { ...ready, command: 'set-motion-key-easing', keyAtCursor: false }, enabled: false },
    { name: 'easing with a selected key', input: { ...ready, command: 'set-motion-key-easing', keyAtCursor: true }, enabled: true },
    { name: 'wiggle without a selected key', input: { ...ready, command: 'set-motion-key-wiggle', keyAtCursor: false }, enabled: false },
    { name: 'wiggle with a selected key', input: { ...ready, command: 'set-motion-key-wiggle', keyAtCursor: true }, enabled: true },
  ];

  it('answers every case and never reports an empty reason (T-59-35)', () => {
    for (const row of rows) {
      const result = resolveMotionCommandAvailability(row.input);
      expect(result.enabled, row.name).toBe(row.enabled);
      if (row.enabled) {
        expect(result.reason, row.name).toBeNull();
      } else {
        expect(result.reason?.trim().length ?? 0, row.name).toBeGreaterThan(0);
      }
    }
  });
});

describe('59-12 rail motion commands — animate availability', () => {
  it('is enabled for every rail type whenever a rail is selected', () => {
    expect(resolveMotionCommandAvailability({ command: 'animate', hasRail: true }))
      .toEqual({ enabled: true, reason: null });
  });

  it('is unavailable with a non-empty reason when no rail is selected', () => {
    const result = resolveMotionCommandAvailability({ command: 'animate', hasRail: false });
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe('Select a rail to animate it.');
  });
});

describe('59-12 Task 3: three independent selection scopes (MOTN-11)', () => {
  const railIdentity = Object.freeze({ kind: 'loop', loopId: 'loop-1' } as const);
  const motionKeySelection = Object.freeze({
    railId: 'loop-1',
    channelId: 'position-x' as const,
    frame: 3,
  });

  function scopes(overrides: Partial<RailSelectionScopesState> = {}): RailSelectionScopesState {
    return {
      railSet: { members: [railIdentity], anchor: railIdentity },
      drawingKeyIds: ['key-a', 'key-b'],
      motionKey: null,
      ...overrides,
    };
  }

  it('maps every selection state to exactly one scope and one command list', () => {
    const rows = [
      {
        input: { hasRail: true, hasDrawingKey: false, hasMotionKey: false },
        scope: 'rail',
        commands: ['animate', 'scissor-key-rail', 'delete-rails'],
      },
      {
        input: { hasRail: true, hasDrawingKey: true, hasMotionKey: false },
        scope: 'drawing-key',
        commands: ['insert-key', 'delete-key', 'move-keys'],
      },
      {
        input: { hasRail: true, hasDrawingKey: false, hasMotionKey: true },
        scope: 'motion-key',
        commands: [
          'set-motion-key',
          'remove-motion-key',
          'set-motion-key-easing',
          'set-motion-key-wiggle',
          'previous-motion-key',
          'next-motion-key',
        ],
      },
      {
        // The scope resolver is total: a key scope always outranks the rail it
        // rides on, so the rail can never mask a selected key.
        input: { hasRail: true, hasDrawingKey: true, hasMotionKey: true },
        scope: 'motion-key',
        commands: ['set-motion-key', 'remove-motion-key', 'set-motion-key-easing', 'set-motion-key-wiggle', 'previous-motion-key', 'next-motion-key'],
      },
      {
        input: { hasRail: false, hasDrawingKey: false, hasMotionKey: false },
        scope: null,
        commands: [],
      },
    ] as const;
    for (const row of rows) {
      const scope = resolveSelectionScope(row.input);
      expect(scope).toBe(row.scope);
      expect(resolveContextualMotionCommands(scope)).toEqual(row.commands);
    }
  });

  it('gives every command exactly one scope — a command from another scope is absent', () => {
    const allCommands = RAIL_MOTION_SELECTION_SCOPES.flatMap(
      (scope) => resolveContextualMotionCommands(scope),
    );
    expect(new Set(allCommands).size).toBe(allCommands.length);
    // The rail scope carries no Motion command and the key scopes carry no rail command.
    expect(resolveContextualMotionCommands('rail')).not.toContain('set-motion-key-easing');
    expect(resolveContextualMotionCommands('rail')).not.toContain('set-motion-key');
    expect(resolveContextualMotionCommands('drawing-key')).not.toContain('animate');
    expect(resolveContextualMotionCommands('motion-key')).not.toContain('scissor-key-rail');
    // The exported table IS the resolver's source (one authority).
    expect(resolveContextualMotionCommands('rail')).toBe(CONTEXTUAL_COMMANDS_BY_SCOPE.rail);
    expect(resolveContextualMotionCommands(null)).toEqual([]);
  });

  it('clearing the motion-key selection keeps the rail set (expanded block stays open)', () => {
    const state = scopes({ drawingKeyIds: [], motionKey: motionKeySelection });
    const cleared = clearSelectionForScope(state, 'motion-key');
    expect(cleared.motionKey).toBeNull();
    expect(cleared.drawingKeyIds).toEqual([]);
    // Same rail set reference: the block and the rail scope survive untouched.
    expect(cleared.railSet).toBe(state.railSet);
  });

  it('selecting a motion key clears the drawing-key selection', () => {
    const state = scopes({ motionKey: null });
    const cleared = clearSelectionForScope(state, 'motion-key');
    expect(cleared.drawingKeyIds).toEqual([]);
    expect(cleared.railSet).toBe(state.railSet);
  });

  it('selecting a drawing key clears the motion-key selection', () => {
    const state = scopes({ drawingKeyIds: [], motionKey: motionKeySelection });
    const cleared = clearSelectionForScope(state, 'drawing-key');
    expect(cleared.motionKey).toBeNull();
    expect(cleared.railSet).toBe(state.railSet);
  });

  it('deleting the rail clears every scope', () => {
    const state = scopes({ motionKey: motionKeySelection });
    const cleared = clearSelectionForScope(state, 'rail');
    expect(cleared.railSet.members).toEqual([]);
    expect(cleared.railSet.anchor).toBeNull();
    expect(cleared.drawingKeyIds).toEqual([]);
    expect(cleared.motionKey).toBeNull();
  });

  it('clearing with no active scope leaves the rail set and drops both key selections', () => {
    const state = scopes({ drawingKeyIds: [], motionKey: motionKeySelection });
    const cleared = clearSelectionForScope(state, null);
    expect(cleared.motionKey).toBeNull();
    expect(cleared.railSet).toBe(state.railSet);
    // Nothing left to clear → the same reference, so subscribers never churn.
    expect(clearSelectionForScope(cleared, null)).toBe(cleared);
    expect(clearSelectionForScope(cleared, 'motion-key')).toBe(cleared);
  });

  it('a motion-key selection survives a rail re-selection', () => {
    const before = scopes({ drawingKeyIds: [], motionKey: motionKeySelection });
    // Re-selecting a rail REPLACES only the rail-set identity; selecting a rail
    // never calls the clearing rules, so the key scopes ride through untouched.
    const afterRailReselection: RailSelectionScopesState = {
      ...before,
      railSet: { members: [Object.freeze({ kind: 'key-rail', firstKeyId: 'key-a' } as const)], anchor: null },
    };
    expect(afterRailReselection.motionKey).toBe(motionKeySelection);
    expect(resolveSelectionScope({
      hasRail: true,
      hasDrawingKey: afterRailReselection.drawingKeyIds.length > 0,
      hasMotionKey: afterRailReselection.motionKey !== null,
    })).toBe('motion-key');
  });
});

// ---------------------------------------------------------------------------
// 59-13: the canvas gizmo — one pure write path, the D-08 gate, and the
// session-draft reducer. The command module is read through a namespace cast
// so the RED run reports per-test assertion failures instead of an import
// collection failure while the 59-13 API is still absent.
// ---------------------------------------------------------------------------

type GizmoTransformValues = {
  readonly position?: { readonly x: number; readonly y: number };
  readonly scale?: number;
  readonly rotation?: number;
};

type GizmoCommandResult =
  | { readonly ok: true; readonly records: readonly PhysicPaintRotoRailMotionRecord[] }
  | { readonly ok: false; readonly reason: string };

interface GizmoCommandSurface {
  mergeRailMotionDraft(
    draft: GizmoTransformValues | null,
    next: GizmoTransformValues,
  ): GizmoTransformValues;
  resolveMotionGizmoAvailability(input: {
    readonly selectedRailId: string | null;
    readonly animatedChannelIds: readonly string[];
    readonly cursorInsideSpan: boolean;
  }): { readonly enabled: boolean; readonly reason: string | null };
  writeMotionTransformAtCursor(input: {
    readonly records: readonly PhysicPaintRotoRailMotionRecord[];
    readonly view: RailMotionRailView;
    readonly cursorFrame: number;
    readonly values: GizmoTransformValues;
  }): GizmoCommandResult;
}

const gizmoCommands = railMotionCommandModule as unknown as GizmoCommandSurface;

/** The animated rail the gizmo mounts for — a 59-06 view with a non-null railId. */
function gizmoView(overrides: Partial<RailMotionRailView> = {}): RailMotionRailView {
  return railView({ railId: 'rail-1', ...overrides });
}

function keyAt(
  record: PhysicPaintRotoRailMotionRecord,
  channelId: PhysicPaintRotoRailMotionRecord['channels'][number]['id'],
  frame: number,
) {
  return channelOf(record, channelId).keys.find((key) => key.frame === frame) ?? null;
}

describe('59-13 rail motion commands — gizmo transform write', () => {
  it('writes the grouped Position pair at the rail-local cursor in ONE result', () => {
    const result = gizmoCommands.writeMotionTransformAtCursor({
      records: [motionRecord()],
      view: gizmoView(),
      // App frame 15 on a rail that starts at 10 → rail-local 5.
      cursorFrame: 15,
      values: { position: { x: 40, y: -12 } },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const record = recordOf(result.records);
    expect(channelOf(record, 'position-x').keys.map((key) => key.frame)).toEqual([0, 5, 10]);
    expect(channelOf(record, 'position-y').keys.map((key) => key.frame)).toEqual([0, 5, 10]);
    expect(keyAt(record, 'position-x', 5)?.value).toBe(40);
    expect(keyAt(record, 'position-y', 5)?.value).toBe(-12);
    // Only the dragged channel family changed — Scale and Rotation keep their keys.
    expect(channelOf(record, 'scale').keys.map((key) => key.frame)).toEqual([0, 10]);
    expect(channelOf(record, 'rotation').keys.map((key) => key.frame)).toEqual([4]);
  });

  it('converts Scale from UI percent to the model factor through the 59-02 pair', () => {
    const result = gizmoCommands.writeMotionTransformAtCursor({
      records: [motionRecord()],
      view: gizmoView(),
      cursorFrame: 14,
      values: { scale: 120 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(keyAt(recordOf(result.records), 'scale', 4)?.value).toBe(1.2);
    // The untouched Position keys keep the model values, not percent.
    expect(keyAt(recordOf(result.records), 'position-x', 0)?.value).toBe(0);
  });

  it('writes Rotation in degrees with NO normalization', () => {
    // In-span cursors: app 14/15 on a rail starting at 10 → rail-local 4/5.
    // (Out-of-span cursors clamp through railMotionCursorFrame, proven below.)
    const above = gizmoCommands.writeMotionTransformAtCursor({
      records: [motionRecord()],
      view: gizmoView(),
      cursorFrame: 14,
      values: { rotation: 720 },
    });
    expect(above.ok).toBe(true);
    if (!above.ok) return;
    expect(keyAt(recordOf(above.records), 'rotation', 4)?.value).toBe(720);

    const below = gizmoCommands.writeMotionTransformAtCursor({
      records: [motionRecord()],
      view: gizmoView(),
      cursorFrame: 15,
      values: { rotation: -90 },
    });
    expect(below.ok).toBe(true);
    if (!below.ok) return;
    expect(keyAt(recordOf(below.records), 'rotation', 5)?.value).toBe(-90);
  });

  it('writes only the channels present in the partial', () => {
    const result = gizmoCommands.writeMotionTransformAtCursor({
      records: [motionRecord()],
      view: gizmoView(),
      cursorFrame: 15,
      values: { scale: 150 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const record = recordOf(result.records);
    expect(channelOf(record, 'position-x').keys.map((key) => key.frame)).toEqual([0, 10]);
    expect(channelOf(record, 'position-y').keys.map((key) => key.frame)).toEqual([0, 10]);
    expect(channelOf(record, 'rotation').keys.map((key) => key.frame)).toEqual([4]);
    expect(keyAt(record, 'scale', 5)?.value).toBe(1.5);
  });

  it('clamps the key frame into the rail span through railMotionCursorFrame', () => {
    const result = gizmoCommands.writeMotionTransformAtCursor({
      records: [motionRecord()],
      view: gizmoView(),
      cursorFrame: 500,
      values: { position: { x: 11, y: 12 } },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const record = recordOf(result.records);
    expect(keyAt(record, 'position-x', 10)?.value).toBe(11);
    expect(keyAt(record, 'position-y', 10)?.value).toBe(12);
    expect(channelOf(record, 'position-x').keys.some((key) => key.frame === 490)).toBe(false);
  });

  it('auto-adds a channel on an explicit handle drag instead of snapping back (D-08, UAT revision)', () => {
    const scaleFree = Object.freeze({
      railId: 'rail-1',
      anchorKeyId: 'key-a',
      channels: Object.freeze([
        motionChannel('position-x', [motionKey(0, 0), motionKey(10, 100)]),
        motionChannel('position-y', [motionKey(0, 0), motionKey(10, 50)]),
      ]),
    }) as PhysicPaintRotoRailMotionRecord;
    const records = [scaleFree];
    const result = gizmoCommands.writeMotionTransformAtCursor({
      records,
      view: gizmoView(),
      cursorFrame: 14,
      values: { scale: 120 },
    });
    if (!result.ok) throw new Error(result.reason);
    // The gesture both ADDS Scale and writes its key at the cursor frame.
    const record = recordOf(result.records);
    expect(channelOf(record, 'scale')).toBeDefined();
    // Rail-local frame: cursor 14 - rail start 10 = 4.
    expect(keyAt(record, 'scale', 4)?.value).toBeCloseTo(1.2, 6);
    // The input collection is never mutated.
    expect(records[0]).toBe(scaleFree);
    expect(scaleFree.channels.some((channel) => channel.id === 'scale')).toBe(false);
  });

  it('rejects a Position drag when only one axis is animated (D-08 grouped pair)', () => {
    const xOnly = Object.freeze({
      railId: 'rail-1',
      anchorKeyId: 'key-a',
      channels: Object.freeze([
        motionChannel('position-x', [motionKey(0, 0), motionKey(10, 100)]),
        motionChannel('scale', [motionKey(0, 1)]),
      ]),
    }) as PhysicPaintRotoRailMotionRecord;
    const result = gizmoCommands.writeMotionTransformAtCursor({
      records: [xOnly],
      view: gizmoView(),
      cursorFrame: 14,
      values: { position: { x: 40, y: 40 } },
    });
    expect(result).toEqual({ ok: false, reason: 'This Motion channel has no keys yet.' });
  });

  it('rejects an un-animated rail and a view without a railId with plain reasons', () => {
    expect(gizmoCommands.writeMotionTransformAtCursor({
      records: [],
      view: gizmoView(),
      cursorFrame: 14,
      values: { position: { x: 1, y: 2 } },
    })).toEqual({ ok: false, reason: 'This rail has no Motion to edit yet.' });

    expect(gizmoCommands.writeMotionTransformAtCursor({
      records: [motionRecord()],
      view: railView(),
      cursorFrame: 14,
      values: { position: { x: 1, y: 2 } },
    })).toEqual({ ok: false, reason: 'Animate the rail before dragging it.' });
  });

  it('rejects an empty partial and a non-finite cursor with plain reasons', () => {
    expect(gizmoCommands.writeMotionTransformAtCursor({
      records: [motionRecord()],
      view: gizmoView(),
      cursorFrame: 14,
      values: {},
    })).toEqual({ ok: false, reason: 'The drag did not change a Motion channel.' });

    expect(gizmoCommands.writeMotionTransformAtCursor({
      records: [motionRecord()],
      view: gizmoView(),
      cursorFrame: Number.NaN,
      values: { position: { x: 1, y: 2 } },
    })).toEqual({ ok: false, reason: 'The playhead is not on a valid frame.' });
  });

  it('rejects a non-finite channel value instead of writing it (no NaN reaches the document)', () => {
    const result = gizmoCommands.writeMotionTransformAtCursor({
      records: [motionRecord()],
      view: gizmoView(),
      cursorFrame: 14,
      values: { rotation: Number.NaN },
    });
    expect(result).toEqual({ ok: false, reason: 'This value is outside the Motion channel range.' });
  });

  it('supplies the grouped sibling EXPLICITLY instead of deriving it (one atomic pair write)', () => {
    const result = setMotionKeyAtCursor({
      records: [motionRecord()],
      railId: 'rail-1',
      channelId: 'position-x',
      keyFrame: 5,
      value: 40,
      pairedValue: -12,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const record = recordOf(result.records);
    // The evaluated sibling would have seeded 25 — the explicit value wins.
    expect(keyAt(record, 'position-y', 5)?.value).toBe(-12);
    expect(keyAt(record, 'position-x', 5)?.value).toBe(40);
  });
});

describe('59-13 rail motion commands — gizmo availability', () => {
  it('is disabled with a reason when no animated rail is selected', () => {
    expect(gizmoCommands.resolveMotionGizmoAvailability({
      selectedRailId: null,
      animatedChannelIds: ['position-x', 'position-y'],
      cursorInsideSpan: true,
    })).toEqual({ enabled: false, reason: 'Select an animated rail to edit its motion.' });
  });

  it('is disabled with a reason when the rail carries no motion', () => {
    expect(gizmoCommands.resolveMotionGizmoAvailability({
      selectedRailId: 'rail-1',
      animatedChannelIds: [],
      cursorInsideSpan: true,
    })).toEqual({ enabled: false, reason: 'Animate the rail before dragging it.' });
  });

  it('is disabled when the only animated channel is Opacity (D-07 — numeric-only)', () => {
    expect(gizmoCommands.resolveMotionGizmoAvailability({
      selectedRailId: 'rail-1',
      animatedChannelIds: ['opacity'],
      cursorInsideSpan: true,
    })).toEqual({ enabled: false, reason: 'This rail has no draggable Motion channel.' });
  });

  it('is disabled when the playhead is outside the rail span', () => {
    expect(gizmoCommands.resolveMotionGizmoAvailability({
      selectedRailId: 'rail-1',
      animatedChannelIds: ['scale'],
      cursorInsideSpan: false,
    })).toEqual({ enabled: false, reason: 'Move the playhead inside the rail to edit its motion.' });
  });

  it('is enabled with a null reason when a draggable channel is animated inside the span', () => {
    expect(gizmoCommands.resolveMotionGizmoAvailability({
      selectedRailId: 'rail-1',
      animatedChannelIds: ['position-x', 'position-y', 'scale', 'rotation'],
      cursorInsideSpan: true,
    })).toEqual({ enabled: true, reason: null });
  });
});

describe('59-13 rail motion commands — draft merge reducer', () => {
  it('seeds a frozen draft from a null base', () => {
    const next = { position: { x: 4, y: 6 } };
    const merged = gizmoCommands.mergeRailMotionDraft(null, next);
    expect(merged).toEqual({ position: { x: 4, y: 6 } });
    expect(Object.isFrozen(merged)).toBe(true);
    expect(Object.isFrozen(merged.position)).toBe(true);
    // The caller's object is never frozen or mutated by the merge.
    expect(Object.isFrozen(next)).toBe(false);
    expect(Object.isFrozen(next.position)).toBe(false);
  });

  it('overrides only the present channels and keeps the rest of the draft', () => {
    const draft = { position: { x: 4, y: 6 }, scale: 110 };
    const merged = gizmoCommands.mergeRailMotionDraft(draft, { scale: 125 });
    expect(merged).toEqual({ position: { x: 4, y: 6 }, scale: 125 });
    expect(merged).not.toBe(draft);
    expect(draft).toEqual({ position: { x: 4, y: 6 }, scale: 110 });
    expect(Object.isFrozen(merged)).toBe(true);
  });

  it('replaces the Position pair wholesale, never mixing one axis with the other', () => {
    const merged = gizmoCommands.mergeRailMotionDraft(
      { position: { x: 4, y: 6 } },
      { position: { x: 8, y: 9 } },
    );
    expect(merged.position).toEqual({ x: 8, y: 9 });
  });
});

describe('59-13 rail motion commands — purity and source pins', () => {
  const commandSource = readFileSync(
    fileURLToPath(new URL('./railMotionCommands.ts', import.meta.url)),
    'utf8',
  );
  const handlesSource = readFileSync(
    fileURLToPath(new URL('../view/PhysicsPaintReferenceTransformHandles.tsx', import.meta.url)),
    'utf8',
  );
  const studioViewSource = readFileSync(
    fileURLToPath(new URL('../view/PhysicsPaintStudioView.tsx', import.meta.url)),
    'utf8',
  );

  function countOccurrences(source: string, token: string): number {
    return source.split(token).length - 1;
  }

  it('keeps the command layer free of store, signal, component and DOM imports', () => {
    expect(commandSource).not.toMatch(/from '.*physicPaintStore'/);
    expect(commandSource).not.toMatch(/from '.*efxPaintStore'/);
    expect(commandSource).not.toMatch(/from '@preact\/signals'/);
    expect(commandSource).not.toMatch(/from 'preact/);
    expect(commandSource).not.toContain('document.');
    expect(commandSource).not.toContain('window.');
    expect(countOccurrences(commandSource, 'setPhotoReferenceTransform')).toBe(0);
    expect(countOccurrences(commandSource, 'setBackgroundTransform')).toBe(0);
  });

  it('has exactly ONE writeMotionTransformAtCursor call, inside handlePointerUp', () => {
    expect(countOccurrences(handlesSource, 'writeMotionTransformAtCursor(')).toBe(1);
    const upStart = handlesSource.indexOf('function handlePointerUp');
    expect(upStart).toBeGreaterThan(-1);
    const upBody = handlesSource.slice(upStart);
    expect(upBody).toContain('writeMotionTransformAtCursor(');
    const moveStart = handlesSource.indexOf('function handlePointerMove');
    const moveEnd = handlesSource.indexOf('function applyMove');
    expect(moveStart).toBeGreaterThan(-1);
    expect(moveEnd).toBeGreaterThan(moveStart);
    expect(handlesSource.slice(moveStart, moveEnd)).not.toContain('writeMotionTransformAtCursor(');
  });

  it('keeps the gesture machine and the legacy write endpoints intact', () => {
    expect(handlesSource).toContain("mode: 'none' | 'pending' | 'move' | 'scale' | 'rotate';");
    expect(countOccurrences(handlesSource, 'setBackgroundTransform(layerId')).toBe(1);
    expect(countOccurrences(handlesSource, 'setPhotoReferenceTransform(layerId')).toBe(1);
    expect(handlesSource).toContain('onPointerCancel={handlePointerCancel}');
  });

  it('adds rail-motion as a third target with no opacity affordance and no rotation wrap', () => {
    expect(handlesSource).toContain(
      "export type PhysicsPaintTransformHandleTarget = 'photo-reference' | 'background' | 'rail-motion';",
    );
    expect(handlesSource).toContain("target: 'photo-reference' | 'background' | 'rail-motion'");
    expect(handlesSource).not.toContain("'opacity'");
    expect(handlesSource).not.toContain('% 360');
    expect(handlesSource).not.toContain('% 2 * Math.PI');
    expect(commandSource).not.toContain('% 360');
    expect(commandSource).not.toContain('% 2 * Math.PI');
  });

  it('mounts a third handles instance gated on a non-null railId', () => {
    expect(countOccurrences(studioViewSource, '<PhysicsPaintReferenceTransformHandles ')).toBe(3);
    expect(studioViewSource).toContain('railMotionTransformHandles');
    expect(studioViewSource).toMatch(/railMotionTransformHandles\?\.railMotion\?\.view\.railId/);
  });
});

// ---------------------------------------------------------------------------
// 59-16: the numeric Motion inspector's pure write path. It addresses the
// SELECTED key's rail-local frame directly (fields never move the playhead)
// and must agree with the 59-13 gizmo path on the final collection.
// ---------------------------------------------------------------------------

function opacityRecord(): PhysicPaintRotoRailMotionRecord {
  return Object.freeze({
    railId: 'rail-1',
    anchorKeyId: 'key-a',
    channels: Object.freeze([
      motionChannel('opacity', [motionKey(0, 1), motionKey(10, 0.4)]),
    ]),
  }) as PhysicPaintRotoRailMotionRecord;
}

describe('59-16 rail motion commands — numeric inspector write', () => {
  it('edits an existing grouped Position key without touching the sibling value', () => {
    const result = writeRailMotionChannelValueAtCursor({
      records: [motionRecord()],
      railId: 'rail-1',
      keyFrame: 10,
      channelId: 'position-x',
      uiValue: 250,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const record = recordOf(result.records);
    expect(keyAt(record, 'position-x', 10)?.value).toBe(250);
    // D-11/D-12: the sibling's STORED value at that frame is deep-equal.
    expect(keyAt(record, 'position-y', 10)?.value).toBe(50);
  });

  it('mirrors the independence rule for a Position Y edit', () => {
    const result = writeRailMotionChannelValueAtCursor({
      records: [motionRecord()],
      railId: 'rail-1',
      keyFrame: 10,
      channelId: 'position-y',
      uiValue: -75,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const record = recordOf(result.records);
    expect(keyAt(record, 'position-y', 10)?.value).toBe(-75);
    expect(keyAt(record, 'position-x', 10)?.value).toBe(100);
  });

  it('creates ONE grouped key per axis, seeding the untouched axis from the evaluator', () => {
    const result = writeRailMotionChannelValueAtCursor({
      records: [motionRecord()],
      railId: 'rail-1',
      keyFrame: 5,
      channelId: 'position-x',
      uiValue: 40,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const record = recordOf(result.records);
    expect(channelOf(record, 'position-x').keys.map((key) => key.frame)).toEqual([0, 5, 10]);
    expect(channelOf(record, 'position-y').keys.map((key) => key.frame)).toEqual([0, 5, 10]);
    expect(keyAt(record, 'position-x', 5)?.value).toBe(40);
    // The pre-edit evaluated Y value at rail-local 5 (the pose the user saw).
    expect(keyAt(record, 'position-y', 5)?.value).toBe(25);
  });

  it('passes rotation through with NO normalization', () => {
    const above = writeRailMotionChannelValueAtCursor({
      records: [motionRecord()],
      railId: 'rail-1',
      keyFrame: 4,
      channelId: 'rotation',
      uiValue: 720,
    });
    expect(above.ok).toBe(true);
    if (!above.ok) return;
    expect(keyAt(recordOf(above.records), 'rotation', 4)?.value).toBe(720);

    const below = writeRailMotionChannelValueAtCursor({
      records: [motionRecord()],
      railId: 'rail-1',
      keyFrame: 5,
      channelId: 'rotation',
      uiValue: -90,
    });
    expect(below.ok).toBe(true);
    if (!below.ok) return;
    expect(keyAt(recordOf(below.records), 'rotation', 5)?.value).toBe(-90);
  });

  it('converts Opacity between percent and the stored fraction', () => {
    const result = writeRailMotionChannelValueAtCursor({
      records: [opacityRecord()],
      railId: 'rail-1',
      keyFrame: 5,
      channelId: 'opacity',
      uiValue: 25,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(keyAt(recordOf(result.records), 'opacity', 5)?.value).toBe(0.25);
  });

  it('rejects out-of-domain and non-finite entries with a visible reason and no write', () => {
    const records = [motionRecord()];
    const zeroScale = writeRailMotionChannelValueAtCursor({
      records,
      railId: 'rail-1',
      keyFrame: 4,
      channelId: 'scale',
      uiValue: 0,
    });
    expect(zeroScale.ok).toBe(false);
    if (zeroScale.ok) return;
    expect(zeroScale.reason).toBe('Scale must be greater than 0.');

    const overOpacity = writeRailMotionChannelValueAtCursor({
      records: [opacityRecord()],
      railId: 'rail-1',
      keyFrame: 5,
      channelId: 'opacity',
      uiValue: 140,
    });
    expect(overOpacity.ok).toBe(false);
    if (overOpacity.ok) return;
    expect(overOpacity.reason).toBe('Opacity must be between 0 and 100.');

    const notANumber = writeRailMotionChannelValueAtCursor({
      records,
      railId: 'rail-1',
      keyFrame: 4,
      channelId: 'rotation',
      uiValue: Number.NaN,
    });
    expect(notANumber.ok).toBe(false);
    if (notANumber.ok) return;
    expect(notANumber.reason).toBe('Enter a number.');

    // The input collection is untouched by every rejection (pure command).
    expect(keyAt(records[0]!, 'scale', 0)?.value).toBe(1);
    expect(keyAt(records[0]!, 'rotation', 4)?.value).toBe(0);
  });

  it('refuses a channel the rail does not carry', () => {
    const result = writeRailMotionChannelValueAtCursor({
      records: [motionRecord()],
      railId: 'rail-1',
      keyFrame: 4,
      channelId: 'opacity',
      uiValue: 40,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('This Motion channel is not present on the rail.');
  });

  it('produces the SAME collection as the 59-13 gizmo path', () => {
    const fieldScale = writeRailMotionChannelValueAtCursor({
      records: [motionRecord()],
      railId: 'rail-1',
      keyFrame: 4,
      channelId: 'scale',
      uiValue: 150,
    });
    const gizmoScale = gizmoCommands.writeMotionTransformAtCursor({
      records: [motionRecord()],
      view: gizmoView(),
      cursorFrame: 14,
      values: { scale: 150 },
    });
    expect(fieldScale.ok).toBe(true);
    expect(gizmoScale.ok).toBe(true);
    if (!fieldScale.ok || !gizmoScale.ok) return;
    expect(fieldScale.records).toEqual(gizmoScale.records);

    // A grouped Position pair: two independent field edits reach the same
    // final collection as one gizmo drag sample.
    const fieldX = writeRailMotionChannelValueAtCursor({
      records: [motionRecord()],
      railId: 'rail-1',
      keyFrame: 5,
      channelId: 'position-x',
      uiValue: 40,
    });
    expect(fieldX.ok).toBe(true);
    if (!fieldX.ok) return;
    const fieldY = writeRailMotionChannelValueAtCursor({
      records: fieldX.records,
      railId: 'rail-1',
      keyFrame: 5,
      channelId: 'position-y',
      uiValue: -12,
    });
    const gizmoPosition = gizmoCommands.writeMotionTransformAtCursor({
      records: [motionRecord()],
      view: gizmoView(),
      cursorFrame: 15,
      values: { position: { x: 40, y: -12 } },
    });
    expect(fieldY.ok).toBe(true);
    expect(gizmoPosition.ok).toBe(true);
    if (!fieldY.ok || !gizmoPosition.ok) return;
    expect(fieldY.records).toEqual(gizmoPosition.records);
  });
});

// ---------------------------------------------------------------------------
// 59-17: the add-channel command (G1 / CR-03). The affordance that makes
// Scale, Rotation and Opacity reachable dispatches ONE command into the 59-02
// reducer; this command validates the rail and the channel inventory first and
// never seeds a key itself — grouped Position seeding stays the reducer's job.
// ---------------------------------------------------------------------------

/** The state right after a plain Animate: the grouped Position pair only. */
function positionOnlyRecord(): PhysicPaintRotoRailMotionRecord {
  return Object.freeze({
    railId: 'rail-1',
    anchorKeyId: 'key-a',
    channels: Object.freeze([
      motionChannel('position-x', [motionKey(0, 0)]),
      motionChannel('position-y', [motionKey(0, 0)]),
    ]),
  }) as PhysicPaintRotoRailMotionRecord;
}

/** The same rail after Scale was added from the menu: Position plus Scale. */
function scaleOnlySeedRecord(): PhysicPaintRotoRailMotionRecord {
  return Object.freeze({
    railId: 'rail-1',
    anchorKeyId: 'key-a',
    channels: Object.freeze([
      motionChannel('scale', [motionKey(0, 1)]),
    ]),
  }) as PhysicPaintRotoRailMotionRecord;
}

/** The one seed shape every add writes: frame 0, identity, stop-motion, no wiggle. */
function identitySeed(value: number) {
  return { frame: 0, value, easing: 'stop-motion', wiggle: 0 };
}

describe('59-17 rail motion commands — add a Motion channel (G1)', () => {
  it('adds Scale to a Position-only rail: ONE channel, one identity key at frame 0 seeded with stop-motion', () => {
    const before = positionOnlyRecord();
    const records = [before];
    const result = addMotionChannel({ records, railId: 'rail-1', channelId: 'scale' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const record = recordOf(result.records);
    // Model unit: Scale is a FACTOR (1 === 100% in the inspector/gizmo pair).
    expect(channelOf(record, 'scale').keys).toEqual([identitySeed(1)]);
    expect(channelOf(record, 'scale').keys).toHaveLength(1);
    // The previously carried channels are byte-identical and still ordered first.
    expect(channelOf(record, 'position-x')).toEqual(channelOf(before, 'position-x'));
    expect(channelOf(record, 'position-y')).toEqual(channelOf(before, 'position-y'));
    expect(record.channels.map((channel) => channel.id)).toEqual([
      'position-x', 'position-y', 'scale',
    ]);
    expect(record.railId).toBe('rail-1');
    expect(record.anchorKeyId).toBe('key-a');
    // Pure: the input collection keeps its reference and its shape.
    expect(records[0]).toBe(before);
    expect(before.channels).toHaveLength(2);
  });

  it('adds the grouped Position pair in ONE edit — both axes seeded at frame 0 with value 0 (D-11/D-12)', () => {
    const records = [scaleOnlySeedRecord()];
    const result = addMotionChannel({ records, railId: 'rail-1', channelId: 'position-x' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const record = recordOf(result.records);
    expect(channelOf(record, 'position-x').keys).toEqual([identitySeed(0)]);
    expect(channelOf(record, 'position-y').keys).toEqual([identitySeed(0)]);
    // One reducer edit: the rail grew by the whole pair, and Scale is untouched.
    expect(record.channels).toHaveLength(3);
    expect(channelOf(record, 'scale')).toEqual(channelOf(scaleOnlySeedRecord(), 'scale'));
  });

  it('adds Rotation and Opacity as single channels with their own identity seeds', () => {
    const rotation = addMotionChannel({
      records: [positionOnlyRecord()],
      railId: 'rail-1',
      channelId: 'rotation',
    });
    expect(rotation.ok).toBe(true);
    if (!rotation.ok) return;
    expect(channelOf(recordOf(rotation.records), 'rotation').keys).toEqual([identitySeed(0)]);
    expect(recordOf(rotation.records).channels).toHaveLength(3);

    const opacity = addMotionChannel({
      records: [positionOnlyRecord()],
      railId: 'rail-1',
      channelId: 'opacity',
    });
    expect(opacity.ok).toBe(true);
    if (!opacity.ok) return;
    // Opacity stores a fraction: 1 === 100%.
    expect(channelOf(recordOf(opacity.records), 'opacity').keys).toEqual([identitySeed(1)]);
    expect(recordOf(opacity.records).channels).toHaveLength(3);
  });

  it('refuses a channel the rail already carries with its exact sentence and writes nothing', () => {
    const before = positionOnlyRecord();
    const records = [before];

    for (const channelId of ['position-x', 'position-y'] as const) {
      const result = addMotionChannel({ records, railId: 'rail-1', channelId });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe('This Motion channel is already present.');
    }
    expect(records[0]).toBe(before);
    expect(before.channels).toHaveLength(2);

    // The round trip: adding Scale once succeeds, adding it again refuses and
    // never duplicates the channel.
    const first = addMotionChannel({ records, railId: 'rail-1', channelId: 'scale' });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const again = addMotionChannel({
      records: first.records,
      railId: 'rail-1',
      channelId: 'scale',
    });
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.reason).toBe('This Motion channel is already present.');
    expect(channelOf(recordOf(first.records), 'scale').keys).toHaveLength(1);
  });

  it('refuses a null, empty or over-long rail id with its exact sentence and no reducer write', () => {
    for (const railId of [null, '', `rail-${'x'.repeat(260)}`]) {
      const result = addMotionChannel({
        records: [positionOnlyRecord()],
        railId,
        channelId: 'scale',
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe('Select a rail first.');
    }
  });

  it('creates the rail record when a view is supplied — choosing a channel is what animates (261107)', () => {
    const records = [positionOnlyRecord()];
    const view = {
      railId: null,
      anchorKeyId: 'k9',
      startFrame: 0,
      endFrameExclusive: 12,
      keyIds: ['k9'],
      railType: 'standard' as const,
      loopId: null,
    };
    const result = addMotionChannel({
      records,
      railId: null,
      view,
      views: [view],
      channelId: 'scale',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.records).toHaveLength(2);
    const created = result.records.find((record) => record.anchorKeyId === 'k9')!;
    expect(created.channels.map((channel) => channel.id)).toEqual(['scale']);
    // The input collection is never mutated.
    expect(records).toHaveLength(1);
  });

  it('refuses an unknown rail when no view can bind it', () => {
    const records = [positionOnlyRecord()];
    const result = addMotionChannel({
      records,
      railId: 'rail-missing',
      channelId: 'scale',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('Select a rail first.');
    expect(records).toHaveLength(1);
  });
});

describe('59-17 rail motion commands — add-channel availability (MUI-06)', () => {
  it('names the missing rail, the missing record and the exhausted inventory in the fixed prerequisite order', () => {
    expect(resolveMotionCommandAvailability({
      command: 'add-motion-channel',
      hasRail: false,
    })).toEqual({ enabled: false, reason: 'Select a rail first.' });

    expect(resolveMotionCommandAvailability({
      command: 'add-motion-channel',
      hasRail: true,
      hasMotionRecord: false,
    })).toEqual({
      enabled: false,
      reason: 'Animate this rail before adding a Motion channel.',
    });

    expect(resolveMotionCommandAvailability({
      command: 'add-motion-channel',
      hasRail: true,
      hasMotionRecord: true,
      hasKeylessChannel: false,
    })).toEqual({
      enabled: false,
      reason: 'Every Motion channel is already present on this rail.',
    });

    expect(resolveMotionCommandAvailability({
      command: 'add-motion-channel',
      hasRail: true,
      hasMotionRecord: true,
      hasKeylessChannel: true,
    })).toEqual({ enabled: true, reason: null });
  });

  it('answers BEFORE the channel-selection and cursor-span guards (the affordance needs neither)', () => {
    expect(resolveMotionCommandAvailability({
      command: 'add-motion-channel',
      hasRail: true,
      hasMotionRecord: true,
      hasKeylessChannel: true,
      hasChannel: false,
      cursorInsideRailSpan: false,
    })).toEqual({ enabled: true, reason: null });

    expect(resolveMotionCommandAvailability({
      command: 'add-motion-channel',
      hasRail: true,
      hasMotionRecord: true,
      hasKeylessChannel: false,
      hasChannel: false,
      cursorInsideRailSpan: false,
    })).toEqual({
      enabled: false,
      reason: 'Every Motion channel is already present on this rail.',
    });
  });

  it('is never an action-bar command — the affordance is the block\'s own row', () => {
    for (const scope of RAIL_MOTION_SELECTION_SCOPES) {
      expect(CONTEXTUAL_COMMANDS_BY_SCOPE[scope]).not.toContain('add-motion-channel');
    }
  });
});
