# Pitfalls Research

**Domain:** Desktop stop-motion cinematic video editor (Tauri 2.0 + Preact + Motion Canvas)
**Researched:** 2026-03-02
**Confidence:** MEDIUM-HIGH

## Critical Pitfalls

### Pitfall 1: WebKit Canvas Memory Leaks from Image Sequence Loading

**What goes wrong:**
Loading hundreds of high-resolution photos into WebGL/Canvas textures for timeline thumbnails and preview playback causes unbounded memory growth. WebGL textures are not reliably garbage collected in WKWebView — GPU textures are created on every drawImage call for every layer on every frame. A 200-frame sequence of 24MP photos at even scaled-down thumbnails can consume gigabytes of VRAM/RAM, eventually crashing the app or freezing macOS.

**Why it happens:**
Tauri on macOS uses WKWebView (WebKit/Safari engine). WebKit's GPU Process canvas rendering creates new GPU textures per drawImage call. Unlike Chromium, WebKit does not aggressively reclaim GPU texture memory. Developers assume the browser handles image lifecycle like DOM elements — it does not. Image objects constructed in rapid succession cause memory to rise even with forced GC. The asset protocol (`convertFileSrc`) has documented memory leaks where converted files are not released when removed from DOM.

**How to avoid:**
- Implement an explicit texture/image pool with a hard cap (e.g., max 50 full-res images in memory). Use LRU eviction.
- Generate thumbnails on the Rust side at reduced resolution (256px wide) for timeline display. Never load full-res photos into the webview for thumbnails.
- For preview playback, pre-scale images to output resolution (1080p/720p) via Rust before sending to the canvas renderer.
- Use `URL.revokeObjectURL()` aggressively. Set image `src` to empty string before nulling references.
- Pool and reuse Image/HTMLImageElement objects instead of creating new ones.
- Monitor `performance.memory` (if available) or implement Rust-side memory tracking with periodic reporting.

**Warning signs:**
- Activity Monitor shows WebKit process memory climbing during timeline scrubbing
- Preview playback gets progressively slower over a session
- App becomes unresponsive after loading a second or third project without restart
- macOS memory pressure warnings appear

**Phase to address:**
Foundation/Core Architecture phase — the image loading pipeline must be designed with pooling from day one. Retrofitting memory management into an existing image pipeline requires rewriting the entire rendering data flow.

---

### Pitfall 2: Tauri IPC Bottleneck for Frame Data Transfer

**What goes wrong:**
Sending image data or large payloads between Rust backend and the Preact frontend through Tauri's IPC serializes everything as JSON. A single 1080p PNG frame is ~6MB. At 24fps preview, that is 144MB/s of JSON serialization overhead through IPC — completely unworkable. Even thumbnails at scale cause visible lag.

**Why it happens:**
Tauri IPC uses a JSON-RPC-like protocol. All arguments and return data must be serializable to JSON. Binary data gets base64-encoded, adding 33% overhead plus serialization/deserialization time. Developers build a working prototype with small test data, then discover IPC is the bottleneck when real project sizes hit. Binary IPC benchmarks show ~5ms per 10MB on macOS — acceptable for single transfers but not for streaming frame data.

**How to avoid:**
- Never send raw image data through IPC. Use the asset protocol (`convertFileSrc`) to let the webview load images directly from disk via `asset://` URLs.
- For thumbnail generation, have Rust write thumbnails to a cache directory, then reference them via asset protocol URLs.
- For export progress, send only status messages (frame number, percentage) through IPC, not frame data.
- Batch IPC calls — instead of one call per frame, send arrays of file paths.
- For real-time data (playhead position, waveform data), use Tauri events (push from Rust) rather than polling commands.

**Warning signs:**
- Timeline scrolling feels sluggish despite low CPU usage
- Adding `console.time` around IPC calls shows >10ms per call
- Preview playback stutters even with pre-cached frames
- Rust backend CPU spikes on serialization during playback

**Phase to address:**
Foundation phase — asset protocol configuration and the image-loading architecture must be established before any UI work begins. The CSP configuration (`img-src 'self' asset: http://asset.localhost`) and asset protocol scope must be in `tauri.conf.json` from the start.

---

### Pitfall 3: Motion Canvas Integration as Embedded Renderer (Not Standalone App)

**What goes wrong:**
Motion Canvas is designed as a standalone animation authoring tool with its own UI, editor, timeline, and dev server. Attempting to use it as an embedded rendering library requires stripping away the editor shell and programmatically controlling scene/animation playback — a use case that is not the primary documented path. Developers either fight the built-in UI or end up reimplementing core rendering logic.

