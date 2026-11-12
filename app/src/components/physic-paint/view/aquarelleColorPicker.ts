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
//  61-17 (G-6): the ONE permitted sibling import is the dependency-free
//  `vectorPathLatches` leaf, so latching the picker can release the
//  vector pen and an open path edit without importing the session.
//  61-23 (G-19): the reverse direction too — while a path edit is OPEN the
//  ONE armed verdict is false, so no consumer renders or samples a picker.
//  Alt wears two hats: outside an edit it is the temporary pick, inside an
//  edit it is the handle-break modifier read from the pointer event
//  (`event.altKey` in `continueEditDrag`), never from session state. The
//  61-17 entry-edge law is unchanged: latching the picker still releases the
//  pen and closes the edit.
// ============================================================

import { computed, signal } from '@preact/signals';
import { exitPathEdit, exitVectorPen, pathEditMutationId } from './vectorPathLatches';

/** Session-only UI state — never persisted. */
export const aquarellePickerLatched = signal(false);
/** True only while the Alt key is held (the temporary picker). */
export const aquarellePickerAltHeld = signal(false);

/**
 * The one armed verdict: a latched rail pick or a held Alt, and NOT while a
 * vector path edit owns the canvas (61-23 / G-19).
 */
export const aquarellePickerActive = computed(
  () =>
    (aquarellePickerLatched.value || aquarellePickerAltHeld.value) &&
    pathEditMutationId.value === null,
);

/** Compare-then-write (efx-preact-reactivity rule 3). */
export function setAquarellePickerLatched(next: boolean): void {
  if (aquarellePickerLatched.peek() === next) return;
  // 61-17 (G-6): arming the picker releases the vector pen and closes any
  // open path edit — the vector overlay draws above the sheet and would
  // swallow a latched pick. ENTRY EDGE ONLY: `disarmAquarellePicker` is a
  // release path and must never disturb the pen or the edit.
  if (next) {
    exitVectorPen();
    exitPathEdit();
  }
  aquarellePickerLatched.value = next;
}

/** Compare-then-write (efx-preact-reactivity rule 3). */
export function setAquarellePickerAltHeld(next: boolean): void {
  if (aquarellePickerAltHeld.peek() === next) return;
  // 61-23 (G-19): Alt is context-ambiguous. Inside an open path edit it means
  // "break the handle" — the overlay reads `event.altKey` straight off the
  // pointer — never "temporary pick". A keydown that armed the session signal
  // here would resurface the picker the instant the edit closes, a picker the
  // user never armed after it. Only the ARMING write is refused; a release
  // (`next === false`) always lands so the hold can never stick.
  if (next && pathEditMutationId.peek() !== null) return;
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
 *
 * A DIRECT predicate over the three signals (not a computed `.peek()`): a
 * computed that nobody read stays dirty after a source write, and this probe
 * must be fresh at dispatch time (T-61-71). 61-23 (G-19): an open path edit
 * is never armed, so the pick seam agrees with the visor's one computed.
 */
export function isAquarellePickerArmed(): boolean {
  return (
    (aquarellePickerLatched.peek() || aquarellePickerAltHeld.peek()) &&
    pathEditMutationId.peek() === null
  );
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
  /**
   * The store's flattened composite MINUS the active track (Background photo
   * + every other track + the paper fond) — the authoritative image under
   * this track's sheet. OMIT it only when the store record is unavailable;
   * the DOM monitor slices are then the fallback.
   */
  beneathCanvas?: HTMLCanvasElement | null;
  /**
   * 261030-cnq UAT round 3: a photo layer under the pointer wins outright.
   * Called with the normalized sheet point; a non-null hex is the photo's own
   * full-strength color (never mixed with paint, never scaled by the overlay
   * opacity) and is returned as the pick.
   */
  photoSampler?: ((u: number, v: number) => string | null) | null;
}): string | null {
  const shell = input.stack.querySelector<HTMLElement>('.demo-canvas-shell') ?? input.stack;
  const rect = shell.getBoundingClientRect();
  if (!(rect.width > 0) || !(rect.height > 0)) return null;
  const u = (input.clientX - rect.left) / rect.width;
  const v = (input.clientY - rect.top) / rect.height;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  const photoHex = input.photoSampler?.(u, v) ?? null;
  if (photoHex !== null) return photoHex;
  // 261030-cnq UAT fix: with a Background photo active, reading the DOM
  // monitor slice missed the photo and the pick fell through to the paint.
  // The store's flattened raster is the exact composite the monitor draws —
  // sample it first, and keep the DOM slices as the unavailable-record fallback.
  const beneath: ReadonlyArray<PickRgba | null> = input.beneathCanvas
    ? [sampleCanvasAtUv(input.beneathCanvas, u, v)]
    : [
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
        // Above monitor: the tracks above the active one.
        sampleCanvasAtUv(
          input.stack.querySelector<HTMLCanvasElement>('.physics-paint-program-monitor-above canvas'),
          u,
          v,
        ),
      ];
  const layers: ReadonlyArray<PickRgba | null> = [
    ...beneath,
    // Committed sheet — already STRAIGHT-ALPHA PIGMENT (AquarelleCachedBaseLayer).
    sampleCanvasAtUv(
      input.stack.querySelector<HTMLCanvasElement>('.demo-canvas-shell .aquarelle-cached-base'),
      u,
      v,
    ),
    // Live engine sheet — opaque transmittance from the caller's export.
    sampleTransmittanceCanvasAtUv(input.paintCanvas, u, v),
    // 261030-cnq UAT fix: the Photo Reference overlay is monitor paint ABOVE
    // the whole composite — if the photo is visible there, that is the color
    // the user is pointing at.
    sampleCanvasAtUv(
      input.stack.querySelector<HTMLCanvasElement>('.physics-paint-reference-ghost canvas'),
      u,
      v,
    ),
  ];
  const composed = compositePickLayers(layers);
  return composed.a < PICK_MIN_ALPHA ? null : rgbaToHex(composed);
}
