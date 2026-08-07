import {describe, expect, it, vi} from 'vitest';
import type {TimelineLoopCapsule} from '../../types/timeline';
import {
  dispatchFocusedLoopCapsuleKey,
  dispatchLoopCapsuleHit,
  getLoopCapsuleHitRegions,
  hitTestLoopCapsule,
  type LoopCapsuleHit,
} from './TimelineInteraction';

const capsule = (overrides: Partial<TimelineLoopCapsule> = {}): TimelineLoopCapsule => ({
  loopId: 'loop-7',
  placementStart: 10,
  cycleLength: 5,
  repeat: 4,
  requestedEnd: 30,
  effectiveEnd: 27,
  truncated: true,
  partialCycle: true,
  boundaryKind: 'real-key',
  boundaryFrame: 27,
  mode: 'progressive',
  unresolved: null,
  firstCycleCells: [
    {sourceKeyId: 'A', sourceAppFrame: 10, dataUrl: null, realKeyBacked: true},
    {sourceKeyId: 'B', sourceAppFrame: 11, dataUrl: null, realKeyBacked: true},
    {sourceKeyId: 'C', sourceAppFrame: 12, dataUrl: null, realKeyBacked: true},
    {sourceKeyId: 'D', sourceAppFrame: 13, dataUrl: null, realKeyBacked: true},
    {sourceKeyId: 'E', sourceAppFrame: 14, dataUrl: null, realKeyBacked: true},
  ],
  ...overrides,
});

const layout = {
  inFrame: 0,
  frameWidth: 20,
  scrollX: 0,
  headerWidth: 80,
  rangeY: 20,
  rangeHeight: 14,
};

function center(rect: {x: number; y: number; width: number; height: number}) {
  return {x: rect.x + rect.width / 2, y: rect.y + rect.height / 2};
}

describe('Loop Clip capsule hit regions', () => {
  it('dispatches badge, source, truncation, ghost band, and outline regions in locked precedence', () => {
    const regions = getLoopCapsuleHitRegions(capsule(), layout);
    expect(hitTestLoopCapsule(capsule(), layout, center(regions.badge))?.region).toBe('badge');
    expect(hitTestLoopCapsule(capsule(), layout, center(regions.sourceCells[1].rect))?.region).toBe('source-cell');
    expect(hitTestLoopCapsule(capsule(), layout, center(regions.truncation))?.region).toBe('truncation');
    expect(hitTestLoopCapsule(capsule(), layout, center(regions.repetitionBand))?.region).toBe('occurrence');
    expect(hitTestLoopCapsule(capsule(), layout, {x: regions.outline.x + 1, y: regions.outline.y + 1})?.region).toBe('outline');
  });

  it('gives a zero-effective anchor a 24 by 24 target without extending into the blocking key frame', () => {
    const zero = capsule({effectiveEnd: 10, boundaryFrame: 10});
    const regions = getLoopCapsuleHitRegions(zero, layout);
    expect(regions.anchor).toMatchObject({width: 24, height: 24});
    expect(regions.anchor!.x + regions.anchor!.width).toBeLessThanOrEqual(10 * layout.frameWidth + layout.headerWidth);
    expect(hitTestLoopCapsule(zero, layout, center(regions.anchor!))?.region).toBe('anchor');
  });

  it('preserves real-key selection but treats duplicated first-cycle cells as loop occurrences', () => {
    const realHit = hitTestLoopCapsule(capsule(), layout, center(getLoopCapsuleHitRegions(capsule(), layout).sourceCells[1].rect));
    expect(realHit).toMatchObject({region: 'source-cell', sourceIndex: 1, realKeyBacked: true, sourceAppFrame: 11});

    const duplicate = capsule({
      placementStart: 40,
      effectiveEnd: 60,
      boundaryFrame: 60,
      firstCycleCells: capsule().firstCycleCells.map((cell) => ({...cell, realKeyBacked: false})),
    });
    const duplicateHit = hitTestLoopCapsule(
      duplicate,
      layout,
      center(getLoopCapsuleHitRegions(duplicate, layout).sourceCells[1].rect),
    );
    expect(duplicateHit).toMatchObject({region: 'occurrence', repeatInstance: 0, sourceIndex: 1});
  });
});

describe('Loop Clip capsule dispatch', () => {
  const callbacks = () => ({
    selectLoop: vi.fn(),
    selectRealKey: vi.fn(),
    requestTooltip: vi.fn(),
    openLoopEdit: vi.fn(),
  });

  it('selects a ghost occurrence and pins its tooltip without selecting a key or seeking', () => {
    const actions = callbacks();
    const hit: LoopCapsuleHit = {region: 'occurrence', loopId: 'loop-7', repeatInstance: 3, sourceIndex: 1};
    dispatchLoopCapsuleHit(hit, actions);
    expect(actions.selectLoop).toHaveBeenCalledWith('loop-7');
    expect(actions.requestTooltip).toHaveBeenCalledWith(hit, true);
    expect(actions.selectRealKey).not.toHaveBeenCalled();
  });

  it('opens loop edit from the badge with the exact loop identity', () => {
    const actions = callbacks();
    dispatchLoopCapsuleHit({region: 'badge', loopId: 'loop-7'}, actions);
    expect(actions.openLoopEdit).toHaveBeenCalledWith('loop-7');
  });

  it('selects and seeks only a real-key-backed source cell', () => {
    const actions = callbacks();
    dispatchLoopCapsuleHit({
      region: 'source-cell',
      loopId: 'loop-7',
      sourceIndex: 2,
      sourceAppFrame: 12,
      realKeyBacked: true,
    }, actions);
    expect(actions.selectRealKey).toHaveBeenCalledWith(12);
    expect(actions.selectLoop).not.toHaveBeenCalled();
  });

  it('selects the loop for outline, truncation, and anchor recovery hits', () => {
    for (const hit of [
      {region: 'outline', loopId: 'loop-7'},
      {region: 'truncation', loopId: 'loop-7'},
      {region: 'anchor', loopId: 'loop-7'},
    ] as LoopCapsuleHit[]) {
      const actions = callbacks();
      dispatchLoopCapsuleHit(hit, actions);
      expect(actions.selectLoop).toHaveBeenCalledWith('loop-7');
      expect(actions.requestTooltip).toHaveBeenCalled();
    }
  });

  it('maps Enter, Escape, and Delete to the focused loop unit without key deletion', () => {
    const actions = {pinTooltip: vi.fn(), closeTooltip: vi.fn(), unlinkLoop: vi.fn()};
    expect(dispatchFocusedLoopCapsuleKey('Enter', actions)).toBe(true);
    expect(dispatchFocusedLoopCapsuleKey('Escape', actions)).toBe(true);
    expect(dispatchFocusedLoopCapsuleKey('Delete', actions)).toBe(true);
    expect(actions.pinTooltip).toHaveBeenCalledOnce();
    expect(actions.closeTooltip).toHaveBeenCalledOnce();
    expect(actions.unlinkLoop).toHaveBeenCalledOnce();
    expect(dispatchFocusedLoopCapsuleKey('ArrowRight', actions)).toBe(false);
  });
});
