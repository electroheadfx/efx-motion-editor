# Phase 14: PNG & Video Export - Research

**Researched:** 2026-03-21
**Domain:** Canvas 2D export pipeline, FFmpeg binary management, Tauri IPC file I/O, FCPXML sidecar
**Confidence:** HIGH

## Summary

Phase 14 adds a complete export system: PNG image sequences (RGBA), video encoding via FFmpeg (ProRes/H.264/AV1), resolution multipliers, progress tracking, metadata sidecars, and an export dialog UI. The existing rendering pipeline (`PreviewRenderer`, `frameMap`, `transitionEngine`, `keyframeEngine`, all FX generators) is fully decoupled from the UI and can be reused at arbitrary resolutions on an offscreen canvas.

The core architecture splits into three tracks: (1) a frontend export renderer that iterates `frameMap` entries and composites each global frame to an offscreen canvas at the target resolution, extracting PNG blobs via `canvas.toBlob('image/png')`, (2) Rust backend IPC commands that handle file writes (PNG bytes to disk with atomic temp+rename), directory creation, FFmpeg binary management (check/download/spawn), and video encoding from the PNG sequence, and (3) an export dialog UI following the existing `SettingsView` full-window modal pattern via `editorMode` signal.

**Primary recommendation:** Extract the `renderFromFrameMap` compositing logic from `Preview.tsx` into a shared pure function (`exportRenderer.ts`) that both the preview and the export pipeline consume. The export loop runs in the frontend (it needs Canvas 2D + WebGL), yielding per-frame PNG blobs that are sent to Rust via IPC for disk writes. FFmpeg video encoding runs as a Rust `std::process::Command` child process after PNG sequence is complete (or piped incrementally).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Three output formats: PNG image sequence (RGBA), video (ProRes/H.264/AV1)
- **D-02:** PNG is always RGBA (transparent background) -- for intermediate compositing in DaVinci Resolve / FCP / Premiere
- **D-03:** Video codecs: FFmpeg ProRes (prores_ks), H.264 (libx264), AV1 (libsvtav1)
- **D-04:** All exports are "baked" -- transitions, FX, layers fully composited into output frames. No per-sequence splitting or transition markers in Phase 14.
- **D-05:** Available multipliers: 0.15x, 0.25x, 0.5x, 1x, 2x of project resolution
- **D-06:** Same multipliers for both PNG and video export
- **D-07:** Lower multipliers (0.15x, 0.25x) serve as fast preview; 1x/2x for final output
- **D-08:** Auto-download FFmpeg binary on first video export -- not bundled with app
- **D-09:** Cached in Tauri `app_data_dir()` -- downloaded once, persisted across sessions
- **D-10:** Custom FFmpeg build with only needed codecs (libx264, libsvtav1, prores_ks) to minimize size
- **D-11:** Rust Command pattern: check presence -> download if absent -> spawn process
- **D-12:** FFmpeg version updatable independently from efxlab releases
- **D-13:** Sensible defaults per codec (e.g., CRF 18 for H.264, CRF 23 for AV1, HQ for ProRes)
- **D-14:** Custom quality settings configurable in Settings page, persisted to `~/.config/efx-motion/builder-config.yaml`
- **D-15:** Video export has no audio track -- audio support deferred to v0.3.0 phase
- **D-16:** PNG naming: DaVinci Resolve convention `project_name_[####].png` (zero-padded frame number)
- **D-17:** PNG naming pattern customizable in Settings page (persisted to config)
- **D-18:** Export folder: timestamped subfolder `export_YYYY-MM-DD_HH-MM/` inside user-chosen directory
- **D-19:** Video naming: `ProjectName_ResolutionP_codec.ext`
- **D-20:** Re-export to same timestamped folder overwrites silently
- **D-21:** JSON sidecar always generated -- frame rate, resolution, frame count, duration, sequence mapping, transition frame ranges, export settings
- **D-22:** FCPXML sidecar generated for ProRes exports only -- simple reference (single clip at correct FPS/resolution)
- **D-23:** FCPXML with full timeline + transitions deferred to v0.3.0
- **D-24:** Trigger: toolbar Export button + File menu item with Cmd+Shift+E shortcut
- **D-25:** Export dialog is a full-window modal view (same pattern as Settings/Imported views)
- **D-26:** Dialog layout: left section = format selector with format-specific options; right section = preview thumbnail + output summary; bottom = folder picker + Export button
- **D-27:** Output folder: prompt on first use, persist to config, option to force re-ask
- **D-28:** Progress: modal progress bar blocking UI -- shows current frame / total frames, estimated time remaining, cancel button
- **D-29:** Error handling: keep partial output + show error with option to resume from last successfully rendered frame
- **D-30:** Completion: toast notification with "Open in Finder" link, auto-close export view back to editor
- **D-31:** macOS native system notification if app is in background when export completes

