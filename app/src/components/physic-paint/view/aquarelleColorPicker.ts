// ============================================================
//  261030-cnq — the Studio color picker (eyedropper).
//
//  Two session-only signals and ONE sampling law. The picker is a
//  HOST tool: it is never an `AquarelleTool`, never enters the rail's
//  paint-tool row, and never touches `aquarelleActiveTool` — releasing
//  Alt or unlatching is literally "back to the previous tool".
//
//  Sampling reads the visible stack bottom→top in straight-alpha
//  source-over: paper fond → below program monitor (Background photo +
//  lower tracks) → cached base (already straight-alpha pigment) → live
//  engine sheet (opaque transmittance, converted with the SAME law the
//  display path uses — `lib/rasterAlpha.ts`) → above program monitor.
//
//  The module imports NOTHING from the Studio, `aquarelleRecordState`
//  or `aquarelleStrokeSelection`: those import this module, never the
//  reverse (one-way edge keeps the disarm choke points acyclic).
// ============================================================

import { computed, signal } from '@preact/signals';

/** Session-only UI state — never persisted. */
export const aquarellePickerLatched = signal(false);
/** True only while the Alt key is held (the temporary picker). */
export const aquarellePickerAltHeld = signal(false);

/** The one armed verdict: a latched rail pick or a held Alt. */
export const aquarellePickerActive = computed(
  () => aquarellePickerLatched.value || aquarellePickerAltHeld.value,
);

/** Compare-then-write (efx-preact-reactivity rule 3). */
export function setAquarellePickerLatched(next: boolean): void {
  if (aquarellePickerLatched.peek() === next) return;
  aquarellePickerLatched.value = next;
}

/** Compare-then-write (efx-preact-reactivity rule 3). */
export function setAquarellePickerAltHeld(next: boolean): void {
  if (aquarellePickerAltHeld.peek() === next) return;
  aquarellePickerAltHeld.value = next;
}

export function toggleAquarellePickerLatched(): void {
  setAquarellePickerLatched(!aquarellePickerLatched.peek());
}

/** The one disarm choke point (paint-tool picks, Select entry, blur/hide). */
export function disarmAquarellePicker(): void {
  setAquarellePickerLatched(false);
  setAquarellePickerAltHeld(false);
}

/**
 * The stable dispatch-time probe event handlers call. Always `.peek()` —
 * never a value read in a render body.
 */
export function isAquarellePickerArmed(): boolean {
  return aquarellePickerActive.peek();
}

/**
 * A sampled color: channels 0..255, `a` 0..1 STRAIGHT alpha
 * (un-premultiplied), matching every canvas this module reads.
 */
export interface PickRgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Below this composite alpha there is nothing visible to pick — an empty
 * blank key samples the paper, never a black `#000000` artifact.
 */
export const PICK_MIN_ALPHA = 0.02;

/**
 * Straight-alpha source-over: `top` painted over `base`.
 *
 * Kept exact (no per-layer rounding) — `rgbaToHex` quantizes once, so
 * stacking five layers never accumulates byte error.
 */
export function compositeRgbaOver(base: PickRgba, top: PickRgba): PickRgba {
  const a = top.a + base.a * (1 - top.a);
  if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 };
  const channel = (topChannel: number, baseChannel: number) =>
    (topChannel * top.a + baseChannel * base.a * (1 - top.a)) / a;
  return {
    r: channel(top.r, base.r),
    g: channel(top.g, base.g),
    b: channel(top.b, base.b),
    a,
  };
}

/** Fold a bottom→top layer list; null layers (absent canvases) are skipped. */
export function compositePickLayers(layers: ReadonlyArray<PickRgba | null>): PickRgba {
  let composed: PickRgba = { r: 0, g: 0, b: 0, a: 0 };
  for (const layer of layers) {
    if (!layer) continue;
    composed = compositeRgbaOver(composed, layer);
  }
  return composed;
}

/**
 * The live engine sheet exports OPAQUE TRANSMITTANCE (white = no pigment,
 * alpha 255 everywhere). Convert one pixel with the SAME law the display
 * path uses (`lib/rasterAlpha.ts`): `alpha = (255 - min) / 255`, each
 * pigment channel `(c - min) / alpha`. `min === 255` is no pigment at all.
 */
