---
phase: 16-audio-export-beat-sync
verified: 2026-03-23T21:40:00Z
status: human_needed
score: 4/4 success criteria verified
re_verification: true
previous_status: gaps_found
previous_score: 3/4
gaps_closed:
  - "Export hangs indefinitely when audio is included — fixed via async spawn_blocking in Rust + AbortSignal timeout in TS (Plan 04)"
  - "BPM data lost on project save/reload — fixed by adding 5 missing BPM fields to Rust MceAudioTrack struct (Plan 05)"
  - "User can snap key photo hold-duration handles to nearest beat marker — snapHoldFramesToBeat added to beatMarkerEngine.ts and Snap-to-beat button wired in FramesPopover (Plan 06)"
gaps_remaining: []
regressions: []
human_verification:
  - test: "Verify audio export produces video with audible audio and does not hang"
    expected: "Exported ProRes/H.264 video file contains synchronized audio track with fade-in/fade-out. Export completes within expected time. Cancel button works during audio pre-render."
    why_human: "OfflineAudioContext pre-render and FFmpeg muxing require running actual export with real audio file"
  - test: "Verify beat markers render on timeline during playback"
    expected: "Amber vertical lines appear on timeline when audio with detected BPM is selected, with downbeats visually distinct"
    why_human: "Canvas rendering requires visual inspection"
  - test: "Verify BPM persists across project save and reload"
    expected: "After closing and reopening a project with detected BPM, beat markers reappear and AudioProperties shows the saved BPM value"
    why_human: "Requires running the full Tauri app with file save/load cycle"
  - test: "Verify playhead snaps to beat during scrub"
    expected: "When Snap-to-beats is enabled (Magnet button), dragging the playhead snaps to nearby beat marker positions"
    why_human: "Requires interactive timeline drag"
  - test: "Verify Snap-to-beat button appears in FramesPopover when audio with BPM is selected and snaps correctly"
    expected: "When an audio track with detected BPM is selected, the hold-frames popover shows a Music-icon Snap-to-beat button. Clicking it adjusts holdFrames so the key photo's end frame aligns with the nearest beat marker."
    why_human: "Requires interactive UI testing with a running audio track that has BPM data"
---

# Phase 16: Audio Export & Beat Sync Verification Report

**Phase Goal:** Users can export video with audio included, detect beats from the audio track, and auto-arrange key photos to beat positions
**Verified:** 2026-03-23T21:40:00Z
**Status:** human_needed
**Re-verification:** Yes — after Plan 06 gap closure (snap-to-beat in FramesPopover)

## Re-verification Summary

Three gap closure plans have now been executed since initial verification:

- **Plan 04** (export hang fix): Made `export_encode_video` async via `tokio::task::spawn_blocking`, added `AbortSignal` + 60s timeout to `renderMixedAudio`, added cancel gate in `exportEngine.ts`.
- **Plan 05** (BPM persistence): Added 5 missing BPM/audio fields to Rust `MceAudioTrack` with `#[serde(default)]`.
- **Plan 06** (snap-to-beat): Added `snapHoldFramesToBeat` to `beatMarkerEngine.ts` with 5 TDD tests; added conditional "Snap to beat" button (Music icon) in `FramesPopover` wired to `audioStore` beat markers and the key photo's `kpStartFrame`.

All 4 success criteria are now verified in code. No automated gaps remain.

---

## Goal Achievement

