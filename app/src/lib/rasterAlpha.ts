/**
 * studio-reopen-paper-washout: the aquarelle cache is MODE.transparent
 * transmittance (opaque — "how much paper light gets through") and must
 * MULTIPLY over the fond; engine-1 paint is real-alpha and stays source-over.
 * This probe lives OUTSIDE physicPaintStore (the frame/export guard pins that
 * file free of pixel-array canvas APIs).
 */
export function isOpaqueRaster(canvas: HTMLCanvasElement): boolean {
  try {
    const context = canvas.getContext('2d');
    if (!context || typeof context.getImageData !== 'function') return false;
    return context.getImageData(0, 0, 1, 1).data[3] === 255;
  } catch {
    return false;
  }
}
