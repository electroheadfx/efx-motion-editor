# Pitfalls Research

**Domain:** v2.0 feature additions to desktop stop-motion cinematic editor (Tauri 2.0 + Preact Signals + Motion Canvas)
**Researched:** 2026-03-03
**Confidence:** MEDIUM-HIGH
**Focus:** Common mistakes when adding layer compositing, FX effects, audio/beat sync, PNG export, undo/redo, and keyboard shortcuts to the existing v1.0 codebase

## Critical Pitfalls

### Pitfall 1: Undo/Redo Across 7+ Reactive Stores With Cross-Store Computed Values

**What goes wrong:**
The existing architecture has 7 stores (projectStore, sequenceStore, imageStore, layerStore, timelineStore, uiStore, historyStore) with cross-store computed signals like `frameMap` (computed from `sequenceStore.sequences`) and `totalFrames` (derived from frameMap). The command pattern undo/redo must restore consistent state across multiple stores atomically. If an undo operation restores sequenceStore but not layerStore, the computed `frameMap` updates mid-batch, triggering derived effects with inconsistent intermediate state. Preact Signals' fine-grained reactivity means each `.value` assignment can trigger subscribers immediately -- unlike React's batched setState, a naive command.undo() that writes to three stores in sequence fires three rounds of re-renders with partially-restored state.

**Why it happens:**
The existing `markDirty` callback pattern (sequenceStore -> projectStore via function reference) proves stores are already tightly coupled through indirect channels. Developers implement undo by storing "before" and "after" snapshots per store, then replaying them. But the `batch()` from `@preact/signals` only batches synchronous writes within a single callback -- if undo logic awaits anything (like IPC to restore an image path), the batch breaks and intermediate states leak to the UI. The existing `HistoryEntry` type stores `undo: () => void` and `redo: () => void` closures, which is correct, but closures can capture stale signal references if the undo function reads `.value` at definition time instead of execution time.

**How to avoid:**
- Wrap every undo/redo execution in `batch(() => { entry.undo(); })` to ensure all store writes are atomic from Preact's perspective.
- Never use `async` inside undo/redo closures. All state restoration must be synchronous. If a command involves async operations (like file I/O), the async work must happen before the command is pushed to the history stack, and the undo closure must only contain synchronous signal writes.
- Use `.peek()` inside undo/redo closures to read current state without creating signal subscriptions. Use `.value =` only for writes.
- For compound operations (e.g., "add FX layer" which touches layerStore + sequenceStore + marks dirty), create a `CompoundCommand` that bundles multiple sub-commands and undoes them all in a single `batch()`.
- Test undo specifically at the frameMap boundary: undo a key photo deletion and verify `totalFrames` reflects the restored state before any UI re-render.

**Warning signs:**
- Timeline flickers or shows wrong frame count briefly after undo
- Preview shows stale image after undoing a key photo reorder
- `isDirty` flag does not correctly reflect undo-to-clean-state (undoing all changes should clear dirty)
- autoSave triggers during an undo operation because `isDirty` toggles mid-batch

**Phase to address:**
Undo/Redo phase -- but the `batch()` wrapping pattern and the "no async in undo closures" rule must be established as a hard constraint from the first command implementation.

---

### Pitfall 2: Layer Compositing Order Diverges Between Data Model and Motion Canvas Scene Graph

**What goes wrong:**
The existing `layerStore` maintains layers as a flat array with implicit z-ordering (index 0 = bottom). Motion Canvas uses a scene graph where the last child added renders on top. If the layer reorder operation updates `layerStore.layers` but does not synchronously update the Motion Canvas scene graph node order, the preview shows layers in the wrong compositing order. Worse, blend modes like `screen` and `multiply` are order-dependent -- `A screen B` produces different results than `B screen A`. Users see correct layer order in the panel but wrong compositing in preview.

**Why it happens:**
The current `layerStore.reorder()` does a simple array splice. There is no mechanism to propagate layer order changes to the Motion Canvas rendering scene. The `Preview.tsx` component currently renders a single `<img>` overlay -- it does not yet use Motion Canvas for compositing. When the transition to actual Motion Canvas compositing happens, developers must bridge the reactive store (Preact Signals) with the imperative scene graph (Motion Canvas nodes). The temptation is to rebuild the entire scene graph on every layer change, which is both slow and breaks any in-flight animations.

