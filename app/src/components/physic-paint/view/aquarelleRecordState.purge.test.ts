// ============================================================
//  quick-261023-ors Task 2 — purge the aquarelle script.
//
//  SCOPE LAWS:
//    - per-key purge splices ONLY non-Dry events whose playFrame
//      equals the requested frame; Dry is a sheet action and keeps
//      its place; every other frame is untouched by reference.
//    - clear-all removes every stroke identity (timeline + registry,
//      including already-deleted ones) but NEVER a Dry event.
//    - neither resets the record clock, and the revision bumps
//      EXACTLY once per non-empty purge.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest';
import type { AquarellePoint, AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import {
  aquarelleRecordClock,
  aquarelleStrokesRevision,
  aquarelleStrokeSerial,
  deleteAquarelleStrokeFromScript,
  emitAquarelleDry,
  getRecordedAquarellePayloadTimeline,
  getRecordedAquarelleStroke,
  getRecordedAquarelleStrokeEntries,
  hasAquarellePaintScriptForFrame,
  hasAquarelleScriptForFrame,
  isAquarelleStrokeDeleted,
  markAquarelleStrokeDeleted,
  purgeAllAquarelleKeyScripts,
  purgeAquarelleFrameScript,
  recordAquarelleStroke,
  resetAquarelleRecordState,
} from './aquarelleRecordState';

function point(x: number, y: number): AquarellePoint {
  return { x, y, p: 1, tx: 0, ty: 0, tw: 0 };
}

function stroke(mutationId: number, playFrame: number): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#103c65',
    params: { size: 12 },
    brushId: 'round',
    points: [point(0.1, 0.5), point(0.2, 0.5)],
    mutationId,
    timestamp: mutationId,
    playFrame,
  };
}

function nonDryIds(): number[] {
  return getRecordedAquarellePayloadTimeline().flatMap((event) =>
    'kind' in event ? [] : [(event.engine as { mutationId?: number }).mutationId!],
  );
}

beforeEach(() => {
  resetAquarelleRecordState();
});

