/**
 * Color grade adjustment layer -- ImageData pixel manipulation pipeline.
 *
 * Applies brightness, contrast, saturation, hue rotation, and fade-to-tint
 * transformations on the composited canvas pixels below the adjustment layer.
 */

export interface ColorGradeParams {
  brightness: number;  // -0.5 to 0.5
  contrast: number;    // -1 to 1
  saturation: number;  // 0 to 2 (1 = normal)
  hue: number;         // -180 to 180 degrees
  fade: number;        // 0 to 1
  tintColor: string;   // hex color like '#D4A574'
}

/**
 * Parse a '#RRGGBB' hex string to [r, g, b] components (0-255).
 */
export function parseTintHex(hex: string): [number, number, number] {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b];
}

/**
 * Apply color grade adjustments to the canvas.
 *
 * Since PreviewRenderer applies DPI scaling via ctx.scale(dpr, dpr), this function
 * saves the context, resets the transform to identity, operates on physical pixel
 * dimensions, and restores the context afterward.
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

  const [tintR, tintG, tintB] = parseTintHex(params.tintColor);

  // Save context and reset transform to access physical pixels
  ctx.save();
  ctx.resetTransform();

  const imageData = ctx.getImageData(0, 0, canvasPhysicalW, canvasPhysicalH);
  const data = imageData.data;

  // Pre-compute contrast factor
  const contrastFactor = (1 + params.contrast) / (1.001 - params.contrast);

  // Pre-compute hue rotation matrix coefficients
  const hueRad = params.hue * Math.PI / 180;
  const cosH = Math.cos(hueRad);
  const sinH = Math.sin(hueRad);

  // Hue rotation matrix in RGB space (Precompute the full 3x3 matrix)
  // Based on the rotation matrix that preserves luminance perception
  const a00 = cosH + (1 - cosH) / 3;
  const a01 = (1 - cosH) / 3 - Math.sqrt(1 / 3) * sinH;
  const a02 = (1 - cosH) / 3 + Math.sqrt(1 / 3) * sinH;
  const a10 = (1 - cosH) / 3 + Math.sqrt(1 / 3) * sinH;
  const a11 = cosH + (1 - cosH) / 3;
  const a12 = (1 - cosH) / 3 - Math.sqrt(1 / 3) * sinH;
  const a20 = (1 - cosH) / 3 - Math.sqrt(1 / 3) * sinH;
  const a21 = (1 - cosH) / 3 + Math.sqrt(1 / 3) * sinH;
  const a22 = cosH + (1 - cosH) / 3;

  const brightnessOffset = params.brightness * 255;
  const needHueRotation = params.hue !== 0;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // 1. Brightness: add offset
    r += brightnessOffset;
    g += brightnessOffset;
    b += brightnessOffset;

    // 2. Contrast: scale from midpoint
    r = contrastFactor * (r - 128) + 128;
    g = contrastFactor * (g - 128) + 128;
    b = contrastFactor * (b - 128) + 128;

    // 3. Saturation: desaturate toward luminance
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    r = lum + params.saturation * (r - lum);
    g = lum + params.saturation * (g - lum);
    b = lum + params.saturation * (b - lum);

    // 4. Hue rotation: apply 3x3 rotation matrix in RGB space
    if (needHueRotation) {
      const rr = a00 * r + a01 * g + a02 * b;
      const gg = a10 * r + a11 * g + a12 * b;
      const bb = a20 * r + a21 * g + a22 * b;
      r = rr;
      g = gg;
      b = bb;
    }

    // 5. Fade: blend toward tint color
    if (params.fade > 0) {
      r = r + (tintR - r) * params.fade;
      g = g + (tintG - g) * params.fade;
      b = b + (tintB - b) * params.fade;
    }

    // Clamp to 0-255
    data[i] = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, g));
    data[i + 2] = Math.max(0, Math.min(255, b));
  }

  ctx.putImageData(imageData, 0, 0);
  ctx.restore();
}
