/**
 * 47-01 multi-track row slice: one 30px compact Paint (or Background) track row.
 *
 * The row renders the SHARED `frameCells` extent produced by the strip's
 * structural index (never its own horizontal viewport), but reads cell
 * content through the row's OWN `trackId` — every per-row store read passes
 * `(layerId, trackId, frame)`, never a bare `(layerId, frame)` pair that
 * would silently fall back to the active track (Pitfall 8 / T-47-04). A
 * track with no mounted runtime or no frames renders transparent cells.
 *
 * The row is presentational: it renders ONLY the per-track cells lane. The
 * row's header cell lives in the strip's pinned header column (rendered by
 * `PhysicsPaintTrackRowHeader`), which fires `onSelectTrack(trackId)` — the
 * controller routes it through `efxPaintStore.setActiveTrackId`. Cross-row
 * mutations never originate here — all edits keep routing through
 * `studioActiveTrackId()`.
 *
 * 47-01 mockup redesign (the user's design-direction change): the header
 * column gains the "Tracks N" strip (`PhysicsPaintTrackColumnStrip`) and
 * every Paint row shows the reorder grip, the always-visible eye toggle, the
 * name, and the more-button; the more-button opens the hover tools panel
 * (solo / copy / trash-2 — 47 UAT: the eye left the panel for the standing
 * row, the pencil was removed because a double-click on the name renames).
 * The Background row stays a fixed muted row with lock semantics — no reorder
 * grab, no rename, no duplicate, no delete (D-06).
 */

import { useRef } from 'preact/hooks';
import { Blend, Copy, Eye, EyeOff, GripVertical, ImagePlus, Layers, Lock, MoreHorizontal, Plus, Trash2 } from 'lucide-preact';
import { getTrackRotorRevision, physicPaintStore } from '../../../stores/physicPaintStore';
import { isSoloArmed } from './physicsPaintSoloArm';
import { deriveKeyRailSegments, type KeyRailSegment } from './physicsPaintKeyRailPresentation';
import {
  derivePhysicPaintRotoLoopRanges,
  type PhysicPaintRotoFrameResolution,
  type PhysicPaintRotoLoopRange,
  type PhysicPaintRotoLoopResolutionContext,
} from '../roto/physicsPaintRotoPhysicalResolver';
import type { PhysicPaintRotoLoopClip } from '../roto/physicsPaintRotoPhysicalModel';
import { resolveRotoVisibleFrameResolutions } from '../roto/rotoTimelineSelectors';
import {
  projectPhysicsPaintBackgroundClipPresentation,
  projectPhysicsPaintLoopClipGeometry,
  type PhysicsPaintBackgroundClipPresentation,
  type PhysicsPaintGroupSynchronizationDot,
} from './physicsPaintLoopClipPresentation';
import type { BackgroundTrack } from '../../../efx-paint/document/efxPaintDocument';
import type {
  BackgroundClipDragApi,
  BackgroundClipDragGhostState,
  BackgroundClipDragPreviewState,
} from '../hooks/usePhysicsPaintBackgroundClipDrag';
import type { BackgroundClipResizeApi } from '../hooks/usePhysicsPaintBackgroundClipResize';
import { PhysicsPaintStyledTooltip, useStyledTooltip } from './PhysicsPaintStyledTooltip';

/** 47-01 geometry: the same 18px frame pitch as the active track. */
const ROW_CELL_WIDTH_PX = 18;

export type PhysicsPaintTrackRowKind = 'paint' | 'background';

/**
 * One rail identity on a non-active row, carried to the controller by a
 * one-click rail selection (47 close-out UAT round 5): the controller
 * activates the track and selects the rail in the same click.
 */
export type TrackRowRailSelection =
  | { readonly kind: 'key'; readonly firstKeyId: string; readonly keyIds: readonly string[]; readonly firstKeyFrame: number }
  | { readonly kind: 'loop'; readonly loopId: string; readonly placementFrame: number };

