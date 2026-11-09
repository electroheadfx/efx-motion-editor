import { computed, signal } from '@preact/signals';
import { TIMELINE_GEOMETRY } from './timelineRailDesign';

/**
 * Phase 60 (ZOOM-01..05): the Studio timeline's ONE session-only pitch
 * authority.
 *
 * Everything horizontal about the timeline derives from here: the pitch, the
 * cell width, the cell gap, the adaptive ruler step, the anchored scroll write
 * and the header pill's percent. 100% is the base 18px pitch; the ladder runs
 * 0.25x to 4x.
 *
 * The view metrics never enter the document: no `.mce` field, no schema, no
 * revision, no cache key, no export surface. `resetForStudioOpen(layerId)`
 * restores that paint layer's remembered density (a localStorage UI preference,
 * because closing the Studio destroys its webview) and defaults to 1, so no
 * document or other layer ever inherits this one's zoom.
 *
 * Only HORIZONTAL geometry scales. Row height, lane height, cell height, the
 * ruler band and the header column are fixed and deliberately absent from
 * `TimelineMetrics`.
 */

/** The locked ladder (D-02/D-06). 1 = the base 18px pitch. */
export const TIMELINE_ZOOM_PRESETS: readonly number[] = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
export const TIMELINE_ZOOM_MIN = 0.25;
export const TIMELINE_ZOOM_MAX = 4;

/** A step smaller than this is a no-op, never an overshoot (D-08). */
export const TIMELINE_ZOOM_EPSILON = 0.001;

/** The scroller's content gutter (`padding-left: 6px`) — the lane origin. */
export const TIMELINE_LANE_ORIGIN_PX = 6;

/** D-09: a ruler tick must leave at least this much horizontal room. */
export const TIMELINE_RULER_MIN_TICK_PX = 40;
/** D-10: the ruler only ever coarsens; it never subdivides below this step. */
export const TIMELINE_RULER_MIN_STEP = 3;

/**
 * The horizontal metrics every consumer reads. Exactly four numbers: there is
 * deliberately no row/lane/header/ruler-band height field.
 */
export interface TimelineMetrics {
  readonly scale: number;
  readonly cellWidth: number;
  readonly cellGap: number;
  readonly pitch: number;
}

/**
 * The scroll port the anchored writes drive. `getScrollerLeft` is the
 * scroller's CLIENT-SPACE left edge, so a wheel `clientX` becomes a lane-local
 * x inside this module instead of at the call site.
 */
