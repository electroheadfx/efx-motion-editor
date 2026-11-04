import { describe, expect, it } from 'vitest';
import {
  projectTimelineRailLineWidth,
  resolveFrameRail,
  resolveTimelineCellPresentation,
  resolveTimelineCycleGray,
  resolveTimelineRailPalette,
  resolveTimelineRailType,
  resolveTrackAccentColor,
  timelineRailCellStyle,
  TIMELINE_GEOMETRY,
  TIMELINE_RAIL_PALETTES,
  TIMELINE_SURFACE,
  type FrameRailOwnership,
  type TimelineCellPresentation,
  type TimelineRailType,
} from './timelineRailDesign';

const RAIL_TYPES: readonly TimelineRailType[] = ['standard', 'motion', 'static', 'reveal'];

describe('resolveTimelineRailType', () => {
  it('maps a reveal rail to reveal in both modes', () => {
    expect(resolveTimelineRailType('reveal', 'progressive')).toBe('reveal');
    expect(resolveTimelineRailType('reveal', 'static')).toBe('reveal');
  });

  it('splits a playscript rail by its stored mode', () => {
    expect(resolveTimelineRailType('playscript', 'static')).toBe('static');
    expect(resolveTimelineRailType('playscript', 'progressive')).toBe('motion');
    expect(resolveTimelineRailType('playscript', undefined)).toBe('motion');
    expect(resolveTimelineRailType('playscript', null)).toBe('motion');
  });

  it('maps a standard or missing rail kind to standard', () => {
    expect(resolveTimelineRailType('standard', 'progressive')).toBe('standard');
    expect(resolveTimelineRailType('standard', 'static')).toBe('standard');
    expect(resolveTimelineRailType(undefined, 'progressive')).toBe('standard');
    expect(resolveTimelineRailType(undefined, undefined)).toBe('standard');
  });
});

describe('resolveTimelineRailPalette', () => {
  it('returns the exact locked selected palette per type', () => {
    expect(resolveTimelineRailPalette('standard', 'selected')).toEqual({
      line: '#A6D334',
      keyFill: '#86C55A',
      keyRim: '#A6D334',
    });
    expect(resolveTimelineRailPalette('motion', 'selected')).toEqual({
      line: '#F5A623',
      keyFill: '#F5A623',
      keyRim: '#FFD18A',
    });
    expect(resolveTimelineRailPalette('static', 'selected')).toEqual({
      line: '#8B5CF6',
      keyFill: '#8B5CF6',
      keyRim: '#C3A6FF',
    });
    expect(resolveTimelineRailPalette('reveal', 'selected')).toEqual({
      line: '#2F9BFF',
      keyFill: '#2F9BFF',
      keyRim: '#9AD4FF',
    });
  });

  it('returns the exact locked active-track palette per type', () => {
    expect(resolveTimelineRailPalette('standard', 'active')).toEqual({
      line: '#89AE35',
      keyFill: '#72A34C',
      keyRim: '#9ABE41',
    });
    expect(resolveTimelineRailPalette('motion', 'active')).toEqual({
      line: '#D3901E',
      keyFill: '#CE8A1A',
      keyRim: '#E6B265',
    });
    expect(resolveTimelineRailPalette('static', 'active')).toEqual({
      line: '#7850CA',
      keyFill: '#744EC8',
      keyRim: '#A688E1',
    });
    expect(resolveTimelineRailPalette('reveal', 'active')).toEqual({
      line: '#2981CE',
      keyFill: '#2880CF',
      keyRim: '#73B1E0',
    });
  });

  it('returns the exact locked unselected palette per type', () => {
    expect(resolveTimelineRailPalette('standard', 'unselected')).toEqual({
      line: '#6C8A35',
      keyFill: '#5E823F',
      keyRim: '#8FA94F',
    });
    expect(resolveTimelineRailPalette('motion', 'unselected')).toEqual({
      line: '#B27A1A',
      keyFill: '#A86F12',
      keyRim: '#CE9440',
    });
    expect(resolveTimelineRailPalette('static', 'unselected')).toEqual({
      line: '#66459E',
      keyFill: '#5E419B',
      keyRim: '#8A6BC4',
    });
    expect(resolveTimelineRailPalette('reveal', 'unselected')).toEqual({
      line: '#24689E',
      keyFill: '#2266A0',
      keyRim: '#4C8FC2',
    });
  });

  it('keeps the three tiers distinct for all four types', () => {
    for (const type of RAIL_TYPES) {
      expect(resolveTimelineRailPalette(type, 'selected').line)
        .not.toBe(resolveTimelineRailPalette(type, 'active').line);
      expect(resolveTimelineRailPalette(type, 'active').line)
        .not.toBe(resolveTimelineRailPalette(type, 'unselected').line);
      expect(TIMELINE_RAIL_PALETTES[type].selected)
        .not.toEqual(TIMELINE_RAIL_PALETTES[type].unselected);
    }
  });
});

