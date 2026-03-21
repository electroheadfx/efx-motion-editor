# Phase 15: Audio Import & Waveform - Research

**Researched:** 2026-03-21
**Domain:** Web Audio API, waveform visualization, audio-visual sync in Tauri/Preact
**Confidence:** HIGH

## Summary

Phase 15 introduces audio import, waveform visualization, playback sync, and persistence into the EFX Motion Editor. The editor is a Tauri v2 + Preact + Preact Signals app with a Canvas 2D timeline renderer. Audio tracks are a new entity type (not a sequence kind), living in their own `audioStore` with the same signal/snapshot/undo pattern as `sequenceStore`.

The Web Audio API provides everything needed: `AudioContext.decodeAudioData()` decodes files into `AudioBuffer` for waveform extraction, `AudioBufferSourceNode` plays decoded audio with sample-accurate start/stop/seek, and `GainNode` handles volume and fades. No external audio libraries are needed -- the browser APIs are sufficient and well-matched to the requirements.

The three key technical challenges are: (1) pre-computing multi-resolution waveform peaks from decoded AudioBuffer data for smooth zoom, (2) synchronizing audio playback start/stop/seek with the existing rAF-based PlaybackEngine, and (3) rendering audio tracks in the existing Canvas 2D TimelineRenderer below the FX track section.

**Primary recommendation:** Use Web Audio API directly (AudioContext + AudioBufferSourceNode + GainNode) for playback and `decodeAudioData()` for waveform extraction. Pre-compute 3 resolution tiers of peak data from the decoded AudioBuffer. Copy audio files into the project directory (`audio/` subfolder) for portability. Store audio track metadata in a new `audio_tracks` array on MceProject v8.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 40-48px default track height, user-resizable via drag handle
- **D-02:** Solid filled waveform in accent color (e.g., teal/cyan); style configurable between solid fill and outline-only via parameter
- **D-03:** Always mono (mixed-down) display -- no stereo split
- **D-04:** 3 resolution tiers for zoom: (1) extreme zoom-out shows peak envelope, (2) 100% shows standard waveform, (3) zoomed-in shows detailed waveform
- **D-05:** Subtle center line (zero-crossing hairline) drawn through waveform
- **D-06:** Audio tracks fixed at bottom of timeline, below all visual tracks (FX, content-overlay)
- **D-07:** Multiple audio tracks reorderable among themselves (drag to reorder)
- **D-08:** Track has clear start/end edges like FX range bars, with waveform rendered inside
- **D-09:** Audio content is slideable/slippable within the defined edges -- user can pan audio left/right inside the in/out range
- **D-10:** Track edges (in/out points) are adjustable
- **D-11:** Muted tracks shown at dimmed opacity (~30%)
- **D-12:** Selected track uses same highlight style as sequence selection (colored border/tint)
- **D-13:** Properties panel on the right, shown when audio track is selected on timeline -- no sidebar audio list
- **D-14:** Properties panel shows: track name (editable), file name (read-only) + "Replace..." button, volume (vertical slider + numeric drag-to-adjust), mute toggle, fade in/out duration (numeric drag-to-adjust), offset in frames (numeric), track edges/in-out points (numeric)
- **D-15:** Track label on timeline with clickable name that toggles mute
- **D-16:** Click waveform on timeline to select track and show its properties
- **D-17:** "Add Audio" button on the timeline near the FX add button -- opens native file picker filtered to audio formats (WAV, MP3, AAC, FLAC)
- **D-18:** Same UX pattern as adding content layers / FX layers (intent-driven flow, no drag-and-drop for audio)
- **D-19:** Multiple audio tracks per project supported (music, background, FX audio)
- **D-20:** Fades work exactly like existing fades on FX layers, content overlays, and sequences -- same controls, same interaction model, same visual representation
- **D-21:** Fade curve presets: linear, exponential, logarithmic -- default to exponential
- **D-22:** No limit on fade length -- fades can span entire track duration

### Claude's Discretion
- Web Audio API vs HTMLAudioElement implementation choice
- Waveform pre-computation strategy (Rust backend vs JS AudioContext.decodeAudioData)
- Exact accent color for waveform (should contrast with FX track colors)
- Audio file copy strategy (copy into project directory vs reference external path)
- Exact resize handle interaction for track height
- audioStore internal signal architecture