**How to avoid:**
- Maintain a stable mapping between `Layer.id` and its corresponding Motion Canvas `Node` reference. When layers reorder, move existing nodes rather than destroying and recreating them.
- Use a synchronization function that diffs the current layer order against the scene graph child order and applies minimal moves. This is the same algorithm as virtual DOM list reconciliation.
- For blend modes, apply them via Motion Canvas's `compositeOperation` property on the `Rect` or `Img` node wrapping each layer. Validate that Motion Canvas's compositeOperation maps correctly to Canvas 2D's `globalCompositeOperation` values.
- Ensure the preview scene graph update happens in the same synchronous tick as the store update. Use a Preact `effect()` that subscribes to `layerStore.layers` and updates the scene graph.
- Write a visual regression test: create 3 layers with distinct colors and `multiply` blend mode, reorder them, verify the composite output pixel values match expected results.

**Warning signs:**
- Layer panel shows order A-B-C but preview shows C-B-A compositing
- Blend mode changes visually apply to the wrong layer
- Layer reorder causes preview to flash black briefly (scene graph rebuild)
- Adding a new layer sometimes renders it behind existing layers

**Phase to address:**
Layer compositing phase -- the store-to-scene-graph synchronization architecture must be the first thing built, before any blend mode or opacity work.

---

### Pitfall 3: FX Shader Effects Cause Export/Preview Mismatch Due to Resolution-Dependent Parameters

**What goes wrong:**
Film grain, light leaks, vignette, and blur effects use parameters that depend on pixel dimensions. A grain effect tuned for 830px preview width (the current `max-w-[830px]` in CanvasArea) looks completely different when exported at 1920x1080 or 4K. Grain particles are either invisible (too small) or blocky (too large). Vignette falloff radius becomes wrong. Light leak positions shift. Users carefully tune FX in preview, then export produces different-looking results.

**Why it happens:**
The current preview renders at whatever the browser scales the container to (max 830px wide per CSS). Export will render at the project's native resolution (1920x1080 default). If FX parameters are stored as pixel values, they break at different resolutions. Even if stored as percentages/ratios, the visual appearance of noise patterns changes at different resolutions because the frequency content is resolution-dependent. Additionally, Motion Canvas separates preview and render resolution configurations -- the preview can run at 0.5x scale while render runs at 1x, and shader effects need to account for this.

**How to avoid:**
- Store all FX parameters as resolution-independent values (0.0-1.0 normalized, or relative to the shorter dimension).
- For procedural effects (grain, scratches), scale the noise frequency inversely with resolution so the visual density matches between preview and export.
- Implement a `getEffectiveParams(width, height)` method on each FX that converts normalized parameters to pixel values at render time.
- Test every FX effect by comparing a preview screenshot against a rendered export at the same frame. They must be visually identical (allowing for resolution differences in detail, not in composition).
- For vignette and light leaks, use aspect-ratio-aware UV coordinates, not absolute pixel positions.

**Warning signs:**
- Grain looks fine in preview but disappears or becomes chunky in export
- Vignette is centered in preview but off-center in export
- Light leak positions shift between preview and export
- Blur radius appears different between preview and export resolutions

**Phase to address:**
FX Effects phase -- establish the resolution-independent parameter convention before implementing the first effect. Every subsequent effect must follow this convention.

---

### Pitfall 4: AudioContext Lifecycle Conflicts with Tauri Window Management

**What goes wrong:**
Creating an `AudioContext` in WKWebView requires a user gesture (tap/click) due to autoplay policy. In Tauri, window focus/blur events can suspend the AudioContext. If the user clicks a native Tauri menu item (File > Save), focus transfers to the native layer, WKWebView may suspend the AudioContext, and audio playback cuts out. Resuming does not happen automatically when focus returns. Additionally, creating multiple AudioContext instances (one for playback, one for analysis) consumes limited system audio resources and can cause crackling or silence on one of them.

