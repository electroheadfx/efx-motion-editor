import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() =>
  vi.fn(async (_command: string, _args: { contents: string; name?: string }): Promise<string> => '/tmp/efx-stall-capture-pgd-gesture.json'),
);

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import {
  GESTURE_REFUSAL_CAPTURE_DEDUPE_WINDOW_MS,
  GESTURE_REFUSAL_CAPTURE_EVENT_CAP,
  GESTURE_REFUSAL_CAPTURE_NAME,
  describeGestureSurface,
  gestureRefusalCaptureEnabled,
  recordGesturePointerArrival,
  reportGestureRefusal,
  resetGestureRefusalCaptureForTesting,
  snapshotGestureRefusalCapture,
  type PhysicPaintGestureDoorTerms,
  type PhysicPaintGestureInstallTerms,
  type PhysicPaintGestureRefusalCapture,
  type PhysicPaintGestureStripTerms,
} from './physicPaintGestureRefusalCapture';

/** The write is fire-and-forget: drain microtasks (never timers) until it lands. */
const settleWrite = async (): Promise<void> => {
  for (let tick = 0; tick < 16; tick += 1) await Promise.resolve();
};

/** The last payload handed to `write_debug_capture`, parsed. */
const lastWrittenCapture = (): PhysicPaintGestureRefusalCapture => {
  const call = invoke.mock.calls[invoke.mock.calls.length - 1];
  return JSON.parse(call[1].contents) as PhysicPaintGestureRefusalCapture;
};

const STRIP_TERMS: PhysicPaintGestureStripTerms = {
  ready: true,
  mutationLocked: true,
  keyActionInFlight: false,
  sessionBusy: false,
  dragPreviewPending: false,
  hasPhysicalActions: true,
  physicalDragAvailable: true,
  canDragKey: false,
  dragDisabledReason: 'Finish the current key action before moving a Roto key.',
  rotoDragLocked: true,
};

const DOOR_TERMS: PhysicPaintGestureDoorTerms = {
  ok: false,
  error: 'Launch is missing the complete physical Roto document.',
  layerId: 'layer-2',
  startFrame: 4,
  activeTrackId: 'track-2',
  carriedCursorAppFrame: null,
  carriedRecordCount: -1,
};

const INSTALL_TERMS: PhysicPaintGestureInstallTerms = {
  activeTrackId: 'track-2',
  carriedTrackIds: ['track-1', 'track-2'],
  tracksCarryingPhysical: ['track-1'],
  activeDocumentInstalled: false,
};

const ARRIVAL = {
  surface: 'key-cell',
  keyId: 'key-1',
  appFrame: 3,
  railFirstFrame: null,
  pointerId: 7,
  button: 0,
  isPrimary: true,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
} as const;

const distinctStripTerms = (index: number): PhysicPaintGestureStripTerms => ({
  ...STRIP_TERMS,
  dragDisabledReason: `reason-${index}`,
});

beforeEach(() => {
  resetGestureRefusalCaptureForTesting();
  invoke.mockClear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-21T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetGestureRefusalCaptureForTesting();
});

