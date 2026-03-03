# Feature Landscape: v2.0 Production Tool

**Domain:** Stop-motion cinematic editor -- layer compositing, FX, audio/beat sync, export, editing workflow
**Researched:** 2026-03-03
**Scope:** NEW features only. v1.0 features (import, timeline, playback, project management, sequences) are shipped.

## Table Stakes

Features users expect in a v2.0 production tool. Missing = product feels incomplete for its stated purpose.

| Feature | Why Expected | Complexity | Dependencies on Existing |
|---------|--------------|------------|--------------------------|
| Layer system with compositing | Every visual editor (After Effects, Photoshop, Fusion) has layers. Users need to stack FX overlays on top of their key photo base layer. Without this, the product is a slideshow player. | HIGH | Requires: sequenceStore (layers are per-sequence), timelineStore (layer tracks on timeline), previewScene.tsx (Motion Canvas Img/Rect nodes per layer). layerStore skeleton exists but has no rendering integration. |
| Blend modes (normal, screen, multiply, overlay, add) | Standard compositing vocabulary. Screen mode is essential for light leaks, multiply for grain/dirt, overlay for color grading. Users coming from Photoshop/After Effects expect these by name. | MEDIUM | Motion Canvas Node has `compositeOperation` property that maps to Canvas 2D `globalCompositeOperation`. Nodes must be cached for compositeOperation to take effect. The five modes in `types/layer.ts` map directly to Canvas 2D operations. |
| Layer opacity (0-1) | Fundamental compositing control. Every layer-based tool has an opacity slider. Users need to dial in FX intensity (e.g., 30% grain, 50% vignette). | LOW | Motion Canvas Node has native `opacity` property. Already defined in `Layer` type. PropertiesPanel needs a slider control. |
| Layer transforms (position, scale, rotation, crop) | Standard spatial controls for any compositing system. Users need to position overlays, scale textures to fit, rotate for artistic effect. | MEDIUM | `LayerTransform` type already defined with x, y, scale, rotation, crop fields. Motion Canvas Img node supports position, scale, rotation natively. Crop requires clipping mask or source rectangle. |
| Layer visibility toggle | Every layer panel has an eye icon to toggle visibility. Users need to quickly A/B test with/without specific FX layers. | LOW | `visible` boolean already on `Layer` type. Toggle skips the layer during composition. |
| Layer reorder (drag-and-drop) | Compositing order matters. Screen-mode light leak above vs. below a multiply grain produces different results. Users expect to drag layers to reorder. | LOW | `layerStore.reorder()` already exists. SortableJS is already a dependency. Layer panel UI needs a list with drag handles. |
| Properties panel (context-sensitive) | PropertiesPanel.tsx exists but is empty. When a layer is selected, users expect to see and edit its properties (opacity, blend mode, transform). | MEDIUM | Requires: layerStore.selectedLayerId, layer type to determine which controls to show. Static image layers show transform + blend. FX layers show effect-specific parameters. |
| Undo/redo (100+ levels) | Non-negotiable for any creative tool. Users expect Cmd+Z to undo every destructive action. historyStore exists as a skeleton. | HIGH | historyStore has `stack` and `pointer` signals but no logic. Every store mutation (sequenceStore, layerStore, imageStore) must emit undo/redo entries. The command pattern must wrap all state changes. |
| Keyboard shortcuts | Professional editors are keyboard-driven. Space=play/pause, arrows=step frames, Cmd+Z=undo, Cmd+S=save. Without these, the tool feels amateur. JKL scrubbing is the universal NLE convention (J=rewind, K=stop, L=forward). | MEDIUM | PlaybackEngine has `toggle()`, `stepForward()`, `stepBackward()`. Needs a global keydown listener with modifier detection, a shortcut registry, and conflict resolution. Must follow macOS conventions. |
| PNG image sequence export | This IS the product's output pipeline. PNG sequences are the professional standard for DaVinci Resolve/Premiere Pro handoff. Users expect: choose output directory, set resolution, see progress, get consistently-named files (frame_0001.png). | HIGH | Requires: flattening all layers per frame into a single composited image, rendering at target resolution (not preview resolution), writing files via Tauri Rust backend. Motion Canvas has a built-in image sequence exporter, but it may not suit the custom layer composition model. |
| Audio import with waveform display | Dragonframe and Stop Motion Studio both have audio timeline features. Users composing to music need to see the waveform aligned with their frames to time cuts. | HIGH | PlaybackEngine uses `performance.now()` delta accumulation -- designed for AudioContext master clock sync (noted as PREV-05 readiness). Needs: Web Audio API decode, peak extraction, canvas waveform rendering on timeline, audio playback synced to playhead. |

