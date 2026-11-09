/**
 * Phase 59 plan 14 — the assembled motion surface contract (MUI-01..MUI-05).
 *
 * `timelineRailDesign.test.ts` already pins the token VALUES in isolation.
 * This file pins the assembly: that the row, the lane and the strip all read
 * the SAME design module instead of inlining their own copy of 18 / 6 / 1.5 /
 * the chevron colour. A component that hard-codes a value the token also owns
 * would drift silently the day the token moves, and no value-only test can see
 * it — only a source read can.
 *
 * The source assertions are deliberately narrow: they name the exact token
 * expressions the surface must use and the exact literals it must not carry.
 * They are not style police and they do not scan the whole application.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  resolveMotionBlockOutlineRect,
  resolveTimelineRailPalette,
  TIMELINE_GEOMETRY,
  TIMELINE_MOTION,
  TIMELINE_SURFACE,
  type TimelineRailType,
} from './timelineRailDesign';

const COMPONENT_DIR = dirname(fileURLToPath(import.meta.url));

function componentSource(fileName: string): string {
  return readFileSync(resolve(COMPONENT_DIR, fileName), 'utf8');
}

const LANE_COMPONENT = 'TimelineMotionChannels.tsx';
const ROW_COMPONENT = 'PhysicsPaintTrackRow.tsx';
const STRIP_COMPONENT = 'PhysicsPaintWorkflowStrip.tsx';
const HEADER_COMPONENT = 'physicsPaintTrackHeaderColumn.tsx';
const KEY_DRAG_COMPONENT = 'TimelineMotionKeyDrag.tsx';

const RAIL_TYPES: readonly TimelineRailType[] = ['standard', 'motion', 'static', 'reveal'];

/** The v7 motion geometry (SPECS v2.1.0 §2/§3, plan 59-10). */
describe('the v7 motion surface values', () => {
  it('pins the locked lane, cell, key, curve and outline measures', () => {
    expect(TIMELINE_MOTION.laneHeight).toBe(18);
    expect(TIMELINE_MOTION.cellWidth).toBe(16);
    expect(TIMELINE_MOTION.cellHeight).toBe(18);
    expect(TIMELINE_MOTION.cellRadius).toBe(3);
    expect(TIMELINE_MOTION.keySize).toBe(6);
    expect(TIMELINE_MOTION.keyRadius).toBe(1.5);
    expect(TIMELINE_MOTION.keyRimWidth).toBe(1);
    expect(TIMELINE_MOTION.curveWidth).toBe(1.5);
    expect(TIMELINE_GEOMETRY.outlineWidth).toBe(1.5);
    expect(TIMELINE_GEOMETRY.outlineRadius).toBe(4);
    expect(TIMELINE_MOTION.postBlockGap).toBe(2);
  });

  it('keeps the motion lane exactly one drawing-rail motion lane tall', () => {
    expect(TIMELINE_MOTION.laneHeight).toBe(TIMELINE_GEOMETRY.motionLaneHeight);
    // The motion cell is the drawing cell narrowed vertically, never a re-fit
    // of the drawing cell itself (the drawing cell stays 22 tall).
    expect(TIMELINE_GEOMETRY.cellHeight).toBe(22);
    expect(TIMELINE_MOTION.cellWidth).toBe(TIMELINE_GEOMETRY.cellWidth);
    expect(TIMELINE_MOTION.cellHeight).toBeLessThan(TIMELINE_GEOMETRY.cellHeight);
  });

  it('derives every type rim from the selected palette — one palette authority', () => {
    for (const railType of RAIL_TYPES) {
      expect(TIMELINE_MOTION.keyRim[railType]).toBe(
        resolveTimelineRailPalette(railType, 'selected').keyRim,
      );
    }
  });

  it('pins the grey chevron colour on the surface token block', () => {
    expect(TIMELINE_SURFACE.motionToggleInactive).toBe('#58616B');
  });

  it('wraps the rail row plus its lanes plus the post-block gap at the rail extent, never collapsed', () => {
    expect(resolveMotionBlockOutlineRect({
      rowTop: 100,
      rowHeight: 30,
      laneCount: 0,
      railStartFrame: 0,
      railFrameCount: 12,
    })).toBeNull();
    expect(resolveMotionBlockOutlineRect({
      rowTop: 100,
      rowHeight: 30,
      laneCount: 4,
      railStartFrame: 0,
      railFrameCount: 12,
    })).toEqual({
      left: 0.75,
      top: 100,
      // 30 row + 4 × 18 lanes + 2 post-block gap
      height: 104,
      radius: 4,
      strokeWidth: 1.5,
      // 12 × 18 cells − 2 gap − 1.5 stroke (SPECS §2)
      width: 216 - 2 - 1.5,
    });
  });
});

