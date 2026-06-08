# Pitfalls Research

**Domain:** standalone `@efxlab/efx-physic-paint` app/demo and future editor transport seam
**Researched:** 2026-06-08
**Confidence:** HIGH for project-specific failure modes from `.planning` history and package inspection; MEDIUM for exact phase names because roadmap is not yet created.

## Critical Pitfalls

### Pitfall 1: Recreating the abandoned headless adapter/batch-render path under a new name

**What goes wrong:**
The milestone claims to build a standalone app but quietly optimizes for a headless API such as `renderFromStrokes`, `renderAllStrokes`, `renderPartialStrokes`, or forced stroke replay for every frame. The visible result may be acceptable for a still image, but the physics character is wrong: wet paint interactions, local diffusion, natural drying, and elapsed-time behavior collapse into deterministic stroke replay plus `forceDryAll()`. This repeats the Phases 27-32 failure mode: lower visual quality and O(n²)-style replay cost as stroke count grows.

**Why it happens:**
The editor already has a cached frame compositing pipeline, so it is tempting to force the physics engine into the same frame renderer shape. The current engine also exposes methods that look integration-friendly (`renderAllStrokes()`, `renderPartialStrokes()`, `getStrokes()`), but the implementation force-dries after strokes and bypasses interactive timing. Those methods are useful for limited animation/replay experiments, not as the primary architecture for physics paint integration.

**How to avoid:**
1. Define the milestone success criterion as an interactive stateful paint surface first, not a renderer function.
2. Keep one long-lived `EfxPaintEngine` instance per standalone canvas session; do not recreate it per frame, per stroke, or per export sample.
3. Treat still/sequence export as capture of the interactive engine result (`getDisplayCanvas()` or an explicit capture API), not reconstruction through batch replay.
4. For future editor integration, design a transport seam that sends cached outputs and project metadata from the standalone window to the editor cache, rather than asking the editor renderer to simulate physics headlessly.
5. Add a roadmap gate: any API named like `renderFromStrokes` must be explicitly rejected unless it preserves interactive elapsed-time simulation.

**Warning signs:**
- New code calls `forceDryAll()` or `forceDry()` as part of normal export or frame preview.
- Export implementation loops over all strokes for every output frame.
- A demo can load strokes but does not let the user paint and watch local diffusion happen live.
- Visual output changes when the same stroke list is replayed versus painted interactively.
- CPU cost grows dramatically after 20-50 strokes.

**Phase to address:**
Phase 1: architecture/API guardrails before any demo UI. Make “no headless batch renderer as integration path” a written non-goal and verification item.

---

### Pitfall 2: Shipping a “standalone app” that is only a library watch build

**What goes wrong:**
The package appears standalone because it has `README.md`, exports, and `dev:watch`, but there is no runnable demo command in `packages/efx-physic-paint/package.json`: only `build`, `dev:watch`, and `check` exist. The README says `pnpm dev`, but the package has no `dev` script. The milestone could accidentally stop at tsup library build validation while users still cannot open a physics paint window and test the engine interactively.

**Why it happens:**
The package was introduced as a workspace library during v0.7.0 and deferred after adapter failure. Its current package shape is library-first, not app-first. The root has `pnpm dev:paint` wired to `tsup --watch`, which is useful for building `dist`, but it does not launch a Vite page, Tauri window, or any visible paint surface.

**How to avoid:**
1. Add an explicit standalone demo entry (`packages/efx-physic-paint/demo` or equivalent) with a Vite dev server and a package script that actually opens a browser-renderable app.
2. Keep `dev:watch` for library builds, but do not count it as the standalone milestone deliverable.
3. Add root scripts that distinguish the workflows clearly, for example: `dev:paint:demo` for the interactive demo and `dev:paint:watch` for tsup.
4. Update README commands only after the scripts exist and are verified.
5. Include a smoke test or checklist item: from a clean checkout, `pnpm --filter @efxlab/efx-physic-paint dev` must produce a visible canvas with tools.

**Warning signs:**
- `pnpm --filter @efxlab/efx-physic-paint dev` fails with “Missing script: dev”.
- The only verified command is `tsup --watch`.
- The roadmap marks “standalone runnable” complete after type-check/build only.
- README and package scripts disagree.

