# EFX-Motion Editor

## What This Is

A macOS desktop application for creating cinematic stop-motion films from photography keyframes. Users import key photographs, arrange them into timed sequences at 15/24 fps, add overlay layers (static images, image sequences, videos, paint/rotopaint) with blend modes, transforms, and keyframe animation, apply cinematic FX effects (film grain, vignette, color grade, blur, dirt/scratches, light leaks) and GLSL shader effects (17 Shadertoy + 18 GL transitions), add fade/cross-dissolve/GL transitions, import audio with waveform visualization and beat-synced editing, draw frame-by-frame with pressure-sensitive brush/shape/fill tools and onion skinning with expressive brush FX (watercolor, ink, charcoal, pencil, marker) via p5.brush with spectral pigment mixing, manage strokes with drag-reorder, visibility toggles, and multi-select, edit stroke paths as bezier curves with interactive anchor/handle manipulation, edit keyframe positions directly on canvas via motion path, apply per-layer GLSL velocity motion blur with shutter angle controls, preview in real-time on a canvas-based timeline with fullscreen mode, and export as PNG image sequences or video (ProRes/H.264/AV1) with audio and motion blur sub-frame accumulation. Built with Tauri 2.0 (Rust) + Preact + Preact Signals + Motion Canvas + Tailwind CSS v4. v0.1.0 delivered the editing foundation; v0.2.0 completed the pipeline with keyframe animation, GPU blur, content overlays, transitions, and multi-format export; v0.3.0 added audio with beat sync, GLSL shader effects/transitions, solid sequences with gradients, and a streamlined 2-panel adaptive sidebar; v0.4.0 added canvas motion path editing and frame-by-frame paint/rotopaint layers; v0.5.0 added expressive brush rendering with spectral pigment mixing and per-layer GLSL velocity motion blur with sub-frame accumulation for export; v0.6.0 added stroke management, bezier path editing, and paint workflow UX improvements; v0.7.0 migrated to a pnpm monorepo (app/ + packages/efx-physic-paint/) with a 3-mode paint system and color picker polish; v0.8.0 proved efx-physic-paint as a standalone interactive physics paint app/window with a deterministic physical-frame Roto timeline (durable cache, generated interpolation, multi-select group operations, Roto Script Play fusion, durable script library) and render-path performance via a structural/frame-split signal graph; v0.9.0 delivered PlayScript application modes, linked Hold Loop Clips with the Integrated Loop Rail, Timeline Toolbox, and a signed/notarized release; v1.0.0 turned one parent Paint layer into a complete multi-track frame animation document — a versioned EFX Paint document with stable internal track IDs, track-local state, an internal multi-track timeline, a deterministic compositor producing one flattened parent raster per frame, a fixed Background track with Loop Clips, a photo/reference track with Reveal, a read-only audio preview plus a document sound track, HD native-resolution paint with a bytes/WebP frame runtime, a clean-break references-only `.mce` package format, paint-content export, and a signed/notarized 1.0.0 release.

## Core Value

Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences — the complete stop-motion-to-cinema pipeline must work end-to-end.

## Requirements

### Validated

