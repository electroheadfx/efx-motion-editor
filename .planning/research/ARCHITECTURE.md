# Architecture Research: v0.3.0 Feature Integration

**Domain:** Audio/waveform/beat-sync, sidebar solo mode, canvas motion paths -- integration with existing Tauri 2.0 + Preact stop-motion editor
**Researched:** 2026-03-21
**Confidence:** HIGH

## Existing Architecture Snapshot

Before detailing new integration points, here is the relevant existing architecture for context:

```
FRONTEND (Preact + Preact Signals)
=====================================================================
Stores (reactive state):
  projectStore ---- fps, resolution, dirty, save/open/close
  sequenceStore --- sequences[], activeSequenceId, CRUD + undo
  layerStore ------ computed layers from active seq, selection
  keyframeStore --- keyframe CRUD, interpolation, transient overrides
  timelineStore --- currentFrame, displayFrame, zoom, scroll, playing
  canvasStore ----- zoom, pan, fitLock
  uiStore --------- sidebar layout, selections, mode, collapse state
  isolationStore -- isolatedSequenceIds, loopEnabled
  exportStore ----- format, resolution, progress
  blurStore ------- GPU bypass toggle
  imageStore ------ image pool, LRU, video assets
  historyStore ---- undo/redo stack + pointer

Engines (stateful logic):
  PlaybackEngine -- rAF tick loop, delta accumulation, shuttle
  PreviewRenderer - Canvas 2D compositing, image cache, video elements
  keyframeEngine -- interpolation with polynomial cubic easing
  transitionEngine - fade/crossDissolve opacity math
  exportEngine ---- offscreen canvas render + IPC write loop
  exportRenderer -- shared renderGlobalFrame(), layer interpolation

Computed (derived reactive):
  frameMap -------- flattened FrameEntry[] for all content sequences
  trackLayouts ---- TrackLayout[] for timeline rendering
  fxTrackLayouts -- FxTrackLayout[] for overlay range bars
  crossDissolveOverlaps -- overlap zones for dual-render

BACKEND (Rust / Tauri 2.0)
=====================================================================
Commands:
  project_* ------ CRUD, save, open, migrate
  image_* -------- import, info, thumbnails
  config_* ------- theme, sidebar, panels, export prefs
  export_* ------- dir creation, PNG write, FFmpeg encode
Services:
  ffmpeg.rs ------ binary provisioning, encode_video (PNG seq -> video)
  project_io.rs -- .mce format read/write
  image_pool.rs -- LRU cache, thumbnail generation

IPC Bridge:
  efxasset:// ---- custom protocol for local file serving (images + video)
  invoke() ------- Rust command calls via Tauri IPC
```

## System Overview: v0.3.0 Additions

```
EXISTING                          NEW (v0.3.0)
========                          ============

projectStore ---------.           audioStore (NEW)
sequenceStore         |             |-- audioTracks signal
timelineStore         |             |-- waveformData signal
canvasStore           |             |-- beatMarkers signal
keyframeStore         |             |-- bpm signal
isolationStore        |             |-- playback state
exportStore           |
                      |           AudioEngine (NEW)
PlaybackEngine <------+------->    |-- Web Audio API context
  tick() ---------.   |           |-- HTMLAudioElement sync
                  |   |           |-- currentTime <-> frame mapping
PreviewRenderer   |   |
                  |   |           WaveformRenderer (NEW)
exportRenderer    |   |           |-- Canvas 2D mini-waveform
                  |   |           |-- beat marker overlay
                  |   |
Timeline ---------+   |           AudioTrack row (NEW in timeline)
Canvas overlay ---+   |           MotionPathOverlay (NEW)
Sidebar ----------+   |           SoloModeButton (NEW)
                      |
ffmpeg.rs <-----------'           audio mux in encode_video (MODIFIED)
                                  audio_import command (NEW)
                                  waveform generation (NEW Rust or JS)
```

### Component Responsibilities

