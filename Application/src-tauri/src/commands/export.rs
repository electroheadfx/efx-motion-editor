use std::path::Path;
use chrono::Local;
use tauri::command;

/// Create the timestamped export subfolder per D-18: export_YYYY-MM-DD_HH-MM/
#[command]
pub fn export_create_dir(base_dir: String) -> Result<String, String> {
    let timestamp = Local::now().format("%Y-%m-%d_%H-%M").to_string();
    let export_dir = Path::new(&base_dir).join(format!("export_{}", timestamp));
    std::fs::create_dir_all(&export_dir)
        .map_err(|e| format!("Failed to create export directory: {e}"))?;
    Ok(export_dir.to_string_lossy().to_string())
}

/// Write PNG bytes to disk with atomic temp+rename pattern (same as project_io)
#[command]
pub fn export_write_png(dir_path: String, filename: String, data: Vec<u8>) -> Result<(), String> {
    let path = Path::new(&dir_path).join(&filename);
    let tmp_path = path.with_extension("png.tmp");
    std::fs::write(&tmp_path, &data)
        .map_err(|e| format!("Failed to write PNG: {e}"))?;
    std::fs::rename(&tmp_path, &path)
        .map_err(|e| format!("Failed to rename PNG: {e}"))?;
    Ok(())
}

/// Count existing PNG files in a directory (for resume-from-frame, per D-29)
#[command]
pub fn export_count_existing_frames(dir_path: String) -> Result<u32, String> {
    let dir = Path::new(&dir_path);
    if !dir.exists() {
        return Ok(0);
    }
    let count = std::fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory: {e}"))?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry
                .path()
                .extension()
                .map_or(false, |ext| ext == "png")
        })
        .count();
    Ok(count as u32)
}

/// Open a folder in macOS Finder (per D-30: "Open in Finder" link)
#[command]
pub fn export_open_in_finder(path: String) -> Result<(), String> {
    std::process::Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to open Finder: {e}"))?;
    Ok(())
}
