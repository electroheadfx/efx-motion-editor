# Project Research Summary

**Project:** EFX Motion Editor — v2.0 Production Tool
**Domain:** Desktop stop-motion cinematic editor (macOS) — layer compositing, FX, audio/beat sync, PNG export, editing workflow
**Researched:** 2026-03-03
**Confidence:** HIGH

## Executive Summary

EFX Motion Editor v2.0 transforms the shipped v1.0 MVP (import, timeline, playback, project management) into a professional production tool. The defining product differentiation is built-in cinematic effects (grain, scratches, light leaks, vignette, color grade) and audio-driven beat sync — features no stop-motion tool currently offers. Research across stack, features, architecture, and pitfalls consistently confirms a single core insight: the existing v1.0 codebase is well-positioned for v2.0. The stack is already capable. What is needed is completing skeleton structures (layerStore, historyStore), transitioning the preview from an `<img>` tag to a Canvas 2D compositor, and wiring 3 new npm packages (web-audio-beat-detector, tinykeys, and optionally wavesurfer.js — though the recommendation is to handle waveform extraction directly via Web Audio API to avoid widget/DOM conflicts with the existing canvas timeline).

The recommended build order is determined by strict dependency chains: undo/redo and keyboard shortcuts must ship as infrastructure first (every later feature benefits), followed by the layer system (which unblocks FX and export), then audio/waveform (independent, can partially parallel), then beat sync (requires audio), and finally PNG export (requires a complete layer rendering pipeline). The biggest architectural decision is a deliberate departure from Motion Canvas's generator model for real-time compositing — instead, a custom `PreviewRenderer` class using Canvas 2D `globalCompositeOperation` will drive both preview and export, making the pipeline simpler and eliminating the mismatch between Preact Signals reactivity and Motion Canvas's generator-function scene model. This is confirmed by direct inspection of the installed packages and the existing codebase.

The top risks are cross-store undo atomicity (multiple stores must update inside a Preact `batch()` on every undo/redo call), layer/scene-graph order divergence (the layerStore array order must always match render order), FX parameter resolution-dependency (all effect parameters must be stored as normalized 0–1 values, not pixels), and an existing v1.0 bug where `closeProject()` does not reset all stores. This last item is the first task before any v2.0 work begins. None of these risks are novel; all have clear prevention strategies documented in PITFALLS.md.

## Key Findings

### Recommended Stack

The v1.0 stack (Tauri 2.0 + Preact 10.28 + @preact/signals + @efxlab/motion-canvas-* v4.0.0 + Vite 5.4.21 + Tailwind CSS v4 + pnpm 10.27) requires only three new frontend npm dependencies. No new Rust crates are required for core features.

**Core technologies — new additions only:**
- `web-audio-beat-detector ^8.2.35`: BPM detection via `guess(audioBuffer)`. TypeScript-native, Web Audio API-based, actively maintained (Feb 2026 release). Best for offline analysis of imported files.
- `tinykeys ^3.0.0`: Keyboard shortcut binding. 650B gzipped, TypeScript-native, `$mod` macOS support, object-map API cleaner than hotkeys-js. Chosen over hotkeys-js (4x larger, no additional features needed).
- **Web Audio API (browser-native):** Replaces the previously considered Rust `symphonia`/`rodio` approach. Audio decoding, playback, waveform extraction, and beat detection all happen in the browser where audio needs to play. `wavesurfer.js` was evaluated but rejected — it is a full widget library that fights with the existing `TimelineRenderer` canvas compositor.
- **Custom Canvas 2D compositing (no new dependency):** `@efxlab/motion-canvas-2d` v4.0.0 already has a verified `ShaderConfig` interface for GLSL shaders. However, architecture research recommends a custom `PreviewRenderer` using Canvas 2D `globalCompositeOperation` for both preview and export — simpler, no WebGL context conflicts, full blend mode support, WYSIWYG export behavior.
- **Custom command pattern (no new dependency):** The existing `historyStore` skeleton and `HistoryEntry` type are the correct foundation. `@kvndy/undo-manager` was evaluated and rejected: it wraps individual signals, but undo granularity must be operations (batching multi-store changes atomically).