### Deferred Ideas (OUT OF SCOPE)
- Audio in video export (FFmpeg muxing with fades) -- Phase 16
- Beat sync, BPM detection, beat markers -- Phase 16
- Snap-to-beat and auto-arrange key photos -- Phase 16
- Audio voiceover recording -- Future (AUDX-02)
- Audio time-stretch -- Out of scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUDIO-01 | Import audio files (WAV, MP3, AAC, FLAC) via file dialog and drag-and-drop | Tauri `@tauri-apps/plugin-dialog` open() with audio extension filters; `@tauri-apps/plugin-fs` copyFile() to copy into project `audio/` dir; note CONTEXT says no drag-and-drop -- file dialog only per D-18 |
| AUDIO-02 | Waveform visualization on timeline below content/FX tracks | Web Audio API `decodeAudioData()` produces AudioBuffer; extract peak data at 3 resolution tiers; render in Canvas 2D TimelineRenderer below FX tracks per D-06 |
| AUDIO-03 | Audio plays in sync with visual preview (play, stop, seek) | Web Audio API `AudioBufferSourceNode.start(when, offset)` for sample-accurate playback; sync via PlaybackEngine.start/stop/tick hooks; `audioContext.currentTime` for drift-free timing |
| AUDIO-04 | Volume and mute/unmute controls | `GainNode.gain.value` for volume (0-1 linear); mute = set gain to 0 (preserve volume state for unmute); UI in properties panel per D-14 |
| AUDIO-05 | Drag audio track to offset relative to frame 0 | Track `offsetFrame` property; drag interaction in TimelineInteraction (same pattern as FX range bar move); convert frame offset to seconds for AudioBufferSourceNode.start offset |
| AUDIO-06 | Fade-in and fade-out duration on audio | `GainNode.gain.linearRampToValueAtTime()` / `exponentialRampToValueAtTime()` for real-time fade application; reuse existing transition UI controls per D-20; fade rendered as overlay on waveform bar |
| AUDIO-07 | Audio track persists in project file (.mce v8) | New `audio_tracks` array on MceProject; version bump to 8; audio file stored as relative path in project `audio/` dir; backward compat via `#[serde(default)]` on Rust side |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Web Audio API (browser) | N/A (built-in) | Audio decode, playback, volume, fades | Native browser API; no dependencies; sample-accurate timing; supports all target formats |
| @tauri-apps/plugin-dialog | ^2.6.0 | Native file picker for audio import | Already in project; provides extension filters |
| @tauri-apps/plugin-fs | ^2.4.5 | Copy audio files into project directory | Already in project; provides copyFile() |
| @preact/signals | ^2.8.1 | Reactive state for audioStore | Already in project; matches all other stores |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | - | Web Audio API covers all audio needs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Web Audio API (AudioBufferSourceNode) | HTMLAudioElement | HTMLAudioElement is simpler but lacks sample-accurate seek, cannot extract waveform data, and cannot apply GainNode fades programmatically. **Recommendation: Use Web Audio API.** |
| Browser-side decodeAudioData | Rust-side waveform extraction | Rust crate (e.g., `hound`, `symphonia`) could pre-compute peaks, but adds Rust build complexity and requires IPC for large data transfer. Browser `decodeAudioData` is fast enough for audio files under ~30 minutes and produces an AudioBuffer we need anyway for playback. **Recommendation: Browser-side.** |
| BBC peaks.js / waveform-data.js | Custom peak extraction | peaks.js is a full widget with its own DOM rendering; we need peaks data rendered in our existing Canvas 2D timeline. waveform-data.js is data-only but adds a dependency for ~50 lines of peak extraction code. **Recommendation: Custom peak extraction (trivial).** |

**Installation:**
```bash
# No new dependencies needed -- all APIs are already available
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  stores/
    audioStore.ts          # NEW: Audio track state, CRUD, snapshot/restore undo
  types/
    audio.ts               # NEW: AudioTrack, AudioTrackPeaks, MceAudioTrack interfaces
    project.ts             # MODIFIED: MceProject gets audio_tracks field
    timeline.ts            # MODIFIED: AudioTrackLayout interface added
  lib/
    audioEngine.ts         # NEW: Web Audio API wrapper (decode, play, stop, seek, fade)
    audioWaveform.ts       # NEW: Peak extraction from AudioBuffer, multi-resolution tiers
    frameMap.ts            # MODIFIED: audioTrackLayouts computed signal
    playbackEngine.ts      # MODIFIED: Hook audio start/stop/seek
  components/
    timeline/
      TimelineRenderer.ts  # MODIFIED: Draw audio tracks below FX tracks
      TimelineInteraction.ts # MODIFIED: Audio track click, drag, resize hit-testing
      AddFxMenu.tsx         # NOT modified (separate button per D-17)
      AddAudioButton.tsx    # NEW: "Add Audio" button in TimelinePanel controls bar
    sidebar/
      AudioProperties.tsx   # NEW: Properties panel for selected audio track
    layout/
      TimelinePanel.tsx     # MODIFIED: Add Audio button next to Add Layer
      LeftPanel.tsx          # MODIFIED: Show AudioProperties when audio track selected
```

