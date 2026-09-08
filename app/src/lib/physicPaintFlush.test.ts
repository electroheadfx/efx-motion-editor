import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const eventApi = vi.hoisted(() => ({
  listen: vi.fn(),
  emitTo: vi.fn(),
}));
vi.mock('@tauri-apps/api/event', () => eventApi);

import {
  installPhysicPaintFlushRequestListener,
  PHYSIC_PAINT_FLUSH_REQUEST_EVENT,
  PHYSIC_PAINT_FLUSH_RESULT_EVENT,
  requestPhysicPaintFlush,
} from './physicPaintFlush';

function setTauriRuntime(enabled: boolean): void {
  if (enabled) {
    (globalThis as Record<string, unknown>).window = { __TAURI_INTERNALS__: {} };
  } else {
    delete (globalThis as Record<string, unknown>).window;
  }
}

describe('physicPaintFlush', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventApi.listen.mockResolvedValue(() => {});
    eventApi.emitTo.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window;
  });

  it('returns false when not running under Tauri', async () => {
    setTauriRuntime(false);
    await expect(requestPhysicPaintFlush()).resolves.toBe(false);
    expect(eventApi.emitTo).not.toHaveBeenCalled();
  });

  it('emits the flush request and resolves true on the flushed result', async () => {
    setTauriRuntime(true);
    let resultListener: ((event: { payload: unknown }) => void) | undefined;
    eventApi.listen.mockImplementation(async (_event: string, listener: (event: { payload: unknown }) => void) => {
      resultListener = listener;
      return () => {};
    });

    const flushPromise = requestPhysicPaintFlush();
    await vi.waitFor(() => expect(eventApi.emitTo).toHaveBeenCalled());
    const [label, event, payload] = eventApi.emitTo.mock.calls[0];
    expect(label).toBe('efx-physic-paint');
    expect(event).toBe(PHYSIC_PAINT_FLUSH_REQUEST_EVENT);
    const operationId = (payload as { operationId: string }).operationId;

    resultListener!({ payload: { operationId, status: 'flushed' } });
    await expect(flushPromise).resolves.toBe(true);
  });

  it('installs a listener that flushes and emits the flushed result', async () => {
    setTauriRuntime(true);
    let requestListener: ((event: { payload: unknown }) => void) | undefined;
    eventApi.listen.mockImplementation(async (_event: string, listener: (event: { payload: unknown }) => void) => {
      requestListener = listener;
      return () => {};
    });

    const flush = vi.fn(async () => {});
    await installPhysicPaintFlushRequestListener(flush);
    expect(eventApi.listen).toHaveBeenCalledWith(PHYSIC_PAINT_FLUSH_REQUEST_EVENT, expect.any(Function));

    await requestListener!({ payload: { operationId: 'op-1' } });
    expect(flush).toHaveBeenCalledOnce();
    expect(eventApi.emitTo).toHaveBeenCalledWith('main', PHYSIC_PAINT_FLUSH_RESULT_EVENT, { operationId: 'op-1', status: 'flushed' });
  });

  it('emits unavailable when the flush throws', async () => {
    setTauriRuntime(true);
    let requestListener: ((event: { payload: unknown }) => void) | undefined;
    eventApi.listen.mockImplementation(async (_event: string, listener: (event: { payload: unknown }) => void) => {
      requestListener = listener;
      return () => {};
    });

    await installPhysicPaintFlushRequestListener(async () => { throw new Error('flush failed'); });
    await requestListener!({ payload: { operationId: 'op-2' } });
    expect(eventApi.emitTo).toHaveBeenCalledWith('main', PHYSIC_PAINT_FLUSH_RESULT_EVENT, { operationId: 'op-2', status: 'unavailable' });
  });
});
