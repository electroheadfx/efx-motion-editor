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
 * state (edit-in-place rename draft, vertical scrollbar geometry) and flows
 * it down as props, so the viewport test can invoke the column as a plain
 * component like `PhysicsPaintTrackRowHeader`.
 *
 * Every control binds to the 47-01 store-op surface through the prop bundle
 * — the column never mutates a row it does not target: row click selects via
 * onSelectTrack, the standing inline grip / eye / blend / name / trash
 * controls route reorder/visibility/blending/rename/delete intents (260911-s1j:
 * the ⋯ tools panel and its duplicate button are retired; 261022-iff: the
 * per-track S chip is retired — solo lives only on the playback pill), and the
 * '+' adds a track. The reorder
 * grab area is deliberately NOT
 * wired to any pointer drag here (the header-drag reorder gesture is 47-02
 * Task 2; content cross-track drag is 47-05 — D-18 keeps the two distinct).
 */

import type { Ref } from 'preact';
import type { BackgroundTrack, InternalPaintTrack, PhotoReferenceTrack } from '../../../efx-paint/document/efxPaintDocument';
import type { RailSetIdentity } from '../roto/physicsPaintRotoRailSetSelection';
import { PhysicsPaintTrackColumnStrip, PhysicsPaintTrackRowHeader } from './PhysicsPaintTrackRow';
import {
  TimelineMotionHeaderGroup,
  type TimelineMotionHeaderGroupProps,
} from './TimelineMotionChannels';
import { TIMELINE_GEOMETRY, TIMELINE_MOTION, type TimelineRailType } from './timelineRailDesign';

/** Row pitch of a collapsed header cell (mirrors the strip's
 *  `STRIP_ROW_HEIGHT_PX` — 31px rows). 59-11 (MUI-04): rows are no longer
 *  uniform — an expanded motion block adds one lane row per visible display
 *  lane below its rail row. When the strip supplies `rowLayout`, every height
 *  and the insertion indicator's offset come from that ONE layout array (the
 *  same instance the body consumes), so header and lanes cannot drift. This
 *  constant is the fallback for a legacy caller that supplies no layout. */
const HEADER_ROW_HEIGHT_PX = 31;

/** 59-11: the blank lane rows below an expanded block — the SAME geometry the
 *  body's `TimelineMotionChannelLane` rows use, so a lane's header spacer and
 *  its lane body start at the same offset. */
const HEADER_LANE_HEIGHT_PX = TIMELINE_GEOMETRY.motionLaneHeight;
const HEADER_POST_BLOCK_GAP_PX = TIMELINE_MOTION.postBlockGap;

/** The per-row slice of the strip's measured layout the header consumes.
 *  Structural on purpose: the column must not import the strip (the strip
 *  imports the column), and one structural type keeps a single authority. */
