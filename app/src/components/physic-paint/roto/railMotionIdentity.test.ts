import { describe, expect, it } from 'vitest';
import {
  assignRailMotionRailViews,
  bindKeyRail,
  bindLoopRail,
  deriveRailMotionRailViews,
  describeRailMotionOrphan,
  onDeleteFirstKey,
  onDeleteOnlyKey,
  onMergeRails,
  onRailStartMoved,
  onSplitRail,
  reconcileRailMotions,
  rekeyRailMotionsForCopy,
  type RailMotionCopyPlanEntry,
  type RailMotionLoopClipSource,
  type RailMotionRailView,
} from './railMotionIdentity';
import {
  applyRailMotionEditToCollection,
  PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY,
  type PhysicPaintRotoRailMotionRecord,
} from './railMotionModel';
import type { KeyRailSegment } from '../view/physicsPaintKeyRailPresentation';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function motionRecord(railId: string, anchorKeyId: string): PhysicPaintRotoRailMotionRecord {
  return Object.freeze({
    railId,
    anchorKeyId,
    channels: Object.freeze([
      Object.freeze({
        id: 'opacity' as const,
        keys: Object.freeze([
          Object.freeze({ frame: 0, value: 1, easing: 'ease' as const, wiggle: 0 }),
        ]),
      }),
    ]),
  });
}

function railView(view: Partial<RailMotionRailView> & { anchorKeyId: string }): RailMotionRailView {
  return Object.freeze({
    railId: null,
    startFrame: 0,
    endFrameExclusive: 1,
    keyIds: Object.freeze([view.anchorKeyId]),
    railType: 'standard' as const,
    loopId: null,
    ...view,
  });
}

function loopClip(
  overrides: Partial<RailMotionLoopClipSource> & { loopId: string },
): RailMotionLoopClipSource {
  return {
    placementStart: 10,
    sourceKeyIds: ['k1', 'k2', 'k3'],
    repeat: 1,
    mode: 'progressive',
    railKind: 'playscript',
    ...overrides,
  };
}

function keyRailSegment(
  firstKeyId: string,
  keyIds: readonly string[],
  firstKeyFrame: number,
  lastKeyFrame: number,
): KeyRailSegment {
  return Object.freeze({
    firstKeyId,
    keyIds: Object.freeze([...keyIds]),
    firstKeyFrame,
    lastKeyFrame,
  });
}

function animatedRecord(
  railId: string,
  anchorKeyId: string,
  keyFrames: readonly number[] = [0],
): PhysicPaintRotoRailMotionRecord {
  let records = applyRailMotionEditToCollection(PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY, {
    kind: 'animate',
    railId,
    anchorKeyId,
    frame: keyFrames[0] ?? 0,
  });
  for (const frame of keyFrames.slice(1)) {
    records = applyRailMotionEditToCollection(records, {
      kind: 'set-key',
      railId,
      channel: 'position-x',
      frame,
      value: frame * 10,
    });
  }
  return records[0];
}

function positionFrames(record: PhysicPaintRotoRailMotionRecord): readonly number[] {
  const channel = record.channels.find((entry) => entry.id === 'position-x');
  return channel === undefined ? [] : channel.keys.map((key) => key.frame);
}

describe('rail motion identity bindings', () => {
  it('binds a loop rail to its loopId without minting an id', () => {
    const binding = bindLoopRail('loop-rail-a', 'source-key-1');
    expect(binding).toEqual({ railId: 'loop-rail-a', anchorKeyId: 'source-key-1' });
    expect(Object.isFrozen(binding)).toBe(true);
    expect(bindLoopRail('loop-rail-a').railId).toBe('loop-rail-a');
  });

  it('mints a distinct durable rail id for every key-rail binding', () => {
    const first = bindKeyRail('key-1');
    const second = bindKeyRail('key-1');

    expect(first.anchorKeyId).toBe('key-1');
    expect(first.railId).not.toBe('key-1');
    expect(first.railId).toMatch(UUID_PATTERN);
    expect(second.railId).toMatch(UUID_PATTERN);
    expect(first.railId).not.toBe(second.railId);
  });
});

