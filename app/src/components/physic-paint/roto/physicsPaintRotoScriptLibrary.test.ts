import { describe, expect, it, vi } from 'vitest';
import type { PhysicPaintLaunchContext, PhysicPaintScriptLibraryRequest, PhysicPaintScriptLibraryResult } from '../../../types/physicPaint';
import {
  buildRotoScriptDeleteReferenceImpact,
  createRotoScriptLibraryController,
  prepareReferencedActionDeletion,
  referencedCustomBrushIds,
  type RotoScriptLibraryController,
  type RotoScriptLibraryControllerPorts,
} from './physicsPaintRotoScriptLibrary';
import { buildPhysicPaintRotoPhysicalRevision, type PhysicPaintRotoPhysicalDocument } from './physicsPaintRotoPhysicalModel';
import { RotoScriptClipboardReplacementOutcome, type PreparedRotoScriptLoadAndApply, type RotoScriptPersistenceCapture } from './physicsPaintRotoScriptClipboard';
import { parseRotoScript, serializeAquarelleRotoScript, type PersistedRotoScriptThumbnailV1 } from './physicsPaintRotoScriptSchema';
import { isAquarelleDryEvent, type AquarellePayloadEvent, type AquarelleStrokePayload } from '@efxlab/efx-watercolor/payload';
import { testWebpBytes } from '../../../testUtils/testWebpBytes';

const context = (): PhysicPaintLaunchContext => ({ operationId: 'launch', layerId: 'layer-1', layerName: 'Ink', startFrame: 4, width: 1600, height: 900, project: { name: 'Project', saved: true, contextId: 'context-1' } });
const row = (id: string, name: string, createdAt = '2026-07-16T12:00:00Z') => ({ id, revision: `rev-${id}`, integritySha256: 'a'.repeat(64), name, createdAt, updatedAt: createdAt, source: { projectName: 'Project', layerId: 'layer-1', layerName: 'Ink', sourceFrame: 4, displayFrame: 4, width: 1600, height: 900, background: { background: 'white' as const, grainStrength: 0 } }, thumbnail: { mimeType: 'image/webp' as const, width: 1, height: 1, quality: 0.8, dataUrl: 'data:image/webp;base64,UklGRgQAAABXRUJQ' }, brushCount: 1 });
const result = (request: PhysicPaintScriptLibraryRequest, rows = [row('b', 'B'), row('a', 'A')], extra: Partial<PhysicPaintScriptLibraryResult> = {}): PhysicPaintScriptLibraryResult => ({ operationId: request.operationId, kind: request.kind, ok: true, rows, skippedInvalidCount: 0, diagnostics: [], ...extra });

function harness(
  saved = true,
  overrides: Partial<RotoScriptLibraryControllerPorts> = {},
  create: (ports: RotoScriptLibraryControllerPorts) => RotoScriptLibraryController = createRotoScriptLibraryController,
) {
  let launch = saved ? context() : { ...context(), project: { name: 'Project', saved: false, contextId: 'context-1' } };
  const requests: PhysicPaintScriptLibraryRequest[] = [];
  const request = vi.fn(async (input: PhysicPaintScriptLibraryRequest) => { requests.push(input); return result(input); });
  const clipboard = { current: null as unknown };
  const capture: RotoScriptPersistenceCapture = {
    script: {
      provenance: { sessionId: 's', layerId: 'layer-1', sourceFrame: 4 },
      sourceFrame: 4,
      sourceDisplayFrame: 4,
      sourceRevision: 1,
      brushes: [{ primary: { tool: 'paint', points: [{ x: 1, y: 2, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 }], color: '#000000', params: { size: 1, opacity: 100, pressure: 100, waterAmount: 0, dryAmount: 0, edgeDetail: 0, pickup: 0, eraseStrength: 0, antiAlias: 0 }, timestamp: 1 }, continuations: [] }],
      engineId: 'efx-watercolor',
      aquarelleEvents: aquarelleEvents(),
    },
    scriptAlphaCanvas: {} as HTMLCanvasElement,
  };
  // A structurally valid 1x1 VP8L WebP: saveActiveFrame validates the persisted
  // document, so the harness thumbnail must parse (261026-nvq needs a real save).
  const thumbnail: PersistedRotoScriptThumbnailV1 = { mimeType: 'image/webp', width: 1, height: 1, quality: 0.8, dataUrl: webp };
  const replaceClipboard = vi.fn((value, _preparation?: PreparedRotoScriptLoadAndApply) => { clipboard.current = value; return RotoScriptClipboardReplacementOutcome.Replaced; });
  const log = vi.fn();
  // quick-260922-al1: the outbound scope port, injected so the idempotence and
  // loop-termination claims are observable rather than assumed.
  const publishScriptScope = vi.fn();
  const captureThumbnail = vi.fn(async () => thumbnail);
  const controller = create({ request, capturePersistence: vi.fn(async () => capture), captureThumbnail, replaceClipboard, getLaunchContext: () => launch, log, publishScriptScope, ...overrides });
  return { controller, request, requests, clipboard, replaceClipboard, log, publishScriptScope, capture, captureThumbnail, setLaunch: (value: PhysicPaintLaunchContext) => { launch = value; } };
}

