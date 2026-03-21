# Project Research Summary

**Project:** EFX Motion Editor v0.3.0 — Audio, Beat Sync, Motion Paths, Sidebar Polish
**Domain:** Desktop stop-motion cinematic editor (macOS, Tauri 2.0)
**Researched:** 2026-03-21
**Confidence:** HIGH

## Executive Summary

EFX Motion Editor v0.3.0 adds audio integration and visual polish to an already-mature v0.2.0 codebase with a proven pipeline: Tauri 2.0, Preact Signals, Canvas 2D timeline, rAF-driven PlaybackEngine, and FFmpeg video export. The research confirms that all required capabilities exist in browser-native APIs (Web Audio API, Canvas 2D) and existing infrastructure (FFmpeg binary, isolationStore, keyframeEngine). The only new npm dependency is `web-audio-beat-detector` for BPM analysis. No new Rust crates are required.

The recommended approach is to build in dependency order: audio import and store foundation first, then waveform visualization and synced playback, then FFmpeg audio mux, then beat sync features, with canvas motion paths and sidebar solo running independently in parallel. This order is dictated by a hard dependency chain: every audio feature downstream (beat sync, snap-to-beat, auto-arrange, export) requires a working AudioBuffer from the import pipeline. The architecture research identifies HTMLAudioElement bridged into Web Audio API (via `createMediaElementSource`) as the correct playback approach — not AudioBufferSourceNode alone — because HTMLAudioElement supports seeking after creation, which AudioBufferSourceNode cannot do.

The two critical risks are: (1) clock drift between PlaybackEngine's `performance.now()` accumulator and `AudioContext.currentTime`, which must be resolved by making the audio clock the master clock when audio is loaded; and (2) AudioContext suspension in WKWebView after focus loss, which requires defensive `resume()` calls on every play action. Both must be designed before any playback code is written, not retrofitted. The .mce project format must be bumped to v8 with `MceAudioTrack` schema as the very first implementation task — missing this causes audio to silently disappear on project save/reopen.

## Key Findings

### Recommended Stack

The existing stack is unchanged. One new npm dependency is added, and one existing infrastructure piece (FFmpeg) is extended with audio mux support.

**Core technologies:**
- **Web Audio API (browser built-in):** Audio decoding via `decodeAudioData()`, waveform peak extraction from `AudioBuffer`, GainNode for volume/fades — zero dependencies, full support in macOS WKWebView (Safari 17+)
- **HTMLAudioElement + `createMediaElementSource()`:** Seekable audio playback bridged into the Web Audio graph — preferred over AudioBufferSourceNode alone because it supports `currentTime` seeking after creation
- **web-audio-beat-detector ^8.2.27:** Offline BPM detection from `AudioBuffer`; `guess(audioBuffer)` returns `{ bpm, offset, tempo }`; TypeScript types included; ~20KB bundle; the only new npm dependency
- **Custom waveform renderer (Canvas 2D):** Peak extraction via `AudioBuffer.getChannelData()` + `Float32Array` peaks rendered in `TimelineRenderer` — wavesurfer.js explicitly rejected because its Shadow DOM widget cannot integrate with the existing Canvas 2D pipeline
- **Canvas 2D Path2D:** Motion path visualization using the existing `interpolateAt()` engine sampled at 1-frame intervals — no graphics library needed
- **FFmpeg (existing cached binary):** Audio mux via two-step encode: video encode (proven, unchanged) then `ffmpeg -i video -i audio -c:v copy -c:a aac output`; ProRes uses `-c:a pcm_s16le`

### Expected Features

**Must have (table stakes):**
- Audio file import (WAV, MP3, AAC, FLAC) via file dialog and drag-drop — users expect this the moment "audio" is advertised
- Waveform visualization as a dedicated timeline track row — the single most expected audio feature in any timeline editor; without it, audio is invisible
- Synced audio playback when Space is pressed — unsynchronized audio is worse than no audio
- Audio volume control (GainNode slider) — basic usability requirement
- Audio timeline positioning (drag track offset) — essential for aligning audio that does not start at frame 0
- Fade in/out controls — abrupt starts/stops sound amateur; GainNode scheduling in preview, FFmpeg `-af afade` in export
- Audio in video export (FFmpeg mux) — silent export when audio is present would be treated as a bug
- Project format v8 with audio persistence — missing this makes audio evaporate on save/reopen

