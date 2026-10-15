// ============================================================
//  createAquarelleEngineAdapter — engine-2's EngineAdapter<P>
//  plug point (HOST-02 / D-19). engineId 'efx-watercolor' is
//  already named in the host EngineId union.
//
//  payloadCodec.parse is total and fail-closed (null on any
//  malformed input, never throws) — the host never reads P.
// ============================================================

import type {
  EngineAdapter,
  EngineId,
  StudioStroke,
} from '@efxlab/efx-paint-host'
import type { AquarelleStrokePayload } from '../payload/toStudioStroke'
import { toStudioStroke } from '../payload/toStudioStroke'
import { depositStroke } from '../engine/deposit'
import type { DepositCanvas } from '../engine/deposit'
import { findTip, TIPS } from '../brushes/tips'

export interface AquarelleAdapterOptions {
  width?: number
  height?: number
  canvas?: HTMLCanvasElement | DepositCanvas
}

export function createAquarelleEngineAdapter(
  _options: AquarelleAdapterOptions = {},
): EngineAdapter<AquarelleStrokePayload> {
  const engineId: EngineId = 'efx-watercolor'
  const strokes: StudioStroke<AquarelleStrokePayload>[] = []
  let disposed = false

  return {
    engineId,
    payloadCodec: {
      serialize(stroke: unknown): StudioStroke<AquarelleStrokePayload> {
        // RED stub — projects without validating.
        return stroke as StudioStroke<AquarelleStrokePayload>
      },
      parse(raw: unknown): StudioStroke<AquarelleStrokePayload> | null {
        // RED stub — NOT fail-closed (returns raw cast).
        return raw as StudioStroke<AquarelleStrokePayload>
      },
    },
    setInputLocked(_locked: boolean): void {
      /* live playback — recorded in later plans */
    },
    setAnimationMode(_mode: boolean): void {
      /* live playback — recorded in later plans */
    },
    getStrokes(): readonly StudioStroke<AquarelleStrokePayload>[] {
      return strokes
    },
    renderPartialStrokes(): void {
      /* live playback — recorded in later plans */
    },
    renderAllStrokes(): void {
      /* live playback — recorded in later plans */
    },
    exportCompositeCanvas(): HTMLCanvasElement {
      return _options.canvas as HTMLCanvasElement
    },
    applyStroke(stroke: StudioStroke<AquarelleStrokePayload>): void {
      if (disposed) return
      strokes.push(stroke)
      const tip = findTip(stroke.brushId) ?? TIPS[0]
      if (tip && _options.canvas) {
        // RED stub — depositStroke writes nothing yet.
        depositStroke(_options.canvas, stroke, tip, {
          width: _options.width ?? 0,
          height: _options.height ?? 0,
        })
      }
    },
    stepTick(_tick: number): void {
      /* cuisson ticks — diffusion lands in 56-03 */
    },
    captureFrame(): CanvasImageSource {
      return _options.canvas as unknown as CanvasImageSource
    },
    dispose(): void {
      disposed = true
      strokes.length = 0
    },
  }
}

// Re-exported so callers can build a projection without importing payload directly.
export { toStudioStroke }
