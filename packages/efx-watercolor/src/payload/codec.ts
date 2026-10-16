// ============================================================
//  codec.ts — aquarelle script payload codec (AQUA-05 / AQUA-06).
//
//  One codec for the one payload union (D-16): strokes AND Dry
//  events. serialize/parse are total and fail-closed (null on
//  any malformed input, null on unknown schemaVersion — never
//  throw). Order is preserved exactly (no sort, no dedupe).
//
//  Wire form is { schemaVersion, event } — unknown or missing
//  schemaVersion refuses (P5 / DATA-01). parse(serialize(x))
//  deep-equals x. Ticks are integer host-grid values (DATA-03).
//  No unseeded RNG (D-20). No second events array (D-16).
// ============================================================

import type { StudioStroke, StudioPoint } from '@efxlab/efx-paint-host/animation'
import type { HostScriptRefusalCode } from '@efxlab/efx-paint-host'
import {
  isAquarelleDryEvent,
  type AquarelleDryEvent,
  type AquarellePayloadEvent,
} from './dryEvent'
import {
  AQUARELLE_TOOLS,
  DIFFUSION_CAP,
  type AquarelleStrokePayload,
} from './toStudioStroke'

/** Script payload schema version (P5 / DATA-01 — unknown refuses). */
export const AQUARELLE_SCHEMA_VERSION = 1

