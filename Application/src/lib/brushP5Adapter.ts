/**
 * p5.brush standalone adapter for brush FX rendering.
 *
 * p5.brush renders via WebGL2 with spectral pigment mixing (Kubelka-Munk).
 *
 * Key calibration insights from p5.brush examples:
 * - Weights are 0.7-2.0 (NOT pixel sizes)
 * - Pressure values are 0.8-1.5 (size multiplier, not 0-1 normalized)
 * - Splines use 3-6 control points, not 60
 * - Canvas is typically 600x600
 */

import * as brush from 'p5.brush/standalone';
import type {PaintStroke} from '../types/paint';

// ---------------------------------------------------------------------------
// Style → built-in p5.brush preset
// ---------------------------------------------------------------------------
const STYLE_MAP: Record<string, string> = {
  flat: '',
  watercolor: 'marker',
  ink: 'pen',
  charcoal: 'charcoal',
  pencil: 'cpencil',
  marker: 'marker',
};

// Built-in param.weight for each preset
const PARAM_WEIGHT: Record<string, number> = {
  pen: 0.3,
  charcoal: 1.5,
  cpencil: 0.4,
  marker: 2,
};

// Per-preset visual scale tuning
const WEIGHT_SCALE: Record<string, number> = {
  pen: 1.0,
  charcoal: 1.0,
  cpencil: 1.0,
  marker: 1.5,
};

function compensatedWeight(brushName: string, diameter: number): number {
  const pw = PARAM_WEIGHT[brushName] ?? 1;
  const scale = WEIGHT_SCALE[brushName] ?? 1;
  // Divide by 4 instead of 2 — p5.brush FX (grain, scatter, texture)
  // are only visible when stamps DON'T completely fill the stroke area.
  // At full size, all styles look like solid blobs.
  return (diameter * scale) / (4 * pw);
}

/**
 * Map pointer pressure (0-1, mouse=0.5) to p5.brush pressure range (0.8-1.3).
 * p5.brush treats pressure as a size MULTIPLIER around 1.0, not a 0-1 value.
 * Values in examples: random(0.8, 1.5), min_max: [0.78, 1.3].
 */
function mapPressure(p: number): number {
  return 0.8 + p * 0.5;
}

// ---------------------------------------------------------------------------
// Singleton canvas
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
// Point preparation — downsample + offset + pressure mapping
// ---------------------------------------------------------------------------

function preparePoints(
  raw: [number, number, number][],
  halfW: number,
  halfH: number,
  maxControlPoints: number,
): [number, number, number][] {
  // Downsample dense pointer data to manageable control points
  const step = Math.max(1, Math.floor(raw.length / maxControlPoints));
  const pts: [number, number, number][] = [];
  for (let i = 0; i < raw.length; i += step) {
    const [x, y, p] = raw[i];
    pts.push([x - halfW, y - halfH, mapPressure(p)]);
  }
  // Always include last point
  if (raw.length > 1) {
    const [x, y, p] = raw[raw.length - 1];
    const last: [number, number, number] = [x - halfW, y - halfH, mapPressure(p)];
    // Avoid duplicate if last point was already included
    const prev = pts[pts.length - 1];
    if (prev[0] !== last[0] || prev[1] !== last[1]) {
      pts.push(last);
    }
  }
  return pts;
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

  // Clear to proper transparent for compositing
  brush.clear();
  if (_gl) {
    _gl.clearColor(0, 0, 0, 0);
    _gl.clear(_gl.COLOR_BUFFER_BIT);
  }

  for (const stroke of styled) {
    const brushName = STYLE_MAP[stroke.brushStyle!] || 'marker';
    const params = stroke.brushParams ?? {};

    // Prepare points: offset + downsample + pressure mapping
    // Use ~20 control points for splines (p5.brush examples use 3-6)
    const pts = preparePoints(stroke.points, halfW, halfH, 20);

    // Flow field
    if ((params.fieldStrength ?? 0) > 0.01) {
      brush.field('curved');
      brush.wiggle(params.fieldStrength!);
    }

    if (stroke.brushStyle === 'watercolor') {
      renderWatercolorStroke(stroke, pts);
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

// ---------------------------------------------------------------------------
// Watercolor
// ---------------------------------------------------------------------------

function renderWatercolorStroke(
  stroke: PaintStroke,
  pts: [number, number, number][],
): void {
  if (pts.length < 2) return;

  const bleed = stroke.brushParams?.bleed ?? 0.5;
  const grain = stroke.brushParams?.grain ?? 0.4;

  // Stroke with marker brush for the core wash line
  const w = compensatedWeight('marker', stroke.size);
  brush.set('marker', stroke.color, w);
  brush.spline(pts, 0.5);

  // Small bleed wash circles along the path for watercolor edge
  const washStep = Math.max(2, Math.floor(pts.length / 8));
  brush.fill(stroke.color, Math.round(stroke.opacity * 20));
  brush.fillBleed(bleed, 'out');
  brush.fillTexture(grain, 0.5);
  for (let i = 0; i < pts.length; i += washStep) {
    const pt = pts[i];
    brush.circle(pt[0], pt[1], stroke.size * 0.15);
  }
  brush.noFill();
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
