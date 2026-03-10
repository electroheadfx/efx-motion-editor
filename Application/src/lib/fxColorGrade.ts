/**
 * Color grade adjustment layer -- composite-operation pipeline.
 *
 * Uses Canvas 2D globalCompositeOperation blending instead of ctx.filter
 * (which silently fails in Tauri's WebKit WebView on tainted canvases).
 *
 * Brightness: screen (lighten) / multiply (darken) with solid fills.
 * Contrast: overlay blend of image on itself.
 * Saturation: grayscale desaturation via luminance composite, or color composite for boost.
 * Hue: color-temperature shift via 'color' composite (warm/cool tint).
 * Fade: solid color overlay with configurable blend mode.
 */

export interface ColorGradeParams {
  brightness: number;  // -1 to 1 (0 = neutral)
  contrast: number;    // -1 to 1 (0 = neutral)
  saturation: number;  // -1 to 1 (0 = neutral, -1 = grayscale, 1 = oversaturated)
  hue: number;         // -180 to 180 degrees
  fade: number;        // 0 to 1
  tintColor: string;   // hex color like '#D4A574'
  fadeBlend?: string;   // blend mode for tint overlay (default: 'source-over')
}

/** Cached offscreen canvas (avoids per-frame allocation) */
let _offscreen: HTMLCanvasElement | null = null;

function getOffscreen(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (!_offscreen) _offscreen = document.createElement('canvas');
  if (_offscreen.width !== w || _offscreen.height !== h) {
    _offscreen.width = w;
    _offscreen.height = h;
  }
  const ctx = _offscreen.getContext('2d');
  if (!ctx) return null;
  return { canvas: _offscreen, ctx };
}

/**
 * Apply color grade adjustments to the canvas using composite operations.
 */
export function applyColorGrade(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  params: ColorGradeParams,
): void {
  if (
    params.brightness === 0 &&
    params.contrast === 0 &&
    params.saturation === 0 &&
    params.hue === 0 &&
    params.fade === 0
  ) {
    return;
  }

  ctx.save();
  ctx.resetTransform();

  // ── Brightness ──
  if (params.brightness > 0) {
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = params.brightness;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  } else if (params.brightness < 0) {
    ctx.globalCompositeOperation = 'multiply';
    const gray = Math.round(255 * (1 + params.brightness));
    ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
    ctx.fillRect(0, 0, w, h);
  }

  // ── Contrast ──
  if (params.contrast > 0) {
    const off = getOffscreen(w, h);
    if (off) {
      off.ctx.clearRect(0, 0, w, h);
      off.ctx.drawImage(ctx.canvas, 0, 0);
      ctx.globalCompositeOperation = 'overlay';
      const passes = Math.ceil(params.contrast * 3);
      const alpha = (params.contrast * 3) / passes;
      for (let i = 0; i < passes; i++) {
        ctx.globalAlpha = alpha;
        ctx.drawImage(off.canvas, 0, 0);
      }
      ctx.globalAlpha = 1;
    }
  } else if (params.contrast < 0) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = -params.contrast * 0.7;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  // ── Saturation ──
  if (params.saturation < 0) {
    const off = getOffscreen(w, h);
    if (off) {
      off.ctx.clearRect(0, 0, w, h);
      off.ctx.drawImage(ctx.canvas, 0, 0);
      off.ctx.globalCompositeOperation = 'saturation';
      off.ctx.fillStyle = '#808080';
      off.ctx.fillRect(0, 0, w, h);
      off.ctx.globalCompositeOperation = 'source-over';
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = -params.saturation;
      ctx.drawImage(off.canvas, 0, 0);
      ctx.globalAlpha = 1;
    }
  } else if (params.saturation > 0) {
    const off = getOffscreen(w, h);
    if (off) {
      off.ctx.clearRect(0, 0, w, h);
      off.ctx.drawImage(ctx.canvas, 0, 0);
      ctx.globalCompositeOperation = 'color';
      ctx.globalAlpha = params.saturation * 0.6;
      ctx.drawImage(off.canvas, 0, 0);
      ctx.globalAlpha = 1;
    }
  }

  // ── Hue / Color Temperature ──
  // ctx.filter is broken in Tauri WebKit (silently ignored on tainted canvases).
  // Approximate hue rotation as a color-temperature shift using 'color' composite:
  // positive = warmer (amber), negative = cooler (blue).
  if (params.hue !== 0) {
    const strength = Math.abs(params.hue) / 90;
    const alpha = Math.min(0.7, strength * 0.35);
    ctx.globalCompositeOperation = 'color';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = params.hue > 0 ? '#E89050' : '#5080C0';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  // Reset composite for fade
  ctx.globalCompositeOperation = 'source-over';

  // ── Fade to Tint ──
  if (params.fade > 0) {
    const blendMode = params.fadeBlend ?? 'source-over';
    ctx.globalCompositeOperation = blendMode as GlobalCompositeOperation;
    ctx.globalAlpha = params.fade;
    ctx.fillStyle = params.tintColor;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}
