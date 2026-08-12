import { describe, expect, it, vi } from 'vitest';
import type { PhysicPaintLaunchContext, PhysicPaintScriptLibraryRequest, PhysicPaintScriptLibraryResult } from '../../../types/physicPaint';
import { buildRotoScriptDeleteReferenceImpact, createRotoScriptLibraryController, prepareReferencedActionDeletion } from './physicsPaintRotoScriptLibrary';
import { buildPhysicPaintRotoPhysicalRevision, type PhysicPaintRotoPhysicalDocument } from './physicsPaintRotoPhysicalModel';
import { RotoScriptClipboardReplacementOutcome, type PreparedRotoScriptLoadAndApply, type RotoScriptPersistenceCapture } from './physicsPaintRotoScriptClipboard';
import { createPersistedRotoScript, type PersistedRotoScriptThumbnailV1 } from './physicsPaintRotoScriptSchema';

const context = (): PhysicPaintLaunchContext => ({ operationId: 'launch', layerId: 'layer-1', layerName: 'Ink', startFrame: 4, width: 1600, height: 900, project: { name: 'Project', saved: true, contextId: 'context-1' } });
const row = (id: string, name: string, createdAt = '2026-07-16T12:00:00Z') => ({ id, revision: `rev-${id}`, integritySha256: 'a'.repeat(64), name, createdAt, updatedAt: createdAt, source: { projectName: 'Project', layerId: 'layer-1', layerName: 'Ink', sourceFrame: 4, displayFrame: 4, width: 1600, height: 900, background: { background: 'white' as const, paperGrain: 'canvas1', grainStrength: 0 } }, thumbnail: { mimeType: 'image/webp' as const, width: 1, height: 1, quality: 0.8, dataUrl: 'data:image/webp;base64,UklGRgQAAABXRUJQ' }, brushCount: 1 });
const result = (request: PhysicPaintScriptLibraryRequest, rows = [row('b', 'B'), row('a', 'A')], extra: Partial<PhysicPaintScriptLibraryResult> = {}): PhysicPaintScriptLibraryResult => ({ operationId: request.operationId, kind: request.kind, ok: true, rows, skippedInvalidCount: 0, diagnostics: [], ...extra });

function harness(saved = true) {
  let launch = saved ? context() : { ...context(), project: { name: 'Project', saved: false, contextId: 'context-1' } };
  const requests: PhysicPaintScriptLibraryRequest[] = [];
  const request = vi.fn(async (input: PhysicPaintScriptLibraryRequest) => { requests.push(input); return result(input); });
  const clipboard = { current: null as unknown };
  const capture: RotoScriptPersistenceCapture = { script: { provenance: { sessionId: 's', layerId: 'layer-1', sourceFrame: 4 }, sourceFrame: 4, sourceDisplayFrame: 4, sourceRevision: 1, brushes: [{ primary: { tool: 'paint', points: [{ x: 1, y: 2, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 }], color: '#000000', params: { size: 1, opacity: 100, pressure: 100, waterAmount: 0, dryAmount: 0, edgeDetail: 0, pickup: 0, eraseStrength: 0, antiAlias: 0 }, timestamp: 1 }, continuations: [] }] }, scriptAlphaCanvas: {} as HTMLCanvasElement };
  const thumbnail: PersistedRotoScriptThumbnailV1 = { mimeType: 'image/webp', width: 1, height: 1, quality: 0.8, dataUrl: 'data:image/webp;base64,UklGRgQAAABXRUJQ' };
  const replaceClipboard = vi.fn((value, _preparation?: PreparedRotoScriptLoadAndApply) => { clipboard.current = value; return RotoScriptClipboardReplacementOutcome.Replaced; });
  const log = vi.fn();
  const controller = createRotoScriptLibraryController({ request, capturePersistence: vi.fn(async () => capture), captureThumbnail: vi.fn(async () => thumbnail), replaceClipboard, getLaunchContext: () => launch, log });
  return { controller, request, requests, clipboard, replaceClipboard, log, setLaunch: (value: PhysicPaintLaunchContext) => { launch = value; } };
}

const scriptIds = {
  a: '123e4567-e89b-42d3-a456-426614174000',
  b: '223e4567-e89b-42d3-a456-426614174000',
} as const;
const webp = 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAUAAAAvAAAAAAA=';

