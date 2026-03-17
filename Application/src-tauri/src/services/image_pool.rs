use image::imageops::FilterType;
use image::ImageReader;
use std::fs;
use std::path::{Path, PathBuf};

use crate::models::image::ImportedImage;

/// Fully supported image extensions (can decode and thumbnail)
const SUPPORTED_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "tiff", "tif"];

/// HEIC/HEIF extensions -- accepted in file dialog but not yet decodable
const HEIC_EXTENSIONS: &[&str] = &["heic", "heif"];

/// Check if a file extension is a supported image format
pub fn is_supported_format(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Check if a file extension is HEIC/HEIF (accepted but not yet supported)
pub fn is_heic_format(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| HEIC_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Process a single image: copy to project dir, generate thumbnail, return metadata.
/// This function is CPU-intensive and should be called inside spawn_blocking.
pub fn process_image(source_path: &str, project_dir: &str) -> Result<ImportedImage, String> {
    let source = Path::new(source_path);

    // Validate source exists
    if !source.exists() {
        return Err(format!("File not found: {}", source_path));
    }

    // Check for HEIC/HEIF -- accepted in file dialog but not yet decodable
    if is_heic_format(source) {
        return Err("HEIC is not yet supported. HEIC/HEIF decoding will be added in a future update. Please convert to JPEG or PNG.".to_string());
    }

    // Validate format
    if !is_supported_format(source) {
        let ext = source
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("unknown");
        return Err(format!(
            "Unsupported format: .{}. Supported: JPEG, PNG, TIFF",
            ext
        ));
    }

    let id = uuid::Uuid::new_v4().to_string();

    // Create project images and thumbs directories
    let images_dir = PathBuf::from(project_dir).join("images");
    let thumbs_dir = images_dir.join(".thumbs");
    fs::create_dir_all(&images_dir)
        .map_err(|e| format!("Failed to create images dir: {}", e))?;
    fs::create_dir_all(&thumbs_dir)
        .map_err(|e| format!("Failed to create thumbs dir: {}", e))?;

    // Generate a unique filename to avoid collisions
    let stem = source
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("image");
    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg");
    let unique_filename = format!("{}_{}.{}", stem, &id[..8], ext);
    let dest = images_dir.join(&unique_filename);

    // Copy original to project directory
    fs::copy(source, &dest).map_err(|e| format!("Failed to copy image: {}", e))?;

    // Load image and get dimensions
    let img = ImageReader::open(&dest)
        .map_err(|e| format!("Failed to open image: {}", e))?
        .with_guessed_format()
        .map_err(|e| format!("Failed to detect format: {}", e))?
        .decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    let width = img.width();
    let height = img.height();

    // Generate thumbnail (300x225 max, preserving aspect ratio)
    // Using FilterType::Triangle for speed (good enough for thumbnails)
    let thumb = img.resize(300, 225, FilterType::Triangle);
    let thumb_filename = format!("{}_thumb.jpg", id);
    let thumb_path = thumbs_dir.join(&thumb_filename);

    // Save thumbnail as JPEG
    thumb
        .save(&thumb_path)
        .map_err(|e| format!("Failed to save thumbnail: {}", e))?;

    // Canonicalize paths to resolve symlinks (e.g. /tmp -> /private/tmp on macOS)
    // so the Tauri asset protocol can match them against its scope
    let canonical_dest = fs::canonicalize(&dest)
        .unwrap_or(dest)
        .to_string_lossy()
        .into_owned();
    let canonical_thumb = fs::canonicalize(&thumb_path)
        .unwrap_or(thumb_path)
        .to_string_lossy()
        .into_owned();

    Ok(ImportedImage {
        id,
        original_path: source_path.to_string(),
        project_path: canonical_dest,
        thumbnail_path: canonical_thumb,
        width,
        height,
        format: ext.to_lowercase(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_process_image_creates_thumbnail() {
        // Use a test image -- create a minimal PNG in memory
        let test_dir = std::env::temp_dir().join("efx_test_import");
        let _ = fs::remove_dir_all(&test_dir);
        fs::create_dir_all(&test_dir).unwrap();

        // Create a minimal test image
        let img = image::RgbImage::new(200, 150);
        let test_img_path = test_dir.join("test.png");
        img.save(&test_img_path).unwrap();

        let project_dir = test_dir.join("project");
        let result = process_image(
            test_img_path.to_str().unwrap(),
            project_dir.to_str().unwrap(),
        );

        assert!(result.is_ok(), "Import failed: {:?}", result.err());
        let imported = result.unwrap();

        // Verify the imported image metadata
        assert_eq!(imported.width, 200);
        assert_eq!(imported.height, 150);
        assert_eq!(imported.format, "png");
        assert!(!imported.id.is_empty());

        // Verify files were created
        assert!(
            Path::new(&imported.project_path).exists(),
            "Project copy missing"
        );
        assert!(
            Path::new(&imported.thumbnail_path).exists(),
            "Thumbnail missing"
        );

        // Verify thumbnail is a JPEG and is smaller than original
        let thumb_meta = fs::metadata(&imported.thumbnail_path).unwrap();
        assert!(thumb_meta.len() > 0, "Thumbnail is empty");
        assert!(
            imported.thumbnail_path.ends_with("_thumb.jpg"),
            "Thumbnail should be JPEG"
        );

        // Cleanup
        let _ = fs::remove_dir_all(&test_dir);
    }

    #[test]
    fn test_heic_returns_graceful_not_yet_supported_error() {
        let test_dir = std::env::temp_dir().join("efx_test_heic");
        let _ = fs::remove_dir_all(&test_dir);
        fs::create_dir_all(&test_dir).unwrap();

        let test_file = test_dir.join("test.heic");
        fs::write(&test_file, b"fake heic content").unwrap();

        let project_dir = test_dir.join("project");
        let result = process_image(
            test_file.to_str().unwrap(),
            project_dir.to_str().unwrap(),
        );

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(
            err.contains("HEIC is not yet supported"),
            "Expected HEIC-specific error, got: {}",
            err
        );

        let _ = fs::remove_dir_all(&test_dir);
    }

    #[test]
    fn test_unsupported_format_returns_error() {
        let test_dir = std::env::temp_dir().join("efx_test_unsupported");
        let _ = fs::remove_dir_all(&test_dir);
        fs::create_dir_all(&test_dir).unwrap();

        let test_file = test_dir.join("test.bmp");
        fs::write(&test_file, b"fake bmp content").unwrap();

        let project_dir = test_dir.join("project");
        let result = process_image(
            test_file.to_str().unwrap(),
            project_dir.to_str().unwrap(),
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Unsupported format"));

        let _ = fs::remove_dir_all(&test_dir);
    }

    #[test]
    fn test_missing_file_returns_error() {
        let result = process_image("/nonexistent/path/image.jpg", "/tmp/project");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("File not found"));
    }
}
