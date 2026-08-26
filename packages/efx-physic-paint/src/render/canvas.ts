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
  previewBaseCanvas: HTMLCanvasElement
  previewBaseCtx: CanvasRenderingContext2D
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

  const previewBaseCanvas = document.createElement('canvas')
  previewBaseCanvas.width = width
  previewBaseCanvas.height = height
  previewBaseCanvas.style.position = 'absolute'
  previewBaseCanvas.style.top = '0'
  previewBaseCanvas.style.left = '0'
  previewBaseCanvas.style.zIndex = '1'
  previewBaseCanvas.style.pointerEvents = 'none'
  previewBaseCanvas.style.width = '100%'
  previewBaseCanvas.style.height = 'auto'
  container.appendChild(previewBaseCanvas)

  // Dry canvas — interactive layer
  const dryCanvas = document.createElement('canvas')
  dryCanvas.width = width
  dryCanvas.height = height
  dryCanvas.style.position = 'relative'
  dryCanvas.style.zIndex = '2'
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
  displayCanvas.style.zIndex = '3'
  displayCanvas.style.pointerEvents = 'none'
  displayCanvas.style.width = '100%'
  displayCanvas.style.height = 'auto'
  container.appendChild(displayCanvas)

  const previewBaseCtx = previewBaseCanvas.getContext('2d')!
  const dryCtx = dryCanvas.getContext('2d', { willReadFrequently: true })!
  // CPU-backed display canvas: the wet composite putImageData runs every frame
  // while paint is wet. On a GPU-backed displayed canvas that uploads 2.6MB to
  // the GPU per frame — sustained churn that crashes the WKWebView GPU process
  // after a long session (black window, web process still alive). A CPU-backed
  // canvas makes putImageData a plain memcpy; the compositor uploads once.
  const displayCtx = displayCanvas.getContext('2d', { willReadFrequently: true })!

  return { previewBaseCanvas, previewBaseCtx, dryCanvas, dryCtx, displayCanvas, displayCtx }
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
 * Solid dual-stroke ring (dark under, white over) for radius >= 4, or a fixed
 * crosshair for smaller radii. Never dashed, no blend modes, no sampling.
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
  // Guarantee solid strokes regardless of any dash state left by the caller.
  displayCtx.setLineDash([])

  if (radius >= 4) {
    // True-size ring: dark under-stroke + white over-stroke on the same arc.
    // The white hairline flanked by black reads on light AND dark backgrounds.
    strokeDualRing(displayCtx, cursorX, cursorY, radius)
  } else {
    // A ring this small is physically unreadable — draw a fixed crosshair
    // (6px arms, 1px center gap) with the same dual-stroke per axis.
    const arm = 6
    const halfGap = 0.5
    strokeDualLine(displayCtx, cursorX - arm, cursorY, cursorX - halfGap, cursorY)
    strokeDualLine(displayCtx, cursorX + halfGap, cursorY, cursorX + arm, cursorY)
    strokeDualLine(displayCtx, cursorX, cursorY - arm, cursorX, cursorY - halfGap)
    strokeDualLine(displayCtx, cursorX, cursorY + halfGap, cursorX, cursorY + arm)
  }

  displayCtx.restore()
}

/** Solid ring: dark under-stroke (width 3) + white over-stroke (width 1). */
function strokeDualRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
): void {
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(17,17,17,0.9)'
  ctx.lineWidth = 3
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'
  ctx.lineWidth = 1
  ctx.stroke()
}

/** Solid line segment: dark under-stroke (width 3) + white over-stroke (width 1). */
function strokeDualLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.strokeStyle = 'rgba(17,17,17,0.9)'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'
  ctx.lineWidth = 1
  ctx.stroke()
}

/** Stroke preview data for display overlay */
export interface StrokePreview {
  pts: PenPoint[]
  color: string
  radius: number
  opacity: number
  hasPenInput?: boolean
}

/**
 * Draw stroke preview on the display canvas.
 * Shows dashed outline of the stroke shape during painting.
 * From v3.html drawStrokePreview() line 2064
 *
 * @param displayCtx - Display canvas context
 * @param preview - Preview data (null = no preview)
 */
type PreviewPathPoint = readonly [number, number] | Pick<PenPoint, 'x' | 'y'>

function pathX(point: PreviewPathPoint): number {
  return 'x' in point ? point.x : point[0]
}

function pathY(point: PreviewPathPoint): number {
  return 'y' in point ? point.y : point[1]
}

function drawDashedPath(
  displayCtx: CanvasRenderingContext2D,
  points: ReadonlyArray<PreviewPathPoint>,
  closePath: boolean,
): void {
  if (points.length < 2) return
  displayCtx.save()
  displayCtx.lineWidth = 1.5
  displayCtx.setLineDash([5, 5])
  displayCtx.strokeStyle = 'rgba(0,0,0,0.55)'
  displayCtx.lineDashOffset = 0
  displayCtx.beginPath()
  displayCtx.moveTo(pathX(points[0]), pathY(points[0]))
  for (let i = 1; i < points.length; i++) displayCtx.lineTo(pathX(points[i]), pathY(points[i]))
  if (closePath) displayCtx.closePath()
  displayCtx.stroke()

  displayCtx.strokeStyle = 'rgba(255,255,255,0.55)'
  displayCtx.lineDashOffset = 5
  displayCtx.beginPath()
  displayCtx.moveTo(pathX(points[0]), pathY(points[0]))
  for (let i = 1; i < points.length; i++) displayCtx.lineTo(pathX(points[i]), pathY(points[i]))
  if (closePath) displayCtx.closePath()
  displayCtx.stroke()
  displayCtx.restore()
}

export function drawQueuedStrokePolyline(
  displayCtx: CanvasRenderingContext2D,
  points: readonly PenPoint[],
): void {
  drawDashedPath(displayCtx, points, false)
}

export function drawStrokePreview(
  displayCtx: CanvasRenderingContext2D,
  preview: StrokePreview | null,
): void {
  if (!preview || preview.pts.length < 3) return
  const sm = smooth(preview.pts, 2)
  const curve = resample(sm, Math.max(3, preview.radius * 0.25))
  if (curve.length < 3) return
  drawDashedPath(displayCtx, ribbon(curve, preview.radius, 0.8, preview.hasPenInput ?? false), true)
}
