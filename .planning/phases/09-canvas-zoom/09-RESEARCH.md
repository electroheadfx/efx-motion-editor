# Phase 9: Canvas Zoom - Research

**Researched:** 2026-03-12
**Domain:** Canvas zoom/pan interaction, Preact Signals state sharing, tinykeys keyboard shortcuts, macOS gesture events
**Confidence:** HIGH

## Summary

Phase 9 wires up the existing zoom UI controls in the toolbar (+/- buttons, percent display) to the existing zoom signal infrastructure in CanvasArea.tsx. The zoom/pan signals (`previewZoom`, `previewPanX`, `previewPanY`) already work for Cmd+scroll wheel and middle-click pan -- they just need to be made accessible from Toolbar.tsx and augmented with preset-stop logic, keyboard shortcuts, pinch-to-zoom gesture events, and a true fit-to-window calculation.

The primary challenge is **signal sharing**: the zoom signals are currently module-scoped in CanvasArea.tsx but need to be read/written from Toolbar.tsx (for +/- buttons and percent display) and shortcuts.ts (for Cmd+=/Cmd+-/Cmd+0). The cleanest approach consistent with the existing codebase patterns is to extract these signals into a dedicated `canvasStore.ts` following the same pattern as `timelineStore.ts`. The secondary challenge is implementing **true fit-to-window** which requires measuring the container element and calculating the scale that makes the full project aspect ratio visible, using a ResizeObserver (same pattern already used in TimelineCanvas.tsx).

**Primary recommendation:** Create `canvasStore.ts` with zoom/pan signals, preset-stop logic, and fit calculation. Wire toolbar buttons, keyboard shortcuts, and gesture events to this store.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Toolbar +/- buttons use **preset stops**: 10%, 25%, 50%, 75%, 100%, 150%, 200%, 300%, 400% (9 stops)
- Wheel/pinch zoom stays smooth and continuous (no snapping)
- When between presets (e.g. at 137% from wheel zoom), clicking + snaps to next preset up (150%), clicking - snaps to next preset down (100%)
- Percent display is **read-only** -- no click-to-type direct input
- **Toolbar +/- buttons** -- snap to preset stops, zoom centered on canvas
- **Cmd+= / Cmd+-** keyboard shortcuts -- same preset behavior as toolbar buttons, zoom centered on canvas
- **Cmd+0** -- fit to window (same as Fit button)
- **Cmd/Ctrl + scroll wheel** -- smooth continuous zoom anchored to cursor (already implemented)
- **Trackpad pinch-to-zoom** -- smooth continuous zoom anchored to cursor, keep zoomed canvas centered in user's window (mirror existing timeline pinch pattern from TimelineInteraction.ts)
- **No double-click to fit** -- avoids conflict with Phase 11 (Live Canvas Transform) click interactions
- **Zoom center rule**: buttons/keyboard = center of canvas; gestures (wheel/pinch) = cursor-anchored
- **Session-only** -- zoom is not saved to project file or app config
- **Fit-to-window on project open** -- every project opens at calculated fit zoom, centered
- **Preserve across sequence switches** -- switching sequences keeps current zoom/pan state
- **True fit-to-window** -- Fit button calculates zoom level that makes full canvas visible in current window size (responsive to window resize), not a fixed 100% reset
- Pan resets to centered on Fit

### Claude's Discretion
- Zoom signal architecture (keep local vs move to store for toolbar access)
- Pinch-to-zoom implementation details (gesture event handling)
- Fit-to-window calculation approach (resize observer, container measurement)
- Toolbar button styling for active/disabled states at zoom limits

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @preact/signals | ^2.8.1 | Reactive zoom/pan state | Already used for all app state (timelineStore, projectStore, uiStore) |
| tinykeys | ^3.0.0 | Keyboard shortcut registration | Already used in shortcuts.ts for all app shortcuts |
| Preact | ^10.28.4 | UI framework | Project framework |

