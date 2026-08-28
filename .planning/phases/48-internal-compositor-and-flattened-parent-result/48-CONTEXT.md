# Phase 48: Internal Compositor and Flattened Parent Result - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the deterministic internal compositor — the milestone's keystone. It resolves all internal Paint tracks (plus the fixed Background track) into **one flattened parent raster per frame**, consumed by the unchanged main-editor parent-layer compositor. The main editor never iterates internal tracks; it composites the parent raster exactly once with the unchanged outer layer stack. Background (49), photo/reference (50), and Reveal (52) all feed this same compositor, so the decisions locked here shape the rest of the milestone.

**Naming contract (locked by user, carried from Phases 45/46/47):** "EFX Paint" = the inline main-editor Basic/FX layer (out of scope, unchanged). "EFX Physic Paint" = the independent module + Studio window — the sole target of v1.0.0 and this phase.

**Copy language (carried from Phase 47):** All user-facing copy is **English**.

</domain>

<decisions>
## Implementation Decisions

### Opacity/blend application (CMP-03)
- **D-01:** Internal track opacity is applied **before** blend mode (After Effects convention): the track's own pixels are scaled by its opacity first, then the blend mode composites that result onto the stack below. A 50%-opacity multiply track multiplies by its half-strength color. — **Reversibility:** costly — changing the order later changes the visual result and requires re-validating the pixel acceptance matrix.
- **D-02:** The flattened parent raster uses **straight alpha** at the boundary to the main editor (unmultiplied RGBA); the main editor's compositor handles the alpha math. Enforced with a pixel test: a 50%-alpha white pixel must composite as 50% white, never a dark gray (Pitfall 7 — no double-premultiplied dark halos). — **Reversibility:** one-way — the alpha convention is a published boundary contract; switching to premultiplied later would break the main-editor compositing and require re-testing every alpha seam.

### Background track resolution (CMP-06)
- **D-03:** The compositor fully resolves Background clips **now** — modulo source mapping, finite/infinite repeat, gaps, and next-clip interruption — reusing the existing Loop Clip resolver (`physicsPaintRotoLoopClips.ts`). The document model already carries `background.clips`. The pixel-matrix rows for Background loops/gaps are testable with documents built directly in unit tests. Phase 49 then only adds the import/repeat/fallback-config UI. — **Reversibility:** costly — deferring Background resolution later would mean revisiting the compositor's shared path.
- **D-04:** The Background track **stays visible when a Paint track is soloed** — only Paint tracks participate in the solo truth table. The Background's own `visible` flag still controls it. Matches the spec's composition order (Background composited before hide/solo is applied to Paint tracks). Users who want isolation can hide the Background.

### Studio preview surface (CMP-01)
- **D-05:** The Studio canvas shows the **flattened composite** (all visible tracks composited — the program monitor), exactly what the main editor will show. Painting, onion-skin, and stroke-editing still target the active track; hide/solo lets the user focus. — **Reversibility:** costly — reverting to an active-track-only view means unwinding the composite preview.
- **D-06:** Onion skinning shows the **active track's previous/next frames ghosted on top of the current composite** — the ghost is the active track's raw frames, not re-composited.

### Flattened raster caching (CMP-04)
- **D-07:** The flattened raster uses **per-track caches + a composite pass**: each track's frame content is cached keyed by track revision + composition dependencies; the composite pass combines the cached track rasters into the flattened result. When one track changes, only that track's cache recomputes, then the composite pass re-runs. — **Reversibility:** costly — switching to a full flattened per-frame cache later means re-keying the cache and losing the incremental recompute.
- **D-08:** The **composite pass result is cached per frame** (keyed by composite revision + frame), so playback draws the cached flattened raster instead of re-running the composite pass every tick. The cache invalidates when any participating track/clip/source/fallback changes.

### Missing source/asset states (CMP-05)
- **D-09:** A missing source frame renders **transparent** in the flattened raster — fail-closed, matching Phase 46 D-13. The Studio surfaces the issue via the existing status capsule (red warning triangle). No placeholder ever leaks into the flattened output or export.

