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
import { hashMutationId, mixStrokeSeed } from '@efxlab/efx-paint-host';
import type {
  AquarelleDryEvent,
  AquarelleStroke,
  AquarelleStrokePayload,
} from '@efxlab/efx-watercolor/payload';
import { PAINT_SEED_SALT_PARAM } from '@efxlab/efx-watercolor/payload';
import type { AquarelleTip } from '@efxlab/efx-watercolor/brushes';
import { NEUTRAL_TOOL_OVERRIDES } from '@efxlab/efx-watercolor/brushes';
import type { StudioPoint, StudioStroke } from '@efxlab/efx-paint-host/animation';
import {
  aquarelleRecordClock,
  aquarelleStrokesRevision,
  buildAquarelleStrokePayload,
  getAquarelleEventsForFrame,
  getAquarelleStrokeKeyAnchors,
  getRecordedAquarelleDryEvents,
  getRecordedAquarellePayload,
  getRecordedAquarellePayloadTimeline,
  getRecordedAquarelleStroke,
  purgeAllAquarelleKeyScripts,
  purgeAquarelleFrameScript,
  recordAquarelleStroke,
  remapAquarelleScriptsForRecords,
  resetAquarelleRecordState,
  restoreAquarelleRecordTimeline,
  selectAquarelleTip,
  snapshotAquarelleRecord,
  translateAquarelleStrokeInScript,
} from './aquarelleRecordState';
import {
  replaceLibraryEntries,
  resetAquarelleBrushCatalog,
} from '../../../stores/aquarelleBrushCatalog';

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

// ============================================================
//  quick-261115-oh9 — the texture carrier survives restore.
//
//  A restored stroke rebuilds its payload explicitly, so the texture
//  must be copied conditionally: present stays present, absent stays
//  absent (the payload codec's default is the response's own tip).
// ============================================================
describe('quick-261115-oh9 restored textureId carrier', () => {
  function texturedFixture(
    playFrame: number,
    mutationId: number,
    textureId: string,
  ): StudioStroke<AquarelleStrokePayload> {
    const base = fixtureStroke(playFrame, mutationId);
    return { ...base, engine: { ...base.engine, textureId } };
  }

  it('preserves a recorded engine.textureId through restore and getRecordedAquarellePayload', () => {
    restoreAquarelleRecordTimeline([texturedFixture(7, 42, 'wc/custom-restored')]);
    const entry = getRecordedAquarellePayloadTimeline()[0] as StudioStroke<AquarelleStrokePayload>;
    expect(entry.engine.textureId).toBe('wc/custom-restored');
    expect(getRecordedAquarelleStroke(42)!.textureId).toBe('wc/custom-restored');
    expect(getRecordedAquarellePayload(42)!.textureId).toBe('wc/custom-restored');
  });

  it('keeps an untextured restore free of the key', () => {
    restoreAquarelleRecordTimeline([fixtureStroke(7, 43)]);
    expect('textureId' in getRecordedAquarelleStroke(43)!).toBe(false);
    expect('textureId' in getRecordedAquarellePayload(43)!).toBe(false);
  });
});

// ============================================================
//  quick 261116-inu / Task 9 — the rotation carrier survives restore.
//
//  The unit is integer DEGREES in memory and on every JSON carrier.
//  A recorded 37 must reopen as 37 — never 3700 (the AQTL body's
//  hundredths, which exists only inside those two wire bytes) and
//  never 0.37. Absent stays absent.
// ============================================================
describe('quick 261116-inu textureRotation carrier (degrees)', () => {
  function rotatedFixture(
    playFrame: number,
    mutationId: number,
    textureId: string,
    textureRotation: number,
  ): StudioStroke<AquarelleStrokePayload> {
    const base = fixtureStroke(playFrame, mutationId);
    return { ...base, engine: { ...base.engine, textureId, textureRotation } };
  }

  it('preserves integer DEGREES through restore and getRecordedAquarellePayload', () => {
    restoreAquarelleRecordTimeline([rotatedFixture(7, 42, 'wc/custom-rotated', 37)]);
    const entry = getRecordedAquarellePayloadTimeline()[0] as StudioStroke<AquarelleStrokePayload>;
    expect(entry.engine.textureId).toBe('wc/custom-rotated');
    expect(entry.engine.textureRotation).toBe(37);
    expect(getRecordedAquarelleStroke(42)!.textureRotation).toBe(37);
    expect(getRecordedAquarellePayload(42)!.textureRotation).toBe(37);
  });

  it('keeps an untextured or rotationless restore free of the key', () => {
    restoreAquarelleRecordTimeline([fixtureStroke(7, 43)]);
    expect('textureRotation' in getRecordedAquarelleStroke(43)!).toBe(false);
    expect('textureRotation' in getRecordedAquarellePayload(43)!).toBe(false);

    restoreAquarelleRecordTimeline([
      { ...fixtureStroke(7, 44), engine: { ...fixtureStroke(7, 44).engine, textureId: 'wc/custom-flat' } },
    ]);
    expect(getRecordedAquarelleStroke(44)!.textureRotation).toBeUndefined();
    expect('textureRotation' in getRecordedAquarellePayload(44)!).toBe(false);
  });

  it('snapshots the selected library row rotation in DEGREES for the NEXT stroke', () => {
    const tip: AquarelleTip = {
      id: 'wc/custom-snapshot-rotation',
      category: 'custom',
      name: 'Rotated texture',
      ...NEUTRAL_TOOL_OVERRIDES,
    };
    replaceLibraryEntries([{ tip, digest: 'a'.repeat(64), textureRotation: 37 }]);
    try {
      selectAquarelleTip(tip.id);

      const snap = snapshotAquarelleRecord();
      expect(snap.textureId).toBe(tip.id);
      expect(snap.textureRotation).toBe(37);

      const payload = buildAquarelleStrokePayload();
      expect(payload.textureId).toBe(tip.id);
      expect(payload.textureRotation).toBe(37);
    } finally {
      resetAquarelleBrushCatalog();
    }
  });

  it('records no rotation key for the Default chip or a procedural tip', () => {
    replaceLibraryEntries([]);
    selectAquarelleTip(null);

    const snap = snapshotAquarelleRecord();
    expect(snap.textureRotation).toBeUndefined();
    expect('textureRotation' in buildAquarelleStrokePayload()).toBe(false);
  });
});

