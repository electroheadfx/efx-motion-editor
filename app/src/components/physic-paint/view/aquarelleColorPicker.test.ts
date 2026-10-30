// ============================================================
//  261030-cnq Task 1 — the Studio color picker (eyedropper).
//
//  Pure-module contract for the pick law: straight-alpha
//  source-over compositing bottom→top, the transmittance →
//  pigment conversion the display path already uses
//  (`lib/rasterAlpha.ts`), the normalized `#rrggbb` output, and
//  the two-signal picker state. Wiring is pinned with
//  readFileSync literals (the repo's established style).
//  No DOM, no Preact components.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PICK_MIN_ALPHA,
  aquarellePickerActive,
  aquarellePickerAltHeld,
  aquarellePickerLatched,
  compositePickLayers,
  compositeRgbaOver,
  disarmAquarellePicker,
  isAquarellePickerArmed,
  rgbaToHex,
  setAquarellePickerAltHeld,
  setAquarellePickerLatched,
  toggleAquarellePickerLatched,
  transmittancePixelToPigment,
  type PickRgba,
} from './aquarelleColorPicker';

const OPAQUE_BLACK: PickRgba = { r: 0, g: 0, b: 0, a: 1 };
const TRANSPARENT: PickRgba = { r: 0, g: 0, b: 0, a: 0 };

beforeEach(() => {
  disarmAquarellePicker();
});

