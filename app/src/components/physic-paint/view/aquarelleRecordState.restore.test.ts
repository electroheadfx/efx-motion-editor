// ============================================================
//  aquarelleRecordState.restore.test.ts — quick-261023-l35.
//
//  A restored snapshot is a SESSION SEED: the whole record state is
//  replaced wholesale, the projected timeline entry is the SAME object
//  the registry holds (the translate/stack-step indexOf invariant),
//  and the record clock resumes past every restored tick so the next
//  Dry lands after the restored script.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest';
import type { AquarelleDryEvent, AquarelleStrokePayload } from '@efxlab/efx-watercolor/payload';
import type { StudioPoint, StudioStroke } from '@efxlab/efx-paint-host/animation';
import {
  aquarelleRecordClock,
  getAquarelleEventsForFrame,
  getRecordedAquarelleDryEvents,
  getRecordedAquarellePayloadTimeline,
  getRecordedAquarelleStroke,
  resetAquarelleRecordState,
  restoreAquarelleRecordTimeline,
} from './aquarelleRecordState';

function fixturePoint(index: number): StudioPoint {
  return { x: 0.1 + index * 0.1, y: 0.2 + index * 0.1, p: 0.5, tx: 0, ty: 0, tw: 0, tick: index };
}

function fixtureStroke(
  playFrame: number,
  mutationId: number,
  pointCount = 3,
): StudioStroke<AquarelleStrokePayload> {
  const pts = Array.from({ length: pointCount }, (_, index) => fixturePoint(index));
  return {
    pts,
    ticks: Math.max(1, pointCount - 1),
    cuisson: 2,
    motion: null,
    brushId: 'round',
    toolOverrides: {},
    traceSeed: 7,
    recordedOrder: 1,
    playFrame,
    color: '#000000',
    engine: {
      tool: 'brush',
      color: '#000000',
      params: { size: 10 },
      brushId: 'round',
      mutationId,
      diffusionFrames: 2,
      timestamp: 1,
      playFrame,
    },
  };
}

function fixtureDry(tick: number): AquarelleDryEvent {
  return { kind: 'dry', tick, recordedOrder: 2 };
}

beforeEach(() => {
  resetAquarelleRecordState();
});

describe('restoreAquarelleRecordTimeline', () => {
  it('replaces the timeline wholesale and returns the highest mutation id', () => {
    restoreAquarelleRecordTimeline([fixtureStroke(7, 101), fixtureStroke(9, 102), fixtureDry(4)]);
    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(3);

    expect(restoreAquarelleRecordTimeline([fixtureStroke(11, 7)])).toBe(7);
    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(1);
    expect(getRecordedAquarelleStroke(101)).toBeUndefined();
    expect(getRecordedAquarelleStroke(102)).toBeUndefined();
    expect(getRecordedAquarelleStroke(7)).toBeDefined();
    expect(getRecordedAquarelleDryEvents()).toHaveLength(0);
  });

  it('returns 0 for an empty restore', () => {
    restoreAquarelleRecordTimeline([fixtureStroke(7, 101)]);
    expect(restoreAquarelleRecordTimeline([])).toBe(0);
    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(0);
  });

  it('advances the record clock past the highest restored tick', () => {
    restoreAquarelleRecordTimeline([fixtureStroke(7, 101, 4), fixtureDry(9)]);
    expect(aquarelleRecordClock()).toBe(9);
    // A stroke-only restore resumes at its own tick span (max(1, pts - 1)).
    restoreAquarelleRecordTimeline([fixtureStroke(7, 101, 4)]);
    expect(aquarelleRecordClock()).toBe(3);
  });

  it('keeps the projected entry queryable as the frame replay source', () => {
    restoreAquarelleRecordTimeline([fixtureStroke(7, 101), fixtureStroke(9, 102), fixtureDry(3)]);
    const frameEvents = getAquarelleEventsForFrame(7);
    expect(frameEvents).toHaveLength(2);
    expect((frameEvents[0] as StudioStroke<AquarelleStrokePayload>).playFrame).toBe(7);
    expect((frameEvents[1] as AquarelleDryEvent).kind).toBe('dry');
  });

  it('resetAquarelleRecordState clears content and restarts the clock', () => {
    restoreAquarelleRecordTimeline([fixtureStroke(7, 101), fixtureDry(12)]);
    resetAquarelleRecordState();
    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(0);
    expect(getRecordedAquarelleStroke(101)).toBeUndefined();
    expect(aquarelleRecordClock()).toBe(0);
  });
});
