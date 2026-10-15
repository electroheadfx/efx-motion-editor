// ============================================================
//  depositStroke — engine-2 pigment deposit along a stroke path.
//  Uses mixSpectral for colour and seededRng for scatter
//  (D-20: no Math.random in the deposit path). Unpainted pixels
//  stay untouched (alpha 0).
// ============================================================

import type { StudioStroke } from '@efxlab/efx-paint-host/animation'
import type { AquarelleStrokePayload } from '../payload/toStudioStroke'
import type { AquarelleTip } from '../brushes/tips'

export interface DepositOptions {
  width: number
  height: number
}

/** Minimal 2d context surface the deposit writes through. */
export interface DepositCanvas {
  getContext(id: '2d'): {
    getImageData(x: number, y: number, w: number, h: number): {
      width: number
      height: number
      data: Uint8ClampedArray
    }
    putImageData(
      imageData: { width: number; height: number; data: Uint8ClampedArray },
      x: number,
      y: number,
    ): void
  } | null
}

/**
 * Stamp pigment along `stroke.pts` using the given tip.
 * Unpainted pixels must stay alpha 0.
 */
export function depositStroke(
  _canvas: DepositCanvas,
  _stroke: StudioStroke<AquarelleStrokePayload>,
  _tip: AquarelleTip,
  _options: DepositOptions,
): void {
  // RED stub — intentionally deposits nothing.
}
