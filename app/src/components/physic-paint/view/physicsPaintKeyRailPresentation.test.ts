import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildKeyRailBaseCopy,
  buildSelectedKeyRailCopy,
  deriveKeyRailSegments,
  resolvePhysicPaintPushAnchor,
} from './physicsPaintKeyRailPresentation';
import * as keyRailPresentationModule from './physicsPaintKeyRailPresentation';
import type { PhysicPaintRotoRailMotionRecord } from '../roto/railMotionModel';

const keyRailPresentationSource = readFileSync(
  fileURLToPath(new URL('./physicsPaintKeyRailPresentation.ts', import.meta.url)),
  'utf8',
);

describe('deriveKeyRailSegments', () => {
  it('derives ordinary rails from ordered real keys, breaks, and Group ownership', () => {
    const segments = deriveKeyRailSegments({
      orderedRealKeys: [
        { keyId: 'A', appFrame: 1 },
        { keyId: 'B', appFrame: 4 },
        { keyId: 'C', appFrame: 7 },
        { keyId: 'D', appFrame: 9 },
        { keyId: 'E', appFrame: 12 },
        { keyId: 'F', appFrame: 16 },
      ],
      incomingInterpolationBreakKeyIds: new Set(['B', 'F']),
      groupOwnedKeyIds: new Set(['C', 'D']),
    });

    expect(segments).toEqual([
      { firstKeyId: 'A', keyIds: ['A'], firstKeyFrame: 1, lastKeyFrame: 1 },
      { firstKeyId: 'B', keyIds: ['B'], firstKeyFrame: 4, lastKeyFrame: 4 },
      { firstKeyId: 'E', keyIds: ['E'], firstKeyFrame: 12, lastKeyFrame: 12 },
      { firstKeyId: 'F', keyIds: ['F'], firstKeyFrame: 16, lastKeyFrame: 16 },
    ]);
    expect(Object.isFrozen(segments)).toBe(true);
    expect(segments.every((segment) => Object.isFrozen(segment) && Object.isFrozen(segment.keyIds))).toBe(true);
  });

  it('keeps empty physical frames inside one half-open rail when no break exists', () => {
    const segments = deriveKeyRailSegments({
      orderedRealKeys: [
        { keyId: 'left', appFrame: 2 },
        { keyId: 'right', appFrame: 8 },
      ],
      incomingInterpolationBreakKeyIds: new Set(),
      groupOwnedKeyIds: new Set(),
    });

    expect(segments).toEqual([
      { firstKeyId: 'left', keyIds: ['left', 'right'], firstKeyFrame: 2, lastKeyFrame: 8 },
    ]);
    expect(segments[0].lastKeyFrame + 1).toBe(9);
  });
});

describe('resolvePhysicPaintPushAnchor (43.5-05 smoke RED: cell → containing rail)', () => {
  const keyIdByAppFrame = new Map<number, string>([
    [0, 'A'],
    [3, 'B'],
    [5, 'C'],
  ]);
  const loopIdByAppFrame = new Map<number, string>();
  const keyRailSegments = [
    { firstKeyId: 'A', keyIds: ['A', 'B'], firstKeyFrame: 0, lastKeyFrame: 3 },
    { firstKeyId: 'C', keyIds: ['C'], firstKeyFrame: 5, lastKeyFrame: 5 },
  ];

  it('resolves a real key to its own keyId (Key Rail member included)', () => {
    expect(resolvePhysicPaintPushAnchor(0, { keyIdByAppFrame, loopIdByAppFrame, keyRailSegments }))
      .toEqual({ kind: 'key', id: 'A' });
    expect(resolvePhysicPaintPushAnchor(3, { keyIdByAppFrame, loopIdByAppFrame, keyRailSegments }))
      .toEqual({ kind: 'key', id: 'B' });
  });

  it('resolves a generated in-between frame to its containing Key Rail first key', () => {
    expect(resolvePhysicPaintPushAnchor(1, { keyIdByAppFrame, loopIdByAppFrame, keyRailSegments }))
      .toEqual({ kind: 'key', id: 'A' });
    expect(resolvePhysicPaintPushAnchor(2, { keyIdByAppFrame, loopIdByAppFrame, keyRailSegments }))
      .toEqual({ kind: 'key', id: 'A' });
  });

  it('resolves a linked occurrence inside a Group to the Group loopId', () => {
    const withLoop = new Map<number, string>([[1, 'loop-G']]);
    expect(resolvePhysicPaintPushAnchor(1, { keyIdByAppFrame, loopIdByAppFrame: withLoop, keyRailSegments }))
      .toEqual({ kind: 'loop', id: 'loop-G' });
  });

  it('returns null for an empty/gap frame', () => {
    expect(resolvePhysicPaintPushAnchor(4, { keyIdByAppFrame, loopIdByAppFrame, keyRailSegments }))
      .toBeNull();
  });
});

