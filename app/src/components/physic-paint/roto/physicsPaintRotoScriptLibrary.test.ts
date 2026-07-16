import { describe, expect, it, vi } from 'vitest';
import type { PhysicPaintLaunchContext, PhysicPaintScriptLibraryRequest, PhysicPaintScriptLibraryResult } from '../../../types/physicPaint';
import { createRotoScriptLibraryController } from './physicsPaintRotoScriptLibrary';
import type { RotoScriptPersistenceCapture } from './physicsPaintRotoScriptClipboard';
import type { PersistedRotoScriptThumbnailV1 } from './physicsPaintRotoScriptSchema';

const context = (): PhysicPaintLaunchContext => ({ operationId: 'launch', layerId: 'layer-1', layerName: 'Ink', startFrame: 4, width: 1600, height: 900, workflowMode: 'roto', project: { name: 'Project', saved: true, contextId: 'context-1' } });
const row = (id: string, name: string, createdAt = '2026-07-16T12:00:00Z') => ({ id, revision: `rev-${id}`, name, createdAt, updatedAt: createdAt, source: { projectName: 'Project', layerId: 'layer-1', layerName: 'Ink', sourceFrame: 4, displayFrame: 4, width: 1600, height: 900, background: { background: 'white' as const, paperGrain: 'canvas1', grainStrength: 0 } }, thumbnail: { mimeType: 'image/webp' as const, width: 1, height: 1, quality: 0.8, dataUrl: 'data:image/webp;base64,UklGRgQAAABXRUJQ' }, brushCount: 1 });
const result = (request: PhysicPaintScriptLibraryRequest, rows = [row('b', 'B'), row('a', 'A')], extra: Partial<PhysicPaintScriptLibraryResult> = {}): PhysicPaintScriptLibraryResult => ({ operationId: request.operationId, kind: request.kind, ok: true, rows, skippedInvalidCount: 0, diagnostics: [], ...extra });

function harness(saved = true) {
  let launch = saved ? context() : { ...context(), project: { name: 'Project', saved: false, contextId: 'context-1' } };
  const requests: PhysicPaintScriptLibraryRequest[] = [];
  const request = vi.fn(async (input: PhysicPaintScriptLibraryRequest) => { requests.push(input); return result(input); });
  const clipboard = { current: null as unknown };
  const capture: RotoScriptPersistenceCapture = { script: { provenance: { sessionId: 's', layerId: 'layer-1', sourceFrame: 4 }, sourceFrame: 4, sourceDisplayFrame: 4, sourceRevision: 1, brushes: [{ primary: { tool: 'paint', points: [{ x: 1, y: 2, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 }], color: '#000000', params: { size: 1, opacity: 100, pressure: 100, waterAmount: 0, dryAmount: 0, edgeDetail: 0, pickup: 0, eraseStrength: 0, antiAlias: 0 }, timestamp: 1 }, continuations: [] }] }, scriptAlphaCanvas: {} as HTMLCanvasElement };
  const thumbnail: PersistedRotoScriptThumbnailV1 = { mimeType: 'image/webp', width: 1, height: 1, quality: 0.8, dataUrl: 'data:image/webp;base64,UklGRgQAAABXRUJQ' };
  const controller = createRotoScriptLibraryController({ request, capturePersistence: vi.fn(async () => capture), captureThumbnail: vi.fn(async () => thumbnail), replaceClipboard: vi.fn((value) => { clipboard.current = value; return true; }), getLaunchContext: () => launch, log: vi.fn() });
  return { controller, request, requests, clipboard, setLaunch: (value: PhysicPaintLaunchContext) => { launch = value; } };
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
});
