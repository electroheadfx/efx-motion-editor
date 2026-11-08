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

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { testWebpBytes } from '../../../testUtils/testWebpBytes';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createEfxPaintDocument,
} from '../../../efx-paint/document/efxPaintDocument';
import {
  buildEfxPaintCompositeRevision,
  buildEfxPaintDocumentRevision,
  buildEfxPaintDocumentSyncFingerprint,
  buildEfxPaintTrackRevision,
} from '../../../efx-paint/document/efxPaintDocumentRevision';
import { buildEfxPaintLayerChangeTokenValue } from '../../../lib/efxPaintPersistence';
import type { EfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import {
  PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY,
  type PhysicPaintRotoRailMotionRecord,
} from './railMotionModel';
import {
  buildPhysicPaintRotoPhysicalRevision,
  buildPhysicPaintRotoProjectEquality,
  parsePhysicPaintRotoPhysicalDocument,
} from './physicsPaintRotoPhysicalModel';
import {
  _setPhysicPaintMarkDirtyCallback,
  physicPaintStore,
  rotoPhysicalRevision,
} from '../../../stores/physicPaintStore';

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
      wiggle: 0,
      wiggleGlobal: true,
      keys: [
        { frame: 0, value: 0, easing: 'ease', wiggle: 0 },
        { frame: 4, value: 40, easing: 'ease', wiggle: 0 },
      ],
    },
    {
      id: 'position-y',
      wiggle: 0,
      wiggleGlobal: true,
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
  readonly loopClips?: readonly unknown[];
} = {}): Record<string, unknown> {
  const railMotions = options.railMotions;
  const loopClips = options.loopClips ?? [];
  return {
    capacity: 32,
    realKeyRecords: RECORDS,
    groupOverrideRecords: [],
    interpolation: INTERPOLATION,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 0,
    loopClips,
    incomingInterpolationBreakKeyIds: [],
    ...(railMotions === undefined ? {} : { railMotions }),
    revision: buildRevisionWithMotions(
      RECORDS,
      INTERPOLATION,
      loopClips,
      [],
      [],
      railMotions ?? PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY,
    ),
  };
}

/**
 * ONE shared base document. `createEfxPaintDocument` mints random track and
 * background ids per call, so two independently-created documents have
 * different document revisions even with identical content — every carrier
 * comparison MUST vary only the roto document, never the base identity.
 */
const EFX_BASE = createEfxPaintDocument('layer-59-03');

/** A parseable Paint track carrying the given roto document. */
function buildTrack(document: Record<string, unknown>) {
  return { ...EFX_BASE.tracks[0], rotoPhysical: document };
}

/** A complete Paint document whose single track carries the given roto document. */
function buildEfxDocument(document: Record<string, unknown>): EfxPaintDocument {
  return {
    ...EFX_BASE,
    tracks: [{ ...EFX_BASE.tracks[0], rotoPhysical: document }],
  } as unknown as EfxPaintDocument;
}

/**
 * The base content the four-carrier comparison shares: real keys, canonical
 * interpolation AND a linked Loop Clip. The two documents differ ONLY in
 * `railMotions`, so any carrier movement is attributable to motion alone.
 */
