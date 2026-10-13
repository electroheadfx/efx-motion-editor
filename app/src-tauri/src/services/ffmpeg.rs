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

/// Build the full FFmpeg argv (everything after the binary) for `encode_video`.
/// Pure: no process spawn, no filesystem. Single source of output options so a
/// second call site cannot drift (261013-ctd).
/// Per D-03: ProRes (prores_ks), H.264 (libx264), AV1 (libsvtav1)
/// Per D-13: Sensible defaults per codec
/// Audio muxing: if audio_path is Some, muxes pre-rendered WAV into output.
/// ProRes uses pcm_s16le; H.264/AV1 use AAC at 192k.
pub(crate) fn encode_video_args(
    png_dir: &str,
    glob_pattern: &str,
    output_path: &str,
    codec: &str,
    fps: u32,
    quality_args: &VideoQualityArgs,
    audio_path: Option<&str>,
) -> Result<Vec<String>, String> {
    let input_pattern = format!("{}/{}", png_dir, glob_pattern);

    let mut args: Vec<String> = Vec::new();
    args.push("-y".to_string());
    args.push("-framerate".to_string());
    args.push(fps.to_string());
    args.push("-i".to_string());
    args.push(input_pattern);

    // Add audio input BEFORE any output options (FFmpeg requires all inputs first)
    if let Some(audio) = audio_path {
        args.push("-i".to_string());
        args.push(audio.to_string());
    }

    // Codec-specific video arguments per D-03, D-13
    match codec {
        "prores" => {
            args.push("-c:v".to_string());
            args.push("prores_ks".to_string());
            args.push("-profile:v".to_string());
            args.push(prores_profile_num(&quality_args.prores_profile).to_string());
            args.push("-pix_fmt".to_string());
            args.push("yuva444p10le".to_string()); // RGBA ProRes
        }
        "h264" => {
            args.push("-c:v".to_string());
            args.push("libx264".to_string());
            args.push("-crf".to_string());
            args.push(quality_args.h264_crf.to_string());
            args.push("-preset".to_string());
            args.push("medium".to_string());
            args.push("-pix_fmt".to_string());
            args.push("yuv420p".to_string());
        }
        "av1" => {
            args.push("-c:v".to_string());
            args.push("libsvtav1".to_string());
            args.push("-crf".to_string());
            args.push(quality_args.av1_crf.to_string());
            args.push("-pix_fmt".to_string());
            args.push("yuv420p".to_string());
        }
        _ => return Err(format!("Unknown codec: {codec}")),
    }

    // Audio muxing (per D-01, replaces D-15's -an when audio is provided)
    if audio_path.is_some() {
        args.push("-map".to_string());
        args.push("0:v:0".to_string());
        args.push("-map".to_string());
        args.push("1:a:0".to_string());
        // Pitfall 3: audio codec depends on container
        match codec {
            "prores" => {
                args.push("-c:a".to_string());
                args.push("pcm_s16le".to_string());
            }
            _ => {
                args.push("-c:a".to_string());
                args.push("aac".to_string());
                args.push("-b:a".to_string());
                args.push("192k".to_string());
            }
        };
    } else {
        args.push("-an".to_string());
    }
    args.push(output_path.to_string());
    Ok(args)
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

    let args = encode_video_args(
        png_dir,
        glob_pattern,
        output_path,
        codec,
        fps,
        quality_args,
        audio_path,
    )?;

    let output = Command::new(&ffmpeg)
        .args(&args)
        .output()
        .map_err(|e| format!("FFmpeg failed to start: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg encoding failed: {stderr}"));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn quality() -> VideoQualityArgs {
        VideoQualityArgs {
            h264_crf: 23,
            av1_crf: 30,
            prores_profile: "hq".into(),
        }
    }

    /// Leg (a): audio Some + h264 — argv carries the mux-truncation output
    /// option and both map flags; audio codec arm is aac 192k.
    /// RED today: the extract still omits the mux-truncation option.
    #[test]
    fn encode_video_args_audio_h264_carries_shortest_and_maps() {
        let argv = encode_video_args(
            "/tmp/pngs",
            "frame-%04d.png",
            "/tmp/out.mp4",
            "h264",
            24,
            &quality(),
            Some("mix.wav"),
        )
        .expect("h264 audio argv builds");

        assert!(
            argv.contains(&"-map".to_string()),
            "audio arm must map both streams: {argv:?}"
        );
        assert!(argv.contains(&"0:v:0".to_string()), "missing video map: {argv:?}");
        assert!(argv.contains(&"1:a:0".to_string()), "missing audio map: {argv:?}");
        assert!(
            argv.contains(&"-shortest".to_string()),
            "mux-truncation output option missing — container will keep the longer stream (EXP-01): {argv:?}"
        );
        assert!(argv.contains(&"aac".to_string()), "missing aac: {argv:?}");
        assert!(argv.contains(&"192k".to_string()), "missing 192k: {argv:?}");
        assert_eq!(
            argv.last().map(String::as_str),
            Some("/tmp/out.mp4"),
            "output_path must be last: {argv:?}"
        );
    }

    /// Leg (b): audio Some + prores — same mux-truncation option; pcm_s16le.
    /// RED today: same omission.
    #[test]
    fn encode_video_args_audio_prores_carries_shortest_and_pcm() {
        let argv = encode_video_args(
            "/tmp/pngs",
            "frame-%04d.png",
            "/tmp/out.mov",
            "prores",
            24,
            &quality(),
            Some("mix.wav"),
        )
        .expect("prores audio argv builds");

        assert!(
            argv.contains(&"-shortest".to_string()),
            "mux-truncation output option missing (EXP-01): {argv:?}"
        );
        assert!(argv.contains(&"pcm_s16le".to_string()), "missing pcm_s16le: {argv:?}");
        assert!(argv.contains(&"yuva444p10le".to_string()), "missing yuva444p10le: {argv:?}");
    }

    /// Leg (c): audio None — argv keeps `-an`, has no audio map pair, and
    /// omits the mux-truncation option (video-only encode is unchanged).
    /// Green after extract (non-regression arm).
    #[test]
    fn encode_video_args_no_audio_keeps_an_and_omits_shortest() {
        let argv = encode_video_args(
            "/tmp/pngs",
            "frame-%04d.png",
            "/tmp/out.mp4",
            "h264",
            24,
            &quality(),
            None,
        )
        .expect("video-only argv builds");

        assert!(argv.contains(&"-an".to_string()), "video-only must keep -an: {argv:?}");
        assert!(
            !argv.contains(&"-map".to_string()),
            "video-only must not map an audio stream: {argv:?}"
        );
        assert!(
            !argv.contains(&"-shortest".to_string()),
            "video-only must not carry the mux-truncation option: {argv:?}"
        );
    }

    /// Leg (d): unknown codec still returns Err (fail-closed, existing law).
    #[test]
    fn encode_video_args_unknown_codec_errors() {
        let err = encode_video_args(
            "/tmp/pngs",
            "frame-%04d.png",
            "/tmp/out.gif",
            "gif",
            24,
            &quality(),
            None,
        )
        .expect_err("unknown codec must fail closed");
        assert!(
            err.contains("gif"),
            "error must name the codec: {err}"
        );
    }
}