describe('resolveTimelineCycleGray', () => {
  it('returns the selected cycle grays', () => {
    expect(resolveTimelineCycleGray(true, 2)).toEqual({ fill: '#343B43', border: '#5A636D' });
    expect(resolveTimelineCycleGray(true, 3)).toEqual({ fill: '#2C333A', border: '#4C555E' });
  });

  it('returns the unselected cycle grays', () => {
    expect(resolveTimelineCycleGray(false, 2)).toEqual({ fill: '#2F363D', border: '#4E5760' });
    expect(resolveTimelineCycleGray(false, 3)).toEqual({ fill: '#293036', border: '#424A53' });
  });
});

describe('resolveTimelineCellPresentation', () => {
  it('renders empty when no rail covers the frame, even inside a repeat', () => {
    expect(resolveTimelineCellPresentation({
      inRail: false,
      repeatInstance: 2,
      isRealKey: true,
      isGenerated: true,
      isCachedOnly: true,
    })).toEqual({ kind: 'empty' });
  });

  it('maps repeat parity to cycle 2 / cycle 3 and beats key / generated', () => {
    expect(resolveTimelineCellPresentation({
      inRail: true,
      repeatInstance: 1,
      isRealKey: true,
      isGenerated: false,
    })).toEqual({ kind: 'cycle', cycle: 2 });
    expect(resolveTimelineCellPresentation({
      inRail: true,
      repeatInstance: 2,
      isRealKey: false,
      isGenerated: true,
    })).toEqual({ kind: 'cycle', cycle: 3 });
    expect(resolveTimelineCellPresentation({
      inRail: true,
      repeatInstance: 3,
      isRealKey: true,
      isGenerated: true,
    })).toEqual({ kind: 'cycle', cycle: 2 });
    expect(resolveTimelineCellPresentation({
      inRail: true,
      repeatInstance: 4,
      isRealKey: true,
      isGenerated: true,
    })).toEqual({ kind: 'cycle', cycle: 3 });
  });

  it('paints a source-cycle real key as key', () => {
    expect(resolveTimelineCellPresentation({
      inRail: true,
      repeatInstance: 0,
      isRealKey: true,
      isGenerated: false,
    })).toEqual({ kind: 'key' });
  });

  it('paints generated and cached-only frames as interp', () => {
    expect(resolveTimelineCellPresentation({
      inRail: true,
      repeatInstance: 0,
      isRealKey: false,
      isGenerated: true,
    })).toEqual({ kind: 'interp' });
    expect(resolveTimelineCellPresentation({
      inRail: true,
      repeatInstance: 0,
      isRealKey: false,
      isGenerated: false,
      isCachedOnly: true,
    })).toEqual({ kind: 'interp' });
  });

  it('falls back to empty inside a rail with no key, interpolation or cache', () => {
    expect(resolveTimelineCellPresentation({
      inRail: true,
      repeatInstance: 0,
      isRealKey: false,
      isGenerated: false,
    })).toEqual({ kind: 'empty' });
    expect(resolveTimelineCellPresentation({
      inRail: true,
      repeatInstance: 0,
      isRealKey: false,
      isGenerated: false,
      isCachedOnly: false,
    })).toEqual({ kind: 'empty' });
  });
});

