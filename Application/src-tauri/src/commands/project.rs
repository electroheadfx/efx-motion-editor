use crate::models::project::{MceProject, ProjectData};
use crate::services::project_io;
use tauri::command;
use tauri::Manager;

/// Legacy command -- kept for backward compatibility
#[command]
pub fn project_get_default() -> ProjectData {
    ProjectData {
        name: "Untitled Project".into(),
        fps: 24,
        width: 1920,
        height: 1080,
    }
}

/// Create a new project: makes directory structure, returns initial MceProject.
/// Also registers the project directory with the asset protocol scope so
/// thumbnails display correctly for projects outside $APPDATA.
#[command]
pub fn project_create(
    app: tauri::AppHandle,
    name: String,
    fps: u32,
    dir_path: String,
) -> Result<MceProject, String> {
    // Register project dir with asset protocol scope
    let scope = app.asset_protocol_scope();
    scope
        .allow_directory(std::path::Path::new(&dir_path), true)
        .map_err(|e| format!("Failed to register asset scope: {e}"))?;

    // Create project directory structure
    project_io::create_project_dir(&dir_path)?;

    let now = chrono::Utc::now().to_rfc3339();
    Ok(MceProject {
        version: 1,
        name,
        fps,
        width: 1920,
        height: 1080,
        created_at: now.clone(),
        modified_at: now,
        sequences: vec![],
        images: vec![],
    })
}

/// Save project to .mce file (atomic write)
#[command]
pub fn project_save(project: MceProject, file_path: String) -> Result<(), String> {
    let project_root = std::path::Path::new(&file_path)
        .parent()
        .ok_or_else(|| "Invalid file path: no parent directory".to_string())?
        .to_str()
        .ok_or_else(|| "Invalid file path: non-UTF8 characters".to_string())?;

    project_io::save_project(&project, &file_path, project_root)
}

/// Open project from .mce file.
/// Also registers the project directory with the asset protocol scope.
#[command]
pub fn project_open(app: tauri::AppHandle, file_path: String) -> Result<MceProject, String> {
    let project_root = std::path::Path::new(&file_path)
        .parent()
        .ok_or_else(|| "Invalid file path".to_string())?;

    // Register project dir with asset protocol scope
    let scope = app.asset_protocol_scope();
    scope
        .allow_directory(project_root, true)
        .map_err(|e| format!("Failed to register asset scope: {e}"))?;

    project_io::open_project(&file_path)
}

/// Move images and .thumbs from temp dir to real project dir
#[command]
pub fn project_migrate_temp_images(
    temp_dir: String,
    project_dir: String,
) -> Result<Vec<String>, String> {
    project_io::migrate_temp_images(&temp_dir, &project_dir)
}
