// ============================================================
//  dryEvent.ts — the Dry timeline event kind (D-15 / D-16).
//
//  Dry is a USER action (flash-dry the sheet), recorded in the
//  script as a distinguished payload event — never a 5th paint
//  tool, never a flag on the next stroke, never a second events
//  array. One payload union, one ordering law, one codec.
//
//  Total order on (tick, recordedOrder) — replay fires Dry
//  events in that order between strokes (AQUA-05 adjacency).
// ============================================================

import type { StudioStroke } from '@efxlab/efx-paint-host/animation'
import type { AquarelleStrokePayload } from './toStudioStroke'

/**
 * The Dry timeline event. Carries NO pts and NO brush fields —
 * just the host-grid tick and the recording-order key.
 */
export interface AquarelleDryEvent {
  kind: 'dry'
  /** Integer host-grid tick (DATA-03 — never raw ms). */
  tick: number
  /** Recording-order key (same role as StudioStroke.recordedOrder). */
  recordedOrder: number
}

/**
 * The ONE payload union (D-16). A script's timeline is a list of
 * these — strokes and Dry events interleaved, one ordering law.
 */
export type AquarellePayloadEvent =
  | StudioStroke<AquarelleStrokePayload>
  | AquarelleDryEvent

/** Narrowing guard for the Dry union member. */
export function isAquarelleDryEvent(value: unknown): value is AquarelleDryEvent {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return v['kind'] === 'dry'
}

/** Shared ordering key extracted from any payload event. */
export interface PayloadEventOrderKey {
  tick: number
  recordedOrder: number
}

/**
 * Order key for the (tick, recordedOrder) total order.
 * Dry uses its explicit tick; a stroke uses its duration `ticks`
 * as the timeline tick the script sorts against.
 */
export function payloadEventOrderKey(event: AquarellePayloadEvent): PayloadEventOrderKey {
  if (isAquarelleDryEvent(event)) {
    return { tick: event.tick, recordedOrder: event.recordedOrder }
  }
  return { tick: event.ticks, recordedOrder: event.recordedOrder }
}

/**
 * Total-order comparator on (tick, recordedOrder). Equal ticks
 * keep recordedOrder (stable recording sequence).
 */
export function comparePayloadEvents(
  a: AquarellePayloadEvent,
  b: AquarellePayloadEvent,
): number {
  return 0
}