export function transmittancePixelToPigment(r: number, g: number, b: number): PickRgba {
  const min = Math.min(r, g, b);
  if (min >= 255) return { r: 0, g: 0, b: 0, a: 0 };
  const alpha = (255 - min) / 255;
  const channel = (value: number) => Math.min(255, Math.max(0, (value - min) / alpha));
  return { r: channel(r), g: channel(g), b: channel(b), a: alpha };
}

/**
 * The ONLY color string that may reach a CSS style or the engine color:
 * clamped, rounded, lower-case `#rrggbb` (threat T-261030-02).
 */
export function rgbaToHex(color: PickRgba): string {
  const hex = (value: number) => {
    const byte = Math.max(0, Math.min(255, Math.round(value)));
    return byte.toString(16).padStart(2, '0');
  };
  return `#${hex(color.r)}${hex(color.g)}${hex(color.b)}`;
}

/**
 * Read one pixel in the canvas's own UV space. Any tainted/unreadable
 * canvas or missing context yields null — swallowed, never logged
 * (threat T-261030-01).
 */
function sampleCanvasAtUv(canvas: HTMLCanvasElement | null, u: number, v: number): PickRgba | null {
  if (!canvas) return null;
  const { width, height } = canvas;
  if (!(width > 0) || !(height > 0)) return null;
  const px = Math.min(width - 1, Math.max(0, Math.floor(u * width)));
  const py = Math.min(height - 1, Math.max(0, Math.floor(v * height)));
  try {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    const data = context.getImageData(px, py, 1, 1).data;
    return { r: data[0] ?? 0, g: data[1] ?? 0, b: data[2] ?? 0, a: (data[3] ?? 0) / 255 };
  } catch {
    return null;
  }
}

/** The live engine export is opaque transmittance — convert, never read alpha. */
function sampleTransmittanceCanvasAtUv(
  canvas: HTMLCanvasElement | null,
  u: number,
  v: number,
): PickRgba | null {
  const pixel = sampleCanvasAtUv(canvas, u, v);
  return pixel ? transmittancePixelToPigment(pixel.r, pixel.g, pixel.b) : null;
}

/**
 * Sample the visible composite under a client point and return the
 * normalized hex, or null when nothing visible sits there.
 *
 * `paintCanvas` is the caller's live engine export
 * (`exportCanvas('transparent', false)`) — this module never imports the
 * engine port.
 */
export function sampleAquarelleStackColor(input: {
  stack: HTMLElement;
  clientX: number;
  clientY: number;
  paintCanvas: HTMLCanvasElement | null;
}): string | null {
  const shell = input.stack.querySelector<HTMLElement>('.demo-canvas-shell') ?? input.stack;
  const rect = shell.getBoundingClientRect();
  if (!(rect.width > 0) || !(rect.height > 0)) return null;
  const u = (input.clientX - rect.left) / rect.width;
  const v = (input.clientY - rect.top) / rect.height;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  const layers: ReadonlyArray<PickRgba | null> = [
    // Paper fond (project resolution, CSS-scaled to the shell).
    sampleCanvasAtUv(input.stack.querySelector<HTMLCanvasElement>('.physics-paint-fond-layer canvas'), u, v),
    // Below monitor: the Background photo + every track below the active one.
    sampleCanvasAtUv(
      input.stack.querySelector<HTMLCanvasElement>(
        '.physics-paint-program-monitor:not(.physics-paint-program-monitor-above) canvas',
      ),
      u,
      v,
    ),
    // Committed sheet — already STRAIGHT-ALPHA PIGMENT (AquarelleCachedBaseLayer).
    sampleCanvasAtUv(
      input.stack.querySelector<HTMLCanvasElement>('.demo-canvas-shell .aquarelle-cached-base'),
      u,
      v,
    ),
    // Live engine sheet — opaque transmittance from the caller's export.
    sampleTransmittanceCanvasAtUv(input.paintCanvas, u, v),
    // Above monitor: the tracks above the active one.
    sampleCanvasAtUv(
      input.stack.querySelector<HTMLCanvasElement>('.physics-paint-program-monitor-above canvas'),
      u,
      v,
    ),
  ];
  const composed = compositePickLayers(layers);
  return composed.a < PICK_MIN_ALPHA ? null : rgbaToHex(composed);
}
