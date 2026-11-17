// @vitest-environment node
// ============================================================
//  aquarelleRecordState.test.ts — 61-05 (VEC-06), reopen lossless.
//
//  A decoded AQTL v2 stroke must reopen as a VECTOR stroke, not as a
//  plain painted one: the restore path seeds the anchor path and the
//  render mode beside `playFrame`, the sparse width factors survive,
//  and a malformed anchor list degrades only its own event instead of
//  aborting the whole restore. The fail-closed refusal surfaces at
//  path edit and export — never by dropping the document.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest';
import { toEngineParams } from '@efxlab/efx-watercolor';
import type {
  AquarelleAnchor,
  AquarelleDryEvent,
  AquarelleStroke,
  AquarelleStrokePayload,
} from '@efxlab/efx-watercolor/payload';
import type { StudioPoint, StudioStroke } from '@efxlab/efx-paint-host/animation';
import {
  aquarelleActiveTool,
  aquarelleLiftTipId,
  aquarelleParams,
  aquarelleRecordClock,
  aquarelleSelectedTipId,
  aquarelleStrokeSerial,
  aquarelleToolOverrides,
  getAquarelleStrokeKeyAnchors,
  getRecordedAquarelleDryEvents,
  getRecordedAquarellePayloadTimeline,
  getRecordedAquarelleStroke,
  recordAquarelleStroke,
  resetAquarelleRecordState,
  restoreAquarelleRecordTimeline,
  selectAquarelleTip,
  setAquarelleLiftTipId,
  setAquarelleParam,
  setAquarelleTool,
  snapshotAquarelleRecord,
  updateAquarelleStrokesInScript,
} from './aquarelleRecordState';
import {
  NEUTRAL_TOOL_OVERRIDES,
  type AquarelleTip,
} from '@efxlab/efx-watercolor/brushes';
import {
  addCustomBrushTip,
  replaceCustomBrushTips,
} from '../../../stores/aquarelleBrushCatalog';

/** `1.8` as the codec stores it (f32 wire precision), so equality is exact. */
const VECTOR_WIDTH_1_8 = Math.fround(1.8);

const VECTOR_ANCHORS: readonly AquarelleAnchor[] = [
  { x: 0.25, y: 0.5, kind: 'auto', width: VECTOR_WIDTH_1_8 },
  { x: 0.75, y: 0.125, kind: 'bezier', in: { x: 0.5, y: 0.5 }, out: { x: 1, y: 0 } },
];

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

function vectorStroke(
  playFrame: number,
  mutationId: number,
  options: { anchors?: unknown } = {},
): StudioStroke<AquarelleStrokePayload> {
  const base = fixtureStroke(playFrame, mutationId);
  const anchors = options.anchors as readonly AquarelleAnchor[] | undefined;
  return {
    ...base,
    engine: {
      ...base.engine,
      ...(anchors !== undefined ? { anchors } : {}),
    },
  };
}

function fixtureDry(tick: number): AquarelleDryEvent {
  return { kind: 'dry', tick, recordedOrder: 2 };
}

beforeEach(() => {
  resetAquarelleRecordState();
});

