/** Probe grid for {@link isFullyOpaqueRaster} — small enough to scan cheaply. */
const FULL_OPACITY_PROBE = 64;

/**
 * True when EVERY pixel of the raster is opaque (alpha 255). Aquarelle
 * MODE.transparent frames are opaque transmittance everywhere — white means
 * "no pigment" — while engine-1 paint frames keep real alpha wherever nothing
 * was painted. The probe downsamples to 64×64 and requires every probe pixel to
 * be fully opaque, so any genuine transparent region (even a thin stroke on a
 * large sheet) makes the answer false. Lives outside physicPaintStore (the
 * frame/export guard pins that file free of pixel-array canvas APIs).
 */
export function isFullyOpaqueRaster(source: CanvasImageSource): boolean {
  try {
    const probe = document.createElement('canvas');
    probe.width = FULL_OPACITY_PROBE;
    probe.height = FULL_OPACITY_PROBE;
    const context = probe.getContext('2d', { willReadFrequently: true });
    if (!context || typeof context.getImageData !== 'function') return false;
    context.clearRect(0, 0, FULL_OPACITY_PROBE, FULL_OPACITY_PROBE);
    context.drawImage(source, 0, 0, FULL_OPACITY_PROBE, FULL_OPACITY_PROBE);
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

export interface RasterRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 261028-k03b: the SAME transmittance→pigment-alpha law over one rect of an
 * already-decoded transmittance ImageData. The lift preview punches a dirty
 * rect in linear light and must redraw exactly that rect without re-reading
 * the full sheet. Returns null for an empty/out-of-bounds rect.
 */
export function transmittanceRectToPigmentAlpha(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  rect: RasterRect,
): ImageData | null {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(width, Math.ceil(rect.x + rect.width));
  const y1 = Math.min(height, Math.ceil(rect.y + rect.height));
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) return null;
  const out = new ImageData(w, h);
  const target = out.data;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const source = ((y0 + y) * width + (x0 + x)) * 4;
      const index = (y * w + x) * 4;
      const min = Math.min(data[source], data[source + 1], data[source + 2]);
      const alpha = 255 - min;
      if (alpha === 0) continue;
      const scale = 255 / alpha;
      target[index] = Math.min(255, Math.round((data[source] - min) * scale));
      target[index + 1] = Math.min(255, Math.round((data[source + 1] - min) * scale));
      target[index + 2] = Math.min(255, Math.round((data[source + 2] - min) * scale));
      target[index + 3] = alpha;
    }
  }
  return out;
}

/**
 * 2026-10-26 (round 2, option B): the display/composite seam for stored
 * aquarelle sheets. Storage keeps the OPAQUE MODE.transparent transmittance
 * (format unchanged, old projects render, thumbnails/pose margins keep their
 * proven law). A surface that must stack the sheet as a real paint layer asks
 * for its pigment-alpha twin here:
 *
 *   - fully opaque source + readable pixels → converted canvas;
 *   - anything else (engine-1 real-alpha paint, an unreadable probe, a
 *     security-restricted context) → null, so the caller draws the source
 *     untouched.
 *
 * MEMOIZED by source identity. This is exact only while the source pixels are
 * immutable — ImageBitmaps from the content-token LRU, registered frame
 * canvases, or a one-shot export snapshot. NEVER pass a canvas that is redrawn
 * in place (a live engine surface): the cache would serve stale pixels. The
 * weak map also bounds itself — entries die with their source.
 */
const pigmentAlphaBySource = new WeakMap<CanvasImageSource, HTMLCanvasElement | null>();

export function transmittanceSourceToPigmentAlpha(source: CanvasImageSource): HTMLCanvasElement | null {
  if (pigmentAlphaBySource.has(source)) return pigmentAlphaBySource.get(source) ?? null;
  let converted: HTMLCanvasElement | null = null;
  try {
    if (isFullyOpaqueRaster(source)) {
      converted = hasCanvasContext(source) ? transmittanceToAlpha(source) : drawSourceToCanvas(source);
    }
  } catch {
    converted = null;
  }
  pigmentAlphaBySource.set(source, converted);
  return converted;
}

function hasCanvasContext(source: CanvasImageSource): source is HTMLCanvasElement {
  return typeof (source as { getContext?: unknown }).getContext === 'function';
}

/**
 * Non-canvas sources (ImageBitmap) cannot be read directly: draw into a
 * full-size canvas once, then convert. The draw-in canvas is never cached —
 * only the converted output is, keyed by the immutable source.
 */
function drawSourceToCanvas(source: CanvasImageSource): HTMLCanvasElement | null {
  try {
    const width = Math.max(0, Math.floor((source as { width?: number }).width ?? 0));
    const height = Math.max(0, Math.floor((source as { height?: number }).height ?? 0));
    if (!width || !height) return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(source, 0, 0);
    return transmittanceToAlpha(canvas);
  } catch {
    return null;
  }
}