export interface TimelineZoomScrollPort {
  getScrollLeft(): number;
  getScrollerLeft(): number;
  getClientWidth(): number;
  setScrollLeft(value: number): void;
  getPlayheadFrame(): number;
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function positiveOr(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function clampTimelineZoomScale(scale: number): number {
  if (!Number.isFinite(scale)) return TIMELINE_ZOOM_MIN;
  return Math.min(TIMELINE_ZOOM_MAX, Math.max(TIMELINE_ZOOM_MIN, scale));
}

export function resolveTimelineMetrics(scale: number): TimelineMetrics {
  const clamped = clampTimelineZoomScale(scale);
  return {
    scale: clamped,
    cellWidth: TIMELINE_GEOMETRY.cellWidth * clamped,
    cellGap: TIMELINE_GEOMETRY.cellGap * clamped,
    pitch: TIMELINE_GEOMETRY.cellPitch * clamped,
  };
}

/**
 * D-09/D-10: the smallest multiple of TIMELINE_RULER_MIN_STEP whose tick leaves
 * at least TIMELINE_RULER_MIN_TICK_PX. Never subdivides below the minimum step,
 * so the ruler only ever coarsens as the pitch shrinks. At 1x this returns 3
 * and the tick stays 54px — today's ruler is byte-identical.
 */
export function resolveRulerStep(pitch: number): number {
  if (!Number.isFinite(pitch) || pitch <= 0) return TIMELINE_RULER_MIN_STEP;
  const multiples = Math.ceil(TIMELINE_RULER_MIN_TICK_PX / (TIMELINE_RULER_MIN_STEP * pitch));
  let step = TIMELINE_RULER_MIN_STEP * Math.max(1, finiteOr(multiples, 1));
  // Float-rounding backstop: the tick must reach the floor, but never subdivide.
  if (step * pitch < TIMELINE_RULER_MIN_TICK_PX) step += TIMELINE_RULER_MIN_STEP;
  return step;
}

/** The wheel cursor's lane-local x: clientX minus the scroller edge minus the gutter. */
export function resolveCursorAnchorLocalX(clientX: number, scrollerLeft: number): number {
  return finiteOr(clientX, 0) - finiteOr(scrollerLeft, 0) - TIMELINE_LANE_ORIGIN_PX;
}

/**
 * The playhead centre's offset from the scroll viewport's left edge, or the
 * viewport centre when the playhead is offscreen (the locked anchoring law).
 */
export function resolvePlayheadAnchorLocalX(
  scrollLeft: number,
  clientWidth: number,
  playheadFrame: number,
  pitch: number,
): number {
  const scroll = finiteOr(scrollLeft, 0);
  const width = finiteOr(clientWidth, 0);
  const frame = finiteOr(playheadFrame, 0);
  const resolvedPitch = positiveOr(pitch, TIMELINE_GEOMETRY.cellPitch);
  const centre = frame * resolvedPitch + resolvedPitch / 2 - 1 - scroll;
  return centre >= 0 && centre <= width ? centre : width / 2;
}

/**
 * The ONE anchored-scroll law: hold `(scrollLeft + localX) / pitch` fixed
 * through the scale change, so the frame under the cursor (or the playhead)
 * keeps its on-screen x.
 */
export function resolveAnchoredScrollLeft(
  scrollLeft: number,
  localX: number,
  oldPitch: number,
  newPitch: number,
): number {
  const scroll = finiteOr(scrollLeft, 0);
  const local = finiteOr(localX, 0);
  const oldPitchResolved = positiveOr(oldPitch, TIMELINE_GEOMETRY.cellPitch);
  const newPitchResolved = positiveOr(newPitch, oldPitchResolved);
  return ((scroll + local) / oldPitchResolved) * newPitchResolved - local;
}

/** Content-space x of a frame's left edge (includes the 6px gutter). */
export function frameToPx(frame: number, pitch: number): number {
  return TIMELINE_LANE_ORIGIN_PX + finiteOr(frame, 0) * positiveOr(pitch, TIMELINE_GEOMETRY.cellPitch);
}

/** The frame under a client-space x, through the gutter and the scroll offset. */
export function pxToFrame(clientX: number, scrollerLeft: number, scrollLeft: number, pitch: number): number {
  const resolvedPitch = positiveOr(pitch, TIMELINE_GEOMETRY.cellPitch);
  const contentX = finiteOr(clientX, 0) - finiteOr(scrollerLeft, 0) - TIMELINE_LANE_ORIGIN_PX + finiteOr(scrollLeft, 0);
  return Math.floor(contentX / resolvedPitch);
}

/** The visible frame window (the Studio audio modal's "Fit to view" reads it). */
export function resolveTimelineViewportFrames(
  scrollLeft: number,
  clientWidth: number,
  pitch: number,
): { visStart: number; visEnd: number } | null {
  if (!Number.isFinite(pitch) || pitch <= 0) return null;
  const scroll = finiteOr(scrollLeft, 0);
  const width = finiteOr(clientWidth, 0);
  return { visStart: scroll / pitch, visEnd: (scroll + width) / pitch };
}

/**
 * D-06: the first ladder value strictly beyond `current` (direction 1 = in,
 * -1 = out). The current value is never rounded into a preset first, so 1.37
 * steps up to 1.5 and down to 1. A boundary step returns the clamped current
 * value — a no-op the callers compare against, never an overshoot.
 */
export function nextTimelineZoomPreset(current: number, direction: 1 | -1): number {
  if (!Number.isFinite(current)) return current;
  const clamped = clampTimelineZoomScale(current);
  if (direction > 0) {
    for (const preset of TIMELINE_ZOOM_PRESETS) {
      if (preset > clamped + TIMELINE_ZOOM_EPSILON) return preset;
    }
    return clamped;
  }
  for (let index = TIMELINE_ZOOM_PRESETS.length - 1; index >= 0; index -= 1) {
    const preset = TIMELINE_ZOOM_PRESETS[index];
    if (preset < clamped - TIMELINE_ZOOM_EPSILON) return preset;
  }
  return clamped;
}

/**
 * D-05: continuous exponential wheel scaling, roughly x1.1 per 100px. Line-mode
 * wheels (Firefox) normalize at 16px per line, matching the existing plain-wheel
 * branch. A non-finite delta or result leaves the current scale untouched; the
 * result is clamped into range and NEVER snaps to a preset.
 */
export function nextTimelineZoomWheelScale(current: number, deltaY: number, deltaMode: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(deltaY)) return current;
  const normalized = deltaMode === 1 ? deltaY * 16 : deltaY;
  if (!Number.isFinite(normalized)) return current;
  const next = current * Math.exp(-normalized * 0.001);
  if (!Number.isFinite(next)) return current;
  return clampTimelineZoomScale(next);
}

/** D-03: the display-only readout — a rounded integer percent. */
export function resolveTimelineZoomPercent(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return 0;
  return Math.round(scale * 100);
}

// --- Signals -------------------------------------------------------------

const scaleSignal = signal(1);
const metricsSignal = computed(() => resolveTimelineMetrics(scaleSignal.value));
const percentSignal = computed(() => resolveTimelineZoomPercent(scaleSignal.value));
const isAtMinSignal = computed(() => scaleSignal.value <= TIMELINE_ZOOM_MIN + TIMELINE_ZOOM_EPSILON);
const isAtMaxSignal = computed(() => scaleSignal.value >= TIMELINE_ZOOM_MAX - TIMELINE_ZOOM_EPSILON);

let scrollPort: TimelineZoomScrollPort | null = null;

export function registerTimelineZoomScrollPort(port: TimelineZoomScrollPort | null): void {
  // Unregistering (unmount) drops any queued write — it would target a dead scroller.
  if (port === null) discardPendingScroll();
  scrollPort = port;
}

// --- Store helpers -------------------------------------------------------

/**
 * UAT 2026-11-09: the density is remembered PER PAINT LAYER, so closing and
 * reopening a layer returns to the zoom the artist left it at.
 *
 * localStorage, not module state — closing the Studio DESTROYS its window and
 * reopening BUILDS a new webview, so a module-level map would be wiped every
 * time (the same constraint `components/shared/activeModule.ts` records). This
 * is a UI preference only: it never reaches the document, .mce, schema,
 * revision, cache or export surface.
 */
const SCALE_BY_LAYER_STORAGE_KEY = 'efx-timeline-zoom-by-layer';
const MAX_REMEMBERED_LAYERS = 64;

function readStoredScales(): Map<string, number> {
  const out = new Map<string, number>();
  try {
    const raw = localStorage.getItem(SCALE_BY_LAYER_STORAGE_KEY);
    if (!raw) return out;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return out;
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value)) out.set(id, clampTimelineZoomScale(value));
    }
  } catch {
    // Storage can be unavailable (private mode) or hold a stale shape — the
    // in-memory map still works for this webview.
  }
  return out;
}

