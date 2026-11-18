// ============================================================
//  64-18 (CR-02) — the light gesture coalescer.
//
//  The three light rows emit a continuous one-field patch stream
//  during a drag (the per-move document write is what re-lights
//  the live sheet). The unified ledger must receive exactly ONE
//  entry per gesture, so the Studio parks the FIRST descriptor of
//  the gesture and hands it here at the release boundary with the
//  document at release.
//
//  Purity: this module builds no document, reads no store and
//  keeps no module state. It only decides whether the span is a
//  real edit (one fresh-id descriptor) or nothing (null). The
//  equality law is the canonical `lightSignature` — absent light
//  and the explicit `DEFAULT_LIGHT` are the same picture.
// ============================================================

import type { EfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import type { BackgroundEditDescriptor } from '../../../stores/efxPaintStore';
import { lightSignature } from './physicsPaintStudioSettings';

export function coalesceLightGesture(
  first: BackgroundEditDescriptor | null,
  after: EfxPaintDocument | null,
): BackgroundEditDescriptor | null {
  if (!first || !after) return null;
  if (lightSignature(first.before.light) === lightSignature(after.light)) return null;
  return {
    operationId: crypto.randomUUID(),
    operationKind: first.operationKind,
    before: first.before,
    after,
  };
}
