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
  parsePhysicPaintRotoRailMotions,
  PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY,
  type PhysicPaintRotoRailMotionRecord,
} from './railMotionModel';
import {
  deriveKeyRailSegments,
  type KeyRailSegment,
} from '../view/physicsPaintKeyRailPresentation';

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

// ---------------------------------------------------------------------------
// Gate B truth table driven end-to-end through the REAL deriveKeyRailSegments
// projection. Every row declares the world before and after the structural
// event, the record event, and the resolved identity outcome. Assertions are
// on active/orphan identity and rail-local frames, never on function names.
// ---------------------------------------------------------------------------

interface TruthKey {
  readonly keyId: string;
  readonly appFrame: number;
}

interface TruthWorld {
  readonly keys: readonly TruthKey[];
  readonly breaks?: readonly string[];
  readonly groupOwned?: readonly string[];
  readonly loops?: readonly RailMotionLoopClipSource[];
}

type TruthEvent =
  | { readonly kind: 'observe' }
  | {
    readonly kind: 'animate';
    readonly railId: string;
    readonly anchorKeyId: string;
    readonly frame: number;
  }
  | { readonly kind: 'delete-first-key'; readonly railId: string; readonly nextAnchorKeyId: string }
  | { readonly kind: 'delete-only-key'; readonly railId: string }
  | { readonly kind: 'split'; readonly railId: string }
  | {
    readonly kind: 'merge';
    readonly headAnchorKeyId: string;
    readonly tailAnchorKeyId: string;
    readonly mergedAnchorKeyId: string;
  }
  | { readonly kind: 'move-rail-start'; readonly railId: string }
  | {
    readonly kind: 'copy';
    readonly plan: readonly RailMotionCopyPlanEntry[];
    readonly copiedSourceRailIds?: readonly string[];
  };

interface TruthFrameExpectation {
  readonly railId: string;
  readonly frames: readonly number[];
}

interface TruthRow {
  readonly name: string;
  readonly before: TruthWorld;
  readonly after: TruthWorld;
  readonly records: readonly PhysicPaintRotoRailMotionRecord[];
  readonly event: TruthEvent;
  readonly active: readonly string[];
  readonly orphaned: readonly string[];
  readonly adoptedRailId: string | null;
  readonly droppedRailId: string | null;
  readonly frames: readonly TruthFrameExpectation[];
  readonly absentRailIds?: readonly string[];
  readonly unboundViewAnchors?: readonly string[];
  readonly sourceUntouched?: boolean;
}

interface TruthOutcome {
  readonly records: readonly PhysicPaintRotoRailMotionRecord[];
  readonly adoptedRailId: string | null;
  readonly droppedRailId: string | null;
}

function deriveTruthSegments(world: TruthWorld): readonly KeyRailSegment[] {
  return deriveKeyRailSegments({
    orderedRealKeys: [...world.keys].sort((left, right) => left.appFrame - right.appFrame),
    incomingInterpolationBreakKeyIds: new Set(world.breaks ?? []),
    groupOwnedKeyIds: new Set(world.groupOwned ?? []),
  });
}

function applyTruthEvent(
  records: readonly PhysicPaintRotoRailMotionRecord[],
  event: TruthEvent,
): TruthOutcome {
  switch (event.kind) {
    case 'observe':
      return { records, adoptedRailId: null, droppedRailId: null };
    case 'animate':
      return {
        records: applyRailMotionEditToCollection(records, {
          kind: 'animate',
          railId: event.railId,
          anchorKeyId: event.anchorKeyId,
          frame: event.frame,
        }),
        adoptedRailId: null,
        droppedRailId: null,
      };
    case 'delete-first-key':
      return {
        records: records.map((record) => (
          record.railId === event.railId
            ? onDeleteFirstKey(record, event.nextAnchorKeyId)
            : record
        )),
        adoptedRailId: null,
        droppedRailId: null,
      };
    case 'delete-only-key':
      return {
        records: onDeleteOnlyKey(records, event.railId),
        adoptedRailId: null,
        droppedRailId: null,
      };
    case 'split':
      return {
        records: onSplitRail(records, event.railId),
        adoptedRailId: null,
        droppedRailId: null,
      };
    case 'merge': {
      const result = onMergeRails(
        records,
        event.headAnchorKeyId,
        event.tailAnchorKeyId,
        event.mergedAnchorKeyId,
      );
      return {
        records: result.records,
        adoptedRailId: result.adoptedRailId,
        droppedRailId: result.droppedRailId,
      };
    }
    case 'move-rail-start':
      return {
        records: records.map((record) => (
          record.railId === event.railId ? onRailStartMoved(record) : record
        )),
        adoptedRailId: null,
        droppedRailId: null,
      };
    case 'copy': {
      const next = rekeyRailMotionsForCopy(records, event.plan, event.copiedSourceRailIds);
      if (next === null) throw new Error('copy plan was rejected by the identity layer');
      return { records: next, adoptedRailId: null, droppedRailId: null };
    }
  }
}