describe('timelineRailCellStyle', () => {
  const standardDim = resolveTimelineRailPalette('standard', 'unselected');
  const standardBright = resolveTimelineRailPalette('standard', 'selected');

  it('always emits the three rail vars', () => {
    const style = timelineRailCellStyle({ kind: 'empty' }, standardDim, false);
    expect(style['--rail-line']).toBe('#6C8A35');
    expect(style['--rail-key']).toBe('#5E823F');
    expect(style['--rail-key-rim']).toBe('#8FA94F');
  });

  it('adds the cycle pair only for a cycle cell, matching parity and selection', () => {
    const cycleTwoDim = timelineRailCellStyle({ kind: 'cycle', cycle: 2 }, standardDim, false);
    expect(cycleTwoDim['--cycle-fill']).toBe('#2F363D');
    expect(cycleTwoDim['--cycle-border']).toBe('#4E5760');

    const cycleThreeDim = timelineRailCellStyle({ kind: 'cycle', cycle: 3 }, standardDim, false);
    expect(cycleThreeDim['--cycle-fill']).toBe('#293036');
    expect(cycleThreeDim['--cycle-border']).toBe('#424A53');

    const cycleTwoBright = timelineRailCellStyle({ kind: 'cycle', cycle: 2 }, standardBright, true);
    expect(cycleTwoBright['--cycle-fill']).toBe('#343B43');
    expect(cycleTwoBright['--cycle-border']).toBe('#5A636D');
    expect(cycleTwoBright['--rail-line']).toBe('#A6D334');

    const cycleThreeBright = timelineRailCellStyle({ kind: 'cycle', cycle: 3 }, standardBright, true);
    expect(cycleThreeBright['--cycle-fill']).toBe('#2C333A');
    expect(cycleThreeBright['--cycle-border']).toBe('#4C555E');
  });

  it('emits no cycle vars for key, interp or empty', () => {
    const cells: readonly TimelineCellPresentation[] = [
      { kind: 'key' },
      { kind: 'interp' },
      { kind: 'empty' },
    ];
    for (const cell of cells) {
      const style = timelineRailCellStyle(cell, standardDim, false);
      expect(style['--cycle-fill']).toBeUndefined();
      expect(style['--cycle-border']).toBeUndefined();
      expect(style['--rail-line']).toBe('#6C8A35');
    }
  });
});

describe('resolveFrameRail', () => {
  const base: FrameRailOwnership = {
    selectedRailType: null,
    selectedRailCoversFrame: false,
    loopRailType: null,
    loopRailCoversFrame: false,
    keyRailCoversFrame: false,
  };

  it('lets the selected rail that covers the frame win over loop and key', () => {
    expect(resolveFrameRail({
      ...base,
      selectedRailType: 'static',
      selectedRailCoversFrame: true,
      loopRailType: 'motion',
      loopRailCoversFrame: true,
      keyRailCoversFrame: true,
    })).toEqual({ railType: 'static', selected: true });
  });

  it('falls through to the covering loop rail with its own type', () => {
    expect(resolveFrameRail({
      ...base,
      loopRailType: 'reveal',
      loopRailCoversFrame: true,
      keyRailCoversFrame: true,
    })).toEqual({ railType: 'reveal', selected: false });
  });

  it('falls through to the key rail as unselected standard', () => {
    expect(resolveFrameRail({ ...base, keyRailCoversFrame: true }))
      .toEqual({ railType: 'standard', selected: false });
  });

  it('returns null when no rail covers the frame', () => {
    expect(resolveFrameRail(base)).toBeNull();
  });

  it('ignores non-covering selected and loop entries', () => {
    expect(resolveFrameRail({
      ...base,
      selectedRailType: 'motion',
      selectedRailCoversFrame: false,
      loopRailType: 'static',
      loopRailCoversFrame: false,
    })).toBeNull();
    expect(resolveFrameRail({
      ...base,
      selectedRailType: 'motion',
      selectedRailCoversFrame: false,
      loopRailType: 'static',
      loopRailCoversFrame: false,
      keyRailCoversFrame: true,
    })).toEqual({ railType: 'standard', selected: false });
  });
});

