# Phase 16: Audio Export & Beat Sync - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 16-Audio Export & Beat Sync
**Areas discussed:** Audio export mixing, BPM detection approach, Beat marker display, Snap & auto-arrange UX

---

## Audio Export Mixing

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-render to WAV | Mix all tracks in JS (OfflineAudioContext), apply fades/volume/offsets, write single WAV temp file, then pass to FFmpeg for muxing. Guarantees fade curves match preview playback. | ✓ |
| FFmpeg filter_complex | Pass each audio file + params to FFmpeg for mixing. More complex command, avoids temp WAV. Risk: fade curves may not match Web Audio playback. | |
| You decide | Claude picks best approach. | |

**User's choice:** Pre-render to WAV
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| JS OfflineAudioContext | Reuses existing audioEngine fade/volume logic. AudioBuffers already cached. What-you-hear-is-what-you-export. | ✓ |
| Rust-side mixing | Faster for very long audio. Requires reimplementing fade curves in Rust. Risk of preview/export drift. | |
| You decide | Claude picks. | |

**User's choice:** JS OfflineAudioContext
**Notes:** User asked for clarification on OfflineAudioContext vs Rust-side mixing. Explained: OfflineAudioContext renders through same Web Audio nodes at max speed (not real-time), reusing existing fade code. Rust would require duplicate DSP implementation.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, export WAV alongside PNGs | DaVinci Resolve / Premiere Pro users can import both. Useful for post-production. | ✓ |
| No, audio only with video formats | PNG export stays visual-only. Simpler but less useful. | |
| You decide | Claude picks. | |

**User's choice:** Yes, export WAV alongside PNGs

| Option | Description | Selected |
|--------|-------------|----------|
| Always include if tracks exist | Simpler UX. Muted tracks excluded via mute flag. | |
| Add checkbox in export settings | Explicit 'Include audio' toggle. Lets users export video-only when audio tracks exist. | ✓ |
| You decide | Claude picks. | |

**User's choice:** Add checkbox in export settings

---

## BPM Detection Approach

| Option | Description | Selected |
|--------|-------------|----------|
| JS on AudioBuffer data | Onset detection + autocorrelation on Float32Array. ~100-200ms for 5 min. No IPC overhead. | ✓ |
| Rust-side DSP library | More accurate for edge cases. Requires IPC transfer. | |
| You decide | Claude picks. | |

**User's choice:** JS on AudioBuffer data
**Notes:** User asked about performance of 5 min audio analysis. Explained: ~100-200ms because AudioBuffer PCM data is already decoded in memory, onset detection is O(n) on ~13M samples, autocorrelation on onset signal is fast.

| Option | Description | Selected |
|--------|-------------|----------|
| Auto on import | Detect immediately after import (~200ms). User sees beat markers right away. | ✓ |
| Manual button press | User clicks 'Detect BPM' in properties. More control but extra step. | |
| Both — auto + re-detect | Auto-detect on import, plus re-detect button. | |

**User's choice:** Auto on import

| Option | Description | Selected |
|--------|-------------|----------|
| On AudioTrack + persist in .mce | Add bpm, beatOffset, beatMarkers[] to AudioTrack. Project format v12. | ✓ |
| Separate beatStore | New dedicated store. More flexible but more architecture. | |
| You decide | Claude picks. | |

**User's choice:** On AudioTrack + persist in .mce

| Option | Description | Selected |
|--------|-------------|----------|
| Numeric input + x2/÷2 buttons | BPM field + quick-fix buttons in properties. Beat offset as separate field. | ✓ |
| Tap tempo | Tap button to the beat. More musical but less precise. | |
| Both — numeric + tap tempo | Covers both workflows. More UI surface. | |

**User's choice:** Numeric input + x2/÷2 buttons

---

## Beat Marker Display

| Option | Description | Selected |
|--------|-------------|----------|
| Thin vertical lines, full height | Semi-transparent lines spanning content through audio tracks. Like DAW grid lines. | ✓ |
| Short ticks at top | Tick marks in dedicated ruler row. Less clutter but extra row. | |
| Dots on waveform | Small dots on audio waveform at beat positions. Minimal but only on audio tracks. | |

**User's choice:** Thin vertical lines, full height

| Option | Description | Selected |
|--------|-------------|----------|
| Show every beat, fade at extremes | Always show every beat. Reduce opacity when zoomed out. Downbeats brighter/thicker. | ✓ |
| Adaptive — beats then bars | Every beat zoomed in, bar lines only zoomed out. | |
| User toggle for density | Dropdown for beat/2-beat/bar density. Most flexible. | |

**User's choice:** Show every beat, fade at extremes

| Option | Description | Selected |
|--------|-------------|----------|
| Accent color with low opacity | Orange/amber ~20-30% opacity, ~50% for downbeats. Distinct from teal/purple. | ✓ |
| White/gray neutral | Light gray at low opacity. Very subtle. | |
| You decide | Claude picks from theme CSS variables. | |

**User's choice:** Accent color with low opacity

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle button on timeline | Metronome icon, click to show/hide. State persists. Default visible when BPM exists. | ✓ |
| Always visible when BPM exists | No toggle. Simpler but no declutter option. | |
| You decide | Claude picks. | |

**User's choice:** Toggle button on timeline

---

## Snap & Auto-Arrange UX

| Option | Description | Selected |
|--------|-------------|----------|
| Magnetic snap on boundary drag | Key photo boundary snaps to nearest beat during drag. Magnet icon toggle. | ✓ |
| Hold modifier key to snap | Hold Shift during drag. No persistent toggle. | |
| No drag snap — auto-arrange only | Skip snapping, rely on auto-arrange for alignment. | |

**User's choice:** Magnetic snap on boundary drag
**Notes:** User clarified important point — sequences are built from cumulative key photo hold durations, not freely positionable like layers. Snap-to-beat applies to the boundary between key photos (resizing hold duration), not to dragging whole sequences. Questions were reframed to reflect this.

| Option | Description | Selected |
|--------|-------------|----------|
| Button in audio properties panel | Auto-Arrange section with strategy selector + Apply. Natural since beat data is on audio track. | ✓ |
| Right-click context menu on sequence | Contextual to sequence being arranged. | |
| Timeline toolbar button | Dedicated button with popover. Always accessible. | |

**User's choice:** Button in audio properties panel

| Option | Description | Selected |
|--------|-------------|----------|
| No confirmation — rely on undo | Apply immediately. Cmd+Z undoes entire rearrange. Matches existing patterns. | ✓ |
| Preview confirmation dialog | Summary of changes with Apply/Cancel. Safer but adds friction. | |
| You decide | Claude picks. | |

**User's choice:** No confirmation — rely on undo

| Option | Description | Selected |
|--------|-------------|----------|
| Distribute evenly, ignore extras | 8 photos + 24 beats: first 8 beats get photos, rest empty. More photos than beats: minimum 1-beat hold. | ✓ |
| Stretch/compress to fill | All beats and photos used. Some holds longer/shorter. More musical but less predictable. | |
| You decide | Claude picks. | |

**User's choice:** Distribute evenly, ignore extras

---

## Claude's Discretion

- BPM detection algorithm internals (onset function, autocorrelation window, peak picking)
- WAV temp file location and cleanup
- FFmpeg audio muxing flags
- Beat marker snap pixel threshold
- Auto-arrange application (animated vs immediate)
- Export progress UI during audio pre-render

## Deferred Ideas

None — discussion stayed within phase scope
