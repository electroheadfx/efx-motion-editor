import type {MceAudioTrack} from './audio';

/** Legacy type -- used by project_get_default */
export interface ProjectData {
  name: string;
  fps: number;
  width: number;
  height: number;
}

/** Full .mce project file format */
export interface MceProject {
  version: number;
  name: string;
  fps: number;
  width: number;
  height: number;
  created_at: string;
  modified_at: string;
  sequences: MceSequence[];
  images: MceImageRef[];
  audio_tracks?: MceAudioTrack[];  // Optional for backward compat with v7
}

/** Sequence definition within a project file */
export interface MceSequence {
  id: string;
  name: string;
  fps: number;
  width: number;
  height: number;
  order: number;
  key_photos: MceKeyPhoto[];
  layers?: MceLayer[];  // Optional for backward compat with v1 files
  kind?: string;       // 'content' | 'fx' (optional for v2/v3 compat, defaults to 'content')
  in_frame?: number;   // FX sequence start frame
  out_frame?: number;  // FX sequence end frame
  fade_in?: MceTransition;
  fade_out?: MceTransition;
  cross_dissolve?: MceTransition;
}

/** Layer definition within a sequence in the .mce file */
export interface MceLayer {
  id: string;
  name: string;
  type: string;  // 'static-image' | 'image-sequence' | 'video'
  visible: boolean;
  opacity: number;
  blend_mode: string;
  transform: MceLayerTransform;
  source: MceLayerSource;
  is_base: boolean;
  order: number;
  blur?: number;  // Per-layer blur radius (0-1), optional for backward compat
  keyframes?: MceKeyframe[];  // Animation keyframes, optional for backward compat with v5 files
}

export interface MceLayerTransform {
  x: number;
  y: number;
  scale_x: number;
  scale_y: number;
  scale?: number;  // Optional: backward compat for reading v4 files
  rotation: number;
  crop_top: number;
  crop_right: number;
  crop_bottom: number;
  crop_left: number;
}

export interface MceLayerSource {
  type: string;
  // Content layer fields (existing)
  image_id?: string;
  image_ids?: string[];
  video_path?: string;
  // Generator common fields
  lock_seed?: boolean;
  seed?: number;
  // Generator-grain
  density?: number;
  size?: number;
  intensity?: number;
  // Generator-particles (count, speed, size_min, size_max)
  count?: number;
  speed?: number;
  size_min?: number;
  size_max?: number;
  // Generator-lines (count, thickness, length_min, length_max)
  thickness?: number;
  length_min?: number;
  length_max?: number;
  // Generator-vignette (size, softness, intensity shared above)
  softness?: number;
  // Adjustment-color-grade
  brightness?: number;
  contrast?: number;
  saturation?: number;
  hue?: number;
  fade?: number;
  tint_color?: string;
  preset?: string;
  fade_blend?: string;
  // Adjustment-blur
  radius?: number;
}

/** Transition definition within a sequence in the .mce file */
export interface MceTransition {
  type: string;        // 'fade-in' | 'fade-out' | 'cross-dissolve'
  duration: number;    // in frames
  mode: string;        // 'transparency' | 'solid'
  color: string;       // hex color
  curve: string;       // EasingType string
}

/** Keyframe definition for serialization (snake_case fields) */
export interface MceKeyframe {
  frame: number;
  easing: string;
  values: MceKeyframeValues;
}

/** Keyframe animatable values (snake_case for .mce format) */
export interface MceKeyframeValues {
  opacity: number;
  x: number;
  y: number;
  scale_x: number;
  scale_y: number;
  rotation: number;
  blur: number;
  source_overrides?: Record<string, number>;  // FX layer source property overrides
}

/** Key photo within a sequence -- references an image by ID */
export interface MceKeyPhoto {
  id: string;
  image_id: string;
  hold_frames: number;
  order: number;
}

/** Image reference in the project -- stores relative paths for portability */
export interface MceImageRef {
  id: string;
  original_filename: string;
  relative_path: string;
  thumbnail_relative_path: string;
  width: number;
  height: number;
  format: string;
}
