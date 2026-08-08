import { afterEach, describe, expect, it } from 'vitest';

afterEach(async () => {
  const { sequenceStore } = await import('../../stores/sequenceStore');
  const { physicPaintStore } = await import('../../stores/physicPaintStore');
  sequenceStore.sequences.value = [];
  sequenceStore.activeSequenceId.value = null;
  physicPaintStore.reset();
});

const interval = (overrides: Partial<{
  placementStart: number;
  cycleLength: number;
  effectiveEnd: number;
  truncated: boolean;
  partialCycle: boolean;
}> = {}) => ({
  placementStart: 0,
  cycleLength: 5,
  effectiveEnd: 25,
  truncated: false,
  partialCycle: false,
  ...overrides,
});

describe('badgeTextForLoop (D-19 locked compact math forms)', () => {
  it('renders the finite form `Cycle {N}f × {R} = {D}f`', async () => {
    const { badgeTextForLoop } = await import('./loopCapsuleGeometry');
    expect(badgeTextForLoop({ cycleLength: 5, repeat: 5 })).toBe('Cycle 5f × 5 = 25f');
  });

  it('renders the single-cycle form `Cycle {N}f × 1 = {N}f`', async () => {
    const { badgeTextForLoop } = await import('./loopCapsuleGeometry');
    expect(badgeTextForLoop({ cycleLength: 5, repeat: 1 })).toBe('Cycle 5f × 1 = 5f');
  });

  it('renders the infinity form `Cycle {N}f × ∞` and never a numeric or spelled-out infinity suffix', async () => {
    const { badgeTextForLoop } = await import('./loopCapsuleGeometry');
    const badge = badgeTextForLoop({ cycleLength: 5, repeat: 'infinity' });
    expect(badge).toBe('Cycle 5f × ∞');
    expect(badge).not.toContain('Infinity');
    expect(badge).not.toContain('Infinityf');
  });
});

describe('zoomBandForFrameWidth (D-16 prescriptive thresholds)', () => {
  it('selects high at exactly 16px and above', async () => {
    const { zoomBandForFrameWidth } = await import('./loopCapsuleGeometry');
    expect(zoomBandForFrameWidth(16)).toBe('high');
    expect(zoomBandForFrameWidth(60)).toBe('high');
  });

  it('selects default from 8px up to (but not including) 16px', async () => {
    const { zoomBandForFrameWidth } = await import('./loopCapsuleGeometry');
    expect(zoomBandForFrameWidth(8)).toBe('default');
    expect(zoomBandForFrameWidth(15)).toBe('default');
    expect(zoomBandForFrameWidth(15.99)).toBe('default');
  });

  it('selects low below exactly 8px', async () => {
    const { zoomBandForFrameWidth } = await import('./loopCapsuleGeometry');
    expect(zoomBandForFrameWidth(7.99)).toBe('low');
    expect(zoomBandForFrameWidth(4)).toBe('low');
  });
});

describe('repetition region + ghost-cell grid (D-16/D-24, visible-window bounded)', () => {
  it('starts the repetition region at placementStart + cycleLength, never at placementStart', async () => {
    const { repetitionRegionStartFrame } = await import('./loopCapsuleGeometry');
    expect(repetitionRegionStartFrame(interval({ placementStart: 10, cycleLength: 5 }))).toBe(15);
    expect(repetitionRegionStartFrame(interval({ placementStart: 0, cycleLength: 5 }))).toBe(5);
  });

  it('tiles ghost cells cycleLength frames wide across the repetition region', async () => {
    const { visibleGhostCells } = await import('./loopCapsuleGeometry');
    const cells = visibleGhostCells(interval(), 0, 100);
    expect(cells.map((cell) => [cell.startFrame, cell.endFrame, cell.repeatInstance])).toEqual([
      [5, 10, 1],
      [10, 15, 2],
      [15, 20, 3],
      [20, 25, 4],
    ]);
  });

  it('clips the trailing ghost cell at the effective end (partial cycle)', async () => {
    const { visibleGhostCells } = await import('./loopCapsuleGeometry');
    const cells = visibleGhostCells(interval({ effectiveEnd: 23, truncated: true, partialCycle: true }), 0, 100);
    expect(cells[cells.length - 1]).toEqual({ startFrame: 20, endFrame: 23, repeatInstance: 4 });
  });

  it('returns only cells intersecting the visible frame window (never a duration-sized list)', async () => {
    const { visibleGhostCells } = await import('./loopCapsuleGeometry');
    // A capacity-bounded "infinity" interval: 600 effective frames, 5-frame
    // cycle — a 12-frame window must yield only the intersecting cells.
    const cells = visibleGhostCells(interval({ effectiveEnd: 600 }), 0, 12);
    expect(cells).toEqual([
      { startFrame: 5, endFrame: 10, repeatInstance: 1 },
      { startFrame: 10, endFrame: 15, repeatInstance: 2 },
    ]);
    const narrow = visibleGhostCells(interval({ effectiveEnd: 600 }), 12, 22);
    expect(narrow.map((cell) => cell.startFrame)).toEqual([10, 15, 20]);
  });

  it('produces no ghost cells for a zero-effective loop', async () => {
    const { visibleGhostCells, isZeroEffectiveLoop } = await import('./loopCapsuleGeometry');
    const zero = interval({ effectiveEnd: 0, truncated: true, partialCycle: false });
    expect(isZeroEffectiveLoop(zero)).toBe(true);
    expect(visibleGhostCells(zero, 0, 100)).toEqual([]);
  });
});

