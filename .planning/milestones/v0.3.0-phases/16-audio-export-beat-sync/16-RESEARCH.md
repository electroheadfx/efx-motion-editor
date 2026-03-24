# Phase 16: Audio Export & Beat Sync - Research

**Researched:** 2026-03-23
**Domain:** Web Audio API (OfflineAudioContext), FFmpeg audio muxing, BPM detection, Canvas 2D beat markers, timeline snapping
**Confidence:** HIGH

## Summary

Phase 16 covers four distinct subsystems: (1) audio export mixing via OfflineAudioContext and FFmpeg muxing, (2) BPM detection from AudioBuffer PCM data, (3) beat marker rendering on the Canvas 2D timeline, and (4) snap-to-beat and auto-arrange UX for key photo hold durations. All four subsystems build on Phase 15's audioEngine, audioStore, and timeline infrastructure. The existing FFmpeg pipeline in Rust needs an `audioPath` parameter added to `encode_video()` to mux a pre-rendered WAV alongside the video stream. The BPM detection algorithm runs purely in JS on Float32Array data -- no new dependencies needed for detection itself.

The project format must bump from v11 to v12 to persist BPM data (bpm, beatOffset, beatMarkers[]) on audio tracks, following the established `serde(default)` backward-compatibility pattern used in every prior version bump.

**Primary recommendation:** Implement in four logical waves -- (1) audio export mixing + FFmpeg muxing, (2) BPM detection + data model + project persistence, (3) beat marker rendering + toggle, (4) snap-to-beat + auto-arrange UX. Each wave is independently testable.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Pre-render all audio tracks to a single mixed WAV file using JS OfflineAudioContext before passing to FFmpeg -- guarantees fade curves and volume match preview playback exactly (what-you-hear-is-what-you-export)
- **D-02:** OfflineAudioContext reuses existing audioEngine fade/volume/offset logic -- no duplicate DSP code in Rust
- **D-03:** When exporting PNG sequences, include the mixed WAV file alongside the PNG folder for DaVinci Resolve / Premiere Pro post-production workflows
- **D-04:** Add "Include audio" checkbox in export settings panel -- lets users export video-only even when audio tracks exist. Muted tracks already excluded via their mute flag
- **D-05:** JS-side BPM detection directly on AudioBuffer PCM data (onset detection + autocorrelation on Float32Array) -- ~100-200ms for 5 min track, no IPC overhead
- **D-06:** Auto-detect BPM immediately after audio import -- results appear instantly, no manual trigger needed
- **D-07:** Store BPM data (bpm, beatOffset, beatMarkers[]) on AudioTrack interface, persist in .mce project format (bump to v12) so detection doesn't re-run on project reopen
- **D-08:** Manual BPM correction via numeric input field + x2 and /2 quick-fix buttons in audio properties panel, plus beat offset as separate numeric field (in frames)
- **D-09:** Thin semi-transparent vertical lines spanning full height of timeline -- from top of content tracks to bottom of audio tracks, like DAW grid lines
- **D-10:** Show every beat at all zoom levels; fade opacity progressively when zoomed out so markers don't overlap. Downbeats (beat 1 of bar) drawn slightly brighter/thicker
- **D-11:** Warm accent color (orange/amber) at ~20-30% opacity for regular beats, ~50% for downbeats -- distinct from teal (GL transitions) and purple (cross-dissolve)
- **D-12:** Toggle button (metronome/beat icon) on timeline toolbar to show/hide beat markers. State persists in project. Default: visible when BPM data exists
- **D-13:** Magnetic snap when dragging key photo hold-duration boundaries on timeline -- boundary snaps to nearest beat marker within pixel threshold. Toggle via magnet icon button near beat marker toggle. Note: sequences are built from cumulative hold durations, not freely positionable -- snap works on the boundary between two key photos, changing the hold frame count of the preceding key photo
- **D-14:** Auto-arrange action in audio properties panel -- "Auto-Arrange" section with strategy selector (every beat / every 2 beats / every bar) and Apply button. Natural location since beat data belongs to the audio track
- **D-15:** No confirmation dialog before auto-arrange -- apply immediately, Cmd+Z undoes the entire rearrange as a single undo step (matches existing bulk operation patterns)
- **D-16:** When more beats than key photos: distribute photos evenly across available beats, last photo holds through remaining beats. When more photos than beats: extra photos get minimum 1-beat hold duration