**Why it happens:**
WebKit enforces autoplay policy even in desktop webview contexts. The existing `PlaybackEngine` uses `performance.now()` with rAF -- it has no AudioContext at all yet. Adding audio playback means introducing an AudioContext that must be created on user gesture, survive window focus changes, and coordinate timing with the existing rAF-based frame advance. Developers often create the AudioContext at app startup (fails due to autoplay policy) or create a new one each time audio is needed (resource leak).

**How to avoid:**
- Create exactly one `AudioContext` instance, lazily, on the first user-initiated play action. Store it as a singleton.
- On every play action, check `audioContext.state` and call `audioContext.resume()` if suspended. This handles both the initial autoplay gate and post-focus-loss suspension.
- Transition the `PlaybackEngine` to use `AudioContext.currentTime` as the master clock instead of `performance.now()`. The rAF loop should read from `audioContext.currentTime` to determine which frame to display, not accumulate its own delta time.
- For offline audio analysis (BPM detection, waveform generation), use `OfflineAudioContext` which runs without autoplay restrictions and does not conflict with the playback AudioContext.
- Handle Tauri's `window.onFocusChanged` event to call `audioContext.resume()` when focus returns.

**Warning signs:**
- Audio plays once but stops working after switching to another app and back
- "AudioContext was not allowed to start" console warning
- Audio analysis (waveform/BPM) fails silently when no user gesture has occurred
- Two audio sources play simultaneously with crackling

**Phase to address:**
Audio & Beat Sync phase -- but the `PlaybackEngine` clock refactor (switching from `performance.now()` to `AudioContext.currentTime`) must be designed before audio features are built, since it changes the fundamental timing architecture.

---

### Pitfall 5: PNG Export Pipeline Blocks the Main Thread and Causes "App Not Responding"

**What goes wrong:**
Exporting a 500-frame sequence as PNG requires: (1) rendering each frame through Motion Canvas scene graph with all layers composited, (2) calling `canvas.toBlob()` or `canvas.toDataURL()` to encode PNG, (3) sending the binary data to Rust via IPC or writing via Tauri's fs plugin. If any step is synchronous or if frames are processed in a tight loop without yielding to the event loop, the entire UI freezes. macOS shows the spinning beach ball and "App Not Responding" after ~10 seconds of main thread blocking. Even with async operations, processing 500 frames sequentially via IPC at ~5ms per 6MB PNG = 2.5 seconds of pure IPC overhead, plus rendering time.

**Why it happens:**
The natural implementation is a `for` loop: render frame, export PNG, write file, next frame. Even with `await`, if the rendering and encoding happen on the main thread (which Canvas operations do), the event loop is starved. `canvas.toBlob()` is async but the actual PNG encoding still happens on the main thread in most browsers. `canvas.toDataURL()` is synchronous and blocks completely. Additionally, Tauri's binary IPC for 6MB PNGs at 200ms per transfer (documented Windows performance, ~5ms macOS) creates a significant bottleneck.

**How to avoid:**
- Use `canvas.toBlob()` (never `toDataURL()`) for PNG encoding. It is 2-5x faster and avoids base64 overhead.
- Yield to the event loop between frames using `requestAnimationFrame` or `setTimeout(0)` to keep the UI responsive. Process at most 1-3 frames per rAF cycle.
- Send PNG data to Rust in chunks. Better yet, render to an OffscreenCanvas in a Web Worker if the Motion Canvas scene graph supports it (needs investigation -- Motion Canvas may require DOM access).
- If OffscreenCanvas is not viable, have Rust drive the export: Rust iterates frame numbers, sends each frame number to the frontend via Tauri event, frontend renders and returns the blob, Rust writes to disk. This inverts the control flow and lets Rust manage pacing.
- Show per-frame progress: update a progress bar after each frame. Allow cancellation via a shared abort signal.
- Alternative approach: render the Motion Canvas scene to a canvas, then use `canvas.toBlob()` and `URL.createObjectURL()` to create a temporary URL, then use Tauri's download/upload plugin to write the blob to disk without passing through IPC serialization.

**Warning signs:**
- Export starts but UI becomes completely unresponsive
- Progress bar does not update during export
- macOS "Force Quit" dialog appears during export
- Export completes but some PNG files are 0 bytes or corrupted
- Memory usage climbs continuously during export (blobs not freed)

