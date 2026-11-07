// ============================================================
//  59-01 (REL-02) — cross-language canonical parity, TypeScript half.
//
//  `app/src/lib/__fixtures__/railMotionCanonical.golden.json` is the ONLY
//  cross-language authority. Its `expectedSource` / `expectedProject` values
//  are frozen literals produced ONCE from the TypeScript encoder; the Rust
//  parity test consumes the same bytes through `include_str!`.
//
//  Never regenerate this fixture to make a failing parity test pass: a fixture
//  change must name which language moved and why.
// ============================================================

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildPhysicPaintRotoPhysicalRevision,
  buildPhysicPaintRotoProjectEquality,
  buildPhysicPaintRotoProjectEqualitySource,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';

interface GoldenDocument {
  readonly name: string;
  readonly document: unknown;
  readonly expectedSource: string;
  readonly expectedProject: string;
}

interface GoldenFixture {
  readonly version: number;
  readonly documents: readonly GoldenDocument[];
}

const FIXTURE = JSON.parse(
  readFileSync(new URL('./__fixtures__/railMotionCanonical.golden.json', import.meta.url), 'utf8'),
) as GoldenFixture;

/**
 * 59-24 (WR-05): the ordering document's raw shape. Every canonical collection
 * carries two mixed-case ids, so a code-unit encoder and an ICU-collation
 * encoder disagree about all four sorts. The bytes payloads are the two the
 * `rail-motion-empty` entry already freezes.
 */
const ORDERING_RECORDS = [
  { kind: 'real-key', keyId: 'B', appFrame: 0, payload: { frameIndex: 0, appFrame: 0, bytes: 'UklGRhgAAABXRUJQVlA4TC8AAAAAAAAA', width: 2, height: 2 } },
  { kind: 'real-key', keyId: 'a', appFrame: 8, payload: { frameIndex: 8, appFrame: 8, bytes: 'UklGRhwAAABXRUJQVlA4TC8BAAAAAAAAAKo=', width: 2, height: 2 } },
] as const;

const ORDERING_INTERPOLATION = { enabled: false, mode: 'duplicate' } as const;

/** The two clips, lifecycle-less (TS resolves it) or in the persisted shape. */
function orderingLoopClips(explicitLifecycle: boolean): unknown[] {
  const base = [
    { loopId: 'Rail_B', placementStart: 0, sourceKeyIds: ['B'], repeat: 1, mode: 'progressive' },
    { loopId: 'rail-a', placementStart: 8, sourceKeyIds: ['a'], repeat: 1, mode: 'progressive' },
  ];
  return base.map((clip) => (explicitLifecycle
    ? {
        ...clip,
        syncState: 'synchronized',
        provenanceState: 'attached',
        phaseOrigin: clip.placementStart,
        originalEndExclusive: clip.placementStart + clip.sourceKeyIds.length * clip.repeat,
        visibleRanges: [{
          start: clip.placementStart,
          endExclusive: clip.placementStart + clip.sourceKeyIds.length * clip.repeat,
        }],
        frameOverrides: [],
      }
    : clip));
}

// `position-x` and `position-y` are a paired axis in the motion model (a lone
// `position-x` is refused), so `Rail_B` carries the pair at one shared frame.
const ORDERING_RAIL_MOTIONS = [
  {
    railId: 'Rail_B',
    anchorKeyId: 'B',
    channels: [
      { id: 'position-x', keys: [{ frame: 0, value: 0, easing: 'ease', wiggle: 0 }] },
      { id: 'position-y', keys: [{ frame: 0, value: 0, easing: 'ease', wiggle: 0 }] },
    ],
  },
  { railId: 'rail-a', anchorKeyId: 'a', channels: [{ id: 'opacity', keys: [{ frame: 0, value: 0.5, easing: 'ease', wiggle: 0 }] }] },
] as const;

function orderingDocument(explicitLifecycle: boolean): unknown {
  const loopClips = orderingLoopClips(explicitLifecycle);
  const incomingInterpolationBreakKeyIds = ['B', 'a'];
  return {
    capacity: 24,
    realKeyRecords: ORDERING_RECORDS,
    interpolation: ORDERING_INTERPOLATION,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 0,
    revision: buildPhysicPaintRotoPhysicalRevision(
      ORDERING_RECORDS,
      ORDERING_INTERPOLATION,
      loopClips,
      incomingInterpolationBreakKeyIds,
      [],
      ORDERING_RAIL_MOTIONS,
    ),
    loopClips,
    railMotions: ORDERING_RAIL_MOTIONS,
    incomingInterpolationBreakKeyIds,
  };
}

