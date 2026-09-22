/**
 * Physic Paint gesture-refusal capture (quick-260921-qls).
 *
 * The in-process diagnosis (quick-260921-pgd) eliminated every reachable
 * mechanism for the layer-2 gesture lock and ruled STRUCTURAL: the surviving
 * half is behind the DOM wall, so the answer has to come from a live run. Its
 * handoff asked for a console copy; the project rule is that the app writes the
 * capture to /tmp and the diagnosis reads it from disk. This module is that
 * writer — the single owner of the payload shape, the DEV gate, the rolling
 * pointerdown-arrival slot, the dedupe, the bounded event log and the write.
 *
 * Three probe points feed it (one per surviving link):
 *   - `launch-door`    — the launch adoption door swallowed the whole launch;
 *   - `launch-install` — the install loop found no physical document on the
 *                        carried active track;
 *   - `strip-gate`     — the strip refused the gesture (one of the five busy
 *                        terms, or the drag-availability controller).
 *
 * Diagnostic only: no production behaviour, no new transport, no new Tauri
 * command. The write reuses the pre-existing `write_debug_capture` command with
 * `name: 'pgd-gesture'`, which lands at `/tmp/efx-stall-capture-pgd-gesture.json`
 * (`app/src-tauri/src/commands/debug_capture.rs` — untouched).
 *
 * Silence when healthy is a contract, not a nicety: nothing is written per
 * frame, nothing from a render body, nothing on a signal read, and nothing at
 * all when the gesture works. The whole module is wrapped so it can never throw
 * into a pointerdown handler or into launch hydration.
 */

export const GESTURE_REFUSAL_CAPTURE_NAME = 'pgd-gesture';

/** Bounded so a gesture loop can never grow the payload without limit. */
export const GESTURE_REFUSAL_CAPTURE_EVENT_CAP = 8;

/** Consecutive identical refusals inside this window collapse to one write. */
export const GESTURE_REFUSAL_CAPTURE_DEDUPE_WINDOW_MS = 1500;

export type PhysicPaintGestureRefusalReason =
  | 'launch-door'
  | 'launch-install'
  | 'strip-gate'
  | 'nav-no-key'
  | 'cell-click-locked'
  | 'nav-scrub-swallow'
  | 'nav-refused'
  | 'nav-threw';

export type PhysicPaintGestureSurfaceKind = 'key-cell' | 'key-rail' | 'loop-rail' | 'lane' | 'other';

export interface PhysicPaintGestureSurfaceDescription {
  surface: PhysicPaintGestureSurfaceKind;
  keyId: string | null;
  appFrame: number | null;
  railFirstFrame: number | null;
}

export interface PhysicPaintGesturePointerArrival {
  surface: PhysicPaintGestureSurfaceKind;
  keyId: string | null;
  appFrame: number | null;
  railFirstFrame: number | null;
  pointerId: number;
  button: number;
  isPrimary: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  arrivedAt: string;
}

export interface PhysicPaintGestureDoorTerms {
  ok: boolean;
  error: string | null;
  layerId: string | null;
  startFrame: number | null;
  activeTrackId: string | null;
  carriedCursorAppFrame: number | null;
  carriedRecordCount: number;
}

export interface PhysicPaintGestureInstallTerms {
  activeTrackId: string | null;
  carriedTrackIds: string[];
  tracksCarryingPhysical: string[];
  activeDocumentInstalled: boolean;
}

export interface PhysicPaintGestureStripTerms {
  ready: boolean;
  mutationLocked: boolean;
  keyActionInFlight: boolean;
  sessionBusy: boolean;
  dragPreviewPending: boolean;
  hasPhysicalActions: boolean;
  physicalDragAvailable: boolean;
  canDragKey: boolean | null;
  dragDisabledReason: string | null;
  rotoDragLocked: boolean;
  /**
   * The armed Push tool owns the lane while armed: it stops the cell/rail
   * pointerdown handlers and swallows lane clicks. A refusal reported while
   * `pushArmed` is true is that ownership, not a selection problem.
   */
  pushArmed: boolean;
}