/** Wire envelope carrying one payload event. */
export interface AquarelleWireEvent {
  schemaVersion: number
  event: AquarellePayloadEvent
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isIntegerTick(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0
}

const TOOL_OVERRIDE_KEYS = [
  'tip',
  'aspect',
  'rotation',
  'sizeCurve',
  'scatter',
  'capacity',
  'grain',
  'wetRound',
] as const

function isToolOverrides(value: unknown): value is Record<string, number> {
  if (!isRecord(value)) return false
  for (const key of TOOL_OVERRIDE_KEYS) {
    const v = value[key]
    if (v !== undefined && !isFiniteNumber(v)) return false
  }
  return true
}

function isStudioPoint(value: unknown): value is StudioPoint {
  if (!isRecord(value)) return false
  return (
    isFiniteNumber(value['x']) &&
    isFiniteNumber(value['y']) &&
    isFiniteNumber(value['p']) &&
    isFiniteNumber(value['tx']) &&
    isFiniteNumber(value['ty']) &&
    isFiniteNumber(value['tw']) &&
    isIntegerTick(value['tick'])
  )
}

function isDryEventShape(value: unknown): value is AquarelleDryEvent {
  if (!isRecord(value)) return false
  if (value['kind'] !== 'dry') return false
  if (!isIntegerTick(value['tick'])) return false
  if (!isFiniteNumber(value['recordedOrder'])) return false
  // D-16: no pts, no brush fields on a Dry event.
  if ('pts' in value || 'brushId' in value || 'brush' in value || 'tool' in value) {
    return false
  }
  return true
}

function isStrokeShape(value: unknown): value is StudioStroke<AquarelleStrokePayload> {
  if (!isRecord(value)) return false
  if (!Array.isArray(value['pts'])) return false
  if (!value['pts'].every(isStudioPoint)) return false
  if (!isFiniteNumber(value['ticks']) || value['ticks'] < 1) return false
  if (!isFiniteNumber(value['cuisson']) || value['cuisson'] < 0) return false
  if (!('motion' in value)) return false
  if (typeof value['brushId'] !== 'string') return false
  if (!isToolOverrides(value['toolOverrides'])) return false
  if (!isFiniteNumber(value['traceSeed'])) return false
  if (!isFiniteNumber(value['recordedOrder'])) return false
  if (!('playFrame' in value)) return false
  if (!('color' in value)) return false
  const engine = value['engine']
  if (!isRecord(engine)) return false
  if (typeof engine['tool'] !== 'string') return false
  if (!(AQUARELLE_TOOLS as readonly string[]).includes(engine['tool'])) return false
  if (typeof engine['brushId'] !== 'string') return false
  if (!isRecord(engine['params'])) return false
  if (!isFiniteNumber(engine['timestamp'])) return false
  return true
}

function clampDiffusion(value: number | undefined): number | undefined {
  if (value === undefined) return undefined
  if (!isFiniteNumber(value) || value <= 0) return 0
  return Math.min(DIFFUSION_CAP, Math.trunc(value))
}

function cloneStrokeForWire(
  stroke: StudioStroke<AquarelleStrokePayload>,
): StudioStroke<AquarelleStrokePayload> {
  const cuisson = Math.min(DIFFUSION_CAP, Math.max(0, Math.trunc(stroke.cuisson)))
  const diffusionFrames = clampDiffusion(stroke.engine.diffusionFrames)
  return {
    pts: stroke.pts.map((p) => ({ ...p })),
    ticks: stroke.ticks,
    cuisson,
    motion: stroke.motion ? { ...stroke.motion } : null,
    brushId: stroke.brushId,
    toolOverrides: { ...stroke.toolOverrides },
    traceSeed: stroke.traceSeed,
    recordedOrder: stroke.recordedOrder,
    playFrame: stroke.playFrame,
    color: stroke.color,
    engine: {
      ...stroke.engine,
      params: { ...stroke.engine.params },
      toolOverrides: stroke.engine.toolOverrides
        ? { ...stroke.engine.toolOverrides }
        : undefined,
      diffusionFrames,
    },
  }
}

function cloneDryForWire(dry: AquarelleDryEvent): AquarelleDryEvent {
  return { kind: 'dry', tick: dry.tick, recordedOrder: dry.recordedOrder }
}

/**
 * Serialize one payload event to the wire form (schemaVersion
 * stamped). Accepts strokes and Dry events. Clamps
 * `diffusionFrames` / `cuisson` to DIFFUSION_CAP (D-19). Total:
 * throws only on a non-event input (caller bug).
 */
export function serialize(event: AquarellePayloadEvent): AquarelleWireEvent {
  if (isAquarelleDryEvent(event)) {
    return {
      schemaVersion: AQUARELLE_SCHEMA_VERSION,
      event: cloneDryForWire(event),
    }
  }
  if (!isStrokeShape(event)) {
    throw new TypeError('payloadCodec.serialize: expected an AquarellePayloadEvent')
  }
  return {
    schemaVersion: AQUARELLE_SCHEMA_VERSION,
    event: cloneStrokeForWire(event),
  }
}

/**
 * Parse a raw wire event. Total and fail-closed: returns null on
 * any malformed input or unknown schemaVersion, never throws.
 * Order is not applied here — callers sort with
 * comparePayloadEvents when a total order is required.
 */
export function parse(raw: unknown): AquarellePayloadEvent | null {
  if (!isRecord(raw)) return null
  if (raw['schemaVersion'] !== AQUARELLE_SCHEMA_VERSION) return null
  const event = raw['event']
  if (isDryEventShape(event)) return cloneDryForWire(event)
  if (isStrokeShape(event)) return cloneStrokeForWire(event)
  return null
}

/**
 * EngineAdapter.payloadCodec shape for the one payload union.
 * The host never reads `P` — this codec is engine-owned.
 */
export const payloadCodec = {
  serialize,
  parse,
}

// ---------------------------------------------------------------------------
// Fail-closed refusal codes (MOD-05 / D-25 / DATA-02).
//
// Host yields CODES; the Studio names them on the owned-refusal surface
// (55-06 D-09..D-11). These two helpers are the codec-side door: a null parse
// is a named refusal, never a silent drop, never a half-apply. Cross-engine
// discrimination is the envelope's engineId job — this codec only owns the
// payload-shape arm.
// ---------------------------------------------------------------------------

/**
 * Map a failed aquarelle payload parse to the host refusal code. Returns
 * `malformed-engine-payload` when the wire form is unreadable (bad shape /
 * unknown schemaVersion), `null` when it parses. Never throws.
 */
export function classifyAquarellePayloadFailure(raw: unknown): HostScriptRefusalCode | null {
  return parse(raw) === null ? 'malformed-engine-payload' : null
}

/**
 * Build the engine-mismatch refusal for a foreign-engine script offered to an
 * aquarelle target (or the reverse). `detail` carries the package-id pair
 * `"<scriptEngineId>:<targetEngineId>"` so the Studio mapper can name both
 * engines via ENGINE_DISPLAY_NAMES (D-15). Total; never throws.
 */
export function buildEngineMismatchRefusal(
  scriptEngineId: string,
  targetEngineId: string,
): { code: 'engine-mismatch'; detail: string } {
  return { code: 'engine-mismatch', detail: `${scriptEngineId}:${targetEngineId}` }
}