describe('rail motion reconciliation', () => {
  it('matches only an exact railId', () => {
    const record = motionRecord('rail-a', 'key-1');
    const result = reconcileRailMotions([record], [
      railView({ railId: 'rail-a', anchorKeyId: 'key-1' }),
      railView({ railId: 'rail-b', anchorKeyId: 'key-2' }),
    ]);

    expect([...result.active.keys()]).toEqual(['rail-a']);
    expect(result.active.get('rail-a')).toBe(record);
    expect(result.orphaned).toEqual([]);
  });

  it('keeps a record active when its anchor hint is stale', () => {
    const record = motionRecord('rail-a', 'deleted-first-key');
    const result = reconcileRailMotions([record], [
      railView({ railId: 'rail-a', anchorKeyId: 'new-first-key' }),
    ]);

    expect(result.active.get('rail-a')).toBe(record);
    expect(result.orphaned).toEqual([]);
  });

  it('retains every unmatched record as an orphan in canonical railId order', () => {
    const orphanC = motionRecord('rail-c', 'key-c');
    const active = motionRecord('rail-a', 'key-a');
    const orphanB = motionRecord('rail-b', 'key-b');

    const result = reconcileRailMotions(
      [orphanC, active, orphanB],
      [railView({ railId: 'rail-a', anchorKeyId: 'key-a' })],
    );

    expect(result.orphaned.map((entry) => entry.railId)).toEqual(['rail-b', 'rail-c']);
    expect(result.orphaned[0]).toBe(orphanB);
    expect(result.orphaned[1]).toBe(orphanC);
    expect(Object.isFrozen(result.orphaned)).toBe(true);
  });

  it('never matches a record to a rail that was never animated', () => {
    const record = motionRecord('rail-a', 'key-1');
    const result = reconcileRailMotions([record], [
      railView({ railId: null, anchorKeyId: 'key-1' }),
    ]);

    expect(result.active.size).toBe(0);
    expect(result.orphaned).toEqual([record]);
  });

  it('returns frozen records keyed by railId', () => {
    const record = motionRecord('rail-a', 'key-1');
    const result = reconcileRailMotions([record], [
      railView({ railId: 'rail-a', anchorKeyId: 'key-1' }),
    ]);

    const active = result.active.get('rail-a');
    expect(result.active.size).toBe(1);
    expect(active).toBe(record);
    expect(Object.isFrozen(active)).toBe(true);
    expect(Object.isFrozen(active?.channels)).toBe(true);
  });

  it('describes an orphaned record with its rail and anchor ids', () => {
    const description = describeRailMotionOrphan(motionRecord('rail-z', 'key-z'));

    expect(description).toContain('rail-z');
    expect(description).toContain('key-z');
    expect(description.length).toBeGreaterThan(0);
  });
});

