import { describe, expect, it } from 'vitest';
import type { PhysicPaintRotoLoopClip } from '../roto/physicsPaintRotoPhysicalModel';
import type { PhysicPaintRotoLoopRange } from '../roto/physicsPaintRotoPhysicalResolver';
import {
  projectPhysicsPaintBackgroundClipPresentation,
  projectPhysicsPaintGroupAcceptedFeedback,
  projectPhysicsPaintGroupProductReason,
  projectPhysicsPaintLoopClipPresentation,
} from './physicsPaintLoopClipPresentation';

function range(overrides: Partial<PhysicPaintRotoLoopRange> = {}): PhysicPaintRotoLoopRange {
  return {
    loopId: 'internal-loop-id',
    placementStart: 12,
    phaseOrigin: 12,
    cycleLength: 4,
    sourceFrameCount: 4,
    sourceKeyIds: ['internal-key-id'],
    sourceCycleId: 'internal-cycle-id',
    sourceOffsets: [0, 1, 2, 3],
    repeat: 3,
    requestedEnd: 24,
    effectiveEnd: 24,
    boundary: 'project-end',
    truncated: false,
    partialCycle: false,
    unresolved: null,
    ...overrides,
  } as PhysicPaintRotoLoopRange;
}

function clip(overrides: Partial<PhysicPaintRotoLoopClip> = {}): PhysicPaintRotoLoopClip {
  return {
    loopId: 'internal-loop-id',
    placementStart: 12,
    sourceKeyIds: ['internal-key-id'],
    repeat: 3,
    mode: 'progressive',
    scriptId: 'internal-action-id',
    syncState: 'synchronized',
    provenanceState: 'attached',
    phaseOrigin: 12,
    originalEndExclusive: 24,
    visibleRanges: [{ start: 12, endExclusive: 24 }],
    frameOverrides: [],
    ...overrides,
  };
}