**Phase to address:**
Export phase -- the frame-by-frame rendering pipeline must yield to the event loop. The IPC strategy (asset protocol write vs binary IPC vs Tauri fs plugin) must be benchmarked before committing to an approach.

---

### Pitfall 6: Data Bleed on "New Project" -- Existing v1.0 Bug Amplified by New Stores

**What goes wrong:**
The v1.0 audit identified that `closeProject()` does not reset all stores -- specifically `timelineStore` and `playbackEngine` are not reset, and `stopAutoSave()` is never called. v2.0 adds `layerStore`, `historyStore`, and will add audio state. If "New Project" is clicked while editing, layers from the old project appear in the new project, undo history from the old project is accessible, audio from the old project continues playing, and the beat sync markers from the old project's audio are still visible on the timeline.

**Why it happens:**
The current `projectStore.closeProject()` calls `sequenceStore.reset()`, `imageStore.reset()`, and `uiStore.reset()`, but does NOT call `timelineStore.reset()` or `layerStore.reset()` or `historyStore.reset()`. As new stores are added for v2.0 features, each store's `reset()` must be added to the close/new project flow. This is easy to forget because the failure mode (stale data from previous project) only manifests when switching projects -- a scenario developers rarely test during feature development.

**How to avoid:**
- Fix the existing bug FIRST, before adding any v2.0 features. Add `timelineStore.reset()`, `playbackEngine.stop()`, `layerStore.reset()`, and `stopAutoSave()` to `projectStore.closeProject()`.
- Create a `resetAllStores()` function that lives in a central module and calls `.reset()` on every store. All stores must register themselves with this function. When a new store is added, adding it to `resetAllStores()` is a mandatory checklist item.
- Write an integration test: create project A with data, create new project B, verify every store signal is at its default value.
- Consider adding a "store registry" pattern where stores register on creation and can be iterated for bulk operations like reset.
- Call `stopAutoSave()` in `closeProject()` and `startAutoSave()` after the new project is loaded. The autoSave effect currently subscribes to all store signals -- if stores are reset while autoSave is active, it may trigger a save of the half-reset state.

**Warning signs:**
- Layers panel shows layers after creating a new project
- Undo works immediately in a new project (undoing operations from the previous project)
- Audio waveform is visible on timeline of a new project
- Timeline shows frames from the previous project momentarily
- autoSave fires during project switch, saving a corrupt hybrid state

**Phase to address:**
Phase 1 / Bug fixes -- this must be the very first task before any v2.0 feature work. Every subsequent feature phase that adds a store must update `resetAllStores()`.

---

### Pitfall 7: Keyboard Shortcut Conflicts Between Tauri Native Menus, Browser Defaults, and App Shortcuts

**What goes wrong:**
Cmd+Z is the undo shortcut, but it is also handled by the native macOS text editing system (for text inputs), by Tauri's menu system (if a native menu has an Undo item), and by the browser's built-in undo for contenteditable/input elements. Pressing Cmd+Z while focused on a text input undoes the text change AND triggers the app's undo, causing a double-undo or undo of the wrong thing. Similarly, Cmd+S triggers both the browser's "Save Page" (which Tauri may or may not suppress) and the app's save command. Space bar triggers play/pause but also scrolls the page or activates focused buttons.

**Why it happens:**
Tauri's WKWebView is a real browser view. Native keyboard shortcuts (Cmd+C, Cmd+V, Cmd+Z, Cmd+S) are handled at multiple levels: (1) macOS system level, (2) Tauri native menu accelerators, (3) WKWebView browser defaults, (4) JavaScript event listeners. If a Tauri native menu item has `Cmd+Z` as its accelerator AND a JavaScript `keydown` listener also handles `Cmd+Z`, both fire. The order depends on whether the native menu captures the event before it reaches the webview.

**How to avoid:**
- Register all keyboard shortcuts ONLY in JavaScript via `keydown` on `document`. Do NOT set accelerator keys on Tauri native menu items for shortcuts that have JavaScript-side handlers (Cmd+Z, Cmd+S, Space, arrows).
- Use Tauri native menu accelerators only for shortcuts that must work even when the webview does not have focus (rare in a single-window app).
- In the `keydown` handler, check `e.target` -- if it is an `<input>`, `<textarea>`, or `contenteditable` element, let Cmd+Z/Cmd+C/Cmd+V fall through to native text handling. Only intercept these shortcuts when focus is on the canvas or a non-text element.
- Call `e.preventDefault()` and `e.stopPropagation()` for handled shortcuts to prevent browser defaults (Cmd+S opening save dialog, Space scrolling).
- Build a centralized `ShortcutManager` rather than scattered `addEventListener` calls. Each shortcut registers with a context (e.g., "timeline", "canvas", "global") and only fires when the appropriate panel has focus.