describe('truncationDiagonalFrame (D-21)', () => {
  it('returns null when the loop is not truncated', async () => {
    const { truncationDiagonalFrame } = await import('./loopCapsuleGeometry');
    expect(truncationDiagonalFrame(interval(), 'high')).toBeNull();
  });

  it('returns null for a zero-effective loop (the anchor flag carries the marker)', async () => {
    const { truncationDiagonalFrame } = await import('./loopCapsuleGeometry');
    expect(truncationDiagonalFrame(interval({ effectiveEnd: 0, truncated: true }), 'high')).toBeNull();
  });

  it('lands mid-ghost-cell for a partial cycle at high/default zoom', async () => {
    const { truncationDiagonalFrame } = await import('./loopCapsuleGeometry');
    // effectiveEnd 23 → last presented frame 22 sits in the cell [20, 25)
    const landing = truncationDiagonalFrame(interval({ effectiveEnd: 23, truncated: true, partialCycle: true }), 'high');
    expect(landing).toBe(22.5);
    expect(truncationDiagonalFrame(interval({ effectiveEnd: 23, truncated: true, partialCycle: true }), 'default')).toBe(22.5);
  });

  it('lands exactly on the cycle boundary for complete cycles', async () => {
    const { truncationDiagonalFrame } = await import('./loopCapsuleGeometry');
    expect(truncationDiagonalFrame(interval({ effectiveEnd: 20, truncated: true, partialCycle: false }), 'high')).toBe(20);
  });

  it('lands on the band end at low zoom', async () => {
    const { truncationDiagonalFrame } = await import('./loopCapsuleGeometry');
    expect(truncationDiagonalFrame(interval({ effectiveEnd: 23, truncated: true, partialCycle: true }), 'low')).toBe(23);
    expect(truncationDiagonalFrame(interval({ effectiveEnd: 20, truncated: true, partialCycle: false }), 'low')).toBe(20);
  });
});

describe('anchor flag (D-22)', () => {
  it('pins the zero-effective anchor flag at the placement start with the locked ~6px pill metrics', async () => {
    const { anchorFlagGeometry } = await import('./loopCapsuleGeometry');
    expect(anchorFlagGeometry(interval({ placementStart: 40, effectiveEnd: 40, truncated: true }))).toEqual({
      frame: 40,
      widthPx: 24,
      heightPx: 6,
    });
  });
});

describe('first-cycle cell frames (placement/source identity)', () => {
  it('emits one presentation frame per source-cycle frame starting at the placement start', async () => {
    const { firstCycleCellFrames } = await import('./loopCapsuleGeometry');
    expect(firstCycleCellFrames(interval({ placementStart: 10, cycleLength: 3 }))).toEqual([
      { index: 0, frame: 10 },
      { index: 1, frame: 11 },
      { index: 2, frame: 12 },
    ]);
  });
});

describe('loopCapsuleFrameToX (layer-local → canvas x)', () => {
  it('mirrors the FX coordinate math (inFrame + frame) * frameWidth - scrollX + headerWidth', async () => {
    const { loopCapsuleFrameToX } = await import('./loopCapsuleGeometry');
    expect(loopCapsuleFrameToX(5, { inFrame: 10, frameWidth: 4, scrollX: 12, headerWidth: 80 }))
      .toBe((10 + 5) * 4 - 12 + 80);
  });
});
