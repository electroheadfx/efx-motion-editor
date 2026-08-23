use crate::models::project::MceProject;
use crate::services::physic_paint_cache::bind_cache_transaction_to_project_write;
use std::fs::{self, File};
use std::io::Write;
use std::path::Path;

/// Create the project directory with images/, images/.thumbs/, videos/, paint/, and cache/ subdirectories.
pub fn create_project_dir(dir_path: &str) -> Result<(), String> {
    let base = Path::new(dir_path);
    let images_dir = base.join("images");
    let thumbs_dir = images_dir.join(".thumbs");
    let videos_dir = base.join("videos");
    let paint_dir = base.join("paint");
    let physic_paint_cache_dir = base.join("cache").join("physic-paint");
    let scripts_dir = base.join("scripts");

    fs::create_dir_all(&thumbs_dir)
        .map_err(|e| format!("Failed to create project directories: {}", e))?;

    fs::create_dir_all(&videos_dir)
        .map_err(|e| format!("Failed to create videos directory: {}", e))?;

    fs::create_dir_all(&paint_dir)
        .map_err(|e| format!("Failed to create paint directory: {}", e))?;

    fs::create_dir_all(&physic_paint_cache_dir)
        .map_err(|e| format!("Failed to create Physics Paint cache directory: {}", e))?;

    fs::create_dir_all(&scripts_dir)
        .map_err(|e| format!("Failed to create scripts directory: {}", e))?;

    Ok(())
}

/// Save project to .mce file using atomic write (temp file + rename).
/// The project_root is the directory containing the .mce file.
pub fn save_project(
    project: &MceProject,
    file_path: &str,
    project_root: &str,
    physic_paint_cache_transaction_id: Option<&str>,
) -> Result<(), String> {
    let json = serde_json::to_vec_pretty(project)
        .map_err(|e| format!("Failed to serialize project: {}", e))?;
    let file_path = Path::new(file_path);
    let project_root = Path::new(project_root);
    let tmp_path = file_path.with_extension(format!(
        "{}.tmp",
        file_path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
    ));

    let mut temp_file =
        File::create(&tmp_path).map_err(|e| format!("Failed to create temp file: {}", e))?;
    temp_file
        .write_all(&json)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;
    temp_file
        .sync_all()
        .map_err(|e| format!("Failed to synchronize temp file: {}", e))?;

    if let Some(transaction_id) = physic_paint_cache_transaction_id {
        bind_cache_transaction_to_project_write(project_root, file_path, &json, transaction_id)?;
    }

    fs::rename(&tmp_path, file_path).map_err(|e| format!("Failed to rename temp file: {}", e))?;
    File::open(project_root)
        .and_then(|directory| directory.sync_all())
        .map_err(|e| format!("Failed to synchronize project directory: {}", e))?;

    Ok(())
}

/// Open project from .mce file. Returns MceProject with paths as stored (relative).
pub fn open_project(file_path: &str) -> Result<MceProject, String> {
    let content =
        fs::read_to_string(file_path).map_err(|e| format!("Failed to read project file: {}", e))?;

    let project: MceProject = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse project file: {}", e))?;

    Ok(project)
}