## Differentiators

Features that set EFX Motion apart. No stop-motion tool offers these. They are the product's reason to exist.

| Feature | Value Proposition | Complexity | Dependencies on Existing |
|---------|-------------------|------------|--------------------------|
| Built-in cinematic FX (grain, scratches, light leaks, vignette, color grade) | **The core differentiator.** Dragonframe has zero compositing. Stop Motion Studio has basic overlays. No stop-motion tool offers real-time cinematic FX baked into the timeline. Users currently do this as a separate step in After Effects/DaVinci Resolve. EFX collapses two workflow stages (capture + grade) into one. | HIGH | Motion Canvas supports CSS-standard filters: `blur()`, `grayscale()`, `hue-rotate()`, `contrast()`, `saturate()`, `brightness()`, `sepia()`. For grain/scratches/light leaks, these are overlay image/video layers with blend modes (screen for light, multiply for dark). Vignette is a radial gradient Rect with multiply. Color grade combines brightness, contrast, saturate, hue-rotate filters. |
| Beat sync with auto-arrange | No stop-motion tool has BPM detection + beat markers + snap-to-beat + auto-arrange frames. This turns music video creation from tedious manual frame-counting into an assisted workflow. VideoProc Vlogger, Canva, and Filmora have auto-beat-marker features -- this is becoming table stakes in video editors but does not exist in stop-motion. | HIGH | web-audio-beat-detector npm package: `guess(audioBuffer)` returns `{ bpm, offset, tempo }`. Algorithm: low-pass filter to isolate kick drum, peak detection, BPM estimation (90-180 BPM range, configurable). Beat markers render on timeline canvas. Auto-arrange: distribute key photos so each occupies N frames per beat (N = fps / (bpm / 60)). Snap modes: every beat, every 2 beats, every bar (4 beats). |
| Audio-driven frame arrangement | Beyond just markers -- automatically spacing key photos to fill beats. "I have 12 photos and a 120 BPM track at 24fps" = each beat is 12 frames, auto-distribute photos across beats. No stop-motion tool calculates this. | MEDIUM | Depends on beat sync. Core calculation: `framesPerBeat = fps * 60 / bpm`. If framesPerBeat=12 and user has 12 photos, each photo holds for 12 frames (one per beat). If 6 photos, each holds 24 frames (every 2 beats). User selects fill strategy (every beat, every 2, every bar). |

## Anti-Features

Features to explicitly NOT build in v2.0. These are scoped out in PROJECT.md for good reason.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Keyframe animation for layer properties | Transforms the product toward After Effects territory. Requires curve editor, interpolation modes, graph editor UI. Enormous complexity for a feature that fights the product's identity as a stop-motion tool, not a motion graphics tool. | Layer properties are static per sequence. If users need animated overlays, they import as video/image-sequence layers. |
| ProRes/MP4 video export | Requires bundling FFmpeg (~80MB), handling codec selection, container formats, audio muxing. DaVinci Resolve does this better. The PNG sequence workflow is actually the professional standard for post-production. | PNG sequence export + audio metadata sidecar JSON (audio file path, offset, duration). Include documentation for DaVinci Resolve/Premiere import. |
| Procedural FX (particles, flash, animated grain) | Each procedural effect is essentially a mini rendering engine. WebGL shader authoring, parameterization, real-time preview -- significant complexity that can be added later once the overlay-based FX system proves valuable. | Ship with image/video overlay-based FX. Users source grain overlays, light leak videos, etc. Built-in FX library can ship pre-made overlay assets. |
| Onion skinning | Useful but not critical for the FX compositing workflow. Dragonframe's onion skinning serves camera capture alignment, which is not this product's workflow. | Defer to a later milestone. The layer compositing system makes it easy to add later (semi-transparent previous/next frame as a special layer). |
| Layer loop modes (loop, mirror, ping-pong) | Nice polish but not blocking. If a grain video is shorter than the sequence, it simply stops. Users can manually duplicate. | Defer. When added, it is a simple playback modifier on video/image-sequence layers: wrap the source frame index with modulo (loop), reflection (ping-pong), or clamp (hold last). |
| Composition templates | Requires stable layer system first. Premature to build save/load templates when the layer format may still change. | Build the layer system, validate it with users, then add template serialization in a later milestone. |
| Sequence nesting | Requires recursive composition, timeline rendering of nested compositions, and complex state management. | Defer. Each sequence is independent for now. Users can export one sequence and import its frames into another if needed. |
| Node-based compositing | Layer-based approach is more intuitive for target users (photographers, not VFX artists). Node graphs have steep learning curves. | Layer panel with blend modes. Simple, familiar, sufficient for overlay compositing. |

