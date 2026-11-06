/**
 * Rail-motion merge-drop notice (Phase 59, 59-12 Task 4; MOTN-10; 59-20 CR-02).
 *
 * Session-only settlement metadata: when a rail merge drops rail motion, the
 * reconciler reports the dropped rail id and its prior app-frame span through
 * the 59-15 settlement. This module publishes that report into ONE module-scope
 * signal and builds the plain-sentence copy the strip renders verbatim.
 *
 * Undoability is a SESSION COMPANION SIGNAL, not a notice member: the notice
 * type (`PhysicPaintRailMotionMergeNotice`) is bridge-validated with a closed
 * key set, so a fourth member would break the bridge contract. The coordinator's
 * accepted settlement is one undo-ledger entry and keeps its restore promise;
 * the strip's direct cross-track move writes the store itself, creates no undo
 * entry, and publishes with `{ undoable: false }` so the copy tells the truth.
 *
 * Ownership contract: the notice NEVER persists, never joins a document
 * allowlist, never enters the revision or any fingerprint, and never triggers a
 * store write, revision bump or undo entry. Two named writers own both signals
 * (publish / dismiss); there is no effect and no render-body write.
 */

import { signal } from '@preact/signals';
import type { PhysicPaintRailMotionMergeNotice } from '../../../types/physicPaint';

/** The one session slot. A second notice replaces the first — no queue. */
export const railMotionMergeNotice = signal<PhysicPaintRailMotionMergeNotice | null>(null);

/**
 * Whether the CURRENT notice can be undone (59-20). Defaults to the undoable
 * settlement path; only an explicit `{ undoable: false }` withdraws the promise.
 */
export const railMotionMergeNoticeUndoable = signal(true);

/** Options shared by the publish writer and the copy builder. */
export interface RailMotionMergeNoticeOptions {
  /** Absent means undoable; only an explicit false withdraws the promise. */
  readonly undoable?: boolean;
}

/** Raw settlement input; validation happens in the factory, never here. */
export interface CreateRailMotionMergeNoticeInput {
  readonly railId: string;
  readonly startFrame: number;
  readonly endFrameExclusive: number;
}

const RAIL_ID_MAX_LENGTH = 256;

function isBoundedRailId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= RAIL_ID_MAX_LENGTH;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Validates the reconciler's drop report. It never repairs, clamps or invents
 * frames: any malformed or inverted span yields null and publishes nothing.
 */
export function createRailMotionMergeNotice(
  input: CreateRailMotionMergeNoticeInput,
): PhysicPaintRailMotionMergeNotice | null {
  if (!isBoundedRailId(input.railId)) return null;
  if (!isNonNegativeInteger(input.startFrame)) return null;
  if (!isNonNegativeInteger(input.endFrameExclusive)) return null;
  if (input.endFrameExclusive <= input.startFrame) return null;
  return Object.freeze({
    railId: input.railId,
    startFrame: input.startFrame,
    endFrameExclusive: input.endFrameExclusive,
  });
}

/**
 * Replaces the single session slot and stamps its undoability. An invalid report
 * changes NEITHER signal and reports null, so the previous notice (still on
 * screen) is never half-replaced.
 */
export function publishRailMotionMergeNotice(
  input: CreateRailMotionMergeNoticeInput | null,
  options?: RailMotionMergeNoticeOptions,
): PhysicPaintRailMotionMergeNotice | null {
  const notice = input === null ? null : createRailMotionMergeNotice(input);
  if (notice === null) return null;
  railMotionMergeNotice.value = notice;
  railMotionMergeNoticeUndoable.value = options?.undoable !== false;
  return notice;
}

/**
 * The one clearing writer. Dismiss and the accepted restoring undo call it.
 * The companion returns to the undoable default so the next publish without
 * options can never inherit a stale non-undoable verdict.
 */
export function dismissRailMotionMergeNotice(): void {
  railMotionMergeNotice.value = null;
  railMotionMergeNoticeUndoable.value = true;
}

/**
 * The guarded-action plain-sentence convention: one sentence naming the dropped
 * app-frame span exactly as the reconciler reported it. The default carries the
 * undo promise; a non-undoable path names the same span and states plainly that
 * the change cannot be undone — it NEVER promises a restore.
 */
export function buildRailMotionMergeNoticeCopy(
  notice: PhysicPaintRailMotionMergeNotice,
  options?: RailMotionMergeNoticeOptions,
): string {
  const span = `frames ${notice.startFrame}–${notice.endFrameExclusive}`;
  if (options?.undoable === false) {
    return `Merged rails — motion on ${span} was removed. This change cannot be undone.`;
  }
  return `Merged rails — motion on ${span} was removed. Undo restores it.`;
}
