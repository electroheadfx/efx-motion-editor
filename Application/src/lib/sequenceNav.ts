import type {TrackLayout} from '../types/timeline';

/**
 * Find the start frame of the previous content sequence relative to currentFrame.
 * Returns the startFrame of the last sequence whose startFrame < currentFrame,
 * or null if already at or before the first sequence.
 */
export function findPrevSequenceStart(layouts: TrackLayout[], currentFrame: number): number | null {
  for (let i = layouts.length - 1; i >= 0; i--) {
    if (layouts[i].startFrame < currentFrame) {
      return layouts[i].startFrame;
    }
  }
  return null;
}

/**
 * Find the start frame of the next content sequence relative to currentFrame.
 * Returns the startFrame of the first sequence whose startFrame > currentFrame,
 * or null if already at or past the last sequence start.
 */
export function findNextSequenceStart(layouts: TrackLayout[], currentFrame: number): number | null {
  for (const layout of layouts) {
    if (layout.startFrame > currentFrame) {
      return layout.startFrame;
    }
  }
  return null;
}
