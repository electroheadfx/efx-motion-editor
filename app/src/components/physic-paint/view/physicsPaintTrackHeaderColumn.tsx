/**
 * 47-02 Task 1: the pinned header column of the multi-track timeline
 * (TML-01/02/03/07, D-01/D-02/D-04/D-06/D-07/D-08).
 *
 * A fixed 160px column listing every `InternalPaintTrack` in document order
 * plus the fixed Background row always at the bottom (D-06). It sits OUTSIDE
 * the horizontal scroller so it never scrolls away with the frame cells, and
 * its header-rows band shares the rows-region's vertical scroll position
 * (D-05, 47-01 UAT round 4: the band stays in lockstep with the rows).
 *
 * The component is presentational and hook-free: the strip owns the session
 * state (edit-in-place rename draft, more-button tools panel, vertical
 * scrollbar geometry) and flows it down as props, so the viewport test can
 * invoke the column as a plain component like `PhysicsPaintTrackRowHeader`.
 *
 * Every control binds to the 47-01 store-op surface through the prop bundle
 * — the column never mutates a row it does not target: row click selects via
 * onSelectTrack, the standing eye toggle and the tools-panel solo toggle
 * route visibility/solo intents, the '+' adds a track, and the more-panel
 * holds solo/duplicate/delete (47 UAT: the pencil is gone — a double-click
 * on the name renames in place). The reorder grab area is deliberately NOT
 * wired to any pointer drag here (the header-drag reorder gesture is 47-02
 * Task 2; content cross-track drag is 47-05 — D-18 keeps the two distinct).
 */

import type { Ref } from 'preact';
import type { BackgroundTrack, InternalPaintTrack } from '../../../efx-paint/document/efxPaintDocument';
import { PhysicsPaintTrackColumnStrip, PhysicsPaintTrackRowHeader } from './PhysicsPaintTrackRow';

/** Row pitch of the pinned header cells (mirrors the strip's
 *  `STRIP_ROW_HEIGHT_PX` — 47-01 UAT round 3 approved 30px rows). The insertion
 *  indicator positions itself at `index * HEADER_ROW_HEIGHT_PX` inside the
 *  band, so it lands exactly on the target row boundary. */
const HEADER_ROW_HEIGHT_PX = 30;

/** Vertical pill-scrollbar geometry produced by the strip's scroll math. */
export interface PhysicsPaintHeaderVerticalScrollbar {
  readonly top: number;
  readonly height: number;
  readonly visible: boolean;
}

export interface PhysicsPaintTrackHeaderColumnProps {
  /** Every InternalPaintTrack in document order — each renders as one row. */
  readonly tracks: readonly InternalPaintTrack[];
  /** The document's active track id — the matching row gets the accent (D-04). */
  readonly activeTrackId: string;
  /** The fixed Background track rendered as the locked last 'Bg' row (D-06). */
  readonly background: BackgroundTrack | null;
  /** Row-click intent; the strip wires it through setActiveTrackId (47-01). */
  readonly onSelectTrack: (trackId: string) => void;
  /** Eye-toggle intent (toggle); the strip wires it through setTrackVisible. */
  readonly onToggleVisible: (trackId: string) => void;
  /** 'S' solo-toggle intent; the strip wires it through setTrackSolo. */
  readonly onToggleSolo: (trackId: string) => void;
  /** '+' add-track intent; the strip wires it through addTrack. */
  readonly onAddTrack: () => void;
  /** Duplicate intent; the strip wires it through duplicateTrack. */
  readonly onDuplicateTrack: (trackId: string) => void;
  /** Delete intent; the strip opens the acknowledge-and-delete dialog. */
  readonly onRequestDeleteTrack: (trackId: string) => void;
  /** 47-02 Task 2: the reorder grab's pointerdown intent — the strip owns the
   *  drag session (D-08/D-18); the grab is the ONLY element wired to it. */
  readonly onGripPointerDown?: (event: PointerEvent, trackId: string) => void;
  /** 47-02 Task 2: the track whose header-drag is live, or null. */
  readonly reorderDragTrackId?: string | null;
  /** 47-02 Task 2: the live insertion index the indicator renders at. */
  readonly reorderDragIndex?: number | null;
  /* ---- 47-01 approved UX state, owned by the strip, flowing down ---- */
  /** The track currently edited in place, or null. */
  readonly renamingTrackId?: string | null;
  /** Live rename draft value shown by the edit input. */
  readonly renameDraft?: string;
  /** Pencil clicked — the strip enters edit-in-place mode. */
  readonly onStartRename?: (trackId: string) => void;
  /** Rename input change — live draft update. */
  readonly onRenameDraftChange?: (trackId: string, value: string) => void;
  /** Rename Enter — the strip commits renameTrack(trackId, draft). */
  readonly onCommitRename?: (trackId: string) => void;
  /** Rename Escape/blur — the strip abandons the edit. */
  readonly onCancelRename?: () => void;
  /** The row whose more-button tools panel is open, or null (one at a time). */
  readonly toolsOpenTrackId?: string | null;
  /** More-button click — toggles the tool panel for this track. */
  readonly onToggleTools?: (trackId: string) => void;
  /** Pointer left the panel (or the header) — closes it. */
  readonly onCloseTools?: () => void;
  /** The header-rows band element, synced with the rows-region (D-05). */
  readonly headerRowsRef?: Ref<HTMLDivElement>;
  /** 47-02 Task 3: the pinned header-column element — never scrolls (D-01).
   *  The strip owns the ref so the pinned contract stays observable. */
  readonly headerColumnRef?: Ref<HTMLDivElement>;
  /** Header-band scroll event — mirrors the rows-region scrollTop. */
  readonly onHeaderScroll?: () => void;
  /** The sidebar vertical pill scrollbar geometry (47-01 UAT round 4). */
  readonly verticalScrollbar?: PhysicsPaintHeaderVerticalScrollbar | null;
  /** Pill pointerdown — drag/click scrolls the rows region. */
  readonly onVerticalScrollbarPointerDown?: (event: PointerEvent) => void;
}

