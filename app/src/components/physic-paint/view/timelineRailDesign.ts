/**
 * v2.0.1 — Studio timeline rail design module.
 *
 * Pure presentation contract for the v7 rail system: the single source for the
 * locked palette, cycle grays, cell presentation, frame ownership, track
 * accent and the "frames × 18 − 2" rail line width rule. It carries NO JSX, no
 * preact import and no lucide import, so the node-environment test run can
 * execute it; the components consume it as data and CSS custom properties.
 *
 * Design oracle: SPECS/v2.0.1-timeline-rails (README §2/§3/§4). Motion
 * channels are v2.1.0 scope and are absent here.
 */

import type { RotoRailKind } from './physicsPaintWorkflowPresentation';

export type TimelineRailType = 'standard' | 'motion' | 'static' | 'reveal';

/** The stored clip playback mode (`motion` is never stored; it classifies to motion). */
export type TimelineRailClipMode = 'progressive' | 'static' | 'motion' | null | undefined;

export interface TimelineRailPalette {
  readonly line: string;
  readonly keyFill: string;
  readonly keyRim: string;
}

/**
 * Three brightness tiers per rail type:
 * - `unselected` — rails on an inactive track (the base colour);
 * - `active` — every rail on the selected track (one step brighter);
 * - `selected` — the selected rail itself (the full bright colour).
 */
export type TimelineRailTier = 'selected' | 'active' | 'unselected';

export interface TimelineRailPalettePair {
  readonly selected: TimelineRailPalette;
  readonly active: TimelineRailPalette;
  readonly unselected: TimelineRailPalette;
}

/**
 * The locked four-palette table. `selected` is used ONLY by the selected rail
 * (or a rail-set member); `active` by every other rail on the selected track;
 * `unselected` by rails on inactive tracks.
 */
export const TIMELINE_RAIL_PALETTES: Record<TimelineRailType, TimelineRailPalettePair> = {
  standard: {
    selected: { line: '#A6D334', keyFill: '#86C55A', keyRim: '#A6D334' },
    active: { line: '#89AE35', keyFill: '#72A34C', keyRim: '#9ABE41' },
    unselected: { line: '#6C8A35', keyFill: '#5E823F', keyRim: '#8FA94F' },
  },
  motion: {
    selected: { line: '#F5A623', keyFill: '#F5A623', keyRim: '#FFD18A' },
    active: { line: '#D3901E', keyFill: '#CE8A1A', keyRim: '#E6B265' },
    unselected: { line: '#B27A1A', keyFill: '#A86F12', keyRim: '#CE9440' },
  },
  static: {
    selected: { line: '#8B5CF6', keyFill: '#8B5CF6', keyRim: '#C3A6FF' },
    active: { line: '#7850CA', keyFill: '#744EC8', keyRim: '#A688E1' },
    unselected: { line: '#66459E', keyFill: '#5E419B', keyRim: '#8A6BC4' },
  },
  reveal: {
    selected: { line: '#2F9BFF', keyFill: '#2F9BFF', keyRim: '#9AD4FF' },
    active: { line: '#2981CE', keyFill: '#2880CF', keyRim: '#73B1E0' },
    unselected: { line: '#24689E', keyFill: '#2266A0', keyRim: '#4C8FC2' },
  },
};

/** Locked v7 timeline surfaces (README §2). */
export const TIMELINE_SURFACE = {
  card: '#171A1E',
  headerColumn: '#1E2226',
  ruler: '#24282E',
  rows: '#1E2125',
  motionLane: '#1B2026',
  backgroundRow: '#1B1F24',
  tracksStrip: '#2B2F34',
  divider: '#333941',
  emptyCellFill: '#252A30',
  emptyCellBorder: '#3A4047',
  header: '#333536',
  headerLine: '#4C4E50',
  activeHeader: '#2B4BB5',
  activeHeaderLine: '#3A5BC7',
  backgroundHeader: '#3C3E40',
  backgroundLabel: '#6F7883',
  trackName: '#D8DDE3',
  activeTrackName: '#FFFFFF',
  playhead: '#2868FC',
  rulerTick: '#5C6066',
  rulerLabel: '#ECEFF2',
  motionToggleInactive: '#58616B',
  accentFallback: '#8A939C',
} as const;

/** Locked v7 geometry (README §3). */
export const TIMELINE_GEOMETRY = {
  rowHeight: 30,
  railBand: 6,
  railLineHeight: 4,
  /** Train-nose cap (261104 UAT): the top corners round 4x the bottom ones. */
  railLineRadiusTop: 4,
  railLineRadiusBottom: 1,
  cellWidth: 16,
  cellHeight: 22,
  cellRadius: 3,
  cellPitch: 18,
  cellGap: 2,
  cellTop: 6,
  motionLaneHeight: 18,
  outlineWidth: 1.5,
  outlineRadius: 4,
} as const;