/** The assembly: same tokens, no inlined copies. */
describe('the assembled surface reads its geometry from timelineRailDesign', () => {
  it('lane: every motion measure is a TIMELINE_MOTION expression', () => {
    const source = componentSource(LANE_COMPONENT);
    expect(source).toContain("from './timelineRailDesign'");
    for (const token of [
      'TIMELINE_MOTION.keySize',
      'TIMELINE_MOTION.keyRadius',
      'TIMELINE_MOTION.keyRimWidth',
      'TIMELINE_MOTION.curveWidth',
      'TIMELINE_MOTION.cellHeight',
      'TIMELINE_MOTION.cellRadius',
      'TIMELINE_MOTION.laneHeight',
      'TIMELINE_MOTION.laneLabelGap',
      'TIMELINE_MOTION.headerClusterWidth',
    ]) {
      expect(source, `${LANE_COMPONENT} must read ${token}`).toContain(token);
    }
    // Phase 60 (ZOOM-05): the horizontal grid arrives as REQUIRED props — the
    // drawn cell is pitch − gap, never the static 16px width, and the static
    // pitch token is not read at all.
    expect(source).toContain('readonly framePitch: number;');
    expect(source).toContain('readonly frameGap: number;');
    expect(source).toContain('const cellWidth = framePitch - frameGap;');
    expect(source).not.toContain('TIMELINE_GEOMETRY.cellPitch');
    // The lane file carries NO bare copy of the measures it draws: the whole
    // component's numbers come from tokens (checked by absence, which is the
    // half a value-only test cannot see).
    expect(source).not.toMatch(/strokeWidth=\{1\.5\}/);
    expect(source).not.toMatch(/height:\s*18\b/);
    expect(source).not.toMatch(/width:\s*6\b/);
    expect(source).not.toMatch(/height:\s*6\b/);
    expect(source).not.toMatch(/borderRadius:\s*1\.5\b/);
  });

  it('row: the chevron colour and the post-block gap come from tokens, not hex or px literals', () => {
    const source = componentSource(ROW_COMPONENT);
    expect(source).toContain('TIMELINE_MOTION');
    expect(source).toContain('TIMELINE_SURFACE');
    expect(source).toContain("from './timelineRailDesign'");
    // MUI-01: grey when there is no motion, the selected rail type's line
    // colour otherwise — both resolved, never inlined.
    expect(source).toContain('TIMELINE_SURFACE.motionToggleInactive');
    expect(source).toContain("resolveTimelineRailPalette(motionLineType, 'selected').line");
    expect(source).toContain('TIMELINE_MOTION.postBlockGap');
    // Phase 60 (ZOOM-05): the row's horizontal grid arrives as REQUIRED props;
    // the module declares no pitch constant and reads no static pitch token.
    expect(source).toContain('readonly framePitch: number;');
    expect(source).toContain('readonly frameGap: number;');
    expect(source).not.toContain('ROW_CELL_WIDTH_PX');
    expect(source).not.toContain('TIMELINE_GEOMETRY.cellPitch');
    // Neither the grey token nor the four selected line colours may appear as
    // literals in the row: that is exactly how a token copy drifts.
    for (const literal of ['#58616B', '#A6D334', '#F5A623', '#8B5CF6', '#2F9BFF']) {
      expect(source, `${ROW_COMPONENT} must not inline the palette literal ${literal}`).not.toContain(literal);
    }
    expect(source).not.toMatch(/height:\s*2\s*\}\s*px/);
  });

  it('strip: the measured row height uses the same lane height and post-block gap', () => {
    const source = componentSource(STRIP_COMPONENT);
    expect(source).toContain("from './timelineRailDesign'");
    expect(source).toContain('TIMELINE_MOTION.laneHeight');
    expect(source).toContain('TIMELINE_MOTION.postBlockGap');
    // The block-aware layout computation is the one that feeds the insertion
    // indicator (MUI-05): a literal lane height here would put the reorder
    // affordance inside a channel block.
    expect(source).not.toMatch(/laneCount\s*\*\s*18\b/);
    expect(source).not.toMatch(/MOTION_LANE_HEIGHT(?:_PX)?\s*=\s*18\b/);
  });

  it('header column: the spacer rows derive from the same lane token', () => {
    const source = componentSource(HEADER_COMPONENT);
    expect(source).toContain('TIMELINE_GEOMETRY.motionLaneHeight');
    expect(source).toContain('TIMELINE_MOTION.postBlockGap');
    expect(source).not.toMatch(/HEADER_LANE_HEIGHT_PX\s*=\s*18\b/);
  });

  it('261107-pd8: the motion-key drag reuses the shared pointer session, never a second one', () => {
    const drag = componentSource(KEY_DRAG_COMPONENT);
    expect(drag).toContain("from '../hooks/usePhysicsPaintKeyRailDrag'");
    expect(drag).toContain('usePhysicsPaintKeyRailDrag');
    expect(drag).toContain('clampRailMotionKeyDragFrame');
    // Phase 60 (ZOOM-05): the projection divisor and the drop ghost read the
    // lane's OWN pitch and gap through the latest-value ref, never the static
    // pitch token.
    expect(drag).toContain('laneProps.framePitch');
    expect(drag).toContain('laneProps.frameGap');
    expect(drag).not.toContain('TIMELINE_GEOMETRY.cellPitch');
    expect(drag).toContain('keyDrag={{');
    // The leaf owns NO listener, capture or move handler of its own.
    expect(drag).not.toContain('addEventListener');
    expect(drag).not.toContain('setPointerCapture');
    expect(drag).not.toContain('pointermove');

    // The pure lane module stays hook-free: drag state enters as props only.
    const lanes = componentSource(LANE_COMPONENT);
    expect(lanes).not.toContain('usePhysicsPaintKeyRailDrag');
    expect(lanes).not.toContain("from '../hooks/usePhysicsPaintKeyRailDrag'");

    // The row chooses the leaf only through the ports branch, so a non-active
    // row (no ports) keeps the click-only lane.
    const row = componentSource(ROW_COMPONENT);
    expect(row).toContain('TimelineMotionKeyDragLane');
    expect(row).toContain('motionKeyDragPorts');
  });

  it('261107: the header hosts the channel rows, the block keeps only lanes, the Animate menu owns channels', () => {
    const lanes = componentSource(LANE_COMPONENT);
    expect(lanes).toContain('physics-paint-motion-header-group');
    expect(lanes).toContain('TimelineMotionChannelMenu');
    expect(lanes).not.toContain('TimelineMotionAddChannelRow');
    const header = componentSource(HEADER_COMPONENT);
    expect(header).toContain('TimelineMotionHeaderGroup');
    // The lane body keeps no add control, no slot and no availability call.
    const row = componentSource(ROW_COMPONENT);
    expect(row).not.toContain('physics-paint-motion-block-add-slot');
    expect(row).not.toContain('data-motion-add-channel-row');
    expect(row).not.toContain('resolveMotionCommandAvailability');
    expect(lanes).not.toContain('resolveMotionCommandAvailability');
    expect(header).not.toContain('resolveMotionCommandAvailability');
    // The strip opens the menu from Animate and owns its single overlay.
    const strip = componentSource(STRIP_COMPONENT);
    expect(strip).toContain('aria-label="Animate — motion channels"');
    expect(strip).toContain('TimelineMotionChannelMenuOverlay');
    expect(strip.match(/<TimelineMotionChannelMenuOverlay/g) ?? []).toHaveLength(1);
  });

  it('Phase 60 (ZOOM-05): no surface module reintroduces a pitch constant or the static pitch token', () => {
    // One authority: the lane, the key-drag leaf and the track row all draw
    // from the pitch their caller passes. A re-declared 18 or a quiet read of
    // the static token would be a second authority, and only a source read can
    // catch it. The pattern is the assignment form so `D-18` prose references
    // in the row's comments do not trip it.
    for (const [name, file] of [
      ['lane', LANE_COMPONENT],
      ['drag leaf', KEY_DRAG_COMPONENT],
      ['row', ROW_COMPONENT],
    ] as const) {
      const source = componentSource(file);
      expect(source, `${name} must not declare a pitch literal`).not.toMatch(/=\s*18\b/);
      expect(source, `${name} must not read TIMELINE_GEOMETRY.cellPitch`).not.toContain(
        'TIMELINE_GEOMETRY.cellPitch',
      );
    }
  });
});