| Component | Responsibility | New / Modified | Communicates With |
|-----------|----------------|----------------|-------------------|
| `audioStore` | Audio track data, waveform cache, beat markers, BPM, fade in/out, timeline position | **NEW store** | sequenceStore, timelineStore, projectStore |
| `AudioEngine` | Web Audio API context, HTMLAudioElement playback, frame-accurate sync with PlaybackEngine | **NEW engine** | PlaybackEngine, audioStore, timelineStore |
| `WaveformRenderer` | Canvas 2D waveform drawing for timeline audio track row | **NEW renderer** | audioStore, timelineStore |
| `BeatDetector` | BPM estimation and beat position extraction from AudioBuffer | **NEW lib** | audioStore |
| `MotionPathOverlay` | SVG path visualization of keyframe position trajectory on canvas | **NEW component** | keyframeStore, canvasStore, layerStore |
| `AudioTrack` | Timeline row rendering for audio waveform + beat markers | **NEW in TimelineRenderer** | audioStore, timelineStore |
| `PlaybackEngine` | Add audio sync start/stop/seek | **MODIFIED** | AudioEngine |
| `exportEngine` | Pass audio path to FFmpeg for mux | **MODIFIED** | audioStore, ffmpeg.rs |
| `ffmpeg.rs` | Replace `-an` with `-i audio` mux | **MODIFIED** | exportEngine |
| `TimelineRenderer` | Add audio track row below FX tracks | **MODIFIED** | audioStore |
| `TimelineCanvas` | Handle audio track interactions | **MODIFIED** | audioStore |
| Sidebar | Solo mode buttons per sequence/layer | **MODIFIED** | isolationStore |
| `MceProject` | Add `audio_tracks` field | **MODIFIED** | projectStore |
| `projectStore` | Serialize/deserialize audio tracks | **MODIFIED** | audioStore |
| `TransformOverlay` | Render motion path when layer selected | **MODIFIED** | keyframeStore |

## Recommended Project Structure (new files only)

```
src/
  stores/
    audioStore.ts           # NEW: audio track state, waveform, beats
  lib/
    audioEngine.ts          # NEW: Web Audio API playback + sync
    beatDetector.ts         # NEW: BPM detection + beat position extraction
    waveformGenerator.ts    # NEW: AudioBuffer -> peak data for rendering
    motionPath.ts           # NEW: keyframe position -> SVG path data
  components/
    canvas/
      MotionPathOverlay.tsx # NEW: SVG motion path on canvas
    timeline/
      AudioTrackRenderer.ts # NEW: waveform + beat marker rendering
    sidebar/
      SoloModeButton.tsx    # NEW: per-sequence/layer solo toggle
  types/
    audio.ts                # NEW: AudioTrack, BeatMarker, WaveformData types

src-tauri/src/
  commands/
    audio.rs                # NEW: audio_import, audio_get_waveform
  services/
    ffmpeg.rs               # MODIFIED: add audio mux path
```

### Structure Rationale

- **audioStore.ts**: Follows existing store pattern (Preact Signals, no class, exported object). Audio is project-level state like images -- not per-sequence (a single audio track spans the entire timeline).
- **audioEngine.ts**: Follows PlaybackEngine pattern (class with start/stop/seek, not a store). The engine owns the Web Audio API context lifecycle.
- **beatDetector.ts / waveformGenerator.ts**: Pure computation split from store/engine for testability. beatDetector runs once on import; waveformGenerator produces resampled peak data at the current timeline zoom.
- **MotionPathOverlay.tsx**: Same layer as TransformOverlay.tsx, rendered as sibling SVG. Uses canvas coordinate system via `coordinateMapper.ts`.
- **AudioTrackRenderer.ts**: Canvas 2D rendering function called by TimelineRenderer, follows fxTrack rendering pattern.

## Architectural Patterns

### Pattern 1: Audio Track as Project-Level Data (not Sequence-Level)

**What:** Audio lives on the project, not on sequences. A single audio track (or small fixed number) spans the full timeline. This mirrors After Effects / DaVinci Resolve where audio is a separate timeline lane, not bound to visual sequences.

**When to use:** Always for v0.3.0. Stop-motion projects have one music track, not per-sequence audio.

**Trade-offs:** Simpler model (one audio file, one waveform), but limits future multi-track. Design the store as `audioTracks: AudioTrack[]` with initially one track to allow future extension without format migration.

**Example:**

```typescript
// types/audio.ts
export interface AudioTrack {
  id: string;
  name: string;             // display name (filename)
  relativePath: string;     // relative to project dir (like video layers)
  offsetFrames: number;     // start position on timeline (0 = bar 1)
  durationFrames: number;   // computed from audio duration * fps
  durationSeconds: number;  // raw audio duration
  fadeInFrames: number;     // fade envelope
  fadeOutFrames: number;    // fade envelope
  volume: number;           // 0-1 gain
  muted: boolean;
}

export interface WaveformData {
  peaks: Float32Array;      // downsampled peak amplitudes
  samplesPerPeak: number;   // how many source samples per peak entry
  sampleRate: number;       // original sample rate
  channels: number;         // 1 (mono mixed) or 2
}

export interface BeatMarker {
  timeSeconds: number;      // beat position in seconds
  frame: number;            // beat position as global frame
  strength: number;         // 0-1 beat confidence
}
```