### Supporting (built-in browser APIs)
| API | Purpose | When to Use |
|-----|---------|-------------|
| ResizeObserver | Container size tracking for fit-to-window | Observe canvas container, recalculate fit zoom |
| GestureEvent (Safari/WebKit) | macOS trackpad pinch-to-zoom | Already used in TimelineInteraction.ts |
| CSS transform: scale() translate() | Visual zoom/pan of preview container | Already used in CanvasArea.tsx line 100 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| canvasStore.ts | Preact context/provider | Store pattern is established in codebase; context would add provider wrapper complexity for no benefit |
| ResizeObserver | window resize event | ResizeObserver handles panel resizes (sidebar drag), not just window resize -- more accurate |

**Installation:**
No new dependencies required. All libraries are already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── stores/
│   └── canvasStore.ts          # NEW: zoom/pan signals + preset logic + fit calc
├── components/layout/
│   ├── CanvasArea.tsx           # MODIFY: import from canvasStore, add gesture handlers, ResizeObserver
│   └── Toolbar.tsx              # MODIFY: wire +/- buttons and % display to canvasStore
├── lib/
│   └── shortcuts.ts            # MODIFY: add Cmd+= Cmd+- Cmd+0 shortcuts
└── components/overlay/
    └── ShortcutsOverlay.tsx     # MODIFY: add zoom shortcuts to help display
```

### Pattern 1: Signal Store (follow timelineStore.ts pattern)
**What:** Module-scoped Preact signals exported as a store object with methods
**When to use:** When multiple components need read/write access to shared state
**Example:**
```typescript
// canvasStore.ts — follows exact pattern of timelineStore.ts
import {signal, computed} from '@preact/signals';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;

const ZOOM_PRESETS = [0.1, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0];

const zoom = signal(1);
const panX = signal(0);
const panY = signal(0);
const fitZoom = signal(1); // calculated fit-to-window zoom level

const zoomPercent = computed(() => Math.round(zoom.value * 100));

export const canvasStore = {
  zoom,
  panX,
  panY,
  fitZoom,
  zoomPercent,

  // Preset zoom: snap to next/prev preset stop
  zoomIn() { /* find next preset above current zoom */ },
  zoomOut() { /* find next preset below current zoom */ },

  // Smooth zoom: for wheel/pinch (no snapping)
  setSmoothZoom(newZoom: number, anchorX?: number, anchorY?: number) { /* ... */ },

  // Fit to window
  fitToWindow() { /* reset to fitZoom, center pan */ },

  // Update fit zoom level (called by ResizeObserver)
  updateFitZoom(containerW: number, containerH: number, canvasW: number, canvasH: number) { /* ... */ },
};
```

### Pattern 2: macOS Gesture Events (follow TimelineInteraction.ts)
**What:** `gesturestart`/`gesturechange` event listeners for trackpad pinch-to-zoom
**When to use:** Safari/WebKit (macOS) trackpad gestures
**Example:**
```typescript
// From TimelineInteraction.ts lines 567-600 — proven pattern in this codebase
// GestureEvent is Safari-only (WebKit). Since Tauri uses WKWebView on macOS, this works.
interface GestureEvent extends UIEvent {
  scale: number;
  rotation: number;
  clientX: number;
  clientY: number;
}

