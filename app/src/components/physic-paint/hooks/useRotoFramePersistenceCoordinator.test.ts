import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type {
  PhysicPaintRotoPhysicalDocument,
  PhysicPaintRotoPhysicalRenderSource,
} from '../roto/physicsPaintRotoPhysicalModel';
import {
  encodeRotoPhysicalLaunchDocument,
  rejectRotoLoopPlaceholderSource,
  resolveRotoCompletedGroupPaintTarget,
  routeRotoPhysicalPaintFrame,
} from './useRotoFramePersistenceCoordinator';

// Phase 43 Plan 09 Task 3: the frame persistence/cache coordinator explicitly
// rejects the 'loop-placeholder' render-source variant — no durable-cache
// write, no persisted metadata, no cache ownership for that frame (D-28,
// audit finding 6). The never-fallback arm keeps a future render-source
// variant a compile-time error at this consumer (Pitfall 7 convention).

const coordinatorSource = readFileSync(
  fileURLToPath(new URL('./useRotoFramePersistenceCoordinator.ts', import.meta.url)),
  'utf8',
);

const realSource: PhysicPaintRotoPhysicalRenderSource = {
  kind: 'real',
  layerId: 'layer-1',
  appFrame: 4,
  keyId: 'key-4',
  contentRevision: 'rev-1',
  cacheRevision: 'rev-1:real:key-4',
  renderedFrame: { frameIndex: 0, appFrame: 4, dataUrl: 'data:image/png;base64,cmVhbA==' },
};

const generatedSource: PhysicPaintRotoPhysicalRenderSource = {
  kind: 'generated',
  layerId: 'layer-1',
  appFrame: 5,
  leftKeyId: 'key-4',
  rightKeyId: 'key-9',
  interpolationMode: 'duplicate',
  contentRevision: 'rev-1',
  cacheRevision: 'rev-1:generated:duplicate:key-4:key-9:5',
  renderedFrame: { frameIndex: 0, appFrame: 5, dataUrl: 'data:image/png;base64,Z2VuZXJhdGVk' },
};

const placeholderSource: PhysicPaintRotoPhysicalRenderSource = {
  kind: 'loop-placeholder',
  layerId: 'layer-1',
  appFrame: 6,
  loopId: 'loop-1',
  placementStart: 2,
  sourceKeyIds: ['key-4', 'missing-1'],
  missingSourceKeyIds: ['missing-1'],
};

describe('Roto frame persistence coordinator launch publication', () => {
  it('republishes every canonical identity field without degrading the active launch', () => {
    const record = {
      kind: 'real-key' as const,
      keyId: 'key-32',
      appFrame: 32,
      payload: {
        frameIndex: 0,
        appFrame: 32,
        dataUrl: 'data:image/png;base64,',
        width: 1,
        height: 1,
      },
    };
    const loopClips = [{
      loopId: 'loop-1',
      placementStart: 40,
      sourceKeyIds: ['key-32'],
      repeat: 2 as const,
      mode: 'progressive' as const,
    }];
    const document: PhysicPaintRotoPhysicalDocument = {
      capacity: 64,
      realKeyRecords: [record],
      interpolation: { enabled: true, mode: 'duplicate' },
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: 'key-32',
      cursorAppFrame: 32,
      revision: 'physical-complete',
      loopClips,
      incomingInterpolationBreakKeyIds: ['key-32'],
    };

    expect(encodeRotoPhysicalLaunchDocument(document)).toEqual({
      capacity: 64,
      records: [{ keyId: 'key-32', appFrame: 32, payload: record.payload }],
      groupOverrideRecords: [],
      interpolationEnabled: true,
      interpolationMode: 'duplicate',
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: 'key-32',
      cursorAppFrame: 32,
      revision: 'physical-complete',
      loopClips,
      incomingInterpolationBreakKeyIds: ['key-32'],
    });
  });
});

describe('Roto frame persistence coordinator loop-placeholder rejection (D-28, audit finding 6)', () => {
  it('rejects the placeholder variant from the cache pathway — zero durable-cache writes are possible for that frame', () => {
    expect(rejectRotoLoopPlaceholderSource(placeholderSource)).toBeNull();
    expect(rejectRotoLoopPlaceholderSource(null)).toBeNull();
  });

  it('passes real and generated render sources through by reference', () => {
    expect(rejectRotoLoopPlaceholderSource(realSource)).toBe(realSource);
    expect(rejectRotoLoopPlaceholderSource(generatedSource)).toBe(generatedSource);
  });

  it('never-fallback: a future unknown render-source variant is a hard error, never silent content', () => {
    const forged = { kind: 'future-variant', layerId: 'layer-1', appFrame: 7 } as unknown as PhysicPaintRotoPhysicalRenderSource;
    expect(() => rejectRotoLoopPlaceholderSource(forged)).toThrow(/Unhandled Roto physical render-source kind/);
  });

  it('routes the reference/cache lookup through the explicit rejection arm', () => {
    expect(coordinatorSource).toContain('rejectRotoLoopPlaceholderSource(');
    expect(coordinatorSource).toContain("case 'loop-placeholder':");
  });
});

