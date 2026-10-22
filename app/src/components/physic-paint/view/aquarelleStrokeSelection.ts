// ============================================================
//  aquarelleStrokeSelection — Water color stroke select mode
//  (quick 261022-pim Task 1).
//
//  Select mode is the rail Move/Select toggle OR a held Cmd/Meta
//  (temporaryMove). While active the overlay above the vendor
//  canvas outlines every recorded stroke of the CURRENT edit
//  frame, and a click selects the newest stroke under the
//  pointer. Selection is written in the pointer handler — never
//  an effect (efx-preact-reactivity).
//
//  Coordinates cross from document UV to canvas pixels through
//  aquarelleUvToEnginePixel (the ONE bridge) so an outlined
//  stroke and the delete target can never disagree.
//
//  Signals are read only by narrow leaves (the overlay and the
//  rail toggle), never the Studio render body.
// ============================================================

import { computed, signal } from '@preact/signals';
import type { AquarellePayloadEvent, AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import {
  aquarelleUvToEnginePixel,
  type EnginePixelSize,
} from '../engine/aquarelleStrokeBridge';
import {
  aquarelleStrokesRevision,
  bumpAquarelleStrokesRevision,
  captureAquarelleStrokeRegistry,
  clearAquarelleStrokeDeletion,
  deleteAquarelleStrokeFromScript,
  getRecordedAquarellePayloadTimeline,
  getRecordedAquarelleStrokeEntries,
  isAquarelleStrokeDeleted,
  markAquarelleStrokeDeleted,
  restoreAquarelleStrokeRegistry,
  stepAquarelleStrokeInScript,
  translateAquarelleStrokeInScript,
  type AquarelleStackStepDirection,
  type AquarelleStrokeRegistrySnapshot,
} from './aquarelleRecordState';

/** Long polylines are decimated for rendering only (bounds use every point). */
const MAX_POLYLINE_POINTS = 96;

/** Minimum hit/bounds pad — below this the outline of a thin pen is unclickable. */
const MIN_STROKE_PAD_PX = 6;

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface AquarelleStrokeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectableAquarelleStroke {
  mutationId: number;
  pointsPx: CanvasPoint[];
  bounds: AquarelleStrokeBounds;
}

/** Rail Move/Select toggle. Compare-then-write. */
export const aquarelleSelectMode = signal(false);

/** The highlighted stroke (null = nothing selected). Compare-then-write. */
export const aquarelleSelectedStrokeMutationId = signal<number | null>(null);

export function selectAquarelleStroke(mutationId: number | null): void {
  if (aquarelleSelectedStrokeMutationId.value === mutationId) return;
  aquarelleSelectedStrokeMutationId.value = mutationId;
}

export function setAquarelleSelectMode(on: boolean): void {
  if (aquarelleSelectMode.value === on) return;
  aquarelleSelectMode.value = on;
  // Leaving select mode drops the highlight and any in-flight ghost so a
  // later re-arm starts clean (compare-then-write clear).
  if (!on) {
    selectAquarelleStroke(null);
    clearAquarelleStrokeDrag();
  }
}

export function toggleAquarelleSelectMode(): void {
  setAquarelleSelectMode(!aquarelleSelectMode.value);
}

/**
 * 261022-tv1: the live drag preview. Written in the overlay's pointer
 * handlers, read ONLY by that overlay leaf (the ghost). No Studio or layer
 * render body subscribes to it, and nothing but the ghost render depends on
 * it — no script mutation or apply happens while a drag is in progress.
 */
export interface AquarelleStrokeDrag {
  readonly mutationId: number;
  readonly dxPx: number;
  readonly dyPx: number;
}

export const aquarelleStrokeDrag = signal<AquarelleStrokeDrag | null>(null);

/** Compare-then-write on all three fields (efx-preact-reactivity rule 3). */
export function setAquarelleStrokeDrag(next: AquarelleStrokeDrag | null): void {
  const current = aquarelleStrokeDrag.value;
  if (next === null) {
    if (current === null) return;
    aquarelleStrokeDrag.value = null;
    return;
  }
  if (
    current !== null
    && current.mutationId === next.mutationId
    && current.dxPx === next.dxPx
    && current.dyPx === next.dyPx
  ) {
    return;
  }
  aquarelleStrokeDrag.value = { mutationId: next.mutationId, dxPx: next.dxPx, dyPx: next.dyPx };
}

/** Idempotent clear — a pointer-up/cancel with no drag armed is a no-op. */
export function clearAquarelleStrokeDrag(): void {
  setAquarelleStrokeDrag(null);
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

/** Bounding box inflated by half the brush size on every side. */
export function aquarelleStrokeBoundsPx(
  points: readonly CanvasPoint[],
  brushSize: number,
): AquarelleStrokeBounds {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const pad =
    Number.isFinite(brushSize) && brushSize > 0
      ? Math.max(MIN_STROKE_PAD_PX, brushSize / 2)
      : MIN_STROKE_PAD_PX;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
}

function distanceToSegmentPx(
  px: number,
  py: number,
  a: CanvasPoint,
  b: CanvasPoint,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - a.x, py - a.y);
  const t = Math.max(
    0,
    Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lengthSq),
  );
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

function hitsStroke(
  pointPx: CanvasPoint,
  pointsPx: readonly CanvasPoint[],
  radius: number,
): boolean {
  if (pointsPx.length === 0) return false;
  if (pointsPx.length === 1) {
    return Math.hypot(pointPx.x - pointsPx[0]!.x, pointPx.y - pointsPx[0]!.y) <= radius;
  }
  for (let index = 1; index < pointsPx.length; index += 1) {
    if (
      distanceToSegmentPx(
        pointPx.x,
        pointPx.y,
        pointsPx[index - 1]!,
        pointsPx[index]!,
      ) <= radius
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Newest-first hit-test: when ribbons overlap, the last recorded stroke wins.
 * Frame-scoped and deleted-scoped — an invisible stroke can never be the
 * delete target.
 */
export function hitTestAquarelleStroke(
  pointPx: CanvasPoint,
  playFrame: number,
  size: EnginePixelSize,
): number | null {
  void aquarelleStrokesRevision.value;
  const entries = Array.from(getRecordedAquarelleStrokeEntries().entries()).reverse();
  for (const [mutationId, stroke] of entries) {
    if (isAquarelleStrokeDeleted(mutationId)) continue;
    if ((stroke.playFrame ?? 0) !== playFrame) continue;
    const pointsPx = aquarelleStrokePointsPx(stroke, size);
    if (hitsStroke(pointPx, pointsPx, strokeRadiusPx(stroke))) return mutationId;
  }
  return null;
}

/** Hit-test then select — the pointer handler's ONE selection write. */
export function selectAquarelleStrokeAt(
  pointPx: CanvasPoint,
  playFrame: number,
  size: EnginePixelSize,
): number | null {
  const hit = hitTestAquarelleStroke(pointPx, playFrame, size);
  selectAquarelleStroke(hit);
  return hit;
}

function decimatePoints(points: readonly CanvasPoint[]): CanvasPoint[] {
  if (points.length <= MAX_POLYLINE_POINTS) return [...points];
  const out: CanvasPoint[] = [];
  for (let index = 0; index < MAX_POLYLINE_POINTS; index += 1) {
    const sourceIndex = Math.round(
      (index * (points.length - 1)) / (MAX_POLYLINE_POINTS - 1),
    );
    out.push(points[sourceIndex]!);
  }
  return out;
}

/**
 * Every selectable stroke of the frame in recording order. Reads the
 * revision so a narrow leaf re-renders when the stroke set changes.
 */
export function listSelectableAquarelleStrokes(
  playFrame: number,
  size: EnginePixelSize,
): SelectableAquarelleStroke[] {
  void aquarelleStrokesRevision.value;
  const out: SelectableAquarelleStroke[] = [];
  for (const [mutationId, stroke] of getRecordedAquarelleStrokeEntries()) {
    if (isAquarelleStrokeDeleted(mutationId)) continue;
    if ((stroke.playFrame ?? 0) !== playFrame) continue;
    const pointsPx = aquarelleStrokePointsPx(stroke, size);
    out.push({
      mutationId,
      pointsPx: decimatePoints(pointsPx),
      // Bounds use every point — decimation must never clip the box ends.
      bounds: aquarelleStrokeBoundsPx(pointsPx, Number(stroke.params['size'])),
    });
  }
  return out;
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

export function setAquarelleScriptEditInFlight(inFlight: boolean): void {
  aquarelleScriptEditInFlight = inFlight;
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

function clearSelectionIfGone(): void {
  const selected = aquarelleSelectedStrokeMutationId.value;
  if (selected === null) return;
  if (
    !getRecordedAquarelleStrokeEntries().has(selected)
    || isAquarelleStrokeDeleted(selected)
  ) {
    selectAquarelleStroke(null);
  }
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

/**
 * Delete one recorded stroke as a single edit and store its before/after
 * snapshots. Returns a monotonic edit id or null when refused.
 */
export function beginAquarelleDeleteEdit(mutationId: number): number | null {
  // A delete/apply must never leave a drag ghost behind.
  clearAquarelleStrokeDrag();
  if (aquarelleScriptEditInFlight) return null;
  const before = captureAquarelleSnapshot();
  if (!deleteAquarelleStrokeFromScript(mutationId)) return null;
  const after = captureAquarelleSnapshot();
  const editId = storeAquarelleEdit({ before, after });
  if (aquarelleSelectedStrokeMutationId.value === mutationId) selectAquarelleStroke(null);
  // The last stroke is gone: there is nothing left to select, and leaving
  // select mode on would keep the overlay (painting blocked) behind a now
  // disabled Select button.
  if (aquarelleLiveStrokeCount.value === 0) setAquarelleSelectMode(false);
  return editId;
}

/**
 * 261022-tv1: move one recorded stroke by a document-UV delta as a single
 * edit (move + its re-bake = ONE `aquarelle-script` ledger command). The
 * selection is kept — the stroke still exists, at its new place. Returns a
 * monotonic edit id or null when refused.
 */
export function beginAquarelleMoveEdit(
  mutationId: number,
  dxUv: number,
  dyUv: number,
): number | null {
  // A move/apply must never leave the released ghost behind.
  clearAquarelleStrokeDrag();
  if (aquarelleScriptEditInFlight) return null;
  const before = captureAquarelleSnapshot();
  if (!translateAquarelleStrokeInScript(mutationId, dxUv, dyUv)) return null;
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
