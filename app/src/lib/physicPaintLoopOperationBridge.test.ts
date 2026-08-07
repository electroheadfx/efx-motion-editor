import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {defaultTransform, type Layer} from '../types/layer';

const originalWindow = globalThis.window;

function physicLayer(): Layer {
  return {
    id: 'paint-1',
    name: 'Physics Paint',
    type: 'physic-paint',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: defaultTransform(),
    source: {type: 'physic-paint', layerId: 'paint-1'},
  };
}

describe('requestPhysicPaintLoopOperation parent correlation (43-08)', () => {
  let messageListener: ((event: MessageEvent) => void) | undefined;
  let child: {closed: boolean; focus: ReturnType<typeof vi.fn>; postMessage: ReturnType<typeof vi.fn>};

  beforeEach(() => {
    vi.resetModules();
    messageListener = undefined;
    child = {closed: false, focus: vi.fn(), postMessage: vi.fn()};
    Object.defineProperty(globalThis, 'window', {
      value: {
        open: vi.fn(() => child),
        addEventListener: vi.fn((type: string, listener: (event: MessageEvent) => void) => {
          if (type === 'message') messageListener = listener;
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        location: {origin: 'http://localhost:1420'},
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.doUnmock('@tauri-apps/api/core');
    vi.doUnmock('@tauri-apps/api/event');
    vi.doUnmock('@tauri-apps/api/window');
    vi.resetModules();
    Object.defineProperty(globalThis, 'window', {value: originalWindow, writable: true, configurable: true});
  });

  it('installs the listener before send and resolves only the fully correlated result', async () => {
    const {requestPhysicPaintLoopOperation, PHYSIC_PAINT_LOOP_OPERATION_RESULT_EVENT} = await import('./physicPaintBridge');
    child.postMessage.mockImplementation((message: {payload: Record<string, unknown>}) => {
      const request = message.payload;
      messageListener?.({
        origin: window.location.origin,
        data: {type: PHYSIC_PAINT_LOOP_OPERATION_RESULT_EVENT, payload: {...request, layerId: 'stale-layer', ok: true, reason: null}},
      } as MessageEvent);
      messageListener?.({
        origin: window.location.origin,
        data: {type: PHYSIC_PAINT_LOOP_OPERATION_RESULT_EVENT, payload: {...request, ok: true, reason: null}},
      } as MessageEvent);
    });

    const result = await requestPhysicPaintLoopOperation({
      layer: physicLayer(), frame: 4, loopId: 'loop-7', kind: 'unlink-loop',
    }, {timeoutMs: 200, retryIntervalMs: 20});

    expect(window.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    expect(child.postMessage).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ok: true, reason: null});
    expect(window.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('retries with one operationId and fails closed on timeout', async () => {
    vi.useFakeTimers();
    const {requestPhysicPaintLoopOperation} = await import('./physicPaintBridge');
    const pending = requestPhysicPaintLoopOperation({
      layer: physicLayer(), frame: 4, loopId: 'loop-7', kind: 'repair-loop',
    }, {timeoutMs: 90, retryIntervalMs: 20});
    await vi.advanceTimersByTimeAsync(100);
    const result = await pending;

    expect(child.postMessage.mock.calls.length).toBeGreaterThan(1);
    const operationIds = new Set(child.postMessage.mock.calls.map(([message]) => message.payload.operationId));
    expect(operationIds.size).toBe(1);
    expect(result).toEqual({ok: false, reason: 'Physics Paint loop operation timed out.'});
  });
});
