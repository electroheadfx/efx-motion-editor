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
 * every Paint header gains the reorder grip + hover tools (eye / pencil /
 * copy / trash-2). The Background row stays a fixed muted row with lock
 * semantics — no reorder grab, no rename, no duplicate, no delete (D-06).
 */

import { Copy, Eye, EyeOff, GripVertical, Layers, Lock, Pencil, Plus, Trash2 } from 'lucide-preact';
import { physicPaintStore } from '../../../stores/physicPaintStore';

/** 47-01 geometry: shared frame pitch (same 18px as the active track). */
const ROW_CELL_WIDTH_PX = 18;

export type PhysicsPaintTrackRowKind = 'paint' | 'background';

export interface PhysicsPaintTrackRowProps {
  /** The stable track UUID this row renders — identity, never an array index. */
  readonly trackId: string;
  /** Parent EFX Paint layer the runtime store keys on. */
  readonly layerId: string;
  /** The strip-level shared horizontal extent (frameCells), mapped 1:1 per row. */
  readonly frameCells: readonly number[];
  /** 'background' renders the fixed muted Bg row skeleton. */
  readonly kind?: PhysicsPaintTrackRowKind;
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
  } = props;
  const rowClass = [
    'physics-paint-track-row',
    kind === 'background' ? 'physics-paint-track-row-background' : '',
  ].filter(Boolean).join(' ');
  return (
    <div class={rowClass} data-track-id={trackId}>
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
                class={`physics-paint-roto-cell ${TRACK_ROW_CELL_FILL_CLASS[state]}`}
                data-roto-app-frame={frame}
                aria-hidden="true"
              >
                {frame}
              </span>
            );
          })}
        </div>
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
  /** Copy intent — routes through duplicateTrack. */
  readonly onDuplicateTrack?: (trackId: string) => void;
  /** Trash intent — routes through requestDeleteTrack/commitDeleteTrack. */
  readonly onDeleteTrack?: (trackId: string) => void;
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
    onDuplicateTrack,
    onDeleteTrack,
  } = props;
  const isActive = activeTrackId === trackId;
  const isBackground = kind === 'background';
  const headerClass = [
    'physics-paint-track-row-header',
    isActive ? 'physics-paint-track-row-header-active' : '',
    isBackground ? 'physics-paint-track-row-header-background' : '',
  ].filter(Boolean).join(' ');
  return (
    <div
      class={headerClass}
      data-track-id={trackId}
      role="button"
      tabIndex={0}
      aria-label={`Select track ${label}`}
      onClick={() => onSelectTrack?.(trackId)}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && !editing) {
          event.preventDefault();
          onSelectTrack?.(trackId);
        }
      }}
    >
      {isBackground ? (
        <>
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
        </>
      ) : editing ? (
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
            element?.focus();
            element?.select();
          }}
        />
      ) : (
        <>
          {reorderable ? (
            <span class="physics-paint-track-row-grip" title="Drag to reorder" aria-hidden="true">
              <GripVertical size={12} />
            </span>
          ) : null}
          <span class="physics-paint-track-row-label" title={label}>{label}</span>
          <span class="physics-paint-track-row-tools" role="group" aria-label={`${label} actions`}>
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
            <button
              type="button"
              class="physics-paint-track-row-tool-button"
              aria-label={`Rename ${label}`}
              title={`Rename ${label}`}
              onClick={(event) => {
                event.stopPropagation();
                onStartRename?.(trackId);
              }}
            >
              <Pencil size={12} aria-hidden="true" />
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
