# Phase 4: Timeline & Preview - Research

**Researched:** 2026-03-03
**Domain:** Canvas-based timeline rendering, Motion Canvas player programmatic control, real-time playback engine
**Confidence:** HIGH

## Summary

Phase 4 transforms the static mockup timeline and basic test-scene preview into a fully functional canvas-based timeline with frame thumbnails and a programmatically controlled Motion Canvas preview player. The two major subsystems are (1) a custom HTML Canvas timeline that virtualizes rendering for 100+ frame performance with playhead, scrubbing, zoom, and sequence tracks, and (2) a playback engine that bridges the `timelineStore` to the `@efxlab/motion-canvas-player` web component's internal `Player` instance for seek, play/pause, and frame stepping at the project fps.

The existing codebase provides strong foundations: `timelineStore` already has `currentFrame`, `isPlaying`, `zoom`, `scrollX` signals with seek/step/toggle methods; `sequenceStore` has the full sequence + key photo model with `holdFrames`; `imageStore` provides thumbnail URLs via `getDisplayUrl()`; and the `Preview` component already embeds the `<motion-canvas-player>` element with shadow DOM access patterns. The player web component exposes `play()`, `pause()`, `isPlaying` public API, and its internal `player` property (a `Player` class instance) provides `requestSeek(frame)`, `requestNextFrame()`, `requestPreviousFrame()`, `togglePlayback()`, `onFrameChanged`, and `onRender` events.

**Primary recommendation:** Build a custom Canvas 2D timeline (no third-party timeline library) that draws only the visible frame range based on zoom/scroll, and create a PlaybackEngine class that bridges timelineStore signals to the Motion Canvas Player API using `requestAnimationFrame` with frame-rate-limited ticking.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TIME-01 | Canvas-based timeline displays frame thumbnails with virtualized rendering | Custom Canvas 2D renderer drawing only visible range; thumbnail images pre-cached from imageStore via `getDisplayUrl()`; OffscreenCanvas for pre-compositing if needed |
| TIME-02 | Playhead shows current position with click-to-seek | Canvas draws playhead line at `currentFrame` position; `mousedown` on canvas computes frame from x-coordinate and calls `timelineStore.seek()` |
| TIME-03 | User can scrub through timeline by dragging playhead | `mousedown` on playhead starts drag mode; `mousemove` continuously calls `seek()`; `mouseup` ends drag; pointer capture for smooth scrubbing |
| TIME-04 | User can zoom timeline in/out with scroll/pinch | `wheel` event with `deltaY` adjusts `timelineStore.zoom`; zoom anchors at cursor position to maintain focus point; pinch via `gesturechange` event on macOS WebKit |
| TIME-05 | Timeline shows layer tracks for each sequence | Track rows rendered per sequence from `sequenceStore.sequences`; track headers with labels; future-proofed for FX/audio tracks |
| TIME-06 | User can reorder sequences on the timeline | Drag-and-drop on track headers; visual drop indicator; calls `sequenceStore.reorderSequences()` on drop |
| PREV-01 | Preview canvas renders composited frame via Motion Canvas player | Scene generator reads `currentFrame` to determine which key photo to display; `Img` node from `@efxlab/motion-canvas-2d` renders the photo |
| PREV-02 | User can play/pause at project frame rate (15 or 24 fps) | PlaybackEngine uses `requestAnimationFrame` with frame-rate limiting to advance `currentFrame` at `projectStore.fps` rate; syncs to player via `requestSeek()` |
| PREV-03 | User can step forward/backward one frame at a time | `timelineStore.stepForward/stepBackward` already exist; wire to player `requestNextFrame()`/`requestPreviousFrame()` |
| PREV-04 | User can zoom and pan the preview canvas | CSS transform `scale()` + `translate()` on the player container with mouse wheel (Cmd+scroll) for zoom, drag for pan |
| PREV-05 | Playback engine uses correct clock architecture for audio sync readiness | PlaybackEngine tracks elapsed time via `performance.now()` delta accumulation (not frame counting); audio sync hook point reserved for Phase 7 |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| HTML Canvas 2D API | Native | Timeline rendering | Zero-dependency, full control over drawing, supports virtualization natively |
| @efxlab/motion-canvas-player | 4.0.0 | Preview playback web component | Already installed; exposes `Player` instance for programmatic control |
| @efxlab/motion-canvas-core | 4.0.0 | Player, PlaybackManager, Stage APIs | Already installed; provides `requestSeek()`, `onFrameChanged`, frame/duration events |
| @efxlab/motion-canvas-2d | 4.0.0 | Scene rendering (Img, Rect nodes) | Already installed; `Img` node for rendering key photos in the preview scene |
| @preact/signals | ^2.8.1 | Reactive state for timeline/playback | Already installed; `timelineStore` signals drive both timeline canvas and player |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| OffscreenCanvas API | Native | Pre-compositing thumbnail strips | Only if main-thread thumbnail drawing becomes a bottleneck at high frame counts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom Canvas timeline | animation-timeline-js | Feature-rich but keyframe-focused (not frame-thumbnail focused); adds dependency; harder to customize for our specific sequence-track layout |
| Custom Canvas timeline | DOM-based divs | Simpler to implement but terrible performance at 100+ frames; can't virtualize efficiently |
| Custom playback engine | Motion Canvas Player's built-in auto-play | Player's auto-play runs its own generator timeline; we need frame-precise control tied to our data model, not MC's animation timeline |