export interface PhysicsPaintTrackRowProps {
  /** The stable track UUID this row renders — identity, never an array index. */
  readonly trackId: string;
  /** Parent EFX Paint layer the runtime store keys on. */
  readonly layerId: string;
  /** The strip-level shared horizontal extent (frameCells), mapped 1:1 per row. */
  readonly frameCells: readonly number[];
  /** 'background' renders the darkened Bg row skeleton. */
  readonly kind?: PhysicsPaintTrackRowKind;
  /**
   * Track visibility (47-01 hide): a hidden track keeps EVERY cell rendered —
   * the hide op never removes elements — but the row fades to gray so the
   * hidden state reads at a glance.
   */
  readonly visible?: boolean;
  /** 47-05 Task 1 (TML-05, D-16): true while this row is the cross-track
   *  drag destination — read-only highlight feedback, the gesture never
   *  mutates the row until release commits through moveTrackItems. */
  readonly crossDestination?: boolean;
  /** 47-05 Task 1 (TML-05, D-16): the live insertion preview frame inside
   *  this row, or null — read-only frame-position indicator rendered at the
   *  same 18px pitch as the frame cells. */
  readonly crossInsertionFrame?: number | null;
  /**
   * 47-01 UAT round 7: clicking a frame cell on a NON-active track activates
   * that track (the controller routes through setActiveTrackId) and navigates
   * the cursor to the clicked frame — the same intent a click on the active
   * lane's cell carries.
   */
  readonly onSelectTrack?: (trackId: string) => void;
  readonly onNavigateToFrame?: (frame: number) => void;
  /** 47 close-out UAT round 5: one-click cross-track selection — clicking a
   *  frame/key cell on a NON-active row selects it and activates the track in
   *  the same click (no second click after the lane swap). Absent falls back
   *  to the onSelectTrack + onNavigateToFrame pair. */
  readonly onSelectTrackFrame?: (trackId: string, frame: number) => void;
  /** One-click rail selection on a non-active row: activates the track and
   *  selects the clicked Key Rail / Loop Clip rail in the same click. */
  readonly onSelectTrackRail?: (trackId: string, rail: TrackRowRailSelection) => void;
  /** 49-06 (UAT round 2): clicking an EMPTY Background row cell is the
   *  placement gesture — it selects the target frame (the import icon then
   *  imports AT that frame) and clears any selected Bg clip so the right-panel
   *  Track section stays reachable. The Bg row never navigates/selects, so this
   *  is its only cell-click intent. */
  readonly onSelectBackgroundFrame?: (frame: number) => void;
  /** 49-06 (UAT round 2): the selected Bg clip id — the matching rail paints
   *  the orange selection treatment (same contract as the rest of the
   *  timeline). */
  readonly selectedBackgroundClipId?: string | null;
  /** 49-06 (UAT round 2): the placement-target frame — the clicked empty Bg
   *  cell carries a subtle marker so the import-at-frame gesture is
   *  discoverable. */
  readonly backgroundPlacementFrame?: number | null;
  /* ---- 49-05 (S4): the fixed Background row's clip rails ---- */
  /** The document's Background track — the Bg row renders its clips as rails. */
  readonly background?: BackgroundTrack | null;
  /** The derived Background resolution context (resolver facts authority). */
  readonly backgroundResolutionContext?: PhysicPaintRotoLoopResolutionContext | null;
  /** The row-local Bg clip drag hook API — each rail binds onPointerDown. */
  readonly backgroundClipDrag?: BackgroundClipDragApi | null;
  /** 49-06 (UAT round 2): the row-local Bg clip RESIZE hook API — the FIRST and
   *  LAST cells of each clip bind onPointerDown to resize the start/end. */
  readonly backgroundClipResize?: BackgroundClipResizeApi | null;
  /** Live drag ghost geometry (paint only — never canonical). */
  readonly backgroundClipDragGhost?: BackgroundClipDragGhostState | null;
  /** Live drag preview publication (paint only — never canonical). */
  readonly backgroundClipDragPreview?: BackgroundClipDragPreviewState | null;
}

type TrackRowCellState = 'cached' | 'generated' | 'empty';

/**
 * Resolve one cell's content state for the ROW's track only. A real key, a
 * linked source occurrence, or a painted frame marks the cell 'cached'
 * (roto-fill-cached); a generated interior marks it 'generated'; everything
 * else is transparent (roto-fill-empty). The render-source authority stays
 * the store — the row never reads the active track's projection for another
 * track's cells (T-47-04).
 */
function resolveTrackRowCellState(layerId: string, trackId: string, frame: number): TrackRowCellState {
  const source = physicPaintStore.getRotoPhysicalRenderSource(layerId, trackId, frame);
  if (source && source.kind !== 'loop-placeholder') {
    return source.kind === 'generated' ? 'generated' : 'cached';
  }
  return physicPaintStore.getFrame(layerId, trackId, frame) ? 'cached' : 'empty';
}

const TRACK_ROW_CELL_FILL_CLASS: Record<TrackRowCellState, string> = {
  cached: 'roto-fill-cached',
  generated: 'roto-fill-generated',
  empty: 'roto-fill-empty',
};

const EMPTY_TRACK_ROW_RAIL_SEGMENTS: readonly KeyRailSegment[] = Object.freeze([]);
const EMPTY_TRACK_ROW_LOOP_LINES: readonly TrackRowLoopLine[] = Object.freeze([]);

/**
 * One read-only Loop Clip rail line on a non-active row: the same drawn extent
 * the active lane's loop rail paints (phaseOrigin placement + max resolved end
 * per loop identity, projected over the row's full frame extent).
 */
interface TrackRowLoopLine {
  readonly loopId: string;
  readonly left: number;
  readonly width: number;
  readonly placementFrame: number;
  readonly mode: 'progressive' | 'static';
  readonly unresolved: boolean;
  /** The status dot class (or null when unresolved) — the same lifecycle the
   *  active lane's loop rail paints, so the status reads on every track. */
  readonly lifecycle: PhysicsPaintGroupSynchronizationDot | null;
}

/**
 * The row's own lifecycle resolution (47 close-out): mirrors the active lane's
 * resolveGroupLifecycle from the clip's own fields. A missing scriptId reads
 * 'unavailable' — the row has no script-library access, so a scriptId that no
 * longer resolves is the only case that can drift from the active lane.
 */
function resolveTrackRowLoopLifecycle(
  range: PhysicPaintRotoLoopRange,
  clip: PhysicPaintRotoLoopClip | undefined,
): PhysicsPaintGroupSynchronizationDot | null {
  if (range.unresolved) return null;
  if (clip?.provenanceState === 'detached') return 'detached';
  if (!clip?.scriptId) return 'unavailable';
  return clip.syncState === 'modified' ? 'modified' : 'synchronized';
}

/**
 * Always-on rail line source (47 close-out): this row's own read-only Key Rail
 * segments, derived from THIS track's store state — every non-active Paint row
 * shows its rail lines at all times, so seeing a track's rails never waits for
 * selecting it (the rich-lane swap).
 */
