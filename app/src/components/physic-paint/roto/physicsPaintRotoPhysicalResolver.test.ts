import { describe, expect, it } from 'vitest';
import type {
  PhysicPaintRotoPhysicalEditIntent,
  PhysicPaintRotoPhysicalEditResolution,
} from './physicsPaintRotoPhysicalResolver';
import {
  clampPhysicPaintGroupDragDestination,
  createPhysicPaintRotoPasteKeyGroupIntent,
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
    expect(resolution.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['blank-3']);
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
      capacity: 16,
      interpolationEnabled: true,
      incomingInterpolationBreakKeyIds: ['B', 'D'],
    });
    const group = resolvePhysicPaintRotoPhysicalEdit({
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records,
      intent: { kind: 'delete-key-group', keyIds: ['B', 'D'] },
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

  it('D-11: a duplicated placement move updates only the vacated-interval break authority', () => {
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

    // (i) Successor E@24 after the vacated interval [12,20) owns the break.
    const withSuccessor = [
      ...baseIdentities,
      { keyId: 'E', appFrame: 24 },
    ] as const;
    const vacated = resolveMove(withSuccessor, duplicated(), 'loop-B', 14, { capacity: 30 });
    expect(vacated.ok).toBe(true);
    if (!vacated.ok) throw new Error('Duplicated vacated move must resolve');
    expect(vacated.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['E']);

    // (ii) Reuse: an existing break on the successor is reused, never duplicated.
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
      parentEndExclusive: 30,
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