- ✓ Tauri 2.0 + Preact + Vite + Tailwind v4 scaffold with IPC bridge and asset protocol — v0.1.0
- ✓ Motion Canvas player embedding with signal store architecture (6 stores) — v0.1.0
- ✓ React UI prototype converted to Preact with dark theme and all panels — v0.1.0
- ✓ Image import via drag-and-drop and file dialog with Rust thumbnail generation — v0.1.0
- ✓ Image pool with LRU eviction for memory safety — v0.1.0
- ✓ Project management (create, save, open, auto-save, recent projects, .mce format v4) — v0.1.0
- ✓ Global app config persists between sessions — v0.1.0
- ✓ Sequence management (create, duplicate, delete, reorder, key photos with hold duration) — v0.1.0
- ✓ Per-sequence frame rate and resolution settings — v0.1.0
- ✓ Canvas-based timeline with virtualized frame rendering, playhead, scrubbing, zoom — v0.1.0
- ✓ Real-time preview playback at project fps with step forward/backward — v0.1.0
- ✓ Preview zoom/pan and sequence reorder on timeline — v0.1.0
- ✓ Audio-sync-ready clock architecture (performance.now() delta accumulation) — v0.1.0
- ✓ Store lifecycle fixes (clean reset on project switch, no data bleed) — v0.1.0
- ✓ Undo/redo command pattern engine (100+ levels) — v0.1.0
- ✓ Keyboard shortcuts (Space, arrows, JKL shuttle, Cmd+Z/S/N/O, ?, Delete) — v0.1.0
- ✓ Multi-layer compositing with static image, image sequence, and video layers — v0.1.0
- ✓ Blend modes (normal, screen, multiply, overlay, add) and opacity per layer — v0.1.0
- ✓ Layer transforms (position, scale, rotation, crop) — v0.1.0
- ✓ Context-sensitive properties panel — v0.1.0
- ✓ Cinematic FX effects (film grain, vignette, color grade, dirt/scratches, light leaks) — v0.1.0
- ✓ FX as timeline-level sequences with draggable range bars — v0.1.0
- ✓ Resolution-independent FX parameters — v0.1.0
- ✓ 3-level UI theme system (dark/medium/light) with CSS variable architecture — v0.2.0
- ✓ Canvas zoom/pan with keyboard shortcuts, pinch gestures, and fit-to-window — v0.2.0
- ✓ GPU-accelerated WebGL2 blur with CPU StackBlur fallback — v0.2.0
- ✓ Live canvas transform manipulation (move, scale, rotate) with handles — v0.2.0
- ✓ Per-layer keyframe animation with interpolation curves (linear, ease-in, ease-out, ease-in-out) — v0.2.0
- ✓ Content overlay layers (static image, image sequence, video) as timeline-level sequences — v0.2.0
- ✓ Redesigned sidebar with 3 resizable sub-windows, inline key photos, keyframe navigation — v0.2.0
- ✓ Fade/cross-dissolve transitions with opacity and solid color modes — v0.2.0
- ✓ Export as PNG image sequence with resolution multipliers, progress, metadata sidecars — v0.2.0
- ✓ Video export (ProRes/H.264/AV1) via FFmpeg auto-provisioning — v0.2.0
- ✓ Full-speed playback mode and fullscreen canvas with letterboxed preview — v0.2.0
- ✓ Sequence isolation (solo) and global loop playback toggle — v0.2.0
- ✓ Linear timeline layout mode with togglable stacked/linear views — v0.2.0
- ✓ Lucide-preact SVG icon buttons with keyboard shortcut tooltips — v0.2.0
- ✓ Tabbed shortcuts overlay with 7 groups and full keyboard navigation — v0.2.0
- ✓ Timeline vertical scrollbar with playback auto-scroll — v0.2.0
- ✓ Solid color and transparent key entries with full data pipeline, UI controls, and rendering — v0.3.0
- ✓ Audio import with waveform visualization, synced playback, volume/fade controls, timeline interactions — v0.3.0
- ✓ Media in-use tracking with color-coded badges, usage popovers, and cascade removal with undo — v0.3.0
- ✓ GLSL shader effects: WebGL2 runtime, 17 Shadertoy-ported effects, ShaderBrowser, parameter controls — v0.3.0
- ✓ GL transitions: 18 curated gl-transitions.com shaders, dual-texture WebGL2 pipeline, timeline/sidebar integration — v0.3.0
- ✓ Audio export with BPM detection, beat markers, snap-to-beat, auto-arrange strategies — v0.3.0
- ✓ Collapsible key photo lists, global solo mode (S key), gradient fills (linear/radial/conic) — v0.3.0
- ✓ Adaptive 2-panel sidebar with sequence/layer view switching, Layers icon with count badge — v0.3.0
- ✓ Tailwind v4 syntax migration across 33 component files — v0.3.0
- ✓ Project format .mce v8→v13 progressive migration with full backward compatibility — v0.3.0
- ✓ Canvas motion path with After Effects-style dotted trail, keyframe circle markers, and drag-to-reposition interaction — v0.4.0
- ✓ Paint/rotopaint layer with perfect-freehand brush engine, 7 drawing tools, onion skinning, flood fill, and sidecar persistence — v0.4.0
- ✓ Tablet pen support with pressure sensitivity, tilt modulation, and coalesced pointer events — v0.4.0
- ✓ Project format .mce v14 with paint layer sidecar persistence — v0.4.0
- ✓ Paint brush styles (watercolor, ink, charcoal, pencil, marker) via p5.brush standalone rendering — v0.5.0
- ✓ Spectral pigment mixing (Kubelka-Munk) for physically-based color blending — v0.5.0
- ✓ Watercolor bleed, paper texture, and flow field distortion for organic rendering — v0.5.0
- ✓ Grain/texture post-effects and edge darkening per brush style — v0.5.0
- ✓ Brush style UI selector with SVG thumbnails in PaintProperties panel — v0.5.0
- ✓ Non-destructive FX workflow: draw flat, select, apply style, flatten for performance — v0.5.0
- ✓ Per-frame FX cache with spectral mixing across overlapping strokes — v0.5.0
- ✓ GLSL per-layer velocity motion blur for real-time preview — v0.5.0
- ✓ Sub-frame accumulation buffer for high-quality export (Float32 averaging, 8-128 samples) — v0.5.0
- ✓ Combined GLSL + sub-frame motion blur pipeline for export — v0.5.0
- ✓ Motion blur shutter angle UI control and preview toolbar toggle — v0.5.0
- ✓ Motion blur export settings (sample count, shutter angle override) — v0.5.0
- ✓ Project-level motion blur settings with .mce v15 persistence — v0.5.0
- ✓ Export selected sequence only option — v0.5.0
- ✓ Alt+drag duplicate stroke in roto paint edit mode — v0.6.0
- ✓ Non-uniform scale for paint layer strokes — v0.6.0
- ✓ Stroke interactions (move, rotate, scale, undo/redo) with correct hit-testing — v0.6.0
- ✓ Paint properties panel reorganized with space optimization and cleaner buttons — v0.6.0
- ✓ Isolation-scoped layer creation (add layer only on isolated sequence) — v0.6.0
- ✓ Denser motion path interpolation dots for short sequences — v0.6.0
- ✓ Bezier/spline stroke path editing with anchor/handle manipulation — v0.6.0
- ✓ Add, move, and delete bezier control points on existing strokes — v0.6.0
- ✓ Stroke list panel with drag-reorder, delete, selection sync, and visibility toggle — v0.6.0
- ✓ Paint undo/redo FX cache invalidation and visual refresh for all operations — v0.7.0 Phase 33
- ✓ Brush preferences persistence (color, size) with session restore — v0.7.0 Phase 33
- ✓ Circle cursor overlay at brush size with zoom scaling — v0.7.0 Phase 33
- ✓ 3-mode paint system (flat/FX/physical-placeholder) with per-frame mode exclusivity — v0.7.0 Phase 33
- ✓ Inline color picker with 4 modes (Box/TSL/RVB/CMYK) and swatches — v0.7.0 Phase 33
- ✓ Modal color picker: no buttons, no overlay, positioned near mouse — v0.7.0 Phase 33
- ✓ FX stroke wireframe overlay for selection visibility — v0.7.0 Phase 33
- ✓ Stroke draw-reveal animation with speed-based distribution — v0.7.0 Phase 33
- ✓ Inline color picker positioned adjacent to canvas (left panel, 260px) — v0.7.0 Phase 33
- ✓ efx-physic-paint is runnable and testable as a standalone interactive physics paint app/window before editor integration — v0.8.0 Phase 35
- ✓ One Physics Paint Roto frame can be cached into EFX Motion, drawn in preview, preserved through project save/load, and reopened as a cached visual reference — v0.8.0 Phase 36.3
- ✓ Physics Paint Roto timeline cells distinguish empty, cached, editable/current, generated/render-only, background-only, dirty, and saving states with semantic labels, non-color visual cues, and compact legend/status copy — v0.8.0 Phase 36.5
- ✓ Physics Paint dirty Roto frames save automatically on leave with source-frame feedback, latest-destination queuing, and failure retention — v0.8.0 Phase 36.6 (superseded by automatic live pixel caching, quick 260714-ail)
- ✓ Automatic live pixel caching for Physics Paint Roto with durable reopen and projected/distant key behavior — v0.8.0 quick 260714-ail
- ✓ Stop-motion animators can duplicate, insert, delete, copy, and paste real Physics Paint Roto keys with clean cache/cell/canvas state — v0.8.0 Phase 36.7
- ✓ Physics Paint Roto timeline ships the approved final UI: fixed-geometry strip with grouped controls, guarded icon actions with styled tooltips, elastic status capsule, real-key diamonds on the EFX Motion layer, + Key empty-paint promotion, resizable sidebar sections, and Scripts panel script actions — v0.8.0 Phase 36.15
- ✓ Multiple real Physics Paint Roto keys can be selected (including Select All) and group-dragged, deleted, and Force-Spaced as one atomic transaction over the canonical physical-frame model, with full downstream parity and regression-locked behavior — v0.8.0 Phase 37
- ✓ Selected real Roto keys support reusable group Copy/Paste with stable physical offsets, fresh identities, atomic rejection, one Undo/Redo action, and single-key parity; the capsule and viewport tooltips use the approved current-cell and flat multiline presentation — v0.8.0 Phase 38
- ✓ Physics Paint Studio navigation preserves the canvas-first timing architecture while localizing static UI, Workflow cells, CanvasMount/Efx ownership, and deterministic render/lifecycle instrumentation — v0.8.0 Phase 38.1
- ✓ efx-physic-paint standalone demo shell runs via pnpm/Vite with live interactive canvas — v0.8.0 Phase 34
- ✓ Physics Paint UI rebuild with session persistence and output proof (inspect/save/export) — v0.8.0 Phase 36
- ✓ Physics Paint explicit Roto close behavior (discard / cancel / save-close) — v0.8.0 Phase 36.4
- ✓ Signals-backed Roto session/key state boundary replacing the Studio god-component — v0.8.0 Phase 36.8
- ✓ Cached Roto timed Play/Stop preview with auto-play — v0.8.0 Phase 36.9
- ✓ Span-aware missing Roto frame resolution for preview with export parity — v0.8.0 Phase 36.10
- ✓ Cached real-key repaint merging prior cached alpha with new live alpha — v0.8.0 Phase 36.11
- ✓ Integer-gap Roto interpolation deriving strict interior frames between adjacent real keys — v0.8.0 Phase 36.12
- ✓ Dynamic interpolation spacing for Roto keys — v0.8.0 Phase 36.13
- ✓ Deterministic physical-frame Roto timeline cutover: stable keyId, direct appFrame, atomic acknowledged transactions (Insert/Delete/Drag/Force Spacing/Undo/Redo) — v0.8.0 Phase 36.14
- ✓ Tauri-native frame sync between editor timeline and standalone Physics Paint window (physic-paint:seek-frame, EDIT-02) — v0.8.0 quick 260801-azb
- ✓ EFX Paint Scripts auto-hydration: saved-project scripts and Save Script appear without manual Refresh — v0.9.0 Phase 39 (quick 260804-f2q)
- ✓ Legible macOS app icon regenerated from SPECS/efxmotioneditor-icon-2.png via the Tauri pipeline; tracked generated icons remain release authority, packaged-icon metadata proven on a fresh unsigned build — v0.9.0 Phase 40
- ✓ Desktop build hygiene: chunkSizeWarningLimit 1100 documented and test-pinned; 4 triage-approved mixed-import corrections with non-return assertions — v0.9.0 Phase 40
- ✓ EFX Paint audio preview monitoring: read-only main-editor audio in the child window, frame-synchronized (anchor model, silent scrub, loop-wrap re-seek, 40ms drift correction), revisioned launch payload + push updates, doubled-audio ownership guard with auto-resume, session-local toggle, engine release on close, D-04-proven single-token CSP grant; native packaged UAT approved — v0.9.0 Phase 41
- ✓ PlayScript application modes + color override: progressive vs static/hold modes generating one source cycle of real keys, application-time color-only override fed live from the brush color (read-only, snapshot at Generate, erase strokes excluded), application-time Motion, Hold Loop repeat/infinity as Phase 43 loop intent (Requested/Effective readout only — never materialized), two-line success-only Scripts panel summary, compact dark draggable modal (approved playscript-proposal direction); native UAT approved — v0.9.0 Phase 42
- ✓ Linked Hold Loop Clips (cycle × repeat 1..∞) with filmstrip timeline visualization, no duplicated source assets — v0.9.0 Phase 43 (Validated in Phase 43: Hold Loop Clips + Integrated Loop Rail)
- ✓ Timeline toolbox + directional Push tool: ToolCase popover relocating Interpolation + Key Spacing (zero behavior change), and a mode-toggle Push tool (anchor resolved from the rail under the pointer, moved set = anchor + everything at/after its start, one rigid atomic transaction with one Undo/Redo, nearest-boundary/capacity clamp, straddle guard, persistent 43.1 gap breaks, full drag preview); native UAT approved — v0.9.0 Phase 43.5 (Validated in Phase 43.5: Timeline Toolbox + Directional Push Tools)
- ✓ Multi-rail selection + batch operations: explicit session-only rail-set selection (plain/toggle/range/union gestures across Key/Motion/Static rails, canonical ordering, fail-closed reconcile), batch Move Rails (rigid clamped translation), direct no-modal Delete Rails, Key Spacing on set with per-rail fixed anchors, and Solo playback presentation filter — every batch op is one atomic history command with exact pre-op selection restore on Undo/Redo (G-43.6-2 undo/recovery-lease defects closed); native UAT approved — v0.9.0 Phase 43.6 (Validated in Phase 43.6: Multi-Rail Selection and Batch Operations)
- ✓ New versioned v1.0 EFX Paint document owned by one parent layer ID, with stable internal track IDs, document revision, and active track ID — v1.0.0 Phase 45
- ✓ Clean-break creation of one fresh default Paint track and one fixed Background track for every new v1.0 EFX Paint document; pre-v1.0 Paint data rejected explicitly — v1.0.0 Phase 45
- ✓ Track-local Paint/Roto/PlayScript frames, linked Hold Loop Clips, caches, revision, and dirty state — v1.0.0 Phase 46
- ✓ Internal multi-track timeline inside EFX Paint Studio: add/rename/duplicate/delete/reorder, active selection, hide/solo, opacity, blend mode — v1.0.0 Phase 47
- ✓ Deterministic internal compositor resolving all Paint tracks into one flattened parent-layer raster per frame — v1.0.0 Phase 48
- ✓ Fixed Background track with imported still/sequence Loop Clips, finite/infinite repeat, gaps, and solid/transparent fallback — v1.0.0 Phase 49
- ✓ Photo/reference track (reference-only / reveal-source / masked-transform-source), excluded from ordinary flattened output — v1.0.0 Phase 50
- ✓ Read-only main-editor audio preview synchronized to the shared application-frame cursor during internal track playback — v1.0.0 Phase 51 (delivered via quicks 260902-cfa + amendments)
- ✓ Shared mask compositor and Reveal using photo source plus internal Paint/PlayScript coverage — v1.0.0 Phase 52
- ✓ Any project containing paint exports its painted frames end-to-end — dense per-frame compositor enumeration (FrameEntry content/paint/gap union), paint-only and mixed projects, both canvas orientations, selected-fx export with fx inFrame > 0 included (CR-01) — v1.0.0 Phase 52.3
- ✓ Modern frame runtime: bytes/ImageBitmap frame identity, Rust WebP-lossless codec, byte-budgeted 512 MB LRU, working-resolution cap raised to 1920 — v1.0.0 Phase 52.1
- ✓ References-only `.mce` package: manifest + `layers/*.json` + `frames/*.webp` with transactional multi-file save, digest-verified lazy read-back, and explicit pre-1.0 refusal — v1.0.0 Phase 52.2
- ✓ Real-paint structured bristle footprint replacing salt-and-pepper deposit (seeded Poisson lanes, single finalize wet deposit, source-shape gates) — v1.0.0 Phase 52.4
- ✓ Physic Paint document sound track: Studio waveform/reposition/trim, main-editor mixed playback, `.mce` reference persistence, export mix — v1.0.0 Phase 52.5
- ✓ Integrated v1.0.0 acceptance: all six REL-01 gates green, 42-row signed-bundle UAT (36 pass / 6 na / 0 fail), signed/notarized 1.0.0 release published as GitHub Latest — v1.0.0 Phase 53
- ✓ Staged export progress (preparation / rendering / encoding) with cancel-during-prep — quick 260919-sns
- ✓ Display-class save token (PKG-06/BKG-09): display-only edits survive save → close → reopen — v1.0.1 Quick 1 (261012-c9a)
- ✓ Video import joins the disk-reference law (VID-01..03): never-copy, `source_path` verbatim, `video_assets` declared in both languages — v1.0.1 Quick 2 (261012-d6q)
- ✓ Document-sound decode readiness (SND-01..02): playback/export await or refuse, never silently drop — v1.0.1 Quick 3 (261012-exn)
- ✓ Export video readiness (VID-04): no loading placeholder baked into exported frames — v1.0.1 Quick 4 (261012-kxg)
- ✓ Export mux duration law (EXP-01): container audio and video streams share the shorter duration — v1.0.1 Quick 5 (261013-ctd)
- ✓ Motion-blur prefs persistence (MBL-01): `enabled`, `shutter_angle`, `preview_quality`, `export_sub_frames` survive reopen — v1.0.1 Quick 6 (261013-fdh)
- ✓ TS↔Rust field-diff contract test enforcing the dual-language `.mce` law mechanically — v1.0.1 Quick 6 (261013-fdh)