**Installation:**
No new packages needed. All required libraries are already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── timeline/
│   │   ├── TimelineCanvas.tsx      # Canvas component with ref, mount/unmount
│   │   ├── TimelineRenderer.ts     # Pure canvas drawing logic (no Preact)
│   │   ├── TimelineInteraction.ts  # Mouse/wheel/touch event handling
│   │   ├── TimelineTracks.ts       # Track layout computation (row heights, positions)
│   │   └── PlayheadOverlay.tsx     # Optional: thin Preact overlay for controls
│   ├── preview/
│   │   ├── PreviewCanvas.tsx       # Player mount + zoom/pan wrapper
│   │   └── PreviewControls.tsx     # Play/pause, step, timecode, zoom controls
│   └── layout/
│       ├── TimelinePanel.tsx       # Updated: uses TimelineCanvas
│       └── CanvasArea.tsx          # Updated: uses PreviewCanvas
├── lib/
│   ├── playbackEngine.ts          # PlaybackEngine class (rAF loop, frame-rate limiting)
│   └── frameMap.ts                # Computed: sequence data -> flat frame array with thumbnail refs
├── scenes/
│   └── previewScene.tsx           # Motion Canvas scene that renders current frame's image
├── stores/
│   └── timelineStore.ts           # Extended: totalFrames computed, per-sequence frame offsets
└── types/
    └── timeline.ts                # Extended: FrameInfo, TrackLayout, etc.
```

### Pattern 1: Separation of Canvas Rendering from Preact
**What:** Keep all Canvas 2D drawing in a pure TypeScript class (TimelineRenderer), instantiated by a thin Preact component (TimelineCanvas) that provides the canvas element ref and subscribes to signal changes.
**When to use:** Any time a Canvas element needs to react to Preact Signal changes.
**Example:**
```typescript
// TimelineCanvas.tsx - thin Preact wrapper
import { useRef, useEffect } from 'preact/hooks';
import { effect } from '@preact/signals';
import { TimelineRenderer } from './TimelineRenderer';
import { timelineStore } from '../../stores/timelineStore';

export function TimelineCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<TimelineRenderer | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new TimelineRenderer(canvas);
    rendererRef.current = renderer;

    // Subscribe to signal changes -> redraw
    const dispose = effect(() => {
      const frame = timelineStore.currentFrame.value;
      const zoom = timelineStore.zoom.value;
      const scrollX = timelineStore.scrollX.value;
      renderer.draw({ frame, zoom, scrollX });
    });

    return () => {
      dispose();
      renderer.destroy();
    };
  }, []);

  return <canvas ref={canvasRef} class="w-full h-full" />;
}
```

### Pattern 2: Frame Map for Data-Driven Timeline
**What:** A computed structure that flattens all sequences' key photos into a linear array of frame entries, each knowing which image to display and which sequence/key-photo it belongs to.
**When to use:** Both timeline rendering (to draw the correct thumbnail per frame) and playback (to know which image to show at frame N).
**Example:**
```typescript
// lib/frameMap.ts
import { computed } from '@preact/signals';
import { sequenceStore } from '../stores/sequenceStore';