describe('canonical Group presentation copy', () => {
  it('derives the exact display name, type, timing, status, tooltip, and accessibility copy', () => {
    const presentation = projectPhysicsPaintLoopClipPresentation(
      range(),
      clip(),
      'Walk Cycle',
    );

    expect(presentation).toMatchObject({
      displayName: 'Walk Cycle Rail',
      sourceLabel: 'Walk Cycle',
      placementLabel: 'F12',
      cycleLabel: 'Cycle 4f × 3 = 12f',
      effectiveLabel: 'Effective 12f',
      modeLabel: 'Motion',
      groupTypeLabel: 'Motion Rail',
      lifecycle: 'synchronized',
      statusLabel: 'Synchronized with Action.',
      synchronizationDot: 'synchronized',
      regenerateDisabledReason: 'Already synchronized with Action.',
      fragmentLabel: null,
      linkedDescription: null,
    });
    expect(presentation.tooltipLines).toEqual([
      'Walk Cycle Rail',
      'Type: Motion',
      'Cycle 4f × 3 = 12f',
      'Effective 12f',
      'Status: Synchronized with Action.',
    ]);
    expect(presentation.accessibleName).toBe(
      'Walk Cycle Rail. Motion Rail. Cycle 4f × 3 = 12f. Effective 12 frames. Synchronized with Action.',
    );
  });

  it('uses a Group-specific name first and exact Motion/Static fallbacks otherwise', () => {
    expect(projectPhysicsPaintLoopClipPresentation(
      range(),
      clip(),
      'Walk Cycle',
      { groupDisplayName: 'Hero Entrance' },
    ).displayName).toBe('Hero Entrance');
    expect(projectPhysicsPaintLoopClipPresentation(
      range(),
      clip({ mode: 'static' }),
      null,
    )).toMatchObject({
      displayName: 'Static Rail at F12',
      sourceLabel: 'Source Action unavailable',
      modeLabel: 'Static',
      groupTypeLabel: 'Static Rail',
    });
    expect(projectPhysicsPaintLoopClipPresentation(
      range(),
      clip(),
      null,
    ).displayName).toBe('Motion Rail at F12');
  });

  it.each([
    {
      name: 'modified',
      clip: clip({ syncState: 'modified' }),
      sourceName: 'Walk Cycle',
      lifecycle: 'modified',
      status: 'Modified locally — Regenerate to restore from Action.',
      dot: 'modified',
      regenerate: null,
    },
    {
      name: 'detached',
      clip: clip({ provenanceState: 'detached' }),
      sourceName: 'Walk Cycle',
      lifecycle: 'detached',
      status: 'Action detached.',
      dot: 'detached',
      regenerate: 'Regenerate unavailable — Action detached.',
    },
    {
      name: 'no source action',
      clip: clip({ scriptId: undefined }),
      sourceName: null,
      lifecycle: 'unavailable',
      status: 'Source Action unavailable.',
      dot: 'unavailable',
      regenerate: 'Regenerate unavailable — Source Action unavailable.',
    },
    {
      // 47 close-out: the lifecycle reads the clip's own scriptId, never the
      // resolved library name — a rail linked to an Action stays Synchronized
      // even when the script library isn't loaded (active lane and non-active
      // rows must agree).
      name: 'scriptId present, library not loaded',
      clip: clip(),
      sourceName: null,
      lifecycle: 'synchronized',
      status: 'Synchronized with Action.',
      dot: 'synchronized',
      regenerate: 'Already synchronized with Action.',
    },
  ])('maps $name without exposing authority data', ({ clip: value, sourceName, lifecycle, status, dot, regenerate }) => {
    const presentation = projectPhysicsPaintLoopClipPresentation(range(), value, sourceName);
    expect(presentation).toMatchObject({
      lifecycle,
      statusLabel: status,
      synchronizationDot: dot,
      regenerateDisabledReason: regenerate,
    });
    const productCopy = [
      presentation.displayName,
      presentation.sourceLabel,
      ...presentation.tooltipLines,
      presentation.accessibleName,
      presentation.regenerateDisabledReason ?? '',
    ].join(' ');
    expect(productCopy).not.toMatch(/internal-(?:loop|action|key|cycle)-id/);
    expect(productCopy).not.toMatch(/Loop Clip|Progressive|Static\/Hold|\bScript\b|transport|cache path/i);
  });

  it('gives unresolved source state precedence and omits the lifecycle dot', () => {
    const presentation = projectPhysicsPaintLoopClipPresentation(
      range({
        unresolved: {
          missingSourceKeyIds: ['raw-secret-key-id'],
          invalidSourceTiming: true,
        },
      }),
      clip({ syncState: 'modified', provenanceState: 'detached' }),
      'Walk Cycle',
    );

    expect(presentation).toMatchObject({
      lifecycle: 'unresolved',
      statusLabel: 'Source missing',
      synchronizationDot: null,
      regenerateDisabledReason: 'Source missing',
    });
    expect(presentation.tooltipLines[4]).toBe('Status: Source missing');
    expect(presentation.accessibleName).toContain('Source missing');
    expect(JSON.stringify(presentation)).not.toContain('raw-secret-key-id');
  });

  it('adds exact fragment and selected-Action linkage context without changing Group identity', () => {
    const presentation = projectPhysicsPaintLoopClipPresentation(
      range({ placementStart: 18, effectiveEnd: 22 }),
      clip(),
      'Walk Cycle',
      {
        fragment: { index: 2, count: 3, start: 18, endExclusive: 22 },
        linkedActionName: 'Walk Cycle',
      },
    );

    expect(presentation.fragmentLabel).toBe('Range F18–F21 · Fragment 2 of 3');
    expect(presentation.linkedDescription).toBe('Linked to selected Action Walk Cycle.');
    expect(presentation.tooltipLines[presentation.tooltipLines.length - 1]).toBe('Range F18–F21 · Fragment 2 of 3');
    expect(presentation.accessibleName).toBe(
      'Walk Cycle Rail. Fragment 2 of 3, frames 18 through 21. Motion Rail. Synchronized with Action. Linked to selected Action Walk Cycle.',
    );
    expect(presentation.loopId).toBe('internal-loop-id');
  });
});