### Pattern 1: audioStore (Signal Store with Snapshot/Restore Undo)
**What:** Dedicated store for audio tracks following the exact same pattern as sequenceStore
**When to use:** All audio track CRUD operations
**Example:**
```typescript
// Pattern from sequenceStore.ts -- audioStore follows identically
import { signal, batch } from '@preact/signals';
import { pushAction } from '../lib/history';

interface AudioTrack {
  id: string;
  name: string;
  filePath: string;           // Absolute path to audio file
  relativePath: string;       // Relative path within project (for .mce)
  originalFilename: string;   // Original filename for display
  offsetFrame: number;        // Start position on timeline (frame 0 = project start)
  inFrame: number;            // Trim in-point (frames from audio start)
  outFrame: number;           // Trim out-point (frames from audio start)
  volume: number;             // 0-1 linear
  muted: boolean;
  fadeInFrames: number;       // Fade-in duration in frames
  fadeOutFrames: number;      // Fade-out duration in frames
  fadeInCurve: 'linear' | 'exponential' | 'logarithmic';
  fadeOutCurve: 'linear' | 'exponential' | 'logarithmic';
  sampleRate: number;         // From decoded AudioBuffer
  duration: number;           // Total duration in seconds
  channelCount: number;       // For metadata display
  order: number;              // Reorder position among audio tracks
}

const tracks = signal<AudioTrack[]>([]);
const selectedTrackId = signal<string | null>(null);

function snapshot() {
  return { tracks: structuredClone(tracks.peek()), selected: selectedTrackId.peek() };
}
function restore(snap: { tracks: AudioTrack[]; selected: string | null }) {
  batch(() => { tracks.value = snap.tracks; selectedTrackId.value = snap.selected; });
  markDirty();
}
```

### Pattern 2: audioEngine (Web Audio API Wrapper)
**What:** Encapsulates AudioContext lifecycle, AudioBufferSourceNode management, GainNode volume/fades
**When to use:** All audio playback operations
**Example:**
```typescript
// audioEngine.ts -- singleton managing Web Audio API state
class AudioEngine {
  private ctx: AudioContext | null = null;
  private sources: Map<string, AudioBufferSourceNode> = new Map();
  private gains: Map<string, GainNode> = new Map();
  private buffers: Map<string, AudioBuffer> = new Map();

  /** Lazy-init AudioContext (must be after user gesture) */
  private ensureContext(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  /** Decode audio file into AudioBuffer and cache it */
  async decode(trackId: string, arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    const ctx = this.ensureContext();
    const buffer = await ctx.decodeAudioData(arrayBuffer);
    this.buffers.set(trackId, buffer);
    return buffer;
  }

  /** Start playback from a specific time offset */
  play(trackId: string, offsetSeconds: number): void {
    const ctx = this.ensureContext();
    const buffer = this.buffers.get(trackId);
    if (!buffer) return;

    // AudioBufferSourceNode is one-shot; create fresh each play
    this.stop(trackId);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    source.connect(gain);
    gain.connect(ctx.destination);

    this.sources.set(trackId, source);
    this.gains.set(trackId, gain);

    source.start(0, offsetSeconds);
  }

  /** Stop playback */
  stop(trackId: string): void {
    const source = this.sources.get(trackId);
    if (source) {
      try { source.stop(); } catch (_) { /* already stopped */ }
      source.disconnect();
      this.sources.delete(trackId);
    }
  }

  /** Set volume (0-1) */
  setVolume(trackId: string, volume: number): void {
    const gain = this.gains.get(trackId);
    if (gain) gain.gain.value = volume;
  }
}
```

### Pattern 3: Multi-Resolution Waveform Peaks
**What:** Pre-compute 3 tiers of peak data from AudioBuffer for zoom-dependent rendering
**When to use:** After decodeAudioData completes
**Example:**
```typescript
// audioWaveform.ts
interface WaveformPeaks {
  tier1: Float32Array; // Peak envelope: ~100 samples (extreme zoom-out)
  tier2: Float32Array; // Standard: ~2000 samples (100% zoom)
  tier3: Float32Array; // Detailed: ~8000 samples (zoomed-in)
}

function extractPeaks(buffer: AudioBuffer, samplesPerTier: number): Float32Array {
  // Mix down to mono per D-03
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length;
  const mono = new Float32Array(length);

  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i] += channelData[i] / numChannels;
    }
  }

  // Downsample to peaks (min/max per bucket)
  const bucketSize = Math.ceil(length / samplesPerTier);
  const peaks = new Float32Array(samplesPerTier * 2); // [min, max, min, max, ...]

  for (let i = 0; i < samplesPerTier; i++) {
    let min = 1.0, max = -1.0;
    const start = i * bucketSize;
    const end = Math.min(start + bucketSize, length);
    for (let j = start; j < end; j++) {
      if (mono[j] < min) min = mono[j];
      if (mono[j] > max) max = mono[j];
    }
    peaks[i * 2] = min;
    peaks[i * 2 + 1] = max;
  }

  return peaks;
}

export function computeWaveformPeaks(buffer: AudioBuffer): WaveformPeaks {
  return {
    tier1: extractPeaks(buffer, 100),
    tier2: extractPeaks(buffer, 2000),
    tier3: extractPeaks(buffer, 8000),
  };
}
```

