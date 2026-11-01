import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const eventApi = vi.hoisted(() => ({
  listen: vi.fn(),
  emitTo: vi.fn(),
}));
vi.mock('@tauri-apps/api/event', () => eventApi);

import {
  clearStudioDraftMode,
  installPhysicPaintDraftModeListener,
  isStudioDraftModeActive,
  PHYSIC_PAINT_DRAFT_HEARTBEAT_MS,
  PHYSIC_PAINT_DRAFT_MODE_EVENT,
  PHYSIC_PAINT_DRAFT_STALE_MS,
  publishStudioDraftMode,
  readDraftModePayload,
  setStudioDraftModeActive,
  setStudioDraftModeReleaseHandler,
} from './physicPaintDraftMode';

function setTauriRuntime(enabled: boolean): void {
  if (enabled) {
    (globalThis as Record<string, unknown>).window = { __TAURI_INTERNALS__: {} };
  } else {
    delete (globalThis as Record<string, unknown>).window;
  }
}

type Listener = (event: { payload: unknown }) => void;

describe('physicPaintDraftMode', () => {
  const release = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    eventApi.listen.mockResolvedValue(() => {});
    eventApi.emitTo.mockResolvedValue(undefined);
    // Module gate state is app-wide: return it to the untouched default.
    setStudioDraftModeReleaseHandler(null);
    setStudioDraftModeActive(false);
    release.mockReset();
    setStudioDraftModeReleaseHandler(release);
  });

  afterEach(() => {
    vi.useRealTimers();
    setStudioDraftModeReleaseHandler(null);
    setStudioDraftModeActive(false);
    delete (globalThis as Record<string, unknown>).window;
  });

  it('starts inactive and exports the transport constants', () => {
    expect(isStudioDraftModeActive()).toBe(false);
    expect(PHYSIC_PAINT_DRAFT_MODE_EVENT).toBe('physic-paint:draft-mode');
    expect(PHYSIC_PAINT_DRAFT_HEARTBEAT_MS).toBe(5000);
    expect(PHYSIC_PAINT_DRAFT_STALE_MS).toBe(20000);
  });

  describe('readDraftModePayload', () => {
    it('accepts only a boolean `active` field', () => {
      expect(readDraftModePayload({ active: true })).toBe(true);
      expect(readDraftModePayload({ active: false })).toBe(false);
    });

    it('rejects every malformed shape instead of interpreting it', () => {
      expect(readDraftModePayload(null)).toBeNull();
      expect(readDraftModePayload(undefined)).toBeNull();
      expect(readDraftModePayload('active')).toBeNull();
      expect(readDraftModePayload(1)).toBeNull();
      expect(readDraftModePayload([])).toBeNull();
      expect(readDraftModePayload({})).toBeNull();
      expect(readDraftModePayload({ active: 1 })).toBeNull();
      expect(readDraftModePayload({ active: 'true' })).toBeNull();
      expect(readDraftModePayload({ active: null })).toBeNull();
    });
  });

  describe('transition law', () => {
    it('never fires the release handler on a true transition', () => {
      setStudioDraftModeActive(true);
      setStudioDraftModeActive(true);
      expect(isStudioDraftModeActive()).toBe(true);
      expect(release).not.toHaveBeenCalled();
    });

    it('fires the release handler exactly once on a true -> false transition', () => {
      setStudioDraftModeActive(true);
      setStudioDraftModeActive(false);
      setStudioDraftModeActive(false);
      expect(isStudioDraftModeActive()).toBe(false);
      expect(release).toHaveBeenCalledTimes(1);
    });

    it('does not fire for a bare false on an already-inactive gate', () => {
      setStudioDraftModeActive(false);
      expect(release).not.toHaveBeenCalled();
    });
  });

  describe('clearStudioDraftMode (window-closed belt)', () => {
    it('sets the gate inactive and releases exactly once', () => {
      setStudioDraftModeActive(true);
      clearStudioDraftMode();
      expect(isStudioDraftModeActive()).toBe(false);
      expect(release).toHaveBeenCalledTimes(1);
    });

    it('is inert when repeated', () => {
      setStudioDraftModeActive(true);
      clearStudioDraftMode();
      clearStudioDraftMode();
      clearStudioDraftMode();
      expect(release).toHaveBeenCalledTimes(1);
    });
  });

  describe('staleness belt', () => {
    it('clears an active gate only after PHYSIC_PAINT_DRAFT_STALE_MS of silence', () => {
      vi.useFakeTimers();
      setStudioDraftModeActive(true);
      vi.advanceTimersByTime(PHYSIC_PAINT_DRAFT_STALE_MS - 1);
      expect(isStudioDraftModeActive()).toBe(true);
      expect(release).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(isStudioDraftModeActive()).toBe(false);
      expect(release).toHaveBeenCalledTimes(1);
    });

    it('never fires for an inactive gate', () => {
      vi.useFakeTimers();
      vi.advanceTimersByTime(PHYSIC_PAINT_DRAFT_STALE_MS * 3);
      expect(isStudioDraftModeActive()).toBe(false);
      expect(release).not.toHaveBeenCalled();
    });

    it('re-arms on every payload, a heartbeat included', async () => {
      vi.useFakeTimers();
      setTauriRuntime(true);
      const listeners: Record<string, Listener> = {};
      eventApi.listen.mockImplementation(async (event: string, listener: Listener) => {
        listeners[event] = listener;
        return () => {};
      });
      await installPhysicPaintDraftModeListener();

      listeners[PHYSIC_PAINT_DRAFT_MODE_EVENT]({ payload: { active: true } });
      expect(isStudioDraftModeActive()).toBe(true);
      vi.advanceTimersByTime(PHYSIC_PAINT_DRAFT_HEARTBEAT_MS * 3);
      // Heartbeat at 5s/10s/15s of silence each re-armed the belt.
      listeners[PHYSIC_PAINT_DRAFT_MODE_EVENT]({ payload: { active: true } });
      vi.advanceTimersByTime(PHYSIC_PAINT_DRAFT_STALE_MS - 1);
      expect(isStudioDraftModeActive()).toBe(true);
      expect(release).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(isStudioDraftModeActive()).toBe(false);
      expect(release).toHaveBeenCalledTimes(1);
    });
  });

  describe('publishStudioDraftMode (Studio realm)', () => {
    it('is a silent no-op outside Tauri', async () => {
      setTauriRuntime(false);
      await publishStudioDraftMode(true);
      expect(eventApi.emitTo).not.toHaveBeenCalled();
    });

    it('emits the canonical payload to main under Tauri', async () => {
      setTauriRuntime(true);
      await publishStudioDraftMode(true);
      expect(eventApi.emitTo).toHaveBeenCalledWith('main', PHYSIC_PAINT_DRAFT_MODE_EVENT, { active: true });
      await publishStudioDraftMode(false);
      expect(eventApi.emitTo).toHaveBeenLastCalledWith('main', PHYSIC_PAINT_DRAFT_MODE_EVENT, { active: false });
    });
  });

  describe('installPhysicPaintDraftModeListener (main realm)', () => {
    it('resolves an inert cleanup outside Tauri', async () => {
      setTauriRuntime(false);
      const cleanup = await installPhysicPaintDraftModeListener();
      expect(typeof cleanup).toBe('function');
      expect(() => cleanup()).not.toThrow();
      expect(eventApi.listen).not.toHaveBeenCalled();
    });

    it('routes draft payloads, ignores malformed ones and clears on window-closed', async () => {
      setTauriRuntime(true);
      const listeners: Record<string, Listener> = {};
      const unlistenDraft = vi.fn();
      const unlistenClosed = vi.fn();
      eventApi.listen.mockImplementation(async (event: string, listener: Listener) => {
        listeners[event] = listener;
        return event === PHYSIC_PAINT_DRAFT_MODE_EVENT ? unlistenDraft : unlistenClosed;
      });
      const cleanup = await installPhysicPaintDraftModeListener();
      expect(eventApi.listen).toHaveBeenCalledWith(PHYSIC_PAINT_DRAFT_MODE_EVENT, expect.any(Function));
      expect(eventApi.listen).toHaveBeenCalledWith('physic-paint:window-closed', expect.any(Function));

      // Malformed payloads neither activate the gate nor throw.
      expect(() => listeners[PHYSIC_PAINT_DRAFT_MODE_EVENT]({ payload: { active: 'yes' } })).not.toThrow();
      expect(() => listeners[PHYSIC_PAINT_DRAFT_MODE_EVENT]({ payload: null })).not.toThrow();
      expect(isStudioDraftModeActive()).toBe(false);
      expect(release).not.toHaveBeenCalled();

      listeners[PHYSIC_PAINT_DRAFT_MODE_EVENT]({ payload: { active: true } });
      expect(isStudioDraftModeActive()).toBe(true);
      expect(release).not.toHaveBeenCalled();

      // The Studio window is destroyed: the gate clears and releases once.
      listeners['physic-paint:window-closed']({ payload: undefined });
      expect(isStudioDraftModeActive()).toBe(false);
      expect(release).toHaveBeenCalledTimes(1);
      listeners['physic-paint:window-closed']({ payload: undefined });
      expect(release).toHaveBeenCalledTimes(1);

      cleanup();
      expect(unlistenDraft).toHaveBeenCalledTimes(1);
      expect(unlistenClosed).toHaveBeenCalledTimes(1);
    });
  });
});
