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
  PHYSIC_PAINT_LOOP_OPERATION_REQUEST_EVENT,
  PHYSIC_PAINT_LOOP_OPERATION_RESULT_EVENT,
  PHYSIC_PAINT_OPEN_LOOP_EDIT_EVENT,
  PHYSIC_PAINT_WINDOW_LABEL,
} from '../../../lib/physicPaintBridge';
import {
  isPhysicPaintLoopOperationRequest,
  isPhysicPaintLoopOperationResult,
  isPhysicPaintOpenLoopEditRequest,
  type PhysicPaintLoopOperationRequest,
} from '../../../types/physicPaint';
import {
  sendPhysicPaintLoopOperationRequest,
  sendPhysicPaintLoopOperationResult,
  sendPhysicPaintOpenLoopEdit,
} from './physicsPaintBridgeTransport';
import {
  createPhysicsPaintLoopOperationRequestHandler,
  usePhysicsPaintOpenLoopEditBridge,
} from './usePhysicsPaintParentBridge';

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

const duplicateRequest: PhysicPaintLoopOperationRequest = {
  operationId: 'loop-op-1',
  projectContextId: 'project-1',
  layerId: 'paint-1',
  loopId: 'loop-7',
  kind: 'duplicate-linked-loop',
  destinationStart: 40,
};

describe('typed loop-operation protocol (43-08)', () => {
  it('accepts exact operation-specific request and result envelopes', () => {
    expect(isPhysicPaintLoopOperationRequest(duplicateRequest)).toBe(true);
    expect(isPhysicPaintLoopOperationRequest({
      operationId: 'loop-op-2', projectContextId: 'project-1', layerId: 'paint-1', loopId: 'loop-7',
      kind: 'relink-loop', sourceKeyIds: ['key-1', 'key-2'],
    })).toBe(true);
    expect(isPhysicPaintLoopOperationResult({
      operationId: 'loop-op-1', projectContextId: 'project-1', layerId: 'paint-1', loopId: 'loop-7',
      kind: 'duplicate-linked-loop', ok: false, reason: 'Destination is occupied.',
    })).toBe(true);
  });

  it.each([
    ['extra request key', {...duplicateRequest, extra: true}],
    ['wrong operation payload', {...duplicateRequest, kind: 'unlink-loop'}],
    ['missing duplicate destination', (() => { const {destinationStart: _omitted, ...value} = duplicateRequest; return value; })()],
    ['empty relink cycle', {...duplicateRequest, kind: 'relink-loop', sourceKeyIds: [], destinationStart: undefined}],
    ['control character operation id', {...duplicateRequest, operationId: 'bad\noperation'}],
  ])('rejects %s', (_label, value) => {
    expect(isPhysicPaintLoopOperationRequest(value)).toBe(false);
  });

  it('rejects result envelopes with extra keys or mismatched value types', () => {
    const result = {
      operationId: 'loop-op-1', projectContextId: 'project-1', layerId: 'paint-1', loopId: 'loop-7',
      kind: 'duplicate-linked-loop', ok: true, reason: null,
    };
    expect(isPhysicPaintLoopOperationResult({...result, extra: true})).toBe(false);
    expect(isPhysicPaintLoopOperationResult({...result, reason: 42})).toBe(false);
  });
});

describe('loop-operation transport (43-08)', () => {
  it('sends requests to the Studio and results to main in Tauri mode', async () => {
    const result = {...duplicateRequest, ok: true, reason: null};
    await sendPhysicPaintLoopOperationRequest(duplicateRequest, 'Tauri');
    await sendPhysicPaintLoopOperationResult(result, 'Tauri');
    expect(eventApi.emitTo).toHaveBeenCalledWith(PHYSIC_PAINT_WINDOW_LABEL, PHYSIC_PAINT_LOOP_OPERATION_REQUEST_EVENT, duplicateRequest);
    expect(eventApi.emitTo).toHaveBeenCalledWith('main', PHYSIC_PAINT_LOOP_OPERATION_RESULT_EVENT, result);
  });

  it('uses the correlated Browser fallback request/result messages', async () => {
    const child = {postMessage: vi.fn()} as unknown as Window;
    const parent = {postMessage: vi.fn()} as unknown as Window;
    const result = {...duplicateRequest, ok: true, reason: null};
    await sendPhysicPaintLoopOperationRequest(duplicateRequest, 'Browser fallback', child);
    await sendPhysicPaintLoopOperationResult(result, 'Browser fallback', parent);
    expect(child.postMessage).toHaveBeenCalledWith({type: PHYSIC_PAINT_LOOP_OPERATION_REQUEST_EVENT, payload: duplicateRequest}, window.location.origin);
    expect(parent.postMessage).toHaveBeenCalledWith({type: PHYSIC_PAINT_LOOP_OPERATION_RESULT_EVENT, payload: result}, window.location.origin);
  });
});