**Should have (differentiators):**
- BPM detection with beat markers on timeline — no stop-motion tool does this; renders amber vertical lines at beat positions
- Snap-to-beat for hold duration handles — turns frame-counting into visual alignment; minimal code on top of beat markers
- Auto-arrange frames to beats — the killer feature: distributes key photos across beats with strategy selector (every beat / 2 beats / bar)
- Canvas motion path visualization — After Effects-style dotted path showing position keyframe trajectory; no competitor has this
- Motion path keyframe dragging on canvas — drag position diamonds to edit X/Y directly on canvas
- Solo mode for layers — extends existing `isolationStore` pattern; adds `isolatedLayerIds` signal; filters PreviewRenderer at render time

**Defer (v2+):**
- Multi-track audio mixing — transforms audio from a soundtrack into a DAW; enormous complexity for a stop-motion editor
- Bezier curve handles on motion path — requires reworking the interpolation engine; the existing polynomial cubic easing does not use Bezier spatial curves
- Audio time-stretch / pitch-shift — complex DSP; users adjust duration externally
- Audio recording / voiceover — out of scope for stop-motion-to-music workflow
- Per-frame audio scrubbing — 42ms snippets at 24fps produce click noise, not useful audio

### Architecture Approach

The architecture follows the existing store/engine pattern: a new `audioStore` (Preact Signals) holds audio track metadata, waveform peaks, and beat marker data; a new `AudioEngine` (class, not store) owns the Web Audio API context and HTMLAudioElement lifecycle; `PlaybackEngine` gains 4 touch points (~15 lines) to drive `AudioEngine` on start/stop/tick/seek; `TimelineRenderer` gains an audio track row below FX tracks; and `ffmpeg.rs` gains an optional `audio_path` parameter. Canvas motion path adds a `MotionPathOverlay` SVG component as a sibling inside the existing `TransformOverlay`. Layer solo extends `isolationStore` with an `isolatedLayerIds` signal (~25 lines).

**Major components:**
1. `audioStore.ts` (NEW) — audio track data, waveform peaks cache, BPM, beat markers; project-level (not sequence-level), mirrors After Effects model; uses `AudioTrack[]` array to allow future multi-track without format migration
2. `AudioEngine` (NEW) — Web Audio API context + HTMLAudioElement playback + `syncToFrame()` for drift correction; PlaybackEngine remains master clock; `ClockSource` abstraction switches between audio-clock and rAF-accumulator
3. `waveformGenerator.ts` (NEW) — `generatePeaks(AudioBuffer, samplesPerPeak=128)` returns `Float32Array`; decode once, cache peaks, discard PCM buffer; ~50KB for 5-minute song
4. `beatDetector.ts` (NEW) — wraps `web-audio-beat-detector`; runs via `OfflineAudioContext` (no autoplay restrictions); populates `audioStore.beatMarkersCache`
5. `AudioTrackRenderer.ts` (NEW) — Canvas 2D waveform + beat marker rendering in TimelineRenderer; follows existing FX track renderer pattern; 48px track height
6. `MotionPathOverlay.tsx` (NEW) — SVG path sampled from `interpolateAt()` at 1-frame intervals; draggable keyframe diamonds; sibling of existing TransformOverlay; hidden during playback and excluded from export
7. `ffmpeg.rs` `encode_video()` (MODIFIED) — optional `audio_path: Option<&str>` parameter; two-step encode-then-mux approach keeps proven video pipeline intact

### Critical Pitfalls

1. **Two-clock drift (PlaybackEngine vs AudioContext)** — `performance.now()` delta accumulator and `AudioContext.currentTime` diverge by 1-3 frames over 30 seconds of playback. Fix: when audio is loaded, derive frame number directly from `AudioContext.currentTime * fps` — no accumulator. Use a `ClockSource` abstraction (`AudioClockSource` vs `SystemClockSource`). This must be the first architectural decision, before any playback code.

2. **AudioContext suspended in WKWebView after focus loss** — after switching apps and back, AudioContext silently suspends; frames advance but no audio plays. Fix: call `audioContext.resume()` defensively inside every play action. Show "Audio paused — press Space to resume" indicator when state is `suspended`. Do not rely on Tauri focus events for resume (WebKit rejects non-gesture-initiated resume).

3. **Waveform memory bloat from decoded AudioBuffer** — a 5-minute WAV decoded via `decodeAudioData()` produces ~110MB of Float32 data on the main thread. Fix: compute peaks immediately after decode, store as compact `Float32Array` (~50KB), then release the AudioBuffer reference. Consider Rust-side peak extraction via symphonia for files that exceed a size threshold (e.g., 100MB compressed).