describe('Physic Paint gesture refusal capture (quick-260921-qls)', () => {
  it('SHAPE: one strip refusal writes one capture carrying the timestamp, the name, the event count and all four term groups', async () => {
    vi.stubGlobal('window', {});

    reportGestureRefusal('strip-gate', { strip: STRIP_TERMS });
    await settleWrite();

    expect(invoke).toHaveBeenCalledTimes(1);
    const [command, args] = invoke.mock.calls[0];
    expect(command).toBe('write_debug_capture');
    expect(args.name).toBe(GESTURE_REFUSAL_CAPTURE_NAME);

    const capture = lastWrittenCapture();
    expect(capture.capturedAt).toBe(new Date().toISOString());
    expect(capture.captureName).toBe(GESTURE_REFUSAL_CAPTURE_NAME);
    expect(capture.eventCount).toBe(1);
    expect(capture.events).toHaveLength(1);
    expect(capture.events[0].reason).toBe('strip-gate');
    expect(Object.keys(capture.events[0].terms).sort()).toEqual(['door', 'install', 'pointerdown', 'strip']);
    expect(capture.events[0].terms.door).toBeNull();
    expect(capture.events[0].terms.install).toBeNull();
    expect(capture.events[0].terms.strip).toEqual(STRIP_TERMS);
    expect(capture.events[0].terms.pointerdown).toEqual({ arrived: false });
    expect(capture.arrivalSlot).toBeNull();
  });

  it('WRITTEN ON REFUSAL: every strip term is printed individually and verbatim', async () => {
    vi.stubGlobal('window', {});

    reportGestureRefusal('strip-gate', { strip: STRIP_TERMS });
    await settleWrite();

    const strip = lastWrittenCapture().events[0].terms.strip;
    expect(strip).not.toBeNull();
    expect(Object.keys(strip!).sort()).toEqual([
      'canDragKey',
      'dragDisabledReason',
      'dragPreviewPending',
      'hasPhysicalActions',
      'keyActionInFlight',
      'mutationLocked',
      'physicalDragAvailable',
      'ready',
      'rotoDragLocked',
      'sessionBusy',
    ]);
    expect(strip).toEqual({
      ready: true,
      mutationLocked: true,
      keyActionInFlight: false,
      sessionBusy: false,
      dragPreviewPending: false,
      hasPhysicalActions: true,
      physicalDragAvailable: true,
      canDragKey: false,
      dragDisabledReason: 'Finish the current key action before moving a Roto key.',
      rotoDragLocked: true,
    });
  });

  it('HEALTHY PATH: a refusal without a realm writes nothing, and an arrival alone never writes', async () => {
    // The node default: no window at all — the gate is closed before any IO.
    expect(gestureRefusalCaptureEnabled()).toBe(false);
    reportGestureRefusal('strip-gate', { strip: STRIP_TERMS });
    await settleWrite();
    expect(invoke).not.toHaveBeenCalled();

    vi.stubGlobal('window', {});
    expect(gestureRefusalCaptureEnabled()).toBe(true);
    recordGesturePointerArrival(ARRIVAL);
    await settleWrite();

    expect(invoke).not.toHaveBeenCalled();
    const snapshot = snapshotGestureRefusalCapture();
    expect(snapshot.events).toHaveLength(0);
    expect(snapshot.arrivalSlot).toEqual({ ...ARRIVAL, arrivedAt: new Date().toISOString() });

    // The arrival is in-memory context, never a write trigger on its own.
    reportGestureRefusal('strip-gate', { strip: STRIP_TERMS });
    await settleWrite();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(lastWrittenCapture().events[0].terms.pointerdown).toEqual({
      ...ARRIVAL,
      arrived: true,
      arrivedAt: new Date().toISOString(),
    });
  });

  it('DEDUPE: identical consecutive refusals write once, again past the window, and always on a term change', async () => {
    vi.stubGlobal('window', {});

    reportGestureRefusal('strip-gate', { strip: STRIP_TERMS });
    await settleWrite();
    reportGestureRefusal('strip-gate', { strip: STRIP_TERMS });
    await settleWrite();
    expect(invoke).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(GESTURE_REFUSAL_CAPTURE_DEDUPE_WINDOW_MS + 1);
    reportGestureRefusal('strip-gate', { strip: STRIP_TERMS });
    await settleWrite();
    expect(invoke).toHaveBeenCalledTimes(2);

    reportGestureRefusal('strip-gate', { strip: STRIP_TERMS });
    await settleWrite();
    expect(invoke).toHaveBeenCalledTimes(2);

    reportGestureRefusal('strip-gate', { strip: { ...STRIP_TERMS, dragPreviewPending: true } });
    await settleWrite();
    expect(invoke).toHaveBeenCalledTimes(3);
  });

  it('BOUNDED LOG: ten distinct refusals cap the log at eight, newest last, keeping the earlier launch-door event', async () => {
    vi.stubGlobal('window', {});

    const record = async (reason: 'launch-door' | 'strip-gate', terms: { door?: PhysicPaintGestureDoorTerms; strip?: PhysicPaintGestureStripTerms }): Promise<void> => {
      reportGestureRefusal(reason, terms);
      vi.advanceTimersByTime(GESTURE_REFUSAL_CAPTURE_DEDUPE_WINDOW_MS + 1);
      await settleWrite();
    };

    await record('strip-gate', { strip: distinctStripTerms(0) });
    await record('strip-gate', { strip: distinctStripTerms(1) });
    await record('launch-door', { door: DOOR_TERMS });
    for (let index = 2; index < 9; index += 1) {
      await record('strip-gate', { strip: distinctStripTerms(index) });
    }

    const snapshot = snapshotGestureRefusalCapture();
    expect(snapshot.events).toHaveLength(GESTURE_REFUSAL_CAPTURE_EVENT_CAP);

    const capture = lastWrittenCapture();
    expect(capture.events).toHaveLength(GESTURE_REFUSAL_CAPTURE_EVENT_CAP);
    expect(capture.eventCount).toBe(GESTURE_REFUSAL_CAPTURE_EVENT_CAP);
    expect(capture.events[0].reason).toBe('launch-door');
    expect(capture.events[0].terms.door).toEqual(DOOR_TERMS);
    expect(capture.events[capture.events.length - 1].terms.strip).toEqual(distinctStripTerms(8));
    expect(capture.events.map((event) => event.terms.strip?.dragDisabledReason)).toEqual([
      null,
      'reason-2',
      'reason-3',
      'reason-4',
      'reason-5',
      'reason-6',
      'reason-7',
      'reason-8',
    ]);
  });

  it('NEVER THROWS: a rejected write and an unimportable transport both leave the refusal report silent', async () => {
    vi.stubGlobal('window', {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    invoke.mockRejectedValueOnce(new Error('capture write refused'));

    expect(() => reportGestureRefusal('launch-install', { install: INSTALL_TERMS })).not.toThrow();
    await settleWrite();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();

    vi.resetModules();
    vi.doMock('@tauri-apps/api/core', () => {
      throw new Error('transport unavailable');
    });
    const reloaded = await import('./physicPaintGestureRefusalCapture');
    reloaded.resetGestureRefusalCaptureForTesting();
    expect(() => reloaded.reportGestureRefusal('strip-gate', { strip: STRIP_TERMS })).not.toThrow();
    await settleWrite();
  });

  it('SURFACE DESCRIPTION: the duck-typed reader classifies the rail, loop-rail and key-cell targets without a DOM', () => {
    const element = (closest: (selector: string) => unknown, attributes: Record<string, string>) => ({
      closest,
      getAttribute: (name: string) => attributes[name] ?? null,
    });

    const keyRail = element((selector) => (selector === '.physics-paint-key-rail-target' ? { tag: 'rail' } : null), {
      'data-rail-first-frame': '12',
    });
    expect(describeGestureSurface(keyRail)).toEqual({ surface: 'key-rail', keyId: null, appFrame: null, railFirstFrame: 12 });

    const loopRail = element((selector) => (selector === '.physics-paint-loop-clip-rail-target' ? { tag: 'loop' } : null), {
      'data-rail-first-frame': '4',
    });
    expect(describeGestureSurface(loopRail)).toEqual({ surface: 'loop-rail', keyId: null, appFrame: null, railFirstFrame: 4 });

    const keyCell = element((selector) => (selector === '[data-roto-app-frame]' ? { tag: 'cell' } : null), {
      'data-roto-app-frame': '3',
      'data-roto-key-id': 'key-1',
    });
    expect(describeGestureSurface(keyCell)).toEqual({ surface: 'key-cell', keyId: 'key-1', appFrame: 3, railFirstFrame: null });

    const lane = element(() => null, {});
    expect(describeGestureSurface(lane)).toEqual({ surface: 'lane', keyId: null, appFrame: null, railFirstFrame: null });
    expect(describeGestureSurface(null)).toEqual({ surface: 'other', keyId: null, appFrame: null, railFirstFrame: null });
  });
});