### Observable Truths (from Phase Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can export video (ProRes/H.264/AV1) with the audio track muxed in, including fade in/out applied | VERIFIED | `export.rs` line 75: `pub async fn export_encode_video` with `tokio::task::spawn_blocking` at lines 91-98; `audioExportMixer.ts` line 87: `signal?: AbortSignal`; `ffmpeg.rs` muxes audio; cancel gate in `exportEngine.ts` |
| 2 | User can detect BPM from imported audio and see beat markers rendered as vertical lines on the timeline | VERIFIED | `detectBPM` in `bpmDetector.ts` (6 tests pass); `computeBeatMarkers` in `beatMarkerEngine.ts`; `drawBeatMarkers` at `TimelineRenderer.ts` line 786 renders amber lines with downbeat distinction; auto-detect on import in `ImportedView.tsx` line 304 |
| 3 | User can manually set or adjust BPM and beat offset, with x2 and /2 correction available | VERIFIED | `AudioProperties.tsx`: BPM numeric input (line 243), x2 button (line 257-265), div2 button (line 270-275), beat offset input (line 283-286), Re-detect BPM button (line 292); BPM data persists via Rust `MceAudioTrack` with `serde(default)` |
| 4 | User can snap key photo hold-duration handles to nearest beat marker, and auto-arrange all key photos to beat positions using a strategy selector | VERIFIED | `snapHoldFramesToBeat` exported from `beatMarkerEngine.ts` line 67; imported and called in `KeyPhotoStrip.tsx` FramesPopover `handleSnapToBeat` (line 217-232); conditional "Snap to beat" button with Music icon (lines 291-310); `kpStartFrame` computed from `trackLayouts` and passed as `startFrame` prop (line 342-348, 468); `autoArrangeHoldFrames` wired in `AudioProperties.tsx` |

**Score:** 4/4 success criteria fully verified

---

## Gap Closures Verified (Plan 06 — New This Re-verification)

### Task 1: snapHoldFramesToBeat pure function

| Artifact | Must-Have | Status | Evidence |
|----------|-----------|--------|----------|
| `Application/src/lib/beatMarkerEngine.ts` | `export function snapHoldFramesToBeat(` | VERIFIED | Line 67 — delegates to `snapToBeat(endFrame, beatMarkers, thresholdFrames)`, computes `newHold = snappedEnd - startFrame`, guards minimum of 1 |
| `Application/src/lib/beatMarkerEngine.test.ts` | `describe('snapHoldFramesToBeat'` with 5 test cases | VERIFIED | Lines 136-165: 5 test cases covering snap, non-zero startFrame, threshold miss, empty markers, minimum-hold-clamp |

All 24 beatMarkerEngine tests pass (19 existing + 5 new).

### Task 2: Snap-to-beat button in FramesPopover

| Artifact | Must-Have | Status | Evidence |
|----------|-----------|--------|----------|
| `Application/src/components/sequence/KeyPhotoStrip.tsx` | `import {snapHoldFramesToBeat} from '../../lib/beatMarkerEngine'` | VERIFIED | Line 15 |
| `Application/src/components/sequence/KeyPhotoStrip.tsx` | `import {audioStore} from '../../stores/audioStore'` | VERIFIED | Line 9 |
| `Application/src/components/sequence/KeyPhotoStrip.tsx` | `Music` imported from lucide-preact | VERIFIED | Line 3 (destructured from existing import) |
| `Application/src/components/sequence/KeyPhotoStrip.tsx` | `FramesPopoverProps` has `startFrame: number` | VERIFIED | Line 148 |
| `Application/src/components/sequence/KeyPhotoStrip.tsx` | `handleSnapToBeat` callback | VERIFIED | Lines 217-232 — reads `audioStore.tracks.peek()` and `audioStore.selectedTrackId.peek()`, calls `snapHoldFramesToBeat` with `Infinity` threshold |
| `Application/src/components/sequence/KeyPhotoStrip.tsx` | Conditional "Snap to beat" button renders only when audio track with BPM is selected | VERIFIED | Lines 291-310 — IIFE checks `selectedTrack.bpm && selectedTrack.beatMarkers.length > 0` |
| `Application/src/components/sequence/KeyPhotoStrip.tsx` | `kpStartFrame` computed from `trackLayouts` | VERIFIED | Lines 342-348 — `trackLayouts.peek()` finds `keyPhotoRanges.find(r => r.keyPhotoId === keyPhotoId)` |
| `Application/src/components/sequence/KeyPhotoStrip.tsx` | `startFrame={kpStartFrame}` passed to `FramesPopover` | VERIFIED | Line 468 |

