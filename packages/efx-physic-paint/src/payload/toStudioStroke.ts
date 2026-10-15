// ============================================================
//  toStudioStroke — the single engine-1 → StudioStroke<P> projection
//  (HOST-02 / D-19). This is the ONLY place engine-1 field names
//  meet host field names. After it, host schedules see only
//  StudioStroke<P> shared fields — the host never reads P.
//
//  FIELD-MAPPING CONTRACT (identical words to 55-05's serialize
//  mapping — one law in two places; keep them in lockstep):
//    pts[].tick   ← sample index i (0-based, monotonic)
//    ticks        ← max(1, pts.length - 1)
//    cuisson      ← diffusionFrames when > 0, else 0 (capped at 600)
//    motion       ← null
//    brushId      ← 'efx-physic-paint'
//    toolOverrides ← {}
//    traceSeed    ← hashMutationId(mutationId)
//    recordedOrder ← timestamp (ordering key, never a playback clock)
//    playFrame    ← playFrame ?? null
//    engine       ← opaque engine-1 private fields
// ============================================================

import type { PaintStroke, PenPoint } from '../types'
import { hashMutationId } from '@efxlab/efx-paint-host'
import type { StudioStroke, StudioPoint } from '@efxlab/efx-paint-host/animation'

/** Engine-1 private fields carried in the opaque `engine: P` slot. */
export interface PhysicStrokePayload {
  tool: string
  color: string | null
  params: Record<string, number>
  mutationId?: number
  hasPenInput?: boolean
  physicsMode?: string | null
  diffusionFrames?: number
  timestamp: number
  playFrame?: number
}

const DIFFUSION_CAP = 600

/**
 * Project an engine-1 runtime `PaintStroke` onto the host `StudioStroke<P>`
 * contract. The single engine-boundary projection (D-19).
 */
export function toStudioStroke(s: Readonly<PaintStroke>): StudioStroke<PhysicStrokePayload> {
  const pts: StudioPoint[] = s.points.map((p, i) => ({
    x: p.x, y: p.y, p: p.p, tx: p.tx, ty: p.ty, tw: p.tw, tick: i,
  }))
  return {
    pts,
    ticks: Math.max(1, pts.length - 1),
    cuisson: s.diffusionFrames !== undefined && s.diffusionFrames > 0
      ? Math.min(DIFFUSION_CAP, Math.trunc(s.diffusionFrames))
      : 0,
    motion: null,
    brushId: 'efx-physic-paint',
    toolOverrides: {},
    traceSeed: hashMutationId(s.mutationId),
    recordedOrder: s.timestamp,
    playFrame: s.playFrame ?? null,
    color: s.color,
    engine: {
      tool: s.tool,
      color: s.color,
      params: { ...s.params } as Record<string, number>,
      mutationId: s.mutationId,
      hasPenInput: s.hasPenInput,
      physicsMode: s.physicsMode ?? null,
      diffusionFrames: s.diffusionFrames,
      timestamp: s.timestamp,
      playFrame: s.playFrame,
    },
  }
}

/**
 * Project a `StudioStroke<PhysicStrokePayload>` back to the engine-1 runtime
 * `PaintStroke` shape. Used at engine call sites that still consume the
 * engine-1 stroke type (renderPartialStrokes, enqueueRecordedStroke).
 */
export function fromStudioStroke(s: StudioStroke<PhysicStrokePayload>): PaintStroke {
  const points: PenPoint[] = s.pts.map((p) => ({
    x: p.x, y: p.y, p: p.p, tx: p.tx, ty: p.ty, tw: p.tw, spd: 0,
  }))
  return {
    tool: s.engine.tool as PaintStroke['tool'],
    points,
    color: s.color,
    params: s.engine.params as unknown as PaintStroke['params'],
    timestamp: s.recordedOrder,
    mutationId: s.engine.mutationId,
    hasPenInput: s.engine.hasPenInput,
    diffusionFrames: s.engine.diffusionFrames,
    playFrame: s.playFrame ?? undefined,
    physicsMode: s.engine.physicsMode as PaintStroke['physicsMode'],
  }
}