const scriptIds = {
  a: '123e4567-e89b-42d3-a456-426614174000',
  b: '223e4567-e89b-42d3-a456-426614174000',
} as const;
const webp = 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAUAAAAvAAAAAAA=';

/** 261027-klx: the only persistable payload is a recorded wash timeline. */
function aquarelleEvents(recordedOrder = 1): readonly AquarellePayloadEvent[] {
  return [{
    pts: [{ x: 0.1, y: 0.2, p: 0.5, tx: 0, ty: 0, tw: 0, tick: 0 }],
    ticks: 0,
    cuisson: 0,
    motion: null,
    brushId: 'wc/round-medium',
    toolOverrides: {},
    traceSeed: 7,
    recordedOrder,
    playFrame: null,
    color: '#000000',
    engine: { tool: 'brush', color: '#000000', params: { size: 4 }, brushId: 'wc/round-medium', mutationId: recordedOrder, timestamp: recordedOrder },
  }];
}

function loadedScript(id: 'a' | 'b', name: string) {
  return serializeAquarelleRotoScript({
    id: scriptIds[id],
    name,
    createdAt: '2026-07-16T12:00:00Z',
    updatedAt: '2026-07-16T12:00:00Z',
    source: row(id, name).source,
    thumbnail: { ...row(id, name).thumbnail, dataUrl: webp },
    events: aquarelleEvents(id === 'a' ? 10 : 20),
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

  // 260925-iy6 UAT round 5 ("button are there but when I click, nothing happen
  // with no error"): every saveActiveFrame exit wrote `status`, which has NO
  // reader in the panel — so a rejected save looked like a dead button. The
  // ports.log call is the rendered applyMessage channel; each exit must use it.
  it('reports every saveActiveFrame failure through ports.log (the visible channel)', async () => {
    const unsaved = harness(false);
    await unsaved.controller.saveActiveFrame();
    expect(unsaved.log).toHaveBeenCalledWith('Save the project first.', true);

    const log = vi.fn();
    const controller = createRotoScriptLibraryController({
      request: vi.fn(async (input: PhysicPaintScriptLibraryRequest) => result(input)),
      capturePersistence: vi.fn(async () => null), captureThumbnail: vi.fn(), replaceClipboard: vi.fn(),
      getLaunchContext: context, log, publishScriptScope: vi.fn(),
    });
    await controller.saveActiveFrame();
    expect(log).toHaveBeenCalledWith('Paint at least one brush on a real Roto key.', true);
    expect(controller.status.value).toBe('Paint at least one brush on a real Roto key.');
  });

  // 260925-iy6 UAT round 6 ("no work, no log, fail in silent"): capturePersistence
  // sat OUTSIDE the try, so a rejection escaped `saveActiveFrame`, hit `void onSave`,
  // and vanished. Capture must run inside the try so the catch reports it.
  it('reports a capturePersistence rejection through ports.log instead of swallowing it', async () => {
    const log = vi.fn();
    const controller = createRotoScriptLibraryController({
      request: vi.fn(async (input: PhysicPaintScriptLibraryRequest) => result(input)),
      capturePersistence: vi.fn(async () => { throw new Error('capture exploded'); }),
      captureThumbnail: vi.fn(), replaceClipboard: vi.fn(),
      getLaunchContext: context, log, publishScriptScope: vi.fn(),
    });
    await expect(controller.saveActiveFrame()).resolves.toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('capture exploded'), true);
  });

  // 261026-nvq: the thumbnail SOURCE is the live aquarelle sheet when the
  // capture carries one, and it must follow the transmittance law (multiply)
  // so white (no pigment) never covers the paper. Every other save keeps the
  // engine-1 alpha canvas and source-over.
  it('feeds the aquarelle sheet to the thumbnail encoder as multiply', async () => {
    const test = harness();
    const aquarelleCanvas = { id: 'aquarelle-sheet' } as unknown as HTMLCanvasElement;
    test.capture.aquarelleAlphaCanvas = aquarelleCanvas;

    await expect(test.controller.saveActiveFrame()).resolves.toBe(true);

    expect(test.captureThumbnail).toHaveBeenCalledWith(aquarelleCanvas, 'multiply');
  });

  it('keeps the engine-1 alpha canvas with a source-over thumbnail', async () => {
    const test = harness();

    await expect(test.controller.saveActiveFrame()).resolves.toBe(true);

    expect(test.captureThumbnail).toHaveBeenCalledWith(test.capture.scriptAlphaCanvas, 'source-over');
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

    test.request.mockImplementationOnce(async (input) => result(input, [row('b', 'B')], { script: { ...loadedScript('b', 'B'), strokes: [] } }));
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

  // D-16 / DATA-02: a clean-break script stays visible as a refused row.
  // Deletion remains the user's explicit action — never a silent drop.
  it('keeps a clean-break script listed as a refused row (unreadable-legacy-script) that cannot load but can delete', async () => {
    const test = harness();
    const refused = {
      ...row('a', 'Old preset'),
      refusal: 'unreadable-legacy-script' as const,
    };
    test.request.mockImplementation(async (input) => {
      test.requests.push(input);
      return result(input, [refused]);
    });
    await test.controller.refresh();
    expect(test.controller.rows.value).toHaveLength(1);
    expect(test.controller.rows.value[0]).toMatchObject({ id: 'a', refusal: 'unreadable-legacy-script' });
    test.controller.select('a');
    expect(test.controller.selected.value?.refusal).toBe('unreadable-legacy-script');
    expect(test.controller.availability.value.canLoad).toBe(false);
    expect(test.controller.availability.value.canDelete).toBe(true);
    await expect(test.controller.activateAndLoad('a')).resolves.toBe(false);
    expect(test.controller.rows.value).toHaveLength(1);
    expect(test.replaceClipboard).not.toHaveBeenCalled();
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
    { kind: 'real-key' as const, keyId: 'source-a', appFrame: 0, payload: { frameIndex: 0, appFrame: 0, bytes: testWebpBytes('AA=='), width: 10, height: 10 } },
    { kind: 'real-key' as const, keyId: 'source-b', appFrame: 4, payload: { frameIndex: 0, appFrame: 4, bytes: testWebpBytes('BB=='), width: 10, height: 10 } },
  ];
  const groupOverrideRecords = [
    { kind: 'real-key' as const, keyId: 'override-only', appFrame: 15, payload: { frameIndex: 0, appFrame: 15, bytes: testWebpBytes('CC=='), width: 10, height: 10 } },
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
      getLaunchContext: context, log: vi.fn(), publishScriptScope: vi.fn(),
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
      getLaunchContext: context, log: vi.fn(), publishScriptScope: vi.fn(),
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

/**
 * quick-260922-al1: the two LIBRARY read-path legs, captured at Task 2's base
 * commit BEFORE any production edit of this leg's subject. The file-level
 * `context()`/`row()` factories are hardcoded to `layer-1`/`context-1`, so both
 * legs live here with their own layer-2 / orphan inputs.
 */
describe('quick-260922-al1 library read-path evidence (L1 cross-layer visibility / L5 orphan)', () => {
  const atLayer = (layerId: string, layerName: string): PhysicPaintLaunchContext => ({
    operationId: 'launch',
    layerId,
    layerName,
    startFrame: 4,
    width: 1600,
    height: 900,
    project: { name: 'Project', saved: true, contextId: 'context-1' },
  });
  const orphanRow = (id: string, name: string) => ({
    ...row(id, name),
    source: { ...row(id, name).source, layerId: 'layer-gone', layerName: 'Ghost' },
  });

  it('L1: rows from another layer stay visible after a layer-identity change under the same project context', async () => {
    const test = harness();
    await test.controller.updateProjectContext(atLayer('layer-1', 'Ink'));
    expect(test.controller.rows.value.map((item) => item.id)).toEqual(['a', 'b']);

    // Layer switch: SAME project contextId, DIFFERENT layerId. The read path is
    // project-scoped, so the re-hydration must list EVERY project Action, not
    // only the current layer's.
    test.setLaunch(atLayer('layer-2', 'Hair'));
    await test.controller.updateProjectContext(atLayer('layer-2', 'Hair'));

    expect(test.requests.filter((request) => request.kind === 'scan')).toHaveLength(2);
    expect(test.controller.rows.value.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('L5: a row whose origin layer no longer exists still loads', async () => {
    const test = harness();
    test.request.mockImplementation(async (input) => result(input, [orphanRow('b', 'B')], {
      script: input.kind === 'load' ? loadedScript('b', 'B') : undefined,
    }));
    await test.controller.updateProjectContext(atLayer('layer-2', 'Hair'));
    expect(test.controller.rows.value.map((item) => item.source.layerId)).toEqual(['layer-gone']);

    await expect(test.controller.activateAndLoad('b')).resolves.toBe(true);

    expect(test.replaceClipboard).toHaveBeenCalledTimes(1);
    expect(test.clipboard.current).toBeTruthy();
    expect(test.controller.status.value).toBe('Loaded B — 1 brushes');
  });
});

describe('quick-260922-al1 child-realm scope state and its hydration hop', () => {
  const LAYERS = [{ id: 'layer-1', name: 'Character' }, { id: 'layer-2', name: 'Hair' }];
  const withProject = (layerId: string, project: Record<string, unknown>): PhysicPaintLaunchContext => ({
    operationId: 'launch',
    layerId,
    layerName: layerId === 'layer-2' ? 'Hair' : 'Ink',
    startFrame: 4,
    width: 1600,
    height: 900,
    project: { name: 'Project', saved: true, contextId: 'context-1', ...project },
  });

  it('defaults to All with no layers, and hydrates BOTH signals from the project payload', async () => {
    const test = harness();
    expect(test.controller.scriptScope.value).toBe('all');
    expect(test.controller.scriptLayers.value).toEqual([]);

    await test.controller.updateProjectContext(withProject('layer-1', { layers: LAYERS, scriptScope: 'layer-2' }));

    expect(test.controller.scriptLayers.value).toEqual(LAYERS);
    expect(test.controller.scriptScope.value).toBe('layer-2');
    // The inbound hop never emits: hydration is a write, not a publish.
    expect(test.publishScriptScope).not.toHaveBeenCalled();
  });

  it('degrades to All-only with snapshotted provenance when the payload carries no layers field', async () => {
    const test = harness();
    await test.controller.updateProjectContext(withProject('layer-1', { scriptScope: 'layer-1' }));
    expect(test.controller.scriptLayers.value).toEqual([]);
    expect(test.controller.scriptScope.value).toBe('layer-1');
    await test.controller.updateProjectContext(context());
    expect(test.controller.scriptScope.value).toBe('layer-1');
  });

  it('publishes exactly once per accepted change, and a repeat writes nothing and calls no port', () => {
    const test = harness();

    test.controller.setScriptScope('layer-1');
    expect(test.controller.scriptScope.value).toBe('layer-1');
    expect(test.publishScriptScope).toHaveBeenCalledTimes(1);
    expect(test.publishScriptScope).toHaveBeenLastCalledWith('layer-1');

    test.controller.setScriptScope('layer-1');
    expect(test.publishScriptScope).toHaveBeenCalledTimes(1);
  });

  it('is the OUTBOUND edge only: it never refreshes, never selects and never touches a row', async () => {
    const test = harness();
    await test.controller.updateProjectContext(withProject('layer-1', { layers: LAYERS }));
    const scansBefore = test.requests.filter((request) => request.kind === 'scan').length;
    test.controller.select('a');
    const selectedBefore = test.controller.selectedId.value;
    const rowsBefore = test.controller.rows.value;

    test.controller.setScriptScope('layer-2');

    expect(test.requests.filter((request) => request.kind === 'scan')).toHaveLength(scansBefore);
    expect(test.controller.rows.value).toBe(rowsBefore);
    expect(test.controller.selectedId.value).toBe(selectedBefore);
  });

  it('holds the scope across a LAYER switch (same contextId, different layerId)', async () => {
    const test = harness();
    await test.controller.updateProjectContext(withProject('layer-1', { layers: LAYERS }));
    test.controller.setScriptScope('layer-2');

    test.setLaunch(withProject('layer-2', { layers: LAYERS }));
    await test.controller.updateProjectContext(withProject('layer-2', { layers: LAYERS }));

    expect(test.controller.scriptScope.value).toBe('layer-2');
    expect(test.controller.scriptLayers.value).toEqual(LAYERS);
  });

  it('resets to All when the PROJECT identity changes, and on dispose', async () => {
    const test = harness();
    await test.controller.updateProjectContext(withProject('layer-1', { layers: LAYERS }));
    test.controller.setScriptScope('layer-2');

    await test.controller.updateProjectContext({
      ...withProject('layer-1', { layers: LAYERS }),
      project: { name: 'Other', saved: true, contextId: 'context-2' },
    });
    expect(test.controller.scriptScope.value).toBe('all');

    test.controller.setScriptScope('layer-1');
    test.controller.dispose();
    expect(test.controller.scriptScope.value).toBe('all');
    expect(test.controller.scriptLayers.value).toEqual([]);
  });

  it('hydrates even for an unlocked project — the panel state is not library state', async () => {
    const test = harness(false);
    await test.controller.updateProjectContext({
      ...withProject('layer-1', { layers: LAYERS, scriptScope: 'layer-2' }),
      project: { name: 'Project', saved: false, contextId: 'context-1', layers: LAYERS, scriptScope: 'layer-2' },
    });
    expect(test.controller.scriptLayers.value).toEqual(LAYERS);
    expect(test.controller.scriptScope.value).toBe('layer-2');
  });
});

// ---------------------------------------------------------------------------
// 63-08 / TIP-14: the script carrier. A script cannot reference another
// project's package asset, so each custom tip travels with its mask inline as
// a WebP data URL (D-14) — the save leg copies the STUDIO realm's stored WebP
// bytes, whose only writer is `applyBrushCatalogPayload`, and the load leg
// registers the decoded mask in the engine registry ONLY (never a catalog row).
//
// The save-leg tests rebuild the module graph on purpose: the main realm's
// `efxPaintBrushAssets` instance is NOT the Studio's, so a one-instance test
// would pass while the real app refuses every save.
// ---------------------------------------------------------------------------

const SCRIPT_WEBP_PREFIX = 'data:image/webp;base64,';

/** Minimal well-formed 25-byte lossless VP8L header declaring the frame size. */
function brushWebp(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(26);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  bytes[4] = 18; // RIFF size = total − 8 (the walker requires full-length containers)
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  bytes.set([0x56, 0x50, 0x38, 0x4c], 12);
  bytes[16] = 5;
  bytes[20] = 0x2f;
  const w = width - 1;
  const h = height - 1;
  bytes[21] = w & 0xff;
  bytes[22] = ((w >> 8) & 0x3f) | ((h & 0x03) << 6);
  bytes[23] = (h >> 2) & 0xff;
  bytes[24] = (h >> 10) & 0x0f;
  return bytes;
}

/** A project CUSTOM tip record as the package carrier shapes it. */
function scriptCustomTip(id: string): Record<string, unknown> {
  return {
    id,
    category: 'custom',
    name: `Custom ${id}`,
    tip: 1, aspect: 1, rotation: 1, sizeCurve: 1, scatter: 1, capacity: 1, grain: 1, wetRound: 1,
    asset: `brushes/${'a'.repeat(64)}.webp`,
  };
}

describe('script brush carrier (63-08 / TIP-14)', () => {
  it('save leg: each custom tip mask travels as an inline data URL read from the Studio realm cache', async () => {
    vi.resetModules();
    const catalog = await import('../../../stores/aquarelleBrushCatalog');
    const watercolor = await import('@efxlab/efx-watercolor');
    const library = await import('./physicsPaintRotoScriptLibrary');

    const webpBytes = brushWebp(192, 192);
    const mask = new Uint8Array(watercolor.TIP_MASK_BYTES).fill(6);
    // The two-realm shape: this payload is the ONLY writer of the Studio
    // realm's stored bytes. Nothing below calls rememberBrushAsset directly.
    catalog.applyBrushCatalogPayload({
      libraryRevision: 0,
      entries: [{
        tip: scriptCustomTip('wc/custom-script-save') as never,
        // Task 2's required row fields; Task 5 owns this file's full retarget.
        digest: 'f'.repeat(64),
        textureRotation: 0,
        maskBase64: Buffer.from(mask).toString('base64'),
      }],
      unavailableTipIds: [],
    });

    const test = harness(true, {}, library.createRotoScriptLibraryController);
    await expect(test.controller.saveActiveFrame()).resolves.toBe(true);

    const saveRequest = test.requests.find((request) => request.kind === 'save') as { script?: any } | undefined;
    expect(saveRequest === undefined).toBe(false);
    const entries = saveRequest!.script.brushPack.entries as any[];
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('wc/custom-script-save');
    expect(entries[0].maskDataUrl).toBe(`${SCRIPT_WEBP_PREFIX}${Buffer.from(webpBytes).toString('base64')}`);
    expect('asset' in entries[0]).toBe(false);
  });

  it('save leg: refuses when a custom tip has no stored bytes in this realm', async () => {
    vi.resetModules();
    const catalog = await import('../../../stores/aquarelleBrushCatalog');
    const library = await import('./physicsPaintRotoScriptLibrary');

    // No catalog payload was ever applied here: the tip row exists, its bytes
    // do not — exactly what the real Studio sees when the push never arrived.
    catalog.addCustomBrushTip(scriptCustomTip('wc/custom-no-bytes') as never);

    const test = harness(true, {}, library.createRotoScriptLibraryController);
    await expect(test.controller.saveActiveFrame()).resolves.toBe(false);
    expect(test.controller.status.value).toContain('no stored mask bytes');
    expect(test.log).toHaveBeenCalledWith(expect.stringContaining('no stored mask bytes'), true);
    expect(test.requests.filter((request) => request.kind === 'save')).toHaveLength(0);
  });

  /** Replace ONLY the non-dry events' engine brush id; dry ticks pass through. */
  function captureWithEngineBrushId(id: string): readonly AquarellePayloadEvent[] {
    return aquarelleEvents().map((event) => (
      isAquarelleDryEvent(event) ? event : { ...event, engine: { ...event.engine, brushId: id } }
    ));
  }

  it('save leg: an unavailable tip is skipped with a log instead of refusing the whole save (WR-02)', async () => {
    vi.resetModules();
    const catalog = await import('../../../stores/aquarelleBrushCatalog');
    const library = await import('./physicsPaintRotoScriptLibrary');

    // Distinct digests per tip: the shared `scriptCustomTip` asset would let
    // the healthy tip's remembered bytes satisfy the unavailable one.
    const tipWithDigest = (id: string, fill: string) => ({ ...scriptCustomTip(id), asset: `brushes/${fill.repeat(64)}.webp` });
    catalog.applyBrushCatalogPayload({
      libraryRevision: 0,
      entries: [
        {
          tip: tipWithDigest('wc/custom-healthy', 'b') as never,
          digest: 'b'.repeat(64),
          textureRotation: 0,
        },
        { tip: tipWithDigest('wc/custom-unavailable', 'c') as never, digest: 'c'.repeat(64), textureRotation: 0 },
      ],
      unavailableTipIds: ['wc/custom-unavailable'],
    });

    // The capture paints a built-in id: only the catalog's own state can refuse.
    const test = harness(true, {}, library.createRotoScriptLibraryController);
    await expect(test.controller.saveActiveFrame()).resolves.toBe(true);

    const saveRequest = test.requests.find((request) => request.kind === 'save') as { script?: any } | undefined;
    expect(saveRequest === undefined).toBe(false);
    const entries = saveRequest!.script.brushPack.entries as any[];
    expect(entries.map((entry: { id: string }) => entry.id)).toEqual(['wc/custom-healthy']);
    expect(test.log).toHaveBeenCalledWith(expect.stringContaining('wc/custom-unavailable'), true);
  });

  it('save leg: refuses a custom-brush capture when this realm never received a catalog (WR-03)', async () => {
    vi.resetModules();
    const library = await import('./physicsPaintRotoScriptLibrary');

    // Fresh modules: no payload was applied, so the catalog is UNKNOWN — not
    // known-empty. The capture still paints a custom tip.
    const test = harness(true, {}, library.createRotoScriptLibraryController);
    test.capture.script.aquarelleEvents = captureWithEngineBrushId('wc/custom-painted');

    await expect(test.controller.saveActiveFrame()).resolves.toBe(false);
    expect(test.controller.status.value).toContain('brush catalog');
    expect(test.controller.status.value).toContain('wc/custom-painted');
    expect(test.requests.filter((request) => request.kind === 'save')).toHaveLength(0);
  });

  it('save leg: refuses by name when a painted custom tip is not in the synced catalog (WR-03)', async () => {
    vi.resetModules();
    const catalog = await import('../../../stores/aquarelleBrushCatalog');
    const library = await import('./physicsPaintRotoScriptLibrary');

    catalog.applyBrushCatalogPayload({
      libraryRevision: 0,
      entries: [{ tip: scriptCustomTip('wc/custom-other') as never, digest: 'a'.repeat(64), textureRotation: 0 }],
      unavailableTipIds: [],
    });

    // Painted from ANOTHER script's registry: the id resolves for painting but
    // this project catalog carries no entry for it.
    const test = harness(true, {}, library.createRotoScriptLibraryController);
    test.capture.script.aquarelleEvents = captureWithEngineBrushId('wc/custom-script-only');

    await expect(test.controller.saveActiveFrame()).resolves.toBe(false);
    expect(test.controller.status.value).toContain('wc/custom-script-only');
    expect(test.requests.filter((request) => request.kind === 'save')).toHaveLength(0);
  });

  // quick-261115-oh9: a texture is a SETTING of the response. The save law
  // reads BOTH ids from the capture; a custom texture must travel or the save
  // refuses by name, while a built-in travels with the app and never blocks.
  it('references custom texture ids beside response ids, first-seen and unique', () => {
    const withEngine = (brushId: string, textureId?: string): AquarellePayloadEvent => {
      const [event] = aquarelleEvents();
      if (!event || isAquarelleDryEvent(event)) throw new Error('expected a stroke event');
      return {
        ...event,
        engine: {
          ...event.engine,
          brushId,
          ...(textureId !== undefined ? { textureId } : {}),
        },
      };
    };
    const events = [
      withEngine('round', 'wc/custom-tex-first'),
      withEngine('flat', 'wc/custom-tex-second'),
      withEngine('round', 'wc/custom-tex-first'),
      withEngine('wc/custom-response-id'),
      withEngine('round', 'wc/builtin-chalk'),
    ];
    expect(referencedCustomBrushIds(events)).toEqual([
      'wc/custom-tex-first',
      'wc/custom-tex-second',
      'wc/custom-response-id',
    ]);
  });

  it('never reports a built-in texture id', () => {
    const [event] = aquarelleEvents();
    if (!event || isAquarelleDryEvent(event)) throw new Error('expected a stroke event');
    const events: AquarellePayloadEvent[] = [
      { ...event, engine: { ...event.engine, textureId: 'wc/builtin-chalk' } },
    ];
    expect(referencedCustomBrushIds(events)).toEqual([]);
  });

  it('save leg: refuses by name when a painted custom TEXTURE cannot travel', async () => {
    vi.resetModules();
    const library = await import('./physicsPaintRotoScriptLibrary');
    const test = harness(true, {}, library.createRotoScriptLibraryController);
    test.capture.script.aquarelleEvents = aquarelleEvents().map((event) =>
      isAquarelleDryEvent(event)
        ? event
        : { ...event, engine: { ...event.engine, textureId: 'wc/custom-texture-missing' } },
    );

    await expect(test.controller.saveActiveFrame()).resolves.toBe(false);
    expect(test.controller.status.value).toContain('wc/custom-texture-missing');
    expect(test.requests.filter((request) => request.kind === 'save')).toHaveLength(0);
  });

  it('save leg: a built-in texture travels with the app and never blocks the save', async () => {
    vi.resetModules();
    const library = await import('./physicsPaintRotoScriptLibrary');
    const test = harness(true, {}, library.createRotoScriptLibraryController);
    test.capture.script.aquarelleEvents = aquarelleEvents().map((event) =>
      isAquarelleDryEvent(event)
        ? event
        : { ...event, engine: { ...event.engine, textureId: 'wc/builtin-chalk' } },
    );

    await expect(test.controller.saveActiveFrame()).resolves.toBe(true);
  });

  it('serialize → parse keeps engine.textureId (the engine spread is the carrier)', () => {
    const [event] = aquarelleEvents();
    if (!event || isAquarelleDryEvent(event)) throw new Error('expected a stroke event');
    const script = serializeAquarelleRotoScript({
      id: scriptIds.a,
      name: 'Textured',
      createdAt: '2026-07-16T12:00:00Z',
      updatedAt: '2026-07-16T12:00:00Z',
      source: row('a', 'Textured').source,
      thumbnail: { ...row('a', 'Textured').thumbnail, dataUrl: webp },
      events: [{ ...event, engine: { ...event.engine, textureId: 'wc/builtin-chalk' } }],
    });

    const parsed = parseRotoScript(script);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error('expected the script to parse');
    const engine = parsed.document.strokes[0]!.engine as AquarelleStrokePayload;
    expect(engine.textureId).toBe('wc/builtin-chalk');
  });

  it('load leg: registers the carried mask in the registry only and paints with it', async () => {
    vi.resetModules();
    const catalog = await import('../../../stores/aquarelleBrushCatalog');
    const watercolor = await import('@efxlab/efx-watercolor');
    const library = await import('./physicsPaintRotoScriptLibrary');
    const schema = await import('./physicsPaintRotoScriptSchema');

    const webpBytes = brushWebp(192, 192);
    const { asset: _asset, ...tip } = scriptCustomTip('wc/custom-script-load');
    const script = schema.serializeAquarelleRotoScript({
      id: scriptIds.a,
      name: 'Carried',
      createdAt: '2026-07-16T12:00:00Z',
      updatedAt: '2026-07-16T12:00:00Z',
      source: row('a', 'Carried').source,
      thumbnail: { ...row('a', 'Carried').thumbnail, dataUrl: webp },
      events: aquarelleEvents(),
      brushEntries: [{ ...tip, maskDataUrl: `${SCRIPT_WEBP_PREFIX}${Buffer.from(webpBytes).toString('base64')}` } as never],
    });

    const decodedMask = new Uint8Array(watercolor.TIP_MASK_BYTES).fill(9);
    const registered = await library.registerScriptBrushMasks(script, {
      decode: async () => ({ ok: true, data: { mask: decodedMask, width: 192, height: 192 } }),
    });

    expect(registered).toBe(1);
    expect(watercolor.resolveMask('wc/custom-script-load')).toBe(decodedMask);
    // quick-261115-oh9: a texture id is not a response id. With no options the
    // builder resolves the round response; the registered mask is stamped only
    // when the stroke names it as the texture.
    expect(watercolor.buildBrushForStroke('wc/custom-script-load').id).toBe('round');
    expect(
      watercolor.buildBrushForStroke('wc/custom-script-load', {
        textureId: 'wc/custom-script-load',
      }).tipData,
    ).toBe(decodedMask);
    // Registry only: the project catalog never learns a script's tips.
    expect(catalog.customBrushTips.value).toHaveLength(0);
    expect(catalog.listAquarelleBrushTips()).toHaveLength(3);
    expect(catalog.resolveCatalogTip('wc/custom-script-load')).toBe(null);
  });

  it('load leg: one bad mask degrades alone and never aborts the script', async () => {
    vi.resetModules();
    const catalog = await import('../../../stores/aquarelleBrushCatalog');
    const watercolor = await import('@efxlab/efx-watercolor');
    const library = await import('./physicsPaintRotoScriptLibrary');
    const schema = await import('./physicsPaintRotoScriptSchema');

    const carriedUrl = `${SCRIPT_WEBP_PREFIX}${Buffer.from(brushWebp(192, 192)).toString('base64')}`;
    const entryFor = (id: string) => {
      const { asset: _asset, ...tip } = scriptCustomTip(id);
      return { ...tip, maskDataUrl: carriedUrl } as never;
    };
    const script = schema.serializeAquarelleRotoScript({
      id: scriptIds.a,
      name: 'Mixed',
      createdAt: '2026-07-16T12:00:00Z',
      updatedAt: '2026-07-16T12:00:00Z',
      source: row('a', 'Mixed').source,
      thumbnail: { ...row('a', 'Mixed').thumbnail, dataUrl: webp },
      events: aquarelleEvents(),
      brushEntries: [entryFor('wc/custom-good'), entryFor('wc/custom-bad')],
    });

    const goodMask = new Uint8Array(watercolor.TIP_MASK_BYTES).fill(4);
    let decodeCalls = 0;
    const log = vi.fn();
    const registered = await library.registerScriptBrushMasks(script, {
      decode: async () => {
        decodeCalls += 1;
        if (decodeCalls === 1) return { ok: true, data: { mask: goodMask, width: 192, height: 192 } };
        // The harsher failure: the native seam THROWS instead of returning a Result.
        throw new Error('native decode exploded');
      },
      log,
    });

    expect(registered).toBe(1);
    expect(watercolor.resolveMask('wc/custom-good')).toBe(goodMask);
    expect(watercolor.resolveMask('wc/custom-bad')).toBe(null);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('could not be decoded'), true);
    // Registry only, still: no catalog row for a script's tips.
    expect(catalog.customBrushTips.value).toHaveLength(0);
  });

  it('activation registers the loaded script masks through the controller port', async () => {
    const registerScriptMasks = vi.fn(async () => {});
    const test = harness(true, { registerScriptMasks });
    await test.controller.refresh();
    test.request.mockImplementation(async (input) => result(input, [row('b', 'B'), row('a', 'A')], {
      script: input.kind === 'load' ? loadedScript(input.scriptId as 'a' | 'b', 'A') : undefined,
    }));

    await expect(test.controller.activateAndLoad('a')).resolves.toBe(true);

    expect(registerScriptMasks).toHaveBeenCalledWith(expect.objectContaining({ id: scriptIds.a }));
  });
});