### Expected Features

**Must have (table stakes for v2.0):**
- Layer system with blend modes (normal, screen, multiply, overlay, add), opacity, and transforms — the compositing foundation without which the product is a slideshow player
- Properties panel (context-sensitive, currently an empty shell) — required for editing layer parameters
- Undo/redo covering 100+ levels across all state changes — non-negotiable for any creative tool
- PNG image sequence export — this IS the output pipeline; without it, work cannot leave the app
- Audio import with waveform display on timeline — core workflow for music-driven stop-motion
- Core keyboard shortcuts (Space, arrows, Cmd+Z/S, Delete) — professional tools are keyboard-driven
- At least 3 cinematic FX presets (grain, vignette, color grade) to prove the product's differentiating value

**Should have (differentiators):**
- Beat sync with BPM detection, beat markers, and auto-arrange — no stop-motion tool has this; turns music video creation from manual frame-counting into an assisted workflow
- Light leak and scratch FX presets (requires video layer support, more complex than static image layers)
- Full JKL scrubbing with variable speed playback

**Defer to v2.1:**
- Beat sync auto-arrange (full BPM detection + auto-arrange complexity; manual frame timing works in v2.0)
- Keyboard shortcuts overlay (? help screen)
- Layer loop modes (loop, mirror, ping-pong for video layers)
- Composition templates (serialize after layer format stabilizes with users)
- Onion skinning, sequence nesting, node-based compositing, keyframe animation — all explicitly anti-features for v2.0

### Architecture Approach

The key architectural insight from combining all research: v2.0 does not need Motion Canvas's generator-based scene graph for real-time preview or export compositing. A new `PreviewRenderer` class using Canvas 2D `globalCompositeOperation` handles both preview and export with full blend mode support, clean Preact Signals integration, and correct WYSIWYG export behavior. Motion Canvas remains in the project but its role is unused in the compositing pipeline; the export pipeline uses `OffscreenCanvas` + `canvas.convertToBlob()` + Tauri fs write.

**Major components:**
1. `PreviewRenderer` (new `lib/previewRenderer.ts`) — Canvas 2D compositor handling all layers, blend modes, opacity, transforms, and FX rendering per frame; drives both live preview and PNG export
2. `AudioEngine` (new `lib/audioEngine.ts`) — Web Audio API wrapper managing `AudioContext` lifecycle (singleton, lazy creation), `AudioBuffer` decoding, waveform peak extraction, and synchronized playback from a given frame
3. `ExportEngine` (new `lib/exportEngine.ts`) — Frame-by-frame orchestrator that drives `PreviewRenderer` at export resolution, captures PNG blobs via `OffscreenCanvas.convertToBlob()`, sends bytes to Rust for disk write, and manages progress/cancellation with event-loop yielding
4. `historyStore` (rewrite from stub) — Command-pattern undo stack with 100-entry cap, all executions wrapped in `batch()` for atomic cross-store updates
5. `audioStore` (new) and `exportStore` (new) — Signal stores following the existing module-scoped singleton pattern with `markDirty` callback registration
6. `layerStore` (rewrite from stub to computed view) — Derived from the active sequence's `layers` array inside `sequenceStore`; layers are per-sequence, not global
7. `lib/fx/` directory (new) — Five FX renderers (grain, scratches, light leak, vignette, color grade) as pure Canvas 2D functions with normalized parameters; presets are code-defined with named parameter ranges

**Existing patterns that all new code must follow:**
- `markDirty` callback chain (new stores wire to projectStore via `_setMarkDirtyCallback`)
- `snake_case` TypeScript types for all fields crossing the IPC boundary
- Module-scoped signal store singletons (not React context)
- `hydrateFromMce` / `buildMceProject` serialization gateway (layers and audio must extend this)

### Critical Pitfalls

