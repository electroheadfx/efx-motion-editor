# Project Research Summary

**Project:** EFX Motion Editor — milestone v1.0.0 (EFX Paint Multi-Track Frames and Reveal)
**Domain:** macOS stop-motion editor (Tauri 2.0 + Preact Signals monorepo) — multi-track internal EFX Paint frame documents, deterministic internal compositor, fixed Background track with Loop Clips, photo/reference track, shared mask compositor + Reveal, read-only audio preview
**Researched:** 2026-08-23
**Confidence:** HIGH

## Executive Summary

Milestone v1.0.0 turns one parent Paint layer into a complete multi-track frame animation document. The locked architectural invariant is: **one parent Paint layer → one EFX Paint document → many internal Paint frame tracks → one flattened frame result delivered to the unchanged main-editor compositor.** The main editor never iterates internal tracks; it composites the parent raster exactly once with the unchanged outer layer stack. All multi-track editing happens inside the EFX Paint window.

The research confirms the spec is implementable on existing machinery with **zero new dependencies**. Every new capability is a pure TypeScript data-model + Canvas 2D + existing signal-store extension of proven code: the internal compositor is a second Canvas 2D pass reusing `previewRenderer.ts`'s `blendModeToCompositeOp`; track-local state extends the `Map<layerId, Map<number, T>>` store pattern to `Map<layerId, Map<trackId, Map<number, T>>>`; Background Loop Clips reuse the existing Loop Clip resolver verbatim; the photo/reference track is a data-model mode flag; audio preview reuses v0.9.0 Phase 41 as-is; Reveal is offscreen `globalCompositeOperation` mask compositing. The only genuinely new work is the v1.0.0 `.mce` document schema (a clean break with explicit pre-v1.0 rejection) and the multi-row timeline strip.

The key risks are all data-corruption and output-parity traps, not ecosystem unknowns: track identity via array position, stale async commits to the wrong track, track-local cache keys missing `trackId`, parent opacity/blend double-application, Studio/main/export divergence, and loop off-by-one seams. Every risk has a proven prevention pattern already in the repo (stable IDs, parent/document/track revision authority, per-track cache keys, one shared composition path, half-open loop intervals). The 9-phase structure in the spec is confirmed as the correct build order, with Phase 1 (clean break) as the mandatory foundation and Phase 4 (compositor) as the keystone.

## Key Findings

### Recommended Stack

**Zero new runtime or dev dependencies.** All existing dependencies are on caret ranges that already resolve to current versions; no bump is required. Vite stays pinned at 5.4.21 (the v0.9.0 decision — `@efxlab/motion-canvas-vite-plugin` 4.0.0 interop is delicately patched). The only "new" work is the v1.0.0 document schema (Rust serde + PNG sidecar, same pattern as `physicPaintPersistence.ts`) and the multi-row timeline strip (extension of the existing Canvas 2D Roto strip).

**Core technologies (all existing, all reused):**
- **Canvas 2D compositing** (`previewRenderer.ts` + `blendModeToCompositeOp`): the internal multi-track compositor is a second self-contained pass producing one flattened parent raster per frame. Guarantees Studio/preview/export parity because all three share one compositing path.
- **Preact Signals store pattern** (`physicPaintStore.ts`, `paintVersion`/`rotoPhysicalRevision` counters): track-local state adds a `trackId` key level; the counter-signal + lease-authority pattern is unchanged.
- **Loop Clip resolver** (`physicsPaintRotoPhysicalResolver.ts` / `physicsPaintRotoLoopClips.ts`): reuse verbatim for Background clips (`sourceKind: 'imported-background'`) and Hold clips (`sourceKind: 'playscript-hold'`). Modulo source mapping, finite repeat 1..∞, next-clip interruption, half-open intervals.
- **`imageStore` LRU pool + Rust image pipeline** (`importImages` IPC, `assetUrl`): imported still/sequence Background clips and photo source.
- **Web Audio read-only preview** (v0.9.0 Phase 41 `efxPaintAudioPreviewStore`/`efxPaintAudioMonitor`/`efxPaintAudioOwnership`): reuse as-is; the spec's audio requirements are a subset of the Phase 41 contract.
- **Canvas 2D offscreen mask compositing** (`globalCompositeOperation` `destination-in`/`source-in`/`source-atop`): shared mask compositor + Reveal; same technique already used for eraser/onion skin.
- **Rust serde persistence** (`.mce` format): v1.0.0 clean-break document schema with explicit pre-v1.0 rejection, no migration shim.
- **Canvas 2D multi-row timeline strip** (`PhysicsPaintWorkflowStrip.tsx` pattern): N Paint rows + one fixed Background row + one photo/reference row with the same renderer.

