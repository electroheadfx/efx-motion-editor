import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { timelineStore } from './stores/timelineStore';
import { paintStore } from './stores/paintStore';

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;

vi.mock('preact', () => ({ render: vi.fn() }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ onCloseRequested: vi.fn() }) }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(() => Promise.resolve(() => {})) }));
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

type MessageListener = (event: MessageEvent) => void;

describe('main.tsx editor startup', () => {
  let messageListeners: MessageListener[];

  // Startup runs exactly once per process in production, so the suite stubs the
  // browser globals and imports main.tsx once; resetting the module registry
  // between tests would rebind main.tsx to fresh store instances the statically
  // imported stores in this file would no longer observe.
  beforeAll(async () => {
    const listenersByType = new Map<string, Set<EventListenerOrEventListenerObject>>();
    Object.defineProperty(globalThis, 'window', {
      value: {
        addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
          const set = listenersByType.get(type) ?? new Set<EventListenerOrEventListenerObject>();
          set.add(listener);
          listenersByType.set(type, set);
        },
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        location: { pathname: '/', origin: 'http://localhost:1420' },
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
    await vi.dynamicImportSettled();
    await new Promise((resolve) => setTimeout(resolve, 0));

    messageListeners = [...(listenersByType.get('message') ?? [])] as MessageListener[];
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

  it('completes editor startup and registers at least one window message listener', () => {
    expect(messageListeners.length).toBeGreaterThan(0);
  });

  it('routes a valid physic-paint:seek-frame message to the editor timeline', () => {
    const seek = vi.spyOn(timelineStore, 'seek');
    const ensureFrameVisible = vi.spyOn(timelineStore, 'ensureFrameVisible');

    const event = new MessageEvent('message', { data: { type: 'physic-paint:seek-frame', frame: 7 } });
    for (const listener of messageListeners) listener(event);

    expect(seek).toHaveBeenCalledTimes(1);
    expect(seek).toHaveBeenCalledWith(7);
    expect(ensureFrameVisible).toHaveBeenCalledTimes(1);
    expect(ensureFrameVisible).toHaveBeenCalledWith(7);
  });
});
