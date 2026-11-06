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
 * 260911-s1j mockup redesign (the user's design-direction change): every
 * Paint row's controls are standing inline — reorder grip, eye, solo S,
 * frame-blending, the right-pushed name, and the trash pinned far right. The
 * ⋯ tools panel, its duplicate button, and the 260911-sli solo badge are
 * retired: the inline S itself is the row-level solo indicator. The
 * Background row stays a fixed muted row with lock semantics — no reorder
 * grab, no rename, no duplicate, no delete (D-06).
 */

import type { CSSProperties } from 'preact';
import { signal } from '@preact/signals';
import { useRef } from 'preact/hooks';
import { AudioWaveform, Blend, Camera, ChevronDown, ChevronRight, Eye, EyeOff, GripVertical, ImagePlus, Layers, Lock, Minus, Plus, Trash2 } from 'lucide-preact';
import { getTrackRotorRevision, physicPaintStore } from '../../../stores/physicPaintStore';
import { assignRailMotionRailViews, type RailMotionRailView } from '../roto/railMotionIdentity';
import type { PhysicPaintRotoRailMotionChannelId, PhysicPaintRotoRailMotionRecord } from '../roto/railMotionModel';
import type { RailSetIdentity } from '../roto/physicsPaintRotoRailSetSelection';
import {
  resolveVisibleMotionDisplayLanes,
  TimelineMotionBlockOutline,
  TimelineMotionChannelLane,
  TimelineMotionChannelMenu,
  type RailMotionDisplayLaneView,
} from './TimelineMotionChannels';
import { deriveKeyRailSegments, type KeyRailSegment } from './physicsPaintKeyRailPresentation';
import {
  derivePhysicPaintRotoLoopRanges,
  type PhysicPaintRotoFrameResolution,
  type PhysicPaintRotoLoopResolutionContext,
} from '../roto/physicsPaintRotoPhysicalResolver';
import { resolveRotoVisibleFrameResolutions } from '../roto/rotoTimelineSelectors';
import {
  projectPhysicsPaintBackgroundClipPresentation,
  projectPhysicsPaintLoopClipGeometry,
  type PhysicsPaintBackgroundClipPresentation,
} from './physicsPaintLoopClipPresentation';
import { classifyLoopClipRailKind, getRotoRailKindLabel, type RotoRailKind } from './physicsPaintWorkflowPresentation';
import {
  projectTimelineRailLineWidth,
  resolveTimelineCellPresentation,
  resolveTimelineRailPalette,
  resolveTimelineRailType,
  resolveTrackAccentColor,
  timelineRailCellStyle,
  TIMELINE_MOTION,
  TIMELINE_SURFACE,
  type TimelineRailType,
} from './timelineRailDesign';
import type { BackgroundTrack, FrameLoopClip } from '../../../efx-paint/document/efxPaintDocument';
import type {
  BackgroundClipDragApi,
  BackgroundClipDragGhostState,
  BackgroundClipDragPreviewState,
} from '../hooks/usePhysicsPaintBackgroundClipDrag';
import type { BackgroundClipResizeApi } from '../hooks/usePhysicsPaintBackgroundClipResize';
import { PhysicsPaintStyledTooltip, useStyledTooltip } from './PhysicsPaintStyledTooltip';
import { countRender } from '../performance/renderCounters';

/** 47-01 geometry: the same 18px frame pitch as the active track. */
const ROW_CELL_WIDTH_PX = 18;

/**
 * 49-06 (UAT round 9): the filmstrip cap — a Bg rail shows the source image on
 * at most this many cells. The images are already decoded in the runtime
 * registry, but each cell downscales the (≤2048px) dataUrl, so very long clips
 * stay light by leaving cells past the cap on the neutral fill.
 */
const MAX_BG_CELL_IMAGES = 30;

/**
 * 49-06 (UAT round 9): the per-cell source dataUrl for one Bg clip's filmstrip.
 * Cell i covers frame `startFrame + i`, which the resolver maps to
 * `sourceFrameRefs[i % refs.length]` (the clip's own source cycle). Null when
 * the ref has no registered bytes (not yet hydrated / dangling) — the cell
 * falls back to the neutral fill.
 */
function resolveBackgroundClipCellImages(clip: FrameLoopClip, cellCount: number): readonly (string | null)[] {
  const refs = clip.sourceFrameRefs;
  if (refs.length === 0) return [];
  const images: (string | null)[] = [];
  const capped = Math.min(cellCount, MAX_BG_CELL_IMAGES);
  for (let index = 0; index < capped; index += 1) {
    images.push(physicPaintStore.getBackgroundSourceImageUrl(refs[index % refs.length]));
  }
  return images;
}

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
  /**
   * 261023-bji: true while the session Solo is armed. Every instance of this
   * row is by construction a NON-target track — the solo target (the active
   * track) renders as the rich lane, not through this component — so the
   * strip dims every row instance unconditionally. The fixed Background
   * instance is deliberately never given this prop: a Paint solo leaves the
   * Background participating, so dimming it would be a lie.
   */
  readonly soloDimmed?: boolean;
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
  /** studio-realm-divergence: consumes the post-cross-track-drag click. A rail
   *  grab can now START on this read-only row; after a crossed drop the
   *  browser still clicks the source rail, and that click must not
   *  re-activate the SOURCE track over the drop's destination activation. */
  readonly consumeCrossTrackClickSuppression?: () => boolean;
  /** 49-06 (UAT round 2): clicking an EMPTY Background row cell is the
   *  placement gesture — it selects the target frame (the import icon then
   *  imports AT that frame) and clears any selected Bg clip so the right-panel
   *  Track section stays reachable. The Bg row never navigates/selects, so this
   *  is its only cell-click intent. */
  readonly onSelectBackgroundFrame?: (frame: number) => void;
  /** 49-06 (UAT round 8): click-to-select a Bg clip — the whole rail's onClick
   *  routes here (the right-panel Background Clip section consumes it). */
  readonly onSelectBackgroundClip?: (clipId: string) => void;
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
  /* ---- 59-11: rail motion hosting (chevron + expanded channel block) ---- */
  /** The document's selected rail identity (session state owned by the strip). */
  readonly rotoSelectedRail?: RailSetIdentity | null;
  /** This track's stored motion records (absent = read through the store). */
  readonly rotoRailMotions?: readonly PhysicPaintRotoRailMotionRecord[];
  /** This track's 59-06 rail projections (absent = read through the store). */
  readonly rotoRailViews?: readonly RailMotionRailView[];
  /** Motion-key selection intent — the motion key clicked in a lane. */
  readonly onSelectMotionKey?: (frame: number) => void;
  /** Previous/next Motion key intent (direction resolved from the lane click). */
  readonly onMotionCursorStep?: (direction: -1 | 1) => void;
  /** Diamond intent — add/remove a Motion key at the cursor frame. */
  readonly onToggleMotionKeyAtCursor?: (channelId: PhysicPaintRotoRailMotionChannelId) => void;
  /** The expanded block's add-channel menu intent. */
  readonly onAddMotionChannel?: (channelId: PhysicPaintRotoRailMotionChannelId) => void;
  /** Host-owned menu visibility for the keyless add-channel row (59-12 wires it). */
  readonly motionChannelMenuOpen?: boolean;
  /** The measured row height from the strip's one layout (rail row + lanes + gap). */
  readonly motionRowHeightPx?: number | null;
  /** The playhead in the selected rail's local frame space (59-12 wires it). */
  readonly motionCursorFrame?: number;
}

