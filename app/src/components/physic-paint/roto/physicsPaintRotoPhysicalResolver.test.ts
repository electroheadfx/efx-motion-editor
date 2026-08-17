import { describe, expect, it } from 'vitest';
import type {
  PhysicPaintRotoPhysicalEditIntent,
  PhysicPaintRotoPhysicalEditResolution,
} from './physicsPaintRotoPhysicalResolver';
import {
  clampPhysicPaintGroupDragDestination,
  clampPhysicPaintKeyRailDragDestination,
  clampPhysicPaintPushDestination,
  createPhysicPaintRotoPasteKeyGroupIntent,
  derivePhysicPaintPushSet,
  projectPhysicPaintRotoPhysicalTimeline,
  resolvePhysicPaintRotoPhysicalEdit,
  validatePhysicPaintRotoPhysicalEditSemanticDelta,
} from './physicsPaintRotoPhysicalResolver';
import type {
  PhysicPaintRotoKeyIdentity,
  PhysicPaintRotoLoopClip,
  PhysicPaintRotoPhysicalDocument,
  PhysicPaintRotoRealKeyPayload,
  PhysicPaintRotoRealKeyRecord,
} from './physicsPaintRotoPhysicalModel';
import {
  buildPhysicPaintRotoPhysicalRevision,
  parsePhysicPaintRotoPhysicalDocument,
} from './physicsPaintRotoPhysicalModel';
import {
  classifyPhysicPaintRotoGroupFrameTarget,
  proposePhysicPaintRotoActionGroupLifecycle,
  proposePhysicPaintRotoDeleteGroup,
  proposePhysicPaintRotoDeleteGroupFrame,
  proposePhysicPaintRotoGroupFramePaint,
  proposePhysicPaintRotoRegenerateGroup,
} from './physicsPaintRotoGroupLifecycle';
import {
  derivePhysicPaintRotoLoopRanges,
  resolvePhysicPaintRotoLoopFrame,
} from './physicsPaintRotoPhysicalResolver';
import {
  PHYSIC_PAINT_MAX_APPLY_FRAMES,
  isPhysicPaintRotoPhysicalEditApplyPayload,
  isPhysicPaintRotoPhysicalEditIntent,
  serializePhysicPaintRotoPhysicalEditIntent,
} from '../../../types/physicPaint';
import { deriveKeyRailSegments } from '../view/physicsPaintKeyRailPresentation';
import { getPhysicsPaintRotoSourceCycleId } from './physicsPaintRotoSpacingSelection';

/**
 * Group-operation regression anchors. Group Drag uses the current rigid
 * physical-translation contract; group Delete and Force Spacing retain their
 * approved Phase 37 mappings over the shared A@1, B@3, C@5, D@10 baseline.
 * GP-1..GP-7 lock the group-paste contract approved by the user-owned 38-06 UAT.
 */

function buildBaselineIdentities(): PhysicPaintRotoKeyIdentity[] {
  return [
    { keyId: 'A', appFrame: 1 },
    { keyId: 'B', appFrame: 3 },
    { keyId: 'C', appFrame: 5 },
    { keyId: 'D', appFrame: 10 },
  ];
}

function buildBaselineRecords(): PhysicPaintRotoRealKeyRecord[] {
  return [
    { keyId: 'A', appFrame: 1 },
    { keyId: 'B', appFrame: 3 },
    { keyId: 'C', appFrame: 5 },
    { keyId: 'D', appFrame: 10 },
  ].map((identity) => ({
    kind: 'real-key',
    keyId: identity.keyId,
    appFrame: identity.appFrame,
    payload: {
      frameIndex: 0,
      appFrame: identity.appFrame,
      dataUrl: 'data:image/png;base64,AAAA',
      width: 2,
      height: 2,
    },
  }));
}

function buildGroupEntries(): readonly {
  readonly payload: PhysicPaintRotoRealKeyPayload;
  readonly sourceAppFrame: number;
  readonly sourceKeyId: string;
}[] {
  const records = buildBaselineRecords();
  return Object.freeze([records[0], records[2]].map((record) => Object.freeze({
    payload: record.payload,
    sourceAppFrame: record.appFrame,
    sourceKeyId: record.keyId,
  })));
}

function resolveIdentities(
  identities: readonly PhysicPaintRotoKeyIdentity[],
  intent: PhysicPaintRotoPhysicalEditIntent,
  capacity = PHYSIC_PAINT_MAX_APPLY_FRAMES,
): PhysicPaintRotoPhysicalEditResolution {
  return resolvePhysicPaintRotoPhysicalEdit({
    identities,
    intent,
    parentEndExclusive: capacity,
    capacity,
    interpolationEnabled: false,
  });
}

function resolveBaseline(intent: PhysicPaintRotoPhysicalEditIntent): PhysicPaintRotoPhysicalEditResolution {
  return resolveIdentities(buildBaselineIdentities(), intent);
}

function resolveBaselineWithRecords(
  intent: PhysicPaintRotoPhysicalEditIntent,
  capacity = PHYSIC_PAINT_MAX_APPLY_FRAMES,
): PhysicPaintRotoPhysicalEditResolution {
  const records = buildBaselineRecords();
  return resolvePhysicPaintRotoPhysicalEdit({
    identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
    records,
    intent,
    parentEndExclusive: capacity,
    capacity,
    interpolationEnabled: false,
  });
}

function parsePhysicalEditIntent(intent: PhysicPaintRotoPhysicalEditIntent): PhysicPaintRotoPhysicalEditIntent {
  const parsed: unknown = JSON.parse(serializePhysicPaintRotoPhysicalEditIntent(intent));
  if (!isPhysicPaintRotoPhysicalEditIntent(parsed)) {
    throw new Error(`Canonical ${intent.kind} intent must parse`);
  }
  return parsed;
}

describe('transport-safe physical edit intent tracer', () => {
  it('reproduces the direct Insert Slot proposal after canonical serialization and strict parsing', () => {
    const directIntent = { kind: 'insert-slot', selectedKeyId: 'B' } as const;
    const serialized = serializePhysicPaintRotoPhysicalEditIntent(directIntent);
    const parsed: unknown = JSON.parse(serialized);
    if (!isPhysicPaintRotoPhysicalEditIntent(parsed)) {
      throw new Error('Canonical Insert Slot intent must parse');
    }

    const direct = resolveBaseline(directIntent);
    const reproduced = resolveBaseline(parsed);

    expect(reproduced).toEqual(direct);
    expect(reproduced.ok).toBe(true);
    if (!reproduced.ok) throw new Error('Parsed Insert Slot intent must resolve');
    expect(Object.fromEntries(reproduced.proposal.mapping)).toEqual({ A: 1, B: 4, C: 6, D: 11 });
  });

  it('reproduces every ordinary direct resolver proposal from one parsed canonical intent', () => {
    const payloadAt = (appFrame: number): PhysicPaintRotoRealKeyPayload => ({
      frameIndex: 0,
      appFrame,
      dataUrl: 'data:image/png;base64,AAAA',
      width: 2,
      height: 2,
    });
    const groupEntries = [
      { payload: payloadAt(1), sourceAppFrame: 1, sourceKeyId: 'A', newKeyId: 'paste-A' },
      { payload: payloadAt(5), sourceAppFrame: 5, sourceKeyId: 'C', newKeyId: 'paste-C' },
    ] as const;
    const cases: readonly {
      readonly intent: PhysicPaintRotoPhysicalEditIntent;
      readonly resolve: (intent: PhysicPaintRotoPhysicalEditIntent) => PhysicPaintRotoPhysicalEditResolution;
      readonly expectedMapping: Readonly<Record<string, number>>;
    }[] = [
      { intent: { kind: 'insert-empty-segment', destinationAppFrame: 0, insertedKeyId: 'blank-0', blankPayload: payloadAt(0) }, resolve: resolveBaselineWithRecords, expectedMapping: { 'blank-0': 0, A: 1, B: 3, C: 5, D: 10 } },
      { intent: { kind: 'delete-key', selectedKeyId: 'B' }, resolve: resolveBaseline, expectedMapping: { A: 1, C: 4, D: 9 } },
      { intent: { kind: 'delete-key-group', keyIds: ['B', 'C'] }, resolve: resolveBaseline, expectedMapping: { A: 1, D: 8 } },
      { intent: { kind: 'move-key', movedKeyId: 'B', target: { kind: 'after-key', targetKeyId: 'C' } }, resolve: resolveBaseline, expectedMapping: { A: 1, C: 5, B: 6, D: 11 } },
      { intent: { kind: 'move-key-group', movedKeyIds: ['B', 'C'], grabbedKeyId: 'B', target: { kind: 'physical-cell', appFrame: 7 } }, resolve: resolveBaseline, expectedMapping: { A: 1, B: 7, C: 9, D: 10 } },
      { intent: { kind: 'force-spacing', emptyFrames: 2, selectedKeyId: null }, resolve: resolveBaseline, expectedMapping: { A: 1, B: 4, C: 7, D: 10 } },
      { intent: { kind: 'duplicate-key', sourceKeyId: 'A', newKeyId: 'duplicate-A' }, resolve: resolveBaselineWithRecords, expectedMapping: { A: 1, 'duplicate-A': 2, B: 4, C: 6, D: 11 } },
      { intent: { kind: 'paste-key', destinationAppFrame: 3, destinationKeyId: 'B', newKeyId: null, clipboardPayload: payloadAt(1) }, resolve: resolveBaselineWithRecords, expectedMapping: { A: 1, B: 3, C: 5, D: 10 } },
      { intent: { kind: 'paste-key-group', destinationAppFrame: 12, entries: groupEntries }, resolve: resolveBaselineWithRecords, expectedMapping: { A: 1, B: 3, C: 5, D: 10, 'paste-A': 12, 'paste-C': 16 } },
    ];

    for (const { intent, resolve, expectedMapping } of cases) {
      const parsed = parsePhysicalEditIntent(intent);
      const direct = resolve(intent);
      const reproduced = resolve(parsed);

      expect(reproduced, intent.kind).toEqual(direct);
      expect(reproduced.ok, intent.kind).toBe(true);
      if (!reproduced.ok) throw new Error(`Parsed ${intent.kind} intent must resolve`);
      expect(Object.fromEntries(reproduced.proposal.mapping), intent.kind).toEqual(expectedMapping);
    }
  });

  it('keeps ordered authorization immutable and repeated parse-resolve cycles stable', () => {
    const intent = {
      kind: 'move-key-group',
      movedKeyIds: Object.freeze(['B', 'C']),
      grabbedKeyId: 'B',
      target: Object.freeze({ kind: 'physical-cell', appFrame: 7 }),
    } as const;
    const originalMembers = [...intent.movedKeyIds];
    const firstParsed = parsePhysicalEditIntent(intent);
    const first = resolveBaseline(firstParsed);
    const secondParsed = parsePhysicalEditIntent(firstParsed);
    const second = resolveBaseline(secondParsed);

    expect(first).toEqual(second);
    expect(serializePhysicPaintRotoPhysicalEditIntent(firstParsed)).toBe(serializePhysicPaintRotoPhysicalEditIntent(secondParsed));
    expect(intent.movedKeyIds).toEqual(originalMembers);
    expect(firstParsed.kind === 'move-key-group' && firstParsed.movedKeyIds).toEqual(originalMembers);
  });

  it('preserves deterministic empty and single-key resolver behavior after parsing', () => {
    const singleDelete = parsePhysicalEditIntent({ kind: 'delete-key', selectedKeyId: 'only' });
    const deleted = resolveIdentities([{ keyId: 'only', appFrame: 0 }], singleDelete, 4);
    const emptySpacing = parsePhysicalEditIntent({ kind: 'force-spacing', emptyFrames: 0, selectedKeyId: null });
    const rejected = resolveIdentities([], emptySpacing, 4);

    expect(deleted.ok).toBe(true);
    if (!deleted.ok) throw new Error('Parsed single-key delete must resolve');
    expect(Object.fromEntries(deleted.proposal.mapping)).toEqual({});
    expect(deleted.proposal.selectedKeyId).toBeNull();
    expect(rejected.ok).toBe(false);
    if (rejected.ok) throw new Error('Parsed empty Force Spacing must reject');
    expect(rejected.failure.code).toBe('empty-key-set');
  });

  it('round-trips a move-group intent through the strict parser and canonical serializer', () => {
    const intent = { kind: 'move-group', loopId: 'loop-A', destinationPlacementStart: 7 } as const;
    const parsed = parsePhysicalEditIntent(intent);

    expect(parsed).toEqual(intent);
    expect(serializePhysicPaintRotoPhysicalEditIntent(parsed)).toBe(serializePhysicPaintRotoPhysicalEditIntent(intent));
  });

  it('rejects move-group payloads with excess or missing keys and malformed frames', () => {
    expect(isPhysicPaintRotoPhysicalEditIntent({ kind: 'move-group', loopId: 'loop-A', destinationPlacementStart: 7, extra: true })).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditIntent({ kind: 'move-group', loopId: 'loop-A' })).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditIntent({ kind: 'move-group', destinationPlacementStart: 7 })).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditIntent({ kind: 'move-group', loopId: '', destinationPlacementStart: 7 })).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditIntent({ kind: 'move-group', loopId: 'loop-A', destinationPlacementStart: -1 })).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditIntent({ kind: 'move-group', loopId: 'loop-A', destinationPlacementStart: 1.5 })).toBe(false);
  });

  it('accepts move-group as an ordinary physical-edit operation kind', () => {
    const payload = {
      kind: 'replace-roto-physical-map',
      operationId: 'move-group-1',
      operationKind: 'move-group',
      intent: { kind: 'move-group', loopId: 'loop-A', destinationPlacementStart: 7 },
      layerId: 'layer-1',
      leaseToken: { projectContextId: 'project-1', layerId: 'layer-1', generation: 1, owner: 'exclusive' },
      startFrame: 0,
      launchOperationId: 'launch-1',
      expectedRevision: 'revision-1',
      records: [],
      interpolationEnabled: false,
      interpolationMode: 'duplicate',
      selectedKeyId: null,
      selectedAppFrame: null,
      cursorAppFrame: 0,
    } as const;

    expect(isPhysicPaintRotoPhysicalEditApplyPayload(payload)).toBe(true);
    // 'move-group' is ordinary: a specialized payload (no intent) must be rejected.
    expect(isPhysicPaintRotoPhysicalEditApplyPayload({ ...payload, intent: undefined })).toBe(false);
  });

  it('round-trips the strict scissor intent and admits it as an ordinary operation kind', () => {
    const intent = { kind: 'scissor-key-rail', breakOwnerKeyId: 'B' } as const;
    const parsed = parsePhysicalEditIntent(intent);
    expect(parsed).toEqual(intent);
    expect(serializePhysicPaintRotoPhysicalEditIntent(parsed)).toBe(
      '{"kind":"scissor-key-rail","breakOwnerKeyId":"B"}',
    );

    expect(isPhysicPaintRotoPhysicalEditIntent({ ...intent, extra: true })).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditIntent({ kind: 'scissor-key-rail' })).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditIntent({ kind: 'scissor-key-rail', breakOwnerKeyId: '' })).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditIntent({
      kind: 'scissor-key-rail',
      breakOwnerKeyId: 'x'.repeat(257),
    })).toBe(false);

    const payload = {
      kind: 'replace-roto-physical-map',
      operationId: 'scissor-1',
      operationKind: 'scissor-key-rail',
      intent,
      layerId: 'layer-1',
      leaseToken: { projectContextId: 'project-1', layerId: 'layer-1', generation: 1, owner: 'exclusive' },
      startFrame: 0,
      launchOperationId: 'launch-1',
      expectedRevision: 'revision-1',
      records: [],
      interpolationEnabled: false,
      interpolationMode: 'duplicate',
      selectedKeyId: null,
      selectedAppFrame: null,
      cursorAppFrame: 0,
    } as const;
    expect(isPhysicPaintRotoPhysicalEditApplyPayload(payload)).toBe(true);
    expect(isPhysicPaintRotoPhysicalEditApplyPayload({ ...payload, intent: undefined })).toBe(false);
  });

  it('round-trips strict move-key-rail and delete-key-rail intents and rejects malformed authorization', () => {
    const moveIntent = {
      kind: 'move-key-rail',
      memberKeyIds: ['B', 'C'],
      destinationFirstKeyAppFrame: 7,
    } as unknown as PhysicPaintRotoPhysicalEditIntent;
    const deleteIntent = {
      kind: 'delete-key-rail',
      keyIds: ['B', 'C'],
    } as unknown as PhysicPaintRotoPhysicalEditIntent;

    expect(parsePhysicalEditIntent(moveIntent)).toEqual({
      kind: 'move-key-rail',
      memberKeyIds: ['B', 'C'],
      destinationFirstKeyAppFrame: 7,
    });
    expect(serializePhysicPaintRotoPhysicalEditIntent(moveIntent)).toBe(
      '{"kind":"move-key-rail","memberKeyIds":["B","C"],"destinationFirstKeyAppFrame":7}',
    );
    expect(parsePhysicalEditIntent(deleteIntent)).toEqual({
      kind: 'delete-key-rail',
      keyIds: ['B', 'C'],
    });
    expect(serializePhysicPaintRotoPhysicalEditIntent(deleteIntent)).toBe(
      '{"kind":"delete-key-rail","keyIds":["B","C"]}',
    );

    const malformed = [
      { kind: 'move-key-rail', memberKeyIds: ['B', 'C'], destinationFirstKeyAppFrame: 7, extra: true },
      { kind: 'move-key-rail', memberKeyIds: ['B', 'C'] },
      { kind: 'move-key-rail', destinationFirstKeyAppFrame: 7 },
      { kind: 'move-key-rail', memberKeyIds: [], destinationFirstKeyAppFrame: 7 },
      { kind: 'move-key-rail', memberKeyIds: ['B', 'B'], destinationFirstKeyAppFrame: 7 },
      { kind: 'move-key-rail', memberKeyIds: ['', 'C'], destinationFirstKeyAppFrame: 7 },
      { kind: 'move-key-rail', memberKeyIds: ['x'.repeat(257)], destinationFirstKeyAppFrame: 7 },
      { kind: 'move-key-rail', memberKeyIds: ['B', 'C'], destinationFirstKeyAppFrame: -1 },
      { kind: 'move-key-rail', memberKeyIds: ['B', 'C'], destinationFirstKeyAppFrame: 1.5 },
      { kind: 'delete-key-rail', keyIds: ['B', 'C'], extra: true },
      { kind: 'delete-key-rail' },
      { kind: 'delete-key-rail', keyIds: [] },
      { kind: 'delete-key-rail', keyIds: ['B', 'B'] },
      { kind: 'delete-key-rail', keyIds: ['', 'C'] },
      { kind: 'delete-key-rail', keyIds: ['x'.repeat(257)] },
    ];
    for (const value of malformed) expect(isPhysicPaintRotoPhysicalEditIntent(value)).toBe(false);
  });

  it.each([
    {
      operationKind: 'move-key-rail',
      intent: { kind: 'move-key-rail', memberKeyIds: ['B', 'C'], destinationFirstKeyAppFrame: 7 },
    },
    {
      operationKind: 'delete-key-rail',
      intent: { kind: 'delete-key-rail', keyIds: ['B', 'C'] },
    },
  ])('admits $operationKind as an ordinary physical-edit operation kind', ({ operationKind, intent }) => {
    const payload = {
      kind: 'replace-roto-physical-map',
      operationId: `${operationKind}-1`,
      operationKind,
      intent,
      layerId: 'layer-1',
      leaseToken: { projectContextId: 'project-1', layerId: 'layer-1', generation: 1, owner: 'exclusive' },
      startFrame: 0,
      launchOperationId: 'launch-1',
      expectedRevision: 'revision-1',
      records: [],
      interpolationEnabled: false,
      interpolationMode: 'duplicate',
      selectedKeyId: null,
      selectedAppFrame: null,
      cursorAppFrame: 0,
    } as const;

    expect(isPhysicPaintRotoPhysicalEditApplyPayload(payload)).toBe(true);
    expect(isPhysicPaintRotoPhysicalEditApplyPayload({ ...payload, intent: undefined })).toBe(false);
  });
});