### Claude's Discretion
- FFmpeg download source (CDN, GitHub Releases, custom hosting)
- Exact CRF/quality defaults per codec
- Progress estimation algorithm (frame time averaging)
- FCPXML schema version and structure details
- JSON sidecar schema design
- Canvas rendering strategy for export (offscreen canvas reuse, memory management)
- How resume-from-frame works internally (frame index tracking, partial folder detection)

### Deferred Ideas (OUT OF SCOPE)
- NLE-ready export (Option B) -- Per-sequence PNG sub-sequences + FCPXML with full timeline structure -> v0.3.0
- Audio muxing in video export -- Add audio track to video files when audio import lands -> v0.3.0
- FCPXML with transitions for H.264/AV1 -- Currently FCPXML only for ProRes; extend to all codecs later
- Batch export presets -- Save named export configurations for one-click re-export
- Export queue -- Queue multiple exports with different settings
- Background export -- Non-blocking export that allows continued editing
</user_constraints>

<phase_requirements>
## Phase Requirements

The EXPORT-01 through EXPORT-06 requirement IDs are referenced but not individually defined in the requirements doc. Based on the roadmap success criteria and CONTEXT.md decisions, the requirements map as follows:

| ID | Description | Research Support |
|----|-------------|------------------|
| EXPORT-01 | User can export the full composited timeline as a PNG image sequence to a chosen directory, with all visible layers and FX baked at the target resolution | Extract `renderFromFrameMap` to shared function; offscreen canvas at target resolution; `canvas.toBlob('image/png')` per frame; Rust IPC writes bytes to disk |
| EXPORT-02 | User can select export resolution via multipliers (0.15x, 0.25x, 0.5x, 1x, 2x) and exported files follow the DaVinci naming pattern `project_name_[####].png` | Offscreen canvas sized to `projectWidth * multiplier` x `projectHeight * multiplier`; zero-padded frame number formatting |
| EXPORT-03 | Export shows a progress indicator (frame X of N) with a working cancel button that remains responsive throughout the export | Use `requestAnimationFrame` or `setTimeout(0)` yielding between frames to keep UI responsive; signal-based progress state; AbortController / cancelled flag |
| EXPORT-04 | Export writes a JSON metadata sidecar alongside the PNG sequence for downstream editor handoff | JSON schema with fps, resolution, frame count, duration, sequence boundaries, transitions, export settings |
| EXPORT-05 | User can export video (ProRes/H.264/AV1) from the PNG sequence via auto-provisioned FFmpeg | Rust `std::process::Command` spawns FFmpeg with PNG glob input; auto-download binary to `app_data_dir()`; codec-specific flags |
| EXPORT-06 | Export dialog provides format selection, resolution options, preview thumbnail, folder picker, and keyboard shortcut (Cmd+Shift+E) | Full-window modal view via `editorMode` signal; Tauri `open({ directory: true })` for folder picker; native menu item |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Canvas 2D API | Web standard | Frame rendering at export resolution | Already used by PreviewRenderer; supports `toBlob('image/png')` for RGBA PNG extraction |
| @tauri-apps/plugin-dialog | ^2.6.0 | Folder picker dialog | Already installed; `open({ directory: true })` for export folder selection |
| @tauri-apps/plugin-shell | 2.x (Rust) | FFmpeg process spawning | Already installed; Rust-side `ShellExt` for `std::process::Command` equivalent |
| @preact/signals | ^2.8.1 | Export state management (progress, cancel, settings) | Already the project's reactivity system |
| serde_json | 1.x (Rust) | JSON sidecar serialization | Already a dependency in Cargo.toml |
| serde_yaml | 0.9 (Rust) | Config persistence (export settings) | Already used for `builder-config.yaml` |