/**
 * Motion lane tokens (Phase 59, v2.1.0). `TIMELINE_GEOMETRY` stays the drawing
 * cell contract: the motion cell is a shorter 16 × 18 footprint at the same
 * 18px pitch, so it is a SEPARATE block rather than a mutation of the existing
 * geometry. RED stub: the values land in GREEN.
 */
export const TIMELINE_MOTION = {
  /** The motion cell is 16 wide but only 18 tall — the drawing cell is 22. */
  cellWidth: 16,
  cellHeight: 18,
  cellRadius: 3,
  keySize: 6,
  keyRimWidth: 1,
  keyRadius: 1.5,
  curveWidth: 1.5,
  /** One lane is exactly the drawing rail's motionLaneHeight. */
  laneHeight: TIMELINE_GEOMETRY.motionLaneHeight,
  /** Header cluster: icon x=10, label x=24, count x=84, nav ends at x≈157. */
  headerClusterWidth: 160,
  laneLabelGap: 6,
  /** Empty row after the expanded block, matching v7's rail-to-rail gap. */
  postBlockGap: 2,
  /**
   * 59-17: the add-channel menu paints as an ABSOLUTE overlay inside the
   * block's lane container. It must sit above the rail chrome (7-9) so every
   * row is visible over the following rows, and below the playhead and
   * ruler-seek layers (30) so the timeline's own affordances stay on top.
   */
  channelMenuZIndex: 20,
  /** The type's lighter key rim (SPECS §2) — the selected palette tier. */
  keyRim: {
    standard: TIMELINE_RAIL_PALETTES.standard.selected.keyRim,
    motion: TIMELINE_RAIL_PALETTES.motion.selected.keyRim,
    static: TIMELINE_RAIL_PALETTES.static.selected.keyRim,
    reveal: TIMELINE_RAIL_PALETTES.reveal.selected.keyRim,
  },
} as const;

export interface TimelineMotionBlockOutlineRect {
  readonly top: number;
  readonly height: number;
  readonly radius: number;
  readonly strokeWidth: number;
  readonly width: string;
}

export interface TimelineMotionBlockOutlineInput {
  readonly rowTop: number;
  readonly rowHeight: number;
  readonly laneCount: number;
  /**
   * 59-17: the block renders ONE extra 18px add-channel row after the gap
   * while a keyless display lane remains. The outline wraps it like any lane —
   * the outline and the measured row height must agree.
   */
  readonly addChannelRow?: boolean;
}

/**
 * The expanded block's outline: it starts at the rail row top and wraps the
 * row plus every DISPLAY lane plus the post-block gap (MUI-03), plus the
 * 18px add-channel row when the block renders one (59-17). A collapsed block
 * has no lanes, hence no outline. `laneCount` is always a display-lane count,
 * never a model-channel count, so grouped Position adds one lane.
 */
export function resolveMotionBlockOutlineRect(
  input: TimelineMotionBlockOutlineInput,
): TimelineMotionBlockOutlineRect | null {
  const laneCount = Number.isFinite(input.laneCount)
    ? Math.max(0, Math.floor(input.laneCount))
    : 0;
  if (laneCount === 0) return null;
  return Object.freeze({
    top: input.rowTop,
    height:
      input.rowHeight +
      laneCount * TIMELINE_MOTION.laneHeight +
      TIMELINE_MOTION.postBlockGap +
      (input.addChannelRow === true ? TIMELINE_MOTION.laneHeight : 0),
    radius: TIMELINE_GEOMETRY.outlineRadius,
    strokeWidth: TIMELINE_GEOMETRY.outlineWidth,
    width: '100%',
  });
}

/**
 * The single rail-type classifier: reveal wins, a playscript clip splits into
 * Static (stored mode) or Motion (everything else), and a standard/absent rail
 * kind stays standard.
 */
export function resolveTimelineRailType(
  railKind: RotoRailKind | undefined,
  mode: TimelineRailClipMode,
): TimelineRailType {
  if (railKind === 'reveal') return 'reveal';
  if (railKind === 'playscript') return mode === 'static' ? 'static' : 'motion';
  return 'standard';
}

export function resolveTimelineRailPalette(
  railType: TimelineRailType,
  tier: TimelineRailTier,
): TimelineRailPalette {
  return TIMELINE_RAIL_PALETTES[railType][tier];
}

export interface TimelineCycleGray {
  readonly fill: string;
  readonly border: string;
}