describe('compositeRgbaOver — straight-alpha source-over', () => {
  it('an opaque top layer replaces the base completely', () => {
    const result = compositeRgbaOver(OPAQUE_BLACK, { r: 255, g: 0, b: 0, a: 1 });
    expect(result).toEqual({ r: 255, g: 0, b: 0, a: 1 });
  });

  it('a fully transparent top layer leaves the base unchanged', () => {
    const result = compositeRgbaOver({ r: 12, g: 34, b: 56, a: 0.5 }, TRANSPARENT);
    expect(result.r).toBeCloseTo(12);
    expect(result.g).toBeCloseTo(34);
    expect(result.b).toBeCloseTo(56);
    expect(result.a).toBeCloseTo(0.5);
  });

  it('composites 50% white over opaque black to mid grey at full opacity', () => {
    const result = compositeRgbaOver(OPAQUE_BLACK, { r: 255, g: 255, b: 255, a: 0.5 });
    expect(result.a).toBeCloseTo(1);
    expect(Math.round(result.r)).toBe(128);
    expect(Math.round(result.g)).toBe(128);
    expect(Math.round(result.b)).toBe(128);
  });

  it('two empty layers stay empty', () => {
    expect(compositeRgbaOver(TRANSPARENT, TRANSPARENT)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });
});

describe('compositePickLayers — bottom→top fold', () => {
  it('respects bottom→top order so an opaque upper layer wins', () => {
    const result = compositePickLayers([
      { r: 0, g: 0, b: 255, a: 1 },
      { r: 255, g: 0, b: 0, a: 1 },
    ]);
    expect(result).toEqual({ r: 255, g: 0, b: 0, a: 1 });
  });

  it('skips null layers', () => {
    const result = compositePickLayers([null, { r: 10, g: 20, b: 30, a: 1 }, null]);
    expect(result).toEqual({ r: 10, g: 20, b: 30, a: 1 });
  });

  it('returns a fully transparent composite for an empty or all-null list', () => {
    expect(compositePickLayers([])).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(compositePickLayers([null, null]).a).toBe(0);
    // The empty composite is rejected by the pick floor — never a black pick.
    expect(compositePickLayers([null, null]).a).toBeLessThan(PICK_MIN_ALPHA);
  });
});

describe('transmittancePixelToPigment — the display-path law (rasterAlpha.ts)', () => {
  it('a fully white transmittance pixel is no pigment', () => {
    expect(transmittancePixelToPigment(255, 255, 255)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it('a pure red transmittance pixel is fully opaque pure red pigment', () => {
    const result = transmittancePixelToPigment(255, 0, 0);
    expect(result.a).toBeCloseTo(1);
    expect(result.r).toBeCloseTo(255);
    expect(result.g).toBeCloseTo(0);
    expect(result.b).toBeCloseTo(0);
  });

  it('a light wash converts to the same pigment alpha the display path computes', () => {
    // min = 180 → alpha = 75/255; the only non-min channel saturates to 255.
    const result = transmittancePixelToPigment(255, 180, 180);
    expect(result.a).toBeCloseTo(75 / 255);
    expect(result.r).toBeCloseTo(255);
    expect(result.g).toBeCloseTo(0);
    expect(result.b).toBeCloseTo(0);
  });

  it('a near-min channel keeps its proportional pigment weight', () => {
    // (c - min) * 255 / (255 - min) — the rasterAlpha.ts scale, unrounded.
    const result = transmittancePixelToPigment(200, 180, 180);
    expect(result.a).toBeCloseTo(75 / 255);
    expect(result.r).toBeCloseTo((20 * 255) / 75);
    expect(result.g).toBeCloseTo(0);
    expect(result.b).toBeCloseTo(0);
  });
});

describe('rgbaToHex — the one normalized color string', () => {
  it('emits lower-case zero-padded #rrggbb', () => {
    expect(rgbaToHex({ r: 255, g: 0, b: 0, a: 1 })).toBe('#ff0000');
    expect(rgbaToHex({ r: 10, g: 20, b: 30, a: 0.5 })).toBe('#0a141e');
  });

  it('clamps out-of-range channels and rounds fractions', () => {
    expect(rgbaToHex({ r: -5, g: 300, b: 12.6, a: 1 })).toBe('#00ff0d');
    expect(rgbaToHex({ r: 127.5, g: 127.4, b: 0, a: 1 })).toBe('#807f00');
  });

  it('never emits an alpha channel — straight-alpha picks read as solid color', () => {
    expect(rgbaToHex({ r: 1, g: 2, b: 3, a: 0.2 })).toBe('#010203');
  });
});

describe('picker state — two signals, one active verdict', () => {
  it('defaults to disarmed', () => {
    expect(aquarellePickerLatched.value).toBe(false);
    expect(aquarellePickerAltHeld.value).toBe(false);
    expect(aquarellePickerActive.value).toBe(false);
    expect(isAquarellePickerArmed()).toBe(false);
  });

  it('disarm clears both the latch and the Alt hold', () => {
    setAquarellePickerAltHeld(true);
    setAquarellePickerLatched(true);
    expect(aquarellePickerActive.value).toBe(true);
    disarmAquarellePicker();
    expect(aquarellePickerLatched.value).toBe(false);
    expect(aquarellePickerAltHeld.value).toBe(false);
    expect(isAquarellePickerArmed()).toBe(false);
  });

  it('a repeated same-value set keeps the value (compare-then-write)', () => {
    setAquarellePickerAltHeld(true);
    const afterFirst = aquarellePickerAltHeld;
    setAquarellePickerAltHeld(true);
    expect(aquarellePickerAltHeld).toBe(afterFirst);
    expect(aquarellePickerAltHeld.value).toBe(true);
  });

  it('toggling the latch twice returns to disarmed', () => {
    toggleAquarellePickerLatched();
    expect(aquarellePickerLatched.value).toBe(true);
    expect(aquarellePickerActive.value).toBe(true);
    toggleAquarellePickerLatched();
    expect(aquarellePickerLatched.value).toBe(false);
    expect(aquarellePickerActive.value).toBe(false);
  });

  it('releasing Alt alone disarms a held (non-latched) picker', () => {
    setAquarellePickerAltHeld(true);
    expect(isAquarellePickerArmed()).toBe(true);
    setAquarellePickerAltHeld(false);
    expect(isAquarellePickerArmed()).toBe(false);
    expect(aquarellePickerLatched.value).toBe(false);
  });
});

describe('wiring pins — the pick is consumed at the canvas-stack capture phase', () => {
  it('the Studio view consumes a pick before the Roto edit intent', () => {
    const view = readFileSync(resolve(__dirname, './PhysicsPaintStudioView.tsx'), 'utf8');
    expect(view).toContain('if (props.onColorPick?.(event, event.currentTarget as HTMLElement))');
    expect(view).toContain('onColorPick?: (event: PointerEvent, stack: HTMLElement) => boolean;');
  });

  it('the Studio passes the pick handler into the canvas stack', () => {
    const studio = readFileSync(resolve(__dirname, '../PhysicsPaintStudio.tsx'), 'utf8');
    expect(studio).toContain('onColorPick: handleAquarelleColorPick');
  });
});
