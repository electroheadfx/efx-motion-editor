# Feature Research

**Domain:** Standalone physics paint demo/app for validating `@efxlab/efx-physic-paint` before EFX Motion Editor integration
**Researched:** 2026-06-08
**Confidence:** HIGH for current package APIs and project/milestone intent; MEDIUM for UX priority ordering because no live user testing has happened yet.

## Feature Landscape

### Table Stakes (Users Expect These)

Features the standalone app must provide for the user to trust that the original package works. Missing these means the milestone fails even if the library builds.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Runnable standalone dev command | The README claims `pnpm dev` starts a demo on localhost, but `packages/efx-physic-paint/package.json` currently only exposes `build`, `dev:watch`, and `check`. The user explicitly wants to run the package standalone and test it before editor integration. | LOW-MEDIUM | Add a package-level Vite/Preact demo entry or workspace script such as `pnpm --filter @efxlab/efx-physic-paint dev`. Depends on demo scaffold, Vite config, HTML entry, and assets. This is the first feature because no user-visible validation is possible without it. |
| Full-page interactive paint surface | The milestone is about proving live incremental physics, not a hidden library API. The app needs a large canvas where pointer/tablet input visibly paints. | LOW | Use existing `EfxPaintCanvas` / `EfxPaintEngine` constructor with `width`, `height`, `papers`, and `defaultPaper`. The Preact wrapper already creates/destroys the engine and calls `init()`. |
| Engine readiness and error state | Paper textures load asynchronously through `engine.init()`. If textures fail or the engine is not ready, the user needs clear feedback instead of a blank canvas. | LOW | The current Preact wrapper exposes `onEngineReady`, but not `onError`; the demo can instantiate `EfxPaintEngine` directly or extend the wrapper. Show “loading paper textures”, “ready”, and failure details. |
| Paint and erase tool switching | `ToolType` in `types.ts` is only `'paint' | 'erase'` despite older README text claiming 9 brush types. The demo must expose the tools that actually exist. | LOW | Use `engine.setTool('paint')` and `engine.setTool('erase')`. Do not include water/smear/blend/blow/wet/dry/pressure buttons unless those APIs are reintroduced. This also surfaces the README/API mismatch. |
| Brush size control | A tester must verify stroke scale, cursor scale, and physics behavior across small/large marks. | LOW | Use `engine.setBrushSize(size)`, actual range 1-80. Display range explicitly so users do not expect editor brush sizes up to 200. |
| Opacity / pressure / erase strength controls | Physics paint quality depends on stroke density and tablet pressure. Eraser behavior must be testable separately from paint. | LOW | Use `setBrushOpacity(10-100)`, `setBrushPressure(10-100)`, and `setEraseStrength(0-100)`. Pointer pressure is captured in `PenPoint.p`; the pressure slider is a multiplier. |
| Color picker with hex/RGB display | Users need to test paint colors, mixing, transparency, and saved stroke color serialization. | LOW | Use `engine.setColorHex(hex)`. The README currently documents `setColorRGB`, but source exposes `setColorHex`; the standalone demo should follow source and update docs later. |
| Physics controls: water, dry speed, physics strength | The package’s reason to exist is wet/dry physics. The demo must let the user make the effect obvious and reproducible. | LOW | Use `setWaterAmount(0-100)`, `setDrySpeed(0-100)`, and `setPhysicsStrength(0-100)`. These map to wet buffer behavior, drying LUT speed, and diffusion strength. |
| Manual physics run controls | The user needs to test incremental simulation quality after strokes, not just static stroke deposition. | MEDIUM | Buttons: “Run local”, “Run last stroke”, “Run all”, “Stop & bake”, “Force dry”. Use `startPhysics('local'|'last'|'all')`, `stopPhysics()`, and `forceDry()`. This directly validates the abandoned adapter lesson: physics must run interactively/incrementally rather than batch rendering from strokes. |
| Paper/background selector | Paper heightmaps are core to the engine: adsorption, grain, wet behavior, and emboss depend on them. | MEDIUM | Use `papers: PaperConfig[]`, `setPaperGrain(key)`, and `setBgMode('transparent'|'white'|'canvas1'|'canvas2'|'canvas3'|'photo')`. Requires bundled paper assets or procedural fallback. The initial milestone can ship bundled papers only; user photo background can be deferred unless already easy. |
| Transparent background toggle | Later editor integration needs cached paint output that can composite over EFX Motion Editor frames. The user must verify alpha output before integration begins. | LOW | Use `setBgMode('transparent')` and a checkerboard page background behind the canvas. Test both `getCanvas()` dry output and `getDisplayCanvas()` wet overlay. |
| Wet/dry visual status and explicit bake semantics | The engine has a dry canvas plus display canvas wet overlay. Users must understand whether they are seeing wet paint, baked dry paint, or both. | MEDIUM | Show state labels: active tool, physics running, wet paper on/off, current background. Provide “Force dry” and “Clear” as obvious controls. Use `forceDry()`, `clear()`, `startPhysics()`, `stopPhysics()`. |
| Undo and clear | Testers need rapid iteration without refreshing. Undo also validates internal stroke/action recording. | LOW | Use `engine.undo()` and `engine.clear()`. Undo stack is capped at 25 snapshots in source, so label it as stroke-level undo rather than unlimited history. |
| Save/load project JSON | The package promises `saveProject/loadProject` in README, while source exposes `save()` and `load()`. Standalone testing must prove serialization before the editor consumes the package. | MEDIUM | Add “Download JSON” and “Load JSON” buttons wired to `engine.save()` / `engine.load(serialized)`. Validate `SerializedProject.version: 2`, dimensions, strokes, settings, and point arrays. Consider UI labels “Save Engine JSON” and “Load Engine JSON” to avoid implying `.mce` editor format. |
| Stroke inspector | The user needs confidence that strokes are recorded with expected points, tool, color, params, timestamps, and diffusion frame metadata. | LOW-MEDIUM | Use `engine.getStrokes()` to show count, selected/latest stroke metadata, point count, params, and any `diffusionFrames`. This is more useful than a black-box canvas for pre-integration validation. |
| Still image export | The milestone requires inspectable/exportable output suitable for later cached compositing. A PNG export is the simplest user-visible proof. | MEDIUM | Export `engine.getDisplayCanvas().toDataURL('image/png')` for current visual output; optionally export dry-only `getCanvas()`. Include transparent background test. If browser security blocks download for some contexts, implement anchor download in the Vite demo. |
| Animation/replay preview | The package exports `AnimationPlayer`; the README advertises stroke replay. The demo should validate it independently of the editor timeline. | MEDIUM | Use `new AnimationPlayer(engine)` and `player.play({ frameCount, fps, onFrame, onComplete })`. Add frame count/FPS controls, play/stop, and visible frame index. This is table-stakes only because the package README advertises it. |
| Basic frame-sequence export from replay | Later editor integration needs cached frames; exporting replay frames proves that `onFrame(frameIndex, canvas)` can feed a cache. | HIGH | Implement “Export replay frames” as PNG downloads or a ZIP only if adding a ZIP dependency is acceptable. For MVP, sequential PNG downloads or “capture current frame” may be enough. Depends on AnimationPlayer preview and still image export. |
| API/docs alignment panel or README truth check | Current README and source disagree on tools and method names. The standalone milestone should not leave the user testing phantom capabilities. | LOW | Demo should expose the real API names and include a small “Implemented APIs used by this demo” section. Follow with README cleanup in the same milestone or a later docs task. |
| Performance/FPS indicator | Physics can be CPU-heavy due to typed arrays and per-pixel buffers. The tester needs to know whether slow behavior is a bug, a parameter issue, or expected. | MEDIUM | Show render/physics FPS, canvas size, stroke count, and whether physics interval is running. Do not overbuild profiling; a simple rAF FPS and physics run timer is enough. |

