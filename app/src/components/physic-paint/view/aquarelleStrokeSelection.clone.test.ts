// ============================================================
//  quick 261116-u63 — the Duplicate (clone) edit for recorded
//  watercolor strokes.
//
//  The clone is a full recorded stroke: fresh mutation id,
//  fresh ordering key, fresh per-frame serial, the source's key
//  anchor, placed directly ABOVE its source, and ONE undoable
//  edit. No DOM, no Preact components.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest';
import {
  NEUTRAL_TOOL_OVERRIDES,
  type AquarelleToolOverrides,
} from '@efxlab/efx-watercolor/brushes';
import {
  isAquarelleDryEvent,
  toStudioStroke,
  type AquarelleAnchor,
  type AquarelleCurveMode,
  type AquarellePoint,
  type AquarelleStroke,
  type AquarelleStrokePayload,
} from '@efxlab/efx-watercolor/payload';
import {
  aquarelleStrokeSerial,
  aquarelleStrokesRevision,
  getAquarelleEventsForFrame,
  getAquarelleStrokeKeyAnchors,
  getRecordedAquarellePayloadTimeline,
  getRecordedAquarelleStroke,
  markAquarelleStrokeDeleted,
  recordAquarelleStroke,
  resetAquarelleRecordState,
  restoreAquarelleRecordTimeline,
} from './aquarelleRecordState';
import { scriptSelectedStrokeIds, setScriptStrokeSelection } from './scriptStrokeEdition';
import {
  beginAquarelleCloneEdit,
  cloneAquarelleStrokeForDuplicate,
  restoreAquarelleEditSnapshot,
  setAquarelleScriptEditInFlight,
} from './aquarelleStrokeSelection';

beforeEach(() => {
  resetAquarelleRecordState();
  setAquarelleScriptEditInFlight(false);
  setScriptStrokeSelection([]);
});

function point(x: number, y: number): AquarellePoint {
  return { x, y, p: 1, tx: 0, ty: 0, tw: 0 };
}

function anchor(x: number, y: number, extra: Partial<AquarelleAnchor> = {}): AquarelleAnchor {
  return {
    x,
    y,
    kind: 'bezier',
    in: { x: x - 0.01, y },
    out: { x: x + 0.01, y },
    ...extra,
  };
}

function stroke(options: {
  points: readonly AquarellePoint[];
  playFrame?: number;
  timestamp?: number;
  color?: string | null;
  brushId?: string;
  params?: Record<string, number>;
  pointTicks?: readonly number[];
  toolOverrides?: AquarelleToolOverrides;
  textureId?: string;
  textureRotation?: number;
  diffusionFrames?: number;
  anchors?: readonly AquarelleAnchor[];
  curveMode?: AquarelleCurveMode;
  vectorDrawn?: true;
  relief?: 'erode' | 'deposit';
}): AquarelleStroke {
  return {
    tool: 'brush',
    color: options.color === undefined ? '#103c65' : options.color,
    params: options.params ?? { size: 12 },
    brushId: options.brushId ?? 'round',
    points: options.points,
    timestamp: options.timestamp ?? 0,
    ...(options.playFrame === undefined ? {} : { playFrame: options.playFrame }),
    ...(options.pointTicks === undefined ? {} : { pointTicks: options.pointTicks }),
    ...(options.toolOverrides === undefined ? {} : { toolOverrides: options.toolOverrides }),
    ...(options.textureId === undefined ? {} : { textureId: options.textureId }),
    ...(options.textureRotation === undefined
      ? {}
      : { textureRotation: options.textureRotation }),
    ...(options.diffusionFrames === undefined
      ? {}
      : { diffusionFrames: options.diffusionFrames }),
    ...(options.anchors === undefined ? {} : { anchors: options.anchors }),
    ...(options.curveMode === undefined ? {} : { curveMode: options.curveMode }),
    ...(options.vectorDrawn === undefined ? {} : { vectorDrawn: options.vectorDrawn }),
    ...(options.relief === undefined ? {} : { relief: options.relief }),
  };
}