type TrackRowCellState = 'cached' | 'generated' | 'empty';

/**
 * Resolve one cell's content state for the ROW's track only. A real key, a
 * linked source occurrence, or a painted frame marks the cell 'cached'
 * (roto-fill-cached); a generated interior marks it 'generated'; everything
 * else is transparent (roto-fill-empty). The render-source authority stays
 * the store — the row never reads the active track's projection for another
 * track's cells (T-47-04).
 *
 * 261104-so5: the resolved `sourceKind` is carried out because the state alone
 * cannot tell a real key from a painted phase. A lifecycle Group frame
 * override resolves through `getRotoRealKeyRecord` (which searches both
 * `_rotoRealKeyRecords` and `_rotoGroupOverrideRecords`), so it reports kind
 * 'real' even though it has no app-frame real-key record — the cell loop needs
 * that distinction to match the active lane's projection-based classification.
 */
function resolveTrackRowCellSignals(
  layerId: string,
  trackId: string,
  frame: number,
): { state: TrackRowCellState; sourceKind: 'real' | 'generated' | null } {
  const source = physicPaintStore.getRotoPhysicalRenderSource(layerId, trackId, frame);
  if (source && source.kind !== 'loop-placeholder') {
    return {
      state: source.kind === 'generated' ? 'generated' : 'cached',
      sourceKind: source.kind,
    };
  }
  return {
    state: physicPaintStore.getFrame(layerId, trackId, frame) ? 'cached' : 'empty',
    sourceKind: null,
  };
}

const TRACK_ROW_CELL_FILL_CLASS: Record<TrackRowCellState, string> = {
  cached: 'roto-fill-cached',
  generated: 'roto-fill-generated',
  empty: 'roto-fill-empty',
};

const EMPTY_TRACK_ROW_RAIL_SEGMENTS: readonly KeyRailSegment[] = Object.freeze([]);
const EMPTY_TRACK_ROW_LOOP_LINES: readonly TrackRowLoopLine[] = Object.freeze([]);
const EMPTY_GHOST_SOURCE_KEY_IDS: ReadonlySet<string> = new Set<string>();

/**
 * v2.0.1 UAT (ghost-key fix): a clip source key whose physical frame sits
 * outside every visible range of every clip that references it is internal
 * source payload, not a timeline key. It must not paint as an ordinary key
 * cell (the green "keys which do not exist" on non-active rows).
 */
function resolveGhostSourceKeyIds(layerId: string, trackId: string): ReadonlySet<string> {
  const clips = physicPaintStore.getRotoPhysicalLoopClips(layerId, trackId);
  if (clips.length === 0) return EMPTY_GHOST_SOURCE_KEY_IDS;
  const rangesByKeyId = new Map<string, { start: number; endExclusive: number }[]>();
  for (const clip of clips) {
    const ranges = clip.visibleRanges;
    if (!ranges || ranges.length === 0) continue;
    for (const keyId of clip.sourceKeyIds) {
      const existing = rangesByKeyId.get(keyId);
      if (existing) existing.push(...ranges);
      else rangesByKeyId.set(keyId, [...ranges]);
    }
  }
  if (rangesByKeyId.size === 0) return EMPTY_GHOST_SOURCE_KEY_IDS;
  const frameByKeyId = new Map(
    physicPaintStore.getRotoRealKeyRecords(layerId, trackId).map((record) => [record.keyId, record.appFrame]),
  );
  const ghosts = new Set<string>();
  for (const [keyId, ranges] of rangesByKeyId) {
    const frame = frameByKeyId.get(keyId);
    if (frame === undefined) continue;
    if (!ranges.some((range) => frame >= range.start && frame < range.endExclusive)) ghosts.add(keyId);
  }
  return ghosts.size === 0 ? EMPTY_GHOST_SOURCE_KEY_IDS : ghosts;
}

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
  /** v2.0.1: the continuous range the line paints (phaseOrigin → resolved
   *  end) — the cell rail-type map fills over `[startFrame, endFrameExclusive)`. */
  readonly startFrame: number;
  readonly endFrameExclusive: number;
  readonly mode: 'progressive' | 'static';
  /** 52-04 (D-03/D-19): the rail kind — the reveal rail is the 4th rail kind;
   *  the row classifies it so the reveal green line reads on every track. */
  readonly railKind: RotoRailKind;
  readonly unresolved: boolean;
  /** studio-realm-divergence: the loop's source key identities, carried on the
   *  rail DOM so a cross-track drag from a NON-active row resolves without the
   *  active lane's loop context. */
  readonly sourceKeyIds: readonly string[];
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

/* ---------------------------------------------------------------------------
 * Phase 59 plan 11: rail motion hosting.
 *
 * The v2.0.1 grey motion slot becomes a real per-rail chevron, and an animated
 * rail opens ONE session-only channel block beneath its rail row. Expansion is
 * session state: it is never persisted, never enters the document, and is
 * written ONLY by the chevron toggle (D-03/MUI-01/MUI-04).
 * ------------------------------------------------------------------------- */

/** The rail row's own height (the strip's 31px row unit, one authority). */
const TRACK_ROW_RAIL_HEIGHT_PX = 31;

export type MotionChevronKind = 'minus' | 'chevron-right' | 'chevron-down';

export interface RailMotionHostFacts {
  readonly views: readonly RailMotionRailView[];
  readonly records: readonly PhysicPaintRotoRailMotionRecord[];
}

const EMPTY_RAIL_MOTION_HOST_FACTS: RailMotionHostFacts = Object.freeze({
  views: Object.freeze([]) as readonly RailMotionRailView[],
  records: Object.freeze([]) as readonly PhysicPaintRotoRailMotionRecord[],
});

const EMPTY_MOTION_DISPLAY_LANES: readonly RailMotionDisplayLaneView[] = Object.freeze([]);

