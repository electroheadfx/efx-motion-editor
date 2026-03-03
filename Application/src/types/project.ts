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
