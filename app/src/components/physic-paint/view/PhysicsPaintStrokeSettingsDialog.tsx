import { useEffect, useRef } from 'preact/hooks';
import { signal, type Signal } from '@preact/signals';
import { memo } from 'preact/compat';
import type { CSSProperties, TargetedPointerEvent } from 'preact';
import { SliderStepper } from '../../shared/SliderStepper';
import { RightPanelColorTab } from './RightPanelColorTab';
import {
  FRESH_STROKE_GEOMETRY_SESSION,
  STROKE_ROTATION_RANGE,
  STROKE_SCALE_RANGE,
  buildAppearancePatch,
  buildColorPatch,
  geometryMoveDelta,
  geometryTransform,
  readColorField,
  readNumericField,
  resolveStrokeSettingsOpen,
  shouldMarkSawEmpty,
  strokeSettingsFields,
  type StrokeGeometryControl,
  type StrokeGeometrySession,
  type StrokeSettingsDialogBundle,
} from './strokeSettingsModel';
import { scriptSelectedStrokeIds, scriptSelectMode } from './scriptStrokeEdition';
import { scriptStrokeSelectionBox } from './scriptStrokeTransform';

/**
 * quick 261024-p5q: the Stroke Settings dialog — a selection-gated, movable
 * editing surface for the selected Studio strokes (Brush Move / Water color
 * Select). Patterned on the Photo Reference dialog: no backdrop, no focus
 * trap — the canvas and its transform handles stay interactive behind it.
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
 * Signals only: ref-held signals, no React-style component state, no
 * render-body signal writes, all styling inline (no CSS file change). The
 * full Paint field set, the shared Color control and the session-relative
 * Geometry section all ship here.
 *
 * Geometry: every row is a release-commit, free-entry SliderStepper. X/Y type
 * an absolute target and commit `target - live centre` in integer px; Scale /
 * Scale X / Scale Y / Rotation apply the delta from that row's last APPLIED
 * value (a refused commit keeps the previous session value). The session is
 * keyed by the selection Set, so a membership change re-baselines to identity.
 * Transforms anchor at the union-box centre of the selected strokes; nothing
 * persists.
 *
 * Color: the shared RightPanelColorTab is imported UNMODIFIED. Its live
 * onColorChange writes a dialog draft signal only; the wrapper's boundary
 * handlers (pointerup, change, Enter, blur-capture, click) perform the ONE
 * stroke write per gesture. The dedupe baseline is keyed by the selection Set
 * so a membership change re-arms the first commit.
 */

interface DragOffset {
  readonly selection: ReadonlySet<number>;
  readonly dxPx: number;
  readonly dyPx: number;
}

interface DragStart {
  readonly pointerX: number;
  readonly pointerY: number;
  readonly baseX: number;
  readonly baseY: number;
  readonly rect: { left: number; top: number; width: number } | null;
}

export interface PhysicsPaintStrokeSettingsDialogProps {
  /** The view-supplied bundle for the ACTIVE module; absent means no dialog. */
  bundle?: StrokeSettingsDialogBundle | null;
}

let sawEmptySinceDismiss = false;

const SURFACE_STYLE: CSSProperties = {
  position: 'absolute',
  top: '12px',
  right: '12px',
  width: '320px',
  maxHeight: 'calc(100% - 24px)',
  overflowY: 'auto',
  zIndex: 50,
  boxSizing: 'border-box',
  padding: '10px',
  borderRadius: '6px',
  border: '1px solid var(--sidebar-border-unselected, rgba(159, 165, 174, 0.35))',
  background: 'var(--sidebar-bg, #1f242b)',
  color: 'var(--sidebar-text-primary, #eceff2)',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
  pointerEvents: 'auto',
};

const HEADER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  cursor: 'move',
  userSelect: 'none',
  touchAction: 'none',
};

const CLOSE_STYLE: CSSProperties = {
  width: '18px',
  height: '18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0',
  border: 'none',
  borderRadius: '3px',
  background: 'transparent',
  color: 'var(--sidebar-text-secondary, #9aa5b1)',
  cursor: 'pointer',
  fontSize: '13px',
  lineHeight: '1',
};

const SECTION_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  marginTop: '8px',
};

const SECTION_TITLE_STYLE: CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--sidebar-text-secondary, #9aa5b1)',
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

