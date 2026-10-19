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

/** Probe grid for {@link isFullyOpaqueRaster} — small enough to scan cheaply. */
const FULL_OPACITY_PROBE = 64;

/**
 * True when EVERY pixel of the raster is opaque (alpha 255). Aquarelle
 * MODE.transparent frames are opaque transmittance everywhere — white means
 * "no pigment" — while engine-1 paint frames keep real alpha wherever nothing
 * was painted. The probe downsamples to 64×64 and requires every probe pixel to
 * be fully opaque, so any genuine transparent region (even a thin stroke on a
 * large sheet) makes the answer false. One-pixel sampling is NOT enough here:
 * an engine-1 layer with paint in its top-left corner must not be mistaken for
 * transmittance.
 */
export function isFullyOpaqueRaster(canvas: HTMLCanvasElement): boolean {
  try {
    const probe = document.createElement('canvas');
    probe.width = FULL_OPACITY_PROBE;
    probe.height = FULL_OPACITY_PROBE;
    const context = probe.getContext('2d', { willReadFrequently: true });
    if (!context || typeof context.getImageData !== 'function') return false;
    context.clearRect(0, 0, FULL_OPACITY_PROBE, FULL_OPACITY_PROBE);
    context.drawImage(canvas, 0, 0, FULL_OPACITY_PROBE, FULL_OPACITY_PROBE);
    const data = context.getImageData(0, 0, FULL_OPACITY_PROBE, FULL_OPACITY_PROBE).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 255) return false;
    }
    return true;
  } catch {
    return false;
  }
}
