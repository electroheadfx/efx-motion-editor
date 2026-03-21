# Pitfalls Research

**Domain:** v0.3.0 Audio, Beat Sync, Motion Paths, and Sidebar Polish for desktop stop-motion cinematic editor (Tauri 2.0 + Preact Signals + Canvas 2D)
**Researched:** 2026-03-21
**Confidence:** MEDIUM-HIGH
**Focus:** Common mistakes when adding audio playback/sync, beat detection, canvas motion paths, and sidebar enhancements to the existing v0.2.0 codebase with rAF PlaybackEngine, Canvas 2D PreviewRenderer, FFmpeg export pipeline, and polynomial cubic keyframe interpolation

## Critical Pitfalls

### Pitfall 1: Two Clocks -- PlaybackEngine rAF Accumulator Drifts From AudioContext.currentTime

**What goes wrong:**
The existing PlaybackEngine uses `performance.now()` delta accumulation to advance frames at project fps. Adding audio playback via Web Audio API introduces a second clock: `AudioContext.currentTime`. These two clocks drift apart. The audio hardware clock runs on a crystal oscillator independent of the system clock. Over 30 seconds of playback at 24fps, drift of 1-3 frames is common (16-50ms). Users see key photos change slightly before or after the beat they were synced to. The drift is subtle but cumulative -- by 2 minutes, audio and video are visibly out of sync. This is the single most architecturally impactful pitfall because the PlaybackEngine is the timing foundation for everything.

**Why it happens:**
`performance.now()` measures system monotonic time. `AudioContext.currentTime` measures time in the audio rendering thread, which runs at a sample rate (44.1kHz or 48kHz) on dedicated hardware. These are different clock domains with independent oscillators. The existing PlaybackEngine accumulates deltas: `this.accumulator += delta; while (accumulator >= frameDuration) { advance(); accumulator -= frameDuration; }`. This works fine without audio but creates an independent time reference that will inevitably diverge from the audio clock. The danger is that both clocks report similar-looking values (both in milliseconds/seconds) so the divergence is not obvious during development with short test clips.

**How to avoid:**
- Make `AudioContext.currentTime` the master clock when audio is loaded. The rAF tick should read `audioContext.currentTime`, multiply by fps, and set the frame number directly: `frame = Math.floor(audioContext.currentTime * fps)`. No accumulator. No delta. The frame number is a pure function of audio time.
- When no audio is loaded, keep the existing `performance.now()` accumulator as the fallback clock. This preserves current behavior for audio-free projects.
- Abstract this behind a `ClockSource` interface: `getCurrentTime(): number` (in seconds). The PlaybackEngine switches between `AudioClockSource` and `SystemClockSource` based on whether audio is active.
- Never try to "correct drift" by comparing two clocks and nudging. Drift correction approaches are fragile and add complexity. Use one authoritative clock, period.
- Account for `AudioContext.outputLatency` when deriving frame number. Audio reaches speakers `outputLatency` seconds after `currentTime` advances. For headphone/speaker output this is 5-20ms (negligible at 15-24fps). For Bluetooth, it can be 100-300ms (4-7 frames at 24fps). Whether to compensate depends on user expectations -- visual-leads-audio is usually acceptable for editing.

**Warning signs:**
- Beat markers on timeline drift from audible beats during playback
- Audio and frame change are in sync for the first 5 seconds but visibly off by 30 seconds
- Playback feels "laggy" -- frame changes trail behind audio events
- Stopping and restarting playback resets the drift (confirming it is cumulative)

**Phase to address:**
Audio playback phase -- this must be the first architectural decision, before any audio playback code. The PlaybackEngine refactor to support dual clock sources is a prerequisite for all audio features.

---

### Pitfall 2: AudioContext Suspended State in WKWebView After Focus Loss and App Backgrounding

**What goes wrong:**
WebKit's WKWebView (used by Tauri on macOS) enforces autoplay policy: an `AudioContext` starts in `suspended` state and can only be resumed by a user gesture. Even after initial resume, the AudioContext gets re-suspended when: (a) the user switches to another app (focus loss), (b) macOS puts the webview to sleep (Energy Saver), (c) the user clicks a native Tauri dialog (File > Open). After re-suspend, calling `audioContext.resume()` requires being inside a user gesture handler. The app silently loses audio playback with no error -- the AudioContext reports `state: 'suspended'` but nothing throws. Users press Space to play, see frames advancing, but hear nothing.

**Why it happens:**
WebKit bug 237878 documents that AudioContext is suspended on iOS/macOS when the page is backgrounded. Unlike Chrome which auto-resumes on focus, WebKit requires explicit resume within a user gesture. Tauri's native dialogs (file picker, save dialog) transfer focus to the native layer, triggering WKWebView background detection. The `statechange` event fires on the AudioContext but only tells you the state changed -- it does not auto-resume. Additionally, Tauri 2.0's `tauri://focus` event fires when the window regains focus, but the AudioContext resume must happen inside a user-initiated event, not an OS-level focus event.