// ============================================================
//  quick-261024-m20 — a restored session follows the same
//  key-identity remap law as a live one: strokes, their projected
//  entries and their playFrame anchors move together, the
//  registry/timeline lockstep survives, and Dry events stay put.
// ============================================================
describe('261024-m20 restored-session key-identity remap', () => {
  it('remaps restored strokes onto their new frames with the Dry untouched', () => {
    restoreAquarelleRecordTimeline([fixtureStroke(10, 201), fixtureDry(4), fixtureStroke(14, 202)]);
    const dry = getRecordedAquarelleDryEvents()[0]!;
    const revision = aquarelleStrokesRevision.value;

    const result = remapAquarelleScriptsForRecords(
      [
        { keyId: 'a', appFrame: 10 },
        { keyId: 'b', appFrame: 14 },
      ],
      [
        { keyId: 'a', appFrame: 4 },
        { keyId: 'b', appFrame: 6 },
      ],
    );

    expect(result).toEqual({ moved: 2, dropped: 0 });
    expect(getRecordedAquarelleStroke(201)!.playFrame).toBe(4);
    expect(getRecordedAquarelleStroke(202)!.playFrame).toBe(6);
    expect(getAquarelleEventsForFrame(4).some(
      (event) => !('kind' in event)
        && (event.engine as AquarelleStrokePayload).mutationId === 201,
    )).toBe(true);
    expect(getAquarelleEventsForFrame(6).some(
      (event) => !('kind' in event)
        && (event.engine as AquarelleStrokePayload).mutationId === 202,
    )).toBe(true);
    expect(getRecordedAquarelleDryEvents()[0]).toBe(dry);
    expect(getAquarelleEventsForFrame(4)).toContain(dry);
    expect(aquarelleStrokesRevision.value).toBe(revision + 1);
    // Lockstep: translate finds the timeline entry by indexOf after the remap.
    expect(translateAquarelleStrokeInScript(201, 0.01, 0.01)).toBe(true);
  });

  it('drops a restored stroke whose key disappeared while the Dry survives', () => {
    restoreAquarelleRecordTimeline([fixtureStroke(10, 301), fixtureDry(4)]);
    const dry = getRecordedAquarelleDryEvents()[0]!;

    const result = remapAquarelleScriptsForRecords(
      [
        { keyId: 'a', appFrame: 0 },
        { keyId: 'b', appFrame: 10 },
      ],
      [{ keyId: 'a', appFrame: 0 }],
    );

    expect(result).toEqual({ moved: 0, dropped: 1 });
    expect(getRecordedAquarelleStroke(301)).toBeUndefined();
    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(1);
    expect(getRecordedAquarelleDryEvents()[0]).toBe(dry);
    expect(getAquarelleEventsForFrame(10)).toEqual([dry]);
  });
});

// ============================================================
//  261027 UAT round 2 — every recorded watercolor stroke carries
//  the physical KEY it was captured on. The anchor is what lets a
//  restore refuse to re-seed a deleted key's strokes into a new
//  key at the same frame number.
// ============================================================
function recordableStroke(
  mutationId: number,
  playFrame: number,
): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#000000',
    params: { size: 10 },
    brushId: 'round',
    points: [{ x: 0.1, y: 0.2, p: 0.5, tx: 0, ty: 0, tw: 0 }],
    mutationId,
    timestamp: 1,
    playFrame,
  };
}