### Per-track content resolution (CMP-01, step 6)
- **D-10:** When a track has multiple content sources at the same frame, the resolution precedence is **Roto timeline wins**: real key > generated interpolation > Hold Loop Clip > cached frame. Matches the current single-track resolver (`isPhysicalRotoWorkflowLayer` → `getRotoPhysicalRenderSource`, else `getFrame`). The Roto timeline is the source of truth; a cached frame is a potentially-stale render of it. — **Reversibility:** costly — changing precedence later changes the visual result and requires re-testing.

### Main-editor delivery (CMP-01, step 10)
- **D-11:** The main editor consumes the flattened raster via a new **store function `getFlattenedFrame(layerId, frame)`** that returns the composited raster + cache key, mirroring the current `getRotoPhysicalRenderSource` pattern. The compositor module is called by the store; the main renderer just draws the result. Replaces the current `getRotoPhysicalRenderSource(layerId, getActiveTrackId(layerId), frame)` single-track call. — **Reversibility:** costly — changing the delivery mechanism later touches `previewRenderer.ts` and the store.

### Claude's Discretion
- Exact cache-key structure for the flattened raster (composite revision + per-track content revisions + frame) and the composite-revision bump semantics (number vs derived hash) — researcher/planner finalize against CMP-04.
- Exact store/function shape for `getFlattenedFrame` and the compositor module layout in `app/src/efx-paint/compositor/` (per ARCHITECTURE.md).
- How the Studio status capsule flags missing sources (reuse the existing red-warning-triangle pattern).
- The pixel-tolerance policy values for the pixel acceptance matrix (existing policy reused).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked spec (source of truth)
- `SPECS/milestone-v1.0.0-plan.md` §Phase 4 — Internal compositor and flattened parent result (objective, composition order, requirements, pixel acceptance matrix). Also §"Canonical document concept" (identity rules) and §"Background track and Loop Clips" (fallback semantics) for the document/background model this compositor consumes.

### Milestone research (2026-08-23, confidence HIGH)
- `.planning/research/SUMMARY.md` — executive summary, build-order rationale, per-phase pitfalls. Phase 4 section: one shared internal composition path, hide/solo truth table, per-track opacity/blend in stable order, one flattened raster + composite revision, pixel acceptance matrix.
- `.planning/research/ARCHITECTURE.md` — Pattern 2 (track-local addressing), the `efx-paint/compositor/` folder, the locked invariant (one parent layer → one document → many tracks → one flattened result).
- `.planning/research/PITFALLS.md` — Pitfall 4 (track-local cache keys missing trackId), Pitfall 6 (parent opacity/blend double-applied), Pitfall 7 (premultiplied alpha), Pitfall 8 (Studio/main/export divergence), Pitfall 13 (Background gaps differ), Pitfall M4/M6.

### Requirements
- `.planning/REQUIREMENTS.md` §CMP — CMP-01..CMP-06 mapped to this phase.
- `.planning/ROADMAP.md` §Phase 48 — goal, success criteria.

### Prior phase context
- `.planning/phases/47-internal-multi-track-timeline-filmstrip-capsules-and-control/47-CONTEXT.md` — hide/solo truth table locked (Pitfall M8), track identity rules, Studio preview hide/solo reflection (this phase replaces it with the real compositor).
- `.planning/phases/46-track-local-paint-roto-playscript-state-loop-clips-and-cache/46-CONTEXT.md` — D-10..D-13 Hold linked-source semantics (live single source-of-truth, linked occurrences render by reference, fail-closed on source-missing), track-local addressing, per-track revision.
- `.planning/phases/45-new-efx-paint-document-and-clean-cutover/45-CONTEXT.md` — document model decisions, identity rules, clean-break invariants.