describe('intentional incoming interpolation breaks', () => {
  it('suppresses only the incoming interpolation span owned by the right key', () => {
    const resolution = projectPhysicPaintRotoPhysicalTimeline({
      identities: [
        { keyId: 'key-0', appFrame: 0 },
        { keyId: 'key-3', appFrame: 3 },
        { keyId: 'key-6', appFrame: 6 },
        { keyId: 'key-10', appFrame: 10 },
        { keyId: 'key-13', appFrame: 13 },
      ],
      capacity: 14,
      interpolationEnabled: true,
      incomingInterpolationBreakKeyIds: ['key-10'],
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Break-aware projection must resolve');
    expect(resolution.projection.generatedCells.map((cell) => cell.appFrame)).toEqual([1, 2, 4, 5, 11, 12]);
    expect(resolution.projection.generatedCells.find((cell) => cell.appFrame === 11)).toMatchObject({
      leftKeyId: 'key-10',
      rightKeyId: 'key-13',
    });
  });

  it('proposes one empty real key and one incoming break atomically', () => {
    const records = [
      buildBaselineRecords()[0],
      { ...buildBaselineRecords()[1], keyId: 'B', appFrame: 6, payload: { ...buildBaselineRecords()[1].payload, appFrame: 6 } },
    ];
    const loopClips = Object.freeze([]);
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records,
      intent: {
        kind: 'insert-empty-segment',
        destinationAppFrame: 3,
        insertedKeyId: 'blank-3',
        blankPayload: {
          frameIndex: 0,
          appFrame: 3,
          dataUrl: 'data:image/png;base64,AAAA',
          width: 2,
          height: 2,
        },
      },
      parentEndExclusive: 8,
      capacity: 8,
      interpolationEnabled: false,
      loopClips,
      incomingInterpolationBreakKeyIds: [],
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Empty segment insert must resolve');
    expect(resolution.proposal.nextRecords).toEqual([
      records[0],
      {
        kind: 'real-key',
        keyId: 'blank-3',
        appFrame: 3,
        payload: {
          frameIndex: 0,
          appFrame: 3,
          dataUrl: 'data:image/png;base64,AAAA',
          width: 2,
          height: 2,
        },
      },
      records[1],
    ]);
    expect(resolution.proposal.nextIncomingInterpolationBreakKeyIds).toEqual([]);
    expect(resolution.proposal.nextLoopClips).toBeNull();
    expect(resolution.proposal.semanticDelta).toEqual({
      kind: 'insert-empty-segment',
      insertedKeyId: 'blank-3',
      destinationAppFrame: 3,
    });
    expect(resolution.proposal.selectedKeyId).toBe('blank-3');
    expect(resolution.proposal.selectedAppFrame).toBe(3);
  });

  it('rejects every non-empty-segment target without a proposal', () => {
    const records = [
      { ...buildBaselineRecords()[0], keyId: 'A', appFrame: 0, payload: { ...buildBaselineRecords()[0].payload, appFrame: 0 } },
      { ...buildBaselineRecords()[1], keyId: 'B', appFrame: 6, payload: { ...buildBaselineRecords()[1].payload, appFrame: 6 } },
    ];
    const base = {
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records,
      parentEndExclusive: 16,
      capacity: 16,
      interpolationEnabled: false,
      incomingInterpolationBreakKeyIds: [],
    } as const;
    const intent = (destinationAppFrame: number, blankPayload: PhysicPaintRotoRealKeyPayload = {
      frameIndex: 0,
      appFrame: destinationAppFrame,
      dataUrl: 'data:image/png;base64,AAAA',
    }) => ({
      kind: 'insert-empty-segment' as const,
      destinationAppFrame,
      insertedKeyId: `blank-${destinationAppFrame}`,
      blankPayload,
    });
    const resolutions = [
      resolvePhysicPaintRotoPhysicalEdit({ ...base, intent: intent(0) }),
      resolvePhysicPaintRotoPhysicalEdit({ ...base, interpolationEnabled: true, intent: intent(3) }),
      resolvePhysicPaintRotoPhysicalEdit({
        ...base,
        loopClips: [{ loopId: 'loop-linked', placementStart: 10, sourceKeyIds: ['A', 'B'], repeat: 2, mode: 'static' }],
        intent: intent(10),
      }),
      resolvePhysicPaintRotoPhysicalEdit({
        ...base,
        loopClips: [{ loopId: 'loop-unresolved', placementStart: 10, sourceKeyIds: ['ghost-A', 'ghost-B'], repeat: 2, mode: 'static' }],
        intent: intent(10),
      }),
      resolvePhysicPaintRotoPhysicalEdit({ ...base, intent: intent(-1) }),
      resolvePhysicPaintRotoPhysicalEdit({ ...base, intent: intent(16) }),
      resolvePhysicPaintRotoPhysicalEdit({ ...base, intent: intent(3, { appFrame: 3, dataUrl: '' } as never) }),
    ];

    expect(resolutions).toHaveLength(7);
    for (const resolution of resolutions) {
      expect(resolution.ok).toBe(false);
      expect('proposal' in resolution).toBe(false);
    }
  });

  it('keeps break ownership dormant while interpolation is off or the owner is first', () => {
    const identities = [
      { keyId: 'owner', appFrame: 0 },
      { keyId: 'later', appFrame: 3 },
    ];
    const off = projectPhysicPaintRotoPhysicalTimeline({
      identities,
      capacity: 4,
      interpolationEnabled: false,
      incomingInterpolationBreakKeyIds: ['owner'],
    });
    const dormant = projectPhysicPaintRotoPhysicalTimeline({
      identities,
      capacity: 4,
      interpolationEnabled: true,
      incomingInterpolationBreakKeyIds: ['owner'],
    });
    const active = projectPhysicPaintRotoPhysicalTimeline({
      identities: [
        { keyId: 'earlier', appFrame: 0 },
        { keyId: 'owner', appFrame: 3 },
        { keyId: 'later', appFrame: 6 },
      ],
      capacity: 7,
      interpolationEnabled: true,
      incomingInterpolationBreakKeyIds: ['owner'],
    });

    expect(off.ok && off.projection.generatedCells).toEqual([]);
    expect(dormant.ok && dormant.projection.generatedCells.map((cell) => cell.appFrame)).toEqual([1, 2]);
    expect(active.ok && active.projection.generatedCells.map((cell) => cell.appFrame)).toEqual([4, 5]);
  });
});

describe('incoming interpolation break lifecycle', () => {
  it('preserves destination ownership while fresh paste and duplicate identities omit source breaks', () => {
    const records = buildBaselineRecords();
    const common = {
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records,
      parentEndExclusive: 16,
      capacity: 16,
      interpolationEnabled: true,
    } as const;
    const replacement = resolvePhysicPaintRotoPhysicalEdit({
      ...common,
      incomingInterpolationBreakKeyIds: ['B'],
      intent: {
        kind: 'paste-key',
        destinationAppFrame: 3,
        destinationKeyId: 'B',
        newKeyId: null,
        clipboardPayload: records[0].payload,
      },
    });
    const freshPaste = resolvePhysicPaintRotoPhysicalEdit({
      ...common,
      incomingInterpolationBreakKeyIds: ['A'],
      intent: {
        kind: 'paste-key',
        destinationAppFrame: 7,
        destinationKeyId: null,
        newKeyId: 'pasted-X',
        clipboardPayload: records[0].payload,
      },
    });
    const duplicate = resolvePhysicPaintRotoPhysicalEdit({
      ...common,
      incomingInterpolationBreakKeyIds: ['A'],
      intent: { kind: 'duplicate-key', sourceKeyId: 'A', newKeyId: 'duplicate-X' },
    });

    expect(replacement.ok).toBe(true);
    if (!replacement.ok) throw new Error('Replacement paste must resolve');
    expect(replacement.proposal.nextIncomingInterpolationBreakKeyIds).toBeNull();
    expect(replacement.proposal.generatedCells.some((cell) => cell.kind === 'generated' && cell.rightKeyId ==='B')).toBe(false);
    expect(freshPaste.ok).toBe(true);
    if (!freshPaste.ok) throw new Error('Fresh paste must resolve');
    expect(freshPaste.proposal.nextIncomingInterpolationBreakKeyIds).toBeNull();
    expect(freshPaste.proposal.generatedCells.some((cell) => cell.kind === 'generated' && cell.rightKeyId ==='pasted-X')).toBe(true);
    expect(duplicate.ok).toBe(true);
    if (!duplicate.ok) throw new Error('Duplicate must resolve');
    expect(duplicate.proposal.nextIncomingInterpolationBreakKeyIds).toBeNull();
    expect(duplicate.proposal.generatedCells.some((cell) => cell.kind === 'generated' && cell.rightKeyId ==='duplicate-X')).toBe(false);
  });

  it('carries owner identities through drag, push, and partial spacing mappings', () => {
    const records = buildBaselineRecords();
    const resolve = (intent: PhysicPaintRotoPhysicalEditIntent, owner: string) => resolvePhysicPaintRotoPhysicalEdit({
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records,
      intent,
      parentEndExclusive: 16,
      capacity: 16,
      interpolationEnabled: true,
      incomingInterpolationBreakKeyIds: [owner],
    });
    const cases = [
      { owner: 'B', resolution: resolve({ kind: 'move-key', movedKeyId: 'B', target: { kind: 'physical-cell', appFrame: 4 } }, 'B') },
      { owner: 'C', resolution: resolve({ kind: 'move-key-group', movedKeyIds: ['B', 'C'], grabbedKeyId: 'B', target: { kind: 'physical-cell', appFrame: 6 } }, 'C') },
      { owner: 'B', resolution: resolve({ kind: 'move-key', movedKeyId: 'B', target: { kind: 'before-key', targetKeyId: 'D' } }, 'B') },
      { owner: 'B', resolution: resolve({ kind: 'move-key', movedKeyId: 'B', target: { kind: 'after-key', targetKeyId: 'D' } }, 'B') },
      { owner: 'C', resolution: resolve({ kind: 'force-spacing', emptyFrames: 2, selectedKeyId: 'C', scopeKeyIds: ['B', 'C'] }, 'C') },
    ];

    for (const { owner, resolution } of cases) {
      expect(resolution.ok).toBe(true);
      if (!resolution.ok) throw new Error('Identity-preserving timing edit must resolve');
      expect(resolution.proposal.nextIncomingInterpolationBreakKeyIds).toBeNull();
      expect(resolution.proposal.generatedCells.some((cell) => cell.kind === 'generated' && cell.rightKeyId ===owner)).toBe(false);
    }
  });

  it('removes deleted break owners without transferring ownership', () => {
    const records = buildBaselineRecords();
    const single = resolvePhysicPaintRotoPhysicalEdit({
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records,
      intent: { kind: 'delete-key', selectedKeyId: 'B' },
      parentEndExclusive: 16,
      capacity: 16,
      interpolationEnabled: true,
      incomingInterpolationBreakKeyIds: ['B', 'D'],
    });
    const group = resolvePhysicPaintRotoPhysicalEdit({
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records,
      intent: { kind: 'delete-key-group', keyIds: ['B', 'D'] },
      parentEndExclusive: 16,
      capacity: 16,
      interpolationEnabled: true,
      incomingInterpolationBreakKeyIds: ['B', 'C', 'D'],
    });

    expect(single.ok).toBe(true);
    if (!single.ok) throw new Error('Single delete must resolve');
    expect(single.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['D']);
    expect(single.proposal.generatedCells.some((cell) => cell.kind === 'generated' && cell.rightKeyId ==='C')).toBe(true);
    expect(group.ok).toBe(true);
    if (!group.ok) throw new Error('Group delete must resolve');
    expect(group.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['C']);
  });

  // --- Quick 260816-tv7: swapped Insert-connects / Paint-breaks semantics ---

  it('paste-to-empty with startsNewSegment makes the new key own an incoming break', () => {
    const records = buildBaselineRecords();
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records,
      intent: {
        kind: 'paste-key',
        destinationAppFrame: 7,
        destinationKeyId: null,
        newKeyId: 'painted-X',
        clipboardPayload: records[0].payload,
        startsNewSegment: true,
      },
      parentEndExclusive: 16,
      capacity: 16,
      interpolationEnabled: true,
      incomingInterpolationBreakKeyIds: ['A'],
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Broken paste-to-empty must resolve');
    expect(resolution.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['A', 'painted-X']);
    expect(resolution.proposal.generatedCells.some((cell) => cell.kind === 'generated' && cell.rightKeyId === 'painted-X')).toBe(false);
  });

  it('paste-to-empty without startsNewSegment stays connected (Copy/Paste regression)', () => {
    const records = buildBaselineRecords();
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records,
      intent: {
        kind: 'paste-key',
        destinationAppFrame: 7,
        destinationKeyId: null,
        newKeyId: 'pasted-X',
        clipboardPayload: records[0].payload,
      },
      parentEndExclusive: 16,
      capacity: 16,
      interpolationEnabled: true,
      incomingInterpolationBreakKeyIds: ['A'],
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Connected paste-to-empty must resolve');
    expect(resolution.proposal.nextIncomingInterpolationBreakKeyIds).toBeNull();
    expect(resolution.proposal.generatedCells.some((cell) => cell.kind === 'generated' && cell.rightKeyId === 'pasted-X')).toBe(true);
  });

  it('insert-empty-segment inside an intentional gap connects left and preserves the right break', () => {
    const records = buildBaselineRecords();
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records,
      intent: {
        kind: 'insert-empty-segment',
        destinationAppFrame: 7,
        insertedKeyId: 'blank-7',
        blankPayload: {
          frameIndex: 0,
          appFrame: 7,
          dataUrl: 'data:image/png;base64,AAAA',
          width: 2,
          height: 2,
        },
      },
      parentEndExclusive: 16,
      capacity: 16,
      interpolationEnabled: true,
      incomingInterpolationBreakKeyIds: ['D'],
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Gap insert must resolve');
    expect(resolution.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['D']);
    expect(resolution.proposal.generatedCells.some((cell) => cell.kind === 'generated' && cell.rightKeyId === 'blank-7')).toBe(true);
    expect(resolution.proposal.generatedCells.some((cell) => cell.kind === 'generated' && cell.rightKeyId === 'D')).toBe(false);
  });

  // --- Task 3 (plan 02): stable-key-owned break derivation for move-group (D-09..D-13) ---

  /** Source-attached Group over A@1/C@5 with lifecycle extent [1,9). */
  const buildGroupAt = (overrides: Partial<PhysicPaintRotoLoopClip> = {}): readonly PhysicPaintRotoLoopClip[] => Object.freeze([
    Object.freeze({
      loopId: 'loop-A',
      placementStart: 1,
      sourceKeyIds: ['A', 'C'],
      repeat: 2,
      mode: 'static',
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 1,
      originalEndExclusive: 9,
      visibleRanges: Object.freeze([
        Object.freeze({ start: 1, endExclusive: 4 }),
        Object.freeze({ start: 5, endExclusive: 9 }),
      ]),
      frameOverrides: Object.freeze([]),
      ...overrides,
    }) as PhysicPaintRotoLoopClip,
  ]);

  const resolveMove = (
    identities: readonly PhysicPaintRotoKeyIdentity[],
    loopClips: readonly PhysicPaintRotoLoopClip[],
    loopId: string,
    destinationPlacementStart: number,
    extra: { readonly incomingInterpolationBreakKeyIds?: readonly string[]; readonly capacity?: number } = {},
  ): PhysicPaintRotoPhysicalEditResolution => resolvePhysicPaintRotoPhysicalEdit({
    identities,
    intent: { kind: 'move-group', loopId, destinationPlacementStart },
    parentEndExclusive: 16,
    capacity: 16,
    interpolationEnabled: true,
    loopClips,
    ...extra,
  });

  const resolveGroupMove = (
    loopClips: readonly PhysicPaintRotoLoopClip[],
    loopId: string,
    destinationPlacementStart: number,
    extra: { readonly incomingInterpolationBreakKeyIds?: readonly string[] } = {},
  ): PhysicPaintRotoPhysicalEditResolution => resolveMove(buildBaselineIdentities(), loopClips, loopId, destinationPlacementStart, extra);

  it('D-09: gives the vacated interval successor the incoming break, never a standalone gap record', () => {
    // Group [1,9) with A@1/C@5 clamps to destination 2 (interval [2,10) stops at
    // unowned D@10). The vacated interval [1,9) leaves D@10 as the next real key
    // after it, so D owns the incoming break: the [7,9) tail of the vacated span
    // is never interpolated. No standalone frame-range gap record exists.
    const resolution = resolveGroupMove(buildGroupAt(), 'loop-A', 4);

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Source-attached move must resolve');
    const { proposal } = resolution;
    expect(Object.fromEntries(proposal.mapping)).toEqual({ A: 2, B: 3, C: 6, D: 10 });
    expect(proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['D']);
    expect(proposal.semanticDelta).toBeNull();
    expect(proposal.drag).toBeNull();
    expect(proposal.generatedCells.some((cell) => cell.appFrame === 7 || cell.appFrame === 8)).toBe(false);
    // The projection interpolates the full B@3→C@6 interior (frames 4,5); the
    // Group's visible-range gap at frame 5 is masked at the loop-clip layer,
    // not the projection layer (the projection knows no visible ranges).
    expect(proposal.generatedCells.map((cell) => cell.appFrame)).toEqual([4, 5]);
  });

  it('selects a genuine vacated successor from pre-move external identities and excludes moved Group ownership', () => {
    const identities = [
      { keyId: 'A', appFrame: 1 },
      { keyId: 'C', appFrame: 8 },
      { keyId: 'override-owned', appFrame: 9 },
      { keyId: 'D', appFrame: 12 },
    ] as const;
    const group = buildGroupAt({
      sourceKeyIds: ['A', 'C'],
      repeat: 1,
      originalEndExclusive: 9,
      visibleRanges: Object.freeze([Object.freeze({ start: 1, endExclusive: 9 })]),
      frameOverrides: Object.freeze([
        Object.freeze({ appFrame: 8, keyId: 'override-owned' }),
      ]),
    });

    const resolution = resolveMove(identities, group, 'loop-A', 3);

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Owned-key exclusion move must resolve');
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({
      A: 3,
      C: 10,
      'override-owned': 9,
      D: 12,
    });
    expect(resolution.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['D']);
    expect(resolution.proposal.nextIncomingInterpolationBreakKeyIds).not.toContain('C');
    expect(resolution.proposal.nextIncomingInterpolationBreakKeyIds).not.toContain('override-owned');
  });

  it('D-10: opens a landing-gap break on the first source key, never on an adjacent landing', () => {
    const identities = [
      { keyId: 'P', appFrame: 0 },
      { keyId: 'A', appFrame: 2 },
      { keyId: 'C', appFrame: 6 },
    ] as const;
    const group = buildGroupAt({
      placementStart: 2,
      phaseOrigin: 2,
      originalEndExclusive: 10,
      visibleRanges: Object.freeze([Object.freeze({ start: 2, endExclusive: 10 })]),
    });

    // Rightward to 5: A lands at 5 with predecessor P@0 and an opened gap [1,5),
    // so A owns a NEW incoming break; the vacated interval [2,10) has no
    // successor (content ends at C@9).
    const gapped = resolveMove(identities, group, 'loop-A', 5);
    expect(gapped.ok).toBe(true);
    if (!gapped.ok) throw new Error('Gapped landing must resolve');
    expect(Object.fromEntries(gapped.proposal.mapping)).toEqual({ P: 0, A: 5, C: 9 });
    expect(gapped.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['A']);
    expect(gapped.proposal.generatedCells.some((cell) => cell.kind === 'generated' && cell.rightKeyId === 'A')).toBe(false);
    expect(gapped.proposal.generatedCells.some((cell) => cell.kind === 'generated' && cell.rightKeyId === 'C')).toBe(true);

    // Leftward to 1: A lands adjacent to P@0 — no landing-gap break.
    const adjacent = resolveMove(identities, group, 'loop-A', 1);
    expect(adjacent.ok).toBe(true);
    if (!adjacent.ok) throw new Error('Adjacent landing must resolve');
    expect(Object.fromEntries(adjacent.proposal.mapping)).toEqual({ P: 0, A: 1, C: 5 });
    expect(adjacent.proposal.nextIncomingInterpolationBreakKeyIds).toEqual([]);
  });

  it('43.1 D-14: carries breaks owned by moved keys unchanged through the drag', () => {
    // Input break on C (a moved source key). The drag adds the vacated-successor
    // break on D but never removes or duplicates the C break (D-10).
    const resolution = resolveGroupMove(buildGroupAt(), 'loop-A', 4, { incomingInterpolationBreakKeyIds: ['C'] });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Identity-travel move must resolve');
    const { proposal } = resolution;
    expect(Object.fromEntries(proposal.mapping)).toEqual({ A: 2, B: 3, C: 6, D: 10 });
    expect(proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['C', 'D']);
    expect(proposal.generatedCells.some((cell) => cell.kind === 'generated' && cell.rightKeyId === 'C')).toBe(false);
    expect(proposal.generatedCells.some((cell) => cell.kind === 'generated' && cell.rightKeyId === 'D')).toBe(false);
  });

  it('D-12: no break when nothing would interpolate across the gap', () => {
    const identities = [
      { keyId: 'P', appFrame: 0 },
      { keyId: 'A', appFrame: 2 },
      { keyId: 'C', appFrame: 6 },
    ] as const;
    const group = buildGroupAt({
      placementStart: 2,
      phaseOrigin: 2,
      originalEndExclusive: 10,
      visibleRanges: Object.freeze([Object.freeze({ start: 2, endExclusive: 10 })]),
    });

    // (i) Vacated interval [2,10) at end of content (no successor after frame 10):
    // only the landing-gap break on A appears — the vacated rule contributes none.
    const vacatedAtEnd = resolveMove(identities, group, 'loop-A', 5);
    expect(vacatedAtEnd.ok).toBe(true);
    if (!vacatedAtEnd.ok) throw new Error('Vacated-at-end move must resolve');
    expect(vacatedAtEnd.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['A']);

    // (ii) Landing before all content: A lands at 0 (first key, no predecessor),
    // so no landing-gap break, and the vacated interval has no successor.
    const noPredecessor = resolveMove(
      [
        { keyId: 'A', appFrame: 2 },
        { keyId: 'C', appFrame: 6 },
      ] as const,
      group,
      'loop-A',
      0,
    );
    expect(noPredecessor.ok).toBe(true);
    if (!noPredecessor.ok) throw new Error('No-predecessor move must resolve');
    expect(Object.fromEntries(noPredecessor.proposal.mapping)).toEqual({ A: 0, C: 4 });
    expect(noPredecessor.proposal.nextIncomingInterpolationBreakKeyIds).toEqual([]);
  });

  it('D-11: a duplicated placement move preserves existing breaks without manufacturing a vacated successor', () => {
    const baseIdentities = [
      { keyId: 'A', appFrame: 1 },
      { keyId: 'B', appFrame: 3 },
      { keyId: 'C', appFrame: 5 },
      { keyId: 'D', appFrame: 10 },
    ] as const;
    const duplicated = (): readonly PhysicPaintRotoLoopClip[] => Object.freeze([
      Object.freeze({
        loopId: 'loop-B',
        placementStart: 12,
        sourceKeyIds: ['A', 'C'],
        repeat: 2,
        mode: 'progressive',
        syncState: 'synchronized',
        provenanceState: 'attached',
        phaseOrigin: 12,
        originalEndExclusive: 20,
        visibleRanges: Object.freeze([
          Object.freeze({ start: 12, endExclusive: 15 }),
          Object.freeze({ start: 17, endExclusive: 20 }),
        ]),
        frameOverrides: Object.freeze([]),
      }) as PhysicPaintRotoLoopClip,
    ]);

    // (i) A placement-only move translates no physical keys, so external E@24
    // does not become a manufactured vacated-gap owner.
    const withSuccessor = [
      ...baseIdentities,
      { keyId: 'E', appFrame: 24 },
    ] as const;
    const vacated = resolveMove(withSuccessor, duplicated(), 'loop-B', 14, { capacity: 30 });
    expect(vacated.ok).toBe(true);
    if (!vacated.ok) throw new Error('Duplicated placement-only move must resolve');
    expect(vacated.proposal.nextIncomingInterpolationBreakKeyIds).toEqual([]);

    // (ii) An existing stable-ID break on E is preserved, never duplicated.
    const reused = resolveMove(withSuccessor, duplicated(), 'loop-B', 14, { capacity: 30, incomingInterpolationBreakKeyIds: ['E'] });
    expect(reused.ok).toBe(true);
    if (!reused.ok) throw new Error('Duplicated reuse move must resolve');
    expect(reused.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['E']);

    // (iii) No successor: the collection equals the input — existing
    // destination-gap breaks are preserved and reused. Capacity must cover the
    // duplicated interval [12,20) or the clamp rejects the destination.
    const noGap = resolveMove(baseIdentities, duplicated(), 'loop-B', 14, { incomingInterpolationBreakKeyIds: ['C'], capacity: 30 });
    expect(noGap.ok).toBe(true);
    if (!noGap.ok) throw new Error('Duplicated no-gap move must resolve');
    expect(noGap.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['C']);
  });

  it('D-13: Group-local deleted phases and visibleRanges travel rigidly and never become key-owned breaks', () => {
    // The plan-01 Group carries frameOverrides (deleted phases) and a visibleRanges
    // gap [4,5). Moving it clamps to 2; the ONLY break is the external
    // vacated-interval successor D@10. The internal fragments translate rigidly.
    const groupWithLocalGaps = buildGroupAt({
      frameOverrides: Object.freeze([
        Object.freeze({ appFrame: 3, keyId: 'override-3' }),
        Object.freeze({ appFrame: 7, keyId: 'override-7' }),
      ]),
    });
    const resolution = resolveGroupMove(groupWithLocalGaps, 'loop-A', 4);

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('D-13 move must resolve');
    const { proposal } = resolution;
    expect(Object.fromEntries(proposal.mapping)).toEqual({ A: 2, B: 3, C: 6, D: 10 });
    expect(proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['D']);
    expect(proposal.nextLoopClips).not.toBeNull();
    if (!proposal.nextLoopClips) throw new Error('nextLoopClips must be present');
    const movedClip = proposal.nextLoopClips.find((clip) => clip.loopId === 'loop-A');
    expect(movedClip?.visibleRanges).toEqual([
      { start: 2, endExclusive: 5 },
      { start: 6, endExclusive: 10 },
    ]);
    expect(movedClip?.frameOverrides).toEqual([
      { appFrame: 4, keyId: 'override-3' },
      { appFrame: 8, keyId: 'override-7' },
    ]);
  });
});

describe('resolvePhysicPaintRotoPhysicalEdit — rigid move-key-group', () => {
  it('translates A@0 and B@1 to A@5 and B@6 without moving D@7', () => {
    const resolution = resolveIdentities([
      { keyId: 'A', appFrame: 0 },
      { keyId: 'B', appFrame: 1 },
      { keyId: 'D', appFrame: 7 },
    ], {
      kind: 'move-key-group',
      movedKeyIds: ['A', 'B'],
      grabbedKeyId: 'B',
      target: { kind: 'physical-cell', appFrame: 6 },
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Rigid group translation must resolve ok');
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({ A: 5, B: 6, D: 7 });
    expect(resolution.proposal.changes).toEqual([
      { keyId: 'A', beforeAppFrame: 0, afterAppFrame: 5, role: 'moved' },
      { keyId: 'B', beforeAppFrame: 1, afterAppFrame: 6, role: 'moved' },
    ]);
    expect(resolution.proposal.selectedKeyId).toBe('B');
    expect(resolution.proposal.selectedAppFrame).toBe(6);
  });

  it('keeps unselected keys fixed for a whole-cell drop', () => {
    const resolution = resolveBaseline({
      kind: 'move-key-group',
      movedKeyIds: ['B', 'C'],
      grabbedKeyId: 'B',
      target: { kind: 'physical-cell', appFrame: 7 },
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Whole-cell group translation must resolve ok');
    const { proposal } = resolution;
    expect(Object.fromEntries(proposal.mapping)).toEqual({ A: 1, B: 7, C: 9, D: 10 });
    expect(proposal.drag).toEqual({
      targetKind: 'physical-cell',
      targetKeyId: null,
      resolvedInsertionAppFrame: 7,
      movedKeyId: 'B',
      movedKeyIds: ['B', 'C'],
      grabbedKeyId: 'B',
    });
    expect(proposal.status.operationKind).toBe('move-key-group');
    expect(proposal.status.text).toBe('Keys moved');
  });

  it('maps before-caret and after-caret to the adjacent physical frame without rippling the target key', () => {
    const before = resolveBaseline({
      kind: 'move-key-group',
      movedKeyIds: ['B', 'C'],
      grabbedKeyId: 'B',
      target: { kind: 'before-key', targetKeyId: 'D' },
    });
    expect(before.ok).toBe(true);
    if (!before.ok) throw new Error('Before-caret group translation must resolve ok');
    expect(Object.fromEntries(before.proposal.mapping)).toEqual({ A: 1, B: 9, C: 11, D: 10 });
    expect(before.proposal.drag).toMatchObject({
      targetKind: 'before-key',
      targetKeyId: 'D',
      resolvedInsertionAppFrame: 9,
    });

    const after = resolveBaseline({
      kind: 'move-key-group',
      movedKeyIds: ['B', 'C'],
      grabbedKeyId: 'B',
      target: { kind: 'after-key', targetKeyId: 'D' },
    });
    expect(after.ok).toBe(true);
    if (!after.ok) throw new Error('After-caret group translation must resolve ok');
    expect(Object.fromEntries(after.proposal.mapping)).toEqual({ A: 1, B: 11, C: 13, D: 10 });
    expect(after.proposal.drag).toMatchObject({
      targetKind: 'after-key',
      targetKeyId: 'D',
      resolvedInsertionAppFrame: 11,
    });
  });

  it('rejects whole-cell and caret translations that collide with an unselected key', () => {
    const identities = [
      { keyId: 'A', appFrame: 0 },
      { keyId: 'B', appFrame: 1 },
      { keyId: 'D', appFrame: 7 },
    ];
    const targets = [
      { grabbedKeyId: 'B', target: { kind: 'physical-cell', appFrame: 7 } as const },
      { grabbedKeyId: 'A', target: { kind: 'before-key', targetKeyId: 'D' } as const },
      { grabbedKeyId: 'B', target: { kind: 'after-key', targetKeyId: 'D' } as const },
    ];

    for (const { grabbedKeyId, target } of targets) {
      const resolution = resolveIdentities(identities, {
        kind: 'move-key-group',
        movedKeyIds: ['A', 'B'],
        grabbedKeyId,
        target,
      });
      expect(resolution.ok).toBe(false);
      if (resolution.ok) throw new Error('Colliding rigid translation must reject');
      expect(resolution.failure.code).toBe('duplicate-destination-frame');
      expect(resolution.failure.conflictingAppFrames).toEqual([7]);
    }
  });

  it('rejects forward overflow and reverse underflow atomically', () => {
    const identities = [
      { keyId: 'A', appFrame: 0 },
      { keyId: 'B', appFrame: 2 },
      { keyId: 'D', appFrame: 7 },
    ];
    const overflow = resolveIdentities(identities, {
      kind: 'move-key-group',
      movedKeyIds: ['A', 'B'],
      grabbedKeyId: 'A',
      target: { kind: 'physical-cell', appFrame: 9 },
    }, 10);
    expect(overflow.ok).toBe(false);
    if (overflow.ok) throw new Error('Forward overflow must reject');
    expect(overflow.failure.code).toBe('over-capacity');

    const underflow = resolveIdentities(identities, {
      kind: 'move-key-group',
      movedKeyIds: ['A', 'B'],
      grabbedKeyId: 'B',
      target: { kind: 'physical-cell', appFrame: 0 },
    }, 10);
    expect(underflow.ok).toBe(false);
    if (underflow.ok) throw new Error('Reverse underflow must reject');
    expect(underflow.failure.code).toBe('over-capacity');
  });

  it('supports reverse movement while preserving the selected offset', () => {
    const resolution = resolveBaseline({
      kind: 'move-key-group',
      movedKeyIds: ['B', 'C'],
      grabbedKeyId: 'C',
      target: { kind: 'physical-cell', appFrame: 2 },
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Reverse rigid translation must resolve ok');
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({ A: 1, B: 0, C: 2, D: 10 });
    expect(resolution.proposal.selectedKeyId).toBe('C');
    expect(resolution.proposal.selectedAppFrame).toBe(2);
  });

  it('preserves offsets for a non-contiguous selection and leaves intervening keys fixed', () => {
    const resolution = resolveBaseline({
      kind: 'move-key-group',
      movedKeyIds: ['A', 'C'],
      grabbedKeyId: 'C',
      target: { kind: 'physical-cell', appFrame: 8 },
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Non-contiguous rigid translation must resolve ok');
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({ A: 4, B: 3, C: 8, D: 10 });
  });

  it('fails closed on unknown, duplicate, or non-member intent identities with no proposal', () => {
    const unknownMember = resolveBaseline({
      kind: 'move-key-group',
      movedKeyIds: ['B', 'Z'],
      grabbedKeyId: 'B',
      target: { kind: 'physical-cell', appFrame: 7 },
    });
    expect(unknownMember.ok).toBe(false);
    if (unknownMember.ok) throw new Error('unknown member must reject');
    expect(unknownMember.failure.code).toBe('unknown-operation-identity');

    const duplicateMember = resolveBaseline({
      kind: 'move-key-group',
      movedKeyIds: ['B', 'B'],
      grabbedKeyId: 'B',
      target: { kind: 'physical-cell', appFrame: 7 },
    });
    expect(duplicateMember.ok).toBe(false);
    if (duplicateMember.ok) throw new Error('duplicate member must reject');
    expect(duplicateMember.failure.code).toBe('duplicate-id');

    const grabbedOutsideSet = resolveBaseline({
      kind: 'move-key-group',
      movedKeyIds: ['B', 'C'],
      grabbedKeyId: 'A',
      target: { kind: 'physical-cell', appFrame: 7 },
    });
    expect(grabbedOutsideSet.ok).toBe(false);
    if (grabbedOutsideSet.ok) throw new Error('grabbed key outside the moved set must reject');
    expect(grabbedOutsideSet.failure.code).toBe('malformed-identity');
  });
});

describe('resolvePhysicPaintRotoPhysicalEdit — move-group (source-attached free-space)', () => {
  const buildSourceAttachedGroup = (): readonly PhysicPaintRotoLoopClip[] => Object.freeze([
    Object.freeze({
      loopId: 'loop-A',
      placementStart: 1,
      sourceKeyIds: ['A', 'C'],
      repeat: 2,
      mode: 'static',
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 1,
      originalEndExclusive: 9,
      visibleRanges: Object.freeze([
        Object.freeze({ start: 1, endExclusive: 4 }),
        Object.freeze({ start: 5, endExclusive: 9 }),
      ]),
      frameOverrides: Object.freeze([
        Object.freeze({ appFrame: 3, keyId: 'override-3' }),
        Object.freeze({ appFrame: 7, keyId: 'override-7' }),
      ]),
    }),
  ]);

  it('rigidly translates every source key and the Group lifecycle fields by the same delta', () => {
    const records = buildBaselineRecords();
    const loopClips = buildSourceAttachedGroup();
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records,
      intent: { kind: 'move-group', loopId: 'loop-A', destinationPlacementStart: 4 },
      parentEndExclusive: 16,
      capacity: 16,
      interpolationEnabled: false,
      loopClips,
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Source-attached move-group must resolve ok');
    const { proposal } = resolution;
    // D-08 clamp-and-commit (plan 02 Task 1): the proposed destination 4 would
    // place the interval [4,12) over unowned real key D@10, so the pure clamp
    // commits at the nearest free placement 2 (next real key frame 10 minus
    // interval width 8). delta = 2 - 1 = 1; A@1 -> 2, C@5 -> 6; B@3 and D@10
    // stay fixed. The lifecycle fields still translate by the SAME signed delta.
    expect(Object.fromEntries(proposal.mapping)).toEqual({ A: 2, B: 3, C: 6, D: 10 });
    expect(proposal.status.operationKind).toBe('move-group');
    expect(proposal.nextLoopClips).not.toBeNull();
    if (!proposal.nextLoopClips) throw new Error('nextLoopClips must be present');
    const movedClip = proposal.nextLoopClips.find((clip) => clip.loopId === 'loop-A');
    expect(movedClip).toBeDefined();
    expect(movedClip?.placementStart).toBe(2);
    expect(movedClip?.phaseOrigin).toBe(2);
    expect(movedClip?.originalEndExclusive).toBe(10);
    expect(movedClip?.visibleRanges).toEqual([
      { start: 2, endExclusive: 5 },
      { start: 6, endExclusive: 10 },
    ]);
    expect(movedClip?.frameOverrides).toEqual([
      { appFrame: 4, keyId: 'override-3' },
      { appFrame: 8, keyId: 'override-7' },
    ]);
  });

  it('fails closed on unknown loopId and out-of-capacity destinations with no proposal', () => {
    const records = buildBaselineRecords();
    const loopClips = buildSourceAttachedGroup();
    const base = {
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records,
      parentEndExclusive: 16,
      capacity: 16,
      interpolationEnabled: false,
      loopClips,
    } as const;

    const unknownLoop = resolvePhysicPaintRotoPhysicalEdit({
      ...base,
      intent: { kind: 'move-group', loopId: 'loop-unknown', destinationPlacementStart: 4 },
    });
    expect(unknownLoop.ok).toBe(false);
    if (unknownLoop.ok) throw new Error('unknown loopId must reject');
    expect(unknownLoop.failure.code).toBe('unknown-operation-identity');
    expect('proposal' in unknownLoop).toBe(false);

    const overflow = resolvePhysicPaintRotoPhysicalEdit({
      ...base,
      intent: { kind: 'move-group', loopId: 'loop-A', destinationPlacementStart: 20 },
    });
    expect(overflow.ok).toBe(false);
    if (overflow.ok) throw new Error('out-of-capacity destination must reject');
    expect(overflow.failure.code).toBe('out-of-range-frame');
    expect('proposal' in overflow).toBe(false);
  });

  it('resolves a placement whose start differs from its first source key frame as a placement-only move', () => {
    // Task 2 (D-11): a placement that does not coincide with its first source
    // key frame is a duplicated shared-source placement, not a malformed Group.
    // The move maps every key to its current frame (identity, zero key movement)
    // and translates only the dragged clip's placementStart to the destination.
    const records = buildBaselineRecords();
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records,
      parentEndExclusive: 16,
      capacity: 16,
      interpolationEnabled: false,
      loopClips: Object.freeze([
        Object.freeze({
          loopId: 'loop-detached',
          placementStart: 2,
          sourceKeyIds: ['A', 'C'],
          repeat: 2,
          mode: 'static',
        }),
      ]),
      intent: { kind: 'move-group', loopId: 'loop-detached', destinationPlacementStart: 4 },
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('duplicated placement must resolve ok');
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({ A: 1, B: 3, C: 5, D: 10 });
    expect(resolution.proposal.nextLoopClips).not.toBeNull();
    if (!resolution.proposal.nextLoopClips) throw new Error('nextLoopClips must be present');
    const movedClip = resolution.proposal.nextLoopClips.find((clip) => clip.loopId === 'loop-detached');
    expect(movedClip?.placementStart).toBe(4);
    expect(movedClip?.sourceKeyIds).toEqual(['A', 'C']);
  });

  it('clamps a destination that would translate a key outside capacity into free space', () => {
    // D-08 clamp-and-commit (plan 02 Task 1): destination 12 stays inside the
    // 16-frame capacity as a proposed value, but the derived interval [12,20)
    // exceeds both capacity and the D@10 boundary, so the clamp commits at the
    // nearest free placement 2 instead of rejecting over-capacity.
    const records = buildBaselineRecords();
    const loopClips = buildSourceAttachedGroup();
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records,
      intent: { kind: 'move-group', loopId: 'loop-A', destinationPlacementStart: 12 },
      parentEndExclusive: 16,
      capacity: 16,
      interpolationEnabled: false,
      loopClips,
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Out-of-capacity-key destination must clamp and commit');
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({ A: 2, B: 3, C: 6, D: 10 });
  });
});

describe('resolvePhysicPaintRotoPhysicalEdit — move-group clamp matrix (D-05, D-08)', () => {
  /**
   * Clean source-attached Group over A@1/C@5 with a single full-range lifecycle
   * record [1,9) (span 8). No unowned real key lies inside the own interval, so
   * every external boundary below is unambiguous.
   */
  const buildClampGroup = (overrides: Partial<PhysicPaintRotoLoopClip> = {}): readonly PhysicPaintRotoLoopClip[] => Object.freeze([
    Object.freeze({
      loopId: 'loop-R',
      placementStart: 1,
      sourceKeyIds: ['A', 'C'],
      repeat: 2,
      mode: 'static',
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 1,
      originalEndExclusive: 9,
      visibleRanges: Object.freeze([Object.freeze({ start: 1, endExclusive: 9 })]),
      frameOverrides: Object.freeze([]),
      ...overrides,
    }) as PhysicPaintRotoLoopClip,
  ]);

  const resolveMoveGroup = (
    identities: readonly PhysicPaintRotoKeyIdentity[],
    loopClips: readonly PhysicPaintRotoLoopClip[],
    loopId: string,
    destinationPlacementStart: number,
    capacity = PHYSIC_PAINT_MAX_APPLY_FRAMES,
  ): PhysicPaintRotoPhysicalEditResolution => resolvePhysicPaintRotoPhysicalEdit({
    identities,
    intent: { kind: 'move-group', loopId, destinationPlacementStart },
    parentEndExclusive: capacity,
    capacity,
    interpolationEnabled: false,
    loopClips,
  });

  it('clamps a rightward drag at the next real key frame minus interval width and commits there', () => {
    // Group [1,9) has span 8; unowned real key D@10 bounds the rightward drag.
    // Next real key frame 10 minus interval width 8 = destination 2.
    const resolution = resolveMoveGroup(
      [
        { keyId: 'A', appFrame: 1 },
        { keyId: 'C', appFrame: 5 },
        { keyId: 'D', appFrame: 10 },
      ],
      buildClampGroup(),
      'loop-R',
      5,
    );

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Clamped rightward drag must resolve ok');
    const { proposal } = resolution;
    // delta = 2 - 1 = 1; A@1 -> 2, C@5 -> 6, D@10 stays fixed.
    expect(Object.fromEntries(proposal.mapping)).toEqual({ A: 2, C: 6, D: 10 });
    expect(proposal.status.operationKind).toBe('move-group');
    expect(proposal.nextLoopClips).not.toBeNull();
    if (!proposal.nextLoopClips) throw new Error('nextLoopClips must be present');
    const movedClip = proposal.nextLoopClips.find((clip) => clip.loopId === 'loop-R');
    expect(movedClip?.placementStart).toBe(2);
    expect(movedClip?.phaseOrigin).toBe(2);
    expect(movedClip?.originalEndExclusive).toBe(10);
  });

  it('clamps a leftward drag at the previous real key following frame', () => {
    // Group [2,10) has span 8; unowned real key P@0 sits before it. The proposed
    // destination 0 would push the interval [0,8) over P@0, so the clamp pulls
    // the placement back to P@0 + 1 = 1 ("the previous key's following frame").
    const resolution = resolveMoveGroup(
      [
        { keyId: 'P', appFrame: 0 },
        { keyId: 'A', appFrame: 2 },
        { keyId: 'C', appFrame: 6 },
      ],
      buildClampGroup({
        placementStart: 2,
        phaseOrigin: 2,
        originalEndExclusive: 10,
        // The visible range must match the moved origin: the derivation projects
        // effectiveEnd from visibleRanges, so a stale [{1,9}] would yield span 7.
        visibleRanges: Object.freeze([Object.freeze({ start: 2, endExclusive: 10 })]),
      }),
      'loop-R',
      0,
    );

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Clamped leftward drag must resolve ok');
    // delta = 1 - 2 = -1; A@2 -> 1, C@6 -> 5.
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({ P: 0, A: 1, C: 5 });
    expect(resolution.proposal.nextLoopClips?.[0]?.placementStart).toBe(1);
  });

  it('clamps a leftward drag at frame 0 without a negative placement', () => {
    // No unowned key precedes the Group, so the frame-0 boundary is the only
    // leftward limit: the destination reaches 0 and never goes negative.
    const resolution = resolveMoveGroup(
      [
        { keyId: 'A', appFrame: 1 },
        { keyId: 'C', appFrame: 5 },
      ],
      buildClampGroup(),
      'loop-R',
      0,
    );

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Frame-0 clamp must resolve ok');
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({ A: 0, C: 4 });
    expect(resolution.proposal.nextLoopClips?.[0]?.placementStart).toBe(0);
  });

  it('clamps a rightward drag at physical capacity (capacity minus interval width)', () => {
    // Group [1,9) span 8 with capacity 12: the rightmost legal placement is
    // 12 - 8 = 4. A proposed destination of 11 clamps to 4 and commits there.
    const resolution = resolveMoveGroup(
      [
        { keyId: 'A', appFrame: 1 },
        { keyId: 'C', appFrame: 5 },
      ],
      buildClampGroup(),
      'loop-R',
      11,
      12,
    );

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Capacity clamp must resolve ok');
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({ A: 4, C: 8 });
    expect(resolution.proposal.nextLoopClips?.[0]?.placementStart).toBe(4);
  });

  it('clamps at another Group interval including its linked occurrence interval', () => {
    // loop-G2 spans [11,20) through repeat 3 (cycleLength 3), i.e. linked
    // occurrences fill the derived interval. loop-R dragged right clamps to
    // 11 - 8 = 3 so its interval [3,11) stops before loop-G2's start.
    const identities = [
      { keyId: 'A', appFrame: 1 },
      { keyId: 'C', appFrame: 5 },
      { keyId: 'D', appFrame: 11 },
      { keyId: 'E', appFrame: 13 },
    ] as const;
    const loopClips = [
      ...buildClampGroup(),
      Object.freeze({
        loopId: 'loop-G2',
        placementStart: 11,
        sourceKeyIds: ['D', 'E'],
        repeat: 3,
        mode: 'progressive',
        syncState: 'synchronized',
        provenanceState: 'attached',
        phaseOrigin: 11,
        originalEndExclusive: 20,
        visibleRanges: Object.freeze([Object.freeze({ start: 11, endExclusive: 20 })]),
        frameOverrides: Object.freeze([]),
      }) as PhysicPaintRotoLoopClip,
    ];

    const resolution = resolveMoveGroup(
      identities as unknown as readonly PhysicPaintRotoKeyIdentity[],
      loopClips,
      'loop-R',
      7,
      24,
    );

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Other-Group boundary clamp must resolve ok');
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({ A: 3, C: 7, D: 11, E: 13 });
    expect(resolution.proposal.nextLoopClips?.[0]?.placementStart).toBe(3);
  });

  it('treats the dragged Group own current interval as pass-through space', () => {
    // Only A@1/C@5 exist; a rightward drag to 6 crosses the original span
    // [1,9) freely — the own interval is excluded from the boundary set.
    const resolution = resolveMoveGroup(
      [
        { keyId: 'A', appFrame: 1 },
        { keyId: 'C', appFrame: 5 },
      ],
      buildClampGroup(),
      'loop-R',
      6,
    );

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Pass-through drag must resolve ok');
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({ A: 6, C: 10 });
    expect(resolution.proposal.nextLoopClips?.[0]?.placementStart).toBe(6);
  });

  it('rejects with no-free-space-in-direction when zero valid movement exists and carries no proposal', () => {
    // Unowned D@9 sits exactly at the current interval end: 9 - 8 = 1, so the
    // Group is already at the rightmost legal placement and cannot move right.
    const resolution = resolveMoveGroup(
      [
        { keyId: 'A', appFrame: 1 },
        { keyId: 'C', appFrame: 5 },
        { keyId: 'D', appFrame: 9 },
      ],
      buildClampGroup(),
      'loop-R',
      3,
    );

    expect(resolution.ok).toBe(false);
    if (resolution.ok) throw new Error('Zero-space rightward drag must reject');
    expect(resolution.failure.code).toBe('no-free-space-in-direction');
    expect('proposal' in resolution).toBe(false);
  });

  it('derives an Infinity Group dragged interval from phaseOrigin to resolved effectiveEnd and permits the rightward drag', () => {
    // Infinity Group [1,600) fills the physical track; a rightward drag to 30
    // legitimately shrinks the derived occurrences to [30,600) — not a Repeat
    // change (D-19), and no Repeat field is touched.
    const loopClips = buildClampGroup({
      loopId: 'loop-I',
      repeat: 'infinity',
      mode: 'progressive',
      // All six lifecycle fields cleared together so the all-or-nothing
      // validator (lifecycleCount === 0) accepts the pre-attachment clip.
      syncState: undefined,
      provenanceState: undefined,
      phaseOrigin: undefined,
      originalEndExclusive: undefined,
      visibleRanges: undefined,
      frameOverrides: undefined,
    });

    const resolution = resolveMoveGroup(
      [
        { keyId: 'A', appFrame: 1 },
        { keyId: 'C', appFrame: 5 },
      ],
      loopClips,
      'loop-I',
      30,
    );

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Infinity rightward drag must resolve ok');
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({ A: 30, C: 34 });
    expect(resolution.proposal.nextLoopClips).not.toBeNull();
    if (!resolution.proposal.nextLoopClips) throw new Error('nextLoopClips must be present');
    const movedClip = resolution.proposal.nextLoopClips.find((clip) => clip.loopId === 'loop-I');
    expect(movedClip?.placementStart).toBe(30);
    expect(movedClip?.repeat).toBe('infinity');
  });

  it('resolves Infinity repeat occurrences through the accepted boundary for a lifecycle-available Group (baseline contract)', () => {
    // A Group with lifecycle fields (as the UI produces after attachment) whose
    // Repeat is set to 'infinity' must derive occurrences from its placement
    // through the next Group boundary / parent end — not stay pinned to the
    // stale source-cycle extent. This is the baseline contract the Infinity
    // drag row depends on (RESEARCH Open Question 1).
    const clip: PhysicPaintRotoLoopClip = {
      loopId: 'loop-inf',
      placementStart: 10,
      sourceKeyIds: ['A', 'B'],
      repeat: 'infinity',
      mode: 'progressive',
      scriptId: 'action-a',
      motion: { deformation: 0, position: 0 },
      overrideColor: null,
      syncState: 'modified',
      provenanceState: 'attached',
      phaseOrigin: 10,
      originalEndExclusive: 12, // stale source-cycle end after repeat → infinity
      visibleRanges: [{ start: 10, endExclusive: 12 }],
      frameOverrides: [],
    };
    const context = derivePhysicPaintRotoLoopRanges({
      identities: [
        { keyId: 'A', appFrame: 10 },
        { keyId: 'B', appFrame: 11 },
      ],
      loopClips: [clip],
      capacity: 120,
      interpolationEnabled: false,
    });
    const range = context.ranges.find((entry) => entry.loopId === 'loop-inf');
    expect(range).toBeDefined();
    if (!range) return;
    // Repeat authority preserved.
    expect(range.repeat).toBe('infinity');
    // The Infinity range must extend through the child document's single end
    // authority — the physical capacity (120) — not stop at the stale
    // source-cycle end (12) or a stale main-editor outFrame (43.4 defect 1).
    expect(range.effectiveEnd).toBe(120);
    // Derived occurrences resolve through the accepted boundary.
    expect(resolvePhysicPaintRotoLoopFrame(context, 20).kind).not.toBe('empty');
    expect(resolvePhysicPaintRotoLoopFrame(context, 29).kind).not.toBe('empty');
    // No materialized duplicate source keys: the source keyIds stay the two
    // originals and the derived frames are generated, not new real keys.
    expect(range.sourceKeyIds).toEqual(['A', 'B']);
    expect(context.keyIdByAppFrame.size).toBe(2);
  });

  it('preserves generated ownership for lifecycle Motion strict interiors when interpolation is enabled', () => {
    const clip: PhysicPaintRotoLoopClip = {
      loopId: 'loop-lifecycle-motion-generated',
      placementStart: 10,
      sourceKeyIds: ['A', 'B'],
      repeat: 2,
      mode: 'progressive',
      syncState: 'modified',
      provenanceState: 'attached',
      phaseOrigin: 10,
      originalEndExclusive: 16,
      visibleRanges: [{ start: 10, endExclusive: 16 }],
      frameOverrides: [],
    };
    const context = derivePhysicPaintRotoLoopRanges({
      identities: [
        { keyId: 'A', appFrame: 10 },
        { keyId: 'B', appFrame: 12 },
      ],
      loopClips: [clip],
      capacity: 20,
      interpolationEnabled: true,
    });

    expect(resolvePhysicPaintRotoLoopFrame(context, 11)).toMatchObject({
      kind: 'linked-generated',
      loopId: clip.loopId,
      leftSourceKeyId: 'A',
      rightSourceKeyId: 'B',
      progress: 0.5,
    });
  });

  it.each([
    {
      label: 'lifecycle Static with interpolation enabled',
      lifecycle: true,
      mode: 'static' as const,
      interpolationEnabled: true,
      expectedKind: 'linked',
    },
    {
      label: 'lifecycle Motion with interpolation disabled',
      lifecycle: true,
      mode: 'progressive' as const,
      interpolationEnabled: false,
      expectedKind: 'linked',
    },
    {
      label: 'ordinary Motion with interpolation enabled',
      lifecycle: false,
      mode: 'progressive' as const,
      interpolationEnabled: true,
      expectedKind: 'linked-generated',
    },
    {
      label: 'ordinary Motion with interpolation disabled',
      lifecycle: false,
      mode: 'progressive' as const,
      interpolationEnabled: false,
      expectedKind: 'linked-gap',
    },
  ])('applies the narrow strict-interior policy for $label', ({
    lifecycle,
    mode,
    interpolationEnabled,
    expectedKind,
  }) => {
    const clip: PhysicPaintRotoLoopClip = {
      loopId: 'loop-strict-interior-policy',
      placementStart: 10,
      sourceKeyIds: ['A', 'B'],
      repeat: 2,
      mode,
      ...(lifecycle
        ? {
            syncState: 'modified' as const,
            provenanceState: 'attached' as const,
            phaseOrigin: 10,
            originalEndExclusive: 16,
            visibleRanges: [{ start: 10, endExclusive: 16 }],
            frameOverrides: [],
          }
        : {}),
    };
    const context = derivePhysicPaintRotoLoopRanges({
      identities: [
        { keyId: 'A', appFrame: 10 },
        { keyId: 'B', appFrame: 12 },
      ],
      loopClips: [clip],
      capacity: 20,
      interpolationEnabled,
    });

    expect(resolvePhysicPaintRotoLoopFrame(context, 11).kind).toBe(expectedKind);
  });

  it('keeps explicit lifecycle omissions empty and contiguous source timing unchanged', () => {
    const deletedContext = derivePhysicPaintRotoLoopRanges({
      identities: [
        { keyId: 'A', appFrame: 10 },
        { keyId: 'B', appFrame: 12 },
      ],
      loopClips: [{
        loopId: 'loop-deleted-interior',
        placementStart: 10,
        sourceKeyIds: ['A', 'B'],
        repeat: 2,
        mode: 'static',
        syncState: 'modified',
        provenanceState: 'attached',
        phaseOrigin: 10,
        originalEndExclusive: 16,
        visibleRanges: [
          { start: 10, endExclusive: 11 },
          { start: 12, endExclusive: 16 },
        ],
        frameOverrides: [],
      }],
      capacity: 20,
      interpolationEnabled: true,
    });
    expect(resolvePhysicPaintRotoLoopFrame(deletedContext, 11)).toEqual({ kind: 'empty' });

    const contiguousContext = derivePhysicPaintRotoLoopRanges({
      identities: [
        { keyId: 'C', appFrame: 10 },
        { keyId: 'D', appFrame: 11 },
      ],
      loopClips: [{
        loopId: 'loop-contiguous-timing',
        placementStart: 10,
        sourceKeyIds: ['C', 'D'],
        repeat: 2,
        mode: 'progressive',
        syncState: 'synchronized',
        provenanceState: 'attached',
        phaseOrigin: 10,
        originalEndExclusive: 14,
        visibleRanges: [{ start: 10, endExclusive: 14 }],
        frameOverrides: [],
      }],
      capacity: 20,
      interpolationEnabled: true,
    });
    expect(resolvePhysicPaintRotoLoopFrame(contiguousContext, 12)).toMatchObject({
      kind: 'linked',
      loopId: 'loop-contiguous-timing',
      sourceKeyId: 'C',
    });
  });

  it('uses one Group-level next boundary for every Infinity lifecycle fragment', () => {
    const clip: PhysicPaintRotoLoopClip = {
      loopId: 'loop-fragmented-infinity',
      placementStart: 10,
      sourceKeyIds: ['A', 'B'],
      repeat: 'infinity',
      mode: 'progressive',
      syncState: 'modified',
      provenanceState: 'attached',
      phaseOrigin: 10,
      originalEndExclusive: 50,
      visibleRanges: [
        { start: 10, endExclusive: 20 },
        { start: 40, endExclusive: 50 },
      ],
      frameOverrides: [],
    };
    const nextGroup: PhysicPaintRotoLoopClip = {
      loopId: 'loop-next',
      placementStart: 30,
      sourceKeyIds: ['N', 'O'],
      repeat: 2,
      mode: 'static',
    };
    const context = derivePhysicPaintRotoLoopRanges({
      identities: [
        { keyId: 'A', appFrame: 10 },
        { keyId: 'B', appFrame: 11 },
        { keyId: 'N', appFrame: 30 },
        { keyId: 'O', appFrame: 31 },
      ],
      loopClips: [clip, nextGroup],
      capacity: 60,
      interpolationEnabled: false,
    });

    expect(context.ranges.filter((range) => range.loopId === clip.loopId)).toMatchObject([
      {
        placementStart: 10,
        effectiveEnd: 20,
        boundary: { kind: 'loop-start', frame: 30 },
      },
    ]);
    expect(resolvePhysicPaintRotoLoopFrame(context, 40)).toEqual({ kind: 'empty' });
  });

  it.each([
    { mode: 'progressive' as const, label: 'Motion' },
    { mode: 'static' as const, label: 'Static' },
  ])('uses one re-derived candidate geometry for $label Infinity rightward preview and commit at the next-Group boundary', ({ mode }) => {
    const clip: PhysicPaintRotoLoopClip = {
      loopId: 'loop-infinity',
      placementStart: 10,
      sourceKeyIds: ['A', 'B'],
      repeat: 'infinity',
      mode,
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 10,
      originalEndExclusive: 30,
      visibleRanges: [{ start: 10, endExclusive: 30 }],
      frameOverrides: [{ appFrame: 11, keyId: 'override-B' }],
    };
    const nextGroup: PhysicPaintRotoLoopClip = {
      loopId: 'loop-next',
      placementStart: 30,
      sourceKeyIds: ['N', 'O'],
      repeat: 2,
      mode: 'static',
    };
    const identities = [
      { keyId: 'A', appFrame: 10 },
      { keyId: 'B', appFrame: 11 },
      { keyId: 'N', appFrame: 30 },
      { keyId: 'O', appFrame: 31 },
    ] as const;
    const loopClips = [clip, nextGroup] as const;
    const derivation = derivePhysicPaintRotoLoopRanges({
      identities,
      loopClips,
      capacity: 50,
      interpolationEnabled: false,
    });
    const draggedRanges = derivation.ranges.filter((range) => range.loopId === clip.loopId);
    const preview = clampPhysicPaintGroupDragDestination({
      clip,
      draggedInterval: {
        phaseOrigin: 10,
        effectiveEnd: Math.max(...draggedRanges.map((range) => range.effectiveEnd)),
      },
      proposedDestinationPlacementStart: 14,
      identities,
      loopRanges: derivation.ranges,
      capacity: 50,
    });
    expect(preview).toEqual({ ok: true, destinationPlacementStart: 14 });

    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities,
      intent: { kind: 'move-group', loopId: clip.loopId, destinationPlacementStart: 14 },
      parentEndExclusive: 50,
      capacity: 50,
      interpolationEnabled: false,
      loopClips,
    });
    expect(resolution.ok).toBe(true);
    if (!resolution.ok || !preview.ok) throw new Error('Infinity next-Group move must resolve');
    expect(resolution.proposal.mapping.get('A')).toBe(preview.destinationPlacementStart);
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({ A: 14, B: 15, N: 30, O: 31 });
    const moved = resolution.proposal.nextLoopClips?.find((entry) => entry.loopId === clip.loopId);
    expect(moved).toMatchObject({
      placementStart: 14,
      phaseOrigin: 14,
      repeat: 'infinity',
      originalEndExclusive: 30,
      visibleRanges: [{ start: 14, endExclusive: 30 }],
      frameOverrides: [{ appFrame: 15, keyId: 'override-B' }],
      sourceKeyIds: ['A', 'B'],
    });
    const committed = derivePhysicPaintRotoLoopRanges({
      identities: [...resolution.proposal.mapping].map(([keyId, appFrame]) => ({ keyId, appFrame })),
      loopClips: resolution.proposal.nextLoopClips ?? loopClips,
      capacity: 50,
      interpolationEnabled: false,
    }).ranges.filter((range) => range.loopId === clip.loopId);
    expect(Math.max(...committed.map((range) => range.effectiveEnd))).toBe(30);
    expect(committed.every((range) => range.repeat === 'infinity' && range.boundary.frame === 30)).toBe(true);
  });

  it('preserves a translated deleted tail while exposing new Infinity coverage after a leftward move', () => {
    const clip: PhysicPaintRotoLoopClip = {
      loopId: 'loop-infinity-deleted-tail',
      placementStart: 10,
      sourceKeyIds: ['A', 'B'],
      repeat: 'infinity',
      mode: 'static',
      syncState: 'modified',
      provenanceState: 'attached',
      phaseOrigin: 10,
      originalEndExclusive: 30,
      visibleRanges: [{ start: 10, endExclusive: 25 }],
      frameOverrides: [],
    };
    const nextGroup: PhysicPaintRotoLoopClip = {
      loopId: 'loop-next-after-deleted-tail',
      placementStart: 30,
      sourceKeyIds: ['N', 'O'],
      repeat: 2,
      mode: 'static',
    };
    const loopClips = [clip, nextGroup] as const;
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: [
        { keyId: 'A', appFrame: 10 },
        { keyId: 'B', appFrame: 12 },
        { keyId: 'N', appFrame: 30 },
        { keyId: 'O', appFrame: 31 },
      ],
      intent: {
        kind: 'move-group',
        loopId: clip.loopId,
        destinationPlacementStart: 8,
      },
      parentEndExclusive: 40,
      capacity: 40,
      interpolationEnabled: false,
      loopClips,
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok || !resolution.proposal.nextLoopClips) {
      throw new Error('Infinity deleted-tail move must resolve');
    }

    const moved = resolution.proposal.nextLoopClips.find((entry) => entry.loopId === clip.loopId);
    expect(moved).toMatchObject({
      placementStart: 8,
      phaseOrigin: 8,
      originalEndExclusive: 30,
      visibleRanges: [
        { start: 8, endExclusive: 23 },
        { start: 28, endExclusive: 30 },
      ],
    });

    const committed = derivePhysicPaintRotoLoopRanges({
      identities: [...resolution.proposal.mapping].map(([keyId, appFrame]) => ({ keyId, appFrame })),
      loopClips: resolution.proposal.nextLoopClips,
      capacity: 40,
      interpolationEnabled: false,
    });
    expect(resolvePhysicPaintRotoLoopFrame(committed, 24)).toEqual({ kind: 'empty' });
    expect(resolvePhysicPaintRotoLoopFrame(committed, 28)).toMatchObject({
      kind: 'linked',
      loopId: clip.loopId,
      sourceKeyId: 'B',
    });
    expect(resolvePhysicPaintRotoLoopFrame(committed, 29)).toMatchObject({
      kind: 'linked',
      loopId: clip.loopId,
      sourceKeyId: 'A',
    });
    expect(
      committed.ranges.find(
        (range) => range.loopId === clip.loopId && range.placementStart === 28,
      ),
    ).toMatchObject({
      effectiveEnd: 30,
      partialCycle: true,
      boundary: { kind: 'loop-start', frame: 30 },
    });
  });

  it('round-trips the complete physical document after an Infinity Group move', () => {
    const records = [
      lifecycleRecord('A', 10),
      lifecycleRecord('B', 12),
      lifecycleRecord('N', 30),
      lifecycleRecord('O', 31),
    ];
    const clip: PhysicPaintRotoLoopClip = {
      loopId: 'loop-infinity-round-trip',
      placementStart: 10,
      sourceKeyIds: ['A', 'B'],
      repeat: 'infinity',
      mode: 'static',
      syncState: 'modified',
      provenanceState: 'attached',
      phaseOrigin: 10,
      originalEndExclusive: 30,
      visibleRanges: [{ start: 10, endExclusive: 25 }],
      frameOverrides: [],
    };
    const nextGroup: PhysicPaintRotoLoopClip = {
      loopId: 'loop-round-trip-next',
      placementStart: 30,
      sourceKeyIds: ['N', 'O'],
      repeat: 2,
      mode: 'static',
    };
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records,
      intent: {
        kind: 'move-group',
        loopId: clip.loopId,
        destinationPlacementStart: 8,
      },
      parentEndExclusive: 40,
      capacity: 40,
      interpolationEnabled: false,
      loopClips: [clip, nextGroup],
    });
    expect(resolution.ok).toBe(true);
    if (!resolution.ok || !resolution.proposal.nextLoopClips) {
      throw new Error('Infinity document round-trip move must resolve');
    }

    const movedRecords = records.map((record) => {
      const appFrame = resolution.proposal.mapping.get(record.keyId) ?? record.appFrame;
      return { ...record, appFrame, payload: { ...record.payload, appFrame } };
    });
    const interpolation = { enabled: false, mode: 'duplicate' as const };
    const revision = buildPhysicPaintRotoPhysicalRevision(
      movedRecords,
      interpolation,
      resolution.proposal.nextLoopClips,
      [],
      [],
    );
    const parsed = parsePhysicPaintRotoPhysicalDocument({
      capacity: 40,
      realKeyRecords: movedRecords,
      groupOverrideRecords: [],
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: resolution.proposal.selectedKeyId,
      cursorAppFrame: resolution.proposal.selectedAppFrame ?? 0,
      loopClips: resolution.proposal.nextLoopClips,
      incomingInterpolationBreakKeyIds: [],
      revision,
    });
    const reopened = parsePhysicPaintRotoPhysicalDocument(JSON.parse(JSON.stringify(parsed)));

    expect(reopened.revision).toBe(revision);
    expect(reopened.realKeyRecords).toEqual(movedRecords);
    expect(reopened.loopClips).toEqual(parsed.loopClips);
    expect(reopened.loopClips.find((entry) => entry.loopId === clip.loopId))
      .toEqual(resolution.proposal.nextLoopClips.find((entry) => entry.loopId === clip.loopId));
  });

  it.each([
    { mode: 'progressive' as const, label: 'Motion' },
    { mode: 'static' as const, label: 'Static' },
  ])('uses one re-derived candidate geometry for $label Infinity rightward preview and commit at the parent-end fallback', ({ mode }) => {
    const clip: PhysicPaintRotoLoopClip = {
      loopId: 'loop-infinity-parent',
      placementStart: 10,
      sourceKeyIds: ['A', 'B'],
      repeat: 'infinity',
      mode,
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 10,
      originalEndExclusive: 40,
      visibleRanges: [{ start: 10, endExclusive: 40 }],
      frameOverrides: [],
    };
    const identities = [{ keyId: 'A', appFrame: 10 }, { keyId: 'B', appFrame: 11 }] as const;
    const derivation = derivePhysicPaintRotoLoopRanges({
      identities,
      loopClips: [clip],
      capacity: 40,
      interpolationEnabled: false,
    });
    const preview = clampPhysicPaintGroupDragDestination({
      clip,
      draggedInterval: { phaseOrigin: 10, effectiveEnd: 40 },
      proposedDestinationPlacementStart: 16,
      identities,
      loopRanges: derivation.ranges,
      capacity: 40,
    });
    expect(preview).toEqual({ ok: true, destinationPlacementStart: 16 });

    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities,
      intent: { kind: 'move-group', loopId: clip.loopId, destinationPlacementStart: 16 },
      parentEndExclusive: 40,
      capacity: 40,
      interpolationEnabled: false,
      loopClips: [clip],
    });
    expect(resolution.ok).toBe(true);
    if (!resolution.ok || !preview.ok) throw new Error('Infinity parent-end move must resolve');
    expect(resolution.proposal.mapping.get('A')).toBe(preview.destinationPlacementStart);
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({ A: 16, B: 17 });
    const moved = resolution.proposal.nextLoopClips?.[0];
    expect(moved).toMatchObject({
      placementStart: 16,
      phaseOrigin: 16,
      repeat: 'infinity',
      originalEndExclusive: 40,
      visibleRanges: [{ start: 16, endExclusive: 40 }],
      sourceKeyIds: ['A', 'B'],
      frameOverrides: [],
    });
    const committed = derivePhysicPaintRotoLoopRanges({
      identities: [...resolution.proposal.mapping].map(([keyId, appFrame]) => ({ keyId, appFrame })),
      loopClips: resolution.proposal.nextLoopClips ?? [clip],
      capacity: 40,
      interpolationEnabled: false,
    }).ranges.filter((range) => range.loopId === clip.loopId);
    expect(Math.max(...committed.map((range) => range.effectiveEnd))).toBe(40);
    expect(committed.every((range) => range.repeat === 'infinity' && range.boundary.frame === 40)).toBe(true);
  });

  it('keeps Infinity move commit at the child document capacity end when the stale parent end is smaller (43.4 defect 1)', () => {
    const clip: PhysicPaintRotoLoopClip = {
      loopId: 'loop-parent-before-capacity',
      placementStart: 10,
      sourceKeyIds: ['A', 'B'],
      repeat: 'infinity',
      mode: 'progressive',
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 10,
      originalEndExclusive: 40,
      visibleRanges: [{ start: 10, endExclusive: 40 }],
      frameOverrides: [],
    };
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: [
        { keyId: 'A', appFrame: 10 },
        { keyId: 'B', appFrame: 11 },
      ],
      intent: {
        kind: 'move-group',
        loopId: clip.loopId,
        destinationPlacementStart: 16,
      },
      parentEndExclusive: 40,
      capacity: 600,
      interpolationEnabled: false,
      loopClips: [clip],
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Capacity-bounded Infinity move must resolve');
    expect(resolution.proposal.nextLoopClips?.[0]).toMatchObject({
      placementStart: 16,
      phaseOrigin: 16,
      originalEndExclusive: 600,
      visibleRanges: [{ start: 16, endExclusive: 600 }],
    });
  });

  it('clamps a zero-width (0f) dragged interval without division errors and keeps the Group draggable', () => {
    // A zero-width dragged interval (effectiveEnd === phaseOrigin) overlaps no
    // band, but the moved keys still cannot land on unowned real key frames:
    // proposed 3 would put A at B@3, so the clamp pulls back to 2.
    const clamped = clampPhysicPaintGroupDragDestination({
      clip: buildClampGroup()[0] as PhysicPaintRotoLoopClip,
      draggedInterval: { phaseOrigin: 1, effectiveEnd: 1 },
      proposedDestinationPlacementStart: 3,
      identities: buildBaselineIdentities(),
      loopRanges: [],
      capacity: PHYSIC_PAINT_MAX_APPLY_FRAMES,
    });

    expect(clamped.ok).toBe(true);
    if (!clamped.ok) throw new Error('Zero-width clamp must resolve ok');
    expect(clamped.destinationPlacementStart).toBe(2);
  });
});

describe('resolvePhysicPaintRotoPhysicalEdit — move-group duplicated shared-source placement (D-11, D-19)', () => {
  /**
   * loop-A is the source-attached owner of the [A,C] cycle at [1,9); loop-B is
   * a duplicated placement of the SAME source cycle starting at 12. Because
   * loop-B's placementStart (12) differs from its first source key frame (A@1),
   * dragging loop-B is a placement-only move: the shared source keys never move
   * and only the dragged placement's interval translates (D-11, D-19).
   */
  const buildDuplicatedPlacementClips = (): readonly PhysicPaintRotoLoopClip[] => Object.freeze([
    Object.freeze({
      loopId: 'loop-A',
      placementStart: 1,
      sourceKeyIds: ['A', 'C'],
      repeat: 2,
      mode: 'static',
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 1,
      originalEndExclusive: 9,
      visibleRanges: Object.freeze([
        Object.freeze({ start: 1, endExclusive: 4 }),
        Object.freeze({ start: 5, endExclusive: 9 }),
      ]),
      frameOverrides: Object.freeze([]),
    }),
    Object.freeze({
      loopId: 'loop-B',
      placementStart: 12,
      sourceKeyIds: ['A', 'C'],
      repeat: 2,
      mode: 'progressive',
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 12,
      originalEndExclusive: 20,
      visibleRanges: Object.freeze([
        Object.freeze({ start: 12, endExclusive: 15 }),
        Object.freeze({ start: 17, endExclusive: 20 }),
      ]),
      frameOverrides: Object.freeze([]),
    }),
  ]);

  const resolveDuplicated = (
    loopClips: readonly PhysicPaintRotoLoopClip[],
    loopId: string,
    destinationPlacementStart: number,
    extra: { readonly incomingInterpolationBreakKeyIds?: readonly string[] } = {},
  ): PhysicPaintRotoPhysicalEditResolution => resolvePhysicPaintRotoPhysicalEdit({
    identities: buildBaselineIdentities(),
    intent: { kind: 'move-group', loopId, destinationPlacementStart },
    parentEndExclusive: 24,
    capacity: 24,
    interpolationEnabled: false,
    loopClips,
    ...extra,
  });

  it('moves a duplicated placement with identity key mapping and placement-only nextLoopClips', () => {
    // loop-B [12,20) span 8 dragged right to 14: no D-08 boundary inside
    // [14,22), so the clamp keeps the proposed destination. delta = 2, but NO
    // key moves — the mapping is identity. Only the placement interval and its
    // lifecycle translate by the placement delta.
    const resolution = resolveDuplicated(buildDuplicatedPlacementClips(), 'loop-B', 14);

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Duplicated placement move must resolve ok');
    const { proposal } = resolution;
    expect(Object.fromEntries(proposal.mapping)).toEqual({ A: 1, B: 3, C: 5, D: 10 });
    expect(proposal.status.operationKind).toBe('move-group');
    // The placement translated (12 -> 14) even though the key mapping is
    // identity, so the move reports `ok` — a duplicated placement drag is a
    // real placement change, never a no-change (43.3-03 Task 2 regression).
    expect(proposal.status.code).toBe('ok');
    expect(proposal.nextLoopClips).not.toBeNull();
    if (!proposal.nextLoopClips) throw new Error('nextLoopClips must be present');
    expect(proposal.nextLoopClips.length).toBe(2);
    const movedClip = proposal.nextLoopClips.find((clip) => clip.loopId === 'loop-B');
    const ownerClip = proposal.nextLoopClips.find((clip) => clip.loopId === 'loop-A');
    expect(movedClip?.placementStart).toBe(14);
    expect(movedClip?.phaseOrigin).toBe(14);
    expect(movedClip?.originalEndExclusive).toBe(22);
    expect(movedClip?.visibleRanges).toEqual([
      { start: 14, endExclusive: 17 },
      { start: 19, endExclusive: 22 },
    ]);
    expect(movedClip?.repeat).toBe(2);
    expect(movedClip?.mode).toBe('progressive');
    expect(ownerClip?.placementStart).toBe(1);
    expect(ownerClip?.originalEndExclusive).toBe(9);
  });

  it('pins a detached Infinity placement move to the child document capacity boundary while source keys stay put (43.4 defect 1)', () => {
    const detachedInfinity = Object.freeze([
      Object.freeze({
        loopId: 'loop-infinity-detached',
        placementStart: 12,
        sourceKeyIds: ['A', 'C'],
        repeat: 'infinity',
        mode: 'progressive',
        syncState: 'modified',
        provenanceState: 'detached',
        phaseOrigin: 12,
        originalEndExclusive: 20,
        visibleRanges: Object.freeze([
          Object.freeze({ start: 12, endExclusive: 15 }),
          Object.freeze({ start: 17, endExclusive: 20 }),
        ]),
        frameOverrides: Object.freeze([]),
      }) as PhysicPaintRotoLoopClip,
    ]);

    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: buildBaselineIdentities(),
      intent: {
        kind: 'move-group',
        loopId: 'loop-infinity-detached',
        destinationPlacementStart: 14,
      },
      parentEndExclusive: 20,
      capacity: 24,
      interpolationEnabled: false,
      loopClips: detachedInfinity,
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Detached Infinity placement move must resolve ok');
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({ A: 1, B: 3, C: 5, D: 10 });
    expect(resolution.proposal.nextLoopClips).not.toBeNull();
    if (!resolution.proposal.nextLoopClips) throw new Error('nextLoopClips must be present');
    const movedClip = resolution.proposal.nextLoopClips[0];
    expect(movedClip).toMatchObject({
      loopId: 'loop-infinity-detached',
      placementStart: 14,
      phaseOrigin: 14,
      repeat: 'infinity',
      originalEndExclusive: 24,
      visibleRanges: [
        { start: 14, endExclusive: 17 },
        { start: 19, endExclusive: 24 },
      ],
    });
  });

  it('clamps a duplicated placement at physical capacity while the keys stay put', () => {
    // loop-B [12,20) span 8: the rightmost legal placement in a 24-frame
    // capacity is 16 (16 + 8 = 24). A proposed destination of 20 clamps to 16.
    const resolution = resolveDuplicated(buildDuplicatedPlacementClips(), 'loop-B', 20);

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Duplicated placement capacity clamp must resolve ok');
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({ A: 1, B: 3, C: 5, D: 10 });
    expect(resolution.proposal.nextLoopClips).not.toBeNull();
    if (!resolution.proposal.nextLoopClips) throw new Error('nextLoopClips must be present');
    const movedClip = resolution.proposal.nextLoopClips.find((clip) => clip.loopId === 'loop-B');
    expect(movedClip?.placementStart).toBe(16);
    expect(movedClip?.phaseOrigin).toBe(16);
    expect(movedClip?.originalEndExclusive).toBe(24);
  });

  it('keeps shared source keys and their owned incoming breaks byte-identical', () => {
    const resolution = resolveDuplicated(
      buildDuplicatedPlacementClips(),
      'loop-B',
      14,
      { incomingInterpolationBreakKeyIds: ['C'] },
    );

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Duplicated placement with breaks must resolve ok');
    const { proposal } = resolution;
    // Shared source keys A/C keep their current frames; the break owner C is
    // untouched and the incoming break collection echoes byte-identical (D-11).
    expect(Object.fromEntries(proposal.mapping)).toEqual({ A: 1, B: 3, C: 5, D: 10 });
    expect(proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['C']);
  });

  it('fails closed on ambiguous attachment authority with no proposal', () => {
    const missingFirstSource = Object.freeze([
      Object.freeze({
        loopId: 'loop-M',
        placementStart: 2,
        sourceKeyIds: ['missing', 'C'],
        repeat: 2,
        mode: 'static',
      }) as PhysicPaintRotoLoopClip,
    ]);
    const missing = resolveDuplicated(missingFirstSource, 'loop-M', 4);
    expect(missing.ok).toBe(false);
    if (missing.ok) throw new Error('missing first source key must reject');
    expect(missing.failure.code).toBe('malformed-identity');
    expect('proposal' in missing).toBe(false);

    // Partial lifecycle (5 of 6 fields) fails the all-or-nothing validator.
    const partialLifecycle = Object.freeze([
      Object.freeze({
        loopId: 'loop-P',
        placementStart: 2,
        sourceKeyIds: ['A', 'C'],
        repeat: 2,
        mode: 'static',
        syncState: 'synchronized',
        provenanceState: 'attached',
        phaseOrigin: 2,
        originalEndExclusive: 10,
        visibleRanges: Object.freeze([Object.freeze({ start: 2, endExclusive: 10 })]),
        // frameOverrides intentionally omitted -> lifecycleCount 5 -> invalid
      }) as unknown as PhysicPaintRotoLoopClip,
    ]);
    const malformed = resolveDuplicated(partialLifecycle, 'loop-P', 4);
    expect(malformed.ok).toBe(false);
    if (malformed.ok) throw new Error('malformed lifecycle must reject');
    expect(malformed.failure.code).toBe('malformed-loop-clips');
    expect('proposal' in malformed).toBe(false);
  });

  it('never materializes linked occurrences, duplicates source assets, or changes repeat or mode', () => {
    const loopClips = buildDuplicatedPlacementClips();
    const resolution = resolveDuplicated(loopClips, 'loop-B', 14);

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Duplicated placement move must resolve ok');
    const { proposal } = resolution;
    // No new records: the next collection has exactly the same clips, with only
    // the dragged placement's interval translated (D-19).
    expect(proposal.nextLoopClips).not.toBeNull();
    if (!proposal.nextLoopClips) throw new Error('nextLoopClips must be present');
    expect(proposal.nextLoopClips.length).toBe(loopClips.length);
    const movedClip = proposal.nextLoopClips.find((clip) => clip.loopId === 'loop-B');
    expect(movedClip?.repeat).toBe(2);
    expect(movedClip?.mode).toBe('progressive');
    expect(movedClip?.sourceKeyIds).toEqual(['A', 'C']);
    expect(movedClip?.frameOverrides).toEqual([]);
    // The owner keeps its exact source key list — no duplication of assets.
    const ownerClip = proposal.nextLoopClips.find((clip) => clip.loopId === 'loop-A');
    expect(ownerClip?.sourceKeyIds).toEqual(['A', 'C']);
  });
});

describe('clampPhysicPaintKeyRailDragDestination and move-key-rail', () => {
  const group = Object.freeze({
    loopId: 'loop-G',
    placementStart: 2,
    sourceKeyIds: Object.freeze(['G']),
    repeat: 2,
    mode: 'static',
    syncState: 'synchronized',
    provenanceState: 'attached',
    phaseOrigin: 2,
    originalEndExclusive: 4,
    visibleRanges: Object.freeze([Object.freeze({ start: 2, endExclusive: 4 })]),
    frameOverrides: Object.freeze([]),
  }) as PhysicPaintRotoLoopClip;

  const clamp = (overrides: Partial<Parameters<typeof clampPhysicPaintKeyRailDragDestination>[0]> = {}) => (
    clampPhysicPaintKeyRailDragDestination({
      memberKeyIds: ['M1', 'M2'],
      firstKeyFrame: 4,
      lastKeyFrame: 6,
      proposedDestinationFirstKeyAppFrame: 8,
      identities: [
        { keyId: 'P', appFrame: 1 },
        { keyId: 'M1', appFrame: 4 },
        { keyId: 'M2', appFrame: 6 },
        { keyId: 'S', appFrame: 10 },
      ],
      loopRanges: [],
      capacity: 16,
      ...overrides,
    })
  );

  it('clamps at frame, parent/capacity, external real-key, Group, and linked-occurrence boundaries while own members pass through', () => {
    expect(clamp({ proposedDestinationFirstKeyAppFrame: -4 })).toEqual({
      ok: true,
      destinationFirstKeyAppFrame: 2,
    });
    // A genuinely smaller child document feeds a smaller capacity as its end
    // authority; the clamp respects it (43.4 defect 1).
    expect(clamp({
      identities: [{ keyId: 'M1', appFrame: 4 }, { keyId: 'M2', appFrame: 6 }],
      proposedDestinationFirstKeyAppFrame: 15,
      capacity: 12,
    })).toEqual({ ok: true, destinationFirstKeyAppFrame: 9 });
    expect(clamp()).toEqual({ ok: true, destinationFirstKeyAppFrame: 7 });
    expect(clamp({
      identities: [{ keyId: 'M1', appFrame: 4 }, { keyId: 'M2', appFrame: 6 }],
      proposedDestinationFirstKeyAppFrame: 5,
    })).toEqual({ ok: true, destinationFirstKeyAppFrame: 5 });

    const groupRanges = derivePhysicPaintRotoLoopRanges({
      identities: [
        { keyId: 'M1', appFrame: 4 },
        { keyId: 'M2', appFrame: 6 },
        { keyId: 'G', appFrame: 9 },
      ],
      loopClips: [{ ...group, placementStart: 9, phaseOrigin: 9, originalEndExclusive: 14, visibleRanges: [{ start: 9, endExclusive: 14 }] }],
      capacity: 20,
      interpolationEnabled: false,
    }).ranges;
    expect(clamp({
      identities: [
        { keyId: 'M1', appFrame: 4 },
        { keyId: 'M2', appFrame: 6 },
        { keyId: 'G', appFrame: 9 },
      ],
      loopRanges: groupRanges,
      proposedDestinationFirstKeyAppFrame: 8,
      capacity: 20,
    })).toEqual({ ok: true, destinationFirstKeyAppFrame: 6 });
  });

  it('allows break-adjacent landing and rejects only when zero valid movement exists in the direction', () => {
    expect(clamp()).toEqual({ ok: true, destinationFirstKeyAppFrame: 7 });
    expect(clamp({
      identities: [
        { keyId: 'M1', appFrame: 4 },
        { keyId: 'M2', appFrame: 6 },
        { keyId: 'S', appFrame: 7 },
      ],
      proposedDestinationFirstKeyAppFrame: 6,
    })).toEqual({ ok: false });
  });

  const resolveMove = (input: {
    readonly identities?: readonly PhysicPaintRotoKeyIdentity[];
    readonly memberKeyIds?: readonly string[];
    readonly destination?: number;
    readonly breaks?: readonly string[];
    readonly loopClips?: readonly PhysicPaintRotoLoopClip[];
    readonly parentEndExclusive?: number;
    readonly capacity?: number;
  } = {}): PhysicPaintRotoPhysicalEditResolution => resolvePhysicPaintRotoPhysicalEdit({
    identities: input.identities ?? [
      { keyId: 'P', appFrame: 1 },
      { keyId: 'G', appFrame: 2 },
      { keyId: 'M1', appFrame: 4 },
      { keyId: 'M2', appFrame: 6 },
      { keyId: 'S', appFrame: 10 },
      { keyId: 'U', appFrame: 14 },
    ],
    intent: {
      kind: 'move-key-rail',
      memberKeyIds: input.memberKeyIds ?? ['M1', 'M2'],
      destinationFirstKeyAppFrame: input.destination ?? 7,
    },
    parentEndExclusive: input.parentEndExclusive ?? 16,
    capacity: input.capacity ?? 16,
    interpolationEnabled: true,
    incomingInterpolationBreakKeyIds: input.breaks ?? ['S', 'U'],
    loopClips: input.loopClips ?? [group],
  });

  it('rigidly translates one exact derived rail and emits complete sorted rule-(a)/(b)/(c) break ownership', () => {
    const resolution = resolveMove();
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Key Rail move must resolve');

    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({
      P: 1,
      G: 2,
      M1: 7,
      M2: 9,
      S: 10,
      U: 14,
    });
    expect(resolution.proposal.changes).toEqual([
      { keyId: 'M1', beforeAppFrame: 4, afterAppFrame: 7, role: 'moved' },
      { keyId: 'M2', beforeAppFrame: 6, afterAppFrame: 9, role: 'moved' },
    ]);
    expect(resolution.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['M1', 'S', 'U']);
    expect(resolution.proposal.status.operationKind).toBe('move-key-rail');
  });

  it('carries a moved stable break, reuses successor ownership, and adds no vacated break when the rail ends content', () => {
    const carried = resolveMove({ breaks: ['M1', 'S', 'U'] });
    expect(carried.ok).toBe(true);
    if (!carried.ok) throw new Error('Stable break move must resolve');
    expect(carried.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['M1', 'S', 'U']);

    const lastRail = resolveMove({
      identities: [
        { keyId: 'P', appFrame: 1 },
        { keyId: 'M1', appFrame: 4 },
        { keyId: 'M2', appFrame: 6 },
      ],
      breaks: ['M1'],
      loopClips: [],
      destination: 7,
      parentEndExclusive: 12,
      capacity: 12,
    });
    expect(lastRail.ok).toBe(true);
    if (!lastRail.ok) throw new Error('Last Key Rail move must resolve');
    expect(lastRail.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['M1']);
  });

  it('clamps a Key Rail left of an Infinity Group into the free space before its placement (43.4 defect 3a)', () => {
    const infinityGroup = Object.freeze({
      loopId: 'loop-inf',
      placementStart: 20,
      sourceKeyIds: Object.freeze(['G']),
      repeat: 'infinity',
      mode: 'progressive',
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 20,
      originalEndExclusive: 21,
      visibleRanges: Object.freeze([Object.freeze({ start: 20, endExclusive: 21 })]),
      frameOverrides: Object.freeze([]),
    }) as PhysicPaintRotoLoopClip;

    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: [
        { keyId: 'M1', appFrame: 10 },
        { keyId: 'M2', appFrame: 11 },
        { keyId: 'G', appFrame: 20 },
      ],
      intent: {
        kind: 'move-key-rail',
        memberKeyIds: ['M1', 'M2'],
        destinationFirstKeyAppFrame: 20,
      },
      parentEndExclusive: 30,
      capacity: 30,
      interpolationEnabled: true,
      incomingInterpolationBreakKeyIds: [],
      loopClips: [infinityGroup],
    });
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Key Rail move must resolve');
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({ M1: 18, M2: 19, G: 20 });
  });

  it('rejects rightward drag when a real occupied key is immediately adjacent (43.4 defect 3b)', () => {
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: [
        { keyId: 'M1', appFrame: 10 },
        { keyId: 'M2', appFrame: 11 },
        { keyId: 'S', appFrame: 12 },
      ],
      intent: {
        kind: 'move-key-rail',
        memberKeyIds: ['M1', 'M2'],
        destinationFirstKeyAppFrame: 12,
      },
      parentEndExclusive: 30,
      capacity: 30,
      interpolationEnabled: true,
      incomingInterpolationBreakKeyIds: ['S'],
      loopClips: [],
    });
    expect(resolution.ok).toBe(false);
    if (resolution.ok) throw new Error('Adjacent occupied key must reject');
    expect(resolution.failure.code).toBe('no-free-space-in-direction');
  });

  it('rejects a Key Rail past an Infinity Group start from dragging into its occupied range (43.4 defect 3d)', () => {
    const infinityGroup = Object.freeze({
      loopId: 'loop-inf',
      placementStart: 5,
      sourceKeyIds: Object.freeze(['G']),
      repeat: 'infinity',
      mode: 'progressive',
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 5,
      originalEndExclusive: 6,
      visibleRanges: Object.freeze([Object.freeze({ start: 5, endExclusive: 6 })]),
      frameOverrides: Object.freeze([]),
    }) as PhysicPaintRotoLoopClip;

    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: [
        { keyId: 'G', appFrame: 5 },
        { keyId: 'M1', appFrame: 20 },
        { keyId: 'M2', appFrame: 21 },
      ],
      intent: {
        kind: 'move-key-rail',
        memberKeyIds: ['M1', 'M2'],
        destinationFirstKeyAppFrame: 10,
      },
      parentEndExclusive: 30,
      capacity: 30,
      interpolationEnabled: true,
      incomingInterpolationBreakKeyIds: [],
      loopClips: [infinityGroup],
    });
    expect(resolution.ok).toBe(false);
    if (resolution.ok) throw new Error('Key Rail must not drag into the Infinity Group occupied range');
    expect(resolution.failure.code).toBe('no-free-space-in-direction');
  });

  it('keeps symmetric leftward drag working when an Infinity Group sits to the right (43.4 defect 3c)', () => {
    const infinityGroup = Object.freeze({
      loopId: 'loop-inf',
      placementStart: 20,
      sourceKeyIds: Object.freeze(['G']),
      repeat: 'infinity',
      mode: 'progressive',
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 20,
      originalEndExclusive: 21,
      visibleRanges: Object.freeze([Object.freeze({ start: 20, endExclusive: 21 })]),
      frameOverrides: Object.freeze([]),
    }) as PhysicPaintRotoLoopClip;

    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: [
        { keyId: 'M1', appFrame: 10 },
        { keyId: 'M2', appFrame: 11 },
        { keyId: 'G', appFrame: 20 },
      ],
      intent: {
        kind: 'move-key-rail',
        memberKeyIds: ['M1', 'M2'],
        destinationFirstKeyAppFrame: 6,
      },
      parentEndExclusive: 30,
      capacity: 30,
      interpolationEnabled: true,
      incomingInterpolationBreakKeyIds: [],
      loopClips: [infinityGroup],
    });
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Leftward Key Rail move must resolve');
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({ M1: 6, M2: 7, G: 20 });
  });

  it('fails closed for stale membership, malformed identities, Group ownership, over-range translation, and no movement space', () => {
    const cases = [
      resolveMove({ memberKeyIds: ['M1', 'missing'] }),
      resolveMove({ memberKeyIds: ['M1', 'M1'] }),
      resolveMove({ memberKeyIds: ['M1'] }),
      resolveMove({ memberKeyIds: ['G'] }),
      resolveMove({ destination: 16 }),
      resolveMove({ destination: 4 }),
      resolveMove({
        identities: [
          { keyId: 'M1', appFrame: 4 },
          { keyId: 'M2', appFrame: 6 },
          { keyId: 'S', appFrame: 7 },
        ],
        breaks: ['S'],
        loopClips: [],
        destination: 6,
      }),
    ];

    for (const resolution of cases) {
      expect(resolution.ok).toBe(false);
      expect('proposal' in resolution).toBe(false);
    }
    const blocked = cases[cases.length - 1];
    if (!blocked || blocked.ok) throw new Error('Blocked Key Rail move must reject');
    expect(blocked.failure.code).toBe('no-free-space-in-direction');
  });

  it('accepts a rightward Key Rail drag into genuine free space when the stale main-editor outFrame is smaller than capacity (43.4 defect 1)', () => {
    const resolution = resolveMove({
      identities: [{ keyId: 'M1', appFrame: 99 }],
      memberKeyIds: ['M1'],
      destination: 102,
      parentEndExclusive: 100,
      capacity: 600,
      loopClips: [],
      breaks: [],
    });
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Key Rail move into genuine free space must resolve');
    expect(resolution.proposal.mapping.get('M1')).toBe(102);
  });
});