### Pattern 2: AudioEngine as PlaybackEngine Companion (not Replacement)

**What:** AudioEngine owns an `HTMLAudioElement` and synchronizes it with PlaybackEngine's frame-based tick loop. PlaybackEngine remains the master clock. AudioEngine is a slave that follows.

**When to use:** Playback start, stop, seek, shuttle speed changes.

**Why not Web Audio API `AudioBufferSourceNode`:** AudioBufferSourceNode cannot seek -- once started, you cannot jump to an arbitrary position. HTMLAudioElement.currentTime is seekable and has minimal latency on macOS WebKit. Using `createMediaElementSource()` bridges the HTMLAudioElement into the Web Audio graph for future effects (fade, gain).

**Trade-offs:** HTMLAudioElement has ~10-50ms latency on seek, acceptable for stop-motion at 15-24fps (one frame is 41-66ms). For frame-accurate export, FFmpeg handles audio mux independently.

**Example:**

```typescript
// lib/audioEngine.ts
export class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private mediaElement: HTMLAudioElement | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;

  /** Initialize with audio file path */
  async load(audioPath: string): Promise<AudioBuffer> {
    this.audioCtx = this.audioCtx ?? new AudioContext();
    this.mediaElement = new Audio(assetUrl(audioPath));
    this.mediaElement.preload = 'auto';
    this.sourceNode = this.audioCtx.createMediaElementSource(this.mediaElement);
    this.gainNode = this.audioCtx.createGain();
    this.sourceNode.connect(this.gainNode);
    this.gainNode.connect(this.audioCtx.destination);

    // Also decode full buffer for waveform + beat analysis
    const response = await fetch(assetUrl(audioPath));
    const arrayBuffer = await response.arrayBuffer();
    return this.audioCtx.decodeAudioData(arrayBuffer);
  }

  /** Sync to PlaybackEngine's current frame */
  syncToFrame(frame: number, fps: number) {
    if (!this.mediaElement) return;
    const targetTime = frame / fps;
    // Only seek if drift exceeds one frame duration
    if (Math.abs(this.mediaElement.currentTime - targetTime) > (1 / fps)) {
      this.mediaElement.currentTime = targetTime;
    }
  }

  play() { this.mediaElement?.play(); }
  pause() { this.mediaElement?.pause(); }
  setVolume(v: number) { if (this.gainNode) this.gainNode.gain.value = v; }
  dispose() { /* cleanup */ }
}
```

### Pattern 3: Waveform as Resampled Peak Cache

**What:** On audio import, decode to AudioBuffer, extract peak amplitude data at a fixed resolution (e.g., 1 peak per ~100 samples). Store this `WaveformData` in audioStore. TimelineRenderer reads peaks and maps to pixel columns at the current zoom level using simple index math.

**When to use:** Waveform visualization in the timeline audio track row.

**Why not render directly from AudioBuffer:** AudioBuffer can be millions of samples. Rendering requires downsampling to pixel-column resolution. Pre-compute peaks once, then slice/subsample at render time based on zoom.

**Trade-offs:** ~100KB memory for a typical 3-minute song at 44.1kHz. Trivial. The alternative (re-analyzing on every zoom change) burns CPU needlessly.

**Example:**

```typescript
// lib/waveformGenerator.ts
export function generatePeaks(buffer: AudioBuffer, samplesPerPeak = 128): Float32Array {
  const channel = buffer.getChannelData(0); // mono mix
  const numPeaks = Math.ceil(channel.length / samplesPerPeak);
  const peaks = new Float32Array(numPeaks);
  for (let i = 0; i < numPeaks; i++) {
    let max = 0;
    const start = i * samplesPerPeak;
    const end = Math.min(start + samplesPerPeak, channel.length);
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channel[j]);
      if (abs > max) max = abs;
    }
    peaks[i] = max;
  }
  return peaks;
}
```

### Pattern 4: Beat Detection via Energy-Based Algorithm (not Essentia.js)

**What:** Use a lightweight energy-based onset detection algorithm on the decoded AudioBuffer. Compute spectral flux in frequency bands, find peaks above threshold, cluster into BPM.

**When to use:** On audio import or when user triggers "Detect BPM" explicitly.

