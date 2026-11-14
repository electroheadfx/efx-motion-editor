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
import { findTip, type AquarelleToolOverrides } from '@efxlab/efx-watercolor/brushes';
import {
  ANCHOR_WIDTH_MAX,
  normaliseAquarelleAnchors,
  paintSeedSaltOf,
  readAnchorCornerState,
  resolveAquarelleCurveMode,
  type AnchorCornerState,
  type AquarelleAnchor,
  type AquarelleCurveMode,
  type AquarelleStroke,
} from '@efxlab/efx-watercolor/payload';
import type {
  SelectableScriptStroke,
  ScriptStrokeFilterValue,
  ScriptStrokeSize,
  ScriptStrokeTool,
} from './scriptStrokeEdition';
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
  Object.freeze({ key: 'size', label: 'Size', min: 1, max: 800, step: 1, kind: 'numeric' as const }),
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
    max: 800,
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
  /**
   * 61-31 (G-20): the stroke's curve-evaluation discriminator. Absent means
   * Bézier.
   */
  readonly curveMode?: AquarelleCurveMode;
  /**
   * 61-31 (G-20): whether the stroke carries a vector path. Hydrated from the
   * presence of anchors; a hand-painted stroke must never make the `Curve`
   * row available, so `vector` absent/false excludes it from the reading.
   */
  readonly vector?: boolean;
}

/** 61-31 (G-20): the `Curve` row's reading over the VECTOR appearances only. */
export interface CurveModeReading {
  /** The agreed mode, or null when the vector strokes disagree. */
  readonly mode: AquarelleCurveMode | null;
  readonly mixed: boolean;
  /** True only when at least one vector stroke is in the selection. */
  readonly available: boolean;
}

/** One `Curve` row option — the model owns both the id and the copy. */
export interface CurveModeOption {
  readonly id: 'bezier' | 'spline';
  readonly mode: AquarelleCurveMode;
  readonly label: string;
}

/**
 * 61-31 (G-20 / D-01 revised): the two options, in UI-SPEC order. `id` is the
 * test-id suffix (`-option-bezier` / `-option-spline`); the global button rule
 * uppercases `label` in the sheet. Constants only — no user text can reach it.
 */
export const CURVE_MODE_OPTIONS: readonly CurveModeOption[] = Object.freeze([
  Object.freeze({ id: 'bezier' as const, mode: 'bezier' as const, label: 'Bézier' }),
  Object.freeze({ id: 'spline' as const, mode: 'spline' as const, label: 'Spline' }),
]);

/**
 * 61-31 (G-20 / D-01 revised): the selection's curve-evaluation mode. Spline is
 * an EVALUATION MODE over the same anchor list, never a third anchor kind, so
 * only the VECTOR appearances take part: a hand-painted stroke has no path to
 * evaluate, and giving it a mode would write inert data — it can neither make
 * the row available nor contribute a disagreement. Absent counts as the
 * default, so an explicit `bezier` and a stroke written before this phase read
 * the SAME; any disagreement between vector strokes is mixed with no
 * representative.
 */
export function readCurveMode(appearances: readonly ScriptStrokeAppearance[]): CurveModeReading {
  const modes = appearances
    .filter((appearance) => appearance.vector === true)
    .map((appearance) => resolveAquarelleCurveMode(appearance.curveMode));
  if (modes.length === 0) return { mode: null, mixed: false, available: false };
  const first = modes[0]!;
  if (modes.some((mode) => mode !== first)) return { mode: null, mixed: true, available: true };
  return { mode: first, mixed: false, available: true };
}

/** One canonical-unit batch write (params merged, color replaced). */
export interface ScriptStrokeAppearancePatch {
  readonly params?: Readonly<Record<string, number>>;
  readonly color?: string;
  /** 261031-cf9: the Paint seed variation flag (see the appearance door). */
  readonly paintSeedVariation?: boolean;
  /**
   * quick 261111-t74: the recorded brush/tip id the stroke paints with. The
   * record-state door is the validator — only an id `findTip` resolves or a
   * `BRUSH_PRESETS` id is accepted, and nothing is coerced or defaulted. This
   * is appearance data, never geometry: points, anchors and the authored path
   * survive a brush change untouched.
   */
  readonly brushId?: string;
  /**
   * quick 261111-t74: a PARTIAL bag of the eight per-brush multipliers. The
   * record-state door merges it onto the stroke's own bag — absent fields keep
   * the stroke's value and an absent stored bag counts as neutral — so the
   * engine always receives the complete eight-field bag. An unknown multiplier
   * name (or a non-finite value) is refused, never stored.
   */
  readonly toolOverrides?: Partial<AquarelleToolOverrides>;
}

export interface NumericFieldReading {
  readonly value: number;
  readonly mixed: boolean;
}

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
 * 61-12 (D-13): one wet-global reading for the Advanced disclosure. The
 * stored param key IS the field key (no `paramKey` alias among the seven),
 * and an absent key reads 0 — the ribbon preset genuinely writes zeros at
 * pick time, so zero is a real stored value, never a display fallback.
 * Mixed compares the raw values across the selection.
 */
