import { beforeEach, describe, expect, it } from 'vitest';
import {
  physicPaintStore,
  rotoPhysicalRevision,
  physicPaintVersion,
  _setPhysicPaintMarkDirtyCallback,
} from './physicPaintStore';
import type {
  PhysicPaintRotoLoopClip,
  PhysicPaintRotoRealKeyPayload,
  PhysicPaintRotoRealKeyRecord,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';

// Phase 43 Plan 03: store-level linked Loop Clip resolution. The canonical
// getRotoPhysicalRenderSource seam resolves linked repetition frames to the
// SOURCE key's rendered payload under a source-scoped cache revision (D-26,
// D-27 — one source cache entry serves every occurrence), surfaces the typed
// 'linked-unresolved' contract instead of blanking (audit finding 3), makes
// the end-frame read loop-aware from the interval derivation only (Pitfall 3),
// and exposes the unresolved-loop query the export preflight consumes (D-28).
// Node env, vitest run only; no jsdom, no config changes.

const LAYER = 'layer-roto-loop-clips';
const CAPACITY = 30;
const INTERPOLATION = { enabled: false, mode: 'duplicate' } as const;

function payload(appFrame: number, tag = 'base'): PhysicPaintRotoRealKeyPayload {
  return {
    frameIndex: 0,
    appFrame,
    dataUrl: `data:image/png;base64,${btoa(`loop-store:${appFrame}:${tag}`)}`,
    width: 4,
    height: 4,
  };
}

function record(keyId: string, appFrame: number, tag = 'base'): PhysicPaintRotoRealKeyRecord {
  return { kind: 'real-key', keyId, appFrame, payload: payload(appFrame, tag) };
}

function loopClip(
  loopId: string,
  placementStart: number,
  sourceKeyIds: readonly string[],
  repeat: number | 'infinity',
): PhysicPaintRotoLoopClip {
  return { loopId, placementStart, sourceKeyIds, repeat, mode: 'progressive' };
}

/** The five consecutive source-cycle keys A..E at frames 0..4. */
function cycleRecords(): PhysicPaintRotoRealKeyRecord[] {
  return [record('A', 0), record('B', 1), record('C', 2), record('D', 3), record('E', 4)];
}

function installRecords(records: readonly PhysicPaintRotoRealKeyRecord[], capacity = CAPACITY): void {
  const result = physicPaintStore.replaceRotoPhysicalRecords(LAYER, records, INTERPOLATION, capacity);
  if (!result.ok) throw new Error(result.error);
}

function installLoops(loops: readonly PhysicPaintRotoLoopClip[]): void {
  const result = physicPaintStore.replaceRotoPhysicalLoopClips(LAYER, loops);
  if (!result.ok) throw new Error(result.error);
}

/** Narrowed 'real' render-source read — throws on null or any other kind. */
function expectRealSource(layerId: string, appFrame: number) {
  const source = physicPaintStore.getRotoPhysicalRenderSource(layerId, appFrame);
  if (!source || source.kind !== 'real') {
    throw new Error(`Expected a real render source at frame ${appFrame}, got ${source?.kind ?? 'null'}.`);
  }
  return source;
}

describe('linked-loop render-source branch (D-26/D-27)', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
  });

  it('resolves 25 timeline frames from a 5-frame cycle repeated 5 times with exactly 5 source-scoped cache identities', () => {
    installRecords(cycleRecords());
    installLoops([loopClip('loop-1', 0, ['A', 'B', 'C', 'D', 'E'], 5)]);
    const revision = physicPaintStore.getRotoPhysicalContentRevision(LAYER);
    expect(revision).toBeTruthy();

    const keyIds = ['A', 'B', 'C', 'D', 'E'];
    const identities = new Set<string>();
    for (let frame = 0; frame < 25; frame += 1) {
      const source = expectRealSource(LAYER, frame);
      const expectedKeyId = keyIds[frame % 5];
      expect(source.keyId, `frame ${frame} resolves to source key ${expectedKeyId}`).toBe(expectedKeyId);
      expect(source.appFrame).toBe(frame);
      expect(source.cacheRevision).toBe(`${revision}:real:${expectedKeyId}`);
      identities.add(source.cacheRevision);
    }
    expect(identities.size, 'one source cache entry serves every occurrence (D-26/D-32)').toBe(5);

    // Reference identity with the stored source record payload (HOLD-04 pattern
    // extended to linked occurrences) — no per-occurrence copy or raster.
    expect(expectRealSource(LAYER, 7).renderedFrame).toBe(physicPaintStore.getRotoRealKeyRecord(LAYER, 'C')?.payload);
    // Frames beyond the effective range stay empty.
    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, 25)).toBeNull();
  });

  it('one source-key paint edit invalidates the single source cache entry so every occurrence reflects it', () => {
    installRecords(cycleRecords());
    installLoops([loopClip('loop-1', 0, ['A', 'B', 'C', 'D', 'E'], 5)]);
    const revisionBefore = physicPaintStore.getRotoPhysicalContentRevision(LAYER)!;
    const occurrences = [3, 8, 13, 18, 23]; // all resolve to source key D
    for (const frame of occurrences) {
      expect(expectRealSource(LAYER, frame).cacheRevision).toBe(`${revisionBefore}:real:D`);
    }

    const update = physicPaintStore.updateRotoPhysicalRealKeyPayload(LAYER, 'D', revisionBefore, payload(3, 'repainted'));
    expect(update.ok).toBe(true);
    if (update.ok) expect(update.changed).toBe(true);

    const revisionAfter = physicPaintStore.getRotoPhysicalContentRevision(LAYER)!;
    expect(revisionAfter).not.toBe(revisionBefore);
    for (const frame of occurrences) {
      const source = expectRealSource(LAYER, frame);
      expect(source.cacheRevision, `occurrence ${frame} invalidated by the single source edit`).toBe(`${revisionAfter}:real:D`);
      expect(source.renderedFrame.dataUrl).toBe(payload(3, 'repainted').dataUrl);
    }
  });

  it('a duplicated loop placed away from its source keys resolves through the shared source identity with zero added cache weight', () => {
    installRecords(cycleRecords());
    installLoops([
      loopClip('loop-1', 0, ['A', 'B', 'C', 'D', 'E'], 1),
      loopClip('loop-2', 15, ['A', 'B', 'C', 'D', 'E'], 1),
    ]);
    const revision = physicPaintStore.getRotoPhysicalContentRevision(LAYER)!;

    const identities = new Set<string>();
    for (let frame = 0; frame < 5; frame += 1) identities.add(expectRealSource(LAYER, frame).cacheRevision);
    for (let frame = 15; frame < 20; frame += 1) {
      const source = expectRealSource(LAYER, frame);
      expect(source.keyId).toBe(['A', 'B', 'C', 'D', 'E'][frame - 15]);
      expect(source.cacheRevision).toBe(`${revision}:real:${['A', 'B', 'C', 'D', 'E'][frame - 15]}`);
      identities.add(source.cacheRevision);
    }
    expect(identities.size, 'duplicate occurrences share the source cache entries').toBe(5);
    // The gap between the two placements is empty.
    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, 10)).toBeNull();
  });

  it('keeps projection real/generated authority inside keyed spans while loops resolve empty frames', () => {
    const result = physicPaintStore.replaceRotoPhysicalRecords(
      LAYER,
      [record('A', 0), record('B', 4)],
      { enabled: true, mode: 'duplicate' },
      CAPACITY,
    );
    if (!result.ok) throw new Error(result.error);
    installLoops([loopClip('loop-1', 10, ['A', 'B'], 1)]);

    for (const frame of [1, 2, 3]) {
      const source = physicPaintStore.getRotoPhysicalRenderSource(LAYER, frame);
      if (!source || source.kind !== 'generated') {
        throw new Error(`Expected a generated render source at frame ${frame}, got ${source?.kind ?? 'null'}.`);
      }
    }
    expect(expectRealSource(LAYER, 10).keyId).toBe('A');
    expect(expectRealSource(LAYER, 11).keyId).toBe('B');
    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, 12)).toBeNull();
  });
});

