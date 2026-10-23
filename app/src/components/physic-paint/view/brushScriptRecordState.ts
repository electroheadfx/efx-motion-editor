// ============================================================
//  brushScriptRecordState — the session-level, per-frame Brush
//  script store (quick 261023-g4p).
//
//  WHY: navigation calls `engine.clear()`, so the engine only ever
//  holds the CURRENT frame. This module retains one immutable,
//  ordered RecordedStrokeGroup[] per frame for the Studio session.
//
//  COST LAW:
//    - Exactly ONE retained points copy per stroke, produced by
//      normalizeLogicalBrushes (the clipboard's projection).
//    - Capture is O(n) and runs only at frame leave, Move entry,
//      an explicit script edit, or a DEV read — NEVER per stroke
//      completion (that path only marks the frame dirty, O(1)).
//    - flush is a no-op when the frame is clean and already
//      captured; repeated flushes keep the same entry identity.
//
//  FRAME-ANCHOR LAW (fail closed): entries follow the physical key
//  lifecycle. A deleted key, an inserted/rippled frame, a deleted
//  slot, or any first divergent record position prunes EVERY
//  captured frame at or after the first divergent app frame.
//  Stale entries are never remapped — they are dropped.
//
//  COMPLETENESS LAW (261023-h9v): an entry is complete only when its
//  groups are the WHOLE frame content. A frame that arrived over a
//  cached pixel base is partial — its script holds only the strokes
//  painted since arrival, so navigation must keep the cached-pixel
//  path instead of restoring it. Completeness is sticky per entry;
//  only an explicit user clear (clearBrushScriptFrame) forgets the
//  arrival-base knowledge.
//
//  No Preact component, no effect, no Studio import. The revision
//  signal is read only by narrow leaves (the probe / overlay).
// ============================================================

import { signal } from '@preact/signals';
import type { PaintRenderSettings, PaintStroke } from '@efxlab/efx-physic-paint';
import {
  freezeRecordedStrokeGroups,
  normalizeLogicalBrushes,
  type RecordedStrokeGroup,
} from './recordedStrokeGroups';

export interface BrushScriptFrameTotals {
  strokes: number;
  points: number;
  approxBytes: number;
}

export interface BrushScriptFrameEntry extends BrushScriptFrameTotals {
  readonly frame: number;
  readonly groups: readonly Readonly<RecordedStrokeGroup>[];
  /**
   * 261023-h9v: true when the stored groups are the WHOLE frame content —
   * the frame arrived without a cached pixel base this session. A partial
   * entry retains only the strokes painted since arrival; hydration must
   * never replace the base pixels with such a script.
   */
  readonly complete: boolean;
  /** Sum of every continuation diffusion count, each capped at 600 frames. */
  readonly diffusionFrames: number;
  /**
   * 261023-j5b: the paint globals captured on the frame's first live paint
   * (localSpreadStrength / wetPaper / physicsStrength / paperGrain). The
   * faithful rebake applies them and restores the live globals afterwards,
   * so a slider change after painting cannot alter the replayed look.
   * STICKY: the first non-null snapshot wins across recaptures.
   */
  readonly paintSettings?: PaintRenderSettings | null;
}

export interface BrushScriptReportRow extends BrushScriptFrameTotals {
  frame: number;
  complete: boolean;
  diffusionFrames: number;
}

export interface BrushScriptReport {
  frames: BrushScriptReportRow[];
  totals: BrushScriptFrameTotals;
}

/** Monotonic bump read by narrow leaves (probe / overlay). Never subscribed by a render body. */
export const brushScriptRevision = signal(0);

const EMPTY_GROUPS: readonly Readonly<RecordedStrokeGroup>[] = Object.freeze([]);
const EMPTY_TOTALS: BrushScriptFrameTotals = Object.freeze({ strokes: 0, points: 0, approxBytes: 0 });
const encoder = new TextEncoder();

const brushScriptFrames = new Map<number, BrushScriptFrameEntry>();
/** O(1) dirty marks — the only thing stroke completion writes. */
const dirtyBrushScriptFrames = new Set<number>();
/**
 * 261023-h9v: frames whose arrival loaded a cached pixel base (or whose
 * entry was hydrated from a partial one). Only `true` is recorded; an
 * arrival with no base is a no-op, so a fresh frame stays complete.
 */
const arrivalBaseFrames = new Set<number>();

function bumpRevision(): void {
  brushScriptRevision.value = brushScriptRevision.value + 1;
}

