# Phase 16: Audio Export & Beat Sync - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Export video with audio muxed in (FFmpeg), detect BPM from imported audio, render beat markers on timeline, manual BPM adjustment with x2/÷2, snap key photo boundaries to beat markers, and auto-arrange key photos to beat positions with strategy selector. No new audio import features (Phase 15 handles that). No multi-track audio mixing UI (out of scope).

</domain>

<decisions>
## Implementation Decisions

### Audio export mixing
- **D-01:** Pre-render all audio tracks to a single mixed WAV file using JS OfflineAudioContext before passing to FFmpeg — guarantees fade curves and volume match preview playback exactly (what-you-hear-is-what-you-export)
- **D-02:** OfflineAudioContext reuses existing audioEngine fade/volume/offset logic — no duplicate DSP code in Rust
- **D-03:** When exporting PNG sequences, include the mixed WAV file alongside the PNG folder for DaVinci Resolve / Premiere Pro post-production workflows
- **D-04:** Add "Include audio" checkbox in export settings panel — lets users export video-only even when audio tracks exist. Muted tracks already excluded via their mute flag

### BPM detection approach
- **D-05:** JS-side BPM detection directly on AudioBuffer PCM data (onset detection + autocorrelation on Float32Array) — ~100-200ms for 5 min track, no IPC overhead
- **D-06:** Auto-detect BPM immediately after audio import — results appear instantly, no manual trigger needed
- **D-07:** Store BPM data (bpm, beatOffset, beatMarkers[]) on AudioTrack interface, persist in .mce project format (bump to v12) so detection doesn't re-run on project reopen
- **D-08:** Manual BPM correction via numeric input field + x2 and ÷2 quick-fix buttons in audio properties panel, plus beat offset as separate numeric field (in frames)

### Beat marker display
- **D-09:** Thin semi-transparent vertical lines spanning full height of timeline — from top of content tracks to bottom of audio tracks, like DAW grid lines
- **D-10:** Show every beat at all zoom levels; fade opacity progressively when zoomed out so markers don't overlap. Downbeats (beat 1 of bar) drawn slightly brighter/thicker
- **D-11:** Warm accent color (orange/amber) at ~20-30% opacity for regular beats, ~50% for downbeats — distinct from teal (GL transitions) and purple (cross-dissolve)
- **D-12:** Toggle button (metronome/beat icon) on timeline toolbar to show/hide beat markers. State persists in project. Default: visible when BPM data exists

### Snap & auto-arrange UX
- **D-13:** Magnetic snap when dragging key photo hold-duration boundaries on timeline — boundary snaps to nearest beat marker within pixel threshold. Toggle via magnet icon button near beat marker toggle. Note: sequences are built from cumulative hold durations, not freely positionable — snap works on the boundary between two key photos, changing the hold frame count of the preceding key photo
- **D-14:** Auto-arrange action in audio properties panel — "Auto-Arrange" section with strategy selector (every beat / every 2 beats / every bar) and Apply button. Natural location since beat data belongs to the audio track
- **D-15:** No confirmation dialog before auto-arrange — apply immediately, Cmd+Z undoes the entire rearrange as a single undo step (matches existing bulk operation patterns)
- **D-16:** When more beats than key photos: distribute photos evenly across available beats, last photo holds through remaining beats. When more photos than beats: extra photos get minimum 1-beat hold duration

### Claude's Discretion
- Exact BPM detection algorithm details (onset function, autocorrelation window, peak picking)
- WAV temp file location and cleanup strategy
- FFmpeg audio muxing flags (-i audio.wav + video stream mapping)
- Beat marker pixel threshold for magnetic snap
- Auto-arrange animation or immediate application
- Export progress UI updates during audio pre-render step

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Audio requirements & data model
- `.planning/REQUIREMENTS.md` — BEAT-01 through BEAT-05 define Phase 16 scope
- `Application/src/types/audio.ts` — AudioTrack interface, MceAudioTrack serialization format, WaveformPeaks, FadeCurve type