describe('loop-operation child dispatch (43-08)', () => {
  it('validates active context, dispatches the canonical controller method once, and replays the result on retry', async () => {
    const duplicateLinkedLoop = vi.fn(async () => ({ok: true, reason: null}));
    const sendResult = vi.fn(async () => {});
    const handler = createPhysicsPaintLoopOperationRequestHandler({
      getLaunchContext: () => ({projectContextId: 'project-1', layerId: 'paint-1'}),
      operations: {
        duplicateLinkedLoop,
        unlinkLoop: vi.fn(),
        repairLoop: vi.fn(),
        relinkLoop: vi.fn(),
      },
      sendResult,
    });

    await Promise.all([handler(duplicateRequest), handler(duplicateRequest)]);

    expect(duplicateLinkedLoop).toHaveBeenCalledTimes(1);
    expect(duplicateLinkedLoop).toHaveBeenCalledWith('loop-7', 40);
    expect(sendResult).toHaveBeenCalledTimes(2);
    expect(sendResult).toHaveBeenLastCalledWith({...duplicateRequest, ok: true, reason: null});
  });

  it('fails closed for stale context and operation-id reuse with changed content', async () => {
    const duplicateLinkedLoop = vi.fn(async () => ({ok: true, reason: null}));
    const sendResult = vi.fn(async () => {});
    const handler = createPhysicsPaintLoopOperationRequestHandler({
      getLaunchContext: () => ({projectContextId: 'project-2', layerId: 'paint-1'}),
      operations: {duplicateLinkedLoop, unlinkLoop: vi.fn(), repairLoop: vi.fn(), relinkLoop: vi.fn()},
      sendResult,
    });
    await handler(duplicateRequest);
    expect(duplicateLinkedLoop).not.toHaveBeenCalled();
    expect(sendResult).toHaveBeenLastCalledWith({...duplicateRequest, ok: false, reason: 'Physics Paint project context changed.'});

    const liveHandler = createPhysicsPaintLoopOperationRequestHandler({
      getLaunchContext: () => ({projectContextId: 'project-1', layerId: 'paint-1'}),
      operations: {duplicateLinkedLoop, unlinkLoop: vi.fn(), repairLoop: vi.fn(), relinkLoop: vi.fn()},
      sendResult,
    });
    await liveHandler(duplicateRequest);
    await liveHandler({...duplicateRequest, destinationStart: 41});
    expect(duplicateLinkedLoop).toHaveBeenCalledTimes(1);
    expect(sendResult).toHaveBeenLastCalledWith({...duplicateRequest, destinationStart: 41, ok: false, reason: 'Operation ID was already used for a different loop-operation request.'});
  });

  it('preserves delete identity while dispatching unlink, and routes repair/relink canonically', async () => {
    const unlinkLoop = vi.fn(async () => ({ok: true, reason: null}));
    const repairLoop = vi.fn(async () => ({ok: false, reason: 'Repair requires source regeneration.'}));
    const relinkLoop = vi.fn(async () => ({ok: true, reason: null}));
    const sendResult = vi.fn(async () => {});
    const handler = createPhysicsPaintLoopOperationRequestHandler({
      getLaunchContext: () => ({projectContextId: 'project-1', layerId: 'paint-1'}),
      operations: {duplicateLinkedLoop: vi.fn(), unlinkLoop, repairLoop, relinkLoop},
      sendResult,
    });
    const base = {projectContextId: 'project-1', layerId: 'paint-1', loopId: 'loop-7'} as const;
    await handler({...base, operationId: 'delete-1', kind: 'delete-loop'});
    await handler({...base, operationId: 'repair-1', kind: 'repair-loop'});
    await handler({...base, operationId: 'relink-1', kind: 'relink-loop', sourceKeyIds: ['key-1']});
    expect(unlinkLoop).toHaveBeenCalledWith('loop-7');
    expect(repairLoop).toHaveBeenCalledWith('loop-7');
    expect(relinkLoop).toHaveBeenCalledWith('loop-7', ['key-1']);
    expect(sendResult).toHaveBeenCalledWith(expect.objectContaining({operationId: 'delete-1', kind: 'delete-loop', ok: true}));
    expect(sendResult).toHaveBeenCalledWith(expect.objectContaining({operationId: 'repair-1', kind: 'repair-loop', ok: false, reason: 'Repair requires source regeneration.'}));
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