/**
 * One navigation attempt as the STUDIO saw it — the side of the chain the strip
 * cannot observe. `nav-scrub-swallow` is the scrub-armed early return;
 * `nav-refused` is a navigation that settled false (the script controller's
 * `prepareNavigation` gate or a superseded/invalid destination); `nav-threw` is
 * an unhandled rejection that would otherwise only reach the console.
 */
export interface PhysicPaintGestureNavAttemptTerms {
  frame: number;
  layerId: string | null;
  trackId: string;
  railModelKeyId: string | null;
  railModelCount: number;
  pushArmed: boolean;
  detail: string | null;
}

/**
 * The selection side of a strip refusal. `primarySelectedKeyId` is the REAL-KEY
 * selection `canDragKey` reads; `selectedKeyRailFirstKeyId` is the separate
 * rail-level highlight a plain click paints. A refusal that shows the rail
 * highlighted while the primary is null is the "clicked a key, it highlighted,
 * yet nothing is draggable" shape — the two are different selections.
 */
export interface PhysicPaintGestureSelectionTerms {
  layerId: string | null;
  activeTrackId: string | null;
  primarySelectedKeyId: string | null;
  selectedKeyRailFirstKeyId: string | null;
  selectedKeyIdCount: number;
  keyRecordsOnRail: number;
  railSegmentFirstKeyId: string | null;
  railSegmentKeyCount: number;
}

/**
 * A navigation that selected nothing on a frame whose key the rail model DOES
 * carry. That pairing is a contradiction, not a plain empty-frame navigation:
 * the rail shows a key at `frame`, yet the store lookup resolved none — the two
 * reads disagree about either the track or the frame space.
 */
export interface PhysicPaintGestureNavTerms {
  frame: number;
  layerId: string | null;
  trackId: string;
  launchTrackId: string;
  railModelKeyId: string;
  railModelCount: number;
  railModelKeyFrames: number[];
}

export interface PhysicPaintGestureRefusalTerms {
  door?: PhysicPaintGestureDoorTerms;
  install?: PhysicPaintGestureInstallTerms;
  strip?: PhysicPaintGestureStripTerms;
  selection?: PhysicPaintGestureSelectionTerms;
  nav?: PhysicPaintGestureNavTerms;
  attempt?: PhysicPaintGestureNavAttemptTerms;
}

export interface PhysicPaintGestureRefusalEvent {
  capturedAt: string;
  reason: PhysicPaintGestureRefusalReason;
  terms: {
    door: PhysicPaintGestureDoorTerms | null;
    install: PhysicPaintGestureInstallTerms | null;
    strip: PhysicPaintGestureStripTerms | null;
    selection: PhysicPaintGestureSelectionTerms | null;
    nav: PhysicPaintGestureNavTerms | null;
    attempt: PhysicPaintGestureNavAttemptTerms | null;
    pointerdown: (PhysicPaintGesturePointerArrival & { arrived: true }) | { arrived: false };
  };
}

export interface PhysicPaintGestureRefusalCapture {
  capturedAt: string;
  captureName: string;
  eventCount: number;
  events: PhysicPaintGestureRefusalEvent[];
  arrivalSlot: PhysicPaintGesturePointerArrival | null;
}

const events: PhysicPaintGestureRefusalEvent[] = [];
let arrivalSlot: PhysicPaintGesturePointerArrival | null = null;
let lastWriteSignature: string | null = null;
let lastWriteAtMs = Number.NEGATIVE_INFINITY;

/**
 * The `profilingEnabled()` idiom (physicsPaintPerformanceTrace.ts:99-106),
 * verbatim in spirit: a realm plus a DEV build. No localStorage flag — the
 * probe must be live whenever a dev build runs, and in a packaged build the
 * gate is false so no diagnostic IO can fire at all.
 */
export function gestureRefusalCaptureEnabled(): boolean {
  return typeof window !== 'undefined' && import.meta.env.DEV;
}

