---
status: investigating
trigger: "Audio Export Infinite Hang - export hangs infinitely with Include Audio checked"
created: 2026-03-23T00:00:00Z
updated: 2026-03-23T00:15:00Z
---

## Current Focus

hypothesis: CONFIRMED - `export_encode_video` is a synchronous Tauri #[command] (pub fn, not pub async fn). Per Tauri v2 docs, sync commands run on the MAIN THREAD. `Command::new().output()` blocks until FFmpeg finishes, blocking the main thread. This freezes the entire app -- UI, IPC, WebView. The app appears to hang infinitely because no IPC messages can be processed while the main thread is blocked.
test: Verified via Tauri v2 official docs: "Commands without the async keyword are executed on the main thread"
expecting: Making the command async would fix the hang
next_action: Return root cause diagnosis

## Symptoms

expected: Export completes and produces a video file with mixed audio
actual: Export hangs infinitely. No video produced. User had to force quit.
errors: No error messages (hang, not crash)
reproduction: Export video (H.264 or ProRes) with Include Audio checked and audio tracks loaded
started: Since audio export feature was added

## Eliminated

- hypothesis: FFmpeg argument ordering causes hang (audio -i after codec args)
  evidence: FFmpeg accepts input declarations in flexible order; -map references are correct
  timestamp: 2026-03-23T00:06:00Z

- hypothesis: FFmpeg hangs reading from inherited stdin pipe
  evidence: Rust Command::new().output() defaults stdin to piped/null (immediately closes on read), per official Rust docs
  timestamp: 2026-03-23T00:14:00Z

- hypothesis: OfflineAudioContext.startRendering() never resolves with no sources
  evidence: Web Audio spec says it renders silence and resolves; even if it did hang, the try/catch at exportEngine.ts:198 would set audioWavPath=null and continue
  timestamp: 2026-03-23T00:05:00Z

- hypothesis: Missing -shortest flag causes infinite encoding
  evidence: Audio is only 0.5s longer than video (padding in audioExportMixer.ts:87); FFmpeg encodes to the longer input length then stops -- not infinite
  timestamp: 2026-03-23T00:09:00Z

## Evidence

- timestamp: 2026-03-23T00:01:00Z
  checked: export_encode_video Rust command signature (export.rs line 74)
  found: `pub fn export_encode_video` -- synchronous, NOT async. Calls ffmpeg::encode_video() which calls `Command::new().output()` -- a blocking system call that waits for FFmpeg to exit.
  implication: This command blocks its thread until FFmpeg finishes encoding the entire video.

- timestamp: 2026-03-23T00:02:00Z
  checked: Tauri v2 official documentation on command threading
  found: Per https://v2.tauri.app/develop/calling-rust/ -- "Commands without the async keyword are executed on the main thread unless defined with #[tauri::command(async)]". The `export_encode_video` command is NOT async.
  implication: FFmpeg encoding runs on the MAIN THREAD, blocking UI, IPC, and all other processing.

- timestamp: 2026-03-23T00:03:00Z
  checked: Comparison with other export commands (export.rs)
  found: `export_download_ffmpeg` is correctly `pub async fn` (line 67) because downloading is long-running. But `export_encode_video` (line 74) is `pub fn` despite being equally (or more) long-running. All other sync commands (create_dir, write_png, check_ffmpeg, cleanup_pngs) are quick filesystem ops that complete in milliseconds.
  implication: The async/sync choice was inconsistent -- download_ffmpeg was made async but encode_video was not.

- timestamp: 2026-03-23T00:04:00Z
  checked: Why the hang appears "infinite" specifically with audio
  found: Without audio, FFmpeg encodes PNG-to-video which may complete in seconds (fast enough that the frozen UI appears as brief lag). With audio muxing, FFmpeg has two inputs to process and may take significantly longer. The audio pre-render step (OfflineAudioContext + writeFile) also adds time before the blocking FFmpeg call.
  implication: Audio makes the blocking duration longer, crossing the threshold from "noticeable lag" to "apparent infinite hang".

- timestamp: 2026-03-23T00:05:00Z
  checked: FFmpeg command construction in ffmpeg.rs encode_video (lines 170-213)
  found: Audio -i input is placed after codec-specific args. While FFmpeg is flexible about arg ordering, best practice is to declare all inputs before output options. The -map flags correctly reference stream indices (0:v:0, 1:a:0).
  implication: Secondary issue (fragile ordering) but not the hang cause.

## Resolution

root_cause: `export_encode_video` in export.rs:74 is a synchronous `pub fn` Tauri command. Per Tauri v2, synchronous commands execute on the main thread. The function calls `ffmpeg::encode_video()` which calls `std::process::Command::new().output()` -- a blocking call that waits for FFmpeg to finish encoding. This blocks the main thread for the entire duration of FFmpeg encoding (seconds to minutes). While the main thread is blocked: the WebView cannot process IPC messages, the UI cannot update, and the frontend `await invoke()` never receives a response. The app appears to hang infinitely.
fix: Change `export_encode_video` from `pub fn` to `pub async fn` with a `tokio::task::spawn_blocking()` wrapper around the FFmpeg Command execution. This moves the blocking FFmpeg call off the main thread.
verification: pending
files_changed: []
