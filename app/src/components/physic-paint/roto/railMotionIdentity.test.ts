import { describe, expect, it } from 'vitest';
import {
  bindKeyRail,
  bindLoopRail,
  describeRailMotionOrphan,
  reconcileRailMotions,
  type RailMotionRailView,
} from './railMotionIdentity';
import type { PhysicPaintRotoRailMotionRecord } from './railMotionModel';

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
