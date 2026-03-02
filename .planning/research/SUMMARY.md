# Project Research Summary

**Project:** EFX Motion Editor
**Domain:** Desktop stop-motion cinematic video editor (macOS)
**Researched:** 2026-03-02
**Confidence:** MEDIUM-HIGH

## Executive Summary

EFX Motion Editor is a desktop macOS application that occupies a clear gap in the market: it starts where Dragonframe ends (captured frames) and adds what After Effects offers (cinematic FX compositing) in a stop-motion-native workflow. The product is built on Tauri 2.0 (Rust backend + WKWebView frontend), Preact with Signals for reactive UI, and a custom fork of Motion Canvas (@efxlab/motion-canvas-*) for WebGL/Canvas rendering and PNG sequence export. The stack is pre-decided and well-suited to the domain -- Tauri provides a lightweight ~3MB binary with native macOS integration, Preact Signals deliver fine-grained reactivity critical for a real-time editor, and Motion Canvas handles the compositing pipeline.

The recommended approach is a dependency-driven build order: foundation first (Tauri + Preact scaffold, IPC bridge, asset protocol), then data model and project management, then the visual pipeline (timeline, preview canvas, layer system), then audio and export, and finally polish features like templates and beat sync. This order is dictated by hard dependencies -- the layer system requires the timeline, beat sync requires audio import, export requires the layer system, and everything requires the IPC and signal store foundation. The existing React prototype provides a UI shell that can be converted to Preact, accelerating the visual scaffold phase.

The five critical risks are: (1) WebKit canvas memory leaks from loading hundreds of high-resolution images -- this requires an image pool with LRU eviction designed from day one; (2) Tauri IPC bottleneck when transferring image data -- solved by using the asset protocol instead of serializing binary data through IPC; (3) Motion Canvas integration as an embedded renderer rather than its standalone editor mode -- needs early proof-of-concept validation; (4) Preact/compat compatibility with Motion Canvas packages -- a go/no-go gate during scaffolding; (5) audio-visual sync drift during beat-synced playback -- requires AudioContext as master clock from the start. All five risks are addressable but must be confronted in the foundation phase, not discovered later.

## Key Findings

### Recommended Stack

The stack centers on Tauri 2.4.x with official plugins (fs, dialog, store, shell) for native macOS integration, Preact 10.28.x with @preact/signals 2.8.x for reactive state management, and @efxlab/motion-canvas-* 4.0.0 for rendering. The Rust backend uses image-rs for thumbnail generation, symphonia for audio decoding, serde for project serialization, and tokio for async operations. The frontend adds wavesurfer.js 7.12.x for waveform visualization and realtime-bpm-analyzer for beat detection. Vite 7.3.x with Tailwind CSS 4.2.x handles the build pipeline.

**Core technologies:**
- **Tauri 2.4.x:** Desktop app framework -- lightweight binary, native macOS APIs, Rust performance for file I/O and audio processing
- **Preact + Signals:** UI rendering and state -- 3KB bundle, fine-grained reactivity without re-renders, ideal for real-time editor state
- **@efxlab/motion-canvas-* 4.0.0:** WebGL/Canvas rendering engine -- scene compositing, blend modes, PNG sequence export
- **Rust crates (image, symphonia, serde):** Backend processing -- thumbnail generation, audio decoding, project serialization
- **wavesurfer.js 7.12.x:** Audio waveform visualization -- timeline display, scrubbing, zoom
- **Tailwind CSS 4.2.x + Vite 7.3.x:** Styling and build -- CSS-native config, fast builds, HMR

**Highest-risk dependency:** The @efxlab/motion-canvas-* packages are a custom fork and the most likely source of version conflicts, particularly with Vite 7.x. Validate compatibility first during project setup.

### Expected Features

**Must have (table stakes):**
- Project management (create, open, save, autosave)
- Image import (drag-and-drop + file dialog, JPEG/PNG/TIFF/HEIC)
- Frame-by-frame timeline with thumbnails
- Frame duration / hold controls ("shooting on twos")
- Playback preview at project fps (15/24)
- Preview canvas with zoom/pan
- Sequence management
- Layer system with blend modes (static image, image sequence, video)
- Properties panel (transform, opacity, crop, blend mode)
- Built-in FX effects (grain, vignette, color grade minimum)
- Audio import with waveform display
- Export as PNG image sequence
- Keyboard shortcuts (space=play, arrows=step, JKL scrub)
- Undo/Redo (100+ levels)