### Differentiators (Competitive Advantage)

Features that make the standalone test convincing, not just minimally runnable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Preset “test recipes” for watercolor/ink/dry brush | A non-technical user can immediately see the engine’s value without tuning 10 sliders. | MEDIUM | Create demo-only presets that set size, opacity, pressure, waterAmount, drySpeed, edgeDetail, pickup, antiAlias, viscosity, physicsStrength, wetPaper, and background. Source has continuous params, not named brush styles. Mark presets as demo recipes, not stable editor UX yet. |
| Side-by-side dry canvas vs display canvas | The engine’s dual-canvas model is central to integration. Showing both outputs clarifies what should be cached and what is just wet overlay. | MEDIUM | Use `getCanvas()` and `getDisplayCanvas()` or mirror canvases into preview panels. Helps decide future editor transport: dry baked frame vs display composite. |
| Transparent export checker | Makes alpha correctness visually obvious before editor compositing work starts. | LOW | Checkerboard behind transparent canvas plus PNG export. Include a “verify alpha” sample: paint partially transparent strokes, export, reload over white/dark checker. |
| Physics mode comparison buttons | Lets the user compare local, last-stroke, and all-canvas diffusion without reading source. | LOW | Use existing `startPhysics()` modes. Include descriptive labels: “Local interaction”, “Last stroke spread”, “All wet paint spread”. |
| Parameter snapshot / shareable test JSON | When the user finds a good look or a bug, they can share exact engine settings and strokes. | MEDIUM | Extend Save JSON or add “Copy debug snapshot” containing serialized project plus demo UI state. Useful for bug reports and future roadmap tuning. |
| Bundled smoke-test scenes | Provides deterministic examples: one stroke on transparent bg, wet-on-wet overlap, erase, paper grain, replay. | MEDIUM | Implement as buttons that clear/load small serialized projects or scripted strokes. Depends on serialization/load and maybe direct stroke generation. |
| Frame cache proof-of-concept export | Demonstrates the future standalone-window-to-editor path without integrating into EFX Motion Editor yet. | HIGH | Export a folder-like set of PNG frames plus JSON manifest in browser downloads. Do not build Tauri transport yet. This is the strongest differentiator for roadmap confidence but can be P2 after basic still export works. |
| Tablet input diagnostics | Helps validate pressure, tilt, and coalesced events on real hardware. | MEDIUM | Display latest `pressure`, `tiltX`, `tiltY`, `twist`, and coalesced point count if available. Engine records `PenPoint` fields, but exposing raw event diagnostics may need demo-level pointer listeners or engine hook additions. |
| Visual README/demo parity | The app becomes living documentation for the package. | LOW | Update README screenshots/commands after demo exists. This reduces future false starts from stale claims. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem attractive but would distract from the standalone validation milestone or repeat the failed adapter approach.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Editor integration in the same phase | The final goal is EFX Motion Editor integration, so it is tempting to wire it immediately. | The milestone explicitly exists because prior adapter integration failed. Combining standalone validation and editor transport makes it hard to tell whether failures are engine bugs, app shell bugs, or integration bugs. | Finish a standalone Vite demo first. Integration begins only after the user can run and test the package independently. |
| Headless batch `renderFromStrokes` as the primary demo | It sounds easier to export cached frames directly from saved strokes. | This repeats the abandoned approach: batch rendering loses the interactive incremental simulation behavior and can degrade physics quality. | Demo live engine sessions: draw, run physics, bake, inspect/save/export. Use batch replay only for AnimationPlayer validation, not as the main paint workflow. |
| Recreating the full EFX Motion Editor paint UI | Users may want familiar editor controls. | The standalone app is a package validation harness, not a mini editor. Recreating selection, bezier editing, frame layers, timeline, and sidecars burns time and blurs scope. | Minimal dark control panel with engine controls, export, serialization, and diagnostics. Keep editor-only interactions out. |
| Shipping claimed 9-tool toolbar from old README | README says paint/erase/water/smear/blend/blow/wet/dry/pressure. | Source `ToolType` is only `'paint' | 'erase'`; phantom buttons would be fake or broken. | Expose only real tools. Add “README mismatch fixed/known” task. Later add tools only if implemented in engine API. |
| Adding p5.brush or perfect-freehand fallback | It might make the demo prettier or familiar. | The milestone is to validate `efx-physic-paint`; fallbacks hide defects and reintroduce the old architecture. User memory says p5.brush remains the FX layer in the editor, but this milestone is specifically standalone physics paint. | Keep demo pure: only `@efxlab/efx-physic-paint` rendering. Compare later if needed, outside MVP. |
| Full `.mce` project persistence | Future integration will need editor-compatible persistence. | `.mce` sidecars and migration are editor concerns. Implementing them now risks rebuilding integration before engine validation. | Save/load engine `SerializedProject` JSON only. Add export manifest as future transport research artifact. |
| Tauri standalone window first | The eventual product might open a standalone window from the desktop app. | Tauri adds native-window complexity before the browser demo proves engine behavior. The package README already claims a Vite localhost demo, so fix that first. | Vite/Preact web demo now; Tauri window/IPC transport later after engine acceptance. |
| Advanced brush preset manager | Presets are useful and users may want to save them. | Preset CRUD is not necessary to validate physics and serialization; it creates UX work unrelated to engine proof. | Hard-code a few demo recipes, then store custom presets after user validates engine output. |
| Video encoding export | Users might expect MP4/GIF of replay. | Browser video encoding or FFmpeg integration is overkill and belongs to the editor/export pipeline. | Export PNG stills and optional PNG frame sequence. Editor can encode later using existing FFmpeg pipeline. |
| Backward compatibility for old editor projects | Existing editor users may have paint data. | User memory says no backward compatibility for old projects and this milestone is standalone package testing. Migration code would pull editor concerns into package validation. | Clean break for the standalone engine JSON. Editor integration can define a new paint-physics frame format later. |

