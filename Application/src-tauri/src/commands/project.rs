use crate::models::project::{MceProject, ProjectData};
use crate::services::project_io;
use tauri::command;

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

/// Create a new project: makes directory structure, returns initial MceProject
#[command]
pub fn project_create(name: String, fps: u32, dir_path: String) -> Result<MceProject, String> {
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

/// Open project from .mce file
#[command]
pub fn project_open(file_path: String) -> Result<MceProject, String> {
    project_io::open_project(&file_path)
}