### Claude's Discretion
- Exact BPM detection algorithm details (onset function, autocorrelation window, peak picking)
- WAV temp file location and cleanup strategy
- FFmpeg audio muxing flags (-i audio.wav + video stream mapping)
- Beat marker pixel threshold for magnetic snap
- Auto-arrange animation or immediate application
- Export progress UI updates during audio pre-render step

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BEAT-01 | User can export video with audio included (FFmpeg muxing with fades applied) | OfflineAudioContext pre-render + FFmpeg `-i audio.wav -map 0:v -map 1:a` muxing. Rust `encode_video()` needs `audio_path: Option<String>` parameter. |
| BEAT-02 | User can detect BPM from imported audio and see beat markers on timeline | JS onset-detection + autocorrelation on Float32Array. Beat markers as Canvas 2D vertical lines in draw() pass. |
| BEAT-03 | User can manually set or adjust BPM and beat offset when detection is inaccurate | BPM numeric input + x2/div2 buttons + beat offset field in AudioProperties panel. Regenerate beatMarkers[] on change. |
| BEAT-04 | User can snap key photo hold-duration handles to nearest beat marker | Magnetic snap in TimelineInteraction pointer events during key photo boundary drag. |
| BEAT-05 | User can auto-arrange key photos to beat positions with strategy selector | Bulk holdFrames recalculation in sequenceStore with single pushAction for undo. |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Web Audio API (OfflineAudioContext) | Browser built-in | Pre-render mixed audio for export | Same DSP graph as preview playback; guarantees identical output |
| @preact/signals | In project | Reactive state for BPM data, beat markers visibility | Established store pattern |
| Canvas 2D | Browser built-in | Beat marker rendering on timeline | Existing TimelineRenderer pattern |
| FFmpeg (cached binary) | Latest snapshot | Video+audio muxing | Already cached at ~/.config/efx-motion/bin/ffmpeg |
| Tauri IPC | In project | Pass audio path to Rust FFmpeg wrapper | Existing exportEncodeVideo pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| audiobuffer-to-wav | 1.0.0 | Encode AudioBuffer to WAV ArrayBuffer | Export: convert OfflineAudioContext output to WAV for FFmpeg |
| @tauri-apps/plugin-fs | In project | Write WAV temp file to disk | Export: save mixed WAV before FFmpeg mux |
| lucide-preact | In project | Beat toggle icon, snap magnet icon | Timeline toolbar buttons |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| audiobuffer-to-wav | wav-file-encoder (1.0.4) | wav-file-encoder supports float32 but audiobuffer-to-wav is simpler (single function, 16-bit PCM is sufficient for export) |
| web-audio-beat-detector (8.2.36) | Custom JS onset+autocorrelation | Library adds ~50KB and uses OfflineAudioContext internally (IPC-like overhead). Custom implementation on raw Float32Array is faster (~100ms) and matches D-05. Use custom. |
| Custom BPM detection | bpm-detective (npm) | bpm-detective is limited to 90-180 BPM range and "dance music". Custom allows configurable range (60-200 BPM) needed for film scores. |

**Installation:**
```bash
cd Application && npm install audiobuffer-to-wav
```

**Version verification:** audiobuffer-to-wav@1.0.0 (confirmed via npm registry 2026-03-23). No TypeScript types bundled -- needs a `declare module` or inline types.

## Architecture Patterns

### Recommended Module Structure
```
src/
├── lib/
│   ├── audioExportMixer.ts      # OfflineAudioContext pre-render + WAV encoding
│   ├── bpmDetector.ts           # Onset detection + autocorrelation BPM algorithm
│   └── beatMarkerEngine.ts      # Compute beat marker frame positions from BPM + offset
├── stores/
│   └── audioStore.ts            # Extended: BPM fields on AudioTrack, beat marker toggle
├── components/
│   ├── sidebar/
│   │   └── AudioProperties.tsx  # Extended: BPM section, auto-arrange section
│   └── timeline/
│       ├── TimelineRenderer.ts  # Extended: beat marker draw pass
│       └── TimelineInteraction.ts  # Extended: snap-to-beat logic
└── types/
    ├── audio.ts                 # Extended: BPM fields on AudioTrack and MceAudioTrack
    └── export.ts                # Extended: includeAudio setting
```