## Feature Dependencies

```
[Runnable standalone dev command]
    └──requires──> [Demo scaffold: Vite/Preact entry, HTML, package scripts]
                       └──enables──> [All user-visible testing]

[Interactive paint surface]
    └──requires──> [Engine init + paper asset loading]
    └──requires──> [Readiness/error UI]
    └──enables──> [Tool controls, physics controls, save/export]

[Tool and brush controls]
    └──requires──> [Interactive paint surface]
    └──uses──> setTool, setBrushSize, setBrushOpacity, setBrushPressure, setEraseStrength, setColorHex

[Physics controls]
    └──requires──> [Interactive paint surface]
    └──uses──> setWaterAmount, setDrySpeed, setPhysicsStrength, setViscosity, setPhysicsMode, startPhysics, stopPhysics, forceDry
    └──enables──> [Incremental simulation validation]

[Paper/background/transparent controls]
    └──requires──> [Bundled paper assets]
    └──uses──> setPaperGrain, setBgMode, setWetPaper, setEmbossStrength
    └──enables──> [Transparent export checker]

[Save/load project JSON]
    └──requires──> [Interactive paint surface]
    └──uses──> save, load, getStrokes
    └──enables──> [Stroke inspector, parameter snapshot, smoke-test scenes]

[Still image export]
    └──requires──> [Interactive paint surface]
    └──uses──> getDisplayCanvas and optionally getCanvas
    └──enables──> [Transparent export checker]

[Animation/replay preview]
    └──requires──> [Recorded strokes from interactive painting]
    └──uses──> AnimationPlayer, getStrokes, renderPartialStrokes, getDisplayCanvas
    └──enables──> [Frame-sequence export]

[Frame-sequence export]
    └──requires──> [Animation/replay preview]
    └──requires──> [Still image export]
    └──enables──> [Future editor cache transport proof]

[API/docs alignment]
    └──requires──> [Demo implementation exposes real API]
    └──updates──> README commands, tool list, method names
```