export interface PhysicsPaintTrackHeaderRowLayoutEntry {
  readonly trackId: string;
  readonly offset: number;
  readonly railHeight: number;
  readonly laneCount: number;
  readonly height: number;
}

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
  /** 49-06 UAT: true while a Bg clip rail is selected — the Bg row header
   *  paints the selected treatment (like a selected track) and NO normal track
   *  header paints active, so the Bg row reads as THE current selection. */
  readonly backgroundSelected?: boolean;
  /** The fixed Background track rendered as the locked last 'Bg' row (D-06). */
  readonly background: BackgroundTrack | null;
  /** Row-click intent; the strip wires it through setActiveTrackId (47-01). */
  readonly onSelectTrack: (trackId: string) => void;
  /** Eye-toggle intent (toggle); the strip wires it through setTrackVisible. */
  readonly onToggleVisible: (trackId: string) => void;
  /** Parent EFX Paint layer for the rows' per-track store reads. */
  readonly layerId?: string;
  /** Per-row frame-blending toggle intent (47 UAT). */
  readonly onToggleBlend?: (trackId: string) => void;
  /** '+' add-track intent; the strip wires it through addTrack. */
  readonly onAddTrack: () => void;
  /** Retained duplicate intent (260911-s1j: no row renders the button; the
   *  strip path stays wired for a later re-exposure). */
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
  /** 49-05 Task 1 (S1): the locked Bg row's Import control — the strip wires
   *  it through the Studio's picker swap signal (49-04 mount). The Bg row is
   *  the only header that carries an import affordance (D-06 lock semantics). */
  readonly onImportBackground?: () => void;
  /* ---- 50-UAT (modal redesign): the photo/reference affordance — a camera
     icon in the top strip (NOT a track row, per the 50-UAT redesign). One per
     document (REF-01). The icon opens the floating Photo Reference dialog
     (Import/Replace/Remove and every setting live there — the X-badge remove
     is gone, 50-UAT round 2). ---- */
  /** The document's photo/reference track (null = no source yet). */
  readonly photoReference?: PhotoReferenceTrack | null;
  /** The strip camera icon's open-dialog intent. */
  readonly onOpenReference?: () => void;
  /* ---- 52.5-01b Task 3 (D-02): the Document sound launcher in the top
     strip (same icon-not-a-track-row rule as the camera). ---- */
  /** True when the document carries a sound clip — the launcher tints. */
  readonly hasSound?: boolean;
  /** The strip launcher's open-Document-sound-modal intent. */
  readonly onOpenDocumentSound?: () => void;
  /** v2.0.1 (README §2): the active rail's type — the active track header
   *  paints its 3px left accent from this palette (neutral when null/absent).
   *  The Background header ignores it. */
  readonly selectedRailType?: TimelineRailType | null;
  /** 59-11: the selected rail identity of the ACTIVE track (key-rail or loop) —
   *  the header cells' chevrons read it to decide expand/collapse. Only the
   *  active track's rail is selectable, so every other header gets null. */
  readonly selectedRail?: RailSetIdentity | null;
  /** 59-11 (MUI-04): the strip's measured layout — the SAME array instance the
   *  lane body consumes. Header cell heights, lane spacer rows and the
   *  insertion indicator's offset all derive from it. */
  readonly rowLayout?: readonly PhysicsPaintTrackHeaderRowLayoutEntry[] | null;
  /** 261107-mkn: the ACTIVE track's channel header bundle — one header row per
   *  visible display lane, the 2px gap and the add-channel row, built by the
   *  strip from the same record/view/cursor the lane body consumes. Null (or a
   *  non-active track) renders the blank spacer fallback. */
  readonly motionHeader?: TimelineMotionHeaderGroupProps | null;
}

/**
 * The pinned 160px header column: the "Tracks N" strip with the '+' add
 * button, then one 31px header cell per Paint track plus the fixed muted
 * 'Bg' row, and the sidebar vertical pill scrollbar that only appears on
 * overflow. Hook-free by contract — the strip (or the test) invokes it as a
 * plain function.
 */
