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
import { findTip } from '@efxlab/efx-watercolor/brushes';
import {
  DEFAULT_AQUARELLE_RENDER_MODE,
  paintSeedSaltOf,
  type AquarelleAnchor,
  type AquarelleRenderMode,
} from '@efxlab/efx-watercolor/payload';
import type {
  SelectableScriptStroke,
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

/**
 * 61-12 (D-13): the seven wet globals behind the Advanced disclosure. Exactly
 * the Water color Paint rows MINUS `size` — Size is the shared brush slider
 * (D-05), not a wet term, and `lift` is the Eraser strength, never a global.
 */
export const SIMPLE_RIBBON_GLOBALS: readonly StrokeSettingsField[] = Object.freeze(
  WATERCOLOR_SETTINGS_FIELDS.filter((field) => field.key !== 'size'),
);

/** The UI-SPEC Advanced disclosure note, verbatim and never interpolated. */
export const SIMPLE_RIBBON_WET_NOTE =
  'All seven sit at zero for a plain ribbon. Raise any to blend physics back in.';

export function strokeSettingsFields(module: StrokeSettingsModule): readonly StrokeSettingsField[] {
  return module === 'watercolor' ? WATERCOLOR_SETTINGS_FIELDS : BRUSH_SETTINGS_FIELDS;
}

/** The narrow per-stroke appearance the dialog hydrates from. */
export interface ScriptStrokeAppearance {
  readonly mutationId: number;
  readonly params: Readonly<Record<string, number>>;
  readonly color: string | null;
  /**
   * 61-12 (VEC-04 / D-12): the stroke's render discriminator. Absent means
   * watercolour — the field is sparse on the recorded stroke, so the reading
   * applies the default rather than inventing a third "unknown" state.
   */
  readonly renderMode?: AquarelleRenderMode;
}

/** 61-12 (VEC-04 / E3): the `Render` row's two-option reading. */
export interface RenderModeReading {
  /** The agreed mode, or null when the selection disagrees. */
  readonly mode: AquarelleRenderMode | null;
  readonly mixed: boolean;
}

/** One `Render` row option — the model owns both the id and the copy. */
export interface RenderModeOption {
  readonly id: 'watercolor' | 'ribbon';
  readonly mode: AquarelleRenderMode;
  readonly label: string;
}

/**
 * 61-12 (VEC-04 / E3): the two options, in UI-SPEC order. `id` is the test-id
 * suffix (`-option-watercolor` / `-option-ribbon`); the global button rule
 * uppercases `label` in the sheet. Constants only — no user text can reach it.
 */
export const RENDER_MODE_OPTIONS: readonly RenderModeOption[] = Object.freeze([
  Object.freeze({ id: 'watercolor' as const, mode: 'watercolor' as const, label: 'Watercolor' }),
  Object.freeze({ id: 'ribbon' as const, mode: 'simple-ribbon' as const, label: 'Ribbon' }),
]);

/**
 * 61-12 (VEC-04 / D-12): the selection's render mode. Absent counts as the
 * default, so an anchorless hand-painted stroke and an explicit `watercolor`
 * stroke read the SAME; any disagreement is mixed with no representative.
 */
export function readRenderMode(appearances: readonly ScriptStrokeAppearance[]): RenderModeReading {
  if (appearances.length === 0) {
    return { mode: DEFAULT_AQUARELLE_RENDER_MODE, mixed: false };
  }
  const modes = appearances.map((appearance) =>
    appearance.renderMode ?? DEFAULT_AQUARELLE_RENDER_MODE);
  const first = modes[0]!;
  if (modes.some((mode) => mode !== first)) return { mode: null, mixed: true };
  return { mode: first, mixed: false };
}

/** One canonical-unit batch write (params merged, color replaced). */
export interface ScriptStrokeAppearancePatch {
  readonly params?: Readonly<Record<string, number>>;
  readonly color?: string;
  /** 261031-cf9: the Paint seed variation flag (see the appearance door). */
  readonly paintSeedVariation?: boolean;
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

/** The engine's closed tool union, in its canonical display order. */
const STROKE_TOOL_ORDER: readonly ScriptStrokeTool[] = Object.freeze([
  'brush',
  'water',
  'pen',
  'lift',
]);

export type StrokeToolFilterValue = ScriptStrokeTool | 'all';

/** The tools PRESENT in the given rows, in canonical order. */
export function listStrokeToolOptions(
  strokes: readonly Pick<SelectableScriptStroke, 'tool'>[],
): ScriptStrokeTool[] {
  const present = new Set<ScriptStrokeTool>();
  for (const stroke of strokes) present.add(stroke.tool);
  return STROKE_TOOL_ORDER.filter((tool) => present.has(tool));
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
    (filter.tool === 'all' || stroke.tool === filter.tool)
    && (filter.tip === 'all' || stroke.brushId === filter.tip)
  ));
}

