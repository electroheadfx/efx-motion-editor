/**
 * Legacy-cache repair for Roto frames captured with the engine background baked
 * in. Such a frame is fully opaque, near-white at all four corners, and carries
 * paint elsewhere. Paint tracks are pigment layers — the document fond is the
 * only opaque background — so an opaque white matte makes each track mask the
 * tracks beneath it (Studio multi-track composite shows only the active track).
 *
 * Exact-white removal leaves the near-white wash fringe opaque: the Studio's
 * paper multiply hides it, but the editor's source-over reveals it as a white
 * veil. The cutoff below makes the whole near-white matte transparent so the
 * paper shows through the wash's lightest areas.
 *
 * Only the corruption signature is touched: every pixel opaque, all four
 * corners near-white, and at least one pixel below the cutoff. A genuinely
 * white full-frame raster and any real-alpha frame are left untouched.
 */
const NEAR_WHITE_CUTOFF = 240;

function isMattePixel(rgba: Uint8ClampedArray, index: number): boolean {
  return rgba[index] >= NEAR_WHITE_CUTOFF
    && rgba[index + 1] >= NEAR_WHITE_CUTOFF
    && rgba[index + 2] >= NEAR_WHITE_CUTOFF
    && rgba[index + 3] === 255;
}

export function stripOpaqueWhiteMatte(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): boolean {
  if (width <= 0 || height <= 0) return false;
  const byteLength = width * height * 4;
  if (rgba.length < byteLength) return false;

  const corners = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    (width * height - 1) * 4,
  ];
  for (const corner of corners) {
    if (!isMattePixel(rgba, corner)) return false;
  }

  let hasPaint = false;
  for (let index = 0; index < byteLength; index += 4) {
    if (rgba[index + 3] !== 255) return false;
    if (!isMattePixel(rgba, index)) hasPaint = true;
  }
  if (!hasPaint) return false;

  let removed = 0;
  for (let index = 0; index < byteLength; index += 4) {
    if (isMattePixel(rgba, index)) {
      rgba[index] = 0;
      rgba[index + 1] = 0;
      rgba[index + 2] = 0;
      rgba[index + 3] = 0;
      removed += 1;
    }
  }
  return removed > 0;
}

/**
 * Canvas entry point for the same repair. A 16x16 probe rejects clean frames
 * cheaply (the common case); only a frame matching the corruption signature
 * pays the full-raster readback.
 */
export function stripOpaqueWhiteMatteFromCanvas(canvas: HTMLCanvasElement): boolean {
  try {
    const probe = document.createElement('canvas');
    probe.width = 16;
    probe.height = 16;
    const probeContext = probe.getContext('2d', { willReadFrequently: true });
    if (!probeContext) return false;
    probeContext.drawImage(canvas, 0, 0, 16, 16);
    const probeData = probeContext.getImageData(0, 0, 16, 16).data;
    let hasPaint = false;
    for (let index = 0; index < probeData.length; index += 4) {
      if (probeData[index + 3] !== 255) return false;
      if (!isMattePixel(probeData, index)) hasPaint = true;
    }
    const corners = [0, 15 * 4, 15 * 16 * 4, (16 * 16 - 1) * 4];
    if (!hasPaint || !corners.every((index) => isMattePixel(probeData, index))) return false;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return false;
    const full = context.getImageData(0, 0, canvas.width, canvas.height);
    if (!stripOpaqueWhiteMatte(full.data, canvas.width, canvas.height)) return false;
    context.putImageData(full, 0, 0);
    return true;
  } catch {
    return false;
  }
}
