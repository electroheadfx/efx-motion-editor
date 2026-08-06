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

describe('frameMap loopCapsules feed (43-02 derivation through the store)', () => {
  function makeRotoRecord(keyId: string, appFrame: number) {
    return {
      keyId,
      appFrame,
      kind: 'real-key' as const,
      payload: { frameIndex: 0, appFrame, dataUrl: `data:image/png;base64,AAAA${appFrame}` },
    };
  }

  function makeLoopClip(overrides: Partial<{
    loopId: string;
    placementStart: number;
    sourceKeyIds: string[];
    repeat: number | 'infinity';
    mode: 'progressive' | 'static';
  }> = {}) {
    return {
      loopId: 'loop-1',
      placementStart: 0,
      sourceKeyIds: ['key-0', 'key-1', 'key-2', 'key-3', 'key-4'],
      repeat: 5,
      mode: 'progressive' as const,
      ...overrides,
    };
  }

  async function seedPhysicPaintFxSequence(layerId: string, outFrame = 40) {
    const { sequenceStore } = await import('../../stores/sequenceStore');
    const { defaultTransform } = await import('../../types/layer');
    sequenceStore.sequences.value = [
      {
        id: 'seq-content',
        name: 'Content',
        kind: 'content',
        fps: 24,
        width: 1920,
        height: 1080,
        layers: [],
        keyPhotos: [{ id: 'kp-1', imageId: 'img-1', holdFrames: 2 }],
      },
      {
        id: 'fx-roto',
        name: 'Roto FX',
        kind: 'fx',
        fps: 24,
        width: 1920,
        height: 1080,
        keyPhotos: [],
        layers: [{
          id: layerId,
          name: 'Roto',
          type: 'physic-paint',
          visible: true,
          opacity: 1,
          blendMode: 'normal',
          transform: defaultTransform(),
          source: { type: 'physic-paint', layerId },
        }],
        inFrame: 0,
        outFrame,
      },
    ] as never;
    const { physicPaintStore } = await import('../../stores/physicPaintStore');
    const seeded = physicPaintStore.replaceRotoPhysicalRecords(
      layerId,
      [0, 1, 2, 3, 4].map((frame) => makeRotoRecord(`key-${frame}`, frame)),
      { enabled: false, mode: 'duplicate' },
      600,
    );
    if (!seeded.ok) throw new Error(seeded.error);
  }

  async function seedLoop(layerId: string, clip = makeLoopClip()) {
    const { physicPaintStore } = await import('../../stores/physicPaintStore');
    const result = physicPaintStore.replaceRotoPhysicalLoopClips(layerId, [clip]);
    if (!result.ok) throw new Error(result.error);
  }

  async function readCapsule(sequenceId = 'fx-roto') {
    const { fxTrackLayouts } = await import('../../lib/frameMap');
    const layout = fxTrackLayouts.value.find((track) => track.sequenceId === sequenceId);
    expect(layout?.layerType).toBe('physic-paint');
    return layout?.loopCapsules;
  }

  it('exposes ONE compact interval model per loop with resolver-derived extents and real-key-backed first-cycle cells', async () => {
    await seedPhysicPaintFxSequence('roto-layer');
    await seedLoop('roto-layer');

    const capsules = await readCapsule();
    expect(capsules).toHaveLength(1);
    const capsule = capsules![0]!;
    expect(capsule).toMatchObject({
      loopId: 'loop-1',
      placementStart: 0,
      cycleLength: 5,
      repeat: 5,
      requestedEnd: 25,
      effectiveEnd: 25,
      truncated: false,
      partialCycle: false,
      mode: 'progressive',
      unresolved: null,
    });
    // Original loop: placement overlaps the source keys → every first-cycle
    // cell is real-key-backed and carries the source payload dataUrl (D-15).
    expect(capsule.firstCycleCells.map((cell) => cell.sourceKeyId)).toEqual(['key-0', 'key-1', 'key-2', 'key-3', 'key-4']);
    expect(capsule.firstCycleCells.every((cell) => cell.realKeyBacked)).toBe(true);
    expect(capsule.firstCycleCells.map((cell) => cell.dataUrl)).toEqual(
      [0, 1, 2, 3, 4].map((frame) => `data:image/png;base64,AAAA${frame}`),
    );
    // Never a per-frame list of virtual occurrences (D-32).
    expect(JSON.stringify(Object.keys(capsule))).not.toContain('frames');
  });

  it('marks duplicated-loop first-cycle cells as linked (shared source thumbnails, no real-key backing)', async () => {
    await seedPhysicPaintFxSequence('roto-layer');
    await seedLoop('roto-layer', makeLoopClip({ placementStart: 20, repeat: 2 }));

    const capsule = (await readCapsule())![0]!;
    expect(capsule.placementStart).toBe(20);
    expect(capsule.requestedEnd).toBe(30);
    expect(capsule.effectiveEnd).toBe(30);
    expect(capsule.firstCycleCells.every((cell) => !cell.realKeyBacked)).toBe(true);
    expect(capsule.firstCycleCells.every((cell) => cell.dataUrl !== null)).toBe(true);
  });

  it('derives truncation + partial-cycle from the 43-02 boundary algebra (real-key boundary)', async () => {
    const { physicPaintStore } = await import('../../stores/physicPaintStore');
    await seedPhysicPaintFxSequence('roto-layer');
    const withBlocker = physicPaintStore.replaceRotoPhysicalRecords(
      'roto-layer',
      [0, 1, 2, 3, 4, 12].map((frame) => makeRotoRecord(`key-${frame}`, frame)),
      { enabled: false, mode: 'duplicate' },
      600,
    );
    if (!withBlocker.ok) throw new Error(withBlocker.error);
    await seedLoop('roto-layer', makeLoopClip({ sourceKeyIds: ['key-0', 'key-1', 'key-2', 'key-3', 'key-4'] }));

    const capsule = (await readCapsule())![0]!;
    expect(capsule.effectiveEnd).toBe(12);
    expect(capsule.truncated).toBe(true);
    expect(capsule.partialCycle).toBe(true);
    expect(capsule.boundaryKind).toBe('real-key');
    expect(capsule.requestedEnd).toBe(25);
  });

  it('bounds infinity loops at the main-editor parent end (D-25 dynamic sequence-end seam, 43-03 flag)', async () => {
    await seedPhysicPaintFxSequence('roto-layer', 12);
    await seedLoop('roto-layer', makeLoopClip({ repeat: 'infinity', mode: 'static' }));

    const capsule = (await readCapsule())![0]!;
    expect(capsule.repeat).toBe('infinity');
    expect(capsule.requestedEnd).toBe('infinity');
    // Sequence authored span is 12 (outFrame 12 - inFrame 0) — NOT the 600 capacity.
    expect(capsule.effectiveEnd).toBe(12);
    expect(capsule.boundaryKind).toBe('parent-end');
    expect(capsule.mode).toBe('static');
  });

  it('keeps unresolved loops visible with the verbatim missing-ref list (D-31)', async () => {
    await seedPhysicPaintFxSequence('roto-layer');
    await seedLoop('roto-layer', makeLoopClip({
      sourceKeyIds: ['key-0', 'key-1', 'key-missing'],
      repeat: 3,
    }));

    const capsule = (await readCapsule())![0]!;
    expect(capsule.cycleLength).toBe(3);
    expect(capsule.unresolved).toEqual({ missingSourceKeyIds: ['key-missing'] });
    expect(capsule.firstCycleCells[2]).toMatchObject({
      sourceKeyId: 'key-missing',
      sourceAppFrame: null,
      dataUrl: null,
      realKeyBacked: false,
    });
  });

  it('preserves a zero-effective loop (D-08/D-22)', async () => {
    const { physicPaintStore } = await import('../../stores/physicPaintStore');
    await seedPhysicPaintFxSequence('roto-layer');
    const withBlocker = physicPaintStore.replaceRotoPhysicalRecords(
      'roto-layer',
      [0, 1, 2, 3, 4, 10].map((frame) => makeRotoRecord(`key-${frame}`, frame)),
      { enabled: false, mode: 'duplicate' },
      600,
    );
    if (!withBlocker.ok) throw new Error(withBlocker.error);
    // Duplicated placement at frame 10 where a non-owned real key sits.
    await seedLoop('roto-layer', makeLoopClip({ placementStart: 10 }));

    const capsule = (await readCapsule())![0]!;
    expect(capsule.placementStart).toBe(10);
    expect(capsule.effectiveEnd).toBe(10);
    expect(capsule.truncated).toBe(true);
  });

  it('leaves loopCapsules undefined when the layer has no loops (S1 empty — no capsule, no placeholder)', async () => {
    await seedPhysicPaintFxSequence('roto-layer');
    expect(await readCapsule()).toBeUndefined();
  });
});
