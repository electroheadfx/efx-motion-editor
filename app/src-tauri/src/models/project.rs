use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

/// Legacy type -- kept for project_get_default backward compatibility
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectData {
    pub name: String,
    pub fps: u32,
    pub width: u32,
    pub height: u32,
}

/// Full .mce project file format
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceProject {
    pub version: u32,
    pub name: String,
    pub fps: u32,
    pub width: u32,
    pub height: u32,
    pub created_at: String,
    pub modified_at: String,
    pub sequences: Vec<MceSequence>,
    pub images: Vec<MceImageRef>,
    /// Gallery audio assets (imported, used or not). Declared here because
    /// serde drops undeclared keys — without this field every save would erase
    /// the gallery rows (same class of hole as `format_version` below).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub audio_assets: Vec<MceAudioAssetRef>,
    /// Gallery video assets (261012-d6q, VID-02). Declared here because
    /// serde drops undeclared keys — without this field every save would erase
    /// the gallery rows, same hole as `audio_assets` above.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub video_assets: Vec<MceVideoAssetRef>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub audio_tracks: Vec<MceAudioTrack>,
    /// v1.0 EFX Paint documents keyed by parent layer id (F1). Carried
    /// opaquely as serde_json values — TS owns the fail-closed schema,
    /// mirroring the roto_physical escape hatch.
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub efx_paint_documents: HashMap<String, Value>,
    /// The package format version (D-04), stamped by `buildPackageManifest`
    /// and judged by the TS refusal gate (52.2-08). `None` on a pre-52.2
    /// project. Declared here because serde drops undeclared keys: without
    /// this field every save would erase the version the gate reads.
    #[serde(default, rename = "formatVersion", skip_serializing_if = "Option::is_none")]
    pub format_version: Option<u32>,
    /// The package identity (D-05): a 36-character lower-case UUID carried IN
    /// the manifest, never derived from the file path (52.2-02).
    #[serde(default, rename = "projectId", skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    /// The layer index (`layerId` → `{ layerFile, documentRevision,
    /// compositeRevision }`), carried opaquely like `efx_paint_documents`:
    /// TS owns the schema (52.2-02 `buildPackageManifest`).
    #[serde(default, rename = "efxPaint", skip_serializing_if = "HashMap::is_empty")]
    pub efx_paint: HashMap<String, Value>,
    /// Motion-blur prefs (N2). MUST be declared here as well as in the TS
    /// `MceProject` — serde drops undeclared keys, so without this field every
    /// save -> close -> reopen reset the prefs to defaults.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub motion_blur: Option<MceMotionBlur>,
}

/// Motion-blur prefs carried on the project (N2, dual-language law).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceMotionBlur {
    pub enabled: bool,
    pub shutter_angle: f64,
    pub preview_quality: String,
    pub export_sub_frames: u32,
}

/// Gallery audio asset reference (261009-rko): absolute on-disk path, never
/// copied into the package. Carries the same disk-reference law as
/// `MceAudioTrack.source_path`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceAudioAssetRef {
    pub id: String,
    pub name: String,
    pub source_path: String,
}

/// Gallery video asset reference (261012-d6q, VID-01): absolute on-disk path,
/// never copied into the package. Disk-reference law mirrors
/// `MceAudioAssetRef` — the picked file stays at its origin.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceVideoAssetRef {
    pub id: String,
    pub name: String,
    pub source_path: String,
}

/// Audio track in project file (Phase 15)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceAudioTrack {
    pub id: String,
    pub name: String,
    /// Absolute path to the audio file on disk (261009-rko: heavy media stay
    /// disk references — never copied into the package). Retired key
    /// `relative_path` is refused by the TS load door before this model sees it.
    pub source_path: String,
    pub original_filename: String,
    pub offset_frame: i32,
    pub in_frame: u32,
    pub out_frame: u32,
    pub volume: f64,
    pub muted: bool,
    pub fade_in_frames: u32,
    pub fade_out_frames: u32,
    pub fade_in_curve: String,
    pub fade_out_curve: String,
    pub sample_rate: u32,
    pub duration: f64,
    pub channel_count: u32,
    pub order: u32,
    pub track_height: u32,
    pub slip_offset: i32,
    #[serde(default)]
    pub total_frames_in_file: u32,
    /// Stable audio asset reference (v9+)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audio_asset_id: Option<String>,
    /// Detected BPM (None = not yet detected)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bpm: Option<f64>,
    /// Beat offset in frames from track start
    #[serde(default)]
    pub beat_offset_frames: u32,
    /// Pre-computed beat marker frame numbers
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub beat_markers: Vec<u32>,
    /// Whether beat markers are visible on timeline
    #[serde(default)]
    pub show_beat_markers: bool,
}