type CowRange = Readonly<{ start: number; endExclusive: number }>;
type CowGroup = Readonly<{
  groupId: string;
  placementStart: number;
  orderedSourceKeyIds: readonly string[];
  visibleRanges: readonly CowRange[];
  frameOverrides: readonly Readonly<{ appFrame: number; keyId: string }>[];
  syncState: 'synchronized' | 'modified';
}>;

type CowState = Readonly<{
  groups: readonly CowGroup[];
  rasterBytes: Readonly<Record<string, string>>;
}>;

function mergeCowFrame(ranges: readonly CowRange[], appFrame: number): readonly CowRange[] {
  const normalized = [...ranges, { start: appFrame, endExclusive: appFrame + 1 }]
    .sort((left, right) => left.start - right.start);
  const merged: CowRange[] = [];
  for (const range of normalized) {
    const prior = merged[merged.length - 1];
    if (prior && prior.endExclusive >= range.start) {
      merged[merged.length - 1] = Object.freeze({
        start: prior.start,
        endExclusive: Math.max(prior.endExclusive, range.endExclusive),
      });
    } else {
      merged.push(Object.freeze({ ...range }));
    }
  }
  return Object.freeze(merged);
}

function paintControlledGroupFrame(
  state: CowState,
  groupId: string,
  appFrame: number,
  nextBytes: string,
  allocateKeyId: () => string,
): CowState {
  const group = state.groups.find((candidate) => candidate.groupId === groupId);
  if (!group) throw new Error(`Unknown Group ${groupId}`);
  const existingOverride = group.frameOverrides.find((override) => override.appFrame === appFrame);
  const sourceIndex = (appFrame - group.placementStart) % group.orderedSourceKeyIds.length;
  if (sourceIndex < 0) throw new Error('Frame precedes Group placement');
  const sourceKeyId = group.orderedSourceKeyIds[sourceIndex];
  const overrideKeyId = existingOverride?.keyId ?? allocateKeyId();
  if (!(sourceKeyId in state.rasterBytes)) throw new Error(`Missing source ${sourceKeyId}`);

  const nextGroup: CowGroup = Object.freeze({
    ...group,
    visibleRanges: mergeCowFrame(group.visibleRanges, appFrame),
    frameOverrides: existingOverride
      ? group.frameOverrides
      : Object.freeze([...group.frameOverrides, Object.freeze({ appFrame, keyId: overrideKeyId })]),
    syncState: 'modified',
  });
  return Object.freeze({
    groups: Object.freeze(state.groups.map((candidate) => candidate.groupId === groupId ? nextGroup : candidate)),
    rasterBytes: Object.freeze({
      ...state.rasterBytes,
      [overrideKeyId]: nextBytes,
    }),
  });
}

function resolveControlledGroupBytes(state: CowState, groupId: string, appFrame: number): string {
  const group = state.groups.find((candidate) => candidate.groupId === groupId);
  if (!group) throw new Error(`Unknown Group ${groupId}`);
  const override = group.frameOverrides.find((candidate) => candidate.appFrame === appFrame);
  const sourceIndex = (appFrame - group.placementStart) % group.orderedSourceKeyIds.length;
  const keyId = override?.keyId ?? group.orderedSourceKeyIds[sourceIndex];
  return state.rasterBytes[keyId];
}

