# Architecture Research: v2.0 Feature Integration

**Domain:** Layer compositing, FX effects, audio/beat sync, PNG export, undo/redo, keyboard shortcuts
**Researched:** 2026-03-03
**Confidence:** HIGH (based on direct codebase analysis + verified Motion Canvas API inspection)

## Existing Architecture Snapshot

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PREACT FRONTEND (WebView)                        │
│                                                                         │
│  ┌─────────────┐  ┌──────────────────────────────────────────────────┐  │
│  │  EditorShell │  │            SIGNAL STORES (7 existing)           │  │
│  │  ├ Toolbar   │  │  projectStore  sequenceStore  imageStore       │  │
│  │  ├ LeftPanel │  │  timelineStore layerStore(stub) uiStore        │  │
│  │  ├ CanvasArea│  │  historyStore(stub)                            │  │
│  │  ├ Timeline  │  │                                                │  │
│  │  └ Properties│  │  + Libs: frameMap, previewBridge, playbackEngine│  │
│  └─────────────┘  └──────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌─────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ Timeline Canvas (2D)    │  │ Preview: <img> overlay + hidden MC   │  │
│  │ TimelineRenderer class  │  │ player (Motion Canvas ready but      │  │
│  │ + ThumbnailCache        │  │ currently img-only rendering)        │  │
│  └─────────────────────────┘  └──────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                IPC: safeInvoke() wrapper over Tauri invoke()     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│                    TAURI RUST BACKEND                                    │
│  Commands: project_create/save/open, import_images, image_get_info     │
│  Services: image_pool (process, thumbnail), project_io (CRUD, migrate) │
│  Models: MceProject, MceSequence, MceKeyPhoto, MceImageRef             │
│  Plugins: dialog, store, fs, shell                                     │
│  Deps: image 0.25, uuid, chrono, serde/serde_json                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Critical Existing Patterns That v2.0 Must Respect

1. **markDirty callback chain** -- sequenceStore and imageStore use `_setMarkDirtyCallback()` to notify projectStore of changes, avoiding circular imports. New stores that dirty the project must follow this exact pattern.

2. **snake_case types matching Rust serde** -- All TypeScript types use snake_case for fields that cross the IPC boundary. New types (layers, audio, export) must follow this convention.

3. **PlaybackEngine with rAF delta accumulation** -- The clock at `playbackEngine.ts` uses `performance.now()` deltas. The comment says "audio-sync-ready." This is where AudioContext master clock will integrate.

4. **Preview is currently img overlay, NOT Motion Canvas rendering** -- The MC player is hidden (`opacity: 0`), and an `<img>` tag shows the current frame. v2.0 must transition to MC rendering for compositing to work.

5. **frameMap computed signal** -- Flattens all sequences + keyPhotos into a single `FrameEntry[]`. This is the backbone of timeline rendering and playback. Layers do NOT change frameMap -- they are per-sequence compositing state.

6. **Stores are module-scoped singletons** -- Not context-based. Each store exports signals and action functions. New stores follow this pattern.

7. **projectStore.hydrateFromMce / buildMceProject** -- The serialization gateway. New data (layers, audio references) must be added to both MceProject and the hydration/build cycle.

---

## Feature Integration Architecture

### 1. Layer System

#### Store Changes

**New store: Expand `layerStore.ts`** (currently a 35-line stub)

The existing `layerStore` has `layers`, `selectedLayerId`, and basic CRUD. It needs:

```typescript
// types/layer.ts -- EXPAND existing type
export type LayerType = 'static-image' | 'image-sequence' | 'video' | 'fx';
export type BlendMode = 'normal' | 'screen' | 'multiply' | 'overlay' | 'add';

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;        // NEW: prevent accidental edits
  opacity: number;
  blendMode: BlendMode;
  transform: LayerTransform;
  source: LayerSource;    // NEW: what content this layer shows
  fx_preset: string | null; // NEW: for FX layers, which preset to apply
}

export interface LayerSource {
  image_id: string | null;       // for static-image layers
  sequence_id: string | null;    // for image-sequence layers (references a sequence)
  video_path: string | null;     // for video layers (relative to project dir)
}

// LayerTransform stays as-is (x, y, scale, rotation, crop*)
```

**Key design decision: Layers are per-sequence, not global.**

Each sequence has its own layer stack. This matches the conceptual model: a sequence is a composition (like a timeline track in After Effects), and layers are the visual elements within it.

```typescript
// types/sequence.ts -- MODIFY
export interface Sequence {
  id: string;
  name: string;
  fps: number;
  width: number;
  height: number;
  keyPhotos: KeyPhoto[];
  layers: Layer[];  // NEW: ordered bottom-to-top
}
```

**layerStore becomes a view into the active sequence's layers:**

```typescript
// stores/layerStore.ts -- REWRITE
import { signal, computed } from '@preact/signals';
import { sequenceStore } from './sequenceStore';
import type { Layer } from '../types/layer';

const selectedLayerId = signal<string | null>(null);

// Derived: layers for the currently active sequence
const layers = computed<Layer[]>(() => {
  const seq = sequenceStore.getActiveSequence();
  return seq?.layers ?? [];
});

export const layerStore = {
  layers,           // computed, not writable directly
  selectedLayerId,

  add(layer: Layer) {
    const seqId = sequenceStore.activeSequenceId.value;
    if (!seqId) return;
    sequenceStore.updateSequence(seqId, (seq) => ({
      ...seq,
      layers: [...seq.layers, layer],
    }));
  },

  remove(layerId: string) { /* update active sequence's layers */ },
  reorder(fromIndex: number, toIndex: number) { /* ... */ },
  updateLayer(layerId: string, updates: Partial<Layer>) { /* ... */ },
  setSelected(id: string | null) { selectedLayerId.value = id; },
  reset() { selectedLayerId.value = null; },
};
```

This means `sequenceStore` needs a generic `updateSequence(id, updater)` method (it currently only has specific setters). Add:

```typescript
// sequenceStore -- ADD
updateSequence(id: string, updater: (seq: Sequence) => Sequence) {
  sequences.value = sequences.value.map(s =>
    s.id === id ? updater(s) : s
  );
  markDirty();
}
```

#### Preview Integration: Transition from img to Motion Canvas

The Preview component currently renders a flat `<img>` with `currentPreviewUrl`. For compositing, the Motion Canvas player must become the actual renderer.

**previewScene.tsx must be rewritten to build a dynamic scene graph:**

```typescript
// scenes/previewScene.tsx -- REWRITE
/** @jsxImportSource @efxlab/motion-canvas-2d/lib */
import { makeScene2D, Img, Rect, Node } from '@efxlab/motion-canvas-2d';
import { createRef, waitFor } from '@efxlab/motion-canvas-core';

// External signal bridge -- set from Preview component
// Motion Canvas scenes run in their own scope; use a global bridge
import { sceneConfig } from '../lib/sceneBridge';

export default makeScene2D(function* (view) {
  // Scene waits forever; external code drives updates via node refs
  const rootRef = createRef<Node>();
  view.add(<Node ref={rootRef} />);
  yield* waitFor(Infinity);
});
```