**Warning signs:**
- Cmd+Z undoes text in an input AND undoes a project operation simultaneously
- Cmd+S opens the browser's "Save webpage" dialog in addition to saving the project
- Space bar scrolls the page instead of toggling playback
- Arrow keys scroll the timeline AND step frames simultaneously
- Shortcuts stop working after clicking on certain UI areas

**Phase to address:**
Keyboard shortcuts phase -- but the event handling architecture (centralized ShortcutManager, focus-context awareness) should be designed before individual shortcuts are implemented.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Rebuilding MC scene graph on every layer change | Simpler code, no diffing logic | Preview flickers on every edit, O(n) rebuild per change, breaks any in-progress animations | Only during initial layer system prototype; refactor to incremental updates before adding FX |
| Storing undo closures that capture signal `.value` | Quick to implement per command | Closures capture snapshot values that may reference deleted entities (stale layer IDs, removed images) | Never -- always use `.peek()` at execution time and validate entity existence |
| Using `toDataURL()` for PNG export | Synchronous, simple API | Blocks main thread, 33% memory overhead from base64, breaks at high resolutions | Never -- use `toBlob()` from day one |
| Single-file shortcut handler with if/else chain | Fast to add first 5 shortcuts | Unmaintainable at 20+ shortcuts, no context awareness, no conflict detection | Only in initial prototype; extract to ShortcutManager before Phase 2 |
| Skipping the AudioContext master clock refactor | Keeps existing PlaybackEngine simpler | Audio sync drifts, two timing systems to maintain, beat sync never works reliably | Never -- refactor PlaybackEngine before adding any audio features |
| Storing FX parameters as pixel values | Matches canvas API directly | Breaks at different resolutions, export/preview mismatch | Never -- normalize from the start |
| Adding stores without updating resetAllStores() | Faster feature development | Data bleed between projects, corrupted saves | Never -- make it a CI-enforced checklist item |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Preact Signals + Command Pattern | Capturing `.value` in undo closures at creation time; the closure stores a stale snapshot | Closures should call `.peek()` at execution time. Store entity IDs, not entity objects. Validate existence before applying undo. |
| Motion Canvas Img node + Tauri asset protocol | Passing `asset://` URLs directly to MC `Img` node `src` property; MC may not resolve this protocol | Test MC Img node with asset:// URLs early. May need to convert to base64 data URLs or use `http://asset.localhost` format. If neither works, proxy through a local HTTP server or use canvas drawImage directly. |
| AudioContext + PlaybackEngine rAF loop | Running two independent clocks (rAF accumulator AND AudioContext.currentTime), comparing them to detect drift | Use ONE clock. AudioContext.currentTime becomes the source of truth. rAF loop reads audio time and derives frame number. When no audio is loaded, fall back to performance.now() accumulator (existing behavior). |
| Web Audio OfflineAudioContext + large files | Calling `startRendering()` on a 10-minute audio file; creates a multi-GB AudioBuffer in memory | Decode audio in chunks. For waveform visualization, downsample in Rust (read raw PCM, compute RMS per N samples, send float array). For BPM detection, analyze only the first 30-60 seconds. |
| Motion Canvas compositeOperation + Preact Signals | Setting blend mode via signal subscription inside the MC generator scene; signals and generators have incompatible execution models | Bridge data from Preact Signals to MC scene via a shared plain-object "render state" that the MC generator reads each frame. Do not subscribe to signals inside generator functions. |
| Tauri native menus + JS keyboard handlers | Registering Cmd+Z as both a Tauri menu accelerator AND a JavaScript keydown handler; both fire causing double-undo | Choose one layer per shortcut. For app-specific shortcuts (undo, play, step), use JS only. For OS-integration shortcuts (Quit, Minimize), use Tauri menus only. |
| canvas.toBlob() + Tauri IPC | Sending blob data through standard invoke() which JSON-serializes it, base64-encoding the binary | Convert blob to ArrayBuffer, then use Tauri's binary-aware IPC or write directly via the fs plugin. Better: have Rust read from a temp file path instead of receiving binary data through IPC. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Recompositing all layers on single-layer property change | Preview drops to <10fps when adjusting opacity slider on one layer | Implement layer-level dirty tracking. Only recomposite from the changed layer upward. Cache composited results of unchanged lower layers. | >3 layers with any interactive property adjustment |
| Audio waveform recomputed on every timeline scroll | Timeline scrolling becomes janky when audio is loaded | Pre-compute waveform overview at multiple zoom levels (full, 1/4, 1/16 resolution). Cache as Float32Array. Only transfer visible portion to canvas. | Any audio file >10 seconds |
| OfflineAudioContext for full-song BPM analysis | Browser tab becomes unresponsive for 5-10 seconds during analysis | Analyze only the first 30 seconds for BPM. Use Rust-side DSP library instead of Web Audio for heavy analysis. Decode progressively. | Audio files >2 minutes |
| frameMap recomputation on every layer visibility toggle | Toggling layer visibility causes full frameMap rebuild, freezing UI with many frames | Separate layer visibility from frame-level data. frameMap should only recompute when sequences/keyPhotos change, not when layer display properties change. | >200 frames with >3 layers |
| Undo history storing deep clones of entire store state | Memory grows 10-50MB per undo step for projects with many images | Store only deltas (command + inverse command). Never clone the images array or fullResLoaded map. Store only the minimal data needed to reverse each operation. | >20 undo operations on a project with >50 images |
| PNG export rendering to visible canvas | Export speed limited by display refresh rate (60fps max = 60 frames/sec export speed) | Render to an offscreen canvas (or OffscreenCanvas if MC supports it). Decouple from rAF. Export can theoretically run faster than real-time if rendering is fast. | Any export >100 frames |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Audio file import without format validation | User imports a malicious file disguised as .wav/.mp3; Web Audio API decode may trigger browser vulnerabilities | Validate audio file magic bytes in Rust before passing to frontend. Whitelist: WAV (RIFF header), MP3 (ID3/sync bytes), AAC, OGG. Reject everything else. |
| PNG export writing to arbitrary path via user-provided string | Path traversal in export directory selection could write outside intended location | Use Tauri's native save dialog for directory selection. Validate the resolved path is within an allowed scope. Never concatenate user strings into file paths without sanitization. |
| Undo history closures retaining references to file paths | Undoing a "delete layer" restores a reference to a file that may have been deleted from disk | Validate file existence before executing undo. Show user-friendly error if referenced file is missing. Never silently fail. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Beat detection runs without progress feedback | User clicks "Detect Beats" and nothing happens for 5 seconds -- they click again, starting a second analysis | Show immediate feedback ("Analyzing audio..."), disable the button during analysis, show progress if possible. |
| Undo does not group rapid slider changes | User drags opacity from 100 to 50, generating 50 individual undo entries -- Cmd+Z steps back one pixel at a time | Debounce continuous property changes. Group all changes during a single mouse drag into one undo entry. Use mousedown/mouseup to define command boundaries. |
| FX preview not real-time | User adjusts grain intensity slider but preview only updates on mouse release | FX preview must update on every slider change (throttled to 30fps). Use signal-driven reactivity to bridge slider -> FX parameter -> MC scene rerender. |
| Keyboard shortcuts have no discoverability | Users do not know Space plays, or that JKL shuttles, because there is no visual hint | Show shortcut hints in tooltips on all buttons. Add a Cmd+/ help overlay showing all shortcuts. Include shortcuts in native menu items (even if JS handles them). |
| Layer opacity affects all frames including export | User expects opacity to be "preview only" but it bakes into exported PNGs | Make it explicit in UI that layer properties affect final output. Show a "preview-only effects" section separately if any exist. |
| Audio waveform covers timeline track content | Waveform visualization obscures key photo thumbnails on the timeline | Render waveform in a dedicated track row below the sequence tracks. Or render as a semi-transparent overlay that does not obscure the key photo boundaries. |