export interface FrameEntry {
  globalFrame: number;
  sequenceId: string;
  keyPhotoId: string;
  imageId: string;
  localFrame: number; // frame within this key photo's hold
}

export const frameMap = computed<FrameEntry[]>(() => {
  const entries: FrameEntry[] = [];
  let globalFrame = 0;

  for (const seq of sequenceStore.sequences.value) {
    for (const kp of seq.keyPhotos) {
      for (let f = 0; f < kp.holdFrames; f++) {
        entries.push({
          globalFrame,
          sequenceId: seq.id,
          keyPhotoId: kp.id,
          imageId: kp.imageId,
          localFrame: f,
        });
        globalFrame++;
      }
    }
  }
  return entries;
});

export const totalFrames = computed(() => frameMap.value.length);
```

### Pattern 3: PlaybackEngine with Frame-Rate-Limited rAF
**What:** A class that uses `requestAnimationFrame` but only advances the timeline frame when enough real time has elapsed for the target fps. Accumulates delta time to avoid drift.
**When to use:** Driving playback at 15 or 24 fps regardless of monitor refresh rate.
**Example:**
```typescript
// lib/playbackEngine.ts
import { timelineStore } from '../stores/timelineStore';
import { projectStore } from '../stores/projectStore';

export class PlaybackEngine {
  private rafId: number | null = null;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private playerRef: any = null; // motion-canvas-player element

  setPlayerRef(el: HTMLElement) {
    this.playerRef = el;
  }

