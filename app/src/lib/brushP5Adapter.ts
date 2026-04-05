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
// FX param application helpers
// ---------------------------------------------------------------------------

/**
 * Compute weight modifier from grain/scatter params.
 * Grain: reduces weight for a rougher, more textured look (built-in brush texture shows through).
 * Scatter: applied via field wiggle in the rendering loop.
 */
function grainWeightModifier(params: { grain?: number }): number {
  const grain = params.grain ?? 0;
  if (grain < 0.01) return 1.0;
  // Higher grain = thinner strokes (0.5-1.0x weight), revealing more brush texture
  return 1.0 - grain * 0.5;
}

/**
 * Render a non-watercolor stroke with grain/scatter support.
 * Scatter: uses multiple slightly offset spline passes for a scattered look.
 * Grain: modulates weight so built-in brush texture is more visible.
 */
function renderStrokeWithParams(
  brushName: string,
  stroke: PaintStroke,
  pts: [number, number, number][],
  params: { grain?: number; scatter?: number; edgeDarken?: number },
): void {
  const baseWeight = compensatedWeight(brushName, stroke.size);
  const grainMod = grainWeightModifier(params);
  const edgeMod = (params.edgeDarken ?? 0) > 0.01 ? (1 + params.edgeDarken! * 0.5) : 1;
  const weight = baseWeight * grainMod * edgeMod;
  const scatter = params.scatter ?? 0;

  brush.set(brushName, stroke.color, weight);

  if (pts.length < 2) return;

  if (scatter > 0.1) {
    // Multiple passes with slight offset for scatter effect
    const passes = Math.min(3, Math.ceil(scatter * 4));
    const offsetScale = scatter * 8;
    for (let p = 0; p < passes; p++) {
      const offsetPts = pts.map(([x, y, pr]) => {
        const angle = (p / passes) * Math.PI * 2;
        return [
          x + Math.cos(angle) * offsetScale * (0.5 + Math.random() * 0.5),
          y + Math.sin(angle) * offsetScale * (0.5 + Math.random() * 0.5),
          pr,
        ] as [number, number, number];
      });
      brush.set(brushName, stroke.color, weight * (0.6 + Math.random() * 0.4));
      brush.spline(offsetPts, 0.5);
    }
  } else {
    brush.spline(pts, 0.5);
  }
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

  // Cache check — skip expensive re-render if strokes and params haven't changed
  const key = styled.map((s) => `${s.id}:${s.brushStyle}:${s.color}:${JSON.stringify(s.brushParams ?? {})}`).join(',');
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
      renderStrokeWithParams(brushName, stroke, pts, params);
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
  const halfWidth = (stroke.size ?? 20) / 2;

  brush.noStroke();

  brush.fill(stroke.color, opacity);
  brush.fillBleed(bleed * Math.max(1, halfWidth / 20), 'out');
  brush.fillTexture(grain, 0.5);

  // Build thickened polygon offset by halfWidth on both sides
  const leftSide: [number, number][] = [];
  const rightSide: [number, number][] = [];

  for (let i = 0; i < pts.length; i++) {
    let nx: number, ny: number;
    if (i === 0) {
      nx = pts[1][0] - pts[0][0];
      ny = pts[1][1] - pts[0][1];
    } else if (i === pts.length - 1) {
      nx = pts[i][0] - pts[i - 1][0];
      ny = pts[i][1] - pts[i - 1][1];
    } else {
      nx = pts[i + 1][0] - pts[i - 1][0];
      ny = pts[i + 1][1] - pts[i - 1][1];
    }
    const len = Math.sqrt(nx * nx + ny * ny) || 1;
    const perpX = -ny / len;
    const perpY = nx / len;
    const pw = halfWidth * (0.5 + (pts[i][2] ?? 0.5));

    leftSide.push([pts[i][0] + perpX * pw, pts[i][1] + perpY * pw]);
    rightSide.push([pts[i][0] - perpX * pw, pts[i][1] - perpY * pw]);
  }

  brush.beginShape();
  for (const [x, y] of leftSide) brush.vertex(x, y);
  for (let i = rightSide.length - 1; i >= 0; i--) brush.vertex(rightSide[i][0], rightSide[i][1]);
  brush.endShape();
  brush.noFill();
}

// ---------------------------------------------------------------------------
// Per-frame batch rendering for FX workflow
// ---------------------------------------------------------------------------

/**
 * Render ALL FX-applied strokes for a frame together on one p5.brush canvas.
 *
 * ARCHITECTURE: All strokes are drawn via brush.spline()/fill on the SAME
 * p5.brush instance before a single brush.render() call. This ensures
 * overlapping strokes get Kubelka-Munk spectral pigment mixing in the GLSL
 * shader (PAINT-06: blue + yellow = green, not gray).
 *
 * Returns a NEW canvas (copy of the shared _canvas) suitable for caching
 * as the frame-level FX raster. Returns null if no FX strokes or rendering fails.
 */
export function renderFrameFx(
  strokes: PaintStroke[],
  width: number,
  height: number,
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;

  // Filter to only FX-applied strokes (non-flat, non-eraser)
  const fxStrokes = strokes.filter(
    (s) => s.tool === 'brush' && s.brushStyle && s.brushStyle !== 'flat'
          && s.fxState === 'fx-applied',
  );
  if (fxStrokes.length === 0) return null;

  if (!ensureInitialized(width, height)) return null;

  const halfW = width / 2;
  const halfH = height / 2;

  // Group consecutive strokes by rendering type (watercolor=fill vs others=stroke).
  // p5.brush renders fills in a separate pass from strokes, so we need separate
  // render cycles per group to preserve z-ordering between watercolor and other types.
  type StrokeGroup = { isWatercolor: boolean; strokes: PaintStroke[] };
  const groups: StrokeGroup[] = [];
  for (const stroke of fxStrokes) {
    const isWc = stroke.brushStyle === 'watercolor';
    if (groups.length > 0 && groups[groups.length - 1].isWatercolor === isWc) {
      groups[groups.length - 1].strokes.push(stroke);
    } else {
      groups.push({ isWatercolor: isWc, strokes: [stroke] });
    }
  }

  // Render each group in its own pass, composite results in order
  const cached = document.createElement('canvas');
  cached.width = width;
  cached.height = height;
  const cCtx = cached.getContext('2d');
  if (!cCtx) return null;

  for (const group of groups) {
    brush.clear();
    if (_gl) {
      _gl.clearColor(0, 0, 0, 0);
      _gl.clear(_gl.COLOR_BUFFER_BIT);
    }

    for (const stroke of group.strokes) {
      const brushName = STYLE_MAP[stroke.brushStyle!] || 'marker';
      const params = stroke.brushParams ?? {};
      const pts = preparePoints(stroke.points, halfW, halfH, 20);

      brush.seed(strokeSeed(stroke.id));

      if ((params.fieldStrength ?? 0) > 0.01) {
        brush.field('curved');
        brush.wiggle(params.fieldStrength!);
      }

      if (group.isWatercolor) {
        renderWatercolorStroke(stroke, pts);
      } else {
        renderStrokeWithParams(brushName, stroke, pts, params);
      }

      brush.noField();
    }

    brush.render();
    if (_gl) _gl.finish();

    // Composite this group's result onto the accumulated canvas
    if (_canvas) {
      cCtx.drawImage(_canvas, 0, 0);
    }
  }
  return cached;
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
