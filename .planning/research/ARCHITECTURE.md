# Architecture Research

**Domain:** Desktop stop-motion cinematic video editor (Tauri 2.0 + Preact + Motion Canvas)
**Researched:** 2026-03-02
**Confidence:** MEDIUM-HIGH

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PREACT FRONTEND (WebView)                     │
│  ┌───────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │ Sequences │  │ Layers   │  │ Properties│  │ Toolbar/Dialogs  │  │
│  │ Panel     │  │ Panel    │  │ Panel     │  │                  │  │
│  └─────┬─────┘  └────┬─────┘  └─────┬─────┘  └────────┬─────────┘  │
│        │              │              │                  │            │
│  ┌─────┴──────────────┴──────────────┴──────────────────┴─────────┐  │
│  │                   SIGNAL STORE LAYER                            │  │
│  │  projectSignal  timelineSignal  layerSignal  uiSignal          │  │
│  └────────────────────────┬───────────────────────────────────────┘  │
│                           │                                          │
│  ┌────────────────────────┴───────────────────────────────────────┐  │
│  │                   CANVAS / PREVIEW AREA                         │  │
│  │  ┌──────────────────────┐  ┌────────────────────────────────┐  │  │
│  │  │ Timeline Canvas      │  │ Preview Canvas                 │  │  │
│  │  │ (Custom <canvas>)    │  │ (@efxlab/motion-canvas-player) │  │  │
│  │  └──────────────────────┘  └────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                           │                                          │
│  ┌────────────────────────┴───────────────────────────────────────┐  │
│  │                   IPC BRIDGE (invoke / events)                  │  │
│  └────────────────────────┬───────────────────────────────────────┘  │
├───────────────────────────┼──────────────────────────────────────────┤
│                    TAURI RUST BACKEND (Core Process)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐│
│  │ Project  │  │ File     │  │ Export   │  │ Audio                ││
│  │ Manager  │  │ System   │  │ Pipeline │  │ Analysis             ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────────┘│
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────────────┐  │
│  │ Config   │  │ Thumbnail│  │ Template Manager                 │  │
│  │ Store    │  │ Generator│  │                                  │  │
│  └──────────┘  └──────────┘  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Preact UI Shell** | All visual panels (sequences, layers, properties, toolbar), user interaction, keyboard shortcuts | Preact components + Tailwind v4, custom components |
| **Signal Store Layer** | Centralized reactive state for project, timeline, layers, UI state; drives all panel updates | Preact Signals (`signal()`, `computed()`, `effect()`) in module-scoped stores |
| **Preview Canvas** | Real-time composited preview of current frame with all layers and FX applied | `@efxlab/motion-canvas-player` web component embedded in Preact |
| **Timeline Canvas** | Frame-by-frame visualization, scrubbing, zoom, thumbnails, waveform, beat markers | Custom `<canvas>` element with imperative drawing |
| **IPC Bridge** | Type-safe communication between frontend and Rust backend | `@tauri-apps/api/core` invoke + events |
| **Project Manager (Rust)** | Create/open/save/auto-save .mce project files, manage working folder structure | Rust commands, serde JSON serialization |
| **File System (Rust)** | Image import, video copy to public/, asset management, drag-and-drop handling | Tauri fs plugin + custom commands for asset organization |
| **Export Pipeline (Rust)** | Coordinate PNG sequence export, manage output directory, write audio metadata | Rust orchestration calling Motion Canvas exporter via IPC Channel |
| **Audio Analysis (Rust)** | BPM detection, beat marker extraction, waveform data generation | Rust audio crate (e.g., `symphonia` for decoding, custom BPM analysis) |
| **Config Store (Rust)** | Global app config (~/.config/efx-mocap/), recent projects, first-launch state | Rust file I/O with serde, Tauri path resolver |
| **Thumbnail Generator (Rust)** | Generate 60x45px thumbnails on image import, cache in .thumbs/ | Rust `image` crate for fast resizing |
| **Template Manager (Rust)** | Save/load/import/export .mce-template files, manage global vs local templates | Rust file I/O, JSON serialization |

## Recommended Project Structure