**Should have (differentiators):**
- Beat sync with BPM detection and auto-arrange frames to music
- Composition templates (saveable FX presets like "Super 8", "16mm", "VHS")
- Onion skinning
- Cinematic rate controls (auto-break/auto-merge when changing fps)
- Layer repeat/loop modes (loop, mirror, ping-pong)
- Sequence nesting
- Dual-quality rendering (fast GPU preview vs high-quality export)

**Defer (v2+):**
- ProRes/MP4 video export (PNG sequence workflow is the professional standard)
- Keyframe animation for layer properties (transforms product toward motion graphics)
- Plugin/extension system (requires stable internal APIs)
- AI-powered features (distraction from core value)
- Live camera tethering (different product category)
- Windows/Linux builds

### Architecture Approach

The architecture follows a clear frontend/backend split. The Preact frontend owns everything visible and interactive: UI panels (Preact components + Tailwind), the preview canvas (@efxlab/motion-canvas-player web component), the timeline (custom canvas with imperative drawing), and audio playback (Web Audio API). The Rust backend owns everything that touches disk or performs heavy computation: project file I/O, image import and thumbnail generation, audio decoding and BPM detection, export frame writing, and global configuration. Communication flows through Tauri's IPC: invoke() for request-response commands, events for backend-initiated notifications, and Channels for streaming large data. State is managed through module-scoped Preact Signals organized into domain-specific stores (project, sequences, layers, timeline, ui, history).

**Major components:**
1. **Signal Store Layer** -- Centralized reactive state (project, sequences, layers, timeline, UI) driving all panel updates via fine-grained subscriptions
2. **Preview Canvas** -- Motion Canvas player web component rendering composited frames with all layers and FX
3. **Timeline Canvas** -- Custom canvas element with virtualized rendering for frame thumbnails, waveform, and beat markers
4. **IPC Bridge** -- Type-safe wrappers around Tauri invoke() isolating all backend communication
5. **Rust Command Handlers** -- Domain-organized modules (project, files, export, audio, config, templates) handling all file system and CPU-intensive operations
6. **Undo/Redo System** -- Snapshot-based history with JSON-serialized state snapshots, capped at 100 entries

### Critical Pitfalls