/// Sequence definition within a project
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceSequence {
    pub id: String,
    pub name: String,
    /// Retired on the TS side (53.1-01: project fps is the only timebase), but
    /// kept here defaulted so pre-53.1 manifests still parse and a save payload
    /// that omits it is accepted. No Rust reader touches this — see the
    /// dual-language law (261012-d6q): a required field one language stops
    /// sending is a hard parse rejection on the other.
    #[serde(default)]
    pub fps: u32,
    pub width: u32,
    pub height: u32,
    pub order: u32,
    pub key_photos: Vec<MceKeyPhoto>,
    #[serde(default)]
    pub layers: Vec<MceLayer>,
    /// "content" or "fx" (None defaults to "content" on frontend)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    /// Per-clip past-source extrapolation (53.1 D-07 / I-5): "hold" or "loop".
    /// MUST be declared here as well as in the TS `MceSequence` — the open path
    /// deserializes through serde (`open_project`), which silently drops any key
    /// this struct does not name (261012-d6q dual-language law).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub extrapolation: Option<String>,
    /// FX sequence start frame
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub in_frame: Option<u32>,
    /// FX sequence end frame
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub out_frame: Option<u32>,
    /// FX sequence visibility (None = visible)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub visible: Option<bool>,
    /// Fade-in transition
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fade_in: Option<MceTransition>,
    /// Fade-out transition
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fade_out: Option<MceTransition>,
    /// Cross dissolve transition to next sequence
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cross_dissolve: Option<MceTransition>,
    /// GL shader transition to next sequence (mutually exclusive with cross_dissolve)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gl_transition: Option<MceGlTransition>,
}

/// Transition definition within a sequence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceTransition {
    #[serde(rename = "type")]
    pub transition_type: String,
    pub duration: u32,
    pub mode: String,
    pub color: String,
    pub curve: String,
}

/// GL shader transition definition within a sequence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceGlTransition {
    pub shader_id: String,
    pub params: std::collections::HashMap<String, f64>,
    pub duration: u32,
    pub curve: String,
}

/// Layer definition within a sequence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceLayer {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub layer_type: String,
    pub visible: bool,
    pub opacity: f64,
    pub blend_mode: String,
    pub transform: MceLayerTransform,
    pub source: MceLayerSource,
    pub is_base: bool,
    pub order: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub blur: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub paint_bg_color: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub keyframes: Vec<MceKeyframe>,
}

/// Default scale value (1.0) for backward-compatible deserialization of v4 files
fn default_scale() -> f64 {
    1.0
}

/// Layer transform properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceLayerTransform {
    pub x: f64,
    pub y: f64,
    #[serde(default = "default_scale")]
    pub scale_x: f64,
    #[serde(default = "default_scale")]
    pub scale_y: f64,
    /// Legacy field: only present in v4 files, used for migration
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scale: Option<f64>,
    pub rotation: f64,
    pub crop_top: f64,
    pub crop_right: f64,
    pub crop_bottom: f64,
    pub crop_left: f64,
}

/// Layer source data (discriminated by type)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceLayerSource {
    #[serde(rename = "type")]
    pub source_type: String,
    // Content layer fields (existing)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image_id: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub image_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub video_path: Option<String>,
    /// Stable video asset reference (N1). MUST be declared here as well as in
    /// the TS `MceLayerSource` — serde drops undeclared keys, so without this
    /// field every open fell back to a fresh UUID and duplicated the gallery row.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub video_asset_id: Option<String>,
    // Generator common fields
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lock_seed: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub seed: Option<u32>,
    // Generator-grain fields (density, size, intensity)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub density: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub size: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub intensity: Option<f64>,
    // Generator-particles fields (count, speed, size_min, size_max)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub count: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub speed: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub size_min: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub size_max: Option<f64>,
    // Generator-lines fields (thickness, length_min, length_max)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thickness: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub length_min: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub length_max: Option<f64>,
    // Generator-vignette fields (softness; size and intensity shared above)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub softness: Option<f64>,
    // Adjustment-color-grade fields
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub brightness: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub contrast: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub saturation: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hue: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fade: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tint_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preset: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fade_blend: Option<String>,
    // Adjustment-blur fields
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub radius: Option<f64>,
    // GLSL shader fields (generator-glsl / adjustment-glsl)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shader_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub params: Option<std::collections::HashMap<String, f64>>,
    // Paint layer fields
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub layer_id: Option<String>,
}

