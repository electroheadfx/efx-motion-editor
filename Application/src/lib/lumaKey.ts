/**
 * Luma key compositing for paint layers.
 * Uses ITU-R BT.709 luma weights for perceptual accuracy.
 */

/** ITU-R BT.709 luma coefficients */
const LUMA_WEIGHTS = { r: 0.2126, g: 0.7152, b: 0.0722 };

/**
 * Apply luma key to an offscreen canvas.
 * @param canvas - HTMLCanvasElement with paint strokes on white background
 * @param invert - if true, apply luma invert (black strokes on white → white opaque with transparent BG)
 *                  if false, apply luma key (white BG → transparent, strokes opaque)
 * Uses ITU-R BT.709 luma weights.
 * IMPORTANT: This modifies the canvas ImageData in-place. Call on a copy if you need
 * to preserve the original. Never call on _frameFxCache directly (pitfall 3 in research).
 */
export function applyLumaKey(canvas: HTMLCanvasElement, invert: boolean): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Guard clause for empty canvas
  if (canvas.width === 0 || canvas.height === 0) return;

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // ITU-R BT.709 luma calculation (0-255 range)
    const luma = LUMA_WEIGHTS.r * r + LUMA_WEIGHTS.g * g + LUMA_WEIGHTS.b * b;

    if (invert) {
      // Luma Invert: black strokes on white BG → white opaque strokes with transparent BG
      // White BG (luma=255) → transparent (alpha=0)
      // Black strokes (luma=0) → opaque (alpha=255)
      // Formula: alpha = 255 - luma (same as non-invert, but conceptual inversion of what's transparent)
      data[i + 3] = 255 - luma;
    } else {
      // Luma Key: white BG → transparent, colored strokes → opaque
      // White BG (luma=255) → transparent (alpha=0)
      // Black/colored strokes (luma=0-255) → opaque (alpha=255-luma)
      data[i + 3] = 255 - luma;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}
