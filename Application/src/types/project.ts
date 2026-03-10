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
}

export interface MceLayerTransform {
  x: number;
  y: number;
  scale: number;
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
