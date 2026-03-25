/**
 * p5.brush standalone adapter for brush FX rendering.
 *
 * p5.brush renders via WebGL2 with spectral pigment mixing (Kubelka-Munk).
 * Strokes are stamped into a WebGL mask framebuffer, then composited to the
 * canvas via a spectral blend shader. brush.render() flushes this pipeline.
 *
 * Coordinate system: p5.brush uses center-origin coords where (0,0) = center.
 * Our project-space uses top-left origin. We offset each point by (-w/2, -h/2)
 * in JS rather than using brush.translate() to avoid WebGL state accumulation.
 */

import * as brush from 'p5.brush/standalone';
import type {PaintStroke} from '../types/paint';

// ---------------------------------------------------------------------------
// Style mapping + weight compensation
// ---------------------------------------------------------------------------
const STYLE_MAP: Record<string, string> = {
  flat: '',
  watercolor: 'marker',
  ink: 'our_ink',
  charcoal: 'our_charcoal',
  pencil: 'our_pencil',
  marker: 'marker',
};

// p5.brush computes stamp diameter = 2 * strokeWeight * paramWeight * pressure.
// To render at desired pixel diameter D: strokeWeight = D / (2 * paramWeight).
const PARAM_WEIGHT: Record<string, number> = {
  marker: 2,
  our_ink: 0.25,
  our_charcoal: 0.35,
  our_pencil: 0.3,
};

function compensatedWeight(brushName: string, diameter: number): number {
  return diameter / (2 * (PARAM_WEIGHT[brushName] ?? 1));
}

// ---------------------------------------------------------------------------
// Singleton canvas + init
// ---------------------------------------------------------------------------
let _canvas: HTMLCanvasElement | null = null;
let _gl: WebGL2RenderingContext | null = null;
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
  if (typeof document === 'undefined' || _loadFailed) return false;

  if (_canvas && _initialized && _currentWidth === width && _currentHeight === height) {
    return true;
  }

  // Fresh canvas each time dimensions change — avoids stale GL state
  _canvas = document.createElement('canvas');
  _canvas.width = width;
  _canvas.height = height;
  _currentWidth = width;
  _currentHeight = height;

  try {
    brush.load(_canvas);
  } catch (e) {
    console.warn('[brushP5Adapter] p5.brush init failed:', e);
    _canvas = null;
    _loadFailed = true;
    return false;
  }

  // Cache the GL context for explicit flush
  _gl = _canvas.getContext('webgl2');

  brush.seed(42);
  _initialized = true;

  if (!_customBrushesAdded) {
    initCustomBrushes();
    _customBrushesAdded = true;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Core rendering — no push/pop/translate, offset points in JS
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

  const halfW = width / 2;
  const halfH = height / 2;

  // Fresh frame: clear canvas + reset compositor state
  brush.clear();

  for (const stroke of styled) {
    const brushName = STYLE_MAP[stroke.brushStyle!] || 'marker';
    const params = stroke.brushParams ?? {};

    // Offset points from top-left origin to p5.brush centered coords
    const pts: [number, number, number][] = stroke.points.map(
      ([x, y, p]) => [x - halfW, y - halfH, p],
    );

    // Flow field
    if ((params.fieldStrength ?? 0) > 0.01) {
      brush.field('curved');
      brush.wiggle(params.fieldStrength!);
    }

    if (stroke.brushStyle === 'watercolor') {
      renderWatercolorStroke(stroke, brushName, pts);
    } else {
      brush.set(brushName, stroke.color, compensatedWeight(brushName, stroke.size));
      if (pts.length >= 2) {
        brush.spline(pts, 0.5);
      }
    }

    brush.noField();
  }

  // Flush WebGL compositing pipeline to canvas
  brush.render();

  // Force GPU completion — WKWebView may not implicitly sync before drawImage
  if (_gl) _gl.finish();

  return _canvas;
}

function renderWatercolorStroke(
  stroke: PaintStroke,
  brushName: string,
  pts: [number, number, number][],
): void {
  const bleed = stroke.brushParams?.bleed ?? 0.6;
  const grain = stroke.brushParams?.grain ?? 0.4;

  // Stroke path with marker brush
  brush.set(brushName, stroke.color, compensatedWeight(brushName, stroke.size));
  if (pts.length >= 2) {
    brush.spline(pts, 0.5);
  }

  // Fill bleed circles along path for watercolor wash
  const step = Math.max(5, Math.floor(pts.length / 12));
  for (let i = 0; i < pts.length; i += step) {
    const pt = pts[i];
    brush.fill(stroke.color, Math.round(stroke.opacity * 80));
    brush.fillBleed(bleed);
    brush.fillTexture(grain, 0.4);
    brush.circle(pt[0], pt[1], stroke.size * 0.6);
    brush.noFill();
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

export function disposeBrushFx(): void {
  _canvas = null;
  _gl = null;
  _initialized = false;
  _currentWidth = 0;
  _currentHeight = 0;
}