1. **Cross-store undo atomicity** — Every undo/redo execution must be wrapped in `batch(() => { entry.undo(); })`. No `async` operations inside undo closures; all async work completes before the command is pushed. Preact Signals fire subscribers immediately on `.value =` assignment — naive sequential writes produce intermediate render states. Use `.peek()` inside closures, not `.value`.

2. **Layer/scene-graph order divergence** — The `layerStore` array and the actual render order must stay in sync at all times. Use a Preact `effect()` subscribed to `layerStore.layers` to drive synchronous render updates. Maintain stable `Layer.id → Node` mapping; move existing nodes rather than rebuilding on reorder.

3. **FX resolution-dependent parameters** — Preview renders at ~830px wide; export targets 1920x1080 or 4K. All FX parameters must be stored as normalized 0–1 values from day one. A `getEffectiveParams(width, height)` function converts to pixel values at render time. Establishing this convention before the first FX implementation avoids a HIGH-cost refactor later.

4. **AudioContext lifecycle in Tauri WKWebView** — AudioContext must be created lazily on the first user-initiated play action (autoplay policy). Check `audioContext.state` and call `resume()` on every play. Use `OfflineAudioContext` for BPM analysis. Handle Tauri window focus/blur events to resume the context.

5. **Data bleed on New Project (existing v1.0 bug)** — `projectStore.closeProject()` does not reset `timelineStore`, `layerStore`, or `historyStore`. This is the first task before any v2.0 work. Create a `resetAllStores()` function; every new store added in v2.0 must register with it immediately.

6. **PNG export blocking the main thread** — Never use `toDataURL()` (synchronous, base64 overhead). Always `canvas.convertToBlob()`. Yield to the event loop between frames via `requestAnimationFrame` or `setTimeout(0)`. The export loop must allow the progress bar to update and the cancel button to remain responsive.

7. **Keyboard shortcut conflicts** — Tauri native menus, browser defaults, and JS handlers all fire for the same keystrokes. Centralize all shortcuts in a `ShortcutManager`; skip firing when focus is on an `<input>` or `<textarea>`; call `e.preventDefault()` for handled keys; do NOT register Cmd+Z or Cmd+S as Tauri native menu accelerators.

## Implications for Roadmap

Based on combined research, the suggested phase structure matches the dependency chains identified in FEATURES.md and the critical path from PITFALLS.md.

### Phase 1: Foundation Fixes + Infrastructure (Undo/Redo + Keyboard Shortcuts)

**Rationale:** The existing v1.0 `closeProject()` data-bleed bug must be fixed before adding any new stores. Undo/redo and keyboard shortcuts are infrastructure that every subsequent feature depends on — shipping them first means all later features automatically have coverage and keyboard access from day one.

**Delivers:** `resetAllStores()` function, completed `historyStore` with command-pattern implementation (`batch()`-wrapped executions, 100-entry cap, branch-on-new-action), `tinykeys`-based `ShortcutManager` with core shortcuts (Space, arrows, Cmd+Z/Shift+Z, Cmd+S/N/O, Delete)

**Addresses:** Table-stakes undo/redo and keyboard shortcuts; v1.0 data-bleed bug fix
**Avoids:** Pitfalls 1 (cross-store undo atomicity), 5 (data bleed), 7 (keyboard shortcut conflicts)
**Research flag:** Standard patterns. No deeper research needed.

### Phase 2: Layer System + Properties Panel

**Rationale:** The layer system is the foundation for both FX effects and PNG export. Neither can be built without a working compositing renderer. The `PreviewRenderer` (Canvas 2D) must replace the current `<img>` tag approach in this phase so that subsequent phases build on a working compositor.

**Delivers:** Rewritten `layerStore` (computed from active sequence), `PreviewRenderer` (Canvas 2D `globalCompositeOperation`), layer panel UI with drag-and-drop reorder (SortableJS already a dependency), context-sensitive `PropertiesPanel`, blend mode support, opacity and transform controls, layer serialization in `.mce` format (MceLayer, version bump to 2 with v1 migration handling)

