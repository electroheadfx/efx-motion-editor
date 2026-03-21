# Phase 14: PNG & Video Export - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Multi-format export system: composited PNG image sequences (RGBA) and video files (ProRes, H.264, AV1) with resolution multipliers, progress tracking, metadata sidecars, and FFmpeg auto-provisioning. All output is "baked" — transitions, FX, layers fully composited. NLE-ready per-sequence export with FCPXML timeline reconstruction is deferred to v0.3.0.

</domain>

<decisions>
## Implementation Decisions

### Export formats
- **D-01:** Three output formats: PNG image sequence (RGBA), video (ProRes/H.264/AV1)
- **D-02:** PNG is always RGBA (transparent background) — for intermediate compositing in DaVinci Resolve / FCP / Premiere
- **D-03:** Video codecs: FFmpeg ProRes (prores_ks), H.264 (libx264), AV1 (libsvtav1)
- **D-04:** All exports are "baked" — transitions, FX, layers fully composited into output frames. No per-sequence splitting or transition markers in Phase 14.

### Resolution multipliers
- **D-05:** Available multipliers: 0.15x, 0.25x, 0.5x, 1x, 2x of project resolution
- **D-06:** Same multipliers for both PNG and video export
- **D-07:** Lower multipliers (0.15x, 0.25x) serve as fast preview; 1x/2x for final output

### FFmpeg integration
- **D-08:** Auto-download FFmpeg binary on first video export — not bundled with app
- **D-09:** Cached in Tauri `app_data_dir()` — downloaded once, persisted across sessions
- **D-10:** Custom FFmpeg build with only needed codecs (libx264, libsvtav1, prores_ks) to minimize size
- **D-11:** Rust Command pattern: check presence → download if absent → spawn process
- **D-12:** FFmpeg version updatable independently from efxlab releases

### Video quality settings
- **D-13:** Sensible defaults per codec (e.g., CRF 18 for H.264, CRF 23 for AV1, HQ for ProRes)
- **D-14:** Custom quality settings configurable in Settings page, persisted to `~/.config/efx-motion/builder-config.yaml`
- **D-15:** Video export has no audio track — audio support deferred to v0.3.0 phase

### Output file organization
- **D-16:** PNG naming: DaVinci Resolve convention `project_name_[####].png` (zero-padded frame number)
- **D-17:** PNG naming pattern customizable in Settings page (persisted to config)
- **D-18:** Export folder: timestamped subfolder `export_YYYY-MM-DD_HH-MM/` inside user-chosen directory
- **D-19:** Video naming: `ProjectName_ResolutionP_codec.ext` (e.g., `MyProject_1080p_h264.mp4`)
- **D-20:** Re-export to same timestamped folder overwrites silently

### Metadata sidecars
- **D-21:** JSON sidecar always generated — frame rate, resolution, frame count, duration, sequence mapping, transition frame ranges, export settings
- **D-22:** FCPXML sidecar generated for ProRes exports only — simple reference (single clip at correct FPS/resolution), not full timeline reconstruction
- **D-23:** FCPXML with full timeline + transitions deferred to v0.3.0 (NLE-ready export, Option B)

### Export UX flow
- **D-24:** Trigger: toolbar Export button + File menu item with Cmd+Shift+E shortcut
- **D-25:** Export dialog is a full-window modal view (same pattern as Settings/Imported views)
- **D-26:** Dialog layout: left section = format selector (PNG/ProRes/H.264/AV1) with format-specific options; right section = preview thumbnail of sample frame at chosen resolution + output summary (frame count, estimated size, output path); bottom = folder picker + Export button
- **D-27:** Output folder: prompt on first use, persist to config, option to force re-ask (change folder)
- **D-28:** Progress: modal progress bar blocking UI — shows current frame / total frames, estimated time remaining, cancel button
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

</decisions>

<specifics>
## Specific Ideas

- "Inspire from DaVinci Resolve" — the naming convention `project_name_[####].png` is standard for NLE import
- Preview thumbnail in export dialog should show an actual rendered frame at the chosen resolution — gives user confidence before committing to a long export
- FFmpeg pattern inspired by yt-dlp, LosslessCut, HandBrake — auto-provision, cache locally, update independently
- ProRes via FFmpeg's `prores_ks` encoder — legal grey zone for Apple ProRes but Blender uses it and this project is open source
- "Open in Finder" toast after export — instant access to output files

</specifics>

<canonical_refs>
## Canonical References