**New lib: `sceneBridge.ts`** -- bridges Preact signal state to Motion Canvas scene graph:

```typescript
// lib/sceneBridge.ts
import { signal } from '@preact/signals';
import type { Layer } from '../types/layer';

export interface SceneConfig {
  layers: Layer[];
  currentImageUrl: string;
  sequenceWidth: number;
  sequenceHeight: number;
}

export const sceneConfig = signal<SceneConfig>({
  layers: [],
  currentImageUrl: '',
  sequenceWidth: 1920,
  sequenceHeight: 1080,
});
```

**Preview component update strategy:**

Instead of fighting Motion Canvas's generator-based scene model, use a hybrid approach:

1. Keep the Motion Canvas player hidden for now (use it only for export rendering later)
2. Use an **OffscreenCanvas** or a regular `<canvas>` element with Canvas 2D API for real-time preview compositing
3. The canvas composites layers using `globalCompositeOperation` for blend modes

**Rationale:** Motion Canvas scenes use generator functions (`function*`) which don't easily bridge to reactive Preact signal updates. The preview compositing is actually simpler than Motion Canvas's animation model -- we just need to draw N layers with blend modes at the current frame. Canvas 2D's `globalCompositeOperation` supports all needed blend modes natively:

- `normal` -> `source-over` (default)
- `screen` -> `screen`
- `multiply` -> `multiply`
- `overlay` -> `overlay`
- `add` -> `lighter`

This is confirmed by the [MDN Canvas globalCompositeOperation docs](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation).

```typescript
// lib/previewRenderer.ts -- NEW
export class PreviewRenderer {
  private ctx: CanvasRenderingContext2D;
  private imageCache: Map<string, HTMLImageElement> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  render(layers: Layer[], currentImageUrl: string, width: number, height: number) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    for (const layer of layers) {
      if (!layer.visible || layer.opacity === 0) continue;

      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = blendModeToComposite(layer.blendMode);

      // Apply transform
      const t = layer.transform;
      ctx.translate(t.x + width / 2, t.y + height / 2);
      ctx.rotate(t.rotation * Math.PI / 180);
      ctx.scale(t.scale, t.scale);

      // Draw layer content based on type
      this.drawLayerContent(layer, width, height);

      ctx.restore();
    }
  }
}

function blendModeToComposite(mode: BlendMode): GlobalCompositeOperation {
  const map: Record<BlendMode, GlobalCompositeOperation> = {
    normal: 'source-over',
    screen: 'screen',
    multiply: 'multiply',
    overlay: 'overlay',
    add: 'lighter',
  };
  return map[mode];
}
```

**Confidence: HIGH** -- Canvas 2D globalCompositeOperation is a stable web standard. All five blend modes map directly. No library needed.

#### MceProject Serialization

The `.mce` file format needs layer data. Add to `MceSequence`:

```typescript
// types/project.ts -- MODIFY MceSequence
export interface MceSequence {
  id: string;
  name: string;
  fps: number;
  width: number;
  height: number;
  order: number;
  key_photos: MceKeyPhoto[];
  layers: MceLayer[];  // NEW
}

export interface MceLayer {
  id: string;
  name: string;
  type: string;  // 'static-image' | 'image-sequence' | 'video' | 'fx'
  visible: boolean;
  locked: boolean;
  opacity: number;
  blend_mode: string;
  transform: MceLayerTransform;
  source_image_id: string | null;
  source_sequence_id: string | null;
  source_video_path: string | null;  // relative to project root
  fx_preset: string | null;
  order: number;
}
```

**Rust side:** Add matching `MceLayer` struct to `models/project.rs` and update `MceSequence`. Bump `version` to 2 in MceProject. Add migration logic to handle v1 files (no layers field = empty layers array).

#### File Structure Changes

```
src/
  types/layer.ts          -- MODIFY (add LayerSource, fx_preset, locked)
  types/sequence.ts       -- MODIFY (add layers field)
  types/project.ts        -- MODIFY (add MceLayer, MceLayerTransform)
  stores/layerStore.ts    -- REWRITE (computed from active sequence)
  stores/sequenceStore.ts -- MODIFY (add updateSequence, layer-aware methods)
  stores/projectStore.ts  -- MODIFY (hydrate/build handle layers)
  lib/previewRenderer.ts  -- NEW (Canvas 2D compositing engine)
  lib/sceneBridge.ts      -- NEW (bridge state to preview renderer)
  components/Preview.tsx   -- REWRITE (canvas compositing instead of img tag)
  components/layout/PropertiesPanel.tsx -- REWRITE (context-sensitive layer properties)

src-tauri/src/
  models/project.rs       -- MODIFY (add MceLayer struct)
```

---

### 2. FX Effects

#### Architecture

FX effects (grain, scratches, light leaks, vignette, color grade) are implemented as **FX layers** -- special layers with `type: 'fx'` and an `fx_preset` identifier.

**Why FX-as-layers (not post-process):** The user can reorder FX relative to image layers, adjust opacity/blend mode per-FX, and toggle visibility. This is the Photoshop/After Effects model users expect.

#### Rendering Approach: Canvas 2D Filters + Custom Drawing

Motion Canvas supports CSS filters (`brightness`, `contrast`, `saturate`, `sepia`, `grayscale`, `hue`, `blur`, `invert`) on any node via the `filters` property (confirmed in `@efxlab/motion-canvas-2d/lib/partials/Filter.d.ts`). It also supports **custom WebGL shaders** via the experimental `shaders` property on nodes.

For the preview renderer (Canvas 2D approach), FX effects render as:

| FX | Implementation | Confidence |
|----|----------------|------------|
| **Grain** | Draw noise texture (pre-generated ImageData) composited with `overlay` blend | HIGH |
| **Dirt/Scratches** | Draw pre-made scratch texture images composited with `screen` | HIGH |
| **Light Leaks** | Draw gradient/texture images composited with `screen` or `add` | HIGH |
| **Vignette** | Draw radial gradient (black edges) composited with `multiply` | HIGH |
| **Color Grade** | Apply `ctx.filter` with CSS filter string (brightness, contrast, saturate, sepia, hue-rotate) | HIGH |

```typescript
// lib/fx/grain.ts -- NEW
export function renderGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
  seed: number
) {
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  // Simple PRNG seeded by frame number for consistent grain per frame
  let rng = seed;
  for (let i = 0; i < data.length; i += 4) {
    rng = (rng * 1664525 + 1013904223) & 0xFFFFFFFF;
    const noise = ((rng >>> 16) & 0xFF) - 128;
    const v = Math.round(noise * intensity);
    data[i] = 128 + v;     // R
    data[i + 1] = 128 + v; // G
    data[i + 2] = 128 + v; // B
    data[i + 3] = 255;     // A
  }
  // Draw noise to temp canvas, then composite
  const tempCanvas = new OffscreenCanvas(width, height);
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.putImageData(imageData, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = intensity;
  ctx.drawImage(tempCanvas, 0, 0);
  ctx.restore();
}
```

**FX presets are defined in code, not user-configurable:** Each preset has named parameters (intensity, color, etc.) that the user adjusts via the Properties panel. No plugin system needed.

