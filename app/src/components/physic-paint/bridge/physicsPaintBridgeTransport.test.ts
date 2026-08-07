import { beforeEach, describe, expect, it, vi } from 'vitest';

// 43-06 Task 3 (D-01, Q3, Pitfall 5): parent→child open-loop-edit bridge
// message — typed payload + guard, Tauri emitTo / Browser-fallback postMessage
// sender idiom, the child listener routing to the controller's openLoopEdit,
// and malformed-payload rejection (T-43-06-01).

const eventApi = vi.hoisted(() => ({
  listen: vi.fn(async (_event: string, _handler: (event: { payload: unknown }) => void) => vi.fn()),
  emit: vi.fn(async () => {}),
  emitTo: vi.fn(async () => {}),
}));

vi.mock('@tauri-apps/api/event', () => eventApi);

// Cursor-free hook shims: run effects immediately (same idiom as the
// play-script controller spec).
vi.mock('preact/hooks', () => ({
  useRef: <Value>(value: Value) => ({ current: value }),
  useEffect: (setup: () => void | (() => void)) => setup(),
  useCallback: <Value>(callback: Value) => callback,
}));

// Minimal window shim for the Node test environment — enough for the bridge
// listener idiom (add/removeEventListener + dispatchEvent + origin).
const windowListeners = vi.hoisted(() => new Map<string, Set<(event: never) => void>>());
vi.hoisted(() => {
  const shim = {
    location: { origin: 'http://localhost:1420' },
    addEventListener: (type: string, callback: (event: never) => void) => {
      const set = windowListeners.get(type) ?? new Set();
      set.add(callback);
      windowListeners.set(type, set);
    },
    removeEventListener: (type: string, callback: (event: never) => void) => {
      windowListeners.get(type)?.delete(callback);
    },
    dispatchEvent: (event: { type: string }) => {
      for (const callback of windowListeners.get(event.type) ?? []) callback(event as never);
      return true;
    },
  };
  Object.defineProperty(globalThis, 'window', { value: shim, writable: true, configurable: true });
});

import {
  PHYSIC_PAINT_OPEN_LOOP_EDIT_EVENT,
  PHYSIC_PAINT_WINDOW_LABEL,
} from '../../../lib/physicPaintBridge';
import { isPhysicPaintOpenLoopEditRequest } from '../../../types/physicPaint';
import { sendPhysicPaintOpenLoopEdit } from './physicsPaintBridgeTransport';
import { usePhysicsPaintOpenLoopEditBridge } from './usePhysicsPaintParentBridge';

beforeEach(() => {
  eventApi.listen.mockClear();
  eventApi.emit.mockClear();
  eventApi.emitTo.mockClear();
});

describe('isPhysicPaintOpenLoopEditRequest guard (T-43-06-01)', () => {
  it('accepts a well-formed request', () => {
    expect(isPhysicPaintOpenLoopEditRequest({ loopId: 'loop-1' })).toBe(true);
  });

  it.each([
    ['missing loopId', {}],
    ['empty loopId', { loopId: '' }],
    ['non-string loopId', { loopId: 42 }],
    ['null loopId', { loopId: null }],
    ['unknown extra member', { loopId: 'loop-1', frame: 10 }],
    ['a non-record', 'loop-1'],
    ['null', null],
  ])('rejects %s', (_label, value) => {
    expect(isPhysicPaintOpenLoopEditRequest(value)).toBe(false);
  });
});

describe('sendPhysicPaintOpenLoopEdit', () => {
  it('emits the event to the Studio window label in Tauri mode', async () => {
    await sendPhysicPaintOpenLoopEdit({ loopId: 'loop-9' }, 'Tauri');
    expect(eventApi.emitTo).toHaveBeenCalledWith(PHYSIC_PAINT_WINDOW_LABEL, PHYSIC_PAINT_OPEN_LOOP_EDIT_EVENT, { loopId: 'loop-9' });
  });

  it('posts the typed message to the child window handle in Browser fallback mode', async () => {
    const target = { postMessage: vi.fn() } as unknown as Window;
    await sendPhysicPaintOpenLoopEdit({ loopId: 'loop-9' }, 'Browser fallback', target);
    expect(target.postMessage).toHaveBeenCalledWith(
      { type: PHYSIC_PAINT_OPEN_LOOP_EDIT_EVENT, payload: { loopId: 'loop-9' } },
      window.location.origin,
    );
  });

  it('throws when the Browser fallback has no child window handle', async () => {
    await expect(sendPhysicPaintOpenLoopEdit({ loopId: 'loop-9' }, 'Browser fallback', null)).rejects.toThrow();
  });

  it('rejects a malformed payload before sending', async () => {
    await expect(sendPhysicPaintOpenLoopEdit({ loopId: '' }, 'Tauri')).rejects.toThrow();
    expect(eventApi.emitTo).not.toHaveBeenCalled();
  });
});

describe('usePhysicsPaintOpenLoopEditBridge (child listener)', () => {
  it('registers a Tauri listener and routes a valid payload to openLoopEdit', async () => {
    let handler: ((event: { payload: unknown }) => void) | undefined;
    eventApi.listen.mockImplementationOnce(async (_event: string, registered: (event: { payload: unknown }) => void) => {
      handler = registered;
      return vi.fn();
    });
    const openLoopEdit = vi.fn();
    usePhysicsPaintOpenLoopEditBridge(openLoopEdit);
    await vi.waitFor(() => expect(eventApi.listen).toHaveBeenCalledWith(PHYSIC_PAINT_OPEN_LOOP_EDIT_EVENT, expect.any(Function)));
    handler?.({ payload: { loopId: 'loop-3' } });
    expect(openLoopEdit).toHaveBeenCalledWith('loop-3');
  });

  it('ignores malformed payloads (missing/invalid loopId) — never routes them', async () => {
    let handler: ((event: { payload: unknown }) => void) | undefined;
    eventApi.listen.mockImplementationOnce(async (_event: string, registered: (event: { payload: unknown }) => void) => {
      handler = registered;
      return vi.fn();
    });
    const openLoopEdit = vi.fn();
    usePhysicsPaintOpenLoopEditBridge(openLoopEdit);
    await vi.waitFor(() => expect(eventApi.listen).toHaveBeenCalled());
    handler?.({ payload: {} });
    handler?.({ payload: { loopId: 7 } });
    handler?.({ payload: null });
    expect(openLoopEdit).not.toHaveBeenCalled();
  });

  it('routes browser-fallback window messages for the event', () => {
    const openLoopEdit = vi.fn();
    usePhysicsPaintOpenLoopEditBridge(openLoopEdit);
    window.dispatchEvent(new MessageEvent('message', {
      data: { type: PHYSIC_PAINT_OPEN_LOOP_EDIT_EVENT, payload: { loopId: 'loop-4' } },
      origin: window.location.origin,
    }));
    expect(openLoopEdit).toHaveBeenCalledWith('loop-4');
    // A wrong-origin message is ignored.
    window.dispatchEvent(new MessageEvent('message', {
      data: { type: PHYSIC_PAINT_OPEN_LOOP_EDIT_EVENT, payload: { loopId: 'loop-5' } },
      origin: 'https://evil.example',
    }));
    expect(openLoopEdit).toHaveBeenCalledTimes(1);
  });
});