### Rendering pipeline (reuse for export)
- `Application/src/lib/previewRenderer.ts` — Canvas 2D compositing engine, `renderFrame()` with blend modes, opacity, transforms — decoupled from UI, reusable at arbitrary resolutions
- `Application/src/components/Preview.tsx` — Frame compositing pipeline: content sequence → overlay sequences (FX + content-overlay), cross-dissolve dual-render, fade opacity application
- `Application/src/lib/frameMap.ts` — `frameMap` computed array of FrameEntry[], `crossDissolveOverlaps`, `trackLayouts` — complete frame-to-image mapping for entire timeline
- `Application/src/lib/transitionEngine.ts` — `computeFadeOpacity()`, `computeSolidFadeAlpha()`, `computeCrossDissolveOpacity()` — transition rendering at any frame
- `Application/src/lib/keyframeEngine.ts` — `interpolateAt()` for per-layer keyframe animation, `applyEasing()` curves

### FX system
- `Application/src/lib/fxGenerators.ts` — Procedural FX generators (grain, particles, lines, dots, vignette) with seeded PRNG
- `Application/src/lib/fxColorGrade.ts` — Color grade adjustment (brightness, contrast, saturation, hue, tint)
- `Application/src/lib/glBlur.ts` — WebGL2 GPU-accelerated Gaussian blur
- `Application/src/lib/fxBlur.ts` — StackBlur CPU fallback

### Data model & persistence
- `Application/src/types/project.ts` — `MceProject` format (version 7), `MceSequence`, `MceLayer`, `MceLayerTransform`
- `Application/src/types/sequence.ts` — `Sequence` interface with transitions (fade_in, fade_out, cross_dissolve)
- `Application/src/stores/projectStore.ts` — `buildMceProject()` serialization, project metadata (fps, width, height)
- `Application/src/stores/imageStore.ts` — Image metadata, LRU full-res pool, `efxasset://` protocol

### Rust backend patterns
- `Application/src-tauri/src/commands/project.rs` — IPC commands: `project_save()` atomic write pattern (temp+rename)
- `Application/src-tauri/src/services/project_io.rs` — File I/O, directory creation, atomic save
- `Application/src-tauri/src/commands/config.rs` — Config persistence to `~/.config/efx-motion/builder-config.yaml`
- `Application/src/lib/ipc.ts` — `safeInvoke<T>()` wrapper returning `Result<T, string>`

### UI patterns to follow
- `Application/src/components/SettingsView.tsx` — Full-window modal view pattern (same as export dialog)
- `Application/src/components/ImportedView.tsx` — Full-window view with mode switching via `editorMode` signal

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PreviewRenderer`: Already decoupled from UI — accepts canvas + layer data, renders at any resolution. Core of export rendering.
- `frameMap`: Complete timeline-to-image mapping. Export iterates this to render every frame.
- `transitionEngine`: Fade/dissolve opacity computation works at any arbitrary frame — no UI dependency.
- `keyframeEngine`: Layer property interpolation — same engine for preview and export.
- `fxGenerators` + `fxColorGrade` + `glBlur`: All FX render to canvas directly — reusable for export at any resolution.
- `safeInvoke` IPC pattern: Rust command invocation with Result<T> error handling — extend for export commands.
- `SettingsView`/`ImportedView`: Full-window view pattern via `editorMode` signal — export view follows same pattern.
- `builder-config.yaml` persistence: Config commands already handle custom settings — extend for export presets and FFmpeg quality.

### Established Patterns
- **Atomic file I/O**: Rust backend uses temp file + rename for project saves — apply same for PNG writes
- **Full-window views**: `editorMode` signal switches between 'editor', 'imported', 'settings' — add 'export' mode
- **Config persistence**: Tauri IPC `config_*` commands read/write `builder-config.yaml` — extend for export settings
- **Asset protocol**: `efxasset://` for loading images — same protocol feeds image data during export rendering
- **Signal stores**: Reactive state management — export progress can use signals for UI binding

### Integration Points
- `Preview.tsx renderFromFrameMap()`: Export rendering logic lives here — needs extraction to a shared function that both Preview and export can call
- `projectStore`: Provides fps, width, height, project name for export filename/metadata
- `sequenceStore`: Provides sequence list for frame map computation and metadata sidecar
- `editorMode` signal in `uiStore`: Add 'export' mode for full-window export view
- Tauri Rust backend: New commands needed for FFmpeg management (check/download/spawn) and PNG file writes
- Native menu: Add Export item to File menu with Cmd+Shift+E
- Toolbar: Export button already exists (Phase 12.14) — wire to export view

</code_context>

<deferred>
## Deferred Ideas

- **NLE-ready export (Option B)** — Per-sequence PNG sub-sequences + FCPXML with full timeline structure (clip order, transitions, timing) → v0.3.0
- **Audio muxing in video export** — Add audio track to video files when audio import lands → v0.3.0
- **FCPXML with transitions for H.264/AV1** — Currently FCPXML only for ProRes; extend to all codecs later
- **Batch export presets** — Save named export configurations (e.g., "Preview 0.25x H.264", "Final 2x ProRes") for one-click re-export
- **Export queue** — Queue multiple exports with different settings
- **Background export** — Non-blocking export that allows continued editing

</deferred>

---

*Phase: 14-png-export*
*Context gathered: 2026-03-21*