interface DuckTypedElement {
  closest?: (selector: string) => unknown;
  getAttribute?: (name: string) => unknown;
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

/** Duck-typed so the node test (no DOM) exercises the same reader as the app. */
function findClosest(target: object, selector: string): object | null {
  const candidate = target as DuckTypedElement;
  if (typeof candidate.closest !== 'function') return null;
  try {
    const found = candidate.closest(selector);
    return isObject(found) ? found : null;
  } catch {
    return null;
  }
}

function readAttribute(target: object, name: string): string | null {
  const candidate = target as DuckTypedElement;
  if (typeof candidate.getAttribute !== 'function') return null;
  try {
    const value = candidate.getAttribute(name);
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

function readIntegerAttribute(target: object, name: string): number | null {
  const raw = readAttribute(target, name);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isInteger(value) ? value : null;
}

/**
 * Classify the pointerdown target the way the strip does: the key rail and the
 * loop rail are matched by their own class hooks, the cell by its frame
 * attribute. No `Element` / `instanceof` — the same reader must run in the node
 * test environment and in the WKWebView, and the caller always passes
 * `event.target`.
 */
export function describeGestureSurface(target: unknown): PhysicPaintGestureSurfaceDescription {
  const description: PhysicPaintGestureSurfaceDescription = {
    surface: 'other',
    keyId: null,
    appFrame: null,
    railFirstFrame: null,
  };
  if (!isObject(target)) return description;

  const keyRail = findClosest(target, '.physics-paint-key-rail-target');
  if (keyRail) {
    description.surface = 'key-rail';
    description.railFirstFrame = readIntegerAttribute(keyRail, 'data-rail-first-frame');
    return description;
  }

  const loopRail = findClosest(target, '.physics-paint-loop-clip-rail-target');
  if (loopRail) {
    description.surface = 'loop-rail';
    description.railFirstFrame = readIntegerAttribute(loopRail, 'data-rail-first-frame');
    return description;
  }

  const keyCell = findClosest(target, '[data-roto-app-frame]');
  if (keyCell) {
    description.surface = 'key-cell';
    description.appFrame = readIntegerAttribute(keyCell, 'data-roto-app-frame');
    description.keyId = readAttribute(keyCell, 'data-roto-key-id');
    return description;
  }

  description.surface = 'lane';
  return description;
}

function cloneEvent(event: PhysicPaintGestureRefusalEvent): PhysicPaintGestureRefusalEvent {
  return {
    capturedAt: event.capturedAt,
    reason: event.reason,
    terms: {
      door: event.terms.door ? { ...event.terms.door } : null,
      install: event.terms.install
        ? {
            ...event.terms.install,
            carriedTrackIds: [...event.terms.install.carriedTrackIds],
            tracksCarryingPhysical: [...event.terms.install.tracksCarryingPhysical],
          }
        : null,
      strip: event.terms.strip ? { ...event.terms.strip } : null,
      selection: event.terms.selection ? { ...event.terms.selection } : null,
      nav: event.terms.nav ? { ...event.terms.nav, railModelKeyFrames: [...event.terms.nav.railModelKeyFrames] } : null,
      attempt: event.terms.attempt ? { ...event.terms.attempt } : null,
      pointerdown: { ...event.terms.pointerdown },
    },
  };
}

export function snapshotGestureRefusalCapture(): PhysicPaintGestureRefusalCapture {
  return {
    capturedAt: new Date().toISOString(),
    captureName: GESTURE_REFUSAL_CAPTURE_NAME,
    eventCount: events.length,
    events: events.map(cloneEvent),
    arrivalSlot: arrivalSlot ? { ...arrivalSlot } : null,
  };
}

/**
 * The write, copied from `dumpPhysicsPaintStallDiagnostics`
 * (physicsPaintPerformanceTrace.ts:512-527): dynamic import, fire-and-forget,
 * and a failure that returns null and warns instead of propagating.
 */
async function writeGestureRefusalCapture(): Promise<string | null> {
  if (!gestureRefusalCaptureEnabled()) return null;
  const capture = snapshotGestureRefusalCapture();
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const path = await invoke<string>('write_debug_capture', {
      contents: JSON.stringify(capture),
      name: GESTURE_REFUSAL_CAPTURE_NAME,
    });
    return path;
  } catch (error) {
    console.warn('[efx-pgd] gesture refusal capture write failed', error);
    return null;
  }
}

/**
 * The arrival record — the only way to tell "the pointerdown never reached the
 * active lane" apart from "it arrived and nothing refused". In-memory only: it
 * is never a write trigger on its own, and a healthy gesture leaves it recorded
 * with nothing on disk.
 */
export function recordGesturePointerArrival(
  arrival: Omit<PhysicPaintGesturePointerArrival, 'arrivedAt'>,
): void {
  if (!gestureRefusalCaptureEnabled()) return;
  try {
    arrivalSlot = { ...arrival, arrivedAt: new Date().toISOString() };
  } catch {
    // A diagnostic never throws into the pointerdown handler.
  }
}

/**
 * The dedupe key: the reason plus every term group, with the arrival timestamp
 * and the event timestamp excluded, so an unchanged lock writing twice in a row
 * is one write and any term change is always a new one.
 */
function refusalSignature(reason: PhysicPaintGestureRefusalReason, terms: PhysicPaintGestureRefusalTerms): string {
  const pointerdown = arrivalSlot === null
    ? { arrived: false }
    : { ...arrivalSlot, arrived: true, arrivedAt: undefined };
  return JSON.stringify({
    reason,
    terms: {
      door: terms.door ?? null,
      install: terms.install ?? null,
      strip: terms.strip ?? null,
      selection: terms.selection ?? null,
      nav: terms.nav ?? null,
      attempt: terms.attempt ?? null,
      pointerdown,
    },
  });
}

/**
 * Report one refused gesture. Appends to the bounded log, then writes unless the
 * refusal repeats the previous signature inside the dedupe window. Fire and
 * forget: the caller (a pointerdown handler, or launch hydration) is never
 * awaited on and never receives a throw.
 */
export function reportGestureRefusal(
  reason: PhysicPaintGestureRefusalReason,
  terms: PhysicPaintGestureRefusalTerms = {},
): void {
  if (!gestureRefusalCaptureEnabled()) return;
  try {
    events.push({
      capturedAt: new Date().toISOString(),
      reason,
      terms: {
        door: terms.door ?? null,
        install: terms.install ?? null,
        strip: terms.strip ?? null,
        selection: terms.selection ?? null,
        nav: terms.nav ?? null,
        attempt: terms.attempt ?? null,
        pointerdown: arrivalSlot ? { ...arrivalSlot, arrived: true } : { arrived: false },
      },
    });
    while (events.length > GESTURE_REFUSAL_CAPTURE_EVENT_CAP) events.shift();

    const signature = refusalSignature(reason, terms);
    const nowMs = Date.now();
    if (signature === lastWriteSignature && nowMs - lastWriteAtMs < GESTURE_REFUSAL_CAPTURE_DEDUPE_WINDOW_MS) return;
    lastWriteSignature = signature;
    lastWriteAtMs = nowMs;
    void writeGestureRefusalCapture();
  } catch {
    // A diagnostic never throws into the gesture path.
  }
}

/** The manual DEV dump of the current state (same payload, same path). */
export async function dumpGestureRefusalCapture(): Promise<string | null> {
  try {
    return await writeGestureRefusalCapture();
  } catch {
    return null;
  }
}

export function resetGestureRefusalCaptureForTesting(): void {
  events.length = 0;
  arrivalSlot = null;
  lastWriteSignature = null;
  lastWriteAtMs = Number.NEGATIVE_INFINITY;
}

/**
 * DEV-only manual hook (the `__EFX_PHYSICS_PAINT_PROFILE__` precedent,
 * physicsPaintPerformanceTrace.ts:529-543). Justified because it is the only
 * way a live run can positively show the undecidable half — "the pointerdown
 * never arrived" — when nothing is refused and therefore nothing is written.
 */
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  Object.defineProperty(window, '__EFX_PGD_GESTURE__', {
    configurable: true,
    value: {
      dump: dumpGestureRefusalCapture,
      reset: resetGestureRefusalCaptureForTesting,
      snapshot: snapshotGestureRefusalCapture,
    },
  });
}

declare global {
  interface Window {
    __EFX_PGD_GESTURE__?: {
      dump: () => Promise<string | null>;
      reset: () => void;
      snapshot: () => PhysicPaintGestureRefusalCapture;
    };
  }
}
