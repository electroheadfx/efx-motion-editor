import type {MceAudioTrack} from './audio';
import type {PhysicPaintRenderedFrame, PhysicPaintRotoBackgroundMetadata, PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings, PhysicPaintRotoPlaybackSettings} from './physicPaint';
import type {
  PhysicPaintRotoInterpolationState,
  PhysicPaintRotoPhysicalDocument,
  PhysicPaintRotoScriptMotionSettings,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';

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
  motion_blur?: {
    enabled: boolean;
    shutter_angle: number;        // 0-360 degrees
    preview_quality: string;       // 'off' | 'low' | 'medium'
    export_sub_frames: number;     // 4, 8, or 16
  };
  physic_paint_outputs?: McePhysicPaintOutput[];
}

export type RuntimeMceProject = Omit<MceProject, 'physic_paint_outputs'> & {
  physic_paint_outputs?: RuntimePhysicPaintOutput[];
};

export interface McePhysicPaintCachedFrame {
  frameIndex: number;
  appFrame: number;
  cache_path: string;
  width?: number;
  height?: number;
}

export type McePhysicPaintRotoCachedFrame = Omit<PhysicPaintRotoCacheFrame, 'dataUrl' | 'onionDataUrl'> & {
  cache_path?: string;
  onion_cache_path?: string;
};

export interface McePhysicPaintRotoPhysicalRecord {
  readonly kind: 'real-key';
  readonly keyId: string;
  readonly appFrame: number;
  readonly payload: {
    readonly frameIndex: number;
    readonly appFrame: number;
    readonly cache_path: string;
    readonly width?: number;
    readonly height?: number;
  };
}

/**
 * Persisted linked Loop Clip record (Phase 43, D-29/D-31). The persisted
 * shape is identical to the runtime record: Loop Clips carry stable keyId
 * references only — no cache paths — so the collection serializes verbatim.
 */
export interface McePhysicPaintRotoLoopClip {
  readonly loopId: string;
  readonly placementStart: number;
  readonly sourceKeyIds: readonly string[];
  readonly repeat: number | 'infinity';
  readonly mode: 'progressive' | 'static';
  /** 43-06 optional source-cycle provenance (all-or-nothing). */
  readonly scriptId?: string;
  readonly motion?: PhysicPaintRotoScriptMotionSettings;
  readonly overrideColor?: string | null;
}

export interface McePhysicPaintRotoPhysicalDocument {
  readonly capacity: number;
  readonly realKeyRecords: readonly McePhysicPaintRotoPhysicalRecord[];
  readonly interpolation: PhysicPaintRotoInterpolationState;
  readonly scriptMotion: PhysicPaintRotoScriptMotionSettings;
  readonly background: PhysicPaintRotoBackgroundMetadata | null;
  readonly selectedKeyId: string | null;
  readonly cursorAppFrame: number;
  readonly revision: string;
  /**
   * Additive optional loopClips collection (D-29): v0.8.1-shaped documents
   * without the member load as an empty loop collection with no migration.
   */
  readonly loopClips?: readonly McePhysicPaintRotoLoopClip[];
}

export interface McePhysicPaintOutput {
  layer_id: string;
  frames: McePhysicPaintCachedFrame[];
  roto_physical?: McePhysicPaintRotoPhysicalDocument;
  roto_playback?: PhysicPaintRotoPlaybackSettings;
  roto_cache_metadata?: McePhysicPaintRotoCachedFrame[];
  roto_interpolation_settings?: PhysicPaintRotoInterpolationSettings;
  roto_background?: PhysicPaintRotoBackgroundMetadata;
}

export type RuntimePhysicPaintOutput = Omit<McePhysicPaintOutput, 'frames' | 'roto_physical' | 'roto_cache_metadata'> & {
  frames: PhysicPaintRenderedFrame[];
  roto_physical?: PhysicPaintRotoPhysicalDocument;
  roto_cache_metadata?: PhysicPaintRotoCacheFrame[];
};

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
  paint_bg_color?: string;  // Per-paint-layer background color (transparent default)
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
  video_path?: string;      // Kept for v8 backward compat reading
  video_asset_id?: string;  // Stable asset reference (v9+)
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
  // GLSL shaders (generator-glsl / adjustment-glsl)
  shader_id?: string;
  params?: Record<string, number>;
  // Paint and physic-paint layer identity
  layer_id?: string;
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

/** Gradient stop in the .mce file format (v13+) */
export interface MceGradientStop {
  color: string;
  position: number;
}

/** Gradient data in the .mce file format (v13+) */
export interface MceGradientData {
  type: string;               // 'linear' | 'radial' | 'conic'
  stops: MceGradientStop[];
  angle?: number;
  center_x?: number;          // snake_case for .mce format consistency
  center_y?: number;
}

/** Key photo within a sequence -- references an image by ID */
export interface MceKeyPhoto {
  id: string;
  image_id: string;
  hold_frames: number;
  order: number;
  solid_color?: string;      // v10+: hex color for solid entries
  is_transparent?: boolean;  // v10+: true for transparent entries
  gradient?: MceGradientData;  // v13+: gradient fill data
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
