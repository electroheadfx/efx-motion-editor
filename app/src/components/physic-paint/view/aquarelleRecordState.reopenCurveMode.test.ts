// @vitest-environment node
// ============================================================
//  Nyquist audit 2026-11-11 — VEC-06 / REL-02 (gap G-20 reopen)
//
//  VEC-06: "Vector strokes persist in the `.mce`, survive reopen".
//  61-30 introduced the per-stroke `curveMode` discriminator and
//  taught the AQTL v2 wire to carry it. The EVENT round trip is
//  pinned by `scriptTimelineCodec.test.ts`.
//
//  What nothing pinned is the RECONSTRUCTED stroke. The shipped
//  reopen chain is:
//
//    saved events -> encodeScriptTimelineBinary (AQTL v2)
//      -> encodeStudioScriptSnapshot -> ... -> decode
//      -> restoreAquarelleRecordTimeline -> recorded strokes
//
//  `restoreAquarelleRecordTimeline` rebuilds every `AquarelleStroke`
//  from its event. The overlay draws and edits through the recorded
//  stroke, so if the rebuild drops `curveMode` every spline path
//  silently reopens as Bézier — and the re-projected payload entry
//  loses the key, breaking the next save's byte parity.
//
//  Fixtures use codec-exact values only (u16 uv endpoints, the -1
//  pressure sentinel, tilt multiples of 1/50, binary32-exact anchor
//  coordinates and Math.fround widths), so a failure names a dropped
//  field rather than a rounding artefact.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest';
import {
  type AquarelleAnchor,
  type AquarellePayloadEvent,
  type AquarellePoint,
  type AquarelleStroke,
} from '@efxlab/efx-watercolor/payload';
import {
  decodeScriptTimelineBinary,
  encodeScriptTimelineBinary,
} from '../performance/scriptTimelineCodec';
import {
  getRecordedAquarellePayloadTimeline,
  getRecordedAquarelleStroke,
  recordAquarelleStroke,
  resetAquarelleRecordState,
  restoreAquarelleRecordTimeline,
} from './aquarelleRecordState';

const ID = 71001;

/** Codec-exact sample fields (same fixture shape as 61-14's reopen parity). */
function point(x: number, y: number, p: number): AquarellePoint {
  return { x, y, p, tx: 10, ty: -10, tw: 5 };
}

/** Binary32-exact uv coordinates; the sparse 1.8 width is Math.fround-ed. */
const ANCHORS: readonly AquarelleAnchor[] = [
  { x: 0.25, y: 0.5, kind: 'auto', width: Math.fround(1.8) },
  { x: 0.75, y: 0.125, kind: 'bezier', in: { x: 0.5, y: 0.5 }, out: { x: 1, y: 0 } },
];

function stroke(mutationId: number, overrides: Partial<AquarelleStroke> = {}): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#103c65',
    params: { size: 12, water: 30 },
    brushId: 'round',
    points: [point(0, 0, -1), point(1, 1, 1)],
    mutationId,
    timestamp: mutationId,
    playFrame: 601,
    ...overrides,
  };
}

type StrokeEvent = Exclude<AquarellePayloadEvent, { kind: 'dry' }>;

function strokeEventAt(timeline: readonly AquarellePayloadEvent[]): StrokeEvent {
  const event = timeline[0];
  if (!event || 'kind' in event) {
    throw new Error('expected exactly one stroke event');
  }
  return event;
}

/** The production reopen chain (studioScriptSnapshotController -> restore). */
function reopen(events: readonly AquarellePayloadEvent[]): readonly AquarellePayloadEvent[] {
  const bytes = encodeScriptTimelineBinary(events);
  const decoded = decodeScriptTimelineBinary(bytes);
  restoreAquarelleRecordTimeline(decoded);
  return getRecordedAquarellePayloadTimeline();
}

/** What the next Save would write after the current store state. */
function wireAfterSave(): StrokeEvent {
  const bytes = encodeScriptTimelineBinary(getRecordedAquarellePayloadTimeline());
  return strokeEventAt(decodeScriptTimelineBinary(bytes));
}

describe('Nyquist 2026-11-11 VEC-06 — a spline stroke survives reopen', () => {
  beforeEach(() => {
    resetAquarelleRecordState();
  });

  it('keeps curveMode on the recorded stroke and its payload entry after reopen', () => {
    recordAquarelleStroke(ID, stroke(ID, { anchors: ANCHORS, curveMode: 'spline' }));
    const saved = [...getRecordedAquarellePayloadTimeline()];
    // What Save writes carries the mode.
    expect(strokeEventAt(saved).engine.curveMode).toBe('spline');

    const reopened = reopen(saved);

    // What the overlay draws and edits from must still be a spline.
    const reopenedStroke = getRecordedAquarelleStroke(ID)!;
    expect(reopenedStroke.curveMode).toBe('spline');
    expect(reopenedStroke.anchors).toEqual(ANCHORS);
    // What the NEXT save serialises must still carry the mode.
    expect(strokeEventAt(reopened).engine.curveMode).toBe('spline');
  });

  it('reopens the saved entry byte-identical (REL-02)', () => {
    recordAquarelleStroke(ID, stroke(ID, { anchors: ANCHORS, curveMode: 'spline' }));
    const savedEntry = strokeEventAt(getRecordedAquarellePayloadTimeline());

    const reopenedEntry = strokeEventAt(reopen([...getRecordedAquarellePayloadTimeline()]));

    expect(reopenedEntry).toStrictEqual(savedEntry);
  });

  it('keeps the mode through a second save -> reopen cycle', () => {
    recordAquarelleStroke(ID, stroke(ID, { anchors: ANCHORS, curveMode: 'spline' }));
    reopen([...getRecordedAquarellePayloadTimeline()]);

    // The first reopen must not bleed the mode out of the next Save's bytes.
    expect(wireAfterSave().engine.curveMode).toBe('spline');

    const afterSecondReopen = reopen([...getRecordedAquarellePayloadTimeline()]);

    expect(getRecordedAquarelleStroke(ID)!.curveMode).toBe('spline');
    expect(strokeEventAt(afterSecondReopen).engine.curveMode).toBe('spline');
  });

  it('adds no curveMode key to a Bézier stroke (absence stays absence)', () => {
    recordAquarelleStroke(ID, stroke(ID, { anchors: ANCHORS }));

    const reopened = reopen([...getRecordedAquarellePayloadTimeline()]);

    expect('curveMode' in getRecordedAquarelleStroke(ID)!).toBe(false);
    expect('curveMode' in strokeEventAt(reopened).engine).toBe(false);
  });
});