```
efx-motion-editor/
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── lib.rs               # Tauri app setup, command registration
│   │   ├── commands/            # IPC command handlers
│   │   │   ├── mod.rs
│   │   │   ├── project.rs       # create, open, save, auto-save
│   │   │   ├── files.rs         # import images, copy videos, thumbnails
│   │   │   ├── export.rs        # PNG sequence export coordination
│   │   │   ├── audio.rs         # BPM detection, waveform data
│   │   │   ├── config.rs        # global config, recent projects
│   │   │   └── templates.rs     # template CRUD, import/export
│   │   ├── models/              # Shared Rust data types
│   │   │   ├── mod.rs
│   │   │   ├── project.rs       # Project, Sequence, KeyPhoto structs
│   │   │   ├── layer.rs         # Layer, BlendMode, RepeatMode
│   │   │   └── template.rs      # CompositionTemplate
│   │   ├── services/            # Business logic (non-IPC)
│   │   │   ├── thumbnail.rs     # Image resizing
│   │   │   ├── beat_detect.rs   # BPM analysis algorithm
│   │   │   └── folder.rs        # Working folder structure creation
│   │   └── error.rs             # Unified error types with thiserror
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                          # Preact frontend
│   ├── main.tsx                  # App entry, router (Welcome vs Main)
│   ├── App.tsx                   # Screen router
│   ├── screens/                  # Top-level screens
│   │   ├── WelcomeScreen.tsx     # First launch / project picker
│   │   ├── MainScreen.tsx        # Editor layout shell
│   │   ├── TemplateLibrary.tsx   # Template browser
│   │   └── ExportDialog.tsx      # Export configuration
│   ├── components/               # Reusable UI components
│   │   ├── ui/                   # Generic (Button, Slider, Modal, Select)
│   │   ├── panels/               # Editor panels
│   │   │   ├── SequencePanel.tsx
│   │   │   ├── LayerPanel.tsx
│   │   │   ├── PropertiesPanel.tsx
│   │   │   └── Toolbar.tsx
│   │   ├── timeline/             # Timeline-specific components
│   │   │   ├── Timeline.tsx      # Timeline container
│   │   │   ├── TimelineCanvas.tsx # <canvas> rendering
│   │   │   ├── TimeRuler.tsx
│   │   │   ├── TrackRow.tsx
│   │   │   └── Playhead.tsx
│   │   └── preview/              # Preview area
│   │       ├── PreviewCanvas.tsx  # Motion Canvas player wrapper
│   │       └── PreviewControls.tsx
│   ├── stores/                   # Preact Signal stores
│   │   ├── project.ts            # Project-level state (name, fps, path)
│   │   ├── sequences.ts          # Sequence list, active sequence
│   │   ├── layers.ts             # Layer stack, selected layer
│   │   ├── timeline.ts           # Playhead position, zoom, scroll
│   │   ├── ui.ts                 # Panel sizes, modals, selection state
│   │   └── history.ts            # Undo/redo stack
│   ├── ipc/                      # Tauri IPC wrappers
│   │   ├── project.ts            # invoke wrappers for project commands
│   │   ├── files.ts              # invoke wrappers for file operations
│   │   ├── export.ts             # invoke wrappers for export
│   │   ├── audio.ts              # invoke wrappers for audio analysis
│   │   └── config.ts             # invoke wrappers for config
│   ├── hooks/                    # Custom Preact hooks
│   │   ├── useKeyboard.ts        # Global keyboard shortcut handler
│   │   ├── useDragDrop.ts        # Drag-and-drop logic
│   │   ├── usePlayback.ts        # Play/pause/scrub logic
│   │   └── useAutoSave.ts        # Auto-save timer
│   ├── types/                    # TypeScript types (mirror Rust models)
│   │   ├── project.ts
│   │   ├── layer.ts
│   │   └── template.ts
│   ├── utils/                    # Pure utility functions
│   │   ├── frame-math.ts         # FPS/duration/frame calculations
│   │   ├── blend-modes.ts        # Blend mode definitions
│   │   └── color.ts
│   └── index.css                 # Tailwind v4 entry + CSS variables
├── public/                       # Static assets for Motion Canvas runtime
│   └── videos/                   # Video files (symlinked/copied from assets)
├── package.json
├── pnpm-lock.yaml
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

### Structure Rationale

- **src-tauri/commands/:** One file per domain keeps Rust IPC handlers organized and testable. Each module registers its own commands.
- **src-tauri/models/:** Shared data types with `#[derive(Serialize, Deserialize)]` ensure type parity between Rust structs and TypeScript interfaces.
- **src/stores/:** Module-scoped Preact Signals (not context-based) for maximum performance. Each store is a self-contained module with exported signals and actions.
- **src/ipc/:** Thin wrappers around `invoke()` calls that handle serialization and error mapping. Keeps Tauri API usage isolated from UI components.
- **src/components/panels/ vs timeline/ vs preview/:** Separates the three distinct rendering paradigms: DOM panels (Preact), canvas-based timeline (imperative), and Motion Canvas player (web component).