  start() {
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.tick(this.lastTime);
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick = (now: number) => {
    const fps = projectStore.fps.value;
    const frameDuration = 1000 / fps;
    const delta = now - this.lastTime;
    this.lastTime = now;
    this.accumulator += delta;

    while (this.accumulator >= frameDuration) {
      this.accumulator -= frameDuration;
      timelineStore.stepForward();

      // Sync to Motion Canvas player
      const player = this.getInternalPlayer();
      if (player) {
        player.requestSeek(timelineStore.currentFrame.value);
      }
    }

    if (timelineStore.isPlaying.value) {
      this.rafId = requestAnimationFrame(this.tick);
    }
  };

  private getInternalPlayer() {
    // Access the internal Player instance from the web component
    return this.playerRef?.player ?? null;
  }
}
```

### Pattern 4: Motion Canvas Scene Driven by External Signals
**What:** Instead of using Motion Canvas's generator-based animation timeline, create a scene that renders a single static frame based on external state. The scene uses `waitFor(Infinity)` to stay alive while an external signal determines what to display.
**When to use:** When Motion Canvas is used as a rendering engine rather than an animation sequencer.
**Example:**
```typescript
// scenes/previewScene.tsx
/** @jsxImportSource @efxlab/motion-canvas-2d/lib */
import { makeScene2D, Img, Rect } from '@efxlab/motion-canvas-2d';
import { createRef, waitFor, useScene } from '@efxlab/motion-canvas-core';

export default makeScene2D(function* (view) {
  const imgRef = createRef<Img>();

  view.add(
    <Rect width={'100%'} height={'100%'} fill="#000000">
      <Img ref={imgRef} width={'100%'} height={'100%'} />
    </Rect>
  );

  // The scene stays alive; external code calls player.requestSeek()
  // or updates variables to change what's displayed
  yield* waitFor(Infinity);
});
```

### Pattern 5: Virtualized Canvas Drawing
**What:** Only draw the frame thumbnails that are within the visible viewport of the canvas element, computed from `scrollX` and `zoom`.
**When to use:** Timeline rendering with 100+ frames.
**Example:**
```typescript
// Inside TimelineRenderer.draw()
draw(state: { frame: number; zoom: number; scrollX: number }) {
  const ctx = this.ctx;
  const { zoom, scrollX } = state;
  const canvasWidth = this.canvas.width;

  const frameWidth = BASE_FRAME_WIDTH * zoom;
  const firstVisibleFrame = Math.floor(scrollX / frameWidth);
  const lastVisibleFrame = Math.ceil((scrollX + canvasWidth) / frameWidth);

  ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

  // Only iterate visible frames
  for (let i = firstVisibleFrame; i <= lastVisibleFrame && i < totalFrames; i++) {
    const x = i * frameWidth - scrollX;
    this.drawFrameThumbnail(ctx, i, x, frameWidth);
  }

  // Draw playhead
  const playheadX = state.frame * frameWidth - scrollX;
  this.drawPlayhead(ctx, playheadX);
}
```

### Anti-Patterns to Avoid
- **Don't use DOM elements for individual frames:** Creating 100+ divs for frame thumbnails will cause layout thrashing and poor scroll performance. Canvas is the only viable approach.
- **Don't use `setInterval` for playback:** `setInterval` is not synchronized with the display refresh cycle and drifts over time. Always use `requestAnimationFrame` with delta-time accumulation.
- **Don't re-render the entire canvas on every signal change:** Use `requestAnimationFrame` to batch multiple signal updates into a single draw call per frame.
- **Don't couple timeline rendering to Motion Canvas scenes:** The timeline is a separate canvas; it reads signals to draw thumbnails. The Motion Canvas player only handles the preview.
- **Don't fight Motion Canvas's generator model:** Instead of trying to programmatically step through a complex generator animation, create a simple scene that displays static images and use `requestSeek()` for frame positioning.
- **Don't load full-resolution images for timeline thumbnails:** Always use `imageStore.getDisplayUrl(image)` which returns the thumbnail path, not the full-res path.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image decoding for thumbnails | Custom image resizer in JS | Existing Rust-generated thumbnails in `images/.thumbs/` via `imageStore` | Thumbnails already generated at import time; loading them via asset protocol is fast |
| Canvas hit testing for clicks | Manual coordinate math for every element | Single `frameFromX()` helper function: `Math.floor((x + scrollX) / frameWidth)` | Timeline is a simple linear layout; no complex hit regions needed |
| Frame-rate limiting | Custom timer with `setInterval` | `requestAnimationFrame` + delta accumulator pattern | rAF syncs with display refresh; accumulator prevents drift and handles variable frame timing |
| Player state synchronization | Custom WebSocket or message passing | Direct access to `player.player` (internal `Player` instance on the web component) | The `@efxlab/motion-canvas-player` web component stores the `Player` as a public property |

**Key insight:** The Motion Canvas `<motion-canvas-player>` web component is not just a black box -- it exposes its internal `Player` instance (which has `requestSeek()`, `togglePlayback()`, `onFrameChanged` etc.) as a property on the DOM element. This means we can control it programmatically without reimplementing the rendering pipeline.

## Common Pitfalls

### Pitfall 1: Motion Canvas Player Initialization Race
**What goes wrong:** Attempting to access `playerElement.player` before the player has loaded its project. The `player` property is `null` until the `src` attribute triggers an async import.
**Why it happens:** The `updateSource()` method is async; it imports the project module, creates a `Player` instance, and sets state to "ready" only after loading completes.
**How to avoid:** Use a MutationObserver on the shadow root's overlay element class (as already done in Preview.tsx), or poll `playerElement.player !== null`. Better: use the player's state transitions (`initial` -> `loading` -> `ready`) and only interact with `player` after state is `ready`.
**Warning signs:** `TypeError: Cannot read property 'requestSeek' of null` in the console.

### Pitfall 2: Canvas DPI Scaling on Retina Displays
**What goes wrong:** Canvas appears blurry on high-DPI (Retina) macOS displays because the canvas CSS size doesn't match its pixel buffer size.
**Why it happens:** macOS has `devicePixelRatio` of 2 (or 3 on some displays). A 600px-wide canvas only has 600 pixels in its buffer, stretched to 1200 physical pixels.
**How to avoid:** Set `canvas.width = canvas.offsetWidth * devicePixelRatio` and `canvas.height = canvas.offsetHeight * devicePixelRatio`, then `ctx.scale(devicePixelRatio, devicePixelRatio)`. Use CSS to set the display size.
**Warning signs:** Blurry text and thumbnails in the timeline on macOS.

### Pitfall 3: Thumbnail Image Loading Stalls
**What goes wrong:** Drawing thumbnails on canvas requires `Image` objects to be loaded. If thumbnails aren't pre-loaded, `drawImage()` draws nothing (no error, just blank).
**Why it happens:** `drawImage()` with an unloaded `Image` silently fails. The asset protocol URL needs to resolve before the image is usable.
**How to avoid:** Pre-load thumbnail `Image` objects into a cache (Map<imageId, HTMLImageElement>). Load on demand when a frame enters the visible range. Draw a placeholder (solid color with text) while loading.
**Warning signs:** Blank frame slots that suddenly appear after scrolling back and forth.

### Pitfall 4: Playback Drift at Low FPS
**What goes wrong:** At 15 fps (66.67ms per frame), simple timestamp comparison can cause frames to be skipped or doubled because `requestAnimationFrame` fires at ~16.67ms intervals (60Hz) or ~8.33ms (120Hz).
**Why it happens:** Naive `if (elapsed > frameDuration)` resets the accumulator to zero, losing fractional time.
**How to avoid:** Use delta-time accumulation: `accumulator += delta; while (accumulator >= frameDuration) { accumulator -= frameDuration; advanceFrame(); }`. This correctly handles sub-frame timing.
**Warning signs:** Playback appears slightly too fast or too slow; frame count after N seconds doesn't match expected `fps * N`.

### Pitfall 5: Preact Signal Subscription in Canvas Render Loop
**What goes wrong:** Using `effect()` inside a tight render loop causes excessive re-subscriptions, or reading `.value` in every `requestAnimationFrame` callback creates garbage.
**Why it happens:** Preact Signals track access to `.value` within `effect()` / `computed()` contexts but not inside plain callbacks.
**How to avoid:** Use `effect()` to listen for signal changes and set a dirty flag. The rAF loop checks the dirty flag and redraws only when needed. For playback, read signal values directly (`.peek()` if you don't want subscription tracking).
**Warning signs:** Timeline redraws 60 times per second even when nothing changes; high CPU usage when idle.

### Pitfall 6: Motion Canvas JSX Pragma Conflict
**What goes wrong:** Scene files that use `@efxlab/motion-canvas-2d` JSX syntax get compiled with Preact's JSX runtime instead.
**Why it happens:** The Vite config sets Preact as the default JSX runtime. Scene files need their own `@jsxImportSource` pragma.
**How to avoid:** Every scene file MUST include `/** @jsxImportSource @efxlab/motion-canvas-2d/lib */` as the first line. This is already done in `testScene.tsx` and must be replicated for `previewScene.tsx`.
**Warning signs:** Runtime errors about invalid node types or missing `add()` method.

### Pitfall 7: Sequence Reorder Drag-and-Drop on Canvas
**What goes wrong:** Implementing drag-and-drop on a Canvas element is more complex than on DOM elements because there are no native drag events for canvas-drawn items.
**Why it happens:** Canvas is a single bitmap; it doesn't have child elements that can receive drag events.
**How to avoid:** Implement drag state manually: `mousedown` identifies which track header was clicked (by y-coordinate), `mousemove` shows a visual drag indicator on the canvas, `mouseup` computes the drop position and calls `sequenceStore.reorderSequences()`. Consider using a thin DOM overlay for track headers to get native drag events.
**Warning signs:** Drag feels unresponsive or doesn't work at all.

## Code Examples

### Accessing Motion Canvas Player's Internal Player

```typescript
// The <motion-canvas-player> web component stores its Player instance
// as a property after loading completes.
// Source: @efxlab/motion-canvas-player/dist/main.js (line 228)

function getPlayer(element: HTMLElement): Player | null {
  // The property is set in updateSource() after project loads
  return (element as any).player ?? null;
}

// Usage after player is ready:
const playerEl = document.querySelector('motion-canvas-player');
const player = getPlayer(playerEl);

// Seek to frame 42
player?.requestSeek(42);

// Play/pause
player?.togglePlayback(true);  // play
player?.togglePlayback(false); // pause

// Subscribe to frame changes
player?.onFrameChanged.subscribe((frame: number) => {
  console.log('Current frame:', frame);
});

// Subscribe to state changes
player?.onStateChanged.subscribe((state) => {
  console.log('Paused:', state.paused, 'Loop:', state.loop);
});
```

### Canvas Thumbnail Cache with Lazy Loading

```typescript
// Thumbnail image cache for Canvas drawImage()
class ThumbnailCache {
  private cache = new Map<string, HTMLImageElement>();
  private loading = new Set<string>();

