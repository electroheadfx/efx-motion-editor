# Stack Research

**Domain:** Desktop stop-motion cinematic video editor (macOS) -- v2.0 additions
**Researched:** 2026-03-03
**Confidence:** HIGH

## Context

This is a SUBSEQUENT MILESTONE stack research. The following stack is already validated and shipping in v1.0:

- Tauri 2.0 (Rust) + Preact 10.28 + @preact/signals 2.8 + Vite 5.4.21 + Tailwind CSS v4
- @efxlab/motion-canvas-* v4.0.0 (WebGL/Canvas rendering)
- Canvas 2D timeline renderer with virtualization
- Rust image pipeline (image crate 0.25) with thumbnails and LRU pool
- SortableJS for drag-and-drop
- 6 reactive signal stores + PlaybackEngine with rAF delta accumulation
- pnpm 10.27 package manager

This document covers ONLY new dependencies needed for v2.0 features: layer compositing, FX effects, audio/waveform/beat detection, PNG export, undo/redo, and keyboard shortcuts.

## Recommended Stack Additions

### FX Effects (Grain, Scratches, Light Leaks, Vignette, Color Grade)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Custom GLSL shaders | N/A (project code) | Film grain, scratches, light leaks, vignette, color grade effects | @efxlab/motion-canvas-2d v4.0.0 already supports the `shaders` property on all nodes. VERIFIED: `ShaderConfig` interface exists in installed packages with `fragment`, `uniforms`, `setup`, `teardown`. Custom GLSL is the correct approach -- NO external shader library needed |
| @efxlab/motion-canvas-core/shaders/common.glsl | 4.0.0 (installed) | Built-in shader uniforms (time, resolution, sourceTexture, etc.) | Already available. Provides `time`, `deltaTime`, `framerate`, `frame`, `resolution`, `sourceTexture`, `destinationTexture`, `sourceUV`, `screenUV` |

**Key finding:** The `@efxlab/motion-canvas-2d` v4.0.0 already installed has full shader support. The `shaders` property on any Node accepts GLSL fragment shaders with custom uniforms. No new dependencies needed for FX effects -- only custom GLSL code.

**Shader integration pattern (verified in installed packages):**
```tsx
// Fragment shader: grain.glsl
#version 300 es
precision highp float;
#include "@efxlab/motion-canvas-core/shaders/common.glsl"

uniform float intensity;
uniform float seed;

void main() {
  vec4 color = texture(sourceTexture, sourceUV);
  float noise = fract(sin(dot(sourceUV + seed, vec2(12.9898, 78.233))) * 43758.5453);
  outColor = vec4(mix(color.rgb, vec3(noise), intensity), color.a);
}
```
```tsx
// Usage in Motion Canvas scene
<Rect shaders={{
  fragment: grainShader,
  uniforms: {
    intensity: () => grainIntensity.peek(),
    seed: () => Math.random(),
  },
}} />
```

**Confidence: HIGH** -- Verified against installed `@efxlab/motion-canvas-2d/lib/partials/ShaderConfig.d.ts`. The shader API is marked `@experimental` but is fully implemented with WebGL2.

### Layer Compositing

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| No new dependencies | N/A | Blend modes, opacity, transforms | Motion Canvas Rect/Img nodes already support `compositeOperation`, `opacity`, and transforms. Preact layerStore already has the data model. This is pure application code |

**Key finding:** The existing `previewScene.tsx` currently renders a single `Img` inside a `Rect`. For layer compositing, this scene needs to be extended to render multiple layers with blend modes. Motion Canvas 2D nodes support `compositeOperation` which maps to Canvas2D `globalCompositeOperation` (screen, multiply, overlay, etc.). No new libraries needed.

**Confidence: HIGH** -- Canvas2D `globalCompositeOperation` is a web standard; Motion Canvas wraps it.