/**
 * Session-only expansion identity: ONE rail block can be open, and it is the
 * selected rail of the active track. Initialised null; the chevron toggle is
 * the only writer. Never persisted, never part of the document allowlist or
 * the revision fingerprint.
 */
export const railMotionExpandedSelection = signal<RailSetIdentity | null>(null);

function sameRailSetIdentity(left: RailSetIdentity, right: RailSetIdentity): boolean {
  return left.kind === right.kind
    && (left.kind === 'loop'
      ? (right.kind === 'loop' && left.loopId === right.loopId)
      : (right.kind === 'key-rail' && left.firstKeyId === right.firstKeyId));
}

/**
 * This track's rail projections and stored motion records. The views are
 * 59-06's assignment over the SAME loop clips and Key Rail segments the row
 * paints, so a rail's motion identity always matches its visible rail.
 */
export function readTrackRailMotionFacts(layerId: string, trackId: string): RailMotionHostFacts {
  const records = physicPaintStore.getRotoPhysicalRailMotions(layerId, trackId);
  const loopClips = physicPaintStore.getRotoPhysicalLoopClips(layerId, trackId);
  const keyRailSegments = resolveTrackRowRailSegments(layerId, trackId);
  if (records.length === 0 && loopClips.length === 0 && keyRailSegments.length === 0) {
    return EMPTY_RAIL_MOTION_HOST_FACTS;
  }
  return {
    views: assignRailMotionRailViews(records, loopClips, keyRailSegments),
    records,
  };
}

/**
 * The durable `railId` of the SELECTED rail when that rail carries motion.
 * Loop identity resolves through `loopId`; Key Rail identity resolves through
 * the assigned view's `anchorKeyId` and yields its bound `railId` — never the
 * raw `firstKeyId`, which is only a recovery hint.
 */
export function resolveSelectedRailMotionId(
  views: readonly RailMotionRailView[],
  selectedRail: RailSetIdentity | null,
): string | null {
  if (selectedRail === null) return null;
  if (selectedRail.kind === 'loop') {
    for (const view of views) {
      if (view.loopId === selectedRail.loopId) return view.railId;
    }
    return null;
  }
  for (const view of views) {
    if (view.loopId !== null) continue;
    if (view.anchorKeyId === selectedRail.firstKeyId && view.railId !== null) return view.railId;
  }
  return null;
}

export interface MotionBlockExpansionInput {
  readonly expandedSelection: RailSetIdentity | null;
  readonly selectedRail: RailSetIdentity | null;
  readonly selectedRailMotionId: string | null;
}

/** True only while the recorded expansion identity still IS the selected rail. */
export function resolveMotionBlockExpanded(input: MotionBlockExpansionInput): boolean {
  if (input.selectedRail === null || input.selectedRailMotionId === null || input.expandedSelection === null) {
    return false;
  }
  return sameRailSetIdentity(input.expandedSelection, input.selectedRail);
}

export interface MotionChevronInput {
  readonly hasMotion: boolean;
  readonly expanded: boolean;
}

/** The chevron's three-state glyph (MUI-01). */
export function resolveMotionChevronKind(input: MotionChevronInput): MotionChevronKind {
  if (!input.hasMotion) return 'minus';
  return input.expanded ? 'chevron-down' : 'chevron-right';
}

/**
 * The chevron toggle — the ONLY writer of `railMotionExpandedSelection`. A
 * no-op when the selected rail carries no motion. Clicking the open rail
 * collapses it; clicking any other motion-bearing rail opens that one.
 */
export function toggleRailMotionExpansion(
  selectedRail: RailSetIdentity | null,
  selectedRailMotionId: string | null,
): void {
  const current = railMotionExpandedSelection.value;
  const next = selectedRail === null || selectedRailMotionId === null
    ? null
    : (current !== null && sameRailSetIdentity(current, selectedRail) ? null : selectedRail);
  railMotionExpandedSelection.value = next;
}

export function resolveMotionRecordForRail(
  records: readonly PhysicPaintRotoRailMotionRecord[],
  railId: string | null,
): PhysicPaintRotoRailMotionRecord | null {
  if (railId === null) return null;
  return records.find((record) => record.railId === railId) ?? null;
}

/** A record carries motion only while at least one DISPLAY lane has keys. */
export function resolveRailMotionHasKeys(record: PhysicPaintRotoRailMotionRecord | null): boolean {
  if (record === null) return false;
  return record.channels.some((channel) => channel.keys.length > 0);
}

export interface TrackMotionLaneCountInput extends MotionBlockExpansionInput {
  readonly views: readonly RailMotionRailView[];
  readonly record: PhysicPaintRotoRailMotionRecord | null;
}

/**
 * A DISPLAY-lane count: 0 unless this row's selected rail block is expanded.
 * The non-zero branch is 59-10's projection, so grouped Position counts once
 * and a rail keyed on all five model channels contributes four lanes.
 */
export function resolveTrackMotionLaneCount(input: TrackMotionLaneCountInput): number {
  if (input.record === null) return 0;
  if (!resolveMotionBlockExpanded(input)) return 0;
  return resolveVisibleMotionDisplayLanes(input.record.channels).length;
}

interface TrackRowLoopVisuals {
  readonly lines: readonly TrackRowLoopLine[];
  /** Per-frame linked-loop classes identical to the active lane's cells
   *  (repeat gray + dot, source key/gap/generated) — UAT round 10 parity. */
  readonly linkedClassByFrame: ReadonlyMap<number, string>;
  /** v2.0.1: repeat instance per frame (source cycle = 0) — feeds the cycle
   *  parity of the cell matrix. */
  readonly repeatByFrame: ReadonlyMap<number, number>;
  /** v2.0.1: the owning loop rail's type per frame, filled over each line's
   *  continuous range (first write wins). */
  readonly railTypeByFrame: ReadonlyMap<number, TimelineRailType>;
}

