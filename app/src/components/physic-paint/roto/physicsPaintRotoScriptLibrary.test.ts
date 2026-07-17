import { describe, expect, it, vi } from 'vitest';
import type { PhysicPaintLaunchContext, PhysicPaintScriptLibraryRequest, PhysicPaintScriptLibraryResult } from '../../../types/physicPaint';
import { createRotoScriptLibraryController } from './physicsPaintRotoScriptLibrary';
import { RotoScriptClipboardReplacementOutcome, type PreparedRotoScriptLoadAndApply, type RotoScriptPersistenceCapture } from './physicsPaintRotoScriptClipboard';
import { createPersistedRotoScript, type PersistedRotoScriptThumbnailV1 } from './physicsPaintRotoScriptSchema';

const context = (): PhysicPaintLaunchContext => ({ operationId: 'launch', layerId: 'layer-1', layerName: 'Ink', startFrame: 4, width: 1600, height: 900, project: { name: 'Project', saved: true, contextId: 'context-1' } });
const row = (id: string, name: string, createdAt = '2026-07-16T12:00:00Z') => ({ id, revision: `rev-${id}`, name, createdAt, updatedAt: createdAt, source: { projectName: 'Project', layerId: 'layer-1', layerName: 'Ink', sourceFrame: 4, displayFrame: 4, width: 1600, height: 900, background: { background: 'white' as const, paperGrain: 'canvas1', grainStrength: 0 } }, thumbnail: { mimeType: 'image/webp' as const, width: 1, height: 1, quality: 0.8, dataUrl: 'data:image/webp;base64,UklGRgQAAABXRUJQ' }, brushCount: 1 });
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