describe('capsule presentation — shortened state and partial-cycle facts (TML-06)', () => {
  it('projects a shortened finite loop with the requested badge and the interruption tooltip line', () => {
    const presentation = projectPhysicsPaintLoopClipPresentation(
      range({ truncated: true, partialCycle: true, effectiveEnd: 22 }),
      clip(),
      'Walk Cycle',
    );

    expect(presentation).toMatchObject({
      shortened: true,
      shortenedLabel: 'Loop shortened by next clip',
      interruptionTooltipLine: 'next clip — interrupts the loop',
      repeatInstanceCount: 2,
      // requested badge stays byte-identical (Pitfall m2)
      cycleLabel: 'Cycle 4f × 3 = 12f',
      effectiveLabel: 'Effective 10f',
    });
    expect(presentation.tooltipLines).toEqual([
      'Walk Cycle Rail',
      'Type: Motion',
      'Cycle 4f × 3 = 12f',
      'Effective 10f',
      'Status: Synchronized with Action.',
      'Loop shortened by next clip',
      'next clip — interrupts the loop',
    ]);
  });

  it('shortens an infinity loop without touching its ×∞ requested badge', () => {
    const presentation = projectPhysicsPaintLoopClipPresentation(
      range({ repeat: 'infinity', requestedEnd: 'infinity', truncated: true, effectiveEnd: 22 }),
      clip({ repeat: 'infinity', originalEndExclusive: 22 }),
      'Walk Cycle',
    );

    expect(presentation).toMatchObject({
      shortened: true,
      shortenedLabel: 'Loop shortened by next clip',
      cycleLabel: 'Cycle 4f × ∞',
      effectiveLabel: 'Effective 10f',
    });
    expect(presentation.tooltipLines).toContain('next clip — interrupts the loop');
  });

  it('projects no shortened state when the loop ends at its natural bound', () => {
    const presentation = projectPhysicsPaintLoopClipPresentation(range(), clip(), 'Walk Cycle');

    expect(presentation).toMatchObject({
      shortened: false,
      shortenedLabel: null,
      interruptionTooltipLine: null,
      partialCycle: false,
      repeatInstanceCount: 3,
    });
    expect(presentation.tooltipLines).not.toContain('next clip — interrupts the loop');
  });

  it('distinguishes a mid-cycle truncation from one landing on a cycle boundary', () => {
    const midCycle = projectPhysicsPaintLoopClipPresentation(
      range({ truncated: true, partialCycle: true, effectiveEnd: 22 }),
      clip(),
      'Walk Cycle',
    );
    expect(midCycle).toMatchObject({ partialCycle: true, repeatInstanceCount: 2 });

    const fullCycle = projectPhysicsPaintLoopClipPresentation(
      range({ truncated: true, effectiveEnd: 20 }),
      clip(),
      'Walk Cycle',
    );
    expect(fullCycle).toMatchObject({ partialCycle: false, repeatInstanceCount: 2 });

    const complete = projectPhysicsPaintLoopClipPresentation(range(), clip(), 'Walk Cycle');
    expect(complete).toMatchObject({ partialCycle: false, repeatInstanceCount: 3 });
  });
});

describe('canonical Group workflow reasons', () => {
  it('maps exact accepted and rejected workflow-strip copy', () => {
    expect(projectPhysicsPaintGroupProductReason('spacing-source-selected'))
      .toBe('Group source position selected for Key Spacing.');
    expect(projectPhysicsPaintGroupProductReason('operation-failed'))
      .toBe('Couldn’t update this Group. Nothing changed. Review the reason and try again.');
  });
});

describe('canonical accepted Group feedback copy', () => {
  it('maps every locked accepted result without retired terminology', () => {
    expect(projectPhysicsPaintGroupAcceptedFeedback({
      operation: 'paint-frame', frame: 18, groupName: 'Walk Cycle Group',
    })).toBe('Updated F18. Walk Cycle Group is Modified.');
    expect(projectPhysicsPaintGroupAcceptedFeedback({
      operation: 'delete-frame', frame: 18, groupName: 'Walk Cycle Group',
    })).toBe('Deleted F18 from Walk Cycle Group.');
    expect(projectPhysicsPaintGroupAcceptedFeedback({
      operation: 'delete-group', groupName: 'Walk Cycle Group',
    })).toBe('Deleted Walk Cycle Group.');
    expect(projectPhysicsPaintGroupAcceptedFeedback({
      operation: 'regenerate-group', groupName: 'Walk Cycle Group',
    })).toBe('Regenerated Walk Cycle Group. Synchronized with Action.');
    expect(projectPhysicsPaintGroupAcceptedFeedback({
      operation: 'regenerate-shared', count: 3,
    })).toBe('Regenerated 3 Groups. Synchronized with Action.');
    expect(projectPhysicsPaintGroupAcceptedFeedback({
      operation: 'keep-groups', actionName: 'Walk Cycle', count: 2,
    })).toBe('Deleted Walk Cycle. Kept 2 detached Groups.');
    expect(projectPhysicsPaintGroupAcceptedFeedback({
      operation: 'delete-action-and-groups', actionName: 'Walk Cycle', count: 2,
    })).toBe('Deleted Walk Cycle and 2 Groups.');
  });
});