### New Dependencies
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tauri-apps/plugin-notification | ^2.x | macOS native notification when export completes in background (D-31) | Add to both Cargo.toml and package.json |
| reqwest (Rust) | 0.12.x | HTTP client for FFmpeg binary download (D-08) | Add to Cargo.toml for the FFmpeg download command |
| tauri-plugin-opener (or shell `open`) | 2.x | "Open in Finder" after export (D-30) | Use existing shell plugin's `open` or Tauri's `opener` plugin |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `canvas.toBlob` callback | `OffscreenCanvas.convertToBlob()` (Promise-based) | OffscreenCanvas is cleaner async API but not available in all WebView versions; `toBlob` with Promise wrapper is universally safe in Tauri's WKWebView |
| Rust `reqwest` for download | `tauri-plugin-http` | Both work; `reqwest` is more Rust-idiomatic and avoids another plugin dependency |
| `std::process::Command` for FFmpeg | Shell plugin JS API | Rust-side process spawning is simpler (no scope configuration needed for IPC commands), provides direct stdout/stderr access for progress parsing |

**Installation:**
```bash
# Frontend
cd Application && pnpm add @tauri-apps/plugin-notification

# Backend (in src-tauri/)
cargo add tauri-plugin-notification reqwest --features reqwest/rustls-tls
```

## Architecture Patterns

### Recommended Project Structure
```
Application/src/
  lib/
    exportRenderer.ts      # Shared frame compositing (extracted from Preview.tsx)
    exportEngine.ts        # Export loop: iterate frames, render, extract PNG, send to Rust
    exportSidecar.ts       # JSON/FCPXML sidecar generation
  stores/
    exportStore.ts         # Export state: format, resolution, progress, settings
  components/
    views/
      ExportView.tsx       # Full-window export dialog UI
    export/
      FormatSelector.tsx   # Left panel: format + codec options
      ExportPreview.tsx    # Right panel: sample frame thumbnail + summary
      ExportProgress.tsx   # Progress modal overlay
Application/src-tauri/src/
  commands/
    export.rs              # IPC commands: write_png, create_export_dir, check_ffmpeg, download_ffmpeg, encode_video
  services/
    export_io.rs           # File write, directory creation, FFmpeg management
    ffmpeg.rs              # FFmpeg binary detection, download, version check
```

### Pattern 1: Export Rendering via Offscreen Canvas
**What:** Create a dedicated offscreen `HTMLCanvasElement` at the target export resolution (not attached to DOM), reuse `PreviewRenderer` to draw each frame, then extract PNG blob.
**When to use:** For every export frame.
**Why:** The `PreviewRenderer` is already resolution-independent -- it takes a canvas and renders layers at that canvas's dimensions. For export, we just give it a bigger (or smaller) canvas.
**Example:**
```typescript
// Source: Derived from existing PreviewRenderer pattern
function createExportCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function renderExportFrame(
  renderer: PreviewRenderer,
  globalFrame: number,
  fm: FrameEntry[],
  allSeqs: Sequence[],
): Promise<void> {
  // Same logic as Preview.tsx renderFromFrameMap, but on the export canvas
  // ...compositing content + overlays + FX...
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('toBlob returned null')),
      'image/png',
    );
  });
}
```

### Pattern 2: Yielding Export Loop (Responsive Cancel)
**What:** The export loop processes one frame per event loop tick via `setTimeout(0)` or `requestAnimationFrame`, checking a cancel signal between frames.
**When to use:** For all frame-by-frame export.
**Why:** A tight synchronous loop freezes the UI -- the progress bar wouldn't update and the cancel button wouldn't be clickable. Yielding to the event loop after each frame keeps the UI responsive (D-28).
**Example:**
```typescript
// Source: Standard browser pattern for non-blocking batch processing
async function exportLoop(
  totalFrames: number,
  renderFrame: (frame: number) => Promise<void>,
  onProgress: (frame: number) => void,
  shouldCancel: () => boolean,
): Promise<{ completed: boolean; lastFrame: number }> {
  let frame = 0;
  while (frame < totalFrames) {
    if (shouldCancel()) {
      return { completed: false, lastFrame: frame };
    }
    await renderFrame(frame);
    onProgress(frame);
    frame++;
    // Yield to event loop for UI responsiveness
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return { completed: true, lastFrame: frame };
}
```

### Pattern 3: Rust IPC for File Writes
**What:** Frontend sends PNG blob (as `Uint8Array`) to Rust via Tauri IPC; Rust writes to disk with atomic temp+rename.
**When to use:** Every frame write.
**Why:** Writing files from the Tauri webview requires going through the Rust backend. The existing `project_io.rs` already uses atomic writes. Sending bytes via IPC is efficient (Tauri 2 uses zero-copy for large payloads).
**Example:**
```rust
// Source: Extends existing project_io.rs atomic write pattern
#[command]
pub fn export_write_png(
    dir_path: String,
    filename: String,
    data: Vec<u8>,
) -> Result<(), String> {
    let path = std::path::Path::new(&dir_path).join(&filename);
    let tmp_path = path.with_extension("png.tmp");
    std::fs::write(&tmp_path, &data)
        .map_err(|e| format!("Failed to write PNG: {e}"))?;
    std::fs::rename(&tmp_path, &path)
        .map_err(|e| format!("Failed to rename PNG: {e}"))?;
    Ok(())
}
```

