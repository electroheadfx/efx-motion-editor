---
phase: 63-brush-tip-pipeline
verified: 2026-11-15T13:46:13Z
status: gaps_found
score: 20/22 must-haves verified
covered_files:
  - .planning/phases/63-brush-tip-pipeline/63-01-PLAN.md
  - .planning/phases/63-brush-tip-pipeline/63-01-SUMMARY.md
  - .planning/phases/63-brush-tip-pipeline/63-02-PLAN.md
  - .planning/phases/63-brush-tip-pipeline/63-02-SUMMARY.md
  - .planning/phases/63-brush-tip-pipeline/63-03-PLAN.md
  - .planning/phases/63-brush-tip-pipeline/63-03-SUMMARY.md
  - .planning/phases/63-brush-tip-pipeline/63-04-PLAN.md
  - .planning/phases/63-brush-tip-pipeline/63-04-SUMMARY.md
  - .planning/phases/63-brush-tip-pipeline/63-05-PLAN.md
  - .planning/phases/63-brush-tip-pipeline/63-05-SUMMARY.md
  - .planning/phases/63-brush-tip-pipeline/63-06-PLAN.md
  - .planning/phases/63-brush-tip-pipeline/63-06-SUMMARY.md
  - .planning/phases/63-brush-tip-pipeline/63-07-PLAN.md
  - .planning/phases/63-brush-tip-pipeline/63-07-SUMMARY.md
  - .planning/phases/63-brush-tip-pipeline/63-08-PLAN.md
  - .planning/phases/63-brush-tip-pipeline/63-08-SUMMARY.md
  - .planning/phases/63-brush-tip-pipeline/63-09-PLAN.md
  - .planning/phases/63-brush-tip-pipeline/63-09-SUMMARY.md
  - app/src-tauri/src/commands/efx_paint_media.rs
  - app/src-tauri/src/commands/project.rs
  - app/src-tauri/src/lib.rs
  - app/src-tauri/src/models/project.rs
  - app/src-tauri/src/services/efx_paint_media.rs
  - app/src-tauri/src/services/frame_codec.rs
  - app/src-tauri/src/services/project_io.rs
  - app/src-tauri/tests/physic_paint_cache_publication.rs
  - app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts
  - app/src/components/physic-paint/engine/aquarelleFootprint.test.ts
  - app/src/components/physic-paint/engine/aquarelleFootprint.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
  - app/src/components/physic-paint/view/BrushesDocker.tsx
  - app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
  - app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
  - app/src/components/physic-paint/view/aquarelleRecordState.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/watercolorStrokeThumb.test.ts
  - app/src/components/physic-paint/view/watercolorStrokeThumb.ts
  - app/src/lib/efxPaintBrushAssets.test.ts
  - app/src/lib/efxPaintBrushAssets.ts
  - app/src/lib/efxPaintBrushImport.test.ts
  - app/src/lib/efxPaintBrushImport.ts
  - app/src/lib/efxPaintBrushSet.test.ts
  - app/src/lib/efxPaintBrushSet.ts
  - app/src/lib/efxPaintPackage.test.ts
  - app/src/lib/efxPaintPackage.ts
  - app/src/lib/efxPaintPersistence.test.ts
  - app/src/lib/efxPaintPersistence.ts
  - app/src/lib/ipc.ts
  - app/src/lib/mceFieldContract.test.ts
  - app/src/lib/physicPaintBridge.test.ts
  - app/src/lib/physicPaintBridge.ts
  - app/src/lib/webpBytes.ts
  - app/src/main.tsx
  - app/src/stores/aquarelleBrushCatalog.test.ts
  - app/src/stores/aquarelleBrushCatalog.ts
  - app/src/stores/projectStore.efxPaintCutover.test.ts
  - app/src/stores/projectStore.ts
  - app/src/types/physicPaint.ts
  - app/src/types/project.ts
  - packages/efx-watercolor/src/brushes/builtinBake.test.ts
  - packages/efx-watercolor/src/brushes/builtinTipMasks.generated.ts
  - packages/efx-watercolor/src/brushes/builtinTips.test.ts
  - packages/efx-watercolor/src/brushes/builtinTips.ts
  - packages/efx-watercolor/src/brushes/deriveMask.test.ts
  - packages/efx-watercolor/src/brushes/deriveMask.ts
  - packages/efx-watercolor/src/brushes/importTip.test.ts
  - packages/efx-watercolor/src/brushes/importTip.ts
  - packages/efx-watercolor/src/brushes/index.ts
  - packages/efx-watercolor/src/brushes/maskRegistry.test.ts
  - packages/efx-watercolor/src/brushes/maskRegistry.ts
  - packages/efx-watercolor/src/brushes/pack.test.ts
  - packages/efx-watercolor/src/brushes/pack.ts
  - packages/efx-watercolor/src/brushes/tips.ts
  - packages/efx-watercolor/src/playground/brushBridge.test.ts
  - packages/efx-watercolor/src/playground/brushBridge.ts
