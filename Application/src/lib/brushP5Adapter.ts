/**
 * p5.brush standalone adapter for brush FX rendering.
 *
 * p5.brush renders via WebGL2 with spectral pigment mixing (Kubelka-Munk).
 * Uses built-in brush presets (pen, charcoal, HB, marker) — no custom
 * brush.add() calls needed, avoiding initialization issues.
 *
 * Coordinate system: p5.brush uses center-origin (0,0 = center).
 * We offset each point by (-w/2, -h/2) in JS to convert from our
 * top-left origin project-space coordinates.
 */

import * as brush from 'p5.brush/standalone';
import type {PaintStroke} from '../types/paint';

// ---------------------------------------------------------------------------
// Style → built-in p5.brush preset mapping
// All presets are pre-registered at module load — no brush.add() needed.
// ---------------------------------------------------------------------------
const STYLE_MAP: Record<string, string> = {
  flat: '',
  watercolor: 'marker',   // marker tip + fill/bleed for wash
  ink: 'pen',              // fine pen with slight scatter
  charcoal: 'charcoal',   // heavy, grainy strokes
  pencil: 'HB',           // standard graphite
  marker: 'marker',        // solid disc, even coverage
};

// Built-in param.weight for each preset — from p5.brush source.
// Visual diameter = 2 * strokeWeight * paramWeight * pressure.
// Compensated strokeWeight = desiredDiameter / (2 * paramWeight).
const PARAM_WEIGHT: Record<string, number> = {
  pen: 0.3,
  charcoal: 1.5,
  HB: 1,
  marker: 2,
};

function compensatedWeight(brushName: string, diameter: number): number {
  return diameter / (2 * (PARAM_WEIGHT[brushName] ?? 1));
}

// ---------------------------------------------------------------------------
// Singleton canvas + init (no custom brushes needed)
// ---------------------------------------------------------------------------
let _canvas: HTMLCanvasElement | null = null;
let _gl: WebGL2RenderingContext | null = null;
let _initialized = false;
let _currentWidth = 0;
let _currentHeight = 0;
let _loadFailed = false;

function ensureInitialized(width: number, height: number): boolean {
  if (typeof document === 'undefined' || _loadFailed) return false;

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
    console.warn('[brushP5Adapter] p5.brush init failed:', e);
    _canvas = null;
    _loadFailed = true;
    return false;
  }

  _gl = _canvas.getContext('webgl2');
  brush.seed(42);
  _initialized = true;
  return true;
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

  const halfW = width / 2;
  const halfH = height / 2;

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

  brush.render();
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