## "Looks Done But Isn't" Checklist

- [ ] **Undo/Redo:** Often missing undo for layer reorder, FX parameter changes, and audio trim -- verify ALL state-mutating operations push to history stack, not just the obvious ones (add/delete)
- [ ] **Undo/Redo:** Often missing "undo to clean state" -- verify that if user makes 3 changes then undoes all 3, `isDirty` returns to `false` and autoSave does not trigger
- [ ] **Layer compositing:** Often missing premultiplied alpha handling -- verify that a semi-transparent layer with `multiply` blend mode composites correctly against both black and white backgrounds. Non-premultiplied alpha + blend modes = dark fringing artifacts.
- [ ] **FX grain effect:** Often missing temporal consistency -- verify grain pattern changes per frame (not static), but is deterministic per frame (same grain on frame 50 every time, for export consistency)
- [ ] **Beat detection:** Often missing BPM halving/doubling correction -- verify that a 140 BPM track is not detected as 70 BPM or 280 BPM. Test with known-BPM reference tracks.
- [ ] **PNG export:** Often missing color profile embedding -- verify exported PNGs include sRGB ICC profile. macOS Preview.app and DaVinci Resolve interpret untagged PNGs differently.
- [ ] **PNG export:** Often missing sequential numbering with zero-padding -- verify frame_0001.png through frame_0500.png, not frame_1.png through frame_500.png. DaVinci Resolve requires consistent padding to import as image sequence.
- [ ] **Keyboard shortcuts:** Often missing modifier key release handling -- verify that holding Cmd then pressing Z multiple times fires multiple undos (keydown repeat), and that releasing Cmd does not trigger an unwanted action
- [ ] **Audio import:** Often missing sample rate mismatch handling -- verify that a 48kHz audio file works correctly when AudioContext defaults to 44.1kHz (or vice versa). Waveform timing will be wrong if sample rates are mismatched.
- [ ] **Layer transforms:** Often missing transform origin awareness -- verify that rotating a layer rotates around its center, not around the canvas origin (0,0). This is the default in CSS but NOT in Canvas 2D transforms.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Undo/redo with non-atomic cross-store updates | MEDIUM | Wrap all undo/redo executions in `batch()`. Add validation that checks store consistency after each undo. ~2-3 days to audit and fix all existing commands. |
| Layer order divergence (store vs scene graph) | MEDIUM | Implement a reconciliation pass that runs after every layer mutation. Compare store order to MC node order, fix discrepancies. ~2 days. |
| FX resolution-dependent parameters | HIGH | Must change the FX parameter model from pixels to normalized values. Requires updating every FX implementation, the FX UI controls, the serialization format, and all existing project files. ~1 week. |
| AudioContext lifecycle issues | LOW | Add `resume()` calls at play() entry point. Create singleton AudioContext. ~1 day. But if PlaybackEngine was not refactored to use audio clock, MEDIUM cost (~3 days). |
| PNG export blocking main thread | MEDIUM | Restructure export loop to yield between frames. Switch from toDataURL to toBlob. ~2-3 days. |
| Data bleed on project switch | LOW-MEDIUM | Add missing reset() calls to closeProject(). Create resetAllStores(). ~1 day for existing stores, ongoing discipline for new stores. |
| Keyboard shortcut conflicts | LOW | Centralize all handlers into ShortcutManager. Remove Tauri menu accelerators that conflict. ~1-2 days. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Cross-store undo atomicity | Undo/Redo phase (first task) | Undo a compound operation (add layer + add FX). Verify all stores revert atomically. Verify no intermediate UI flicker. |
| Layer/scene graph order divergence | Layer compositing phase (first task) | Create 5 layers, reorder via drag-and-drop 10 times. Verify preview matches panel order at each step. |
| FX resolution-dependent parameters | FX Effects phase (before first effect) | Apply grain effect, compare preview screenshot vs rendered export at same frame. Grain density must match visually. |
| AudioContext lifecycle in Tauri | Audio phase (first task) | Load audio, play, switch to Finder, switch back. Audio must resume without user action. |
| PNG export main thread blocking | Export phase (architecture decision) | Export 200 frames. UI must remain responsive (timeline scrollable, cancel button clickable) throughout. |
| Data bleed on New Project | Phase 1 / Bug fixes (before ALL other work) | Open project A (with layers, audio, FX, undo history), create new project B. Verify every store at default values. |
| Keyboard shortcut conflicts | Keyboard shortcuts phase | Focus a text input, press Cmd+Z. Verify text undo occurs but project undo does NOT. Press Space in timeline area. Verify play toggles, page does not scroll. |
| Stale closures in undo history | Undo/Redo phase | Add a layer, undo (layer removed), redo (layer restored). Delete the layer. Undo the delete. Verify restored layer has correct properties, not stale captured values. |
| Beat detection BPM halving | Audio/Beat Sync phase | Run detection on 5 reference tracks with known BPMs (80, 120, 140, 160, 175). Verify all detected within +/-2 BPM. |
| Waveform memory with long audio | Audio phase | Load a 10-minute WAV file. Monitor memory. Verify waveform computation does not allocate >200MB. |