covered_digest: "v4:sha256:25f37defc9dc7c0ff8be4f098d2f846bef132fe136a9e0e8d8f6e5563c1e010a"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "SC5 / TIP-17 — Opening a project replaces the tip catalog and mask registry with THAT project's entries plus the three built-ins, so every tip the open accepted is listed, paints, and travels into a script."
    status: failed
    reason: "CR-01: the two halves of the catalog channel enforce different laws. loadProjectBrushSet/tipFromRaw accepts the pack carrier's law (five categories, unknown extra members ignored); buildBrushCatalogPayload re-emits each tip verbatim ({...tip}); the Studio wire guard isCustomTipWire requires EXACTLY the 12 member keys and category === 'custom'. One accepted entry of another category or with a stray member refuses the payload WHOLE, so the Studio realm receives nothing — no masks, no assets, no list — and a later script save carries no masks for its wc/custom-* ids. The triggering manifest is accepted by the open path and re-written on every save, so the state survives save/reopen."
    artifacts:
      - path: "app/src/types/physicPaint.ts"
        issue: "isCustomTipWire (2968-2981) requires hasOnlyKeys(AQUARELLE_TIP_MEMBER_KEYS) and category 'custom'; isPhysicPaintBrushCatalogPayload (3013-3022) refuses the payload whole via entries.every(...)."
      - path: "app/src/stores/aquarelleBrushCatalog.ts"
        issue: "buildBrushCatalogPayload (302-318) spreads each project tip verbatim ({ ...tip }) instead of normalizing to the wire law."
      - path: "packages/efx-watercolor/src/brushes/pack.ts"
        issue: "CATEGORIES accepts all five categories (37-43); isTipRecord (73-93) ignores unknown members; asTipRecord copies every member (144-149)."
      - path: "app/src/lib/efxPaintBrushSet.ts"
        issue: "tipFromRaw (129-138) revalidates with asTipRecord(raw, 'package'), admitting tips the Studio guard will reject."
    missing:
      - "Normalize each emitted entry from the named fields only, and pin/refuse a non-'custom' category at the project open boundary (or relax the guard to CATEGORIES and degrade per entry)."
      - "Regression pin: a project tip carrying a stray member or foreign category must still reach the Studio catalog (or degrade one entry, never the whole snapshot)."
  - truth: "The wire guards are total: a malformed catalog or import payload is REFUSED, never thrown (the documented never-throws contract every consumer relies on)."
    status: failed
    reason: "WR-01: decodeBase64OrNull (app/src/types/physicPaint.ts:2961-2965) returns base64ToBytes(value) directly; base64ToBytes calls atob with no catch (app/src/lib/webpBytes.ts:82-87) and throws InvalidCharacterError on non-canonical input. The guard docstring at :3007-3012 states the payload guard never throws, and the Studio listener bodies (usePhysicsPaintParentBridge.ts:221) and the import request listener (physicPaintBridge.ts:3258-3260) call it outside any try/catch. A throw drops the snapshot — and in the import path no result event is emitted, so the Studio reports a false 'timed-out'."
    artifacts:
      - path: "app/src/types/physicPaint.ts"
        issue: "decodeBase64OrNull has no try/catch; call sites :2997, :3001, :3029."
      - path: "app/src/lib/webpBytes.ts"
        issue: "base64ToBytes (82-87) calls atob unguarded."
    missing:
      - "Wrap the decode in try/catch returning null, matching the sibling helper in aquarelleBrushCatalog.ts:320-326."
  - truth: "Prohibition (63-08) — Never drop a custom tip's mask silently when saving a script."
    status: failed
    reason: "WR-03: the Studio realm's empty customBrushTips is indistinguishable between a project with no imports and a realm that never received a catalog (CR-01 refusal, a failed mount pull, a failed push). buildScriptBrushEntries returns { ok: true, entries: [] }, serializeAquarelleRotoScript accepts the empty brushPack (isBrushPack is vacuously true on []), and the save succeeds with no mask payload — the omission the function's own docstring says it exists to prevent. Reachable when a capture carries wc/custom-* strokes (e.g. a loaded script whose masks are registry-only) while the catalog is empty."
    artifacts:
      - path: "app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts"
        issue: "buildScriptBrushEntries (341-357) returns an empty successful carrier when customBrushTips is empty; saveActiveFrame accepts it (683-685)."
    missing:
      - "Add a realm-local brushCatalogSynced signal set by applyBrushCatalogPayload; refuse a save with a named reason when the capture references any wc/custom-* id while the flag is false (or answer a boolean on the pull)."
  - truth: "Degradation stays per-tip: one unavailable tip costs exactly one tip and never disables unrelated tips or features (D-18/D-19)."
    status: partial
    reason: "WR-02: buildScriptBrushEntries walks ALL of customBrushTips before serializing. A tip the open listed as unavailable (missing/unreadable/digest-mismatch/invalid-asset-ref) has no remembered WebP in the Studio realm, so it returns ok:false and saveActiveFrame refuses EVERY script save — including captures painted exclusively with built-ins — until the package is repaired. The reason string ('the catalog push never arrived') also misdirects for this case."
    artifacts:
      - path: "app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts"
        issue: "Missing-bytes refusal (341-357) does not distinguish unavailableTipIds from a healthy-but-absent tip; called unconditionally at :683-684."
    missing:
      - "When the tip id is in unavailableTipIds, log and skip that entry; return ok:false only for a tip the realm believes is healthy whose bytes are missing."
  - truth: "TIP-01/TIP-05 — The Studio can request an import and the main realm answers with the entry (one named consumer per published payload)."
    status: partial
    reason: "WR-04: installPhysicPaintBrushImportListener injects the RAW publishPhysicPaintBrushCatalog as the import's publish port; applyBrushImportRequest awaits it after the batch has already mutated the registry, catalog, asset cache and dirty flag. A publish rejection propagates out of applyRequest; none of the three listener registrations has a catch, so the result event is never emitted and the Studio's 15 s timer reports 'timed-out' for an import that already changed project state."
    artifacts:
      - path: "app/src/lib/physicPaintBridge.ts"
        issue: "Raw publisher injected (3181-3185); listener bodies without catch (3201-3214); contrast the wrapped publisher at :3286-3290."
      - path: "app/src/lib/efxPaintBrushImport.ts"
        issue: "applyBrushImportRequest awaits ports.publishCatalog() after the mutation batch (139-150)."
    missing:
      - "Inject a catch-and-log publisher and wrap applyBrushImportRequest so a result carrying a defined failure reason is always emitted."
  - truth: "SC3 — The three built-in textured tips are app-owned and unshadowable."
    status: partial
    reason: "WR-05: registerMask overwrites whatever id it is given; neither registerScriptBrushMasks (a trust boundary — script data), applyProjectBrushSet nor applyBrushCatalogPayload excludes the three compile-time ids. A script entry named wc/builtin-chalk with a foreign 36,864-byte mask replaces the shipped chalk texture for the rest of the session (resetMaskRegistry only runs on close), changing what every later stroke with that built-in paints. replaceMaskRegistry has the same exposure through a foreign package entry."
    artifacts:
      - path: "packages/efx-watercolor/src/brushes/maskRegistry.ts"
        issue: "registerMask overwrites any id, including built-ins (52-57)."
      - path: "app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts"
        issue: "registerScriptBrushMasks registers script-supplied ids without a built-in exclusion (419-422)."
      - path: "app/src/stores/aquarelleBrushCatalog.ts"
        issue: "applyProjectBrushSet/applyBrushCatalogPayload push built-ins first and project masks after, so a duplicate id wins (243-250)."
    missing:
      - "Refuse built-in ids at both write seams (compare against BUILTIN_TIP_MASKS), logging the skip; or make registerMask reject a built-in id and seed built-ins only through resetMaskRegistry."
  - truth: "A hostile or corrupted stored brush asset is bounded BEFORE the digest and dimension guards allocate it (T-63-03 intent: a hostile payload never exhausts memory)."
    status: partial
    reason: "WR-06: read_brush_asset validates path shape, canonicalizes the leaf, refuses symlink/missing, then fs::read's the ENTIRE file before computing the digest and before decode_mask_webp's pre-decode 192x192 guard. A multi-GB regular file at brushes/<64hex>.webp is fully resident before the digest check that would reject it; the dimension guard the phase added is downstream of the allocation it was meant to protect."
    artifacts:
      - path: "app/src-tauri/src/services/efx_paint_media.rs"
        issue: "fs::read before digest/dimension guards (683-688)."
    missing:
      - "Check fs::metadata(&canonical)?.len() against a cap before reading (a 192x192 lossless mask is far under 16 MB) and map over-cap to BRUSH_READ_REFUSED/unreadable."
  - truth: "SC2 / TIP-16 — A save can never silently erase the project's brush pack; validation failures degrade per entry, never lose data."
    status: partial
    reason: "WR-07: buildProjectBrushPack returns null when buildBrushPackSnapshot fails (one invalid entry or a duplicate id), and buildMceProject then omits brushPack entirely, so a save erases every imported tip from the manifest with no log and no surfaced failure. Both current writers produce valid tips, so the branch is unreachable today — but the failure direction is total and silent, and the pack is the only record of the catalog (assets become orphans on disk)."
    artifacts:
      - path: "app/src/stores/aquarelleBrushCatalog.ts"
        issue: "buildProjectBrushPack returns null on any snapshot failure (274-280)."
      - path: "app/src/stores/projectStore.ts"
        issue: "buildMceProject omits the key when the pack is null (504)."
    missing:
      - "Log the offending tip id and prefer a per-entry filter that keeps the valid tips (D-18) over dropping the pack whole."
