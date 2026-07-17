import { describe, expect, it, vi } from 'vitest';
import type { PhysicPaintLaunchContext, PhysicPaintScriptLibraryRequest, PhysicPaintScriptLibraryResult } from '../../../types/physicPaint';
import { createRotoScriptLibraryController } from '../roto/physicsPaintRotoScriptLibrary';
import { RotoScriptClipboardReplacementOutcome, type PreparedRotoScriptLoadAndApply } from '../roto/physicsPaintRotoScriptClipboard';
import { createPersistedRotoScript } from '../roto/physicsPaintRotoScriptSchema';
import { createRotoScriptLibraryControllerAdapter, createRotoScriptLibraryRequestLifecycle } from './useRotoScriptLibraryController';

const launchContext = (): PhysicPaintLaunchContext => ({ operationId: 'launch', layerId: 'layer-1', layerName: 'Ink', startFrame: 4, width: 1600, height: 900, project: { name: 'Project', saved: true, contextId: 'context-1' } });
const row = { id: '123e4567-e89b-42d3-a456-426614174000', revision: 'rev-1', name: 'Script', createdAt: '2026-07-16T12:00:00Z', updatedAt: '2026-07-16T12:00:00Z', source: { projectName: 'Project', layerId: 'layer-1', layerName: 'Ink', sourceFrame: 4, displayFrame: 4, width: 1600, height: 900, background: { background: 'white' as const, paperGrain: 'canvas1', grainStrength: 0 } }, thumbnail: { mimeType: 'image/webp' as const, width: 1, height: 1, quality: 0.8, dataUrl: 'data:image/webp;base64,UklGRgQAAABXRUJQ' }, brushCount: 1 };
const script = createPersistedRotoScript({ id: row.id, name: row.name, createdAt: row.createdAt, updatedAt: row.updatedAt, source: row.source, thumbnail: { ...row.thumbnail, dataUrl: 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAUAAAAvAAAAAAA=' }, brushes: [{ primary: { tool: 'paint', points: [{ x: 10, y: 2, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 }], color: '#000000', params: { size: 1, opacity: 100, pressure: 100, waterAmount: 0, dryAmount: 0, edgeDetail: 0, pickup: 0, eraseStrength: 0, antiAlias: 0 }, timestamp: 1 }, continuations: [] }] });

function result(request: PhysicPaintScriptLibraryRequest, extra: Partial<PhysicPaintScriptLibraryResult> = {}): PhysicPaintScriptLibraryResult {
  return { operationId: request.operationId, kind: request.kind, ok: true, rows: [row], skippedInvalidCount: 0, diagnostics: [], ...extra };
}

describe('persistent Roto script library hook adapters', () => {
  it('redetects bridge mode at action time and settles timeout/send/result exactly once', async () => {
    const detectBridgeMode = vi.fn(async () => 'Browser fallback' as const);
    const sendRequest = vi.fn(async () => {});
    let timeoutCallback!: () => void;
    const clearRequestTimeout = vi.fn();
    const lifecycle = createRotoScriptLibraryRequestLifecycle({
      getBridgeMode: () => 'Unavailable', detectBridgeMode, sendRequest,
      setRequestTimeout: (callback) => { timeoutCallback = callback; return 17 as unknown as ReturnType<typeof setTimeout>; },
      clearRequestTimeout,
    });
    const request = { kind: 'scan', operationId: 'scan-1' } as const;
    const pending = lifecycle.request(request);
    await vi.waitFor(() => expect(sendRequest).toHaveBeenCalledWith(request, 'Browser fallback'));
    expect(detectBridgeMode).toHaveBeenCalledOnce();
    lifecycle.handleResult(result(request));
    await expect(pending).resolves.toMatchObject({ ok: true, operationId: 'scan-1' });
    timeoutCallback();
    expect(lifecycle.pendingCount()).toBe(0);
    expect(clearRequestTimeout).toHaveBeenCalledOnce();
  });

  it('forwards the exact preparation token through the production adapter and composes one Apply', async () => {
    let settleLoad!: (value: PhysicPaintScriptLibraryResult) => void;
    const request = vi.fn(async (input: PhysicPaintScriptLibraryRequest) => input.kind === 'scan'
      ? result(input)
      : new Promise<PhysicPaintScriptLibraryResult>((resolve) => { settleLoad = resolve; }));
    const preparation: PreparedRotoScriptLoadAndApply = { preparationId: Symbol('prepared') };
    const replaceClipboard = vi.fn((_script, received?: PreparedRotoScriptLoadAndApply) => received === preparation
      ? RotoScriptClipboardReplacementOutcome.Replaced
      : RotoScriptClipboardReplacementOutcome.Rejected);
    const applyPreparedScript = vi.fn(async (received: PreparedRotoScriptLoadAndApply) => received === preparation);
    const log = vi.fn();
    const ports = { request, capturePersistence: vi.fn(async () => null), captureThumbnail: vi.fn(), replaceClipboard, getLaunchContext: launchContext, log };
    const controller = createRotoScriptLibraryController(createRotoScriptLibraryControllerAdapter(() => ports, request));
    await controller.refresh();
    const loading = controller.activateAndLoad(row.id, preparation);
    settleLoad(result(request.mock.calls[1][0], { script }));
    await expect(loading).resolves.toBe(true);
    expect(replaceClipboard).toHaveBeenCalledWith(expect.any(Object), preparation);
    await expect(applyPreparedScript(preparation)).resolves.toBe(true);
    expect(applyPreparedScript).toHaveBeenCalledOnce();
  });

  it.each(['source', 'engine', 'launch', 'dispose'] as const)('keeps stale prepared %s completion silent and immutable', async () => {
    let settleLoad!: (value: PhysicPaintScriptLibraryResult) => void;
    const request = vi.fn(async (input: PhysicPaintScriptLibraryRequest) => input.kind === 'scan'
      ? result(input)
      : new Promise<PhysicPaintScriptLibraryResult>((resolve) => { settleLoad = resolve; }));
    const preparation: PreparedRotoScriptLoadAndApply = { preparationId: Symbol('prepared') };
    let valid = true;
    const clipboard = { current: 'prior' };
    const applyPreparedScript = vi.fn(async () => false);
    const log = vi.fn();
    const ports = { request, capturePersistence: vi.fn(async () => null), captureThumbnail: vi.fn(), replaceClipboard: vi.fn(() => valid ? RotoScriptClipboardReplacementOutcome.Replaced : RotoScriptClipboardReplacementOutcome.Stale), getLaunchContext: launchContext, log };
    const controller = createRotoScriptLibraryController(createRotoScriptLibraryControllerAdapter(() => ports, request));
    await controller.refresh();
    controller.select(row.id);
    controller.status.value = 'Prior status';
    const previousRows = controller.rows.value;
    const loading = controller.activateAndLoad(row.id, preparation);
    valid = false;
    settleLoad(result(request.mock.calls[1][0], { script }));
    await expect(loading).resolves.toBe(false);
    expect(clipboard.current).toBe('prior');
    expect(controller.rows.value).toBe(previousRows);
    expect(controller.selectedId.value).toBe(row.id);
    expect(controller.status.value).toBe('Prior status');
    expect(log).not.toHaveBeenCalled();
    expect(applyPreparedScript).not.toHaveBeenCalled();
  });

  it('settles pending requests on cleanup, clears timeout, and ignores late bridge results', async () => {
    const clearRequestTimeout = vi.fn();
    const lifecycle = createRotoScriptLibraryRequestLifecycle({
      getBridgeMode: () => 'Tauri', detectBridgeMode: vi.fn(), sendRequest: vi.fn(async () => {}),
      setRequestTimeout: () => 29 as unknown as ReturnType<typeof setTimeout>, clearRequestTimeout,
    });
    const request = { kind: 'load', operationId: 'load-1', scriptId: row.id } as const;
    const pending = lifecycle.request(request);
    lifecycle.dispose();
    await expect(pending).resolves.toMatchObject({ operationId: 'load-1', kind: 'load', ok: false, error: 'Script library request was disposed.' });
    expect(lifecycle.pendingCount()).toBe(0);
    expect(clearRequestTimeout).toHaveBeenCalledOnce();
    lifecycle.handleResult(result(request, { script }));
    expect(clearRequestTimeout).toHaveBeenCalledOnce();
  });
});