### Pattern 1: OfflineAudioContext Pre-Render
**What:** Create an offline audio graph mirroring the real-time playback graph, render to a single AudioBuffer, encode as WAV.
**When to use:** Before FFmpeg encoding step in exportEngine.
**Example:**
```typescript
// audioExportMixer.ts
export async function renderMixedAudio(
  tracks: AudioTrack[],
  buffers: Map<string, AudioBuffer>,
  fps: number,
  totalDurationSec: number,
): Promise<ArrayBuffer> {
  // Determine sample rate from first track's buffer (or default 44100)
  const sampleRate = buffers.values().next().value?.sampleRate ?? 44100;
  const totalSamples = Math.ceil(totalDurationSec * sampleRate);
  const offline = new OfflineAudioContext(2, totalSamples, sampleRate);

  for (const track of tracks) {
    if (track.muted) continue;
    const buffer = buffers.get(track.id);
    if (!buffer) continue;

    const source = offline.createBufferSource();
    source.buffer = buffer;
    const gain = offline.createGain();
    // Reuse fade scheduling logic from audioEngine
    applyExportFadeSchedule(gain, track, fps, sampleRate);
    source.connect(gain);
    gain.connect(offline.destination);

    // Schedule source start/offset matching playback logic
    const startTimeSec = track.offsetFrame / fps;
    const sourceOffsetSec = (track.inFrame + track.slipOffset) / fps;
    const durationSec = (track.outFrame - track.inFrame) / fps;
    const when = Math.max(0, startTimeSec);
    source.start(when, sourceOffsetSec, durationSec);
  }

  const renderedBuffer = await offline.startRendering();
  // Encode to WAV using audiobuffer-to-wav
  return audioBufferToWav(renderedBuffer);
}
```

### Pattern 2: BPM Detection (Onset + Autocorrelation)
**What:** Compute energy onset function from PCM data, autocorrelate to find dominant period, convert to BPM.
**When to use:** Immediately after audio import (D-06), or when user triggers re-detection.
**Example:**
```typescript
// bpmDetector.ts
export function detectBPM(
  audioBuffer: AudioBuffer,
  options?: { minBPM?: number; maxBPM?: number }
): { bpm: number; confidence: number } {
  const minBPM = options?.minBPM ?? 60;
  const maxBPM = options?.maxBPM ?? 200;
  const channelData = audioBuffer.getChannelData(0); // mono analysis
  const sampleRate = audioBuffer.sampleRate;

  // 1. Compute energy in short windows (onset strength signal)
  const windowSize = Math.floor(sampleRate * 0.01); // 10ms windows
  const hopSize = windowSize / 2;
  const energies: number[] = [];
  for (let i = 0; i + windowSize < channelData.length; i += hopSize) {
    let energy = 0;
    for (let j = 0; j < windowSize; j++) {
      energy += channelData[i + j] ** 2;
    }
    energies.push(energy);
  }

  // 2. Compute onset detection function (half-wave rectified derivative)
  const onsets: number[] = [];
  for (let i = 1; i < energies.length; i++) {
    onsets.push(Math.max(0, energies[i] - energies[i - 1]));
  }

  // 3. Autocorrelate onset signal to find dominant period
  const minLag = Math.floor(60 / maxBPM * sampleRate / hopSize);
  const maxLag = Math.floor(60 / minBPM * sampleRate / hopSize);
  let bestLag = minLag;
  let bestCorrelation = -Infinity;

  for (let lag = minLag; lag <= maxLag && lag < onsets.length; lag++) {
    let correlation = 0;
    const count = Math.min(onsets.length - lag, 1000); // limit for perf
    for (let i = 0; i < count; i++) {
      correlation += onsets[i] * onsets[i + lag];
    }
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }

  const bpm = 60 / (bestLag * hopSize / sampleRate);
  const confidence = bestCorrelation;
  return { bpm: Math.round(bpm * 10) / 10, confidence };
}
```

