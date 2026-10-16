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
//  Play/bake path (56-11, one stepping law live == bake):
//  applyStroke deposits onto the FluidSheet via depositStrokeOnSheet;
//  stepTick advances step(sheet, 1) per integer tick; captureFrame
//  returns the sheet raster. Dry events call forceDrySheet at their
//  tick (D-15). Frame indices never force-dry (P4 / D-28).
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
import { depositStrokeOnSheet } from '../engine/deposit'
import type { DepositCanvas } from '../engine/deposit'
import { createSheet, isDrySheet, step, type FluidSheet } from '../engine/fluid'
import { forceDrySheet } from '../engine/drying'
import { drawSheetToCanvas } from '../engine/raster'
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

  const rasterToCanvas = (): void => {
    if (disposed || !sheet || !canvas) return
    drawSheetToCanvas(sheet, canvas as HTMLCanvasElement)
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
        if (!existing) {
          strokes.push(entry.stroke)
          if (sheet) depositStrokeOnSheet(sheet, entry.stroke, findTip(entry.stroke.brushId) ?? TIPS[0])
        }
      }
      rasterToCanvas()
    },
    renderAllStrokes(): void {
      if (disposed || !sheet) return
      for (const stroke of strokes) {
        depositStrokeOnSheet(sheet, stroke, findTip(stroke.brushId) ?? TIPS[0])
      }
      rasterToCanvas()
    },
    exportCompositeCanvas(): HTMLCanvasElement {
      rasterToCanvas()
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
      if (!sheet) return
      const tip = findTip(parsed.brushId) ?? TIPS[0]
      if (!tip) return
      depositStrokeOnSheet(sheet, parsed, tip)
      rasterToCanvas()
    },
    stepTick(_tick: number): void {
      // Integer ticks only (DATA-03). Frame indices never force-dry (P4).
      if (disposed || !sheet) return
      step(sheet, 1)
      rasterToCanvas()
    },
    captureFrame(): CanvasImageSource {
      rasterToCanvas()
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
