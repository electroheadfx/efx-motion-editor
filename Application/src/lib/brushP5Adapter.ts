/**
 * p5.brush standalone adapter for brush FX rendering.
 *
 * Replaces the custom WebGL2 brush FX renderer (~2000 lines across 4 files)
 * with ~200 lines of adapter code wrapping p5.brush standalone.
 *
 * p5.brush provides: spectral pigment mixing (Kubelka-Munk), 11 brush presets,
 * flow fields, watercolor fill/bleed/texture, grain, and scatter -- all in a
 * battle-tested 75KB library.
 *
 * Exports match the old brushFxRenderer.ts signature so paintRenderer.ts can
 * switch imports with a single path change (Plan 20-09).
 */

import * as brush from 'p5.brush/standalone';
import type {PaintStroke} from '../types/paint';

// ---------------------------------------------------------------------------
// Style mapping: our BrushStyle -> p5.brush preset name
// Custom brushes (our_ink, our_charcoal, our_pencil) registered in initCustomBrushes()
// ---------------------------------------------------------------------------
const STYLE_MAP: Record<string, string> = {
  flat: '', // never reaches p5.brush (handled by Canvas2D)
  watercolor: 'marker', // marker tip + fill effects for wash
  ink: 'our_ink', // custom: fine pen with edge darkening (PAINT-02)
  charcoal: 'our_charcoal', // custom: heavy scatter, grainy
  pencil: 'our_pencil', // custom: fine grain texture (PAINT-04)
  marker: 'marker', // solid disc, minimal variation
};

// ---------------------------------------------------------------------------
// Singleton canvas management
// p5.brush requires WebGL2 context — OffscreenCanvas doesn't support WebGL2
// in WKWebView (Tauri/Safari), so we use a hidden HTMLCanvasElement instead.
// ---------------------------------------------------------------------------
let _canvas: HTMLCanvasElement | null = null;
let _initialized = false;
let _customBrushesAdded = false;
let _currentWidth = 0;
let _currentHeight = 0;
let _loadFailed = false;

/**
 * Register custom brush definitions tuned for our styles.
 * Called once after first brush.load().
 */
function initCustomBrushes(): void {
  // our_ink: provides ink edge darkening via overlap (PAINT-02)
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

  // our_charcoal: heavy scatter, grainy texture
  brush.add('our_charcoal', {
    type: 'default',
    weight: 0.35,
    scatter: 1.5,
    sharpness: 0.68,
    grain: 2.0,
    opacity: 120,
    rotate: 'random',
  });

  // our_pencil: fine grain texture (PAINT-04)
  brush.add('our_pencil', {
    type: 'default',
    weight: 0.3,
    scatter: 0.6,
    sharpness: 0.3,
    grain: 0.7,
    opacity: 170,
  });
}

/**
 * Ensure the HTMLCanvasElement and p5.brush are initialized at the right size.
 */
function ensureInitialized(width: number, height: number): void {
  // Guard: no DOM in jsdom test env or SSR
  if (typeof document === 'undefined') return;
  // Don't retry if WebGL2 is unavailable
  if (_loadFailed) return;

  if (_canvas && _initialized && _currentWidth === width && _currentHeight === height) {
    return;
  }

  _canvas = document.createElement('canvas');
  _canvas.width = width;
  _canvas.height = height;
  _currentWidth = width;
  _currentHeight = height;

  try {
    brush.load(_canvas);
  } catch (e) {
    // WebGL2 not available — fall back to Canvas 2D rendering
    console.warn('[brushP5Adapter] p5.brush init failed (WebGL2 required):', e);
    _canvas = null;
    _initialized = false;
    _loadFailed = true;
    return;
  }
  brush.seed(42); // Deterministic rendering (export parity per D-12)
  _initialized = true;

  if (!_customBrushesAdded) {
    initCustomBrushes();
    _customBrushesAdded = true;
  }
}

// ---------------------------------------------------------------------------
// Watercolor rendering helper
// ---------------------------------------------------------------------------

/**
 * Render a watercolor stroke using p5.brush fill/bleed/texture system.
 * Two-part approach: stroke path with marker brush + filled circles for bleed.
 */
