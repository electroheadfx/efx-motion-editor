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

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { aquarelleActiveTool, setAquarelleTool } from './aquarelleRecordState';
import { aquarelleSelectMode, setAquarelleSelectMode } from './aquarelleStrokeSelection';
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
import { photoPixelAt } from './aquarellePhotoPick';

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

describe('disarm laws — a paint tool or Move/Edit leaves the picker', () => {
  afterEach(() => {
    setAquarelleSelectMode(false);
    setAquarelleTool('brush');
  });

  it('a paint-tool pick disarms a latched picker even when the tool is already active', () => {
    setAquarelleTool('brush');
    setAquarellePickerLatched(true);
    expect(isAquarellePickerArmed()).toBe(true);
    setAquarelleTool('brush');
    // The equality early-return must not swallow the disarm.
    expect(aquarellePickerLatched.value).toBe(false);
    expect(aquarellePickerActive.value).toBe(false);
  });

  it('a paint-tool pick keeps the active tool compare-then-write', () => {
    setAquarelleTool('pen');
    expect(aquarelleActiveTool.value).toBe('pen');
    setAquarelleTool('water');
    expect(aquarelleActiveTool.value).toBe('water');
  });

  it('entering Move/Edit disarms the picker', () => {
    setAquarellePickerLatched(true);
    setAquarelleSelectMode(true);
    expect(aquarelleSelectMode.value).toBe(true);
    expect(aquarellePickerLatched.value).toBe(false);
    expect(isAquarellePickerArmed()).toBe(false);
  });

  it('leaving Move/Edit leaves the picker untouched', () => {
    setAquarelleSelectMode(true);
    setAquarelleSelectMode(false);
    setAquarellePickerLatched(true);
    setAquarelleSelectMode(false);
    expect(aquarellePickerLatched.value).toBe(true);
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

  it('the left rail renders the Picker button outside the paint-tool row', () => {
    const rail = readFileSync(resolve(__dirname, './PhysicsPaintToolRail.tsx'), 'utf8');
    expect(rail).toContain('data-testid="aquarelle-picker-toggle"');
    // The picker is a host tool — never a member of the paint-tool union.
    expect(rail).not.toContain("id: 'picker'");
  });
});

describe('photo pointer mapping (UAT round 3)', () => {
  const placement = {
    imageWidth: 200,
    imageHeight: 100,
    centerU: 0.5,
    centerV: 0.5,
    widthU: 0.5,
    heightV: 0.25,
    rotationDeg: 0,
    scaleX: 1,
    scaleY: 1,
  };

  it('maps a point inside the photo to its source pixel', () => {
    expect(photoPixelAt(placement, 0.5, 0.5)).toEqual({ x: 100, y: 50 });
    expect(photoPixelAt(placement, 0.3, 0.4)).toEqual({ x: 20, y: 10 });
  });

  it('rejects points outside the photo rect', () => {
    expect(photoPixelAt(placement, 0.1, 0.5)).toBeNull();
    expect(photoPixelAt(placement, 0.5, 0.9)).toBeNull();
  });

  it('inverts the transform rotation', () => {
    // A point to the RIGHT of center maps to the image's TOP edge at 90°.
    expect(photoPixelAt({ ...placement, rotationDeg: 90 }, 0.6, 0.5)).toEqual({ x: 100, y: 10 });
  });

  it('rejects a degenerate scale', () => {
    expect(photoPixelAt({ ...placement, scaleX: 0 }, 0.5, 0.5)).toBeNull();
  });
});

describe('wiring pins — UAT round 2/3 (visor, photo sampling, slider hit area)', () => {
  it('the picker pointer is a lucide Pipette visor above the tracks group', () => {
    const view = readFileSync(resolve(__dirname, './PhysicsPaintStudioView.tsx'), 'utf8');
    expect(view).toContain('<AquarellePickerVisor');
    const visor = readFileSync(resolve(__dirname, './AquarellePickerVisor.tsx'), 'utf8');
    expect(visor).toContain("import { Pipette } from 'lucide-preact'");
    expect(visor).toContain('<Pipette size={20} />');
    // No hand-embedded cursor asset: the OS cursor is `none` on the sheet and
    // the brush ring must step aside while armed.
    const layer = readFileSync(resolve(__dirname, '../engine/AquarelleCanvasLayer.tsx'), 'utf8');
    expect(layer).toContain('if (aquarellePickerActive.value) return null;');
    // The Alt arming listeners must be CAPTURE-phase: a focused Studio dialog
    // stops keydown propagation and would otherwise keep Alt from ever arming
    // the picker.
    const hook = readFileSync(resolve(__dirname, '../hooks/useAquarelleColorPicker.ts'), 'utf8');
    expect(hook).toContain("window.addEventListener('keydown', handleKeyDown, true)");
    expect(hook).toContain("window.addEventListener('keyup', handleKeyUp, true)");
    const css = readFileSync(resolve(__dirname, '../physicsPaintStudio.css'), 'utf8');
    expect(css).toContain('.physics-paint-picker-visor');
    expect(css).not.toContain('data:image/png;base64');
  });

  it('the pick samples the store composite and prefers a photo layer', () => {
    const studio = readFileSync(resolve(__dirname, '../PhysicsPaintStudio.tsx'), 'utf8');
    expect(studio).toContain('const record = physicPaintStore.getFlattenedFrameExcluding(');
    expect(studio).toContain('beneathCanvas = record && !record.transmittance');
    expect(studio).toContain('createPhotoPickSampler(layerId, currentFrame, projectCanvasWidth, projectCanvasHeight)');
    const picker = readFileSync(resolve(__dirname, './aquarelleColorPicker.ts'), 'utf8');
    expect(picker).toContain('input.beneathCanvas');
    expect(picker).toContain('input.photoSampler?.(u, v)');
    expect(picker).toContain('.physics-paint-reference-ghost canvas');
  });

  it('the photo-reference opacity slider input spans the whole track', () => {
    const css = readFileSync(resolve(__dirname, '../physicsPaintStudio.css'), 'utf8');
    // A bare class loses to the global `input[type="range"] { width: 80px }`
    // rule, which left the input as an 80px stub and made the thumb undraggable.
    expect(css).toContain('input[type="range"].physics-paint-photo-reference-slider-input');
    expect(css).not.toContain('\n.physics-paint-photo-reference-slider-input {');
  });
});