### Pattern 4: PlaybackEngine Audio Sync Integration
**What:** Hook audio play/pause/seek into existing rAF-based PlaybackEngine
**When to use:** PlaybackEngine.start(), .stop(), .seekToFrame()
**Example:**
```typescript
// In PlaybackEngine -- additions to existing methods
start() {
  // ... existing code ...
  // Start all unmuted audio tracks at correct offset
  const currentFrame = timelineStore.currentFrame.peek();
  const fps = projectStore.fps.peek();
  for (const track of audioStore.tracks.peek()) {
    if (!track.muted) {
      const timeOffset = (currentFrame - track.offsetFrame) / fps;
      if (timeOffset >= 0 && timeOffset < track.duration) {
        audioEngine.play(track.id, timeOffset);
        audioEngine.applyFades(track);
        audioEngine.setVolume(track.id, track.volume);
      }
    }
  }
}

stop() {
  // ... existing code ...
  audioEngine.stopAll();
}

seekToFrame(frame: number) {
  // ... existing code ...
  // If playing, restart audio at new position
  if (timelineStore.isPlaying.peek()) {
    audioEngine.stopAll();
    // Re-start from new frame position (same logic as start)
  }
}
```

### Pattern 5: Audio Track Rendering in TimelineRenderer
**What:** Draw audio tracks below FX tracks in the existing Canvas 2D pipeline
**When to use:** TimelineRenderer.draw() -- after FX tracks, before playhead
**Example:**
```typescript
// New constant for audio track rendering
export const AUDIO_TRACK_HEIGHT = 44; // Default per D-01 (40-48px)

// In DrawState interface -- add audio fields
audioTracks?: AudioTrackLayout[];
selectedAudioTrackId?: string | null;

// AudioTrackLayout (in types/timeline.ts)
interface AudioTrackLayout {
  trackId: string;
  trackName: string;
  offsetFrame: number;   // Global timeline position
  inFrame: number;       // Trim in-point
  outFrame: number;      // Trim out-point
  muted: boolean;
  peaks: WaveformPeaks;  // Pre-computed peak data
  color: string;         // Accent color (teal/cyan)
}
```

### Pattern 6: Project Format v8 Migration
**What:** Add `audio_tracks` array to MceProject, bump version to 8
**When to use:** buildMceProject() serialization, hydrateFromMce() deserialization
**Example:**
```typescript
// TypeScript MceProject addition
interface MceProject {
  // ... existing fields ...
  audio_tracks?: MceAudioTrack[]; // Optional for backward compat with v7
}

interface MceAudioTrack {
  id: string;
  name: string;
  relative_path: string;
  original_filename: string;
  offset_frame: number;
  in_frame: number;
  out_frame: number;
  volume: number;
  muted: boolean;
  fade_in_frames: number;
  fade_out_frames: number;
  fade_in_curve: string;
  fade_out_curve: string;
  sample_rate: number;
  duration: number;
  channel_count: number;
  order: number;
}
```

```rust
// Rust MceProject addition (models/project.rs)
pub struct MceProject {
    // ... existing fields ...
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub audio_tracks: Vec<MceAudioTrack>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceAudioTrack {
    pub id: String,
    pub name: String,
    pub relative_path: String,
    pub original_filename: String,
    pub offset_frame: i32,  // Can be negative (audio starts before frame 0)
    pub in_frame: u32,
    pub out_frame: u32,
    pub volume: f64,
    pub muted: bool,
    pub fade_in_frames: u32,
    pub fade_out_frames: u32,
    pub fade_in_curve: String,
    pub fade_out_curve: String,
    pub sample_rate: u32,
    pub duration: f64,
    pub channel_count: u32,
    pub order: u32,
}
```

