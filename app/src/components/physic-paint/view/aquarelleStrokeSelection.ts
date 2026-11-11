// ============================================================
//  aquarelleStrokeSelection — Water color stroke select mode
//  (quick 261022-pim Task 1).
//
//  Select mode is the rail Move/Select toggle or the A Move/Edit toggle.
//  While active the overlay above the vendor canvas outlines every
//  recorded stroke of the CURRENT edit frame, and a click selects
//  the newest stroke under the pointer. Selection is written in the
//  pointer handler — never an effect (efx-preact-reactivity).
//
//  Coordinates cross from document UV to canvas pixels through
//  aquarelleUvToEnginePixel (the ONE bridge) so an outlined
//  stroke and the delete target can never disagree.
//
//  Signals are read only by narrow leaves (the overlay and the
//  rail toggle), never the Studio render body.
// ============================================================

import { computed, signal } from '@preact/signals';
import {
  NEUTRAL_TOOL_OVERRIDES,
  TOOL_OVERRIDE_FIELDS,
  type AquarelleToolOverrides,
} from '@efxlab/efx-watercolor/brushes';
import {
  isAquarelleDryEvent,
  type AquarelleAnchor,
  type AquarelleCurveMode,
  type AquarellePayloadEvent,
  type AquarelleStroke,
  type AquarelleStrokePayload,
  type AquarelleTool,
} from '@efxlab/efx-watercolor/payload';
import {
  aquarelleUvToEnginePixel,
  type EnginePixelSize,
} from '../engine/aquarelleStrokeBridge';
import {
  MIN_STROKE_PAD_PX,
  clearScriptStrokeDrag,
  decimateScriptPoints,
  hitsScriptStroke,
  scriptSelectedStrokeId,
  scriptSelectedStrokeIds,
  scriptSelectMode,
  scriptStrokeBoundsPx,
  scriptStrokeDrag,
  selectScriptStroke,
  setDraftMode,
  setScriptSelectMode,
  setScriptStrokeDrag,
  setScriptStrokeSelection,
  strokeSizePreview,
  toggleScriptStrokeSelection,
  wireframeMode,
  type CanvasPoint,
  type ScriptStrokeBounds,
  type ScriptStrokeDrag,
  type ScriptStrokeEditionPort,
  type SelectableScriptStroke,
} from './scriptStrokeEdition';
import { disarmAquarellePicker } from './aquarelleColorPicker';
import { exitRailMotionEditing } from './railMotionEditingMode';
import { exitPathEdit, exitVectorPen } from './vectorPathLatches';
import {
  buildLiftRibbonCached,
  liftRibbonBoundsPx,
  liftStrokeRadiusPx,
  trimLiftRibbonCache,
} from './aquarelleLiftRibbon';
import { buildStrokeBandCached, trimStrokeBandCache } from './aquarelleStrokeBand';
import {
  aquarelleStrokeSerial,
  aquarelleStrokesRevision,
  bumpAquarellePaintSeedSalts,
  bumpAquarellePaintSeedSaltsForFrame,
  bumpAquarelleStrokesRevision,
  captureAquarelleStrokeRegistry,
  clearAquarelleStrokeDeletion,
  deleteAquarelleStrokesFromScript,
  getAquarelleEventsForFrame,
  getRecordedAquarellePayloadTimeline,
  getRecordedAquarelleStroke,
  getRecordedAquarelleStrokeEntries,
  isAquarelleStrokeDeleted,
  markAquarelleStrokeDeleted,
  placeAquarelleStrokeInScript,
  restoreAquarelleStrokeRegistry,
  stepAquarelleStrokeInScript,
  transformAquarelleStrokesInScript,
  translateAquarelleStrokesInScript,
  updateAquarelleCurveModeInScript,
  updateAquarellePathInScript,
  updateAquarelleStrokesInScript,
  type AquarelleStackStepDirection,
  type AquarelleStrokeRegistrySnapshot,
  type AquarelleStrokeTransform,
} from './aquarelleRecordState';
import type {
  ScriptStrokeAppearance,
  ScriptStrokeAppearancePatch,
} from './strokeSettingsModel';

// 261023-g4p: the ONE shared edition module (scriptStrokeEdition) owns the
// geometry, the select/drag signals and the group types. They are re-exported
// under the watercolor names — including IDENTITY aliases for the three
// signals — so every existing consumer compiles and behaves unchanged.
export type { CanvasPoint, ScriptStrokeBounds };
export type AquarelleStrokeBounds = ScriptStrokeBounds;
export type SelectableAquarelleStroke = SelectableScriptStroke;

/** Rail Move/Select toggle. Compare-then-write (shared signal alias). */
export const aquarelleSelectMode = scriptSelectMode;

/** The highlighted stroke SET (shared signal alias — 261024-mz5). */
export const aquarelleSelectedStrokeMutationIds = scriptSelectedStrokeIds;

/** The singleton view of the selection (computed shared alias). */
export const aquarelleSelectedStrokeMutationId = scriptSelectedStrokeId;

/**
 * 261029-eur: which stroke kinds the select surface lists, outlines and
 * hit-tests. Display/editing scope only — it NEVER changes rendered artwork.
 * 'paint' means "any recorded tool that is not the eraser".
 */
export type AquarelleStrokeTypeFilter = 'all' | 'paint' | 'lift';

/**
 * 261029-eur UAT: every PLAIN select-mode entry (rail Select, A Move/Edit toggle)
 * starts on Paint — the everyday editing surface — and an exit returns to it.
 * Only the Eraser tool's Edit switch asks for 'lift'.
 */
export const AQUARELLE_STROKE_FILTER_DEFAULT: AquarelleStrokeTypeFilter = 'paint';

/** Written only through `setAquarelleStrokeTypeFilter` (compare-then-write). */
export const aquarelleStrokeTypeFilter = signal<AquarelleStrokeTypeFilter>(
  AQUARELLE_STROKE_FILTER_DEFAULT,
);

/**
 * quick 261031-euf: the Stroke settings list's finer filters. DISPLAY-ONLY —
 * they narrow the dialog's stroke list and never the overlay, the hit-test or
 * the rendered artwork (that stays the type filter's law). Each value is
 * 'all' or one recorded value; the dialog derives an EFFECTIVE value read-only
 * so a stored tool/tip the current rows do not offer renders as All without a
 * render-body write.
 */
export type AquarelleStrokeToolFilter = AquarelleTool | 'all';

export const aquarelleStrokeToolFilter = signal<AquarelleStrokeToolFilter>('all');

/** 'all' or a recorded `brushId`. */
export const aquarelleStrokeTipFilter = signal<string>('all');

