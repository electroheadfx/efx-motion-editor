# Phase 35: Interactive Physics Paint Controls - Research

**Researched:** 2026-06-08
**Domain:** Tauri/Preact app-to-standalone physics paint workflow, rendered-output handoff, and editor paint-layer integration [VERIFIED: codebase]
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

## Phase Boundary

Phase 35 must turn physics paint into an interactive editor-to-standalone-to-editor workflow, not only an isolated standalone demo. From the EFX Motion Editor, the user creates/selects a `physic-paint` layer, moves to a frame, clicks an `[open fx paint canvas]` control in that layer's parameters, paints in the physics paint standalone window, then applies the result back into the editor.

This intentionally expands the roadmap's current standalone-only wording: Phase 35 should include the app entry point and return actions needed for the user to validate the real physics paint workflow now.

## Implementation Decisions

### App-to-standalone workflow
- **D-01:** The EFX Motion Editor must expose a `physic-paint` layer path with a parameter/button labelled `[open fx paint canvas]` that opens the physics paint standalone canvas for the current layer/frame context.
- **D-02:** The standalone is the editing surface for the physics paint layer. The app does not receive editable strokes or engine internals from the standalone.
- **D-03:** The only data applied back to the app is rendered output: either the current rendered image or a generated sequence of rendered frames.

### Standalone controls
- **D-04:** Everything that exists in the physics paint demo toolbar should be present in the standalone window, not reduced to a minimal control set.
- **D-05:** Controls that are visible but not implemented or not connected yet should remain visible and disabled with a clear disabled state, rather than hidden.
- **D-06:** The main purpose of the controls is to control the paint/physics paint session. Import/export is the exception: it is for saving and reloading editable paint state files.

### Apply actions and diagnostics
- **D-07:** The standalone should show a ready/not ready state that tells the user whether the current paint output can be applied back to the app.
- **D-08:** The standalone must provide `[apply canvas]`, which writes the current rendered image back into the `physic-paint` layer at the current app frame.
- **D-09:** The standalone must provide `[apply play canvas]`, which writes a generated frame sequence into the `physic-paint` layer timeline.
- **D-10:** For `[apply play canvas]`, the user provides a number of frames. The standalone generates that many frames and writes them into the app timeline starting from the frame where the user was positioned when opening/applying from the app.

### Import/export state files
- **D-11:** Import/export in this phase means save/reload the editable physics paint state as a file so users can resume or test imported states.
- **D-12:** Import/export does not define the rendered-output path back to the app. Rendered output is applied via `[apply canvas]` and `[apply play canvas]`.

### Scope note for downstream agents
- **D-13:** Downstream research/planning must treat the app entry point and apply-back path as part of Phase 35, despite the roadmap listing later phases for persistence/output proof and future integration contracts. This is a user-approved scope expansion captured during discussion.

### Claude's Discretion
Planner/researcher may choose the safest technical seam for opening the standalone and applying rendered outputs, but must preserve the user-facing flow and labels above.

### Deferred Ideas (OUT OF SCOPE)
None — discussion intentionally expanded Phase 35 rather than deferring the app entry/apply-back workflow.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PAINT-01 | User can paint on a live physics canvas using the local `@efxlab/efx-physic-paint` package. [VERIFIED: requirements] | The package demo already mounts `EfxPaintCanvas` from the public Preact subpath and `EfxPaintEngine` owns pointer events, canvases, buffers, physics intervals, drying interval, and RAF lifecycle. [VERIFIED: codebase] |
| PAINT-02 | User can change core paint settings such as color, brush size, opacity, and available physics controls. [VERIFIED: requirements] | `demo/src/Toolbar.tsx` already wires color, size, opacity, detail, pickup, erase strength, anti-alias, background, paper grain, physics mode, spread, save/load, undo, and clear to public engine methods. [VERIFIED: codebase] |
| PAINT-03 | User can use at least paint and erase tools through the real engine APIs. [VERIFIED: requirements] | `ToolType` is currently `'paint' | 'erase'`, and `Toolbar` calls `engine.setTool('paint')` / `engine.setTool('erase')`; engine dispatches paint to `renderPaintStroke` and erase to `applyEraseStroke`. [VERIFIED: codebase] |
| PAINT-04 | User can test efx-physic-paint as a separate physics paint tool without replacing perfect-freehand basic paint or p5.brush FX paint. [VERIFIED: requirements] | Existing app paint remains `LayerType: 'paint'` backed by `paintStore`, perfect-freehand, and p5.brush cache paths; Phase 35 should add a separate `physic-paint` path rather than changing `PaintModeSelector` semantics. [VERIFIED: codebase] [VERIFIED: user memory] |
| DIAG-01 | User can see engine readiness, canvas/session state, active settings, and errors while testing. [VERIFIED: requirements] | Phase 35 must extend the standalone UI beyond the Phase 34 `CanvasMountProbe` to show ready/apply eligibility, current layer/frame context, canvas/session state, active settings, and caught file/transport/apply errors. [VERIFIED: context] |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Use project-local GSD tooling from `.claude/get-shit-done`, not `$HOME/.claude/get-shit-done`. [VERIFIED: codebase]
- Do not run the server; the user runs server/demo commands on their side. [VERIFIED: codebase]
- Use `pnpm`, not `npm`, for project workflows. [VERIFIED: user memory]
- Do not replace p5.brush; it remains the FX brush layer. [VERIFIED: user memory]
- Bump `paintVersion` on paint mutations and subscribe to it in render effects. [VERIFIED: user memory] [VERIFIED: codebase]
- Guard global shortcuts in paint mode; shortcut changes must respect `isPaintEditMode()`/paint-mode conflicts. [VERIFIED: user memory]
- No backward-compatibility work for old projects is required for format changes. [VERIFIED: user memory]
- Engine integration must be incremental; do not resurrect batch `renderFromStrokes` / headless adapter paths that damaged physics quality and caused O(n²) behavior. [VERIFIED: user memory] [VERIFIED: state]