describe('Key Rail copy family', () => {
  const multiple = Object.freeze({
    firstKeyId: 'A',
    keyIds: Object.freeze(['A', 'B', 'C']),
    firstKeyFrame: 2,
    lastKeyFrame: 8,
  });
  const single = Object.freeze({
    firstKeyId: 'A',
    keyIds: Object.freeze(['A']),
    firstKeyFrame: 2,
    lastKeyFrame: 2,
  });

  it('emits the four locked singular and plural forms without advertising Scissor', () => {
    const copies = [
      buildKeyRailBaseCopy(multiple),
      buildKeyRailBaseCopy(single),
      buildSelectedKeyRailCopy(multiple),
      buildSelectedKeyRailCopy(single),
    ];

    expect(copies).toEqual([
      'Key Rail — frames 2–8, 3 keys.',
      'Key Rail — frame 2, 1 key.',
      'Selected Key Rail — frames 2–8, 3 keys. Drag to move. Delete removes all keys in this rail.',
      'Selected Key Rail — frame 2, 1 key. Drag to move. Delete removes this rail.',
    ]);
    expect(copies.every((copy) => !copy.includes('Scissor'))).toBe(true);
  });

  it('substitutes exact guarded reasons for unavailable selected actions', () => {
    expect(buildSelectedKeyRailCopy(multiple, {
      dragUnavailableReason: 'No empty space in that direction.',
      deleteUnavailableReason: 'Delete is unavailable.',
    })).toBe(
      'Selected Key Rail — frames 2–8, 3 keys. No empty space in that direction. Delete is unavailable.',
    );
  });
});

/**
 * 58-03 RAIL-01: the Selected Key Rail inspector projection. The namespace
 * import keeps this spec loadable before the export exists, so RED fails on the
 * planned `typeof ... === 'function'` assertion rather than a module error.
 */
interface ProjectedInspectorShape {
  readonly firstKeyId: string;
  readonly keyIds: readonly string[];
  readonly firstKeyFrame: number;
  readonly lastKeyFrame: number;
  readonly framesLabel: string;
  readonly keysLabel: string;
  readonly typeLabel: string;
  readonly editDisabledReason: string | null;
}

type ProjectInspector = (
  segment: KeyRailSegmentShape,
  options?: { readonly setSize?: number },
) => ProjectedInspectorShape;

interface KeyRailSegmentShape {
  readonly firstKeyId: string;
  readonly keyIds: readonly string[];
  readonly firstKeyFrame: number;
  readonly lastKeyFrame: number;
}

function requireProjectInspector(): ProjectInspector {
  const candidate = (keyRailPresentationModule as unknown as {
    projectSelectedKeyRailInspector?: unknown;
  }).projectSelectedKeyRailInspector;
  expect(typeof candidate).toBe('function');
  if (typeof candidate !== 'function') {
    throw new Error('projectSelectedKeyRailInspector is not implemented yet');
  }
  return candidate as ProjectInspector;
}

