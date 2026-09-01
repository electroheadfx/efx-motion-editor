# Memory Recall (MemPalace)

_Wing: efx-motion-editor · Mode: augment · Transport: mcp_

## Prior decisions
- The `'photo'` fond mode stays reserved for the Phase 50 photoReference slot — the Phase 49 fallback selector must not expose it (Phase 49 D-11) — drawer `49-03-PLAN.md` (planning room)
- Single fond authority: `_resolveDocumentFondInstruction` reads ONLY `document.background.fallback`; the per-track `_rotoBackgroundMetadata` fond walk was deleted, not shadowed (Pitfall 1 two-sites-not-one) — drawer `49-03-PLAN.md` (planning room)
- Onion-skin ghosts draw the active track's raw frames over the current composite, never re-composited (Phase 48 D-06) — the pattern D-09's reference ghost overlay follows — drawer `48-CONTEXT.md` (decisions room)
- Flattened raster = per-track caches keyed by track revision + composition dependencies, then a composite pass (Phase 48 D-07) — the cache-key model the source revision must feed (REF-04) — drawer `48-CONTEXT.md` (decisions room)

## Patterns
- Cross-window library seam: operationId-correlated bridge pair `physic-paint:image-library-request` / `physic-paint:image-library-result` carrying `{ images: MceImageRef[], projectDir: string }`, following the script-library/roto-authority idiom (physicPaintBridge.ts:85-94) — the seam D-01's asset-picker reuse rides on — drawer `49-04-PLAN.md` (planning room)
- Natural-order import: multi-select sequential images, Confirm lands in natural filename order — never UUID or click order (Phase 49 D-02) — drawer `49-06-PLAN.md` (planning room)

## Surprises / gotchas
- Phase 49's plan prohibitions were authored descriptor-less (flagged-unverified) — the same fail-closed disposition applies to any Phase 50 prohibition authored without a wired check — drawer `49-03-PLAN.md` (planning room)
- The palace KG holds no facts for `photoReference` or `Phase 50` yet — native `.planning/graphs/` and STATE remain the primary graph sources this run.