function resolveTrackRowRailSegments(layerId: string, trackId: string): readonly KeyRailSegment[] {
  const orderedRealKeys = [...physicPaintStore.getRotoRealKeyRecords(layerId, trackId)]
    .sort((left, right) => left.appFrame - right.appFrame || left.keyId.localeCompare(right.keyId));
  if (orderedRealKeys.length === 0) return EMPTY_TRACK_ROW_RAIL_SEGMENTS;
  const groupOwnedKeyIds = new Set<string>();
  for (const clip of physicPaintStore.getRotoPhysicalLoopClips(layerId, trackId)) {
    clip.sourceKeyIds.forEach((keyId) => groupOwnedKeyIds.add(keyId));
    (clip.frameOverrides ?? []).forEach((override) => groupOwnedKeyIds.add(override.keyId));
  }
  return deriveKeyRailSegments({
    orderedRealKeys,
    incomingInterpolationBreakKeyIds: new Set(
      physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(layerId, trackId),
    ),
    groupOwnedKeyIds,
  });
}

interface TrackRowLoopVisuals {
  readonly lines: readonly TrackRowLoopLine[];
  /** Per-frame linked-loop classes identical to the active lane's cells
   *  (repeat gray + dot, source key/gap/generated) — UAT round 10 parity. */
  readonly linkedClassByFrame: ReadonlyMap<number, string>;
}

const EMPTY_TRACK_ROW_LOOP_VISUALS: TrackRowLoopVisuals = Object.freeze({
  lines: EMPTY_TRACK_ROW_LOOP_LINES,
  linkedClassByFrame: new Map(),
});

/**
 * Map one frame's loop resolution to the same cell classes the active lane
 * paints (PhysicsPaintWorkflowStrip): linked occurrences past the first repeat
 * are the gray dotted repeats; the source cycle keeps its own treatments.
 */
function mapTrackRowLinkedClass(resolution: PhysicPaintRotoFrameResolution, isGenerated: boolean): string {
  const kind = resolution.kind;
  const isLinkedRepeat = kind === 'linked-unresolved'
    || ((kind === 'linked' || kind === 'linked-generated' || kind === 'linked-gap') && resolution.repeatInstance > 0);
  if (isLinkedRepeat) {
    return kind === 'linked' && resolution.repeatInstance > 0 && !isGenerated
      ? 'roto-linked-repeat roto-linked-repeat-source-key'
      : 'roto-linked-repeat';
  }
  if (kind === 'linked-generated' || (kind === 'linked' && isGenerated)) return 'roto-linked-source-generated';
  if (kind === 'linked') return 'roto-linked-source-key';
  if (kind === 'linked-gap') return 'roto-linked-source-gap';
  return '';
}

/**
 * Always-on Loop Clip visuals (47 close-out UAT rounds 3+10): the rail lines
 * the active lane's Loop Clip rails paint AND the per-frame linked-repeat
 * cell classes, derived from THIS track's records + clips — a motion rail and
 * its repeat cells read identically on every track, selected or not.
 */
function resolveTrackRowLoopVisuals(
  layerId: string,
  trackId: string,
  frameCells: readonly number[],
): TrackRowLoopVisuals {
  const capacity = frameCells.length;
  const loopClips = physicPaintStore.getRotoPhysicalLoopClips(layerId, trackId);
  if (loopClips.length === 0 || capacity < 1) return EMPTY_TRACK_ROW_LOOP_VISUALS;
  const records = physicPaintStore.getRotoRealKeyRecords(layerId, trackId);
  const interpolation = physicPaintStore.getRotoPhysicalInterpolationState(layerId, trackId);
  let context;
  try {
    context = derivePhysicPaintRotoLoopRanges({
      identities: records.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame })),
      loopClips: [...loopClips],
      capacity,
      interpolationEnabled: interpolation.enabled,
    });
  } catch {
    // An unprojectable clip collection never breaks the row render — the
    // active lane remains the authority for anything exotic.
    return EMPTY_TRACK_ROW_LOOP_VISUALS;
  }
  const lines: TrackRowLoopLine[] = [];
  // Same drawn extent as the active lane's loop rail: one target per loop
  // identity, placement at the phase origin, drawn to the max resolved end.
  const authorityByLoop = new Map<string, { range: (typeof context.ranges)[number]; resolvedEnd: number }>();
  for (const range of context.ranges) {
    const current = authorityByLoop.get(range.loopId);
    if (current) {
      current.resolvedEnd = Math.max(current.resolvedEnd, range.effectiveEnd);
    } else {
      authorityByLoop.set(range.loopId, { range, resolvedEnd: range.effectiveEnd });
    }
  }
  for (const { range, resolvedEnd } of authorityByLoop.values()) {
    const continuousRange = { ...range, placementStart: range.phaseOrigin, effectiveEnd: resolvedEnd };
    const geometry = projectPhysicsPaintLoopClipGeometry(continuousRange, { startFrame: 0, endFrameExclusive: capacity }, 18);
    if (!geometry) continue;
    const clip = loopClips.find((candidate) => candidate.loopId === range.loopId);
    lines.push({
      loopId: range.loopId,
      left: geometry.left,
      width: geometry.width,
      placementFrame: continuousRange.placementStart,
      mode: clip?.mode ?? 'progressive',
      unresolved: Boolean(continuousRange.unresolved),
      lifecycle: resolveTrackRowLoopLifecycle(continuousRange, clip),
    });
  }
  // Per-frame linked-loop cell classes — the same mapping the active lane's
  // cells use (repeat frames paint gray with the dot, source cycle frames keep
  // their key/generated treatments), so a loop's repeat design never changes
  // when the track is selected or not.
  const resolutions = resolveRotoVisibleFrameResolutions(context, frameCells);
  const linkedClassByFrame = new Map<number, string>();
  for (const [frame, resolution] of resolutions) {
    if (resolution.kind === 'empty' || resolution.kind === 'real') continue;
    const state = resolveTrackRowCellState(layerId, trackId, frame);
    const linkedClass = mapTrackRowLinkedClass(resolution, state === 'generated');
    if (linkedClass !== '') linkedClassByFrame.set(frame, linkedClass);
  }
  return { lines, linkedClassByFrame };
}

