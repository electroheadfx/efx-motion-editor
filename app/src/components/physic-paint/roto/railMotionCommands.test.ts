import { describe, expect, it } from 'vitest';
import type { RailMotionRailView } from './railMotionIdentity';
import type {
  PhysicPaintRotoRailMotionChannel,
  PhysicPaintRotoRailMotionRecord,
} from './railMotionModel';
import {
  CONTEXTUAL_COMMANDS_BY_SCOPE,
  RAIL_MOTION_SELECTION_SCOPES,
  animateRail,
  clearSelectionForScope,
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

function motionKey(frame: number, value: number, easing: 'hold' | 'ease' = 'ease', wiggle = 0) {
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
      easing: 'linear' as unknown as 'hold',
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

  it('finds the addressed key and reports none for an empty frame', () => {
    const record = motionRecord();
    expect(resolveMotionKeyAtFrame(record, 'scale', 10)?.value).toBe(2);
    expect(resolveMotionKeyAtFrame(record, 'scale', 4)).toBeNull();
    expect(resolveMotionKeyAtFrame(null, 'scale', 4)).toBeNull();
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