**How to avoid:**
- Create exactly one `AudioContext` as a lazy singleton. Initialize it on the first user-triggered play action (click or keypress handler).
- On EVERY play/resume action, always call `audioContext.resume()` regardless of current state. `resume()` is a no-op if already running, so calling it defensively costs nothing.
- Listen for `audioContext.onstatechange`. When state becomes `'suspended'` or `'interrupted'`, set a flag. On the next user gesture (Space key, play button click), call `resume()` before starting playback.
- Do NOT attempt to auto-resume in a Tauri focus event handler. WebKit will reject the resume if there is no active user gesture. Instead, show a subtle UI indicator ("Audio paused -- press Space to resume") so the user knows to interact.
- For `OfflineAudioContext` (used for waveform generation and BPM detection), autoplay policy does not apply. It can be created and started without a user gesture. Do not conflate the two context types.

**Warning signs:**
- Console warning: "An AudioContext was prevented from starting automatically"
- Audio plays once, user switches to Finder, switches back, presses Space -- frames advance but no audio
- Audio analysis (waveform/BPM) works but live playback fails (OfflineAudioContext vs AudioContext confusion)
- Audio works in dev (Chrome DevTools) but fails in production Tauri build (WKWebView)

**Phase to address:**
Audio playback phase -- the singleton AudioContext with defensive resume pattern must be the first thing implemented, before any playback logic.

---

### Pitfall 3: Waveform Rendering Blocks Main Thread for Large Audio Files

**What goes wrong:**
Generating a waveform visualization requires decoding the entire audio file into PCM samples, then computing amplitude peaks for each pixel column of the timeline. For a 5-minute WAV at 48kHz stereo, that is 28.8 million samples. `AudioContext.decodeAudioData()` runs asynchronously but still uses significant main-thread time for the final buffer allocation. `OfflineAudioContext.startRendering()` is worse -- it allocates the entire decoded buffer as a single `AudioBuffer` (a 5-minute, 48kHz stereo file = ~110MB of Float32 data). The UI freezes during decoding, and if the user has multiple audio tracks, memory can spike to 500MB+.

