// ============================================================
//  Canvas Management and Drawing
//  Dual-canvas setup, background rendering, cursor, stroke preview.
//  Extracted from efx-paint-physic-v3.html lines 2064-2222
//  No module-level mutable state.
// ============================================================

import type { BgMode, ToolType, PenPoint } from '../types'
import { smooth, resample, ribbon } from '../brush/stroke'

/** Result of dual-canvas setup */
export interface DualCanvas {
  dryCanvas: HTMLCanvasElement
  dryCtx: CanvasRenderingContext2D
  displayCanvas: HTMLCanvasElement
  displayCtx: CanvasRenderingContext2D
}

/**
 * Create dual-canvas layout inside a container.
 * First canvas (dry): receives pointer events, renders dry paint.
 * Second canvas (display): overlay for wet layer compositing + cursor.
 * From v3.html dual-canvas pattern.
 *
 * @param container - DOM element to contain the canvases
 * @param width - Canvas resolution width
 * @param height - Canvas resolution height
 */
export function setupDualCanvas(
  container: HTMLElement,
  width: number,
  height: number,
): DualCanvas {
  container.classList.add('wrap')
  container.style.position = 'relative'
  container.style.overflow = 'hidden'

  // Dry canvas — interactive layer
  const dryCanvas = document.createElement('canvas')
  dryCanvas.width = width
  dryCanvas.height = height
  dryCanvas.style.position = 'relative'
  dryCanvas.style.zIndex = '1'
  dryCanvas.style.cursor = 'none'
  dryCanvas.style.touchAction = 'none'
  dryCanvas.style.display = 'block'
  dryCanvas.style.width = '100%'
  dryCanvas.style.height = 'auto'
  container.appendChild(dryCanvas)

  // Display canvas — overlay for wet compositing and cursor
  const displayCanvas = document.createElement('canvas')
  displayCanvas.width = width
  displayCanvas.height = height
  displayCanvas.style.position = 'absolute'
  displayCanvas.style.top = '0'
  displayCanvas.style.left = '0'
  displayCanvas.style.zIndex = '2'
  displayCanvas.style.pointerEvents = 'none'
  displayCanvas.style.width = '100%'
  displayCanvas.style.height = 'auto'
  container.appendChild(displayCanvas)

  const dryCtx = dryCanvas.getContext('2d', { willReadFrequently: true })!
  const displayCtx = displayCanvas.getContext('2d')!

  return { dryCanvas, dryCtx, displayCanvas, displayCtx }
}

/**
 * Draw background to an offscreen bg canvas and return background ImageData.
 * Handles: transparent (clear), white (fill), canvas1/2/3 (paper texture), photo.
 * From v3.html drawBg() line 2194
 *
 * @param bgCtx - Background canvas context (offscreen, same size as main)
 * @param bgMode - Current background mode
 * @param width - Canvas width
 * @param height - Canvas height
 * @param paperTextures - Map of paper key to {tiledCanvas, heightMap}
 * @param userPhoto - User-loaded photo as Image element, or null
 * @returns Background ImageData for erase-to-background operations
 */
export function drawBg(
  bgCtx: CanvasRenderingContext2D,
  bgMode: BgMode,
  width: number,
  height: number,
  paperTextures: Map<string, { tiledCanvas: HTMLCanvasElement; heightMap: Float32Array }>,
  userPhoto: HTMLImageElement | null,
): ImageData | null {
  // Draw to the passed-in bgCtx's canvas first
  const ctx = bgCtx
  ctx.clearRect(0, 0, width, height)

  if (bgMode === 'white') {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
  } else if (bgMode === 'photo') {
    if (userPhoto) {
      ctx.drawImage(userPhoto, 0, 0, width, height)
    } else {
      ctx.fillStyle = '#f5f0e8'
      ctx.fillRect(0, 0, width, height)
    }
  } else if (bgMode.startsWith('canvas')) {
    const tex = paperTextures.get(bgMode)
    if (tex) {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, width, height)
      ctx.globalAlpha = 0.18
      ctx.drawImage(tex.tiledCanvas, 0, 0)
      ctx.globalAlpha = 1.0
    } else {
      ctx.fillStyle = '#f5f0e8'
      ctx.fillRect(0, 0, width, height)
    }
  }
  // 'transparent' — already cleared

  return ctx.getImageData(0, 0, width, height)
}

