/**
 * p5.brush standalone adapter for brush FX rendering.
 *
 * p5.brush renders via WebGL2 with spectral pigment mixing (Kubelka-Munk).
 * Strokes are stamped into a WebGL mask framebuffer, then composited to the
 * canvas via a spectral blend shader. brush.render() flushes this pipeline.
 *
 * Weight scaling: p5.brush computes visual diameter as
 *   2 * strokeWeight * brush.param.weight * pressure
 * Each preset has a different param.weight, so we compensate to match our
 * stroke.size (desired diameter in project pixels).
 */

import * as brush from 'p5.brush/standalone';
import type {PaintStroke} from '../types/paint';

// ---------------------------------------------------------------------------
// Style mapping: our BrushStyle -> p5.brush preset name
// ---------------------------------------------------------------------------
const STYLE_MAP: Record<string, string> = {
  flat: '',
  watercolor: 'marker',
  ink: 'our_ink',
  charcoal: 'our_charcoal',
  pencil: 'our_pencil',
  marker: 'marker',
};

// p5.brush internal param.weight for each preset — used to compensate stroke size.
// Visual diameter = 2 * strokeWeight * paramWeight * pressure.
// To get desired diameter D at pressure=1: strokeWeight = D / (2 * paramWeight).
const PARAM_WEIGHT: Record<string, number> = {
  marker: 2,
  our_ink: 0.25,
  our_charcoal: 0.35,
  our_pencil: 0.3,
};

// ---------------------------------------------------------------------------
// Singleton canvas management
// p5.brush requires WebGL2 — OffscreenCanvas doesn't support WebGL2 in
// WKWebView (Tauri/Safari), so we use a detached HTMLCanvasElement.
// ---------------------------------------------------------------------------
let _canvas: HTMLCanvasElement | null = null;
let _initialized = false;
let _customBrushesAdded = false;
let _currentWidth = 0;
let _currentHeight = 0;
let _loadFailed = false;

function initCustomBrushes(): void {
  brush.add('our_ink', {
    type: 'default',
    weight: 0.25,
    scatter: 0.2,
    sharpness: 0.85,
    grain: 0.8,
    opacity: 180,
    pressure: [0.8, 1.2],
    rotate: 'natural',
  });

  brush.add('our_charcoal', {
    type: 'default',
    weight: 0.35,
    scatter: 1.5,
    sharpness: 0.68,
    grain: 2.0,
    opacity: 120,
    rotate: 'random',
  });

  brush.add('our_pencil', {
    type: 'default',
    weight: 0.3,
    scatter: 0.6,
    sharpness: 0.3,
    grain: 0.7,
    opacity: 170,
  });
}

function ensureInitialized(width: number, height: number): boolean {
  if (typeof document === 'undefined') return false;
  if (_loadFailed) return false;

  if (_canvas && _initialized && _currentWidth === width && _currentHeight === height) {
    return true;
  }

  _canvas = document.createElement('canvas');
  _canvas.width = width;
  _canvas.height = height;
  _currentWidth = width;
  _currentHeight = height;

  try {
    brush.load(_canvas);
  } catch (e) {
    console.warn('[brushP5Adapter] p5.brush init failed (WebGL2 required):', e);
    _canvas = null;
    _loadFailed = true;
    return false;
  }
  brush.seed(42);
  _initialized = true;

  if (!_customBrushesAdded) {
    initCustomBrushes();
    _customBrushesAdded = true;
  }
  return true;
}

/** Compute strokeWeight that produces the desired pixel diameter. */
function compensatedWeight(brushName: string, desiredDiameter: number): number {
  const pw = PARAM_WEIGHT[brushName] ?? 1;
  return desiredDiameter / (2 * pw);
}

// ---------------------------------------------------------------------------
// Core rendering
// ---------------------------------------------------------------------------

export function renderStyledStrokes(
  strokes: PaintStroke[],
  width: number,
  height: number,
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;

  const styled = strokes.filter(
    (s) => s.tool === 'brush' && s.brushStyle && s.brushStyle !== 'flat',
  );
  if (styled.length === 0) return null;
  if (!ensureInitialized(width, height)) return null;

  // Lifecycle: clear → push/translate → draw all strokes → pop → render
  brush.clear();
  brush.push();
  // p5.brush uses center-origin coords; translate so our top-left (0,0)
  // maps to p5.brush's (-width/2, -height/2).
  brush.translate(-width / 2, -height / 2);

  for (const stroke of styled) {
    const brushName = STYLE_MAP[stroke.brushStyle!] || 'marker';
    const params = stroke.brushParams ?? {};
    const pts = stroke.points;

    // Flow field
    if ((params.fieldStrength ?? 0) > 0.01) {
      brush.field('curved');
      brush.wiggle(params.fieldStrength!);
    }

    if (stroke.brushStyle === 'watercolor') {
      renderWatercolorStroke(stroke, brushName);
    } else {
      // Weight-compensated size so visual diameter matches stroke.size
      const w = compensatedWeight(brushName, stroke.size);
      brush.set(brushName, stroke.color, w);

      if (pts.length >= 2) {
        brush.spline(pts, 0.5);
      }
    }

    brush.noField();
  }

  brush.pop();
  brush.render(); // flush WebGL compositing to canvas

  return _canvas;
}

function renderWatercolorStroke(stroke: PaintStroke, brushName: string): void {
  const bleed = stroke.brushParams?.bleed ?? 0.6;
  const grain = stroke.brushParams?.grain ?? 0.4;
  const pts = stroke.points;

  // Part 1: stroke path with marker brush — weight-compensated
  const w = compensatedWeight(brushName, stroke.size);
  brush.set(brushName, stroke.color, w);
  if (pts.length >= 2) {
    brush.spline(pts, 0.5);
  }

  // Part 2: fill bleed circles along path for watercolor wash
  const step = Math.max(5, Math.floor(pts.length / 12));
  for (let i = 0; i < pts.length; i += step) {
    const pt = pts[i];
    brush.fill(stroke.color, Math.round(stroke.opacity * 80));
    brush.fillBleed(bleed);
    brush.fillTexture(grain, 0.4);
    // circle diameter in p5.brush centered coords — use raw size
    brush.circle(pt[0], pt[1], stroke.size * 0.6);
    brush.noFill();
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

export function disposeBrushFx(): void {
  _canvas = null;
  _initialized = false;
  _currentWidth = 0;
  _currentHeight = 0;
}