human_verification:
  - test: "Studio import round trip (63-05 live item): in the Brush tab import a PNG/JPG, paint a visibly textured stroke, switch layers so the Studio re-boots, then paint again with the same tip without re-importing."
    expected: "The imported tip paints its own visibly different footprint in both sessions, with no re-import."
    why_human: "The node vitest environment stubs window and the Tauri event bus; the real cross-webview push, native encode command and decoded-image path only exist in a packaged/live run."
  - test: "Library surface + degraded tip (63-06 live item): import a PNG/JPG; inspect the new Custom card; paint with it. Then open a project whose stored brush asset was removed."
    expected: "The Custom card previews its own painted texture (not another tip's, not a raw mask shape); the painted footprint differs from presets; the degraded tip shows a greyed, unselectable card and exactly one aggregate warning line."
    why_human: "Thumbnail appearance, warning placement and painted-footprint identity are visual judgments the node harness cannot exercise."
  - test: "Persistence UAT (SC2 / TIP-07 / TIP-09 / TIP-16): save a project with an imported tip, quit the app, relaunch and reopen; then move, rename and delete the original source image and reopen; then copy the project directory alone to a fresh profile and reopen."
    expected: "The stroke replays with its imported texture from the .mce alone in every case; the source-image changes are no-ops; the fresh-profile copy reproduces identical strokes and an identical brush library listing. (Untouched save/reopen byte-identity and the directory-copy byte identity are already pinned by tests.)"
    why_human: "Visual replay identity in the packaged app; the automated layer pins bytes and ordering, not the rendered wash."
  - test: "Fresh-install built-ins (SC3): with no project imports, open the brush library and paint with each of Bristle fan, Chalk grain and Sponge."
    expected: "All three are listed adjacent to the presets and each paints its own texture; nothing was written into the project package."
    why_human: "Visible texture identity is perceptual; the code-level constants and mapping are already pinned."
  - test: "Roto script carrier (63-08 D3 / SC5): save a script from a project with an imported tip, then apply it in a project that never imported that tip."
    expected: "The script's strokes paint the carried texture — no neutral round fallback — and no catalog row appears for the script tip."
    why_human: "Vitest stubs the Tauri mask-decode seam and never runs the watercolor wash; only a live run proves the native decode boundary and the painted texture."
  - test: "Project scoping (SC5 / TIP-17): import a tip in project A, open project B, then close the project and start a New Project."
    expected: "In project B the A tip is neither listed nor resolvable; after close/New Project the library and registry hold exactly the three built-ins and no custom id resolves."
    why_human: "The listing/absence in the live UI complements the automated replace/reset pins."
---

# Phase 63: Brush Tip Pipeline Verification Report