function routedPaintDocument(options: { gapFrame?: number; ambiguous?: boolean } = {}): PhysicPaintRotoPhysicalDocument {
  const records = [
    {
      kind: 'real-key' as const,
      keyId: 'source-A',
      appFrame: 0,
      payload: { frameIndex: 0, appFrame: 0, dataUrl: 'data:image/png;base64,QQ==' },
    },
    {
      kind: 'real-key' as const,
      keyId: 'source-B',
      appFrame: 2,
      payload: { frameIndex: 0, appFrame: 2, dataUrl: 'data:image/png;base64,Qg==' },
    },
    {
      kind: 'real-key' as const,
      keyId: 'ordinary-8',
      appFrame: 8,
      payload: { frameIndex: 0, appFrame: 8, dataUrl: 'data:image/png;base64,Tw==' },
    },
    {
      kind: 'real-key' as const,
      keyId: 'override-5',
      appFrame: 5,
      payload: { frameIndex: 0, appFrame: 5, dataUrl: 'data:image/png;base64,Vg==' },
    },
  ];
  const visibleRanges = options.gapFrame === undefined
    ? [{ start: 0, endExclusive: 6 }]
    : [
        { start: 0, endExclusive: options.gapFrame },
        { start: options.gapFrame + 1, endExclusive: 6 },
      ];
  const group = {
    loopId: 'group-1',
    placementStart: 0,
    sourceKeyIds: ['source-A', 'source-B'],
    repeat: 2 as const,
    mode: 'progressive' as const,
    syncState: 'modified' as const,
    provenanceState: 'attached' as const,
    phaseOrigin: 0,
    originalEndExclusive: 6,
    visibleRanges,
    frameOverrides: [{ appFrame: 5, keyId: 'override-5' }],
  };
  const loopClips = options.ambiguous
    ? [group, { ...group, loopId: 'group-2', frameOverrides: [] }]
    : [group];
  return {
    capacity: 12,
    realKeyRecords: records,
    interpolation: { enabled: false, mode: 'duplicate' },
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 0,
    revision: 'accepted-revision',
    loopClips,
    incomingInterpolationBreakKeyIds: ['source-B'],
  };
}

describe('Phase 43.2 completed Group Paint target routing', () => {
  it.each([
    ['source occurrence', 3, 'source-A'],
    ['generated occurrence', 4, undefined],
    ['existing override', 5, 'override-5'],
    ['deleted Group occurrence', 4, undefined],
  ] as const)('does not require a direct occurrence key for a %s', (_label, appFrame, expectedKeyId) => {
    const document = routedPaintDocument(_label === 'deleted Group occurrence' ? { gapFrame: appFrame } : {});

    expect(resolveRotoCompletedGroupPaintTarget(document, appFrame, null)).toEqual({
      kind: 'group-frame',
      groupId: 'group-1',
      appFrame,
      expectedKeyId,
    });
  });

  it('keeps ordinary empty frames on the first-key preparation path', () => {
    expect(resolveRotoCompletedGroupPaintTarget(routedPaintDocument(), 10, null)).toEqual({ kind: 'empty' });
  });
});

describe('Phase 43.2 production Paint target routing', () => {
  const renderedPayload = {
    frameIndex: 0,
    appFrame: 8,
    dataUrl: 'data:image/png;base64,UEFJTlQ=',
  };

  it('keeps an ordinary unique real key on the direct payload path', async () => {
    const updateOrdinaryKey = vi.fn(() => ({ ok: true as const, changed: true, contentRevision: 'next-revision' }));
    const executePhysicalEdit = vi.fn(async () => true);

    const result = await routeRotoPhysicalPaintFrame({
      document: routedPaintDocument(),
      projectContextId: 'project-1',
      layerId: 'layer-1',
      launchOperationId: 'launch-1',
      appFrame: 8,
      expectedKeyId: 'ordinary-8',
      renderedPayload,
      createOverrideKeyId: () => 'unused-override',
    }, { updateOrdinaryKey, executePhysicalEdit });

    expect(result).toEqual({ ok: true, kind: 'ordinary-key', keyId: 'ordinary-8', contentRevision: 'next-revision' });
    expect(updateOrdinaryKey).toHaveBeenCalledOnce();
    expect(executePhysicalEdit).not.toHaveBeenCalled();
  });

  it.each([
    ['source occurrence', 3, undefined],
    ['generated occurrence', 4, undefined],
    ['existing override', 5, 'override-5'],
    ['deleted Group occurrence', 4, undefined],
  ] as const)('routes a %s through one exact-frame COW physical edit', async (_label, appFrame, expectedOverrideKeyId) => {
    const document = routedPaintDocument(_label === 'deleted Group occurrence' ? { gapFrame: appFrame } : {});
    const updateOrdinaryKey = vi.fn();
    const executePhysicalEdit = vi.fn(async () => true);

    const result = await routeRotoPhysicalPaintFrame({
      document,
      projectContextId: 'project-1',
      layerId: 'layer-1',
      launchOperationId: 'launch-1',
      appFrame,
      expectedKeyId: expectedOverrideKeyId,
      renderedPayload: { ...renderedPayload, appFrame },
      createOverrideKeyId: () => `override-${appFrame}-new`,
    }, { updateOrdinaryKey, executePhysicalEdit });

    expect(result).toEqual({ ok: true, kind: 'group-frame', groupId: 'group-1', appFrame });
    expect(updateOrdinaryKey).not.toHaveBeenCalled();
    expect(executePhysicalEdit).toHaveBeenCalledWith(expect.objectContaining({
      operationKind: 'paint-group-frame',
      expectedLaunch: { operationId: 'launch-1', layerId: 'layer-1' },
      groupId: 'group-1',
      appFrame,
      overrideKeyId: expectedOverrideKeyId ?? `override-${appFrame}-new`,
      renderedPayload: expect.objectContaining({ appFrame }),
    }));
  });

  it.each([
    ['stale ordinary identity', routedPaintDocument(), 8, 'wrong-key'],
    ['unresolved Group', { ...routedPaintDocument(), realKeyRecords: routedPaintDocument().realKeyRecords.filter((record) => record.keyId !== 'source-B') }, 3, undefined],
    ['ambiguous Group', routedPaintDocument({ ambiguous: true }), 3, undefined],
    ['placeholder/empty frame', routedPaintDocument(), 10, undefined],
  ] as const)('rejects %s before any raster/cache mutation', async (_label, document, appFrame, expectedKeyId) => {
    const updateOrdinaryKey = vi.fn();
    const executePhysicalEdit = vi.fn(async () => true);

    const result = await routeRotoPhysicalPaintFrame({
      document,
      projectContextId: 'project-1',
      layerId: 'layer-1',
      launchOperationId: 'launch-1',
      appFrame,
      expectedKeyId,
      renderedPayload: { ...renderedPayload, appFrame },
      createOverrideKeyId: () => 'must-not-allocate',
    }, { updateOrdinaryKey, executePhysicalEdit });

    expect(result.ok).toBe(false);
    expect(updateOrdinaryKey).not.toHaveBeenCalled();
    expect(executePhysicalEdit).not.toHaveBeenCalled();
  });
});

