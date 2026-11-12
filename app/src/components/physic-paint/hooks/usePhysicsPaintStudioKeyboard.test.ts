// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreactHookRuntime } from '../../../test/preactHookRuntime';

const dispatch = vi.hoisted(() => vi.fn());

let runtime = new PreactHookRuntime();

vi.mock('preact/hooks', () => ({
  useCallback: <T,>(callback: T, deps: unknown[]) => runtime.useCallback(callback, deps),
  useEffect: (effect: () => void | (() => void), deps?: unknown[]) => runtime.useEffect(effect, deps),
  useRef: <T,>(initial: T) => runtime.useRef(initial),
}));

vi.mock('../view/physicsPaintStudioKeyboard', () => ({
  dispatchPhysicsPaintStudioKeyDown: (...args: unknown[]) => dispatch(...args),
}));

import { usePhysicsPaintStudioKeyboard } from './usePhysicsPaintStudioKeyboard';

const BODY = { tagName: 'BODY' };
const ROOT = { tagName: 'HTML' };
const BUTTON = { tagName: 'BUTTON' };

let windowListeners: Map<string, (event: KeyboardEvent) => void>;
let activeElement: unknown;

function mountHook(): (event: KeyboardEvent) => void {
  let handler: ((event: KeyboardEvent) => void) | null = null;
  const Component = () => {
    handler = usePhysicsPaintStudioKeyboard({
      state: {} as never,
      actions: {} as never,
      savedRotoFrames: [],
    });
    return null;
  };
  runtime = new PreactHookRuntime();
  runtime.beginRender();
  Component();
  runtime.flushEffects();
  if (handler === null) throw new Error('the hook returned no handler');
  return handler;
}

function pressOnWindow(): KeyboardEvent {
  const listener = windowListeners.get('keydown');
  if (!listener) throw new Error('no window keydown listener was bound');
  const event = { key: 'Backspace' } as unknown as KeyboardEvent;
  listener(event);
  return event;
}

beforeEach(() => {
  dispatch.mockClear();
  activeElement = BODY;
  windowListeners = new Map();
  vi.stubGlobal('window', {
    addEventListener: (type: string, listener: (event: KeyboardEvent) => void) => {
      windowListeners.set(type, listener);
    },
    removeEventListener: (type: string) => {
      windowListeners.delete(type);
    },
  });
  vi.stubGlobal('document', {
    get activeElement() {
      return activeElement;
    },
    body: BODY,
    documentElement: ROOT,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('usePhysicsPaintStudioKeyboard — the orphaned-focus route', () => {
  it('dispatches from the window while nothing is focused', () => {
    activeElement = BODY;
    mountHook();
    pressOnWindow();
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('treats a null active element as orphaned too', () => {
    activeElement = null;
    mountHook();
    pressOnWindow();
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('stands down as soon as a control is focused, so the shell stays the one owner', () => {
    activeElement = BUTTON;
    mountHook();
    pressOnWindow();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('still dispatches through the returned handler (the shell route)', () => {
    activeElement = BUTTON;
    const handler = mountHook();
    handler({ key: 'Backspace' } as unknown as KeyboardEvent);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});