### Pattern 4: FFmpeg Process Spawning from Rust
**What:** Rust IPC command spawns FFmpeg as a child process, feeding it the PNG sequence glob and codec flags. Reads stdout/stderr for progress.
**When to use:** Video export step (after PNG sequence is written).
**Why:** Rust's `std::process::Command` gives full control over the child process lifecycle without needing shell plugin scope configuration. FFmpeg reads the PNG sequence from disk (no piping needed).
**Example:**
```rust
// Source: Standard Rust pattern, inspired by yt-dlp/LosslessCut auto-provisioning
use std::process::Command;

pub fn encode_video(
    ffmpeg_path: &str,
    png_dir: &str,
    pattern: &str,  // e.g., "project_name_%04d.png"
    output_path: &str,
    codec: &str,     // "libx264", "libsvtav1", "prores_ks"
    fps: u32,
    quality_args: &[String],
) -> Result<(), String> {
    let mut cmd = Command::new(ffmpeg_path);
    cmd.args(["-y", "-framerate", &fps.to_string()])
       .args(["-i", &format!("{}/{}", png_dir, pattern)])
       .args(["-c:v", codec])
       .args(quality_args)
       .args(["-pix_fmt", if codec == "prores_ks" { "yuva444p10le" } else { "yuv420p" }])
       .arg(output_path);

    let output = cmd.output().map_err(|e| format!("FFmpeg failed to start: {e}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(())
}
```

### Pattern 5: EditorMode Extension for Export View
**What:** Add `'export'` to the `EditorMode` type union; ExportView renders when `editorMode === 'export'`.
**When to use:** Triggering the export dialog.
**Why:** Follows the exact same pattern as `SettingsView` and `ImportedView` -- full-window modal views controlled by `editorMode` signal.
**Example:**
```typescript
// Source: Existing pattern in uiStore.ts
export type EditorMode = 'editor' | 'imported' | 'settings' | 'export';
```

### Anti-Patterns to Avoid
- **Rendering in Rust:** Do NOT try to replicate the Canvas 2D rendering pipeline in Rust. The entire compositing engine (blend modes, FX generators, WebGL blur, transitions, keyframe interpolation) lives in TypeScript/Canvas. Re-implementing it in Rust would be massive effort and diverge from the preview.
- **DPR scaling in export:** The export canvas should NOT apply `window.devicePixelRatio` scaling. Export renders at exact pixel dimensions (e.g., 1920x1080 = 1920x1080 pixels). DPR is a display concern, not an export concern.
- **Synchronous export loop:** Do NOT use a tight `for` loop for all frames without yielding. The UI will freeze, the progress bar won't update, and the cancel button won't work.
- **Piping raw image data to FFmpeg stdin:** While possible, it's simpler and more debuggable to write PNGs to disk first, then have FFmpeg read them. This also enables resume-from-frame (D-29) since partial output persists.
- **Bundling FFmpeg with the app:** Per D-08, FFmpeg is auto-downloaded, not bundled. This avoids bloating the app binary and allows independent version updates (D-12).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PNG encoding | Custom PNG encoder | `canvas.toBlob('image/png')` | Browser's native PNG encoder handles RGBA, compression, and is heavily optimized |
| Video encoding | Custom video encoder | FFmpeg (external binary) | ProRes/H.264/AV1 encoders are enormously complex; FFmpeg is the industry standard |
| HTTP file download | Manual fetch + stream handling | `reqwest` (Rust crate) | Handles redirects, TLS, chunked responses, progress callbacks out of the box |
| FCPXML generation | Manual XML string building | Template literal with DTD reference | FCPXML for a single clip reference is simple enough for a template; a full XML library is overkill |
| Directory picker dialog | Custom file browser | `@tauri-apps/plugin-dialog` `open({ directory: true })` | Native OS dialog, already installed |
| System notifications | Custom notification system | `@tauri-apps/plugin-notification` | Native macOS notification center integration |
| Frame naming with zero-padding | Custom padding logic | `String(n).padStart(digits, '0')` | Standard JavaScript, no library needed |

**Key insight:** The export pipeline's unique value is orchestration -- connecting the existing Canvas rendering engine to file output. Every individual component (PNG encoding, video encoding, file I/O, dialogs, notifications) should use existing solutions.