### Pattern 3: Beat Marker Frame Computation
**What:** Given BPM and beat offset, compute an array of frame numbers where beats fall.
**When to use:** After BPM detection or manual BPM edit, stored on AudioTrack.
**Example:**
```typescript
// beatMarkerEngine.ts
export function computeBeatMarkers(
  bpm: number,
  beatOffsetFrames: number,
  fps: number,
  totalFrames: number,
): number[] {
  if (bpm <= 0) return [];
  const framesPerBeat = (60 / bpm) * fps;
  const markers: number[] = [];
  let frame = beatOffsetFrames;
  while (frame < totalFrames) {
    if (frame >= 0) markers.push(Math.round(frame));
    frame += framesPerBeat;
  }
  return markers;
}

export function computeDownbeatFrames(
  beatMarkers: number[],
  beatsPerBar: number = 4,
): Set<number> {
  const downbeats = new Set<number>();
  for (let i = 0; i < beatMarkers.length; i += beatsPerBar) {
    downbeats.add(beatMarkers[i]);
  }
  return downbeats;
}
```

### Pattern 4: FFmpeg Audio Muxing (Rust Side)
**What:** Extend `encode_video()` to accept optional audio path and mux with `-map` flags.
**When to use:** When video encoding is requested with "Include audio" enabled.
**Example:**
```rust
// In ffmpeg.rs encode_video(), when audio_path is Some:
if let Some(audio) = audio_path {
    cmd.args(["-i", &audio]);          // Second input: WAV file
    cmd.args(["-map", "0:v"]);         // Video from first input (PNG sequence)
    cmd.args(["-map", "1:a"]);         // Audio from second input (WAV)
    cmd.args(["-c:a", "aac"]);         // Encode audio as AAC for MP4
    cmd.args(["-b:a", "192k"]);        // Audio bitrate
} else {
    cmd.arg("-an");                    // No audio (existing behavior)
}
// ProRes: use -c:a pcm_s16le for uncompressed audio in MOV container
```

### Anti-Patterns to Avoid
- **Duplicating DSP code in Rust:** D-02 explicitly says no duplicate DSP. All audio mixing happens in JS via OfflineAudioContext. Rust only receives the final WAV path.
- **Using real AudioContext for export rendering:** OfflineAudioContext renders faster-than-realtime. Using a real AudioContext would take the full track duration.
- **Storing beat markers as absolute time instead of frames:** The project operates in frames. Store markers as frame numbers for direct comparison with key photo boundaries.
- **Recomputing beat markers on every draw call:** Compute once on BPM/offset change, store the array, read from store during rendering.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AudioBuffer to WAV encoding | Custom WAV header + PCM interleaving | `audiobuffer-to-wav` npm package | WAV header format has endianness and channel interleaving gotchas. Package handles 16-bit PCM correctly in 50 lines. |
| BPM detection | Use web-audio-beat-detector library | Custom onset+autocorrelation (~80 lines) | Library uses OfflineAudioContext internally (overhead), locked to 90-180 BPM range. Custom is faster, configurable, and matches D-05's "directly on Float32Array" mandate. |
| FFmpeg audio codec selection per container | Manual codec flag logic | Lookup table: MP4 -> AAC, MOV -> pcm_s16le | ProRes in MOV needs uncompressed PCM; H.264/AV1 in MP4 needs AAC. Wrong codec causes FFmpeg errors. |

**Key insight:** The only new npm dependency needed is `audiobuffer-to-wav` for WAV encoding. Everything else uses browser APIs (OfflineAudioContext, Canvas 2D) and existing project infrastructure.

## Common Pitfalls

### Pitfall 1: OfflineAudioContext Sample Count Precision
**What goes wrong:** `OfflineAudioContext(channels, length, sampleRate)` requires the length in samples. If you compute `totalDurationSec * sampleRate` and the result is fractional, the rendered buffer may be slightly short, cutting off the last beat of audio.
**Why it happens:** Float math: `(300 frames / 24 fps) * 44100 = 551250.0` is clean, but other fps values produce fractional sample counts.
**How to avoid:** Always `Math.ceil()` the sample count, and add a 0.5-second padding to totalDuration to prevent cut-off.
**Warning signs:** Exported audio ends abruptly before the last fade-out completes.

