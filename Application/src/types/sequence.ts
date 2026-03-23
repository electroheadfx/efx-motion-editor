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

/** GL shader transition — mutually exclusive with crossDissolve per D-02 */
export interface GlTransition {
  shaderId: string;           // references ShaderDefinition.id from shaderLibrary
  params: Record<string, number>;  // shader parameter values (static, not keyframe-animatable per D-10)
  duration: number;           // frames (same meaning as crossDissolve.duration per D-09)
  curve: EasingType;          // easing applied to progress before passing to shader
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
  glTransition?: GlTransition; // optional GL shader transition TO the next sequence — mutually exclusive with crossDissolve (D-02)
}

/** Runtime key photo type (frontend state) */
export interface KeyPhoto {
  id: string;
  imageId: string;           // '' for solids/transparents (keeps existing code safe)
  holdFrames: number;
  solidColor?: string;       // hex color string, present for solid entries (default '#000000')
  isTransparent?: boolean;   // true for transparent entries
}

/** Helper discriminators */
export function isKeySolid(kp: KeyPhoto): boolean {
  return !!kp.solidColor && !kp.isTransparent;
}
export function isKeyTransparent(kp: KeyPhoto): boolean {
  return !!kp.isTransparent;
}
export function isKeyImage(kp: KeyPhoto): boolean {
  return !!kp.imageId && !kp.solidColor && !kp.isTransparent;
}

// For .mce file format types, see types/project.ts (MceSequence, MceKeyPhoto)