## Feature Details

### Layer System

**Expected behavior (informed by After Effects, Photoshop, Motion Canvas capabilities):**

- Layers are per-sequence. Each sequence has its own layer stack.
- Bottom layer is always the base key photo sequence (auto-generated, not user-deletable).
- Users add layers above: static image overlays, image sequence overlays, video layers.
- Layer panel shows stack order with drag-to-reorder. Top layer composites last (on top).
- Each layer has: name, type, visible toggle, opacity slider, blend mode dropdown, transform controls.
- Selected layer shows properties in PropertiesPanel.
- Layers render via Motion Canvas scene graph: each layer = an Img or Rect node with `compositeOperation` and `opacity` set. Parent node must have `cache` enabled for compositeOperation to work.

**Layer types:**
| Type | Source | Behavior |
|------|--------|----------|
| `static-image` | Single image file | Same image overlaid on every frame. Use for: grain texture, vignette mask, color grade LUT. |
| `image-sequence` | Folder of numbered images | Frame-synced overlay. Frame N of sequence = image N of overlay. Use for: animated grain, animated scratches. |
| `video` | Video file (MP4, WebM) | Video plays in sync with sequence playhead. Use for: light leak footage, film burn footage. Video file must be in `public/` folder per Motion Canvas constraint. |

**Blend modes (mapping to Canvas 2D globalCompositeOperation):**
| App Blend Mode | Canvas 2D Operation | Use Case |
|----------------|---------------------|----------|
| Normal | `source-over` | Standard overlay, opacity controls transparency |
| Screen | `screen` | Light leaks, flares (brightens, ignores black) |
| Multiply | `multiply` | Grain, dirt, vignette (darkens, ignores white) |
| Overlay | `overlay` | Color grading, contrast enhancement |
| Add | `lighter` | Bright light effects, lens flare (additive blending) |

### Built-in Cinematic FX

**Implementation approach: FX are pre-configured layer presets, not custom shaders.**

Rather than building a shader pipeline, FX are implemented as convenience presets that create layers with specific settings:

| FX Effect | Implementation | Parameters |
|-----------|---------------|------------|
| Film grain | Static image layer (grain texture) + multiply blend + 20-40% opacity | Intensity (opacity), grain texture selection |
| Dirt/scratches | Image sequence layer (scratch animation) + screen blend + 15-30% opacity | Intensity, scratch pattern selection |
| Light leaks | Video layer (light leak footage) + screen blend + 40-70% opacity | Intensity, leak style selection, position |
| Vignette | Rect node with radial gradient (black edges to transparent center) + multiply blend | Intensity (opacity), size (gradient radius), softness |
| Color grade | Motion Canvas filters on base layer: `brightness()`, `contrast()`, `saturate()`, `hue-rotate()`, `sepia()` | Temperature (hue-rotate), tint (saturate), exposure (brightness), contrast, fade (sepia amount) |

**Why this approach:** Motion Canvas already renders via Canvas 2D with full `globalCompositeOperation` and CSS filter support. No custom WebGL shaders needed. FX assets (grain textures, light leak videos) ship with the app or are user-importable. This is how professional editors actually work -- overlaying real film grain scans, not generating procedural noise.

