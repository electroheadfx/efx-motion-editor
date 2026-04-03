use serde::{Deserialize, Serialize};

/// Existing -- kept for backward compatibility with image_get_info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageInfo {
    pub path: String,
    pub width: u32,
    pub height: u32,
    pub format: String,
}

/// An image that has been imported into the project
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportedImage {
    pub id: String,
    pub original_path: String,
    pub project_path: String,
    pub thumbnail_path: String,
    pub width: u32,
    pub height: u32,
    pub format: String,
}

/// Result for a batch import operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub imported: Vec<ImportedImage>,
    pub errors: Vec<ImportError>,
}

/// Error detail for a single failed import
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportError {
    pub path: String,
    pub error: String,
}