describe('61-05 reopen-lossless vector restore', () => {
  it('seeds the anchor path and the sparse width factor', () => {
    restoreAquarelleRecordTimeline([vectorStroke(7, 102, { anchors: VECTOR_ANCHORS })]);

    const stroke = getRecordedAquarelleStroke(102);
    expect(stroke).toBeDefined();
    expect(stroke!.anchors).toEqual(VECTOR_ANCHORS);
    expect(stroke!.anchors).toHaveLength(2);
    expect(stroke!.anchors!.filter((anchor) => anchor.width !== undefined)).toHaveLength(1);
    expect(stroke!.anchors![0]!.width).toBeCloseTo(1.8, 6);

    // The projected timeline entry (same object the replay consumes) keeps
    // the path too, so a reopen is editable as a path.
    const entry = getRecordedAquarellePayloadTimeline()[0] as StudioStroke<AquarelleStrokePayload>;
    expect(entry.engine.anchors).toEqual(VECTOR_ANCHORS);
  });

  it('invents no removed render-mode key', () => {
    restoreAquarelleRecordTimeline([vectorStroke(7, 103, { anchors: VECTOR_ANCHORS })]);

    const stroke = getRecordedAquarelleStroke(103)!;
    expect(stroke.anchors).toEqual(VECTOR_ANCHORS);
    expect('renderMode' in stroke).toBe(false);
  });

  it('keeps the hand-painted event serial, clock, key anchor and timeline unchanged', () => {
    restoreAquarelleRecordTimeline(
      [
        fixtureStroke(7, 101),
        vectorStroke(7, 102, { anchors: VECTOR_ANCHORS }),
        fixtureDry(9),
      ],
      new Map([[101, 'key-a'], [102, 'key-b']]),
    );

    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(3);
    expect(getRecordedAquarelleDryEvents()).toHaveLength(1);
    expect(aquarelleRecordClock()).toBe(9);
    expect(aquarelleStrokeSerial(101, 7)).toBe(1);
    expect(aquarelleStrokeSerial(102, 7)).toBe(2);
    expect(getAquarelleStrokeKeyAnchors().get(101)).toBe('key-a');
    expect(getAquarelleStrokeKeyAnchors().get(102)).toBe('key-b');

    const handPainted = getRecordedAquarelleStroke(101)!;
    expect('anchors' in handPainted).toBe(false);
    expect('renderMode' in handPainted).toBe(false);
  });

  it('degrades only its own event when the anchor list is malformed', () => {
    const malformed = [
      VECTOR_ANCHORS[0],
      { x: 0.4, y: 0.4, kind: 'spiral' },
    ] as unknown as readonly AquarelleAnchor[];

    restoreAquarelleRecordTimeline([
      vectorStroke(7, 104, { anchors: malformed }),
      fixtureStroke(9, 105),
    ]);

    // Nothing aborted: both events entered the session and the dry-free
    // timeline kept its length.
    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(2);
    const degraded = getRecordedAquarelleStroke(104)!;
    expect('anchors' in degraded).toBe(false);
    expect(getRecordedAquarelleStroke(105)).toBeDefined();

    const entry = getRecordedAquarellePayloadTimeline()[0] as StudioStroke<AquarelleStrokePayload>;
    expect('anchors' in entry.engine).toBe(false);
  });
});

// 63-06 D-03 / G-5: a mask-backed catalog tip (built-in or project import)
// is a valid Brush pick, resolved after findTip(TIPS) and BRUSH_PRESETS.
// The lift selection stays preset-only (D-04) — that is pinned here so the
// two lookups cannot be "unified" by a later refactor.
describe('63-06 catalog tip selection', () => {
  it('selects a texture-category catalog tip and forces the Brush tool', () => {
    // quick 261116-inu / Task 3 boundary: no built-ins — a texture tip is a
    // catalogue row, and the pick still flips the tool to Brush.
    const tip: AquarelleTip = {
      id: 'wc/custom-63-06-texture',
      category: 'texture',
      name: 'Texture',
      ...NEUTRAL_TOOL_OVERRIDES,
    };
    addCustomBrushTip(tip);
    try {
      selectAquarelleTip(null);
      setAquarelleTool('water');

      selectAquarelleTip(tip.id);

      expect(aquarelleSelectedTipId.value).toBe(tip.id);
      expect(aquarelleActiveTool.value).toBe('brush');
      // A row carrying neutral multipliers loads the neutral bag.
      expect(aquarelleToolOverrides.value).toEqual({ ...NEUTRAL_TOOL_OVERRIDES });
    } finally {
      replaceCustomBrushTips([]);
    }
  });

  it('selects an imported custom tip and loads the multipliers it carries', () => {
    const tip: AquarelleTip = {
      id: 'wc/custom-63-06-test',
      category: 'custom',
      name: 'Imported tip',
      ...NEUTRAL_TOOL_OVERRIDES,
      aspect: 1.6,
    };
    addCustomBrushTip(tip);
    try {
      selectAquarelleTip(null);

      selectAquarelleTip(tip.id);

      expect(aquarelleSelectedTipId.value).toBe(tip.id);
      expect(aquarelleToolOverrides.value.aspect).toBe(1.6);
    } finally {
      replaceCustomBrushTips([]);
    }
  });

  it('keeps the lift selection preset-only (D-04)', () => {
    addCustomBrushTip({
      id: 'wc/custom-63-06-lift',
      category: 'custom',
      name: 'Imported lift trap',
      ...NEUTRAL_TOOL_OVERRIDES,
    });
    try {
      setAquarelleLiftTipId(null);
      setAquarelleLiftTipId('wc/custom-unknown-lift');
      expect(aquarelleLiftTipId.value).toBeNull();
      setAquarelleLiftTipId('wc/custom-63-06-lift');
      expect(aquarelleLiftTipId.value).toBeNull();
      // A preset still normalizes as before.
      setAquarelleLiftTipId('filbert');
      expect(aquarelleLiftTipId.value).toBe('filbert');
    } finally {
      replaceCustomBrushTips([]);
    }
  });

  it('still normalizes an unknown id to null', () => {
    selectAquarelleTip('round');
    selectAquarelleTip('wc/does-not-exist');
    expect(aquarelleSelectedTipId.value).toBeNull();
  });
});