export function setAquarelleStrokeToolFilter(next: AquarelleStrokeToolFilter): void {
  if (aquarelleStrokeToolFilter.value === next) return;
  aquarelleStrokeToolFilter.value = next;
}

export function setAquarelleStrokeTipFilter(next: string): void {
  if (aquarelleStrokeTipFilter.value === next) return;
  aquarelleStrokeTipFilter.value = next;
}

/** Both finer filters back to All, idempotently (the reset choke points). */
export function resetAquarelleStrokeFineFilters(): void {
  setAquarelleStrokeToolFilter('all');
  setAquarelleStrokeTipFilter('all');
}

/**
 * 261029-eur: the Stroke Settings dialog's sticky-dismissal flag — the FALLBACK
 * law for a bundle that carries no `closeMoveMode` (the watercolor Studio
 * supplies one, so closing it leaves the surface instead). Written ONLY by the
 * dialog's close handler (an event) and cleared ONLY at the
 * `setAquarelleSelectMode` off -> on choke point — never in a render body.
 */
export const aquarelleStrokeSettingsDismissed = signal(false);

/** The one filter predicate: 'paint' means "not a lift stroke". */
export function matchesAquarelleStrokeFilter(
  stroke: Pick<AquarelleStroke, 'tool'>,
  filter: AquarelleStrokeTypeFilter,
): boolean {
  if (filter === 'all') return true;
  return filter === 'lift' ? stroke.tool === 'lift' : stroke.tool !== 'lift';
}

export function selectAquarelleStroke(mutationId: number | null): void {
  selectScriptStroke(mutationId);
}

export function setAquarelleStrokeSelection(ids: Iterable<number>): void {
  setScriptStrokeSelection(ids);
}

export function toggleAquarelleStrokeSelection(mutationId: number): void {
  toggleScriptStrokeSelection(mutationId);
}

/**
 * 261024-mz5: keep only ids that are recorded, non-deleted strokes of the
 * CURRENT edit frame. Stale ids from another frame (or a tombstoned stroke)
 * must never reach a batch edit.
 */
export function aquarelleStrokesOnFrame(
  mutationIds: readonly number[],
  playFrame: number,
): number[] {
  const entries = getRecordedAquarelleStrokeEntries();
  const out: number[] = [];
  for (const mutationId of mutationIds) {
    if (out.includes(mutationId)) continue;
    const stroke = entries.get(mutationId);
    if (!stroke) continue;
    if (isAquarelleStrokeDeleted(mutationId)) continue;
    if ((stroke.playFrame ?? 0) !== playFrame) continue;
    out.push(mutationId);
  }
  return out;
}

/**
 * Shift+A target ids: every recorded, non-deleted stroke of the CURRENT edit
 * frame that the live filter lists — the same scoping the overlay outlines, so
 * "select all" can never arm an invisible stroke. Geometry-free on purpose
 * (the Studio shortcut has no engine pixel size).
 */
export function listAquarelleStrokeSelectionIds(
  playFrame: number,
  filter: AquarelleStrokeTypeFilter = aquarelleStrokeTypeFilter.peek(),
): number[] {
  const out: number[] = [];
  for (const [mutationId, stroke] of getRecordedAquarelleStrokeEntries()) {
    if (isAquarelleStrokeDeleted(mutationId)) continue;
    if ((stroke.playFrame ?? 0) !== playFrame) continue;
    if (!matchesAquarelleStrokeFilter(stroke, filter)) continue;
    out.push(mutationId);
  }
  return out;
}

/**
 * quick 261024-p5q: the Water color half of the Stroke Settings hydration.
 * Narrow revision read (a commit re-reads the dialog), frame/deleted filter
 * through `aquarelleStrokesOnFrame`, and the CALLER's id order preserved so
 * mixed readings always pick the first-selected stroke. Params are copied.
 */
export function readAquarelleStrokeAppearance(
  mutationIds: readonly number[],
  playFrame: number,
): ScriptStrokeAppearance[] {
  void aquarelleStrokesRevision.value;
  const entries = getRecordedAquarelleStrokeEntries();
  const out: ScriptStrokeAppearance[] = [];
  for (const mutationId of aquarelleStrokesOnFrame(mutationIds, playFrame)) {
    const stroke = entries.get(mutationId);
    if (!stroke) continue;
    out.push({
      mutationId,
      params: { ...stroke.params },
      color: typeof stroke.color === 'string' && stroke.color.length > 0 ? stroke.color : null,
    });
  }
  return out;
}

/**
 * 261029-eur: the ONE filter setter. Compare-then-write on the value AND
 * prune the selection to strokes the new filter still shows: an id whose
 * recorded entry mismatches (kind, or a tombstoned stroke) leaves the set.
 * An id with no recorded entry is kept — nothing to judge here, and the
 * delete paths already prune those. 1000 identical calls notify zero times.
 */
export function setAquarelleStrokeTypeFilter(next: AquarelleStrokeTypeFilter): void {
  const prior = aquarelleStrokeTypeFilter.peek();
  const selected = scriptSelectedStrokeIds.value;
  if (selected.size > 0) {
    const entries = getRecordedAquarelleStrokeEntries();
    const kept: number[] = [];
    let changed = false;
    for (const mutationId of selected) {
      const stroke = entries.get(mutationId);
      if (!stroke) {
        kept.push(mutationId);
        continue;
      }
      if (!isAquarelleStrokeDeleted(mutationId) && matchesAquarelleStrokeFilter(stroke, next)) {
        kept.push(mutationId);
      } else {
        changed = true;
      }
    }
    if (changed) setScriptStrokeSelection(kept);
  }
  if (prior !== next) {
    aquarelleStrokeTypeFilter.value = next;
    // 261031-euf: a REAL type change re-scopes the list, so the finer filters
    // never carry a stale tool/tip pair across it. An idempotent write keeps
    // them (compare-then-write, event path only — never a render body).
    resetAquarelleStrokeFineFilters();
  }
}

/**
 * 261029: Tab cycles the stroke-type filter (inside Move/Edit only) in the SAME
 * order as the dialog's segmented control — Paint → Eraser → All → Paint.
 * Delegates to the ONE setter, so a cycle prunes the selection exactly like a
 * segment click.
 */
export function cycleAquarelleStrokeTypeFilter(): AquarelleStrokeTypeFilter {
  const current = aquarelleStrokeTypeFilter.peek();
  const next: AquarelleStrokeTypeFilter = current === 'paint'
    ? 'lift'
    : current === 'lift' ? 'all' : 'paint';
  setAquarelleStrokeTypeFilter(next);
  return next;
}