describe('resolvePhysicPaintRotoPhysicalEdit — scissor-key-rail', () => {
  const identities = Object.freeze([
    Object.freeze({ keyId: 'A', appFrame: 1 }),
    Object.freeze({ keyId: 'B', appFrame: 4 }),
    Object.freeze({ keyId: 'C', appFrame: 7 }),
    Object.freeze({ keyId: 'D', appFrame: 10 }),
  ]);
  const group = Object.freeze({
    loopId: 'loop-C',
    placementStart: 7,
    sourceKeyIds: Object.freeze(['C']),
    repeat: 1,
    mode: 'static',
    syncState: 'synchronized',
    provenanceState: 'attached',
    phaseOrigin: 7,
    originalEndExclusive: 11,
    visibleRanges: Object.freeze([Object.freeze({ start: 7, endExclusive: 11 })]),
    frameOverrides: Object.freeze([Object.freeze({ appFrame: 10, keyId: 'D' })]),
  }) as PhysicPaintRotoLoopClip;

  const resolveScissor = (
    breakOwnerKeyId: string,
    incomingInterpolationBreakKeyIds: readonly string[] = ['A'],
    loopClips: readonly PhysicPaintRotoLoopClip[] = [],
  ): PhysicPaintRotoPhysicalEditResolution => resolvePhysicPaintRotoPhysicalEdit({
    identities,
    intent: { kind: 'scissor-key-rail', breakOwnerKeyId },
    parentEndExclusive: 16,
    capacity: 16,
    interpolationEnabled: true,
    incomingInterpolationBreakKeyIds,
    loopClips,
  });

  it('adds one ordinary owner through complete ascending break replacement and re-derives two rails', () => {
    const resolution = resolveScissor('B');
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Scissor must resolve');

    expect(resolution.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['A', 'B']);
    expect(resolution.proposal.mapping).toEqual(new Map([
      ['A', 1],
      ['B', 4],
      ['C', 7],
      ['D', 10],
    ]));
    expect(resolution.proposal.generatedCells.some(
      (cell) => cell.kind === 'generated' && cell.rightKeyId === 'B',
    )).toBe(false);

    expect(deriveKeyRailSegments({
      orderedRealKeys: identities,
      incomingInterpolationBreakKeyIds: new Set(resolution.proposal.nextIncomingInterpolationBreakKeyIds ?? []),
      groupOwnedKeyIds: new Set(['C', 'D']),
    })).toEqual([
      { firstKeyId: 'A', keyIds: ['A'], firstKeyFrame: 1, lastKeyFrame: 1 },
      { firstKeyId: 'B', keyIds: ['B'], firstKeyFrame: 4, lastKeyFrame: 4 },
    ]);
  });

  it('fails closed for unknown, Group-owned, already-broken, malformed, or duplicate-break inputs', () => {
    const cases = [
      resolveScissor('missing'),
      resolveScissor('C', [], [group]),
      resolveScissor('D', [], [group]),
      resolveScissor('', []),
      resolveScissor('B', ['B']),
      resolveScissor('B', ['A', 'A']),
    ];

    for (const resolution of cases) {
      expect(resolution.ok).toBe(false);
      expect('proposal' in resolution).toBe(false);
    }
  });
});