**Phase to address:**
Phase 2: standalone demo scaffold. This should be the first implementation phase after guardrails.

---

### Pitfall 3: Trusting the current README/API surface without auditing it against code

**What goes wrong:**
Roadmap tasks or tests are written against API names documented in the README that do not match the inspected implementation. README examples use `new EfxPaintEngine(canvas, { paperPath })`, `onEngineReady()`, `setOpacity()`, `clearCanvas()`, `loadProject()`, `saveProject()`, and Preact props like `paperPath`/`onEngine`. The actual code constructs `EfxPaintEngine(container: HTMLElement, { papers, defaultPaper })`, requires `await engine.init()`, exposes `setBrushOpacity()`, `clear()`, `save()`, `load()`, and the Preact wrapper uses `onEngineReady` with `papers`/`defaultPaper`.

**Why it happens:**
The package evolved from an HTML prototype and prior drafts. The README describes an intended public API while `src/engine/EfxPaintEngine.ts`, `src/types.ts`, and `src/preact.tsx` reflect the current working API. In a standalone milestone, stale docs are dangerous because they make the wrong thing feel already specified.

**How to avoid:**
1. Start with an API audit plan: compare README, `src/index.ts`, `src/preact.tsx`, `src/types.ts`, and `EfxPaintEngine.ts`.
2. Choose the real API intentionally and update docs/examples before building demo UI around them.
3. Add a tiny demo compile test that imports the same public entry points users will use: `@efxlab/efx-physic-paint` and `@efxlab/efx-physic-paint/preact`.
4. Avoid adding compatibility shims for stale README names unless they are needed for a clear reason; this repo has explicitly accepted clean breaks for format changes.
5. Keep engine API names explicit about semantics: e.g. `captureDisplayCanvas()` is clearer than reusing `save()` for pixels.

**Warning signs:**
- Demo code imports methods that TypeScript cannot find.
- The Preact wrapper example compiles only after casting props to `any`.
- New requirements mention `paperPath` although `EngineConfig` uses `papers` and `defaultPaper`.
- A plan says “wire documented API” without first reconciling documentation against source.

**Phase to address:**
Phase 1: API audit and documentation correction. Do this before demo scaffold and before transport design.

---

### Pitfall 4: Capturing the wrong canvas and losing wet paint/preview state

**What goes wrong:**
Standalone export captures `getCanvas()` because it sounds like the output canvas, but `getCanvas()` returns the dry canvas. The live visual surface is composed in the display canvas via `getDisplayCanvas()`, where wet-layer compositing, stroke preview, and cursor overlay are drawn by the render loop. Capturing only the dry canvas can omit wet paint, diffusion-in-progress, or the visual state the user is evaluating.

**Why it happens:**
The engine uses a dual-canvas architecture: dry canvas for baked paint/background and display canvas for wet compositing. This is correct for interactive rendering, but ambiguous for export unless the milestone defines which layers are included. The cursor/preview should not be exported, but wet paint probably should be if the user captures before full drying.

**How to avoid:**
1. Add an explicit export/capture API in the engine or demo layer with named modes: `dryOnly`, `visualPaint`, and optionally `visualWithUI` for debugging.
2. For user-facing still/frame export, capture paint content without cursor and without in-progress preview stroke; do not blindly call `getCanvas()`.
3. Add a manual test: paint a very wet stroke, export before it dries, and confirm the exported image matches the visible paint result.
4. Document whether export implies “bake/dry first” or “capture current wet state”. Prefer preserving the visible interactive state for this milestone.
5. For the future editor seam, transport rendered pixels plus metadata describing capture mode and background mode.

**Warning signs:**
- Export looks lighter, harder-edged, or missing compared to the visible standalone canvas.
- Wet diffusion visible on screen disappears in saved PNG.
- A capture function calls only `engine.getCanvas().toDataURL()` without considering `getDisplayCanvas()`.
- Cursor or red stroke preview appears in exported frames.

**Phase to address:**
Phase 4: still/frame-sequence export. Define capture semantics before adding file save UI.

