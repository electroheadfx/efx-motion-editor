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

import { Blend, Copy, Eye, EyeOff, GripVertical, Layers, Lock, MoreHorizontal, Plus, Trash2 } from 'lucide-preact';
import { physicPaintStore } from '../../../stores/physicPaintStore';
import { isSoloArmed } from './physicsPaintSoloArm';
import { PhysicsPaintFilmstripCapsule } from './physicsPaintFilmstripCapsule';
import type {
  PhysicsPaintLoopClipGeometry,
  PhysicsPaintLoopClipPresentation,
} from './physicsPaintLoopClipPresentation';

/** 47-01 geometry: shared frame pitch (same 18px as the active track). */
const ROW_CELL_WIDTH_PX = 18;

export type PhysicsPaintTrackRowKind = 'paint' | 'background';

/** One ready-to-render filmstrip capsule for a track row (47-04 Task 3): all
 *  facts were projected by the strip's existing projection functions — the
 *  row is presentational and never computes loop data itself. */
export interface PhysicsPaintTrackRowLoopCapsule {
  readonly presentation: PhysicsPaintLoopClipPresentation;
  readonly geometry: PhysicsPaintLoopClipGeometry;
  readonly repeat: number | 'infinity';
  readonly sourceOffsets: readonly number[];
  readonly sourceFrameCount: number;
  readonly cycleLength: number;
}

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
  /** 47-04 Task 3: per-loop filmstrip capsules for THIS row's Loop Clips
   *  (paint rows: store-derived resolver contexts; Bg row: background clips
   *  when present). Absent/empty keeps the plain row — the Bg fallback
   *  display remains untouched. */
  readonly loopCapsules?: readonly PhysicsPaintTrackRowLoopCapsule[];
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
    loopCapsules,
    crossDestination = false,
    crossInsertionFrame = null,
    onSelectTrack,
    onNavigateToFrame,
  } = props;
  const rowClass = [
    'physics-paint-track-row',
    kind === 'background' ? 'physics-paint-track-row-background' : '',
    visible === false ? 'physics-paint-track-row-hidden' : '',
    crossDestination ? 'physics-paint-track-row-cross-destination' : '',
  ].filter(Boolean).join(' ');
  // 47-01 UAT round 7: a click on a non-active row's frame cell activates the
  // row's track and navigates to the clicked frame. The frame is read from the
  // clicked cell's data-roto-app-frame (the row itself carries no frame).
  const handleRowClick = (event: MouseEvent) => {
    if (!onSelectTrack && !onNavigateToFrame) return;
    const target = event.target as HTMLElement | null;
    const cell = target?.closest?.('[data-roto-app-frame]') as HTMLElement | null;
    const frame = cell ? Number(cell.dataset.rotoAppFrame) : NaN;
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
            return (
              <span
                key={frame}
                className={`physics-paint-roto-cell ${TRACK_ROW_CELL_FILL_CLASS[state]}`}
                data-roto-app-frame={frame}
                aria-hidden="true"
              >
                {frame}
              </span>
            );
          })}
        </div>
        {/* 47-04 Task 3: paint-only filmstrip capsules for this row's Loop
            Clips — the strip projected every fact; the row stays
            presentational. The capsule layer is pointer-events none so row
            clicks keep reaching the cells below. */}
        {loopCapsules && loopCapsules.length > 0 ? (
          <div class="physics-paint-track-row-capsules" aria-hidden="true">
            {loopCapsules.map((capsule) => (
              <PhysicsPaintFilmstripCapsule
                key={capsule.presentation.loopId}
                presentation={capsule.presentation}
                geometry={capsule.geometry}
                repeat={capsule.repeat}
                sourceOffsets={capsule.sourceOffsets}
                sourceFrameCount={capsule.sourceFrameCount}
                cycleLength={capsule.cycleLength}
                cellWidth={ROW_CELL_WIDTH_PX}
              />
            ))}
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