### Code anchors
- `app/src/efx-paint/document/efxPaintDocument.ts` — the v1.0 document model: `InternalPaintTrack` carries `id`, `name`, `order`, `visible`, `solo`, `opacity`, `blendMode`, `revision`, `frames`, `rotoPhysical`, `loopClips`; `EfxPaintDocument` carries `documentRevision`, `activeTrackId`, `tracks`, `background`, `compositeRevision`; `BackgroundTrack` carries `clips`, `fallback`, `visible`, `revision`.
- `app/src/efx-paint/document/efxPaintDocumentRevision.ts` — `buildEfxPaintCompositeRevision` (track order/visibility/solo/opacity/blend + background visibility/fallback) — the composite-revision foundation for the flattened cache key.
- `app/src/lib/previewRenderer.ts` — `blendModeToCompositeOp`, `resolvePhysicPaintFrameSource` (the single-track path to replace), the parent-layer compositing boundary (unchanged).
- `app/src/components/physic-paint/roto/physicsPaintRotoLoopClips.ts` — the Loop Clip resolver (modulo, finite/infinite, next-clip interruption) — reused for Background clips (D-03).
- `app/src/stores/physicPaintStore.ts` — the current single-track store; the `getFlattenedFrame(layerId, frame)` delivery point (D-11).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `blendModeToCompositeOp` (`previewRenderer.ts`) — the composite pass reuses it for internal track blend modes.
- `physicsPaintRotoLoopClips.ts` — the Loop Clip resolver reused for Background clips (D-03).
- `efxPaintDocument.ts` + `efxPaintDocumentRevision.ts` — the document model + composite revision builder the compositor consumes.
- `resolvePhysicPaintFrameSource` (`previewRenderer.ts`) — the single-track resolution to generalize into the per-track content resolver (D-10).
- The existing render-cache pattern (`getPreviewPhysicPaintFrameCacheKey`) — the flattened raster delivery follows it (D-11).

### Established Patterns
- Track identity: stable `trackId` UUID strings, never array indices — the compositor sorts by `order` but never uses it as identity.
- Hide/solo truth table locked: no solo → all visible; solo → visible+soloed only; hide wins over solo (Pitfall M8).
- Fail-closed rejections surface in the status capsule with a red warning triangle — reused for missing-source alerts (D-09).
- Per-track `paintVersion` bump + subscribe — track mutations bump the track revision, which feeds the flattened cache key.
- Hold linked-source semantics (Phase 46 D-10..D-13): live single source-of-truth, linked occurrences render by reference, fail-closed on source-missing.
- One shared internal composition path for Studio preview and flattened output (CMP-01) — never re-implement per surface (Pitfall 8).

### Integration Points
- `previewRenderer.ts` — the main-editor boundary; replace the `getRotoPhysicalRenderSource(layerId, getActiveTrackId(layerId), frame)` call with `getFlattenedFrame(layerId, frame)` (D-11).
- `physicPaintStore.ts` — the store function `getFlattenedFrame(layerId, frame)` delivery point (D-11).
- `PhysicsPaintStudioView.tsx` / Studio preview — the composite view (program monitor) replaces the active-track view (D-05/D-06).
- The compositor module in `app/src/efx-paint/compositor/` (per ARCHITECTURE.md) — the shared internal composition path.

</code_context>

<specifics>
## Specific Ideas

- The user locked the compositor's visual-fidelity contract explicitly: **opacity first (AE convention)**, **straight alpha** at the boundary, **Roto timeline wins** for per-track content precedence, and **transparent** missing sources (fail-closed, never a placeholder in output).
- The user wants the compositor to be the **keystone**: full Background clip resolution now (reusing the existing resolver) so Phase 49 only adds the import UI, and the Studio canvas becomes the **program monitor** (composite view) with onion-skin ghosts over the composite.
- The user chose **per-track caches + composite pass** with the **composite result cached per frame** — incremental recompute for smooth 15/24 fps playback.

</specifics>

<deferred>
## Deferred Ideas

- Background import/repeat/fallback-config UI — **Phase 49** (BKG); the compositor resolves clips now (D-03), the UI to create them is Phase 49.
- Photo/reference track — **Phase 50** (REF); the compositor's shared path anticipates it but renders no reference surface in Phase 48.
- Shared mask compositor and Reveal — **Phase 52**; layers on this compositor plus the photo/reference track.
- Exact flattened cache-key structure and composite-revision bump semantics — researcher/planner discretion (Claude's Discretion).

</deferred>

---

*Phase: 48-internal-compositor-and-flattened-parent-result*
*Context gathered: 2026-08-28*