**Uses:** Canvas 2D `globalCompositeOperation` (MDN-documented standard), SortableJS (already installed), Preact Signals `effect()` for store-to-renderer synchronization
**Addresses:** All layer system table-stakes features; properties panel
**Avoids:** Pitfall 2 (layer/scene-graph order divergence — addressed by design from the start)
**Research flag:** Standard patterns for Canvas 2D compositing. No deeper research needed.

### Phase 3: FX Effects

**Rationale:** FX are specialized layers (type: 'fx') built on top of the Phase 2 layer system. They are the product's core differentiator and should ship as soon as the layer system is stable. All five effect types use the same `PreviewRenderer` pipeline.

**Delivers:** `lib/fx/` directory with grain, vignette, and color grade renderers (v2.0 MVP set), `FxPreset` registry with normalized parameter ranges, FX parameter controls in PropertiesPanel, normalized parameter convention enforced from day one, FX layer presets accessible from layer panel

**Addresses:** Built-in cinematic FX differentiator (grain, vignette, color grade at minimum)
**Avoids:** Pitfall 3 (resolution-dependent FX parameters — normalized from the start)
**Research flag:** Grain, vignette, and color grade are well-understood Canvas 2D operations. Light leaks (video layers) need additional research if targeting v2.0 scope.

### Phase 4: Audio Import + Waveform

**Rationale:** Audio is independent of the layer system. The PlaybackEngine clock refactor (switching to `AudioContext.currentTime` as master when audio is loaded) must be part of this phase — not deferred. The waveform is rendered as a dedicated track row in `TimelineRenderer`, not via a widget library.

**Delivers:** New `audioStore` and `AudioEngine` (Web Audio API), Tauri `import_audio` Rust command (file copy to `project/audio/`), waveform peak extraction via `AudioBuffer.getChannelData()`, waveform rendering track in `TimelineRenderer.drawWaveform()`, audio playback synced to `PlaybackEngine.start()/stop()`, volume/mute controls, `MceAudioRef` in project serialization

**Uses:** Web Audio API (browser-native), `AudioBufferSourceNode` for playback, `OfflineAudioContext` for analysis
**Addresses:** Audio import with waveform display (table stakes)
**Avoids:** Pitfall 4 (AudioContext lifecycle — singleton + lazy creation + `resume()` on every play)
**Research flag:** Standard Web Audio API patterns. `OfflineAudioContext` memory with large files should be benchmarked (analyze only first 30-60 seconds for BPM). Medium confidence on beat-detection accuracy for non-rhythmic music.

### Phase 5: Beat Sync

**Rationale:** Requires completed audio (Phase 4). The BPM detection, beat marker rendering on timeline, and auto-arrange calculation are a discrete feature set that ships as its own phase.

**Delivers:** `web-audio-beat-detector` integration via `lib/beatDetector.ts`, beat markers rendered on timeline canvas at computed frame positions, manual BPM/offset adjustment UI, snap mode selector (every beat / every 2 beats / every bar), auto-arrange distribution of key photos across beat positions (`framesPerBeat = fps * 60 / bpm`)

