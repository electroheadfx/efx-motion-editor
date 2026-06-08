# Architecture Research

**Domain:** Standalone physics paint app/demo architecture for `packages/efx-physic-paint` in the EFX Motion Editor pnpm monorepo
**Researched:** 2026-06-08
**Confidence:** HIGH for repo-local architecture and build order; MEDIUM for future transport details because transport is deliberately deferred and should be validated in its own integration phase.

## Standard Architecture

### System Overview

The standalone physics paint milestone should make `@efxlab/efx-physic-paint` runnable as its own browser app/demo inside the existing workspace package, while preserving the library as a publishable package. The key architectural correction from the failed v0.7.0 phases is: **do not make EFX Motion Editor drive physics paint through a headless/batch adapter.** The engine must remain interactive and incremental; the editor should later launch/embed a standalone paint surface and consume exported/cached stills or frame sequences via a narrow transport seam.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         pnpm workspace root                                 │
│  package.json                                                               │
│    dev                 → pnpm --filter efx-motion-editor dev                │
│    build               → package build, then editor build                   │
│    dev:paint           → should run the standalone paint demo/app           │
│  pnpm-workspace.yaml    → app + packages/*                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              packages/efx-physic-paint                                      │
│                                                                             │
│  Library surface                                                             │
│    src/index.ts       → EfxPaintEngine + types                               │
│    src/preact.tsx     → EfxPaintCanvas wrapper                               │
│    src/animation/*    → AnimationPlayer frame replay                         │
│    tsup.config.ts     → publishable ESM outputs                              │
│                                                                             │
│  Standalone demo/app surface                                                 │
│    demo/index.html    → Vite browser entry                                   │
│    demo/src/App.tsx   → controls, canvas, export panel, diagnostics          │
│    demo/src/main.tsx  → Preact mount                                         │
│    vite.demo.config.ts → app-only Vite config                                │
│                                                                             │
│  Future integration seams                                                    │
│    src/session/*      → serializable session/project model                   │
│    src/export/*       → still/sequence capture contracts                     │
│    src/transport/*    → message protocol types only in this milestone        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ future milestone, not this one
┌─────────────────────────────────────────────────────────────────────────────┐
│                          app/ EFX Motion Editor                              │
│                                                                             │
│  Physical paint layer stores only:                                           │
│    session id/path, cached frame paths, dimensions, fps, dirty range,         │
│    thumbnail/still metadata                                                  │
│                                                                             │
│  Editor compositor consumes cached images with existing drawImage pattern.   │
│  It does not replay physics strokes or run renderFromStrokes in-process.     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `EfxPaintEngine` | Own the incremental paint simulation, typed-array buffers, dual canvases, pointer input, physics/drying intervals, stroke recording, serialization. | Keep as the interactive facade in `src/engine/EfxPaintEngine.ts`; add small event/capture hooks rather than changing it into a headless renderer. |
| `EfxPaintCanvas` | Thin Preact wrapper around engine lifecycle. | Keep `src/preact.tsx`; expand props only for callbacks and initial session/config, not editor-specific concepts. |
| Standalone demo app | Provide a runnable UI for testing tools, brush controls, physics, save/load, still export, and sequence export. | Add a Vite/Preact demo entry inside the package, separate from `tsup` library build. |
| Session model | Define what a physics-paint document is independent of the demo UI. | Versioned JSON envelope around `SerializedProject`, engine settings, dimensions, fps/range metadata, and export metadata. |
| Export/capture seam | Produce stills and frame sequences that future editor integration can cache. | Functions that capture `engine.getDisplayCanvas()`/`getCanvas()` to PNG/blob/data URL and drive `AnimationPlayer` for frame sequences. |
| Transport protocol seam | Define messages/events for later editor ↔ standalone window communication. | Type-only module in this milestone; no Tauri window wiring yet unless needed for a manual spike. |
| EFX Motion Editor future consumer | Store references to rendered outputs and composite cached frames. | Later: physical paint layer sidecar with session path + cache manifest; compositor uses existing image/cache draw path. |

## Recommended Project Structure

Recommended structure keeps the package publishable while adding a first-class demo app. It avoids creating another workspace package unless the demo grows into a large product; co-locating the demo with the package is better for this milestone because it shortens feedback loops and keeps API drift visible.

```
packages/efx-physic-paint/
├── package.json                         # MODIFY: add standalone demo scripts/deps
├── tsup.config.ts                       # MODIFY only if new public entrypoints are exported
├── tsconfig.json                        # MODIFY: include demo if needed or add separate demo tsconfig
├── vite.demo.config.ts                  # NEW: Vite config for package-local demo app
├── demo/                                # NEW: runnable/testable standalone app
│   ├── index.html                       # NEW: Vite HTML entry
│   ├── src/
│   │   ├── main.tsx                     # NEW: Preact render entry
│   │   ├── App.tsx                      # NEW: demo shell/layout
│   │   ├── components/
│   │   │   ├── PaintSurface.tsx         # NEW: EfxPaintCanvas host + engine ref
│   │   │   ├── BrushControls.tsx        # NEW: tool/brush/physics controls
│   │   │   ├── ExportPanel.tsx          # NEW: still/sequence export UI
│   │   │   ├── SessionPanel.tsx         # NEW: save/load JSON UI
│   │   │   └── DiagnosticsPanel.tsx     # NEW: fps, dimensions, stroke count, state
│   │   ├── state/
│   │   │   └── demoState.ts             # NEW: Preact signals for demo-only UI state
│   │   └── styles.css                   # NEW: package-local demo styling
│   └── public/
│       └── papers/                      # NEW: bundled paper texture fixtures for demo
├── src/
│   ├── index.ts                         # MODIFY: export session/export types if public
│   ├── preact.tsx                       # MODIFY: optional lifecycle/event props only
│   ├── types.ts                         # MODIFY: add stable exported session/capture types if core
│   ├── animation/
│   │   ├── AnimationPlayer.ts           # MODIFY: support frame capture hooks if needed
│   │   └── index.ts                     # MODIFY: export animation helpers/types
│   ├── engine/
│   │   └── EfxPaintEngine.ts            # MODIFY: expose minimal capture/state hooks; avoid headless rewrite
│   ├── session/
│   │   ├── types.ts                     # NEW: `PhysicPaintSession`, manifests, version constants
│   │   ├── serialize.ts                 # NEW: normalize save/load envelopes
│   │   └── index.ts                     # NEW: public session exports
│   ├── export/
│   │   ├── capture.ts                   # NEW: still capture from live engine canvases
│   │   ├── sequence.ts                  # NEW: AnimationPlayer-driven sequence capture helpers
│   │   └── index.ts                     # NEW: public export helpers
│   └── transport/
│       ├── protocol.ts                  # NEW: future message types, no runtime coupling
│       └── index.ts                     # NEW: public protocol type exports
└── dist/                                # generated by tsup; do not edit manually
```

### Structure Rationale

- **`demo/` inside `packages/efx-physic-paint`:** The package currently has library code but no Vite app entry. A package-local demo lets `pnpm --filter @efxlab/efx-physic-paint dev` run the actual engine directly without touching `app/` or Tauri.
- **Separate `vite.demo.config.ts` from `tsup.config.ts`:** `tsup` should continue building publishable ESM library entrypoints (`index`, `preact`, `animation`). Vite should serve only the demo app.
- **`src/session/`:** The future editor needs a stable serialized unit to save and reopen a standalone physics paint session. This should be independent from demo UI state.
- **`src/export/`:** Still/sequence output is a core capability, not demo-only. Keep canvas capture reusable by future Tauri/window transport.
- **`src/transport/`:** Define the future protocol early as TypeScript types so the demo can shape its export/cached-frame concepts without prematurely wiring editor windows.
- **No `app/` changes in the first half of the milestone:** The milestone's value is proving the standalone engine/window. Editor changes should be limited to later seam documentation or an optional no-op type import validation.

## Architectural Patterns

### Pattern 1: Standalone Interactive Engine Host

**What:** The demo creates an actual `EfxPaintEngine` through `EfxPaintCanvas`, lets it own pointer events, render loop, dry/wet canvases, physics intervals, and stroke capture, and exposes controls through public engine methods.

**When to use:** For all v0.8.0 physics paint validation: brush behavior, local physics, drying, paper texture interaction, pressure input, sequence capture.

**Trade-offs:**
- Pro: Preserves the interactive incremental behavior that the failed adapter/batch approach lost.
- Pro: Matches how users will actually paint in a separate window later.
- Pro: Surfaces engine lifecycle, texture loading, pointer, and performance issues immediately.
- Con: Future editor integration must communicate through files/messages/cache rather than direct function calls.

**Example:**
```typescript
import { signal } from '@preact/signals'
import { EfxPaintCanvas } from '@efxlab/efx-physic-paint/preact'
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint'

const engineRef = signal<EfxPaintEngine | null>(null)

export function PaintSurface() {
  return (
    <EfxPaintCanvas
      width={1280}
      height={720}
      papers={[{ name: 'canvas1', url: '/papers/canvas1.jpg' }]}
      defaultPaper="canvas1"
      onEngineReady={(engine) => {
        engineRef.value = engine
        engine.setBgMode('transparent')
        engine.setTool('paint')
      }}
    />
  )
}
```

### Pattern 2: Canvas Capture from the Live Engine

**What:** Export reads pixels from the engine's existing canvases after the simulation has reached the desired visual state. It does not reconstruct the image from strokes in a separate headless code path.

**When to use:** Save stills, generate thumbnails, capture frame sequences for future editor caches.

**Trade-offs:**
- Pro: Captured output is exactly what the user sees in the standalone window.
- Pro: Avoids duplicate renderer drift.
- Con: Export must coordinate with animation/physics timing and wait for frame completion before capture.

**Example:**
```typescript
export interface StillCaptureOptions {
  source?: 'display' | 'dry'
  mimeType?: 'image/png' | 'image/webp'
  quality?: number
}

export async function captureStill(
  engine: EfxPaintEngine,
  options: StillCaptureOptions = {},
): Promise<Blob> {
  const canvas = options.source === 'dry' ? engine.getCanvas() : engine.getDisplayCanvas()
  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Canvas capture failed')),
      options.mimeType ?? 'image/png',
      options.quality,
    )
  })
}
```

### Pattern 3: Versioned Session Envelope

**What:** Wrap the existing `SerializedProject` in a session format that includes metadata needed by a standalone window and by future editor cache integration.

**When to use:** Demo save/load; future editor handoff to standalone paint; cache invalidation.

**Trade-offs:**
- Pro: Keeps engine serialization stable while allowing integration metadata to evolve.
- Pro: Supports clean break policy for format changes without legacy migration complexity.
- Con: Requires careful version bumping when export/cache metadata changes.

**Example:**
```typescript
export interface PhysicPaintSession {
  schema: 'efx-physic-paint-session'
  version: 1
  id: string
  createdAt: string
  updatedAt: string
  canvas: { width: number; height: number; fps: 15 | 24 | number }
  project: SerializedProject
  exportDefaults: {
    background: 'transparent' | 'white' | 'paper'
    frameStart: number
    frameEnd: number
  }
}
```

### Pattern 4: Type-First Transport Protocol

**What:** Define editor/window protocol messages as serializable TypeScript types now, but defer runtime window management and Tauri IPC until the editor integration milestone.

**When to use:** To shape the standalone app's save/export/cached-frame features around the future integration path without coupling this milestone to `app/` internals.

**Trade-offs:**
- Pro: Makes seams explicit for roadmap planning.
- Pro: Avoids premature Tauri multi-window work while still preventing incompatible demo-only APIs.
- Con: Protocol details will need validation when actual Tauri window integration begins.

**Example:**
```typescript
export type PhysicPaintTransportMessage =
  | { type: 'open-session'; session: PhysicPaintSession }
  | { type: 'session-changed'; sessionId: string; dirty: boolean }
  | { type: 'export-still-request'; requestId: string; frame: number }
  | { type: 'export-sequence-request'; requestId: string; range: { start: number; end: number }; fps: number }
  | { type: 'export-progress'; requestId: string; completed: number; total: number }
  | { type: 'export-complete'; requestId: string; manifest: PhysicPaintCacheManifest }
  | { type: 'error'; requestId?: string; message: string }
```

## Data Flow

### Standalone Editing Flow

```
User pointer input
    ↓
EfxPaintEngine pointer handlers
    ↓
PenPoint[] + BrushOpts + current color/tool
    ↓
renderPaintStroke / applyEraseStroke
    ↓
wet buffers + savedWet + dry canvas
    ↓
localFluidPhysicsStep / physicsStep / dryStep over time
    ↓
render loop composites wet layer to display canvas
    ↓
Demo UI captures engine state, diagnostics, and export actions
```

### Still Export Flow

```
User clicks Export Still in demo
    ↓
Demo calls captureStill(engine, { source: 'display', mimeType: 'image/png' })
    ↓
Capture reads the live display canvas
    ↓
Browser download in standalone demo
    ↓ future editor
Transport returns a cache manifest entry for the still image
    ↓
Editor compositor drawImage(cachedStill)
```

### Frame Sequence Export Flow

```
User chooses frame range/fps in demo
    ↓
Demo creates AnimationPlayer(engine)
    ↓
AnimationPlayer locks input and controls frame rendering
    ↓
onFrame(frameIndex, engine.getDisplayCanvas())
    ↓
Capture frame blob/image data
    ↓
Write/download sequence + manifest in demo
    ↓ future editor
Transport returns PhysicPaintCacheManifest
    ↓
Editor maps timeline frame → cached PNG path → existing image cache/compositor
```

### Future Editor Transport Flow

```
Editor physical paint layer selected
    ↓
Editor opens standalone paint window with session path/id
    ↓
Standalone app loads PhysicPaintSession
    ↓
User paints interactively in standalone window
    ↓
Standalone exports still/sequence cache on save/commit
    ↓
Transport sends manifest to editor
    ↓
Editor invalidates physical-paint layer cache range
    ↓
PreviewRenderer/exportRenderer composite cached frames as image sequence layer
```

### State Management

```
Demo signals own UI state only:
  selected tool, control panel values, export progress, diagnostics visibility

EfxPaintEngine owns simulation state:
  typed arrays, canvases, intervals, stroke list, paper textures, undo stack

Session/export modules own serializable boundaries:
  session JSON, capture options, frame cache manifest, transport message types
```

Do not mirror engine internals into Preact signals. The demo should call engine setters (`setBrushSize`, `setWaterAmount`, `setPhysicsStrength`, etc.) and store only UI control values needed to render panels.

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Demo UI ↔ `EfxPaintCanvas` | Preact props and `onEngineReady` | Already exists; should remain the primary host seam. |
| Demo controls ↔ `EfxPaintEngine` | Direct public method calls | Add missing getters/events only if needed for diagnostics/export. |
| `EfxPaintEngine` ↔ capture helpers | `getDisplayCanvas()` / `getCanvas()` | Already exists and is the correct still capture seam. |
| `AnimationPlayer` ↔ sequence export | `onFrame(frameIndex, canvas)` | Already exists; extend carefully for async capture/backpressure if needed. |
| Session save/load ↔ engine | `engine.save()` / `engine.load()` | Wrap in versioned `PhysicPaintSession`; avoid demo-only format. |
| Future standalone window ↔ editor | Typed transport messages | Define now in `src/transport/protocol.ts`; implement runtime later. |
| Future editor compositor ↔ output cache | Cache manifest + image paths | Editor should consume PNG/still/frame-sequence cache, not engine strokes. |

### Proposed Future Transport/Cache Contracts

| Contract | Shape | Purpose |
|----------|-------|---------|
| `PhysicPaintSession` | Versioned JSON with `SerializedProject`, dimensions, fps/range defaults | Reopen standalone paint state. |
| `PhysicPaintCacheManifest` | Session id, dimensions, fps, frame range, frame file paths, still path, content hash/version | Let editor know what cached outputs exist and what timeline frames they cover. |
| `PhysicPaintTransportMessage` | Discriminated union of open/export/progress/complete/error messages | Later Tauri/browser-window IPC seam. |
| `CaptureStillOptions` | Source canvas, mime type, background policy | Reusable still export from the live engine. |
| `CaptureSequenceOptions` | fps, frame range, naming, background policy | Reusable frame-sequence export from `AnimationPlayer`. |

Recommended manifest shape:

```typescript
export interface PhysicPaintCacheManifest {
  schema: 'efx-physic-paint-cache'
  version: 1
  sessionId: string
  generatedAt: string
  canvas: { width: number; height: number; fps: number }
  range: { start: number; end: number }
  background: 'transparent' | 'white' | 'paper'
  still?: { frame: number; path: string; mimeType: 'image/png' }
  frames: Array<{ frame: number; path: string; mimeType: 'image/png' }>
  contentHash?: string
}
```

## New vs Modified Files

### New Files

| File | Purpose | Phase |
|------|---------|-------|
| `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/vite.demo.config.ts` | Vite config for standalone demo app. | Phase 1 |
| `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/demo/index.html` | Browser entry for demo. | Phase 1 |
| `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/demo/src/main.tsx` | Preact mount entry. | Phase 1 |
| `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/demo/src/App.tsx` | Demo shell, layout, panels. | Phase 1 |
| `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/demo/src/components/PaintSurface.tsx` | Engine host and lifecycle. | Phase 1 |
| `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/demo/src/components/BrushControls.tsx` | Tool and brush settings UI. | Phase 2 |
| `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/demo/src/components/SessionPanel.tsx` | Save/load JSON session UI. | Phase 3 |
| `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/demo/src/components/ExportPanel.tsx` | Still/sequence export UI. | Phase 4 |
| `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/demo/src/components/DiagnosticsPanel.tsx` | Runtime diagnostics and validation status. | Phase 2 |
| `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/demo/src/state/demoState.ts` | Demo-only Preact signals. | Phase 1 |
| `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/demo/src/styles.css` | Demo-only styling. | Phase 1 |
| `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/demo/public/papers/*` | Paper texture fixtures. | Phase 2 |
| `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/session/types.ts` | Session and cache manifest contracts. | Phase 3 |
| `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/session/serialize.ts` | Session envelope save/load helpers. | Phase 3 |
| `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/session/index.ts` | Session public exports. | Phase 3 |
| `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/export/capture.ts` | Still capture helpers from live canvases. | Phase 4 |
| `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/export/sequence.ts` | AnimationPlayer-driven sequence capture helpers. | Phase 4 |
| `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/export/index.ts` | Export helper public exports. | Phase 4 |
| `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/transport/protocol.ts` | Future editor/window message types. | Phase 5 |
| `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/transport/index.ts` | Transport type public exports. | Phase 5 |

### Modified Files

| File | Change | Reason |
|------|--------|--------|
| `/Users/lmarques/Dev/efx-motion-editor/package.json` | Change root `dev:paint` from watch-only build to standalone demo command, e.g. `pnpm --filter @efxlab/efx-physic-paint dev`; optionally add `build:paint`. | Current `dev:paint` runs `tsup --watch`, which proves library build but not a runnable app/window. |
| `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/package.json` | Add `dev`, `demo`, or `dev:demo` script using Vite; keep `build`, `dev:watch`, `check`; add dev deps `vite`, `@preact/preset-vite` if not inherited intentionally. | Make package runnable/testable as standalone. |
| `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/index.ts` | Export session/export/transport types and helpers once stable. | Future editor can import contracts without reaching into internals. |
| `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/preact.tsx` | Optional: add `onEngineDestroy`, `onEngineError`, `initialProject/session`, and CSS class/style passthrough. | Demo and future window need robust lifecycle handling. |
| `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` | Minimal additions only: state snapshot/getters, explicit flush/capture readiness, maybe event callback hooks. Do not rewrite as headless batch renderer. | Export and diagnostics need stable read seams from the live engine. |
| `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/animation/AnimationPlayer.ts` | Optional: allow async `onFrame`/backpressure or a `captureFrame` mode if browser blob creation falls behind. | Prevent sequence export from dropping frames or racing canvas updates. |
| `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/tsup.config.ts` | Add public entrypoints such as `session`, `export`, `transport` only if consumers should import subpaths. | Keeps package API explicit. |
| `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/README.md` | Update stale API examples and document standalone demo command. | Current README references old constructor/API names and says `pnpm dev` starts a demo that does not yet exist. |

### Files to Avoid Modifying Early

| File/Area | Why |
|-----------|-----|
| `/Users/lmarques/Dev/efx-motion-editor/app/src/**` | This milestone should prove standalone first; editor integration comes after seams are validated. |
| Editor `paintStore`/`previewRenderer` | Do not revive the failed adapter path. Future integration should consume cached stills/sequences. |
| Generated `packages/efx-physic-paint/dist/**` | Build output only; regenerate through `pnpm --filter @efxlab/efx-physic-paint build`. |

## Suggested Build Order

### Phase 1: Demo App Skeleton and Workspace Commands

1. Add `vite.demo.config.ts`, `demo/index.html`, `demo/src/main.tsx`, `demo/src/App.tsx`, `demo/src/styles.css`.
2. Add `demo/src/components/PaintSurface.tsx` using `EfxPaintCanvas` and `onEngineReady`.
3. Modify `packages/efx-physic-paint/package.json` with a real `dev` or `dev:demo` script.
4. Modify root `package.json` so `pnpm dev:paint` runs the standalone demo instead of `tsup --watch`.
5. Keep `dev:watch` for library development and `build` for tsup.

**Gate:** `pnpm dev:paint` starts a browser demo that displays a paint surface and accepts pointer input. Do not run the server in this agent context because project instructions say the user runs servers locally.

### Phase 2: Control Surface and Engine Diagnostics

1. Add brush/tool controls for current public engine setters: `setTool`, `setBrushSize`, `setBrushOpacity`, `setBrushPressure`, `setWaterAmount`, `setDrySpeed`, `setEdgeDetail`, `setPickup`, `setEraseStrength`, `setPhysicsStrength`, `setViscosity`, `setPhysicsMode`, `setLocalSpreadStrength`, `setColorHex`, `setBgMode`, `setPaperGrain`, `setEmbossStrength`, `setWetPaper`, `startPhysics`, `stopPhysics`, `forceDry`, `undo`, `clear`.
2. Add paper fixture loading under demo public assets.
3. Add diagnostics: canvas size, selected tool, stroke count, physics running, export readiness. If getters are missing, add minimal engine getters rather than duplicating engine state externally.
4. Update README with accurate demo command and current API examples.

**Gate:** User can test the core physics paint behavior interactively without opening EFX Motion Editor.

### Phase 3: Session Save/Load Seam

1. Add `src/session/types.ts` with `PhysicPaintSession` and `PhysicPaintCacheManifest`.
2. Add `src/session/serialize.ts` helpers wrapping `engine.save()`/`engine.load()`.
3. Add demo `SessionPanel` for download/upload of session JSON.
4. Export session contracts from `src/index.ts` or a subpath if desired.

**Gate:** A standalone paint session can be saved, reloaded, and continue painting. This proves the future editor can hand off/reopen a physical paint layer session.

### Phase 4: Still and Sequence Export

1. Add `src/export/capture.ts` for live canvas still capture.
2. Add `src/export/sequence.ts` using `AnimationPlayer` and `onFrame` capture.
3. Add `ExportPanel` to download a still PNG and a small frame sequence or manifest.
4. If frame capture races with animation timing, modify `AnimationPlayer` to await async frame capture before advancing.

**Gate:** Standalone app can produce inspectable stills and frame sequences suitable for future cached compositing.

### Phase 5: Transport Protocol Types and Future Editor Cache Contract

1. Add `src/transport/protocol.ts` with discriminated union messages.
2. Ensure export helpers can produce `PhysicPaintCacheManifest`.
3. Document expected future editor behavior: open window/session, receive manifest, cache paths, draw cached frames.
4. Do not wire Tauri multi-window IPC yet unless the roadmap explicitly expands this milestone.

**Gate:** Roadmap has concrete integration seams without committing to a brittle runtime implementation.

### Phase 6: Package Hygiene and Validation

1. Type-check the package with `pnpm --filter @efxlab/efx-physic-paint check`.
2. Build the library with `pnpm --filter @efxlab/efx-physic-paint build`.
3. Keep the demo build separate if desired, e.g. `pnpm --filter @efxlab/efx-physic-paint build:demo`.
4. Confirm root `pnpm build` remains library build then editor build.

**Gate:** Standalone demo exists without breaking the publishable package or editor workspace dependency.

## Scaling Considerations

| Scale / Concern | Architecture Adjustment |
|-----------------|-------------------------|
| Demo proof at 1000×650 | Current engine dimensions and dual-canvas model are fine. Focus on UI and export correctness. |
| 1280×720 target window | Use responsive CSS around fixed-resolution engine canvas; expose dimensions in demo controls only after baseline works. |
| 1920×1080 sessions | Be careful with typed-array memory: engine allocates many `Float32Array` buffers proportional to pixel count. Keep one live engine per standalone window. |
| Long frame sequences | Stream/capture one frame at a time and produce a manifest. Do not retain every frame canvas in memory. |
| Future editor playback | Editor should play cached PNG/frame files through its existing image cache/compositor. It should not run the physics engine on every preview frame. |
| Future export | If cache is valid, export uses cached physical-paint frames. If dirty, standalone app/window should regenerate cache before editor export consumes it. |

### Scaling Priorities

1. **First bottleneck: browser canvas capture and frame sequence memory.** Fix by streaming blobs/files and keeping only a manifest in memory.
2. **Second bottleneck: engine buffer size at high resolutions.** Fix by one engine per window, explicit destroy, and resolution changes that recreate the engine intentionally.
3. **Third bottleneck: cache invalidation between editor and standalone.** Fix with session version/content hash/dirty range in the manifest rather than ad hoc file naming.

## Anti-Patterns

### Anti-Pattern 1: Reviving the Headless Adapter / Batch Renderer

**What people do:** Add `renderFromStrokes(strokes)` and have the editor call it for preview/export frames.

**Why it's wrong:** The project already learned this approach kills physics quality and becomes O(n²). It bypasses the interactive wet/dry timing that makes the engine valuable and duplicates rendering ownership between editor and engine.

**Do this instead:** Run physics paint as a standalone interactive app/window. Capture the resulting stills/sequences and return cache manifests to the editor.

### Anti-Pattern 2: Demo-Only Save Format

**What people do:** Let the demo download whatever `engine.save()` returns and later invent a different editor session format.

**Why it's wrong:** The future transport needs dimensions, fps/range, background/export policy, and cache metadata. A demo-only format creates immediate migration work.

**Do this instead:** Introduce a versioned `PhysicPaintSession` envelope now. Store `SerializedProject` inside it.

### Anti-Pattern 3: Mirroring Engine State in Preact Signals

**What people do:** Copy engine internals into demo signals and try to keep UI state and engine state synchronized bidirectionally.

**Why it's wrong:** The engine already owns mutable simulation state, intervals, typed arrays, and stroke recording. Mirroring creates stale UI and synchronization bugs.

**Do this instead:** Store demo control values in signals, call engine setters, and add small engine getters/events only for diagnostics.

### Anti-Pattern 4: Coupling Standalone Demo to `app/` Internals

**What people do:** Import editor stores, preview renderer, Tauri APIs, or paint sidecar code into the package demo.

**Why it's wrong:** It prevents the package from staying publishable/testable and drags the failed integration complexity back into the proof milestone.

**Do this instead:** Keep package demo browser-only. Define transport/cache contracts as plain serializable types.

### Anti-Pattern 5: Exporting Only the Dry Canvas

**What people do:** Capture `getCanvas()` because it is the base canvas and ignore `getDisplayCanvas()`.

**Why it's wrong:** The display canvas includes wet layer compositing, cursor/preview concerns depending on timing, and visible live paint. Capturing the wrong canvas can miss current wet visual state.

**Do this instead:** Default still/sequence export to `getDisplayCanvas()` after ensuring cursor/preview overlays are not included or are suppressed during export. Use `getCanvas()` only for explicit dry-layer diagnostics.

## Roadmap Implications

Recommended phase structure for the milestone:

1. **Standalone Demo Skeleton** - Establish `pnpm dev:paint` as a real runnable Vite/Preact app around the existing package.
   - Addresses: runnable app/window requirement.
   - Avoids: editor coupling and adapter relapse.

2. **Interactive Tooling and Diagnostics** - Expose current engine capabilities through controls and panels.
   - Addresses: live interactive physics paint validation.
   - Avoids: building export before the engine can be manually evaluated.

3. **Session Seam** - Create a versioned standalone session envelope.
   - Addresses: future editor handoff and reopenability.
   - Avoids: demo-only JSON dead end.

4. **Still/Sequence Export Seam** - Capture live engine output and produce a cache manifest.
   - Addresses: editor cached-frame integration path.
   - Avoids: headless re-rendering in the editor.

5. **Transport Contract Documentation/Types** - Add message/manifest types without runtime editor integration.
   - Addresses: roadmap clarity for the next milestone.
   - Avoids: premature Tauri IPC/window complexity.

6. **Validation and Package Hygiene** - Type-check/build package and update README.
   - Addresses: monorepo stability and developer workflow.

## Sources

- `/Users/lmarques/Dev/efx-motion-editor/.planning/PROJECT.md` — v0.8.0 active requirements, constraints, and explicit exclusion of failed headless adapter approach.
- `/Users/lmarques/Dev/efx-motion-editor/.planning/MILESTONES.md` — v0.7.0 post-milestone context and abandoned engine adapter phases.
- `/Users/lmarques/Dev/efx-motion-editor/package.json` — root pnpm scripts; current `dev:paint` is watch-only and should become runnable demo command.
- `/Users/lmarques/Dev/efx-motion-editor/pnpm-workspace.yaml` — workspace layout includes `app` and `packages/*`.
- `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/package.json` — package exports/scripts; lacks runnable Vite demo command.
- `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/index.ts` — current public library entrypoint.
- `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/preact.tsx` — current Preact wrapper and lifecycle seam.
- `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` — interactive engine facade, live canvas capture methods, animation hooks, save/load.
- `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/animation/AnimationPlayer.ts` — frame-based replay and `onFrame` capture hook.
- `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/types.ts` — engine config, brush, stroke, serialized project types.
- `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/tsup.config.ts` — current library build entrypoints.
- `/Users/lmarques/Dev/efx-motion-editor/app/package.json` — editor consumes `@efxlab/efx-physic-paint` via workspace dependency; editor should remain a future cached-output consumer.

---
*Architecture research for: standalone efx-physic-paint milestone*
*Researched: 2026-06-08*