### Active

- [ ] Phase 54 — Preact 11 update: hard `@preact/signals` ↔ Preact 11 compatibility gate first (STOP if red), then ESM-only / useRef initial value / defaultProps + auto-px → compat / deferred useEffect cleanups vs paintVersion / JSX types → preact namespace. Live UAT of reactivity paths (paintVersion, store setters) must CLOSE before Phase 55 opens. Spec: `SPECS/v1.1.0-preact11/context.md`
- [ ] Phase 55 — efx-paint-host (engine-1 host split): move animation schedules / traceSeed / script envelope / ticks + diffusionFrames out of efx-physic-paint; host APIs generic over the per-engine stroke payload (pts, ticks, cuisson, motion, brush id + toolOverrides), never engine-specific params. Format-identical split (R5.2 / A4 replay parity) is a refactor guard. Hard prerequisite of engines 2 and 3. Spec: `SPECS/v1.1.0-paint-host/context.md`
- [ ] Phase 56 — efx-watercolor (engine 2, paint-aquarelle, clean-room): oracle msurguy/watercolor-playground (Preact + WebGL2, engine UI-free). Paper pack (10 procedural papers for ALL paints) rides this phase. Consumes efx-spectral — if plan-time shows it needs spectral first, create `packages/efx-spectral` early inside 56 or pull 57 forward; never duplicate mixing code inside the watercolor engine. Spec: `SPECS/v1.1.0-water-color/` (00-grill-context.md + 01-gsd-context.md)
- [ ] Phase 57 — efx-spectral (MIT spectral.js, shared — NOT watercolour-only): consumed by engine 2 now; engine 1 adopts it in v2.1.0
- [ ] Module switcher: top-bar MODULE SWITCHER icon near the existing icons ("Brush | Water color | Krita"); each module drains its OWN options/features into the panels; ONE shared Studio engine (script, cache, timeline) for all modules. v2.0.0 ships Brush + Water color only — Krita is the v2.1.0 slot (do NOT implement krita here). Gray zones (top-bar placement, iconography, panel layout, option grouping) resolved at discuss-phase
- [ ] Quick: audio-trim-to-view (parked from pre-53) — lives inside this milestone, never standalone
- [ ] Decide gap-entry active-sequence semantics on scrub (52.3 review WR-01) and overlapping-fx export ownership (52.3 review WR-03) — design questions, follow-up candidates
- [ ] Future physics-paint integration contract must define typed transport/cache messages without implementing editor runtime integration — v0.8.0 follow-up (was earmarked for a Phase 37 that became multi-select Roto keys)
- [ ] The failed headless adapter approach remains excluded; physics paint must preserve interactive incremental simulation behavior — v0.8.0