## Common Pitfalls

### Pitfall 1: Export Canvas Size vs. Preview Canvas Size
**What goes wrong:** Export renders at the wrong resolution because the code reads `canvas.clientWidth` (CSS layout size) or applies DPR scaling.
**Why it happens:** `PreviewRenderer.renderFrame()` currently syncs canvas internal resolution to layout size with DPR. For export, we want exact pixel dimensions.
**How to avoid:** Create a separate `PreviewRenderer` instance for the export canvas. Set `canvas.width` and `canvas.height` directly to the target export resolution. Modify `renderFrame()` to accept an optional parameter that skips the DPR-based size sync, OR set the offscreen canvas dimensions before calling `renderFrame()` and ensure it doesn't resize.
**Warning signs:** Exported images are 2x the expected resolution (DPR=2 on Retina), or weirdly sized.

### Pitfall 2: Image Loading Race Condition During Export
**What goes wrong:** The export renderer calls `renderFrame()` but some images haven't loaded yet, producing blank or partially rendered frames.
**Why it happens:** `PreviewRenderer.getImageSource()` loads images asynchronously and returns `null` until loaded. During preview, the `onImageLoaded` callback triggers a re-render. During export, we can't just re-render on callback -- we need ALL images loaded before starting.
**How to avoid:** Before the export loop begins, preload ALL images referenced in `frameMap` and wait for them to complete. Create a `preloadAllImages(imageIds: string[]): Promise<void>` that resolves when every image is cached.
**Warning signs:** Exported PNG frames are blank or missing content layers.

### Pitfall 3: WebGL Context Loss During Long Export
**What goes wrong:** The GPU blur (`glBlur.ts`) loses its WebGL2 context during a long export (hundreds of frames), causing blur to silently fail.
**Why it happens:** Browsers may reclaim WebGL contexts under memory pressure. The export canvas is separate from the preview canvas, so it may not have an initialized WebGL context.
**How to avoid:** The `applyBlur` function already falls back to CPU StackBlur when GPU is unavailable. Ensure the export path can handle this fallback gracefully. Consider whether to attempt GPU blur for export at all (CPU blur is deterministic and avoids context issues).
**Warning signs:** Some exported frames have blur applied, others don't.

### Pitfall 4: Memory Pressure from Large PNG Blobs
**What goes wrong:** Exporting many frames at high resolution (4K = 3840x2160 = ~33MB per uncompressed RGBA frame) causes memory pressure. Keeping blobs in memory before writing to disk can exhaust available RAM.
**Why it happens:** Each `canvas.toBlob()` creates a Blob that stays in memory until garbage collected.
**How to avoid:** Write each frame to disk immediately after `toBlob()` completes (pipeline: render -> toBlob -> IPC write -> next frame). Never accumulate multiple frame blobs in memory. The yielding export loop (Pattern 2) naturally handles this since each frame completes before the next starts.
**Warning signs:** App becomes unresponsive or crashes during export at high resolutions.

### Pitfall 5: FFmpeg Binary Permissions on macOS
**What goes wrong:** Downloaded FFmpeg binary cannot be executed because macOS quarantine attribute blocks it, or the file doesn't have execute permission.
**Why it happens:** macOS applies quarantine attributes to downloaded files. Files written by `std::fs::write` don't have execute permission by default.
**How to avoid:** After downloading, set execute permission (`chmod +x`) via `std::fs::set_permissions` in Rust. Also remove the quarantine attribute with `xattr -d com.apple.quarantine` via `std::process::Command`.
**Warning signs:** FFmpeg spawn fails with "Permission denied" or macOS shows "cannot be opened because the developer cannot be verified" dialog.

### Pitfall 6: Cross-Dissolve Rendering During Export
**What goes wrong:** Export produces incorrect frames during cross-dissolve overlap zones because the export loop doesn't handle dual-sequence rendering.
**Why it happens:** Cross dissolve requires rendering TWO sequences simultaneously with interpolated opacities (see `Preview.tsx` lines 99-150). A naive frame-by-frame renderer that only looks up `frameMap[globalFrame]` misses the dual-render requirement.
**How to avoid:** Extract the complete `renderFromFrameMap` logic from `Preview.tsx` into a shared function that handles: normal content rendering, cross dissolve dual-render, FX overlays, content-overlay sequences, fade transitions, and solid-mode fades. Both Preview and export must call the same function.
**Warning signs:** Cross dissolve transitions appear as hard cuts in exported sequence.