```typescript
// lib/fx/presets.ts -- NEW
export interface FxPreset {
  id: string;
  name: string;
  category: 'texture' | 'color' | 'light';
  render: (ctx: CanvasRenderingContext2D, w: number, h: number, params: Record<string, number>, frame: number) => void;
  defaultParams: Record<string, number>;
  paramRanges: Record<string, { min: number; max: number; step: number; label: string }>;
}

export const FX_PRESETS: FxPreset[] = [
  { id: 'grain', name: 'Film Grain', category: 'texture', render: renderGrain, defaultParams: { intensity: 0.3 }, ... },
  { id: 'scratches', name: 'Dirt & Scratches', category: 'texture', render: renderScratches, defaultParams: { density: 0.5, length: 0.7 }, ... },
  { id: 'light-leak', name: 'Light Leak', category: 'light', render: renderLightLeak, defaultParams: { intensity: 0.4, position: 0.5, hue: 30 }, ... },
  { id: 'vignette', name: 'Vignette', category: 'light', render: renderVignette, defaultParams: { intensity: 0.6, softness: 0.5 }, ... },
  { id: 'color-grade', name: 'Color Grade', category: 'color', render: renderColorGrade, defaultParams: { brightness: 1, contrast: 1, saturate: 1, sepia: 0, hue: 0 }, ... },
];
```

#### FX Layer Data in Sequence

```typescript
// An FX layer in the layer stack:
const grainLayer: Layer = {
  id: crypto.randomUUID(),
  name: 'Film Grain',
  type: 'fx',
  visible: true,
  locked: false,
  opacity: 0.4,
  blendMode: 'overlay',
  transform: { x: 0, y: 0, scale: 1, rotation: 0, cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0 },
  source: { image_id: null, sequence_id: null, video_path: null },
  fx_preset: 'grain',
};
```

#### FX Parameters Storage

FX parameters (intensity, density, etc.) need to be stored per-layer. Add to the Layer type:

```typescript
export interface Layer {
  // ... existing fields
  fx_params: Record<string, number>;  // NEW: e.g., { intensity: 0.3, density: 0.5 }
}
```

#### File Structure Changes

```
src/
  lib/fx/                    -- NEW directory
    presets.ts               -- FX preset definitions
    grain.ts                 -- Grain renderer
    scratches.ts             -- Scratch renderer
    lightLeak.ts             -- Light leak renderer
    vignette.ts              -- Vignette renderer
    colorGrade.ts            -- Color grade (CSS filter-based) renderer
    index.ts                 -- Re-exports
  types/layer.ts             -- MODIFY (add fx_params)
```

---

### 3. Audio Import, Waveform, and Beat Sync

#### Architecture Overview

Audio has three distinct subsystems:

1. **Audio File Management** -- Import, store reference, copy to project dir (Rust)
2. **Waveform Visualization** -- Decode audio, extract waveform peaks, draw on timeline canvas (Rust decode + Frontend render)
3. **Beat Detection** -- Analyze audio for BPM and beat positions (Frontend Web Audio API)
4. **Audio Playback** -- Sync with PlaybackEngine clock (Frontend Web Audio API)

#### Audio File Import (Rust)

Audio files are imported similar to images: copied to `project_dir/audio/` and referenced by ID.

```rust
// src-tauri/src/models/audio.rs -- NEW
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioRef {
    pub id: String,
    pub original_filename: String,
    pub relative_path: String,  // audio/filename_uuid.wav
    pub duration_secs: f64,
    pub sample_rate: u32,
    pub channels: u16,
}
```

```typescript
// types/audio.ts -- NEW
export interface AudioRef {
  id: string;
  original_filename: string;
  relative_path: string;
  duration_secs: number;
  sample_rate: number;
  channels: number;
}

export interface WaveformData {
  peaks: Float32Array;    // normalized -1..1 peaks at ~200 samples/sec
  sample_rate: number;    // sample rate of the original audio
  duration_secs: number;
}

export interface BeatMarker {
  time_secs: number;
  strength: number;  // 0..1 confidence
}

export interface AudioState {
  audio_ref: AudioRef | null;
  waveform: WaveformData | null;
  beats: BeatMarker[];
  bpm: number | null;
  offset_secs: number;  // trim start position
  volume: number;        // 0..1
}
```

#### Waveform Generation

**Option A: Rust-side with Symphonia** -- Decode audio in Rust, downsample to ~200 peaks/sec, send as `Vec<f32>` via IPC.
**Option B: Frontend with Web Audio API** -- Decode via `AudioContext.decodeAudioData()`, downsample in JS.

**Decision: Frontend (Web Audio API)** because:
- AudioContext.decodeAudioData handles all formats the browser supports (MP3, WAV, AAC, OGG, FLAC)
- No need for Symphonia dependency in Rust
- Waveform peaks are generated once per audio import, cached in memory
- Keeps Rust backend focused on file I/O, not audio processing

```typescript
// lib/audioEngine.ts -- NEW
export class AudioEngine {
  private audioContext: AudioContext;
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode;
  private startTime: number = 0;
  private startOffset: number = 0;

  constructor() {
    this.audioContext = new AudioContext();
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
  }

  async loadAudio(url: string): Promise<AudioBuffer> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    return this.audioBuffer;
  }

  extractWaveformPeaks(buffer: AudioBuffer, samplesPerSecond: number = 200): Float32Array {
    const channelData = buffer.getChannelData(0); // mono or left channel
    const blockSize = Math.floor(buffer.sampleRate / samplesPerSecond);
    const peakCount = Math.ceil(channelData.length / blockSize);
    const peaks = new Float32Array(peakCount);

    for (let i = 0; i < peakCount; i++) {
      const start = i * blockSize;
      const end = Math.min(start + blockSize, channelData.length);
      let max = 0;
      for (let j = start; j < end; j++) {
        const abs = Math.abs(channelData[j]);
        if (abs > max) max = abs;
      }
      peaks[i] = max;
    }
    return peaks;
  }

  // Sync playback with PlaybackEngine
  playFromFrame(frame: number, fps: number) {
    this.stop();
    const time = frame / fps;
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.connect(this.gainNode);
    this.sourceNode.start(0, time);
    this.startTime = this.audioContext.currentTime;
    this.startOffset = time;
  }

  stop() {
    this.sourceNode?.stop();
    this.sourceNode = null;
  }

  setVolume(volume: number) {
    this.gainNode.gain.value = volume;
  }
}
```

#### Beat Detection

