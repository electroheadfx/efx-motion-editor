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
//    traceSeed    ← hashMutationId(mutationId)   (D-20 / D-25)
//    recordedOrder ← timestamp (ordering key, never a playback clock)
//    playFrame    ← playFrame ?? null
//    engine       ← opaque engine-2 private fields
// ============================================================

import { hashMutationId } from '@efxlab/efx-paint-host'
import type { StudioPoint, StudioStroke } from '@efxlab/efx-paint-host/animation'
import type { AquarelleToolOverrides } from '../brushes/tips'

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
    traceSeed: hashMutationId(s.mutationId),
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
