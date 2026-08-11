import { describe, expect, it } from 'vitest';
import {
  PHYSIC_PAINT_DEFAULT_APPLY_FRAMES,
  PHYSIC_PAINT_MAX_APPLY_FRAMES,
  clampPhysicPaintFrameCount,
  isPhysicPaintApplyPayload,
  isPhysicPaintFrameSyncMessage,
  isPhysicPaintLaunchContext,
  isPhysicPaintRotoBackgroundMetadata,
  isPhysicPaintRotoCacheFrame,
  isPhysicPaintRotoInterpolationSettings,
  isPhysicPaintRotoPhysicalEditApplyPayload,
  isPhysicPaintRotoPhysicalEditApplyResult,
  isPhysicPaintRotoPhysicalEditIntent,
  isPhysicPaintActionHistoryReleaseRequest,
  isPhysicPaintActionRetainedArtifactStatus,
  isPhysicPaintActionTransactionAcknowledgeRequest,
  isPhysicPaintActionTransactionPrepareRequest,
  isPhysicPaintActionTransactionResult,
  isPhysicPaintActionTransactionTokenRequest,
  normalizePhysicPaintRotoSegmentSpacingOverrides,
  serializePhysicPaintRotoPhysicalEditIntent,
} from './physicPaint';
import { buildPhysicPaintRotoPhysicalRevision } from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';

const renderedFrame = { frameIndex: 0, appFrame: 12, dataUrl: 'data:image/png;base64,aGVsbG8=', width: 1000, height: 650 };

const physicalLeaseToken = (layerId = 'layer-1') => ({
  projectContextId: 'project-1',
  layerId,
  generation: 1,
  owner: 'exclusive' as const,
});

const GROUP_FIELD_PARTICIPATION = [
  { field: 'syncState', value: 'modified' },
  { field: 'provenanceState', value: 'detached' },
  { field: 'phaseOrigin', value: 3 },
  { field: 'originalEndExclusive', value: 30 },
  { field: 'visibleRanges', value: [{ start: 0, endExclusive: 7 }, { start: 8, endExclusive: 25 }] },
  { field: 'frameOverrides', value: [{ appFrame: 7, keyId: 'override-7' }] },
] as const;

const groupTransportRecords = () => [{
  keyId: 'key-0',
  appFrame: 0,
  payload: { frameIndex: 0, appFrame: 0, dataUrl: 'data:image/png;base64,iVBORw0KGgo=' },
}, {
  keyId: 'override-1',
  appFrame: 1,
  payload: { frameIndex: 0, appFrame: 1, dataUrl: 'data:image/png;base64,iVBORw0KGgo=' },
}];

const completeTransportGroup = () => ({
  loopId: 'loop-1',
  placementStart: 0,
  sourceKeyIds: ['key-0'],
  repeat: 2,
  mode: 'progressive' as const,
  syncState: 'modified' as const,
  provenanceState: 'attached' as const,
  phaseOrigin: 0,
  originalEndExclusive: 2,
  visibleRanges: [{ start: 0, endExclusive: 2 }],
  frameOverrides: [{ appFrame: 1, keyId: 'override-1' }],
});

function groupLifecycleApplyPayload(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'replace-roto-physical-map',
    operationId: 'group-paint-1',
    operationKind: 'paint-group-frame',
    layerId: 'layer-1',
    leaseToken: physicalLeaseToken(),
    startFrame: 0,
    launchOperationId: 'launch-1',
    projectContextId: 'project-1',
    expectedRevision: 'revision-1',
    records: groupTransportRecords(),
    interpolationEnabled: false,
    interpolationMode: 'duplicate',
    selectedKeyId: 'override-1',
    selectedAppFrame: 1,
    cursorAppFrame: 1,
    loopClips: [completeTransportGroup()],
    semanticDelta: {
      kind: 'paint-group-frame',
      groupId: 'loop-1',
      appFrame: 1,
      overrideKeyId: 'override-1',
      createdOverride: true,
      filledDeletedOccurrence: false,
      previousRevision: 'revision-1',
      nextRevision: 'revision-2',
    },
    ...overrides,
  };
}