describe('resolvePhysicPaintRotoPhysicalEdit — delete-key-rail', () => {
  const identities = Object.freeze([
    Object.freeze({ keyId: 'A', appFrame: 1 }),
    Object.freeze({ keyId: 'B', appFrame: 4 }),
    Object.freeze({ keyId: 'C', appFrame: 6 }),
    Object.freeze({ keyId: 'D', appFrame: 10 }),
    Object.freeze({ keyId: 'E', appFrame: 14 }),
  ]);

  const resolveDelete = (input: {
    readonly keyIds?: readonly string[];
    readonly breaks?: readonly string[];
    readonly loopClips?: readonly PhysicPaintRotoLoopClip[];
  } = {}): PhysicPaintRotoPhysicalEditResolution => resolvePhysicPaintRotoPhysicalEdit({
    identities,
    intent: { kind: 'delete-key-rail', keyIds: input.keyIds ?? ['B', 'C'] },
    parentEndExclusive: 20,
    capacity: 20,
    interpolationEnabled: true,
    incomingInterpolationBreakKeyIds: input.breaks ?? ['B', 'D', 'E'],
    loopClips: input.loopClips ?? [],
  });

  it('removes every middle-rail member without moving survivors and normalizes the complete successor-break collection', () => {
    const resolution = resolveDelete();
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Key Rail delete must resolve');

    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({ A: 1, D: 10, E: 14 });
    expect(resolution.proposal.removedKeyIds).toEqual(['B', 'C']);
    expect(resolution.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['D', 'E']);
    expect(resolution.proposal.status.operationKind).toBe('delete-key-rail');
    expect(deriveKeyRailSegments({
      orderedRealKeys: [...resolution.proposal.mapping].map(([keyId, appFrame]) => ({ keyId, appFrame })),
      incomingInterpolationBreakKeyIds: new Set(resolution.proposal.nextIncomingInterpolationBreakKeyIds ?? []),
      groupOwnedKeyIds: new Set(),
    })).toEqual([
      { firstKeyId: 'A', keyIds: ['A'], firstKeyFrame: 1, lastKeyFrame: 1 },
      { firstKeyId: 'D', keyIds: ['D'], firstKeyFrame: 10, lastKeyFrame: 10 },
      { firstKeyId: 'E', keyIds: ['E'], firstKeyFrame: 14, lastKeyFrame: 14 },
    ]);
  });

  it('adds a dormant successor break after first-content deletion and adds none after last-content deletion', () => {
    const first = resolveDelete({ keyIds: ['A'], breaks: ['B', 'D', 'E'] });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('First Key Rail delete must resolve');
    expect(Object.fromEntries(first.proposal.mapping)).toEqual({ B: 4, C: 6, D: 10, E: 14 });
    expect(first.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['B', 'D', 'E']);

    const last = resolveDelete({ keyIds: ['E'], breaks: ['B', 'D', 'E'] });
    expect(last.ok).toBe(true);
    if (!last.ok) throw new Error('Last Key Rail delete must resolve');
    expect(Object.fromEntries(last.proposal.mapping)).toEqual({ A: 1, B: 4, C: 6, D: 10 });
    expect(last.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['B', 'D']);
  });

  it('adds a missing successor owner, removes deleted owners, preserves unrelated owners, and sorts by surviving frame', () => {
    const groupOwnedSeparator = Object.freeze({
      loopId: 'loop-X',
      placementStart: 8,
      sourceKeyIds: Object.freeze(['X']),
      repeat: 1,
      mode: 'static',
    }) as PhysicPaintRotoLoopClip;
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: [
        { keyId: 'A', appFrame: 1 },
        { keyId: 'B', appFrame: 4 },
        { keyId: 'C', appFrame: 6 },
        { keyId: 'X', appFrame: 8 },
        { keyId: 'D', appFrame: 10 },
        { keyId: 'E', appFrame: 14 },
      ],
      intent: { kind: 'delete-key-rail', keyIds: ['B', 'C'] },
      parentEndExclusive: 20,
      capacity: 20,
      interpolationEnabled: true,
      incomingInterpolationBreakKeyIds: ['B', 'E'],
      loopClips: [groupOwnedSeparator],
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Successor normalization must resolve');
    expect(resolution.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['D', 'E']);
  });

  it('fails closed for empty, unknown, duplicate, stale partial, Group-owned, and linked-source member lists', () => {
    const group = Object.freeze({
      loopId: 'loop-B',
      placementStart: 4,
      sourceKeyIds: Object.freeze(['B']),
      repeat: 1,
      mode: 'static',
    }) as PhysicPaintRotoLoopClip;
    const malformedIntents = [
      { kind: 'delete-key-rail', keyIds: [] },
      { kind: 'delete-key-rail', keyIds: ['B', 'missing'] },
      { kind: 'delete-key-rail', keyIds: ['B', 'B'] },
      { kind: 'delete-key-rail', keyIds: ['B'] },
    ] as unknown as PhysicPaintRotoPhysicalEditIntent[];

    const resolutions = malformedIntents.map((intent) => resolvePhysicPaintRotoPhysicalEdit({
      identities,
      intent,
      parentEndExclusive: 20,
      capacity: 20,
      interpolationEnabled: true,
      incomingInterpolationBreakKeyIds: ['B', 'D', 'E'],
    }));
    resolutions.push(resolveDelete({ keyIds: ['B'], breaks: ['D', 'E'], loopClips: [group] }));
    resolutions.push(resolveDelete({ keyIds: ['B'], loopClips: [group] }));

    for (const resolution of resolutions) {
      expect(resolution.ok).toBe(false);
      expect('proposal' in resolution).toBe(false);
    }
  });
});

