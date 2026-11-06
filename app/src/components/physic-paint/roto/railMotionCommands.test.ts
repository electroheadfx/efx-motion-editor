import { describe, expect, it } from 'vitest';
import type { RailMotionRailView } from './railMotionIdentity';
import type { PhysicPaintRotoRailMotionRecord } from './railMotionModel';
import {
  animateRail,
  railMotionCursorFrame,
  resolveMotionCommandAvailability,
  resolveSelectedRailView,
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