**Why it happens:**
The `@efxlab/motion-canvas-player` package provides an embeddable player, but the rendering pipeline (scene graphs, animation timing, frame export) is tightly coupled with Motion Canvas's internal architecture. The documented export path assumes Motion Canvas's own UI with a "RENDER" button. Programmatic rendering for PNG export requires understanding the internal exporter architecture (ImageExporter, FFmpegExporter) and driving it from custom code.

**How to avoid:**
- Study the `@efxlab/motion-canvas-core` and `@efxlab/motion-canvas-2d` APIs thoroughly before building any rendering code. These are the headless rendering primitives.
- Use `@efxlab/motion-canvas-player` strictly for preview display. Build a separate headless rendering pipeline for export that drives the scene graph frame-by-frame.
- For PNG export, invoke rendering from Rust (or via a headless browser context) rather than trying to export from the visible webview — the webview may throttle background rendering.
- Keep Motion Canvas version pinned at v4.0.0. Do not update without testing the full rendering pipeline.
- Build a thin adapter layer between your project's data model and Motion Canvas scene descriptions. Do not let Motion Canvas types leak into your state management.

**Warning signs:**
- Fighting to hide/override Motion Canvas UI elements
- Export produces different results than preview
- Frame timing inconsistencies between preview and export
- Difficulty controlling animation playback programmatically

**Phase to address:**
Early prototype phase — build a minimal proof-of-concept that loads one image into a Motion Canvas scene, plays it in the embedded player, and exports a PNG sequence programmatically. Validate this works before building any other features.

---

### Pitfall 4: Audio-Visual Sync Drift in Beat-Synced Animation

**What goes wrong:**
The beat sync feature requires frame-accurate alignment between audio beats and visual keyframes. Web Audio API timing and requestAnimationFrame timing operate on different clocks. Over a 3-minute sequence, drift accumulates — audio beats no longer align with visual transitions. At 24fps, one frame is ~42ms. Perceptible audio-visual desync starts at ~20ms.

**Why it happens:**
The Web Audio API uses a hardware crystal clock (AudioContext.currentTime) with sub-millisecond precision. Visual rendering uses requestAnimationFrame which is tied to the display refresh rate (typically 60Hz = 16.67ms intervals) and is not frame-accurate to audio. JavaScript timers (setTimeout/setInterval) are even worse. Safari/WebKit has historically had less precise audio timing than Chromium. Additionally, WKWebView may throttle requestAnimationFrame when the app is not focused.

**How to avoid:**
- Use AudioContext.currentTime as the master clock for all timing. Derive visual frame position from audio time, never the reverse.
- Account for `AudioContext.outputLatency` (the delay between scheduling and hearing) when aligning visuals.
- For beat detection / BPM analysis, do this in Rust (use an audio analysis crate like `aubio` bindings or `beat_detector`), not in the Web Audio API. Send beat timestamps to the frontend as a pre-computed array.
- During preview playback, snap visual frames to the nearest audio-clock-derived frame boundary rather than relying on rAF timing.
- For export (PNG sequence), timing is deterministic — render frame N at time N/fps. Audio sync is only a preview concern.
- Test with click tracks and metronome audio to catch drift early.

**Warning signs:**
- Beat markers visually shift from audio beats during long playback
- Sync looks correct at the start but drifts by the end of a sequence
- Sync behavior differs between 15fps and 24fps projects
- Preview playback timing varies between runs

**Phase to address:**
Audio & Beat Sync phase — but the master clock architecture decision must be made during the preview/playback phase. The playback engine must be designed around audio-as-master-clock from the start.

---

### Pitfall 5: Preact/compat Breaks with Motion Canvas or React-Authored Dependencies

**What goes wrong:**
Using Preact (not React) means any dependency that internally imports from `react` or `react-dom` needs aliasing through `preact/compat`. If Motion Canvas packages or other dependencies use React internals not covered by the compat layer (Suspense edge cases, certain lifecycle methods, synthetic event assumptions), they silently break or produce cryptic errors. TypeScript types from React libraries may not compile without `skipLibCheck`.

**Why it happens:**
Preact's compat layer covers ~95% of React API surface, but edge cases exist. Preact does not implement synthetic events — it uses native browser events. `onChange` behaves differently (Preact uses `onInput` natively). Some React libraries depend on `react-dom/server`, concurrent features, or internal React scheduling that compat does not replicate. The `@efxlab/motion-canvas-*` packages are a fork and may have React assumptions baked in.

