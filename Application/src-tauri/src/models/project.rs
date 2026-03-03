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