**Phase Goal:** An imported PNG or JPG becomes the actual brush tip — a real 192×192 mask that travels inside the `.mce`, rebuilds on open, and paints the same footprint live, baked and replayed, with three textured tips available on every install.
**Verified:** 2026-11-15T13:46:13Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | SC1 — An imported translucent/grayscale PNG/JPG changes the stroke footprint through the pinned two-branch derivation; 4K imports keep both pre-read/pre-decode caps; a corrupt file with a valid PNG header is refused with the existing named copy and no crash | ✓ VERIFIED | `deriveMask.ts` two-branch law + `brushBridge.test.ts` (11 pass) pin the mask into `tipData`; `importTip.ts` caps and `efxPaintBrushImport.test.ts` pin 64 MB/64 MP and corrupt-header refusal with named reasons; live appearance routed to human verification |
| 2 | SC2 — A stroke with an imported tip survives save → quit → relaunch → open and replays from the `.mce` alone; source-image move/rename/delete is a no-op; a fresh-profile directory copy reproduces identical bytes; an untouched save/reopen is byte-identical | ✓ VERIFIED (mechanism) | `brushPack` root + `brushes/<sha256>.webp` content-addressed assets; Rust `brush_mask_asset_round_trips_through_disk_and_decodes_byte_identical` and `brush_asset_survives_a_fresh_profile_directory_copy` (17 brush tests pass); no re-encode path; live replay routed to human verification |
| 3 | SC3 — A fresh install lists and paints three textured tips (Bristle fan, Chalk grain, Sponge), app-owned and never written into a project | ✓ VERIFIED | `builtinTips.test.ts` (ids/labels/36,864-byte frozen masks, registry reseed, no built-in ids in pack snapshots); `builtinBake.test.ts` generates the constants from the same derivation; `project_io` never provisions `brushes/` |
| 4 | SC4 — A missing/corrupt/wrong-size stored mask degrades to an unavailable tip with the neutral round fallback and exactly one aggregate named warning — never a crash, blank paint or aborted open; close/New Project resets catalog + registry with no ghost mask | ✓ VERIFIED | `efxPaintBrushSet.ts` per-entry reasons; `replaceUnavailableTipIds`; `WatercolorBrushLibrary.tsx` one aggregate line + greyed cards; `resetAquarelleBrushState()` in `closeProject` reseeds built-ins; tests in `efxPaintBrushSet.test.ts`, `aquarelleBrushCatalog.test.ts`, `WatercolorBrushLibrary.test.ts` |
| 5 | SC5 — A script saved with an imported tip paints that texture in a project that never imported it, and opening a project replaces the tip catalog and mask registry with that project's entries plus the three built-ins | ✗ FAILED | Normal path verified (script carrier suite 75 tests; replace/reset pinned). But CR-01: a project entry the open path ACCEPTED (`tipFromRaw` → `asTipRecord`) can violate `isCustomTipWire` (exact 12 keys, category `custom`); the payload is then refused WHOLE by the Studio, so "that project's entries" never arrive — no masks, no list, mask-less script saves. See gap 1 |
| 6 | Alpha branch: alpha wins whenever any pixel alpha < 250; the mask is the alpha channel verbatim | ✓ VERIFIED | `deriveMask.ts` + `deriveMask.test.ts` |
| 7 | Luminance branch only when every alpha ≥ 250; invert when mean luminance ≥ 128; Rec.709 coefficients | ✓ VERIFIED | `deriveMask.ts` header + tests pin both branches |
| 8 | A registered mask becomes `buildBrushForStroke`'s `tipData` at `tipSize` 192 from `CUSTOM_BASE`, and the eight override multipliers still apply | ✓ VERIFIED | `brushBridge.ts` single path; `brushBridge.test.ts` pins tipData/tipSize/CUSTOM_BASE/multipliers (11 pass) |
| 9 | A mask-backed brush's `tipMean` is exactly `max(0.01, mean/255)` | ✓ VERIFIED | `brushBridge.test.ts` formula pin; `buildBrush` untouched |
| 10 | Reset leaves no ghost and every registry mutation advances `maskGeneration` | ✓ VERIFIED | `maskRegistry.test.ts`; derived caches key on `maskGeneration()` in `aquarelleFootprint.ts` and `watercolorStrokeThumb.ts` |
| 11 | 36,864-byte mask ⇄ lossless WebP byte-identical; filename is SHA-256 of its own bytes; digest mismatch refused; header-declared dimensions ≠ 192×192 refused before decode; `frames/` MEDIA lock unchanged | ✓ VERIFIED | Rust brush tests 17/17 pass incl. round trip, stem mismatch, header refusal, batch reasons; `bound_guard` tests 2/2 |
| 12 | A whole brush set reads in one native call with per-entry reasons, never a throw for one bad entry | ✓ VERIFIED | `efxPaintBrushSet.ts` one batch + `unavailableTipIds`; `efxPaintBrushSet.test.ts` |
| 13 | Three compile-time masks of exactly 36,864 bytes decoded once; the bake uses the same derivation/normalize; reset restores them | ✓ VERIFIED | `builtinTipMasks.generated.ts`, `builtinTips.ts`, `builtinBake.test.ts`; `builtinTips.test.ts` |
| 14 | `.mce` root `brushPack` declared in both TS and Rust under the field-diff pin; entries carry refs only; inline `mask`/`maskDataUrl` refused; built-ins never in a pack; a no-import project omits the key | ✓ VERIFIED | `mceFieldContract.test.ts:411-449`; `pack.ts` builder/parser; `models/project.rs` round-trip tests; `pack.test.ts` |
| 15 | Catalog store replace-only, composes built-ins; untouched save writes nothing; save copies stored bytes and never re-encodes | ✓ VERIFIED | `applyProjectBrushSet`/`replaceCustomBrushTips`; `aquarelleBrushCatalog.test.ts`; `pendingBrushAssets` copies remembered bytes; Rust write path |
| 16 | Import decodes once, enforces 64 MB/64 MP before read/decode, refuses a corrupt PNG header, mints distinct ids with content dedupe, registers/lists/marks dirty with no undo entry | ✓ VERIFIED | `importTip.ts`, `efxPaintBrushImport.ts` + suites |
| 17 | The main realm alone mutates on import and answers with the entry; a named Studio consumer updates that realm's catalog/registry/unavailable/assets; the mount pull survives a Studio re-boot | ✓ VERIFIED (success path; WR-04 partial) | `physicPaintBridge.test.ts` "answers with the same operationId and publishes the catalog before the answer"; `usePhysicsPaintParentBridge.ts:221`; `main.tsx:150,156` |
| 18 | The library shows presets → Texture → Custom; per-tip thumbnails keyed on id + mask generation; the import row is the only new control; one aggregate warning; picking a mask-backed card selects it | ✓ VERIFIED | `WatercolorBrushLibrary.tsx` + tests; `watercolorStrokeThumb.ts` cache keys |
| 19 | Open reads one batch before any mutation; registration runs after close/reset and before hydrate; a failed tip degrades alone; project B replaces A; close/New Project resets; stored bytes are remembered and travel; a superseded open never applies or publishes | ✓ VERIFIED | `projectStore.ts:1108-1210` ordering; `projectStore.efxPaintCutover.test.ts:1456,1508` superseded-open; `aquarelleBrushCatalog.test.ts` replace/reset |
| 20 | Script carrier: inline base64 WebP data URL only; prefix/canonical/cap/192×192 validated pre-decode; `mask` refused; load registers registry-only; next open/close clears; save reads the Studio realm's cache | ✓ VERIFIED | `physicsPaintRotoScriptSchema.ts` (635 lines) + 75-test carrier suites; no catalog row on load |
| 21 | Wire guards refuse malformed catalog/import payloads, never throw (the documented never-throws contract) | ✗ FAILED | WR-01: `decodeBase64OrNull` → unguarded `atob` (`webpBytes.ts:82-87`); consumers call the guard outside try/catch. See gap 2 |
| 22 | A fresh-profile directory copy reproduces brush assets byte for byte; `create_project_dir` creates exactly the pre-existing directories and never `brushes/` | ✓ VERIFIED | `brush_asset_survives_a_fresh_profile_directory_copy`; `project_io` tests (1 passed + `create_project_dir` tests 2/2) |