/* ---- 49-05 (S4): one Background clip rail on the fixed Bg row ---- */
interface PhysicsPaintBackgroundClipRailTargetProps {
  readonly clipId: string;
  readonly startFrame: number;
  readonly presentation: PhysicsPaintBackgroundClipPresentation;
  readonly left: number;
  readonly width: number;
  /** 49-06 (UAT round 2): true when this clip is the selected Bg clip — the
   *  cells paint the orange selection treatment (timeline selection contract). */
  readonly selected: boolean;
  /** 49-06 (UAT round 2): the row-local MOVE drag hook — middle cells bind it. */
  readonly onMovePointerDown?: (event: PointerEvent) => void;
  /** 49-06 (UAT round 2): the row-local RESIZE drag hook — the FIRST and LAST
   *  cells bind it (push the edge to set the clip's start/end). */
  readonly onResizePointerDown?: (event: PointerEvent) => void;
}

/**
 * One Bg clip as a GROUP OF CELLS on the fixed Bg row (49-06 UAT round 2): each
 * frame of the clip's extent is an individual filled cell (like Paint track
 * cells), so the user can push the FIRST and LAST cells to resize the clip's
 * start/end. The Phase 47 surface lock forbids ANY text on the lane — repeat
 * facts live in the right panel and the tooltip. The cells carry
 * `data-bg-clip-id` / `data-bg-clip-start` (and `data-bg-clip-edge` on the
 * first/last) so the strip's drag/resize hooks resolve the source from the
 * pressed element; pointer-down hands the gesture to the row-local hooks
 * (row-fixed law — never the cross-track machinery).
 */
function PhysicsPaintBackgroundClipRailTarget(props: PhysicsPaintBackgroundClipRailTargetProps) {
  const tooltip = useStyledTooltip();
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const cellCount = Math.max(1, Math.round(props.width / ROW_CELL_WIDTH_PX));
  return (
    <span
      ref={anchorRef}
      class="physics-paint-bg-clip-rail-anchor"
      style={{ left: `${props.left}px`, width: `${props.width}px` }}
      onPointerEnter={tooltip.onPointerEnter}
      onPointerLeave={tooltip.onPointerLeave}
    >
      <div
        class={`physics-paint-bg-clip-cells${props.selected ? ' selected' : ''}${props.presentation.shortened ? ' shortened' : ''}${props.presentation.partialCycle ? ' partial-cycle' : ''}`}
        role="group"
        aria-label={props.presentation.accessibleName}
        data-bg-clip-id={props.clipId}
        data-bg-clip-start={props.startFrame}
      >
        {Array.from({ length: cellCount }, (_, index) => {
          const isFirst = index === 0;
          const isLast = index === cellCount - 1;
          return (
            <span
              key={index}
              class={`physics-paint-bg-clip-cell${isFirst ? ' physics-paint-bg-clip-cell-first' : ''}${isLast ? ' physics-paint-bg-clip-cell-last' : ''}`}
              data-bg-clip-id={props.clipId}
              data-bg-clip-start={props.startFrame}
              data-bg-clip-edge={isFirst ? 'start' : isLast ? 'end' : undefined}
              onPointerDown={(event) => {
                // A drag/resize begins on this cell — never let the hover pill
                // pop mid-gesture.
                tooltip.hide();
                const pointerEvent = event as unknown as PointerEvent;
                if (isFirst || isLast) props.onResizePointerDown?.(pointerEvent);
                else props.onMovePointerDown?.(pointerEvent);
              }}
              onFocus={tooltip.onFocus}
              onBlur={tooltip.onBlur}
            />
          );
        })}
      </div>
      <PhysicsPaintStyledTooltip visible={tooltip.visible} region="bottom" anchorRef={anchorRef} topmost>
        <span class="physics-paint-loop-clip-tooltip-copy">
          {props.presentation.tooltipLines.map((line, index) => (
            index === 0
              ? <strong key={line}>{line}</strong>
              : <span key={`${index}:${line}`}>{line}</span>
          ))}
        </span>
      </PhysicsPaintStyledTooltip>
    </span>
  );
}

/**
 * One 30px track row's cells track. The active track's row keeps the strip's
 * rich lane (rails + interactive cells) in the strip; this component renders
 * the per-track cells grid for every non-active Paint track and the fixed
 * Background row, reading the SAME frameCells through the row's trackId.
 */
