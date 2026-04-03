// ============================================================
//  Paper Texture Loading and Brush Grain
//  Extracted from efx-paint-physic-v3.html lines 286-365, 601-613, 1763-1775
//  NOTE: loadPaperTexture is the ONE function in core/ that touches DOM
//  (Image/canvas for pixel data extraction). This is an async loader,
//  not a render-path function.
// ============================================================

import { TEXTURE_SIZE } from '../types'
import { lerp, clamp } from '../util/math'
import { fbm } from '../util/noise'

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
): Promise<{ heightMap: Float32Array; tiledCanvas: HTMLCanvasElement }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const tc = document.createElement('canvas')
      tc.width = width
      tc.height = height
      const tx = tc.getContext('2d')
      if (!tx) {
        reject(new Error('Failed to get 2D context for paper texture'))
        return
      }
      // Tile the image across the canvas
      for (let y = 0; y < height; y += img.height) {
        for (let x = 0; x < width; x += img.width) {
          tx.drawImage(img, x, y)
        }
      }
      try {
        const pd = tx.getImageData(0, 0, width, height).data
        const heightMap = new Float32Array(width * height)
        for (let i = 0; i < width * height; i++) heightMap[i] = pd[i * 4] / 255
        resolve({ heightMap, tiledCanvas: tc })
      } catch (e) {
        // CORS on file:// -- reject so caller can fall back to procedural
        reject(e)
      }
    }
    img.onerror = () => reject(new Error(`Failed to load paper texture: ${url}`))
    img.src = url
  })
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

/**
 * Creates heightmap from bgData if texHeight is null.
 * Generates procedural fine-grain + medium structure noise.
 * From v3.html ensureHeightMap() line 1763
 */
export function ensureHeightMap(
  texHeight: Float32Array | null,
  _bgData: ImageData | null,
  width: number,
  height: number,
): Float32Array {
  if (texHeight) return texHeight
  const paperHeight = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Fine grain: high frequency noise simulating paper fiber/weave (~4-6px features)
      const fine = fbm(x * 0.25, y * 0.25, 4)
      // Medium structure: larger paper undulation
      const med = fbm(x * 0.06, y * 0.06, 2) * 0.3
      paperHeight[y * width + x] = clamp(fine * 0.7 + med + 0.15, 0, 1)
    }
  }
  return paperHeight
}
