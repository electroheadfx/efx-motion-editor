# Phase 06: Audit Gap Closure — Cleanup & Docs - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove dead code from shelved design decisions (D-07, D-12), delete orphaned assets, fix stale requirement checkboxes and spec wording drift, and resolve onEngineReady timing gap. This is a cleanup phase — no new capabilities.

</domain>

<decisions>
## Implementation Decisions

### Dead code removal
- **D-01:** Delete brush/water.ts entirely — 11 exported functions for 6 brush types (water, smear, blend, blow, wet, dry) with zero callers since D-12. Re-extract from v3.html or git history if needed later.
- **D-02:** Delete all dead code across remaining files — core/diffusion.ts deprecated functions (buildColorMap, sampleChannel, etc.), core/paper.ts brush grain functions (createMirroredBrushGrain, sampleBrushGrain), util/math.ts unused helpers (pt2arr, ptsToArrs). For files with mixed live/dead code, prune only dead functions; delete file entirely if all functions are dead.
- **D-03:** Delete brush_texture.png from public/img/ — never loaded since D-07 replaced it with paper-height deposit modulation.

### onEngineReady timing fix
- **D-04:** Delay onEngineReady callback until after paper textures have loaded. Await loadPaperTextures() before firing the callback so consumers see ready = fully functional engine with real paper textures (not procedural fallback).

### Spec wording updates
- **D-05:** Silently rewrite requirement text in REQUIREMENTS.md to match current reality. No inline decision markers — design decisions are already documented in phase CONTEXT.md files and PROJECT.md Key Decisions table.
- **D-06:** Check off stale checkboxes: LIB-03, DEMO-01, DEMO-02 (all delivered but not checked).
- **D-07:** Update spec wording for: PHYS-01 (JS arrays, not Float32Array/Uint8Array), CANVAS-02 (configurable canvas, not fixed stride 902), LIB-01 (ESM-only, not CJS+ESM), BRUSH-03 (paper-height deposit modulation, not brush_texture.png mask).

### Claude's Discretion
- Which functions in core/diffusion.ts are truly dead vs still called (verify callers before deleting)
- Whether to also clean up re-exports in index.ts that reference deleted modules
- Exact implementation of the onEngineReady delay (await pattern in constructor vs init method)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Audit source
- `.planning/v1.0-MILESTONE-AUDIT.md` — Defines all gaps this phase closes: orphaned exports list, stale checkboxes, spec drift table, timing gap description

### Requirements
- `.planning/REQUIREMENTS.md` — Checkbox and wording updates target this file
- `.planning/PROJECT.md` — Key Decisions table (context for why specs changed)

### Dead code targets
- `paint-rebelle-new/src/brush/water.ts` — 11 exports, 0 callers (delete entirely)
- `paint-rebelle-new/src/core/diffusion.ts` — Deprecated FBM functions (verify callers, prune dead)
- `paint-rebelle-new/src/core/paper.ts` — createMirroredBrushGrain, sampleBrushGrain (dead since D-07)
- `paint-rebelle-new/src/util/math.ts` — pt2arr, ptsToArrs (unused)
- `paint-rebelle-new/src/index.ts` — Library barrel exports (update after deletions)

### Timing fix target
- `paint-rebelle-new/src/engine/EfxPaintEngine.ts` — onEngineReady callback + loadPaperTextures async flow

### Orphaned asset
- `paint-rebelle-new/public/img/brush_texture.png` — Delete (never loaded since D-07)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `paint-rebelle-new/src/index.ts` — Library barrel that re-exports all modules; will need updating after dead code removal
- `paint-rebelle-new/src/engine/EfxPaintEngine.ts` — Facade class where onEngineReady timing fix lives

### Established Patterns
- Pure function modules: brush/, core/, util/ modules receive state as arguments (Phase 05 pattern)
- EfxPaintEngine facade owns all buffers and orchestrates modules
- ESM-only exports via tsup (D-14)

### Integration Points
- `src/index.ts` re-exports everything — dead module removals must update this barrel
- `src/preact.tsx` wraps EfxPaintEngine — onEngineReady change may affect component mount behavior
- `src/animation/AnimationPlayer.ts` wraps EfxPaintEngine — verify no dependency on deleted modules

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard cleanup following the audit report's gap list.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-audit-gap-closure*
*Context gathered: 2026-04-02*