/// Animation keyframe on a layer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceKeyframe {
    pub frame: u32,
    pub easing: String,
    pub values: MceKeyframeValues,
}

/// Animatable property values at a keyframe
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceKeyframeValues {
    pub opacity: f64,
    pub x: f64,
    pub y: f64,
    pub scale_x: f64,
    pub scale_y: f64,
    pub rotation: f64,
    #[serde(default)]
    pub blur: f64,
    /// FX layer source-property overrides (N3). MUST be declared here as well
    /// as in the TS `MceKeyframeValues` — serde drops undeclared keys.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_overrides: Option<std::collections::HashMap<String, f64>>,
}

/// Gradient stop in the .mce file format (v13+)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceGradientStop {
    pub color: String,
    pub position: f64,
}

/// Gradient data in the .mce file format (v13+)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceGradientData {
    #[serde(rename = "type")]
    pub gradient_type: String,
    pub stops: Vec<MceGradientStop>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub angle: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub center_x: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub center_y: Option<f64>,
}

/// Key photo within a sequence -- references an image by ID
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceKeyPhoto {
    pub id: String,
    pub image_id: String,
    pub hold_frames: u32,
    pub order: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub solid_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_transparent: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gradient: Option<MceGradientData>,
}

/// Image reference in the project -- stores relative paths for portability
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceImageRef {
    pub id: String,
    pub original_filename: String,
    pub relative_path: String,
    pub thumbnail_relative_path: String,
    pub width: u32,
    pub height: u32,
    pub format: String,
}

// ---------------------------------------------------------------------------
// Phase 56 .mce field set (DATA-04 / D-27 / F1 co-change with TS).
//
// serde silently drops any key these structs do not name, so every new field
// this phase persists is declared in BOTH languages in the same change set.
// The four members below document the wire shapes that ride inside the v1.0
// package carriers; declaring them here puts them under the field-diff pin.
// ---------------------------------------------------------------------------

/// Paper display state carried on the document fond (PAPER-03 / D-22).
/// `id` = paper library texture id, `strength` = grain strength [0..1],
/// `scale` = grain pattern scale. Display-class: rotates the change token,
/// never rebakes paint pixels (D-21).
///
/// Contract declaration (DATA-04 / D-27): the wire shape is pinned in both
/// languages so the field-diff test can see it; the v1.0 package carrier is
/// still opaque (`HashMap<String, Value>`) and does not construct this yet.
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McePaperDisplayState {
    pub id: String,
    pub strength: f64,
    pub scale: f64,
}

/// Aquarelle per-brush property surface (AQUA-03 / R1.7 / D-08). The 8
/// numeric multipliers snapshotted onto a stroke at record time; the same
/// flat surface rides every brush-pack snapshot entry.
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceAquarelleBrushProperties {
    pub tip: f64,
    pub aspect: f64,
    pub rotation: f64,
    #[serde(rename = "sizeCurve")]
    pub size_curve: f64,
    pub scatter: f64,
    pub capacity: f64,
    pub grain: f64,
    #[serde(rename = "wetRound")]
    pub wet_round: f64,
}

/// Per-engine stroke payload carrier in the shared script envelope (HOST-02 /
/// D-19). The `engine` slot is opaque — the host never inspects it; carried
/// as a serde_json::Value presence carrier (physic_paint_outputs style).
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceEngineStrokePayload {
    pub engine: Option<Value>,
}

/// Brush-pack snapshot travelling in `.mce` (MOD-04 / D-23). Deliberate
/// exception to the 52.2 refs-only law: entries are inline data, never a file
/// reference. Two-language by design — NOT an ALLOWED_ONE_LANGUAGE entry.
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceBrushPackSnapshot {
    pub kind: String,
    pub entries: Vec<Value>,
}