function countPoints(groups: readonly Readonly<RecordedStrokeGroup>[]): number {
  let points = 0;
  for (const group of groups) {
    points += group.primary.points.length;
    for (const continuation of group.continuations ?? []) points += continuation.points.length;
  }
  return points;
}

/** Mirrors the engine's replay cap: one continuation contributes at most 600 frames. */
function countDiffusionFrames(groups: readonly Readonly<RecordedStrokeGroup>[]): number {
  let frames = 0;
  for (const group of groups) {
    for (const continuation of group.continuations ?? []) {
      frames += Math.max(0, Math.min(600, Math.trunc(continuation.diffusionFrames ?? 0)));
    }
  }
  return frames;
}

function measureApproxBytes(groups: readonly Readonly<RecordedStrokeGroup>[]): number {
  try {
    return encoder.encode(JSON.stringify(groups)).byteLength;
  } catch {
    // A cyclic/malformed stroke must never kill the capture — fall back to a
    // per-group sum (still the same documented JSON-UTF-8 method).
    let bytes = 0;
    for (const group of groups) {
      try {
        bytes += encoder.encode(JSON.stringify(group)).byteLength;
      } catch {
        // Unserializable group: contributes 0 bytes, never a throw.
      }
    }
    return bytes;
  }
}

/**
 * O(1) stroke-completion mark. No projection, no signal write.
 */
export function markBrushScriptFrameDirty(frame: number): void {
  dirtyBrushScriptFrames.add(frame);
}

/**
 * 261023-h9v arrival knowledge: `hadBase` true means the navigation into
 * this frame loaded cached pixels that the session script does not contain,
 * so every capture of the frame stays PARTIAL. A false note records nothing
 * (a fresh frame is complete).
 */
export function noteBrushScriptArrivalBase(frame: number, hadBase: boolean): void {
  if (hadBase) arrivalBaseFrames.add(frame);
}

/** True only for a captured frame whose stored groups are the whole content. */
export function isBrushScriptFrameComplete(frame: number): boolean {
  return brushScriptFrames.get(frame)?.complete === true;
}

/**
 * 261023-j5b follow-up: true when this frame's ledger is the whole content,
 * so a cached preview base that duplicates it must be cleared before a
 * faithful edit rebake. An uncaptured frame is complete unless a cached base
 * arrived this session (that base is content the session ledger lacks).
 */
export function isBrushScriptLedgerComplete(frame: number): boolean {
  const entry = brushScriptFrames.get(frame);
  if (entry) return entry.complete;
  return !arrivalBaseFrames.has(frame);
}

/**
 * Capture normalized groups for one frame. Callers pass the output of
 * normalizeLogicalBrushes; the groups are deep-frozen here and the entry is
 * immutable. Replaces any previous entry for the frame.
 *
 * Completeness is STICKY: once a frame is captured partial, a later arrival
 * note (or recapture) cannot promote it, and a frame captured complete stays
 * complete even if a later arrival note lands.
 */
export function captureBrushScriptForFrame(
  frame: number,
  groups: readonly Readonly<RecordedStrokeGroup>[],
  complete?: boolean,
  paintSettings?: PaintRenderSettings | null,
): BrushScriptFrameEntry {
  const entry = captureEntry(frame, groups, complete, paintSettings);
  bumpRevision();
  return entry;
}

/**
 * The shared capture body WITHOUT the revision bump, so a restore can seed
 * every frame and bump ONCE (quick-261023-l35) instead of once per frame.
 */
function captureEntry(
  frame: number,
  groups: readonly Readonly<RecordedStrokeGroup>[],
  complete?: boolean,
  paintSettings?: PaintRenderSettings | null,
): BrushScriptFrameEntry {
  const frozen = freezeRecordedStrokeGroups(groups);
  const previous = brushScriptFrames.get(frame);
  const entry: BrushScriptFrameEntry = Object.freeze({
    frame,
    groups: frozen,
    strokes: frozen.length,
    points: countPoints(frozen),
    approxBytes: measureApproxBytes(frozen),
    // Explicit caller override wins; otherwise the existing entry's flag is
    // sticky, and a first capture is complete unless its arrival had a base.
    complete: complete ?? (previous ? previous.complete : !arrivalBaseFrames.has(frame)),
    diffusionFrames: countDiffusionFrames(frozen),
    // 261023-j5b: sticky paint globals — the first non-null snapshot wins.
    paintSettings: previous?.paintSettings ?? paintSettings ?? null,
  });
  brushScriptFrames.set(frame, entry);
  dirtyBrushScriptFrames.delete(frame);
  return entry;
}