/**
 * 261029-eur: the SINGLE select-mode entry/exit choke point.
 *
 * The filter is written BEFORE delegating: `setScriptSelectMode` early-returns
 * on an unchanged value, so a reset placed after it would be skipped whenever
 * select mode is already on. Entering with 'lift' keeps it; every other entry
 * and every exit resets to 'all' (a re-entry while already ON included).
 *
 * The Stroke Settings dismissal flag is cleared here on a genuine off -> on
 * edge ONLY (compare-then-write). This is the only reset site, and it is an
 * event/action path — never a render body.
 */
export function setAquarelleSelectMode(
  on: boolean,
  filter: AquarelleStrokeTypeFilter = AQUARELLE_STROKE_FILTER_DEFAULT,
): void {
  const was = scriptSelectMode.peek();
  // 61-17 (G-6 / D-16): the wireframe view is a no-capture view — Select entry
  // is refused OUTRIGHT while it is on, before any write, so the wireframe
  // cannot be given a selection surface it would swallow. Leaving Select is
  // never refused.
  if (on && wireframeMode.peek()) return;
  // 261030-cnq: entering Move/Edit leaves the color picker (Select owns Alt —
  // the Alt+click stroke-delete law). Exiting does not arm it.
  // 261107 UAT: entering Move/Edit also leaves ANIMATE MODE — the rail-motion
  // boundary would otherwise swallow the stroke clicks it is meant to receive.
  if (on) {
    disarmAquarellePicker();
    exitRailMotionEditing();
    // 61-17 (G-6): Select entry also releases the vector pen and closes any
    // open path edit — the vector overlay draws ABOVE the Select overlay, so a
    // latched pen would swallow every selection click. ENTRY EDGE ONLY:
    // `enterVectorPen` clears Select through this same function, and the pen
    // it just latched must survive that exit.
    exitVectorPen();
    exitPathEdit();
  }
  setAquarelleStrokeTypeFilter(on ? filter : AQUARELLE_STROKE_FILTER_DEFAULT);
  // 261031-euf: the finer list filters never survive a select-mode
  // transition (entry, re-entry while ON, exit). This reset must also precede
  // the delegation below — `setScriptSelectMode` early-returns on an unchanged
  // value, which would otherwise skip it on a re-entry.
  resetAquarelleStrokeFineFilters();
  // 261101-o2m: "every dialog open starts Live" (D-07). The genuine off -> on
  // edge attempts the Draft reset, and it must precede the delegation below
  // for the same early-return reason as the fine-filter reset. `setDraftMode`
  // refuses to leave while `draftPixelsDirty` is set, so this reset is a
  // silent no-op exactly when a previous exit's settle was refused — Draft
  // stays ON because those pixels are still stale, and the next exit retries.
  if (on && !was) setDraftMode(false);
  setScriptSelectMode(on);
  if (on && !was && aquarelleStrokeSettingsDismissed.peek()) {
    aquarelleStrokeSettingsDismissed.value = false;
  }
}

export function toggleAquarelleSelectMode(): void {
  setAquarelleSelectMode(!aquarelleSelectMode.value);
}

/** 261022-tv1: the live drag preview (shared signal alias). */
export type AquarelleStrokeDrag = ScriptStrokeDrag;

export const aquarelleStrokeDrag = scriptStrokeDrag;

/** Compare-then-write on all three fields (efx-preact-reactivity rule 3). */
export function setAquarelleStrokeDrag(next: AquarelleStrokeDrag | null): void {
  setScriptStrokeDrag(next);
}

/** Idempotent clear — a pointer-up/cancel with no drag armed is a no-op. */
export function clearAquarelleStrokeDrag(): void {
  clearScriptStrokeDrag();
}

/**
 * Session-wide non-deleted stroke count — the rail toggle's enable gate.
 * Selection/outlining stay frame-scoped; the rail has no frame prop, so this
 * coarse gate only answers "is there anything to select".
 */
export const aquarelleLiveStrokeCount = computed<number>(() => {
  void aquarelleStrokesRevision.value;
  let count = 0;
  for (const mutationId of getRecordedAquarelleStrokeEntries().keys()) {
    if (!isAquarelleStrokeDeleted(mutationId)) count += 1;
  }
  return count;
});

/** Map every recorded point through the ONE UV → canvas-pixel bridge. */
export function aquarelleStrokePointsPx(
  stroke: AquarelleStroke,
  size: EnginePixelSize,
): CanvasPoint[] {
  return stroke.points.map((point) => aquarelleUvToEnginePixel(point, size));
}

/** Brush radius in canvas px, floored so a hairline pen stays clickable. */
function strokeRadiusPx(stroke: AquarelleStroke): number {
  const declared = Number(stroke.params['size']);
  return Number.isFinite(declared) && declared > 0
    ? Math.max(MIN_STROKE_PAD_PX, declared / 2)
    : MIN_STROKE_PAD_PX;
}

/** Bounding box inflated by half the brush size on every side (shared law). */
export function aquarelleStrokeBoundsPx(
  points: readonly CanvasPoint[],
  brushSize: number,
): AquarelleStrokeBounds {
  return scriptStrokeBoundsPx(points, brushSize);
}

/**
 * Newest-first hit-test: when ribbons overlap, the last recorded stroke wins.
 * Frame-scoped, deleted-scoped and filter-scoped — an invisible stroke can
 * never be the delete target.
 */
export function hitTestAquarelleStroke(
  pointPx: CanvasPoint,
  playFrame: number,
  size: EnginePixelSize,
  filter: AquarelleStrokeTypeFilter = 'all',
): number | null {
  void aquarelleStrokesRevision.value;
  const entries = Array.from(getRecordedAquarelleStrokeEntries().entries()).reverse();
  for (const [mutationId, stroke] of entries) {
    if (isAquarelleStrokeDeleted(mutationId)) continue;
    if ((stroke.playFrame ?? 0) !== playFrame) continue;
    if (!matchesAquarelleStrokeFilter(stroke, filter)) continue;
    const pointsPx = aquarelleStrokePointsPx(stroke, size);
    // 261029-eur: a lift's click target is the drawn ribbon's maximum support
    // (an aspect > 1 tip reaches past the bare footprint radius on its wide
    // side); paints keep the declared half-size law.
    const radius =
      stroke.tool === 'lift'
        ? liftStrokeRadiusPx(stroke, size)
        : strokeRadiusPx(stroke);
    if (hitsScriptStroke(pointPx, pointsPx, radius)) return mutationId;
  }
  return null;
}

