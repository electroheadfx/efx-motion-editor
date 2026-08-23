# Stack Research

**Domain:** Tauri v2 macOS desktop app — milestone v1.0.0 multi-track internal EFX Paint frame documents (track-local Paint/Roto/PlayScript state, internal multi-track compositor, fixed Background track with imported Loop Clips, photo/reference track, shared Reveal mask compositor, read-only audio preview)
**Researched:** 2026-08-23
**Confidence:** HIGH (all new capabilities map onto existing, proven machinery verified by direct repo inspection; version claims cross-checked against the npm registry; zero new runtime dependencies)

## Executive Summary

Milestone v1.0.0 requires **no new runtime or dev dependencies**. Every new capability is a pure TypeScript data-model + Canvas 2D + existing signal-store extension of machinery already in the repo and already proven by v0.8.0/v0.9.0:

- **Multi-track compositor** → the existing Canvas 2D compositing pass in `previewRenderer.ts` (with `blendModeToCompositeOp` mapping the existing `BlendMode` enum to `globalCompositeOperation`) already composites multiple layers with opacity/blend. The internal compositor is a second, self-contained compositing pass that produces one flattened parent raster per frame; the main editor keeps compositing that parent raster exactly once.
- **Track-local state/caches** → the existing `physicPaintStore.ts` already keys per-layer state with `Map<string, Map<number, ...>>` plus a `paintVersion`/`rotoPhysicalRevision` counter-signal pattern. Track-local state adds one key level (`layerId → trackId → frame`); the signal-store + revision-authority pattern is unchanged.
- **Background track + Loop Clips** → the Loop Clip resolver already implemented in `physicsPaintRotoPhysicalResolver.ts` / `physicsPaintRotoLoopClips.ts` (modulo source mapping, finite repeat from 1, infinity, next-clip interruption, half-open intervals) is exactly the resolution the spec's Background track requires. The main editor already imports still images and ordered image sequences through `imageStore` (LRU pool) + the Rust image pipeline.
- **Photo/reference track** → a source reference plus Canvas 2D `drawImage`; the spec's `reference-only` / `reveal-source` / `masked-transform-source` modes are data-model flags, not new rendering tech.
- **Read-only audio preview** → already shipped in v0.9.0 Phase 41 (`efxPaintAudioPreviewStore.ts`, `efxPaintAudioMonitor.ts`, `efxPaintAudioOwnership.ts`, `efxasset://` transport, revisioned context). Reuse as-is; the spec's "read-only synchronized monitoring" is the exact Phase 41 contract.
- **Shared mask compositor + Reveal** → Canvas 2D offscreen compositing with `globalCompositeOperation` (`destination-in`/`source-in`/`source-atop`), the same technique already used in `paintRenderer.ts` for eraser (`destination-out`) and onion skin. No mask library needed.

The only "new" work is the v1.0.0 EFX Paint document schema (a clean-break `.mce` format addition with explicit pre-v1.0 rejection) and the multi-row timeline strip (an extension of the existing Canvas 2D Roto strip). Both are pure TypeScript + Rust serde work on established patterns.

