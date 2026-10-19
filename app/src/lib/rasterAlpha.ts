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

/**
 * Convert an opaque aquarelle transmittance raster into a STRAIGHT-ALPHA paint
 * raster so the normal layer blend model (and the user's chosen blend mode) can
 * apply. `t` is the transmittance (white = no pigment, dark = absorbs light):
 *
 *   alpha = 1 - min(t.r, t.g, t.b)      (the least-transmitted channel)
 *   color = (t - min) / alpha            (the pigment colour, un-premultiplied)
 *
 * This is exact over white: alpha*color + (1-alpha) = t, so the paint keeps its
 * watercolour look; unpainted white becomes fully transparent, and non-normal
 * layer blends (screen/overlay/add) see a real pigment colour instead of a
 * white background. Returns null when pixels cannot be read/written.
 */
export function transmittanceToAlpha(canvas: HTMLCanvasElement): HTMLCanvasElement | null {
  try {
    const width = canvas.width;
    const height = canvas.height;
    if (!width || !height) return null;
    const source = canvas.getContext('2d', { willReadFrequently: true });
    if (!source || typeof source.getImageData !== 'function') return null;
    const image = source.getImageData(0, 0, width, height);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      const min = Math.min(data[i], data[i + 1], data[i + 2]);
      const alpha = 255 - min;
      if (alpha === 0) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
        continue;
      }
      const scale = 255 / alpha;
      data[i] = Math.min(255, Math.round((data[i] - min) * scale));
      data[i + 1] = Math.min(255, Math.round((data[i + 1] - min) * scale));
      data[i + 2] = Math.min(255, Math.round((data[i + 2] - min) * scale));
      data[i + 3] = alpha;
    }
    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const context = out.getContext('2d');
    if (!context || typeof context.putImageData !== 'function') return null;
    context.putImageData(image, 0, 0);
    return out;
  } catch {
    return null;
  }
}