**Why not Essentia.js:** Essentia.js pulls in a 2MB+ WASM bundle. For BPM detection of a single audio file in a desktop app, a simple energy/spectral-flux algorithm (Joe Sullivan's approach) is 50-100 lines of code and runs in <1 second for a 5-minute track. If accuracy is insufficient, Essentia.js can be added later as an optional dependency.

**Trade-offs:** Energy-based detection works well for rhythmic music (electronic, pop, rock) which is the primary use case for stop-motion sync. Complex polyrhythmic music may need manual BPM entry as fallback.

**Example:**

```typescript
// lib/beatDetector.ts
export interface BeatResult {
  bpm: number;
  beats: number[];  // beat times in seconds
  confidence: number; // 0-1
}

export function detectBeats(buffer: AudioBuffer): BeatResult {
  // 1. Compute energy in frequency bands using FFT windows
  // 2. Find onset peaks via spectral flux
  // 3. Auto-correlate to find BPM
  // 4. Quantize beat positions to BPM grid
  // Returns { bpm, beats[], confidence }
}
```

### Pattern 5: Motion Path as SVG Overlay on Canvas

**What:** When a layer has 2+ position keyframes, render an SVG path showing the interpolated x,y trajectory. Show keyframe diamonds on the path that can be dragged to edit position values. The path updates reactively when keyframes change.

**When to use:** When a non-base, non-FX layer is selected and has position keyframes.

**Why SVG over Canvas:** The TransformOverlay already uses SVG for bounding box rendering. SVG paths (`<path d="M... C...">`) are ideal for smooth curves. Hit-testing SVG elements is free via pointer events. Canvas 2D would require manual hit-testing.

**Trade-offs:** SVG rendering is slightly slower than Canvas for many nodes, but motion paths have at most ~20 keyframes. Performance is not a concern.

**Example:**

```typescript
// lib/motionPath.ts
export interface MotionPathPoint {
  x: number;          // project-space coordinates
  y: number;
  frame: number;      // sequence-local frame
  isKeyframe: boolean; // true = diamond handle
}

export function computeMotionPath(
  keyframes: Keyframe[],
  totalFrames: number,
  sampleInterval: number = 1, // sample every N frames
): MotionPathPoint[] {
  const points: MotionPathPoint[] = [];
  for (let f = 0; f <= totalFrames; f += sampleInterval) {
    const values = interpolateAt(keyframes, f);
    if (values) {
      points.push({
        x: values.x,
        y: values.y,
        frame: f,
        isKeyframe: keyframes.some(kf => kf.frame === f),
      });
    }
  }
  return points;
}
```

## Data Flow

### Audio Import Flow

```
User drags audio file (or File > Import Audio)
    |
    v
[Rust: audio_import command]
    |-- Validate file (wav/mp3/aac/m4a/ogg/flac)
    |-- Copy to project_dir/audio/
    |-- Return { relativePath, durationSeconds }
    |
    v
[audioStore.addTrack()]
    |-- Store AudioTrack with offset=0, volume=1
    |-- Mark project dirty
    |
    v
[AudioEngine.load(path)]
    |-- Decode AudioBuffer via Web Audio API
    |-- Generate WaveformData (peaks)
    |-- Run BeatDetector (optional, user-triggered)
    |-- Store waveform + beats in audioStore
    |
    v
[Timeline re-renders with audio track row]
[Waveform visible, beat markers visible]
```

### Audio-Synced Playback Flow

```
PlaybackEngine.start()
    |
    |-- AudioEngine.syncToFrame(currentFrame, fps)
    |-- AudioEngine.play()
    |
    v
PlaybackEngine.tick(now)  [existing rAF loop]
    |
    |-- Advance frame via delta accumulation (existing)
    |-- Every N ticks: AudioEngine.syncToFrame(currentFrame, fps)
    |      (drift correction -- only seek if > 1 frame off)
    |
    v
PlaybackEngine.stop()
    |-- AudioEngine.pause()
    |-- AudioEngine.syncToFrame(currentFrame, fps)
```

**Critical design decision:** PlaybackEngine remains the **master clock**. Audio follows video, not the other way around. This is correct for stop-motion editors where frame-accurate visual sync matters more than audio continuity. If audio drifts slightly during shuttle/scrub, that is acceptable.

### Audio in Video Export Flow

```
exportEngine.startExport()
    |
    |-- [existing] Render PNG frames
    |-- [existing] Call exportEncodeVideo
    |
    v
[Rust: export_encode_video] (MODIFIED)
    |
    |-- audioPath parameter added
    |-- If audioPath provided:
    |     ffmpeg -y -framerate {fps} -i {pattern}
    |       -i {audioPath}
    |       -c:v {codec} ... -c:a aac -b:a 192k
    |       -map 0:v -map 1:a
    |       -shortest     // trim to shorter of video/audio
    |       {output}
    |-- If no audioPath:
    |     [existing] ffmpeg ... -an {output}
```

### Beat Sync Auto-Arrange Flow

```
User clicks "Auto-Arrange to Beats"
    |
    v
[beatSync.autoArrange()]
    |-- Read beatMarkers from audioStore
    |-- Read key photos from active sequence
    |-- Compute: holdFrames[i] = beatFrame[i+1] - beatFrame[i]
    |      (each key photo holds exactly one beat interval)
    |-- Apply via sequenceStore.updateHoldFrames() for each kp
    |-- Push single undo action wrapping all updates
    |
    v
[frameMap recomputes]
[Timeline re-renders with beat-aligned key photos]
```

### Motion Path Rendering Flow

```
TransformOverlay renders (existing)
    |
    |-- Check: selectedLayer has keyframes with x/y changes?
    |-- YES:
    |     v
    |   [MotionPathOverlay]
    |     |-- Compute path points via motionPath.computeMotionPath()
    |     |-- Convert project-space coords to screen coords via coordinateMapper
    |     |-- Render SVG <path> with catmull-rom or linear segments
    |     |-- Render keyframe diamonds as draggable handles
    |     |-- On diamond drag: update keyframeStore position values
    |
    v
[Canvas shows motion trajectory + draggable keyframe handles]
```

### Solo Mode Data Flow

```
User clicks Solo button on sequence/layer
    |
    v
[isolationStore.toggleIsolation(sequenceId)]  (EXISTING)
    |
    |-- For sequence solo: already works via isolatedSequenceIds
    |-- For layer solo: NEW signal in isolationStore
    |     isolatedLayerIds: Set<string>
    |
    v
[PlaybackEngine.tick()]
    |-- Already skips non-isolated sequences (EXISTING)
    |
[PreviewRenderer.renderFrame()]
    |-- Check isolatedLayerIds
    |-- If layer solo active: only render isolated layers
    |-- Otherwise: render all visible layers (existing)
```

## Integration Points: What Changes in Existing Code

### NEW Store: `audioStore.ts`

```typescript
// stores/audioStore.ts
import { signal, computed } from '@preact/signals';
import type { AudioTrack, WaveformData, BeatMarker } from '../types/audio';

const audioTracks = signal<AudioTrack[]>([]);
const activeTrackId = signal<string | null>(null);
const waveformCache = signal<Map<string, WaveformData>>(new Map());
const beatMarkersCache = signal<Map<string, BeatMarker[]>>(new Map());
const bpmCache = signal<Map<string, number>>(new Map());

export const audioStore = {
  audioTracks,
  activeTrackId,
  waveformCache,
  beatMarkersCache,
  bpmCache,

  // Computed
  activeTrack: computed(() => {
    const id = activeTrackId.value;
    return audioTracks.value.find(t => t.id === id) ?? null;
  }),
  hasAudio: computed(() => audioTracks.value.length > 0),

  addTrack(track: AudioTrack) { /* ... pushAction for undo */ },
  removeTrack(id: string) { /* ... pushAction for undo */ },
  updateTrack(id: string, updates: Partial<AudioTrack>) { /* ... */ },
  setWaveform(trackId: string, data: WaveformData) { /* ... */ },
  setBeatMarkers(trackId: string, markers: BeatMarker[]) { /* ... */ },
  setBpm(trackId: string, bpm: number) { /* ... */ },
  reset() { /* clear all signals */ },
};
```

### MODIFIED: `PlaybackEngine` (3 touch points)

1. **`start()`**: Call `audioEngine.syncToFrame()` then `audioEngine.play()`
2. **`stop()`**: Call `audioEngine.pause()`
3. **`tick()`**: Every ~5 ticks, call `audioEngine.syncToFrame()` for drift correction
4. **`seekToFrame()`**: Call `audioEngine.syncToFrame()`

Estimated diff: ~15 lines added to `playbackEngine.ts`.

### MODIFIED: `timelineStore.ts` (audio track height)

Add audio track height to `totalContentHeight` computed:

```typescript
const AUDIO_TRACK_HEIGHT = 48;

const totalContentHeight = computed(() => {
  const fxCount = fxTrackLayouts.value.length;
  const audioCount = audioStore.audioTracks.value.length;
  return RULER_HEIGHT + fxCount * FX_TRACK_HEIGHT + TRACK_HEIGHT
    + audioCount * AUDIO_TRACK_HEIGHT;
});
```

Estimated diff: ~5 lines modified.

### MODIFIED: `TimelineRenderer.ts` (audio track rendering)

Add audio track rendering after FX track rendering in the draw loop. Audio track appears below FX tracks, above the scrollbar.

Estimated diff: ~80-120 lines added (waveform drawing, beat marker lines, track header).

### MODIFIED: `ffmpeg.rs` `encode_video()` (audio mux)

Replace the unconditional `-an` flag:

```rust
pub fn encode_video(
    png_dir: &str,
    glob_pattern: &str,
    output_path: &str,
    codec: &str,
    fps: u32,
    quality_args: &VideoQualityArgs,
    audio_path: Option<&str>,  // NEW parameter
) -> Result<(), String> {
    // ... existing codec args ...

    if let Some(audio) = audio_path {
        cmd.args(["-i", audio]);
        cmd.args(["-c:a", "aac", "-b:a", "192k"]);
        cmd.args(["-map", "0:v", "-map", "1:a"]);
        cmd.arg("-shortest");
    } else {
        cmd.arg("-an");
    }
    // ...
}
```

Estimated diff: ~20 lines modified in `ffmpeg.rs`, ~10 lines in `export.rs` command, ~10 lines in `ipc.ts`.

### MODIFIED: `MceProject` type (audio persistence)

```typescript
// types/project.ts -- add to MceProject
export interface MceProject {
  // ... existing fields ...
  audio_tracks?: MceAudioTrack[];  // optional for backward compat
}

export interface MceAudioTrack {
  id: string;
  name: string;
  relative_path: string;
  offset_frames: number;
  duration_seconds: number;
  fade_in_frames: number;
  fade_out_frames: number;
  volume: number;
  muted: boolean;
}
```

This bumps .mce format to **v8**. Old readers skip unknown fields (existing backward compat design).

### MODIFIED: `projectStore.ts` (audio serialization)

Add audio track serialization in `buildMceProject()` and deserialization in `hydrateFromMce()`.

Estimated diff: ~30 lines in buildMceProject, ~20 lines in hydrateFromMce.

### MODIFIED: `isolationStore.ts` (layer-level solo)

Add `isolatedLayerIds` signal and `toggleLayerIsolation()` method:

```typescript
const isolatedLayerIds = signal<Set<string>>(new Set());

// ... existing methods ...

toggleLayerIsolation(layerId: string) {
  const current = new Set(isolatedLayerIds.peek());
  if (current.has(layerId)) current.delete(layerId);
  else current.add(layerId);
  isolatedLayerIds.value = current;
},
hasLayerIsolation: computed(() => isolatedLayerIds.value.size > 0),
```

Estimated diff: ~25 lines added.

### MODIFIED: `PreviewRenderer.renderFrame()` (layer solo filtering)

Before the layer loop, filter layers by isolation:

```typescript
renderFrame(layers: Layer[], ...) {
  // NEW: filter by layer isolation
  const isoLayers = isolationStore.isolatedLayerIds.peek();
  const effectiveLayers = isoLayers.size > 0
    ? layers.filter(l => isoLayers.has(l.id) || l.isBase)
    : layers;
  // ... existing loop over effectiveLayers ...
}
```

Estimated diff: ~5 lines added.

### NEW: Rust `audio_import` command

```rust
// commands/audio.rs
#[command]
pub fn audio_import(source_path: String, project_dir: String) -> Result<AudioImportResult, String> {
    // 1. Validate extension (wav, mp3, aac, m4a, ogg, flac)
    // 2. Create project_dir/audio/ if needed
    // 3. Copy file to project_dir/audio/{filename}
    // 4. Return { relative_path, filename }
}
```

The actual audio decoding and waveform generation happen in the frontend via Web Audio API (AudioContext.decodeAudioData). The Rust side only handles file copy -- same pattern as image import.

### MODIFIED: `TransformOverlay.tsx` (motion path rendering)

Add MotionPathOverlay as a sibling element inside the TransformOverlay render:

```tsx
export function TransformOverlay({ ... }) {
  // ... existing logic ...

  return (
    <div ref={overlayRef} ...>
      {/* NEW: Motion path when layer has position keyframes */}
      {selectedLayer && !isFxLayer(selectedLayer) && (
        <MotionPathOverlay
          layer={selectedLayer}
          keyframes={keyframeStore.activeLayerKeyframes.value}
          zoom={zoom}
          projW={projW}
          projH={projH}
        />
      )}
      {/* Existing: bounding box, handles */}
      <svg ...>
        <polygon ... />
      </svg>
      {/* Existing: corner/edge handles */}
    </div>
  );
}
```

Estimated diff: ~10 lines in TransformOverlay.tsx, ~150 lines in new MotionPathOverlay.tsx.

## Scaling Considerations

| Concern | Current (v0.2.0) | With Audio (v0.3.0) | Mitigation |
|---------|-------------------|---------------------|------------|
| Memory | ~50-200MB (images) | +5-50MB (AudioBuffer) | Single track; dispose on project close |
| Playback CPU | rAF tick + Canvas 2D | +Audio sync every 5 ticks | Negligible: one `currentTime` comparison |
| Timeline render | Content + FX tracks | +1 audio track row | Canvas 2D waveform is cheap (~1000 rect calls) |
| Export time | PNG render + FFmpeg encode | +FFmpeg audio mux | Audio mux is stream-copy, adds <1 second |
| Beat detection | N/A | One-time ~500ms analysis | Run async, non-blocking UI |
| Motion path | N/A | SVG overlay with ~20 points | Negligible render cost |

### First Bottleneck: Long Audio Files

A 30-minute audio file at 44.1kHz = ~80M samples = ~300MB AudioBuffer. Mitigation: limit audio to 30 minutes (warn user), or decode only the section needed for the timeline duration.

### Second Bottleneck: Waveform Zoom Responsiveness

At extreme zoom levels, each pixel column may represent <1ms of audio. Pre-computed peaks at 128 samples/peak (~3ms at 44.1kHz) are sufficient for all reasonable zoom levels. No re-analysis needed.

## Anti-Patterns

### Anti-Pattern 1: Audio as Master Clock

**What people do:** Make audio playback drive the frame counter (audio.currentTime -> frame number).
**Why it's wrong:** Audio currentTime has variable latency, not frame-accurate. During shuttle/scrub, audio jumps create frame jitter. The existing rAF delta accumulation is the correct clock source.
**Do this instead:** Keep PlaybackEngine as master. Sync audio TO the frame counter, not the other way around.

### Anti-Pattern 2: Re-decoding Audio on Every Zoom Change

**What people do:** Call `decodeAudioData()` or regenerate waveform peaks every time the timeline zooms.
**Why it's wrong:** `decodeAudioData` is expensive (~100ms for a 3-minute file). Blocks the UI.
**Do this instead:** Decode once, generate peaks once, then subsample the peak array at render time with simple index math.

### Anti-Pattern 3: Storing Waveform Data in .mce Project File

**What people do:** Serialize the WaveformData peaks into the project file.
**Why it's wrong:** WaveformData is ~100KB of derived data. It inflates the .mce file and is trivially re-derivable from the source audio file.
**Do this instead:** Store only the AudioTrack metadata (path, offset, volume, fade). Regenerate waveform on project open.

### Anti-Pattern 4: Motion Path with Bezier Curve Fitting

**What people do:** Fit Bezier curves through keyframe positions to make the motion path smooth.
**Why it's wrong:** The existing interpolation engine uses polynomial cubic easing, NOT Bezier spatial curves. A Bezier motion path would not match what the renderer actually does. Users would see a smooth path but jerky actual motion.
**Do this instead:** Sample the actual interpolation engine at every frame (or every N frames) and connect the points with straight line segments. The path accurately represents what the user will see.

### Anti-Pattern 5: Layer Solo via Visibility Toggle

**What people do:** Implement solo by toggling `layer.visible` on non-solo layers.
**Why it's wrong:** This mutates the layer data, creates undo entries for every solo toggle, and loses the user's original visibility settings.
**Do this instead:** Use a separate `isolatedLayerIds` set (same pattern as existing `isolatedSequenceIds`). Filter at render time without modifying layer state.

## Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| audioStore <-> AudioEngine | Direct method calls | Engine reads store signals, writes back waveform/beat data |
| AudioEngine <-> PlaybackEngine | PlaybackEngine calls AudioEngine methods | One-way dependency: PlaybackEngine imports AudioEngine |
| audioStore <-> TimelineRenderer | TimelineRenderer reads audioStore signals | Reactive via Preact Signals |
| audioStore <-> projectStore | projectStore serializes audioStore data | Same pattern as sequenceStore <-> projectStore |
| beatDetector <-> audioStore | beatDetector is pure function, audioStore calls it | No circular dependency |
| motionPath <-> keyframeEngine | motionPath calls `interpolateAt()` from keyframeEngine | Read-only dependency |
| MotionPathOverlay <-> TransformOverlay | Sibling components in same container | Share canvas coordinate system via canvasStore |
| ffmpeg.rs <-> exportEngine | IPC via `export_encode_video` with new audio_path param | Backward-compatible: audio_path is optional |

## Build Order (Dependency-Driven)

Based on the data flow analysis, here is the recommended implementation order:

### Phase A: Audio Foundation (no dependencies on other new features)
1. **Types + Store**: `types/audio.ts` + `audioStore.ts` -- foundation everything else depends on
2. **Audio import**: Rust `audio_import` command + IPC + import UI (file dialog / drag-drop)
3. **Waveform generation**: `waveformGenerator.ts` + store integration
4. **Timeline audio track**: `AudioTrackRenderer.ts` in TimelineRenderer -- visual proof of import working
5. **Project persistence**: .mce v8 with `audio_tracks` field, serialize/deserialize

### Phase B: Audio Playback (depends on Phase A store)
6. **AudioEngine**: Web Audio API + HTMLAudioElement playback
7. **PlaybackEngine sync**: Modify start/stop/tick/seek to drive AudioEngine
8. **Audio fade in/out**: Gain envelope on AudioEngine + UI controls

### Phase C: Audio in Export (depends on Phases A + B for data)
9. **FFmpeg audio mux**: Modify `ffmpeg.rs` encode_video, update IPC, update exportEngine

### Phase D: Beat Sync (depends on Phase A waveform data)
10. **Beat detection**: `beatDetector.ts` energy-based algorithm
11. **Beat markers on timeline**: Render vertical lines at beat positions in AudioTrackRenderer
12. **Auto-arrange**: Beat-snap logic that adjusts key photo hold frames
13. **Manual BPM override**: UI for entering BPM + regenerating markers

### Phase E: Sidebar Solo Mode (independent of audio)
14. **Layer solo signal**: Add `isolatedLayerIds` to isolationStore
15. **Solo button UI**: SoloModeButton component in sidebar per sequence and per layer
16. **Render filtering**: PreviewRenderer + exportRenderer respect layer isolation

### Phase F: Canvas Motion Path (independent of audio)
17. **Motion path computation**: `motionPath.ts` using existing keyframeEngine
18. **SVG overlay**: MotionPathOverlay.tsx in canvas coordinate space
19. **Keyframe diamond dragging**: Pointer event handling to update keyframe position values
20. **Path styling**: Dotted line with easing color coding

### Phase ordering rationale:
- **A before B**: AudioEngine needs audioStore data to know what file to load
- **A before C**: Export needs audio path from audioStore
- **A before D**: Beat detection needs AudioBuffer from the import pipeline
- **B before C**: Export audio mux is conceptually separate but testing requires playback working
- **E and F are independent**: Can be built in parallel with audio phases or after

## Sources

- [MDN: Visualizations with Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API)
- [MDN: Using the Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_Web_Audio_API)
- [BBC waveform-data.js](https://github.com/bbc/waveform-data.js) -- reference for peak generation approach
- [Beat Detection Using JavaScript and the Web Audio API (Joe Sullivan)](http://joesul.li/van/beat-detection-using-web-audio/) -- energy-based BPM detection algorithm
- [BeatDetect.js](https://arthurbeaulieu.github.io/BeatDetect.js/) -- lightweight alternative to Essentia.js
- [Essentia.js](https://mtg.github.io/essentia.js/) -- heavy-weight alternative if accuracy is insufficient
- [FFmpeg muxing audio and video (Mux)](https://www.mux.com/articles/merge-audio-and-video-files-with-ffmpeg)
- [Audio-animation sync with Web Audio](https://hansgaron.com/articles/web_audio/animation_sync_with_audio/part_one/)
- [Adobe After Effects keyframe interpolation](https://helpx.adobe.com/after-effects/using/keyframe-interpolation.html)
- Existing codebase analysis: PlaybackEngine, PreviewRenderer, exportRenderer, ffmpeg.rs, projectStore, keyframeEngine, TransformOverlay

---
*Architecture research for: v0.3.0 Audio & Polish milestone integration*
*Researched: 2026-03-21*