export function readSimpleRibbonGlobal(
  appearances: readonly ScriptStrokeAppearance[],
  key: string,
): NumericFieldReading {
  const values = appearances.map((appearance) =>
    readFiniteParam(appearance.params, key, 0));
  if (values.length === 0) return { value: 0, mixed: false };
  const first = values[0]!;
  return { value: first, mixed: values.some((value) => value !== first) };
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

/**
 * 261031-cf9: the Paint seed variation switch reads ON only when the
 * selection is non-empty and EVERY selected stroke carries a finite
 * non-negative `paintSeedSalt` (the reserved host key inside the stroke
 * params). Mixed, absent or malformed salts read OFF — the switch then
 * commits ON for the whole selection, so a mixed read is the only safe
 * representative.
 */
export function readPaintSeedVariation(
  appearances: readonly ScriptStrokeAppearance[],
): boolean {
  if (appearances.length === 0) return false;
  return appearances.every((appearance) => paintSeedSaltOf(appearance.params) !== null);
}

/** The switch's whole-selection flag patch. */
export function buildPaintSeedVariationPatch(enabled: boolean): ScriptStrokeAppearancePatch {
  return { paintSeedVariation: enabled };
}

// ============================================================
//  Stroke list laws (quick 261031-euf). Pure display derivations
//  over the frame listing: row labels, the kind filter, the tip
//  name, the topmost-first order and the finer filters. No
//  Preact, no signals, no DOM — the dialog reads them in its
//  render body and never writes.
// ============================================================

export type StrokeListTypeFilter = 'all' | 'paint' | 'lift';

/** Closed four-way map (the engine's tool union is closed on these). */
const STROKE_TOOL_LABELS: Readonly<Record<ScriptStrokeTool, string>> = Object.freeze({
  brush: 'Brush',
  water: 'Water',
  pen: 'Pen',
  lift: 'Eraser',
});

export function strokeToolLabel(tool: ScriptStrokeTool): string {
  return STROKE_TOOL_LABELS[tool];
}

/** 62-UAT: the vector categories' display names. */
const STROKE_VECTOR_FILTER_LABELS: Readonly<Record<'vector' | `${ScriptStrokeTool}-vector`, string>> =
  Object.freeze({
    vector: 'Vector',
    'brush-vector': 'Brush-Vector',
    'water-vector': 'Water-Vector',
    'pen-vector': 'Pen-Vector',
    'lift-vector': 'Eraser-Vector',
  });

/**
 * 62-UAT: the row's filter category. A drawn vector is `vector`; a converted
 * painted path keeps its tool and gains the `-vector` suffix. A lift stroke
 * never carries anchors, so it always resolves to its tool.
 */
export function strokeRowFilterValue(
  stroke: Pick<SelectableScriptStroke, 'tool' | 'vector' | 'vectorDrawn'>,
): ScriptStrokeFilterValue {
  if (!stroke.vector) return stroke.tool;
  if (stroke.vectorDrawn) return 'vector';
  switch (stroke.tool) {
    case 'brush':
      return 'brush-vector';
    case 'water':
      return 'water-vector';
    case 'pen':
      return 'pen-vector';
    default:
      return stroke.tool;
  }
}

/** The filter dropdown's display label for one category. */
export function strokeToolFilterLabel(value: ScriptStrokeFilterValue): string {
  if (value === 'vector' || value.endsWith('-vector')) {
    return STROKE_VECTOR_FILTER_LABELS[value as keyof typeof STROKE_VECTOR_FILTER_LABELS];
  }
  return strokeToolLabel(value as ScriptStrokeTool);
}

/** The list row's type label — `Vector`, `<Tool>-Vector`, or the tool name. */
export function strokeRowTypeLabel(
  stroke: Pick<SelectableScriptStroke, 'tool' | 'vector' | 'vectorDrawn'>,
): string {
  return strokeToolFilterLabel(strokeRowFilterValue(stroke));
}

/** The kind predicate, mirroring `matchesAquarelleStrokeFilter`. */
export function matchesStrokeTypeFilter(
  stroke: Pick<SelectableScriptStroke, 'kind'>,
  filter: StrokeListTypeFilter,
): boolean {
  if (filter === 'all') return true;
  return filter === 'lift' ? stroke.kind === 'lift' : stroke.kind === 'paint';
}

/**
 * The recorded tip's display name. Fail-closed: an unknown id (a preset id,
 * a deleted custom tip) renders the raw recorded string — never a blank.
 */
export function resolveStrokeTipName(brushId: string): string {
  return findTip(brushId)?.name ?? brushId;
}

/**
 * A NEW array ordered topmost-first (position 1 first), the creation serial
 * ascending as the tie-break. The input array and its objects are untouched.
 */
export function sortStrokesTopmostFirst(
  strokes: readonly SelectableScriptStroke[],
): SelectableScriptStroke[] {
  return [...strokes].sort((left, right) => (
    left.stackPosition !== right.stackPosition
      ? left.stackPosition - right.stackPosition
      : left.serial - right.serial
  ));
}

// ============================================================
//  Finer list filters (quick 261031-euf Task 2). Pure option
//  derivation, row filtering, effective-filter resolution and
//  the summary string. The OPTION lists are deliberately
//  derived from the rows that will actually be filtered: tools
//  from the type-filtered rows, tips from the tool-filtered
//  rows, so the dropdowns never offer an empty combination.
// ============================================================

export const ALL_TOOL_FILTER_LABEL = 'All tools';
export const ALL_TIP_FILTER_LABEL = 'All tips';

/** The categories, in canonical display order — tools first, vectors after. */
const STROKE_FILTER_ORDER: readonly ScriptStrokeFilterValue[] = Object.freeze([
  'brush',
  'water',
  'pen',
  'lift',
  'vector',
  'brush-vector',
  'water-vector',
  'pen-vector',
]);

export type StrokeToolFilterValue = ScriptStrokeFilterValue | 'all';

/** The categories PRESENT in the given rows, in canonical order. */
export function listStrokeToolOptions(
  strokes: readonly Pick<SelectableScriptStroke, 'tool' | 'vector' | 'vectorDrawn'>[],
): ScriptStrokeFilterValue[] {
  const present = new Set<ScriptStrokeFilterValue>();
  for (const stroke of strokes) present.add(strokeRowFilterValue(stroke));
  return STROKE_FILTER_ORDER.filter((value) => present.has(value));
}

/** One tip dropdown entry: the recorded id and its resolved display name. */
export interface StrokeTipOption {
  readonly brushId: string;
  readonly name: string;
}

/**
 * Distinct tips in FIRST-APPEARANCE order with resolved names (the raw id is
 * the fail-closed fallback for a preset or a deleted custom tip).
 */
export function listStrokeTipOptions(
  strokes: readonly Pick<SelectableScriptStroke, 'brushId'>[],
): StrokeTipOption[] {
  const out: StrokeTipOption[] = [];
  const seen = new Set<string>();
  for (const stroke of strokes) {
    if (seen.has(stroke.brushId)) continue;
    seen.add(stroke.brushId);
    out.push({ brushId: stroke.brushId, name: resolveStrokeTipName(stroke.brushId) });
  }
  return out;
}

export interface StrokeListFilter {
  readonly tool: StrokeToolFilterValue;
  readonly tip: string;
}

/** Rows matching the finer filters; 'all' matches everything. NEW array. */
export function filterStrokeListRows(
  strokes: readonly SelectableScriptStroke[],
  filter: StrokeListFilter,
): SelectableScriptStroke[] {
  return strokes.filter((stroke) => (
    (filter.tool === 'all' || strokeRowFilterValue(stroke) === filter.tool)
    && (filter.tip === 'all' || stroke.brushId === filter.tip)
  ));
}

/** The stored category when the current rows offer it, else 'all' (read-only). */
export function resolveStrokeToolFilter(
  stored: StrokeToolFilterValue,
  options: readonly ScriptStrokeFilterValue[],
): StrokeToolFilterValue {
  return stored !== 'all' && options.includes(stored) ? stored : 'all';
}

/** The stored tip when the current rows offer it, else 'all' (read-only). */
export function resolveStrokeTipFilter(
  stored: string,
  optionIds: readonly string[],
): string {
  return stored !== 'all' && optionIds.includes(stored) ? stored : 'all';
}

/**
 * The list's summary line over the FULL frame listing (the filters never
 * change the counts): `F<frame> · N strokes · P paint · E erasers`.
 */
export function strokeListSummary(
  playFrame: number,
  strokes: readonly Pick<SelectableScriptStroke, 'kind'>[],
): string {
  let paint = 0;
  let erasers = 0;
  for (const stroke of strokes) {
    if (stroke.kind === 'lift') erasers += 1;
    else paint += 1;
  }
  return `F${playFrame} · ${strokes.length} strokes · ${paint} paint · ${erasers} erasers`;
}

export interface StrokeSettingsOpenArgs {
  readonly surfaceActive: boolean;
  readonly selectionSize: number;
  readonly dismissed: boolean;
  readonly sawEmptySinceDismiss: boolean;
  /**
   * 261029-eur: keep the dialog open on an EMPTY selection (watercolor Edit
   * mode shows its filter row and "Select a stroke to edit." caption instead
   * of vanishing). An explicit close still wins until select mode exits and
   * re-enters, so the saw-empty re-arm edge is switched OFF here too.
   */
  readonly keepOpenOnEmpty?: boolean;
}

/**
 * Open only for an active surface with a non-empty selection that has not
 * been dismissed — unless the selection emptied after the dismissal (the
 * one edge that re-arms it), or the surface keeps the dialog open on empty.
 */
export function resolveStrokeSettingsOpen(args: StrokeSettingsOpenArgs): boolean {
  return args.surfaceActive
    && (args.selectionSize > 0 || args.keepOpenOnEmpty === true)
    && (!args.dismissed || args.sawEmptySinceDismiss);
}

export interface SawEmptyArgs {
  readonly dismissed: boolean;
  readonly surfaceActive: boolean;
  readonly selectionSize: number;
  /** 261029-eur: under keep-open-on-empty the re-arm edge is inert. */
  readonly keepOpenOnEmpty?: boolean;
}

/** The plain (non-signal) dismissal-edge marker law. */
export function shouldMarkSawEmpty(args: SawEmptyArgs): boolean {
  return args.dismissed
    && args.surfaceActive
    && args.selectionSize === 0
    && args.keepOpenOnEmpty !== true;
}

/**
 * The inclusive DISPLAYED range between the shift anchor and the clicked row.
 * Both indices address `orderedIds` (the rendered order), so the result keeps
 * the displayed order — never the selection's insertion order. Anything that
 * is not an integer index inside `0..length - 1` (an empty list, a negative
 * index, a fractional index, an index past the end) resolves to no ids, which
 * the caller must treat as "no range".
 */
export function resolveStrokeListRange(
  orderedIds: readonly number[],
  anchorIndex: number,
  clickedIndex: number,
): number[] {
  const last = orderedIds.length - 1;
  if (last < 0) return [];
  if (!Number.isInteger(anchorIndex) || !Number.isInteger(clickedIndex)) return [];
  if (anchorIndex < 0 || clickedIndex < 0) return [];
  if (anchorIndex > last || clickedIndex > last) return [];
  const start = Math.min(anchorIndex, clickedIndex);
  const end = Math.max(anchorIndex, clickedIndex);
  return orderedIds.slice(start, end + 1);
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
  /**
   * 261029-eur: the Studio's watercolor passthrough must keep listing with the
   * default `'all'` filter, so Stack positions and neighbours stay GLOBAL even
   * while the dialog's stroke-type filter narrows the overlay.
   */
  listStrokes(playFrame: number, size: ScriptStrokeSize): SelectableScriptStroke[];
  readAppearance(ids: readonly number[], playFrame: number): ScriptStrokeAppearance[];
  applyAppearance(ids: readonly number[], patch: ScriptStrokeAppearancePatch): boolean | Promise<boolean>;
  moveStrokes(ids: readonly number[], dxPx: number, dyPx: number): boolean | Promise<boolean>;
  transformStrokes(ids: readonly number[], transform: ScriptStrokeTransform): boolean | Promise<boolean>;
  /**
   * 261024-vga: place ONE stroke at an exact stack position (1 = topmost).
   * Present only where the module supports reordering — its absence hides
   * the Stack section entirely.
   */
  readonly reorderStroke?: (mutationId: number, positionFromTop: number) => boolean | void;
  /**
   * 261024-vga UAT: close the sheet by LEAVING the Move/Select surface and
   * restoring the previous tool. Without it, the dialog falls back to the
   * legacy sticky dismissal (hidden until the selection goes empty).
   */
  readonly closeMoveMode?: () => void;
  /**
   * 261029-eur: keep the sheet open on an EMPTY selection (Water color Edit
   * mode shows its filter row and caption instead of vanishing). Absent
   * falls back to the module law — watercolor keeps it open.
   */
  readonly keepOpenOnEmpty?: boolean;
  /**
   * 261101-jmm: the SAME delete path as Backspace/Delete (`aquarelleStrokesOnFrame`
   * guards, one undoable edit, one re-bake). The row trash passes exactly its
   * own `mutationId`; the header trash passes the whole current selection.
   * Absent hides both affordances. The dialog never touches the engine.
   */
  readonly deleteStrokes?: (ids: readonly number[]) => boolean | Promise<boolean> | void;
  /**
   * 261101-o2m: the ONE recompute the sheet runs when it closes (D-04's dialog
   * close exit). The dialog never writes `draftMode` false itself — a dirty
   * Draft may only leave through this settle. Absent means there is nothing to
   * settle (the sheet stays Live).
   */
  readonly settleDraft?: () => boolean | Promise<boolean>;
  /**
   * 261101-o2m: the pre-Draft base arming the switch's ON click awaits before
   * it may write `draftMode`. It resolves the frame's durable base BEFORE the
   * script diverges, so the later settle cannot fail closed on
   * `durable-base-unknown`. Absent means the sheet may enter Draft directly.
   */
  readonly armDraft?: () => Promise<boolean>;
  /**
   * 61-11 (VEC-02): the selected stroke's vector anchors when the single
   * selection IS a vector stroke, otherwise null. The dialog never reads the
   * record seam — the Studio resolves the payload, so the gate, the Anchor
   * width reading and the effective-px readout share ONE source of truth.
   * Absent means this module has no vector paths (the gate stays disabled).
   */
  readonly readVectorAnchors?: (ids: readonly number[]) => readonly AquarelleAnchor[] | null;
  /**
   * 62-02 (D-10): the single selected stroke's curve-entry classification
   * (vector / painted / refused with its fixed reason). The dialog never
   * reads the record seam — the Studio resolves ONE recorded stroke. Absent
   * keeps the shipped vector-only gate byte-identical.
   */
  readonly readCurveEntry?: (ids: readonly number[]) => CurveEntryState | null;
  /**
   * 62-02 (D-03): enter curve mode on the single eligible painted stroke —
   * arm the durable base, fit the stroke's own samples lazily, bracket the
   * wireframe and open the shipped path-edit latch. False when the stroke is
   * missing or refused, or the base could not be armed (nothing is written,
   * held or opened). Absent hides the painted entrance.
   */
  readonly enterPaintedCurve?: (ids: readonly number[]) => boolean | Promise<boolean>;
  /**
   * 61-11 (VEC-03 / T-61-38): write one factor on EVERY selected anchor of the
   * single selected vector stroke as ONE path edit, so a multi-anchor change is
   * one undo entry rather than one per anchor. Returns true only when the edit
   * was accepted. Absent hides the Anchor width block.
   */
  readonly applyAnchorWidths?: (ids: readonly number[], value: number) => boolean | Promise<boolean>;
  /**
   * 61-27 (IN-03): the sheet's ONE refusal channel for a commit the module
   * declined. Optional, so an absent Studio port keeps the shipped silent
   * fallback; the dialog itself stays engine-free and never writes a signal.
   */
  readonly publishRefusal?: (message: string) => void;
  /**
   * 61-31 (G-20): write one curve-evaluation mode on every VECTOR stroke of the
   * selection as ONE history entry. An evaluation mode over the same anchors:
   * the write re-samples the replay points and never rewrites a stored kind or
   * handle. Absent hides the Curve row.
   */
  readonly applyCurveMode?: (ids: readonly number[], mode: AquarelleCurveMode) => boolean | Promise<boolean>;
  /**
   * 261112-i6d: write one corner state on the SELECTED anchors of the open
   * path edit as ONE history entry — the same commit seam and the same bare
   * roll call Alt+click uses, so the row and the gesture can never disagree.
   * Absent hides the Corner row.
   */
  readonly applyAnchorCorners?: (
    ids: readonly number[],
    state: AnchorCornerState,
  ) => boolean | Promise<boolean>;
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

/** Track display ranges only — typed commits may exceed them. */
export const STROKE_SCALE_RANGE = Object.freeze({ min: 10, max: 500 });
export const STROKE_ROTATION_RANGE = Object.freeze({ min: -360, max: 360 });
/** X/Y typed absolute targets (canvas px). */
export const STROKE_POSITION_RANGE = Object.freeze({ min: 0, max: 2000 });

export type StrokeGeometryControl = 'uniform' | 'scaleX' | 'scaleY' | 'rotation';

export interface StrokeGeometryMoveDelta {
  readonly dxPx: number;
  readonly dyPx: number;
}

export interface StrokeGeometryTransformResult {
  readonly transform: ScriptStrokeTransform;
  readonly nextSession: StrokeGeometrySession;
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
 * "write nothing" (same value, non-finite input, zero baseline). Typed values
 * may exceed the track ranges — only the track is bounded. Every transform
 * anchors at the selection centre.
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
    const rotationDeg = nextValue;
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

  const nextPct = nextValue;
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
        scaleXPct: roundSession(session.scaleXPct * factor),
        scaleYPct: roundSession(session.scaleYPct * factor),
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

// ── The Edit path entrance (E2) ─────────────────────────────────────
//
//  One vector stroke selected is the ONLY state that can enter path edit.
//  The disabled reasons are model constants so the button can never
//  inline its own copy, and `pressed` compares the session's mutation id
//  (a string) with the selected stroke's id (a number) — the two live in
//  different types on purpose: the session id is opaque to the dialog.

export const PATH_EDIT_LABEL = 'Edit path';

/** 0 or 1 non-vector stroke selected. */
export const PATH_EDIT_SINGLE_DISABLED_REASON = 'Edit path — select one vector stroke';

/** More than one stroke selected: paths are edited one stroke at a time. */
export const PATH_EDIT_MULTI_DISABLED_REASON = 'Edit path — select a single vector stroke';

/**
 * 62-02 (D-10): a Lift stroke records an erasure, not a paint path — there is
 * nothing to fit and nothing to edit, so it is refused with its own named
 * copy instead of the shipped "select one vector stroke" line.
 */
export const PATH_EDIT_LIFT_DISABLED_REASON = 'Edit path — an eraser stroke cannot be edited';

/**
 * 62-02 (D-10): fewer than two distinct finite samples is no path at all.
 * Fixed and non-interpolated, like every other refusal in this module.
 */
export const PATH_EDIT_DEGENERATE_DISABLED_REASON =
  'Edit path — this stroke has too few points to edit';

/**
 * 62-02 (D-10): what the spline-pointer resolves for ONE recorded stroke.
 * `vector` keeps the shipped readable-anchors arm, `painted` is the new
 * conversion entrance, and `refused` carries the fixed disabled reason (or
 * null when the shipped single-selection copy already says enough).
 */
export interface CurveEntryState {
  readonly kind: 'vector' | 'painted' | 'refused';
  readonly reason: string | null;
}

/** Consecutive samples closer than this (document uv) are one sample. */
const CURVE_ENTRY_DUPLICATE_EPSILON_UV = 1e-6;

/**
 * Distinct finite samples in recording order, collapsing CONSECUTIVE
 * duplicates only (the fitter's own law). Never throws on malformed input:
 * a non-object, a non-finite coordinate or a missing `points` list simply
 * contributes nothing.
 */
function countDistinctFiniteSamples(points: unknown): number {
  if (!Array.isArray(points)) return 0;
  let count = 0;
  let previousX = 0;
  let previousY = 0;
  for (const sample of points) {
    if (typeof sample !== 'object' || sample === null) continue;
    const { x, y } = sample as { readonly x?: unknown; readonly y?: unknown };
    if (typeof x !== 'number' || !Number.isFinite(x)) continue;
    if (typeof y !== 'number' || !Number.isFinite(y)) continue;
    if (
      count > 0
      && Math.abs(previousX - x) <= CURVE_ENTRY_DUPLICATE_EPSILON_UV
      && Math.abs(previousY - y) <= CURVE_ENTRY_DUPLICATE_EPSILON_UV
    ) {
      continue;
    }
    count += 1;
    previousX = x;
    previousY = y;
  }
  return count;
}

/**
 * 62-02 (D-10): the ONE eligibility decision the spline-pointer reads. The
 * shipped vector arm is checked FIRST — readable anchors mean the stroke is
 * already a path, whatever its tool — so a vector stroke keeps exactly the
 * pre-62 behaviour. An anchors array that is present but unreadable is
 * neither a vector path nor a paintable stroke: it refuses with no new copy,
 * and the gate falls back to the shipped single-selection reason. Lift is
 * refused with its eraser line; every other tool needs two distinct finite
 * samples or it is refused as degenerate.
 */
export function resolvePaintedCurveEligibility(stroke: AquarelleStroke): CurveEntryState {
  const candidate = stroke as
    | {
        readonly tool?: unknown;
        readonly points?: unknown;
        readonly anchors?: unknown;
      }
    | null
    | undefined;
  if (typeof candidate !== 'object' || candidate === null) {
    return { kind: 'refused', reason: PATH_EDIT_DEGENERATE_DISABLED_REASON };
  }
  if (normaliseAquarelleAnchors(candidate.anchors) !== undefined) {
    return { kind: 'vector', reason: null };
  }
  if (Array.isArray(candidate.anchors) && candidate.anchors.length > 0) {
    return { kind: 'refused', reason: null };
  }
  if (candidate.tool === 'lift') {
    return { kind: 'refused', reason: PATH_EDIT_LIFT_DISABLED_REASON };
  }
  if (
    candidate.tool !== 'brush'
    && candidate.tool !== 'water'
    && candidate.tool !== 'pen'
  ) {
    return { kind: 'refused', reason: PATH_EDIT_DEGENERATE_DISABLED_REASON };
  }
  if (countDistinctFiniteSamples(candidate.points) < 2) {
    return { kind: 'refused', reason: PATH_EDIT_DEGENERATE_DISABLED_REASON };
  }
  return { kind: 'painted', reason: null };
}

/**
 * 62-02 (D-10): the ONE write-admission decision the Studio's writer seam
 * delegates to. A strict superset of the shipped readable-anchors test: a
 * stroke with readable anchors may always be written, and an eligible
 * anchorless painted stroke may now be converted through the same seam.
 * Everything else — Lift, degenerate, malformed anchors, a missing stroke —
 * is refused.
 */
export function admitsPathEditWrite(stroke: AquarelleStroke): boolean {
  const candidate = stroke as { readonly anchors?: unknown } | null | undefined;
  if (
    typeof candidate === 'object'
    && candidate !== null
    && normaliseAquarelleAnchors(candidate.anchors) !== undefined
  ) {
    return true;
  }
  return resolvePaintedCurveEligibility(stroke).kind === 'painted';
}

export interface PathEditGateArgs {
  readonly selectionSize: number;
  readonly vectorStrokeCount: number;
  readonly selectedMutationId: number | null;
  readonly pathEditMutationId: string | null;
  /**
   * 62-02 (D-10): the single selected stroke's eligibility. OPTIONAL, so
   * every pre-62 caller (and every shipped case) stays byte-identical when it
   * is absent or null.
   */
  readonly curveEntry?: CurveEntryState | null;
}

export interface PathEditGate {
  readonly enabled: boolean;
  readonly title: string;
  readonly pressed: boolean;
}

/**
 * Resolve the header button's whole state in one place. `title` is the
 * constant label while enabled and the constant disabled reason otherwise,
 * so the sheet never renders a stale hover hint.
 *
 * 62-02 (D-10): a single eligible painted stroke joins the shipped vector arm
 * (the entry fits it on click), and a refused entry contributes its named
 * reason. The multi-selection reason wins over both, and the shipped single
 * reason stays the fallback for a refusal with no new copy.
 */
export function resolvePathEditGate(args: PathEditGateArgs): PathEditGate {
  const enabled = args.selectionSize === 1
    && (args.vectorStrokeCount === 1 || args.curveEntry?.kind === 'painted');
  return {
    enabled,
    title: enabled
      ? PATH_EDIT_LABEL
      : args.selectionSize > 1
        ? PATH_EDIT_MULTI_DISABLED_REASON
        : args.curveEntry?.reason ?? PATH_EDIT_SINGLE_DISABLED_REASON,
    pressed:
      args.selectedMutationId !== null &&
      args.pathEditMutationId === String(args.selectedMutationId),
  };
}

/** 61-19 (G-5): the width commit's target inputs. */
export interface AnchorWidthTargetArgs {
  readonly ids: readonly number[];
  readonly pathEditMutationId: string | null;
}

/**
 * 61-19 (G-5): the ONE stroke the width commit may write. The dialog's
 * selection decides `ids`, but the anchor indices belong to the OPEN path
 * edit — so the write is legal only when exactly one stroke is selected AND
 * that stroke IS the open edit. A mismatch, a missing edit, an empty session
 * id or a non-integer id all fail closed to null, and the commit refuses.
 */
export function resolveAnchorWidthTarget(args: AnchorWidthTargetArgs): number | null {
  if (args.ids.length !== 1) return null;
  const id = args.ids[0]!;
  if (!Number.isInteger(id)) return null;
  const sessionId = args.pathEditMutationId;
  if (typeof sessionId !== 'string' || sessionId === '') return null;
  return sessionId === String(id) ? id : null;
}

export interface PathEditExitArgs {
  readonly pathEditActive: boolean;
  readonly gateEnabled: boolean;
  /**
   * 61-27 (WR-04): the selection's stroke id and the open edit's session id.
   * The gate only answers "may the Edit path button be pressed", so it stays
   * ENABLED for any one-vector-stroke selection — leaving the mode therefore
   * needs its own target comparison.
   */
  readonly selectedMutationId: number | null;
  readonly pathEditMutationId: string | null;
}

/**
 * Leaving the mode is mandatory whenever the gate closes OR the selection no
 * longer names the edited stroke: a path edit that points at anything else
 * would strand the overlay on a stroke the sheet is not showing. The dialog
 * keeps its render body signal-free — this predicate only DECIDES, the
 * effect performs.
 */
export function shouldExitPathEdit(args: PathEditExitArgs): boolean {
  if (!args.pathEditActive) return false;
  if (!args.gateEnabled) return true;
  // The session id is a string, the selection id a number — compare the same
  // string forms `resolvePathEditGate.pressed` uses.
  return args.pathEditMutationId !== String(args.selectedMutationId);
}

// ── The Anchor width control (E4 / VEC-03) ──────────────────────────
//
//  D-09: an anchor's width is a MULTIPLIER of the stroke's brush Size, never a
//  pixel radius. The band is deliberately wider than the multiplier band —
//  `MULTIPLIER_MIN` stays the shipped 0.5, untouched — because a vector path
//  can pinch to 0.2 and swell to 20.0.
//
//  quick 261112-i6d: there is ONE commit/storage ceiling and it is the
//  payload's `ANCHOR_WIDTH_MAX` — the constant the package clamp, the engine's
//  scripted width channel and the reopen guard all read. `SLIDER_MAX` below is
//  the ×10 DRAG affordance only (the track the knob spans); it is never a
//  clamp, so a free-typed value above it still reaches the document through
//  `anchorWidthPatchValue`.

export const AQUARELLE_ANCHOR_WIDTH_MIN = 0.2;
/** The ONE commit/storage ceiling — an ALIAS of the package authority, never a
 *  second literal, so the app and the payload guard can never disagree. */
export const AQUARELLE_ANCHOR_WIDTH_MAX = ANCHOR_WIDTH_MAX;
/** The slider TRACK ceiling (×10 drag affordance). Display/drag only — never a
 *  clamp; typed entry above it passes to `anchorWidthPatchValue`. */
export const AQUARELLE_ANCHOR_WIDTH_SLIDER_MAX = 10;
export const AQUARELLE_ANCHOR_WIDTH_STEP = 0.1;
export const AQUARELLE_ANCHOR_WIDTH_DEFAULT = 1;

export interface AnchorWidthReading {
  readonly value: number;
  readonly mixed: boolean;
  readonly count: number;
}

/**
 * 61-19 (G-5): the reading when nothing is measurable — no listed anchor, or
 * no open path edit to write to. One constant keeps the "present but empty"
 * state, and the control's disabled reason, stated exactly once.
 */
export const ANCHOR_WIDTH_EMPTY_READING: AnchorWidthReading = {
  value: AQUARELLE_ANCHOR_WIDTH_DEFAULT,
  mixed: false,
  count: 0,
};

/** 61-19 (G-5): why the Vertex size control is inert when no path edit is open. */
export const ANCHOR_WIDTH_NO_EDIT_REASON =
  'Open Edit path on this stroke to set vertex sizes.';

/**
 * 61-27 (IN-03): the ONE reason a refused Vertex size commit publishes. The
 * commit's boolean used to be discarded, so a refusal (wrong target, missing
 * stroke, in-flight lock) looked exactly like a success — the knob snapped back
 * with no explanation. Fixed and non-interpolated: the same line for every
 * refusal path.
 */
export const ANCHOR_WIDTH_COMMIT_REFUSED_MESSAGE = 'Vertex size not applied — the path edit is no longer open on this stroke.';

/**
 * 261111-wd6: the ONE reason a refused per-vertex colour commit publishes.
 * The anchor branch used to discard the commit promise, so a refusal (locked
 * surface, in-flight edit, declined begin, failed rebake) looked exactly like
 * a success — the picker moved and no vertex changed. Same shape as the
 * Vertex size line: fixed, non-interpolated, one line for every refusal path.
 */
export const ANCHOR_COLOR_COMMIT_REFUSED_MESSAGE = 'Vertex colour not applied — the path edit could not be committed on this stroke.';

// ── The Corner row (261112-i6d) ─────────────────────────────────────
//
//  One corner state per vertex, round or straight, shared with the Alt+click
//  gesture (`toggleAnchorCorner`). The row is a SETTER, never a toggle: it
//  reads the selection and writes the state the user pressed, so pressing the
//  state the selection already holds writes nothing.

/** 261112-i6d: the Corner row's two buttons, in declaration order. */
export const ANCHOR_CORNER_OPTIONS: readonly AnchorCornerOption[] = Object.freeze([
  Object.freeze({ id: 'round' as const, state: 'round' as const, label: 'Round' }),
  Object.freeze({ id: 'straight' as const, state: 'straight' as const, label: 'Straight' }),
]);

export interface AnchorCornerOption {
  readonly id: AnchorCornerState;
  readonly state: AnchorCornerState;
  readonly label: string;
}

/** 261112-i6d: why the Corner row is inert when no path edit is open. */
export const ANCHOR_CORNER_NO_EDIT_REASON =
  'Open Edit path on this stroke to set vertex corners.';

/** 261112-i6d: the ONE reason a refused corner commit publishes. */
export const ANCHOR_CORNER_COMMIT_REFUSED_MESSAGE = 'Vertex corner not applied — the path edit is no longer open on this stroke.';

/** 261112-i6d: the reading when no listed anchor exists to describe. */
export const ANCHOR_CORNER_EMPTY_READING: AnchorCornerReading = {
  state: null,
  mixed: false,
  count: 0,
};

export interface AnchorCornerReading {
  /** The FIRST listed anchor's state — the first-selected precedent. */
  readonly state: AnchorCornerState | null;
  readonly mixed: boolean;
  readonly count: number;
}

/**
 * 261112-i6d: the Corner row's reading. Mirrors `readAnchorWidthReading`:
 * only the listed indices the path actually carries participate, and an empty
 * participation reads the empty constant so the row can state why it is inert.
 */
export function readAnchorCornerReading(
  anchors: readonly AquarelleAnchor[],
  indices: readonly number[],
): AnchorCornerReading {
  const states: AnchorCornerState[] = [];
  for (const index of indices) {
    const anchor = Number.isInteger(index) && index >= 0 ? anchors[index] : undefined;
    if (!anchor) continue;
    states.push(readAnchorCornerState(anchor));
  }
  if (states.length === 0) return ANCHOR_CORNER_EMPTY_READING;
  const first = states[0]!;
  return { state: first, mixed: states.some((state) => state !== first), count: states.length };
}

/**
 * The Paint row's reading. `value` is the FIRST selected anchor's factor (the
 * first-selected precedent every numeric field follows), `mixed` when any
 * listed anchor disagrees, and `count` how many of the listed indices the path
 * actually carries. An absent `width` is 1.0 — the sparse law 61-05 records.
 */
export function readAnchorWidthReading(
  anchors: readonly AquarelleAnchor[],
  indices: readonly number[],
): AnchorWidthReading {
  const factors: number[] = [];
  for (const index of indices) {
    const anchor = Number.isInteger(index) && index >= 0 ? anchors[index] : undefined;
    if (!anchor) continue;
    factors.push(
      typeof anchor.width === 'number' && Number.isFinite(anchor.width)
        ? anchor.width
        : AQUARELLE_ANCHOR_WIDTH_DEFAULT,
    );
  }
  if (factors.length === 0) {
    return ANCHOR_WIDTH_EMPTY_READING;
  }
  const first = factors[0]!;
  return { value: first, mixed: factors.some((factor) => factor !== first), count: factors.length };
}

// ── The vertex colour row (62-UAT) ──────────────────────────────────
//
//  The selected vertices' EFFECTIVE colour: the anchor's sparse explicit
//  `color` when it carries one, else the stroke's own colour. A read-only
//  reading — the sidebar colour picker stays the ONE writer.

export interface AnchorColorReading {
  /** The FIRST listed anchor's effective colour, or null when none exists. */
  readonly color: string | null;
  readonly mixed: boolean;
  readonly count: number;
}

/** 62-UAT: the reading when no listed anchor exists to describe. */
export const ANCHOR_COLOR_EMPTY_READING: AnchorColorReading = {
  color: null,
  mixed: false,
  count: 0,
};

/**
 * 62-UAT: the Curve tab's vertex-colour reading. Mirrors
 * `readAnchorWidthReading`: only the listed indices the path actually carries
 * participate; an explicit anchor colour wins over the stroke fallback. The
 * comparison is case-insensitive so `#AABBCC` and `#aabbcc` are not "Mixed".
 */
export function readAnchorColorReading(
  anchors: readonly AquarelleAnchor[],
  indices: readonly number[],
  strokeColor: string | null,
): AnchorColorReading {
  const colors: (string | null)[] = [];
  for (const index of indices) {
    const anchor = Number.isInteger(index) && index >= 0 ? anchors[index] : undefined;
    if (!anchor) continue;
    const explicit =
      typeof anchor.color === 'string' && anchor.color.length > 0 ? anchor.color : null;
    colors.push(explicit ?? strokeColor);
  }
  if (colors.length === 0) return ANCHOR_COLOR_EMPTY_READING;
  const first = colors[0] ?? null;
  const key = (color: string | null): string => (color ?? '').toLowerCase();
  return {
    color: first,
    mixed: colors.some((color) => key(color) !== key(first)),
    count: colors.length,
  };
}

/**
 * Size x the anchor factor, rounded to ONE decimal — the honest per-vertex
 * radius in px. Never reads `scriptScale` (T-61-39): a 1.8x vertex on a 20px
 * brush reads `→ 36 px`, whatever the transform says.
 */
export function anchorWidthEffectivePx(sizePx: number, factor: number): number {
  const safeSize = Number.isFinite(sizePx) ? sizePx : 0;
  const safeFactor = Number.isFinite(factor) ? factor : AQUARELLE_ANCHOR_WIDTH_DEFAULT;
  return Math.round(safeSize * safeFactor * 10) / 10;
}

/**
 * The committed factor: clamped into the band. Exactly 1 survives as 1 so the
 * commit DELETES the sparse `width` key instead of storing the default, and a
 * non-finite entry can never reach a document field.
 */
export function anchorWidthPatchValue(value: number): number {
  if (!Number.isFinite(value)) return AQUARELLE_ANCHOR_WIDTH_DEFAULT;
  return Math.min(AQUARELLE_ANCHOR_WIDTH_MAX, Math.max(AQUARELLE_ANCHOR_WIDTH_MIN, value));
}
