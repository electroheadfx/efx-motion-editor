export type LayerType =
  | 'static-image'
  | 'image-sequence'
  | 'video'
  | 'generator-grain'
  | 'generator-particles'
  | 'generator-lines'
  | 'generator-dots'
  | 'generator-vignette'
  | 'generator-glsl'
  | 'adjustment-color-grade'
  | 'adjustment-blur'
  | 'adjustment-glsl';

export type BlendMode = 'normal' | 'screen' | 'multiply' | 'overlay' | 'add';

/** Source data varies by layer type */
export type LayerSourceData =
  | { type: 'static-image'; imageId: string }
  | { type: 'image-sequence'; imageIds: string[] }  // Base layer: empty array (uses sequence's keyPhotos/frameMap). Overlay layers: imported image IDs sorted by filename, indexed as frame % imageIds.length
  | { type: 'video'; videoAssetId: string }  // References VideoAsset.id in imageStore
  | { type: 'generator-grain'; density: number; size: number; intensity: number; lockSeed: boolean; seed: number }
  | { type: 'generator-particles'; count: number; speed: number; sizeMin: number; sizeMax: number; lockSeed: boolean; seed: number }
  | { type: 'generator-lines'; count: number; thickness: number; lengthMin: number; lengthMax: number; lockSeed: boolean; seed: number }
  | { type: 'generator-dots'; count: number; sizeMin: number; sizeMax: number; speed: number; lockSeed: boolean; seed: number }
  | { type: 'generator-vignette'; size: number; softness: number; intensity: number }
  | { type: 'adjustment-color-grade'; brightness: number; contrast: number; saturation: number; hue: number; fade: number; tintColor: string; preset: string; fadeBlend?: string }
  | { type: 'adjustment-blur'; radius: number }
  | { type: 'generator-glsl'; shaderId: string; params: Record<string, number> }
  | { type: 'adjustment-glsl'; shaderId: string; params: Record<string, number> };

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  transform: LayerTransform;
  source: LayerSourceData;
  isBase?: boolean;  // true for auto-generated base layer (non-deletable)
  blur?: number;  // per-layer blur radius (normalized 0-1, default 0)
  keyframes?: Keyframe[];  // Animation keyframes (sequence-local frame offsets)
}

export interface LayerTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  cropTop: number;
  cropRight: number;
  cropBottom: number;
  cropLeft: number;
}

export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

/** Snapshot of all animatable layer properties at a keyframe */
export interface KeyframeValues {
  opacity: number;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  blur: number;
  sourceOverrides?: Record<string, number>;  // FX layer source property overrides (e.g., { density: 0.3, size: 1 })
}

/** A single animation keyframe on a layer */
export interface Keyframe {
  frame: number;          // Sequence-local frame offset (NOT global frame number)
  easing: EasingType;     // Interpolation curve to the NEXT keyframe
  values: KeyframeValues; // Snapshot of all animatable properties
}

/** Create a default LayerTransform with identity values */
export function defaultTransform(): LayerTransform {
  return { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0 };
}

/** Create the auto-generated base layer for a sequence */
export function createBaseLayer(): Layer {
  return {
    id: 'base',
    name: 'Key Photos',
    type: 'image-sequence',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: defaultTransform(),
    source: { type: 'image-sequence', imageIds: [] },
    isBase: true,
  };
}

/** Extract all numeric source properties from an FX layer (excluding non-animatable fields) */
export function extractFxSourceValues(layer: Layer): Record<string, number> {
  const result: Record<string, number> = {};
  const source = layer.source as Record<string, unknown>;

  // For GLSL layers, extract from nested params object
  if ('params' in source && typeof source.params === 'object' && source.params !== null) {
    for (const key in source.params as Record<string, unknown>) {
      const val = (source.params as Record<string, unknown>)[key];
      if (typeof val === 'number') {
        result[key] = val;
      }
    }
    return result;
  }

  const exclude = new Set(['type', 'lockSeed', 'lock_seed', 'seed', 'tintColor', 'tint_color', 'preset', 'fadeBlend', 'fade_blend']);
  for (const key in source) {
    if (exclude.has(key)) continue;
    const val = source[key];
    if (typeof val === 'number') {
      result[key] = val;
    }
  }
  return result;
}

/** Extract animatable property values from a layer into a KeyframeValues snapshot */
export function extractKeyframeValues(layer: Layer): KeyframeValues {
  return {
    opacity: layer.opacity,
    x: layer.transform.x,
    y: layer.transform.y,
    scaleX: layer.transform.scaleX,
    scaleY: layer.transform.scaleY,
    rotation: layer.transform.rotation,
    blur: layer.blur ?? 0,
    ...(isFxLayer(layer) ? { sourceOverrides: extractFxSourceValues(layer) } : {}),
  };
}

/** Returns true for generator-* layer types */
export function isGeneratorLayer(layer: Layer): boolean {
  return layer.type.startsWith('generator-');
}

/** Returns true for adjustment-* layer types */
export function isAdjustmentLayer(layer: Layer): boolean {
  return layer.type.startsWith('adjustment-');
}

/** Returns true for any FX layer (generator or adjustment) */
export function isFxLayer(layer: Layer): boolean {
  return isGeneratorLayer(layer) || isAdjustmentLayer(layer);
}

/** Returns default source data for a given FX layer type */
export function createDefaultFxSource(type: LayerType): LayerSourceData {
  switch (type) {
    case 'generator-grain':
      return { type: 'generator-grain', density: 0.3, size: 1, intensity: 0.5, lockSeed: true, seed: 42 };
    case 'generator-particles':
      return { type: 'generator-particles', count: 50, speed: 1, sizeMin: 1, sizeMax: 4, lockSeed: true, seed: 42 };
    case 'generator-lines':
      return { type: 'generator-lines', count: 15, thickness: 1, lengthMin: 0.1, lengthMax: 0.4, lockSeed: true, seed: 42 };
    case 'generator-dots':
      return { type: 'generator-dots', count: 30, sizeMin: 2, sizeMax: 8, speed: 0.5, lockSeed: true, seed: 42 };
    case 'generator-vignette':
      return { type: 'generator-vignette', size: 0.6, softness: 0.5, intensity: 0.7 };
    case 'adjustment-color-grade':
      return { type: 'adjustment-color-grade', brightness: 0, contrast: 0, saturation: 0, hue: 0, fade: 0, tintColor: '#D4A574', preset: 'none' };
    case 'adjustment-blur':
      return { type: 'adjustment-blur', radius: 0.3 };
    case 'generator-glsl':
      return { type: 'generator-glsl', shaderId: '', params: {} };
    case 'adjustment-glsl':
      return { type: 'adjustment-glsl', shaderId: '', params: {} };
    default:
      throw new Error(`Not an FX layer type: ${type}`);
  }
}
