import { describe, expect, it, vi } from 'vitest';
import { createRotoNavigationActions, getRotoNavigationTargets } from './rotoNavigationActions';

describe('rotoNavigationActions', () => {
  it('derives first, adjacent, and last navigation targets', () => {
    expect(getRotoNavigationTargets({ currentFrame: 3, framesToApply: 6, savedFrames: [{ frame: 9 }], playFrames: [{ appFrame: 7 }] })).toEqual({ first: 0, previous: 2, next: 4, last: 9 });
    expect(getRotoNavigationTargets({ currentFrame: 0, framesToApply: 1, savedFrames: [], playFrames: [] }).previous).toBe(0);
  });

  it('routes each action through the request navigation boundary', () => {
    const requestNavigation = vi.fn(async () => true);
    const actions = createRotoNavigationActions({ getTargets: () => ({ first: 0, previous: 2, next: 4, last: 9 }), requestNavigation });
    actions.goToFirstFrame();
    actions.goToPreviousFrame();
    actions.goToNextFrame();
    actions.goToLastFrame();
    expect(requestNavigation).toHaveBeenNthCalledWith(1, 0);
    expect(requestNavigation).toHaveBeenNthCalledWith(2, 2);
    expect(requestNavigation).toHaveBeenNthCalledWith(3, 4);
    expect(requestNavigation).toHaveBeenNthCalledWith(4, 9);
  });
});
