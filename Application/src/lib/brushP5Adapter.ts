/**
 * p5.brush standalone adapter for brush FX rendering.
 *
 * p5.brush renders via WebGL2 with spectral pigment mixing (Kubelka-Munk).
 * Uses built-in brush presets — no custom brush.add() needed.
 */

import * as brush from 'p5.brush/standalone';
import type {PaintStroke} from '../types/paint';

// ---------------------------------------------------------------------------
// Style → built-in p5.brush preset
// ---------------------------------------------------------------------------
const STYLE_MAP: Record<string, string> = {
  flat: '',
  watercolor: 'marker',   // smooth base for watercolor wash
  ink: 'pen',              // fine pen with slight scatter
  charcoal: 'charcoal',   // heavy grainy strokes
  pencil: 'cpencil',      // color pencil — controlled scatter + grain
  marker: 'marker',       // solid disc, even coverage
};

// Built-in param.weight for weight compensation.
const PARAM_WEIGHT: Record<string, number> = {
  pen: 0.3,
  charcoal: 1.5,
  cpencil: 0.4,
  marker: 2,
};

function compensatedWeight(brushName: string, diameter: number): number {
  // diameter = 2 * strokeWeight * paramWeight * pressure
  // At typical pressure ~0.5 (mouse), we want visual diameter ≈ desired diameter.
  // So: strokeWeight = diameter / (paramWeight)  → at p=0.5: visual = diameter
  return diameter / (PARAM_WEIGHT[brushName] ?? 1);
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

  // Clear to proper transparent (0,0,0,0) for correct compositing
  brush.clear();
  if (_gl) {
    _gl.clearColor(0, 0, 0, 0);
    _gl.clear(_gl.COLOR_BUFFER_BIT);
  }

  for (const stroke of styled) {
    const brushName = STYLE_MAP[stroke.brushStyle!] || 'marker';
    const params = stroke.brushParams ?? {};

    // Offset points to p5.brush centered coords + downsample for spline quality
    const allPts: [number, number, number][] = stroke.points.map(
      ([x, y, p]) => [x - halfW, y - halfH, p],
    );
    // Downsample dense pointer data to ~60 control points for smoother splines
    const step = Math.max(1, Math.floor(allPts.length / 60));
    const pts: [number, number, number][] = [];
    for (let i = 0; i < allPts.length; i += step) pts.push(allPts[i]);
    if (allPts.length > 1) pts.push(allPts[allPts.length - 1]);

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
// Watercolor: spline stroke with wash effect — no filled polygon by default
// ---------------------------------------------------------------------------

function renderWatercolorStroke(
  stroke: PaintStroke,
  pts: [number, number, number][],
): void {
  if (pts.length < 2) return;

  const bleed = stroke.brushParams?.bleed ?? 0.5;
  const grain = stroke.brushParams?.grain ?? 0.4;

  // Draw the stroke with marker brush at reduced opacity for watercolor feel
  const w = compensatedWeight('marker', stroke.size);
  brush.set('marker', stroke.color, w);
  brush.spline(pts, 0.5);

  // Add watercolor wash along the stroke path — small circles with bleed
  const washStep = Math.max(2, Math.floor(pts.length / 15));
  brush.fill(stroke.color, Math.round(stroke.opacity * 25));
  brush.fillBleed(bleed, 'out');
  brush.fillTexture(grain, 0.5);
  for (let i = 0; i < pts.length; i += washStep) {
    const pt = pts[i];
    brush.circle(pt[0], pt[1], stroke.size * 0.5);
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