/**
 * quick 261031-euf: true only when a recorded tool-overrides multiplier
 * differs from neutral. Absent or all-neutral is a plain response; the value
 * is display metadata for the stroke-list row, never a render input.
 */
function hasCustomToolOverrides(overrides: AquarelleToolOverrides | undefined): boolean {
  if (!overrides) return false;
  return TOOL_OVERRIDE_FIELDS.some(
    (field) => overrides[field] !== NEUTRAL_TOOL_OVERRIDES[field],
  );
}

/**
 * Every selectable stroke of the frame in recording order. Reads the
 * revision so a narrow leaf re-renders when the stroke set changes.
 * `filter` narrows the LISTING only — stack positions stay global
 * (they are derived from the full frame's events below).
 */
export function listSelectableAquarelleStrokes(
  playFrame: number,
  size: EnginePixelSize,
  filter: AquarelleStrokeTypeFilter = 'all',
): SelectableAquarelleStroke[] {
  void aquarelleStrokesRevision.value;
  // Paint order for this frame, bottom → top. The listing itself walks the
  // registry (creation order), so the stack position is looked up here.
  const stackOrder: number[] = [];
  for (const event of getAquarelleEventsForFrame(playFrame)) {
    if (isAquarelleDryEvent(event)) continue;
    const mutationId = (event.engine as { mutationId?: number }).mutationId;
    if (mutationId !== undefined) stackOrder.push(mutationId);
  }
  const stackTotal = stackOrder.length;
  const entries = getRecordedAquarelleStrokeEntries();
  // 261029-eur: trim the ribbon cache against the FULL frame's lift ids —
  // filter-independent, so narrowing the filter never orphans a cached
  // polygon and frame navigation cannot grow the cache.
  // 261101-mvg: same hygiene for the paint band cache — the two caches are
  // disjoint by kind. Cache bookkeeping only: zero geometry, so the entries
  // below stay byte-identical whatever the preview switch says.
  const liveLiftIds: number[] = [];
  const liveBandIds: number[] = [];
  for (const [mutationId, stroke] of entries) {
    if (isAquarelleStrokeDeleted(mutationId)) continue;
    if ((stroke.playFrame ?? 0) !== playFrame) continue;
    if (stroke.tool === 'lift') liveLiftIds.push(mutationId);
    else liveBandIds.push(mutationId);
  }
  trimLiftRibbonCache(liveLiftIds);
  trimStrokeBandCache(liveBandIds);

  const out: SelectableAquarelleStroke[] = [];
  for (const [mutationId, stroke] of entries) {
    if (isAquarelleStrokeDeleted(mutationId)) continue;
    if ((stroke.playFrame ?? 0) !== playFrame) continue;
    const kind = stroke.tool === 'lift' ? 'lift' : 'paint';
    if (!matchesAquarelleStrokeFilter(stroke, filter)) continue;
    // Serial assignment happens here in registry order for a loaded script
    // (recorded strokes already own theirs).
    const serial = aquarelleStrokeSerial(mutationId, playFrame);
    const pointsPx = aquarelleStrokePointsPx(stroke, size);
    const stackIndex = stackOrder.indexOf(mutationId);
    const stackPosition = stackIndex < 0 ? stackTotal : stackTotal - stackIndex;
    const color = typeof stroke.color === 'string' && stroke.color.length > 0 ? stroke.color : '#111827';
    // 261031-euf: additive row metadata (both branches) — never a selection,
    // hit-test or bounds input.
    const tool = stroke.tool;
    const brushId = stroke.brushId;
    const customResponse = hasCustomToolOverrides(stroke.toolOverrides);
    if (kind === 'lift') {
      // The polygon IS the drawn border: bounds = its exact bbox plus the
      // shared 6px grab margin (padding by the hit radius would float the
      // handles far off the ribbon).
      const ribbon = buildLiftRibbonCached(
        stroke,
        mutationId,
        size,
        aquarelleStrokesRevision.value,
      );
      out.push({
        mutationId,
        pointsPx: decimateScriptPoints(pointsPx),
        bounds: liftRibbonBoundsPx(ribbon.polygonPx, MIN_STROKE_PAD_PX),
        serial,
        stackPosition,
        stackTotal,
        color,
        kind,
        tool,
        brushId,
        customResponse,
        ribbonPx: ribbon.polygonPx,
        hitRadiusPx: ribbon.hitRadiusPx,
      });
      continue;
    }
    out.push({
      mutationId,
      pointsPx: decimateScriptPoints(pointsPx),
      // Bounds use every point — decimation must never clip the box ends.
      bounds: scriptStrokeBoundsPx(pointsPx, Number(stroke.params['size'])),
      serial,
      stackPosition,
      stackTotal,
      color,
      kind,
      tool,
      brushId,
      customResponse,
    });
  }
  return out;
}

/**
 * 261101-mvg: the footprint band the overlay draws for one listed entry while
 * the "Preview stroke size" switch is ON. DISPLAY-ONLY: this path is
 * unreachable from `hitTestAquarelleStroke` (which walks the registry
 * directly), and it never touches bounds, stack positions or the script.
 *
 * - OFF returns nothing for BOTH kinds, the Eraser included (default).
 * - ON returns a lift's `ribbonPx` BY IDENTITY (the listing already built it —
 *   never rebuild the 261029-eur law here) and a paint polygon from the ONE
 *   band module.
 *
 * The `strokeSizePreview.value` read happens inside the overlay's render, so
 * the subscription is the narrow leaf's (efx-preact-reactivity rule 5).
 */
export function resolveAquarelleStrokeBandPx(
  entry: SelectableAquarelleStroke,
  size: EnginePixelSize,
): CanvasPoint[] | undefined {
  if (!strokeSizePreview.value) return undefined;
  if (entry.kind === 'lift') return entry.ribbonPx;
  const stroke = getRecordedAquarelleStroke(entry.mutationId);
  if (!stroke) return undefined;
  const polygonPx = buildStrokeBandCached(
    stroke,
    entry.mutationId,
    size,
    aquarelleStrokesRevision.value,
  ).polygonPx;
  return polygonPx.length > 0 ? polygonPx : undefined;
}

/**
 * 261023-g4p: the watercolor half of the shared edition port. The Studio
 * registration adds `isActive` plus the delete/move/step callbacks (the same
 * handlers the rail gestures and the keyboard actions already use).
 *
 * 261029-eur: the filter is read LIVE (`.value`, never captured) so the
 * overlay leaf re-renders on a filter change and the keyboard paths always
 * agree with what is drawn.
 */
export const aquarelleScriptStrokeEditionPort: Pick<
  ScriptStrokeEditionPort,
  'listStrokes' | 'hitTestStroke' | 'bandFor'