describe('projectSelectedKeyRailInspector (58-03 RAIL-01: Selected Key Rail inspector)', () => {
  const segment: KeyRailSegmentShape = Object.freeze({
    firstKeyId: 'A',
    keyIds: Object.freeze(['A', 'B', 'C', 'D', 'E']),
    firstKeyFrame: 10,
    lastKeyFrame: 14,
  });

  it('projects exactly the three facts plus the controller handoff fields for a single Rail', () => {
    const projection = requireProjectInspector()(segment);

    expect(projection.framesLabel).toBe('F10–F14');
    expect(projection.keysLabel).toBe('5');
    expect(projection.typeLabel).toBe('Standard');
    expect(projection.editDisabledReason).toBeNull();
    expect(projection.firstKeyId).toBe('A');
    expect(projection.keyIds).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(projection.firstKeyFrame).toBe(10);
    expect(projection.lastKeyFrame).toBe(14);
    expect(Object.isFrozen(projection)).toBe(true);
    expect(Object.isFrozen(projection.keyIds)).toBe(true);
  });

  it('disables Edit Rail with the locked reason for a multi-Rail set while keeping this Rail\'s own facts', () => {
    const project = requireProjectInspector();
    const projection = project(segment, { setSize: 2 });

    expect(projection.framesLabel).toBe('F10–F14');
    expect(projection.keysLabel).toBe('5');
    expect(projection.typeLabel).toBe('Standard');
    expect(projection.editDisabledReason).toBe('Select a single rail to edit it.');
    expect(project(segment, { setSize: 3 }).editDisabledReason).toBe('Select a single rail to edit it.');
    expect(project(segment, { setSize: 1 }).editDisabledReason).toBeNull();
  });

  it('is anchor-agnostic — any segment the caller resolves projects its own facts', () => {
    const anchor = requireProjectInspector()(Object.freeze({
      firstKeyId: 'C',
      keyIds: Object.freeze(['C']),
      firstKeyFrame: 20,
      lastKeyFrame: 20,
    }), { setSize: 2 });

    expect(anchor.firstKeyId).toBe('C');
    expect(anchor.framesLabel).toBe('F20–F20');
    expect(anchor.keysLabel).toBe('1');
    expect(anchor.typeLabel).toBe('Standard');
    expect(anchor.editDisabledReason).toBe('Select a single rail to edit it.');
  });
});

/**
 * 59-16 (MOTN-03, MOTN-09): the Motion value inspector projection. The namespace
 * import keeps this spec loadable before the export exists, so RED fails on the
 * planned `typeof ... === 'function'` assertion rather than a module error.
 */
interface ProjectedMotionFieldShape {
  readonly channelId: string;
  readonly label: string;
  readonly unit: string;
  readonly value: number;
  /** 59-21: the channel EXISTS on the record (never whether the frame is keyed). */
  readonly present: boolean;
}

interface ProjectedMotionInspectorShape {
  readonly railId: string;
  readonly frame: number;
  readonly fields: readonly ProjectedMotionFieldShape[];
}

type ProjectMotionInspector = (input: {
  readonly record: PhysicPaintRotoRailMotionRecord | null;
  readonly selectedKeyFrame: number | null;
  readonly railLocalFrame: number;
}) => ProjectedMotionInspectorShape | null;

function requireProjectMotionInspector(): ProjectMotionInspector {
  const candidate = (keyRailPresentationModule as unknown as {
    projectRailMotionInspector?: unknown;
  }).projectRailMotionInspector;
  expect(typeof candidate).toBe('function');
  if (typeof candidate !== 'function') {
    throw new Error('projectRailMotionInspector is not implemented yet');
  }
  return candidate as ProjectMotionInspector;
}

/**
 * Position x 0 -> 100 / y 0 -> 50 over rail-local frames 0..10, Scale 1 -> 2,
 * Rotation a single key at frame 4, and no Opacity channel at all (the
 * identity fallback the evaluator owns).
 */
function motionRecordFixture(): PhysicPaintRotoRailMotionRecord {
  const key = (frame: number, value: number) => Object.freeze({ frame, value, easing: 'ease' as const, wiggle: 0 });
  return Object.freeze({
    railId: 'rail-motion',
    anchorKeyId: 'key-a',
    channels: Object.freeze([
      Object.freeze({ id: 'position-x' as const, keys: Object.freeze([key(0, 0), key(5, 120), key(10, 100)]) }),
      Object.freeze({ id: 'position-y' as const, keys: Object.freeze([key(0, 0), key(5, -12), key(10, 50)]) }),
      Object.freeze({ id: 'scale' as const, keys: Object.freeze([key(0, 1), key(10, 2)]) }),
      Object.freeze({ id: 'rotation' as const, keys: Object.freeze([key(4, 0)]) }),
    ]),
  }) as PhysicPaintRotoRailMotionRecord;
}