/**
 * Frame-leave / Move-entry / edit refresh. `strokes === null` (no engine) is
 * refused. A clean, already-captured frame keeps its entry identity. An empty
 * projection deletes any stale entry instead of storing a zero row.
 */
export function flushBrushScriptFrame(
  frame: number,
  strokes: readonly PaintStroke[] | null,
  paintSettings?: PaintRenderSettings | null,
): boolean {
  if (strokes === null) return false;
  const wasDirty = dirtyBrushScriptFrames.delete(frame);
  if (!wasDirty && brushScriptFrames.has(frame)) return false;
  const groups = normalizeLogicalBrushes(strokes);
  if (groups.length === 0) {
    // An emptied frame must not keep a ghost row (undo-all / clear without a
    // completed 'clear' mutation).
    if (brushScriptFrames.delete(frame)) bumpRevision();
    return false;
  }
  captureBrushScriptForFrame(frame, groups, undefined, paintSettings);
  return true;
}

/**
 * 261023-j5b follow-up: claim a frame whose ledger is the WHOLE content BY
 * CONSTRUCTION. A Duplicate destination was an EMPTY cell, so the promoted key
 * is blank and the applied script is everything it contains. An earlier
 * arrival observation may have seen the promoted BLANK base and marked the
 * frame partial; that base holds no content, so the claim clears it.
 *
 * This is the one sanctioned override of the sticky-completeness law and is
 * valid ONLY for a blank-born destination. Returns null for an empty ledger.
 */
export function adoptBrushScriptFrameAsComplete(
  frame: number,
  strokes: readonly PaintStroke[] | null,
  paintSettings?: PaintRenderSettings | null,
): BrushScriptFrameEntry | null {
  if (strokes === null) return null;
  const groups = normalizeLogicalBrushes(strokes);
  if (groups.length === 0) return null;
  arrivalBaseFrames.delete(frame);
  return captureBrushScriptForFrame(frame, groups, true, paintSettings);
}

/** Read API — a shared frozen empty array when the frame was never captured. */
export function getBrushScriptForFrame(frame: number): readonly Readonly<RecordedStrokeGroup>[] {
  return brushScriptFrames.get(frame)?.groups ?? EMPTY_GROUPS;
}

export function getBrushScriptFrameEntry(frame: number): BrushScriptFrameEntry | undefined {
  return brushScriptFrames.get(frame);
}

/**
 * quick-261023-l35: every captured frame, ascending by frame — the snapshot
 * codec's save input (the report rows are a narrower, different shape).
 */
export function getBrushScriptFrameEntries(): readonly BrushScriptFrameEntry[] {
  return [...brushScriptFrames.values()].sort((left, right) => left.frame - right.frame);
}

/** One frame's restored content — the decode result, structurally. */
export interface BrushScriptRestoreEntry {
  frame: number;
  groups: readonly Readonly<RecordedStrokeGroup>[];
  complete: boolean;
  paintSettings?: PaintRenderSettings | null;
}

/**
 * quick-261023-l35: seed the whole store from a decoded snapshot. This is a
 * SESSION SEED, not a capture point: the map, dirty marks and arrival-base
 * notes are replaced wholesale, every entry's `complete` flag is kept
 * VERBATIM (no arrival-base promotion), and the revision bumps ONCE.
 * A zero-group frame is skipped — the store never retains a ghost row.
 * Returns the number of restored entries.
 */
export function restoreBrushScriptFrames(
  entries: readonly BrushScriptRestoreEntry[],
): number {
  brushScriptFrames.clear();
  dirtyBrushScriptFrames.clear();
  arrivalBaseFrames.clear();
  let restored = 0;
  for (const entry of entries) {
    if (entry.groups.length === 0) continue;
    captureEntry(entry.frame, entry.groups, entry.complete, entry.paintSettings);
    restored += 1;
  }
  if (restored > 0) bumpRevision();
  return restored;
}

/**
 * quick-261023-l35: drop every captured frame whose app frame is not in the
 * live real-key set (plus its dirty mark and arrival-base note). One bump.
 * Returns the number of removed entries.
 */
export function pruneBrushScriptFramesTo(keepFrames: ReadonlySet<number>): number {
  let removed = 0;
  for (const key of [...brushScriptFrames.keys()]) {
    if (keepFrames.has(key)) continue;
    brushScriptFrames.delete(key);
    dirtyBrushScriptFrames.delete(key);
    arrivalBaseFrames.delete(key);
    removed += 1;
  }
  if (removed > 0) bumpRevision();
  return removed;
}