### Audio Import and Waveform

**Expected behavior (informed by Dragonframe, wavesurfer.js, peaks.js):**

1. **Import:** User imports WAV, MP3, AAC, or OGG via file dialog. Audio file is copied to project directory.
2. **Decode:** Web Audio API `AudioContext.decodeAudioData()` decodes to `AudioBuffer`.
3. **Peak extraction:** Extract peaks from AudioBuffer for waveform rendering. Compute min/max amplitude per pixel at current zoom level. This is a CPU-intensive one-time operation -- cache peaks in project.
4. **Waveform rendering:** Draw peaks on timeline canvas as vertical bars (standard waveform visualization). Render in a dedicated audio track below the frame track. Color-coded (distinct from frame thumbnails).
5. **Playback sync:** PlaybackEngine already uses `performance.now()` delta accumulation, which was designed for AudioContext sync. Replace `performance.now()` master clock with `AudioContext.currentTime` when audio is present. `AudioContext.currentTime` is the only reliable sub-millisecond audio clock in browsers.
6. **Audio controls:** Volume, mute, trim (in/out points), offset (slide audio relative to frame 0).

**Implementation recommendation:** Do NOT use wavesurfer.js or peaks.js. These are full widget libraries with their own UI, transport controls, and DOM management. They would fight with the existing canvas timeline renderer. Instead, use the Web Audio API directly:
- `AudioContext.decodeAudioData()` for decoding
- `AudioBuffer.getChannelData()` for raw PCM samples
- Custom peak extraction (downsample to timeline pixel resolution)
- Render peaks in `TimelineRenderer.ts` alongside frame thumbnails
- `AudioBufferSourceNode` for playback, synced to PlaybackEngine

**Peak extraction algorithm:**
```
samplesPerPixel = totalSamples / timelinePixelWidth
For each pixel column:
  slice = channelData[i * samplesPerPixel .. (i+1) * samplesPerPixel]
  peaks[i] = { min: Math.min(...slice), max: Math.max(...slice) }
```
Cache peaks at multiple zoom levels to avoid recomputation on zoom.

### Beat Sync

**Expected behavior (informed by VideoProc Vlogger, Canva Beat Sync, Filmora Auto Beat Markers):**

1. **BPM detection:** Use `web-audio-beat-detector` npm package. `guess(audioBuffer)` returns `{ bpm, offset, tempo }`. Algorithm isolates kick drum via low-pass filter, detects peaks, estimates BPM. Works best with rhythmic music (EDM, pop, rock). Range: 90-180 BPM by default, configurable via `tempoSettings`.
2. **Beat markers:** Render vertical marker lines on timeline at beat positions. `beatPositionSeconds = offset + (beatIndex * 60 / bpm)`. Convert to frame: `beatFrame = Math.round(beatPositionSeconds * fps)`. Visually distinct from playhead (dashed line, accent color).
3. **Manual beat adjustment:** Users can tap-to-set BPM, nudge offset, add/remove individual markers. Auto-detection is a starting point, not the final word.
4. **Snap modes:**
   - Every beat (1/1): one key photo per beat
   - Every 2 beats (1/2): one key photo per two beats
   - Every bar (1/4): one key photo per four beats (assumes 4/4 time)
   - Every half-beat (2/1): two key photos per beat (fast cuts)
5. **Auto-arrange:** Given N key photos and a snap mode, distribute photos across beat positions. Calculate `holdFrames = framesPerBeat * snapMultiplier`. If more photos than beat slots, warn user. If fewer photos than slots, either loop or leave gaps (user choice).

**Frame-per-beat calculation:**
```
framesPerBeat = fps * 60 / bpm
Example: 24fps, 120 BPM = 24 * 60 / 120 = 12 frames per beat
```

### PNG Image Sequence Export

**Expected behavior (informed by Motion Canvas exporter, professional NLE workflows):**