### Pitfall 2: OfflineAudioContext Source Start Time
**What goes wrong:** Audio tracks with negative `offsetFrame` (starting before frame 0) need their source `when` parameter set to 0, not a negative number. The `offset` parameter must compensate for the skipped portion.
**Why it happens:** `AudioBufferSourceNode.start(when, offset, duration)` -- `when` cannot be negative.
**How to avoid:** `const when = Math.max(0, startTimeSec); const offset = sourceOffsetSec + Math.max(0, -startTimeSec);`
**Warning signs:** Audio tracks with negative offsets are silent in the export.

### Pitfall 3: FFmpeg Audio Codec vs Container Mismatch
**What goes wrong:** Using AAC audio codec with MOV/ProRes container works but is non-standard for professional workflows. Using PCM in MP4 container causes playback issues.
**Why it happens:** Different containers have different "native" audio codecs.
**How to avoid:** Use a codec lookup: ProRes (.mov) -> `pcm_s16le`, H.264/AV1 (.mp4) -> `aac -b:a 192k`.
**Warning signs:** FFmpeg succeeds but exported video has no audio in some players.

### Pitfall 4: BPM Octave Error (Double/Half Tempo Detection)
**What goes wrong:** Autocorrelation finds the strongest periodicity at half or double the true tempo. A 120 BPM track may be detected as 60 BPM or 240 BPM.
**Why it happens:** The fundamental frequency and its harmonics are equally present in the autocorrelation.
**How to avoid:** Apply heuristic: if detected BPM < 80, try doubling. If > 160, try halving. This is also why D-08 includes x2 and /2 quick-fix buttons.
**Warning signs:** Beat markers visually don't align with audible beats; markers are at every other beat or between beats.

### Pitfall 5: Beat Marker Rendering Performance at Low Zoom
**What goes wrong:** At low zoom levels with long audio tracks, thousands of beat markers need rendering. Drawing 1000+ lines per frame kills draw performance.
**Why it happens:** No culling of off-screen markers.
**How to avoid:** Only draw markers whose X position falls within [TRACK_HEADER_WIDTH, canvasWidth]. Compute visible frame range from scrollX and canvasWidth, then iterate only markers in that range.
**Warning signs:** Timeline becomes sluggish when beat markers are visible on a long project.

### Pitfall 6: Magnetic Snap Conflicts with Existing Drag Behavior
**What goes wrong:** The snap-to-beat feature interferes with the existing key photo hold-duration resize behavior, causing jumpy or unexpected boundary movements.
**Why it happens:** The snap threshold must be in pixels (screen space), not frames, to feel consistent at all zoom levels. If computed in frames, snap becomes too aggressive at low zoom.
**How to avoid:** Convert snap threshold to frames dynamically: `snapThresholdFrames = snapThresholdPx / frameWidth`. Use ~8-12px as the pixel threshold, consistent with existing 8px hit-test thresholds in TimelineInteraction.
**Warning signs:** Boundaries jump to distant beat markers at low zoom levels.

### Pitfall 7: Auto-Arrange Undo Must Be Atomic
**What goes wrong:** Auto-arrange modifies holdFrames on every key photo in a sequence. If each modification creates a separate undo entry, Cmd+Z only undoes the last key photo change.
**Why it happens:** Each `sequenceStore.updateKeyPhoto()` call pushes an undo action.
**How to avoid:** Use `snapshot()/restore()` pattern: capture full state before, apply all changes in a batch, push a single undo action with the before/after snapshots. This matches the established pattern for bulk operations (see sequenceStore reorder).
**Warning signs:** User has to press Cmd+Z N times (once per key photo) to undo auto-arrange.

### Pitfall 8: WAV Temp File Not Cleaned Up
**What goes wrong:** The mixed WAV file written for FFmpeg muxing stays on disk after export, wasting space (potentially 100+ MB for long projects).
**Why it happens:** Export completes or errors without a cleanup step for the temp WAV.
**How to avoid:** Clean up the WAV file in a `finally` block after FFmpeg encoding completes (success or failure). For PNG export with included WAV (D-03), the WAV intentionally stays.
**Warning signs:** Export folder grows with orphaned WAV files.