function boundKeyRailRecord(
  anchorKeyId: string,
  frames: readonly number[] = [0],
): PhysicPaintRotoRailMotionRecord {
  const binding = bindKeyRail(anchorKeyId);
  return animatedRecord(binding.railId, anchorKeyId, frames);
}

const loopRailSource: RailMotionLoopClipSource = loopClip({ loopId: 'loop-1' });

const animatedBareRail = boundKeyRailRecord('A', [0]);
const nonFirstKeyRecord = boundKeyRailRecord('A', [0, 4]);
const firstKeyDeleteRecord = boundKeyRailRecord('A', [0, 4]);
const onlyKeyRecord = boundKeyRailRecord('A');
const splitRecord = boundKeyRailRecord('A', [0, 4]);
const mergeTailRecord = animatedRecord('rail-tail', 'B', [0, 3]);
const mergeHeadRecord = animatedRecord('rail-head', 'A', [0, 2]);
const mergeBothTailRecord = animatedRecord('rail-tail-both', 'B', [0, 3]);
const startMovedRecord = boundKeyRailRecord('A', [0, 4]);
const orphanRecord = boundKeyRailRecord('A');
const copyLoopSourceRecord = animatedRecord('loop-src', 'k1', [0, 5]);
const copyKeySourceRecord = boundKeyRailRecord('A', [0, 2]);
const copyDestinationKeyBinding = bindKeyRail('A-new');

const KEYS_A_B_C: readonly TruthKey[] = Object.freeze([
  Object.freeze({ keyId: 'A', appFrame: 4 }),
  Object.freeze({ keyId: 'B', appFrame: 6 }),
  Object.freeze({ keyId: 'C', appFrame: 8 }),
]);