1. **Output directory:** Tauri `save` dialog to choose export folder. Create subfolder with sequence name.
2. **Resolution options:** Original (match key photo resolution), 1080p (1920x1080), 4K (3840x2160), Custom (user-specified width/height, maintaining aspect ratio).
3. **Naming pattern:** `frame_0001.png`, `frame_0002.png`, etc. Zero-padding width auto-calculated from total frame count (4 digits for < 10000 frames, 5 for more).
4. **Composition pipeline (per frame):**
   a. Create offscreen canvas at target resolution
   b. Draw base key photo (scaled to fit target resolution)
   c. For each visible layer (bottom to top): set `globalCompositeOperation`, set `globalAlpha`, apply transform, draw layer content
   d. `canvas.toBlob('image/png')` (async, non-blocking, avoids data URL memory bloat)
   e. Send blob to Rust backend via IPC for file write
5. **Progress:** Show progress bar (frame X of N), estimated time remaining, cancel button.
6. **Audio metadata sidecar:** Write `audio.json` alongside PNG sequence: `{ "audio_file": "soundtrack.mp3", "sample_rate": 44100, "duration_seconds": 30.5, "offset_frames": 0 }`. This lets DaVinci Resolve users know where to place the audio.

**Performance consideration:** Export is NOT real-time. Each frame is rendered independently at full quality. For a 24fps sequence with 100 key photos averaging 3 frames hold each = 300 frames. At ~50ms per frame composition + write = ~15 seconds total. Acceptable, but show progress UI.

**Rust backend role:** Receive PNG blob via IPC, write to disk using `std::fs::write`. Rust handles file I/O efficiently and respects macOS file system permissions via Tauri's fs plugin.

### Undo/Redo

**Expected behavior (informed by Premiere Pro 32+ levels, After Effects unlimited history):**

The existing `historyStore` has the right shape (`stack: HistoryEntry[]`, `pointer: number`) but no logic. The `HistoryEntry` type has `undo: () => void` and `redo: () => void` callbacks -- this is a command pattern.

**Implementation approach: Command pattern wrapping store mutations.**

Every user-visible state change wraps in a history entry:

| Action | Undo | Redo |
|--------|------|------|
| Add layer | Remove the added layer | Re-add with same ID/properties |
| Remove layer | Re-add with captured properties | Remove again |
| Reorder layers | Reverse the reorder | Repeat the reorder |
| Change layer property | Restore previous value | Apply new value |
| Add key photo | Remove it | Re-add it |
| Change hold duration | Restore previous duration | Apply new duration |
| Reorder key photos | Reverse reorder | Repeat reorder |
| Delete sequence | Re-add with all its data | Delete again |
| Audio trim/offset | Restore previous trim/offset | Apply new trim/offset |
| Beat sync auto-arrange | Restore previous key photo durations | Re-apply auto-arrange |

**Key design decisions:**
- **100+ levels:** Stack size of 100-200 entries. Older entries are discarded (shift off front of array).
- **Branch on new action:** When user undoes 5 steps then makes a new action, discard the 5 "future" entries. The new action becomes the new head. (Standard behavior in all editors.)
- **Coalesce rapid changes:** Slider drags (opacity, position) should NOT create an entry per pixel. Coalesce: start entry on mousedown, commit on mouseup. Use debounce/batch window of ~300ms for keyboard-driven numeric input.
- **Non-undoable actions:** Playback, zoom, pan, UI panel resize, selection changes. These are navigation, not edits.
- **Alternatively, consider `@kvndy/undo-manager`:** This package has first-class Preact Signals support, distinguishing "Undoable" (user data) from "Preservable" (UI state like scroll position). It auto-registers signal changes with an undo stack. This could eliminate manual command wrapping. **LOW confidence** -- needs evaluation against the existing 6-store architecture.

### Keyboard Shortcuts

**Expected behavior (informed by DaVinci Resolve, Final Cut Pro, Premiere Pro conventions):**

