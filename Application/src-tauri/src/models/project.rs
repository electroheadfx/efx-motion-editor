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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_id: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub image_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub video_path: Option<String>,
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