/** Cycle parity grays: repeat 1 → cycle 2, repeat 2 → cycle 3, alternating. */
export function resolveTimelineCycleGray(selected: boolean, cycle: 2 | 3): TimelineCycleGray {
  if (selected) {
    return cycle === 2
      ? { fill: '#343B43', border: '#5A636D' }
      : { fill: '#2C333A', border: '#4C555E' };
  }
  return cycle === 2
    ? { fill: '#2F363D', border: '#4E5760' }
    : { fill: '#293036', border: '#424A53' };
}

export type TimelineCellKind = 'key' | 'interp' | 'cycle' | 'empty';

export interface TimelineCellPresentation {
  readonly kind: TimelineCellKind;
  /** Set only for repeat cycles: 2 = first repeat, 3 = second repeat, then alternating. */
  readonly cycle?: 2 | 3;
}

export interface TimelineCellResolutionInput {
  readonly inRail: boolean;
  readonly repeatInstance: number;
  readonly isRealKey: boolean;
  readonly isGenerated: boolean;
  readonly isCachedOnly?: boolean;
}

/**
 * The four-state cell matrix (README §4): repeat cycles beat every underlying
 * state; inside a rail a source-cycle key paints `key`; generated and
 * cached-only frames paint `interp`; anything else inside a rail is `empty`.
 * No rail coverage is always `empty`, even inside a repeat range.
 */
export function resolveTimelineCellPresentation(
  input: TimelineCellResolutionInput,
): TimelineCellPresentation {
  if (!input.inRail) return { kind: 'empty' };
  if (input.repeatInstance > 0) {
    return { kind: 'cycle', cycle: input.repeatInstance % 2 === 1 ? 2 : 3 };
  }
  if (input.isRealKey) return { kind: 'key' };
  if (input.isGenerated || input.isCachedOnly === true) return { kind: 'interp' };
  return { kind: 'empty' };
}

/**
 * Inline CSS custom properties for one cell: the rail trio always, plus the
 * cycle fill/border pair only for a cycle cell (parity + selection aware).
 */
export function timelineRailCellStyle(
  cell: TimelineCellPresentation,
  palette: TimelineRailPalette,
  selected: boolean,
): Record<string, string> {
  const vars: Record<string, string> = {
    '--rail-line': palette.line,
    '--rail-key': palette.keyFill,
    '--rail-key-rim': palette.keyRim,
  };
  if (cell.kind === 'cycle' && cell.cycle !== undefined) {
    const gray = resolveTimelineCycleGray(selected, cell.cycle);
    vars['--cycle-fill'] = gray.fill;
    vars['--cycle-border'] = gray.border;
  }
  return vars;
}

/**
 * Owning-rail inputs for a frame (README §4 design default):
 * selected rail > loop-clip rail > key-rail segment > empty. Non-covering
 * entries fall through to the next step.
 */
export interface FrameRailOwnership {
  readonly selectedRailType: TimelineRailType | null;
  readonly selectedRailCoversFrame: boolean;
  readonly loopRailType: TimelineRailType | null;
  readonly loopRailCoversFrame: boolean;
  readonly keyRailCoversFrame: boolean;
}

export function resolveFrameRail(
  ownership: FrameRailOwnership,
): { railType: TimelineRailType; selected: boolean } | null {
  if (ownership.selectedRailType !== null && ownership.selectedRailCoversFrame) {
    return { railType: ownership.selectedRailType, selected: true };
  }
  if (ownership.loopRailType !== null && ownership.loopRailCoversFrame) {
    return { railType: ownership.loopRailType, selected: false };
  }
  if (ownership.keyRailCoversFrame) return { railType: 'standard', selected: false };
  return null;
}

/** The active header's 3px accent: the selected rail's bright line, or the neutral fallback. */
export function resolveTrackAccentColor(
  selectedRailType: TimelineRailType | null,
): string {
  return selectedRailType === null
    ? TIMELINE_SURFACE.accentFallback
    : TIMELINE_RAIL_PALETTES[selectedRailType].selected.line;
}

/**
 * The locked rail-line width: `frameCount × pitch − 2` when the rail end is
 * visible (the line ends on the last cell's right edge), the full extent when
 * the viewport clips it, and never shorter than one CELL (pitch − gap). The
 * floor is the cell width, not the pitch: a single-key rail must end exactly
 * on its key's right edge instead of overhanging into the 2px gap.
 */
export function projectTimelineRailLineWidth(
  frameCount: number,
  pitch: number = TIMELINE_GEOMETRY.cellPitch,
  endVisible: boolean = true,
  gap: number = TIMELINE_GEOMETRY.cellGap,
): number {
  return Math.max(pitch - gap, frameCount * pitch - (endVisible ? gap : 0));
}