describe('physic paint payload contracts', () => {
  it('clamps generic apply frame counts to the established UI range', () => {
    expect(clampPhysicPaintFrameCount(3.8)).toBe(3);
    expect(clampPhysicPaintFrameCount(0)).toBe(1);
    expect(clampPhysicPaintFrameCount(9999)).toBe(PHYSIC_PAINT_MAX_APPLY_FRAMES);
    expect(clampPhysicPaintFrameCount('bad')).toBe(PHYSIC_PAINT_DEFAULT_APPLY_FRAMES);
  });

  it('accepts Roto launch context, project identity, cached keys, and background metadata', () => {
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, fps: 24, project: { name: 'Project', saved: true, contextId: 'context-1' }, rotoBackground: { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 } })).toBe(true);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 0, cachedRotoFrames: [{ frameIndex: 0, appFrame: 0, dataUrl: 'data:image/png;base64,a', source: 'real-key' }] })).toBe(true);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: -1 })).toBe(false);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, fps: 0 })).toBe(false);
  });

  it('validates Roto interpolation settings and durable segment overrides', () => {
    expect(isPhysicPaintRotoInterpolationSettings({ enabled: true, inBetweenCount: 2, mode: 'blend', deform: 10, position: 20, segmentSpacingOverrides: [{ fromSourceFrame: 2, toSourceFrame: 6, inBetweenCount: 4 }] })).toBe(true);
    expect(isPhysicPaintRotoInterpolationSettings({ enabled: true, inBetweenCount: 0, mode: 'blend', deform: 10, position: 20 })).toBe(false);
    expect(normalizePhysicPaintRotoSegmentSpacingOverrides([
      { fromSourceFrame: 2, toSourceFrame: 6, inBetweenCount: 4 },
      { fromSourceFrame: 2, toSourceFrame: 6, inBetweenCount: 5 },
      { fromSourceFrame: 6, toSourceFrame: 2, inBetweenCount: 1 },
    ])).toEqual([{ fromSourceFrame: 2, toSourceFrame: 6, inBetweenCount: 4 }]);
  });

  it('validates Roto cache provenance and background metadata', () => {
    expect(isPhysicPaintRotoCacheFrame({ frameIndex: 0, appFrame: 4, dataUrl: 'data:image/png;base64,a', source: 'generated-interpolation', nearestRealKeyFrame: 2 })).toBe(true);
    expect(isPhysicPaintRotoCacheFrame({ frameIndex: 0, appFrame: 4, dataUrl: 'data:image/png;base64,a', source: 'background-only-support', backgroundOnly: true, nearestRealKeyFrame: 2 })).toBe(true);
    expect(isPhysicPaintRotoBackgroundMetadata({ background: 'transparent', paperGrain: 'canvas1', grainStrength: 0 })).toBe(true);
    expect(isPhysicPaintRotoBackgroundMetadata({ background: 'photo', paperGrain: 'canvas1', grainStrength: 0.5 })).toBe(false);
  });

  it('accepts still, interpolation, deletion, and authoritative real-key replacement payloads only', () => {
    expect(isPhysicPaintApplyPayload({ kind: 'apply-canvas', operationId: 'op-1', layerId: 'layer-1', startFrame: 12, renderedFrame, rotoBackground: { background: 'transparent', paperGrain: 'canvas1', grainStrength: 0 } })).toBe(true);
    expect(isPhysicPaintApplyPayload({ kind: 'update-roto-interpolation-settings', operationId: 'op-2', layerId: 'layer-1', startFrame: 12, settings: { enabled: true, inBetweenCount: 3, mode: 'duplicate', deform: 0, position: 0 } })).toBe(true);
    expect(isPhysicPaintApplyPayload({ kind: 'delete-roto-frame', operationId: 'op-3', layerId: 'layer-1', startFrame: 12 })).toBe(true);
    expect(isPhysicPaintApplyPayload({ kind: 'replace-roto-key-frames', operationId: 'op-4', layerId: 'layer-1', startFrame: 12, frames: [{ ...renderedFrame, source: 'real-key', sourceFrame: 12 }], rotoBackground: { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 } })).toBe(true);
    expect(isPhysicPaintApplyPayload({ kind: ['apply', 'play', 'canvas'].join('-'), operationId: 'obsolete', layerId: 'layer-1', startFrame: 12, frames: [renderedFrame] })).toBe(false);
  });

  it('accepts only the insert-empty-segment transport contract', () => {
    const records = [{
      keyId: 'inserted-key',
      appFrame: 4,
      payload: { frameIndex: 0, appFrame: 4, dataUrl: 'data:image/png;base64,iVBORw0KGgo=' },
    }];
    const payload = {
      kind: 'replace-roto-physical-map',
      operationId: 'insert-empty-segment-1',
      operationKind: 'insert-empty-segment',
      intent: {
        kind: 'insert-empty-segment',
        destinationAppFrame: 4,
        insertedKeyId: 'inserted-key',
        blankPayload: records[0].payload,
      },
      layerId: 'layer-1',
      leaseToken: physicalLeaseToken(),
      startFrame: 0,
      launchOperationId: 'launch-1',
      projectContextId: 'project-1',
      expectedRevision: 'revision-1',
      records,
      interpolationEnabled: true,
      interpolationMode: 'blend',
      selectedKeyId: 'inserted-key',
      selectedAppFrame: 4,
      cursorAppFrame: 4,
      incomingInterpolationBreakKeyIds: ['inserted-key'],
      semanticDelta: {
        kind: 'insert-empty-segment',
        insertedKeyId: 'inserted-key',
        destinationAppFrame: 4,
      },
    } as const;

    expect(isPhysicPaintRotoPhysicalEditApplyPayload(payload)).toBe(true);
    expect(isPhysicPaintRotoPhysicalEditApplyPayload({ ...payload, intent: undefined })).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditApplyPayload({
      ...payload,
      intent: { kind: 'delete-key', selectedKeyId: 'inserted-key' },
    })).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditApplyPayload({
      ...payload,
      intent: { ...payload.intent, unknown: true },
    })).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditApplyPayload({
      ...payload,
      semanticDelta: { ...payload.semanticDelta, unknown: true },
    })).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditApplyPayload({
      ...payload,
      semanticDelta: { ...payload.semanticDelta, insertedKeyId: '' },
    })).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditApplyPayload({
      ...payload,
      semanticDelta: { ...payload.semanticDelta, destinationAppFrame: -1 },
    })).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditApplyPayload({
      ...payload,
      semanticDelta: { ...payload.semanticDelta, kind: 'duplicate-key' },
    })).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditApplyPayload({
      ...payload,
      semanticDelta: undefined,
    })).toBe(false);
  });

  it('strictly parses and canonically serializes one Insert Slot intent', () => {
    const intent = { kind: 'insert-slot', selectedKeyId: 'key-A' } as const;

    expect(isPhysicPaintRotoPhysicalEditIntent(intent)).toBe(true);
    expect(serializePhysicPaintRotoPhysicalEditIntent(intent)).toBe('{"kind":"insert-slot","selectedKeyId":"key-A"}');
    expect(isPhysicPaintRotoPhysicalEditIntent(JSON.parse(serializePhysicPaintRotoPhysicalEditIntent(intent)))).toBe(true);

    expect(isPhysicPaintRotoPhysicalEditIntent({ ...intent, unknown: true })).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditIntent({ ...intent, selectedKeyId: '' })).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditIntent({ ...intent, selectedAppFrame: -1 })).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditIntent({ ...intent, kind: 'insert-gap' })).toBe(false);
  });

  it('strictly parses and canonically serializes every ordinary physical-edit intent', () => {
    const payload = { frameIndex: 0, appFrame: 3, dataUrl: 'data:image/png;base64,AAAA', width: 2, height: 2 };
    const intents = [
      { kind: 'insert-empty-segment', destinationAppFrame: 3, insertedKeyId: 'blank-3', blankPayload: payload },
      { kind: 'delete-key', selectedKeyId: 'key-A' },
      { kind: 'delete-key-group', keyIds: ['key-A', 'key-C'] },
      { kind: 'move-key', movedKeyId: 'key-A', target: { kind: 'physical-cell', appFrame: 4 } },
      { kind: 'move-key-group', movedKeyIds: ['key-A', 'key-C'], grabbedKeyId: 'key-C', target: { kind: 'before-key', targetKeyId: 'key-D' } },
      { kind: 'force-spacing', emptyFrames: 2, selectedKeyId: null, scopeKeyIds: null, linkedSourceSpacingScopes: null },
      { kind: 'force-spacing', emptyFrames: 1, selectedKeyId: 'key-A', scopeKeyIds: ['key-A', 'key-B'], linkedSourceSpacingScopes: [{ sourceCycleId: '5:key-A|5:key-B|5:key-C', sourceKeyIds: ['key-A', 'key-B', 'key-C'], selectedSourceKeyIds: ['key-A', 'key-B'] }] },
      { kind: 'duplicate-key', sourceKeyId: 'key-A', newKeyId: 'key-copy' },
      { kind: 'paste-key', destinationAppFrame: 3, destinationKeyId: 'key-A', newKeyId: null, clipboardPayload: payload },
      { kind: 'paste-key', destinationAppFrame: 8, destinationKeyId: null, newKeyId: 'key-paste', clipboardPayload: payload },
      { kind: 'paste-key-group', destinationAppFrame: 12, entries: [
        { payload, sourceAppFrame: 3, sourceKeyId: 'key-A', newKeyId: 'paste-A' },
        { payload: { ...payload, appFrame: 7 }, sourceAppFrame: 7, sourceKeyId: 'key-C', newKeyId: 'paste-C' },
      ] },
    ] as const;

    for (const intent of intents) {
      expect(isPhysicPaintRotoPhysicalEditIntent(intent), intent.kind).toBe(true);
      const serialized = serializePhysicPaintRotoPhysicalEditIntent(intent);
      const parsed: unknown = JSON.parse(serialized);
      expect(isPhysicPaintRotoPhysicalEditIntent(parsed), serialized).toBe(true);
      if (!isPhysicPaintRotoPhysicalEditIntent(parsed)) throw new Error('Canonical intent must parse');
      expect(serializePhysicPaintRotoPhysicalEditIntent(parsed)).toBe(serialized);
    }

    expect(serializePhysicPaintRotoPhysicalEditIntent(intents[0])).toBe('{"kind":"insert-empty-segment","destinationAppFrame":3,"insertedKeyId":"blank-3","blankPayload":{"frameIndex":0,"appFrame":3,"dataUrl":"data:image/png;base64,AAAA","width":2,"height":2}}');
    expect(serializePhysicPaintRotoPhysicalEditIntent(intents[4])).toBe('{"kind":"move-key-group","movedKeyIds":["key-A","key-C"],"grabbedKeyId":"key-C","target":{"kind":"before-key","targetKeyId":"key-D"}}');
    expect(serializePhysicPaintRotoPhysicalEditIntent(intents[6])).toBe('{"kind":"force-spacing","emptyFrames":1,"selectedKeyId":"key-A","scopeKeyIds":["key-A","key-B"],"linkedSourceSpacingScopes":[{"sourceCycleId":"5:key-A|5:key-B|5:key-C","sourceKeyIds":["key-A","key-B","key-C"],"selectedSourceKeyIds":["key-A","key-B"]}]}');
  });

  it('rejects malformed, duplicate, reordered, and ambiguous ordinary intent authorization', () => {
    const payload = { frameIndex: 0, appFrame: 3, dataUrl: 'data:image/png;base64,AAAA', width: 2, height: 2 };
    const oversizedId = 'x'.repeat(257);
    const malformed = [
      { kind: 'delete-key', selectedKeyId: '', unknown: true },
      { kind: 'delete-key-group', keyIds: [] },
      { kind: 'delete-key-group', keyIds: ['A', 'A'] },
      { kind: 'move-key', movedKeyId: 'A', target: { kind: 'physical-cell', appFrame: -1 } },
      { kind: 'move-key', movedKeyId: 'A', target: { kind: 'before-key', targetKeyId: '', unknown: true } },
      { kind: 'move-key-group', movedKeyIds: ['A', 'A'], grabbedKeyId: 'A', target: { kind: 'physical-cell', appFrame: 3 } },
      { kind: 'move-key-group', movedKeyIds: ['A', 'B'], grabbedKeyId: 'C', target: { kind: 'physical-cell', appFrame: 3 } },
      { kind: 'force-spacing', emptyFrames: -1, selectedKeyId: null },
      { kind: 'force-spacing', emptyFrames: 1.5, selectedKeyId: null },
      { kind: 'force-spacing', emptyFrames: 1, selectedKeyId: 'A', scopeKeyIds: ['A', 'A'] },
      { kind: 'force-spacing', emptyFrames: 1, selectedKeyId: 'A', scopeKeyIds: ['A', 'B'], linkedSourceSpacingScopes: [] },
      { kind: 'force-spacing', emptyFrames: 1, selectedKeyId: 'A', scopeKeyIds: ['A', 'B'], linkedSourceSpacingScopes: [{ sourceCycleId: 'wrong', sourceKeyIds: ['A', 'B'], selectedSourceKeyIds: ['A', 'B'] }] },
      { kind: 'force-spacing', emptyFrames: 1, selectedKeyId: 'A', scopeKeyIds: ['B', 'A'], linkedSourceSpacingScopes: [{ sourceCycleId: '1:A|1:B|1:C', sourceKeyIds: ['A', 'B', 'C'], selectedSourceKeyIds: ['B', 'A'] }] },
      { kind: 'duplicate-key', sourceKeyId: 'A', newKeyId: 'A' },
      { kind: 'paste-key', destinationAppFrame: 3, destinationKeyId: null, newKeyId: null, clipboardPayload: payload },
      { kind: 'paste-key', destinationAppFrame: 3, destinationKeyId: 'A', newKeyId: 'B', clipboardPayload: payload },
      { kind: 'paste-key-group', destinationAppFrame: 12, entries: [{ payload, sourceAppFrame: 3, sourceKeyId: 'A', newKeyId: 'paste-A' }] },
      { kind: 'paste-key-group', destinationAppFrame: 12, entries: [
        { payload, sourceAppFrame: 7, sourceKeyId: 'C', newKeyId: 'paste-C' },
        { payload, sourceAppFrame: 3, sourceKeyId: 'A', newKeyId: 'paste-A' },
      ] },
      { kind: 'paste-key-group', destinationAppFrame: 12, entries: [
        { payload, sourceAppFrame: 3, sourceKeyId: 'A', newKeyId: 'paste-X' },
        { payload, sourceAppFrame: 7, sourceKeyId: 'C', newKeyId: 'paste-X' },
      ] },
      { kind: 'paste-key-group', destinationAppFrame: 12, entries: [
        { payload, sourceAppFrame: 3, sourceKeyId: 'A', newKeyId: 'paste-A' },
        { payload, sourceAppFrame: 7, sourceKeyId: 'A', newKeyId: 'paste-C' },
      ] },
      { kind: 'insert-empty-segment', destinationAppFrame: -1, insertedKeyId: 'blank', blankPayload: payload },
      { kind: 'insert-empty-segment', destinationAppFrame: 3, insertedKeyId: oversizedId, blankPayload: { ...payload, dataUrl: '' } },
      { kind: 'play-script' },
    ];

    for (const intent of malformed) {
      expect(isPhysicPaintRotoPhysicalEditIntent(intent), JSON.stringify(intent)).toBe(false);
    }
    expect(() => serializePhysicPaintRotoPhysicalEditIntent(malformed[0] as never)).toThrow('malformed intent');
  });

  it('requires current background metadata only on Play Script physical transactions', () => {
    const records = [{
      keyId: 'key-1',
      appFrame: 0,
      payload: { frameIndex: 0, appFrame: 0, dataUrl: 'data:image/png;base64,iVBORw0KGgo=' },
    }];
    const playScript = {
      kind: 'replace-roto-physical-map',
      operationId: 'play-script-1',
      operationKind: 'play-script',
      layerId: 'layer-1',
      leaseToken: physicalLeaseToken(),
      startFrame: 0,
      launchOperationId: 'launch-1',
      projectContextId: 'project-1',
      expectedRevision: 'revision-1',
      records,
      interpolationEnabled: false,
      interpolationMode: 'duplicate',
      selectedKeyId: 'key-1',
      selectedAppFrame: 0,
      cursorAppFrame: 0,
      semanticDelta: {
        kind: 'play-script',
        affectedStartAppFrame: 0,
        affectedEndAppFrame: 0,
        expectedLayerCapacity: 10,
        expectedLayerEndExclusive: 10,
        proposedRecords: records,
        freshKeyIds: ['key-1'],
      },
    } as const;
    const rotoBackground = { background: 'canvas1', paperGrain: 'canvas2', grainStrength: 0.45 } as const;

    expect(isPhysicPaintRotoPhysicalEditApplyPayload(playScript)).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditApplyPayload({ ...playScript, rotoBackground })).toBe(true);
    expect(isPhysicPaintRotoPhysicalEditApplyPayload({
      ...playScript,
      rotoBackground,
      intent: { kind: 'insert-slot', selectedKeyId: 'key-1' },
    })).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditApplyPayload({
      ...playScript,
      operationKind: 'force-spacing',
      semanticDelta: undefined,
      rotoBackground,
    })).toBe(false);
  });

  it('accepts a lifecycle-complete Group Paint payload and exact settlement result', () => {
    const payload = groupLifecycleApplyPayload();
    expect(isPhysicPaintRotoPhysicalEditApplyPayload(payload)).toBe(true);
    expect(isPhysicPaintRotoPhysicalEditApplyResult({
      operationId: payload.operationId,
      kind: payload.kind,
      operationKind: payload.operationKind,
      layerId: payload.layerId,
      startFrame: payload.startFrame,
      launchOperationId: payload.launchOperationId,
      expectedRevision: payload.expectedRevision,
      stagedRevision: 'revision-2',
      acceptedRevision: 'revision-2',
      interpolationMode: payload.interpolationMode,
      selectedKeyId: payload.selectedKeyId,
      selectedAppFrame: payload.selectedAppFrame,
      cursorAppFrame: payload.cursorAppFrame,
      appliedFrameCount: 1,
      ok: true,
      semanticDelta: payload.semanticDelta,
      loopClips: payload.loopClips,
    })).toBe(true);
  });

  it.each([
    ['delete-group-frame', {
      kind: 'delete-group-frame', groupId: 'loop-1', appFrame: 1,
      cleanupKeyIds: ['override-1'], previousRevision: 'revision-1', nextRevision: 'revision-2',
    }],
    ['delete-group', {
      kind: 'delete-group', groupId: 'loop-1', cleanupKeyIds: ['override-1'],
      previousRevision: 'revision-1', nextRevision: 'revision-2',
    }],
    ['regenerate-group', {
      kind: 'regenerate-group', groupId: 'loop-1', expectedActionRevision: 'action-revision-1',
      cleanupKeyIds: ['override-1'], previousRevision: 'revision-1', nextRevision: 'revision-2',
    }],
    ['detach-action-groups', {
      kind: 'detach-action-groups', actionId: 'action-1', expectedActionRevision: 'action-revision-1',
      affectedGroupIds: ['loop-1'], cleanupKeyIds: [], previousRevision: 'revision-1', nextRevision: 'revision-2',
    }],
    ['delete-action-groups', {
      kind: 'delete-action-groups', actionId: 'action-1', expectedActionRevision: 'action-revision-1',
      affectedGroupIds: ['loop-1'], cleanupKeyIds: ['override-1'], previousRevision: 'revision-1', nextRevision: 'revision-2',
    }],
  ] as const)('accepts the closed %s lifecycle operation impact', (operationKind, semanticDelta) => {
    expect(isPhysicPaintRotoPhysicalEditApplyPayload(groupLifecycleApplyPayload({
      operationId: `${operationKind}-1`, operationKind, semanticDelta,
    }))).toBe(true);
  });

  it('rejects omitted, unknown, malformed, duplicate, and operation-mismatched Group lifecycle facts', () => {
    const payload = groupLifecycleApplyPayload();
    const incompleteGroup = { ...completeTransportGroup() } as Record<string, unknown>;
    delete incompleteGroup.syncState;
    const malformedRanges = { ...completeTransportGroup(), visibleRanges: [{ start: 0, endExclusive: 1 }, { start: 1, endExclusive: 2 }] };
    const duplicateOverrides = { ...completeTransportGroup(), frameOverrides: [{ appFrame: 1, keyId: 'override-1' }, { appFrame: 1, keyId: 'override-2' }] };
    const incompleteImpact = { ...payload.semanticDelta } as Record<string, unknown>;
    delete incompleteImpact.createdOverride;

    expect(isPhysicPaintRotoPhysicalEditApplyPayload({ ...payload, loopClips: [incompleteGroup] })).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditApplyPayload({ ...payload, loopClips: [{ ...completeTransportGroup(), unknown: true }] })).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditApplyPayload({ ...payload, loopClips: [malformedRanges] })).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditApplyPayload({ ...payload, loopClips: [duplicateOverrides] })).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditApplyPayload({ ...payload, semanticDelta: incompleteImpact })).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditApplyPayload({ ...payload, semanticDelta: { ...payload.semanticDelta, unknown: true } })).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditApplyPayload({ ...payload, operationKind: 'delete-group-frame' })).toBe(false);
    const omittedCursor = { ...payload } as Record<string, unknown>;
    delete omittedCursor.cursorAppFrame;
    expect(isPhysicPaintRotoPhysicalEditApplyPayload(omittedCursor)).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditApplyPayload({ ...payload, cursorAppFrame: -1 })).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditApplyPayload({ ...payload, cursorAppFrame: 1.5 })).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditApplyPayload({ ...payload, unknownCursorAuthority: 1 })).toBe(false);
  });

  it.each(GROUP_FIELD_PARTICIPATION)('rejects a Group carrying only the $field lifecycle field', ({ field, value }) => {
    const partialGroup = {
      loopId: 'loop-1', placementStart: 0, sourceKeyIds: ['key-0'], repeat: 2, mode: 'progressive', [field]: value,
    };
    expect(isPhysicPaintRotoPhysicalEditApplyPayload(groupLifecycleApplyPayload({ loopClips: [partialGroup] }))).toBe(false);
  });

  it('validates namespaced frame-sync messages', () => {
    expect(isPhysicPaintFrameSyncMessage({ type: 'physic-paint:seek-frame', frame: 12 })).toBe(true);
    expect(isPhysicPaintFrameSyncMessage({ type: 'physic-paint:seek-frame', frame: -1 })).toBe(false);
  });
});