/** The frame's non-Dry stroke ids in payload (bottom -> top) order. */
function frameIds(frame: number): number[] {
  const ids: number[] = [];
  for (const event of getAquarelleEventsForFrame(frame)) {
    if (isAquarelleDryEvent(event)) continue;
    const mutationId = (event.engine as AquarelleStrokePayload).mutationId;
    if (mutationId !== undefined) ids.push(mutationId);
  }
  return ids;
}

/** The recorded ordering key (`recordedOrder`) of one stroke. */
function recordedOrderOf(mutationId: number): number {
  for (const event of getRecordedAquarellePayloadTimeline()) {
    if (isAquarelleDryEvent(event)) continue;
    if ((event.engine as AquarelleStrokePayload).mutationId === mutationId) {
      return event.recordedOrder;
    }
  }
  return Number.NaN;
}

/** A deterministic sequential id allocator. */
function allocator(first = 9200): () => number {
  let next = first;
  return () => {
    const id = next;
    next += 1;
    return id;
  };
}

describe('cloneAquarelleStrokeForDuplicate', () => {
  it('copies every recordable field into fresh objects and arrays', () => {
    const source = stroke({
      points: [point(0.1, 0.2), point(0.3, 0.4)],
      pointTicks: [0, 3],
      playFrame: 9101,
      timestamp: 100,
      color: '#224466',
      brushId: 'wc/round-medium',
      params: { size: 12, water: 60, dry: 30 },
      toolOverrides: { ...NEUTRAL_TOOL_OVERRIDES, aspect: 2 },
      textureId: 'wc/texture-a',
      textureRotation: 45,
      diffusionFrames: 7,
      anchors: [anchor(0.1, 0.2, { width: 1.8, color: '#112233' }), anchor(0.3, 0.4)],
      curveMode: 'spline',
      vectorDrawn: true,
      relief: 'deposit',
    });

    const clone = cloneAquarelleStrokeForDuplicate(source, 1234);

    expect(clone).not.toBe(source);
    expect(clone.tool).toBe(source.tool);
    expect(clone.color).toBe(source.color);
    expect(clone.brushId).toBe(source.brushId);
    expect(clone.timestamp).toBe(1234);
    expect(clone.mutationId).toBeUndefined();
    expect(clone.playFrame).toBe(9101);
    expect(clone.diffusionFrames).toBe(7);
    expect(clone.textureId).toBe('wc/texture-a');
    expect(clone.textureRotation).toBe(45);
    expect(clone.curveMode).toBe('spline');
    expect(clone.vectorDrawn).toBe(true);
    expect(clone.relief).toBe('deposit');
    expect(clone.pointTicks).toEqual([0, 3]);
    expect(clone.toolOverrides).toEqual(source.toolOverrides);
    expect(clone.anchors).toEqual(source.anchors);
    expect(clone.points).toEqual(source.points);

    // Every mutable carrier is a NEW allocation, handles included.
    expect(clone.params).not.toBe(source.params);
    expect(clone.points).not.toBe(source.points);
    expect(clone.points[0]).not.toBe(source.points[0]);
    expect(clone.pointTicks).not.toBe(source.pointTicks);
    expect(clone.toolOverrides).not.toBe(source.toolOverrides);
    expect(clone.anchors).not.toBe(source.anchors);
    expect(clone.anchors![0]).not.toBe(source.anchors![0]);
    expect(clone.anchors![0]!.in).not.toBe(source.anchors![0]!.in);
    expect(clone.anchors![0]!.out).not.toBe(source.anchors![0]!.out);
  });

  it('never shares a mutable graph with the source', () => {
    const source = stroke({
      points: [point(0.1, 0.2)],
      pointTicks: [0],
      params: { size: 12, water: 60 },
      toolOverrides: { ...NEUTRAL_TOOL_OVERRIDES, aspect: 2 },
      anchors: [anchor(0.2, 0.3, { width: 1.5 }), anchor(0.5, 0.6)],
      playFrame: 9102,
    });
    const clone = cloneAquarelleStrokeForDuplicate(source, 42);

    (clone.params as Record<string, number>)['size'] = 99;
    (clone.points as AquarellePoint[])[0] = point(0.9, 0.9);
    (clone.pointTicks as number[])[0] = 9;
    ((clone.anchors as AquarelleAnchor[])[0] as unknown as { x: number }).x = 0.9;
    ((clone.anchors![0]!.in as unknown) as { x: number }).x = 0.9;
    (clone.toolOverrides as unknown as { aspect: number }).aspect = 8;

    expect(source.params['size']).toBe(12);
    expect(source.points[0]!.x).toBe(0.1);
    expect(source.pointTicks![0]).toBe(0);
    expect(source.anchors![0]!.x).toBe(0.2);
    expect(source.anchors![0]!.in!.x).toBeCloseTo(0.19, 12);
    expect(source.toolOverrides!.aspect).toBe(2);
  });

  it('keeps every absent optional key absent and mints no mutation id', () => {
    const source = stroke({ points: [point(0.5, 0.5)] });
    const clone = cloneAquarelleStrokeForDuplicate(source, 7);

    expect('mutationId' in clone).toBe(false);
    expect('playFrame' in clone).toBe(false);
    expect('pointTicks' in clone).toBe(false);
    expect('toolOverrides' in clone).toBe(false);
    expect('textureId' in clone).toBe(false);
    expect('textureRotation' in clone).toBe(false);
    expect('diffusionFrames' in clone).toBe(false);
    expect('anchors' in clone).toBe(false);
    expect('curveMode' in clone).toBe(false);
    expect('vectorDrawn' in clone).toBe(false);
    expect('relief' in clone).toBe(false);
  });
});