---

### Pitfall 5: Treating stroke serialization as visually deterministic output

**What goes wrong:**
The standalone app saves only strokes and settings, then later reloads/replays them expecting the same image. But the current `save()` format records compact stroke points and optional `diffusionFrames`, while replay paths force dry after strokes and do not fully reconstruct all interactive elapsed-time states. The serialized project is valuable as editable source data, but it is not yet a guaranteed visual cache for editor compositing.

**Why it happens:**
Physics paint is temporal and stateful: local diffusion, natural drying intervals, wet buffers, saved wet buffers, fluid velocity fields, and paper texture sampling all affect the final look. The code intentionally does not persist large wet/fluid buffers, which is the right default for project size. The mistake is to confuse “can replay strokes” with “can reproduce the exact interactive result later”.

**How to avoid:**
1. Separate two artifacts in the milestone: editable physics project JSON and flattened visual output PNG/frame sequence.
2. Make the future editor transport consume flattened/cached output for compositing, not raw strokes as the primary render source.
3. If stroke replay is kept, label it as approximate/editable replay unless tests prove deterministic parity.
4. Include `version`, `width`, `height`, paper key, background mode, capture mode, and engine version in exported sidecar metadata.
5. Add a parity test: paint interactively, save/reload, capture both results, and compare visually or via pixel diff with a tolerance. If it fails, the roadmap should still pass by relying on flattened output for editor integration.

**Warning signs:**
- Transport design contains only `strokes` and no cached image/frame artifact.
- Reloaded strokes visibly differ from the pre-save canvas after wet/dry interactions.
- Export code depends on `renderAllStrokes()` or `renderPartialStrokes()` for final compositing.
- Requirements call stroke JSON “the cache”.

**Phase to address:**
Phase 4: export artifacts and Phase 5: transport seam. The distinction between editable source and compositing cache must be explicit.

---

### Pitfall 6: Letting the engine own all pointer events in a future editor integration

**What goes wrong:**
The standalone demo works because `EfxPaintEngine` attaches pointer listeners directly to its dry canvas and owns pointer capture, `preventDefault()`, cursor tracking, stroke preview, and `touchstart`. If this same component is embedded naively in the editor later, it can conflict with existing paint mode gating, global shortcuts, transform overlays, timeline focus, canvas zoom/pan, and the known requirement that shortcuts must check `isPaintEditMode()`.

**Why it happens:**
The engine is currently designed as a self-contained interactive widget, which is correct for the standalone milestone. The editor, however, has its own input architecture and mode system. The future seam should be a window/transport boundary, not a direct overlay that competes for DOM events inside the editor canvas.

**How to avoid:**
1. Keep standalone input ownership inside the standalone app/window.
2. For future integration, prefer opening the standalone paint surface as a dedicated window/session and transporting outputs back to the editor.
3. Do not embed `EfxPaintCanvas` directly in the editor preview canvas during this milestone.
4. Document input ownership in the transport notes: the editor sends context and receives results; it does not drive per-pointer physics events.
5. If direct embedding is ever revisited, require an explicit input adapter plan with shortcut guards and overlay conflict tests.

**Warning signs:**
- Plans mention “drop `EfxPaintCanvas` into `PaintOverlay`” as the next integration step.
- Standalone code starts importing editor stores or `isPaintEditMode()`.
- Global shortcuts trigger while painting in the physics canvas.
- Canvas zoom/pan gestures fight with brush strokes.

**Phase to address:**
Phase 5: future transport seam notes. The milestone should protect the later architecture even though editor integration is out of scope.

---

### Pitfall 7: Adding Preact UI state inside the library as if it were editor state

**What goes wrong:**
The demo grows a rich UI by putting application state, persistence, and future editor assumptions inside `packages/efx-physic-paint/src/preact.tsx` or library internals. Later, the editor cannot reuse the engine cleanly because the package has mixed concerns: rendering engine, standalone app shell, Preact controls, saved preferences, and transport behavior.

**Why it happens:**
The package already has a Preact subpath export, and Preact is available as an optional peer. It is tempting to expand `EfxPaintCanvas` into a full control panel. But the current wrapper is intentionally thin: create engine, call `init()`, expose `onEngineReady`, destroy on unmount.

