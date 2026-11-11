import { useCallback, useEffect, useRef } from 'preact/hooks';
import { signal, type Signal } from '@preact/signals';
import { memo } from 'preact/compat';
import type { CSSProperties, TargetedPointerEvent } from 'preact';
import { Eye, EyeOff, List, Settings2, SlidersHorizontal, Spline, SplinePointer, Trash2, X } from 'lucide-preact';
import { SliderStepper } from '../../shared/SliderStepper';
import { SidebarScrollArea } from '../../sidebar/SidebarScrollArea';
import {
  ALL_TIP_FILTER_LABEL,
  ALL_TOOL_FILTER_LABEL,
  ANCHOR_WIDTH_COMMIT_REFUSED_MESSAGE,
  ANCHOR_WIDTH_EMPTY_READING,
  ANCHOR_WIDTH_NO_EDIT_REASON,
  AQUARELLE_ANCHOR_WIDTH_DEFAULT,
  AQUARELLE_ANCHOR_WIDTH_MAX,
  AQUARELLE_ANCHOR_WIDTH_MIN,
  AQUARELLE_ANCHOR_WIDTH_STEP,
  CURVE_MODE_OPTIONS,
  FRESH_STROKE_GEOMETRY_SESSION,
  STROKE_POSITION_RANGE,
  STROKE_ROTATION_RANGE,
  STROKE_SCALE_RANGE,
  anchorWidthEffectivePx,
  anchorWidthPatchValue,
  buildAppearancePatch,
  buildPaintSeedVariationPatch,
  filterStrokeListRows,
  geometryMoveDelta,
  geometryTransform,
  listStrokeTipOptions,
  listStrokeToolOptions,
  matchesStrokeTypeFilter,
  readAnchorWidthReading,
  readCurveMode,
  readNumericField,
  readPaintSeedVariation,
  resolveAnchorWidthTarget,
  resolvePathEditGate,
  resolveStrokeListRange,
  resolveStrokeSettingsOpen,
  resolveStrokeSettingsView,
  resolveStrokeTipFilter,
  resolveStrokeTipName,
  resolveStrokeToolFilter,
  shouldExitPathEdit,
  shouldInvalidateStrokeSettingsView,
  shouldMarkSawEmpty,
  sortStrokesTopmostFirst,
  strokeListSummary,
  strokeSettingsFields,
  strokeToolLabel,
  type AnchorWidthReading,
  type NumericFieldReading,
  type StrokeGeometryControl,
  type StrokeGeometrySession,
  type StrokeSettingsDialogBundle,
  type StrokeSettingsView,
} from './strokeSettingsModel';
import {
  draftMode,
  frozenCacheVisible,
  scriptSelectedStrokeIds,
  scriptSelectMode,
  setDraftMode,
  setFrozenCacheVisible,
  setStrokeSizePreview,
  strokeSizePreview,
  wireframeMode,
} from './scriptStrokeEdition';
import { scriptStrokeSelectionBox } from './scriptStrokeTransform';
import { clampStackPosition } from './stackOrder';
import {
  SHEET_ID_STROKE_SETTINGS,
  bringSheetToFront,
  closeSheetIfFront,
  releaseSheet,
  sheetZIndex,
} from './floatingSheetStack';
import {
  aquarelleStrokeSettingsDismissed,
  aquarelleStrokeTipFilter,
  aquarelleStrokeToolFilter,
  aquarelleStrokeTypeFilter,
  selectAquarelleStroke,
  setAquarelleStrokeSelection,
  setAquarelleStrokeTipFilter,
  setAquarelleStrokeToolFilter,
  setAquarelleStrokeTypeFilter,
  toggleAquarelleStrokeSelection,
  type AquarelleStrokeToolFilter,
  type AquarelleStrokeTypeFilter,
} from './aquarelleStrokeSelection';
import { enterPathEdit, exitPathEdit, pathEditMutationId, vectorAnchorSelection } from './vectorPathSession';

/**
 * quick 261024-p5q: the Stroke Settings dialog — a selection-gated, movable
 * editing surface for the selected Studio strokes (Brush Move / Water color
 * Select). Patterned on the Photo Reference dialog: no backdrop, no focus
 * trap — the canvas and its transform handles stay interactive behind it.
 *
 * 261024-p5q UAT revision: the header reuses the Document sound modal's
 * chrome (icon + title + rounded-square close) and the internal scroll uses
 * the app's SidebarScrollArea thumb (never the OS scrollbar). The color is
 * not edited here: a read-only thumb shows the selected strokes' color and
 * the one shared picker in the sidebar Color tab commits the change.
 *
 * 261024-vga UAT revision: one pinned tab row (Geometry | Stack), Geometry by
 * default, both on one row. The tabs hold no stroke data — a ref-held signal
 * holds only the active tab key.
 *
 * quick 261111-vg4: the Paint tab is GONE. Per-stroke size/color/wet editing
 * lives in the sidebar Paint/Brush tabs and the top bar (quick 261111-ucf) —
 * this sheet edits GEOMETRY only, never a duplicate paint surface.
 *
 * Dismissal (exact law): `dismissed` is a signal written ONLY by Escape and
 * the header close button. `sawEmptySinceDismiss` is a plain module flag
 * (NOT a signal) marking "the selection was empty at least once after the
 * dismissal", written idempotently in the render body. Open =
 * surfaceActive && size > 0 && (!dismissed || sawEmptySinceDismiss), so a
 * non-empty -> non-empty change never reopens it while empty -> non-empty
 * does. Escape passes through when a focused input/textarea/contenteditable
 * INSIDE the dialog owns the key.
 *
 * 261101-jmm view (exact law): watercolor is LIST FIRST. The ref-held
 * `settingsViewRef` defaults to 'list' and the stroke list stays visible while
 * strokes are selected; the Geometry/Stack tabs mount only after the header
 * toggle is clicked, and the same button (now a list icon) returns.
 * An EMPTY selection invalidates a pending settings request through the plain
 * `strokeSettingsViewInvalidated` marker — the `sawEmptySinceDismiss`
 * precedent, written idempotently in the render body — so a close/reopen, a
 * leave and re-enter of Move/Select, or a delete-to-empty always lands the
 * next non-empty selection back on the list. Brush keeps its tabs verbatim.
 *
 * Geometry: every row is a release-commit, free-entry SliderStepper. X/Y type
 * an absolute target and commit `target - live centre` in integer px; Scale /
 * Scale X / Scale Y / Rotation apply the delta from that row's last APPLIED
 * value (a refused commit keeps the previous session value). The session is
 * keyed by the selection Set, so a membership change re-baselines to identity.
 * Transforms anchor at the union-box centre of the selected strokes; nothing
 * persists.
 *
 * Stack (261024-vga): for a single selected stroke whose bundle provides
 * `reorderStroke`, a position row states where the stroke sits in the paint
 * order (1 = topmost, the badge law) and places it exactly there through the
 * bundle. The section owns NO stroke-list state. SliderStepper writes its
 * input's DOM value directly on commit and a re-render with an unchanged
 * `value` prop cannot rewrite it, so a ref-held nonce is the row's Preact key:
 * after every commit the input remounts at the live position (a refused
 * placement must never leave the typed value on screen). A ref-held
 * last-emitted guard collapses SliderStepper's Enter + blur pair into ONE
 * reorder call.
 */

interface DragOffset {
  readonly dxPx: number;
  readonly dyPx: number;
}

/**
 * 261024-vga UAT revision: the dialog's layout lives at module scope so it
 * survives selection changes, dismiss/reopen and module switches for the whole
 * Studio lifecycle. It resets only when this module unloads.
 */
const strokeSettingsDragOffset = signal<DragOffset | null>(null);
const strokeSettingsResizeHeight = signal<number | null>(null);

/**
 * Resets the module-level dialog SESSION state: the movable/resizable layout
 * plus the view-request invalidation marker (`strokeSettingsViewInvalidated`).
 * There is no production call site — a fresh mount reproduces this state.
 */
export function resetStrokeSettingsDialogLayout(): void {
  strokeSettingsDragOffset.value = null;
  strokeSettingsResizeHeight.value = null;
  strokeSettingsViewInvalidated = false;
}

interface DragStart {
  readonly pointerX: number;
  readonly pointerY: number;
  readonly baseX: number;
  readonly baseY: number;
  readonly rect: { left: number; top: number; width: number } | null;
}

type StrokeSettingsTab = 'geometry' | 'stack';