/// Convert an absolute path to a relative path by stripping the project root prefix.
#[cfg(test)]
fn make_relative(abs_path: &str, project_root: &str) -> String {
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
#[cfg(test)]
fn make_absolute(rel_path: &str, project_root: &str) -> String {
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
    use crate::models::project::{
        MceImageRef, MceLayer, MceLayerSource, MceLayerTransform, MceSequence,
    };
    use crate::services::physic_paint_cache::{
        publish_cache_generation, recover_cache_transaction,
    };
    use uuid::Uuid;

    #[test]
    fn test_create_project_dir_creates_subdirectories() {
        let test_dir = std::env::temp_dir().join("efx_test_proj_create");
        let _ = std::fs::remove_dir_all(&test_dir);
        create_project_dir(test_dir.to_str().unwrap()).unwrap();
        assert!(test_dir.join("images").exists());
        assert!(test_dir.join("images/.thumbs").exists());
        assert!(test_dir.join("paint").exists());
        // The v1.0 cache directory is created for new projects...
        assert!(test_dir.join("cache/efx-paint").exists());
        // ...and the legacy cache directory is never created (DOC-04).
        assert!(!test_dir.join("cache/physic-paint").exists());
        let _ = std::fs::remove_dir_all(&test_dir);
    }

    #[test]
    fn test_create_project_dir_leaves_legacy_cache_untouched() {
        let test_dir = std::env::temp_dir().join("efx_test_proj_legacy_cache");
        let _ = std::fs::remove_dir_all(&test_dir);
        std::fs::create_dir_all(test_dir.join("cache/physic-paint")).unwrap();
        std::fs::write(test_dir.join("cache/physic-paint/old.png"), b"legacy").unwrap();

        create_project_dir(test_dir.to_str().unwrap()).unwrap();

        // D-04: a pre-existing legacy cache directory is never read, moved, or
        // deleted — it stays byte-untouched with its prior contents.
        assert!(test_dir.join("cache/physic-paint/old.png").exists());
        assert_eq!(
            std::fs::read(test_dir.join("cache/physic-paint/old.png")).unwrap(),
            b"legacy"
        );
        assert!(test_dir.join("cache/efx-paint").exists());
        let _ = std::fs::remove_dir_all(&test_dir);
    }

    #[test]
    fn test_save_and_open_roundtrip() {
        let test_dir = std::env::temp_dir().join("efx_test_proj_roundtrip");
        let _ = std::fs::remove_dir_all(&test_dir);
        std::fs::create_dir_all(&test_dir).unwrap();

        // Opaque legacy blob: presence is round-tripped for the TS rejection
        // gate but never interpreted by Rust (D-02/D-06).
        let legacy_blob = serde_json::json!({
            "layer_id": "phys-layer-1",
            "frames": [{
                "frameIndex": 0,
                "appFrame": 12,
                "cache_path": "cache/physic-paint/phys-layer-1/frame-000012-0000.png",
                "width": 1000,
                "height": 650
            }],
            "roto_physical": {
                "background": "canvas2",
                "paperGrain": "canvas3",
                "grainStrength": 0.65
            }
        });
        // Arbitrary nested v1.0 document payload carried opaquely (F1).
        let document_payload = serde_json::json!({
            "version": 1,
            "parentLayerId": "layer-1",
            "documentRevision": 0,
            "activeTrackId": "track-1",
            "tracks": [{
                "id": "track-1",
                "name": "Track 1",
                "kind": "paint",
                "order": 0,
                "visible": true,
                "opacity": 1.0,
                "blendMode": "normal",
                "frames": [],
                "loopClips": []
            }],
            "background": {
                "id": "bg-1",
                "clips": [],
                "fallback": { "mode": "transparent" },
                "visible": true,
                "revision": 0
            },
            "photoReference": null,
            "compositeRevision": 0
        });

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
            audio_tracks: vec![],
            physic_paint_outputs: vec![legacy_blob.clone()],
            efx_paint_documents: std::collections::HashMap::from([(
                "layer-1".to_string(),
                document_payload.clone(),
            )]),
        };

        let mce_path = test_dir.join("test.mce");
        let project_root = test_dir.to_str().unwrap();
        save_project(&project, mce_path.to_str().unwrap(), project_root, None).unwrap();

        assert!(mce_path.exists());

        let loaded = open_project(mce_path.to_str().unwrap()).unwrap();
        assert_eq!(loaded.name, "Test Project");
        assert_eq!(loaded.images.len(), 1);
        assert_eq!(loaded.images[0].id, "img-1");
        // After open, paths remain relative (frontend resolves to absolute using project root)
        assert_eq!(loaded.images[0].relative_path, "images/photo_abc12345.jpg");
        // The v1.0 document key survives the strict serde round-trip byte-identical (F1).
        assert_eq!(loaded.efx_paint_documents.len(), 1);
        assert_eq!(
            loaded.efx_paint_documents.get("layer-1"),
            Some(&document_payload)
        );
        // The legacy blob round-trips as an opaque presence carrier (D-02/D-06).
        assert_eq!(loaded.physic_paint_outputs, vec![legacy_blob]);

        let _ = std::fs::remove_dir_all(&test_dir);
    }

    #[test]
    fn test_legacy_physic_paint_outputs_open_as_opaque_presence() {
        let test_dir = std::env::temp_dir().join("efx_test_legacy_outputs");
        let _ = std::fs::remove_dir_all(&test_dir);
        std::fs::create_dir_all(&test_dir).unwrap();

        // A pre-v1.0 project file carrying a legacy physic_paint_outputs array.
        let legacy_json = r#"{
            "version": 1,
            "name": "Legacy Project",
            "fps": 24,
            "width": 1920,
            "height": 1080,
            "created_at": "2026-01-01T00:00:00Z",
            "modified_at": "2026-01-01T00:00:00Z",
            "sequences": [],
            "images": [],
            "audio_tracks": [],
            "physic_paint_outputs": [{
                "layer_id": "phys-layer-1",
                "frames": [{
                    "frameIndex": 0,
                    "appFrame": 12,
                    "cache_path": "cache/physic-paint/phys-layer-1/frame-000012-0000.png"
                }],
                "roto_physical": { "background": "canvas2" }
            }]
        }"#;

        let mce_path = test_dir.join("legacy.mce");
        std::fs::write(&mce_path, legacy_json).unwrap();

        let loaded = open_project(mce_path.to_str().unwrap()).unwrap();
        // Presence is visible to the TS rejection gate; the blob is never
        // interpreted, migrated, or rendered (D-02/D-06).
        assert_eq!(loaded.physic_paint_outputs.len(), 1);
        assert_eq!(loaded.efx_paint_documents.len(), 0);

        let _ = std::fs::remove_dir_all(&test_dir);
    }

    #[test]
    fn test_save_skips_empty_document_keys() {
        let test_dir = std::env::temp_dir().join("efx_test_skip_empty_keys");
        let _ = std::fs::remove_dir_all(&test_dir);
        std::fs::create_dir_all(&test_dir).unwrap();

        let project = MceProject {
            version: 1,
            name: "Empty Keys".into(),
            fps: 24,
            width: 1920,
            height: 1080,
            created_at: "2026-03-03T10:00:00Z".into(),
            modified_at: "2026-03-03T10:00:00Z".into(),
            sequences: vec![],
            images: vec![],
            audio_tracks: vec![],
            physic_paint_outputs: vec![],
            efx_paint_documents: std::collections::HashMap::new(),
        };

        let mce_path = test_dir.join("empty_keys.mce");
        save_project(
            &project,
            mce_path.to_str().unwrap(),
            test_dir.to_str().unwrap(),
            None,
        )
        .unwrap();

        let saved = std::fs::read_to_string(&mce_path).unwrap();
        assert!(!saved.contains("efx_paint_documents"));
        assert!(!saved.contains("physic_paint_outputs"));

        let _ = std::fs::remove_dir_all(&test_dir);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn project_save_binds_cache_transaction_for_open_time_commit_recovery() {
        let test_dir =
            std::env::temp_dir().join(format!("efx_test_cache_project_save_{}", Uuid::new_v4()));
        std::fs::create_dir_all(test_dir.join("cache/physic-paint")).expect("canonical cache");
        std::fs::write(test_dir.join("cache/physic-paint/old.png"), b"old").expect("old cache");
        let staging_basename = format!(".physic-paint-staging-{}", Uuid::new_v4());
        let staging = test_dir.join("cache").join(&staging_basename);
        std::fs::create_dir_all(&staging).expect("staging cache");
        std::fs::write(staging.join("new.png"), b"new").expect("new cache");
        let publication =
            publish_cache_generation(&test_dir, &staging_basename).expect("cache publication");
        let project = MceProject {
            version: 1,
            name: "Cache Transaction".into(),
            fps: 24,
            width: 1920,
            height: 1080,
            created_at: "2026-08-12T00:00:00Z".into(),
            modified_at: "2026-08-12T00:00:00Z".into(),
            sequences: vec![],
            images: vec![],
            audio_tracks: vec![],
            physic_paint_outputs: vec![],
            efx_paint_documents: std::collections::HashMap::new(),
        };
        let project_path = test_dir.join("project.mce");

        save_project(
            &project,
            project_path.to_str().unwrap(),
            test_dir.to_str().unwrap(),
            Some(&publication.transaction_id),
        )
        .expect("project save");
        recover_cache_transaction(&test_dir).expect("open-time recovery");

        assert!(test_dir.join("cache/physic-paint/new.png").exists());
        assert!(!test_dir.join("cache/physic-paint/old.png").exists());
        assert!(!staging.exists());
        assert!(!test_dir
            .join("cache/.physic-paint-transaction.json")
            .exists());
        assert_eq!(
            open_project(project_path.to_str().unwrap()).unwrap().name,
            project.name
        );
        std::fs::remove_dir_all(test_dir).expect("fixture cleanup");
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
            audio_tracks: vec![],
            physic_paint_outputs: vec![],
            efx_paint_documents: std::collections::HashMap::new(),
        };

        let mce_path = test_dir.join("test.mce");
        save_project(
            &project,
            mce_path.to_str().unwrap(),
            test_dir.to_str().unwrap(),
            None,
        )
        .unwrap();

        // Temp file should NOT exist after save completes
        assert!(!test_dir.join("test.mce.tmp").exists());
        assert!(mce_path.exists());

        let _ = std::fs::remove_dir_all(&test_dir);
    }

    /// Helper to create a default MceLayerTransform
    fn default_transform() -> MceLayerTransform {
        MceLayerTransform {
            x: 0.0,
            y: 0.0,
            scale_x: 1.0,
            scale_y: 1.0,
            scale: None,
            rotation: 0.0,
            crop_top: 0.0,
            crop_right: 0.0,
            crop_bottom: 0.0,
            crop_left: 0.0,
        }
    }

    /// Helper to create a default content-layer MceLayerSource
    fn default_source() -> MceLayerSource {
        MceLayerSource {
            source_type: "image-sequence".into(),
            image_id: None,
            image_ids: vec![],
            video_path: None,
            lock_seed: None,
            seed: None,
            density: None,
            size: None,
            intensity: None,
            count: None,
            speed: None,
            size_min: None,
            size_max: None,
            thickness: None,
            length_min: None,
            length_max: None,
            softness: None,
            brightness: None,
            contrast: None,
            saturation: None,
            hue: None,
            fade: None,
            tint_color: None,
            preset: None,
            fade_blend: None,
            radius: None,
            shader_id: None,
            params: None,
            layer_id: None,
        }
    }

    #[test]
    fn test_fx_sequence_roundtrip() {
        let test_dir = std::env::temp_dir().join("efx_test_fx_roundtrip");
        let _ = std::fs::remove_dir_all(&test_dir);
        std::fs::create_dir_all(&test_dir).unwrap();

        // Build a project with content + 2 FX sequences
        let content_seq = MceSequence {
            id: "seq-content".into(),
            name: "Scene 1".into(),
            fps: 24,
            width: 1920,
            height: 1080,
            order: 0,
            key_photos: vec![],
            layers: vec![MceLayer {
                id: "base".into(),
                name: "Key Photos".into(),
                layer_type: "image-sequence".into(),
                visible: true,
                opacity: 1.0,
                blend_mode: "normal".into(),
                transform: default_transform(),
                source: default_source(),
                is_base: true,
                order: 0,
                blur: None,
                paint_bg_color: None,
                keyframes: vec![],
            }],
            kind: Some("content".into()),
            in_frame: None,
            out_frame: None,
            visible: None,
            fade_in: None,
            fade_out: None,
            cross_dissolve: None,
            gl_transition: None,
        };

        let grain_seq = MceSequence {
            id: "seq-grain".into(),
            name: "Grain FX".into(),
            fps: 24,
            width: 1920,
            height: 1080,
            order: 1,
            key_photos: vec![],
            layers: vec![MceLayer {
                id: "layer-grain".into(),
                name: "Film Grain".into(),
                layer_type: "generator-grain".into(),
                visible: true,
                opacity: 0.8,
                blend_mode: "screen".into(),
                transform: default_transform(),
                source: MceLayerSource {
                    source_type: "generator-grain".into(),
                    density: Some(0.3),
                    size: Some(1.0),
                    intensity: Some(0.5),
                    lock_seed: Some(true),
                    seed: Some(42),
                    ..default_source()
                },
                is_base: false,
                order: 0,
                blur: None,
                paint_bg_color: None,
                keyframes: vec![],
            }],
            kind: Some("fx".into()),
            in_frame: Some(0),
            out_frame: Some(100),
            visible: None,
            fade_in: None,
            fade_out: None,
            cross_dissolve: None,
            gl_transition: None,
        };

        let colorgrade_seq = MceSequence {
            id: "seq-cg".into(),
            name: "Color Grade FX".into(),
            fps: 24,
            width: 1920,
            height: 1080,
            order: 2,
            key_photos: vec![],
            layers: vec![MceLayer {
                id: "layer-cg".into(),
                name: "Cinematic Grade".into(),
                layer_type: "adjustment-color-grade".into(),
                visible: true,
                opacity: 1.0,
                blend_mode: "normal".into(),
                transform: default_transform(),
                source: MceLayerSource {
                    source_type: "adjustment-color-grade".into(),
                    brightness: Some(0.1),
                    contrast: Some(-0.2),
                    saturation: Some(0.0),
                    hue: Some(0.0),
                    fade: Some(0.0),
                    tint_color: Some("#D4A574".into()),
                    preset: Some("cinematic".into()),
                    fade_blend: None,
                    ..default_source()
                },
                is_base: false,
                order: 0,
                blur: None,
                paint_bg_color: None,
                keyframes: vec![],
            }],
            kind: Some("fx".into()),
            in_frame: Some(10),
            out_frame: Some(90),
            visible: Some(true),
            fade_in: None,
            fade_out: None,
            cross_dissolve: None,
            gl_transition: None,
        };

        let project = MceProject {
            version: 4,
            name: "FX Test Project".into(),
            fps: 24,
            width: 1920,
            height: 1080,
            created_at: "2026-03-10T10:00:00Z".into(),
            modified_at: "2026-03-10T10:00:00Z".into(),
            sequences: vec![content_seq, grain_seq, colorgrade_seq],
            images: vec![],
            audio_tracks: vec![],
            physic_paint_outputs: vec![],
            efx_paint_documents: std::collections::HashMap::new(),
        };

        // Save
        let mce_path = test_dir.join("test_fx.mce");
        save_project(
            &project,
            mce_path.to_str().unwrap(),
            test_dir.to_str().unwrap(),
            None,
        )
        .unwrap();

        // Open
        let loaded = open_project(mce_path.to_str().unwrap()).unwrap();

        // Assert 3 sequences
        assert_eq!(loaded.sequences.len(), 3);

        // Content sequence
        let content = &loaded.sequences[0];
        assert_eq!(content.kind, Some("content".into()));

        // Grain FX sequence
        let grain = &loaded.sequences[1];
        assert_eq!(grain.kind, Some("fx".into()));
        assert_eq!(grain.in_frame, Some(0));
        assert_eq!(grain.out_frame, Some(100));
        assert_eq!(grain.visible, None); // None = visible by default

        let grain_layer = &grain.layers[0];
        assert_eq!(grain_layer.source.density, Some(0.3));
        assert_eq!(grain_layer.source.size, Some(1.0));
        assert_eq!(grain_layer.source.intensity, Some(0.5));
        assert_eq!(grain_layer.source.lock_seed, Some(true));
        assert_eq!(grain_layer.source.seed, Some(42));

        // Color grade FX sequence
        let cg = &loaded.sequences[2];
        assert_eq!(cg.kind, Some("fx".into()));
        assert_eq!(cg.in_frame, Some(10));
        assert_eq!(cg.out_frame, Some(90));

        let cg_layer = &cg.layers[0];
        assert_eq!(cg_layer.source.brightness, Some(0.1));
        assert_eq!(cg_layer.source.contrast, Some(-0.2));
        assert_eq!(cg_layer.source.tint_color, Some("#D4A574".into()));
        assert_eq!(cg_layer.source.preset, Some("cinematic".into()));

        // Content layers should have no FX source fields
        let base_layer = &content.layers[0];
        assert_eq!(base_layer.source.density, None);
        assert_eq!(base_layer.source.brightness, None);

        let _ = std::fs::remove_dir_all(&test_dir);
    }

    #[test]
    fn test_v3_project_without_fx_fields_opens() {
        let test_dir = std::env::temp_dir().join("efx_test_v3_compat");
        let _ = std::fs::remove_dir_all(&test_dir);
        std::fs::create_dir_all(&test_dir).unwrap();

        // A v3-style JSON with no kind, no in_frame/out_frame, no FX source fields
        let v3_json = r#"{
            "version": 3,
            "name": "Old Project",
            "fps": 24,
            "width": 1920,
            "height": 1080,
            "created_at": "2026-01-01T00:00:00Z",
            "modified_at": "2026-01-01T00:00:00Z",
            "sequences": [{
                "id": "seq-1",
                "name": "Scene 1",
                "fps": 24,
                "width": 1920,
                "height": 1080,
                "order": 0,
                "key_photos": [],
                "layers": [{
                    "id": "base",
                    "name": "Key Photos",
                    "type": "image-sequence",
                    "visible": true,
                    "opacity": 1.0,
                    "blend_mode": "normal",
                    "transform": {
                        "x": 0, "y": 0, "scale": 1, "rotation": 0,
                        "crop_top": 0, "crop_right": 0, "crop_bottom": 0, "crop_left": 0
                    },
                    "source": {
                        "type": "image-sequence",
                        "image_ids": []
                    },
                    "is_base": true,
                    "order": 0
                }]
            }],
            "images": []
        }"#;

        let mce_path = test_dir.join("old_project.mce");
        std::fs::write(&mce_path, v3_json).unwrap();

        // Should open without errors
        let loaded = open_project(mce_path.to_str().unwrap()).unwrap();

        assert_eq!(loaded.name, "Old Project");
        assert_eq!(loaded.version, 3);
        assert_eq!(loaded.sequences.len(), 1);

        let seq = &loaded.sequences[0];
        // No kind field in v3 JSON -> deserialized as None
        assert_eq!(seq.kind, None);
        assert_eq!(seq.in_frame, None);
        assert_eq!(seq.out_frame, None);
        assert_eq!(seq.visible, None);

        // Layer source has no FX fields -> all None
        let layer = &seq.layers[0];
        assert_eq!(layer.source.density, None);
        assert_eq!(layer.source.brightness, None);
        assert_eq!(layer.source.lock_seed, None);
        assert_eq!(layer.source.seed, None);

        let _ = std::fs::remove_dir_all(&test_dir);
    }
}
