import { describe, expect, it } from 'vitest';
import {
  clampOnionCount, clampOnionOpacity,
  getPhysicsPaintEngineStatusTone, getRotoAcceptedCellFillClass, getRotoCellFill,
  getRotoCellPresentationViewModel,
  getRotoCellSelectedTooltipCopy, getRotoCellStateLabel, getRotoCellStateTooltipCopy, getRotoCellViewModel, getRotoMissingFrameStatus,
  getRotoDragPreviewViewModel,
  getRotoReplacementSuccessLabel, getMissingRotoFrameStatusLabel,
  getRotoResolutionCellTooltipCopy, getRotoResolutionCellTooltipKind,
  getRotoStatusCapsuleIdleContext, getRotoStatusCapsuleViewModel,
  isPhysicsPaintDevExportEnabled,
  ROTO_STARTS_INTERPOLATION_SEGMENT_COPY,
  type RotoCellBaseMeaning, type RotoCellFill, type RotoCellOverlay,
} from './physicsPaintWorkflowPresentation';
import type { PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import { PHYSIC_PAINT_MAX_APPLY_FRAMES } from '../../../types/physicPaint';
import type { PhysicPaintRotoKeyIdentity } from '../roto/physicsPaintRotoPhysicalModel';
import type { PhysicPaintRotoPhysicalEditIntent } from '../roto/physicsPaintRotoPhysicalResolver';
import { resolvePhysicPaintRotoPhysicalEdit } from '../roto/physicsPaintRotoPhysicalResolver';

describe('physicsPaintWorkflowPresentation', () => {

  it('forces an accepted lifecycle Group gap neutral even when stale cache pixels remain', () => {
    expect(getRotoAcceptedCellFillClass({
      lifecycleTargetKind: 'group-gap',
      resolutionKind: 'empty',
      isPhysicalRealKey: false,
      fill: 'cached-only',
      viewModelFillClass: 'roto-fill-cached',
    })).toBe('roto-fill-empty');
  });

  it('preserves ordinary cached and linked-gap fill semantics outside lifecycle deletion ownership', () => {
    expect(getRotoAcceptedCellFillClass({
      lifecycleTargetKind: 'empty',
      resolutionKind: 'empty',
      isPhysicalRealKey: false,
      fill: 'cached-only',
      viewModelFillClass: 'roto-fill-cached',
    })).toContain('roto-fill-cached');
    expect(getRotoAcceptedCellFillClass({
      lifecycleTargetKind: 'generated-occurrence',
      resolutionKind: 'linked-gap',
      isPhysicalRealKey: false,
      fill: 'cached-only',
      viewModelFillClass: 'roto-fill-cached',
    })).toBe('roto-fill-empty');
  });

  it('classifies Roto cells with pixel-only gray and green semantic fills', () => {
    const cachedFrames = [
      { frameIndex: 0, appFrame: 5, dataUrl: 'data:image/png;base64,cached-five', source: 'real-key' as const },
      { frameIndex: 0, appFrame: 6, dataUrl: 'data:image/png;base64,cached-six', source: 'real-key' as const },
    ];

    expect(getRotoCellFill(5, cachedFrames)).toBe('cached-only');
    expect(getRotoCellFill(6, cachedFrames)).toBe('cached-only');
    expect(getRotoCellFill(7, cachedFrames)).toBe('empty');
  });


  it('keeps current-frame state out of the pixel-only Roto semantic fill helper', () => {
    const allSemanticFills: RotoCellFill[] = ['empty', 'cached-only'];

    expect(getRotoCellFill(5, [])).toBe('empty');
    expect(allSemanticFills).toEqual(['empty', 'cached-only']);
    expect(allSemanticFills).not.toContain('dirty' as RotoCellFill);
    expect(allSemanticFills).not.toContain('current' as RotoCellFill);
  });


  it('builds Roto cell view models for empty, cached, generated, and background-only states', () => {
    const cachedFrames: PhysicPaintRotoCacheFrame[] = [
      { frameIndex: 0, appFrame: 6, dataUrl: 'data:image/png;base64,cached-six', source: 'real-key' },
      { frameIndex: 0, appFrame: 8, dataUrl: 'data:image/png;base64,background-eight', source: 'background-only-support', backgroundOnly: true, nearestRealKeyFrame: 6 },
      { frameIndex: 0, appFrame: 9, dataUrl: 'data:image/png;base64,generated-nine', source: 'generated-interpolation', nearestRealKeyFrame: 6 },
    ];

    expect(getRotoCellViewModel({ frame: 7, currentFrame: 5, cachedFrames }).baseMeaning).toBe('empty');
    expect(getRotoCellViewModel({ frame: 7, currentFrame: 5, cachedFrames }).state).toBe('Empty');
    expect(getRotoCellViewModel({ frame: 7, currentFrame: 5, cachedFrames }).label).toBe('No Roto content on frame 7');
    expect(getRotoCellViewModel({ frame: 7, currentFrame: 5, cachedFrames }).fillClass).toBe('roto-fill-empty');

    expect(getRotoCellViewModel({ frame: 6, currentFrame: 5, cachedFrames }).baseMeaning).toBe('cached');
    expect(getRotoCellViewModel({ frame: 6, currentFrame: 5, cachedFrames }).state).toBe('Cached');
    expect(getRotoCellViewModel({ frame: 6, currentFrame: 5, cachedFrames }).label).toBe('Cached frame 6');
    expect(getRotoCellViewModel({ frame: 6, currentFrame: 5, cachedFrames }).fillClass).toBe('roto-fill-cached');

    expect(getRotoCellViewModel({ frame: 9, currentFrame: 5, cachedFrames }).baseMeaning).toBe('generated');
    expect(getRotoCellViewModel({ frame: 9, currentFrame: 5, cachedFrames }).label).toBe('Generated frame 9 (render-only)');
    expect(getRotoCellViewModel({ frame: 9, currentFrame: 5, cachedFrames }).fillClass).toBe('roto-fill-generated');
    expect(getRotoCellViewModel({ frame: 9, currentFrame: 5, cachedFrames }).isEditableTarget).toBe(false);

    const realAndGeneratedCollision = [
      { frameIndex: 0, appFrame: 10, dataUrl: 'data:image/png;base64,generated-ten', source: 'generated-interpolation' as const, nearestRealKeyFrame: 6 },
      { frameIndex: 0, appFrame: 10, dataUrl: 'data:image/png;base64,real-ten', source: 'real-key' as const },
    ];
    expect(getRotoCellViewModel({ frame: 10, currentFrame: 10, cachedFrames: realAndGeneratedCollision }).baseMeaning).toBe('cached');
    expect(getRotoCellViewModel({ frame: 10, currentFrame: 10, cachedFrames: realAndGeneratedCollision }).isEditableTarget).toBe(true);

    expect(getRotoCellViewModel({ frame: 8, currentFrame: 5, cachedFrames }).baseMeaning).toBe('background-only');
    expect(getRotoCellViewModel({ frame: 8, currentFrame: 5, cachedFrames }).state).toBe('Background only');
    expect(getRotoCellViewModel({ frame: 8, currentFrame: 5, cachedFrames }).label).toBe('Background only on frame 8');
    expect(getRotoCellViewModel({ frame: 8, currentFrame: 5, cachedFrames }).title).toBe('Background only on frame 8');
    expect(getRotoCellViewModel({ frame: 8, currentFrame: 5, cachedFrames }).ariaLabel).toBe('Background only on frame 8');
    expect(getRotoCellViewModel({ frame: 8, currentFrame: 5, cachedFrames }).fillClass).toBe('roto-fill-background-only');
  });


  it('projects a predecessor-owned interpolation segment start into existing cell copy', () => {
    const predecessorVisible = getRotoCellPresentationViewModel({
      kind: 'real',
      keyId: 'key-b',
      orderedRealKeyIds: ['key-a', 'key-b'],
      incomingInterpolationBreakKeyIds: ['key-b'],
      baseCopy: 'Real key',
    });

    expect(ROTO_STARTS_INTERPOLATION_SEGMENT_COPY).toBe('Starts a new interpolation segment');
    expect(predecessorVisible).toEqual({
      startsInterpolationSegment: true,
      tooltipCopy: 'Real key · Starts a new interpolation segment',
      ariaLabel: 'Real key · Starts a new interpolation segment',
    });
    expect(predecessorVisible.tooltipCopy.match(/Starts a new interpolation segment/g)).toHaveLength(1);

    expect(getRotoCellPresentationViewModel({
      kind: 'real',
      keyId: 'key-b',
      orderedRealKeyIds: ['key-b'],
      incomingInterpolationBreakKeyIds: ['key-b'],
      baseCopy: 'Real key',
    })).toEqual({
      startsInterpolationSegment: false,
      tooltipCopy: 'Real key',
      ariaLabel: 'Real key',
    });

    const withInterpolationToggle = (interpolationEnabled: boolean) => {
      const externalState = {
        kind: 'real' as const,
        keyId: 'key-b',
        orderedRealKeyIds: ['key-a', 'key-b'],
        incomingInterpolationBreakKeyIds: ['key-b'],
        baseCopy: 'Real key',
        interpolationEnabled,
      };
      return getRotoCellPresentationViewModel(externalState);
    };
    expect(withInterpolationToggle(false)).toEqual(withInterpolationToggle(true));

    for (const kind of ['generated', 'linked', 'empty'] as const) {
      expect(getRotoCellPresentationViewModel({
        kind,
        keyId: 'key-b',
        orderedRealKeyIds: ['key-a', 'key-b'],
        incomingInterpolationBreakKeyIds: ['key-b'],
        baseCopy: 'Generated — render-only',
      })).toEqual({
        startsInterpolationSegment: false,
        tooltipCopy: 'Generated — render-only',
        ariaLabel: 'Generated — render-only',
      });
    }
  });


  it('returns exact UI-SPEC missing Roto frame status copy', () => {
    expect(getRotoMissingFrameStatus({ frame: 12, kind: 'transparent' })).toEqual({
      kind: 'transparent',
      label: 'Frame 12: transparent missing Roto frame',
    });
    expect(getMissingRotoFrameStatusLabel({ frame: 13, kind: 'background-only-interior' })).toBe('Frame 13: background only between real Roto keys');
    expect(getMissingRotoFrameStatusLabel({ frame: 14, kind: 'background-only-dynamic' })).toBe('Frame 14: background only from current paper setting');
    expect(getRotoReplacementSuccessLabel(15)).toBe('Frame 15 saved as a real Roto key');
  });


  it('keeps current, dirty, and pending as overlays separate from pixel-only base meanings', () => {
    const baseMeanings: RotoCellBaseMeaning[] = ['empty', 'cached', 'generated', 'background-only'];
    const overlays: RotoCellOverlay[] = ['current', 'dirty', 'pending'];

    const dirtyModel = getRotoCellViewModel({ frame: 5, currentFrame: 5, cachedFrames: [], pendingFrames: [5], isSaving: false });
    const pendingModel = getRotoCellViewModel({ frame: 5, currentFrame: 5, cachedFrames: [], pendingFrames: [5], isSaving: true });

    expect(dirtyModel.baseMeaning).toBe('empty');
    expect(dirtyModel.overlays).toEqual(['current', 'dirty']);
    expect(dirtyModel.label).toBe('Unsaved changes on frame 5');
    expect(pendingModel.baseMeaning).toBe('empty');
    expect(pendingModel.overlays).toEqual(['current', 'dirty', 'pending']);
    expect(pendingModel.label).toBe('Saving frame 5...');
    expect(baseMeanings).not.toContain('current' as RotoCellBaseMeaning);
    expect(overlays).not.toContain('cached' as RotoCellOverlay);
  });


  it('returns Roto cell labels from pixel-only base meanings and overlays', () => {
    expect(getRotoCellStateLabel(7, 'empty', [])).toBe('No Roto content on frame 7');
    expect(getRotoCellStateLabel(6, 'cached', [])).toBe('Cached frame 6');
    expect(getRotoCellStateLabel(5, 'empty', ['current', 'dirty'])).toBe('Unsaved changes on frame 5');
    expect(getRotoCellStateLabel(9, 'generated', [])).toBe('Generated frame 9 (render-only)');
    expect(getRotoCellStateLabel(8, 'background-only', [])).toBe('Background only on frame 8');
  });




  it('clamps onion-skin frame count to the Phase 36 preview range (D-29, D-30)', () => {
    expect(clampOnionCount(undefined)).toBe(1);
    expect(clampOnionCount(Number.NaN)).toBe(1);
    expect(clampOnionCount(0)).toBe(1);
    expect(clampOnionCount(2.8)).toBe(2);
    expect(clampOnionCount(10)).toBe(3);
  });


  it('clamps onion opacity to the parent Onion Value percentage range', () => {
    expect(clampOnionOpacity(undefined)).toBe(30);
    expect(clampOnionOpacity(Number.NaN)).toBe(30);
    expect(clampOnionOpacity(-1)).toBe(0);
    expect(clampOnionOpacity(0)).toBe(0);
    expect(clampOnionOpacity(42.8)).toBe(42);
    expect(clampOnionOpacity(120)).toBe(100);
  });


  it('keeps the engine status tone ready across non-error apply states', () => {
    expect(getPhysicsPaintEngineStatusTone({ ready: true })).toBe('ready');
    expect(getPhysicsPaintEngineStatusTone({ ready: true, applyStatus: 'applying' })).toBe('ready');
    expect(getPhysicsPaintEngineStatusTone({ ready: true, applyStatus: 'success' })).toBe('ready');
    expect(getPhysicsPaintEngineStatusTone({ ready: true, applyStatus: 'error' })).toBe('ready');
    expect(getPhysicsPaintEngineStatusTone({ ready: true, error: 'Apply failed' })).toBe('ready');
    expect(getPhysicsPaintEngineStatusTone({ ready: false })).toBe('not-ready');
    expect(getPhysicsPaintEngineStatusTone({ ready: false, error: 'Engine failed' })).toBe('error');
  });


  it('gates dev/debug export to dev mode only (D-18, D-19)', () => {
    expect(isPhysicsPaintDevExportEnabled({ DEV: true })).toBe(true);
    expect(isPhysicsPaintDevExportEnabled({ MODE: 'development' })).toBe(true);
    expect(isPhysicsPaintDevExportEnabled({ DEV: false, MODE: 'production' })).toBe(false);
    expect(isPhysicsPaintDevExportEnabled({})).toBe(false);
  });

});

// The 38-06 native UAT approval authorizes this post-UAT rewrite. D-08
// permanently deleted the static fallback, so idle authority is current-cell context.
describe('getRotoStatusCapsuleIdleContext — current-cell idle mapping (38-08, D-09, UI-SPEC locked)', () => {

  it('maps each semantic cell kind to its exact physical-frame context', () => {
    expect(getRotoStatusCapsuleIdleContext({ cellKind: 'real', frame: 5 })).toBe('Real Roto key · Frame 5');
    expect(getRotoStatusCapsuleIdleContext({ cellKind: 'generated', frame: 9 })).toBe('Generated frame · Frame 9');
    expect(getRotoStatusCapsuleIdleContext({ cellKind: 'empty', frame: 7 })).toBe('Empty frame · Frame 7');
    expect(getRotoStatusCapsuleIdleContext({ cellKind: null, frame: 3 })).toBeNull();
  });

});

describe('getRotoStatusCapsuleViewModel — idle-context contract (38-08, D-08/D-09, post-UAT)', () => {

  it('returns ambient idle context or an empty string when no higher-priority line exists', () => {
    expect(getRotoStatusCapsuleViewModel({})).toBe('');
    expect(getRotoStatusCapsuleViewModel({ pendingOperation: null, savingIndicator: null, feedback: [], ambient: null })).toBe('');
    expect(getRotoStatusCapsuleViewModel({ ambient: 'Real Roto key · Frame 5' })).toBe('Real Roto key · Frame 5');
    expect(getRotoStatusCapsuleViewModel({ ambient: '   ' })).toBe('');
  });


  it('arbitrates the full D-15 priority ladder one rung at a time', () => {
    // Guard/action feedback beats ambient info.
    expect(getRotoStatusCapsuleViewModel({
      ambient: 'Real Roto key · Frame 5',
      feedback: [{ text: 'Frame inserted' }],
    })).toBe('Frame inserted');
    // Saving indicator beats guard/action feedback.
    expect(getRotoStatusCapsuleViewModel({
      savingIndicator: 'Saving frame 5...',
      feedback: [{ text: 'Frame inserted' }],
      ambient: 'Real Roto key · Frame 5',
    })).toBe('Saving frame 5...');
    // Pending operation beats the saving indicator.
    expect(getRotoStatusCapsuleViewModel({
      pendingOperation: 'Moving key…',
      savingIndicator: 'Saving frame 5...',
      feedback: [{ text: 'Frame inserted' }],
      ambient: 'Real Roto key · Frame 5',
    })).toBe('Moving key…');
  });


  it('resolves simultaneous guard-class lines most-recent-wins', () => {
    expect(getRotoStatusCapsuleViewModel({
      feedback: [
        { text: 'Frame inserted', recency: 1 },
        { text: 'Spacing applied', recency: 2 },
      ],
    })).toBe('Spacing applied');
    expect(getRotoStatusCapsuleViewModel({
      feedback: [
        { text: 'Spacing applied', recency: 2 },
        { text: 'Frame inserted', recency: 1 },
      ],
    })).toBe('Spacing applied');
    // Equal recency: the later candidate in the list wins the tie.
    expect(getRotoStatusCapsuleViewModel({
      feedback: [
        { text: 'Undo complete', recency: 1 },
        { text: 'Redo complete', recency: 1 },
      ],
    })).toBe('Redo complete');
  });


  it('passes busy copy and verb-first success lines through verbatim', () => {
    for (const busy of ['Applying spacing…', 'Moving key…', 'Deleting frame…']) {
      expect(getRotoStatusCapsuleViewModel({ pendingOperation: busy })).toBe(busy);
    }
    for (const success of ['Frame inserted', 'Spacing applied', 'Key moved', 'Undo complete', 'Redo complete']) {
      expect(getRotoStatusCapsuleViewModel({ feedback: [{ text: success }] })).toBe(success);
    }
  });


  it('ignores blank candidates and keeps higher-priority content over blank lines', () => {
    expect(getRotoStatusCapsuleViewModel({ pendingOperation: '  ', savingIndicator: 'Saving frame 5...' })).toBe('Saving frame 5...');
    expect(getRotoStatusCapsuleViewModel({ feedback: [{ text: null }, { text: '' }], ambient: 'Real Roto key · Frame 5' })).toBe('Real Roto key · Frame 5');
    expect(getRotoStatusCapsuleViewModel({ feedback: [{ text: null }, { text: '' }], ambient: null })).toBe('');
  });

});

describe('getRotoCellStateTooltipCopy (36.15-05 per-cell state tooltips, D-16)', () => {

  it('returns the exact D-16 copy for every semantic cell kind', () => {
    expect(getRotoCellStateTooltipCopy('real-key')).toBe('Real key');
    expect(getRotoCellStateTooltipCopy('generated')).toBe('Generated — render-only');
    expect(getRotoCellStateTooltipCopy('cached')).toBe('Cached');
    expect(getRotoCellStateTooltipCopy('background-only')).toBe('Background only');
    expect(getRotoCellStateTooltipCopy('empty')).toBe('Empty');
  });

});

/**
 * Group preview anchors build real resolver proposals so role assertions stay
 * aligned with the authoritative physical mapping.
 */

function buildBaselineIdentities(): PhysicPaintRotoKeyIdentity[] {
  return [
    { keyId: 'A', appFrame: 1 },
    { keyId: 'B', appFrame: 3 },
    { keyId: 'C', appFrame: 5 },
    { keyId: 'D', appFrame: 10 },
  ];
}

function resolveProposal(
  identities: readonly PhysicPaintRotoKeyIdentity[],
  intent: PhysicPaintRotoPhysicalEditIntent,
) {
  const resolution = resolvePhysicPaintRotoPhysicalEdit({
    identities,
    intent,
    capacity: PHYSIC_PAINT_MAX_APPLY_FRAMES,
    interpolationEnabled: false,
  });
  if (!resolution.ok) throw new Error('Presentation fixture must resolve ok');
  return resolution.proposal;
}

function resolveBaselineProposal(intent: PhysicPaintRotoPhysicalEditIntent) {
  return resolveProposal(buildBaselineIdentities(), intent);
}

describe('getRotoDragPreviewViewModel — rigid group roles', () => {

  it("marks every selected key as 'moved' and leaves unselected keys 'idle'", () => {
    const proposal = resolveProposal([
      { keyId: 'A', appFrame: 0 },
      { keyId: 'B', appFrame: 1 },
      { keyId: 'D', appFrame: 7 },
    ], {
      kind: 'move-key-group',
      movedKeyIds: ['A', 'B'],
      grabbedKeyId: 'B',
      target: { kind: 'physical-cell', appFrame: 6 },
    });

    const view = getRotoDragPreviewViewModel(proposal);

    expect(view.movedKeyId).toBe('B');
    expect(view.movedAppFrame).toBe(6);
    expect(view.targetKind).toBe('physical-cell');
    expect(view.targetKeyId).toBeNull();
    expect(view.boundary).toBeNull();
    expect(view.cellsByAppFrame.get(5)).toMatchObject({ kind: 'real', keyId: 'A', role: 'moved' });
    expect(view.cellsByAppFrame.get(6)).toMatchObject({ kind: 'real', keyId: 'B', role: 'moved' });
    expect(view.cellsByAppFrame.get(7)).toMatchObject({ kind: 'real', keyId: 'D', role: 'idle' });
  });

  it("keeps an occupied caret identity fixed with role 'target'", () => {
    const proposal = resolveBaselineProposal({
      kind: 'move-key-group',
      movedKeyIds: ['B', 'C'],
      grabbedKeyId: 'B',
      target: { kind: 'before-key', targetKeyId: 'D' },
    });

    const view = getRotoDragPreviewViewModel(proposal);

    expect(view.movedAppFrame).toBe(9);
    expect(view.targetKind).toBe('before-key');
    expect(view.targetKeyId).toBe('D');
    expect(view.targetAppFrame).toBe(10);
    expect(view.targetPreDragAppFrame).toBe(10);
    expect(view.boundary).toBe('before');
    expect(view.cellsByAppFrame.get(9)).toMatchObject({ kind: 'real', keyId: 'B', role: 'moved' });
    expect(view.cellsByAppFrame.get(11)).toMatchObject({ kind: 'real', keyId: 'C', role: 'moved' });
    expect(view.cellsByAppFrame.get(10)).toMatchObject({ kind: 'real', keyId: 'D', role: 'target' });
    expect(view.cellsByAppFrame.get(1)).toMatchObject({ kind: 'real', keyId: 'A', role: 'idle' });
  });

  it('keeps the single-key fallback path unchanged (one-member moved set via movedKeyId)', () => {
    const proposal = resolveBaselineProposal({
      kind: 'move-key',
      movedKeyId: 'B',
      target: { kind: 'physical-cell', appFrame: 6 },
    });

    const view = getRotoDragPreviewViewModel(proposal);

    expect(view.movedKeyId).toBe('B');
    expect(view.movedAppFrame).toBe(6);
    // Single-key D-29 cut-and-insert final map: A@1, C@4, B@6, D@10.
    // D ripples out and back to its original frame 10, so its net change is
    // zero and its presentation role stays 'idle'.
    expect(view.cellsByAppFrame.get(6)).toMatchObject({ kind: 'real', keyId: 'B', role: 'moved' });
    expect(view.cellsByAppFrame.get(4)).toMatchObject({ kind: 'real', keyId: 'C', role: 'shifted' });
    expect(view.cellsByAppFrame.get(10)).toMatchObject({ kind: 'real', keyId: 'D', role: 'idle' });
    expect(view.cellsByAppFrame.get(1)).toMatchObject({ kind: 'real', keyId: 'A', role: 'idle' });
  });

});

describe('getRotoCellSelectedTooltipCopy (37-04, D-04, UI-SPEC copy contract)', () => {

  it("returns exactly 'Selected key' for the 'real-key' base", () => {
    expect(getRotoCellSelectedTooltipCopy('real-key')).toBe('Selected key');
  });

  it('composes with the lowercased base copy for every other base', () => {
    expect(getRotoCellSelectedTooltipCopy('generated')).toBe('Selected key — generated — render-only');
    expect(getRotoCellSelectedTooltipCopy('cached')).toBe('Selected key — cached');
    expect(getRotoCellSelectedTooltipCopy('background-only')).toBe('Selected key — background only');
    expect(getRotoCellSelectedTooltipCopy('empty')).toBe('Selected key — empty');
  });

});

describe('getRotoResolutionCellTooltipKind — linked frames keep existing cell-state semantics (43-02, D-18/D-23)', () => {
  it('maps every resolution kind explicitly with no new first-class cell state', () => {
    // Real frames report the real-key vocabulary.
    expect(getRotoResolutionCellTooltipKind({ kind: 'real', keyId: 'A', appFrame: 10 }, 'empty')).toBe('real-key');

    // Linked occurrences keep the existing empty/cached/generated semantics —
    // the additive badge lands in 43-08; no new cell state here (D-18).
    const linked = {
      kind: 'linked' as const,
      loopId: 'L1',
      appFrame: 18,
      sourceKeyId: 'D',
      sourceIndex: 3,
      cycleOffset: 3,
      repeatInstance: 1,
    };
    expect(getRotoResolutionCellTooltipKind(linked, 'empty')).toBe('empty');
    expect(getRotoResolutionCellTooltipKind(linked, 'cached')).toBe('cached');
    expect(getRotoResolutionCellTooltipKind(linked, 'generated')).toBe('generated');

    // Unresolved linked frames stay non-blocking: the strip renders the
    // existing fill; the capsule owns the error affordance (D-23).
    const unresolved = {
      kind: 'linked-unresolved' as const,
      loopId: 'L1',
      appFrame: 18,
      placementStart: 10,
      sourceKeyIds: ['A', 'B', 'C', 'D', 'E'],
      missingSourceKeyIds: ['D', 'E'],
    };
    expect(getRotoResolutionCellTooltipKind(unresolved, 'empty')).toBe('empty');
    expect(getRotoResolutionCellTooltipKind(unresolved, 'background-only')).toBe('background-only');

    expect(getRotoResolutionCellTooltipKind({ kind: 'empty' }, 'cached')).toBe('cached');
  });

  it('keeps linked fill semantics while exposing linked occurrence product copy', () => {
    const linked = {
      kind: 'linked' as const,
      loopId: 'L1',
      appFrame: 18,
      sourceKeyId: 'D',
      sourceIndex: 1,
      cycleOffset: 1,
      repeatInstance: 2,
    };
    // Fill remains the existing empty treatment; tooltip copy is never Empty.
    expect(getRotoResolutionCellTooltipKind(linked, 'empty')).toBe('empty');
    expect(getRotoResolutionCellTooltipCopy(linked, 'empty', new Map([['L1', 5]])))
      .toBe('Linked · Repeat 3 · Source frame 2 of 5');
  });

  it('keeps generated and gap interiors in the existing fill vocabulary with explicit source-span copy', () => {
    const generated = {
      kind: 'linked-generated' as const,
      loopId: 'L1', appFrame: 18,
      leftSourceKeyId: 'A', rightSourceKeyId: 'B',
      leftSourceIndex: 0, rightSourceIndex: 1,
      progress: 1 / 3, sourceCycleId: '1:A|1:B|1:C', cycleOffset: 1, repeatInstance: 2,
    };
    const gap = {
      kind: 'linked-gap' as const,
      loopId: 'L1', appFrame: 18,
      leftSourceKeyId: 'A', rightSourceKeyId: 'B',
      leftSourceIndex: 0, rightSourceIndex: 1,
      cycleOffset: 1, repeatInstance: 2,
    };

    expect(getRotoResolutionCellTooltipKind(generated, 'generated')).toBe('generated');
    expect(getRotoResolutionCellTooltipCopy(generated, 'generated', new Map([['L1', 3]])))
      .toBe('Linked generated · Repeat 3 · Between source frames 1 and 2 of 3');
    expect(getRotoResolutionCellTooltipKind(gap, 'empty')).toBe('empty');
    expect(getRotoResolutionCellTooltipCopy(gap, 'empty', new Map([['L1', 3]])))
      .toBe('Linked gap · Repeat 3 · Between source frames 1 and 2 of 3');
  });

  it('uses explicit unresolved linked-loop copy instead of the base Empty copy', () => {
    const unresolved = {
      kind: 'linked-unresolved' as const,
      loopId: 'L1',
      appFrame: 18,
      placementStart: 10,
      sourceKeyIds: ['A', 'B', 'C', 'D', 'E'],
      missingSourceKeyIds: ['D', 'E'],
    };
    expect(getRotoResolutionCellTooltipCopy(unresolved, 'empty', new Map([['L1', 5]])))
      .toBe('Linked loop unresolved · 2 source frames missing');
  });
});
