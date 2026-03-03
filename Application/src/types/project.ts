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
  image_id?: string;
  image_ids?: string[];
  video_path?: string;
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
