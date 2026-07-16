use crate::models::project::{MceProject, ProjectData};
use crate::services::project_io;
use tauri::command;
use tauri::Manager;
use crate::services::script_library::ScriptLibraryState;

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
    // Create project directory structure FIRST so we can canonicalize
    project_io::create_project_dir(&dir_path)?;

    // Canonicalize then register with asset protocol scope.
    // This resolves macOS Unicode normalization differences (NFC vs NFD)
    // that cause 403 errors on paths with accented characters (e.g. "Téléchargements").
    let canonical = std::fs::canonicalize(&dir_path)
        .unwrap_or_else(|_| std::path::PathBuf::from(&dir_path));
    let scope = app.asset_protocol_scope();
    scope
        .allow_directory(&canonical, true)
        .map_err(|e| format!("Failed to register asset scope: {e}"))?;

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
        audio_tracks: vec![],
        physic_paint_outputs: vec![],
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

#[command]
pub fn project_save_as_with_script_library(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, ScriptLibraryState>,
    project: MceProject,
    source_file_path: String,
    destination_file_path: String,
) -> Result<crate::services::script_library::ScriptLibraryMigration, String> {
    if window.label() != "main" { return Err("Save As is owned by the main window".to_string()); }
    let source_root = std::path::Path::new(&source_file_path).parent().ok_or_else(|| "Source project path has no parent".to_string())?;
    let destination_root = std::path::Path::new(&destination_file_path).parent().ok_or_else(|| "Destination project path has no parent".to_string())?;
    let destination_path = std::path::Path::new(&destination_file_path);
    let previous_destination = if destination_path.exists() { Some(std::fs::read(destination_path).map_err(|error| format!("Could not stage existing Save As destination: {error}"))?) } else { None };
    project_io::save_project(&project, &destination_file_path, destination_root.to_string_lossy().as_ref())?;
    match state.migrate_active(source_root, destination_root) {
        Ok(migration) => Ok(migration),
        Err(error) => {
            let rollback = match previous_destination {
                Some(bytes) => std::fs::write(destination_path, bytes),
                None => std::fs::remove_file(destination_path),
            };
            if let Err(rollback_error) = rollback { return Err(format!("Save As script migration failed: {error}. Destination rollback also failed: {rollback_error}")); }
            Err(format!("Save As script migration failed; destination project was restored: {error}"))
        }
    }
}

/// Open project from .mce file.
/// Also registers the project directory with the asset protocol scope.
#[command]
pub fn project_open(app: tauri::AppHandle, file_path: String) -> Result<MceProject, String> {
    let project_root = std::path::Path::new(&file_path)
        .parent()
        .ok_or_else(|| "Invalid file path".to_string())?;

    // Canonicalize then register with asset protocol scope.
    // This resolves macOS Unicode normalization differences (NFC vs NFD)
    // that cause 403 errors on paths with accented characters.
    let canonical = std::fs::canonicalize(project_root)
        .unwrap_or_else(|_| project_root.to_path_buf());
    let scope = app.asset_protocol_scope();
    scope
        .allow_directory(&canonical, true)
        .map_err(|e| format!("Failed to register asset scope: {e}"))?;

    project_io::open_project(&file_path)
}

/// Check if a file path exists on disk.
/// Uses std::path::Path directly -- not restricted by Tauri FS scope.
#[command]
pub fn path_exists(file_path: String) -> bool {
    std::path::Path::new(&file_path).exists()
}

/// Move images and .thumbs from temp dir to real project dir
#[command]
pub fn project_migrate_temp_images(
    temp_dir: String,
    project_dir: String,
) -> Result<Vec<String>, String> {
    project_io::migrate_temp_images(&temp_dir, &project_dir)
}
