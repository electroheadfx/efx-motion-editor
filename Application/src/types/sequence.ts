/** Runtime sequence type used by sequenceStore (frontend state) */
export interface Sequence {
  id: string;
  name: string;
  fps: number;
  width: number;
  height: number;
  keyPhotos: KeyPhoto[];
}

/** Runtime key photo type (frontend state) */
export interface KeyPhoto {
  id: string;
  imageId: string;
  holdFrames: number;
}

// For .mce file format types, see types/project.ts (MceSequence, MceKeyPhoto)