1. **WebKit canvas memory leaks** -- Implement an explicit image pool with LRU eviction (max 50 full-res images). Generate thumbnails at 256px in Rust. Never load full-res photos into the webview for thumbnails. Use URL.revokeObjectURL() aggressively.
2. **Tauri IPC bottleneck for image data** -- Never send raw image bytes through IPC. Use the asset protocol (asset:// URLs) for image loading. Configure CSP with `img-src 'self' asset: http://asset.localhost` from day one.
3. **Motion Canvas as embedded renderer** -- Build a proof-of-concept early: load one image into a Motion Canvas scene, play it in the embedded player, export 10 PNG frames programmatically. This is a go/no-go gate.
4. **Audio-visual sync drift** -- Use AudioContext.currentTime as the master clock. Derive visual frame position from audio time, never the reverse. Do BPM detection in Rust, not Web Audio API.
5. **Preact/compat breaks with Motion Canvas** -- Validate all @efxlab/motion-canvas-* imports against Preact during scaffolding. Motion Canvas likely renders to its own canvas element and may not need React/Preact at all. Configure Vite aliases for react -> preact/compat.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation and Scaffolding
**Rationale:** Everything depends on this. All five critical pitfalls require foundation-level decisions. The IPC bridge, asset protocol, Preact + Motion Canvas compatibility, and signal store architecture must be validated before any feature work begins.
**Delivers:** Working Tauri + Preact + Vite + Tailwind scaffold. Verified Motion Canvas player embedding (proof-of-concept). Asset protocol configured. IPC wrappers and Rust command skeleton. TypeScript types mirroring Rust models. Signal stores (project, sequences, layers, timeline, ui, history).
**Addresses:** Project management (create/save/load), basic signal store infrastructure
**Avoids:** Pitfalls 2 (IPC bottleneck), 3 (Motion Canvas integration), 5 (Preact compat)

### Phase 2: UI Shell and Image Pipeline
**Rationale:** The existing React prototype can be converted to Preact. Image import through Rust with thumbnail generation establishes the asset pipeline that everything else builds on. Memory-safe image loading must be proven here.
**Delivers:** Converted UI shell (panels layout from React prototype). Image import via Rust (copy to project dir, generate thumbnails). Sequence management (create, reorder, delete). Properties panel wired to signal stores.
**Addresses:** Image import, sequence management, properties panel
**Avoids:** Pitfall 1 (WebKit memory leaks -- image pool + thumbnail cache established here)

### Phase 3: Timeline and Playback
**Rationale:** The timeline is the primary workspace and depends on sequences/images existing in signal stores. Must be built with viewport virtualization from the start (pitfall: rendering all thumbnails at once kills performance above 100 frames). Playback engine must use the right clock architecture to avoid audio sync drift later.
**Delivers:** Canvas-based timeline with frame thumbnails, scrubbing, zoom. Playhead with playback at project fps. Frame duration/hold controls. Onion skinning overlay on preview canvas.
**Addresses:** Timeline, playback preview, frame duration controls, onion skinning, zoom/pan on preview
**Avoids:** Performance trap (timeline virtualization), Pitfall 4 foundation (master clock architecture)

### Phase 4: Layer System and FX
**Rationale:** This is the product's core differentiator. The layer system depends on the timeline and preview canvas existing. FX rendering through Motion Canvas is where the product diverges from all competitors. This phase proves the product's unique value proposition.
**Delivers:** Layer stack (static image, image sequence, video overlays). Blend modes (screen, multiply, overlay, etc.). Layer transforms (position, scale, rotation, opacity, crop). Built-in FX effects (grain, vignette, color grade). Layer rendering in Motion Canvas preview.
**Addresses:** Layer system, blend modes, built-in FX effects, properties panel for layers
**Avoids:** Anti-pattern of putting rendering logic in signal stores

### Phase 5: Audio and Beat Sync
**Rationale:** Audio depends on the timeline existing. Beat sync depends on audio import. BPM detection runs in Rust (symphonia for decoding, custom analysis). Waveform visualization uses wavesurfer.js with pre-computed peak data from Rust.
**Delivers:** Audio import (WAV/MP3/AAC). Waveform visualization on timeline. BPM detection and beat markers. Snap-to-beat mode. Auto-arrange frames to beats.
**Addresses:** Audio import, waveform display, beat sync, auto-arrange
**Avoids:** Pitfall 4 (audio sync drift -- AudioContext as master clock, Rust-side BPM detection)

### Phase 6: Export Pipeline
**Rationale:** Export depends on the layer system being complete (must flatten all layers). The rendering happens in the WebView via Motion Canvas; Rust handles disk I/O. This is where dual-quality rendering (preview vs export) becomes relevant.
**Delivers:** PNG sequence export with configurable resolution. Frame-by-frame progress UI with cancellation. Audio metadata sidecar file. Reveal-in-Finder on completion.
**Addresses:** PNG sequence export, dual-quality rendering
**Avoids:** Anti-pattern of running export entirely in Rust (Motion Canvas renders in WebView)

### Phase 7: Templates, Undo Polish, and Keyboard Workflow
**Rationale:** Templates require a stable layer system. Undo/redo refinement requires all mutation types to exist. Keyboard shortcuts require all features to be addressable. This is polish and power-user features.
**Delivers:** Composition templates (save/apply/library with built-in presets). Full undo/redo coverage for all operations. Complete keyboard shortcut set. Cinematic rate controls. Layer loop modes. Autosave refinement.
**Addresses:** Composition templates, undo/redo, keyboard shortcuts, rate controls, layer loop modes, autosave
**Avoids:** UX pitfalls (undo coverage gaps, no progress feedback, zoom anchor)

### Phase Ordering Rationale

- **Dependency-driven:** Each phase produces outputs required by the next. The layer system cannot exist without the timeline; beat sync cannot exist without audio; export cannot exist without the layer system.
- **Risk-front-loaded:** The three highest-risk integrations (Motion Canvas embedding, Preact compat, asset protocol) are all validated in Phase 1. If any fails, recovery is cheapest at this stage.
- **Value-incremental:** Phase 2 produces a usable image organizer. Phase 3 adds playback. Phase 4 adds the core differentiator (FX). Phase 5 adds music workflow. Phase 6 completes the pipeline. Each phase delivers demonstrable value.
- **Pitfall-aware:** Memory management (Phase 2), timeline virtualization (Phase 3), audio clock architecture (Phase 3/5), and export architecture (Phase 6) are all addressed at the correct build stage.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Foundation):** Motion Canvas embedded player API and programmatic scene control are not well-documented for non-standard use. Needs hands-on prototyping.
- **Phase 4 (Layer System):** Mapping layer properties (blend modes, transforms) to Motion Canvas scene graph nodes requires understanding internal MC APIs. The @efxlab fork may have custom APIs.
- **Phase 5 (Audio/Beat Sync):** The IPC pattern for streaming waveform peaks from Rust to frontend needs prototyping. BPM detection algorithm selection (aubio bindings vs custom) needs evaluation.
- **Phase 6 (Export):** Frame-by-frame capture from Motion Canvas player (canvas.toBlob -> IPC Channel -> Rust disk write) is an undocumented workflow that needs validation.