## Architectural Patterns

### Pattern 1: Module-Scoped Signal Stores

**What:** Define Preact Signals at module scope (not in components or context). Export signals directly for reads, export action functions for writes.
**When to use:** All application state. This is the primary state management pattern.
**Trade-offs:** Extremely fast (no context re-renders, fine-grained updates), but signals are singletons -- fine for a desktop app with one project open, not suitable if multiple instances needed.

**Example:**
```typescript
// stores/sequences.ts
import { signal, computed } from '@preact/signals';
import type { Sequence } from '../types/project';

// State
export const sequences = signal<Sequence[]>([]);
export const activeSequenceId = signal<string | null>(null);

// Derived
export const activeSequence = computed(() =>
  sequences.value.find(s => s.id === activeSequenceId.value) ?? null
);

export const totalDuration = computed(() =>
  sequences.value.reduce((sum, s) => sum + s.duration, 0)
);

// Actions (mutate signals, push to history)
export function addSequence(seq: Sequence) {
  pushHistory(); // capture before mutation
  sequences.value = [...sequences.value, seq];
}

export function reorderSequences(fromIndex: number, toIndex: number) {
  pushHistory();
  const arr = [...sequences.value];
  const [moved] = arr.splice(fromIndex, 1);
  arr.splice(toIndex, 0, moved);
  sequences.value = arr;
}
```

### Pattern 2: Command-Based IPC with Typed Wrappers

**What:** Every Rust backend operation is a Tauri command. The frontend never touches the file system directly -- all file I/O goes through Rust commands. TypeScript wrapper functions in `src/ipc/` provide type safety.
**When to use:** Any operation involving file system, heavy computation, or native APIs.
**Trade-offs:** Adds a serialization boundary (JSON round-trip), but provides security, type safety, and keeps heavy work off the UI thread. Use Tauri Channels for large data (thumbnails, waveforms).

**Example:**
```typescript
// ipc/project.ts
import { invoke } from '@tauri-apps/api/core';
import type { ProjectData } from '../types/project';

export async function saveProject(data: ProjectData): Promise<void> {
  await invoke('save_project', { data });
}

export async function openProject(path: string): Promise<ProjectData> {
  return invoke<ProjectData>('open_project', { path });
}
```

```rust
// src-tauri/src/commands/project.rs
use serde::{Deserialize, Serialize};
use crate::models::project::ProjectData;

#[tauri::command]
pub async fn save_project(data: ProjectData) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| e.to_string())?;
    std::fs::write(&data.path, json)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn open_project(path: String) -> Result<ProjectData, String> {
    let content = std::fs::read_to_string(&path)
        .map_err(|e| e.to_string())?;
    serde_json::from_str(&content)
        .map_err(|e| e.to_string())
}
```

### Pattern 3: Snapshot-Based Undo/Redo

**What:** Before each mutation, snapshot the affected signal's value onto an undo stack. Undo restores the previous snapshot. Redo replays the forward stack.
**When to use:** All user-visible mutations (add/remove/reorder sequences, layer changes, property edits).
**Trade-offs:** Simple to implement and reason about. Memory cost is proportional to edit history depth -- cap at ~100 entries and serialize to JSON for compact storage. For a stop-motion editor with small project state, this is efficient.