| Category | Shortcut | Action | Notes |
|----------|----------|--------|-------|
| **Playback** | Space | Play/Pause toggle | Universal across all NLEs |
| | J | Play backward (1x, press again for 2x, 4x, 8x) | Standard JKL convention |
| | K | Stop/Pause | Standard JKL convention |
| | L | Play forward (1x, press again for 2x, 4x, 8x) | Standard JKL convention |
| | K+J | Slow reverse (hold K, tap J) | DaVinci Resolve convention |
| | K+L | Slow forward (hold K, tap L) | DaVinci Resolve convention |
| **Navigation** | Left Arrow | Step one frame backward | Universal |
| | Right Arrow | Step one frame forward | Universal |
| | Home / Cmd+Left | Go to first frame | Standard |
| | End / Cmd+Right | Go to last frame | Standard |
| | Up Arrow | Previous key photo boundary | Useful for stop-motion (jump between distinct photos) |
| | Down Arrow | Next key photo boundary | Useful for stop-motion |
| **Editing** | Cmd+Z | Undo | macOS standard |
| | Cmd+Shift+Z | Redo | macOS standard |
| | Cmd+S | Save project | macOS standard |
| | Cmd+N | New project | macOS standard |
| | Cmd+O | Open project | macOS standard |
| | Delete/Backspace | Delete selected (layer, key photo) | Standard |
| | Cmd+D | Duplicate selected | Common creative app convention |
| **View** | Cmd+0 | Fit preview to window | Common in visual editors |
| | Cmd+= / Cmd+- | Zoom in / zoom out | macOS standard |
| | ? | Show keyboard shortcuts overlay | Discoverable help |

**Implementation approach:**
- Global `keydown` event listener on `document`.
- Shortcut registry: map of `key + modifiers` to action callbacks.
- Modifier detection: `event.metaKey` (Cmd on macOS), `event.shiftKey`, `event.altKey`.
- Input suppression: do NOT fire shortcuts when user is typing in an input/textarea.
- JKL state machine: track current playback speed (0, 1x, 2x, 4x, 8x forward/backward). J and L increment/decrement speed. K resets to 0.

## Feature Dependencies (v2.0 scope only)

```
[Layer System]
    |-- requires --> sequenceStore (layers are per-sequence)
    |-- requires --> previewScene.tsx refactor (Motion Canvas nodes per layer)
    |-- requires --> PropertiesPanel (layer property editing)
    |-- enables --> FX Effects (FX are specialized layers)
    |-- enables --> PNG Export (export must flatten layers)

[FX Effects]
    |-- requires --> Layer System (FX are layers with presets)
    |-- requires --> Asset management (grain textures, light leak videos ship with app)

[Audio Import + Waveform]
    |-- requires --> TimelineRenderer.ts (waveform track rendering)
    |-- requires --> PlaybackEngine refactor (AudioContext master clock)
    |-- enables --> Beat Sync (needs decoded audio)

[Beat Sync]
    |-- requires --> Audio Import + Waveform (needs AudioBuffer)
    |-- requires --> sequenceStore (auto-arrange modifies hold durations)
    |-- requires --> Timeline canvas (beat marker rendering)

[PNG Export]
    |-- requires --> Layer System (must flatten all layers)
    |-- requires --> Rust backend extension (file write commands)
    |-- requires --> Tauri dialog plugin (output directory selection, already installed)

[Undo/Redo]
    |-- requires --> historyStore completion (logic around existing stack/pointer)
    |-- requires --> All store mutations wrapped in commands
    |-- should ship with --> Every other feature (undo must cover all actions)

[Keyboard Shortcuts]
    |-- requires --> PlaybackEngine (playback shortcuts)
    |-- requires --> historyStore (Cmd+Z/Shift+Cmd+Z)
    |-- requires --> projectStore (Cmd+S/N/O)
    |-- standalone --> Can ship incrementally as features land
```

### Build Order Recommendation

Based on dependencies:

1. **Undo/Redo + Keyboard Shortcuts** -- These are infrastructure. Every subsequent feature benefits from undo coverage and keyboard access. Ship these first so all later features automatically integrate.
2. **Layer System + Properties Panel** -- Foundation for FX and export. The preview must transition from the current `<img>` overlay to Motion Canvas scene graph rendering with multiple nodes.
3. **FX Effects** -- Built on top of the layer system. Pre-configured layer presets with appropriate blend modes and asset bundling.
4. **Audio Import + Waveform** -- Independent of layers. Can be developed in parallel with FX. Refactors PlaybackEngine to use AudioContext.
5. **Beat Sync** -- Requires audio. Adds BPM detection, beat markers, auto-arrange.
6. **PNG Export** -- Requires completed layer system. The composition pipeline must flatten all layers at target resolution. Ship last so it captures the final rendering pipeline.