const STROKE_SETTINGS_TABS: ReadonlyArray<{ key: StrokeSettingsTab; label: string }> = [
  { key: 'geometry', label: 'Geometry' },
  { key: 'stack', label: 'Stack' },
];

/**
 * 261029-eur: the watercolor stroke-type filter row (All | Eraser | Paint).
 * The setter owns the selection pruning and the compare-then-write law, so
 * the row is pure chrome.
 */
const STROKE_TYPE_FILTERS: ReadonlyArray<{
  key: 'paint' | 'eraser' | 'all';
  label: string;
  filter: AquarelleStrokeTypeFilter;
}> = [
  { key: 'paint', label: 'Paint', filter: 'paint' },
  { key: 'eraser', label: 'Eraser', filter: 'lift' },
  { key: 'all', label: 'All', filter: 'all' },
];

const FILTER_ROW_STYLE: CSSProperties = {
  display: 'flex',
  gap: '4px',
  padding: '8px 12px 10px',
};

export interface PhysicsPaintStrokeSettingsDialogProps {
  /** The view-supplied bundle for the ACTIVE module; absent means no dialog. */
  bundle?: StrokeSettingsDialogBundle | null;
}

let sawEmptySinceDismiss = false;

/**
 * 261101-jmm: the settings-view request's staleness marker. A PLAIN
 * (non-signal) module flag, exactly like `sawEmptySinceDismiss`: written
 * idempotently in the render body when the selection is observed EMPTY under
 * a settings request, cleared ONLY by the header toggle's click handler (the
 * one explicit settings entry) and by `resetStrokeSettingsDialogLayout`. It
 * notifies no subscriber, so it can never drive a reactive loop.
 */
let strokeSettingsViewInvalidated = false;

/**
 * 61-11 (T-61-37): the path-edit exit request marker. A PLAIN (non-signal)
 * module flag of the same kind: the render body only DECIDES that the open
 * path edit no longer matches the selection, and the shipped lifecycle effect
 * performs the ONE session write. A signal write here would break
 * `efx-preact-reactivity` rule 6; a second effect would break the sheet's
 * fixed hook order.
 */
let pathEditExitRequested = false;

/** Distance from the canvas region's top/right edges. */
const SURFACE_INSET_PX = 12;

const SURFACE_STYLE: CSSProperties = {
  position: 'absolute',
  top: `${SURFACE_INSET_PX}px`,
  right: `${SURFACE_INSET_PX}px`,
  width: '320px',
  // A definite height is required: the SidebarScrollArea root is a flex child
  // whose inner scroller is absolutely positioned, so an auto-height surface
  // would collapse its track to zero.
  height: 'min(520px, calc(100% - 24px))',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxSizing: 'border-box',
  padding: '0',
  borderRadius: '10px',
  border: '1px solid rgba(255, 255, 255, 0.09)',
  background: 'rgba(28, 30, 34, 0.9)',
  color: 'var(--sidebar-text-primary, #eceff2)',
  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  pointerEvents: 'auto',
};

const SCROLL_CONTENT_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  padding: '10px 12px 0',
};

/** One tab's content: 15px rhythm between its rows. */
const SECTION_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '15px',
};

const PAINT_ROW_LABEL_STYLE: CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--sidebar-text-secondary, #9aa5b1)',
};

const SEGMENT_LABEL_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  marginBottom: '4px',
};

/** 261024-p5q UAT: a mixed readout is red, never the quiet gray. */
const MIXED_CAPTION_STYLE: CSSProperties = {
  fontSize: '10px',
  fontStyle: 'italic',
  color: '#ef4444',
};

/** 61-11 (E4 empty): the Anchor width block's quiet caption under the row. */
const ANCHOR_WIDTH_CAPTION_STYLE: CSSProperties = {
  display: 'block',
  marginTop: '4px',
  fontSize: '10px',
  fontWeight: 600,
  color: 'var(--sidebar-text-secondary, #9aa5b1)',
};

/**
 * 61-25 (UI-02): the `→ {n} px` readout rides the BrushResponsePanel
 * multiplier grammar — 10px, 600, secondary text, tabular figures and nothing
 * else. A declared constant keeps the four properties from drifting inline.
 */
const ANCHOR_WIDTH_READOUT_STYLE: CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  color: 'var(--sidebar-text-secondary, #9aa5b1)',
  fontVariantNumeric: 'tabular-nums',
};

const SEGMENT_GROUP_STYLE: CSSProperties = {
  display: 'flex',
  gap: '4px',
};

const SEGMENT_STYLE: CSSProperties = {
  flex: '1 1 0',
  height: '20px',
  padding: '0',
  borderRadius: '3px',
  border: '1px solid var(--sidebar-border-unselected, rgba(159, 165, 174, 0.55))',
  background: 'transparent',
  color: 'var(--sidebar-text-secondary, #9aa5b1)',
  fontSize: '10px',
  cursor: 'pointer',
};

const SEGMENT_ACTIVE_STYLE: CSSProperties = {
  background: 'var(--color-accent, #2f67e8)',
  borderColor: 'var(--color-accent, #2f67e8)',
  color: '#ffffff',
};

/**
 * 261031-euf: the type-filter row is sentence case — the global button rule
 * uppercases every other segmented control, so the filter row gets its own
 * copy instead of changing Stack.
 */
const FILTER_SEGMENT_STYLE: CSSProperties = {
  ...SEGMENT_STYLE,
  textTransform: 'none',
};

const FILTER_SEGMENT_ACTIVE_STYLE: CSSProperties = {
  ...SEGMENT_ACTIVE_STYLE,
  textTransform: 'none',
};

const FINE_FILTERS_ROW_STYLE: CSSProperties = {
  display: 'flex',
  gap: '6px',
  padding: '0 12px 10px',
};

const LIST_SUMMARY_STYLE: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '10px',
  color: 'var(--sidebar-text-secondary, #9aa5b1)',
  fontVariantNumeric: 'tabular-nums',
};

/** The Stack identity row: colour dot, serial, public position. */
const STACK_HEADER_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const STACK_DOT_STYLE: CSSProperties = {
  flex: '0 0 10px',
  width: '10px',
  height: '10px',
  borderRadius: '2px',
  border: '1px solid rgba(255, 255, 255, 0.25)',
};

const STACK_SERIAL_STYLE: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '10px',
  color: 'var(--sidebar-text-secondary, #9aa5b1)',
  fontVariantNumeric: 'tabular-nums',
};

const STACK_NEIGHBOURS_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '10px',
  color: 'var(--sidebar-text-secondary, #9aa5b1)',
  fontVariantNumeric: 'tabular-nums',
};

const RESIZE_HANDLE_STYLE: CSSProperties = {
  flex: '0 0 12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'ns-resize',
  touchAction: 'none',
};

const RESIZE_GRIP_STYLE: CSSProperties = {
  width: '34px',
  height: '3px',
  borderRadius: '2px',
  background: 'rgba(255, 255, 255, 0.22)',
};