> = {
  listStrokes: (playFrame, size) =>
    listSelectableAquarelleStrokes(playFrame, size, aquarelleStrokeTypeFilter.value),
  hitTestStroke: (pointPx, playFrame, size) =>
    hitTestAquarelleStroke(pointPx, playFrame, size, aquarelleStrokeTypeFilter.value),
  bandFor: (entry, size) => resolveAquarelleStrokeBandPx(entry, size),
};

// ============================================================
//  quick 261111-t74 — the selection appearance edit port.
//
//  A plain module variable, modelled on `scriptStrokeEdition`'s
//  ports: the Studio writes it in its render body, there is no
//  signal and no subscription. The port exists so a brush pick can
//  commit onto the selection through the ONE appearance handler
//  it already ships (`beginAquarelleAppearanceEdit`), inheriting
//  one undo entry, one revision bump and the seed re-roll instead
//  of opening a second edit path.
// ============================================================

/** The one member the Studio binds: forward ids + patch to the appearance door. */
export interface AquarelleSelectionEditPort {
  applyAppearance(
    ids: readonly number[],
    patch: ScriptStrokeAppearancePatch,
  ): Promise<boolean>;
}

let aquarelleSelectionEditPort: AquarelleSelectionEditPort | null = null;

export function setAquarelleSelectionEditPort(
  port: AquarelleSelectionEditPort | null,
): void {
  aquarelleSelectionEditPort = port;
}

/**
 * PEEK-ONLY: true only while Select mode is on AND the selection is
 * non-empty. `.peek()` never subscribes, so an event-time caller (the future
 * brush pick) can ask without making its caller re-render on every selection
 * change — the render-body rule for this module (efx-preact-reactivity §5).
 */
export function aquarelleSelectionEditActive(): boolean {
  return scriptSelectMode.peek() && scriptSelectedStrokeIds.peek().size > 0;
}

/**
 * Options for one appearance commit (quick 261111-ucf).
 *
 * `filter` defaults to `'all'`, which preserves the 261111-t74 forwarding
 * exactly: the whole selection, paint AND lift ids, in selection order. The
 * paint controls pass `'paint'`, which is what keeps a lift (eraser) stroke
 * out of every pick and slider-release edit.
 */
export interface AquarelleSelectionEditOptions {
  filter?: AquarelleStrokeTypeFilter;
}

/**
 * Commit an appearance patch onto the current selection. Returns `null` when
 * there is NO ATTEMPT — Select mode off, an empty selection, no registered
 * port, or (with a filter) no selected stroke left after filtering — so the
 * caller keeps its own path. A non-null resolution of `false` means the Studio
 * REFUSED the edit (guards, in-flight, failed re-bake).
 *
 * The ids are snapshotted into a fresh array before the port is called: a
 * selection change during the async commit can never mutate the forwarded
 * list. A filtered-away selection is a no-attempt too: the port is never
 * touched, so a lift-only selection cannot open an empty undo entry.
 */
export function commitAquarelleSelectionAppearance(
  patch: ScriptStrokeAppearancePatch,
  options?: AquarelleSelectionEditOptions,
): Promise<boolean> | null {
  if (!aquarelleSelectionEditActive()) return null;
  const port = aquarelleSelectionEditPort;
  if (!port) return null;
  const filter = options?.filter ?? 'all';
  let ids = [...scriptSelectedStrokeIds.peek()];
  if (filter !== 'all') {
    const entries = getRecordedAquarelleStrokeEntries();
    ids = ids.filter((mutationId) => {
      const stroke = entries.get(mutationId);
      return stroke !== undefined && matchesAquarelleStrokeFilter(stroke, filter);
    });
    if (ids.length === 0) return null;
  }
  return port.applyAppearance(ids, patch);
}

// ============================================================
//  Delete edits (261022-pim). A delete is one in-memory script
//  mutation; the caller owns the async re-bake and must clear
//  the in-flight flag when it settles. Task 3 attaches
//  revision-authoritative before/after snapshots so the delete
//  + re-bake is exactly ONE undoable ledger command.
// ============================================================

let aquarelleScriptEditInFlight = false;

/**
 * True while a script edit (delete OR move) and its re-bake is running — a
 * second Alt+click or drag release is refused. One shared guard: the two
 * gesture paths can never interleave.
 */
export function isAquarelleScriptEditInFlight(): boolean {
  return aquarelleScriptEditInFlight;
}

/**
 * Bumped on every in-flight transition. The flag itself is a plain boolean
 * (every holder is an async script edit), so a seam that must ACT when the
 * sheet becomes free — the deferred vector re-bake — needs this one reactive
 * edge instead of polling.
 */
export const aquarelleScriptEditInFlightRevision = signal(0);

export function setAquarelleScriptEditInFlight(inFlight: boolean): void {
  if (aquarelleScriptEditInFlight === inFlight) return;
  aquarelleScriptEditInFlight = inFlight;
  aquarelleScriptEditInFlightRevision.value += 1;
}

// 261022-tv1: delete-named aliases kept so existing callers/tests compile
// unchanged against the generalized shared flag.
export const isAquarelleDeleteInFlight = isAquarelleScriptEditInFlight;
export const setAquarelleDeleteInFlight = setAquarelleScriptEditInFlight;

/**
 * A script snapshot. The timeline holds the SAME event object references
 * (a shallow copy only) so a measured cuisson patch survives the swap. The
 * registry is captured alongside it (also by reference) so a move can restore
 * the stroke objects and the timeline entries in lockstep.
 * `revision` is the live `aquarelleStrokesRevision` this side was captured
 * at; a restore refreshes the applied side with the new revision so the
 * opposite direction can validate against it.
 */
export interface AquarelleScriptSnapshot {
  readonly timeline: readonly AquarellePayloadEvent[];
  readonly deleted: readonly number[];
  readonly registry: AquarelleStrokeRegistrySnapshot;
  revision: number;
}

interface AquarelleEditRecord {
  readonly before: AquarelleScriptSnapshot;
  readonly after: AquarelleScriptSnapshot;
}

/** 10-entry edit ledger cap (mirrors the physical history ledger). */
const MAX_AQUARELLE_EDITS = 10;
const aquarelleEdits = new Map<number, AquarelleEditRecord>();
let nextAquarelleEditId = 1;

