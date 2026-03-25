/**
 * p5.brush standalone adapter for brush FX rendering.
 *
 * Charcoal, flat, and marker are calibrated correctly — use as reference.
 * Other styles are tuned relative to those.
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
  charcoal: 'charcoal',   // PERFECT — don't change
  pencil: 'HB',           // HB has better sharpness/grain than cpencil
  marker: 'marker',       // PERFECT — don't change
};

// Built-in param.weight for each preset
const PARAM_WEIGHT: Record<string, number> = {
  pen: 0.3,
  charcoal: 1.5,
  HB: 1,
  marker: 2,
};

// Per-preset visual scale — tuned against charcoal/marker reference
const WEIGHT_SCALE: Record<string, number> = {
  pen: 0.7,        // ink: thinner than charcoal
  charcoal: 1.0,   // REFERENCE — perfect
  HB: 1.0,         // pencil: same scale as charcoal
  marker: 1.5,     // REFERENCE — perfect
};

function compensatedWeight(brushName: string, diameter: number): number {
  const pw = PARAM_WEIGHT[brushName] ?? 1;
  const scale = WEIGHT_SCALE[brushName] ?? 1;
  return (diameter * scale) / (4 * pw);
}

/** Map pointer pressure preserving full dynamic range for tablet tapering. */
function mapPressure(p: number): number {
  return 0.3 + p;
}

/** Simple hash of stroke ID to integer seed for deterministic per-stroke noise. */
function strokeSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
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

// Render cache — skip re-rendering if strokes haven't changed
let _cachedCanvas: HTMLCanvasElement | null = null;
let _cacheKey = '';

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
  _initialized = true;
  return true;
}

// ---------------------------------------------------------------------------
// Point preparation
// ---------------------------------------------------------------------------

function preparePoints(
  raw: [number, number, number][],
  halfW: number,
  halfH: number,
  maxControlPoints: number,
): [number, number, number][] {
  const step = Math.max(1, Math.floor(raw.length / maxControlPoints));
  const pts: [number, number, number][] = [];
  for (let i = 0; i < raw.length; i += step) {
    const [x, y, p] = raw[i];
    pts.push([x - halfW, y - halfH, mapPressure(p)]);
  }
  if (raw.length > 1) {
    const [x, y, p] = raw[raw.length - 1];
    const last: [number, number, number] = [x - halfW, y - halfH, mapPressure(p)];
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

  // Cache check — skip expensive re-render if strokes haven't changed
  const key = styled.map((s) => s.id).join(',');
  if (key === _cacheKey && _cachedCanvas) {
    return _cachedCanvas;
  }

  if (!ensureInitialized(width, height)) return null;

  const halfW = width / 2;
  const halfH = height / 2;

  brush.clear();
  if (_gl) {
    _gl.clearColor(0, 0, 0, 0);
    _gl.clear(_gl.COLOR_BUFFER_BIT);
  }

  for (const stroke of styled) {
    const brushName = STYLE_MAP[stroke.brushStyle!] || 'marker';
    const params = stroke.brushParams ?? {};
    const pts = preparePoints(stroke.points, halfW, halfH, 20);

    // Seed per stroke so each stroke renders deterministically
    // regardless of how many strokes exist
    brush.seed(strokeSeed(stroke.id));

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

  // Cache the result — reused until strokes change
  _cacheKey = key;
  _cachedCanvas = _canvas;

  return _canvas;
}

// ---------------------------------------------------------------------------
// Watercolor — fill polygon with bleed only, no marker spline on top
// ---------------------------------------------------------------------------

function renderWatercolorStroke(
  stroke: PaintStroke,
  pts: [number, number, number][],
): void {
  if (pts.length < 2) return;

  const bleed = stroke.brushParams?.bleed ?? 0.3;
  const grain = stroke.brushParams?.grain ?? 0.4;
  const opacity = Math.round(stroke.opacity * 50);

  // Disable stroke so previous brush state doesn't draw an outline
  brush.noStroke();

  // Filled polygon with watercolor wash — bleed creates the soft edges
  brush.fill(stroke.color, opacity);
  brush.fillBleed(bleed, 'out');
  brush.fillTexture(grain, 0.5);

  brush.beginShape();
  for (const pt of pts) {
    brush.vertex(pt[0], pt[1]);
  }
  brush.endShape();
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
  _cachedCanvas = null;
  _cacheKey = '';
}