### Audio Import, Waveform, Beat Detection

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| wavesurfer.js | ^7.12.1 | Audio waveform visualization in timeline | Framework-agnostic (no React required), TypeScript-native, Shadow DOM isolation, zero npm dependencies. Mounts to any DOM element via `WaveSurfer.create({ container })`. Works with Preact by targeting a ref'd div |
| web-audio-beat-detector | ^8.2.35 | BPM detection and beat offset extraction | TypeScript types included, uses Web Audio API, returns `{ bpm, offset, tempo }` via `guess()`. More mature than realtime-bpm-analyzer for offline analysis (which is our use case -- we analyze imported files, not live audio) |
| Web Audio API (built-in) | N/A | Audio decoding, playback sync, waveform data | Browser-native, no dependency. `AudioContext.decodeAudioData()` for decoding, `AudioContext.currentTime` for frame-accurate sync with PlaybackEngine |

**Architecture decision: Web Audio API for audio, NOT Rust symphonia.**

The v1.0 research recommended `symphonia` (Rust) for audio decoding, but this is WRONG for our use case:

1. Audio needs to PLAY in the browser during preview -- Web Audio API is the natural fit
2. Waveform data is needed in the frontend for visualization -- decoding in Rust then IPC-ing waveform peaks adds unnecessary complexity
3. `AudioContext.decodeAudioData()` handles MP3, WAV, AAC, OGG natively in the browser
4. wavesurfer.js handles its own audio loading and decoding internally
5. Beat detection via `web-audio-beat-detector` operates on `AudioBuffer` from Web Audio API

**Rust backend audio role:** Only needed for audio metadata export (writing `audio-metadata.json` alongside PNG export). The existing `serde_json` handles this.

**Changed from v1.0 research:** Removed `symphonia`, `rodio` from Rust dependencies. Added `wavesurfer.js` and `web-audio-beat-detector` to frontend.

**wavesurfer.js + Preact integration pattern:**
```tsx
import WaveSurfer from 'wavesurfer.js';
import { useRef, useEffect } from 'preact/hooks';

function AudioTrack({ audioUrl }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    wsRef.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#4a4a5a',
      progressColor: '#7c7cf0',
      url: audioUrl,
      height: 48,
    });
    return () => wsRef.current?.destroy();
  }, [audioUrl]);

  return <div ref={containerRef} />;
}
```

**Confidence: HIGH** -- wavesurfer.js v7 is framework-agnostic (verified on GitHub, TypeScript rewrite, 87% TS codebase). web-audio-beat-detector v8.2.35 released Feb 2026, actively maintained.

### PNG Sequence Export

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Canvas `toBlob()` API (built-in) | N/A | Capture composited frames as PNG binary data | 2-5x faster than `toDataURL()`, async, returns binary Blob directly without Base64 overhead |
| @tauri-apps/plugin-fs `writeFile` | ^2.4.5 (installed) | Write PNG binary data to disk | Already installed. `writeFile(path, uint8Array)` writes binary data to any scoped path |
| image crate (Rust) | 0.25 (installed) | Alternative: write PNG from raw pixel data passed via IPC | Already installed. `save_buffer()` for direct pixel-to-PNG. Fast PNG encoding via fdeflate |
| rayon | ^1.10 | Parallel PNG encoding for batch export | If export sends raw pixel data to Rust, rayon parallelizes encoding across CPU cores for 3-4x speedup on batch frames |

**Export pipeline decision: Hybrid frontend-capture + Rust-write**

Two viable approaches; recommend **Option A** for simplicity:

**Option A (Recommended): Frontend capture, Rust write**
1. Motion Canvas renders composited frame (all layers + FX shaders) to its internal canvas
2. `canvas.toBlob('image/png')` captures the composited result
3. Convert Blob to `Uint8Array` via `blob.arrayBuffer()`
4. Send to Rust via Tauri command for disk write (or use `@tauri-apps/plugin-fs` directly)
5. Repeat for each frame

**Option B: Frontend capture, Rust encode**
1. Motion Canvas renders frame
2. `ctx.getImageData()` extracts raw RGBA pixels
3. Send raw pixel buffer to Rust via IPC
4. Rust encodes to PNG via `image` crate with parallel encoding via `rayon`
5. Higher throughput but larger IPC payload per frame

