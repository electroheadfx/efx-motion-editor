// ============================================================
//  aquarelleSheetSignature — RED stub (64-28 Task 1).
//
//  The canonical whole-event digest lands in the GREEN commit. This
//  stub exists so the RED gate fails on the planned ASSERTIONS (a
//  module-not-found run asserts nothing and is INVALID_RED, #3770).
// ============================================================

import type { AquarellePayloadEvent } from '@efxlab/efx-watercolor';

export function aquarelleSheetSignature(_events: readonly AquarellePayloadEvent[]): number {
  return 0;
}