/**
 * The window is RECENCY-ordered, not first-seen: a layer touched again is
 * re-inserted at the end, so the cap evicts the least recently used layer
 * rather than the one zoomed longest ago. Without the touch, an actively used
 * layer would silently revert to 1x after the next close/reopen.
 */
function rememberScale(layerId: string, scale: number): void {
  scaleByLayer.delete(layerId);
  scaleByLayer.set(layerId, scale);
  while (scaleByLayer.size > MAX_REMEMBERED_LAYERS) {
    const oldest = scaleByLayer.keys().next();
    if (oldest.done) break;
    scaleByLayer.delete(oldest.value);
  }
}

function writeStoredScales(): void {
  try {
    localStorage.setItem(SCALE_BY_LAYER_STORAGE_KEY, JSON.stringify(Object.fromEntries(scaleByLayer)));
  } catch {
    // Storage can be unavailable — persistence degrades, nothing else does.
  }
}

const scaleByLayer = readStoredScales();
let activeLayerId: string | null = null;

/**
 * Compare-then-write: identical values and anything inside TIMELINE_ZOOM_EPSILON
 * of the current scale write nothing, so a no-op wheel tick causes no re-render
 * (D-08, reactivity rule 3).
 */
function setScaleSignal(next: number): boolean {
  const clamped = clampTimelineZoomScale(next);
  const current = scaleSignal.peek();
  if (Object.is(current, clamped)) return false;
  if (Math.abs(clamped - current) <= TIMELINE_ZOOM_EPSILON) return false;
  scaleSignal.value = clamped;
  if (activeLayerId !== null && scaleByLayer.get(activeLayerId) !== clamped) {
    rememberScale(activeLayerId, clamped);
    writeStoredScales();
  }
  return true;
}