## Code Examples

### Extending AudioTrack Type for BPM Data (D-07)
```typescript
// types/audio.ts -- add to AudioTrack interface
export interface AudioTrack {
  // ... existing fields ...
  bpm: number | null;              // Detected or manual BPM (null = not yet detected)
  beatOffsetFrames: number;        // Frame offset of first beat (default 0)
  beatMarkers: number[];           // Pre-computed frame numbers of each beat
  showBeatMarkers: boolean;        // Per-track toggle (default true when bpm exists)
}

// types/audio.ts -- add to MceAudioTrack interface
export interface MceAudioTrack {
  // ... existing fields ...
  bpm?: number | null;
  beat_offset_frames?: number;
  beat_markers?: number[];
  show_beat_markers?: boolean;
}
```

### ExportSettings Extension (D-04)
```typescript
// types/export.ts -- add to ExportSettings
export interface ExportSettings {
  // ... existing fields ...
  includeAudio: boolean;  // Default true; false = export video-only
}
```

### FFmpeg Rust Extension (audio_path parameter)
```rust
// services/ffmpeg.rs -- extend encode_video signature
pub fn encode_video(
    png_dir: &str,
    glob_pattern: &str,
    output_path: &str,
    codec: &str,
    fps: u32,
    quality_args: &VideoQualityArgs,
    audio_path: Option<&str>,  // NEW: path to pre-rendered WAV
) -> Result<(), String> {
    // ... existing setup ...
    if let Some(audio) = audio_path {
        cmd.args(["-i", audio]);
        cmd.args(["-map", "0:v:0", "-map", "1:a:0"]);
        // Codec depends on container
        match codec {
            "prores" => cmd.args(["-c:a", "pcm_s16le"]),
            _ => cmd.args(["-c:a", "aac", "-b:a", "192k"]),
        };
    } else {
        cmd.arg("-an");
    }
    // ... rest of encoding ...
}
```

### Beat Marker Canvas 2D Rendering
```typescript
// In TimelineRenderer.ts draw() method, after audio tracks, before playhead
private drawBeatMarkers(
  ctx: CanvasRenderingContext2D,
  beatMarkers: number[],
  downbeats: Set<number>,
  frameWidth: number,
  scrollX: number,
  canvasWidth: number,
  yTop: number,     // RULER_HEIGHT + fxOffset (top of content area)
  yBottom: number,  // Bottom of audio tracks area
): void {
  // Visible frame range for culling
  const startFrame = Math.floor(scrollX / frameWidth);
  const endFrame = Math.ceil((scrollX + canvasWidth - TRACK_HEADER_WIDTH) / frameWidth);

  // Fade opacity based on zoom: full at frameWidth >= 8, fading below
  const baseOpacity = Math.min(1, frameWidth / 8);

  for (const frame of beatMarkers) {
    if (frame < startFrame || frame > endFrame) continue;
    const x = frame * frameWidth - scrollX + TRACK_HEADER_WIDTH;
    if (x < TRACK_HEADER_WIDTH || x > canvasWidth) continue;

    const isDownbeat = downbeats.has(frame);
    const opacity = isDownbeat ? baseOpacity * 0.5 : baseOpacity * 0.25;
    const width = isDownbeat ? 1.5 : 0.5;

    ctx.strokeStyle = `rgba(245, 158, 11, ${opacity})`; // amber-500
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, yTop);
    ctx.lineTo(x, yBottom);
    ctx.stroke();
  }
}
```