### Dependency Notes

- **Runnable dev command is the milestone gate:** The package cannot be considered testable while README demo commands are not backed by package scripts.
- **Interactive paint surface precedes export:** Still/frame export is only meaningful after the user can create and visually inspect live physics output.
- **Manual physics controls are core, not advanced:** The user needs to test the engine behavior that failed under the prior adapter approach: incremental wet simulation, not only stroke replay.
- **Serialization and stroke inspection should come before frame-sequence export:** If saved strokes/params are wrong, exported frames only hide the problem as pixels.
- **Frame-sequence export is a bridge, not integration:** It proves cached outputs are possible without adding editor IPC, `.mce` persistence, or timeline compositing.
- **API/docs alignment must follow source, not README:** Source exposes `save()` / `load()` and `setColorHex()`, while README mentions `saveProject()` / `loadProject()` and `setColorRGB()`. The demo should use source APIs and the roadmap should include README cleanup.

## MVP Definition

### Launch With (v0.8.0 MVP)

Minimum viable standalone app — enough for the user to run, paint, test physics, save, and export without opening EFX Motion Editor.

- [ ] Package-level dev script and Vite/Preact demo entry — essential because the package currently has no runnable demo despite README claims.
- [ ] Full-page interactive paint canvas with readiness/error status — essential for live package validation.
- [ ] Paint/erase tools with size, color, opacity, pressure, erase strength — essential to test the implemented tool API.
- [ ] Physics controls for water, dry speed, physics strength, local/last/all run, stop/bake, force dry — essential to validate interactive incremental simulation.
- [ ] Paper/background selector with transparent mode and checkerboard — essential for later compositing confidence.
- [ ] Undo, clear, wet/dry status — essential for rapid manual testing.
- [ ] Save/load engine JSON and stroke inspector — essential to validate package serialization and recorded stroke data.
- [ ] PNG still export from display canvas and dry canvas — essential to prove inspectable/exportable output.
- [ ] README/API truth cleanup for demo commands and actual methods — essential to prevent another misleading integration attempt.

