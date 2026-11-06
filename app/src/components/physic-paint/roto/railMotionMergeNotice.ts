/**
 * Rail-motion merge-drop notice (Phase 59, 59-12 Task 4; MOTN-10).
 *
 * Session-only settlement metadata: when a rail merge drops rail motion, the
 * reconciler reports the dropped rail id and its prior app-frame span through
 * the 59-15 settlement. This module publishes that report into ONE module-scope
 * signal and builds the plain-sentence copy the strip renders verbatim.
 *
 * Ownership contract: the notice NEVER persists, never joins a document
 * allowlist, never enters the revision or any fingerprint, and never triggers a
 * store write, revision bump or undo entry. Two named writers own the signal
 * (publish / dismiss); there is no effect and no render-body write.
 */

import { signal } from '@preact/signals';
import type { PhysicPaintRailMotionMergeNotice } from '../../../types/physicPaint';

/** The one session slot. A second notice replaces the first — no queue. */
export const railMotionMergeNotice = signal<PhysicPaintRailMotionMergeNotice | null>(null);

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
 * Replaces the single session slot. An invalid report changes nothing and
 * reports null, so the previous notice (still on screen) is never half-replaced.
 */
export function publishRailMotionMergeNotice(
  input: CreateRailMotionMergeNoticeInput | null,
): PhysicPaintRailMotionMergeNotice | null {
  const notice = input === null ? null : createRailMotionMergeNotice(input);
  if (notice === null) return null;
  railMotionMergeNotice.value = notice;
  return notice;
}

/** The one clearing writer. Dismiss and the accepted restoring undo call it. */
export function dismissRailMotionMergeNotice(): void {
  railMotionMergeNotice.value = null;
}

/**
 * The guarded-action plain-sentence convention: one sentence naming the dropped
 * app-frame span exactly as the reconciler reported it, plus the undo promise.
 * The strip renders this string verbatim.
 */
export function buildRailMotionMergeNoticeCopy(
  notice: PhysicPaintRailMotionMergeNotice,
): string {
  return `Merged rails — motion on frames ${notice.startFrame}–${notice.endFrameExclusive} was removed. Undo restores it.`;
}
