# Stack Research

**Domain:** Desktop stop-motion cinematic editor (macOS) -- v0.3.0 audio, beat sync, motion paths
**Researched:** 2026-03-21
**Confidence:** HIGH

## Scope

This research covers ONLY the stack additions needed for v0.3.0 features:
1. Audio import, waveform visualization, synced playback, fade in/out
2. BPM detection and beat sync (beat markers, snap modes, auto-arrange)
3. Audio muxing in video export (replacing `-an` flag)
4. Canvas motion path visualization (After Effects-style keyframe path editing)
5. Sidebar enhancements (scroll, collapse, solo) -- no new stack needed

The existing stack (Tauri 2.0, Preact, Preact Signals, Motion Canvas, Vite 5, Tailwind CSS v4, pnpm, tinykeys, SortableJS, stackblur-canvas) is validated and unchanged.

## Recommended Stack Additions

### Audio Decoding & Playback -- Web Audio API (Built-in, No Dependencies)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Web Audio API | Browser built-in | Audio decoding, playback, waveform data extraction | Zero-dependency, hardware-accelerated, sample-accurate timing. macOS WebKit (Tauri's WebView) has full support. Already used implicitly via the rAF playback architecture. |

**Why Web Audio API over HTMLAudioElement alone:**
- `AudioContext.decodeAudioData()` decodes audio files (WAV, MP3, AAC, FLAC) into `AudioBuffer` -- gives direct access to PCM float32 samples for waveform rendering and BPM analysis.
- `AudioBufferSourceNode` allows sample-accurate start/stop/seek, which the existing `PlaybackEngine` rAF tick loop can synchronize against.
- `GainNode` provides fade in/out with `linearRampToValueAtTime()` / `exponentialRampToValueAtTime()` -- no manual volume curves needed.
- `AnalyserNode` is NOT needed here (that's for real-time frequency visualization). Pre-computed waveform peaks from the decoded AudioBuffer are what the timeline canvas needs.

**Integration point:** The existing `PlaybackEngine` uses `performance.now()` delta accumulation. Audio playback will be driven by a `AudioBufferSourceNode` started at the correct offset when playback begins, and stopped when playback stops. The rAF tick loop remains the frame clock; audio follows. This is the standard pattern for frame-accurate audio-visual sync in canvas-based editors.

**CSP note:** The existing `tauri.conf.json` CSP already includes `media-src 'self' asset: http://asset.localhost efxasset:` which covers local audio file access.

### BPM Detection -- web-audio-beat-detector

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| web-audio-beat-detector | ^8.2.27 | Offline BPM detection from AudioBuffer | Pure Web Audio API, TypeScript types included, returns both BPM and first-beat offset. Maintained (active releases through 2026). Offline analysis -- no microphone access needed. |

**Why this over alternatives:**

| Considered | Verdict | Why Not |
|------------|---------|---------|
| **web-audio-beat-detector** | **USE THIS** | Offline analysis from AudioBuffer, returns `{ bpm, offset, tempo }`. The `offset` (first beat position in seconds) is exactly what's needed to compute beat marker frame positions. ~40% TypeScript, well-typed API. |
| realtime-bpm-analyzer v5 | Skip | Designed for real-time streaming analysis (microphone, live playback). Overkill for analyzing a loaded audio file. Larger API surface, dependency-free but bigger codebase for a simpler need. |
| BeatDetect.js | Skip | Less maintained, no TypeScript types, fewer downloads. Optimized for EDM which narrows accuracy range. |
| Custom implementation (Joe Sullivan algorithm) | Skip | web-audio-beat-detector already implements this exact algorithm. No reason to rewrite. |

**API usage pattern for beat sync:**
```typescript
import { guess } from 'web-audio-beat-detector';

// audioBuffer comes from AudioContext.decodeAudioData()
const { bpm, offset, tempo } = await guess(audioBuffer, {
  minTempo: 60,   // expand range for slow music
  maxTempo: 200,  // expand range for fast music
});

// Convert to beat frame positions:
const beatIntervalSec = 60 / bpm;
const fps = projectStore.fps.peek();
const beats: number[] = [];
let t = offset;
while (t < audioBuffer.duration) {
  beats.push(Math.round(t * fps)); // frame index of each beat
  t += beatIntervalSec;
}
```

**Confidence note:** The library's accuracy depends on the source material. Clean rhythmic tracks (pop, electronic, hip-hop) yield reliable results. Ambient/classical/arrhythmic tracks may produce inaccurate BPM. The UI should allow manual BPM override and beat offset adjustment. This is standard practice in all beat-sync tools (Ableton, Premiere Pro, DaVinci Resolve).

### Audio in Video Export -- FFmpeg Audio Muxing (Existing Infrastructure)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| FFmpeg (already provisioned) | Existing | Mux audio track into video export | Already downloaded and cached at `~/.config/efx-motion/bin/ffmpeg`. The current `encode_video()` Rust function uses `-an` (no audio). Replacing `-an` with `-i <audio_path> -c:a aac` adds the audio track. Zero new dependencies. |

**Required changes to `services/ffmpeg.rs`:**

The `encode_video` function signature needs an optional `audio_path: Option<&str>` parameter. When provided:
- Remove `-an` flag
- Add `-i <audio_path>` as a second input
- Add `-c:a aac -b:a 256k` for AAC encoding (universal compatibility)
- Add `-shortest` to trim output to the shorter of video/audio duration
- For ProRes (.mov), use `-c:a pcm_s16le` instead of AAC (ProRes workflows expect uncompressed audio)

**FFmpeg command pattern:**
```
# Without audio (current):
ffmpeg -y -framerate 24 -i "dir/%04d.png" -c:v libx264 -crf 18 -an output.mp4

# With audio (new):
ffmpeg -y -framerate 24 -i "dir/%04d.png" -i "audio.wav" -c:v libx264 -crf 18 -c:a aac -b:a 256k -shortest output.mp4

# ProRes with audio:
ffmpeg -y -framerate 24 -i "dir/%04d.png" -i "audio.wav" -c:v prores_ks -profile:v 3 -c:a pcm_s16le -shortest output.mov
```

**Audio offset handling:** If the audio track has a timeline offset (doesn't start at frame 0), use `-itsoffset <seconds>` before the audio input. This is critical for maintaining audio-video sync in export.

### Waveform Rendering -- Custom Canvas 2D (No Library)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Custom waveform renderer | N/A (built in-house) | Render audio waveform peaks in the timeline canvas | The timeline is already a fully custom Canvas 2D renderer (`TimelineRenderer`). Adding wavesurfer.js would introduce a Shadow DOM widget that cannot integrate with the existing canvas. Waveform data extraction is ~30 lines of code. |

**Why NOT wavesurfer.js:**
- wavesurfer.js v7 renders into a **Shadow DOM tree** with its own canvas, scroll, and playback controller. It's designed as a standalone widget.
- The project's timeline is a single Canvas 2D element with custom hit-testing, zoom, scroll, and interaction layers (`TimelineRenderer` + `TimelineInteraction`).
- Embedding wavesurfer.js would mean TWO separate rendering pipelines that need synchronization -- a maintenance and UX nightmare.
- What's actually needed is just the **peak data** (min/max amplitude per time bucket), which is trivial to extract from a decoded `AudioBuffer`.

**Waveform peak extraction pattern (zero dependencies):**
```typescript
function extractPeaks(audioBuffer: AudioBuffer, buckets: number): Float32Array {
  const channel = audioBuffer.getChannelData(0); // mono or left channel
  const samplesPerBucket = Math.floor(channel.length / buckets);
  const peaks = new Float32Array(buckets);
  for (let i = 0; i < buckets; i++) {
    let max = 0;
    const start = i * samplesPerBucket;
    const end = Math.min(start + samplesPerBucket, channel.length);
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channel[j]);
      if (abs > max) max = abs;
    }
    peaks[i] = max;
  }
  return peaks;
}
```

This produces a `Float32Array` of normalized (0-1) amplitude values that the `TimelineRenderer` draws as vertical bars or filled waveform shapes per audio track. Re-compute peaks when zoom level changes (different bucket count per visible time range).

### Canvas Motion Paths -- Canvas 2D bezierCurveTo (Built-in)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Canvas 2D Path API | Browser built-in | Draw motion path curves between keyframe positions | `CanvasRenderingContext2D.bezierCurveTo()` is the standard API for cubic Bezier curves. The existing `keyframeEngine.ts` already interpolates `x, y` positions between keyframes. Motion path visualization is a Canvas 2D overlay that draws the interpolated path. |

**Why no library needed:**
- The `KeyframeValues` type already has `x, y, scaleX, scaleY, rotation` -- all the transform data needed.
- Drawing an After Effects-style motion path means: iterate keyframe pairs, compute Bezier control points from the easing curves, draw the path with `moveTo()` + `bezierCurveTo()`, then draw keyframe diamonds at each keyframe position.
- The existing `PreviewRenderer` renders on a canvas with known `canvasStore` pan/zoom transforms. The motion path overlay goes on the same canvas or a transparent overlay canvas (depending on whether motion paths should persist during playback).

**Motion path rendering pattern:**
```typescript
// For each keyframe pair (prev, next) on the selected layer:
ctx.beginPath();
ctx.moveTo(prev.values.x, prev.values.y);

// Control points derived from easing type:
// - linear: straight line (no bezierCurveTo, just lineTo)
// - ease-in: control points bias toward start
// - ease-out: control points bias toward end
// - ease-in-out: S-curve control points
const cp1x = lerp(prev.values.x, next.values.x, 0.33);
const cp1y = prev.values.y; // tangent based on easing
const cp2x = lerp(prev.values.x, next.values.x, 0.67);
const cp2y = next.values.y;
ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, next.values.x, next.values.y);
ctx.strokeStyle = '#4A9EFF';
ctx.lineWidth = 1.5;
ctx.stroke();

// Draw keyframe diamonds at each position
for (const kf of keyframes) {
  drawDiamond(ctx, kf.values.x, kf.values.y, 6);
}
```

**Interaction:** Dragging a keyframe diamond on the canvas updates `x, y` in the keyframe store, which triggers re-render of both the motion path and the preview. This uses the existing `canvasStore` pointer-to-world coordinate transforms already implemented for canvas transform handles.

## Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| web-audio-beat-detector | ^8.2.27 | BPM detection + first-beat offset | Audio import flow: after decoding, run `guess()` to populate beat markers |

That is the ONLY new npm dependency. Everything else is built-in browser APIs or existing infrastructure.

## Installation

```bash
# Single new dependency
pnpm add web-audio-beat-detector
```

No new Rust crate dependencies. No new Vite plugins. No new Tauri plugins.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Web Audio API (built-in) | Howler.js | Never in this context. Howler is an abstraction over Web Audio API / HTMLAudioElement for cross-browser compat. Tauri uses macOS WebKit which has full Web Audio support. Howler adds ~10KB for zero benefit. |
| Custom waveform peaks | wavesurfer.js v7.11.0 | Only if building a standalone audio editor widget. Not suitable for integration into an existing Canvas 2D timeline. Shadow DOM rendering conflicts with custom canvas pipeline. |
| Custom waveform peaks | peaks.js (BBC) | Only if you need segment editing with pre-computed server-side waveforms. Overkill for a single-track waveform display in a timeline. Requires Konva.js as a dependency. |
| web-audio-beat-detector | realtime-bpm-analyzer v5 | Only if you need real-time BPM analysis from a live microphone stream. Not needed for analyzing imported audio files. |
| web-audio-beat-detector | Essentia.js (music analysis) | Only if you need advanced music information retrieval (key detection, chord analysis, onset detection). Massive WASM bundle (~2MB). BPM detection alone doesn't justify it. |
| Canvas 2D bezierCurveTo | Paper.js / Fabric.js | Only if you need a full vector graphics editor with object model. Adds 200KB+ for drawing a few path curves. The project already has a working Canvas 2D pipeline with hit-testing. |
| FFmpeg audio mux | Rust audio crate (rodio/symphonia) | Only if you need Rust-side audio decoding/analysis. Not needed -- Web Audio API handles decoding, and FFmpeg handles export muxing. Adding audio crates to Rust would duplicate capability. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| wavesurfer.js | Shadow DOM widget conflicts with custom Canvas 2D timeline. Adds ~30KB+ for rendering we don't want. Would require synchronizing two separate rendering systems. | Extract peaks from AudioBuffer, render in existing TimelineRenderer |
| Howler.js | Unnecessary abstraction. macOS WebKit has complete Web Audio API support. Adds complexity without solving any actual problem. | Web Audio API directly |
| Tone.js | Full synthesis/music framework (~150KB). We need playback and analysis, not synthesis. | Web Audio API + web-audio-beat-detector |
| peaks.js | Depends on Konva.js for canvas rendering. Designed for server-side waveform data workflows (BBC's use case). Cannot render into existing Canvas 2D timeline. | Custom waveform peak extraction |
| Essentia.js | 2MB WASM bundle for music information retrieval. BPM detection is the only needed feature, and web-audio-beat-detector handles that in ~20KB. | web-audio-beat-detector |
| Any Rust audio crate for decoding | Web Audio API already decodes all common formats. Adding symphonia/rodio to Cargo.toml would duplicate browser-native capability and require IPC bridges for audio data. | Web Audio API decodeAudioData |
| react-wavesurfer or similar React wrappers | Project uses Preact, not React. These wrappers are for React + wavesurfer.js, which is already excluded. | Custom implementation |

## Architecture Integration Points

### Audio Store (new signal store)

A new `audioStore.ts` joins the existing 12 stores. It holds:
- `audioBuffer: Signal<AudioBuffer | null>` -- decoded audio data
- `audioPeaks: Signal<Float32Array | null>` -- pre-computed waveform peaks
- `bpm: Signal<number | null>` -- detected BPM
- `beatOffset: Signal<number>` -- first beat offset in seconds
- `beatFrames: Computed<number[]>` -- derived frame positions for beat markers
- `audioOffset: Signal<number>` -- timeline frame offset where audio starts
- `fadeIn: Signal<number>` -- fade-in duration in seconds
- `fadeOut: Signal<number>` -- fade-out duration in seconds
- `volume: Signal<number>` -- 0-1 volume level
- `audioFilePath: Signal<string | null>` -- original file path for export

### PlaybackEngine Changes

The `PlaybackEngine.start()` method creates an `AudioBufferSourceNode`, applies gain/fade, and starts it at the correct offset based on `timelineStore.currentFrame`. The `stop()` method disconnects the source node. Seeking during playback requires stopping and restarting the audio source at the new position (AudioBufferSourceNode is one-shot by design).

### FFmpeg Export Changes

The `encode_video` Rust function gains an `audio_path: Option<String>` parameter. When `Some(path)`, it replaces `-an` with `-i <path> -c:a aac -b:a 256k -shortest`. The TypeScript `exportEncodeVideo` IPC function passes the audio file path from `audioStore.audioFilePath`.

### Timeline Renderer Changes

The `TimelineRenderer` gains a new track type for the audio waveform. It reads `audioStore.audioPeaks` and renders amplitude bars at the correct horizontal position based on zoom/scroll. Beat markers are vertical lines drawn at frame positions from `audioStore.beatFrames`.

### Canvas Motion Path Overlay

A new rendering pass in the Preview component draws the motion path when a layer with keyframes is selected and the canvas is not in playback mode. Uses `canvasStore` transforms to map keyframe `x, y` world coordinates to canvas pixel coordinates.

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| web-audio-beat-detector@^8.2.27 | Web Audio API (AudioBuffer) | Input is standard AudioBuffer from decodeAudioData. No framework coupling. |
| Web Audio API | macOS WebKit (Safari 17+) | Tauri 2.0 on macOS uses WebKit. Full Web Audio API support confirmed. AudioContext, decodeAudioData, AudioBufferSourceNode, GainNode all available. |
| FFmpeg (cached binary) | Any audio format | The existing FFmpeg binary includes AAC, PCM encoders. `-c:a aac` for MP4/H.264/AV1, `-c:a pcm_s16le` for ProRes/MOV. |

## Project Format Impact

The `.mce` project format (currently v7) needs a version bump to v8 to store:
- Audio file reference (path relative to project directory)
- Audio offset (frame position on timeline)
- Volume, fade in/out settings
- BPM and beat offset (cached to avoid re-analysis on project load)
- Beat snap mode preference
- Per-layer motion path visibility flag (optional, could be UI-only state)

Backward compatibility: v7 projects load without audio data. The migration is additive (new optional fields).

## Sources

- [MDN Web Audio API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) -- AudioContext, decodeAudioData, AudioBufferSourceNode APIs (HIGH confidence)
- [MDN Waveform Visualization](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API) -- AnalyserNode and waveform rendering patterns (HIGH confidence)
- [web-audio-beat-detector GitHub](https://github.com/chrisguttandin/web-audio-beat-detector) -- API: `analyze(audioBuffer)` returns Promise<number>, `guess(audioBuffer)` returns Promise<{bpm, offset, tempo}> (HIGH confidence)
- [web-audio-beat-detector npm](https://www.npmjs.com/package/web-audio-beat-detector) -- v8.2.27, TypeScript types included (HIGH confidence)
- [MDN bezierCurveTo](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/bezierCurveTo) -- Canvas 2D cubic Bezier curve API (HIGH confidence)
- [BBC waveform-data.js](https://github.com/bbc/waveform-data.js) -- Reference for waveform peak extraction patterns (MEDIUM confidence, used as pattern reference only)
- [FFmpeg documentation](https://ffmpeg.org/ffmpeg.html) -- Audio muxing with `-i`, `-c:a`, `-shortest` flags (HIGH confidence)
- [Tauri + Web Audio example](https://slavbasharov.com/blog/building-music-player-tauri-svelte) -- Confirms Web Audio API works in Tauri WebView (MEDIUM confidence)
- [Hans Garon: Sync Animation to Audio](https://hansgaron.com/articles/web_audio/animation_sync_with_audio/part_one/) -- Pattern for rAF + AudioBufferSourceNode synchronization (MEDIUM confidence)
- [Mux: Merge audio and video with FFmpeg](https://www.mux.com/articles/merge-audio-and-video-files-with-ffmpeg) -- FFmpeg muxing command patterns (HIGH confidence)

---
*Stack research for: EFX Motion Editor v0.3.0 -- Audio, Beat Sync, Motion Paths*
*Researched: 2026-03-21*
