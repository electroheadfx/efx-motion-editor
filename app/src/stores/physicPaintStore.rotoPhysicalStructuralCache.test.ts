import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import {
  physicPaintStore,
  physicPaintVersion,
  rotoPhysicalRevision,
  _setPhysicPaintMarkDirtyCallback,
} from './physicPaintStore';
import * as physicalModelModule from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import * as physicalResolverModule from '../components/physic-paint/roto/physicsPaintRotoPhysicalResolver';
import type {
  PhysicPaintRotoPhysicalTimelineProjection,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalResolver';
import type {
  PhysicPaintRotoInterpolationState,
  PhysicPaintRotoRealKeyPayload,
  PhysicPaintRotoRealKeyRecord,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
// 46-01: runtime state is per-track; tests exercise the document's ACTIVE track.
const TEST_TRACK_ID = 'track-1';

// 38.1-07: per-layer structural memo for the physical projection + content
// revision. Per-navigation store reads must be O(1) in total key count
// (spy-proven zero recomputes on navigation/selection reads, exactly one
// byte-identical recompute per structural mutation class — 38.1-D-07/D-09).
// Node env, vitest run only; no jsdom, no config changes.

const LAYER = 'layer-structural-cache';
const CAPACITY = 24;
const INTERPOLATION = { enabled: true, mode: 'duplicate' } as const;

let revisionSpy: MockInstance;
let projectionSpy: MockInstance;

function payload(appFrame: number, tag = 'base'): PhysicPaintRotoRealKeyPayload {
  return {
    frameIndex: 0,
    appFrame,
    dataUrl: `data:image/png;base64,${btoa(`structural:${appFrame}:${tag}`)}`,
    width: 4,
    height: 4,
  };
}

function record(keyId: string, appFrame: number, tag = 'base'): PhysicPaintRotoRealKeyRecord {
  return { kind: 'real-key', keyId, appFrame, payload: payload(appFrame, tag) };
}

function baseRecords(): PhysicPaintRotoRealKeyRecord[] {
  return [record('key-a', 0), record('key-b', 6), record('key-c', 12)];
}

function installBase(): void {
  const result = physicPaintStore.replaceRotoPhysicalRecords(LAYER, TEST_TRACK_ID, baseRecords(), INTERPOLATION, CAPACITY);
  expect(result.ok).toBe(true);
}

function warmUp(): void {
  void physicPaintStore.getRotoPhysicalProjection(LAYER, TEST_TRACK_ID);
  void physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID);
}

function clearSpyCounts(): void {
  revisionSpy.mockClear();
  projectionSpy.mockClear();
}

/** Fresh compute over current store inputs (adds spy calls; clear afterwards). */
function freshStructural(): { projection: PhysicPaintRotoPhysicalTimelineProjection | null; revision: string } {
  const records = physicPaintStore.getRotoRealKeyRecords(LAYER, TEST_TRACK_ID);
  const capacity = physicPaintStore.getRotoPhysicalCapacity(LAYER, TEST_TRACK_ID);
  const interpolation: PhysicPaintRotoInterpolationState = physicPaintStore.getRotoPhysicalInterpolationState(LAYER, TEST_TRACK_ID);
  const incomingInterpolationBreakKeyIds = physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(LAYER, TEST_TRACK_ID);
  const result = physicalResolverModule.projectPhysicPaintRotoPhysicalTimeline({
    identities: records.map((entry) => ({ keyId: entry.keyId, appFrame: entry.appFrame })),
    capacity,
    interpolationEnabled: interpolation.enabled,
    incomingInterpolationBreakKeyIds,
  });
  const revision = physicalModelModule.buildPhysicPaintRotoPhysicalRevision(
    records,
    interpolation,
    [],
    incomingInterpolationBreakKeyIds,
  );
  return { projection: result.ok ? result.projection : null, revision };
}

/**
 * Post-mutation contract: the FIRST read recomputes exactly once (one
 * projection call + one revision call for the single cache entry), the
 * recomputed values are byte-identical to a fresh compute over current store
 * inputs (38.1-D-09), and every subsequent read is free with a stable
 * projection reference.
 */
function expectSingleByteIdenticalRecompute(label: string): void {
  const fresh = freshStructural();
  clearSpyCounts();

  const projection = physicPaintStore.getRotoPhysicalProjection(LAYER, TEST_TRACK_ID);
  expect(projectionSpy.mock.calls.length, `${label}: first read recomputes the projection exactly once`).toBe(1);
  expect(revisionSpy.mock.calls.length, `${label}: first read recomputes the revision exactly once`).toBe(1);
  const revision = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID);
  expect(projectionSpy.mock.calls.length, `${label}: revision read after projection read is free`).toBe(1);
  expect(revisionSpy.mock.calls.length, `${label}: revision read after projection read is free`).toBe(1);

  expect(projection, `${label}: cached projection is byte-identical to a fresh compute`).toEqual(fresh.projection);
  expect(revision, `${label}: cached revision is byte-identical to a fresh compute`).toBe(fresh.revision);

  clearSpyCounts();
  expect(physicPaintStore.getRotoPhysicalProjection(LAYER, TEST_TRACK_ID), `${label}: projection reference is stable`).toBe(projection);
  expect(physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)).toBe(revision);
  expect(projectionSpy.mock.calls.length, `${label}: subsequent reads add zero projection calls`).toBe(0);
  expect(revisionSpy.mock.calls.length, `${label}: subsequent reads add zero revision calls`).toBe(0);
}