### Anti-Patterns to Avoid
- **Making audio tracks a sequence kind:** Audio tracks are NOT sequences (no keyPhotos, no layers). They must be a separate entity with their own store. The sequence discriminator is already `'content' | 'fx' | 'content-overlay'` -- audio does not fit.
- **Using AnalyserNode for waveform:** AnalyserNode provides real-time frequency data, not pre-computed waveform peaks. It's for live visualizers, not timeline waveform display.
- **Referencing external audio paths:** Audio files should be copied into the project directory for portability (same strategy as images). External path references break when projects are moved.
- **Creating AudioContext on page load:** AudioContext requires a user gesture to start. Lazy-initialize on first audio import or play action.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio decoding (WAV, MP3, AAC, FLAC) | Custom decoder | `AudioContext.decodeAudioData()` | Browser handles all codec support; FFmpeg not needed for decode |
| Audio playback with seek | Custom audio scheduler | `AudioBufferSourceNode.start(0, offsetSeconds)` | Sample-accurate timing built into Web Audio API |
| Volume control | Manual sample multiplication | `GainNode.gain.value` | Hardware-accelerated, runs on audio thread |
| Fade curves | Manual gain envelope | `GainNode.gain.linearRampToValueAtTime()` / `exponentialRampToValueAtTime()` | Runs on audio thread; glitch-free; sub-sample accuracy |
| File copy to project dir | Manual read/write | `@tauri-apps/plugin-fs` `copyFile()` | Already in project; handles cross-volume copies |
| Native file picker | Custom file browser | `@tauri-apps/plugin-dialog` `open()` | Already in project; native OS dialog with extension filters |

**Key insight:** The Web Audio API is remarkably complete for this use case. All playback, volume, fade, and decode operations are built-in browser capabilities that run on the audio thread with better performance than any JS implementation.

## Common Pitfalls

### Pitfall 1: AudioContext Suspended State
**What goes wrong:** AudioContext is created but stays in "suspended" state; no audio plays.
**Why it happens:** Browsers require a user gesture before AudioContext can be resumed. Creating one on page load results in suspended state.
**How to avoid:** Lazy-create AudioContext on first user-initiated audio action (import or play). Always call `ctx.resume()` before operations. Chain resume to UI button clicks.
**Warning signs:** No console errors but `ctx.state === 'suspended'` and silence.

### Pitfall 2: AudioBufferSourceNode is One-Shot
**What goes wrong:** Calling `source.start()` twice throws an error; seeking during playback fails.
**Why it happens:** `AudioBufferSourceNode` can only be played once per MDN spec. It cannot be restarted or seeked.
**How to avoid:** Create a new `AudioBufferSourceNode` on every play/seek. Keep the decoded `AudioBuffer` cached -- it is reusable. Stop and disconnect the old source before creating a new one.
**Warning signs:** "InvalidStateError: Failed to execute 'start' on 'AudioBufferSourceNode': cannot call start more than once."

### Pitfall 3: Frame-to-Time Conversion Drift
**What goes wrong:** Audio drifts out of sync with visual playback over long timelines.
**Why it happens:** Accumulating frame-by-frame time (1/fps per frame) introduces floating-point rounding errors vs. AudioContext's high-precision clock.
**How to avoid:** Always compute audio offset as `(currentFrame - track.offsetFrame) / fps` directly, not incrementally. On seek, stop and restart audio at computed offset. Don't try to "adjust" running audio -- just restart it.
**Warning signs:** Audio and video noticeably misaligned after 30+ seconds of playback.

### Pitfall 4: Large Audio Files Block UI During Decode
**What goes wrong:** Importing a 30-minute WAV file freezes the UI for several seconds during `decodeAudioData()`.
**Why it happens:** `decodeAudioData()` is async but the callback runs on the main thread. Large files produce large AudioBuffers whose creation can stall.
**How to avoid:** Show a loading indicator during import. The decode is already async (returns Promise), so use `await` in an async handler. Peak computation should also be deferred to avoid compounding the delay. For very large files (>100MB), consider chunked reading, but this is unlikely given typical audio file sizes for stop-motion projects.
**Warning signs:** UI freezes for 2+ seconds after clicking import.

### Pitfall 5: Waveform Resolution Mismatch at Zoom Extremes
**What goes wrong:** Waveform looks blocky at high zoom or just a solid bar at low zoom.
**Why it happens:** Using a single peak resolution for all zoom levels means either too few peaks (blocky at zoom) or too many peaks (overdraw at zoom-out).
**How to avoid:** Per D-04, pre-compute 3 resolution tiers and select the appropriate tier based on current zoom level. Tier selection: `pixelsPerPeak = (trackDurationFrames * frameWidth) / peakCount`. Choose the tier where `pixelsPerPeak` is closest to 1-4px.
**Warning signs:** Waveform renders as a single rectangle or shows aliasing artifacts.

### Pitfall 6: Audio File Not Found After Project Move
**What goes wrong:** Reopening a project after moving its folder fails to play audio.
**Why it happens:** Storing absolute paths to audio files. When the project directory moves, absolute paths break.
**How to avoid:** Store RELATIVE paths in the .mce file (same as images). Resolve to absolute at hydration time using `projectRoot + '/' + relativePath`. Copy audio files into project `audio/` subdirectory on import.
**Warning signs:** Audio tracks appear on timeline but refuse to play; console shows file-not-found errors.