const EMPTY_TRACK_ROW_LOOP_VISUALS: TrackRowLoopVisuals = Object.freeze({
  lines: EMPTY_TRACK_ROW_LOOP_LINES,
  linkedClassByFrame: new Map(),
  repeatByFrame: new Map(),
  railTypeByFrame: new Map(),
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
      startFrame: continuousRange.placementStart,
      endFrameExclusive: resolvedEnd,
      mode: clip?.mode ?? 'progressive',
      // 261031-vbo (Quick C1): one classifier for the active lane and the
      // non-active rows — a merged (provenance-free) clip is 'standard'.
      railKind: classifyLoopClipRailKind(clip),
      unresolved: Boolean(continuousRange.unresolved),
      sourceKeyIds: range.sourceKeyIds,
    });
  }
  // Per-frame linked-loop cell classes — the same mapping the active lane's
  // cells use (repeat frames paint gray with the dot, source cycle frames keep
  // their key/generated treatments), so a loop's repeat design never changes
  // when the track is selected or not.
  const resolutions = resolveRotoVisibleFrameResolutions(context, frameCells);
  const linkedClassByFrame = new Map<number, string>();
  // v2.0.1 cell matrix inputs: repeat parity for every linked occurrence past
  // the source cycle, and the loop rail type over the line's continuous range
  // (clipped to the row capacity, first write wins — the same winning-first
  // authority the drawn lines use).
  const repeatByFrame = new Map<number, number>();
  const railTypeByFrame = new Map<number, TimelineRailType>();
  for (const [frame, resolution] of resolutions) {
    if (resolution.kind === 'empty' || resolution.kind === 'real') continue;
    if ('repeatInstance' in resolution && resolution.repeatInstance > 0) {
      repeatByFrame.set(frame, resolution.repeatInstance);
    }
    const state = resolveTrackRowCellSignals(layerId, trackId, frame).state;
    const linkedClass = mapTrackRowLinkedClass(resolution, state === 'generated');
    if (linkedClass !== '') linkedClassByFrame.set(frame, linkedClass);
  }
  for (const line of lines) {
    const railType = resolveTimelineRailType(line.railKind, line.mode);
    const rangeStart = Math.max(0, line.startFrame);
    const rangeEnd = Math.min(capacity, line.endFrameExclusive);
    for (let frame = rangeStart; frame < rangeEnd; frame += 1) {
      if (!railTypeByFrame.has(frame)) railTypeByFrame.set(frame, railType);
    }
  }
  return { lines, linkedClassByFrame, repeatByFrame, railTypeByFrame };
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
  /** 49-06 (UAT round 8): click-to-select — the whole rail's onClick routes
   *  here (the track-rail pattern: the click owns selection, the gesture hooks
   *  never select). */
  readonly onSelect?: (clipId: string) => void;
  /** 49-06 (UAT round 8): consumes the post-drag/post-resize click suppression
   *  from the row-local hooks — a click that follows a real drag/resize is
   *  swallowed so it never toggles selection (the track-rail pattern). */
  readonly consumeClickSuppression?: () => boolean;
  /** 49-06 (UAT round 2): the row-local MOVE drag hook — the cells AND the
   *  line bind it, so the whole rail is draggable. */
  readonly onMovePointerDown?: (event: PointerEvent) => void;
  /** 49-06 (UAT round 2): the row-local RESIZE drag hook — the FIRST and LAST
   *  cells bind it (push the edge to set the clip's start/end). */
  readonly onResizePointerDown?: (event: PointerEvent) => void;
  /** 49-06 (UAT round 9): the filmstrip — one source dataUrl per cell (null =
   *  neutral fill). Length is capped at MAX_BG_CELL_IMAGES; cells past it stay
   *  on the fill. */
  readonly cellImages?: readonly (string | null)[];
}

/**
 * One Bg clip on the fixed Bg row: a GROUP OF CELLS fill (49-06 UAT round 2,
 * one filled cell per frame of the extent, like Paint track cells) beneath a
 * rail LINE (49-06 UAT round 4) that reads EXACTLY like the track's Key Rail
 * graphic line — a 4px segment in the 8px band with START/END markers. The line
 * is the whole-rail MOVE handle (drag anywhere to move the clip); the markers
 * are the RESIZE handles (push to set the clip's start/end). The Phase 47
 * surface lock forbids ANY text on the lane — repeat facts live in the right
 * panel and the tooltip. The line carries `data-bg-clip-id` /
 * `data-bg-clip-start`; the markers add `data-bg-clip-edge` — the strip's
 * drag/resize hooks resolve the source from the pressed element; pointer-down
 * hands the gesture to the row-local hooks (row-fixed law — never the
 * cross-track machinery).
 */
