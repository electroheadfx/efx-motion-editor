# Stack Research

**Domain:** Desktop stop-motion cinematic video editor (macOS)
**Researched:** 2026-03-02
**Confidence:** MEDIUM-HIGH

## Recommended Stack

### Core Technologies (Pre-decided)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Tauri | 2.4.x | Desktop app framework (Rust backend + webview frontend) | Lightweight (~600KB), native macOS integration, Rust performance for heavy processing, security-scoped file access |
| Preact | 10.28.x | UI rendering framework | 3KB bundle, Signals built-in, fast VDOM diffing, React-compatible API via preact/compat |
| @preact/signals | 2.8.x | Reactive state management | Fine-grained reactivity without re-renders, ideal for real-time editor state (playhead, layers, transforms) |
| @efxlab/motion-canvas-* | 4.0.0 | WebGL/Canvas rendering, preview playback, export | Custom fork handling scene rendering, 2D compositing, and PNG sequence export |
| Tailwind CSS | 4.2.x | UI styling | CSS-native config (no JS config file), 5x faster builds, cascade layers, @property support |
| Vite | 7.3.x | Build tool & dev server | Already used in React prototype, first-party Tailwind v4 plugin, HMR, Tauri integration |
| TypeScript | 5.9.x | Type safety | Already in React prototype, strict mode for editor reliability |
| pnpm | latest | Package manager | Pre-decided. Strict dependency resolution, fast installs, workspace support |

### Tauri Plugins (Rust + JS bindings)

| Plugin | npm Package | Purpose | Why |
|--------|-------------|---------|-----|
| tauri-plugin-fs | @tauri-apps/plugin-fs | File system access (read/write project files, images, audio) | Official plugin, permission-scoped security, file watching for hot-reload assets |
| tauri-plugin-dialog | @tauri-apps/plugin-dialog | Native macOS file open/save dialogs, message dialogs | Native feel, required for image import and project save/open |
| tauri-plugin-store | @tauri-apps/plugin-store | Persistent key-value store for app preferences | Recent projects list, window state, user preferences |
| tauri-plugin-shell | @tauri-apps/plugin-shell | Spawn child processes (FFmpeg sidecar) | PNG sequence export via FFmpeg, audio metadata extraction |
| @tauri-apps/api | 2.10.x | Core Tauri JS API (events, window, path) | IPC between frontend and Rust backend, window management, path resolution |

**Confidence: HIGH** -- All official Tauri plugins, well-documented at https://v2.tauri.app/plugin/

### Rust Backend Crates

| Crate | Purpose | Why |
|-------|---------|-----|
| image (image-rs) | Thumbnail generation, PNG read/write, image resizing | De facto Rust image processing crate. Handles PNG natively, fast resize with multiple filter types |
| symphonia | Audio decoding (MP3, WAV, FLAC, OGG, AAC) | Pure Rust, no C dependencies, comparable to FFmpeg performance. Decode audio for waveform extraction |
| rodio | Audio playback | Built on symphonia, simple API for preview playback from Rust side if needed |
| serde / serde_json | Project file serialization (.mce JSON format) | Standard Rust serialization, zero-copy deserialization for fast project load |
| tokio | Async runtime | Already required by Tauri 2, use for async file I/O and background processing |
| uuid | Unique identifiers for layers, sequences, effects | Standard crate for generating v4 UUIDs in Rust |

**Confidence: HIGH** -- All mature, widely-used Rust crates

### Frontend Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| wavesurfer.js | 7.12.x | Audio waveform visualization | Timeline audio track display, scrubbing, zoom. TypeScript rewrite, Shadow DOM isolation, zero dependencies |
| realtime-bpm-analyzer | latest | BPM detection from audio | Beat sync feature: auto-detect BPM, generate beat markers. Pure Web Audio API, no external deps |
| nanoid | 5.x | Lightweight unique ID generation (frontend) | Layer IDs, sequence IDs, effect instance IDs in frontend state. 130 bytes, URL-safe, crypto-secure |
| @preact/preset-vite | latest | Vite plugin for Preact | JSX transform, HMR via Prefresh, automatic react/react-dom aliasing to preact/compat |
| @tailwindcss/vite | 4.2.x | Tailwind CSS Vite plugin | First-party integration, automatic content detection, CSS-native config |
| clsx | 2.x | Conditional class name joining | Cleaner Tailwind class composition in components |

**Confidence: MEDIUM-HIGH** -- wavesurfer.js and realtime-bpm-analyzer verified via npm/GitHub; exact Preact compatibility for wavesurfer needs runtime validation

### Audio Processing Strategy

The audio pipeline splits between Rust (heavy processing) and browser (visualization/interaction):