describe('quick-261023-ors purgeAquarelleFrameScript', () => {
  it('removes only that frame events and registry entries, keeps Dry and other frames', () => {
    recordAquarelleStroke(8101, stroke(8101, 10));
    recordAquarelleStroke(8102, stroke(8102, 10));
    recordAquarelleStroke(8103, stroke(8103, 20));
    emitAquarelleDry(4242);

    const timelineBefore = [...getRecordedAquarellePayloadTimeline()];
    const survivorEntry = timelineBefore[2]!;
    const dryEntry = timelineBefore[3]!;
    const revisionBefore = aquarelleStrokesRevision.value;
    const clockBefore = aquarelleRecordClock();

    expect(purgeAquarelleFrameScript(10)).toBe(2);

    // Frame 20's entry and the Dry event are the exact same objects, in order.
    const timelineAfter = getRecordedAquarellePayloadTimeline();
    expect(timelineAfter).toHaveLength(2);
    expect(timelineAfter[0]).toBe(survivorEntry);
    expect(timelineAfter[1]).toBe(dryEntry);
    expect(nonDryIds()).toEqual([8103]);

    // Registry: the purged identities are gone entirely; the survivor stays.
    expect(getRecordedAquarelleStroke(8101)).toBeUndefined();
    expect(getRecordedAquarelleStroke(8102)).toBeUndefined();
    expect(getRecordedAquarelleStroke(8103)).toBeDefined();
    expect(getRecordedAquarelleStrokeEntries().has(8101)).toBe(false);

    // The record clock survives a purge: later strokes keep their tick cursor.
    expect(aquarelleRecordClock()).toBe(clockBefore);
    // Exactly one revision bump for the whole purge.
    expect(aquarelleStrokesRevision.value).toBe(revisionBefore + 1);
  });

  it('keeps Dry events at their relative place when earlier strokes leave', () => {
    recordAquarelleStroke(8201, stroke(8201, 30));
    emitAquarelleDry(7);
    recordAquarelleStroke(8202, stroke(8202, 30));
    emitAquarelleDry(9);

    expect(purgeAquarelleFrameScript(30)).toBe(2);

    const timeline = getRecordedAquarellePayloadTimeline();
    expect(timeline).toHaveLength(2);
    expect(timeline.every((event) => 'kind' in event && event.kind === 'dry')).toBe(true);
    expect((timeline[0] as { tick: number }).tick).toBe(7);
    expect((timeline[1] as { tick: number }).tick).toBe(9);
  });

  it('drops the deletion marker and the per-frame serial counter', () => {
    recordAquarelleStroke(8301, stroke(8301, 40));
    expect(aquarelleStrokeSerial(8301, 40)).toBe(1);
    markAquarelleStrokeDeleted(8301);

    expect(purgeAquarelleFrameScript(40)).toBe(1);
    expect(isAquarelleStrokeDeleted(8301)).toBe(false);

    // The frame's counter restarted: the next stroke on this key is serial 1.
    recordAquarelleStroke(8302, stroke(8302, 40));
    expect(aquarelleStrokeSerial(8302, 40)).toBe(1);
  });

  it('leaves other frames serial counters alone', () => {
    recordAquarelleStroke(8401, stroke(8401, 50));
    recordAquarelleStroke(8402, stroke(8402, 60));
    recordAquarelleStroke(8403, stroke(8403, 60));
    expect(aquarelleStrokeSerial(8403, 60)).toBe(2);

    expect(purgeAquarelleFrameScript(50)).toBe(1);

    recordAquarelleStroke(8404, stroke(8404, 60));
    expect(aquarelleStrokeSerial(8404, 60)).toBe(3);
  });

  it('is a no-op returning 0 and never bumps for a frame with no events', () => {
    recordAquarelleStroke(8501, stroke(8501, 70));
    const revisionBefore = aquarelleStrokesRevision.value;
    const timelineBefore = [...getRecordedAquarellePayloadTimeline()];

    expect(purgeAquarelleFrameScript(999)).toBe(0);

    expect(aquarelleStrokesRevision.value).toBe(revisionBefore);
    expect(getRecordedAquarellePayloadTimeline()).toEqual(timelineBefore);
    expect(getRecordedAquarelleStroke(8501)).toBeDefined();
  });
});

describe('quick-261025-awl hasAquarelleScriptForFrame', () => {
  it('is true only for a recorded, non-deleted stroke on that frame', () => {
    recordAquarelleStroke(9301, stroke(9301, 100));
    expect(hasAquarelleScriptForFrame(100)).toBe(true);
    expect(hasAquarelleScriptForFrame(101)).toBe(false);
  });

  it('ignores Dry events (a sheet action owns no frame)', () => {
    emitAquarelleDry(4242);
    expect(hasAquarelleScriptForFrame(100)).toBe(false);
  });

  it('ignores a deleted-stroke tombstone', () => {
    recordAquarelleStroke(9302, stroke(9302, 100));
    markAquarelleStrokeDeleted(9302);
    expect(hasAquarelleScriptForFrame(100)).toBe(false);
  });

  it('ignores other frames', () => {
    recordAquarelleStroke(9303, stroke(9303, 100));
    expect(hasAquarelleScriptForFrame(200)).toBe(false);
  });

  it('is false after purgeAquarelleFrameScript and never bumps the revision', () => {
    recordAquarelleStroke(9304, stroke(9304, 100));
    const revisionBefore = aquarelleStrokesRevision.value;

    expect(hasAquarelleScriptForFrame(100)).toBe(true);
    expect(aquarelleStrokesRevision.value).toBe(revisionBefore);

    expect(purgeAquarelleFrameScript(100)).toBe(1);
    expect(hasAquarelleScriptForFrame(100)).toBe(false);
  });

  it('records only the new strokes after a Raster conversion (old strokes never return)', () => {
    recordAquarelleStroke(9401, stroke(9401, 100));
    recordAquarelleStroke(9402, stroke(9402, 100));
    emitAquarelleDry(31);

    expect(purgeAquarelleFrameScript(100)).toBe(2);

    recordAquarelleStroke(9403, stroke(9403, 100));

    expect(nonDryIds()).toEqual([9403]);
    expect(hasAquarelleScriptForFrame(100)).toBe(true);
    expect(getRecordedAquarelleStroke(9401)).toBeUndefined();
    expect(getRecordedAquarelleStroke(9402)).toBeUndefined();
    expect(getRecordedAquarelleStroke(9403)).toBeDefined();
  });
});