**How to avoid:**
1. Keep `src/preact.tsx` a thin wrapper around `EfxPaintEngine`.
2. Put demo UI state in a demo app directory, not in the library export surface.
3. Keep the engine package signal-agnostic: callbacks and plain values only. Do not import editor stores, Preact Signals, or Tauri APIs into engine code.
4. If reusable controls are needed, export them separately only after the standalone UX stabilizes.
5. Add dependency checks: engine core should stay free of editor-only dependencies and heavy UI libraries.

**Warning signs:**
- `src/preact.tsx` starts containing toolbar state, file dialogs, export logic, or transport code.
- Library code imports from `app/src` or `.planning` assumptions.
- The standalone demo cannot be modified without changing public library exports.
- Preact Signals become part of the engine API.

**Phase to address:**
Phase 2: standalone demo scaffold and Phase 3: tool UI. Establish folder boundaries before UI grows.

---

### Pitfall 8: Ignoring async paper initialization and exporting before textures are ready

**What goes wrong:**
The demo constructs `EfxPaintEngine`, immediately enables tools or export, and captures output before `engine.init()` finishes loading paper textures. Strokes render on a fallback/procedural or wrong background, then change after textures load. Saved output differs from what later sessions produce.

**Why it happens:**
Paper loading is asynchronous. The Preact wrapper calls `engine.init().then(() => onEngineReady(engine))`, but the constructor also draws an initial background before textures are loaded. A demo that bypasses readiness will appear to work on simple white/transparent backgrounds and fail only with textured paper.

**How to avoid:**
1. Disable tools, load, and export until `init()` resolves.
2. Show a visible “loading paper” state in the standalone app.
3. Include paper texture readiness in export metadata.
4. Add a test with at least one real paper texture path and one missing texture path.
5. Decide fallback behavior: missing texture should produce a clear warning, not silent visual drift.

**Warning signs:**
- `onEngineReady` fires before `init()` resolves or is ignored by the app.
- First exported frame has different grain/emboss than the canvas after a second.
- Console shows “Failed to load paper texture” but UI still says ready.
- Requirements only test transparent/white background.

**Phase to address:**
Phase 2: standalone demo scaffold. Readiness gating should exist before tools/export are added.

---

### Pitfall 9: Memory blowups from full-resolution physics buffers and undo snapshots

**What goes wrong:**
The standalone demo lets users create large canvases or frame sequences at editor/export resolution, then allocates many `Float32Array` buffers, canvas `ImageData` snapshots, and undo states. A 4K canvas can consume hundreds of MB quickly; undo snapshots clone dry canvas plus wet/saved buffers. The app stutters or crashes during painting, export, or long sessions.

**Why it happens:**
`EfxPaintEngine` owns multiple per-pixel buffers: wet layers, saved wet layers, drying positions, fluid grids, masks, displacement arrays, color maps, canvases, and undo snapshots. This is appropriate for an interactive engine but must be bounded. The editor’s final output resolution may be much higher than the comfortable simulation resolution.

**How to avoid:**
1. Choose a fixed or capped standalone simulation size for v0.8.0, such as the current default 1000x650 or a bounded 720p-class canvas.
2. Do not promise 4K physics simulation in the standalone milestone.
3. Add visible canvas size controls only if memory limits are enforced.
4. Keep undo stack bounded and expose the current limit in code comments/tests; current engine caps at 25 snapshots, which should be reviewed against canvas size.
5. For future editor compositing, scale cached output intentionally rather than simulating at arbitrary project resolution by default.

**Warning signs:**
- Roadmap accepts arbitrary sequence/project resolution for the physics engine.
- Export tries to instantiate one engine per frame at full editor resolution.
- Activity Monitor memory jumps by hundreds of MB after a few strokes.
- Undo becomes slow or unreliable on larger canvases.

**Phase to address:**
Phase 2: demo scaffold for size caps; Phase 4: export for frame-sequence memory strategy.

---

### Pitfall 10: Designing the transport seam as a private editor import instead of a stable artifact contract