## Current Milestone: v2.0.0 Multi-Module Paint Workstation (MAJOR)

**Goal:** Change the product shape into a multi-module paint workstation — a module switcher (Brush | Water color | Krita) over ONE shared Studio engine, shipping Brush + Water color, unlocked by a Preact 11 bump and an engine-1 host split.

**Target features:**
- Phase 54 — Preact 11 update (hard @preact/signals compatibility gate first; live reactivity UAT closes before 55)
- Phase 55 — efx-paint-host engine-1 host split (tranche 0b out of efx-physic-paint; generic host APIs over per-engine stroke payload)
- Phase 56 — efx-watercolor engine 2 (paint-aquarelle, clean-room) + paper pack (10 procedural papers for ALL paints)
- Phase 57 — efx-spectral shared MIT spectral.js package (consumed by engine 2 now; engine 1 adopts in v2.1.0)
- Module switcher + per-module options panels over the one shared Studio engine (Brush + Water color ships; Krita is the v2.1.0 slot)
- Quick inside this milestone: audio-trim-to-view (parked from pre-53)

**Why 2.0.0 (user 2026-10-14):** the module switcher changes the product shape, the `.mce` clean break is accepted, and a full paint engine is not a 1.x minor. Semver law from now on: **MAJOR = new product shape / accepted break · MINOR = module or major feature · PATCH = debt.**

**Compatibility stance (DECIDED 2026-10-14 — do not reopen):** CLEAN BREAK ACCEPTED. v1.0.1 projects/scripts may stop opening or replaying. NO migration code, NO dual-format readers, NO backward-compat shims, NO compat branches. Do not slow the engines down for compatibility. Still never drop data silently: any unreadable script/asset refuses with a named visible error (53.1 law). Fail-closed is data honesty, not compatibility.

**Sequencing gates (hard):** no watercolour work before the Preact 11 bump (satisfied by 54 → 56) · Phase 54 live UAT closes before Phase 55 opens · v2.1.0 (Krita module) is planned only AFTER v2.0.0 closes.

**Architecture invariants (do not violate):** 3 engines / 4 paints (engine 3 krita/libmypaint is v2.1.0, OUT of scope) · Studio script law shared (record → play physics → WebP bake → cache), engine AND UI isolated per paint · script shape = shared Studio envelope + per-engine stroke payload, fail-closed Apply across engines · brush-pack snapshot travels in `.mce` (deliberate exception to the 52.2 refs-only law) · time = fixed tick grid (~1/60 s), integer ticks, never raw ms · determinism: same script ⇒ same pixels, seeded per stroke (FNV-1a traceSeed), no `Math.random()` in deposit or sim path.

**Out of scope for v2.0.0:** paint-krita / libmypaint · engine-1 spectral mixing (adopts in v2.1.0) · 2K · AI.

**Release:** `efx-motion-release` at close, hard rules 10–11 (audit BEFORE tag/publish).

## Latest Milestone: v1.0.1 Debt Patch Release (Shipped 2026-10-13)

Quicks-first PATCH milestone: 7 quicks + 1 inserted phase (53.1 frame-model fix), 100 commits over 3 days. 13/13 v1 requirements approved. Two milestone audits run; all findings closed with deterministic round-trip pins. The TS↔Rust field-diff contract test (`app/src/lib/mceFieldContract.test.ts`) now enforces the dual-language `.mce` law mechanically. Published as signed/notarized GitHub Latest (tag `v1.0.1` → `ffde6e6a`, DMG SHA256 `b6fcd11f…3058d`), downloaded-artifact verification PASS, stop-conditions 13/13 NOT ACTIVE. Closeout `override_closeout`: 5 tracking-state items acknowledged (4 quick frontmatter YAML fixes + 1 UAT row with 0 pending scenarios). See `.planning/MILESTONES.md` and `milestones/v1.0.1-ROADMAP.md`.

## Latest Milestone: v1.0.0 EFX Paint Multi-Track Frames and Reveal (Shipped 2026-10-12)

14 phases (45-53, incl. inserted 52.1-52.5), 80 plans, 1,578 commits (301 feat) over 49 days. Closeout `override_closeout`: audit verdict `gaps_found` — 65/68 requirements (Known Gaps PKG-06, BKG-09, SND-07 — all display-setter/export-mix save legs; see MILESTONES.md), 27 open artifacts acknowledged as deferred. Shipped as a signed/notarized 1.0.0 macOS release published as GitHub **Latest** on 2026-10-11 with all six REL-01 gates green and the 42-row signed-artifact UAT at 36 pass / 6 na / 0 fail. Source spec: `SPECS/milestone-v1.0.0-plan.md`. See `.planning/MILESTONES.md` and `milestones/v1.0.0-ROADMAP.md`.