const actionPhysicalDocument = () => {
  const interpolation = { enabled: false, mode: 'duplicate' as const };
  const realKeyRecords: never[] = [];
  const loopClips: never[] = [];
  return {
    capacity: 24,
    realKeyRecords,
    interpolation,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 18,
    revision: buildPhysicPaintRotoPhysicalRevision(realKeyRecords, interpolation, loopClips),
    loopClips,
    incomingInterpolationBreakKeyIds: [],
  };
};

const actionTransactionPrepare = (direction: 'forward' | 'undo' | 'redo' = 'forward') => {
  const actionId = '11111111-1111-4111-8111-111111111111';
  const token = {
    forward: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    undo: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    redo: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  }[direction];
  const physicalDocument = actionPhysicalDocument();
  return {
    token,
    commandId: 'history-command-10',
    generation: 10,
    operationId: `${direction}-operation-1`,
    leaseToken: `${direction}-lease-1`,
    direction,
    mode: 'keep-groups' as const,
    authority: {
      projectContextId: 'project-context-1',
      layerId: 'layer-1',
      launchOperationId: 'launch-1',
      actionId,
      expectedActionPresent: direction !== 'undo',
      expectedActionRevision: 'action-revision-1',
      expectedPhysicalRevision: direction === 'undo' ? 'physical-after' : 'physical-before',
      expectedPhysicalHash: direction === 'undo' ? 'hash-after' : 'hash-before',
    },
    impactDigest: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    retainedArtifact: {
      commandId: 'history-command-10',
      generation: 10,
      actionId,
      managedPath: `scripts/${actionId}.efx-roto-script.json`,
      originalRevision: 'action-revision-1',
      integritySha256: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    },
    target: {
      physicalRevision: physicalDocument.revision,
      physicalHash: 'target-hash-1',
      physicalDocument,
      selectedGroupId: null,
      cursorAppFrame: 18,
    },
  };
};