**Why Option A:** Canvas `toBlob()` with PNG encoding is fast enough for our frame counts (stop-motion at 15-24fps, typically 100-500 frames). The IPC overhead of sending raw RGBA buffers (4 bytes per pixel * 1920*1080 = 8MB per frame) makes Option B slower for moderate frame counts. Option B only wins at 1000+ frames where parallel Rust encoding amortizes the IPC cost.

**Add rayon ONLY if Option B is chosen:**
```toml
# src-tauri/Cargo.toml (only if using Option B)
rayon = "1.10"
```

**Confidence: HIGH** -- `toBlob()` is a web standard, `@tauri-apps/plugin-fs` writeFile is already in use, `image` crate already installed.

### Undo/Redo System

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Custom command pattern | N/A (project code) | Undo/redo with 100+ levels covering all state changes | The existing `historyStore` skeleton (signal-based stack + pointer) is the right foundation. Implement the command pattern natively with Preact Signals -- no external library needed |

**Why NOT use `@kvndy/undo-manager`:**

Evaluated `@kvndy/undo-manager` v6.2.0 which provides `Undoable` and `Preservable` wrappers for Preact Signals. Rejected because:

1. It wraps individual signals, but our undo granularity is *operations* (add layer, move sequence, change blend mode) not individual signal value changes
2. The `Undoable` class would require replacing all 6 existing signal stores with wrapped versions -- massive refactor
3. Our existing `HistoryEntry` type with `undo: () => void` / `redo: () => void` callbacks is simpler and maps directly to the command pattern
4. We need to batch multiple signal changes into one undo entry (e.g., "add layer" changes `layers`, `selectedLayerId`, and triggers `markDirty` -- one undo, not three)

**Implementation approach (zero new dependencies):**
```typescript
// Extend existing historyStore
function pushUndo(description: string, execute: () => void, undo: () => void) {
  execute();
  const entry: HistoryEntry = { id: nanoid(), description, timestamp: Date.now(), undo, redo: execute };
  // Trim redo branch, push entry, cap at 100
  historyStore.stack.value = [...historyStore.stack.value.slice(0, historyStore.pointer.value + 1), entry].slice(-100);
  historyStore.pointer.value = historyStore.stack.value.length - 1;
}
```

**Confidence: HIGH** -- The command pattern is well-understood, the data structures already exist in `types/history.ts` and `stores/historyStore.ts`. This is application code, not a library decision.

### Keyboard Shortcuts

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| tinykeys | ^3.0.0 | Keyboard shortcut binding | 650 bytes gzipped, zero dependencies, TypeScript-native, framework-agnostic. Supports `$mod` for cross-platform Meta/Ctrl. Simpler API than hotkeys-js |

**Why tinykeys over hotkeys-js:**

| Criterion | tinykeys | hotkeys-js |
|-----------|----------|------------|
| Size | ~650B gzipped | ~2.8KB gzipped |
| TypeScript | Native (written in TS) | Types included |
| API style | Object map: `{ "Mod+Z": handler }` | String-based: `hotkeys('ctrl+z', handler)` |
| macOS $mod | Yes (`$mod` = Meta on macOS) | Yes (command/cmd) |
| Sequences | Yes (e.g., `g i` for vim-style) | Yes |
| Scope/context | Manual (bind/unbind via cleanup) | Built-in scopes |
| Dependencies | 0 | 0 |

tinykeys is smaller and its object-map API is cleaner for our use case:

```typescript
import tinykeys from 'tinykeys';

const unsubscribe = tinykeys(window, {
  '$mod+KeyZ': () => historyStore.undo(),
  '$mod+Shift+KeyZ': () => historyStore.redo(),
  'Space': () => playbackEngine.toggle(),
  'ArrowRight': () => playbackEngine.stepForward(),
  'ArrowLeft': () => playbackEngine.stepBackward(),
  '$mod+KeyS': (e) => { e.preventDefault(); projectStore.save(); },
  '$mod+KeyN': (e) => { e.preventDefault(); projectStore.createNew(); },
  'KeyJ': () => playbackEngine.start(), // JKL shuttle
  'KeyK': () => playbackEngine.stop(),
  'KeyL': () => playbackEngine.start(), // forward
});
```