/** Slice one canonical term out of the project-equality source. */
function canonicalTerm(source: string, name: string, nextName: string | null): string {
  const start = source.indexOf(`${name}:`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = nextName === null ? source.length : source.indexOf(`${nextName}:`, start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('rail motion canonical parity (TS half)', () => {
  it('carries the frozen cross-language documents', () => {
    expect(FIXTURE.version).toBe(1);
    // Joined on purpose: a missing/extra document then reports as one
    // single-line diff instead of a truncated array dump.
    expect(FIXTURE.documents.map((entry) => entry.name).join('|')).toBe([
      'rail-kind',
      'untouched',
      'rail-kind-script',
      'rail-motion',
      'rail-motion-empty',
      'rail-motion-ordering',
      'rail-motion-exponent',
    ].join('|'));
  });

  it.each(FIXTURE.documents.map((entry) => [entry.name, entry] as const))(
    'matches the frozen canonical source and project equality: %s',
    (_name, entry) => {
      expect(buildPhysicPaintRotoProjectEqualitySource(entry.document)).toBe(entry.expectedSource);
      expect(buildPhysicPaintRotoProjectEquality(entry.document)).toBe(entry.expectedProject);
    },
  );

  // 59-04 (MOTN-12): the rail-motion term occupies the ordinal reserved by
  // 59-01 and is emitted exactly once. Both languages assert this against the
  // same frozen literals; the Rust half additionally checks the ordinal on its
  // OWN computed source, so an insertion in the wrong branch cannot hide
  // behind a regenerated fixture.
  it('emits exactly one rail-motions term between loops and incoming-breaks', () => {
    const motion = FIXTURE.documents.find((entry) => entry.name === 'rail-motion');
    expect(motion).toBeDefined();
    const source = motion!.expectedSource;
    const occurrences = source.split('rail-motions:').length - 1;
    expect(occurrences).toBe(1);
    const loopsAt = source.indexOf('loops:');
    const motionsAt = source.indexOf('rail-motions:');
    const breaksAt = source.indexOf('incoming-breaks:');
    expect(loopsAt).toBeGreaterThanOrEqual(0);
    expect(breaksAt).toBeGreaterThanOrEqual(0);
    expect(loopsAt).toBeLessThan(motionsAt);
    expect(motionsAt).toBeLessThan(breaksAt);
  });

  // D-29 idiom: an empty rail-motion collection is semantically identical to a
  // pre-Phase-59 document with no railMotions member, so it contributes NO
  // term and every existing project value keeps its exact revision.
  it('encodes the empty motion collection byte-identically to the untouched document', () => {
    const untouched = FIXTURE.documents.find((entry) => entry.name === 'untouched');
    const empty = FIXTURE.documents.find((entry) => entry.name === 'rail-motion-empty');
    expect(untouched).toBeDefined();
    expect(empty).toBeDefined();
    expect(empty!.expectedSource).toBe(untouched!.expectedSource);
    expect(empty!.expectedProject).toBe(untouched!.expectedProject);
    expect(
      (empty!.document as { revision?: string }).revision,
    ).toBe((untouched!.document as { revision?: string }).revision);
  });

  // 261030-ey9 / 260921-c7x: the TS encoder resolves the lifecycle block
  // UNCONDITIONALLY, so a lifecycle-less finite clip and its normalized
  // counterpart are one document. Rust receives the normalized persisted shape
  // — a lifecycle-less raw document deliberately never reaches it, so this pin
  // is TypeScript-only and is NOT a fixture entry.
  it('normalizes a lifecycle-less finite clip to its explicit lifecycle project equality', () => {
    const realKeyRecords = [
      { kind: 'real-key', keyId: 'k1', appFrame: 0, payload: { frameIndex: 0, appFrame: 0, bytes: 'UklGRhgAAABXRUJQVlA4TC8AAAAAAAAA', width: 2, height: 2 } },
      { kind: 'real-key', keyId: 'k2', appFrame: 1, payload: { frameIndex: 1, appFrame: 1, bytes: 'UklGRhwAAABXRUJQVlA4TC8BAAAAAAAAAKo=', width: 2, height: 2 } },
    ];
    const interpolation = { enabled: false, mode: 'duplicate' as const };
    const lifecycleless = {
      loopId: 'loop-c',
      placementStart: 4,
      sourceKeyIds: ['k1', 'k2'],
      repeat: 2,
      mode: 'progressive' as const,
    };
    const explicit = {
      ...lifecycleless,
      syncState: 'synchronized' as const,
      provenanceState: 'attached' as const,
      phaseOrigin: 4,
      originalEndExclusive: 8,
      visibleRanges: [{ start: 4, endExclusive: 8 }],
      frameOverrides: [],
    };
    const documentWith = (loopClips: readonly unknown[]) => ({
      capacity: 24,
      realKeyRecords,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision(realKeyRecords, interpolation, loopClips),
      loopClips,
    });
    expect(buildPhysicPaintRotoProjectEquality(documentWith([lifecycleless]))).toBe(
      buildPhysicPaintRotoProjectEquality(documentWith([explicit])),
    );
  });

  // 59-24 (WR-05): every canonical collection orders ids by UTF-16 code unit,
  // matching Rust's `str::cmp` over UTF-8 bytes for the accepted id charset.
  // ICU collation reverses both pairs here ('a' before 'B', 'rail-a' before
  // 'Rail_B'), which made two revisions for one document. The in-memory
  // document keeps lifecycle-less clips on purpose: it never reaches Rust.
  it('orders every canonical collection by code unit for mixed-case ids', () => {
    const source = buildPhysicPaintRotoProjectEqualitySource(orderingDocument(false));

    const recordsTerm = canonicalTerm(source, 'records', 'interpolation');
    const recordsB = recordsTerm.indexOf('s1:B');
    const recordsA = recordsTerm.indexOf('s1:a');
    expect(recordsB).toBeGreaterThanOrEqual(0);
    expect(recordsA).toBeGreaterThanOrEqual(0);
    expect(recordsB).toBeLessThan(recordsA);

    const loopsTerm = canonicalTerm(source, 'loops', 'rail-motions');
    const loopsUpper = loopsTerm.indexOf('s6:Rail_B');
    const loopsLower = loopsTerm.indexOf('s6:rail-a');
    expect(loopsUpper).toBeGreaterThanOrEqual(0);
    expect(loopsLower).toBeGreaterThanOrEqual(0);
    expect(loopsUpper).toBeLessThan(loopsLower);

    const motionsTerm = canonicalTerm(source, 'rail-motions', 'incoming-breaks');
    const motionsUpper = motionsTerm.indexOf('s6:Rail_B');
    const motionsLower = motionsTerm.indexOf('s6:rail-a');
    expect(motionsUpper).toBeGreaterThanOrEqual(0);
    expect(motionsLower).toBeGreaterThanOrEqual(0);
    expect(motionsUpper).toBeLessThan(motionsLower);

    const breaksTerm = canonicalTerm(source, 'incoming-breaks', 'capacity');
    const breaksB = breaksTerm.indexOf('s1:B');
    const breaksA = breaksTerm.indexOf('s1:a');
    expect(breaksB).toBeGreaterThanOrEqual(0);
    expect(breaksA).toBeGreaterThanOrEqual(0);
    expect(breaksB).toBeLessThan(breaksA);
  });

  // 260921-c7x / 59-24 (T-59-68): the TS encoder resolves the lifecycle
  // block unconditionally, while the Rust encoder emits it only when
  // `syncState` is present. A shared fixture entry must therefore carry the
  // explicit persisted block on EVERY Loop Clip — this guard pins that shape
  // for every current and future entry, not only the ordering one.
  it('freezes the explicit persisted lifecycle block on every fixture Loop Clip', () => {
    const lifecycleMembers = [
      'syncState',
      'provenanceState',
      'phaseOrigin',
      'originalEndExclusive',
      'visibleRanges',
      'frameOverrides',
    ] as const;
    let inspected = 0;
    for (const entry of FIXTURE.documents) {
      const clips = (entry.document as { loopClips?: readonly Record<string, unknown>[] }).loopClips ?? [];
      for (const clip of clips) {
        inspected += 1;
        for (const member of lifecycleMembers) {
          expect(
            Object.prototype.hasOwnProperty.call(clip, member),
            `${entry.name}/${String(clip.loopId ?? clip.id ?? '?')} must carry ${member}`,
          ).toBe(true);
        }
      }
    }
    expect(inspected).toBe(6);

    const ordering = FIXTURE.documents.find((entry) => entry.name === 'rail-motion-ordering');
    expect(ordering).toBeDefined();
    const orderingClips = (ordering!.document as { loopClips: readonly Record<string, unknown>[] }).loopClips;
    expect(orderingClips).toEqual([
      {
        loopId: 'Rail_B',
        placementStart: 0,
        sourceKeyIds: ['B'],
        repeat: 1,
        mode: 'progressive',
        syncState: 'synchronized',
        provenanceState: 'attached',
        phaseOrigin: 0,
        originalEndExclusive: 1,
        visibleRanges: [{ start: 0, endExclusive: 1 }],
        frameOverrides: [],
      },
      {
        loopId: 'rail-a',
        placementStart: 8,
        sourceKeyIds: ['a'],
        repeat: 1,
        mode: 'progressive',
        syncState: 'synchronized',
        provenanceState: 'attached',
        phaseOrigin: 8,
        originalEndExclusive: 9,
        visibleRanges: [{ start: 8, endExclusive: 9 }],
        frameOverrides: [],
      },
    ]);
  });
});