// Attach to the canvas container element:
container.addEventListener('gesturestart', (e) => { e.preventDefault(); });
container.addEventListener('gesturechange', (e) => {
  e.preventDefault();
  const ge = e as GestureEvent;
  // ge.scale is cumulative from gesturestart (1.0 = no change)
  // Use ge.clientX/clientY for cursor anchor point
});
```

### Pattern 3: ResizeObserver for Fit Calculation (follow TimelineCanvas.tsx)
**What:** ResizeObserver to track container dimensions for fit-to-window calculation
**When to use:** Whenever fit zoom needs to respond to window/panel resize
**Example:**
```typescript
// From TimelineCanvas.tsx lines 36-40 — proven pattern in this codebase
const resizeObserver = new ResizeObserver(() => {
  // Recalculate fit zoom based on container size vs project aspect ratio
  const rect = container.getBoundingClientRect();
  const padding = 32; // account for p-4 (16px each side)
  const availW = rect.width - padding;
  const availH = rect.height - padding;
  // Project is 1920x1080 (16:9), canvas div uses aspect-video + max-w-[830px]
  // Fit = scale where the full canvas content is visible in the container
  canvasStore.updateFitZoom(availW, availH, canvasW, canvasH);
});
resizeObserver.observe(containerEl);
```

### Pattern 4: tinykeys Keyboard Shortcuts (follow shortcuts.ts)
**What:** Global keyboard shortcuts via tinykeys
**When to use:** App-wide shortcuts registered in mountShortcuts()
**Example:**
```typescript
// tinykeys key syntax for zoom shortcuts:
// $mod = Cmd on macOS, Ctrl on Windows/Linux
// Equal = the =/+ key
// Minus = the -/_ key
// Digit0 = the 0 key
'$mod+Equal': (e) => { e.preventDefault(); canvasStore.zoomIn(); },
'$mod+Minus': (e) => { e.preventDefault(); canvasStore.zoomOut(); },
'$mod+Digit0': (e) => { e.preventDefault(); canvasStore.fitToWindow(); },
```

### Anti-Patterns to Avoid
- **Signal duplication:** Do NOT keep zoom signals in both canvasStore and CanvasArea -- single source of truth in canvasStore
- **Direct DOM measurement in store:** Do NOT put ResizeObserver in the store -- keep it in the component, call store.updateFitZoom() with measurements
- **Snapping smooth zoom to presets:** Wheel/pinch zoom must stay smooth; only toolbar/keyboard should snap to presets
- **Re-rendering Preview on zoom:** Zoom is a CSS transform on the container div, NOT a canvas re-render. Preview/PreviewRenderer must remain zoom-unaware

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Keyboard shortcuts | Custom keydown handlers | tinykeys (already installed, `$mod` handles Mac/Windows) | Cross-platform modifier handling, sequence support |
| Container resize tracking | window.onresize | ResizeObserver | Handles sidebar resize (panel drag), not just window resize |
| Pinch-to-zoom gesture | Pointer event math | Safari GestureEvent API (gesturestart/gesturechange) | Already proven in TimelineInteraction.ts; WKWebView guarantees Safari APIs |
| Preset stop finding | if/else chain | Simple array search (findIndex with comparison) | Clean, maintainable, easy to add/remove stops |

**Key insight:** This phase is primarily wiring -- connecting existing signals and UI elements. The zoom rendering (CSS transform), wheel zoom (handleWheel), and pan (pointer drag) already work. The new code is signal extraction, preset logic, gesture events, keyboard shortcuts, and fit calculation.

## Common Pitfalls

### Pitfall 1: Browser/Tauri Zoom Conflict with Cmd+= / Cmd+-
**What goes wrong:** Cmd+= and Cmd+- could trigger browser-level page zoom instead of canvas zoom
**Why it happens:** WebView zoom hotkeys can intercept before JS event handlers
**How to avoid:** Tauri v2 `zoomHotkeysEnabled` defaults to `false` (verified in schema.tauri.app), and this project has no override in tauri.conf.json. The shortcuts are free to use. Still call `e.preventDefault()` in the tinykeys handler.
**Warning signs:** Entire page zooms instead of just the canvas preview

### Pitfall 2: macOS Native Menu Intercepting Cmd+0
**What goes wrong:** Cmd+0 might be intercepted by the native macOS menu before reaching the webview
**Why it happens:** Same issue that affected Cmd+Z (documented in lib.rs lines 20-23). Native menu accelerators intercept before keydown reaches WKWebView.
**How to avoid:** The current native menu only has App, Edit submenus. Cmd+0 is NOT a native accelerator in the existing menu, so tinykeys will receive it. If issues arise, add a custom menu item with emit pattern (like undo/redo).
**Warning signs:** Cmd+0 shortcut doesn't fire; check if a macOS native menu item has claimed it

### Pitfall 3: Gesture Scale is Cumulative, Not Delta
**What goes wrong:** Pinch zoom jumps wildly or compounds incorrectly
**Why it happens:** `GestureEvent.scale` is cumulative from `gesturestart` (starts at 1.0), NOT a per-event delta. The timeline code handles this correctly by using `oldZoom * ge.scale` on each gesturechange.
**How to avoid:** Store the zoom level at gesturestart and multiply by ge.scale on each gesturechange. Or follow the TimelineInteraction pattern which peeks current zoom and multiplies.
**Warning signs:** Zoom accelerates exponentially during pinch, or jumps to extreme values

### Pitfall 4: Fit-to-Window Must Account for CSS Layout Constraints
**What goes wrong:** Fit zoom calculation is wrong because it doesn't account for max-width, padding, or aspect-ratio constraints
**Why it happens:** The canvas container has `max-w-[830px]` and the inner div uses `aspect-video` class. The actual rendered canvas size depends on the container flexbox layout.
**How to avoid:** Measure the ACTUAL container dimensions with `getBoundingClientRect()` inside the ResizeObserver callback. Calculate fit based on what the container can display, not theoretical maximums. The fit zoom should be the zoom level where scale(fitZoom) makes the canvas exactly fill the available space.
**Warning signs:** Fit zoom doesn't visually fill the window, or overflows

### Pitfall 5: Preset Stop Edge Cases
**What goes wrong:** At zoom limits (10% or 400%), clicking +/- has no effect but doesn't indicate it
**Why it happens:** No preset above 400% or below 10% exists
**How to avoid:** Clamp zoom to MIN/MAX, and consider styling +/- buttons as disabled at limits. When current zoom equals min preset, - button should be visually disabled; same for + at max.
**Warning signs:** User clicks button with no visible feedback

### Pitfall 6: Pan Offset Miscalculation After Zoom Center Change
**What goes wrong:** Canvas jumps position when switching between cursor-anchored zoom (wheel/pinch) and center-anchored zoom (buttons/keyboard)
**Why it happens:** Cursor-anchored zoom adjusts pan to keep point under cursor stable; center-anchored zoom should zoom around canvas center without changing the visual center point
**How to avoid:** For center-anchored zoom (buttons/keyboard), scale pan proportionally: `panX = panX * (newZoom / oldZoom)`, `panY = panY * (newZoom / oldZoom)`. This keeps the current center point stable.
**Warning signs:** Canvas shifts position when using +/- buttons after having panned with middle-click

### Pitfall 7: GestureEvent Centering on Pinch Edge
**What goes wrong:** Pinch-to-zoom near canvas edge causes canvas to drift off-screen
**Why it happens:** Cursor-anchored zoom near edges pushes content away from center
**How to avoid:** After applying gesture zoom, optionally clamp pan to keep canvas partially visible. The CONTEXT.md says "keep zoomed canvas centered in user's window" for pinch -- this may mean centering behavior rather than strict cursor-anchoring for pinch.
**Warning signs:** Canvas drifts entirely off-screen during aggressive edge pinching

## Code Examples

### Preset Stop Navigation
```typescript
// Source: Phase 9 CONTEXT.md decisions
const ZOOM_PRESETS = [0.1, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0];