describe('261028-k03f hasAquarellePaintScriptForFrame', () => {
  it('is true only for a paint-bearing stroke on that frame', () => {
    recordAquarelleStroke(9501, stroke(9501, 100));
    expect(hasAquarellePaintScriptForFrame(100)).toBe(true);
    expect(hasAquarellePaintScriptForFrame(101)).toBe(false);
  });

  it('is false for a lift-only timeline — a lift carries no source paint', () => {
    recordAquarelleStroke(9502, { ...stroke(9502, 100), tool: 'lift' });
    expect(hasAquarelleScriptForFrame(100)).toBe(true);
    expect(hasAquarellePaintScriptForFrame(100)).toBe(false);
  });

  it('is true when a paint stroke exists beside lifts', () => {
    recordAquarelleStroke(9503, { ...stroke(9503, 100), tool: 'lift' });
    recordAquarelleStroke(9504, stroke(9504, 100));
    expect(hasAquarellePaintScriptForFrame(100)).toBe(true);
  });

  it('ignores deleted paint strokes and Dry events', () => {
    recordAquarelleStroke(9505, stroke(9505, 100));
    markAquarelleStrokeDeleted(9505);
    emitAquarelleDry(77);
    expect(hasAquarellePaintScriptForFrame(100)).toBe(false);
  });
});

describe('quick-261023-ors purgeAllAquarelleKeyScripts', () => {
  it('removes every stroke identity, keeps Dry, and returns the identity count', () => {
    recordAquarelleStroke(9101, stroke(9101, 10));
    recordAquarelleStroke(9102, stroke(9102, 20));
    recordAquarelleStroke(9103, stroke(9103, 30));
    // A deleted stroke keeps a registry tombstone but leaves the timeline.
    expect(deleteAquarelleStrokeFromScript(9103)).toBe(true);
    emitAquarelleDry(11);
    emitAquarelleDry(12);

    const revisionBefore = aquarelleStrokesRevision.value;
    const clockBefore = aquarelleRecordClock();

    expect(purgeAllAquarelleKeyScripts()).toBe(3);

    const timeline = getRecordedAquarellePayloadTimeline();
    expect(timeline).toHaveLength(2);
    expect(timeline.every((event) => 'kind' in event && event.kind === 'dry')).toBe(true);
    expect(getRecordedAquarelleStrokeEntries().size).toBe(0);
    expect(getRecordedAquarelleStroke(9101)).toBeUndefined();
    expect(getRecordedAquarelleStroke(9102)).toBeUndefined();
    expect(getRecordedAquarelleStroke(9103)).toBeUndefined();
    expect(isAquarelleStrokeDeleted(9103)).toBe(false);
    expect(aquarelleRecordClock()).toBe(clockBefore);
    expect(aquarelleStrokesRevision.value).toBe(revisionBefore + 1);
  });

  it('clears every per-frame serial counter', () => {
    recordAquarelleStroke(9201, stroke(9201, 80));
    recordAquarelleStroke(9202, stroke(9202, 80));
    recordAquarelleStroke(9203, stroke(9203, 90));

    expect(purgeAllAquarelleKeyScripts()).toBe(3);

    recordAquarelleStroke(9204, stroke(9204, 80));
    recordAquarelleStroke(9205, stroke(9205, 90));
    expect(aquarelleStrokeSerial(9204, 80)).toBe(1);
    expect(aquarelleStrokeSerial(9205, 90)).toBe(1);
  });

  it('is a no-op returning 0 when only Dry events remain', () => {
    emitAquarelleDry(5);
    const revisionBefore = aquarelleStrokesRevision.value;

    expect(purgeAllAquarelleKeyScripts()).toBe(0);

    expect(aquarelleStrokesRevision.value).toBe(revisionBefore);
    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(1);
  });
});
