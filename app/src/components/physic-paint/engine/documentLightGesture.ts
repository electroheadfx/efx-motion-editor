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
//  real edit (one fresh-id descriptor) or nothing (null).
//
//  RED stub: the coalescing law lands in GREEN. Returning null is
//  the "nothing was recorded" arm, so the span rows fail on their
//  planned assertions and the null rows pass as they should.
// ============================================================

import type { EfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import type { BackgroundEditDescriptor } from '../../../stores/efxPaintStore';

export function coalesceLightGesture(
  first: BackgroundEditDescriptor | null,
  after: EfxPaintDocument | null,
): BackgroundEditDescriptor | null {
  void first;
  void after;
  return null;
}
