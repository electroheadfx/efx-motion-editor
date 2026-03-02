use tauri::command;
use crate::models::image::ImageInfo;

#[command]
pub fn image_get_info(path: String) -> Result<ImageInfo, String> {
    // Placeholder -- actual implementation in Phase 2
    Ok(ImageInfo {
        path,
        width: 1920,
        height: 1080,
        format: "jpeg".into(),
    })
}