describe('projectRailMotionInspector (59-16: Motion value inspector)', () => {
  it('returns null without a motion record — never a partially filled object', () => {
    expect(requireProjectMotionInspector()({
      record: null,
      selectedKeyFrame: 5,
      railLocalFrame: 5,
    })).toBeNull();
  });

  it('returns null when no Motion key is selected', () => {
    expect(requireProjectMotionInspector()({
      record: motionRecordFixture(),
      selectedKeyFrame: null,
      railLocalFrame: 5,
    })).toBeNull();
  });

  it('returns null when the selected frame carries no Motion key', () => {
    expect(requireProjectMotionInspector()({
      record: motionRecordFixture(),
      // 7 sits between keys on every channel.
      selectedKeyFrame: 7,
      railLocalFrame: 7,
    })).toBeNull();
  });

  it('projects every channel at the read frame with the 59-02 display conversion', () => {
    const projection = requireProjectMotionInspector()({
      record: motionRecordFixture(),
      selectedKeyFrame: 5,
      railLocalFrame: 5,
    });
    expect(projection).not.toBeNull();
    if (projection === null) return;

    expect(projection.railId).toBe('rail-motion');
    expect(projection.frame).toBe(5);
    // Stored key values at frame 5; Scale is evaluated (1 -> 2 at frame 5 is
    // the smoothstep midpoint) and Opacity falls back to the identity fraction.
    expect(projection.fields.map((field) => [field.channelId, field.value])).toEqual([
      ['position-x', 120],
      ['position-y', -12],
      ['scale', 150],
      ['rotation', 0],
      ['opacity', 100],
    ]);
  });

  it('is frozen at every level', () => {
    const projection = requireProjectMotionInspector()({
      record: motionRecordFixture(),
      selectedKeyFrame: 5,
      railLocalFrame: 5,
    });
    expect(projection).not.toBeNull();
    if (projection === null) return;
    expect(Object.isFrozen(projection)).toBe(true);
    expect(Object.isFrozen(projection.fields)).toBe(true);
    expect(projection.fields.every((field) => Object.isFrozen(field))).toBe(true);
  });

  it('owns one conversion authority and no store, signal or component import', () => {
    // The projection reuses the 59-02 pair; a second percent table would be a
    // contract violation (T-59-39).
    expect(keyRailPresentationSource).toContain('railMotionValueToUi');
    expect(keyRailPresentationSource).not.toContain('physicPaintStore');
    expect(keyRailPresentationSource).not.toMatch(/from '@preact\/signals'/);
    expect(keyRailPresentationSource).not.toMatch(/from 'preact/);
  });

  it('passes rotation through verbatim — 720 and -90 are never wrapped', () => {
    const key = (frame: number, value: number) => Object.freeze({ frame, value, easing: 'ease' as const, wiggle: 0 });
    const record = Object.freeze({
      railId: 'rail-rotation',
      anchorKeyId: 'key-a',
      channels: Object.freeze([
        Object.freeze({ id: 'rotation' as const, keys: Object.freeze([key(0, 720), key(10, -90)]) }),
      ]),
    }) as PhysicPaintRotoRailMotionRecord;
    const rotationAt = (frame: number) => requireProjectMotionInspector()({
      record,
      selectedKeyFrame: frame,
      railLocalFrame: frame,
    })?.fields.find((field) => field.channelId === 'rotation')?.value;

    expect(rotationAt(0)).toBe(720);
    expect(rotationAt(10)).toBe(-90);
  });

  it('keeps the fixed D-13 order and shows Opacity in percent even when the record is unordered', () => {
    const key = (frame: number, value: number) => Object.freeze({ frame, value, easing: 'ease' as const, wiggle: 0 });
    const record = Object.freeze({
      railId: 'rail-order',
      anchorKeyId: 'key-a',
      channels: Object.freeze([
        Object.freeze({ id: 'opacity' as const, keys: Object.freeze([key(2, 0.4)]) }),
        Object.freeze({ id: 'rotation' as const, keys: Object.freeze([key(2, 0)]) }),
        Object.freeze({ id: 'scale' as const, keys: Object.freeze([key(2, 1.5)]) }),
        Object.freeze({ id: 'position-y' as const, keys: Object.freeze([key(2, -12)]) }),
        Object.freeze({ id: 'position-x' as const, keys: Object.freeze([key(2, 120)]) }),
      ]),
    }) as PhysicPaintRotoRailMotionRecord;
    const projection = requireProjectMotionInspector()({
      record,
      selectedKeyFrame: 2,
      railLocalFrame: 2,
    });

    expect(projection?.fields.map((field) => [field.channelId, field.value, field.unit])).toEqual([
      ['position-x', 120, 'px'],
      ['position-y', -12, 'px'],
      ['scale', 150, '%'],
      ['rotation', 0, '°'],
      ['opacity', 40, '%'],
    ]);
  });
});

/**
 * 59-21 (G1 / IN-02): every field states whether its channel EXISTS on the
 * record. Presence is channel existence — never key presence at the read frame
 * — so an absent channel keeps being projected (the value an add would seed)
 * and simply reports `present: false`.
 */
describe('projectRailMotionInspector channel presence (59-21: absent channels are marked)', () => {
  const key = (frame: number, value: number) => Object.freeze({ frame, value, easing: 'ease' as const, wiggle: 0 });

  it('marks exactly the channels a partially present record carries and still projects all five', () => {
    const record = Object.freeze({
      railId: 'rail-partial',
      anchorKeyId: 'key-a',
      channels: Object.freeze([
        Object.freeze({ id: 'position-x' as const, keys: Object.freeze([key(0, 0), key(5, 120)]) }),
        Object.freeze({ id: 'position-y' as const, keys: Object.freeze([key(0, 0), key(5, -12)]) }),
      ]),
    }) as PhysicPaintRotoRailMotionRecord;

    const projection = requireProjectMotionInspector()({
      record,
      selectedKeyFrame: 5,
      railLocalFrame: 5,
    });
    expect(projection).not.toBeNull();
    if (projection === null) return;

    // Fixed D-13 order, and presence follows the record's channel list.
    expect(projection.fields.map((field) => [field.channelId, field.present])).toEqual([
      ['position-x', true],
      ['position-y', true],
      ['scale', false],
      ['rotation', false],
      ['opacity', false],
    ]);
    // An absent channel is STILL projected: the value an add would seed stays
    // visible, with its unit (scale 1 = 100%, opacity 1 = 100%, rotation 0).
    expect(projection.fields.map((field) => [field.channelId, field.value, field.unit])).toEqual([
      ['position-x', 120, 'px'],
      ['position-y', -12, 'px'],
      ['scale', 100, '%'],
      ['rotation', 0, '°'],
      ['opacity', 100, '%'],
    ]);
  });

  it('marks every field present when the record carries all five channels', () => {
    const record = Object.freeze({
      railId: 'rail-full',
      anchorKeyId: 'key-a',
      channels: Object.freeze([
        Object.freeze({ id: 'position-x' as const, keys: Object.freeze([key(2, 10)]) }),
        Object.freeze({ id: 'position-y' as const, keys: Object.freeze([key(2, 20)]) }),
        Object.freeze({ id: 'scale' as const, keys: Object.freeze([key(2, 1.5)]) }),
        Object.freeze({ id: 'rotation' as const, keys: Object.freeze([key(2, 45)]) }),
        Object.freeze({ id: 'opacity' as const, keys: Object.freeze([key(2, 0.4)]) }),
      ]),
    }) as PhysicPaintRotoRailMotionRecord;

    const projection = requireProjectMotionInspector()({
      record,
      selectedKeyFrame: 2,
      railLocalFrame: 2,
    });
    expect(projection?.fields.map((field) => [field.channelId, field.present])).toEqual([
      ['position-x', true],
      ['position-y', true],
      ['scale', true],
      ['rotation', true],
      ['opacity', true],
    ]);
  });

  it('keeps a channel present when the read frame carries no key on it', () => {
    // `motionRecordFixture` carries Scale keys at 0 and 10 and a lone Rotation
    // key at 4; frame 5 is keyed only on the Position pair. Presence tracks the
    // RECORD — a rail can carry a channel whose keys sit elsewhere.
    const projection = requireProjectMotionInspector()({
      record: motionRecordFixture(),
      selectedKeyFrame: 5,
      railLocalFrame: 5,
    });
    expect(projection).not.toBeNull();
    if (projection === null) return;

    expect(projection.fields.map((field) => [field.channelId, field.present])).toEqual([
      ['position-x', true],
      ['position-y', true],
      ['scale', true],
      ['rotation', true],
      ['opacity', false],
    ]);
  });
});
