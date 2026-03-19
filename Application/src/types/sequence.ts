import type { Layer } from './layer';

/** Runtime sequence type used by sequenceStore (frontend state) */
export interface Sequence {
  id: string;
  kind: 'content' | 'fx' | 'content-overlay';  // Discriminator: content = key photos, fx = effects, content-overlay = timeline-level content layers
  name: string;
  fps: number;
  width: number;
  height: number;
  keyPhotos: KeyPhoto[];
  layers: Layer[];  // Ordered bottom-to-top; layers[0] is always the base layer
  inFrame?: number;   // inclusive start frame (global timeline, FX sequences only)
  outFrame?: number;  // exclusive end frame (global timeline, FX sequences only)
  visible?: boolean;  // FX sequences: undefined/true = visible, false = hidden
}

/** Runtime key photo type (frontend state) */
export interface KeyPhoto {
  id: string;
  imageId: string;
  holdFrames: number;
}

// For .mce file format types, see types/project.ts (MceSequence, MceKeyPhoto)