describe('rail motion rail views', () => {
  it('derives one view per loop clip with the loop lifecycle span', () => {
    const views = deriveRailMotionRailViews([
      loopClip({ loopId: 'loop-1' }),
      loopClip({ loopId: 'loop-inf', repeat: 'infinity' }),
      loopClip({ loopId: 'loop-reveal', railKind: 'reveal' }),
      loopClip({ loopId: 'loop-static', mode: 'static' }),
    ], []);

    expect(views.map((view) => view.railId)).toEqual(['loop-1', 'loop-inf', 'loop-reveal', 'loop-static']);
    expect(views[0]).toEqual({
      railId: 'loop-1',
      anchorKeyId: 'k1',
      startFrame: 10,
      endFrameExclusive: 13,
      keyIds: ['k1', 'k2', 'k3'],
      railType: 'motion',
      loopId: 'loop-1',
    });
    expect(views[1].endFrameExclusive).toBe(13);
    expect(views[2].railType).toBe('reveal');
    expect(views[3].railType).toBe('static');
    expect(Object.isFrozen(views)).toBe(true);
    expect(Object.isFrozen(views[0])).toBe(true);
    expect(Object.isFrozen(views[0].keyIds)).toBe(true);
  });

  it('derives one view per key rail segment with a null railId until bound', () => {
    const views = deriveRailMotionRailViews([], [
      keyRailSegment('A', ['A', 'B'], 4, 9),
      keyRailSegment('C', ['C'], 12, 12),
    ]);

    expect(views).toEqual([
      {
        railId: null,
        anchorKeyId: 'A',
        startFrame: 4,
        endFrameExclusive: 10,
        keyIds: ['A', 'B'],
        railType: 'standard',
        loopId: null,
      },
      {
        railId: null,
        anchorKeyId: 'C',
        startFrame: 12,
        endFrameExclusive: 13,
        keyIds: ['C'],
        railType: 'standard',
        loopId: null,
      },
    ]);
  });

  it('binds key-rail records by their anchor hint at first binding only', () => {
    const record = motionRecord('rail-k', 'A');
    const segments = [keyRailSegment('A', ['A', 'B'], 4, 9), keyRailSegment('C', ['C'], 12, 12)];

    const views = assignRailMotionRailViews([record], [], segments);
    expect(views[0].railId).toBe('rail-k');
    expect(views[1].railId).toBeNull();
    expect(assignRailMotionRailViews([record], [], segments)).toEqual(views);
  });

  it('binds loop views by loopId even when the anchor hint is stale', () => {
    const staleRecord = motionRecord('loop-1', 'deleted-source-key');
    const views = assignRailMotionRailViews(
      [staleRecord],
      [loopClip({ loopId: 'loop-1' })],
      [],
    );

    expect(views).toHaveLength(1);
    expect(views[0].railId).toBe('loop-1');
    expect(views[0].loopId).toBe('loop-1');
  });

  it('never binds a loop-owned record to a key rail by anchor coincidence', () => {
    const loopOwned = motionRecord('loop-1', 'A');
    const views = assignRailMotionRailViews(
      [loopOwned],
      [loopClip({ loopId: 'loop-1' })],
      [keyRailSegment('A', ['A'], 4, 4)],
    );

    const keyView = views.find((view) => view.anchorKeyId === 'A');
    expect(keyView?.railId).toBeNull();
  });
});