All existing dependencies are on caret ranges that already resolve to current versions (`@preact/signals` ^2.8.1 → 2.11.x, `@tauri-apps/api` ^2.10.1 → 2.11.x, `preact` ^10.28.4 → 10.29.x, `tailwindcss` ^4.0.0 → 4.3.x, Tauri plugins → current). No bump is required. Vite stays pinned at 5.4.21 (the v0.9.0 decision: `@efxlab/motion-canvas-vite-plugin` 4.0.0 interop is delicately patched; Vite 8 is not a target).

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Canvas 2D compositing (`previewRenderer.ts` pattern + `blendModeToCompositeOp`) | Platform (WKWebView) | Internal multi-track compositor → one flattened parent raster per frame | **No new dependency.** The existing compositor already resolves multiple layers with the exact `BlendMode` enum the spec requires (normal/screen/multiply/overlay/add → `source-over`/`screen`/`multiply`/`overlay`/`lighter`). The internal compositor is a second pass that composites Background → Paint tracks in stable order with hide/solo/opacity/blend, then publishes one raster through the existing parent Paint-layer boundary. Canvas 2D guarantees Studio/preview/export parity because all three already share the same compositing path. |
| Preact Signals store pattern (`physicPaintStore.ts`, `paintVersion`/`rotoPhysicalRevision` counters) | `@preact/signals` ^2.8.1 (resolves 2.11.x) | Track-local Paint/Roto/PlayScript frames, caches, revision, dirty state | **No new dependency.** The store already uses `Map<string, Map<number, T>>` keyed by layerId with a counter signal for controlled re-renders. Track-local state adds a `trackId` key level and a per-track revision; the authority/revision guard pattern (parent/document/track revision revalidation before async commit) is the established Phase 36.8/43.2 lease pattern. |
| Loop Clip resolver (`physicsPaintRotoPhysicalResolver.ts`, `physicsPaintRotoLoopClips.ts`) | Existing (pure TS) | Background track Loop Clips: modulo source mapping, finite repeat 1..∞, next-clip interruption, half-open intervals | **No new dependency.** The resolver already implements `sourceIndex = (frame - start) mod cycleLength`, `requestedDuration = cycleLength × repeatCount`, `effectiveDuration = min(requestedDuration, boundary - start)`, and next-clip priority — the exact formula the spec's Background loop resolution requires. Background clips reuse the same resolver with `sourceKind: 'imported-background'`; Hold clips keep `sourceKind: 'playscript-hold'`. |
| `imageStore` LRU pool + Rust image pipeline (`importImages` IPC, `assetUrl`) | Existing | Imported still/sequence Background clips, photo/reference source | **No new dependency.** The main editor already imports still images and ordered image sequences (content overlay layers) with LRU eviction and Rust thumbnail generation. Background clips reference the same `ImportedImage`/sequence assets by linked source-frame reference; repetitions never duplicate durable images. |
| Web Audio read-only preview (`efxPaintAudioPreviewStore.ts`, `efxPaintAudioMonitor.ts`, `efxPaintAudioOwnership.ts`) | Existing (v0.9.0 Phase 41) | Read-only main-editor audio monitoring during internal track playback | **No new dependency, no new code.** Phase 41 already delivers revisioned read-only audio context over the `physic-paint:*` bridge with `efxasset://` byte transport, drift-free `AudioContext.currentTime` scheduling, doubled-audio ownership guard, and engine release on close. The v1.0.0 spec's audio requirements are a subset of the Phase 41 contract. |
| Canvas 2D offscreen mask compositing (`globalCompositeOperation` `destination-in`/`source-in`/`source-atop`) | Platform (WKWebView) | Shared mask compositor + Reveal (photo source + Paint/PlayScript coverage) | **No new dependency.** The project already uses offscreen canvas compositing for eraser (`destination-out`) and onion skin. Reveal = draw photo source into an offscreen canvas, then apply mask alpha via `destination-in` (or `source-in` on a mask canvas). Explicit alpha-vs-luma interpretation is a data-model flag, not new tech. |
| Rust serde persistence (`.mce` format) | Existing (Tauri 2.x) | v1.0.0 EFX Paint document schema (clean break) | **No new dependency.** The project has a proven `.mce` progressive-format pipeline (v1→v15). v1.0.0 is a clean break: a new versioned document schema with explicit rejection of pre-v1.0 Paint data, no migration shim. Same serde + PNG sidecar pattern as `physicPaintPersistence.ts`. |
| Canvas 2D multi-row timeline strip (`PhysicsPaintWorkflowStrip.tsx` pattern) | Existing | Internal multi-track timeline with filmstrip capsules | **No new dependency.** The Roto timeline is already a custom Canvas 2D strip with semantic cell rendering and the Phase 43 filmstrip loop capsule (source cycle + hatched repetition band + ×N/∞ badge). Multi-track = render N Paint rows + one fixed Background row + one photo/reference row with the same renderer. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@preact/signals` | ^2.8.1 (resolves 2.11.x) | Track-local reactive state, active-track selection, hide/solo/opacity/blend signals | Already in use; no change. The `computed`/`effect`/`signal` API covers all track-local reactivity. |
| `@tauri-apps/api` (event `emit`/`listen`) | ^2.10.1 (resolves 2.11.x) | Parent/document/track revisioned bridge messages, audio preview context | Already in use; the `physic-paint:*` bridge carries the revisioned context. No new event surface beyond the existing bridge. |
| `@tauri-apps/plugin-dialog` | ^2.6.0 (resolves 2.7.x) | Native file dialog for Background still/sequence import | Already in use for image import; reuse the existing `importImages` IPC path. |
| `@tauri-apps/plugin-fs` | ^2.4.5 (resolves 2.5.x) | Project-local asset reads (Background source frames, photo source) | Already in use; the `efxasset://` protocol + `assetUrl` handles asset reads in the paint window. |
| `@tauri-apps/plugin-store` | ^2.4.2 (resolves 2.4.x) | Session-local EFX Paint document state | Already in use for session persistence; reuse for the v1.0.0 document session file. |
| `sortablejs` | ^1.15.7 | Track reorder drag in the multi-row timeline | Already in use for sidebar drag-reorder with `forceFallback:true` (bypasses Tauri native DnD interception). Reuse for track reorder; do not add a new DnD library. |
| `perfect-freehand` | ^1.2.3 | Basic paint track stroke rendering | Already in use; per-track paint frames reuse the same stroke engine. |
| `p5.brush` | 2.1.3-beta | FX paint track rendering | Already in use; per-track FX frames reuse the same adapter. |
| `@efxlab/efx-physic-paint` | workspace:* | Physics/Roto paint track rendering | Already in use; per-track Roto real keys and generated interpolation reuse the same engine host. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest 2.x (current) | Regression coverage: track-local mutation, Loop Clip resolution, hide/solo truth table, opacity/blend pixel matrix, Reveal alpha/luma truth table, clean-break rejection | Reuse the existing config — no new test setup (project constraint). The pixel-acceptance matrix and truth tables are pure data-model + offscreen-canvas tests. |
| `cargo test` + `pnpm --dir app run typecheck` + `pnpm build` | v1.0.0 automated gates (Phase 9) | Already wired; the spec's gate list is the existing pipeline. |
| `bash scripts/macos-release.sh preflight` | Release preflight | Already wired (v0.8.1/v0.9.0 release pipeline); unchanged for v1.0.0. |