**Example:**
```typescript
// stores/history.ts
import { signal } from '@preact/signals';

interface Snapshot {
  sequences: string;  // JSON-serialized
  layers: string;
  label: string;
}

const undoStack = signal<Snapshot[]>([]);
const redoStack = signal<Snapshot[]>([]);
const MAX_HISTORY = 100;

export function pushHistory(label: string = 'edit') {
  const snap: Snapshot = {
    sequences: JSON.stringify(sequences.value),
    layers: JSON.stringify(layers.value),
    label,
  };
  undoStack.value = [...undoStack.value.slice(-MAX_HISTORY), snap];
  redoStack.value = []; // clear forward history
}

export function undo() {
  if (undoStack.value.length === 0) return;
  // Push current state to redo
  redoStack.value = [...redoStack.value, captureCurrentSnapshot()];
  // Restore previous
  const prev = undoStack.value[undoStack.value.length - 1];
  undoStack.value = undoStack.value.slice(0, -1);
  restoreSnapshot(prev);
}
```

### Pattern 4: Motion Canvas Player as Managed Web Component

**What:** Embed `@efxlab/motion-canvas-player` as a web component in the preview area. The Preact wrapper feeds it a scene description derived from current signal state. The player handles all WebGL/Canvas rendering internally.
**When to use:** Preview playback and frame composition.
**Trade-offs:** The player owns its own rendering loop -- Preact does not control individual frame draws. Communication is one-directional: Preact pushes scene configuration, player renders. This clean boundary avoids mixing DOM and canvas rendering concerns.

**Example:**
```typescript
// components/preview/PreviewCanvas.tsx
import { useEffect, useRef } from 'preact/hooks';
import { useSignalEffect } from '@preact/signals';
import { activeSequence } from '../../stores/sequences';
import { layers } from '../../stores/layers';
import { playheadFrame } from '../../stores/timeline';

export function PreviewCanvas() {
  const playerRef = useRef<HTMLElement>(null);

  // Rebuild scene when data changes
  useSignalEffect(() => {
    const seq = activeSequence.value;
    const layerStack = layers.value;
    const frame = playheadFrame.value;
    if (!playerRef.current || !seq) return;

    // Update Motion Canvas player with current composition
    updatePlayerScene(playerRef.current, seq, layerStack, frame);
  });

  return (
    <div class="flex-1 bg-black flex items-center justify-center">
      <motion-canvas-player
        ref={playerRef}
        width={1920}
        height={1080}
      />
    </div>
  );
}
```

## Data Flow

### Primary Data Flow: User Edit

```
[User Action] (click, drag, keyboard)
    |
    v
[Preact Component] captures event
    |
    v
[Store Action] (e.g., addSequence, updateLayerOpacity)
    |
    +--> [pushHistory()] saves snapshot to undo stack
    |
    v
[Signal Mutation] (sequences.value = [...])
    |
    +-------> [Computed Signals] auto-update (totalDuration, activeSequence)
    |              |
    |              v
    |         [UI Panels] re-render (only affected DOM nodes)
    |
    +-------> [Preview Canvas] scene rebuilt via useSignalEffect
    |              |
    |              v
    |         [Motion Canvas Player] re-renders frame
    |
    +-------> [Timeline Canvas] redraws via useSignalEffect
                   |
                   v
              [requestAnimationFrame] imperative canvas draw
```

### File Operation Flow: Import Images

```
[User drops images / clicks Import]
    |
    v
[Preact: onDrop handler]
    |
    v
[IPC: invoke('import_images', { paths, sequenceId })]
    |
    v
[Rust: import_images command]
    |
    +--> Copy images to project assets/images/sequence-N/
    +--> Generate thumbnails (60x45px) to assets/.thumbs/
    +--> Return ImportResult { keyPhotos, thumbnailPaths }
    |
    v
[Frontend: update stores]
    |
    +--> sequences.value updated with new KeyPhoto entries
    +--> Timeline and preview auto-update via signals
```

### Export Flow: PNG Sequence