**How to avoid:**
- Test every `@efxlab/motion-canvas-*` package import against Preact early. If Motion Canvas renders to its own canvas element (likely), it may not need React/Preact at all — it just needs a DOM mount point.
- Configure Vite aliases: `{ 'react': 'preact/compat', 'react-dom': 'preact/compat', 'react/jsx-runtime': 'preact/jsx-runtime' }`.
- Set `skipLibCheck: true` in tsconfig.json to avoid type conflicts.
- Avoid importing any React UI component libraries. Build all UI with native Preact + Tailwind.
- If Motion Canvas packages do require React, isolate them in a separate rendering context (iframe or web worker) rather than aliasing.

**Warning signs:**
- `Cannot read property of undefined` errors on component mount
- Event handlers fire twice or not at all
- TypeScript errors mentioning React types during build
- Motion Canvas player renders but interactions (click, hover) behave unexpectedly

**Phase to address:**
Project scaffolding / foundation phase — validate Preact + Motion Canvas compatibility before writing any application code. This is a go/no-go gate.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Loading full-res images directly in webview | Quick to implement, images look sharp | Memory leaks, crashes with large projects | Never — always generate scaled previews |
| Storing project state in a single Preact signal | Simple state management | Re-renders entire app on any change, performance cliff with complex projects | Only during early prototyping; refactor to granular signals before timeline phase |
| Using `setTimeout` for animation timing | Works for simple playback | Drift, inconsistent frame timing, breaks beat sync | Never for playback — use rAF or audio clock |
| Putting all Rust commands in one file | Fast development | Unmanageable command file, hard to test | Early prototyping only; split by domain (file, project, audio, export) before Phase 2 |
| Skipping thumbnail cache | Fewer files to manage | Regenerates thumbnails on every project open, slow startup | Never — implement cache from the start |
| Inline CSS instead of Tailwind | Faster for one-off styles | Inconsistent styling, harder to maintain dark mode | Only for truly dynamic values (canvas positioning) |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Tauri asset protocol | Forgetting to configure CSP and asset scope in tauri.conf.json, resulting in blank images | Add `asset:` and `http://asset.localhost` to CSP `img-src` directive. Define scope array to include project directories. |
| Motion Canvas + Vite | Using Motion Canvas's Vite plugin alongside Tauri's Vite config, causing double-build or port conflicts | Tauri's `beforeDevCommand` runs Vite dev server. Motion Canvas Vite plugin must be integrated into the same Vite config, not run separately. Test that HMR works for both UI and scene code. |
| pnpm + Tauri CLI | `pnpm run tauri` fails because Tauri CLI is not found or pnpm hoisting prevents binary resolution | Install `@tauri-apps/cli` as a devDependency. Use `pnpm tauri` (not `npx tauri`). Commit `pnpm-lock.yaml` AND `src-tauri/Cargo.lock`. |
| Preact Signals + Tailwind v4 | Class names computed from signals cause Tailwind v4 to miss classes during build (no JIT scanning of dynamic values) | Use complete class names in signal-driven conditional rendering (`isActive.value ? 'bg-blue-500' : 'bg-gray-500'`), never string concatenation (`\`bg-${color}-500\``). Safelist dynamic classes if unavoidable. |
| Tailwind v4 + Vite | Using `tailwindcss` as PostCSS plugin (v3 pattern) instead of `@tailwindcss/postcss` (v4 pattern) | Install `@tailwindcss/postcss` and `@tailwindcss/vite`. Use CSS-first `@import "tailwindcss"` instead of `@tailwind` directives. Remove `autoprefixer` (v4 handles it). |
| macOS code signing | App works in development but crashes after notarization due to missing entitlements | WKWebView requires JIT and unsigned executable memory entitlements. Set `hardenedRuntime: true` in tauri.conf.json. Test notarized build early — do not leave this for release day. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Rendering all timeline thumbnails at once | UI freezes when opening a project with 500+ frames | Virtualize timeline — only render visible frame thumbnails. Use IntersectionObserver or virtual scrolling. | >100 frames in timeline |
| Full-resolution preview at all zoom levels | Preview canvas consumes excessive GPU memory and drops frames | Scale preview render resolution to match canvas display size. Only render at full resolution for export. | Sequences with >10 layers or >1080p source images |
| Synchronous file I/O on the Rust side blocking IPC | Frontend freezes during file operations (save, export, import) | All Rust file operations must be async (tokio). Use Tauri's async command pattern. Send progress events for long operations. | Projects with >50 images or saving to slow storage |
| Re-rendering entire canvas when one layer property changes | Preview becomes unusable when adjusting opacity/blend/position | Implement dirty-region tracking or layer-level caching. Only re-composite changed layers. Motion Canvas scene graph should handle this if used correctly. | >5 layers in a composition |
| Storing undo history as full project snapshots | Memory grows linearly with each edit, app slows down | Use command pattern (store operations, not states). Implement structural sharing for undo snapshots. Cap undo stack size. | >50 undo operations |
| Audio waveform computed on every timeline zoom/scroll | Waveform visualization causes jank during timeline interaction | Pre-compute waveform data at multiple zoom levels in Rust. Cache as typed arrays. Only transfer the visible portion. | Audio tracks >30 seconds |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Overly broad asset protocol scope (e.g., `/`) | Any file on the filesystem readable by the webview, including sensitive user data | Scope asset protocol to project directory and a global assets directory only. Never use root or home directory as scope. |
| Not validating .mce project file contents before loading | Malicious project files could inject scripts or reference arbitrary file paths | Validate/sanitize all paths in project files. Ensure referenced files are within allowed directories. Parse JSON with schema validation. |
| Storing absolute file paths in project files | Projects break when moved. Path traversal risk if paths reference outside project dir. | Store relative paths in .mce files. Resolve to absolute only at runtime against the project root. |
| Allowing arbitrary file types through drag-and-drop import | User drops executable or script file, app tries to process it | Whitelist allowed extensions (PNG, JPG, TIFF, WAV, MP3, MP4). Validate file magic bytes, not just extension. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No progress indication during PNG export | User thinks app froze during a 500-frame export that takes minutes | Show frame-by-frame progress bar with ETA. Allow cancellation. Show currently-rendering frame thumbnail. |
| Blocking UI during image import | Importing 100 photos freezes the app for 10+ seconds | Import asynchronously with progress. Generate thumbnails in background. Allow user to continue editing while import completes. |
| Auto-save without visual feedback | User loses trust — did it save? Is my work safe? | Show subtle save indicator (checkmark, timestamp). Never auto-save during export or playback. |
| Timeline zoom with no visible anchor point | User zooms and loses their position in the timeline | Zoom toward cursor position or playhead, not toward the start of the timeline. |
| Undo doesn't cover all operations | User deletes a sequence, undo does nothing | Every state mutation must be undoable. Test undo for: reorder, delete, import, property change, layer add/remove. |
| Preview resolution mismatch with export | Preview looks great but export has different framing/cropping | Use identical rendering parameters for preview and export. Only resolution should differ. Show safe-area guides if aspect ratios can differ. |