**What NOT to use:** any new compositing/scene-graph library (PixiJS/Konva), any new state-management library (XState/Zustand), any new timeline/UI library, any new audio library, any new image-decoding library, any new mask/alpha library, any new schema/validation library, any new undo library, any new DnD library, Vite 6/7/8, new Rust crates, or a second audio engine. Each would fork a proven path and break parity.

### Expected Features

**Must have (table stakes):** versioned v1.0 document owned by one parent layer ID; track CRUD (add/rename/duplicate/delete/reorder); active track selection; per-track hide/solo; per-track opacity/blend; deterministic internal compositor → one flattened parent raster per frame; fixed Background track with imported still/sequence Loop Clips; Loop Clips (finite/infinite repeat, gaps, fallback); photo/reference track; Reveal via Paint/PlayScript coverage; read-only audio preview; filmstrip capsule timeline; save/reopen, undo/redo, clean-break legacy rejection, preview/export parity.

**Should have (differentiators):** deterministic physical-frame Roto timeline per internal track; linked Hold Loop Clips with linked source-frame references (no duplicated assets); PlayScript progressive/static/hold application per track; Reveal through animated coverage; read-only cross-window audio preview; clean-break v1.0 format with explicit legacy rejection.

**Defer (v2+):** multiple Background tracks; Background crossfades/transitions; nested track groups; track effects stacks; independent per-track transforms; multiple masks/vector masks/mask keyframes; advanced retiming; independent EFX Paint audio editing; online AI providers (v1.1 Codex+MMX AI is already on the roadmap).

### Architecture Approach

The invariant is locked: one parent Paint layer → one EFX Paint document → many internal Paint frame tracks → one flattened frame result delivered to the unchanged main-editor compositor. New code lives in a new `app/src/efx-paint/` domain folder (document model, compositor, background, photo-reference, mask) kept separate from the existing `physic-paint/` component tree. The main editor's `previewRenderer.ts` is unmodified — it consumes one flattened raster via the existing parent-layer boundary.

**Major components:**
1. `efxPaintStore.ts` + `efx-paint/document/` — the v1.0.0 document model, fail-closed parsers, revision builders, clean-break rejection.
2. `efx-paint/compositor/` — the deterministic internal compositor (one shared path for Studio preview and flattened output), hide/solo truth table, track-revision-keyed cache.
3. `efx-paint/background/` + `efx-paint/photo-reference/` + `efx-paint/mask/` — the three track types and the Reveal mask compositor.
4. Modified `physicPaintStore.ts`/`paintStore.ts` — track-local addressing (`layerId → trackId → frame`).
5. Modified `physicPaintBridge.ts` — document/track revisioned messages; async PlayScript/Reveal revalidate parent+document+track revision before commit.
6. Modified `PhysicsPaintWorkflowStrip.tsx`/`useRotoTimelineModel.ts` — multi-row timeline with filmstrip capsules.
7. Reused verbatim: Loop Clip resolver, Phase 41 audio, `imageStore`, `previewRenderer.ts` boundary.

**Key patterns:** one parent layer → one document → many tracks → one flattened result (the invariant); track-local addressing; revision-based async authority (parent/document/track); one shared internal composition path; linked source-frame references + modulo resolver; staging/commit persistence transaction; real-key/cache boundary per track; clean-break document boundary.

### Critical Pitfalls

