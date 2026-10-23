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
//  No Preact component, no effect, no Studio import. The revision
//  signal is read only by narrow leaves (the probe / overlay).
// ============================================================

import { signal } from '@preact/signals';
import type { PaintStroke } from '@efxlab/efx-physic-paint';
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
}

export interface BrushScriptReport {
  frames: Array<BrushScriptFrameTotals & { frame: number }>;
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
 * Capture normalized groups for one frame. Callers pass the output of
 * normalizeLogicalBrushes; the groups are deep-frozen here and the entry is
 * immutable. Replaces any previous entry for the frame.
 */
export function captureBrushScriptForFrame(
  frame: number,
  groups: readonly Readonly<RecordedStrokeGroup>[],
): BrushScriptFrameEntry {
  const frozen = freezeRecordedStrokeGroups(groups);
  const entry: BrushScriptFrameEntry = Object.freeze({
    frame,
    groups: frozen,
    strokes: frozen.length,
    points: countPoints(frozen),
    approxBytes: measureApproxBytes(frozen),
  });
  brushScriptFrames.set(frame, entry);
  dirtyBrushScriptFrames.delete(frame);
  bumpRevision();
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
  captureBrushScriptForFrame(frame, groups);
  return true;
}

/** Read API — a shared frozen empty array when the frame was never captured. */
export function getBrushScriptForFrame(frame: number): readonly Readonly<RecordedStrokeGroup>[] {
  return brushScriptFrames.get(frame)?.groups ?? EMPTY_GROUPS;
}

export function getBrushScriptFrameEntry(frame: number): BrushScriptFrameEntry | undefined {
  return brushScriptFrames.get(frame);
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
    }));
  return { frames, totals: getBrushScriptTotals() };
}

/** Remove one frame. Returns true when an entry existed. */
export function deleteBrushScriptFrame(frame: number): boolean {
  dirtyBrushScriptFrames.delete(frame);
  if (!brushScriptFrames.delete(frame)) return false;
  bumpRevision();
  return true;
}

/** Studio disposal / launch replacement reset. */
export function resetBrushScriptStore(): void {
  dirtyBrushScriptFrames.clear();
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