function captureAquarelleSnapshot(): AquarelleScriptSnapshot {
  const deleted: number[] = [];
  for (const mutationId of getRecordedAquarelleStrokeEntries().keys()) {
    if (isAquarelleStrokeDeleted(mutationId)) deleted.push(mutationId);
  }
  return {
    timeline: [...getRecordedAquarellePayloadTimeline()],
    deleted,
    registry: captureAquarelleStrokeRegistry(),
    revision: aquarelleStrokesRevision.value,
  };
}

/** Replace the deleted-set membership with exactly the snapshot's ids. */
function replaceDeletedMembership(deleted: readonly number[]): void {
  const wanted = new Set(deleted);
  for (const mutationId of getRecordedAquarelleStrokeEntries().keys()) {
    if (wanted.has(mutationId)) markAquarelleStrokeDeleted(mutationId);
    else clearAquarelleStrokeDeletion(mutationId);
  }
}

/** Drop every selected id that no longer names a live recorded stroke. */
function clearSelectionIfGone(): void {
  const selected = aquarelleSelectedStrokeMutationIds.value;
  if (selected.size === 0) return;
  const entries = getRecordedAquarelleStrokeEntries();
  const live: number[] = [];
  let changed = false;
  for (const mutationId of selected) {
    if (entries.has(mutationId) && !isAquarelleStrokeDeleted(mutationId)) {
      live.push(mutationId);
    } else {
      changed = true;
    }
  }
  if (changed) setScriptStrokeSelection(live);
}

/**
 * Install a snapshot's script content in place and return the fresh revision.
 *
 * ORDER MATTERS: the registry is restored FIRST (the timeline splice then
 * lands on the restored entry objects), then the deleted membership (it walks
 * the registry's ids), then the timeline itself. A move that restored the
 * timeline before the registry would leave `recordedStrokes` /
 * `recordedStrokeEntries` pointing at the moved objects, and a later delete's
 * `indexOf` splice would disagree with the live timeline.
 */
function applySnapshotContent(snapshot: AquarelleScriptSnapshot): number {
  restoreAquarelleStrokeRegistry(snapshot.registry);
  replaceDeletedMembership(snapshot.deleted);
  const live = getRecordedAquarellePayloadTimeline() as AquarellePayloadEvent[];
  live.splice(0, live.length, ...snapshot.timeline);
  bumpAquarelleStrokesRevision();
  clearSelectionIfGone();
  return aquarelleStrokesRevision.value;
}

/**
 * Store one before/after edit under the shared 10-entry cap. One id counter
 * and one eviction policy for both the delete and the move paths.
 */
function storeAquarelleEdit(record: AquarelleEditRecord): number {
  const editId = nextAquarelleEditId;
  nextAquarelleEditId += 1;
  aquarelleEdits.set(editId, record);
  if (aquarelleEdits.size > MAX_AQUARELLE_EDITS) {
    const oldest = aquarelleEdits.keys().next().value;
    if (oldest !== undefined) aquarelleEdits.delete(oldest);
  }
  return editId;
}

/** Accept a single id or a batch, de-duplicated and finite-only. */
function normalizeAquarelleMutationIds(ids: number | readonly number[]): number[] {
  const list = typeof ids === 'number' ? [ids] : [...ids];
  const out: number[] = [];
  const seen = new Set<number>();
  for (const mutationId of list) {
    if (!Number.isFinite(mutationId)) continue;
    if (seen.has(mutationId)) continue;
    seen.add(mutationId);
    out.push(mutationId);
  }
  return out;
}

/**
 * Delete one stroke OR the whole selection as a single edit and store its
 * before/after snapshots. Returns a monotonic edit id or null when refused.
 * Deleted ids leave the selection; survivors stay selected.
 */
export function beginAquarelleDeleteEdit(
  mutationIds: number | readonly number[],
): number | null {
  // A delete/apply must never leave a drag ghost behind.
  clearAquarelleStrokeDrag();
  if (aquarelleScriptEditInFlight) return null;
  const ids = normalizeAquarelleMutationIds(mutationIds);
  if (ids.length === 0) return null;
  const before = captureAquarelleSnapshot();
  if (deleteAquarelleStrokesFromScript(ids) === 0) return null;
  const after = captureAquarelleSnapshot();
  const editId = storeAquarelleEdit({ before, after });
  clearSelectionIfGone();
  // The last stroke is gone: there is nothing left to select, and leaving
  // select mode on would keep the overlay (painting blocked) behind a now
  // disabled Select button.
  if (aquarelleLiveStrokeCount.value === 0) setAquarelleSelectMode(false);
  return editId;
}

/**
 * 261029-lsr: build the synthetic single-stroke UNDO edit — the one edit that
 * makes a recorded stroke's undo/redo script-authoritative (D-02, D-04).
 *
 * Direction contract: `after` is the live script WITH the stroke (revision R)
 * and `before` is the same content WITHOUT it (the stroke's timeline entry
 * removed and the id tombstoned), also at revision R. `undo` therefore installs
 * the WITHOUT side; that install writes the fresh revision back into `before`,
 * which is exactly what the matching `redo` validates against. Redo installs
 * WITH again and clears the tombstone — the inverse swap, never a second edit.
 *
 * The build mutates no live state: the authority guard must still pass on the
 * immediate undo. The caller builds it AFTER the durable-base recovery, which
 * can bump `aquarelleStrokesRevision` (a stale `after` would fail every undo).
 * Refuses: an in-flight script edit, a non-finite id, an unknown id, an
 * already-tombstoned id, and a stroke the timeline does not carry (not
 * script-owned — no event to remove is no edit to make).
 */
export function beginAquarelleStrokeUndoEdit(
  mutationId: number,
  /**
   * 261029-lsr UAT row 1: `runScriptReplay` holds the shared in-flight gate for
   * the WHOLE replay, so its own edit build must not be refused by it — the
   * flag exists to stop a SECOND edit from interleaving, and the replay already
   * holds it. Every gesture caller keeps the default refusal.
   */
  ownedInFlight = false,
): number | null {
  if (!ownedInFlight && aquarelleScriptEditInFlight) return null;
  if (!Number.isFinite(mutationId)) return null;
  if (getRecordedAquarelleStroke(mutationId) === undefined) return null;
  if (isAquarelleStrokeDeleted(mutationId)) return null;
  const after = captureAquarelleSnapshot();
  // Dry events are global sheet actions (no frame anchor): they survive.
  const timeline = after.timeline.filter((event) =>
    isAquarelleDryEvent(event)
      ? true
      : (event.engine as AquarelleStrokePayload).mutationId !== mutationId,
  );
  // No engine id on the timeline means this stroke is not script-owned.
  if (timeline.length === after.timeline.length) return null;
  const before: AquarelleScriptSnapshot = {
    timeline,
    deleted: [...after.deleted, mutationId],
    // Shared by reference, exactly like a capture pair: the redo side keeps
    // the same stroke objects.
    registry: after.registry,
    revision: after.revision,
  };
  return storeAquarelleEdit({ before, after });
}