describe('resolvePhysicPaintRotoPhysicalEdit — delete-key-group (GDel-1/GDel-2, D-13..D-15)', () => {
  it('GDel-1: removes the group atomically, ripples survivors left, and selects the D-14 survivor', () => {
    const resolution = resolveBaseline({
      kind: 'delete-key-group',
      keyIds: ['B', 'C'],
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('GDel-1 must resolve ok');
    const { proposal } = resolution;
    expect(Object.fromEntries(proposal.mapping)).toEqual({ A: 1, D: 8 });
    expect(proposal.selectedKeyId).toBe('D');
    expect(proposal.selectedAppFrame).toBe(8);
    expect(proposal.removedKeyId).toBeNull();
    expect(proposal.removedKeyIds).toEqual(['B', 'C']);
    expect(proposal.status.operationKind).toBe('delete-key-group');
    expect(proposal.status.text).toBe('Keys deleted');
  });

  it('GDel-2: delete-to-empty resolves an empty mapping with null selection (D-15)', () => {
    const resolution = resolveBaseline({
      kind: 'delete-key-group',
      keyIds: ['A', 'B', 'C', 'D'],
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('GDel-2 must resolve ok');
    const { proposal } = resolution;
    expect(proposal.mapping.size).toBe(0);
    expect(proposal.orderedKeyIds).toEqual([]);
    expect(proposal.selectedKeyId).toBeNull();
    expect(proposal.selectedAppFrame).toBeNull();
    expect(proposal.removedKeyIds).toEqual(['A', 'B', 'C', 'D']);
    expect(proposal.status.operationKind).toBe('delete-key-group');
    expect(proposal.status.text).toBe('Keys deleted');
  });

  it('fails closed on absent or duplicate members with no proposal (idempotency)', () => {
    const unknownMember = resolveBaseline({
      kind: 'delete-key-group',
      keyIds: ['B', 'Z'],
    });
    expect(unknownMember.ok).toBe(false);
    if (unknownMember.ok) throw new Error('unknown member must reject');
    expect(unknownMember.failure.code).toBe('unknown-operation-identity');

    const duplicateMember = resolveBaseline({
      kind: 'delete-key-group',
      keyIds: ['B', 'B'],
    });
    expect(duplicateMember.ok).toBe(false);
    if (duplicateMember.ok) throw new Error('duplicate member must reject');
    expect(duplicateMember.failure.code).toBe('duplicate-id');
  });
});

describe('resolvePhysicPaintRotoPhysicalEdit — scoped force-spacing (GFS-1..GFS-3, D-10..D-12)', () => {
  it('GFS-1: anchors the earliest selected key at its current frame and leaves unselected keys untouched', () => {
    const resolution = resolveBaseline({
      kind: 'force-spacing',
      emptyFrames: 2,
      selectedKeyId: 'B',
      scopeKeyIds: ['B', 'C'],
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('GFS-1 must resolve ok');
    const { proposal } = resolution;
    expect(Object.fromEntries(proposal.mapping)).toEqual({ A: 1, B: 3, C: 6, D: 10 });
    expect(proposal.selectedKeyId).toBe('B');
    expect(proposal.selectedAppFrame).toBe(3);
    expect(proposal.status.operationKind).toBe('force-spacing');
  });

  it('GFS-2: rejects atomically at the unselected hard wall (D-11)', () => {
    const resolution = resolveBaseline({
      kind: 'force-spacing',
      emptyFrames: 6,
      selectedKeyId: 'B',
      scopeKeyIds: ['B', 'C'],
    });

    expect(resolution.ok).toBe(false);
    if (resolution.ok) throw new Error('GFS-2 must reject');
    expect(resolution.failure.code).toBe('duplicate-destination-frame');
    expect(resolution.failure.operationKind).toBe('force-spacing');
    expect(resolution.failure.conflictingAppFrames).toEqual([10]);
  });

  it('GFS-3: null and undefined scope resolve exactly like the full-timeline 36.14 path', () => {
    for (const scopeKeyIds of [null, undefined] as const) {
      const resolution = resolveBaseline({
        kind: 'force-spacing',
        emptyFrames: 2,
        selectedKeyId: null,
        scopeKeyIds,
      });

      expect(resolution.ok).toBe(true);
      if (!resolution.ok) throw new Error('GFS-3 must resolve ok');
      const { proposal } = resolution;
      expect(Object.fromEntries(proposal.mapping)).toEqual({ A: 1, B: 4, C: 7, D: 10 });
      expect(proposal.status.operationKind).toBe('force-spacing');
    }
  });

  it('rejects negative and fractional emptyFrames with no proposal in both scopes', () => {
    for (const emptyFrames of [-1, 1.5]) {
      for (const scopeKeyIds of [null, ['B', 'C']] as const) {
        const resolution = resolveBaseline({
          kind: 'force-spacing',
          emptyFrames,
          selectedKeyId: scopeKeyIds === null ? null : 'B',
          scopeKeyIds,
        });

        expect(resolution.ok).toBe(false);
        if (resolution.ok) throw new Error('invalid emptyFrames must reject');
        expect(resolution.failure.code).toBe('invalid-spacing');
      }
    }
  });
});

describe('resolvePhysicPaintRotoPhysicalEdit — paste-key-group (GP-1..GP-7, D-04..D-07)', () => {
  it('GP-1: anchors the earliest copied key and preserves relative source offsets', () => {
    const intent = createPhysicPaintRotoPasteKeyGroupIntent(20, buildGroupEntries());
    const resolution = resolveBaselineWithRecords(intent);

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('GP-1 must resolve ok');
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({
      A: 1,
      B: 3,
      C: 5,
      D: 10,
      [intent.entries[0].newKeyId]: 20,
      [intent.entries[1].newKeyId]: 24,
    });
  });

  it('GP-2: adds exactly fresh retargeted records with zero ripple and a frozen delta', () => {
    const baseline = buildBaselineRecords();
    const intent = createPhysicPaintRotoPasteKeyGroupIntent(20, buildGroupEntries());
    const resolution = resolveBaselineWithRecords(intent);

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('GP-2 must resolve ok');
    const { proposal } = resolution;
    expect(proposal.status.operationKind).toBe('paste-key-group');
    expect(proposal.selectedKeyId).toBe(intent.entries[0].newKeyId);
    expect(proposal.selectedAppFrame).toBe(20);
    expect(proposal.nextRecords).toHaveLength(baseline.length + intent.entries.length);
    for (const record of baseline) {
      expect(proposal.nextRecords).toContainEqual(record);
    }
    expect(proposal.nextRecords).toContainEqual({
      kind: 'real-key',
      keyId: intent.entries[0].newKeyId,
      appFrame: 20,
      payload: { ...intent.entries[0].payload, appFrame: 20 },
    });
    expect(proposal.nextRecords).toContainEqual({
      kind: 'real-key',
      keyId: intent.entries[1].newKeyId,
      appFrame: 24,
      payload: { ...intent.entries[1].payload, appFrame: 24 },
    });
    expect(Object.isFrozen(proposal.nextRecords)).toBe(true);
    expect(proposal.semanticDelta).toEqual({
      kind: 'paste-key-group',
      destinationAppFrame: 20,
      entries: intent.entries,
    });
    expect(Object.isFrozen(proposal.semanticDelta)).toBe(true);
  });

  it('GP-3: rejects occupied computed destinations atomically', () => {
    const intent = createPhysicPaintRotoPasteKeyGroupIntent(1, buildGroupEntries());
    const resolution = resolveBaselineWithRecords(intent);

    expect(resolution.ok).toBe(false);
    if (resolution.ok) throw new Error('GP-3 must reject');
    expect(resolution.failure.code).toBe('duplicate-destination-frame');
    expect(resolution.failure.operationKind).toBe('paste-key-group');
    expect(resolution.failure.conflictingAppFrames).toEqual([1, 5]);
    expect('proposal' in resolution).toBe(false);
  });

  it('GP-4: rejects over-capacity record count and out-of-range destinations atomically', () => {
    const denseRecords: PhysicPaintRotoRealKeyRecord[] = [0, 1, 2, 3].map((appFrame, index) => ({
      kind: 'real-key',
      keyId: String.fromCharCode(65 + index),
      appFrame,
      payload: {
        frameIndex: 0,
        appFrame,
        dataUrl: 'data:image/png;base64,AAAA',
        width: 2,
        height: 2,
      },
    }));
    const overCapacityIntent = createPhysicPaintRotoPasteKeyGroupIntent(4, [
      { payload: denseRecords[0].payload, sourceAppFrame: 0, sourceKeyId: 'A' },
      { payload: denseRecords[1].payload, sourceAppFrame: 0, sourceKeyId: 'B' },
    ]);
    const overCapacity = resolvePhysicPaintRotoPhysicalEdit({
      identities: denseRecords.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records: denseRecords,
      intent: overCapacityIntent,
      parentEndExclusive: 5,
      capacity: 5,
      interpolationEnabled: false,
    });
    expect(overCapacity.ok).toBe(false);
    if (overCapacity.ok) throw new Error('GP-4 over-capacity must reject');
    expect(overCapacity.failure.code).toBe('over-capacity');

    const outOfRangeIntent = createPhysicPaintRotoPasteKeyGroupIntent(22, buildGroupEntries());
    const outOfRange = resolveBaselineWithRecords(outOfRangeIntent, 25);
    expect(outOfRange.ok).toBe(false);
    if (outOfRange.ok) throw new Error('GP-4 out-of-range must reject');
    expect(outOfRange.failure.code).toBe('out-of-range-frame');
  });

  it('GP-5: rejects mutually colliding computed destinations atomically', () => {
    const records = buildBaselineRecords();
    const intent = createPhysicPaintRotoPasteKeyGroupIntent(20, [
      { payload: records[0].payload, sourceAppFrame: 5, sourceKeyId: 'A' },
      { payload: records[2].payload, sourceAppFrame: 5, sourceKeyId: 'C' },
    ]);
    const resolution = resolveBaselineWithRecords(intent);

    expect(resolution.ok).toBe(false);
    if (resolution.ok) throw new Error('GP-5 must reject');
    expect(resolution.failure.code).toBe('duplicate-destination-frame');
    expect(resolution.failure.conflictingAppFrames).toEqual([20]);
  });
});

describe('validatePhysicPaintRotoPhysicalEditSemanticDelta — paste-key-group branch (GP-6)', () => {
  it('GP-6: accepts the declared addition and fails closed on every extra or missing change', () => {
    const current = buildBaselineRecords();
    const intent = createPhysicPaintRotoPasteKeyGroupIntent(20, buildGroupEntries());
    const addedRecords: PhysicPaintRotoRealKeyRecord[] = intent.entries.map((entry, index) => {
      const appFrame = index === 0 ? 20 : 24;
      return {
        kind: 'real-key',
        keyId: entry.newKeyId,
        appFrame,
        payload: { ...entry.payload, appFrame },
      };
    });
    const next = [...current, ...addedRecords];
    const semanticDelta = {
      kind: 'paste-key-group',
      destinationAppFrame: 20,
      entries: intent.entries,
    };
    const validate = (nextRecords: unknown, delta: unknown = semanticDelta) => (
      validatePhysicPaintRotoPhysicalEditSemanticDelta({
        operationKind: 'paste-key-group',
        currentRecords: current,
        nextRecords,
        semanticDelta: delta,
        capacity: PHYSIC_PAINT_MAX_APPLY_FRAMES,
        selectedKeyId: intent.entries[0].newKeyId,
        selectedAppFrame: 20,
      })
    );

    expect(validate(next)).toEqual({ ok: true });

    const changedExisting = next.map((record) => record.keyId === 'B'
      ? { ...record, appFrame: 4, payload: { ...record.payload, appFrame: 4 } }
      : record);
    const omittedFresh = next.filter((record) => record.keyId !== intent.entries[1].newKeyId);
    const undeclaredIdentity = [...next, {
      kind: 'real-key' as const,
      keyId: 'undeclared',
      appFrame: 30,
      payload: { frameIndex: 0, appFrame: 30, dataUrl: 'data:image/png;base64,AAAA', width: 2, height: 2 },
    }];
    const mismatchedKind = {
      kind: 'paste-key',
      destinationAppFrame: 20,
      destinationKeyId: null,
      newKeyId: intent.entries[0].newKeyId,
      clipboardPayload: intent.entries[0].payload,
    };

    for (const validation of [
      validate(changedExisting),
      validate(omittedFresh),
      validate(undeclaredIdentity),
      validate(next, mismatchedKind),
    ]) {
      expect(validation.ok).toBe(false);
      if (validation.ok) throw new Error('GP-6 malformed delta must reject');
      expect(typeof validation.error).toBe('string');
      expect(validation.error.length).toBeGreaterThan(0);
    }
  });
});

describe('createPhysicPaintRotoPasteKeyGroupIntent — fail-closed factory (GP-7)', () => {
  it('GP-7: throws on malformed input and deeply freezes one fresh identity per entry', () => {
    const entries = buildGroupEntries();
    expect(() => createPhysicPaintRotoPasteKeyGroupIntent(20, [])).toThrow();
    expect(() => createPhysicPaintRotoPasteKeyGroupIntent(20, [entries[0]])).toThrow();
    expect(() => createPhysicPaintRotoPasteKeyGroupIntent(-1, entries)).toThrow();
    expect(() => createPhysicPaintRotoPasteKeyGroupIntent(1.5, entries)).toThrow();
    expect(() => createPhysicPaintRotoPasteKeyGroupIntent(20, [
      { ...entries[0], payload: { ...entries[0].payload, dataUrl: 'malformed' } },
      entries[1],
    ])).toThrow();
    expect(() => createPhysicPaintRotoPasteKeyGroupIntent(20, [
      { ...entries[0], sourceAppFrame: -1 },
      entries[1],
    ])).toThrow();
    expect(() => createPhysicPaintRotoPasteKeyGroupIntent(20, [
      { ...entries[0], sourceKeyId: '' },
      entries[1],
    ])).toThrow();

    const intent = createPhysicPaintRotoPasteKeyGroupIntent(20, entries);
    expect(Object.isFrozen(intent)).toBe(true);
    expect(Object.isFrozen(intent.entries)).toBe(true);
    expect(intent.entries.every((entry) => Object.isFrozen(entry))).toBe(true);
    expect(new Set(intent.entries.map((entry) => entry.newKeyId)).size).toBe(intent.entries.length);
    expect(Object.keys(intent).sort()).toEqual(['destinationAppFrame', 'entries', 'kind']);
    for (const entry of intent.entries) {
      expect(Object.keys(entry).sort()).toEqual(['newKeyId', 'payload', 'sourceAppFrame', 'sourceKeyId']);
    }
  });
});

function lifecycleRecord(keyId: string, appFrame: number): PhysicPaintRotoRealKeyRecord {
  return {
    kind: 'real-key',
    keyId,
    appFrame,
    payload: {
      frameIndex: 0,
      appFrame,
      dataUrl: 'data:image/png;base64,AAAA',
      width: 2,
      height: 2,
    },
  };
}

function lifecycleGroup(overrides: Partial<PhysicPaintRotoLoopClip> = {}): PhysicPaintRotoLoopClip {
  return {
    loopId: 'group-a',
    placementStart: 0,
    sourceKeyIds: ['A0', 'A1'],
    repeat: 3,
    mode: 'progressive',
    scriptId: 'action-1',
    motion: { deformation: 0, position: 0 },
    overrideColor: null,
    syncState: 'modified',
    provenanceState: 'attached',
    phaseOrigin: 0,
    originalEndExclusive: 9,
    visibleRanges: [
      { start: 0, endExclusive: 4 },
      { start: 5, endExclusive: 9 },
    ],
    frameOverrides: [{ appFrame: 5, keyId: 'override-5' }],
    ...overrides,
  };
}

function lifecycleDocument(
  loopClips: readonly PhysicPaintRotoLoopClip[] = [lifecycleGroup()],
  records: readonly PhysicPaintRotoRealKeyRecord[] = [
    lifecycleRecord('A0', 0),
    lifecycleRecord('A1', 2),
    lifecycleRecord('ordinary', 20),
  ],
  incomingInterpolationBreakKeyIds: readonly string[] = ['A1'],
  groupOverrideRecords: readonly PhysicPaintRotoRealKeyRecord[] = loopClips.some((clip) => clip.frameOverrides?.some((override) => override.keyId === 'override-5'))
    ? [lifecycleRecord('override-5', 5)]
    : [],
): PhysicPaintRotoPhysicalDocument {
  const interpolation = { enabled: true, mode: 'blend' as const };
  return parsePhysicPaintRotoPhysicalDocument({
    capacity: 30,
    realKeyRecords: records,
    groupOverrideRecords,
    interpolation,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 0,
    loopClips,
    incomingInterpolationBreakKeyIds,
    revision: buildPhysicPaintRotoPhysicalRevision(
      records,
      interpolation,
      loopClips,
      incomingInterpolationBreakKeyIds,
      groupOverrideRecords,
    ),
  });
}

describe('Phase 43.2 ordinary-key delete beside Groups', () => {
  const group1: PhysicPaintRotoLoopClip = {
    loopId: 'group-1',
    placementStart: 0,
    sourceKeyIds: ['G1A', 'G1B'],
    repeat: 2,
    mode: 'progressive',
    scriptId: 'action-1',
    motion: { deformation: 0, position: 0 },
    overrideColor: null,
    syncState: 'synchronized',
    provenanceState: 'attached',
    phaseOrigin: 0,
    originalEndExclusive: 4,
    visibleRanges: [{ start: 0, endExclusive: 4 }],
    frameOverrides: [],
  };
  const group2: PhysicPaintRotoLoopClip = {
    ...group1,
    loopId: 'group-2',
    placementStart: 8,
    sourceKeyIds: ['G2A', 'G2B'],
    phaseOrigin: 8,
    originalEndExclusive: 12,
    visibleRanges: [{ start: 8, endExclusive: 12 }],
  };
  const identities: PhysicPaintRotoKeyIdentity[] = [
    { keyId: 'G1A', appFrame: 0 },
    { keyId: 'G1B', appFrame: 1 },
    { keyId: 'X', appFrame: 5 },
    { keyId: 'G2A', appFrame: 8 },
    { keyId: 'G2B', appFrame: 9 },
  ];

  it('removes only the ordinary key and preserves absolute Group positions and records', () => {
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities,
      intent: { kind: 'delete-key', selectedKeyId: 'X' },
      parentEndExclusive: 32,
      capacity: 32,
      interpolationEnabled: false,
      loopClips: [group1, group2],
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Ordinary-key delete beside Groups must resolve');
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({
      G1A: 0,
      G1B: 1,
      G2A: 8,
      G2B: 9,
    });
    expect(resolution.proposal.removedKeyIds).toEqual(['X']);
    expect(resolution.proposal.changes).toEqual([]);
    expect(resolution.proposal.nextLoopClips).toBeNull();
    expect(resolution.proposal.selectedKeyId).toBe('G2A');
    expect(resolution.proposal.selectedAppFrame).toBe(8);
  });

  it('keeps the legacy left ripple when no surviving key is Group-owned', () => {
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: [
        { keyId: 'A', appFrame: 0 },
        { keyId: 'X', appFrame: 5 },
        { keyId: 'B', appFrame: 8 },
      ],
      intent: { kind: 'delete-key', selectedKeyId: 'X' },
      parentEndExclusive: 32,
      capacity: 32,
      interpolationEnabled: false,
      loopClips: [group1],
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Ordinary-only delete must resolve');
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({
      A: 0,
      B: 7,
    });
  });

  it('suppresses the ripple for ordinary survivors between the removed slot and the next Group', () => {
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: [
        { keyId: 'G1A', appFrame: 0 },
        { keyId: 'G1B', appFrame: 1 },
        { keyId: 'X', appFrame: 5 },
        { keyId: 'Y', appFrame: 6 },
        { keyId: 'G2A', appFrame: 8 },
        { keyId: 'G2B', appFrame: 9 },
      ],
      intent: { kind: 'delete-key', selectedKeyId: 'X' },
      parentEndExclusive: 32,
      capacity: 32,
      interpolationEnabled: false,
      loopClips: [group1, group2],
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Delete before an ordinary survivor must resolve');
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({
      G1A: 0,
      G1B: 1,
      Y: 6,
      G2A: 8,
      G2B: 9,
    });
    expect(resolution.proposal.changes).toEqual([]);
  });

  it('applies the same absolute-position guard to delete-key-group beside Groups', () => {
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: [
        { keyId: 'G1A', appFrame: 0 },
        { keyId: 'G1B', appFrame: 1 },
        { keyId: 'X1', appFrame: 5 },
        { keyId: 'X2', appFrame: 6 },
        { keyId: 'G2A', appFrame: 8 },
        { keyId: 'G2B', appFrame: 9 },
      ],
      intent: { kind: 'delete-key-group', keyIds: ['X1', 'X2'] },
      parentEndExclusive: 32,
      capacity: 32,
      interpolationEnabled: false,
      loopClips: [group1, group2],
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Group delete beside Groups must resolve');
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({
      G1A: 0,
      G1B: 1,
      G2A: 8,
      G2B: 9,
    });
    expect(resolution.proposal.removedKeyIds).toEqual(['X1', 'X2']);
    expect(resolution.proposal.changes).toEqual([]);
    expect(resolution.proposal.nextLoopClips).toBeNull();
  });
});

describe('Phase 43.2 ordinary insert/duplicate beside Groups', () => {
  const group1: PhysicPaintRotoLoopClip = {
    loopId: 'group-1',
    placementStart: 0,
    sourceKeyIds: ['G1A', 'G1B'],
    repeat: 2,
    mode: 'progressive',
    scriptId: 'action-1',
    motion: { deformation: 0, position: 0 },
    overrideColor: null,
    syncState: 'synchronized',
    provenanceState: 'attached',
    phaseOrigin: 0,
    originalEndExclusive: 4,
    visibleRanges: [{ start: 0, endExclusive: 4 }],
    frameOverrides: [],
  };
  const group2: PhysicPaintRotoLoopClip = {
    ...group1,
    loopId: 'group-2',
    placementStart: 8,
    sourceKeyIds: ['G2A', 'G2B'],
    phaseOrigin: 8,
    originalEndExclusive: 12,
    visibleRanges: [{ start: 8, endExclusive: 12 }],
  };
  const singleSourceGroup: PhysicPaintRotoLoopClip = {
    ...group1,
    loopId: 'group-single',
    sourceKeyIds: ['G1A'],
    originalEndExclusive: 2,
    visibleRanges: [{ start: 0, endExclusive: 2 }],
  };
  const recordsFrom = (identities: readonly PhysicPaintRotoKeyIdentity[]): PhysicPaintRotoRealKeyRecord[] =>
    identities.map(({ keyId, appFrame }) => ({
      kind: 'real-key' as const,
      keyId,
      appFrame,
      payload: { frameIndex: 0, appFrame, dataUrl: 'data:image/png;base64,AAAA', width: 2, height: 2 },
    }));

  it('rejects insert-slot when the selected key is Group-referenced', () => {
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: [
        { keyId: 'G1A', appFrame: 0 },
        { keyId: 'G1B', appFrame: 1 },
        { keyId: 'X', appFrame: 5 },
      ],
      intent: { kind: 'insert-slot', selectedKeyId: 'G1A' },
      parentEndExclusive: 32,
      capacity: 32,
      interpolationEnabled: false,
      loopClips: [group1],
    });

    expect(resolution.ok).toBe(false);
    if (resolution.ok) throw new Error('Insert on a Group source key must fail closed');
    expect(resolution.failure.code).toBe('loop-source-key-insert-rejected');
    expect(resolution.failure.operationKind).toBe('insert-slot');
  });

  it('rejects insert-slot when the right ripple would move a Group-referenced key', () => {
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: [
        { keyId: 'G1A', appFrame: 0 },
        { keyId: 'G1B', appFrame: 1 },
        { keyId: 'X', appFrame: 5 },
        { keyId: 'G2A', appFrame: 8 },
        { keyId: 'G2B', appFrame: 9 },
      ],
      intent: { kind: 'insert-slot', selectedKeyId: 'X' },
      parentEndExclusive: 32,
      capacity: 32,
      interpolationEnabled: false,
      loopClips: [group1, group2],
    });

    expect(resolution.ok).toBe(false);
    if (resolution.ok) throw new Error('Insert before a Group must fail closed');
    expect(resolution.failure.code).toBe('loop-source-key-insert-rejected');
    expect(resolution.failure.operationKind).toBe('insert-slot');
  });

  it('keeps the legacy right ripple when no key at or after the selected frame is Group-owned', () => {
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: [
        { keyId: 'G1A', appFrame: 0 },
        { keyId: 'G1B', appFrame: 1 },
        { keyId: 'X', appFrame: 5 },
        { keyId: 'Y', appFrame: 6 },
      ],
      intent: { kind: 'insert-slot', selectedKeyId: 'X' },
      parentEndExclusive: 32,
      capacity: 32,
      interpolationEnabled: false,
      loopClips: [group1],
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Ordinary insert after the last Group must resolve');
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({
      G1A: 0,
      G1B: 1,
      X: 6,
      Y: 7,
    });
    expect(resolution.proposal.nextLoopClips).toBeNull();
  });

  it('rejects duplicate-key when the right ripple would move a Group-referenced key', () => {
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: [
        { keyId: 'X', appFrame: 5 },
        { keyId: 'G2A', appFrame: 8 },
        { keyId: 'G2B', appFrame: 9 },
      ],
      records: recordsFrom([
        { keyId: 'X', appFrame: 5 },
        { keyId: 'G2A', appFrame: 8 },
        { keyId: 'G2B', appFrame: 9 },
      ]),
      intent: { kind: 'duplicate-key', sourceKeyId: 'X', newKeyId: 'X-copy' },
      parentEndExclusive: 32,
      capacity: 32,
      interpolationEnabled: false,
      loopClips: [group2],
    });

    expect(resolution.ok).toBe(false);
    if (resolution.ok) throw new Error('Duplicate before a Group must fail closed');
    expect(resolution.failure.code).toBe('loop-source-key-duplicate-rejected');
    expect(resolution.failure.operationKind).toBe('duplicate-key');
  });

  it('allows duplicating a Group source key when no later key is Group-referenced', () => {
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: [
        { keyId: 'G1A', appFrame: 0 },
        { keyId: 'X', appFrame: 5 },
      ],
      records: recordsFrom([
        { keyId: 'G1A', appFrame: 0 },
        { keyId: 'X', appFrame: 5 },
      ]),
      intent: { kind: 'duplicate-key', sourceKeyId: 'G1A', newKeyId: 'G1A-copy' },
      parentEndExclusive: 32,
      capacity: 32,
      interpolationEnabled: false,
      loopClips: [singleSourceGroup],
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Duplicating a sole Group source key must resolve');
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({
      G1A: 0,
      'G1A-copy': 1,
      X: 6,
    });
    expect(resolution.proposal.nextLoopClips).toBeNull();
  });

  it('keeps the legacy right ripple for ordinary duplicates after the last Group', () => {
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: [
        { keyId: 'G1A', appFrame: 0 },
        { keyId: 'G1B', appFrame: 1 },
        { keyId: 'X', appFrame: 5 },
        { keyId: 'Y', appFrame: 8 },
      ],
      records: recordsFrom([
        { keyId: 'G1A', appFrame: 0 },
        { keyId: 'G1B', appFrame: 1 },
        { keyId: 'X', appFrame: 5 },
        { keyId: 'Y', appFrame: 8 },
      ]),
      intent: { kind: 'duplicate-key', sourceKeyId: 'X', newKeyId: 'X-copy' },
      parentEndExclusive: 32,
      capacity: 32,
      interpolationEnabled: false,
      loopClips: [group1],
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Ordinary duplicate after the last Group must resolve');
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({
      G1A: 0,
      G1B: 1,
      X: 5,
      'X-copy': 6,
      Y: 9,
    });
    expect(resolution.proposal.nextLoopClips).toBeNull();
  });
});

