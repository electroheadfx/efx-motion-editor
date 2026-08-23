import { useCallback, useEffect, useRef } from 'preact/hooks';
import type {
  PhysicPaintApplyResult,
  PhysicPaintLaunchContext,
  PhysicPaintRotoPlaybackSettings,
  PhysicPaintUpdateRotoPlaybackSettingsPayload,
} from '../../../types/physicPaint';

const PLAYBACK_SETTINGS_TIMEOUT_MS = 5000;

type PlaybackSettingsItem = {
  operationId: string;
  generation: number;
  layerId: string;
  trackId: string;
  startFrame: number;
  settings: PhysicPaintRotoPlaybackSettings;
};

type FlushWaiter = {
  resolve: () => void;
  reject: (error: Error) => void;
};

function samePlaybackSettings(
  left: PhysicPaintRotoPlaybackSettings | null,
  right: PhysicPaintRotoPlaybackSettings,
): boolean {
  return left?.loop === right.loop && left.fps === right.fps;
}

export function useRotoPlaybackSettingsController(input: {
  initialContext: { context: PhysicPaintLaunchContext; settings: PhysicPaintRotoPlaybackSettings } | null;
  send: (payload: PhysicPaintUpdateRotoPlaybackSettingsPayload) => Promise<void>;
  applyLocalSettings: (settings: PhysicPaintRotoPlaybackSettings) => void;
  setError: (message: string | null) => void;
}) {
  const inputRef = useRef(input);
  inputRef.current = input;
  const initialContextRef = useRef(input.initialContext);
  const generationRef = useRef(initialContextRef.current ? 1 : 0);
  const launchRef = useRef<{ generation: number; layerId: string; trackId: string; startFrame: number } | null>(initialContextRef.current ? {
    generation: 1,
    layerId: initialContextRef.current.context.layerId,
    // 46-01: playback settings are per-track; carry the ACTIVE track identity.
    trackId: initialContextRef.current.context.document?.activeTrackId ?? '',
    startFrame: initialContextRef.current.context.startFrame,
  } : null);
  const acknowledgedRef = useRef<PhysicPaintRotoPlaybackSettings | null>(initialContextRef.current ? { ...initialContextRef.current.settings } : null);
  const desiredRef = useRef<PhysicPaintRotoPlaybackSettings | null>(initialContextRef.current ? { ...initialContextRef.current.settings } : null);
  const inFlightRef = useRef<PlaybackSettingsItem | null>(null);
  const queuedRef = useRef<PlaybackSettingsItem | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const failureRef = useRef<Error | null>(null);
  const flushWaitersRef = useRef<FlushWaiter[]>([]);
  const pumpRef = useRef<() => void>(() => {});

  const clearTimeout = useCallback(() => {
    if (timeoutRef.current === null) return;
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const resolveFlushWaiters = useCallback(() => {
    if (inFlightRef.current || queuedRef.current) return;
    const waiters = flushWaitersRef.current.splice(0);
    for (const waiter of waiters) waiter.resolve();
  }, []);

  const rejectFlushWaiters = useCallback((error: Error) => {
    const waiters = flushWaitersRef.current.splice(0);
    for (const waiter of waiters) waiter.reject(error);
  }, []);

  const failInFlight = useCallback((item: PlaybackSettingsItem, error: Error) => {
    if (inFlightRef.current?.operationId !== item.operationId) return;
    clearTimeout();
    inFlightRef.current = null;
    const currentGeneration = launchRef.current?.generation === item.generation;
    if (!currentGeneration) {
      failureRef.current = null;
      pumpRef.current();
      resolveFlushWaiters();
      return;
    }
    if (!queuedRef.current && samePlaybackSettings(desiredRef.current, item.settings)) queuedRef.current = item;
    failureRef.current = error;
    inputRef.current.setError(error.message);
    rejectFlushWaiters(error);
  }, [clearTimeout, rejectFlushWaiters, resolveFlushWaiters]);

  const sendItem = useCallback((item: PlaybackSettingsItem) => {
    inFlightRef.current = item;
    timeoutRef.current = window.setTimeout(() => {
      failInFlight(item, new Error('Saving Roto playback settings timed out.'));
    }, PLAYBACK_SETTINGS_TIMEOUT_MS);
    const payload: PhysicPaintUpdateRotoPlaybackSettingsPayload = {
      kind: 'update-roto-playback-settings',
      operationId: item.operationId,
      layerId: item.layerId,
      trackId: item.trackId,
      startFrame: item.startFrame,
      settings: { ...item.settings },
    };
    void inputRef.current.send(payload).catch((error) => {
      failInFlight(item, error instanceof Error ? error : new Error(String(error)));
    });
  }, [failInFlight]);

  const pump = useCallback(() => {
    if (inFlightRef.current || failureRef.current || !queuedRef.current) return;
    const item = queuedRef.current;
    queuedRef.current = null;
    sendItem(item);
  }, [sendItem]);
  pumpRef.current = pump;

  const hydrateForLaunch = useCallback((
    context: PhysicPaintLaunchContext,
    settings: PhysicPaintRotoPlaybackSettings,
  ) => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    launchRef.current = { generation, layerId: context.layerId, trackId: context.document?.activeTrackId ?? '', startFrame: context.startFrame };
    acknowledgedRef.current = { ...settings };
    desiredRef.current = { ...settings };
    queuedRef.current = null;
    failureRef.current = null;
    inputRef.current.setError(null);
    resolveFlushWaiters();
  }, [resolveFlushWaiters]);

  const enqueue = useCallback((settings: PhysicPaintRotoPlaybackSettings) => {
    const launch = launchRef.current;
    if (!launch) return;
    const nextSettings = { ...settings };
    desiredRef.current = nextSettings;
    if (!inFlightRef.current && samePlaybackSettings(acknowledgedRef.current, nextSettings)) {
      queuedRef.current = null;
      failureRef.current = null;
      resolveFlushWaiters();
      return;
    }
    const item: PlaybackSettingsItem = {
      operationId: `physics-paint-playback-${Date.now()}-${crypto.randomUUID()}`,
      generation: launch.generation,
      layerId: launch.layerId,
      trackId: launch.trackId,
      startFrame: launch.startFrame,
      settings: nextSettings,
    };
    if (inFlightRef.current
      && inFlightRef.current.generation === item.generation
      && samePlaybackSettings(inFlightRef.current.settings, item.settings)) {
      queuedRef.current = null;
      return;
    }
    queuedRef.current = item;
    failureRef.current = null;
    pumpRef.current();
  }, [resolveFlushWaiters]);

  const handleApplyResult = useCallback((detail: PhysicPaintApplyResult | null | undefined): boolean => {
    if (!detail || detail.kind !== 'update-roto-playback-settings') return false;
    const item = inFlightRef.current;
    if (!item
      || detail.operationId !== item.operationId
      || detail.layerId !== item.layerId
      || detail.startFrame !== item.startFrame) return false;
    clearTimeout();
    inFlightRef.current = null;
    const currentGeneration = launchRef.current?.generation === item.generation;
    if (detail.ok) {
      if (currentGeneration) {
        acknowledgedRef.current = { ...item.settings };
        inputRef.current.setError(null);
      }
      failureRef.current = null;
    } else {
      const error = new Error(detail.error ?? 'Could not save Roto playback settings.');
      if (currentGeneration && !queuedRef.current && acknowledgedRef.current) {
        desiredRef.current = { ...acknowledgedRef.current };
        inputRef.current.applyLocalSettings(acknowledgedRef.current);
      }
      failureRef.current = queuedRef.current ? null : error;
      inputRef.current.setError(error.message);
      if (!queuedRef.current) rejectFlushWaiters(error);
    }
    pumpRef.current();
    resolveFlushWaiters();
    return true;
  }, [clearTimeout, rejectFlushWaiters, resolveFlushWaiters]);

  const hasPending = useCallback(() => Boolean(inFlightRef.current || queuedRef.current), []);

  const flush = useCallback((): Promise<void> => {
    if (!hasPending()) {
      return failureRef.current ? Promise.reject(failureRef.current) : Promise.resolve();
    }
    if (failureRef.current && queuedRef.current) {
      failureRef.current = null;
      pumpRef.current();
    }
    return new Promise<void>((resolve, reject) => {
      flushWaitersRef.current.push({ resolve, reject });
      resolveFlushWaiters();
    });
  }, [hasPending, resolveFlushWaiters]);

  useEffect(() => () => {
    clearTimeout();
    rejectFlushWaiters(new Error('Roto playback settings controller was disposed.'));
  }, [clearTimeout, rejectFlushWaiters]);

  return {
    hydrateForLaunch,
    enqueue,
    handleApplyResult,
    hasPending,
    flush,
  };
}
