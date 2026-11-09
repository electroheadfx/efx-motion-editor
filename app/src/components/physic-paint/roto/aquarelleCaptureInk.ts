// ============================================================
//  aquarelleCaptureInk — the blank-sheet capture gate
//  (quick 261109-uj0), node-pure and deterministic.
//
//  The gate has ONE job: reject a cleared/blank sheet so a blank
//  capture cannot overwrite real cached pixels. A faint wet wash
//  is legitimate and MUST pass — the packaged v2.1.0-beta2 build
//  still rejected a wash that `pnpm tauri dev` accepted even
//  though its embedded Studio bundle carried the same 0.3
//  constant. The global mean is a mean over every one of the
//  2304 downsampled pixels: it falls with canvas coverage and
//  depends on when the sheet is sampled, so the decision can no
//  longer rest on that coverage-dependent statistic alone.
//
//  The localized signal is the densest 12x12 sampling window,
//  with a per-pixel darkening cap. A wash is an AREA phenomenon
//  while paper specks are an AMPLITUDE phenomenon, so a few
//  extreme samples must not impersonate coverage — the cap makes
//  isolated specks a coverage question too.
//
//  The global floor keeps its historical diagnostic meaning:
//  48x48 sample against white 248, per-mille scale. Every
//  measurement failure is fail-open (a missing measurement must
//  never block a legitimate capture).
// ============================================================

export const AQUARELLE_CAPTURE_SAMPLE_SIZE = 48;

// Historical global mean floor (48x48, white 248, per-mille scale).
// Blank textured sheets measured 0.05-0.12; accepted wet captures
// 1.32-1.81 (261109-pwt). Meaning and value are unchanged.
export const AQUARELLE_MIN_CAPTURE_INK = 0.3;

export const AQUARELLE_CAPTURE_LOCAL_WINDOW = 12;
export const AQUARELLE_CAPTURE_LOCAL_STRIDE = 4;
export const AQUARELLE_CAPTURE_PIXEL_DARKENING_CAP = 8;

// The densest window must hold real coverage before it can carry a
// faint wash: blank-plus-flecks stayed at or below 1.85, a 6x6
// darkening-4 wash measured 3.92.
export const AQUARELLE_MIN_CAPTURE_LOCAL_INK = 2.5;

export interface AquarelleCaptureInkMeasurement {
  /** Historical global mean over every sample pixel (per-mille scale). */
  globalInk: number;
  /** Densest 12x12 window, capped per pixel, in the same per-mille scale. */
  localInk: number;
  /** Sample pixels whose darkening is greater than zero. */
  inkPixels: number;
}

/** Fail-open measurement: both inks read Infinity, so the gate passes. */
export const AQUARELLE_CAPTURE_INK_UNMEASURABLE: Readonly<AquarelleCaptureInkMeasurement> = Object.freeze({
  globalInk: Number.POSITIVE_INFINITY,
  localInk: Number.POSITIVE_INFINITY,
  inkPixels: 0,
});

const INK_SCALE = 1000 / 255;

/**
 * Measures the historical global ink and the densest capped window
 * from raw RGBA data. The alpha channel is deliberately ignored,
 * matching the existing sheet readback.
 */
export function measureAquarelleCaptureInk(
  data: ArrayLike<number>,
  width: number,
  height: number,
): AquarelleCaptureInkMeasurement {
  const pixelCount = width * height;
  if (pixelCount < 1) return AQUARELLE_CAPTURE_INK_UNMEASURABLE;
  const darkening = new Array<number>(pixelCount);
  let globalSum = 0;
  let inkPixels = 0;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const index = pixel * 4;
    const blue = data[index + 2] ?? 0;
    const luminance = 0.2126 * (data[index] ?? 0) + 0.7152 * (data[index + 1] ?? 0) + 0.0722 * blue;
    const value = Math.max(0, 248 - luminance);
    darkening[pixel] = value;
    globalSum += value;
    if (value > 0) inkPixels += 1;
  }
  const globalInk = (globalSum / pixelCount) * INK_SCALE;

  // A sample smaller than the window uses ONE window over the whole
  // sample; otherwise sliding windows (stride 4) guarantee that any
  // object up to nine pixels across lands fully inside some window.
  const smallSample = width < AQUARELLE_CAPTURE_LOCAL_WINDOW || height < AQUARELLE_CAPTURE_LOCAL_WINDOW;
  const windowWidth = smallSample ? width : AQUARELLE_CAPTURE_LOCAL_WINDOW;
  const windowHeight = smallSample ? height : AQUARELLE_CAPTURE_LOCAL_WINDOW;
  let densestWindowSum = 0;
  const maxStartY = smallSample ? 0 : height - windowHeight;
  const maxStartX = smallSample ? 0 : width - windowWidth;
  for (let startY = 0; startY <= maxStartY; startY += AQUARELLE_CAPTURE_LOCAL_STRIDE) {
    for (let startX = 0; startX <= maxStartX; startX += AQUARELLE_CAPTURE_LOCAL_STRIDE) {
      let windowSum = 0;
      for (let y = startY; y < startY + windowHeight; y += 1) {
        const rowStart = y * width;
        for (let x = startX; x < startX + windowWidth; x += 1) {
          const value = darkening[rowStart + x] ?? 0;
          windowSum += value > AQUARELLE_CAPTURE_PIXEL_DARKENING_CAP
            ? AQUARELLE_CAPTURE_PIXEL_DARKENING_CAP
            : value;
        }
      }
      if (windowSum > densestWindowSum) densestWindowSum = windowSum;
    }
  }
  const localInk = (densestWindowSum / (windowWidth * windowHeight)) * INK_SCALE;

  return { globalInk, localInk, inkPixels };
}

/** The ONE capture decision: either the historical global path or the localized window. */
export function passesAquarelleCaptureInkGate(measurement: AquarelleCaptureInkMeasurement): boolean {
  return measurement.globalInk >= AQUARELLE_MIN_CAPTURE_INK
    || measurement.localInk >= AQUARELLE_MIN_CAPTURE_LOCAL_INK;
}