export function PhysicsPaintTrackRow(props: PhysicsPaintTrackRowProps) {
  const {
    trackId,
    layerId,
    frameCells,
    kind = 'paint',
    visible = true,
    crossDestination = false,
    crossInsertionFrame = null,
    onSelectTrack,
    onNavigateToFrame,
    onSelectTrackFrame,
    onSelectTrackRail,
    onSelectBackgroundFrame,
    selectedBackgroundClipId = null,
    backgroundPlacementFrame = null,
    background = null,
    backgroundResolutionContext = null,
    backgroundClipDrag = null,
    backgroundClipResize = null,
    backgroundClipDragGhost = null,
  } = props;
  const rowClass = [
    'physics-paint-track-row',
    kind === 'background' ? 'physics-paint-track-row-background' : '',
    visible === false ? 'physics-paint-track-row-hidden' : '',
    crossDestination ? 'physics-paint-track-row-cross-destination' : '',
  ].filter(Boolean).join(' ');
  // Narrow per-track subscription (efx-preact-reactivity rule 5): reading THIS
  // track's revision subscribes only this row — a store bump to the track (e.g.
  // a cross-track move's removal half) re-renders it immediately instead of
  // waiting for the Studio's 150ms chrome throttle. The row stays a leaf: it
  // never subscribes to the global version signals.
  if (kind === 'paint' && layerId) getTrackRotorRevision(layerId, trackId).value;
  const railSegments = kind === 'paint' && layerId
    ? resolveTrackRowRailSegments(layerId, trackId)
    : EMPTY_TRACK_ROW_RAIL_SEGMENTS;
  const loopVisuals = kind === 'paint' && layerId
    ? resolveTrackRowLoopVisuals(layerId, trackId, frameCells)
    : EMPTY_TRACK_ROW_LOOP_VISUALS;
  const loopLines = loopVisuals.lines;
  // 47-01 UAT round 7: a click on a non-active row's frame cell activates the
  // row's track and navigates to the clicked frame. 47 close-out UAT round 5:
  // with onSelectTrackFrame wired the SAME click also selects the frame/key —
  // one click, never two.
  const handleRowClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const cell = target?.closest?.('[data-roto-app-frame]') as HTMLElement | null;
    const frame = cell ? Number(cell.dataset.rotoAppFrame) : NaN;
    // 49-06 (UAT round 2): the fixed Bg row's only cell-click intent — the
    // placement gesture. A rail click never reaches here (the rail target is
    // not a [data-roto-app-frame] cell), so only EMPTY cells select the target
    // frame; the controller clears any selected clip in the same click.
    if (kind === 'background' && Number.isInteger(frame)) {
      onSelectBackgroundFrame?.(frame);
      return;
    }
    if (onSelectTrackFrame && Number.isInteger(frame)) {
      onSelectTrackFrame(trackId, frame);
      return;
    }
    if (!onSelectTrack && !onNavigateToFrame) return;
    onSelectTrack?.(trackId);
    if (Number.isInteger(frame)) onNavigateToFrame?.(frame);
  };
  return (
    <div class={rowClass} data-track-id={trackId} onClick={handleRowClick}>
      <div class="physics-paint-track-row-lane">
        <div
          class="physics-paint-track-row-cells"
          role="row"
          style={{
            gridTemplateColumns: `repeat(${frameCells.length}, ${ROW_CELL_WIDTH_PX}px)`,
            /* 47-01 UAT round 2: the cells lane must never shrink below the
               full frame capacity, so the track's frames stay scrollable to
               the last cell like the active lane (the rows-region carries the
               matching full width from the strip). */
            minWidth: `${frameCells.length * ROW_CELL_WIDTH_PX}px`,
          }}
        >
          {frameCells.map((frame) => {
            const state = resolveTrackRowCellState(layerId, trackId, frame);
            // UAT round 10: linked-loop cells carry the same repeat/source
            // classes as the active lane — the repeat design (gray + dot)
            // never changes when the track is selected or not.
            const linkedClass = loopVisuals.linkedClassByFrame.get(frame);
            // 49-06 (UAT round 2): the clicked empty Bg cell carries the
            // placement-target marker so the import-at-frame gesture reads.
            const placementClass = kind === 'background' && backgroundPlacementFrame === frame
              ? ' physics-paint-bg-placement-target'
              : '';
            const cellClass = `physics-paint-roto-cell ${TRACK_ROW_CELL_FILL_CLASS[state]}${linkedClass ? ` ${linkedClass}` : ''}${placementClass}`;
            return (
              <span
                key={frame}
                className={cellClass}
                data-roto-app-frame={frame}
                aria-hidden="true"
              >
                {frame}
              </span>
            );
          })}
        </div>
        {/* Always-on read-only rails (47 close-out UAT round 4): the SAME
            classes the active lane's rails render — a read-only rail-target
            wrapper (12px band) holding the family's segment, so caps, colors
            and cell edges come from the shared rules and every track's rails
            are pixel-identical. Pure feedback: pointer-events none, row cell
            clicks keep working. */}
        {railSegments.map((segment) => (
          <span
            key={segment.firstKeyId}
            class="physics-paint-track-row-rail physics-paint-rail-target boundary-start boundary-cell-start boundary-end boundary-cell-end"
            style={{
              left: `${segment.firstKeyFrame * ROW_CELL_WIDTH_PX}px`,
              width: `${(segment.lastKeyFrame + 1 - segment.firstKeyFrame) * ROW_CELL_WIDTH_PX}px`,
            }}
            role="button"
            aria-label={`Key Rail frames ${segment.firstKeyFrame}–${segment.lastKeyFrame}`}
            onClick={(event) => {
              // Only consume the click when the selection intent is wired —
              // otherwise let it bubble to the row's cell click (a rail click
              // without a handler must never be a dead click).
              if (!onSelectTrackRail) return;
              event.stopPropagation();
              onSelectTrackRail(trackId, {
                kind: 'key',
                firstKeyId: segment.firstKeyId,
                keyIds: segment.keyIds,
                firstKeyFrame: segment.firstKeyFrame,
              });
            }}
          >
            <span class="physics-paint-rail-segment physics-paint-key-rail-segment" />
          </span>
        ))}
        {loopLines.map((line) => (
          <span
            key={line.loopId}
            class={`physics-paint-track-row-rail physics-paint-rail-target physics-paint-loop-clip-rail-target mode-${line.mode}${line.unresolved ? ' unresolved' : ''} boundary-start boundary-cell-start boundary-end boundary-cell-end`}
            style={{ left: `${line.left}px`, width: `${line.width}px` }}
            role="button"
            aria-label={`Loop Clip rail at frame ${line.placementFrame}`}
            onClick={(event) => {
              // Same as the key-rail wrapper: only consume when wired.
              if (!onSelectTrackRail) return;
              event.stopPropagation();
              onSelectTrackRail(trackId, { kind: 'loop', loopId: line.loopId, placementFrame: line.placementFrame });
            }}
          >
            <span class="physics-paint-rail-segment physics-paint-loop-clip-rail-segment" />
            {line.lifecycle ? (
              <span class={`physics-paint-loop-clip-lifecycle-dot ${line.lifecycle}`} aria-hidden="true" />
            ) : null}
          </span>
        ))}
        {/* 49-05 (S4): the fixed Background row's clip rails — one neutral
            rail per clip in ascending startFrame order, badge + shortened +
            partial-cycle facts all from the resolver (capsule-never-math).
            The drag hook's ghost paints above the accepted rails; the ghost
            is presentation-only and never mutates the document. */}
        {kind === 'background' && background && backgroundResolutionContext ? (
          <div class="physics-paint-bg-clip-rail" role="group" aria-label="Background clips">
            {background.clips.map((clip) => {
              const range = backgroundResolutionContext.ranges.find((candidate) => candidate.loopId === clip.id);
              if (!range) return null;
              const presentation = projectPhysicsPaintBackgroundClipPresentation(range);
              const geometry = projectPhysicsPaintLoopClipGeometry(
                range,
                { startFrame: 0, endFrameExclusive: frameCells.length },
                ROW_CELL_WIDTH_PX,
              );
              if (!geometry) return null;
              return (
                <PhysicsPaintBackgroundClipRailTarget
                  key={clip.id}
                  clipId={clip.id}
                  startFrame={clip.startFrame}
                  presentation={presentation}
                  left={geometry.left}
                  width={geometry.width}
                  selected={selectedBackgroundClipId === clip.id}
                  onMovePointerDown={backgroundClipDrag?.onPointerDown}
                  onResizePointerDown={backgroundClipResize?.onPointerDown}
                />
              );
            })}
            {backgroundClipDragGhost?.active ? (
              <span
                class={`physics-paint-bg-clip-rail-ghost${backgroundClipDragGhost.blockedEdge ? ` blocked-edge-${backgroundClipDragGhost.blockedEdge}` : ''}`}
                style={{ left: `${backgroundClipDragGhost.left}px`, width: `${backgroundClipDragGhost.width}px` }}
                aria-hidden="true"
              />
            ) : null}
            {/* 49-06 (UAT round 2): the RESIZE ghost — the new extent preview
                while pushing the first/last cell (paint only, never canonical). */}
            {backgroundClipResize?.ghost.active ? (
              <span
                class={`physics-paint-bg-clip-rail-ghost physics-paint-bg-clip-resize-ghost${backgroundClipResize.ghost.blockedEdge ? ` blocked-edge-${backgroundClipResize.ghost.blockedEdge}` : ''}`}
                style={{ left: `${backgroundClipResize.ghost.left}px`, width: `${backgroundClipResize.ghost.width}px` }}
                aria-hidden="true"
              />
            ) : null}
          </div>
        ) : null}
        {/* 47-05 Task 1 (TML-05, D-16): the live insertion preview — a 2px
            accent line at the frame position where the dragged content lands
            inside this destination row (left = frame × the 18px pitch). Pure
            feedback: the gesture never mutates the row until release. */}
        {crossInsertionFrame !== null ? (
          <span
            class="physics-paint-track-row-insertion-preview"
            style={{ left: `${crossInsertionFrame * ROW_CELL_WIDTH_PX}px` }}
            aria-hidden="true"
          />
        ) : null}
      </div>
    </div>
  );
}