describe('reveal rail presentation (52-03 D-22/D-23/D-24)', () => {
  function revealClip(overrides: Partial<PhysicPaintRotoLoopClip> = {}): PhysicPaintRotoLoopClip {
    return {
      loopId: 'reveal-loop',
      placementStart: 12,
      sourceKeyIds: ['R1', 'R2', 'R3', 'R4'],
      repeat: 1,
      mode: 'progressive',
      railKind: 'reveal',
      scriptId: 'reveal-script',
      motion: { deformation: 0, position: 0 },
      overrideColor: null,
      syncState: 'synchronized',
      provenanceState: 'attached',
      ...overrides,
    };
  }

  it('defaults the reveal rail line color to the variant color (D-22)', () => {
    const motion = projectPhysicsPaintLoopClipPresentation(range(), revealClip(), 'Reveal Script');
    expect(motion).toMatchObject({
      railKind: 'reveal',
      overrideColor: '#10b981',
    });
    const staticRail = projectPhysicsPaintLoopClipPresentation(
      range(),
      revealClip({ mode: 'static' }),
      'Reveal Script',
    );
    expect(staticRail.overrideColor).toBe('#14b8a6');
  });

  it('honors a per-rail overrideColor over the variant default (D-22)', () => {
    const presentation = projectPhysicsPaintLoopClipPresentation(
      range(),
      revealClip({ overrideColor: '#ff0000' }),
      'Reveal Script',
    );
    expect(presentation.overrideColor).toBe('#ff0000');
  });

  it('appends the freshness line after the Status line (D-23)', () => {
    const fresh = projectPhysicsPaintLoopClipPresentation(range(), revealClip(), 'Reveal Script');
    expect(fresh.freshnessLine).toBe('baked from current script & reference');
    expect(fresh.tooltipLines[4]).toBe('Status: Synchronized with Action.');
    expect(fresh.tooltipLines[5]).toBe('baked from current script & reference');
    expect(fresh.accessibleName).toContain('baked from current script & reference');

    const stale = projectPhysicsPaintLoopClipPresentation(
      range(),
      revealClip({ syncState: 'modified' }),
      'Reveal Script',
    );
    expect(stale.freshnessLine).toBe('stale — script or reference changed since bake, Replay to refresh');
    expect(stale.tooltipLines[5]).toBe('stale — script or reference changed since bake, Replay to refresh');
  });

  it('never presents a stale reveal bake as fresh (D-23 prohibition)', () => {
    const deletedScript = projectPhysicsPaintLoopClipPresentation(
      range(),
      revealClip(),
      'Reveal Script',
      { scriptExists: false },
    );
    expect(deletedScript.freshnessLine).toBe('stale — script or reference changed since bake, Replay to refresh');
    const removedReference = projectPhysicsPaintLoopClipPresentation(
      range(),
      revealClip(),
      'Reveal Script',
      { referencePlaced: false },
    );
    expect(removedReference.freshnessLine).toBe('stale — script or reference changed since bake, Replay to refresh');
  });

  it('computes the Replay disabled reason for the fail-closed cases (D-24)', () => {
    const noReference = projectPhysicsPaintLoopClipPresentation(
      range(),
      revealClip(),
      'Reveal Script',
      { referencePlaced: false },
    );
    expect(noReference.replayDisabledReason).toBe('Replay unavailable — no reference placed.');
    expect(noReference.tooltipLines).toContain('Replay unavailable — no reference placed.');
    expect(noReference.accessibleName).toContain('Replay unavailable — no reference placed.');

    const deletedScript = projectPhysicsPaintLoopClipPresentation(
      range(),
      revealClip(),
      'Reveal Script',
      { scriptExists: false },
    );
    expect(deletedScript.replayDisabledReason).toBe('Replay unavailable — script deleted.');

    const noScriptId = projectPhysicsPaintLoopClipPresentation(
      range(),
      revealClip({ scriptId: undefined }),
      'Reveal Script',
    );
    expect(noScriptId.replayDisabledReason).toBe('Replay unavailable — script deleted.');
  });

  it('leaves Replay enabled for fresh and stale-but-replayable reveal rails (D-24)', () => {
    const fresh = projectPhysicsPaintLoopClipPresentation(range(), revealClip(), 'Reveal Script');
    expect(fresh.replayDisabledReason).toBeNull();
    const stale = projectPhysicsPaintLoopClipPresentation(
      range(),
      revealClip({ syncState: 'modified' }),
      'Reveal Script',
    );
    expect(stale.replayDisabledReason).toBeNull();
  });

  it('keeps playscript rails free of the reveal surface (D-22/D-23/D-24)', () => {
    const presentation = projectPhysicsPaintLoopClipPresentation(range(), clip(), 'Walk Cycle');
    expect(presentation).toMatchObject({
      railKind: 'playscript',
      overrideColor: null,
      freshnessLine: null,
      replayDisabledReason: null,
    });
    expect(presentation.tooltipLines).not.toContain('baked from current script & reference');
  });
});

describe('Background clip rail presentation (49-06 UAT round 2: no lane text)', () => {
  it('keeps the full cycle facts in the tooltip only — the lane surface carries NO text (47 lock)', () => {
    const finite = projectPhysicsPaintBackgroundClipPresentation(range({ repeat: 5, requestedEnd: 40 }));
    expect(finite.cycleLabel).toBe('Cycle 4f × 5 = 20f');
    expect(finite.tooltipLines).toEqual([
      'Background clip at F12',
      'Cycle 4f × 5 = 20f',
    ]);
    const infinite = projectPhysicsPaintBackgroundClipPresentation(range({ repeat: 'infinity', requestedEnd: Infinity }));
    expect(infinite.cycleLabel).toBe('Cycle 4f × ∞');
  });
});