/**
 * 261107-rrp — one band authority.
 *
 * Lane width, header stack, curve sampling, drag clamp and cursor writes must
 * all derive the frame count from `railMotionViewFrameCount`. Only a source read
 * can catch a consumer that quietly reintroduces `endFrameExclusive - startFrame`
 * or a local copy of the helper, so these pins name the exact import-and-call.
 */
const BAND_CONSUMER_SOURCES: ReadonlyArray<{ readonly name: string; readonly file: string }> = [
  { name: 'commands', file: '../roto/railMotionCommands.ts' },
  { name: 'row', file: ROW_COMPONENT },
  { name: 'lane', file: LANE_COMPONENT },
  { name: 'actions', file: '../hooks/useRotoTimelineActions.ts' },
];

describe('the Motion band has one authority (261107-rrp)', () => {
  it('every band consumer imports and calls railMotionViewFrameCount from railMotionIdentity', () => {
    for (const consumer of BAND_CONSUMER_SOURCES) {
      const source = componentSource(consumer.file);
      expect(source, `${consumer.name} import`).toMatch(
        /import\s*\{[^}]*railMotionViewFrameCount[^}]*\}\s*from\s*'[^']*railMotionIdentity'/s,
      );
      expect(source, `${consumer.name} call`).toMatch(/railMotionViewFrameCount\(/);
    }
  });

  it('railMotionIdentity exports the one helper', () => {
    const source = componentSource('../roto/railMotionIdentity.ts');
    expect(source).toContain('export function railMotionViewFrameCount(');
  });

  it('no surface module declares a second band helper', () => {
    for (const file of [STRIP_COMPONENT, ROW_COMPONENT, LANE_COMPONENT, '../hooks/useRotoTimelineActions.ts']) {
      const source = componentSource(file);
      expect(source, `${file} helper export`).not.toMatch(
        /export\s+(?:function|const)\s+railMotionViewFrameCount\b/,
      );
    }
  });
});
