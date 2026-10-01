// ============================================================
//  Paper Texture Loading and Brush Grain
//  Extracted from efx-paint-physic-v3.html lines 286-365, 601-613, 1763-1775
//  NOTE: loadPaperTexture is the ONE function in core/ that touches DOM
//  (Image/canvas for pixel data extraction). This is an async loader,
//  not a render-path function.
// ============================================================

import { TEXTURE_SIZE } from '../types'
import { lerp, clamp } from '../util/math'

/**
 * Load a paper texture image, tile it across the canvas, and extract the red channel
 * as a Float32Array heightmap.
 * From v3.html loadPaperTexture() line 286
 *
 * @param url - URL to the paper texture image (e.g. paper_N.jpg or base64 data URL)
 * @param width - Canvas width (for tiling)
 * @param height - Canvas height (for tiling)
 * @returns Promise resolving to heightMap Float32Array and the tiled canvas
 */
export function loadPaperTexture(
  url: string,
  width: number,
  height: number,
  tileScale = 1,
): Promise<{ heightMap: Float32Array; tiledCanvas: HTMLCanvasElement }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const tc = document.createElement('canvas')
      tc.width = width
      tc.height = height
      const tx = tc.getContext('2d', { willReadFrequently: true })
      if (!tx) {
        reject(new Error('Failed to get 2D context for paper texture'))
        return
      }
      // Tile the image across the canvas, MIRRORING alternate cells.
      // 260930-wm6 R2 seam pin: a plain repeat of a photographed paper_*.jpg
      // steps 0.80 at every tile boundary (its left edge != its right edge),
      // and sampleH hands that height step to wetDisplayAlpha's paperMod and to
      // D-08's adsorption — the horizontal/vertical white cuts through the paint
      // and the "full block outline" of one tile. Mirroring makes both sides of
      // a shared boundary read the same source pixels, so ANY source tiles
      // seam-free. It also removes the fractional-tileScale seam, where each
      // cell's own drawImage resample would otherwise clamp at that cell's edge.
      const tileWidth = Math.max(1, img.width * tileScale)
      const tileHeight = Math.max(1, img.height * tileScale)
      for (let iy = 0, y = 0; y < height; iy++, y += tileHeight) {
        for (let ix = 0, x = 0; x < width; ix++, x += tileWidth) {
          const flipX = ix % 2 === 1
          const flipY = iy % 2 === 1
          tx.save()
          tx.translate(flipX ? x + tileWidth : x, flipY ? y + tileHeight : y)
          tx.scale(flipX ? -1 : 1, flipY ? -1 : 1)
          tx.drawImage(img, 0, 0, tileWidth, tileHeight)
          tx.restore()
        }
      }
      try {
        const pd = tx.getImageData(0, 0, width, height).data
        const raw = new Float32Array(width * height)
        for (let i = 0; i < width * height; i++) raw[i] = pd[i * 4] / 255
        // 260925-dso: condition ONCE at load — mean-centre to 0.5, contrast
        // clamped to +/-0.40. Every consumer shares this conditioned reference.
        const heightMap = conditionHeightMap(raw)
        resolve({ heightMap, tiledCanvas: tc })
      } catch (e) {
        // CORS on file:// -- reject so caller can fall back to a flat height
        reject(e)
      }
    }
    img.onerror = () => reject(new Error(`Failed to load paper texture: ${url}`))
    img.src = url
  })
}

/**
 * Condition a raw paper height map: mean-centre to 0.5, then clamp contrast to
 * +/-0.40, so the output band is [0.10, 0.90] (260925-dso locked decision —
 * noticeable tooth in deposit adsorption without pixel jitter).
 * Idempotent on its own output.
 */
export function conditionHeightMap(raw: Float32Array): Float32Array {
  let sum = 0
  for (let i = 0; i < raw.length; i++) sum += raw[i]
  const mean = raw.length > 0 ? sum / raw.length : 0.5
  const out = new Float32Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = clamp(0.5 + (raw[i] - mean), 0.1, 0.9)
  return out
}

/**
 * Paper height at pixel coordinate with bilinear interpolation.
 * Uses paperHeight (physics heightmap) with fallback to 0.5.
 * From v3.html sampleH() line 601
 */
export function sampleH(
  paperHeight: Float32Array | null,
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  if (!paperHeight) return 0.5
  const ix = clamp(x | 0, 0, width - 2), iy = clamp(y | 0, 0, height - 2)
  const fx = x - ix, fy = y - iy
  return lerp(
    lerp(paperHeight[iy * width + ix], paperHeight[iy * width + ix + 1], fx),
    lerp(paperHeight[(iy + 1) * width + ix], paperHeight[(iy + 1) * width + ix + 1], fx),
    fy,
  )
}

/**
 * Raw 512x512 texture height sample with bilinear interpolation.
 * From v3.html sampleTexH() line 609
 */
export function sampleTexH(
  textureHeight: Float32Array | null,
  x: number,
  y: number,
): number {
  if (!textureHeight) return 0.5
  const w = TEXTURE_SIZE, h = TEXTURE_SIZE
  const ix = clamp(x | 0, 0, w - 2), iy = clamp(y | 0, 0, h - 2)
  const fx = x - ix, fy = y - iy
  return lerp(
    lerp(textureHeight[iy * w + ix], textureHeight[iy * w + ix + 1], fx),
    lerp(textureHeight[(iy + 1) * w + ix], textureHeight[(iy + 1) * w + ix + 1], fx),
    fy,
  )
}