| Task | Where | Technology | Why |
|------|-------|-----------|-----|
| Audio file decoding | Rust backend | symphonia | Native performance, supports all common formats without FFmpeg dependency |
| Waveform data extraction | Rust backend | symphonia + custom | Decode to PCM samples, downsample to peaks array, send to frontend via IPC |
| Waveform visualization | Frontend | wavesurfer.js | Rich UI: zoom, scrub, regions, timeline markers. Use with pre-computed peak data |
| BPM detection | Frontend | realtime-bpm-analyzer | Web Audio API based, runs on decoded audio buffer. Results feed beat marker generation |
| Audio playback (preview) | Frontend | Web Audio API (HTMLAudioElement) | Simpler than Rust-side playback, syncs with Motion Canvas player timeline |
| Audio metadata export | Rust backend | serde_json | Write beat markers and timing to JSON metadata file alongside PNG sequence |

**Confidence: MEDIUM** -- This architecture is sound but the exact IPC pattern for streaming waveform peaks from Rust to frontend needs prototyping

### Image Processing Strategy

| Task | Where | Technology | Why |
|------|-------|-----------|-----|
| Thumbnail generation | Rust backend | image crate | Resize imported photos to thumbnail size on import, cache to disk |
| PNG sequence export | Rust backend / Motion Canvas | @efxlab/motion-canvas-ffmpeg | Motion Canvas renders frames, writes PNG files via its built-in export pipeline |
| Image metadata (EXIF) | Rust backend | image crate or kamadak-exif | Extract dimensions, orientation from imported photos |
| Canvas compositing (preview) | Frontend | @efxlab/motion-canvas-2d | WebGL/Canvas2D rendering for real-time layer compositing, blend modes, effects |
| Blur effects (preview) | Frontend | Custom WebGL shaders | Dual Kawase blur for 60fps preview at 1080p, Gaussian for export quality |

**Confidence: HIGH** -- image crate is battle-tested; Motion Canvas handles the rendering pipeline

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| @tauri-apps/cli | Tauri CLI for dev/build/bundle | `pnpm tauri dev` for development, `pnpm tauri build` for production |
| eslint | Code quality | Preact-compatible config (no react-hooks plugin, use preact equivalents) |
| prettier | Code formatting | Consistent style across team |
| vitest | Unit/integration testing | Vite-native, fast, works with Preact |
| @preact/signals-debug | Signal debugging | Dev-only tool for inspecting signal dependency graphs |

## Installation

```bash
# Frontend core
pnpm add preact @preact/signals @tauri-apps/api

# Tauri plugins (JS bindings)
pnpm add @tauri-apps/plugin-fs @tauri-apps/plugin-dialog @tauri-apps/plugin-store @tauri-apps/plugin-shell

# Motion Canvas (rendering engine)
pnpm add @efxlab/motion-canvas-core @efxlab/motion-canvas-2d @efxlab/motion-canvas-responsive @efxlab/motion-canvas-player @efxlab/motion-canvas-ffmpeg @efxlab/motion-canvas-ui @efxlab/motion-canvas-vite-plugin

# Audio & visualization
pnpm add wavesurfer.js realtime-bpm-analyzer

# Utilities
pnpm add nanoid clsx

# Dev dependencies
pnpm add -D @preact/preset-vite @tailwindcss/vite tailwindcss typescript vite @tauri-apps/cli eslint prettier vitest @preact/signals-debug
```