### Pitfall 7: Video Generator Layers in Export
**What goes wrong:** Video layers (`source.type === 'video'`) don't render in export because they depend on `HTMLVideoElement` seeking, which is asynchronous.
**Why it happens:** The `resolveVideoSource()` method seeks the video to the target time and returns null until `readyState >= 2`. In the export loop, we need to wait for the seek to complete before rendering.
**How to avoid:** For each frame that involves a video layer, seek the video element and wait for the `seeked` event before rendering. Add a `seekAndWait(video: HTMLVideoElement, time: number): Promise<void>` helper.
**Warning signs:** Frames with video layers are blank or show the wrong video frame.

## Code Examples

Verified patterns from the existing codebase:

### Extracting renderFromFrameMap to a Shared Function
```typescript
// Source: Refactored from Application/src/components/Preview.tsx renderFromFrameMap()
// This becomes Application/src/lib/exportRenderer.ts

import { PreviewRenderer } from './previewRenderer';
import { frameMap, crossDissolveOverlaps } from './frameMap';
import { interpolateAt } from './keyframeEngine';
import { computeFadeOpacity, computeSolidFadeAlpha, computeCrossDissolveOpacity } from './transitionEngine';
import type { FrameEntry } from '../types/timeline';
import type { Sequence } from '../types/sequence';

/**
 * Render a single global frame with full compositing (content + cross dissolve + FX + overlays).
 * Pure function: caller passes all data, no signal reads.
 * Used by both Preview.tsx (live preview) and exportEngine.ts (file export).
 */
export function renderGlobalFrame(
  renderer: PreviewRenderer,
  canvas: HTMLCanvasElement,
  globalFrame: number,
  fm: FrameEntry[],
  allSeqs: Sequence[],
  overlaps: CrossDissolveOverlap[],
): void {
  // ... full compositing logic extracted from Preview.tsx ...
  // Handles: normal render, cross dissolve dual-render, fade opacity,
  // solid fade overlay, FX sequences, content-overlay sequences
}
```

### Tauri Dialog for Folder Selection
```typescript
// Source: Existing pattern in Application/src/lib/shortcuts.ts
import { open } from '@tauri-apps/plugin-dialog';

async function pickExportFolder(): Promise<string | null> {
  const selected = await open({
    directory: true,
    title: 'Choose Export Folder',
  });
  return selected as string | null;
}
```

### Sending PNG Bytes to Rust via IPC
```typescript
// Source: Extends existing safeInvoke pattern in Application/src/lib/ipc.ts
export async function exportWritePng(
  dirPath: string,
  filename: string,
  data: Uint8Array,
): Promise<Result<null>> {
  return safeInvoke<null>('export_write_png', {
    dirPath,
    filename,
    data: Array.from(data), // Tauri 2 serializes Uint8Array as number[]
  });
}
```

### Config Persistence for Export Settings
```rust
// Source: Extends existing Application/src-tauri/src/commands/config.rs pattern
#[derive(Debug, Serialize, Deserialize, Default)]
struct BuilderConfig {
    // ... existing fields ...
    #[serde(default)]
    export_folder: Option<String>,
    #[serde(default)]
    export_naming_pattern: Option<String>,
    #[serde(default)]
    video_quality: Option<HashMap<String, serde_json::Value>>, // per-codec settings
}
```

### EditorMode Extension
```typescript
// Source: Application/src/stores/uiStore.ts (existing pattern)
export type EditorMode = 'editor' | 'imported' | 'settings' | 'export';
// ExportView renders when editorMode.value === 'export'
```

