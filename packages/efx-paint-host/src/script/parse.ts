// ============================================================
//  Fail-closed StudioScriptEnvelope parse (D-12 refuse-before-write).
//  Total and pure: named failures return null and never throw.
//  Validates shared envelope fields only — the engine slot is
//  copied through unchanged (host never reads P, R2.2 / D-19).
// ============================================================

import type { StudioScriptEnvelope } from './payload'

const ENVELOPE_KIND = 'efx-studio-paint-script' as const
const ENVELOPE_SCHEMA_VERSION = 1 as const

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const ENGINE_IDS = new Set<string>(['efx-physic-paint', 'efx-watercolor', 'efx-krita'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isCanonicalId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function isNonEmptyName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const timestamp = Date.parse(value)
  return Number.isSafeInteger(timestamp) && timestamp >= 0
}

/**
 * Parse a raw script envelope.  Total and pure: every named failure yields
 * `null` and never throws.  The engine payload slot on each stroke is copied
 * through unchanged — the host never inspects `P`.
 */
export function parseStudioScriptEnvelope(
  raw: unknown,
): StudioScriptEnvelope<unknown> | null {
  if (!isRecord(raw)) return null

  if (raw.kind !== ENVELOPE_KIND) return null
  if (raw.schemaVersion !== ENVELOPE_SCHEMA_VERSION) return null

  if (typeof raw.engineId !== 'string' || !ENGINE_IDS.has(raw.engineId)) return null

  if (!isCanonicalId(raw.id)) return null
  if (!isNonEmptyName(raw.name)) return null

  if (!isIsoDate(raw.createdAt) || !isIsoDate(raw.updatedAt)) return null
  if (Date.parse(raw.updatedAt) < Date.parse(raw.createdAt)) return null

  if (!isRecord(raw.source)) return null
  if (!isRecord(raw.thumbnail)) return null
  if (!isRecord(raw.brushPack)) return null

  if (!Array.isArray(raw.strokes)) return null

  // Engine slot copied through untouched — host never reads P.
  return {
    kind: ENVELOPE_KIND,
    schemaVersion: ENVELOPE_SCHEMA_VERSION,
    engineId: raw.engineId as StudioScriptEnvelope<unknown>['engineId'],
    id: raw.id,
    name: raw.name,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    source: raw.source as unknown as StudioScriptEnvelope<unknown>['source'],
    thumbnail: raw.thumbnail as unknown as StudioScriptEnvelope<unknown>['thumbnail'],
    brushPack: raw.brushPack as unknown as StudioScriptEnvelope<unknown>['brushPack'],
    strokes: raw.strokes as unknown as StudioScriptEnvelope<unknown>['strokes'],
  }
}