const MIXED_CAPTION_STYLE: CSSProperties = {
  fontSize: '10px',
  fontStyle: 'italic',
  color: 'var(--sidebar-text-secondary, #9aa5b1)',
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

export function PhysicsPaintStrokeSettingsDialog({
  bundle,
}: PhysicsPaintStrokeSettingsDialogProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dismissedRef = useRef<Signal<boolean> | null>(null);
  if (!dismissedRef.current) dismissedRef.current = signal(false);
  const dragOffsetRef = useRef<Signal<DragOffset | null> | null>(null);
  if (!dragOffsetRef.current) dragOffsetRef.current = signal(null);
  const dragStartRef = useRef<DragStart | null>(null);
  /** The picker's live colour — a draft only; strokes move at a boundary. */
  const colorDraftRef = useRef<Signal<{ selection: ReadonlySet<number>; color: string } | null> | null>(null);
  if (!colorDraftRef.current) colorDraftRef.current = signal(null);
  /** Per-selection dedupe baseline: the last colour this selection committed. */
  const colorCommittedRef = useRef<{ selection: ReadonlySet<number>; color: string } | null>(null);
  /**
   * The geometry session, keyed by the selection Set instance. A different
   * selection simply resolves FRESH — no render-body signal write, and a new
   * membership always re-baselines to 100% / 0 degrees.
   */
  const geometrySessionRef = useRef<Signal<{ selection: ReadonlySet<number>; session: StrokeGeometrySession } | null> | null>(null);
  if (!geometrySessionRef.current) geometrySessionRef.current = signal(null);

  const selection = scriptSelectedStrokeIds.value;
  const engineModule = bundle?.module ?? 'brush';
  const surfaceActive = bundle !== null && bundle !== undefined
    ? (engineModule === 'watercolor' ? scriptSelectMode.value : bundle.brushMoveActive)
    : false;
  const dismissed = dismissedRef.current.value;

  // Plain (non-signal) render-body flag write — the dismissal edge marker.
  if (shouldMarkSawEmpty({ dismissed, surfaceActive, selectionSize: selection.size })) {
    sawEmptySinceDismiss = true;
  }

  const open = bundle !== null
    && bundle !== undefined
    && resolveStrokeSettingsOpen({
      surfaceActive,
      selectionSize: selection.size,
      dismissed,
      sawEmptySinceDismiss,
    });

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
      dismissedRef.current!.value = true;
      sawEmptySinceDismiss = false;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

  if (!bundle || !open) return null;

  const ids = [...selection];
  const appearances = bundle.readAppearance(ids, bundle.playFrame);
  if (appearances.length === 0) return null;

  const fields = strokeSettingsFields(engineModule);
  const numericFields = fields.filter((field) => field.kind === 'numeric');
  const segmentedFields = fields.filter((field) => field.kind === 'segmented');

  const colorReading = readColorField(appearances, ids);
  const draftState = colorDraftRef.current.value;
  const draftColor = draftState && draftState.selection === selection ? draftState.color : null;
  const shownColor = draftColor ?? colorReading.color;

  /**
   * The shared picker's live changes land here ONLY: a dialog draft. Strokes
   * are written by {@link commitColor} at a gesture boundary, never per tick.
   */
  const writeColorDraft = (nextColor: string) => {
    const current = colorDraftRef.current!.value;
    if (current && current.selection === selection && current.color === nextColor) return;
    colorDraftRef.current!.value = { selection, color: nextColor };
  };

  /**
   * ONE stroke write per boundary. The dedupe baseline is keyed by the
   * selection Set: a membership change starts unset, so a mixed selection's
   * first commit always writes (even when it reproduces the representative
   * colour). Repeated boundaries in one gesture are idempotent.
   */
  const commitColor = () => {
    const current = colorDraftRef.current!.value;
    const nextColor = current && current.selection === selection
      ? current.color
      : colorReading.color;
    const baseline = colorCommittedRef.current;
    if (baseline && baseline.selection === selection && baseline.color === nextColor) return;
    colorCommittedRef.current = { selection, color: nextColor };
    void bundle.applyAppearance(ids, buildColorPatch(nextColor));
  };

  /**
   * Preact runs `onBlurCapture` BEFORE the focused field's own `onBlur`, so a
   * hex commit would still be only in the field's state. Defer one microtask
   * to commit the draft the field handler just wrote.
   */
  const onColorBlurCapture = () => {
    queueMicrotask(commitColor);
  };

  const offset = dragOffsetRef.current.value;
  const applied = offset && offset.selection === selection ? offset : null;

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
    bundle.listStrokes(bundle.playFrame, bundle.canvasSize)
      .filter((stroke) => selection.has(stroke.mutationId)),
  );
  const liveCenter = selectionBox
    ? { x: selectionBox.x + selectionBox.width / 2, y: selectionBox.y + selectionBox.height / 2 }
    : null;

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

  const dismiss = () => {
    dismissedRef.current!.value = true;
    sawEmptySinceDismiss = false;
  };

  const onHeaderPointerDown = (event: TargetedPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const rect = surfaceRef.current?.getBoundingClientRect?.() ?? null;
    const current = dragOffsetRef.current!.value;
    const base = current && current.selection === selection ? current : null;
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
    dragOffsetRef.current!.value = { selection, dxPx: nextX, dyPx: nextY };
  };

  const endHeaderDrag = () => {
    dragStartRef.current = null;
  };

  return (
    <div
      ref={surfaceRef}
      data-testid="stroke-settings-dialog"
      role="dialog"
      aria-label="Stroke settings"
      style={{
        ...SURFACE_STYLE,
        transform: `translate(${applied?.dxPx ?? 0}px, ${applied?.dyPx ?? 0}px)`,
      }}
    >
      <div
        data-testid="stroke-settings-header"
        style={HEADER_STYLE}
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={endHeaderDrag}
        onPointerCancel={endHeaderDrag}
      >
        <strong style={{ fontSize: '12px' }}>Stroke settings</strong>
        <span style={{ flex: '1 1 0' }} aria-hidden="true" />
        <button
          type="button"
          data-testid="stroke-settings-close"
          aria-label="Close stroke settings"
          title="Close"
          style={CLOSE_STYLE}
          onClick={dismiss}
        >
          ×
        </button>
      </div>

      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Paint</div>
        {numericFields.map((field) => {
          const reading = readNumericField(appearances, ids, field);
          return (
            <div key={field.key} data-testid={`stroke-settings-${field.key}`}>
              <SliderStepper
                label={field.label}
                ariaLabel={field.label}
                value={reading.value}
                min={field.min}
                max={field.max}
                step={field.step}
                mixed={reading.mixed}
                commitOnRelease
                onChange={(value) => {
                  void bundle.applyAppearance(
                    ids,
                    buildAppearancePatch(engineModule, field.key, value),
                  );
                }}
              />
            </div>
          );
        })}
        {segmentedFields.map((field) => {
          const reading = readNumericField(appearances, ids, field);
          return (
            <div key={field.key} data-testid={`stroke-settings-${field.key}`}>
              <div style={SEGMENT_LABEL_ROW_STYLE}>
                <span style={PAINT_ROW_LABEL_STYLE}>{field.label}</span>
                {reading.mixed ? (
                  <span
                    data-testid={`stroke-settings-${field.key}-mixed`}
                    style={MIXED_CAPTION_STYLE}
                  >
                    Mixed
                  </span>
                ) : null}
              </div>
              <div role="group" aria-label={field.label} style={SEGMENT_GROUP_STYLE}>
                {(field.options ?? []).map((option) => {
                  const active = !reading.mixed && reading.value === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      data-testid={`stroke-settings-${field.key}-option-${option.value}`}
                      aria-pressed={active}
                      style={active ? { ...SEGMENT_STYLE, ...SEGMENT_ACTIVE_STYLE } : SEGMENT_STYLE}
                      onClick={() => {
                        void bundle.applyAppearance(
                          ids,
                          buildAppearancePatch(engineModule, field.key, option.value),
                        );
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Color</div>
        <div
          data-testid="stroke-settings-color"
          onPointerUp={commitColor}
          onChange={commitColor}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitColor();
          }}
          onBlurCapture={onColorBlurCapture}
          onClick={commitColor}
        >
          {colorReading.mixed ? (
            <div data-testid="stroke-settings-color-mixed" style={MIXED_CAPTION_STYLE}>
              Mixed
            </div>
          ) : null}
          <RightPanelColorTab
            color={shownColor}
            opacity={100}
            onColorChange={(nextColor) => {
              writeColorDraft(nextColor);
            }}
          />
        </div>
      </div>

      {liveCenter ? (
        <div style={SECTION_STYLE} data-testid="stroke-settings-geometry">
          <div style={SECTION_TITLE_STYLE}>Geometry</div>
          <div data-testid="stroke-settings-geometry-x">
            <SliderStepper
              label="X"
              ariaLabel="X"
              value={Math.round(liveCenter.x)}
              min={0}
              max={bundle.canvasSize.width}
              step={1}
              freeEntry
              commitOnRelease
              onChange={(value) => commitGeometryMove('x', value)}
            />
          </div>
          <div data-testid="stroke-settings-geometry-y">
            <SliderStepper
              label="Y"
              ariaLabel="Y"
              value={Math.round(liveCenter.y)}
              min={0}
              max={bundle.canvasSize.height}
              step={1}
              freeEntry
              commitOnRelease
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
              onChange={(value) => commitGeometryTransform('rotation', value)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const MemoizedPhysicsPaintStrokeSettingsDialog = memo(PhysicsPaintStrokeSettingsDialog);
