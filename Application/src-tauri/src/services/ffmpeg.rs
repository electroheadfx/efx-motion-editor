use std::path::PathBuf;
use std::process::Command;

/// FFmpeg binary download URL.
/// Using martin-riedl.de macOS arm64 snapshot which includes
/// libx264, libsvtav1, and prores_ks codecs.
const FFMPEG_DOWNLOAD_URL: &str = "https://martin-riedl.de/media/ffmpeg/ffmpeg-7.1-macOS-arm64";
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
    let tmp_path = target_path.with_extension("tmp");

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

    // Write to temp file, then rename (atomic)
    tokio::fs::write(&tmp_path, &bytes)
        .await
        .map_err(|e| format!("Failed to write FFmpeg binary: {e}"))?;

    tokio::fs::rename(&tmp_path, &target_path)
        .await
        .map_err(|e| format!("Failed to rename FFmpeg binary: {e}"))?;

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
/// Per D-15: No audio track (-an flag)
pub fn encode_video(
    png_dir: &str,
    glob_pattern: &str,
    output_path: &str,
    codec: &str,
    fps: u32,
    quality_args: &VideoQualityArgs,
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

    // No audio (D-15)
    cmd.arg("-an");
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
