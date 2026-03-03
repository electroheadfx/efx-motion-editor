use crate::models::project::{MceImageRef, MceProject};
use std::fs;
use std::path::Path;

/// Create the project directory with images/ and images/.thumbs/ subdirectories.
pub fn create_project_dir(dir_path: &str) -> Result<(), String> {
    let base = Path::new(dir_path);
    let images_dir = base.join("images");
    let thumbs_dir = images_dir.join(".thumbs");

    fs::create_dir_all(&thumbs_dir)
        .map_err(|e| format!("Failed to create project directories: {}", e))?;

    Ok(())
}

/// Save project to .mce file using atomic write (temp file + rename).
/// The project_root is the directory containing the .mce file.
pub fn save_project(project: &MceProject, file_path: &str, _project_root: &str) -> Result<(), String> {
    let json = serde_json::to_string_pretty(project)
        .map_err(|e| format!("Failed to serialize project: {}", e))?;

    let tmp_path = format!("{}.tmp", file_path);

    // Write to temp file first
    fs::write(&tmp_path, &json)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;

    // Atomic rename
    fs::rename(&tmp_path, file_path)
        .map_err(|e| format!("Failed to rename temp file: {}", e))?;

    Ok(())
}

/// Open project from .mce file. Returns MceProject with paths as stored (relative).
pub fn open_project(file_path: &str) -> Result<MceProject, String> {
    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read project file: {}", e))?;

    let project: MceProject = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse project file: {}", e))?;

    Ok(project)
}

/// Convert an absolute path to a relative path by stripping the project root prefix.
pub fn make_relative(abs_path: &str, project_root: &str) -> String {
    let root = if project_root.ends_with('/') {
        project_root.to_string()
    } else {
        format!("{}/", project_root)
    };

    if abs_path.starts_with(&root) {
        abs_path[root.len()..].to_string()
    } else {
        // Already relative or different root -- return as-is
        abs_path.to_string()
    }
}

/// Convert a relative path to an absolute path by joining with the project root.
pub fn make_absolute(rel_path: &str, project_root: &str) -> String {
    let root = project_root.trim_end_matches('/');
    format!("{}/{}", root, rel_path)
}

/// Move images/ and images/.thumbs/ from temp_dir to project_dir.
/// Returns a list of migrated file names (for path updating).
/// Uses fs::rename for same-volume (fast), falls back to copy+delete for cross-volume.
pub fn migrate_temp_images(temp_dir: &str, project_dir: &str) -> Result<Vec<String>, String> {
    let src_images = Path::new(temp_dir).join("images");
    let dst_images = Path::new(project_dir).join("images");

    if !src_images.exists() {
        return Ok(vec![]); // Nothing to migrate
    }

    // Ensure destination dirs exist
    fs::create_dir_all(dst_images.join(".thumbs"))
        .map_err(|e| format!("Failed to create images dir: {e}"))?;

    let mut migrated = vec![];

    // Move each file from src_images to dst_images (skip .thumbs dir itself)
    for entry in fs::read_dir(&src_images).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_dir() && path.file_name().map_or(false, |n| n == ".thumbs") {
            // Handle .thumbs subdirectory
            for thumb_entry in fs::read_dir(&path).map_err(|e| e.to_string())? {
                let thumb_entry = thumb_entry.map_err(|e| e.to_string())?;
                let thumb_src = thumb_entry.path();
                if thumb_src.is_file() {
                    let fname = thumb_src.file_name().unwrap().to_string_lossy().to_string();
                    let thumb_dst = dst_images.join(".thumbs").join(&fname);
                    move_file(&thumb_src, &thumb_dst)?;
                }
            }
        } else if path.is_file() {
            let fname = path.file_name().unwrap().to_string_lossy().to_string();
            let dst = dst_images.join(&fname);
            move_file(&path, &dst)?;
            migrated.push(fname);
        }
    }

    Ok(migrated)
}