function nextPresetUp(currentZoom: number): number {
  for (const p of ZOOM_PRESETS) {
    if (p > currentZoom + 0.001) return p; // epsilon to avoid float issues
  }
  return ZOOM_PRESETS[ZOOM_PRESETS.length - 1]; // already at max
}

function nextPresetDown(currentZoom: number): number {
  for (let i = ZOOM_PRESETS.length - 1; i >= 0; i--) {
    if (ZOOM_PRESETS[i] < currentZoom - 0.001) return ZOOM_PRESETS[i];
  }
  return ZOOM_PRESETS[0]; // already at min
}
```

### Fit-to-Window Calculation
```typescript
// Source: Derived from existing max-w-[830px] aspect-video pattern in CanvasArea.tsx
function calculateFitZoom(
  containerW: number,
  containerH: number,
  aspectRatio: number, // e.g., 16/9 from projectStore.aspectRatio
): number {
  // The canvas natural size is determined by container constraints:
  // - max-width: 830px with aspect-video (16:9)
  // - At zoom=1, the canvas fills available space up to 830px wide
  // Fit = zoom where the canvas exactly fits the container
  const canvasNaturalW = Math.min(containerW, 830);
  const canvasNaturalH = canvasNaturalW / aspectRatio;

  // If natural size already fits, fitZoom = 1
  // If container is smaller, fitZoom < 1
  // Scale to fit both dimensions:
  const scaleW = containerW / canvasNaturalW;
  const scaleH = containerH / canvasNaturalH;
  return Math.min(scaleW, scaleH, 1); // never zoom in beyond 1 for fit
}
```

### Center-Anchored Zoom (for buttons/keyboard)
```typescript
// Source: Derived from existing handleWheel cursor-anchored pattern in CanvasArea.tsx
function zoomCentered(newZoom: number) {
  const oldZoom = canvasStore.zoom.peek();
  const scale = newZoom / oldZoom;
  // Scale pan to keep center stable
  canvasStore.panX.value = canvasStore.panX.value * scale;
  canvasStore.panY.value = canvasStore.panY.value * scale;
  canvasStore.zoom.value = newZoom;
}
```

### Pinch-to-Zoom Handler (following TimelineInteraction.ts pattern)
```typescript
// Source: TimelineInteraction.ts lines 567-600
function onGestureChange(e: Event, container: HTMLElement) {
  e.preventDefault();
  const ge = e as GestureEvent;
  const rect = container.getBoundingClientRect();
  const cursorX = (ge.clientX ?? rect.left + rect.width / 2) - rect.left - rect.width / 2;
  const cursorY = (ge.clientY ?? rect.top + rect.height / 2) - rect.top - rect.height / 2;

  const oldZoom = canvasStore.zoom.peek();
  const newZoom = Math.max(0.1, Math.min(4, oldZoom * ge.scale));

  const scale = newZoom / oldZoom;
  canvasStore.panX.value = canvasStore.panX.value * scale + cursorX * (1 - scale) / newZoom;
  canvasStore.panY.value = canvasStore.panY.value * scale + cursorY * (1 - scale) / newZoom;
  canvasStore.zoom.value = newZoom;
}
```

### tinykeys Shortcut Registration
```typescript
// Source: tinykeys README key table — Equal = =/+ key, Minus = -/_ key, Digit0 = 0 key
// Add to existing mountShortcuts() in shortcuts.ts:
'$mod+Equal': (e: KeyboardEvent) => {
  if (shouldSuppressShortcut(e)) return;
  e.preventDefault();
  canvasStore.zoomIn();
},
'$mod+Minus': (e: KeyboardEvent) => {
  if (shouldSuppressShortcut(e)) return;
  e.preventDefault();
  canvasStore.zoomOut();
},
'$mod+Digit0': (e: KeyboardEvent) => {
  if (shouldSuppressShortcut(e)) return;
  e.preventDefault();
  canvasStore.fitToWindow();
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Module-local zoom signals in CanvasArea.tsx | Extract to canvasStore.ts | This phase | Enables toolbar + shortcuts access |
| handleFit resets to zoom=1 | True fit-to-window with ResizeObserver | This phase | Responsive zoom on window/panel resize |
| No pinch-to-zoom on canvas | GestureEvent handlers (matches timeline) | This phase | Consistent interaction model |
| Hardcoded "100%" in Toolbar.tsx | Reactive percent display from canvasStore | This phase | Accurate zoom display |

**Deprecated/outdated:**
- The current `handleFit` (CanvasArea.tsx line 80-84) just resets to zoom=1, pan=0. This will be replaced with a true fit calculation.
- The hardcoded `100%` text in Toolbar.tsx line 108 will be replaced with a reactive signal binding.

## Open Questions

1. **Canvas natural size at zoom=1**
   - What we know: Canvas container has `max-w-[830px]` with `aspect-video` class. At zoom=1, the CSS makes the canvas fill available space up to 830px.
   - What's unclear: Whether fit-to-window should use 830px as the "natural" canvas width or the full project resolution (1920x1080). Since zoom is a CSS transform on the container, "fit" should mean "scale the container so it exactly fits the viewport area."
   - Recommendation: Fit zoom = 1.0 when the canvas container already fits at natural size. Fit zoom < 1.0 when the window is too small for the container. This can be determined by comparing container `getBoundingClientRect()` with its parent's available space.

2. **Pinch-to-zoom centering vs cursor-anchoring**
   - What we know: CONTEXT.md says "keep zoomed canvas centered in user's window" for pinch, but also says gestures should be "cursor-anchored."
   - What's unclear: Whether pinch should be cursor-anchored (like wheel) or centered (like buttons). The CONTEXT specifics section clarifies: "even when the pinch gesture occurs near the edge."
   - Recommendation: Use cursor-anchored zoom for pinch (same as wheel), but after the gesture ends, consider a soft re-center animation. Start with pure cursor-anchored (matching wheel) and adjust if feedback requires.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected -- no test config files or test files in project |
| Config file | none -- see Wave 0 |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map

No formal requirement IDs were provided for this phase. The success criteria are:
1. Canvas zoom +/- buttons and percent display work
2. Zoom level persists during navigation and playback
3. User can reset zoom to fit-to-window

These are primarily UI interaction behaviors that are best validated through manual testing in the running application.

| Behavior | Test Type | Justification |
|----------|-----------|---------------|
| Preset stop navigation logic (nextPresetUp/Down) | unit | Pure function, testable |
| Fit-to-window calculation | unit | Pure function, testable |
| Toolbar +/- wiring | manual-only | Requires DOM interaction, Tauri webview |
| Keyboard shortcuts fire | manual-only | Requires tinykeys + DOM |
| Pinch-to-zoom | manual-only | Requires macOS trackpad hardware |
| Zoom persists during playback | manual-only | Requires playback engine |

### Wave 0 Gaps
- [ ] No test framework configured (vitest, jest, etc.) -- if unit tests are desired for preset logic and fit calculation, a test framework would need to be set up
- [ ] Pure zoom calculation functions are candidates for unit tests but infrastructure is missing

*(Decision: Since the project has zero test infrastructure and this phase's core logic is simple array lookups and arithmetic, manual validation is pragmatic. Unit tests for canvasStore pure functions could be added if a test framework is established.)*

## Sources

### Primary (HIGH confidence)
- CanvasArea.tsx -- existing zoom signals, wheel handler, pan handlers, CSS transform pattern (direct code inspection)
- Toolbar.tsx lines 108-114 -- stub +/- buttons and hardcoded "100%" display (direct code inspection)
- TimelineInteraction.ts lines 567-600 -- GestureEvent pinch-to-zoom pattern (direct code inspection)
- timelineStore.ts -- signal store pattern with setZoom() clamping (direct code inspection)
- shortcuts.ts -- tinykeys shortcut registration pattern with $mod and shouldSuppressShortcut (direct code inspection)
- tinykeys README.md (node_modules) -- key code reference table: Equal, Minus, Digit0 syntax (direct file)
- Tauri v2 config schema (schema.tauri.app/config/2) -- zoomHotkeysEnabled defaults to false

### Secondary (MEDIUM confidence)
- [Tauri v2 configuration reference](https://v2.tauri.app/reference/config/) -- webview zoom configuration
- [Tauri config schema](https://schema.tauri.app/config/2) -- zoomHotkeysEnabled default verification
- [tinykeys GitHub](https://github.com/jamiebuilds/tinykeys) -- key binding syntax documentation

### Tertiary (LOW confidence)
- None -- all findings verified against source code or official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and used in the project; no new dependencies
- Architecture: HIGH -- follows exact patterns (signal stores, gesture events, keyboard shortcuts, ResizeObserver) already proven in the codebase
- Pitfalls: HIGH -- verified Tauri zoom hotkey default, inspected native menu configuration, reviewed gesture event semantics from existing implementation

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable -- no moving dependencies, all patterns from existing codebase)