  get(imageId: string, thumbnailUrl: string): HTMLImageElement | null {
    const cached = this.cache.get(imageId);
    if (cached?.complete) return cached;

    if (!this.loading.has(imageId)) {
      this.loading.add(imageId);
      const img = new Image();
      img.onload = () => {
        this.cache.set(imageId, img);
        this.loading.delete(imageId);
        // Trigger timeline redraw via dirty flag
      };
      img.onerror = () => this.loading.delete(imageId);
      img.src = thumbnailUrl;
    }
    return null; // Not loaded yet; caller draws placeholder
  }

  clear() {
    this.cache.clear();
    this.loading.clear();
  }
}
```

### Retina-Aware Canvas Setup

```typescript
// Must be called on mount and on resize
function setupCanvas(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  return ctx;
}
```

### Preview Zoom and Pan with CSS Transforms

```typescript
// PreviewCanvas zoom/pan state
const previewZoom = signal(1);
const previewPanX = signal(0);
const previewPanY = signal(0);

function handlePreviewWheel(e: WheelEvent) {
  if (e.metaKey || e.ctrlKey) {
    // Zoom
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    previewZoom.value = Math.max(0.1, Math.min(4, previewZoom.value * delta));
  }
}

// In component JSX:
// <div style={{
//   transform: `scale(${previewZoom.value}) translate(${previewPanX.value}px, ${previewPanY.value}px)`,
//   transformOrigin: 'center center'
// }}>
//   <motion-canvas-player ... />
// </div>
```

### Wheel-to-Zoom on Timeline with Anchor Point

```typescript
function handleTimelineWheel(e: WheelEvent, canvasRect: DOMRect) {
  e.preventDefault();

  if (e.ctrlKey || e.metaKey) {
    // Zoom centered on cursor
    const cursorX = e.clientX - canvasRect.left;
    const oldZoom = timelineStore.zoom.value;
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(10, oldZoom * factor));

    // Adjust scrollX to keep the frame under cursor stable
    const frameUnderCursor = (timelineStore.scrollX.value + cursorX) / (BASE_FRAME_WIDTH * oldZoom);
    const newScrollX = frameUnderCursor * BASE_FRAME_WIDTH * newZoom - cursorX;

    timelineStore.setZoom(newZoom);
    timelineStore.setScrollX(Math.max(0, newScrollX));
  } else {
    // Horizontal scroll
    timelineStore.setScrollX(
      Math.max(0, timelineStore.scrollX.value + e.deltaX + e.deltaY)
    );
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DOM-based timeline divs | Canvas 2D rendering with virtualization | 2020+ | Professional editors (Clipchamp, CapCut Web) all use Canvas for timeline performance |
| `setInterval` for playback | `requestAnimationFrame` with delta accumulation | Longstanding best practice | Correct frame timing, battery-efficient, syncs with display refresh |
| Full scene re-render for each frame | `requestSeek()` on existing Player instance | Motion Canvas v3+ | Much faster than destroying and recreating scenes for each frame |
| Separate rendering engine | Reuse `motion-canvas-player` web component | Already in project | Avoid duplicating WebGL/Canvas rendering; leverage existing stage/player pipeline |

**Deprecated/outdated:**
- The test scene (`testScene.tsx`) will need to be replaced or supplemented by a `previewScene.tsx` that renders actual key photo images
- The hardcoded timeline clips in `TimelinePanel.tsx` will be replaced by canvas-rendered data-driven tracks

## Open Questions

1. **Motion Canvas scene for static image display**
   - What we know: Motion Canvas has an `Img` node in `@efxlab/motion-canvas-2d` that can display images. The player can seek to specific frames.
   - What's unclear: Whether `Img` can load images from the Tauri asset protocol (`https://asset.localhost/...`) at runtime, or if it requires Vite-processed imports. The existing asset protocol works for regular `<img>` tags.
   - Recommendation: Test early in Wave 1. If `Img` node can't use asset protocol URLs directly, use a raw Canvas 2D approach: render the image onto the Stage's `finalBuffer` directly, bypassing the Motion Canvas scene graph entirely. Alternatively, use project variables to pass the image URL to the scene.

2. **Player `player` property access stability**
   - What we know: The web component's `player` property is set during `updateSource()`. It's used internally but not documented as a public API.
   - What's unclear: Whether future `@efxlab/motion-canvas-player` updates might rename or hide this property.
   - Recommendation: Create a `getPlayerInstance(el: HTMLElement)` helper function that encapsulates the access pattern. If the property changes, only one place needs updating. Since this is the project's own fork (`@efxlab` scope), the risk is controlled.

3. **Sequence reorder UX on Canvas vs DOM**
   - What we know: Canvas doesn't have native drag events for drawn items. The current sequence list uses SortableJS (DOM-based) in the LeftPanel.
   - What's unclear: Whether canvas-based drag feels good enough, or if a thin DOM overlay for track headers would be better.
   - Recommendation: Start with canvas-only drag (simplest integration). If UX isn't satisfactory, add a thin DOM overlay column for track headers that uses pointer events.

## Sources

### Primary (HIGH confidence)
- `@efxlab/motion-canvas-player/dist/main.js` - Read actual source code of the player web component; confirmed `player` property, `play()`, `pause()`, `isPlaying` API
- `@efxlab/motion-canvas-core/lib/app/Player.d.ts` - Player class type definitions confirming `requestSeek()`, `requestNextFrame()`, `requestPreviousFrame()`, `togglePlayback()`, `onFrameChanged`, `onRender` events
- `@efxlab/motion-canvas-core/lib/app/PlaybackManager.d.ts` - PlaybackManager with `frame`, `fps`, `duration`, `seek()`, `progress()` methods
- `@efxlab/motion-canvas-core/lib/app/Stage.d.ts` - Stage class with `finalBuffer` (HTMLCanvasElement) and `render()` method
- Existing codebase: `timelineStore.ts`, `sequenceStore.ts`, `imageStore.ts`, `Preview.tsx` - current implementation patterns

### Secondary (MEDIUM confidence)
- [animation-timeline-control](https://github.com/ievgennaida/animation-timeline-control) - Canvas-based TypeScript timeline with area virtualization; confirms the pattern is viable
- [MDN Canvas Optimization](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) - Official guidance on canvas performance, offscreen rendering, DPI scaling
- [requestAnimationFrame FPS control patterns](https://gist.github.com/addyosmani/5434533) - Delta accumulation pattern for frame-rate limiting

### Tertiary (LOW confidence)
- None. All findings verified through primary or secondary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed; APIs verified from actual type definitions and source code
- Architecture: HIGH - Patterns verified from existing codebase conventions and Motion Canvas API surface
- Pitfalls: HIGH - Identified from reading actual player source code and existing codebase patterns (JSX pragma, asset protocol, signal subscriptions)

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable -- all libraries already pinned at v4.0.0)