const TRUTH_TABLE: readonly TruthRow[] = Object.freeze([
  {
    name: 'animate a bare key rail: the minted railId binds to the segment',
    before: { keys: KEYS_A_B_C },
    after: { keys: KEYS_A_B_C },
    records: [],
    event: {
      kind: 'animate',
      railId: animatedBareRail.railId,
      anchorKeyId: 'A',
      frame: 0,
    },
    active: [animatedBareRail.railId],
    orphaned: [],
    adoptedRailId: null,
    droppedRailId: null,
    frames: [{ railId: animatedBareRail.railId, frames: [0] }],
  },
  {
    name: 'animate a loop rail: identity is the loopId, nothing is minted',
    before: { keys: [], loops: [loopRailSource] },
    after: { keys: [], loops: [loopRailSource] },
    records: [],
    event: { kind: 'animate', railId: 'loop-1', anchorKeyId: 'k1', frame: 0 },
    active: ['loop-1'],
    orphaned: [],
    adoptedRailId: null,
    droppedRailId: null,
    frames: [{ railId: 'loop-1', frames: [0] }],
  },
  {
    name: 'delete a non-first key: the rail keeps its record and frames',
    before: { keys: KEYS_A_B_C },
    after: { keys: [{ keyId: 'A', appFrame: 4 }, { keyId: 'C', appFrame: 8 }] },
    records: [nonFirstKeyRecord],
    event: { kind: 'observe' },
    active: [nonFirstKeyRecord.railId],
    orphaned: [],
    adoptedRailId: null,
    droppedRailId: null,
    frames: [{ railId: nonFirstKeyRecord.railId, frames: [0, 4] }],
  },
  {
    name: 'delete the first key: re-anchor keeps the rail and its frames',
    before: { keys: KEYS_A_B_C },
    after: { keys: [{ keyId: 'B', appFrame: 6 }, { keyId: 'C', appFrame: 8 }] },
    records: [firstKeyDeleteRecord],
    event: {
      kind: 'delete-first-key',
      railId: firstKeyDeleteRecord.railId,
      nextAnchorKeyId: 'B',
    },
    active: [firstKeyDeleteRecord.railId],
    orphaned: [],
    adoptedRailId: null,
    droppedRailId: null,
    frames: [{ railId: firstKeyDeleteRecord.railId, frames: [0, 4] }],
  },
  {
    name: 'delete the only key: the motion record is removed with the rail',
    before: { keys: [{ keyId: 'A', appFrame: 4 }] },
    after: { keys: [] },
    records: [onlyKeyRecord],
    event: { kind: 'delete-only-key', railId: onlyKeyRecord.railId },
    active: [],
    orphaned: [],
    adoptedRailId: null,
    droppedRailId: null,
    frames: [],
    absentRailIds: [onlyKeyRecord.railId],
  },
  {
    name: 'split at a break: the head keeps the railId and the tail has none',
    before: { keys: KEYS_A_B_C },
    after: { keys: KEYS_A_B_C, breaks: ['B'] },
    records: [splitRecord],
    event: { kind: 'split', railId: splitRecord.railId },
    active: [splitRecord.railId],
    orphaned: [],
    adoptedRailId: null,
    droppedRailId: null,
    frames: [{ railId: splitRecord.railId, frames: [0, 4] }],
    unboundViewAnchors: ['B'],
  },
  {
    name: 'merge with only the tail animated: the tail record is adopted under its own railId',
    before: { keys: KEYS_A_B_C, breaks: ['B'] },
    after: { keys: KEYS_A_B_C },
    records: [mergeTailRecord],
    event: {
      kind: 'merge',
      headAnchorKeyId: 'A',
      tailAnchorKeyId: 'B',
      mergedAnchorKeyId: 'A',
    },
    active: [mergeTailRecord.railId],
    orphaned: [],
    adoptedRailId: mergeTailRecord.railId,
    droppedRailId: null,
    frames: [{ railId: mergeTailRecord.railId, frames: [0, 3] }],
  },
  {
    name: 'merge with both sides animated: the head wins and the tail drop is reported',
    before: { keys: KEYS_A_B_C, breaks: ['B'] },
    after: { keys: KEYS_A_B_C },
    records: [mergeHeadRecord, mergeBothTailRecord],
    event: {
      kind: 'merge',
      headAnchorKeyId: 'A',
      tailAnchorKeyId: 'B',
      mergedAnchorKeyId: 'A',
    },
    active: [mergeHeadRecord.railId],
    orphaned: [],
    adoptedRailId: null,
    droppedRailId: mergeBothTailRecord.railId,
    frames: [{ railId: mergeHeadRecord.railId, frames: [0, 2] }],
    absentRailIds: [mergeBothTailRecord.railId],
  },
  {
    name: 'move the rail start: rail-local key frames do not move',
    before: { keys: [{ keyId: 'A', appFrame: 4 }, { keyId: 'B', appFrame: 6 }] },
    after: { keys: [{ keyId: 'A', appFrame: 9 }, { keyId: 'B', appFrame: 11 }] },
    records: [startMovedRecord],
    event: { kind: 'move-rail-start', railId: startMovedRecord.railId },
    active: [startMovedRecord.railId],
    orphaned: [],
    adoptedRailId: null,
    droppedRailId: null,
    frames: [{ railId: startMovedRecord.railId, frames: [0, 4] }],
  },
  {
    name: 'a rail that becomes Group-owned leaves its motion record retained as an orphan',
    before: { keys: [{ keyId: 'A', appFrame: 4 }, { keyId: 'B', appFrame: 6 }] },
    after: {
      keys: [{ keyId: 'A', appFrame: 4 }, { keyId: 'B', appFrame: 6 }],
      groupOwned: ['A', 'B'],
    },
    records: [orphanRecord],
    event: { kind: 'observe' },
    active: [],
    orphaned: [orphanRecord.railId],
    adoptedRailId: null,
    droppedRailId: null,
    frames: [{ railId: orphanRecord.railId, frames: [0] }],
  },
  {
    name: 'copy a rail set: motion follows fresh destination identities, source untouched',
    before: {
      keys: [{ keyId: 'A', appFrame: 4 }, { keyId: 'B', appFrame: 6 }],
      loops: [loopClip({ loopId: 'loop-src' })],
    },
    after: {
      keys: [{ keyId: 'A-new', appFrame: 14 }, { keyId: 'B-new', appFrame: 15 }],
      loops: [loopClip({
        loopId: 'loop-dst',
        placementStart: 20,
        sourceKeyIds: ['k-new', 'k2-new', 'k3-new'],
      })],
    },
    records: [copyLoopSourceRecord, copyKeySourceRecord],
    event: {
      kind: 'copy',
      plan: [
        { sourceRailId: 'loop-src', destinationRailId: 'loop-dst', anchorKeyId: 'k-new' },
        {
          sourceRailId: copyKeySourceRecord.railId,
          destinationRailId: copyDestinationKeyBinding.railId,
          anchorKeyId: 'A-new',
        },
      ],
      copiedSourceRailIds: ['loop-src', copyKeySourceRecord.railId],
    },
    active: ['loop-dst', copyDestinationKeyBinding.railId],
    orphaned: [],
    adoptedRailId: null,
    droppedRailId: null,
    frames: [
      { railId: 'loop-dst', frames: [0, 5] },
      { railId: copyDestinationKeyBinding.railId, frames: [0, 2] },
    ],
    sourceUntouched: true,
  },
]);