## "Looks Done But Isn't" Checklist

- [ ] **Image import:** Often missing EXIF orientation handling — photos appear rotated 90 degrees. Verify EXIF rotation is applied during thumbnail generation.
- [ ] **Timeline:** Often missing keyboard accessibility — verify arrow keys, Home/End, Space for play/pause all work without mouse.
- [ ] **PNG export:** Often missing color space consistency — verify exported PNGs match preview colors. sRGB vs Display P3 on macOS causes subtle color shifts.
- [ ] **Project save:** Often missing dirty-state tracking — verify the app prompts to save on close only when changes exist, and that "revert to saved" works.
- [ ] **Audio sync:** Often missing offset handling — verify audio that starts mid-sequence or has a lead-in silence still syncs correctly.
- [ ] **Layer blending:** Often missing alpha premultiplication — verify blend modes produce correct results with semi-transparent layers. Unmultiplied alpha + blend modes = visual artifacts.
- [ ] **Drag and drop:** Often missing multi-file ordering — verify that dropping 20 files imports them in filename-sorted order, not random browser event order.
- [ ] **macOS integration:** Often missing native file dialogs — verify open/save dialogs use NSOpenPanel/NSSavePanel (Tauri provides this), not custom HTML dialogs.
- [ ] **Playback:** Often missing proper stop behavior — verify that stopping playback returns playhead to the start position (or the position where play was pressed), not leaving it at the current frame.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Memory leaks from image loading | MEDIUM | Implement image pool + LRU cache. Requires changing all image loading call sites to go through the pool. ~2-3 days of refactoring. |
| IPC bottleneck discovered late | HIGH | Migrate from IPC-based image transfer to asset protocol. Requires changing how all images are referenced (URLs vs binary data), rebuilding thumbnail pipeline. ~1 week. |
| Motion Canvas integration fails | HIGH | If compat layer doesn't work, must either: (a) fork Motion Canvas packages to remove React deps, (b) isolate in iframe, or (c) replace with custom Canvas2D/WebGL renderer. Any option is 1-2 weeks minimum. |
| Audio sync drift | MEDIUM | Refactor playback engine to use AudioContext as master clock. Requires rewriting frame scheduling logic. ~3-4 days. |
| Preact compat issues | MEDIUM-HIGH | If isolated to specific packages, add shims. If widespread, evaluate switching to Preact with full compat layer or (worst case) switching to React. ~3-5 days. |
| Full-res thumbnails causing slowness | LOW | Add Rust-side thumbnail generator + cache directory. ~1 day for the Rust code, 1 day to update all references. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| WebKit memory leaks | Foundation — image pipeline architecture | Load 200+ images, scrub timeline for 5 minutes, check memory stays bounded |
| IPC bottleneck | Foundation — asset protocol + CSP setup | Measure IPC round-trip time. Verify images load via `asset://` not base64 |
| Motion Canvas integration | Early prototype / proof-of-concept | Render one scene with an image, export 10 PNG frames programmatically |
| Audio sync drift | Preview playback phase, validated in beat sync phase | Play a click track with beat markers for 3+ minutes, verify alignment at end |
| Preact compat | Project scaffolding | Import every @efxlab/motion-canvas-* package, verify no React-specific errors |
| Tailwind v4 config | Project scaffolding | Verify CSS-first imports, @tailwindcss/vite plugin, and dynamic class rendering all work |
| macOS code signing | Distribution phase, but test in CI early | Build, sign, notarize, then launch the notarized .app. Must not crash on first launch. |
| Timeline virtualization | Timeline UI phase | Open project with 500 frames, verify smooth scrolling at 60fps in Activity Monitor |
| Export progress UX | Export phase | Export 200+ frames, verify progress updates every frame, cancellation works mid-export |
| Project file security | Project management phase | Attempt to load a .mce file with path traversal strings, verify they are rejected |