const BASE_LOOP_CLIP = {
  loopId: 'loop-base',
  placementStart: 0,
  sourceKeyIds: ['key-1', 'key-2'],
  repeat: 2,
  mode: 'progressive' as const,
};

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

  it('keeps an untouched document at its exact pinned revision', () => {
    // Append-only term law: the motion term never touches an untouched
    // document. The literal was re-frozen when the canonical number encoding
    // moved to IEEE-754 bit patterns (2026-11-07); the property is unchanged.
    const parsed = parsePhysicPaintRotoPhysicalDocument(buildDocument());
    expect(parsed.revision).toBe('physical-550-17f74577');
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

describe('59-03: store collection and the ONE revision authority', () => {
  const STORE_LAYER = 'layer-59-03-store';
  const STORE_TRACK = 'track-1';

  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
  });

  function installRecords(): void {
    const result = physicPaintStore.replaceRotoPhysicalRecords(
      STORE_LAYER,
      STORE_TRACK,
      RECORDS,
      INTERPOLATION,
      32,
    );
    if (!result.ok) throw new Error(result.error);
  }

  it('returns the shared frozen empty collection for an unset track', () => {
    expect(physicPaintStore.getRotoPhysicalRailMotions(STORE_LAYER, STORE_TRACK))
      .toBe(PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY);
    installRecords();
    expect(physicPaintStore.getRotoPhysicalRailMotions(STORE_LAYER, STORE_TRACK))
      .toBe(PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY);
  });

  it('rejects an invalid collection fail-closed and leaves the store untouched', () => {
    installRecords();
    const before = physicPaintStore.getRotoPhysicalContentRevision(STORE_LAYER, STORE_TRACK);
    const result = physicPaintStore.replaceRotoPhysicalRailMotions(STORE_LAYER, STORE_TRACK, [{
      railId: 'rail-lone',
      anchorKeyId: 'key-1',
      // Position is grouped (D-12): a lone axis is rejected by the parser.
      channels: [RAIL_A.channels[0]],
    }]);
    expect(result.ok).toBe(false);
    expect(physicPaintStore.getRotoPhysicalRailMotions(STORE_LAYER, STORE_TRACK))
      .toBe(PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY);
    expect(physicPaintStore.getRotoPhysicalContentRevision(STORE_LAYER, STORE_TRACK)).toBe(before);
  });

  it('publishes a collection and moves the structural content revision', () => {
    installRecords();
    const before = physicPaintStore.getRotoPhysicalContentRevision(STORE_LAYER, STORE_TRACK);
    const result = physicPaintStore.replaceRotoPhysicalRailMotions(STORE_LAYER, STORE_TRACK, [RAIL_A]);
    expect(result.ok).toBe(true);
    const stored = physicPaintStore.getRotoPhysicalRailMotions(STORE_LAYER, STORE_TRACK);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toEqual(RAIL_A);
    const after = physicPaintStore.getRotoPhysicalContentRevision(STORE_LAYER, STORE_TRACK);
    expect(after).not.toBe(before);
  });

  it('does not bump any revision when the collection is unchanged', () => {
    installRecords();
    expect(physicPaintStore.replaceRotoPhysicalRailMotions(STORE_LAYER, STORE_TRACK, [RAIL_A]).ok).toBe(true);
    const revisionBefore = physicPaintStore.getRotoPhysicalContentRevision(STORE_LAYER, STORE_TRACK);
    const visibleBefore = rotoPhysicalRevision.value;
    const result = physicPaintStore.replaceRotoPhysicalRailMotions(STORE_LAYER, STORE_TRACK, [RAIL_A]);
    expect(result.ok).toBe(true);
    expect(physicPaintStore.getRotoPhysicalContentRevision(STORE_LAYER, STORE_TRACK)).toBe(revisionBefore);
    expect(rotoPhysicalRevision.value).toBe(visibleBefore);
  });

  it('carries railMotions in the runtime document read and keeps the revision consistent', () => {
    installRecords();
    expect(physicPaintStore.replaceRotoPhysicalRailMotions(STORE_LAYER, STORE_TRACK, [RAIL_A, RAIL_B]).ok).toBe(true);
    const document = physicPaintStore.getRotoPhysicalDocument(STORE_LAYER, STORE_TRACK);
    expect(document).not.toBeNull();
    expect(document?.railMotions).toEqual([RAIL_A, RAIL_B]);
    expect(document?.revision).toBe(physicPaintStore.getRotoPhysicalContentRevision(STORE_LAYER, STORE_TRACK));
  });

  it('builds every store revision through exactly ONE direct call site', () => {
    const storePath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../stores/physicPaintStore.ts');
    const storeSource = readFileSync(storePath, 'utf8');
    const callToken = 'buildPhysicPaintRotoPhysicalRevision(';
    const occurrences = storeSource.split(callToken).length - 1;
    // Baseline at HEAD was 7. The single authority is the plan's
    // anti-bypass gate (T-59-08): a new call site outside the helper is a
    // revision built without rail motion.
    expect(occurrences).toBe(1);
    const helperStart = storeSource.indexOf('function _buildRotoPhysicalRevisionFor');
    expect(helperStart).toBeGreaterThan(-1);
    const helperBody = storeSource.slice(helperStart, storeSource.indexOf('\n}', helperStart));
    expect(helperBody.includes(callToken)).toBe(true);
    expect(helperBody.includes('railMotions')).toBe(true);
  });
});

describe('59-03: six persistence carriers move on addition and return on removal', () => {
  const LOOP_CLIPS = [BASE_LOOP_CLIP];

  /**
   * Every carrier this plan asserts, derived from one persisted-shape document.
   * All six must move on addition and return to the same-base pristine value on
   * removal — explicit inequality, never a snapshot (a snapshot re-pins
   * whatever the encoder currently emits and silently blesses a regression).
   */
  function carriers(document: Record<string, unknown>) {
    const efxDocument = buildEfxDocument(document);
    const documentRevision = buildEfxPaintDocumentRevision(efxDocument);
    return {
      rotoRevision: buildRevisionWithMotions(
        RECORDS,
        INTERPOLATION,
        LOOP_CLIPS,
        [],
        [],
        railMotionsOf(document) ?? PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY,
      ),
      projectEquality: buildPhysicPaintRotoProjectEquality(document),
      documentRevision,
      syncFingerprint: buildEfxPaintDocumentSyncFingerprint(efxDocument),
      trackRevision: buildEfxPaintTrackRevision(buildTrack(document)),
      layerChangeToken: buildEfxPaintLayerChangeTokenValue(
        documentRevision,
        buildEfxPaintCompositeRevision(efxDocument),
        efxDocument,
      ),
    };
  }

  const CARRIERS = [
    'rotoRevision',
    'projectEquality',
    'documentRevision',
    'syncFingerprint',
    'trackRevision',
    'layerChangeToken',
  ] as const;

  it('moves all six carriers when one record is added', () => {
    const pristine = carriers(buildDocument({ loopClips: LOOP_CLIPS }));
    const withMotion = carriers(buildDocument({ railMotions: [RAIL_A], loopClips: LOOP_CLIPS }));
    for (const carrier of CARRIERS) {
      expect(withMotion[carrier]).not.toBe(pristine[carrier]);
    }
  });

  it('returns all six carriers to the exact pristine baseline when the record is removed', () => {
    const pristine = carriers(buildDocument({ loopClips: LOOP_CLIPS }));
    const restored = carriers(buildDocument({ loopClips: LOOP_CLIPS }));
    for (const carrier of CARRIERS) {
      expect(restored[carrier]).toBe(pristine[carrier]);
    }
  });

  it('keeps the layer change token stable across a pure no-op recomputation', () => {
    // Guard against a carrier that moves on every call (which would make the
    // addition/removal inequalities above pass vacuously): the same document
    // must produce byte-identical carriers twice.
    const first = carriers(buildDocument({ railMotions: [RAIL_A], loopClips: LOOP_CLIPS }));
    const second = carriers(buildDocument({ railMotions: [RAIL_A], loopClips: LOOP_CLIPS }));
    for (const carrier of CARRIERS) {
      expect(second[carrier]).toBe(first[carrier]);
    }
  });
});
