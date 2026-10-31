// ============================================================
//  toStudioStroke — the single engine-2 → StudioStroke<P>
//  projection (HOST-02 / D-19). This is the ONLY place engine-2
//  field names meet host field names. After it, host schedules
//  see only StudioStroke<P> shared fields — the host never
//  reads P (R2.2). Engine-1 parameter names are prohibited
//  from P (mirror engine-1 projection discipline; never leak
//  engine-1 param names into P).
//
//  FIELD-MAPPING CONTRACT (identical words to engine-1's
//  toStudioStroke — one law in two places; keep them in lockstep):
//    pts[].tick   ← sample index i (0-based, monotonic)
//    ticks        ← max(1, pts.length - 1)
//    cuisson      ← diffusionFrames when > 0, else 0 (capped at 600)
//    motion       ← null
//    brushId      ← the selected tip id (stable brush-pack key)
//    toolOverrides ← the tip's 8 numeric multipliers snapshotted
//                  at record time (R1.7 / D-08) — {} when absent
//    traceSeed    ← hashMutationId(mutationId)   (D-20 / D-25),
//                   mixed with `paintSeedSalt` when recorded
//    recordedOrder ← timestamp (ordering key, never a playback clock)
//    playFrame    ← playFrame ?? null
//    engine       ← opaque engine-2 private fields
//
//  261031-cf9 — `paintSeedSalt` is a RESERVED HOST KEY inside the open
//  canonical `engine.params` bag (the persistence carrier, carried by
//  AQTL's open param record). Engine-2 never reads it: toEngineParams()
//  is a fixed projection of the canonical keys. `traceSeed` is its only
//  consumer — a finite, non-negative salt re-keys the per-stroke RNG so a
//  committed re-bake redraws the stochastic paint texture while points,
//  pressure, brush params, tool overrides and the paper seed stay fixed.
//  Absent (or malformed) keeps today's exact seed, byte for byte.
//
//  The ONE payload union (D-16) also carries Dry events — see
//  dryEvent.ts. This module owns the stroke projection; the union
//  type is re-exported here so callers meet both members at the
//  payload boundary.
// ============================================================

import { hashMutationId, mixStrokeSeed } from '@efxlab/efx-paint-host'
import type { StudioPoint, StudioStroke } from '@efxlab/efx-paint-host/animation'
import type { AquarelleToolOverrides } from '../brushes/tips'

// The one payload union accepts Dry events alongside strokes (D-16).
export type { AquarelleDryEvent, AquarellePayloadEvent } from './dryEvent'

/**
 * The only four tools that carry pts/brush payload (AQUA-02 / D-18).
 * Closed union — no fifth kind. Dry is a recorded timeline event,
 * not a paint tool (D-15).
 */
export type AquarelleTool = 'brush' | 'water' | 'pen' | 'lift'

/** Exhaustive tool list — the engine union is closed on these four. */
export const AQUARELLE_TOOLS: readonly AquarelleTool[] = Object.freeze([
  'brush',
  'water',
  'pen',
  'lift',
] as const)

/** Engine-2 private fields carried in the opaque `engine: P` slot. */
export interface AquarelleStrokePayload {
  tool: AquarelleTool
  color: string | null
  params: Record<string, number>
  brushId: string
  toolOverrides?: AquarelleToolOverrides
  mutationId?: number
  diffusionFrames?: number
  timestamp: number
  playFrame?: number
}

/** Host cap policy (55 D-20 / D-19) — engine-owned, script-visible. */
export const DIFFUSION_CAP = 600

/**
 * 261031-cf9: reserved host param key carrying the persisted paint seed
 * salt. It lives inside `engine.params` (open canonical bag) and is the
 * ONLY seed input beyond `mutationId` — never add it to
 * AQUARELLE_GLOBAL_KEYS (sliders must not write it).
 */
export const PAINT_SEED_SALT_PARAM = 'paintSeedSalt'

/**
 * Read the persisted paint seed salt. Total and fail-closed: only a finite
 * number is accepted (truncated to its integer part); absent, NaN,
 * Infinity, a string or a negative value all yield null — the stroke then
 * keeps today's exact `hashMutationId` seed. 0 is a valid salt.
 */
export function paintSeedSaltOf(
  params: Readonly<Record<string, unknown>> | undefined,
): number | null {
  const raw = params?.[PAINT_SEED_SALT_PARAM]
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null
  const salt = Math.trunc(raw)
  return salt < 0 ? null : salt
}

/** Raw stylus sample as the engine records it. */
export interface AquarellePoint {
  x: number
  y: number
  p: number
  tx: number
  ty: number
  tw: number
}

/** Runtime stroke shape the engine records (pre-projection). */
export interface AquarelleStroke {
  tool: AquarelleTool
  color: string | null
  params: Record<string, number>
  brushId: string
  points: readonly AquarellePoint[]
  toolOverrides?: AquarelleToolOverrides
  mutationId?: number
  diffusionFrames?: number
  timestamp: number
  playFrame?: number
}

/**
 * Project an engine-2 runtime stroke onto the host `StudioStroke<P>`
 * contract. The single engine-boundary projection (D-19).
 */
export function toStudioStroke(
  s: Readonly<AquarelleStroke>,
): StudioStroke<AquarelleStrokePayload> {
  const baseSeed = hashMutationId(s.mutationId)
  const salt = paintSeedSaltOf(s.params)
  const pts: StudioPoint[] = s.points.map((p, i) => ({
    x: p.x,
    y: p.y,
    p: p.p,
    tx: p.tx,
    ty: p.ty,
    tw: p.tw,
    tick: i,
  }))
  return {
    pts,
    ticks: Math.max(1, pts.length - 1),
    cuisson:
      s.diffusionFrames !== undefined && s.diffusionFrames > 0
        ? Math.min(DIFFUSION_CAP, Math.trunc(s.diffusionFrames))
        : 0,
    motion: null,
    brushId: s.brushId,
    toolOverrides: s.toolOverrides ? { ...s.toolOverrides } : {},
    traceSeed: salt === null ? baseSeed : mixStrokeSeed(baseSeed, salt),
    recordedOrder: s.timestamp,
    playFrame: s.playFrame ?? null,
    color: s.color,
    engine: {
      tool: s.tool,
      color: s.color,
      params: { ...s.params } as Record<string, number>,
      brushId: s.brushId,
      toolOverrides: s.toolOverrides ? { ...s.toolOverrides } : undefined,
      mutationId: s.mutationId,
      diffusionFrames: s.diffusionFrames,
      timestamp: s.timestamp,
      playFrame: s.playFrame,
    },
  }
}