## Sources

- [Undo/Redo and the Command Pattern](https://www.esveo.com/en/blog/undo-redo-and-the-command-pattern/) -- challenges with reactive state and undo
- [Designing a lightweight undo history with TypeScript](https://www.jitblox.com/blog/designing-a-lightweight-undo-history-with-typescript) -- command vs memento trade-offs
- [Implementing undo/redo with the Command Pattern](https://gernotklingler.com/blog/implementing-undoredo-with-the-command-pattern/) -- multi-object state consistency
- [WebGL Blending: You're Probably Doing it Wrong](https://limnu.com/webgl-blending-youre-probably-wrong/) -- premultiplied alpha pitfalls
- [MDN: globalCompositeOperation](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation) -- Canvas 2D blend modes reference
- [WebGL Best Practices (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) -- texture format performance, batch flushing
- [web-audio-beat-detector](https://github.com/chrisguttandin/web-audio-beat-detector) -- BPM detection library with tempo range constraints
- [Building BPM Finder: Technical Challenges](https://dev.to/_ab56e9bbfaff3a478352a/building-bpm-finder-technical-challenges-in-client-side-audio-analysis-4n3) -- memory and accuracy challenges
- [Beat Detection Using JavaScript and Web Audio API](http://joesul.li/van/beat-detection-using-web-audio/) -- algorithm limitations, genre bias
- [MDN: Web Audio API Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) -- AudioContext lifecycle, autoplay policy
- [MDN: AudioContext.resume()](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume) -- suspended state handling
- [MDN: Autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) -- user gesture requirements
- [HTMLCanvasElement.toBlob() (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob) -- async PNG encoding, performance vs toDataURL
- [OfflineAudioContext memory concerns](https://github.com/WebAudio/web-audio-api/issues/2445) -- gargantuan AudioBuffer allocation
- [Tauri IPC Performance Discussion](https://github.com/tauri-apps/tauri/discussions/5690) -- binary data transfer benchmarks
- [Tauri File System Plugin](https://v2.tauri.app/plugin/file-system/) -- binary file writing API
- [Tauri Global Shortcut Plugin](https://v2.tauri.app/plugin/global-shortcut/) -- keyboard shortcut registration
- [Tauri Webview Keyboard Focus Bug](https://github.com/tauri-apps/tauri/issues/5464) -- webview not receiving events until interaction
- [Tauri Menu System & Keyboard Shortcuts](https://deepwiki.com/dannysmith/tauri-template/4.3-menu-system-and-keyboard-shortcuts) -- native menu vs JS handler conflicts
- [Motion Canvas Rendering Docs](https://motioncanvas.io/docs/rendering/) -- export pipeline, image sequence output
- [Motion Canvas Image Sequence](https://motioncanvas.io/docs/rendering/image-sequence/) -- PNG/JPEG/WebP format options
- [Preact Signals Guide](https://preactjs.com/guide/v10/signals/) -- batch(), peek(), effect() behavior
- [Preact Signals Blog Post](https://preactjs.com/blog/introducing-signals/) -- fine-grained reactivity model

---
*Pitfalls research for: EFX-Motion Editor v2.0 -- Layer compositing, FX effects, audio/beat sync, PNG export, undo/redo, keyboard shortcuts*
*Researched: 2026-03-03*
