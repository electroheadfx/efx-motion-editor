// ============================================================
//  Typed host script refusals (D-09 / D-11 / D-14).
//
//  Host stays UI-free: this module yields CODES only. The Studio
//  boundary names them (55-06) on the owned-refusal surface.
//  No user-facing English sentence lives here.
// ============================================================

import { parseStudioScriptEnvelope } from './parse'

/** Named refusal codes for script parse / apply failures (D-11). */
export type HostScriptRefusalCode =
  | 'unknown-engine-id'
  | 'malformed-engine-payload'
  | 'engine-mismatch'
  | 'unreadable-legacy-script'

/**
 * Typed refusal object. Carries a code and an optional machine detail
 * (field name, discriminator) — NEVER a user-facing sentence (D-09).
 */
export interface HostScriptRefusal {
  code: HostScriptRefusalCode
  detail?: string
}

/** Build a UI-free refusal object. */
export function makeRefusal(code: HostScriptRefusalCode, detail?: string): HostScriptRefusal {
  return detail === undefined ? { code } : { code, detail }
}

/**
 * The pre-envelope on-disk kind (v1.0.1). Recognized ONLY to refuse it
 * (D-13/D-14 clean break). No reader, no migration, no dual-format path.
 */
const LEGACY_SCRIPT_KIND = 'efx-physics-paint-roto-script'

const ENVELOPE_KIND = 'efx-studio-paint-script'

const KNOWN_ENGINE_IDS = new Set<string>(['efx-physic-paint', 'efx-watercolor', 'efx-krita'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Map a failed envelope parse to a named refusal code. Returns `null`
 * when the raw document parses as a shared envelope (the engine payload
 * is still opaque to the host).
 *
 * Ordering law (D-14): the legacy kind is recognized FIRST and always
 * yields `unreadable-legacy-script` — it is a clean-break refusal, not a
 * malformed modern document.
 */
export function classifyEnvelopeParseFailure(raw: unknown): HostScriptRefusalCode | null {
  if (parseStudioScriptEnvelope(raw) !== null) return null

  if (isRecord(raw) && raw.kind === LEGACY_SCRIPT_KIND) return 'unreadable-legacy-script'

  if (
    isRecord(raw)
    && raw.kind === ENVELOPE_KIND
    && typeof raw.engineId === 'string'
    && raw.engineId.length > 0
    && !KNOWN_ENGINE_IDS.has(raw.engineId)
  ) {
    return 'unknown-engine-id'
  }

  return 'malformed-engine-payload'
}