**Key link verified:** `KeyPhotoStrip.tsx` → `beatMarkerEngine.ts` via `import { snapHoldFramesToBeat } from '../../lib/beatMarkerEngine'` — confirmed at line 15.
**Key link verified:** `KeyPhotoStrip.tsx` → `audioStore.ts` via `audioStore.tracks.peek()` — confirmed at lines 218-220.

### TypeScript Compilation

`npx tsc --noEmit` produces only one pre-existing warning in `glslRuntime.test.ts` (unused `expect` import from Phase 15). No errors in any Phase 16 files.

---

## Full Artifact Status

| Artifact | Exists | Substantive | Wired | Data Flows | Status |
|----------|--------|-------------|-------|------------|--------|
| `Application/src/types/audio.ts` | Yes | Yes — BPM fields on AudioTrack and MceAudioTrack | Yes — used by audioStore, AudioProperties, KeyPhotoStrip | Yes | VERIFIED |
| `Application/src/types/export.ts` | Yes | Yes — `includeAudio: boolean` | Yes — used by exportEngine | Yes | VERIFIED |
| `Application/src/lib/bpmDetector.ts` | Yes | Yes — `detectBPM` with autocorrelation + octave correction | Yes — imported by audioStore | Yes | VERIFIED |
| `Application/src/lib/bpmDetector.test.ts` | Yes | Yes — 6 tests (120, 90, 150 BPM within ±2 BPM) | N/A (test file) | N/A | VERIFIED |
| `Application/src/lib/beatMarkerEngine.ts` | Yes | Yes — 5 exports: `computeBeatMarkers`, `computeDownbeatFrames`, `snapToBeat`, `snapHoldFramesToBeat`, `autoArrangeHoldFrames` | Yes — imported by TimelineRenderer, AudioProperties, TimelineInteraction, KeyPhotoStrip | Yes | VERIFIED |
| `Application/src/lib/beatMarkerEngine.test.ts` | Yes | Yes — 24 tests across all 5 functions | N/A (test file) | N/A | VERIFIED |
| `Application/src/lib/audioExportMixer.ts` | Yes | Yes — `renderMixedAudio` with `AbortSignal` + 60s timeout | Yes — called from exportEngine | Yes | VERIFIED |
| `Application/src-tauri/src/commands/export.rs` | Yes | Yes — `pub async fn export_encode_video` with `spawn_blocking` | Yes — Tauri command invoked by exportEngine | Yes | VERIFIED |
| `Application/src-tauri/src/models/project.rs` | Yes | Yes — MceAudioTrack has `audio_asset_id`, `bpm`, `beat_offset_frames`, `beat_markers`, `show_beat_markers` all with `serde(default)` | Yes — used in Tauri IPC serde round-trip | Yes | VERIFIED |
| `Application/src/components/sidebar/AudioProperties.tsx` | Yes | Yes — BPM input, x2/div2 buttons, beat offset, re-detect, auto-arrange section | Yes — mounted in sidebar, reads/writes audioStore | Yes | VERIFIED |
| `Application/src/components/timeline/TimelineRenderer.ts` | Yes | Yes — `drawBeatMarkers` at line 786 draws amber lines with downbeat distinction | Yes — called from render loop when `beatMarkersVisible` is true | Yes | VERIFIED |
| `Application/src/components/sequence/KeyPhotoStrip.tsx` | Yes | Yes — FramesPopover has `startFrame` prop, `handleSnapToBeat`, conditional Snap-to-beat button | Yes — imports `snapHoldFramesToBeat` and `audioStore`; `kpStartFrame` from `trackLayouts` | Yes | VERIFIED |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `KeyPhotoStrip.tsx` | `beatMarkerEngine.ts` | `import { snapHoldFramesToBeat }` | VERIFIED | Line 15; called at line 222 in `handleSnapToBeat` |
| `KeyPhotoStrip.tsx` | `audioStore.ts` | `audioStore.tracks.peek()` | VERIFIED | Lines 218-220 — reads `tracks` and `selectedTrackId` signals |
| `AudioProperties.tsx` | `beatMarkerEngine.ts` | `import { autoArrangeHoldFrames }` | VERIFIED | Line 14; called at line 333 in auto-arrange handler |
| `TimelineRenderer.ts` | `beatMarkerEngine.ts` | `computeDownbeatFrames` | VERIFIED | Line 249 — downbeats computed before `drawBeatMarkers` |
| `audioStore.ts` | `bpmDetector.ts` | `import { detectBPM }` | VERIFIED | Line 4; called at line 246 in `detectAndSetBPM` |
| `export.rs` | `ffmpeg.rs` | `tokio::task::spawn_blocking` | VERIFIED | Lines 91-98 — `ffmpeg::encode_video` called inside blocking task |
| `exportEngine.ts` | `audioExportMixer.ts` | `renderMixedAudio` | VERIFIED | AbortController wired at export engine level |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| BPM detector returns correct BPM for click tracks | `vitest run bpmDetector.test.ts` | 6/6 tests pass (120, 90, 150 BPM within ±2) | PASS |
| Beat marker engine computes frame positions, snap, auto-arrange | `vitest run beatMarkerEngine.test.ts` | 24/24 tests pass (19 existing + 5 new snapHoldFramesToBeat) | PASS |
| snapHoldFramesToBeat snaps end frame correctly | `vitest run beatMarkerEngine.test.ts` (snapHoldFramesToBeat describe) | 5/5 tests pass | PASS |
| TypeScript compiles without errors in phase-16 files | `npx tsc --noEmit` | Only pre-existing `glslRuntime.test.ts` unused import warning; zero phase-16 errors | PASS |
| Rust compiles with async export + BPM fields | `cargo check` (from Plan 05) | `Finished dev profile` | PASS |
| `export_encode_video` is async with `spawn_blocking` | grep `pub async fn export_encode_video` | Found at line 75 of `export.rs`; `spawn_blocking` at lines 91-98 | PASS |
| `renderMixedAudio` accepts AbortSignal | grep `signal.*AbortSignal` | Found at line 87 of `audioExportMixer.ts` | PASS |
| All 5 BPM fields in Rust MceAudioTrack | grep in `project.rs` | `audio_asset_id` (54), `bpm` (57), `beat_offset_frames` (60), `beat_markers` (63), `show_beat_markers` (66) | PASS |
| Snap-to-beat button in FramesPopover | grep `Snap to beat` + `snapHoldFramesToBeat` in `KeyPhotoStrip.tsx` | Found at lines 307 and 222 respectively | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BEAT-01 | Plan 02, Plan 04 | User can export video with audio included (FFmpeg muxing with fades applied, no hang) | SATISFIED | `audioExportMixer.ts` renders mixed WAV; `ffmpeg.rs` muxes; `export_encode_video` async with `spawn_blocking`; cancel/abort wiring in `exportEngine.ts` |
| BEAT-02 | Plan 01, Plan 03, Plan 05 | User can detect BPM from imported audio and see beat markers on timeline; BPM persists | SATISFIED | `detectBPM` + `computeBeatMarkers` + `drawBeatMarkers` wired; Rust `MceAudioTrack` has BPM fields with `serde(default)` |
| BEAT-03 | Plan 03, Plan 05 | User can manually set or adjust BPM and beat offset when detection is inaccurate | SATISFIED | `AudioProperties.tsx` has BPM input, x2/div2, beat offset, re-detect button; data persists through project save/load |
| BEAT-04 | Plan 03, Plan 06 | User can snap key photo hold-duration handles to nearest beat marker | SATISFIED | `snapHoldFramesToBeat` in `beatMarkerEngine.ts`; "Snap to beat" button in `FramesPopover` reads `audioStore` beat markers and key photo `startFrame`; 5 tests pass |
| BEAT-05 | Plan 03 | User can auto-arrange key photos to beat positions with strategy selector (every beat, 2 beats, bar) | SATISFIED | `autoArrangeHoldFrames` called from `AudioProperties.tsx` AutoArrangeSection; fixed-stride behavior verified by 5 tests |