1. **Track identity via array position** — reorder/undo/cache/Reveal silently retarget to the wrong track. Avoid: stable `trackId` strings never rewritten by reorder; all maps `Map<layerId, Map<trackId, ...>>`; every cache key embeds `trackId`. (Phase 1/2)
2. **Legacy one-track schema/renderer remains reachable** — a "temporary" compat branch becomes permanent dual maintenance. Avoid: delete or make unreachable the old one-track renderer and persistence path; reject pre-v1.0 data explicitly with a loud, testable failure. (Phase 1)
3. **Stale async commit to wrong track** — an async PlayScript/Reveal/Background-import started on track A commits to track B after a switch. Avoid: async authority checks include parent + document + track revision; fail-closed on deleted track. (Phase 2)
4. **Track-local cache keys missing `trackId` (and a single global `paintVersion`)** — cross-track cache pollution and over-invalidation. Avoid: every cache key embeds `trackId`; per-track `paintVersion` bump + subscribe keyed to active track. (Phase 2/4)
5. **Parent opacity/blend double-applied** — the internal compositor bakes parent opacity/blend, then the main editor applies it again. Avoid: internal compositor produces a flat raster with internal track opacity/blend applied once in a locked order; parent applies opacity/blend exactly once. Contract test: parent 50% + internal 50% = 25%. (Phase 4)
6. **Studio/main/export divergence** — three surfaces drift if the compositor is re-implemented per surface. Avoid: one shared internal composition path; one resolver owns Background effective-duration; pixel acceptance matrix is the gate. (Phase 4/5/8)
7. **Loop next-clip interruption off-by-one** — seam frames overlap or gap. Avoid: lock half-open `[start, start + effectiveDuration)` intervals; truth-table tests before implementation; one resolver owns effective-duration. (Phase 5)
8. **Reference photo leaks into output** — reference visibility accidentally enters flattened output. Avoid: explicit source mode (`reference-only`/`reveal-source`/`masked-transform-source`); exclusion tests. (Phase 6/8)
9. **Scope creep via forbidden sequence-level assumptions** — the milestone grows into a main-editor rewrite. Avoid: enforce locked ownership boundaries as review gates; no `Sequence.frameTracks`, no main-editor rows for internal tracks, no direct main-renderer iteration. (All phases)

## Implications for Roadmap

The spec's 9-phase structure is confirmed as the correct build order. The research validates the ordering rationale and adds specific pitfalls each phase must avoid.

### Phase 1: New EFX Paint document and clean cutover
**Rationale:** The document model and clean-break rejection are the foundation; every later phase addresses state inside the document. Deleting the legacy path first prevents any new feature from accidentally depending on it.
**Delivers:** versioned v1.0 document, stable track IDs, one default Paint track + one fixed Background track, document revision, active track ID, explicit pre-v1.0 rejection.
**Addresses:** versioned document, clean-break legacy rejection (FEATURES.md table stakes).
**Avoids:** Pitfall 2 (legacy path reachable), Pitfall 1 (track identity model locked here).

### Phase 2: Track-local Paint/Roto/PlayScript and caches
**Rationale:** The multi-row timeline shows frame keys/caches on the correct row — it needs track-local state to exist first.
**Delivers:** `layerId → trackId → frame` addressing, track-local frames/caches/revision/dirty state, shared Loop Clip resolver, track-aware invalidation, parent/document/track async authority.
**Uses:** Preact Signals store pattern, Loop Clip resolver (STACK.md).
**Implements:** track-local addressing + revision authority patterns (ARCHITECTURE.md).
**Avoids:** Pitfall 1 (addressing), Pitfall 3 (stale async), Pitfall 4 (cache keys), Pitfall 5 (undo wrong track), Pitfall 9 (loop asset duplication), Pitfall 17 (raster bytes in undo).

### Phase 3: Internal multi-track timeline and controls
**Rationale:** The compositor consumes track-local state and the hide/solo/opacity/blend controls the timeline exposes.
**Delivers:** multi-row strip, filmstrip capsules, track CRUD UI, active selection, hide/solo/opacity/blend controls, fixed Background row, distinct photo/reference/audio surfaces.
**Uses:** Canvas 2D multi-row timeline strip (STACK.md).
**Avoids:** Pitfall 12 (Background overlap/reorder), Pitfall M2 (active-track routing), Pitfall M8 (hide/solo truth table drift), minor pitfalls (banned `clip bloquant` term, requested/effective duration visibility).

### Phase 4: Internal compositor and flattened parent result
**Rationale:** The flattened-result contract is the milestone's keystone; Background (5), photo/reference (6), and Reveal (8) all feed the same compositor. Landing it first keeps each later track type a clean addition. **Hard dependency:** Phase 4's flattened output must be the ONLY path — do not build a Studio-only preview path in Phase 3 that Phase 4 has to replace.
**Delivers:** one shared internal composition path, hide/solo truth table, per-track opacity/blend in stable order, one flattened raster + composite revision, pixel acceptance matrix.
**Uses:** Canvas 2D compositing + `blendModeToCompositeOp` (STACK.md).
**Implements:** `efx-paint/compositor/` (ARCHITECTURE.md).
**Avoids:** Pitfall 6 (parent opacity/blend double-apply), Pitfall 7 (premultiplied alpha), Pitfall 8 (Studio/main/export divergence), Pitfall 13 (Background gaps differ), Pitfall M4/M6.

