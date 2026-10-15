// ============================================================
//  createAquarelleEngineAdapter — engine-2's EngineAdapter<P>
//  plug point (HOST-02 / D-19). engineId 'efx-watercolor' is
//  already named in the host EngineId union.
//
//  payloadCodec is the 56-06 script codec (one payload union,
//  D-16) — parse is total and fail-closed (null on any
//  malformed input, never throws) — the host never reads P
//  (T-56-03 mitigation).
//
//  Play path: applyStroke deposits strokes; Dry events call the
//  engine's wet-state fix at their tick (D-15). Frame indices
//  never force-dry (P4 / D-28).
// ============================================================

import type {
  EngineAdapter,
  EngineId,
  StudioStroke,
} from '@efxlab/efx-paint-host'
import type { AquarelleStrokePayload } from '../payload/toStudioStroke'
import { toStudioStroke } from '../payload/toStudioStroke'
import {
  isAquarelleDryEvent,
  type AquarelleDryEvent,
  type AquarellePayloadEvent,
} from '../payload/dryEvent'
import { payloadCodec } from '../payload/codec'
import { depositStroke } from '../engine/deposit'
import type { DepositCanvas } from '../engine/deposit'
import { createSheet, isDrySheet, type FluidSheet } from '../engine/fluid'
import { forceDrySheet } from '../engine/drying'
import { findTip, TIPS } from '../brushes/tips'

export interface AquarelleAdapterOptions {
  width?: number
  height?: number
  canvas?: HTMLCanvasElement | DepositCanvas
}

/**
 * Accept an in-memory stroke/Dry (play path) by round-tripping it
 * through the script codec — same fail-closed validation the host
 * sees, plus the D-19 diffusion clamp.
 */
function acceptEvent(raw: unknown): AquarellePayloadEvent | null {
  if (typeof raw !== 'object' || raw === null) return null
  if (isAquarelleDryEvent(raw)) {
    return payloadCodec.parse(payloadCodec.serialize(raw))
  }
  return payloadCodec.parse(payloadCodec.serialize(raw as AquarellePayloadEvent))
}

export function createAquarelleEngineAdapter(
  options: AquarelleAdapterOptions = {},
): EngineAdapter<AquarelleStrokePayload> {
  const engineId: EngineId = 'efx-watercolor'
  const strokes: StudioStroke<AquarelleStrokePayload>[] = []
  const width = options.width ?? 0
  const height = options.height ?? 0
  const canvas = options.canvas
  let disposed = false
  let sheet: FluidSheet | null =
    width > 0 && height > 0 ? createSheet(width, height) : null

  const depositAll = (limit?: number): void => {
    if (disposed || !canvas) return
    const tip = TIPS[0]
    if (!tip) return
    const count = limit === undefined ? strokes.length : Math.min(limit, strokes.length)
    for (let i = 0; i < count; i++) {
      const stroke = strokes[i]
      if (!stroke) continue
      const strokeTip = findTip(stroke.brushId) ?? tip
      depositStroke(canvas, stroke, strokeTip, { width, height })
    }
  }

  /** User-initiated Dry (D-15) — wet-state fix at the event's tick. */
  const applyDry = (_dry: AquarelleDryEvent): void => {
    if (disposed) return
    if (sheet && !isDrySheet(sheet)) forceDrySheet(sheet)
  }

  return {
    engineId,
    // The 56-06 codec covers the one payload union (strokes + Dry).
    // The host EngineAdapter type is stroke-shaped because the host
    // never reads P and never sees Dry — cast through unknown at this
    // seam only (T-56-17: host never inspects the engine slot).
    payloadCodec: {
      serialize: (raw: unknown) => payloadCodec.serialize(raw as AquarellePayloadEvent),
      parse: (raw: unknown) => payloadCodec.parse(raw),
    } as unknown as EngineAdapter<AquarelleStrokePayload>['payloadCodec'],
    setInputLocked(_locked: boolean): void {
      /* live playback surface — AnimationPlayer wiring lands in a later plan */
    },
    setAnimationMode(_mode: boolean): void {
      /* live playback surface — AnimationPlayer wiring lands in a later plan */
    },
    getStrokes(): readonly StudioStroke<AquarelleStrokePayload>[] {
      return strokes
    },
    renderPartialStrokes(
      strokeData: ReadonlyArray<{ stroke: StudioStroke<AquarelleStrokePayload>; pointCount: number }>,
    ): void {
      if (disposed) return
      for (const entry of strokeData) {
        const existing = strokes.find((s) => s.traceSeed === entry.stroke.traceSeed)
        if (!existing) strokes.push(entry.stroke)
      }
      depositAll()
    },
    renderAllStrokes(): void {
      depositAll()
    },
    exportCompositeCanvas(): HTMLCanvasElement {
      return canvas as unknown as HTMLCanvasElement
    },
    applyStroke(stroke: StudioStroke<AquarelleStrokePayload>): void {
      if (disposed) return
      // Dry is a distinguished payload union member (D-16) — one
      // applyStroke seam, wet-state fix at the recorded tick.
      if (isAquarelleDryEvent(stroke)) {
        applyDry(stroke)
        return
      }
      const parsed = acceptEvent(stroke)
      if (!parsed || isAquarelleDryEvent(parsed)) return
      strokes.push(parsed)
      if (!canvas) return
      const tip = findTip(parsed.brushId) ?? TIPS[0]
      if (!tip) return
      depositStroke(canvas, parsed, tip, { width, height })
    },
    stepTick(_tick: number): void {
      /* continuous physics tick — frame indices never force-dry (P4) */
    },
    captureFrame(): CanvasImageSource {
      return canvas as unknown as CanvasImageSource
    },
    dispose(): void {
      disposed = true
      strokes.length = 0
      sheet = null
    },
  }
}

// Re-exported so callers can build a projection without importing payload directly.
export { toStudioStroke }