**Why it happens:**
The Web Audio API was designed for short audio clips (sound effects, musical notes), not multi-minute songs. `decodeAudioData` must decode the entire file before returning the AudioBuffer -- there is no streaming decode API. The resulting AudioBuffer holds uncompressed PCM data in memory for the entire duration. A 3MB MP3 becomes a 110MB Float32Array when decoded. Developers who test with 10-second clips never encounter this. The OfflineAudioContext issue (GitHub WebAudio/web-audio-api#2445) documents that `startRendering()` unconditionally creates a full-length AudioBuffer regardless of whether you need all of it.

**How to avoid:**
- Decode audio in Rust, not in the browser. Use a Rust crate like `symphonia` to decode audio files. Compute waveform peaks in Rust by reading PCM data in chunks and computing min/max per time window. Send only the pre-computed peak data (a few KB) to the frontend via IPC. This avoids the entire Web Audio decode-to-buffer-in-memory problem.
- If Rust-side decode is not feasible initially, use `decodeAudioData` but immediately extract peaks and release the AudioBuffer. Do NOT hold the decoded buffer in memory for the lifetime of the project. Compute peaks, store them as a compact Float32Array (one min + one max per pixel), then let the AudioBuffer be garbage collected.
- For waveform display at different zoom levels, pre-compute peaks at 3-4 resolutions (overview, 1/4, 1/16, 1/64) during initial analysis. Cache these. On zoom/scroll, read from the appropriate pre-computed level rather than resampling the raw PCM.
- Show a progress indicator during audio import with "Generating waveform..." text. Use `requestIdleCallback` or `setTimeout(0)` to yield between peak computation chunks to keep the UI responsive.
- Set a maximum audio file size limit (e.g., 200MB) with a user-visible warning for files that will consume excessive memory.

**Warning signs:**
- UI freezes for 2-10 seconds when importing a long audio file
- Memory jumps by 100MB+ when an audio file is imported
- Switching projects with audio does not free memory (decoded AudioBuffer retained)
- Waveform display is blank until the full file is decoded (no progressive rendering)

**Phase to address:**
Audio import/waveform phase -- the Rust-side decode approach should be investigated first. If that is chosen, the waveform peak computation never touches the main thread at all.

---

### Pitfall 4: Audio Export Requires Fundamental FFmpeg Pipeline Restructuring

**What goes wrong:**
The existing FFmpeg video export pipeline (ffmpeg.rs `encode_video`) explicitly passes `-an` (no audio) and encodes from a PNG image sequence. Adding audio to video export is not a matter of removing `-an` and adding an audio input. The current pipeline is: render frames -> write PNGs -> call FFmpeg once with PNG glob input -> get video. Adding audio requires either: (a) a two-pass approach (encode video, then mux audio), or (b) restructuring to pass audio as a second input to the same FFmpeg command. Option (b) is cleaner but requires changes to the Rust command builder, the IPC contract, and handling audio format conversion (the source audio may be WAV/MP3/AAC while the output container expects specific codecs).

**Why it happens:**
The original export architecture was intentionally designed without audio (v0.2.0 D-15 spec: "No audio track"). The FFmpeg command is built as a single invocation in Rust with hardcoded arguments. There is no abstraction for "input sources" or "output streams" -- it is a monolithic command string builder. Adding audio as a second `-i` input requires knowing: the audio file path (passed from frontend), the audio codec for the output container (AAC for MP4, PCM for ProRes MOV), any audio start offset (if audio does not start at frame 0), and fade in/out trim. The temptation is to bolt this onto the existing `encode_video` function with 5 more parameters, making it unmaintainable.

**How to avoid:**
- Restructure the FFmpeg command builder as a proper abstraction: `FfmpegCommand` with methods like `.add_video_input()`, `.add_audio_input()`, `.set_codec()`, `.set_output()`. This future-proofs for multi-audio-track scenarios.
- Use a two-step approach for reliability: (1) encode video from PNGs exactly as today (proven pipeline), (2) mux the audio track into the video file using `ffmpeg -i video.mp4 -i audio.wav -c:v copy -c:a aac output_final.mp4`. The `-c:v copy` avoids re-encoding video, making the mux step near-instant. This is simpler and keeps the proven video pipeline unchanged.
- Handle audio format negotiation: ProRes MOV containers should use PCM audio (`-c:a pcm_s16le`), MP4 containers should use AAC (`-c:a aac -b:a 192k`). Never assume the source audio codec is compatible with the output container.
- Handle audio duration vs video duration: if audio is longer than video, add `-shortest` flag. If audio has a timeline offset (does not start at frame 0), compute the offset in seconds and use `-itsoffset` on the audio input.
- Pass audio fade in/out as FFmpeg audio filters: `-af "afade=t=in:d=1,afade=t=out:st=29:d=1"` rather than trying to pre-process the audio in the browser.

**Warning signs:**
- Video export works but produced file has no audio
- Audio in exported video starts at wrong time (offset not applied)
- ProRes export with audio produces "codec not supported" error (wrong audio codec for MOV container)
- Export with audio takes twice as long as expected (video being re-encoded during mux)

**Phase to address:**
Audio in video export phase -- this should be a separate phase from audio playback, done after audio import/playback is working. The two-step encode-then-mux approach minimizes risk to the proven video pipeline.

---

### Pitfall 5: Beat Detection Produces Halved/Doubled BPM and Genre-Dependent Failures

**What goes wrong:**
BPM detection algorithms frequently return half or double the actual tempo. A 140 BPM drum-and-bass track gets detected as 70 BPM (octave error). A 60 BPM ambient piece gets detected as 120 BPM because the algorithm locks onto harmonic overtones rather than the fundamental beat. Swing and syncopated rhythms produce erratic BPM values. The user places key photos on "beat markers" that are at half the actual tempo, resulting in a stop-motion rhythm that feels sluggish. Worse, if auto-arrange snaps key photo durations to beat intervals, wrong BPM means every photo is held for exactly double or half the intended time -- a project-wide error.

**Why it happens:**
Most beat detection algorithms (including `web-audio-beat-detector` and spectral flux approaches) work by finding periodicity in energy peaks. A strong snare on beats 2 and 4 of a 4/4 pattern creates energy peaks at half the bar rate, leading to half-BPM detection. Complex genres (jazz, ambient, electronic with heavy syncopation) lack the consistent energy transients that detection algorithms expect. The algorithm confidence score (if any) is rarely surfaced to the user, so they trust a low-confidence detection as authoritative. Additionally, embedded BPM metadata in audio files (ID3 tags) is frequently wrong -- tags from music libraries, DJ software, or incorrectly exported files contain stale or incorrect values.

**How to avoid:**
- Always present detected BPM as editable, with x2 and /2 buttons next to the BPM display. Make it trivially easy for the user to correct octave errors. This is what professional DJ software (Traktor, Rekordbox) does.
- Display a confidence score with the detected BPM. Use color coding: green (high confidence, strong periodic signal), yellow (medium, ambiguous), red (low, fallback). When confidence is low, prominently suggest manual BPM entry.
- Use a constrained BPM range. For stop-motion work, reasonable BPM range is 40-200. If detection returns <40 or >200, halve or double to bring into range. Offer "Tap Tempo" as a manual alternative.
- Analyze only the first 30 seconds of audio for BPM. This is sufficient for tempo detection and avoids the memory/performance issues of full-file analysis. Most BPM detection libraries support this.
- Do NOT auto-arrange key photos immediately on BPM detection. Show the beat markers on the timeline first. Let the user verify they align with audible beats. Only then offer an "Auto-arrange to beats" action (with undo support).
- Never trust embedded audio metadata BPM tags. Always run detection or require manual entry. Metadata should be treated as a "suggestion" at most.

**Warning signs:**
- Beat markers on timeline are visually at half the rate of audible beats
- Auto-arrange produces key photo durations that "feel wrong" to the user
- Detection returns different BPM for the same file on repeated runs (nondeterministic)
- Detection works for pop/rock but fails for ambient/electronic music

**Phase to address:**
Beat sync phase -- the x2/divider/2 controls and confidence display must ship alongside detection. Never ship detection without user correction affordances.

---

### Pitfall 6: Canvas Motion Path Rendering Conflicts with Existing Transform Pipeline

**What goes wrong:**
The existing keyframe interpolation system interpolates `x`, `y`, `scaleX`, `scaleY`, `rotation`, and `blur` between keyframes using polynomial cubic easing. These interpolated values are applied as Canvas 2D transforms in `PreviewRenderer.drawLayer()`. An After Effects-style motion path visualizes the interpolated position trajectory as a curved path on the canvas overlay. The pitfall is that motion path rendering must use the SAME interpolation math as the actual rendering, or the path does not match the actual motion. If the motion path draws a Bezier curve approximation while the actual interpolation uses polynomial cubic easing, the path and the actual motion diverge visually. The user drags a keyframe control point on the path, but the layer does not follow the drawn curve.

**Why it happens:**
After Effects motion paths are Bezier splines -- the path shape IS the interpolation function. But the existing EFX-Motion keyframe system uses polynomial cubic easing between keyframes, where easing affects the RATE of travel (slow-in, slow-out) but the spatial path between two positions is always a straight line in x,y space. This is a fundamental architectural difference. AE-style curved spatial paths require a different interpolation model (Bezier control points per spatial keyframe) rather than independent easing per property. Developers may implement the visual path as a Bezier curve without realizing the actual interpolation produces a straight-line path with eased timing.

**How to avoid:**
- Start with visualizing the ACTUAL interpolated path, not an idealized Bezier. Sample the `interpolateAt()` function at 1-frame intervals between keyframes and draw `lineTo()` segments connecting the samples. This always matches actual motion by construction, because it IS the actual motion.
- Render dots at each frame position along the path. Spacing between dots reveals easing: clustered dots = slow motion, spread dots = fast motion. This is the AE-style "roving keyframe" visualization.
- For curved spatial paths (true AE-style), this would require adding Bezier control points to the `Keyframe` type and changing `interpolateAt()` to use Bezier interpolation for x,y. This is a v0.4.0+ feature. For v0.3.0, straight-line paths with easing visualization are the correct scope.
- Render the motion path on a SEPARATE overlay canvas (or in the same canvas but in a distinct rendering pass after `renderGlobalFrame` completes). Do NOT mix path visualization with the compositing pipeline. The path is a UI overlay, not part of the rendered output.
- Use `Path2D` objects for the motion path to avoid rebuilding the path geometry every frame. Only rebuild when keyframes change.

**Warning signs:**
- Motion path curve does not match actual layer movement during playback
- Dragging a path control point moves the layer in an unexpected direction
- Path visualization jitters or flickers during playback (rendering in the wrong pipeline stage)
- Motion path appears in exported video (leaked into compositing pipeline)

**Phase to address:**
Canvas motion path phase -- the "sample interpolateAt()" approach must be chosen explicitly. Do NOT start by drawing Bezier curves.

---

### Pitfall 7: Audio Playback Does Not Respect Isolation Mode, Loop Boundaries, or Shuttle Speed

**What goes wrong:**
The existing PlaybackEngine has sophisticated logic for isolation mode (playing only isolated sequences), loop boundaries (wrapping at sequence edges), and JKL shuttle (variable speed/direction). Adding audio playback means the audio source must also respect all of these modes. If the user isolates a sequence that spans frames 50-120 (2.9 seconds at 24fps), audio must play only the corresponding 2.9-second window and loop back. If the user shuttles at 2x speed, audio must play at 2x pitch or be muted. If the user reverses playback, audio must either play in reverse or be muted. Implementing audio playback that only works in normal-forward-full-timeline mode and breaks in isolation/loop/shuttle is a common "looks done but isn't" failure.

**Why it happens:**
Audio playback is typically implemented as: create AudioBufferSourceNode, set `source.start(0)`, let it play. This plays the entire audio file from the beginning at 1x speed, forward only. The PlaybackEngine's isolation/loop/shuttle logic is in the rAF tick function and operates on frame numbers. There is no mechanism to communicate these constraints to the audio playback layer. The AudioBufferSourceNode API has `start(when, offset, duration)` for constrained playback and `playbackRate` for speed, but reverse playback is not natively supported (requires pre-reversing the buffer or using `playbackRate = -1` which only works in some browsers). The complexity of keeping audio in sync across all playback modes is the reason most editors defer audio to a later milestone.

**How to avoid:**
- Design the audio playback abstraction with all modes from day one, even if some are initially muted. Define the interface: `AudioPlayer.play(startTimeSec, endTimeSec, speed, direction)`. If reverse or high-speed playback is too complex, explicitly mute audio in those modes (this is what most NLEs do -- scrubbing and shuttle mute audio).
- For isolation mode: compute the audio time window from the isolated frame range. `audioStart = isolatedStartFrame / fps`. `audioEnd = isolatedEndFrame / fps`. Use `source.start(0, audioStart, audioEnd - audioStart)`.
- For looping: do NOT use `AudioBufferSourceNode.loop = true` because its loop boundaries are buffer-relative, not timeline-relative. Instead, detect loop wrap in the PlaybackEngine tick and restart audio playback from the loop start point.
- For shuttle speed: set `AudioBufferSourceNode.playbackRate.value = shuttleSpeed`. This changes both speed and pitch. Pitch-preserving speed changes require AudioWorklet (complex, defer to later).
- For reverse playback: mute audio. Display a small "audio muted (reverse)" indicator. This is the pragmatic choice.
- Critical: when the PlaybackEngine stops/pauses, the AudioBufferSourceNode must be stopped immediately. AudioBufferSourceNodes are one-shot -- once stopped, they cannot be restarted. Create a new node for each play session.

**Warning signs:**
- Audio keeps playing after playback stops (node not stopped)
- Audio restarts from the beginning when looping (not from loop point)
- Audio plays at normal speed during 2x shuttle (speed not applied)
- Audio plays during reverse shuttle (should be muted)
- Isolation mode plays audio from timeline start, not from isolated segment start

**Phase to address:**
Audio playback phase -- the AudioPlayer abstraction with explicit mode handling must be designed before implementation. Muting for unsupported modes (reverse) is an acceptable initial scope.

---

### Pitfall 8: Audio State Not Persisted in .mce Project Format

**What goes wrong:**
The existing .mce project format (v7) has no schema for audio tracks. Audio import requires adding: audio file reference (path, similar to image references), timeline position (start frame offset), audio trim (in/out points within the audio file), volume level, fade in/out durations, and waveform peak cache. If the project format is not versioned up (to v8) with a proper migration path, users who add audio to a project, save, and reopen get a project with no audio. Or worse, a v8 project is opened in a hypothetical older version and the audio data is silently dropped, corrupting the project on next save.

**Why it happens:**
The .mce format uses progressive versioning (v1 through v7) with backward compatibility migrations. Each version migration function handles upgrading older formats. Adding audio is a schema change that requires a new version. The existing migration pattern in `projectStore` (or wherever `.mce` is loaded) must be extended. Developers often add audio state to the runtime types but forget to add serialization/deserialization, or add serialization but forget to increment the version number, or increment the version but forget to write the migration function for v7->v8.

**How to avoid:**
- Increment .mce format to v8 at the start of audio work. Define the `MceAudioTrack` schema in `types/project.ts` before implementing any audio features. This forces the serialization contract to be designed upfront.
- Add audio tracks to `MceProject` as a new optional field: `audio_tracks?: MceAudioTrack[]`. Optional field means v7 files load fine (no audio), and v8 files saved by this version include audio data.
- Store audio file references the same way images are stored: relative path within project directory, with an `id` for referencing from other structures.
- Store pre-computed waveform peaks in the .mce file (or a sidecar `.peaks` file) to avoid re-decoding audio on every project load. Peaks are small (~50KB for a 5-minute song at reasonable resolution).
- Write the v7->v8 migration function immediately: it simply adds `audio_tracks: []` to the project. Test loading a v7 project and verifying no data loss.
- Add audio file paths to the project file copy/move logic (if the project directory is relocated, audio paths must update like image paths do).

**Warning signs:**
- Audio works during editing but is gone after save/reopen
- Opening an older project after adding audio code causes a parse error
- Audio file not found after moving the project folder to a different location
- Waveform regenerated from scratch every time the project is opened (peaks not cached)

**Phase to address:**
Audio import phase -- the .mce v8 schema and migration must be the literal first implementation task, before any audio import UI.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Decoding audio entirely in the browser via Web Audio API | No Rust-side audio library dependency | Main thread blocked for large files, 100MB+ memory per decoded file, no streaming | Only for files <30 seconds during prototyping; migrate to Rust decode for production |
| Using `setTimeout` to poll audio position instead of deriving frame from `audioContext.currentTime` | Simpler code, avoids PlaybackEngine refactor | Introduces a third timing mechanism, polling interval creates jitter, sync impossible | Never -- audio clock must drive frame position |
| Storing full waveform PCM in memory for the project lifetime | Simple access for waveform re-rendering at any zoom | 110MB+ per 5-minute track, no GC until project close, OOM risk with multiple tracks | Never -- compute peaks and discard PCM buffer |
| Hardcoding audio codec to AAC for all export containers | Simpler FFmpeg command, one codec path | ProRes MOV with AAC sounds worse than PCM, certain DAWs reject AAC in MOV | Never -- match audio codec to container (PCM for MOV, AAC for MP4) |
| Drawing motion path by connecting keyframe positions with straight lines | Correct for current linear spatial interpolation, easy to implement | When/if Bezier spatial interpolation is added later, the visualization is wrong | Acceptable for v0.3.0 because the interpolation IS linear spatial; but document this coupling |
| Skipping undo support for audio operations | Faster feature delivery | User cannot undo audio import, trim, volume changes; feels incomplete | Only for audio import (destructive file operation); all audio property changes MUST support undo |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| AudioContext.currentTime + PlaybackEngine rAF | Running two independent clocks and comparing them to detect drift | Use AudioContext.currentTime as sole time source when audio loaded. Derive frame number: `frame = Math.floor(audioTime * fps)`. No accumulator. |
| AudioBufferSourceNode + PlaybackEngine stop/start | Trying to pause and resume an AudioBufferSourceNode (they are one-shot, cannot restart after stop) | Create a new AudioBufferSourceNode for each play session. Track playback offset. On pause, record `offset = audioContext.currentTime - startTime`. On resume, create new node with `source.start(0, offset)`. |
| FFmpeg audio mux + existing PNG pipeline | Modifying the existing `encode_video` function to accept audio parameters (6+ new params, unmaintainable) | Two-step: encode video (existing proven path), then mux audio as separate FFmpeg invocation with `-c:v copy`. Video is never re-encoded. |
| Waveform peaks + timeline Canvas 2D | Recomputing peaks from raw audio data on every timeline scroll/zoom | Pre-compute peaks at multiple resolutions (mipmap style). Store as Float32Array. On scroll/zoom, slice the appropriate pre-computed array for the visible region. |
| Audio file + .mce project save | Storing absolute audio file path in project format | Store relative path (same as images). Copy audio file into project directory on import. Reference by ID, not path. |
| OfflineAudioContext + AudioContext | Using the playback AudioContext for analysis (decoding/BPM), blocking real-time playback | Use OfflineAudioContext for all analysis work. It runs without autoplay restrictions, on a separate thread, and does not interfere with the playback AudioContext. |
| Motion path overlay + PreviewRenderer | Drawing motion path inside `renderFrame()`, causing path to appear in exports | Render motion path in a SEPARATE pass on the preview canvas, AFTER `renderGlobalFrame()` completes. Gate behind a `showMotionPath` UI toggle. Export code must NOT call the path rendering function. |
| Audio playback + isolation mode | Playing audio from timeline position 0 regardless of isolated sequence range | Compute audio start time from isolated frame range: `audioOffset = isolatedStartFrame / fps`. Pass offset to AudioBufferSourceNode `start()`. |
| Beat markers + undo system | Making beat markers ephemeral (not persisted, not undoable) | Beat markers are derived data (BPM + offset + audio start time = marker positions). Store BPM and offset in the audio track data model. Markers are computed, not stored. BPM changes should be undoable. |
| Sidebar scroll + SortableJS | Adding CSS `overflow-y: auto` to the key photos container while SortableJS `forceFallback: true` drag is active | SortableJS fallback drag uses CSS transforms on a clone element. If the scrollable container clips the clone, the drag ghost disappears mid-drag. Set `overflow: visible` on the container during active drag, restore after. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Waveform redrawn from raw peaks on every timeline scroll | Timeline scrolling becomes janky (>16ms per frame) when audio loaded | Pre-render waveform to an offscreen canvas at the full timeline width. On scroll, drawImage the visible portion. Only re-render offscreen canvas on zoom change. | Audio files >30 seconds at any zoom level |
| AudioBufferSourceNode created per frame for scrubbing | Clicking/dragging playhead creates hundreds of source nodes per second, each holding buffer reference | For scrubbing (non-playing), do NOT create AudioBufferSourceNodes. Either mute audio during scrub, or use a single `AudioBufferSourceNode` with `currentTime` seeking (not possible -- nodes are one-shot). Use `HTMLAudioElement` for scrub preview instead. | Any scrubbing interaction with audio loaded |
| Motion path sampled at every frame on every render | Path visualization recomputes interpolation for all frames between all keyframes every rAF tick | Cache path geometry as a `Path2D` object. Invalidate only when keyframes change (add/remove/move/edit). During playback, only update the "current position" dot, not the full path. | >3 keyframes with >100 frames between them |
| BPM detection on main thread | UI freezes for 3-10 seconds during beat analysis | Run detection in a Web Worker or via Rust-side DSP. For web-audio-beat-detector library, it uses OfflineAudioContext which runs off main thread, but the final buffer allocation and peak finding still touches main thread. | Audio files >2 minutes |
| Decoded AudioBuffer retained for entire session | Memory climbs by 50-200MB per audio file imported | After computing waveform peaks and storing the buffer reference for playback, consider whether the full decoded buffer is needed. For playback, an HTMLAudioElement is more memory-efficient than holding a decoded AudioBuffer. Only decode to AudioBuffer when analysis (BPM) is needed, then release. | Projects with multiple audio tracks |
| Per-frame audio position logging for debug | Console.log of audio time per rAF tick (60 calls/sec) creates thousands of log entries | Use conditional logging gated behind a debug flag. Never log per-frame audio state in production builds. Remove debug logging before merge. | Any playback session >5 seconds |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Beat detection runs without progress feedback | User clicks "Detect BPM" and nothing happens for 5 seconds -- they click again, starting duplicate analysis | Show immediate spinner/progress. Disable the button during analysis. Show estimated time for long files. |
| Audio waveform obscures timeline sequence tracks | Key photo thumbnails and FX range bars hidden behind waveform | Render waveform in a DEDICATED audio track row (separate from sequence tracks). Alternatively, render as a subtle semi-transparent overlay in a separate layer behind the sequence content. |
| Motion path visible during playback obscures content | The bezier path and keyframe dots cover the actual animation content | Auto-hide motion path during playback. Only show when paused and a keyframed layer is selected. Use a semi-transparent dashed line, not a solid opaque stroke. |
| Beat markers as immovable vertical lines | User cannot adjust individual markers that landed slightly off-beat | Allow manual offset adjustment per marker (drag left/right). Or better: show markers as computed from BPM + offset and let user adjust the global offset with a single slider. |
| Solo mode hides sequences but audio still plays their time range | User solos a sequence to focus on it but hears audio for the full timeline | In solo/isolation mode, audio should play only the time range of the isolated sequences. If the audio track spans the entire timeline, play only the corresponding window. |
| Sidebar collapse removes scroll position memory | User scrolls to key photo 47, collapses sidebar section, re-expands, and is back at the top | Preserve scroll position per section across collapse/expand cycles. Store scrollTop in uiStore. |
| Audio import accepts any file without validation | User drags a .pdf file onto the audio import area, gets a cryptic decode error | Validate file extension and MIME type on drop. Whitelist: .wav, .mp3, .aac, .m4a, .ogg, .flac. Show clear error for unsupported formats. Validate magic bytes in Rust before attempting decode. |

## "Looks Done But Isn't" Checklist

- [ ] **Audio playback:** Often missing sync after pause/resume -- verify that pausing at frame 120, waiting 10 seconds, then resuming picks up audio at the exact correct position (not from the beginning, not offset by the pause duration)
- [ ] **Audio playback:** Often missing isolation mode support -- verify that isolating a sequence starting at frame 50 plays audio from the correct time offset (50/fps seconds), not from 0
- [ ] **Audio playback:** Often missing shuttle speed application -- verify that 2x shuttle plays audio at 2x speed (or mutes with indicator). Verify reverse shuttle mutes audio.
- [ ] **Audio export:** Often missing audio offset -- verify that if audio starts at frame 30 (1.25 seconds at 24fps), the exported video has 1.25 seconds of silence before audio begins
- [ ] **Audio export:** Often missing audio trim to video duration -- verify that if audio is longer than video, exported file ends when video ends (not when audio ends). Use `-shortest` or explicit duration.
- [ ] **Beat detection:** Often missing BPM halving/doubling correction -- verify that a 140 BPM track is not detected as 70 or 280. Test with reference tracks at 80, 120, 140, 170 BPM.
- [ ] **Beat markers:** Often missing fractional BPM handling -- verify that 128.5 BPM produces correctly spaced markers (not rounded to 128 or 129)
- [ ] **Waveform:** Often missing proper scaling at different zoom levels -- verify waveform peaks are legible at both full-timeline zoom-out and per-frame zoom-in. Peaks should not clip or become invisible.
- [ ] **Motion path:** Often missing live update during keyframe drag -- verify that dragging a keyframe diamond on the timeline updates the motion path on the canvas in real time, not only on mouseup
- [ ] **Motion path:** Often missing export exclusion -- verify that motion path visualization does NOT appear in exported PNG frames or video. The path is a UI overlay only.
- [ ] **Sidebar scroll:** Often missing scroll preservation on data change -- verify that adding a new key photo at position 5 in a list of 50 does not reset scroll to top
- [ ] **Solo mode:** Often missing multi-sequence solo -- verify that Cmd+clicking multiple sequence solo buttons isolates all of them (additive solo), not just the last clicked
- [ ] **Project save:** Often missing audio track persistence -- verify that importing audio, saving project, closing, and reopening restores the audio track with waveform, position, volume, and fade settings intact
- [ ] **Sample rate:** Often missing mismatch handling -- verify a 48kHz audio file plays at correct speed when AudioContext is 44.1kHz (or configure AudioContext sample rate to match the file)

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Two-clock drift (performance.now vs AudioContext) | MEDIUM | Refactor PlaybackEngine to accept a ClockSource interface. Replace accumulator with direct frame derivation from clock time. ~2-3 days. |
| AudioContext suspended after focus loss | LOW | Add defensive `audioContext.resume()` in play() entry point. Add state indicator in UI. ~0.5 days. |
| Waveform memory bloat from decoded AudioBuffer | MEDIUM | Move waveform computation to Rust side. Requires adding symphonia crate, IPC for peak data. ~3-4 days. If staying browser-side, extract peaks then null out buffer reference. ~1 day. |
| FFmpeg audio mux wrong codec | LOW | Change mux step to select codec based on output container. Map: MOV -> pcm_s16le, MP4 -> aac. ~0.5 days. |
| BPM detection octave errors | LOW | Add x2 / /2 buttons to BPM display. ~0.5 days for UI. Confidence scoring adds ~1 day. |
| Motion path appears in export | LOW | Move path rendering to a separate function called only in preview mode. Export already uses `renderGlobalFrame()` which should not include it. Verify and add guard. ~0.5 days. |
| Audio state not in .mce format | MEDIUM | Define MceAudioTrack type, add to MceProject, write v7->v8 migration, update save/load. ~2 days. Must be done before any audio features ship. |
| Sidebar scroll reset on data change | LOW | Store scrollTop in uiStore signal, restore after DOM mutation. ~0.5 days. |
| Audio plays during reverse shuttle | LOW | Add `if (direction < 0) { muteAudio(); }` guard. Show "audio muted" indicator. ~0.5 days. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Two-clock drift | Audio Playback (first architecture task) | Play a 60-second clip. Compare visible beat markers vs audible beats at 0s, 30s, 60s. Zero drift allowed. |
| AudioContext suspended in WKWebView | Audio Playback (first implementation task) | Load audio, play, Cmd+Tab to Finder, wait 5 seconds, Cmd+Tab back, press Space. Audio must resume from correct position. |
| Waveform memory bloat | Audio Import/Waveform | Import a 5-minute WAV file. Monitor memory in Activity Monitor. Peak increase should be <50MB (peaks only, not decoded PCM). |
| FFmpeg audio mux restructuring | Audio Export (separate phase from playback) | Export ProRes MOV with audio. Open in QuickTime. Verify audio codec is PCM, video is ProRes, audio synced to video. |
| BPM halving/doubling | Beat Sync (ship with correction UI) | Run detection on 5 reference tracks. Verify all within +/-2 BPM after user can apply x2/divider corrections. |
| Motion path in export | Canvas Motion Path | Export 10 frames of a keyframed layer with motion path visible in preview. Verify exported PNGs contain NO path visualization. |
| Audio not in .mce format | Audio Import (literal first task) | Save project with audio, reopen. Audio track present with correct position, volume, waveform. |
| Audio + isolation mode | Audio Playback | Isolate sequence at frames 50-120. Play. Audio must start at frame 50's time position and loop within that range. |
| Audio + shuttle speed | Audio Playback | Start playback, press L twice for 2x speed. Audio must play at 2x (pitched up) or be muted with indicator. Press J for reverse. Audio must mute. |
| Sidebar scroll preservation | Sidebar Enhancements | Scroll to bottom of 50 key photos. Add new key photo via import. Scroll position must not reset. |

## Sources

- [Audio-Video Synchronization with Web Audio API](https://blog.paul.cx/post/audio-video-synchronization-with-the-web-audio-api/) -- clock domain drift, outputLatency, getOutputTimestamp()
- [Synchronize Animation to Audio (Hans Garon)](https://hansgaron.com/articles/web_audio/animation_sync_with_audio/part_one/) -- AudioContext.currentTime as master clock, progress-percentage approach
- [MDN: AudioContext.resume()](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume) -- suspended state handling, user gesture requirement
- [MDN: Web Audio API Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) -- AudioContext lifecycle, autoplay policy, performance
- [WebKit Bug 237878: AudioContext suspended on backgrounding](https://bugs.webkit.org/show_bug.cgi?id=237878) -- WKWebView-specific AudioContext suspension behavior
- [WKWebView Web Audio API Discussion (Apple Developer Forums)](https://developer.apple.com/forums/thread/658375) -- WKWebView audio limitations and workarounds
- [Unlock Web Audio in Safari (Matt Montag)](https://www.mattmontag.com/web/unlock-web-audio-in-safari-for-ios-and-macos) -- user gesture patterns for WebKit AudioContext
- [OfflineAudioContext Memory Concerns (WebAudio/web-audio-api#2445)](https://github.com/WebAudio/web-audio-api/issues/2445) -- gargantuan AudioBuffer allocation for long files
- [web-audio-beat-detector (GitHub)](https://github.com/chrisguttandin/web-audio-beat-detector) -- BPM detection library, tempo range constraints
- [Building BPM Finder: Technical Challenges](https://dev.to/_ab56e9bbfaff3a478352a/building-bpm-finder-technical-challenges-in-client-side-audio-analysis-4n3) -- memory management, accuracy vs performance, Web Worker offloading
- [Beat Detection Using JavaScript and Web Audio API](http://joesul.li/van/beat-detection-using-web-audio/) -- spectral flux algorithm, octave error issues, genre bias
- [FFmpeg Audio Muxing Guide (Mux)](https://www.mux.com/articles/merge-audio-and-video-files-with-ffmpeg) -- -c:v copy muxing, audio codec selection per container
- [FFmpeg Add Audio to Video (Hollyland)](https://www.hollyland.com/blog/tips/ffmpeg-add-audio-to-video) -- -itsoffset for audio timing, -shortest flag
- [MDN: Visualizations with Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API) -- AnalyserNode, frequency/waveform data extraction
- [Canvas Rendering Optimization (ag-Grid)](https://blog.ag-grid.com/optimising-html5-canvas-rendering-best-practices-and-techniques/) -- Path2D caching, partial redraw, offscreen canvas
- [MDN: CanvasRenderingContext2D.bezierCurveTo()](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/bezierCurveTo) -- cubic Bezier curve drawing on Canvas 2D
- [Tauri Webview Versions](https://v2.tauri.app/reference/webview-versions/) -- WKWebView version and Web API support on macOS

---
*Pitfalls research for: EFX-Motion Editor v0.3.0 -- Audio playback/sync, beat detection, canvas motion paths, sidebar enhancements*
*Researched: 2026-03-21*