### Phase 5: Fixed Background track and imported Loop Clips
**Rationale:** The Background track's Loop Clip resolver is the same machinery Reveal's source handling builds on.
**Delivers:** one fixed non-overlapping Background row, imported still/sequence clips, finite/infinite repeat, gaps/fallback, filmstrip capsules, collision rejection.
**Uses:** Loop Clip resolver, `imageStore` LRU + Rust image pipeline (STACK.md).
**Avoids:** Pitfall 9 (asset duplication), Pitfall 10 (off-by-one), Pitfall 11 (infinite loop expanded range), Pitfall 12 (overlap/reorder), Pitfall 13 (gaps differ).

### Phase 6: Photo/reference track
**Rationale:** Distinct from Background; supplies the source for Reveal (Phase 8).
**Delivers:** one photo/reference track, three source modes, reference-only Studio visibility, exclusion from flattened output, frame-aligned source resolution, missing-source recovery.
**Uses:** `imageStore` LRU + Rust image pipeline (STACK.md).
**Avoids:** Pitfall 14 (reference leak), Pitfall M5 (frame-aligned resolution).

### Phase 7: Read-only audio preview
**Rationale:** Independent — reuses Phase 41 as-is; can land any time after the shared application-frame cursor exists (Phase 3).
**Delivers:** read-only synchronized audio monitoring across internal tracks, shared application-frame cursor, no doubled engine.
**Uses:** Phase 41 audio preview (STACK.md) — reuse as-is, no new code.
**Avoids:** Pitfall 15 (audio drift/mutation).

### Phase 8: Shared mask compositor and Reveal
**Rationale:** Reveal layers on the compositor (4), the photo/reference track (6), and Paint/PlayScript coverage (2). It is the deepest integration, so it lands last.
**Delivers:** one offscreen source-plus-mask compositor, alpha-vs-luma interpretation, optional inversion, Reveal result written to an internal Paint/result track.
**Uses:** Canvas 2D offscreen mask compositing (STACK.md).
**Implements:** `efx-paint/mask/` (ARCHITECTURE.md).
**Avoids:** Pitfall 16 (Reveal overlay leak), Pitfall 14 (reference leak).

### Phase 9: Integrated v1.0.0 acceptance
**Rationale:** The enforcement backstop for all stop conditions.
**Delivers:** automated gates (vitest, typecheck, build, cargo test, release preflight) + native UAT + signed/notarized release.
**Avoids:** Pitfall 18 (scope creep) — Phase 9 stop conditions are the enforcement backstop.

### Phase Ordering Rationale