```
[User clicks Export, configures settings]
    |
    v
[IPC: invoke('start_export', { config })]
    |
    v
[Rust: start_export command]
    |
    +--> Create output directory (output/export-YYYY-MM-DD/)
    +--> Send 'export-started' event to frontend
    |
    v
[Frontend: receives event, shows progress UI]
    |
    v
[Motion Canvas Rendering Loop (frontend)]
    |
    +--> For each frame:
    |      1. Set playhead to frame N
    |      2. Motion Canvas renders composited frame to canvas
    |      3. Canvas.toBlob() or toDataURL() -> raw PNG bytes
    |      4. IPC Channel: send bytes to Rust
    |      5. Rust: write frame_NNNN.png to disk
    |
    +--> Rust emits 'export-progress' event (frame N of total)
    +--> Frontend updates progress bar via event listener
    |
    v
[Rust: write audio metadata text file]
    |
    v
[Rust: emit 'export-complete' event]
    |
    v
[Frontend: show completion dialog, reveal in Finder option]
```

### Playback Flow

```
[User clicks Play]
    |
    v
[usePlayback hook: start interval/rAF at target FPS]
    |
    +--> Each tick:
    |      playheadFrame.value += 1
    |          |
    |          +--> Preview Canvas: renders frame via Motion Canvas
    |          +--> Timeline Canvas: moves playhead indicator
    |          +--> Properties Panel: updates timecode display
    |
    +--> Audio: Web Audio API plays synced audio track
    |
    v
[User clicks Pause / reaches end]
    |
    v
[Stop interval, hold playhead position]
```

### Key Data Flows Summary

1. **User edit -> Signal mutation -> Multi-panel reactive update:** The core loop. Signals ensure only affected DOM/canvas updates.
2. **File I/O -> Rust command -> Signal update:** All disk operations go through Rust for security and performance.
3. **Export -> Frame-by-frame render -> IPC Channel -> Rust disk write:** Heavy rendering stays in WebView, heavy I/O stays in Rust.
4. **Playback -> Frame tick -> Signal update -> Player + Timeline sync:** Playback is frontend-driven via requestAnimationFrame or setInterval at target FPS.

## Rust Backend vs Frontend: Responsibility Split

| Responsibility | Owner | Rationale |
|----------------|-------|-----------|
| UI rendering (panels, dialogs) | Frontend | DOM + Tailwind, reactive via Signals |
| Canvas preview rendering | Frontend | Motion Canvas runs in WebView (WebGL/Canvas2D) |
| Timeline rendering | Frontend | Custom `<canvas>` with imperative drawing |
| Audio playback | Frontend | Web Audio API, synced with playhead signal |
| Waveform rendering | Frontend | Canvas drawing from pre-computed data |
| Project file read/write | Rust | File I/O, JSON serialization, auto-save timer |
| Image import + organization | Rust | Copy files, create folder structure, validate |
| Thumbnail generation | Rust | Fast image resizing via `image` crate |
| BPM / beat detection | Rust | CPU-intensive audio analysis |
| Export frame writing | Rust | Sequential PNG writes, progress tracking |
| Global config management | Rust | ~/.config/efx-mocap/ read/write |
| Template file management | Rust | .mce-template read/write/import/export |
| Native dialogs (open/save) | Rust | Tauri dialog plugin for macOS native pickers |
| Keyboard shortcut registration | Frontend | Preact event handlers + useKeyboard hook |
| Drag and drop handling | Frontend | HTML5 drag events, invoke Rust for file copy |

**Guiding principle:** The frontend owns everything visible and interactive. Rust owns everything that touches disk, performs heavy computation, or requires native platform APIs. The IPC boundary is the file system and CPU-intensive operations.

## Anti-Patterns

### Anti-Pattern 1: Storing File Paths in Signal State Without Rust Validation

**What people do:** Accept drag-and-drop file paths directly into signal stores and reference them for rendering.
**Why it's wrong:** Tauri's security model requires file access to go through scoped permissions. Direct path usage can break on special characters, permissions, or when files move. Thumbnails become stale references.
**Do this instead:** Always import through a Rust command that copies files into the project's asset directory and returns the normalized project-relative path. Store only project-relative paths in state.

### Anti-Pattern 2: Putting Rendering Logic in Signals/Stores

**What people do:** Put Motion Canvas scene building or canvas drawing code inside `computed()` or `effect()` calls in store files.
**Why it's wrong:** Stores should be pure data. Rendering is a side effect that belongs in components. Mixing them makes testing impossible and creates circular dependencies between stores and rendering libraries.
**Do this instead:** Stores export data signals. Components use `useSignalEffect()` to bridge data into rendering APIs (Motion Canvas player, canvas draw calls).