/**
 * The pinned 160px header column: the "Tracks N" strip with the '+' add
 * button, then one 30px header cell per Paint track plus the fixed muted
 * 'Bg' row, and the sidebar vertical pill scrollbar that only appears on
 * overflow. Hook-free by contract — the strip (or the test) invokes it as a
 * plain function.
 */
export function physicsPaintTrackHeaderColumn(props: PhysicsPaintTrackHeaderColumnProps) {
  const {
    tracks,
    activeTrackId,
    background,
    onSelectTrack,
    onToggleVisible,
    onToggleSolo,
    onAddTrack,
    onDuplicateTrack,
    onRequestDeleteTrack,
    onGripPointerDown,
    reorderDragTrackId = null,
    reorderDragIndex = null,
    renamingTrackId = null,
    renameDraft = '',
    onStartRename,
    onRenameDraftChange,
    onCommitRename,
    onCancelRename,
    toolsOpenTrackId = null,
    onToggleTools,
    onCloseTools,
    headerRowsRef,
    headerColumnRef,
    onHeaderScroll,
    verticalScrollbar,
    onVerticalScrollbarPointerDown,
  } = props;
  const deletable = tracks.length > 1;
  return (
    <div ref={headerColumnRef} class="physics-paint-header-column">
      <PhysicsPaintTrackColumnStrip trackCount={tracks.length} onAddTrack={onAddTrack} />
      <div class="physics-paint-header-rows-wrap">
        <div ref={headerRowsRef} class="physics-paint-header-rows" onScroll={onHeaderScroll}>
          {tracks.map((track) => (
            <PhysicsPaintTrackRowHeader
              key={track.id}
              trackId={track.id}
              label={track.name}
              activeTrackId={activeTrackId}
              onSelectTrack={onSelectTrack}
              visible={track.visible}
              reorderable
              deletable={deletable}
              editing={renamingTrackId === track.id}
              renameValue={renameDraft}
              onStartRename={onStartRename}
              onRenameDraftChange={onRenameDraftChange}
              onCommitRename={onCommitRename}
              onCancelRename={onCancelRename}
              onToggleVisible={(trackId) => onToggleVisible(trackId)}
              onToggleSolo={onToggleSolo}
              onDuplicateTrack={onDuplicateTrack}
              onDeleteTrack={onRequestDeleteTrack}
              toolsOpen={toolsOpenTrackId === track.id}
              onToggleTools={onToggleTools}
              onCloseTools={onCloseTools}
              onGripPointerDown={onGripPointerDown}
            />
          ))}
          {/* 47-02 Task 2: the live reorder insertion indicator — a 2px line at
              the target index's row boundary inside the pinned band (TML-05,
              D-08). Rendered only while a header-grab drag is live. */}
          {reorderDragTrackId !== null && typeof reorderDragIndex === 'number' ? (
            <div
              class="physics-paint-track-row-insertion-indicator"
              data-insertion-index={reorderDragIndex}
              style={{ top: `${reorderDragIndex * HEADER_ROW_HEIGHT_PX}px` }}
              aria-hidden="true"
            />
          ) : null}
          {background ? (
            <PhysicsPaintTrackRowHeader
              key={background.id}
              trackId={background.id}
              label="Bg"
              kind="background"
            />
          ) : null}
        </div>
        {verticalScrollbar?.visible ? (
          <div
            class="physics-paint-vertical-scrollbar"
            onPointerDown={onVerticalScrollbarPointerDown}
          >
            <span
              class="physics-paint-vertical-scrollbar-thumb"
              style={{ top: `${verticalScrollbar.top}px`, height: `${verticalScrollbar.height}px` }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