/** quick-261023-l35: true when at least one frame is retained. */
export function hasBrushScriptFrames(): boolean {
  return brushScriptFrames.size > 0;
}

export function getBrushScriptTotals(): BrushScriptFrameTotals {
  let strokes = 0;
  let points = 0;
  let approxBytes = 0;
  for (const entry of brushScriptFrames.values()) {
    strokes += entry.strokes;
    points += entry.points;
    approxBytes += entry.approxBytes;
  }
  return { strokes, points, approxBytes };
}

/** Rows ascending by frame; totals sum entries only. */
export function getBrushScriptReport(): BrushScriptReport {
  const frames = [...brushScriptFrames.values()]
    .sort((left, right) => left.frame - right.frame)
    .map((entry) => ({
      frame: entry.frame,
      strokes: entry.strokes,
      points: entry.points,
      approxBytes: entry.approxBytes,
      complete: entry.complete,
      diffusionFrames: entry.diffusionFrames,
    }));
  return { frames, totals: getBrushScriptTotals() };
}

/**
 * Remove one frame — an internal empty projection. The frame's arrival-base
 * knowledge SURVIVES: a later capture of the same frame is still partial.
 */
export function deleteBrushScriptFrame(frame: number): boolean {
  dirtyBrushScriptFrames.delete(frame);
  if (!brushScriptFrames.delete(frame)) return false;
  bumpRevision();
  return true;
}

/**
 * 261023-h9v: drop one frame AND its arrival-base knowledge — an explicit
 * user clear empties the frame, so a later capture starts from scratch.
 */
export function clearBrushScriptFrame(frame: number): boolean {
  dirtyBrushScriptFrames.delete(frame);
  arrivalBaseFrames.delete(frame);
  if (!brushScriptFrames.delete(frame)) return false;
  bumpRevision();
  return true;
}

/** Studio disposal / launch replacement reset. */
export function resetBrushScriptStore(): void {
  dirtyBrushScriptFrames.clear();
  arrivalBaseFrames.clear();
  if (brushScriptFrames.size === 0) return;
  brushScriptFrames.clear();
  bumpRevision();
}

/**
 * FAIL-CLOSED prune: drop every captured frame at or after `frame`.
 * Returns the number of removed entries.
 */
export function pruneBrushScriptsFromFrame(frame: number): number {
  let removed = 0;
  for (const key of [...brushScriptFrames.keys()]) {
    if (key < frame) continue;
    brushScriptFrames.delete(key);
    dirtyBrushScriptFrames.delete(key);
    removed += 1;
  }
  for (const key of [...arrivalBaseFrames]) {
    if (key >= frame) arrivalBaseFrames.delete(key);
  }
  if (removed > 0) bumpRevision();
  return removed;
}

export interface BrushScriptFrameRecordAnchor {
  keyId: string;
  appFrame: number;
}

/**
 * PURE prune anchor: compare the physical key-record list before/after an
 * accepted edit and return the first divergent app frame, or null when the
 * lists are identical.
 *
 *  - deleted / inserted / rippled record → min(appFrame) at the first index
 *    whose keyId or appFrame differs;
 *  - identical common prefix with different lengths (tail append/delete) →
 *    the first record appFrame of the longer side at the boundary index;
 *  - identical → null.
 */
export function computeBrushScriptPruneFrame(
  before: readonly BrushScriptFrameRecordAnchor[],
  after: readonly BrushScriptFrameRecordAnchor[],
): number | null {
  const sortRecords = (records: readonly BrushScriptFrameRecordAnchor[]) =>
    [...records].sort((left, right) => left.appFrame - right.appFrame || left.keyId.localeCompare(right.keyId));
  const beforeSorted = sortRecords(before);
  const afterSorted = sortRecords(after);
  const common = Math.min(beforeSorted.length, afterSorted.length);
  for (let index = 0; index < common; index += 1) {
    const left = beforeSorted[index]!;
    const right = afterSorted[index]!;
    if (left.keyId === right.keyId && left.appFrame === right.appFrame) continue;
    return Math.min(left.appFrame, right.appFrame);
  }
  if (beforeSorted.length === afterSorted.length) return null;
  const longer = beforeSorted.length > afterSorted.length ? beforeSorted : afterSorted;
  return longer[common]?.appFrame ?? null;
}

/** Test-only visibility: the frozen empty read must stay identity-stable. */
export const EMPTY_BRUSH_SCRIPT_GROUPS = EMPTY_GROUPS;
export const EMPTY_BRUSH_SCRIPT_TOTALS = EMPTY_TOTALS;