## MVP Recommendation (v2.0)

**Must have:**
1. Layer system with blend modes, opacity, transforms (the compositing foundation)
2. At least 3 FX presets (grain, vignette, color grade) to prove the cinematic value proposition
3. Audio import with waveform display (core workflow for music-driven stop-motion)
4. PNG sequence export (the output pipeline -- without this, work cannot leave the app)
5. Undo/redo covering all state changes (non-negotiable for creative tools)
6. Core keyboard shortcuts (space, arrows, Cmd+Z/S, delete)

**Can defer to v2.1:**
- Beat sync auto-arrange (valuable but the full BPM detection + auto-arrange is complex; manual frame timing works)
- Light leak and scratch FX (requires video layer support which is more complex than static image layers)
- JKL scrubbing with variable speed (nice polish, not critical for stop-motion workflows where frame-by-frame stepping is more common)
- Keyboard shortcuts overlay (? help screen)

## Sources

- [Dragonframe Software Features](https://www.dragonframe.com/dragonframe-software/) -- Industry standard stop-motion feature set, guide layers, multi-track audio (HIGH confidence)
- [Stop Motion Studio Pro](https://apps.apple.com/us/app/stop-motion-studio-pro/id641564761) -- Layer system, audio track editor, export options (HIGH confidence)
- [Motion Canvas Filters and Effects](https://motioncanvas.io/docs/filters-and-effects/) -- blur, grayscale, hue-rotate, contrast, saturate filters on nodes (HIGH confidence)
- [Motion Canvas Node API](https://motioncanvas.io/api/2d/components/Node/) -- compositeOperation, opacity, cache properties (HIGH confidence)
- [Motion Canvas Image Sequence Export](https://motioncanvas.io/docs/rendering/image-sequence/) -- Built-in PNG/JPEG/WebP export (HIGH confidence)
- [Canvas 2D globalCompositeOperation](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation) -- Blend mode mapping (HIGH confidence)
- [web-audio-beat-detector](https://github.com/chrisguttandin/web-audio-beat-detector) -- analyze()/guess() API, BPM estimation from AudioBuffer (HIGH confidence)
- [Web Audio API Visualizations](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API) -- AnalyserNode, getFloatTimeDomainData for waveform (HIGH confidence)
- [HTMLCanvasElement.toBlob()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob) -- Async PNG export, avoids data URL memory bloat (HIGH confidence)
- [@kvndy/undo-manager](https://www.npmjs.com/package/@kvndy/undo-manager) -- Preact Signals undo/redo with Undoable/Preservable distinction (LOW confidence -- needs evaluation)
- [Tauri 2 Dialog Plugin](https://v2.tauri.app/plugin/dialog/) -- save() for export directory selection (HIGH confidence)
- [Tauri 2 File System Plugin](https://v2.tauri.app/plugin/file-system/) -- File write operations for export (HIGH confidence)
- [JKL Editing Shortcuts](https://www.premiumbeat.com/blog/video-editing-j-k-l-shortcuts/) -- Universal NLE convention (HIGH confidence)
- [Filmic Effects in WebGL](https://medium.com/@mattdesl/filmic-effects-for-webgl-9dab4bc899dc) -- Grain/vignette as overlay + blend mode approach (MEDIUM confidence)
- [Filmora Auto Beat Markers](https://filmora.wondershare.com/ai-efficiency/auto-beat-marker.html) -- Beat marker UX pattern (MEDIUM confidence)
- [VideoProc Vlogger Beat Editing](https://www.videoproc.com/video-editing-software/guide-free-win/edit-to-the-beat.htm) -- Auto-generated beat markers workflow (MEDIUM confidence)

---
*Feature research for: EFX Motion Editor v2.0 Production Tool*
*Researched: 2026-03-03*