## Previous Milestone: v0.9.0 PlayScript Workflow, EFX Paint Audio Preview, and macOS Identity (Shipped 2026-08-21)

12 phases (39-44, incl. inserted 43.1-43.6), 100 plans, 962 commits over 17 days. Audit verdict `passed`: 38/38 requirements satisfied, 12/12 phases verified, integration + E2E flows wired (43→44 signed-artifact boundary not dropped), Nyquist fully compliant. Shipped as a signed/notarized/stapled macOS release published as GitHub **Latest** on 2026-08-21 (ahead of the 2026-08-31 target) with all six REL-01 gates green, the 17-step packaged-app UAT approved, downloaded-artifact verification passed, and all 15 stop conditions recorded not active. See `.planning/MILESTONES.md`, `milestones/v0.9.0-MILESTONE-AUDIT.md`, and `milestones/v0.9.0-ROADMAP.md`.

## Previous Milestone: v0.8.0 Standalone Physics Paint (Shipped 2026-08-01)

21 phases (34, 35, 36, 36.1–36.15, 37, 38, 38.1), 170 plans, 1,347 commits over 54 days. Audit verdict `tech_debt`: 56/56 requirements satisfied, all integration and E2E flows wired, zero blockers; deferred items recorded in STATE.md and the milestone audit. Phase 36.2 intentionally failed/superseded. See `.planning/MILESTONES.md` and `.planning/reports/MILESTONE_SUMMARY-v0.8.0.md` for details.

## Previous Milestone: v0.7.0 Monorepo & Paint Enhancements (Shipped 2026-04-05)

2 completed phases (26, 33), 23 plans, 112 commits. Phases 27-32 failed (adapter approach abandoned — efx-physic-paint deferred to v0.8.0 as standalone window). See `.planning/MILESTONES.md` for details.

## Previous Milestone: v0.6.0 Various Enhancements (Shipped 2026-04-03)

4 phases, 14 plans over 8 days. See `.planning/MILESTONES.md` for details.

### Out of Scope

- Live camera tethering — different product category (Dragonframe owns this)
- Plugin/extension system — requires stable internal APIs; premature
- AI-powered features — distraction from core value; proven DSP for beat detection instead
- Real-time collaboration — desktop app with local files; stop-motion is typically solo/small-team
- Windows/Linux builds — macOS only; native title bar, file dialogs, macOS conventions
- Node-based compositing — layer-based approach is more intuitive for target users
- Multi-frame stroke operations — single-frame scope sufficient for current workflows
- Stroke grouping/nesting — flat list sufficient; hierarchy adds complexity without clear benefit
- Headless batch adapter replay / editor-driven renderFromStrokes / forceDryAll path — excluded after v0.7.0 failure post-mortem; physics paint preserves interactive incremental simulation

## Context

Shipped v1.0.1 (Debt Patch Release) with 100 commits over 3 days; cumulative codebase ~139.4k LOC TS/TSX across app/src and packages/. The dual-language `.mce` law is now mechanically enforced. pnpm monorepo with app/ + packages/efx-physic-paint/.
Tech stack: Tauri 2.11.5, Preact + Preact Signals, Motion Canvas (@efxlab v4.0.0), Vite 5, Tailwind CSS v4, pnpm workspaces, p5.brush (standalone), perfect-freehand, fit-curve, bezier-js, plus pinned XState v6 alpha + Effect v4 rc (pilot only).
Architecture: 13+ reactive signal stores, Rust image pipeline, Canvas 2D PreviewRenderer with multi-layer compositing, WebGL2 GPU blur/GLSL runtime/motion blur, 3-mode paint system, efx-physic-paint standalone window with deterministic physical-frame Roto timeline (canonical keyId/appFrame model, atomic transactions, generated interpolation, multi-select group operations via finalizeProposal single authority, Roto Script Play fusion, durable script library), signals-backed Roto session boundary, structural/frame-split render-path signal graph, plus v0.9.0 Loop Clip Hold rails / Timeline Toolbox / multi-rail batch operations, plus v1.0.0: versioned EFX Paint document (track-addressed runtime, per-track revisions and leases), internal multi-track timeline, deterministic internal compositor producing the one flattened parent raster (`getFlattenedFrame` is the sole content path for preview and export), fixed Background track + photo/reference track + Reveal rail, HD bytes/WebP frame runtime with a 512 MB LRU, references-only `.mce` package with transactional multi-file save, document sound track, and an XState v6 stroke-finalization machine + Effect v4 bounded-turn flush queue (pilot, conventions in the `efx-async-orchestration` skill).
Project format: `.mce` v1.0 clean break — `formatVersion` 16, references-only package (manifest + `layers/*.json` + `frames/*.webp`); pre-v1.0 projects rejected explicitly (no backward compat, by design).

Known technical debt:
- **PKG-06/BKG-09 Known Gap:** display-class setters (bg transform/lock, photo-display prefs) never rotate the layer change token → display-only edits revert on reopen after a settled save — v1.0.0 (see MILESTONES.md Known Gaps)
- **SND-07 Known Gap:** moved/failed audio clip silently dropped from the exported mix (undecoded-buffer `continue`, no per-track diagnostic) — v1.0.0
- WINDOWS.md ledger frontmatter counts disagree with entries — `windows append` refuses every write; needs a recount-repair pass — 52.2 deferred
- Orphan package files: deleted keys/layers never remove `frames/<layerId>/<keyId>.webp` / `layers/<layerId>.json` (token diff is add-only, no GC owner) — 52.2 deferred
- Two call sites still hand the package DIRECTORY to `projectStore.openProject` (`shortcuts.ts:95`, `WelcomeScreen.tsx:168`) → EISDIR on Cmd+O / welcome Open — 52.2 deferred, needs owner
- `paintStore` ↔ `projectStore` circular-import init-order failure in `PhysicsPaintStudioView.test.ts` (collect-phase) — 52.5 deferred
- `'move'` missing from the `ToolType` union (3 pre-existing typecheck errors) — 52.5 deferred
- Hide/solo truth table duplicated: `efxPaintHideSolo.ts` (compositor/export) vs `previewRenderer.ts` (Studio) — logic-identical today, no shared import — v1.0.0 audit
- `main.test.ts` unhandled rejection in full suite (`__TAURI_INTERNALS__.invoke` at cold-start drain) — 52.2 deferred, no scheduled owner
- S key shortcut lacks isPaintEditMode() guard (low severity) — from v0.6.0
- 2 medium-severity export edge cases (content-overlay image preload, FX generator frame offset) — carried from v0.2.0
- Coalescing API partially resolved (motion path drag uses startCoalescing/stopCoalescing) — most UI interactions still unwired (carried from v0.1.0)
- canUndo/canRedo signals exported but no UI consumes them for button disabling — carried from v0.1.0
- 3 pre-existing audioWaveform test failures (unrelated to v0.6.0 work)
- Roto cache footprint measurement/compression deferred (PNG alpha encoding exists) — v0.8.0
- Deterministic physical-resolver regression coverage authorized as follow-up test plan — v0.8.0 Phase 36.14
- Legacy source/display model still feeds useRotoTimelineActions.getModel (inert dual-model seam); legacy optional fallbacks in rotoOnionPreview/applyCanvas/deleteRotoFrame — v0.8.0
- Dead playScriptMarkers field (no producer) and misleading physicPaintPlayScriptBridge.test.ts filename — v0.8.0 integration check I-01/I-02
- macOS Developer ID credentialed signed release — RESOLVED (v0.9.0, re-run for 1.0.0 in Phase 53)
- Phase 43.1 DF-01..04 deferred (non-blocking persistence/security hardening; NEW_SCOPE_FROM_VERIFIER) — cross-resource save transaction, directory sync on cache publication, provenance-only Loop Clip no-op, postMessage origin authentication — v0.9.0
- Release-script warnings (frozen, pre-existing): `codesign --entitlements :-` deprecation and ~21 GB worktree preflight walk — v0.9.0 Phase 44 (WR-01/WR-02)
- Spec-vs-implementation divergences recorded (judged against shipped): truncation label French-spec vs English shipped; chunk budget spec-1100 vs shipped-1120 — v0.9.0 Phase 44 (D-09)