export interface PhysicsPaintTrackRowHeaderProps {
  /** The stable track UUID this header names — identity, never an array index. */
  readonly trackId: string;
  /** Row label shown in the header cell (track name, or 'Bg' for the background row). */
  readonly label: string;
  /** 'background' renders the fixed muted Bg header skeleton. */
  readonly kind?: PhysicsPaintTrackRowKind;
  /** The document's current active track id — the matching header gets the active treatment. */
  readonly activeTrackId?: string;
  /** Header-click intent; the controller routes it through setActiveTrackId. */
  readonly onSelectTrack?: (trackId: string) => void;
  /** Current track visibility (drives the eye icon + aria-pressed). */
  readonly visible?: boolean;
  /** Paint rows get the reorder grab; the Background row is locked (D-06). */
  readonly reorderable?: boolean;
  /** False hides/disables the delete affordance for the last surviving Paint track (D-17). */
  readonly deletable?: boolean;
  /** True while this row's name is being edited in place. */
  readonly editing?: boolean;
  /** Live draft value shown by the rename input. */
  readonly renameValue?: string;
  /** Pencil clicked — the strip enters edit-in-place mode for this track. */
  readonly onStartRename?: (trackId: string) => void;
  /** Rename input change — live draft update. */
  readonly onRenameDraftChange?: (trackId: string, value: string) => void;
  /** Rename Enter — the strip commits renameTrack(trackId, draft). */
  readonly onCommitRename?: (trackId: string) => void;
  /** Rename Escape/blur — the strip abandons the edit. */
  readonly onCancelRename?: (trackId: string) => void;
  /** Eye toggle intent — routes through setTrackVisible. */
  readonly onToggleVisible?: (trackId: string, visible: boolean) => void;
  /** 'S' solo toggle intent (47-02 Task 1) — routes through setTrackSolo. */
  readonly onToggleSolo?: (trackId: string) => void;
  /** Parent EFX Paint layer for the row's per-track store reads (frame
   *  blending state). Absent in minimal fixtures — the blend toggle only
   *  renders when a layer is known. */
  readonly layerId?: string;
  /** Frame-blending toggle intent (47 UAT) — the row routes it to the strip,
   *  which toggles the track's canonical interpolation state. */
  readonly onToggleBlend?: (trackId: string) => void;
  /** Copy intent — routes through duplicateTrack. */
  readonly onDuplicateTrack?: (trackId: string) => void;
  /** Trash intent — routes through requestDeleteTrack/commitDeleteTrack. */
  readonly onDeleteTrack?: (trackId: string) => void;
  /** 47-02 Task 2: the distinct reorder grab's pointerdown intent — the strip
   *  owns the drag session (D-08/D-18: only the grab area starts a reorder). */
  readonly onGripPointerDown?: (event: PointerEvent, trackId: string) => void;
  /** True while this row's tool panel (eye/pencil/copy/trash) is open. */
  readonly toolsOpen?: boolean;
  /** More-button click — toggles the tool panel for this track. */
  readonly onToggleTools?: (trackId: string) => void;
  /** Pointer left the tool panel (or the whole header) — closes it. */
  readonly onCloseTools?: () => void;
  /** 49-05 (S1): the Bg row's ONLY action — opens the scoped asset picker.
   *  The locked Background row carries no reorder grab, no duplicate/delete
   *  hover actions (47-CONTEXT D-06); Import is its single affordance. */
  readonly onImportBackground?: () => void;
}