### Anti-Pattern 3: Using Tauri Events for Request-Response Communication

**What people do:** Emit an event from frontend, listen for a response event from Rust, correlating them with IDs.
**Why it's wrong:** Tauri events are fire-and-forget by design. Using them for request-response creates fragile correlation logic, no type safety on responses, and race conditions.
**Do this instead:** Use `invoke()` (commands) for request-response. Use events only for backend-initiated notifications (export progress, auto-save status, file watcher changes).

### Anti-Pattern 4: Single Monolithic Signal for All State

**What people do:** Create one giant `appState` signal containing project, sequences, layers, timeline, and UI state.
**Why it's wrong:** Any mutation triggers every subscriber. Preact Signals' performance advantage comes from fine-grained reactivity -- coarse signals defeat this entirely. A timeline scrub would re-render the properties panel, layer list, and toolbar.
**Do this instead:** Separate signals per domain (project, sequences, layers, timeline, ui). Use `computed()` to derive cross-domain values. Components subscribe only to the signals they display.

### Anti-Pattern 5: Running Export Entirely in Rust

**What people do:** Try to render frames in Rust using a headless browser or canvas library.
**Why it's wrong:** Motion Canvas is a JavaScript/TypeScript framework that renders via WebGL/Canvas2D in the browser. There is no Rust equivalent. You cannot replicate its rendering outside the WebView.
**Do this instead:** Render each frame in the WebView using Motion Canvas, capture the canvas output as PNG bytes, and stream those bytes to Rust via IPC Channel for disk writing. The rendering happens in the frontend; the I/O happens in the backend.

## Scaling Considerations

This is a single-user desktop application, so scaling is about project complexity, not user count.

| Concern | Small project (50 frames) | Medium project (500 frames) | Large project (5000+ frames) |
|---------|--------------------------|----------------------------|------------------------------|
| Signal updates | No concern | No concern | Batch mutations, avoid per-frame signal updates during playback |
| Thumbnail loading | Load all | Load all | Lazy load visible thumbnails in timeline viewport |
| Timeline rendering | Simple canvas draw | Virtualize visible region | Must virtualize; only draw visible frames + buffer |
| Export time | ~5 seconds | ~1 minute | ~10+ minutes; progress UI and cancellation essential |
| Project file size | <100KB JSON | ~500KB JSON | 2-5MB JSON; consider splitting sequences into separate files |
| Memory (images) | <50MB | ~200MB | Thumbnail-only in memory; load full images on demand for preview |

### Scaling Priorities

1. **First bottleneck: Timeline rendering at high frame counts.** A 5000-frame timeline drawn naively on canvas will stutter during scroll/zoom. Virtualize early -- only render frames visible in the viewport plus a small buffer. This should be built into the timeline from the start, not retrofitted.
2. **Second bottleneck: Export duration for large projects.** Export is inherently sequential (frame-by-frame render + write). Provide cancellation, accurate progress, and consider allowing the user to export frame ranges rather than the entire project.

## Integration Points

### Motion Canvas Integration

| Aspect | Pattern | Notes |
|--------|---------|-------|
| Player embedding | `<motion-canvas-player>` custom element in Preact JSX | Set width/height/src attributes; player manages its own render loop |
| Scene description | Build scene graph programmatically from signal state | Translate layer stack + sequence data into Motion Canvas nodes |
| Frame-by-frame export | Drive player to specific frame, capture canvas output | Use player API to seek to frame, then read canvas pixels |
| Vite plugin | `@efxlab/motion-canvas-vite-plugin` in vite.config.ts | Handles HMR and scene resolution during development |
| FX rendering | Motion Canvas nodes for blend modes, transforms, video playback | Layer properties (opacity, blend, transform) map to Motion Canvas node properties |

### Tauri Plugin Usage