## Installation

```bash
# No new packages. Zero additions to app/package.json dependencies or devDependencies.
# No changes to packages/efx-physic-paint/package.json.
# No Rust crate additions to app/src-tauri/Cargo.toml.
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Canvas 2D internal compositor (reuse `previewRenderer.ts` pattern) | PixiJS / Konva / any WebGL scene-graph compositor | Never for this spec: the existing Canvas 2D compositor already produces the exact blend-mode output the pixel-acceptance matrix requires, and Studio/preview/export parity is only guaranteed by sharing one compositing path. A scene-graph library would fork the render path and break parity. |
| Reuse `physicsPaintRotoPhysicalResolver.ts` for Background Loop Clips | A new Background-specific loop scheduler | Never: the resolver already implements the spec's exact loop formula (modulo, finite/infinite, next-clip interruption, half-open intervals). A second scheduler would duplicate the off-by-one risk the spec's risk register calls out. |
| Reuse v0.9.0 Phase 41 audio preview (`efxPaintAudioPreviewStore.ts`) | A new audio engine in the paint window | Never: Phase 41 already delivers read-only synchronized monitoring with drift-free scheduling and the doubled-audio guard. A second engine is the exact doubled-audio pitfall. |
| Canvas 2D offscreen mask compositing (`destination-in`/`source-in`) | A mask library (e.g. `@rive-app`, `gl-matrix`-based mask compositor) | Never: the project already uses offscreen `globalCompositeOperation` for eraser/onion skin. Reveal is a two-canvas `drawImage` + `destination-in` operation. |
| Extend the existing Canvas 2D Roto strip to multi-row | A timeline UI library (e.g. `dnd-kit`, `react-timeline-editor`) | Never: the project constraint is "no heavy UI libraries", and the Roto strip already renders semantic cells + filmstrip capsules. A UI library would fight the custom renderer and add bundle weight against the 1100 kB budget. |
| New `.mce` v1.0 document schema (clean break) | Progressive migration from pre-v1.0 Paint data | Explicitly excluded by the locked spec: v1.0.0 is a clean format break with explicit rejection of pre-v1.0 data. No migration shim, no legacy reader, no compatibility branch. |
| Stay on Vite 5.4.21 | Vite 6/7/8 upgrade | Never for this milestone: the v0.9.0 research locked Vite 5.4.21 because `@efxlab/motion-canvas-vite-plugin` 4.0.0 interop (CJS default interop, `motion-canvas:project` input contribution, esbuild config-hook repair) is delicately patched in `vite.config.ts`. A Vite upgrade is a separate, risky effort with zero v1.0.0 benefit. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any new compositing/scene-graph library (PixiJS, Konva, Two.js, etc.) | The existing Canvas 2D compositor already produces the exact blend-mode output; a scene-graph would fork the render path and break Studio/preview/export parity | Extend `previewRenderer.ts` with an internal compositor pass |
| Any new state-management library (XState, Zustand, Redux, MobX) | The Phase 36.8 decision explicitly rejected XState; the signal-store + revision-authority pattern is proven across v0.8.0/v0.9.0 | Preact Signals stores with per-track revision counters |
| Any new timeline/UI library | Project constraint: no heavy UI libraries; the Roto strip already renders semantic cells + filmstrip capsules | Extend the existing Canvas 2D strip to multi-row |
| Any new audio library (howler.js, tone.js, etc.) | Phase 41 already ships read-only synchronized audio preview with drift-free scheduling | Reuse `efxPaintAudioPreviewStore.ts` |
| Any new image-decoding library (sharp, jimp, etc.) | The Rust image pipeline + WKWebView decode already handle all accepted formats; `imageStore` LRU manages memory | Reuse `imageStore` + `importImages` IPC |
| Any new mask/alpha library | Canvas 2D `globalCompositeOperation` (`destination-in`/`source-in`) already implements mask compositing; the project uses it for eraser/onion skin | Offscreen canvas compositing |
| Any new schema/validation library (zod, io-ts, etc.) | The project uses hand-rolled fail-closed type guards (`isPhysicPaint*` in `types/physicPaint.ts`) with exhaustive unions | Hand-rolled guards for the v1.0.0 document schema |
| Any new undo library | The custom command-pattern undo (`history.ts`, `historyStore.ts`) is proven across all store mutations | Extend the command pattern with track-scoped commands |
| Any new DnD library | `sortablejs` with `forceFallback:true` already handles drag-reorder reliably | Reuse `sortablejs` for track reorder |
| Vite 6/7/8 or Rolldown upgrade | Deliberately excluded (v0.9.0 decision); motion-canvas-vite-plugin 4.0.0 interop is delicately patched | Stay on Vite 5.4.21 |
| New Rust crates for image sequence / compositing | The existing Rust image pipeline + Canvas 2D compositor cover the spec; new crates add compile weight and IPC surface | Reuse existing Rust commands + Canvas 2D |
| A second audio engine in the paint window | The doubled-audio ownership guard (Phase 41) exists precisely to prevent this | Single preview authority: only the paint window's Phase 41 engine starts sources |

## Stack Patterns by Variant

**Internal multi-track compositor (Phase 4):**
- One shared internal composition path for Studio preview and flattened output — never two paths. The compositor resolves document fallback → Background clip (modulo/repeat/interruption) → participating Paint tracks (hide/solo truth table) → per-track real/generated/cached content → composite in stable order with per-track opacity/blend → one flattened raster + composite revision.
- Parent opacity/blend is applied once by the main editor after flattening; never copied into internal tracks (the spec's double-apply stop condition).
- Track cache key includes track revision + composition dependencies; parent cache invalidates when any participating track, Background clip, source image, or fallback changes.

**Track-local state (Phase 2):**
- Extend the `physicPaintStore` `Map<string, Map<number, T>>` pattern to `Map<layerId, Map<trackId, Map<number, T>>>`. Keep the counter-signal pattern (`paintVersion`-style) for controlled re-renders; never make the Maps reactive.
- Async PlayScript/Reveal operations revalidate parent + document + track revision before commit (the Phase 36.8/43.2 lease pattern). Stale work must fail closed.
- Undo snapshots metadata and asset references, never large PNG bytes (the spec's memory rule).

**Background track + Loop Clips (Phase 5):**
- Reuse the existing Loop Clip resolver verbatim: `sourceIndex = (frame - start) mod cycleLength`, `requestedDuration = cycleLength × repeatCount`, `effectiveDuration = min(requestedDuration, boundary - start)`, `boundary = min(nextClipStart, parentEnd)`. Half-open intervals so adjacent clips meet without off-by-one overlap.
- Background clips never overlap; move/insert rejects or snaps collisions. Gaps reveal the document fallback (solid color or transparency checkerboard).
- Filmstrip capsule: reuse the Phase 43 capsule renderer (source cycle + hatched repetition band + ×N/∞ badge + diagonal partial-cycle cut). Label the interrupting clip `clip suivant — interrompt la boucle`, never `clip bloquant`.

**Photo/reference track (Phase 6):**
- `reference-only` / `reveal-source` / `masked-transform-source` are data-model mode flags on a source reference. Reference visibility in Studio never leaks into flattened output (the spec's leak stop condition).
- Source revision invalidates dependent Reveal/transformation results.

**Reveal mask compositor (Phase 8):**
- One offscreen source-plus-mask compositor shared by Studio and flattened output. Photo source → offscreen canvas; Paint/PlayScript coverage → mask alpha; `destination-in` applies the mask. Explicit alpha-vs-luma interpretation and optional inversion are data-model flags.
- Empty mask reveals nothing; full mask reveals the entire source; partial alpha creates soft edges; eraser removes coverage.

**Audio preview (Phase 7):**
- Reuse Phase 41 as-is: revisioned read-only context over the `physic-paint:*` bridge, `efxasset://` byte transport, `AudioContext.currentTime` scheduling, doubled-audio guard, engine release on close. All internal tracks share one application-frame playback cursor; audio monitoring follows that cursor.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@preact/signals` ^2.8.1 | `preact` ^10.28.4 | Caret ranges resolve to current (signals 2.11.x, preact 10.29.x); peer `preact >= 10.25` satisfied. No bump needed. |
| `@tauri-apps/api` ^2.10.1 | `@tauri-apps/cli` ^2.10.0, Tauri 2.x runtime | Caret ranges resolve to 2.11.x. No bump needed for any v1.0.0 feature. |
| `@tauri-apps/plugin-fs` ^2.4.5 / `plugin-dialog` ^2.6.0 / `plugin-store` ^2.4.2 | `@tauri-apps/api` ^2.11.0 | Caret ranges resolve to current (fs 2.5.x, dialog 2.7.x, store 2.4.x). No bump needed. |
| `tailwindcss` ^4.0.0 | `@tailwindcss/vite` ^4.0.0 | Caret ranges resolve to 4.3.x. No bump needed. |
| Vite 5.4.21 | `@efxlab/motion-canvas-vite-plugin` 4.0.0 | Deliberately pinned (v0.9.0 decision). Do not upgrade for v1.0.0. |
| Canvas 2D compositing | WKWebView (macOS) | All `globalCompositeOperation` modes used (`source-over`, `screen`, `multiply`, `overlay`, `lighter`, `destination-in`, `source-in`, `destination-out`) are standard Canvas 2D; no WebKit gaps. |
| Loop Clip resolver (pure TS) | `physicPaintStore` revision signals | Pure data-model module; no version coupling. |