describe('Phase 43.2 exact-frame copy-on-write persistence contract', () => {
  const sourceBytes = Object.freeze({
    'source-A': 'bytes-A',
    'source-B': 'bytes-B',
  });
  const motionGroup: CowGroup = Object.freeze({
    groupId: 'motion-1',
    placementStart: 0,
    orderedSourceKeyIds: Object.freeze(['source-A', 'source-B']),
    visibleRanges: Object.freeze([Object.freeze({ start: 0, endExclusive: 6 })]),
    frameOverrides: Object.freeze([]),
    syncState: 'synchronized',
  });
  const sharingGroup: CowGroup = Object.freeze({
    ...motionGroup,
    groupId: 'motion-2',
    placementStart: 6,
  });

  it('isolates one repeated occurrence and one Group before mutating raster bytes', () => {
    const before: CowState = Object.freeze({
      groups: Object.freeze([motionGroup, sharingGroup]),
      rasterBytes: sourceBytes,
    });
    const after = paintControlledGroupFrame(before, 'motion-1', 4, 'painted-frame-4', () => 'override-4');

    expect(resolveControlledGroupBytes(after, 'motion-1', 4)).toBe('painted-frame-4');
    expect(resolveControlledGroupBytes(after, 'motion-1', 0)).toBe('bytes-A');
    expect(resolveControlledGroupBytes(after, 'motion-2', 6)).toBe('bytes-A');
    expect(after.rasterBytes['source-A']).toBe('bytes-A');
    expect(after.groups.find((group) => group.groupId === 'motion-1')).toMatchObject({
      syncState: 'modified',
      frameOverrides: [{ appFrame: 4, keyId: 'override-4' }],
    });
    expect(after.groups.find((group) => group.groupId === 'motion-2')).toBe(sharingGroup);
  });

  it('fills a deleted-range gap, rejoins adjacent ranges, and reuses the exact override identity', () => {
    const gapGroup: CowGroup = Object.freeze({
      ...motionGroup,
      visibleRanges: Object.freeze([
        Object.freeze({ start: 0, endExclusive: 2 }),
        Object.freeze({ start: 3, endExclusive: 6 }),
      ]),
      syncState: 'modified',
    });
    const before: CowState = Object.freeze({ groups: Object.freeze([gapGroup]), rasterBytes: sourceBytes });
    let allocations = 0;
    const filled = paintControlledGroupFrame(before, 'motion-1', 2, 'filled-gap', () => {
      allocations += 1;
      return 'override-gap-2';
    });
    const repainted = paintControlledGroupFrame(filled, 'motion-1', 2, 'repainted-gap', () => {
      allocations += 1;
      return 'must-not-allocate';
    });

    expect(filled.groups[0].visibleRanges).toEqual([{ start: 0, endExclusive: 6 }]);
    expect(repainted.groups[0].frameOverrides).toEqual([{ appFrame: 2, keyId: 'override-gap-2' }]);
    expect(resolveControlledGroupBytes(repainted, 'motion-1', 2)).toBe('repainted-gap');
    expect(repainted.groups[0].syncState).toBe('modified');
    expect(allocations).toBe(1);
  });
});