describe('Phase 43.2 source-phase Group lifecycle proposals', () => {
  it.each([
    { repeat: 1, expectedFrames: [1] },
    { repeat: 2, expectedFrames: [1, 4] },
    { repeat: 3, expectedFrames: [1, 4, 7] },
  ])('Paint stores one canonical phase override and resolves it across Repeat $repeat', ({ repeat, expectedFrames }) => {
    const group = lifecycleGroup({
      repeat,
      syncState: 'synchronized',
      originalEndExclusive: repeat * 3,
      visibleRanges: [{ start: 0, endExclusive: repeat * 3 }],
      frameOverrides: [],
    });
    const document = lifecycleDocument([group], undefined, undefined, []);
    const result = proposePhysicPaintRotoGroupFramePaint({
      document,
      groupId: 'group-a',
      appFrame: expectedFrames[expectedFrames.length - 1],
      overrideKeyId: 'override-phase-1',
      renderedPayload: lifecycleRecord('override-phase-1', expectedFrames[expectedFrames.length - 1]).payload,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Source-phase Paint must resolve');
    expect(result.proposal.loopClips[0].frameOverrides).toEqual([
      { appFrame: 1, keyId: 'override-phase-1' },
    ]);
    expect(result.proposal.groupOverrideRecords).toEqual([
      expect.objectContaining({ keyId: 'override-phase-1', appFrame: 1 }),
    ]);
    expect(result.impact).toMatchObject({
      groupId: 'group-a',
      appFrame: expectedFrames[expectedFrames.length - 1],
      phaseAppFrame: 1,
      affectedAppFrames: expectedFrames,
    });
    for (const appFrame of expectedFrames) {
      expect(classifyPhysicPaintRotoGroupFrameTarget({ document: result.proposal, appFrame })).toEqual({
        kind: 'override',
        groupId: 'group-a',
        appFrame,
        keyId: 'override-phase-1',
        phaseAppFrame: 1,
        cycleOffset: 1,
        repeatInstance: Math.floor(appFrame / 3),
      });
    }
  });

  it('anchors source-phase Paint to nonzero placement and leaves a source-sharing Group byte-identical', () => {
    const selected = lifecycleGroup({
      loopId: 'group-a',
      placementStart: 10,
      phaseOrigin: 10,
      originalEndExclusive: 19,
      visibleRanges: [{ start: 10, endExclusive: 19 }],
      frameOverrides: [],
    });
    const peer = lifecycleGroup({
      loopId: 'group-b',
      placementStart: 21,
      phaseOrigin: 21,
      originalEndExclusive: 30,
      visibleRanges: [{ start: 21, endExclusive: 30 }],
      frameOverrides: [],
    });
    const document = lifecycleDocument([selected, peer], undefined, undefined, []);
    const result = proposePhysicPaintRotoGroupFramePaint({
      document,
      groupId: 'group-a',
      appFrame: 17,
      overrideKeyId: 'override-phase-1',
      renderedPayload: lifecycleRecord('override-phase-1', 17).payload,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Placed source-phase Paint must resolve');
    expect(result.proposal.loopClips).toEqual([
      expect.objectContaining({
        loopId: 'group-a',
        syncState: 'modified',
        frameOverrides: [{ appFrame: 11, keyId: 'override-phase-1' }],
      }),
      peer,
    ]);
    expect(result.impact).toMatchObject({
      phaseAppFrame: 11,
      affectedAppFrames: [11, 14, 17],
    });
  });

  it('Delete Frame removes the selected source phase from every repeat and cleans its one phase override', () => {
    const group = lifecycleGroup({
      visibleRanges: [{ start: 0, endExclusive: 9 }],
      frameOverrides: [{ appFrame: 1, keyId: 'override-phase-1' }],
    });
    const result = proposePhysicPaintRotoDeleteGroupFrame({
      document: lifecycleDocument(
        [group],
        undefined,
        undefined,
        [lifecycleRecord('override-phase-1', 1)],
      ),
      groupId: 'group-a',
      appFrame: 7,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Phase Delete Frame must resolve');
    expect(result.proposal.loopClips[0]).toMatchObject({
      loopId: 'group-a',
      syncState: 'modified',
      visibleRanges: [
        { start: 0, endExclusive: 1 },
        { start: 2, endExclusive: 4 },
        { start: 5, endExclusive: 7 },
        { start: 8, endExclusive: 9 },
      ],
      frameOverrides: [],
    });
    expect(result.impact).toMatchObject({
      appFrame: 7,
      phaseAppFrame: 1,
      affectedAppFrames: [1, 4, 7],
      cleanupKeyIds: ['override-phase-1'],
    });
  });

  it('Paint into one deleted phase refills every matching repeat through one canonical override', () => {
    const group = lifecycleGroup({
      visibleRanges: [
        { start: 0, endExclusive: 1 },
        { start: 2, endExclusive: 4 },
        { start: 5, endExclusive: 7 },
        { start: 8, endExclusive: 9 },
      ],
      frameOverrides: [],
    });
    const result = proposePhysicPaintRotoGroupFramePaint({
      document: lifecycleDocument([group], undefined, undefined, []),
      groupId: 'group-a',
      appFrame: 4,
      overrideKeyId: 'override-phase-1',
      renderedPayload: lifecycleRecord('override-phase-1', 4).payload,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Phase gap Paint must resolve');
    expect(result.proposal.loopClips[0]).toMatchObject({
      syncState: 'modified',
      visibleRanges: [{ start: 0, endExclusive: 9 }],
      frameOverrides: [{ appFrame: 1, keyId: 'override-phase-1' }],
    });
    expect(result.impact).toMatchObject({
      appFrame: 4,
      phaseAppFrame: 1,
      affectedAppFrames: [1, 4, 7],
      filledDeletedOccurrence: true,
    });
  });

  it('classifies every physical frame target and preserves immutable phase across lifecycle gaps', () => {
    const document = lifecycleDocument();
    expect(classifyPhysicPaintRotoGroupFrameTarget({ document, appFrame: 0 })).toMatchObject({
      kind: 'source-occurrence',
      groupId: 'group-a',
      sourceKeyId: 'A0',
    });
    expect(classifyPhysicPaintRotoGroupFrameTarget({ document, appFrame: 1 })).toMatchObject({
      kind: 'generated-occurrence',
      groupId: 'group-a',
      leftSourceKeyId: 'A0',
      rightSourceKeyId: 'A1',
    });
    expect(classifyPhysicPaintRotoGroupFrameTarget({ document, appFrame: 5 })).toEqual({
      kind: 'override',
      groupId: 'group-a',
      appFrame: 5,
      keyId: 'override-5',
      phaseAppFrame: 2,
      cycleOffset: 2,
      repeatInstance: 1,
    });
    expect(classifyPhysicPaintRotoGroupFrameTarget({ document, appFrame: 4 })).toEqual({
      kind: 'group-gap',
      groupId: 'group-a',
      appFrame: 4,
      phaseAppFrame: 1,
      cycleOffset: 1,
      repeatInstance: 1,
    });
    expect(classifyPhysicPaintRotoGroupFrameTarget({ document, appFrame: 20 })).toEqual({
      kind: 'ordinary-key',
      appFrame: 20,
      keyId: 'ordinary',
    });
    expect(classifyPhysicPaintRotoGroupFrameTarget({ document, appFrame: 21 })).toEqual({
      kind: 'empty',
      appFrame: 21,
    });

    const context = derivePhysicPaintRotoLoopRanges({
      identities: document.realKeyRecords.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      loopClips: document.loopClips,
      capacity: 30,
      interpolationEnabled: true,
    });
    expect(resolvePhysicPaintRotoLoopFrame(context, 4)).toEqual({ kind: 'empty' });
    expect(resolvePhysicPaintRotoLoopFrame(context, 5)).toMatchObject({
      kind: 'linked',
      sourceKeyId: 'A1',
    });
    expect(classifyPhysicPaintRotoGroupFrameTarget({ document, appFrame: 5 })).toMatchObject({
      kind: 'override',
      keyId: 'override-5',
    });
    expect(resolvePhysicPaintRotoLoopFrame(context, 8)).toMatchObject({
      kind: 'linked',
      sourceKeyId: 'A1',
      cycleOffset: 2,
      repeatInstance: 2,
    });
    expect(Object.isFrozen(classifyPhysicPaintRotoGroupFrameTarget({ document, appFrame: 1 }))).toBe(true);
  });

  it('returns a typed unresolved Group target without fabricating source content', () => {
    const unresolved = lifecycleDocument([
      lifecycleGroup({
        sourceKeyIds: ['missing-0', 'missing-1'],
        frameOverrides: [],
      }),
    ], [lifecycleRecord('ordinary', 20)], []);
    expect(classifyPhysicPaintRotoGroupFrameTarget({ document: unresolved, appFrame: 1 })).toEqual({
      kind: 'unresolved-group',
      groupId: 'group-a',
      appFrame: 1,
      missingSourceKeyIds: ['missing-0', 'missing-1'],
    });
  });

  it('deletes one source phase by normalized range authority and cleans only its final override reference', () => {
    const result = proposePhysicPaintRotoDeleteGroupFrame({
      document: lifecycleDocument(),
      groupId: 'group-a',
      appFrame: 5,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Delete Group Frame must resolve');
    expect(result.proposal.loopClips[0].visibleRanges).toEqual([
      { start: 0, endExclusive: 2 },
      { start: 3, endExclusive: 4 },
      { start: 6, endExclusive: 8 },
    ]);
    expect(result.proposal.loopClips[0].phaseOrigin).toBe(0);
    expect(result.proposal.loopClips[0].frameOverrides).toEqual([]);
    expect(result.proposal.realKeyRecords.map((record) => record.keyId)).toEqual(['A0', 'A1', 'ordinary']);
    expect(result.proposal.incomingInterpolationBreakKeyIds).toEqual(['A1']);
    expect(result.impact).toMatchObject({
      phaseAppFrame: 2,
      affectedAppFrames: [2, 5, 8],
      cleanupKeyIds: ['override-5'],
    });
    expect(Object.isFrozen(result.proposal)).toBe(true);
    expect(Object.isFrozen(result.impact)).toBe(true);
  });

  it('removes first and last source phases across repeats without changing Group identity or phase', () => {
    const first = proposePhysicPaintRotoDeleteGroupFrame({
      document: lifecycleDocument(),
      groupId: 'group-a',
      appFrame: 0,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('First-edge Delete Frame must resolve');
    expect(first.proposal.loopClips[0]).toMatchObject({
      loopId: 'group-a',
      phaseOrigin: 0,
      syncState: 'modified',
      visibleRanges: [
        { start: 1, endExclusive: 3 },
        { start: 5, endExclusive: 6 },
        { start: 7, endExclusive: 9 },
      ],
    });

    const last = proposePhysicPaintRotoDeleteGroupFrame({
      document: lifecycleDocument(),
      groupId: 'group-a',
      appFrame: 8,
    });
    expect(last.ok).toBe(true);
    if (!last.ok) throw new Error('Last-edge Delete Frame must resolve');
    expect(last.proposal.loopClips[0]).toMatchObject({
      loopId: 'group-a',
      phaseOrigin: 0,
      syncState: 'modified',
      visibleRanges: [
        { start: 0, endExclusive: 2 },
        { start: 3, endExclusive: 4 },
        { start: 6, endExclusive: 8 },
      ],
    });
  });

  it('removes Groups and source records only after their final complete-document reference', () => {
    const sharedPeer = lifecycleGroup({
      loopId: 'group-b',
      placementStart: 10,
      phaseOrigin: 10,
      originalEndExclusive: 19,
      visibleRanges: [{ start: 10, endExclusive: 19 }],
      frameOverrides: [],
    });
    const shared = lifecycleDocument([lifecycleGroup(), sharedPeer]);
    const first = proposePhysicPaintRotoDeleteGroup({ document: shared, groupId: 'group-a' });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('Shared Group delete must resolve');
    expect(first.impact.cleanupKeyIds).toEqual(['override-5']);
    expect(first.proposal.realKeyRecords.map((record) => record.keyId)).toContain('A0');
    expect(first.proposal.incomingInterpolationBreakKeyIds).toEqual(['A1']);

    const final = proposePhysicPaintRotoDeleteGroup({ document: first.proposal, groupId: 'group-b' });
    expect(final.ok).toBe(true);
    if (!final.ok) throw new Error('Final Group delete must resolve');
    expect(final.impact.cleanupKeyIds).toEqual(['A0', 'A1']);
    expect(final.proposal.realKeyRecords.map((record) => record.keyId)).toEqual(['ordinary']);
    expect(final.proposal.incomingInterpolationBreakKeyIds).toEqual([]);
  });

  it('regenerates the immutable original extent and detaches or cascades Action Groups exactly', () => {
    const regenerated = proposePhysicPaintRotoRegenerateGroup({
      document: lifecycleDocument(),
      groupId: 'group-a',
      expectedActionRevision: 'action-revision-1',
      currentActionRevision: 'action-revision-1',
    });
    expect(regenerated.ok).toBe(true);
    if (!regenerated.ok) throw new Error('Regenerate must resolve');
    expect(regenerated.proposal.loopClips[0]).toMatchObject({
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 0,
      originalEndExclusive: 9,
      visibleRanges: [{ start: 0, endExclusive: 9 }],
      frameOverrides: [],
    });
    expect(regenerated.impact.cleanupKeyIds).toEqual(['override-5']);

    const detached = proposePhysicPaintRotoActionGroupLifecycle({
      document: lifecycleDocument(),
      actionId: 'action-1',
      expectedActionRevision: 'action-revision-1',
      currentActionRevision: 'action-revision-1',
      mode: 'detach',
    });
    expect(detached.ok).toBe(true);
    if (!detached.ok) throw new Error('Detach must resolve');
    expect(detached.proposal.loopClips[0].provenanceState).toBe('detached');
    expect(detached.impact.affectedGroupIds).toEqual(['group-a']);
    expect(detached.impact.cleanupKeyIds).toEqual([]);

    const deleted = proposePhysicPaintRotoActionGroupLifecycle({
      document: lifecycleDocument(),
      actionId: 'action-1',
      expectedActionRevision: 'action-revision-1',
      currentActionRevision: 'action-revision-1',
      mode: 'delete',
    });
    expect(deleted.ok).toBe(true);
    if (!deleted.ok) throw new Error('Action cascade must resolve');
    expect(deleted.proposal.loopClips).toEqual([]);
    expect(deleted.impact.affectedGroupIds).toEqual(['group-a']);
    expect(deleted.impact.cleanupKeyIds).toEqual(['A0', 'A1', 'override-5']);
  });

  it('fails closed for stale Action authority and unknown or exhausted targets', () => {
    expect(proposePhysicPaintRotoRegenerateGroup({
      document: lifecycleDocument(),
      groupId: 'group-a',
      expectedActionRevision: 'stale',
      currentActionRevision: 'current',
    })).toEqual({ ok: false, reason: 'action-revision-mismatch' });
    expect(proposePhysicPaintRotoDeleteGroupFrame({
      document: lifecycleDocument(),
      groupId: 'missing',
      appFrame: 1,
    })).toEqual({ ok: false, reason: 'group-not-found' });
    const onlyOccurrence = proposePhysicPaintRotoDeleteGroupFrame({
      document: lifecycleDocument([
        lifecycleGroup({ visibleRanges: [{ start: 0, endExclusive: 1 }], frameOverrides: [] }),
      ], [lifecycleRecord('A0', 0), lifecycleRecord('A1', 2), lifecycleRecord('ordinary', 20)]),
      groupId: 'group-a',
      appFrame: 0,
    });
    expect(onlyOccurrence.ok).toBe(true);
    if (!onlyOccurrence.ok) throw new Error('Only-occurrence Delete Frame must remove the Group');
    expect(onlyOccurrence.proposal.loopClips).toEqual([]);
    expect(onlyOccurrence.proposal.realKeyRecords.map((record) => record.keyId)).toEqual(['ordinary']);
    expect(onlyOccurrence.impact).toMatchObject({
      kind: 'delete-group-frame',
      groupId: 'group-a',
      appFrame: 0,
      cleanupKeyIds: ['A0', 'A1'],
    });
  });
});

/** loop-G is source-attached owner of the [g0,g1] cycle at [20,28); loop-D is a
 * duplicated placement of the SAME source cycle at [2,10) — never attached. */
function buildPushGroupClips(): readonly PhysicPaintRotoLoopClip[] {
  return Object.freeze([
    Object.freeze({
      loopId: 'loop-G',
      placementStart: 20,
      sourceKeyIds: ['g0', 'g1'],
      repeat: 4,
      mode: 'static',
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 20,
      originalEndExclusive: 28,
      visibleRanges: Object.freeze([Object.freeze({ start: 20, endExclusive: 28 })]),
      frameOverrides: Object.freeze([]),
    }) as PhysicPaintRotoLoopClip,
    Object.freeze({
      loopId: 'loop-D',
      placementStart: 2,
      sourceKeyIds: ['g0', 'g1'],
      repeat: 4,
      mode: 'progressive',
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 2,
      originalEndExclusive: 10,
      visibleRanges: Object.freeze([Object.freeze({ start: 2, endExclusive: 10 })]),
      frameOverrides: Object.freeze([]),
    }) as PhysicPaintRotoLoopClip,
  ]);
}

describe('resolvePhysicPaintRotoPhysicalEdit — push-rails (directional suffix translation)', () => {
  const buildTwoKeyRails = (): readonly PhysicPaintRotoKeyIdentity[] => Object.freeze([
    { keyId: 'a0', appFrame: 0 }, { keyId: 'a1', appFrame: 1 }, { keyId: 'a2', appFrame: 2 },
    { keyId: 'a3', appFrame: 3 }, { keyId: 'a4', appFrame: 4 }, { keyId: 'a5', appFrame: 5 },
    { keyId: 'a6', appFrame: 6 }, { keyId: 'a7', appFrame: 7 }, { keyId: 'a8', appFrame: 8 },
    { keyId: 'a9', appFrame: 9 },
    { keyId: 'b0', appFrame: 20 }, { keyId: 'b1', appFrame: 21 }, { keyId: 'b2', appFrame: 22 },
    { keyId: 'b3', appFrame: 23 }, { keyId: 'b4', appFrame: 24 }, { keyId: 'b5', appFrame: 25 },
    { keyId: 'b6', appFrame: 26 }, { keyId: 'b7', appFrame: 27 }, { keyId: 'b8', appFrame: 28 },
    { keyId: 'b9', appFrame: 29 },
  ]);

  /** A [5,15), B [20,30): room to push A left without hitting frame 0. */
  const buildStaggeredKeyRails = (): readonly PhysicPaintRotoKeyIdentity[] => Object.freeze([
    { keyId: 'a0', appFrame: 5 }, { keyId: 'a1', appFrame: 6 }, { keyId: 'a2', appFrame: 7 },
    { keyId: 'a3', appFrame: 8 }, { keyId: 'a4', appFrame: 9 }, { keyId: 'a5', appFrame: 10 },
    { keyId: 'a6', appFrame: 11 }, { keyId: 'a7', appFrame: 12 }, { keyId: 'a8', appFrame: 13 },
    { keyId: 'a9', appFrame: 14 },
    { keyId: 'b0', appFrame: 20 }, { keyId: 'b1', appFrame: 21 }, { keyId: 'b2', appFrame: 22 },
    { keyId: 'b3', appFrame: 23 }, { keyId: 'b4', appFrame: 24 }, { keyId: 'b5', appFrame: 25 },
    { keyId: 'b6', appFrame: 26 }, { keyId: 'b7', appFrame: 27 }, { keyId: 'b8', appFrame: 28 },
    { keyId: 'b9', appFrame: 29 },
  ]);

  /** A [0,10), B [30,40): the moved set's last end sits exactly at capacity 40. */
  const buildFlushAtCapacity = (): readonly PhysicPaintRotoKeyIdentity[] => Object.freeze([
    { keyId: 'a0', appFrame: 0 }, { keyId: 'a1', appFrame: 1 }, { keyId: 'a2', appFrame: 2 },
    { keyId: 'a3', appFrame: 3 }, { keyId: 'a4', appFrame: 4 }, { keyId: 'a5', appFrame: 5 },
    { keyId: 'a6', appFrame: 6 }, { keyId: 'a7', appFrame: 7 }, { keyId: 'a8', appFrame: 8 },
    { keyId: 'a9', appFrame: 9 },
    { keyId: 'b0', appFrame: 30 }, { keyId: 'b1', appFrame: 31 }, { keyId: 'b2', appFrame: 32 },
    { keyId: 'b3', appFrame: 33 }, { keyId: 'b4', appFrame: 34 }, { keyId: 'b5', appFrame: 35 },
    { keyId: 'b6', appFrame: 36 }, { keyId: 'b7', appFrame: 37 }, { keyId: 'b8', appFrame: 38 },
    { keyId: 'b9', appFrame: 39 },
  ]);

  const resolvePush = (
    identities: readonly PhysicPaintRotoKeyIdentity[],
    direction: 'right' | 'left',
    anchor: { readonly anchorKeyId?: string; readonly anchorLoopId?: string },
    deltaFrames: number,
    extra: {
      readonly incomingInterpolationBreakKeyIds?: readonly string[];
      readonly loopClips?: readonly PhysicPaintRotoLoopClip[];
      readonly capacity?: number;
    } = {},
  ): PhysicPaintRotoPhysicalEditResolution => resolvePhysicPaintRotoPhysicalEdit({
    identities,
    intent: { kind: 'push-rails', direction, ...anchor, deltaFrames },
    parentEndExclusive: extra.capacity ?? 40,
    capacity: extra.capacity ?? 40,
    interpolationEnabled: false,
    ...(extra.incomingInterpolationBreakKeyIds !== undefined
      ? { incomingInterpolationBreakKeyIds: extra.incomingInterpolationBreakKeyIds }
      : {}),
    ...(extra.loopClips !== undefined ? { loopClips: extra.loopClips } : {}),
  });

  it('Push Right from the first key of Key Rail B translates B to 25-34 and keeps Key Rail A byte-position fixed', () => {
    const resolution = resolvePush(buildTwoKeyRails(), 'right', { anchorKeyId: 'b0' }, 5, {
      incomingInterpolationBreakKeyIds: ['b0'],
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Push Right must resolve ok');
    const { proposal } = resolution;
    expect(proposal.status.operationKind).toBe('push-rails');
    expect(proposal.status.changed).toBe(true);
    // Key Rail A byte-position fixed (PUSH-01).
    expect(proposal.mapping.get('a0')).toBe(0);
    expect(proposal.mapping.get('a9')).toBe(9);
    // Key Rail B translated by +5.
    expect(proposal.mapping.get('b0')).toBe(25);
    expect(proposal.mapping.get('b9')).toBe(34);
    expect(Object.fromEntries(proposal.mapping)).toEqual({
      a0: 0, a1: 1, a2: 2, a3: 3, a4: 4, a5: 5, a6: 6, a7: 7, a8: 8, a9: 9,
      b0: 25, b1: 26, b2: 27, b3: 28, b4: 29, b5: 30, b6: 31, b7: 32, b8: 33, b9: 34,
    });
  });

  it('Push Left from the last key of Key Rail A translates A to 2-11 and keeps Key Rail B byte-position fixed (PUSH-01 prefix)', () => {
    const resolution = resolvePush(buildStaggeredKeyRails(), 'left', { anchorKeyId: 'a9' }, 3, {
      incomingInterpolationBreakKeyIds: ['b0'],
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Push Left must resolve ok');
    const { proposal } = resolution;
    expect(proposal.status.operationKind).toBe('push-rails');
    expect(proposal.status.changed).toBe(true);
    // Key Rail A translated by -3.
    expect(proposal.mapping.get('a0')).toBe(2);
    expect(proposal.mapping.get('a9')).toBe(11);
    // Key Rail B byte-position fixed (PUSH-01).
    expect(proposal.mapping.get('b0')).toBe(20);
    expect(proposal.mapping.get('b9')).toBe(29);
    expect(Object.fromEntries(proposal.mapping)).toEqual({
      a0: 2, a1: 3, a2: 4, a3: 5, a4: 6, a5: 7, a6: 8, a7: 9, a8: 10, a9: 11,
      b0: 20, b1: 21, b2: 22, b3: 23, b4: 24, b5: 25, b6: 26, b7: 27, b8: 28, b9: 29,
    });
  });

  it('clamps a Push Left at frame 0 — the moved set stops at the boundary (directional nearest-free search)', () => {
    // A [5,15): pushing left by 8 wants delta -8 but frame 0 stops at -5.
    const resolution = resolvePush(buildStaggeredKeyRails(), 'left', { anchorKeyId: 'a9' }, 8, {
      incomingInterpolationBreakKeyIds: ['b0'],
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Push Left clamp must resolve ok');
    const { proposal } = resolution;
    expect(proposal.status.changed).toBe(true);
    expect(proposal.mapping.get('a0')).toBe(0);
    expect(proposal.mapping.get('a9')).toBe(9);
    expect(proposal.mapping.get('b0')).toBe(20);
    expect(proposal.mapping.get('b9')).toBe(29);
  });

  it('clamps a Push Right at capacity/parent end (single end authority)', () => {
    // Push Right from a0 moves A AND B (the suffix set). B ends at 30 and
    // capacity 40 bounds the committed delta at 10 — preview-is-the-commit.
    const resolution = resolvePush(buildTwoKeyRails(), 'right', { anchorKeyId: 'a0' }, 15, {
      incomingInterpolationBreakKeyIds: ['b0'],
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Push Right clamp must resolve ok');
    const { proposal } = resolution;
    expect(proposal.status.changed).toBe(true);
    expect(proposal.mapping.get('a0')).toBe(10);
    expect(proposal.mapping.get('a9')).toBe(19);
    expect(proposal.mapping.get('b0')).toBe(30);
    expect(proposal.mapping.get('b9')).toBe(39);
  });

  it('fails closed with no-free-space-in-direction when the moved set is flush at capacity', () => {
    const resolution = resolvePush(buildFlushAtCapacity(), 'right', { anchorKeyId: 'a0' }, 5, {
      incomingInterpolationBreakKeyIds: ['b0'],
    });

    expect(resolution.ok).toBe(false);
    if (resolution.ok) throw new Error('Flush-at-capacity push must reject');
    expect(resolution.failure.code).toBe('no-free-space-in-direction');
    expect('proposal' in resolution).toBe(false);
  });

  it('fails closed with no-free-space-in-direction when the moved set is flush at frame 0', () => {
    const resolution = resolvePush(buildTwoKeyRails(), 'left', { anchorKeyId: 'a0' }, 3, {
      incomingInterpolationBreakKeyIds: ['b0'],
    });

    expect(resolution.ok).toBe(false);
    if (resolution.ok) throw new Error('Flush-at-frame-0 push must reject');
    expect(resolution.failure.code).toBe('no-free-space-in-direction');
    expect('proposal' in resolution).toBe(false);
  });

  it('D-16: fails closed when a source-attached Group in the moved set shares its source cycle with a fixed-side Group', () => {
    const identities = [
      { keyId: 'g0', appFrame: 20 },
      { keyId: 'g1', appFrame: 21 },
    ] as const;
    const resolution = resolvePush(identities, 'right', { anchorLoopId: 'loop-G' }, 5, {
      loopClips: buildPushGroupClips(),
      capacity: 40,
    });

    expect(resolution.ok).toBe(false);
    if (resolution.ok) throw new Error('Straddled push must reject');
    expect(resolution.failure.code).toBe('push-source-straddle');
    expect('proposal' in resolution).toBe(false);
  });

  it('D-16/43.3: a duplicated (shared-source) placement in the moved set moves placement-only and never straddles', () => {
    const identities = [
      { keyId: 'g0', appFrame: 20 },
      { keyId: 'g1', appFrame: 21 },
    ] as const;
    const resolution = resolvePush(identities, 'left', { anchorLoopId: 'loop-D' }, 2, {
      loopClips: buildPushGroupClips(),
      capacity: 40,
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Duplicated placement push must resolve ok');
    const { proposal } = resolution;
    // Shared source keys never move (placement-only, 43.3 algebra).
    expect(Object.fromEntries(proposal.mapping)).toEqual({ g0: 20, g1: 21 });
    // The duplicated placement interval translates; a placement-only set is a
    // real change, never a no-change (Pitfall 5).
    expect(proposal.status.changed).toBe(true);
    expect(proposal.status.code).toBe('ok');
    expect(proposal.nextLoopClips).not.toBeNull();
    if (!proposal.nextLoopClips) throw new Error('nextLoopClips must be present');
    const movedClip = proposal.nextLoopClips.find((clip) => clip.loopId === 'loop-D');
    expect(movedClip?.placementStart).toBe(0);
    expect(movedClip?.phaseOrigin).toBe(0);
    expect(movedClip?.originalEndExclusive).toBe(8);
    expect(movedClip?.visibleRanges).toEqual([{ start: 0, endExclusive: 8 }]);
    const ownerClip = proposal.nextLoopClips.find((clip) => clip.loopId === 'loop-G');
    expect(ownerClip?.placementStart).toBe(20);
    expect(ownerClip?.originalEndExclusive).toBe(28);
  });

  it('PUSH-03: Push Right opens the gap break on the moved set first key; Push Left on the fixed right side first key', () => {
    // Push Right from the first rail: the whole content moves; a0 owns the head gap.
    const pushRight = resolvePush(buildTwoKeyRails(), 'right', { anchorKeyId: 'a0' }, 5);
    expect(pushRight.ok).toBe(true);
    if (!pushRight.ok) throw new Error('Push Right must resolve');
    expect(pushRight.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['a0']);

    // Push Left from A: the vacated tail gap is owned by the fixed right side's
    // first key (b0 — the separating break, reused).
    const pushLeft = resolvePush(buildStaggeredKeyRails(), 'left', { anchorKeyId: 'a9' }, 3, {
      incomingInterpolationBreakKeyIds: ['b0'],
    });
    expect(pushLeft.ok).toBe(true);
    if (!pushLeft.ok) throw new Error('Push Left must resolve');
    expect(pushLeft.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['b0']);
  });

  it('PUSH-03: existing breaks are reused, never duplicated', () => {
    // The opened-gap owner already holds the break: reused byte-identical.
    const reusesOwned = resolvePush(buildTwoKeyRails(), 'right', { anchorKeyId: 'b0' }, 5, {
      incomingInterpolationBreakKeyIds: ['a0', 'b0'],
    });
    expect(reusesOwned.ok).toBe(true);
    if (!reusesOwned.ok) throw new Error('Reuse must resolve');
    expect(reusesOwned.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['a0', 'b0']);

    // A break on a moved key travels (43.1 D-14) and the opened-gap break is
    // added without duplicating the existing collection.
    const travels = resolvePush(buildTwoKeyRails(), 'right', { anchorKeyId: 'b0' }, 5, {
      incomingInterpolationBreakKeyIds: ['b0', 'b1'],
    });
    expect(travels.ok).toBe(true);
    if (!travels.ok) throw new Error('Travel must resolve');
    expect(travels.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['b0', 'b1']);
  });

  it('PUSH-03: a reverse push closing the gap normalizes the break collection', () => {
    // Forward Push Right from the first rail opens gap [0,5) with break on a0.
    const forward = resolvePush(buildTwoKeyRails(), 'right', { anchorKeyId: 'a0' }, 5);
    expect(forward.ok).toBe(true);
    if (!forward.ok) throw new Error('Forward push must resolve');
    expect(forward.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['a0']);

    // The reverse push resolves against the forwarded state (records shifted +5).
    const shifted = [...forward.proposal.mapping.entries()].map(([keyId, appFrame]) => ({ keyId, appFrame }));
    const reverse = resolvePush(shifted, 'left', { anchorKeyId: 'a0' }, 5, {
      incomingInterpolationBreakKeyIds: forward.proposal.nextIncomingInterpolationBreakKeyIds ?? undefined,
    });
    expect(reverse.ok).toBe(true);
    if (!reverse.ok) throw new Error('Reverse push must resolve');
    expect(reverse.proposal.mapping.get('a0')).toBe(0);
    expect(reverse.proposal.mapping.get('b0')).toBe(20);
    expect(reverse.proposal.nextIncomingInterpolationBreakKeyIds).toEqual([]);
  });

  it('43.1 D-14: a break owned by a moved key travels with stable identity', () => {
    const resolution = resolvePush(buildStaggeredKeyRails(), 'left', { anchorKeyId: 'a9' }, 3, {
      incomingInterpolationBreakKeyIds: ['a5', 'b0'],
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Identity-travel push must resolve');
    const { proposal } = resolution;
    expect(proposal.mapping.get('a5')).toBe(7);
    // a5's break survives the move and the fixed right side's first key (b0)
    // owns/reuses the vacated-gap break.
    expect(proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['a5', 'b0']);
  });
});

describe('derivePhysicPaintPushSet and clampPhysicPaintPushDestination (exported pure authorities)', () => {
  const buildTwoKeyRails = (): readonly PhysicPaintRotoKeyIdentity[] => Object.freeze([
    { keyId: 'a0', appFrame: 0 }, { keyId: 'a1', appFrame: 1 }, { keyId: 'a2', appFrame: 2 },
    { keyId: 'a3', appFrame: 3 }, { keyId: 'a4', appFrame: 4 }, { keyId: 'a5', appFrame: 5 },
    { keyId: 'a6', appFrame: 6 }, { keyId: 'a7', appFrame: 7 }, { keyId: 'a8', appFrame: 8 },
    { keyId: 'a9', appFrame: 9 },
    { keyId: 'b0', appFrame: 20 }, { keyId: 'b1', appFrame: 21 }, { keyId: 'b2', appFrame: 22 },
    { keyId: 'b3', appFrame: 23 }, { keyId: 'b4', appFrame: 24 }, { keyId: 'b5', appFrame: 25 },
    { keyId: 'b6', appFrame: 26 }, { keyId: 'b7', appFrame: 27 }, { keyId: 'b8', appFrame: 28 },
    { keyId: 'b9', appFrame: 29 },
  ]);

  it('derives the directional suffix set with byte-position-fixed opposite side and no straddle', () => {
    const identities = buildTwoKeyRails();
    const loopRangeContext = derivePhysicPaintRotoLoopRanges({
      identities,
      loopClips: [],
      capacity: 40,
      interpolationEnabled: false,
    });
    const set = derivePhysicPaintPushSet({
      anchorKeyId: 'b0',
      direction: 'right',
      identities,
      loopRanges: loopRangeContext.ranges,
      loopClips: [],
      incomingInterpolationBreakKeyIds: ['b0'],
    });

    expect(set.ok).toBe(true);
    if (!set.ok) throw new Error('Set derivation must resolve');
    expect(set.anchorRail.kind).toBe('key-rail');
    expect(set.movedRails.map((rail) => rail.id)).toEqual(['b0']);
    expect(set.fixedRails.map((rail) => rail.id)).toEqual(['a0']);
    expect([...set.movedKeyIds].sort()).toEqual(['b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9']);
    expect(set.movedSetBounds).toEqual({ firstFrame: 20, lastEndExclusive: 30 });
    expect(set.straddle).toBeNull();
  });

  it('reports a straddle verdict when a moved attached Group shares its source cycle with a fixed-side Group', () => {
    const identities = [
      { keyId: 'g0', appFrame: 20 },
      { keyId: 'g1', appFrame: 21 },
    ] as const;
    const loopRangeContext = derivePhysicPaintRotoLoopRanges({
      identities,
      loopClips: buildPushGroupClips(),
      capacity: 40,
      interpolationEnabled: false,
    });
    const set = derivePhysicPaintPushSet({
      anchorLoopId: 'loop-G',
      direction: 'right',
      identities,
      loopRanges: loopRangeContext.ranges,
      loopClips: buildPushGroupClips(),
      incomingInterpolationBreakKeyIds: [],
    });

    expect(set.ok).toBe(true);
    if (!set.ok) throw new Error('Straddled set must derive');
    expect(set.straddle).toEqual({
      straddled: true,
      movedGroupLoopId: 'loop-G',
      fixedGroupLoopId: 'loop-D',
      sourceCycleId: getPhysicsPaintRotoSourceCycleId(['g0', 'g1']),
    });
  });

  it('scans the directional nearest-free delta toward zero and fails on zero valid movement', () => {
    expect(clampPhysicPaintPushDestination({
      direction: 'left',
      proposedDeltaFrames: -8,
      movedSetBounds: { firstFrame: 5, lastEndExclusive: 15 },
      capacity: 40,
    })).toEqual({ ok: true, deltaFrames: -5 });
    expect(clampPhysicPaintPushDestination({
      direction: 'right',
      proposedDeltaFrames: 15,
      movedSetBounds: { firstFrame: 0, lastEndExclusive: 30 },
      capacity: 40,
    })).toEqual({ ok: true, deltaFrames: 10 });
    expect(clampPhysicPaintPushDestination({
      direction: 'left',
      proposedDeltaFrames: -3,
      movedSetBounds: { firstFrame: 0, lastEndExclusive: 10 },
      capacity: 40,
    })).toEqual({ ok: false });
    expect(clampPhysicPaintPushDestination({
      direction: 'right',
      proposedDeltaFrames: 5,
      movedSetBounds: { firstFrame: 0, lastEndExclusive: 40 },
      capacity: 40,
    })).toEqual({ ok: false });
    // Zero-delta is a valid no-change, never a failure (Task 3 channel).
    expect(clampPhysicPaintPushDestination({
      direction: 'left',
      proposedDeltaFrames: 0,
      movedSetBounds: { firstFrame: 5, lastEndExclusive: 15 },
      capacity: 40,
    })).toEqual({ ok: true, deltaFrames: 0 });
  });
});
