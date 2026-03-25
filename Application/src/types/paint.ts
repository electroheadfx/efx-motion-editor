/** Paint tool types (per D-04) */
export type PaintToolType = 'brush' | 'eraser' | 'eyedropper' | 'fill' | 'line' | 'rect' | 'ellipse';

/** A freehand stroke recorded from pointer input (per D-02, D-03) */
export interface PaintStroke {
  id: string;
  tool: 'brush' | 'eraser';
  points: [number, number, number][];  // [x, y, pressure] in project-space coords
  color: string;         // hex color (per D-03)
  opacity: number;       // 0-1 (per D-03)
  size: number;          // brush diameter in project pixels
  options: PaintStrokeOptions;
}

/** Options passed to perfect-freehand getStroke() */
export interface PaintStrokeOptions {
  thinning: number;      // 0-1, default 0.5
  smoothing: number;     // 0-1, default 0.5
  streamline: number;    // 0-1, default 0.5
  simulatePressure: boolean; // true for mouse (velocity-based), false for pen (real pressure)
  // Pressure easing function identifier (legacy, for old saved strokes)
  pressureEasing: string;
  // Pressure curve exponent: 1.0 = linear, 2.0+ = firm (soft=thin, hard=thick), 0.5 = gentle
  pressureCurve: number;
  // Start/end taper: 0 = no taper, >0 = taper length in pixels, -1 = auto
  taperStart: number;
  taperEnd: number;
  // How much pen tilt affects pressure easing (0 = none, 1 = full)
  tiltInfluence: number;
}

/** A geometric shape element (per D-04, D-05) */
export interface PaintShape {
  id: string;
  tool: 'line' | 'rect' | 'ellipse';
  x1: number; y1: number;  // start point in project-space
  x2: number; y2: number;  // end point in project-space
  color: string;
  opacity: number;
  strokeWidth: number;
  filled: boolean;         // true = filled shape, false = outline only
}

/** A fill region element */
export interface PaintFill {
  id: string;
  tool: 'fill';
  x: number; y: number;    // click point in project-space
  color: string;
  opacity: number;
  tolerance: number;       // color matching tolerance 0-255
}

/** Union of all paint element types */
export type PaintElement = PaintStroke | PaintShape | PaintFill;

/** All paint data for a single timeline frame (per D-06, D-07) */
export interface PaintFrame {
  elements: PaintElement[];
}

/** Default brush settings */
export const DEFAULT_BRUSH_SIZE = 8;
export const DEFAULT_BRUSH_COLOR = '#FFFFFF';
export const DEFAULT_BRUSH_OPACITY = 1.0;
export const DEFAULT_STROKE_OPTIONS: PaintStrokeOptions = {
  thinning: 0.5,
  smoothing: 0.5,
  streamline: 0.5,
  simulatePressure: true,  // default true; PaintOverlay overrides to false for pen input
  pressureEasing: 'linear',
  pressureCurve: 2.0,  // firm by default: soft press = thin, hard press = thick
  taperStart: 0,
  taperEnd: 0,
  tiltInfluence: 0.3,
};
export const BRUSH_SIZE_MIN = 1;
export const BRUSH_SIZE_MAX = 200;