/** The stored tool when the current rows offer it, else 'all' (read-only). */
export function resolveStrokeToolFilter(
  stored: StrokeToolFilterValue,
  options: readonly ScriptStrokeTool[],
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

// ============================================================
//  261101-jmm: the sheet's view law — LIST FIRST. The stroke list
//  is the default surface and stays visible while strokes are
//  selected; the Geometry/Stack/Paint tabs are an explicit request
//  the user makes from the header icon. A settings request never
//  survives the selection being observed EMPTY (a close/reopen, a
//  leave and re-enter of Move/Select, or a delete that empties the
//  selection): the invalidation marker re-arms the list.
// ============================================================

export type StrokeSettingsView = 'list' | 'settings';

/**
 * The view a render shows. A settings request over an EMPTY selection falls
 * back to the list (never an empty settings panel); every other request is
 * honoured as asked. Pure render-time derivation — never a signal write.
 */
export function resolveStrokeSettingsView(
  requested: StrokeSettingsView,
  selectionSize: number,
): StrokeSettingsView {
  return requested === 'settings' && selectionSize > 0 ? 'settings' : 'list';
}

export interface StrokeSettingsViewInvalidationArgs {
  readonly requested: StrokeSettingsView;
  readonly selectionSize: number;
}

/**
 * The staleness gate for the settings REQUEST: a settings request survives a
 * non-empty -> non-empty selection change but never survives the selection
 * being observed empty. Gates a plain (non-signal) module marker written
 * idempotently in the render body — the `shouldMarkSawEmpty` precedent — so
 * the gate notifies no subscriber and cannot start a reactive loop.
 */
export function shouldInvalidateStrokeSettingsView(
  args: StrokeSettingsViewInvalidationArgs,
): boolean {
  return args.requested === 'settings' && args.selectionSize === 0;
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
   * 61-11 (VEC-03 / T-61-38): write one factor on EVERY selected anchor of the
   * single selected vector stroke as ONE path edit, so a multi-anchor change is
   * one undo entry rather than one per anchor. Returns true only when the edit
   * was accepted. Absent hides the Anchor width block.
   */
  readonly applyAnchorWidths?: (ids: readonly number[], value: number) => boolean | Promise<boolean>;
  /**
   * 61-12 (VEC-04 / T-61-41): write one render mode on EVERY selected paint
   * stroke as ONE history entry, so the whole batch is one undo step. The mode
   * is a stroke property (D-12/D-14) — the write adds or removes no `anchors`
   * key and needs no vector read. Absent hides the Render row.
   */
  readonly applyRenderMode?: (ids: readonly number[], mode: AquarelleRenderMode) => boolean | Promise<boolean>;
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

export interface PathEditGateArgs {
  readonly selectionSize: number;
  readonly vectorStrokeCount: number;
  readonly selectedMutationId: number | null;
  readonly pathEditMutationId: string | null;
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
 */
export function resolvePathEditGate(args: PathEditGateArgs): PathEditGate {
  const enabled = args.selectionSize === 1 && args.vectorStrokeCount === 1;
  return {
    enabled,
    title: enabled
      ? PATH_EDIT_LABEL
      : args.selectionSize > 1
        ? PATH_EDIT_MULTI_DISABLED_REASON
        : PATH_EDIT_SINGLE_DISABLED_REASON,
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
//  can pinch to 0.2 and swell to 2.0.

export const AQUARELLE_ANCHOR_WIDTH_MIN = 0.2;
export const AQUARELLE_ANCHOR_WIDTH_MAX = 2;
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

/** 61-19 (G-5): why the Anchor width control is inert when no path edit is open. */
export const ANCHOR_WIDTH_NO_EDIT_REASON =
  'Open Edit path on this stroke to set anchor widths.';

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