export function PhysicsPaintStrokeSettingsDialog({
  bundle,
}: PhysicsPaintStrokeSettingsDialogProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<DragStart | null>(null);
  const resizeStartRef = useRef<{ pointerY: number; height: number; max: number } | null>(null);
  /**
   * The geometry session, keyed by the selection Set instance. A different
   * selection simply resolves FRESH — no render-body signal write, and a new
   * membership always re-baselines to 100% / 0 degrees.
   */
  const geometrySessionRef = useRef<Signal<{ selection: ReadonlySet<number>; session: StrokeGeometrySession } | null> | null>(null);
  if (!geometrySessionRef.current) geometrySessionRef.current = signal(null);
  /**
   * 261024-vga: the Stack row's remount nonce (ref-held signal, read in the
   * render body). Bumped after every attempted placement so the keyed input
   * remounts and rewrites its DOM value from the live position.
   */
  const stackSyncRef = useRef<Signal<number> | null>(null);
  if (!stackSyncRef.current) stackSyncRef.current = signal(0);
  /** Collapses SliderStepper's Enter + blur pair into ONE reorder call. */
  const lastStackEmitRef = useRef<number | null>(null);
  /** 261024-vga UAT revision: the active section tab (ref-held, Geometry default). */
  const settingsTabRef = useRef<Signal<StrokeSettingsTab> | null>(null);
  if (!settingsTabRef.current) settingsTabRef.current = signal<StrokeSettingsTab>('geometry');
  /**
   * 261101-jmm: which surface the sheet shows. Ref-held like the tab signal and
   * written ONLY from the header toggle's click handler (compare-then-write) —
   * the empty-selection fallback is a pure render derivation, never a write.
   */
  const settingsViewRef = useRef<Signal<StrokeSettingsView> | null>(null);
  if (!settingsViewRef.current) settingsViewRef.current = signal<StrokeSettingsView>('list');
  /**
   * 261101-jmm: the Shift-range anchor, held as the DISPLAYED row index (the
   * StrokeList law). Set by a plain or Cmd/Ctrl click, never by Shift itself.
   */
  const rowAnchorRef = useRef<number>(-1);
  /** 261101-o2m: the previous render's `open` — the dialog-close exit edge. */
  const wasOpenRef = useRef(false);
  const selection = scriptSelectedStrokeIds.value;
  const engineModule = bundle?.module ?? 'brush';
  const surfaceActive = bundle !== null && bundle !== undefined
    ? (engineModule === 'watercolor' ? scriptSelectMode.value : bundle.brushMoveActive)
    : false;
  // 261029-eur: the dismissal flag is module-level so the select-mode choke
  // point can re-arm it on a genuine off -> on edge. Watercolor Edit mode
  // keeps the sheet open on an empty selection (filter row + caption).
  const dismissed = aquarelleStrokeSettingsDismissed.value;
  const strokeTypeFilter = aquarelleStrokeTypeFilter.value;
  // 261031-euf: the list's finer filters (display-only). Render-body READS
  // only — the EFFECTIVE values below are derived, never written back, so a
  // stored filter the rows do not offer renders All without a state write.
  const strokeToolFilter = aquarelleStrokeToolFilter.value;
  const strokeTipFilter = aquarelleStrokeTipFilter.value;
  // 261101-mvg: the "Preview stroke size" switch. A session-only VIEW
  // preference (never a document edit, never undoable) read by this header
  // leaf and the overlay leaf — never the Studio render body.
  const previewStrokeSize = strokeSizePreview.value;
  // 261101-o2m: the Move/Edit Draft switch. A session-only VIEW mode (never a
  // document edit, never undoable) read by this strip leaf — never the Studio
  // render body.
  const draftOn = draftMode.value;
  // 61-13 (D-16): wireframe OWNS the Draft — ON forces it on, OFF settles it.
  // The switch stays visibly ON but inert, so no second route out can race the
  // wireframe's single-flight settle.
  const wireframeOn = wireframeMode.value;
  // 261101-o2m (D-02): the cache eye — a display-only VIEW preference read by
  // this strip leaf and the cached-base leaf. It never gates a commit, a
  // capture, a save or an export.
  const cacheVisible = frozenCacheVisible.value;
  const keepOpenOnEmpty = bundle?.keepOpenOnEmpty ?? engineModule === 'watercolor';
  const stackSyncNonce = stackSyncRef.current.value;

  // 61-11 (E2 / T-61-37): the Edit path gate. Computed BEFORE the early return
  // so a CLOSED sheet still observes the gate closing — the ordering law the
  // settings-view marker below already follows. `vectorStrokeCount` is a bundle
  // READ (the Studio owns the record seam); a single non-vector selection
  // resolves 0 and the entry point explains why it is disabled. Reading the
  // session id here is what makes `aria-pressed` live.
  const selectedMutationId = selection.size === 1 ? ([...selection][0] ?? null) : null;
  const selectedVectorAnchors = selectedMutationId !== null && engineModule === 'watercolor'
    ? (bundle?.readVectorAnchors?.([selectedMutationId]) ?? null)
    : null;
  const pathEditGate = resolvePathEditGate({
    selectionSize: selection.size,
    vectorStrokeCount: selectedVectorAnchors !== null ? 1 : 0,
    selectedMutationId,
    pathEditMutationId: pathEditMutationId.value,
  });
  const pathEditGateEnabled = pathEditGate.enabled;

  // Plain (non-signal) render-body flag write — the dismissal edge marker.
  // Inert under keepOpenOnEmpty (shouldMarkSawEmpty returns false there).
  if (
    shouldMarkSawEmpty({
      dismissed,
      surfaceActive,
      selectionSize: selection.size,
      keepOpenOnEmpty,
    })
  ) {
    sawEmptySinceDismiss = true;
  }

  // Plain (non-signal) render-body flag write — the settings-request
  // staleness marker. Inert for brush and for every list-first render (only a
  // still-pending 'settings' request over an EMPTY selection arms it). Sits
  // BEFORE the early return so a CLOSED sheet still observes the empty edge:
  // the close path leaves Move/Select, which clears the selection, so the
  // request can never survive a close/reopen cycle.
  const requestedView = settingsViewRef.current.value;
  if (
    engineModule === 'watercolor'
    && shouldInvalidateStrokeSettingsView({
      requested: requestedView,
      selectionSize: selection.size,
    })
  ) {
    strokeSettingsViewInvalidated = true;
  }
  // 61-11 (T-61-37): the path-edit exit guard — a plain marker write, never a
  // session write from the render body. Sits BEFORE the early return so a
  // CLOSED sheet still observes the gate closing, and it covers every route
  // out of the mode: deletion, a re-selection, a filter that empties, and the
  // rail-toggle close. The shipped lifecycle effect performs the write.
  const pathEditActive = pathEditMutationId.value !== null;
  // 61-27 (WR-04): the gate stays ENABLED while any one vector stroke is
  // selected, so a bare "gate closed" exit let an open edit on stroke A
  // survive a click on stroke B. This render-body marker is the dependency
  // that changes when the edit's target and the selection disagree — without
  // it the exit marker below would never reach the ONE lifecycle effect.
  const pathEditTargetMismatch = selectedMutationId === null
    || String(selectedMutationId) !== pathEditMutationId.value;
  if (shouldExitPathEdit({
    pathEditActive,
    gateEnabled: pathEditGateEnabled,
    selectedMutationId,
    pathEditMutationId: pathEditMutationId.value,
  })) {
    pathEditExitRequested = true;
  }

  const effectiveRequest: StrokeSettingsView = strokeSettingsViewInvalidated
    ? 'list'
    : requestedView;
  /**
   * Brush keeps today's sheet verbatim (its tabs are not a user request);
   * watercolor is LIST FIRST with an explicit settings mode.
   */
  const view: StrokeSettingsView = engineModule === 'watercolor'
    ? resolveStrokeSettingsView(effectiveRequest, selection.size)
    : 'settings';

  const open = bundle !== null
    && bundle !== undefined
    && resolveStrokeSettingsOpen({
      surfaceActive,
      selectionSize: selection.size,
      dismissed,
      sawEmptySinceDismiss,
      keepOpenOnEmpty,
    });

  /**
   * 261024-vga UAT: close = LEAVE Move/Select (restore the previous tool) so
   * the next stroke selection re-opens the sheet. The legacy sticky dismissal
   * remains only for a bundle without `closeMoveMode`.
   */
  const closeMoveMode = bundle?.closeMoveMode;
  const closeSurface = useCallback(() => {
    // 61-11 (T-61-37): closing the sheet can never leave an open path edit
    // pointing at a stroke nobody is looking at. Session state only — the
    // anchor selection drops with the edit inside the same action.
    exitPathEdit();
    if (closeMoveMode) {
      closeMoveMode();
      return;
    }
    // EVENT-handler write (never a render body). The ONLY reset site is the
    // setAquarelleSelectMode off -> on choke point.
    aquarelleStrokeSettingsDismissed.value = true;
    sawEmptySinceDismiss = false;
  }, [closeMoveMode]);

  // 261029-hy2 CR-01: this sheet opens from the SELECTION — there is no open
  // handler to raise from — so the open transition itself is the raise seam.
  // A lifecycle effect, never a render body (efx-preact-reactivity rule 6).
  useEffect(() => {
    // 261101-o2m (D-04): the dialog-close recompute exit. X, Escape and the
    // rail-toggle close all land here — the sheet never writes the Draft
    // signal itself, so a dirty Draft is settled, never silently dropped.
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (wasOpen && !open) void bundle?.settleDraft?.();
    // 61-11 (T-61-37): consume the render body's exit marker. This effect is
    // the ONE performer of the session write; a marker that is already clear
    // writes nothing, and the actions themselves are compare-then-write, so a
    // repeated close notifies no subscriber.
    if (pathEditExitRequested) {
      pathEditExitRequested = false;
      exitPathEdit();
    }
    if (!open) {
      // A closed sheet must leave the order — a stale front id would make the
      // front-only Escape gate inert for every sheet that is still open.
      releaseSheet(SHEET_ID_STROKE_SETTINGS);
      return;
    }
    bringSheetToFront(SHEET_ID_STROKE_SETTINGS);
    // 61-27 (WR-04): `pathEditTargetMismatch` is what re-runs this effect when
    // two SINGLE vector strokes swap — `pathEditGateEnabled` never changes on
    // that edge, which is exactly why the exit never fired.
  }, [open, bundle, pathEditGateEnabled, pathEditTargetMismatch]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const target = event.target as {
        closest?: (selector: string) => unknown;
      } | null;
      const editable = target?.closest?.('input, textarea, [contenteditable="true"]');
      if (editable) {
        const insideDialog = (editable as { closest?: (selector: string) => unknown })
          .closest?.('[data-testid="stroke-settings-dialog"]');
        if (insideDialog) return;
      }
      // 261029-hy2 WR-03: front-only dismissal — a background stroke sheet
      // must not swallow the Escape that belongs to the front sheet.
      if (!closeSheetIfFront(SHEET_ID_STROKE_SETTINGS, closeSurface)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, closeSurface]);

  if (!bundle || !open) return null;

  // 261101-jmm: the bundle's delete path — present on watercolor (the Studio
  // passes the SAME handler as Backspace/Delete). Absent hides both trashes.
  const deleteStrokes = bundle.deleteStrokes;
  const requestedSettingsTab = settingsTabRef.current.value;
  const stackTabAvailable = Boolean(bundle.reorderStroke);
  const strokes = bundle.listStrokes(bundle.playFrame, bundle.canvasSize);
  // 261031-euf: the Studio lists the WHOLE frame (default 'all'), so the
  // dialog applies the shared type filter itself and shows the rows
  // topmost-first. Pure derivations — no state, no signal writes.
  const typeRows = strokes.filter((stroke) => matchesStrokeTypeFilter(stroke, strokeTypeFilter));
  // Tool options come from the TYPE-filtered rows and tip options from the
  // TOOL-filtered rows (checker advisory): the dropdowns can never offer a
  // combination that yields zero rows.
  const toolOptions = listStrokeToolOptions(typeRows);
  const effectiveTool = resolveStrokeToolFilter(strokeToolFilter, toolOptions);
  const toolRows = filterStrokeListRows(typeRows, { tool: effectiveTool, tip: 'all' });
  const tipOptions = listStrokeTipOptions(toolRows);
  const effectiveTip = resolveStrokeTipFilter(
    strokeTipFilter,
    tipOptions.map((option) => option.brushId),
  );
  const listRows = sortStrokesTopmostFirst(
    filterStrokeListRows(typeRows, { tool: effectiveTool, tip: effectiveTip }),
  );
  // 261101-jmm: the Shift range walks the DISPLAYED order, so the ids are read
  // from the rendered rows (never from the selection's insertion order).
  const displayedIds = listRows.map((stroke) => stroke.mutationId);
  const listSummary = strokeListSummary(bundle.playFrame, strokes);
  // quick 261111-vg4: the tab set is FIXED — Geometry | Stack. No filter or
  // selection state can surface a third tab; only Stack steps aside without a
  // `reorderStroke` seam, and a requested Stack then falls back to Geometry.
  const activeSettingsTab: StrokeSettingsTab = requestedSettingsTab === 'stack' && !stackTabAvailable
    ? 'geometry'
    : requestedSettingsTab;

  const ids = [...selection];
  const appearances = bundle.readAppearance(ids, bundle.playFrame);

  const fields = strokeSettingsFields(engineModule);
  /**
   * Brush only: Opacity is a real composited alpha and leads Geometry.
   * Water color has no global opacity — its canonical Pigment (`load`) is
   * edited from the sidebar Paint tab, so Geometry does not mirror it under
   * the name Opacity.
   */
  const opacityField = engineModule === 'watercolor'
    ? undefined
    : fields.find((field) => field.key === 'opacity');
  const numericFields = fields.filter((field) => field.kind === 'numeric');
  const opacityReading = opacityField ? readNumericField(appearances, ids, opacityField) : null;
  // 261031-cf9: the switch is watercolor-only and derived from the salt each
  // appearance carries — never a second boolean.
  const paintSeedVariationActive = readPaintSeedVariation(appearances);

  // 61-11 (VEC-03 / E4): the per-vertex width control. The anchors are the
  // SAME bundle read the header gate uses, the anchor selection is the
  // overlay's ONE signal, and the px readout multiplies the stroke's REAL Size
  // by the anchor factor — never `scriptScale` (T-61-39). Mounted only for a
  // single vector stroke whose bundle can commit the widths.
  // 61-19 (G-5): the commit targets the OPEN path edit's stroke, so a null
  // target reads as EMPTY — the block is inert and its caption states why. The
  // target branches only on values this render body already reads.
  const anchorWidthTarget = resolveAnchorWidthTarget({
    ids,
    pathEditMutationId: pathEditMutationId.value,
  });
  const anchorWidthReading = anchorWidthTarget === null
    ? ANCHOR_WIDTH_EMPTY_READING
    : readAnchorWidthReading(
      selectedVectorAnchors ?? [],
      vectorAnchorSelection.value,
    );
  const anchorWidthAvailable = engineModule === 'watercolor'
    && selectedVectorAnchors !== null
    && bundle.applyAnchorWidths !== undefined;
  // 61-22 (G-11): the ONE mount gate for BOTH Anchor width mounts — the
  // DEFAULT list view and the Geometry section. `anchorWidthAvailable` already
  // implies a SINGLE selected vector stroke — `selectedVectorAnchors` is
  // resolved only for `selection.size === 1` — so neither mount can address
  // another stroke's anchors (T-61-68). The Size reading rides the SAME ids in
  // both places, so the px readout cannot disagree between the two mounts.
  const anchorWidthSizeField = numericFields.find((field) => field.key === 'size');
  const anchorWidthSizeReading = anchorWidthSizeField === undefined
    ? null
    : readNumericField(appearances, ids, anchorWidthSizeField);
  const anchorWidthVisible = anchorWidthAvailable && anchorWidthSizeReading !== null;

  // 61-31 (G-20): the Curve row reading. Spline is an evaluation mode over the
  // same anchors, so only the VECTOR appearances participate. The row MOUNTS IN
  // GEOMETRY, after the transform rows.
  const curveModeReading = readCurveMode(appearances);

  const applied = strokeSettingsDragOffset.value;

  /**
   * Geometry is session-relative: the display states what the strokes LAST
   * received, so a refused commit (watercolor re-bake) never advances it.
   * The union box is computed from the SELECTED strokes of this frame only;
   * every transform anchors at its centre.
   */
  const geometryState = geometrySessionRef.current.value;
  const geometrySession = geometryState && geometryState.selection === selection
    ? geometryState.session
    : FRESH_STROKE_GEOMETRY_SESSION;
  const selectionBox = scriptStrokeSelectionBox(
    strokes.filter((stroke) => selection.has(stroke.mutationId)),
  );
  const liveCenter = selectionBox
    ? { x: selectionBox.x + selectionBox.width / 2, y: selectionBox.y + selectionBox.height / 2 }
    : null;

  /**
   * Stack placement is single-stroke only. Neighbours are derived from the
   * public position (1 = topmost), never from the listing order.
   */
  const stackStroke = selection.size === 1
    ? strokes.find((stroke) => stroke.mutationId === ids[0])
    : undefined;
  const stackAbove = stackStroke
    ? strokes.find((stroke) => stroke.stackPosition === stackStroke.stackPosition - 1)
    : undefined;
  const stackBelow = stackStroke
    ? strokes.find((stroke) => stroke.stackPosition === stackStroke.stackPosition + 1)
    : undefined;

  const commitStackPosition = (positionFromTop: number) => {
    const reorderStroke = bundle.reorderStroke;
    if (!reorderStroke || !stackStroke) return;
    const clamped = clampStackPosition(positionFromTop, stackStroke.stackTotal);
    // The live slot is not a commit — and it must never re-key the input.
    if (clamped === stackStroke.stackPosition) return;
    // Enter commits, then the blur it triggers commits again in the same tick.
    if (lastStackEmitRef.current === clamped) return;
    lastStackEmitRef.current = clamped;
    queueMicrotask(() => {
      if (lastStackEmitRef.current === clamped) lastStackEmitRef.current = null;
    });
    // Remount the position input at the LIVE position, even when the commit
    // was refused and the `value` prop is unchanged.
    stackSyncRef.current!.value += 1;
    void reorderStroke(stackStroke.mutationId, clamped);
  };

  const commitGeometryTransform = (control: StrokeGeometryControl, nextValue: number) => {
    if (!liveCenter) return;
    const result = geometryTransform(control, nextValue, geometrySession, liveCenter);
    if (!result) return;
    // Keyed by the captured selection: a membership change mid-flight leaves
    // the NEW selection on its fresh baseline instead of inheriting this one.
    const commitSelection = selection;
    void Promise.resolve(bundle.transformStrokes([...commitSelection], result.transform))
      .then((ok) => {
        if (!ok) return;
        geometrySessionRef.current!.value = {
          selection: commitSelection,
          session: result.nextSession,
        };
      });
  };

  const commitGeometryMove = (axis: 'x' | 'y', nextValue: number) => {
    if (!liveCenter) return;
    const target = axis === 'x'
      ? { x: nextValue, y: liveCenter.y }
      : { x: liveCenter.x, y: nextValue };
    const delta = geometryMoveDelta(target, liveCenter);
    if (!delta) return;
    void Promise.resolve(bundle.moveStrokes(ids, delta.dxPx, delta.dyPx));
  };

  const onHeaderPointerDown = (event: TargetedPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const rect = surfaceRef.current?.getBoundingClientRect?.() ?? null;
    const base = strokeSettingsDragOffset.value;
    dragStartRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      baseX: base?.dxPx ?? 0,
      baseY: base?.dyPx ?? 0,
      rect: rect ? { left: rect.left, top: rect.top, width: rect.width } : null,
    };
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const onHeaderPointerMove = (event: TargetedPointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start) return;
    let nextX = start.baseX + (event.clientX - start.pointerX);
    let nextY = start.baseY + (event.clientY - start.pointerY);
    // Keep at least 80px visible horizontally and the header reachable.
    if (start.rect && typeof window !== 'undefined') {
      nextX = start.baseX + Math.min(
        Math.max(nextX - start.baseX, 80 - start.rect.width - start.rect.left),
        window.innerWidth - 80 - start.rect.left,
      );
      nextY = start.baseY + Math.min(
        Math.max(nextY - start.baseY, -start.rect.top),
        window.innerHeight - 48 - start.rect.top,
      );
    }
    strokeSettingsDragOffset.value = { dxPx: nextX, dyPx: nextY };
  };

  const endHeaderDrag = () => {
    dragStartRef.current = null;
  };

  const onResizePointerDown = (event: TargetedPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const rect = surfaceRef.current?.getBoundingClientRect?.();
    if (!rect) return;
    // Grow to the APP bottom, not the canvas region's: the sheet overlays the
    // region without being clipped by it.
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : rect.top + rect.height;
    resizeStartRef.current = {
      pointerY: event.clientY,
      height: rect.height,
      max: Math.max(240, viewportHeight - rect.top - SURFACE_INSET_PX),
    };
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const onResizePointerMove = (event: TargetedPointerEvent<HTMLDivElement>) => {
    const start = resizeStartRef.current;
    if (!start) return;
    const next = Math.min(start.max, Math.max(240, start.height + (event.clientY - start.pointerY)));
    strokeSettingsResizeHeight.value = next;
  };

  const endResize = () => {
    resizeStartRef.current = null;
  };

  const resizedHeight = strokeSettingsResizeHeight.value;

  return (
    <div
      ref={surfaceRef}
      data-testid="stroke-settings-dialog"
      role="dialog"
      aria-label="Stroke settings"
      // Capture phase: the Close button stops pointerdown propagation, and a
      // press on it must still raise the sheet.
      onPointerDownCapture={() => bringSheetToFront(SHEET_ID_STROKE_SETTINGS)}
      style={{
        ...SURFACE_STYLE,
        zIndex: sheetZIndex(SHEET_ID_STROKE_SETTINGS),
        height: resizedHeight === null ? SURFACE_STYLE.height : `${resizedHeight}px`,
        transform: `translate(${applied?.dxPx ?? 0}px, ${applied?.dyPx ?? 0}px)`,
      }}
    >
      <div
        class="physics-paint-photo-reference-header"
        data-testid="stroke-settings-header"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={endHeaderDrag}
        onPointerCancel={endHeaderDrag}
      >
        <SlidersHorizontal
          size={15}
          class="physics-paint-photo-reference-header-icon"
          aria-hidden="true"
        />
        <strong>Stroke settings</strong>
        <span class="physics-paint-photo-reference-header-spacer" aria-hidden="true" />
        {engineModule === 'watercolor' && deleteStrokes ? (
          <button
            type="button"
            data-testid="stroke-settings-delete-selection"
            class="physics-paint-stroke-settings-header-button"
            aria-label="Delete selected strokes"
            title="Delete selected strokes"
            // A per-row trash owns the single-stroke case.
            disabled={selection.size < 2}
            // The header is the drag handle (see Close below).
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              void deleteStrokes([...selection]);
            }}
          >
            <Trash2 size={12} aria-hidden="true" />
          </button>
        ) : null}
        {engineModule === 'watercolor' ? (
          <button
            type="button"
            data-testid="stroke-settings-preview-stroke-size"
            class="physics-paint-stroke-settings-header-button physics-paint-stroke-settings-preview-toggle"
            aria-pressed={previewStrokeSize}
            aria-label="Preview stroke size"
            title="Preview stroke size — draw every stroke as the area it covers"
            // A view preference, never a selection action: the swatch stays
            // clickable on an empty selection (only the surface gate hides it).
            // The header is the drag handle (see Close below).
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setStrokeSizePreview(!strokeSizePreview.peek())}
          >
            <Spline size={12} aria-hidden="true" />
          </button>
        ) : null}
        {engineModule === 'watercolor' ? (
          <button
            type="button"
            data-testid="stroke-settings-spline-pointer"
            class="physics-paint-stroke-settings-header-button physics-paint-stroke-settings-preview-toggle"
            aria-pressed={pathEditGate.pressed}
            aria-label="Edit path"
            title={pathEditGate.title}
            // 61-11 (E2): one vector stroke is the ONLY editable state. The
            // reason lives in `title` so this fixed 22x22 icon never renders
            // text, and a multi-selection states its own reason.
            disabled={!pathEditGate.enabled}
            // The header is the drag handle (see Close below).
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              // Pressed means the session already edits this stroke: the same
              // button leaves. Two distinct session actions, never a signal
              // write from this leaf.
              if (pathEditGate.pressed) {
                exitPathEdit();
                return;
              }
              const target = selectedMutationId;
              if (target === null) return;
              // Session action only: the Studio's overlay owns the record seam.
              enterPathEdit(String(target));
            }}
          >
            <SplinePointer size={12} aria-hidden="true" />
          </button>
        ) : null}
        {engineModule === 'watercolor' ? (
          <button
            type="button"
            data-testid="stroke-settings-view-toggle"
            class="physics-paint-stroke-settings-header-button"
            aria-pressed={view === 'settings'}
            aria-label={view === 'settings' ? 'Show stroke list' : 'Show stroke settings'}
            title={view === 'settings' ? 'Show stroke list' : 'Show stroke settings'}
            // Nothing to edit yet: the list is the only meaningful surface.
            disabled={selection.size === 0}
            // The header is the drag handle (see Close below).
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              const next: StrokeSettingsView = view === 'settings' ? 'list' : 'settings';
              // Entering settings is the ONE explicit request, so it is also
              // the only place the staleness marker clears (event-handler
              // write — the `sawEmptySinceDismiss = false` precedent).
              if (next === 'settings') strokeSettingsViewInvalidated = false;
              const ref = settingsViewRef.current!;
              if (ref.value !== next) {
                ref.value = next;
                return;
              }
              // An INVALIDATED request already holds the target value ('list'
              // shows while the signal still says 'settings'), so a plain
              // compare-then-write would notify nobody and this click would
              // look dead. Re-assert through the opposite value: both writes
              // run inside this handler and signals batch them into ONE render.
              if (view !== next) {
                ref.value = next === 'settings' ? 'list' : 'settings';
                ref.value = next;
              }
            }}
          >
            {view === 'settings'
              ? <List size={12} aria-hidden="true" />
              : <Settings2 size={12} aria-hidden="true" />}
          </button>
        ) : null}
        <button
          type="button"
          class="physics-paint-photo-reference-close"
          data-testid="stroke-settings-close"
          aria-label="Close"
          title="Close"
          // The header is the drag handle: its pointerdown captures the
          // pointer and calls preventDefault, which suppresses this button's
          // click. Stop the press here so Close stays clickable.
          onPointerDown={(event) => event.stopPropagation()}
          onClick={closeSurface}
        >
          <X size={12} aria-hidden="true" />
        </button>
      </div>

      {/* 261101-o2m (D-01): the Draft strip sits below the header icon row and
          ABOVE the list/settings view gate, so it is reachable from both. The
          switch's OFF click is ROUTED to the bundle's settle — a dirty Draft
          may only leave through its recompute, never a raw signal write. */}
      {engineModule === 'watercolor' ? (
        <div
          class="physics-paint-stroke-settings-draft-row"
          data-testid="stroke-settings-draft-row"
        >
          <span class="physics-paint-stroke-settings-draft-row-label">Draft</span>
          <button
            type="button"
            data-testid="stroke-settings-draft-switch"
            role="switch"
            aria-checked={draftOn ? 'true' : 'false'}
            aria-label="Draft"
            title={wireframeOn
              ? 'Draft — on while wireframe is on. Turn wireframe off to re-render.'
              : 'Draft — suspend the watercolor re-render until you turn it off'}
            class={`physics-paint-script-switch${draftOn ? ' is-on' : ''}`}
            disabled={wireframeOn}
            // The header is the drag handle: the press must not start one.
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              // 61-13: the wireframe owns the one route out of Draft.
              if (wireframeMode.peek()) return;
              // OFF is routed, never written: the settle clears the invariant
              // and then flips the mode (a bundle without one leaves Draft ON).
              if (draftMode.peek()) {
                void bundle.settleDraft?.();
                return;
              }
              // ON awaits the pre-edit base arming; a refused recovery leaves
              // the sheet Live with the Studio's reason surfaced.
              if (!bundle.armDraft) {
                setDraftMode(true);
                return;
              }
              void bundle.armDraft().then((armed) => {
                if (armed) setDraftMode(true);
              });
            }}
          >
            <span class="physics-paint-script-switch-track" aria-hidden="true">
              <span class="physics-paint-script-switch-knob" />
            </span>
          </button>
          <span class="physics-paint-stroke-settings-draft-row-spacer" aria-hidden="true" />
          {/* 261101-o2m (D-02): the cache eye — ALWAYS available (Draft and
              Live, both views, never disabled). Display-only: it hides the
              committed sheet through a CSS modifier, so the decode cache stays
              warm and no capture, save or export ever reads it. */}
          <span class="physics-paint-stroke-settings-draft-row-label">cache</span>
          <button
            type="button"
            data-testid="stroke-settings-cache-visibility"
            class="physics-paint-stroke-settings-header-button"
            aria-pressed={cacheVisible}
            aria-label="Show or hide the committed sheet"
            title={cacheVisible
              ? 'Hide the committed sheet'
              : 'Show the committed sheet'}
            // The header is the drag handle: the press must not start one.
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setFrozenCacheVisible(!frozenCacheVisible.peek())}
          >
            {cacheVisible
              ? <Eye size={12} aria-hidden="true" />
              : <EyeOff size={12} aria-hidden="true" />}
          </button>
        </div>
      ) : null}

      {engineModule === 'watercolor' && view === 'list' ? (
        <div
          role="group"
          aria-label="Stroke type"
          data-testid="stroke-settings-filter"
          style={FILTER_ROW_STYLE}
        >
          {STROKE_TYPE_FILTERS.map((option) => {
            const active = strokeTypeFilter === option.filter;
            return (
              <button
                key={option.key}
                type="button"
                data-testid={`stroke-settings-filter-${option.key}`}
                aria-pressed={active}
                style={active
                  ? { ...FILTER_SEGMENT_STYLE, ...FILTER_SEGMENT_ACTIVE_STYLE }
                  : FILTER_SEGMENT_STYLE}
                onClick={() => setAquarelleStrokeTypeFilter(option.filter)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {engineModule === 'watercolor' && view === 'list' ? (
        <div data-testid="stroke-settings-fine-filters" style={FINE_FILTERS_ROW_STYLE}>
          <select
            class="physics-paint-stroke-settings-select"
            data-testid="stroke-settings-tool-filter"
            aria-label="Tool filter"
            value={effectiveTool}
            onChange={(event) => {
              const nextTool = event.currentTarget.value as AquarelleStrokeToolFilter;
              // The tip is judged against the NEW tool's rows, so an orphaned
              // recorded tip falls back to All in the same gesture.
              const nextTipIds = listStrokeTipOptions(
                filterStrokeListRows(typeRows, { tool: nextTool, tip: 'all' }),
              ).map((option) => option.brushId);
              setAquarelleStrokeTipFilter(
                resolveStrokeTipFilter(aquarelleStrokeTipFilter.value, nextTipIds),
              );
              setAquarelleStrokeToolFilter(nextTool);
            }}
          >
            <option value="all">{ALL_TOOL_FILTER_LABEL}</option>
            {toolOptions.map((tool) => (
              <option key={tool} value={tool}>{strokeToolLabel(tool)}</option>
            ))}
          </select>
          {tipOptions.length > 1 ? (
            <select
              class="physics-paint-stroke-settings-select"
              data-testid="stroke-settings-tip-filter"
              aria-label="Tip filter"
              value={effectiveTip}
              onChange={(event) => setAquarelleStrokeTipFilter(event.currentTarget.value)}
            >
              <option value="all">{ALL_TIP_FILTER_LABEL}</option>
              {tipOptions.map((option) => (
                <option key={option.brushId} value={option.brushId}>{option.name}</option>
              ))}
            </select>
          ) : null}
        </div>
      ) : null}

      {view === 'settings' ? (
        <div
          class="physics-paint-options-tabs physics-paint-stroke-settings-tabs"
          role="tablist"
          aria-label="Stroke settings sections"
          data-testid="stroke-settings-tabs"
        >
          {STROKE_SETTINGS_TABS.map((tab) => {
            if (tab.key === 'stack' && !stackTabAvailable) return null;
            const active = activeSettingsTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                data-testid={`stroke-settings-tab-${tab.key}`}
                aria-selected={active}
                class={`physics-paint-options-tab${active ? ' active' : ''}`}
                onClick={() => {
                  settingsTabRef.current!.value = tab.key;
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <SidebarScrollArea class="physics-paint-stroke-settings-scroll" interactive>
        <div style={SCROLL_CONTENT_STYLE}>
          {view === 'list' ? (
            <div
              data-testid="stroke-settings-list"
              class="physics-paint-stroke-settings-list"
            >
              <span data-testid="stroke-settings-list-summary" style={LIST_SUMMARY_STYLE}>
                {listSummary}
              </span>
              {strokes.length === 0 ? (
                <span data-testid="stroke-settings-list-empty-frame" style={PAINT_ROW_LABEL_STYLE}>
                  No strokes on this frame.
                </span>
              ) : listRows.length === 0 ? (
                <span data-testid="stroke-settings-list-empty-filter" style={PAINT_ROW_LABEL_STYLE}>
                  No strokes match this filter.
                </span>
              ) : listRows.map((stroke, index) => {
                const typeLabel = strokeToolLabel(stroke.tool);
                const tipName = resolveStrokeTipName(stroke.brushId);
                const selected = selection.has(stroke.mutationId);
                return (
                  <div
                    key={stroke.mutationId}
                    data-testid={`stroke-settings-row-${stroke.mutationId}`}
                    class={`physics-paint-stroke-settings-list-item${selected ? ' is-selected' : ''}`}
                    onClick={(event) => {
                      // The StrokeList multi-select law, on the ONE shared
                      // selection signal: plain replaces, Cmd/Ctrl toggles,
                      // Shift takes the inclusive displayed range from the
                      // last plain/Cmd click. Shift without an anchor is a
                      // plain click. No move code lives here — the canvas
                      // drag, transform handles and Geometry rows already
                      // operate on the whole selection.
                      //
                      // The CARD owns the press (the StrokeList precedent) so
                      // the serial, which sits outside the button past the
                      // trash, still selects: a button press bubbles up here
                      // and the trash stops its own.
                      if (event.shiftKey && rowAnchorRef.current >= 0) {
                        setAquarelleStrokeSelection(
                          resolveStrokeListRange(displayedIds, rowAnchorRef.current, index),
                        );
                        return;
                      }
                      if (event.metaKey || event.ctrlKey) {
                        toggleAquarelleStrokeSelection(stroke.mutationId);
                        rowAnchorRef.current = index;
                        return;
                      }
                      selectAquarelleStroke(stroke.mutationId);
                      rowAnchorRef.current = index;
                    }}
                  >
                    <button
                      type="button"
                      data-testid={`stroke-settings-stroke-${stroke.mutationId}`}
                      aria-label={`${typeLabel} stroke #${stroke.serial}, ${tipName}, position ${stroke.stackPosition} of ${stroke.stackTotal}`}
                      class="physics-paint-stroke-settings-list-row"
                      style={{ textTransform: 'none' }}
                    >
                      <span
                        data-testid="stroke-settings-stroke-dot"
                        class="physics-paint-stroke-settings-list-dot"
                        style={{ backgroundColor: stroke.color }}
                      />
                      <span
                        data-testid="stroke-settings-stroke-type"
                        class="physics-paint-stroke-settings-list-type"
                      >
                        {typeLabel}
                      </span>
                      <span class="physics-paint-stroke-settings-list-meta">
                        <span
                          data-testid="stroke-settings-stroke-position"
                          class="physics-paint-stroke-settings-list-position"
                        >
                          {`${stroke.stackPosition}/${stroke.stackTotal}`}
                        </span>
                        <span
                          data-testid="stroke-settings-stroke-tip"
                          class="physics-paint-stroke-settings-list-tip"
                        >
                          {tipName}
                        </span>
                        {stroke.customResponse ? (
                          <span
                            data-testid="stroke-settings-stroke-custom"
                            class="physics-paint-stroke-settings-list-custom"
                          >
                            Custom response
                          </span>
                        ) : null}
                      </span>
                    </button>
                    {deleteStrokes ? (
                      <button
                        type="button"
                        data-testid={`stroke-settings-row-delete-${stroke.mutationId}`}
                        class="physics-paint-stroke-settings-list-row-delete"
                        aria-label={`Delete stroke #${stroke.serial}`}
                        title={`Delete stroke #${stroke.serial}`}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          // Sibling of the row button: never let the press
                          // reach the selectable row, and run NO selection
                          // setter — the delete path owns the outcome.
                          event.stopPropagation();
                          void deleteStrokes([stroke.mutationId]);
                        }}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    ) : null}
                    <span
                      data-testid="stroke-settings-stroke-serial"
                      class="physics-paint-stroke-settings-list-serial"
                    >
                      {`#${stroke.serial}`}
                    </span>
                  </div>
                );
              })}
              {/* 61-22 (G-11): the DEFAULT list view surfaces the SAME Anchor
                  width control for exactly one selected vector stroke. The
                  conditional mount leaves no empty node when the gate closes
                  (multi-selection or a stroke without anchors). */}
              {anchorWidthVisible && anchorWidthSizeReading !== null ? (
                <div data-testid="stroke-settings-list-anchor-width">
                  <AnchorWidthControl
                    bundle={bundle}
                    ids={ids}
                    reading={anchorWidthSizeReading}
                    anchorWidthReading={anchorWidthReading}
                    anchorWidthTarget={anchorWidthTarget}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <>
          {activeSettingsTab === 'geometry' ? (
            liveCenter ? (
              <div style={SECTION_STYLE} data-testid="stroke-settings-geometry">
              {engineModule === 'watercolor' ? (
                <div data-testid="stroke-settings-paint-seed-variation">
                  <button
                    type="button"
                    class={`physics-paint-script-switch${paintSeedVariationActive ? ' is-on' : ''}`}
                    role="switch"
                    aria-checked={paintSeedVariationActive ? 'true' : 'false'}
                    title={paintSeedVariationActive
                      ? 'Paint seed variation on — every committed re-bake re-rolls the paint texture'
                      : 'Paint seed variation — re-roll the paint texture on every committed re-bake'}
                    onClick={() => {
                      void bundle.applyAppearance(
                        ids,
                        buildPaintSeedVariationPatch(!paintSeedVariationActive),
                      );
                    }}
                  >
                    <span class="physics-paint-script-switch-track" aria-hidden="true">
                      <span class="physics-paint-script-switch-knob" />
                    </span>
                    <span class="physics-paint-script-switch-label">Paint seed variation</span>
                  </button>
                </div>
              ) : null}
              {opacityField && opacityReading ? (
                <div data-testid="stroke-settings-geometry-opacity">
                  <SliderStepper
                    label="Opacity"
                    ariaLabel="Opacity"
                    value={opacityReading.value}
                    min={opacityField.min}
                    max={opacityField.max}
                    step={opacityField.step}
                    mixed={opacityReading.mixed}
                    commitOnRelease
                    allowOutOfRangeEntry
                    onChange={(value) => {
                      void bundle.applyAppearance(
                        ids,
                        buildAppearancePatch(engineModule, opacityField.key, value),
                      );
                    }}
                  />
                </div>
              ) : null}
              <div data-testid="stroke-settings-geometry-x">
                <SliderStepper
                  label="X"
                  ariaLabel="X"
                  value={Math.round(liveCenter.x)}
                  min={STROKE_POSITION_RANGE.min}
                  max={STROKE_POSITION_RANGE.max}
                  step={1}
                  freeEntry
                  commitOnRelease
                  allowOutOfRangeEntry
                  onChange={(value) => commitGeometryMove('x', value)}
                />
              </div>
              <div data-testid="stroke-settings-geometry-y">
                <SliderStepper
                  label="Y"
                  ariaLabel="Y"
                  value={Math.round(liveCenter.y)}
                  min={STROKE_POSITION_RANGE.min}
                  max={STROKE_POSITION_RANGE.max}
                  step={1}
                  freeEntry
                  commitOnRelease
                  allowOutOfRangeEntry
                  onChange={(value) => commitGeometryMove('y', value)}
                />
              </div>
              <div data-testid="stroke-settings-geometry-scale">
                <SliderStepper
                  label="Scale"
                  ariaLabel="Scale"
                  value={geometrySession.uniformPct}
                  min={STROKE_SCALE_RANGE.min}
                  max={STROKE_SCALE_RANGE.max}
                  step={1}
                  freeEntry
                  commitOnRelease
                  allowOutOfRangeEntry
                  onChange={(value) => commitGeometryTransform('uniform', value)}
                />
              </div>
              <div data-testid="stroke-settings-geometry-scale-x">
                <SliderStepper
                  label="Scale X"
                  ariaLabel="Scale X"
                  value={geometrySession.scaleXPct}
                  min={STROKE_SCALE_RANGE.min}
                  max={STROKE_SCALE_RANGE.max}
                  step={1}
                  freeEntry
                  commitOnRelease
                  allowOutOfRangeEntry
                  onChange={(value) => commitGeometryTransform('scaleX', value)}
                />
              </div>
              <div data-testid="stroke-settings-geometry-scale-y">
                <SliderStepper
                  label="Scale Y"
                  ariaLabel="Scale Y"
                  value={geometrySession.scaleYPct}
                  min={STROKE_SCALE_RANGE.min}
                  max={STROKE_SCALE_RANGE.max}
                  step={1}
                  freeEntry
                  commitOnRelease
                  allowOutOfRangeEntry
                  onChange={(value) => commitGeometryTransform('scaleY', value)}
                />
              </div>
              <div data-testid="stroke-settings-geometry-rotation">
                <SliderStepper
                  label="Rotation"
                  ariaLabel="Rotation"
                  value={geometrySession.rotationDeg}
                  min={STROKE_ROTATION_RANGE.min}
                  max={STROKE_ROTATION_RANGE.max}
                  step={1}
                  freeEntry
                  commitOnRelease
                  allowOutOfRangeEntry
                  onChange={(value) => commitGeometryTransform('rotation', value)}
                />
              </div>
              {/* 61-22 (G-11): Geometry carries the SAME Anchor width control
                  the list view mounts, under the transform rows. The shared
                  `anchorWidthVisible` gate leaves no empty node here either. */}
              {anchorWidthVisible && anchorWidthSizeReading !== null ? (
                <div data-testid="stroke-settings-geometry-anchor-width">
                  <AnchorWidthControl
                    bundle={bundle}
                    ids={ids}
                    reading={anchorWidthSizeReading}
                    anchorWidthReading={anchorWidthReading}
                    anchorWidthTarget={anchorWidthTarget}
                  />
                </div>
              ) : null}
              {/* 61-31 (G-20 / D-01 revised): the curve-evaluation switch.
                  Spline is a read-time view over the SAME anchors, so the row
                  mounts only when the selection holds a VECTOR stroke and the
                  bundle can commit — a hand-painted-only selection hides it
                  instead of writing an inert key. */}
              {engineModule === 'watercolor' && curveModeReading.available && bundle.applyCurveMode !== undefined ? (
                <div data-testid="stroke-settings-curve-mode-block">
                  <div style={SEGMENT_LABEL_ROW_STYLE}>
                    <span style={PAINT_ROW_LABEL_STYLE}>Curve</span>
                    {curveModeReading.mixed ? (
                      <span
                        data-testid="stroke-settings-curve-mode-mixed"
                        style={MIXED_CAPTION_STYLE}
                      >
                        Mixed
                      </span>
                    ) : null}
                  </div>
                  <div
                    role="group"
                    aria-label="Curve"
                    data-testid="stroke-settings-curve-mode"
                    style={SEGMENT_GROUP_STYLE}
                  >
                    {CURVE_MODE_OPTIONS.map((option) => {
                      const active = !curveModeReading.mixed && curveModeReading.mode === option.mode;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          data-testid={`stroke-settings-curve-mode-option-${option.id}`}
                          aria-pressed={active}
                          style={active ? { ...SEGMENT_STYLE, ...SEGMENT_ACTIVE_STYLE } : SEGMENT_STYLE}
                          onClick={() => {
                            // Pressing the mode the selection already holds
                            // writes nothing — no edit, no undo entry.
                            if (active) return;
                            void bundle.applyCurveMode?.(ids, option.mode);
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              </div>
            ) : (
              <span data-testid="stroke-settings-geometry-empty" style={PAINT_ROW_LABEL_STYLE}>
                No stroke geometry available
              </span>
            )
          ) : null}

          {activeSettingsTab === 'stack' && bundle.reorderStroke ? (
            <div style={SECTION_STYLE} data-testid="stroke-settings-stack">
              {stackStroke ? (
                <>
                  <div style={STACK_HEADER_ROW_STYLE}>
                    <span
                      data-testid="stroke-settings-stack-dot"
                      style={{ ...STACK_DOT_STYLE, backgroundColor: stackStroke.color }}
                    />
                    <span data-testid="stroke-settings-stack-serial" style={STACK_SERIAL_STYLE}>
                      {`#${stackStroke.serial}`}
                    </span>
                    <span
                      data-testid="stroke-settings-stack-position"
                      style={{ ...STACK_SERIAL_STYLE, marginLeft: 'auto' }}
                    >
                      {`${stackStroke.stackPosition}/${stackStroke.stackTotal}`}
                    </span>
                  </div>
                  <div data-testid="stroke-settings-stack-stepper">
                    <SliderStepper
                      key={`stack-position-${stackSyncNonce}`}
                      label="Position (1 = top)"
                      ariaLabel="Stack position"
                      value={stackStroke.stackPosition}
                      min={1}
                      max={stackStroke.stackTotal}
                      step={1}
                      freeEntry
                      commitOnRelease
                      onChange={(value) => commitStackPosition(value)}
                    />
                  </div>
                  <div style={STACK_NEIGHBOURS_STYLE}>
                    <span data-testid="stroke-settings-stack-above">
                      {stackAbove ? `Above #${stackAbove.serial}` : 'Above —'}
                    </span>
                    <span data-testid="stroke-settings-stack-below">
                      {stackBelow ? `Below #${stackBelow.serial}` : 'Below —'}
                    </span>
                  </div>
                </>
              ) : (
                <span data-testid="stroke-settings-stack-disabled" style={PAINT_ROW_LABEL_STYLE}>
                  Select one stroke to change stack order
                </span>
              )}
              <div style={SEGMENT_GROUP_STYLE}>
                <button
                  type="button"
                  data-testid="stroke-settings-stack-top"
                  aria-label="Move stroke to top"
                  disabled={!stackStroke}
                  style={SEGMENT_STYLE}
                  onClick={() => commitStackPosition(1)}
                >
                  Top
                </button>
                <button
                  type="button"
                  data-testid="stroke-settings-stack-bottom"
                  aria-label="Move stroke to bottom"
                  disabled={!stackStroke}
                  style={SEGMENT_STYLE}
                  onClick={() => {
                    if (!stackStroke) return;
                    commitStackPosition(stackStroke.stackTotal);
                  }}
                >
                  Bottom
                </button>
              </div>
            </div>
          ) : null}
            </>
          )}
        </div>
      </SidebarScrollArea>

      <div
        data-testid="stroke-settings-resize"
        aria-hidden="true"
        style={RESIZE_HANDLE_STYLE}
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={endResize}
        onPointerCancel={endResize}
      >
        <span style={RESIZE_GRIP_STYLE} />
      </div>
    </div>
  );
}

/** 61-22 (G-11): the ONE Anchor width control's inputs. */
interface AnchorWidthControlProps {
  readonly bundle: StrokeSettingsDialogBundle;
  readonly ids: readonly number[];
  readonly reading: NumericFieldReading;
  readonly anchorWidthReading: AnchorWidthReading;
  readonly anchorWidthTarget: number | null;
}

/**
 * 61-22 (G-11): the shipped Anchor width block, extracted so the DEFAULT list
 * view and the Geometry section mount the SAME control. The D-09 law is
 * untouched: the value is a MULTIPLIER of the stroke's Size, the band stays
 * 0.2..2.0, and the commit stays `bundle.applyAnchorWidths`.
 *
 * Declared AFTER the sheet component on purpose: the shipped E4 region pins
 * resolve the FIRST `stroke-settings-anchor-width` occurrence in the file and
 * require it to be the component body, never one of the mount wrappers (which
 * carry their own `stroke-settings-{list,geometry}-anchor-width` testids).
 */
function AnchorWidthControl(props: AnchorWidthControlProps) {
  const { bundle, ids, reading, anchorWidthReading, anchorWidthTarget } = props;
  const anchorWidthEmpty = anchorWidthReading.count === 0;
  return (
    <div data-testid="stroke-settings-anchor-width">
      <SliderStepper
        label="Anchor width"
        ariaLabel="Anchor width"
        value={anchorWidthEmpty
          ? AQUARELLE_ANCHOR_WIDTH_DEFAULT
          : anchorWidthReading.value}
        min={AQUARELLE_ANCHOR_WIDTH_MIN}
        max={AQUARELLE_ANCHOR_WIDTH_MAX}
        step={AQUARELLE_ANCHOR_WIDTH_STEP}
        precision={1}
        mixed={anchorWidthReading.mixed}
        disabled={anchorWidthEmpty}
        commitOnRelease
        allowOutOfRangeEntry
        // `→ {n} px` from the REAL per-vertex radius: Size x factor.
        // Empty means there is no vertex to measure — the caption below
        // says what to do instead. 61-25 (UI-02): the readout is a declared
        // span, never a bare string.
        below={anchorWidthEmpty
          ? undefined
          : (
            <span
              data-testid="stroke-settings-anchor-width-readout"
              style={ANCHOR_WIDTH_READOUT_STYLE}
            >
              {`→ ${anchorWidthEffectivePx(reading.value, anchorWidthReading.value)} px`}
            </span>
          )}
        onChange={(value) => {
          // 61-27 (IN-03): the commit's boolean was discarded, so a refusal
          // (wrong target, missing stroke, in-flight lock) looked like a
          // success — the knob snapped back with no explanation. Consume it
          // and publish the ONE refusal line through the bundle's optional
          // port; an absent port keeps the shipped silent fallback.
          void Promise.resolve(bundle.applyAnchorWidths?.(
            ids,
            anchorWidthPatchValue(value),
          )).then((applied) => {
            if (applied === false) bundle.publishRefusal?.(ANCHOR_WIDTH_COMMIT_REFUSED_MESSAGE);
          });
        }}
      />
      {anchorWidthEmpty ? (
        <span
          data-testid="stroke-settings-anchor-width-caption"
          style={ANCHOR_WIDTH_CAPTION_STYLE}
        >
          {anchorWidthTarget === null
            ? ANCHOR_WIDTH_NO_EDIT_REASON
            : 'Select anchors on the canvas to set their width.'}
        </span>
      ) : null}
    </div>
  );
}

export const MemoizedPhysicsPaintStrokeSettingsDialog = memo(PhysicsPaintStrokeSettingsDialog);
