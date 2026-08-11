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
  isPhysicPaintRotoPhysicalEditIntent,
  normalizePhysicPaintRotoSegmentSpacingOverrides,
  serializePhysicPaintRotoPhysicalEditIntent,
} from './physicPaint';

const renderedFrame = { frameIndex: 0, appFrame: 12, dataUrl: 'data:image/png;base64,aGVsbG8=', width: 1000, height: 650 };

const GROUP_FIELD_PARTICIPATION = [
  { field: 'syncState', value: 'modified' },
  { field: 'provenanceState', value: 'detached' },
  { field: 'phaseOrigin', value: 3 },
  { field: 'originalEndExclusive', value: 30 },
  { field: 'visibleRanges', value: [{ start: 0, endExclusive: 7 }, { start: 8, endExclusive: 25 }] },
  { field: 'frameOverrides', value: [{ appFrame: 7, keyId: 'override-7' }] },
] as const;

function physicalApplyPayloadWithGroupField(field: string, value: unknown) {
  const records = [{
    keyId: 'key-0',
    appFrame: 0,
    payload: { frameIndex: 0, appFrame: 0, dataUrl: 'data:image/png;base64,iVBORw0KGgo=' },
  }];
  return {
    kind: 'replace-roto-physical-map',
    operationId: `group-field-${field}`,
    operationKind: 'move-key',
    intent: {
      kind: 'move-key',
      movedKeyId: 'key-0',
      target: { kind: 'physical-cell', appFrame: 0 },
    },
    layerId: 'layer-1',
    startFrame: 0,
    launchOperationId: 'launch-1',
    expectedRevision: 'revision-1',
    records,
    interpolationEnabled: false,
    interpolationMode: 'duplicate',
    selectedKeyId: 'key-0',
    selectedAppFrame: 0,
    loopClips: [{
      loopId: 'loop-1',
      placementStart: 0,
      sourceKeyIds: ['key-0'],
      repeat: 2,
      mode: 'progressive',
      [field]: value,
    }],
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
      startFrame: 0,
      launchOperationId: 'launch-1',
      expectedRevision: 'revision-1',
      records,
      interpolationEnabled: true,
      interpolationMode: 'blend',
      selectedKeyId: 'inserted-key',
      selectedAppFrame: 4,
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
      startFrame: 0,
      launchOperationId: 'launch-1',
      expectedRevision: 'revision-1',
      records,
      interpolationEnabled: false,
      interpolationMode: 'duplicate',
      selectedKeyId: 'key-1',
      selectedAppFrame: 0,
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

  it.each(GROUP_FIELD_PARTICIPATION)('marks $field as unimplemented at the physical transport boundary', ({ field, value }) => {
    expect(isPhysicPaintRotoPhysicalEditApplyPayload(
      physicalApplyPayloadWithGroupField(field, value),
    )).toBe(false);
  });

  it('validates namespaced frame-sync messages', () => {
    expect(isPhysicPaintFrameSyncMessage({ type: 'physic-paint:seek-frame', frame: 12 })).toBe(true);
    expect(isPhysicPaintFrameSyncMessage({ type: 'physic-paint:seek-frame', frame: -1 })).toBe(false);
  });
});