// ============================================================
//  quick 261123-kpy — the modifier polarity survives Duplicate
//  and every full-rebuild seam between the two.
//
//  Studio Duplicate rebuilds the clone field-by-field. Without the
//  latched polarity the duplicate becomes a NORMAL paint stroke
//  that repaints ink where the source cleared it.
// ============================================================
describe('quick 261123-kpy cloned modifier relief', () => {
  it('keeps the erode polarity on the clone', () => {
    const source = stroke({ points: [point(0.1, 0.2)], relief: 'erode' });
    const clone = cloneAquarelleStrokeForDuplicate(source, 7);
    expect(clone.relief).toBe('erode');
  });

  it('keeps the deposit polarity on the clone', () => {
    const source = stroke({ points: [point(0.1, 0.2)], relief: 'deposit' });
    const clone = cloneAquarelleStrokeForDuplicate(source, 7);
    expect(clone.relief).toBe('deposit');
  });

  it('keeps a markerless source free of the relief key', () => {
    const source = stroke({ points: [point(0.1, 0.2)] });
    const clone = cloneAquarelleStrokeForDuplicate(source, 7);
    expect('relief' in clone).toBe(false);
    expect(Object.keys(clone)).not.toContain('relief');
  });

  it('replays record -> restore -> duplicate -> project with the polarity intact', () => {
    for (const [index, relief] of (['erode', 'deposit'] as const).entries()) {
      const mutationId = 13001 + index;
      recordAquarelleStroke(
        mutationId,
        stroke({ points: [point(0.1, 0.2), point(0.3, 0.4)], playFrame: 9120, relief }),
      );
      // The reopen seam consumes the recorded payload events, as a project
      // load does. Copy: restore clears the same timeline array it reads.
      restoreAquarelleRecordTimeline([...getRecordedAquarellePayloadTimeline()]);
      const restored = getRecordedAquarelleStroke(mutationId)!;
      expect(restored.relief, `restored ${relief}`).toBe(relief);

      // Studio Duplicate then projects the clone back onto the payload.
      const clone = cloneAquarelleStrokeForDuplicate(restored, mutationId + 100);
      expect(toStudioStroke(clone).engine.relief, `cloned ${relief}`).toBe(relief);
    }
  });
});

