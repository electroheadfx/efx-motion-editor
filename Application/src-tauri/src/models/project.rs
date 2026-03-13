use serde::{Deserialize, Serialize};

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
}

/// Sequence definition within a project
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceSequence {
    pub id: String,
    pub name: String,
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
    /// FX sequence start frame
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub in_frame: Option<u32>,
    /// FX sequence end frame
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub out_frame: Option<u32>,
    /// FX sequence visibility (None = visible)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub visible: Option<bool>,
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
}

/// Layer transform properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceLayerTransform {
    pub x: f64,
    pub y: f64,
    pub scale: f64,
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
}

/// Key photo within a sequence -- references an image by ID
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceKeyPhoto {
    pub id: String,
    pub image_id: String,
    pub hold_frames: u32,
    pub order: u32,
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
