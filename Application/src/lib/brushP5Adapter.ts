/**
 * p5.brush standalone adapter for brush FX rendering.
 *
 * p5.brush renders via WebGL2 with spectral pigment mixing (Kubelka-Munk).
 * Uses built-in brush presets (rotational, charcoal, 2B, marker).
 *
 * Coordinate system: p5.brush uses center-origin (0,0 = center).
 * We offset each point by (-w/2, -h/2) in JS.
 */

import * as brush from 'p5.brush/standalone';
import type {PaintStroke} from '../types/paint';

// ---------------------------------------------------------------------------
// Style → built-in p5.brush preset
// ---------------------------------------------------------------------------
const STYLE_MAP: Record<string, string> = {
  flat: '',
  watercolor: 'marker',     // marker for the stroke spine, fill system for wash
  ink: 'rotational',        // smooth pen with natural rotation
  charcoal: 'charcoal',     // grainy heavy strokes
  pencil: '2B',             // soft graphite with grain
  marker: 'marker',         // solid disc, even coverage
};

// Built-in param.weight from p5.brush source — for weight compensation.
// Visual diameter = 2 * strokeWeight * paramWeight * pressure.
const PARAM_WEIGHT: Record<string, number> = {
  rotational: 1.5,
  charcoal: 1.5,
  '2B': 1,
  marker: 2,
};

function compensatedWeight(brushName: string, diameter: number): number {
  return diameter / (2 * (PARAM_WEIGHT[brushName] ?? 1));
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

  // Clear to proper transparent black (0,0,0,0) for correct compositing.
  // p5.brush's default clear uses (1,1,1,0) which causes premultiplied alpha
  // artifacts that erase flat strokes underneath when composited via drawImage.
  brush.clear();
  if (_gl) {
    _gl.clearColor(0, 0, 0, 0);
    _gl.clear(_gl.COLOR_BUFFER_BIT);
  }

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
// Watercolor: fill polygon with bleed + texture for natural wash effect
// ---------------------------------------------------------------------------

function renderWatercolorStroke(
  stroke: PaintStroke,
  pts: [number, number, number][],
): void {
  if (pts.length < 2) return;

  const bleed = stroke.brushParams?.bleed ?? 0.6;
  const grain = stroke.brushParams?.grain ?? 0.4;
  const opacity = Math.round(stroke.opacity * 100);

  // 1. Draw a filled polygon along the stroke path for the watercolor wash.
  //    The fill/bleed system spreads color outward from the polygon boundary,
  //    creating natural watercolor edge bleed and paper texture.
  brush.fill(stroke.color, opacity);
  brush.fillBleed(bleed, 'out');
  brush.fillTexture(grain, 0.5);

  brush.beginShape();
  // Use a subset of points for the polygon (every Nth) to avoid overly complex shapes
  const step = Math.max(1, Math.floor(pts.length / 40));
  for (let i = 0; i < pts.length; i += step) {
    brush.vertex(pts[i][0], pts[i][1]);
  }
  // Always include the last point
  const last = pts[pts.length - 1];
  brush.vertex(last[0], last[1]);
  brush.endShape();
  brush.noFill();

  // 2. Draw a soft stroke spine on top for the wet-on-wet core wash.
  brush.set('marker', stroke.color, compensatedWeight('marker', stroke.size * 0.5));
  brush.spline(pts, 0.5);
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
