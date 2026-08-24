/**
 * 47-01 multi-track row slice: one 48px Paint (or Background) track row.
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
 */

import { physicPaintStore } from '../../../stores/physicPaintStore';

/** 47-01 geometry: shared frame pitch (same 18px as the active lane). */
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
 * One 48px track row's cells lane. The active track's row keeps the strip's
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
          style={{ gridTemplateColumns: `repeat(${frameCells.length}, ${ROW_CELL_WIDTH_PX}px)` }}
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
}

/**
 * One 48px header cell in the strip's pinned header column. Every row —
 * including the active lane and the fixed Background row — gets exactly one
 * header cell showing its track name (UI-SPEC header column layout). The
 * header column never scrolls horizontally with the frame cells (D-05).
 */
export function PhysicsPaintTrackRowHeader(props: PhysicsPaintTrackRowHeaderProps) {
  const {
    trackId,
    label,
    kind = 'paint',
    activeTrackId,
    onSelectTrack,
  } = props;
  const isActive = activeTrackId === trackId;
  const headerClass = [
    'physics-paint-track-row-header',
    isActive ? 'physics-paint-track-row-header-active' : '',
    kind === 'background' ? 'physics-paint-track-row-header-background' : '',
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
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelectTrack?.(trackId);
        }
      }}
    >
      <span class="physics-paint-track-row-label">{label}</span>
    </div>
  );
}