/// Move a file: try rename first (fast, same volume), fall back to copy+delete (cross-volume).
fn move_file(src: &Path, dst: &Path) -> Result<(), String> {
    match fs::rename(src, dst) {
        Ok(()) => Ok(()),
        Err(_) => {
            fs::copy(src, dst).map_err(|e| format!("Copy failed: {e}"))?;
            fs::remove_file(src).map_err(|e| format!("Remove after copy failed: {e}"))?;
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_project_dir_creates_subdirectories() {
        let test_dir = std::env::temp_dir().join("efx_test_proj_create");
        let _ = std::fs::remove_dir_all(&test_dir);
        create_project_dir(test_dir.to_str().unwrap()).unwrap();
        assert!(test_dir.join("images").exists());
        assert!(test_dir.join("images/.thumbs").exists());
        let _ = std::fs::remove_dir_all(&test_dir);
    }

    #[test]
    fn test_save_and_open_roundtrip() {
        let test_dir = std::env::temp_dir().join("efx_test_proj_roundtrip");
        let _ = std::fs::remove_dir_all(&test_dir);
        std::fs::create_dir_all(&test_dir).unwrap();

        let project = MceProject {
            version: 1,
            name: "Test Project".into(),
            fps: 24,
            width: 1920,
            height: 1080,
            created_at: "2026-03-03T10:00:00Z".into(),
            modified_at: "2026-03-03T10:00:00Z".into(),
            sequences: vec![],
            images: vec![MceImageRef {
                id: "img-1".into(),
                original_filename: "photo.jpg".into(),
                relative_path: "images/photo_abc12345.jpg".into(),
                thumbnail_relative_path: "images/.thumbs/abc12345_thumb.jpg".into(),
                width: 1920,
                height: 1080,
                format: "jpg".into(),
            }],
        };

        let mce_path = test_dir.join("test.mce");
        let project_root = test_dir.to_str().unwrap();
        save_project(&project, mce_path.to_str().unwrap(), project_root).unwrap();

        assert!(mce_path.exists());

        let loaded = open_project(mce_path.to_str().unwrap()).unwrap();
        assert_eq!(loaded.name, "Test Project");
        assert_eq!(loaded.images.len(), 1);
        assert_eq!(loaded.images[0].id, "img-1");
        // After open, paths remain relative (frontend resolves to absolute using project root)
        assert_eq!(loaded.images[0].relative_path, "images/photo_abc12345.jpg");

        let _ = std::fs::remove_dir_all(&test_dir);
    }

    #[test]
    fn test_make_relative_and_absolute() {
        let abs = "/Users/me/project/images/photo.jpg";
        let root = "/Users/me/project";
        let rel = make_relative(abs, root);
        assert_eq!(rel, "images/photo.jpg");
        let back = make_absolute(&rel, root);
        assert_eq!(back, "/Users/me/project/images/photo.jpg");
    }

    #[test]
    fn test_atomic_write_creates_no_temp_file() {
        let test_dir = std::env::temp_dir().join("efx_test_atomic");
        let _ = std::fs::remove_dir_all(&test_dir);
        std::fs::create_dir_all(&test_dir).unwrap();

        let project = MceProject {
            version: 1,
            name: "Atomic Test".into(),
            fps: 24,
            width: 1920,
            height: 1080,
            created_at: "2026-03-03T10:00:00Z".into(),
            modified_at: "2026-03-03T10:00:00Z".into(),
            sequences: vec![],
            images: vec![],
        };

        let mce_path = test_dir.join("test.mce");
        save_project(
            &project,
            mce_path.to_str().unwrap(),
            test_dir.to_str().unwrap(),
        )
        .unwrap();

        // Temp file should NOT exist after save completes
        assert!(!test_dir.join("test.mce.tmp").exists());
        assert!(mce_path.exists());

        let _ = std::fs::remove_dir_all(&test_dir);
    }
}
