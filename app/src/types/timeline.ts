import type { LayerType } from './layer';
import type {WaveformPeaks, FadeCurve} from './audio';
import type {GlTransition, GradientData} from './sequence';

export interface TimelinePlayScriptMarker {
  id: string;
  startFrame: number;
  frameCount: number;
  active: boolean;
}

export interface TimelineRepeatDurationMarker {
  startFrame: number;
  frameCount: number;
}

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
  gradient?: GradientData;   // Gradient fill data for rendering
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

/** One first-cycle source cell of a Loop Clip capsule (Phase 43, D-15).
 *  `realKeyBacked` is true iff a real source key exists at this presentation
 *  frame (an original loop whose placement overlaps its source keys);
 *  duplicated-loop first-cycle cells are linked/virtual — they carry the
 *  shared source thumbnail but never a real-key diamond. */
export interface TimelineLoopCapsuleSourceCell {
  sourceKeyId: string;
  sourceAppFrame: number | null;  // null when the source reference dangles (D-31)
  dataUrl: string | null;         // real-key payload dataUrl; null when dangling
  realKeyBacked: boolean;
}

/** ONE compact interval model per Loop Clip for the filmstrip capsule
 *  (Phase 43, HOLD-06, D-32). Derived from the 43-02 resolver interval
 *  records through the store — never recomputed by the renderer, never a
 *  per-frame list of virtual occurrences. Frames are layer-local physical
 *  appFrames (same convention as `rotoKeyFrames`). */
export interface TimelineLoopCapsule {
  loopId: string;
  placementStart: number;              // first presentation frame of THIS loop (D-24 identity)
  cycleLength: number;
  repeat: number | 'infinity';
  requestedEnd: number | 'infinity';   // placementStart + cycleLength × repeat, or 'infinity'
  effectiveEnd: number;                // exclusive; D-24/D-25 derived by the resolver
  truncated: boolean;
  partialCycle: boolean;               // mid-cycle truncation vs exact cycle boundary (D-21)
  boundaryKind: 'real-key' | 'loop-start' | 'parent-end';
  boundaryFrame: number;
  mode: 'progressive' | 'static';      // source-cycle provenance (D-29)
  unresolved: { missingSourceKeyIds: readonly string[] } | null;  // D-31 verbatim
  firstCycleCells: readonly TimelineLoopCapsuleSourceCell[];
}

/** Layout info for an FX or content-overlay sequence range bar in the timeline */
export interface FxTrackLayout {
  sequenceId: string;
  sequenceName: string;
  headerLabel: string;
  kind: 'fx' | 'content-overlay';
  inFrame: number;
  outFrame: number;  // exclusive
  color: string;     // accent color for the range bar
  visible: boolean;  // false when FX sequence is hidden (toggled off)
  thumbnailImageId?: string;  // used for thumbnail icon rendering in content overlay range bars
  layerType?: LayerType;      // used to distinguish static-image/image-sequence/video for color and rendering decisions
  playScriptMarkers?: TimelinePlayScriptMarker[]; // saved Play ranges nested inside physic-paint FX bars
  rotoKeyFrames?: number[]; // layer-local physical appFrames of real Roto keys (C-04 markers)
  repeatDurationMarkers?: TimelineRepeatDurationMarker[];
  loopCapsules?: TimelineLoopCapsule[]; // resolver-derived Loop Clip capsule models (Phase 43, HOLD-06)
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
  gradient?: GradientData;   // gradient fill data for gradient key photo ranges
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
  beatMarkers: number[];      // Pre-computed beat frame positions
  showBeatMarkers: boolean;   // Per-track visibility toggle
  bpm: number | null;         // For display in properties
}