Phases with standard patterns (skip research-phase):
- **Phase 2 (UI Shell):** React-to-Preact conversion is well-documented. Tauri file dialog and image crate thumbnail generation are standard patterns.
- **Phase 3 (Timeline):** Canvas-based timeline with virtualization is a well-established pattern in video editors. wavesurfer.js integration is documented.
- **Phase 7 (Polish):** Templates, undo/redo, and keyboard shortcuts are standard application patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Core technologies are pre-decided and well-documented. Risk is in @efxlab/motion-canvas-* compatibility with Vite 7 and Preact (custom fork, less documentation). |
| Features | HIGH | Clear competitive analysis against Dragonframe, Stop Motion Studio, After Effects. Feature set is well-defined with explicit MVP scope and deferral list. |
| Architecture | MEDIUM-HIGH | Tauri 2.0 patterns are well-documented. Signal store pattern is sound. Motion Canvas integration as embedded renderer (not standalone) is the area of lowest confidence. |
| Pitfalls | MEDIUM-HIGH | Sourced from Tauri GitHub issues, community blog posts, and WebKit behavior analysis. WebKit memory behavior and IPC benchmarks are documented. Audio sync patterns are well-understood in the Web Audio community. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **@efxlab/motion-canvas-* Vite 7 compatibility:** Custom fork packages may pin specific Vite plugin API versions. Must validate on first install. If incompatible, pin Vite to 6.x.
- **Motion Canvas programmatic export:** The documented export path assumes MC's own UI. Programmatic frame-by-frame capture and PNG write through IPC Channel is an undocumented workflow. Needs proof-of-concept in Phase 1.
- **Waveform data IPC pattern:** The exact mechanism for streaming pre-computed audio peaks from Rust to the frontend (Tauri Channel vs chunked invoke responses) needs prototyping.
- **WebKit WKWebView rendering throttling:** WKWebView may throttle requestAnimationFrame when the app loses focus. Impact on export (which renders frame-by-frame) is unknown. May need to keep the window focused during export or use an alternative rendering approach.
- **macOS code signing and notarization:** Not a code architecture concern, but WKWebView requires specific entitlements (JIT, unsigned executable memory). Must test notarized build before distribution phase, not on release day.
- **Color space consistency:** Exported PNGs must match preview colors. sRGB vs Display P3 on macOS can cause subtle color shifts. Needs validation during export phase.

## Sources

### Primary (HIGH confidence)
- [Tauri 2.0 Official Docs](https://v2.tauri.app/) -- IPC, plugins (fs, dialog, store, shell), architecture, code signing
- [Preact Signals Guide](https://preactjs.com/guide/v10/signals/) -- reactive state management patterns
- [Motion Canvas Rendering Docs](https://motioncanvas.io/docs/rendering/) -- export pipeline, image sequence
- [Rust image crate](https://crates.io/crates/image) -- v0.25, thumbnail generation
- [Symphonia](https://github.com/pdeljanov/Symphonia) -- pure Rust audio decoding
- [Tailwind CSS v4](https://tailwindcss.com/blog/tailwindcss-v4) -- CSS-native config, Vite plugin
- [Dragonframe Software Features](https://www.dragonframe.com/dragonframe-software/) -- competitor baseline

### Secondary (MEDIUM confidence)
- [wavesurfer.js](https://github.com/katspaugh/wavesurfer.js) -- v7.12.x waveform visualization
- [realtime-bpm-analyzer](https://www.realtime-bpm-analyzer.com/) -- Web Audio API BPM detection
- [Tauri IPC performance](https://github.com/tauri-apps/tauri/discussions/7146) -- binary IPC benchmarks
- [Tauri asset protocol issues](https://github.com/tauri-apps/tauri/issues/2952) -- memory leak documentation
- [Audio/Video sync with Web Audio API](https://blog.paul.cx/post/audio-video-synchronization-with-the-web-audio-api/) -- master clock pattern

### Tertiary (LOW confidence)
- [Motion Canvas DeepWiki](https://deepwiki.com/motion-canvas/motion-canvas) -- architecture overview (community-generated)
- @efxlab/motion-canvas-* package internals -- custom fork, limited public documentation
- Vite 7.x compatibility with Motion Canvas Vite plugin -- unverified, needs runtime validation

---
*Research completed: 2026-03-02*
*Ready for roadmap: yes*