### Pitfall 7: Undo/Redo Does Not Restore Audio Playback State
**What goes wrong:** Undo removes an audio track from the store but the AudioBufferSourceNode keeps playing.
**Why it happens:** Undo restores store state but doesn't stop the orphaned audio source node.
**How to avoid:** In the audioStore `restore()` function, after restoring the snapshot, stop all currently playing sources and only restart those that exist in the restored state. Or simpler: always stopAll on any audio track mutation.
**Warning signs:** Ghost audio keeps playing after undo removes a track.

### Pitfall 8: Fade Application Timing
**What goes wrong:** Fades sound wrong -- either too abrupt or delayed relative to the visual fade overlay.
**Why it happens:** `linearRampToValueAtTime()` schedules from "now" but the "now" must be `audioContext.currentTime`, and the target time must be computed relative to the audio source start time.
**How to avoid:** When starting playback, compute the gain schedule from the audio track's perspective: fade-in starts at `sourceStartTime`, ramps to full by `sourceStartTime + fadeInDuration`. Fade-out starts at `sourceEndTime - fadeOutDuration`, ramps to 0 by `sourceEndTime`. Apply the full schedule at play-start time.
**Warning signs:** Fade-in is inaudible (already ramped up before audio starts) or fade-out doesn't happen (scheduled past audio end).

## Code Examples

### Audio File Import Flow
```typescript
// Triggered by "Add Audio" button click
import { open } from '@tauri-apps/plugin-dialog';
import { copyFile, mkdir } from '@tauri-apps/plugin-fs';
import { readFile } from '@tauri-apps/plugin-fs';

async function handleAddAudio() {
  const selected = await open({
    multiple: false,
    filters: [{
      name: 'Audio',
      extensions: ['wav', 'mp3', 'aac', 'flac', 'm4a'],
    }],
  });
  if (!selected) return; // User cancelled

  const filePath = selected as string;
  const filename = filePath.split('/').pop() ?? 'audio';
  const projectDir = projectStore.dirPath.peek();
  if (!projectDir) return;

  // Ensure audio/ directory exists
  await mkdir(`${projectDir}/audio`, { recursive: true });

  // Copy audio file into project
  const destPath = `${projectDir}/audio/${filename}`;
  await copyFile(filePath, destPath);

  // Read file as ArrayBuffer for decode
  const fileBytes = await readFile(destPath);
  const arrayBuffer = fileBytes.buffer;

  // Decode and extract peaks
  const audioBuffer = await audioEngine.decode(trackId, arrayBuffer);
  const peaks = computeWaveformPeaks(audioBuffer);

  // Create audio track in store
  audioStore.addTrack({
    id: crypto.randomUUID(),
    name: filename.replace(/\.[^.]+$/, ''),
    filePath: destPath,
    relativePath: `audio/${filename}`,
    originalFilename: filename,
    offsetFrame: 0,
    inFrame: 0,
    outFrame: Math.ceil(audioBuffer.duration * projectStore.fps.peek()),
    volume: 1,
    muted: false,
    fadeInFrames: 0,
    fadeOutFrames: 0,
    fadeInCurve: 'exponential',
    fadeOutCurve: 'exponential',
    sampleRate: audioBuffer.sampleRate,
    duration: audioBuffer.duration,
    channelCount: audioBuffer.numberOfChannels,
    order: audioStore.tracks.peek().length,
  });
}
```

### Waveform Rendering in Canvas 2D
```typescript
// Inside TimelineRenderer -- drawAudioTrack method
private drawAudioTrack(
  ctx: CanvasRenderingContext2D,
  track: AudioTrackLayout,
  y: number,
  frameWidth: number,
  scrollX: number,
  canvasWidth: number,
  zoom: number,
  isSelected: boolean,
): void {
  const trackH = AUDIO_TRACK_HEIGHT;

  // Track background
  ctx.fillStyle = isSelected ? '#1A1520' : colors.fxTrackBg;
  ctx.fillRect(0, y, canvasWidth, trackH);

  // Range bar (same pattern as FX tracks)
  const barX = track.offsetFrame * frameWidth - scrollX + TRACK_HEADER_WIDTH;
  const totalFrames = track.outFrame - track.inFrame;
  const barW = totalFrames * frameWidth;
  const barY = y + 2;
  const barH = trackH - 4;

  // Select resolution tier based on zoom
  const pixelsPerPeak = barW / (track.peaks.tier2.length / 2);
  const peaks = pixelsPerPeak < 1 ? track.peaks.tier1
    : pixelsPerPeak > 4 ? track.peaks.tier3
    : track.peaks.tier2;

  // Draw waveform inside bar
  const waveColor = track.muted ? '#0D9488' + '4D' : '#0D9488'; // teal, 30% when muted
  const centerY = barY + barH / 2;
  const halfH = barH / 2 - 1;

  // Center line per D-05
  ctx.strokeStyle = waveColor + '30';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(Math.max(barX, TRACK_HEADER_WIDTH), centerY);
  ctx.lineTo(Math.min(barX + barW, canvasWidth), centerY);
  ctx.stroke();

  // Waveform fill
  ctx.fillStyle = waveColor + '80';
  const peakCount = peaks.length / 2;
  for (let i = 0; i < peakCount; i++) {
    const px = barX + (i / peakCount) * barW;
    if (px + barW / peakCount < TRACK_HEADER_WIDTH || px > canvasWidth) continue;
    const min = peaks[i * 2];
    const max = peaks[i * 2 + 1];
    const top = centerY - max * halfH;
    const bottom = centerY - min * halfH;
    const w = Math.max(1, barW / peakCount);
    ctx.fillRect(px, top, w, bottom - top);
  }
}
```

