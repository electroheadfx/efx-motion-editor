// ============================================================
//  codec.ts — aquarelle script payload codec (AQUA-05 / AQUA-06).
//
//  One codec for the one payload union (D-16): strokes AND Dry
//  events. serialize/parse are total and fail-closed (null on
//  any malformed input, null on unknown schemaVersion — never
//  throw). Order is preserved exactly (no sort, no dedupe).
//
//  Ticks are integer host-grid values (DATA-03 / D-19). Never
//  raw milliseconds. No unseeded RNG (D-20). No second events
//  array (D-16).
// ============================================================

import type { AquarellePayloadEvent } from './dryEvent'
import type { AquarelleStrokePayload } from './toStudioStroke'
import { DIFFUSION_CAP } from './toStudioStroke'
import type { StudioStroke } from '@efxlab/efx-paint-host/animation'

/** Script payload schema version (P5 / DATA-01 — unknown refuses). */
export const AQUARELLE_SCHEMA_VERSION = 1

/**
 * Serialize one payload event to the wire form (schemaVersion
 * stamped). Accepts strokes and Dry events.
 */
export function serialize(event: AquarellePayloadEvent): AquarellePayloadEvent {
  return event
}

/**
 * Parse a raw wire event. Total and fail-closed: returns null on
 * any malformed input or unknown schemaVersion, never throws.
 */
export function parse(raw: unknown): AquarellePayloadEvent | null {
  return null
}

/** EngineAdapter.payloadCodec shape for the one payload union. */
export const payloadCodec = {
  serialize,
  parse,
} as {
  serialize(event: unknown): StudioStroke<AquarelleStrokePayload> | AquarellePayloadEvent
  parse(raw: unknown): AquarellePayloadEvent | null
}
