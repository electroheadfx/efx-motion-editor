# Feature Research

**Domain:** Stop-motion cinematic video editor (desktop macOS)
**Researched:** 2026-03-02
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Frame-by-frame timeline | Every stop-motion tool (Dragonframe, Stop Motion Studio) has this. Users think in frames, not clips. | MEDIUM | Must show image thumbnails per frame, support drag reorder, and zoom levels. Dragonframe's timeline with thumbnails is the baseline expectation. |
| Playback preview at project frame rate | Users must see their animation play back at 15/24 fps to judge timing. Without this, they are working blind. | HIGH | Motion Canvas player handles rendering. Must maintain consistent frame rate even with FX layers active. Dual-mode (preview vs full quality) is standard practice. |
| Onion skinning | Industry standard since traditional animation. Dragonframe, Stop Motion Studio, and every serious tool offers this. Users expect transparent overlay of previous/next frames to judge movement continuity. | MEDIUM | Semi-transparent overlay of N previous/next frames. Configurable opacity and frame count. Can be implemented as a canvas composite operation. |
| Image import (drag-and-drop + file dialog) | Standard file handling. Users have photos from cameras/phones. Drag-and-drop is the expected import method for any media app on macOS. | LOW | Support JPEG, PNG, TIFF, HEIC. Tauri file dialog + native drag-and-drop. Auto-generate thumbnails on import. |
| Frame duration / hold controls | Stop-motion is about timing. Users need to hold a key photo for N frames (e.g., 2 frames at 24fps = "shooting on twos"). Dragonframe's exposure sheet is built around this concept. | LOW | Frame duplication at project fps. Duration slider per key photo (1-3 seconds translates to frame holds). This is the core interaction model. |
| Undo/Redo with history | Every creative application. Users expect Cmd+Z to work deeply (32+ levels minimum, matching Premiere Pro's standard). | MEDIUM | Command pattern on state changes. Must cover timeline edits, layer changes, property modifications. Signal-based state makes this tractable but needs careful design. |
| Project save/load/autosave | Standard for any desktop creative app. Final Cut Pro auto-saves continuously. Premiere keeps versioned autosaves. Users expect never to lose work. | MEDIUM | JSON-based .mce format. Autosave on interval (30s) and on significant actions. Recent projects list. Versioned backups. |
| Audio import and waveform display | Dragonframe has multi-track audio with waveform visualization. Users composing to music need to see the waveform to time their frames. | MEDIUM | Import WAV/MP3/AAC. Render waveform as canvas visualization on timeline. Audio playback synced to playhead position. |
| Export as PNG image sequence | This IS the product's export pipeline. PNG sequences are the professional standard for passing to DaVinci Resolve/Premiere Pro. Naming convention (frame_0001.png, frame_0002.png) must be consistent. | MEDIUM | Resolution options (1080p, 4K, custom). Sequential naming with configurable pattern and zero-padding. Progress indicator. Audio metadata sidecar file for downstream editors. |
| Zoom and pan on preview canvas | Standard in any visual editor. Users need to inspect detail at pixel level and zoom out for composition overview. | LOW | Scroll-to-zoom, trackpad pinch, fit-to-window shortcut. Pan with space+drag or middle-mouse. |
| Properties panel for selected items | Every layer-based editor (After Effects, Photoshop, Fusion) has an inspector/properties panel. Users expect to select something and see its editable properties. | LOW | Transform (position, scale, rotation), blend mode, opacity, crop. Context-sensitive based on selection (frame vs layer vs sequence). |
| Keyboard shortcuts | Professional creative apps are keyboard-driven. Dragonframe has extensive shortcuts. Keyboard-driven editing is 20-40% faster than mouse-only (industry research). Users expect space=play, arrow keys=step frames, standard modifiers. | MEDIUM | Full shortcut set: playback (space, JKL), navigation (arrows, home/end), editing (Cmd+Z/X/C/V), tool switching. Must be discoverable and consistent with macOS conventions. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not expected in stop-motion tools, but valuable for the cinematic pipeline.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Built-in cinematic FX layer system | Dragonframe has zero compositing. Stop Motion Studio has basic overlays. No stop-motion tool offers real-time cinematic FX (grain, dirt/scratches, light leaks, vignette, color grade) baked into the timeline. Users currently must do this in After Effects or DaVinci Resolve as a separate step. This collapses two workflow stages into one. | HIGH | Multiple FX layer types: static image overlay, image sequence, video layer, procedural effects. Blend modes (screen, multiply, overlay, etc.). This is the product's core differentiator. |
| Beat sync with auto-arrange | Beatgrid for After Effects exists but is a niche plugin. No stop-motion tool has BPM detection + snap-to-beat + auto-arrange frames to music. This turns music video creation from tedious manual work into an assisted workflow. | HIGH | BPM detection from audio, beat markers on timeline, snap modes (every beat, every 2 beats, etc.), auto-arrange key photos to fill beats. Frame fill calculation (how many holds per beat at project fps). |
| Composition templates (saveable FX presets) | After Effects has presets/templates, but no stop-motion tool does. Users build a "look" (grain + vignette + color grade) and want to apply it across sequences or projects. Saves hours of repetitive setup. | MEDIUM | Save layer stack as named template. Apply to any sequence. Import/export templates between projects. Template library with built-in presets (e.g., "Super 8", "16mm", "VHS"). |
| Cinematic rate controls (auto-break / auto-merge) | Unique to this product. When changing project fps (15 to 24), automatically recalculate frame holds to preserve timing. No tool handles this — users manually re-time everything. | MEDIUM | Min/max keys-per-second constraints. Auto-break (split long holds when increasing fps). Auto-merge (combine frames when decreasing fps). Preserves artistic intent across rate changes. |
| Dual-quality rendering (preview vs export) | Professional VFX tools have proxy workflows, but no stop-motion tool offers dual-path rendering where preview uses fast GPU shaders (Dual Kawase blur) and export uses high-quality algorithms (Gaussian). Users get real-time feedback without sacrificing export quality. | HIGH | Preview mode: Dual Kawase blur at 60fps/1080p. Export mode: full Gaussian blur, full-resolution FX. Toggle between modes. Motion Canvas handles both render paths. |
| Sequence management with nesting | After Effects has compositions/pre-comps. Bringing this concept to stop-motion is powerful — users can organize shots as sequences, nest sequences within sequences, and manage complex multi-shot films as a hierarchy rather than one flat timeline. | MEDIUM | Create, duplicate, delete, reorder sequences. Nested sequences (a sequence used as a clip in another). This enables feature-film-scale organization in a stop-motion tool. |
| Layer repeat/loop modes | Unique variety of loop modes for FX layers — loop, mirror, ping-pong, stretch, tile. A film grain overlay that ping-pongs avoids the visible loop point that plagues standard compositing. No stop-motion tool has this. | LOW | Per-layer loop mode setting. Especially valuable for video/image-sequence FX layers that may be shorter than the sequence they overlay. |
| Procedural FX effects | Built-in procedural effects (particles, flash/strobe, animated grain) that don't require importing external assets. Users get cinematic looks without sourcing and managing overlay files. | HIGH | WebGL/Canvas-based procedural generation via Motion Canvas. Parameterized: grain intensity, particle count, flash frequency. Real-time preview. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this specific product.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Direct video export (ProRes/MP4) | Users expect a single "export video" button. | The product's workflow is explicitly PNG-sequence-to-NLE. Adding video encoding means bundling FFmpeg, handling codecs, container formats, and audio muxing — massive complexity for a v1. DaVinci Resolve does this better. The PNG sequence workflow is actually the professional standard. | Export PNG sequence + audio metadata sidecar. Include clear documentation on importing into DaVinci Resolve/Premiere. Defer ProRes/MP4 to v2. |
| Live camera tethering | Dragonframe's core feature. Users might expect capture-to-timeline. | This is a fundamentally different product. Dragonframe captures frames from cameras. EFX Motion Editor composes pre-captured photos with cinematic FX. Adding tethering means camera SDKs, live view, focus control — a separate product's worth of complexity. | Import photos after capture. Users can use their camera's app or Dragonframe for capture, then bring photos into EFX for compositing and FX. |
| Keyframe animation on layer properties | After Effects users expect to animate position/opacity/scale over time with keyframe curves. | Adds a full animation curve editor, interpolation modes, graph editor UI — enormous complexity that competes with After Effects rather than complementing the stop-motion workflow. The product's layers are FX overlays, not motion graphics. | Static layer properties per sequence. If a user needs animated properties, they create the animation externally and import as a video/image-sequence layer. Defer keyframe animation to v2. |
| Real-time collaboration | Modern cloud apps offer this. | Desktop app with local file system. Real-time collaboration requires conflict resolution, networking, state sync — architectural complexity that would dominate v1 development. Stop-motion is typically a solo or small-team craft. | Project files (.mce) are JSON — they can be version-controlled with Git or shared via file sync. Defer collaboration to v2. |
| AI-powered features (smart beat sync, magic edit) | Trendy. Users see AI in every product. | ML model integration, inference performance, training data, accuracy tuning — each AI feature is a research project. Distraction from core value proposition. | Build the manual tools well first. Audio beat detection can use proven DSP algorithms (not ML). Defer AI to v2 after validating core product. |
| Plugin/extension system | Power users want extensibility. | Plugin APIs require stable internal APIs, sandboxing, documentation, a developer ecosystem — premature for v1. The internal architecture will change as the product matures. | Build with clean internal component boundaries so a plugin system is feasible later. Defer to v2. |
| Node-based compositing | Fusion/Nuke use node graphs. Seems more "professional." | Node-based UIs are powerful but have a steep learning curve. The product targets photographers making stop-motion films, not VFX artists. A layer-based approach (like After Effects/Photoshop) is more intuitive for the target user. | Layer-based FX stack with blend modes. Simpler mental model, faster to learn, sufficient for the overlay/compositing needs of cinematic stop-motion. |

## Feature Dependencies

```
[Image Import]
    └──requires──> [Project Management] (needs a project to import into)

[Timeline]
    └──requires──> [Image Import] (needs frames to display)
    └──requires──> [Frame Duration Controls] (timeline displays held frames)

[Playback Preview]
    └──requires──> [Timeline] (plays what's on the timeline)
    └──requires──> [Preview Canvas] (renders to canvas)

[Layer System]
    └──requires──> [Timeline] (layers are per-sequence, displayed on timeline)
    └──requires──> [Properties Panel] (layers need property editing)

[FX Effects (Procedural)]
    └──requires──> [Layer System] (FX are layers)
    └──requires──> [Preview Canvas] (must render in real-time)

[Audio Import + Waveform]
    └──requires──> [Timeline] (waveform displays on timeline)

[Beat Sync]
    └──requires──> [Audio Import + Waveform] (needs audio to detect beats)
    └──requires──> [Frame Duration Controls] (auto-arrange adjusts durations)

[Composition Templates]
    └──requires──> [Layer System] (templates save layer stacks)

[Sequence Nesting]
    └──requires──> [Sequence Management] (needs multiple sequences)
    └──requires──> [Timeline] (nested sequences appear on timeline)

[Export PNG Sequence]
    └──requires──> [Timeline] (exports what's composed)
    └──requires──> [Layer System] (flattens layers for export)

[Onion Skinning]
    └──requires──> [Preview Canvas] (overlay on canvas)
    └──requires──> [Timeline] (knows previous/next frames)

[Dual-Quality Rendering]
    └──requires──> [Preview Canvas] (preview path)
    └──requires──> [Export PNG Sequence] (export path)
```

### Dependency Notes

- **Beat Sync requires Audio Import:** Cannot detect beats without audio loaded. Audio waveform display should ship before or with beat sync.
- **Layer System requires Timeline:** Layers exist within sequences displayed on the timeline. The timeline must support layer tracks before the layer system is useful.
- **Composition Templates require Layer System:** Templates serialize a layer stack configuration. The layer system must be stable before templates make sense.
- **Export requires Layer System:** Export must flatten/composite all layers. Building export before layers means rebuilding the export pipeline later.
- **Dual-Quality Rendering requires both Preview and Export:** The toggle between Dual Kawase and Gaussian blur spans both render paths. Both must exist first.

## MVP Definition

### Launch With (v1.0)

Minimum viable product — the core loop must work end-to-end.

- [ ] **Project management** (create, open, save, autosave) — without this, nothing persists
- [ ] **Image import** (drag-and-drop + file dialog) — the entry point for all content
- [ ] **Timeline with frame thumbnails** — the primary workspace for arranging frames
- [ ] **Frame duration / hold controls** — core interaction: how long each key photo holds
- [ ] **Playback preview at project fps** — users must see their animation play
- [ ] **Preview canvas with zoom/pan** — the visual output surface
- [ ] **Sequence management** (create, reorder, basic operations) — organize shots
- [ ] **Layer system with blend modes** (static image, image sequence, video) — the FX foundation
- [ ] **Layer transforms and properties panel** — position, scale, rotation, opacity, crop
- [ ] **Built-in FX effects** (grain, vignette, color grade minimum) — the cinematic differentiator
- [ ] **Audio import with waveform** — needed for timing to music
- [ ] **Export as PNG sequence** — the output pipeline
- [ ] **Keyboard shortcuts** (playback, navigation, editing basics) — professional usability
- [ ] **Undo/Redo** — non-negotiable for creative tools

### Add After Validation (v1.x)

Features to add once the core loop is validated and users confirm the product direction.

- [ ] **Beat sync** (BPM detection, beat markers, snap, auto-arrange) — add when users confirm music-driven workflow is valued
- [ ] **Composition templates** (save/apply/library) — add when users have built enough FX stacks to want reuse
- [ ] **Onion skinning** — add when users request frame-to-frame continuity assistance
- [ ] **Cinematic rate controls** (auto-break/merge) — add when users work across multiple frame rates
- [ ] **Layer repeat/loop modes** — add when users work with shorter FX clips over longer sequences
- [ ] **Sequence nesting** — add when users create multi-sequence films
- [ ] **Procedural FX effects** (particles, flash, animated grain) — add when static FX layers are validated
- [ ] **Dual-quality rendering toggle** — add when performance on complex compositions needs optimization
- [ ] **Blur system** (Dual Kawase preview / Gaussian export) — add alongside dual-quality rendering

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **ProRes/MP4 video export** — only after PNG workflow is validated
- [ ] **Keyframe animation for layer properties** — transforms product toward motion graphics
- [ ] **Plugin system** — requires stable internal APIs
- [ ] **AI-powered features** — requires core product validation first
- [ ] **Cloud storage / collaboration** — architectural shift
- [ ] **Windows/Linux builds** — platform expansion
- [ ] **Live camera tethering** — different product category

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Project management (save/load/autosave) | HIGH | MEDIUM | P1 |
| Image import (drag-drop + dialog) | HIGH | LOW | P1 |
| Timeline with frame thumbnails | HIGH | HIGH | P1 |
| Frame duration / hold controls | HIGH | LOW | P1 |
| Playback preview at project fps | HIGH | HIGH | P1 |
| Preview canvas (zoom/pan) | HIGH | MEDIUM | P1 |
| Sequence management | HIGH | MEDIUM | P1 |
| Layer system + blend modes | HIGH | HIGH | P1 |
| Properties panel | HIGH | LOW | P1 |
| Built-in FX (grain, vignette, color grade) | HIGH | HIGH | P1 |
| Audio import + waveform | HIGH | MEDIUM | P1 |
| Export PNG sequence | HIGH | MEDIUM | P1 |
| Keyboard shortcuts | HIGH | LOW | P1 |
| Undo/Redo | HIGH | MEDIUM | P1 |
| Beat sync + auto-arrange | HIGH | HIGH | P2 |
| Composition templates | MEDIUM | MEDIUM | P2 |
| Onion skinning | MEDIUM | LOW | P2 |
| Cinematic rate controls | MEDIUM | MEDIUM | P2 |
| Layer loop modes | MEDIUM | LOW | P2 |
| Sequence nesting | MEDIUM | MEDIUM | P2 |
| Procedural FX effects | MEDIUM | HIGH | P2 |
| Dual-quality rendering | MEDIUM | HIGH | P2 |
| Blur system (Dual Kawase / Gaussian) | MEDIUM | HIGH | P2 |
| ProRes/MP4 export | MEDIUM | HIGH | P3 |
| Keyframe animation | MEDIUM | HIGH | P3 |
| Plugin system | LOW | HIGH | P3 |
| AI features | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch — the core loop of import, arrange, FX, preview, export
- P2: Should have, add when possible — features that deepen the workflow
- P3: Nice to have, future consideration — feature expansion after validation

## Competitor Feature Analysis

| Feature | Dragonframe | Stop Motion Studio Pro | After Effects | EFX Motion (Our Approach) |
|---------|-------------|----------------------|---------------|---------------------------|
| Frame capture from camera | Core feature, DSLR tethering | Built-in camera capture | N/A | Not supported — import only |
| Frame-by-frame timeline | X-Sheet + timeline with thumbnails | Basic timeline with zoom | Composition timeline | Timeline with thumbnails + sequence hierarchy |
| Onion skinning | Advanced (configurable overlay) | Basic overlay | Via scripts/plugins | Planned for v1.x |
| Audio sync | Multi-track, waveform, dialogue reading | Basic audio import | Full audio with keyframe sync | Waveform display + beat detection + auto-arrange |
| FX / Compositing | None — export frames only | Basic overlays (green screen) | Full node/layer compositing | Layer-based FX with blend modes — the sweet spot |
| Film grain / vintage FX | None | None | Via plugins/overlays (manual) | Built-in procedural + overlay FX |
| Beat sync | None | None | Via Beatgrid plugin ($) | Native BPM detection + snap + auto-arrange |
| Export format | Image sequence (TIFF/JPEG) | Video (MP4/MOV) | Video or image sequence | PNG image sequence + audio metadata |
| Project format | Proprietary | Proprietary | .aep (proprietary) | .mce (JSON-based, human-readable) |
| Keyboard workflow | Extensive + hardware controller | Basic shortcuts | Extensive shortcuts | Full keyboard-driven workflow |
| Composition templates | None | None | Presets/precomps | Saveable FX stack templates |
| Motion control | DMX + motor integration | None | None | Not supported — different domain |
| Lighting control | DMX 512 channels | None | None | Not supported — different domain |
| Price | $295 (one-time) | $9.99 | $22.99/mo subscription | TBD |

**Key competitive insight:** Dragonframe owns camera-to-timeline. After Effects owns compositing. No product bridges the gap between captured stop-motion frames and cinematic compositing. EFX Motion Editor occupies this gap — it starts where Dragonframe ends (captured frames) and adds what After Effects offers (FX compositing) in a stop-motion-native workflow.

## Sources

- [Dragonframe Software Features](https://www.dragonframe.com/dragonframe-software/) — Industry standard stop-motion feature set (HIGH confidence)
- [Stop Motion Studio Pro - App Store](https://apps.apple.com/us/app/stop-motion-studio-pro/id641564761) — Consumer stop-motion feature baseline (HIGH confidence)
- [Beatgrid - Battle Axe](https://battleaxe.co/beatgrid) — BPM-to-keyframe plugin for After Effects (MEDIUM confidence)
- [Resolume BPM Sync](https://resolume.com/support/en/bpm) — BPM sync patterns in VJ software (MEDIUM confidence)
- [FilmLooks - Old Film Effects](https://filmlooks.com/) — Film grain/vintage FX overlay ecosystem (MEDIUM confidence)
- [11 Stop Motion Animation Software - Webdew](https://www.webdew.com/blog/stop-motion-animation-software) — Market landscape overview (LOW confidence)
- [10 Best Stop-Motion Software - CyberLink](https://www.cyberlink.com/blog/the-top-video-editors/935/best-stop-motion-software-windows-mac) — Competitor comparison (LOW confidence)
- [Premiere Pro History Panel - Adobe](https://helpx.adobe.com/uk/premiere-pro/using/correcting-mistakes.html) — Undo/history standards (HIGH confidence)
- [Final Cut Pro Save/Backup - Apple](https://support.apple.com/guide/final-cut-pro/save-and-back-up-projects-ver79aa3d71/mac) — Autosave standards (HIGH confidence)

---
*Feature research for: Stop-motion cinematic video editor*
*Researched: 2026-03-02*