**Decision: Frontend with `web-audio-beat-detector` npm package** because:
- Pure JS/TS, works with AudioBuffer directly
- Returns BPM and beat offset
- No Rust dependency needed
- Verified on npm: [web-audio-beat-detector](https://www.npmjs.com/package/web-audio-beat-detector)

```typescript
// lib/beatDetector.ts -- NEW
import { analyze, guess } from 'web-audio-beat-detector';

export async function detectBeats(audioBuffer: AudioBuffer): Promise<{
  bpm: number;
  offset: number;
  beats: Array<{ time_secs: number; strength: number }>;
}> {
  const { bpm, offset } = await guess(audioBuffer);
  const beatInterval = 60 / bpm;

  // Generate beat marker positions from offset through duration
  const beats: Array<{ time_secs: number; strength: number }> = [];
  let time = offset;
  while (time < audioBuffer.duration) {
    beats.push({ time_secs: time, strength: 1.0 });
    time += beatInterval;
  }

  return { bpm, offset, beats };
}
```

**Confidence: MEDIUM** -- web-audio-beat-detector works well for electronic/rhythmic music. Results degrade for complex acoustic music. The user can manually adjust BPM and offset to correct inaccuracies.

#### Audio Store

```typescript
// stores/audioStore.ts -- NEW
import { signal } from '@preact/signals';
import type { AudioRef, WaveformData, BeatMarker } from '../types/audio';

const audioRef = signal<AudioRef | null>(null);
const waveform = signal<WaveformData | null>(null);
const beats = signal<BeatMarker[]>([]);
const bpm = signal<number | null>(null);
const beatOffset = signal<number>(0);
const volume = signal<number>(0.8);
const isAnalyzing = signal<boolean>(false);

// markDirty callback for projectStore
let _markDirty: (() => void) | null = null;
export function _setAudioMarkDirtyCallback(fn: () => void) {
  _markDirty = fn;
}

export const audioStore = {
  audioRef, waveform, beats, bpm, beatOffset, volume, isAnalyzing,

  setAudio(ref: AudioRef, waveformData: WaveformData) {
    audioRef.value = ref;
    waveform.value = waveformData;
    _markDirty?.();
  },

  setBeats(detectedBpm: number, offset: number, markers: BeatMarker[]) {
    bpm.value = detectedBpm;
    beatOffset.value = offset;
    beats.value = markers;
    _markDirty?.();
  },

  removeAudio() {
    audioRef.value = null;
    waveform.value = null;
    beats.value = [];
    bpm.value = null;
    beatOffset.value = 0;
    _markDirty?.();
  },

  setVolume(v: number) { volume.value = Math.max(0, Math.min(1, v)); },

  reset() {
    audioRef.value = null;
    waveform.value = null;
    beats.value = [];
    bpm.value = null;
    beatOffset.value = 0;
    volume.value = 0.8;
    isAnalyzing.value = false;
  },
};
```

#### PlaybackEngine Audio Integration

The existing `PlaybackEngine.tick` uses `performance.now()`. For audio sync:

```typescript
// playbackEngine.ts -- MODIFY start/stop methods

start() {
  if (this.rafId !== null) return;
  this.lastTime = performance.now();
  this.accumulator = 0;
  timelineStore.setPlaying(true);
  // Start audio playback synced to current frame
  audioEngine.playFromFrame(
    timelineStore.currentFrame.peek(),
    projectStore.fps.peek()
  );
  this.rafId = requestAnimationFrame(this.tick);
}

stop() {
  if (this.rafId !== null) {
    cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }
  timelineStore.setPlaying(false);
  audioEngine.stop();
}
```

The existing delta accumulation clock remains the master -- audio playback is started from the matching position and runs in parallel. For short stop-motion sequences (typically 30-300 frames at 15-24fps = 1-20 seconds), drift between rAF clock and AudioContext clock is negligible.

#### Waveform in Timeline Canvas

The `TimelineRenderer` needs a new row or overlay for the audio waveform:

```typescript
// TimelineRenderer.ts -- ADD method
drawWaveform(
  ctx: CanvasRenderingContext2D,
  waveform: WaveformData,
  beats: BeatMarker[],
  y: number,
  height: number,
  frameWidth: number,
  scrollX: number,
  canvasWidth: number,
  fps: number
) {
  const peaksPerFrame = waveform.sample_rate_peaks / fps;
  // ... draw waveform peaks as vertical bars
  // ... draw beat markers as vertical lines
}
```

#### MceProject Audio Data

```typescript
// types/project.ts -- ADD to MceProject
export interface MceProject {
  // ... existing fields
  audio: MceAudioRef | null;  // NEW
}

export interface MceAudioRef {
  id: string;
  original_filename: string;
  relative_path: string;
  duration_secs: number;
  sample_rate: number;
  channels: number;
  bpm: number | null;
  beat_offset: number;
  volume: number;
}
```

#### Rust Audio Import Command

```rust
// commands/audio.rs -- NEW
#[tauri::command]
pub async fn import_audio(
    app: tauri::AppHandle,
    path: String,
    project_dir: String,
) -> Result<AudioRef, String> {
    // 1. Validate file exists and has audio extension
    // 2. Create project_dir/audio/ if needed
    // 3. Copy file to project_dir/audio/filename_uuid.ext
    // 4. Return AudioRef with basic metadata
    // NOTE: Duration/sample_rate extracted on frontend via Web Audio API
}
```

#### File Structure Changes

```
src/
  types/audio.ts              -- NEW
  types/project.ts            -- MODIFY (add MceAudioRef)
  stores/audioStore.ts        -- NEW
  stores/projectStore.ts      -- MODIFY (hydrate/build audio, wire markDirty)
  lib/audioEngine.ts          -- NEW (Web Audio playback + waveform extraction)
  lib/beatDetector.ts         -- NEW (BPM detection wrapper)
  lib/ipc.ts                  -- MODIFY (add importAudio wrapper)
  lib/playbackEngine.ts       -- MODIFY (audio sync on start/stop)
  lib/autoSave.ts             -- MODIFY (watch audioStore signals)
  components/timeline/
    TimelineRenderer.ts       -- MODIFY (add waveform + beat marker drawing)

src-tauri/src/
  commands/audio.rs           -- NEW
  commands/mod.rs             -- MODIFY (register audio commands)
  models/audio.rs             -- NEW (AudioRef struct)
  models/mod.rs               -- MODIFY
  models/project.rs           -- MODIFY (add MceAudioRef to MceProject)
  lib.rs                      -- MODIFY (register audio commands)

New dependency: web-audio-beat-detector (npm)
```

---

### 4. PNG Image Sequence Export

#### Architecture

Export renders each frame of the composition to a PNG file. The rendering happens in the frontend (Canvas 2D), and the file writing happens in Rust.

**Flow:**

```
User clicks Export -> Configure dialog -> Start export
    |
    v
Frontend: for each frame 0..totalFrames:
    1. Set playhead to frame N
    2. PreviewRenderer.render() composites all layers to canvas
    3. canvas.toBlob('image/png') -> Blob
    4. Blob -> ArrayBuffer -> Uint8Array
    5. IPC: invoke('export_write_frame', { data: [...bytes], index: N, outputDir })
    |
    v
Rust: write bytes to outputDir/frame_NNNNNN.png
    |
    v
Rust: emit progress event -> Frontend updates progress bar
    |
    v
After all frames: write audio metadata text file (if audio present)
```

**Why Canvas 2D (not Motion Canvas) for export:** The preview renderer already composites all layers with blend modes and FX. Reusing it for export means what you see is what you get. No need to build a parallel Motion Canvas scene graph for export.

**Why not OffscreenCanvas in a Worker:** Tauri's IPC (`invoke`) is only available from the main thread. The frame bytes must cross the IPC boundary to Rust. A worker would need `postMessage` back to main before `invoke`, adding complexity with no clear benefit for stop-motion frame counts (typically < 5000 frames).

#### Export Store

```typescript
// stores/exportStore.ts -- NEW
import { signal, computed } from '@preact/signals';

export interface ExportConfig {
  output_dir: string;
  width: number;
  height: number;
  naming_pattern: string;  // e.g., 'frame_{N}' where {N} is zero-padded
  padding: number;         // zero-padding digits (default 6)
  include_audio_metadata: boolean;
}

const isExporting = signal(false);
const progress = signal(0);       // 0..1
const currentFrame = signal(0);
const totalExportFrames = signal(0);
const exportError = signal<string | null>(null);

export const exportStore = {
  isExporting, progress, currentFrame, totalExportFrames, exportError,

  startExport(total: number) {
    isExporting.value = true;
    progress.value = 0;
    currentFrame.value = 0;
    totalExportFrames.value = total;
    exportError.value = null;
  },

  updateProgress(frame: number) {
    currentFrame.value = frame;
    progress.value = totalExportFrames.value > 0 ? frame / totalExportFrames.value : 0;
  },

  completeExport() {
    isExporting.value = false;
    progress.value = 1;
  },

  failExport(error: string) {
    isExporting.value = false;
    exportError.value = error;
  },

  reset() {
    isExporting.value = false;
    progress.value = 0;
    currentFrame.value = 0;
    totalExportFrames.value = 0;
    exportError.value = null;
  },
};
```

#### Export Engine

```typescript
// lib/exportEngine.ts -- NEW
import { PreviewRenderer } from './previewRenderer';
import { safeInvoke } from './ipc';
import { exportStore } from '../stores/exportStore';
import type { ExportConfig } from '../stores/exportStore';
import { frameMap, totalFrames } from './frameMap';
import { layerStore } from '../stores/layerStore';
import { sequenceStore } from '../stores/sequenceStore';
import { imageStore } from '../stores/imageStore';

export async function runExport(config: ExportConfig): Promise<void> {
  const total = totalFrames.peek();
  exportStore.startExport(total);

  // Create a dedicated offscreen canvas for export at target resolution
  const canvas = new OffscreenCanvas(config.width, config.height);
  const renderer = new PreviewRenderer(canvas as any); // PreviewRenderer accepts canvas

  try {
    for (let frame = 0; frame < total; frame++) {
      if (!exportStore.isExporting.peek()) break; // cancelled

      // Get the sequence for this frame to know which layers to render
      const entry = frameMap.peek()[frame];
      const seq = sequenceStore.getById(entry.sequenceId);
      const layers = seq?.layers ?? [];

      // Render frame
      renderer.render(layers, getImageUrlForFrame(frame), config.width, config.height);

      // Extract PNG bytes
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = Array.from(new Uint8Array(arrayBuffer));

      // Write via Rust
      const frameNum = String(frame).padStart(config.padding, '0');
      const filename = config.naming_pattern.replace('{N}', frameNum) + '.png';

      const result = await safeInvoke('export_write_frame', {
        data: bytes,
        filename,
        outputDir: config.output_dir,
      });

      if (!result.ok) {
        exportStore.failExport(result.error);
        return;
      }

      exportStore.updateProgress(frame + 1);
    }

    exportStore.completeExport();
  } catch (err) {
    exportStore.failExport(String(err));
  }
}
```

#### Rust Export Command

```rust
// commands/export.rs -- NEW
#[tauri::command]
pub async fn export_write_frame(
    data: Vec<u8>,
    filename: String,
    output_dir: String,
) -> Result<(), String> {
    let dir = std::path::Path::new(&output_dir);
    std::fs::create_dir_all(dir)
        .map_err(|e| format!("Failed to create export dir: {}", e))?;

    let path = dir.join(&filename);
    std::fs::write(&path, &data)
        .map_err(|e| format!("Failed to write frame: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn export_write_metadata(
    output_dir: String,
    metadata: String,
) -> Result<(), String> {
    let path = std::path::Path::new(&output_dir).join("audio_metadata.txt");
    std::fs::write(&path, &metadata)
        .map_err(|e| format!("Failed to write metadata: {}", e))?;
    Ok(())
}
```

**Performance note:** For a 1920x1080 PNG, each frame is ~2-6MB. At 24fps, a 10-second sequence = 240 frames = ~500MB-1.4GB of disk writes. This is I/O bound, not CPU bound. The bottleneck is `canvas.convertToBlob()` (PNG compression). For stop-motion projects this is acceptable -- a 5-minute sequence at 24fps = 7200 frames, which at ~3 seconds/frame export would take ~6 hours. But typical stop-motion sequences are 30-300 frames.

#### File Structure Changes

```
src/
  stores/exportStore.ts       -- NEW
  lib/exportEngine.ts         -- NEW
  lib/ipc.ts                  -- MODIFY (add export_write_frame, export_write_metadata)
  components/export/          -- NEW directory
    ExportDialog.tsx          -- NEW (config UI)
    ExportProgress.tsx        -- NEW (progress bar overlay)

src-tauri/src/
  commands/export.rs          -- NEW
  commands/mod.rs             -- MODIFY
  lib.rs                      -- MODIFY (register export commands)
```

---

### 5. Undo/Redo

#### Architecture

The existing `historyStore.ts` is a stub with `stack` and `pointer` signals, plus an existing `HistoryEntry` type with `undo()` and `redo()` functions.

**Decision: Command pattern (closures capturing before/after state)**

The existing `HistoryEntry` type already defines this:

```typescript
// types/history.ts (EXISTING -- keep as-is)
export interface HistoryEntry {
  id: string;
  description: string;
  timestamp: number;
  undo: () => void;
  redo: () => void;
}
```

**Why command pattern over snapshot pattern:** The project state includes images, audio references, and layer stacks across multiple sequences. Full snapshots would be expensive to serialize for every keystroke. Command pattern captures only the delta (before/after values for the specific fields changed).

#### historyStore Implementation

```typescript
// stores/historyStore.ts -- REWRITE
import { signal, computed } from '@preact/signals';
import type { HistoryEntry } from '../types/history';

const MAX_HISTORY = 100;
const stack = signal<HistoryEntry[]>([]);
const pointer = signal(-1); // points to current position; -1 = nothing to undo

const canUndo = computed(() => pointer.value >= 0);
const canRedo = computed(() => pointer.value < stack.value.length - 1);
const currentDescription = computed(() =>
  pointer.value >= 0 ? stack.value[pointer.value].description : null
);

export const historyStore = {
  stack, pointer, canUndo, canRedo, currentDescription,

  push(entry: HistoryEntry) {
    // Truncate any redo entries ahead of pointer
    const truncated = stack.value.slice(0, pointer.value + 1);
    // Add new entry
    const updated = [...truncated, entry];
    // Cap at MAX_HISTORY (remove from front)
    if (updated.length > MAX_HISTORY) {
      stack.value = updated.slice(updated.length - MAX_HISTORY);
      pointer.value = stack.value.length - 1;
    } else {
      stack.value = updated;
      pointer.value = updated.length - 1;
    }
  },

  undo() {
    if (pointer.value < 0) return;
    const entry = stack.value[pointer.value];
    entry.undo();
    pointer.value -= 1;
  },

  redo() {
    if (pointer.value >= stack.value.length - 1) return;
    pointer.value += 1;
    const entry = stack.value[pointer.value];
    entry.redo();
  },

  reset() {
    stack.value = [];
    pointer.value = -1;
  },
};
```

#### Wrapping Store Actions with History

Every user-visible mutation needs a history wrapper. Create a helper:

```typescript
// lib/historyHelper.ts -- NEW
import { historyStore } from '../stores/historyStore';
import type { HistoryEntry } from '../types/history';

export function withHistory<T>(
  description: string,
  getValue: () => T,
  setValue: (v: T) => void,
  action: () => void
): void {
  const before = getValue();
  action();
  const after = getValue();

  const entry: HistoryEntry = {
    id: crypto.randomUUID(),
    description,
    timestamp: Date.now(),
    undo: () => setValue(before),
    redo: () => setValue(after),
  };

  historyStore.push(entry);
}

// Usage example:
// withHistory(
//   'Add layer',
//   () => sequenceStore.getActiveSequence()?.layers ?? [],
//   (layers) => sequenceStore.updateSequence(seqId, s => ({...s, layers})),
//   () => layerStore.add(newLayer)
// );
```

**Which operations get undo:** All user-initiated mutations to project data. NOT: timeline scrubbing, zoom, scroll, panel resizes, selection changes. These are UI state, not document state.

| Undoable | Not Undoable |
|----------|-------------|
| Add/remove/reorder sequence | Scrub timeline |
| Add/remove/reorder layer | Zoom/scroll |
| Change layer opacity/blend/transform | Select layer/sequence |
| Change hold frames | Panel resize |
| Add/remove key photo | Play/pause |
| Import images | Change volume |
| Change sequence FPS/resolution | |
| Add/remove audio | |
| Change FX parameters | |

#### File Structure Changes

```
src/
  stores/historyStore.ts     -- REWRITE
  lib/historyHelper.ts       -- NEW
  stores/sequenceStore.ts    -- MODIFY (wrap mutations with history)
  stores/layerStore.ts       -- MODIFY (wrap mutations with history)
  stores/imageStore.ts       -- MODIFY (wrap import with history)
```

---

### 6. Keyboard Shortcuts

#### Architecture

**Decision: Single global keydown listener, registered once in EditorShell.**

Not a hook -- a module-scoped handler that maps key combos to store actions. Using a hook (`useKeyboard`) would create/destroy listeners on every mount/unmount and risks duplicate bindings.

```typescript
// lib/shortcuts.ts -- NEW
import { playbackEngine } from './playbackEngine';
import { historyStore } from '../stores/historyStore';
import { projectStore } from '../stores/projectStore';
import { timelineStore } from '../stores/timelineStore';
import { uiStore } from '../stores/uiStore';

export interface Shortcut {
  key: string;
  meta?: boolean;   // Cmd on macOS
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
  when?: () => boolean;  // conditional availability
}

const shortcuts: Shortcut[] = [
  // Playback
  { key: ' ', description: 'Play/Pause', action: () => playbackEngine.toggle() },
  { key: 'ArrowLeft', description: 'Step backward', action: () => playbackEngine.stepBackward() },
  { key: 'ArrowRight', description: 'Step forward', action: () => playbackEngine.stepForward() },
  { key: 'j', description: 'Play backward', action: () => { /* reverse playback */ } },
  { key: 'k', description: 'Pause', action: () => playbackEngine.stop() },
  { key: 'l', description: 'Play forward', action: () => playbackEngine.start() },
  { key: 'Home', description: 'Go to start', action: () => playbackEngine.seekToFrame(0) },

  // Edit
  { key: 'z', meta: true, description: 'Undo', action: () => historyStore.undo() },
  { key: 'z', meta: true, shift: true, description: 'Redo', action: () => historyStore.redo() },

  // Project
  { key: 's', meta: true, description: 'Save', action: () => projectStore.saveProject() },
  { key: 'n', meta: true, description: 'New project', action: () => { /* open new project dialog */ } },
  { key: 'o', meta: true, description: 'Open project', action: () => { /* open file dialog */ } },

  // View
  { key: '0', meta: true, description: 'Fit to screen', action: () => { /* reset preview zoom */ } },
  { key: '=', meta: true, description: 'Zoom in', action: () => { /* zoom preview */ } },
  { key: '-', meta: true, description: 'Zoom out', action: () => { /* zoom preview */ } },

  // Help
  { key: '/', meta: true, description: 'Show shortcuts', action: () => { /* toggle help overlay */ } },
];

let isRegistered = false;

function handleKeyDown(e: KeyboardEvent) {
  // Skip if user is typing in an input
  const target = e.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
    return;
  }

  for (const shortcut of shortcuts) {
    const metaMatch = shortcut.meta ? e.metaKey : !e.metaKey;
    const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
    const altMatch = shortcut.alt ? e.altKey : !e.altKey;

    if (e.key === shortcut.key && metaMatch && shiftMatch && altMatch) {
      if (shortcut.when && !shortcut.when()) continue;
      e.preventDefault();
      shortcut.action();
      return;
    }
  }
}

export function registerShortcuts() {
  if (isRegistered) return;
  document.addEventListener('keydown', handleKeyDown);
  isRegistered = true;
}

export function unregisterShortcuts() {
  document.removeEventListener('keydown', handleKeyDown);
  isRegistered = false;
}

export function getShortcutList(): Shortcut[] {
  return [...shortcuts];
}
```

#### Preventing Tauri Default Shortcuts

Tauri 2.0 on macOS may intercept Cmd+Q, Cmd+H, etc. The shortcuts module should let these through by not calling `preventDefault()` for system-reserved combos.

#### Help Overlay Component

```
src/
  components/help/
    ShortcutOverlay.tsx    -- NEW (modal listing all shortcuts)
```

#### File Structure Changes

```
src/
  lib/shortcuts.ts           -- NEW
  components/help/
    ShortcutOverlay.tsx      -- NEW
  components/layout/
    EditorShell.tsx           -- MODIFY (call registerShortcuts on mount)
```

---

## Complete Data Flow: v2.0

### User Edit with Undo

```
[User Action] (e.g., change layer opacity)
    |
    v
[Component] calls layerStore.updateLayer(id, {opacity: 0.5})
    |
    +--> [historyHelper.withHistory()] captures before/after
    |        |
    |        v
    |    [historyStore.push(entry)] adds to undo stack
    |
    v
[sequenceStore.updateSequence()] mutates layers within sequence
    |
    +--> [markDirty()] -> projectStore.isDirty = true -> autoSave triggers
    |
    +--> [layerStore.layers computed] auto-updates
    |         |
    |         v
    |    [Preview canvas] re-renders with new opacity
    |    [Properties panel] re-renders slider position
    |    [Layer list] re-renders opacity display
    |
    v
[Cmd+Z] -> historyStore.undo() -> entry.undo() -> restores previous opacity
```

### Export Flow (Detailed)

```
[User: Export menu -> Configure -> Start]
    |
    v
[ExportDialog] collects: outputDir, width, height, naming
    |
    v
[exportEngine.runExport(config)]
    |
    v
[Loop: frame 0 to totalFrames]
    |
    +--> frameMap[frame] -> sequenceId, imageId
    |
    +--> Get sequence layers
    |
    +--> PreviewRenderer.render(layers, imageUrl, w, h)
    |         |
    |         +--> For each visible layer:
    |         |      ctx.globalAlpha = opacity
    |         |      ctx.globalCompositeOperation = blendMode
    |         |      draw layer content (image / FX)
    |         |
    |         v
    |    canvas.convertToBlob('image/png')
    |         |
    |         v
    |    Blob -> ArrayBuffer -> Uint8Array -> Array<number>
    |
    +--> IPC: invoke('export_write_frame', {data, filename, outputDir})
    |         |
    |         v
    |    Rust: fs::write(path, bytes)
    |
    +--> exportStore.updateProgress(frame + 1)
    |         |
    |         v
    |    [ExportProgress component] re-renders progress bar
    |
    v
[All frames done] -> exportStore.completeExport()
    |
    v
[Optional: write audio_metadata.txt via Rust]
```

### Audio Playback Sync

```
[User clicks Play]
    |
    v
[PlaybackEngine.start()]
    |
    +--> audioEngine.playFromFrame(currentFrame, fps)
    |         |
    |         v
    |    AudioBufferSourceNode.start(0, timeOffset)
    |
    +--> timelineStore.setPlaying(true)
    |
    v
[rAF tick loop]
    |
    +--> delta accumulation advances frame
    |
    +--> Preview canvas re-renders
    |
    +--> Timeline canvas redraws playhead
    |
    +--> Audio plays in parallel (AudioContext clock)
    |
    v
[User clicks Pause / reaches end]
    |
    v
[PlaybackEngine.stop()]
    |
    +--> audioEngine.stop()
    +--> timelineStore.setPlaying(false)
```

---

## New Store Inventory

After v2.0, the store count goes from 7 to 9:

| Store | Status | Purpose |
|-------|--------|---------|
| `projectStore` | MODIFY | Add audio field to MceProject serialization |
| `sequenceStore` | MODIFY | Add layers field, updateSequence() method |
| `imageStore` | EXISTING | No changes needed |
| `timelineStore` | EXISTING | No changes needed |
| `layerStore` | REWRITE | Computed from active sequence's layers |
| `uiStore` | MODIFY | Add export dialog state, help overlay state |
| `historyStore` | REWRITE | Full undo/redo implementation |
| `audioStore` | NEW | Audio reference, waveform, beats, BPM |
| `exportStore` | NEW | Export progress, config, state |

---

## New Files Inventory

### Frontend (TypeScript)

| File | Type | Purpose |
|------|------|---------|
| `types/audio.ts` | NEW | AudioRef, WaveformData, BeatMarker types |
| `stores/audioStore.ts` | NEW | Audio state management |
| `stores/exportStore.ts` | NEW | Export progress state |
| `lib/previewRenderer.ts` | NEW | Canvas 2D layer compositing engine |
| `lib/audioEngine.ts` | NEW | Web Audio playback + waveform extraction |
| `lib/beatDetector.ts` | NEW | BPM detection wrapper |
| `lib/exportEngine.ts` | NEW | Frame-by-frame export orchestrator |
| `lib/shortcuts.ts` | NEW | Global keyboard shortcut registry |
| `lib/historyHelper.ts` | NEW | withHistory() wrapper for undoable actions |
| `lib/fx/presets.ts` | NEW | FX preset definitions |
| `lib/fx/grain.ts` | NEW | Film grain renderer |
| `lib/fx/scratches.ts` | NEW | Dirt/scratches renderer |
| `lib/fx/lightLeak.ts` | NEW | Light leak renderer |
| `lib/fx/vignette.ts` | NEW | Vignette renderer |
| `lib/fx/colorGrade.ts` | NEW | Color grade renderer |
| `components/export/ExportDialog.tsx` | NEW | Export config UI |
| `components/export/ExportProgress.tsx` | NEW | Export progress overlay |
| `components/help/ShortcutOverlay.tsx` | NEW | Keyboard shortcuts help |

### Frontend (Modified)

| File | Change |
|------|--------|
| `types/layer.ts` | Add LayerSource, fx_params, locked, fx LayerType |
| `types/sequence.ts` | Add layers field to Sequence |
| `types/project.ts` | Add MceLayer, MceAudioRef to project format |
| `stores/layerStore.ts` | Rewrite as computed from active sequence |
| `stores/historyStore.ts` | Rewrite with full undo/redo |
| `stores/sequenceStore.ts` | Add updateSequence(), layers in createSequence() |
| `stores/projectStore.ts` | Hydrate/build audio + layers, wire audioStore markDirty |
| `stores/uiStore.ts` | Add export/help overlay state |
| `lib/ipc.ts` | Add importAudio, exportWriteFrame, exportWriteMetadata |
| `lib/playbackEngine.ts` | Audio sync on start/stop |
| `lib/autoSave.ts` | Watch audioStore signals |
| `lib/frameMap.ts` | No changes (layers don't affect frame count) |
| `components/Preview.tsx` | Rewrite to use PreviewRenderer canvas |
| `components/layout/EditorShell.tsx` | Register shortcuts, add export/help overlays |
| `components/layout/PropertiesPanel.tsx` | Context-sensitive layer/FX property controls |
| `components/timeline/TimelineRenderer.ts` | Add waveform + beat marker drawing |

### Rust Backend (New)

| File | Purpose |
|------|---------|
| `commands/audio.rs` | import_audio command |
| `commands/export.rs` | export_write_frame, export_write_metadata commands |
| `models/audio.rs` | AudioRef struct |

### Rust Backend (Modified)

| File | Change |
|------|--------|
| `models/project.rs` | Add MceLayer, MceAudioRef structs; update MceSequence, MceProject |
| `commands/mod.rs` | Register audio + export command modules |
| `lib.rs` | Register new commands in invoke_handler |
| `services/project_io.rs` | Handle v1 -> v2 migration (add empty layers/audio) |

### New npm Dependencies

| Package | Purpose | Confidence |
|---------|---------|------------|
| `web-audio-beat-detector` | BPM detection from AudioBuffer | MEDIUM (verified on npm, 2024 release) |

---

## Suggested Build Order

Based on dependency analysis:

### Phase 1: Bug Fixes + Layer Foundation
**Rationale:** Fix v1.0 data bleed bugs first (store reset, auto-save cleanup). Then build layer types and layerStore rewrite since everything else depends on layers.

1. Fix store reset bugs (projectStore.closeProject not resetting timeline/playback)
2. Fix stopAutoSave() never called
3. Expand Layer type with source, fx_params, locked
4. Add layers field to Sequence type
5. Rewrite layerStore as computed from active sequence
6. Add updateSequence() to sequenceStore
7. Update MceProject format (version 2) with MceLayer
8. Update hydration/build in projectStore

### Phase 2: Preview Compositing
**Rationale:** Users need to see layers composited. This is the visual proof that the layer system works.

1. Build PreviewRenderer (Canvas 2D compositing engine)
2. Rewrite Preview component to use canvas instead of img tag
3. Wire PreviewRenderer to layerStore.layers computed signal
4. Add basic layer UI (add/remove/reorder in LeftPanel, visibility toggle)

### Phase 3: FX Effects
**Rationale:** FX are special layers -- they require the layer system from Phase 1 and the preview renderer from Phase 2.

1. Build FX preset system (presets.ts)
2. Implement grain, vignette, color grade renderers
3. Implement scratches, light leak renderers
4. Add FX layer creation UI
5. Properties panel: FX parameter sliders

### Phase 4: Properties Panel + Transforms
**Rationale:** Now that layers and FX exist, users need to control them.

1. Context-sensitive Properties panel (layer type detection)
2. Layer transform controls (position, scale, rotation, crop)
3. Opacity slider + blend mode dropdown
4. FX parameter controls

### Phase 5: Undo/Redo
**Rationale:** By this point there are many mutation points. Undo/redo wraps them all.

1. Implement historyStore with push/undo/redo
2. Build withHistory() helper
3. Wrap all store mutations (sequence, layer, image, audio)
4. Verify undo/redo across all operations

### Phase 6: Audio + Beat Sync
**Rationale:** Audio is independent of layers/FX. Can be built in parallel with Phases 3-5 but listed here because it's lower priority.

1. Build audioStore
2. Implement audio import (Rust copy + frontend decode)
3. Build AudioEngine (playback + waveform extraction)
4. Wire audio playback to PlaybackEngine start/stop
5. Draw waveform in TimelineRenderer
6. Implement beat detection (web-audio-beat-detector)
7. Draw beat markers on timeline
8. Beat snap mode for key photo arrangement

### Phase 7: Export
**Rationale:** Export requires all rendering to work (layers, FX, compositing). It's the final step before the app is production-ready.

1. Build exportStore
2. Implement export_write_frame Rust command
3. Build exportEngine (frame loop + canvas-to-PNG + IPC)
4. Build ExportDialog and ExportProgress UI
5. Audio metadata export

### Phase 8: Keyboard Shortcuts + Polish
**Rationale:** Shortcuts are a UX refinement layer. The app must be functionally complete first.

1. Build shortcuts.ts module
2. Register shortcuts in EditorShell
3. Build ShortcutOverlay help component
4. JKL transport controls
5. Final integration testing

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Building Motion Canvas Scene Graph for Preview

**What people do:** Try to programmatically construct a Motion Canvas scene with Img/Rect/Video nodes for each layer, updating the scene on every signal change.
**Why it's wrong:** Motion Canvas scenes use generator functions (`function*`) designed for animation timelines, not for reactive state-driven rendering. Bridging Preact Signals to generator yields is architecturally mismatched and fragile. The MC player also has its own internal render loop that conflicts with frame-by-frame control.
**Do this instead:** Use a plain Canvas 2D rendering approach for the preview. Canvas 2D's `globalCompositeOperation` supports all needed blend modes natively. Reserve Motion Canvas only if custom WebGL shaders are needed later (v3.0+).

### Anti-Pattern 2: Full State Snapshots for Undo

**What people do:** `JSON.stringify()` the entire project state on every edit, push to undo stack.
**Why it's wrong:** A project with 50 imported images, 5 sequences, and 20 layers produces a ~50KB+ JSON string per snapshot. At 100 undo levels, that's 5MB of memory just for undo. Worse, restoring a snapshot requires re-hydrating all stores, which triggers cascading re-renders.
**Do this instead:** Command pattern with before/after closures. Each HistoryEntry captures only the delta. Undo/redo replay the specific mutation, not the entire state.

### Anti-Pattern 3: Audio Decode in Rust with Symphonia

**What people do:** Add symphonia to Cargo.toml, decode audio in Rust, send waveform data over IPC.
**Why it's wrong:** Adds a heavy dependency to the Rust binary (~2MB). The Web Audio API already decodes all major formats natively. Sending large Float32Array waveform data over JSON IPC is inefficient. And you still need Web Audio on the frontend for playback.
**Do this instead:** Use Rust only for file copy (import_audio). Do all decoding, waveform extraction, and beat detection in the frontend via Web Audio API. This keeps the Rust backend lean.

### Anti-Pattern 4: Global Layer Stack (Not Per-Sequence)

**What people do:** Store layers in a flat global array, like the current stub layerStore.
**Why it's wrong:** Each sequence is an independent composition with its own resolution, FPS, and visual content. A "Film Grain" layer on Sequence A should not appear on Sequence B. Global layers force awkward "this layer applies to all sequences" semantics that don't match any professional editing tool.
**Do this instead:** Layers are per-sequence. layerStore becomes a computed view into the active sequence's layers. Switching sequences automatically shows that sequence's layer stack.

### Anti-Pattern 5: Export Via Tauri Events Instead of Invoke

**What people do:** Use Tauri events for streaming frame data to Rust during export.
**Why it's wrong:** Events are fire-and-forget with no backpressure. If Rust's disk I/O is slower than the frontend's rendering, frames pile up in memory. There's no error propagation path either.
**Do this instead:** Use `invoke()` for each frame write. This naturally provides backpressure (the next frame isn't rendered until Rust confirms the previous was written) and error propagation. Export is not time-critical -- it runs at I/O speed, not real-time.

---

## Sources

- Motion Canvas Node API (`@efxlab/motion-canvas-2d/lib/components/Node.d.ts`) -- HIGH confidence (direct type definition inspection)
  - Confirmed: `compositeOperation`, `opacity`, `filters`, `cache`, `shaders` properties on Node
  - Confirmed: filters support `invert`, `sepia`, `grayscale`, `brightness`, `contrast`, `saturate`, `hue`, `blur`
  - Confirmed: experimental shader support with custom GLSL fragment shaders
- Motion Canvas Img API (`@efxlab/motion-canvas-2d/lib/components/Img.d.ts`) -- HIGH confidence
  - Confirmed: `src`, `alpha`, `smoothing` properties; extends Rect
- [MDN: CanvasRenderingContext2D globalCompositeOperation](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation) -- HIGH confidence
  - Confirmed: `screen`, `multiply`, `overlay`, `lighter` (= add) blend modes supported
- [web-audio-beat-detector on npm](https://www.npmjs.com/package/web-audio-beat-detector) -- MEDIUM confidence
  - `analyze()` and `guess()` functions, returns BPM and beat offset
  - Works with AudioBuffer from Web Audio API
- [MDN: Web Audio API Visualizations](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API) -- HIGH confidence
  - AnalyserNode for waveform extraction, AudioContext.decodeAudioData for decoding
- [Symphonia Rust audio library](https://github.com/pdeljanov/Symphonia) -- MEDIUM confidence (researched but NOT recommended)
- [Motion Canvas Filters & Effects docs](https://motioncanvas.io/docs/filters-and-effects/) -- MEDIUM confidence (site unreachable during research; info from cached type definitions)
- [Motion Canvas Shaders docs](https://motioncanvas.io/docs/shaders/) -- MEDIUM confidence (same caveat; ShaderConfig.d.ts confirms API shape)
- Existing codebase analysis -- HIGH confidence (direct file reading of all stores, types, components, Rust backend)

---
*Architecture research for: EFX-Motion Editor v2.0 feature integration*
*Researched: 2026-03-03*
