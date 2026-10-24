// ============================================================
//  strokeSettingsModel — the pure core of the Stroke Settings
//  dialog (quick 261024-p5q).
//
//  One locked field registry per engine, mixed reads whose
//  representative is the FIRST-SELECTED stroke (ReadonlySet
//  insertion order), canonical-unit patch builders, the open /
//  dismissal-edge resolution law and the view-supplied bundle
//  contract. No Preact, no signals, no DOM.
//
//  The dialog is the ONLY editing surface: these helpers never
//  touch Studio globals, the sidebar, the top bar or the shared
//  script-edition port.
// ============================================================

import { DEFAULT_CANONICAL_PARAMS } from '@efxlab/efx-watercolor';
import type { SelectableScriptStroke, ScriptStrokeSize } from './scriptStrokeEdition';
import type { ScriptStrokeTransform } from './scriptStrokeTransform';

export type StrokeSettingsModule = 'brush' | 'watercolor';

export interface StrokeSettingsFieldOption {
  readonly label: string;
  readonly value: number;
}

/**
 * One row of a Paint section. `key` is the UI identity; the canonically
 * stored param is `paramKey ?? key` (smoothing displays Off/Soft/Med/High
 * but stores `antiAlias` 0..3).
 */
export interface StrokeSettingsField {
  readonly key: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly kind: 'numeric' | 'segmented';
  readonly options?: readonly StrokeSettingsFieldOption[];
  readonly paramKey?: string;
  /**
   * Value used when a stroke carries no finite entry for the param.
   * Water color fields use the canonical defaults; brush fields leave it
   * undefined and fall back to `min` (PaintStroke.params is total — the
   * fallback is a guard, never a value the engine hands out).
   */
  readonly fallback?: number;
}

/** Brush Paint-tab fields (Move tool). Erase strength and Spread are absent. */
export const BRUSH_SETTINGS_FIELDS: readonly StrokeSettingsField[] = Object.freeze([
  Object.freeze({ key: 'size', label: 'Size', min: 1, max: 80, step: 1, kind: 'numeric' as const }),
  Object.freeze({ key: 'opacity', label: 'Opacity', min: 10, max: 100, step: 1, kind: 'numeric' as const }),
  Object.freeze({ key: 'edgeDetail', label: 'Shape detail', min: 0, max: 100, step: 1, kind: 'numeric' as const }),
  Object.freeze({ key: 'pickup', label: 'Blending', min: 0, max: 100, step: 1, kind: 'numeric' as const }),
  Object.freeze({
    key: 'smoothing',
    label: 'Smoothing',
    min: 0,
    max: 3,
    step: 1,
    kind: 'segmented' as const,
    paramKey: 'antiAlias',
    options: Object.freeze([
      Object.freeze({ label: 'Off', value: 0 }),
      Object.freeze({ label: 'Soft', value: 1 }),
      Object.freeze({ label: 'Med', value: 2 }),
      Object.freeze({ label: 'High', value: 3 }),
    ]),
  }),
]);

/** Water color Paint-tab fields (Select mode), in canonical units. */
export const WATERCOLOR_SETTINGS_FIELDS: readonly StrokeSettingsField[] = Object.freeze([
  Object.freeze({
    key: 'size',
    label: 'Size',
    min: 1,
    max: 80,
    step: 1,
    kind: 'numeric' as const,
    fallback: DEFAULT_CANONICAL_PARAMS.size,
  }),
  Object.freeze({ key: 'load', label: 'Pigment', min: 0, max: 100, step: 1, kind: 'numeric' as const, fallback: DEFAULT_CANONICAL_PARAMS.load }),
  Object.freeze({ key: 'water', label: 'Water', min: 0, max: 100, step: 1, kind: 'numeric' as const, fallback: DEFAULT_CANONICAL_PARAMS.water }),
  Object.freeze({ key: 'flow', label: 'Flow', min: 0, max: 100, step: 1, kind: 'numeric' as const, fallback: DEFAULT_CANONICAL_PARAMS.flow }),
  Object.freeze({ key: 'bleed', label: 'Bleed', min: 0, max: 100, step: 1, kind: 'numeric' as const, fallback: DEFAULT_CANONICAL_PARAMS.bleed }),
  Object.freeze({ key: 'edge', label: 'Edges', min: 0, max: 100, step: 1, kind: 'numeric' as const, fallback: DEFAULT_CANONICAL_PARAMS.edge }),
  Object.freeze({ key: 'granulation', label: 'Grain', min: 0, max: 100, step: 1, kind: 'numeric' as const, fallback: DEFAULT_CANONICAL_PARAMS.granulation }),
  Object.freeze({ key: 'dry', label: 'Dry speed', min: 0, max: 100, step: 1, kind: 'numeric' as const, fallback: DEFAULT_CANONICAL_PARAMS.dry }),
]);