- **1 before everything:** the document model and clean-break rejection are the foundation; deleting the legacy path first prevents accidental dependency on it.
- **2 before 3:** the multi-row timeline needs track-local state to exist first.
- **3 before 4:** the compositor consumes the hide/solo/opacity/blend controls the timeline exposes.
- **4 before 5/6/8:** the flattened-result contract is the keystone; Background, photo/reference, and Reveal all feed the same compositor.
- **5 before 6:** the Background Loop Clip resolver is the same machinery Reveal's source handling builds on.
- **7 is independent:** audio preview reuses Phase 41 as-is; can land any time after the shared application-frame cursor exists (Phase 3).
- **8 last:** Reveal is the deepest integration, layering on the compositor, photo/reference track, and Paint/PlayScript coverage.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** exact `.mce` v1.0 schema field-level design (the spec's canonical document concept is illustrative, not locked). Needs a schema decision before planning.
- **Phase 4:** opacity/blend application order (opacity before blend, AE convention) must be locked and documented; the pixel acceptance matrix needs full enumeration.
- **Phase 8:** Reveal result track semantics (written to vs represented by an internal Paint/result track) need a decision.

Phases with standard patterns (skip research-phase):
- **Phase 2:** track-local addressing and revision authority are direct extensions of proven store patterns.
- **Phase 5:** Loop Clip resolution is a verbatim reuse of the existing resolver.
- **Phase 7:** audio preview is a verbatim reuse of Phase 41.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All capabilities map onto existing, proven machinery verified by direct repo inspection; version claims cross-checked against npm registry; zero new dependencies |
| Features | HIGH | Spec is user-locked and authoritative; competitive patterns cross-checked against TVPaint, Harmony, Krita, Blender GP, Procreate, AE, Nuke, Flame/Smoke, Photoshop, Unity, MNG |
| Architecture | HIGH | All integration points verified by direct repo inspection of the locked spec and existing stores/bridge/renderer/persistence code; open questions are internal seam choices, not ecosystem unknowns |
| Pitfalls | HIGH | Grounded in the spec risk register, required truth tables, forbidden sequence-level assumptions, and v0.7.0/v0.8.0/v0.9.0 post-mortems; web-derived patterns tagged LOW and used only to confirm prevention strategies |

**Overall confidence:** HIGH

### Gaps to Address

- **Exact `.mce` v1.0 schema:** the spec's canonical document concept is illustrative, not a locked field-level implementation. Phase 1 planning must lock the field-level schema (document, track, photo-reference, background, FrameLoopClip) before code.
- **Track cache key composition:** the exact composition of the track cache key (track revision + which composition dependencies) must be specified in Phase 4 planning so unchanged tracks skip re-composite.
- **Opacity/blend application order:** opacity-before-blend (AE convention) must be locked and documented in Phase 4; the pixel acceptance matrix must enumerate it.
- **Reveal result track semantics:** whether the Reveal result is written to a new internal Paint/result track or represented by an existing track must be decided in Phase 8 planning.
- **Track-aware `paintVersion` reactivity model:** the exact mechanism (per-track counter vs track-aware reactivity) must be decided in Phase 2 planning to avoid over-invalidation.

## Sources

### Primary (HIGH confidence)
- `SPECS/milestone-v1.0.0-plan.md` — architectural invariant, ownership boundaries, locked MVP scope, required truth tables, canonical document concept, identity/asset/history rules, clean-break boundary, composition order, loop resolution formula, forbidden sequence-level assumptions, risk register, 9-phase structure
- Direct repo inspection: `app/src/lib/previewRenderer.ts`, `app/src/stores/physicPaintStore.ts`, `app/src/stores/paintStore.ts`, `app/src/lib/physicPaintBridge.ts`, `app/src/lib/physicPaintPersistence.ts`, `app/src/lib/paintPersistence.ts`, `app/src/stores/projectStore.ts`, `app/src/types/project.ts`, `app/src/types/physicPaint.ts`, `app/src/types/paint.ts`, `app/src/types/layer.ts`, `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts`, `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts`, `app/src/components/physic-paint/roto/physicsPaintRotoLoopClips.ts`, `app/src/components/physic-paint/audio/efxPaintAudioPreviewStore.ts` + `efxPaintAudioMonitor.ts` + `efxPaintAudioOwnership.ts`, `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` + `hooks/useRotoTimelineModel.ts`, `app/src/stores/imageStore.ts`, `app/src/lib/history.ts`, `app/package.json`
- `.planning/PROJECT.md` — Key Decisions and post-mortems (Phases 27-32 adapter failure, 36.14 canonical physical-frame cutover, Phase 41 audio anchor model, Phase 43 Loop Clip resolver, Phase 43.6 batch ops, v0.8.1 CSP fix)

### Secondary (MEDIUM confidence)
- npm registry (https://registry.npmjs.org/@preact/signals, /@tauri-apps/api, /preact, /tailwindcss, /@tauri-apps/plugin-fs, /@tauri-apps/plugin-dialog, /@tauri-apps/plugin-store) — current version verification
- Tauri v2 release page (https://v2.tauri.app/release/) — `@tauri-apps/api` 2.11.1, cli 2.11.4
- Tailwind CSS v4.3 blog (https://tailwindcss.com/blog/tailwindcss-v4-3) — v4.3.x line

### Tertiary (LOW confidence — cross-referenced patterns only)
- TVPaint, Toon Boom Harmony, Krita, Blender Grease Pencil, Procreate, After Effects, Nuke, Flame/Smoke, Photoshop, Unity Streaming Image Sequence, MNG spec — competitive feature patterns (FEATURES.md)
- NLE opacity/blend order divergence (FCP vs Resolve), double-premultiplied alpha dark halos, hidden black V0 layer, AE track-matte leak, Harmony Transform-Loop seam, Godot audio self-overlap, AudioContext clock drift, undo byte-budget/one-stack, schema-evolution silent-breakage — pitfall prevention confirmation (PITFALLS.md)

---
*Research completed: 2026-08-23*
*Ready for roadmap: yes*