describe('261027 watercolor key anchors', () => {
  it('stamps the owning key on record and drops it on a frame purge', () => {
    recordAquarelleStroke(501, recordableStroke(501, 10), 'key-a');
    expect(getAquarelleStrokeKeyAnchors().get(501)).toBe('key-a');

    expect(purgeAquarelleFrameScript(10)).toBe(1);
    expect(getAquarelleStrokeKeyAnchors().has(501)).toBe(false);
  });

  it('seeds anchors on restore and keeps them across a key move', () => {
    restoreAquarelleRecordTimeline(
      [fixtureStroke(10, 201)],
      new Map([[201, 'key-a']]),
    );
    expect(getAquarelleStrokeKeyAnchors().get(201)).toBe('key-a');

    expect(remapAquarelleScriptsForRecords(
      [{ keyId: 'key-a', appFrame: 10 }],
      [{ keyId: 'key-a', appFrame: 4 }],
    )).toEqual({ moved: 1, dropped: 0 });
    expect(getRecordedAquarelleStroke(201)!.playFrame).toBe(4);
    // The same physical key kept the stroke: identity survives the move.
    expect(getAquarelleStrokeKeyAnchors().get(201)).toBe('key-a');
  });

  it('drops the anchor when the remap drops its key, and on clear-all', () => {
    restoreAquarelleRecordTimeline(
      [fixtureStroke(10, 301), fixtureStroke(12, 302)],
      new Map([[301, 'key-a'], [302, 'key-b']]),
    );

    expect(remapAquarelleScriptsForRecords(
      [
        { keyId: 'key-a', appFrame: 10 },
        { keyId: 'key-b', appFrame: 12 },
      ],
      [{ keyId: 'key-a', appFrame: 10 }],
    )).toEqual({ moved: 0, dropped: 1 });
    expect(getAquarelleStrokeKeyAnchors().get(301)).toBe('key-a');
    expect(getAquarelleStrokeKeyAnchors().has(302)).toBe(false);

    expect(purgeAllAquarelleKeyScripts()).toBe(1);
    expect(getAquarelleStrokeKeyAnchors().size).toBe(0);
  });

  it('clears anchors on reset and on a wholesale restore', () => {
    restoreAquarelleRecordTimeline(
      [fixtureStroke(10, 401)],
      new Map([[401, 'key-a']]),
    );
    restoreAquarelleRecordTimeline([fixtureStroke(10, 402)]);
    expect(getAquarelleStrokeKeyAnchors().size).toBe(0);

    restoreAquarelleRecordTimeline(
      [fixtureStroke(10, 403)],
      new Map([[403, 'key-c']]),
    );
    expect(getAquarelleStrokeKeyAnchors().get(403)).toBe('key-c');
    resetAquarelleRecordState();
    expect(getAquarelleStrokeKeyAnchors().size).toBe(0);
  });

  it('never stamps an anchor for a stroke recorded without a key id', () => {
    recordAquarelleStroke(601, recordableStroke(601, 10));
    expect(getAquarelleStrokeKeyAnchors().has(601)).toBe(false);
  });
});

// ============================================================
//  261031-cf9 — the persisted paint seed salt rides inside
//  `engine.params`, so the restore path rebuilds the same
//  traceSeed through the ONE projection with no format change.
// ============================================================
function saltedFixtureStroke(
  playFrame: number,
  mutationId: number,
  salt: number,
): StudioStroke<AquarelleStrokePayload> {
  const base = fixtureStroke(playFrame, mutationId);
  return {
    ...base,
    engine: {
      ...base.engine,
      params: { size: 10, [PAINT_SEED_SALT_PARAM]: salt },
    },
  };
}

describe('261031-cf9 restored paint seed salt', () => {
  it('rebuilds the salted traceSeed from engine.params on restore', () => {
    restoreAquarelleRecordTimeline([saltedFixtureStroke(7, 42, 3)]);
    const entry = getRecordedAquarellePayloadTimeline()[0] as StudioStroke<AquarelleStrokePayload>;
    expect(entry.engine.params[PAINT_SEED_SALT_PARAM]).toBe(3);
    expect(entry.traceSeed).toBe(mixStrokeSeed(hashMutationId(42), 3));
    expect(getRecordedAquarelleStroke(42)!.params[PAINT_SEED_SALT_PARAM]).toBe(3);
  });

  it('keeps an unsalted restore byte-identical to hashMutationId', () => {
    restoreAquarelleRecordTimeline([fixtureStroke(7, 42)]);
    const entry = getRecordedAquarellePayloadTimeline()[0] as StudioStroke<AquarelleStrokePayload>;
    expect(entry.engine.params[PAINT_SEED_SALT_PARAM]).toBeUndefined();
    expect(entry.traceSeed).toBe(hashMutationId(42));
  });
});