/**
 * Draw brush cursor on the display canvas.
 * Outer white dashed ring + inner dark dashed ring + center dot.
 * From v3.html drawBrushCursor() line 2107
 *
 * @param displayCtx - Display canvas context
 * @param cursorX - Cursor X in canvas space
 * @param cursorY - Cursor Y in canvas space
 * @param radius - Brush radius
 * @param _tool - Current tool (reserved for future per-tool cursor style)
 * @param _width - Canvas width (reserved)
 * @param _height - Canvas height (reserved)
 */
export function drawBrushCursor(
  displayCtx: CanvasRenderingContext2D,
  cursorX: number,
  cursorY: number,
  radius: number,
  _tool: ToolType,
  _width: number,
  _height: number,
): void {
  if (cursorX < 0) return

  displayCtx.save()

  // Outer white ring
  displayCtx.beginPath()
  displayCtx.arc(cursorX, cursorY, radius, 0, Math.PI * 2)
  displayCtx.strokeStyle = 'rgba(255,255,255,0.85)'
  displayCtx.lineWidth = 2.5
  displayCtx.setLineDash([4, 3])
  displayCtx.stroke()

  // Inner dark ring
  displayCtx.beginPath()
  displayCtx.arc(cursorX, cursorY, radius, 0, Math.PI * 2)
  displayCtx.strokeStyle = 'rgba(0,0,0,0.5)'
  displayCtx.lineWidth = 1
  displayCtx.setLineDash([4, 3])
  displayCtx.lineDashOffset = 4
  displayCtx.stroke()

  // Center dot
  displayCtx.beginPath()
  displayCtx.arc(cursorX, cursorY, 1.5, 0, Math.PI * 2)
  displayCtx.fillStyle = 'rgba(255,255,255,0.9)'
  displayCtx.fill()

  displayCtx.restore()
}

/** Stroke preview data for display overlay */
export interface StrokePreview {
  pts: PenPoint[]
  color: string
  radius: number
  opacity: number
}

/**
 * Draw stroke preview on the display canvas.
 * Shows dashed outline of the stroke shape during painting.
 * From v3.html drawStrokePreview() line 2064
 *
 * @param displayCtx - Display canvas context
 * @param preview - Preview data (null = no preview)
 */
export function drawStrokePreview(
  displayCtx: CanvasRenderingContext2D,
  preview: StrokePreview | null,
): void {
  if (!preview || preview.pts.length < 3) return

  const sm = smooth(preview.pts, 2)
  const curve = resample(sm, Math.max(3, preview.radius * 0.25))
  if (curve.length < 3) return

  const base = ribbon(curve, preview.radius, 0.8)
  if (!base || base.length < 3) return

  displayCtx.save()

  // Dashed outline: black + white for visibility on any background
  displayCtx.lineWidth = 1.5
  displayCtx.setLineDash([5, 5])
  displayCtx.strokeStyle = 'rgba(0,0,0,0.55)'
  displayCtx.lineDashOffset = 0
  displayCtx.beginPath()
  displayCtx.moveTo(base[0][0], base[0][1])
  for (let i = 1; i < base.length; i++) displayCtx.lineTo(base[i][0], base[i][1])
  displayCtx.closePath()
  displayCtx.stroke()

  displayCtx.strokeStyle = 'rgba(255,255,255,0.55)'
  displayCtx.lineDashOffset = 5
  displayCtx.beginPath()
  displayCtx.moveTo(base[0][0], base[0][1])
  for (let i = 1; i < base.length; i++) displayCtx.lineTo(base[i][0], base[i][1])
  displayCtx.closePath()
  displayCtx.stroke()

  displayCtx.restore()
}