**Addresses:** Beat sync differentiator (alongside FX, the product's reason to exist)
**Avoids:** BPM halving/doubling errors — test with known-BPM reference tracks during QA
**Research flag:** BPM detection accuracy is MEDIUM confidence. Genre bias (poor results on acoustic/jazz) is a known limitation. Manual correction UI is essential, not optional. Consider whether auto-arrange belongs in v2.0 or v2.1.

### Phase 6: PNG Export

**Rationale:** Export must be last because it requires a complete, stable layer rendering pipeline. By this phase, all layer types, FX effects, and audio metadata are in place. The `PreviewRenderer` built in Phase 2 is reused — what you see is what you get.

**Delivers:** `ExportEngine` (frame-by-frame orchestrator using `OffscreenCanvas` + `PreviewRenderer`), `ExportDialog` (resolution, naming, output directory via Tauri dialog), `ExportProgress` overlay with cancel button, Rust `export_write_frame` and `export_write_metadata` commands, audio metadata sidecar JSON for DaVinci Resolve handoff, zero-padded sequential filename convention (`frame_000001.png`)

**Addresses:** PNG image sequence export (table stakes)
**Avoids:** Pitfall 6 (main thread blocking — `convertToBlob()` with event-loop yielding between frames; never `toDataURL()`)
**Research flag:** IPC binary transfer performance should be benchmarked during phase planning. The `toBlob()` → `ArrayBuffer` → IPC flow may need optimization for large frame counts (alternative: write via Tauri `plugin-fs` directly, avoiding invoke serialization overhead).

### Phase Ordering Rationale

- **Undo before everything:** The command pattern must be established before any feature adds mutable state. Retrofitting undo onto completed features is expensive and error-prone.
- **Layers before FX and export:** FX are layer presets; export flattens layers. Neither works without the compositor.
- **Audio before beat sync:** Beat detection requires an `AudioBuffer` from the decoded audio file.
- **Export last:** Requires a complete, stable compositor — all layer types, all FX, correct resolution handling proven.
- **Keyboard shortcuts in Phase 1:** `tinykeys` global registration is trivial; shipping shortcuts incrementally as features land means users always have keyboard access.

### Research Flags

Phases likely needing `/gsd:research-phase` during planning:
- **Phase 5 (Beat Sync):** BPM detection accuracy is MEDIUM confidence. Genre bias, BPM halving/doubling errors, and user expectation management need deeper investigation before committing to auto-arrange UX. Consider splitting beat markers (Phase 5a) from auto-arrange (Phase 5b / v2.1).
- **Phase 6 (PNG Export):** Tauri IPC binary transfer performance at scale. The `convertToBlob()` + `invoke('export_write_frame', { data: bytes })` path may be too slow for large sequences. Benchmark before architecture is locked; temp file alternative may be significantly faster.

Phases with standard, well-documented patterns (skip research-phase):
- **Phase 1 (Foundation):** Command pattern undo/redo with `batch()` and `tinykeys` are well-established patterns.
- **Phase 2 (Layer System):** Canvas 2D `globalCompositeOperation` is a web standard. All five blend modes are documented on MDN. No unknown APIs.
- **Phase 3 (FX Effects):** Grain, vignette, and color grade are well-understood Canvas 2D operations with clear implementation paths confirmed in ARCHITECTURE.md.
- **Phase 4 (Audio):** Web Audio API decode + peak extraction + playback sync are standard browser patterns. Tauri audio import (file copy) is standard Rust I/O.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All new dependencies verified against installed packages and GitHub. Only 3 new npm packages needed. Zero new Rust crates for core features. `web-audio-beat-detector` v8.2.35 released Feb 2026 — actively maintained. |
| Features | HIGH | Feature set grounded in competitive analysis (Dragonframe, Stop Motion Studio) and direct codebase analysis of existing stubs. Anti-features are clearly reasoned with explicit scope-out justifications. |
| Architecture | HIGH | Based on direct codebase analysis plus verified Motion Canvas API inspection against installed node_modules. Canvas 2D `globalCompositeOperation` approach is confirmed against MDN and avoids all Motion Canvas generator-model compatibility issues. |
| Pitfalls | MEDIUM-HIGH | Most pitfalls are derived from direct code inspection (data bleed bug is verified, store coupling is verified, `closeProject()` omissions are verified). BPM detection accuracy is MEDIUM — genre-dependent. Export IPC performance is MEDIUM — needs benchmarking. |

**Overall confidence:** HIGH

### Gaps to Address

- **BPM detection accuracy for non-rhythmic music:** `web-audio-beat-detector` works well for EDM/pop/rock. Results for jazz, classical, and acoustic genres are unreliable. The manual BPM adjustment UI is mandatory, not optional. During Phase 5 planning, define the minimum viable auto-detection UX and ensure manual override is the primary workflow path.

- **IPC binary transfer performance at export scale:** The `Vec<u8>` IPC path for frame data may be slow for large sequences. During Phase 6 planning, benchmark `convertToBlob()` + IPC vs. writing a temp file + invoking with a path. The temp file approach may be significantly faster and avoids the base64/serialization overhead.

- **Video layer support scope decision:** Light leaks and scratch FX using video layers (`type: 'video'`) are more complex than static image layers (require video element or OffscreenCanvas frame extraction). Confirm whether video layers are in v2.0 scope or deferred to v2.1 before Phase 3 planning.

- **`@kvndy/undo-manager` evaluation status:** Research conclusion is to reject it (operation-level vs. signal-level undo granularity mismatch). This was not fully validated against all stores. The custom command pattern recommendation should be treated as decided unless a compelling case emerges during Phase 1 implementation.

- **Motion Canvas `Img` node + Tauri `asset://` URL compatibility:** If any path uses Motion Canvas nodes for layer rendering (as opposed to the recommended `PreviewRenderer` approach), early validation is needed. `asset://` URLs may not resolve correctly inside MC `Img` nodes. If `PreviewRenderer` is fully adopted (recommended), this is not an issue.

## Sources

### Primary (HIGH confidence)
- `@efxlab/motion-canvas-2d/lib/partials/ShaderConfig.d.ts` — verified ShaderConfig interface in installed node_modules
- [Motion Canvas Node API](https://motioncanvas.io/api/2d/components/Node/) — `compositeOperation`, `opacity`, `cache`, `filters` properties
- [MDN: globalCompositeOperation](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation) — blend mode mapping (source-over, screen, multiply, overlay, lighter)
- [web-audio-beat-detector GitHub](https://github.com/chrisguttandin/web-audio-beat-detector) — v8.2.35, Feb 2026
- [tinykeys GitHub](https://github.com/jamiebuilds/tinykeys) — v3.0.0, 650B, TypeScript
- [Canvas toBlob MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob) — async PNG export
- [Tauri 2 File System Plugin](https://v2.tauri.app/plugin/file-system/) — file write API
- [Dragonframe Software](https://www.dragonframe.com/dragonframe-software/) — competitive feature reference
- [Preact Signals Guide](https://preactjs.com/guide/v10/signals/) — `batch()`, `peek()`, `effect()` behavior
- Direct codebase analysis of v1.0 source (stores, types, playbackEngine, TimelineRenderer, previewScene.tsx)

### Secondary (MEDIUM confidence)
- [web-audio-beat-detector npm](https://www.npmjs.com/package/web-audio-beat-detector) — API surface: `analyze()`, `guess()`
- [Tauri IPC Performance Discussion](https://github.com/tauri-apps/tauri/discussions/5690) — binary data transfer benchmarks
- [Building BPM Finder: Technical Challenges](https://dev.to/_ab56e9bbfaff3a478352a/building-bpm-finder-technical-challenges-in-client-side-audio-analysis-4n3) — memory and accuracy challenges
- [Filmora Auto Beat Markers](https://filmora.wondershare.com/ai-efficiency/auto-beat-marker.html) — beat marker UX pattern
- [Tauri Menu System & Keyboard Shortcuts](https://deepwiki.com/dannysmith/tauri-template/4.3-menu-system-and-keyboard-shortcuts) — native menu vs JS handler conflicts
- [WebGL Blending: Premultiplied Alpha](https://limnu.com/webgl-blending-youre-probably-wrong/) — blend mode correctness
- [Stop Motion Studio Pro](https://apps.apple.com/us/app/stop-motion-studio-pro/id641564761) — competitive feature reference

### Tertiary (LOW confidence)
- [@kvndy/undo-manager npm](https://www.npmjs.com/package/@kvndy/undo-manager) — evaluated and rejected; not validated against all 7 stores
- [VideoProc Vlogger Beat Editing](https://www.videoproc.com/video-editing-software/guide-free-win/edit-to-the-beat.htm) — auto-beat workflow UX reference

---
*Research completed: 2026-03-03*
*Ready for roadmap: yes*