### Native Menu Item for Export
```rust
// Source: Extends Application/src-tauri/src/lib.rs menu setup pattern
let export_item = MenuItem::with_id(
    app, "export", "Export...", true, Some("CmdOrCtrl+Shift+E")
)?;
// Add to file_submenu before close_project_item
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `canvas.toDataURL()` for PNG | `canvas.toBlob()` (async, lower memory) | Broadly supported 2018+ | toBlob avoids huge base64 strings; async encoding reduces main-thread jank |
| Bundled FFmpeg (Electron apps) | Auto-download on first use (yt-dlp pattern) | Common since 2022+ | Smaller app bundle, independent codec updates, legal flexibility |
| FCPXML v1.6 | FCPXML v1.11+ (FCP 10.8+) | 2023 | Newer DTD, bundle format optional, backwards-compatible with v1.8+ |
| Shell plugin for process spawning | Direct `std::process::Command` in Rust IPC | Always available in Tauri 2 | Simpler (no scope config), full Rust control, same functionality |

**Deprecated/outdated:**
- `canvas.toDataURL('image/png')`: Still works but synchronous, returns base64 string, blocks main thread, wastes memory for large images. Use `toBlob` instead.

## Open Questions

1. **FFmpeg binary hosting location**
   - What we know: Need a CDN or GitHub release URL for macOS arm64 FFmpeg with the required codecs
   - What's unclear: Whether to self-host a custom build or use an existing distribution like martin-riedl.de or evermeet.cx
   - Recommendation: Use martin-riedl.de (provides macOS arm64 snapshots with svt-av1, x264, prores support). Alternatively self-host a custom minimal build on GitHub Releases. This is Claude's discretion per CONTEXT.md.

2. **Large Uint8Array IPC performance**
   - What we know: Tauri 2 serializes IPC arguments as JSON. A 4K RGBA PNG blob can be 5-15MB compressed.
   - What's unclear: Whether serializing 15MB as `number[]` per frame introduces meaningful overhead vs. writing directly in Rust
   - Recommendation: Profile with real exports. If IPC overhead is noticeable, consider writing the PNG to a temp file from JS (via `@tauri-apps/plugin-fs`) and having Rust rename it to the final location, OR use Tauri's raw IPC channel for binary data.

3. **OffscreenCanvas vs HTMLCanvasElement for export**
   - What we know: `OffscreenCanvas` has a cleaner async API (`convertToBlob()` returns a Promise). `HTMLCanvasElement.toBlob()` uses a callback.
   - What's unclear: Whether WKWebView in Tauri fully supports `OffscreenCanvas` including 2D context (it should as of macOS 14+)
   - Recommendation: Use `HTMLCanvasElement` (universally supported in Tauri's WebView) with a Promise wrapper around `toBlob`. It's proven and the PreviewRenderer already uses HTMLCanvasElement.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | `Application/vitest.config.ts` |
| Quick run command | `cd Application && pnpm vitest run --reporter=verbose` |
| Full suite command | `cd Application && pnpm vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXPORT-01 | Frame compositing produces correct output at target resolution | unit | `cd Application && pnpm vitest run src/lib/exportRenderer.test.ts -x` | Wave 0 |
| EXPORT-02 | File naming pattern generates correct zero-padded filenames | unit | `cd Application && pnpm vitest run src/lib/exportEngine.test.ts -x` | Wave 0 |
| EXPORT-03 | Export loop yields to event loop and respects cancel signal | unit | `cd Application && pnpm vitest run src/lib/exportEngine.test.ts -x` | Wave 0 |
| EXPORT-04 | JSON sidecar contains correct metadata schema | unit | `cd Application && pnpm vitest run src/lib/exportSidecar.test.ts -x` | Wave 0 |
| EXPORT-05 | FFmpeg command construction with correct codec flags | manual-only | Requires FFmpeg binary + Rust backend | N/A |
| EXPORT-06 | Export dialog UI renders with correct format options | manual-only | Requires full Tauri app context | N/A |

### Sampling Rate
- **Per task commit:** `cd Application && pnpm vitest run --reporter=verbose`
- **Per wave merge:** `cd Application && pnpm vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `Application/src/lib/exportRenderer.test.ts` -- covers EXPORT-01 (pure compositing function tests)
- [ ] `Application/src/lib/exportEngine.test.ts` -- covers EXPORT-02, EXPORT-03 (naming, cancel logic)
- [ ] `Application/src/lib/exportSidecar.test.ts` -- covers EXPORT-04 (JSON schema validation)

## Discretion Recommendations

### FFmpeg Download Source
**Recommendation:** Use [martin-riedl.de](https://ffmpeg.martin-riedl.de/) for macOS arm64 static builds. They provide automatic download URLs for latest snapshots with all required codecs (x264, svt-av1, prores). URL pattern: `https://ffmpeg.martin-riedl.de/packages/macos-arm64/snapshot/ffmpeg`. For a more controlled approach, host a custom build on GitHub Releases under the efxlab org.

### Exact CRF/Quality Defaults Per Codec
**Recommendation:**
- H.264 (libx264): CRF 18, preset `medium`, profile `high` -- visually lossless for most content
- AV1 (libsvtav1): CRF 23, preset 6 -- good quality/speed balance
- ProRes (prores_ks): profile 3 (HQ) -- standard for intermediate/finishing workflows

### Progress Estimation Algorithm
**Recommendation:** Exponential moving average of per-frame render time. After each frame, update: `avgTime = 0.9 * avgTime + 0.1 * frameTime`. ETA = `avgTime * remainingFrames`. Don't show ETA until at least 5 frames are completed (initial estimates are unreliable).