describe('referenced Action transaction contracts', () => {
  it.each(['forward', 'undo', 'redo'] as const)('accepts one exact %s prepare request and its token/acknowledge requests', (direction) => {
    const request = actionTransactionPrepare(direction);
    expect(isPhysicPaintActionTransactionPrepareRequest(request)).toBe(true);
    expect(isPhysicPaintActionTransactionTokenRequest({ token: request.token })).toBe(true);
    expect(isPhysicPaintActionTransactionAcknowledgeRequest({
      token: request.token,
      commandId: request.commandId,
      generation: request.generation,
      operationId: request.operationId,
      leaseToken: request.leaseToken,
      direction,
    })).toBe(true);
  });

  it('accepts only closed transaction modes and history release reasons', () => {
    expect(isPhysicPaintActionTransactionPrepareRequest({
      ...actionTransactionPrepare(), mode: 'delete-action-and-groups',
    })).toBe(true);
    for (const reason of ['eviction', 'redo-branch-truncation', 'session-history-clear'] as const) {
      expect(isPhysicPaintActionHistoryReleaseRequest({
        projectContextId: 'project-context-1', launchOperationId: 'launch-1',
        commandId: 'history-command-10', generation: 10, reason,
      })).toBe(true);
    }
    expect(isPhysicPaintActionTransactionPrepareRequest({ ...actionTransactionPrepare(), direction: 'sideways' })).toBe(false);
    expect(isPhysicPaintActionTransactionPrepareRequest({ ...actionTransactionPrepare(), mode: 'silent-cascade' })).toBe(false);
    expect(isPhysicPaintActionHistoryReleaseRequest({
      projectContextId: 'project-context-1', launchOperationId: 'launch-1',
      commandId: 'history-command-10', generation: 10, reason: 'session-clear',
    })).toBe(false);
  });

  it('rejects unknown, missing, mismatched, and malformed prepare authority', () => {
    const request = actionTransactionPrepare();
    expect(isPhysicPaintActionTransactionPrepareRequest({ ...request, unknown: true })).toBe(false);
    expect(isPhysicPaintActionTransactionPrepareRequest({ ...request, generation: 0 })).toBe(false);
    expect(isPhysicPaintActionTransactionPrepareRequest({
      ...request, authority: { ...request.authority, expectedActionPresent: false },
    })).toBe(false);
    expect(isPhysicPaintActionTransactionPrepareRequest({
      ...request, retainedArtifact: { ...request.retainedArtifact, commandId: 'other-command' },
    })).toBe(false);
    expect(isPhysicPaintActionTransactionPrepareRequest({
      ...request, retainedArtifact: { ...request.retainedArtifact, integritySha256: 'bad' },
    })).toBe(false);
    expect(isPhysicPaintActionTransactionPrepareRequest({
      ...request, target: { ...request.target, physicalRevision: 'stale-revision' },
    })).toBe(false);
    expect(isPhysicPaintActionTransactionPrepareRequest({
      ...request, target: { ...request.target, selectedGroupId: '' },
    })).toBe(false);
    expect(isPhysicPaintActionTransactionPrepareRequest({
      ...request, target: { ...request.target, cursorAppFrame: 24 },
    })).toBe(false);
    expect(isPhysicPaintActionTransactionPrepareRequest({
      ...request,
      target: { ...request.target, physicalDocument: { ...request.target.physicalDocument, unknown: true } },
    })).toBe(false);
  });

  it('distinguishes every durable journal and retained-history result state', () => {
    const request = actionTransactionPrepare();
    const record = { schemaVersion: 1, state: 'prepared', ...request };
    expect(isPhysicPaintActionTransactionResult(record)).toBe(true);
    expect(isPhysicPaintActionTransactionResult({ ...record, state: 'committed' })).toBe(true);
    expect(isPhysicPaintActionTransactionResult({ ...record, state: 'recovery-required' })).toBe(true);
    expect(isPhysicPaintActionTransactionResult({
      state: 'recovered-prepared', token: request.token, actionPresent: true,
    })).toBe(true);
    expect(isPhysicPaintActionTransactionResult({
      state: 'cleanup-pending', schemaVersion: 1, token: request.token,
      commandId: request.commandId, generation: request.generation,
      operationId: request.operationId, leaseToken: request.leaseToken, direction: request.direction,
    })).toBe(true);
    expect(isPhysicPaintActionTransactionResult({
      state: 'acknowledged', token: request.token, commandId: request.commandId,
      generation: request.generation, operationId: request.operationId,
      leaseToken: request.leaseToken, direction: request.direction, cleaned: true,
    })).toBe(true);
    expect(isPhysicPaintActionTransactionResult({
      state: 'released', projectContextId: request.authority.projectContextId,
      launchOperationId: request.authority.launchOperationId, commandId: request.commandId,
      generation: request.generation, reason: 'eviction', released: true,
    })).toBe(true);
    expect(isPhysicPaintActionTransactionResult({
      state: 'failed', code: 'active-recovery-blocked', error: 'Recovery is active',
    })).toBe(true);
  });

  it('validates retained metadata and rejects stale-shaped result variants', () => {
    const request = actionTransactionPrepare();
    expect(isPhysicPaintActionRetainedArtifactStatus({
      schemaVersion: 1, state: 'retained',
      projectContextId: request.authority.projectContextId,
      launchOperationId: request.authority.launchOperationId,
      ...request.retainedArtifact,
      byteLength: 128,
    })).toBe(true);
    expect(isPhysicPaintActionRetainedArtifactStatus({
      schemaVersion: 1, state: 'retained', projectContextId: 'project-context-1',
      launchOperationId: 'launch-1', ...request.retainedArtifact, byteLength: -1,
    })).toBe(false);
    expect(isPhysicPaintActionTransactionResult({
      schemaVersion: 1, state: 'prepared', ...request,
      token: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    })).toBe(true);
    expect(isPhysicPaintActionTransactionResult({
      schemaVersion: 1, state: 'prepared', ...request, unexpected: true,
    })).toBe(false);
    expect(isPhysicPaintActionTransactionResult({
      state: 'acknowledged', token: request.token, commandId: request.commandId,
      generation: request.generation, operationId: request.operationId,
      leaseToken: request.leaseToken, direction: 'sideways', cleaned: true,
    })).toBe(false);
  });
});
