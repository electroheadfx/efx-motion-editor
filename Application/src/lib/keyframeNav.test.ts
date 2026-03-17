import { describe, it, expect } from 'vitest';
import { getKeyframeNav } from './keyframeNav';

describe('keyframeNav', () => {
  it('empty keyframes returns all null/false', () => {
    const result = getKeyframeNav([], 5);
    expect(result).toEqual({
      prevFrame: null,
      nextFrame: null,
      isOnKf: false,
      canPrev: false,
      canNext: false,
    });
  });

  it('between two keyframes: both prev and next available', () => {
    const result = getKeyframeNav([{ frame: 2 }, { frame: 8 }], 5);
    expect(result).toEqual({
      prevFrame: 2,
      nextFrame: 8,
      isOnKf: false,
      canPrev: true,
      canNext: true,
    });
  });

  it('on first keyframe: no prev, has next', () => {
    const result = getKeyframeNav([{ frame: 2 }, { frame: 8 }], 2);
    expect(result).toEqual({
      prevFrame: null,
      nextFrame: 8,
      isOnKf: true,
      canPrev: false,
      canNext: true,
    });
  });

  it('on last keyframe: has prev, no next', () => {
    const result = getKeyframeNav([{ frame: 2 }, { frame: 8 }], 8);
    expect(result).toEqual({
      prevFrame: 2,
      nextFrame: null,
      isOnKf: true,
      canPrev: true,
      canNext: false,
    });
  });

  it('single keyframe at current: isOnKf true, no prev/no next', () => {
    const result = getKeyframeNav([{ frame: 5 }], 5);
    expect(result).toEqual({
      prevFrame: null,
      nextFrame: null,
      isOnKf: true,
      canPrev: false,
      canNext: false,
    });
  });

  it('before all keyframes: no prev, next is first', () => {
    const result = getKeyframeNav([{ frame: 10 }, { frame: 20 }], 1);
    expect(result).toEqual({
      prevFrame: null,
      nextFrame: 10,
      isOnKf: false,
      canPrev: false,
      canNext: true,
    });
  });

  it('after all keyframes: prev is last, no next', () => {
    const result = getKeyframeNav([{ frame: 10 }, { frame: 20 }], 30);
    expect(result).toEqual({
      prevFrame: 20,
      nextFrame: null,
      isOnKf: false,
      canPrev: true,
      canNext: false,
    });
  });

  it('unsorted keyframes are handled correctly', () => {
    const result = getKeyframeNav([{ frame: 20 }, { frame: 5 }, { frame: 10 }], 7);
    expect(result).toEqual({
      prevFrame: 5,
      nextFrame: 10,
      isOnKf: false,
      canPrev: true,
      canNext: true,
    });
  });
});