## Constraints

- **Platform:** macOS only — native title bar, file dialogs, macOS conventions
- **Framework:** Tauri 2.0 (Rust backend) + Preact (not React) + Preact Signals (not Redux/MobX)
- **Package manager:** pnpm
- **Rendering:** Canvas 2D PreviewRenderer for compositing; WebGL2 GPU blur (glBlur.ts) with CPU StackBlur fallback; @efxlab/motion-canvas-* v4.0.0 for player embedding
- **Styling:** Tailwind CSS v4 + custom components — no heavy UI libraries
- **Performance:** Preview must play smoothly at 15/24 fps
- **Min resolution:** 1280x720 window minimum

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Preact over React | 3KB bundle, fastest rendering, Signals built-in | ✓ Good — reactive stores clean, zero perf issues |
| Tailwind v4 + Custom over UI library | No heavy overhead (~500KB saved), full control over editor UI | ✓ Good — dark theme with 28+ CSS variables |
| pnpm as package manager | User preference, fast installs, strict dependency resolution | ✓ Good — overrides fixed Motion Canvas workspace:* bug |
| Canvas 2D PreviewRenderer over Motion Canvas generators | Direct compositing control, simpler layer model | ✓ Good — clean multi-layer rendering with blend modes |
| Custom command-pattern undo over external library | Operation-level granularity, snapshot/restore with structuredClone | ✓ Good — works across all store mutations |
| tinykeys over hotkeys-js | 650B, TypeScript-native, layout-aware | ✓ Good — all shortcuts working, ? overlay included |
| FX as timeline-level sequences | FX apply globally with temporal range, not per-layer | ✓ Good — clean separation, draggable range bars on timeline |
| SortableJS with forceFallback:true | CSS transforms bypass Tauri native HTML5 DnD interception | ✓ Good — reliable drag reorder in sidebar |
| Canvas 2D for timeline | Full control over rendering, virtualization, pointer events | ✓ Good — smooth at 100+ frames |
| .mce progressive format migration | v1→v7 without breaking old files | ✓ Good — seamless loading of any version |
| PNG sequence + video export | Downstream editing in DaVinci Resolve/Premiere Pro is the workflow | ✓ Good — FFmpeg auto-provisioned, ProRes/H.264/AV1 |
| WebGL2 GPU blur over dual CPU | Constant-cost regardless of radius/layer count | ✓ Good — replaced HQ/fast toggle with always-HQ |
| Content overlays as sequence kind | Reuses FX track pipeline with content compositing | ✓ Good — interleaves cleanly with FX on timeline |
| Polynomial cubic easing over bezier curves | Simpler math, 21 unit tests, sufficient for stop-motion | ✓ Good — smooth interpolation, no overshooting |
| Intent-driven add-layer flows | Eliminates popover dialogs, reuses ImportedView | ✓ Good — consistent UX for all layer types |
| audioStore follows sequenceStore pattern | Signals, snapshot/restore, pushAction undo — proven architecture | ✓ Good — zero friction adding 11th store |
| Onset autocorrelation for BPM detection | Accurate, fast, no external DSP dependency needed | ✓ Good — reliable detection without heavy libraries |
| GlTransition as separate type (not overloading Transition) | Clean mutual exclusion between cross-dissolve and GL transitions | ✓ Good — D-02 mutual exclusion simple to enforce |
| Dual-texture WebGL2 pipeline for GL transitions | gl-transitions.com convention with dual capture from exportRenderer | ✓ Good — identical preview and export rendering |
| Optional fields on KeyPhoto for solid/transparent | Minimal structural change across 15+ callsites vs discriminated union | ✓ Good — pragmatic, avoided massive refactor |
| soloStore as session-only state | Solo mode is ephemeral preview behavior, not project data | ✓ Good — no persistence overhead |
| 2-panel adaptive sidebar over 3 panels | Layers merged into Sequences panel with icon toggle | ✓ Good — simpler UX, one fewer resizer |
| Progressive .mce format v8→v13 | Each phase bumps version with serde(default) backward compat | ✓ Good — seamless loading of any version |
| spawn_blocking for FFmpeg encoding | Keeps blocking I/O isolated from Tauri main thread | ✓ Good — fixed UAT export hang |
| Shared signal (motionPathCircles) for cross-component coordinate exchange | Simpler than prop drilling; matches signal-based architecture | ✓ Good — MotionPath→TransformOverlay communication clean |
| Snapshot-before/commit-on-release undo for transform gestures | Deep clone on pointerdown, single pushAction on pointerup | ✓ Good — clean undo for move, rotate, scale, duplicate |
| Edge anchor captured once on pointerdown for non-uniform scale | Prevents floating-point drift from per-frame recomputation | ✓ Good — stable scaling with no cumulative error |
| Visibility as optional boolean (undefined=visible, false=hidden) | Backward compatible; no migration needed for existing paint data | ✓ Good — existing strokes render correctly without field |
| S key remapped to select tool in paint mode (Alt+S for solo) | S key more useful for tool switching; solo toggle less frequent | ✓ Good — matches other tool shortcut patterns |
| fit-curve + bezier-js for freehand-to-bezier conversion | Mature libraries; fit-curve gives Douglas-Peucker fitting, bezier-js provides cubic math | ✓ Good — accurate path fitting with minimal code |
| BezierAnchor type with in/out handles and smooth flag | Mirrors industry-standard anchor model (Illustrator, Figma) | ✓ Good — intuitive handle manipulation, corner/smooth toggle |
| Progressive simplify button over automatic simplification | User controls detail level explicitly; auto-simplify removed too much | ✓ Good — reverted auto-simplify after user feedback |
| Unified keyframe upsert path (upsertKeyframeValues/Transform) | Eliminates dead-end transientOverrides routing | ✓ Good — sidebar and canvas drag edits both flow through keyframes |
| Map<string, Map<number, PaintFrame>> for paint storage | Efficient sparse frame data; per-layer per-frame isolation | ✓ Good — clean API, dirty tracking via Set<string> keys |
| paintVersion counter signal for reactivity | Non-reactive Map storage + explicit signal bump = controlled re-renders | ✓ Good — solved disappearing strokes without making all Maps reactive |
| Offscreen canvas compositing for eraser and onion skin | Isolates destination-out and global alpha operations | ✓ Good — correct rendering without side effects |
| Paint sidecar JSON files (paint/{uuid}/frame-NNN.json) | Keeps .mce file lean; paint data can be large | ✓ Good — pre-save write order prevents sync issues |
| p5.brush standalone over custom WebGL2 brush renderer | Replaced ~2000 lines of broken custom code with ~200 lines of adapter | ✓ Good — spectral mixing, 5 brush styles, mature library |
| Per-frame FX cache (not per-stroke) | Spectral mixing requires all strokes rendered on shared p5.brush canvas | ✓ Good — correct Kubelka-Munk mixing, clean invalidation |
| Non-destructive FX workflow (flat → select → apply) | Users draw without FX overhead; styles applied post-hoc | ✓ Good — clean separation, rollback to flat supported |
| Separate WebGL2 context for glMotionBlur.ts | Isolation from glBlur.ts and glslRuntime avoids state conflicts | ✓ Good — independent lifecycle, no shared GL state bugs |
| Triangle filter blur kernel in GLSL | Smooth directional blur falloff vs box filter | ✓ Good — natural motion blur appearance |
| VelocityCache with seek invalidation | Math.abs(currentFrame - lastFrame) > 1 detects seek vs playback | ✓ Good — clean velocity on playback, no artifacts on seek |
| Sub-frame accumulation with Float32 averaging | Higher quality export blur via temporal super-sampling | ✓ Good — combined with GLSL velocity blur for best quality |
| Cached Roto PNG as durable truth | Phase 36.3 recovered the smallest trustworthy Roto path after Phase 36.2 failed: explicit `Save current` writes one frame into EFX Motion and reopen uses the saved PNG as reference, not editable stroke restore | ✓ Good — UAT passed for save, preview, save/load, cached-reference reopen, and navigation preservation |
| Phase 36.5 Roto cell semantics stay MVP-only | User needed trustworthy existing strip state communication without reopening interpolation, cached playback, key utilities, save-on-leave, close behavior, or full timeline redesign scope | ✓ Good — semantic view models, compact legend/status, non-color CSS cues, generated-cell guard, and cached-reference navigation fix were validated |
| Phase 36.6 save-on-leave uses source-frame save truth | Dirty Roto navigation must save the source frame before opening a queued destination, not save/open based on destination state | ⚠️ Superseded — automatic live pixel caching (quick 260714-ail) replaced save-on-leave as the final architecture |
| Phase 36.7 Roto key utilities use controller-backed real-key transactions | Duplicate, Insert, Delete, Copy, and Paste need deterministic cache/cell/canvas updates without broad UI expansion or editor integration scope creep | ✓ Good — UAT passed for live key utility flow, generated/empty guards, dirty save-before-action, regression tests, typecheck, and user-story coverage |
| Phase 38 uses production → native UAT → post-UAT regression | Visible Copy/Paste, capsule, and tooltip behavior must be approved before tests are rewritten around it | ✓ Good — all 33 native steps passed before Plans 38-07/08; the final 967-test/typecheck/build gate is green |
| Phase 36.8 Signals/controllers as the Roto state boundary (no XState) | PhysicsPaintStudio god-component with scattered useState/useRef/useEffect was the regression root cause | ✓ Good — compact signals boundary owns Roto coherence; planned state-machine phase removed as obsolete |
| Phase 36.14 canonical physical-frame model (stable keyId, direct appFrame) | Source/display timeline ambiguity caused recurring Roto timing bugs | ✓ Good — atomic acknowledged transactions with ripple semantics locked; enabled-only interpolation persistence |
| Phase 36.14 finalizeProposal as single authority for timeline mutations | All key operations (including later group ops) resolve through one validator/guard path | ✓ Good — Phase 37 group drag/delete/Force Spacing admitted with zero bridge edits |
| Roto Script Play fusion (quick 260717-m9k) | Separate Play workflow duplicated script replay; one algorithm belongs in Roto SCRIPTS | ✓ Good — Play Script commits parent-authoritative real-key batches; separate Play workflow retired |
| Durable Roto script library (quick 260716-dby) | Scripts must survive sessions as autonomous JSON presets with WebP thumbnails | ✓ Good — project scripts folder with explicit load-to-clipboard |
| Phase 37 group operations as atomic transactions over canonical model | Multi-select group drag/delete/Force Spacing must not ripple unselected keys | ✓ Good — rigid group translation with zero unselected ripple, native UAT approved |
| Phase 38.1 canvas-first navigation paint before Preact propagation | Child windows must never present provisional state as accepted | ✓ Good — navigation paints engine canvas in the same synchronous tick; structural/frame-split signal graph makes frame writes O(find) |
| Tauri listen branch for physic-paint:seek-frame (G-01, quick 260801-azb) | Standalone window must track editor timeline seeks natively, not only via browser fallback | ✓ Good — regression-locked RED/GREEN coverage; native Tauri UAT approved |
| Bounded recovery track D-30: bounded-static fixes → read-only review → user-owned native UAT gate | Exact native approval is the only oracle for Roto/Studio behavior | ✓ Good — carried the 36.14 cutover and Phase 38/38.1 to green |
| Phase 41 D-04 one-way asset-transport boundary (single-token efxasset CSP grant, contract-tested) | Audio asset transport from main editor to EFX Paint must stay read-only and provenance-locked | ✓ Good — connect-src grant pinned by contract test; native packaged UAT (8 steps) approved |
| Phase 42 static/hold + color override as one renderer entry point, additive to progressive | Static/hold must not fork or regress the progressive module | ✓ Good — progressive byte-untouched; one source cycle per Apply |
| Phase 43 Loop Clip persistence joins the single canonical revision fingerprint + Undo/Redo snapshot | Loop-only edits must be revision-visible and undoable; v0.8.1 documents must load unchanged | ✓ Good — four-allowlist gauntlet passed; loop-only edits are revision-visible and undoable |
| Phase 43 one compact derived interval record per Loop Clip, lazy per-frame query | No virtual occurrence is ever materialized; consumers guard the typed union exhaustively | ✓ Good — resolution, preview, playback, and export share one store authority |
| Phase 43.1 stable-key incoming-break ownership as a complete persisted collection | Interpolation breaks are canonical facts owned by stable real-key identity, never a mask | ✓ Good — malformed/stale proposals fail closed; empty-segment insert is one atomic transaction |
| Phase 43.2 Group lifecycle + Action retention as leased, parent-authoritative transactions | Exact frame COW, no optimistic publication, durable Rust Action transactions | ✓ Good — canonical lease ownership; committed-only settlement ledgers |
| Phase 43.5 Timeline Toolbox + Push as one rigid atomic multi-object translation | Push is the exclusive multi-object movement owner; Group drag stays local | ✓ Good — persistent 43.1 gap breaks; one Undo/Redo; native UAT approved |
| Phase 43.6 rail-set selection as a session-only explicit selection scope | Cross-type batch ops need one shared selection with fail-closed reconcile | ✓ Good — pure reducer, batch Move/Delete/Key Spacing/Solo, exact selection restore on Undo |
| Phase 44 five-surface version single-source (REL-01) + credentialed signed release | Version must never drift across surfaces; publication is one-way and auditable | ✓ Good — signed/notarized/stapled, published as GitHub Latest, 15-item stop-condition checklist |
| Phase 52.3 FrameEntry discriminated union (content/paint/gap) with dense enumeration gated on `entries.length === 0` | The paint-only enumeration branch was never designed (quick 260919-azh verdict NEVER-WIRED); a fail-closed union keeps D-08/D-10 filter semantics explicit | ✓ Good — parked Cases C/D green, refusal unreachable for paint content, 7/7 native UAT rows across formats/resolutions/scales |
| Phase 52.3 one shared `entry.globalFrame` predicate across enumeration, render gating, and export preload | Positional-vs-global conflation produced all-transparent selected-fx exports (RESEARCH Pitfall 1) and an empty preload window (review CR-01) at fx inFrame > 0 | ✓ Good — CR-01 closed RED-first (50ecd5e4 → 3e84c120); preload, render gate, and enumeration provably share one predicate |
| Phase 52.3 playback activation of the owning fx sequence when the playhead enters paint frames is deliberate (D-08-consistent) | Dense enumeration makes playback cross fx-owned frames; deactivating would fight the selected-fx mental model | ✓ Good — pinned in playbackEngine tests; UAT Row 7 confirmed as callout, not a bug |
| Phase 52.5 document sound as reference-only `audio/` persistence + closed bridge keys (LAUNCH_KEYS/DOCUMENT_AUDIO_KEYS fail-closed) + mix-not-contend clip dispatch | Sound bytes must never enter the .mce document; ad-hoc bridge keys would reopen the injection surface; Studio claim and main playback must mix rather than contend | ✓ Good — 10/10 UAT, threats_open: 0, single decode keyed by sound.id, export mix gated by tested pure functions |
| v1.0.0 clean-break versioned EFX Paint document (no migration/compat shim; pre-v1.0 rejected at parse time) | Migration code for a format that never shipped publicly is dead weight; legacy data fails explicitly instead of rendering wrong | ✓ Good — 5-fixture rejection truth table; native UAT confirmed clean pre-v1 projects still open |
| v1.0.0 one document format everywhere (D-03): session file, bridge launch context, standalone engine, main persistence all re-wired to the same v1.0 model | Divergent per-surface formats were the root of earlier persistence bugs | ✓ Good — SerializedProject consumer sweep completed; legacy version:2 session files distinctly rejected |
| v1.0.0 track-addressed runtime (per-track maps, revision signals, track-scoped operation leases) over parent-layer addressing | Multi-track editing needs isolation guarantees at the store layer, not UI discipline | ✓ Good — Phase 46-47 UAT: edits never cross tracks; stale async commits fail closed |
| v1.0.0 `getFlattenedFrame` as the sole content path for main preview and export (CMP-01 keystone) | Two composition paths guarantee preview/export drift | ✓ Good — pixel acceptance matrix + native parity UAT green |
| v1.0.0 fond collapsed to one document-fallback authority (D-11) | The per-track roto metadata walk duplicated resolution logic across surfaces | ✓ Good — one resolution, two consumers (gate/draw) pinned by test; 260920-k34 approved |
| v1.0.0 bytes/ImageBitmap frame runtime + Rust WebP-lossless + 512 MB LRU over base64 dataUrl strings | base64 strings caused decode storms and O(n) memory inflation at HD | ✓ Good — 52.1 leave-perf blocker resolved (5–8s → 120ms); HD native resolution shipped |
| v1.0.0 references-only `.mce` package with per-file change tokens behind one transaction | Images/heavy media as disk refs keep documents light; transactional save keeps them consistent | ⚠️ Revisit — Known Gaps PKG-06/BKG-09: display-class setters skip the change-token rotation, so display-only edits revert on reopen |
| v1.0.0 XState v6 + Effect v4 pilot on stroke finalization + flush pipeline (measured, not adopted on reputation) | Hand-rolled FSMs from timers/boolean flags caused races; conventions needed proof before widening | ✓ Good — pilot verdict admitted on T4/T5 + inspectability; `efx-async-orchestration` skill written |
| v1.0.1 dual-language `.mce` law: every field declared in BOTH TS interface and Rust struct | serde silently drops undeclared keys on open; TS mocks never cross the boundary | ✓ Good — enforced mechanically by mceFieldContract.test.ts |
| v1.0.1 contract test diffs TS interfaces vs Rust structs (not call sites) | Interface IS the emit contract; catches declared-but-not-emitted too | ✓ Good — 4/4 tests green, self-test proves the diff is live |
| v1.0.1 round-trip pin pattern: Rust save→open + TS build→hydrate for every persistence fix | A fix that patches one side can still lose the value at the other boundary | ✓ Good — N1-N4 all carry both pins |
| v1.0.1 release hard rules 10+11: never publish before audit; delete-and-rerun a known-broken release | v1.0.1 incident: first publish went out pre-audit and was known-broken | ✓ Good — rule enforced in efx-motion-release skill |
| v2.0.0 is MAJOR: module switcher = new product shape + accepted `.mce` clean break; full paint engine is not a 1.x minor | Semver law from now on: MAJOR = new product shape / accepted break · MINOR = module or major feature · PATCH = debt | — Pending |
| v2.0.0 CLEAN BREAK ACCEPTED — no migration code, no dual-format readers, no backward-compat shims/branches; engines must not be slowed for compatibility | The release matters more than compatibility; v1.0.1 projects/scripts may stop opening or replaying | — Pending |
| v2.0.0 fail-closed is data honesty, not compatibility — any unreadable script/asset refuses with a named visible error (53.1 law); never drop data silently | Clean break does not license silent data loss | — Pending |
| v2.0.0 ONE shared Studio engine (script, cache, timeline) for all modules; modules change only the options/features surface | Studio script law is shared; engine AND UI isolated per paint | — Pending |
| v2.0.0 host APIs are generic over the per-engine stroke payload (pts, ticks, cuisson, motion, brush id + toolOverrides) — never engine-specific params | Engine-1 host split is the hard prerequisite of engines 2 and 3; pay it once | — Pending |
| v2.0.0 efx-watercolor CONSUMES efx-spectral; if plan-time shows 56 needs spectral first, create `packages/efx-spectral` early inside 56 (or pull 57's content forward) | Never duplicate the mixing code inside the watercolor engine | — Pending |
| v2.0.0 brush-pack snapshot travels in `.mce` | Deliberate exception to the 52.2 refs-only law | — Pending |
| v2.0.0 time = fixed tick grid (~1/60 s), integer ticks, never raw ms; determinism = same script ⇒ same pixels, FNV-1a traceSeed per stroke, no `Math.random()` in deposit/sim path | Script replay parity and engine reproducibility | — Pending |
| v2.0.0 module switcher designed for three modules (Brush \| Water color \| Krita); only Brush + Water color ship here | Krita is the v2.1.0 slot — do NOT implement krita in v2.0.0 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-14 after milestone v2.0.0 started — MAJOR (multi-module paint workstation), global phases 54–57, locked scope + clean-break + UI/UX stances recorded. Previous: v1.0.1 shipped 2026-10-13 (7 quicks + phase 53.1, 100 commits, 13/13 requirements approved).*