## Sources

- npm registry (https://registry.npmjs.org/@preact/signals, /@tauri-apps/api, /preact, /tailwindcss, /@tauri-apps/plugin-fs, /@tauri-apps/plugin-dialog, /@tauri-apps/plugin-store) — current version verification (MEDIUM, cross-checked against project `package.json` caret ranges)
- Tauri v2 release page (https://v2.tauri.app/release/) — `@tauri-apps/api` 2.11.1, cli 2.11.4 (MEDIUM)
- Tailwind CSS v4.3 blog (https://tailwindcss.com/blog/tailwindcss-v4-3) — v4.3.x line (MEDIUM)
- Local codebase (HIGH, direct evidence): `app/src/lib/previewRenderer.ts` (Canvas 2D compositor + `blendModeToCompositeOp`), `app/src/stores/physicPaintStore.ts` (Map-keyed per-layer state + revision signals + lease authority), `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` + `physicsPaintRotoLoopClips.ts` (Loop Clip resolver: modulo, finite/infinite, next-clip interruption), `app/src/lib/paintRenderer.ts` (offscreen `globalCompositeOperation` compositing), `app/src/stores/imageStore.ts` (LRU image/sequence pool), `app/src/components/physic-paint/audio/efxPaintAudioPreviewStore.ts` + `efxPaintAudioMonitor.ts` + `efxPaintAudioOwnership.ts` (Phase 41 read-only audio preview), `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` (Canvas 2D Roto strip + filmstrip capsule), `app/src/lib/physicPaintPersistence.ts` (serde + PNG sidecar persistence), `app/package.json` (current dependency ranges)

---
*Stack research for: EFX-Motion Editor v1.0.0 multi-track EFX Paint frames and Reveal*
*Researched: 2026-08-23*
