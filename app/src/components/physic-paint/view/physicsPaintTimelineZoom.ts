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
 * revision, no cache key, no export surface. `resetForStudioOpen()` returns the
 * scale to 1 each time the Studio opens, so nothing leaks across documents.
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
  getFrameCount(): number;
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
 * D-04: the one-shot Fit scale — the whole frame range inside the viewport,
 * clamped into 0.25–4. A very long document can still overflow at the floor.
 */
export function resolveTimelineFitScale(frameCount: number, clientWidth: number): number {
  if (!Number.isFinite(frameCount) || frameCount <= 0) return 1;
  if (!Number.isFinite(clientWidth) || clientWidth <= 0) return 1;
  const raw = (clientWidth - TIMELINE_LANE_ORIGIN_PX) / (frameCount * TIMELINE_GEOMETRY.cellPitch);
  return clampTimelineZoomScale(raw);
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
  scrollPort = port;
}

// --- Store helpers -------------------------------------------------------

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

/** The single write path: scale + anchored scrollLeft, one call per input. */
function applyScale(nextScale: number, target: number | null): void {
  const clamped = clampTimelineZoomScale(nextScale);
  const current = scaleSignal.peek();
  if (Math.abs(clamped - current) <= TIMELINE_ZOOM_EPSILON) return;
  setScaleSignal(clamped);
  if (target !== null && scrollPort) scrollPort.setScrollLeft(target);
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

  /** D-04: a one-shot action — it never re-fits on a later resize. */
  fit(): void {
    const port = scrollPort;
    if (!port) return;
    const next = resolveTimelineFitScale(port.getFrameCount(), port.getClientWidth());
    if (Math.abs(next - scaleSignal.peek()) <= TIMELINE_ZOOM_EPSILON) return;
    const oldPitch = resolveTimelineMetrics(scaleSignal.peek()).pitch;
    const newPitch = resolveTimelineMetrics(next).pitch;
    const target = anchoredTarget(
      (scrollLeft, clientWidth, pitch) => resolvePlayheadAnchorLocalX(scrollLeft, clientWidth, port.getPlayheadFrame(), pitch),
      oldPitch,
      newPitch,
    );
    applyScale(next, target);
  },

  /** Studio open (and a view remount inside one document) always lands on 1x. */
  resetForStudioOpen(): void {
    setScaleSignal(1);
  },
};