/**
 * One 30px header cell in the strip's pinned header column. Every row —
 * including the active lane and the fixed Background row — gets exactly one
 * header cell showing its track name (UI-SPEC header column layout). The
 * header column never scrolls horizontally with the frame cells (D-05).
 *
 * The header is presentational and hook-free (the viewport test invokes it as
 * a plain function), so all interaction state (rename editing, drafts) lives
 * in the strip and flows down as props.
 */
export function PhysicsPaintTrackRowHeader(props: PhysicsPaintTrackRowHeaderProps) {
  const {
    trackId,
    label,
    kind = 'paint',
    activeTrackId,
    onSelectTrack,
    visible = true,
    reorderable = true,
    deletable = true,
    editing = false,
    renameValue = '',
    onStartRename,
    onRenameDraftChange,
    onCommitRename,
    onCancelRename,
    onToggleVisible,
    onToggleSolo,
    layerId,
    onToggleBlend,
    onDuplicateTrack,
    onDeleteTrack,
    onGripPointerDown,
    toolsOpen = false,
    onToggleTools,
    onCloseTools,
    onImportBackground,
  } = props;
  const isActive = activeTrackId === trackId;
  const isBackground = kind === 'background';
  // 47 UAT: the per-row frame-blending toggle reads THIS track's canonical
  // interpolation state (same store read the toolbox toggle uses, keyed by
  // the row's own trackId — never the active track's, T-47-04).
  const blendEnabled = layerId ? physicPaintStore.getRotoPhysicalInterpolationState(layerId, trackId).enabled : false;
  const headerClass = [
    'physics-paint-track-row-header',
    isActive ? 'physics-paint-track-row-header-active' : '',
    isBackground ? 'physics-paint-track-row-header-background' : '',
  ].filter(Boolean).join(' ');
  if (isBackground) {
    // The Background row is not selectable and has no hover capability for now
    // (D-06 lock semantics): render a plain header cell — no role=button, no
    // tabIndex, no click/keyboard selection, no hover tools.
    return (
      <div
        class={headerClass}
        data-track-id={trackId}
        aria-label={`${label} row`}
      >
        <span class="physics-paint-bg-checker" aria-hidden="true">
          <i class="physics-paint-bg-checker-cell physics-paint-bg-checker-cell-a" />
          <i class="physics-paint-bg-checker-cell physics-paint-bg-checker-cell-b" />
          <i class="physics-paint-bg-checker-cell physics-paint-bg-checker-cell-c" />
          <i class="physics-paint-bg-checker-cell physics-paint-bg-checker-cell-d" />
        </span>
        <span class="physics-paint-track-row-label">{label}</span>
        <span class="physics-paint-track-row-lock" title="Background layer — fixed position" aria-hidden="true">
          <Lock size={12} />
        </span>
        {/* 49-05 (S1): the Bg row's single action — the Import control. 24px
            hit target (UI-SPEC accessibility), aria-label per the copywriting
            table; clicking opens the scoped asset picker (49-04 mount). */}
        <button
          type="button"
          class="physics-paint-bg-import-button"
          aria-label="Import images"
          title="Import images"
          onClick={() => onImportBackground?.()}
        >
          <ImagePlus size={14} aria-hidden="true" />
        </button>
      </div>
    );
  }
  return (
    <div
      class={headerClass}
      data-track-id={trackId}
      data-tools-open={toolsOpen ? 'true' : undefined}
      role="button"
      tabIndex={0}
      aria-label={`Select track ${label}`}
      onClick={() => onSelectTrack?.(trackId)}
      // 47-02 Task 2: a double-click on the row opens the edit-in-place rename
      // field (TML-02, D-03) — the same intent the pencil tool button carries.
      onDblClick={() => {
        if (!editing) onStartRename?.(trackId);
      }}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && !editing) {
          event.preventDefault();
          onSelectTrack?.(trackId);
        }
      }}
      onPointerLeave={() => {
        // 47-01 UAT round 6: leaving the header closes the tool panel.
        if (toolsOpen) onCloseTools?.();
      }}
    >
      {editing ? (
        <input
          class="physics-paint-track-rename-input"
          type="text"
          value={renameValue}
          maxLength={64}
          aria-label={`Rename track ${label}`}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.stopPropagation();
              onCommitRename?.(trackId);
            } else if (event.key === 'Escape') {
              event.stopPropagation();
              onCancelRename?.(trackId);
            }
          }}
          onInput={(event) => onRenameDraftChange?.(trackId, (event.target as HTMLInputElement).value)}
          onBlur={() => onCancelRename?.(trackId)}
          ref={(element) => {
            // Select only on first mount — the ref runs on every re-render and
            // an unconditional select() would re-select all text after each
            // keystroke, so the next key replaces the whole draft (the rename
            // would accept only a single letter).
            if (element && !element.dataset.renameSelected) {
              element.dataset.renameSelected = 'true';
              element.focus();
              element.select();
            }
          }}
        />
      ) : (
        <>
          {reorderable ? (
            // 47-02 Task 2: the grip is the ONLY header element that starts a
            // drag — the strip's session computes the insertion index and
            // commits reorderTrack on release (D-08/D-18).
            <span
              class="physics-paint-track-row-grip"
              title="Drag to reorder"
              aria-hidden="true"
              onPointerDown={(event) => onGripPointerDown?.(event as unknown as PointerEvent, trackId)}
            >
              <GripVertical size={12} />
            </span>
          ) : null}
          {/* 47 UAT: the eye (hide/show) toggle is a standing row control,
              placed before the name and after the reorder grip — the row's
              only always-visible controls besides the more-button. */}
          <button
            type="button"
            class="physics-paint-track-row-tool-button"
            aria-label={visible ? `Hide ${label}` : `Show ${label}`}
            aria-pressed={!visible}
            title={visible ? `Hide ${label}` : `Show ${label}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleVisible?.(trackId, !visible);
            }}
          >
            {visible ? <Eye size={12} aria-hidden="true" /> : <EyeOff size={12} aria-hidden="true" />}
          </button>
          {/* 47 UAT: per-row frame-blending toggle right after the eye. Its
              pressed state reflects THIS track's canonical interpolation
              enabled flag; the click routes through onToggleBlend(trackId)
              and the strip toggles the track's interpolation state. */}
          {layerId ? (
            <button
              type="button"
              class={`physics-paint-track-row-tool-button physics-paint-track-row-blend${blendEnabled ? ' physics-paint-track-row-blend-enabled' : ''}`}
              aria-label={`Blend ${label}`}
              aria-pressed={blendEnabled ? 'true' : 'false'}
              title={blendEnabled ? `Disable frame blending for ${label}` : `Enable frame blending for ${label}`}
              onClick={(event) => {
                event.stopPropagation();
                onToggleBlend?.(trackId);
              }}
            >
              <Blend size={12} aria-hidden="true" />
            </button>
          ) : null}
          <span
            class="physics-paint-track-row-label physics-paint-track-row-label-ellipsis"
            title={label}
          >{label}</span>
          {/* 47-01 UAT round 6: the tools open ONLY from the small more-button
              at the name's right extreme (never on header hover or click —
              a click on the name selects the track); leaving the panel closes
              it. 47 UAT: the panel now holds solo / copy / trash — the pencil
              was removed because a double-click on the name renames in place,
              and the eye moved out to the standing row controls. */}
          <span
            class="physics-paint-track-row-tools"
            role="group"
            aria-label={`${label} actions`}
            onPointerLeave={() => {
              if (toolsOpen) onCloseTools?.();
            }}
          >
            <button
              type="button"
              class={`physics-paint-track-row-solo${isSoloArmed() ? ' physics-paint-track-row-solo-armed' : ''}`}
              aria-label={`Solo ${label}`}
              aria-pressed={isSoloArmed() ? 'true' : 'false'}
              title={isSoloArmed() ? `Un-solo ${label}` : `Solo ${label}`}
              onClick={(event) => {
                event.stopPropagation();
                onToggleSolo?.(trackId);
              }}
            >
              S
            </button>
            <button
              type="button"
              class="physics-paint-track-row-tool-button"
              aria-label={`Duplicate ${label}`}
              title={`Duplicate ${label}`}
              onClick={(event) => {
                event.stopPropagation();
                onDuplicateTrack?.(trackId);
              }}
            >
              <Copy size={12} aria-hidden="true" />
            </button>
            <button
              type="button"
              class="physics-paint-track-row-tool-button"
              aria-label={`Delete ${label}`}
              title={deletable ? `Delete ${label}` : 'A document must always have at least one Paint track.'}
              aria-disabled={!deletable ? 'true' : undefined}
              disabled={!deletable}
              onClick={(event) => {
                event.stopPropagation();
                if (deletable) onDeleteTrack?.(trackId);
              }}
            >
              <Trash2 size={12} aria-hidden="true" />
            </button>
          </span>
          <button
            type="button"
            class="physics-paint-track-row-tools-toggle"
            aria-label={toolsOpen ? `Close ${label} actions` : `Open ${label} actions`}
            aria-expanded={toolsOpen ? 'true' : 'false'}
            title={toolsOpen ? 'Close actions' : 'Actions'}
            onClick={(event) => {
              event.stopPropagation();
              onToggleTools?.(trackId);
            }}
          >
            <MoreHorizontal size={14} aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}

export interface PhysicsPaintTrackColumnStripProps {
  /** Number of Paint tracks (the badge count). */
  readonly trackCount: number;
  /** '+' add intent — routes through addTrack. */
  readonly onAddTrack?: () => void;
}

/**
 * The pinned header column's top strip (the mockup "Tracks" bar): layers icon,
 * "Tracks" title, count badge, and the '+' add-track button. Sits in the
 * 28 px ruler spacer slot so it aligns with the frame ruler.
 */
export function PhysicsPaintTrackColumnStrip(props: PhysicsPaintTrackColumnStripProps) {
  const { trackCount, onAddTrack } = props;
  return (
    <div class="physics-paint-track-column-strip">
      <span class="physics-paint-track-column-title-group">
        <Layers size={14} class="physics-paint-track-column-layers-icon" aria-hidden="true" />
        <span class="physics-paint-track-column-title">Tracks</span>
        <span class="physics-paint-track-column-badge" aria-label={`${trackCount} ${trackCount === 1 ? 'track' : 'tracks'}`}>
          {trackCount}
        </span>
      </span>
      <button
        type="button"
        class="physics-paint-track-column-add"
        aria-label="Add track"
        title="Add track"
        onClick={() => onAddTrack?.()}
      >
        <Plus size={11} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  );
}
