import type { LayerType } from './layer';

export interface TimelineState {
  currentFrame: number;
  isPlaying: boolean;
  zoom: number;
  scrollX: number;
}

/** A single frame in the flattened frame array */
export interface FrameEntry {
  globalFrame: number;
  sequenceId: string;
  keyPhotoId: string;
  imageId: string;
  localFrame: number; // frame index within this key photo's hold duration
}

/** Layout info for a sequence track row in the timeline */
export interface TrackLayout {
  sequenceId: string;
  sequenceName: string;
  startFrame: number;
  endFrame: number; // exclusive
  keyPhotoRanges: KeyPhotoRange[];
  fadeIn?: { duration: number };
  fadeOut?: { duration: number };
  crossDissolve?: { duration: number };
}

/** Layout info for an FX or content-overlay sequence range bar in the timeline */
export interface FxTrackLayout {
  sequenceId: string;
  sequenceName: string;
  kind: 'fx' | 'content-overlay';
  inFrame: number;
  outFrame: number;  // exclusive
  color: string;     // accent color for the range bar
  visible: boolean;  // false when FX sequence is hidden (toggled off)
  thumbnailImageId?: string;  // used for thumbnail icon rendering in content overlay range bars
  layerType?: LayerType;      // used to distinguish static-image/image-sequence/video for color and rendering decisions
  fadeIn?: { duration: number };
  fadeOut?: { duration: number };
}

/** Frame range for a single key photo within a track */
export interface KeyPhotoRange {
  keyPhotoId: string;
  imageId: string;
  startFrame: number;
  endFrame: number; // exclusive
  holdFrames: number;
}
