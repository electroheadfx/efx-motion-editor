/** Paint tool types (per D-04) */
export type PaintToolType = 'brush' | 'eraser' | 'eyedropper' | 'fill' | 'line' | 'rect' | 'ellipse';

/** Options passed to perfect-freehand getStroke() */
export interface PaintStrokeOptions {
  thinning: number;      // 0-1, default 0.5
  smoothing: number;     // 0-1, default 0.5
  streamline: number;    // 0-1, default 0.5
  simulatePressure: boolean; // false when real pressure data provided
}

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
  simulatePressure: false,
};
export const BRUSH_SIZE_MIN = 1;
export const BRUSH_SIZE_MAX = 200;