### Add After Validation (v0.8.x)

Features to add once the user confirms the basic standalone app works and the engine output is worth integrating.

- [ ] AnimationPlayer replay UI with frame count/FPS and current frame display — validates advertised animation API after core painting works.
- [ ] Basic replay frame export — proves cached frame output for future editor transport.
- [ ] Preset test recipes for watercolor/ink/dry brush — improves testing speed after raw controls are verified.
- [ ] FPS/performance indicator — useful once real strokes and physics sessions can be tested.
- [ ] Side-by-side dry/display preview — clarifies future cache choices after export flow exists.
- [ ] Smoke-test scene buttons — makes regression testing easier once save/load is stable.

### Future Consideration (Integration-Ready Later)

Features to defer until standalone behavior is validated.

- [ ] Tauri standalone window launched from EFX Motion Editor — integration phase, not package validation.
- [ ] Editor cache manifest format — design after still/frame export proves alpha and frame capture.
- [ ] Custom brush preset CRUD — defer until good parameter recipes are found.
- [ ] Tablet diagnostics overlay — add if pressure/tilt bugs are reported during live testing.
- [ ] User photo background loading — defer unless it is needed to validate compositing; transparent/white/paper modes cover MVP.
- [ ] MP4/GIF/video export — editor already owns FFmpeg/video export.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Runnable standalone dev command | HIGH | MEDIUM | P1 |
| Vite/Preact demo scaffold | HIGH | MEDIUM | P1 |
| Interactive paint surface | HIGH | LOW | P1 |
| Readiness/error UI | HIGH | LOW | P1 |
| Paint/erase controls | HIGH | LOW | P1 |
| Brush size/color/opacity/pressure controls | HIGH | LOW | P1 |
| Physics water/dry/strength controls | HIGH | LOW | P1 |
| Manual physics run/stop/bake/force-dry | HIGH | MEDIUM | P1 |
| Paper/background selector | HIGH | MEDIUM | P1 |
| Transparent checkerboard mode | HIGH | LOW | P1 |
| Undo/clear/status | HIGH | LOW | P1 |
| Save/load engine JSON | HIGH | MEDIUM | P1 |
| Stroke inspector | HIGH | LOW-MEDIUM | P1 |
| PNG still export | HIGH | MEDIUM | P1 |
| README/API cleanup | HIGH | LOW | P1 |
| AnimationPlayer replay UI | MEDIUM | MEDIUM | P2 |
| Replay frame export | MEDIUM | HIGH | P2 |
| Preset test recipes | MEDIUM | MEDIUM | P2 |
| FPS/performance indicator | MEDIUM | MEDIUM | P2 |
| Side-by-side dry/display preview | MEDIUM | MEDIUM | P2 |
| Smoke-test scenes | MEDIUM | MEDIUM | P2 |
| Tablet diagnostics | MEDIUM | MEDIUM | P3 |
| User photo background loading | LOW-MEDIUM | MEDIUM | P3 |
| Tauri standalone editor-launched window | HIGH later | HIGH | P3 |
| Video export | LOW for this milestone | HIGH | P3 |