**What goes wrong:**
The standalone app and editor become coupled through direct TypeScript imports, shared mutable engine instances, or editor store assumptions. The future integration is then hard to test independently and may reintroduce the failed in-process adapter architecture. The standalone app stops being standalone.

**Why it happens:**
Both packages live in the same pnpm workspace, so direct imports are easy. The editor already has paint sidecars and caches, which invites shortcut coupling. But the milestone goal is specifically to make physics paint runnable/testable before editor integration and to prepare a future transport path.

**How to avoid:**
1. Define transport as artifacts and messages, not shared engine state: input context, editable project JSON, flattened PNG/frame sequence, and metadata sidecar.
2. Keep transport notes in the package/demo docs, but do not implement editor store writes in this milestone.
3. Include enough metadata for later cached compositing: dimensions, fps/frame range if sequence, background mode, alpha mode, paper key, engine version, capture mode, and source project reference.
4. Ensure the standalone app can be tested without launching Tauri/editor.
5. Add a phase gate: no imports from `app/src` inside `packages/efx-physic-paint`.

**Warning signs:**
- Package code imports editor `paintStore`, `PreviewRenderer`, or Tauri persistence modules.
- “Transport” is just passing an `EfxPaintEngine` instance to the editor.
- Cached outputs lack dimensions/alpha/background metadata.
- Standalone demo cannot run after deleting editor-only imports.

**Phase to address:**
Phase 5: transport seam contract. This should happen after export exists but before any editor integration work.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Counting `tsup --watch` as the standalone app | Fast checkbox completion | No interactive test surface; milestone fails its core goal | Never |
| Using `renderAllStrokes()`/`renderPartialStrokes()` as export architecture | Quick image generation from stroke JSON | Repeats batch-render failure; poor physics fidelity; replay cost grows with strokes | Only for explicit debug/replay UI, not final export or editor seam |
| Capturing only `getCanvas()` | One-line PNG export | Misses wet display state; output differs from what user sees | Only for a clearly labeled “dry layer only” debug export |
| Putting demo toolbar/file-save logic in `src/preact.tsx` | Faster Preact coding | Bloats public library wrapper and couples UI to engine internals | Never; put demo app code in demo directory |
| Persisting wet/fluid buffers as JSON | Exact state recovery appears easier | Huge files, slow saves, brittle versioning | Never for normal project saves; only temporary binary debug dumps if explicitly gated |
| Directly importing editor stores into the package | Easy future integration prototype | Standalone package no longer standalone; transport seam becomes in-process adapter | Never in v0.8.0 |
| Supporting stale README API names as aliases | Avoids updating docs/examples | Permanent confusing API surface | Only if external published users require it; this repo can clean break before release |
| Allowing arbitrary canvas/export resolution | Impressive demo controls | Memory/GC spikes, undo snapshots explode | Only after explicit memory budget and size caps are implemented |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Package scripts | Assuming README `pnpm dev` works | Add and verify a real `dev` script for the standalone demo; keep `dev:watch` separate |
| Engine initialization | Enabling UI immediately after constructor | Await `engine.init()` or `onEngineReady` before paint/export actions |
| Preact wrapper | Expanding `EfxPaintCanvas` into a full app | Keep wrapper thin; standalone controls live outside library exports |
| Canvas capture | Using dry canvas as final visual output | Add explicit capture modes and test wet stroke export parity |
| Stroke save/load | Treating stroke JSON as final compositing cache | Save editable JSON plus flattened image/frame outputs |
| Future editor seam | Sharing engine instance across package/editor boundary | Exchange files/messages/artifacts; no direct editor store dependency |
| Input handling | Embedding engine canvas into editor overlay as-is | Keep input ownership in standalone window/session; document later adapter requirements |
| Paper textures | Silent fallback on failed texture load | Surface warnings and block “ready” state until intended assets are resolved or fallback confirmed |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Replaying all strokes for every exported frame | Export slows progressively; CPU spikes; quality differs from live painting | Capture the interactive result/cache frames; avoid per-frame full replay | Noticeable after dozens of strokes or multi-frame sequences |
| Instantiating `EfxPaintEngine` per frame/export sample | GC pauses, canvas allocation churn, memory spikes | Reuse one engine per session/export context | Immediately visible with frame sequences |
| Full-resolution physics simulation by default | Painting lag, undo slow, memory pressure | Cap simulation size for v0.8.0; scale output deliberately | Above 720p/1000x650-class canvases depending on stroke count |
| Undo snapshots on large canvases | Memory grows with every stroke; undo unreliable | Keep undo bounded, document limit, consider size-based cap | Large canvases or long sessions; current stack cap is 25 snapshots |
| Export before paper assets loaded | First frames differ from later frames | Gate export on readiness and texture load status | Any textured-paper workflow |
| Keeping natural drying intervals alive after demo unmount/window close | Background CPU use, stale timers, leaks | Always call `engine.destroy()` in demo cleanup and test remount | Repeated open/close of standalone window/demo |
| Capturing cursor/preview from display canvas | Export contains UI artifacts | Separate paint-content capture from debug visual capture | Any export during active stroke/hover |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Loading arbitrary paper/image URLs without constraints | Local app may attempt unwanted network/file loads or fail unpredictably | For v0.8.0, use bundled/demo assets or explicit file picker paths; record source in metadata |
| Writing exports without clear user-selected destination | Overwrites or scatters generated frames | Use explicit save/export path selection in standalone app; never auto-write into editor project folders in this milestone |
| Embedding absolute local paths in portable metadata as the only reference | Future editor cannot reopen/cache on another machine | Store relative artifact references where possible plus descriptive metadata; treat absolute paths as optional provenance |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Demo starts on a blank canvas with no obvious tool controls | User cannot validate physics behavior quickly | Provide minimal controls: color, size, water, dry speed, physics/local spread, paper/background, clear, undo, export |
| Exported image does not match visible canvas | User distrusts standalone output and future editor cache | Add “capture current visible paint” semantics and test wet stroke parity |
| Missing readiness/loading state for paper textures | First strokes look inconsistent or change after load | Disable controls until ready; show texture load errors clearly |
| Tool labels expose raw internal names only | Water/dry/pickup controls feel technical and hard to tune | Keep concise artist-facing labels, with internal params documented separately |
| Standalone demo tries to reproduce full editor paint UX | Milestone balloons and repeats over-scoping from v0.7.0 | Build only the controls needed to test physics and export artifacts |
| No visual indication of wet/local physics mode | User cannot tell whether simulation is active or baked | Show a simple status: local physics on/off, drying active, capture mode |
| Future seam notes are hidden in code comments only | Roadmap/integration repeats old adapter mistake | Put transport contract in a visible architecture note or package README section |