describe('rail motion gate B transitions', () => {
  it('re-stamps the anchor when the first key is deleted without rewriting frames', () => {
    const record = animatedRecord('rail-k', 'A', [0, 4]);
    const next = onDeleteFirstKey(record, 'B');

    expect(next.anchorKeyId).toBe('B');
    expect(next.railId).toBe('rail-k');
    expect(next.channels).toEqual(record.channels);
    expect(positionFrames(next)).toEqual([0, 4]);
    expect(record.anchorKeyId).toBe('A');
    expect(onDeleteFirstKey(record, 'A')).toBe(record);
  });

  it('removes the record when its only key is deleted', () => {
    const keep = animatedRecord('rail-b', 'B');
    const drop = animatedRecord('rail-a', 'A');
    const records = Object.freeze([drop, keep]);

    const next = onDeleteOnlyKey(records, 'rail-a');
    expect(next).toHaveLength(1);
    expect(next[0]).toBe(keep);
    expect(onDeleteOnlyKey(records, 'missing')).toBe(records);
    expect(onDeleteOnlyKey(Object.freeze([drop]), 'rail-a')).toBe(PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY);
  });

  it('keeps the head record and creates no tail record on split', () => {
    const records = Object.freeze([animatedRecord('rail-k', 'A', [0, 4])]);

    expect(onSplitRail(records, 'rail-k')).toBe(records);
  });

  it('adopts the tail record when only the tail carries motion', () => {
    const tail = animatedRecord('rail-t', 'B', [0, 3]);
    const result = onMergeRails(Object.freeze([tail]), 'A', 'B', 'A');

    expect(result.adoptedRailId).toBe('rail-t');
    expect(result.droppedRailId).toBeNull();
    expect(result.records).toHaveLength(1);
    expect(result.records[0].railId).toBe('rail-t');
    expect(result.records[0].anchorKeyId).toBe('A');
    expect(positionFrames(result.records[0])).toEqual([0, 3]);
  });

  it('keeps the head record and reports the dropped tail when both carry motion', () => {
    const head = animatedRecord('rail-h', 'A', [0, 2]);
    const tail = animatedRecord('rail-t', 'B', [0, 3]);
    const result = onMergeRails(Object.freeze([head, tail]), 'A', 'B', 'A');

    expect(result.droppedRailId).toBe('rail-t');
    expect(result.adoptedRailId).toBeNull();
    expect(result.records).toHaveLength(1);
    expect(result.records[0].railId).toBe('rail-h');
    expect(result.records[0].anchorKeyId).toBe('A');
    expect(positionFrames(result.records[0])).toEqual([0, 2]);
  });

  it('reports nothing when only the head carries motion or neither does', () => {
    const head = animatedRecord('rail-h', 'A');
    const records = Object.freeze([head]);
    const headOnly = onMergeRails(records, 'A', 'B', 'A');

    expect(headOnly.records).toBe(records);
    expect(headOnly.adoptedRailId).toBeNull();
    expect(headOnly.droppedRailId).toBeNull();

    const neither = onMergeRails(PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY, 'A', 'B', 'A');
    expect(neither.records).toBe(PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY);
    expect(neither.adoptedRailId).toBeNull();
    expect(neither.droppedRailId).toBeNull();
  });

  it('returns the same record reference when the rail start moves', () => {
    const record = animatedRecord('rail-k', 'A', [0, 4]);

    expect(onRailStartMoved(record)).toBe(record);
  });

  it('rekeys a copied rail set onto fresh identities without rewriting frames', () => {
    const loopRecord = animatedRecord('loop-src', 'k1', [0, 5]);
    const keyRecord = animatedRecord('rail-src', 'A', [0, 2]);
    const bystander = animatedRecord('rail-other', 'Z');
    const records = Object.freeze([loopRecord, keyRecord, bystander]);
    const before = JSON.stringify(records);
    const plan: readonly RailMotionCopyPlanEntry[] = [
      { sourceRailId: 'loop-src', destinationRailId: 'loop-dst', anchorKeyId: 'k-new' },
      { sourceRailId: 'rail-src', destinationRailId: 'rail-dst', anchorKeyId: 'A-new' },
    ];

    const next = rekeyRailMotionsForCopy(records, plan, ['loop-src', 'rail-src']);
    expect(next).not.toBeNull();
    expect(next?.map((entry) => entry.railId)).toEqual(['loop-dst', 'rail-dst', 'rail-other']);

    const loopCopy = next?.find((entry) => entry.railId === 'loop-dst');
    expect(loopCopy?.anchorKeyId).toBe('k-new');
    expect(loopCopy?.channels).toEqual(loopRecord.channels);
    expect(loopCopy === undefined ? [] : positionFrames(loopCopy)).toEqual([0, 5]);

    const keyCopy = next?.find((entry) => entry.railId === 'rail-dst');
    expect(keyCopy?.anchorKeyId).toBe('A-new');
    expect(keyCopy?.channels).toEqual(keyRecord.channels);

    expect(JSON.stringify(records)).toBe(before);
    expect(records.map((entry) => entry.railId)).toEqual(['loop-src', 'rail-src', 'rail-other']);
    expect(next?.find((entry) => entry.railId === 'rail-other')).toBe(bystander);
  });

  it('returns the same collection for an empty plan or an un-animated source', () => {
    const records = Object.freeze([animatedRecord('rail-src', 'A')]);

    expect(rekeyRailMotionsForCopy(records, [])).toBe(records);
    expect(rekeyRailMotionsForCopy(records, [
      { sourceRailId: 'not-animated', destinationRailId: 'rail-new', anchorKeyId: 'Q' },
    ])).toBe(records);
  });

  it('fails closed when a copy plan omits a destination, duplicates one, collides, or misses a member', () => {
    const records = Object.freeze([
      animatedRecord('rail-src', 'A'),
      animatedRecord('rail-other', 'Z'),
    ]);

    expect(rekeyRailMotionsForCopy(records, [
      { sourceRailId: 'rail-src', destinationRailId: '', anchorKeyId: 'A' },
    ])).toBeNull();

    expect(rekeyRailMotionsForCopy(records, [
      { sourceRailId: 'rail-src', destinationRailId: 'rail-new', anchorKeyId: 'A' },
      { sourceRailId: 'rail-other', destinationRailId: 'rail-new', anchorKeyId: 'Z' },
    ])).toBeNull();

    expect(rekeyRailMotionsForCopy(records, [
      { sourceRailId: 'rail-src', destinationRailId: 'rail-other', anchorKeyId: 'A' },
    ])).toBeNull();

    expect(rekeyRailMotionsForCopy(records, [
      { sourceRailId: 'rail-other', destinationRailId: 'rail-new', anchorKeyId: 'Z' },
    ], ['rail-src'])).toBeNull();
  });
});