describe('typed linked-unresolved surfacing (audit finding 3, D-31)', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
  });

  it('surfaces the typed unresolved result inside the loop range and never blanks unrelated frames', () => {
    installRecords([record('A', 0), record('B', 1), record('C', 10)]);
    installLoops([loopClip('loop-x', 0, ['A', 'missing-1'], 3)]);

    for (const frame of [2, 3, 4, 5]) {
      const source = physicPaintStore.getRotoPhysicalRenderSource(LAYER, frame);
      if (!source || source.kind !== 'linked-unresolved') {
        throw new Error(`Expected the typed linked-unresolved result at frame ${frame}, got ${source?.kind ?? 'null'}.`);
      }
      expect(source.layerId).toBe(LAYER);
      expect(source.appFrame).toBe(frame);
      expect(source.loopId).toBe('loop-x');
      expect(source.placementStart).toBe(0);
      expect(source.sourceKeyIds).toEqual(['A', 'missing-1']);
      expect(source.missingSourceKeyIds).toEqual(['missing-1']);
    }

    // Unrelated frames resolve normally: real keys at 0, 1, and the boundary
    // key at 10; frames outside every range stay empty (null).
    expect(expectRealSource(LAYER, 0).keyId).toBe('A');
    expect(expectRealSource(LAYER, 1).keyId).toBe('B');
    expect(expectRealSource(LAYER, 10).keyId).toBe('C');
    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, 6)).toBeNull();
    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, 12)).toBeNull();
  });
});