describe('beginAquarelleCloneEdit', () => {
  it('places a single clone directly above a middle source', () => {
    recordAquarelleStroke(9101, stroke({ points: [point(0.1, 0.1)], playFrame: 9102 }));
    recordAquarelleStroke(9102, stroke({ points: [point(0.2, 0.2)], playFrame: 9102 }));
    recordAquarelleStroke(9103, stroke({ points: [point(0.3, 0.3)], playFrame: 9102 }));
    const sourceSerial = aquarelleStrokeSerial(9102, 9102);

    const edit = beginAquarelleCloneEdit(9102, allocator(), { now: () => 5000 });

    expect(edit).not.toBeNull();
    expect(edit!.newIds).toHaveLength(1);
    expect(frameIds(9102)).toEqual([9101, 9102, edit!.newIds[0], 9103]);
    // The clone wears a fresh per-frame serial.
    expect(aquarelleStrokeSerial(edit!.newIds[0]!, 9102)).not.toBe(sourceSerial);
  });

  it('leaves a topmost clone on top through the shipped no-op placement', () => {
    recordAquarelleStroke(9111, stroke({ points: [point(0.1, 0.1)], playFrame: 9103 }));
    recordAquarelleStroke(9112, stroke({ points: [point(0.2, 0.2)], playFrame: 9103 }));
    recordAquarelleStroke(9113, stroke({ points: [point(0.3, 0.3)], playFrame: 9103 }));

    const edit = beginAquarelleCloneEdit(9113, allocator(9120), { now: () => 5000 });

    expect(edit).not.toBeNull();
    expect(frameIds(9103)).toEqual([9111, 9112, 9113, edit!.newIds[0]]);
  });

  it('clones a whole batch each directly above its own source', () => {
    recordAquarelleStroke(9201, stroke({ points: [point(0.1, 0.1)], playFrame: 9104 }));
    recordAquarelleStroke(9202, stroke({ points: [point(0.2, 0.2)], playFrame: 9104 }));
    recordAquarelleStroke(9203, stroke({ points: [point(0.3, 0.3)], playFrame: 9104 }));
    recordAquarelleStroke(9204, stroke({ points: [point(0.4, 0.4)], playFrame: 9104 }));

    const edit = beginAquarelleCloneEdit([9202, 9204], allocator(9300), { now: () => 5000 });

    expect(edit).not.toBeNull();
    // Caller order, one id per source.
    expect(edit!.newIds).toHaveLength(2);
    expect(frameIds(9104)).toEqual([
      9201,
      9202,
      edit!.newIds[0],
      9203,
      9204,
      edit!.newIds[1],
    ]);
  });

  it('inherits the source key anchor and falls back to the caller key id', () => {
    recordAquarelleStroke(9301, stroke({ points: [point(0.1, 0.1)], playFrame: 9105 }), 'key-a');
    const anchored = beginAquarelleCloneEdit(9301, allocator(9310), { keyId: 'fallback' });
    expect(anchored).not.toBeNull();
    expect(getAquarelleStrokeKeyAnchors().get(anchored!.newIds[0]!)).toBe('key-a');

    recordAquarelleStroke(9302, stroke({ points: [point(0.2, 0.2)], playFrame: 9105 }));
    const unanchored = beginAquarelleCloneEdit(9302, allocator(9320), { keyId: 'fallback' });
    expect(unanchored).not.toBeNull();
    expect(getAquarelleStrokeKeyAnchors().get(unanchored!.newIds[0]!)).toBe('fallback');

    recordAquarelleStroke(9303, stroke({ points: [point(0.3, 0.3)], playFrame: 9105 }));
    const bare = beginAquarelleCloneEdit(9303, allocator(9330));
    expect(bare).not.toBeNull();
    expect(getAquarelleStrokeKeyAnchors().has(bare!.newIds[0]!)).toBe(false);
  });

  it('stamps every clone above the recorded timeline, batches ascending', () => {
    recordAquarelleStroke(
      9501,
      stroke({ points: [point(0.1, 0.1)], playFrame: 9106, timestamp: 8000 }),
    );
    const stamps: number[] = [];
    const single = beginAquarelleCloneEdit(
      9501,
      (clone) => {
        stamps.push(clone.timestamp);
        return 9600;
      },
      { now: () => 10 },
    );
    expect(single).not.toBeNull();
    // The injected clock sits BELOW the recorded timeline: the clone takes
    // the highest recordedOrder + 1.
    expect(stamps).toEqual([8001]);
    // A topmost clone keeps its fresh ordering key (the placement no-ops).
    expect(recordedOrderOf(9600)).toBe(8001);

    recordAquarelleStroke(
      9502,
      stroke({ points: [point(0.2, 0.2)], playFrame: 9107, timestamp: 8000 }),
    );
    recordAquarelleStroke(
      9503,
      stroke({ points: [point(0.3, 0.3)], playFrame: 9107, timestamp: 8001 }),
    );
    const batchStamps: number[] = [];
    const batch = beginAquarelleCloneEdit(
      [9502, 9503],
      (clone) => {
        batchStamps.push(clone.timestamp);
        return 9610 + batchStamps.length;
      },
      { now: () => 10 },
    );
    expect(batch).not.toBeNull();
    expect(batchStamps).toEqual([8002, 8003]);
  });

  it('never changes the selection — the caller selects on success', () => {
    recordAquarelleStroke(9701, stroke({ points: [point(0.1, 0.1)], playFrame: 9108 }));
    recordAquarelleStroke(9702, stroke({ points: [point(0.2, 0.2)], playFrame: 9108 }));
    setScriptStrokeSelection([9701]);

    const edit = beginAquarelleCloneEdit(9702, allocator(9710));

    expect(edit).not.toBeNull();
    expect([...scriptSelectedStrokeIds.value]).toEqual([9701]);
    expect(edit!.newIds).not.toContain(9701);
  });

  it('allocates the whole batch before the first record (no partial edit)', () => {
    recordAquarelleStroke(9801, stroke({ points: [point(0.1, 0.1)], playFrame: 9109 }));
    recordAquarelleStroke(9802, stroke({ points: [point(0.2, 0.2)], playFrame: 9109 }));
    const timelineBefore = [...getRecordedAquarellePayloadTimeline()];
    const sourceBefore = getRecordedAquarelleStroke(9801);
    const revisionBefore = aquarelleStrokesRevision.value;
    let calls = 0;

    expect(() => beginAquarelleCloneEdit([9801, 9802], () => {
      calls += 1;
      if (calls === 2) throw new Error('allocator boom');
      return 9901;
    })).toThrow('allocator boom');

    expect(calls).toBe(2);
    expect(frameIds(9109)).toEqual([9801, 9802]);
    expect(getRecordedAquarellePayloadTimeline()).toEqual(timelineBefore);
    expect(getRecordedAquarelleStroke(9801)).toBe(sourceBefore);
    expect(aquarelleStrokesRevision.value).toBe(revisionBefore);
  });

  it('refuses in-flight, non-finite, unknown, deleted, empty and cross-frame inputs', () => {
    recordAquarelleStroke(10001, stroke({ points: [point(0.1, 0.1)], playFrame: 9110 }));
    recordAquarelleStroke(10002, stroke({ points: [point(0.2, 0.2)], playFrame: 9111 }));
    recordAquarelleStroke(10003, stroke({ points: [point(0.3, 0.3)], playFrame: 9110 }));
    recordAquarelleStroke(10004, stroke({ points: [], playFrame: 9110 }));

    setAquarelleScriptEditInFlight(true);
    try {
      expect(beginAquarelleCloneEdit(10003, allocator(10100))).toBeNull();
    } finally {
      setAquarelleScriptEditInFlight(false);
    }
    expect(beginAquarelleCloneEdit(Number.NaN, allocator(10110))).toBeNull();
    expect(beginAquarelleCloneEdit([], allocator(10120))).toBeNull();
    expect(beginAquarelleCloneEdit(999999, allocator(10130))).toBeNull();
    expect(beginAquarelleCloneEdit(10004, allocator(10140))).toBeNull();

    markAquarelleStrokeDeleted(10003);
    const revisionAfterDelete = aquarelleStrokesRevision.value;
    expect(beginAquarelleCloneEdit(10003, allocator(10150))).toBeNull();
    // Two live strokes on two different frames: no coherent batch.
    expect(beginAquarelleCloneEdit([10002, 10001], allocator(10160))).toBeNull();
    expect(aquarelleStrokesRevision.value).toBe(revisionAfterDelete);
    expect(frameIds(9110)).toEqual([10001, 10004]);
  });

  it('clones only the valid survivors of a mixed batch', () => {
    recordAquarelleStroke(10010, stroke({ points: [point(0.1, 0.1)], playFrame: 9112 }));
    recordAquarelleStroke(10011, stroke({ points: [point(0.2, 0.2)], playFrame: 9112 }));
    markAquarelleStrokeDeleted(10011);

    const edit = beginAquarelleCloneEdit(
      [10010, 10011, 999998, Number.NaN],
      allocator(10200),
    );

    expect(edit).not.toBeNull();
    expect(edit!.newIds).toHaveLength(1);
    expect(frameIds(9112)).toEqual([10010, edit!.newIds[0]]);
  });

  it('stores the whole batch as ONE undoable edit', () => {
    recordAquarelleStroke(11001, stroke({ points: [point(0.1, 0.1)], playFrame: 9113 }));
    recordAquarelleStroke(11002, stroke({ points: [point(0.2, 0.2)], playFrame: 9113 }));

    const edit = beginAquarelleCloneEdit(11002, allocator(11100), { now: () => 5000 });
    expect(edit).not.toBeNull();
    const cloned = frameIds(9113);
    expect(cloned).toEqual([11001, 11002, edit!.newIds[0]]);

    expect(restoreAquarelleEditSnapshot(edit!.editId, 'undo')).not.toBeNull();
    expect(frameIds(9113)).toEqual([11001, 11002]);

    expect(restoreAquarelleEditSnapshot(edit!.editId, 'redo')).not.toBeNull();
    expect(frameIds(9113)).toEqual(cloned);
  });

  it('records clones whose arrays never share the source graph', () => {
    recordAquarelleStroke(12001, stroke({
      points: [point(0.1, 0.2), point(0.3, 0.4)],
      pointTicks: [0, 4],
      playFrame: 9114,
      timestamp: 200,
      params: { size: 14, water: 55 },
      toolOverrides: { ...NEUTRAL_TOOL_OVERRIDES, aspect: 3 },
      anchors: [anchor(0.2, 0.3, { width: 1.5 }), anchor(0.5, 0.6)],
      curveMode: 'spline',
      vectorDrawn: true,
    }));
    const sourceBefore = getRecordedAquarelleStroke(12001)!;

    const edit = beginAquarelleCloneEdit(12001, allocator(12100));
    expect(edit).not.toBeNull();
    const clone = getRecordedAquarelleStroke(edit!.newIds[0]!)!;

    // The source's stored stroke object survives the clone untouched.
    expect(getRecordedAquarelleStroke(12001)).toBe(sourceBefore);
    expect(clone).not.toBe(sourceBefore);
    expect(clone.points).not.toBe(sourceBefore.points);
    expect(clone.points[0]).not.toBe(sourceBefore.points[0]);
    expect(clone.params).not.toBe(sourceBefore.params);
    expect(clone.pointTicks).not.toBe(sourceBefore.pointTicks);
    expect(clone.toolOverrides).not.toBe(sourceBefore.toolOverrides);
    expect(clone.anchors).not.toBe(sourceBefore.anchors);
    expect(clone.anchors![0]).not.toBe(sourceBefore.anchors![0]);
    expect(clone.anchors![0]!.in).not.toBe(sourceBefore.anchors![0]!.in);
    expect(clone.anchors![0]!.out).not.toBe(sourceBefore.anchors![0]!.out);
    // Everything recordable rides the copy.
    expect(clone.curveMode).toBe('spline');
    expect(clone.vectorDrawn).toBe(true);
    expect(clone.anchors).toEqual(sourceBefore.anchors);
  });
});