## Summary

Phase 35 is no longer a standalone-only control-polish phase; the locked context makes it an editor-to-standalone-to-editor proof using rendered outputs only. [VERIFIED: context] The safest plan is to keep the standalone physics engine as the editing surface, add a distinct editor layer/source type for `physic-paint`, open a Tauri webview/window with layer/frame context, and apply returned rendered PNG/still frames into editor-visible raster frames. [VERIFIED: context] [ASSUMED]

The current codebase already has most of the standalone control surface: `packages/efx-physic-paint/demo/src/App.tsx` mounts the public `EfxPaintCanvas`, creates an `AnimationPlayer`, and renders `Toolbar`; `Toolbar.tsx` already drives real engine APIs for paint/erase/settings/physics/save/load. [VERIFIED: codebase] The missing work is the app seam: layer model/types, add-layer menu entry, properties panel button labelled exactly `[open fx paint canvas]`, a return channel, a storage/cache representation for rendered physics frames, preview/export rendering support, and diagnostics. [VERIFIED: codebase] [VERIFIED: context]

**Primary recommendation:** Implement `physic-paint` as a separate editor layer type/source and use a rendered-output-only handoff: standalone captures `engine.getDisplayCanvas()`/animation frames, sends PNG data or file references back through a typed Tauri/event seam, and the app stores those rendered frames for preview/export without importing editable strokes or engine internals. [VERIFIED: context] [VERIFIED: codebase] [ASSUMED]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Physics paint editing surface | Browser / Client standalone webview | Package engine | `EfxPaintEngine` owns canvases, pointer input, physics/drying intervals, and render loop; the app must not receive editable strokes or internals. [VERIFIED: codebase] [VERIFIED: context] |
| App entry point `[open fx paint canvas]` | Browser / Client app UI | Tauri window API | The selected layer/frame context originates in app signals/stores and opens a standalone editor surface. [VERIFIED: codebase] [VERIFIED: context] |
| Rendered output apply-back | Browser / Client app state | Tauri event/window channel | User decisions require returned rendered image or frame sequence only; Tauri v2 supports events via `emit`, `emitTo`, and `listen`, with unlisten cleanup. [VERIFIED: context] [CITED: https://v2.tauri.app/develop/calling-frontend/] [CITED: https://v2.tauri.app/reference/javascript/api/namespaceevent/] |
| Rendered physics frame persistence/cache | Browser / Client state initially | Filesystem/project persistence later | Phase 35 needs visible app preview/timeline proof; durable `.mce`/sidecar design is affected by D-13 but still should be minimal and rendered-output-only. [VERIFIED: context] [ASSUMED] |
| Preview/export compositing | Browser / Client renderer | Image store / asset protocol | Current `PreviewRenderer.resolveLayerSource` supports static images, image sequences, and video but not `paint` or `physic-paint`; rendered physics frames must become a drawable `CanvasImageSource` path. [VERIFIED: codebase] |
| Diagnostics | Standalone UI | App UI state | DIAG-01 requires engine readiness, canvas/session state, active settings, and errors while testing; standalone has direct access to engine and current toolbar state. [VERIFIED: requirements] [VERIFIED: codebase] |

## Standard Stack

### Core
| Library / API | Version | Purpose | Why Standard |
|---------------|---------|---------|--------------|
| `@efxlab/efx-physic-paint` | workspace package 0.1.0 [VERIFIED: codebase] | Physics paint engine, Preact wrapper, animation player. [VERIFIED: codebase] | Local package is the required engine for PAINT-01/02/03; do not hand-roll physics paint or replay adapter. [VERIFIED: requirements] [VERIFIED: state] |
| Preact | app `^10.28.4`, package demo `^10.29.0` [VERIFIED: codebase] | App and standalone UI runtime. [VERIFIED: codebase] | Existing project stack uses Preact/signals throughout app and package demo. [VERIFIED: codebase] |
| `@preact/signals` | app `^2.8.1` [VERIFIED: codebase] | App state stores, paintVersion invalidation, selected layer/frame signals. [VERIFIED: codebase] | Existing stores are signal-based; planning should extend current stores rather than introduce a new state library. [VERIFIED: codebase] |
| Tauri v2 JS/Rust APIs | app deps `@tauri-apps/api ^2.10.1`, CLI `^2.10.0` [VERIFIED: codebase] | Desktop window/event/filesystem bridge. [VERIFIED: codebase] | Existing app is Tauri v2; docs confirm event APIs and backend-to-frontend emit patterns. [CITED: https://v2.tauri.app/develop/calling-frontend/] |
| Canvas 2D | Browser API [ASSUMED] | Capture/apply rendered PNG/still frames from `HTMLCanvasElement`. [VERIFIED: codebase] | Engine exposes `getCanvas()` and `getDisplayCanvas()` as `HTMLCanvasElement`; preview renderer accepts `CanvasImageSource`. [VERIFIED: codebase] |

### Supporting
| Library / API | Version | Purpose | When to Use |
|---------------|---------|---------|-------------|
| `AnimationPlayer` from `@efxlab/efx-physic-paint/animation` | local subpath [VERIFIED: codebase] | Generate/play frame sequence from recorded strokes in standalone. [VERIFIED: codebase] | Use for `[apply play canvas]` frame generation if using existing stroke distribution is acceptable; capture frames via `onFrame(frameIndex, engine.getDisplayCanvas())`. [VERIFIED: codebase] |
| `@tauri-apps/plugin-fs` | `^2.4.5` [VERIFIED: codebase] | File reads/writes for existing paint sidecars and export PNG commands. [VERIFIED: codebase] | Prefer existing IPC/export helpers for writing PNGs if Phase 35 chooses file-backed rendered frames. [VERIFIED: codebase] [ASSUMED] |
| `export_write_png` command | existing Rust command [VERIFIED: codebase] | Atomic temp+rename PNG writes. [VERIFIED: codebase] | Reuse for generated rendered frames if writing output files from data bytes is selected. [VERIFIED: codebase] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Separate `physic-paint` layer type/source | Reuse existing `paint` layer with `activePaintMode='physics'` | Reuse risks replacing/entangling perfect-freehand and p5.brush paths, contradicting PAINT-04 and user memory. [VERIFIED: requirements] [VERIFIED: user memory] |
| Rendered-output-only handoff | Send strokes / `SerializedProject` / engine internals to app | Rejected by D-02/D-03; app receives only current rendered image or generated rendered frames. [VERIFIED: context] |
| Tauri event/window seam | App-driven batch `renderFromStrokes` replay | Rejected by project history; prior batch adapter destroyed physics quality and was O(n²). [VERIFIED: state] [VERIFIED: user memory] |
| File-backed PNG frame cache | In-memory `HTMLCanvasElement` cache only | In-memory is simpler for immediate UAT but disappears on reload/save; file-backed output aligns with existing `export_write_png` and `efxasset://` preview paths but needs careful path/image registration. [VERIFIED: codebase] [ASSUMED] |

**Installation:** No new external packages are required for Phase 35 if using existing Preact, Tauri, and local package APIs. [VERIFIED: codebase]

## Package Legitimacy Audit

No external package installation is recommended for this phase. [VERIFIED: codebase]

## Architecture Patterns

### System Architecture Diagram

```text
User in EFX Motion Editor
  |
  v
Add/select physic-paint layer + move to currentFrame
  |
  v
Layer properties: [open fx paint canvas]
  |
  v
Tauri app opens/focuses standalone physics paint webview/window
  |                 |
  | context payload | layerId, frame, project/canvas size, optional existing rendered frame reference
  v                 v
Standalone Preact UI: EfxPaintCanvas + Toolbar + Diagnostics
  |
  | user paints with real EfxPaintEngine pointer/physics APIs
  v
Ready? canvas/session/output state visible
  |                         |
  | [apply canvas]          | [apply play canvas] + frame count
  v                         v
Capture current display     AnimationPlayer renders N frames and captures each display canvas
  |                         |
  +---------- rendered PNG/blob/file payloads ----------+
                                                       |
                                                       v
App apply handler validates layer/frame context
  |
  v
Store rendered physics still/frame sequence for physic-paint layer
  |
  v
Bump paintVersion / project dirty / preview renderer invalidation
  |
  v
Preview + timeline show rendered physics output at current frame(s)
```

This diagram intentionally has no stroke transport from standalone to app. [VERIFIED: context]

### Recommended Project Structure

```text
app/src/
├── types/layer.ts                         # Add LayerType/LayerSourceData for physic-paint. [VERIFIED: codebase]
├── types/physicPaint.ts                   # Typed context/apply payloads for layerId/frame/frameCount/render refs. [ASSUMED]
├── stores/physicPaintStore.ts             # Rendered output frame map/cache for physic-paint layers. [ASSUMED]
├── lib/physicPaintBridge.ts               # Open/focus window + listen/apply events; cleanup unlisten. [ASSUMED]
├── components/sidebar/PhysicPaintProperties.tsx # `[open fx paint canvas]` and rendered-output status. [ASSUMED]
├── components/timeline/AddFxMenu.tsx      # Add `Physic Paint` menu entry without changing existing Paint / Rotopaint. [VERIFIED: codebase]
└── lib/previewRenderer.ts                 # Resolve/composite physic-paint rendered frames. [VERIFIED: codebase]

packages/efx-physic-paint/demo/src/
├── App.tsx                                # Extend standalone app with launch context and apply actions. [VERIFIED: codebase]
├── Toolbar.tsx                            # Keep broad toolbar visible; add/apply controls or parent panel. [VERIFIED: codebase]
└── diagnostics/                           # Optional small components for readiness/session/settings/errors. [ASSUMED]
```

### Pattern 1: Keep physics editing in the standalone, app stores rendered outputs

**What:** The standalone owns the `EfxPaintEngine` and editable state; the app only stores rendered image/frame outputs for the `physic-paint` layer. [VERIFIED: context]

**When to use:** Always for Phase 35 apply-back because D-02 and D-03 prohibit sending editable strokes/engine internals to the app. [VERIFIED: context]

**Example:**
```ts
// Source: current engine public API exposes rendered canvases. [VERIFIED: codebase]
const canvas = engine.getDisplayCanvas()
const dataUrl = canvas.toDataURL('image/png')
// Send rendered data/file reference to app; do not send engine.getStrokes() or save() for apply-back. [VERIFIED: context]
```

### Pattern 2: Add a distinct `physic-paint` layer path

**What:** Extend layer types with a separate physics paint layer/source instead of overloading existing `paint`. [ASSUMED]

**When to use:** Use because PAINT-04 and memory require basic paint and p5.brush FX paint to remain available. [VERIFIED: requirements] [VERIFIED: user memory]

**Current analog:**
```ts
// Source: app/src/components/timeline/AddFxMenu.tsx current paint layer creation. [VERIFIED: codebase]
const layerId = crypto.randomUUID()
const paintLayer: Layer = {
  id: layerId,
  name: 'Paint',
  type: 'paint',
  source: { type: 'paint', layerId },
  // ...
}
```

Planner should create a sibling flow for `type: 'physic-paint'` / `source: { type: 'physic-paint', layerId }` and not alter `handleAddPaintLayer` semantics. [ASSUMED]

### Pattern 3: Event listeners must clean up

**What:** Tauri frontend `listen` returns an unlisten function; docs say to use it when a component unmounts or execution context goes out of scope. [CITED: https://v2.tauri.app/develop/calling-frontend/] [CITED: https://v2.tauri.app/reference/javascript/api/namespaceevent/]

**When to use:** Use in any Preact hook that listens for standalone apply events or menu/window events. [VERIFIED: codebase] [CITED: https://v2.tauri.app/develop/calling-frontend/]

**Example:**
```ts
// Source: Tauri v2 event docs. [CITED: https://v2.tauri.app/develop/calling-frontend/]
useEffect(() => {
  let cleanup: (() => void) | undefined
  listen('physic-paint:apply-canvas', (event) => {
    // validate event.payload before mutating app state
  }).then((unlisten) => { cleanup = unlisten })
  return () => cleanup?.()
}, [])
```

### Pattern 4: `paintVersion`/dirty notification after rendered-output mutation

**What:** Existing paint mutations bump `paintStore.paintVersion`; preview and overlays subscribe to it. [VERIFIED: codebase] User memory explicitly requires bumping/subscribing. [VERIFIED: user memory]

**When to use:** Any apply-back mutation that changes what preview/export should draw. [VERIFIED: user memory]

**Example:**
```ts
// Source: app/src/stores/paintStore.ts existing setFrame behavior. [VERIFIED: codebase]
setFrame(layerId: string, frame: number, pf: PaintFrame): void {
  _getOrCreateFrame(layerId, frame)
  _frames.get(layerId)!.set(frame, pf)
  this.markDirty(layerId, frame)
  paintVersion.value++
}
```

A new `physicPaintStore` should provide an equivalent centralized notification rather than manually scattering version bumps. [ASSUMED]

### Anti-Patterns to Avoid

- **Using existing `paint` layer as physics paint:** This risks breaking perfect-freehand basic paint and p5.brush FX paint. [VERIFIED: requirements] [VERIFIED: user memory]
- **Sending editable strokes to the app for apply-back:** D-02/D-03 explicitly prohibit this; only rendered outputs apply back. [VERIFIED: context]
- **Reviving batch replay/headless adapter:** Project state marks it excluded; user memory says it killed physics quality and was O(n²). [VERIFIED: state] [VERIFIED: user memory]
- **Hiding unimplemented controls:** D-05 says visible-but-unimplemented controls must remain visible and disabled with clear disabled state. [VERIFIED: context]
- **Forgetting listener cleanup:** Tauri docs require unlisten cleanup for listeners whose execution context goes out of scope. [CITED: https://v2.tauri.app/develop/calling-frontend/]
- **Running dev servers during validation:** CLAUDE.md forbids it; planner should use build/type/test commands and leave live UAT to the user. [VERIFIED: codebase]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Physics paint simulation | Custom renderer/replay inside app | `EfxPaintEngine` in standalone | Engine already owns real paint/erase, physics, drying, buffers, and pointer input. [VERIFIED: codebase] |
| Frame-by-frame playback generation | New point-distribution engine | Existing `AnimationPlayer` if acceptable | `AnimationPlayer` already maps strokes to frames, renders partial strokes, and exposes `onFrame(frameIndex, canvas)`. [VERIFIED: codebase] |
| App-to-window event bus | Custom globals/localStorage polling | Tauri v2 `emit`/`emitTo`/`listen` | Tauri v2 documents event APIs and unlisten lifecycle. [CITED: https://v2.tauri.app/develop/calling-frontend/] [CITED: https://v2.tauri.app/reference/javascript/api/namespaceevent/] |
| PNG file writing | Browser-only ad hoc download for app output | Existing `export_write_png` command or explicit rendered-frame store | Existing command writes PNG bytes atomically with temp+rename. [VERIFIED: codebase] |
| Paint invalidation | Manual redraw calls only | Store-level dirty + version signal pattern | Existing preview subscribes to `paintVersion`; user memory says to bump/subscribe. [VERIFIED: codebase] [VERIFIED: user memory] |

**Key insight:** The dangerous complexity is not the toolbar; it is crossing the app/standalone boundary without violating the rendered-output-only contract or entangling the three paint layer types. [VERIFIED: context] [VERIFIED: user memory]

## Common Pitfalls

### Pitfall 1: Confusing `paint`, `fx-paint`, and `physic-paint`
**What goes wrong:** Physics paint gets implemented as a mode of the existing paint layer and breaks basic perfect-freehand or p5.brush FX workflows. [VERIFIED: user memory]
**Why it happens:** Existing `PaintProperties` and `PaintModeSelector` already multiplex flat/FX paint in one `paint` layer. [VERIFIED: codebase]
**How to avoid:** Add a separate `physic-paint` layer/source and a separate properties component/button path. [ASSUMED]
**Warning signs:** Changes to `PaintModeSelector` are required for the core physics layer path; `p5.brush` adapter or perfect-freehand rendering tests start changing. [VERIFIED: codebase] [ASSUMED]

### Pitfall 2: Applying editable state instead of rendered output
**What goes wrong:** The app receives `engine.save()`, `getStrokes()`, or engine internals, recreating the rejected adapter architecture. [VERIFIED: context] [VERIFIED: state]
**Why it happens:** `Toolbar` already has Save/Load and `AnimationPlayer` reads strokes, so it is tempting to reuse editable data for editor integration. [VERIFIED: codebase]
**How to avoid:** Treat Save/Load as standalone editable state only; apply actions must send only PNG/current canvas or generated rendered frames. [VERIFIED: context]
**Warning signs:** App-side code imports `EfxPaintEngine`, calls `renderPartialStrokes`, or stores `SerializedProject` as layer preview data. [VERIFIED: codebase] [ASSUMED]

### Pitfall 3: Preview renderer has no drawable source for new layer type
**What goes wrong:** Apply-back appears successful in state, but preview/export remains blank. [ASSUMED]
**Why it happens:** `PreviewRenderer.resolveLayerSource` currently returns sources only for static image, image sequence, and video; `paint` rendering is handled elsewhere and `physic-paint` does not exist. [VERIFIED: codebase]
**How to avoid:** Plan an explicit preview/export rendering task for `physic-paint` rendered frames, plus invalidation after apply. [VERIFIED: codebase] [ASSUMED]
**Warning signs:** Layer list/timeline shows `physic-paint`, but `resolveLayerSource` default branch returns null. [VERIFIED: codebase]

### Pitfall 4: Apply sequence frame indexing ignores current app frame
**What goes wrong:** `[apply play canvas]` writes frames starting at 0 or standalone frame 0 instead of the app frame where the user opened/applied. [VERIFIED: context]
**Why it happens:** `AnimationPlayer` frame indexes are local to the generated sequence. [VERIFIED: codebase]
**How to avoid:** Store launch/apply context `{ layerId, startFrame }` and write generated frame `i` to app frame `startFrame + i`. [VERIFIED: context] [ASSUMED]
**Warning signs:** Current app frame is not included in the typed launch/apply payload. [ASSUMED]

### Pitfall 5: Not representing ready/not-ready state precisely
**What goes wrong:** User clicks apply before engine/canvas/context/output is valid and gets no actionable diagnosis. [VERIFIED: requirements]
**Why it happens:** Phase 34 only probes canvas mount; it does not define apply eligibility. [VERIFIED: codebase]
**How to avoid:** Define readiness as engine initialized, canvas mounted, layerId/frame context present, app bridge/listener available, and no active playback/apply operation. [ASSUMED]
**Warning signs:** `[apply canvas]` is always enabled regardless of engine and app context. [ASSUMED]

### Pitfall 6: Tauri event listener leaks or duplicate applies
**What goes wrong:** Reopening the standalone causes multiple app listeners and duplicate frame application. [ASSUMED]
**Why it happens:** `listen` persists for application lifetime unless unlisten is called. [CITED: https://v2.tauri.app/develop/calling-frontend/]
**How to avoid:** Install listeners in a lifecycle owner with cleanup and include operation IDs to deduplicate apply payloads. [CITED: https://v2.tauri.app/develop/calling-frontend/] [ASSUMED]
**Warning signs:** Apply handlers are registered inside button click handlers without cleanup. [ASSUMED]

### Pitfall 7: Generated frames are too large for event payloads
**What goes wrong:** Sending many base64 PNGs through events is slow or unstable. [ASSUMED]
**Why it happens:** Tauri docs state event payloads are JSON strings and not suitable for bigger messages. [CITED: https://v2.tauri.app/develop/calling-frontend/]
**How to avoid:** Prefer file-backed frames or small references for `[apply play canvas]` if frame counts are large; if using data URLs for UAT, cap frame count and expose errors. [CITED: https://v2.tauri.app/develop/calling-frontend/] [ASSUMED]
**Warning signs:** Apply payload type is `string[]` of full base64 PNGs with high max frame count. [ASSUMED]

## Code Examples

### Capture rendered output only
```ts
// Source: EfxPaintEngine exposes getDisplayCanvas(). [VERIFIED: codebase]
function captureCurrentRenderedPng(engine: EfxPaintEngine): string {
  return engine.getDisplayCanvas().toDataURL('image/png')
}
```

### Generate frames from existing AnimationPlayer
```ts
// Source: AnimationPlayer.play({ frameCount, fps, onFrame }) calls onFrame(frameIndex, canvas). [VERIFIED: codebase]
const frames: string[] = []
player.play({
  frameCount,
  fps: 24,
  onFrame: (_frameIndex, canvas) => {
    frames.push(canvas.toDataURL('image/png'))
  },
  onComplete: () => {
    // apply frames to app starting at launchContext.frame
  },
})
```

### Tauri listener cleanup
```ts
// Source: Tauri v2 event docs return UnlistenFn from listen(). [CITED: https://v2.tauri.app/develop/calling-frontend/]
useEffect(() => {
  let unlisten: (() => void) | undefined
  listen<PhysicPaintApplyPayload>('physic-paint:apply', (event) => {
    applyRenderedPhysicsOutput(event.payload)
  }).then((fn) => { unlisten = fn })
  return () => unlisten?.()
}, [])
```

### Existing app paint frame mutation analog
```ts
// Source: app/src/stores/paintStore.ts setFrame. [VERIFIED: codebase]
setFrame(layerId: string, frame: number, pf: PaintFrame): void {
  _getOrCreateFrame(layerId, frame)
  _frames.get(layerId)!.set(frame, pf)
  this.markDirty(layerId, frame)
  paintVersion.value++
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Standalone-only v0.8.0 Phase 35 wording. [VERIFIED: requirements] | Phase 35 includes app entry point and apply-back workflow. [VERIFIED: context] | Phase 35 discussion on 2026-06-08. [VERIFIED: context] | Planner must include editor layer/button/return path now, not defer all integration to Phase 37. [VERIFIED: context] |
| Headless adapter / editor-driven replay. [VERIFIED: state] | Standalone engine remains interactive owner; app receives rendered outputs. [VERIFIED: context] | v0.7 failure post-mortem carried into v0.8.0. [VERIFIED: state] | Avoids quality/performance failure and keeps physics behavior live. [VERIFIED: user memory] |
| Existing `paint` layer for basic/FX paint. [VERIFIED: codebase] | Additive `physic-paint` layer/tool. [VERIFIED: requirements] | v0.8.0 requirement PAINT-04. [VERIFIED: requirements] | Existing perfect-freehand and p5.brush paths remain untouched. [VERIFIED: user memory] |
| Demo toolbar with Save/Load as generic standalone controls. [VERIFIED: codebase] | Save/Load are editable state files; apply canvas/play canvas are rendered-output app actions. [VERIFIED: context] | Phase 35 D-11/D-12. [VERIFIED: context] | Planner must not conflate import/export with app apply-back. [VERIFIED: context] |

**Deprecated/outdated:**
- Treating Phase 35 as standalone-only controls is outdated by D-13. [VERIFIED: context]
- Treating rendered output proof/integration contract as wholly later-phase-only is outdated by D-13, although the planner should keep durable persistence/contracts minimal. [VERIFIED: context] [ASSUMED]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Best implementation is a distinct `physic-paint` layer type/source. | Summary / Patterns | Medium; if user prefers reusing `paint`, planner must still isolate basic/FX paths. |
| A2 | File-backed rendered frame cache is safer than large event payloads for multi-frame apply. | Standard Stack / Pitfalls | Medium; data URLs may be acceptable for small UAT frame counts but not scalable. |
| A3 | A new `physicPaintStore` is the cleanest place for rendered output state. | Project Structure / Patterns | Medium; implementation may instead extend `paintStore` or `imageStore`. |
| A4 | `AnimationPlayer` is acceptable for `[apply play canvas]` frame generation. | Stack / Code Examples | Medium; user may expect live physics evolution frames rather than stroke reveal playback. |
| A5 | `physic-paint` preview/export should be implemented through a drawable rendered-frame source. | Pitfalls | Medium; an overlay compositor path could be chosen instead. |
| A6 | Operation IDs are needed to deduplicate apply payloads. | Pitfalls | Low; cleanup may be sufficient if window/listener ownership is simple. |

## Open Questions (RESOLVED)

1. **RESOLVED: `[apply play canvas]` means generated stroke-reveal frames from the existing `AnimationPlayer`, not passive live physics evolution.**
   - Decision: Implement `[apply play canvas]` with `AnimationPlayer.play({ frameCount, fps, onFrame })`, capture `engine.getDisplayCanvas().toDataURL(image/png)` for each generated frame, and map generated frame index `i` to app frame `startFrame + i` per D-09/D-10. [VERIFIED: codebase] [VERIFIED: context]
   - Rationale: The locked decision says “generated frame sequence” and D-02/D-03 prohibit editor-side editable stroke/engine replay. The package already owns the interactive engine and exposes a frame-generation callback; using it preserves physics-paint as the standalone editing surface without resurrecting the rejected app adapter path. [VERIFIED: context] [VERIFIED: codebase]
   - Scope effect: Plans 35-03 and 35-04 must state that the sequence payload contains rendered-output-only frames with explicit `appFrame = startFrame + generatedFrameIndex` mapping. [VERIFIED: planning]

2. **RESOLVED: Rendered frames are stored in the app-side `physicPaintStore` in-memory UAT cache for Phase 35.**
   - Decision: Phase 35 stores applied still/sequence outputs as rendered frame data URLs or stable rendered-frame refs in `physicPaintStore`, keyed by `layerId` and app frame. It does not create project assets, paint sidecars, or durable `.mce` persistence for these outputs. [VERIFIED: context]
   - Rationale: D-13 expands Phase 35 to prove the editor-to-standalone-to-editor workflow now, while durable persistence/output contracts remain later roadmap work. In-memory rendered-output storage gives immediate preview/timeline proof without conflating editable state-file import/export (D-11/D-12) with app apply-back. [VERIFIED: context]
   - Scope effect: Plans 35-01 and 35-04 keep `physicPaintStore` as the storage target; any file-backed/project-asset persistence remains outside this phase unless later user decisions change scope. [VERIFIED: planning]

3. **RESOLVED: Open/apply transport uses Tauri events in runtime and browser CustomEvent/window fallback in dev.**
   - Decision: `openPhysicPaintCanvas` uses dynamic Tauri WebviewWindow/event imports when available to open or focus the standalone window and pass `PhysicPaintLaunchContext`; when Tauri APIs are unavailable, it opens a browser/dev standalone URL with encoded launch context and uses `window.dispatchEvent`/`window.addEventListener` CustomEvents on `physic-paint:apply` and `physic-paint:apply-result`. [CITED: https://v2.tauri.app/reference/javascript/api/namespacewebviewwindow/] [CITED: https://v2.tauri.app/reference/javascript/api/namespaceevent/]
   - Event contract: Standalone `[apply canvas]` and `[apply play canvas]` emit/send exactly one `PhysicPaintApplyPayload` on `physic-paint:apply`; the app listener validates and applies it, then emits/sends `PhysicPaintApplyResult` on `physic-paint:apply-result` with the same `operationId`, `kind`, `layerId`, `startFrame`, `appliedFrameCount`, `ok`, and optional `error`. [VERIFIED: context]
   - Runtime behavior: In Tauri runtime, the standalone uses Tauri event APIs (`emit`/window emit) and the app consumes them through `installPhysicPaintApplyListener` cleanup. In browser/dev fallback, the same payload/result shapes cross via CustomEvent between opener/child windows where available, with visible failure copy if the opener/listener is unavailable. [VERIFIED: planning]
   - Scope effect: Plans 35-03, 35-04, and 35-05 must explicitly cover standalone-to-app apply emission, app listener consumption, browser fallback, Tauri behavior, rendered-output-only payloads, frame mapping, and visible result feedback. [VERIFIED: planning]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | TypeScript/Vite/pnpm checks | Yes [VERIFIED: environment] | v24.15.0 [VERIFIED: environment] | None |
| pnpm | Workspace commands | Yes [VERIFIED: environment] | 10.27.0 [VERIFIED: environment] | None; project standard is pnpm. [VERIFIED: user memory] |
| Cargo/Rust | Tauri command/capability changes | Yes [VERIFIED: environment] | cargo 1.93.1 [VERIFIED: environment] | Avoid Rust changes if browser-only seam chosen. [ASSUMED] |
| Tauri app runtime/dev server | Live window/UAT | Not run by Claude [VERIFIED: codebase] | app deps `@tauri-apps/api ^2.10.1`, CLI `^2.10.0` [VERIFIED: codebase] | User runs server/app per CLAUDE.md. [VERIFIED: codebase] |
| Browser Canvas APIs | Capture rendered output | Assumed available in app/webview [ASSUMED] | Browser-provided | Manual UAT catches runtime gaps. [ASSUMED] |

**Missing dependencies with no fallback:** none for planning. [VERIFIED: environment]

**Missing dependencies with fallback:** Live server/runtime validation is intentionally delegated to the user because CLAUDE.md says not to run servers. [VERIFIED: codebase]

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest for app TS tests; TypeScript compiler/build checks for app and package. [VERIFIED: codebase] |
| Config file | `app/vitest.config.ts` includes `src/**/*.test.ts`; package uses `tsc --noEmit` and `demo:build`. [VERIFIED: codebase] |
| Quick run command | `pnpm --filter efx-motion-editor build` for app type/build smoke; `pnpm --filter @efxlab/efx-physic-paint check` for package edits. [VERIFIED: codebase] |
| Full suite command | `pnpm --filter efx-motion-editor build && pnpm --filter @efxlab/efx-physic-paint build && pnpm --filter @efxlab/efx-physic-paint demo:build` [VERIFIED: codebase] |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAINT-01 | Standalone uses local package and live canvas accepts pointer paint. [VERIFIED: requirements] | build + manual smoke | `pnpm --filter @efxlab/efx-physic-paint demo:build`; user manually runs `pnpm dev:paint`. [VERIFIED: codebase] | Demo files exist. [VERIFIED: codebase] |
| PAINT-02 | Toolbar controls update real engine settings. [VERIFIED: requirements] | unit/static + manual smoke | `pnpm --filter @efxlab/efx-physic-paint check`; optional component test not currently configured. [VERIFIED: codebase] | `Toolbar.tsx` exists. [VERIFIED: codebase] |
| PAINT-03 | Paint and erase tools call engine APIs. [VERIFIED: requirements] | static/build + manual smoke | `pnpm --filter @efxlab/efx-physic-paint check` [VERIFIED: codebase] | `ToolType` and toolbar handlers exist. [VERIFIED: codebase] |
| PAINT-04 | Physics paint remains separate from basic and FX paint. [VERIFIED: requirements] | app unit/type | Add/update app tests around layer creation and paint mode preservation; run `pnpm --filter efx-motion-editor build`. [ASSUMED] | No `physic-paint` type exists yet. [VERIFIED: codebase] |
| DIAG-01 | Readiness/session/settings/errors visible. [VERIFIED: requirements] | component/manual | Build checks plus user manual UAT; add tests for readiness state derivation if extracted into pure helper. [ASSUMED] | Only mount error/status exists today. [VERIFIED: codebase] |

### Sampling Rate
- **Per task commit:** `pnpm --filter efx-motion-editor build` for app changes or `pnpm --filter @efxlab/efx-physic-paint check` for package-only changes. [VERIFIED: codebase]
- **Per wave merge:** app build + package build + package demo build. [VERIFIED: codebase]
- **Phase gate:** User-run UAT in Tauri/app and standalone: create/select `physic-paint`, open `[open fx paint canvas]`, paint, erase, change settings, see diagnostics, `[apply canvas]`, `[apply play canvas]` with N frames from current app frame. [VERIFIED: context]

### Wave 0 Gaps
- [ ] `app/src/types/physicPaint.ts` or equivalent typed payload definitions. [ASSUMED]
- [ ] `app/src/stores/physicPaintStore.ts` or equivalent rendered-output state/cache. [ASSUMED]
- [ ] `app/src/components/sidebar/PhysicPaintProperties.tsx` with exact `[open fx paint canvas]` label. [VERIFIED: context]
- [ ] `LayerType`/`LayerSourceData` additions for `physic-paint`. [VERIFIED: codebase]
- [ ] Preview/export renderer support for `physic-paint` rendered frames. [VERIFIED: codebase]
- [ ] Standalone diagnostics/apply controls beyond existing toolbar. [VERIFIED: requirements]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No [VERIFIED: context] | Local desktop workflow has no auth surface. [VERIFIED: context] |
| V3 Session Management | No [VERIFIED: context] | No web sessions/cookies needed. [VERIFIED: context] |
| V4 Access Control | Yes [ASSUMED] | Validate apply payload `layerId` exists and is selected/expected; do not apply to arbitrary layer/frame from untrusted events. [ASSUMED] |
| V5 Input Validation | Yes [VERIFIED: requirements] | Clamp frame count, validate serialized project JSON on import, validate apply payload schema before state mutation. [VERIFIED: codebase] [ASSUMED] |
| V6 Cryptography | No [VERIFIED: context] | No crypto or secrets required. [VERIFIED: context] |
| V14 Configuration | Yes [ASSUMED] | Keep Tauri capabilities scoped to current windows/events/fs needs; do not broaden fs scope unless necessary. [VERIFIED: codebase] [ASSUMED] |

### Known Threat Patterns for Tauri/Canvas Apply-Back

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Oversized frame-count or payload causing UI freeze/memory pressure | Denial of Service | Clamp frame count; prefer file references for large sequences; expose diagnostics/errors. [CITED: https://v2.tauri.app/develop/calling-frontend/] [ASSUMED] |
| Applying output to wrong layer/frame | Tampering | Include and validate launch/apply context `{ layerId, startFrame, operationId }`; reject stale/unknown contexts. [ASSUMED] |
| Event listener leak causing duplicate applies | Tampering / DoS | Use Tauri `listen` unlisten cleanup on unmount. [CITED: https://v2.tauri.app/develop/calling-frontend/] |
| JSON state-file import crash | Tampering | Reuse current `isSerializedProject` guard and visible error handling in `Toolbar`. [VERIFIED: codebase] |
| Broad filesystem writes | Information Disclosure / Tampering | Reuse existing export/project paths and `export_write_png` atomic write; avoid arbitrary user-supplied path writes in apply flow. [VERIFIED: codebase] [ASSUMED] |

## Sources

### Primary (HIGH confidence)
- `.planning/phases/35-interactive-physics-paint-controls/35-CONTEXT.md` — locked decisions D-01 through D-13 and scope expansion. [VERIFIED: codebase]
- `.planning/REQUIREMENTS.md` — PAINT-01/02/03/04 and DIAG-01 definitions. [VERIFIED: codebase]
- `.planning/STATE.md` — v0.8.0 standalone-first and rejected batch/headless adapter context. [VERIFIED: codebase]
- `packages/efx-physic-paint/demo/src/App.tsx`, `Toolbar.tsx`, `src/engine/EfxPaintEngine.ts`, `src/preact.tsx`, `src/types.ts`, `src/animation/AnimationPlayer.ts` — current engine/demo/control APIs. [VERIFIED: codebase]
- `app/src/types/layer.ts`, `app/src/components/timeline/AddFxMenu.tsx`, `app/src/components/sidebar/PaintProperties.tsx`, `app/src/stores/paintStore.ts`, `app/src/lib/previewRenderer.ts` — current app layer/paint/preview architecture. [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- Tauri v2 official docs on backend/frontend events and unlisten lifecycle. [CITED: https://v2.tauri.app/develop/calling-frontend/]
- Tauri v2 JS event API reference for `emit`, `emitTo`, `listen`, `once`, and `UnlistenFn`. [CITED: https://v2.tauri.app/reference/javascript/api/namespaceevent/]
- Tauri v2 WebviewWindow reference for `new WebviewWindow`, `emit`, and `listen`. [CITED: https://v2.tauri.app/reference/javascript/api/namespacewebviewwindow/]

### Tertiary (LOW confidence)
- Assumptions in the Assumptions Log about best storage/cache shape, deduplication IDs, browser fallback, and exact `[apply play canvas]` semantics. [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all implementation can use existing local package, Preact, signals, Tauri, and Canvas APIs; no new dependencies are recommended. [VERIFIED: codebase]
- Architecture: MEDIUM — user-facing flow is locked, but storage/cache and exact window/event mechanism still need implementation decisions. [VERIFIED: context] [ASSUMED]
- Pitfalls: MEDIUM — codebase boundaries and prior failures are well verified; generated-frame semantics and payload-size limits need planner/user confirmation. [VERIFIED: codebase] [ASSUMED]

**Research date:** 2026-06-08
**Valid until:** 2026-06-22 for Tauri/window API and project architecture; revisit sooner if Phase 36/37 scope is re-discussed. [ASSUMED]
