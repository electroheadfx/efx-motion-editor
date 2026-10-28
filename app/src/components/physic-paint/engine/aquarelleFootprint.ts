// ============================================================
//  aquarelleFootprint — the numeric footprint law the ENGINE
//  uses, shared with the cursor (261028-k03c D6).
//
//  One law, three consumers: `Engine.radius` / `Engine.brushRadius`
//  (the live stamps), `collectLiftDabs`/`buildLiftCoverage` (the
//  punch) and `AquarelleBrushCursor` (this module's caller). The
//  numbers below mirror the engine so the outline drawn before a
//  stroke is exactly the area the stroke will cover.
//
//  Preact-free, DOM-free: pure math plus a single-entry brush
//  cache so a pointer move never rebuilds a procedural tip.
// ============================================================

import {
  buildBrushForStroke,
  toEngineParams,
  type AquarelleTool,
  type AquarelleToolOverrides,
  type Brush,
} from '@efxlab/efx-watercolor';

/** The engine's footprint, in document heights. */
export interface AquarelleFootprint {
  /** Half the long axis, in document heights (Engine.radius). */
  radiusDoc: number;
  /** Short axis / long axis (1 = round). */
  aspect: number;
  /** Tip angle in the document frame (y up), radians — Engine.brushAngle. */
  angle: number;
  /** Draw a rounded rectangle instead of an ellipse. */
  rounded: boolean;
}

export interface AquarelleFootprintInput {
  tool: AquarelleTool;
  tipId: string | null;
  toolOverrides: AquarelleToolOverrides | null;
  /** Canonical AQUA-04 size (0..80, the top-bar slider). */
  size: number;
  pressure: number;
  /** Cursor movement direction in the document frame (y up), radians. */
  moveAngle: number;
  /** Live pointer tilt, degrees (PointerEvent.tiltX / tiltY). */
  tiltX: number;
  tiltY: number;
}

const DEG = Math.PI / 180;
/** Engine.updateCursor's hover pressure. */
const HOVER_PRESSURE = 0.4;
/** Engine.processInput's tilt threshold: a vertical pen says nothing. */
const TILT_THRESHOLD = 12;
/** Below this aspect the engine draws/skins a rounded rectangle. */
const ROUNDED_ASPECT = 0.6;

let cachedSignature: string | null = null;
let cachedBrush: Brush | null = null;
/** Engine `lastAngle`: random-rotation tips hold the last shaped angle. */
let lastShapedAngle = 0;

function overridesSignature(overrides: AquarelleToolOverrides | null): string {
  if (!overrides) return '';
  return [
    overrides.tip,
    overrides.aspect,
    overrides.rotation,
    overrides.sizeCurve,
    overrides.scatter,
    overrides.capacity,
    overrides.grain,
    overrides.wetRound,
  ].join(',');
}

/** Single-entry cache keyed by the scalar tip signature (no identity churn). */
function brushFor(tipId: string | null, overrides: AquarelleToolOverrides | null): Brush {
  const signature = `${tipId ?? ''}|${overridesSignature(overrides)}`;
  if (!cachedBrush || cachedSignature !== signature) {
    cachedBrush = buildBrushForStroke(tipId ?? 'round', overrides);
    cachedSignature = signature;
  }
  return cachedBrush;
}

/** Engine.sizeMult at scripting = false. */
function engineSizeMult(size: number): number {
  return Math.pow(3, ((toEngineParams({ size }).size ?? 0.5) - 0.5) * 2);
}

/** Engine.brushRadius at speed 0 (clamp(1 − 0·speedThin, 0.4, 1) = 1). */
function brushRadius(brush: Brush, pressure: number, sizeMult: number): number {
  const t = Math.pow(Math.min(1, Math.max(0, pressure)), brush.pressureSize);
  return (brush.size[0] + (brush.size[1] - brush.size[0]) * t) * sizeMult * 0.8;
}

/**
 * Engine.brushAngle for the cursor: fixed rotation follows the live pen tilt
 * azimuth above the threshold (replacing the preset angle), follow adds the
 * movement direction, random holds the last shaped angle (angleJitter is not
 * reproducible — declared approximation).
 */
function angleFor(brush: Brush, moveAngle: number, tiltX: number, tiltY: number): number {
  if (brush.rotation === 'follow') {
    const angle = moveAngle + brush.angle * DEG;
    lastShapedAngle = angle;
    return angle;
  }
  if (brush.rotation === 'random') return lastShapedAngle;
  const azimuth =
    Math.hypot(tiltX, tiltY) > TILT_THRESHOLD ? Math.atan2(-tiltY, tiltX) : null;
  const angle = azimuth ?? brush.angle * DEG;
  lastShapedAngle = angle;
  return angle;
}

/** The footprint the engine would use for the next dab at this pointer state. */
export function aquarelleFootprintFor(input: AquarelleFootprintInput): AquarelleFootprint {
  const sizeMult = engineSizeMult(input.size);
  if (input.tool === 'pen') {
    return {
      // Engine.radius('pen', pr, 0): clamp(1.12 − 0, 0.55, 1.12) = 1.12.
      radiusDoc: (0.0016 + 0.0042 * input.pressure) * 1.12 * sizeMult,
      aspect: 1,
      angle: 0,
      rounded: false,
    };
  }
  const brush = brushFor(input.tipId, input.toolOverrides);
  const angle = angleFor(brush, input.moveAngle, input.tiltX, input.tiltY);
  if (input.tool === 'lift') {
    return {
      radiusDoc: (0.012 + 0.03 * input.pressure) * sizeMult,
      aspect: brush.aspect,
      angle,
      rounded: brush.aspect < ROUNDED_ASPECT,
    };
  }
  const radius = brushRadius(brush, input.pressure, sizeMult);
  return {
    // Engine.radius('water'): brush · 1.3 · (1 + min(0, 2.5)·0.12).
    radiusDoc: input.tool === 'water' ? radius * 1.3 : radius,
    aspect: brush.aspect,
    angle,
    rounded: brush.aspect < ROUNDED_ASPECT,
  };
}

/**
 * The pressure the cursor previews at: the live pen pressure while the pen is
 * pressed, otherwise the engine's own 0.4 hover value.
 */
export function cursorPreviewPressure(
  pointerType: string,
  buttons: number,
  pressure: number,
): number {
  if (pointerType === 'pen' && buttons > 0 && Number.isFinite(pressure) && pressure > 0) {
    return Math.min(1, pressure);
  }
  return HOVER_PRESSURE;
}

/** Footprint in CSS px at the displayed layer height (Engine.updateCursor's d). */
export function footprintCssSize(
  footprint: AquarelleFootprint,
  layerHeightCss: number,
): { width: number; height: number } {
  const layer = Number.isFinite(layerHeightCss) && layerHeightCss > 0 ? layerHeightCss : 0;
  const width = 2 * footprint.radiusDoc * layer;
  return { width, height: width * footprint.aspect };
}