4. **FFmpeg audio mux requires two-step pipeline, not a bolted-on flag** — adding audio to the monolithic `encode_video` function with 6+ new parameters is unmaintainable. Fix: use two-step approach — encode video (proven, unchanged), then a separate FFmpeg invocation with `-c:v copy -c:a aac` for mux. Video is never re-encoded. Audio codec must match container: AAC for MP4, PCM (`pcm_s16le`) for ProRes MOV.

5. **BPM detection produces halved/doubled tempo for many genres** — 140 BPM drum-and-bass detected as 70 BPM; 60 BPM ambient detected as 120 BPM. Fix: always surface x2 and /2 correction buttons next to BPM display; show confidence color coding; constrain detection range to 40-200 BPM; never auto-arrange without user verifying beat markers on timeline first.

6. **Motion path must sample actual interpolation, not draw Bezier approximation** — the existing interpolation engine uses polynomial cubic easing for the RATE of travel; the spatial path between keyframe positions is always a straight line. Drawing a Bezier spatial path creates a visual mismatch with actual motion. Fix: sample `interpolateAt()` at 1-frame intervals and draw `lineTo()` segments. Dot spacing reveals speed via easing.

7. **.mce project format v8 must be the literal first implementation task** — skipping format migration causes audio to disappear on save/reopen. Fix: define `MceAudioTrack` schema, add optional `audio_tracks?: MceAudioTrack[]` to `MceProject`, write v7->v8 migration (adds empty array), update save/load — all before any audio import UI is built.

## Implications for Roadmap

Based on the dependency chain identified in research, the suggested phase structure groups features by hard prerequisite relationships. Audio import is the foundation everything else rests on. Beat sync is a consumer of audio data. Motion path and sidebar features are fully independent and can run in parallel.

### Phase 1: Audio Foundation

**Rationale:** Every audio feature downstream — waveform, playback, beat sync, export — requires a loaded and decoded audio file. The `audioStore`, `.mce` v8 format, and `ClockSource` architecture must exist before any of them. The two-clock architecture decision must be made here, not retrofitted later.
**Delivers:** Audio file import (WAV, MP3, AAC, FLAC), `audioStore` with all signals, `AudioEngine` with `ClockSource` abstraction, waveform peak extraction, timeline audio track row, synced playback (Space key), volume control (GainNode), project persistence in .mce v8.
**Addresses:** All P1 table-stakes features from FEATURES.md.
**Avoids:** Pitfalls 1 (two-clock drift), 2 (AudioContext suspended in WKWebView), 3 (waveform memory bloat), 7 (.mce format migration must be first).
**Implementation order:** `types/audio.ts` + .mce v8 schema → Rust `audio_import` command → `audioStore` → `AudioEngine` with `ClockSource` abstraction → `waveformGenerator.ts` + peak cache → `AudioTrackRenderer.ts` in TimelineRenderer → PlaybackEngine sync (4 touch points) → project serialization.
**Research flag:** Standard patterns. No phase-level research needed. Web Audio API, HTMLAudioElement, Canvas 2D waveform rendering are well-documented with high-confidence sources.

### Phase 2: Audio Polish + Beat Sync

