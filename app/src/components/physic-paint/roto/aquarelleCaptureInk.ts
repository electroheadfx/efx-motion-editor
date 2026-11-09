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
//  The localized signal (densest 12x12 sampling window, with a
//  per-pixel darkening cap) is DIAGNOSTIC ONLY. Its acceptance
//  path was reverted after the packaged-build UAT of 2026-11-09:
//  the local window admitted near-blank snapshots (paper texture
//  reads as local coverage) and committed them over fresh paint,
//  losing every stroke. Until the packaged build's blank sheet is
//  measured, only the historical global floor may decide — the
//  local ink is logged so the next reproduction carries evidence.
//
//  The global floor keeps its historical LUMINANCE meaning:
//  48x48 sample against white 248, per-mille scale. Luminance is
//  blind to a hue that keeps the canvas bright: yellow/orange
//  pigment mostly absorbs blue, so a visible wash can score below
//  0.3 and be rejected as "blank" (painting the stroke twice was
//  the user's workaround). Red/blue absorb strongly and pass.
//
//  The PIGMENT path fixes that without re-opening the blank hole:
//  it measures each pixel's per-channel deficit against the sheet's
//  OWN paper baseline (the 99th percentile of each channel in the
//  sample). A uniform cleared sheet of ANY paper color scores 0 by
//  construction; a yellow/orange wash deviates in blue and scores
//  its actual absorption. Acceptance is global (coverage mean), not
//  the dangerous localized window. The alpha channel cannot help:
//  MODE.transparent stores OPAQUE transmittance (alpha 255), so
//  alpha is constant and the RGB channels carry the pigment.
//
//  Every measurement failure is fail-open (a missing measurement
//  must never block a legitimate capture).
// ============================================================

export const AQUARELLE_CAPTURE_SAMPLE_SIZE = 48;

// Historical global mean floor (48x48, white 248, per-mille scale).
// Blank textured sheets measured 0.05-0.12; accepted wet captures
// 1.32-1.81 (261109-pwt). Meaning and value are unchanged.
export const AQUARELLE_MIN_CAPTURE_INK = 0.3;

// Color-aware floor, same per-mille scale, measured against the
// sheet's own paper baseline. A uniform blank scores 0 regardless of
// paper color; the stress blank fixtures (paper flecks) stayed at or
// below 0.42, while a faint yellow wash on white measured 1.84 and a
// yellow wash on tinted paper 0.92 (their luminance ink was 0.14 /
// 0.00, which the legacy floor rejected). 0.5 keeps a margin over
// colored paper grain while still passing a genuinely faint wash.
export const AQUARELLE_MIN_CAPTURE_PIGMENT_INK = 0.5;

export const AQUARELLE_CAPTURE_LOCAL_WINDOW = 12;
export const AQUARELLE_CAPTURE_LOCAL_STRIDE = 4;
export const AQUARELLE_CAPTURE_PIXEL_DARKENING_CAP = 8;

// DIAGNOSTIC-ONLY floor (never an acceptance path): the packaged
// build showed paper texture can push a blank sheet's densest window
// over this value, so accepting on it wiped fresh paint (UAT
// 2026-11-09). Keep measuring and logging it until the packaged
// blank sheet's localized ink is actually measured.
export const AQUARELLE_MIN_CAPTURE_LOCAL_INK = 2.5;

export interface AquarelleCaptureInkMeasurement {
  /** Historical luminance mean over every sample pixel (per-mille scale). */
  globalInk: number;
  /** Densest 12x12 window, capped per pixel, in the same per-mille scale. */
  localInk: number;
  /** Sample pixels whose luminance darkening is greater than zero. */
  inkPixels: number;
  /** Color-aware mean per-channel deficit below the sheet's paper baseline. */
  pigmentInk: number;
  /** Sample pixels whose pigment deficit vs the paper baseline is greater than zero. */
  pigmentPixels: number;
}

/** Fail-open measurement: every ink reads Infinity, so the gate passes. */
export const AQUARELLE_CAPTURE_INK_UNMEASURABLE: Readonly<AquarelleCaptureInkMeasurement> = Object.freeze({
  globalInk: Number.POSITIVE_INFINITY,
  localInk: Number.POSITIVE_INFINITY,
  inkPixels: 0,
  pigmentInk: Number.POSITIVE_INFINITY,
  pigmentPixels: 0,
});

const INK_SCALE = 1000 / 255;

function percentile(values: readonly number[], quantile: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * quantile)));
  return sorted[index] ?? 0;
}

/**
 * Measures the historical luminance ink and the color-aware pigment
 * ink from raw RGBA data. The alpha channel is deliberately ignored:
 * MODE.transparent stores OPAQUE transmittance (alpha 255), so only
 * the RGB channels carry pigment.
 */
export function measureAquarelleCaptureInk(
  data: ArrayLike<number>,
  width: number,
  height: number,
): AquarelleCaptureInkMeasurement {
  const pixelCount = width * height;
  if (pixelCount < 1) return AQUARELLE_CAPTURE_INK_UNMEASURABLE;
  const darkening = new Array<number>(pixelCount);
  const reds = new Array<number>(pixelCount);
  const greens = new Array<number>(pixelCount);
  const blues = new Array<number>(pixelCount);
  let globalSum = 0;
  let inkPixels = 0;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const index = pixel * 4;
    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;
    reds[pixel] = red;
    greens[pixel] = green;
    blues[pixel] = blue;
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    const value = Math.max(0, 248 - luminance);
    darkening[pixel] = value;
    globalSum += value;
    if (value > 0) inkPixels += 1;
  }
  const globalInk = (globalSum / pixelCount) * INK_SCALE;

  // The paper baseline is the 99th percentile of each channel: the sheet's
  // brightest pixels are the unpainted paper. A uniform cleared sheet of ANY
  // color scores zero deficit; any hue that deviates from the paper (yellow
  // absorbing blue, red absorbing green/blue, blue absorbing red/green) scores
  // its real absorption even when luminance barely moves.
  const paperRed = percentile(reds, 0.99);
  const paperGreen = percentile(greens, 0.99);
  const paperBlue = percentile(blues, 0.99);
  let pigmentSum = 0;
  let pigmentPixels = 0;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const deficit = Math.max(
      paperRed - (reds[pixel] ?? 0),
      paperGreen - (greens[pixel] ?? 0),
      paperBlue - (blues[pixel] ?? 0),
      0,
    );
    pigmentSum += deficit;
    if (deficit > 0) pigmentPixels += 1;
  }
  const pigmentInk = (pigmentSum / pixelCount) * INK_SCALE;

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

  return { globalInk, localInk, inkPixels, pigmentInk, pigmentPixels };
}

/**
 * The ONE capture decision. Two GLOBAL paths, both paper-relative in
 * spirit: the historical luminance floor, OR the color-aware per-channel
 * pigment deficit against the sheet's own paper baseline. The localized
 * window is diagnostic only — its acceptance reverted after it committed
 * near-blank snapshots over real paint in the packaged build.
 */
export function passesAquarelleCaptureInkGate(measurement: AquarelleCaptureInkMeasurement): boolean {
  return measurement.globalInk >= AQUARELLE_MIN_CAPTURE_INK
    || measurement.pigmentInk >= AQUARELLE_MIN_CAPTURE_PIGMENT_INK;
}