### Audio engine & store (Phase 15 foundation)
- `Application/src/lib/audioEngine.ts` — Web Audio API wrapper with AudioBuffer cache, fade scheduling, play/stop/volume. OfflineAudioContext export mixing builds on this
- `Application/src/stores/audioStore.ts` — AudioTrack CRUD with signal/batch/snapshot/restore/pushAction undo pattern. BPM fields added here
- `Application/src/lib/audioPeaksCache.ts` — Waveform peak data caching, pattern for beat marker data caching

### Export pipeline
- `Application/src/lib/exportEngine.ts` — PNG render loop + FFmpeg video encoding. Audio muxing extends step 7 (video encoding)
- `Application/src/lib/ipc.ts` — `exportEncodeVideo()` Rust FFmpeg invocation — needs audio path parameter added
- `Application/src/stores/exportStore.ts` — Export settings and progress state. "Include audio" checkbox added here

### Timeline rendering
- `Application/src/components/timeline/TimelineRenderer.ts` — Canvas 2D timeline rendering, FX track layout, range bars. Beat markers drawn here
- `Application/src/components/timeline/TimelineInteraction.ts` — Timeline pointer events, drag handling. Snap-to-beat logic hooks in here

### Project persistence
- `Application/src/types/project.ts` — MceProject interface, audio_tracks field. Format bump to v12 for BPM data
- `Application/src/stores/projectStore.ts` — buildMceProject/hydrateFromMce serialization. BPM fields serialized here

### Prior phase context
- `.planning/phases/15-audio-import-waveform/15-CONTEXT.md` — Audio data model decisions, fade system, import flow, timeline layout

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **audioEngine.ts AudioBuffer cache:** `buffers.get(trackId)` provides decoded Float32Array for BPM detection — no re-decoding needed
- **audioEngine.ts fade scheduling:** `applyFadeSchedule()` logic reusable in OfflineAudioContext for export mixing
- **exportEngine.ts FFmpeg pipeline:** Steps 1-7 already handle PNG rendering + video encoding. Audio muxing extends step 7 by adding `-i audio.wav` input
- **ipc.ts `exportEncodeVideo()`:** Rust FFmpeg wrapper — needs new `audioPath` parameter for muxing
- **Timeline beat marker rendering:** Same Canvas 2D pattern as existing FX range bars and cross-dissolve overlays — `strokeStyle` + `moveTo`/`lineTo`
- **TimelineInteraction.ts drag handling:** Existing hold-duration resize logic provides the hook point for magnetic snap

### Established Patterns
- **Signal store + undo:** audioStore follows sequenceStore pattern (snapshot/restore/pushAction) — auto-arrange uses single pushAction for bulk hold-duration changes
- **Project format versioning:** v1-v11 progressive migration with `serde(default)` for backward compat — v12 adds BPM fields with same pattern
- **Timeline toolbar buttons:** Beat toggle and snap toggle follow existing button patterns (Lucide icons, keyboard shortcut tooltips)
- **Export settings checkboxes:** "Include audio" checkbox follows existing export settings UI pattern in ExportView

### Integration Points
- **exportEngine.startExport():** Insert audio pre-render step before FFmpeg encoding, pass WAV path to encode call
- **TimelineRenderer.draw():** Add beat marker rendering pass after track rendering, before playhead
- **TimelineInteraction pointer events:** Add snap logic to hold-duration resize handler
- **audioStore.addTrack():** Trigger BPM detection after track creation
- **projectStore.buildMceProject/hydrateFromMce:** Serialize/deserialize BPM fields on audio tracks

</code_context>

<specifics>
## Specific Ideas

- Key photo boundaries snap to beats — not sequences as a whole, since sequences are built from cumulative hold durations (not freely positionable)
- Auto-arrange recalculates hold durations so each key photo transition aligns with a beat position
- WAV pre-render guarantees audio fidelity: same OfflineAudioContext path as preview playback
- Beat markers are visual guides, not timeline structure — they overlay existing content without affecting layout
- BPM detection is near-instant (~200ms) so auto-detect on import causes no UX friction

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-audio-export-beat-sync*
*Context gathered: 2026-03-23*