/**
 * 261022-tv1 / 261024-mz5: move one stroke or the whole selection by a
 * document-UV delta as a single edit (move + its re-bake = ONE
 * `aquarelle-script` ledger command). The selection is kept — every stroke
 * still exists, at its new place. Returns an edit id or null when refused.
 */
export function beginAquarelleMoveEdit(
  mutationIds: number | readonly number[],
  dxUv: number,
  dyUv: number,
): number | null {
  // A move/apply must never leave the released ghost behind.
  clearAquarelleStrokeDrag();
  if (aquarelleScriptEditInFlight) return null;
  const ids = normalizeAquarelleMutationIds(mutationIds);
  if (ids.length === 0) return null;
  const before = captureAquarelleSnapshot();
  if (translateAquarelleStrokesInScript(ids, dxUv, dyUv) === 0) return null;
  // 261031-cf9: the ON strokes of the batch re-roll INSIDE this edit, so undo
  // restores the pre-commit salt (and its traceSeed) with the pre-move points.
  bumpAquarellePaintSeedSalts(ids);
  const after = captureAquarelleSnapshot();
  return storeAquarelleEdit({ before, after });
}

/**
 * quick 261024-p5q: set canonical params/colour on one stroke or the whole
 * selection as a single edit (update + its re-bake = ONE `aquarelle-script`
 * ledger command). Same ghost clear, in-flight guard and snapshot pair as
 * move/transform. The selection is kept — every stroke still exists. Returns
 * an edit id or null when refused (an empty or zero-change batch stores
 * nothing).
 */
export function beginAquarelleAppearanceEdit(
  mutationIds: number | readonly number[],
  patch: ScriptStrokeAppearancePatch,
): number | null {
  // An appearance commit must never leave a released ghost behind.
  clearAquarelleStrokeDrag();
  if (aquarelleScriptEditInFlight) return null;
  const ids = normalizeAquarelleMutationIds(mutationIds);
  if (ids.length === 0) return null;
  const before = captureAquarelleSnapshot();
  if (updateAquarelleStrokesInScript(ids, patch) === 0) return null;
  // 261031-cf9: the switch's own write lands salt 0; this bump performs the
  // first re-roll (0 -> 1) so enabling the switch is immediately visible, and
  // any other appearance commit on an ON stroke re-rolls it too. OFF strokes
  // skip inside the bump and keep their exact seed.
  bumpAquarellePaintSeedSalts(ids);
  const after = captureAquarelleSnapshot();
  return storeAquarelleEdit({ before, after });
}

/**
 * 61-31 (G-20 / D-01 revised): set one curve-evaluation mode on one stroke or
 * the whole selection as a single edit (mode write + its re-sampled points =
 * ONE `aquarelle-script` ledger command), so a mixed selection flips in one
 * undo step rather than one per stroke. Same ghost clear, in-flight guard and
 * snapshot pair as the render-mode wrapper.
 *
 * Deliberately does NOT call `bumpAquarellePaintSeedSalts`: a mode flip
 * re-samples the geometry through a different evaluation, it does not re-roll
 * the texture — the stroke's stochastic paint must survive the flip, exactly as
 * it does for a render-mode change.
 */
export function beginAquarelleCurveModeEdit(
  mutationIds: number | readonly number[],
  mode: AquarelleCurveMode,
): number | null {
  // A mode commit must never leave a released ghost behind.
  clearAquarelleStrokeDrag();
  if (aquarelleScriptEditInFlight) return null;
  const ids = normalizeAquarelleMutationIds(mutationIds);
  if (ids.length === 0) return null;
  const before = captureAquarelleSnapshot();
  if (updateAquarelleCurveModeInScript(ids, mode) === 0) return null;
  const after = captureAquarelleSnapshot();
  return storeAquarelleEdit({ before, after });
}

/**
 * 61-10 (VEC-02 / VEC-07): one completed path-edit gesture as a single edit
 * (path update + its re-bake = ONE `aquarelle-script` ledger command). A drag,
 * a handle move, an insert, a delete and a width commit all pass the FULL next
 * anchor list through this one wrapper, so there is never one history entry
 * per anchor (T-61-33). Same ghost clear, in-flight guard and snapshot pair as
 * move/appearance; a zero-change path stores nothing.
 *
 * Deliberately does NOT call `bumpAquarellePaintSeedSalts`: a geometry edit
 * must not re-roll the paint — re-rolling on every anchor nudge would change
 * the rendered texture under the user's hand. The seed salt is a paint
 * appearance concern.
 */
export function beginAquarellePathEdit(
  mutationId: number,
  anchors: readonly AquarelleAnchor[],
): number | null {
  clearAquarelleStrokeDrag();
  if (aquarelleScriptEditInFlight) return null;
  if (!Number.isFinite(mutationId)) return null;
  const before = captureAquarelleSnapshot();
  if (updateAquarellePathInScript(mutationId, anchors) === 0) return null;
  const after = captureAquarelleSnapshot();
  return storeAquarelleEdit({ before, after });
}

/**
 * 261024-mz5: scale + rotate one stroke or the whole selection about a
 * document-UV centre as a single edit (transform + its re-bake = ONE
 * `aquarelle-script` ledger command). Same in-flight guard and ghost clear as
 * move. The selection is kept — every stroke still exists, transformed.
 * Returns an edit id or null when refused.
 */
export function beginAquarelleTransformEdit(
  mutationIds: number | readonly number[],
  transform: AquarelleStrokeTransform,
): number | null {
  // A transform/apply must never leave the released ghost behind.
  clearAquarelleStrokeDrag();
  if (aquarelleScriptEditInFlight) return null;
  const ids = normalizeAquarelleMutationIds(mutationIds);
  if (ids.length === 0) return null;
  const before = captureAquarelleSnapshot();
  if (transformAquarelleStrokesInScript(ids, transform) === 0) return null;
  // 261031-cf9: ON strokes re-roll inside the stored edit (undo restores the
  // old salt AND the old geometry from the same `before` side).
  bumpAquarellePaintSeedSalts(ids);
  const after = captureAquarelleSnapshot();
  return storeAquarelleEdit({ before, after });
}

/**
 * 261022-ujp: step one recorded stroke through the paint stack as a single
 * edit (reorder + its re-bake = ONE `aquarelle-script` ledger command). The
 * selection is kept — the stroke still exists. Returns a monotonic edit id or
 * null when refused.
 */