**Priority key:**
- P1: Must have for standalone validation of `efx-physic-paint` before editor integration.
- P2: Should have after core validation; improves confidence and future transport design.
- P3: Nice to have or belongs to later editor integration.

## Existing Package API Dependency Matrix

| Demo Capability | Existing API/Source Dependency | Gap/Risk |
|-----------------|--------------------------------|----------|
| Create canvas | `new EfxPaintEngine(container, EngineConfig)`, `engine.init()`, or `EfxPaintCanvas` | Preact wrapper has `onEngineReady`, but no error callback. |
| Tool switch | `setTool('paint'|'erase')` | README advertises extra tools not present in `ToolType`. |
| Brush controls | `setBrushSize`, `setBrushOpacity`, `setBrushPressure`, `setEraseStrength` | README method names differ (`setOpacity`). Source is canonical. |
| Color | `setColorHex` | README advertises `setColorRGB`; demo should use `setColorHex` or add wrapper API intentionally. |
| Physics tuning | `setWaterAmount`, `setDrySpeed`, `setPhysicsStrength`, `setViscosity`, `setLocalSpreadStrength`, `setPhysicsMode` | Some knobs are advanced; MVP should expose main controls and maybe hide viscosity/local spread under “Advanced”. |
| Physics run | `startPhysics('local'|'last'|'all')`, `stopPhysics`, `forceDry` | Need clear UI semantics so user knows when result is baked. |
| Background/paper | `setBgMode`, `setPaperGrain`, `setWetPaper`, `setEmbossStrength`, `PaperConfig[]` | Requires actual demo assets and mapping to `canvas1/canvas2/canvas3` keys. |
| Clear/undo | `clear`, `undo` | Undo stack is internal and limited; no `canUndo` API. |
| Save/load | `save`, `load`, `SerializedProject` | README names `saveProject/loadProject` are stale. |
| Stroke inspect | `getStrokes` | Strokes are deep-copied; good for display. No event hook for “stroke added”, so polling or refresh button may be simplest. |
| Still export | `getCanvas`, `getDisplayCanvas` | Need decide dry-only vs display-with-wet overlay; provide both for testing. |
| Replay | `AnimationPlayer` from `./animation`, `player.play(config)`, `player.stop()` | Package export exists, but demo must verify import path and generated dist entry. |
| Frame export | `AnimationPlayer` `onFrame(frameIndex, canvas)` | Browser download orchestration needed; no built-in ZIP/export helper. |

