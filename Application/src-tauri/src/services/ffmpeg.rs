use std::io::Read as IoRead;
use std::path::PathBuf;
use std::process::Command;

/// FFmpeg binary download URL.
/// Using martin-riedl.de latest macOS arm64 snapshot (signed + notarized).
/// Includes libx264, libsvtav1, and prores_ks codecs.
/// Returns a .zip containing the ffmpeg binary.
const FFMPEG_DOWNLOAD_URL: &str =
    "https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/snapshot/ffmpeg.zip";
const FFMPEG_FILENAME: &str = "ffmpeg";

/// Get the path where FFmpeg binary should be cached.
/// Uses ~/.config/efx-motion/bin/ for consistency with config_path pattern.
fn ffmpeg_cache_dir() -> PathBuf {
    PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| "/tmp".into()))
        .join(".config/efx-motion/bin")
}

/// Get the full path to the cached FFmpeg binary.
pub fn ffmpeg_path() -> PathBuf {
    ffmpeg_cache_dir().join(FFMPEG_FILENAME)
}

/// Check if FFmpeg is available and executable.
/// Returns the version string if found, None otherwise.
pub fn check_ffmpeg() -> Option<String> {
    let path = ffmpeg_path();
    if !path.exists() {
        return None;
    }

    let output = Command::new(&path)
        .arg("-version")
        .output()
        .ok()?;

    if output.status.success() {
        let version = String::from_utf8_lossy(&output.stdout);
        let first_line = version.lines().next().unwrap_or("unknown");
        Some(first_line.to_string())
    } else {
        None
    }
}

/// Download FFmpeg binary to the cache directory.
/// Sets execute permission and removes macOS quarantine attribute.
pub async fn download_ffmpeg() -> Result<String, String> {
    let cache_dir = ffmpeg_cache_dir();
    std::fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("Failed to create FFmpeg cache dir: {e}"))?;

    let target_path = ffmpeg_path();
    let zip_path = target_path.with_extension("zip");

    // Download via reqwest
    let response = reqwest::get(FFMPEG_DOWNLOAD_URL)
        .await
        .map_err(|e| format!("Failed to download FFmpeg: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "FFmpeg download failed with status: {}",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read FFmpeg download: {e}"))?;

    // Write zip to disk
    tokio::fs::write(&zip_path, &bytes)
        .await
        .map_err(|e| format!("Failed to write FFmpeg zip: {e}"))?;

    // Extract ffmpeg binary from zip
    let zip_file = std::fs::File::open(&zip_path)
        .map_err(|e| format!("Failed to open FFmpeg zip: {e}"))?;
    let mut archive =
        zip::ZipArchive::new(zip_file).map_err(|e| format!("Failed to read FFmpeg zip: {e}"))?;

    let mut found = false;
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read zip entry: {e}"))?;
        let name = file.name().to_string();
        if name == FFMPEG_FILENAME || name.ends_with("/ffmpeg") {
            let mut buf = Vec::new();
            file.read_to_end(&mut buf)
                .map_err(|e| format!("Failed to extract FFmpeg: {e}"))?;
            std::fs::write(&target_path, &buf)
                .map_err(|e| format!("Failed to write FFmpeg binary: {e}"))?;
            found = true;
            break;
        }
    }

    if !found {
        let _ = std::fs::remove_file(&zip_path);
        return Err("FFmpeg binary not found inside downloaded zip".to_string());
    }

    // Clean up zip
    let _ = std::fs::remove_file(&zip_path);

    // Set execute permission (Research Pitfall 5)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o755);
        std::fs::set_permissions(&target_path, perms)
            .map_err(|e| format!("Failed to set FFmpeg permissions: {e}"))?;
    }

    // Remove macOS quarantine attribute (Research Pitfall 5)
    let _ = Command::new("xattr")
        .args(["-d", "com.apple.quarantine"])
        .arg(&target_path)
        .output();

    // Verify it works
    let version =
        check_ffmpeg().ok_or_else(|| "FFmpeg downloaded but not executable".to_string())?;

    Ok(version)
}

/// ProRes profile number mapping.
fn prores_profile_num(profile: &str) -> &str {
    match profile {
        "proxy" => "0",
        "lt" => "1",
        "standard" => "2",
        "hq" => "3",
        _ => "3",
    }
}

/// Quality settings passed from frontend via IPC.
#[derive(Debug, serde::Deserialize)]
pub struct VideoQualityArgs {
    pub h264_crf: u32,
    pub av1_crf: u32,
    pub prores_profile: String,
}

/// Encode a video from a PNG image sequence using FFmpeg.
/// Per D-03: ProRes (prores_ks), H.264 (libx264), AV1 (libsvtav1)
/// Per D-13: Sensible defaults per codec
/// Audio muxing: if audio_path is Some, muxes pre-rendered WAV into output.
/// ProRes uses pcm_s16le; H.264/AV1 use AAC at 192k.
pub fn encode_video(
    png_dir: &str,
    glob_pattern: &str,
    output_path: &str,
    codec: &str,
    fps: u32,
    quality_args: &VideoQualityArgs,
    audio_path: Option<&str>,
) -> Result<(), String> {
    let ffmpeg = ffmpeg_path();
    if !ffmpeg.exists() {
        return Err("FFmpeg binary not found. Download it first.".to_string());
    }

    let input_pattern = format!("{}/{}", png_dir, glob_pattern);

    let mut cmd = Command::new(&ffmpeg);
    cmd.args(["-y", "-framerate", &fps.to_string()]);
    cmd.args(["-i", &input_pattern]);

    // Codec-specific arguments per D-03, D-13
    match codec {
        "prores" => {
            cmd.args(["-c:v", "prores_ks"]);
            cmd.args(["-profile:v", prores_profile_num(&quality_args.prores_profile)]);
            cmd.args(["-pix_fmt", "yuva444p10le"]); // RGBA ProRes
        }
        "h264" => {
            cmd.args(["-c:v", "libx264"]);
            cmd.args(["-crf", &quality_args.h264_crf.to_string()]);
            cmd.args(["-preset", "medium"]);
            cmd.args(["-pix_fmt", "yuv420p"]);
        }
        "av1" => {
            cmd.args(["-c:v", "libsvtav1"]);
            cmd.args(["-crf", &quality_args.av1_crf.to_string()]);
            cmd.args(["-pix_fmt", "yuv420p"]);
        }
        _ => return Err(format!("Unknown codec: {codec}")),
    }

    // Audio muxing (per D-01, replaces D-15's -an when audio is provided)
    if let Some(audio) = audio_path {
        cmd.args(["-i", audio]);
        cmd.args(["-map", "0:v:0", "-map", "1:a:0"]);
        // Pitfall 3: codec depends on container
        match codec {
            "prores" => {
                cmd.args(["-c:a", "pcm_s16le"]);
            }
            _ => {
                cmd.args(["-c:a", "aac", "-b:a", "192k"]);
            }
        };
    } else {
        cmd.arg("-an");
    }
    cmd.arg(output_path);

    let output = cmd
        .output()
        .map_err(|e| format!("FFmpeg failed to start: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg encoding failed: {stderr}"));
    }

    Ok(())
}
