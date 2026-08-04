import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { timelineStore } from './stores/timelineStore';
import { paintStore } from './stores/paintStore';

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;

const tauriListeners = vi.hoisted(() => new Map<string, Array<(event: { payload: unknown }) => unknown>>());

vi.mock('preact', () => ({ render: vi.fn() }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ onCloseRequested: vi.fn() }) }));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((eventName: string, handler: (event: { payload: unknown }) => unknown) => {
    const handlers = tauriListeners.get(eventName) ?? [];
    handlers.push(handler);
    tauriListeners.set(eventName, handlers);
    return Promise.resolve(() => {});
  }),
  // 41-03: the audio-context publisher targets the child window via emitTo at
  // startup (the install effect publishes the current section immediately).
  emitTo: vi.fn(() => Promise.resolve()),
}));
vi.mock('./lib/projectDir', () => ({ initTempProjectDir: vi.fn(() => Promise.resolve()) }));
vi.mock('./lib/themeManager', () => ({ initTheme: vi.fn(() => Promise.resolve()) }));
vi.mock('./lib/autoSave', () => ({ startAutoSave: vi.fn() }));
vi.mock('./lib/shortcuts', () => ({
  mountShortcuts: vi.fn(),
  handleSave: vi.fn(),
  handleNewProject: vi.fn(),
  handleOpenProject: vi.fn(),
  handleCloseProject: vi.fn(),
}));
vi.mock('./lib/history', () => ({ undo: vi.fn(), redo: vi.fn() }));
vi.mock('./app', () => ({ App: () => null }));

describe('main.tsx editor startup', () => {
  // Startup runs exactly once per process in production, so the suite stubs the
  // browser globals and imports main.tsx once; resetting the module registry
  // between tests would rebind main.tsx to fresh store instances the statically
  // imported stores in this file would no longer observe.
  beforeAll(async () => {
    Object.defineProperty(globalThis, 'window', {
      value: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        location: { pathname: '/', origin: 'http://localhost:1420' },
        // Models the native Tauri runtime so startup exercises the production
        // Tauri event path: every bridge listener early-returns its Tauri
        // unlisten and installs no DOM 'message' listener.
        __TAURI_INTERNALS__: {},
      },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'document', {
      value: { getElementById: vi.fn(() => ({})) },
      writable: true,
      configurable: true,
    });

    vi.spyOn(paintStore, 'initFromPreferences').mockResolvedValue(undefined);

    await import('./main');
    const flush = async () => {
      await vi.dynamicImportSettled();
      await new Promise((resolve) => setTimeout(resolve, 0));
    };
    await flush();
    // The awaited bridge installs each perform a dynamic
    // import('@tauri-apps/api/event'); flush once more if the frame-sync
    // handler has not been registered yet.
    if (!tauriListeners.get('physic-paint:seek-frame')?.length) await flush();
    // 41-04: the audio-ownership listener is the LAST awaited install in the
    // startup chain — keep flushing (bounded) until it lands. A floating late
    // resolution escapes this file's mocked module context and rejects against
    // the real Tauri event module (transformCallback TypeError).
    for (let i = 0; !tauriListeners.get('physic-paint:audio-ownership')?.length && i < 5; i += 1) await flush();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterAll(() => {
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'document', {
      value: originalDocument,
      writable: true,
      configurable: true,
    });
  });

  it('completes editor startup and registers a Tauri listener for physic-paint:seek-frame', () => {
    expect(tauriListeners.get('physic-paint:seek-frame')?.length ?? 0).toBeGreaterThan(0);
  });

  it('routes a Tauri physic-paint:seek-frame event to the editor timeline', () => {
    const seek = vi.spyOn(timelineStore, 'seek');
    const ensureFrameVisible = vi.spyOn(timelineStore, 'ensureFrameVisible');

    const handlers = tauriListeners.get('physic-paint:seek-frame') ?? [];
    expect(handlers.length).toBeGreaterThan(0);
    for (const handler of handlers) {
      handler({ payload: { type: 'physic-paint:seek-frame', frame: 7 } });
    }

    expect(seek).toHaveBeenCalledTimes(1);
    expect(seek).toHaveBeenCalledWith(7);
    expect(ensureFrameVisible).toHaveBeenCalledTimes(1);
    expect(ensureFrameVisible).toHaveBeenCalledWith(7);
  });
});