**Confidence: HIGH** -- tinykeys v3.0.0 is stable (npm: 44 dependents), TypeScript-native, 650B. Verified macOS `$mod` support.

## Summary of New Dependencies

### Frontend (pnpm add)

```bash
# Audio visualization and beat detection
pnpm add wavesurfer.js web-audio-beat-detector

# Keyboard shortcuts
pnpm add tinykeys
```

**Total new frontend dependencies: 3 packages**

### Rust (Cargo.toml additions)

```toml
# No new Rust crates required for v2.0 core features
# rayon = "1.10" -- only if choosing Option B export pipeline (see PNG Export section)
```

**Total new Rust dependencies: 0 (or 1 if rayon for export)**

### Already Installed (no changes needed)

| Package | Used For |
|---------|----------|
| @efxlab/motion-canvas-2d | Layer compositing, shader FX effects |
| @efxlab/motion-canvas-core | Shader common.glsl, rendering pipeline |
| @preact/signals | Undo/redo state management (historyStore) |
| @tauri-apps/plugin-fs | PNG export file writing |
| @tauri-apps/plugin-dialog | Export folder selection |
| image crate (Rust) | PNG encoding if using Option B export |

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| symphonia / rodio (Rust audio) | Audio decoding and playback happens in browser for preview. Rust-side audio adds IPC complexity with no benefit | Web Audio API (browser-native) + wavesurfer.js |
| @kvndy/undo-manager | Wraps individual signals, but undo granularity is operations. Would require replacing all 6 stores | Custom command pattern on existing historyStore |
| hotkeys-js | 4x larger than tinykeys (2.8KB vs 650B) with no additional features we need | tinykeys |
| peaks.js / waveform-data.js (BBC) | Heavier than wavesurfer.js, requires server-side waveform generation, overkill for our use case | wavesurfer.js (self-contained, handles its own decoding) |
| realtime-bpm-analyzer | Designed for real-time streaming BPM detection. We analyze imported files offline. web-audio-beat-detector is simpler and more reliable for offline analysis | web-audio-beat-detector |
| canvas2d shader libraries (glslCanvas, etc.) | Motion Canvas already has WebGL shader support built in. Adding another WebGL context would conflict | @efxlab/motion-canvas-2d shaders property |
| OffscreenCanvas for export | OffscreenCanvas runs in Worker but has 75-90% penalty on readback (getImageData/toBlob). Main-thread canvas.toBlob() is actually faster for our frame-by-frame export | Standard canvas.toBlob() on Motion Canvas player canvas |
| Tone.js / Howler.js | Full audio synthesis libraries. We only need decode + playback + timing, which Web Audio API provides natively | Web Audio API (AudioContext) |
| FFmpeg sidecar | PNG export does not need video encoding (out of scope). Audio decoding handled by browser. No reason for FFmpeg | Browser-native APIs |

## Integration Points

### How New Libraries Connect to Existing Architecture

```
PlaybackEngine (existing)
  |
  +-- AudioContext.currentTime --> master clock for audio/video sync
  |     |
  |     +-- wavesurfer.js.seekTo() --> sync waveform position
  |     +-- web-audio-beat-detector --> one-time analysis on import
  |
  +-- Motion Canvas Player (existing)
        |
        +-- previewScene.tsx --> extended with multi-layer rendering
        |     |
        |     +-- Img nodes per layer (with compositeOperation for blend modes)
        |     +-- Rect nodes with shaders property (for FX effects)
        |
        +-- canvas.toBlob() --> PNG export capture point

historyStore (existing skeleton)
  |
  +-- pushUndo() wraps all store mutations
  +-- undo()/redo() traverse stack

tinykeys (new)
  |
  +-- binds to window, calls playbackEngine/historyStore/projectStore methods
```

### PlaybackEngine Audio Sync

The existing `PlaybackEngine` uses `performance.now()` delta accumulation. For audio sync, the architecture change is:

