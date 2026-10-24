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