export function strokeSettingsFields(module: StrokeSettingsModule): readonly StrokeSettingsField[] {
  return module === 'watercolor' ? WATERCOLOR_SETTINGS_FIELDS : BRUSH_SETTINGS_FIELDS;
}

/** The narrow per-stroke appearance the dialog hydrates from. */
export interface ScriptStrokeAppearance {
  readonly mutationId: number;
  readonly params: Readonly<Record<string, number>>;
  readonly color: string | null;
}

/** One canonical-unit batch write (params merged, color replaced). */
export interface ScriptStrokeAppearancePatch {
  readonly params?: Readonly<Record<string, number>>;
  readonly color?: string;
}

export interface NumericFieldReading {
  readonly value: number;
  readonly mixed: boolean;
}

export interface ColorFieldReading {
  readonly color: string;
  readonly mixed: boolean;
}

/** The overlay's neutral for a stroke recorded without an explicit color. */
export const NEUTRAL_STROKE_COLOR = '#111827';

function storedKey(field: StrokeSettingsField): string {
  return field.paramKey ?? field.key;
}

function fieldDefault(field: StrokeSettingsField): number {
  return field.fallback ?? field.min;
}

function readFiniteParam(
  params: Readonly<Record<string, number>> | undefined,
  key: string,
  fallback: number,
): number {
  const value = params?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function appearanceMap(
  appearances: readonly ScriptStrokeAppearance[],
): Map<number, ScriptStrokeAppearance> {
  const map = new Map<number, ScriptStrokeAppearance>();
  for (const appearance of appearances) map.set(appearance.mutationId, appearance);
  return map;
}

/**
 * Absolute when every selected stroke agrees; otherwise mixed with the
 * FIRST-SELECTED id's value (selection insertion order, never registry
 * order). Missing/non-finite params resolve to the field default before
 * the comparison, so a genuinely absent key never reads as "mixed".
 */
export function readNumericField(
  appearances: readonly ScriptStrokeAppearance[],
  orderedIds: readonly number[],
  field: StrokeSettingsField,
): NumericFieldReading {
  const byId = appearanceMap(appearances);
  const key = storedKey(field);
  const fallback = fieldDefault(field);
  const values = orderedIds.map((id) => readFiniteParam(byId.get(id)?.params, key, fallback));
  if (values.length === 0) return { value: fallback, mixed: false };
  const first = values[0]!;
  return { value: first, mixed: values.some((value) => value !== first) };
}

/**
 * Representative color from the FIRST-SELECTED id; mixed when any visible
 * color differs (a later repeat of the representative does not cancel it).
 */
export function readColorField(
  appearances: readonly ScriptStrokeAppearance[],
  orderedIds: readonly number[],
): ColorFieldReading {
  const byId = appearanceMap(appearances);
  const colors = orderedIds.map((id) => byId.get(id)?.color ?? NEUTRAL_STROKE_COLOR);
  if (colors.length === 0) return { color: NEUTRAL_STROKE_COLOR, mixed: false };
  const first = colors[0]!;
  return { color: first, mixed: colors.some((color) => color !== first) };
}

/** Canonical-unit params patch for one committed row. */
export function buildAppearancePatch(
  module: StrokeSettingsModule,
  fieldKey: string,
  value: number,
): ScriptStrokeAppearancePatch {
  const field = strokeSettingsFields(module).find((candidate) => candidate.key === fieldKey);
  const key = field ? storedKey(field) : fieldKey;
  return { params: { [key]: value } };
}

/** Color-only patch for one color commit. */
export function buildColorPatch(color: string): ScriptStrokeAppearancePatch {
  return { color };
}

export interface StrokeSettingsOpenArgs {
  readonly surfaceActive: boolean;
  readonly selectionSize: number;
  readonly dismissed: boolean;
  readonly sawEmptySinceDismiss: boolean;
}

/**
 * Open only for an active surface with a non-empty selection that has not
 * been dismissed — unless the selection emptied after the dismissal (the
 * one edge that re-arms it).
 */
export function resolveStrokeSettingsOpen(args: StrokeSettingsOpenArgs): boolean {
  return args.surfaceActive
    && args.selectionSize > 0
    && (!args.dismissed || args.sawEmptySinceDismiss);
}

export interface SawEmptyArgs {
  readonly dismissed: boolean;
  readonly surfaceActive: boolean;
  readonly selectionSize: number;
}

/** The plain (non-signal) dismissal-edge marker law. */
export function shouldMarkSawEmpty(args: SawEmptyArgs): boolean {
  return args.dismissed && args.surfaceActive && args.selectionSize === 0;
}

/**
 * The view-supplied callback bundle. The dialog never consumes the shared
 * ScriptStrokeEditionPort — the Studio chooses the active module's engine
 * paths and hands them in. Geometry members may be async (the watercolor
 * re-bake is awaited): the dialog only advances its session baseline on a
 * true result.
 */
export interface StrokeSettingsDialogBundle {
  readonly module: StrokeSettingsModule;
  /** Brush surface gate: the Move tool is active. */
  readonly brushMoveActive: boolean;
  readonly playFrame: number;
  readonly canvasSize: ScriptStrokeSize;
  listStrokes(playFrame: number, size: ScriptStrokeSize): SelectableScriptStroke[];
  readAppearance(ids: readonly number[], playFrame: number): ScriptStrokeAppearance[];
  applyAppearance(ids: readonly number[], patch: ScriptStrokeAppearancePatch): boolean | Promise<boolean>;
  moveStrokes(ids: readonly number[], dxPx: number, dyPx: number): boolean | Promise<boolean>;
  transformStrokes(ids: readonly number[], transform: ScriptStrokeTransform): boolean | Promise<boolean>;
}

// ============================================================
//  Geometry session law (Task 3). Session-relative only: every
//  control applies the delta from ITS last APPLIED value, so a
//  refused commit never compounds and the display always states
//  what the strokes actually received. Nothing persists.
// ============================================================

export interface StrokeGeometryPoint {
  readonly x: number;
  readonly y: number;
}

/** The four geometry rows' cumulative display values. */
export interface StrokeGeometrySession {
  readonly uniformPct: number;
  readonly scaleXPct: number;
  readonly scaleYPct: number;
  readonly rotationDeg: number;
}

export const FRESH_STROKE_GEOMETRY_SESSION: StrokeGeometrySession = Object.freeze({
  uniformPct: 100,
  scaleXPct: 100,
  scaleYPct: 100,
  rotationDeg: 0,
});

/** Declared display ranges — typed input and every commit clamp here. */
export const STROKE_SCALE_RANGE = Object.freeze({ min: 10, max: 1000 });
export const STROKE_ROTATION_RANGE = Object.freeze({ min: -360, max: 360 });

export type StrokeGeometryControl = 'uniform' | 'scaleX' | 'scaleY' | 'rotation';

export interface StrokeGeometryMoveDelta {
  readonly dxPx: number;
  readonly dyPx: number;
}

export interface StrokeGeometryTransformResult {
  readonly transform: ScriptStrokeTransform;
  readonly nextSession: StrokeGeometrySession;
}

function clampRange(value: number, range: { readonly min: number; readonly max: number }): number {
  return Math.min(range.max, Math.max(range.min, value));
}

/** Percent displays are user-facing: keep float drift out of the session. */
function roundSession(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * X/Y typed absolute target -> integer delta from the LIVE selection centre.
 * A sub-pixel target (both rounded deltas zero) is a no-op, never a write.
 */
export function geometryMoveDelta(
  nextCenter: StrokeGeometryPoint,
  liveCenter: StrokeGeometryPoint,
): StrokeGeometryMoveDelta | null {
  if (!Number.isFinite(nextCenter.x) || !Number.isFinite(nextCenter.y)) return null;
  if (!Number.isFinite(liveCenter.x) || !Number.isFinite(liveCenter.y)) return null;
  const dxPx = Math.round(nextCenter.x - liveCenter.x);
  const dyPx = Math.round(nextCenter.y - liveCenter.y);
  if (dxPx === 0 && dyPx === 0) return null;
  return { dxPx, dyPx };
}

/**
 * One geometry row's commit. The factor/delta is relative to that row's last
 * APPLIED value; uniform also compounds the single-axis displays. Null means
 * "write nothing" (same value after clamping, non-finite input, zero baseline).
 * Every transform anchors at the selection centre.
 */
export function geometryTransform(
  control: StrokeGeometryControl,
  nextValue: number,
  session: StrokeGeometrySession,
  center: StrokeGeometryPoint,
): StrokeGeometryTransformResult | null {
  if (!Number.isFinite(nextValue)) return null;
  if (!Number.isFinite(center.x) || !Number.isFinite(center.y)) return null;

  if (control === 'rotation') {
    const rotationDeg = clampRange(nextValue, STROKE_ROTATION_RANGE);
    const deltaDeg = rotationDeg - session.rotationDeg;
    if (deltaDeg === 0) return null;
    return {
      transform: {
        kind: 'rotate',
        centerX: center.x,
        centerY: center.y,
        anchorX: center.x,
        anchorY: center.y,
        angleRad: (deltaDeg * Math.PI) / 180,
        scaleX: 1,
        scaleY: 1,
      },
      nextSession: { ...session, rotationDeg },
    };
  }

  const nextPct = clampRange(nextValue, STROKE_SCALE_RANGE);
  if (control === 'uniform') {
    if (session.uniformPct <= 0) return null;
    const factor = nextPct / session.uniformPct;
    if (factor === 1) return null;
    return {
      transform: {
        kind: 'scale',
        centerX: center.x,
        centerY: center.y,
        anchorX: center.x,
        anchorY: center.y,
        angleRad: 0,
        scaleX: factor,
        scaleY: factor,
      },
      nextSession: {
        uniformPct: nextPct,
        scaleXPct: roundSession(clampRange(session.scaleXPct * factor, STROKE_SCALE_RANGE)),
        scaleYPct: roundSession(clampRange(session.scaleYPct * factor, STROKE_SCALE_RANGE)),
        rotationDeg: session.rotationDeg,
      },
    };
  }

  const baseline = control === 'scaleX' ? session.scaleXPct : session.scaleYPct;
  if (baseline <= 0) return null;
  const factor = nextPct / baseline;
  if (factor === 1) return null;
  return {
    transform: {
      kind: 'scale',
      centerX: center.x,
      centerY: center.y,
      anchorX: center.x,
      anchorY: center.y,
      angleRad: 0,
      scaleX: control === 'scaleX' ? factor : 1,
      scaleY: control === 'scaleY' ? factor : 1,
    },
    nextSession: {
      ...session,
      ...(control === 'scaleX' ? { scaleXPct: nextPct } : { scaleYPct: nextPct }),
    },
  };
}