### Gain Fade Schedule Application
```typescript
// Apply fade-in and fade-out gain schedule when starting playback
function applyFadeSchedule(
  gain: GainNode,
  track: AudioTrack,
  audioStartTime: number, // audioContext.currentTime when source.start() is called
  sourceOffset: number,   // seconds into the audio we're starting from
  fps: number,
): void {
  const fadeInSec = track.fadeInFrames / fps;
  const fadeOutSec = track.fadeOutFrames / fps;
  const totalDuration = (track.outFrame - track.inFrame) / fps;
  const effectiveEnd = audioStartTime + totalDuration - sourceOffset;

  // Reset gain
  gain.gain.cancelScheduledValues(audioStartTime);

  // Apply volume
  const vol = track.muted ? 0 : track.volume;

  if (fadeInSec > 0 && sourceOffset < fadeInSec) {
    // Currently within fade-in region
    const fadeProgress = sourceOffset / fadeInSec;
    gain.gain.setValueAtTime(vol * fadeProgress, audioStartTime);
    const fadeInEnd = audioStartTime + (fadeInSec - sourceOffset);
    if (track.fadeInCurve === 'exponential') {
      gain.gain.exponentialRampToValueAtTime(Math.max(vol, 0.001), fadeInEnd);
    } else {
      gain.gain.linearRampToValueAtTime(vol, fadeInEnd);
    }
  } else {
    gain.gain.setValueAtTime(vol, audioStartTime);
  }

  if (fadeOutSec > 0) {
    const fadeOutStart = effectiveEnd - fadeOutSec;
    if (fadeOutStart > audioStartTime) {
      gain.gain.setValueAtTime(vol, fadeOutStart);
      if (track.fadeOutCurve === 'exponential') {
        gain.gain.exponentialRampToValueAtTime(0.001, effectiveEnd);
      } else {
        gain.gain.linearRampToValueAtTime(0, effectiveEnd);
      }
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HTMLAudioElement for web audio | Web Audio API (AudioContext) | Mature since 2014+ | Sample-accurate timing, programmable gain, fade automation |
| Server-side waveform generation | Browser-side decodeAudioData | Always available in modern browsers | No server dependency; instant decode |
| AnalyserNode real-time FFT | Pre-computed peak arrays | N/A (different use cases) | Pre-computed peaks are correct for static timeline display |

**Deprecated/outdated:**
- `createMediaElementSource()` combined with HTMLAudioElement: Works but loses seek accuracy and prevents waveform pre-computation.
- `webkitAudioContext`: Prefixed version; all modern browsers support unprefixed `AudioContext`.

## Open Questions

1. **Waveform accent color exact value**
   - What we know: Should be teal/cyan per D-02; must contrast with FX track colors (brown/purple/teal/gray/orange)
   - What's unclear: Exact hex value. Existing `generator-lines` uses `#20B2AA` (light sea green). Need a distinct teal that doesn't clash.
   - Recommendation: Use `#0D9488` (Tailwind teal-600) or `#14B8A6` (teal-500). Verify visually against the dark timeline background.

2. **Track height resize handle UX**
   - What we know: D-01 says 40-48px default, user-resizable via drag handle
   - What's unclear: Where exactly is the drag handle? Bottom edge of track? Separate handle widget?
   - Recommendation: Bottom edge of the audio track area acts as resize handle (cursor changes to `ns-resize` on hover). Simple and matches NLE conventions. All audio tracks share the same height (per-track height would add complexity for minimal benefit).