```typescript
// Current: performance.now() drives frame timing
// v2.0: AudioContext.currentTime becomes the master clock when audio is loaded

class PlaybackEngine {
  private audioContext: AudioContext | null = null;
  private audioSource: AudioBufferSourceNode | null = null;

  // When audio loaded, switch to AudioContext clock
  private tick = (now: number) => {
    const masterTime = this.audioContext
      ? this.audioContext.currentTime  // audio-synced
      : performance.now() / 1000;     // fallback (no audio)
    // ... frame calculation from masterTime
  };
}
```

This pattern was already anticipated in v1.0 design ("PREV-05 audio sync readiness proven").

## Version Compatibility

| New Package | Compatible With | Notes |
|-------------|-----------------|-------|
| wavesurfer.js ^7.12.1 | Preact (via DOM mount) | No framework dependency. Mount to div ref. TypeScript types included |
| wavesurfer.js ^7.12.1 | Tailwind CSS v4 | Shadow DOM isolates wavesurfer CSS. Pass colors via JS options, not CSS |
| web-audio-beat-detector ^8.2.35 | Web Audio API (browser) | Pure Web Audio API, no runtime dependencies |
| tinykeys ^3.0.0 | Preact/any framework | Framework-agnostic, binds to window/document |
| Custom GLSL shaders | @efxlab/motion-canvas-* 4.0.0 | Verified: `ShaderConfig` interface exists, `#include "@efxlab/motion-canvas-core/shaders/common.glsl"` path confirmed |
| rayon ^1.10 (optional) | image 0.25 (installed) | Standard Rust parallelism crate, no conflicts |

## Installation

```bash
# New v2.0 frontend dependencies
pnpm add wavesurfer.js web-audio-beat-detector tinykeys
```

```toml
# src-tauri/Cargo.toml -- no changes required
# Existing dependencies handle all v2.0 Rust-side needs
# Optional: add rayon = "1.10" if using parallel PNG export (Option B)
```

## Sources

- [@efxlab/motion-canvas-2d ShaderConfig](verified in installed node_modules) -- `lib/partials/ShaderConfig.d.ts`, HIGH confidence
- [Motion Canvas Shaders documentation](https://motioncanvas.io/docs/shaders/) -- Official docs, HIGH confidence
- [Motion Canvas shader docs on GitHub](https://github.com/motion-canvas/motion-canvas/blob/main/packages/docs/docs/advanced/shaders.mdx) -- Verified uniforms, textures, code examples, HIGH confidence
- [wavesurfer.js GitHub](https://github.com/katspaugh/wavesurfer.js) -- v7.12.1, TypeScript, zero deps, HIGH confidence
- [web-audio-beat-detector GitHub](https://github.com/chrisguttandin/web-audio-beat-detector) -- v8.2.35, Feb 2026, TypeScript, HIGH confidence
- [web-audio-beat-detector npm](https://www.npmjs.com/package/web-audio-beat-detector) -- API: analyze(), guess(), MEDIUM confidence (npm page)
- [tinykeys GitHub](https://github.com/jamiebuilds/tinykeys) -- v3.0.0, 650B, TypeScript, HIGH confidence
- [hotkeys-js npm](https://www.npmjs.com/package/hotkeys-js) -- v4.0.2, compared and rejected, MEDIUM confidence
- [@kvndy/undo-manager npm](https://www.npmjs.com/package/@kvndy/undo-manager) -- v6.2.0, evaluated and rejected, MEDIUM confidence
- [Canvas toBlob MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob) -- Web standard, HIGH confidence
- [Tauri 2.0 File System plugin](https://v2.tauri.app/plugin/file-system/) -- writeFile API, HIGH confidence
- [Rust image crate](https://crates.io/crates/image) -- v0.25.9, fdeflate PNG encoding, HIGH confidence
- [rayon crate](https://crates.io/crates/rayon) -- v1.10, parallel iterators, HIGH confidence
- [glsl-film-grain](https://github.com/mattdesl/glsl-film-grain) -- GLSL noise patterns for reference, MEDIUM confidence
- [WebGL Film Grain tutorial](https://maximmcnair.com/p/webgl-film-grain) -- Shader technique reference, MEDIUM confidence

---
*Stack research for: Desktop stop-motion cinematic video editor (macOS) -- v2.0 additions*
*Researched: 2026-03-03*
