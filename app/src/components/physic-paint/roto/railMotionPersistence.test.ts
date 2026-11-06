/**
 * Phase 59-03: rail-motion persistence pins (MOTN-12 / REL-02 / REL-03).
 *
 * The plan's four defect classes are pinned here, in the order the canonical
 * carrier chain runs:
 *
 *   1. document shape + parser routing (`railMotions` absent, empty, present)
 *   2. the conditional canonical term, inserted after `loops:` and before
 *      `incoming-breaks:` — an empty collection contributes NOTHING, so every
 *      pre-Phase-59 document keeps its exact revision
 *   3. the store collection and the ONE revision authority
 *      (`_buildRotoPhysicalRevisionFor`)
 *   4. all six persistence carriers move on addition and return on removal
 *
 * Every carrier assertion is an explicit inequality against a same-base
 * document, never a snapshot: a snapshot would re-pin whatever the encoder
 * currently emits and silently bless a regression.
 *
 * TDD RED note: the 6th `railMotions` content parameter and the parsed
 * document member are introduced by this plan. The two duck-typed accessors
 * below keep the RED run failing on the planned assertions (the extra argument
 * is ignored by the current implementation, the member is absent from the
 * parsed document) instead of on a TypeScript excess-argument error — the
 * `efxPaintDocumentRevision.test.ts` audios-pin precedent uses the same
 * boundary cast.
 */

import { testWebpBytes } from '../../../testUtils/testWebpBytes';
import { describe, expect, it } from 'vitest';
import {
  createEfxPaintDocument,
} from '../../../efx-paint/document/efxPaintDocument';
import {
  buildEfxPaintTrackRevision,
} from '../../../efx-paint/document/efxPaintDocumentRevision';
import {
  PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY,
  type PhysicPaintRotoRailMotionRecord,
} from './railMotionModel';
import {
  buildPhysicPaintRotoPhysicalRevision,
  buildPhysicPaintRotoProjectEquality,
  parsePhysicPaintRotoPhysicalDocument,
} from './physicsPaintRotoPhysicalModel';

const INTERPOLATION = Object.freeze({ enabled: false, mode: 'duplicate' as const });

/** A valid runtime real-key record pair: the carrier test's base content. */
const keyRecord = (keyId: string, appFrame: number) => ({
  kind: 'real-key' as const,
  keyId,
  appFrame,
  payload: {
    frameIndex: appFrame,
    appFrame,
    bytes: testWebpBytes(keyId),
    width: 10,
    height: 10,
  },
});

const RECORDS = [keyRecord('key-1', 0), keyRecord('key-2', 4)];

/**
 * One canonical rail-motion record. Grouped Position is present as a pair with
 * an identical frame set (D-12), which is what the parser enforces.
 */
const motionRecord = (railId: string, anchorKeyId: string): PhysicPaintRotoRailMotionRecord => ({
  railId,
  anchorKeyId,
  channels: [
    {
      id: 'position-x',
      keys: [
        { frame: 0, value: 0, easing: 'ease', wiggle: 0 },
        { frame: 4, value: 40, easing: 'ease', wiggle: 0 },
      ],
    },
    {
      id: 'position-y',
      keys: [
        { frame: 0, value: 0, easing: 'ease', wiggle: 0 },
        { frame: 4, value: -20, easing: 'ease', wiggle: 0 },
      ],
    },
  ],
});

const RAIL_A = motionRecord('rail-a', 'key-1');
const RAIL_B = motionRecord('rail-b', 'key-2');

type RailMotionRevisionBuilder = (
  records: unknown,
  interpolation: unknown,
  loopClips: unknown,
  incomingInterpolationBreakKeyIds?: unknown,
  groupOverrideRecords?: unknown,
  railMotions?: unknown,
) => string;

/** The 6th content parameter this plan appends (see the file header note). */
const buildRevisionWithMotions = buildPhysicPaintRotoPhysicalRevision as unknown as RailMotionRevisionBuilder;

/** Read the additive document member (absent until this plan's GREEN). */
const railMotionsOf = (document: unknown): readonly PhysicPaintRotoRailMotionRecord[] | undefined =>
  (document as { readonly railMotions?: readonly PhysicPaintRotoRailMotionRecord[] }).railMotions;

/**
 * A persisted-shape document whose revision is the canonical revision OF the
 * given collection. `railMotions` is omitted entirely when undefined so the
 * pristine baseline is byte-identical to a pre-Phase-59 document.
 */
function buildDocument(options: {
  readonly railMotions?: readonly PhysicPaintRotoRailMotionRecord[];
} = {}): Record<string, unknown> {
  const railMotions = options.railMotions;
  return {
    capacity: 32,
    realKeyRecords: RECORDS,
    groupOverrideRecords: [],
    interpolation: INTERPOLATION,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 0,
    loopClips: [],
    incomingInterpolationBreakKeyIds: [],
    ...(railMotions === undefined ? {} : { railMotions }),
    revision: buildRevisionWithMotions(
      RECORDS,
      INTERPOLATION,
      [],
      [],
      [],
      railMotions ?? PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY,
    ),
  };
}

