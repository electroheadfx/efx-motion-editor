import { describe, it, expect } from 'vitest';
import { getActiveKeyPhotoIndex } from './keyPhotoNav';

describe('getActiveKeyPhotoIndex', () => {
  const ranges = [
    { keyPhotoId: 'kp1', startFrame: 0, endFrame: 10 },
    { keyPhotoId: 'kp2', startFrame: 10, endFrame: 25 },
    { keyPhotoId: 'kp3', startFrame: 25, endFrame: 40 },
  ];

  it('returns -1 for empty ranges', () => {
    expect(getActiveKeyPhotoIndex([], 5)).toBe(-1);
  });

  it('returns -1 for frame before all ranges', () => {
    const gapped = [{ keyPhotoId: 'kp1', startFrame: 10, endFrame: 20 }];
    expect(getActiveKeyPhotoIndex(gapped, 5)).toBe(-1);
  });

  it('returns -1 for frame after all ranges', () => {
    expect(getActiveKeyPhotoIndex(ranges, 40)).toBe(-1);
  });

  it('returns 0 for frame at start of first range', () => {
    expect(getActiveKeyPhotoIndex(ranges, 0)).toBe(0);
  });

  it('returns 0 for frame in middle of first range', () => {
    expect(getActiveKeyPhotoIndex(ranges, 5)).toBe(0);
  });

  it('returns 1 for frame at boundary (endFrame exclusive, next startFrame inclusive)', () => {
    expect(getActiveKeyPhotoIndex(ranges, 10)).toBe(1);
  });

  it('returns 1 for frame in middle of second range', () => {
    expect(getActiveKeyPhotoIndex(ranges, 18)).toBe(1);
  });

  it('returns 2 for frame in last range', () => {
    expect(getActiveKeyPhotoIndex(ranges, 30)).toBe(2);
  });

  it('returns -1 for frame in gap between non-contiguous ranges', () => {
    const gapped = [
      { keyPhotoId: 'kp1', startFrame: 0, endFrame: 10 },
      { keyPhotoId: 'kp2', startFrame: 15, endFrame: 25 },
    ];
    expect(getActiveKeyPhotoIndex(gapped, 12)).toBe(-1);
  });
});