### Auto-Arrange Algorithm (D-14, D-16)
```typescript
// In a new function, called from AudioProperties "Apply" button
export function autoArrangeToBeats(
  sequenceId: string,
  beatMarkers: number[],
  strategy: 'every-beat' | 'every-2-beats' | 'every-bar',
  fps: number,
  bpm: number,
): void {
  const seq = sequenceStore.getSequence(sequenceId);
  if (!seq || beatMarkers.length === 0) return;

  // Filter markers by strategy
  const stride = strategy === 'every-beat' ? 1
    : strategy === 'every-2-beats' ? 2 : 4;
  const targetBeats = beatMarkers.filter((_, i) => i % stride === 0);

  const keyPhotos = seq.keyPhotos;
  const framesPerBeat = (60 / bpm) * fps;

  // Snapshot for atomic undo
  const before = sequenceStore.snapshot();

  if (keyPhotos.length <= targetBeats.length) {
    // More beats than photos: distribute photos across beats
    const beatsPerPhoto = Math.floor(targetBeats.length / keyPhotos.length);
    for (let i = 0; i < keyPhotos.length; i++) {
      const startBeatIdx = i * beatsPerPhoto;
      const endBeatIdx = i < keyPhotos.length - 1
        ? (i + 1) * beatsPerPhoto
        : targetBeats.length;
      const holdFrames = targetBeats[endBeatIdx - 1] - targetBeats[startBeatIdx]
        + Math.round(framesPerBeat * stride);
      sequenceStore.updateKeyPhotoSilent(seq.id, keyPhotos[i].id, { holdFrames });
    }
  } else {
    // More photos than beats: each photo gets at least 1 beat duration
    for (let i = 0; i < keyPhotos.length; i++) {
      const holdFrames = Math.round(framesPerBeat * stride);
      sequenceStore.updateKeyPhotoSilent(seq.id, keyPhotos[i].id, { holdFrames });
    }
  }

  const after = sequenceStore.snapshot();
  pushAction({
    id: crypto.randomUUID(),
    description: `Auto-arrange to beats (${strategy})`,
    timestamp: Date.now(),
    undo: () => sequenceStore.restore(before),
    redo: () => sequenceStore.restore(after),
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `-an` flag in FFmpeg (no audio) | `-map 0:v -map 1:a` with separate audio input | This phase | Enables audio in exported video |
| No BPM data on AudioTrack | `bpm`, `beatOffsetFrames`, `beatMarkers[]` fields | This phase (v12) | Persists detection results |
| Project format v11 | v12 with optional BPM fields + `serde(default)` | This phase | Backward compat with v11 |
| OfflineAudioContext not used | Used for export audio pre-render | This phase | What-you-hear-is-what-you-export |

**Deprecated/outdated:**
- Nothing deprecated. This phase adds new capabilities to existing infrastructure.

## Open Questions

1. **Auto-arrange target sequence selection**
   - What we know: D-14 says auto-arrange is in audio properties panel. User must select which content sequence to arrange.
   - What's unclear: If multiple content sequences exist, which one does the "Apply" button target? The first? The selected one?
   - Recommendation: Target the currently selected content sequence (from uiStore/sequenceStore). If no content sequence is selected, disable the Apply button. This is the least surprising behavior.

2. **Beat markers from multiple audio tracks**
   - What we know: D-07 stores BPM data per audio track. D-09 says markers span full timeline height.
   - What's unclear: If multiple audio tracks have different BPMs, do we show all markers or only from the selected track?
   - Recommendation: Show markers only from the selected audio track (matching D-12's toggle being per-track). This avoids visual chaos from conflicting beat grids.

3. **WAV sample rate for export**
   - What we know: D-01 says pre-render to WAV. Different audio files may have different sample rates (44100 vs 48000).
   - What's unclear: Should the OfflineAudioContext use the highest sample rate among all tracks, or a fixed rate?
   - Recommendation: Use 48000 Hz (professional video standard). OfflineAudioContext resamples internally. This avoids FFmpeg resampling artifacts.

## Project Constraints (from CLAUDE.md)

- GSD tools from `.claude/get-shit-done` (not from `$HOME/.claude/get-shit-done`)
- Do not run the server

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| FFmpeg (cached binary) | BEAT-01 audio muxing | Conditional (downloaded on first export) | Latest snapshot | Auto-download via existing `exportDownloadFfmpeg()` |
| OfflineAudioContext | BEAT-01 audio pre-render | Yes (browser built-in) | Web Audio API | -- |
| audiobuffer-to-wav | BEAT-01 WAV encoding | No (needs `npm install`) | 1.0.0 | -- |
| Canvas 2D | BEAT-02 beat markers | Yes (browser built-in) | -- | -- |
| @tauri-apps/plugin-fs | BEAT-01 WAV write | Yes (in project) | -- | -- |

**Missing dependencies with no fallback:**
- `audiobuffer-to-wav` must be installed via npm (Wave 0 task)

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^2.1.9 |
| Config file | Application/vitest.config.ts |
| Quick run command | `cd Application && npx vitest run --reporter=verbose` |
| Full suite command | `cd Application && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BEAT-01 | OfflineAudioContext pre-render produces correct AudioBuffer | unit | `cd Application && npx vitest run src/lib/audioExportMixer.test.ts -x` | Wave 0 |
| BEAT-01 | FFmpeg muxing with audio path parameter | manual-only | Manual: export with audio, verify playback | -- |
| BEAT-02 | BPM detection returns correct BPM for known-tempo audio | unit | `cd Application && npx vitest run src/lib/bpmDetector.test.ts -x` | Wave 0 |
| BEAT-02 | Beat markers computed correctly from BPM+offset | unit | `cd Application && npx vitest run src/lib/beatMarkerEngine.test.ts -x` | Wave 0 |
| BEAT-03 | x2/div2 correctly doubles/halves BPM and regenerates markers | unit | `cd Application && npx vitest run src/lib/beatMarkerEngine.test.ts -x` | Wave 0 |
| BEAT-04 | Snap-to-beat returns nearest marker within threshold | unit | `cd Application && npx vitest run src/lib/beatMarkerEngine.test.ts -x` | Wave 0 |
| BEAT-05 | Auto-arrange distributes key photos across beats correctly | unit | `cd Application && npx vitest run src/lib/beatMarkerEngine.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd Application && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd Application && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/audioExportMixer.test.ts` -- covers BEAT-01 (OfflineAudioContext rendering)
- [ ] `src/lib/bpmDetector.test.ts` -- covers BEAT-02 (BPM detection algorithm)
- [ ] `src/lib/beatMarkerEngine.test.ts` -- covers BEAT-02/03/04/05 (marker computation, snap, auto-arrange)
- [ ] `npm install audiobuffer-to-wav` -- dependency install