**Orphaned requirements:** None. All 5 BEAT requirements are satisfied.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `project.rs` | 60 | `beat_offset_frames: u32` — implementation uses unsigned type; plan text specified `i32` but code uses `u32`; type was already `u32` from Plan 05 | Info | Functionally safe for non-negative offsets; not a regression — carried forward from Plan 05 |

No TODO/FIXME/placeholder comments in any Plan 06 files. No empty implementations. No hardcoded stub returns. No orphaned imports.

---

## Human Verification Required

### 1. Audio Export End-to-End (including hang fix)

**Test:** Import an audio file (WAV or MP3), set up a sequence with key photos, export as H.264. Verify the export completes and the output video plays with audio.
**Expected:** Export completes without hanging. Exported video contains synchronized audio. Fade-in/fade-out applied. Cancel button works during audio pre-render phase.
**Why human:** Requires running the full Tauri app with OfflineAudioContext rendering and real FFmpeg. The `spawn_blocking` fix addresses the root cause but needs end-to-end validation.

### 2. BPM Persistence Round-Trip

**Test:** Import audio, detect BPM, save project, close, reopen project.
**Expected:** Beat markers reappear on the timeline. AudioProperties shows the saved BPM value and beat offset. The Rust serde fix preserves data through the full IPC round-trip.
**Why human:** Full save/load cycle requires running the app; serde round-trip cannot be unit-tested without the full Tauri IPC stack.