## Sources

- [Tauri asset protocol memory issue](https://github.com/tauri-apps/tauri/issues/2952) — documented memory leak with asset:// protocol
- [Tauri file reading memory leak](https://github.com/tauri-apps/tauri/issues/9190) — 140MB+ files cause memory exhaustion
- [Tauri IPC performance discussion](https://github.com/tauri-apps/tauri/discussions/7146) — binary IPC benchmarks (~5ms/10MB macOS)
- [Tauri IPC overhead analysis](https://medium.com/@srish5945/tauri-rust-speed-but-heres-where-it-breaks-under-pressure-fef3e8e2dcb3) — JSON-RPC serialization bottleneck
- [Things I Wish I Knew Before Building My First Tauri App](https://dev.to/dev_owls/things-i-wish-i-knew-before-building-my-first-tauri-app-48k6) — state management, plugin ecosystem
- [Preact Differences from React](https://preactjs.com/guide/v10/differences-to-react/) — synthetic events, onChange behavior
- [When to use preact/compat](https://marvinh.dev/blog/preact-vs-compat/) — compat layer guidance
- [Tailwind CSS v4 Upgrade Guide](https://tailwindcss.com/docs/upgrade-guide) — breaking changes, migration path
- [Audio/Video sync with Web Audio API](https://blog.paul.cx/post/audio-video-synchronization-with-the-web-audio-api/) — master clock pattern
- [Web.dev audio output latency](https://web.dev/articles/audio-output-latency) — outputLatency property
- [W3C frame-accurate sync](https://www.w3.org/2019/Talks/TPAC/frame-accurate-sync/) — timing precision challenges
- [Motion Canvas rendering docs](https://motioncanvas.io/docs/rendering/) — export pipeline architecture
- [Motion Canvas image sequence](https://motioncanvas.io/docs/rendering/image-sequence/) — PNG sequence exporter
- [WebGL memory leak patterns](https://github.com/mrdoob/three.js/issues/11378) — texture cleanup requirements
- [Tauri macOS code signing](https://v2.tauri.app/distribute/sign/macos/) — entitlements, notarization
- [Shipping Tauri macOS app](https://dev.to/0xmassi/shipping-a-production-macos-app-with-tauri-20-code-signing-notarization-and-homebrew-mc3) — production signing walkthrough
- [Tauri v2 displaying images via asset protocol](https://github.com/tauri-apps/tauri/discussions/11498) — CSP configuration

---
*Pitfalls research for: EFX-Motion Editor — Desktop stop-motion cinematic video editor*
*Researched: 2026-03-02*