/** A parseable Paint track carrying the given roto document. */
function buildTrack(document: Record<string, unknown>) {
  const base = createEfxPaintDocument('layer-59-03').tracks[0];
  return { ...base, rotoPhysical: document };
}

describe('59-03: document allowlist and parser routing', () => {
  it('defaults an absent railMotions member to the frozen empty collection', () => {
    const parsed = parsePhysicPaintRotoPhysicalDocument(buildDocument());
    expect(railMotionsOf(parsed)).toBe(PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY);
  });

  it('accepts an explicit empty railMotions array as the shared empty collection', () => {
    const parsed = parsePhysicPaintRotoPhysicalDocument(buildDocument({ railMotions: [] }));
    expect(railMotionsOf(parsed)).toBe(PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY);
  });

  it('accepts a valid non-empty collection and freezes every level', () => {
    const parsed = parsePhysicPaintRotoPhysicalDocument(buildDocument({ railMotions: [RAIL_A] }));
    const railMotions = railMotionsOf(parsed);
    expect(railMotions).toHaveLength(1);
    expect(railMotions?.[0]).toEqual(RAIL_A);
    expect(Object.isFrozen(railMotions)).toBe(true);
    expect(Object.isFrozen(railMotions?.[0])).toBe(true);
    expect(Object.isFrozen(railMotions?.[0].channels)).toBe(true);
    expect(Object.isFrozen(railMotions?.[0].channels[0].keys)).toBe(true);
  });

  it('rejects a document whose railMotions changed without recomputing the revision', () => {
    // A valid, in-domain value edit — the parser must reject it on the
    // revision, not on the value domain or a duplicate frame.
    const tampered = buildDocument({ railMotions: [RAIL_A] });
    tampered.railMotions = [{
      ...RAIL_A,
      channels: RAIL_A.channels.map((channel) => (channel.id === 'position-x'
        ? { ...channel, keys: channel.keys.map((key) => (key.frame === 4 ? { ...key, value: 25 } : key)) }
        : channel)),
    }];
    expect(() => parsePhysicPaintRotoPhysicalDocument(tampered)).toThrow(/canonical revision mismatch/);
  });
});

describe('59-03: conditional canonical rail-motions term', () => {
  it('adds nothing when the collection is empty (append-only 6th parameter)', () => {
    const fiveParameter = buildPhysicPaintRotoPhysicalRevision(RECORDS, INTERPOLATION, []);
    const sixParameter = buildRevisionWithMotions(
      RECORDS,
      INTERPOLATION,
      [],
      [],
      [],
      PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY,
    );
    expect(sixParameter).toBe(fiveParameter);
  });

  it('contributes exactly one term when the collection is non-empty', () => {
    const without = buildRevisionWithMotions(
      RECORDS,
      INTERPOLATION,
      [],
      [],
      [],
      PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY,
    );
    const withMotion = buildRevisionWithMotions(RECORDS, INTERPOLATION, [], [], [], [RAIL_A]);
    expect(withMotion).not.toBe(without);
  });

  it('sorts records by railId so input array order never changes the revision', () => {
    const forward = buildRevisionWithMotions(RECORDS, INTERPOLATION, [], [], [], [RAIL_A, RAIL_B]);
    const reverse = buildRevisionWithMotions(RECORDS, INTERPOLATION, [], [], [], [RAIL_B, RAIL_A]);
    const empty = buildRevisionWithMotions(RECORDS, INTERPOLATION, [], [], [], []);
    // Guard: the collection is revision-visible at all — otherwise the order
    // assertion below would pass vacuously.
    expect(forward).not.toBe(empty);
    expect(reverse).toBe(forward);
  });

  it('keeps an untouched document at its exact pre-Phase-59 revision', () => {
    // Pinned literal captured from the PRE-CHANGE encoder (append-only term
    // law): an untouched document must keep its exact revision, so every
    // existing project value is byte-identical after this plan.
    const parsed = parsePhysicPaintRotoPhysicalDocument(buildDocument());
    expect(parsed.revision).toBe('physical-404-c22673ae');
  });

  it('moves project equality when one record is added', () => {
    const without = buildPhysicPaintRotoProjectEquality(buildDocument());
    const withMotion = buildPhysicPaintRotoProjectEquality(buildDocument({ railMotions: [RAIL_A] }));
    expect(withMotion).not.toBe(without);
  });

  it('moves the Paint track revision when the collection moves', () => {
    const without = buildEfxPaintTrackRevision(buildTrack(buildDocument()));
    const withMotion = buildEfxPaintTrackRevision(buildTrack(buildDocument({ railMotions: [RAIL_A] })));
    expect(withMotion).not.toBe(without);
  });
});