### FCPXML Schema Version and Structure
**Recommendation:** Use FCPXML v1.8 (compatible with FCP 10.4+, widely supported). A single-clip reference is minimal:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.8">
  <resources>
    <format id="r1" frameDuration="1001/24000s" width="1920" height="1080"/>
    <asset id="r2" src="file:///path/to/project_name_[####].png"
           start="0s" duration="...s" hasVideo="1" format="r1"/>
  </resources>
  <library>
    <event name="Export">
      <project name="ProjectName">
        <sequence format="r1" duration="...s">
          <spine>
            <asset-clip ref="r2" offset="0s" duration="...s"/>
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>
```

### JSON Sidecar Schema
**Recommendation:**
```json
{
  "version": 1,
  "export_date": "2026-03-21T14:30:00Z",
  "project_name": "MyProject",
  "fps": 24,
  "resolution": { "width": 1920, "height": 1080 },
  "multiplier": 1.0,
  "total_frames": 240,
  "duration_seconds": 10.0,
  "format": "png_sequence",
  "naming_pattern": "MyProject_[####].png",
  "sequences": [
    {
      "name": "Scene 1",
      "start_frame": 0,
      "end_frame": 120,
      "transitions": {
        "fade_in": { "type": "fade_in", "duration_frames": 12, "mode": "transparency" },
        "cross_dissolve": { "type": "cross_dissolve", "duration_frames": 24 }
      }
    }
  ],
  "export_settings": {
    "codec": null,
    "quality": null,
    "video_file": null
  }
}
```

### Canvas Rendering Strategy for Export
**Recommendation:** Create ONE dedicated `HTMLCanvasElement` and ONE `PreviewRenderer` instance for the entire export. Reuse across all frames (clear and re-render). This minimizes memory allocation. The canvas dimensions are set once to `projectWidth * multiplier` x `projectHeight * multiplier` and never change during export.

### Resume-from-Frame Implementation
**Recommendation:** Before starting export, scan the target directory for existing `project_name_NNNN.png` files. Count consecutive files from frame 0. Offer to resume from the first missing frame. Track the last successfully written frame in `exportStore`. On error, the partial output remains on disk and the user can retry with resume.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `previewRenderer.ts`, `Preview.tsx`, `frameMap.ts`, `transitionEngine.ts`, `keyframeEngine.ts` -- complete rendering pipeline already decoupled from UI
- Existing codebase: `uiStore.ts`, `SettingsView.tsx` -- EditorMode pattern for full-window views
- Existing codebase: `commands/config.rs`, `services/project_io.rs` -- Rust IPC and atomic file write patterns
- [MDN HTMLCanvasElement.toBlob()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob) -- PNG blob extraction API
- [Tauri 2 Dialog Plugin](https://v2.tauri.app/plugin/dialog/) -- folder picker API
- [Tauri 2 Shell Plugin](https://v2.tauri.app/plugin/shell/) -- process spawning (already installed)
- [Tauri 2 Notification Plugin](https://v2.tauri.app/plugin/notification/) -- macOS system notifications
- [Tauri 2 Sidecar docs](https://v2.tauri.app/develop/sidecar/) -- external binary embedding pattern

### Secondary (MEDIUM confidence)
- [Apple FCPXML Reference](https://developer.apple.com/documentation/professional-video-applications/fcpxml-reference) -- FCPXML schema documentation
- [FFmpeg martin-riedl.de builds](https://ffmpeg.martin-riedl.de/) -- macOS arm64 static binaries with required codecs
- [fcp.cafe FCPXML demystified](https://fcp.cafe/developer-case-studies/fcpxml/) -- practical FCPXML structure guide

### Tertiary (LOW confidence)
- [tauri-plugin-ffmpeg](https://crates.io/crates/tauri-plugin-ffmpeg) -- Alternative Tauri FFmpeg plugin (not recommended; direct `std::process::Command` is simpler for our use case)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all core libraries already in the project, web APIs are well-documented standards
- Architecture: HIGH - export pipeline directly extends existing rendering infrastructure; patterns verified against codebase
- Pitfalls: HIGH - identified from direct codebase analysis (DPR scaling, image loading, cross dissolve dual-render)
- FFmpeg management: MEDIUM - auto-download pattern is well-established but specific binary hosting needs validation
- FCPXML generation: MEDIUM - simple clip reference format is well-documented but not tested against FCP

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (30 days -- stable domain, no fast-moving dependencies)