| Plugin | Purpose | Notes |
|--------|---------|-------|
| `@tauri-apps/plugin-dialog` | Native macOS file/folder pickers | Open project, import images, select export folder |
| `@tauri-apps/plugin-fs` | File system access from frontend (limited use) | Prefer Rust commands for file I/O; use plugin only for scope expansion via dialog |
| `@tauri-apps/plugin-shell` | Open exported folder in Finder | `open` command to reveal export directory |
| `@tauri-apps/plugin-process` | App lifecycle (quit confirmation) | Prompt save on close if unsaved changes |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Preact panels <-> Signal stores | Direct signal read/write | Components import signals directly from store modules |
| Signal stores <-> IPC layer | Actions call async IPC functions, update signals on response | Keep await/error handling in store actions, not components |
| Frontend <-> Rust backend | `invoke()` for commands, Tauri events for notifications, Channels for streaming | JSON serialization for small payloads, raw bytes via Channel for images/frames |
| Timeline canvas <-> Signal stores | `useSignalEffect` bridges signals to imperative canvas draws | Canvas redraws on signal change, not on Preact re-render |
| Motion Canvas player <-> Signal stores | `useSignalEffect` updates player scene configuration | Player re-renders internally when its scene input changes |

## Build Order Implications

Based on dependency analysis, the recommended build order is:

1. **Tauri + Preact scaffold with IPC bridge** -- Everything depends on this foundation. Set up the Tauri 2.0 project with Preact, Vite, Tailwind v4. Verify basic `invoke()` works. Build the `ipc/` wrapper layer and Rust command skeleton.

2. **Signal stores + Project management** -- The data model must exist before any UI can be functional. Define TypeScript types mirroring Rust models. Build project signal stores. Implement Rust project create/open/save commands. Prove the round-trip: create project in Rust -> load into signals -> display in UI.

3. **UI Shell (panels layout)** -- Convert the existing React prototype to Preact. This is primarily a visual shell with panels wired to signal stores. Does not need working preview or timeline yet -- placeholder areas are fine.

4. **Image import + Sequence management** -- First real functionality. Import images through Rust, update sequence signals, display in sequence panel. Thumbnail generation in Rust.

5. **Timeline (canvas-based)** -- Depends on sequences and layers existing in signal stores. Build with viewport virtualization from the start. Frame visualization, scrubbing, playhead.

6. **Motion Canvas preview integration** -- Embed the player, connect it to the current sequence + layer state. This is where the app becomes visually useful -- you can see composited frames.

7. **Layer system** -- Add FX layers (static image, image sequence, video). Properties panel for transforms, blend modes, opacity. Layers render in the Motion Canvas preview.

8. **Audio + Beat sync** -- Import audio, waveform visualization in timeline, BPM detection in Rust, beat markers, snap-to-beat.

9. **Export pipeline** -- Frame-by-frame render via Motion Canvas, stream to Rust via IPC Channel, write PNGs. Progress UI.

10. **Templates + Polish** -- Composition templates, undo/redo refinement, keyboard shortcuts, auto-save, edge cases.

**Critical path:** Steps 1-3 are pure infrastructure. Step 4 is the first user-visible feature. Step 6 is where the product becomes demonstrable. Steps 7-9 complete the core workflow.

## Sources

- [Tauri 2.0 Inter-Process Communication](https://v2.tauri.app/concept/inter-process-communication/) -- HIGH confidence
- [Tauri 2.0 Calling Rust from Frontend](https://v2.tauri.app/develop/calling-rust/) -- HIGH confidence
- [Tauri 2.0 Architecture Concepts](https://v2.tauri.app/concept/architecture/) -- HIGH confidence
- [Tauri 2.0 File System Plugin](https://v2.tauri.app/plugin/file-system/) -- HIGH confidence
- [Preact Signals Guide](https://preactjs.com/guide/v10/signals/) -- HIGH confidence
- [Motion Canvas Architecture (DeepWiki)](https://deepwiki.com/motion-canvas/motion-canvas) -- MEDIUM confidence
- [Motion Canvas Rendering Docs](https://motioncanvas.io/docs/rendering/) -- HIGH confidence
- [TauRPC Type-Safe IPC](https://github.com/MatsDK/TauRPC) -- MEDIUM confidence (considered but not recommended for v1 -- adds dependency complexity)
- [Tauri 2.0 Stable Release](https://v2.tauri.app/blog/tauri-20/) -- HIGH confidence (raw request / Channel support)

---
*Architecture research for: EFX-Motion Editor (stop-motion cinematic video editor)*
*Researched: 2026-03-02*