## Sources

### Primary (HIGH confidence)
- [MDN OfflineAudioContext](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext) -- constructor, startRendering(), AudioBuffer result
- [FFmpeg documentation](https://ffmpeg.org/ffmpeg.html) -- `-map`, `-c:a`, audio muxing flags
- [Mux: How to combine audio and video files with FFmpeg](https://www.mux.com/articles/merge-audio-and-video-files-with-ffmpeg) -- practical muxing command patterns
- Codebase: `Application/src/lib/audioEngine.ts` -- existing fade scheduling and playback logic
- Codebase: `Application/src-tauri/src/services/ffmpeg.rs` -- existing encode_video with `-an` flag
- Codebase: `Application/src/components/timeline/TimelineRenderer.ts` -- Canvas 2D draw pattern

### Secondary (MEDIUM confidence)
- [audiobuffer-to-wav npm](https://www.npmjs.com/package/audiobuffer-to-wav) -- v1.0.0, 16-bit PCM encoding
- [web-audio-beat-detector](https://github.com/chrisguttandin/web-audio-beat-detector) -- API reference (decided NOT to use, but informed algorithm design)
- [JM Perez: Finding out the BPM of a song using Javascript](https://jmperezperez.com/beats-audio-api/) -- onset detection + peak interval approach
- [Streaming Learning Center: FFmpeg Muxing](https://streaminglearningcenter.com/learning/ffmpeg-to-the-rescue-muxing-audio-and-video-files.html) -- container-codec compatibility

### Tertiary (LOW confidence)
- [DEV.to: Real-Time Beat Detection](https://dev.to/hacker_ea/real-time-beat-detection-in-web-based-dj-applications-40p3) -- spectral flux approach (not used, but confirmed onset detection approach is standard)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- uses browser built-ins (OfflineAudioContext, Canvas 2D) + one tiny npm package. FFmpeg muxing flags well-documented.
- Architecture: HIGH -- extends existing patterns (audioEngine fade logic, TimelineRenderer draw pass, audioStore signal/undo). No new architectural concepts.
- Pitfalls: HIGH -- pitfalls are concrete and based on real Web Audio API and FFmpeg behaviors. Octave error in BPM detection is the most well-known challenge.

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable -- Web Audio API and FFmpeg are mature)