describe('loop-aware end frame (Pitfall 3, D-25/Q4)', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
  });

  it('returns null with no loops and no keys, and for absent layers (existing behavior preserved)', () => {
    expect(physicPaintStore.getRotoPhysicalEndFrame('absent-layer')).toBeNull();
    installRecords([]);
    expect(physicPaintStore.getRotoPhysicalEndFrame(LAYER)).toBeNull();
  });

  it('returns last real key + 1 when no loops exist (existing behavior preserved)', () => {
    installRecords([record('A', 0), record('B', 9)]);
    expect(physicPaintStore.getRotoPhysicalEndFrame(LAYER)).toBe(10);
  });

  it('an infinity loop extends the end to its capacity-bounded effective end, not last real key + 1', () => {
    installRecords(cycleRecords());
    installLoops([loopClip('loop-1', 0, ['A', 'B', 'C', 'D', 'E'], 'infinity')]);
    // Effective end: min(parent end, capacity). The store's parent-end bound is
    // the physical capacity, so the infinity loop ends exactly at capacity.
    expect(physicPaintStore.getRotoPhysicalEndFrame(LAYER)).toBe(CAPACITY);
  });

  it('a finite loop repeated past the last real key extends the end to the loop effective end', () => {
    installRecords(cycleRecords());
    installLoops([loopClip('loop-1', 0, ['A', 'B', 'C', 'D', 'E'], 3)]);
    expect(physicPaintStore.getRotoPhysicalEndFrame(LAYER)).toBe(15);
  });

  it('the last real key wins when it extends past every loop effective end', () => {
    installRecords([...cycleRecords(), record('F', 20)]);
    installLoops([loopClip('loop-1', 0, ['A', 'B', 'C', 'D', 'E'], 2)]);
    expect(physicPaintStore.getRotoPhysicalEndFrame(LAYER)).toBe(21);
  });

  it('an unresolved loop still occupies its effective range on the timeline', () => {
    installRecords([]);
    installLoops([loopClip('loop-1', 3, ['missing-1'], 2)]);
    expect(physicPaintStore.getRotoPhysicalEndFrame(LAYER)).toBe(5);
  });
});

describe('unresolved-loop query (D-28 wiring)', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
  });

  function installMixedLoops(): void {
    installRecords([record('A', 0), record('B', 1)]);
    installLoops([
      loopClip('loop-1', 0, ['A', 'missing-1'], 2), // unresolved, effective [0, 4)
      loopClip('loop-2', 10, ['A', 'B'], 2), // resolved, effective [10, 14)
    ]);
  }

  it('returns each unresolvable loop intersecting the window with placement and missing source key ids', () => {
    installMixedLoops();
    const unresolved = physicPaintStore.getRotoPhysicalUnresolvedLoops(LAYER, 0, 30);
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]).toEqual({
      loopId: 'loop-1',
      placementStart: 0,
      effectiveEnd: 4,
      missingSourceKeyIds: ['missing-1'],
    });
  });

  it('uses half-open intersection against the effective range', () => {
    installMixedLoops();
    expect(physicPaintStore.getRotoPhysicalUnresolvedLoops(LAYER, 2, 3)).toHaveLength(1);
    expect(physicPaintStore.getRotoPhysicalUnresolvedLoops(LAYER, 0, 4)).toHaveLength(1);
    expect(physicPaintStore.getRotoPhysicalUnresolvedLoops(LAYER, 4, 10)).toHaveLength(0);
    expect(physicPaintStore.getRotoPhysicalUnresolvedLoops(LAYER, 4, 5)).toHaveLength(0);
  });

  it('is empty when every loop resolves over the window', () => {
    installMixedLoops();
    expect(physicPaintStore.getRotoPhysicalUnresolvedLoops(LAYER, 10, 14)).toEqual([]);
  });

  it('fails closed to an empty result for absent layers and invalid windows', () => {
    installMixedLoops();
    expect(physicPaintStore.getRotoPhysicalUnresolvedLoops('absent-layer', 0, 30)).toEqual([]);
    expect(physicPaintStore.getRotoPhysicalUnresolvedLoops(LAYER, 5, 5)).toEqual([]);
    expect(physicPaintStore.getRotoPhysicalUnresolvedLoops(LAYER, 6, 2)).toEqual([]);
    expect(physicPaintStore.getRotoPhysicalUnresolvedLoops(LAYER, -1, 5)).toEqual([]);
    expect(physicPaintStore.getRotoPhysicalUnresolvedLoops(LAYER, 0, Number.NaN)).toEqual([]);
  });
});