## "Looks Done But Isn't" Checklist

- [ ] **Standalone command:** `pnpm --filter @efxlab/efx-physic-paint dev` launches a visible interactive demo, not just tsup watch.
- [ ] **README/API parity:** README examples compile against actual `src/index.ts`, `src/preact.tsx`, and `EfxPaintEngine` methods.
- [ ] **Interactive physics:** User can paint, see local wet diffusion/drying behavior, undo, clear, and change core brush parameters.
- [ ] **No adapter relapse:** No primary deliverable depends on `renderFromStrokes`, per-frame full replay, or `forceDryAll()` as the normal output path.
- [ ] **Capture semantics:** Still export explicitly captures the intended paint state and excludes cursor/preview artifacts.
- [ ] **Wet export parity:** A wet stroke exported before drying matches the visible canvas within an acceptable tolerance.
- [ ] **Editable vs flattened artifacts:** Save/export produces both clear editable project data and flattened visual output, or explicitly documents which one is produced.
- [ ] **Frame sequence output:** If sequence export is included, frames are generated from captured/cached interactive states, not full stroke replay per frame.
- [ ] **Paper readiness:** Demo blocks paint/export until `init()` completes or a fallback is intentionally accepted.
- [ ] **Memory limits:** Canvas dimensions and undo stack limits are bounded and documented.
- [ ] **Transport seam:** Metadata sidecar includes dimensions, alpha/background mode, paper key, engine version, and capture mode.
- [ ] **Package boundary:** `packages/efx-physic-paint` has no imports from `app/src`.
- [ ] **Cleanup:** Demo unmount/window close calls `engine.destroy()` and does not leave intervals/rAF running.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Headless/batch path reintroduced | HIGH | Stop integration work, remove batch renderer from success path, rebuild around interactive capture and cached artifacts |
| No real standalone dev app | LOW | Add Vite demo entry and package script; update README; verify from clean checkout |
| README/API mismatch | LOW | Run API audit, update examples, add compile check for public imports |
| Wrong canvas exported | MEDIUM | Add explicit capture API/modes; regenerate export code; add wet parity test |
| Stroke JSON treated as visual cache | MEDIUM | Split editable project save from flattened image/frame export; add metadata sidecar |
| Engine coupled to editor stores | HIGH | Remove `app/src` imports, move coupling into future transport adapter outside package, restore standalone testability |
| Memory blowups | MEDIUM | Cap canvas size, reduce undo limit, avoid per-frame engine instances, document constraints |
| Async paper race | LOW | Gate ready state on `init()`, add loading/error UI, re-test texture export |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Recreating headless adapter/batch render | Phase 1: Architecture/API guardrails | Written non-goal; no primary output path uses `renderFromStrokes`/full replay/forced drying |
| Library watch build mistaken for standalone app | Phase 2: Standalone demo scaffold | `pnpm --filter @efxlab/efx-physic-paint dev` opens interactive canvas |
| README/API mismatch | Phase 1: API audit | README examples compile without casts against actual exports |
| Wrong canvas captured | Phase 4: Still/frame export | Wet visible stroke export matches canvas; cursor/preview excluded |
| Stroke serialization mistaken for visual cache | Phase 4: Export artifacts; Phase 5: Transport seam | Output includes flattened image/frame artifact plus metadata, not only strokes |
| Engine pointer ownership conflicts with editor | Phase 5: Transport seam | Integration notes specify standalone window/session ownership; no direct `PaintOverlay` embedding plan |
| Preact UI state leaking into library | Phase 2/3: Demo scaffold and tool UI | Demo controls live outside `src/preact.tsx`; wrapper stays thin |
| Async paper initialization race | Phase 2: Demo scaffold | Tools/export disabled until `engine.init()` resolves; missing texture warning visible |
| Memory blowups | Phase 2: Canvas sizing; Phase 4: Export | Canvas size capped; no per-frame engine instantiation; undo limit reviewed |
| Transport as private editor import | Phase 5: Transport seam contract | No `app/src` imports from package; sidecar metadata contract documented |