### 3. Beat Marker Visual Rendering

**Test:** Import audio with clear tempo. Check timeline after auto-detect completes.
**Expected:** Amber vertical lines span all tracks. Downbeats (every 4th) are visibly thicker and brighter. Toggle button shows/hides them.
**Why human:** Canvas 2D rendering requires visual inspection.

### 4. Playhead Snap-to-Beat During Scrub

**Test:** Enable Snap-to-beats (Magnet button in timeline panel). Drag the playhead near a beat marker.
**Expected:** Playhead snaps to the nearest beat marker position.
**Why human:** Requires interactive timeline drag.

### 5. Snap-to-Beat Button in FramesPopover

**Test:** Select an audio track with detected BPM. Open the hold-frames popover on any key photo by clicking its frame badge. Verify the Snap-to-beat button appears. Click it.
**Expected:** A Music-icon "Snap to beat" button is visible in the popover. Clicking it adjusts the hold-frames value so the key photo's end frame aligns with the nearest beat marker. No button appears when no audio track with BPM is selected.
**Why human:** Requires interactive UI testing with a running audio track that has BPM data loaded.

---

## Gaps Summary

No automated gaps remain. All 4 success criteria are verified in code:

- BEAT-01: Audio export with FFmpeg muxing, AbortSignal timeout, async spawn_blocking — verified in code
- BEAT-02: BPM detection, beat markers on timeline, BPM persistence — verified in code and by 6 tests
- BEAT-03: Manual BPM adjustment, x2/div2, beat offset, re-detect — verified in AudioProperties.tsx
- BEAT-04: Snap-to-beat in FramesPopover (Plan 06 gap closure) — `snapHoldFramesToBeat` implemented with 5 tests, button wired in FramesPopover — NEWLY VERIFIED this re-verification
- BEAT-05: Auto-arrange hold frames with strategy selector — verified in AudioProperties.tsx, 5 tests pass

Phase 16 goal achieved in code. All remaining items require human/interactive testing.

---

_Verified: 2026-03-23T21:40:00Z_
_Verifier: Claude (gsd-verifier) — re-verification after Plan 06 (snap-to-beat gap closure)_
