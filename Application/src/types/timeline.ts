import type { LayerType } from './layer';
import type {WaveformPeaks, FadeCurve} from './audio';
import type {GlTransition} from './sequence';

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
  solidColor?: string;       // hex color for solid frames
  isTransparent?: boolean;   // true for transparent frames
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
  glTransition?: GlTransition;
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
  solidColor?: string;       // hex color for solid key photo ranges
  isTransparent?: boolean;   // true for transparent key photo ranges
}

/** Layout info for an audio track row in the timeline */
export interface AudioTrackLayout {
  trackId: string;
  trackName: string;
  offsetFrame: number;      // Global timeline position
  inFrame: number;          // Trim in-point
  outFrame: number;         // Trim out-point
  muted: boolean;
  volume: number;
  peaks: WaveformPeaks;     // Pre-computed peak data
  trackHeight: number;      // Per D-01, default 44
  fadeInFrames: number;
  fadeOutFrames: number;
  fadeInCurve: FadeCurve;
  fadeOutCurve: FadeCurve;
  slipOffset: number;       // Per D-09
  totalAudioFrames: number; // Total audio file length in frames (for peak slicing)
  selected: boolean;
}
