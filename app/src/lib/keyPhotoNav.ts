export interface KeyPhotoRange {
  keyPhotoId: string;
  startFrame: number;
  endFrame: number;
}

/**
 * Pure helper: find the index of the key photo range containing the given frame.
 * Returns -1 if no range contains the frame.
 * Range is [startFrame, endFrame) -- start inclusive, end exclusive.
 */
export function getActiveKeyPhotoIndex(ranges: KeyPhotoRange[], frame: number): number {
  return ranges.findIndex(r => frame >= r.startFrame && frame < r.endFrame);
}
