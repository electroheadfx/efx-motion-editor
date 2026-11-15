# Memory Recall (MemPalace)

_Wing: efx_motion_editor · Mode: augment · Transport: mcp_

## Prior decisions

- Masks are lossless WebP package assets at `brushes/<sha256>.webp`, carried package-relatively — never inline base64 in the `.mce` (KG: Phase 63 · decided, valid 2026-11-15).
- The inline-data exception (D-23) to the refs-only package law is retired (KG: Phase 63 · decided).
- The import surface is `WatercolorBrushLibrary`; `BrushesDocker` stays unmounted and is not revived (KG: Phase 63 · decided; 63-06-SUMMARY.md).
- Mask derivation is the pinned two-branch law (alpha, else luminance polarity by mean luminance), shared by import and the built-in bake (KG + 63-01-SUMMARY.md).
- Mask decode + registration completes inside the project-open await, before the first replay (KG + 63-07-SUMMARY.md drawer).
- Project open replaces — never appends — the catalog and registry; close/New Project resets to the three built-ins (63-07-SUMMARY.md).

## Patterns

- Cross-realm catalog channel: main realm produces one snapshot (masks + stored WebP bytes), Studio realm applies replace-only and pulls on mount — `physicPaintBridge.ts` ↔ `usePhysicsPaintParentBridge.ts` (63-05-SUMMARY.md drawer D4/D5).
- Generation-keyed caches (`maskGeneration()`) invalidate thumbnails/footprints so a replaced mask is never served stale (63-06-SUMMARY.md).
- `buildBrushForStroke` is the single live/bake mapping from `CUSTOM_BASE`; no second mapping path (63-01-SUMMARY.md drawer D4).

## Surprises / gotchas

- Cross-layer law disagreement is the live failure mode: `pack.ts` accepts five categories and ignores unknown members while the Studio wire guard demands exactly 12 keys and `category === 'custom'`; one accepted entry refuses the whole snapshot (63-VERIFICATION.md CR-01).
- Wire guards are documented never-throws but call unguarded `atob` — a throw kills the snapshot and produces a false Studio timeout (63-VERIFICATION.md WR-01; sibling safe helper already exists in `aquarelleBrushCatalog.ts`).
- Empty Studio catalog is ambiguous (no imports vs refused snapshot), which is how script saves silently lose masks (63-VERIFICATION.md WR-03).
- Per-tip degradation law (D-18/D-19) is violated by whole-catalog walks: one degraded tip blocks every Roto script save (63-VERIFICATION.md WR-02).