## Competitor / Reference Feature Analysis

This milestone should not try to match full painting products. Use references only to decide what a validation demo needs.

| Feature | Natural-media apps such as Rebelle/Krita | Current EFX Motion Editor paint modes | Standalone physics demo approach |
|---------|------------------------------------------|------------------------------------|----------------------------------|
| Paint surface | Full document workspace with tool palettes | Frame-by-frame paint canvas inside editor | Single large canvas focused on engine behavior. |
| Brush library | Extensive brush presets and managers | Flat, FX via p5.brush, physical placeholder | A few demo recipes only after raw engine controls work. |
| Physics/wet simulation | Rich wet media controls, drying, paper interaction | p5.brush FX layer; physical mode not implemented | Expose water/dry/physics run controls directly. |
| Animation | Some apps record process/video; editor has timeline | Timeline/frame paint and draw-reveal animation | Use `AnimationPlayer` only to validate package replay and frame capture. |
| Export | Images and videos | PNG sequence/video through editor pipeline | PNG still first; replay frame sequence later; no video. |
| Persistence | Product-specific document formats | `.mce` plus sidecar paint JSON | Engine `SerializedProject` JSON only. |
| Integration | Not applicable | Future standalone window/transport path | Explicitly defer; export artifacts prove feasibility without coupling. |

## Roadmap Recommendation

1. **Phase 1 — Make the package runnable:** Add demo scaffold, package script, paper assets, and README command correction. Success: user can run one pnpm command and see a ready paint surface.
2. **Phase 2 — Expose core engine controls:** Paint/erase, brush/color/opacity/pressure, water/dry/physics, paper/background/transparent, undo/clear/status. Success: user can manually test wet physics and bake results.
3. **Phase 3 — Validate persistence and output:** Save/load engine JSON, stroke inspector, dry/display PNG export, transparent checker. Success: user can produce inspectable artifacts suitable for future cache thinking.
4. **Phase 4 — Validate replay/cache path:** AnimationPlayer UI, frame capture/export, performance indicator, optional side-by-side dry/display preview. Success: user can evaluate whether standalone output can become editor cached frames.
5. **Phase 5 — Polish after user testing:** Demo recipes, smoke-test scenes, tablet diagnostics if needed, parameter snapshot. Success: faster regression testing and clearer bug reports before editor integration.

## Key Recommendation

Build a small but honest engine validation app, not a miniature editor. The MVP should answer three user-visible questions:

1. Can I run `efx-physic-paint` standalone and paint interactively?
2. Can I clearly test wet physics, paper behavior, transparency, save/load, and export?
3. Can the app produce still/frame artifacts that make later EFX Motion Editor cached compositing plausible?

Only after those answers are yes should roadmap work move into editor window transport, `.mce` persistence, or paint-layer integration.

## Sources

- `.planning/PROJECT.md` — v0.8.0 goal, active requirements, constraints, and prior failure context.
- `.planning/MILESTONES.md` — v0.7.0 post-milestone notes showing phases 27-32 abandoned and standalone window deferred to v0.8.0.
- `packages/efx-physic-paint/README.md` — advertised package features and stale demo/API claims.
- `packages/efx-physic-paint/package.json` — current scripts lack `pnpm dev`; exports include root, `./preact`, and `./animation`.
- `packages/efx-physic-paint/src/types.ts` — actual public types: `ToolType`, `BrushOpts`, `BgMode`, `SerializedProject`, `PaintStroke`.
- `packages/efx-physic-paint/src/preact.tsx` — `EfxPaintCanvas` wrapper and initialization behavior.
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` — actual public engine methods and canvas/export hooks.
- `packages/efx-physic-paint/src/animation/AnimationPlayer.ts` — replay API and `onFrame(frameIndex, canvas)` behavior.

---
*Feature research for: v0.8.0 Standalone Physics Paint*
*Researched: 2026-06-08*