**Rationale:** These features are lightweight consumers of the Phase 1 audio pipeline. Audio export is included here because it completes the end-to-end pipeline and the FFmpeg two-step mux approach is well-understood.
**Delivers:** Audio timeline positioning (drag offset), fade in/out controls (GainNode scheduling + FFmpeg `-af afade` in export), BPM detection with beat markers on timeline, snap-to-beat for hold duration handles, auto-arrange frames to beats (with strategy selector), audio in video export (two-step FFmpeg mux).
**Addresses:** All P2 differentiator features from FEATURES.md.
**Avoids:** Pitfalls 4 (FFmpeg two-step mux — never re-encode video), 5 (BPM halving/doubling — ship x2//2 UI and confidence color alongside detection, never without it).
**Key decisions:** Do not trigger auto-arrange without user verifying beat markers first. Use `Math.round(fps * 60 / bpm)` for `framesPerBeat`. ProRes export uses `-c:a pcm_s16le`, not AAC.
**Research flag:** Standard patterns. FFmpeg audio mux and `web-audio-beat-detector` API are well-documented. No phase-level research needed.

### Phase 3: Canvas Motion Path

**Rationale:** Fully independent of audio. Can be developed in parallel with Phase 1/2 or sequentially after. Depends entirely on existing infrastructure: `keyframeStore`, `keyframeEngine.interpolateAt()`, `TransformOverlay`, `coordinateMapper.ts`.
**Delivers:** Motion path visualization as SVG overlay on canvas (dotted path from `interpolateAt()` sampled at 1-frame intervals, dot density shows easing speed), draggable keyframe diamonds for direct position editing, path hidden during playback and fully excluded from export.
**Addresses:** P3 canvas motion path features from FEATURES.md.
**Avoids:** Pitfall 6 (must sample `interpolateAt()` — never draw Bezier spatial approximation). Motion path must not appear in exports (separate rendering pass gated behind UI toggle). Cache `Path2D` objects; invalidate only when keyframes change.
**Research flag:** After Effects and Apple Motion motion path patterns are well-documented. Canvas 2D/SVG hit-testing for draggable handles is standard. No phase-level research needed.

### Phase 4: Sidebar Polish + Solo Mode

**Rationale:** Independent of both audio and motion path. Can ship with any prior phase or at the end. Solo mode is a minimal extension of the existing `isolationStore` pattern. Sidebar scroll/collapse enhancements are primarily verification and wiring of already-built components (`SidebarScrollArea`, `CollapsibleSection`).
**Delivers:** Layer-level solo mode (`isolatedLayerIds` signal in `isolationStore`, `toggleLayerIsolation()`, PreviewRenderer layer filtering), sidebar section collapse persistence (`appConfig`), key photos panel scroll verification (SortableJS drag + overflow compatibility).
**Addresses:** Remaining P3 sidebar features from FEATURES.md.
**Avoids:** Layer solo must use an ephemeral signal, not mutate `layer.visible` (would create undo entries and lose visibility settings). Sidebar scroll must preserve `scrollTop` on data change (store in `uiStore`). SortableJS `forceFallback: true` drag ghost clipping when scroll container has `overflow: hidden` — set `overflow: visible` during active drag.
**Research flag:** Standard patterns. No phase-level research needed.

### Phase Ordering Rationale

- Phase 1 is the dependency root: audio import unblocks all other audio features
- Phase 2 after Phase 1: beat sync requires AudioBuffer; audio export benefits from verifying playback sync first
- Phase 3 can overlap with Phase 1 or 2: zero shared dependencies; a separate developer stream is viable
- Phase 4 is last or concurrent: smallest scope, all components already exist in the codebase

### Research Flags

Phases with standard patterns (skip `/gsd:research-phase`):
- **All four phases:** The research corpus is comprehensive. Web Audio API, FFmpeg mux, Canvas 2D waveform, BPM detection, SVG motion path, and Preact Signals patterns are all well-documented with high-confidence sources. The existing codebase architecture is deeply understood from the v0.2.0 work.

Optional spikes worth considering before Phase 1 commit:
- **`ClockSource` abstraction prototype (2 hours):** The two-clock drift pitfall is the highest-risk integration point. Prototyping `AudioClockSource` and `SystemClockSource` in isolation before writing PlaybackEngine changes de-risks the architectural decision.
- **Rust-side waveform peaks via symphonia (2-4 hours):** PITFALLS.md recommends this for large files to avoid the 110MB main-thread AudioBuffer allocation. Worth prototyping to determine if a new Rust crate is warranted vs. browser-side peak extraction with a file size warning.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies are browser-native or existing project dependencies. `web-audio-beat-detector` is actively maintained with published TypeScript types. No experimental APIs. WKWebView Web Audio support confirmed via Tauri community examples and MDN. |
| Features | HIGH | Feature set is informed by competitor analysis (Dragonframe, Stop Motion Studio, DaVinci Resolve, Canva) and established NLE patterns. Dependency chain is explicit and verified. Anti-features are clearly scoped out with rationale. |
| Architecture | HIGH | Research is based on deep analysis of the existing v0.2.0 codebase. Integration points identified with diff estimates (~15 lines PlaybackEngine, ~20 lines ffmpeg.rs, ~80 lines TimelineRenderer). `ClockSource` abstraction and two-step FFmpeg mux are well-established patterns. |
| Pitfalls | MEDIUM-HIGH | Critical pitfalls sourced from WebKit bug trackers (Bug 237878), Web Audio API issues (GitHub WebAudio/web-audio-api#2445), and implementation post-mortems. Two-clock drift confirmed by multiple independent sources. BPM octave error is a known limitation of all energy-based detection algorithms. |

**Overall confidence:** HIGH

### Gaps to Address

- **BPM detection accuracy on the project's actual music genre:** `web-audio-beat-detector` accuracy varies by genre. If the primary user base creates stop-motion to ambient or jazz, detection may be unreliable. Resolution: manual BPM entry must be a first-class path, not a fallback. Add "Tap Tempo" if detection accuracy is reported as insufficient post-launch.

- **AudioContext.outputLatency on Bluetooth audio:** Bluetooth output can add 100-300ms latency (4-7 frames at 24fps) that the `ClockSource` abstraction does not automatically compensate for. Whether to account for `outputLatency` in frame derivation is a product decision (visual-leads-audio is usually acceptable for editing). Flag for review during Phase 1 implementation.

- **Waveform peak extraction approach (browser vs Rust):** STACK.md recommends browser-side for simplicity; PITFALLS.md recommends Rust-side (symphonia) to avoid 110MB main-thread allocation for large files. Resolution: start with browser-side, add a file size warning (>100MB compressed), gate the Rust-side optimization as a performance improvement if user-reported freezes occur.

- **Sample rate mismatch (48kHz file in 44.1kHz AudioContext):** A 48kHz file played in a 44.1kHz AudioContext is resampled and can cause minor timing drift. Resolution: configure `AudioContext` with `sampleRate` matching the source file's sample rate. Add to the "looks done but isn't" verification checklist.

## Sources

### Primary (HIGH confidence)
- [MDN Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) — AudioContext, decodeAudioData, AudioBufferSourceNode, GainNode APIs
- [MDN: AudioParam.linearRampToValueAtTime()](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/linearRampToValueAtTime) — fade in/out scheduling
- [MDN: CanvasRenderingContext2D.bezierCurveTo()](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/bezierCurveTo) — motion path Canvas 2D API
- [web-audio-beat-detector npm](https://www.npmjs.com/package/web-audio-beat-detector) — v8.2.27, `guess(audioBuffer)` returns `{ bpm, offset, tempo }`
- [web-audio-beat-detector GitHub](https://github.com/chrisguttandin/web-audio-beat-detector) — algorithm details, TypeScript types
- [FFmpeg documentation](https://ffmpeg.org/ffmpeg.html) — audio mux with `-i`, `-c:a`, `-shortest`, `-itsoffset`, `-af afade` flags
- [Mux: Merge audio and video with FFmpeg](https://www.mux.com/articles/merge-audio-and-video-files-with-ffmpeg) — two-step mux command patterns

### Secondary (MEDIUM confidence)
- [Audio-Video Synchronization with Web Audio API (paul.cx)](https://blog.paul.cx/post/audio-video-synchronization-with-the-web-audio-api/) — clock domain drift, `outputLatency`, `getOutputTimestamp()`
- [Sync Animation to Audio (Hans Garon)](https://hansgaron.com/articles/web_audio/animation_sync_with_audio/part_one/) — rAF + AudioContext.currentTime synchronization pattern
- [BBC waveform-data.js](https://github.com/bbc/waveform-data.js) — peak extraction and resampling patterns
- [Kdenlive Audio Waveform Rewrite 2025](https://etiand.re/posts/2025/01/audio-waveforms-in-kdenlive-technical-upgrades-for-speed-precision-and-better-ux/) — peak-per-pixel rendering, zoom performance
- [Beat Detection Using JavaScript and the Web Audio API (Joe Sullivan)](http://joesul.li/van/beat-detection-using-web-audio/) — BPM algorithm, octave error issues
- [Adobe After Effects: Keyframe Interpolation](https://helpx.adobe.com/after-effects/using/keyframe-interpolation.html) — motion path visualization spec
- [Apple Motion: Modify Animation Paths](https://support.apple.com/guide/motion/modify-animation-paths-motn14748beb/mac) — motion path interaction patterns
- [Tauri + Web Audio (Slav Basharov)](https://slavbasharov.com/blog/building-music-player-tauri-svelte) — confirms Web Audio API works in Tauri WKWebView

### Tertiary (LOW confidence, needs validation)
- [WebKit Bug 237878](https://bugs.webkit.org/show_bug.cgi?id=237878) — AudioContext suspended on WKWebView backgrounding; behavior may vary across macOS versions
- [WebAudio/web-audio-api#2445](https://github.com/WebAudio/web-audio-api/issues/2445) — OfflineAudioContext memory concerns; behavior depends on WebKit version
- [Canva Beat Sync](https://www.canva.com/features/beat-sync/) — UX reference for auto beat sync; internal implementation not documented

---
*Research completed: 2026-03-21*
*Ready for roadmap: yes*