export function beginAquarelleReorderEdit(
  mutationId: number,
  direction: AquarelleStackStepDirection = 'back',
): number | null {
  // A stack step must never leave a drag ghost behind.
  clearAquarelleStrokeDrag();
  if (aquarelleScriptEditInFlight) return null;
  const before = captureAquarelleSnapshot();
  if (!stepAquarelleStrokeInScript(mutationId, direction)) return null;
  // 261031-cf9: only the stepped stroke re-rolls; its swap partner keeps the
  // exact seed it had (only the recording slot moved).
  bumpAquarellePaintSeedSalts([mutationId]);
  const after = captureAquarelleSnapshot();
  return storeAquarelleEdit({ before, after });
}

/**
 * 261024-vga: place one recorded stroke at an exact stack position as a single
 * edit (placement + its re-bake = ONE `aquarelle-script` ledger command). The
 * selection is kept — the stroke still exists. Returns a monotonic edit id or
 * null when refused.
 */
export function beginAquarellePlaceEdit(
  mutationId: number,
  positionFromTop: number,
): number | null {
  // A placement must never leave a drag ghost behind.
  clearAquarelleStrokeDrag();
  if (aquarelleScriptEditInFlight) return null;
  const before = captureAquarelleSnapshot();
  if (!placeAquarelleStrokeInScript(mutationId, positionFromTop)) return null;
  // 261031-cf9: only the placed stroke re-rolls.
  bumpAquarellePaintSeedSalts([mutationId]);
  const after = captureAquarelleSnapshot();
  return storeAquarelleEdit({ before, after });
}

/**
 * 261031-cf9: the Rebake action's edit. A committed re-bake re-rolls every
 * live ON stroke of the edited frame as ONE undoable command, so Cmd+Z
 * restores the previous salt and the displayed texture it produced.
 *
 * Refuses an in-flight script edit unless the caller owns the gate (the
 * Rebake handler holds it for the whole apply), and mints nothing when the
 * frame has no ON stroke — the OFF path stays free and writes no ledger entry.
 */
export function beginAquarellePaintSeedRerollEdit(
  playFrame: number,
  ownedInFlight = false,
): number | null {
  if (!ownedInFlight && aquarelleScriptEditInFlight) return null;
  if (!Number.isFinite(playFrame)) return null;
  const before = captureAquarelleSnapshot();
  if (bumpAquarellePaintSeedSaltsForFrame(playFrame) === 0) return null;
  const after = captureAquarelleSnapshot();
  return storeAquarelleEdit({ before, after });
}

/**
 * Revision-authoritative undo/redo swap. `undo` restores `before` when the
 * live script is still the edit's `after` side (and vice versa for redo);
 * any newer recorded mutation fails closed with null and both stacks stay
 * untouched. Returns the snapshot that was live before the swap (the raw
 * rollback material for a failed re-bake).
 */
export function restoreAquarelleEditSnapshot(
  editId: number,
  direction: 'undo' | 'redo',
): AquarelleScriptSnapshot | null {
  const edit = aquarelleEdits.get(editId);
  if (!edit) return null;
  const target = direction === 'undo' ? edit.before : edit.after;
  const liveSide = direction === 'undo' ? edit.after : edit.before;
  if (aquarelleStrokesRevision.value !== liveSide.revision) return null;
  const revert = captureAquarelleSnapshot();
  target.revision = applySnapshotContent(target);
  return revert;
}

/**
 * Rollback path: install a snapshot without the authority check (a failed
 * re-bake must restore the pre-attempt script it just left).
 */
export function restoreAquarelleSnapshotRaw(snapshot: AquarelleScriptSnapshot): void {
  applySnapshotContent(snapshot);
}

/**
 * 261029-lsr: re-seat the ATTEMPTED side of an existing edit at the live
 * revision. A failed re-bake's raw rollback (`restoreAquarelleSnapshotRaw`)
 * bumps `aquarelleStrokesRevision` without writing the fresh revision back
 * into the edit, so every retry would fail the guard forever — the undo of
 * that stroke would be permanently blocked. Only the direction the caller
 * just attempted is forgiven: the opposite side keeps its stale revision and
 * every other edit stays fail-closed, so a foreign script mutation is never
 * forgiven. Never bumps the revision, never installs content, never prunes
 * the edit (a redo needs the same edit alive).
 */
export function reanchorAquarelleEditRevision(
  editId: number,
  direction: 'undo' | 'redo',
): boolean {
  const edit = aquarelleEdits.get(editId);
  if (!edit) return false;
  const liveSide = direction === 'undo' ? edit.after : edit.before;
  liveSide.revision = aquarelleStrokesRevision.value;
  return true;
}

/** Content identity of two snapshots by live-object reference (no revision). */
function snapshotContentIdentical(
  left: AquarelleScriptSnapshot,
  right: AquarelleScriptSnapshot,
): boolean {
  if (left.timeline.length !== right.timeline.length) return false;
  for (let index = 0; index < left.timeline.length; index += 1) {
    if (left.timeline[index] !== right.timeline[index]) return false;
  }
  if (left.deleted.length !== right.deleted.length) return false;
  for (let index = 0; index < left.deleted.length; index += 1) {
    if (left.deleted[index] !== right.deleted[index]) return false;
  }
  if (left.registry.pairs.length !== right.registry.pairs.length) return false;
  for (let index = 0; index < left.registry.pairs.length; index += 1) {
    const leftPair = left.registry.pairs[index];
    const rightPair = right.registry.pairs[index];
    if (leftPair[0] !== rightPair[0] || leftPair[1] !== rightPair[1] || leftPair[2] !== rightPair[2]) return false;
  }
  return true;
}

/**
 * 261029-lsr UAT (stacked stroke edits): undoing one stroke edit bumps
 * `aquarelleStrokesRevision`, so the NEXT edit's attempted side is still the
 * live CONTENT but carries a stale revision and its restore fails closed —
 * only the first stroke edit could ever be undone. Re-seat the attempted
 * side's revision ONLY when the live content is provably identical to it
 * (same timeline entries, registry pairs and tombstones by reference); any
 * foreign script edit keeps the stale revision and still fails closed.
 */
export function reanchorAquarelleEditFromLiveContent(
  editId: number,
  direction: 'undo' | 'redo',
): boolean {
  const edit = aquarelleEdits.get(editId);
  if (!edit) return false;
  const attempted = direction === 'undo' ? edit.after : edit.before;
  const live = captureAquarelleSnapshot();
  if (!snapshotContentIdentical(live, attempted)) return false;
  attempted.revision = live.revision;
  return true;
}
