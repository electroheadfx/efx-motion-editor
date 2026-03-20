import type { Layer, EasingType } from './layer';

export type TransitionType = 'fade-in' | 'fade-out' | 'cross-dissolve';
export type FadeMode = 'transparency' | 'solid';

export interface Transition {
  type: TransitionType;
  duration: number;       // in frames
  mode: FadeMode;         // 'transparency' for alpha, 'solid' for color overlay
  color: string;          // hex color, used when mode === 'solid', default '#000000'
  curve: EasingType;      // reuse existing EasingType
}

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
  fadeIn?: Transition;       // optional fade-in at sequence start
  fadeOut?: Transition;      // optional fade-out at sequence end
  crossDissolve?: Transition; // optional cross dissolve TO the next sequence (content only)
}

/** Runtime key photo type (frontend state) */
export interface KeyPhoto {
  id: string;
  imageId: string;
  holdFrames: number;
}

// For .mce file format types, see types/project.ts (MceSequence, MceKeyPhoto)