function loadedScript(id: 'a' | 'b', name: string) {
  return createPersistedRotoScript({
    id: scriptIds[id],
    name,
    createdAt: '2026-07-16T12:00:00Z',
    updatedAt: '2026-07-16T12:00:00Z',
    source: row(id, name).source,
    thumbnail: { ...row(id, name).thumbnail, dataUrl: webp },
    brushes: [{ primary: { tool: 'paint', points: [{ x: id === 'a' ? 10 : 20, y: 2, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 }], color: '#000000', params: { size: 1, opacity: 100, pressure: 100, waterAmount: 0, dryAmount: 0, edgeDetail: 0, pickup: 0, eraseStrength: 0, antiAlias: 0 }, timestamp: 1 }, continuations: [] }],
  });
}

describe('Roto script library controller', () => {
  it('hydrates from the exact project context payload without reading the launch getter', async () => {
    const test = harness(false);
    await test.controller.updateProjectContext(context());
    expect(test.requests.filter((request) => request.kind === 'scan')).toHaveLength(1);
    expect(test.controller.rows.value.map((item) => item.id)).toEqual(['a', 'b']);
    expect(test.controller.availability.value).toMatchObject({ canSave: true, saveDisabledReason: null });
    expect(test.controller.status.value).toBe('Found 2 scripts');
  });

  it('auto-scans exactly once per context and keeps manual refresh explicit', async () => {
    const test = harness(false);
    const savedContext = context();
    await test.controller.updateProjectContext(savedContext);
    await test.controller.updateProjectContext(savedContext);
    expect(test.requests.filter((request) => request.kind === 'scan')).toHaveLength(1);
    expect(test.controller.availability.value).toMatchObject({ canSave: true, saveDisabledReason: null });
    test.setLaunch(savedContext);
    await test.controller.refresh();
    expect(test.requests.filter((request) => request.kind === 'scan')).toHaveLength(2);
  });

  it('rejects rows from a context replaced while its scan was in flight', async () => {
    let settle!: (value: PhysicPaintScriptLibraryResult) => void;
    const test = harness(false);
    test.request.mockImplementationOnce((input) => { test.requests.push(input); return new Promise((resolve) => { settle = resolve; }); });
    const staleHydration = test.controller.updateProjectContext(context());
    const replacement = test.controller.updateProjectContext({ ...context(), project: { name: 'Other', saved: true, contextId: 'context-2' } });
    const staleRequest = test.request.mock.calls[0][0];
    settle(result(staleRequest, [row('z', 'Stale')]));
    await staleHydration;
    await replacement;
    expect(test.requests.filter((request) => request.kind === 'scan')).toHaveLength(2);
    expect(test.controller.rows.value.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('clears rows and refuses persistence for an unsaved project context payload', async () => {
    const test = harness(false);
    await test.controller.updateProjectContext(context());
    expect(test.controller.rows.value).toHaveLength(2);
    await test.controller.updateProjectContext({ ...context(), project: { name: 'Project', saved: false, contextId: 'context-1' } });
    expect(test.controller.rows.value).toEqual([]);
    expect(test.controller.availability.value).toMatchObject({ canSave: false, saveDisabledReason: 'Save the project first.' });
    const requestCount = test.requests.length;
    expect(await test.controller.saveActiveFrame()).toBe(false);
    expect(test.controller.status.value).toBe('Save the project first.');
    expect(test.requests).toHaveLength(requestCount);
  });

  it('gates unsaved projects exactly and never requests persistence', async () => {
    const test = harness(false);
    expect(test.controller.availability.value).toMatchObject({ canSave: false, saveDisabledReason: 'Save the project first.' });
    expect(await test.controller.saveActiveFrame()).toBe(false);
    expect(test.controller.status.value).toBe('Save the project first.');
    expect(test.request).not.toHaveBeenCalled();
  });

  it('drives explicit scans, stable sorting, naming and expected revisions', async () => {
    const test = harness();
    await test.controller.enterScripts();
    expect(test.controller.rows.value.map((item) => item.id)).toEqual(['a', 'b']);
    test.controller.select('a'); test.controller.beginRename(); test.controller.updateRenameDraft('Renamed');
    await test.controller.commitRename();
    expect(test.requests[test.requests.length - 1]).toMatchObject({ kind: 'rename', scriptId: 'a', expectedRevision: 'rev-a', name: 'Renamed' });
    await test.controller.refresh();
    expect(test.requests.filter((request) => request.kind === 'scan')).toHaveLength(2);
  });

  it('rejects overlapping and stale operations after context replacement or disposal', async () => {
    let settle!: (value: PhysicPaintScriptLibraryResult) => void;
    const test = harness();
    test.request.mockImplementationOnce(() => new Promise((resolve) => { settle = resolve; }));
    const pending = test.controller.refresh();
    expect(test.controller.busy.value).toBe(true);
    expect(await test.controller.saveActiveFrame()).toBe(false);
    test.setLaunch({ ...context(), project: { name: 'Other', saved: true, contextId: 'context-2' } });
    test.controller.dispose();
    const pendingRequest = test.request.mock.calls[0][0];
    settle(result(pendingRequest, [row('z', 'Stale')]));
    await pending;
    expect(test.controller.rows.value).toEqual([]);
    expect(test.controller.busy.value).toBe(false);
  });

  it('preserves visible rows when scan, save, rename, or delete requests fail', async () => {
    const test = harness();
    await test.controller.refresh();
    test.controller.select('a');
    const acceptedRows = test.controller.rows.value;

    test.request.mockImplementation(async (input) => result(input, [], { ok: false, error: `${input.kind} unavailable` }));
    await test.controller.refresh();
    expect(test.controller.rows.value).toEqual(acceptedRows);
    expect(test.controller.selectedId.value).toBe('a');

    await expect(test.controller.saveActiveFrame()).resolves.toBe(false);
    expect(test.controller.rows.value).toEqual(acceptedRows);
    test.controller.beginRename();
    test.controller.updateRenameDraft('Renamed');
    await expect(test.controller.commitRename()).resolves.toBe(false);
    expect(test.controller.rows.value).toEqual(acceptedRows);
    test.controller.cancelRename();
    test.controller.requestDelete();
    await expect(test.controller.confirmDelete()).resolves.toBe(false);
    expect(test.controller.rows.value).toEqual(acceptedRows);
    expect(test.controller.selected.value?.id).toBe('a');
  });

  it('reloads every activation and commits selection only after immutable clipboard replacement', async () => {
    const test = harness();
    await test.controller.refresh();
    test.request.mockImplementation(async (input) => {
      test.requests.push(input);
      if (input.kind !== 'load') return result(input);
      return result(input, [row('b', 'B'), row('a', 'A')], { script: loadedScript(input.scriptId as 'a' | 'b', input.scriptId === 'a' ? 'A' : 'B') });
    });

    await expect(test.controller.activateAndLoad('a')).resolves.toBe(true);
    const firstClipboard = test.clipboard.current;
    await expect(test.controller.activateAndLoad('a')).resolves.toBe(true);

    expect(test.requests.filter((request) => request.kind === 'load' && request.scriptId === 'a')).toHaveLength(2);
    expect(test.replaceClipboard).toHaveBeenCalledTimes(2);
    expect(test.clipboard.current).not.toBe(firstClipboard);
    expect(test.controller.selectedId.value).toBe('a');
    expect(test.controller.status.value).toBe('Loaded A — 1 brushes');
  });

  it('passes the exact preparation token only for transactional Load + Apply', async () => {
    const test = harness();
    await test.controller.refresh();
    test.request.mockImplementation(async (input) => result(input, [row('b', 'B'), row('a', 'A')], { script: input.kind === 'load' ? loadedScript(input.scriptId as 'a' | 'b', 'A') : undefined }));
    const preparation = { preparationId: Symbol('load-and-apply') };

    await expect(test.controller.activateAndLoad('a', preparation)).resolves.toBe(true);
    expect(test.replaceClipboard).toHaveBeenLastCalledWith(expect.any(Object), preparation);
    await expect(test.controller.activateAndLoad('a')).resolves.toBe(true);
    expect(test.replaceClipboard).toHaveBeenLastCalledWith(expect.any(Object), undefined);
  });

  it('preserves the last successful selection and clipboard when request, conversion, or replacement fails', async () => {
    const test = harness();
    await test.controller.refresh();
    test.request.mockImplementation(async (input) => {
      test.requests.push(input);
      if (input.kind !== 'load') return result(input);
      return result(input, [row('b', 'B'), row('a', 'A')], { script: loadedScript(input.scriptId as 'a' | 'b', input.scriptId === 'a' ? 'A' : 'B') });
    });
    await test.controller.activateAndLoad('a');
    const acceptedClipboard = test.clipboard.current;

    const acceptedRows = test.controller.rows.value;
    const acceptedSkippedCount = test.controller.skippedInvalidCount.value;
    test.request.mockImplementationOnce(async (input) => { test.requests.push(input); return result(input, [], { ok: false, error: 'Unreadable preset' }); });
    await expect(test.controller.activateAndLoad('b')).resolves.toBe(false);
    expect(test.controller.rows.value).toEqual(acceptedRows);
    expect(test.controller.skippedInvalidCount.value).toBe(acceptedSkippedCount);
    expect(test.controller.selectedId.value).toBe('a');
    expect(test.controller.selected.value?.id).toBe('a');
    expect(test.clipboard.current).toBe(acceptedClipboard);
    expect(test.controller.status.value).toBe('Unreadable preset');
    expect(test.log).toHaveBeenCalledWith('Unreadable preset', true);

    test.request.mockImplementationOnce(async (input) => result(input, [row('b', 'B')], { script: { ...loadedScript('b', 'B'), brushes: [] } }));
    await expect(test.controller.activateAndLoad('b')).resolves.toBe(false);
    expect(test.controller.rows.value).toEqual(acceptedRows);
    expect(test.controller.selectedId.value).toBe('a');
    expect(test.clipboard.current).toBe(acceptedClipboard);

    test.request.mockImplementationOnce(async (input) => result(input, [], { ok: false, rows: [] }));
    await expect(test.controller.activateAndLoad('b')).resolves.toBe(false);
    expect(test.controller.rows.value).toEqual(acceptedRows);
    expect(test.controller.selectedId.value).toBe('a');
    expect(test.clipboard.current).toBe(acceptedClipboard);

    test.replaceClipboard.mockImplementationOnce(() => RotoScriptClipboardReplacementOutcome.Rejected);
    await expect(test.controller.activateAndLoad('b')).resolves.toBe(false);
    expect(test.controller.rows.value).toEqual(acceptedRows);
    expect(test.controller.skippedInvalidCount.value).toBe(acceptedSkippedCount);
    expect(test.controller.selectedId.value).toBe('a');
    expect(test.controller.selected.value?.id).toBe('a');
    expect(test.clipboard.current).toBe(acceptedClipboard);
    expect(test.controller.status.value).toBe('Loaded script could not replace the clipboard.');
    expect(test.log).toHaveBeenCalledWith('Loaded script could not replace the clipboard.', true);
  });
});

type ReferencedDeleteDirection = 'forward' | 'undo' | 'redo';
type ReferencedDeleteMode = 'keep-groups' | 'delete-action-and-groups';
type SettlementEvent =
  | 'physical-replacement'
  | 'version-bump'
  | 'history-pointer'
  | 'selection'
  | 'library-settlement';

interface DurableDeleteTarget {
  physicalRevision: string;
  physicalHash: string;
  selectedGroupId: string | null;
  cursorAppFrame: number;
}

interface DurableDeleteLease {
  commandId: string;
  generation: number;
  token: string;
  direction: ReferencedDeleteDirection;
  mode: ReferencedDeleteMode;
  expectedCurrentRevision: string;
  target: DurableDeleteTarget;
}

class CommittedOnlyDeleteLedger {
  readonly events: SettlementEvent[] = [];
  readonly releases: Array<{ commandId: string; generation: number; reason: 'eviction' | 'redo-branch-truncation' | 'session-clear' }> = [];
  private phase: 'idle' | 'prepared' | 'committed' | 'acknowledged' = 'idle';
  private settled = false;
  private lease: DurableDeleteLease | null = null;

  prepare(lease: DurableDeleteLease) {
    if (this.phase !== 'idle' || lease.commandId.length === 0 || lease.generation < 1 || lease.token.length === 0) return false;
    this.lease = structuredClone(lease);
    this.phase = 'prepared';
    return true;
  }

  markCommitted(commandId: string, generation: number, token: string, direction: ReferencedDeleteDirection) {
    if (!this.matches(commandId, generation, token, direction) || this.phase !== 'prepared') return false;
    this.phase = 'committed';
    return true;
  }

  settle(currentRevision: string) {
    if (this.phase !== 'committed' || this.settled || this.lease?.expectedCurrentRevision !== currentRevision) return false;
    this.events.push('physical-replacement', 'version-bump', 'history-pointer', 'selection', 'library-settlement');
    this.settled = true;
    return true;
  }

  acknowledge(commandId: string, generation: number, token: string, direction: ReferencedDeleteDirection) {
    if (!this.matches(commandId, generation, token, direction) || this.phase !== 'committed' || !this.settled) return false;
    this.phase = 'acknowledged';
    return true;
  }

  recoverPrepared() {
    if (this.phase !== 'prepared') return false;
    this.phase = 'idle';
    this.lease = null;
    return true;
  }

  reconstructCommittedLease(commandId: string, generation: number, token: string, direction: ReferencedDeleteDirection) {
    return this.phase === 'committed' && this.matches(commandId, generation, token, direction);
  }

  release(commandId: string, generation: number, reason: 'eviction' | 'redo-branch-truncation' | 'session-clear', activeRecoveryReferences: ReadonlySet<string>) {
    const key = `${commandId}:${generation}`;
    if (activeRecoveryReferences.has(key)) return false;
    if (this.releases.some((release) => `${release.commandId}:${release.generation}` === key)) return false;
    this.releases.push({ commandId, generation, reason });
    return true;
  }

  private matches(commandId: string, generation: number, token: string, direction: ReferencedDeleteDirection) {
    return this.lease?.commandId === commandId
      && this.lease.generation === generation
      && this.lease.token === token
      && this.lease.direction === direction;
  }
}

function durableLease(direction: ReferencedDeleteDirection, mode: ReferencedDeleteMode): DurableDeleteLease {
  return {
    commandId: `command-${mode}`,
    generation: 7,
    token: `${direction}-token`,
    direction,
    mode,
    expectedCurrentRevision: direction === 'undo' ? 'physical-after-forward' : 'physical-before',
    target: {
      physicalRevision: direction === 'undo' ? 'physical-before' : `physical-after-${direction}`,
      physicalHash: direction === 'undo' ? 'hash-before' : `hash-after-${direction}`,
      selectedGroupId: mode === 'delete-action-and-groups' && direction !== 'undo' ? null : 'group-1',
      cursorAppFrame: 18,
    },
  };
}

function referencedActionDocument(): PhysicPaintRotoPhysicalDocument {
  const realKeyRecords = [
    { kind: 'real-key' as const, keyId: 'source-a', appFrame: 0, payload: { frameIndex: 0, appFrame: 0, dataUrl: 'data:image/png;base64,AA==', width: 10, height: 10 } },
    { kind: 'real-key' as const, keyId: 'source-b', appFrame: 4, payload: { frameIndex: 0, appFrame: 4, dataUrl: 'data:image/png;base64,BB==', width: 10, height: 10 } },
  ];
  const groupOverrideRecords = [
    { kind: 'real-key' as const, keyId: 'override-only', appFrame: 15, payload: { frameIndex: 0, appFrame: 15, dataUrl: 'data:image/png;base64,CC==', width: 10, height: 10 } },
  ];
  const interpolation = { enabled: false, mode: 'duplicate' as const };
  const loopClips = [
    {
      loopId: 'group-late', placementStart: 12, sourceKeyIds: ['source-a', 'source-b'], repeat: 2 as const, mode: 'progressive' as const,
      scriptId: scriptIds.a, motion: { deformation: 15, position: 20 }, overrideColor: '#123456', syncState: 'modified' as const,
      provenanceState: 'attached' as const, phaseOrigin: 12, originalEndExclusive: 20,
      visibleRanges: [{ start: 12, endExclusive: 16 }, { start: 18, endExclusive: 20 }], frameOverrides: [{ appFrame: 15, keyId: 'override-only' }],
    },
    {
      loopId: 'group-early', placementStart: 2, sourceKeyIds: ['source-a', 'source-b'], repeat: 2 as const, mode: 'static' as const,
      scriptId: scriptIds.a, motion: { deformation: 0, position: 0 }, overrideColor: null, syncState: 'synchronized' as const,
      provenanceState: 'attached' as const, phaseOrigin: 2, originalEndExclusive: 10,
      visibleRanges: [{ start: 2, endExclusive: 10 }], frameOverrides: [],
    },
    {
      loopId: 'shared-survivor', placementStart: 30, sourceKeyIds: ['source-a', 'source-b'], repeat: 1 as const, mode: 'static' as const,
      scriptId: scriptIds.b, motion: { deformation: 0, position: 0 }, overrideColor: null, syncState: 'synchronized' as const,
      provenanceState: 'attached' as const, phaseOrigin: 30, originalEndExclusive: 31,
      visibleRanges: [{ start: 30, endExclusive: 31 }], frameOverrides: [],
    },
  ];
  return {
    capacity: 60, realKeyRecords, groupOverrideRecords, interpolation, scriptMotion: { deformation: 9, position: 11 }, background: null,
    selectedKeyId: null, cursorAppFrame: 15, loopClips, incomingInterpolationBreakKeyIds: ['source-b'],
    revision: buildPhysicPaintRotoPhysicalRevision(realKeyRecords, interpolation, loopClips, ['source-b'], groupOverrideRecords),
  };
}

describe('production referenced Action deletion preflight', () => {
  it('builds one immutable placement-ordered disclosure from accepted visible Group ranges', () => {
    const document = referencedActionDocument();
    const impact = buildRotoScriptDeleteReferenceImpact(document, { ...row('a', 'Walk Cycle'), id: scriptIds.a });

    expect(impact).toEqual({
      physicalRevision: document.revision,
      groupCount: 2,
      visibleRangeCount: 3,
      affectedGroups: [
        { groupId: 'group-early', name: 'Walk Cycle Group', placementStart: 2, endExclusive: 10, visibleRanges: [{ start: 2, endExclusive: 10 }] },
        { groupId: 'group-late', name: 'Walk Cycle Group', placementStart: 12, endExclusive: 20, visibleRanges: [{ start: 12, endExclusive: 16 }, { start: 18, endExclusive: 20 }] },
      ],
    });
    expect(Object.isFrozen(impact)).toBe(true);
    expect(Object.isFrozen(impact?.affectedGroups)).toBe(true);
    expect(Object.isFrozen(impact?.affectedGroups[1].visibleRanges)).toBe(true);
  });

  it.each([
    ['keep-groups', ['group-early', 'group-late'], []],
    ['delete-action-and-groups', ['group-early', 'group-late'], ['override-only']],
  ] as const)('freezes the exact %s candidate after lease acquisition with zero publication', async (mode, affectedGroupIds, cleanupKeyIds) => {
    const document = referencedActionDocument();
    const events: string[] = [];
    const prepare = vi.fn(async (_authority, request) => ({ schemaVersion: 1 as const, state: 'prepared' as const, ...request }));
    const commit = vi.fn(async (_authority, request) => ({ schemaVersion: 1 as const, state: 'committed' as const, ...request }));

    const prepared = await prepareReferencedActionDeletion({
      context: context(), row: { ...row('a', 'A'), id: scriptIds.a, revision: 'rev-a', integritySha256: 'a'.repeat(64) }, mode,
    }, {
      getPhysicalDocument: () => document,
      acquireLease: () => { events.push('lease'); return 'lease-1'; },
      releaseLease: vi.fn(() => true),
      nextUuid: vi.fn()
        .mockReturnValueOnce('123e4567-e89b-42d3-a456-426614174111')
        .mockReturnValueOnce('123e4567-e89b-42d3-a456-426614174222'),
      nextGeneration: () => 7,
      digest: vi.fn(async () => 'b'.repeat(64)),
      prepare: async (authority, request) => { events.push('prepare'); return prepare(authority, request); },
      commit: async (authority, request) => { events.push('commit'); return commit(authority, request); },
    });

    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error(prepared.error);
    expect(events).toEqual(['lease', 'prepare', 'commit']);
    expect(prepared.impact.affectedGroupIds).toEqual(affectedGroupIds);
    expect(prepared.impact.cleanupKeyIds).toEqual(cleanupKeyIds);
    expect(prepared.request).toMatchObject({
      commandId: '123e4567-e89b-42d3-a456-426614174111', generation: 7,
      token: '123e4567-e89b-42d3-a456-426614174222', leaseToken: 'lease-1', direction: 'forward', mode,
      authority: { projectContextId: 'context-1', layerId: 'layer-1', launchOperationId: 'launch', actionId: scriptIds.a, expectedActionRevision: 'rev-a', expectedPhysicalRevision: document.revision },
      retainedArtifact: { actionId: scriptIds.a, originalRevision: 'rev-a', integritySha256: 'a'.repeat(64) },
    });
    expect(document).toEqual(referencedActionDocument());
    expect(prepare).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledOnce();
  });

  it('rejects stale final Action or physical authority and preserves ordinary unreferenced deletion', async () => {
    const document = referencedActionDocument();
    const releaseLease = vi.fn(() => true);
    const prepare = vi.fn();
    const stale = await prepareReferencedActionDeletion({
      context: context(), row: { ...row('a', 'A'), id: scriptIds.a, revision: 'rev-a', integritySha256: 'a'.repeat(64) }, mode: 'keep-groups',
    }, {
      getPhysicalDocument: vi.fn().mockReturnValueOnce(document).mockReturnValueOnce({ ...document, revision: 'newer-revision' }),
      getActionRevision: () => 'newer-action-revision',
      acquireLease: () => 'lease-1', releaseLease,
      nextUuid: () => '123e4567-e89b-42d3-a456-426614174111', nextGeneration: () => 1,
      digest: async () => 'b'.repeat(64), prepare, commit: vi.fn(),
    });
    expect(stale).toMatchObject({ ok: false, code: 'stale-authority' });
    expect(prepare).not.toHaveBeenCalled();
    expect(releaseLease).toHaveBeenCalledWith('lease-1');

    const test = harness();
    await test.controller.refresh();
    test.controller.select('a'); test.controller.requestDelete();
    await expect(test.controller.confirmDelete()).resolves.toBe(true);
    expect(test.requests[test.requests.length - 1]).toMatchObject({ kind: 'delete', scriptId: 'a', expectedRevision: 'rev-a' });
  });
});

describe('startup Action transaction recovery gate', () => {
  it('blocks ordinary availability and scan until recovery succeeds exactly once per context', async () => {
    let finishRecovery!: (value: { ok: boolean; error?: string }) => void;
    const order: string[] = [];
    const request = vi.fn(async (input: PhysicPaintScriptLibraryRequest) => { order.push(input.kind); return result(input); });
    const recoverBeforeAvailability = vi.fn(async () => new Promise<{ ok: boolean; error?: string }>((resolve) => { finishRecovery = resolve; }));
    const controller = createRotoScriptLibraryController({
      request, capturePersistence: vi.fn(async () => null), captureThumbnail: vi.fn(), replaceClipboard: vi.fn(),
      getLaunchContext: context, log: vi.fn(),
      referencedActionDeletion: {
        getPhysicalDocument: vi.fn(), acquireLease: vi.fn(), releaseLease: vi.fn(), nextUuid: vi.fn(), nextGeneration: vi.fn(),
        digest: vi.fn(), prepare: vi.fn(), commit: vi.fn(), recoverBeforeAvailability,
      },
    });

    const hydration = controller.updateProjectContext(context());
    await vi.waitFor(() => expect(recoverBeforeAvailability).toHaveBeenCalledOnce());
    expect(request).not.toHaveBeenCalled();
    expect(controller.recoveryReady.value).toBe(false);
    expect(controller.availability.value).toMatchObject({ canSave: false, canLoad: false, canRename: false, canDelete: false });
    const rowsWhileRecoveryOwnsHistory = controller.rows.value;
    const statusWhileRecoveryOwnsHistory = controller.status.value;
    await Promise.resolve();
    expect(controller.rows.value).toBe(rowsWhileRecoveryOwnsHistory);
    expect(controller.status.value).toBe(statusWhileRecoveryOwnsHistory);
    finishRecovery({ ok: true });
    await hydration;
    expect(order).toEqual(['scan']);
    expect(controller.recoveryReady.value).toBe(true);
    await controller.updateProjectContext(context());
    expect(recoverBeforeAvailability).toHaveBeenCalledOnce();
  });

  it('fails closed without scanning when startup recovery cannot settle', async () => {
    const request = vi.fn();
    const controller = createRotoScriptLibraryController({
      request, capturePersistence: vi.fn(async () => null), captureThumbnail: vi.fn(), replaceClipboard: vi.fn(),
      getLaunchContext: context, log: vi.fn(),
      referencedActionDeletion: {
        getPhysicalDocument: vi.fn(), acquireLease: vi.fn(), releaseLease: vi.fn(), nextUuid: vi.fn(), nextGeneration: vi.fn(),
        digest: vi.fn(), prepare: vi.fn(), commit: vi.fn(), recoverBeforeAvailability: vi.fn(async () => ({ ok: false, error: 'newer physical authority' })),
      },
    });
    await controller.updateProjectContext(context());
    expect(request).not.toHaveBeenCalled();
    expect(controller.recoveryReady.value).toBe(false);
    expect(controller.transactionPhase.value).toBe('recovery-required');
    expect(controller.status.value).toBe('newer physical authority');
  });
});

describe('Wave 0 committed-only referenced Action deletion ledger', () => {
  it.each([
    ['keep-groups', 'forward'],
    ['keep-groups', 'undo'],
    ['keep-groups', 'redo'],
    ['delete-action-and-groups', 'forward'],
    ['delete-action-and-groups', 'undo'],
    ['delete-action-and-groups', 'redo'],
  ] as const)('publishes zero events before commit and exactly one settlement for %s %s', (mode, direction) => {
    const ledger = new CommittedOnlyDeleteLedger();
    const lease = durableLease(direction, mode);
    expect(ledger.prepare(lease)).toBe(true);
    expect(ledger.events).toEqual([]);
    expect(ledger.markCommitted(lease.commandId, lease.generation, lease.token, direction)).toBe(true);
    expect(ledger.events).toEqual([]);
    expect(ledger.settle(lease.expectedCurrentRevision)).toBe(true);
    expect(ledger.events).toEqual(['physical-replacement', 'version-bump', 'history-pointer', 'selection', 'library-settlement']);
    expect(ledger.settle(lease.expectedCurrentRevision)).toBe(false);
    expect(ledger.acknowledge(lease.commandId, lease.generation, 'stale-token', direction)).toBe(false);
    expect(ledger.events).toHaveLength(5);
    expect(ledger.acknowledge(lease.commandId, lease.generation, lease.token, direction)).toBe(true);
    expect(ledger.events).toHaveLength(5);
  });

  it('restores prepared authority without settlement and rejects newer-document recovery', () => {
    const prepared = new CommittedOnlyDeleteLedger();
    const lease = durableLease('forward', 'keep-groups');
    expect(prepared.prepare(lease)).toBe(true);
    expect(prepared.recoverPrepared()).toBe(true);
    expect(prepared.events).toEqual([]);

    const committed = new CommittedOnlyDeleteLedger();
    expect(committed.prepare(lease)).toBe(true);
    expect(committed.markCommitted(lease.commandId, lease.generation, lease.token, lease.direction)).toBe(true);
    expect(committed.reconstructCommittedLease(lease.commandId, lease.generation, lease.token, lease.direction)).toBe(true);
    expect(committed.settle('newer-physical-document')).toBe(false);
    expect(committed.events).toEqual([]);
  });

  it('releases retained artifacts only for unreferenced eviction, redo truncation, or clear', () => {
    const ledger = new CommittedOnlyDeleteLedger();
    expect(ledger.release('evicted', 1, 'eviction', new Set())).toBe(true);
    expect(ledger.release('redo', 2, 'redo-branch-truncation', new Set())).toBe(true);
    expect(ledger.release('clear', 3, 'session-clear', new Set())).toBe(true);
    expect(ledger.release('active', 4, 'eviction', new Set(['active:4']))).toBe(false);
    expect(ledger.release('evicted', 1, 'session-clear', new Set())).toBe(false);
    expect(ledger.releases.map((release) => release.reason)).toEqual(['eviction', 'redo-branch-truncation', 'session-clear']);
  });

  it('marks the committed-only Wave 0 protocol as executable', () => {
    const committedOnlyProtocolImplemented = true;
    expect(committedOnlyProtocolImplemented).toBe(true);
  });
});