describe('resolveTrackAccentColor', () => {
  it('falls back to the neutral accent when no rail is selected', () => {
    expect(resolveTrackAccentColor(null)).toBe('#8A939C');
  });

  it('uses the selected line of the selected rail type', () => {
    expect(resolveTrackAccentColor('standard')).toBe('#A6D334');
    expect(resolveTrackAccentColor('motion')).toBe('#F5A623');
    expect(resolveTrackAccentColor('static')).toBe('#8B5CF6');
    expect(resolveTrackAccentColor('reveal')).toBe('#2F9BFF');
  });
});

describe('projectTimelineRailLineWidth', () => {
  it('subtracts the 2px gap when the rail end is visible', () => {
    expect(projectTimelineRailLineWidth(30, 18, true)).toBe(538);
  });

  it('keeps the full extent when the end is clipped by the viewport', () => {
    expect(projectTimelineRailLineWidth(30, 18, false)).toBe(540);
  });

  it('ends a single-frame visible rail on the cell right edge (v2.0.1 UAT)', () => {
    expect(projectTimelineRailLineWidth(1, 18, true)).toBe(16);
    expect(projectTimelineRailLineWidth(0, 18, true)).toBe(16);
  });

  it('projects a two-frame visible rail to 34px', () => {
    expect(projectTimelineRailLineWidth(2, 18, true)).toBe(34);
  });

  it('defaults to an 18px pitch and a visible end', () => {
    expect(projectTimelineRailLineWidth(30)).toBe(538);
    expect(projectTimelineRailLineWidth(4)).toBe(70);
  });
});

describe('TIMELINE_GEOMETRY pins', () => {
  it('locks the v7 geometry constants', () => {
    expect(TIMELINE_GEOMETRY.rowHeight).toBe(30);
    expect(TIMELINE_GEOMETRY.railBand).toBe(6);
    expect(TIMELINE_GEOMETRY.railLineHeight).toBe(4);
    // 261104 UAT: train-nose cap — the top radius is 4x the bottom radius.
    expect(TIMELINE_GEOMETRY.railLineRadiusTop).toBe(4);
    expect(TIMELINE_GEOMETRY.railLineRadiusBottom).toBe(1);
    expect(TIMELINE_GEOMETRY.cellWidth).toBe(16);
    expect(TIMELINE_GEOMETRY.cellHeight).toBe(22);
    expect(TIMELINE_GEOMETRY.cellRadius).toBe(3);
    expect(TIMELINE_GEOMETRY.cellPitch).toBe(18);
    expect(TIMELINE_GEOMETRY.cellGap).toBe(2);
    expect(TIMELINE_GEOMETRY.cellTop).toBe(6);
    expect(TIMELINE_GEOMETRY.motionLaneHeight).toBe(18);
    expect(TIMELINE_GEOMETRY.outlineWidth).toBe(1.5);
    expect(TIMELINE_GEOMETRY.outlineRadius).toBe(4);
  });
});

describe('TIMELINE_SURFACE pins', () => {
  it('locks the v7 surface values', () => {
    expect(TIMELINE_SURFACE.playhead).toBe('#2868FC');
    expect(TIMELINE_SURFACE.accentFallback).toBe('#8A939C');
    expect(TIMELINE_SURFACE.card).toBe('#171A1E');
    expect(TIMELINE_SURFACE.ruler).toBe('#24282E');
    expect(TIMELINE_SURFACE.rows).toBe('#1E2125');
    expect(TIMELINE_SURFACE.tracksStrip).toBe('#2B2F34');
    expect(TIMELINE_SURFACE.emptyCellFill).toBe('#252A30');
    expect(TIMELINE_SURFACE.emptyCellBorder).toBe('#3A4047');
    expect(TIMELINE_SURFACE.activeHeader).toBe('#2B4BB5');
    expect(TIMELINE_SURFACE.activeHeaderLine).toBe('#3A5BC7');
    expect(TIMELINE_SURFACE.motionToggleInactive).toBe('#58616B');
  });
});