describe('physicPaintStore roto physical structural cache (38.1-07)', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
    revisionSpy = vi.spyOn(physicalModelModule, 'buildPhysicPaintRotoPhysicalRevision');
    projectionSpy = vi.spyOn(physicalResolverModule, 'projectPhysicPaintRotoPhysicalTimeline');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('navigation reads across frames trigger zero structural recomputes and keep projection reference stability', () => {
    installBase();
    const first = physicPaintStore.getRotoPhysicalProjection(LAYER, TEST_TRACK_ID);
    expect(first).not.toBeNull();
    void physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID);
    // Sanity: the spies intercept the structural functions (38.1-01 D-07 idiom).
    expect(projectionSpy.mock.calls.length).toBeGreaterThan(0);
    expect(revisionSpy.mock.calls.length).toBeGreaterThan(0);
    clearSpyCounts();

    const frames = [0, 1, 2, 3, 5, 6, 7, 9, 12, 13, 15, 18, 20, 23, 4, 8, 10, 11, 14, 16, 17, 19, 21, 22, 0];
    let reads = 0;
    for (const frame of frames) {
      if (frame % 3 === 0) void physicPaintStore.getRotoPhysicalProjection(LAYER, TEST_TRACK_ID);
      else if (frame % 3 === 1) void physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID);
      else void physicPaintStore.getRotoPhysicalRenderSource(LAYER, TEST_TRACK_ID, frame);
      reads += 1;
    }
    expect(reads).toBe(25);

    expect(projectionSpy.mock.calls.length, 'navigation reads add zero projection recomputes').toBe(0);
    expect(revisionSpy.mock.calls.length, 'navigation reads add zero revision recomputes').toBe(0);
    expect(physicPaintStore.getRotoPhysicalProjection(LAYER, TEST_TRACK_ID)).toBe(first);

    // Render-source semantics preserved: real / generated / empty resolution.
    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, TEST_TRACK_ID, 0)?.kind).toBe('real');
    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, TEST_TRACK_ID, 3)?.kind).toBe('generated');
    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, TEST_TRACK_ID, 20)).toBeNull();
  });

  it('add key recomputes exactly once with byte-identical output', () => {
    installBase();
    warmUp();
    const result = physicPaintStore.replaceRotoPhysicalRecords(LAYER, TEST_TRACK_ID, [...baseRecords(), record('key-d', 18)], INTERPOLATION, CAPACITY);
    expect(result.ok).toBe(true);
    expectSingleByteIdenticalRecompute('add key');
  });

  it('delete key recomputes exactly once with byte-identical output', () => {
    installBase();
    warmUp();
    const result = physicPaintStore.replaceRotoPhysicalRecords(LAYER, TEST_TRACK_ID, [record('key-a', 0), record('key-b', 6)], INTERPOLATION, CAPACITY);
    expect(result.ok).toBe(true);
    expectSingleByteIdenticalRecompute('delete key');
  });

  it('move key recomputes exactly once with byte-identical output', () => {
    installBase();
    warmUp();
    const result = physicPaintStore.replaceRotoPhysicalRecords(LAYER, TEST_TRACK_ID, [record('key-a', 0), record('key-b', 8), record('key-c', 12)], INTERPOLATION, CAPACITY);
    expect(result.ok).toBe(true);
    expectSingleByteIdenticalRecompute('move key');
  });

  it('payload write recomputes exactly once with byte-identical output', () => {
    installBase();
    warmUp();
    const expected = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID);
    expect(expected).toBeTruthy();
    const result = physicPaintStore.updateRotoPhysicalRealKeyPayload(LAYER, TEST_TRACK_ID, 'key-a', expected!, payload(0, 'painted'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.changed).toBe(true);
    expectSingleByteIdenticalRecompute('payload write');
  });

  it('interpolation change recomputes exactly once with byte-identical output', () => {
    installBase();
    warmUp();
    const result = physicPaintStore.setRotoPhysicalInterpolationState(LAYER, TEST_TRACK_ID, { enabled: false, mode: 'duplicate' });
    expect(result.ok).toBe(true);
    expectSingleByteIdenticalRecompute('interpolation change');
  });

  it('undo/redo record restoration recomputes exactly once per publish with byte-identical output', () => {
    installBase();
    warmUp();
    const priorRecords = physicPaintStore.getRotoRealKeyRecords(LAYER, TEST_TRACK_ID);
    const priorInterpolation = physicPaintStore.getRotoPhysicalInterpolationState(LAYER, TEST_TRACK_ID);
    const priorRevision = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID);

    const added = physicPaintStore.replaceRotoPhysicalRecords(LAYER, TEST_TRACK_ID, [...priorRecords, record('key-d', 18)], priorInterpolation, CAPACITY);
    expect(added.ok).toBe(true);
    expectSingleByteIdenticalRecompute('mutation before undo');

    // The undo/redo publish path (rotoMoveHistory drives
    // replacePhysicalRecordsWithOwnership -> replaceRotoPhysicalRecords).
    const undone = physicPaintStore.replaceRotoPhysicalRecords(LAYER, TEST_TRACK_ID, priorRecords, priorInterpolation, CAPACITY);
    expect(undone.ok).toBe(true);
    expectSingleByteIdenticalRecompute('undo restore');
    expect(physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)).toBe(priorRevision);
  });

  it('immutable break replacement recomputes once while stable identity and selection reads remain free', () => {
    installBase();
    warmUp();
    const beforeProjection = physicPaintStore.getRotoPhysicalProjection(LAYER, TEST_TRACK_ID);
    const current = physicPaintStore.getRotoPhysicalDocument(LAYER, TEST_TRACK_ID);
    expect(current).not.toBeNull();
    if (current === null) throw new Error('Base physical document must exist');
    const incomingInterpolationBreakKeyIds = Object.freeze(['key-b']);
    const replacement = {
      ...current,
      incomingInterpolationBreakKeyIds,
      revision: physicalModelModule.buildPhysicPaintRotoPhysicalRevision(
        current.realKeyRecords,
        current.interpolation,
        current.loopClips,
        incomingInterpolationBreakKeyIds,
      ),
    };

    expect(physicPaintStore.replaceRotoPhysicalDocument(LAYER, TEST_TRACK_ID, replacement).ok).toBe(true);
    clearSpyCounts();
    const afterProjection = physicPaintStore.getRotoPhysicalProjection(LAYER, TEST_TRACK_ID);
    expect(afterProjection).not.toBe(beforeProjection);
    expect(afterProjection?.generatedCells.some((cell) => cell.kind === 'generated' && cell.rightKeyId ==='key-b')).toBe(false);
    expect(projectionSpy.mock.calls.length).toBe(1);
    expect(revisionSpy.mock.calls.length).toBe(1);
    const installedBreaks = physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(LAYER, TEST_TRACK_ID);

    clearSpyCounts();
    expect(physicPaintStore.getRotoPhysicalProjection(LAYER, TEST_TRACK_ID)).toBe(afterProjection);
    expect(physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(LAYER, TEST_TRACK_ID)).toBe(installedBreaks);
    expect(physicPaintStore.setRotoPhysicalSelection(LAYER, TEST_TRACK_ID, null, 3).ok).toBe(true);
    expect(physicPaintStore.getRotoPhysicalProjection(LAYER, TEST_TRACK_ID)).toBe(afterProjection);
    expect(projectionSpy.mock.calls.length).toBe(0);
    expect(revisionSpy.mock.calls.length).toBe(0);

    expect(physicPaintStore.setRotoPhysicalInterpolationState(LAYER, TEST_TRACK_ID, { enabled: false, mode: 'duplicate' }).ok).toBe(true);
    expect(physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(LAYER, TEST_TRACK_ID)).toBe(installedBreaks);
    expect(physicPaintStore.getRotoPhysicalProjection(LAYER, TEST_TRACK_ID)?.generatedCells).toEqual([]);
  });

  it('selection writes never invalidate the structural cache', () => {
    installBase();
    warmUp();
    clearSpyCounts();

    expect(physicPaintStore.setRotoPhysicalSelection(LAYER, TEST_TRACK_ID, 'key-b', 6).ok).toBe(true);
    expect(physicPaintStore.setRotoPhysicalSelection(LAYER, TEST_TRACK_ID, null, 3).ok).toBe(true);
    void physicPaintStore.getRotoPhysicalProjection(LAYER, TEST_TRACK_ID);
    void physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID);
    void physicPaintStore.getRotoPhysicalRenderSource(LAYER, TEST_TRACK_ID, 6);

    expect(projectionSpy.mock.calls.length, 'selection writes add zero projection recomputes').toBe(0);
    expect(revisionSpy.mock.calls.length, 'selection writes add zero revision recomputes').toBe(0);
  });

  it('preserves absent-layer null semantics and projects present zero-record layers', () => {
    expect(physicPaintStore.getRotoPhysicalProjection('absent-layer', TEST_TRACK_ID)).toBeNull();
    expect(physicPaintStore.getRotoPhysicalContentRevision('absent-layer', TEST_TRACK_ID)).toBeNull();
    expect(physicPaintStore.getRotoPhysicalRenderSource('absent-layer', TEST_TRACK_ID, 0)).toBeNull();

    const installed = physicPaintStore.replaceRotoPhysicalRecords(LAYER, TEST_TRACK_ID, [], { enabled: false, mode: 'duplicate' }, CAPACITY);
    expect(installed.ok).toBe(true);
    const projection = physicPaintStore.getRotoPhysicalProjection(LAYER, TEST_TRACK_ID);
    expect(projection, 'a layer present with zero records still projects').not.toBeNull();
    expect(physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)).toEqual(expect.stringMatching(/^physical-/));

    clearSpyCounts();
    expect(physicPaintStore.getRotoPhysicalProjection(LAYER, TEST_TRACK_ID)).toBe(projection);
    expect(projectionSpy.mock.calls.length).toBe(0);
    expect(revisionSpy.mock.calls.length).toBe(0);
  });

  it('capacity-only replacement clamps the cursor, replaces the projection, and publishes once', () => {
    installBase();
    expect(physicPaintStore.setRotoPhysicalSelection(LAYER, TEST_TRACK_ID, null, 20).ok).toBe(true);
    const beforeProjection = physicPaintStore.getRotoPhysicalProjection(LAYER, TEST_TRACK_ID);
    expect(beforeProjection?.cells).toHaveLength(24);

    let dirtyCount = 0;
    _setPhysicPaintMarkDirtyCallback(() => { dirtyCount += 1; });
    const beforePhysicalRevision = rotoPhysicalRevision.value;
    const beforeVisualVersion = physicPaintVersion.value;

    const replaced = physicPaintStore.replaceRotoPhysicalRecords(LAYER, TEST_TRACK_ID, baseRecords(), INTERPOLATION, 13);
    expect(replaced.ok).toBe(true);
    expect(physicPaintStore.getRotoPhysicalCapacity(LAYER, TEST_TRACK_ID)).toBe(13);
    expect(physicPaintStore.getRotoPhysicalDocument(LAYER, TEST_TRACK_ID)?.cursorAppFrame).toBe(12);
    const afterProjection = physicPaintStore.getRotoPhysicalProjection(LAYER, TEST_TRACK_ID);
    expect(afterProjection).not.toBe(beforeProjection);
    expect(afterProjection?.cells).toHaveLength(13);
    expect(rotoPhysicalRevision.value).toBe(beforePhysicalRevision + 1);
    expect(physicPaintVersion.value).toBe(beforeVisualVersion + 1);
    expect(dirtyCount).toBe(1);

    const exactPhysicalRevision = rotoPhysicalRevision.value;
    const exactVisualVersion = physicPaintVersion.value;
    const exactNoop = physicPaintStore.replaceRotoPhysicalRecords(LAYER, TEST_TRACK_ID, baseRecords(), INTERPOLATION, 13);
    expect(exactNoop.ok).toBe(true);
    expect(physicPaintStore.getRotoPhysicalProjection(LAYER, TEST_TRACK_ID)).toBe(afterProjection);
    expect(rotoPhysicalRevision.value).toBe(exactPhysicalRevision);
    expect(physicPaintVersion.value).toBe(exactVisualVersion);
    expect(dirtyCount).toBe(1);
  });

  it('no-op record replacement keeps reads free', () => {
    installBase();
    warmUp();
    const before = physicPaintStore.getRotoPhysicalProjection(LAYER, TEST_TRACK_ID);

    const noop = physicPaintStore.replaceRotoPhysicalRecords(LAYER, TEST_TRACK_ID, baseRecords(), INTERPOLATION, CAPACITY);
    expect(noop.ok).toBe(true);

    clearSpyCounts();
    expect(physicPaintStore.getRotoPhysicalProjection(LAYER, TEST_TRACK_ID)).toBe(before);
    void physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID);
    expect(projectionSpy.mock.calls.length, 'no-op mutation keeps projection reads free').toBe(0);
    expect(revisionSpy.mock.calls.length, 'no-op mutation keeps revision reads free').toBe(0);
  });

  it('getRotoPhysicalDocument reads the memoized revision', () => {
    installBase();
    warmUp();
    const expected = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID);

    clearSpyCounts();
    const document = physicPaintStore.getRotoPhysicalDocument(LAYER, TEST_TRACK_ID);
    expect(document?.revision).toBe(expected);
    expect(revisionSpy.mock.calls.length, 'document revision read adds zero revision recomputes').toBe(0);
  });
});