/** The anchored scroll target for a step, or null when no port is registered. */
function anchoredTarget(resolveLocalX: (scrollLeft: number, clientWidth: number, pitch: number) => number, oldPitch: number, newPitch: number): number | null {
  const port = scrollPort;
  if (!port) return null;
  const scrollLeft = port.getScrollLeft();
  const clientWidth = port.getClientWidth();
  const localX = resolveLocalX(scrollLeft, clientWidth, oldPitch);
  // Clamp at 0 so a negative target never reaches the DOM.
  return Math.max(0, resolveAnchoredScrollLeft(scrollLeft, localX, oldPitch, newPitch));
}

/**
 * The anchored scroll write lands one frame AFTER the scale signal: Preact
 * commits the render on a microtask, and the browser clamps `scrollLeft` to
 * the scrollWidth it sees at write time. Written in the same task the target
 * is clamped against the PRE-zoom lane extent, so an anchor near the right
 * edge silently slides on every zoom-in. Writing after the render lets layout
 * reflect the new extent first.
 */
let pendingScrollFrame: ReturnType<typeof setTimeout> | null = null;
let pendingScrollTarget: number | null = null;

function cancelPendingScrollFrame(): void {
  if (pendingScrollFrame === null) return;
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(pendingScrollFrame as unknown as number);
  else clearTimeout(pendingScrollFrame);
  pendingScrollFrame = null;
}

function discardPendingScroll(): void {
  cancelPendingScrollFrame();
  pendingScrollTarget = null;
}

function commitAnchoredScroll(target: number): void {
  // Coalesce: the newest target wins, one write per frame.
  pendingScrollTarget = target;
  if (pendingScrollFrame !== null) return;
  const flush = () => {
    pendingScrollFrame = null;
    const next = pendingScrollTarget;
    pendingScrollTarget = null;
    if (next !== null && scrollPort) scrollPort.setScrollLeft(next);
  };
  pendingScrollFrame = typeof requestAnimationFrame === 'function'
    ? (requestAnimationFrame(flush) as unknown as ReturnType<typeof setTimeout>)
    : setTimeout(flush, 0);
}

/** The single write path: scale + anchored scrollLeft, one call per input. */
function applyScale(nextScale: number, target: number | null): void {
  const clamped = clampTimelineZoomScale(nextScale);
  const current = scaleSignal.peek();
  if (Math.abs(clamped - current) <= TIMELINE_ZOOM_EPSILON) return;
  setScaleSignal(clamped);
  if (target !== null && scrollPort) commitAnchoredScroll(target);
}

