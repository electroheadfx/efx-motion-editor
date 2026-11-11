// @vitest-environment node
// ============================================================
//  261111-wd6 — the per-vertex colour reopen chain.
//
//  The EVENT round trip is pinned by `scriptTimelineCodec.test.ts`
//  (the AQTL v2 colour block). What this file pins is the
//  RECONSTRUCTED stroke the overlay draws and edits from:
//
//    saved events -> encodeScriptTimelineBinary (AQTL v2)
//      -> ... -> decode -> restoreAquarelleRecordTimeline
//
//  `restoreAquarelleRecordTimeline` rebuilds every `AquarelleStroke`
//  from its event. If that rebuild drops an anchor's colour, the
//  canvas repaints in the stroke colour and the next Save loses the
//  key — a silent wash-out of authored paint. A colourless path must
//  keep today's exact bytes (no `color` key materialised).
//
//  Fixtures use codec-exact values only (u16 uv endpoints, the -1
//  pressure sentinel, tilt multiples of 1/50, binary32-exact anchor
//  coordinates, canonical lowercase colours), so a failure names a
//  dropped field rather than a rounding artefact.
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

const ID = 73001;

/** Codec-exact sample fields (same fixture shape as the reopen parity pins). */
function point(x: number, y: number, p: number): AquarellePoint {
  return { x, y, p, tx: 10, ty: -10, tw: 5 };
}

/** Binary32-exact uv coordinates; both colours are canonical lowercase. */
const COLORED_ANCHORS: readonly AquarelleAnchor[] = [
  { x: 0.25, y: 0.5, kind: 'auto', color: '#ff0000' },
  {
    x: 0.75,
    y: 0.125,
    kind: 'bezier',
    in: { x: 0.5, y: 0.5 },
    out: { x: 1, y: 0 },
    color: '#103c65',
  },
];

/** The same geometry with no explicit colour: today's exact bytes. */
const COLORLESS_ANCHORS: readonly AquarelleAnchor[] = [
  { x: 0.25, y: 0.5, kind: 'auto' },
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

describe('261111-wd6 — an authored anchor colour survives reopen', () => {
  beforeEach(() => {
    resetAquarelleRecordState();
  });

  it('keeps the colours on the recorded stroke and its payload entry after reopen', () => {
    recordAquarelleStroke(ID, stroke(ID, { anchors: COLORED_ANCHORS }));
    const saved = [...getRecordedAquarellePayloadTimeline()];
    // What Save writes carries both colours.
    expect(strokeEventAt(saved).engine.anchors).toEqual(COLORED_ANCHORS);

    const reopened = reopen(saved);

    // What the overlay draws and edits from must still carry them.
    const reopenedStroke = getRecordedAquarelleStroke(ID)!;
    expect(reopenedStroke.anchors).toEqual(COLORED_ANCHORS);
    // What the NEXT save serialises must still carry them.
    expect(strokeEventAt(reopened).engine.anchors).toEqual(COLORED_ANCHORS);
  });

  it('reopens the saved entry byte-identical (REL-02)', () => {
    recordAquarelleStroke(ID, stroke(ID, { anchors: COLORED_ANCHORS }));
    const savedEntry = strokeEventAt(getRecordedAquarellePayloadTimeline());

    const reopenedEntry = strokeEventAt(reopen([...getRecordedAquarellePayloadTimeline()]));

    expect(reopenedEntry).toStrictEqual(savedEntry);
  });

  it('keeps the colours through a second save -> reopen cycle', () => {
    recordAquarelleStroke(ID, stroke(ID, { anchors: COLORED_ANCHORS }));
    reopen([...getRecordedAquarellePayloadTimeline()]);

    // The first reopen must not bleed the colours out of the next Save.
    expect(wireAfterSave().engine.anchors).toEqual(COLORED_ANCHORS);

    const afterSecondReopen = reopen([...getRecordedAquarellePayloadTimeline()]);

    expect(getRecordedAquarelleStroke(ID)!.anchors).toEqual(COLORED_ANCHORS);
    expect(strokeEventAt(afterSecondReopen).engine.anchors).toEqual(COLORED_ANCHORS);
  });

  it('adds no colour key to a colourless path (absence stays absence)', () => {
    recordAquarelleStroke(ID, stroke(ID, { anchors: COLORLESS_ANCHORS }));
    const savedEntry = strokeEventAt(getRecordedAquarellePayloadTimeline());

    const reopened = reopen([...getRecordedAquarellePayloadTimeline()]);

    const anchors = getRecordedAquarelleStroke(ID)!.anchors!;
    expect(anchors.every((anchor) => !('color' in anchor))).toBe(true);
    const entryAnchors = strokeEventAt(reopened).engine.anchors!;
    expect(entryAnchors.every((anchor) => !('color' in anchor))).toBe(true);
    expect(strokeEventAt(reopened)).toStrictEqual(savedEntry);
  });
});