**Score:** 20/22 truths verified (0 present, behavior-unverified)

**Prohibitions:** 22/23 verified. The 63-08 prohibition "Never drop a custom tip's mask silently when saving a script" is FAILED (WR-03, gap 3). All other prohibitions across the nine plans hold: single brush-mapping path; length-checked masks; no stale mask after reset; `frames/` lock unwidened; asset writes only at `brushes/<64hex>.webp`; no re-encode on save; no inline mask bytes in the `.mce`; no external tip path; built-ins never generated at runtime nor written into projects; no third-party image library; no second registry; no undo entry for import; `BrushesDocker` never mounted; no mask-backed tip in the lift/eraser popover; no raw mask thumbnail; no append across projects; a failing mask never aborts an open; no re-derive on open; no script asset ref; no script tip added to the catalog; no empty `brushes/` provisioning; no copy by re-encode.

### Deferred Items

None. Phase 64 (Medium Engine) and Phase 65 (Studio API/MCP) do not cover any brush-pipeline finding; every gap below remains Phase 63 scope.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/efx-watercolor/src/brushes/deriveMask.ts` | Two-branch derivation + bake-only normalize | ✓ VERIFIED | Exists, substantive, consumed by import and bake |
| `packages/efx-watercolor/src/brushes/maskRegistry.ts` | Module-level registry, generation, reset-to-builtins | ✓ VERIFIED | Wired by catalog, bridge, thumbnails, footprint |
| `packages/efx-watercolor/src/playground/brushBridge.ts` | The ONE live/bake mapping | ✓ VERIFIED | Six consumers route through it; no second mapping path |
| `packages/efx-watercolor/src/brushes/builtinTipMasks.generated.ts` | Three base64 compile-time masks | ✓ VERIFIED | Decoded once; 36,864 bytes each |
| `packages/efx-watercolor/src/brushes/builtinTips.ts` | Three frozen tip records + masks | ✓ VERIFIED | Single source of built-in ids/labels |
| `packages/efx-watercolor/src/brushes/pack.ts` | One pack shape authority, carrier modes | ✓ VERIFIED (law mismatch note) | Total, fail-closed; its wider category/member tolerance is the CR-01 root |
| `app/src-tauri/src/services/frame_codec.rs` | Lossless mask encode + header dimension walk | ✓ VERIFIED | Byte-identical round trip; refusal before decode |
| `app/src-tauri/src/services/efx_paint_media.rs` | Bound-path brush branch, digest/stem, batch read | ✓ VERIFIED (WR-06 note) | 17 brush tests pass; whole-file read precedes digest cap |
| `app/src-tauri/src/commands/efx_paint_media.rs` | Encode/write/decode/batch-read commands | ✓ VERIFIED | Registered in `lib.rs`; results are real bytes |
| `app/src-tauri/src/services/project_io.rs` | No `brushes/` provisioning | ✓ VERIFIED | Test asserts absence |
| `app/src/lib/efxPaintPackage.ts` | Fail-closed brush path helpers | ✓ VERIFIED | Mirrors Rust bound shape |
| `app/src/types/project.ts` / `app/src-tauri/src/models/project.rs` | `brushPack` declared both languages | ✓ VERIFIED | Field-diff pin `mceFieldContract.test.ts:411-449` |
| `app/src/lib/efxPaintBrushAssets.ts` | Session asset cache + staging list | ✓ VERIFIED | Refuses digest/bytes conflict; post-commit marking |
| `app/src/lib/efxPaintBrushSet.ts` | One-batch loader with per-entry degradation | ✓ VERIFIED (CR-01 note) | Total; accepts wider tips than the wire guard |
| `app/src/lib/efxPaintBrushImport.ts` | Main-realm import mutation | ✓ VERIFIED (WR-04 note) | Registers/lists/dirty/publishes; no undo |
| `packages/efx-watercolor/src/brushes/importTip.ts` | Header sniffing, caps, fresh ids | ✓ VERIFIED | Named failures, never throws |
| `app/src/stores/aquarelleBrushCatalog.ts` | Project-scoped catalog, payload producer/applier | ✓ VERIFIED (WR-05/WR-07 notes) | Replace-only; publishes on apply |
| `app/src/types/physicPaint.ts` | Wire guards for the four brush events | ✓ VERIFIED (CR-01/WR-01 notes) | Guards are structural; one non-totality seam |
| `app/src/lib/physicPaintBridge.ts` | Import/catalog transport | ✓ VERIFIED (WR-04 note) | Timeout, correlation, triple transport |
| `app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts` | Studio receiver + mount pull | ✓ VERIFIED | Calls `applyBrushCatalogPayload`; installed at launch |
| `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` | Sectioned library, import row, one warning | ✓ VERIFIED | 396 lines, live signals, no innerHTML |
| `app/src/components/physic-paint/view/watercolorStrokeThumb.ts` | Per-tip painted thumbnails | ✓ VERIFIED | Cache keyed `id\|g{maskGeneration}` |
| `app/src/components/physic-paint/engine/aquarelleFootprint.ts` | Mask-aware footprint caching | ✓ VERIFIED | Signature includes mask generation |
| `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts` | Script carrier parser/serializer | ✓ VERIFIED | 512 KB cap, canonical base64, exact 192×192 pre-decode |
| `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts` | Save/load legs | ✓ VERIFIED (WR-02/WR-03 notes) | Registry-only load; save walks all tips |
| `app/src/components/physic-paint/view/BrushesDocker.tsx` | (No mount site; D-02 retires it) | ⚠️ ORPHANED | Dead code modified with a mask-dropping importer (IN-02); not mounted, so it cannot alter behavior today |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `brushBridge.ts` | `maskRegistry.ts` | `buildBrushForStroke` resolves registered mask before preset | ✓ WIRED | Tested |
| `maskRegistry.ts` | `brushes.ts` | `TIP_SIZE` defines the only legal mask length | ✓ WIRED | `TIP_MASK_BYTES` enforced |
| `commands/efx_paint_media.rs` | `services/efx_paint_media.rs` | Commands route through the bound guard and write transaction | ✓ WIRED | Rust tests |
| `efxPaintPackage.ts` | `efx_paint_media.rs` | `buildBrushAssetRelativePath` mints the shape the parser accepts | ✓ WIRED | `efxPaintPackage.test.ts` |
| `projectStore.ts` | `aquarelleBrushCatalog.ts` | `buildMceProject` emits `buildProjectBrushPack()` at the root | ✓ WIRED | `projectStore.ts:454,504` |
| `efxPaintPersistence.ts` | `efxPaintBrushAssets.ts` | `pendingBrushAssets` supplies staged bytes | ✓ WIRED | Save stages stored bytes only |
| `models/project.rs` | `types/project.ts` | Field-diff pin on `MceProject.brushPack` | ✓ WIRED | `mceFieldContract.test.ts:411-449` |
| `efxPaintBrushImport.ts` | `aquarelleBrushCatalog.ts` | One mutation adds entry, registers mask, marks dirty | ✓ WIRED | `efxPaintBrushImport.test.ts` |
| `physicPaintBridge.ts` | `efxPaintBrushImport.ts` | Import request handler runs in the main realm only | ✓ WIRED | Bridge round-trip test |
| `usePhysicsPaintParentBridge.ts` | `aquarelleBrushCatalog.ts` | Receiver calls `applyBrushCatalogPayload` in the child realm | ✓ WIRED (partial) | Works for producer-conforming payloads; CR-01 refuses whole otherwise |
| `physicPaintBridge.ts` | `usePhysicsPaintParentBridge.ts` | Triple transport + mount pull | ✓ WIRED | `physicPaintBridge.test.ts:8482` pins install; pull tested |
| `WatercolorBrushLibrary.tsx` | `physicPaintBridge.ts` | Import row calls `requestPhysicPaintBrushImport` | ✓ WIRED | Library tests |
| `WatercolorBrushLibrary.tsx` | `aquarelleBrushCatalog.ts` | Both mounts read THAT realm's catalog signal | ✓ WIRED | Child-realm signals |
| `watercolorStrokeThumb.ts` | `brushBridge.ts` | Mask-backed thumbnails via `buildBrushForStroke` | ✓ WIRED | Cache/generation tests |
| `projectStore.ts` | `efxPaintBrushSet.ts` | Load before `closeProject`, apply after, before hydrate | ✓ WIRED | Source-order pin test |
| `aquarelleBrushCatalog.ts` | `maskRegistry.ts` | `applyProjectBrushSet` replaces the whole registry | ✓ WIRED | Replace-only tests |
| `projectStore.ts` | `aquarelleBrushCatalog.ts` | `closeProject` → `resetAquarelleBrushState()` | ✓ WIRED | `projectStore.ts:1248` |
| `physicsPaintRotoScriptLibrary.ts` | `efxPaintBrushAssets.ts` | Save leg reads the STUDIO realm's stored bytes | ✓ WIRED | Fresh-module test through `applyBrushCatalogPayload` |
| `aquarelleBrushCatalog.ts` | `efxPaintBrushAssets.ts` | Payload remembers each entry's `webpBase64` | ✓ WIRED | `applyBrushCatalogPayload` |
| `physicsPaintRotoScriptLibrary.ts` | `aquarelleBrushCatalog.ts` | Load leg registers masks without a catalog row | ✓ WIRED | Registry-only test |
| `project_io.rs` | `efx_paint_media.rs` | Copied package's asset read through the same bound guard | ✓ WIRED | Fresh-profile test |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `WatercolorBrushLibrary.tsx` | `customBrushTips` / `builtin` list | Real catalog signal, filled by `applyProjectBrushSet` + `applyBrushCatalogPayload` | Yes — imported/serialized entries; no fixture data in production | ✓ FLOWING |
| `watercolorStrokeThumb.ts` / `aquarelleFootprint.ts` | mask bytes | `resolveMask(id)` from the module registry (import derivation, project open decode, built-in constants) | Yes — real 192×192 bytes | ✓ FLOWING |
| `efxPaintBrushImport.ts` → save staging | stored WebP | Rust `efx_paint_encode_brush_mask` result → `rememberBrushAsset` → `pendingBrushAssets` → Rust write | Yes — actual encoded bytes, never a literal | ✓ FLOWING |
| `physicsPaintRotoScriptLibrary.ts` save leg | `webpBase64` / mask data URL | Studio realm's `brushAssetBytes` cache filled only by the published payload | Yes — real stored bytes; refuses when absent | ✓ FLOWING |
| `efxPaintBrushSet.ts` | masks/assets | Native batch read `efx_paint_read_brush_assets` | Yes — disk bytes; per-entry reasons | ✓ FLOWING |

No static-return, hardcoded-empty or mock data path was found in the shipped pipeline. The unknown-id → round-preset branch in `buildBrushForStroke` is the declared neutral fallback, not a stub.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Mask reaches the brush tip through the one mapping | `pnpm --filter @efxlab/efx-watercolor exec vitest run src/playground/brushBridge.test.ts` | 11/11 passed (306 ms) | ✓ PASS |
| Catalog/asset/set/script carrier behavior | `pnpm --filter efx-motion-editor exec vitest run src/stores/aquarelleBrushCatalog.test.ts src/lib/efxPaintBrushSet.test.ts src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts` | 96/96 passed (1.22 s) | ✓ PASS |
| Native brush-asset boundary (encode/write/read/digest/header/copy) | `cargo test --lib brush` in `app/src-tauri` | 17/17 passed (6.32 s) | ✓ PASS |
| Project provisioning without `brushes/` and unchanged MEDIA lock | `cargo test --lib create_project_dir` / `cargo test --lib bound_guard` | 2/2 and 2/2 passed | ✓ PASS |
| Full phase suite (wave-7 baseline re-confirmed in this verification) | app 11-file run + 4-file run; package brushes + bridge; Rust filters | 365+1 skip, 190, 108+1 skip, 11, 17+2+2 — no failures | ✓ PASS |

### Probe Execution

No probe scripts were declared in the phase plans/summaries and none exist under `scripts/*/tests/probe-*.sh`. Step 7c: not applicable (the phase is not a migration/CLI phase).

### Requirements Coverage

All 17 phase requirement IDs appear in at least one plan's `requirements:` field — no orphaned requirements.

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| TIP-01 | 63-05, 63-06 | Import changes the stroke footprint to the image's texture | ✓ SATISFIED | Import handler + library + mapping tests; live visual = human item |
| TIP-02 | 63-01, 63-05 | Exactly 192×192 = 36,864 bytes, derived once at import | ✓ SATISFIED | `deriveMask`/`importTip` + suites |
| TIP-03 | 63-01 | One pinned two-branch rule documented in the module header | ✓ SATISFIED | `deriveMask.ts` header + both-branch tests |
| TIP-04 | 63-05 | 64 MP refusal before decode; corrupt PNG header refused without crash | ✓ SATISFIED | `importTip.test.ts`, `efxPaintBrushImport.test.ts` |
| TIP-05 | 63-01 | `buildBrushForStroke` is the single live/bake mapping from `CUSTOM_BASE` | ✓ SATISFIED | `brushBridge.test.ts`; no second mapping |
| TIP-06 | 63-01, 63-05, 63-06 | Registry fed by the import surface; reset leaves no ghost mask | ✓ SATISFIED | `maskRegistry.test.ts`, catalog reset tests |
| TIP-07 | 63-07 | Imported tip survives save → quit → relaunch → open from the `.mce` | ✓ SATISFIED (mechanism) | Persistence/open tests; live replay = human item |
| TIP-08 | 63-02, 63-04 | Lossless content-addressed asset, byte-identical decode, never re-encoded, source discarded | ✓ SATISFIED | Rust round-trip/digest tests; staging copy; import discards source |
| TIP-09 | 63-02, 63-04 | No tip depends on a file outside the package | ✓ SATISFIED | Shape guards on both sides; no external path |
| TIP-10 | 63-02, 63-05, 63-06, 63-07 | Caps before read/decode; degraded stored mask → unavailable + one warning, never abort | ✓ SATISFIED | Loader reasons, aggregate warning, caps tests |
| TIP-11 | 63-04 | `brushPack` root carrier declared in both languages under the field pin | ✓ SATISFIED | `mceFieldContract.test.ts:411-449` |
| TIP-12 | 63-07 | Decode/register inside the open await, before first replay; one call; failing tip never aborts | ✓ SATISFIED | Ordering source pin; batch loader; superseded-open tests |
| TIP-13 | 63-03, 63-06 | Three built-ins on every install, app-owned, never in a project | ✓ SATISFIED | `builtinTips.test.ts`; no built-in ids in packs |
| TIP-14 | 63-08 | Script carries the tip's mask and paints in a project that lacks it | ✓ SATISFIED (unit) | 75-test carrier suites; live = human item; see WR-02/WR-03 warnings |
| TIP-15 | 63-04 | `buildBrushPackSnapshot` is the one shape authority, total and fail-closed | ✓ SATISFIED | `pack.ts` + `pack.test.ts` |
| TIP-16 | 63-04, 63-09 | Untouched save/reopen byte-identical; fresh-profile copy identical | ✓ SATISFIED | Rust copy test; persistence/catalog tests |
| TIP-17 | 63-07 | Opening replaces never appends; A absent in B; close/New resets to three built-ins | ✓ SATISFIED* | Replace/reset tests. *Accepted non-conforming entries fail to reach the Studio catalog — the CR-01 gap |

### Anti-Patterns Found

Debt-marker scan: no `TBD`, `FIXME` or `XXX` in any phase-modified file (grep exit 1). No empty-return stubs, no `fetch`-ignored, no placeholder copy in the shipped paths.

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `app/src/types/physicPaint.ts` | 2968-2981, 3013-3022 | Cross-layer guard disagreement with `pack.ts` acceptance | 🛑 BLOCKER (CR-01) | One accepted entry empties the Studio catalog; mask-less script saves |
| `app/src/types/physicPaint.ts` | 2961-2965 | Unguarded `atob` inside a "never throws" guard | ⚠️ WARNING (WR-01) | Thrown decode drops the snapshot; false timeout |
| `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts` | 341-357, 683-684 | Save walks all customs, refuses every script save on one degraded tip | ⚠️ WARNING (WR-02) | Over-broad refusal blocks unrelated saves |
| `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts` | 341-357, 683-685 | Empty catalog indistinguishable from no imports → empty successful carrier | ⚠️ WARNING (WR-03) | Silent mask omission in a degraded-state chain |
| `app/src/lib/physicPaintBridge.ts` | 3181-3185, 3201-3214 | Raw publisher injected; listener bodies uncaught | ⚠️ WARNING (WR-04) | Mutation without an answer on publish failure |
| `packages/efx-watercolor/src/brushes/maskRegistry.ts` | 52-57 | `registerMask` overwrites any id incl. built-ins | ⚠️ WARNING (WR-05) | Script/package can shadow built-in textures for the session |
| `app/src-tauri/src/services/efx_paint_media.rs` | 683-688 | `fs::read` before digest/dimension caps | ⚠️ WARNING (WR-06) | Hostile huge asset can exhaust memory before refusal |
| `app/src/stores/aquarelleBrushCatalog.ts` | 274-280 | Snapshot failure drops the whole pack silently | ⚠️ WARNING (WR-07) | Total silent data loss if a writer ever emits an invalid tip |
| `app/src-tauri/src/commands/efx_paint_media.rs` | 225-229 | Redundant rejection arm | ℹ️ INFO (IN-01) | No behavioral impact |
| `app/src/components/physic-paint/view/BrushesDocker.tsx` | 88-100, 232-235 | Dead docker with a mask-dropping importer | ℹ️ INFO (IN-02) | Unmounted; a trap if revived |
| `app/src/types/physicPaint.ts` | 2973-2977 vs 3019 | Entry guard omits id/name length caps it defines | ℹ️ INFO (IN-03) | Unbounded foreign strings re-published |
| `app/src/lib/physicPaintBridge.ts` | 3174-3179 | Mask decoded twice at the import boundary | ℹ️ INFO (IN-04) | Wasted 49 KB conversion per request |

All 12 review findings remain `open` in `63-REVIEW-DISPOSITION.md`; none was silently absorbed.

**Test Quality Audit.**
- Disabled tests: exactly one requirement-adjacent skip — `builtinBake.test.ts:194` is the env-gated one-off authoring bake (`BAKE_BUILTIN_TIPS=1`); its output (the three constants) is independently pinned by `builtinTips.test.ts` and the end-to-end assertion inside the bake itself, so this is a WARNING-level note, not a blocker. One unrelated pre-existing skip (`physicPaintBridge.test.ts:4156`, native window close) predates this phase. GPU-gated suites in `engineAdapter.test.ts` are environment skips, not phase tests.
- Circularity: none in the phase suites — the only write inside a test is the bake generator's intentional authored artifact; the projectStore tests use `writeFile: vi.fn` mocks for the IPC seam.
- Assertion strength: inspected suites assert values and behavior (byte equality, per-entry reasons, ordering, payload shapes), not merely truthiness; no assertion-free tests.
- Harness caveat (from project memory): vitest collects only `.test.ts`; every phase verify target is a `.test.ts` file and was observed to execute (non-zero counts reported).

### Decision Coverage

`check decision-coverage-verify` (non-blocking): total 23, honored 23, not_honored `[]`. Handler message: "All trackable CONTEXT.md decisions are honored by shipped artifacts."

### Human Verification Required

#### 1. Studio import round trip (63-05 live item)

**Test:** In the Brush tab, import a PNG/JPG, paint a visibly textured stroke, switch layers so the Studio re-boots, then paint again with the same tip without re-importing.
**Expected:** The imported tip paints its own visibly different footprint in both sessions, with no re-import.
**Why human:** The node vitest environment stubs `window` and the Tauri event bus; the real cross-webview push, native encode command and decoded-image path only exist in a live run.

#### 2. Library surface and degraded tip (63-06 live item)

**Test:** Import a PNG/JPG; inspect the new Custom card and paint with it. Then open a project whose stored brush asset was removed.
**Expected:** The Custom card previews its own painted texture (not another tip's, not a raw mask shape); the footprint differs from presets; the degraded tip shows a greyed, unselectable card and exactly one aggregate warning line.
**Why human:** Thumbnail appearance, warning placement and footprint identity are visual judgments the node harness cannot exercise.

#### 3. Persistence UAT (SC2 / TIP-07 / TIP-09 / TIP-16)

**Test:** Save a project with an imported tip, quit, relaunch, reopen; then move/rename/delete the source image and reopen; then copy the project directory alone to a fresh profile and reopen.
**Expected:** The stroke replays with its imported texture from the `.mce` alone in every case; source-image changes are no-ops; the fresh-profile copy reproduces identical strokes and an identical brush library listing.
**Why human:** Rendered replay identity in the packaged app; byte identity and ordering are already automated.

#### 4. Fresh-install built-ins (SC3)

**Test:** With no imports, open the brush library and paint with Bristle fan, Chalk grain and Sponge.
**Expected:** All three are listed adjacent to the presets and each paints its own texture; nothing was written into the project package.
**Why human:** Visible texture identity is perceptual.

#### 5. Roto script carrier (63-08 D3 / SC5)

**Test:** Save a script from a project with an imported tip, then apply it in a project that never imported that tip.
**Expected:** The script's strokes paint the carried texture — no neutral round fallback — and no catalog row appears for the script tip.
**Why human:** Vitest stubs the Tauri mask-decode seam and never runs the watercolor wash.

#### 6. Project scoping (SC5 / TIP-17)

**Test:** Import a tip in project A, open project B, then close the project and start a New Project.
**Expected:** In project B the A tip is neither listed nor resolvable; after close/New Project the library and registry hold exactly the three built-ins.
**Why human:** Live listing/absence complements the automated replace/reset pins.

### Gaps Summary

The normal-path pipeline is real and complete: import → two-branch derivation → one mapping into `tipData` → content-addressed `brushes/<sha256>.webp` → `brushPack` in the `.mce` (both languages under the field pin) → one-batch open decode and registration before the first replay → replace/reset lifecycle → cross-realm catalog push with mount pull → sectioned library with per-tip previews and one aggregate warning → inline script carrier. All phase test suites pass (app 365+190, package 108+11, Rust 17+2+2), and 20 of 22 truths and 22 of 23 prohibitions are verified.

Two truths and one prohibition fail, and seven warnings weaken adjacent behaviors. The blocker is **CR-01**: the open path accepts a project tip under the pack carrier's wider law, the payload producer re-emits it verbatim, and the Studio wire guard refuses the whole snapshot — so a project carrying one stray-member or non-`custom` tip loses its ENTIRE Studio catalog (no masks, no list) and later script saves persist custom-id strokes with no mask payload; the state survives save/reopen. **WR-03** is the matching prohibition failure: an absent catalog is indistinguishable from a project with no imports, so a save can silently omit masks. **WR-01** violates the guards' documented never-throws totality. Warnings WR-02, WR-04, WR-05, WR-06 and WR-07 concern over-refusal on one degraded tip, an import answer lost to a publish rejection, built-in mask shadowing, an unbounded stored-asset read, and a latent silent whole-pack erase. All twelve review findings are still `open` in `63-REVIEW-DISPOSITION.md`.

Because a must-have truth is FAILED, the phase is not shippable as-is: `gaps_found` takes precedence over the human-verification items, which remain listed above for the live UAT pass once the gaps are closed. No item is deferred to a later phase — Phase 64 and Phase 65 do not cover brush-pipeline correctness.

---

_Verified: 2026-11-15T13:46:13Z_
_Verifier: Claude (gsd-verifier)_