3. **Slip editing interaction details (D-09)**
   - What we know: Audio content slides within track edges. This is NLE "slip edit".
   - What's unclear: What modifier key (if any) distinguishes slip from move? When dragging the waveform body, is it a slip or a move?
   - Recommendation: Default drag on waveform body = move (changes offsetFrame). Hold Option/Alt + drag = slip (changes audio content offset within in/out points). This matches Final Cut Pro / Premiere conventions.

4. **Peak data persistence vs. recomputation**
   - What we know: Peaks must be recomputed from audio file on project open (they're not stored in .mce)
   - What's unclear: Is recomputation fast enough for UX, or should peaks be cached to disk?
   - Recommendation: Recompute on project open. For typical audio files (5-10 min), decode + peak extraction takes ~1-2 seconds. Show a brief loading state. Disk caching adds complexity for marginal benefit. If needed later, cache to `audio/.peaks/` as binary files.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 2.1.9 |
| Config file | `Application/vitest.config.ts` |
| Quick run command | `cd Application && npx vitest run --reporter=verbose` |
| Full suite command | `cd Application && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUDIO-01 | Import creates track in audioStore with correct fields | unit | `npx vitest run src/stores/audioStore.test.ts -t "addTrack"` | Wave 0 |
| AUDIO-02 | Peak extraction produces 3 tiers from mock AudioBuffer | unit | `npx vitest run src/lib/audioWaveform.test.ts` | Wave 0 |
| AUDIO-03 | PlaybackEngine start/stop hooks call audioEngine | unit | `npx vitest run src/lib/playbackEngine.test.ts` | Wave 0 |
| AUDIO-04 | Volume/mute update calls GainNode.gain.value | unit | `npx vitest run src/lib/audioEngine.test.ts -t "volume"` | Wave 0 |
| AUDIO-05 | Drag offset changes track.offsetFrame | unit | `npx vitest run src/stores/audioStore.test.ts -t "offset"` | Wave 0 |
| AUDIO-06 | Fade schedule computation produces correct ramp times | unit | `npx vitest run src/lib/audioEngine.test.ts -t "fade"` | Wave 0 |
| AUDIO-07 | buildMceProject includes audio_tracks; hydrateFromMce restores them | unit | `npx vitest run src/stores/projectStore.test.ts -t "audio"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd Application && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd Application && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/stores/audioStore.test.ts` -- covers AUDIO-01, AUDIO-05
- [ ] `src/lib/audioWaveform.test.ts` -- covers AUDIO-02
- [ ] `src/lib/audioEngine.test.ts` -- covers AUDIO-04, AUDIO-06
- [ ] `src/lib/playbackEngine.test.ts` -- covers AUDIO-03 (may need mock for existing engine)
- [ ] `src/stores/projectStore.test.ts` -- covers AUDIO-07 (serialization round-trip)

## Sources

### Primary (HIGH confidence)
- [MDN: Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) - AudioContext, AudioBufferSourceNode, GainNode, decodeAudioData
- [MDN: AudioBufferSourceNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode) - One-shot nature, start() with offset parameter
- [MDN: GainNode](https://developer.mozilla.org/en-US/docs/Web/API/GainNode) - Volume control, gain.value
- [MDN: AudioParam.linearRampToValueAtTime](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/linearRampToValueAtTime) - Fade implementation
- [MDN: AudioParam.exponentialRampToValueAtTime](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/exponentialRampToValueAtTime) - Exponential fade curves
- [MDN: Visualizations with Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API) - Waveform data extraction
- [Tauri Dialog Plugin](https://v2.tauri.app/plugin/dialog/) - File dialog with extension filters
- [Tauri File System Plugin](https://v2.tauri.app/plugin/file-system/) - copyFile, mkdir, readFile

### Secondary (MEDIUM confidence)
- [Hans Garon: Synchronize Animation To Audio](https://hansgaron.com/articles/web_audio/animation_sync_with_audio/part_one/) - rAF + Web Audio sync patterns
- [BBC peaks.js](https://github.com/bbc/peaks.js) - Waveform peak computation approach (reference, not used as dependency)
- [BBC waveform-data.js](https://github.com/bbc/waveform-data.js) - Multi-resolution waveform data API design (reference)

### Tertiary (LOW confidence)
- None -- all findings verified against primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Web Audio API is the established browser standard; Tauri plugins already in project
- Architecture: HIGH - Follows exact same patterns (signal stores, Canvas 2D rendering, snapshot undo) as existing codebase
- Pitfalls: HIGH - AudioBufferSourceNode one-shot, AudioContext suspension, and sync issues are well-documented gotchas
- Waveform rendering: MEDIUM - Custom peak extraction is straightforward but exact visual quality depends on implementation details

**Research date:** 2026-03-21
**Valid until:** 2026-06-21 (Web Audio API is stable; no breaking changes expected)