describe('rail motion identity truth table (real segment derivation)', () => {
  for (const row of TRUTH_TABLE) {
    it(row.name, () => {
      const sourceJsonBefore = JSON.stringify(row.records);
      const outcome = applyTruthEvent(row.records, row.event);
      if (row.sourceUntouched) {
        expect(JSON.stringify(row.records)).toBe(sourceJsonBefore);
      }

      const segments = deriveTruthSegments(row.after);
      const views = assignRailMotionRailViews(outcome.records, row.after.loops ?? [], segments);
      const reconciliation = reconcileRailMotions(outcome.records, views);

      expect([...reconciliation.active.keys()].sort()).toEqual([...row.active].sort());
      expect(reconciliation.orphaned.map((record) => record.railId).sort())
        .toEqual([...row.orphaned].sort());
      expect(outcome.adoptedRailId).toBe(row.adoptedRailId);
      expect(outcome.droppedRailId).toBe(row.droppedRailId);

      for (const expectation of row.frames) {
        const record = outcome.records.find((entry) => entry.railId === expectation.railId);
        if (record === undefined) {
          throw new Error(`expected a motion record for rail "${expectation.railId}"`);
        }
        expect(positionFrames(record)).toEqual(expectation.frames);
      }
      for (const absentRailId of row.absentRailIds ?? []) {
        expect(outcome.records.some((entry) => entry.railId === absentRailId)).toBe(false);
      }
      for (const anchorKeyId of row.unboundViewAnchors ?? []) {
        const view = views.find((entry) => entry.anchorKeyId === anchorKeyId);
        expect(view?.railId ?? null).toBeNull();
      }

      // Every surviving record keeps its rail-local key frames: deleting a
      // neighbour, splitting or merging never ripples into motion.
      for (const before of row.records) {
        const after = outcome.records.find((entry) => entry.railId === before.railId);
        if (after === undefined) continue;
        expect(positionFrames(after)).toEqual(positionFrames(before));
        expect(after.channels).toEqual(before.channels);
      }
    });
  }

  it('never rebinds an orphan whose anchor is a non-first key on a live rail', () => {
    const orphan = motionRecord('rail-orphan', 'B');
    const segments = deriveTruthSegments({
      keys: [
        { keyId: 'A', appFrame: 4 },
        { keyId: 'B', appFrame: 6 },
        { keyId: 'C', appFrame: 8 },
      ],
    });

    const views = assignRailMotionRailViews([orphan], [], segments);
    expect(views).toHaveLength(1);
    expect(views[0].railId).toBeNull();

    const reconciliation = reconcileRailMotions([orphan], views);
    expect(reconciliation.active.size).toBe(0);
    expect(reconciliation.orphaned.map((record) => record.railId)).toEqual(['rail-orphan']);
  });

  it('keeps session-only rail-set identity out of the persisted motion record', () => {
    const record = motionRecord('rail-a', 'key-a');

    expect(Object.keys(record).sort()).toEqual(['anchorKeyId', 'channels', 'railId']);
    expect('kind' in record).toBe(false);

    const serialized = JSON.stringify(record);
    expect(serialized).not.toMatch(/"kind"\s*:\s*"(loop|key-rail)"/);

    const parsed = parsePhysicPaintRotoRailMotions(JSON.parse(`[${serialized}]`));
    expect(parsed).toHaveLength(1);
    expect(Object.keys(parsed[0]).sort()).toEqual(['anchorKeyId', 'channels', 'railId']);
  });
});
