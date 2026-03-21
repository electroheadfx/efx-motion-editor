# Phase 15: Audio Import & Waveform - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Import audio files (WAV, MP3, AAC, FLAC), display waveform visualization on the timeline, play audio in sync with visual preview, provide volume/mute controls, drag-to-offset, fade in/out, and persist audio tracks in .mce v8 project format. Multiple audio tracks supported (music, background, FX audio). Creating beat sync and auto-arrange is Phase 16.

</domain>

<decisions>
## Implementation Decisions

### Waveform track appearance
- **D-01:** 40-48px default track height, user-resizable via drag handle
- **D-02:** Solid filled waveform in accent color (e.g., teal/cyan); style configurable between solid fill and outline-only via parameter
- **D-03:** Always mono (mixed-down) display — no stereo split
- **D-04:** 3 resolution tiers for zoom: (1) extreme zoom-out shows peak envelope, (2) 100% shows standard waveform, (3) zoomed-in shows detailed waveform
- **D-05:** Subtle center line (zero-crossing hairline) drawn through waveform

### Track positioning & layout
- **D-06:** Audio tracks fixed at bottom of timeline, below all visual tracks (FX, content-overlay)
- **D-07:** Multiple audio tracks reorderable among themselves (drag to reorder)
- **D-08:** Track has clear start/end edges like FX range bars, with waveform rendered inside
- **D-09:** Audio content is slideable/slippable within the defined edges — user can pan audio left/right inside the in/out range
- **D-10:** Track edges (in/out points) are adjustable

### Track states
- **D-11:** Muted tracks shown at dimmed opacity (~30%)
- **D-12:** Selected track uses same highlight style as sequence selection (colored border/tint)

### Audio controls & UI placement
- **D-13:** Properties panel on the right, shown when audio track is selected on timeline — no sidebar audio list
- **D-14:** Properties panel shows: track name (editable), file name (read-only) + "Replace..." button, volume (vertical slider + numeric drag-to-adjust), mute toggle, fade in/out duration (numeric drag-to-adjust), offset in frames (numeric), track edges/in-out points (numeric)
- **D-15:** Track label on timeline with clickable name that toggles mute
- **D-16:** Click waveform on timeline to select track and show its properties

### Audio import flow
- **D-17:** "Add Audio" button on the timeline near the FX add button — opens native file picker filtered to audio formats (WAV, MP3, AAC, FLAC)
- **D-18:** Same UX pattern as adding content layers / FX layers (intent-driven flow, no drag-and-drop for audio)
- **D-19:** Multiple audio tracks per project supported (music, background, FX audio)

### Fade in/out
- **D-20:** Fades work exactly like existing fades on FX layers, content overlays, and sequences — same controls, same interaction model, same visual representation
- **D-21:** Fade curve presets: linear, exponential, logarithmic — default to exponential
- **D-22:** No limit on fade length — fades can span entire track duration

### Claude's Discretion
- Web Audio API vs HTMLAudioElement implementation choice
- Waveform pre-computation strategy (Rust backend vs JS AudioContext.decodeAudioData)
- Exact accent color for waveform (should contrast with FX track colors)
- Audio file copy strategy (copy into project directory vs reference external path)
- Exact resize handle interaction for track height
- audioStore internal signal architecture

</decisions>

<specifics>
## Specific Ideas

- Audio track edges work like FX range bars on the timeline — clear start/end with waveform inside
- Slip editing: the audio content slides within the defined edges, like NLE slip editing
- Track label area shows name that doubles as mute toggle on click
- Volume control is vertical slider + numeric input in properties panel (like existing layer transform controls)
- Waveform has 3 precomputed resolution tiers to handle zoom smoothly (not just one scaled up/down)
- Fade system reuses the exact same mechanism as FX/content/sequence fades — no new interaction patterns

</specifics>

<canonical_refs>
## Canonical References

### Audio requirements
- `.planning/REQUIREMENTS.md` — AUDIO-01 through AUDIO-07 define Phase 15 scope; AUDX-01 (multiple tracks) pulled into Phase 15 per user decision

### Existing fade system (reference implementation for audio fades)
- `Application/src/components/timeline/TimelineRenderer.ts` — Timeline canvas rendering, FX track layout, range bars
- `Application/src/stores/sequenceStore.ts` — FX/content-overlay sequence CRUD with snapshot/restore undo pattern

### Playback & sync
- `Application/src/lib/playbackEngine.ts` — rAF delta accumulation engine, sync hooks for audio integration
- `Application/src/lib/frameMap.ts` — Frame mapping computed signals, audio frame map needed

### Import & project format
- `Application/src/types/project.ts` — MceProject v7 interface, needs v8 with audio_tracks field
- `Application/src/stores/projectStore.ts` — buildMceProject() serialization, hydrateFromMce() deserialization
- `Application/src/components/timeline/AddFxMenu.tsx` — "Add" button pattern for timeline tracks

### Properties panel
- `Application/src/components/properties/` — Context-sensitive properties panel, pattern for audio properties view

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **FX range bar rendering (TimelineRenderer.ts):** Audio track edges reuse the same range bar drawing code — start/end with draggable edges
- **Fade system (transitions):** Audio fades reuse the existing fade infrastructure from Phase 13 — same controls, same curve options, same visual representation
- **Signal store pattern (sequenceStore.ts):** audioStore follows identical pattern — signal(), batch(), snapshot/restore, pushAction for undo
- **Properties panel (PropertiesPanel.tsx):** Context-sensitive rendering pattern — add AudioProperties view triggered by audio track selection
- **AddFxMenu.tsx:** "Add" button pattern on timeline — Add Audio button follows same placement and interaction
- **dragDrop.ts / useFileDrop:** NOT used for audio import (per decision), but audio extensions still needed for rejection filtering
- **Export pipeline (exportEngine.ts, ipc.ts):** FFmpeg integration already exists — audio muxing extends this in Phase 16

### Established Patterns
- **Intent-driven add flows:** Used for layers and FX — audio import follows same open-file-picker pattern
- **Sequence kind discriminator:** 'content' | 'fx' | 'content-overlay' — audio tracks are separate entities (not a sequence kind) with their own store
- **Project format versioning:** v1-v7 progressive migration — v8 adds audio_tracks with backward compat
- **Undo/redo closures:** Capture before/after snapshots, push to history stack via pushAction()

### Integration Points
- **PlaybackEngine.start/stop/tick:** Hook audio play/pause/seek sync
- **TimelineRenderer.draw:** Add audio track rows below FX/overlay tracks
- **projectStore.buildMceProject/hydrateFromMce:** Serialize/deserialize audio tracks
- **frameMap.ts:** Add audioFrameMap computed signal for timeline positioning

</code_context>

<deferred>
## Deferred Ideas

- Audio in video export (FFmpeg muxing with fades) — Phase 16
- Beat sync, BPM detection, beat markers — Phase 16
- Snap-to-beat and auto-arrange key photos — Phase 16
- Audio voiceover recording — Future (AUDX-02)
- Audio time-stretch — Out of scope

</deferred>

---

*Phase: 15-audio-import-waveform*
*Context gathered: 2026-03-21*