```toml
# src-tauri/Cargo.toml
[dependencies]
tauri = { version = "2", features = ["macos-private-api"] }
tauri-plugin-fs = "2"
tauri-plugin-dialog = "2"
tauri-plugin-store = "2"
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
image = "0.25"
symphonia = { version = "0.5", features = ["all-codecs"] }
tokio = { version = "1", features = ["full"] }
uuid = { version = "1", features = ["v4"] }
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| wavesurfer.js 7 | Custom Canvas waveform | Only if wavesurfer.js Shadow DOM conflicts with Motion Canvas rendering or adds too much overhead |
| realtime-bpm-analyzer | web-audio-beat-detector | If you only need offline BPM detection (not real-time). web-audio-beat-detector is simpler but less feature-rich |
| symphonia (Rust) | FFmpeg sidecar for audio decode | If you need format support beyond symphonia (rare edge cases). Adds binary distribution complexity |
| image crate (Rust) | sharp (Node.js) | Never -- sharp requires Node.js runtime, incompatible with Tauri's webview architecture |
| Preact Signals | Zustand / Jotai | If team has strong React ecosystem preference. But Signals are native to Preact -- using Zustand adds unnecessary abstraction |
| nanoid | uuid (frontend) | If you need RFC 4122 compliance. nanoid is 4x smaller and sufficient for local IDs |
| Vite 7.3 | Vite 6.x | If @efxlab/motion-canvas-vite-plugin has compatibility issues with Vite 7. Test first, downgrade only if needed |
| clsx | classnames | Never meaningful difference, but clsx is smaller (239B vs 323B) |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| React | Project mandates Preact. Adding react/react-dom bloats bundle by ~40KB for zero benefit | Preact + preact/compat for library compatibility |
| Redux / MobX / Zustand | Preact Signals is the native state solution. External state libs add weight and fight Preact's reactivity model | @preact/signals with computed() and effect() |
| Electron | 100MB+ binary, Chrome runtime overhead, high memory usage | Tauri 2 (~3MB binary, native webview) |
| sharp / Jimp (frontend) | sharp needs Node.js; Jimp is slow for bulk operations. Both inappropriate for Tauri webview | image crate in Rust backend for heavy image work; Canvas API for preview rendering |
| moment.js / dayjs | No date manipulation needed in a video editor. Frame counts and timecodes are integers | Simple frame-to-timecode utility functions |
| @vitejs/plugin-react | This is the React Vite plugin, not Preact | @preact/preset-vite |
| Heavy UI libraries (Radix, shadcn, Ant Design) | Pre-decided: Tailwind + custom components. UI libs add 200-500KB, fight editor-specific UX patterns | Custom Preact components with Tailwind CSS |
| Web Workers for audio processing | Rust backend is faster and has direct filesystem access. Web Workers add IPC complexity for inferior performance | Tauri commands (Rust) for audio decode and waveform extraction |

## Stack Patterns by Variant

**If @efxlab/motion-canvas-vite-plugin conflicts with Vite 7:**
- Pin Vite to 6.x (`pnpm add -D vite@6`)
- Verify @preact/preset-vite compatibility with Vite 6
- This is the most likely compatibility issue to surface early

**If wavesurfer.js Shadow DOM conflicts with Tailwind v4 styling:**
- Use wavesurfer.js `container` option to mount inside a dedicated unstyled div
- Pass custom colors via wavesurfer options (waveColor, progressColor) rather than CSS
- Alternatively, build a lightweight custom waveform renderer using Canvas API with pre-computed peaks from Rust

**If audio preview playback needs frame-accurate sync with Motion Canvas:**
- Use Web Audio API `AudioContext` with precise scheduling (`currentTime`)
- Do NOT use HTMLAudioElement (timing drift, no sample-accurate sync)
- Coordinate via a shared signal: `playheadFrame` signal drives both Motion Canvas player and audio scheduling

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Tauri 2.4.x | Vite 7.x | Tauri CLI wraps Vite dev server; version coupling is loose |
| @preact/preset-vite | Vite 7.x | Confirm latest @preact/preset-vite supports Vite 7 (likely yes, actively maintained) |
| @efxlab/motion-canvas-vite-plugin 4.0.0 | Vite 6.x or 7.x | LOW confidence -- custom package, verify on install. Most likely friction point |
| Tailwind CSS 4.2.x | @tailwindcss/vite 4.2.x | Same version, first-party plugin. Confirmed working |
| Preact 10.28.x | @preact/signals 2.8.x | Same ecosystem, actively co-released |
| wavesurfer.js 7.12.x | Preact (via direct DOM) | No framework binding needed -- mount to DOM node, control via JS API |
| TypeScript 5.9.x | Preact 10.28.x | Preact ships its own type definitions |

**Critical compatibility note:** The @efxlab/motion-canvas-* packages are the highest-risk dependency for version conflicts. They are custom packages that may pin specific Vite plugin API versions. Validate this first during project setup.

## Sources

- [Tauri 2.0 File System Plugin](https://v2.tauri.app/plugin/file-system/) -- Official docs, HIGH confidence
- [Tauri 2.0 Dialog Plugin](https://v2.tauri.app/plugin/dialog/) -- Official docs, HIGH confidence
- [Tauri 2.0 Store Plugin](https://v2.tauri.app/plugin/store/) -- Official docs, HIGH confidence
- [Tauri 2.0 Shell Plugin / Sidecar](https://v2.tauri.app/develop/sidecar/) -- Official docs, HIGH confidence
- [wavesurfer.js GitHub](https://github.com/katspaugh/wavesurfer.js) -- v7.12.x confirmed, MEDIUM-HIGH confidence
- [realtime-bpm-analyzer](https://www.realtime-bpm-analyzer.com/) -- TypeScript, Web Audio API, MEDIUM confidence
- [Rust image crate](https://crates.io/crates/image) -- v0.25, HIGH confidence
- [Symphonia](https://github.com/pdeljanov/Symphonia) -- Pure Rust audio decoding, HIGH confidence
- [Rodio](https://github.com/RustAudio/rodio) -- Built on symphonia, HIGH confidence
- [Preact Signals Guide](https://preactjs.com/guide/v10/signals/) -- Official docs, HIGH confidence
- [Tailwind CSS v4.0 announcement](https://tailwindcss.com/blog/tailwindcss-v4) -- Official, HIGH confidence
- [@preact/preset-vite](https://github.com/preactjs/preset-vite) -- Official Preact Vite plugin, HIGH confidence
- [nanoid](https://github.com/ai/nanoid) -- 130 bytes, crypto-secure, HIGH confidence
- [Tauri v2.4.2 release info](https://v2.tauri.app/release/) -- MEDIUM confidence (version from WebSearch)
- [@tauri-apps/api 2.10.1](https://www.npmjs.com/package/@tauri-apps/api) -- MEDIUM confidence (version from WebSearch)

---
*Stack research for: Desktop stop-motion cinematic video editor (macOS)*
*Researched: 2026-03-02*
