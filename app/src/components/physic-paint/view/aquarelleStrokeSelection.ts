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

import { computed } from '@preact/signals';
import { isAquarelleDryEvent, type AquarellePayloadEvent, type AquarelleStroke } from '@efxlab/efx-watercolor/payload';
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
  scriptSelectMode,
  scriptStrokeBoundsPx,
  scriptStrokeDrag,
  selectScriptStroke,
  setScriptSelectMode,
  setScriptStrokeDrag,
  type CanvasPoint,
  type ScriptStrokeBounds,
  type ScriptStrokeDrag,
  type ScriptStrokeEditionPort,
  type SelectableScriptStroke,
} from './scriptStrokeEdition';
import {
  aquarelleStrokeSerial,
  aquarelleStrokesRevision,
  bumpAquarelleStrokesRevision,
  captureAquarelleStrokeRegistry,
  clearAquarelleStrokeDeletion,
  deleteAquarelleStrokeFromScript,
  getAquarelleEventsForFrame,
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

// 261023-g4p: the ONE shared edition module (scriptStrokeEdition) owns the
// geometry, the select/drag signals and the group types. They are re-exported
// under the watercolor names — including IDENTITY aliases for the three
// signals — so every existing consumer compiles and behaves unchanged.
export type { CanvasPoint, ScriptStrokeBounds };
export type AquarelleStrokeBounds = ScriptStrokeBounds;
export type SelectableAquarelleStroke = SelectableScriptStroke;

/** Rail Move/Select toggle. Compare-then-write (shared signal alias). */
export const aquarelleSelectMode = scriptSelectMode;

/** The highlighted stroke (shared signal alias). */
export const aquarelleSelectedStrokeMutationId = scriptSelectedStrokeId;

export function selectAquarelleStroke(mutationId: number | null): void {
  selectScriptStroke(mutationId);
}

export function setAquarelleSelectMode(on: boolean): void {
  setScriptSelectMode(on);
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
    if (hitsScriptStroke(pointPx, pointsPx, strokeRadiusPx(stroke))) return mutationId;
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

/**
 * Every selectable stroke of the frame in recording order. Reads the
 * revision so a narrow leaf re-renders when the stroke set changes.
 */
export function listSelectableAquarelleStrokes(
  playFrame: number,
  size: EnginePixelSize,
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
  const out: SelectableAquarelleStroke[] = [];
  for (const [mutationId, stroke] of getRecordedAquarelleStrokeEntries()) {
    if (isAquarelleStrokeDeleted(mutationId)) continue;
    if ((stroke.playFrame ?? 0) !== playFrame) continue;
    // Serial assignment happens here in registry order for a loaded script
    // (recorded strokes already own theirs).
    const serial = aquarelleStrokeSerial(mutationId, playFrame);
    const pointsPx = aquarelleStrokePointsPx(stroke, size);
    const stackIndex = stackOrder.indexOf(mutationId);
    out.push({
      mutationId,
      pointsPx: decimateScriptPoints(pointsPx),
      // Bounds use every point — decimation must never clip the box ends.
      bounds: scriptStrokeBoundsPx(pointsPx, Number(stroke.params['size'])),
      serial,
      stackPosition: stackIndex < 0 ? stackTotal : stackTotal - stackIndex,
      stackTotal,
      color: typeof stroke.color === 'string' && stroke.color.length > 0 ? stroke.color : '#111827',
    });
  }
  return out;
}

/**
 * 261023-g4p: the watercolor half of the shared edition port. The Studio
 * registration adds `isActive` plus the delete/move/step callbacks (the same
 * handlers the rail gestures and the keyboard actions already use).
 */
export const aquarelleScriptStrokeEditionPort: Pick<
  ScriptStrokeEditionPort,
  'listStrokes' | 'hitTestStroke'
> = {
  listStrokes: (playFrame, size) => listSelectableAquarelleStrokes(playFrame, size),
  hitTestStroke: (pointPx, playFrame, size) => hitTestAquarelleStroke(pointPx, playFrame, size),
};

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