export function physicsPaintTrackHeaderColumn(props: PhysicsPaintTrackHeaderColumnProps) {
  const {
    tracks,
    activeTrackId,
    backgroundSelected = false,
    background,
    onSelectTrack,
    onToggleVisible,
    layerId,
    onToggleBlend,
    onAddTrack,
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
    headerRowsRef,
    headerColumnRef,
    onHeaderScroll,
    verticalScrollbar,
    onVerticalScrollbarPointerDown,
    onImportBackground,
    photoReference = null,
    onOpenReference,
    hasSound = false,
    onOpenDocumentSound,
    selectedRailType,
    selectedRail = null,
    rowLayout = null,
    motionHeader = null,
  } = props;
  const deletable = tracks.length > 1;
  const layoutById = new Map<string, PhysicsPaintTrackHeaderRowLayoutEntry>();
  for (const entry of rowLayout ?? []) layoutById.set(entry.trackId, entry);
  // 49-06 UAT: while a Bg clip is selected, NO normal track header paints the
  // active accent — the Bg row is the only "selected" header. The document's
  // active track is unchanged (the rich lane still renders it); this blanks
  // only the header highlight.
  const effectiveActiveTrackId = backgroundSelected ? '' : activeTrackId;
  return (
    <div ref={headerColumnRef} class="physics-paint-header-column">
      <PhysicsPaintTrackColumnStrip
        trackCount={tracks.length}
        onAddTrack={onAddTrack}
        hasReference={photoReference !== null && photoReference.sourceFrameRefs.length > 0}
        onOpenReference={onOpenReference}
        hasSound={hasSound}
        onOpenDocumentSound={onOpenDocumentSound}
      />
      <div class="physics-paint-header-rows-wrap">
        <div ref={headerRowsRef} class="physics-paint-header-rows" onScroll={onHeaderScroll}>
          {tracks.map((track) => {
            const layoutEntry = layoutById.get(track.id) ?? null;
            const laneCount = layoutEntry?.laneCount ?? 0;
            const headerCell = (
              <PhysicsPaintTrackRowHeader
                key={track.id}
                trackId={track.id}
                label={track.name}
                activeTrackId={effectiveActiveTrackId}
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
                layerId={layerId}
                onToggleBlend={onToggleBlend}
                onDeleteTrack={onRequestDeleteTrack}
                onGripPointerDown={onGripPointerDown}
                selectedRailType={selectedRailType}
                // 59-11: only the active track's rail can be selected, so only
                // its header may offer an interactive chevron.
                selectedRail={track.id === activeTrackId ? selectedRail : null}
              />
            );
            if (laneCount === 0) return headerCell;
            // 59-11 (MUI-04): the header side of an expanded motion block. The
            // group height is the layout entry's height, so the next header's
            // top matches the next row's rail top exactly.
            return (
              <div
                key={track.id}
                class="physics-paint-track-header-group"
                data-header-lane-count={laneCount}
                style={{ display: 'flex', flexDirection: 'column', height: `${layoutEntry!.height}px` }}
              >
                {headerCell}
                {/* 261107-mkn: the active track's channel headers render INSIDE
                    the pinned column, lane-for-lane with the body. Comparing
                    against the document's `activeTrackId` (never the
                    background-blanked id) keeps the band alive while a Bg clip
                    is selected — only the rail accent blanks. */}
                {motionHeader !== null && track.id === activeTrackId ? (
                  <TimelineMotionHeaderGroup {...motionHeader} />
                ) : (
                  <div class="physics-paint-track-header-lanes" aria-hidden="true" style={{ display: 'flex', flexDirection: 'column' }}>
                    {Array.from({ length: laneCount }, (_, index) => (
                      <div
                        key={index}
                        class="physics-paint-track-header-lane"
                        style={{ height: `${HEADER_LANE_HEIGHT_PX}px` }}
                      />
                    ))}
                    <div
                      class="physics-paint-track-header-lane-gap"
                      style={{ height: `${HEADER_POST_BLOCK_GAP_PX}px` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {/* 47-02 Task 2: the live reorder insertion indicator — a 2px line at
              the target row's rail boundary inside the pinned band (TML-05,
              D-08). 59-11: the offset comes from the SAME measured layout the
              body uses, so a block never shifts the line off a rail. Rendered
              only while a header-grab drag is live. */}
          {reorderDragTrackId !== null && typeof reorderDragIndex === 'number' ? (
            <div
              class="physics-paint-track-row-insertion-indicator"
              data-insertion-index={reorderDragIndex}
              style={{
                top: `${rowLayout !== null && rowLayout[reorderDragIndex] !== undefined
                  ? rowLayout[reorderDragIndex]!.offset
                  : reorderDragIndex * HEADER_ROW_HEIGHT_PX}px`,
              }}
              aria-hidden="true"
            />
          ) : null}
          {background ? (
            <PhysicsPaintTrackRowHeader
              key={background.id}
              trackId={background.id}
              label="Bg"
              kind="background"
              selected={backgroundSelected}
              onImportBackground={onImportBackground}
              selectedRailType={selectedRailType}
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