function PhysicsPaintBackgroundClipRailTarget(props: PhysicsPaintBackgroundClipRailTargetProps) {
  const tooltip = useStyledTooltip();
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const cellCount = Math.max(1, Math.round(props.width / ROW_CELL_WIDTH_PX));
  // 49-06 (UAT round 8): the track-rail selection pattern — the click owns
  // selection, and a click that follows a real drag/resize is swallowed by the
  // hooks' consumeClickSuppression so it never toggles selection.
  const handleClick = () => {
    if (props.consumeClickSuppression?.()) return;
    tooltip.hide();
    props.onSelect?.(props.clipId);
  };
  return (
    <span
      ref={anchorRef}
      class="physics-paint-bg-clip-rail-anchor"
      style={{ left: `${props.left}px`, width: `${props.width}px` }}
      onPointerEnter={tooltip.onPointerEnter}
      onPointerLeave={tooltip.onPointerLeave}
      onClick={handleClick}
    >
      {/* The cells — the clip extent fill. The whole-rail MOVE handle: a
          pointerdown on any cell routes to the drag hook (same as the line),
          so the entire rail is draggable. */}
      <div
        class={`physics-paint-bg-clip-cells${props.selected ? ' selected' : ''}${props.presentation.shortened ? ' shortened' : ''}${props.presentation.partialCycle ? ' partial-cycle' : ''}`}
        role="group"
        aria-label={props.presentation.accessibleName}
        data-bg-clip-id={props.clipId}
        data-bg-clip-start={props.startFrame}
        onPointerDown={(event) => {
          tooltip.hide();
          props.onMovePointerDown?.(event as unknown as PointerEvent);
        }}
      >
        {Array.from({ length: cellCount }, (_, index) => (
          <span
            key={index}
            class={`physics-paint-bg-clip-cell${props.cellImages?.[index] ? ' has-image' : ''}`}
            style={props.cellImages?.[index] ? { backgroundImage: `url(${props.cellImages[index]})` } : undefined}
          />
        ))}
      </div>
      {/* 49-06 (UAT round 4): the rail LINE — exactly like the track's Key Rail
          graphic line (4px segment in the 8px band) — is the whole-rail MOVE
          handle. The cells beneath are the fill; the line reads as the rail. */}
      <span
        class={`physics-paint-bg-clip-rail-line${props.selected ? ' selected' : ''}`}
        data-bg-clip-id={props.clipId}
        data-bg-clip-start={props.startFrame}
        onPointerDown={(event) => {
          tooltip.hide();
          props.onMovePointerDown?.(event as unknown as PointerEvent);
        }}
        onFocus={tooltip.onFocus}
        onBlur={tooltip.onBlur}
      />
      {/* The START/END markers — the RESIZE handles (push to set start/end). */}
      <span
        class="physics-paint-bg-clip-rail-marker physics-paint-bg-clip-rail-marker-start"
        data-bg-clip-id={props.clipId}
        data-bg-clip-start={props.startFrame}
        data-bg-clip-edge="start"
        onPointerDown={(event) => {
          tooltip.hide();
          event.stopPropagation();
          props.onResizePointerDown?.(event as unknown as PointerEvent);
        }}
      />
      <span
        class="physics-paint-bg-clip-rail-marker physics-paint-bg-clip-rail-marker-end"
        data-bg-clip-id={props.clipId}
        data-bg-clip-start={props.startFrame}
        data-bg-clip-edge="end"
        onPointerDown={(event) => {
          tooltip.hide();
          event.stopPropagation();
          props.onResizePointerDown?.(event as unknown as PointerEvent);
        }}
      />
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
  // 52.2 D-18 (render-churn inventory): count REAL renders of the tracks strip
  // — this row is the strip's repeating unit. First statement, before any
  // signal read, so the count is unconditional and the row's reactive reads are
  // untouched; `countRender` is a no-op while the profile gate is off.
  countRender('tracksStrip');
  const {
    trackId,
    layerId,
    frameCells,
    kind = 'paint',
    visible = true,
    soloDimmed = false,
    crossDestination = false,
    crossInsertionFrame = null,
    onSelectTrack,
    onNavigateToFrame,
    onSelectTrackFrame,
    onSelectTrackRail,
    consumeCrossTrackClickSuppression,
    onSelectBackgroundFrame,
    onSelectBackgroundClip,
    selectedBackgroundClipId = null,
    backgroundPlacementFrame = null,
    background = null,
    backgroundResolutionContext = null,
    backgroundClipDrag = null,
    backgroundClipResize = null,
    backgroundClipDragGhost = null,
    rotoSelectedRail = null,
    rotoRailMotions,
    rotoRailViews,
    onSelectMotionKey,
    onMotionCursorStep,
    onToggleMotionKeyAtCursor,
    onAddMotionChannel,
    motionChannelMenuOpen = false,
    motionRowHeightPx = null,
    motionCursorFrame = 0,
  } = props;
  const rowClass = [
    'physics-paint-track-row',
    kind === 'background' ? 'physics-paint-track-row-background' : '',
    visible === false ? 'physics-paint-track-row-hidden' : '',
    soloDimmed ? 'physics-paint-track-row-solo-dimmed' : '',
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
  const ghostSourceKeyIds = kind === 'paint' && layerId
    ? resolveGhostSourceKeyIds(layerId, trackId)
    : EMPTY_GHOST_SOURCE_KEY_IDS;
  // 261104-so5: this row's OWN track structural projection — the same memoized
  // authority the active lane classifies from (`buildRotoTimelineStructuralIndex`).
  // One O(1) read per row, never per cell: it tells a painted-phase override on
  // a generated in-between apart from a real key, which the render source
  // alone cannot (the override resolves through the real-key record door).
  const projectionCells = kind === 'paint' && layerId
    ? physicPaintStore.getRotoPhysicalProjection(layerId, trackId)?.cells ?? null
    : null;
  // 59-11: this row's motion block. The facts come from the strip when it
  // supplies them (the active track) and from the store otherwise. Expansion
  // is the ONE session identity read narrowly here, so a chevron toggle
  // re-renders the rows instead of the whole Studio chrome.
  const motionFacts: RailMotionHostFacts = kind !== 'paint'
    ? EMPTY_RAIL_MOTION_HOST_FACTS
    : (rotoRailMotions !== undefined && rotoRailViews !== undefined
      ? { views: rotoRailViews, records: rotoRailMotions }
      : (layerId ? readTrackRailMotionFacts(layerId, trackId) : EMPTY_RAIL_MOTION_HOST_FACTS));
  const selectedRailMotionId = resolveSelectedRailMotionId(motionFacts.views, rotoSelectedRail);
  const motionRecord = resolveMotionRecordForRail(motionFacts.records, selectedRailMotionId);
  const motionLaneCount = resolveTrackMotionLaneCount({
    views: motionFacts.views,
    record: motionRecord,
    expandedSelection: railMotionExpandedSelection.value,
    selectedRail: rotoSelectedRail,
    selectedRailMotionId,
  });
  const motionLanes: readonly RailMotionDisplayLaneView[] = motionRecord !== null && motionLaneCount > 0
    ? resolveVisibleMotionDisplayLanes(motionRecord.channels)
    : EMPTY_MOTION_DISPLAY_LANES;
  const motionView = motionRecord === null
    ? null
    : (motionFacts.views.find((view) => view.railId === motionRecord.railId) ?? null);
  const motionRailType: TimelineRailType = motionView?.railType ?? 'standard';
  const motionRailFrameCount = motionView === null
    ? 0
    : Math.max(0, Math.floor(motionView.endFrameExclusive - motionView.startFrame));
  const motionExpanded = motionRecord !== null && motionLanes.length > 0;
  const loopLines = loopVisuals.lines;
  // v2.0.1 (README §4): frames covered by this row's read-only Key Rails — one
  // of the ownership inputs of the cell matrix. Loop coverage comes from the
  // loop visuals' per-frame map, so no second range walk is needed.
  const keyRailCoveredFrames = new Set<number>();
  for (const segment of railSegments) {
    for (let frame = segment.firstKeyFrame; frame <= segment.lastKeyFrame; frame += 1) {
      keyRailCoveredFrames.add(frame);
    }
  }
  // 47-01 UAT round 7: a click on a non-active row's frame cell activates the
  // row's track and navigates to the clicked frame. 47 close-out UAT round 5:
  // with onSelectTrackFrame wired the SAME click also selects the frame/key —
  // one click, never two.
  const handleRowClick = (event: MouseEvent) => {
    // A crossed cross-track drag ends with a browser click on the source
    // cell/rail — swallow it so it never re-activates the source track over the
    // drop's destination activation.
    if (consumeCrossTrackClickSuppression?.()) {
      event.stopPropagation();
      return;
    }
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
    <div
      class={rowClass}
      data-track-id={trackId}
      onClick={handleRowClick}
      style={motionExpanded
        ? { position: 'relative', ...(motionRowHeightPx === null ? {} : { height: `${motionRowHeightPx}px` }) }
        : undefined}
    >
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
            const cellSignals = resolveTrackRowCellSignals(layerId, trackId, frame);
            const state = cellSignals.state;
            // studio-realm-divergence: a real key's cell carries its identity so
            // a key grab starts here (the same concept as a rail grab — no need
            // to activate this track first). The cross-track resolver reads it.
            const rawKeyRecord = kind === 'paint' && layerId
              ? physicPaintStore.getRotoRealKeyRecordByAppFrame(layerId, trackId, frame)
              : null;
            // v2.0.1 UAT: ghost source records paint as empty cells — never as
            // an ordinary green key with no rail over it.
            const keyRecord = rawKeyRecord !== null && ghostSourceKeyIds.has(rawKeyRecord.keyId)
              ? null
              : rawKeyRecord;
            // 261104-so5 (the reported regression): a lifecycle Group frame
            // override lands on a projection-generated in-between, so the render
            // source reports kind 'real' (the override resolves through the
            // real-key record door) while no app-frame real-key record exists.
            // The active lane classifies that same cell from the structural
            // projection and paints interp — match it here so the cell glyph
            // never changes when the track becomes selected. Group gaps keep a
            // null source kind and stale cached frames keep a null record, so
            // neither becomes interp.
            const paintedPhaseOnGeneratedFrame = cellSignals.sourceKind === 'real'
              && keyRecord === null
              && projectionCells?.[frame]?.kind === 'generated';
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
            // v2.0.1 (README §4) — Paint rows only: classify the cell into the
            // key / interp / cycle / empty matrix. A non-active row never owns
            // the selected rail, so its palette is always the dim variant.
            let railCellPresentation = null as ReturnType<typeof resolveTimelineCellPresentation> | null;
            let railCellType: TimelineRailType | null = null;
            let cellStyle: CSSProperties | undefined;
            if (kind === 'paint') {
              const isLoopCovered = loopVisuals.railTypeByFrame.has(frame);
              railCellType = loopVisuals.railTypeByFrame.get(frame) ?? 'standard';
              railCellPresentation = resolveTimelineCellPresentation({
                inRail: keyRecord !== null || isLoopCovered || keyRailCoveredFrames.has(frame) || state !== 'empty',
                repeatInstance: loopVisuals.repeatByFrame.get(frame) ?? 0,
                isRealKey: keyRecord !== null,
                isGenerated: state === 'generated' || paintedPhaseOnGeneratedFrame,
                // v2.0.1 UAT: stale cached pixels left by a deleted key must
                // read EMPTY, not interp — cached-only is not a rail state.
                isCachedOnly: false,
              });
              cellStyle = timelineRailCellStyle(
                railCellPresentation,
                resolveTimelineRailPalette(railCellType, 'unselected'),
                false,
              ) as unknown as CSSProperties;
            }
            return (
              <span
                key={frame}
                className={cellClass}
                data-roto-app-frame={frame}
                data-roto-key-id={keyRecord?.keyId}
                data-cell-kind={railCellPresentation?.kind}
                data-cycle={railCellPresentation?.cycle}
                data-rail-type={railCellType ?? undefined}
                style={cellStyle}
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
            data-rail-first-frame={segment.firstKeyFrame}
            data-rail-kind="key"
            data-rail-type="standard"
            data-rail-key-ids={segment.keyIds.join(',')}
            style={{
              left: `${segment.firstKeyFrame * ROW_CELL_WIDTH_PX}px`,
              /* v2.0.1 (README §4): the shared rail-line width rule — the line
                 ends on the last cell's right edge, so the 2px gap is inset. */
              width: `${projectTimelineRailLineWidth(
                segment.lastKeyFrame + 1 - segment.firstKeyFrame,
                ROW_CELL_WIDTH_PX,
                true,
              )}px`,
            }}
            role="button"
            aria-label={`Key Rail frames ${segment.firstKeyFrame}–${segment.lastKeyFrame}`}
            onClick={(event) => {
              // A crossed cross-track drag ends with a browser click on this
              // source rail — swallow it so it never re-activates the source
              // track over the drop's destination activation.
              if (consumeCrossTrackClickSuppression?.()) {
                event.stopPropagation();
                return;
              }
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
            class={`physics-paint-track-row-rail physics-paint-rail-target physics-paint-loop-clip-rail-target mode-${line.mode}${line.railKind === 'reveal' ? ' rail-kind-reveal' : ''}${line.railKind === 'standard' ? ' rail-kind-standard' : ''}${line.unresolved ? ' unresolved' : ''} boundary-start boundary-cell-start boundary-end boundary-cell-end`}
            data-rail-first-frame={line.placementFrame}
            data-rail-kind="loop"
            data-rail-type={resolveTimelineRailType(line.railKind, line.mode)}
            data-rail-key-ids={line.sourceKeyIds.join(',')}
            style={{ left: `${line.left}px`, width: `${line.width}px` }}
            role="button"
            aria-label={`${getRotoRailKindLabel(line.railKind)} rail at frame ${line.placementFrame}`}
            onClick={(event) => {
              if (consumeCrossTrackClickSuppression?.()) {
                event.stopPropagation();
                return;
              }
              // Same as the key-rail wrapper: only consume when wired.
              if (!onSelectTrackRail) return;
              event.stopPropagation();
              onSelectTrackRail(trackId, { kind: 'loop', loopId: line.loopId, placementFrame: line.placementFrame });
            }}
          >
            <span class="physics-paint-rail-segment physics-paint-loop-clip-rail-segment" />
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
              const cellCount = Math.max(1, Math.round(geometry.width / ROW_CELL_WIDTH_PX));
              const cellImages = resolveBackgroundClipCellImages(clip, cellCount);
              return (
                <PhysicsPaintBackgroundClipRailTarget
                  key={clip.id}
                  clipId={clip.id}
                  startFrame={clip.startFrame}
                  presentation={presentation}
                  left={geometry.left}
                  width={geometry.width}
                  selected={selectedBackgroundClipId === clip.id}
                  onSelect={onSelectBackgroundClip}
                  consumeClickSuppression={() => {
                    if (backgroundClipDrag?.consumeClickSuppression()) return true;
                    if (backgroundClipResize?.consumeClickSuppression()) return true;
                    return false;
                  }}
                  onMovePointerDown={backgroundClipDrag?.onPointerDown}
                  onResizePointerDown={backgroundClipResize?.onPointerDown}
                  cellImages={cellImages}
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
      {/* 59-11 (MUI-03/MUI-04): the expanded motion block — one row per DISPLAY
          lane (grouped Position counts once), inside 59-10's rounded outline.
          Rendered ONLY while this row's selected rail block is expanded; a
          collapsed rail renders no lane and no outline. */}
      {motionExpanded && motionRecord !== null ? (
        <div
          class="physics-paint-motion-block-lanes"
          data-motion-block-rail-id={motionRecord.railId}
          style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}
        >
          {motionLanes.map((lane) => (
            <TimelineMotionChannelLane
              key={lane.id}
              railId={motionRecord.railId}
              lane={lane}
              railType={motionRailType}
              selected
              railFrameCount={motionRailFrameCount}
              cursorFrame={motionCursorFrame}
              onSelectKey={onSelectMotionKey}
              onMoveCursorToKey={onMotionCursorStep === undefined
                ? undefined
                : (frame: number) => onMotionCursorStep(frame < motionCursorFrame ? -1 : 1)}
              onToggleKeyAtCursor={onToggleMotionKeyAtCursor === undefined
                ? undefined
                : () => onToggleMotionKeyAtCursor(lane.channels[0]?.id ?? 'position-x')}
            />
          ))}
          <div
            class="physics-paint-motion-block-gap"
            style={{ height: `${TIMELINE_MOTION.postBlockGap}px` }}
            aria-hidden="true"
          />
          {motionChannelMenuOpen ? (
            <TimelineMotionChannelMenu
              channels={motionRecord.channels}
              onAddChannel={(channelId) => onAddMotionChannel?.(channelId)}
              onClose={() => {}}
            />
          ) : null}
        </div>
      ) : null}
      {motionExpanded ? (
        <TimelineMotionBlockOutline
          rowTop={0}
          rowHeight={TRACK_ROW_RAIL_HEIGHT_PX}
          laneCount={motionLaneCount}
          selected
          lineColor={resolveTimelineRailPalette(motionRailType, 'selected').line}
        />
      ) : null}
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
  /** 49-06 UAT: true while the Bg track is the "visible selection" — a Bg clip
   *  rail is selected and the Bg row header highlights like a selected track
   *  (the normal track headers lose their active highlight at the same time,
   *  so the Bg row reads as THE selection). */
  readonly selected?: boolean;
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
  /** Parent EFX Paint layer for the row's per-track store reads (frame
   *  blending state). Absent in minimal fixtures — the blend toggle only
   *  renders when a layer is known. */
  readonly layerId?: string;
  /** Frame-blending toggle intent (47 UAT) — the row routes it to the strip,
   *  which toggles the track's canonical interpolation state. */
  readonly onToggleBlend?: (trackId: string) => void;
  /** Retained duplicate intent (260911-s1j: the row UI no longer renders the
   *  button — the strip path stays wired for a later re-exposure). */
  readonly onDuplicateTrack?: (trackId: string) => void;
  /** Trash intent — routes through requestDeleteTrack/commitDeleteTrack. */
  readonly onDeleteTrack?: (trackId: string) => void;
  /** 47-02 Task 2: the distinct reorder grab's pointerdown intent — the strip
   *  owns the drag session (D-08/D-18: only the grab area starts a reorder). */
  readonly onGripPointerDown?: (event: PointerEvent, trackId: string) => void;
  /** 49-05 (S1): the Bg row's ONLY action — opens the scoped asset picker.
   *  The locked Background row carries no reorder grab, no duplicate/delete
   *  hover actions (47-CONTEXT D-06); Import is its single affordance. */
  readonly onImportBackground?: () => void;
  /** v2.0.1 (README §2): the rail type currently selected (or rail-set) on the
   *  active lane — drives the active header's 3px `--track-accent`. Null/absent
   *  paints the neutral fallback; the Background header ignores it. */
  readonly selectedRailType?: TimelineRailType | null;
  /** 59-11: the document's selected rail identity — the only rail whose block
   *  the chevron may open. Absent/null draws the disabled/`minus` states. */
  readonly selectedRail?: RailSetIdentity | null;
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
    selected = false,
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
    layerId,
    onToggleBlend,
    onDeleteTrack,
    onGripPointerDown,
    onImportBackground,
    selectedRailType,
    selectedRail = null,
  } = props;
  const isActive = activeTrackId === trackId;
  const isBackground = kind === 'background';
  // 47 UAT: the per-row frame-blending toggle reads THIS track's canonical
  // interpolation state (same store read the toolbox toggle uses, keyed by
  // the row's own trackId — never the active track's, T-47-04).
  const blendEnabled = layerId ? physicPaintStore.getRotoPhysicalInterpolationState(layerId, trackId).enabled : false;
  // 59-11 (efx-preact-reactivity rule 5): the chevron reads THIS track's rail
  // motion facts, subscribed through the same narrow per-track revision the
  // row body uses — a motion edit re-renders only the affected header.
  if (!isBackground && layerId) getTrackRotorRevision(layerId, trackId).value;
  const motionFacts = !isBackground && layerId
    ? readTrackRailMotionFacts(layerId, trackId)
    : EMPTY_RAIL_MOTION_HOST_FACTS;
  const selectedRailMotionId = resolveSelectedRailMotionId(motionFacts.views, selectedRail);
  const motionExpanded = resolveMotionBlockExpanded({
    expandedSelection: railMotionExpandedSelection.value,
    selectedRail,
    selectedRailMotionId,
  });
  const hasMotion = motionFacts.records.some((record) => resolveRailMotionHasKeys(record));
  const motionChevronKind = resolveMotionChevronKind({ hasMotion, expanded: motionExpanded });
  const motionIsSelectedTrack = activeTrackId === trackId;
  const motionToggleReason = !hasMotion
    ? 'No motion channels'
    : !motionIsSelectedTrack
      ? 'Select this track’s rail to open its motion channels'
      : selectedRailMotionId === null
        ? (selectedRail === null
          ? 'Select a rail to open its motion channels'
          : 'The selected rail has no motion channels')
        : null;
  const motionToggleInteractive = motionToggleReason === null && motionChevronKind !== 'minus';
  const motionLineType: TimelineRailType | null = isBackground
    ? null
    : (motionFacts.views.find((view) => view.railId === selectedRailMotionId)?.railType
      ?? motionFacts.views.find((view) => view.railId !== null)?.railType
      ?? null);
  const motionToggleColor = motionChevronKind === 'minus' || motionLineType === null
    ? TIMELINE_SURFACE.motionToggleInactive
    : resolveTimelineRailPalette(motionLineType, 'selected').line;
  const motionToggleLabel = motionChevronKind === 'minus'
    ? 'No motion channels'
    : motionChevronKind === 'chevron-down'
      ? 'Collapse motion channels'
      : 'Expand motion channels';
  const headerClass = [
    'physics-paint-track-row-header',
    isActive ? 'physics-paint-track-row-header-active' : '',
    isBackground ? 'physics-paint-track-row-header-background' : '',
    isBackground && selected ? 'physics-paint-track-row-header-selected' : '',
  ].filter(Boolean).join(' ');
  // v2.0.1 (README §2): the active header's 3px left accent is the selected
  // rail's bright line, or the neutral fallback when no rail is selected. The
  // Background header ignores the prop (its selected treatment is clip-driven).
  const trackAccent = isActive && !isBackground
    ? resolveTrackAccentColor(selectedRailType ?? null)
    : null;
  if (isBackground) {
    // The Background row is not selectable and has no hover capability for now
    // (D-06 lock semantics): render a plain header cell — no role=button, no
    // tabIndex, no click/keyboard selection, no hover tools. 49-06 UAT: a
    // selected Bg CLIP still paints this row selected (the visual selection),
    // but the row stays non-interactive — selection is clip-driven.
    return (
      <div
        class={headerClass}
        data-track-id={trackId}
        aria-pressed={selected ? 'true' : undefined}
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
      style={trackAccent === null ? undefined : ({ '--track-accent': trackAccent } as unknown as CSSProperties)}
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
              placed before the name and after the reorder grip. */}
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
          {/* 261022-iff IFF-04: the per-track S chip is retired — the ONE solo
              is the session track focus on the playback pill. Rows carry the
              standing grip, eye, blend, name and trash controls only. */}
          {/* 47 UAT: per-row frame-blending toggle. Its
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
                // studio-realm-divergence (nature: UX): a double-click on this
                // control is the row's rename gesture (see the header's
                // onDblClick), not two toggles. Skip the second click so the
                // gesture opens rename instead of flickering the blend state.
                if (event.detail > 1) return;
                onToggleBlend?.(trackId);
              }}
              onDblClick={(event) => {
                event.stopPropagation();
                if (!editing) onStartRename?.(trackId);
              }}
            >
              <Blend size={12} aria-hidden="true" />
            </button>
          ) : null}
          {/* 59-11 (MUI-01/MUI-04): the row's motion chevron — a real 14×14
              toggle at the same slot the v2.0.1 placeholder held. Three honest
              states: grey `minus` (no motion, never clickable), bright
              `chevron-right` (motion-bearing, collapsed) and `chevron-down`
              (expanded). A rail that cannot act carries aria-disabled plus the
              reason in title/aria-description — never a silent no-op. */}
          <button
            type="button"
            class={`physics-paint-track-row-motion-toggle${motionChevronKind === 'minus' ? ' is-none' : motionChevronKind === 'chevron-down' ? ' is-expanded' : ''}`}
            data-motion-chevron={motionChevronKind}
            aria-label={motionToggleLabel}
            aria-expanded={motionChevronKind === 'minus' ? undefined : motionChevronKind === 'chevron-down' ? 'true' : 'false'}
            aria-disabled={motionToggleReason === null ? undefined : 'true'}
            aria-description={motionToggleReason ?? undefined}
            title={motionToggleReason ?? motionToggleLabel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: '0 0 auto',
              width: '14px',
              height: '14px',
              padding: 0,
              border: 'none',
              background: 'transparent',
              color: motionToggleColor,
              cursor: motionToggleInteractive ? 'pointer' : 'default',
            }}
            onClick={motionToggleInteractive
              ? () => toggleRailMotionExpansion(selectedRail, selectedRailMotionId)
              : undefined}
          >
            {motionChevronKind === 'minus'
              ? <Minus size={12} aria-hidden="true" />
              : motionChevronKind === 'chevron-down'
                ? <ChevronDown size={12} aria-hidden="true" />
                : <ChevronRight size={12} aria-hidden="true" />}
          </button>
          {/* The name is pushed right by its auto margin (mockup layout),
              leaving the trash pinned at the far right. */}
          <span
            class="physics-paint-track-row-label physics-paint-track-row-label-ellipsis"
            title={label}
          >{label}</span>
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
  /* ---- 50-UAT (modal redesign): the photo/reference camera icon in the strip
     — the SOLE photo reference affordance. It opens the floating Photo
     Reference dialog (Import/Replace/Remove and every display setting live in
     the dialog — no X badge on the icon, 50-UAT round 2). ---- */
  /** True when a photo/reference source exists — the icon shows the active
   *  state. */
  readonly hasReference?: boolean;
  /** Camera icon click — opens the floating Photo Reference dialog. */
  readonly onOpenReference?: () => void;
  /* ---- 52.5-01b Task 3 (D-02): the Document sound launcher in the strip —
     the SOLE sound affordance (no Add-Audio button, no Tools-popover entry,
     no second gallery). 24x26 nav button; tinted when a clip exists (E2). ---- */
  /** True when the document carries a sound clip — the launcher tints. */
  readonly hasSound?: boolean;
  /** Launcher click — opens the Document sound modal. */
  readonly onOpenDocumentSound?: () => void;
}

/**
 * The pinned header column's top strip (the mockup "Tracks" bar): layers icon,
 * "Tracks" title, count badge, the photo/reference camera icon, the Document
 * sound launcher, and the '+'
 * add-track button. Sits in the 36 px ruler spacer slot so it aligns with the
 * frame ruler. The camera icon is the photo/reference affordance — a lightweight
 * icon, NOT a track row (50-UAT redesign); it opens the settings dialog (50-UAT
 * modal redesign). The AudioWaveform button is the Document sound launcher
 * (52.5-01b D-02) — same rule: icon, not a track row.
 */
export function PhysicsPaintTrackColumnStrip(props: PhysicsPaintTrackColumnStripProps) {
  const { trackCount, onAddTrack, hasReference = false, onOpenReference, hasSound = false, onOpenDocumentSound } = props;
  return (
    <div class="physics-paint-track-column-strip">
      <span class="physics-paint-track-column-title-group">
        <Layers size={14} class="physics-paint-track-column-layers-icon" aria-hidden="true" />
        <span class="physics-paint-track-column-title">Tracks</span>
        <span class="physics-paint-track-column-badge" aria-label={`${trackCount} ${trackCount === 1 ? 'track' : 'tracks'}`}>
          {trackCount}
        </span>
      </span>
      <span class="physics-paint-track-column-actions">
        <button
          type="button"
          class={`physics-paint-track-column-photo${hasReference ? ' has-reference' : ''}`}
          aria-label="Photo reference settings"
          title="Photo reference settings"
          onClick={() => onOpenReference?.()}
        >
          <Camera size={13} aria-hidden="true" />
        </button>
        <button
          type="button"
          class={`physics-paint-nav-button physics-paint-track-column-sound${hasSound ? ' has-sound' : ''}`}
          aria-label="Document sound"
          title="Document sound"
          onClick={() => onOpenDocumentSound?.()}
        >
          <AudioWaveform size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          class="physics-paint-track-column-add"
          aria-label="Add track"
          title="Add track"
          onClick={() => onAddTrack?.()}
        >
          <Plus size={11} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}
