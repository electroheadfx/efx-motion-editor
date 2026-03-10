/**
 * Color grade adjustment layer -- CSS filter-based pipeline.
 *
 * Applies brightness, contrast, saturation, hue rotation, and fade-to-tint
 * transformations on the composited canvas pixels below the adjustment layer.
 *
 * Uses Canvas 2D `ctx.filter` (CSS filter syntax) instead of getImageData
 * to avoid SecurityError on canvases tainted by custom protocol images.
 */

export interface ColorGradeParams {
  brightness: number;  // -0.5 to 0.5
  contrast: number;    // -1 to 1
  saturation: number;  // 0 to 2 (1 = normal)
  hue: number;         // -180 to 180 degrees
  fade: number;        // 0 to 1
  tintColor: string;   // hex color like '#D4A574'
}

/** Cached offscreen canvas for color grade re-draw (avoids per-frame allocation) */
let _offscreen: HTMLCanvasElement | null = null;

/**
 * Apply color grade adjustments to the canvas using CSS filters.
 *
 * Copies canvas to an offscreen buffer, clears, then draws back with
 * CSS filter string applied. Fade-to-tint is drawn as a color overlay.
 *
 * @param ctx - Canvas 2D rendering context
 * @param canvasPhysicalW - Physical canvas width (canvas.width, includes DPI scaling)
 * @param canvasPhysicalH - Physical canvas height (canvas.height, includes DPI scaling)
 * @param params - Color grade parameters
 */
export function applyColorGrade(
  ctx: CanvasRenderingContext2D,
  canvasPhysicalW: number,
  canvasPhysicalH: number,
  params: ColorGradeParams,
): void {
  // Early exit if all params are at neutral values
  if (
    params.brightness === 0 &&
    params.contrast === 0 &&
    params.saturation === 1 &&
    params.hue === 0 &&
    params.fade === 0
  ) {
    return;
  }

  ctx.save();
  ctx.resetTransform();

  // Reuse or create offscreen canvas for the copy
  if (!_offscreen) {
    _offscreen = document.createElement('canvas');
  }
  if (_offscreen.width !== canvasPhysicalW || _offscreen.height !== canvasPhysicalH) {
    _offscreen.width = canvasPhysicalW;
    _offscreen.height = canvasPhysicalH;
  }
  const offCtx = _offscreen.getContext('2d');
  if (!offCtx) {
    ctx.restore();
    return;
  }

  // Copy current canvas to offscreen buffer
  offCtx.clearRect(0, 0, canvasPhysicalW, canvasPhysicalH);
  offCtx.drawImage(ctx.canvas, 0, 0);

  // Clear main canvas
  ctx.clearRect(0, 0, canvasPhysicalW, canvasPhysicalH);

  // Build CSS filter string for brightness, contrast, saturation, hue
  const filters: string[] = [];
  if (params.brightness !== 0) filters.push(`brightness(${1 + params.brightness})`);
  if (params.contrast !== 0) filters.push(`contrast(${1 + params.contrast})`);
  if (params.saturation !== 1) filters.push(`saturate(${params.saturation})`);
  if (params.hue !== 0) filters.push(`hue-rotate(${params.hue}deg)`);

  if (filters.length > 0) {
    ctx.filter = filters.join(' ');
  }

  // Draw back with CSS filters applied
  ctx.drawImage(_offscreen, 0, 0);
  ctx.filter = 'none';

  // Apply fade-to-tint as a color overlay
  if (params.fade > 0) {
    ctx.globalAlpha = params.fade;
    ctx.fillStyle = params.tintColor;
    ctx.fillRect(0, 0, canvasPhysicalW, canvasPhysicalH);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}