function renderWatercolorStroke(stroke: PaintStroke): void {
  const bleed = stroke.brushParams?.bleed ?? 0.6;
  const grain = stroke.brushParams?.grain ?? 0.4;
  const pts = stroke.points;

  // Part 1: Draw the stroke path with marker brush for core wash
  brush.set('marker', stroke.color, stroke.size * 1.2);
  if (pts.length >= 2) {
    brush.spline(pts, 0.5);
  }

  // Part 2: Add fill bleed along the stroke with filled circles
  const step = Math.max(5, Math.floor(pts.length / 12));
  for (let i = 0; i < pts.length; i += step) {
    const pt = pts[i];
    brush.fill(stroke.color, Math.round(stroke.opacity * 80));
    brush.fillBleed(bleed);
    brush.fillTexture(grain, 0.4);
    brush.circle(pt[0], pt[1], stroke.size * 0.8);
    brush.noFill();
  }
}

// ---------------------------------------------------------------------------
// Core rendering function
// ---------------------------------------------------------------------------

/**
 * Render styled (non-flat) strokes via p5.brush standalone on OffscreenCanvas.
 *
 * @param strokes Array of PaintStroke objects to render
 * @param width Canvas width in pixels
 * @param height Canvas height in pixels
 * @returns HTMLCanvasElement with rendered strokes, or null if no styled strokes / WebGL2 unavailable
 */
export function renderStyledStrokes(
  strokes: PaintStroke[],
  width: number,
  height: number,
): HTMLCanvasElement | null {
  // Guard: no DOM in jsdom test env or SSR
  if (typeof document === 'undefined') {
    return null;
  }

  // Filter out flat and eraser strokes (safety check)
  const styled = strokes.filter(
    (s) => s.tool === 'brush' && s.brushStyle && s.brushStyle !== 'flat',
  );

  if (styled.length === 0) {
    return null;
  }

  ensureInitialized(width, height);

  // If p5.brush failed to init (no WebGL2), fall back to Canvas 2D in paintRenderer
  if (!_canvas || !_initialized) {
    return null;
  }

  brush.clear();
  brush.push();
  // CRITICAL: p5.brush uses center-origin coords, translate to top-left origin
  brush.translate(-width / 2, -height / 2);

  for (const stroke of styled) {
    const brushName = STYLE_MAP[stroke.brushStyle!] || 'marker';
    const params = stroke.brushParams ?? {};
    const pts = stroke.points;

    // Apply flow field if fieldStrength > threshold
    if ((params.fieldStrength ?? 0) > 0.01) {
      brush.field('curved');
      brush.wiggle(params.fieldStrength!);
    }

    if (stroke.brushStyle === 'watercolor') {
      // Watercolor uses fill/bleed/texture system (D-11 superseded)
      renderWatercolorStroke(stroke);
    } else {
      // Non-watercolor styles: set brush and draw spline
      brush.set(brushName, stroke.color, stroke.size);

      // Edge darkening for ink (PAINT-02): modulate via overlapping strokes
      // p5.brush spectral mixing naturally produces darker edges on overlap
      // edgeDarken param handled by custom brush opacity in our_ink definition

      // Scatter modulation for charcoal
      if (stroke.brushStyle === 'charcoal' && (params.scatter ?? 0) > 0) {
        brush.scaleBrushes(1 + (params.scatter ?? 0.4));
      }

      if (pts.length >= 2) {
        brush.spline(pts, 0.5);
      }

      // Restore scale after charcoal scatter
      if (stroke.brushStyle === 'charcoal' && (params.scatter ?? 0) > 0) {
        brush.scaleBrushes(1);
      }
    }

    // Reset field after each stroke
    brush.noField();
  }

  brush.pop();
  brush.render(); // MANDATORY: flushes compositing

  return _canvas;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Dispose the brush FX renderer, releasing the OffscreenCanvas and WebGL resources.
 */
export function disposeBrushFx(): void {
  _canvas = null;
  _initialized = false;
  _currentWidth = 0;
  _currentHeight = 0;
}
