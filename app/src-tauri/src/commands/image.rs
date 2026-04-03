use tauri::command;
use tauri::Manager;

use crate::models::image::{ImageInfo, ImportError, ImportResult};
use crate::services::image_pool;

/// Existing command -- now with real image decoding instead of placeholder
#[command]
pub fn image_get_info(path: String) -> Result<ImageInfo, String> {
    // Lightweight info check -- does not copy or thumbnail
    let source = std::path::Path::new(&path);
    if !source.exists() {
        return Err(format!("File not found: {}", path));
    }

    let img = image::ImageReader::open(&path)
        .map_err(|e| e.to_string())?
        .with_guessed_format()
        .map_err(|e| e.to_string())?
        .decode()
        .map_err(|e| e.to_string())?;

    let format = source
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    Ok(ImageInfo {
        path,
        width: img.width(),
        height: img.height(),
        format,
    })
}

/// Import multiple images: copy to project dir, generate thumbnails.
/// Runs image processing in a blocking task to avoid freezing the UI.
/// Also ensures the project directory is registered with the asset protocol scope
/// (using the canonical path to handle macOS Unicode normalization).
#[command]
pub async fn import_images(
    app: tauri::AppHandle,
    paths: Vec<String>,
    project_dir: String,
) -> Result<ImportResult, String> {
    // Ensure project dir is in asset scope (canonicalized for Unicode normalization)
    let canonical = std::fs::canonicalize(&project_dir)
        .unwrap_or_else(|_| std::path::PathBuf::from(&project_dir));
    let scope = app.asset_protocol_scope();
    let _ = scope.allow_directory(&canonical, true);

    // Run CPU-intensive work off the main thread
    let result = tauri::async_runtime::spawn_blocking(move || {
        let mut imported = Vec::new();
        let mut errors = Vec::new();

        for path in &paths {
            match image_pool::process_image(path, &project_dir) {
                Ok(img) => imported.push(img),
                Err(e) => errors.push(ImportError {
                    path: path.clone(),
                    error: e,
                }),
            }
        }

        ImportResult { imported, errors }
    })
    .await
    .map_err(|e| format!("Import task failed: {}", e))?;

    Ok(result)
}
