/** Paint tool types (per D-04) */
export type PaintToolType = 'brush' | 'eraser' | 'eyedropper' | 'fill' | 'line' | 'rect' | 'ellipse' | 'select';

/** Per D-04: Three stroke states for FX workflow */
export type StrokeFxState = 'flat' | 'fx-applied' | 'flattened';

/** Brush rendering styles (per D-01) */
export type BrushStyle = 'flat' | 'watercolor' | 'ink' | 'charcoal' | 'pencil' | 'marker';

/** Ordered list of brush styles for UI iteration */
export const BRUSH_STYLES: BrushStyle[] = ['flat', 'watercolor', 'ink', 'charcoal', 'pencil', 'marker'];

/** FX parameters that control brush rendering behavior (per D-05, D-08) */
export interface BrushFxParams {
  grain?: number;        // 0-1, paper texture intensity
  bleed?: number;        // 0-1, watercolor edge diffusion
  scatter?: number;      // 0-1, tip scatter amount
  fieldStrength?: number;// 0-1, flow field influence
  edgeDarken?: number;   // 0-1, ink pooling at overlaps
}

/** Per-style default FX params with tuned presets (per D-07) */
export const DEFAULT_BRUSH_FX_PARAMS: Record<BrushStyle, BrushFxParams> = {
  flat: {},
  watercolor: { bleed: 0.6, grain: 0.4, fieldStrength: 0.3 },
  ink: { edgeDarken: 0.7, fieldStrength: 0.15 },
  charcoal: { grain: 0.6, scatter: 0.4 },
  pencil: { grain: 0.3 },
  marker: {},
};

/** Per-style visible FX param keys for UI (per D-05) — only show relevant sliders */
export const BRUSH_FX_VISIBLE_PARAMS: Record<BrushStyle, (keyof BrushFxParams)[]> = {
  flat: [],
  watercolor: ['bleed', 'grain', 'fieldStrength'],
  ink: ['edgeDarken', 'fieldStrength'],
  charcoal: ['grain', 'scatter'],
  pencil: ['grain'],
  marker: [],
};

/** A freehand stroke recorded from pointer input (per D-02, D-03) */
export interface PaintStroke {
  id: string;
  tool: 'brush' | 'eraser';
  points: [number, number, number][];  // [x, y, pressure] in project-space coords
  color: string;         // hex color (per D-03)
  opacity: number;       // 0-1 (per D-03)
  size: number;          // brush diameter in project pixels
  options: PaintStrokeOptions;
  brushStyle?: BrushStyle;      // rendering style (default: 'flat' for backward compat)
  brushParams?: BrushFxParams;  // FX parameters at draw time
  fxState?: StrokeFxState;      // per D-04: current rendering state (default: 'flat')
  visible?: boolean;            // D-05: visibility toggle (undefined = visible, false = hidden)
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
  rotation?: number;       // rotation angle in radians around shape center
  visible?: boolean;       // D-05: visibility toggle (undefined = visible, false = hidden)
}

/** A fill region element */
export interface PaintFill {
  id: string;
  tool: 'fill';
  x: number; y: number;    // click point in project-space
  color: string;
  opacity: number;
  tolerance: number;       // color matching tolerance 0-255
  visible?: boolean;       // D-05: visibility toggle (undefined = visible, false = hidden)
}

/** Union of all paint element types */
export type PaintElement = PaintStroke | PaintShape | PaintFill;

/** All paint data for a single timeline frame (per D-06, D-07) */
export interface PaintFrame {
  elements: PaintElement[];
}

/** Default solid background color for paint layer (per D-11) */
export const DEFAULT_PAINT_BG_COLOR = '#FFFFFF';

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
  pressureCurve: 3.0,  // firm by default: soft press = thin, hard press = thick
  taperStart: 0,
  taperEnd: 0,
  tiltInfluence: 0.3,
};
export const BRUSH_SIZE_MIN = 1;
export const BRUSH_SIZE_MAX = 200;