function stepPreset(direction: 1 | -1): void {
  const current = scaleSignal.peek();
  const next = nextTimelineZoomPreset(current, direction);
  if (Math.abs(next - current) <= TIMELINE_ZOOM_EPSILON) return;
  const oldPitch = resolveTimelineMetrics(current).pitch;
  const newPitch = resolveTimelineMetrics(next).pitch;
  const port = scrollPort;
  const target = port
    ? anchoredTarget(
        (scrollLeft, clientWidth, pitch) => resolvePlayheadAnchorLocalX(scrollLeft, clientWidth, port.getPlayheadFrame(), pitch),
        oldPitch,
        newPitch,
      )
    : null;
  applyScale(next, target);
}

// --- Store ---------------------------------------------------------------

/**
 * The session-only timeline zoom store. Every action reads its peers with
 * `.peek()` so no action ever creates a subscription; only render bodies and
 * narrow leaves subscribe.
 */
export const timelineZoom = {
  scale: scaleSignal,
  metrics: metricsSignal,
  percent: percentSignal,
  isAtMin: isAtMinSignal,
  isAtMax: isAtMaxSignal,

  setScale(next: number): void {
    setScaleSignal(next);
  },

  /** ZOOM-01: Cmd/Ctrl+wheel — keep the frame under the cursor fixed. */
  setScaleAtCursor(nextScale: number, clientX: number): void {
    const clamped = clampTimelineZoomScale(nextScale);
    const current = scaleSignal.peek();
    if (Math.abs(clamped - current) <= TIMELINE_ZOOM_EPSILON) return;
    const oldPitch = resolveTimelineMetrics(current).pitch;
    const newPitch = resolveTimelineMetrics(clamped).pitch;
    const port = scrollPort;
    let target: number | null = null;
    if (port) {
      const localX = resolveCursorAnchorLocalX(clientX, port.getScrollerLeft());
      target = Math.max(0, resolveAnchoredScrollLeft(port.getScrollLeft(), localX, oldPitch, newPitch));
    }
    applyScale(clamped, target);
  },

  zoomIn(): void {
    stepPreset(1);
  },

  zoomOut(): void {
    stepPreset(-1);
  },

  /**
   * UAT 2026-11-09: the pill's fourth control is a 100% reset, not a Fit — it
   * returns the timeline to the base density, anchored on the playhead centre
   * like minus/plus so the playhead stays in view.
   */
  resetTo100(): void {
    const current = scaleSignal.peek();
    if (Math.abs(1 - current) <= TIMELINE_ZOOM_EPSILON) return;
    const oldPitch = resolveTimelineMetrics(current).pitch;
    const newPitch = resolveTimelineMetrics(1).pitch;
    const port = scrollPort;
    const target = port
      ? anchoredTarget(
          (scrollLeft, clientWidth, pitch) => resolvePlayheadAnchorLocalX(scrollLeft, clientWidth, port.getPlayheadFrame(), pitch),
          oldPitch,
          newPitch,
        )
      : null;
    applyScale(1, target);
  },

  /**
   * Studio open (and a view remount inside one document). With a layer id the
   * store restores that layer's remembered density (UAT 2026-11-09); without
   * one it lands on 1x, which is also the first-open default.
   */
  resetForStudioOpen(layerId?: string | null): void {
    // A queued anchored write from the outgoing session must never land on the
    // incoming view.
    discardPendingScroll();
    const remembered = layerId == null ? undefined : scaleByLayer.get(layerId);
    // Restore before adopting the layer id: opening a layer must never RECORD
    // the restored value as a fresh touch, or every first open would consume a
    // slot in the recency window.
    activeLayerId = null;
    setScaleSignal(remembered ?? 1);
    activeLayerId = layerId ?? null;
  },
};
