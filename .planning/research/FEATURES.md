# Feature Research: v0.3.0 Audio & Polish

**Domain:** Stop-motion cinematic editor -- audio integration, beat sync, sidebar UX, canvas motion paths
**Researched:** 2026-03-21
**Confidence:** HIGH (Web Audio API, FFmpeg audio muxing, timeline waveform patterns well-documented; motion path patterns well-established in After Effects/Apple Motion)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist once "audio support" is advertised. Missing these = product feels broken or half-baked.

| Feature | Why Expected | Complexity | Dependencies on Existing |
|---------|--------------|------------|--------------------------|
| Audio file import (WAV, MP3, AAC, FLAC) | Every editor that claims audio support accepts common formats. Users drag or open an audio file and it appears on the timeline. Dragonframe, Stop Motion Studio, and iMovie all accept these. | MEDIUM | Tauri file dialog + drag-drop (already built for images). Rust backend reads file, copies to project `audio/` folder. Frontend uses `convertFileSrc()` or `efxasset://` protocol (already established) to get a URL for Web Audio API `decodeAudioData()`. Requires new `audioStore` signal store. New `MceAudioTrack` in project format (version bump to v8). |
| Waveform visualization on timeline | The single most expected audio feature in any timeline-based editor. Premiere Pro, DaVinci Resolve, Kdenlive, and even Canva show waveforms. Users need visual feedback to align frames to audio events. Without waveform, audio is invisible. | HIGH | Requires: Web Audio API `decodeAudioData()` to get `AudioBuffer`, peak extraction by downsampling to ~100-200 peaks per second (not per-sample -- summarize peaks per pixel column for efficiency, as Kdenlive's 2025 waveform rewrite confirmed). Render as a Canvas 2D track row below content/FX tracks in `TimelineRenderer`. Track height ~40-60px. Waveform data cached in `audioStore` to avoid re-decoding. Must respect `timelineStore.zoom` and `timelineStore.scrollX` for synchronized horizontal scroll. |
| Synced audio playback with preview | When user presses Space, audio must play in sync with visual frames. Every NLE and animation tool does this. Unsynchronized audio is worse than no audio. | HIGH | `PlaybackEngine` uses `performance.now()` delta accumulation -- already designed for audio sync readiness (noted as PREV-05 in v0.1.0). Integration: create `AudioContext` + `AudioBufferSourceNode`, start at `currentFrame / fps` offset. On seek, re-start source at new offset. On stop, `source.stop()`. The `PlaybackEngine.tick()` loop is the master clock; audio follows. Alternative: use audio as master clock via `AudioContext.currentTime` and drive `timelineStore.currentFrame` from it -- more accurate but requires refactoring tick loop. Recommend: audio-follows-video approach (simpler, sufficient at 15/24 fps). |
| Audio volume control | Basic gain slider. Every audio feature has a volume knob. Users need to preview at comfortable levels without affecting export. | LOW | `GainNode` in Web Audio API graph. Single `audioStore.volume` signal (0-1). Slider in sidebar or timeline header. Persisted in project file. |
| Audio timeline positioning (offset) | Users need to slide the audio track left/right to align it with their visual content. The audio may not start at frame 0. Premiere, After Effects, and Dragonframe all support this. | MEDIUM | `audioStore.offsetFrames` signal. Waveform rendering shifts by offset. Playback starts audio at `(currentFrame - offsetFrames) / fps`. Negative offset = audio starts before video (silent video lead-in). Drag handle on timeline audio track. |
| Fade in/out on audio | Abrupt audio starts/stops sound amateur. Users expect at minimum a fade-in and fade-out control. Premiere, DaVinci, GarageBand all have this. | MEDIUM | Web Audio API `GainNode.gain.linearRampToValueAtTime()` for playback preview. FFmpeg `-af afade=t=in:d=X,afade=t=out:st=Y:d=Z` for export. Store as `fadeInDuration` and `fadeOutDuration` (in seconds) on the audio track model. Visual handles on waveform edges (triangle overlays). |
| Audio in video export | If the editor has audio import, the exported video must include it. Silent video export when audio is present would be a bug, not a feature. | MEDIUM | FFmpeg already handles video encoding via `exportEncodeVideo()` Rust IPC. Add `-i audioPath -c:a aac -b:a 192k -map 0:v -map 1:a` to FFmpeg command. Audio offset handled with `-itsoffset` flag. Fade in/out handled with `-af afade` filter. Requires extending `exportEncodeVideo()` IPC to accept optional audio parameters. |
| Sidebar scroll in key photos panel | With many key photos (20+), the list overflows. Users expect to scroll through them. `SidebarScrollArea` component already exists and works -- but key photos sub-window needs to use it if not already wired. | LOW | `SidebarScrollArea` component is built with custom 4px thumb (already handles WKWebView scrollbar quirk). Verify it wraps the key photos list. If key photos render inline in the sequences panel, the scroll may already work via the parent scroll area. Likely a wiring check, not new development. |
| Sidebar collapse toggle for sections | Users need to collapse sections they're not using to save space. `CollapsibleSection` component already exists with `collapsed` signal prop and chevron animation. | LOW | `CollapsibleSection` is built. Verify all three sidebar sub-windows (Sequences, Layers, Properties) use it. May need to add collapse state persistence to `appConfig`. |

### Differentiators (Competitive Advantage)

Features that set EFX Motion apart from Dragonframe, Stop Motion Studio, and basic video editors. These are the reason to build v0.3.0.

| Feature | Value Proposition | Complexity | Dependencies on Existing |
|---------|-------------------|------------|--------------------------|
| BPM detection with beat markers on timeline | No stop-motion tool auto-detects BPM and renders beat markers. Users composing to music currently count frames manually. Canva and Filmora have auto-beat-marker features for general video editing, but no stop-motion tool has this. Renders vertical marker lines on the timeline at each detected beat position. | MEDIUM | `web-audio-beat-detector` npm: `guess(audioBuffer)` returns `{ bpm, offset, tempo }`. Algorithm: low-pass filter isolates kick drum, peak detection estimates BPM (90-180 range, configurable). `offset` is time of first beat in seconds. Beat positions: `offset + n * (60/bpm)` converted to frames. Store as `audioStore.beatMarkers: number[]` (frame positions). Render in `TimelineRenderer` as thin vertical lines (distinct color from playhead). |
| Snap-to-beat for key photo boundaries | When dragging key photo hold duration handles, snap to nearest beat marker. Turns frame-counting into a visual alignment task. No stop-motion tool has this. | LOW | Requires beat markers (above). When `holdFrames` drag handle is active, find nearest beat marker frame and snap if within threshold (e.g., 2 frames). Minimal code -- a `findNearestBeat()` utility function applied in `TimelineInteraction` drag handlers. |
| Auto-arrange frames to beats | "I have 12 photos and a 120 BPM track at 24fps" = each beat is 12 frames. Auto-distribute photos so each occupies `framesPerBeat` hold duration. Core calculation: `framesPerBeat = fps * 60 / bpm`. Fill strategies: every beat, every 2 beats, every bar (4 beats). One-click operation. No stop-motion tool calculates this. | MEDIUM | Depends on: BPM detection, beat markers, sequence with key photos. Algorithm: `framesPerBeat = round(fps * 60 / bpm)`. For N photos, compute hold frames per photo based on selected strategy. If "every beat": each photo gets `framesPerBeat` hold. If "every 2 beats": `framesPerBeat * 2`. If "every bar": `framesPerBeat * 4`. Edge case: last photo may need different hold to fill remaining beats. UI: button in sidebar or audio properties panel with strategy dropdown. Applies via `sequenceStore` mutations (undoable). |
| Canvas motion path visualization | After Effects shows position keyframes as a dotted path on the canvas, with diamonds at keyframe positions and dots between them (dot density indicates speed). No stop-motion tool or simple overlay editor has this. Users can see and directly manipulate the spatial animation path. | HIGH | Depends on: existing keyframe system (`keyframeStore`, `keyframeEngine.ts`), existing transform overlay (`TransformOverlay.tsx`), existing canvas coordinate mapper (`coordinateMapper.ts`). Implementation: read all keyframes for the selected layer, extract (x, y) positions, compute interpolated positions between keyframes (reusing `interpolateAt()`), render as a Canvas 2D path overlay. Keyframe diamonds are draggable control points that update `keyframeStore` on drag. Speed visualization via dot spacing (close together = slow, far apart = fast). |
| Motion path keyframe dragging on canvas | Users drag keyframe position diamonds directly on the canvas instead of editing X/Y numbers in the properties panel. After Effects and Apple Motion both support this. Dramatically improves spatial animation workflow. | HIGH | Extension of motion path visualization. Requires: hit-testing keyframe diamonds on the canvas path (similar to existing `hitTestHandles`), drag interaction that updates `keyframeStore` position values, coalescing undo for smooth drag (existing `startCoalescing`/`stopCoalescing` from `history.ts`). The existing `TransformOverlay` already handles pointer capture, drag thresholds, and coordinate mapping -- extend rather than rebuild. |
| Solo mode for sequences AND layers | Sequence isolation (`isolationStore`) already exists for playback. Extending to individual layers within a sequence lets users preview a single layer's contribution. After Effects has layer solo ("S" column). No stop-motion tool has per-layer solo. | MEDIUM | `isolationStore` handles sequence-level isolation. For layer solo: add `soloLayerIds` signal to `isolationStore` (or new signal on `layerStore`). In `PreviewRenderer.render()`, when solo is active, skip non-solo layers. Eye/solo icons in the sidebar layer list (standard After Effects pattern: eye = visibility, speaker-like icon = solo). Solo is temporary preview state (not persisted). |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems or are out of scope for v0.3.0.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Multi-track audio mixing | "I want background music AND sound effects." Professional NLE expectation. | Requires mixer UI, per-track gain, pan, bus routing. Transforms the audio system from a simple soundtrack into a DAW. Enormous complexity for a stop-motion editor. Users who need multi-track mixing already use GarageBand/Logic/Audacity for pre-mix. | Single audio track per project. Users pre-mix in an audio tool. |
| Audio recording / voiceover | "Record narration directly in the editor." Dragonframe has this for on-set reference audio. | Requires microphone permission management, recording UI, level meters, monitoring. The use case (stop-motion to music) does not typically involve voiceover. | Import pre-recorded audio files. |
| Audio waveform editing (cut, trim, splice) | "I want to edit the audio to match my timeline length." | Turns the product into an audio editor. Waveform editing requires region selection, crossfade UI, non-destructive edit stack. The audio is a reference track, not the primary content. | Audio offset + fade in/out covers 90% of needs. Users trim audio in Audacity/GarageBand before import. |
| Real-time beat detection during playback | "Show beats as the music plays, like a visualizer." BeatDetect.js and realtime-bpm-analyzer support this. | Real-time analysis competes with playback rendering for CPU. The BPM result is identical to offline analysis but less accurate (needs accumulation). No benefit over pre-computed markers. | Offline BPM analysis on import. Results cached. Instant beat markers without playback cost. |
| Bezier curve handles on motion path | After Effects shows tangent handles for Bezier spatial interpolation. Users expect them if they see motion paths. | The existing keyframe system uses polynomial cubic easing (`applyEasing()` with `t^3` curves), not per-keyframe Bezier control points. Adding Bezier spatial interpolation would require: per-keyframe tangent storage, cubic Bezier evaluation, tangent handle hit-testing and dragging, tangent break/lock modes. This is a major rework of the interpolation engine for a v0.3.0 polish milestone. | Show motion path as a polyline with easing-based interpolation (dots show speed via existing easing). Keyframe diamonds are draggable for position. The path accurately reflects the actual interpolation curve. Bezier handles can be added in a future milestone if users request them. |
| Audio time-stretch / pitch-shift | "Make the audio match my timeline duration." | Requires DSP time-stretching algorithm (phase vocoder or WSOLA). Web Audio API has `playbackRate` but it changes pitch. Proper time-stretch is a complex DSP problem. | Users adjust audio duration externally or adjust frame hold durations to match audio length. Auto-arrange feature handles the common case of fitting photos to beats. |
| Per-frame audio scrubbing (audio follows playhead in real-time) | After Effects and Premiere play audio "scrub" when dragging the playhead. | At 24fps with frame-by-frame scrubbing, audio snippets are 42ms each -- sounds like clicking noise, not useful audio. Works in video editors because clips are long enough. Stop-motion frames are typically 2-8 frames of hold = 83-333ms, which is borderline. | Audio plays only during normal playback (Space bar). No scrub audio during manual frame stepping or timeline dragging. This is how Dragonframe handles it. |

## Feature Dependencies

```
[Audio file import]
    +--requires--> [audioStore signal store]
    +--requires--> [Project format v8 with MceAudioTrack]
    +--requires--> [Web Audio API decodeAudioData]
    |
    +--enables--> [Waveform visualization]
    |                 +--requires--> [Peak extraction algorithm]
    |                 +--requires--> [TimelineRenderer audio track row]
    |
    +--enables--> [Synced audio playback]
    |                 +--requires--> [AudioContext + AudioBufferSourceNode]
    |                 +--requires--> [PlaybackEngine integration]
    |
    +--enables--> [Audio fade in/out]
    |                 +--requires--> [GainNode scheduling]
    |
    +--enables--> [BPM detection + beat markers]
    |                 +--requires--> [web-audio-beat-detector library]
    |                 +--requires--> [TimelineRenderer marker rendering]
    |                 |
    |                 +--enables--> [Snap-to-beat]
    |                 |                 +--requires--> [TimelineInteraction drag handler modification]
    |                 |
    |                 +--enables--> [Auto-arrange frames to beats]
    |                                   +--requires--> [sequenceStore hold duration mutations]
    |
    +--enables--> [Audio in video export]
                      +--requires--> [FFmpeg command extension with -i audio -c:a aac]
                      +--requires--> [Audio fade filter (-af afade)]

[Canvas motion path]
    +--requires--> [keyframeStore (exists)]
    +--requires--> [keyframeEngine interpolateAt() (exists)]
    +--requires--> [TransformOverlay.tsx (exists)]
    +--requires--> [coordinateMapper.ts (exists)]
    |
    +--enables--> [Motion path keyframe dragging]
                      +--requires--> [Hit-testing keyframe diamonds]
                      +--requires--> [Coalescing undo for drag (exists)]

[Sidebar scroll] --independent-- (low effort, likely already working)

[Sidebar collapse] --independent-- (CollapsibleSection exists)

[Solo mode for layers]
    +--requires--> [isolationStore (exists)]
    +--requires--> [PreviewRenderer layer filtering]
    +--enhances--> [Sidebar layer list with solo icons]
```

### Dependency Notes

- **Audio import is the foundation:** Every audio feature (waveform, playback, beat sync, export) depends on successfully importing and decoding audio. This must be Phase 1.
- **Waveform before beat sync:** Beat markers render on the timeline alongside the waveform. The waveform track must exist before beat markers can be overlaid on it.
- **Synced playback before export:** Audio export is an extension of synced playback -- both need the audio source correctly positioned. Verify sync in preview first.
- **BPM detection enables snap and auto-arrange:** These are lightweight consumers of the beat marker data. BPM detection is the prerequisite.
- **Canvas motion path is fully independent of audio:** No shared dependencies. Can be developed in parallel with audio features.
- **Sidebar enhancements are independent:** Scroll and collapse can be done anytime. Solo mode requires minimal `isolationStore` extension.

## MVP Definition

### Phase 1: Audio Foundation

Minimum audio features needed to validate the integration before building beat sync.

- [ ] Audio file import (WAV, MP3, AAC, FLAC) via file dialog and drag-drop -- validates Tauri file pipeline for audio
- [ ] `audioStore` with audio buffer, waveform peaks, volume, offset, fade durations
- [ ] Waveform visualization as a timeline track row -- validates Canvas 2D integration with timeline
- [ ] Synced playback (audio plays when Space pressed, stops when stopped, seeks correctly) -- validates PlaybackEngine integration
- [ ] Audio volume control (GainNode) -- basic usability
- [ ] Project format v8 with audio track persistence

### Phase 2: Audio Polish + Beat Sync

Features that make audio genuinely useful for the stop-motion-to-music workflow.

- [ ] Audio timeline positioning (drag to offset) -- alignment UX
- [ ] Audio fade in/out -- professional quality
- [ ] BPM detection + beat markers on timeline -- the core differentiator
- [ ] Snap-to-beat for hold duration handles -- lightweight, high value
- [ ] Auto-arrange frames to beats -- the killer feature
- [ ] Audio in video export (FFmpeg muxing) -- completes the pipeline

### Phase 3: Canvas Motion Path + Sidebar Polish

Independent features that can ship in parallel or after audio.

- [ ] Canvas motion path visualization (read-only path display first)
- [ ] Motion path keyframe dragging on canvas
- [ ] Solo mode for layers
- [ ] Sidebar scroll/collapse verification and fixes

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Audio file import | HIGH | MEDIUM | P1 |
| Waveform visualization | HIGH | HIGH | P1 |
| Synced audio playback | HIGH | HIGH | P1 |
| Audio volume control | MEDIUM | LOW | P1 |
| Audio timeline positioning | HIGH | MEDIUM | P2 |
| Audio fade in/out | MEDIUM | MEDIUM | P2 |
| BPM detection + beat markers | HIGH | MEDIUM | P2 |
| Snap-to-beat | HIGH | LOW | P2 |
| Auto-arrange frames to beats | HIGH | MEDIUM | P2 |
| Audio in video export | HIGH | MEDIUM | P2 |
| Canvas motion path visualization | MEDIUM | HIGH | P3 |
| Motion path keyframe dragging | MEDIUM | HIGH | P3 |
| Solo mode for layers | MEDIUM | MEDIUM | P3 |
| Sidebar scroll verification | LOW | LOW | P3 |
| Sidebar collapse persistence | LOW | LOW | P3 |

**Priority key:**
- P1: Audio foundation -- must work before anything else
- P2: Audio polish + beat sync -- the differentiating features
- P3: Visual polish -- independent features, high value but not audio-blocking

## Competitor Feature Analysis

| Feature | Dragonframe 5 | Stop Motion Studio Pro | DaVinci Resolve | Canva Video | Our Approach |
|---------|---------------|----------------------|-----------------|-------------|--------------|
| Audio import | Yes (WAV, MP3) | Yes (MP3, M4A) | Yes (all formats) | Yes (MP3, WAV) | WAV, MP3, AAC, FLAC via Web Audio API decodeAudioData |
| Waveform display | Yes, on timeline | Yes, small | Yes, full | Yes, simplified | Canvas 2D track row on timeline, peak-summarized for performance |
| Audio playback sync | Yes, frame-accurate | Yes, basic | Yes, sample-accurate | Yes, approximate | AudioBufferSourceNode started at frame offset. Audio-follows-video model. Sufficient for 15/24 fps stop-motion. |
| Beat detection | No | No | DaVinci Fairlight has beat detection | Yes (auto-beat sync) | web-audio-beat-detector offline analysis on import |
| Beat markers on timeline | No | No | No (Fairlight is separate panel) | Yes (auto-placed) | Vertical lines on timeline at beat positions |
| Snap to beat | No | No | No | Yes (implicit) | Snap hold-duration handles to nearest beat marker |
| Auto-arrange to beats | No | No | No | Yes (auto-sync clips to beats) | Distribute key photos across beats with strategy selector |
| Audio in export | Yes (with video) | Yes (with video) | Yes (full mixing) | Yes (with video) | FFmpeg muxing with AAC encoding + fade filters |
| Motion path visualization | No (frame-by-frame, no animation) | No | No (not applicable -- video NLE) | No | After Effects-style dotted path on canvas with keyframe diamonds |
| Layer solo | No (no layers) | No (basic layers) | Yes (per-track solo/mute) | No | Solo icon in sidebar layer list, temporary render filter |

## Feature Details

### Audio Import + Waveform

**Expected behavior (informed by Premiere Pro, DaVinci Resolve, Kdenlive):**

- User imports audio via File > Import Audio, drag-and-drop onto timeline, or drag-drop onto app window
- Accepted formats: WAV, MP3, AAC/M4A, FLAC. Web Audio API `decodeAudioData()` handles all of these natively in WebKit/Safari engine (WKWebView on macOS)
- Audio file is copied to project `audio/` directory (same pattern as image import to `images/`)
- Waveform peaks are computed via `AudioBuffer.getChannelData()`: iterate samples, find min/max per chunk (chunk size = total samples / desired peaks count). Store peaks as Float32Array in `audioStore`
- Waveform renders as a dedicated track row in `TimelineRenderer`, below FX tracks. Height: ~48px. Color: semi-transparent blue or green (distinct from playhead red and FX track colors)
- Waveform rendering is pixel-column-based: for each visible pixel column, map to a time range, find the peak amplitude in that range, draw a vertical line from center. This is the standard approach used by BBC peaks.js and Kdenlive's 2025 rewrite
- Mono rendering (mix stereo to mono for display). Most users care about rhythm, not channel separation
- Waveform data is cached after first computation. Re-decode only if audio file changes

**Performance considerations (from Kdenlive rewrite research):**
- Do NOT render all samples -- summarize to peaks per pixel column
- At 48kHz audio with 1000px visible width and 10 seconds visible: ~48 samples per pixel. Simple min/max per column
- Waveform drawing pauses during full-speed playback (`isFullSpeed` flag already exists)
- Pre-compute peaks at multiple zoom levels (mipmap approach) for instant zoom response -- or recompute on zoom (cheap enough for single audio track)

### Synced Audio Playback

**Expected behavior:**

- Press Space: audio starts playing from current playhead position
- Audio plays through `AudioContext` -> `GainNode` (volume) -> `destination`
- On each playback start: create `AudioBufferSourceNode`, set `source.buffer`, call `source.start(0, offsetSeconds)` where `offsetSeconds = (currentFrame - audioOffsetFrames) / fps`
- On stop: `source.stop()`, dispose source node
- On seek (during pause): no audio plays. Audio only plays during active playback
- Sync strategy: **audio-follows-video** (PlaybackEngine remains the master clock). At 15/24 fps, the maximum drift per frame is ~42-67ms, which is imperceptible. If drift accumulates over long playback (minutes), periodically re-sync by checking `AudioContext.currentTime` against expected position
- During shuttle playback (JKL at 2x, 4x speed): audio plays at normal speed (do not pitch-shift). Alternative: mute audio during shuttle. Recommend mute -- pitched audio at 2-4x is unpleasant and unhelpful

### BPM Detection + Beat Sync

**Expected behavior (informed by Canva Beat Sync, web-audio-beat-detector):**

- On audio import (or on-demand button press), run `guess(audioBuffer)` from `web-audio-beat-detector`
- Returns `{ bpm: number, offset: number, tempo: number }`. `bpm` is rounded integer, `offset` is seconds to first beat
- Compute beat positions: `for (let t = offset; t < audioDuration; t += 60/bpm)` -> convert each `t` to frame number: `Math.round(t * fps) + audioOffsetFrames`
- Store as `audioStore.beatMarkers: Signal<number[]>` (frame positions)
- Render in `TimelineRenderer` as thin dashed vertical lines in a distinct color (e.g., gold/amber, `#FFB800`) on both the waveform track and the content track area
- Optional: user can manually adjust BPM if detection is wrong (text input with BPM value, recalculates markers)
- Optional: user can manually shift beat offset (drag first beat marker or numeric input)

**Auto-arrange algorithm:**

```
framesPerBeat = Math.round(fps * 60 / bpm)

Given N key photos and strategy (beat/2-beat/bar):
  multiplier = strategy === 'beat' ? 1 : strategy === '2-beat' ? 2 : 4
  holdPerPhoto = framesPerBeat * multiplier

For each key photo:
  keyPhoto.holdFrames = holdPerPhoto
  (last photo may get adjusted to fill exactly to the audio end or a clean beat boundary)
```

**Snap-to-beat:**

- When user drags a hold-duration handle on the timeline, the target frame snaps to the nearest beat marker if within a threshold (e.g., `snapThreshold = Math.max(2, Math.round(framesPerBeat * 0.15))`)
- Visual indicator: beat marker line thickens or highlights when snap is active
- Snap can be toggled off (hold Cmd/Option during drag, or a toolbar toggle)

### Canvas Motion Path

**Expected behavior (informed by After Effects, Apple Motion):**

- When a layer with 2+ position keyframes is selected, the canvas shows the motion path
- Path is a series of dots connecting keyframe positions, rendered on the `TransformOverlay` canvas
- Keyframe positions shown as diamond shapes (filled, same color as keyframe UI elsewhere)
- Dots between keyframes: computed by evaluating `interpolateAt()` at sub-frame intervals (e.g., every 0.5 frames). Dot spacing reflects speed -- close together = slow (ease-in/out), far apart = fast (linear through middle)
- Path respects canvas zoom/pan via existing `coordinateMapper.ts` coordinate transforms
- Color: semi-transparent white or project accent color, distinct from transform handles

**Keyframe dragging on canvas:**

- Click on a keyframe diamond: select that keyframe in `keyframeStore.selectedKeyframeFrames`
- Drag a keyframe diamond: updates `keyframeStore` position (x, y) for that keyframe
- Uses `startCoalescing()`/`stopCoalescing()` for smooth undo (already built but unwired -- this is a good opportunity to wire it)
- Hit-test radius: ~8px (scaled by canvas zoom, similar to transform handle hit-testing)
- Multi-select: Shift+click to select multiple keyframe diamonds, drag moves all selected

**Rendering approach:**

- Extend `TransformOverlay.tsx` (which already handles transform handles, pointer capture, coordinate mapping)
- The overlay renders after transform handles, so motion path is visible but behind the move/scale/rotate handles
- Only render for the currently selected layer (not all layers simultaneously -- too cluttered)
- Path extends from first keyframe to last keyframe only (no extrapolation beyond)

### Solo Mode for Layers

**Expected behavior (informed by After Effects, DaVinci Resolve):**

- Each layer in the sidebar layer list gets a small solo icon (circle or "S" indicator) next to the visibility eye icon
- Clicking solo: only that layer renders in preview. All other layers are temporarily hidden
- Multiple solo: clicking solo on additional layers adds them to the solo set (like sequence isolation)
- Solo is a preview-only state -- does not affect export, not persisted in project file
- Visual indicator: solo'd layers have highlighted icon, non-solo layers appear dimmed
- Clear all solo: click the solo icon on an already-solo layer, or a "Clear Solo" action

**Implementation:**

- Extend `isolationStore` with `soloLayerIds: Signal<Set<string>>`
- In `PreviewRenderer.render()`, when `soloLayerIds.size > 0`, skip layers not in the set
- Similar pattern to existing `isolatedSequenceIds` for sequences

### Sidebar Enhancements

**Scroll in key photos:**

- `SidebarScrollArea` component already exists with custom 4px thumb
- Verify the key photos list is wrapped in `SidebarScrollArea`
- The inline key photos render inside the Sequences panel's collapsible section
- With 20+ photos at ~32px each = 640px+, overflow is guaranteed. Scroll must work

**Collapse toggle:**

- `CollapsibleSection` exists with signal-driven collapsed state and chevron animation
- Verify all three sidebar sections use it
- Add persistence: save collapsed state per section to `appConfig` so it survives app restart
- Sections: SEQUENCES, LAYERS, PROPERTIES (or FX PROPERTIES for FX layers)

## Sources

- [MDN: Visualizations with Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API) -- waveform data extraction methods
- [MDN: Web Audio API Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) -- AudioBuffer vs MediaElement, gain scheduling
- [BBC waveform-data.js](https://github.com/bbc/waveform-data.js) -- peak extraction and resampling patterns
- [BBC peaks.js](https://github.com/bbc/peaks.js/) -- timeline waveform UI component patterns
- [Kdenlive Audio Waveform Rewrite 2025](https://etiand.re/posts/2025/01/audio-waveforms-in-kdenlive-technical-upgrades-for-speed-precision-and-better-ux/) -- peak-per-pixel rendering, performance optimization
- [web-audio-beat-detector](https://github.com/chrisguttandin/web-audio-beat-detector) -- BPM detection: `analyze()` and `guess()` API
- [Beat Detection Using JavaScript and the Web Audio API](http://joesul.li/van/beat-detection-using-web-audio/) -- algorithm explanation (low-pass filter, peak detection)
- [MDN: AudioParam.linearRampToValueAtTime()](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/linearRampToValueAtTime) -- fade implementation
- [FFmpeg: Merge Audio and Video](https://www.mux.com/articles/merge-audio-and-video-files-with-ffmpeg) -- `-map 0:v -map 1:a -c:a aac` patterns
- [Adobe: Keyframe Interpolation in After Effects](https://helpx.adobe.com/after-effects/using/keyframe-interpolation.html) -- motion path visualization spec
- [Adobe: Assorted Animation Tools](https://helpx.adobe.com/after-effects/using/assorted-animation-tools.html) -- motion path display options, dot density = speed
- [Apple Motion: Modify Animation Paths](https://support.apple.com/guide/motion/modify-animation-paths-motn14748beb/mac) -- motion path interaction patterns
- [Canva Beat Sync](https://www.canva.com/features/beat-sync/) -- auto-sync clips to rhythm UX reference
- [Tauri File System Plugin](https://v2.tauri.app/plugin/file-system/) -- file access patterns for audio import
- [Building a Music Player with Tauri + Svelte](https://slavbasharov.com/blog/building-music-player-tauri-svelte) -- `convertFileSrc()` for audio file URLs

---
*Feature research for: EFX Motion Editor v0.3.0 Audio & Polish*
*Researched: 2026-03-21*