## Sources

- `.planning/PROJECT.md` — v0.8.0 active requirements and explicit exclusion of failed headless adapter approach.
- `.planning/MILESTONES.md` — v0.7.0 notes that Phases 27-32 were abandoned and physics paint deferred to standalone v0.8.0.
- `.planning/RETROSPECTIVE.md` — post-mortem: adapter approach was architecturally wrong because batch rendering kills physics quality and causes O(n²) complexity.
- `packages/efx-physic-paint/README.md` — current documented package promises and stale/mismatched demo API examples.
- `packages/efx-physic-paint/package.json` — current scripts expose build/watch/check only; no runnable `dev` demo script.
- `packages/efx-physic-paint/src/index.ts` — public root export currently only exposes `EfxPaintEngine` and types.
- `packages/efx-physic-paint/src/preact.tsx` — thin wrapper, async `init()` readiness, `onEngineReady`, `papers`/`defaultPaper` config.
- `packages/efx-physic-paint/src/types.ts` — actual `EngineConfig`, `ToolType`, `BrushOpts`, `PenPoint`, and serialization shape.
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` — stateful engine ownership, dual-canvas capture APIs, replay/force-dry paths, pointer event ownership, buffer allocation, undo snapshots.
- Root `package.json` and `pnpm-workspace.yaml` — workspace scripts and package boundaries.
- Project memory/user feedback — p5.brush remains FX layer; physics paint architecture is standalone window + transport; engine integration must be incremental; no legacy compatibility requirement for new format changes.

---
*Pitfalls research for: standalone efx-physic-paint milestone and future transport seam*
*Researched: 2026-06-08*
