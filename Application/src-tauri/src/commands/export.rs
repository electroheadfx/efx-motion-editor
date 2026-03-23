use std::path::Path;
use chrono::Local;
use tauri::command;

use crate::services::ffmpeg;

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

/// Check if FFmpeg is available. Returns version string or null.
#[command]
pub fn export_check_ffmpeg() -> Option<String> {
    ffmpeg::check_ffmpeg()
}

/// Download FFmpeg binary. Returns version string on success.
#[command]
pub async fn export_download_ffmpeg() -> Result<String, String> {
    ffmpeg::download_ffmpeg().await
}

/// Encode video from PNG sequence. Per D-19: output naming ProjectName_ResolutionP_codec.ext
/// audio_path: Optional path to pre-rendered WAV for muxing into the video.
/// Runs FFmpeg on a background thread via spawn_blocking to avoid blocking the Tauri main thread.
#[command]
pub async fn export_encode_video(
    png_dir: String,
    glob_pattern: String,
    output_path: String,
    codec: String,
    fps: u32,
    h264_crf: u32,
    av1_crf: u32,
    prores_profile: String,
    audio_path: Option<String>,
) -> Result<(), String> {
    let quality = ffmpeg::VideoQualityArgs {
        h264_crf,
        av1_crf,
        prores_profile,
    };
    tokio::task::spawn_blocking(move || {
        ffmpeg::encode_video(
            &png_dir, &glob_pattern, &output_path, &codec, fps, &quality,
            audio_path.as_deref(),
        )
    })
    .await
    .map_err(|e| format!("FFmpeg task panicked: {e}"))?
}

/// Delete intermediate PNG files from export directory after video encoding.
/// Keeps non-PNG files (video, metadata sidecar, FCPXML).
#[command]
pub fn export_cleanup_pngs(dir_path: String) -> Result<u32, String> {
    let dir = Path::new(&dir_path);
    if !dir.exists() {
        return Ok(0);
    }
    let mut deleted = 0u32;
    for entry in std::fs::read_dir(dir).map_err(|e| format!("Failed to read dir: {e}"))? {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        if entry.path().extension().map_or(false, |ext| ext == "png") {
            if std::fs::remove_file(entry.path()).is_ok() {
                deleted += 1;
            }
        }
    }
    Ok(deleted)
}