// Phase 64 (MED-23 / D-14) — the Body key rides the ONE record path: the
// snapshot carries it, an absent or non-finite value maps to the neutral
// engine 0, and the selection-edit allowlist accepts a body patch. 64-02
// declared the key; 64-06 proves the path end to end.
describe('Phase 64 Body record path (MED-23)', () => {
  it('snapshots the live body into the recorded bag', () => {
    const previous = aquarelleParams.value.body;
    try {
      expect(previous, 'the neutral default is 0').toBe(0);
      setAquarelleParam('body', 40);
      expect(snapshotAquarelleRecord().params.body, 'the snapshot carries body').toBe(40);
    } finally {
      setAquarelleParam('body', previous);
    }
  });

  it('maps an absent, non-finite or overshooting body through the one canonical mapping', () => {
    expect(toEngineParams({ size: 12 }).body, 'absent body maps to engine 0').toBe(0);
    expect(toEngineParams({ body: Number.NaN }).body, 'NaN maps to engine 0').toBe(0);
    expect(toEngineParams({ body: Number.POSITIVE_INFINITY }).body, 'Infinity maps to engine 0').toBe(0);
    expect(toEngineParams({ body: 150 }).body, 'an overshoot clamps to 1').toBe(1);
  });

  it('accepts a body patch through the selection write allowlist', () => {
    recordAquarelleStroke(20601, bodyStrokeFixture(20601));
    const changed = updateAquarelleStrokesInScript([20601], { params: { body: 40 } });
    expect(changed, 'the batch is accepted, not refused').toBe(1);
    expect(getRecordedAquarelleStroke(20601)!.params.body, 'the stroke carries body').toBe(40);
  });
});

function bodyStrokeFixture(mutationId: number): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#103c65',
    params: { size: 12 },
    brushId: 'round',
    points: [{ x: 0.5, y: 0.5, p: 1, tx: 0, ty: 0, tw: 0 }],
    timestamp: 0,
    playFrame: 811,
  };
}

describe('quick 261116-rp — a reopen keeps the raw pointer timing', () => {
  it('projects the real per-point ticks, repeats and gaps included', () => {
    const base = fixtureStroke(7, 901, 4);
    const raw: StudioStroke<AquarelleStrokePayload> = {
      ...base,
      ticks: 9,
      pts: base.pts.map((point, index) => ({ ...point, tick: [0, 0, 3, 9][index]! })),
    };
    restoreAquarelleRecordTimeline([raw]);

    const [entry] = getRecordedAquarellePayloadTimeline() as StudioStroke<AquarelleStrokePayload>[];
    expect(entry!.pts.map((point) => point.tick)).toEqual([0, 0, 3, 9]);
    expect(entry!.ticks).toBe(9);
  });
});
